<!-- Mobile User Search - Search for Matrix users on mobile -->
<template>
  <div class="mobile-user-search">
    <!-- Search Bar -->
    <div class="search-bar-section">
      <n-input
        v-model:value="searchQuery"
        type="text"
        placeholder="搜索用户 (例如: @username:server.com)"
        clearable
        :loading="searching"
        @keyup.enter="handleSearch"
        @input="handleInput">
        <template #prefix>
          <n-icon>
            <Search />
          </n-icon>
        </template>
        <template #suffix>
          <n-button v-if="searchQuery" text type="primary" :loading="searching" @click="handleSearch">搜索</n-button>
        </template>
      </n-input>
    </div>

    <!-- Search History -->
    <div v-if="!hasSearched && searchHistory.length > 0" class="search-history-section">
      <div class="section-header">
        <span class="section-title">最近搜索</span>
        <n-button text size="small" @click="clearHistory">清除</n-button>
      </div>
      <div class="history-list">
        <div v-for="item in searchHistory" :key="item.userId" class="history-item" @click="searchFromHistory(item)">
          <n-icon size="16">
            <History />
          </n-icon>
          <span class="history-text">{{ item.displayName || item.userId }}</span>
          <n-icon size="14" class="remove-icon" @click.stop="removeFromHistory(item.userId)">
            <X />
          </n-icon>
        </div>
      </div>
    </div>

    <!-- Search Results -->
    <div v-if="hasSearched" class="search-results-section">
      <!-- Loading State -->
      <div v-if="searching" class="loading-state">
        <n-spin size="medium" />
        <p>搜索中...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="error-state">
        <n-icon :size="48" color="var(--hula-error)">
          <AlertCircle />
        </n-icon>
        <p>{{ error }}</p>
        <n-button type="primary" @click="handleSearch">重试</n-button>
      </div>

      <!-- Empty State -->
      <div v-else-if="searchResults.length === 0" class="empty-state">
        <n-icon :size="64" color="#c0c0c0">
          <Search />
        </n-icon>
        <p>未找到匹配的用户</p>
        <p class="hint">尝试输入完整的 Matrix ID (如 @username:server.com)</p>
      </div>

      <!-- Results List -->
      <div v-else class="results-list">
        <div class="results-count">找到 {{ searchResults.length }} 个用户</div>

        <div v-for="user in searchResults" :key="user.userId" class="user-item" @click="handleUserClick(user)">
          <n-avatar :src="getAvatarUrl(user.avatarUrl)" :size="48" round class="user-avatar">
            {{ getInitials(user.displayName) }}
          </n-avatar>

          <div class="user-info">
            <div class="user-name">{{ user.displayName || '未知用户' }}</div>
            <div class="user-id">{{ formatUserId(user.userId) }}</div>
            <div v-if="user.presence" class="user-presence">
              <span class="presence-dot" :class="user.presence"></span>
              {{ getPresenceText(user.presence) }}
            </div>
          </div>

          <div class="user-actions">
            <n-button
              v-if="!isFriend(user.userId)"
              type="primary"
              size="small"
              :loading="addingFriend === user.userId"
              @click.stop="handleAddFriend(user)">
              <template #icon>
                <n-icon><UserPlus /></n-icon>
              </template>
              添加
            </n-button>
            <n-button v-else secondary size="small" @click.stop="handleStartChat(user)">
              <template #icon>
                <n-icon><Message /></n-icon>
              </template>
              聊天
            </n-button>
          </div>
        </div>
      </div>
    </div>

    <!-- User Detail Modal -->
    <n-modal
      v-model:show="showUserDetail"
      preset="card"
      :style="{ maxWidth: '400px' }"
      :title="selectedUser?.displayName || '用户详情'">
      <div v-if="selectedUser" class="user-detail">
        <div class="detail-header">
          <n-avatar :src="getAvatarUrl(selectedUser.avatarUrl)" :size="80" round>
            {{ getInitials(selectedUser.displayName) }}
          </n-avatar>
          <div class="header-info">
            <h3>{{ selectedUser.displayName || '未知用户' }}</h3>
            <p class="user-id-full">{{ selectedUser.userId }}</p>
          </div>
        </div>

        <div v-if="selectedUser.presence" class="detail-status">
          <span class="status-dot" :class="selectedUser.presence"></span>
          {{ getPresenceText(selectedUser.presence) }}
        </div>

        <n-divider />

        <div class="detail-actions">
          <n-button
            v-if="!isFriend(selectedUser.userId)"
            type="primary"
            block
            size="large"
            :loading="addingFriend === selectedUser.userId"
            @click="handleAddFriend(selectedUser)">
            <template #icon>
              <n-icon><UserPlus /></n-icon>
            </template>
            添加为好友
          </n-button>
          <template v-else>
            <n-button secondary block size="large" @click="handleStartChat(selectedUser)">
              <template #icon>
                <n-icon><Message /></n-icon>
              </template>
              发送消息
            </n-button>
            <n-button tertiary block size="large" @click="handleViewProfile(selectedUser)">
              <template #icon>
                <n-icon><User /></n-icon>
              </template>
              查看资料
            </n-button>
          </template>
        </div>
      </div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { NInput, NIcon, NButton, NAvatar, NModal, NSpin, NDivider, useMessage } from 'naive-ui'
