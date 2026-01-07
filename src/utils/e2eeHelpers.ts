/**
 * E2EE 辅助工具函数
 * 为 PrivateChat E2EE 提供便捷的辅助功能
 *
 * @module utils/e2eeHelpers
 */

import type { EncryptedContent, SessionKeyMetadata } from '@/sdk/matrix-private-chat/types'
import { PrivateChatE2EEExtension } from '@/sdk/matrix-private-chat/E2EEExtension'

// =============================================================================
// E2EE 内容验证
// =============================================================================

/**
 * 验证加密内容的完整性
 *
 * @param content - 加密内容
 * @returns 是否有效
 */
export function isValidEncryptedContent(content: unknown): content is EncryptedContent {
  if (typeof content !== 'object' || content === null) {
    return false
  }

  const c = content as Record<string, unknown>

  return (
    c.algorithm === 'aes-gcm-256' &&
    typeof c.key_id === 'string' &&
    typeof c.ciphertext === 'string' &&
    typeof c.iv === 'string' &&
    typeof c.tag === 'string' &&
    typeof c.timestamp === 'number'
  )
}

/**
 * 检查加密内容是否过期
 *
 * @param content - 加密内容
 * @param maxAge - 最大有效期（毫秒）
 * @returns 是否过期
 */
export function isEncryptedContentExpired(
  content: EncryptedContent,
  maxAge: number = 7 * 24 * 60 * 60 * 1000
): boolean {
  const now = Date.now()
  return now - content.timestamp > maxAge
}

// =============================================================================
// E2EE 会话管理辅助
// =============================================================================

/**
 * 检查会话密钥是否需要轮换
 *
 * @param metadata - 会话密钥元数据
 * @param rotationInterval - 轮换间隔（毫秒）
 * @returns 是否需要轮换
 */
export function needsKeyRotation(
  metadata: SessionKeyMetadata,
  rotationInterval: number = 24 * 60 * 60 * 1000
): boolean {
  const now = Date.now()
  const age = now - metadata.created_at

  return metadata.status === 'active' && age > rotationInterval && (!metadata.expires_at || metadata.expires_at > now)
}

/**
 * 检查会话密钥是否已过期
 *
 * @param metadata - 会话密钥元数据
 * @returns 是否已过期
 */
export function isKeyExpired(metadata: SessionKeyMetadata): boolean {
  if (!metadata.expires_at) {
    return false
  }

  return Date.now() > metadata.expires_at
}

/**
 * 计算密钥使用时间（小时）
 *
 * @param metadata - 会话密钥元数据
 * @returns 使用时间（小时）
 */
export function calculateKeyAge(metadata: SessionKeyMetadata): number {
  const now = Date.now()
  const age = now - metadata.created_at
  return age / (60 * 60 * 1000)
}

// =============================================================================
// E2EE 批量操作
// =============================================================================

/**
 * 批量加密消息
 *
 * @param messages - 消息数组
 * @param sessionId - 会话 ID
 * @param e2ee - E2EE 扩展实例
 * @returns 加密后的消息数组
 */
export async function batchEncryptMessages(
  messages: Array<{ id: string; content: string }>,
  sessionId: string,
  e2ee: PrivateChatE2EEExtension
): Promise<Array<{ id: string; encrypted: EncryptedContent }>> {
  const results = await Promise.all(
    messages.map(async (msg) => ({
      id: msg.id,
      encrypted: await e2ee.encryptMessage(sessionId, msg.content)
    }))
  )

  return results
}

/**
 * 批量解密消息
 *
 * @param messages - 加密消息数组
 * @param sessionId - 会话 ID
 * @param e2ee - E2EE 扩展实例
 * @returns 解密后的消息数组
 */
export async function batchDecryptMessages(
  messages: Array<{ id: string; encrypted: EncryptedContent }>,
  sessionId: string,
  e2ee: PrivateChatE2EEExtension
): Promise<Array<{ id: string; content: string }>> {
  const results = await Promise.all(
    messages.map(async (msg) => ({
      id: msg.id,
      content: await e2ee.decryptMessage(sessionId, msg.encrypted)
    }))
  )

  return results
}

// =============================================================================
// E2EE 错误处理
// =============================================================================

/**
 * E2EE 错误类型
 */
