/**
 * EventBus - 增强的事件总线
 * 提供类型安全的事件发布订阅机制，支持命名空间和中间件
 */

import { logger } from './logger'

export type EventHandler<T = unknown> = (data: T) => void | Promise<void>
export type EventMiddleware<T = unknown> = (data: T, next: () => void | Promise<void>) => void | Promise<void>

export interface EventBusConfig {
  maxListeners?: number
  enableLogger?: boolean
  namespace?: string
}

export class TypedEventBus<TEvents extends Record<string, unknown> = Record<string, unknown>> {
  private readonly listeners = new Map<string, Set<EventHandler<unknown>>>()
  private readonly middlewares = new Map<string, Set<EventMiddleware<unknown>>>()
  private readonly globalMiddlewares: EventMiddleware<unknown>[] = []
  private readonly config: EventBusConfig
  private readonly eventHistory: Array<{
    event: string
    data: unknown
    timestamp: number
  }> = []
  private readonly maxHistorySize = 100

  constructor(config: EventBusConfig = {}) {
    this.config = {
      maxListeners: 100,
      enableLogger: true,
      namespace: 'default',
      ...config
    }
  }

  /**
   * 订阅事件
   */
  on<TEvent extends keyof TEvents>(event: TEvent, handler: EventHandler<TEvents[TEvent]>): () => void {
    const eventKey = String(event)
    if (!this.listeners.has(eventKey)) {
      this.listeners.set(eventKey, new Set())
    }

    const handlers = this.listeners.get(eventKey)!

    const max = this.config.maxListeners ?? 100
    if (handlers.size >= max) {
      logger.warn(`Event listener limit exceeded for event: ${String(event)}`, {
        namespace: this.config.namespace,
        currentListeners: handlers.size,
        maxListeners: max
      })
    }

    // 使用类型断言，因为我们知道 TEvents[TEvent] 是 unknown 的子类型
    handlers.add(handler as EventHandler<unknown>)

    // 返回取消订阅函数
    return () => {
      handlers.delete(handler as EventHandler<unknown>)
      if (handlers.size === 0) {
        this.listeners.delete(eventKey)
      }
    }
  }

  /**
   * 订阅事件（只监听一次）
   */
  once<TEvent extends keyof TEvents>(event: TEvent, handler: EventHandler<TEvents[TEvent]>): () => void {
    const onceHandler: EventHandler<TEvents[TEvent]> = (data) => {
      handler(data)
      this.off(event, onceHandler)
    }

    return this.on(event, onceHandler)
  }

  /**
   * 取消订阅事件
   */
  off<TEvent extends keyof TEvents>(event: TEvent, handler?: EventHandler<TEvents[TEvent]>): void {
    const eventKey = String(event)
    const handlers = this.listeners.get(eventKey)
    if (!handlers) {
      return
    }

    if (handler) {
      handlers.delete(handler as EventHandler<unknown>)
      if (handlers.size === 0) {
        this.listeners.delete(eventKey)
      }
    } else {
      // 移除所有监听器
      handlers.clear()
      this.listeners.delete(eventKey)
    }
  }

  /**
   * 发布事件
   */
  async emit<TEvent extends keyof TEvents>(event: TEvent, data: TEvents[TEvent]): Promise<void> {
    try {
      // 记录事件历史
      this.recordEvent(event, data)

      // 日志记录
      if (this.config.enableLogger) {
        const eventKey = String(event)
        logger.debug('Event emitted', {
          event: eventKey,
          namespace: this.config.namespace,
          hasListeners: this.listeners.has(eventKey)
        })
      }

      const eventKey = String(event)
      const handlers = this.listeners.get(eventKey)
      if (!handlers || handlers.size === 0) {
        return
      }

      // 执行中间件链
      await this.executeMiddlewares(event, data, async () => {
        // 执行所有事件处理器
        const promises = Array.from(handlers).map(async (handler) => {
          try {
            await handler(data)
          } catch (error) {
            logger.error('Event handler error', {
              event: String(event),
              error,
              namespace: this.config.namespace
            })
          }
        })

        await Promise.allSettled(promises)
      })
    } catch (error) {
      logger.error('Event emit error', {
        event: String(event),
        error,
        namespace: this.config.namespace
      })
    }
  }

