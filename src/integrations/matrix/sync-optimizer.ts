/**
 * Matrix 同步性能优化器
 * 实现增量同步、事件缓存和批量处理
 */

// import type { MatrixClient } from 'matrix-js-sdk'
import { toError } from '@/utils/logger'
import { debounce } from 'es-toolkit'
import { logger } from '@/utils/logger'

interface SyncOptions {
  /** 同步间隔，毫秒 */
  syncInterval?: number
  /** 批量处理大小 */
  batchSize?: number
  /** 是否启用增量同步 */
  enableIncremental?: boolean
  /** 事件缓存大小 */
  eventCacheSize?: number
}

/** Matrix 事件基础接口 */
interface MatrixEvent {
  event_id?: string
  type?: string
  room_id?: string
  sender?: string
  content?: Record<string, unknown>
  origin_server_ts?: number
  getId?: () => string
  getType?: () => string
  getRoom?: () => { roomId?: string } | null
  getContent?: () => Record<string, unknown>
}

/** Matrix 房间接口 */
interface MatrixRoom {
  roomId?: string
  room_id?: string
}

/** Matrix 成员接口 */
interface MatrixMember {
  roomId?: string
  room_id?: string
  userId?: string
  user_id?: string
  membership?: string
}

/** Matrix 客户端扩展接口 */
interface MatrixClientExtended {
  on?: (event: string, handler: (...args: unknown[]) => void) => void
  once?: (event: string, handler: (...args: unknown[]) => void) => void
  removeAllListeners?: (event?: string) => void
  getRoom?: (roomId: string) => MatrixRoom | null
  getSyncToken?: () => string
  sync?: () => Promise<unknown>
}

interface QueuedEvent {
  type: string
  roomId: string
  event: MatrixEvent
  timestamp: number
}

export class MatrixSyncOptimizer {
  private client: MatrixClientExtended | null = null
  private syncOptions: Required<SyncOptions>
  private eventQueue: QueuedEvent[] = []
  private isProcessing = false
  private lastSyncToken: string | null = null
  private eventCache = new Map<string, MatrixEvent[]>()
  private roomTimelines = new Map<string, string>()
  private syncTimer: ReturnType<typeof setInterval> | null = null

  constructor(options: SyncOptions = {}) {
    this.syncOptions = {
      syncInterval: 5000, // 5秒
      batchSize: 100,
      enableIncremental: true,
      eventCacheSize: 1000,
      ...options
    }
  }

  /** 初始化同步优化器 */
  initialize(client: MatrixClientExtended) {
    this.client = client

    // 设置事件监听
    this.setupEventListeners()

    // 启动定时同步
    this.startPeriodicSync()
  }

  /** 设置事件监听器 */
  private setupEventListeners() {
    if (!this.client) return // 监听房间事件，使用批量处理
    this.client.on?.('Room.timeline', (...args: unknown[]) => {
      const event = args[0] as MatrixEvent
      const room = args[1] as MatrixRoom
      this.queueEvent({
        type: 'timeline',
        roomId: room.roomId || room.room_id || '',
        event,
        timestamp: Date.now()
      })
    })

    // 监听成员变化
    this.client.on?.('RoomMember.membership', (...args: unknown[]) => {
      const event = args[0] as MatrixEvent
      const member = args[1] as MatrixMember
      this.queueEvent({
        type: 'membership',
        roomId: member.roomId || member.room_id || '',
        event,
        timestamp: Date.now()
      })
    })

    // 监听接收回执
    this.client.on?.('Room.receipt', (...args: unknown[]) => {
      const event = args[0] as MatrixEvent
      const room = args[1] as MatrixRoom
      this.queueEvent({
        type: 'receipt',
        roomId: room.roomId || room.room_id || '',
        event,
        timestamp: Date.now()
      })
    })

    // 监听输入状态
    this.client.on?.('Room.typing', (...args: unknown[]) => {
      const event = args[0] as MatrixEvent
      const room = args[1] as MatrixRoom
      this.queueEvent({
        type: 'typing',
        roomId: room.roomId || room.room_id || '',
        event,
        timestamp: Date.now()
      })
    })
  }

  /** 将事件加入队列 */
  private queueEvent(eventData: QueuedEvent) {
    this.eventQueue.push(eventData)

    // 限制队列大小
    if (this.eventQueue.length > this.syncOptions.batchSize * 2) {
      this.eventQueue = this.eventQueue.slice(-this.syncOptions.batchSize)
    }

    // 触发批量处理
    this.processBatch()
  }

  /** 批量处理事件 */
  private processBatch = debounce(() => {
    if (this.isProcessing || this.eventQueue.length === 0) return

    this.isProcessing = true

    try {
      const batch = this.eventQueue.splice(0, this.syncOptions.batchSize)
      this.processBatchEvents(batch)
    } finally {
      this.isProcessing = false
    }
  }, 100) // 100ms防抖

  /** 处理批量事件 */
  private processBatchEvents(events: QueuedEvent[]) {
    if (!this.client) return

    // 按房间分组事件
    const eventsByRoom = new Map<string, QueuedEvent[]>()
    events.forEach((event) => {
      if (!eventsByRoom.has(event.roomId)) {
        eventsByRoom.set(event.roomId, [])
      }
      eventsByRoom.get(event.roomId)!.push(event)
    })

    // 并行处理每个房间的事件
    const roomPromises = Array.from(eventsByRoom.entries()).map(([roomId, roomEvents]) =>
      this.processRoomEvents(roomId, roomEvents)
    )

    Promise.all(roomPromises).catch((e) => logger.error('processRoomEvents failed:', toError(e)))
  }

