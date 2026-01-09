<template>
  <div class="matrix-search">
    <!-- Search Input -->
    <div class="search-input-container">
      <n-input
        v-model:value="searchQuery"
        placeholder="搜索消息、房间或用户..."
        clearable
        @keyup.enter="performSearch"
        @focus="showSuggestions = true"
        @blur="hideSuggestions">
        <template #prefix>
          <n-icon :component="Search" />
        </template>
        <template #suffix>
          <n-button text size="small" @click="toggleAdvancedSearch">
            <n-icon :component="Settings" />
          </n-button>
        </template>
      </n-input>

      <!-- Search Suggestions -->
      <div v-show="showSuggestions && suggestions.length > 0" class="search-suggestions">
        <div
          v-for="suggestion in suggestions"
          :key="suggestion"
          class="suggestion-item"
          @click="selectSuggestion(suggestion)">
          <n-icon :component="Clock" size="14" />
          <span>{{ suggestion }}</span>
        </div>
      </div>
    </div>

    <!-- Advanced Search Options -->
    <n-collapse-transition :show="showAdvancedSearch">
      <div class="advanced-search">
        <n-form inline label-placement="left">
          <n-form-item label="搜索范围">
            <n-select
              v-bind="searchOptions.scope !== undefined ? { value: searchOptions.scope } : {}"
              :options="searchScopeOptions"
              class="search-scope-select" />
          </n-form-item>

          <n-form-item label="消息类型">
            <n-select
              v-bind="searchOptions.messageTypes !== undefined ? { value: searchOptions.messageTypes } : {}"
              :options="messageTypeOptions"
              multiple
              class="message-type-select"
              placeholder="全部类型" />
          </n-form-item>

          <n-form-item label="日期范围">
            <n-date-picker
              v-bind="searchOptions.dateRange !== undefined ? { value: searchOptions.dateRange } : {}"
              type="daterange"
              clearable
              class="date-range-picker" />
          </n-form-item>

          <n-form-item label="发送者">
            <n-select
              v-bind="searchOptions.senderIds !== undefined ? { value: searchOptions.senderIds } : {}"
              :options="senderOptions"
              multiple
              filterable
              placeholder="选择发送者"
              class="sender-select" />
          </n-form-item>

          <n-form-item>
            <n-button type="primary" @click="performSearch">搜索</n-button>
          </n-form-item>
        </n-form>
      </div>
    </n-collapse-transition>

    <!-- Search Tabs -->
    <div v-if="hasSearched" class="search-tabs">
      <n-tabs v-model:value="activeTab" type="segment">
        <n-tab-pane name="messages" tab="消息">
          <n-badge :value="messageResults.count" :max="99" show-zero />
        </n-tab-pane>
        <n-tab-pane name="rooms" tab="房间">
          <n-badge :value="roomResults.length" :max="99" show-zero />
        </n-tab-pane>
        <n-tab-pane name="users" tab="用户">
          <n-badge :value="userResults.length" :max="99" show-zero />
        </n-tab-pane>
      </n-tabs>
    </div>

    <!-- Search Results -->
    <div v-if="hasSearched" class="search-results">
      <!-- Message Results -->
      <div v-show="activeTab === 'messages'" class="message-results">
        <div v-if="messageResults.loading" class="loading-container">
          <n-spin />
          <span>搜索中...</span>
        </div>

        <div v-else-if="messageResults.results.length === 0" class="empty-result">
          <n-empty description="未找到相关消息" />
        </div>

        <div v-else class="message-list">
          <div
            v-for="result in messageResults.results"
            :key="result.eventId"
            class="message-result-item"
            @click="openMessage(result as SearchResult)">
            <!-- Message Header -->
            <div class="message-header">
              <n-avatar
                v-bind="
                  (result as SearchResult).senderAvatar !== undefined
                    ? { src: (result as SearchResult).senderAvatar }
                    : {}
                "
                :fallback-src="'/default-avatar.png'"
                round
                size="small">
                {{ getSenderInitials(result as SearchResult) }}
              </n-avatar>
              <div class="message-meta">
                <span class="sender-name">{{ (result as SearchResult).senderName }}</span>
                <span class="room-name">{{ (result as SearchResult).roomName }}</span>
                <span class="message-time">{{ formatTime((result as SearchResult).timestamp) }}</span>
              </div>
            </div>

            <!-- Message Content -->
            <div class="message-content">
              <div
                v-if="(result as SearchResult).formattedContent"
                v-html="sanitizeContent((result as SearchResult).formattedContent)" />
              <div v-else class="content-text">
                {{ getMessagePreview(result as SearchResult) }}
              </div>
            </div>

            <!-- Context -->
            <div v-if="(result as SearchResult).context && showContext" class="message-context">
              <div class="context-messages">
                <div
                  v-for="ctx in (result as SearchResult).context!.before"
                  :key="getContextEventId(ctx)"
                  class="context-message before">
                  {{ getContextEventBody(ctx) }}
                </div>
                <div class="context-message current">↑ 匹配的消息</div>
                <div
                  v-for="ctx in (result as SearchResult).context!.after"
                  :key="getContextEventId(ctx)"
                  class="context-message after">
                  {{ getContextEventBody(ctx) }}
                </div>
              </div>
            </div>
          </div>

          <!-- Load More -->
          <div v-if="messageResults.hasMore" class="load-more">
            <n-button @click="loadMoreMessages">加载更多</n-button>
          </div>
        </div>
      </div>

      <!-- Room Results -->
      <div v-show="activeTab === 'rooms'" class="room-results">
        <div v-if="roomResults.length === 0" class="empty-result">
          <n-empty description="未找到相关房间" />
        </div>

        <div v-else class="room-list">
          <div v-for="room in roomResults" :key="room.roomId" class="room-result-item" @click="joinRoom(room)">
            <n-avatar
              v-bind="room.avatar !== undefined ? { src: room.avatar } : {}"
              :fallback-src="'/default-avatar.png'"
              round
              size="medium">
              <n-icon :component="Users" />
            </n-avatar>
            <div class="room-info">
              <h3 class="room-name">{{ room.name }}</h3>
              <p class="room-topic">{{ room.topic || '暂无描述' }}</p>
              <div class="room-meta">
                <span class="member-count">{{ room.memberCount || 0 }} 成员</span>
                <n-tag size="small" :type="getMatchTypeColor(room.matchType)">
                  {{ getMatchTypeText(room.matchType) }}
                </n-tag>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- User Results -->
      <div v-show="activeTab === 'users'" class="user-results">
        <div v-if="userResults.length === 0" class="empty-result">
          <n-empty description="未找到相关用户" />
        </div>

        <div v-else class="user-list">
          <div v-for="user in userResults" :key="user.userId" class="user-result-item" @click="openUserProfile(user)">
            <n-avatar
              v-bind="user.avatar !== undefined ? { src: user.avatar } : {}"
              :fallback-src="'/default-avatar.png'"
              round
              size="medium">
              {{ getUserInitials(user) }}
            </n-avatar>
            <div class="user-info">
              <h3 class="user-name">{{ user.displayName || user.userId }}</h3>
              <p class="user-id">{{ user.userId }}</p>
              <div class="user-meta">
                <n-tag size="small" :type="user.presence === 'online' ? 'success' : 'default'">
                  {{ getPresenceText(user.presence) }}
                </n-tag>
                <span v-if="user.lastActiveAgo" class="last-active">
                  {{ formatLastActive(user.lastActiveAgo) }}
                </span>
              </div>
            </div>
            <n-button @click.stop="startDirectMessage(user)">
              <n-icon :component="MessageCircle" />
              私信
            </n-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import {
  NInput,
  NIcon,
  NButton,
  NCollapseTransition,
  NForm,
  NFormItem,
  NSelect,
  NDatePicker,
  NTabs,
  NTabPane,
  NBadge,
  NSpin,
  NEmpty,
  NAvatar,
  NTag,
  useMessage
} from 'naive-ui'
import { Search, Settings, Clock, Users, MessageCircle } from '@vicons/tabler'
import { matrixSearchServiceCompat as matrixSearchService } from '@/integrations/matrix/search'
import type {
  LegacySearchResult as SearchResult,
  LegacyRoomSearchResult as RoomSearchResult,
  LegacyUserSearchResult as UserSearchResult,
  LegacySearchOptions as SearchOptions
} from '@/integrations/matrix/search'
import { sanitizeHtml } from '@/utils/htmlSanitizer'

