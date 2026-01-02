<!-- Mobile Chat Search - Enhanced chat content search for mobile -->
<template>
  <div class="mobile-chat-search">
    <!-- Header -->
    <div class="search-header">
      <div class="search-input-wrapper">
        <n-icon :size="18" class="search-icon">
          <Search />
        </n-icon>
        <n-input
          v-model:value="searchQuery"
          :placeholder="t('search.placeholder')"
          clearable
          @input="handleSearchInput"
          @keyup.enter="executeSearch"
          class="search-input"
        />
      </div>
      <n-button text @click="goBack">
        <template #icon>
          <n-icon :size="20"><X /></n-icon>
        </template>
      </n-button>
    </div>

    <!-- Filter Tabs -->
    <div class="filter-tabs">
      <div
        v-for="tab in filterTabs"
        :key="tab.key"
        class="filter-tab"
        :class="{ active: activeFilter === tab.key }"
        @click="setFilter(tab.key)"
      >
        <n-icon :size="16">
          <component :is="tab.icon" />
        </n-icon>
        <span>{{ tab.label }}</span>
        <span v-if="tab.count > 0" class="count">{{ tab.count }}</span>
      </div>
    </div>

    <!-- Advanced Filters (collapsible) -->
    <div v-if="showAdvancedFilters" class="advanced-filters">
      <n-collapse>
        <n-collapse-item title="高级筛选" name="filters">
          <n-space vertical>
            <!-- Date Filter -->
            <n-form-item label="日期范围">
              <n-select
                v-model:value="dateFilter"
                :options="dateOptions"
                placeholder="选择日期范围"
                clearable
                @update:value="onFilterChange"
              />
            </n-form-item>

            <!-- Sender Filter -->
            <n-form-item label="发送者">
              <n-select
                v-model:value="selectedSenders"
                :options="senderOptions"
                multiple
                placeholder="选择发送者"
                clearable
                @update:value="onFilterChange"
              />
            </n-form-item>

            <!-- Message Type Filter -->
            <n-form-item label="消息类型">
              <n-checkbox-group v-model:value="selectedTypes" @update:value="onFilterChange">
              <n-space>
                <n-checkbox value="m.text">文本</n-checkbox>
                <n-checkbox value="m.image">图片</n-checkbox>
                <n-checkbox value="m.video">视频</n-checkbox>
                <n-checkbox value="m.file">文件</n-checkbox>
                <n-checkbox value="m.audio">音频</n-checkbox>
              </n-space>
            </n-checkbox-group>
            </n-form-item>
          </n-space>
        </n-collapse-item>
      </n-collapse>
    </div>

    <!-- Loading State -->
    <div v-if="searching" class="loading-state">
      <n-spin size="medium" />
      <p class="mt-12px">搜索中...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="!searched && !searchQuery" class="empty-state">
      <n-icon size="60" color="#d0d0d0">
        <Search />
      </n-icon>
      <p class="empty-text">输入关键词搜索聊天内容</p>
      <div class="quick-filters">
        <n-button
          v-for="quick in quickFilters"
          :key="quick.key"
          size="small"
          @click="applyQuickFilter(quick.key)"
        >
          <template #icon>
            <n-icon><component :is="quick.icon" /></n-icon>
          </template>
          {{ quick.label }}
        </n-button>
      </div>
    </div>

    <!-- No Results -->
    <div v-else-if="searchResults.length === 0" class="no-results">
      <n-icon size="48" color="#d0d0d0">
        <X />
      </n-icon>
      <p>未找到匹配的结果</p>
    </div>

    <!-- Search Results -->
    <div v-else class="search-results">
      <div class="results-header">
        <span class="results-count">{{ searchResults.length }} 条结果</span>
        <n-button text size="small" @click="showAdvancedFilters = !showAdvancedFilters">
          <template #icon>
            <n-icon><Adjustments /></n-icon>
          </template>
          筛选
        </n-button>
      </div>

      <div class="results-list">
        <div
          v-for="result in paginatedResults"
          :key="result.eventId"
          class="result-item"
          @click="openResult(result)"
        >
          <div class="result-header">
            <div class="result-sender">
              <n-avatar :size="28" :src="result.senderAvatar">
                <template #fallback>
                  <n-icon><User /></n-icon>
                </template>
              </n-avatar>
              <span class="sender-name">{{ result.senderName }}</span>
            </div>
            <span class="result-time">{{ formatTime(result.timestamp) }}</span>
          </div>
          <div class="result-content" v-html="sanitizeContent(result)"></div>
          <div v-if="result.context" class="result-context">
            <span v-if="result.context.before?.length" class="context-before">...{{ result.context.before.length }}条消息前...</span>
            <span v-if="result.context.after?.length" class="context-after">...{{ result.context.after.length }}条消息后...</span>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="pagination">
        <n-button
          :disabled="currentPage === 1"
          size="small"
          @click="currentPage--"
        >
          上一页
        </n-button>
        <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
        <n-button
          :disabled="currentPage === totalPages"
          size="small"
          @click="currentPage++"
        >
          下一页
        </n-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  NInput,
  NButton,
  NIcon,
  NSpin,
  NAvatar,
  NSelect,
  NCheckboxGroup,
  NCheckbox,
  NFormItem,
  NSpace,
  NCollapse,
  NCollapseItem
} from 'naive-ui'
import { Search, X, Photo, Video, File, Music, Link, User, Adjustments, Hash } from '@vicons/tabler'
import { matrixSearchService } from '@/services/matrixSearchService'
import type { SearchOptions, SearchResult } from '@/services/matrixSearchService'
import { msg } from '@/utils/SafeUI'
import { sanitizeHtml } from '@/utils/htmlSanitizer'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()

