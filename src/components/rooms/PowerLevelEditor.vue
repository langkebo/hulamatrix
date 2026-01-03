<!--
  Power Level Editor

  Visual editor for Matrix room power levels using SDK.
  Allows editing user-specific and event-specific permissions.

  SDK Integration:
  - room.currentState.getStateEvents('m.room.power_levels', '') - Get current levels
  - client.sendStateEvent(roomId, 'm.room.power_levels', newLevels) - Save changes
-->
<script setup lang="ts">
import { ref, computed, watch, onMounted, h } from 'vue'
import {
  NCard,
  NButton,
  NSpace,
  NInputNumber,
  NDataTable,
  NSelect,
  NTag,
  NDivider,
  NTooltip,
  NModal,
  NAlert,
  useMessage,
  NSpin
} from 'naive-ui'
import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'
import { useI18n } from 'vue-i18n'

interface Props {
  roomId: string
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false
})

const emit = defineEmits<{
  saved: [powerLevels: PowerLevelConfig]
  cancelled: []
}>()

const message = useMessage()
const { t } = useI18n()

// Type definitions
interface PowerLevelConfig {
  users: Record<string, number>
  users_default: number
  events: Record<string, number>
  events_default: number
  state_default: number
  ban: number
  kick: number
  redact: number
  invite: number
}

interface PowerLevelPreset {
  name: string
  description: string
  levels: Partial<PowerLevelConfig>
}

// Default power level presets
const PRESETS: PowerLevelPreset[] = [
  {
    name: 'Admin',
    description: 'Full admin permissions (level 100)',
    levels: {
      ban: 100,
      kick: 100,
      redact: 100,
      invite: 100,
      users_default: 0,
      events_default: 0,
      state_default: 50
    }
  },
  {
    name: 'Moderator',
    description: 'Moderator permissions (level 50)',
    levels: {
      ban: 50,
      kick: 50,
      redact: 50,
      invite: 50,
      users_default: 0,
      events_default: 0,
      state_default: 50
    }
  },
  {
    name: 'Member',
    description: 'Standard member permissions (level 0)',
    levels: {
      ban: 50,
      kick: 50,
      redact: 50,
      invite: 0,
      users_default: 0,
      events_default: 0,
      state_default: 50
    }
  },
  {
    name: 'Restricted',
    description: 'Restricted permissions (level -10)',
    levels: {
      ban: 50,
      kick: 50,
      redact: 50,
      invite: 50,
      users_default: -10,
      events_default: -10,
      state_default: 50
    }
  }
]

// Common Matrix event types for permissions
const EVENT_TYPES = [
  { label: 'm.room.name', value: 'm.room.name' },
  { label: 'm.room.avatar', value: 'm.room.avatar' },
  { label: 'm.room.topic', value: 'm.room.topic' },
  { label: 'm.room.power_levels', value: 'm.room.power_levels' },
  { label: 'm.room.history_visibility', value: 'm.room.history_visibility' },
  { label: 'm.room.canonical_alias', value: 'm.room.canonical_alias' },
  { label: 'm.room.message', value: 'm.room.message' },
  { label: 'm.sticker', value: 'm.sticker' },
  { label: 'm.room.encrypted', value: 'm.room.encrypted' },
  { label: 'm.reaction', value: 'm.reaction' }
]

// State
const loading = ref(false)
const saving = ref(false)
const showResetConfirm = ref(false)
const originalLevels = ref<PowerLevelConfig | null>(null)
const currentLevels = ref<PowerLevelConfig>({
  users: {},
  users_default: 0,
  events: {},
  events_default: 0,
  state_default: 50,
  ban: 50,
  kick: 50,
  redact: 50,
  invite: 50
})

// Room members list
interface RoomMember {
  userId: string
  displayName: string
  powerLevel: number
}

const roomMembers = ref<RoomMember[]>([])

// Computed
const hasChanges = computed(() => {
  if (!originalLevels.value) return false
  return JSON.stringify(currentLevels.value) !== JSON.stringify(originalLevels.value)
})

