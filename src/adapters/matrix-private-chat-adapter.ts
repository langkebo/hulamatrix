/**
 * Matrix 私密聊天适配器
 *
 * 基于 Matrix SDK 的私信房间实现私密聊天功能
 */

import { matrixClientService } from '@/integrations/matrix/client'
import type { PrivateChatAdapter, PrivateChatSession, PrivateChatMessage } from './service-adapter'
import { logger } from '@/utils/logger'

/** Matrix 客户端扩展接口 */
interface MatrixClientExtended {
  createRoom: (options: Record<string, unknown>) => Promise<MatrixRoomResponse | string>
  sendEvent: (
    roomId: string,
    eventType: string,
    content: Record<string, unknown>
  ) => Promise<MatrixEventResponse | string>
  sendReadReceipt: (roomId: string, eventId: string) => Promise<unknown>
  sendStateEvent: (
    roomId: string,
    eventType: string,
    content: Record<string, unknown>,
    stateKey: string
  ) => Promise<unknown>
  redactEvent: (roomId: string, eventId: string, reason?: string) => Promise<unknown>
  leave: (roomId: string) => Promise<unknown>
  getRoom: (roomId: string) => MatrixRoom | null
  getUserId: () => string
  getAccountData: (type: string) => Promise<Record<string, string[]> | null>
  on: (event: string, handler: (...args: unknown[]) => void) => void
  removeListener: (event: string, handler: (...args: unknown[]) => void) => void
}

/** Matrix 房间创建响应 */
interface MatrixRoomResponse {
  room_id?: string
}

/** Matrix 事件响应 */
interface MatrixEventResponse {
  event_id?: string
}

/** Matrix 房间接口 */
interface MatrixRoom {
  roomId?: string
  name?: string
  getUnreadNotificationCount?: () => number
  getLiveTimeline: () => MatrixTimeline
  currentState: {
    getStateEvents: (eventType: string, stateKey?: string) => MatrixStateEvent[]
  }
}

/** Matrix 时间线接口 */
interface MatrixTimeline {
  getEvents: () => MatrixEvent[]
}

/** Matrix 事件接口 */
interface MatrixEvent {
  getType: () => string
  getRoom: () => { roomId?: string } | null
  getSender: () => string
  getTs: () => number
  getLocalId: () => string
  getId: () => string
  getContent: () => MatrixMessageContent
}

/** Matrix 状态事件接口 */
interface MatrixStateEvent {
  getContent: () => MatrixMessageContent
}

/** Matrix 消息内容接口 */
interface MatrixMessageContent {
  msgtype?: string
  body?: string
  url?: string
  filename?: string
  [key: string]: unknown
}

export class MatrixPrivateChatAdapter implements PrivateChatAdapter {
  name = 'matrix-private-chat'
  priority = 80

  private messageCallbacks: Map<string, Set<(message: PrivateChatMessage) => void>> = new Map()
  private sessionCallbacks: Set<(session: PrivateChatSession) => void> = new Set()
  private eventHandlers: Map<string, (...args: unknown[]) => void> = new Map()

  async isReady(): Promise<boolean> {
    try {
      const client = matrixClientService.getClient()
      return !!client
    } catch (error) {
      logger.error('[MatrixPrivateChatAdapter] 检查就绪状态失败:', error)
      return false
    }
  }

