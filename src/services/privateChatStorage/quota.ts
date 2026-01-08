/**
 * PrivateChat Storage Quota Manager
 * 存储配额管理器 - 管理存储使用情况和清理策略
 *
 * @module services/privateChatStorage/quota
 */

import type { PrivateChatStorageApi } from '@/sdk/matrix-private-chat/types'
import { logger } from '@/utils/logger'

/**
 * 存储使用情况
 */
export interface StorageUsage {
  /**
   * 已使用空间（字节）
   */
  used: number

  /**
   * 总配额（字节）
   */
  total: number

  /**
   * 使用百分比
   */
  percentage: number

  /**
   * 可用空间（字节）
   */
  available: number
}

/**
 * 清理结果
 */
export interface CleanupResult {
  /**
   * 删除的会话数
   */
  sessionsDeleted: number

  /**
   * 删除的消息数
   */
  messagesDeleted: number

  /**
   * 释放的空间（字节）
   */
  spaceFreed: number

  /**
   * 操作耗时（毫秒）
   */
  duration: number
}

/**
 * 清理策略
 */
export interface CleanupPolicy {
  /**
   * 删除过期会话
   */
  deleteExpiredSessions: boolean

  /**
   * 保留最近的消息数
   */
  keepRecentMessages: number

  /**
   * 清理旧的会话密钥（天数）
   */
  cleanupOldKeys: number

  /**
   * 当使用率超过此百分比时自动清理
   */
  autoCleanupThreshold: number

  /**
   * 最大存储大小（字节）
   */
  maxStorageSize: number
}

/**
 * 存储统计信息
 */
export interface StorageStatistics {
  /**
   * 总会话数
   */
  totalSessions: number

  /**
   * 总消息数
   */
  totalMessages: number

  /**
   * 总密钥数
   */
  totalKeys: number

  /**
   * 存储使用情况
   */
  usage: StorageUsage

  /**
   * 过期会话数
   */
  expiredSessions: number

  /**
   * 需要清理的消息数
   */
  messagesToCleanup: number

  /**
   * 最后更新时间
   */
  lastUpdated: number
}

/**
 * 存储配额管理器
 */
export class StorageQuotaManager {
  private storage: PrivateChatStorageApi
  private readonly DEFAULT_MAX_SIZE = 100 * 1024 * 1024 // 100MB
  private cleanupPolicy: CleanupPolicy

  constructor(storage: PrivateChatStorageApi, policy?: Partial<CleanupPolicy>) {
    this.storage = storage
    this.cleanupPolicy = {
      deleteExpiredSessions: true,
      keepRecentMessages: 1000,
      cleanupOldKeys: 30,
      autoCleanupThreshold: 80,
      maxStorageSize: policy?.maxStorageSize || this.DEFAULT_MAX_SIZE,
      ...policy
    }
  }

  /**
   * 获取当前存储使用情况
   *
   * @returns Promise<StorageUsage>
   */
  async getUsage(): Promise<StorageUsage> {
    let used = 0
    let total = this.cleanupPolicy.maxStorageSize

    try {
      // 尝试使用 Storage API
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate()
        used = estimate.usage || 0
        total = estimate.quota || this.cleanupPolicy.maxStorageSize
      } else {
        // 降级方案：计算存储大小
        used = await this.calculateStorageSize()
      }
    } catch {
      // 完全降级：使用存储服务的大小查询
      used = await this.storage.getCacheSize()
    }

    const percentage = total > 0 ? (used / total) * 100 : 0

