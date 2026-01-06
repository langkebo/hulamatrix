/**
 * PrivateChat SDK 工具函数
 * 基于 matrix-js-sdk v39.1.3
 */

import type { BaseResponse } from './types.js'
import { PrivateChatError, NetworkError } from './types.js'

/**
 * 构建查询字符串
 */
export function buildQueryString(params: Record<string, string | number | undefined>): string {
  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value))
    }
  }
  const queryString = searchParams.toString()
  return queryString ? `?${queryString}` : ''
}

/**
 * 检查 HTTP 响应状态
 */
export async function checkResponse(response: Response): Promise<void> {
  if (!response.ok) {
    let body = ''
    try {
      body = await response.text()
    } catch {
      // 忽略文本读取错误
    }

    // 尝试解析错误信息
    let errorMessage = `HTTP ${response.status}`
    try {
      const json = JSON.parse(body)
      if (json.error) {
        errorMessage = json.error
      } else if (json.message) {
        errorMessage = json.message
      }
    } catch {
      // 使用原始错误信息
    }

    throw new PrivateChatError(errorMessage, response.status, body)
  }
}

/**
 * 解析 JSON 响应
 */
export async function parseJsonResponse<T>(response: Response): Promise<T> {
  try {
    const text = await response.text()
    if (!text) {
      return {} as T
    }
    return JSON.parse(text) as T
  } catch (error) {
    throw new PrivateChatError(
      `Failed to parse response: ${error instanceof Error ? error.message : String(error)}`,
      response.status
    )
  }
}

/**
 * 发起 HTTP 请求并处理响应
 */
export async function fetchAndParse<T extends BaseResponse>(url: string, options: RequestInit = {}): Promise<T> {
  let response: Response

  try {
    response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    })
  } catch (error) {
    throw new NetworkError(`Network error: ${error instanceof Error ? error.message : String(error)}`)
  }

  await checkResponse(response)
  return parseJsonResponse<T>(response)
}

/**
 * 检查基础响应状态
 */
export function checkBaseStatus(response: BaseResponse): void {
  if (response.status === 'error') {
    throw new PrivateChatError(
      response.error || 'Unknown error',
      parseInt(response.errcode || '500', 10),
      JSON.stringify(response)
    )
  }
}

/**
 * 格式化用户 ID
 * 确保用户 ID 以 @ 符号开头
 */
export function formatUserId(userId: string): string {
  if (!userId.startsWith('@')) {
    return `@${userId}`
  }
  return userId
}

/**
 * 验证会话 ID 格式
 */
export function isValidSessionId(sessionId: string): boolean {
  // Session ID 应该是 UUID 格式
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(sessionId)
}

/**
 * 验证参与者列表
 */
export function validateParticipants(participants: string[]): void {
  if (!Array.isArray(participants)) {
    throw new PrivateChatError('Participants must be an array', 400)
  }

  if (participants.length === 0) {
    throw new PrivateChatError('At least one participant is required', 400)
  }

  if (participants.length > 10) {
    throw new PrivateChatError('Maximum 10 participants allowed', 400)
  }

  for (const participant of participants) {
    if (!participant || typeof participant !== 'string') {
      throw new PrivateChatError('Invalid participant ID', 400)
    }

    // 确保用户 ID 格式正确
    const formatted = formatUserId(participant)
    if (!formatted.includes(':')) {
      throw new PrivateChatError(`Invalid participant ID format: ${participant}. Expected format: @user:server`, 400)
    }
  }
}

/**
 * 创建延迟 Promise
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 安全的 JSON.stringify
 * 处理循环引用和其他特殊情况
 */
export function safeStringify(obj: unknown): string {
  const seen = new WeakSet()

  return JSON.stringify(obj, (_key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]'
      }
      seen.add(value)
    }
    return value
  })
}

/**
 * 截断字符串
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str
  }
  return str.substring(0, maxLength - 3) + '...'
}

/**
 * 格式化时间戳为 ISO 8601 格式
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString()
}

/**
 * 检查会话是否过期
 */
export function isSessionExpired(expiresAt: string | undefined): boolean {
  if (!expiresAt) {
    return false
  }
  return new Date(expiresAt) < new Date()
}

/**
 * 计算会话剩余时间（秒）
 */
export function getSessionTTL(expiresAt: string | undefined): number {
  if (!expiresAt) {
    return 0
  }
  const expiryDate = new Date(expiresAt)
  const now = new Date()
  const diffMs = expiryDate.getTime() - now.getTime()
  return Math.max(0, Math.floor(diffMs / 1000))
}

/**
 * 生成调试日志
 */
export function createDebugLogger(component: string) {
  return {
    debug: (message: string, data?: unknown) => {
      if (process.env.NODE_ENV === 'development') {
        console.debug(`[${component}] ${message}`, data ? safeStringify(data) : '')
      }
    },
    info: (message: string, data?: unknown) => {
      console.info(`[${component}] ${message}`, data ? safeStringify(data) : '')
    },
    warn: (message: string, data?: unknown) => {
      console.warn(`[${component}] ${message}`, data ? safeStringify(data) : '')
    },
    error: (message: string, error?: unknown) => {
      console.error(`[${component}] ${message}`, error)
    }
  }
}

/**
 * 重试函数
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number
    delayMs?: number
    backoff?: boolean
  } = {}
): Promise<T> {
  const { maxRetries = 3, delayMs = 1000, backoff = true } = options

  let lastError: Error | undefined

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt < maxRetries) {
        const delayTime = backoff ? delayMs * 2 ** attempt : delayMs
        await delay(delayTime)
      }
    }
  }

  throw lastError
}
