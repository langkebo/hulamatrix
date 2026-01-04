<!--
  Search Results Viewer

  Display and navigate Matrix message search results with context.
  Uses Matrix SDK's searchRoomMessages() method.

  SDK Integration:
  - client.searchRoomMessages() - Search messages
  - Client event navigation
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  NCard,
  NSpin,
  NInput,
  NButton,
  NSpace,
  NTag,
  NTooltip,
  NEmpty,
  NList,
  NListItem,
  NThing,
  useMessage
} from 'naive-ui'
import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'
import { searchRoomMessages } from '@/utils/matrixClientUtils'
import { sanitizeHtml } from '@/utils/htmlSanitizer'

// Type definitions for Matrix search results
interface MatrixSearchEvent {
  event_id: string
  room_id: string
  origin_server_ts?: number
  sender?: string
  user_id?: string
  content?: {
    body?: string
    [key: string]: unknown
  }
}

interface MatrixSearchResultItem {
  result: MatrixSearchEvent
  context?: {
    events_before?: MatrixSearchEvent[]
    events_after?: MatrixSearchEvent[]
  }
  highlights?: string[]
}

interface MessageSearchResult {
  eventId: string
  roomId: string
  timestamp: number
  sender: string
  content: string
  highlights?: string[]
  context?: {
    before?: MessageContext[]
    after?: MessageContext[]
  }
}

interface MessageContext {
  eventId: string
  content: string
  sender: string
  timestamp: number
}

interface Props {
  show: boolean
  roomId?: string
  initialQuery?: string
}

const props = withDefaults(defineProps<Props>(), {
  initialQuery: ''
})

const emit = defineEmits<{
  'update:show': [value: boolean]
  navigateToMessage: [roomId: string, eventId: string]
}>()

const message = useMessage()

// State
const loading = ref(false)
const searching = ref(false)
const searchQuery = ref(props.initialQuery || '')
const results = ref<MessageSearchResult[]>([])
const hasNext = ref(false)
const nextBatch = ref<string | undefined>(undefined)
const selectedResult = ref<MessageSearchResult | null>(null)
const loadingMore = ref(false)

// Computed
const hasResults = computed(() => results.value.length > 0)

/**
 * Perform message search using SDK
 */
async function performSearch() {
  if (!searchQuery.value.trim()) {
    message.warning('Please enter a search term')
    return
  }

  searching.value = true

  try {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    logger.info('[SearchResultsViewer] Searching messages:', {
      query: searchQuery.value,
      roomId: props.roomId
    })

    // Use SDK's searchRoomMessages
    const response = await (
      client.searchRoomMessages as (opts: { search_term: string; room_id?: string; limit?: number }) => Promise<{
        search_categories?: {
          room_events?: {
            results?: Array<{
              result: {
                event_id: string
                room_id: string
                origin_server_ts?: number
                sender?: string
                content?: Record<string, unknown>
              }
              context?: Record<string, unknown>
            }>
            next_batch?: string
          }
        }
      }>
    )({
      search_term: searchQuery.value,
      room_id: props.roomId,
      limit: 20
    })

    const searchResults = response.search_categories?.room_events?.results || []

    results.value = searchResults.map((item: MatrixSearchResultItem) => {
      const event = item.result
      const context = item.context

      return {
        eventId: event.event_id,
        roomId: event.room_id,
        timestamp: event.origin_server_ts || Date.now(),
        sender: event.sender || event.user_id || '',
        content: extractMessageContent(event),
        highlights: item.highlights || [],
        context: {
          before: transformContextEvents(context?.events_before || []),
          after: transformContextEvents(context?.events_after || [])
        }
      }
    })

    hasNext.value = !!response.search_categories?.room_events?.next_batch
    nextBatch.value = response.search_categories?.room_events?.next_batch

    logger.info('[SearchResultsViewer] Search complete:', {
      resultCount: results.value.length
    })

    if (results.value.length === 0) {
      message.info('No results found')
    }
  } catch (error) {
    logger.error('[SearchResultsViewer] Search failed:', error)
    message.error('Search failed')
  } finally {
    searching.value = false
  }
}

/**
 * Load more results
 */