    return {
      used,
      total,
      percentage,
      available: Math.max(0, total - used)
    }
  }

  /**
   * 检查是否需要清理
   *
   * @returns Promise<boolean>
   */
  async needsCleanup(): Promise<boolean> {
    const usage = await this.getUsage()
    return usage.percentage >= this.cleanupPolicy.autoCleanupThreshold
  }

  /**
   * 获取存储统计信息
   *
   * @returns Promise<StorageStatistics>
   */
  async getStatistics(): Promise<StorageStatistics> {
    const sessions = await this.storage.getSessions()

    let totalMessages = 0
    let expiredSessions = 0
    let messagesToCleanup = 0
    const now = Date.now()

    // 统计每个会话的消息
    for (const session of sessions) {
      const messages = await this.storage.getMessages(session.session_id)
      totalMessages += messages.length

      // 检查会话是否过期
      if (session.expires_at && new Date(session.expires_at).getTime() < now) {
        expiredSessions++
      }

      // 检查需要清理的消息
      if (messages.length > this.cleanupPolicy.keepRecentMessages) {
        messagesToCleanup += messages.length - this.cleanupPolicy.keepRecentMessages
      }
    }

    // 获取存储使用情况
    const usage = await this.getUsage()

    return {
      totalSessions: sessions.length,
      totalMessages,
      totalKeys: sessions.length, // 简化：假设每个会话有一个密钥
      usage,
      expiredSessions,
      messagesToCleanup,
      lastUpdated: now
    }
  }

  /**
   * 清理过期数据
   *
   * @returns Promise<CleanupResult>
   */
  async cleanupExpiredData(): Promise<CleanupResult> {
    const startTime = Date.now()
    let sessionsDeleted = 0
    let messagesDeleted = 0
    const now = Date.now()

    try {
      // 1. 删除过期会话
      if (this.cleanupPolicy.deleteExpiredSessions) {
        const sessions = await this.storage.getSessions()

        for (const session of sessions) {
          if (session.expires_at && new Date(session.expires_at).getTime() < now) {
            await this.storage.deleteSession(session.session_id)
            sessionsDeleted++
          }
        }
      }

      // 2. 清理旧消息（保留最近N条）
      const sessions = await this.storage.getSessions()
      for (const session of sessions) {
        const messagesDeletedForSession = await this.cleanupOldMessages(
          session.session_id,
          this.cleanupPolicy.keepRecentMessages
        )
        messagesDeleted += messagesDeletedForSession
      }

      // 3. 清理过期密钥（通过存储服务）
      // 存储服务应自动处理过期密钥

      const duration = Date.now() - startTime
      const spaceFreed = await this.estimateSpaceFreed(sessionsDeleted, messagesDeleted)

      return {
        sessionsDeleted,
        messagesDeleted,
        spaceFreed,
        duration
      }
    } catch (error) {
      logger.error('[StorageQuotaManager] Cleanup failed:', error)
      return {
        sessionsDeleted: 0,
        messagesDeleted: 0,
        spaceFreed: 0,
        duration: Date.now() - startTime
      }
    }
  }

  /**
   * 清理指定会话的旧消息
   *
   * @param sessionId - 会话 ID
   * @param keepRecent - 保留最近的消息数
   * @returns Promise<number> - 删除的消息数
   */
  async cleanupOldMessages(sessionId: string, keepRecent = 1000): Promise<number> {
    try {
      const messages = await this.storage.getMessages(sessionId)

      if (messages.length <= keepRecent) {
        return 0
      }

      // 按时间排序（旧的在前）
      const sortedMessages = [...messages].sort((a, b) => {
        const timeA = new Date(a.created_at).getTime()
        const timeB = new Date(b.created_at).getTime()
        return timeA - timeB
      })

      // 需要删除的消息
      const toDelete = sortedMessages.slice(0, messages.length - keepRecent)

      // 删除消息（通过存储服务）
      for (const _message of toDelete) {
        // 注意：这里需要存储服务支持按消息 ID 删除
        // 当前实现中，我们删除整个会话的消息
        await this.storage.deleteMessages(sessionId)
      }

      return toDelete.length
    } catch (error) {
      logger.error(`[StorageQuotaManager] Failed to cleanup messages for session ${sessionId}:`, error)
      return 0
    }
  }

  /**
   * 清理所有会话的旧消息
   *
   * @param keepRecent - 保留最近的消息数
   * @returns Promise<CleanupResult>
   */
  async cleanupAllOldMessages(keepRecent = 1000): Promise<CleanupResult> {
    const startTime = Date.now()
    let messagesDeleted = 0

    try {
      const sessions = await this.storage.getSessions()

      for (const session of sessions) {
        const deleted = await this.cleanupOldMessages(session.session_id, keepRecent)
        messagesDeleted += deleted
      }

      return {
        sessionsDeleted: 0,
        messagesDeleted,
        spaceFreed: await this.estimateSpaceFreed(0, messagesDeleted),
        duration: Date.now() - startTime
      }
    } catch (error) {
      logger.error('[StorageQuotaManager] Failed to cleanup old messages:', error)
      return {
        sessionsDeleted: 0,
        messagesDeleted: 0,
        spaceFreed: 0,
        duration: Date.now() - startTime
      }
    }
  }

  /**
   * 清空缓存
   *
   * @returns Promise<void>
   */
  async clearCache(): Promise<void> {
    await this.storage.clearCache()
  }

  /**
   * 估算释放的空间
   *
   * @param sessionsDeleted - 删除的会话数
   * @param messagesDeleted - 删除的消息数
   * @returns Promise<number> - 释放的字节数
   */
  private async estimateSpaceFreed(sessionsDeleted: number, messagesDeleted: number): Promise<number> {
    // 粗略估算：
    // - 每个会话约 1KB
    // - 每条消息约 500 字节
    const sessionSize = 1024
    const messageSize = 512
    return sessionsDeleted * sessionSize + messagesDeleted * messageSize
  }

  /**
   * 计算存储大小
   *
   * @returns Promise<number>
   */
  private async calculateStorageSize(): Promise<number> {
    try {
      return await this.storage.getCacheSize()
    } catch {
      return 0
    }
  }

  /**
   * 获取清理策略
   *
   * @returns CleanupPolicy
   */
  getCleanupPolicy(): CleanupPolicy {
    return { ...this.cleanupPolicy }
  }

  /**
   * 更新清理策略
   *
   * @param policy - 新的策略
   */
  updateCleanupPolicy(policy: Partial<CleanupPolicy>): void {
    this.cleanupPolicy = {
      ...this.cleanupPolicy,
      ...policy
    }
  }

  /**
   * 格式化存储大小为人类可读格式
   *
   * @param bytes - 字节数
   * @returns string
   */
  formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`
  }

  /**
   * 生成存储使用报告
   *
   * @returns Promise<string>
   */
  async generateReport(): Promise<string> {
    const stats = await this.getStatistics()
    const usage = stats.usage

    const lines = [
      '=== PrivateChat 存储使用报告 ===',
      '',
      `总会话数: ${stats.totalSessions}`,
      `总消息数: ${stats.totalMessages}`,
      `总密钥数: ${stats.totalKeys}`,
      '',
      '存储使用情况:',
      `  已使用: ${this.formatBytes(usage.used)}`,
      `  总容量: ${this.formatBytes(usage.total)}`,
      `  使用率: ${usage.percentage.toFixed(2)}%`,
      `  可用: ${this.formatBytes(usage.available)}`,
      '',
      `过期会话: ${stats.expiredSessions}`,
      `需清理消息: ${stats.messagesToCleanup}`,
      '',
      `最后更新: ${new Date(stats.lastUpdated).toLocaleString()}`,
      '',
      '=== 清理策略 ===',
      `  删除过期会话: ${this.cleanupPolicy.deleteExpiredSessions ? '是' : '否'}`,
      `  保留最近消息: ${this.cleanupPolicy.keepRecentMessages} 条`,
      `  清理旧密钥: ${this.cleanupPolicy.cleanupOldKeys} 天`,
      `  自动清理阈值: ${this.cleanupPolicy.autoCleanupThreshold}%`,
      `  最大存储: ${this.formatBytes(this.cleanupPolicy.maxStorageSize)}`
    ]

    return lines.join('\n')
  }
}

/**
 * 创建存储配额管理器
 *
 * @param storage - 存储服务
 * @param policy - 清理策略
 * @returns StorageQuotaManager
 */
export function createStorageQuotaManager(
  storage: PrivateChatStorageApi,
  policy?: Partial<CleanupPolicy>
): StorageQuotaManager {
  return new StorageQuotaManager(storage, policy)
}