const emit = defineEmits<{
  openMessage: [result: SearchResult]
  joinRoom: [room: RoomSearchResult]
  openUserProfile: [user: UserSearchResult]
  startDirectMessage: [user: UserSearchResult]
}>()

const message = useMessage()

// State
const searchQuery = ref('')
const showSuggestions = ref(false)
const showAdvancedSearch = ref(false)
const hasSearched = ref(false)
const activeTab = ref<'messages' | 'rooms' | 'users'>('messages')
const suggestions = ref<string[]>([])
const showContext = ref(false)

// Search options
const searchOptions = reactive<SearchOptions>({
  query: '',
  scope: 'all',
  messageTypes: [],
  dateRange: null,
  senderIds: [],
  limit: 20,
  order: 'recent'
})

// Results
const messageResults = reactive({
  loading: false,
  count: 0,
  hasMore: false,
  nextBatch: '',
  results: [] as SearchResult[]
})

const roomResults = ref<RoomSearchResult[]>([])
const userResults = ref<UserSearchResult[]>([])

// Options
const searchScopeOptions = [
  { label: '全部', value: 'all' },
  { label: '当前房间', value: 'current' },
  { label: '私信', value: 'dms' },
  { label: '群组', value: 'groups' }
]

const messageTypeOptions = [
  { label: '文本', value: 'm.text' },
  { label: '图片', value: 'm.image' },
  { label: '视频', value: 'm.video' },
  { label: '语音', value: 'm.audio' },
  { label: '文件', value: 'm.file' },
  { label: '位置', value: 'm.location' }
]

