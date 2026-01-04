<template>
  <div class="matrix-chat-box">
    <!-- Matrix聊天头部 -->
    <MatrixChatHeader
      :room-id="roomId"
      @show-settings="handleShowSettings"
      @show-search="handleShowSearch"
      @show-notifications="handleShowNotifications"
      @show-member-list="handleShowMemberList"
    />

    <!-- 聊天内容区 -->
    <div class="chat-content">
      <div class="flex-1 min-h-0">
        <div v-if="isLoadingSession" class="loading-state">
          <n-spin size="large">
            <template #description>正在加载房间内容...</template>
          </n-spin>
        </div>

        
        <!-- Matrix消息主区域 -->
        <MatrixChatMain
          v-else
          :room-id="roomId"
          :show-sidebar="showSidebar"
          @toggle-sidebar="toggleSidebar"
        />
      </div>

      <!-- 侧边栏 -->
      <MatrixChatSidebar
        v-if="shouldShowSidebar"
        :room-id="roomId"
        :show="showSidebar"
        @close="closeSidebar"
      />
    </div>

    <!-- 输入区域 -->
    <div class="chat-input-container">
      <MatrixMsgInput
        :room-id="roomId"
        :disabled="isInCall"
        @send="handleSendMessage"
      />
    </div>

    <!-- 设置抽屉 -->
    <n-drawer
      v-model:show="showSettingsDrawer"
      :width="400"
      placement="right"
      display-directive="show"
    >
      <n-drawer-content title="房间设置" closable>
        <MatrixRoomSettings :room-id="roomId" />
      </n-drawer-content>
    </n-drawer>

    <!-- 搜索弹窗 -->
    <n-modal
      v-model:show="showSearchModal"
      preset="dialog"
      title="搜索消息"
      style="width: 600px"
    >
      <MatrixSearch :room-id="roomId" />
    </n-modal>

    <!-- 通知历史弹窗 -->
    <n-modal
      v-model:show="showNotificationsModal"
      preset="dialog"
      title="通知历史"
      style="width: 500px"
    >
      <MatrixNotificationHistory />
    </n-modal>

    <!-- 成员列表弹窗 -->
    <n-modal
      v-model:show="showMembersModal"
      preset="dialog"
      :title="`房间成员 (${members.length})`"
      style="width: 500px"
    >
      <div class="member-list">
        <div
          v-for="member in members"
          :key="member.userId"
          class="member-item"
        >
          <n-avatar
            v-bind="member.avatarUrl !== undefined ? { src: member.avatarUrl } : {}"
            round
            :size="32"
          >
            {{ getMemberInitials(member) }}
          </n-avatar>
          <div class="member-info">
            <span class="member-name">{{ member.displayName || member.userId }}</span>
            <span class="member-role">{{ getMemberRole(member) }}</span>
          </div>
          <div class="member-status">
            <n-tag
              :type="member.membership === 'join' ? 'success' : 'default'"
              size="small"
            >
              {{ getMembershipText(member.membership) }}
            </n-tag>
          </div>
        </div>
      </div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { NSpin, NDrawer, NDrawerContent, NModal, NAvatar, NTag, useMessage } from 'naive-ui'
import { matrixRoomManager } from '@/services/matrixRoomManager'
import { matrixCallService } from '@/services/matrixCallService'
import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'
import type { MatrixMember, MatrixMessageContent } from '@/types/matrix'
import { getMatrixMessageText, isMatrixContentObject } from '@/types/matrix'

// Components
import MatrixChatHeader from './MatrixChatHeader.vue'
import MatrixChatMain from './MatrixChatMain.vue'
import MatrixChatSidebar from './MatrixChatSidebar.vue'
import MatrixRoomSettings from './RoomSettings.vue'
import MatrixSearch from './MatrixSearch.vue'
import MatrixNotificationHistory from './NotificationHistory.vue'
import MatrixMsgInput from './MatrixMsgInput.vue'

interface Props {
  roomId: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  messageSent: [roomId: string, content: MatrixMessageContent]
}>()

const message = useMessage()

// State
const isLoadingSession = ref(true)
const showSidebar = ref(false)
const showSettingsDrawer = ref(false)
const showSearchModal = ref(false)
const showNotificationsModal = ref(false)
const showMembersModal = ref(false)
const members = ref<MatrixMember[]>([])

// Computed
const roomId = computed(() => props.roomId)
const shouldShowSidebar = computed(() => {
  // Show sidebar for group chats or when explicitly requested
  return members.value.length > 2 || showSidebar.value
})
const isInCall = computed(() => {
  // Check if there's an active call in this room
  return !!matrixCallService.getActiveCall(roomId.value)
})

// Methods
const loadRoomData = async () => {
  try {
    // Set current session
    if (roomId.value) {
      // globalStore.setCurrentSessionRoomId(roomId.value) // Method doesn't exist, use currentSessionRoomId instead
    }

    // Load room members
    const roomMembers = await matrixRoomManager.getRoomMembers(roomId.value)
    members.value = roomMembers

    // Mark as loaded
    isLoadingSession.value = false

    // Load messages
    // await chatStore.loadRoomMessages(roomId.value) // Method doesn't exist, commented out for now
  } catch (error) {
    message.error('加载房间数据失败')
    isLoadingSession.value = false
  }
}