// State
const searchQuery = ref('')
const searching = ref(false)
const searched = ref(false)
const searchResults = ref<SearchResult[]>([])
const currentPage = ref(1)
const pageSize = 20
const showAdvancedFilters = ref(false)

// Filters
const activeFilter = ref<string>('all')
const dateFilter = ref<string>()
const selectedSenders = ref<string[]>([])
const selectedTypes = ref<string[]>([])

// Filter tabs
const filterTabs = ref([
  { key: 'all', label: '全部', icon: Hash, count: 0 },
  { key: 'images', label: '图片', icon: Photo, count: 0 },
  { key: 'videos', label: '视频', icon: Video, count: 0 },
  { key: 'files', label: '文件', icon: File, count: 0 },
  { key: 'audio', label: '音频', icon: Music, count: 0 }
])

// Quick filters
const quickFilters = ref([
  { key: 'images', label: '图片与视频', icon: Photo },
  { key: 'files', label: '文件', icon: File },
  { key: 'links', label: '链接', icon: Link }
])

// Date options
const dateOptions = [
  { label: '今天', value: 'today' },
  { label: '最近7天', value: 'week' },
  { label: '最近30天', value: 'month' },
  { label: '自定义', value: 'custom' }
]

// Sender options (will be populated)
const senderOptions = ref<Array<{ label: string; value: string }>>([])

// Computed
const paginatedResults = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  const end = start + pageSize
  return searchResults.value.slice(start, end)
})

const totalPages = computed(() => Math.ceil(searchResults.value.length / pageSize))

// Current room ID from route
const roomId = computed(() => (route.params.roomId as string) || (route.query.roomId as string))

// Methods
const goBack = () => {
  router.back()
}

const handleSearchInput = () => {
  // Auto-search after typing delay could be implemented here
}

const executeSearch = async () => {
  if (!searchQuery.value.trim()) {
    msg.warning('请输入搜索关键词')
    return
  }

  searching.value = true
  searched.value = true
  currentPage.value = 1

  try {
    const options: SearchOptions = {
      query: searchQuery.value,
      roomIds: roomId.value ? [roomId.value] : undefined,
      limit: 200,
      messageTypes: selectedTypes.value.length > 0 ? selectedTypes.value : undefined,
      senderIds: selectedSenders.value.length > 0 ? selectedSenders.value : undefined
    }

    // Apply date filter
    if (dateFilter.value) {
      const now = Date.now()
      const dayMs = 24 * 60 * 60 * 1000

      switch (dateFilter.value) {
        case 'today':
          options.dateRange = [now - dayMs, now]
          break
        case 'week':
          options.dateRange = [now - 7 * dayMs, now]
          break
        case 'month':
          options.dateRange = [now - 30 * dayMs, now]
          break
      }
    }

    const response = await matrixSearchService.searchMessages(options)

    // Update filter counts
    updateFilterCounts(response.results)

    searchResults.value = response.results

    // Update sender options from results
    updateSenderOptions(response.results)
  } catch (error) {
    msg.error('搜索失败: ' + (error instanceof Error ? error.message : '未知错误'))
    searchResults.value = []
  } finally {
    searching.value = false
  }
}

const setFilter = (filter: string) => {
  activeFilter.value = filter

  // Apply filter logic
  switch (filter) {
    case 'images':
      selectedTypes.value = ['m.image']
      break
    case 'videos':
      selectedTypes.value = ['m.video']
      break
    case 'files':
      selectedTypes.value = ['m.file']
      break
    case 'audio':
      selectedTypes.value = ['m.audio']
      break
    default:
      selectedTypes.value = []
  }

  if (searchQuery.value) {
    executeSearch()
  }
}

const applyQuickFilter = (filter: string) => {
  setFilter(filter)
}

