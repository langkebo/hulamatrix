/**
 * SlidingSync Event Aggregator
 * Unified event aggregation for SlidingSync, FriendsClient, and PrivateChat
 *
 * @module services/slidingSyncEventAggregator
 */

import { EventEmitter } from 'node:events'
import { logger } from '@/utils/logger'
import type { UnifiedEventData, EventMapping, UnifiedEventType } from '@/types/sliding-sync'

/**
 * Event source type
 */
type EventSource = 'FriendsClient' | 'PrivateChat' | 'SlidingSync' | 'TraditionalSync'

/**
 * Event aggregator configuration
 */
interface AggregatorConfig {
  /** Enable debug logging */
  debug?: boolean
  /** Enable event deduplication */
  enableDeduplication?: boolean
  /** Deduplication window (ms) */
  deduplicationWindow?: number
}

/**
 * Unified event callback
 */
type UnifiedEventCallback = (data: UnifiedEventData) => void

/**
 * SlidingSync Event Aggregator
 * Aggregates events from multiple sources into unified events
 */
export class SlidingSyncEventAggregator extends EventEmitter {
  private static instance: SlidingSyncEventAggregator

  // 事件映射配置
  private eventMapping: EventMapping = new Map([
    // FriendsClient 事件 -> 统一事件
    ['FriendsClient.friend.add', ['dm.updated', 'friend.added']],
    ['FriendsClient.friend.remove', ['dm.updated', 'friend.removed']],
    ['FriendsClient.request.received', ['dm.request.received']],
    ['FriendsClient.request.accepted', ['dm.updated', 'friend.accepted']],

    // PrivateChat 事件 -> 统一事件
    ['PrivateChat.session.created', ['session.created']],
    ['PrivateChat.session.deleted', ['session.deleted']],
    ['PrivateChat.message.received', ['message.received']],
    ['PrivateChat.message.sent', ['message.sent']],

    // SlidingSync 事件 -> 统一事件
    ['SlidingSync.Room', ['room.updated']],
    ['SlidingSync.RoomData', ['room.updated']],
    ['SlidingSync.List', ['list.updated']],

    // 传统同步事件 -> 统一事件
    ['TraditionalSync.Presence', ['presence.updated']]
  ])

  // 已注册的事件源
  private registeredSources: Set<EventSource> = new Set()

  // 配置
  private config: AggregatorConfig = {
    debug: false,
    enableDeduplication: true,
    deduplicationWindow: 1000 // 1秒去重窗口
  }

  // 事件去重缓存
  private deduplicationCache: Map<string, number> = new Map()

  // 统计信息
  private stats = {
    eventsReceived: 0,
    eventsEmitted: 0,
    eventsDeduplicated: 0
  }

  /**
   * Get singleton instance
   */
  static getInstance(): SlidingSyncEventAggregator {
    if (!SlidingSyncEventAggregator.instance) {
      SlidingSyncEventAggregator.instance = new SlidingSyncEventAggregator()
    }
    return SlidingSyncEventAggregator.instance
  }

  /**
   * Set configuration
   */
  setConfig(config: Partial<AggregatorConfig>): void {
    this.config = { ...this.config, ...config }
    logger.debug('[EventAggregator] Config updated:', this.config)
  }

  /**
   * Register event source
   */
  registerEventSource(sourceName: EventSource, eventEmitter: EventEmitter): void {
    try {
      logger.info('[EventAggregator] Registering event source:', sourceName)

      // 获取事件列表
      const eventNames = eventEmitter.eventNames?.() || []

      // 为每个事件注册监听器
      for (const eventName of eventNames) {
        const _fullEventName = `${sourceName}.${String(eventName)}`
        eventEmitter.on(eventName, (data) => {
          this.aggregateEvent(sourceName, String(eventName), data)
        })
      }

      this.registeredSources.add(sourceName)
      logger.info('[EventAggregator] Event source registered:', { sourceName, count: eventNames.length })
    } catch (error) {
      logger.error('[EventAggregator] Failed to register event source:', { sourceName, error })
    }
  }

  /**
   * Unregister event source
   */
  unregisterEventSource(sourceName: EventSource, eventEmitter: EventEmitter): void {
    try {
      logger.info('[EventAggregator] Unregistering event source:', sourceName)

      // 移除所有监听器
      eventEmitter.removeAllListeners()

      this.registeredSources.delete(sourceName)
      logger.info('[EventAggregator] Event source unregistered:', sourceName)
    } catch (error) {
      logger.error('[EventAggregator] Failed to unregister event source:', { sourceName, error })
    }
  }

