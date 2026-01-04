/**
 * 统一事件分发器
 * 用于协调 Matrix WebSocket 和 Rust WebSocket 事件
 */

import { logger } from '@/utils/logger'
import type { UnlistenFn } from '@tauri-apps/api/event'
import { listen } from '@tauri-apps/api/event'
import { globalEventBus, type EventHandler as BusEventHandler } from './EventBus'

// 检查是否在 Tauri 环境中运行
const isTauri = typeof window !== 'undefined' && window.__TAURI__ !== undefined

// ============================================================================
// 类型定义
// ============================================================================

/**
 * Tauri 事件负载接口（类型文档）
 */
export interface TauriEventPayload {
  [key: string]: unknown
}

/**
 * Tauri 事件接口（类型文档）
 */
export interface TauriEvent {
  payload: unknown
}

/**
 * 统一事件接口
 */
export interface UnifiedEvent<T = unknown> {
  id: string
  type: string
  source: 'matrix' | 'rust' | 'ui'
  data: T
  timestamp: number
}

export type EventHandler<T = unknown> = (event: UnifiedEvent<T>) => void | Promise<void>

export type EventFilter<T = unknown> = (event: UnifiedEvent<T>) => boolean

/**
 * 统一事件分发器
 */
export class EventDispatcher {
  private static instance: EventDispatcher
  private rustListeners: Map<string, UnlistenFn[]> = new Map()

  // 适配器映射：UnifiedEvent Handler -> EventBus Handler
  private handlerMap = new Map<EventHandler<unknown>, BusEventHandler<unknown>>()

  private constructor() {
    this.setupRustEventListeners()
  }

  static getInstance(): EventDispatcher {
    if (!EventDispatcher.instance) {
      EventDispatcher.instance = new EventDispatcher()
    }
    return EventDispatcher.instance
  }

  /**
   * 注册事件监听器
   */
  on<T = unknown>(eventType: string, handler: EventHandler<T>, filter?: EventFilter<T>): void {
    // 创建一个适配器函数，将 EventBus 的 payload (UnifiedEvent) 传递给 handler
    const busHandler: BusEventHandler<unknown> = (payload) => {
      const event = payload as UnifiedEvent<T>

      // 应用过滤器
      if (filter && !filter(event)) {
        return
      }

      handler(event)
    }

    // 保存映射以便后续移除
    this.handlerMap.set(handler as EventHandler<unknown>, busHandler)

    // 注册到 globalEventBus
    globalEventBus.on(eventType, busHandler)
  }

  /**
   * 移除事件监听器
   */
  off<T = unknown>(eventType: string, handler: EventHandler<T>): void {
    const busHandler = this.handlerMap.get(handler as EventHandler<unknown>)
    if (busHandler) {
      globalEventBus.off(eventType, busHandler)
      this.handlerMap.delete(handler as EventHandler<unknown>)
    }

    // 清理过滤器 (简单实现：无法精确移除特定 handler 的 filter，这里仅做示例)
    // 实际上 EventBus 不管理 filter，filter 是在 handler 内部执行的
    // 如果需要完全清理，可能需要更复杂的逻辑，但这里为了兼容性，主要依赖 handler 的移除
  }

  /**
   * 发送事件
   */
  async emit<T = unknown>(eventType: string, data: T, source: 'matrix' | 'rust' | 'ui' = 'ui'): Promise<void> {
    const event: UnifiedEvent<T> = {
      id: this.generateEventId(),
      type: eventType,
      source,
      data,
      timestamp: Date.now()
    }

    // 通过 globalEventBus 发送 UnifiedEvent
    await globalEventBus.emit(eventType, event)

    logger.debug(`Event emitted: ${eventType} from ${source}`)
  }

  /**
   * 批量发送事件
   */
  async emitBatch<T = unknown>(
    events: Array<{
      type: string
      data: T
      source?: 'matrix' | 'rust' | 'ui'
    }>
  ): Promise<void> {
    const promises = events.map(({ type, data, source = 'ui' }) => this.emit(type, data, source))
    await Promise.all(promises)
  }

  /**
   * 设置 Rust 事件监听器
   */
  private setupRustEventListeners(): void {
    // 监听 WebSocket 消息
    this.setupRustListener('websocket-message', (event) => {
      this.emit('rust:message', event.payload, 'rust')
    })

    // 监听文件操作事件
    this.setupRustListener('file-operation', (event) => {
      this.emit('rust:file', event.payload, 'rust')
    })

    // 监听系统通知
    this.setupRustListener('system-notification', (event) => {
      this.emit('rust:notification', event.payload, 'rust')
    })
  }

