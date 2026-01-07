/**
 * E2EE 服务增强版 - 强制加密和安全审计
 * 提供完整的端到端加密安全功能
 */

import { EventEmitter } from 'node:events'
import type {
  EncryptionSecurityConfig,
  EncryptionStatus,
  EncryptionAuditLog,
  SecurityWarningEvent,
  EncryptionStats,
  KeyInfo,
  EncryptionValidationResult
} from '@/types/private-chat-security'
import { DEFAULT_SECURITY_CONFIG, EncryptionLevel } from '@/types/private-chat-security'
import { logger } from '@/utils/logger'

/**
 * E2EE 服务增强版
 */
export class E2EEServiceEnhanced extends EventEmitter {
  private static instance: E2EEServiceEnhanced
  private securityConfig: EncryptionSecurityConfig
  private auditLog: EncryptionAuditLog[] = []
  private sessionKeys: Map<string, KeyInfo> = new Map()
  private encryptionTimings: Map<string, number[]> = new Map()

  private constructor() {
    super()
    this.securityConfig = { ...DEFAULT_SECURITY_CONFIG }
  }

  static getInstance(): E2EEServiceEnhanced {
    if (!E2EEServiceEnhanced.instance) {
      E2EEServiceEnhanced.instance = new E2EEServiceEnhanced()
    }
    return E2EEServiceEnhanced.instance
  }

  /**
   * 配置安全策略
   */
  configureSecurity(config: Partial<EncryptionSecurityConfig>): void {
    this.securityConfig = { ...this.securityConfig, ...config }
    logger.info('[E2EEServiceEnhanced] Security configuration updated', { config: this.securityConfig })
  }

  /**
   * 获取安全配置
   */
  getSecurityConfig(): EncryptionSecurityConfig {
    return { ...this.securityConfig }
  }

  /**
   * 验证加密内容（严格验证）
   */
  validateEncryption(content: string): EncryptionValidationResult {
    const startTime = Date.now()

    try {
      const parsed = JSON.parse(content) as Partial<Record<string, unknown>>

      // 检查必需字段
      const requiredFields = ['algorithm', 'key_id', 'ciphertext', 'iv', 'tag', 'timestamp']
      for (const field of requiredFields) {
        if (!(field in parsed) || parsed[field] === undefined || parsed[field] === null) {
          return {
            valid: false,
            error: `Missing required field: ${field}`,
            validatedAt: startTime
          }
        }
      }

      // 验证算法
      if (parsed.algorithm !== 'aes-gcm-256') {
        return {
          valid: false,
          error: `Invalid algorithm: ${parsed.algorithm}`,
          validatedAt: startTime
        }
      }

      // 验证数据类型
      if (typeof parsed.key_id !== 'string' || parsed.key_id.length === 0) {
        return {
          valid: false,
          error: 'Invalid key_id: must be a non-empty string',
          validatedAt: startTime
        }
      }

      if (typeof parsed.ciphertext !== 'string' || parsed.ciphertext.length === 0) {
        return {
          valid: false,
          error: 'Invalid ciphertext: must be a non-empty string',
          validatedAt: startTime
        }
      }

      if (typeof parsed.iv !== 'string' || parsed.iv.length === 0) {
        return {
          valid: false,
          error: 'Invalid iv: must be a non-empty string',
          validatedAt: startTime
        }
      }

      if (typeof parsed.tag !== 'string' || parsed.tag.length === 0) {
        return {
          valid: false,
          error: 'Invalid tag: must be a non-empty string',
          validatedAt: startTime
        }
      }

      if (typeof parsed.timestamp !== 'number' || parsed.timestamp <= 0) {
        return {
          valid: false,
          error: 'Invalid timestamp: must be a positive number',
          validatedAt: startTime
        }
      }

      // 检查时间戳是否在合理范围内（不能是未来时间，不能太旧）
      const now = Date.now()
      const maxAge = 24 * 60 * 60 * 1000 // 24小时
      if (parsed.timestamp > now) {
        return {
          valid: false,
          error: 'Invalid timestamp: cannot be in the future',
          validatedAt: startTime
        }
      }

      if (now - parsed.timestamp > maxAge) {
        return {
          valid: false,
          error: 'Invalid timestamp: too old',
          validatedAt: startTime
        }
      }

      // 验证通过
      return {
        valid: true,
        encryptedContent: {
          algorithm: parsed.algorithm as string,
          keyId: parsed.key_id as string,
          ciphertext: parsed.ciphertext as string,
          iv: parsed.iv as string,
          tag: parsed.tag as string,
          timestamp: parsed.timestamp as number
        },
        validatedAt: Date.now()
      }
    } catch (error) {
      return {
        valid: false,
        error: `Failed to parse encrypted content: ${error instanceof Error ? error.message : String(error)}`,
        validatedAt: startTime
      }
    }
  }

