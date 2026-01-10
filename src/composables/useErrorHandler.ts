import { ref, computed, type ComputedRef, type Ref } from 'vue'
import { useDialog, useMessage, type DialogApiInjection, type MessageApiInjection } from 'naive-ui'

export interface ErrorOptions {
  showDialog?: boolean
  showNotification?: boolean
  logToConsole?: boolean
  reportToServer?: boolean
  userMessage?: string
  dialogTitle?: string
  notificationType?: 'error' | 'warning' | 'info'
}

export interface ErrorResult {
  error: Ref<Error | null>
  isError: ComputedRef<boolean>
  handleError: (err: unknown, options?: ErrorOptions) => Promise<void>
  clearError: () => void
}

export interface ErrorHandlerOptions {
  dialog?: DialogApiInjection
  message?: MessageApiInjection
  defaultNotification?: boolean
  defaultDialog?: boolean
  enableReporting?: boolean
  reportingEndpoint?: string
}

/**
 * Error handling composable for consistent error management
 *
 * @example
 * ```ts
 * const { error, isError, handleError, clearError } = useErrorHandler()
 *
 * try {
 *   await someAsyncOperation()
 * } catch (err) {
 *   await handleError(err, {
 *     showDialog: true,
 *     userMessage: '操作失败，请重试'
 *   })
 * }
 * ```
 */
export function useErrorHandler(options: ErrorHandlerOptions = {}): ErrorResult {
  const {
    dialog: providedDialog,
    message: providedMessage,
    defaultNotification = true,
    defaultDialog = false,
    enableReporting = false,
    reportingEndpoint
  } = options

  const dialog = providedDialog || useDialog()
  const message = providedMessage || useMessage()

  const error = ref<Error | null>(null)
  const isError = computed(() => error.value !== null)

  /**
   * Handle error with multiple output options
   */
  const handleError = async (
    err: unknown,
    opts: ErrorOptions = {}
  ): Promise<void> => {
    const {
      showDialog = defaultDialog,
      showNotification = defaultNotification,
      logToConsole = true,
      reportToServer = enableReporting,
      userMessage,
      dialogTitle = '操作失败',
      notificationType = 'error'
    } = opts

    // Normalize error
    const normalizedError = normalizeError(err)
    error.value = normalizedError

    // Console logging
    if (logToConsole) {
      console.error('[Error Handler]:', normalizedError)
      console.error('Stack:', normalizedError.stack)
    }

    // Server reporting
    if (reportToServer && enableReporting) {
      await reportError(normalizedError)
    }

    // Show notification
    if (showNotification) {
      const displayMessage = userMessage || normalizedError.message || '操作失败'

      switch (notificationType) {
        case 'warning':
          message.warning(displayMessage)
          break
        case 'info':
          message.info(displayMessage)
          break
        case 'error':
        default:
          message.error(displayMessage)
          break
      }
    }

    // Show dialog
    if (showDialog) {
      dialog.error({
        title: dialogTitle,
        content: userMessage || normalizedError.message || '操作失败，请稍后重试',
        positiveText: '确定',
        onPositiveClick: () => {
          clearError()
        }
      })
    }
  }

  /**
   * Clear the current error
   */
  const clearError = (): void => {
    error.value = null
  }

  return {
    error,
    isError,
    handleError,
    clearError
  }
}

/**
 * Normalize various error types to Error object
 */
function normalizeError(err: unknown): Error {
  if (err instanceof Error) {
    return err
  }

  if (typeof err === 'string') {
    return new Error(err)
  }

  if (err && typeof err === 'object' && 'message' in err) {
    const message = String(err.message)
    const error = new Error(message)

    // Copy additional properties if present
    if ('stack' in err) {
      error.stack = String(err.stack)
    }

    if ('code' in err) {
      ;(error as any).code = err.code
    }

    return error
  }

  return new Error(String(err))
}

/**
 * Report error to server (for error tracking services like Sentry)
 */
async function reportError(error: Error, endpoint?: string): Promise<void> {
  try {
    // Only report in production
    if (import.meta.env.PROD) {
      // Prepare error payload
      const payload = {
        message: error.message,
        stack: error.stack,
        name: error.name,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        environment: import.meta.env.MODE
      }

      // Send to error tracking service
      if (endpoint) {
        await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        })
      }

      // Integration with error tracking services can be added here
      // Example: Sentry.captureException(error)
    }
  } catch (reportingError) {
    console.error('Failed to report error:', reportingError)
  }
}

