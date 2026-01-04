import { invoke } from '@tauri-apps/api/core'
import { AppException, ErrorType } from '@/common/exception'
import { logger, toError } from '@/utils/logger'

/**
 * Tauri 命令参数类型
 */
type InvokeArgs = Record<string, unknown>

/**
 * 错误处理选项
 */
export interface InvokeErrorOptions {
  /** 是否显示错误提示，默认为 true */
  showError?: boolean
  /** 自定义错误消息 */
  customErrorMessage?: string
  /** 是否为重试相关的错误，默认为 false */
  isRetryError?: boolean
  /** 错误类型，默认为 Unknown */
  errorType?: ErrorType
}

/**
 * 重试选项
 */
interface RetryOptions extends InvokeErrorOptions {
  /** 最大重试次数，默认为 3 */
  maxRetries?: number
  /** 重试间隔（毫秒），默认为 1000 */
  retryDelay?: number
}

/**
 * Tauri invoke 调用的统一错误处理包装器
 * @param command Tauri 命令名称
 * @param args 命令参数
 * @param options 错误处理选项
 * @returns Promise<T>
 */
export async function invokeWithErrorHandler<T = unknown>(
  command: string,
  args?: InvokeArgs,
  options?: InvokeErrorOptions
): Promise<T> {
  const { showError = true, customErrorMessage, isRetryError = false, errorType = ErrorType.Unknown } = options || {}

  try {
    const isTauri = typeof window !== 'undefined' && '__TAURI__' in window
    if (!isTauri) {
      return null as unknown as T
    }
    const result = await invoke<T>(command, args)
    return result
  } catch (error) {
    logger.error(`[Tauri Invoke Error] 命令: ${command}`, toError(error))

    // 构造错误消息
    let errorMessage = customErrorMessage
    if (!errorMessage) {
      if (typeof error === 'string') {
        errorMessage = error
      } else if (error instanceof Error) {
        errorMessage = error.message
      } else {
        errorMessage = `调用 ${command} 命令失败`
      }
    }

    // 使用 AppException 统一处理错误
    throw new AppException(errorMessage, {
      type: errorType,
      showError,
      isRetryError,
      details: {
        command,
        args,
        originalError: error
      }
    })
  }
}

/**
 * 静默调用 Tauri 命令（不显示错误提示）
 * @param command Tauri 命令名称
 * @param args 命令参数
 * @returns Promise<T | null> 成功返回结果，失败返回 null
 */
export async function invokeSilently<T = unknown>(command: string, args?: InvokeArgs): Promise<T | null> {
  try {
    return await invokeWithErrorHandler<T>(command, args, { showError: false })
  } catch {
    return null
  }
}

/**
 * 带重试机制的 Tauri 调用
 * @param command Tauri 命令名称
 * @param args 命令参数
 * @param options 重试选项
 * @returns Promise<T>
 */
export async function invokeWithRetry<T = unknown>(
  command: string,
  args?: InvokeArgs,
  options?: RetryOptions
): Promise<T> {
  const { maxRetries = 3, retryDelay = 1000, showError = true, customErrorMessage } = options || {}

  let lastError: unknown

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const opts: InvokeErrorOptions = {
        showError: attempt === maxRetries ? showError : false,
        isRetryError: attempt < maxRetries,
        errorType: ErrorType.Network
      }
      if (attempt === maxRetries && typeof customErrorMessage === 'string') {
        opts.customErrorMessage = customErrorMessage
      }
      return await invokeWithErrorHandler<T>(command, args, opts)
    } catch (error) {
      lastError = error

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay))
      }
    }
  }

  throw lastError
}

export { ErrorType }
