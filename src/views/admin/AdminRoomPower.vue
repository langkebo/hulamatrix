<template>
  <n-flex vertical :size="16">
    <!-- Room Selection -->
    <n-flex align="center" :size="8">
      <n-select
        v-model:value="roomId"
        :options="roomOptions"
        placeholder="选择房间"
        style="max-width: 320px"
        filterable
      />
      <n-button @click="loadPower" :loading="loading" type="primary">读取权限</n-button>
      <n-button @click="resetChanges" :disabled="!hasChanges">重置更改</n-button>
    </n-flex>

    <template v-if="roomId && powerLevels">
      <!-- Basic Permission Settings -->
      <n-card title="基础权限配置" size="small">
        <template #header-extra>
          <n-tag v-if="hasChanges" type="warning" size="small">有未保存更改</n-tag>
        </template>
        <n-grid :cols="3" :x-gap="16" :y-gap="12">
          <n-gi>
            <n-form-item label="默认用户权限" label-placement="top" label-style="font-weight: 500">
              <n-input-number
                v-model:value="powerLevels.users_default"
                :min="0"
                :max="100"
                style="width: 100%"
                @update:value="markChanges"
              />
            </n-form-item>
          </n-gi>
          <n-gi>
            <n-form-item label="默认事件权限" label-placement="top" label-style="font-weight: 500">
              <n-input-number
                v-model:value="powerLevels.events_default"
                :min="0"
                :max="100"
                style="width: 100%"
                @update:value="markChanges"
              />
            </n-form-item>
          </n-gi>
          <n-gi>
            <n-form-item label="状态事件权限" label-placement="top" label-style="font-weight: 500">
              <n-input-number
                v-model:value="powerLevels.state_default"
                :min="0"
                :max="100"
                style="width: 100%"
                @update:value="markChanges"
              />
            </n-form-item>
          </n-gi>
          <n-gi>
            <n-form-item label="邀请权限" label-placement="top" label-style="font-weight: 500">
              <n-input-number
                v-model:value="powerLevels.invite"
                :min="0"
                :max="100"
                style="width: 100%"
                @update:value="markChanges"
              />
            </n-form-item>
          </n-gi>
          <n-gi>
            <n-form-item label="踢出权限" label-placement="top" label-style="font-weight: 500">
              <n-input-number
                v-model:value="powerLevels.kick"
                :min="0"
                :max="100"
                style="width: 100%"
                @update:value="markChanges"
              />
            </n-form-item>
          </n-gi>
          <n-gi>
            <n-form-item label="封禁权限" label-placement="top" label-style="font-weight: 500">
              <n-input-number
                v-model:value="powerLevels.ban"
                :min="0"
                :max="100"
                style="width: 100%"
                @update:value="markChanges"
              />
            </n-form-item>
          </n-gi>
          <n-gi>
            <n-form-item label="红色事件权限" label-placement="top" label-style="font-weight: 500">
              <n-input-number
                v-model:value="powerLevels.redact"
                :min="0"
                :max="100"
                style="width: 100%"
                @update:value="markChanges"
              />
            </n-form-item>
          </n-gi>
        </n-grid>
      </n-card>

      <!-- Event-specific Permissions -->
      <n-card title="事件类型权限配置" size="small">
        <template #header-extra>
          <n-tooltip>
            <template #trigger>
              <n-icon size="16">ℹ️</n-icon>
            </template>
            为特定事件类型设置所需权限等级
          </n-tooltip>
        </template>
        <n-data-table
          :columns="eventColumns"
          :data="eventPermissions"
          :max-height="300"
          size="small"
          :bordered="false"
        />
      </n-card>

      <!-- User Permission Management -->
      <n-card title="成员权限管理" size="small">
        <template #header-extra>
          <n-flex :size="8">
            <n-input
              v-model:value="searchQuery"
              placeholder="搜索成员"
              clearable
              style="width: 200px"
            >
              <template #prefix>🔍</template>
            </n-input>
            <n-dropdown trigger="click" :options="bulkPresetOptions" @select="applyBulkPreset">
              <n-button :disabled="selectedUsers.length === 0" size="small">
                批量设置 ({{ selectedUsers.length }})
              </n-button>
            </n-dropdown>
          </n-flex>
        </template>

        <n-data-table
          :columns="userColumns"
          :data="filteredMembers"
          :max-height="400"
          size="small"
          :row-key="(row: MemberPowerItem) => row.userId"
          :checked-row-keys="selectedUsers"
          @update:checked-row-keys="(keys: Array<string | number>) => handleCheck(keys as string[])"
          :bordered="false"
        />
      </n-card>

      <!-- Action Buttons -->
      <n-flex justify="end">
        <n-button @click="savePower" type="primary" :disabled="!hasChanges" size="large">
          保存权限配置
        </n-button>
      </n-flex>
    </template>

    <!-- Permission Info Alert -->
    <n-alert v-if="roomId" type="info" title="权限等级说明">
      <ul style="margin: 8px 0 0 0; padding-left: 20px">
        <li><strong>100</strong> - 管理员 (完全控制)</li>
        <li><strong>50</strong> - 版主 (管理权限)</li>
        <li><strong>0</strong> - 普通用户 (基本权限)</li>
        <li>数值越高，权限越大</li>
      </ul>
    </n-alert>
  </n-flex>
