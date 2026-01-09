/**
 * Matrix Message Sync Service
 *
 * Handles message status management, deduplication, and retry mechanisms
 * Migrated from src/services/messageSyncService.ts
 */

import { MessageStatusEnum, MsgEnum } from '@/enums'
import { logger } from '@/utils/logger'
import type { MsgType, MessageBody } from '@/services/types'

/**
 * 消息状态转换规则
 * pending -> sent -> delivered -> read
 * pending -> failed (on error)
 */
export const MESSAGE_STATUS_TRANSITIONS: Record<MessageStatusEnum, MessageStatusEnum[]> = {
  [MessageStatusEnum.PENDING]: [MessageStatusEnum.SENDING, MessageStatusEnum.SENT, MessageStatusEnum.FAILED],
  [MessageStatusEnum.SENDING]: [MessageStatusEnum.SENT, MessageStatusEnum.FAILED],
  [MessageStatusEnum.SENT]: [MessageStatusEnum.DELIVERED, MessageStatusEnum.READ, MessageStatusEnum.FAILED],
  [MessageStatusEnum.SUCCESS]: [MessageStatusEnum.DELIVERED, MessageStatusEnum.READ],
  [MessageStatusEnum.DELIVERED]: [MessageStatusEnum.READ],
  [MessageStatusEnum.READ]: [],
  [MessageStatusEnum.FAILED]: [MessageStatusEnum.PENDING, MessageStatusEnum.SENDING]
}

/**
 * 重试队列中的消息
 */
export interface RetryMessage {
  id: string
  roomId: string
  type: MsgEnum
  body: MessageBody
  retryCount: number
  maxRetries: number
  lastAttempt: number
  error?: string
  originalTimestamp: number
}

/**
 * 消息同步服务配置
 */
export interface MessageSyncConfig {
  maxRetries: number
  retryDelayMs: number
  deduplicationWindowMs: number
  maxProcessedEventIds: number
}

const DEFAULT_CONFIG: MessageSyncConfig = {
  maxRetries: 3,
  retryDelayMs: 2000,
  deduplicationWindowMs: 60000, // 1 minute
  maxProcessedEventIds: 10000
}

/**
 * 消息同步服务
 * 提供消息状态管理、去重和重试功能
 */
export class MessageSyncService {
  private static instance: MessageSyncService
  private config: MessageSyncConfig

  // 去重：已处理的eventId集合
  private processedEventIds: Set<string> = new Set()
  private eventIdTimestamps: Map<string, number> = new Map()

  // 重试队列
  private retryQueue: Map<string, RetryMessage> = new Map()
  private retryTimers: Map<string, NodeJS.Timeout> = new Map()

  // 消息状态缓存
  private messageStatusCache: Map<string, MessageStatusEnum> = new Map()

  // 状态变更回调
  private statusChangeCallbacks: Array<
    (msgId: string, oldStatus: MessageStatusEnum, newStatus: MessageStatusEnum) => void
  > = []

  // 重试回调
  private retryCallback: ((message: RetryMessage) => Promise<boolean>) | null = null