async function loadMore() {
  if (!hasNext.value || loadingMore.value) return

  loadingMore.value = true

  try {
    const client = matrixClientService.getClient()
    if (!client) return

    const response = await (
      client.searchRoomMessages as (opts: {
        search_term: string
        room_id?: string
        limit?: number
        next_batch?: string
      }) => Promise<{
        search_categories?: {
          room_events?: {
            results?: Array<{
              result: { event_id: string; room_id: string; origin_server_ts?: number }
              context?: Record<string, unknown>
            }>
            next_batch?: string
          }
        }
      }>
    )({
      search_term: searchQuery.value,
      room_id: props.roomId,
      limit: 20,
      next_batch: nextBatch.value
    })

    const searchResults = response.search_categories?.room_events?.results || []

    const newResults = searchResults.map((item: MatrixSearchResultItem) => ({
      eventId: item.result.event_id,
      roomId: item.result.room_id,
      timestamp: item.result.origin_server_ts || Date.now(),
      sender: item.result.sender || item.result.user_id || '',
      content: extractMessageContent(item.result),
      highlights: item.highlights || []
    }))

    results.value.push(...newResults)
    hasNext.value = !!response.search_categories?.room_events?.next_batch
    nextBatch.value = response.search_categories?.room_events?.next_batch
  } catch (error) {
    logger.error('[SearchResultsViewer] Failed to load more:', error)
  } finally {
    loadingMore.value = false
  }
}

/**
 * Navigate to a message in the timeline
 */
function navigateToResult(result: MessageSearchResult) {
  logger.info('[SearchResultsViewer] Navigating to message:', {
    eventId: result.eventId,
    roomId: result.roomId
  })

  emit('navigateToMessage', result.roomId, result.eventId)
  closeViewer()
}

/**
 * View result details with context
 */
function viewResult(result: MessageSearchResult) {
  selectedResult.value = result
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
    return date.toLocaleTimeString()
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else if (diffDays < 7) {
    return date.toLocaleDateString('en', { weekday: 'short' })
  } else {
    return date.toLocaleDateString()
  }
}

/**
 * Get sender display name
 */
function getSenderName(sender: string): string {
  // Remove @ and :server suffix for cleaner display
  return sender.replace(/^@/, '').split(':')[0]
}

/**
 * Highlight search term in text
 */
function highlightText(text: string, highlights?: string[]): string {
  if (!highlights || highlights.length === 0) return sanitizeHtml(text)

  let highlighted = text
  highlights.forEach((hl) => {
    const regex = new RegExp(`(${hl})`, 'gi')
    highlighted = highlighted.replace(regex, '<mark>$1</mark>')
  })

  // Sanitize the highlighted HTML to prevent XSS attacks
  return sanitizeHtml(highlighted)
}

/**
 * Extract message content from event
 */
function extractMessageContent(event: MatrixSearchEvent): string {
  const content = event.content || {}
  return content.body || ''
}

/**
 * Transform context events
 */
function transformContextEvents(events: MatrixSearchEvent[]): MessageContext[] {
  return events.map((event) => ({
    eventId: event.event_id,
    content: extractMessageContent(event),
    sender: event.sender || event.user_id || '',
    timestamp: event.origin_server_ts || Date.now()
  }))
}

/**
 * Close viewer
 */
function closeViewer() {
  emit('update:show', false)
  results.value = []
  searchQuery.value = ''
}

// Watch for prop changes
watch(
  () => props.show,
  (show) => {
    if (show && props.initialQuery) {
      searchQuery.value = props.initialQuery
      performSearch()
    }
  }
)
</script>

