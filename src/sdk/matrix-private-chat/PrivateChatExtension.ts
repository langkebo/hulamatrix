/**
 * Matrix PrivateChat API 扩展实现
 * 基于 matrix-js-sdk v39.1.3
 * 后端服务器: https://matrix.cjystx.top:443
 */

import { EventEmitter } from 'node:events'
import type {
  PrivateChatApi,
  PrivateChatSession,
  MatrixClientLike,
  CreateSessionOptions,
  CreateSessionResponse,
  SendMessageOptions,
  SendMessageResponse,
  GetMessagesOptions,
  GetMessagesResponse,
  DeleteSessionOptions,
  ListSessionsOptions,
  ListSessionsResponse,
  GetStatsOptions,
  GetStatsResponse,
  OperationResponse,
  MessageHandler
} from './types.js'
import {
  fetchAndParse,
  buildQueryString,
  checkBaseStatus,
  createDebugLogger,
  validateParticipants,
  isValidSessionId,
  isSessionExpired
} from './utils.js'
import { SendMessageError, DeleteSessionError } from './types.js'

/**
 * PrivateChat 扩展实现
 */
export class PrivateChatExtension extends EventEmitter implements PrivateChatApi {
  private readonly client: MatrixClientLike
  private readonly baseUrl: string
  private readonly logger: ReturnType<typeof createDebugLogger>

  // 缓存相关
  private sessionCache: Map<string, PrivateChatSession> = new Map()
  private cacheExpiry: number = 0
  private readonly CACHE_TTL_MS = 5 * 60 * 1000 // 5分钟

  // 轮询相关
  private readonly POLL_INTERVAL_MS = 3000 // 3秒
  private pollTimers: Map<string, ReturnType<typeof setInterval>> = new Map()
  private messageHandlers: Map<string, Set<MessageHandler>> = new Map()
  private lastMessageIds: Map<string, string> = new Map()

  /**
   * 构造函数
   */
  constructor(client: MatrixClientLike, privateChatApiBaseUrl: string) {
    super()
    this.client = client
    this.baseUrl = privateChatApiBaseUrl.replace(/\/$/, '') // 移除末尾斜杠
    this.logger = createDebugLogger('PrivateChatExtension')
  }

  // ==================== 会话管理 ====================

  /**
   * 获取会话列表
   */
  async listSessions(options?: ListSessionsOptions): Promise<ListSessionsResponse> {
    const now = Date.now()

    // 检查缓存是否有效
    if (this.cacheExpiry > now && this.sessionCache.size > 0) {
      this.logger.debug('Returning cached sessions', {
        count: this.sessionCache.size
      })
      return {
        status: 'ok',
        sessions: Array.from(this.sessionCache.values())
      }
    }

    // 构建查询参数
    const params: Record<string, string> = {}
    if (options?.user_id) {
      params.user_id = options.user_id
    }

    // 从服务器获取
    const url = `${this.baseUrl}/_synapse/client/enhanced/private_chat/v2/sessions${buildQueryString(params)}`
    this.logger.debug('Fetching sessions', { url })

    const response = await fetchAndParse<ListSessionsResponse>(url, {
      headers: this.getAuthHeaders()
    })

    checkBaseStatus(response)

    // 更新缓存
    this.sessionCache.clear()
    if (response.sessions) {
      for (const session of response.sessions) {
        // 过滤掉已过期的会话
        if (!session.expires_at || !isSessionExpired(session.expires_at)) {
          this.sessionCache.set(session.session_id, session)
        }
      }
    }
    this.cacheExpiry = now + this.CACHE_TTL_MS

    this.logger.info('Sessions fetched', {
      count: this.sessionCache.size,
      cached: true
    })

    return {
      status: 'ok',
      sessions: Array.from(this.sessionCache.values())
    }
  }

  /**
   * 创建会话
   */
  async createSession(options: CreateSessionOptions): Promise<CreateSessionResponse> {
    // 验证参与者列表
    const participants = [...(options.participants || [])]
    validateParticipants(participants)

    // 构建请求体
    const body = {
      participants,
      session_name: options.session_name,
      creator_id: options.creator_id || this.getUserId(),
      ttl_seconds: options.ttl_seconds || 0,
      auto_delete: options.auto_delete || false
    }

    this.logger.debug('Creating session', { body })

    const url = `${this.baseUrl}/_synapse/client/enhanced/private_chat/v2/sessions`
    const response = await fetchAndParse<CreateSessionResponse>(url, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(body)
    })

    checkBaseStatus(response)

    if (response.session) {
      // 更新缓存
      this.sessionCache.set(response.session.session_id, response.session)
    }

    // 触发事件
    if (response.session) {
      this.emit('session.created', response.session)
    }

    this.logger.info('Session created', {
      sessionId: response.session_id,
      session: response.session
    })

