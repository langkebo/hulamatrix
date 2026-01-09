<!--
  Thread Detail View

  Display detailed view of a single thread with all replies.
  Uses Matrix SDK's native thread support.

  SDK Integration:
  - room.getThread().findThreadForEvent() - Get thread by root event
  - thread.liveTimeline.getEvents() - Get thread messages
-->
<template>
  <div class="thread-detail">
    <!-- Header -->
    <div class="thread-detail__header">
      <div class="header-content">
        <h2 class="title">Thread</h2>
        <div class="actions">
          <NButton secondary size="small" @click="goBack">← Back</NButton>
          <NButton secondary size="small" :disabled="loading" @click="refreshThread">Refresh</NButton>
        </div>
      </div>
    </div>

    <!-- Thread Content -->
    <div class="thread-detail__content">
      <NSpin :show="loading">
        <!-- Empty State -->
        <NEmpty v-if="!hasThread && !loading" description="Thread not found">
          <template #icon>
            <span class="empty-icon">💬</span>
          </template>
          <template #extra>
            <NButton size="small" @click="goBack">Go Back</NButton>
          </template>
        </NEmpty>

        <!-- Thread Messages -->
        <div v-else class="thread-messages">
          <!-- Thread Root -->
          <div v-if="threadRoot" class="message message--root">
            <div class="message__avatar">
              <NAvatar :src="getAvatarUrl(threadRoot.sender)" :size="40" round>
                {{ getDisplayName(threadRoot.sender).charAt(0).toUpperCase() }}
              </NAvatar>
            </div>
            <div class="message__body">
              <div class="message__header">
                <span class="message__sender">{{ getDisplayName(threadRoot.sender) }}</span>
                <span class="message__time">{{ formatTimestamp(threadRoot.timestamp) }}</span>
              </div>
              <div class="message__content">{{ threadRoot.content }}</div>
              <div class="message__badge">Thread Root</div>
            </div>
          </div>

          <!-- Thread Divider -->
          <div class="thread-divider">
            <span class="thread-divider__text">{{ replyCount }} {{ replyCount === 1 ? 'Reply' : 'Replies' }}</span>
          </div>

          <!-- Thread Replies -->
          <div v-for="reply in replies" :key="reply.eventId" class="message message--reply">
            <div class="message__avatar">
              <NAvatar :src="getAvatarUrl(reply.sender)" :size="36" round>
                {{ getDisplayName(reply.sender).charAt(0).toUpperCase() }}
              </NAvatar>
            </div>
            <div class="message__body">
              <div class="message__header">
                <span class="message__sender">{{ getDisplayName(reply.sender) }}</span>
                <span class="message__time">{{ formatTimestamp(reply.timestamp) }}</span>
              </div>
              <div class="message__content">{{ reply.content }}</div>
            </div>
          </div>

          <!-- Load More -->
          <div v-if="hasMore" class="load-more">
            <NButton secondary :loading="loadingMore" @click="loadMoreReplies">Load More Replies</NButton>
          </div>
        </div>
      </NSpin>
    </div>

    <!-- Reply Input -->
    <div v-if="hasThread" class="thread-detail__input">
      <NInput
        v-model:value="replyText"
        type="textarea"
        placeholder="Reply to thread..."
        :rows="2"
        @keyup.ctrl.enter="sendReply"
        @keyup.meta.enter="sendReply" />
      <div class="input-actions">
        <NSpace justify="space-between">
          <span class="hint">
            <kbd>Ctrl</kbd>
            +
            <kbd>Enter</kbd>
            to send
          </span>
          <NButton type="primary" :disabled="!replyText.trim()" :loading="sending" @click="sendReply">
            Send Reply
          </NButton>
        </NSpace>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { NButton, NInput, NSpace, NAvatar, NSpin, NEmpty, useMessage } from 'naive-ui'
import { useRoute, useRouter } from 'vue-router'
import { matrixClientService } from '@/integrations/matrix/client'
import { useGlobalStore } from '@/stores/global'
import { logger } from '@/utils/logger'
import { getRoom, sendMessage } from '@/utils/matrixClientUtils'
import type { MatrixEventLike } from '@/types/matrix'

