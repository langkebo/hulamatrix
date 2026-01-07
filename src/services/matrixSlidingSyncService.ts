/**
 * Matrix Sliding Sync Service
 * Handles MSC3575 Sliding Sync protocol for efficient room synchronization
 * Based on matrix-js-sdk v39.1.3
 *
 * @module services/matrixSlidingSyncService
 */

import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'
import type {
  MSC3575List,
  MSC3575RoomData,
  MSC3575RoomSubscription,
  MSC3575Filters,
  SlidingList,
  SlidingSyncLifecycleState,
  PresenceState,
  ListUpdateCallback,
  RoomUpdateCallback,
  DMWithFriendInfo,
  SlidingListData
} from '@/types/sliding-sync'

// Import from matrix-js-sdk internal files
// Note: SlidingSync is not exported from the main SDK index, need to import from sliding-sync module
import type * as SlidingSyncTypes from 'matrix-js-sdk/lib/sliding-sync'
import type * as SlidingSyncSdkTypes from 'matrix-js-sdk/lib/sliding-sync-sdk'

/**
 * List data structure for tracking rooms in a list
 */
interface ListData {
  name: string
  roomIds: string[]
  roomData: Map<string, MSC3575RoomData>
  count: number
  ranges: number[][]
}

/**
 * Debounce timer for list updates
 */
interface DebounceTimer {
  timer: ReturnType<typeof setTimeout> | null
  lastUpdate: number
}

/**
 * Friend data interface for type safety
 */
interface FriendData {
  user_id: string
  display_name?: string
  category_id?: number
  category_name?: string
  category_color?: string
}

/**
 * Matrix Sliding Sync Service
 * Singleton service for managing Sliding Sync using the actual SDK
 */
export class MatrixSlidingSyncService {
  private static instance: MatrixSlidingSyncService

  // SlidingSync 实例 - Using SDK type
  private slidingSyncInstance: SlidingSyncTypes.SlidingSync | null = null

  // SlidingSyncSdk 集成层
  private syncApi: SlidingSyncSdkTypes.SlidingSyncSdk | null = null

  // 列表管理 - 增强版，追踪房间 ID
  private listsData: Map<string, ListData> = new Map()

  // 房间到列表的反向映射
  private roomToLists: Map<string, Set<string>> = new Map()

  // 事件处理器
  private eventHandlers: Map<string, Set<(...args: never[]) => void>> = new Map() as Map<
    string,
    Set<(...args: never[]) => void>
  >

  // 状态
  private isInitialized = false
  private isRunning = false
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: Stores proxy URL for logging and reconnection
  private proxyUrl = ''

  // Presence 缓存
  private presenceCache: Map<string, PresenceState> = new Map()

  // 生命周期状态
  private lifecycleState: SlidingSyncLifecycleState = 'STOPPED'

  // 当前同步位置
  private currentPos: string | null = null

  // 防抖计时器
  private debounceTimers: Map<string, DebounceTimer> = new Map()

  // 性能配置
  private readonly DEBOUNCE_MS = 100

  /**
   * Get singleton instance
   */
  static getInstance(): MatrixSlidingSyncService {
    if (!MatrixSlidingSyncService.instance) {
      MatrixSlidingSyncService.instance = new MatrixSlidingSyncService()
    }
    return MatrixSlidingSyncService.instance
  }

  /**
   * Initialize Sliding Sync
   */
  async initialize(proxyUrl: string): Promise<void> {
    if (this.isInitialized) {
      logger.warn('[SlidingSyncService] Already initialized')
      return
    }

    try {
      this.proxyUrl = proxyUrl

      // 获取 Matrix 客户端
      const client = await this.getMatrixClient()
      if (!client) {
        throw new Error('Matrix client not available')
      }

      logger.info('[SlidingSyncService] Sliding Sync proxy URL:', proxyUrl)

      // Import SlidingSync dynamically
      const { SlidingSync } = await import('matrix-js-sdk/lib/sliding-sync')

      // 创建 SlidingSync 实例
      this.slidingSyncInstance = new SlidingSync(
        proxyUrl,
        new Map<string, SlidingSyncTypes.MSC3575List>(),
        { timeline_limit: 0 },
        client,
        30000
      )

      // 设置事件监听
      this.setupEventListeners(this.slidingSyncInstance)

      this.isInitialized = true
      this.lifecycleState = 'READY'

      logger.info('[SlidingSyncService] Initialized successfully')
    } catch (error) {
      this.lifecycleState = 'ERROR'
      logger.error('[SlidingSyncService] Initialization failed:', error)
      throw error
    }
  }