  /**
   * 添加中间件
   */
  use<TEvent extends keyof TEvents>(event: TEvent, middleware: EventMiddleware<TEvents[TEvent]>): () => void {
    const eventKey = String(event)
    if (!this.middlewares.has(eventKey)) {
      this.middlewares.set(eventKey, new Set())
    }

    const middlewares = this.middlewares.get(eventKey)!
    middlewares.add(middleware as EventMiddleware<unknown>)

    // 返回移除中间件函数
    return () => {
      middlewares.delete(middleware as EventMiddleware<unknown>)
      if (middlewares.size === 0) {
        this.middlewares.delete(eventKey)
      }
    }
  }

  /**
   * 添加全局中间件
   */
  useGlobal(middleware: EventMiddleware): () => void {
    this.globalMiddlewares.push(middleware)

    // 返回移除中间件函数
    return () => {
      const index = this.globalMiddlewares.indexOf(middleware)
      if (index > -1) {
        this.globalMiddlewares.splice(index, 1)
      }
    }
  }

  /**
   * 获取事件监听器数量
   */
  listenerCount<TEvent extends keyof TEvents>(event: TEvent): number {
    const eventKey = String(event)
    return this.listeners.get(eventKey)?.size ?? 0
  }

  /**
   * 获取所有事件名称
   */
  eventNames(): (keyof TEvents)[] {
    return Array.from(this.listeners.keys())
  }

  /**
   * 清理所有监听器和中间件
   */
  clear(): void {
    this.listeners.clear()
    this.middlewares.clear()
    this.globalMiddlewares.length = 0
    this.eventHistory.length = 0
  }

  /**
   * 获取事件历史
   */
  getEventHistory(limit?: number): ReadonlyArray<{
    event: keyof TEvents
    data: unknown
    timestamp: number
  }> {
    const history = limit ? this.eventHistory.slice(-limit) : this.eventHistory
    return Object.freeze(history.slice())
  }

  /**
   * 执行中间件链
   */
  private async executeMiddlewares<TEvent extends keyof TEvents>(
    event: TEvent,
    data: TEvents[TEvent],
    finalHandler: () => Promise<void>
  ): Promise<void> {
    const eventKey = String(event)
    const middlewares = this.middlewares.get(eventKey)
    const allMiddlewares: Array<EventMiddleware<TEvents[TEvent]>> = []

    // 添加全局中间件
    allMiddlewares.push(...(this.globalMiddlewares as Array<EventMiddleware<TEvents[TEvent]>>))

    // 添加事件特定中间件
    if (middlewares) {
      allMiddlewares.push(...(Array.from(middlewares) as Array<EventMiddleware<TEvents[TEvent]>>))
    }

    // 创建中间件链
    const executeChain = async (): Promise<void> => {
      let index = 0

      const executeNext = async (): Promise<void> => {
        if (index >= allMiddlewares.length) {
          await finalHandler()
          return
        }

        const middleware = allMiddlewares[index++]
        if (middleware) {
          await middleware(data, executeNext)
        } else {
          await executeNext()
        }
      }

      await executeNext()
    }

    await executeChain()
  }

  /**
   * 记录事件历史
   */
  private recordEvent<TEvent extends keyof TEvents>(event: TEvent, data: TEvents[TEvent]): void {
    this.eventHistory.push({
      event: String(event),
      data,
      timestamp: Date.now()
    })

    // 限制历史记录大小
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift()
    }
  }
}

// 全局事件总线实例
export const globalEventBus = new TypedEventBus({
  namespace: 'global',
  enableLogger: true,
  maxListeners: 200
})

// 专用事件总线实例
export const matrixEventBus = new TypedEventBus({
  namespace: 'matrix',
  enableLogger: true,
  maxListeners: 100
})

export const rtcEventBus = new TypedEventBus({
  namespace: 'rtc',
  enableLogger: true,
  maxListeners: 50
})

