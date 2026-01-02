import { useMitt } from '@/hooks/useMitt'
import { logger } from './logger'

/**
 * 统一的事件管理器
 * 提供类型安全的事件系统和调试功能
 */

// 定义所有应用事件类型
export enum AppEvents {
  // === 消息相关事件 ===
  MESSAGE_SEND = 'message:send',
  MESSAGE_RECEIVED = 'message:received',
  MESSAGE_READ = 'message:read',
  MESSAGE_SEND_START = 'message:send:start',
  MESSAGE_SEND_SUCCESS = 'message:send:success',
  MESSAGE_SEND_FAILED = 'message:send:failed',

  // === 会话相关事件 ===
  SESSION_CREATE = 'session:create',
  SESSION_UPDATE = 'session:update',
  SESSION_DELETE = 'session:delete',
  SESSION_SWITCH = 'session:switch',
  SESSION_UNREAD_UPDATE = 'session:unread:update',

  // === 用户状态事件 ===
  USER_ONLINE = 'user:online',
  USER_OFFLINE = 'user:offline',
  USER_TYPING = 'user:typing',
  USER_TYPING_STOP = 'user:typing:stop',
  USER_INFO_UPDATE = 'user:info:update',

  // === 连接状态事件 ===
  CONNECTION_CONNECTING = 'connection:connecting',
  CONNECTION_CONNECTED = 'connection:connected',
  CONNECTION_DISCONNECTED = 'connection:disconnected',
  CONNECTION_ERROR = 'connection:error',
  CONNECTION_RECONNECTING = 'connection:reconnecting',

  // === Matrix相关事件 ===
  MATRIX_SYNC_START = 'matrix:sync:start',
  MATRIX_SYNC_PROGRESS = 'matrix:sync:progress',
  MATRIX_SYNC_COMPLETE = 'matrix:sync:complete',
  MATRIX_SYNC_FAILED = 'matrix:sync:failed',
  MATRIX_ENCRYPTION_READY = 'matrix:encryption:ready',
  MATRIX_ENCRYPTION_ERROR = 'matrix:encryption:error',
  MATRIX_DEVICE_VERIFICATION = 'matrix:device:verification',

  // === 文件相关事件 ===
  FILE_UPLOAD_START = 'file:upload:start',
  FILE_UPLOAD_PROGRESS = 'file:upload:progress',
  FILE_UPLOAD_SUCCESS = 'file:upload:success',
  FILE_UPLOAD_FAILED = 'file:upload:failed',
  FILE_DOWNLOAD_START = 'file:download:start',
  FILE_DOWNLOAD_PROGRESS = 'file:download:progress',
  FILE_DOWNLOAD_SUCCESS = 'file:download:success',
  FILE_DOWNLOAD_FAILED = 'file:download:failed',

  // === UI相关事件 ===
  UI_MODAL_OPEN = 'ui:modal:open',
  UI_MODAL_CLOSE = 'ui:modal:close',
  UI_NOTIFICATION_SHOW = 'ui:notification:show',
  UI_NOTIFICATION_HIDE = 'ui:notification:hide',
  UI_SIDEBAR_TOGGLE = 'ui:sidebar:toggle',
  UI_THEME_CHANGE = 'ui:theme:change',

  // === 错误相关事件 ===
  ERROR_OCCURRED = 'error:occurred',
  ERROR_REPORTED = 'error:reported',
  ERROR_RECOVERED = 'error:recovered',

  // === 设置相关事件 ===
  SETTINGS_CHANGE = 'settings:change',
  SETTINGS_RESET = 'settings:reset',
  SETTINGS_IMPORT = 'settings:import',
  SETTINGS_EXPORT = 'settings:export',

  // === 语音相关事件 ===
  VOICE_RECORD_START = 'voice:record:start',
  VOICE_RECORD_STOP = 'voice:record:stop',
  VOICE_RECORD_CANCEL = 'voice:record:cancel',
  VOICE_PLAY_START = 'voice:play:start',
  VOICE_PLAY_STOP = 'voice:play:stop',

  // === 视频通话相关事件 ===
  CALL_INCOMING = 'call:incoming',
  CALL_OUTGOING = 'call:outgoing',
  CALL_ACCEPT = 'call:accept',
  CALL_REJECT = 'call:reject',
  CALL_END = 'call:end',
  CALL_MUTED = 'call:muted',
  CALL_UNMUTED = 'call:unmuted',

  // === 位置相关事件 ===
  LOCATION_SHARE = 'location:share',
  LOCATION_RECEIVED = 'location:received',

  // === 表情相关事件 ===
  EMOJI_SEND = 'emoji:send',
  EMOJI_RECEIVED = 'emoji:received',

  // === 加密相关事件 ===
  ENCRYPTION_ENABLE = 'encryption:enable',
  ENCRYPTION_DISABLE = 'encryption:disable',
  ENCRYPTION_KEY_REQUEST = 'encryption:key:request',
  ENCRYPTION_KEY_RECEIVE = 'encryption:key:receive'
}

// 事件数据类型定义
export type EventData = Partial<Record<AppEvents, unknown>>

export type EventHandler<T = unknown> = (data: T) => void | Promise<void>

/**
 * 事件管理器类
 */
export class EventManager {
  private static instance: EventManager
  private eventStats = new Map<string, number>()
  private eventListeners = new Map<string, Set<string>>()
  private isDebugMode = import.meta.env.DEV

  static getInstance(): EventManager {
    if (!EventManager.instance) {
      EventManager.instance = new EventManager()
    }
    return EventManager.instance
  }

