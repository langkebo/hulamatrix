<!-- Mobile Room Search - Room search functionality for mobile -->
<template>
  <div class="mobile-room-search">
    <!-- Search Input -->
    <div class="search-header">
      <n-input
        v-model:value="searchQuery"
        type="text"
        placeholder="搜索房间..."
        clearable
        autofocus
        size="large"
        @input="handleSearchInput"
        @focus="handleFocus"
        @blur="handleBlur">
        <template #prefix>
          <n-icon :size="20">
            <Search />
          </n-icon>
        </template>
        <template #suffix>
          <n-button v-if="searchQuery" text @click="clearSearch">
            <template #icon>
              <n-icon><X /></n-icon>
            </template>
          </n-button>
        </template>
      </n-input>

      <!-- Filter Button -->
      <n-button text @click="showFilterSheet = true">
        <template #icon>
          <n-icon :size="20">
            <Filter />
          </n-icon>
        </template>
      </n-button>
    </div>

    <!-- Search Suggestions (when query is empty) -->
    <div v-if="!searchQuery && !isFocused && recentSearches.length > 0" class="search-suggestions">
      <div class="suggestions-header">
        <span class="suggestions-title">最近搜索</span>
        <n-button text type="error" size="small" @click="clearRecentSearches">清空</n-button>
      </div>

      <div class="suggestions-list">
        <div
          v-for="item in recentSearches"
          :key="item.query"
          class="suggestion-item"
          @click="applySuggestion(item.query)">
          <n-icon :size="16"><Clock /></n-icon>
          <span>{{ item.query }}</span>
          <n-button text size="small" @click.stop="removeSuggestion(item.query)">
            <template #icon>
              <n-icon><X /></n-icon>
            </template>
          </n-button>
        </div>
      </div>
    </div>

    <!-- Search Results -->
    <div v-if="searchQuery" class="search-results">
      <!-- Loading State -->
      <div v-if="searching" class="loading-state">
        <n-spin size="medium" />
        <p class="mt-12px">搜索中...</p>
      </div>

      <!-- No Results -->
      <div v-else-if="!hasResults" class="no-results">
        <n-icon :size="48" color="#d0d0d0">
          <Search />
        </n-icon>
        <p>未找到匹配的房间</p>
        <n-text depth="3">请尝试其他关键词</n-text>
      </div>

      <!-- Results List -->
      <div v-else class="results-list">
        <!-- Room Results -->
        <div v-if="roomResults.length > 0" class="result-section">
          <div class="section-header">
            <span>房间 ({{ roomResults.length }})</span>
          </div>

          <div v-for="room in roomResults" :key="room.roomId" class="room-item" @click="openRoom(room.roomId)">
            <n-avatar :src="room.avatar" :size="48" round>
              <template #fallback>
                <span>{{ room.name?.[0] || '?' }}</span>
              </template>
            </n-avatar>

            <div class="room-info">
              <div class="room-name">{{ highlightMatch(room.name) }}</div>
              <div class="room-topic">{{ highlightMatch(room.topic || '') }}</div>
              <div class="room-meta">
                <span>{{ room.memberCount || 0 }} 成员</span>
                <span v-if="room.isEncrypted" class="encrypted-badge">
                  <n-icon :size="12"><Lock /></n-icon>
                  加密
                </span>
              </div>
            </div>

            <div class="room-action">
              <n-icon :size="20"><ChevronRight /></n-icon>
            </div>
          </div>
        </div>

        <!-- Message Results -->
        <div v-if="messageResults.length > 0" class="result-section">
          <div class="section-header">
            <span>消息 ({{ messageResults.length }})</span>
          </div>

          <div v-for="msg in messageResults" :key="msg.eventId" class="message-item" @click="openMessage(msg)">
            <div class="message-room">
              {{ msg.roomName }}
            </div>
            <div class="message-content">{{ highlightMatch(msg.content) }}</div>
            <div class="message-meta">
              <span>{{ msg.senderName }}</span>
              <span>{{ formatTimestamp(msg.timestamp) }}</span>
            </div>
          </div>
        </div>

        <!-- User Results -->
        <div v-if="userResults.length > 0" class="result-section">
          <div class="section-header">
            <span>用户 ({{ userResults.length }})</span>
          </div>

          <div v-for="user in userResults" :key="user.userId" class="user-item" @click="openUserChat(user.userId)">
            <n-avatar :src="user.avatar" :size="40" round>
              <template #fallback>
                <span>{{ user.displayName?.[0] || user.userId[1] }}</span>
              </template>
            </n-avatar>

            <div class="user-info">
              <div class="user-name">{{ highlightMatch(user.displayName || user.userId) }}</div>
              <div class="user-id">{{ user.userId }}</div>
            </div>

            <div class="user-action">
              <n-button type="primary" size="small" round>发消息</n-button>
            </div>
          </div>
        </div>
      </div>

      <!-- Load More -->
      <div v-if="hasMore" class="load-more">
        <n-button text block :loading="loadingMore" @click="loadMore">加载更多</n-button>
      </div>
    </div>

    <!-- Filter Bottom Sheet -->
    <n-modal
      v-model:show="showFilterSheet"
      :mask-closable="true"
      :style="{
        width: '100%',
        maxWidth: '100%',
        position: 'fixed',
        bottom: '0',
        margin: '0',
        borderRadius: '16px 16px 0 0'
      }"
      preset="card"
      title="搜索筛选">
      <div class="filter-content">
        <!-- Search Scope -->
        <div class="filter-group">
          <div class="filter-label">搜索范围</div>
          <n-checkbox-group v-model:value="searchScope">
            <n-space vertical>
              <n-checkbox value="rooms" label="房间名称" />
              <n-checkbox value="messages" label="消息内容" />
              <n-checkbox value="members" label="成员列表" />
              <n-checkbox value="topics" label="房间主题" />
            </n-space>
          </n-checkbox-group>
        </div>

        <!-- Room Type Filter -->
        <div class="filter-group">
          <div class="filter-label">房间类型</div>
          <n-radio-group v-model:value="roomType" name="roomType">
            <n-space vertical>
              <n-radio value="all">全部</n-radio>
              <n-radio value="direct">私聊</n-radio>
              <n-radio value="group">群组</n-radio>
            </n-space>
          </n-radio-group>
        </div>

        <!-- Encryption Filter -->
        <div class="filter-group">
          <div class="filter-label">加密状态</div>
          <n-radio-group v-model:value="encryptionFilter" name="encryption">
            <n-space vertical>
              <n-radio value="all">全部</n-radio>
              <n-radio value="encrypted">仅加密房间</n-radio>
              <n-radio value="unencrypted">仅未加密房间</n-radio>
            </n-space>
          </n-radio-group>
        </div>
      </div>

      <template #footer>
        <n-space vertical style="width: 100%">
          <n-button type="primary" block @click="applyFilters">应用筛选</n-button>
          <n-button block @click="resetFilters">重置</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  NInput,
  NButton,
  NIcon,
  NSpin,
  NAvatar,
  NModal,
  NSpace,
  NCheckboxGroup,
  NCheckbox,
  NRadioGroup,
  NRadio,
  NText
} from 'naive-ui'
import { Search, X, Filter, Clock, Lock, ChevronRight } from '@vicons/tabler'
import { matrixClientService } from '@/integrations/matrix/client'
import { matrixSearchServiceCompat as matrixSearchService } from '@/integrations/matrix/search'
import { msg } from '@/utils/SafeUI'
import { logger } from '@/utils/logger'
import { useHaptic } from '@/composables/useMobileGestures'