/** Extended Matrix event type with raw properties */
interface MatrixEventExtended extends MatrixEventLike {
  sender?: string
  origin_server_ts?: number
  event_id?: string
  type?: string
  content?: { body?: string }
}

interface Message {
  eventId: string
  sender: string
  content: string
  timestamp: number
}

const route = useRoute()
const router = useRouter()
const message = useMessage()
const globalStore = useGlobalStore()

// State
const loading = ref(false)
const loadingMore = ref(false)
const sending = ref(false)
const threadRoot = ref<Message | null>(null)
const replies = ref<Message[]>([])
const replyText = ref('')
const hasMore = ref(false)
const currentThread = ref<unknown>(null)
const paginated = ref(false)

// Computed
const threadId = computed(() => route.query.threadId as string)
const currentRoomId = computed(() => globalStore.currentSessionRoomId)
const hasThread = computed(() => !!threadRoot.value)
const replyCount = computed(() => replies.value.length)

/**
 * Load thread data using SDK's native thread support
 */
async function loadThread() {
  const roomId = currentRoomId.value
  const eventId = threadId.value

  if (!roomId || !eventId) {
    logger.warn('[ThreadDetail] Missing roomId or threadId')
    return
  }

  loading.value = true

  try {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    const room = getRoom(client, roomId) as {
      getThread?: () => { findThreadForEvent?: (eventId: string) => unknown }
    } | null
    if (!room) {
      throw new Error(`Room not found: ${roomId}`)
    }

    logger.info('[ThreadDetail] Loading thread:', { roomId, eventId })

    // Use SDK's native getThread() method
    const thread = room.getThread?.()?.findThreadForEvent?.(eventId) as
      | { rootEvent?: unknown; liveTimeline?: { getEvents?: () => unknown[]; paginate?: () => Promise<unknown> } }
      | undefined

    if (!thread) {
      logger.warn('[ThreadDetail] Thread not found:', eventId)
      return
    }

    // Store thread reference for pagination
    currentThread.value = thread
    paginated.value = false

    // Get thread root
    const rootEvent = thread.rootEvent as Record<string, unknown> | undefined
    if (rootEvent) {
      const getIdMethod = rootEvent.getId as (() => string) | undefined
      const getSenderMethod = rootEvent.getSender as (() => string) | undefined
      const getTsMethod = rootEvent.getTs as (() => number) | undefined

      threadRoot.value = {
        eventId: getIdMethod ? getIdMethod() : (rootEvent.event_id as string),
        sender: getSenderMethod ? getSenderMethod() : (rootEvent.sender as string),
        content: extractContent(rootEvent),
        timestamp: getTsMethod ? getTsMethod() : (rootEvent.origin_server_ts as number | undefined) || Date.now()
      }
    }

    // Get thread timeline (replies)
    const timeline = thread.liveTimeline
    if (timeline) {
      const events = timeline.getEvents ? timeline.getEvents() : []

      replies.value = events
        .filter((event: unknown): event is MatrixEventExtended => {
          const evt = event as MatrixEventExtended
          const type = evt.getType ? evt.getType() : evt.type
          return type === 'm.room.message'
        })
        .map((event: MatrixEventExtended): Message => {
          const eventId = event.getId ? event.getId() : event.event_id
          const sender = event.getSender ? event.getSender() : event.sender
          const ts = event.getTs ? event.getTs() : event.origin_server_ts

          return {
            eventId: eventId || '',
            sender: sender || '',
            content: extractContent(event),
            timestamp: ts || Date.now()
          }
        })

      // Check if there are more events (pagination)
      // If timeline has a paginate method, we can load more
      const timelineWithPaginate = timeline as unknown as { paginate?: () => Promise<unknown> }
      hasMore.value = !!timelineWithPaginate.paginate && !paginated.value
    }

    logger.info('[ThreadDetail] Thread loaded:', {
      replyCount: replies.value.length
    })
  } catch (error) {
    logger.error('[ThreadDetail] Failed to load thread:', error)
    message.error('Failed to load thread')
  } finally {
    loading.value = false
  }
}

