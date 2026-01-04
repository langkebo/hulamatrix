<!--
  Read Receipts Panel

  Shows who has read a specific message using Matrix read receipts.
  Displays avatars, names, and read times for users who have seen the message.

  SDK Integration:
  - room.getReceiptsForEvent(eventId) - Get all receipts for an event
  - room.getMember(userId) - Get member info
  - room.getEventReadBy(event) - Alternative method to get read status
-->
<script setup lang="ts">
import { ref, computed, watch, onMounted, h } from 'vue'
import {
  NCard,
  NButton,
  NSpace,
  NAvatar,
  NTooltip,
  NPopover,
  NText,
  NSpin,
  NEmpty,
  NTag,
  NIcon,
  useMessage,
  NList,
  NListItem,
  NScrollbar
} from 'naive-ui'
import { Eye, Clock, Checks } from '@vicons/tabler'
import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'
import { useI18n } from 'vue-i18n'
import { formatDistanceToNow } from 'date-fns'

interface Props {
  roomId: string
  eventId: string
  show: boolean
  placement?: 'top' | 'bottom' | 'left' | 'right'
}

const props = withDefaults(defineProps<Props>(), {
  placement: 'bottom'
})

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const message = useMessage()
const { t } = useI18n()

// Type definitions
interface ReadReceipt {
  userId: string
  displayName: string
  avatarUrl?: string
  readTime: number
  deviceId?: string
  ts: number
}

// State
const receipts = ref<ReadReceipt[]>([])
const isLoading = ref<boolean>(false)
const error = ref<string>('')

// Computed
const show = computed({
  get: () => props.show,
  set: (value: boolean) => emit('update:show', value)
})

const readCount = computed(() => receipts.value.length)

const recentReaders = computed(() => {
  // Sort by read time, most recent first
  return [...receipts.value].sort((a, b) => b.ts - a.ts).slice(0, 5)
})

const hasError = computed(() => error.value.length > 0)

// Format time relative to now
function formatReadTime(timestamp: number): string {
  try {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true })
  } catch {
    return 'Recently'
  }
}

