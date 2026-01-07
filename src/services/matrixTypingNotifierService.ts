/**
 * Matrix Typing Notifier Service
 * Manages typing notifications with debounce and auto-expiry
 *
 * @module services/matrixTypingNotifierService
 */

import { logger } from '@/utils/logger'

/**
 * 输入状态信息
 */
export interface TypingInfo {
  userId: string
  displayName: string
  since: Date
  roomId: string
}

/**
 * 输入配置选项
 */
export interface TypingNotifierOptions {
  /** 防抖延迟（毫秒） */
  debounceDelay?: number
  /** 输入提示超时时间（毫秒） */
  timeout?: number
  /** 是否自动发送 */
  autoSend?: boolean
}

/**
 * 事件类型
 */
export type TypingNotifierEvent = 'typing_started' | 'typing_stopped' | 'typing_users_updated'

/**
 * Matrix Typing Notifier Service
 * 管理输入提示通知
 */
export class MatrixTypingNotifierService {
  private static instance: MatrixTypingNotifierService

  // 当前房间的输入状态映射 (roomId -> Set<userId>)
  private typingState: Map<string, Set<string>> = new Map()

  // 防抖定时器映射 (roomId -> timeoutId)
  private debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()

  // 输入超时定时器映射 (roomId -> timeoutId)
  private timeoutTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()

  // 事件监听器
  private listeners: Map<TypingNotifierEvent, Array<(data: unknown) => void>> = new Map()

  // 默认配置
  private defaultOptions: TypingNotifierOptions = {
    debounceDelay: 300,
    timeout: 10000,
    autoSend: true
  }

  private constructor() {
    this.setupEventListeners()
  }

  static getInstance(): MatrixTypingNotifierService {
    if (!MatrixTypingNotifierService.instance) {
      MatrixTypingNotifierService.instance = new MatrixTypingNotifierService()
    }
    return MatrixTypingNotifierService.instance
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    const events: TypingNotifierEvent[] = ['typing_started', 'typing_stopped', 'typing_users_updated']
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
    logger.info('[MatrixTypingNotifierService] Initializing')

    const client = matrixClient as {
      on?: (event: string, handler: (...args: unknown[]) => void) => void
      getUserId?: () => string
    }

    if (!client) {
      throw new Error('Matrix client is required')
    }

    // 监听房间输入状态事件
    client.on?.('Room.typing', (...args: unknown[]) => {
      const event = args[0] as { getContent?: () => { user_ids?: string[] } }
      const room = args[1] as { roomId?: string }
      this.handleTypingUpdate(event, room, client)
    })

    logger.info('[MatrixTypingNotifierService] Initialized')
  }

  /**
   * 处理输入状态更新
   */
  private handleTypingUpdate(
    event: { getContent?: () => { user_ids?: string[] } },
    room: { roomId?: string },
    client: { getUserId?: () => string }
  ): void {
    try {
      const content = event.getContent?.()
      const roomId = room.roomId
      const userIds = content?.user_ids
      const myUserId = client.getUserId?.()

      if (!roomId || !userIds) return

      // 过滤掉当前用户
      const otherUsers = userIds.filter((id) => id !== myUserId)

      // 更新状态
      this.typingState.set(roomId, new Set(otherUsers))

      // 发送事件
      this.emit('typing_users_updated', {
        roomId,
        typingUsers: otherUsers
      })

      logger.debug('[MatrixTypingNotifierService] Typing users updated', {
        roomId,
        count: otherUsers.length
      })
    } catch (error) {
      logger.error('[MatrixTypingNotifierService] Failed to handle typing update:', error)
    }
  }

  /**
   * 创建房间输入通知器
   */
  createRoomNotifier(
    roomId: string,
    client: { sendTypingNotice?: (roomId: string, isTyping: boolean, timeout?: number) => Promise<void> },
    options: TypingNotifierOptions = {}
  ): RoomTypingNotifier {
    return new RoomTypingNotifier(
      roomId,
      client,
      {
        ...this.defaultOptions,
        ...options
      },
      this
    )
  }

  /**
   * 获取房间输入用户列表
   */
  getTypingUsers(roomId: string): string[] {
    return Array.from(this.typingState.get(roomId) || [])
  }

  /**
   * 检查用户是否正在输入
   */
  isUserTyping(roomId: string, userId: string): boolean {
    const typingUsers = this.typingState.get(roomId)
    return typingUsers?.has(userId) || false
  }

  /**
   * 获取所有房间的输入状态
   */
  getAllTypingStates(): Map<string, string[]> {
    const result = new Map<string, string[]>()
    this.typingState.forEach((users, roomId) => {
      result.set(roomId, Array.from(users))
    })
    return result
  }