<template>
  <div v-if="show" class="search-results-viewer">
    <!-- Search Bar -->
    <div class="search-bar">
      <NInput
        v-model:value="searchQuery"
        type="text"
        placeholder="Search messages..."
        clearable
        @keyup.enter="performSearch">
        <template #prefix>
          <span class="icon">🔍</span>
        </template>
        <template #suffix>
          <NButton secondary type="primary" :disabled="!searchQuery.trim()" :loading="searching" @click="performSearch">
            Search
          </NButton>
        </template>
      </NInput>
    </div>

    <!-- Results List -->
    <div class="results-list">
      <NSpin :show="searching">
        <!-- Empty State -->
        <NEmpty v-if="!hasResults && !searching" description="No messages found">
          <template #icon>
            <span class="empty-icon">🔍</span>
          </template>
        </NEmpty>

        <!-- Results -->
        <NList v-else hoverable clickable>
          <NListItem v-for="result in results" :key="result.eventId" @click="navigateToResult(result)">
            <NThing>
              <template #header>
                <NSpace align="center" :size="8">
                  <span class="sender">{{ getSenderName(result.sender) }}</span>
                  <span class="timestamp">{{ formatTimestamp(result.timestamp) }}</span>
                </NSpace>
              </template>

              <template #description>
                <div class="content" v-html="highlightText(result.content, result.highlights)" />
              </template>

              <template #footer>
                <NSpace :size="4">
                  <NTag v-if="result.context?.before" size="small" :bordered="false">
                    +{{ result.context.before.length }} before
                  </NTag>
                  <NTag v-if="result.context?.after" size="small" :bordered="false">
                    +{{ result.context.after.length }} after
                  </NTag>
                </NSpace>
              </template>
            </NThing>
          </NListItem>
        </NList>
      </NSpin>
    </div>

    <!-- Load More -->
    <div v-if="hasNext && hasResults" class="load-more">
      <NButton secondary :loading="loadingMore" @click="loadMore">Load More Results</NButton>
    </div>

    <!-- Result Detail Panel -->
    <NModal
      v-if:if="selectedResult"
      :show="!!selectedResult"
      preset="card"
      title="Message Context"
      :style="{ width: '700px' }"
      @update:show="selectedResult = null">
      <div v-if="selectedResult" class="result-detail">
        <!-- Context Before -->
        <div v-if="selectedResult.context?.before && selectedResult.context.before.length" class="context-section">
          <div class="context-label">Before:</div>
          <div class="context-messages">
            <div v-for="msg in selectedResult.context.before" :key="msg.eventId" class="context-message">
              <span class="msg-sender">{{ getSenderName(msg.sender) }}:</span>
              <span class="msg-content">{{ msg.content }}</span>
            </div>
          </div>
        </div>

        <!-- Main Message -->
        <div class="main-message">
          <div class="msg-header">
            <span class="msg-sender">{{ getSenderName(selectedResult.sender) }}</span>
            <span class="msg-time">{{ formatTimestamp(selectedResult.timestamp) }}</span>
          </div>
          <div class="msg-content">{{ selectedResult.content }}</div>
        </div>

        <!-- Context After -->
        <div v-if="selectedResult.context?.after && selectedResult.context.after.length" class="context-section">
          <div class="context-label">After:</div>
          <div class="context-messages">
            <div v-for="msg in selectedResult.context.after" :key="msg.eventId" class="context-message">
              <span class="msg-sender">{{ getSenderName(msg.sender) }}:</span>
              <span class="msg-content">{{ msg.content }}</span>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="detail-actions">
          <NButton type="primary" @click="navigateToResult(selectedResult)">Go to Message</NButton>
        </div>
      </div>
    </NModal>
  </div>
</template>

<style scoped>
.search-results-viewer {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  max-height: 80vh;
  overflow-y: auto;
}

.search-bar {
  position: sticky;
  top: 0;
  z-index: 10;
}

.results-list {
  min-height: 200px;
}

.sender {
  font-weight: 500;
  color: #666;
}

.timestamp {
  font-size: 12px;
  color: #999;
}

.content {
  font-size: 14px;
  color: #333;
  line-height: 1.5;
  word-break: break-word;
}

.content :deep(mark) {
  background-color: #ffeb3b;
  padding: 1px 2px;
  border-radius: 2px;
}

.load-more {
  display: flex;
  justify-content: center;
  padding: 16px 0;
}

.result-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.context-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.context-label {
  font-size: 12px;
  font-weight: 500;
  color: #999;
  text-transform: uppercase;
}

.context-messages {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-left: 12px;
  border-left: 2px solid var(--hula-gray-200, #e0e0e0);
}

.context-message {
  display: flex;
  gap: 8px;
  font-size: 13px;
}

.msg-sender {
  font-weight: 500;
  color: #666;
  flex-shrink: 0;
}

.msg-content {
  color: #333;
  word-break: break-word;
}

.main-message {
  padding: 16px;
  background: var(--hula-gray-100, #f5f5f5);
  border-radius: 8px;
}

.msg-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.msg-time {
  font-size: 12px;
  color: #999;
}

.main-message .msg-content {
  font-size: 15px;
  line-height: 1.6;
}

.detail-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
  border-top: 1px solid var(--hula-gray-200, #e0e0e0);
}

.empty-icon {
  font-size: 48px;
}

.icon {
  font-size: 18px;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .sender,
  .msg-sender {
    color: #aaa;
  }

  .timestamp,
  .msg-time {
    color: #666;
  }

  .content,
  .msg-content {
    color: #eee;
  }

  .context-messages {
    border-left-color: #444;
  }

  .main-message {
    background: var(--hula-gray-800, #2a2a2a);
  }

  .detail-actions {
    border-top-color: #444;
  }
}
</style>
