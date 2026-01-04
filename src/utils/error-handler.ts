/**
 * 统一错误处理模块
 * 整合了以下模块的功能：
 * - src/utils/errorHandler.ts (MatrixErrorHandler 类)
 * - src/utils/MatrixErrorHandler.ts (错误分类和用户消息)
 * - src/utils/errorLogManager.ts (错误日志管理)
 * - src/utils/ErrorReporter.ts (错误报告)
 *
 * @module error-handler
 */

import { logger, toError } from '@/utils/logger'

// ============================================================================
// 类型定义
// ============================================================================

// Vite 环境变量类型定义
interface ImportMetaEnv {
  DEV?: boolean
  MODE?: string
  PROD?: boolean
  [key: string]: string | boolean | undefined
}

interface ImportMetaWithEnv {
  env?: ImportMetaEnv
}

// Window全局扩展接口（用于调试）
interface WindowWithErrorHandlers extends Window {
  unifiedErrorHandler?: UnifiedErrorHandler
  getErrorStats?: () => ErrorStats
  getRecentErrors?: (limit?: number) => ErrorEntry[]
  [key: string]: unknown
}

// ============================================================================
// 枚举定义 (合并所有错误类别)
// ============================================================================

/**
 * 统一的错误类别枚举
 * 合并了 errorHandler.ts, errorLogManager.ts, ErrorReporter.ts 的类别
 */
export enum ErrorCategory {
  // 网络相关
  NETWORK = 'network',
  TIMEOUT = 'timeout',
  CONNECTION = 'connection',

  // 认证相关
  AUTHENTICATION = 'authentication',
  AUTH = 'auth', // 别名，保持向后兼容
  PERMISSION = 'permission',
  TOKEN_EXPIRED = 'token_expired',

  // 验证和资源
  VALIDATION = 'validation',
  RESOURCE = 'resource',
  NOT_FOUND = 'not_found',
  CONFLICT = 'conflict',
  LIMIT_EXCEEDED = 'limit_exceeded',

  // 加密和安全
  ENCRYPTION = 'encryption',

  // 实时通信
  RTC = 'rtc',
  RTC_CONNECTION = 'rtc_connection',
  RTC_MEDIA = 'rtc_media',
  RTC_PERMISSION = 'rtc_permission',

  // Matrix 特定
  MATRIX_API = 'matrix_api',
  MATRIX_SYNC = 'matrix_sync',
  MATRIX_ENCRYPTION = 'matrix_encryption',
  MATRIX_MEDIA = 'matrix_media',
  SYNAPSE_API = 'synapse_api',

  // 功能相关
  SEARCH = 'search',
  REACTIONS = 'reactions',
  PUSH_RULES = 'push_rules',

  // 系统相关
  STORAGE = 'storage',
  INDEXED_DB = 'indexed_db',
  MEMORY = 'memory',
  SYSTEM = 'system',
  CLIENT = 'client',
  SERVER = 'server',

  // 未知
  UNKNOWN = 'unknown'
}

/**
 * 错误严重程度
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * 建议的错误处理动作
 */
export enum ErrorAction {
  RETRY = 'retry',
  REFRESH = 'refresh',
  REAUTH = 'reauth',
  CONTACT_SUPPORT = 'contact_support',
  IGNORE = 'ignore',
  DEFAULT = 'default'
}

/**
 * Matrix 错误代码枚举 (从 MatrixErrorHandler.ts)
 */
export enum MatrixErrorCode {
  // 网络错误
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  NETWORK_OFFLINE = 'NETWORK_OFFLINE',
  NETWORK_CONNECTION_REFUSED = 'NETWORK_CONNECTION_REFUSED',

  // 认证错误
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  AUTH_FORBIDDEN = 'AUTH_FORBIDDEN',

  // 房间错误
  ROOM_NOT_FOUND = 'ROOM_NOT_FOUND',
  ROOM_ACCESS_DENIED = 'ROOM_ACCESS_DENIED',
  ROOM_ALREADY_JOINED = 'ROOM_ALREADY_JOINED',

  // 消息错误
  MESSAGE_SEND_FAILED = 'MESSAGE_SEND_FAILED',
  MESSAGE_TOO_LARGE = 'MESSAGE_TOO_LARGE',

  // 加密错误
  E2EE_DEVICE_NOT_VERIFIED = 'E2EE_DEVICE_NOT_VERIFIED',
  E2EE_KEY_NOT_FOUND = 'E2EE_KEY_NOT_FOUND',

  // 通用错误
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  SERVER_ERROR = 'SERVER_ERROR'
}

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 错误上下文
 */
export interface ErrorContext {
  component?: string | undefined
  operation?: string | undefined
  userId?: string | undefined
  roomId?: string | undefined
  sessionId?: string | undefined
  requestId?: string | undefined
  timestamp?: number | undefined
  userAgent?: string | undefined
  url?: string | undefined
  stackTrace?: string | undefined
  additionalData?: Record<string, unknown> | undefined
  [key: string]: unknown
}

/**
 * 原始错误类型
 */
export type RawError = Error | ({ message?: string | undefined; stack?: string | undefined } & Record<string, unknown>)

/**
 * 标准化错误接口
 */
export interface StandardError {
  id: string
  category: ErrorCategory
  severity: ErrorSeverity
  code: string
  message: string
  originalError?: RawError | undefined
  context: ErrorContext
  suggestedAction: ErrorAction
  userMessage: string
  technicalDetails?: string | undefined
  recoverable: boolean
  retryable: boolean
  maxRetries?: number | undefined
  currentRetry?: number | undefined
  fingerprint?: string | undefined
  count?: number | undefined
  firstSeen?: number | undefined
  lastSeen?: number | undefined
  resolved?: boolean | undefined
}