// ============================================
// Async Error Handler Wrapper
// ============================================

/**
 * Wrap async function with automatic error handling
 *
 * @example
 * ```ts
 * const safeAsync = withAsyncErrorHandling(
 *   async () => {
 *     return await fetchData()
 *   },
 *   { userMessage: '获取数据失败' }
 * )
 *
 * const result = await safeAsync()
 * ```
 */
export function withAsyncErrorHandling<T>(
  fn: () => Promise<T>,
  errorHandler: ErrorResult,
  options?: ErrorOptions
): () => Promise<T | null> {
  return async (): Promise<T | null> => {
    try {
      return await fn()
    } catch (err) {
      await errorHandler.handleError(err, options)
      return null
    }
  }
}

// ============================================
// Validation Error Handler
// ============================================

export interface ValidationError {
  field: string
  message: string
  code?: string
}

export interface ValidationErrorOptions {
  showInlineErrors?: boolean
  scrollToError?: boolean
}

/**
 * Handle form validation errors
 */
export function useValidationErrorHandler() {
  const errors = ref<Map<string, ValidationError[]>>(new Map())
  const hasErrors = computed(() => errors.value.size > 0)

  const setFieldErrors = (field: string, fieldErrors: ValidationError[]) => {
    errors.value.set(field, fieldErrors)
  }

  const clearFieldErrors = (field?: string) => {
    if (field) {
      errors.value.delete(field)
    } else {
      errors.value.clear()
    }
  }

  const getFieldErrors = (field: string): ValidationError[] => {
    return errors.value.get(field) || []
  }

  const hasFieldError = (field: string): boolean => {
    const fieldErrors = errors.value.get(field)
    return fieldErrors ? fieldErrors.length > 0 : false
  }

  const getFirstFieldError = (field: string): string | undefined => {
    const fieldErrors = errors.value.get(field)
    return fieldErrors?.[0]?.message
  }

  return {
    errors,
    hasErrors,
    setFieldErrors,
    clearFieldErrors,
    getFieldErrors,
    hasFieldError,
    getFirstFieldError
  }
}

// ============================================
// Network Error Handler
// ============================================

export interface NetworkErrorOptions {
  retryable?: boolean
  retryCount?: number
  retryDelay?: number
}

/**
 * Handle network-specific errors with retry capability
 */
export function useNetworkErrorHandler(errorHandler: ErrorResult) {
  const isOnline = computed(() => navigator.onLine)
  const retryCount = ref(0)

  const handleNetworkError = async (
    err: unknown,
    retryableFn?: () => Promise<void>,
    options?: NetworkErrorOptions
  ): Promise<boolean> => {
    const { retryable = true, retryCount: maxRetries = 3, retryDelay = 1000 } = options || {}

    // Check if error is network-related
    if (isNetworkError(err)) {
      if (!isOnline.value) {
        await errorHandler.handleError(err, {
          userMessage: '网络连接已断开，请检查网络设置',
          showDialog: true
        })
        return false
      }

      if (retryable && retryableFn && retryCount.value < maxRetries) {
        retryCount.value++

        await errorHandler.handleError(err, {
          userMessage: `网络错误，正在重试 (${retryCount.value}/${maxRetries})...`,
          showNotification: true,
          notificationType: 'warning'
        })

        await new Promise((resolve) => setTimeout(resolve, retryDelay))

        try {
          await retryableFn()
          retryCount.value = 0
          return true
        } catch {
          return false
        }
      } else {
        await errorHandler.handleError(err, {
          userMessage: '网络请求失败，请稍后重试',
          showDialog: true
        })
        return false
      }
    }

    // Non-network error
    await errorHandler.handleError(err)
    return false
  }

  return {
    isOnline,
    retryCount,
    handleNetworkError
  }
}

/**
 * Check if error is network-related
 */
function isNetworkError(err: unknown): boolean {
  if (err instanceof Error) {
    // Check for common network error patterns
    return (
      err.name === 'TypeError' ||
      err.message.includes('NetworkError') ||
      err.message.includes('Failed to fetch') ||
      err.message.includes('Network request failed')
    )
  }
  return false
}

// ============================================
// Types Export
// ============================================

export type { ErrorOptions, ErrorResult, ErrorHandlerOptions, ValidationErrorOptions }