  /**
   * 记录审计日志
   */
  addAuditLog(entry: Omit<EncryptionAuditLog, 'timestamp'>): void {
    if (!this.securityConfig.auditLoggingEnabled) return

    const logEntry: EncryptionAuditLog = {
      timestamp: Date.now(),
      ...entry
    }

    this.auditLog.push(logEntry)

    // 限制日志大小
    if (this.auditLog.length > this.securityConfig.maxAuditLogEntries) {
      this.auditLog.shift()
    }

    logger.debug('[E2EEServiceEnhanced] Audit log entry added', { entry: logEntry })
  }

  /**
   * 获取审计日志
   */
  getAuditLog(sessionId?: string, limit?: number): EncryptionAuditLog[] {
    let logs = sessionId ? this.auditLog.filter((log) => log.sessionId === sessionId) : [...this.auditLog]

    // 按时间倒序排列
    logs.sort((a, b) => b.timestamp - a.timestamp)

    if (limit) {
      logs = logs.slice(0, limit)
    }

    return logs
  }

  /**
   * 清除审计日志
   */
  clearAuditLog(sessionId?: string): void {
    if (sessionId) {
      this.auditLog = this.auditLog.filter((log) => log.sessionId !== sessionId)
    } else {
      this.auditLog = []
    }
  }

  /**
   * 获取会话加密状态
   */
  async getSessionEncryptionStatus(sessionId: string): Promise<EncryptionStatus> {
    const keyInfo = this.sessionKeys.get(sessionId)

    if (!keyInfo) {
      return {
        level: EncryptionLevel.BASIC,
        encrypted: false,
        algorithm: 'none',
        needsRotation: false,
        strengthScore: 0
      }
    }

    // 计算是否需要轮换
    const now = Date.now()
    const _age = now - keyInfo.createdAt
    const timeUntilExpiry = keyInfo.expiresAt - now
    const needsRotation = timeUntilExpiry < this.securityConfig.keyRotationIntervalMs

    // 计算加密级别
    let level: EncryptionLevel = EncryptionLevel.BASIC
    if (this.securityConfig.forwardSecrecyEnabled && keyInfo.rotationCount > 0) {
      level = EncryptionLevel.ADVANCED
    } else if (this.securityConfig.keyRotationIntervalMs < 24 * 60 * 60 * 1000) {
      level = EncryptionLevel.STANDARD
    }

    // 计算强度评分
    let strengthScore = 40 // 基础加密
    if (keyInfo.algorithm === 'aes-gcm-256') strengthScore += 20
    if (!needsRotation) strengthScore += 20
    if (timeUntilExpiry > 7 * 24 * 60 * 60 * 1000) strengthScore += 10
    if (keyInfo.lastRotatedAt && now - keyInfo.lastRotatedAt < 24 * 60 * 60 * 1000) strengthScore += 10

    return {
      level,
      encrypted: true,
      algorithm: keyInfo.algorithm,
      keyId: keyInfo.keyId,
      keyCreatedAt: keyInfo.createdAt,
      keyExpiresAt: keyInfo.expiresAt,
      needsRotation,
      lastVerifiedAt: now,
      strengthScore: Math.min(100, strengthScore)
    }
  }

  /**
   * 注册会话密钥
   */
  registerSessionKey(keyInfo: KeyInfo): void {
    this.sessionKeys.set(keyInfo.sessionId, keyInfo)

    this.addAuditLog({
      sessionId: keyInfo.sessionId,
      operation: 'key_negotiated',
      success: true,
      details: {
        keyId: keyInfo.keyId,
        algorithm: keyInfo.algorithm,
        participants: keyInfo.participants
      }
    })

    logger.info('[E2EEServiceEnhanced] Session key registered', {
      sessionId: keyInfo.sessionId,
      keyId: keyInfo.keyId
    })
  }