/**
 * 错误日志条目 (从 errorLogManager.ts)
 */
export interface ErrorEntry {
  id: string
  category: ErrorCategory
  severity: ErrorSeverity
  message: string
  stack?: string | undefined
  url?: string | undefined
  timestamp: number
  count: number
  firstSeen: number
  lastSeen: number
  resolved?: boolean | undefined
  resolutionTime?: number | undefined
  userFeedback?: 'positive' | 'negative' | 'neutral' | undefined
}

/**
 * 错误统计
 */
export interface ErrorStats {
  total: number
  byCategory: Partial<Record<ErrorCategory, number>>
  bySeverity: Record<ErrorSeverity, number>
  activeCount: number
  resolvedCount: number
  matrixApiErrors?: number
  synapseApiErrors?: number
  networkErrors?: number
}

/**
 * 错误处理器配置
 */
export interface ErrorHandlerConfig {
  enableLogging: boolean
  enableReporting: boolean
  enableUserNotifications: boolean
  maxLogEntries: number
  logRetentionTime: number
  reportEndpoint?: string
  enableTelemetry: boolean
}

/**
 * Matrix 错误接口 (从 MatrixErrorHandler.ts)
 */
export interface MatrixError {
  code: MatrixErrorCode
  message: string
  userMessage: string
  originalError?: Error | undefined
  details?: Record<string, unknown> | undefined
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 检查是否有特定属性
 */
function hasProperty<K extends PropertyKey>(obj: unknown, key: K): obj is Record<K, unknown> {
  return typeof obj === 'object' && obj !== null && key in obj
}

/**
 * 获取错误代码
 */
function getErrorCode(error: RawError): string | undefined {
  if (hasProperty(error, 'code')) {
    const code = error.code
    return typeof code === 'string' ? code : undefined
  }
  return undefined
}

/**
 * 获取错误名称
 */
function getErrorName(error: RawError): string | undefined {
  if (error instanceof Error) {
    return error.name
  }
  if (hasProperty(error, 'name')) {
    const name = error.name
    return typeof name === 'string' ? name : undefined
  }
  return undefined
}

/**
 * 获取错误上下文
 */
function getErrorContext(error: RawError): Record<string, unknown> | undefined {
  if (hasProperty(error, 'context')) {
    const context = error.context
    return typeof context === 'object' && context !== null ? (context as Record<string, unknown>) : undefined
  }
  return undefined
}

/**
 * 检查错误消息是否包含指定关键词（不区分大小写）
 */
function messageContains(message: string, keywords: string[]): boolean {
  const lowerMessage = message.toLowerCase()
  return keywords.some((keyword) => lowerMessage.includes(keyword.toLowerCase()))
}

/**
 * 生成错误 ID
 */
function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * 生成错误指纹
 */
function generateFingerprint(error: RawError, category: ErrorCategory, context: ErrorContext): string {
  const errorName = getErrorName(error) || 'Error'
  const parts = [errorName, category, context.userId || '', context.roomId || '', context.requestId || '']

  if (error instanceof Error && error.stack) {
    const stackLines = error.stack.split('\n').slice(0, 5)
    parts.push(...stackLines)
  }

  // Simple hash function
  let hash = 0
  const str = parts.join('|')
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

// ============================================================================
// 错误分类逻辑 (合并 MatrixErrorHandler.ts 和 errorHandler.ts)
// ============================================================================

/**
 * 分类错误并返回 MatrixErrorCode
 */
function classifyMatrixError(errorMessage: string): MatrixErrorCode {
  // 网络错误检测
  if (messageContains(errorMessage, ['timeout', 'timed out', 'etimedout', 'request timeout'])) {
    return MatrixErrorCode.NETWORK_TIMEOUT
  }

  if (messageContains(errorMessage, ['connection refused', 'econnrefused', 'econnreset', 'enotfound'])) {
    return MatrixErrorCode.NETWORK_CONNECTION_REFUSED
  }

  if (
    messageContains(errorMessage, [
      'network',
      'fetch',
      'failed to fetch',
      'network request failed',
      'net::err',
      'networkerror'
    ])
  ) {
    return MatrixErrorCode.NETWORK_OFFLINE
  }

  // 认证错误检测
  if (
    messageContains(errorMessage, [
      'invalid password',
      'invalid credentials',
      'wrong password',
      'm_invalid_username',
      'user not found'
    ])
  ) {
    return MatrixErrorCode.AUTH_INVALID_CREDENTIALS
  }

  if (messageContains(errorMessage, ['m_unknown_token', '401', 'unauthorized', 'token expired', 'invalid token'])) {
    return MatrixErrorCode.AUTH_TOKEN_EXPIRED
  }

  if (messageContains(errorMessage, ['m_forbidden', '403', 'forbidden'])) {
    return MatrixErrorCode.AUTH_FORBIDDEN
  }

  // 房间错误检测
  if (messageContains(errorMessage, ['m_not_found', 'room not found', 'unknown room'])) {
    return MatrixErrorCode.ROOM_NOT_FOUND
  }

  if (messageContains(errorMessage, ['m_guest_access_forbidden', 'not invited', 'cannot join'])) {
    return MatrixErrorCode.ROOM_ACCESS_DENIED
  }

  if (messageContains(errorMessage, ['already joined', 'already in room', 'm_already_joined'])) {
    return MatrixErrorCode.ROOM_ALREADY_JOINED
  }

  // 消息错误检测
  if (messageContains(errorMessage, ['too large', 'm_too_large', 'payload too large', 'content too large'])) {
    return MatrixErrorCode.MESSAGE_TOO_LARGE
  }

  if (messageContains(errorMessage, ['send failed', 'failed to send', 'message not sent'])) {
    return MatrixErrorCode.MESSAGE_SEND_FAILED
  }

  // 加密错误检测
  if (messageContains(errorMessage, ['device not verified', 'unverified device', 'verification required'])) {
    return MatrixErrorCode.E2EE_DEVICE_NOT_VERIFIED
  }

  if (messageContains(errorMessage, ['key not found', 'missing key', 'no key', 'unknown key'])) {
    return MatrixErrorCode.E2EE_KEY_NOT_FOUND
  }

  // 服务器错误检测
  if (messageContains(errorMessage, ['500', '502', '503', '504', 'internal server error', 'server error'])) {
    return MatrixErrorCode.SERVER_ERROR
  }

  return MatrixErrorCode.UNKNOWN_ERROR
}

/**
 * 分析错误类型和属性
 */
function analyzeError(error: RawError): {
  category: ErrorCategory
  severity: ErrorSeverity
  retryable: boolean
  maxRetries: number
} {
  const code = getErrorCode(error)
  const name = getErrorName(error)
  const context = getErrorContext(error)
  const message = error instanceof Error ? error.message : (error.message ?? String(error))

  // 网络错误
  if (name === 'NetworkError' || code === 'NETWORK_ERROR' || messageContains(message, ['network', 'fetch failed'])) {
    return { category: ErrorCategory.NETWORK, severity: ErrorSeverity.MEDIUM, retryable: true, maxRetries: 3 }
  }

  // 超时错误
  if (name === 'TimeoutError' || code === 'TIMEOUT' || messageContains(message, ['timeout'])) {
    return { category: ErrorCategory.TIMEOUT, severity: ErrorSeverity.MEDIUM, retryable: true, maxRetries: 2 }
  }

  // 认证错误
  if (code === 'M_FORBIDDEN' || code === 'M_UNAUTHORIZED' || messageContains(message, ['forbidden', 'unauthorized'])) {
    return { category: ErrorCategory.AUTHENTICATION, severity: ErrorSeverity.HIGH, retryable: false, maxRetries: 0 }
  }

  // 权限错误
  if (code === 'M_PERMISSION_DENIED') {
    return { category: ErrorCategory.PERMISSION, severity: ErrorSeverity.HIGH, retryable: false, maxRetries: 0 }
  }

  // 验证错误
  if (code === 'M_INVALID_PARAM' || name === 'ValidationError') {
    return { category: ErrorCategory.VALIDATION, severity: ErrorSeverity.LOW, retryable: false, maxRetries: 0 }
  }

  // 资源错误
  if (code === 'M_NOT_FOUND' || name === 'NotFoundError') {
    return { category: ErrorCategory.RESOURCE, severity: ErrorSeverity.MEDIUM, retryable: false, maxRetries: 0 }
  }

  // 加密错误
  if (name?.includes('Crypto') || code?.includes('CRYPTO')) {
    return { category: ErrorCategory.ENCRYPTION, severity: ErrorSeverity.HIGH, retryable: true, maxRetries: 1 }
  }

  // RTC错误
  if (name?.includes('RTC') || code?.includes('RTC')) {
    return { category: ErrorCategory.RTC, severity: ErrorSeverity.MEDIUM, retryable: true, maxRetries: 2 }
  }

  // 搜索错误
  if (
    (context?.operation && typeof context.operation === 'string' && context.operation.includes('search')) ||
    code?.includes('SEARCH')
  ) {
    return { category: ErrorCategory.SEARCH, severity: ErrorSeverity.LOW, retryable: true, maxRetries: 1 }
  }

  // 存储错误
  if (name === 'QuotaExceededError' || code === 'STORAGE_FULL') {
    return { category: ErrorCategory.STORAGE, severity: ErrorSeverity.HIGH, retryable: false, maxRetries: 0 }
  }

  // Matrix API 错误
  if (messageContains(message, ['/_matrix/', 'matrix'])) {
    return { category: ErrorCategory.MATRIX_API, severity: ErrorSeverity.MEDIUM, retryable: true, maxRetries: 2 }
  }

  // Synapse API 错误
  if (messageContains(message, ['/_synapse/', 'synapse'])) {
    return { category: ErrorCategory.SYNAPSE_API, severity: ErrorSeverity.MEDIUM, retryable: true, maxRetries: 2 }
  }

  // 服务器错误
  if (messageContains(message, ['500', '502', '503', '504', 'internal server error'])) {
    return { category: ErrorCategory.SERVER, severity: ErrorSeverity.HIGH, retryable: true, maxRetries: 2 }
  }

  // 默认未知错误
  return { category: ErrorCategory.UNKNOWN, severity: ErrorSeverity.MEDIUM, retryable: true, maxRetries: 1 }
}

// ============================================================================
// 用户消息生成
// ============================================================================

/**
 * 获取用户友好的错误消息
 */
function getUserMessage(category: ErrorCategory): string {
  const userMessages: Record<ErrorCategory, string> = {
    [ErrorCategory.NETWORK]: '网络连接出现问题，请检查您的网络连接',
    [ErrorCategory.TIMEOUT]: '操作超时，请稍后重试',
    [ErrorCategory.CONNECTION]: '无法连接到服务器，请稍后重试',
    [ErrorCategory.AUTHENTICATION]: '身份验证失败，请重新登录',
    [ErrorCategory.AUTH]: '身份验证失败，请重新登录',
    [ErrorCategory.PERMISSION]: '您没有执行此操作的权限',
    [ErrorCategory.TOKEN_EXPIRED]: '登录已过期，请重新登录',
    [ErrorCategory.VALIDATION]: '输入的数据格式不正确',
    [ErrorCategory.RESOURCE]: '请求的资源未找到',
    [ErrorCategory.NOT_FOUND]: '请求的资源未找到',
    [ErrorCategory.CONFLICT]: '操作冲突，请刷新后重试',
    [ErrorCategory.LIMIT_EXCEEDED]: '已超出限制',
    [ErrorCategory.ENCRYPTION]: '加密操作失败',
    [ErrorCategory.RTC]: '实时通话连接出现问题',
    [ErrorCategory.RTC_CONNECTION]: '实时通话连接失败',
    [ErrorCategory.RTC_MEDIA]: '媒体设备访问失败',
    [ErrorCategory.RTC_PERMISSION]: '需要媒体设备权限',
    [ErrorCategory.MATRIX_API]: 'Matrix 服务暂时不可用',
    [ErrorCategory.MATRIX_SYNC]: '同步服务出现问题',
    [ErrorCategory.MATRIX_ENCRYPTION]: '端到端加密出现问题',
    [ErrorCategory.MATRIX_MEDIA]: '媒体服务出现问题',
    [ErrorCategory.SYNAPSE_API]: '服务器 API 暂时不可用',
    [ErrorCategory.SEARCH]: '搜索功能暂时不可用',
    [ErrorCategory.REACTIONS]: '消息反应功能出现异常',
    [ErrorCategory.PUSH_RULES]: '通知规则设置失败',
    [ErrorCategory.STORAGE]: '存储空间不足',
    [ErrorCategory.INDEXED_DB]: '本地数据库出现问题',
    [ErrorCategory.MEMORY]: '内存不足',
    [ErrorCategory.SYSTEM]: '系统错误',
    [ErrorCategory.CLIENT]: '客户端错误',
    [ErrorCategory.SERVER]: '服务器错误，请稍后重试',
    [ErrorCategory.UNKNOWN]: '发生了未知错误'
  }

  return userMessages[category] || userMessages[ErrorCategory.UNKNOWN]
}

/**
 * 获取 Matrix 错误代码对应的用户消息
 */
function getMatrixUserMessage(code: MatrixErrorCode, fallbackMessage: string): string {
  const defaultMessages: Record<MatrixErrorCode, string> = {
    [MatrixErrorCode.NETWORK_TIMEOUT]: '网络请求超时，请检查网络连接后重试',
    [MatrixErrorCode.NETWORK_OFFLINE]: '网络连接已断开，请检查网络设置',
    [MatrixErrorCode.NETWORK_CONNECTION_REFUSED]: '无法连接到服务器，请稍后重试',
    [MatrixErrorCode.AUTH_INVALID_CREDENTIALS]: '用户名或密码错误',
    [MatrixErrorCode.AUTH_TOKEN_EXPIRED]: '登录已过期，请重新登录',
    [MatrixErrorCode.AUTH_FORBIDDEN]: '没有权限执行此操作',
    [MatrixErrorCode.ROOM_NOT_FOUND]: '房间不存在或已被删除',
    [MatrixErrorCode.ROOM_ACCESS_DENIED]: '无法加入此房间',
    [MatrixErrorCode.ROOM_ALREADY_JOINED]: '您已经在此房间中',
    [MatrixErrorCode.MESSAGE_SEND_FAILED]: '消息发送失败，请重试',
    [MatrixErrorCode.MESSAGE_TOO_LARGE]: '消息内容过大，请减少内容后重试',
    [MatrixErrorCode.E2EE_DEVICE_NOT_VERIFIED]: '设备未验证，请先完成设备验证',
    [MatrixErrorCode.E2EE_KEY_NOT_FOUND]: '加密密钥丢失，请恢复密钥备份',
    [MatrixErrorCode.SERVER_ERROR]: '服务器错误，请稍后重试',
    [MatrixErrorCode.UNKNOWN_ERROR]: fallbackMessage || '发生未知错误'
  }

  return defaultMessages[code] || fallbackMessage || '发生未知错误'
}

/**
 * 获取建议的操作
 */
function getSuggestedAction(category: ErrorCategory): ErrorAction {
  const actionMap: Record<ErrorCategory, ErrorAction> = {
    [ErrorCategory.NETWORK]: ErrorAction.RETRY,
    [ErrorCategory.TIMEOUT]: ErrorAction.RETRY,
    [ErrorCategory.CONNECTION]: ErrorAction.RETRY,
    [ErrorCategory.AUTHENTICATION]: ErrorAction.REAUTH,
    [ErrorCategory.AUTH]: ErrorAction.REAUTH,
    [ErrorCategory.PERMISSION]: ErrorAction.CONTACT_SUPPORT,
    [ErrorCategory.TOKEN_EXPIRED]: ErrorAction.REAUTH,
    [ErrorCategory.VALIDATION]: ErrorAction.DEFAULT,
    [ErrorCategory.RESOURCE]: ErrorAction.REFRESH,
    [ErrorCategory.NOT_FOUND]: ErrorAction.REFRESH,
    [ErrorCategory.CONFLICT]: ErrorAction.REFRESH,
    [ErrorCategory.LIMIT_EXCEEDED]: ErrorAction.DEFAULT,
    [ErrorCategory.ENCRYPTION]: ErrorAction.REAUTH,
    [ErrorCategory.RTC]: ErrorAction.RETRY,
    [ErrorCategory.RTC_CONNECTION]: ErrorAction.RETRY,
    [ErrorCategory.RTC_MEDIA]: ErrorAction.DEFAULT,
    [ErrorCategory.RTC_PERMISSION]: ErrorAction.DEFAULT,
    [ErrorCategory.MATRIX_API]: ErrorAction.RETRY,
    [ErrorCategory.MATRIX_SYNC]: ErrorAction.RETRY,
    [ErrorCategory.MATRIX_ENCRYPTION]: ErrorAction.REAUTH,
    [ErrorCategory.MATRIX_MEDIA]: ErrorAction.RETRY,
    [ErrorCategory.SYNAPSE_API]: ErrorAction.RETRY,
    [ErrorCategory.SEARCH]: ErrorAction.RETRY,
    [ErrorCategory.REACTIONS]: ErrorAction.RETRY,
    [ErrorCategory.PUSH_RULES]: ErrorAction.REFRESH,
    [ErrorCategory.STORAGE]: ErrorAction.CONTACT_SUPPORT,
    [ErrorCategory.INDEXED_DB]: ErrorAction.REFRESH,
    [ErrorCategory.MEMORY]: ErrorAction.REFRESH,
    [ErrorCategory.SYSTEM]: ErrorAction.REFRESH,
    [ErrorCategory.CLIENT]: ErrorAction.REFRESH,
    [ErrorCategory.SERVER]: ErrorAction.RETRY,
    [ErrorCategory.UNKNOWN]: ErrorAction.RETRY
  }

  return actionMap[category] || ErrorAction.DEFAULT
}

// ============================================================================
// 统一错误处理器类
// ============================================================================

/**
 * 统一错误处理器
 * 整合了 errorHandler.ts, errorLogManager.ts, ErrorReporter.ts 的功能
 */
export class UnifiedErrorHandler {
  private static instance: UnifiedErrorHandler
  private config: ErrorHandlerConfig
  private errorLog: ErrorEntry[] = []
  private activeErrors: Map<string, StandardError> = new Map()
  private retryAttempts: Map<string, number> = new Map()
  private userCallbacks: Map<ErrorCategory, (error: StandardError) => void> = new Map()
  private customHandlers: Map<string, (error: StandardError) => void> = new Map()
  private cleanupInterval: ReturnType<typeof setInterval> | null = null

  private constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = {
      enableLogging: true,
      enableReporting: false,
      enableUserNotifications: true,
      maxLogEntries: 1000,
      logRetentionTime: 24 * 60 * 60 * 1000, // 24小时
      enableTelemetry: true,
      ...config
    }

    this.setupGlobalErrorHandlers()
    this.startLogCleanup()
  }

  static getInstance(config?: Partial<ErrorHandlerConfig>): UnifiedErrorHandler {
    if (!UnifiedErrorHandler.instance) {
      UnifiedErrorHandler.instance = new UnifiedErrorHandler(config)
    }
    return UnifiedErrorHandler.instance
  }

  /**
   * 处理错误的主要入口点
   */
  handleError(error: RawError, context: Partial<ErrorContext> = {}, suggestedAction?: ErrorAction): StandardError {
    const standardError = this.standardizeError(error, context, suggestedAction)

    // 记录错误
    if (this.config.enableLogging) {
      this.logError(standardError)
    }

    // 执行自定义处理器
    this.executeCustomHandler(standardError)

    // 发送用户通知
    if (this.config.enableUserNotifications) {
      this.notifyUser(standardError)
    }

    // 上报错误（如果启用）
    if (this.config.enableReporting) {
      this.reportError(standardError)
    }

    // 记录活跃错误
    this.activeErrors.set(standardError.id, standardError)

    return standardError
  }

  /**
   * 标准化错误格式
   */
  private standardizeError(
    error: RawError,
    context: Partial<ErrorContext>,
    suggestedActionOverride?: ErrorAction
  ): StandardError {
    const errorId = generateErrorId()
    const timestamp = Date.now()
    const message = error instanceof Error ? error.message : (error.message ?? String(error))

    // 分析错误类型和严重程度
    const { category, severity, retryable, maxRetries } = analyzeError(error)

    // 生成错误代码
    const categoryPrefix = category.substring(0, 3).toUpperCase()
    const errorCode = getErrorCode(error)
    const errorName = getErrorName(error)
    const errorType = errorCode || errorName || 'UNKNOWN'
    const code = `${categoryPrefix}_${errorType}_${timestamp.toString(36)}`

    // 生成用户友好的消息
    const userMessage = getUserMessage(category)

    // 生成指纹
    const fullContext: ErrorContext = {
      timestamp,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      url: typeof window !== 'undefined' ? window.location.href : '',
      ...context
    }
    const fingerprint = generateFingerprint(error, category, fullContext)

    // 生成技术详情（仅开发模式）
    let technicalDetails: string | undefined
    const meta = import.meta as unknown as ImportMetaWithEnv
    if (typeof import.meta !== 'undefined' && meta.env?.DEV) {
      technicalDetails = `${errorName || 'Error'}: ${message}`
      if (error instanceof Error && error.stack) {
        technicalDetails += `\nStack: ${error.stack}`
      }
    }

    const standardError: StandardError = {
      id: errorId,
      category,
      severity,
      code,
      message,
      originalError: error,
      context: fullContext,
      suggestedAction: suggestedActionOverride || getSuggestedAction(category),
      userMessage,
      technicalDetails,
      recoverable: retryable,
      retryable,
      maxRetries,
      currentRetry: 0,
      fingerprint,
      count: 1,
      firstSeen: timestamp,
      lastSeen: timestamp,
      resolved: false
    }

    return standardError
  }

  /**
   * 记录错误日志
   */
  private logError(error: StandardError): void {
    const logEntry: ErrorEntry = {
      id: error.id,
      category: error.category,
      severity: error.severity,
      message: error.message,
      stack: error.originalError instanceof Error ? error.originalError.stack : undefined,
      url: error.context.url,
      timestamp: error.context.timestamp || Date.now(),
      count: 1,
      firstSeen: error.firstSeen || Date.now(),
      lastSeen: error.lastSeen || Date.now(),
      resolved: false
    }

    // 检查是否已存在相同指纹的错误
    const existingIndex = this.errorLog.findIndex((e) => e.id === error.fingerprint)
    if (existingIndex >= 0) {
      const existing = this.errorLog[existingIndex]
      if (existing) {
        existing.count++
        existing.lastSeen = Date.now()
      }
    } else {
      this.errorLog.push(logEntry)
    }

    // 控制台输出
    const logMethod = this.getLogMethod(error.severity)
    logMethod(`[Error] ${error.category}/${error.severity}:`, {
      id: error.id,
      message: error.userMessage,
      code: error.code,
      context: error.context
    })

    // 保持日志大小限制
    if (this.errorLog.length > this.config.maxLogEntries) {
      this.errorLog = this.errorLog.slice(-this.config.maxLogEntries)
    }
  }

  /**
   * 获取日志方法
   */
  private getLogMethod(severity: ErrorSeverity): typeof logger.debug {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        return logger.error.bind(logger)
      case ErrorSeverity.MEDIUM:
        return logger.warn.bind(logger)
      case ErrorSeverity.LOW:
        return logger.info.bind(logger)
      default:
        return logger.debug.bind(logger)
    }
  }

