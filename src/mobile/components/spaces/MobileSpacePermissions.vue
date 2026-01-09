<!-- Mobile Space Permissions - Space permission settings for mobile -->
<template>
  <div class="mobile-space-permissions">
    <!-- Header -->
    <div class="header-section">
      <div class="section-title">权限设置</div>
      <div class="section-desc">管理空间成员的权限和访问控制</div>
    </div>

    <!-- Permission Level Tabs -->
    <div class="tabs-section">
      <van-tabs v-model:active="activeTab" type="card" animated swipeable>
        <van-tab title="默认权限" name="default">
          <DefaultPermissions :power-levels="powerLevels" :loading="loading" @update="handleUpdateDefault" />
        </van-tab>

        <van-tab title="用户权限" name="users">
          <UserPermissions
            :permissions="userPermissions"
            :members="members"
            :loading="loading"
            @update="handleUpdateUser"
            @remove="handleRemoveUser" />
        </van-tab>

        <van-tab title="事件权限" name="events">
          <EventPermissions :power-levels="powerLevels" :loading="loading" @update="handleUpdateEvent" />
        </van-tab>

        <van-tab title="房间权限" name="rooms">
          <RoomPermissions :room-permissions="roomPermissions" :loading="loading" @update="handleUpdateRoom" />
        </van-tab>
      </van-tabs>
    </div>

    <!-- Save Button -->
    <div class="footer-section">
      <van-button type="primary" size="large" block :loading="isSaving" @click="handleSaveAll">保存所有更改</van-button>
    </div>

    <!-- Unsaved Changes Warning -->
    <van-popup
      :show="showUnsavedWarning"
      position="center"
      :style="{ width: '85%', maxWidth: '400px', borderRadius: '12px' }">
      <div class="warning-dialog">
        <div class="warning-header">
          <van-icon name="warning-o" :size="24" color="#f0a020" />
          <span class="warning-title">未保存的更改</span>
        </div>

        <div class="warning-content">
          <p>您有 {{ pendingChanges.length }} 项未保存的更改。</p>
          <van-cell-group inset :border="true">
            <van-cell v-for="change in pendingChanges" :key="change.id" :title="change.description" />
          </van-cell-group>
        </div>

        <div class="warning-actions">
          <van-button @click="discardChanges">放弃更改</van-button>
          <van-button type="primary" @click="showUnsavedWarning = false">继续编辑</van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useMessage, useDialog } from '@/utils/vant-adapter'
import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'
import DefaultPermissions from './permissions/DefaultPermissions.vue'
import UserPermissions from './permissions/UserPermissions.vue'
import EventPermissions from './permissions/EventPermissions.vue'
import RoomPermissions from './permissions/RoomPermissions.vue'

// ==================== Types ====================

interface PowerLevels {
  users_default?: number
  events_default?: number
  state_default?: number
  ban?: number
  kick?: number
  redact?: number
  invite?: number
  users?: Record<string, number>
  events?: Record<string, number>
  notifications?: Record<string, number>
}

interface UserPermission {
  userId: string
  displayName: string
  powerLevel: number
  avatarUrl?: string
}

interface RoomPermission {
  roomId: string
  name: string
  permissionLevel: number
}

interface PendingChange {
  id: string
  type: 'default' | 'user' | 'event' | 'room'
  description: string
  data: Record<string, unknown>
}

interface Props {
  spaceId: string
}

const props = defineProps<Props>()

const emit = defineEmits<(e: 'permissions-updated', permissions: PowerLevels) => void>()

const message = useMessage()
const dialog = useDialog()

// ==================== State ====================

const activeTab = ref('default')
const loading = ref(false)
const isSaving = ref(false)
const showUnsavedWarning = ref(false)

const powerLevels = ref<PowerLevels>({})
const userPermissions = ref<UserPermission[]>([])
const roomPermissions = ref<RoomPermission[]>([])
const members = ref<UserPermission[]>([])

const pendingChanges = ref<PendingChange[]>([])

// ==================== Methods ====================

