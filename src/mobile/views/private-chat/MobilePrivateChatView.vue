<!-- 移动端专属私密聊天视图页面 -->
<template>
  <div class="mobile-private-chat-view">
    <!-- 顶部导航栏 -->
    <div class="top-nav">
      <div class="nav-back" @click="handleBack">
        <svg class="iconpark-icon w-24px h-24px"><use href="#fanhui"></use></svg>
      </div>
      <div class="nav-title">
        <h3>私密聊天</h3>
        <p v-if="currentRoom" class="room-info">
          <n-icon :size="14" color="#18a058"><Lock /></n-icon>
          端到端加密
        </p>
      </div>
      <div class="nav-actions">
        <div class="nav-icon" @click="showChatList = true">
          <n-badge :value="unreadCount" :max="99">
            <svg class="iconpark-icon w-24px h-24px"><use href="#message"></use></svg>
          </n-badge>
        </div>
      </div>
    </div>

    <!-- 会话列表抽屉 -->
    <n-drawer v-model:show="showChatList" placement="left" :width="280">
      <div class="chat-drawer">
        <div class="drawer-header">
          <h4>私密会话</h4>
          <n-button text @click="showCreateDialog = true">
            <n-icon :size="20"><Plus /></n-icon>
          </n-button>
        </div>
        <div class="drawer-content">
          <div
            v-for="room in privateChatRooms"
            :key="room.sessionId"
            class="chat-item"
            :class="{ 'is-active': currentRoomId === room.sessionId }"
            @click="selectRoom(room)"
          >
            <n-avatar :src="room.avatarUrl" :size="40" round>
              <template #fallback>
                <span>{{ room.displayName.charAt(0) }}</span>
              </template>
            </n-avatar>
            <div class="chat-info">
              <div class="chat-name">{{ room.displayName }}</div>
              <div class="chat-meta">
                <span class="chat-time">{{ formatTime(room.lastMessage?.timestamp || 0) }}</span>
                <span v-if="room.ttl" class="chat-ttl">
                  <n-icon :size="12"><Clock /></n-icon>
                  {{ formatTTL(room.ttl) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </n-drawer>

    <!-- 主内容区域 -->
    <div class="main-content">
      <!-- 未选择房间 -->
      <div v-if="!currentRoomId" class="empty-state">
        <n-empty description="选择或创建一个私密聊天开始">
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

      <!-- 聊天界面 -->
      <div v-else class="chat-interface">
        <!-- 聊天头部 -->
        <div class="chat-header">
          <div class="header-info">
            <n-avatar :src="currentRoom?.avatarUrl" :size="36" round />
            <div class="header-text">
              <h4>{{ currentRoom?.displayName }}</h4>
              <div class="header-meta">
                <span class="encryption-badge">
                  <n-icon :size="12" color="#18a058"><Lock /></n-icon>
                  E2EE加密
                </span>
                <span v-if="currentRoom?.ttl" class="ttl-badge">
                  默认{{ formatTTL(currentRoom.ttl) }}自毁
                </span>
              </div>
            </div>
          </div>
          <div class="header-actions">
            <n-dropdown :options="headerMenuOptions" @select="handleHeaderMenuAction">
              <n-button quaternary circle>
                <n-icon :size="20"><DotsVertical /></n-icon>
              </n-button>
            </n-dropdown>
          </div>
        </div>

        <!-- 消息列表 -->
        <div class="messages-container" ref="messagesContainerRef">
          <!-- 加载状态 -->
          <div v-if="isLoadingMessages" class="loading-state">
            <n-spin size="medium" />
          </div>

          <!-- 空状态 -->
          <div v-else-if="messages.length === 0" class="empty-messages">
            <p class="text-(12px #909090)">开始私密对话...</p>
            <p class="text-(11px #b0b0b0) mt-4px">消息将在设定时间后自动销毁</p>
          </div>

          <!-- 消息列表 -->
          <div v-else class="messages-list">
            <div
              v-for="message in messages"
              :key="message.messageId"
              class="message-item"
              :class="{ 'is-self': message.isSelf }"
            >
              <n-avatar
                :src="message.isSelf ? userAvatar : currentRoom?.avatarUrl"
                :size="32"
                round
              />
              <div class="message-content">
                <!-- 自毁消息指示器 -->
                <div v-if="message.destroyAt" class="message-indicator">
                  <MobileSelfDestructIndicator
                    :destroy-at="message.destroyAt"
                    :created-at="message.timestamp"
                    mode="icon"
                    :show-text="true"
                    @destroyed="handleMessageDestroyed(message.messageId)"
                  />
                </div>

                <!-- 加密状态图标 -->
                <div class="encryption-icon">
                  <n-icon :size="12" color="#18a058"><Lock /></n-icon>
                </div>

                <div class="message-bubble">
                  <div class="message-text">{{ message.content }}</div>
                  <div class="message-time">
                    {{ formatMessageTime(message.timestamp) }}
                  </div>
                </div>

                <!-- 消息销毁状态 -->
                <div v-if="message.isDestroyed" class="destroyed-status">
                  <n-icon :size="14"><Trash /></n-icon>
                  <span>已销毁</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 输入区域 -->
        <div class="chat-input-area">
          <!-- 自毁消息设置面板 -->
          <PrivateChatSelfDestructPanel
            v-if="isPrivateChat(currentRoomId)"
            v-model="destructConfig"
            @change="handleDestructConfigChange"
          />

          <!-- 输入框 -->
          <div class="input-row">
            <n-input
              v-model:value="inputMessage"
              type="textarea"
              :autosize="{ minRows: 1, maxRows: 4 }"
              placeholder="输入私密消息..."
              @keydown="handleKeyDown"
            />
            <n-button
              type="primary"
              circle
              :loading="isSending"
              :disabled="!inputMessage.trim()"
              @click="sendMessage"
            >
              <n-icon :size="20"><Send /></n-icon>
            </n-button>
          </div>

          <!-- 当前自毁配置预览 -->
          <div v-if="destructConfig.enabled" class="destruct-preview">
            <n-icon :size="14" color="#f0a020"><AlertTriangle /></n-icon>
            <span>消息将在发送后 {{ formatPreviewTime(destructConfig.time) }} 后销毁</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 创建私密聊天对话框 -->
    <n-modal v-model:show="showCreateDialog" preset="card" title="创建私密聊天" style="width: 90%; max-width: 400px">
      <PrivateChatDialog
        :show="showCreateDialog"
        @update:show="showCreateDialog = $event"
        @chat-created="handleChatCreated"
      />
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
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
import { usePrivateChatStore } from '@/stores/privateChat'
import { useGlobalStore } from '@/stores/global'
import { useUserStore } from '@/stores/user'
import { matrixPrivateChatAdapter } from '@/adapters'
import type { PrivateChatSession, PrivateChatMessage } from '@/adapters/service-adapter'
import PrivateChatDialog from '@/components/rightBox/PrivateChatDialog.vue'
import PrivateChatSelfDestructPanel from '#/components/chat-room/PrivateChatSelfDestructPanel.vue'
import MobileSelfDestructIndicator from '#/components/message/MobileSelfDestructIndicator.vue'

const router = useRouter()
const dialog = useDialog()
const message = useMessage()
const privateChatStore = usePrivateChatStore()
const globalStore = useGlobalStore()
const userStore = useUserStore()

// 状态
const showChatList = ref(false)
const showCreateDialog = ref(false)
const isLoadingMessages = ref(false)
const isSending = ref(false)
const inputMessage = ref('')
const messagesContainerRef = ref<HTMLElement>()

// 自毁配置
const destructConfig = ref({
  enabled: false,
  time: 300 // 默认5分钟
})

// 数据
const privateChatRooms = ref<PrivateChatSession[]>([])
const messages = ref<PrivateChatMessage[]>([])
const currentRoomId = ref<string>()

// 计算属性
const userAvatar = computed(() => userStore.userInfo?.avatar || '')
const currentRoom = computed(() => privateChatRooms.value.find((r) => r.sessionId === currentRoomId.value))
const unreadCount = computed(() => privateChatRooms.value.reduce((sum, r) => sum + (r.unreadCount || 0), 0))

const headerMenuOptions = computed(() => [
  { label: '清空历史', key: 'clear' },
  { type: 'divider', key: 'd1' },
  { label: '退出会话', key: 'leave' }
])

// 方法
const handleBack = () => {
  router.back()
}

const selectRoom = async (room: PrivateChatSession) => {
  currentRoomId.value = room.sessionId
  showChatList.value = false
  await loadMessages(room.sessionId)
}

const loadMessages = async (sessionId: string) => {
  isLoadingMessages.value = true
  try {
    messages.value = await matrixPrivateChatAdapter.getMessages(sessionId, 50)
    await nextTick()
    scrollToBottom()
  } catch (error) {
    message.error('加载消息失败')
  } finally {
    isLoadingMessages.value = false
  }
}

const sendMessage = async () => {
  const content = inputMessage.value.trim()
  if (!content || !currentRoomId.value) return

  isSending.value = true
  try {
    const ttl = destructConfig.value.enabled ? destructConfig.value.time : undefined
    const messageId = await matrixPrivateChatAdapter.sendMessage(currentRoomId.value, content, 'text', ttl)

    // 添加到消息列表
    messages.value.push({
      messageId,
      sessionId: currentRoomId.value,
      senderId: userStore.userInfo.uid,
      content,
      type: 'text',
      timestamp: Date.now(),
      isSelf: true,
      status: 'sent',
      destroyAt: destructConfig.value.enabled ? Date.now() + destructConfig.value.time * 1000 : undefined
    })

    inputMessage.value = ''
    await nextTick()
    scrollToBottom()
  } catch (error) {
    message.error('发送失败')
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
            await matrixPrivateChatAdapter.clearHistory(currentRoomId.value)
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
          if (currentRoomId.value) {
            await matrixPrivateChatAdapter.deleteSession(currentRoomId.value)
            currentRoomId.value = undefined
            messages.value = []
            message.success('已退出会话')
          }
        }
      })
      break
  }
}

