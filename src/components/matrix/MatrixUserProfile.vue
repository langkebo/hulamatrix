<template>
  <n-modal
    :show="visible"
    :mask-closable="true"
    @update:show="handleClose"
  >
    <n-card
      :title="title"
      :bordered="false"
      size="small"
      class="user-profile-card"
    >
      <template #header-extra>
        <n-button quaternary circle @click="handleClose">
          <n-icon :component="X" />
        </n-button>
      </template>

      <n-spin :show="loading">
        <div class="profile-content">
          <!-- User Avatar -->
          <div class="avatar-section">
            <n-avatar :size="100" :src="member?.avatarUrl">
              <template #fallback>
                <n-icon :component="User" :size="50" />
              </template>
            </n-avatar>
            <div class="avatar-actions">
              <n-button
                v-if="!isCurrentUser && canDirectMessage"
                size="small"
                type="primary"
                @click="handleStartDM"
              >
                发消息
              </n-button>
              <n-button
                v-if="!isCurrentUser && canKick"
                size="small"
                type="error"
                ghost
                @click="handleKick"
              >
                移除
              </n-button>
            </div>
          </div>

          <!-- User Info -->
          <n-descriptions :column="1" bordered>
            <n-descriptions-item label="用户ID">
              <n-text code>{{ member?.userId || '' }}</n-text>
            </n-descriptions-item>
            <n-descriptions-item label="显示名称">
              {{ member?.displayName || '未知' }}
            </n-descriptions-item>
            <n-descriptions-item label="权限级别">
              <n-tag :type="getPowerLevelType(member?.powerLevel || 0)">
                {{ getPowerLevelLabel(member?.powerLevel || 0) }}
              </n-tag>
            </n-descriptions-item>
            <n-descriptions-item label="成员状态">
              <n-tag :type="member?.membership === 'join' ? 'success' : 'warning'">
                {{ getMembershipLabel(member?.membership || '') }}
              </n-tag>
            </n-descriptions-item>
            <n-descriptions-item v-if="member?.presence" label="在线状态">
              <n-tag :type="getPresenceType(member.presence)">
                {{ getPresenceLabel(member.presence) }}
              </n-tag>
            </n-descriptions-item>
            <n-descriptions-item v-if="member?.joinedAt" label="加入时间">
              {{ formatTime(member.joinedAt) }}
            </n-descriptions-item>
            <n-descriptions-item v-if="member?.reason" label="原因">
              {{ member.reason }}
            </n-descriptions-item>
          </n-descriptions>

          <!-- Devices -->
          <div v-if="showDevices && devices.length > 0" class="devices-section">
            <n-divider />
            <h4>设备列表</h4>
            <n-list bordered>
              <n-list-item v-for="device in devices" :key="device.deviceId">
                <template #prefix>
                  <n-icon :component="Devices" />
                </template>
                <div class="device-info">
                  <div class="device-name">{{ device.displayName || device.deviceId }}</div>
                  <div class="device-id">{{ device.deviceId }}</div>
                </div>
                <template #suffix>
                  <n-tag
                    :type="device.verified ? 'success' : 'warning'"
                    size="small"
                  >
                    {{ device.verified ? '已验证' : '未验证' }}
                  </n-tag>
                </template>
              </n-list-item>
            </n-list>
          </div>

          <!-- Additional Actions -->
          <div v-if="!isCurrentUser && hasAdminPower" class="actions-section">
            <n-divider />
            <h4>管理操作</h4>
            <n-space>
              <n-button
                v-if="canModifyPower"
                size="small"
                @click="handleModifyPower"
              >
                修改权限
              </n-button>
              <n-button
                v-if="canBan"
                size="small"
                type="error"
                ghost
                @click="handleBan"
              >
                封禁
              </n-button>
            </n-space>
          </div>
        </div>
      </n-spin>

      <template #footer>
        <n-space justify="end">
          <n-button @click="handleClose">关闭</n-button>
        </n-space>
      </template>
    </n-card>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  NModal,
  NCard,
  NButton,
  NAvatar,
  NIcon,
  NSpin,
  NDescriptions,
  NDescriptionsItem,
  NTag,
  NDivider,
  NList,
  NListItem,
  NSpace,
  NText,
  useMessage,
  useDialog
} from 'naive-ui'
import { X, User, Devices } from '@vicons/tabler'
import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'
import type { MatrixMember } from '@/types/matrix'

interface DeviceInfo {
  deviceId: string
  displayName: string
  verified: boolean
  lastSeen?: number
}

interface Props {
  visible: boolean
  member: MatrixMember | null
  roomId?: string
  showDevices?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showDevices: false
})

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'start-dm', userId: string): void
  (e: 'kick', member: MatrixMember): void
  (e: 'ban', member: MatrixMember): void
  (e: 'modify-power', member: MatrixMember): void
}

const emit = defineEmits<Emits>()

const message = useMessage()
const dialog = useDialog()

const loading = ref(false)
const devices = ref<DeviceInfo[]>([])

const currentUserId = computed(() => {
  const client = matrixClientService.getClient()
  if (!client) return ''
  const getUserIdMethod = client.getUserId as (() => string) | undefined
  return getUserIdMethod?.() || ''
})

const isCurrentUser = computed(() => {
  return props.member?.userId === currentUserId.value
})

const title = computed(() => {
  if (isCurrentUser.value) return '我的资料'
  return props.member?.displayName || '用户资料'
})

