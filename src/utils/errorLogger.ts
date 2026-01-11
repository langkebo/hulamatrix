/**
 * 错误日志工具
 *
 * 功能：
 * - 仅捕获控制台错误和警告（不捕获 info 和 log）
 * - 通过 Tauri 发送到后端保存到 docs/error_log.md
 * - 每次启动时清空之前的日志
 * - 在开发环境打印到控制台
 * - 时间戳使用北京时间 (UTC+8)
 */

import { invoke } from '@tauri-apps/api/core'
import { logger } from '@/utils/logger'
import { isTauri } from '@/composables/usePlatformAdapters'

interface LogEntry {
  timestamp: string
  level: 'error' | 'warn'
  message: string
  stack?: string
  url?: string
  line?: number
  column?: number
}

/**
 * 获取北京时间字符串 (UTC+8)
 * 返回格式: YYYY-MM-DDTHH:mm:ss.sss (无时区后缀)
 */
function getBeijingTimeString(): string {
  const now = new Date()
  // UTC 时间 + 8 小时 = 北京时间
  const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  // 返回 ISO 格式字符串，去掉末尾的 'Z' (因为这不是 UTC 时间)
  return beijingTime.toISOString().replace('Z', '')
}

class ErrorLogger {
  private logs: LogEntry[] = []
  private maxLogs = 1000 // 最多保存 1000 条日志
  private flushInterval = 5000 // 每 5 秒自动保存一次
  private flushTimer?: ReturnType<typeof setInterval>
  private initialized = false

  constructor() {
    // 延迟初始化，等待 Tauri 环境就绪
    this.initialize()
  }

  private async initialize() {
    if (this.initialized) return
    this.initialized = true

    // 清空之前的错误日志
    if (isTauri) {
      try {
        await invoke('clear_error_log')
        logger.info('✅ 已清空 docs/error_log.md')
      } catch (err) {
        logger.warn('无法清空错误日志文件:', err)
      }
    }

    this.setupConsoleOverrides()
    this.setupGlobalErrorHandlers()
    this.startAutoFlush()
  }

  /**
   * 检查是否为开发环境噪音（不需要记录的错误/警告）
   */
  private isDevNoise(args: unknown[]): boolean {
    const message = args.map((a) => (typeof a === 'string' ? a : '')).join(' ')
    const errorObj = args.find((a) => a instanceof Error) as Error | undefined

    return (
      // Filter Vue 3.5+ strict mode warnings from third-party libraries (Naive UI compatibility)
      message.includes('No default value') ||
      errorObj?.message === 'No default value' ||
      // Filter seemly color library warnings (Naive UI dependency)
      message.includes('[seemly/rgba]: Invalid color value') ||
      (errorObj?.message && errorObj.message.includes('[seemly/rgba]: Invalid color value')) ||
      // Filter Vue internal property access warnings (Vue 3 internal behavior)
      message.includes('Property "$type" was accessed') ||
      message.includes('Property "toJSON" was accessed') ||
      message.includes('enumerating keys on a component instance') ||
      // Filter Vue 3.5+ component lifecycle errors (internal Vue errors during unmount/update)
      message.includes('Right side of assignment cannot be destructured') ||
      (errorObj?.message && errorObj.message.includes('Right side of assignment cannot be destructured')) ||
      (message.includes('null is not an object') && message.includes('parentNode')) ||
      (errorObj?.message &&
        errorObj.message.includes('null is not an object') &&
        errorObj.message.includes('parentNode')) ||
      // Other dev noise
      message.includes('@vite/client') ||
      message.includes('WebSocket closed without opened')
    )
  }

  /**
   * 覆盖原生 console 方法以仅捕获错误和警告
   */
  private setupConsoleOverrides() {
    const originalConsole = {
      error: console.error,
      warn: console.warn
    }

    // 覆盖 console.error
    console.error = (...args: unknown[]) => {
      if (this.isDevNoise(args)) {
        originalConsole.error(...args)
        return
      }
      const logEntry = this.createLogEntry('error', args)
      this.addLog(logEntry)
      originalConsole.error(...args)
    }

    // 覆盖 console.warn
    console.warn = (...args: unknown[]) => {
      if (this.isDevNoise(args)) {
        originalConsole.warn(...args)
        return
      }
      const logEntry = this.createLogEntry('warn', args)
      this.addLog(logEntry)
      originalConsole.warn(...args)
    }
  }