  async initialize(): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix 客户端未初始化')
      }

      // 监听私信房间事件
      this.setupEventListeners(client)
      logger.info('[MatrixPrivateChatAdapter] 初始化成功')
    } catch (error) {
      logger.error('[MatrixPrivateChatAdapter] 初始化失败:', error)
      throw error
    }
  }

  async cleanup(): Promise<void> {
    this.messageCallbacks.clear()
    this.sessionCallbacks.clear()
    this.eventHandlers.forEach((handler, eventId) => {
      const client = matrixClientService.getClient()
      if (client) {
        const clientExtended = client as unknown as MatrixClientExtended
        clientExtended.removeListener(eventId, handler)
      }
    })
    this.eventHandlers.clear()
  }

  /**
   * 获取私密聊天会话列表
   */
  async listSessions(): Promise<PrivateChatSession[]> {
    try {
      const client = matrixClientService.getClient()
      if (!client) throw new Error('Matrix 客户端未初始化')

      const clientExtended = client as unknown as MatrixClientExtended

      // 获取所有 m.direct 房间
      const directRooms = await this.getDirectRooms(client)
      const sessions: PrivateChatSession[] = []

      for (const [userId, roomIds] of Object.entries(directRooms)) {
        for (const roomId of roomIds) {
          try {
            const room = clientExtended.getRoom(roomId)
            if (!room) continue

            // 获取最后消息
            const lastMessage = await this.getLastMessage(room)
            const unreadCount = room.getUnreadNotificationCount?.() || 0
            const avatarUrl = this.getRoomAvatar(room, userId)

            const sessionData: PrivateChatSession = {
              sessionId: roomId,
              userId: userId,
              displayName: this.getRoomName(room, userId),
              unreadCount: unreadCount,
              isRead: unreadCount === 0
            }

            // Only add avatarUrl if it exists (exactOptionalPropertyTypes)
            if (avatarUrl) {
              sessionData.avatarUrl = avatarUrl
            }

            // Only add lastMessage if it exists
            if (lastMessage) {
              sessionData.lastMessage = {
                content: this.getMessageContent(lastMessage),
                timestamp: lastMessage.getTs() || Date.now(),
                isSelf: lastMessage.getSender() === clientExtended.getUserId()
              }
            }

            sessions.push(sessionData)
          } catch (error) {
            logger.warn('[MatrixPrivateChatAdapter] 处理房间失败:', { roomId, error })
          }
        }
      }

      return sessions.sort((a, b) => {
        const aTime = a.lastMessage?.timestamp || 0
        const bTime = b.lastMessage?.timestamp || 0
        return bTime - aTime
      })
    } catch (error) {
      logger.error('[MatrixPrivateChatAdapter] 获取会话列表失败:', error)
      return []
    }
  }

  /**
   * 创建私密聊天会话
   */
  async createSession(userId: string): Promise<string> {
    try {
      const client = matrixClientService.getClient()
      if (!client) throw new Error('Matrix 客户端未初始化')

      const clientExtended = client as unknown as MatrixClientExtended

      // 检查是否已有私信房间
      const directRooms = await this.getDirectRooms(client)
      const existingRoomId = directRooms[userId]?.[0]

      if (existingRoomId) {
        return existingRoomId
      }

      // 创建新的私信房间
      const res = await clientExtended.createRoom({
        is_direct: true,
        preset: 'trusted_private_chat',
        invite: [userId],
        visibility: 'private'
      })

      const roomId = (res as MatrixRoomResponse)?.room_id ?? (res as string)
      logger.info('[MatrixPrivateChatAdapter] 创建会话成功:', { userId, roomId })
      return roomId
    } catch (error) {
      logger.error('[MatrixPrivateChatAdapter] 创建会话失败:', error)
      throw error
    }
  }

  /**
   * 获取私密聊天消息
   */
  async getMessages(sessionId: string, limit: number = 50, from?: string): Promise<PrivateChatMessage[]> {
    try {
      const client = matrixClientService.getClient()
      if (!client) throw new Error('Matrix 客户端未初始化')

      const clientExtended = client as unknown as MatrixClientExtended
      const room = clientExtended.getRoom(sessionId)
      if (!room) throw new Error('房间不存在')

      // 获取房间事件
      const events = room.getLiveTimeline().getEvents()
      const messages: PrivateChatMessage[] = []

      for (const event of events) {
        if (event.getType() !== 'm.room.message') continue

        const msg = this.mapMatrixEventToPrivateMessage(sessionId, event)
        if (msg) {
          messages.push(msg)
        }
      }

      // 按时间排序
      messages.sort((a, b) => a.timestamp - b.timestamp)

      // 处理分页
      const startIndex = from ? messages.findIndex((m) => m.messageId === from) : 0
      const endIndex = startIndex > 0 ? startIndex + limit : limit

      return messages.slice(startIndex, endIndex)
    } catch (error) {
      logger.error('[MatrixPrivateChatAdapter] 获取消息失败:', error)
      return []
    }
  }

  /**
   * 发送私密消息
   */
  async sendMessage(
    sessionId: string,
    content: string,
    type: PrivateChatMessage['type'] = 'text',
    ttl?: number
  ): Promise<string> {
    try {
      const client = matrixClientService.getClient()
      if (!client) throw new Error('Matrix 客户端未初始化')

      const clientExtended = client as unknown as MatrixClientExtended
      const room = clientExtended.getRoom(sessionId)
      if (!room) throw new Error('房间不存在')

      // 构建消息内容
      const msgContent = this.buildMessageContent(content, type)

      // 发送消息
      const result = await clientExtended.sendEvent(sessionId, 'm.room.message', msgContent)

      const messageId = (result as MatrixEventResponse)?.event_id ?? (result as string)

      // 如果设置了 TTL，添加自毁标记
      if (ttl) {
        await this.setMessageSelfDestruct(sessionId, messageId, ttl)
      }

      logger.info('[MatrixPrivateChatAdapter] 发送消息成功:', { sessionId, messageId })
      return messageId
    } catch (error) {
      logger.error('[MatrixPrivateChatAdapter] 发送消息失败:', error)
      throw error
    }
  }

  /**
   * 标记消息已读
   */
  async markAsRead(sessionId: string, messageId: string): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) throw new Error('Matrix 客户端未初始化')

      const clientExtended = client as unknown as MatrixClientExtended

      // 发送已读回执
      await clientExtended.sendReadReceipt(sessionId, messageId)

      logger.info('[MatrixPrivateChatAdapter] 标记已读成功:', { sessionId, messageId })
    } catch (error) {
      logger.error('[MatrixPrivateChatAdapter] 标记已读失败:', error)
      throw error
    }
  }

  /**
   * 设置消息自毁
   */
  async setMessageSelfDestruct(sessionId: string, messageId: string, ttl: number): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) throw new Error('Matrix 客户端未初始化')

      const clientExtended = client as unknown as MatrixClientExtended

      // 在房间状态中存储自毁时间
      await clientExtended.sendStateEvent(sessionId, 'm.message_ttl', {}, messageId)

      // 设置定时器销毁消息
      setTimeout(async () => {
        try {
          await this.recallMessage(sessionId, messageId)
        } catch (error) {
          logger.warn('[MatrixPrivateChatAdapter] 自动销毁消息失败:', error)
        }
      }, ttl * 1000)

      logger.info('[MatrixPrivateChatAdapter] 设置消息自毁成功:', { sessionId, messageId, ttl })
    } catch (error) {
      logger.error('[MatrixPrivateChatAdapter] 设置消息自毁失败:', error)
      throw error
    }
  }

  /**
   * 撤回消息
   */
  async recallMessage(sessionId: string, messageId: string): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) throw new Error('Matrix 客户端未初始化')

      const clientExtended = client as unknown as MatrixClientExtended

      // 使用 redaction 撤回消息
      await clientExtended.redactEvent(sessionId, messageId)

      logger.info('[MatrixPrivateChatAdapter] 撤回消息成功:', { sessionId, messageId })
    } catch (error) {
      logger.error('[MatrixPrivateChatAdapter] 撤回消息失败:', error)
      throw error
    }
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) throw new Error('Matrix 客户端未初始化')

      const clientExtended = client as unknown as MatrixClientExtended
      await clientExtended.leave(sessionId)
      logger.info('[MatrixPrivateChatAdapter] 删除会话成功:', { sessionId })
    } catch (error) {
      logger.error('[MatrixPrivateChatAdapter] 删除会话失败:', error)
      throw error
    }
  }

  /**
   * 清除会话历史
   */
  async clearHistory(sessionId: string): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) throw new Error('Matrix 客户端未初始化')

      const clientExtended = client as unknown as MatrixClientExtended

      // 获取房间所有消息并逐个撤回
      const room = clientExtended.getRoom(sessionId)
      if (!room) throw new Error('房间不存在')

      const events = room.getLiveTimeline().getEvents()
      for (const event of events) {
        if (event.getType() === 'm.room.message' && event.getLocalId()) {
          await clientExtended.redactEvent(sessionId, event.getId())
        }
      }

      logger.info('[MatrixPrivateChatAdapter] 清除历史成功:', { sessionId })
    } catch (error) {
      logger.error('[MatrixPrivateChatAdapter] 清除历史失败:', error)
      throw error
    }
  }

  /**
   * 订阅新消息
   */
  subscribeToMessages(sessionId: string, callback: (message: PrivateChatMessage) => void): () => void {
    if (!this.messageCallbacks.has(sessionId)) {
      this.messageCallbacks.set(sessionId, new Set())
    }
    this.messageCallbacks.get(sessionId)!.add(callback)

    // 返回取消订阅函数
    return () => {
      this.messageCallbacks.get(sessionId)?.delete(callback)
    }
  }

  /**
   * 订阅会话更新
   */
  subscribeToSessionUpdates(callback: (session: PrivateChatSession) => void): () => void {
    this.sessionCallbacks.add(callback)

    // 返回取消订阅函数
    return () => {
      this.sessionCallbacks.delete(callback)
    }
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(client: unknown): void {
    const clientExtended = client as unknown as MatrixClientExtended

    // 监听房间事件
    const roomEventHandler = async (event: unknown) => {
      const matrixEvent = event as MatrixEvent
      if (matrixEvent.getType() === 'm.room.message') {
        const room = matrixEvent.getRoom()
        if (!room) return

        const roomId = room.roomId
        if (!roomId) return
        const message = this.mapMatrixEventToPrivateMessage(roomId, matrixEvent)
        if (message) {
          this.notifyMessageCallbacks(roomId, message)
        }
      }
    }

    clientExtended.on('Room.event', roomEventHandler)
    this.eventHandlers.set('Room.event', roomEventHandler)

    // 监听未读数变化
    const unreadHandler = async (...args: unknown[]) => {
      // Matrix SDK Room.receipt event provides (event, room) as arguments
      // args[0] is the event, args[1] is the room
      const room = args[1] as { roomId?: string } | undefined
      const roomId = room?.roomId

      // 通知会话更新，如果提供了房间ID，提供该会话数据
      if (roomId) {
        await this.notifySessionCallbacks(roomId)
      } else {
        // 如果没有房间ID，通知所有会话更新
        await this.notifyAllSessionCallbacks()
      }
    }

    clientExtended.on('Room.receipt', unreadHandler)
    this.eventHandlers.set('Room.receipt', unreadHandler)
  }

  /**
   * 获取所有私信房间
   */
  private async getDirectRooms(client: unknown): Promise<Record<string, string[]>> {
    try {
      const clientExtended = client as unknown as MatrixClientExtended
      const directEvents = await clientExtended.getAccountData('m.direct')
      return directEvents || {}
    } catch (error) {
      logger.warn('[MatrixPrivateChatAdapter] 获取私信房间失败:', error)
      return {}
    }
  }

  /**
   * 获取房间最后消息
   */
  private async getLastMessage(room: MatrixRoom): Promise<MatrixEvent | null> {
    try {
      const events = room.getLiveTimeline().getEvents()
      const messageEvents = events.filter((e) => e.getType() === 'm.room.message')
      const lastEvent = messageEvents[messageEvents.length - 1]
      return lastEvent ?? null
    } catch (_error) {
      return null
    }
  }

  /**
   * 获取房间名称
   */
  private getRoomName(room: MatrixRoom, userId: string): string {
    if (room.name) return room.name
    const nameEvents = room.currentState.getStateEvents('m.room.name')
    const nameEvent = nameEvents[0]
    if (nameEvent) {
      const content = nameEvent.getContent()
      if (typeof content.name === 'string') return content.name
    }
    return userId // fallback 到 userId
  }

  /**
   * 获取房间头像
   */
  private getRoomAvatar(room: MatrixRoom, _userId: string): string | undefined {
    const avatarEvents = room.currentState.getStateEvents('m.room.avatar')
    const avatarEvent = avatarEvents[0]
    if (avatarEvent) {
      const content = avatarEvent.getContent()
      if (typeof content.url === 'string') return content.url
    }
    return undefined
  }

  /**
   * 获取消息内容
   */
  private getMessageContent(event: MatrixEvent): string {
    const content = event.getContent()
    if (content?.msgtype === 'm.text') {
      return content?.body ?? ''
    } else if (content?.msgtype === 'm.image') {
      return '[图片]'
    } else if (content?.msgtype === 'm.file') {
      return '[文件]'
    } else if (content?.msgtype === 'm.audio') {
      return '[语音]'
    } else if (content?.msgtype === 'm.video') {
      return '[视频]'
    }
    return '[未知消息]'
  }

  /**
   * 构建消息内容
   */
  private buildMessageContent(content: string, type: PrivateChatMessage['type']): Record<string, unknown> {
    const msgtypeMap: Record<PrivateChatMessage['type'], string> = {
      text: 'm.text',
      image: 'm.image',
      file: 'm.file',
      voice: 'm.audio',
      video: 'm.video'
    }

    const msgtype = msgtypeMap[type] || 'm.text'

    if (type === 'text') {
      return { msgtype, body: content }
    } else if (type === 'image') {
      return { msgtype, body: content, url: content }
    } else if (type === 'file') {
      return { msgtype, body: '[文件]', url: content, filename: content }
    } else if (type === 'voice') {
      return { msgtype, body: '[语音]', url: content }
    } else if (type === 'video') {
      return { msgtype, body: '[视频]', url: content }
    }

    return { msgtype, body: content }
  }

  /**
   * 映射 Matrix 事件到私密消息
   */
  private mapMatrixEventToPrivateMessage(sessionId: string, event: MatrixEvent): PrivateChatMessage | null {
    try {
      const content = event.getContent()
      const senderId = event.getSender()
      const timestamp = event.getTs() || Date.now()
      const localId = event.getLocalId()
      const eventId = event.getId()

      // 映射消息类型
      let type: PrivateChatMessage['type'] = 'text'
      if (content?.msgtype === 'm.image') type = 'image'
      else if (content?.msgtype === 'm.file') type = 'file'
      else if (content?.msgtype === 'm.audio') type = 'voice'
      else if (content?.msgtype === 'm.video') type = 'video'

      const client = matrixClientService.getClient()
      if (!client) return null
      const clientExtended = client as unknown as MatrixClientExtended

      return {
        messageId: eventId || localId || `${sessionId}-${timestamp}`,
        sessionId: sessionId,
        senderId: senderId,
        content: this.getMessageContent(event),
        type: type,
        timestamp: timestamp,
        isSelf: senderId === clientExtended.getUserId(),
        status: 'sent'
      }
    } catch (error) {
      logger.warn('[MatrixPrivateChatAdapter] 映射消息失败:', error)
      return null
    }
  }

  /**
   * 通知消息回调
   */
  private notifyMessageCallbacks(sessionId: string, message: PrivateChatMessage): void {
    const callbacks = this.messageCallbacks.get(sessionId)
    callbacks?.forEach((callback) => {
      try {
        callback(message)
      } catch (error) {
        logger.error('[MatrixPrivateChatAdapter] 消息回调错误:', error)
      }
    })
  }

  /**
   * 通知会话更新回调（特定会话）
   */
  private async notifySessionCallbacks(roomId: string): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) return

      const clientExtended = client as unknown as MatrixClientExtended
      const room = clientExtended.getRoom(roomId)
      if (!room) return

      // 获取该房间的用户ID（从 m.direct 获取）
      const directRooms = await this.getDirectRooms(client)
      let userId: string | undefined

      for (const [uid, roomIds] of Object.entries(directRooms)) {
        if (roomIds.includes(roomId)) {
          userId = uid
          break
        }
      }

      if (!userId) return

      // 构建会话数据
      const lastMessage = await this.getLastMessage(room)
      const unreadCount = room.getUnreadNotificationCount?.() || 0
      const avatarUrl = this.getRoomAvatar(room, userId)

      const sessionData: PrivateChatSession = {
        sessionId: roomId,
        userId: userId,
        displayName: this.getRoomName(room, userId),
        unreadCount: unreadCount,
        isRead: unreadCount === 0
      }

      // Only add avatarUrl if it exists
      if (avatarUrl) {
        sessionData.avatarUrl = avatarUrl
      }

      // Only add lastMessage if it exists
      if (lastMessage) {
        sessionData.lastMessage = {
          content: this.getMessageContent(lastMessage),
          timestamp: lastMessage.getTs() || Date.now(),
          isSelf: lastMessage.getSender() === clientExtended.getUserId()
        }
      }

      // Notify callbacks
      this.sessionCallbacks.forEach((callback) => {
        try {
          callback(sessionData)
        } catch (error) {
          logger.error('[MatrixPrivateChatAdapter] 会话回调错误:', error)
        }
      })
    } catch (error) {
      logger.error('[MatrixPrivateChatAdapter] Failed to notify session callbacks:', error)
    }
  }

  /**
   * 通知会话更新回调（所有会话）
   */
  private async notifyAllSessionCallbacks(): Promise<void> {
    try {
      const sessions = await this.listSessions()

      this.sessionCallbacks.forEach((callback) => {
        try {
          sessions.forEach((session) => callback(session))
        } catch (error) {
          logger.error('[MatrixPrivateChatAdapter] 会话回调错误:', error)
        }
      })
    } catch (error) {
      logger.error('[MatrixPrivateChatAdapter] Failed to notify all session callbacks:', error)
    }
  }
}

// 导出单例实例
export const matrixPrivateChatAdapter = new MatrixPrivateChatAdapter()