const loadPermissions = async () => {
  loading.value = true
  try {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    // Get space room
    const clientMethods = client as Record<string, unknown>
    if (typeof clientMethods.getRoom === 'function') {
      const spaceRoom = clientMethods.getRoom(props.spaceId) as Record<string, unknown> | null

      if (spaceRoom && typeof spaceRoom.getStateEvent === 'function') {
        // Get power levels event
        const powerLevelsEvent = await spaceRoom.getStateEvent('m.room.power_levels', '')

        if (powerLevelsEvent) {
          powerLevels.value = powerLevelsEvent as PowerLevels

          // Convert users power levels to UserPermission array
          const users = (powerLevelsEvent as Record<string, unknown>).users || {}
          userPermissions.value = Object.entries(users).map(([userId, level]) => {
            const member = members.value.find((m) => m.userId === userId)
            return {
              userId,
              displayName: member?.displayName || userId,
              powerLevel: level as number,
              avatarUrl: member?.avatarUrl
            }
          })
        }
      }
    }

    logger.info('[MobileSpacePermissions] Loaded permissions:', { spaceId: props.spaceId })
  } catch (error) {
    logger.error('[MobileSpacePermissions] Failed to load permissions:', error)
    message.error('加载权限设置失败')
  } finally {
    loading.value = false
  }
}

const loadMembers = async () => {
  try {
    const client = matrixClientService.getClient()
    if (!client) return

    const clientMethods = client as Record<string, unknown>
    if (typeof clientMethods.getRoom === 'function') {
      const spaceRoom = clientMethods.getRoom(props.spaceId) as Record<string, unknown> | null

      if (spaceRoom && typeof spaceRoom.getJoinedMembers === 'function') {
        const membersData = await spaceRoom.getJoinedMembers()
        if (Array.isArray(membersData)) {
          members.value = membersData.map((m: Record<string, unknown>) => {
            const userData = m.user as Record<string, unknown> | undefined
            return {
              userId: m.userId as string,
              displayName: (userData?.displayName as string) || (m.userId as string),
              powerLevel: 0,
              avatarUrl: userData?.avatarUrl as string | undefined
            }
          })
        }
      }
    }
  } catch (error) {
    logger.error('[MobileSpacePermissions] Failed to load members:', error)
  }
}

const handleUpdateDefault = (key: string, value: number) => {
  const changeId = `default-${key}`
  const existingIndex = pendingChanges.value.findIndex((c) => c.id === changeId)

  if (existingIndex >= 0) {
    pendingChanges.value[existingIndex].data.value = value
  } else {
    pendingChanges.value.push({
      id: changeId,
      type: 'default',
      description: `修改默认 ${key} 权限为 ${value}`,
      data: { key, value }
    })
  }
  // Update local state immediately for preview
  ;(powerLevels.value as Record<string, unknown>)[key] = value
}

const handleUpdateUser = (userId: string, powerLevel: number) => {
  const changeId = `user-${userId}`
  const existingIndex = pendingChanges.value.findIndex((c) => c.id === changeId)

  if (existingIndex >= 0) {
    pendingChanges.value[existingIndex].data.powerLevel = powerLevel
  } else {
    const user = userPermissions.value.find((u) => u.userId === userId)
    pendingChanges.value.push({
      id: changeId,
      type: 'user',
      description: `修改 ${user?.displayName || userId} 权限为 ${powerLevel}`,
      data: { userId, powerLevel }
    })
  }

  // Update local state
  const userIndex = userPermissions.value.findIndex((u) => u.userId === userId)
  if (userIndex >= 0) {
    userPermissions.value[userIndex].powerLevel = powerLevel
  }
}

const handleRemoveUser = (userId: string) => {
  const changeId = `user-remove-${userId}`
  const user = userPermissions.value.find((u) => u.userId === userId)

  pendingChanges.value.push({
    id: changeId,
    type: 'user',
    description: `移除 ${user?.displayName || userId} 的自定义权限`,
    data: { userId, remove: true }
  })

  // Update local state
  if (powerLevels.value.users) {
    delete powerLevels.value.users[userId]
  }
  userPermissions.value = userPermissions.value.filter((u) => u.userId !== userId)
}

const handleUpdateEvent = (eventType: string, value: number) => {
  const changeId = `event-${eventType}`
  const existingIndex = pendingChanges.value.findIndex((c) => c.id === changeId)

  if (existingIndex >= 0) {
    pendingChanges.value[existingIndex].data.value = value
  } else {
    pendingChanges.value.push({
      id: changeId,
      type: 'event',
      description: `修改 ${eventType} 事件权限为 ${value}`,
      data: { eventType, value }
    })
  }

  // Update local state
  if (!powerLevels.value.events) {
    powerLevels.value.events = {}
  }
  powerLevels.value.events[eventType] = value
}

