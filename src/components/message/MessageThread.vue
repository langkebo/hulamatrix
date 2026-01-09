<template>
  <div class="message-thread" :class="{ 'is-expanded': isExpanded, 'is-inline': inline }">
    <!-- 线程触发器 -->
    <div v-if="!isExpanded" class="thread-trigger" @click="expandThread">
      <div class="thread-info">
        <n-icon class="thread-icon"><Message /></n-icon>
        <span class="thread-text">
          {{ threadPreview }}
        </span>
        <span class="thread-count">{{ messageCount }} 条回复</span>
      </div>
      <div class="thread-participants">
        <n-avatar-group :options="avatarGroupOptions" :size="20" :max="3" />
        <span v-if="threadParticipants.length > 3" class="more-participants">+{{ threadParticipants.length - 3 }}</span>
      </div>
    </div>

    <!-- 展开的线程视图 -->
    <div v-else class="thread-expanded">
      <div class="thread-header">
        <div class="header-left">
          <n-icon class="thread-icon"><Message /></n-icon>
          <div class="thread-title">
            <h4>线程讨论</h4>
            <span class="message-count">{{ messageCount }} 条消息</span>
          </div>
        </div>
        <div class="header-right">
          <n-button quaternary circle size="small" @click="collapseThread">
            <template #icon>
              <n-icon><Minimize /></n-icon>
            </template>
          </n-button>
        </div>
      </div>

      <!-- 原始消息 (线程根) -->
      <div class="thread-root">
        <div class="root-message">
          <div class="message-avatar">
            <n-avatar :src="rootMessage.senderAvatar" :size="32" round />
          </div>
          <div class="message-content">
            <div class="message-header">
              <span class="sender-name">{{ rootMessage.senderName }}</span>
              <span class="message-time">{{ formatTime(rootMessage.timestamp) }}</span>
              <n-tag size="small" type="info">原消息</n-tag>
            </div>
            <div class="message-body">
              <div v-html="sanitizeContent(rootMessage.content)"></div>
              <MessageReactions :room-id="roomId" :event-id="rootMessage.id" :compact-mode="true" />
            </div>
          </div>
        </div>
      </div>

      <!-- 线程消息列表 -->
      <div class="thread-messages" ref="messagesContainer">
        <div
          v-for="message in threadMessages"
          :key="message.id"
          class="thread-message"
          :class="{ 'is-own': message.isOwn }">
          <div class="message-avatar">
            <n-avatar :src="message.senderAvatar" :size="28" round />
          </div>
          <div class="message-content">
            <div class="message-header">
              <span class="sender-name">{{ message.senderName }}</span>
              <span class="message-time">{{ formatTime(message.timestamp) }}</span>
              <n-tag v-if="message.isEdited" size="small" type="warning">已编辑</n-tag>
            </div>
            <div class="message-body">
              <div v-html="sanitizeContent(message.content)"></div>
              <MessageReactions :room-id="roomId" :event-id="message.id" :compact-mode="true" />
            </div>
            <div class="message-actions">
              <n-button quaternary size="tiny" @click="replyToMessage(message)">
                <template #icon>
                  <n-icon><CornerUpLeft /></n-icon>
                </template>
                回复
              </n-button>
              <n-button quaternary size="tiny" @click="editMessage(message)">
                <template #icon>
                  <n-icon><Edit /></n-icon>
                </template>
                编辑
              </n-button>
              <n-dropdown :options="getMessageActions(message)" @select="handleMessageAction($event, message)">
                <n-button quaternary circle size="tiny">
                  <template #icon>
                    <n-icon><DotsVertical /></n-icon>
                  </template>
                </n-button>
              </n-dropdown>
            </div>
          </div>
        </div>

        <!-- 加载更多按钮 -->
        <div v-if="hasMoreMessages" class="load-more">
          <n-button @click="loadMoreMessages" :loading="isLoadingMore">加载更多消息</n-button>
        </div>

        <!-- 新消息指示器 -->
        <div v-if="hasNewMessages" class="new-messages-indicator">
          <n-button @click="scrollToNewMessages" type="primary" size="small">{{ newMessagesCount }} 条新消息</n-button>
        </div>
      </div>

      <!-- 线程回复输入框 -->
      <div class="thread-reply-input">
        <div v-if="replyingToMessage" class="replying-to">
          <div class="reply-preview">
            <span>回复给 {{ replyingToMessage.senderName }}:</span>
            <div class="reply-content">{{ replyingToMessage.content }}</div>
          </div>
          <n-button quaternary circle size="tiny" @click="cancelReply">
            <template #icon>
              <n-icon><X /></n-icon>
            </template>
          </n-button>
        </div>

        <MessageEditor
          :room-id="roomId"
          :inline="true"
          :initial-content="replyContent"
          @message-sent="handleThreadReply"
          @closed="cancelReply" />
      </div>

      <!-- 线程设置 -->
      <div class="thread-settings">
        <n-dropdown :options="threadSettingsOptions" @select="handleThreadSetting">
          <n-button quaternary size="small">
            <template #icon>
              <n-icon><Settings /></n-icon>
            </template>
            线程设置
          </n-button>
        </n-dropdown>
      </div>
    </div>

    <!-- 线程统计 -->
    <div v-if="showStatistics && isExpanded" class="thread-statistics">
      <div class="stats-header">
        <h4>线程统计</h4>
      </div>
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-value">{{ messageCount }}</div>
          <div class="stat-label">消息数</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ uniqueParticipants }}</div>
          <div class="stat-label">参与者</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ totalReactions }}</div>
          <div class="stat-label">反应数</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ formatDuration(threadDuration) }}</div>
          <div class="stat-label">持续时间</div>
        </div>
      </div>
    </div>

    <!-- 加入线程对话框 -->
    <n-modal v-model:show="showJoinDialog" preset="dialog" title="加入线程讨论">
      <div class="join-thread-content">
        <p>您是否要加入这个线程讨论？加入后您将收到所有新消息的通知。</p>
        <div class="join-options">
          <n-checkbox v-model:checked="joinOptions.notifications">接收新消息通知</n-checkbox>
          <n-checkbox v-model:checked="joinOptions.pinToTop">将线程固定在顶部</n-checkbox>
        </div>
      </div>
      <template #action>
        <n-space>
          <n-button @click="showJoinDialog = false">取消</n-button>
          <n-button type="primary" @click="joinThread">加入线程</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { NIcon, NButton, NAvatarGroup, NTag, NModal, NCheckbox, NSpace, NDropdown } from 'naive-ui'