  constructor(config?: Partial<MessageSyncConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  static getInstance(config?: Partial<MessageSyncConfig>): MessageSyncService {
    if (!MessageSyncService.instance) {
      MessageSyncService.instance = new MessageSyncService(config)
    }
    return MessageSyncService.instance
  }

  // ==================== 消息状态管理 (5.1) ====================

  /**
   * 验证状态转换是否有效
   */
  isValidStatusTransition(currentStatus: MessageStatusEnum, newStatus: MessageStatusEnum): boolean {
    const allowedTransitions = MESSAGE_STATUS_TRANSITIONS[currentStatus]
    return allowedTransitions?.includes(newStatus) ?? false
  }

  /**
   * 获取消息当前状态
   */
  getMessageStatus(msgId: string): MessageStatusEnum | undefined {
    return this.messageStatusCache.get(msgId)
  }

  /**
   * 设置消息初始状态为pending
   */
  setMessagePending(msgId: string): void {
    this.messageStatusCache.set(msgId, MessageStatusEnum.PENDING)
    logger.debug('[MessageSyncService] Message set to pending:', { msgId })
  }

  /**
   * 更新消息状态
   * 返回是否更新成功
   */
  updateMessageStatus(msgId: string, newStatus: MessageStatusEnum): boolean {
    const currentStatus = this.messageStatusCache.get(msgId)

    // 如果没有当前状态，直接设置
    if (!currentStatus) {
      this.messageStatusCache.set(msgId, newStatus)
      this.notifyStatusChange(msgId, MessageStatusEnum.PENDING, newStatus)
      logger.debug('[MessageSyncService] Message status initialized:', { msgId, status: newStatus })
      return true
    }

    // 验证状态转换
    if (!this.isValidStatusTransition(currentStatus, newStatus)) {
      logger.warn('[MessageSyncService] Invalid status transition:', {
        msgId,
        currentStatus,
        newStatus
      })
      return false
    }

    // 更新状态
    this.messageStatusCache.set(msgId, newStatus)
    this.notifyStatusChange(msgId, currentStatus, newStatus)

    logger.debug('[MessageSyncService] Message status updated:', {
      msgId,
      oldStatus: currentStatus,
      newStatus
    })

    return true
  }

  /**
   * 标记消息为已发送
   */
  markAsSent(msgId: string): boolean {
    return this.updateMessageStatus(msgId, MessageStatusEnum.SENT)
  }

  /**
   * 标记消息为已送达
   */
  markAsDelivered(msgId: string): boolean {
    return this.updateMessageStatus(msgId, MessageStatusEnum.DELIVERED)
  }

  /**
   * 标记消息为已读
   */
  markAsRead(msgId: string): boolean {
    return this.updateMessageStatus(msgId, MessageStatusEnum.READ)
  }

  /**
   * 标记消息为失败
   */
  markAsFailed(msgId: string, error?: string): boolean {
    const result = this.updateMessageStatus(msgId, MessageStatusEnum.FAILED)
    if (result && error) {
      logger.error('[MessageSyncService] Message failed:', { msgId, error })
    }
    return result
  }

  /**
   * 注册状态变更回调
   */
  onStatusChange(callback: (msgId: string, oldStatus: MessageStatusEnum, newStatus: MessageStatusEnum) => void): void {
    this.statusChangeCallbacks.push(callback)
  }

  /**
   * 移除状态变更回调
   */
  offStatusChange(callback: (msgId: string, oldStatus: MessageStatusEnum, newStatus: MessageStatusEnum) => void): void {
    const index = this.statusChangeCallbacks.indexOf(callback)
    if (index > -1) {
      this.statusChangeCallbacks.splice(index, 1)
    }
  }

  private notifyStatusChange(msgId: string, oldStatus: MessageStatusEnum, newStatus: MessageStatusEnum): void {
    for (const callback of this.statusChangeCallbacks) {
      try {
        callback(msgId, oldStatus, newStatus)
      } catch (error) {
        logger.error('[MessageSyncService] Status change callback error:', error)
      }
    }
  }

  // ==================== 消息去重 (5.2) ====================

  /**
   * 检查eventId是否已处理过
   */
  isEventProcessed(eventId: string): boolean {
    return this.processedEventIds.has(eventId)
  }

  /**
   * 标记eventId为已处理
   */
  markEventProcessed(eventId: string): boolean {
    if (this.processedEventIds.has(eventId)) {
      logger.debug('[MessageSyncService] Duplicate event detected:', { eventId })
      return false // 已存在，是重复的
    }

    // 清理过期的eventId
    this.cleanupExpiredEventIds()

    // 添加新的eventId
    this.processedEventIds.add(eventId)
    this.eventIdTimestamps.set(eventId, Date.now())

    logger.debug('[MessageSyncService] Event marked as processed:', { eventId })
    return true // 新的eventId
  }

  /**
   * 处理接收到的消息，返回是否应该处理（非重复）
   */
  shouldProcessMessage(eventId: string): boolean {
    return this.markEventProcessed(eventId)
  }

  /**
   * 清理过期的eventId
   */
  private cleanupExpiredEventIds(): void {
    const now = Date.now()
    const expiredIds: string[] = []

    for (const [eventId, timestamp] of this.eventIdTimestamps) {
      if (now - timestamp > this.config.deduplicationWindowMs) {
        expiredIds.push(eventId)
      }
    }

    for (const eventId of expiredIds) {
      this.processedEventIds.delete(eventId)
      this.eventIdTimestamps.delete(eventId)
    }

    // 如果仍然超过最大数量，删除最旧的
    if (this.processedEventIds.size > this.config.maxProcessedEventIds) {
      const sortedEntries = Array.from(this.eventIdTimestamps.entries()).sort((a, b) => a[1] - b[1])

      const toRemove = sortedEntries.slice(0, this.processedEventIds.size - this.config.maxProcessedEventIds)
      for (const [eventId] of toRemove) {
        this.processedEventIds.delete(eventId)
        this.eventIdTimestamps.delete(eventId)
      }
    }

    if (expiredIds.length > 0) {
      logger.debug('[MessageSyncService] Cleaned up expired event IDs:', { count: expiredIds.length })
    }
  }

  /**
   * 获取已处理的eventId数量
   */
  getProcessedEventCount(): number {
    return this.processedEventIds.size
  }

  /**
   * 清空所有已处理的eventId
   */
  clearProcessedEvents(): void {
    this.processedEventIds.clear()
    this.eventIdTimestamps.clear()
    logger.info('[MessageSyncService] Cleared all processed events')
  }

  // ==================== 消息重试机制 (5.3) ====================

  /**
   * 设置重试回调函数
   */
  setRetryCallback(callback: (message: RetryMessage) => Promise<boolean>): void {
    this.retryCallback = callback
  }

  /**
   * 添加消息到重试队列
   */
  addToRetryQueue(message: MsgType, error?: string): void {
    const retryMessage: RetryMessage = {
      id: message.id,
      roomId: message.roomId || '',
      type: message.type,
      body: message.body,
      retryCount: 0,
      maxRetries: this.config.maxRetries,
      lastAttempt: Date.now(),
      originalTimestamp: message.sendTime || Date.now()
    }

    if (error) {
      retryMessage.error = error
    }

    this.retryQueue.set(message.id, retryMessage)
    this.markAsFailed(message.id, error)

    logger.info('[MessageSyncService] Message added to retry queue:', {
      msgId: message.id,
      roomId: message.roomId,
      error
    })

    // 安排重试
    this.scheduleRetry(message.id)
  }

  /**
   * 安排消息重试
   */
  private scheduleRetry(msgId: string): void {
    const message = this.retryQueue.get(msgId)
    if (!message) return

    // 清除现有的重试定时器
    const existingTimer = this.retryTimers.get(msgId)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // 计算延迟（指数退避）
    const delay = this.config.retryDelayMs * 2 ** message.retryCount

    const timer = setTimeout(() => {
      this.executeRetry(msgId)
    }, delay)

    this.retryTimers.set(msgId, timer)

    logger.debug('[MessageSyncService] Retry scheduled:', {
      msgId,
      retryCount: message.retryCount,
      delayMs: delay
    })
  }

  /**
   * 执行消息重试
   */
  private async executeRetry(msgId: string): Promise<void> {
    const message = this.retryQueue.get(msgId)
    if (!message) return

    // 检查是否超过最大重试次数
    if (message.retryCount >= message.maxRetries) {
      logger.warn('[MessageSyncService] Max retries exceeded:', {
        msgId,
        retryCount: message.retryCount
      })
      // 保留在队列中，但不再自动重试
      return
    }

    // 更新重试计数
    message.retryCount++
    message.lastAttempt = Date.now()

    logger.info('[MessageSyncService] Executing retry:', {
      msgId,
      retryCount: message.retryCount,
      maxRetries: message.maxRetries
    })

    // 更新状态为pending
    this.updateMessageStatus(msgId, MessageStatusEnum.PENDING)

    // 执行重试回调
    if (this.retryCallback) {
      try {
        const success = await this.retryCallback(message)

        if (success) {
          // 重试成功，从队列中移除
          this.removeFromRetryQueue(msgId)
          this.markAsSent(msgId)
          logger.info('[MessageSyncService] Retry successful:', { msgId })
        } else {
          // 重试失败，安排下一次重试
          this.markAsFailed(msgId, 'Retry failed')
          this.scheduleRetry(msgId)
        }
      } catch (error) {
        // 重试出错
        const errorMsg = error instanceof Error ? error.message : String(error)
        message.error = errorMsg
        this.markAsFailed(msgId, errorMsg)
        this.scheduleRetry(msgId)

        logger.error('[MessageSyncService] Retry error:', {
          msgId,
          error: errorMsg
        })
      }
    } else {
      logger.warn('[MessageSyncService] No retry callback set')
    }
  }

  /**
   * 手动重试消息
   */
  async retryMessage(msgId: string): Promise<boolean> {
    const message = this.retryQueue.get(msgId)
    if (!message) {
      logger.warn('[MessageSyncService] Message not in retry queue:', { msgId })
      return false
    }

    // 重置重试计数
    message.retryCount = 0

    // 执行重试
    await this.executeRetry(msgId)

    return !this.retryQueue.has(msgId) // 如果不在队列中了，说明成功了
  }

  /**
   * 从重试队列中移除消息
   */
  removeFromRetryQueue(msgId: string): void {
    this.retryQueue.delete(msgId)

    const timer = this.retryTimers.get(msgId)
    if (timer) {
      clearTimeout(timer)
      this.retryTimers.delete(msgId)
    }

    logger.debug('[MessageSyncService] Message removed from retry queue:', { msgId })
  }

  /**
   * 获取重试队列中的所有消息
   */
  getRetryQueue(): RetryMessage[] {
    return Array.from(this.retryQueue.values())
  }

  /**
   * 获取重试队列大小
   */
  getRetryQueueSize(): number {
    return this.retryQueue.size
  }

  /**
   * 检查消息是否在重试队列中
   */
  isInRetryQueue(msgId: string): boolean {
    return this.retryQueue.has(msgId)
  }

  /**
   * 获取消息的重试信息
   */
  getRetryInfo(msgId: string): RetryMessage | undefined {
    return this.retryQueue.get(msgId)
  }

  /**
   * 清空重试队列
   */
  clearRetryQueue(): void {
    // 清除所有定时器
    for (const timer of this.retryTimers.values()) {
      clearTimeout(timer)
    }

    this.retryQueue.clear()
    this.retryTimers.clear()

    logger.info('[MessageSyncService] Retry queue cleared')
  }

  // ==================== 清理和重置 ====================

  /**
   * 清理所有状态
   */
  cleanup(): void {
    this.clearProcessedEvents()
    this.clearRetryQueue()
    this.messageStatusCache.clear()
    this.statusChangeCallbacks = []
    this.retryCallback = null

    logger.info('[MessageSyncService] Service cleaned up')
  }

  /**
   * 获取服务统计信息
   */
  getStats(): {
    processedEventCount: number
    retryQueueSize: number
    statusCacheSize: number
  } {
    return {
      processedEventCount: this.processedEventIds.size,
      retryQueueSize: this.retryQueue.size,
      statusCacheSize: this.messageStatusCache.size
    }
  }
}

// 导出单例实例
export const messageSyncService = MessageSyncService.getInstance()
