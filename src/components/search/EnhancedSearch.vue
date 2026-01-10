<template>
  <div class="enhanced-search">
    <!-- 搜索输入框 -->
    <div class="search-input-container">
      <n-input
        v-model:value="searchQuery"
        :placeholder="t('search.placeholder')"
        clearable
        :loading="searching"
        @input="handleSearchInput"
        @keyup.enter="executeSearch"
        @focus="showSuggestions = true"
        @blur="hideSuggestions"
        class="search-input">
        <template #prefix>
          <Icon icon="mdi:magnify" size="18" />
        </template>
        <template #suffix>
          <n-button
            v-if="showAdvancedOptions"
            text
            size="small"
            @click.stop="showAdvancedPanel = !showAdvancedPanel"
            class="advanced-btn">
            <Icon icon="mdi:cog" size="16" />
          </n-button>
        </template>
      </n-input>

      <!-- 搜索建议 -->
      <div v-if="showSuggestions && suggestions.length > 0" class="search-suggestions">
        <div class="suggestions-header">
          <span>{{ t('search.suggestions') }}</span>
        </div>
        <div class="suggestions-list">
          <div
            v-for="suggestion in suggestions"
            :key="`${suggestion.type}-${suggestion.id}`"
            class="suggestion-item"
            @mousedown="selectSuggestion(suggestion)">
            <div class="suggestion-icon">
              <Icon :icon="getSuggestionIcon(suggestion.type)" :size="16" />
            </div>
            <div class="suggestion-content">
              <div class="suggestion-title">
                <span v-html="sanitizeSuggestionHighlight(suggestion.highlight, suggestion.title)"></span>
              </div>
              <div v-if="suggestion.subtitle" class="suggestion-subtitle">
                {{ suggestion.subtitle }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="mt-8px flex items-center gap-10px">
      <n-input v-model:value="mxid" size="small" class="w-320px" placeholder="输入完整 MXID 如 @user:domain" />
      <n-button size="small" tertiary type="primary" class="mxid-dm-btn" @click="startDmByMxid">
        按MXID发起私聊
      </n-button>
    </div>

    <!-- 高级搜索面板 -->
    <div v-if="showAdvancedPanel" class="advanced-panel">
      <n-card size="small" :title="t('search.advanced')">
        <div class="advanced-filters">
          <!-- 搜索范围 -->
          <div class="filter-section">
            <label class="filter-label">{{ t('search.scope') }}</label>
            <n-checkbox-group v-model:value="advancedFilters.scope">
              <n-space>
                <n-checkbox value="messages">{{ t('search.messages') }}</n-checkbox>
                <n-checkbox value="users">{{ t('search.users') }}</n-checkbox>
                <n-checkbox value="rooms">{{ t('search.rooms') }}</n-checkbox>
              </n-space>
            </n-checkbox-group>
          </div>

          <!-- 时间范围 -->
          <div class="filter-section">
            <label class="filter-label">{{ t('search.timeRange') }}</label>
            <n-select
              v-model:value="advancedFilters.timeRange"
              :options="timeRangeOptions"
              placeholder="Select time range" />
          </div>

          <!-- 消息类型 -->
          <div class="filter-section">
            <label class="filter-label">{{ t('search.messageTypes') }}</label>
            <n-checkbox-group v-model:value="advancedFilters.messageTypes">
              <n-space>
                <n-checkbox value="text">{{ t('search.text') }}</n-checkbox>
                <n-checkbox value="image">{{ t('search.image') }}</n-checkbox>
                <n-checkbox value="video">{{ t('search.video') }}</n-checkbox>
                <n-checkbox value="file">{{ t('search.file') }}</n-checkbox>
                <n-checkbox value="audio">{{ t('search.audio') }}</n-checkbox>
              </n-space>
            </n-checkbox-group>
          </div>

          <!-- 发送者过滤 -->
          <div class="filter-section">
            <label class="filter-label">{{ t('search.sender') }}</label>
            <n-select
              v-model:value="advancedFilters.senders"
              :options="senderOptions"
              multiple
              :placeholder="t('search.selectSenders')" />
          </div>

          <!-- 房间过滤 -->
          <div class="filter-section">
            <label class="filter-label">{{ t('search.rooms') }}</label>
            <n-select
              v-model:value="advancedFilters.rooms"
              :options="roomOptions"
              multiple
              :placeholder="t('search.selectRooms')" />
          </div>

          <!-- 包含链接 -->
          <div class="filter-section">
            <n-checkbox v-model:checked="advancedFilters.containsUrl">
              {{ t('search.containsUrl') }}
            </n-checkbox>
          </div>
        </div>

        <div class="advanced-actions">
          <n-space>
            <n-button @click="resetAdvancedFilters">
              {{ t('common.reset') }}
            </n-button>
            <n-button type="primary" @click="executeAdvancedSearch">
              {{ t('search.search') }}
            </n-button>
          </n-space>
        </div>
      </n-card>
    </div>

    <!-- 搜索结果 -->
    <div v-if="searchResults && searchResults.length > 0" class="search-results">
      <div class="results-header">
        <div class="results-info">
          <span>{{ t('search.resultsCount', { count: searchResults.length }) }}</span>
          <span v-if="searchTime > 0" class="search-time">({{ searchTime }}ms)</span>
        </div>
        <div class="results-actions">
          <n-button text size="small" @click="exportResults">
            <Icon icon="mdi:download" size="16" />
            {{ t('search.export') }}
          </n-button>
        </div>
      </div>

      <div class="results-list">
        <div
          v-for="(result, index) in searchResults"
          :key="result.event_id ?? String(index)"
          class="result-item"
          @click="openResult(result)">
          <div class="result-avatar">
            <n-avatar v-if="result.sender_info?.avatar_url" :src="result.sender_info?.avatar_url" size="small" />
            <div v-else class="default-avatar">
              {{ (result.sender_info?.display_name || result.sender)?.charAt(0)?.toUpperCase() }}
            </div>
          </div>

          <div class="result-content">
            <div class="result-header">
              <span class="result-sender">
                {{ result.sender_info?.display_name || result.sender }}
              </span>
              <span class="result-time">
                {{ formatTime(result.origin_server_ts ?? 0) }}
              </span>
            </div>

            <div class="result-body">
              <div v-if="result.type === 'm.room.message'" class="message-result">
                <div v-if="result.content?.msgtype === 'm.text'" class="text-message">
                  <span v-html="highlightText(result.content.body || '', searchQuery)"></span>
                </div>
                <div v-else-if="result.content?.msgtype === 'm.image'" class="media-message">
                  <Icon icon="mdi:image" size="16" />
                  <span>{{ result.content.body || t('search.image') }}</span>
                </div>
                <div v-else-if="result.content?.msgtype === 'm.video'" class="media-message">
                  <Icon icon="mdi:video" size="16" />
                  <span>{{ result.content.body || t('search.video') }}</span>
                </div>
                <div v-else-if="result.content?.msgtype === 'm.file'" class="media-message">
                  <Icon icon="mdi:file" size="16" />
                  <span>{{ result.content.body || t('search.file') }}</span>
                </div>
                <div v-else class="other-message">
                  {{ result.content?.body || t('search.unknownMessage') }}
                </div>
              </div>
              <div v-else class="event-result">
                <Icon icon="mdi:information" size="16" />
                <span>{{ result.type }}</span>
              </div>
            </div>

            <div v-if="result.room_info" class="result-room">
              <Icon icon="mdi:forum" size="14" />
              {{ result.room_info.name || result.room_id }}
            </div>
          </div>
        </div>
      </div>

      <!-- 加载更多 -->
      <div v-if="hasMoreResults" class="load-more">
        <n-button @click="loadMoreResults" :loading="loadingMore">
          {{ t('search.loadMore') }}
        </n-button>
      </div>
    </div>

    <!-- 搜索历史 -->
    <div v-if="!searchQuery && searchHistory.length > 0" class="search-history">
      <div class="history-header">
        <span>{{ t('search.recentSearches') }}</span>
        <n-button text size="small" @click="clearHistory">
          {{ t('search.clearHistory') }}
        </n-button>
      </div>
      <div class="history-list">
        <div v-for="item in searchHistory" :key="item.query" class="history-item" @click="searchFromHistory(item)">
          <Icon icon="mdi:history" size="16" />
          <span>{{ item.query }}</span>
          <span class="history-count">({{ item.resultCount }})</span>
        </div>
      </div>
    </div>

    <!-- 搜索统计 -->
    <div v-if="searchStats && showStats" class="search-stats">
      <n-card size="small" :title="t('search.statistics')">
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-value">{{ searchStats.totalResults }}</div>
            <div class="stat-label">{{ t('search.totalResults') }}</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ Object.keys(searchStats.roomResults).length }}</div>
            <div class="stat-label">{{ t('search.rooms') }}</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ Object.keys(searchStats.senderResults).length }}</div>
            <div class="stat-label">{{ t('search.senders') }}</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ Math.round(searchStats.averageTimePerResult) }}ms</div>
            <div class="stat-label">{{ t('search.avgTime') }}</div>
          </div>
        </div>
      </n-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMetricsStore } from '@/stores/metrics'