  /**
   * 执行自定义错误处理器
   */
  private executeCustomHandler(error: StandardError): void {
    // 执行全局自定义处理器
    for (const [_key, handler] of this.customHandlers) {
      try {
        handler(error)
      } catch (handlerError) {
        logger.error('Custom error handler failed:', toError(handlerError))
      }
    }

    // 执行分类特定处理器
    const categoryHandler = this.userCallbacks.get(error.category)
    if (categoryHandler) {
      try {
        categoryHandler(error)
      } catch (handlerError) {
        logger.error('Category error handler failed:', toError(handlerError))
      }
    }
  }

  /**
   * 通知用户
   */
  private notifyUser(error: StandardError): void {
    if (typeof window !== 'undefined') {
      const win = window as Window & { $message?: Record<string, (msg: string) => void> }
      if (win.$message) {
        const messageType = this.getMessageType(error.severity)
        const messageFn = win.$message[messageType]
        if (messageFn) {
          messageFn(error.userMessage)
        }
      }

      // 触发自定义错误事件
      const event = new CustomEvent('unified-error', {
        detail: {
          id: error.id,
          category: error.category,
          severity: error.severity,
          message: error.userMessage,
          suggestedAction: error.suggestedAction
        }
      })
      window.dispatchEvent(event)
    }
  }