  /**
   * Start Sliding Sync
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('SlidingSync not initialized')
    }

    if (this.isRunning) {
      logger.warn('[SlidingSyncService] Already running')
      return
    }

    try {
      if (!this.slidingSyncInstance) {
        throw new Error('SlidingSync instance not available')
      }

      await this.slidingSyncInstance.start()
      this.isRunning = true
      this.lifecycleState = 'SYNCING'

      logger.info('[SlidingSyncService] Started')
    } catch (error) {
      this.lifecycleState = 'ERROR'
      logger.error('[SlidingSyncService] Start failed:', error)
      throw error
    }
  }

  /**
   * Stop Sliding Sync
   */
  stop(): void {
    if (!this.isRunning) {
      return
    }

    try {
      this.slidingSyncInstance?.stop()
      this.syncApi?.stop()

      this.isRunning = false
      this.lifecycleState = 'STOPPED'

      logger.info('[SlidingSyncService] Stopped')
    } catch (error) {
      logger.error('[SlidingSyncService] Stop failed:', error)
    }
  }

  /**
   * Create a new list
   */
  createList(name: string, config: MSC3575List): boolean {
    if (!this.slidingSyncInstance) {
      logger.warn('[SlidingSyncService] Cannot create list: SlidingSync not initialized')
      return false
    }

    try {
      this.slidingSyncInstance.setList(name, config)

      // 初始化列表数据追踪
      this.listsData.set(name, {
        name,
        roomIds: [],
        roomData: new Map(),
        count: 0,
        ranges: config.ranges || []
      })

      logger.debug('[SlidingSyncService] List created:', { name, config })
      return true
    } catch (error) {
      logger.error('[SlidingSyncService] Failed to create list:', error)
      return false
    }
  }

  /**
   * Get list by name - 增强版，返回实际的房间数据
   */
  getList(name: string): SlidingList | null {
    if (!this.slidingSyncInstance) return null

    const listParams = this.slidingSyncInstance.getListParams(name)
    if (!listParams) return null

    const listData = this.listsData.get(name)

    // Convert to our SlidingList interface with actual data
    return {
      name,
      getRoomIds: () => listData?.roomIds || [],
      getRoomData: (roomId: string) => listData?.roomData.get(roomId),
      getCount: () =>
        listData?.count ||
        listParams.ranges?.reduce((sum: number, range: number[]) => sum + (range[1] - range[0] + 1), 0) ||
        0,
      getRanges: () => listParams.ranges || [],
      setRanges: (ranges: number[][]) => {
        this.slidingSyncInstance?.setListRanges(name, ranges)
        if (listData) {
          listData.ranges = ranges
        }
      },
      setFilters: (filters: MSC3575Filters) => {
        const current = this.slidingSyncInstance?.getListParams(name)
        if (current) {
          this.slidingSyncInstance?.setList(name, { ...current, filters })
        }
      },
      getFilters: () => listParams.filters || {}
    }
  }

  /**
   * Setup default lists
   */
  setupDefaultLists(): void {
    if (!this.slidingSyncInstance) {
      logger.warn('[SlidingSyncService] Cannot setup lists: SlidingSync not initialized')
      return
    }

    try {
      // 1. 所有房间列表
      this.createList('all_rooms', {
        ranges: [[0, 49]],
        sort: ['by_recency', 'by_name'],
        filters: {
          is_dm: false
        },
        required_state: [
          ['m.room.avatar', ''],
          ['m.room.name', ''],
          ['m.room.topic', ''],
          ['m.room.encryption', '']
        ],
        timeline_limit: 10
      })

      // 2. DM 房间列表（用于 FriendsList 显示）
      this.createList('direct_messages', {
        ranges: [[0, 49]],
        sort: ['by_recency'],
        filters: {
          is_dm: true
        },
        required_state: [
          ['m.room.avatar', ''],
          ['m.room.name', ''],
          ['m.direct', ''],
          ['m.room.encryption', '']
        ],
        timeline_limit: 5
      })

      // 3. 收藏房间
      this.createList('favorites', {
        ranges: [[0, 19]],
        sort: ['by_recency'],
        filters: {
          tags: ['m.favourite']
        },
        required_state: [
          ['m.room.avatar', ''],
          ['m.room.name', '']
        ],
        timeline_limit: 5
      })

      // 4. 未读房间
      this.createList('unread', {
        ranges: [[0, 29]],
        sort: ['by_notification_count', 'by_recency'],
        filters: {
          is_dm: false
        },
        required_state: [
          ['m.room.avatar', ''],
          ['m.room.name', '']
        ],
        timeline_limit: 5
      })

      logger.info('[SlidingSyncService] Default lists configured')
    } catch (error) {
      logger.error('[SlidingSyncService] Failed to setup default lists:', error)
    }
  }

