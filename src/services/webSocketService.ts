/**
 * WebSocket 服务
 * 提供统一的WebSocket通信接口
 * 合并了原WebSocketManager.ts的协调逻辑
 */

import webSocketRust from '@/services/webSocketRust'
import { logger } from '@/utils/logger'
import { eventDispatcher, type UnifiedEvent } from '@/utils/EventDispatcher'
import type { MatrixClient } from 'matrix-js-sdk'

// ============================================================================
// Matrix SDK 类型定义 (从WebSocketManager.ts合并)
// ============================================================================

/**
 * Matrix 事件基础接口
 */
interface MatrixEventLike {
  getId?(): string
  getRoomId?(): string
  getType(): string
  getContent?<T = unknown>(): T
  getSender?(): string
  getTs?(): number
  sender?: string
  roomId?: string
  eventId?: string
  timestamp?: number
  content?: Record<string, unknown>
}

/**
 * Matrix 房间接口
 */
interface MatrixRoomLike {
  roomId: string
  membership?: string
}

/**
 * Matrix 同步事件
 */
interface MatrixSyncEvent {
  nextSyncToken?: string
  timelineEvents?: MatrixEventLike[]
}

/**
 * Matrix 客户端扩展接口
 * SDK Integration: Uses SDK native sendTypingNotice()
 */
interface MatrixClientExtended {
  on(event: string, handler: (...args: unknown[]) => void): void
  sendEvent(roomId: string, type: string, content: Record<string, unknown>): Promise<unknown>
  sendTypingNotice(roomId: string, isTyping: boolean, timeout?: number): Promise<unknown>
  joinRoom(roomIdOrAlias: string): Promise<unknown>
  leave(roomId: string): Promise<unknown>
}

// ============================================================================
// 导出接口
// ============================================================================

export interface WebSocketConfig {
  matrix?: { client: MatrixClient }
  rust?: { reconnectAttempts?: number; reconnectDelay?: number }
}

export interface WebSocketStatus {
  matrix: { connected: boolean; lastError?: Error }
  rust: { connected: boolean; lastError?: Error }
}

// 为了兼容性，将 webSocketRust 视为 unknown 类型
const wsRust = webSocketRust as unknown as {
  isConnected?: () => boolean
  send?: (params: unknown) => Promise<unknown>
  on?: (event: string, callback: (...args: unknown[]) => void) => void
  connect?: (url?: string) => Promise<void>
  start?: () => Promise<void>
  stop?: () => Promise<void>
}

export class WebSocketService {
  private static instance: WebSocketService
  private eventListeners = new Map<string, ((data?: unknown) => void)[]>()
  private config: WebSocketConfig = {}
  private status: WebSocketStatus = {
    matrix: { connected: false },
    rust: { connected: false }
  }
  private reconnectTimer?: NodeJS.Timeout