import { Minimize, CornerUpLeft, X, Settings } from '@vicons/tabler'
import Message from '@vicons/tabler/Message'
import Edit from '@vicons/tabler/Edit'
import DotsVertical from '@vicons/tabler/DotsVertical'
import MessageReactions from './MessageReactions.vue'
import { msg } from '@/utils/SafeUI'
import MessageEditor from './MessageEditor.vue'
import { sanitizeHtml } from '@/utils/htmlSanitizer'
import type { DropdownOption } from 'naive-ui'
import { logger } from '@/utils/logger'
import { matrixThreadAdapter } from '@/services/matrixThreadAdapter'
import { useUserStore } from '@/stores/user'

interface Props {
  threadId: string
  roomId: string
  rootMessage?: ThreadMessage
  inline?: boolean
  showStatistics?: boolean
  autoExpand?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  inline: false,
  showStatistics: false,
  autoExpand: false
})

const emit = defineEmits<{
  'thread-expanded': [threadId: string]
  'thread-collapsed': [threadId: string]
  'message-replied': [message: ThreadMessage]
  'message-edited': [message: ThreadMessage]
}>()

const messageApi = msg

// 状态管理
const isExpanded = ref(props.autoExpand)
const isLoadingMore = ref(false)
const hasMoreMessages = ref(false)
const hasNewMessages = ref(false)
const newMessagesCount = ref(0)