interface RecentSearch {
  query: string
  timestamp: number
}

interface RoomResult {
  roomId: string
  name: string
  topic?: string
  avatar?: string
  memberCount?: number
  isEncrypted?: boolean
  isDirect?: boolean
}

interface MessageResult {
  eventId: string
  roomId: string
  roomName: string
  content: string
  senderName: string
  timestamp: number
}

interface UserResult {
  userId: string
  displayName?: string
  avatar?: string
}

const props = defineProps<{
  initialQuery?: string
}>()

const emit = defineEmits<{
  (e: 'room-selected', roomId: string): void
  (e: 'message-selected', data: { roomId: string; eventId: string }): void
  (e: 'close'): void
}>()

const router = useRouter()
const { success, error, selection, warning } = useHaptic()

// State
const searchQuery = ref(props.initialQuery || '')
const searching = ref(false)
const loadingMore = ref(false)
const isFocused = ref(false)
const showFilterSheet = ref(false)

// Search results
const roomResults = ref<RoomResult[]>([])
const messageResults = ref<MessageResult[]>([])
const userResults = ref<UserResult[]>([])

// Pagination
const currentPage = ref(1)
const hasMore = ref(false)
const totalResults = ref(0)

// Filters
const searchScope = ref<string[]>(['rooms', 'messages'])
const roomType = ref<'all' | 'direct' | 'group'>('all')
const encryptionFilter = ref<'all' | 'encrypted' | 'unencrypted'>('all')