  /**
   * Setup extensions
   */
  setupExtensions(): void {
    if (!this.slidingSyncInstance) {
      return
    }

    try {
      // Extensions are automatically registered by SlidingSyncSdk
      logger.info('[SlidingSyncService] Extensions configured')
    } catch (error) {
      logger.error('[SlidingSyncService] Failed to setup extensions:', error)
    }
  }

  /**
   * Setup event listeners
   */
  async setupEventListeners(slidingSync: SlidingSyncTypes.SlidingSync): Promise<void> {
    try {
      // Import SlidingSyncEvent dynamically
      const { SlidingSyncEvent } = await import('matrix-js-sdk/lib/sliding-sync')

      // 监听房间数据更新
      slidingSync.on(SlidingSyncEvent.RoomData, async (roomId: string, roomData: unknown) => {
        await this.handleRoomDataUpdate(roomId, roomData as SlidingSyncTypes.MSC3575RoomData)
      })

      // 监听生命周期事件
      slidingSync.on(SlidingSyncEvent.Lifecycle, (state: unknown, resp: unknown, err?: Error) => {
        this.handleLifecycleEvent(state, resp as SlidingSyncTypes.MSC3575SlidingSyncResponse | null, err)
      })

      logger.info('[SlidingSyncService] Event listeners configured')
    } catch (error) {
      logger.error('[SlidingSyncService] Failed to setup event listeners:', error)
    }
  }

  /**
   * Adjust list range
   */
  adjustRange(listName: string, ranges: number[][]): void {
    if (!this.slidingSyncInstance) return

    try {
      this.slidingSyncInstance.setListRanges(listName, ranges)
      logger.debug('[SlidingSyncService] Range adjusted:', { listName, ranges })
    } catch (error) {
      logger.error('[SlidingSyncService] Failed to adjust range:', error)
    }
  }

  /**
   * Load more items in a list
   */
  loadMore(listName: string, count: number = 50): void {
    if (!this.slidingSyncInstance) return

    const list = this.getList(listName)
    if (!list) return

    const currentRanges = list.getRanges()
    const maxIndex = Math.max(...currentRanges.flat())

    const newRanges = [...currentRanges, [maxIndex + 1, maxIndex + count]]
    list.setRanges(newRanges)

    logger.debug('[SlidingSyncService] Loaded more:', { listName, count })
  }

  /**
   * Search rooms
   */
  searchRooms(listName: string, query: string): void {
    const list = this.getList(listName)
    if (!list) return

    list.setFilters({
      room_name_like: query
    })
    logger.debug('[SlidingSyncService] Searching:', { listName, query })
  }

  /**
   * Clear filter
   */
  clearFilter(listName: string): void {
    const list = this.getList(listName)
    if (!list) return

    list.setFilters({})
    logger.debug('[SlidingSyncService] Filter cleared:', listName)
  }

  /**
   * Subscribe to room
   */
  subscribeToRoom(roomId: string, _config?: MSC3575RoomSubscription): void {
    if (!this.slidingSyncInstance) return

    try {
      const subscriptions = this.slidingSyncInstance.getRoomSubscriptions()
      subscriptions.add(roomId)
      this.slidingSyncInstance.modifyRoomSubscriptions(subscriptions)

      logger.debug('[SlidingSyncService] Subscribed to room:', roomId)
    } catch (error) {
      logger.error('[SlidingSyncService] Failed to subscribe:', error)
    }
  }

