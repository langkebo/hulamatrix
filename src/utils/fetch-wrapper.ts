/**
 * 统一的 Fetch 包装器
 * 提供超时支持、AbortController 取消、自动重试和错误转换功能
 *
 * @module fetch-wrapper
 *
 * Requirements:
 * - 12.1: 统一 fetch 包装器，支持超时
 * - 12.2: 自动重试瞬态错误
 * - 12.3: API 错误转换为用户友好消息
 * - 12.4: 支持 AbortController 取消
 * - 12.5: 超时时提供清晰的超时错误消息
 */

import { logger } from '@/utils/logger'

// ============================================================================
// 类型定义
// ============================================================================

/**
 * Fetch 包装器选项
 */
export interface FetchWrapperOptions extends Omit<RequestInit, 'signal'> {
  /** 超时时间（毫秒），默认 10000ms */
  timeout?: number
  /** 外部 AbortController，用于手动取消请求 */
  abortController?: AbortController
  /** 是否启用自动重试，默认 true */
  enableRetry?: boolean
  /** 最大重试次数，默认 3 */
  maxRetries?: number
  /** 重试延迟基数（毫秒），默认 1000ms */
  retryDelay?: number
  /** 最大重试延迟（毫秒），默认 10000ms */
  maxRetryDelay?: number
  /** 自定义重试条件判断函数 */
  shouldRetry?: (error: Error, attempt: number) => boolean
  /** 是否转换错误为用户友好消息，默认 true */
  transformErrors?: boolean
}

/**
 * Fetch 包装器响应
 */
export interface FetchWrapperResponse<T = unknown> {
  /** 响应数据 */
  data: T
  /** HTTP 状态码 */
  status: number
  /** 响应头 */
  headers: Headers
  /** 是否成功 */
  ok: boolean
}

/**
 * 标准化的 Fetch 错误
 */
export class FetchError extends Error {
  /** 错误代码 */
  code: string
  /** HTTP 状态码 */
  status?: number
  /** 用户友好的错误消息 */
  userMessage: string
  /** 是否可重试 */
  retryable: boolean
  /** 原始错误 */
  originalError?: Error
  /** 请求 URL */
  url?: string
  /** 超时时间（如果是超时错误） */
  timeoutMs?: number

  constructor(
    message: string,
    options: {
      code: string
      status?: number
      userMessage: string
      retryable: boolean
      originalError?: Error
      url?: string
      timeoutMs?: number
    }
  ) {
    super(message)
    this.name = 'FetchError'
    this.code = options.code
    this.status = options.status
    this.userMessage = options.userMessage
    this.retryable = options.retryable
    this.originalError = options.originalError
    this.url = options.url
    this.timeoutMs = options.timeoutMs
  }
}

// ============================================================================
// 错误消息映射
// ============================================================================

/**
 * HTTP 状态码到用户消息的映射
 */
const HTTP_STATUS_MESSAGES: Record<number, string> = {
  400: '请求参数错误',
  401: '登录已过期，请重新登录',
  403: '没有权限执行此操作',
  404: '请求的资源不存在',
  408: '请求超时，请稍后重试',
  409: '操作冲突，请刷新后重试',
  413: '请求内容过大',
  429: '请求过于频繁，请稍后重试',
  500: '服务器内部错误，请稍后重试',
  502: '网关错误，请稍后重试',
  503: '服务暂时不可用，请稍后重试',
  504: '网关超时，请稍后重试'
}

/**
 * 错误代码到用户消息的映射
 */
const ERROR_CODE_MESSAGES: Record<string, string> = {
  TIMEOUT: '请求超时，请检查网络连接后重试',
  ABORTED: '请求已取消',
  NETWORK_ERROR: '网络连接失败，请检查网络设置',
  PARSE_ERROR: '响应数据解析失败',
  UNKNOWN: '发生未知错误，请稍后重试'
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 判断错误是否为瞬态错误（可重试）
 */
function isTransientError(error: Error, status?: number): boolean {
  // 网络错误通常是瞬态的
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return true
  }

  // 超时错误是瞬态的
  if (error.name === 'AbortError' || error.message.includes('timeout')) {
    return true
  }

  // 特定 HTTP 状态码是瞬态的
  if (status) {
    const transientStatuses = [408, 429, 500, 502, 503, 504]
    return transientStatuses.includes(status)
  }

  return false
}

/**
 * 获取用户友好的错误消息
 */
function getUserFriendlyMessage(error: Error, status?: number): string {
  // 检查 HTTP 状态码
  if (status && HTTP_STATUS_MESSAGES[status]) {
    return HTTP_STATUS_MESSAGES[status]
  }

  // 检查超时
  if (error.name === 'AbortError' || error.message.includes('timeout')) {
    return ERROR_CODE_MESSAGES.TIMEOUT
  }

  // 检查网络错误
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return ERROR_CODE_MESSAGES.NETWORK_ERROR
  }

  // 检查取消
  if (error.message.includes('aborted') || error.message.includes('cancelled')) {
    return ERROR_CODE_MESSAGES.ABORTED
  }

  return ERROR_CODE_MESSAGES.UNKNOWN
}