const usersTableColumns = computed(() => [
  {
    title: 'User',
    key: 'displayName',
    render(row: RoomMember) {
      return h('div', { class: 'user-cell' }, [
        h('div', { class: 'user-name' }, row.displayName),
        h('div', { class: 'user-id' }, row.userId)
      ])
    }
  },
  {
    title: 'Power Level',
    key: 'powerLevel',
    render(row: RoomMember) {
      const userLevel = currentLevels.value.users[row.userId] ?? currentLevels.value.users_default
      const levelTag = getPowerLevelTag(userLevel)
      return h(NTag, { type: levelTag.type, size: 'small' }, { default: () => userLevel })
    }
  },
  {
    title: 'Actions',
    key: 'actions',
    render(row: RoomMember) {
      if (props.readonly) return null
      return h(NSpace, { size: 'small' }, () => [
        h(NInputNumber, {
          size: 'small',
          value: currentLevels.value.users[row.userId] ?? currentLevels.value.users_default,
          min: -10,
          max: 100,
          onUpdateValue: (value: number | null) => {
            if (value !== null) {
              currentLevels.value.users[row.userId] = value
            }
          }
        }),
        h(
          NButton,
          {
            size: 'small',
            type: 'error',
            onClick: () => resetUserLevel(row.userId)
          },
          { default: () => 'Reset' }
        )
      ])
    }
  }
])

const eventsTableColumns = computed(() => [
  {
    title: 'Event Type',
    key: 'eventType',
    render(row: { label: string; value: string }) {
      return h('code', { class: 'event-type' }, row.label)
    }
  },
  {
    title: 'Required Level',
    key: 'level',
    render(row: { label: string; value: string }) {
      const eventValue = row.value
      const level = currentLevels.value.events[eventValue] ?? currentLevels.value.events_default
      return h(NInputNumber, {
        size: 'small',
        value: level,
        min: -10,
        max: 100,
        disabled: props.readonly,
        onUpdateValue: (newValue: number | null) => {
          if (newValue !== null) {
            currentLevels.value.events[eventValue] = newValue
          }
        }
      })
    }
  }
])

/**
 * Load current power levels from room state
 */
async function loadPowerLevels() {
  loading.value = true

  try {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    const getRoomMethod = client.getRoom as ((roomId: string) => Record<string, unknown> | null) | undefined
    const room = getRoomMethod?.(props.roomId)
    if (!room) {
      throw new Error(`Room not found: ${props.roomId}`)
    }

    logger.info('[PowerLevelEditor] Loading power levels:', { roomId: props.roomId })

    // Get current power levels state event
    const currentState = room.currentState as Record<string, unknown> | undefined
    const getStateEventsMethod = currentState?.getStateEvents as (type: string, key: string) => unknown | undefined
    const powerLevelsEvent = getStateEventsMethod?.('m.room.power_levels', '') as
      | { content?: PowerLevelConfig }
      | undefined

    if (powerLevelsEvent?.content) {
      // Deep clone to avoid mutations
      currentLevels.value = JSON.parse(JSON.stringify(powerLevelsEvent.content))
      originalLevels.value = JSON.parse(JSON.stringify(powerLevelsEvent.content))

      // Ensure all required fields exist
      currentLevels.value.users = currentLevels.value.users || {}
      currentLevels.value.events = currentLevels.value.events || {}
      currentLevels.value.users_default = currentLevelsValueOrDefault(currentLevels.value.users_default, 0)
      currentLevels.value.events_default = currentLevelsValueOrDefault(currentLevels.value.events_default, 0)
      currentLevels.value.state_default = currentLevelsValueOrDefault(currentLevels.value.state_default, 50)
      currentLevels.value.ban = currentLevelsValueOrDefault(currentLevels.value.ban, 50)
      currentLevels.value.kick = currentLevelsValueOrDefault(currentLevels.value.kick, 50)
      currentLevels.value.redact = currentLevelsValueOrDefault(currentLevels.value.redact, 50)
      currentLevels.value.invite = currentLevelsValueOrDefault(currentLevels.value.invite, 50)
    }

    // Load room members
    await loadRoomMembers(client, room)

    logger.info('[PowerLevelEditor] Power levels loaded')
  } catch (error) {
    logger.error('[PowerLevelEditor] Failed to load power levels:', error)
    message.error('Failed to load power levels')
  } finally {
    loading.value = false
  }
}