  /**
   * Unsubscribe from room
   */
  unsubscribeFromRoom(roomId: string): void {
    if (!this.slidingSyncInstance) return

    try {
      const subscriptions = this.slidingSyncInstance.getRoomSubscriptions()
      subscriptions.delete(roomId)
      this.slidingSyncInstance.modifyRoomSubscriptions(subscriptions)

      logger.debug('[SlidingSyncService] Unsubscribed from room:', roomId)
    } catch (error) {
      logger.error('[SlidingSyncService] Failed to unsubscribe:', error)
    }
  }

  /**
   * Add custom subscription template
   */
  addCustomSubscription(name: string, config: MSC3575RoomSubscription): void {
    if (!this.slidingSyncInstance) return

    try {
      this.slidingSyncInstance.addCustomSubscription(name, config)
      logger.debug('[SlidingSyncService] Custom subscription added:', name)
    } catch (error) {
      logger.error('[SlidingSyncService] Failed to add custom subscription:', error)
    }
  }

  /**
   * Use custom subscription for room
   */
  useCustomSubscription(roomId: string, name: string): void {
    if (!this.slidingSyncInstance) return

    try {
      this.slidingSyncInstance.useCustomSubscription(roomId, name)
      logger.debug('[SlidingSyncService] Using custom subscription:', { roomId, name })
    } catch (error) {
      logger.error('[SlidingSyncService] Failed to use custom subscription:', error)
    }
  }

  /**
   * Get DM list with friend info
   */
  async getDMListWithFriendInfo(): Promise<DMWithFriendInfo[]> {
    try {
      const client = await this.getMatrixClient()
      if (!client) {
        return []
      }

      // 获取 FriendsClient (如果可用)
      const friends = (client as any).friendsV2
      if (!friends) {
        logger.warn('[SlidingSyncService] FriendsClient not available')
        return []
      }

      // 获取 DM 房间列表（从 Sliding Sync 或传统方式）
      const dmRooms = await this.getDMRoomList()

      // 获取好友列表（从缓存）
      const friendList = await friends.listFriends()
      const friendMap: Map<string, FriendData> = new Map(friendList.map((f: FriendData) => [f.user_id, f]))

      // 合并数据
      const enriched: DMWithFriendInfo[] = dmRooms.map((room) => {
        const friend = this.extractFriendFromDM(room, friendMap)
        return {
          ...room,
          friend_id: friend?.user_id,
          display_name: friend?.display_name,
          category_id: friend?.category_id,
          category_name: friend?.category_name,
          category_color: friend?.category_color,
          is_online: this.getPresence(friend?.user_id || '')?.presence === 'online',
          last_active: this.getPresence(friend?.user_id || '')?.last_active_ago
        }
      })

      logger.info('[SlidingSyncService] DM list with friends loaded:', enriched.length)
      return enriched
    } catch (error) {
      logger.error('[SlidingSyncService] Failed to get DM list with friends:', error)
      return []
    }
  }

  /**
   * Get room data
   */
  getRoomData(_roomId: string): MSC3575RoomData | null {
    const list = this.getList('direct_messages')
    if (!list) return null

    // TODO: 从列表中获取房间数据
    return null
  }

  /**
   * Subscribe to Presence updates
   */
  subscribeToPresence(callback: (presences: Record<string, PresenceState>) => void): () => void {
    const _handler = (presence: PresenceState) => {
      this.presenceCache.set(presence.user_id, presence)
      callback({ [presence.user_id]: presence })
    }

    // TODO: 从 Matrix 客户端监听 Presence 事件
    return () => {
      // Cleanup
    }
  }

  /**
   * Get presence state for user
   */
  getPresence(userId: string): PresenceState | null {
    return this.presenceCache.get(userId) || null
  }

  /**
   * Register list update callback
   */
  onListUpdate(callback: ListUpdateCallback): () => void {
    const key = 'listUpdate'
    if (!this.eventHandlers.has(key)) {
      this.eventHandlers.set(key, new Set())
    }
    ;(this.eventHandlers.get(key) as Set<any>).add(callback)

    return () => {
      ;(this.eventHandlers.get(key) as Set<any>)?.delete(callback)
    }
  }

  /**
   * Register room update callback
   */
  onRoomUpdate(callback: RoomUpdateCallback): () => void {
    const key = 'roomUpdate'
    if (!this.eventHandlers.has(key)) {
      this.eventHandlers.set(key, new Set())
    }
    ;(this.eventHandlers.get(key) as Set<any>).add(callback)

    return () => {
      ;(this.eventHandlers.get(key) as Set<any>)?.delete(callback)
    }
  }

