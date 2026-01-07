/**
 * SlidingSync Store
 * Pinia store for managing Matrix Sliding Sync (MSC3575)
 *
 * @module stores/slidingSync
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { matrixSlidingSyncService } from '@/services/matrixSlidingSyncService'
import { logger } from '@/utils/logger'
import type { MSC3575RoomData, SlidingSyncLifecycleState, PresenceState } from '@/types/sliding-sync'

/**
 * SlidingSync Store State
 */
interface SlidingSyncState {
  /** 是否已初始化 */
  isInitialized: boolean
  /** 是否正在运行 */
  isRunning: boolean
  /** 代理 URL */
  proxyUrl: string | null
  /** 错误信息 */
  error: string | null
  /** 列表数据 */
  lists: Record<string, MSC3575RoomData[]>
  /** 加载状态 */
  loading: Record<string, boolean>
  /** 列表计数 */
  counts: Record<string, number>
  /** 生命周期状态 */
  lifecycleState: SlidingSyncLifecycleState
}

/**
 * Default state
 */
const defaultState = (): SlidingSyncState => ({
  isInitialized: false,
  isRunning: false,
  proxyUrl: null,
  error: null,
  lists: {
    all_rooms: [],
    direct_messages: [],
    favorites: [],
    unread: []
  },
  loading: {
    all_rooms: false,
    direct_messages: false,
    favorites: false,
    unread: false
  },
  counts: {
    all_rooms: 0,
    direct_messages: 0,
    favorites: 0,
    unread: 0
  },
  lifecycleState: 'STOPPED'
})

/**
 * SlidingSync Store
 */
