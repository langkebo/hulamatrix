/**
 * E2EE 守卫层 - 强制端到端加密验证
 * 拦截所有私密聊天操作，确保强制加密策略
 *
 * @module utils/e2eeGuard
 */

import { SecurityWarningType, type SecurityWarningEvent } from '@/types/private-chat-security'
import { logger } from '@/utils/logger'

/**
 * E2EE 守卫配置
 */
export interface E2EEGuardConfig {
  /** 是否启用强制加密 */
  mandatoryEncryption: boolean
  /** 是否拒绝未加密消息 */
  rejectUnencryptedMessages: boolean
  /** 是否验证加密强度 */
  verifyEncryptionStrength: boolean
  /** 最小加密强度分数 (0-100) */
  minEncryptionStrength: number
  /** 是否启用安全审计 */
  enableAuditLog: boolean
  /** 是否在加密失败时抛出异常 */
  throwOnError: boolean
}

/**
 * 默认 E2EE 守卫配置 - 最高安全级别
 */
export const DEFAULT_E2EE_GUARD_CONFIG: E2EEGuardConfig = {
  mandatoryEncryption: true,
  rejectUnencryptedMessages: true,
  verifyEncryptionStrength: true,
  minEncryptionStrength: 80,
  enableAuditLog: true,
  throwOnError: true
}

/**
 * E2EE 守卫错误
 */
export class E2EEGuardError extends Error {
  constructor(
    message: string,
    public code: string,
    public sessionId?: string,
    public originalError?: unknown
  ) {
    super(message)
    this.name = 'E2EEGuardError'
  }
}

/**
 * E2EE 守卫类
 * 确保所有私密聊天操作都符合强制加密策略
 */
export class E2EEGuard {
  private config: E2EEGuardConfig
  private auditLog: Array<{
    timestamp: number
    operation: string
    success: boolean
    details: Record<string, unknown>
  }> = []

  constructor(config: Partial<E2EEGuardConfig> = {}) {
    this.config = { ...DEFAULT_E2EE_GUARD_CONFIG, ...config }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<E2EEGuardConfig>): void {
    this.config = { ...this.config, ...config }
    logger.info('[E2EEGuard] Configuration updated', { config: this.config })
  }

  /**
   * 获取当前配置
   */
  getConfig(): E2EEGuardConfig {
    return { ...this.config }
  }

  /**
   * 验证消息发送（守卫检查）
   * 确保消息在发送前已正确加密
   */
  async validateMessageBeforeSend(
    sessionId: string,
    content: string,
    encryptionStatus?: {
      valid: boolean
      encryptedContent?: {
        algorithm: string
        timestamp: number
        key_id: string
        ciphertext: string
        iv: string
        tag: string
      }
      error?: string
    }
  ): Promise<{ valid: boolean; error?: string }> {
    // 1. 检查会话 ID
    if (!sessionId || typeof sessionId !== 'string') {
      const error = 'Invalid session ID'
      this.logAudit('send_validation', false, { sessionId, error })
      if (this.config.throwOnError) {
        throw new E2EEGuardError(error, 'INVALID_SESSION_ID', sessionId)
      }
      return { valid: false, error }
    }

    // 2. 检查内容
    if (!content || typeof content !== 'string') {
      const error = 'Message content is required and must be a string'
      this.logAudit('send_validation', false, { sessionId, error })
      if (this.config.throwOnError) {
        throw new E2EEGuardError(error, 'INVALID_CONTENT', sessionId)
      }
      return { valid: false, error }
    }

    // 3. 验证加密状态
    if (this.config.mandatoryEncryption) {
      if (!encryptionStatus || !encryptionStatus.valid) {
        const error = encryptionStatus?.error || 'Message encryption validation failed'
        this.logAudit('send_validation', false, { sessionId, error })
        this.emitSecurityWarning({
          type: 'ENCRYPTION_VALIDATION_FAILED' as SecurityWarningType,
          sessionId,
          timestamp: Date.now(),
          details: { error, operation: 'send' }
        })
        if (this.config.throwOnError) {
          throw new E2EEGuardError(`Mandatory E2EE: ${error}`, 'ENCRYPTION_REQUIRED', sessionId)
        }
        return { valid: false, error }
      }
    }

    // 4. 验证加密格式
    if (encryptionStatus?.valid && encryptionStatus.encryptedContent) {
      const encrypted = encryptionStatus.encryptedContent

      // 检查算法
      if (encrypted.algorithm !== 'aes-gcm-256') {
        const error = `Unsupported encryption algorithm: ${encrypted.algorithm}`
        this.logAudit('send_validation', false, { sessionId, error, algorithm: encrypted.algorithm })
        if (this.config.throwOnError) {
          throw new E2EEGuardError(error, 'WEAK_ENCRYPTION', sessionId)
        }
        return { valid: false, error }
      }

      // 检查时间戳
      const now = Date.now()
      const maxAge = 24 * 60 * 60 * 1000 // 24小时
      if (encrypted.timestamp > now) {
        const error = 'Encryption timestamp is in the future'
        this.logAudit('send_validation', false, { sessionId, error, timestamp: encrypted.timestamp })
        if (this.config.throwOnError) {
          throw new E2EEGuardError(error, 'INVALID_TIMESTAMP', sessionId)
        }
        return { valid: false, error }
      }

      if (now - encrypted.timestamp > maxAge) {
        const error = 'Encryption timestamp is too old'
        this.logAudit('send_validation', false, { sessionId, error, timestamp: encrypted.timestamp })
        if (this.config.throwOnError) {
          throw new E2EEGuardError(error, 'STALE_ENCRYPTION', sessionId)
        }
        return { valid: false, error }
      }

      // 检查密钥 ID
      if (!encrypted.key_id || typeof encrypted.key_id !== 'string' || encrypted.key_id.length === 0) {
        const error = 'Missing or invalid key_id in encrypted content'
        this.logAudit('send_validation', false, { sessionId, error })
        if (this.config.throwOnError) {
          throw new E2EEGuardError(error, 'INVALID_KEY_ID', sessionId)
        }
        return { valid: false, error }
      }
    }

    this.logAudit('send_validation', true, { sessionId })
    return { valid: true }
  }

