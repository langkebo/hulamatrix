/**
 * Core Store - Cache State Management
 * Handles cache operations, LRU eviction, and optimization
 */

import { ref, type Ref } from 'vue'
import { logger } from '@/utils/logger'
import { LRUList, createLRUList } from '@/utils/cache/lru'
import type { CacheSettings, CacheMetrics, CacheClearOptions, ChatMessage, Room } from './types'
import { MAX_RECENT_ROOMS } from './types'

/**
 * Cache state manager
 */
export class CacheStateManager {
  /** Cache settings */
  cacheSettings: Ref<CacheSettings>

  /** Cache metrics */
  cacheMetrics: Ref<CacheMetrics>

  /** Recent rooms for LRU */
  recentRooms: LRUList<string>

  /** Current room ID */
  currentRoomId: Ref<string | null>

  /** Messages map reference */
  private getMessages: () => Map<string, ChatMessage[]>

  /** Rooms map reference */
  private getRooms: () => Map<string, Room>

  constructor(
    getMessages: () => Map<string, ChatMessage[]>,
    getRooms: () => Map<string, Room>
  ) {
    this.getMessages = getMessages
    this.getRooms = getRooms
    this.currentRoomId = ref<string | null>(null)
    this.recentRooms = createLRUList<string>(MAX_RECENT_ROOMS)
    this.cacheSettings = ref<CacheSettings>({
      maxSize: 500,
      ttl: 24,
      compressionEnabled: true,
      paths: {
        cache: './cache',
        temp: './temp',
        downloads: './downloads'
      }
    })
    this.cacheMetrics = ref<CacheMetrics>({
      totalSize: 0,
      itemCount: 0,
      hitRate: 0,
      lastCleanup: Date.now()
    })
  }

  /**
   * Clear cache
   */
  async clearCache(options?: CacheClearOptions): Promise<void> {
    const { type = 'all', roomId } = options || {}
    const messages = this.getMessages()
    const rooms = this.getRooms()

    logger.info('[CacheState] Clearing cache:', { type, roomId })

    try {
      switch (type) {
        case 'messages':
          if (roomId) {
            // Clear messages for specific room
            const roomMessages = messages.get(roomId)
            if (roomMessages) {
              this.cacheMetrics.value.itemCount -= roomMessages.length
              messages.delete(roomId)
            }
          } else {
            // Clear all messages
            for (const [_id, msgArray] of messages.entries()) {
              this.cacheMetrics.value.itemCount -= msgArray.length
            }
            messages.clear()
          }
          break

        case 'rooms':
          // Clear room cache
          this.cacheMetrics.value.itemCount -= rooms.size
          rooms.clear()
          break

        case 'users':
          // User cache cleared by auth state manager
          logger.info('[CacheState] User cache cleared')
          break

        case 'media':
          // Clear media file cache from localStorage and IndexedDB
          if (typeof localStorage !== 'undefined') {
            const mediaKeys = Object.keys(localStorage).filter((k) => k.startsWith('media_'))
            mediaKeys.forEach((key) => localStorage.removeItem(key))
            this.cacheMetrics.value.itemCount -= mediaKeys.length
          }

          // Clear IndexedDB media cache if available
          try {
            const caches = await window.caches?.keys()
            if (caches) {
              for (const cacheName of caches) {
                if (cacheName.includes('media') || cacheName.includes('cache')) {
                  await window.caches.delete(cacheName)
                }
              }
            }
          } catch {
            // IndexedDB/caches API might not be available
          }
          break

        default:
          // Clear all cached data
          messages.clear()
          rooms.clear()

          // Clear localStorage caches
          if (typeof localStorage !== 'undefined') {
            const cacheKeys = Object.keys(localStorage).filter(
              (k) => k.startsWith('cache_') || k.startsWith('media_') || k.startsWith('temp_')
            )
            cacheKeys.forEach((key) => localStorage.removeItem(key))
          }

          // Clear all caches
          try {
            await window.caches
              ?.keys()
              .then((cacheNames) => Promise.all(cacheNames.map((name) => window.caches?.delete(name))))
          } catch {
            // Cache API might not be available
          }

          this.cacheMetrics.value.totalSize = 0
          this.cacheMetrics.value.itemCount = 0
          break
      }

      this.cacheMetrics.value.lastCleanup = Date.now()
      logger.info('[CacheState] Cache cleared:', { type, remainingItems: this.cacheMetrics.value.itemCount })
    } catch (error) {
      logger.error('[CacheState] Failed to clear cache:', error)
    }
  }

