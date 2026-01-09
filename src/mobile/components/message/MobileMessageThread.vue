<!-- Mobile Message Thread - Thread discussion view for mobile -->
<template>
  <div class="mobile-message-thread">
    <!-- Thread Trigger (Collapsed State) -->
    <div v-if="!isExpanded" class="thread-trigger" @click="expandThread">
      <div class="thread-info">
        <n-icon :size="18" class="thread-icon">
          <Message />
        </n-icon>
        <span class="thread-preview">{{ threadPreview }}</span>
        <span class="reply-count">{{ messageCount }} 条回复</span>
      </div>
      <div class="thread-participants">
        <div class="avatar-stack">
          <n-avatar
            v-for="participant in participantAvatars"
            :key="participant.userId"
            :src="participant.avatarUrl"
            :size="24"
            round
            class="participant-avatar">
            <template #fallback>
              <span>{{ participant.displayName?.[0] || '?' }}</span>
            </template>
          </n-avatar>
          <span v-if="threadParticipants.length > 3" class="more-count">+{{ threadParticipants.length - 3 }}</span>
        </div>
      </div>
      <n-icon :size="18" class="expand-icon">
        <ChevronRight />
      </n-icon>
    </div>

    <!-- Expanded Thread View (Bottom Sheet) -->
    <n-modal
      v-model:show="isExpanded"
      :mask-closable="true"
      :style="{
        width: '100%',
        maxWidth: '100%',
        height: '90vh',
        position: 'fixed',
        bottom: '0',
        margin: '0',
        borderRadius: '16px 16px 0 0'
      }"
      preset="card"
      @close="collapseThread">
      <template #header>
        <div class="thread-header">
          <div class="header-left">
            <n-icon :size="20" class="thread-icon">
              <Message />
            </n-icon>
            <div class="thread-title">
              <h4>线程讨论</h4>
              <span class="message-count">{{ messageCount }} 条消息</span>
            </div>
          </div>
          <n-button quaternary circle size="small" @click="collapseThread">
            <template #icon>
              <n-icon :size="20"><X /></n-icon>
            </template>
          </n-button>
        </div>
      </template>

      <!-- Root Message -->
      <div class="thread-root">
        <div class="root-message">
          <n-avatar :src="rootMessage.senderAvatar" :size="36" round class="message-avatar" />
          <div class="message-content">
            <div class="message-header">
              <span class="sender-name">{{ rootMessage.senderName }}</span>
              <span class="message-time">{{ formatTime(rootMessage.timestamp) }}</span>
            </div>
            <div class="message-body">
              <div class="message-text">{{ rootMessage.content }}</div>
              <MobileMessageReactions :room-id="roomId" :event-id="rootMessage.id" :show-add-button="false" />
            </div>
          </div>
        </div>
      </div>

      <!-- Thread Messages -->
      <div class="thread-messages" ref="messagesContainer">
        <!-- Loading State -->
        <div v-if="loading" class="loading-state">
          <n-spin size="medium" />
          <p>加载中...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="error-state">
          <n-icon :size="48" color="var(--hula-error)">
            <AlertCircle />
          </n-icon>
          <p>{{ error }}</p>
          <n-button type="primary" @click="loadThreadMessages">重试</n-button>
        </div>

        <!-- Messages List -->
        <template v-else>
          <!-- Load More Button -->
          <div v-if="hasMoreMessages" class="load-more">
            <n-button @click="loadMoreMessages" :loading="isLoadingMore">加载更多</n-button>
          </div>

          <!-- Messages -->
          <div
            v-for="message in threadMessages"
            :key="message.id"
            class="thread-message"
            :class="{ 'is-own': message.isOwn }">
            <n-avatar :src="message.senderAvatar" :size="32" round class="message-avatar" />
            <div class="message-content">
              <div class="message-header">
                <span class="sender-name">{{ message.senderName }}</span>
                <span class="message-time">{{ formatTime(message.timestamp) }}</span>
                <n-tag v-if="message.isEdited" size="small" type="warning">已编辑</n-tag>
              </div>
              <div class="message-body">
                <div class="message-text">{{ message.content }}</div>
                <MobileMessageReactions :room-id="roomId" :event-id="message.id" :show-add-button="false" />
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Reply Input -->
      <div class="reply-input-section">
        <div v-if="replyingTo" class="replying-to-banner">
          <div class="reply-preview">
            <span class="reply-label">回复给 {{ replyingTo.senderName }}:</span>
            <span class="reply-content">{{ replyingTo.content.substring(0, 50) }}...</span>
          </div>
          <n-button quaternary circle size="tiny" @click="cancelReply">
            <template #icon>
              <n-icon><X /></n-icon>
            </template>
          </n-button>
        </div>

        <div class="input-wrapper">
          <n-input
            v-model:value="replyContent"
            type="textarea"
            :placeholder="t('thread.replyPlaceholder')"
            :autosize="{ minRows: 1, maxRows: 4 }"
            @keyup.enter.ctrl="sendReply"
            @focus="scrollToBottom" />
          <n-button
            type="primary"
            circle
            size="medium"
            :disabled="!replyContent.trim()"
            :loading="sending"
            @click="sendReply"
            class="send-button">
            <template #icon>
              <n-icon><Send /></n-icon>
            </template>
          </n-button>
        </div>
      </div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NModal, NIcon, NButton, NAvatar, NTag, NSpin, NInput, useMessage } from 'naive-ui'
