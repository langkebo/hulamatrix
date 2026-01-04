/**
 * 私聊服务 v2.0
 * 基于 SDK v2.0.0 API (client.privateChatV2)
 *
 * 统一 PC 端和移动端实现
 */

import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'
import type {
  IPrivateChatServiceV2,
  PrivateChatSessionItem,
  PrivateChatMessageItem,
  CreateSessionParams,
  SendMessageParams,
  GetMessagesParams,
  MessageHandler,
  PrivateChatSession,
  PrivateChatMessage,
  MatrixClientWithV2API
} from '@/types/matrix-sdk-v2'

/**
 * 事件处理器类型
 */
type EventHandler = (data: unknown) => void

/**
 * 私聊服务类 v2.0
 * 直接使用 SDK v2.0.0 API，利用其内置缓存、轮询和事件系统
 */
class PrivateChatServiceV2 implements IPrivateChatServiceV2 {
  private initialized = false
  private messageUnsubscribes = new Map<string, () => void>()
  private eventListeners = new Map<string, Set<EventHandler>>()

  /**
   * 获取 PrivateChatClient 实例
   */
  private get privateChatV2() {
    const client = matrixClientService.getClient() as unknown as MatrixClientWithV2API | null
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    const privateChatV2 = client.privateChatV2
    if (!privateChatV2) {
      throw new Error('PrivateChat v2 API not available. Please update matrix-js-sdk to 39.1.3+')
    }

    return privateChatV2
  }