/**
 * Load room members with their power levels
 */
async function loadRoomMembers(_client: unknown, room: Record<string, unknown>) {
  const getMembersMethod = room.getMembers as (() => Array<Record<string, unknown>>) | undefined
  const members = getMembersMethod?.() || []

  roomMembers.value = members
    .map((member) => {
      const userId = (member.userId as string) || ''
      const displayName = (member.name as string | undefined) || userId?.split(':')[0]?.replace(/^@/, '') || userId
      const powerLevel = (currentLevels.value.users[userId] ?? currentLevels.value.users_default) as number

      return { userId, displayName, powerLevel }
    })
    .sort((a, b) => b.powerLevel - a.powerLevel)
}

/**
 * Save power levels to room state
 */
async function savePowerLevels() {
  saving.value = true

  try {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    logger.info('[PowerLevelEditor] Saving power levels:', { roomId: props.roomId })

    // Send updated state event
    const sendStateEventMethod = client.sendStateEvent as (
      roomId: string,
      eventType: string,
      content: PowerLevelConfig
    ) => Promise<unknown> | undefined

    await sendStateEventMethod?.(props.roomId, 'm.room.power_levels', currentLevels.value)

    originalLevels.value = JSON.parse(JSON.stringify(currentLevels.value))

    logger.info('[PowerLevelEditor] Power levels saved')
    message.success('Power levels saved successfully')

    emit('saved', currentLevels.value)

    // Reload to verify
    await loadPowerLevels()
  } catch (error) {
    logger.error('[PowerLevelEditor] Failed to save power levels:', error)
    message.error('Failed to save power levels')
  } finally {
    saving.value = false
  }
}

/**
 * Apply a preset configuration
 */
function applyPreset(preset: PowerLevelPreset) {
  Object.assign(currentLevels.value, preset.levels)
  message.info(`Applied ${preset.name} preset`)
}

/**
 * Reset all changes
 */
function resetChanges() {
  if (originalLevels.value) {
    currentLevels.value = JSON.parse(JSON.stringify(originalLevels.value))
  }
  showResetConfirm.value = false
}

/**
 * Reset user to default level
 */
function resetUserLevel(userId: string) {
  delete currentLevels.value.users[userId]
}

/**
 * Get power level tag type
 */
function getPowerLevelTag(level: number): { type: 'success' | 'warning' | 'error' | 'default'; label: string } {
  if (level >= 100) return { type: 'error', label: 'Admin' }
  if (level >= 50) return { type: 'warning', label: 'Moderator' }
  if (level >= 10) return { type: 'default', label: 'Trusted' }
  if (level < 0) return { type: 'default', label: 'Restricted' }
  return { type: 'success', label: 'Member' }
}

/**
 * Helper to get value or default
 */
function currentLevelsValueOrDefault(value: unknown, defaultValue: number): number {
  return typeof value === 'number' ? value : defaultValue
}

// Lifecycle
onMounted(() => {
  loadPowerLevels()
})
</script>