// 线程数据
interface ReactionItem {
  emoji: string
  count: number
  users?: string[]
  lastUpdated?: number
}
interface ThreadMessage {
  id: string
  content: string
  senderName: string
  senderAvatar: string
  timestamp: number
  isOwn?: boolean
  reactions?: ReactionItem[]
  isEdited?: boolean
}
const threadMessages = ref<ThreadMessage[]>([])
const threadParticipants = ref<Array<{ userId: string; displayName?: string; avatarUrl?: string }>>([])
const threadStatistics = ref<{ replyCount: number; participantCount: number; lastReplyTime?: number } | null>(null)

// UI状态
const replyingToMessage = ref<ThreadMessage | null>(null)
const replyContent = ref('')
const showJoinDialog = ref(false)
const showStatistics = ref(props.showStatistics)

// 加入选项
const joinOptions = ref({
  notifications: true,
  pinToTop: false
})

// 引用
const messagesContainer = ref<HTMLElement>()

// 模拟数据
const rootMessage = ref<ThreadMessage>(
  props.rootMessage || {
    id: 'root_001',
    content: '这是原始消息内容，引发了线程讨论',
    senderName: 'Alice',
    senderAvatar: '',
    timestamp: Date.now() - 3600000,
    isOwn: false,
    reactions: [],
    isEdited: false
  }
)

// 计算属性
const messageCount = computed(() => threadMessages.value.length + 1) // +1 for root message

// Avatar group options for n-avatar-group
const avatarGroupOptions = computed(() => {
  return threadParticipants.value.slice(0, 3).map((p) => ({
    src: p.avatarUrl || '',
    fallback: p.displayName?.[0] || p.userId[0] || '?'
  }))
})

const uniqueParticipants = computed(() => {
  const participantSet = new Set()
  participantSet.add(rootMessage.value.senderName)
  threadMessages.value.forEach((msg) => {
    participantSet.add(msg.senderName)
  })
  return participantSet.size
})

const totalReactions = computed(() => {
  let reactionsCount = 0
  rootMessage.value.reactions?.forEach((reaction: ReactionItem) => {
    reactionsCount += reaction.count
  })
  threadMessages.value.forEach((msg) => {
    msg.reactions?.forEach((reaction: ReactionItem) => {
      reactionsCount += reaction.count
    })
  })
  return reactionsCount
})

const threadDuration = computed(() => {
  if (threadMessages.value.length === 0) return 0
  const firstMessage = rootMessage.value
  const lastMessage = threadMessages.value[threadMessages.value.length - 1] || rootMessage.value
  return lastMessage.timestamp - firstMessage.timestamp
})

const threadPreview = computed(() => {
  const preview = threadMessages.value[threadMessages.value.length - 1]
  return preview ? preview.content.substring(0, 50) + '...' : '点击查看线程'
})

const threadSettingsOptions = computed((): DropdownOption[] => {
  const options: DropdownOption[] = [
    { label: '查看统计', key: 'statistics' },
    { label: '导出线程', key: 'export' },
    { label: '复制链接', key: 'copy-link' }
  ]

  // 检查是否是线程管理员，添加管理选项
  if (isThreadAdmin.value) {
    options.push(
      { label: '锁定线程', key: 'lock' },
      { label: '置顶线程', key: 'pin' },
      { label: '删除线程', key: 'delete' }
    )
  }

  return options
})

// 检查是否是线程管理员
// 线程管理员条件：
// 1. 当前用户是线程创建者（根消息发送者）
// 2. 或者当前用户在房间中具有管理员/版主权限
const isThreadAdmin = computed(() => {
  const userStore = useUserStore()
  const currentUserId = userStore.userInfo?.uid || ''

  // 检查是否是线程创建者
  // 注意：这里需要比较 rootMessage 的发送者 ID，但由于模拟数据中只有 senderName
  // 实际实现时应该在 rootMessage 中包含 senderId
  if (rootMessage.value.isOwn) {
    return true
  }

  // 检查房间权限（这里可以通过 room store 或 matrix client 检查）
  // 暂时返回 false，等待实际的权限系统集成
  return false
})