/**
 * Extract message content from event
 */
function extractContent(event: MatrixEventExtended): string {
  const content = event.getContent ? event.getContent() : event.content
  return content?.body || '*Empty message*'
}

/**
 * Get display name for user
 */
function getDisplayName(userId: string): string {
  return userId.replace(/^@/, '').split(':')[0]
}

/**
 * Get avatar URL
 */
function getAvatarUrl(userId: string): string {
  const roomId = currentRoomId.value
  if (!roomId) return ''

  const client = matrixClientService.getClient()
  if (!client) return ''

  const room = getRoom(client, roomId) as {
    getMember?: (userId: string) => {
      getAvatarUrl?: (
        baseUrl: string,
        w: number,
        h: number,
        method: string,
        allowDirectLinks: boolean,
        fallback: boolean
      ) => string
    } | null
  } | null
  if (!room) return ''

  const member = room.getMember?.(userId)
  if (!member) return ''

  return member.getAvatarUrl?.(client.baseUrl as string, 40, 40, 'scale', false, true) || ''
}

/**
 * Format timestamp
 */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } else if (diffDays === 1) {
    return 'Yesterday at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } else if (diffDays < 7) {
    return (
      date.toLocaleDateString('en', { weekday: 'short' }) +
      ' ' +
      date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    )
  } else {
    return date.toLocaleDateString()
  }
}

/**
 * Load more replies (pagination)
 */
async function loadMoreReplies() {
  const roomId = currentRoomId.value
  if (!roomId || loadingMore.value || !currentThread.value) return

  loadingMore.value = true

  try {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    const thread = currentThread.value as {
      liveTimeline?: { paginate?: () => Promise<unknown>; getEvents?: () => unknown[] }
    }

    if (!thread.liveTimeline) {
      message.warning('Thread timeline not available')
      return
    }

    logger.info('[ThreadDetail] Paginating thread for more replies')

    // Try to paginate using SDK's paginate method
    const paginateMethod = thread.liveTimeline.paginate
    if (paginateMethod) {
      await paginateMethod()
      paginated.value = true

      // Get the updated events list after pagination
      const events = thread.liveTimeline.getEvents ? thread.liveTimeline.getEvents() : []

      // Filter and map new events (get all events to ensure we have them all)
      const newReplies = events
        .filter((event: unknown): event is MatrixEventExtended => {
          const evt = event as MatrixEventExtended
          const type = evt.getType ? evt.getType() : evt.type
          return type === 'm.room.message'
        })
        .map((event: MatrixEventExtended): Message => {
          const eventId = event.getId ? event.getId() : event.event_id
          const sender = event.getSender ? event.getSender() : event.sender
          const ts = event.getTs ? event.getTs() : event.origin_server_ts

          return {
            eventId: eventId || '',
            sender: sender || '',
            content: extractContent(event),
            timestamp: ts || Date.now()
          }
        })

      // Merge replies, removing duplicates based on eventId
      const existingEventIds = new Set(replies.value.map((r) => r.eventId))
      const uniqueNewReplies = newReplies.filter((r) => !existingEventIds.has(r.eventId))

      replies.value = [...replies.value, ...uniqueNewReplies]

      // Update hasMore - if we successfully paginated once, there might be more
      // For now, assume one page of pagination
      hasMore.value = false

      logger.info('[ThreadDetail] Loaded more replies:', {
        newCount: uniqueNewReplies.length,
        total: replies.value.length
      })

      message.success(`Loaded ${uniqueNewReplies.length} more ${uniqueNewReplies.length === 1 ? 'reply' : 'replies'}`)
    } else {
      message.info('No more replies to load')
      hasMore.value = false
    }
  } catch (error) {
    logger.error('[ThreadDetail] Failed to load more replies:', error)
    message.error('Failed to load more replies')
  } finally {
    loadingMore.value = false
  }
}

/**
 * Send reply to thread
 */
