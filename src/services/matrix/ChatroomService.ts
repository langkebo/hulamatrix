/*
 * Chatroom Management Service
 *
 * Provides chatroom/room management functionality including:
 * - Room list and details
 * - Room messages
 * - Unread count management
 * - Message operations
 */

import { enhancedSdkService } from './EnhancedSdkService'
import { SynapseEnhancedError } from './utils/SynapseEnhancedError'
import { createServiceLogger } from '@/utils/Logger'

const logger = createServiceLogger('ChatroomService')

export interface Chatroom {
  roomId: string
  name?: string
  topic?: string
  memberCount: number
  isDirect?: boolean
  lastMessage?: string
  lastActive?: string
  unreadCount?: number
  avatarUrl?: string
}

export interface ChatroomMessage {
  messageId: string
  roomId: string
  senderId: string
  content: string
  messageType: string
  timestamp: string
  edited?: boolean
  replyTo?: string
}

export interface PaginatedChatrooms {
  items: Chatroom[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export interface UnreadCountInfo {
  total: number
  rooms: { roomId: string; count: number }[]
}

class ChatroomService {
  private static instance: ChatroomService
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map()
  private readonly CACHE_TTL = 30 * 1000

  private constructor() {}

  static getInstance(): ChatroomService {
    if (!ChatroomService.instance) {
      ChatroomService.instance = new ChatroomService()
    }
    return ChatroomService.instance
  }

  private getClient() {
    return enhancedSdkService.getClient()
  }

  private getCacheKey(method: string, params?: Record<string, unknown>): string {
    return params ? `${method}:${JSON.stringify(params)}` : method
  }

  private getCached<T>(key: string): T | null {
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data as T
    }
    return null
  }

  private setCache(key: string, data: unknown): void {
    this.cache.set(key, { data, timestamp: Date.now() })
  }

  clearCache(method?: string): void {
    if (method) {
      for (const key of this.cache.keys()) {
        if (key.startsWith(method)) {
          this.cache.delete(key)
        }
      }
    } else {
      this.cache.clear()
    }
  }

  async getChatrooms(page: number = 1, limit: number = 20): Promise<PaginatedChatrooms> {
    const cacheKey = this.getCacheKey('getChatrooms', { page, limit })
    const cached = this.getCached<PaginatedChatrooms>(cacheKey)
    if (cached && page === 1) {
      return cached
    }

    try {
      const client = this.getClient()
      const chatrooms = await client.chatroom.getChatrooms({ page, limit })

      const paginatedResult: PaginatedChatrooms = {
        items: (chatrooms || []).map((room: any) => this.mapChatroom(room)),
        total: (chatrooms || []).length,
        page,
        pageSize: limit,
        hasMore: (chatrooms || []).length === limit
      }

      if (page === 1) {
        this.setCache(cacheKey, paginatedResult)
      }

      return paginatedResult
    } catch (error) {
      logger.error('Failed to get chatrooms:', error)
      if (cached) return cached
      throw this.handleError(error)
    }
  }

  async getChatroomDetail(roomId: string): Promise<Chatroom | null> {
    try {
      const client = this.getClient()
      const room = await client.chatroom.getChatroomDetail(roomId)
      return room ? this.mapChatroom(room) : null
    } catch (error) {
      logger.error('Failed to get chatroom detail:', error)
      return null
    }
  }

  async leaveRoom(roomId: string): Promise<boolean> {
    try {
      const client = this.getClient()
      await client.chatroom.leaveChatroom(roomId)

      this.clearCache('getChatrooms')
      return true
    } catch (error) {
      logger.error('Failed to leave room:', error)
      throw this.handleError(error)
    }
  }

  async sendMessage(roomId: string, content: any): Promise<string> {
    try {
      const client = this.getClient()
      const result = await client.chatroom.sendMessage(roomId, content)
      const messageId =
        typeof result === 'string' ? result : (result as any).message_id || (result as any).event_id || ''

      this.clearCache('getMessages')
      return messageId
    } catch (error) {
      logger.error('Failed to send message:', error)
      throw this.handleError(error)
    }
  }

  async getMessages(
    roomId: string,
    options?: {
      limit?: number
      direction?: 'forward' | 'backward'
      from?: string
    }
  ): Promise<ChatroomMessage[]> {
    const cacheKey = this.getCacheKey('getMessages', { roomId, ...options })
    const cached = this.getCached<ChatroomMessage[]>(cacheKey)
    if (cached && !options?.from) {
      return cached
    }

    try {
      const client = this.getClient()
      const result = await client.chatroom.getMessages(roomId, options)

      const mappedMessages: ChatroomMessage[] = (result.messages || []).map((msg: any) => ({
        messageId: msg.message_id || msg.event_id,
        roomId: msg.room_id,
        senderId: msg.sender_id || msg.sender,
        content: msg.content?.body || msg.content,
        messageType: msg.type || msg.msgtype,
        timestamp: msg.timestamp || msg.origin_server_ts,
        edited: msg.edited || false,
        replyTo: msg.reply_to || msg.thread_root
      }))

      if (!options?.from) {
        this.setCache(cacheKey, mappedMessages)
      }

      return mappedMessages
    } catch (error) {
      logger.error('Failed to get messages:', error)
      if (cached) return cached
      throw this.handleError(error)
    }
  }

  async deleteMessage(roomId: string, messageId: string): Promise<boolean> {
    try {
      const client = this.getClient()
      await client.chatroom.deleteMessage(roomId, messageId)

      this.clearCache('getMessages')
      return true
    } catch (error) {
      logger.error('Failed to delete message:', error)
      throw this.handleError(error)
    }
  }

  async searchMessages(roomId: string, query: string): Promise<ChatroomMessage[]> {
    try {
      const client = this.getClient()
      const result = await (client.chatroom.searchMessages as any)(roomId, query)

      return (result.messages || []).map((msg: any) => ({
        messageId: msg.message_id || msg.event_id,
        roomId: msg.room_id,
        senderId: msg.sender_id || msg.sender,
        content: msg.content?.body || msg.content,
        messageType: msg.type || msg.msgtype,
        timestamp: msg.timestamp || msg.origin_server_ts
      }))
    } catch (error) {
      logger.error('Failed to search messages:', error)
      return []
    }
  }

  async getUnreadCount(roomId?: string): Promise<UnreadCountInfo> {
    const cacheKey = this.getCacheKey('getUnreadCount', { roomId })
    const cached = this.getCached<UnreadCountInfo>(cacheKey)
    if (cached && !roomId) {
      return cached
    }

    try {
      const client = this.getClient()

      if (roomId) {
        const result = await client.chatroom.getUnreadCount()
        const roomData = result.by_room?.find((r: { room_id: string }) => r.room_id === roomId)
        const count = roomData?.unread || 0
        return { total: count, rooms: [{ roomId, count }] }
      }

      const result = await client.chatroom.getUnreadCount()
      const countInfo: UnreadCountInfo = {
        total: result.total_unread || 0,
        rooms: (result.by_room || []).map((r: { room_id: string; unread: number }) => ({
          roomId: r.room_id,
          count: r.unread
        }))
      }

      if (!roomId) {
        this.setCache(cacheKey, countInfo)
      }

      return countInfo
    } catch (error) {
      logger.error('Failed to get unread count:', error)
      if (cached) return cached
      throw this.handleError(error)
    }
  }

  async markAsRead(roomId: string, _messageId?: string): Promise<boolean> {
    try {
      const client = this.getClient()
      await client.chatroom.markAsRead(roomId)

      this.clearCache('getUnreadCount')
      return true
    } catch (error) {
      logger.error('Failed to mark as read:', error)
      throw this.handleError(error)
    }
  }

  private mapChatroom(room: any): Chatroom {
    return {
      roomId: room.room_id || room.id,
      name: room.name || room.display_name,
      topic: room.topic,
      memberCount: room.member_count || room.joined_members || 0,
      isDirect: room.is_direct || room.type === 'direct',
      lastMessage: room.last_message?.content?.body || room.last_message,
      lastActive: room.last_active || room.last_message?.timestamp,
      unreadCount: room.unread_count || room.notification_count,
      avatarUrl: room.avatar_url || room.avatar_url
    }
  }

  private handleError(error: unknown): Error {
    if (error instanceof SynapseEnhancedError) {
      return new Error(`[ChatroomService] ${error.code}: ${error.message}`)
    }
    if (error instanceof Error) {
      return new Error(`[ChatroomService] ${error.message}`)
    }
    return new Error('[ChatroomService] An unknown error occurred')
  }
}

export default ChatroomService
