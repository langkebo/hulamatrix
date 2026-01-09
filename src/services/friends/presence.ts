/**
 * Presence Management - Friend presence tracking and caching
 * Handles presence subscriptions, cache management, and presence updates
 */

import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'
import type { PresenceCacheEntry, PresenceUpdateEvent, PresenceUpdateCallback, Friend } from './types'

/**
 * Presence Manager
 */
export class PresenceManager {
  private initialized = false

  /** Presence缓存 */
  private presenceCache = new Map<string, PresenceCacheEntry>()

  /** Presence缓存TTL（毫秒） */
  private readonly PRESENCE_CACHE_TTL = 60000 // 1分钟

  /** Presence更新事件监听器 */
  private presenceListeners = new Set<PresenceUpdateCallback>()

  /** 是否已订阅presence事件 */
  private presenceSubscribed = false

  /** Presence事件处理器引用 */
  private presenceEventHandler: ((event: unknown) => void) | null = null

  /**
   * Initialize presence management
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      // 订阅presence事件
      this.subscribeToPresence()

      this.initialized = true
      logger.info('[PresenceManager] Initialized')
    } catch (error) {
      logger.error('[PresenceManager] Failed to initialize:', error)
      throw error
    }
  }

  /**
   * 订阅Presence事件
   */
  private subscribeToPresence(): void {
    if (this.presenceSubscribed) {
      return
    }

    const client = matrixClientService.getClient()
    if (!client) {
      logger.warn('[PresenceManager] Cannot subscribe: no client')
      return
    }

    try {
      // 监听 m.presence 事件
      this.presenceEventHandler = (event: unknown) => {
        const presenceEvent = event as {
          getType?: () => string
          getContent?: () => { sender?: string; presence?: string; status_msg?: string; last_active_ago?: number }
        }

        if (presenceEvent.getType?.() !== 'm.presence') {
          return
        }

        const content = presenceEvent.getContent?.()
        if (!content) {
          return
        }

        const { sender, presence, last_active_ago } = content
        if (!sender || !presence) {
          return
        }

        // 更新缓存
        this.updatePresenceCache(sender, presence as 'online' | 'offline' | 'unavailable' | 'away', last_active_ago)

        // 通知监听器
        const updateEvent: PresenceUpdateEvent = {
          userId: sender,
          presence: presence as 'online' | 'offline' | 'unavailable' | 'away',
          lastActiveAgo: last_active_ago
        }

        this.notifyPresenceListeners(updateEvent)
      }

      const clientLike = client as { on: (event: string, handler: (event: unknown) => void) => void }
      clientLike.on('Room.timeline', this.presenceEventHandler)

      this.presenceSubscribed = true
      logger.info('[PresenceManager] Subscribed to presence events')
    } catch (error) {
      logger.error('[PresenceManager] Failed to subscribe to presence:', error)
    }
  }

  /**
   * 取消订阅Presence事件
   */
  private unsubscribeFromPresence(): void {
    if (!this.presenceSubscribed || !this.presenceEventHandler) {
      return
    }

    const client = matrixClientService.getClient()
    if (!client) {
      return
    }

    try {
      const clientLike = client as { off: (event: string, handler: (event: unknown) => void) => void }
      clientLike.off('Room.timeline', this.presenceEventHandler)

      this.presenceSubscribed = false
      this.presenceEventHandler = null
      logger.info('[PresenceManager] Unsubscribed from presence events')
    } catch (error) {
      logger.error('[PresenceManager] Failed to unsubscribe from presence:', error)
    }
  }

  /**
   * 更新Presence缓存
   */
  private updatePresenceCache(
    userId: string,
    presence: 'online' | 'offline' | 'unavailable' | 'away',
    lastActiveAgo?: number
  ): void {
    this.presenceCache.set(userId, {
      presence,
      lastActiveAgo,
      timestamp: Date.now()
    })
  }