import { Search, History, X, AlertCircle, UserPlus, Message, User } from '@vicons/tabler'
import { matrixClientService } from '@/integrations/matrix/client'
import { mxcUrlToHttp } from '@/utils/matrixClientUtils'
import { logger } from '@/utils/logger'

interface SearchResult {
  userId: string
  displayName?: string
  avatarUrl?: string
  presence?: 'online' | 'offline' | 'unavailable'
}

interface SearchHistoryItem {
  userId: string
  displayName?: string
  timestamp: number
}

interface Props {
  enableFriendCheck?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  enableFriendCheck: true
})

const emit = defineEmits<{
  (e: 'user-selected', user: SearchResult): void
  (e: 'start-chat', userId: string): void
  (e: 'add-friend', userId: string): void
}>()

const message = useMessage()

// State
const searchQuery = ref('')
const searching = ref(false)
const hasSearched = ref(false)
const error = ref<string | null>(null)
const searchResults = ref<SearchResult[]>([])
const searchHistory = ref<SearchHistoryItem[]>([])
const showUserDetail = ref(false)
const selectedUser = ref<SearchResult | null>(null)
const addingFriend = ref<string | null>(null)
const friendList = ref<Set<string>>(new Set())

// Constants
const HISTORY_STORAGE_KEY = 'matrix_user_search_history'
const MAX_HISTORY_ITEMS = 10

// Computed
const validSearchQuery = computed(() => {
  const query = searchQuery.value.trim()
  // Check if it's a valid Matrix ID format or at least 2 characters
  return query && (query.startsWith('@') || query.length >= 2)
})

// Methods
const handleInput = () => {
  // Debounce could be added here
  error.value = null
}

