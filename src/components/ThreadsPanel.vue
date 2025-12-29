<!--
  Threads Panel

  Display all threads in the current room using Matrix SDK's
  native thread support.

  SDK Integration:
  - room.getThread() - Get thread collection
  - thread.liveTimeline - Thread timeline
-->
<template>
  <div class="threads-panel">
    <!-- Header -->
    <div class="threads-panel__header">
      <h3 class="title">Threads</h3>
      <NSpace align="center" :size="8">
        <NButton secondary size="small" :disabled="loading" @click="refreshThreads">Refresh</NButton>
      </NSpace>
    </div>

    <!-- Threads List -->
    <div class="threads-panel__list">
      <NSpin :show="loading">
        <!-- Empty State -->
        <NEmpty v-if="!hasThreads && !loading" description="No threads in this room" size="small">
          <template #icon>
            <span class="empty-icon">💬</span>
          </template>
        </NEmpty>

        <!-- Thread Cards -->
        <div v-else class="thread-list">
          <NCard
            v-for="thread in threads"
            :key="thread.rootEventId"
            class="thread-card"
            hoverable
            size="small"
            @click="openThread(thread)">
            <!-- Thread Root Message -->
            <div class="thread-card__root">
              <div class="message-content">
                {{ thread.rootContent }}
              </div>
            </div>

            <!-- Thread Stats -->
            <div class="thread-card__stats">
              <NSpace :size="12">
                <span class="stat">
                  <span class="stat-icon">💬</span>
                  {{ thread.replyCount }} {{ thread.replyCount === 1 ? 'reply' : 'replies' }}
                </span>
                <span class="stat">
                  <span class="stat-icon">👥</span>
                  {{ thread.participantCount }} {{ thread.participantCount === 1 ? 'participant' : 'participants' }}
                </span>
                <span class="stat">
                  <span class="stat-icon">🕐</span>
                  {{ formatTime(thread.latestTimestamp) }}
                </span>
              </NSpace>
            </div>

            <!-- Thread Participants -->
            <div v-if="thread.participants.length > 0" class="thread-card__participants">
              <NSpace :size="-8">
                <NTooltip v-for="userId in thread.participants.slice(0, 4)" :key="userId">
                  <template #trigger>
                    <NAvatar :src="getAvatarUrl(userId)" :size="24" round class="participant-avatar">
                      {{ getDisplayName(userId).charAt(0).toUpperCase() }}
                    </NAvatar>
                  </template>
                  {{ getDisplayName(userId) }}
                </NTooltip>
                <div v-if="thread.participants.length > 4" class="more-avatars">
                  +{{ thread.participants.length - 4 }}
                </div>
              </NSpace>
            </div>
          </NCard>
        </div>
      </NSpin>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { NCard, NSpin, NButton, NSpace, NAvatar, NTooltip, NEmpty, useMessage } from 'naive-ui'
import { matrixClientService } from '@/services/matrixClientService'
import { useGlobalStore } from '@/stores/global'
import { logger } from '@/utils/logger'

interface ThreadInfo {
  rootEventId: string
  roomId: string
  rootContent: string
  replyCount: number
  participantCount: number
  participants: string[]
  latestTimestamp: number
}

const message = useMessage()
const globalStore = useGlobalStore()

// State
const loading = ref(false)
const threads = ref<ThreadInfo[]>([])

// Computed
const currentRoomId = computed(() => globalStore.currentSessionRoomId)
const hasThreads = computed(() => threads.value.length > 0)

/**
 * Load all threads in the current room using SDK's native thread support
 */