import { Message, ChevronRight, X, AlertCircle, Send } from '@vicons/tabler'
import MobileMessageReactions from './MobileMessageReactions.vue'
import { matrixThreadAdapter } from '@/services/matrixThreadAdapter'
import { useUserStore } from '@/stores/user'
import { logger } from '@/utils/logger'
import { msg } from '@/utils/SafeUI'

interface Props {
  threadId: string
  roomId: string
  rootMessage?: ThreadMessage
  autoExpand?: boolean
}

interface ThreadMessage {
  id: string
  content: string
  senderName: string
  senderAvatar: string
  timestamp: number
  isOwn?: boolean
  isEdited?: boolean
}

interface Emits {
  (e: 'thread-expanded', threadId: string): void
  (e: 'thread-collapsed', threadId: string): void
  (e: 'message-replied', message: ThreadMessage): void
}

const props = withDefaults(defineProps<Props>(), {
  autoExpand: false
})

const emit = defineEmits<Emits>()

const { t } = useI18n()
const message = useMessage()

// State
const isExpanded = ref(props.autoExpand)
const loading = ref(false)
const isLoadingMore = ref(false)
const hasMoreMessages = ref(false)
const sending = ref(false)
const error = ref<string | null>(null)
const replyContent = ref('')
const replyingTo = ref<ThreadMessage | null>(null)

// Thread data
const threadMessages = ref<ThreadMessage[]>([])
const threadParticipants = ref<Array<{ userId: string; displayName?: string; avatarUrl?: string }>>([])
const rootMessage = ref<ThreadMessage>(
  props.rootMessage || {
    id: 'root_001',
    content: '这是原始消息',
    senderName: 'Alice',
    senderAvatar: '',
    timestamp: Date.now() - 3600000,
    isOwn: false
  }
)

const messagesContainer = ref<HTMLElement>()

// Computed
const messageCount = computed(() => threadMessages.value.length + 1)

const participantAvatars = computed(() => {
  return threadParticipants.value.slice(0, 3)
})

const threadPreview = computed(() => {
  const preview = threadMessages.value[threadMessages.value.length - 1]
  return preview ? preview.content.substring(0, 30) + '...' : '点击查看线程'
})

