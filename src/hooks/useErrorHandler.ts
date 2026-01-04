import { msg } from '@/utils/SafeUI'
/**
 * 错误处理 Composable
 * 提供Vue组件中使用的错误处理功能
 */

import { ref, computed, onUnmounted, getCurrentInstance } from 'vue'
import { useRouter } from 'vue-router'
import { logger } from '@/utils/logger'

import {
  handleError,
  retryError,
  resolveError,
  registerErrorHandler,
  type StandardError,
  type ErrorCategory,
  type RawError,
  ErrorSeverity,
  ErrorAction
} from '@/utils/error-handler'

export interface ErrorState {
  currentError: StandardError | null
  loading: boolean
  retrying: boolean
  retryCount: number
}

export interface ErrorHandlingOptions {
  component?: string
  operation?: string
  showUserNotification?: boolean
  enableRetry?: boolean
  maxRetries?: number
  onSuccess?: () => void
  onError?: (error: StandardError) => void
  onRetry?: (attempt: number) => void
}

export function useErrorHandler(options: ErrorHandlingOptions = {}) {
  const message = msg
  const router = useRouter()
  const instance = getCurrentInstance()

  // 错误状态
  const errorState = ref<ErrorState>({
    currentError: null,
    loading: false,
    retrying: false,
    retryCount: 0
  })

  // 错误历史
  const errorHistory = ref<StandardError[]>([])

  // 计算属性
  const hasError = computed(() => errorState.value.currentError !== null)
  const canRetry = computed(() => {
    const error = errorState.value.currentError
    return (
      error &&
      error.retryable &&
      (error.maxRetries === undefined || errorState.value.retryCount < (error.maxRetries || 3))
    )
  })
  const errorSeverity = computed(() => errorState.value.currentError?.severity || 'low')
  const errorMessage = computed(() => errorState.value.currentError?.userMessage || '')
  const errorCode = computed(() => errorState.value.currentError?.code || '')

  /**
   * 处理异步操作的错误
   */
  const withErrorHandling = async <T>(
    operation: () => Promise<T>,
    context?: Partial<ErrorHandlingOptions>
  ): Promise<T | null> => {
    const finalOptions = { ...options, ...context }

    errorState.value.loading = true
    errorState.value.currentError = null

    try {
      const result = await operation()

      // 成功时的回调
      if (finalOptions.onSuccess) {
        finalOptions.onSuccess()
      }

      return result
    } catch (error) {
      const standardError = handleError(error as RawError, {
        component: finalOptions.component || instance?.type?.name || 'UnknownComponent',
        operation: finalOptions.operation || 'unknown_operation'
      })

      errorState.value.currentError = standardError
      errorHistory.value.push(standardError)

      // 显示用户通知
      if (finalOptions.showUserNotification !== false) {
        showErrorMessage(standardError)
      }

      // 错误回调
      if (finalOptions.onError) {
        finalOptions.onError(standardError)
      }

      return null
    } finally {
      errorState.value.loading = false
    }
  }

  /**
   * 处理同步操作的错误
   */
  const catchSyncError = (operation: () => unknown, context?: Partial<ErrorHandlingOptions>): unknown => {
    try {
      return operation()
    } catch (error) {
      const standardError = handleError(error as RawError, {
        component: context?.component || instance?.type?.name || 'UnknownComponent',
        operation: context?.operation || 'sync_operation'
      })

      errorState.value.currentError = standardError
      errorHistory.value.push(standardError)

      if (context?.showUserNotification !== false) {
        showErrorMessage(standardError)
      }

      if (context?.onError) {
        context.onError(standardError)
      }

      return null
    }
  }

  /**
   * 手动处理错误
   */
  const handleManualError = (error: RawError, context?: Partial<ErrorHandlingOptions>): StandardError => {
    const standardError = handleError(error, {
      component: context?.component || instance?.type?.name || 'UnknownComponent',
      operation: context?.operation || 'manual_error'
    })

    errorState.value.currentError = standardError
    errorHistory.value.push(standardError)

    if (context?.showUserNotification !== false) {
      showErrorMessage(standardError)
    }

    if (context?.onError) {
      context.onError(standardError)
    }

    return standardError
  }

  /**
   * 重试操作
   */
  const retry = async <T = unknown>(retryFn?: () => Promise<T>): Promise<boolean> => {
    const error = errorState.value.currentError
    if (!error || !canRetry.value) {
      return false
    }

    errorState.value.retrying = true
    errorState.value.retryCount++

    try {
      if (options.onRetry) {
        options.onRetry(errorState.value.retryCount)
      }

      if (retryFn) {
        await retryError(error.id, retryFn)
      } else {
        await retryError(error.id, () => Promise.resolve())
      }

      // 重试成功
      clearError()

      if (options.onSuccess) {
        options.onSuccess()
      }

      return true
    } catch (retryError) {
      // 重试失败
      errorState.value.currentError = retryError as StandardError

      showErrorMessage(retryError as StandardError)

      if (options.onError) {
        options.onError(retryError as StandardError)
      }

      return false
    } finally {
      errorState.value.retrying = false
    }
  }

  /**
   * 清除当前错误
   */
  const clearError = (feedback?: 'positive' | 'negative' | 'neutral') => {
    if (errorState.value.currentError) {
      resolveError(errorState.value.currentError.id, feedback)
    }

    errorState.value.currentError = null
    errorState.value.retryCount = 0
    errorState.value.retrying = false
  }

  /**
   * 显示错误消息
   */
  const showErrorMessage = (error: StandardError) => {
    const messageType = getMessageType(error.severity)

    switch (error.suggestedAction) {
      case ErrorAction.RETRY:
        message.error(error.userMessage, {
          duration: 5000,
          onAfterLeave: () => {
            // 重试逻辑将在用户关闭消息后执行
          }
        })
        // 提供重试选项
        if (error.suggestedAction === ErrorAction.RETRY) {
          setTimeout(() => {
            message.info('点击重试按钮重新操作', {
              duration: 3000,
              onAfterLeave: retry
            })
          }, 1000)
        }
        break

      case ErrorAction.REAUTH:
        message.error(error.userMessage, {
          duration: 8000
        })
        setTimeout(() => {
          message.warning('即将跳转到登录页面', {
            duration: 2000,
            onAfterLeave: () => router.push('/login')
          })
        }, 2000)
        break

      case ErrorAction.REFRESH:
        message.warning(error.userMessage, {
          duration: 5000
        })
        setTimeout(() => {
          message.info('页面将在3秒后刷新', {
            duration: 3000,
            onAfterLeave: () => window.location.reload()
          })
        }, 1000)
        break

      case ErrorAction.CONTACT_SUPPORT:
        message.error(error.userMessage, {
          duration: 10000
        })
        setTimeout(() => {
          message.info('发送邮件到 support@example.com', {
            duration: 5000,
            onAfterLeave: () => window.open('mailto:support@example.com')
          })
        }, 2000)
        break

      default:
        if (messageType === 'error') {
          message.error(error.userMessage)
        } else if (messageType === 'warning') {
          message.warning(error.userMessage)
        } else {
          message.info(error.userMessage)
        }
    }
  }

  /**
   * 获取消息类型
   */
  const getMessageType = (severity: ErrorSeverity): string => {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        return 'error'
      case ErrorSeverity.MEDIUM:
        return 'warning'
      case ErrorSeverity.LOW:
        return 'info'
      default:
        return 'info'
    }
  }

  /**
   * 创建带有错误处理的操作函数
   */
  const createSafeOperation = <T extends unknown[], R>(
    operation: (...args: T) => Promise<R>,
    context?: Partial<ErrorHandlingOptions>
  ) => {
    return async (...args: T): Promise<R | null> => {
      return withErrorHandling(() => operation(...args), context)
    }
  }

  /**
   * 创建同步安全操作
   */
  const createSafeSyncOperation = <T extends unknown[], R>(
    operation: (...args: T) => R,
    context?: Partial<ErrorHandlingOptions>
  ) => {
    return (...args: T): R | null => {
      try {
        return operation(...args)
      } catch (error) {
        const standardError = handleError(error as RawError, {
          component: context?.component || instance?.type?.name || 'UnknownComponent',
          operation: context?.operation || 'sync_operation'
        })

        errorState.value.currentError = standardError
        errorHistory.value.push(standardError)

        if (context?.showUserNotification !== false) {
          showErrorMessage(standardError)
        }

        return null
      }
    }
  }

  /**
   * 监听特定错误类型
   */
  const listenForErrors = (categories: (ErrorCategory | undefined)[], handler: (error: StandardError) => void) => {
    if (categories.length > 0) {
      const category = categories[0]
      if (category) {
        registerErrorHandler(category, handler)
      }
    }

    onUnmounted(() => {
      // 注意：这里需要一个取消注册的方法
      // 当前实现中，registerHandler没有返回取消函数
      // 可能需要在errorHandler中添加这个功能
    })
  }

  /**
   * 获取错误统计
   */
  const getErrorStats = () => {
    const categoryCount: Record<ErrorCategory, number> = {} as Record<ErrorCategory, number>
    const severityCount: Record<ErrorSeverity, number> = {} as Record<ErrorSeverity, number>

    for (const error of errorHistory.value) {
      categoryCount[error.category] = (categoryCount[error.category] || 0) + 1
      severityCount[error.severity] = (severityCount[error.severity] || 0) + 1
    }

    return {
      total: errorHistory.value.length,
      current: hasError.value ? 1 : 0,
      byCategory: categoryCount,
      bySeverity: severityCount
    }
  }

  /**
   * 清除错误历史
   */
  const clearHistory = () => {
    errorHistory.value = []
  }

  // 组件卸载时清理
  onUnmounted(() => {
    if (errorState.value.currentError) {
      clearError()
    }
  })

  return {
    // 状态
    errorState: computed(() => errorState.value),
    hasError,
    canRetry,
    errorSeverity,
    errorMessage,
    errorCode,
    errorHistory: computed(() => errorHistory.value),

    // 方法
    withErrorHandling,
    catchSyncError,
    handleManualError,
    retry,
    clearError,
    createSafeOperation,
    createSafeSyncOperation,
    listenForErrors,
    getErrorStats,
    clearHistory
  }
}