// ========== 方法 ==========

// Sanitize message content to prevent XSS attacks
const sanitizeContent = (content: string | undefined): string => {
  return sanitizeHtml(content || '')
}

const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatDuration = (milliseconds: number): string => {
  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}天`
  if (hours > 0) return `${hours}小时`
  if (minutes > 0) return `${minutes}分钟`
  return `${seconds}秒`
}

const expandThread = () => {
  isExpanded.value = true
  loadThreadMessages()
  emit('thread-expanded', props.threadId)
}

const collapseThread = () => {
  isExpanded.value = false
  emit('thread-collapsed', props.threadId)
}

const loadThreadMessages = async () => {
  try {
    const userStore = useUserStore()
    const currentUserId = userStore.userInfo?.uid || ''

    // Get thread root info first
    const threadRoot = await matrixThreadAdapter.getThreadRoot(props.threadId, props.roomId)
    if (threadRoot) {
      // Update root message with real data
      rootMessage.value = {
        id: threadRoot.eventId,
        content: (threadRoot.body as { body?: string })?.body || '',
        senderName: threadRoot.senderId.split(':')[0].replace(/^@/, ''),
        senderAvatar: '',
        timestamp: threadRoot.timestamp,
        isOwn: threadRoot.senderId === currentUserId,
        reactions: [],
        isEdited: false
      }
    }

    // Get thread messages from Matrix SDK
    const events = await matrixThreadAdapter.getThreadMessages(props.threadId, props.roomId, {
      limit: 50,
      dir: 'f'
    })

    // Convert Matrix events to thread messages
    const messages: ThreadMessage[] = []
    const participants = new Map<string, { userId: string; displayName?: string; avatarUrl?: string }>()

    for (const event of events) {
      const e = event as {
        getId?: () => string
        event_id?: string
        getSender?: () => string
        sender?: string
        getContent?: () => { body?: string }
        content?: { body?: string }
        getTs?: () => number
        origin_server_ts?: number
      }

      const eventId = e.getId?.() || e.event_id || ''
      const sender = e.getSender?.() || e.sender || ''
      const content = e.getContent ? e.getContent() : e.content
      const body = content?.body || ''
      const timestamp = e.getTs ? e.getTs() : e.origin_server_ts || Date.now()

      // Track participant
      const senderId = sender
      if (!participants.has(senderId)) {
        participants.set(senderId, {
          userId: senderId,
          displayName: senderId.split(':')[0].replace(/^@/, ''),
          avatarUrl: ''
        })
      }

      messages.push({
        id: eventId,
        content: body,
        senderName: senderId.split(':')[0].replace(/^@/, ''),
        senderAvatar: '',
        timestamp,
        isOwn: sender === currentUserId,
        reactions: [],
        isEdited: false
      })
    }

    threadMessages.value = messages
    threadParticipants.value = Array.from(participants.values())

    // Check if there are more messages (not implemented for SDK native threads)
    hasMoreMessages.value = false

    // Calculate statistics
    threadStatistics.value = {
      replyCount: messageCount.value,
      participantCount: uniqueParticipants.value,
      lastReplyTime: messages.length > 0 ? messages[messages.length - 1].timestamp : undefined
    }

    logger.info('[MessageThread] Thread messages loaded:', {
      threadId: props.threadId,
      messageCount: messages.length,
      participantCount: participants.size
    })
  } catch (error) {
    logger.error('[MessageThread] Failed to load thread messages:', error)
    messageApi.error('加载线程消息失败')
  }
}

const loadMoreMessages = async () => {
  isLoadingMore.value = true
  try {
    const userStore = useUserStore()
    const currentUserId = userStore.userInfo?.uid || ''

    // Get earliest message for pagination
    const earliestMessage = threadMessages.value[0]
    const fromEventId = earliestMessage?.id || ''

    // Load more messages from Matrix SDK
    const events = await matrixThreadAdapter.getThreadMessages(props.threadId, props.roomId, {
      from: fromEventId,
      limit: 20,
      dir: 'b'
    })

    if (events.length === 0) {
      hasMoreMessages.value = false
      return
    }

    // Convert Matrix events to thread messages
    const moreMessages: ThreadMessage[] = []

    for (const event of events) {
      const e = event as {
        getId?: () => string
        event_id?: string
        getSender?: () => string
        sender?: string
        getContent?: () => { body?: string }
        content?: { body?: string }
        getTs?: () => number
        origin_server_ts?: number
      }

      const eventId = e.getId?.() || e.event_id || ''
      const sender = e.getSender?.() || e.sender || ''
      const content = e.getContent ? e.getContent() : e.content
      const body = content?.body || ''
      const timestamp = e.getTs ? e.getTs() : e.origin_server_ts || Date.now()

      moreMessages.push({
        id: eventId,
        content: body,
        senderName: sender.split(':')[0].replace(/^@/, ''),
        senderAvatar: '',
        timestamp,
        isOwn: sender === currentUserId,
        reactions: [],
        isEdited: false
      })
    }

    // Add to the beginning of the messages array
    threadMessages.value = [...moreMessages, ...threadMessages.value]

    // Update hasMoreMessages based on whether we got a full page
    hasMoreMessages.value = events.length >= 20

    logger.info('[MessageThread] More messages loaded:', { count: moreMessages.length })
  } catch (error) {
    logger.error('[MessageThread] Failed to load more messages:', error)
    messageApi.error('加载更多消息失败')
  } finally {
    isLoadingMore.value = false
  }
}

const scrollToNewMessages = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
  hasNewMessages.value = false
  newMessagesCount.value = 0
}

const replyToMessage = (message: ThreadMessage) => {
  replyingToMessage.value = message
  replyContent.value = `@${message.senderName} `
}

const cancelReply = () => {
  replyingToMessage.value = null
  replyContent.value = ''
}

const handleThreadReply = async (messageData: unknown) => {
  try {
    const data = messageData as { content?: string }
    const content = data.content || ''

    if (!content.trim()) {
      messageApi.warning('请输入消息内容')
      return
    }

    // Send thread reply through Matrix SDK
    const eventId = await matrixThreadAdapter.sendThreadReply(props.threadId, props.roomId, 'm.text', { text: content })

    // Get current user info
    const userStore = useUserStore()
    const currentUserId = userStore.userInfo?.uid || ''

    // Add new message to thread
    const newMessage: ThreadMessage = {
      id: eventId,
      content,
      senderName: currentUserId.split(':')[0].replace(/^@/, ''),
      senderAvatar: '',
      timestamp: Date.now(),
      isOwn: true,
      reactions: [],
      isEdited: false
    }

    threadMessages.value.push(newMessage)
    emit('message-replied', newMessage)
    cancelReply()

    // Mark thread as read
    await matrixThreadAdapter.markThreadAsRead(props.threadId, props.roomId)

    logger.info('[MessageThread] Thread reply sent:', { eventId, threadId: props.threadId })
  } catch (error) {
    logger.error('[MessageThread] Failed to send thread reply:', error)
    messageApi.error('发送回复失败')
  }

  // 滚动到新消息
  nextTick(() => {
    scrollToNewMessages()
  })
}

const editMessage = (_message: ThreadMessage) => {
  // 这里可以触发编辑模式
  messageApi.success('编辑功能开发中')
}

const getMessageActions = (message: ThreadMessage): DropdownOption[] => {
  const options: DropdownOption[] = [
    { label: '回复', key: 'reply' },
    { label: '复制', key: 'copy' }
  ]

  if (message.isOwn) {
    options.push({ label: '编辑', key: 'edit' }, { label: '删除', key: 'delete' })
  }

  return options
}

const handleMessageAction = (action: string, message: ThreadMessage) => {
  switch (action) {
    case 'reply':
      replyToMessage(message)
      break
    case 'edit':
      editMessage(message)
      break
    case 'copy':
      copyMessageContent(message)
      break
    case 'delete':
      deleteThreadMessage(message)
      break
  }
}

const copyMessageContent = async (message: ThreadMessage) => {
  try {
    await navigator.clipboard.writeText(message.content)
    messageApi.success('消息内容已复制到剪贴板')
  } catch (error) {
    messageApi.error('复制失败')
  }
}

const deleteThreadMessage = (message: ThreadMessage) => {
  window.$dialog?.warning?.({
    title: '确认删除',
    content: '确定要删除这条消息吗？此操作不可撤销。',
    onPositiveClick: () => {
      const index = threadMessages.value.findIndex((m) => m.id === message.id)
      if (index > -1) {
        threadMessages.value.splice(index, 1)
        messageApi.success('消息已删除')
      }
    }
  })
}

const handleThreadSetting = async (action: string) => {
  switch (action) {
    case 'statistics':
      showStatistics.value = !showStatistics.value
      break
    case 'export':
      exportThread()
      break
    case 'copy-link':
      copyThreadLink()
      break
    case 'lock':
      lockThread()
      break
    case 'pin':
      pinThread()
      break
    case 'delete':
      deleteThread()
      break
  }
}

const exportThread = () => {
  const threadData = {
    threadId: props.threadId,
    rootMessage: rootMessage.value,
    messages: threadMessages.value,
    statistics: threadStatistics.value
  }

  const blob = new Blob([JSON.stringify(threadData, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `thread-${props.threadId}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  messageApi.success('线程已导出')
}