    return response
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId: string, options?: DeleteSessionOptions): Promise<OperationResponse> {
    if (!isValidSessionId(sessionId)) {
      throw new DeleteSessionError('Invalid session ID format', 400)
    }

    // 构建查询参数
    const params: Record<string, string> = {}
    if (options?.user_id) {
      params.user_id = options.user_id
    }

    const url = `${this.baseUrl}/_synapse/client/enhanced/private_chat/v2/sessions/${sessionId}${buildQueryString(params)}`
    this.logger.debug('Deleting session', { sessionId })

    const response = await fetchAndParse<OperationResponse>(url, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    })

    checkBaseStatus(response)

    // 从缓存中移除
    const cachedSession = this.sessionCache.get(sessionId)
    this.sessionCache.delete(sessionId)

    // 停止轮询
    this.stopPolling(sessionId)

    // 触发事件
    this.emit('session.deleted', {
      sessionId,
      session: cachedSession
    })

    this.logger.info('Session deleted', { sessionId })

    return response
  }

  /**
   * 获取单个会话
   */
  getSession(sessionId: string): PrivateChatSession | null {
    if (!isValidSessionId(sessionId)) {
      return null
    }

    const session = this.sessionCache.get(sessionId)

    // 检查是否过期
    if (session && session.expires_at && isSessionExpired(session.expires_at)) {
      this.sessionCache.delete(sessionId)
      return null
    }

    return session || null
  }

  /**
   * 检查会话是否存在
   */
  hasSession(sessionId: string): boolean {
    const session = this.getSession(sessionId)
    return session !== null
  }

  // ==================== 消息管理 ====================

  /**
   * 发送消息
   */
  async sendMessage(options: SendMessageOptions): Promise<SendMessageResponse> {
    if (!options.session_id || !isValidSessionId(options.session_id)) {
      throw new SendMessageError('Invalid session ID', 400)
    }

    if (!options.content || typeof options.content !== 'string') {
      throw new SendMessageError('Message content is required', 400)
    }

    // 构建请求体
    const body = {
      session_id: options.session_id,
      content: options.content,
      sender_id: options.sender_id || this.getUserId(),
      type: options.type || 'text',
      ttl_seconds: options.ttl_seconds
    }

    this.logger.debug('Sending message', {
      sessionId: options.session_id,
      type: body.type
    })

    const url = `${this.baseUrl}/_synapse/client/enhanced/private_chat/v2/messages`
    const response = await fetchAndParse<SendMessageResponse>(url, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(body)
    })

    checkBaseStatus(response)

    // 触发事件
    this.emit('message.sent', {
      sessionId: options.session_id,
      messageId: response.message_id
    })

    this.logger.info('Message sent', {
      sessionId: options.session_id,
      messageId: response.message_id
    })

    return response
  }

  /**
   * 发送文本消息（便捷方法）
   */
  async sendText(sessionId: string, content: string): Promise<string> {
    const response = await this.sendMessage({
      session_id: sessionId,
      content,
      type: 'text'
    })

    return response.message_id || ''
  }

  /**
   * 获取消息列表
   */
  async getMessages(options: GetMessagesOptions): Promise<GetMessagesResponse> {
    if (!options.session_id || !isValidSessionId(options.session_id)) {
      throw new SendMessageError('Invalid session ID', 400)
    }

    // 构建查询参数
    const params: Record<string, string | number> = {
      session_id: options.session_id,
      limit: options.limit || 50
    }

    if (options.before) {
      params.before = options.before
    }

    if (options.user_id) {
      params.user_id = options.user_id
    }

    const url = `${this.baseUrl}/_synapse/client/enhanced/private_chat/v2/messages${buildQueryString(params)}`
    this.logger.debug('Fetching messages', { sessionId: options.session_id })

    const response = await fetchAndParse<GetMessagesResponse>(url, {
      headers: this.getAuthHeaders()
    })

    checkBaseStatus(response)

    this.logger.debug('Messages fetched', {
      sessionId: options.session_id,
      count: response.messages?.length || 0
    })

    return response
  }

  // ==================== 统计信息 ====================

  /**
   * 获取统计信息
   */
  async getStats(options: GetStatsOptions): Promise<GetStatsResponse> {
    if (!options.session_id || !isValidSessionId(options.session_id)) {
      throw new SendMessageError('Invalid session ID', 400)
    }

    const url = `${this.baseUrl}/_synapse/client/enhanced/private_chat/v2/stats${buildQueryString({ session_id: options.session_id })}`
    this.logger.debug('Fetching stats', { sessionId: options.session_id })

    const response = await fetchAndParse<GetStatsResponse>(url, {
      headers: this.getAuthHeaders()
    })

    checkBaseStatus(response)

    this.logger.debug('Stats fetched', {
      sessionId: options.session_id,
      stats: response.stats
    })

    return response
  }

  // ==================== 订阅和缓存 ====================

  /**
   * 订阅消息（轮询机制）
   */
  subscribeToMessages(sessionId: string, handler: MessageHandler): () => void {
    if (!isValidSessionId(sessionId)) {
      throw new Error('Invalid session ID')
    }

    // 注册处理器
    if (!this.messageHandlers.has(sessionId)) {
      this.messageHandlers.set(sessionId, new Set())
    }
    this.messageHandlers.get(sessionId)!.add(handler)

    this.logger.debug('Message handler registered', {
      sessionId,
      handlerCount: this.messageHandlers.get(sessionId)!.size
    })

    // 启动轮询
    this.startPolling(sessionId)

    // 返回取消订阅函数
    return () => this.unsubscribeFromMessages(sessionId, handler)
  }

  /**
   * 取消订阅消息
   */
  private unsubscribeFromMessages(sessionId: string, handler: MessageHandler): void {
    const handlers = this.messageHandlers.get(sessionId)
    if (handlers) {
      handlers.delete(handler)

      // 如果没有处理器了，停止轮询
      if (handlers.size === 0) {
        this.messageHandlers.delete(sessionId)
        this.stopPolling(sessionId)
      }

      this.logger.debug('Message handler unregistered', {
        sessionId,
        remainingHandlers: handlers.size
      })
    }
  }

  /**
   * 启动轮询
   */
  private startPolling(sessionId: string): void {
    if (this.pollTimers.has(sessionId)) {
      return // 已在轮询
    }

    this.logger.debug('Starting polling', { sessionId })

    const timer = setInterval(async () => {
      await this.pollForNewMessages(sessionId)
    }, this.POLL_INTERVAL_MS)

    this.pollTimers.set(sessionId, timer)
  }

  /**
   * 停止轮询
   */
  private stopPolling(sessionId: string): void {
    const timer = this.pollTimers.get(sessionId)
    if (timer) {
      clearInterval(timer)
      this.pollTimers.delete(sessionId)
      this.lastMessageIds.delete(sessionId)

      this.logger.debug('Polling stopped', { sessionId })
    }
  }

  /**
   * 轮询新消息
   */
  private async pollForNewMessages(sessionId: string): Promise<void> {
    try {
      const lastMessageId = this.lastMessageIds.get(sessionId)
      const options: GetMessagesOptions = {
        session_id: sessionId,
        limit: 10
      }

      // 如果有上次消息ID，获取它之后的消息
      if (lastMessageId) {
        options.before = lastMessageId
      }

      const { messages } = await this.getMessages(options)

      if (!messages || messages.length === 0) {
        return
      }

      // 过滤出新消息（只保留非自己发送的）
      const currentUserId = this.getUserId()
      const newMessages = messages.filter((msg) => msg.sender_id !== currentUserId)

      // 通知处理器
      const handlers = this.messageHandlers.get(sessionId)
      if (handlers && handlers.size > 0) {
        for (const message of newMessages) {
          // 触发 message.received 事件
          this.emit('message.received', message)

          // 调用所有注册的处理器
          for (const handler of handlers) {
            try {
              handler(message)
            } catch (error) {
              this.logger.error('Handler error', { error, sessionId })
            }
          }
        }

        if (newMessages.length > 0) {
          this.logger.debug('New messages delivered', {
            sessionId,
            count: newMessages.length
          })
        }
      }

      // 更新最后消息ID（使用最新的消息ID）
      const latestMessage = messages[messages.length - 1]
      if (latestMessage.message_id) {
        this.lastMessageIds.set(sessionId, latestMessage.message_id)
      }
    } catch (error) {
      // 轮询错误不抛出异常，只记录日志
      this.logger.error('Polling error', { error, sessionId })
    }
  }

  /**
   * 清除缓存
   */
  invalidateCache(): void {
    this.sessionCache.clear()
    this.cacheExpiry = 0
    this.logger.debug('Cache invalidated')
  }

  // ==================== 资源清理 ====================

  /**
   * 清理资源
   */
  dispose(): void {
    this.logger.info('Disposing...')

    // 停止所有轮询
    for (const sessionId of this.pollTimers.keys()) {
      this.stopPolling(sessionId)
    }

    // 清除所有处理器
    this.messageHandlers.clear()

    // 清除缓存
    this.invalidateCache()

    // 移除所有监听器
    this.removeAllListeners()

    this.logger.info('Disposed')
  }

  // ==================== 辅助方法 ====================

  /**
   * 获取认证头
   */
  private getAuthHeaders(): Record<string, string> {
    const token = this.client.getAccessToken?.()
    if (!token) {
      throw new Error('Access token not available')
    }

    return {
      Authorization: `Bearer ${token}`
    }
  }

  /**
   * 获取当前用户ID
   */
  private getUserId(): string {
    const userId = this.client.getUserId?.()
    if (!userId) {
      throw new Error('User ID not available')
    }
    return userId
  }
}