</template>

<script setup lang="ts">
import { ref, reactive, computed, h, onMounted } from 'vue'
import { useChatStore } from '@/stores/chat'
import { getPowerLevels, setPowerLevels } from '@/integrations/matrix/powerLevels'
import { listJoinedMembers } from '@/integrations/matrix/members'
import type { SessionItem } from '@/services/types'
import type { PowerLevelsContent, PowerLevelPreset, PowerLevelPresetConfig, EventPermissionItem } from '@/types/admin'
import { NIcon } from 'naive-ui'
import { msg } from '@/utils/SafeUI'

const chat = useChatStore()

// Type definitions
interface MemberPowerItem {
  userId: string
  name?: string
  displayName?: string
  avatarUrl?: string
  powerLevel: number
  role: string
  avatar?: string
}

// Power level presets
const POWER_PRESETS: Record<PowerLevelPreset, PowerLevelPresetConfig> = {
  admin: { name: '管理员', description: '完全控制房间', level: 100, color: '#f56c6c' },
  moderator: { name: '版主', description: '管理房间成员和内容', level: 50, color: '#e6a23c' },
  user: { name: '普通用户', description: '基本权限', level: 0, color: '#67c23a' },
  restricted: { name: '受限用户', description: '受限权限', level: 10, color: '#909399' },
  custom: { name: '自定义', description: '自定义权限等级', level: -1, color: '#409eff' }
}

// Common Matrix event permissions
const EVENT_PERMISSIONS: EventPermissionItem[] = [
  { event: 'm.room.message', name: '发送消息', description: '发送消息事件', defaultLevel: 0 },
  { event: 'm.room.topic', name: '修改主题', description: '修改房间主题', defaultLevel: 50 },
  { event: 'm.room.name', name: '修改名称', description: '修改房间名称', defaultLevel: 50 },
  { event: 'm.room.avatar', name: '修改头像', description: '修改房间头像', defaultLevel: 50 },
  { event: 'm.room.power_levels', name: '修改权限', description: '修改权限等级', defaultLevel: 100 },
  { event: 'm.room.history_visibility', name: '历史可见性', description: '修改历史可见性', defaultLevel: 100 },
  { event: 'm.room.canonical_alias', name: '房间别名', description: '修改房间别名', defaultLevel: 50 },
  { event: 'm.room.encryption', name: '加密设置', description: '修改加密设置', defaultLevel: 100 },
  { event: 'm.room.join_rules', name: '加入规则', description: '修改加入规则', defaultLevel: 50 },
  { event: 'm.room_guest_access', name: '访客访问', description: '修改访客访问权限', defaultLevel: 50 },
  { event: 'm.room.redaction', name: '红色事件', description: '删除消息', defaultLevel: 50 }
]

// State
const roomId = ref<string | null>(null)
const loading = ref(false)
const hasChanges = ref(false)
const searchQuery = ref('')
const selectedUsers = ref<string[]>([])
const originalPowerLevels = ref<PowerLevelsContent | null>(null)

const powerLevels = reactive<PowerLevelsContent>({
  users_default: 0,
  events_default: 0,
  state_default: 50,
  invite: 50,
  kick: 50,
  ban: 50,
  redact: 50,
  users: {},
  events: {}
})

const members = ref<MemberPowerItem[]>([])