import { createTimer } from '@/utils/Perf'
import { NInput, NButton, NCard, NCheckbox, NCheckboxGroup, NSpace, NSelect, NAvatar } from 'naive-ui'
import { Icon } from '@iconify/vue'
import {
  searchRoomMessagesEnhanced,
  searchGlobalMessages,
  getSearchSuggestions,
  getSearchHistory,
  addToSearchHistory,
  clearSearchHistory,
  highlightSearchTerms,
  getSearchStats,
  type EnhancedSearchResult,
  type SearchOptions,
  type SearchSuggestion
} from '@/integrations/matrix/search'
import { flags } from '@/utils/envFlags'
import { matrixClientService } from '@/integrations/matrix/client'
import { useMatrixAuth } from '@/hooks/useMatrixAuth'
import { useGlobalStore } from '@/stores/global'
import { useChatStore } from '@/stores/chat'
import { getOrCreateDirectRoom, updateDirectMapping } from '@/integrations/matrix/contacts'

import { msg } from '@/utils/SafeUI'
import { logger } from '@/utils/logger'
import { sanitizeHtml, sanitizeHighlightHtml } from '@/utils/htmlSanitizer'

interface Props {
  roomId?: string
  global?: boolean
  showAdvancedOptions?: boolean
  showStats?: boolean
  maxResults?: number
}