export const useSlidingSyncStore = defineStore('slidingSync', () => {
  // ========== State ==========

  const state = ref<SlidingSyncState>(defaultState())

  // ========== Computed ==========

  /**
   * 是否准备就绪
   */
  const isReady = computed(() => state.value.isInitialized && state.value.isRunning)

  /**
   * 所有房间
   */
  const allRooms = computed(() => state.value.lists.all_rooms)

  /**
   * 直接消息列表
   */
  const directMessages = computed(() => state.value.lists.direct_messages)

  /**
   * 收藏的房间
   */
  const favorites = computed(() => state.value.lists.favorites)

  /**
   * 未读房间
   */
  const unread = computed(() => state.value.lists.unread)

  /**
   * 是否有未读消息
   */
  const hasUnread = computed(() => (state.value.counts.unread || 0) > 0)

  /**
   * 总房间数
   */
  const totalRoomsCount = computed(
    () => (state.value.counts.all_rooms || 0) + (state.value.counts.direct_messages || 0)
  )

  /**
   * 是否有错误
   */
  const hasError = computed(() => state.value.error !== null)

  // ========== Actions ==========

  /**
   * 初始化 SlidingSync
   */
  const initialize = async (proxyUrl?: string): Promise<void> => {
    if (state.value.isInitialized) {
      logger.warn('[SlidingSyncStore] Already initialized')
      return
    }

    state.value.error = null

    try {
      // 获取代理 URL
      const url = proxyUrl || getSlidingSyncUrl()
      if (!url) {
        throw new Error('Sliding Sync URL not configured')
      }

      state.value.proxyUrl = url

      // 初始化服务
      await matrixSlidingSyncService.initialize(url)

      // 设置默认列表
      matrixSlidingSyncService.setupDefaultLists()

      // 设置扩展
      matrixSlidingSyncService.setupExtensions()

      // 设置事件监听
      setupEventHandlers()

      state.value.isInitialized = true
      logger.info('[SlidingSyncStore] Initialized successfully')
    } catch (err) {
      state.value.error = err instanceof Error ? err.message : 'Failed to initialize'
      logger.error('[SlidingSyncStore] Initialization failed:', err)
      throw err
    }
  }

  /**
   * 启动 SlidingSync
   */
  const start = async (): Promise<void> => {
    if (!state.value.isInitialized) {
      await initialize()
    }

    if (state.value.isRunning) {
      logger.warn('[SlidingSyncStore] Already running')
      return
    }

    try {
      await matrixSlidingSyncService.start()
      state.value.isRunning = true
      logger.info('[SlidingSyncStore] Started')
    } catch (err) {
      state.value.error = err instanceof Error ? err.message : 'Failed to start'
      logger.error('[SlidingSyncStore] Start failed:', err)
      throw err
    }
  }

  /**
   * 停止 SlidingSync
   */
  const stop = (): void => {
    if (!state.value.isRunning) {
      return
    }

    matrixSlidingSyncService.stop()
    state.value.isRunning = false
    state.value.lifecycleState = 'STOPPED'
    logger.info('[SlidingSyncStore] Stopped')
  }

  /**
   * 加载列表数据
   */
  const loadList = async (listName: string, ranges?: number[][]): Promise<void> => {
    if (!state.value.isRunning) {
      await start()
    }

    state.value.loading[listName] = true

    try {
      const list = matrixSlidingSyncService.getList(listName)
      if (!list) {
        throw new Error(`List ${listName} not found`)
      }

      // 设置窗口范围
      if (ranges) {
        list.setRanges(ranges)
      }

      logger.debug(`[SlidingSyncStore] Loaded list: ${listName}`)
    } catch (err) {
      state.value.error = err instanceof Error ? err.message : `Failed to load ${listName}`
      logger.error(`[SlidingSyncStore] Failed to load list ${listName}:`, err)
    } finally {
      state.value.loading[listName] = false
    }
  }

  /**
   * 加载更多数据
   */
  const loadMore = async (listName: string, count: number = 50): Promise<void> => {
    try {
      matrixSlidingSyncService.loadMore(listName, count)
      logger.debug(`[SlidingSyncStore] Loaded more in ${listName}`)
    } catch (err) {
      state.value.error = err instanceof Error ? err.message : `Failed to load more in ${listName}`
      logger.error(`[SlidingSyncStore] Failed to load more in ${listName}:`, err)
    }
  }

  /**
   * 搜索房间
   */
  const searchRooms = async (listName: string, query: string): Promise<void> => {
    try {
      state.value.loading[listName] = true
      matrixSlidingSyncService.searchRooms(listName, query)

      // 等待列表更新
      await new Promise((resolve) => setTimeout(resolve, 500))
      logger.debug(`[SlidingSyncStore] Searched in ${listName}: ${query}`)
    } catch (err) {
      state.value.error = err instanceof Error ? err.message : `Failed to search in ${listName}`
      logger.error(`[SlidingSyncStore] Search failed in ${listName}:`, err)
    } finally {
      state.value.loading[listName] = false
    }
  }

  /**
   * 清除过滤条件
   */
  const clearFilter = (listName: string): void => {
    matrixSlidingSyncService.clearFilter(listName)
    logger.debug(`[SlidingSyncStore] Cleared filter in ${listName}`)
  }

  /**
   * 加载带好友信息的 DM 列表
   */
  const loadDMListWithFriends = async (): Promise<void> => {
    state.value.loading.direct_messages = true

    try {
      const enriched = await matrixSlidingSyncService.getDMListWithFriendInfo()
      state.value.lists.direct_messages = enriched
      state.value.counts.direct_messages = enriched.length

      logger.debug(`[SlidingSyncStore] Loaded DM list with friends: ${enriched.length}`)
    } catch (err) {
      state.value.error = err instanceof Error ? err.message : 'Failed to load DM list'
      logger.error('[SlidingSyncStore] Failed to load DM list:', err)
    } finally {
      state.value.loading.direct_messages = false
    }
  }

  /**
   * 订阅房间
   */
  const subscribeToRoom = (roomId: string): void => {
    matrixSlidingSyncService.subscribeToRoom(roomId)
    logger.debug(`[SlidingSyncStore] Subscribed to room: ${roomId}`)
  }

  /**
   * 取消订阅房间
   */
  const unsubscribeFromRoom = (roomId: string): void => {
    matrixSlidingSyncService.unsubscribeFromRoom(roomId)
    logger.debug(`[SlidingSyncStore] Unsubscribed from room: ${roomId}`)
  }

  /**
   * 获取 Presence 状态
   */
  const getPresence = (userId: string): PresenceState | null => {
    return matrixSlidingSyncService.getPresence(userId)
  }

  /**
   * 重置状态
   */
  const reset = (): void => {
    const s = defaultState()
    state.value.isInitialized = s.isInitialized
    state.value.isRunning = s.isRunning
    state.value.proxyUrl = s.proxyUrl
    state.value.error = s.error
    state.value.lists = { ...s.lists }
    state.value.loading = { ...s.loading }
    state.value.counts = { ...s.counts }
    state.value.lifecycleState = s.lifecycleState
    logger.debug('[SlidingSyncStore] State reset')
  }

  /**
   * 清除错误
   */
  const clearError = (): void => {
    state.value.error = null
  }

  // ========== Private Methods ==========

  /**
   * 获取 Sliding Sync URL
   */
  const getSlidingSyncUrl = (): string | null => {
    // 从环境变量获取
    const url = import.meta.env.VITE_MATRIX_SLIDING_SYNC_PROXY
    if (url) return url

    // 从 Matrix 配置获取
    // TODO: 从 useMatrixConfig() 获取
    return null
  }

  /**
   * 设置事件监听
   */
  const setupEventHandlers = (): void => {
    // 监听列表更新
    matrixSlidingSyncService.onListUpdate((listName, data) => {
      if (state.value.lists[listName] !== undefined) {
        state.value.lists[listName] = data.rooms
        state.value.counts[listName] = data.count
      }
      state.value.loading[listName] = false
    })

    // 监听生命周期变化
    // TODO: 当 SDK 支持后启用
    // matrixSlidingSyncService.onLifecycleChange((lifecycleState) => {
    //   state.value.lifecycleState = lifecycleState
    // })
  }

  // ========== Return ==========

  return {
    // State
    isInitialized: computed(() => state.value.isInitialized),
    isRunning: computed(() => state.value.isRunning),
    proxyUrl: computed(() => state.value.proxyUrl),
    error: computed(() => state.value.error),
    loading: computed(() => state.value.loading),
    lists: computed(() => state.value.lists),
    counts: computed(() => state.value.counts),
    lifecycleState: computed(() => state.value.lifecycleState),

    // Computed
    isReady,
    allRooms,
    directMessages,
    favorites,
    unread,
    hasUnread,
    totalRoomsCount,
    hasError,

    // Actions
    initialize,
    start,
    stop,
    loadList,
    loadMore,
    searchRooms,
    clearFilter,
    loadDMListWithFriends,
    subscribeToRoom,
    unsubscribeFromRoom,
    getPresence,
    reset,
    clearError
  }
})