  /**
   * 验证接收消息（守卫检查）
   * 确保接收的消息已正确加密
   */
  async validateReceivedMessage(
    sessionId: string,
    messageContent: string,
    messageId?: string
  ): Promise<{ valid: boolean; error?: string }> {
    // 1. 检查会话 ID
    if (!sessionId || typeof sessionId !== 'string') {
      const error = 'Invalid session ID'
      this.logAudit('receive_validation', false, { sessionId, messageId, error })
      if (this.config.throwOnError) {
        throw new E2EEGuardError(error, 'INVALID_SESSION_ID', sessionId)
      }
      return { valid: false, error }
    }

    // 2. 检查内容
    if (!messageContent || typeof messageContent !== 'string') {
      const error = 'Message content is required and must be a string'
      this.logAudit('receive_validation', false, { sessionId, messageId, error })
      if (this.config.throwOnError) {
        throw new E2EEGuardError(error, 'INVALID_CONTENT', sessionId)
      }
      return { valid: false, error }
    }

    // 3. 验证是否为加密格式
    let isEncrypted = false
    try {
      const parsed = JSON.parse(messageContent)
      isEncrypted =
        parsed &&
        typeof parsed === 'object' &&
        parsed.algorithm === 'aes-gcm-256' &&
        typeof parsed.key_id === 'string' &&
        typeof parsed.ciphertext === 'string' &&
        typeof parsed.iv === 'string' &&
        typeof parsed.tag === 'string' &&
        typeof parsed.timestamp === 'number'
    } catch {
      isEncrypted = false
    }

    // 4. 如果启用强制加密，拒绝未加密消息
    if (this.config.mandatoryEncryption && this.config.rejectUnencryptedMessages && !isEncrypted) {
      const error = 'Received unencrypted message in mandatory E2EE mode'
      this.logAudit('receive_validation', false, { sessionId, messageId, error })
      this.emitSecurityWarning({
        type: SecurityWarningType.UNENCRYPTED_MESSAGE,
        sessionId,
        messageId,
        timestamp: Date.now(),
        details: { error }
      })
      if (this.config.throwOnError) {
        throw new E2EEGuardError(error, 'UNENCRYPTED_MESSAGE_REJECTED', sessionId, { messageId })
      }
      return { valid: false, error }
    }

    this.logAudit('receive_validation', true, { sessionId, messageId, isEncrypted })
    return { valid: true }
  }

