/**
 * Matrix PrivateChat API 扩展实现
 * 基于 matrix-js-sdk v39.1.3
 * 后端服务器: https://matrix.cjystx.top:443
 */

import { EventEmitter } from 'node:events'
import type {
  PrivateChatApi,
  PrivateChatSession,
  PrivateChatMessage,
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
  MessageHandler,
  EncryptedContent,
  E2EEApi,
  PrivateChatStorageApi,
  StoredPrivateChatSession,
  StoredPrivateChatMessage
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

  // E2EE 和存储扩展（可选）
  private e2ee?: E2EEApi
  private storage?: PrivateChatStorageApi
  private e2eeEnabled = false
  private storageEnabled = false

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

  // ==================== E2EE 和存储初始化 ====================

  /**
   * 初始化 E2EE（按需调用）
   */
  async initializeE2EE(e2ee: E2EEApi): Promise<void> {
    this.e2ee = e2ee
    await this.e2ee.initialize()
    this.e2eeEnabled = true
    this.logger.info('E2EE initialized')
  }

  /**
   * 初始化存储（按需调用）
   */
  async initializeStorage(storage: PrivateChatStorageApi): Promise<void> {
    this.storage = storage
    await this.storage.initialize()
    this.storageEnabled = true
    this.logger.info('Storage initialized')

    // 从存储加载会话
    await this.loadFromStorage()
  }

  /**
   * 从存储加载数据
   */
  private async loadFromStorage(): Promise<void> {
    if (!this.storage) return

    try {
      const storedSessions = await this.storage.getSessions()
      if (storedSessions.length > 0) {
        // 更新缓存
        for (const session of storedSessions) {
          if (!session.expires_at || !isSessionExpired(session.expires_at)) {
            this.sessionCache.set(session.session_id, session as PrivateChatSession)
          }
        }
        this.cacheExpiry = Date.now() + this.CACHE_TTL_MS
        this.logger.info('Loaded sessions from storage', { count: storedSessions.length })
      }
    } catch (error) {
      this.logger.error('Failed to load from storage', { error })
    }
  }

  /**
   * 检查内容是否为加密格式
   */
  private isEncryptedContent(content: string): boolean {
    try {
      const parsed = JSON.parse(content) as Partial<EncryptedContent>
      return (
        parsed.algorithm === 'aes-gcm-256' &&
        typeof parsed.key_id === 'string' &&
        typeof parsed.ciphertext === 'string' &&
        typeof parsed.iv === 'string'
      )
    } catch {
      return false
    }
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

      // 如果启用 E2EE，协商会话密钥
      if (this.e2eeEnabled && this.e2ee && response.session_id) {
        try {
          await this.e2ee.negotiateSessionKey(response.session_id, participants)
          this.logger.info('Session key negotiated', { sessionId: response.session_id })
        } catch (error) {
          this.logger.error('Failed to negotiate session key', { error })
        }
      }

      // 保存到存储
      if (this.storageEnabled && this.storage && response.session) {
        try {
          await this.storage.saveSession(response.session as unknown as StoredPrivateChatSession)
        } catch (error) {
          this.logger.error('Failed to save session to storage', { error })
        }
      }
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

    // 从存储中删除
    if (this.storageEnabled && this.storage) {
      try {
        await this.storage.deleteSession(sessionId)
        await this.storage.deleteMessages(sessionId)
      } catch (error) {
        this.logger.error('Failed to delete session from storage', { error })
      }
    }

    // 清理 E2EE 密钥
    if (this.e2eeEnabled && this.e2ee) {
      try {
        await this.e2ee.cleanupSessionKey(sessionId)
      } catch (error) {
        this.logger.error('Failed to cleanup session key', { error })
      }
    }

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

    let contentToSend = options.content
    let isEncrypted = false

    // 如果启用 E2EE，加密内容
    if (this.e2eeEnabled && this.e2ee) {
      try {
        const encrypted = await this.e2ee.encryptMessage(options.session_id, options.content)
        contentToSend = JSON.stringify(encrypted)
        isEncrypted = true
        this.logger.debug('Message encrypted', { sessionId: options.session_id })
      } catch (error) {
        this.logger.error('Failed to encrypt message', { error })
        throw new SendMessageError('Failed to encrypt message', 500)
      }
    }

    // 构建请求体
    const body = {
      session_id: options.session_id,
      content: contentToSend,
      sender_id: options.sender_id || this.getUserId(),
      type: options.type || 'text',
      ttl_seconds: options.ttl_seconds
    }

    this.logger.debug('Sending message', {
      sessionId: options.session_id,
      type: body.type,
      encrypted: isEncrypted
    })

    const url = `${this.baseUrl}/_synapse/client/enhanced/private_chat/v2/messages`
    const response = await fetchAndParse<SendMessageResponse>(url, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(body)
    })

    checkBaseStatus(response)

    // 保存到存储
    if (this.storageEnabled && this.storage && response.message_id) {
      try {
        await this.storage.saveMessage({
          message_id: response.message_id,
          session_id: options.session_id,
          sender_id: body.sender_id,
          content: options.content, // 存储明文（或根据需求存储加密内容）
          type: body.type,
          created_at: new Date().toISOString(),
          is_encrypted: isEncrypted
        } as StoredPrivateChatMessage)
      } catch (error) {
        this.logger.error('Failed to save message to storage', { error })
      }
    }

    // 触发事件
    this.emit('message.sent', {
      sessionId: options.session_id,
      messageId: response.message_id
    })

    this.logger.info('Message sent', {
      sessionId: options.session_id,
      messageId: response.message_id,
      encrypted: isEncrypted
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

    // 先尝试从本地存储加载
    if (this.storageEnabled && this.storage) {
      try {
        const storedMessages = await this.storage.getMessages(options.session_id)
        if (storedMessages.length > 0) {
          this.logger.debug('Loaded messages from storage', {
            sessionId: options.session_id,
            count: storedMessages.length
          })

          // 解密存储的消息（如果启用 E2EE）
          if (this.e2eeEnabled && this.e2ee) {
            for (const message of storedMessages) {
              if (message.is_encrypted) {
                try {
                  const encrypted = JSON.parse(message.content) as EncryptedContent
                  message.content = await this.e2ee.decryptMessage(options.session_id, encrypted)
                } catch (error) {
                  this.logger.error('Failed to decrypt stored message', { error })
                }
              }
            }
          }

          return {
            status: 'ok',
            messages: storedMessages as PrivateChatMessage[]
          }
        }
      } catch (error) {
        this.logger.error('Failed to load messages from storage', { error })
      }
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

    // 如果启用 E2EE，解密消息
    if (this.e2eeEnabled && this.e2ee && response.messages) {
      for (const message of response.messages) {
        // 检查内容是否为加密格式
        if (this.isEncryptedContent(message.content)) {
          try {
            const encrypted = JSON.parse(message.content) as EncryptedContent
            message.content = await this.e2ee.decryptMessage(options.session_id, encrypted)
            message.is_encrypted = true
          } catch (error) {
            this.logger.error('Failed to decrypt message', { error, messageId: message.message_id })
          }
        }
      }
    }

    // 保存到存储
    if (this.storageEnabled && this.storage && response.messages) {
      try {
        for (const message of response.messages) {
          await this.storage.saveMessage(message as unknown as StoredPrivateChatMessage)
        }
      } catch (error) {
        this.logger.error('Failed to save messages to storage', { error })
      }
    }

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