// Recent searches
const recentSearches = ref<RecentSearch[]>([])
const STORAGE_KEY = 'room-search-recent'

// Debounce timer
let searchTimer: number | null = null

// Computed
const hasResults = computed(() => {
  return roomResults.value.length > 0 || messageResults.value.length > 0 || userResults.value.length > 0
})

// Methods
const handleSearchInput = () => {
  if (searchTimer) {
    clearTimeout(searchTimer)
  }

  searchTimer = window.setTimeout(() => {
    performSearch()
  }, 300)
}

const performSearch = async (page = 1) => {
  const query = searchQuery.value.trim()
  if (!query) {
    roomResults.value = []
    messageResults.value = []
    userResults.value = []
    return
  }

  if (page === 1) {
    searching.value = true
  } else {
    loadingMore.value = true
  }

  try {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not available')
    }

    // Search rooms
    if (searchScope.value.includes('rooms')) {
      const rooms = await searchRooms(query, page)
      if (page === 1) {
        roomResults.value = rooms
      } else {
        roomResults.value.push(...rooms)
      }
    }

    // Search messages
    if (searchScope.value.includes('messages')) {
      const messages = await searchMessages(query, page)
      if (page === 1) {
        messageResults.value = messages
      } else {
        messageResults.value.push(...messages)
      }
    }

    // Search users
    if (searchScope.value.includes('members')) {
      const users = await searchUsers(query)
      userResults.value = users
    }

    // Save to recent searches
    if (page === 1) {
      saveRecentSearch(query)
    }

    currentPage.value = page
    hasMore.value = page * 20 < totalResults.value
  } catch (error) {
    logger.error('[MobileRoomSearch] Search failed:', error)
    msg.error('搜索失败')
  } finally {
    searching.value = false
    loadingMore.value = false
  }
}