  /**
   * Get lifecycle state
   */
  getLifecycleState(): SlidingSyncLifecycleState {
    return this.lifecycleState
  }

  /**
   * Check if ready
   */
  isReady(): boolean {
    return this.isInitialized && this.isRunning
  }

  /**
   * Get current sync position
   */
  getCurrentPos(): string | null {
    return this.currentPos
  }

  /**
   * Dispose service - 增强版，清理所有资源
   */
  dispose(): void {
    this.stop()

    // Clear all timers
    for (const timer of this.debounceTimers.values()) {
      if (timer.timer) {
        clearTimeout(timer.timer)
      }
    }
    this.debounceTimers.clear()

    // Clear all data structures
    this.listsData.clear()
    this.roomToLists.clear()
    this.eventHandlers.clear()
    this.presenceCache.clear()

    // Clear instances
    this.slidingSyncInstance = null
    this.syncApi = null

    // Reset state
    this.isInitialized = false
    this.lifecycleState = 'STOPPED'

    logger.info('[SlidingSyncService] Disposed')
  }

  // ========== Private Methods ==========

  /**
   * Handle room data update - 增强版，追踪房间到列表的映射
   */
  private async handleRoomDataUpdate(roomId: string, roomData: SlidingSyncTypes.MSC3575RoomData): Promise<void> {
    try {
      // Convert SDK room data to our format with room_id
      // Handle SDK type differences by accessing properties safely
      const sdkData = roomData as unknown as Record<string, unknown>
      const enrichedRoomData: MSC3575RoomData = {
        room_id: roomId,
        name: roomData.name,
        avatar_url: sdkData.avatar_url as string | undefined,
        topic: sdkData.topic as string | undefined,
        joined_count: roomData.joined_count,
        invited_count: roomData.invited_count,
        // Convert heroes from SDK type to string array
        heroes: roomData.heroes?.map((h) => (typeof h === 'string' ? h : String(h))),
        notification_count: roomData.notification_count,
        highlight_count: roomData.highlight_count,
        // Convert required_state from SDK IStateEvent[] to our format
        required_state: sdkData.required_state as Record<string, unknown> | Array<Record<string, unknown>> | undefined,
        timeline: roomData.timeline || [],
        updated: sdkData.updated as number | undefined,
        state: sdkData.state as string | undefined,
        room_type: sdkData.room_type as string | undefined,
        is_dm: roomData.is_dm,
        is_encrypted: sdkData.is_encrypted as boolean | undefined,
        is_online: sdkData.is_online as boolean | undefined,
        tags: sdkData.tags as string[] | undefined
      }

      // 更新房间到列表的映射（房间可能属于多个列表）
      if (!this.roomToLists.has(roomId)) {
        this.roomToLists.set(roomId, new Set())
      }

      // 更新所有列表中的房间数据
      // 注意：在实际使用中，我们需要知道这个房间属于哪些列表
      // 这里我们简化处理，更新所有已初始化的列表
      for (const [_listName, listData] of this.listsData.entries()) {
        // 检查房间是否已在此列表中
        if (!listData.roomIds.includes(roomId)) {
          // 新房间，添加到列表
          listData.roomIds.push(roomId)
          listData.roomData.set(roomId, enrichedRoomData)
          listData.count++
        } else {
          // 已存在的房间，更新数据
          listData.roomData.set(roomId, enrichedRoomData)
        }
      }

      // Emit to registered handlers with debouncing
      this.emitRoomUpdateDebounced(roomId, enrichedRoomData)

      logger.debug('[SlidingSyncService] Room updated:', roomId)
    } catch (error) {
      logger.error('[SlidingSyncService] Failed to handle room data update:', error)
    }
  }

  /**
   * Emit room update with debouncing for performance
   */
  private emitRoomUpdateDebounced(roomId: string, roomData: MSC3575RoomData): void {
    const key = `room:${roomId}`
    const debounceTimer = this.debounceTimers.get(key)

    // Clear existing timer
    if (debounceTimer?.timer) {
      clearTimeout(debounceTimer.timer)
    }

    // Set new timer
    const timer = setTimeout(() => {
      const handlers = this.eventHandlers.get('roomUpdate')
      if (handlers) {
        for (const handler of handlers) {
          try {
            ;(handler as RoomUpdateCallback)(roomId, roomData)
          } catch (err) {
            logger.error('[SlidingSyncService] Room update handler error:', err)
          }
        }
      }

      // Clean up
      this.debounceTimers.delete(key)
    }, this.DEBOUNCE_MS)

    this.debounceTimers.set(key, {
      timer,
      lastUpdate: Date.now()
    })
  }