  /**
   * 初始化服务
   * 设置事件监听器
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.debug('[PrivateChatServiceV2] Already initialized')
      return
    }

    try {
      // 设置事件监听
      this.setupEventListeners()

      this.initialized = true
      logger.info('[PrivateChatServiceV2] Initialized successfully')
    } catch (error) {
      logger.error('[PrivateChatServiceV2] Initialization failed', { error })
      throw error
    }
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 监听会话创建事件
    this.privateChatV2.on('session.created', (...args: unknown[]) => {
      const session = args[0] as PrivateChatSession
      const sessionId = session.session_id || session.id
      logger.info('[PrivateChatServiceV2] Session created:', sessionId)
      this.emit('session.created', this.mapToSessionItem(session))
    })

    // 监听会话删除事件
    this.privateChatV2.on('session.deleted', (...args: unknown[]) => {
      const data = args[0] as { sessionId: string; session?: PrivateChatSession }
      logger.info('[PrivateChatServiceV2] Session deleted:', data.sessionId)
      this.emit('session.deleted', { sessionId: data.sessionId })
    })

    // 监听消息接收事件
    this.privateChatV2.on('message.received', (...args: unknown[]) => {
      const message = args[0] as PrivateChatMessage
      logger.info('[PrivateChatServiceV2] Message received:', message.message_id)
      this.emit('message.received', this.mapToMessageItem(message))
    })

    // 监听消息发送事件
    this.privateChatV2.on('message.sent', (...args: unknown[]) => {
      const data = args[0] as { sessionId: string; messageId: string }
      logger.info('[PrivateChatServiceV2] Message sent:', data.messageId)
      this.emit('message.sent', data)
    })

    logger.debug('[PrivateChatServiceV2] Event listeners set up')
  }

  /**
   * 获取会话列表（使用 SDK 缓存）
   * @param useCache 是否使用缓存，默认 true
   * @returns 会话列表
   */
  async listSessions(useCache = true): Promise<PrivateChatSessionItem[]> {
    try {
      const sessions = await this.privateChatV2.listSessions(useCache)
      if (!sessions) return []
      return sessions.map(this.mapToSessionItem)
    } catch (error) {
      logger.error('[PrivateChatServiceV2] Failed to list sessions', { error })
      throw new Error(`Failed to list sessions: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 创建新会话
   * @param options 创建选项
   * @returns 创建的会话
   */
  async createSession(options: CreateSessionParams): Promise<PrivateChatSessionItem> {
    try {
      const session = await this.privateChatV2.createSession(options)
      const sessionItem = this.mapToSessionItem(session)
      logger.info('[PrivateChatServiceV2] Session created', { sessionId: session.session_id })
      return sessionItem
    } catch (error) {
      logger.error('[PrivateChatServiceV2] Failed to create session', { error })
      throw new Error(`Failed to create session: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 发送消息
   * @param options 发送选项
   * @returns 消息 ID
   */
  async sendMessage(options: SendMessageParams): Promise<string> {
    try {
      const messageId = await this.privateChatV2.sendMessage({
        session_id: options.session_id,
        content: options.content,
        type: options.type || 'text'
      })
      logger.info('[PrivateChatServiceV2] Message sent', { messageId })
      return messageId
    } catch (error) {
      logger.error('[PrivateChatServiceV2] Failed to send message', { error })
      throw new Error(`Failed to send message: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 发送文本消息（便捷方法）
   * @param sessionId 会话 ID
   * @param content 文本内容
   * @returns 消息 ID
   */
  async sendText(sessionId: string, content: string): Promise<string> {
    try {
      const messageId = await this.privateChatV2.sendText(sessionId, content)
      logger.info('[PrivateChatServiceV2] Text message sent', { messageId })
      return messageId
    } catch (error) {
      logger.error('[PrivateChatServiceV2] Failed to send text', { error })
      throw new Error(`Failed to send text: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 获取会话消息
   * @param options 获取选项
   * @returns 消息列表
   */
  async getMessages(options: GetMessagesParams): Promise<PrivateChatMessageItem[]> {
    try {
      const messages = await this.privateChatV2.getMessages({
        session_id: options.session_id,
        limit: options.limit || 50,
        before: options.before
      })
      return messages.map(this.mapToMessageItem)
    } catch (error) {
      logger.error('[PrivateChatServiceV2] Failed to get messages', { error })
      throw new Error(`Failed to get messages: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 删除会话
   * @param sessionId 会话 ID
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      // 取消该会话的消息订阅
      const unsubscribe = this.messageUnsubscribes.get(sessionId)
      if (unsubscribe) {
        unsubscribe()
        this.messageUnsubscribes.delete(sessionId)
      }

      await this.privateChatV2.deleteSession(sessionId)
      logger.info('[PrivateChatServiceV2] Session deleted', { sessionId })
    } catch (error) {
      logger.error('[PrivateChatServiceV2] Failed to delete session', { error })
      throw new Error(`Failed to delete session: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 订阅会话新消息
   * SDK 会自动轮询（3秒间隔）
   * @param sessionId 会话 ID
   * @param handler 消息处理函数
   * @returns 取消订阅函数
   */
  subscribeToMessages(sessionId: string, handler: MessageHandler): () => void {
    try {
      const unsubscribe = this.privateChatV2.subscribeToMessages(sessionId, (message: PrivateChatMessage) => {
        handler(this.mapToMessageItem(message))
      })

      this.messageUnsubscribes.set(sessionId, unsubscribe)

      logger.debug('[PrivateChatServiceV2] Subscribed to messages', { sessionId })
      return unsubscribe
    } catch (error) {
      logger.error('[PrivateChatServiceV2] Failed to subscribe to messages', { error })
      // Return empty unsubscribe function to handle errors gracefully
      return () => {}
    }
  }

  /**
   * 取消订阅会话消息
   * @param sessionId 会话 ID
   */
  unsubscribeFromMessages(sessionId: string): void {
    const unsubscribe = this.messageUnsubscribes.get(sessionId)
    if (unsubscribe) {
      unsubscribe()
      this.messageUnsubscribes.delete(sessionId)
      logger.debug('[PrivateChatServiceV2] Unsubscribed from messages', { sessionId })
    }
  }

  /**
   * 清除缓存
   * 强制下次调用时从服务器重新获取数据
   */
  invalidateCache(): void {
    try {
      this.privateChatV2.invalidateCache()
      logger.debug('[PrivateChatServiceV2] Cache invalidated')
    } catch (error) {
      logger.warn('[PrivateChatServiceV2] Failed to invalidate cache', { error })
    }
  }

  /**
   * 清理资源
   * 取消所有订阅，清理内存
   */
  dispose(): void {
    // 取消所有消息订阅
    for (const [_sessionId, unsubscribe] of this.messageUnsubscribes.entries()) {
      unsubscribe()
    }
    this.messageUnsubscribes.clear()

    // 调用 SDK dispose
    try {
      this.privateChatV2.dispose()
    } catch (error) {
      logger.warn('[PrivateChatServiceV2] Failed to dispose SDK client', { error })
    }

    // 清除事件监听器
    this.eventListeners.clear()

    this.initialized = false
    logger.info('[PrivateChatServiceV2] Disposed')
  }

  /**
   * 检查会话是否存在
   * @param sessionId 会话 ID
   * @returns 是否存在
   */
  async hasSession(sessionId: string): Promise<boolean> {
    try {
      return await this.privateChatV2.hasSession(sessionId)
    } catch (error) {
      logger.warn('[PrivateChatServiceV2] Failed to check session', { error, sessionId })
      return false
    }
  }

  /**
   * 获取单个会话信息
   * @param sessionId 会话 ID
   * @returns 会话信息
   */
  async getSession(sessionId: string): Promise<PrivateChatSessionItem | undefined> {
    try {
      const session = this.privateChatV2.getSession(sessionId)
      return session ? this.mapToSessionItem(session) : undefined
    } catch (error) {
      logger.warn('[PrivateChatServiceV2] Failed to get session', { error, sessionId })
      return undefined
    }
  }

  /**
   * 添加事件监听器
   * @param event 事件名称
   * @param handler 处理函数
   */
  on(event: string, handler: EventHandler): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(handler)
  }

  /**
   * 移除事件监听器
   * @param event 事件名称
   * @param handler 处理函数
   */
  off(event: string, handler: EventHandler): void {
    const handlers = this.eventListeners.get(event)
    if (handlers) {
      handlers.delete(handler)
    }
  }

  /**
   * 触发事件
   * @param event 事件名称
   * @param data 事件数据
   */
  private emit(event: string, data: unknown): void {
    const handlers = this.eventListeners.get(event)
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data)
        } catch (error) {
          logger.error('[PrivateChatServiceV2] Event handler error', { event, error })
        }
      })
    }
  }

  /**
   * 映射到会话项目
   */
  private mapToSessionItem(session: PrivateChatSession): PrivateChatSessionItem {
    return {
      ...session,
      // SDK returns 'id' but we need 'session_id'
      session_id: session.session_id || session.id || '',
      // 可选：添加额外字段
      unread_count: session.unread_count || 0,
      participant_info:
        session.participant_ids?.map((p: string) => ({
          user_id: p,
          presence: 'offline'
        })) || []
    }
  }

  /**
   * 映射到消息项目
   */
  private mapToMessageItem(message: PrivateChatMessage): PrivateChatMessageItem {
    return {
      ...message,
      message_id: message.message_id || message.id || '',
      session_id: message.session_id,
      sender_id: message.sender_id,
      content: message.content,
      type: message.type || 'text',
      created_at: message.created_at,
      destroy_at: message.destroy_at,
      is_destroyed: message.is_destroyed || false,
      timestamp: message.created_at ? new Date(message.created_at).getTime() : Date.now()
    }
  }
}

// 导出单例实例
export const privateChatServiceV2 = new PrivateChatServiceV2()

// 导出类型
export type { IPrivateChatServiceV2 }