interface SenderInfo {
  avatar_url?: string
  display_name?: string
  [key: string]: unknown
}

interface RoomInfo {
  name?: string
  [key: string]: unknown
}

interface MessageContent {
  msgtype?: string
  body?: string
  [key: string]: unknown
}

interface SearchResult {
  event_id?: string
  room_id?: string
  sender?: string
  type?: string
  origin_server_ts?: number
  sender_info?: SenderInfo
  room_info?: RoomInfo
  content?: MessageContent
  [key: string]: unknown
}

interface SearchHistoryItem {
  query: string
  timestamp: number
  resultCount: number
}

/** Search statistics */
interface SearchStats {
  totalResults: number
  roomResults: Record<string, unknown>
  senderResults: Record<string, unknown>
  averageTimePerResult: number
}

interface Emits {
  (e: 'result-selected', result: SearchResult): void
  (e: 'room-selected', roomId: string): void
  (e: 'user-selected', userId: string): void
}

const props = withDefaults(defineProps<Props>(), {
  global: false,
  showAdvancedOptions: true,
  showStats: false,
  maxResults: 50
})

const emit = defineEmits<Emits>()

const { t } = useI18n()
const metricsStore = useMetricsStore()
const searchTimer = createTimer('search')
const message = msg
const globalStore = useGlobalStore()
const chatStore = useChatStore()

// 响应式数据
const searchQuery = ref('')
const searching = ref(false)
const suggestions = ref<SearchSuggestion[]>([])
const showSuggestions = ref(false)
const showAdvancedPanel = ref(false)
const searchResults = ref<SearchResult[]>([])
const searchHistory = ref<SearchHistoryItem[]>([])
const searchStats = ref<SearchStats | null>(null)
const searchTime = ref(0)
const hasMoreResults = ref(false)
const loadingMore = ref(false)
const mxid = ref('')

// 高级过滤器
const advancedFilters = ref({
  scope: ['messages'],
  timeRange: 'all',
  messageTypes: ['text'],
  senders: [] as string[],
  rooms: [] as string[],
  containsUrl: false
})

// 选项配置
const timeRangeOptions = [
  { label: t('search.allTime'), value: 'all' },
  { label: t('search.today'), value: 'today' },
  { label: t('search.thisWeek'), value: 'week' },
  { label: t('search.thisMonth'), value: 'month' },
  { label: t('search.thisYear'), value: 'year' }
]

const senderOptions = ref<Array<{ label: string; value: string }>>([])
const roomOptions = ref<Array<{ label: string; value: string }>>([])

