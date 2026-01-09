<template>
  <div class="private-chat-container" :class="{ 'is-mobile': isMobile }">
    <!-- 移动端：会话列表视图 -->
    <template v-if="isMobile">
      <!-- 会话列表视图 -->
      <div v-if="!showMobileChat" class="mobile-sessions-view">
        <div class="mobile-header">
          <h3>{{ t('privateChat.title') }}</h3>
          <n-button circle size="small" @click="showNewChatDialog = true">
            <template #icon>
              <svg class="size-16px"><use href="#edit"></use></svg>
            </template>
          </n-button>
        </div>

        <!-- 会话列表 -->
        <div class="mobile-sessions-list">
          <!-- 加载状态 -->
          <div v-if="privateChatStore.loading" class="loading-state">
            <n-spin size="medium" />
          </div>

          <!-- 空状态 -->
          <n-empty
            v-else-if="privateChatStore.sessions.length === 0"
            :description="t('privateChat.sessions.no_sessions')"
            size="small">
            <template #extra>
              <n-button size="small" type="primary" secondary @click="showNewChatDialog = true">
                {{ t('privateChat.sessions.start_chat') }}
              </n-button>
            </template>
          </n-empty>

          <!-- 会话列表项 -->
          <div
            v-for="session in privateChatStore.sessions"
            :key="session.session_id"
            class="mobile-session-item"
            @click="handleMobileSelectSession(session)">
            <div class="session-avatar">
              <n-avatar round :size="56" :src="session.avatar_url || ''">
                <svg class="size-28px"><use href="#user"></use></svg>
              </n-avatar>
              <n-badge
                v-if="session.unread_count && session.unread_count > 0"
                :value="session.unread_count"
                :max="99"
                :offset="[-4, 4]" />
            </div>
            <div class="session-content">
              <div class="session-header-row">
                <span class="session-name">{{ session.display_name || getParticipantId(session) }}</span>
                <span class="session-time">{{ formatTime(session.last_message?.timestamp) }}</span>
              </div>
              <div class="session-preview">
                {{ session.last_message?.content || t('privateChat.sessions.no_messages') }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 移动端：聊天视图 -->
      <div v-else class="mobile-chat-view">
        <header class="mobile-chat-header">
          <n-button circle size="small" quaternary @click="handleMobileBack">
            <svg class="size-20px"><use href="#back"></use></svg>
          </n-button>
          <div class="header-info">
            <span class="chat-name">{{ currentSession?.display_name || getParticipantId(currentSession) }}</span>
            <span class="chat-status">{{ getPresenceText(currentPresence) }}</span>
          </div>
          <n-dropdown :options="chatMenuOptions" @select="handleChatMenuAction">
            <n-button circle size="small" quaternary>
              <svg class="size-18px"><use href="#more"></use></svg>
            </n-button>
          </n-dropdown>
        </header>

        <!-- 消息列表 -->
        <div class="mobile-messages-container" ref="messagesContainerRef">
          <!-- 加载状态 -->
          <div v-if="isLoadingMessages" class="loading-messages">
            <n-spin size="medium">{{ t('privateChat.chat.loading_messages') }}</n-spin>
          </div>

          <!-- 空状态 -->
          <div v-else-if="privateChatStore.currentMessages.length === 0" class="empty-messages">
            <span class="empty-text">{{ t('privateChat.chat.empty_state') }}</span>
          </div>

          <!-- 消息列表 -->
          <div v-else class="mobile-messages-list">
            <div
              v-for="message in privateChatStore.currentMessages"
              :key="message.message_id"
              class="mobile-message-item"
              :class="{ 'is-self': message.is_own }">
              <div class="message-content">
                <div class="message-bubble">
                  <span class="message-text">{{ message.content }}</span>
                  <span class="message-time">{{ formatTime(message.timestamp) }}</span>
                </div>
                <div class="message-status">
                  <span v-if="message.is_destroyed" class="destroyed-badge">
                    {{ t('privateChat.message.destroyed') }}
                  </span>
                  <span v-else-if="message.is_own && message.status" class="status-text">
                    {{ getStatusText(message.status) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 输入区域 -->
        <footer class="mobile-chat-input">
          <!-- 消息自毁设置 -->
          <n-collapse v-if="showMessageTTL" class="ttl-collapse">
            <n-collapse-item :title="t('privateChat.ttl.title')" name="ttl">
              <n-space :space="8" vertical>
                <n-radio-group v-model:value="selectedTTL" @update:value="handleTTLChange">
                  <n-radio-button value="0">{{ t('privateChat.ttl.no_destroy') }}</n-radio-button>
                  <n-radio-button value="30">30s</n-radio-button>
                  <n-radio-button value="60">1m</n-radio-button>
                  <n-radio-button value="300">5m</n-radio-button>
                  <n-radio-button value="3600">1h</n-radio-button>
                </n-radio-group>
              </n-space>
            </n-collapse-item>
          </n-collapse>

          <!-- 输入框 -->
          <div class="input-row">
            <n-button
              text
              size="medium"
              @click="showMessageTTL = !showMessageTTL"
              :class="{ 'is-active': showMessageTTL }">
              <svg class="size-22px">
                <use :href="showMessageTTL ? '#clock-off' : '#clock'"></use>
              </svg>
            </n-button>
            <n-input
              ref="messageInputRef"
              v-model:value="inputMessage"
              type="textarea"
              :autosize="{ minRows: 1, maxRows: 4 }"
              :placeholder="t('privateChat.input.placeholder')"
              @keydown="handleInputKeyDown" />
            <n-button type="primary" size="medium" @click="handleSendMessage" :loading="isSending">
              {{ t('privateChat.input.send') }}
            </n-button>
          </div>
        </footer>
      </div>
    </template>

    <!-- PC端：两栏布局 -->
    <template v-else>
      <!-- 会话列表侧边栏 -->
      <aside class="sessions-sidebar">
        <div class="sidebar-header">
          <h3>{{ t('privateChat.title') }}</h3>
          <n-button circle size="small" @click="showNewChatDialog = true">
            <template #icon>
              <svg class="size-16px"><use href="#edit"></use></svg>
            </template>
          </n-button>
        </div>

        <!-- 会话列表 -->
        <div class="sessions-list">
          <!-- 加载状态 -->
          <div v-if="privateChatStore.loading" class="loading-state">
            <n-spin size="medium" />
          </div>

          <!-- 空状态 -->
          <n-empty
            v-else-if="privateChatStore.sessions.length === 0"
            :description="t('privateChat.sessions.no_sessions')"
            size="small">
            <template #extra>
              <n-button size="small" type="primary" secondary @click="showNewChatDialog = true">
                {{ t('privateChat.sessions.start_chat') }}
              </n-button>
            </template>
          </n-empty>

          <!-- 会话列表 -->
          <div
            v-for="session in privateChatStore.sessions"
            :key="session.session_id"
            class="session-item"
            :class="{ 'is-active': privateChatStore.currentSessionId === session.session_id }"
            @click="handleSelectSession(session)">
            <div class="session-avatar">
              <n-avatar round :size="48" :src="session.avatar_url || ''">
                <svg class="size-24px"><use href="#user"></use></svg>
              </n-avatar>
            </div>
            <div class="session-content">
              <div class="session-header-row">
                <span class="session-name">{{ session.display_name || getParticipantId(session) }}</span>
                <n-badge
                  v-if="session.unread_count && session.unread_count > 0"
                  :value="session.unread_count"
                  :max="99" />
              </div>
              <div class="session-preview">
                {{ session.last_message?.content || t('privateChat.sessions.no_sessions') }}
              </div>
              <div class="session-time">
                {{ formatTime(session.last_message?.timestamp) }}
              </div>
            </div>
          </div>
        </div>
      </aside>

      <!-- 聊天区域 -->
      <main class="chat-area">
        <!-- 未选择会话 -->
        <div v-if="!privateChatStore.currentSessionId" class="empty-state">
          <n-empty :description="t('privateChat.sessions.select_session')" size="large">
            <template #extra>
              <n-button size="medium" type="primary" @click="showNewChatDialog = true">
                {{ t('privateChat.sessions.new_chat') }}
              </n-button>
            </template>
          </n-empty>
        </div>

        <!-- 聊天内容 -->
        <template v-else>
          <!-- 聊天头部 -->
          <header class="chat-header">
            <n-flex align="center" :space="12">
              <n-avatar round :size="40" :src="(currentSession?.avatar_url as string) || ''">
                <svg class="size-20px"><use href="#user"></use></svg>
              </n-avatar>
              <n-flex vertical :space="4">
                <span class="chat-name">{{ currentSession?.display_name || getParticipantId(currentSession) }}</span>
                <span class="chat-status">{{ getPresenceText(currentPresence) }}</span>
              </n-flex>
            </n-flex>
            <n-space>
              <n-dropdown :options="chatMenuOptions" @select="handleChatMenuAction">
                <n-button circle size="small" quaternary>
                  <svg class="size-14px"><use href="#more"></use></svg>
                </n-button>
              </n-dropdown>
            </n-space>
          </header>

          <!-- 消息列表 -->
          <div class="messages-container" ref="messagesContainerRef">
            <!-- 加载状态 -->
            <div v-if="isLoadingMessages" class="loading-messages">
              <n-spin size="medium">{{ t('privateChat.chat.loading_messages') }}</n-spin>
            </div>

            <!-- 空状态 -->
            <div v-else-if="privateChatStore.currentMessages.length === 0" class="empty-messages">
              <span class="text-(12px var(--hula-brand-primary))">{{ t('privateChat.chat.empty_state') }}</span>
            </div>

            <!-- 消息列表 -->
            <div v-else class="messages-list">
              <div
                v-for="message in privateChatStore.currentMessages"
                :key="message.message_id"
                class="message-item"
                :class="{ 'is-self': message.is_own }">
                <n-avatar
                  round
                  :size="32"
                  :src="message.is_own ? userAvatar || '' : (currentSession?.avatar_url as string) || ''">
                  <svg class="size-16px"><use href="#user"></use></svg>
                </n-avatar>
                <div class="message-content">
                  <div class="message-bubble">
                    <span class="message-text">{{ message.content }}</span>
                    <span class="message-time">{{ formatTime(message.timestamp) }}</span>
                  </div>
                  <div class="message-status">
                    <span v-if="message.is_destroyed" class="destroyed-badge">
                      {{ t('privateChat.message.destroyed') }}
                    </span>
                    <span v-else-if="message.is_own && message.status" class="status-text">
                      {{ getStatusText(message.status) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 输入区域 -->
          <footer class="chat-input">
            <n-flex align="flex-end" :space="8" vertical>
              <!-- 消息自毁设置 -->
              <n-collapse v-if="showMessageTTL" class="ttl-collapse">
                <n-collapse-item :title="t('privateChat.ttl.title')" name="ttl">
                  <n-space :space="8">
                    <n-radio-group v-model:value="selectedTTL" @update:value="handleTTLChange">
                      <n-radio-button value="0">{{ t('privateChat.ttl.no_destroy') }}</n-radio-button>
                      <n-radio-button value="30">{{ t('privateChat.ttl.seconds_30') }}</n-radio-button>
                      <n-radio-button value="60">{{ t('privateChat.ttl.minutes_1') }}</n-radio-button>
                      <n-radio-button value="300">{{ t('privateChat.ttl.minutes_5') }}</n-radio-button>
                      <n-radio-button value="3600">{{ t('privateChat.ttl.hours_1') }}</n-radio-button>
                    </n-radio-group>
                  </n-space>
                </n-collapse-item>
              </n-collapse>

              <!-- 输入框 -->
              <n-flex align="flex-end" :space="8">
                <n-button
                  text
                  size="small"
                  @click="showMessageTTL = !showMessageTTL"
                  :class="{ 'is-active': showMessageTTL }">
                  <svg class="size-18px">
                    <use :href="showMessageTTL ? '#clock-off' : '#clock'"></use>
                  </svg>
                </n-button>
                <n-input
                  ref="messageInputRef"
                  v-model:value="inputMessage"
                  type="textarea"
                  :autosize="{ minRows: 1, maxRows: 4 }"
                  :placeholder="t('privateChat.input.placeholder')"
                  @keydown="handleInputKeyDown" />
                <n-button type="primary" size="medium" @click="handleSendMessage" :loading="isSending">
                  {{ t('privateChat.input.send') }}
                </n-button>
              </n-flex>
            </n-flex>
          </footer>
        </template>
      </main>
    </template>

    <!-- 新建聊天对话框（移动端和PC端共用） -->
    <n-modal
      v-model:show="showNewChatDialog"
      preset="card"
      :title="t('privateChat.dialogs.new_chat_title')"
      class="w-400px">
      <n-form label-placement="left" label-width="80">
        <n-form-item :label="t('privateChat.dialogs.user_id_label')">
          <n-input v-model:value="newChatUserId" :placeholder="t('privateChat.dialogs.user_id_placeholder')" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showNewChatDialog = false">{{ t('common.cancel') }}</n-button>
          <n-button type="primary" @click="handleCreateSession" :loading="isCreatingSession">
            {{ t('privateChat.dialogs.start_button') }}
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NButton,
  NAvatar,
  NBadge,
  NSpin,
  NEmpty,
  NDropdown,
  NInput,
  NCollapse,
  NCollapseItem,
  NRadioGroup,
  NRadioButton,
  NModal,
  NForm,
  NFormItem,
  NSpace,
  NFlex,
  useDialog,
  useMessage
} from 'naive-ui'
import { usePrivateChatStoreV2 } from '@/stores/privateChatV2'
import type { PrivateChatSessionItem, PrivateChatMessageItem } from '@/types/matrix-sdk-v2'
import { useUserStore } from '@/stores/user'
import { logger } from '@/utils/logger'
import { checkAppReady, withAppCheck } from '@/utils/appErrorHandler'
import { appInitMonitor, AppInitPhase } from '@/utils/performanceMonitor'

const { t } = useI18n()
const dialog = useDialog()
const message = useMessage()
const userStore = useUserStore()

// 使用 v2 Store
const privateChatStore = usePrivateChatStoreV2()

// 状态
const isLoadingMessages = ref(false)
const isSending = ref(false)
const isCreatingSession = ref(false)
const inputMessage = ref('')
const newChatUserId = ref('')
const showNewChatDialog = ref(false)
const showMessageTTL = ref(false)
const selectedTTL = ref('0')
const currentPresence = ref<'online' | 'offline' | 'unavailable' | 'away'>('offline')
const messagesContainerRef = ref<HTMLElement | null>(null)
const messageInputRef = ref<HTMLElement | null>(null)

// 移动端状态
const showMobileChat = ref(false)
const isMobile = ref(false)

// 检测是否为移动端
const checkMobile = () => {
  if (typeof window === 'undefined') return
  isMobile.value = window.innerWidth < 768
}

// 监听窗口大小变化
const handleResize = () => {
  checkMobile()
  // 从移动端切换到PC端时，重置移动端视图状态
  if (!isMobile.value) {
    showMobileChat.value = false
  }
}

// 用户头像
const userAvatar = computed(() => userStore.userInfo?.avatar || '')

// 当前会话
const currentSession = computed(() => privateChatStore.currentSession)

// 聊天菜单选项
const chatMenuOptions = computed(() => [
  { label: t('privateChat.menu.clear_history'), key: 'clear' },
  { type: 'divider', key: 'd1' },
  { label: t('privateChat.menu.delete_session'), key: 'delete' }
])

// 方法

const getParticipantId = (session?: PrivateChatSessionItem | null): string => {
  if (!session || !session.participant_ids || session.participant_ids.length === 0) {
    return ''
  }
  // 返回第一个非自己的用户ID
  const myId = userStore.userInfo?.uid
  return session.participant_ids.find((id) => id !== myId) || session.participant_ids[0]
}

const handleSelectSession = async (session: PrivateChatSessionItem) => {
  try {
    await privateChatStore.selectSession(session.session_id)
    isLoadingMessages.value = true
    await privateChatStore.loadMessages(session.session_id, 50)
    await nextTick()
    scrollToBottom()
  } catch (error) {
    message.error(t('privateChat.errors.load_messages_failed'))
    logger.error('[PrivateChatViewV2] Failed to select session:', error)
  } finally {
    isLoadingMessages.value = false
  }

  // 获取对方在线状态（暂时使用 offline，v2 暂未提供 presence API）
  currentPresence.value = 'offline'
}

const handleCreateSession = async () => {
  if (!newChatUserId.value) {
    message.warning(t('privateChat.dialogs.user_id_required'))
    return
  }

  // 使用 withAppCheck 包装整个操作
  await withAppCheck(
    async () => {
      isCreatingSession.value = true

      const newSession = await privateChatStore.createSession({
        participants: [newChatUserId.value],
        session_name: undefined,
        ttl_seconds: undefined
      })

      await privateChatStore.refreshSessions()
      await handleSelectSession(newSession)

      showNewChatDialog.value = false
      newChatUserId.value = ''
      message.success(t('privateChat.dialogs.create_success'))
    },
    {
      customMessage: t('privateChat.dialogs.create_failed')
    }
  )

  isCreatingSession.value = false
}

// 移动端：选择会话并切换到聊天视图
const handleMobileSelectSession = async (session: PrivateChatSessionItem) => {
  await handleSelectSession(session)
  showMobileChat.value = true
}

// 移动端：返回会话列表
const handleMobileBack = () => {
  showMobileChat.value = false
}

const handleSendMessage = async () => {
  const content = inputMessage.value.trim()
  if (!content || !privateChatStore.currentSessionId) return

  // 使用 withAppCheck 包装整个操作
  await withAppCheck(
    async () => {
      isSending.value = true

      const ttl = showMessageTTL.value ? parseInt(selectedTTL.value, 10) : undefined
      await privateChatStore.sendMessage(content)

      // 如果设置了 TTL，隐藏 TTL 设置面板
      if (ttl) {
        showMessageTTL.value = false
      }

      inputMessage.value = ''
      await nextTick()
      scrollToBottom()
    },
    {
      customMessage: t('privateChat.errors.send_failed')
    }
  )

  isSending.value = false
}

const handleInputKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSendMessage()
  }
}

const handleTTLChange = () => {
  // TTL 变化处理（v2 SDK 暂未支持 TTL）
}

const handleChatMenuAction = async (key: string) => {
  switch (key) {
    case 'clear':
      dialog.warning({
        title: t('privateChat.confirm.clear_title'),
        content: t('privateChat.confirm.clear_content'),
        positiveText: t('common.confirm'),
        negativeText: t('common.cancel'),
        onPositiveClick: async () => {
          try {
            if (privateChatStore.currentSessionId) {
              // v2 SDK 暂未提供清空历史功能，暂时清空本地状态
              await privateChatStore.selectSession(privateChatStore.currentSessionId)
              message.success(t('privateChat.confirm.clear_success'))
            }
          } catch (error) {
            message.error(t('privateChat.confirm.clear_failed'))
            logger.error('[PrivateChatViewV2] Failed to clear history:', error)
          }
        }
      })
      break
    case 'delete':
      dialog.warning({
        title: t('privateChat.confirm.delete_title'),
        content: t('privateChat.confirm.delete_content'),
        positiveText: t('common.confirm'),
        negativeText: t('common.cancel'),
        onPositiveClick: async () => {
          try {
            if (privateChatStore.currentSessionId) {
              await privateChatStore.deleteSession(privateChatStore.currentSessionId)
              await privateChatStore.refreshSessions()
              message.success(t('privateChat.confirm.delete_success'))
            }
          } catch (error) {
            message.error(t('privateChat.confirm.delete_failed'))
            logger.error('[PrivateChatViewV2] Failed to delete session:', error)
          }
        }
      })
      break
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

const formatTime = (timestamp?: number): string => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  // 小于1分钟
  if (diff < 60000) {
    return t('privateChat.time.just_now')
  }
  // 小于1小时
  if (diff < 3600000) {
    return t('privateChat.time.minutes_ago', { minutes: Math.floor(diff / 60000) })
  }
  // 今天
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  // 昨天
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) {
    return t('privateChat.time.yesterday')
  }
  // 其他
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

const getPresenceText = (status?: 'online' | 'offline' | 'unavailable' | 'away'): string => {
  switch (status) {
    case 'online':
      return t('privateChat.chat.online')
    case 'offline':
      return t('privateChat.chat.offline')
    case 'unavailable':
      return t('friends.status.unavailable')
    case 'away':
      return t('friends.status.away')
    default:
      return t('friends.status.unknown')
  }
}

const getStatusText = (status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed'): string => {
  switch (status) {
    case 'sending':
      return t('privateChat.message.status_sending')
    case 'sent':
      return t('privateChat.message.status_sent')
    case 'delivered':
      return t('privateChat.message.status_delivered')
    case 'read':
      return t('privateChat.message.status_read')
    case 'failed':
      return t('privateChat.message.status_failed')
    default:
      return ''
  }
}

// 生命周期
onMounted(async () => {
  // 初始化移动端检测
  checkMobile()
  window.addEventListener('resize', handleResize)

  // 使用统一的应用状态检查
  if (!checkAppReady()) {
    return
  }

  // 使用 withAppCheck 包装初始化
  await withAppCheck(
    async () => {
      // 添加性能监控
      appInitMonitor.markPhase(AppInitPhase.LOAD_STORES)

      await privateChatStore.initialize()
      await privateChatStore.refreshSessions()
      logger.info('[PrivateChatViewV2] Initialized successfully')
    },
    {
      customMessage: '加载私聊会话失败'
    }
  )
})

onUnmounted(() => {
  // 清理资源
  window.removeEventListener('resize', handleResize)
  privateChatStore.dispose()
})

// 导出刷新方法供父组件调用
defineExpose({
  refresh: () => privateChatStore.refreshSessions()
})
</script>

<style scoped lang="scss">
.private-chat-container {
  display: flex;
  width: 100%;
  height: 100vh;
  background: var(--bg-color);
}

.sessions-sidebar {
  width: 300px;
  border-right: 1px solid var(--line-color);
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--line-color);
}

.sessions-list {
  flex: 1;
  overflow-y: auto;
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 40px;
}

.session-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: var(--hover-color);
  }

  &.is-active {
    background: var(--active-color);
  }
}