const senderOptions = ref<{ label: string; value: string }[]>([])

// Methods
const hideSuggestions = () => {
  setTimeout(() => {
    showSuggestions.value = false
  }, 200)
}

const toggleAdvancedSearch = () => {
  showAdvancedSearch.value = !showAdvancedSearch.value
}

const selectSuggestion = (suggestion: string) => {
  searchQuery.value = suggestion
  showSuggestions.value = false
  performSearch()
}

const performSearch = async () => {
  if (!searchQuery.value.trim()) {
    message.warning('请输入搜索内容')
    return
  }

  hasSearched.value = true
  searchOptions.query = searchQuery.value

  // Save to recent searches
  matrixSearchService.saveSearchTerm(searchQuery.value)

  // Search based on active tab
  switch (activeTab.value) {
    case 'messages':
      await searchMessages()
      break
    case 'rooms':
      await searchRooms()
      break
    case 'users':
      await searchUsers()
      break
  }
}

const searchMessages = async () => {
  messageResults.loading = true
  try {
    const response = await matrixSearchService.searchMessages(searchOptions)
    messageResults.count = response.count
    messageResults.hasMore = response.hasMore
    messageResults.nextBatch = response.nextBatch || ''
    messageResults.results = response.results
  } catch (error) {
    message.error('搜索消息失败')
  } finally {
    messageResults.loading = false
  }
}

const searchRooms = async () => {
  try {
    roomResults.value = await matrixSearchService.searchRooms(searchQuery.value)
  } catch (error) {
    message.error('搜索房间失败')
  }
}

const searchUsers = async () => {
  try {
    userResults.value = await matrixSearchService.searchUsers(searchQuery.value)
  } catch (error) {
    message.error('搜索用户失败')
  }
}

const loadMoreMessages = async () => {
  if (!messageResults.nextBatch) return

  searchOptions.offset = (searchOptions.offset || 0) + searchOptions.limit!
  await searchMessages()
}