  /**
   * 获取消息类型
   */
  private getMessageType(severity: ErrorSeverity): string {
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
   * 上报错误
   */
  private async reportError(error: StandardError): Promise<void> {
    if (!this.config.reportEndpoint) return

    try {
      await fetch(this.config.reportEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          errorId: error.id,
          category: error.category,
          severity: error.severity,
          code: error.code,
          message: error.message,
          context: error.context,
          timestamp: error.context.timestamp
        })
      })
    } catch (reportError) {
      logger.error('Failed to report error:', toError(reportError))
    }
  }

  /**
   * 重试操作
   */
  async retryError<T = unknown>(errorId: string, retryFn: () => Promise<T>): Promise<T> {
    const error = this.activeErrors.get(errorId)
    if (!error || !error.retryable) {
      throw new Error('Error is not retryable')
    }

    const currentRetry = this.retryAttempts.get(errorId) || 0
    if (currentRetry >= (error.maxRetries || 3)) {
      throw new Error('Maximum retry attempts exceeded')
    }

    this.retryAttempts.set(errorId, currentRetry + 1)

    try {
      const result = await retryFn()
      this.resolveError(errorId, 'positive')
      return result
    } catch (retryError) {
      const standardError = this.handleError(retryError as RawError, error.context, ErrorAction.RETRY)
      standardError.currentRetry = currentRetry + 1
      throw standardError
    }
  }

  /**
   * 解决错误
   */
  resolveError(errorId: string, feedback?: 'positive' | 'negative' | 'neutral'): void {
    const logEntry = this.errorLog.find((entry) => entry.id === errorId)
    if (logEntry) {
      logEntry.resolved = true
      logEntry.resolutionTime = Date.now()
      if (feedback !== undefined) logEntry.userFeedback = feedback
    }

    this.activeErrors.delete(errorId)
    this.retryAttempts.delete(errorId)
  }

  /**
   * 注册错误处理器
   */
  registerErrorHandler(category: ErrorCategory, handler: (error: StandardError) => void): void {
    this.userCallbacks.set(category, handler)
  }

  /**
   * 注册自定义处理器
   */
  registerCustomHandler(key: string, handler: (error: StandardError) => void): void {
    this.customHandlers.set(key, handler)
  }

  /**
   * 获取错误统计
   */
  getErrorStats(): ErrorStats {
    const byCategory: Partial<Record<ErrorCategory, number>> = {}
    const bySeverity: Record<ErrorSeverity, number> = {
      [ErrorSeverity.LOW]: 0,
      [ErrorSeverity.MEDIUM]: 0,
      [ErrorSeverity.HIGH]: 0,
      [ErrorSeverity.CRITICAL]: 0
    }

    let matrixApiErrors = 0
    let synapseApiErrors = 0
    let networkErrors = 0

    for (const log of this.errorLog) {
      byCategory[log.category] = (byCategory[log.category] || 0) + log.count
      bySeverity[log.severity] += log.count

      if (log.category === ErrorCategory.MATRIX_API) matrixApiErrors += log.count
      if (log.category === ErrorCategory.SYNAPSE_API) synapseApiErrors += log.count
      if (log.category === ErrorCategory.NETWORK) networkErrors += log.count
    }

    return {
      total: this.errorLog.reduce((sum, log) => sum + log.count, 0),
      byCategory,
      bySeverity,
      activeCount: this.activeErrors.size,
      resolvedCount: this.errorLog.filter((log) => log.resolved).length,
      matrixApiErrors,
      synapseApiErrors,
      networkErrors
    }
  }

  /**
   * 获取错误日志
   */
  getErrorLog(limit?: number): ErrorEntry[] {
    if (limit) {
      return this.errorLog.slice(-limit)
    }
    return [...this.errorLog]
  }

  /**
   * 获取最近的错误
   */
  getRecentErrors(limit = 50): ErrorEntry[] {
    return [...this.errorLog].sort((a, b) => b.lastSeen - a.lastSeen).slice(0, limit)
  }

  /**
   * 按类别获取错误
   */
  getErrorsByCategory(category: ErrorCategory): ErrorEntry[] {
    return this.errorLog.filter((e) => e.category === category)
  }

  /**
   * 按严重程度获取错误
   */
  getErrorsBySeverity(severity: ErrorSeverity): ErrorEntry[] {
    return this.errorLog.filter((e) => e.severity === severity)
  }

  /**
   * 清理旧日志
   */
  private startLogCleanup(): void {
    if (typeof window !== 'undefined') {
      this.cleanupInterval = setInterval(
        () => {
          const cutoffTime = Date.now() - this.config.logRetentionTime
          this.errorLog = this.errorLog.filter((log) => log.timestamp > cutoffTime)
        },
        60 * 60 * 1000
      ) // 每小时清理一次
    }
  }

  /**
   * 设置全局错误处理器
   */
  private setupGlobalErrorHandlers(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', (event) => {
        this.handleError(event.reason, {
          component: 'Global',
          operation: 'unhandledrejection'
        })
      })

      window.addEventListener('error', (event) => {
        this.handleError(event.error || new Error(event.message), {
          component: 'Global',
          operation: 'javascript_error',
          additionalData: {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
          }
        })
      })
    }
  }

  /**
   * 清空所有错误
   */
  clear(): void {
    this.errorLog = []
    this.activeErrors.clear()
    this.retryAttempts.clear()
  }

  /**
   * 重置错误处理器
   */
  reset(): void {
    this.clear()
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }

  /**
   * 判断错误是否应该被过滤（开发噪声）
   */
  static isDevNoise(error: Error | string): boolean {
    const message = typeof error === 'string' ? error : error.message
    const lowerMessage = message.toLowerCase()

    return (
      lowerMessage.includes('@vite/client') ||
      lowerMessage.includes('websocket closed without opened') ||
      lowerMessage.includes('failed to connect to websocket') ||
      lowerMessage.includes('net::err_aborted') ||
      lowerMessage.includes('connectionerror: fetch failed') ||
      lowerMessage.includes('transformCallback')
    )
  }
}