/**
 * 全局错误处理 Hook
 */
export function useGlobalErrorHandler() {
  const globalErrors = ref<StandardError[]>([])
  const unhandledErrors = ref<StandardError[]>([])

  // 监听全局错误事件
  const handleGlobalError = (event: CustomEvent) => {
    const error = event.detail as StandardError
    globalErrors.value.push(error)

    if (error.severity === ErrorSeverity.CRITICAL || error.severity === ErrorSeverity.HIGH) {
      unhandledErrors.value.push(error)
    }
  }

  // 注册全局事件监听器
  if (typeof window !== 'undefined') {
    window.addEventListener('matrix-error', handleGlobalError as EventListener)
  }

  // 清理函数
  const cleanup = () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('matrix-error', handleGlobalError as EventListener)
    }
  }

  return {
    globalErrors: computed(() => globalErrors.value),
    unhandledErrors: computed(() => unhandledErrors.value),
    hasGlobalErrors: computed(() => globalErrors.value.length > 0),
    hasUnhandledErrors: computed(() => unhandledErrors.value.length > 0),
    cleanup
  }
}

/**
 * 网络错误专用 Hook
 */
export function useNetworkErrorHandler() {
  const { withErrorHandling, handleManualError, ...rest } = useErrorHandler({
    component: 'Network',
    showUserNotification: true
  })

  const handleNetworkError = (error: unknown) => {
    return handleManualError(error as RawError, {
      operation: 'network_request',
      onError: (standardError) => {
        // 可以在这里添加网络错误特有的处理逻辑
        // 例如检查网络状态、显示网络连接提示等
        logger.debug('Network error occurred:', standardError)
      }
    })
  }

  const safeNetworkRequest = async <T>(
    request: () => Promise<T>,
    context?: Partial<ErrorHandlingOptions>
  ): Promise<T | null> => {
    return withErrorHandling(request, {
      operation: 'network_request',
      ...context
    })
  }

  return {
    ...rest,
    handleNetworkError,
    safeNetworkRequest
  }
}