async function sendReply() {
  if (!replyText.value.trim() || sending.value) return

  const roomId = currentRoomId.value
  const eventId = threadId.value

  if (!roomId || !eventId) return

  sending.value = true

  try {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    logger.info('[ThreadDetail] Sending thread reply:', { roomId, eventId, content: replyText.value })

    // Send message with thread relation
    await sendMessage(client, roomId, {
      msgtype: 'm.text',
      body: replyText.value,
      'm.relates_to': {
        'm.in_reply_to': {
          event_id: eventId
        },
        rel_type: 'm.thread'
      }
    })

    message.success('Reply sent')
    replyText.value = ''

    // Reload thread
    await loadThread()
  } catch (error) {
    logger.error('[ThreadDetail] Failed to send reply:', error)
    message.error('Failed to send reply')
  } finally {
    sending.value = false
  }
}

/**
 * Refresh thread
 */
function refreshThread() {
  loadThread()
}

/**
 * Go back to previous view
 */
function goBack() {
  router.back()
}

// Watch for route changes
watch(threadId, () => {
  if (threadId.value) {
    loadThread()
  }
})

// Lifecycle
onMounted(() => {
  loadThread()
})
</script>

<style scoped>
.thread-detail {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--hula-gray-100, var(--hula-brand-primary));
}

.thread-detail__header {
  padding: 16px;
  background: var(--hula-white, #fff);
  border-bottom: 1px solid var(--hula-gray-200, var(--hula-brand-primary));
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  color: #333;
}

.actions {
  display: flex;
  gap: 8px;
}

.thread-detail__content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.thread-messages {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 800px;
  margin: 0 auto;
}

.message {
  display: flex;
  gap: 12px;
}

.message__avatar {
  flex-shrink: 0;
}

.message__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.message__header {
  display: flex;
  gap: 8px;
  align-items: center;
}

.message__sender {
  font-weight: 500;
  font-size: 14px;
  color: #333;
}

.message__time {
  font-size: 12px;
  color: #999;
}

.message__content {
  font-size: 15px;
  color: #333;
  line-height: 1.5;
  word-break: break-word;
  white-space: pre-wrap;
}

.message--root {
  padding: 16px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.message__badge {
  align-self: flex-start;
  margin-top: 8px;
  padding: 4px 8px;
  background: var(--hula-brand-primary);
  color: var(--hula-brand-primary);
  font-size: 11px;
  font-weight: 500;
  border-radius: 4px;
  text-transform: uppercase;
}

.message--reply {
  padding: 12px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.thread-divider {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 0;
}

.thread-divider::before,
.thread-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--hula-gray-200, var(--hula-brand-primary));
}

.thread-divider__text {
  font-size: 13px;
  font-weight: 500;
  color: #999;
}

.load-more {
  display: flex;
  justify-content: center;
  padding: 16px 0;
}

.thread-detail__input {
  padding: 16px;
  background: #fff;
  border-top: 1px solid var(--hula-brand-primary);
}

.input-actions {
  margin-top: 8px;
}

.hint {
  font-size: 12px;
  color: #999;
  display: flex;
  align-items: center;
  gap: 4px;
}

.hint kbd {
  padding: 2px 6px;
  background: var(--hula-gray-100, var(--hula-brand-primary));
  border: 1px solid var(--hula-gray-200, var(--hula-brand-primary));
  border-radius: 4px;
  font-family: monospace;
  font-size: 11px;
}

.empty-icon {
  font-size: 64px;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .thread-detail {
    background: var(--hula-gray-900, var(--hula-brand-primary));
  }

  .thread-detail__header,
  .thread-detail__input {
    background: var(--hula-gray-800, var(--hula-brand-primary));
    border-color: #444;
  }

  .title,
  .message__sender {
    color: #eee;
  }

  .message__content {
    color: #eee;
  }

  .message--root,
  .message--reply {
    background: #333;
  }

  .message__badge {
    background: var(--hula-brand-primary);
    color: #fff;
  }

  .thread-divider::before,
  .thread-divider::after {
    background: #444;
  }

  .thread-divider__text {
    color: #666;
  }

  .hint {
    color: #666;
  }

  .hint kbd {
    background: #333;
    border-color: #444;
  }
}
</style>