// Computed
const roomOptions = computed(() =>
  chat.sessionList.map((s: SessionItem) => ({
    label: `${s.name || s.roomId} (${s.roomId.slice(0, 8)}...)`,
    value: s.roomId
  }))
)

const eventPermissions = computed(() =>
  EVENT_PERMISSIONS.map((item) => ({
    ...item,
    level:
      (powerLevels.events?.[item.event] as number | undefined) ??
      (powerLevels.events_default as number | undefined) ??
      item.defaultLevel
  }))
)

const filteredMembers = computed(() => {
  if (!searchQuery.value) return members.value
  const query = searchQuery.value.toLowerCase()
  return members.value.filter(
    (m) => m.userId.toLowerCase().includes(query) || (m.name || '').toLowerCase().includes(query)
  )
})

const bulkPresetOptions = computed(() =>
  Object.entries(POWER_PRESETS)
    .filter(([key]) => key !== 'custom')
    .map(([key, preset]) => ({
      key,
      label: preset.name,
      disabled: false
    }))
)

// Table columns
const eventColumns = computed(() => [
  {
    title: '事件类型',
    key: 'event',
    width: 200,
    ellipsis: { tooltip: true }
  },
  {
    title: '事件名称',
    key: 'name',
    width: 120
  },
  {
    title: '所需权限等级',
    key: 'level',
    width: 150,
    render: (row: EventPermissionItem & { level: number }) =>
      h('input', {
        type: 'number',
        min: 0,
        max: 100,
        value: row.level,
        class: 'n-input',
        style: 'width: 80px; padding: 4px 8px; border: 1px solid #dcdee2; border-radius: 3px;',
        onChange: (e: Event) => {
          const target = e.target as HTMLInputElement
          const value = parseInt(target.value, 10) || 0
          if (!powerLevels.events) powerLevels.events = {}
          powerLevels.events[row.event] = value
          markChanges()
        }
      })
  },
  {
    title: '说明',
    key: 'description',
    ellipsis: { tooltip: true }
  }
])

const userColumns = computed(() => [
  {
    type: 'selection' as const
  },
  {
    title: '成员',
    key: 'name',
    width: 200,
    render: (row: MemberPowerItem) =>
      h('div', { class: 'flex items-center gap-8px' }, [
        h('div', { class: 'flex-1' }, [
          h('div', { class: 'font-weight-500' }, row.name || row.userId),
          h('div', { class: 'text-12px text-#999' }, row.userId)
        ])
      ])
  },
  {
    title: '当前权限',
    key: 'powerLevel',
    width: 120,
    render: (row: MemberPowerItem) =>
      h(
        'span',
        {
          class: 'n-tag',
          style: `background: ${getPresetByLevel(row.powerLevel).color}; color: white; padding: 2px 8px; border-radius: 3px; font-size: 12px;`
        },
        `${row.powerLevel} - ${getPresetByLevel(row.powerLevel).name}`
      )
  },
  {
    title: '权限等级',
    key: 'level',
    width: 150,
    render: (row: MemberPowerItem) =>
      h('input', {
        type: 'number',
        min: 0,
        max: 100,
        value: row.powerLevel,
        class: 'n-input',
        style: 'width: 80px; padding: 4px 8px; border: 1px solid #dcdee2; border-radius: 3px;',
        onChange: (e: Event) => {
          const target = e.target as HTMLInputElement
          const value = parseInt(target.value, 10) || 0
          updateUserPowerLevel(row.userId, value)
        }
      })
  },
  {
    title: '操作',
    key: 'actions',
    width: 180,
    render: (row: MemberPowerItem) =>
      h('div', { class: 'flex items-center gap-8px' }, [
        h(
          'button',
          {
            class: 'n-button n-button--tiny',
            onClick: () => applyPreset(row.userId, 'admin')
          },
          '管理员'
        ),
        h(
          'button',
          {
            class: 'n-button n-button--tiny',
            onClick: () => applyPreset(row.userId, 'moderator')
          },
          '版主'
        ),
        h(
          'button',
          {
            class: 'n-button n-button--tiny',
            onClick: () => applyPreset(row.userId, 'user')
          },
          '用户'
        )
      ])
  }
])