  /**
   * 通知Presence监听器
   */
  private notifyPresenceListeners(event: PresenceUpdateEvent): void {
    this.presenceListeners.forEach((listener) => {
      try {
        listener(event)
      } catch (error) {
        logger.error('[PresenceManager] Listener error:', error)
      }
    })
  }

  /**
   * 获取用户Presence
   */
  async getPresence(userId: string): Promise<'online' | 'offline' | 'unavailable' | 'away'> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    // 检查缓存
    const cached = this.presenceCache.get(userId)
    if (cached && Date.now() - cached.timestamp < this.PRESENCE_CACHE_TTL) {
      return cached.presence
    }

    try {
      const getUserMethod = client.getUser as
        | ((userId: string) => {
            getPresence?: () => Promise<{ presence: string }>
          })
        | undefined
      const user = getUserMethod?.(userId)

      if (!user) {
        return 'offline'
      }

      const presenceData = await user.getPresence?.()
      const presence = presenceData?.presence || 'offline'

      // 更新缓存
      this.updatePresenceCache(userId, presence as 'online' | 'offline' | 'unavailable' | 'away')

      return presence as 'online' | 'offline' | 'unavailable' | 'away'
    } catch (error) {
      logger.warn('[PresenceManager] Failed to get presence:', { userId, error })
      return 'offline'
    }
  }

  /**
   * 获取缓存的Presence
   */
  getCachedPresence(userId: string): PresenceCacheEntry | undefined {
    const cached = this.presenceCache.get(userId)
    if (cached && Date.now() - cached.timestamp < this.PRESENCE_CACHE_TTL) {
      return cached
    }
    return undefined
  }

  /**
   * 清空Presence缓存
   */
  clearPresenceCache(): void {
    this.presenceCache.clear()
    logger.debug('[PresenceManager] Presence cache cleared')
  }

  /**
   * 为好友列表同步Presence
   */
  async syncPresenceForFriends(friends: Friend[]): Promise<Friend[]> {
    const _userIds = friends.map((f) => f.userId)
    const enrichedFriends = [...friends]

    for (const friend of enrichedFriends) {
      try {
        const presence = await this.getPresence(friend.userId)
        friend.presence = presence

        const cached = this.getCachedPresence(friend.userId)
        if (cached?.lastActiveAgo) {
          friend.lastActiveAgo = cached.lastActiveAgo
        }
      } catch (error) {
        logger.warn('[PresenceManager] Failed to sync presence:', { userId: friend.userId, error })
        friend.presence = 'offline'
      }
    }

    return enrichedFriends
  }

  /**
   * 丰富好友列表的Presence信息
   */
  async enrichWithPresence(friends: Friend[]): Promise<void> {
    const _userIds = friends.map((f) => f.userId)
    const enrichedFriends = [...friends]

    for (const friend of enrichedFriends) {
      const cached = this.getCachedPresence(friend.userId)
      if (cached && Date.now() - cached.timestamp < this.PRESENCE_CACHE_TTL) {
        friend.presence = cached.presence
        friend.lastActiveAgo = cached.lastActiveAgo
      } else {
        try {
          const presence = await this.getPresence(friend.userId)
          friend.presence = presence

          const newCached = this.getCachedPresence(friend.userId)
          if (newCached?.lastActiveAgo) {
            friend.lastActiveAgo = newCached.lastActiveAgo
          }
        } catch (error) {
          logger.warn('[PresenceManager] Failed to enrich presence:', { userId: friend.userId, error })
          friend.presence = 'offline'
        }
      }
    }
  }

  /**
   * 添加Presence更新监听器
   */
  onPresenceUpdate(callback: PresenceUpdateCallback): void {
    this.presenceListeners.add(callback)
  }

  /**
   * 移除Presence更新监听器
   */
  offPresenceUpdate(callback: PresenceUpdateCallback): void {
    this.presenceListeners.delete(callback)
  }

  /**
   * 检查是否已订阅Presence
   */
  isPresenceSubscribed(): boolean {
    return this.presenceSubscribed
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.unsubscribeFromPresence()
    this.presenceListeners.clear()
    this.presenceCache.clear()
    this.initialized = false
  }
}