  /** 处理单个房间的事件 */
  private async processRoomEvents(roomId: string, events: QueuedEvent[]) {
    const room = this.client?.getRoom?.(roomId)
    if (!room) return

    // 按类型排序事件
    events.sort((a, b) => {
      const priority: Record<string, number> = { timeline: 0, membership: 1, receipt: 2, typing: 3 }
      const ap = priority[a.type as string] ?? 99
      const bp = priority[b.type as string] ?? 99
      return ap - bp
    })

    // 处理每种类型的事件
    for (const eventData of events) {
      await this.processEvent(eventData)
    }

    // 更新房间时间线
    const latestEvent = events[events.length - 1]
    if (latestEvent && latestEvent.event.event_id) {
      this.roomTimelines.set(roomId, latestEvent.event.event_id)
    }
  }

  /** 处理单个事件 */
  private async processEvent(eventData: QueuedEvent) {
    // 缓存事件
    this.cacheEvent(eventData.roomId, eventData.event)

    // 根据事件类型执行特定处理
    switch (eventData.type) {
      case 'timeline':
        await this.processTimelineEvent(eventData)
        break
      case 'membership':
        await this.processMembershipEvent(eventData)
        break
      case 'receipt':
        await this.processReceiptEvent(eventData)
        break
      case 'typing':
        await this.processTypingEvent(eventData)
        break
    }
  }

  /** 处理时间线事件 */
  private async processTimelineEvent(eventData: QueuedEvent) {
    // 触发UI更新
    this.emit('timelineUpdate', {
      roomId: eventData.roomId,
      event: eventData.event
    })
  }

  /** 处理成员事件 */
  private async processMembershipEvent(eventData: QueuedEvent) {
    this.emit('membershipUpdate', {
      roomId: eventData.roomId,
      event: eventData.event
    })
  }

  /** 处理回执事件 */
  private async processReceiptEvent(eventData: QueuedEvent) {
    this.emit('receiptUpdate', {
      roomId: eventData.roomId,
      event: eventData.event
    })
  }

  /** 处理输入事件 */
  private async processTypingEvent(eventData: QueuedEvent) {
    const content = eventData.event.getContent?.()
    const userIds = content?.user_ids
    this.emit('typingUpdate', {
      roomId: eventData.roomId,
      users: Array.isArray(userIds) ? userIds : []
    })
  }

  /** 缓存事件 */
  private cacheEvent(roomId: string, event: MatrixEvent) {
    if (!this.eventCache.has(roomId)) {
      this.eventCache.set(roomId, [])
    }

    const cache = this.eventCache.get(roomId)!
    cache.push(event)

    // 限制缓存大小
    if (cache.length > this.syncOptions.eventCacheSize) {
      cache.splice(0, cache.length - this.syncOptions.eventCacheSize)
    }
  }

  /** 启动定时同步 */
  private startPeriodicSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
    }

    this.syncTimer = setInterval(() => {
      this.performIncrementalSync()
    }, this.syncOptions.syncInterval)
  }

  /** 执行增量同步 */
  private async performIncrementalSync() {
    if (!this.client || !this.syncOptions.enableIncremental) return

    try {
      // 获取当前同步令牌
      const syncToken = this.client.getSyncToken?.()

      if (syncToken !== undefined && syncToken !== this.lastSyncToken) {
        // 执行增量同步
        await this.client.sync?.()
        this.lastSyncToken = syncToken
      }
    } catch (error) {
      logger.error('Incremental sync failed:', toError(error))
      // 降级到完整同步
      await this.client.sync?.()
    }
  }

  /** 获取房间的事件缓存 */
  getRoomEvents(roomId: string, limit?: number): MatrixEvent[] {
    const events = this.eventCache.get(roomId) || []
    return limit ? events.slice(-limit) : events
  }

  /** 获取房间时间线位置 */
  getRoomTimeline(roomId: string): string | undefined {
    return this.roomTimelines.get(roomId)
  }

  /** 清理缓存 */
  clearCache() {
    this.eventCache.clear()
    this.roomTimelines.clear()
    this.eventQueue = []
  }

  /** 暂停同步 */
  pause() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
    }
  }

  /** 恢复同步 */
  resume() {
    this.startPeriodicSync()
  }

  /** 销毁优化器 */
  destroy() {
    this.pause()
    this.clearCache()
    this.client = null
  }

  /** 简单的事件发射器 */
  private listeners = new Map<string, Array<(...args: unknown[]) => void>>()

  on(event: string, callback: (...args: unknown[]) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(callback)
  }

  off(event: string, callback: (...args: unknown[]) => void) {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  private emit(event: string, data: unknown) {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(data)
        } catch (error) {
          logger.error(`Error in ${event} callback:`, toError(error))
        }
      })
    }
  }
}

/** 创建同步优化器实例 */
export function createSyncOptimizer(options?: SyncOptions) {
  return new MatrixSyncOptimizer(options)
}