// 方法
const handleSearchInput = async (value: string) => {
  searchQuery.value = value

  if (value.length >= 2) {
    await loadSuggestions(value)
  } else {
    suggestions.value = []
  }
}

const loadSuggestions = async (query: string) => {
  if (!flags.matrixSearchEnabled) return

  try {
    suggestions.value = await getSearchSuggestions(query, 5)
  } catch (error) {
    logger.error('Failed to load suggestions:', error)
  }
}

const hideSuggestions = () => {
  setTimeout(() => {
    showSuggestions.value = false
  }, 200)
}

const selectSuggestion = (suggestion: SearchSuggestion) => {
  searchQuery.value = suggestion.title || suggestion.id
  showSuggestions.value = false
  executeSearch()

  if (suggestion.type === 'room') {
    emit('room-selected', suggestion.id)
  } else if (suggestion.type === 'user') {
    emit('user-selected', suggestion.id)
  }
}

const executeSearch = async () => {
  if (!searchQuery.value.trim() || !flags.matrixSearchEnabled) return

  searching.value = true
  searchResults.value = []
  searchStats.value = null

  // 开始性能计时
  searchTimer.start('query')

  try {
    const startTime = Date.now()

    let result: EnhancedSearchResult

    if (props.global) {
      // 全局搜索
      const options: SearchOptions = {
        searchTerm: searchQuery.value,
        types: getMessageTypeFilter(),
        containsUrl: advancedFilters.value.containsUrl,
        limit: props.maxResults
      }
      if (advancedFilters.value.rooms.length > 0) options.rooms = advancedFilters.value.rooms
      if (advancedFilters.value.senders.length > 0) options.senders = advancedFilters.value.senders

      result = await searchGlobalMessages(searchQuery.value, options)
    } else if (props.roomId) {
      // 房间搜索
      result = await searchRoomMessagesEnhanced(props.roomId, searchQuery.value, {
        limit: props.maxResults,
        includeContext: true
      })
    } else {
      return
    }

    searchResults.value = result.results || []
    searchTime.value = Date.now() - startTime
    hasMoreResults.value = result.hasMore

    // 结束性能计时并记录指标
    const queryDuration = searchTimer.end('query')

    // 记录搜索性能指标
    metricsStore.recordSearchMetrics({
      queryTime: queryDuration,
      resultCount: searchResults.value.length,
      cacheHitRate: 85, // 示例值，应该从缓存系统获取
      filterProcessingTime: 50, // 示例值，应该实际测量
      renderTime: 30 // 示例值，应该实际测量
    })

    // 添加到搜索历史
    addToSearchHistory(searchQuery.value, searchResults.value.length)

    // 生成统计信息
    if (props.showStats) {
      searchStats.value = getSearchStats(searchResults.value, searchTime.value)
    }
  } catch (error) {
    logger.error('Search failed:', error)
    message.error(t('search.failed'))

    // 即使出错也要结束计时
    searchTimer.end('query')
  } finally {
    searching.value = false
  }
}

const executeAdvancedSearch = async () => {
  showAdvancedPanel.value = false
  await executeSearch()
}

const getMessageTypeFilter = (): string[] => {
  const typeMap: { [key: string]: string } = {
    text: 'm.room.message',
    image: 'm.room.message',
    video: 'm.room.message',
    file: 'm.room.message',
    audio: 'm.room.message'
  }

  return advancedFilters.value.messageTypes.map((type) => typeMap[type]).filter((item): item is string => Boolean(item))
}

const loadMoreResults = async () => {
  if (loadingMore.value || !searchQuery.value.trim()) return

  loadingMore.value = true

  try {
    // 这里应该实现分页加载逻辑
    // const moreResults = await searchMore(searchQuery.value, searchResults.value.length)
    // searchResults.value.push(...moreResults.results)
    // hasMoreResults.value = moreResults.hasMore

    // Placeholder for future implementation
    throw new Error('Load more functionality not yet implemented')
  } catch (error) {
    logger.error('Failed to load more results:', error)
    message.error(t('search.loadMoreFailed'))
  } finally {
    loadingMore.value = false
  }
}

const openResult = (result: SearchResult) => {
  emit('result-selected', result)

  if (result.room_id) {
    emit('room-selected', result.room_id)
  }
}

const searchFromHistory = (item: SearchHistoryItem) => {
  searchQuery.value = item.query
  executeSearch()
}

