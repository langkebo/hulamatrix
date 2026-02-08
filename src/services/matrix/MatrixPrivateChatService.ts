import MatrixClientService from './MatrixClientService'
import { enhancedSdkService } from './EnhancedSdkService'

let enhancedClient: any = null

export function setEnhancedClientForTest(client: any): void {
  enhancedClient = client
}

export function clearEnhancedClientForTest(): void {
  enhancedClient = null
}

function getEnhancedClient(): any {
  if (enhancedClient) {
    return enhancedClient
  }
  return enhancedSdkService.getClient()
}

export interface CreateSessionParams {
  participants: string[]
  sessionName?: string
  ttlSeconds?: number
  autoDelete?: boolean
  isEncrypted?: boolean
}

export interface SendMessageParams {
  content: string
  messageType?: 'text' | 'image' | 'file' | 'audio' | 'voice'
  fileUrl?: string
  fileName?: string
  fileSize?: number
  duration?: number
  replyTo?: string
}

export interface PaginationParams {
  limit?: number
  cursor?: string
  page?: number
  offset?: number
  before?: string
  after?: string
}

export interface SearchMessagesParams {
  query: string
  limit?: number
}

export interface PrivateChatSession {
  sessionId: string
  sessionName?: string
  creatorId: string
  participants: string[]
  status: 'active' | 'deleted' | 'closed'
  ttlSeconds: number
  autoDelete: boolean
  createdAt: string
  updatedAt?: string
  unreadCount?: number
}

export interface PrivateChatMessage {
  messageId: string
  sessionId: string
  senderId: string
  content: string
  messageType: 'text' | 'image' | 'file' | 'audio' | 'voice'
  createdAt: string
  expiresAt?: string | null
  readBy: string[]
  duration?: number
}

export interface UnreadCount {
  total: number
  sessions: { sessionId: string; count: number }[]
}

export interface SessionStatistics {
  messageCount: number
  participantCount: number
  lastActivity?: string
}

interface SDKPrivateSession {
  session_id: string
  session_name?: string
  creator_id: string
  participants: string[]
  status: 'active' | 'deleted' | 'closed'
  ttl_seconds: number
  auto_delete: boolean
  created_at: string
  updated_at?: string
  unread_count?: number
}

interface SDKPrivateMessage {
  message_id: string
  session_id: string
  sender_id: string
  content: string
  message_type: 'text' | 'image' | 'file' | 'audio' | 'voice'
  created_at: string
  expires_at?: string | null
  read_by: string[]
  duration?: number
}

export interface PrivateChatCache {
  sessions: PrivateChatSession[]
  messages: Map<string, PrivateChatMessage[]>
  unreadCount: UnreadCount | null
  timestamp: number
}

class MatrixPrivateChatService {
  private static instance: MatrixPrivateChatService
  private cache: Map<string, PrivateChatCache> = new Map()
  private readonly CACHE_TTL = 2 * 60 * 1000

  private constructor() {}

  static getInstance(): MatrixPrivateChatService {
    if (!MatrixPrivateChatService.instance) {
      MatrixPrivateChatService.instance = new MatrixPrivateChatService()
    }
    return MatrixPrivateChatService.instance
  }

  private getClient(): any {
    return getEnhancedClient()
  }

  private getCacheKey(type: string, id?: string): string {
    return id ? `${type}:${id}` : type
  }