const handleUpdateRoom = (roomId: string, permissionLevel: number) => {
  const changeId = `room-${roomId}`
  const existingIndex = pendingChanges.value.findIndex((c) => c.id === changeId)

  if (existingIndex >= 0) {
    pendingChanges.value[existingIndex].data.permissionLevel = permissionLevel
  } else {
    const room = roomPermissions.value.find((r) => r.roomId === roomId)
    pendingChanges.value.push({
      id: changeId,
      type: 'room',
      description: `修改房间 ${room?.name || roomId} 权限为 ${permissionLevel}`,
      data: { roomId, permissionLevel }
    })
  }

  // Update local state
  const roomIndex = roomPermissions.value.findIndex((r) => r.roomId === roomId)
  if (roomIndex >= 0) {
    roomPermissions.value[roomIndex].permissionLevel = permissionLevel
  }
}

const handleSaveAll = async () => {
  isSaving.value = true
  try {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    const clientMethods = client as Record<string, unknown>

    // Send updated power levels event
    if (typeof clientMethods.sendStateEvent === 'function') {
      await clientMethods.sendStateEvent(props.spaceId, 'm.room.power_levels', powerLevels.value)
    }

    message.success('权限设置已保存')
    pendingChanges.value = []
    emit('permissions-updated', powerLevels.value)
  } catch (error) {
    logger.error('[MobileSpacePermissions] Failed to save permissions:', error)
    message.error('保存权限设置失败')
  } finally {
    isSaving.value = false
  }
}

const discardChanges = () => {
  dialog.warning({
    title: '确认放弃更改',
    content: '所有未保存的更改将被丢弃',
    confirmText: '放弃',
    cancelText: '取消',
    onConfirm: () => {
      pendingChanges.value = []
      showUnsavedWarning.value = false
      loadPermissions()
      message.info('已放弃所有更改')
    }
  })
}

// ==================== Watch ====================

// Warn when leaving with unsaved changes
watch(
  pendingChanges,
  (newChanges) => {
    if (newChanges.length > 0) {
      window.addEventListener('beforeunload', handleBeforeUnload)
    } else {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  },
  { deep: true }
)

const handleBeforeUnload = (e: BeforeUnloadEvent) => {
  if (pendingChanges.value.length > 0) {
    e.preventDefault()
    e.returnValue = ''
  }
}

// ==================== Lifecycle ====================

onMounted(async () => {
  await loadMembers()
  await loadPermissions()
})

// ==================== Expose ====================

defineExpose({
  loadPermissions,
  savePermissions: handleSaveAll,
  hasUnsavedChanges: () => pendingChanges.value.length > 0
})
</script>

<style scoped lang="scss">
.mobile-space-permissions {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding-bottom: 80px; // Space for footer
}

.header-section {
  padding: 16px;

  .section-title {
    font-size: 20px;
    font-weight: 600;
    color: var(--text-color-1);
    margin-bottom: 4px;
  }

  .section-desc {
    font-size: 14px;
    color: var(--text-color-3);
  }
}

.tabs-section {
  flex: 1;
  overflow-y: auto;

  :deep(.van-tabs) {
    height: 100%;
  }

  :deep(.van-tab__panel) {
    height: 100%;
    overflow-y: auto;
  }
}

.footer-section {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 12px 16px;
  background: var(--card-color);
  border-top: 1px solid var(--divider-color);
  z-index: 100;
}

.warning-dialog {
  display: flex;
  flex-direction: column;
  background: var(--card-color, var(--hula-white));
  border-radius: 12px;
  overflow: hidden;
  max-height: 70vh;
}

.warning-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--border-color, #f0f0f0);

  .warning-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-color-1);
  }
}

.warning-content {
  padding: 16px;
  overflow-y: auto;
  max-height: 300px;

  p {
    margin-bottom: 12px;
    color: var(--text-color-2);
  }
}

.warning-actions {
  display: flex;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid var(--border-color, #f0f0f0);
}

// Safe area for mobile
@supports (padding: env(safe-area-inset-bottom)) {
  .footer-section {
    padding-bottom: calc(12px + env(safe-area-inset-bottom));
  }

  .mobile-space-permissions {
    padding-bottom: calc(80px + env(safe-area-inset-bottom));
  }
}
</style>