const toggleSidebar = () => {
  showSidebar.value = !showSidebar.value
}

const closeSidebar = () => {
  showSidebar.value = false
}

const handleShowSettings = () => {
  showSettingsDrawer.value = true
}

const handleShowSearch = () => {
  showSearchModal.value = true
}

const handleShowNotifications = () => {
  showNotificationsModal.value = true
}

const handleShowMemberList = () => {
  showMembersModal.value = true
}

/**
 * 发送消息到 Matrix 房间
 * 使用 Matrix SDK 的 sendEvent 方法发送消息
 * 支持字符串内容（自动转换为 m.text 消息）和对象内容（完整 Matrix 消息格式）
 */
const handleSendMessage = async (content: MatrixMessageContent) => {
  try {
    const client = matrixClientService.getClient()
    if (!client) {
      message.error('Matrix 客户端未初始化')
      return
    }

    // 构建消息事件内容
    let eventContent: Record<string, unknown>

    if (isMatrixContentObject(content)) {
      // 对象格式：使用完整的 Matrix 消息格式
      eventContent = {
        msgtype: content.msgtype || 'm.text',
        body: content.body || getMatrixMessageText(content)
      }

      // 添加格式化内容（如果有）
      if (content.formatted_body) {
        eventContent.formatted_body = content.formatted_body
        eventContent.format = content.format || 'org.matrix.custom.html'
      }

      // 添加媒体 URL（如果有）
      if (content.url) {
        eventContent.url = content.url
      }

      // 添加媒体信息（如果有）
      if (content.info) {
        eventContent.info = content.info
      }

      // 添加回复关系（如果有）
      if (content.relates_to) {
        eventContent['m.relates_to'] = content.relates_to
      }
    } else {
      // 字符串格式：自动转换为 m.text 消息
      eventContent = {
        msgtype: 'm.text',
        body: content
      }
    }

    // 使用 Matrix SDK 发送消息
    const sendEventMethod = client.sendEvent as
      | ((
          roomId: string,
          eventType: string,
          content: Record<string, unknown>
        ) => Promise<{ event_id?: string } | string>)
      | undefined

    if (sendEventMethod) {
      const result = await sendEventMethod(roomId.value, 'm.room.message', eventContent)
      const eventId = typeof result === 'string' ? result : result?.event_id || ''

      logger.info('[MatrixChatBox] Message sent:', {
        roomId: roomId.value,
        eventId,
        msgtype: eventContent.msgtype
      })

      // 触发事件通知父组件
      emit('messageSent', roomId.value, content)
    } else {
      message.error('发送消息功能不可用')
    }
  } catch (error) {
    logger.error('[MatrixChatBox] Failed to send message:', error)
    message.error('发送消息失败：' + (error instanceof Error ? error.message : String(error)))
  }
}

const getMemberInitials = (member: MatrixMember): string => {
  const name = member.displayName || member.userId
  if (!name) return '?'

  const names = name.split(' ')
  if (names.length >= 2) {
    return (names[0]?.[0] || '') + (names[1]?.[0] || '')
  }
  return name.substring(0, 2).toUpperCase()
}

const getMemberRole = (member: MatrixMember): string => {
  const powerLevel = member.powerLevel || 0
  if (powerLevel >= 100) return '房主'
  if (powerLevel >= 50) return '管理员'
  return '成员'
}

const getMembershipText = (membership: string): string => {
  const texts = {
    join: '已加入',
    invite: '已邀请',
    leave: '已离开',
    ban: '已封禁'
  }
  return texts[membership as keyof typeof texts] || membership
}

// Event handlers for real-time updates
const handleRoomUpdate = () => {
  loadRoomData()
}

const handleMemberUpdate = () => {
  loadRoomData()
}

// Watchers
watch(
  () => props.roomId,
  (newRoomId) => {
    if (newRoomId) {
      loadRoomData()
    }
  },
  { immediate: true }
)

// Lifecycle
onMounted(() => {
  // Listen for Matrix events
  window.addEventListener('matrixRoomUpdate', handleRoomUpdate)
  window.addEventListener('matrixMemberUpdate', handleMemberUpdate)
})

onUnmounted(() => {
  window.removeEventListener('matrixRoomUpdate', handleRoomUpdate)
  window.removeEventListener('matrixMemberUpdate', handleMemberUpdate)
})
</script>

<style scoped>
.matrix-chat-box {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--n-color);
}

.chat-content {
  flex: 1;
  display: flex;
  min-height: 0;
  position: relative;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.chat-input-container {
  border-top: 1px solid var(--n-border-color);
  background: var(--n-color);
}

.member-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 60vh;
  overflow-y: auto;
}

.member-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--n-border-color);
}

.member-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.member-name {
  font-weight: 500;
  color: var(--n-text-color-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-role {
  font-size: 12px;
  color: var(--n-text-color-3);
}

.member-status {
  flex-shrink: 0;
}

/* Responsive */
@media (max-width: 768px) {
  .matrix-chat-box {
    padding: 0;
  }
}
</style>