const copyThreadLink = async () => {
  const link = `${window.location.origin}/room/${props.roomId}/thread/${props.threadId}`
  try {
    await navigator.clipboard.writeText(link)
    messageApi.success('线程链接已复制到剪贴板')
  } catch (error) {
    messageApi.error('复制链接失败')
  }
}

const lockThread = () => {
  messageApi.info('线程锁定功能开发中')
}

const pinThread = () => {
  messageApi.info('线程置顶功能开发中')
}

const deleteThread = () => {
  window.$dialog?.warning?.({
    title: '确认删除线程',
    content: '确定要删除整个线程吗？这将删除所有相关的消息和回复。',
    onPositiveClick: () => {
      messageApi.success('线程已删除')
      // 这里应该触发删除事件
    }
  })
}

const joinThread = () => {
  showJoinDialog.value = false
  messageApi.success('已加入线程讨论')

  if (joinOptions.value.notifications) {
    // 启用通知
  }

  if (joinOptions.value.pinToTop) {
    // 置顶线程
  }
}

// ========== 生命周期 ==========

onMounted(() => {
  if (props.autoExpand) {
    loadThreadMessages()
  }
})
</script>

<style lang="scss" scoped>
.message-thread {
  position: relative;

  &.is-inline {
    margin: 8px 0;
  }

  .thread-trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--bg-color-hover);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      background: var(--card-color);
      border-color: var(--primary-color);
    }

    .thread-info {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;

      .thread-icon {
        color: var(--primary-color);
      }

      .thread-text {
        font-weight: 500;
        color: var(--text-color-1);
      }

      .thread-count {
        font-size: 12px;
        color: var(--text-color-3);
      }
    }

    .thread-participants {
      display: flex;
      align-items: center;
      gap: 8px;

      .more-participants {
        font-size: 12px;
        color: var(--text-color-3);
      }
    }
  }

  .thread-expanded {
    border: 1px solid var(--border-color);
    border-radius: 12px;
    overflow: hidden;
    background: var(--card-color);

    .thread-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      background: var(--bg-color-hover);
      border-bottom: 1px solid var(--border-color);

      .header-left {
        display: flex;
        align-items: center;
        gap: 12px;

        .thread-icon {
          color: var(--primary-color);
        }

        .thread-title {
          h4 {
            margin: 0 0 4px 0;
            font-size: 16px;
            font-weight: 600;
            color: var(--text-color-1);
          }

          .message-count {
            font-size: 12px;
            color: var(--text-color-3);
          }
        }
      }
    }

    .thread-root {
      padding: 16px;
      background: rgba(24, 160, 88, 0.05);
      border-bottom: 1px solid var(--border-color);

      .root-message {
        display: flex;
        gap: 12px;

        .message-content {
          flex: 1;

          .message-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;

            .sender-name {
              font-weight: 600;
              color: var(--text-color-1);
            }

            .message-time {
              font-size: 12px;
              color: var(--text-color-3);
            }
          }

          .message-body {
            color: var(--text-color-1);
            line-height: 1.6;
          }
        }
      }
    }

    .thread-messages {
      max-height: 400px;
      overflow-y: auto;
      padding: 16px;

      .thread-message {
        display: flex;
        gap: 12px;
        margin-bottom: 16px;

        &.is-own {
          flex-direction: row-reverse;

          .message-content {
            align-items: flex-end;

            .message-header {
              flex-direction: row-reverse;
            }
          }
        }

        .message-content {
          flex: 1;
          max-width: 70%;

          .message-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 4px;

            .sender-name {
              font-weight: 600;
              color: var(--text-color-1);
            }

            .message-time {
              font-size: 12px;
              color: var(--text-color-3);
            }
          }

          .message-body {
            background: var(--bg-color);
            padding: 12px;
            border-radius: 12px;
            margin-bottom: 8px;
            line-height: 1.6;
          }

          .message-actions {
            display: flex;
            gap: 4px;
            opacity: 0;
            transition: opacity 0.2s ease;
          }
        }

        &:hover .message-actions {
          opacity: 1;
        }
      }

      .load-more {
        text-align: center;
        margin: 16px 0;
      }

      .new-messages-indicator {
        position: sticky;
        bottom: 0;
        text-align: center;
        margin: 16px 0;
      }
    }

    .thread-reply-input {
      padding: 16px;
      border-top: 1px solid var(--border-color);

      .replying-to {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        margin-bottom: 12px;
        padding: 8px;
        background: var(--bg-color-hover);
        border-radius: 8px;

        .reply-preview {
          flex: 1;

          span {
            font-size: 12px;
            color: var(--text-color-3);
            margin-bottom: 4px;
          }

          .reply-content {
            font-size: 14px;
            color: var(--text-color-1);
            line-height: 1.4;
          }
        }
      }
    }

    .thread-settings {
      padding: 12px 16px;
      border-top: 1px solid var(--border-color);
      text-align: center;
    }

    .thread-statistics {
      padding: 16px;
      border-top: 1px solid var(--border-color);
      background: var(--bg-color-hover);

      .stats-header {
        margin-bottom: 16px;

        h4 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-color-1);
        }
      }

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
        gap: 12px;

        .stat-item {
          text-align: center;

          .stat-value {
            font-size: 18px;
            font-weight: 600;
            color: var(--text-color-1);
            margin-bottom: 4px;
          }

          .stat-label {
            font-size: 12px;
            color: var(--text-color-3);
          }
        }
      }
    }
  }
}

.join-thread-content {
  margin: 20px 0;

  p {
    margin-bottom: 16px;
    color: var(--text-color-1);
  }

  .join-options {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
}

// 响应式设计
@media (max-width: 768px) {
  .message-thread {
    .thread-expanded {
      .thread-messages {
        .thread-message {
          .message-content {
            max-width: 85%;
          }
        }
      }

      .thread-statistics {
        .stats-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }
    }
  }
}
</style>
