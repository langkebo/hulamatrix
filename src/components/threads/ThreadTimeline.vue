<!--
  Thread Timeline View

  Display thread replies using Matrix SDK's native thread support.
  Uses room.getThread() to access thread timeline.

  SDK Integration:
  - room.getThread() - Get thread object
  - thread.liveTimeline - Thread events
  - client.sendMessage() with m.relates_to - Reply to thread
-->
<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { NCard, NSpin, NButton, NSpace, NAvatar, NTooltip, NEmpty } from 'naive-ui'
import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'

// Type definitions for Matrix events
interface MatrixEvent {
  getType?: () => string
  type?: string
  getContent?: () => { body?: string }
  content?: { body?: string }
  getSender?: () => string
  sender?: string
  getTs?: () => number
  origin_server_ts?: number
  getId?: () => string
  event_id?: string
}

interface Props {
  roomId: string
  rootEventId: string
  inline?: boolean
  maxVisible?: number
}

const props = withDefaults(defineProps<Props>(), {
  inline: false,
  maxVisible: undefined
})

const emit = defineEmits<{
  replyToThread: [threadRootId: string, content: string]
  navigateToMessage: [eventId: string]
}>()

// State
const loading = ref(true)
const threadEvents = ref<MatrixEvent[]>([])
const threadRoot = ref<MatrixEvent | null>(null)
const participantIds = ref<string[]>([])
const isExpanded = ref(!props.inline)
const replyCount = ref(0)

// Computed
const visibleEvents = computed(() => {
  if (!props.maxVisible || isExpanded.value) {
    return threadEvents.value
  }
  return threadEvents.value.slice(0, props.maxVisible)
})

const showExpandButton = computed(() => {
  return props.inline && props.maxVisible && threadEvents.value.length > props.maxVisible && !isExpanded.value
})

const hasMore = computed(() => {
  return !isExpanded.value && threadEvents.value.length > (props.maxVisible || 0)
})

/**
 * Load thread data using SDK's native thread support
 */
async function loadThread() {
  loading.value = true

  try {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    const getRoomMethod = client.getRoom as ((roomId: string) => Record<string, unknown> | null) | undefined
    const room = getRoomMethod?.(props.roomId)
    if (!room) {
      throw new Error(`Room not found: ${props.roomId}`)
    }

    logger.info('[ThreadTimeline] Loading thread:', {
      roomId: props.roomId,
      rootEventId: props.rootEventId
    })

    // Use SDK's native getThread() method
    const getThreadMethod = room.getThread as (() => { findThreadForEvent?: (eventId: string) => unknown }) | undefined
    const thread = getThreadMethod?.()?.findThreadForEvent?.(props.rootEventId) as
      | { rootEvent?: unknown; liveTimeline?: { getEvents?: () => unknown[] } }
      | undefined

    if (!thread) {
      logger.warn('[ThreadTimeline] Thread not found for event:', props.rootEventId)
      // Fall back to loading just the root event
      const findEventByIdMethod = room.findEventById as ((eventId: string) => unknown) | undefined
      const rootEvent = findEventByIdMethod?.(props.rootEventId)
      if (rootEvent) {
        threadRoot.value = rootEvent
      }
      return
    }

    // Get thread root event
    threadRoot.value = (thread.rootEvent as MatrixEvent) || null

    // Get thread timeline (replies)
    const timeline = thread.liveTimeline
    if (timeline) {
      const events = (timeline.getEvents ? timeline.getEvents() : []) as MatrixEvent[]

      // Filter for message events only
      threadEvents.value = events.filter((event: MatrixEvent) => {
        const type = event.getType ? event.getType() : event.type
        return type === 'm.room.message'
      })

      // Get reply count
      replyCount.value = threadEvents.value.length

      // Get participant user IDs
      const participants = new Set<string>()
      threadEvents.value.forEach((event: MatrixEvent) => {
        const sender = event.getSender ? event.getSender() : event.sender
        if (sender) participants.add(sender)
      })
      participantIds.value = Array.from(participants)

      logger.info('[ThreadTimeline] Thread loaded:', {
        replyCount: replyCount.value,
        participantCount: participantIds.value.length
      })
    }
  } catch (error) {
    logger.error('[ThreadTimeline] Failed to load thread:', error)
  } finally {
    loading.value = false
  }
}