// Power level calculations
const myPowerLevel = ref(0)

const hasAdminPower = computed(() => {
  return myPowerLevel.value >= 50
})

const canKick = computed(() => {
  if (isCurrentUser.value) return false
  const memberPower = props.member?.powerLevel || 0
  return myPowerLevel.value > memberPower
})

const canBan = computed(() => {
  if (isCurrentUser.value) return false
  const memberPower = props.member?.powerLevel || 0
  return myPowerLevel.value >= memberPower + 50
})

const canModifyPower = computed(() => {
  if (isCurrentUser.value) return false
  const memberPower = props.member?.powerLevel || 0
  return myPowerLevel.value >= memberPower + 10
})

const canDirectMessage = computed(() => {
  return !isCurrentUser.value
})

// Load user devices
const loadUserDevices = async () => {
  if (!props.showDevices || !props.member) return

  loading.value = true
  try {
    const client = matrixClientService.getClient()
    if (!client) {
      logger.warn('[MatrixUserProfile] Matrix client not available')
      return
    }

    const { e2eeService } = await import('@/services/e2eeService')
    const deviceInfos = await e2eeService.getUserDevices(props.member.userId)

    devices.value = deviceInfos.map((d) => ({
      deviceId: d.deviceId,
      displayName: d.displayName || d.deviceId.substring(0, 8),
      verified: d.trustLevel === 'verified' || d.verified === true,
      lastSeen: d.lastSeen
    }))
  } catch (error) {
    logger.error('[MatrixUserProfile] Failed to load user devices:', error)
  } finally {
    loading.value = false
  }
}

// Get my power level
const loadMyPowerLevel = async () => {
  try {
    const client = matrixClientService.getClient()
    if (!client || !props.roomId) return

    const getUserId = client.getUserId as (() => string) | undefined
    const myId = getUserId?.()
    if (!myId) return

    const room = client.getRoom as ((roomId: string) => Record<string, unknown> | null) | undefined
    const r = room?.(props.roomId)
    if (!r) return

    const getJoinedMembers = r.getJoinedMembers as (() => MatrixMember[]) | undefined
    const members = getJoinedMembers?.() || []

    const myMember = members.find((m: MatrixMember) => m.userId === myId)
    myPowerLevel.value = myMember?.powerLevel || 0
  } catch (error) {
    logger.error('[MatrixUserProfile] Failed to load power level:', error)
  }
}

// Helper functions
const getPowerLevelLabel = (level: number): string => {
  if (level >= 100) return '管理员'
  if (level >= 50) return '版主'
  if (level >= 10) return '协助者'
  if (level > 0) return '自定义'
  return '普通成员'
}

const getPowerLevelType = (level: number): 'default' | 'primary' | 'success' | 'warning' | 'error' => {
  if (level >= 100) return 'error'
  if (level >= 50) return 'warning'
  if (level >= 10) return 'primary'
  return 'default'
}

const getMembershipLabel = (membership: string): string => {
  const labels: Record<string, string> = {
    join: '已加入',
    invite: '已邀请',
    ban: '已封禁',
    leave: '已离开',
    knock: '请求加入'
  }
  return labels[membership] || membership
}

const getPresenceLabel = (presence: string): string => {
  const labels: Record<string, string> = {
    online: '在线',
    offline: '离线',
    unavailable: '离开'
  }
  return labels[presence] || presence
}

const getPresenceType = (presence: string): 'default' | 'success' | 'warning' | 'error' => {
  if (presence === 'online') return 'success'
  if (presence === 'offline') return 'default'
  return 'warning'
}

const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString('zh-CN')
}

// Event handlers
const handleClose = () => {
  emit('update:visible', false)
}

const handleStartDM = () => {
  if (props.member) {
    emit('start-dm', props.member.userId)
    handleClose()
  }
}

const handleKick = () => {
  if (props.member) {
    dialog.warning({
      title: '移除成员',
      content: `确定要移除 ${props.member.displayName || props.member.userId} 吗？`,
      positiveText: '确定',
      negativeText: '取消',
      onPositiveClick: () => {
        ;(emit as (e: 'kick', member: MatrixMember) => void)('kick', props.member!)
        handleClose()
      }
    })
  }
}

const handleBan = () => {
  if (props.member) {
    dialog.warning({
      title: '封禁成员',
      content: `确定要封禁 ${props.member.displayName || props.member.userId} 吗？`,
      positiveText: '确定',
      negativeText: '取消',
      onPositiveClick: () => {
        ;(emit as (e: 'ban', member: MatrixMember) => void)('ban', props.member!)
        handleClose()
      }
    })
  }
}

const handleModifyPower = () => {
  if (props.member) {
    ;(emit as (e: 'modify-power', member: MatrixMember) => void)('modify-power', props.member!)
    handleClose()
  }
}

// Watch for visibility changes to load data
watch(
  () => props.visible,
  async (visible) => {
    if (visible) {
      await loadMyPowerLevel()
      await loadUserDevices()
    }
  }
)
</script>

<style scoped>
.user-profile-card {
  max-width: 500px;
}

.profile-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 16px 0;
}

.avatar-actions {
  display: flex;
  gap: 8px;
}

.device-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.device-name {
  font-weight: 500;
  font-size: 14px;
}

.device-id {
  font-size: 12px;
  opacity: 0.7;
}

.devices-section,
.actions-section {
  margin-top: 8px;
}

.devices-section h4,
.actions-section h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 500;
}
</style>