export const chatEventBus = new TypedEventBus({
  namespace: 'chat',
  enableLogger: true,
  maxListeners: 150
})

/**
 * 事件总线工厂
 */
export class EventBusFactory {
  private static instances = new Map<string, TypedEventBus<Record<string, unknown>>>()

  static getInstance<T extends Record<string, unknown>>(namespace: string, config?: EventBusConfig): TypedEventBus<T> {
    const key = namespace

    if (!EventBusFactory.instances.has(key)) {
      const newInstance = new TypedEventBus<T>({
        namespace,
        ...config
      })
      EventBusFactory.instances.set(key, newInstance as TypedEventBus<Record<string, unknown>>)
    }

    return EventBusFactory.instances.get(key) as TypedEventBus<T>
  }

  static removeInstance(namespace: string): void {
    EventBusFactory.instances.delete(namespace)
  }

  static clearAll(): void {
    EventBusFactory.instances.forEach((bus) => bus.clear())
    EventBusFactory.instances.clear()
  }
}

// 常用事件类型定义
export interface CommonEvents {
  // 错误事件
  error: {
    error: Error
    context?: Record<string, unknown>
    source: string
  }

  // 通知事件
  notification: {
    type: 'info' | 'success' | 'warning' | 'error'
    title: string
    message: string
    duration?: number
  }

  // 加载状态事件
  loading: {
    loading: boolean
    message?: string
  }

  // 路由事件
  navigate: {
    path: string
    params?: Record<string, unknown>
    replace?: boolean
  }
}

// Matrix 事件类型定义
export interface MatrixEvents {
  // 客户端事件
  'client:ready': void
  'client:error': { error: Error }
  'client:disconnect': void

  // 同步事件
  'sync:start': void
  'sync:progress': { progress: number }
  'sync:complete': { nextBatch: string }
  'sync:error': { error: Error }

  // 房间事件
  'room:join': { roomId: string }
  'room:leave': { roomId: string }
  'room:message': { roomId: string; eventId: string; content: unknown }
  'room:typing': { roomId: string; userIds: string[] }

  // 成员事件
  'member:join': { roomId: string; userId: string }
  'member:leave': { roomId: string; userId: string }
  'member:change': { roomId: string; userId: string; changes: Record<string, unknown> }

  // 加密事件
  'e2ee:keys:ready': void
  'e2ee:keys:backup': { status: string }
  'e2ee:message:decrypt': { roomId: string; eventId: string; success: boolean }
}

// RTC 事件类型定义
export interface RTCEvents {
  // 连接事件
  'connection:established': { peerId: string }
  'connection:closed': { peerId: string }
  'connection:error': { peerId: string; error: Error }

  // 媒体事件
  'media:stream:add': { type: 'local' | 'remote'; stream: MediaStream }
  'media:stream:remove': { type: 'local' | 'remote'; stream: MediaStream }
  'media:device:change': { type: 'camera' | 'microphone'; deviceId: string }

  // 通话事件
  'call:incoming': { callId: string; from: string }
  'call:outgoing': { callId: string; to: string }
  'call:answered': { callId: string }
  'call:ended': { callId: string; reason: string }
}

// 聊天事件类型定义
export interface ChatEvents {
  // 消息事件
  'message:sent': { roomId: string; messageId: string }
  'message:received': { roomId: string; messageId: string }
  'message:read': { roomId: string; messageId: string; userId: string }
  'message:edit': { roomId: string; messageId: string }
  'message:delete': { roomId: string; messageId: string }

  // 聊天状态事件
  'chat:active': { roomId: string }
  'chat:inactive': { roomId: string }
  'chat:typing': { roomId: string; userId: string; typing: boolean }

  // 文件事件
  'file:upload:start': { roomId: string; fileId: string; fileName: string }
  'file:upload:progress': { roomId: string; fileId: string; progress: number }
  'file:upload:complete': { roomId: string; fileId: string; url: string }
  'file:upload:error': { roomId: string; fileId: string; error: Error }
}
