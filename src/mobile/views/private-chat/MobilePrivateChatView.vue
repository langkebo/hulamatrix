<template>
  <div class="mobile-private-chat-view">
    <!-- Header -->
    <div class="chat-header">
      <div class="header-left">
        <n-button circle size="small" @click="handleBack">
          <template #icon>
            <n-icon><Lock /></n-icon>
          </template>
        </n-button>
      </div>
      <div class="header-title">
        <span v-if="currentRoom">{{ getParticipantId(currentRoom) }}</span>
        <span v-else>私密聊天</span>
      </div>
      <div class="header-right">
        <n-button circle size="small" @click="showChatList = true">
          <template #icon>
            <n-badge :value="unreadCount" :max="99">
              <n-icon><Lock /></n-icon>
            </n-badge>
          </template>
        </n-button>
        <n-dropdown v-if="currentRoomId" :options="headerMenuOptions" @select="handleHeaderMenuAction">
          <n-button circle size="small" quaternary>
            <template #icon>
              <n-icon><DotsVertical /></n-icon>
            </template>
          </n-button>
        </n-dropdown>
        <n-button v-else circle size="small" type="primary" @click="showCreateDialog = true">
          <template #icon>
            <n-icon><Plus /></n-icon>
          </template>
        </n-button>
      </div>
    </div>

    <!-- Chat Area -->
    <div class="chat-area">
      <!-- Empty State -->
      <div v-if="!currentRoomId" class="empty-state">
        <n-empty description="选择一个会话开始聊天">
          <template #extra>
            <n-button type="primary" @click="showCreateDialog = true">
              <template #icon>
                <n-icon><Plus /></n-icon>
              </template>
              创建私密聊天
            </n-button>
          </template>
        </n-empty>
      </div>

      <!-- Messages -->
      <template v-else>
        <div ref="messagesContainerRef" class="messages-container">
          <!-- Loading -->
          <div v-if="isLoadingMessages" class="loading-state">
            <n-spin size="medium" />
          </div>

          <!-- Empty Messages -->
          <div v-else-if="messages.length === 0" class="empty-messages">
            <n-empty description="开始第一条消息吧" size="small" />
          </div>

          <!-- Messages List -->
          <div v-else class="messages-list">
            <div v-for="msg in messages" :key="msg.message_id" class="message-item" :class="{ 'is-self': msg.is_own }">
              <div class="message-content">
                <div v-if="msg.is_destroyed" class="message-destroyed">
                  <n-icon size="16"><AlertTriangle /></n-icon>
                  <span>消息已自毁</span>
                </div>
                <div v-else class="message-bubble">
                  <div class="message-text">{{ msg.content }}</div>
                  <div class="message-time">{{ formatMessageTime(msg.timestamp || Date.now()) }}</div>
                  <MobileSelfDestructIndicator
                    v-if="msg.destroy_at"
                    :destroy-at="new Date(msg.destroy_at).getTime()"
                    @destroyed="handleMessageDestroyed(msg.message_id)" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Input Area -->
        <div class="input-area">
          <!-- Self-Destruct Config -->
          <div v-if="destructConfig.enabled" class="destruct-config">
            <div class="destruct-info">
              <n-icon size="14"><Clock /></n-icon>
              <span>消息将在 {{ formatPreviewTime(destructConfig.time) }} 后自毁</span>
            </div>
          </div>

          <!-- Input -->
          <div class="input-wrapper">
            <n-button
              text
              size="small"
              @click="showDestructPanel = !showDestructPanel"
              :class="{ 'is-active': destructConfig.enabled }">
              <template #icon>
                <n-icon><Clock /></n-icon>
              </template>
            </n-button>
            <n-input
              v-model:value="inputMessage"
              type="textarea"
              :autosize="{ minRows: 1, maxRows: 4 }"
              placeholder="输入消息..."
              @keydown="handleKeyDown" />
            <n-button type="primary" size="medium" :loading="isSending" @click="sendMessage">
              <template #icon>
                <n-icon><Send /></n-icon>
              </template>
            </n-button>
          </div>
        </div>
      </template>
    </div>

    <!-- Chat List Drawer -->
    <n-drawer v-model:show="showChatList" :width="320" placement="left">
      <div class="chat-list-drawer">
        <div class="drawer-header">
          <h3>私密聊天</h3>
          <n-button circle size="small" type="primary" @click="showCreateDialog = true">
            <template #icon>
              <n-icon><Plus /></n-icon>
            </template>
          </n-button>
        </div>

        <div class="drawer-content">
          <!-- Loading -->
          <div v-if="privateChatStore.loading" class="loading-state">
            <n-spin size="medium" />
          </div>

          <!-- Empty -->
          <n-empty v-else-if="privateChatStore.sessions.length === 0" description="暂无会话" size="small">
            <template #extra>
              <n-button size="small" type="primary" @click="showCreateDialog = true">
                <template #icon>
                  <n-icon><Plus /></n-icon>
                </template>
                创建会话
              </n-button>
            </template>
          </n-empty>

          <!-- Room List -->
          <div v-else class="room-list">
            <div
              v-for="room in privateChatStore.sessions"
              :key="room.session_id"
              class="room-item"
              :class="{ active: currentRoomId === room.session_id }"
              @click="selectRoom(room)">
              <n-avatar round :size="48" :src="room.avatar_url || ''">
                <svg class="size-24px"><use href="#user"></use></svg>
              </n-avatar>
              <div class="room-info">
                <div class="room-name">{{ room.display_name || getParticipantId(room) }}</div>
                <div class="room-preview">
                  {{ room.last_message?.content || '暂无消息' }}
                </div>
              </div>
              <div class="room-meta">
                <div class="room-time">{{ formatTime(room.last_message?.timestamp || Date.now()) }}</div>
                <n-badge v-if="room.unread_count" :value="room.unread_count" :max="99" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </n-drawer>

    <!-- Create Chat Dialog -->
    <PrivateChatDialog
      :show="showCreateDialog"
      @update:show="showCreateDialog = $event"
      @chat-created="handleChatCreated" />

    <!-- Self-Destruct Config Panel -->
    <PrivateChatSelfDestructPanel
      v-if="showDestructPanel"
      :model-value="destructConfig"
      @update:modelValue="handleDestructConfigChange"
      @close="showDestructPanel = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import {
  NDrawer,
  NButton,
  NIcon,
  NAvatar,
  NBadge,
  NEmpty,
  NSpin,
  NInput,
  NDropdown,
  useDialog,
  useMessage
} from 'naive-ui'
import { Lock, Plus, Clock, DotsVertical, Send, AlertTriangle, Trash } from '@vicons/tabler'
import { usePrivateChatStoreV2 } from '@/stores/privateChatV2'
import type { PrivateChatSessionItem, PrivateChatMessageItem } from '@/types/matrix-sdk-v2'
import { useUserStore } from '@/stores/user'
import { useGlobalStore } from '@/stores/global'
import { logger } from '@/utils/logger'
import PrivateChatDialog from '@/components/chat/PrivateChatDialog.vue'
import PrivateChatSelfDestructPanel from '#/components/chat/PrivateChatSelfDestructPanel.vue'
import MobileSelfDestructIndicator from '#/components/message/MobileSelfDestructIndicator.vue'