/**
 * 获取错误代码
 */
function getErrorCode(error: Error, status?: number): string {
  if (error.name === 'AbortError') {
    if (error.message.includes('timeout')) {
      return 'TIMEOUT'
    }
    return 'ABORTED'
  }

  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return 'NETWORK_ERROR'
  }

  if (status) {
    return `HTTP_${status}`
  }

  return 'UNKNOWN'
}

/**
 * 计算指数退避延迟
 */
function calculateBackoffDelay(attempt: number, baseDelay: number, maxDelay: number): number {
  const delay = baseDelay * 2 ** (attempt - 1)
  // 添加抖动以避免雷群效应
  const jitter = Math.random() * 0.3 * delay
  return Math.min(delay + jitter, maxDelay)
}

/**
 * 延迟函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ============================================================================
// 主要导出函数
// ============================================================================

/**
 * 带超时的 fetch 包装器
 *
 * @param url 请求 URL
 * @param options fetch 选项和扩展选项
 * @returns Promise<Response>
 *
 * @example
 * ```typescript
 * // 基本使用
 * const response = await fetchWithTimeout('https://api.example.com/data')
 *
 * // 带超时
 * const response = await fetchWithTimeout('https://api.example.com/data', {
 *   timeout: 5000
 * })
 *
 * // 带取消控制器
 * const controller = new AbortController()
 * const response = await fetchWithTimeout('https://api.example.com/data', {
 *   abortController: controller
 * })
 * // 取消请求
 * controller.abort()
 * ```
 *
 * Requirements: 12.1, 12.4, 12.5
 */
export async function fetchWithTimeout(url: string, options: FetchWrapperOptions = {}): Promise<Response> {
  const { timeout = 10000, abortController: externalController, transformErrors = true, ...fetchOptions } = options

  // 创建内部 AbortController 用于超时
  const internalController = new AbortController()

  // 如果提供了外部控制器，监听其 abort 事件
  if (externalController) {
    if (externalController.signal.aborted) {
      throw new FetchError('Request was aborted', {
        code: 'ABORTED',
        userMessage: ERROR_CODE_MESSAGES.ABORTED,
        retryable: false,
        url
      })
    }

    externalController.signal.addEventListener('abort', () => {
      internalController.abort()
    })
  }

  // 设置超时定时器
  const timeoutId = setTimeout(() => {
    internalController.abort()
  }, timeout)

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: internalController.signal
    })

    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)

    const err = error instanceof Error ? error : new Error(String(error))

    // 判断是否为超时
    const isTimeout = err.name === 'AbortError' && !externalController?.signal.aborted

    if (transformErrors) {
      throw new FetchError(isTimeout ? `Request timeout after ${timeout}ms` : err.message, {
        code: isTimeout ? 'TIMEOUT' : getErrorCode(err),
        userMessage: isTimeout ? ERROR_CODE_MESSAGES.TIMEOUT : getUserFriendlyMessage(err),
        retryable: isTransientError(err),
        originalError: err,
        url,
        timeoutMs: isTimeout ? timeout : undefined
      })
    }

    throw err
  }
}

/**
 * 带重试的 fetch 包装器
 *
 * @param url 请求 URL
 * @param options fetch 选项和扩展选项
 * @returns Promise<Response>
 *
 * @example
 * ```typescript
 * // 带自动重试
 * const response = await fetchWithRetry('https://api.example.com/data', {
 *   maxRetries: 3,
 *   retryDelay: 1000
 * })
 *
 * // 自定义重试条件
 * const response = await fetchWithRetry('https://api.example.com/data', {
 *   shouldRetry: (error, attempt) => {
 *     return attempt < 3 && error.message.includes('timeout')
 *   }
 * })
 * ```
 *
 * Requirements: 12.2
 */