  /**
   * Subscribe to unified event
   */
  subscribe(unifiedEvent: UnifiedEventType, callback: UnifiedEventCallback): () => void {
    this.on(unifiedEvent, callback)

    // 返回取消订阅函数
    return () => {
      this.removeListener(unifiedEvent, callback)
    }
  }

  /**
   * Aggregate event from source
   */
  private aggregateEvent(source: EventSource, originalEvent: string, data: unknown): void {
    try {
      this.stats.eventsReceived++

      const key = `${source}.${originalEvent}`

      // 去重检查
      if (this.config.enableDeduplication && this.isDuplicate(key, data)) {
        this.stats.eventsDeduplicated++
        if (this.config.debug) {
          logger.debug('[EventAggregator] Event deduplicated:', key)
        }
        return
      }

      // 记录去重
      this.recordDeduplication(key)

      // 获取映射的统一事件
      const unifiedEvents = this.eventMapping.get(key) || []

      // 如果没有映射，记录警告
      if (unifiedEvents.length === 0 && this.config.debug) {
        logger.debug('[EventAggregator] No mapping for event:', key)
      }

      // 触发统一事件
      const eventData: UnifiedEventData = {
        source,
        originalEvent,
        data,
        timestamp: Date.now()
      }

      for (const unifiedEvent of unifiedEvents) {
        this.emit(unifiedEvent, eventData as any)
        this.stats.eventsEmitted++

        if (this.config.debug) {
          logger.debug('[EventAggregator] Event emitted:', { event: unifiedEvent, data: eventData })
        }
      }
    } catch (error) {
      logger.error('[EventAggregator] Failed to aggregate event:', error)
    }
  }

  /**
   * Check if event is duplicate
   */
  private isDuplicate(key: string, data: unknown): boolean {
    const now = Date.now()
    const window = this.config.deduplicationWindow || 1000

    // 简单的去重逻辑：相同事件类型 + 相同数据 + 时间窗口内
    const cacheKey = this.generateCacheKey(key, data)
    const lastTime = this.deduplicationCache.get(cacheKey)

    if (lastTime && now - lastTime < window) {
      return true
    }

    return false
  }

  /**
   * Record deduplication
   */
  private recordDeduplication(key: string): void {
    // 清理过期的去重缓存
    this.cleanupDeduplicationCache()

    // 生成缓存键并记录
    // 简化处理：只使用事件类型和时间戳
    const cacheKey = `${key}_${Date.now()}`
    this.deduplicationCache.set(cacheKey, Date.now())
  }

  /**
   * Generate cache key for deduplication
   */
  private generateCacheKey(key: string, data: unknown): string {
    // 简化处理：使用事件类型和数据内容的哈希
    try {
      const dataStr = JSON.stringify(data)
      return `${key}_${dataStr.slice(0, 100)}` // 限制长度
    } catch {
      return `${key}_${String(data)}`
    }
  }

  /**
   * Cleanup expired deduplication cache entries
   */
  private cleanupDeduplicationCache(): void {
    const now = Date.now()
    const window = (this.config.deduplicationWindow || 1000) * 2 // 2倍窗口时间清理

    for (const [key, time] of this.deduplicationCache.entries()) {
      if (now - time > window) {
        this.deduplicationCache.delete(key)
      }
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      registeredSources: Array.from(this.registeredSources),
      deduplicationCacheSize: this.deduplicationCache.size,
      deduplicationRate: this.stats.eventsReceived > 0 ? this.stats.eventsDeduplicated / this.stats.eventsReceived : 0
    }
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      eventsReceived: 0,
      eventsEmitted: 0,
      eventsDeduplicated: 0
    }
    logger.debug('[EventAggregator] Statistics reset')
  }

  /**
   * Clear deduplication cache
   */
  clearDeduplicationCache(): void {
    this.deduplicationCache.clear()
    logger.debug('[EventAggregator] Deduplication cache cleared')
  }

  /**
   * Dispose aggregator
   */
  dispose(): void {
    this.removeAllListeners()
    this.registeredSources.clear()
    this.deduplicationCache.clear()
    this.resetStats()
    logger.info('[EventAggregator] Disposed')
  }
}

// Export singleton instance
export const slidingSyncEventAggregator = SlidingSyncEventAggregator.getInstance()

// Export convenience function to register sources
export function registerEventSource(source: EventSource, emitter: EventEmitter): void {
  slidingSyncEventAggregator.registerEventSource(source, emitter)
}

// Export convenience function to subscribe to events
export function subscribeToEvent(event: UnifiedEventType, callback: UnifiedEventCallback): () => void {
  return slidingSyncEventAggregator.subscribe(event, callback)
}
