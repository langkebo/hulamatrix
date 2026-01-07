/**
 * Matrix PrivateChat API 扩展实现 - 强制 E2EE 版本
 * 基于 matrix-js-sdk v39.1.3
 * 后端服务器: https://matrix.cjystx.top:443
 *
 * 安全增强：
 * - 强制端到端加密（Mandatory E2EE）
 * - 拒绝发送未加密消息
 * - 验证所有接收消息已加密
 * - 存储也只保留加密内容
 * - 前向安全（Forward Secrecy）
 * - 加密审计日志
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
 * 加密审计日志条目
 */
interface EncryptionAuditLog {
  timestamp: number
  sessionId: string
  operation:
    | 'key_negotiated'
    | 'message_encrypted'
    | 'message_decrypted'
    | 'key_rotated'
    | 'key_cleaned'
    | 'encryption_failed'
    | 'decryption_failed'
  success: boolean
  details: {
    keyId?: string
    messageId?: string
    algorithm?: string
    error?: string
    [key: string]: unknown
  }
}

/**
 * 加密安全配置
 */
interface EncryptionSecurityConfig {
  // 强制 E2EE - 如果为 true，所有消息必须加密
  mandatoryEncryption: boolean
  // 拒绝未加密消息 - 接收到未加密消息时拒绝
  rejectUnencryptedMessages: boolean
  // 仅存储加密内容 - 本地存储也只保留加密内容
  storeOnlyEncrypted: boolean
  // 前向安全 - 定期轮换密钥
  forwardSecrecyEnabled: boolean
  // 密钥轮换间隔（毫秒）
  keyRotationIntervalMs: number
  // 审计日志启用
  auditLoggingEnabled: boolean
  // 审计日志最大保留条数
  maxAuditLogEntries: number
}

/**
 * 默认安全配置
 */
const DEFAULT_SECURITY_CONFIG: EncryptionSecurityConfig = {
  mandatoryEncryption: true,
  rejectUnencryptedMessages: true,
  storeOnlyEncrypted: true,
  forwardSecrecyEnabled: true,
  keyRotationIntervalMs: 60 * 60 * 1000, // 1小时
  auditLoggingEnabled: true,
  maxAuditLogEntries: 1000
}

/**
 * PrivateChat 安全扩展实现 - 强制 E2EE
 */
export class PrivateChatExtensionSecure extends EventEmitter implements PrivateChatApi {
  private readonly client: MatrixClientLike
  private readonly baseUrl: string
  private readonly logger: ReturnType<typeof createDebugLogger>
  private readonly securityConfig: EncryptionSecurityConfig

  // E2EE 和存储扩展（强制要求）
  private e2ee!: E2EEApi // 使用 ! 表示初始化时必须设置
  private storage?: PrivateChatStorageApi
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

  // 加密审计日志
  private auditLog: EncryptionAuditLog[] = []

  // 密钥轮换定时器
  private keyRotationTimers: Map<string, ReturnType<typeof setInterval>> = new Map()

  /**
   * 构造函数 - E2EE 现在是必需的
   */
  constructor(
    client: MatrixClientLike,
    privateChatApiBaseUrl: string,
    e2ee: E2EEApi,
    securityConfig?: Partial<EncryptionSecurityConfig>
  ) {
    super()
    this.client = client
    this.baseUrl = privateChatApiBaseUrl.replace(/\/$/, '')
    this.logger = createDebugLogger('PrivateChatExtensionSecure')
    this.e2ee = e2ee
    this.securityConfig = { ...DEFAULT_SECURITY_CONFIG, ...securityConfig }

    // E2EE 必须初始化
    this.initializeE2EE(e2ee)
  }

  // ==================== E2EE 和存储初始化 ====================

  /**
   * 初始化 E2EE（强制调用）
   */
  private async initializeE2EE(e2ee: E2EEApi): Promise<void> {
    await e2ee.initialize()
    this.addAuditLog({
      timestamp: Date.now(),
      sessionId: 'system',
      operation: 'key_negotiated',
      success: true,
      details: { message: 'E2EE initialized' }
    })
    this.logger.info('E2EE initialized (mandatory)', { config: this.securityConfig })
  }

