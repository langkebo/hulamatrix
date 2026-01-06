<!--
  Room Alias Manager

  Manage Matrix room aliases (addresses) using SDK.
  Allows adding, removing, and setting canonical aliases.

  SDK Integration:
  - client.getAliases(roomId) - Get all aliases for a room
  - client.createAlias(alias, roomId) - Create new alias
  - client.deleteAlias(alias) - Delete alias
  - client.setCanonicalAlias(roomId, alias) - Set main/canonical alias
  - client.resolveRoomAlias(alias) - Check if alias exists
-->
<script setup lang="ts">
import { ref, computed, watch, onMounted, h } from 'vue'
import {
  NCard,
  NButton,
  NSpace,
  NInput,
  NDataTable,
  NTag,
  NPopconfirm,
  NModal,
  NAlert,
  NIcon,
  NTooltip,
  useMessage,
  NSpin,
  NEmpty
} from 'naive-ui'
import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'
import { useI18n } from 'vue-i18n'
import { Plus, Trash, Star } from '@vicons/tabler'

interface Props {
  roomId: string
  show: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  aliasesChanged: [aliases: string[]]
}>()

const message = useMessage()
const { t } = useI18n()

// State
const aliases = ref<string[]>([])
const canonicalAlias = ref<string>('')
const newAliasInput = ref<string>('')
const isLoading = ref<boolean>(false)
const isAdding = ref<boolean>(false)
const isDeleting = ref<Set<string>>(new Set())
const isValidating = ref<boolean>(false)
const error = ref<string>('')
const validationErrors = ref<Map<string, string>>(new Map())

// Computed
const show = computed({
  get: () => props.show,
  set: (value: boolean) => emit('update:show', value)
})

const aliasColumns = computed(() => [
  {
    title: 'Alias',
    key: 'alias',
    render: (row: { alias: string }) => {
      const isCanonical = row.alias === canonicalAlias.value
      return h('div', { class: 'alias-cell' }, [
        h(
          NTooltip,
          {},
          {
            trigger: () =>
              h(
                NTag,
                {
                  type: isCanonical ? 'success' : 'default',
                  size: 'small',
                  style: { marginRight: '8px' }
                },
                { default: () => (isCanonical ? 'Canonical' : 'Alias') }
              ),
            default: () => (isCanonical ? 'Main address for this room' : 'Room alias')
          }
        ),
        h('code', { class: 'alias-text' }, row.alias)
      ])
    }
  },
  {
    title: 'Actions',
    key: 'actions',
    width: 150,
    render: (row: { alias: string }) => {
      const isCanonical = row.alias === canonicalAlias.value
      return h(NSpace, { size: 'small' }, () => [
        !isCanonical
          ? h(
              NTooltip,
              {},
              {
                trigger: () =>
                  h(
                    NButton,
                    {
                      size: 'tiny',
                      circle: true,
                      loading: isDeleting.value.has(row.alias),
                      onClick: () => setCanonical(row.alias)
                    },
                    { icon: () => h(NIcon, null, { default: () => h(Star) }) }
                  ),
                default: () => 'Set as main address'
              }
            )
          : h(
              NButton,
              { size: 'tiny', circle: true, disabled: true, type: 'success' },
              { icon: () => h(NIcon, null, { default: () => h(Star) }) }
            ),
        h(
          NPopconfirm,
          {
            onPositiveClick: () => deleteAlias(row.alias)
          },
          {
            trigger: () =>
              h(
                NButton,
                {
                  size: 'tiny',
                  circle: true,
                  type: 'error',
                  loading: isDeleting.value.has(row.alias),
                  disabled: isCanonical
                },
                { icon: () => h(NIcon, null, { default: () => h(Trash) }) }
              ),
            default: () => 'Delete this alias?',
            description: () => `Remove alias "${row.alias}"? This action cannot be undone.`
          }
        )
      ])
    }
  }
])

const aliasData = computed(() => aliases.value.map((alias) => ({ alias, key: alias })))

const hasError = computed(() => error.value.length > 0)

// Validation
function isValidAliasFormat(alias: string): boolean {
  // Matrix alias format: #localpart:server.com
  const aliasRegex = /^#[a-z0-9_\-=./]+:[a-z0-9.-]+(:[0-9]+)?$/i
  return aliasRegex.test(alias)
}