// Helper functions
function getPresetByLevel(level: number): PowerLevelPresetConfig {
  if (level >= 100) return POWER_PRESETS.admin
  if (level >= 50) return POWER_PRESETS.moderator
  if (level > 0) return POWER_PRESETS.restricted
  return POWER_PRESETS.user
}

function markChanges() {
  hasChanges.value = true
}

function resetChanges() {
  if (!originalPowerLevels.value) return
  Object.assign(powerLevels, JSON.parse(JSON.stringify(originalPowerLevels.value)))
  hasChanges.value = false
  msg.info?.('已重置更改')
}

async function loadPower() {
  if (!roomId.value) return
  loading.value = true
  try {
    const content = await getPowerLevels(roomId.value)
    originalPowerLevels.value = JSON.parse(JSON.stringify(content))

    // Update power levels reactive object
    Object.assign(powerLevels, {
      users_default: (content.users_default as number | undefined) ?? 0,
      events_default: (content.events_default as number | undefined) ?? 0,
      state_default: (content.state_default as number | undefined) ?? 50,
      invite: (content.invite as number | undefined) ?? 50,
      kick: (content.kick as number | undefined) ?? 50,
      ban: (content.ban as number | undefined) ?? 50,
      redact: (content.redact as number | undefined) ?? 50,
      users: (content.users as Record<string, number> | undefined) || {},
      events: (content.events as Record<string, number> | undefined) || {}
    })

    // Load members
    const memberList = await listJoinedMembers(roomId.value)
    const users = powerLevels.users || {}

    members.value = memberList.map((m) => ({
      userId: m.userId,
      name: m.name || (m as MemberPowerItem).displayName,
      displayName: (m as MemberPowerItem).displayName,
      avatarUrl: (m as MemberPowerItem).avatarUrl,
      powerLevel: users[m.userId] ?? powerLevels.users_default ?? 0,
      role: getPresetByLevel(users[m.userId] ?? powerLevels.users_default ?? 0).name,
      avatar: (m as MemberPowerItem).avatarUrl
    }))

    hasChanges.value = false
  } finally {
    loading.value = false
  }
}

async function savePower() {
  if (!roomId.value) return
  loading.value = true
  try {
    const content: PowerLevelsContent = {
      users_default: powerLevels.users_default,
      events_default: powerLevels.events_default,
      state_default: powerLevels.state_default,
      invite: powerLevels.invite,
      kick: powerLevels.kick,
      ban: powerLevels.ban,
      redact: powerLevels.redact,
      users: powerLevels.users,
      events: powerLevels.events
    }

    // Sync user power levels from members list
    const memberUsers = members.value.reduce(
      (acc, m) => {
        acc[m.userId] = m.powerLevel
        return acc
      },
      {} as Record<string, number>
    )

    content.users = memberUsers

    await setPowerLevels(roomId.value, content)
    originalPowerLevels.value = JSON.parse(JSON.stringify(content))
    hasChanges.value = false
    msg.success?.('权限已保存')
  } finally {
    loading.value = false
  }
}

function updateUserPowerLevel(userId: string, level: number) {
  const member = members.value.find((m) => m.userId === userId)
  if (member) {
    member.powerLevel = level
    member.role = getPresetByLevel(level).name
  }
  if (!powerLevels.users) powerLevels.users = {}
  powerLevels.users[userId] = level
  markChanges()
}

async function applyPreset(userId: string, preset: PowerLevelPreset) {
  const level = POWER_PRESETS[preset].level
  updateUserPowerLevel(userId, level)
  msg.success?.(`已将用户设置为 ${POWER_PRESETS[preset].name}`)
}

async function applyBulkPreset(preset: string | number) {
  const presetKey = preset as PowerLevelPreset
  const level = POWER_PRESETS[presetKey].level

  selectedUsers.value.forEach((userId) => {
    updateUserPowerLevel(userId, level)
  })

  selectedUsers.value = []
  msg.success?.(`已批量设置为 ${POWER_PRESETS[presetKey].name}`)
}

function handleCheck(keys: string[]) {
  selectedUsers.value = keys
}

// Initialize on mount
onMounted(() => {
  if (chat.sessionList.length > 0 && !roomId.value) {
    roomId.value = chat.sessionList[0].roomId
  }
})
</script>

<style scoped>
:deep(.n-form-item) {
  margin-bottom: 0;
}

:deep(.n-input-number) {
  width: 100%;
}
</style>