const handleSearch = async () => {
  const query = searchQuery.value.trim()
  if (!query) {
    message.warning('请输入搜索内容')
    return
  }

  searching.value = true
  error.value = null
  hasSearched.value = true

  try {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    const clientMethods = client as Record<string, unknown>

    // Use searchUserDirectory if available
    if (typeof clientMethods.searchUserDirectory === 'function') {
      const results = (await clientMethods.searchUserDirectory({
        term: query,
        limit: 20
      })) as { results?: Array<{ user_id: string; display_name?: string; avatar_url?: string }> }

      if (results?.results) {
        searchResults.value = results.results.map((r) => ({
          userId: r.user_id,
          displayName: r.display_name,
          avatarUrl: r.avatar_url,
          presence: 'offline' // Presence info not included in search
        }))
      } else {
        searchResults.value = []
      }
    } else {
      // Fallback: Try direct lookup if it's a Matrix ID
      if (query.startsWith('@') && query.includes(':')) {
        searchResults.value = [
          {
            userId: query,
            displayName: query.split(':')[0].replace(/^@/, ''),
            presence: 'offline'
          }
        ]
      } else {
        searchResults.value = []
      }
    }

    // Add to history
    if (searchResults.value.length > 0) {
      addToHistory(searchResults.value[0])
    }

    logger.info('[UserSearch] Search completed:', {
      query,
      resultCount: searchResults.value.length
    })
  } catch (err) {
    logger.error('[UserSearch] Search failed:', err)
    error.value = '搜索失败，请重试'
    searchResults.value = []
  } finally {
    searching.value = false
  }
}

const searchFromHistory = (item: SearchHistoryItem) => {
  searchQuery.value = item.userId
  handleSearch()
}

const addToHistory = (user: SearchResult) => {
  const exists = searchHistory.value.find((h) => h.userId === user.userId)
  if (exists) {
    // Move to top
    searchHistory.value = searchHistory.value.filter((h) => h.userId !== user.userId)
  }

  searchHistory.value.unshift({
    userId: user.userId,
    displayName: user.displayName,
    timestamp: Date.now()
  })

  // Trim to max
  if (searchHistory.value.length > MAX_HISTORY_ITEMS) {
    searchHistory.value = searchHistory.value.slice(0, MAX_HISTORY_ITEMS)
  }

  // Save to localStorage
  saveHistory()
}

const removeFromHistory = (userId: string) => {
  searchHistory.value = searchHistory.value.filter((h) => h.userId !== userId)
  saveHistory()
}

const clearHistory = () => {
  searchHistory.value = []
  saveHistory()
}

const saveHistory = () => {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(searchHistory.value))
  } catch (err) {
    logger.error('[UserSearch] Failed to save history:', err)
  }
}

const loadHistory = () => {
  try {
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY)
    if (stored) {
      searchHistory.value = JSON.parse(stored)
    }
  } catch (err) {
    logger.error('[UserSearch] Failed to load history:', err)
  }
}

const handleUserClick = (user: SearchResult) => {
  selectedUser.value = user
  showUserDetail.value = true
  emit('user-selected', user)
}

const handleAddFriend = async (user: SearchResult) => {
  addingFriend.value = user.userId

  try {
    emit('add-friend', user.userId)
    message.success(`已发送好友请求给 ${user.displayName || user.userId}`)
    friendList.value.add(user.userId)
  } catch (err) {
    logger.error('[UserSearch] Failed to add friend:', err)
    message.error('添加好友失败')
  } finally {
    addingFriend.value = null
  }
}

const handleStartChat = (user: SearchResult) => {
  showUserDetail.value = false
  emit('start-chat', user.userId)
  message.info(`正在与 ${user.displayName || user.userId} 开始聊天`)
}

const handleViewProfile = (_user: SearchResult) => {
  message.info('查看用户资料功能开发中')
}

const isFriend = (userId: string): boolean => {
  return friendList.value.has(userId)
}

const getAvatarUrl = (mxcUrl?: string): string | undefined => {
  if (!mxcUrl) return undefined
  try {
    const client = matrixClientService.getClient()
    if (!client) return undefined
    return mxcUrlToHttp(client as Record<string, unknown> | null, mxcUrl, 80, 80, 'crop') || undefined
  } catch {
    return undefined
  }
}

