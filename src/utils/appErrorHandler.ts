/**
 * 统一的应用错误处理工具
 * 提供一致的错误提示和用户体验
 */

import { useAppStateStore } from '@/stores/appState'
import { msg } from './SafeUI'
import { logger } from './logger'

/**
 * 应用错误类型
 */
export enum AppErrorType {
  // 认证相关
  NOT_LOGGED_IN = 'NOT_LOGGED_IN',
  NOT_READY = 'NOT_READY',
  AUTH_EXPIRED = 'AUTH_EXPIRED',

  // 网络相关
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',

  // 权限相关
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  INSUFFICIENT_PERMISSION = 'INSUFFICIENT_PERMISSION',

  // 资源相关
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_UNAVAILABLE = 'RESOURCE_UNAVAILABLE',

  // 操作相关
  OPERATION_FAILED = 'OPERATION_FAILED',
  OPERATION_CANCELLED = 'OPERATION_CANCELLED',
  INVALID_INPUT = 'INVALID_INPUT',

  // 未知错误
  UNKNOWN = 'UNKNOWN'
}

/**
 * 应用错误类
 */
export class AppError extends Error {
  constructor(
    public type: AppErrorType,
    message: string,
    public originalError?: unknown
  ) {
    super(message)
    this.name = 'AppError'
  }
}

/**
 * 错误处理选项
 */
export interface ErrorHandlerOptions {
  /** 是否显示消息提示 */
  showMessage?: boolean
  /** 是否记录日志 */
  logError?: boolean
  /** 自定义消息 */
  customMessage?: string
  /** 消息类型 */
  messageType?: 'warning' | 'error' | 'info'
}

/**
 * 默认错误提示消息
 */
const DEFAULT_ERROR_MESSAGES: Record<AppErrorType, string> = {
  [AppErrorType.NOT_LOGGED_IN]: '请先登录',
  [AppErrorType.NOT_READY]: '应用正在初始化，请稍后再试',
  [AppErrorType.AUTH_EXPIRED]: '登录已过期，请重新登录',
  [AppErrorType.NETWORK_ERROR]: '网络连接失败，请检查网络设置',
  [AppErrorType.TIMEOUT]: '操作超时，请重试',
  [AppErrorType.PERMISSION_DENIED]: '权限不足',
  [AppErrorType.INSUFFICIENT_PERMISSION]: '权限不足，无法执行此操作',
  [AppErrorType.RESOURCE_NOT_FOUND]: '资源不存在',
  [AppErrorType.RESOURCE_UNAVAILABLE]: '资源暂时不可用',
  [AppErrorType.OPERATION_FAILED]: '操作失败，请重试',
  [AppErrorType.OPERATION_CANCELLED]: '操作已取消',
  [AppErrorType.INVALID_INPUT]: '输入内容无效',
  [AppErrorType.UNKNOWN]: '发生未知错误，请重试'
}

/**
 * 检查应用是否就绪
 * 如果未就绪，显示警告消息并返回 false
 */
export function checkAppReady(): boolean {
  const appStateStore = useAppStateStore()

  if (!appStateStore.isReady) {
    const stateDesc = appStateStore.getStateDescription()
    logger.warn('[AppErrorHandler] Application not ready:', { state: appStateStore.state, description: stateDesc })
    msg.warning(DEFAULT_ERROR_MESSAGES[AppErrorType.NOT_READY])
    return false
  }

  return true
}

/**
 * 检查用户是否已登录
 * 如果未登录，显示警告消息并返回 false
 */
export function checkLoggedIn(): boolean {
  const appStateStore = useAppStateStore()

  if (appStateStore.needsLogin) {
    logger.warn('[AppErrorHandler] User not logged in:', { state: appStateStore.state })
    msg.warning(DEFAULT_ERROR_MESSAGES[AppErrorType.NOT_LOGGED_IN])
    return false
  }

  return true
}

/**
 * 处理应用错误
 */
export function handleAppError(error: unknown, options: ErrorHandlerOptions = {}): void {
  const { showMessage = true, logError = true, customMessage, messageType = 'error' } = options

  // 解析错误类型和消息
  let errorType = AppErrorType.UNKNOWN
  let errorMessage = DEFAULT_ERROR_MESSAGES[AppErrorType.UNKNOWN]

  if (error instanceof AppError) {
    errorType = error.type
    errorMessage = customMessage || error.message
  } else if (error instanceof Error) {
    errorMessage = customMessage || error.message
  } else if (typeof error === 'string') {
    errorMessage = customMessage || error
  }

  // 记录日志
  if (logError) {
    logger.error('[AppErrorHandler]', { errorType, errorMessage, originalError: error })
  }

  // 显示消息
  if (showMessage) {
    if (messageType === 'warning') {
      msg.warning(errorMessage)
    } else if (messageType === 'info') {
      msg.info(errorMessage)
    } else {
      msg.error(errorMessage)
    }
  }
}

/**
 * 包装异步操作，自动处理应用状态检查和错误
 */
export async function withAppCheck<T>(
  operation: () => Promise<T>,
  options: ErrorHandlerOptions = {}
): Promise<T | undefined> {
  // 检查应用状态
  if (!checkAppReady()) {
    return undefined
  }

  try {
    return await operation()
  } catch (error) {
    handleAppError(error, options)
    return undefined
  }
}

/**
 * 创建带应用状态检查的异步函数包装器
 */
export function createAppCheckedOperation<T extends (...args: any[]) => any>(
  fn: T,
  options: ErrorHandlerOptions = {}
): T {
  return (async (...args: Parameters<T>) => {
    if (!checkAppReady()) {
      return undefined
    }

    try {
      return await fn(...args)
    } catch (error) {
      handleAppError(error, options)
      return undefined
    }
  }) as T
}

/**
 * 导出便捷使用的工具函数
 */
export const appErrorHandler = {
  checkReady: checkAppReady,
  checkLoggedIn,
  handleError: handleAppError,
  withCheck: withAppCheck,
  createWrapper: createAppCheckedOperation
}