  /**
   * 监听事件（带类型支持）
   */
  on<K extends AppEvents>(
    event: K,
    handler: EventHandler,
    options?: {
      component?: string
      once?: boolean
    }
  ): () => void {
    const componentName = options?.component || 'Unknown'

    // 记录监听器
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(componentName)

    // 记录调试信息
    if (this.isDebugMode) {
      logger.debug(`[EventManager] 注册事件监听: ${event} -> ${componentName}`)
    }

    // 使用useMitt监听事件
    const wrappedHandler = (data: unknown) => {
      try {
        // 记录事件触发
        this.incrementEventStats(event)

        if (this.isDebugMode) {
          logger.debug(`[EventManager] 事件触发: ${event}`, {
            data,
            component: componentName
          })
        }

        // 调用处理器
        const result = handler(data)

        // 如果是一次性监听，立即移除
        if (options?.once) {
          this.off(event, handler)
        }

        return result
      } catch (error) {
        logger.error(`[EventManager] 事件处理器错误 (${event}):`, error)

        // 触发错误事件
        this.emit(AppEvents.ERROR_OCCURRED, {
          error: error instanceof Error ? error : new Error(String(error)),
          context: `Event handler for ${event}`,
          component: componentName
        })
      }
    }

    // 监听事件
    useMitt.on(event, wrappedHandler)

    // 返回取消监听函数
    return () => {
      this.off(event, handler)
    }
  }

  /**
   * 移除事件监听
   */
  off<K extends AppEvents>(event: K, handler: EventHandler): void {
    useMitt.off(event, handler as EventHandler<unknown>)

    // 清理监听器记录
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      // 这里简化处理，实际应该更精确地匹配handler
      listeners.clear()
    }
  }

  /**
   * 发送事件（带类型支持）
   */
  emit<K extends AppEvents>(
    event: K,
    data?: unknown,
    _options?: {
      immediate?: boolean
      timeout?: number
    }
  ): void {
    if (this.isDebugMode) {
      logger.debug(`[EventManager] 发送事件: ${event}`, data)
    }

    // 检查是否有监听器
    if (this.eventListeners.has(event)) {
      useMitt.emit(event, data)
    } else {
      if (this.isDebugMode) {
        logger.warn(`[EventManager] 事件 ${event} 没有监听器`)
      }
    }
  }

  /**
   * 批量发送事件
   */
  emitBatch(
    events: Array<{
      event: AppEvents
      data?: unknown
      delay?: number
    }>
  ): void {
    events.forEach(({ event, data, delay }) => {
      if (delay) {
        setTimeout(() => this.emit(event, data), delay)
      } else {
        this.emit(event, data)
      }
    })
  }

  /**
   * 等待事件
   */
  waitFor<K extends AppEvents>(event: K, timeout: number = 5000): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off(event, handler)
        reject(new Error(`等待事件 ${event} 超时`))
      }, timeout)

      const handler = (data: unknown) => {
        clearTimeout(timer)
        resolve(data)
      }

      this.on(event, handler, { once: true })
    })
  }

  /**
   * 获取事件统计
   */
  getEventStats(): Record<string, number> {
    return Object.fromEntries(this.eventStats)
  }

  /**
   * 获取孤立事件（有发送但没有监听器）
   */
  getOrphanedEvents(): string[] {
    const orphaned: string[] = []
    for (const [event, listeners] of this.eventListeners) {
      if (listeners.size === 0 && this.eventStats.has(event)) {
        orphaned.push(event)
      }
    }
    return orphaned
  }

  /**
   * 清理所有监听器
   */
  clear(): void {
    this.eventListeners.clear()
    this.eventStats.clear()
    // 清除所有事件监听器
    // 注意：这里使用 mitt 实例需要直接访问
    // 由于 useMitt 是封装过的，我们可能需要直接使用 mitt 实例
  }

  /**
   * 增加事件统计
   */
  private incrementEventStats(event: string): void {
    const current = this.eventStats.get(event) || 0
    this.eventStats.set(event, current + 1)
  }

  /**
   * 创建作用域事件管理器
   */
  createScope(scopeName: string) {
    const scopedListeners = new Set<string>()

    return {
      on: <K extends AppEvents>(event: K, handler: EventHandler, options?: { once?: boolean }) => {
        const cleanup = this.on(event, handler, {
          component: scopeName,
          ...options
        })
        scopedListeners.add(event)
        return cleanup
      },

      off: <K extends AppEvents>(event: K, handler: EventHandler) => {
        this.off(event, handler)
        scopedListeners.delete(event)
      },

      clear: () => {
        scopedListeners.forEach((event) => {
          // 简化处理，实际应该存储handler引用
          this.eventListeners.delete(event)
        })
        scopedListeners.clear()
      }
    }
  }
}

// 导出单例实例
export const eventManager = EventManager.getInstance()

// 导出便捷方法
export const useEvents = () => {
  return {
    on: eventManager.on.bind(eventManager),
    off: eventManager.off.bind(eventManager),
    emit: eventManager.emit.bind(eventManager),
    emitBatch: eventManager.emitBatch.bind(eventManager),
    waitFor: eventManager.waitFor.bind(eventManager),
    createScope: eventManager.createScope.bind(eventManager),
    getStats: eventManager.getEventStats.bind(eventManager),
    getOrphanedEvents: eventManager.getOrphanedEvents.bind(eventManager)
  }
}

// 在开发环境下暴露到全局
if (import.meta.env.DEV) {
  const devWindow = window as typeof window & {
    eventManager?: typeof eventManager
    AppEvents?: typeof AppEvents
  }
  devWindow.eventManager = eventManager
  devWindow.AppEvents = AppEvents
}