function extractServerFromAlias(alias: string): string | null {
  const match = alias.match(/^#[^:]+:([^:]+)$/)
  return match ? match[1] : null
}

async function checkAliasAvailability(alias: string): Promise<boolean> {
  try {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    const resolveAliasMethod = (
      client as unknown as {
        resolveRoomAlias?: (alias: string) => Promise<Record<string, unknown>>
      }
    ).resolveRoomAlias

    if (!resolveAliasMethod) {
      logger.warn('[RoomAliasManager] resolveRoomAlias not available, skipping availability check')
      return true // Assume available if method doesn't exist
    }

    try {
      await resolveAliasMethod.call(client, alias)
      return false // Alias exists and resolves to a room
    } catch (resolveError: unknown) {
      const error = resolveError as { errcode?: string; data?: { errcode?: string } }
      const errorCode = error.errcode || error.data?.errcode
      if (errorCode === 'M_NOT_FOUND') {
        return true // Alias is available
      }
      throw resolveError
    }
  } catch (err) {
    logger.error('[RoomAliasManager] Failed to check alias availability:', err)
    return false // Assume unavailable on error
  }
}

// Actions
async function loadAliases(): Promise<void> {
  if (!props.roomId) return

  isLoading.value = true
  error.value = ''

  try {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    // Get room state for canonical alias
    const getRoomMethod = (
      client as unknown as {
        getRoom: (roomId: string) => Record<string, unknown> | undefined
      }
    ).getRoom
    const room = getRoomMethod?.(props.roomId)

    if (room) {
      const getStateEventsMethod = (
        room as {
          getStateEvents?: (eventType: string, stateKey: string) => Record<string, unknown> | undefined
        }
      ).getStateEvents

      const canonicalEvent = getStateEventsMethod?.('m.room.canonical_alias', '')
      if (canonicalEvent && typeof canonicalEvent === 'object') {
        canonicalAlias.value = (canonicalEvent as { alias?: string }).alias || ''
      }
    }

    // Get all aliases using SDK method
    const getAliasesMethod = (
      client as unknown as {
        getAliases?: (roomId: string) => Promise<string[]>
      }
    ).getAliases

    if (getAliasesMethod) {
      const roomAliases = await getAliasesMethod.call(client, props.roomId)
      aliases.value = roomAliases
    } else {
      // Fallback: use room state
      const stateEventsMethod = (
        room as {
          getLiveTimeline?: () => { getStateEvents?: (type: string) => Array<Record<string, unknown>> }
        }
      ).getLiveTimeline

      if (stateEventsMethod) {
        const timeline = stateEventsMethod.call(room)
        const getStateEvents = (
          timeline as {
            getStateEvents?: (type: string) => Array<Record<string, unknown>>
          }
        ).getStateEvents

        if (getStateEvents) {
          const aliasEvents = getStateEvents.call(timeline, 'm.room.aliases')
          aliases.value = aliasEvents.flatMap((event) => {
            const content = event as unknown as { content?: { aliases: string[] } }
            return content.content?.aliases || []
          })
        }
      }
    }

    logger.info('[RoomAliasManager] Aliases loaded:', {
      count: aliases.value.length,
      canonical: canonicalAlias.value
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    error.value = `Failed to load aliases: ${errorMessage}`
    logger.error('[RoomAliasManager] Failed to load aliases:', err)
  } finally {
    isLoading.value = false
  }
}

async function addAlias(): Promise<void> {
  const alias = newAliasInput.value.trim()

  if (!alias) {
    message.warning('Please enter an alias')
    return
  }

  if (!isValidAliasFormat(alias)) {
    message.error('Invalid alias format. Use format: #roomname:server.com (e.g., #my-room:cjystx.top)')
    return
  }

  if (aliases.value.includes(alias)) {
    message.warning('This alias already exists for this room')
    return
  }

  isValidating.value = true
  const validationErrorKey = `validation_${Date.now()}`
  validationErrors.value.set(validationErrorKey, '')

  try {
    const isAvailable = await checkAliasAvailability(alias)
    if (!isAvailable) {
      message.error('This alias is already in use by another room')
      isValidating.value = false
      return
    }

    isAdding.value = true

    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    // Create alias using SDK
    const createAliasMethod = (
      client as unknown as {
        createAlias?: (alias: string, roomId: string) => Promise<void>
      }
    ).createAlias

    if (!createAliasMethod) {
      throw new Error('createAlias method not available on client')
    }

    await createAliasMethod.call(client, alias, props.roomId)

    aliases.value = [...aliases.value, alias].sort()
    newAliasInput.value = ''

    message.success(`Alias "${alias}" added successfully`)
    emit('aliasesChanged', aliases.value)

    logger.info('[RoomAliasManager] Alias added:', { alias, roomId: props.roomId })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    message.error(`Failed to add alias: ${errorMessage}`)
    logger.error('[RoomAliasManager] Failed to add alias:', err)
  } finally {
    isAdding.value = false
    isValidating.value = false
    validationErrors.value.delete(validationErrorKey)
  }
}

async function deleteAlias(alias: string): Promise<void> {
  isDeleting.value.add(alias)

  try {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    // Delete alias using SDK
    const deleteAliasMethod = (
      client as unknown as {
        deleteAlias?: (alias: string) => Promise<void>
      }
    ).deleteAlias

    if (!deleteAliasMethod) {
      throw new Error('deleteAlias method not available on client')
    }

    await deleteAliasMethod.call(client, alias)

    aliases.value = aliases.value.filter((a) => a !== alias)

    if (canonicalAlias.value === alias) {
      canonicalAlias.value = ''
    }

    message.success(`Alias "${alias}" removed`)
    emit('aliasesChanged', aliases.value)

    logger.info('[RoomAliasManager] Alias deleted:', { alias })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    message.error(`Failed to delete alias: ${errorMessage}`)
    logger.error('[RoomAliasManager] Failed to delete alias:', err)
  } finally {
    isDeleting.value.delete(alias)
  }
}

async function setCanonical(alias: string): Promise<void> {
  try {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    // Set canonical alias using SDK
    const setCanonicalAliasMethod = (
      client as unknown as {
        setCanonicalAlias?: (roomId: string, alias: string) => Promise<void>
      }
    ).setCanonicalAlias

    if (!setCanonicalAliasMethod) {
      // Fallback: send state event directly
      const sendStateEventMethod = (
        client as unknown as {
          sendStateEvent?: (roomId: string, eventType: string, content: Record<string, unknown>) => Promise<void>
        }
      ).sendStateEvent

      if (!sendStateEventMethod) {
        throw new Error('No method available to set canonical alias')
      }

      await sendStateEventMethod.call(client, props.roomId, 'm.room.canonical_alias', {
        alias
      })
    } else {
      await setCanonicalAliasMethod.call(client, props.roomId, alias)
    }

    canonicalAlias.value = alias

    message.success(`Main address set to "${alias}"`)
    emit('aliasesChanged', aliases.value)

    logger.info('[RoomAliasManager] Canonical alias set:', { alias, roomId: props.roomId })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    message.error(`Failed to set main address: ${errorMessage}`)
    logger.error('[RoomAliasManager] Failed to set canonical alias:', err)
  }
}

function handleAddKeyPress(): void {
  addAlias()
}

// Lifecycle
onMounted(() => {
  if (props.show) {
    loadAliases()
  }
})

watch(
  () => props.show,
  (newShow) => {
    if (newShow) {
      loadAliases()
    }
  }
)

watch(
  () => props.roomId,
  () => {
    if (props.show) {
      loadAliases()
    }
  }
)
</script>

<template>
  <NModal
    v-model:show="show"
    preset="card"
    title="Room Addresses"
    :style="{ width: '700px' }"
    :mask-closable="false"
    :segmented="{ content: 'soft' }">
    <template #header-extra>
      <NSpace>
        <NTag v-if="canonicalAlias" type="success" size="small">
          {{ canonicalAlias }}
        </NTag>
        <NTag size="small" :bordered="false">
          {{ aliases.length }} {{ aliases.length === 1 ? 'alias' : 'aliases' }}
        </NTag>
      </NSpace>
    </template>

    <!-- Error Alert -->
    <NAlert v-if="hasError" type="error" :title="error" closable @close="error = ''" style="margin-bottom: 16px" />

    <!-- Loading State -->
    <div v-if="isLoading" style="text-align: center; padding: 40px 0">
      <NSpin size="large" />
      <div style="margin-top: 16px; color: #999">Loading room addresses...</div>
    </div>

    <!-- Empty State -->
    <NEmpty v-else-if="aliases.length === 0" description="No addresses set for this room" style="padding: 40px 0">
      <template #extra>
        <small style="color: #999">Add an address to make this room discoverable by its alias</small>
      </template>
    </NEmpty>

    <!-- Aliases List -->
    <template v-else>
      <NDataTable :columns="aliasColumns" :data="aliasData" :bordered="false" :single-line="false" size="small" />

      <div style="margin-top: 16px">
        <NAlert type="info" :bordered="false" style="font-size: 12px">
          The main address (marked with ★) is shown in room directories and invite links.
        </NAlert>
      </div>
    </template>

    <!-- Add New Alias -->
    <template #footer>
      <NSpace vertical style="width: 100%">
        <div style="font-weight: 500; margin-bottom: 8px">Add New Address</div>

        <NSpace style="width: 100%">
          <NInput
            v-model:value="newAliasInput"
            placeholder="#room-name:server.com"
            :disabled="isLoading"
            @keyup.enter="handleAddKeyPress"
            style="flex: 1">
            <template #prefix>
              <span style="color: #999">#</span>
            </template>
          </NInput>

          <NButton
            type="primary"
            :disabled="isLoading || !newAliasInput.trim()"
            :loading="isAdding || isValidating"
            @click="addAlias">
            <template #icon>
              <NIcon><Plus /></NIcon>
            </template>
            Add
          </NButton>
        </NSpace>

        <div style="font-size: 12px; color: #999">
          Format:
          <code>#room-name:server.com</code>
          (e.g., #my-room:cjystx.top)
        </div>

        <NAlert type="warning" :bordered="false" style="font-size: 12px; margin-top: 8px">
          Aliases must follow the Matrix naming convention and only contain lowercase letters, numbers, and special
          characters (-_=./).
        </NAlert>
      </NSpace>
    </template>

    <!-- Actions -->
    <template #action>
      <NSpace justify="end">
        <NButton @click="show = false">Close</NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped>
.alias-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.alias-text {
  font-family: 'SF Mono', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', monospace;
  font-size: 13px;
  background: var(--n-code-color);
  padding: 2px 6px;
  border-radius: 3px;
}
</style>