const getInitials = (name?: string): string => {
  if (!name) return '?'
  const parts = name.split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

const formatUserId = (userId: string): string => {
  // Shorten for display
  if (userId.length <= 30) return userId

  const parts = userId.split(':')
  if (parts.length >= 2) {
    const local = parts[0]
    const server = parts[1]
    if (local.length > 15) {
      return `${local.slice(0, 12)}...@${server.slice(0, 10)}...`
    }
  }
  return `${userId.slice(0, 15)}...${userId.slice(-15)}`
}

const getPresenceText = (presence: string): string => {
  switch (presence) {
    case 'online':
      return '在线'
    case 'offline':
      return '离线'
    case 'unavailable':
      return '离开'
    default:
      return '未知'
  }
}

const loadFriendList = async () => {
  if (!props.enableFriendCheck) return

  try {
    // Load friend list from store or API
    // This is a placeholder - implement based on your friend system
    const client = matrixClientService.getClient()
    if (!client) return

    // Example: Load from Matrix account data or custom friends API
    friendList.value = new Set()
  } catch (err) {
    logger.error('[UserSearch] Failed to load friend list:', err)
  }
}

// Lifecycle
onMounted(() => {
  loadHistory()
  loadFriendList()
})

// Expose methods
defineExpose({
  search: handleSearch,
  clearResults: () => {
    searchResults.value = []
    hasSearched.value = false
  }
})
</script>

<style scoped lang="scss">
.mobile-user-search {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-color);
}

.search-bar-section {
  padding: 12px;
  background: var(--card-color);
  border-bottom: 1px solid var(--border-color);
}

.search-history-section {
  padding: 16px 12px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;

  .section-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-color-2);
  }
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--card-color);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;

  &:active {
    background: var(--item-hover-bg);
  }

  .history-text {
    flex: 1;
    font-size: 14px;
    color: var(--text-color-1);
  }

  .remove-icon {
    color: var(--text-color-3);
    padding: 4px;

    &:active {
      color: var(--hula-error);
    }
  }
}

.search-results-section {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  gap: 16px;

  p {
    color: var(--text-color-3);
    margin: 0;
    text-align: center;
  }

  .hint {
    font-size: 12px;
    color: var(--text-color-3);
    max-width: 280px;
  }
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.results-count {
  font-size: 13px;
  color: var(--text-color-3);
  padding: 8px 12px;
  text-align: center;
}

.user-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--card-color);
  border-radius: 12px;
  transition: background 0.2s;

  &:active {
    background: var(--item-hover-bg);
  }

  .user-avatar {
    flex-shrink: 0;
  }

  .user-info {
    flex: 1;
    min-width: 0;

    .user-name {
      font-size: 15px;
      font-weight: 500;
      color: var(--text-color-1);
      margin-bottom: 2px;
    }

    .user-id {
      font-size: 12px;
      color: var(--text-color-3);
      font-family: 'Monaco', 'Consolas', monospace;
      margin-bottom: 4px;
    }

    .user-presence {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      color: var(--text-color-3);

      .presence-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;

        &.online {
          background: var(--hula-success);
        }

        &.offline {
          background: #c0c0c0;
        }

        &.unavailable {
          background: var(--hula-warning);
        }
      }
    }
  }

  .user-actions {
    flex-shrink: 0;
  }
}

// User Detail Modal
.user-detail {
  .detail-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 20px 0;

    .header-info {
      text-align: center;

      h3 {
        margin: 0 0 4px 0;
        font-size: 18px;
        font-weight: 600;
        color: var(--text-color-1);
      }

      .user-id-full {
        margin: 0;
        font-size: 13px;
        color: var(--text-color-3);
        font-family: 'Monaco', 'Consolas', monospace;
      }
    }
  }

  .detail-status {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    background: var(--bg-color);
    border-radius: 8px;
    font-size: 14px;
    color: var(--text-color-2);

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;

      &.online {
        background: var(--hula-success);
      }

      &.offline {
        background: #c0c0c0;
      }

      &.unavailable {
        background: var(--hula-warning);
      }
    }
  }

  .detail-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
}

// Touch-friendly sizing
@media (pointer: coarse) {
  .user-item,
  .history-item {
    min-height: 60px;
  }
}
</style>