// ============================================================================
// Matrix 错误处理器 (从 MatrixErrorHandler.ts)
// ============================================================================

/**
 * Matrix 错误处理器类
 * 提供统一的错误处理、分类和用户消息生成
 */
export class MatrixErrorHandlerClass {
  /**
   * 处理错误并返回标准化的 MatrixError 对象
   */
  static handle(error: unknown): MatrixError {
    let errorString: string
    try {
      errorString = error instanceof Error ? error.message : String(error)
    } catch {
      errorString = 'Unknown error object'
    }
    const originalError = error instanceof Error ? error : new Error(errorString)
    const errorMessage = originalError.message

    logger.error('[MatrixError]', originalError)

    const code = classifyMatrixError(errorMessage)
    const userMessage = getMatrixUserMessage(code, errorMessage)

    return {
      code,
      message: errorMessage,
      userMessage,
      originalError
    }
  }

  /**
   * 创建带有额外详情的错误对象
   */
  static createError(code: MatrixErrorCode, message: string, details?: Record<string, unknown>): MatrixError {
    const userMessage = getMatrixUserMessage(code, message)
    logger.warn(`[MatrixError] Created error: ${code} - ${message}`, details)

    return {
      code,
      message,
      userMessage,
      details
    }
  }

  /**
   * 检查错误是否为网络相关错误
   */
  static isNetworkError(error: MatrixError | MatrixErrorCode): boolean {
    const code = typeof error === 'string' ? error : error.code
    return [
      MatrixErrorCode.NETWORK_TIMEOUT,
      MatrixErrorCode.NETWORK_OFFLINE,
      MatrixErrorCode.NETWORK_CONNECTION_REFUSED
    ].includes(code)
  }