const handleChatCreated = async (roomId: string) => {
  showCreateDialog.value = false
  await loadRooms()
  currentRoomId.value = roomId
  await loadMessages(roomId)
}

const handleMessageDestroyed = (messageId: string) => {
  const msg = messages.value.find((m) => m.messageId === messageId)
  if (msg) {
    msg.isDestroyed = true
  }
}

const isPrivateChat = (roomId: string) => {
  return privateChatStore.isPrivateChat(roomId)
}

const loadRooms = async () => {
  try {
    privateChatRooms.value = await matrixPrivateChatAdapter.listSessions()
  } catch (error) {
    message.error('加载会话列表失败')
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
  await loadRooms()

  // 如果有当前房间，自动加载
  const roomId = globalStore.currentSessionRoomId
  if (roomId && isPrivateChat(roomId)) {
    currentRoomId.value = roomId
    await loadMessages(roomId)
  }
})
</script>

<style scoped lang="scss">
.mobile-private-chat-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-color);
}

.top-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--card-color);
  border-bottom: 1px solid var(--divider-color);
  height: 56px;

  .nav-back {
    display: flex;
    align-items: center;
    cursor: pointer;
  }

  .nav-title {
    flex: 1;
    text-align: center;

    h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }

    .room-info {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      margin-top: 2px;
      font-size: 11px;
      color: var(--text-color-3);
    }
  }

  .nav-icon {
    display: flex;
    align-items: center;
    cursor: pointer;
  }
}