  /**
   * 验证会话加密状态
   * 确保会话满足加密要求
   */
  async validateSessionEncryption(
    sessionId: string,
    encryptionStatus: {
      level: string
      encrypted: boolean
      algorithm: string
      strengthScore: number
      needsRotation?: boolean
      keyExpiresAt?: number
    }
  ): Promise<{ valid: boolean; error?: string }> {
    // 1. 检查是否已加密
    if (this.config.mandatoryEncryption && !encryptionStatus.encrypted) {
      const error = 'Session is not encrypted'
      this.logAudit('session_validation', false, { sessionId, error })
      this.emitSecurityWarning({
        type: SecurityWarningType.WEAK_ENCRYPTION,
        sessionId,
        timestamp: Date.now(),
        details: { error }
      })
      if (this.config.throwOnError) {
        throw new E2EEGuardError(error, 'SESSION_NOT_ENCRYPTED', sessionId)
      }
      return { valid: false, error }
    }

    // 2. 验证加密强度
    if (this.config.verifyEncryptionStrength) {
      if (encryptionStatus.strengthScore < this.config.minEncryptionStrength) {
        const error = `Encryption strength score ${encryptionStatus.strengthScore} is below minimum ${this.config.minEncryptionStrength}`
        this.logAudit('session_validation', false, { sessionId, error, strengthScore: encryptionStatus.strengthScore })
        if (this.config.throwOnError) {
          throw new E2EEGuardError(error, 'WEAK_ENCRYPTION', sessionId)
        }
        return { valid: false, error }
      }
    }

    // 3. 检查密钥是否需要轮换
    if (encryptionStatus.needsRotation) {
      const error = 'Session key needs rotation'
      this.logAudit('session_validation', false, { sessionId, error, needsRotation: true })
      this.emitSecurityWarning({
        type: SecurityWarningType.KEY_ROTATION_FAILED,
        sessionId,
        timestamp: Date.now(),
        details: { error }
      })
      if (this.config.throwOnError) {
        throw new E2EEGuardError(error, 'KEY_ROTATION_REQUIRED', sessionId)
      }
      return { valid: false, error }
    }

    // 4. 检查密钥是否过期
    if (encryptionStatus.keyExpiresAt && encryptionStatus.keyExpiresAt < Date.now()) {
      const error = 'Session key has expired'
      this.logAudit('session_validation', false, { sessionId, error, keyExpiresAt: encryptionStatus.keyExpiresAt })
      this.emitSecurityWarning({
        type: SecurityWarningType.KEY_EXPIRED,
        sessionId,
        timestamp: Date.now(),
        details: { error }
      })
      if (this.config.throwOnError) {
        throw new E2EEGuardError(error, 'KEY_EXPIRED', sessionId)
      }
      return { valid: false, error }
    }

    this.logAudit('session_validation', true, { sessionId, encryptionStatus })
    return { valid: true }
  }

  /**
   * 发射安全警告事件
   */
  private emitSecurityWarning(event: SecurityWarningEvent): void {
    window.dispatchEvent(new CustomEvent('security.warning', { detail: event }))
    logger.warn('[E2EEGuard] Security warning emitted', { event })
  }

  /**
   * 记录审计日志
   */
  private logAudit(operation: string, success: boolean, details: Record<string, unknown>): void {
    if (!this.config.enableAuditLog) return

    const logEntry = {
      timestamp: Date.now(),
      operation,
      success,
      details
    }

    this.auditLog.push(logEntry)

    // 限制日志大小
    if (this.auditLog.length > 1000) {
      this.auditLog.shift()
    }

    logger.debug('[E2EEGuard] Audit log', { entry: logEntry })
  }

  /**
   * 获取审计日志
   */
  getAuditLog(sessionId?: string): Array<{
    timestamp: number
    operation: string
    success: boolean
    details: Record<string, unknown>
  }> {
    if (sessionId) {
      return this.auditLog.filter((log) => log.details.sessionId === sessionId)
    }
    return [...this.auditLog]
  }

  /**
   * 清除审计日志
   */
  clearAuditLog(sessionId?: string): void {
    if (sessionId) {
      this.auditLog = this.auditLog.filter((log) => log.details.sessionId !== sessionId)
    } else {
      this.auditLog = []
    }
  }

  /**
   * 重置守卫
   */
  reset(): void {
    this.auditLog = []
    logger.info('[E2EEGuard] Reset')
  }
}

// 默认守卫实例（使用最高安全配置）
export const e2eeGuard = new E2EEGuard()

/**
 * 创建自定义守卫实例
 */
export function createE2EEGuard(config?: Partial<E2EEGuardConfig>): E2EEGuard {
  return new E2EEGuard(config)
}