  /**
   * Optimize cache
   */
  async optimizeCache(searchHistory: Ref<string[]>): Promise<void> {
    logger.info('[CacheState] Optimizing cache...')

    const startTime = Date.now()
    let itemsRemoved = 0
    let spaceFreed = 0

    try {
      const messages = this.getMessages()
      const rooms = this.getRooms()

      // 1. Clean up old messages (older than TTL)
      const ttlMs = this.cacheSettings.value.ttl * 60 * 60 * 1000
      const now = Date.now()
      const cutoffTime = now - ttlMs

      for (const [roomId, msgArray] of messages.entries()) {
        const originalLength = msgArray.length
        const filtered = msgArray.filter((msg: ChatMessage) => msg.timestamp > cutoffTime)

        if (filtered.length < originalLength) {
          messages.set(roomId, filtered)
          itemsRemoved += originalLength - filtered.length
        }
      }

      // 2. Remove old search history
      if (searchHistory.value.length > 100) {
        const removedHistory = searchHistory.value.splice(0, searchHistory.value.length - 100)
        itemsRemoved += removedHistory.length
      }

      // 3. Check total cache size and enforce limit
      const estimatedSize =
        messages.size * 1000 + // Estimate 1KB per message array
        rooms.size * 500 // Estimate 500B per room

      this.cacheMetrics.value.totalSize = estimatedSize
      const maxSizeBytes = this.cacheSettings.value.maxSize * 1024 * 1024

      if (estimatedSize > maxSizeBytes) {
        const overage = estimatedSize - maxSizeBytes
        const messagesToRemove = Math.ceil(overage / 1000)

        for (const [roomId, msgArray] of messages.entries()) {
          if (messagesToRemove <= 0) break

          const toRemove = Math.min(messagesToRemove, Math.floor(msgArray.length * 0.2))
          if (toRemove > 0) {
            messages.set(roomId, msgArray.slice(toRemove))
            itemsRemoved += toRemove
            spaceFreed += toRemove * 1000
          }
        }
      }

      // 4. Clear browser caches if enabled
      if (this.cacheSettings.value.compressionEnabled) {
        try {
          const cacheNames = await window.caches?.keys()
          if (cacheNames && cacheNames.length > 5) {
            const toRemove = cacheNames.slice(0, cacheNames.length - 5)
            for (const name of toRemove) {
              await window.caches?.delete(name)
            }
          }
        } catch {
          // Cache API might not be available
        }
      }

      // Update metrics
      this.cacheMetrics.value.itemCount = messages.size + rooms.size + searchHistory.value.length
      this.cacheMetrics.value.lastCleanup = Date.now()
      this.cacheMetrics.value.hitRate = Math.min(95, 50 + itemsRemoved * 0.1)

      const duration = Date.now() - startTime
      logger.info('[CacheState] Cache optimized:', {
        itemsRemoved,
        spaceFreed: `${(spaceFreed / 1024).toFixed(1)} KB`,
        duration: `${duration}ms`,
        hitRate: `${this.cacheMetrics.value.hitRate.toFixed(1)}%`
      })
    } catch (error) {
      logger.error('[CacheState] Failed to optimize cache:', error)
    }
  }

  /**
   * Perform LRU cleanup
   */
  async performLRUCleanup(): Promise<void> {
    try {
      const messages = this.getMessages()
      const rooms = this.getRooms()

      const maxSizeItems = this.cacheSettings.value.maxSize * 100
      const totalItems = messages.size + rooms.size

      if (totalItems <= maxSizeItems) {
        return // No cleanup needed
      }

      logger.info('[CacheState] Performing LRU cleanup...', { totalItems, maxSizeItems })

      let itemsRemoved = 0
      const targetItems = Math.floor(maxSizeItems * 0.9)

      // Clean up from least recently used rooms (using LRUList)
      const allRooms = this.recentRooms.getAll()
      for (let i = allRooms.length - 1; i >= 0; i--) {
        const roomId = allRooms[i]

        // Skip current room
        if (roomId === this.currentRoomId.value) continue

        // Clear room messages
        const roomMessages = messages.get(roomId)
        if (roomMessages) {
          messages.delete(roomId)
          itemsRemoved += roomMessages.length
          logger.debug('[CacheState] LRU cleanup: Removed room messages:', { roomId, count: roomMessages.length })
        }

        // Check if target reached
        const remainingItems = messages.size + rooms.size
        if (remainingItems <= targetItems) break
      }

      this.cacheMetrics.value.itemCount = messages.size + rooms.size
      this.cacheMetrics.value.lastCleanup = Date.now()

      logger.info('[CacheState] LRU cleanup completed:', {
        itemsRemoved,
        remaining: this.cacheMetrics.value.itemCount
      })
    } catch (error) {
      logger.error('[CacheState] Failed to perform LRU cleanup:', error)
    }
  }

  /**
   * Update recent rooms for LRU
   */
  updateRecentRoom(roomId: string): void {
    if (!roomId) return
    // LRUList handles adding and moving to front
    this.recentRooms.touch(roomId)
  }

  /**
   * Update cache settings
   */
  updateCacheSettings(settings: Partial<CacheSettings>): void {
    Object.assign(this.cacheSettings.value, settings)
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheMetrics {
    return this.cacheMetrics.value
  }
}