const getSuggestions = async () => {
  if (!searchQuery.value) {
    suggestions.value = []
    return
  }

  try {
    suggestions.value = await matrixSearchService.getSearchSuggestions(searchQuery.value)
  } catch (error) {}
}

const openMessage = (result: SearchResult) => {
  emit('openMessage', result)
}

const joinRoom = (room: RoomSearchResult) => {
  emit('joinRoom', room)
}

const openUserProfile = (user: UserSearchResult) => {
  emit('openUserProfile', user)
}

const startDirectMessage = (user: UserSearchResult) => {
  emit('startDirectMessage', user)
}

// Helper methods
const getSenderInitials = (result: SearchResult): string => {
  const name = result.senderName
  if (!name) return '?'
  const names = name.split(' ')
  if (names.length >= 2) {
    return (names[0]?.[0] || '') + (names[1]?.[0] || '')
  }
  return name.substring(0, 2).toUpperCase()
}

const getUserInitials = (user: UserSearchResult): string => {
  const name = user.displayName || user.userId
  if (!name) return '?'
  const names = name.split(' ')
  if (names.length >= 2) {
    return (names[0]?.[0] || '') + (names[1]?.[0] || '')
  }
  return name.substring(0, 2).toUpperCase()
}

// Sanitize HTML content to prevent XSS attacks
const sanitizeContent = (html: string | undefined): string => {
  return sanitizeHtml(html || '')
}

const getMessagePreview = (result: SearchResult): string => {
  const content = result.content

  // Type guard for content with type property
  if (!content || typeof content !== 'object') {
    return '消息'
  }

  const typedContent = content as Record<string, unknown>
  const contentType = typedContent.type as string | undefined

  switch (contentType) {
    case 'm.text':
      return (typedContent.body as { text?: string })?.text || '文本消息'
    case 'm.image':
      return '[图片]'
    case 'm.video':
      return '[视频]'
    case 'm.audio':
      return (typedContent.body as { duration?: number })?.duration ? '[语音]' : '[音频]'
    case 'm.file':
      return `[文件] ${(typedContent.body as { fileName?: string })?.fileName || ''}`
    case 'm.location':
      return '[位置]'
    default:
      return '消息'
  }
}

const getMatchTypeColor = (type: string) => {
  switch (type) {
    case 'name':
      return 'primary'
    case 'topic':
      return 'info'
    case 'alias':
      return 'warning'
    default:
      return 'default'
  }
}

const getMatchTypeText = (type: string): string => {
  switch (type) {
    case 'name':
      return '名称匹配'
    case 'topic':
      return '主题匹配'
    case 'alias':
      return '别名匹配'
    case 'member':
      return '成员匹配'
    default:
      return '匹配'
  }
}

const getPresenceText = (presence?: string): string => {
  switch (presence) {
    case 'online':
      return '在线'
    case 'offline':
      return '离线'
    case 'unavailable':
      return '忙碌'
    default:
      return '未知'
  }
}

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 60 * 1000) {
    return '刚刚'
  } else if (diff < 60 * 60 * 1000) {
    return `${Math.floor(diff / (60 * 1000))}分钟前`
  } else if (diff < 24 * 60 * 60 * 1000) {
    return `${Math.floor(diff / (60 * 60 * 1000))}小时前`
  } else if (diff < 7 * 24 * 60 * 60 * 1000) {
    return `${Math.floor(diff / (24 * 60 * 60 * 1000))}天前`
  } else {
    return date.toLocaleDateString('zh-CN')
  }
}

const formatLastActive = (ago: number): string => {
  if (ago < 60) {
    return '刚刚在线'
  } else if (ago < 60 * 60) {
    return `${Math.floor(ago / 60)}分钟前`
  } else if (ago < 24 * 60 * 60) {
    return `${Math.floor(ago / (60 * 60))}小时前`
  } else {
    return `${Math.floor(ago / (24 * 60 * 60))}天前`
  }
}

// Matrix context event interfaces
interface MatrixEventContent {
  body?: string
}