const clearHistory = () => {
  clearSearchHistory()
  searchHistory.value = []
  message.success(t('search.historyCleared'))
}

const resetAdvancedFilters = () => {
  advancedFilters.value = {
    scope: ['messages'],
    timeRange: 'all',
    messageTypes: ['text'],
    senders: [],
    rooms: [],
    containsUrl: false
  }
}

//

const exportResults = () => {
  if (!searchResults.value.length) {
    message.warning(t('search.noResultsToExport'))
    return
  }

  const exportData = {
    query: searchQuery.value,
    timestamp: new Date().toISOString(),
    results: searchResults.value,
    totalResults: searchResults.value.length,
    searchTime: searchTime.value
  }

  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json'
  })

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `search-results-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)

  message.success(t('search.resultsExported'))
}

const formatMxid = (raw: string) => {
  const s = raw.trim()
  if (!s) return ''
  if (s.startsWith('@') && s.includes(':')) return s
  const { store } = useMatrixAuth()
  if (!store.getHomeserverBaseUrl()) store.setDefaultBaseUrlFromEnv()
  let host = ''
  try {
    const parsed = new URL(store.getHomeserverBaseUrl() || '').host
    host = parsed || host
  } catch {}
  const core = s.replace(/^@/, '')
  return `@${core.includes(':') ? core.split(':')[0] : core}:${host}`
}

const startDmByMxid = async () => {
  try {
    const target = formatMxid(mxid.value)
    if (!target || !target.startsWith('@') || !target.includes(':')) {
      message.warning('请输入完整的 MXID，如 @user:domain')
      return
    }
    let client = matrixClientService.getClient()
    if (!client) {
      const { store } = useMatrixAuth()
      if (!store.getHomeserverBaseUrl()) store.setDefaultBaseUrlFromEnv()
      const base = store.getHomeserverBaseUrl() || ''
      await matrixClientService.initialize({ baseUrl: base, accessToken: store.accessToken, userId: store.userId })
      await matrixClientService.startClient({ initialSyncLimit: 5, pollTimeout: 15000 })
      client = matrixClientService.getClient()
    }
    const roomId = await getOrCreateDirectRoom(target)
    if (!roomId) {
      message.error('无法创建会话')
      return
    }
    try {
      await updateDirectMapping(target, roomId)
    } catch {}
    await chatStore.getSessionList()
    globalStore.updateCurrentSessionRoomId(roomId)
    message.success('已创建私聊')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    message.error(`创建会话失败：${msg}`)
  }
}

const getSuggestionIcon = (type: string) => {
  const iconMap: { [key: string]: string } = {
    user: 'mdi:account',
    room: 'mdi:forum',
    message: 'mdi:message',
    tag: 'mdi:tag'
  }
  return iconMap[type] || 'mdi:help'
}

const highlightText = (text: string, query: string) => {
  const highlighted = highlightSearchTerms(text, query)
  // Sanitize the highlighted HTML to prevent XSS attacks
  return sanitizeHtml(highlighted)
}

// Sanitize suggestion highlight to prevent XSS attacks
const sanitizeSuggestionHighlight = (highlight: string | undefined, fallback: string): string => {
  return sanitizeHtml(highlight || fallback)
}

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return t('time.justNow')
  if (minutes < 60) return t('time.minutesAgo', { minutes })
  if (hours < 24) return t('time.hoursAgo', { hours })
  if (days < 7) return t('time.daysAgo', { days })

  return date.toLocaleDateString()
}

// 生命周期
onMounted(() => {
  if (flags.matrixSearchEnabled) {
    searchHistory.value = getSearchHistory()
  }
})

// 监听搜索查询变化
watch(searchQuery, (newValue) => {
  if (!newValue) {
    searchResults.value = []
    searchStats.value = null
  }
})

// 暴露方法给父组件
defineExpose({
  search: executeSearch,
  clear: () => {
    searchQuery.value = ''
    searchResults.value = []
    searchStats.value = null
  },
  loadMore: loadMoreResults
})
</script>

<style scoped>
.mxid-dm-btn :deep(.n-button__content) {
  color: var(--hula-white) !important;
}
.enhanced-search {
  max-width: 600px;
  margin: 0 auto;
}

.search-input-container {
  position: relative;
}

.search-input {
  width: 100%;
}

.advanced-btn {
  opacity: 0.7;
}

.advanced-btn:hover {
  opacity: 1;
}

.search-suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid var(--hula-gray-200, var(--hula-brand-primary));
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(var(--hula-black-rgb), 0.1);
  z-index: 1000;
  max-height: 300px;
  overflow-y: auto;
}

.suggestions-header {
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--hula-gray-700);
  background: var(--hula-gray-100, var(--hula-brand-primary));
  border-bottom: 1px solid var(--hula-gray-200, var(--hula-brand-primary));
}

.suggestion-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.2s ease;
  border-bottom: 1px solid var(--hula-brand-primary);
}

.suggestion-item:hover {
  background: var(--hula-brand-primary);
}

.suggestion-item:last-child {
  border-bottom: none;
}

.suggestion-icon {
  margin-right: 8px;
  color: var(--hula-gray-700);
}

.suggestion-content {
  flex: 1;
}

.suggestion-title {
  font-size: 14px;
  color: var(--hula-gray-900);
}

.suggestion-subtitle {
  font-size: 12px;
  color: var(--hula-gray-700);
  margin-top: 2px;
}

.suggestion-badge {
  margin-left: 8px;
}

.advanced-panel {
  margin-top: 16px;
}

.advanced-filters {
  display: grid;
  gap: 16px;
}

.filter-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--hula-gray-700);
}

.advanced-actions {
  margin-top: 16px;
  text-align: right;
}

.search-results {
  margin-top: 24px;
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.results-info {
  font-size: 14px;
  color: var(--hula-gray-700);
}

.search-time {
  font-size: 12px;
  color: var(--hula-gray-400);
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-item {
  display: flex;
  align-items: flex-start;
  padding: var(--hula-spacing-sm);
  background: var(--hula-white);
  border: 1px solid var(--hula-gray-200, var(--hula-brand-primary));
  border-radius: var(--hula-radius-sm);
  cursor: pointer;
  transition:
    background 0.2s ease,
    border-color 0.2s ease;
}

.result-item:hover {
  background: var(--hula-brand-primary);
  border-color: var(--hula-brand-primary);
}

.result-avatar {
  margin-right: var(--hula-spacing-md);
  flex-shrink: 0;
}

.default-avatar {
  width: var(--hula-spacing-xl);
  height: var(--hula-spacing-xl);
  border-radius: 50%;
  background: var(--hula-brand-primary);
  color: var(--hula-white);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 500;
}

.result-content {
  flex: 1;
  min-width: 0;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.result-sender {
  font-weight: 500;
  color: var(--hula-gray-900);
}

.result-time {
  font-size: 12px;
  color: var(--hula-gray-700);
}

.result-body {
  color: var(--hula-gray-900);
  line-height: 1.4;
}

.message-result,
.event-result {
  display: flex;
  align-items: center;
  gap: 4px;
}

.media-message {
  color: var(--hula-gray-700);
}

.result-room {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  font-size: 12px;
  color: var(--hula-gray-400);
}

.load-more {
  text-align: center;
  margin-top: 16px;
}

.search-history {
  margin-top: 24px;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 500;
  color: var(--hula-gray-900);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--hula-brand-primary);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s ease;
  font-size: 14px;
  color: var(--hula-gray-700);
}

.history-item:hover {
  background: var(--hula-brand-primary);
}

.history-count {
  margin-left: auto;
  font-size: 12px;
  color: var(--hula-gray-400);
}

.search-stats {
  margin-top: 24px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 16px;
  text-align: center;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--hula-brand-primary);
}

.stat-label {
  font-size: 12px;
  color: var(--hula-gray-700);
}

/* 暗色主题支持 */
@media (prefers-color-scheme: dark) {
  .search-suggestions {
    background: var(--hula-brand-primary);
    border-color: var(--hula-gray-900);
  }

  .suggestions-header {
    background: var(--hula-gray-800, var(--hula-brand-primary));
    border-bottom-color: var(--hula-gray-900);
    color: var(--hula-gray-300);
  }

  .suggestion-item {
    border-bottom-color: var(--hula-gray-900);
  }

  .suggestion-item:hover {
    background: var(--hula-brand-primary);
  }

  .result-item {
    background: var(--hula-brand-primary);
    border-color: var(--hula-gray-900);
  }

  .result-item:hover {
    background: var(--hula-brand-primary);
    border-color: var(--hula-brand-primary);
  }
}
</style>