const searchRooms = async (query: string, _page: number): Promise<RoomResult[]> => {
  const client = matrixClientService.getClient()
  if (!client) return []

  // Type assertion for Matrix client methods
  const extendedClient = client as {
    getRooms: () => Array<{
      roomId: string
      name?: string
      isDirectRoom: () => boolean
      hasEncryptionStateEvent: () => boolean
      getTopic: () => string | undefined
      getAvatarUrl?: (baseUrl: string, width: number, height: number, method: string) => string | undefined
      getJoinedMemberCount: () => number | undefined
    }>
    baseUrl: string
  }

  const rooms = extendedClient.getRooms()
  const results: RoomResult[] = []

  for (const room of rooms) {
    // Apply filters
    if (roomType.value === 'direct' && !room.isDirectRoom()) continue
    if (roomType.value === 'group' && room.isDirectRoom()) continue
    if (encryptionFilter.value === 'encrypted' && !room.hasEncryptionStateEvent()) continue
    if (encryptionFilter.value === 'unencrypted' && room.hasEncryptionStateEvent()) continue

    // Search in name
    const name = room.name || room.roomId
    if (name.toLowerCase().includes(query.toLowerCase())) {
      results.push({
        roomId: room.roomId,
        name,
        topic: room.getTopic() || undefined,
        avatar: room.getAvatarUrl?.(extendedClient.baseUrl, 80, 80, 'crop') || undefined,
        memberCount: room.getJoinedMemberCount() || undefined,
        isEncrypted: room.hasEncryptionStateEvent(),
        isDirect: room.isDirectRoom()
      })
    }
  }

  return results
}

const searchMessages = async (query: string, page: number): Promise<MessageResult[]> => {
  const client = matrixClientService.getClient()
  if (!client) return []

  try {
    const response = await matrixSearchService.searchMessages({
      query,
      limit: 20,
      offset: (page - 1) * 20
    })

    totalResults.value = response.count

    return response.results.map((r) => ({
      eventId: r.eventId,
      roomId: r.roomId,
      roomName: r.roomName || r.roomId,
      content: String(r.content || ''),
      senderName: r.senderName || '',
      timestamp: r.timestamp
    }))
  } catch {
    return []
  }
}

const searchUsers = async (query: string): Promise<UserResult[]> => {
  const client = matrixClientService.getClient()
  if (!client) return []

  try {
    const results = await matrixSearchService.searchUsers(query)
    return results.map((u) => ({
      userId: u.userId,
      displayName: u.displayName,
      avatar: u.avatar
    }))
  } catch {
    return []
  }
}

const loadMore = () => {
  performSearch(currentPage.value + 1)
  selection()
}

const clearSearch = () => {
  searchQuery.value = ''
  roomResults.value = []
  messageResults.value = []
  userResults.value = []
  selection()
}

const handleFocus = () => {
  isFocused.value = true
}

const handleBlur = () => {
  // Delay to allow clicks on suggestions
  setTimeout(() => {
    isFocused.value = false
  }, 200)
}

const openRoom = (roomId: string) => {
  emit('room-selected', roomId)
  selection()
}

const openMessage = (msg: MessageResult) => {
  emit('message-selected', { roomId: msg.roomId, eventId: msg.eventId })
  selection()
}

const openUserChat = (userId: string) => {
  // Start a direct message with this user
  router.push({
    path: '/mobile/chat',
    query: { userId }
  })
  selection()
}

const applySuggestion = (query: string) => {
  searchQuery.value = query
  performSearch()
  selection()
}

const highlightMatch = (text: string): string => {
  if (!searchQuery.value) return text

  const regex = new RegExp(`(${searchQuery.value})`, 'gi')
  return text.replace(regex, '<mark>$1</mark>')
}

