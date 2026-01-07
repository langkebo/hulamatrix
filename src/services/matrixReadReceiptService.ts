/**
 * Matrix Read Receipt Service
 * Manages read receipts, unread counts, and read status tracking
 *
 * @module services/matrixReadReceiptService
 */

import { logger } from '@/utils/logger'

/**
 * 已读回执类型
 */
export type ReadReceiptType = 'm.read' | 'm.read.private'

/**
 * 已读回执信息
 */
export interface ReadReceipt {
  userId: string
  eventId: string
  roomId: string
  timestamp: number
  type: ReadReceiptType
}

/**
 * 未读计数信息
 */
export interface UnreadCount {
  notifications: number
  highlights: number
}

/**
 * 房间未读详情
 */
export interface RoomUnreadInfo {
  roomId: string
  unreadCount: UnreadCount
  lastReadEventId?: string
  lastReadTime?: number
}

/**
 * 全局未读统计
 */
export interface GlobalUnreadStats {
  totalNotifications: number
  totalHighlights: number
  rooms: RoomUnreadInfo[]
  totalRooms: number
}

/**
 * 事件类型
 */
export type ReadReceiptEvent = 'read_receipt_updated' | 'unread_count_updated' | 'room_marked_read'

/**
 * Matrix Read Receipt Service
 * 管理已读回执和未读计数
 */
export class MatrixReadReceiptService {
  private static instance: MatrixReadReceiptService

  // 已读回执缓存 (roomId -> eventId -> Set<userId>)
  private receiptCache: Map<string, Map<string, Set<string>>> = new Map()

  // 房间未读计数缓存
  private unreadCountCache: Map<string, UnreadCount> = new Map()

  // 事件监听器
  private listeners: Map<ReadReceiptEvent, Array<(data: unknown) => void>> = new Map()

  private constructor() {
    this.setupEventListeners()
  }