  private getCache(type: string, id?: string): PrivateChatCache | null {
    const key = this.getCacheKey(type, id)
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached
    }
    return null
  }

  private setCache(type: string, data: Omit<PrivateChatCache, 'timestamp'>, id?: string): void {
    const key = this.getCacheKey(type, id)
    this.cache.set(key, {
      ...data,
      timestamp: Date.now()
    })
  }

  private clearCache(type?: string, id?: string): void {
    if (type) {
      const key = this.getCacheKey(type, id)
      this.cache.delete(key)
      if (id && type === 'messages') {
        const messagesKey = this.getCacheKey('messages', id)
        this.cache.delete(messagesKey)
      }
    } else {
      this.cache.clear()
    }
  }

  async createSession(params: CreateSessionParams): Promise<string> {
    const enhancedClient = this.getClient()

    if (!params.participants || params.participants.length === 0) {
      throw new Error('At least one participant is required')
    }

    const clientService = MatrixClientService.getInstance()
    const matrixClient = clientService.getClient()
    const userId = matrixClient?.getUserId()

    if (!userId) {
      throw new Error('User not logged in')
    }

    try {
      const sessionId = await enhancedClient.privateChat.createSession({
        creator_id: userId,
        participants: params.participants,
        session_name: params.sessionName,
        ttl_seconds: params.ttlSeconds,
        auto_delete: params.autoDelete
      })

      this.clearCache('sessions')
      return sessionId
    } catch (error) {
      console.error('[MatrixPrivateChatService] Failed to create session:', error)
      throw error
    }
  }

  async getSessions(userId?: string, forceRefresh?: boolean): Promise<PrivateChatSession[]> {
    if (!forceRefresh) {
      const cached = this.getCache('sessions')
      if (cached) {
        return cached.sessions
      }
    }

    const enhancedClient = this.getClient()

    try {
      const sessions = await enhancedClient.privateChat.getSessions(userId)
      const sessionsWithDetails: PrivateChatSession[] = sessions.map((session: SDKPrivateSession) => ({
        sessionId: session.session_id,
        sessionName: session.session_name,
        creatorId: session.creator_id,
        participants: session.participants,
        status: session.status,
        ttlSeconds: session.ttl_seconds,
        autoDelete: session.auto_delete,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
        unreadCount: session.unread_count
      }))

      this.setCache('sessions', { sessions: sessionsWithDetails, messages: new Map(), unreadCount: null })

      return sessionsWithDetails
    } catch (error) {
      console.error('[MatrixPrivateChatService] Failed to get sessions:', error)
      const cached = this.getCache('sessions')
      if (cached) {
        return cached.sessions
      }
      throw error
    }
  }

  async getSessionDetail(sessionId: string): Promise<PrivateChatSession | null> {
    const enhancedClient = this.getClient()

    try {
      const session = await enhancedClient.privateChat.getSessionDetail(sessionId)
      if (!session) {
        return null
      }

      return {
        sessionId: session.session_id,
        sessionName: session.session_name,
        creatorId: session.creator_id,
        participants: session.participants,
        status: session.status,
        ttlSeconds: session.ttl_seconds,
        autoDelete: session.auto_delete,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
        unreadCount: session.unread_count
      }
    } catch (error) {
      console.error('[MatrixPrivateChatService] Failed to get session detail:', error)
      return null
    }
  }

  async closeSession(sessionId: string): Promise<boolean> {
    const enhancedClient = this.getClient()

    const clientService = MatrixClientService.getInstance()
    const matrixClient = clientService.getClient()
    const userId = matrixClient?.getUserId()

    if (!userId) {
      throw new Error('User not logged in')
    }

    try {
      const result = await enhancedClient.privateChat.closeSession(sessionId, userId)
      this.clearCache('sessions', sessionId)
      return result
    } catch (error) {
      console.error('[MatrixPrivateChatService] Failed to close session:', error)
      throw error
    }
  }

  async sendMessage(sessionId: string, params: SendMessageParams): Promise<string> {
    const enhancedClient = this.getClient()

    const clientService = MatrixClientService.getInstance()
    const matrixClient = clientService.getClient()
    const userId = matrixClient?.getUserId()

    if (!userId) {
      throw new Error('User not logged in')
    }

    try {
      const messageId = await enhancedClient.privateChat.sendMessage({
        room_id: sessionId,
        content: params.content,
        type: params.messageType,
        file_url: params.fileUrl,
        file_name: params.fileName,
        file_size: params.fileSize,
        duration: params.duration,
        reply_to: params.replyTo
      })

      this.clearCache('messages', sessionId)
      return messageId
    } catch (error) {
      console.error('[MatrixPrivateChatService] Failed to send message:', error)
      throw error
    }
  }

  async getMessages(sessionId: string, params?: PaginationParams): Promise<PrivateChatMessage[]> {
    const enhancedClient = this.getClient()

    const cacheKey = this.getCacheKey('messages', sessionId)
    const cached = this.cache.get(cacheKey)
    if (cached && !params?.cursor && !params?.page) {
      return cached.messages.get(sessionId) || []
    }

    try {
      const messages = await enhancedClient.privateChat.getMessages(sessionId, {
        limit: params?.limit,
        cursor: params?.cursor,
        page: params?.page,
        offset: params?.offset,
        before: params?.before,
        after: params?.after
      })

      const messagesWithDetails: PrivateChatMessage[] = messages.map((msg: SDKPrivateMessage) => ({
        messageId: msg.message_id,
        sessionId: msg.session_id,
        senderId: msg.sender_id,
        content: msg.content,
        messageType: msg.message_type,
        createdAt: msg.created_at,
        expiresAt: msg.expires_at,
        readBy: msg.read_by,
        duration: msg.duration
      }))

      const cacheData = this.getCache('messages', sessionId) || { sessions: [], messages: new Map(), unreadCount: null }
      cacheData.messages.set(sessionId, messagesWithDetails)
      this.setCache(
        'messages',
        { sessions: cacheData.sessions, messages: cacheData.messages, unreadCount: cacheData.unreadCount },
        sessionId
      )

      return messagesWithDetails
    } catch (error) {
      console.error('[MatrixPrivateChatService] Failed to get messages:', error)
      const cacheData = this.getCache('messages', sessionId)
      if (cacheData) {
        return cacheData.messages.get(sessionId) || []
      }
      throw error
    }
  }

  async markAsRead(sessionId: string): Promise<boolean> {
    const enhancedClient = this.getClient()

    const clientService = MatrixClientService.getInstance()
    const matrixClient = clientService.getClient()
    const userId = matrixClient?.getUserId()

    if (!userId) {
      throw new Error('User not logged in')
    }

    try {
      const result = await enhancedClient.privateChat.markAsRead(sessionId, userId)
      this.clearCache('unreadCount')
      return result
    } catch (error) {
      console.error('[MatrixPrivateChatService] Failed to mark as read:', error)
      throw error
    }
  }

  async getUnreadCount(): Promise<UnreadCount> {
    const enhancedClient = this.getClient()

    const cached = this.getCache('unreadCount')
    if (cached?.unreadCount) {
      return cached.unreadCount
    }

    try {
      const unreadCount = await enhancedClient.privateChat.getUnreadCount()
      const result: UnreadCount = {
        total: unreadCount.total,
        sessions: unreadCount.sessions || []
      }

      const cacheData = this.getCache('unreadCount') || { sessions: [], messages: new Map(), unreadCount: null }
      cacheData.unreadCount = result
      this.setCache('unreadCount', {
        sessions: cacheData.sessions,
        messages: cacheData.messages,
        unreadCount: cacheData.unreadCount
      })

      return result
    } catch (error) {
      console.error('[MatrixPrivateChatService] Failed to get unread count:', error)
      const cacheData = this.getCache('unreadCount')
      if (cacheData?.unreadCount) {
        return cacheData.unreadCount
      }
      throw error
    }
  }

  async searchMessages(params: SearchMessagesParams): Promise<PrivateChatMessage[]> {
    const enhancedClient = this.getClient()

    const clientService = MatrixClientService.getInstance()
    const matrixClient = clientService.getClient()
    const userId = matrixClient?.getUserId()

    if (!userId) {
      throw new Error('User not logged in')
    }

    try {
      const messages = await enhancedClient.privateChat.searchMessages({
        userId: userId,
        query: params.query,
        limit: params.limit
      })

      return messages.map((msg: SDKPrivateMessage) => ({
        messageId: msg.message_id,
        sessionId: msg.session_id,
        senderId: msg.sender_id,
        content: msg.content,
        messageType: msg.message_type,
        createdAt: msg.created_at,
        expiresAt: msg.expires_at,
        readBy: msg.read_by,
        duration: msg.duration
      }))
    } catch (error) {
      console.error('[MatrixPrivateChatService] Failed to search messages:', error)
      return []
    }
  }

  async getSessionStatistics(sessionId: string): Promise<SessionStatistics> {
    const enhancedClient = this.getClient()

    try {
      const stats = await enhancedClient.privateChat.getSessionStatistics(sessionId)
      return {
        messageCount: stats.messageCount,
        participantCount: stats.participantCount,
        lastActivity: stats.lastActivity
      }
    } catch (error) {
      console.error('[MatrixPrivateChatService] Failed to get session statistics:', error)
      throw error
    }
  }
}

export default MatrixPrivateChatService