<template>
  <div class="power-level-editor">
    <NSpin :show="loading">
      <!-- Header with Presets -->
      <div class="power-level-editor__header">
        <h3>{{ t('matrix.powerLevels.title', 'Power Levels') }}</h3>
        <NSpace v-if="!readonly" :size="8">
          <NButton
            v-for="preset in PRESETS"
            :key="preset.name"
            size="small"
            @click="applyPreset(preset)">
            {{ preset.name }}
          </NButton>
        </NSpace>
      </div>

      <!-- Basic Permissions -->
      <NCard size="small" class="permissions-card">
        <template #header>
          <span>Basic Permissions</span>
        </template>

        <div class="permission-row">
          <label>Ban users</label>
          <NInputNumber
            v-model:value="currentLevels.ban"
            :min="0"
            :max="100"
            :disabled="readonly"
            style="width: 120px" />
        </div>

        <div class="permission-row">
          <label>Kick users</label>
          <NInputNumber
            v-model:value="currentLevels.kick"
            :min="0"
            :max="100"
            :disabled="readonly"
            style="width: 120px" />
        </div>

        <div class="permission-row">
          <label>Redact events</label>
          <NInputNumber
            v-model:value="currentLevels.redact"
            :min="0"
            :max="100"
            :disabled="readonly"
            style="width: 120px" />
        </div>

        <div class="permission-row">
          <label>Invite users</label>
          <NInputNumber
            v-model:value="currentLevels.invite"
            :min="0"
            :max="100"
            :disabled="readonly"
            style="width: 120px" />
        </div>

        <div class="permission-row">
          <label>Default users level</label>
          <NInputNumber
            v-model:value="currentLevels.users_default"
            :min="-10"
            :max="100"
            :disabled="readonly"
            style="width: 120px" />
        </div>

        <div class="permission-row">
          <label>Default events level</label>
          <NInputNumber
            v-model:value="currentLevels.events_default"
            :min="-10"
            :max="100"
            :disabled="readonly"
            style="width: 120px" />
        </div>

        <div class="permission-row">
          <label>State events level</label>
          <NInputNumber
            v-model:value="currentLevels.state_default"
            :min="-10"
            :max="100"
            :disabled="readonly"
            style="width: 120px" />
        </div>
      </NCard>

      <!-- User Power Levels -->
      <NCard size="small" class="users-card">
        <template #header>
          <span>User Power Levels</span>
        </template>

        <n-data-table
          :columns="usersTableColumns"
          :data="roomMembers"
          :bordered="false"
          size="small"
          :max-height="300" />

        <NAlert v-if="roomMembers.length === 0" type="info" style="margin-top: 12px">
          No members in this room
        </NAlert>
      </NCard>

      <!-- Event Power Levels -->
      <NCard size="small" class="events-card">
        <template #header>
          <span>Event Permissions</span>
        </template>

        <n-data-table
          :columns="eventsTableColumns"
          :data="EVENT_TYPES"
          :bordered="false"
          size="small" />
      </NCard>

      <!-- Actions -->
      <div v-if="!readonly" class="power-level-editor__actions">
        <NSpace justify="end">
          <NButton :disabled="!hasChanges" @click="showResetConfirm = true">
            Reset Changes
          </NButton>
          <NButton type="primary" :disabled="!hasChanges" :loading="saving" @click="savePowerLevels">
            Save Changes
          </NButton>
        </NSpace>
      </div>

      <!-- Reset Confirmation Modal -->
      <NModal
        :show="showResetConfirm"
        preset="dialog"
        title="Reset Changes?"
        :content="'Are you sure you want to reset all changes to power levels?'"
        positive-text="Reset"
        negative-text="Cancel"
        @positive-click="resetChanges"
        @update:show="showResetConfirm = false" />
    </NSpin>
  </div>
</template>

<style scoped>
.power-level-editor {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}

.power-level-editor__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.power-level-editor__header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.permissions-card,
.users-card,
.events-card {
  background: #fff;
}

.permission-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.permission-row:last-child {
  border-bottom: none;
}

.permission-row label {
  font-size: 14px;
  color: #666;
  flex: 1;
}

.user-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-name {
  font-weight: 500;
  font-size: 14px;
  color: #333;
}

.user-id {
  font-size: 12px;
  color: #999;
  font-family: monospace;
}

.event-type {
  font-family: monospace;
  font-size: 13px;
  background: var(--hula-gray-100, #f5f5f5);
  padding: 2px 6px;
  border-radius: 4px;
}

.power-level-editor__actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 16px;
  border-top: 1px solid #e0e0e0;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .power-level-editor__header h3 {
    color: #eee;
  }

  .permissions-card,
  .users-card,
  .events-card {
    background: #2a2a2a;
  }

  .permission-row {
    border-bottom-color: #444;
  }

  .permission-row label {
    color: #aaa;
  }

  .user-name {
    color: #eee;
  }

  .user-id {
    color: #666;
  }

  .event-type {
    background: #333;
  }

  .power-level-editor__actions {
    border-top-color: #444;
  }
}
</style>