  /**
   * 设置全局错误处理器
   */
  private setupGlobalErrorHandlers() {
    // 捕获未处理的 JavaScript 错误
    window.addEventListener('error', (event) => {
      // Filter Vue 3.5+ strict mode warnings from third-party libraries (Naive UI compatibility)
      if (
        event.message === 'No default value' ||
        (event.error instanceof Error && event.error.message === 'No default value')
      ) {
        return
      }
      const logEntry: LogEntry = {
        timestamp: getBeijingTimeString(),
        level: 'error',
        message: event.message || String(event.error),
        stack: event.error?.stack,
        url: event.filename,
        line: event.lineno,
        column: event.colno
      }
      this.addLog(logEntry)
    })

    // 捕获未处理的 Promise rejection
    window.addEventListener('unhandledrejection', (event) => {
      // Filter Vue 3.5+ strict mode warnings from third-party libraries (Naive UI compatibility)
      const reasonStr = String(event.reason)
      if (
        reasonStr.includes('No default value') ||
        (event.reason instanceof Error && event.reason.message === 'No default value')
      ) {
        return
      }
      const logEntry: LogEntry = {
        timestamp: getBeijingTimeString(),
        level: 'error',
        message: `Unhandled Promise Rejection: ${reasonStr}`,
        stack: event.reason instanceof Error ? event.reason.stack : undefined
      }
      this.addLog(logEntry)
    })

    // 捕获 Vue 错误
    window.addEventListener('vue:error', (event: Event) => {
      // Type assertion for Vue error event
      const vueEvent = event as { message?: string; err?: unknown; stack?: string; componentName?: string }
      // Filter Vue 3.5+ strict mode warnings from third-party libraries (Naive UI compatibility)
      const eventStr = String(vueEvent.err)
      if (
        vueEvent.message === 'No default value' ||
        eventStr.includes('No default value') ||
        // Filter seemly color library warnings (Naive UI dependency)
        vueEvent.message?.includes('[seemly/rgba]: Invalid color value') ||
        eventStr.includes('[seemly/rgba]: Invalid color value') ||
        // Filter Vue 3.5+ component lifecycle errors (internal Vue errors during unmount/update)
        vueEvent.message?.includes('Right side of assignment cannot be destructured') ||
        eventStr.includes('Right side of assignment cannot be destructured') ||
        (vueEvent.message?.includes('null is not an object') && vueEvent.message?.includes('parentNode')) ||
        (eventStr.includes('null is not an object') && eventStr.includes('parentNode'))
      ) {
        return
      }
      const logEntry: LogEntry = {
        timestamp: getBeijingTimeString(),
        level: 'error',
        message: `Vue Error: ${vueEvent.message}`,
        stack: vueEvent.stack,
        url: vueEvent.componentName ? `Component: ${vueEvent.componentName}` : undefined
      }
      this.addLog(logEntry)
    })
  }

  /**
   * 创建日志条目（仅支持 error 和 warn）
   */
  private createLogEntry(level: 'error' | 'warn', args: unknown[]): LogEntry {
    return {
      timestamp: getBeijingTimeString(),
      level,
      message: args
        .map((arg) => {
          if (arg instanceof Error) {
            return `${arg.name}: ${arg.message}\n${arg.stack}`
          }
          if (typeof arg === 'object') {
            try {
              return JSON.stringify(arg, null, 2)
            } catch {
              return String(arg)
            }
          }
          return String(arg)
        })
        .join(' ')
    }
  }

  /**
   * 添加日志到缓冲区
   */
  private addLog(logEntry: LogEntry) {
    this.logs.push(logEntry)

    // 如果超过最大数量，删除最旧的
    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }

    // 立即保存错误级别的日志
    if (logEntry.level === 'error') {
      this.flush().catch((err) => {
        logger.error('Failed to save error log:', err)
      })
    }
  }

  /**
   * 启动自动刷新
   */
  private startAutoFlush() {
    if (isTauri) {
      this.flushTimer = setInterval(() => {
        this.flush().catch((err) => {
          logger.error('Failed to auto-flush logs:', err)
        })
      }, this.flushInterval)
    }
  }

  /**
   * 停止自动刷新
   */
  public stopAutoFlush() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = undefined
    }
  }

  /**
   * 保存日志到文件
   */
  public async flush(): Promise<void> {
    if (this.logs.length === 0 || !isTauri) {
      return
    }

    const logsToSave = [...this.logs]
    this.logs = [] // 清空已保存的日志

    try {
      await invoke('save_error_log', {
        logs: logsToSave
      })
    } catch (error) {
      // 保存失败，把日志放回去
      this.logs = [...logsToSave, ...this.logs]
      logger.error('Failed to save error log:', error)
    }
  }

  /**
   * 手动记录错误
   */
  public logError(message: string, error?: Error | unknown) {
    const logEntry: LogEntry = {
      timestamp: getBeijingTimeString(),
      level: 'error',
      message,
      stack: error instanceof Error ? error.stack : String(error)
    }
    this.addLog(logEntry)
  }

  /**
   * 手动记录警告
   */
  public logWarn(message: string) {
    const logEntry: LogEntry = {
      timestamp: getBeijingTimeString(),
      level: 'warn',
      message
    }
    this.addLog(logEntry)
  }

  /**
   * 获取所有日志
   */
  public getLogs(): LogEntry[] {
    return [...this.logs]
  }

  /**
   * 清空日志
   */
  public clearLogs() {
    this.logs = []
  }
}

// 创建单例实例
export const errorLogger = new ErrorLogger()

// 导出类型
export type { LogEntry }