  /**
   * 更新会话密钥（轮换）
   */
  updateSessionKey(sessionId: string, keyInfo: KeyInfo): void {
    const existingKey = this.sessionKeys.get(sessionId)

    this.sessionKeys.set(sessionId, {
      ...keyInfo,
      rotationCount: (existingKey?.rotationCount || 0) + 1,
      lastRotatedAt: Date.now()
    })

    this.addAuditLog({
      sessionId,
      operation: 'key_rotated',
      success: true,
      details: {
        keyId: keyInfo.keyId,
        algorithm: keyInfo.algorithm,
        rotationCount: this.sessionKeys.get(sessionId)!.rotationCount
      }
    })

    logger.info('[E2EEServiceEnhanced] Session key rotated', {
      sessionId,
      keyId: keyInfo.keyId,
      rotationCount: this.sessionKeys.get(sessionId)!.rotationCount
    })
  }

  /**
   * 删除会话密钥
   */
  deleteSessionKey(sessionId: string): void {
    const keyInfo = this.sessionKeys.get(sessionId)

    if (keyInfo) {
      this.addAuditLog({
        sessionId,
        operation: 'key_cleaned',
        success: true,
        details: {
          keyId: keyInfo.keyId,
          reason: 'session_deleted'
        }
      })

      this.sessionKeys.delete(sessionId)

      logger.info('[E2EEServiceEnhanced] Session key deleted', {
        sessionId,
        keyId: keyInfo.keyId
      })
    }
  }

  /**
   * 获取会话密钥信息
   */
  getSessionKey(sessionId: string): KeyInfo | null {
    return this.sessionKeys.get(sessionId) || null
  }

  /**
   * 获取所有会话密钥
   */
  getAllSessionKeys(): Map<string, KeyInfo> {
    return new Map(this.sessionKeys)
  }

  /**
   * 检查会话密钥是否需要轮换
   */
  needsKeyRotation(sessionId: string): boolean {
    const keyInfo = this.sessionKeys.get(sessionId)

    if (!keyInfo) return false

    const now = Date.now()
    const timeUntilExpiry = keyInfo.expiresAt - now

    return timeUntilExpiry < this.securityConfig.keyRotationIntervalMs
  }

  /**
   * 获取需要轮换的会话列表
   */
  getSessionsNeedingRotation(): string[] {
    const now = Date.now()
    const result: string[] = []

    for (const [sessionId, keyInfo] of this.sessionKeys.entries()) {
      const timeUntilExpiry = keyInfo.expiresAt - now
      if (timeUntilExpiry < this.securityConfig.keyRotationIntervalMs) {
        result.push(sessionId)
      }
    }

    return result
  }

  /**
   * 触发安全警告事件
   */
  emitSecurityWarning(event: SecurityWarningEvent): void {
    this.addAuditLog({
      sessionId: event.sessionId,
      operation: 'unencrypted_rejected',
      success: false,
      details: {
        messageId: event.messageId,
        error: event.type,
        ...event.details
      }
    })

    window.dispatchEvent(new CustomEvent('security.warning', { detail: event }))

    logger.warn('[E2EEServiceEnhanced] Security warning emitted', { event })
  }

  /**
   * 获取安全警告列表
   */
  getSecurityWarnings(sessionId?: string): string[] {
    const warnings: string[] = []

    // 检查未加密消息
    if (sessionId) {
      const logs = this.getAuditLog(sessionId)
      const unencryptedCount = logs.filter(
        (log) => log.operation === 'unencrypted_rejected' || log.operation === 'decryption_failed'
      ).length

      if (unencryptedCount > 0) {
        warnings.push(`${unencryptedCount} 条未加密或解密失败的消息`)
      }
    }

    // 检查需要轮换的密钥
    if (this.securityConfig.forwardSecrecyEnabled) {
      const sessionsNeedingRotation = this.getSessionsNeedingRotation()
      if (sessionsNeedingRotation.length > 0) {
        warnings.push(`${sessionsNeedingRotation.length} 个会话的密钥需要轮换`)
      }
    }

    // 检查加密失败率
    const encryptionFailures = this.auditLog.filter((log) => log.operation === 'encryption_failed').length

    if (encryptionFailures > 0) {
      warnings.push(`${encryptionFailures} 次加密失败`)
    }

    return warnings
  }