  /**
   * 设置单个 Rust 监听器
   */
  private setupRustListener(eventName: string, handler: (event: TauriEvent) => void): void {
    // 只有在 Tauri 环境中才设置 Rust 监听器
    if (!isTauri) {
      logger.debug(`[EventDispatcher] Skipping Rust listener for ${eventName} (not in Tauri environment)`)
      return
    }

    listen(eventName, handler)
      .then((unlisten) => {
        if (!this.rustListeners.has(eventName)) {
          this.rustListeners.set(eventName, [])
        }
        this.rustListeners.get(eventName)!.push(unlisten)
      })
      .catch((error) => {
        logger.warn(`Failed to setup Rust listener for ${eventName}:`, error)
      })
  }

  /**
   * 桥接 Matrix 事件
   */
  onMatrixEvent<T = unknown>(eventType: string, handler: EventHandler<T>): void {
    this.on(`matrix:${eventType}`, handler)
  }

  /**
   * 发送 Matrix 事件
   */
  async emitMatrixEvent<T = unknown>(eventType: string, data: T): Promise<void> {
    await this.emit(`matrix:${eventType}`, data, 'matrix')
  }

  /**
   * 桥接 Rust 事件
   */
  onRustEvent<T = unknown>(eventType: string, handler: EventHandler<T>): void {
    this.on(`rust:${eventType}`, handler)
  }

  /**
   * 发送 Rust 事件
   */
  async emitRustEvent<T = unknown>(eventType: string, data: T): Promise<void> {
    await this.emit(`rust:${eventType}`, data, 'rust')
  }

  /**
   * 获取事件历史
   */
  getEventHistory(eventType?: string, limit?: number): UnifiedEvent<unknown>[] {
    // 适配 globalEventBus 的历史记录格式
    const busHistory = globalEventBus.getEventHistory(limit)

    // 过滤并转换为 UnifiedEvent
    return busHistory
      .filter((record) => !eventType || record.event === eventType)
      .map((record) => record.data as UnifiedEvent<unknown>)
  }

  /**
   * 清理资源
   */
  destroy(): void {
    // 清理所有 Rust 监听器
    for (const [eventName, listeners] of this.rustListeners) {
      listeners.forEach((unlisten) => {
        try {
          unlisten()
        } catch (error) {
          logger.warn(`Failed to cleanup listener for ${eventName}:`, error)
        }
      })
    }

    // 清理所有监听器 (从 globalEventBus 移除)
    // 注意：我们无法轻易从 globalEventBus 移除，因为缺少 eventType 信息
    // 但鉴于这是一个单例且通常不销毁，或者 globalEventBus 有自己的清理机制
    // 我们至少可以清空本地映射

    this.handlerMap.clear()
  }

  /**
   * 生成事件 ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

// 导出单例实例
export const eventDispatcher = EventDispatcher.getInstance()

// 导出便捷函数
export function onEvent<T = unknown>(eventType: string, handler: EventHandler<T>, filter?: EventFilter<T>): void {
  eventDispatcher.on(eventType, handler, filter)
}

export function offEvent<T = unknown>(eventType: string, handler: EventHandler<T>): void {
  eventDispatcher.off(eventType, handler)
}

export async function emitEvent<T = unknown>(
  eventType: string,
  data: T,
  source?: 'matrix' | 'rust' | 'ui'
): Promise<void> {
  await eventDispatcher.emit(eventType, data, source)
}

// 事件类型常量
export const EventTypes = {
  // Matrix 事件
  MATRIX_ROOM_MESSAGE: 'matrix:room.message',
  MATRIX_ROOM_MEMBER: 'matrix:room.member',
  MATRIX_ROOM_STATE: 'matrix:room.state',
  MATRIX_SYNC: 'matrix:sync',
  MATRIX_INVITE: 'matrix:invite',

  // Rust 事件
  RUST_MESSAGE: 'rust:message',
  RUST_FILE: 'rust:file',
  RUST_NOTIFICATION: 'rust:notification',

  // UI 事件
  UI_TYPING_START: 'ui:typing.start',
  UI_TYPING_STOP: 'ui:typing.stop',
  UI_USER_ONLINE: 'ui:user.online',
  UI_USER_OFFLINE: 'ui:user.offline',

  // 统一事件
  MESSAGE_NEW: 'message:new',
  MESSAGE_UPDATE: 'message:update',
  MESSAGE_DELETE: 'message:delete',
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  USER_TYPING: 'user:typing',
  USER_STATUS_CHANGE: 'user:status.change'
} as const

export type EventType = (typeof EventTypes)[keyof typeof EventTypes]