  private constructor() {
    this.setupEventHandlers()
  }

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService()
    }
    return WebSocketService.instance
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    try {
      // 检查 Rust WebSocket 连接状态
      const rustConnected = wsRust.isConnected?.() || false
      this.status.rust.connected = rustConnected
      return this.status.matrix.connected || rustConnected
    } catch (error) {
      logger.error('[WebSocketService] Failed to check connection status:', error)
      return false
    }
  }

  /**
   * 发送消息
   */
  async send(message: { type: string; roomId?: string; data?: unknown; payload?: unknown }): Promise<unknown> {
    try {
      if (!this.isConnected()) {
        throw new Error('WebSocket未连接')
      }

      logger.debug('[WebSocketService] Sending message:', message)

      const response = await wsRust.send?.({
        type: message.type,
        roomId: message.roomId,
        data: message.data ?? message.payload
      })

      return response
    } catch (error) {
      logger.error('[WebSocketService] Failed to send message:', {
        message,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  /**
   * 发送消息到指定房间
   */
  async sendToRoom(roomId: string, type: string, data: unknown): Promise<unknown> {
    return this.send({
      type,
      roomId,
      data
    })
  }

  /**
   * 发送文本消息
   */
  async sendTextMessage(roomId: string, text: string): Promise<unknown> {
    return this.sendToRoom(roomId, 'message', {
      type: 'text',
      body: text,
      timestamp: Date.now()
    })
  }

  /**
   * 添加事件监听器
   */
  on(event: string, callback: (data?: unknown) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }
    this.eventListeners.get(event)!.push(callback)
  }

  /**
   * 移除事件监听器
   */
  off(event: string, callback?: (data?: unknown) => void): void {
    if (!this.eventListeners.has(event)) return

    if (callback) {
      const listeners = this.eventListeners.get(event)!
      const index = listeners.indexOf(callback)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    } else {
      this.eventListeners.set(event, [])
    }
  }

  /**
   * 触发事件
   */
  private emit(event: string, data?: unknown): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(data)
        } catch (error) {
          logger.error('[WebSocketService] Error in event listener:', {
            event,
            error
          })
        }
      })
    }
  }

  /**
   * 初始化 WebSocket 连接 (从WebSocketManager合并)
   */
  async initializeWithConfig(config: WebSocketConfig): Promise<void> {
    this.config = config

    // 初始化 Matrix WebSocket
    if (config.matrix?.client) {
      await this.initializeMatrixWebSocket(config.matrix.client)
    }

    // 初始化 Rust WebSocket
    if (config.rust) {
      await this.initializeRustWebSocket()
    }

    logger.info('[WebSocketService] Initialized with config')
  }

  /**
   * 初始化 Matrix WebSocket (从WebSocketManager合并)
   */
  private async initializeMatrixWebSocket(client: MatrixClient): Promise<void> {
    const matrixClient = client as unknown as MatrixClientExtended

    // 监听 Matrix 事件
    matrixClient.on('sync', (...args: unknown[]) => {
      const [event] = args as [MatrixSyncEvent]
      this.status.matrix.connected = true
      delete this.status.matrix.lastError

      // 转发到事件分发器
      eventDispatcher.emitMatrixEvent('sync', {
        nextSyncToken: event.nextSyncToken,
        timelineEvents: event.timelineEvents
      })
    })

    matrixClient.on('event', (...args: unknown[]) => {
      const [event] = args as [MatrixEventLike]
      const eventType = this.getMatrixEventType(event)
      eventDispatcher.emitMatrixEvent(eventType, {
        eventId: event.getId?.(),
        roomId: event.getRoomId?.(),
        type: event.getType(),
        content: event.getContent?.(),
        sender: event.getSender?.(),
        timestamp: event.getTs?.()
      })
    })

    matrixClient.on('Room.timeline', (...args: unknown[]) => {
      const [event, room, toStartOfTimeline] = args as [MatrixEventLike, MatrixRoomLike, boolean]
      if (!toStartOfTimeline) {
        eventDispatcher.emitMatrixEvent('room.message', {
          eventId: event.getId?.(),
          roomId: room.roomId,
          type: event.getType(),
          content: event.getContent?.(),
          sender: event.getSender?.(),
          timestamp: event.getTs?.()
        })
      }
    })

    matrixClient.on('RoomState.events', (stateEvents: unknown) => {
      eventDispatcher.emitMatrixEvent('room.state', stateEvents)
    })

    matrixClient.on('RoomMember.membership', (...args: unknown[]) => {
      const [event, member, oldMembership] = args as [MatrixEventLike, MatrixRoomLike, string]
      eventDispatcher.emitMatrixEvent('room.member', {
        event,
        membership: member.membership,
        oldMembership
      })
    })

    // 错误处理
    matrixClient.on('Session.logged_out', () => {
      this.status.matrix.connected = false
      this.status.matrix.lastError = new Error('Logged out')
      eventDispatcher.emitMatrixEvent('auth.logged_out', {})
    })

    // 连接状态监听
    matrixClient.on('sync.presence', (event: unknown) => {
      eventDispatcher.emitMatrixEvent('presence', event)
    })

    logger.info('[WebSocketService] Matrix WebSocket initialized')
  }

  /**
   * 初始化 Rust WebSocket (从WebSocketManager合并)
   */
  private async initializeRustWebSocket(): Promise<void> {
    // Rust WebSocket 通过 Tauri 事件系统处理
    // 这里只标记状态，实际连接由 Rust 端维护
    this.status.rust.connected = true
    logger.info('[WebSocketService] Rust WebSocket initialized')
  }

  /**
   * 获取 Matrix 事件类型 (从WebSocketManager合并)
   */
  private getMatrixEventType(event: MatrixEventLike): string {
    const type = event.getType()
    const eventTypeMap: Record<string, string> = {
      'm.room.message': 'room.message',
      'm.room.name': 'room.name',
      'm.room.topic': 'room.topic',
      'm.room.avatar': 'room.avatar',
      'm.room.member': 'room.member',
      'm.room.power_levels': 'room.power_levels',
      'm.room.history_visibility': 'room.history_visibility',
      'm.room.join_rules': 'room.join_rules',
      'm.room.guest_access': 'room.guest_access',
      'm.room.encryption': 'room.encryption',
      'm.room.tombstone': 'room.tombstone',
      'm.sticker': 'room.sticker',
      'm.image': 'room.image',
      'm.file': 'room.file',
      'm.audio': 'room.audio',
      'm.video': 'room.video',
      'm.location': 'room.location',
      'm.poll.start': 'room.poll.start',
      'm.poll.end': 'room.poll.end'
    }

    return eventTypeMap[type] || `room.${type}`
  }

  /**
   * 设置事件处理器 (从WebSocketManager合并)
   */
  private setupEventHandlers(): void {
    // 监听 UI 发送的事件，转发到相应的 WebSocket
    eventDispatcher.on('ui:send_message', async (event) => {
      await this.handleMessageSend(event)
    })

    eventDispatcher.on('ui:join_room', async (event) => {
      await this.handleRoomJoin(event)
    })

    eventDispatcher.on('ui:leave_room', async (event) => {
      await this.handleRoomLeave(event)
    })

    eventDispatcher.on('ui:typing_start', async (event) => {
      await this.handleTypingStart(event)
    })

    eventDispatcher.on('ui:typing_stop', async (event) => {
      await this.handleTypingStop(event)
    })
  }

  /**
   * 处理消息发送 (从WebSocketManager合并)
   */
  private async handleMessageSend(event: UnifiedEvent): Promise<void> {
    const data = event.data as { roomId: string; content: Record<string, unknown> }
    const { roomId, content } = data

    // 通过 Matrix 发送
    if (this.config.matrix?.client && this.status.matrix.connected) {
      try {
        const client = this.config.matrix.client as unknown as MatrixClientExtended
        await client.sendEvent(roomId, 'm.room.message', content)
        eventDispatcher.emit('message:sent', { eventId: event.id, roomId })
      } catch (error) {
        logger.error('[WebSocketService] Failed to send message via Matrix:', error)
        eventDispatcher.emit('message:error', { eventId: event.id, error })
      }
    }
  }

  /**
   * 处理房间加入 (从WebSocketManager合并)
   */
  private async handleRoomJoin(event: UnifiedEvent): Promise<void> {
    const data = event.data as { roomIdOrAlias: string }
    const { roomIdOrAlias } = data

    if (this.config.matrix?.client && this.status.matrix.connected) {
      try {
        await this.config.matrix.client.joinRoom(roomIdOrAlias)
        eventDispatcher.emit('room:joined', { roomId: roomIdOrAlias })
      } catch (error) {
        logger.error('[WebSocketService] Failed to join room:', error)
        eventDispatcher.emit('room:error', { roomId: roomIdOrAlias, error })
      }
    }
  }

  /**
   * 处理房间离开 (从WebSocketManager合并)
   */
  private async handleRoomLeave(event: UnifiedEvent): Promise<void> {
    const data = event.data as { roomId: string }
    const { roomId } = data

    if (this.config.matrix?.client && this.status.matrix.connected) {
      try {
        await this.config.matrix.client.leave(roomId)
        eventDispatcher.emit('room:left', { roomId })
      } catch (error) {
        logger.error('[WebSocketService] Failed to leave room:', error)
        eventDispatcher.emit('room:error', { roomId, error })
      }
    }
  }

  /**
   * 处理开始输入 (从WebSocketManager合并)
   * SDK Integration: Uses client.sendTypingNotice()
   */
  private async handleTypingStart(event: UnifiedEvent): Promise<void> {
    const data = event.data as { roomId: string }
    const { roomId } = data

    if (this.config.matrix?.client && this.status.matrix.connected) {
      try {
        const client = this.config.matrix.client as unknown as MatrixClientExtended
        // Use SDK's native sendTypingNotice (isTyping, timeout)
        await client.sendTypingNotice(roomId, true, 30000)
      } catch (error) {
        logger.error('[WebSocketService] Failed to send typing notice:', error)
      }
    }
  }

  /**
   * 处理停止输入 (从WebSocketManager合并)
   * SDK Integration: Uses client.sendTypingNotice()
   */
  private async handleTypingStop(event: UnifiedEvent): Promise<void> {
    const data = event.data as { roomId: string }
    const { roomId } = data

    if (this.config.matrix?.client && this.status.matrix.connected) {
      try {
        const client = this.config.matrix.client as unknown as MatrixClientExtended
        // Use SDK's native sendTypingNotice (isTyping=false)
        await client.sendTypingNotice(roomId, false)
      } catch (error) {
        logger.error('[WebSocketService] Failed to stop typing notice:', error)
      }
    }
  }

  /**
   * 获取连接状态 (从WebSocketManager合并)
   */
  getStatus(): WebSocketStatus {
    return { ...this.status }
  }

  /**
   * 初始化事件监听
   */
  initialize(): void {
    try {
      // 监听WebSocket连接状态变化
      wsRust.on?.('connected', () => {
        logger.info('[WebSocketService] WebSocket connected')
        this.status.rust.connected = true
        this.emit('connected')
      })

      wsRust.on?.('disconnected', () => {
        logger.info('[WebSocketService] WebSocket disconnected')
        this.status.rust.connected = false
        this.emit('disconnected')
      })

      // 监听接收到的消息
      wsRust.on?.('message', (message: unknown) => {
        logger.debug('[WebSocketService] Message received:', message)
        this.emit('message', message)

        // 根据消息类型触发特定事件
        if (
          typeof message === 'object' &&
          message &&
          'type' in message &&
          message.type === 'message' &&
          'roomId' in message
        ) {
          this.emit(`room:${String(message.roomId)}`, message)
        }
      })

      // 监听错误
      wsRust.on?.('error', (...args: unknown[]) => {
        const error = args[0] as Error | Record<string, unknown>
        logger.error('[WebSocketService] WebSocket error:', error)
        this.status.rust.lastError = error instanceof Error ? error : new Error(String(error))
        this.emit('error', error)
      })
    } catch (error) {
      logger.error('[WebSocketService] Failed to initialize event listeners:', error)
    }
  }

  /**
   * 连接到WebSocket服务器
   */
  async connect(url?: string): Promise<void> {
    try {
      if (this.isConnected()) {
        logger.info('[WebSocketService] Already connected')
        return
      }

      logger.info('[WebSocketService] Connecting to WebSocket server')

      // 如果提供了URL，使用连接方法
      if (url && wsRust.connect) {
        await wsRust.connect(url)
      } else {
        // 否则使用现有的连接逻辑
        await wsRust.start?.()
      }

      this.initialize()
    } catch (error) {
      logger.error('[WebSocketService] Failed to connect:', error)
      throw error
    }
  }

  /**
   * 断开WebSocket连接
   */
  async disconnect(): Promise<void> {
    try {
      logger.info('[WebSocketService] Disconnecting...')

      // 停止重连
      if (this.reconnectTimer) {
        clearInterval(this.reconnectTimer)
        delete this.reconnectTimer
      }

      if (wsRust.stop) {
        await wsRust.stop()
      }

      this.status.matrix.connected = false
      this.status.rust.connected = false

      if (this.config.matrix?.client) {
        // Matrix 客户端由外部管理，这里只清理引用
        delete this.config.matrix
      }

      logger.info('[WebSocketService] WebSocket disconnected')
    } catch (error) {
      logger.error('[WebSocketService] Failed to disconnect:', error)
    }
  }

  /**
   * 发送心跳
   */
  async ping(): Promise<void> {
    try {
      await this.send({
        type: 'ping',
        data: { timestamp: Date.now() }
      })
    } catch (error) {
      logger.error('[WebSocketService] Failed to send ping:', error)
    }
  }

  /**
   * 销毁资源 (从WebSocketManager合并)
   */
  destroy(): void {
    this.disconnect()
    logger.info('[WebSocketService] Destroyed')
  }
}

// 导出单例实例
export const webSocketService = WebSocketService.getInstance()

// 自动初始化
webSocketService.initialize()