interface MatrixEvent {
  event_id?: string
  content?: MatrixEventContent
}

interface MatrixEventWrapper {
  event?: MatrixEvent
  getId?(): string
  getContent?(): MatrixEventContent
}

// Helper methods for Matrix context events
const getContextEventId = (ctx: unknown): string => {
  const eventWrapper = ctx as MatrixEventWrapper
  return eventWrapper.event?.event_id || eventWrapper.getId?.() || ''
}

const getContextEventBody = (ctx: unknown): string => {
  const eventWrapper = ctx as MatrixEventWrapper
  const content = eventWrapper.event?.content?.body
  const getContentBody = eventWrapper.getContent?.()?.body
  return content || getContentBody || '消息'
}

// Watchers
watch(searchQuery, getSuggestions)

watch(activeTab, () => {
  if (hasSearched.value && searchQuery.value) {
    performSearch()
  }
})

// Lifecycle
onMounted(() => {
  // Load recent searches
  suggestions.value = matrixSearchService.getRecentSearches()
})
</script>

<style scoped>
.search-scope-select {
  width: 120px;
}

.message-type-select {
  width: 150px;
}

.date-range-picker {
  width: 200px;
}

.sender-select {
  width: 150px;
}

.matrix-search {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--n-color);
}

.search-input-container {
  position: relative;
  padding: 16px;
  border-bottom: 1px solid var(--n-border-color);
}

.search-suggestions {
  position: absolute;
  top: 100%;
  left: 16px;
  right: 16px;
  background: var(--n-color);
  border: 1px solid var(--n-border-color);
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(var(--hula-black-rgb), 0.1);
  z-index: 100;
  max-height: 200px;
  overflow-y: auto;
}

.suggestion-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.suggestion-item:hover {
  background: var(--n-hover-color);
}

.advanced-search {
  padding: 16px;
  background: var(--n-hover-color);
  border-bottom: 1px solid var(--n-border-color);
}

.search-tabs {
  padding: 0 16px;
  border-bottom: 1px solid var(--n-border-color);
}

.search-results {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 32px;
  color: var(--n-text-color-3);
}

.empty-result {
  display: flex;
  justify-content: center;
  padding: 32px;
}

.message-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message-result-item {
  padding: 12px;
  background: var(--n-color);
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.message-result-item:hover {
  border-color: var(--n-primary-color);
  box-shadow: 0 2px 8px rgba(var(--hula-black-rgb), 0.1);
}

.message-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.message-meta {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--n-text-color-3);
}

.sender-name {
  font-weight: 500;
  color: var(--n-text-color-1);
}

.room-name {
  color: var(--n-primary-color);
}

.message-time {
  margin-left: auto;
}

.message-content {
  font-size: 14px;
  line-height: 1.5;
  color: var(--n-text-color-1);
}

.content-text {
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.message-context {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--n-border-color);
}

.context-messages {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.context-message {
  padding: 4px 8px;
  font-size: 12px;
  color: var(--n-text-color-3);
  background: var(--n-hover-color);
  border-radius: 4px;
}

.context-message.current {
  background: var(--n-primary-color-pressed);
  color: white;
}

.load-more {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}

.room-list,
.user-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.room-result-item,
.user-result-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--n-color);
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.room-result-item:hover,
.user-result-item:hover {
  border-color: var(--n-primary-color);
  box-shadow: 0 2px 8px rgba(var(--hula-black-rgb), 0.1);
}

.room-info,
.user-info {
  flex: 1;
  min-width: 0;
}

.room-name,
.user-name {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 500;
  color: var(--n-text-color-1);
}

.room-topic,
.user-id {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: var(--n-text-color-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-meta,
.user-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.member-count,
.last-active {
  font-size: 12px;
  color: var(--n-text-color-3);
}

/* Highlight search terms */
:deep(mark) {
  background: rgba(var(--n-warning-color-rgb), 0.2);
  color: var(--n-warning-color);
  padding: 0 2px;
  border-radius: 2px;
}
</style>