async function loadThreads() {
  const roomId = currentRoomId.value
  if (!roomId) {
    threads.value = []
    return
  }

  loading.value = true

  try {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    const room = client.getRoom(roomId)
    if (!room) {
      logger.warn('[ThreadsPanel] Room not found:', roomId)
      threads.value = []
      return
    }

    logger.info('[ThreadsPanel] Loading threads for room:', roomId)

    // Get all events in the room timeline
    const timeline = room.getLiveTimeline?.()
    const events = timeline?.getEvents ? timeline.getEvents() : []

    // Collect unique threads
    const threadMap = new Map<string, ThreadInfo>()

    for (const event of events) {
      const eventId = event.getId ? event.getId() : event.event_id
      if (!eventId) continue

      // Get thread for this event
      const thread = room.getThread()?.findThreadForEvent(eventId)

      if (thread && thread.rootEvent) {
        const rootEventId = thread.rootEvent.getId ? thread.rootEvent.getId() : thread.rootEvent.event_id

        // Skip if we already have this thread
        if (threadMap.has(rootEventId)) continue

        // Get thread timeline
        const threadTimeline = thread.liveTimeline
        const threadEvents = threadTimeline?.getEvents ? threadTimeline.getEvents() : []

        // Get unique participants
        const participants = new Set<string>()
        threadEvents.forEach((e: any) => {
          const sender = e.getSender ? e.getSender() : e.sender
          if (sender) participants.add(sender)
        })

        // Get latest timestamp
        let latestTimestamp = 0
        threadEvents.forEach((e: any) => {
          const ts = e.getTs ? e.getTs() : e.origin_server_ts
          if (ts > latestTimestamp) latestTimestamp = ts
        })

        // Get root content
        const rootContent = extractContent(thread.rootEvent)

        threadMap.set(rootEventId, {
          rootEventId,
          roomId,
          rootContent,
          replyCount: threadEvents.length,
          participantCount: participants.size,
          participants: Array.from(participants),
          latestTimestamp
        })
      }
    }

    threads.value = Array.from(threadMap.values()).sort((a, b) => b.latestTimestamp - a.latestTimestamp)

    logger.info('[ThreadsPanel] Threads loaded:', {
      count: threads.value.length
    })
  } catch (error) {
    logger.error('[ThreadsPanel] Failed to load threads:', error)
    message.error('Failed to load threads')
  } finally {
    loading.value = false
  }
}

/**
 * Extract message content from event
 */
function extractContent(event: any): string {
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

  const room = client.getRoom(roomId)
  if (!room) return ''

  const member = room.getMember?.(userId)
  if (!member) return ''

  return member.getAvatarUrl?.(client.baseUrl, 32, 32, 'scale', false, true) || ''
}

/**
 * Format timestamp
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))

  if (diffMins < 1) return 'now'
  if (diffMins < 60) return `${diffMins}m`
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`
  if (diffMins < 10080) return `${Math.floor(diffMins / 1440)}d`
  return date.toLocaleDateString()
}

/**
 * Refresh threads list
 */
function refreshThreads() {
  loadThreads()
}

/**
 * Open a thread
 */
function openThread(thread: ThreadInfo) {
  // TODO: Implement thread detail view
  logger.info('[ThreadsPanel] Opening thread:', thread.rootEventId)
  message.info('Thread detail view coming soon')
}

// Watch for room changes
watch(currentRoomId, () => {
  loadThreads()
})

// Lifecycle
onMounted(() => {
  loadThreads()
})
</script>

<style scoped>
.threads-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
}

.threads-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: #333;
}

.threads-panel__list {
  flex: 1;
  overflow-y: auto;
}

.thread-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.thread-card {
  cursor: pointer;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}

.thread-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.thread-card__root {
  margin-bottom: 12px;
}

.message-content {
  font-size: 14px;
  color: #333;
  line-height: 1.5;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.thread-card__stats {
  margin-bottom: 8px;
}

.stat {
  font-size: 12px;
  color: #666;
  display: flex;
  align-items: center;
  gap: 4px;
}

.stat-icon {
  font-size: 14px;
}

.thread-card__participants {
  display: flex;
  align-items: center;
}

.participant-avatar {
  border: 2px solid #fff;
  margin-left: -8px;
}

.participant-avatar:first-child {
  margin-left: 0;
}

.more-avatars {
  margin-left: 4px;
  font-size: 11px;
  color: #999;
  background: #f5f5f5;
  border-radius: 12px;
  padding: 2px 6px;
}

.empty-icon {
  font-size: 48px;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .title {
    color: #eee;
  }

  .message-content {
    color: #eee;
  }

  .stat {
    color: #aaa;
  }

  .participant-avatar {
    border-color: #fff;
  }

  .more-avatars {
    background: #333;
  }
}
</style>