const onFilterChange = () => {
  if (searchQuery.value) {
    executeSearch()
  }
}

const updateFilterCounts = (results: SearchResult[]) => {
  // Count by message type - extract from content
  const counts = {
    images: 0,
    videos: 0,
    files: 0,
    audio: 0
  }

  for (const result of results) {
    // Extract msgtype from content
    const content = result.content as { msgtype?: string } | undefined
    const msgType = content?.msgtype

    if (msgType === 'm.image') counts.images++
    else if (msgType === 'm.video') counts.videos++
    else if (msgType === 'm.file') counts.files++
    else if (msgType === 'm.audio') counts.audio++
  }

  filterTabs.value = [
    { key: 'all', label: '全部', icon: Hash, count: results.length },
    { key: 'images', label: '图片', icon: Photo, count: counts.images },
    { key: 'videos', label: '视频', icon: Video, count: counts.videos },
    { key: 'files', label: '文件', icon: File, count: counts.files },
    { key: 'audio', label: '音频', icon: Music, count: counts.audio }
  ]
}

const updateSenderOptions = (results: SearchResult[]) => {
  const uniqueSenders = new Map<string, { name: string; avatar: string }>()

  for (const result of results) {
    if (!uniqueSenders.has(result.senderId)) {
      uniqueSenders.set(result.senderId, {
        name: result.senderName || result.senderId,
        avatar: result.senderAvatar || ''
      })
    }
  }

  senderOptions.value = Array.from(uniqueSenders.entries()).map(([id, info]) => ({
    label: info.name,
    value: id
  }))
}

const openResult = (result: SearchResult | any) => {
  // Navigate to the message in the chat
  router.push({
    path: `/mobile/chat-room/${roomId.value}`,
    query: {
      eventId: result.eventId,
      highlight: 'true'
    }
  })
}

// Sanitize HTML content to prevent XSS attacks
const sanitizeContent = (result: SearchResult | Record<string, unknown>): string => {
  const formatted = (result as Record<string, unknown>).formattedContent as string | undefined
  const content = (result as Record<string, unknown>).content as string | undefined
  return sanitizeHtml(formatted || String(content || ''))
}

const formatTime = (timestamp: number): string => {
  const now = Date.now()
  const diff = now - timestamp

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`

  const date = new Date(timestamp)
  return date.toLocaleDateString()
}

// Lifecycle
onMounted(() => {
  // Focus on search input
  const input = document.querySelector('.search-input input') as HTMLInputElement
  input?.focus()
})
</script>

<style scoped lang="scss">
.mobile-chat-search {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-color);
}

.search-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--card-color);
  border-bottom: 1px solid var(--divider-color);
}

.search-input-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-color);
  border-radius: 8px;
}

.search-icon {
  color: var(--text-color-3);
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;

  :deep(.n-input__border) {
    display: none;
  }
}

.filter-tabs {
  display: flex;
  gap: 4px;
  padding: 8px 16px;
  background: var(--card-color);
  overflow-x: auto;
  border-bottom: 1px solid var(--divider-color);

  &::-webkit-scrollbar {
    display: none;
  }
}

.filter-tab {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 13px;
  color: var(--text-color-2);
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;

  &.active {
    background: var(--primary-color);
    color: white;
  }

  .count {
    font-size: 11px;
    opacity: 0.8;
  }
}

.advanced-filters {
  padding: 8px 16px;
  background: var(--card-color);
  border-bottom: 1px solid var(--divider-color);
}

.loading-state,
.empty-state,
.no-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 32px;
}

.empty-text {
  margin-top: 16px;
  color: var(--text-color-3);
}

.quick-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 24px;
  justify-content: center;
}

.search-results {
  flex: 1;
  overflow-y: auto;
}

.results-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--bg-color);
  position: sticky;
  top: 0;
  z-index: 1;
}

.results-count {
  font-size: 13px;
  color: var(--text-color-2);
}

.results-list {
  padding: 8px 16px;
}

.result-item {
  padding: 12px;
  margin-bottom: 8px;
  background: var(--card-color);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;

  &:active {
    background: var(--item-hover-bg);
  }
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.result-sender {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sender-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-color-1);
}

.result-time {
  font-size: 11px;
  color: var(--text-color-3);
}

.result-content {
  font-size: 14px;
  color: var(--text-color-1);
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;

  :deep(mark) {
    background: rgba(24, 160, 88, 0.2);
    color: var(--primary-color);
    padding: 0 2px;
    border-radius: 2px;
  }
}

.result-context {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-color-3);

  .context-before,
  .context-after {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 16px;
  background: var(--card-color);
}

.page-info {
  font-size: 13px;
  color: var(--text-color-2);
}
</style>