.session-content {
  flex: 1;
  min-width: 0;
}

.session-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.session-name {
  font-weight: 600;
  font-size: 14px;
}

.session-preview {
  font-size: 12px;
  color: var(--hula-brand-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-time {
  font-size: 11px;
  color: var(--hula-brand-primary);
}

.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--line-color);
}

.chat-name {
  font-weight: 600;
  font-size: 14px;
}

.chat-status {
  font-size: 12px;
  color: var(--hula-brand-primary);
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.loading-messages,
.empty-messages {
  display: flex;
  justify-content: center;
  align-items: center;
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
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 70%;
}

.message-bubble {
  padding: 10px 14px;
  border-radius: 12px;
  background: var(--bg-secondary);
  position: relative;

  .message-item.is-self & {
    background: var(--hula-primary);
    color: white;
  }
}

.message-text {
  word-break: break-word;
}

.message-time {
  font-size: 11px;
  opacity: 0.7;
}

.message-status {
  font-size: 11px;
  opacity: 0.7;

  .message-item.is-self & {
    text-align: right;
  }
}

.destroyed-badge {
  color: var(--hula-brand-primary);
}

.status-text {
  color: var(--hula-brand-primary);
}

.chat-input {
  padding: 12px 16px;
  border-top: 1px solid var(--line-color);
}

.ttl-collapse {
  margin-bottom: 8px;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ==========================================================================
   移动端样式
   ========================================================================== */
.private-chat-container.is-mobile {
  display: block;
}

/* 移动端：会话列表视图 */
.mobile-sessions-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--mobile-bg-secondary, var(--hula-brand-primary));
}