  /**
   * 检查错误是否为认证相关错误
   */
  static isAuthError(error: MatrixError | MatrixErrorCode): boolean {
    const code = typeof error === 'string' ? error : error.code
    return [
      MatrixErrorCode.AUTH_INVALID_CREDENTIALS,
      MatrixErrorCode.AUTH_TOKEN_EXPIRED,
      MatrixErrorCode.AUTH_FORBIDDEN
    ].includes(code)
  }

  /**
   * 检查错误是否为房间相关错误
   */
  static isRoomError(error: MatrixError | MatrixErrorCode): boolean {
    const code = typeof error === 'string' ? error : error.code
    return [
      MatrixErrorCode.ROOM_NOT_FOUND,
      MatrixErrorCode.ROOM_ACCESS_DENIED,
      MatrixErrorCode.ROOM_ALREADY_JOINED
    ].includes(code)
  }

  /**
   * 检查错误是否为加密相关错误
   */
  static isEncryptionError(error: MatrixError | MatrixErrorCode): boolean {
    const code = typeof error === 'string' ? error : error.code
    return [MatrixErrorCode.E2EE_DEVICE_NOT_VERIFIED, MatrixErrorCode.E2EE_KEY_NOT_FOUND].includes(code)
  }

  /**
   * 检查错误是否可重试
   */
  static isRetryable(error: MatrixError | MatrixErrorCode): boolean {
    const code = typeof error === 'string' ? error : error.code
    return [
      MatrixErrorCode.NETWORK_TIMEOUT,
      MatrixErrorCode.NETWORK_OFFLINE,
      MatrixErrorCode.NETWORK_CONNECTION_REFUSED,
      MatrixErrorCode.SERVER_ERROR,
      MatrixErrorCode.MESSAGE_SEND_FAILED
    ].includes(code)
  }
}

