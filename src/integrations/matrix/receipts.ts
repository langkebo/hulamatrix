/**
 * Matrix Receipts API Integration
 *
 * 提供 Matrix 已读回执（Read Receipts）功能
 * 用于替代旧的 WebSocket get_msg_read_count API
 *
 * **Matrix Receipts API 参考**:
 * - m.read receipt: 标记消息为已读
 * - m.read.private receipt: 私有已读回执（只有自己可见）
 * - client.setRoomReadMarkers(): 设置已读标记
 *
 * **迁移指南**:
 * 旧的 get_msg_read_count API 返回整个消息列表的已读数
 * Matrix 使用事件驱动的回执系统，监听 m.receipt 事件获取实时更新
 */

import { matrixClientService } from './client'
import { logger } from '@/utils/logger'

/**
 * Matrix 已读回执类型
 */
export interface MatrixReadReceipt {
  userId: string
  eventId: string
  roomId: string
  timestamp: number
}

/**
 * 消息已读统计
 */
export interface MessageReadStats {
  eventId: string
  readBy: Array<{
    userId: string
    displayName?: string
    avatarUrl?: string
    timestamp: number
  }>
  count: number
}

/**
 * Matrix Receipts 服务类
 */
export class MatrixReceiptsService {
  private initialized = false

  /**
   * 初始化 Receipts 服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      // 监听已读回执事件
      this.setupReceiptListeners(client)

      this.initialized = true
      logger.info('[MatrixReceipts] Service initialized')
    } catch (error) {
      logger.error('[MatrixReceipts] Initialization failed:', error)
      throw error
    }
  }

  /**
   * 设置已读回执监听器
   */
  private setupReceiptListeners(client: unknown): void {
    // 监听所有已读回执事件
    // 注意：Matrix SDK 的事件系统需要正确的事件名称
    // 这里使用 Room.receipt 事件
    try {
      if (client && typeof client === 'object' && 'on' in client && typeof client.on === 'function') {
        ;(client as { on: (event: string, handler: (...args: unknown[]) => void) => void }).on(
          'Room.receipt',
          (event: unknown) => {
            this.handleReceiptEvent(event)
          }
        )
      }
    } catch (error) {
      logger.warn('[MatrixReceipts] Failed to setup receipt listeners:', error)
    }
  }

  /**
   * 处理已读回执事件
   */
  private handleReceiptEvent(event: unknown): void {
    try {
      if (!event || typeof event !== 'object') {
        return
      }

      // 提取事件内容
      const content = 'getContent' in event && typeof event.getContent === 'function' ? event.getContent() : {}
      const roomId = 'getRoomId' in event && typeof event.getRoomId === 'function' ? event.getRoomId() : undefined

      if (!roomId || typeof content !== 'object') {
        return
      }

      // 遍历所有事件类型（通常是 m.read）
      for (const [eventType, events] of Object.entries(content as Record<string, unknown>)) {
        if (eventType !== 'm.read') continue

        // 遍历所有事件的回执
        for (const [eventId, receipts] of Object.entries(events as Record<string, unknown>)) {
          if (!receipts || typeof receipts !== 'object') continue

          for (const [userId, receipt] of Object.entries(receipts as Record<string, unknown>)) {
            const receiptData = receipt as { ts: number }

            logger.debug('[MatrixReceipts] New receipt', {
              userId,
              eventId,
              roomId,
              timestamp: receiptData.ts
            })

            // 可以在这里触发事件通知 UI 更新
            this.emitReceiptUpdate({
              userId,
              eventId,
              roomId: roomId as string,
              timestamp: receiptData.ts
            })
          }
        }
      }
    } catch (error) {
      logger.error('[MatrixReceipts] Failed to handle receipt event:', error)
    }
  }

  /**
   * 发送已读回执更新事件
   */
  private emitReceiptUpdate(receipt: MatrixReadReceipt): void {
    // 使用 mitt 发送事件
    import('@/hooks/useMitt').then(({ useMitt }) => {
      useMitt.emit('matrix:receipt', receipt)
    })
  }