  /**
   * 更新房间输入状态（内部使用）
   */
  updateRoomTypingState(roomId: string, typingUsers: string[]): void {
    this.typingState.set(roomId, new Set(typingUsers))
    this.emit('typing_users_updated', { roomId, typingUsers })
  }

  /**
   * 添加事件监听器
   */
  on(event: TypingNotifierEvent, listener: (data: unknown) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(listener)
  }

  /**
   * 移除事件监听器
   */
  off(event: TypingNotifierEvent, listener: (data: unknown) => void): void {
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
  emit(event: TypingNotifierEvent, data: unknown): void {
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(data)
        } catch (error) {
          logger.error('[MatrixTypingNotifierService] Event listener error', { event, error })
        }
      })
    }
  }

  /**
   * 清理资源
   */
  dispose(): void {
    // 清除所有定时器
    this.debounceTimers.forEach((timer) => clearTimeout(timer))
    this.timeoutTimers.forEach((timer) => clearTimeout(timer))

    this.debounceTimers.clear()
    this.timeoutTimers.clear()
    this.typingState.clear()
    this.listeners.clear()

    logger.info('[MatrixTypingNotifierService] Disposed')
  }
}

/**
 * 房间输入通知器
 * 管理单个房间的输入状态
 */
export class RoomTypingNotifier {
  // 状态跟踪标志
  _isTyping = false
  private typingNoticeSent = false
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private timeoutTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private roomId: string,
    private client: { sendTypingNotice?: (roomId: string, isTyping: boolean, timeout?: number) => Promise<void> },
    private options: TypingNotifierOptions,
    private service: MatrixTypingNotifierService
  ) {}

  /**
   * 用户开始输入
   */
  onUserTyping(): void {
    // 清除之前的防抖定时器
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    // 设置防抖定时器
    this.debounceTimer = setTimeout(() => {
      this.sendTypingNotice()
    }, this.options.debounceDelay || 300)
  }

  /**
   * 用户停止输入
   */
  onUserStoppedTyping(): void {
    this.stopTyping()
  }

  /**
   * 发送输入提示
   */
  private async sendTypingNotice(): Promise<void> {
    if (this.typingNoticeSent) return

    try {
      await this.client.sendTypingNotice?.(this.roomId, true, this.options.timeout)
      this.typingNoticeSent = true
      this._isTyping = true

      this.service.emit('typing_started', { roomId: this.roomId })

      // 设置超时定时器
      this.timeoutTimer = setTimeout(() => {
        this.stopTyping()
      }, this.options.timeout || 10000)

      logger.debug('[RoomTypingNotifier] Typing notice sent', { roomId: this.roomId })
    } catch (error) {
      logger.error('[RoomTypingNotifier] Failed to send typing notice:', error)
    }
  }

  /**
   * 停止输入提示
   */
  private stopTyping(): void {
    // 清除定时器
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }

    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer)
      this.timeoutTimer = null
    }

    // 发送停止输入提示
    if (this.typingNoticeSent) {
      this.client
        .sendTypingNotice?.(this.roomId, false)
        .then(() => {
          this.service.emit('typing_stopped', { roomId: this.roomId })
        })
        .catch((error) => {
          logger.error('[RoomTypingNotifier] Failed to stop typing notice:', error)
        })

      this.typingNoticeSent = false
      this._isTyping = false
    }
  }

  /**
   * 发送消息时调用
   */
  async sendMessage<T>(content: T, sendFn: (content: T) => Promise<unknown>): Promise<unknown> {
    this.stopTyping()
    return sendFn(content)
  }

  /**
   * 清理
   */
  dispose(): void {
    this.stopTyping()
  }
}

// 导出单例实例
export const matrixTypingNotifierService = MatrixTypingNotifierService.getInstance()

// 导出便捷函数
export async function initializeTypingNotifier(client: unknown): Promise<void> {
  return matrixTypingNotifierService.initialize(client)
}

export function createRoomTypingNotifier(
  roomId: string,
  client: { sendTypingNotice?: (roomId: string, isTyping: boolean, timeout?: number) => Promise<void> },
  options?: TypingNotifierOptions
): RoomTypingNotifier {
  return matrixTypingNotifierService.createRoomNotifier(roomId, client, options)
}

export function getTypingUsers(roomId: string): string[] {
  return matrixTypingNotifierService.getTypingUsers(roomId)
}

export function isUserTyping(roomId: string, userId: string): boolean {
  return matrixTypingNotifierService.isUserTyping(roomId, userId)
}
