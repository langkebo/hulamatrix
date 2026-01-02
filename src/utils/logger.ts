/**
 * 统一日志系统
 * 提供分级日志、性能监控、错误追踪等功能
 */

enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  OFF = 4
}

interface LogEntry {
  timestamp: number
  level: LogLevel
  message: string
  data?: unknown
  stack?: string
  component?: string
}

interface LoggerConfig {
  level: LogLevel
  enableConsole: boolean
  enableStorage: boolean
  maxStorageEntries: number
  enableRemote: boolean
  remoteEndpoint?: string
}

/**
 * 具有消息属性的错误对象
 */
interface ErrorLike {
  message?: string
  stack?: string
  [key: string]: unknown
}

class Logger {
  private config: LoggerConfig
  private logBuffer: LogEntry[] = []
  private remoteLogQueue: LogEntry[] = []
  private flushTimer?: number

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      level: import.meta.env.DEV ? LogLevel.DEBUG : LogLevel.INFO,
      enableConsole: true,
      enableStorage: import.meta.env.PROD,
      maxStorageEntries: 1000,
      enableRemote: import.meta.env.PROD,
      remoteEndpoint: import.meta.env.VITE_LOG_ENDPOINT,
      ...config
    }

    // 初始化
    this.init()
  }

  private init() {
    // 从本地存储加载日志
    if (this.config.enableStorage) {
      this.loadLogsFromStorage()
    }

    // 设置定期刷新远程日志
    if (this.config.enableRemote) {
      this.flushTimer = window.setInterval(() => {
        this.flushRemoteLogs()
      }, 10000) // 每10秒刷新一次
    }

    // 监听页面卸载，确保日志被保存
    window.addEventListener('beforeunload', () => {
      this.saveLogsToStorage()
      this.flushRemoteLogs()
    })
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.level
  }

  private formatMessage(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString()
    const levelName = LogLevel[entry.level].padEnd(5)
    const component = entry.component ? `[${entry.component}] ` : ''
    return `${timestamp} ${levelName} ${component}${entry.message}`
  }

  private log(level: LogLevel, message: string, data?: unknown, component?: string, error?: Error) {
    if (!this.shouldLog(level)) return

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      data
    }
    if (component) entry.component = component
    const stack = error?.stack
    if (stack) entry.stack = stack

    // 添加到缓冲区
    this.logBuffer.push(entry)

    // 限制缓冲区大小
    if (this.logBuffer.length > this.config.maxStorageEntries) {
      this.logBuffer = this.logBuffer.slice(-this.config.maxStorageEntries)
    }

    // 控制台输出
    if (this.config.enableConsole) {
      this.outputToConsole(entry)
    }

    // 远程日志
    if (this.config.enableRemote && level >= LogLevel.ERROR) {
      this.remoteLogQueue.push(entry)
    }
  }

  private outputToConsole(entry: LogEntry) {
    const formatted = this.formatMessage(entry)
    const args = entry.data ? [formatted, entry.data] : [formatted]

    // 开发环境噪音过滤
    if (import.meta.env.DEV) {
      const text = formatted + ' ' + JSON.stringify(entry.data || '')
      const isDevNoise =
        // 兼容性警告
        text.includes('[Compatibility] Using legacy store') ||
        // 增强功能未初始化
        text.includes('[EnhancedFriends] Client not initialized') ||
        text.includes('[EnhancedFriends]') ||
        // 历史统计
        text.includes('[HistoryStats]') ||
        // 性能监控长任务
        text.includes('[PerformanceMonitor] Long task detected:') ||
        text.includes('[Performance] Long task detected:') ||
        // 性能监控慢资源
        text.includes('[Performance] Slow resource:') ||
        // 平台检测警告（web环境下正常）
        text.includes('Failed to detect platform via Tauri plugin')

      if (isDevNoise) return
    }

    switch (entry.level) {
      case LogLevel.DEBUG:
        logger.debug(...args)
        break
      case LogLevel.INFO:
        logger.info(...args)
        break
      case LogLevel.WARN:
        logger.warn(...args)
        break
      case LogLevel.ERROR:
        if (entry.stack) {
          logger.error(args[0] as string, args[1], args[2])
          logger.error(entry.stack)
        } else {
          logger.error(args[0] as string, args[1], args[2])
        }
        break
    }
  }

  debug(...args: unknown[]) {
    const [message, data, component] = args as [string, unknown, string]
    this.log(LogLevel.DEBUG, message, data, component)
  }

  info(...args: unknown[]) {
    const [message, data, component] = args as [string, unknown, string]
    this.log(LogLevel.INFO, message, data, component)
  }

  warn(...args: unknown[]) {
    const [message, data, component] = args as [string, unknown, string]
    this.log(LogLevel.WARN, message, data, component)
  }

  error(message: string, error?: unknown, data?: unknown, component?: string) {
    const err = error instanceof Error ? error : undefined
    this.log(LogLevel.ERROR, message, data, component, err)
  }

  // 性能日志
  time(label: string, component?: string) {
    this.debug(`⏱️ Timer started: ${label}`, undefined, component)
    console.time(label)
  }

  timeEnd(label: string, component?: string) {
    console.timeEnd(label)
    this.debug(`⏱️ Timer ended: ${label}`, undefined, component)
  }

  // 性能测量
  measure<T>(label: string, fn: () => T, component?: string): T {
    const start = performance.now()
    this.time(label, component)

    try {
      const result = fn()
      const duration = performance.now() - start
      this.timeEnd(label, component)
      this.debug(`⚡ Performance: ${label} took ${duration.toFixed(2)}ms`, { duration }, component)
      return result
    } catch (error) {
      const duration = performance.now() - start
      this.timeEnd(label, component)
      this.error(`⚠️ Performance error in ${label}`, error as Error, { duration }, component)
      throw error
    }
  }

  // 异步性能测量
  async measureAsync<T>(label: string, fn: () => Promise<T>, component?: string): Promise<T> {
    const start = performance.now()
    this.time(label, component)

    try {
      const result = await fn()
      const duration = performance.now() - start
      this.timeEnd(label, component)
      this.debug(`⚡ Performance: ${label} took ${duration.toFixed(2)}ms`, { duration }, component)
      return result
    } catch (error) {
      const duration = performance.now() - start
      this.timeEnd(label, component)
      this.error(`⚠️ Performance error in ${label}`, error as Error, { duration }, component)
      throw error
    }
  }

  // 获取日志
  getLogs(level?: LogLevel): LogEntry[] {
    if (level !== undefined) {
      return this.logBuffer.filter((entry) => entry.level >= level)
    }
    return [...this.logBuffer]
  }

  // 清除日志
  clearLogs() {
    this.logBuffer = []
    if (this.config.enableStorage) {
      localStorage.removeItem('hula-logs')
    }
  }

  // 导出日志
  exportLogs(): string {
    return JSON.stringify(this.logBuffer, null, 2)
  }

  // 保存到本地存储
  private saveLogsToStorage() {
    if (this.config.enableStorage) {
      try {
        localStorage.setItem('hula-logs', JSON.stringify(this.logBuffer))
      } catch (e) {
        this.warn('Failed to save logs to localStorage:', e)
      }
    }
  }

  // 从本地存储加载
  private loadLogsFromStorage() {
    if (this.config.enableStorage) {
      try {
        const stored = localStorage.getItem('hula-logs')
        if (stored) {
          this.logBuffer = JSON.parse(stored)
        }
      } catch (e) {
        this.warn('Failed to load logs from localStorage:', e)
      }
    }
  }

  // 发送远程日志
  private async flushRemoteLogs() {
    if (!this.config.enableRemote || !this.config.remoteEndpoint || this.remoteLogQueue.length === 0) {
      return
    }

    const logsToSend = [...this.remoteLogQueue]
    this.remoteLogQueue = []

    try {
      const response = await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          logs: logsToSend,
          userAgent: navigator.userAgent,
          url: window.location.href,
          timestamp: Date.now()
        })
      })

      if (!response.ok) {
        // 如果失败，把日志放回队列
        this.remoteLogQueue.unshift(...logsToSend)
      }
    } catch (error) {
      this.error('Failed to send logs to remote endpoint:', toError(error))
      // 如果失败，把日志放回队列
      this.remoteLogQueue.unshift(...logsToSend)
    }
  }

  // 销毁日志器
  destroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
    }
    this.saveLogsToStorage()
    this.flushRemoteLogs()
  }
}

// 创建默认日志器实例
export const logger = new Logger()

// 创建带组件名的日志器
export function createLogger(component: string) {
  return {
    debug: (message: string, data?: unknown) => logger.debug(message, data, component),
    info: (message: string, data?: unknown) => logger.info(message, data, component),
    warn: (message: string, data?: unknown) => logger.warn(message, data, component),
    error: (message: string, error?: unknown, data?: unknown) => logger.error(message, error, data, component),
    time: (label: string) => logger.time(label, component),
    timeEnd: (label: string) => logger.timeEnd(label, component),
    measure: <T>(label: string, fn: () => T) => logger.measure(label, fn, component),
    measureAsync: <T>(label: string, fn: () => Promise<T>) => logger.measureAsync(label, fn, component)
  }
}

// 导出日志级别常量
export const LOG_LEVEL = LogLevel

export function toError(e: unknown): Error {
  if (e instanceof Error) return e
  const maybe = e as ErrorLike | null
  if (maybe && typeof maybe === 'object' && typeof maybe.message === 'string') {
    return new Error(maybe.message)
  }
  return new Error(String(e))
}