const router = useRouter()
const dialog = useDialog()
const message = useMessage()
const privateChatStore = usePrivateChatStoreV2()
const globalStore = useGlobalStore()
const userStore = useUserStore()

// 状态
const showChatList = ref(false)
const showCreateDialog = ref(false)
const showDestructPanel = ref(false)
const isLoadingMessages = ref(false)
const isSending = ref(false)
const inputMessage = ref('')
const messagesContainerRef = ref<HTMLElement>()

// 自毁配置
const destructConfig = ref({
  enabled: false,
  time: 300 // 默认5分钟
})

// 本地消息状态（从 Store 获取）
const messages = ref<PrivateChatMessageItem[]>([])
const currentRoomId = ref<string>()

// 计算属性
const userAvatar = computed(() => userStore.userInfo?.avatar || '')
const currentRoom = computed(() => privateChatStore.currentSession)
const unreadCount = computed(() => privateChatStore.totalSessionsCount)

const headerMenuOptions = computed(() => [
  { label: '清空历史', key: 'clear' },
  { type: 'divider', key: 'd1' },
  { label: '退出会话', key: 'leave' }
])

// 工具方法
const getParticipantId = (session?: PrivateChatSessionItem | null): string => {
  if (!session || !session.participant_ids || session.participant_ids.length === 0) {
    return ''
  }
  const myId = userStore.userInfo?.uid
  return session.participant_ids.find((id) => id !== myId) || session.participant_ids[0]
}

// 方法
const handleBack = () => {
  router.back()
}

const selectRoom = async (room: PrivateChatSessionItem) => {
  try {
    currentRoomId.value = room.session_id
    showChatList.value = false
    await privateChatStore.selectSession(room.session_id)
    messages.value = privateChatStore.currentMessages
    await nextTick()
    scrollToBottom()
  } catch (error) {
    message.error('加载消息失败')
    logger.error('[MobilePrivateChatView] Failed to select room:', error)
  }
}

const sendMessage = async () => {
  const content = inputMessage.value.trim()
  if (!content || !currentRoomId.value) return

  isSending.value = true
  try {
    await privateChatStore.sendMessage(content)
    messages.value = privateChatStore.currentMessages
    inputMessage.value = ''
    await nextTick()
    scrollToBottom()
  } catch (error) {
    message.error('发送失败')
    logger.error('[MobilePrivateChatView] Failed to send message:', error)
  } finally {
    isSending.value = false
  }
}

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