// ============================================================================
// 全局实例和便捷函数
// ============================================================================

// 创建全局错误处理器实例
export const unifiedErrorHandler = UnifiedErrorHandler.getInstance()

// 便捷函数 - 统一错误处理
export const handleError = (
  error: RawError,
  context?: Partial<ErrorContext>,
  suggestedAction?: ErrorAction
): StandardError => {
  return unifiedErrorHandler.handleError(error, context, suggestedAction)
}

export const retryError = async <T = unknown>(errorId: string, retryFn: () => Promise<T>): Promise<T> => {
  return unifiedErrorHandler.retryError(errorId, retryFn)
}

export const resolveError = (errorId: string, feedback?: 'positive' | 'negative' | 'neutral'): void => {
  unifiedErrorHandler.resolveError(errorId, feedback)
}

export const registerErrorHandler = (category: ErrorCategory, handler: (error: StandardError) => void): void => {
  unifiedErrorHandler.registerErrorHandler(category, handler)
}

// 便捷函数 - 错误日志
export const logError = (error: Error | string, context?: { url?: string; stack?: string }): void => {
  const rawError = typeof error === 'string' ? new Error(error) : error
  unifiedErrorHandler.handleError(rawError, context)
}

export const getErrorStats = (): ErrorStats => {
  return unifiedErrorHandler.getErrorStats()
}