  /**
   * Handle lifecycle event - 增强版，追踪列表数据
   */
  private handleLifecycleEvent(
    state: unknown,
    resp: SlidingSyncTypes.MSC3575SlidingSyncResponse | null,
    err?: Error
  ): void {
    try {
      if (err) {
        logger.error('[SlidingSyncService] Lifecycle error:', { state, error: err })
        this.lifecycleState = 'ERROR'
        return
      }

      // Map SDK states to our lifecycle states
      // Check for Complete state (from the SDK enum)
      if (state === 'COMPLETE' || state?.toString?.() === 'COMPLETE') {
        this.lifecycleState = 'SYNCING'
        if (resp?.pos) {
          this.currentPos = resp.pos
        }

        // Update list data with debouncing
        if (resp?.lists) {
          for (const [listName, listData] of Object.entries(resp.lists)) {
            const listRooms =
              this.listsData
                .get(listName)
                ?.roomIds.map((id) => this.listsData.get(listName)?.roomData.get(id))
                .filter((room): room is MSC3575RoomData => room !== undefined) || []

            this.updateListDataDebounced(listName, {
              listId: listName,
              rooms: listRooms,
              count: (listData as { count?: number }).count || 0,
              ranges: this.listsData.get(listName)?.ranges || [],
              hasMore: true
            })
          }
        }
      }

      logger.debug('[SlidingSyncService] Lifecycle:', { state, pos: this.currentPos })
    } catch (error) {
      logger.error('[SlidingSyncService] Failed to handle lifecycle event:', error)
    }
  }

  /**
   * Update list data with debouncing
   */
  private updateListDataDebounced(listName: string, data: SlidingListData): void {
    const key = `list:${listName}`
    const debounceTimer = this.debounceTimers.get(key)

    // Clear existing timer
    if (debounceTimer?.timer) {
      clearTimeout(debounceTimer.timer)
    }

    // Set new timer
    const timer = setTimeout(() => {
      const handlers = this.eventHandlers.get('listUpdate')
      if (handlers) {
        for (const handler of handlers) {
          try {
            ;(handler as ListUpdateCallback)(listName, data)
          } catch (err) {
            logger.error('[SlidingSyncService] List update handler error:', err)
          }
        }
      }

      // Clean up
      this.debounceTimers.delete(key)
    }, this.DEBOUNCE_MS)

    this.debounceTimers.set(key, {
      timer,
      lastUpdate: Date.now()
    })
  }

  /**
   * Get Matrix client
   */
  private async getMatrixClient(): Promise<any> {
    return matrixClientService.getClient()
  }

  /**
   * Get DM room list
   */
  private async getDMRoomList(): Promise<MSC3575RoomData[]> {
    const client = await this.getMatrixClient()
    if (!client) return []

    const rooms = client.getRooms?.() || []
    const dmRooms: MSC3575RoomData[] = []

    for (const room of rooms) {
      const isDM = this.checkIsDM(room)
      if (isDM) {
        dmRooms.push({
          room_id: room.roomId,
          name: room.name || '',
          avatar_url: room.avatarUrl || undefined,
          is_dm: true,
          updated: Date.now(),
          required_state: {} as Record<string, unknown>,
          timeline: [] as any[]
        })
      }
    }

    return dmRooms
  }

  /**
   * Check if room is DM
   */
  private checkIsDM(room: { getJoinedMembers?: () => unknown[] } | null): boolean {
    if (!room) return false
    const members = (room.getJoinedMembers?.() as unknown[]) || []
    return members.length === 2
  }

  /**
   * Extract friend from DM room
   */
  private extractFriendFromDM(room: MSC3575RoomData, friendMap: Map<string, FriendData>): FriendData | null {
    if (!room.room_id || !room.room_id.startsWith('!')) {
      return friendMap.get(room.room_id || '') || null
    }
    return null
  }
}

// Export singleton instance
export const matrixSlidingSyncService = MatrixSlidingSyncService.getInstance()