// Methods
const formatTime = (timestamp: number): string => {
  const now = Date.now()
  const diff = now - timestamp

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`

  const date = new Date(timestamp)
  return date.toLocaleDateString()
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
  loading.value = true
  error.value = null

  try {
    const userStore = useUserStore()
    const currentUserId = userStore.userInfo?.uid || ''

    // Get thread root
    const threadRoot = await matrixThreadAdapter.getThreadRoot(props.threadId, props.roomId)
    if (threadRoot) {
      rootMessage.value = {
        id: threadRoot.eventId,
        content: (threadRoot.body as { body?: string })?.body || '',
        senderName: threadRoot.senderId.split(':')[0].replace(/^@/, ''),
        senderAvatar: '',
        timestamp: threadRoot.timestamp,
        isOwn: threadRoot.senderId === currentUserId
      }
    }

    // Get thread messages
    const events = await matrixThreadAdapter.getThreadMessages(props.threadId, props.roomId, {
      limit: 50,
      dir: 'f'
    })

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
      if (!participants.has(sender)) {
        participants.set(sender, {
          userId: sender,
          displayName: sender.split(':')[0].replace(/^@/, ''),
          avatarUrl: ''
        })
      }

      messages.push({
        id: eventId,
        content: body,
        senderName: sender.split(':')[0].replace(/^@/, ''),
        senderAvatar: '',
        timestamp,
        isOwn: sender === currentUserId
      })
    }

    threadMessages.value = messages
    threadParticipants.value = Array.from(participants.values())
    hasMoreMessages.value = false

    logger.info('[MobileThread] Thread messages loaded:', {
      threadId: props.threadId,
      messageCount: messages.length
    })

    // Scroll to bottom
    await nextTick()
    scrollToBottom()
  } catch (err) {
    logger.error('[MobileThread] Failed to load thread messages:', err)
    error.value = '加载失败，请重试'
  } finally {
    loading.value = false
  }
}

const loadMoreMessages = async () => {
  isLoadingMore.value = true
  try {
    const userStore = useUserStore()
    const currentUserId = userStore.userInfo?.uid || ''
    const earliestMessage = threadMessages.value[0]
    const fromEventId = earliestMessage?.id || ''

    const events = await matrixThreadAdapter.getThreadMessages(props.threadId, props.roomId, {
      from: fromEventId,
      limit: 20,
      dir: 'b'
    })

    if (events.length === 0) {
      hasMoreMessages.value = false
      return
    }

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
        isOwn: sender === currentUserId
      })
    }

    threadMessages.value = [...moreMessages, ...threadMessages.value]
    hasMoreMessages.value = events.length >= 20
  } catch (err) {
    logger.error('[MobileThread] Failed to load more messages:', err)
    message.error('加载更多失败')
  } finally {
    isLoadingMore.value = false
  }
}

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

const sendReply = async () => {
  const content = replyContent.value.trim()
  if (!content) {
    message.warning('请输入回复内容')
    return
  }

  sending.value = true

  try {
    const userStore = useUserStore()
    const currentUserId = userStore.userInfo?.uid || ''

    const eventId = await matrixThreadAdapter.sendThreadReply(props.threadId, props.roomId, 'm.text', { text: content })

    const newMessage: ThreadMessage = {
      id: eventId,
      content,
      senderName: currentUserId.split(':')[0].replace(/^@/, ''),
      senderAvatar: '',
      timestamp: Date.now(),
      isOwn: true
    }

    threadMessages.value.push(newMessage)
    emit('message-replied', newMessage)
    replyContent.value = ''
    replyingTo.value = null

    message.success('回复已发送')
    scrollToBottom()
  } catch (err) {
    logger.error('[MobileThread] Failed to send reply:', err)
    message.error('发送失败，请重试')
  } finally {
    sending.value = false
  }
}

const cancelReply = () => {
  replyingTo.value = null
}

// Watch for auto-expand changes
watch(
  () => props.autoExpand,
  (newValue) => {
    if (newValue && !isExpanded.value) {
      expandThread()
    }
  }
)
</script>

<style scoped lang="scss">
.mobile-message-thread {
  margin: 8px 0;
}

.thread-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;

  &:active {
    background: var(--item-hover-bg);
  }

  .thread-info {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;

    .thread-icon {
      color: var(--primary-color);
      flex-shrink: 0;
    }

    .thread-preview {
      font-size: 14px;
      color: var(--text-color-1);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .reply-count {
      font-size: 12px;
      color: var(--text-color-3);
      flex-shrink: 0;
    }
  }

  .thread-participants {
    flex-shrink: 0;

    .avatar-stack {
      display: flex;
      align-items: center;

      .participant-avatar {
        border: 2px solid var(--card-color);
        margin-left: -8px;

        &:first-child {
          margin-left: 0;
        }
      }

      .more-count {
        font-size: 12px;
        color: var(--text-color-3);
        margin-left: 4px;
      }
    }
  }

  .expand-icon {
    color: var(--text-color-3);
    flex-shrink: 0;
  }
}

.thread-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;

    .thread-icon {
      color: var(--primary-color);
    }

    .thread-title {
      h4 {
        margin: 0;
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
  padding: 12px;
  background: rgba(var(--hula-success-rgb), 0.05);
  border-radius: 8px;
  margin-bottom: 12px;

  .root-message {
    display: flex;
    gap: 10px;

    .message-content {
      flex: 1;
      min-width: 0;

      .message-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;

        .sender-name {
          font-weight: 600;
          font-size: 14px;
          color: var(--text-color-1);
        }

        .message-time {
          font-size: 12px;
          color: var(--text-color-3);
        }
      }

      .message-body {
        .message-text {
          font-size: 14px;
          color: var(--text-color-1);
          line-height: 1.5;
          margin-bottom: 8px;
        }
      }
    }
  }
}

.thread-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  min-height: 200px;
  max-height: calc(90vh - 300px);
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  gap: 12px;

  p {
    color: var(--text-color-2);
    margin: 0;
  }
}

.load-more {
  text-align: center;
  margin-bottom: 12px;
}

.thread-message {
  display: flex;
  gap: 10px;
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
    min-width: 0;

    .message-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;

      .sender-name {
        font-weight: 600;
        font-size: 13px;
        color: var(--text-color-1);
      }

      .message-time {
        font-size: 11px;
        color: var(--text-color-3);
      }
    }

    .message-body {
      background: var(--bg-color);
      padding: 10px 12px;
      border-radius: 12px;
      border-top-left-radius: 4px;

      .message-text {
        font-size: 14px;
        color: var(--text-color-1);
        line-height: 1.5;
        margin-bottom: 6px;
      }
    }
  }

  &.is-own .message-body {
    background: var(--primary-color);
    color: white;
    border-radius: 12px;
    border-top-right-radius: 4px;

    .message-text {
      color: white;
    }
  }
}

.reply-input-section {
  padding: 12px;
  border-top: 1px solid var(--divider-color);
  background: var(--bg-color);
}

.replying-to-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--item-hover-bg);
  border-radius: 8px;
  margin-bottom: 8px;

  .reply-preview {
    flex: 1;
    min-width: 0;

    .reply-label {
      font-size: 12px;
      color: var(--text-color-3);
    }

    .reply-content {
      font-size: 13px;
      color: var(--text-color-1);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

.input-wrapper {
  display: flex;
  gap: 8px;
  align-items: flex-end;

  .send-button {
    flex-shrink: 0;
  }
}

// Touch-friendly sizing
@media (pointer: coarse) {
  .thread-trigger,
  .thread-message {
    min-touch-target: 44px;
  }
}
</style>