.main-content {
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
}

.chat-interface {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--card-color);
  border-bottom: 1px solid var(--divider-color);

  .header-info {
    display: flex;
    align-items: center;
    gap: 12px;

    .header-text {
      h4 {
        margin: 0 0 4px 0;
        font-size: 15px;
        font-weight: 600;
      }

      .header-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 11px;

        .encryption-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          background: rgba(24, 160, 88, 0.1);
          border-radius: 10px;
          color: #18a058;
        }

        .ttl-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          background: rgba(240, 160, 32, 0.1);
          border-radius: 10px;
          color: #f0a020;
        }
      }
    }
  }
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.loading-state,
.empty-messages {
  display: flex;
  flex-direction: column;
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
  gap: 8px;

  &.is-self {
    flex-direction: row-reverse;
  }
}

.message-content {
  max-width: 75%;
  position: relative;

  .message-indicator {
    margin-bottom: 4px;
  }

  .encryption-icon {
    position: absolute;
    top: -8px;
    left: -8px;
    width: 16px;
    height: 16px;
    background: var(--card-color);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .message-bubble {
    padding: 10px 14px;
    border-radius: 16px;
    background: var(--bg-color-secondary);
    position: relative;

    .message-item.is-self & {
      background: var(--primary-color);
      color: white;
      border-bottom-right-radius: 4px;
    }

    &:not(.is-self) & {
      border-bottom-left-radius: 4px;
    }

    .message-text {
      font-size: 14px;
      line-height: 1.5;
      word-break: break-word;
    }

    .message-time {
      font-size: 11px;
      opacity: 0.7;
      margin-top: 4px;
    }
  }

  .destroyed-status {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
    font-size: 12px;
    color: #d03050;
  }
}

.chat-input-area {
  background: var(--card-color);
  border-top: 1px solid var(--divider-color);
}

.input-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 12px 16px;
}

.destruct-preview {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-top: 1px solid var(--divider-color);
  font-size: 12px;
  color: #b45309;
}

// 抽屉样式
.chat-drawer {
  height: 100%;
  display: flex;
  flex-direction: column;

  .drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-bottom: 1px solid var(--divider-color);

    h4 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }
  }

  .drawer-content {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }
}

.chat-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: var(--hover-color);
  }

  &.is-active {
    background: rgba(19, 152, 127, 0.1);
  }

  .chat-info {
    flex: 1;
    min-width: 0;

    .chat-name {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .chat-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      color: var(--text-color-3);

      .chat-ttl {
        display: flex;
        align-items: center;
        gap: 4px;
        color: #f0a020;
      }
    }
  }
}
</style>