export const getRecentErrors = (limit?: number): ErrorEntry[] => {
  return unifiedErrorHandler.getRecentErrors(limit)
}

export const getErrorLog = (limit?: number): ErrorEntry[] => {
  return unifiedErrorHandler.getErrorLog(limit)
}

export const isDevNoise = (error: Error | string): boolean => {
  return UnifiedErrorHandler.isDevNoise(error)
}

// 便捷函数 - Matrix 错误处理
export const handleMatrixError = MatrixErrorHandlerClass.handle
export const createMatrixError = MatrixErrorHandlerClass.createError
export const isNetworkError = MatrixErrorHandlerClass.isNetworkError
export const isAuthError = MatrixErrorHandlerClass.isAuthError
export const isRoomError = MatrixErrorHandlerClass.isRoomError
export const isEncryptionError = MatrixErrorHandlerClass.isEncryptionError
export const isRetryableError = MatrixErrorHandlerClass.isRetryable

// ============================================================================
// 向后兼容导出
// ============================================================================

/**
 * @deprecated 请使用 UnifiedErrorHandler 替代
 */
export const matrixErrorHandler = unifiedErrorHandler

/**
 * @deprecated 请使用 MatrixErrorHandlerClass 替代
 */
export const MatrixErrorHandler = MatrixErrorHandlerClass

/**
 * @deprecated 请使用 unifiedErrorHandler 替代
 */
export const errorLogManager = {
  log: logError,
  getStats: getErrorStats,
  getRecentErrors,
  getErrorsByCategory: (category: ErrorCategory) => unifiedErrorHandler.getErrorsByCategory(category),
  getErrorsBySeverity: (severity: ErrorSeverity) => unifiedErrorHandler.getErrorsBySeverity(severity),
  clear: () => unifiedErrorHandler.clear()
}

/**
 * @deprecated 请使用 unifiedErrorHandler 替代
 */
export const globalErrorReporter = {
  report: (
    error: Error | string,
    context?: ErrorContext,
    _category?: ErrorCategory,
    _severity?: ErrorSeverity
  ): string => {
    const rawError = typeof error === 'string' ? new Error(error) : error
    const result = unifiedErrorHandler.handleError(rawError, context)
    return result.id
  },
  resolve: (fingerprint: string) => unifiedErrorHandler.resolveError(fingerprint),
  getError: (fingerprint: string) => unifiedErrorHandler.getErrorLog().find((e) => e.id === fingerprint),
  getAllErrors: () => unifiedErrorHandler.getErrorLog(),
  getErrorsByCategory: (category: ErrorCategory) => unifiedErrorHandler.getErrorsByCategory(category),
  getErrorsBySeverity: (severity: ErrorSeverity) => unifiedErrorHandler.getErrorsBySeverity(severity),
  getErrorStats: () => unifiedErrorHandler.getErrorStats(),
  clear: () => unifiedErrorHandler.clear()
}

export const reportError = (
  error: Error | string,
  context?: ErrorContext,
  category?: ErrorCategory,
  severity?: ErrorSeverity
): Promise<string> => {
  return Promise.resolve(globalErrorReporter.report(error, context, category, severity))
}

// 开发环境暴露到全局对象
const meta = import.meta as unknown as ImportMetaWithEnv
if (typeof import.meta !== 'undefined' && meta.env?.MODE === 'development' && typeof window !== 'undefined') {
  const windowWithHandlers = window as unknown as WindowWithErrorHandlers
  windowWithHandlers.unifiedErrorHandler = unifiedErrorHandler
  windowWithHandlers.getErrorStats = getErrorStats
  windowWithHandlers.getRecentErrors = getRecentErrors
}
