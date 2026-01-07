/**
 * PrivateChat 安全类型定义
 * 用于强制端到端加密 (Mandatory E2EE)
 */

/**
 * 加密安全配置
 */
export interface EncryptionSecurityConfig {
  /** 强制 E2EE - 如果为 true，所有消息必须加密 */
  mandatoryEncryption: boolean
  /** 拒绝未加密消息 - 接收到未加密消息时拒绝 */
  rejectUnencryptedMessages: boolean
  /** 仅存储加密内容 - 本地存储也只保留加密内容 */
  storeOnlyEncrypted: boolean
  /** 前向安全 - 定期轮换密钥 */
  forwardSecrecyEnabled: boolean
  /** 密钥轮换间隔（毫秒） */
  keyRotationIntervalMs: number
  /** 审计日志启用 */
  auditLoggingEnabled: boolean
  /** 审计日志最大保留条数 */
  maxAuditLogEntries: number
  /** 密钥过期时间（毫秒） */
  keyExpirationMs: number
  /** 启用密钥确认（密钥确认机制） */
  enableKeyConfirmation: boolean
}

/**
 * 默认安全配置
 */
export const DEFAULT_SECURITY_CONFIG: EncryptionSecurityConfig = {
  mandatoryEncryption: true,
  rejectUnencryptedMessages: true,
  storeOnlyEncrypted: true,
  forwardSecrecyEnabled: true,
  keyRotationIntervalMs: 60 * 60 * 1000, // 1小时
  auditLoggingEnabled: true,
  maxAuditLogEntries: 1000,
  keyExpirationMs: 7 * 24 * 60 * 60 * 1000, // 7天
  enableKeyConfirmation: true
}

/**
 * 加密级别
 */
export enum EncryptionLevel {
  /** 无加密（不允许） */
  NONE = 'none',
  /** 基础加密（AES-GCM-256） */
  BASIC = 'basic',
  /** 标准加密（带密钥轮换） */
  STANDARD = 'standard',
  /** 高级加密（带前向安全和密钥确认） */
  ADVANCED = 'advanced'
}

/**
 * 加密状态
 */
export interface EncryptionStatus {
  /** 加密级别 */
  level: EncryptionLevel
  /** 是否已加密 */
  encrypted: boolean
  /** 加密算法 */
  algorithm: string
  /** 密钥 ID */
  keyId?: string
  /** 密钥创建时间 */
  keyCreatedAt?: number
  /** 密钥过期时间 */
  keyExpiresAt?: number
  /** 是否需要轮换 */
  needsRotation: boolean
  /** 最后一次验证时间 */
  lastVerifiedAt?: number
  /** 加密强度评分 (0-100) */
  strengthScore: number
}

/**
 * 加密审计日志条目
 */
export interface EncryptionAuditLog {
  timestamp: number
  sessionId: string
  operation:
    | 'key_negotiated'
    | 'message_encrypted'
    | 'message_decrypted'
    | 'key_rotated'
    | 'key_cleaned'
    | 'encryption_failed'
    | 'decryption_failed'
    | 'unencrypted_rejected'
  success: boolean
  details: {
    keyId?: string
    messageId?: string
    algorithm?: string
    error?: string
    duration?: number
    fromStorage?: boolean
    [key: string]: unknown
  }
}

/**
 * 安全警告类型
 */
export enum SecurityWarningType {
  /** 收到未加密消息 */
  UNENCRYPTED_MESSAGE = 'unencrypted_message',
  /** 加密验证失败 */
  ENCRYPTION_VALIDATION_FAILED = 'encryption_validation_failed',
  /** 解密失败 */
  DECRYPTION_FAILED = 'decryption_failed',
  /** 密钥轮换失败 */
  KEY_ROTATION_FAILED = 'key_rotation_failed',
  /** 密钥已过期 */
  KEY_EXPIRED = 'key_expired',
  /** 加密强度不足 */
  WEAK_ENCRYPTION = 'weak_encryption'
}