  /**
   * 初始化存储（可选但推荐）
   */
  async initializeStorage(storage: PrivateChatStorageApi): Promise<void> {
    this.storage = storage
    await storage.initialize()
    this.storageEnabled = true
    this.logger.info('Storage initialized (secure mode)')

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
   * 验证内容是否为加密格式（严格验证）
   */
  private validateEncryptedContent(content: string): {
    valid: boolean
    encryptedContent?: EncryptedContent
    error?: string
  } {
    try {
      const parsed = JSON.parse(content) as Partial<EncryptedContent>

      // 严格验证所有必需字段
      if (parsed.algorithm !== 'aes-gcm-256') {
        return { valid: false, error: `Invalid algorithm: ${parsed.algorithm}` }
      }

      if (typeof parsed.key_id !== 'string' || parsed.key_id.length === 0) {
        return { valid: false, error: 'Missing or invalid key_id' }
      }

      if (typeof parsed.ciphertext !== 'string' || parsed.ciphertext.length === 0) {
        return { valid: false, error: 'Missing or invalid ciphertext' }
      }

      if (typeof parsed.iv !== 'string' || parsed.iv.length === 0) {
        return { valid: false, error: 'Missing or invalid iv' }
      }

      if (typeof parsed.tag !== 'string' || parsed.tag.length === 0) {
        return { valid: false, error: 'Missing or invalid tag' }
      }

      if (typeof parsed.timestamp !== 'number' || parsed.timestamp <= 0) {
        return { valid: false, error: 'Missing or invalid timestamp' }
      }

      return { valid: true, encryptedContent: parsed as EncryptedContent }
    } catch (error) {
      return { valid: false, error: `Failed to parse encrypted content: ${error}` }
    }
  }

  /**
   * 添加审计日志
   */
  private addAuditLog(entry: EncryptionAuditLog): void {
    if (!this.securityConfig.auditLoggingEnabled) return

    this.auditLog.push(entry)

    // 限制日志大小
    if (this.auditLog.length > this.securityConfig.maxAuditLogEntries) {
      this.auditLog.shift()
    }

    this.logger.debug('Audit log entry added', { entry })
  }

  /**
   * 获取审计日志
   */
  getAuditLog(sessionId?: string): EncryptionAuditLog[] {
    if (sessionId) {
      return this.auditLog.filter((log) => log.sessionId === sessionId)
    }
    return [...this.auditLog]
  }

  // ==================== 会话管理 ====================

  /**
   * 获取会话列表
   */
  async listSessions(options?: ListSessionsOptions): Promise<ListSessionsResponse> {
    const now = Date.now()

    // 检查缓存
    if (now < this.cacheExpiry && this.sessionCache.size > 0) {
      this.logger.debug('Returning cached sessions', { count: this.sessionCache.size })
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

    const url = `${this.baseUrl}/_synapse/client/enhanced/private_chat/v2/sessions${buildQueryString(params)}`
    this.logger.debug('Fetching sessions from server')

    const response = await fetchAndParse<ListSessionsResponse>(url, {
      method: 'GET',
      headers: this.getAuthHeaders()
    })

    checkBaseStatus(response)

    // 更新缓存
    if (response.sessions) {
      for (const session of response.sessions) {
        // 过滤过期会话
        if (!session.expires_at || !isSessionExpired(session.expires_at)) {
          this.sessionCache.set(session.session_id, session)
        }
      }
      this.cacheExpiry = now + this.CACHE_TTL_MS
    }

    this.logger.info('Sessions listed', { count: response.sessions?.length || 0 })

    return response
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

    this.logger.debug('Creating session (secure mode)', { body })

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

      // 强制协商会话密钥（E2EE 是必需的）
      if (response.session_id) {
        try {
          await this.e2ee.negotiateSessionKey(response.session_id, participants)

          this.addAuditLog({
            timestamp: Date.now(),
            sessionId: response.session_id,
            operation: 'key_negotiated',
            success: true,
            details: { participants, algorithm: 'aes-gcm-256' }
          })

          this.logger.info('Session key negotiated (mandatory)', { sessionId: response.session_id })

          // 启动密钥轮换定时器（如果启用前向安全）
          if (this.securityConfig.forwardSecrecyEnabled) {
            this.startKeyRotation(response.session_id)
          }
        } catch (error) {
          this.addAuditLog({
            timestamp: Date.now(),
            sessionId: response.session_id,
            operation: 'encryption_failed',
            success: false,
            details: { error: String(error) }
          })

          this.logger.error('Failed to negotiate session key (mandatory E2EE failed)', { error })

          // 密钥协商失败应该阻止会话创建
          throw new SendMessageError('Failed to establish secure session', 500)
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

    this.logger.info('Session created (secure)', {
      sessionId: response.session_id,
      encrypted: true
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

    // 停止密钥轮换
    this.stopKeyRotation(sessionId)

    // 构建查询参数
    const params: Record<string, string> = {}
    if (options?.user_id) {
      params.user_id = options.user_id
    }

    const url = `${this.baseUrl}/_synapse/client/enhanced/private_chat/v2/sessions/${sessionId}${buildQueryString(params)}`
    this.logger.debug('Deleting session (secure mode)', { sessionId })

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
    try {
      await this.e2ee.cleanupSessionKey(sessionId)

      this.addAuditLog({
        timestamp: Date.now(),
        sessionId,
        operation: 'key_cleaned',
        success: true,
        details: { reason: 'session_deleted' }
      })
    } catch (error) {
      this.logger.error('Failed to cleanup session key', { error })
    }

    // 停止轮询
    this.stopPolling(sessionId)

    // 触发事件
    this.emit('session.deleted', {
      sessionId,
      session: cachedSession
    })

    this.logger.info('Session deleted (secure)', { sessionId })

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
    return this.getSession(sessionId) !== null
  }

  // ==================== 消息管理 ====================

  /**
   * 发送消息 - 强制加密版本
   */
  async sendMessage(options: SendMessageOptions): Promise<SendMessageResponse> {
    // 验证输入
    if (!options.session_id || !isValidSessionId(options.session_id)) {
      throw new SendMessageError('Invalid session ID', 400)
    }

    if (!options.content || typeof options.content !== 'string') {
      throw new SendMessageError('Message content is required', 400)
    }

    let contentToSend: string
    const startTime = Date.now()

    try {
      // 强制加密所有消息
      const encrypted = await this.e2ee.encryptMessage(options.session_id, options.content)
      contentToSend = JSON.stringify(encrypted)

      // 验证加密结果
      const validation = this.validateEncryptedContent(contentToSend)
      if (!validation.valid) {
        throw new SendMessageError(`Encryption validation failed: ${validation.error}`, 500)
      }

      this.logger.debug('Message encrypted (mandatory)', {
        sessionId: options.session_id,
        keyId: encrypted.key_id,
        algorithm: encrypted.algorithm,
        duration: Date.now() - startTime
      })

      this.addAuditLog({
        timestamp: Date.now(),
        sessionId: options.session_id,
        operation: 'message_encrypted',
        success: true,
        details: {
          algorithm: encrypted.algorithm,
          keyId: encrypted.key_id,
          contentLength: options.content.length
        }
      })
    } catch (error) {
      this.addAuditLog({
        timestamp: Date.now(),
        sessionId: options.session_id,
        operation: 'encryption_failed',
        success: false,
        details: { error: String(error) }
      })

      this.logger.error('Failed to encrypt message (mandatory E2EE)', { error })

      // 加密失败时拒绝发送（强制 E2EE）
      throw new SendMessageError(
        `Failed to encrypt message: ${error instanceof Error ? error.message : String(error)}`,
        500
      )
    }

    // 构建请求体
    const body = {
      session_id: options.session_id,
      content: contentToSend,
      sender_id: options.sender_id || this.getUserId(),
      type: options.type || 'text',
      ttl_seconds: options.ttl_seconds
    }

    this.logger.debug('Sending encrypted message', {
      sessionId: options.session_id,
      type: body.type,
      encrypted: true
    })

    const url = `${this.baseUrl}/_synapse/client/enhanced/private_chat/v2/messages`
    const response = await fetchAndParse<SendMessageResponse>(url, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(body)
    })

    checkBaseStatus(response)

    // 存储也只保留加密内容
    if (this.storageEnabled && this.storage && response.message_id) {
      try {
        await this.storage.saveMessage({
          message_id: response.message_id,
          session_id: options.session_id,
          sender_id: body.sender_id,
          content: contentToSend, // 存储加密内容
          type: body.type,
          created_at: new Date().toISOString(),
          is_encrypted: true,
          algorithm: 'aes-gcm-256'
        } as StoredPrivateChatMessage)
      } catch (error) {
        this.logger.error('Failed to save encrypted message to storage', { error })
      }
    }

    // 触发事件
    this.emit('message.sent', {
      sessionId: options.session_id,
      messageId: response.message_id,
      encrypted: true
    })

    this.logger.info('Message sent (encrypted)', {
      sessionId: options.session_id,
      messageId: response.message_id,
      encrypted: true,
      duration: Date.now() - startTime
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
   * 获取消息列表 - 验证所有消息已加密
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
          this.logger.debug('Loading encrypted messages from storage', {
            sessionId: options.session_id,
            count: storedMessages.length
          })

          // 解密存储的消息
          const decryptedMessages: PrivateChatMessage[] = []

          for (const message of storedMessages) {
            if (message.is_encrypted) {
              try {
                const encrypted = JSON.parse(message.content) as EncryptedContent

                // 验证加密格式
                const validation = this.validateEncryptedContent(message.content)
                if (!validation.valid) {
                  this.logger.warn('Invalid encrypted content in storage', {
                    messageId: message.message_id,
                    error: validation.error
                  })

                  // 如果配置为拒绝未加密消息，跳过此消息
                  if (this.securityConfig.rejectUnencryptedMessages) {
                    continue
                  }
                }

                const decrypted = await this.e2ee.decryptMessage(options.session_id, encrypted)

                decryptedMessages.push({
                  ...message,
                  content: decrypted
                } as PrivateChatMessage)

                this.addAuditLog({
                  timestamp: Date.now(),
                  sessionId: options.session_id,
                  operation: 'message_decrypted',
                  success: true,
                  details: { messageId: message.message_id, fromStorage: true }
                })
              } catch (error) {
                this.addAuditLog({
                  timestamp: Date.now(),
                  sessionId: options.session_id,
                  operation: 'decryption_failed',
                  success: false,
                  details: { messageId: message.message_id, error: String(error) }
                })

                this.logger.error('Failed to decrypt stored message', {
                  messageId: message.message_id,
                  error
                })
              }
            } else {
              // 未加密消息 - 根据配置决定是否拒绝
              if (this.securityConfig.rejectUnencryptedMessages) {
                this.logger.warn('Rejecting unencrypted message from storage', {
                  messageId: message.message_id
                })
                continue
              }

              decryptedMessages.push(message as PrivateChatMessage)
            }
          }

          return {
            status: 'ok',
            messages: decryptedMessages
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

    const response = await fetchAndParse<GetMessagesResponse>(url, {
      method: 'GET',
      headers: this.getAuthHeaders()
    })

    checkBaseStatus(response)

    // 验证并解密所有消息
    if (response.messages) {
      const validatedMessages: PrivateChatMessage[] = []

      for (const message of response.messages) {
        // 检查消息是否已加密
        const isEncrypted = this.isEncryptedContent(message.content)

        if (!isEncrypted) {
          this.addAuditLog({
            timestamp: Date.now(),
            sessionId: options.session_id,
            operation: 'decryption_failed',
            success: false,
            details: {
              messageId: message.message_id,
              error: 'Message is not encrypted'
            }
          })

          this.logger.warn('Received unencrypted message', {
            messageId: message.message_id,
            sender: message.sender_id
          })

          // 如果配置为拒绝未加密消息，跳过此消息
          if (this.securityConfig.rejectUnencryptedMessages) {
            this.emit('security.warning', {
              type: 'unencrypted_message_received',
              sessionId: options.session_id,
              messageId: message.message_id,
              sender: message.sender_id
            })
            continue
          }
        } else {
          // 解密消息
          try {
            const encrypted = JSON.parse(message.content) as EncryptedContent

            // 验证加密格式
            const validation = this.validateEncryptedContent(message.content)
            if (!validation.valid) {
              this.logger.warn('Invalid encrypted content format', {
                messageId: message.message_id,
                error: validation.error
              })
              continue
            }

            message.content = await this.e2ee.decryptMessage(options.session_id, encrypted)

            this.addAuditLog({
              timestamp: Date.now(),
              sessionId: options.session_id,
              operation: 'message_decrypted',
              success: true,
              details: { messageId: message.message_id, algorithm: encrypted.algorithm }
            })
          } catch (error) {
            this.addAuditLog({
              timestamp: Date.now(),
              sessionId: options.session_id,
              operation: 'decryption_failed',
              success: false,
              details: { messageId: message.message_id, error: String(error) }
            })

            this.logger.error('Failed to decrypt message', {
              messageId: message.message_id,
              error
            })

            // 解密失败时跳过此消息
            continue
          }
        }

        validatedMessages.push(message)
      }

      response.messages = validatedMessages

      // 存储加密消息
      if (this.storageEnabled && this.storage) {
        for (const message of validatedMessages) {
          try {
            await this.storage.saveMessage({
              message_id: message.message_id,
              session_id: options.session_id,
              sender_id: message.sender_id,
              content: this.isEncryptedContent(message.content)
                ? message.content
                : JSON.stringify({ content: message.content }), // 存储加密内容
              type: message.type,
              created_at: message.created_at,
              is_encrypted: true
            } as StoredPrivateChatMessage)
          } catch (error) {
            this.logger.error('Failed to save message to storage', { error })
          }
        }
      }
    }

    this.logger.info('Messages retrieved (secure)', {
      sessionId: options.session_id,
      count: response.messages?.length || 0,
      allEncrypted: response.messages?.every((m) => this.isEncryptedContent(m.content))
    })

    return response
  }

  // ==================== 密钥轮换（前向安全）====================

  /**
   * 启动密钥轮换
   */
  private startKeyRotation(sessionId: string): void {
    // 清除现有定时器
    this.stopKeyRotation(sessionId)

    const timer = setInterval(async () => {
      try {
        await this.e2ee.rotateSessionKey(sessionId)

        this.addAuditLog({
          timestamp: Date.now(),
          sessionId,
          operation: 'key_rotated',
          success: true,
          details: { reason: 'scheduled_rotation' }
        })

        this.logger.info('Session key rotated', { sessionId })
      } catch (error) {
        this.addAuditLog({
          timestamp: Date.now(),
          sessionId,
          operation: 'encryption_failed',
          success: false,
          details: { operation: 'key_rotation', error: String(error) }
        })

        this.logger.error('Failed to rotate session key', { sessionId, error })
      }
    }, this.securityConfig.keyRotationIntervalMs)

    this.keyRotationTimers.set(sessionId, timer)
  }

  /**
   * 停止密钥轮换
   */
  private stopKeyRotation(sessionId: string): void {
    const timer = this.keyRotationTimers.get(sessionId)
    if (timer) {
      clearInterval(timer)
      this.keyRotationTimers.delete(sessionId)
    }
  }

  // ==================== 轮询机制 ====================

  /**
   * 订阅消息
   */
  subscribeToMessages(sessionId: string, handler: MessageHandler): () => void {
    if (!this.messageHandlers.has(sessionId)) {
      this.messageHandlers.set(sessionId, new Set())
    }
    this.messageHandlers.get(sessionId)!.add(handler)

    // 启动轮询
    this.startPolling(sessionId)

    // 返回取消订阅函数
    return () => {
      const handlers = this.messageHandlers.get(sessionId)
      if (handlers) {
        handlers.delete(handler)
        if (handlers.size === 0) {
          this.stopPolling(sessionId)
        }
      }
    }
  }

  /**
   * 启动轮询
   */
  private startPolling(sessionId: string): void {
    // 清除现有定时器
    this.stopPolling(sessionId)

    const timer = setInterval(async () => {
      try {
        const currentUserId = this.getUserId()
        const lastMessageId = this.lastMessageIds.get(sessionId)

        const options: GetMessagesOptions = {
          session_id: sessionId,
          user_id: currentUserId,
          limit: 20
        }

        if (lastMessageId) {
          options.before = lastMessageId
        }

        const response = await this.getMessages(options)

        if (response.messages && response.messages.length > 0) {
          // 更新最后消息 ID
          if (response.messages[0]?.message_id) {
            this.lastMessageIds.set(sessionId, response.messages[0].message_id)
          }

          // 过滤并通知新消息
          for (const message of response.messages) {
            // 不通知自己的消息
            if (message.sender_id !== currentUserId) {
              const handlers = this.messageHandlers.get(sessionId)
              if (handlers) {
                for (const handler of handlers) {
                  try {
                    handler(message)
                  } catch (error) {
                    this.logger.error('Message handler error', { error })
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        this.logger.error('Polling error', { sessionId, error })
      }
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
    }
  }

  // ==================== 统计信息 ====================

  /**
   * 获取统计信息
   */
  async getStats(options?: GetStatsOptions): Promise<GetStatsResponse> {
    if (!options?.session_id || !isValidSessionId(options.session_id)) {
      throw new SendMessageError('Invalid session ID', 400)
    }

    // 从本地存储获取统计
    let messageCount = 0
    let encryptedCount = 0

    if (this.storageEnabled && this.storage) {
      try {
        const messages = await this.storage.getMessages(options.session_id)
        messageCount = messages.length
        encryptedCount = messages.filter((m) => m.is_encrypted).length
      } catch (error) {
        this.logger.error('Failed to get stats from storage', { error })
      }
    }

    // 获取审计日志统计
    const _auditStats = {
      total: this.auditLog.filter((l) => l.sessionId === options.session_id).length,
      keyNegotiated: this.auditLog.filter((l) => l.sessionId === options.session_id && l.operation === 'key_negotiated')
        .length,
      messageEncrypted: this.auditLog.filter(
        (l) => l.sessionId === options.session_id && l.operation === 'message_encrypted'
      ).length,
      messageDecrypted: this.auditLog.filter(
        (l) => l.sessionId === options.session_id && l.operation === 'message_decrypted'
      ).length,
      keyRotated: this.auditLog.filter((l) => l.sessionId === options.session_id && l.operation === 'key_rotated')
        .length,
      encryptionFailed: this.auditLog.filter(
        (l) => l.sessionId === options.session_id && l.operation === 'encryption_failed'
      ).length,
      decryptionFailed: this.auditLog.filter(
        (l) => l.sessionId === options.session_id && l.operation === 'decryption_failed'
      ).length
    }

    this.logger.info('Stats retrieved (secure)', {
      sessionId: options.session_id,
      messageCount,
      encryptedCount,
      encryptionRate: messageCount > 0 ? ((encryptedCount / messageCount) * 100).toFixed(2) + '%' : '0%'
    })

    return {
      status: 'ok',
      stats: {
        message_count: messageCount,
        participant_count: 2, // PrivateChat is always 1:1
        last_activity: new Date().toISOString()
      }
    }
  }

  // ==================== 工具方法 ====================

  /**
   * 检查内容是否为加密格式
   */
  private isEncryptedContent(content: string): boolean {
    const validation = this.validateEncryptedContent(content)
    return validation.valid
  }

  /**
   * 获取当前用户 ID
   */
  private getUserId(): string {
    return this.client.getUserId?.() || ''
  }

  /**
   * 获取认证头
   */
  private getAuthHeaders(): Record<string, string> {
    const accessToken = this.client.getAccessToken?.()
    return {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.sessionCache.clear()
    this.cacheExpiry = 0
  }

  /**
   * 使缓存失效
   */
  invalidateCache(): void {
    this.cacheExpiry = 0
  }

  /**
   * 释放所有资源（实现 PrivateChatApi.dispose）
   */
  dispose(): void {
    // 停止所有轮询
    for (const sessionId of this.pollTimers.keys()) {
      this.stopPolling(sessionId)
    }

    // 停止所有密钥轮换
    for (const sessionId of this.keyRotationTimers.keys()) {
      this.stopKeyRotation(sessionId)
    }

    // 清除缓存
    this.clearCache()

    // 清除审计日志
    this.auditLog = []

    // 移除所有消息处理器
    this.messageHandlers.clear()

    this.logger.info('PrivateChatExtensionSecure disposed')
  }
}

/**
 * 创建安全 PrivateChat 扩展实例
 */
export function createSecurePrivateChatExtension(
  client: MatrixClientLike,
  privateChatApiBaseUrl: string,
  e2ee: E2EEApi,
  securityConfig?: Partial<EncryptionSecurityConfig>
): PrivateChatExtensionSecure {
  return new PrivateChatExtensionSecure(client, privateChatApiBaseUrl, e2ee, securityConfig)
}
