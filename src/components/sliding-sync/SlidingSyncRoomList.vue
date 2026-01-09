<!--
  SlidingSyncRoomList Component
  Display room list using Sliding Sync protocol with virtual scrolling
-->
<template>
  <div class="sliding-sync-room-list">
    <!-- Loading State -->
    <div v-if="loading && !safeRooms.length" class="loading-state">
      <n-spin size="medium" />
      <p>加载房间中...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <n-icon :component="AlertCircle" size="48" color="var(--hula-brand-primary)" />
      <p>{{ error }}</p>
      <n-button @click="handleRetry">重试</n-button>
    </div>

    <!-- Empty State -->
    <div v-else-if="!safeRooms.length && !loading" class="empty-state">
      <n-icon :component="Inbox" size="48" color="var(--hula-gray-400)" />
      <p>暂无房间</p>
    </div>

    <!-- Room List -->
    <div v-else class="room-list-container">
      <!-- Search Bar -->
      <div v-if="showSearch" class="search-bar">
        <n-input
          v-model:value="searchQuery"
          placeholder="搜索房间..."
          clearable
          @input="handleSearchDebounced"
        >
          <template #prefix>
            <n-icon :component="Search" />
          </template>
        </n-input>
      </div>

      <!-- Room Groups -->
      <div class="room-list">
        <!-- Favorites Section -->
        <div v-if="safeFavorites.length > 0" class="room-group">
          <div class="group-header" @click="toggleGroup('favorites')">
            <n-icon :component="Star" />
            <span>收藏房间</span>
            <span class="count">({{ safeFavorites.length }})</span>
            <n-icon :component="expandedGroups.favorites ? ChevronDown : ChevronRight" />
          </div>
          <n-collapse-transition :show="expandedGroups.favorites">
            <div class="room-items">
              <SlidingSyncRoomItem
                v-for="room in safeFavorites"
                :key="room.room_id"
                :room="room"
                :selected="selectedRoomId === room.room_id"
                @select="handleSelectRoom"
              />
            </div>
          </n-collapse-transition>
        </div>

        <!-- Unread Section -->
        <div v-if="safeUnread.length > 0" class="room-group">
          <div class="group-header" @click="toggleGroup('unread')">
            <n-icon :component="Notification" />
            <span>未读消息</span>
            <span class="count">({{ safeUnread.length }})</span>
            <n-icon :component="expandedGroups.unread ? ChevronDown : ChevronRight" />
          </div>
          <n-collapse-transition :show="expandedGroups.unread">
            <div class="room-items">
              <SlidingSyncRoomItem
                v-for="room in safeUnread"
                :key="room.room_id"
                :room="room"
                :selected="selectedRoomId === room.room_id"
                @select="handleSelectRoom"
              />
            </div>
          </n-collapse-transition>
        </div>

        <!-- All Rooms Section -->
        <div class="room-group">
          <div class="group-header" @click="toggleGroup('all')">
            <n-icon :component="Users" />
            <span>所有房间</span>
            <span class="count">({{ safeRooms.length }})</span>
            <n-icon :component="expandedGroups.all ? ChevronDown : ChevronRight" />
          </div>
          <n-collapse-transition :show="expandedGroups.all">
            <div class="room-items">
              <SlidingSyncRoomItem
                v-for="room in safeRooms"
                :key="room.room_id"
                :room="room"
                :selected="selectedRoomId === room.room_id"
                @select="handleSelectRoom"
              />
            </div>
          </n-collapse-transition>
        </div>

        <!-- Load More Button -->
        <div v-if="hasMore" class="load-more-container">
          <n-button
            :loading="loadingMore"
            @click="handleLoadMore"
            block
            secondary
            strong
          >
            加载更多 ({{ safeRooms.length }} / {{ totalCount }})
          </n-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoomList, useFavoriteRooms, useUnreadRooms } from '@/hooks/useSlidingSync'
