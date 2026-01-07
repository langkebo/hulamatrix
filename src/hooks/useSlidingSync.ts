/**
 * useSlidingSync Hook
 * Composable for managing Matrix Sliding Sync (MSC3575)
 *
 * @module hooks/useSlidingSync
 */

import { computed, onUnmounted } from 'vue'
import { useSlidingSyncStore } from '@/stores/slidingSync'
import { logger } from '@/utils/logger'
import type { MSC3575RoomData, DMWithFriendInfo } from '@/types/sliding-sync'

/**
 * useSlidingSync options
 */
export interface UseSlidingSyncOptions {
  /** List name to work with */
  listName?: string
  /** Auto-load on mount */
  autoLoad?: boolean
  /** Initial ranges */
  initialRanges?: number[][]
}

/**
 * useSlidingSync Hook
 * Provides access to Sliding Sync functionality
 */
export function useSlidingSync(options: UseSlidingSyncOptions = {}) {
  const { listName, autoLoad = false, initialRanges } = options

  const store = useSlidingSyncStore()

  // ========== State ==========

  /**
   * Is SlidingSync ready
   */
  const isReady = computed(() => store.isReady)

  /**
   * Is loading
   */
  const loading = computed(() => {
    if (listName) {
      return store.loading[listName] || false
    }
    return false
  })

  /**
   * Error message
   */
  const error = computed(() => store.error)

  /**
   * List data
   */
  const list = computed(() => {
    if (!listName) return null
    return store.lists[listName] || []
  })

  /**
   * List count
   */
  const count = computed(() => {
    if (!listName) return 0
    return store.counts[listName] || 0
  })

  /**
   * Has more data to load
   */
  const hasMore = computed(() => {
    if (!listName) return false
    const currentCount = store.counts[listName] || 0
    const loadedCount = store.lists[listName]?.length || 0
    return loadedCount < currentCount
  })

  // ========== Methods ==========

  /**
   * Initialize SlidingSync
   */
  const initialize = async (proxyUrl?: string) => {
    await store.initialize(proxyUrl)
  }

  /**
   * Start SlidingSync
   */
  const start = async () => {
    await store.start()
  }

  /**
   * Stop SlidingSync
   */
  const stop = () => {
    store.stop()
  }

  /**
   * Load list data
   */
  const load = async (ranges?: number[][]) => {
    if (!listName) {
      throw new Error('listName is required')
    }
    await store.loadList(listName, ranges || initialRanges)
  }

  /**
   * Load more items
   */
  const loadMore = async (amount?: number) => {
    if (!listName) {
      throw new Error('listName is required')
    }
    await store.loadMore(listName, amount)
  }

  /**
   * Search items
   */
  const search = async (query: string) => {
    if (!listName) {
      throw new Error('listName is required')
    }
    await store.searchRooms(listName, query)
  }

  /**
   * Clear search filter
   */
  const clearFilter = () => {
    if (!listName) {
      throw new Error('listName is required')
    }
    store.clearFilter(listName)
  }

  /**
   * Refresh current list
   */
  const refresh = async () => {
    await load()
  }

  /**
   * Reset store
   */
  const reset = () => {
    store.reset()
  }

  // Auto-load on mount
  if (autoLoad && listName) {
    load().catch((err) => {
      logger.error('[useSlidingSync] Auto-load failed:', err)
    })
  }

  return {
    // State
    isReady,
    loading,
    error,
    list,
    count,
    hasMore,

    // Methods
    initialize,
    start,
    stop,
    load,
    loadMore,
    search,
    clearFilter,
    refresh,
    reset
  }
}

/**
 * useRoomList Hook
 * Specialized hook for room list
 */
export function useRoomList() {
  return useSlidingSync({
    listName: 'all_rooms',
    autoLoad: false,
    initialRanges: [[0, 49]]
  })
}

/**
 * useDMList Hook
 * Specialized hook for direct message list
 */
export function useDMList() {
  const slidingSync = useSlidingSync({
    listName: 'direct_messages',
    autoLoad: false,
    initialRanges: [[0, 49]]
  })

  /**
   * Load DM list with friend information
   */
  const loadWithFriends = async () => {
    const store = useSlidingSyncStore()
    await store.loadDMListWithFriends()
  }

  return {
    ...slidingSync,
    loadWithFriends
  }
}

/**
 * useFavoriteRooms Hook
 * Specialized hook for favorite rooms
 */
export function useFavoriteRooms() {
  return useSlidingSync({
    listName: 'favorites',
    autoLoad: false,
    initialRanges: [[0, 19]]
  })
}

/**
 * useUnreadRooms Hook
 * Specialized hook for unread rooms
 */
export function useUnreadRooms() {
  return useSlidingSync({
    listName: 'unread',
    autoLoad: false,
    initialRanges: [[0, 29]]
  })
}

/**
 * useSlidingSyncPresence Hook
 * Specialized hook for presence via Sliding Sync
 */
export function useSlidingSyncPresence() {
  const store = useSlidingSyncStore()

  /**
   * Get presence for user
   */
  const getPresence = (userId: string) => {
    return store.getPresence(userId)
  }

  /**
   * Check if user is online
   */
  const isOnline = (userId: string): boolean => {
    const presence = getPresence(userId)
    return presence?.presence === 'online'
  }

  return {
    getPresence,
    isOnline
  }
}

/**
 * useSlidingSyncRoom Hook
 * Specialized hook for single room operations
 */
export function useSlidingSyncRoom(roomId: string) {
  const store = useSlidingSyncStore()

  /**
   * Subscribe to room updates
   */
  const subscribe = () => {
    store.subscribeToRoom(roomId)
  }

  /**
   * Unsubscribe from room updates
   */
  const unsubscribe = () => {
    store.unsubscribeFromRoom(roomId)
  }

  // Auto-subscribe on mount
  subscribe()

  // Auto-unsubscribe on unmount
  onUnmounted(() => {
    unsubscribe()
  })

  return {
    subscribe,
    unsubscribe
  }
}

/**
 * Hook types exports
 */
export type { MSC3575RoomData, DMWithFriendInfo }