.mobile-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: var(--mobile-bg-primary, var(--hula-brand-primary));
  border-bottom: 1px solid var(--mobile-border, var(--hula-brand-primary));

  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--mobile-text-primary, var(--hula-gray-900));
  }
}

.mobile-sessions-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.mobile-session-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.2s;
  margin-bottom: 4px;

  &:hover {
    background: var(--mobile-bg-hover, rgba(var(--hula-success-rgb), 0.08));
  }

  &:active {
    background: var(--mobile-bg-active, rgba(var(--hula-success-rgb), 0.15));
  }

  .session-avatar {
    position: relative;
    flex-shrink: 0;
  }

  .session-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .session-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .session-name {
    font-weight: 600;
    font-size: 16px;
    color: var(--mobile-text-primary, var(--hula-gray-900));
  }

  .session-time {
    font-size: 12px;
    color: var(--mobile-text-tertiary, var(--hula-gray-400));
  }

  .session-preview {
    font-size: 14px;
    color: var(--mobile-text-secondary, var(--hula-gray-700));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

/* 移动端：聊天视图 */
.mobile-chat-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--mobile-bg-secondary, var(--hula-brand-primary));
}

.mobile-chat-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--mobile-bg-primary, var(--hula-brand-primary));
  border-bottom: 1px solid var(--mobile-border, var(--hula-brand-primary));

  .header-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .chat-name {
    font-weight: 600;
    font-size: 16px;
    color: var(--mobile-text-primary, var(--hula-gray-900));
  }

  .chat-status {
    font-size: 12px;
    color: var(--mobile-text-secondary, var(--hula-gray-700));
  }
}

