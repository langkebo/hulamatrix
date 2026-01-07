/**
 * 错误日志工具
 *
 * 功能：
 * - 捕获所有控制台错误、警告和信息
 * - 通过 Tauri 发送到后端保存
 * - 在开发环境打印到控制台
 */

import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '@/composables/usePlatformAdapters'

interface LogEntry {
  timestamp: string
  level: 'error' | 'warn' | 'info' | 'log'
  message: string
  stack?: string
  url?: string
  line?: number
  column?: number
}

class ErrorLogger {
  private logs: LogEntry[] = []
  private maxLogs = 1000 // 最多保存 1000 条日志
  private flushInterval = 5000 // 每 5 秒自动保存一次
  private flushTimer?: ReturnType<typeof setInterval>

  constructor() {
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
      // Other dev noise
      message.includes('@vite/client') ||
      message.includes('WebSocket closed without opened')
    )
  }

  /**
   * 覆盖原生 console 方法以捕获所有日志
   */
  private setupConsoleOverrides() {
    const originalConsole = {
      error: console.error,
      warn: console.warn,
      info: console.info,
      log: console.log
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

    // 覆盖 console.info
    console.info = (...args: unknown[]) => {
      if (this.isDevNoise(args)) {
        originalConsole.info(...args)
        return
      }
      const logEntry = this.createLogEntry('info', args)
      this.addLog(logEntry)
      originalConsole.info(...args)
    }

    // 覆盖 console.log（可选，如果需要捕获所有日志）
    console.log = (...args: unknown[]) => {
      // 只记录包含特定关键词的日志
      const message = args.join(' ')
      if (
        message.includes('ERROR') ||
        message.includes('Error') ||
        message.includes('error') ||
        message.includes('WARN') ||
        message.includes('Warning')
      ) {
        if (this.isDevNoise(args)) {
          originalConsole.log(...args)
          return
        }
        const logEntry = this.createLogEntry('log', args)
        this.addLog(logEntry)
      }
      originalConsole.log(...args)
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
        timestamp: new Date().toISOString(),
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
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `Unhandled Promise Rejection: ${reasonStr}`,
        stack: event.reason instanceof Error ? event.reason.stack : undefined
      }
      this.addLog(logEntry)
    })

    // 捕获 Vue 错误
    window.addEventListener('vue:error', (event: any) => {
      // Filter Vue 3.5+ strict mode warnings from third-party libraries (Naive UI compatibility)
      if (event.message === 'No default value' || String(event.err).includes('No default value')) {
        return
      }
      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `Vue Error: ${event.message}`,
        stack: event.stack,
        url: event.componentName ? `Component: ${event.componentName}` : undefined
      }
      this.addLog(logEntry)
    })
  }

  /**
   * 创建日志条目
   */
  private createLogEntry(level: LogEntry['level'], args: unknown[]): LogEntry {
    return {
      timestamp: new Date().toISOString(),
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
        console.error('Failed to save error log:', err)
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
          console.error('Failed to auto-flush logs:', err)
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
      console.error('Failed to save error log:', error)
    }
  }

  /**
   * 手动记录错误
   */
  public logError(message: string, error?: Error | unknown) {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
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
      timestamp: new Date().toISOString(),
      level: 'warn',
      message
    }
    this.addLog(logEntry)
  }

  /**
   * 手动记录信息
   */
  public logInfo(message: string) {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
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