  /**
   * 标记消息为已读
   * @param roomId 房间 ID
   * @param eventId 消息事件 ID
   */
  async markAsRead(roomId: string, eventId: string): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      // 使用 Matrix SDK 的 setRoomReadMarkers 方法
      // 类型断言为正确的签名
      if (
        client &&
        typeof client === 'object' &&
        'setRoomReadMarkers' in client &&
        typeof client.setRoomReadMarkers === 'function'
      ) {
        await (client.setRoomReadMarkers as (
          roomId: string,
          eventId: string,
          readEventId?: string
        ) => Promise<void>)(roomId, eventId, eventId)
      }

      logger.debug('[MatrixReceipts] Marked as read', { roomId, eventId })
    } catch (error) {
      logger.error('[MatrixReceipts] Failed to mark as read:', error)
      throw error
    }
  }

  /**
   * 标记房间为已读（所有消息）
   * @param roomId 房间 ID
   */
  async markRoomAsRead(roomId: string): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      // 获取房间对象
      let room: unknown = undefined
      if (client && typeof client === 'object' && 'getRoom' in client && typeof client.getRoom === 'function') {
        room = (client.getRoom as (roomId: string) => unknown)(roomId)
      }

      if (!room) {
        throw new Error(`Room ${roomId} not found`)
      }

      // 尝试获取房间的事件来找到最新事件
      let latestEventId: string | undefined = undefined

      if (room && typeof room === 'object') {
        // 尝试多种方法获取最新事件
        if ('getLiveTimeline' in room && typeof room.getLiveTimeline === 'function') {
          try {
            const timeline = (room.getLiveTimeline as () => unknown)()
            if (timeline && typeof timeline === 'object' && 'getEvents' in timeline) {
              const events = (timeline.getEvents as () => unknown[])()
              if (Array.isArray(events) && events.length > 0) {
                const latestEvent = events[events.length - 1]
                if (
                  latestEvent &&
                  typeof latestEvent === 'object' &&
                  'getId' in latestEvent &&
                  typeof latestEvent.getId === 'function'
                ) {
                  latestEventId = (latestEvent.getId as () => string)()
                }
              }
            }
          } catch {
            // 忽略错误，尝试其他方法
          }
        }

        // 如果没有找到最新事件，尝试其他方法
        if (!latestEventId && 'getUnreadTimeline' in room && typeof room.getUnreadTimeline === 'function') {
          try {
            const timeline = (room.getUnreadTimeline as () => unknown)()
            if (timeline && typeof timeline === 'object' && 'getEvents' in timeline) {
              const events = (timeline.getEvents as () => unknown[])()
              if (Array.isArray(events) && events.length > 0) {
                const latestEvent = events[0]
                if (
                  latestEvent &&
                  typeof latestEvent === 'object' &&
                  'getId' in latestEvent &&
                  typeof latestEvent.getId === 'function'
                ) {
                  latestEventId = (latestEvent.getId as () => string)()
                }
              }
            }
          } catch {
            // 忽略错误
          }
        }
      }

      if (latestEventId) {
        await this.markAsRead(roomId, latestEventId)
      }

      logger.debug('[MatrixReceipts] Marked room as read', { roomId })
    } catch (error) {
      logger.error('[MatrixReceipts] Failed to mark room as read:', error)
      throw error
    }
  }

  /**
   * 获取消息的已读回执列表
   * @param roomId 房间 ID
   * @param eventId 消息事件 ID
   * @returns 消息的已读回执统计
   */
  getMessageReadStats(roomId: string, eventId: string): MessageReadStats {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      const room = client && typeof client === 'object' && 'getRoom' in client ? (client.getRoom as (roomId: string) => unknown)(roomId) : undefined

      if (!room) {
        throw new Error(`Room ${roomId} not found`)
      }

      const readBy: MessageReadStats['readBy'] = []

      // 尝试获取回执
      if (room && typeof room === 'object' && 'getReceiptsForEvent' in room && typeof room.getReceiptsForEvent === 'function') {
        try {
          const receipts = (room.getReceiptsForEvent as (eventId: string) => unknown[] | undefined)(eventId)

          if (Array.isArray(receipts)) {
            for (const receipt of receipts) {
              if (!receipt || typeof receipt !== 'object') continue

              const userId = 'userId' in receipt ? String(receipt.userId) : ''

              if (!userId) continue

              let displayName: string | undefined = undefined
              let avatarUrl: string | undefined = undefined
              let timestamp = Date.now()

              // 尝试获取成员信息
              if ('getMember' in room && typeof room.getMember === 'function') {
                try {
                  const member = (room.getMember as (userId: string) => unknown)(userId)
                  if (member && typeof member === 'object') {
                    displayName = 'name' in member && typeof member.name === 'string' ? member.name : undefined
                    if ('getAvatarUrl' in member && typeof member.getAvatarUrl === 'function' && client && 'getBaseUrl' in client && typeof client.getBaseUrl === 'function') {
                      const baseUrl = (client.getBaseUrl as () => string)()
                      avatarUrl = (member.getAvatarUrl as (baseUrl: string) => string)(baseUrl)
                    }
                    timestamp = 'data' in receipt && typeof receipt.data === 'object' && receipt.data !== null && 'ts' in receipt.data ? Number((receipt.data as { ts: unknown }).ts) : Date.now()
                  }
                } catch {
                  // 使用默认值
                  displayName = userId
                }
              }

              readBy.push({
                userId,
                displayName,
                avatarUrl,
                timestamp
              })
            }
          }
        } catch {
          // 返回空数组
        }
      }

      return {
        eventId,
        readBy,
        count: readBy.length
      }
    } catch (error) {
      logger.error('[MatrixReceipts] Failed to get message read stats:', error)
      return {
        eventId,
        readBy: [],
        count: 0
      }
    }
  }

  /**
   * 批量获取消息的已读统计
   * @param roomId 房间 ID
   * @param eventIds 消息事件 ID 列表
   * @returns 消息已读统计映射表
   */
  getBatchMessageReadStats(roomId: string, eventIds: string[]): Map<string, MessageReadStats> {
    const stats = new Map<string, MessageReadStats>()

    for (const eventId of eventIds) {
      stats.set(eventId, this.getMessageReadStats(roomId, eventId))
    }

    return stats
  }

  /**
   * 获取房间成员的已读位置
   * @param roomId 房间 ID
   * @returns 成员已读位置映射表
   */
  getRoomMemberReadPositions(roomId: string): Map<string, string> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      const room = client && typeof client === 'object' && 'getRoom' in client ? (client.getRoom as (roomId: string) => unknown)(roomId) : undefined

      if (!room) {
        throw new Error(`Room ${roomId} not found`)
      }

      const positions = new Map<string, string>()

      // 获取当前用户 ID
      let currentUserId = ''
      if (client && typeof client === 'object' && 'getUserId' in client && typeof client.getUserId === 'function') {
        currentUserId = (client.getUserId as () => string)() || ''
      }

      // 遍历房间成员
      if (room && typeof room === 'object' && 'getJoinedMembers' in room && typeof room.getJoinedMembers === 'function') {
        try {
          const members = (room.getJoinedMembers as () => unknown[])()
          if (Array.isArray(members)) {
            for (const member of members) {
              if (!member || typeof member !== 'object') continue

              const userId = 'userId' in member ? String(member.userId) : ''

              // 跳过当前用户
              if (userId === currentUserId) continue

              // 获取用户的已读事件 ID
              // 注意：Matrix SDK 没有直接 API 获取用户的已读位置
              // 需要通过监听 receipt 事件来维护

              positions.set(userId, '')
            }
          }
        } catch {
          // 返回空映射
        }
      }

      return positions
    } catch (error) {
      logger.error('[MatrixReceipts] Failed to get room member read positions:', error)
      return new Map()
    }
  }
}

// 导出单例实例
export const matrixReceiptsService = new MatrixReceiptsService()