const handleDestructConfigChange = (config: { enabled: boolean; time: number }) => {
  destructConfig.value = config
}

const handleHeaderMenuAction = (key: string) => {
  switch (key) {
    case 'clear':
      dialog.warning({
        title: '清空历史',
        content: '确定要清空聊天历史吗？此操作不可撤销。',
        positiveText: '确定',
        negativeText: '取消',
        onPositiveClick: async () => {
          if (currentRoomId.value) {
            // v2 暂未提供清空历史 API，暂时清空本地状态
            await privateChatStore.selectSession(currentRoomId.value)
            messages.value = []
            message.success('历史已清空')
          }
        }
      })
      break
    case 'leave':
      dialog.warning({
        title: '退出会话',
        content: '确定要退出当前私密聊天吗？',
        positiveText: '确定',
        negativeText: '取消',
        onPositiveClick: async () => {
          try {
            if (currentRoomId.value) {
              await privateChatStore.deleteSession(currentRoomId.value)
              currentRoomId.value = undefined
              messages.value = []
              message.success('已退出会话')
            }
          } catch (error) {
            message.error('退出失败')
            logger.error('[MobilePrivateChatView] Failed to leave session:', error)
          }
        }
      })
      break
  }
}

const handleChatCreated = async (sessionId: string) => {
  showCreateDialog.value = false
  await privateChatStore.refreshSessions()
  currentRoomId.value = sessionId
  await privateChatStore.selectSession(sessionId)
  messages.value = privateChatStore.currentMessages
}

const handleMessageDestroyed = (messageId: string) => {
  const msg = messages.value.find((m) => m.message_id === messageId)
  if (msg) {
    msg.is_destroyed = true
  }
}

const scrollToBottom = () => {
  nextTick(() => {
    const container = messagesContainerRef.value
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  })
}

// 格式化时间
const formatTime = (timestamp: number) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

const formatTTL = (seconds: number) => {
  if (seconds < 60) return `${seconds}秒`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`
  return `${Math.floor(seconds / 3600)}小时`
}

const formatMessageTime = (timestamp: number) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

const formatPreviewTime = (seconds: number) => {
  if (seconds < 60) return `${seconds}秒`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`
  return `${Math.floor(seconds / 3600)}小时`
}

// 生命周期
onMounted(async () => {
  try {
    await privateChatStore.initialize()
    await privateChatStore.refreshSessions()
    logger.info('[MobilePrivateChatView] Initialized successfully')
  } catch (error) {
    logger.error('[MobilePrivateChatView] Initialization failed:', error)
    message.error('加载会话列表失败')
  }
})

onUnmounted(() => {
  privateChatStore.dispose()
})

// 导出方法供父组件调用
defineExpose({
  loadRooms: () => privateChatStore.refreshSessions()
})
</script>

<style scoped lang="scss">
.mobile-private-chat-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-color);
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--bg-color);
  border-bottom: 1px solid var(--line-color);

  .header-left,
  .header-right {
    display: flex;
    gap: 8px;
  }

  .header-title {
    flex: 1;
    text-align: center;
    font-weight: 600;
    font-size: 16px;
  }
}

.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.loading-state,
.empty-messages {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message-item {
  display: flex;
  justify-content: flex-start;

  &.is-self {
    justify-content: flex-end;
  }
}

.message-content {
  max-width: 75%;
}

.message-destroyed {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-radius: 12px;
  color: var(--text-color-3);
  font-size: 12px;
}

.message-bubble {
  padding: 10px 14px;
  background: var(--bg-secondary);
  border-radius: 12px;
  position: relative;

  .message-item.is-self & {
    background: var(--hula-primary);
    color: white;
  }
}

.message-text {
  word-break: break-word;
  margin-bottom: 4px;
}

.message-time {
  font-size: 11px;
  opacity: 0.7;
}

.input-area {
  border-top: 1px solid var(--line-color);
  background: var(--bg-color);
}

.destruct-config {
  padding: 8px 16px;
  background: var(--bg-warning);
  border-bottom: 1px solid var(--line-color);
}

.destruct-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-color-3);
}

.input-wrapper {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 12px 16px;
}

.chat-list-drawer {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--line-color);

  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
}

.room-list {
  padding: 8px;
}

.room-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: var(--hover-color);
  }

  &.active {
    background: var(--active-color);
  }
}

.room-info {
  flex: 1;
  min-width: 0;
}

.room-name {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
}

.room-preview {
  font-size: 12px;
  color: var(--text-color-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.room-time {
  font-size: 11px;
  color: var(--text-color-3);
}
</style>