export class E2EEError extends Error {
  constructor(
    message: string,
    public code: string,
    public sessionId?: string,
    public originalError?: unknown
  ) {
    super(message)
    this.name = 'E2EEError'
  }
}

/**
 * 处理 E2EE 操作错误
 *
 * @param error - 原始错误
 * @param sessionId - 会话 ID（可选）
 * @returns E2EE 错误对象
 */
export function handleE2EEError(error: unknown, sessionId?: string): E2EEError {
  if (error instanceof E2EEError) {
    return error
  }

  if (error instanceof Error) {
    // 根据错误消息确定错误类型
    if (error.message.includes('Session key not found')) {
      return new E2EEError('会话密钥不存在', 'SESSION_KEY_NOT_FOUND', sessionId, error)
    }

    if (error.message.includes('Unsupported algorithm')) {
      return new E2EEError('不支持的加密算法', 'UNSUPPORTED_ALGORITHM', sessionId, error)
    }

    if (error.message.includes('Failed to decrypt')) {
      return new E2EEError('解密失败', 'DECRYPTION_FAILED', sessionId, error)
    }

    if (error.message.includes('Failed to encrypt')) {
      return new E2EEError('加密失败', 'ENCRYPTION_FAILED', sessionId, error)
    }

    return new E2EEError(error.message, 'UNKNOWN_ERROR', sessionId, error)
  }

  return new E2EEError('未知错误', 'UNKNOWN_ERROR', sessionId, error)
}

// =============================================================================
// E2EE 统计信息
// =============================================================================

/**
 * E2EE 使用统计
 */
export interface E2EEStats {
  /** 总会话数 */
  totalSessions: number
  /** 活跃会话数 */
  activeSessions: number
  /** 过期会话数 */
  expiredSessions: number
  /** 需要轮换的会话数 */
  sessionsNeedingRotation: number
  /** 总加密消息数 */
  totalEncryptedMessages: number
  /** 总解密消息数 */
  totalDecryptedMessages: number
  /** 加密失败数 */
  encryptionFailures: number
  /** 解密失败数 */
  decryptionFailures: number
}

/**
 * 计算 E2EE 使用统计
 *
 * @param sessionKeys - 会话密钥映射
 * @param messageStats - 消息统计（可选）
 * @returns 统计信息
 */
export function calculateE2EEStats(
  sessionKeys: Map<string, SessionKeyMetadata>,
  messageStats?: {
    encrypted?: number
    decrypted?: number
    encryptionFailures?: number
    decryptionFailures?: number
  }
): E2EEStats {
  const _now = Date.now()
  const rotationInterval = 24 * 60 * 60 * 1000

  let activeSessions = 0
  let expiredSessions = 0
  let sessionsNeedingRotation = 0

  for (const metadata of sessionKeys.values()) {
    if (metadata.status !== 'active') {
      continue
    }

    if (isKeyExpired(metadata)) {
      expiredSessions++
    } else if (needsKeyRotation(metadata, rotationInterval)) {
      sessionsNeedingRotation++
    } else {
      activeSessions++
    }
  }

  return {
    totalSessions: sessionKeys.size,
    activeSessions,
    expiredSessions,
    sessionsNeedingRotation,
    totalEncryptedMessages: messageStats?.encrypted || 0,
    totalDecryptedMessages: messageStats?.decrypted || 0,
    encryptionFailures: messageStats?.encryptionFailures || 0,
    decryptionFailures: messageStats?.decryptionFailures || 0
  }
}

// =============================================================================
// E2EE 配置
// =============================================================================

/**
 * E2EE 配置选项
 */
export interface E2EEConfig {
  /** 密钥轮换间隔（毫秒） */
  keyRotationInterval?: number
  /** 密钥过期时间（毫秒） */
  keyExpirationTime?: number
  /** 是否启用自动轮换 */
  autoRotation?: boolean
  /** 最大消息过期时间（毫秒） */
  maxMessageAge?: number
}

/**
 * 默认 E2EE 配置
 */
export const DEFAULT_E2EE_CONFIG: Required<E2EEConfig> = {
  keyRotationInterval: 24 * 60 * 60 * 1000, // 24 小时
  keyExpirationTime: 7 * 24 * 60 * 60 * 1000, // 7 天
  autoRotation: true,
  maxMessageAge: 7 * 24 * 60 * 60 * 1000 // 7 天
}

/**
 * 合并用户配置与默认配置
 *
 * @param userConfig - 用户配置
 * @returns 合并后的配置
 */