/**
 * Get display name for user
 */
function getDisplayName(userId: string): string {
  // Remove @ and :server for cleaner display
  return userId.replace(/^@/, '').split(':')[0]
}

/**
 * Get avatar URL
 */
function getAvatarUrl(userId: string): string {
  const client = matrixClientService.getClient()
  if (!client) return ''

  const getRoomMethod = client.getRoom as ((roomId: string) => Record<string, unknown> | null) | undefined
  const room = getRoomMethod?.(props.roomId)
  if (!room) return ''

  const getMemberMethod = room.getMember as ((userId: string) => Record<string, unknown> | undefined) | undefined
  const member = getMemberMethod?.(userId)
  if (!member) return ''

  const avatarUrl = (
    member.getAvatarUrl as (
      baseUrl: string,
      width: number,
      height: number,
      resizeMethod: string,
      allowDefault: boolean,
      allowDirectLinks: boolean
    ) => string | undefined
  )?.(client.baseUrl as string, 32, 32, 'scale', false, true)

  return avatarUrl || ''
}

/**
 * Extract message content
 */
function getMessageContent(event: MatrixEvent): string {
  const content = event.getContent ? event.getContent() : event.content
  return content?.body || ''
}

/**
 * Format timestamp
 */
function formatTimestamp(event: MatrixEvent): string {
  const ts = event.getTs ? event.getTs() : event.origin_server_ts
  if (!ts) return ''

  const date = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))

  if (diffMins < 1) return 'now'
  if (diffMins < 60) return `${diffMins}m`
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`
  return date.toLocaleDateString()
}

/**
 * Handle click on event (navigate to it)
 */
function handleEventClick(event: MatrixEvent) {
  const eventId = event.getId ? event.getId() : event.event_id || ''
  if (!eventId) return
  emit('navigateToMessage', eventId)
}

/**
 * Reply to thread
 */
function handleReply() {
  emit('replyToThread', props.rootEventId, '')
}

/**
 * Expand/collapse thread
 */
function toggleExpanded() {
  isExpanded.value = !isExpanded.value
}

// Lifecycle
onMounted(() => {
  loadThread()
})

// Watch for prop changes
watch(
  () => [props.roomId, props.rootEventId],
  () => {
    loadThread()
  },
  { immediate: true }
)
</script>

<template>
  <div v-if="loading" class="thread-timeline--loading">
    <NSpin size="small" />
  </div>

  <div v-else-if="threadRoot || threadEvents.length > 0" class="thread-timeline">
    <!-- Thread Header -->
    <div class="thread-timeline__header">
      <div class="thread-info">
        <span class="reply-count">{{ replyCount }} {{ replyCount === 1 ? 'reply' : 'replies' }}</span>
        <span v-if="participantIds.length > 0" class="participants">
          from {{ participantIds.length }} {{ participantIds.length === 1 ? 'person' : 'people' }}
        </span>
      </div>

      <!-- Avatar stack for participants -->
      <div v-if="participantIds.length > 0" class="participant-avatars">
        <NTooltip v-for="userId in participantIds.slice(0, 3)" :key="userId">
          <template #trigger>
            <NAvatar :src="getAvatarUrl(userId)" :size="24" round class="participant-avatar">
              {{ getDisplayName(userId).charAt(0).toUpperCase() }}
            </NAvatar>
          </template>
          {{ getDisplayName(userId) }}
        </NTooltip>
        <div v-if="participantIds.length > 3" class="more-avatars">+{{ participantIds.length - 3 }}</div>
      </div>
    </div>

    <!-- Thread Messages -->
    <div class="thread-timeline__messages">
      <!-- Thread Root (if available) -->
      <div v-if="threadRoot" class="thread-root" @click="handleEventClick(threadRoot)">
        <div class="message message--root">
          <div class="message__content">
            {{ getMessageContent(threadRoot) }}
          </div>
          <div class="message__meta">
            {{ formatTimestamp(threadRoot) }}
          </div>
        </div>
      </div>

      <!-- Replies -->
      <div
        v-for="event in visibleEvents"
        :key="event.getId?.() || event.event_id || ''"
        class="thread-reply"
        @click="handleEventClick(event)">
        <div class="message message--reply">
          <div class="message__header">
            <span class="message__sender">
              {{ getDisplayName(event.getSender?.() || event.sender || '') }}
            </span>
            <span class="message__time">
              {{ formatTimestamp(event) }}
            </span>
          </div>
          <div class="message__content">
            {{ getMessageContent(event) }}
          </div>
        </div>
      </div>

      <!-- Expand Button -->
      <div v-if="showExpandButton" class="thread-expand">
        <NButton text @click="toggleExpanded">
          {{ hasMore ? `Show all ${replyCount} replies` : 'Show less' }}
        </NButton>
      </div>
    </div>

    <!-- Reply Action -->
    <div v-if="!inline" class="thread-timeline__actions">
      <NButton size="small" type="primary" @click="handleReply">Reply to Thread</NButton>
    </div>
  </div>

  <!-- Empty State -->
  <NEmpty v-else description="No thread found" size="small" />
</template>

<style scoped>
.thread-timeline--loading {
  display: flex;
  justify-content: center;
  padding: 16px;
}

.thread-timeline {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  background: var(--hula-brand-primary);
  border-radius: 8px;
}

.thread-timeline__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.thread-info {
  display: flex;
  gap: 8px;
  font-size: 13px;
  color: #666;
}

.reply-count {
  font-weight: 500;
}

.participants {
  color: #999;
}

.participant-avatars {
  display: flex;
  align-items: center;
}

.participant-avatar {
  margin-left: -8px;
  border: 2px solid var(--hula-brand-primary);
  cursor: pointer;
}

.participant-avatar:first-child {
  margin-left: 0;
}

.more-avatars {
  margin-left: 4px;
  font-size: 11px;
  color: #999;
  background: #fff;
  border-radius: 12px;
  padding: 2px 6px;
}

.thread-timeline__messages {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.thread-root,
.thread-reply {
  cursor: pointer;
  transition: background-color 0.2s;
  border-radius: 4px;
  padding: 4px;
}

.thread-root:hover,
.thread-reply:hover {
  background: rgba(0, 0, 0, 0.04);
}

.message {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.message--root {
  opacity: 0.7;
  font-size: 13px;
}

.message--reply {
  font-size: 14px;
}

.message__header {
  display: flex;
  gap: 8px;
  align-items: center;
}

.message__sender {
  font-weight: 500;
  font-size: 12px;
  color: #666;
}

.message__time {
  font-size: 11px;
  color: #999;
}

.message__content {
  color: #333;
  line-height: 1.4;
  word-break: break-word;
}

.message__meta {
  font-size: 11px;
  color: #999;
}

.thread-expand {
  display: flex;
  justify-content: center;
  padding: 8px 0;
}

.thread-timeline__actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
  border-top: 1px solid var(--hula-brand-primary);
}

/* Inline mode */
.thread-timeline--inline {
  padding: 8px;
  background: transparent;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .thread-timeline {
    background: var(--hula-brand-primary);
  }

  .message__sender {
    color: #aaa;
  }

  .message__content {
    color: #eee;
  }

  .thread-root:hover,
  .thread-reply:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .thread-timeline__actions {
    border-top-color: #444;
  }

  .participant-avatar {
    border-color: var(--hula-brand-primary);
  }

  .more-avatars {
    background: #333;
  }
}
</style>