.mobile-messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: var(--mobile-bg-secondary, var(--hula-brand-primary));
}

.mobile-messages-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mobile-message-item {
  display: flex;
  width: 100%;

  &.is-self {
    justify-content: flex-end;
  }

  .message-content {
    max-width: 75%;
  }
}

.mobile-message-item .message-bubble {
  padding: 12px 16px;
  border-radius: 18px;
  background: var(--mobile-bg-tertiary, var(--hula-brand-primary));
  position: relative;

  .mobile-message-item.is-self & {
    background: var(--mobile-accent-primary, var(--hula-brand-primary));
    color: white;
    border-bottom-right-radius: 4px;
  }

  &:not(.mobile-message-item.is-self &) {
    border-bottom-left-radius: 4px;
  }
}

.mobile-chat-input {
  padding: 12px 16px;
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0));
  background: var(--mobile-bg-secondary, var(--hula-brand-primary));
  border-top: 1px solid var(--mobile-border, var(--hula-brand-primary));

  .input-row {
    display: flex;
    align-items: flex-end;
    gap: 8px;
  }
}

.empty-text {
  color: var(--mobile-text-tertiary, var(--hula-gray-400));
  font-size: 14px;
}

/* 隐藏PC端元素 */
.private-chat-container.is-mobile {
  .sessions-sidebar,
  .chat-area {
    display: none;
  }
}
</style>