// Load read receipts for an event
async function loadReadReceipts(): Promise<void> {
  if (!props.roomId || !props.eventId) return

  isLoading.value = true
  error.value = ''

  try {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    const getRoomMethod = (
      client as unknown as {
        getRoom: (roomId: string) => Record<string, unknown> | undefined
      }
    ).getRoom

    const room = getRoomMethod?.(props.roomId)
    if (!room) {
      throw new Error(`Room not found: ${props.roomId}`)
    }

    // Get receipts for the event using SDK method
    const getReceiptsForEventMethod = (
      room as {
        getReceiptsForEvent?: (eventId: string) => Array<Record<string, unknown>>
      }
    ).getReceiptsForEvent

    if (!getReceiptsForEventMethod) {
      logger.warn('[ReadReceiptsPanel] getReceiptsForEvent not available')
      receipts.value = []
      return
    }

    const receiptEvents = getReceiptsForEventMethod.call(room, props.eventId)

    // Process receipts
    const processedReceipts: ReadReceipt[] = []

    for (const receiptEvent of receiptEvents) {
      const receiptData = receiptEvent as unknown as {
        userId: string
        roomId: string
        eventId: string
        data?: { ts?: number }
        content?: { ts?: number }
      }

      const userId = receiptData.userId
      const ts = receiptData.data?.ts || receiptData.content?.ts || Date.now()

      // Get member info
      const roomLike = room as {
        getMember?: (userId: string) => Record<string, unknown> | undefined
      }
      const member = roomLike.getMember?.(userId)
      const memberContent = member?.content as
        | {
            displayname?: string
            avatar_url?: string
          }
        | undefined

      processedReceipts.push({
        userId,
        displayName: memberContent?.displayname || userId.split(':')[0].substring(1),
        avatarUrl: memberContent?.avatar_url,
        readTime: ts,
        ts
      })
    }

    receipts.value = processedReceipts

    logger.info('[ReadReceiptsPanel] Receipts loaded:', {
      eventId: props.eventId,
      count: receipts.value.length
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    error.value = `Failed to load receipts: ${errorMessage}`
    logger.error('[ReadReceiptsPanel] Failed to load receipts:', err)
  } finally {
    isLoading.value = false
  }
}

// Get HTTP URL for avatar MXC URI
function getAvatarUrl(mxcUri?: string): string | undefined {
  if (!mxcUri) return undefined

  try {
    const client = matrixClientService.getClient()
    if (!client) return undefined

    const mxcUrlToHttpMethod = (
      client as unknown as {
        mxcUrlToHttp?: (
          mxcUri: string,
          width?: number,
          height?: number,
          resizeMethod?: string,
          allowDirectLinks?: boolean,
          allowRedirects?: boolean
        ) => string
      }
    ).mxcUrlToHttp

    if (mxcUrlToHttpMethod) {
      return mxcUrlToHttpMethod.call(client, mxcUri, 64, 64, 'scale', true, true)
    }
  } catch (err) {
    logger.warn('[ReadReceiptsPanel] Failed to convert avatar URL:', err)
  }

  return undefined
}

// Render reader item
function renderReader(reader: ReadReceipt) {
  const avatarUrl = getAvatarUrl(reader.avatarUrl)

  return h(
    NListItem,
    {
      style: { padding: '8px 0' }
    },
    {
      prefix: () =>
        h(
          NTooltip,
          {},
          {
            trigger: () =>
              h(NAvatar, {
                size: 36,
                src: avatarUrl,
                fallback: () => reader.displayName.charAt(0).toUpperCase(),
                round: true
              }),
            default: () => reader.displayName
          }
        ),
      default: () =>
        h('div', { class: 'reader-info' }, [
          h('div', { class: 'reader-name' }, reader.displayName),
          h(
            'div',
            { class: 'reader-time' },
            h('span', { style: { display: 'flex', alignItems: 'center', gap: '4px' } }, [
              h(NIcon, { size: 12, color: '#999' }, { default: () => h(Clock) }),
              h('span', formatReadTime(reader.ts))
            ])
          )
        ])
    }
  )
}

// Lifecycle
onMounted(() => {
  if (props.show) {
    loadReadReceipts()
  }
})

watch(
  () => props.show,
  (newShow) => {
    if (newShow) {
      loadReadReceipts()
    }
  }
)

watch(
  () => props.eventId,
  () => {
    if (props.show) {
      loadReadReceipts()
    }
  }
)
</script>

<template>
  <NPopover
    v-model:show="show"
    :placement="placement"
    trigger="click"
    :style="{ maxWidth: '320px' }"
    :show-arrow="true"
  >
    <template #trigger>
      <NButton
        text
        size="tiny"
        :style="{ display: 'inline-flex', alignItems: 'center', gap: '4px' }"
      >
        <template #icon>
          <NIcon :size="16">
            <Eye />
          </NIcon>
        </template>
        <template v-if="readCount > 0">
          <span :style="{ fontSize: '12px' }">{{ readCount }}</span>
        </template>
      </NButton>
    </template>

    <div class="read-receipts-panel">
      <!-- Header -->
      <div class="panel-header">
        <div class="header-title">
          <NIcon :size="18" :style="{ marginRight: '8px' }">
            <Checks />
          </NIcon>
          <span>Read by {{ readCount }} {{ readCount === 1 ? 'person' : 'people' }}</span>
        </div>
      </div>

      <!-- Error Alert -->
      <div v-if="hasError" class="panel-error">
        <NText type="error" depth="3" style="font-size: 12px">
          {{ error }}
        </NText>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="panel-loading">
        <NSpin size="small" />
        <span style="margin-left: 8px; font-size: 12px; color: #999">Loading...</span>
      </div>

      <!-- Empty State -->
      <div v-else-if="receipts.length === 0" class="panel-empty">
        <NEmpty description="Not yet seen by anyone" size="small" />
      </div>

      <!-- Readers List -->
      <NScrollbar v-else style="max-height: 300px">
        <NList :bordered="false" size="small">
          <template v-for="reader in receipts" :key="reader.userId">
            <component :is="renderReader(reader)" />
          </template>
        </NList>
      </NScrollbar>
    </div>
  </NPopover>
</template>

<style scoped>
.read-receipts-panel {
  min-width: 280px;
  max-width: 320px;
}

.panel-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--n-border-color);
  background: var(--n-color-modal);
}

.header-title {
  display: flex;
  align-items: center;
  font-weight: 500;
  font-size: 14px;
}

.panel-error {
  padding: 12px 16px;
  border-bottom: 1px solid var(--n-border-color);
}

.panel-loading {
  padding: 24px;
  text-align: center;
}

.panel-empty {
  padding: 24px 16px;
  text-align: center;
}

.reader-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.reader-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--n-text-color-1);
}

.reader-time {
  font-size: 11px;
  color: var(--n-text-color-3);
}

/* Popover trigger button hover effect */
:deep(.n-button:hover) {
  background: rgba(0, 0, 0, 0.05);
}
</style>