  static getInstance(): MatrixReadReceiptService {
    if (!MatrixReadReceiptService.instance) {
      MatrixReadReceiptService.instance = new MatrixReadReceiptService()
    }
    return MatrixReadReceiptService.instance
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    const events: ReadReceiptEvent[] = ['read_receipt_updated', 'unread_count_updated', 'room_marked_read']
    events.forEach((event) => {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, [])
      }
    })
  }

  /**
   * 初始化服务
   */
  async initialize(matrixClient: unknown): Promise<void> {
    logger.info('[MatrixReadReceiptService] Initializing')

    const client = matrixClient as {
      on?: (event: string, handler: (...args: unknown[]) => void) => void
      getRooms?: () => unknown[]
    }

    if (!client) {
      throw new Error('Matrix client is required')
    }

    // 监听已读回执事件
    client.on?.('Room.newReadReceipt', (...args: unknown[]) => {
      const event = args[0] as {
        getSender?: () => string
        getContent?: () => { event_id?: string }
      }
      const room = args[1] as { roomId?: string }
      this.handleReadReceiptUpdate(event, room)
    })

    // 初始化未读计数
    this.initializeUnreadCounts(client)

    logger.info('[MatrixReadReceiptService] Initialized')
  }

  /**
   * 初始化未读计数
   */
  private initializeUnreadCounts(client: { getRooms?: () => unknown[] }): void {
    try {
      const rooms = client.getRooms?.() || []

      rooms.forEach((room: unknown) => {
        const roomLike = room as {
          roomId?: string
          getUnreadNotificationCount?: () => number
          getUnreadHighlightCount?: () => number
        }

        if (roomLike.roomId) {
          const unreadCount: UnreadCount = {
            notifications: roomLike.getUnreadNotificationCount?.() || 0,
            highlights: roomLike.getUnreadHighlightCount?.() || 0
          }
          this.unreadCountCache.set(roomLike.roomId, unreadCount)
        }
      })

      logger.info('[MatrixReadReceiptService] Unread counts initialized', {
        count: this.unreadCountCache.size
      })
    } catch (error) {
      logger.error('[MatrixReadReceiptService] Failed to initialize unread counts:', error)
    }
  }

  /**
   * 处理已读回执更新
   */
  private handleReadReceiptUpdate(
    event: {
      getSender?: () => string
      getContent?: () => { event_id?: string }
    },
    room: { roomId?: string }
  ): void {
    try {
      const userId = event.getSender?.()
      const content = event.getContent?.()
      const roomId = room.roomId
      const eventId = content?.event_id

      if (!userId || !roomId || !eventId) return

      // 添加到缓存
      if (!this.receiptCache.has(roomId)) {
        this.receiptCache.set(roomId, new Map())
      }

      const roomReceipts = this.receiptCache.get(roomId)!
      if (!roomReceipts.has(eventId)) {
        roomReceipts.set(eventId, new Set())
      }

      roomReceipts.get(eventId)!.add(userId)

      const receiptInfo: ReadReceipt = {
        userId,
        eventId,
        roomId,
        timestamp: Date.now(),
        type: 'm.read'
      }

      this.emit('read_receipt_updated', receiptInfo)

      logger.debug('[MatrixReadReceiptService] Read receipt updated', {
        userId,
        roomId,
        eventId
      })
    } catch (error) {
      logger.error('[MatrixReadReceiptService] Failed to handle read receipt update:', error)
    }
  }

  /**
   * 发送已读回执
   */
  async sendReadReceipt(
    client: { sendReadReceipt?: (roomId: string, eventId: string, type?: ReadReceiptType) => Promise<void> },
    roomId: string,
    eventId: string,
    type: ReadReceiptType = 'm.read'
  ): Promise<void> {
    try {
      await client.sendReadReceipt?.(roomId, eventId, type)

      logger.info('[MatrixReadReceiptService] Read receipt sent', {
        roomId,
        eventId,
        type
      })
    } catch (error) {
      logger.error('[MatrixReadReceiptService] Failed to send read receipt:', error)
      throw error
    }
  }

  /**
   * 标记房间为已读
   */
  async markRoomAsRead(
    client: {
      sendReadReceipt?: (roomId: string, eventId: string) => Promise<void>
      getRoom?: (roomId: string) => {
        timeline?: Array<{ getId?: () => string }>
      } | null
    },
    roomId: string
  ): Promise<void> {
    try {
      const room = client.getRoom?.(roomId)
      if (!room) {
        throw new Error(`Room ${roomId} not found`)
      }

      const timeline = room.timeline || []
      if (timeline.length === 0) {
        logger.warn('[MatrixReadReceiptService] No events in room to mark as read', { roomId })
        return
      }

      const lastEvent = timeline[timeline.length - 1]
      const eventId = lastEvent.getId?.()

      if (!eventId) {
        throw new Error('Last event has no ID')
      }

      await this.sendReadReceipt(client, roomId, eventId)

      // 更新缓存
      this.unreadCountCache.set(roomId, {
        notifications: 0,
        highlights: 0
      })

      this.emit('room_marked_read', { roomId, eventId })

      logger.info('[MatrixReadReceiptService] Room marked as read', { roomId })
    } catch (error) {
      logger.error('[MatrixReadReceiptService] Failed to mark room as read:', error)
      throw error
    }
  }

  /**
   * 标记所有房间为已读
   */
  async markAllRoomsAsRead(client: {
    getRooms?: () => Array<{ roomId?: string }>
    sendReadReceipt?: (roomId: string, eventId: string) => Promise<void>
    getRoom?: (roomId: string) => {
      timeline?: Array<{ getId?: () => string }>
    } | null
  }): Promise<void> {
    try {
      const rooms = client.getRooms?.() || []

      for (const room of rooms) {
        if (room.roomId) {
          await this.markRoomAsRead(client, room.roomId)
        }
      }

      logger.info('[MatrixReadReceiptService] All rooms marked as read')
    } catch (error) {
      logger.error('[MatrixReadReceiptService] Failed to mark all rooms as read:', error)
      throw error
    }
  }

  /**
   * 获取消息的已读回执
   */
  getReadReceipts(roomId: string, eventId: string): ReadReceipt[] {
    const roomReceipts = this.receiptCache.get(roomId)?.get(eventId)
    if (!roomReceipts) return []

    return Array.from(roomReceipts).map((userId) => ({
      userId,
      eventId,
      roomId,
      timestamp: Date.now(),
      type: 'm.read'
    }))
  }

  /**
   * 获取房间未读计数
   */
  getRoomUnreadCount(roomId: string): UnreadCount {
    return this.unreadCountCache.get(roomId) || { notifications: 0, highlights: 0 }
  }

  /**
   * 刷新房间未读计数
   */
  refreshRoomUnreadCount(
    client: {
      getRoom?: (roomId: string) => {
        getUnreadNotificationCount?: () => number
        getUnreadHighlightCount?: () => number
      } | null
    },
    roomId: string
  ): UnreadCount {
    const room = client.getRoom?.(roomId)
    if (!room) {
      return { notifications: 0, highlights: 0 }
    }

    const unreadCount: UnreadCount = {
      notifications: room.getUnreadNotificationCount?.() || 0,
      highlights: room.getUnreadHighlightCount?.() || 0
    }

    this.unreadCountCache.set(roomId, unreadCount)

    this.emit('unread_count_updated', { roomId, unreadCount })

    return unreadCount
  }

  /**
   * 获取全局未读统计
   */
  getGlobalUnreadStats(): GlobalUnreadStats {
    let totalNotifications = 0
    let totalHighlights = 0

    const rooms: RoomUnreadInfo[] = []

    this.unreadCountCache.forEach((unreadCount, roomId) => {
      totalNotifications += unreadCount.notifications
      totalHighlights += unreadCount.highlights

      rooms.push({
        roomId,
        unreadCount
      })
    })

    return {
      totalNotifications,
      totalHighlights,
      rooms,
      totalRooms: rooms.length
    }
  }

  /**
   * 获取有未读消息的房间列表
   */
  getRoomsWithUnreads(): RoomUnreadInfo[] {
    const rooms: RoomUnreadInfo[] = []

    this.unreadCountCache.forEach((unreadCount, roomId) => {
      if (unreadCount.notifications > 0 || unreadCount.highlights > 0) {
        rooms.push({
          roomId,
          unreadCount
        })
      }
    })

    // 按通知数量排序
    rooms.sort((a, b) => b.unreadCount.notifications - a.unreadCount.notifications)

    return rooms
  }

  /**
   * 检查消息是否已读
   */
  isEventRead(roomId: string, eventId: string, userId?: string): boolean {
    const roomReceipts = this.receiptCache.get(roomId)?.get(eventId)
    if (!roomReceipts) return false

    if (userId) {
      return roomReceipts.has(userId)
    }

    return roomReceipts.size > 0
  }

  /**
   * 获取消息的已读用户数
   */
  getReadCount(roomId: string, eventId: string): number {
    const roomReceipts = this.receiptCache.get(roomId)?.get(eventId)
    return roomReceipts?.size || 0
  }

  /**
   * 添加事件监听器
   */
  on(event: ReadReceiptEvent, listener: (data: unknown) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(listener)
  }

  /**
   * 移除事件监听器
   */
  off(event: ReadReceiptEvent, listener: (data: unknown) => void): void {
    const listeners = this.listeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(listener)
      if (index !== -1) {
        listeners.splice(index, 1)
      }
    }
  }

  /**
   * 发送事件
   */
  private emit(event: ReadReceiptEvent, data: unknown): void {
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(data)
        } catch (error) {
          logger.error('[MatrixReadReceiptService] Event listener error', { event, error })
        }
      })
    }
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.receiptCache.clear()
    this.unreadCountCache.clear()
    this.listeners.clear()
    logger.info('[MatrixReadReceiptService] Disposed')
  }
}

// 导出单例实例
export const matrixReadReceiptService = MatrixReadReceiptService.getInstance()

// 导出便捷函数
export async function initializeReadReceipts(client: unknown): Promise<void> {
  return matrixReadReceiptService.initialize(client)
}

export async function sendReadReceipt(
  client: { sendReadReceipt?: (roomId: string, eventId: string, type?: ReadReceiptType) => Promise<void> },
  roomId: string,
  eventId: string,
  type?: ReadReceiptType
): Promise<void> {
  return matrixReadReceiptService.sendReadReceipt(client, roomId, eventId, type)
}

export function getRoomUnreadCount(roomId: string): UnreadCount {
  return matrixReadReceiptService.getRoomUnreadCount(roomId)
}

export function getGlobalUnreadStats(): GlobalUnreadStats {
  return matrixReadReceiptService.getGlobalUnreadStats()
}