const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`

  return date.toLocaleDateString()
}

// Recent searches management
const loadRecentSearches = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      recentSearches.value = JSON.parse(stored)
    }
  } catch {
    recentSearches.value = []
  }
}

const saveRecentSearch = (query: string) => {
  const existing = recentSearches.value.findIndex((s) => s.query === query)

  if (existing >= 0) {
    recentSearches.value.splice(existing, 1)
  }

  recentSearches.value.unshift({
    query,
    timestamp: Date.now()
  })

  // Keep only 10 recent searches
  if (recentSearches.value.length > 10) {
    recentSearches.value = recentSearches.value.slice(0, 10)
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recentSearches.value))
  } catch {
    // Ignore storage errors
  }
}

const removeSuggestion = (query: string) => {
  recentSearches.value = recentSearches.value.filter((s) => s.query !== query)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recentSearches.value))
  } catch {
    // Ignore storage errors
  }
  selection()
}

const clearRecentSearches = () => {
  recentSearches.value = []
  localStorage.removeItem(STORAGE_KEY)
  selection()
}

// Filters
const applyFilters = () => {
  showFilterSheet.value = false
  performSearch(1)
  selection()
}

const resetFilters = () => {
  searchScope.value = ['rooms', 'messages']
  roomType.value = 'all'
  encryptionFilter.value = 'all'
  selection()
}

// Lifecycle
onMounted(() => {
  loadRecentSearches()

  if (props.initialQuery) {
    performSearch()
  }
})

// Watch search scope changes to trigger search
watch([searchScope, roomType, encryptionFilter], () => {
  if (searchQuery.value) {
    performSearch(1)
  }
})
</script>

<style scoped lang="scss">
.mobile-room-search {
  padding: 16px;
  min-height: 100vh;
  background: var(--bg-color);
}

.search-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.search-suggestions {
  .suggestions-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;

    .suggestions-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-color-3);
    }
  }

  .suggestions-list {
    .suggestion-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: var(--card-color);
      border-radius: 8px;
      margin-bottom: 6px;
      cursor: pointer;

      &:active {
        background: var(--item-hover-bg);
      }

      span {
        flex: 1;
        font-size: 14px;
        color: var(--text-color-1);
      }
    }
  }
}

.loading-state,
.no-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 20px;

  p {
    margin-top: 16px;
    color: var(--text-color-3);
  }
}

.search-results {
  .result-section {
    margin-bottom: 24px;

    .section-header {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-color-3);
      margin-bottom: 8px;
      padding: 0 4px;
    }
  }
}

.results-list {
  .room-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: var(--card-color);
    border-radius: 8px;
    margin-bottom: 6px;
    cursor: pointer;

    &:active {
      background: var(--item-hover-bg);
    }

    .room-info {
      flex: 1;
      min-width: 0;

      .room-name {
        font-size: 15px;
        font-weight: 500;
        color: var(--text-color-1);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        margin-bottom: 4px;
      }

      .room-topic {
        font-size: 13px;
        color: var(--text-color-3);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        margin-bottom: 6px;
      }

      .room-meta {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 12px;
        color: var(--text-color-3);

        .encrypted-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          color: #18a058;
        }
      }
    }

    .room-action {
      color: var(--text-color-3);
    }
  }

  .message-item {
    padding: 12px;
    background: var(--card-color);
    border-radius: 8px;
    margin-bottom: 6px;
    cursor: pointer;

    &:active {
      background: var(--item-hover-bg);
    }

    .message-room {
      font-size: 12px;
      color: var(--primary-color);
      margin-bottom: 6px;
    }

    .message-content {
      font-size: 14px;
      color: var(--text-color-1);
      line-height: 1.5;
      margin-bottom: 6px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .message-meta {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: var(--text-color-3);
    }
  }

  .user-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: var(--card-color);
    border-radius: 8px;
    margin-bottom: 6px;
    cursor: pointer;

    &:active {
      background: var(--item-hover-bg);
    }

    .user-info {
      flex: 1;

      .user-name {
        font-size: 15px;
        font-weight: 500;
        color: var(--text-color-1);
        margin-bottom: 4px;
      }

      .user-id {
        font-size: 12px;
        color: var(--text-color-3);
      }
    }

    .user-action {
      flex-shrink: 0;
    }
  }
}

.load-more {
  margin-top: 16px;
}

.filter-content {
  .filter-group {
    margin-bottom: 24px;

    .filter-label {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-color-1);
      margin-bottom: 12px;
    }
  }
}

// Highlight matches
:deep(mark) {
  background: rgba(24, 160, 88, 0.2);
  color: inherit;
  padding: 0 2px;
  border-radius: 2px;
}
</style>