export function mergeE2EEConfig(userConfig: E2EEConfig = {}): Required<E2EEConfig> {
  return {
    keyRotationInterval: userConfig.keyRotationInterval ?? DEFAULT_E2EE_CONFIG.keyRotationInterval,
    keyExpirationTime: userConfig.keyExpirationTime ?? DEFAULT_E2EE_CONFIG.keyExpirationTime,
    autoRotation: userConfig.autoRotation ?? DEFAULT_E2EE_CONFIG.autoRotation,
    maxMessageAge: userConfig.maxMessageAge ?? DEFAULT_E2EE_CONFIG.maxMessageAge
  }
}

// =============================================================================
// E2EE 调试工具
// =============================================================================

/**
 * E2EE 调试信息
 */
export interface E2EEDebugInfo {
  /** 会话 ID */
  sessionId: string
  /** 密钥 ID */
  keyId: string
  /** 密钥状态 */
  status: string
  /** 密钥年龄（小时） */
  keyAge: number
  /** 是否即将过期 */
  expiringSoon: boolean
  /** 是否已过期 */
  expired: boolean
  /** 是否需要轮换 */
  needsRotation: boolean
}

/**
 * 获取会话的调试信息
 *
 * @param sessionId - 会话 ID
 * @param metadata - 会话密钥元数据
 * @returns 调试信息
 */
export function getE2EEDebugInfo(sessionId: string, metadata: SessionKeyMetadata): E2EEDebugInfo {
  const keyAge = calculateKeyAge(metadata)
  const rotationInterval = 24 * 60 * 60 * 1000 // 24 小时

  return {
    sessionId,
    keyId: metadata.key_id,
    status: metadata.status,
    keyAge,
    expiringSoon: !isKeyExpired(metadata) && needsKeyRotation(metadata, rotationInterval),
    expired: isKeyExpired(metadata),
    needsRotation: needsKeyRotation(metadata, rotationInterval)
  }
}

/**
 * 格式化调试信息为可读字符串
 *
 * @param debugInfo - 调试信息
 * @returns 格式化的字符串
 */
export function formatE2EEDebugInfo(debugInfo: E2EEDebugInfo): string {
  const lines = [
    `E2EE 调试信息`,
    `会话 ID: ${debugInfo.sessionId}`,
    `密钥 ID: ${debugInfo.keyId}`,
    `状态: ${debugInfo.status}`,
    `密钥年龄: ${debugInfo.keyAge.toFixed(2)} 小时`,
    `即将过期: ${debugInfo.expiringSoon ? '是' : '否'}`,
    `已过期: ${debugInfo.expired ? '是' : '否'}`,
    `需要轮换: ${debugInfo.needsRotation ? '是' : '否'}`
  ]

  return lines.join('\n')
}

// =============================================================================
// E2EE 健康检查
// =============================================================================

/**
 * E2EE 健康状态
 */
export interface E2EEHealthStatus {
  /** 是否健康 */
  healthy: boolean
  /** 问题列表 */
  issues: string[]
  /** 警告列表 */
  warnings: string[]
}

/**
 * 检查 E2EE 系统健康状况
 *
 * @param sessionKeys - 会话密钥映射
 * @param config - E2EE 配置
 * @returns 健康状态
 */
export function checkE2EEHealth(
  sessionKeys: Map<string, SessionKeyMetadata>,
  config: Required<E2EEConfig>
): E2EEHealthStatus {
  const issues: string[] = []
  const warnings: string[] = []

  // 检查过期密钥
  for (const [sessionId, metadata] of sessionKeys.entries()) {
    if (isKeyExpired(metadata)) {
      issues.push(`会话 ${sessionId} 的密钥已过期`)
    } else if (needsKeyRotation(metadata, config.keyRotationInterval)) {
      warnings.push(`会话 ${sessionId} 的密钥需要轮换`)
    }
  }

  // 检查活跃会话数
  if (sessionKeys.size === 0) {
    warnings.push('没有活跃的加密会话')
  }

  return {
    healthy: issues.length === 0,
    issues,
    warnings
  }
}

// =============================================================================
// 导出所有函数
// =============================================================================

export {
  // 从 E2EE 扩展导出
  PrivateChatE2EEExtension,
  createE2EEExtension
} from '@/sdk/matrix-private-chat/E2EEExtension'