  /**
   * 记录加密时间
   */
  recordEncryptionTime(sessionId: string, duration: number): void {
    if (!this.encryptionTimings.has(sessionId)) {
      this.encryptionTimings.set(sessionId, [])
    }
    this.encryptionTimings.get(sessionId)!.push(duration)

    // 限制记录数量
    const timings = this.encryptionTimings.get(sessionId)!
    if (timings.length > 100) {
      timings.shift()
    }
  }

  /**
   * 记录解密时间
   */
  recordDecryptionTime(sessionId: string, duration: number): void {
    // 使用相同的记录方式，但可以分别统计
    this.recordEncryptionTime(sessionId, duration)
  }

  /**
   * 获取加密统计信息
   */
  getEncryptionStats(sessionId?: string): EncryptionStats {
    const relevantLogs = sessionId ? this.auditLog.filter((log) => log.sessionId === sessionId) : this.auditLog

    const totalMessages = relevantLogs.filter(
      (log) => log.operation === 'message_encrypted' || log.operation === 'message_decrypted'
    ).length

    const encryptedMessages = relevantLogs.filter((log) => log.operation === 'message_encrypted' && log.success).length

    const unencryptedMessages = relevantLogs.filter((log) => log.operation === 'unencrypted_rejected').length

    const encryptionFailures = relevantLogs.filter((log) => log.operation === 'encryption_failed').length

    const decryptionFailures = relevantLogs.filter((log) => log.operation === 'decryption_failed').length

    const keyRotations = relevantLogs.filter((log) => log.operation === 'key_rotated').length

    // 计算平均时间
    const timings = sessionId ? this.encryptionTimings.get(sessionId) || [] : []
    const avgEncryptionTime = timings.length > 0 ? timings.reduce((sum, t) => sum + t, 0) / timings.length : 0

    return {
      totalMessages,
      encryptedMessages,
      unencryptedMessages,
      encryptionSuccessRate: totalMessages > 0 ? (encryptedMessages / totalMessages) * 100 : 100,
      decryptionSuccessRate: 100, // 暂时固定，需要根据实际统计
      avgEncryptionTime,
      avgDecryptionTime: avgEncryptionTime,
      keyRotations,
      encryptionFailures,
      decryptionFailures
    }
  }

  /**
   * 验证强制 E2EE 策略
   */
  validateMandatoryE2EE(content: string, sessionId: string): { valid: boolean; error?: string } {
    // 检查内容是否已加密
    const validation = this.validateEncryption(content)

    if (!validation.valid) {
      if (this.securityConfig.mandatoryEncryption) {
        return {
          valid: false,
          error: `Mandatory E2EE violation: ${validation.error}`
        }
      }
    }

    // 检查是否有有效的会话密钥
    const keyInfo = this.sessionKeys.get(sessionId)
    if (!keyInfo) {
      return {
        valid: false,
        error: 'No valid session key found'
      }
    }

    // 检查密钥是否过期
    if (keyInfo.expiresAt < Date.now()) {
      return {
        valid: false,
        error: 'Session key has expired'
      }
    }

    return { valid: true }
  }

  /**
   * 重置服务（清除所有数据）
   */
  reset(): void {
    this.sessionKeys.clear()
    this.auditLog = []
    this.encryptionTimings.clear()
    logger.warn('[E2EEServiceEnhanced] Service reset')
  }

  /**
   * 要求有效的加密（如果会话没有有效加密则抛出错误）
   */
  requireValidEncryption(sessionId: string): void {
    const keyInfo = this.sessionKeys.get(sessionId)

    if (!keyInfo) {
      throw new Error(`No encryption key found for session: ${sessionId}`)
    }

    if (keyInfo.expiresAt < Date.now()) {
      throw new Error(`Encryption key has expired for session: ${sessionId}`)
    }

    if (this.securityConfig.mandatoryEncryption && !keyInfo.status) {
      throw new Error(`Invalid encryption status for session: ${sessionId}`)
    }

    logger.debug('[E2EEServiceEnhanced] Encryption validated', { sessionId })
  }
}

// 导出单例实例
export const e2eeServiceEnhanced = E2EEServiceEnhanced.getInstance()