export async function fetchWithRetry(url: string, options: FetchWrapperOptions = {}): Promise<Response> {
  const {
    enableRetry = true,
    maxRetries = 3,
    retryDelay = 1000,
    maxRetryDelay = 10000,
    shouldRetry,
    ...fetchOptions
  } = options

  let lastError: Error | undefined
  let attempt = 0

  while (attempt <= maxRetries) {
    try {
      const response = await fetchWithTimeout(url, fetchOptions)

      // 检查 HTTP 状态码是否需要重试
      if (!response.ok && enableRetry && attempt < maxRetries) {
        const shouldRetryStatus = isTransientError(new Error(`HTTP ${response.status}`), response.status)
        if (shouldRetryStatus) {
          attempt++
          const delay = calculateBackoffDelay(attempt, retryDelay, maxRetryDelay)
          logger.debug(`[FetchWrapper] Retrying request (attempt ${attempt}/${maxRetries}) after ${delay}ms`, { url })
          await sleep(delay)
          continue
        }
      }

      return response
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // 检查是否应该重试
      const canRetry = enableRetry && attempt < maxRetries
      const isRetryable =
        shouldRetry?.(lastError, attempt + 1) ??
        (lastError instanceof FetchError ? lastError.retryable : isTransientError(lastError))

      if (canRetry && isRetryable) {
        attempt++
        const delay = calculateBackoffDelay(attempt, retryDelay, maxRetryDelay)
        logger.debug(`[FetchWrapper] Retrying request (attempt ${attempt}/${maxRetries}) after ${delay}ms`, {
          url,
          error: lastError.message
        })
        await sleep(delay)
        continue
      }

      throw lastError
    }
  }

  throw lastError || new Error('Max retries exceeded')
}

/**
 * 统一的 API 请求函数
 *
 * @param url 请求 URL
 * @param options fetch 选项和扩展选项
 * @returns Promise<FetchWrapperResponse<T>>
 *
 * @example
 * ```typescript
 * // GET 请求
 * const { data } = await unifiedFetch<User[]>('https://api.example.com/users')
 *
 * // POST 请求
 * const { data } = await unifiedFetch<User>('https://api.example.com/users', {
 *   method: 'POST',
 *   body: JSON.stringify({ name: 'John' }),
 *   headers: { 'Content-Type': 'application/json' }
 * })
 *
 * // 带超时和重试
 * const { data } = await unifiedFetch<Data>('https://api.example.com/data', {
 *   timeout: 5000,
 *   maxRetries: 3
 * })
 * ```
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
 */
export async function unifiedFetch<T = unknown>(
  url: string,
  options: FetchWrapperOptions = {}
): Promise<FetchWrapperResponse<T>> {
  const { enableRetry = true, transformErrors = true, ...restOptions } = options

  const fetchFn = enableRetry ? fetchWithRetry : fetchWithTimeout
  const response = await fetchFn(url, { ...restOptions, enableRetry, transformErrors })

  // 解析响应
  let data: T
  const contentType = response.headers.get('content-type') || ''

  try {
    if (contentType.includes('application/json')) {
      data = (await response.json()) as T
    } else {
      data = (await response.text()) as unknown as T
    }
  } catch (parseError) {
    if (transformErrors) {
      throw new FetchError('Failed to parse response', {
        code: 'PARSE_ERROR',
        status: response.status,
        userMessage: ERROR_CODE_MESSAGES.PARSE_ERROR,
        retryable: false,
        originalError: parseError instanceof Error ? parseError : new Error(String(parseError)),
        url
      })
    }
    throw parseError
  }

  // 检查 HTTP 错误
  if (!response.ok && transformErrors) {
    const errorMessage =
      typeof data === 'object' && data !== null && 'error' in data
        ? String((data as Record<string, unknown>).error)
        : `HTTP ${response.status}`

    throw new FetchError(errorMessage, {
      code: `HTTP_${response.status}`,
      status: response.status,
      userMessage: HTTP_STATUS_MESSAGES[response.status] || ERROR_CODE_MESSAGES.UNKNOWN,
      retryable: isTransientError(new Error(errorMessage), response.status),
      url
    })
  }

  return {
    data,
    status: response.status,
    headers: response.headers,
    ok: response.ok
  }
}

/**
 * 创建可取消的请求
 *
 * @returns 包含 fetch 函数和取消函数的对象
 *
 * @example
 * ```typescript
 * const { fetch, cancel } = createCancellableFetch()
 *
 * // 发起请求
 * const promise = fetch('https://api.example.com/data')
 *
 * // 取消请求
 * cancel()
 *
 * // 请求会抛出 FetchError，code 为 'ABORTED'
 * ```
 *
 * Requirements: 12.4
 */
export function createCancellableFetch(): {
  fetch: <T = unknown>(url: string, options?: FetchWrapperOptions) => Promise<FetchWrapperResponse<T>>
  cancel: () => void
  isCancelled: () => boolean
} {
  const controller = new AbortController()

  return {
    fetch: <T = unknown>(url: string, options: FetchWrapperOptions = {}) => {
      return unifiedFetch<T>(url, {
        ...options,
        abortController: controller
      })
    },
    cancel: () => controller.abort(),
    isCancelled: () => controller.signal.aborted
  }
}

// ============================================================================
// 默认导出
// ============================================================================

export default {
  fetchWithTimeout,
  fetchWithRetry,
  unifiedFetch,
  createCancellableFetch,
  FetchError
}