/**
 * 安全警告事件
 */
export interface SecurityWarningEvent {
  type: SecurityWarningType
  sessionId: string
  messageId?: string
  timestamp: number
  details: {
    error?: string
    expectedLevel?: EncryptionLevel
    actualLevel?: EncryptionLevel
    [key: string]: unknown
  }
}

/**
 * 加密验证结果
 */
export interface EncryptionValidationResult {
  /** 是否有效 */
  valid: boolean
  /** 加密内容（如果有效） */
  encryptedContent?: {
    algorithm: string
    keyId: string
    ciphertext: string
    iv: string
    tag: string
    timestamp: number
  }
  /** 错误信息（如果无效） */
  error?: string
  /** 验证时间戳 */
  validatedAt: number
}

/**
 * 加密统计
 */
export interface EncryptionStats {
  /** 总消息数 */
  totalMessages: number
  /** 加密消息数 */
  encryptedMessages: number
  /** 未加密消息数 */
  unencryptedMessages: number
  /** 加密成功率 */
  encryptionSuccessRate: number
  /** 解密成功率 */
  decryptionSuccessRate: number
  /** 平均加密时间（毫秒） */
  avgEncryptionTime: number
  /** 平均解密时间（毫秒） */
  avgDecryptionTime: number
  /** 密钥轮换次数 */
  keyRotations: number
  /** 加密失败次数 */
  encryptionFailures: number
  /** 解密失败次数 */
  decryptionFailures: number
}

/**
 * 密钥信息
 */
export interface KeyInfo {
  keyId: string
  sessionId: string
  algorithm: string
  createdAt: number
  expiresAt: number
  participants: string[]
  status: 'active' | 'rotated' | 'expired'
  rotationCount: number
  lastRotatedAt?: number
}

/**
 * 加密配置预设
 */
export const ENCRYPTION_PRESETS: Record<string, Partial<EncryptionSecurityConfig>> = {
  /** 最大安全 - 所有安全特性启用 */
  maximum: {
    mandatoryEncryption: true,
    rejectUnencryptedMessages: true,
    storeOnlyEncrypted: true,
    forwardSecrecyEnabled: true,
    keyRotationIntervalMs: 30 * 60 * 1000, // 30分钟
    keyExpirationMs: 24 * 60 * 60 * 1000, // 1天
    enableKeyConfirmation: true,
    auditLoggingEnabled: true
  },
  /** 高安全 - 推荐用于敏感通信 */
  high: {
    mandatoryEncryption: true,
    rejectUnencryptedMessages: true,
    storeOnlyEncrypted: true,
    forwardSecrecyEnabled: true,
    keyRotationIntervalMs: 60 * 60 * 1000, // 1小时
    keyExpirationMs: 7 * 24 * 60 * 60 * 1000, // 7天
    enableKeyConfirmation: true,
    auditLoggingEnabled: true
  },
  /** 标准安全 - 平衡安全性和性能 */
  standard: {
    mandatoryEncryption: true,
    rejectUnencryptedMessages: true,
    storeOnlyEncrypted: true,
    forwardSecrecyEnabled: true,
    keyRotationIntervalMs: 2 * 60 * 60 * 1000, // 2小时
    keyExpirationMs: 14 * 24 * 60 * 60 * 1000, // 14天
    enableKeyConfirmation: true,
    auditLoggingEnabled: true
  },
  /** 基础安全 - 最低要求 */
  basic: {
    mandatoryEncryption: true,
    rejectUnencryptedMessages: true,
    storeOnlyEncrypted: true,
    forwardSecrecyEnabled: false,
    keyRotationIntervalMs: 24 * 60 * 60 * 1000, // 24小时
    keyExpirationMs: 30 * 24 * 60 * 60 * 1000, // 30天
    enableKeyConfirmation: false,
    auditLoggingEnabled: true
  }
}