import type { MSC3575RoomData } from '@/types/sliding-sync'
import { logger } from '@/utils/logger'
// Icons
import { Search, Star, Users, Notification, ChevronDown, ChevronRight, AlertCircle, Inbox } from '@vicons/tabler'
import { NIcon, NButton, NInput, NCollapseTransition, NSpin, NBadge } from 'naive-ui'
import SlidingSyncRoomItem from './SlidingSyncRoomItem.vue'

// Props
interface Props {
  selectedRoomId?: string
  showSearch?: boolean
  autoLoad?: boolean
  initialRanges?: number[][]
}

const props = withDefaults(defineProps<Props>(), {
  selectedRoomId: '',
  showSearch: true,
  autoLoad: true,
  initialRanges: () => [[0, 49]]
})

// Emits
interface Emits {
  (e: 'select-room', room: MSC3575RoomData): void
  (e: 'error', error: string): void
}

const emit = defineEmits<Emits>()

// Composables
const {
  list: rooms,
  loading,
  error,
  count: totalCount,
  hasMore,
  load,
  loadMore,
  search: searchRooms,
  clearFilter
} = useRoomList()

const { list: favorites, load: loadFavorites } = useFavoriteRooms()

const { list: unread, load: loadUnread } = useUnreadRooms()

// State
const searchQuery = ref('')
const loadingMore = ref(false)
const expandedGroups = ref({
  favorites: true,
  unread: true,
  all: true
})

// Computed
const safeRooms = computed(() => rooms.value || [])
const safeFavorites = computed(() => favorites.value || [])
const safeUnread = computed(() => unread.value || [])

const filteredRooms = computed(() => {
  if (!searchQuery.value) return safeRooms.value

  const query = searchQuery.value.toLowerCase()
  return safeRooms.value.filter(
    (room) => room.name?.toLowerCase().includes(query) || room.topic?.toLowerCase().includes(query)
  )
})

// Methods
const handleLoadMore = async () => {
  if (loadingMore.value || !hasMore.value) return

  loadingMore.value = true
  try {
    await loadMore(50)
    logger.debug('[SlidingSyncRoomList] Loaded more rooms')
  } catch (err) {
    logger.error('[SlidingSyncRoomList] Failed to load more:', err)
  } finally {
    loadingMore.value = false
  }
}

const handleSelectRoom = (room: MSC3575RoomData) => {
  emit('select-room', room)
}

const handleSearchDebounced = debounce(() => {
  if (searchQuery.value) {
    searchRooms(searchQuery.value)
  } else {
    clearFilter()
  }
}, 300)

const handleRetry = async () => {
  try {
    await load()
  } catch (err) {
    logger.error('[SlidingSyncRoomList] Retry failed:', err)
    emit('error', err instanceof Error ? err.message : '加载失败')
  }
}

const toggleGroup = (group: keyof typeof expandedGroups.value) => {
  expandedGroups.value[group] = !expandedGroups.value[group]
}

// Utility
function debounce(fn: (...args: unknown[]) => void, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout>
  return (...args: unknown[]) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

// Lifecycle
onMounted(async () => {
  if (props.autoLoad) {
    try {
      await Promise.all([load(), loadFavorites(), loadUnread()])
      logger.debug('[SlidingSyncRoomList] Initial data loaded')
    } catch (err) {
      logger.error('[SlidingSyncRoomList] Failed to load initial data:', err)
    }
  }
})

// Watch for search query changes
watch(searchQuery, () => {
  handleSearchDebounced()
})
</script>

<style lang="scss" scoped>
.sliding-sync-room-list {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.loading-state,
.error-state,
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 32px;
  color: var(--hula-gray-400);
}

.room-list-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.search-bar {
  padding: 12px 16px;
  border-bottom: 1px solid var(--n-border-color);
}

.room-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.room-group {
  margin-bottom: 8px;

  .group-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    cursor: pointer;
    user-select: none;
    transition: background-color 0.2s;

    &:hover {
      background-color: var(--n-hover-color);
    }

    .count {
      margin-left: auto;
      color: var(--n-text-color-3);
      font-size: 12px;
    }
  }

  .room-items {
    padding: 0 8px;
  }
}

.load-more-container {
  padding: 12px 16px;
  border-top: 1px solid var(--n-border-color);
}
</style>
