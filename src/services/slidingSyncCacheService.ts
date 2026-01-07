/**
 * SlidingSync Cache Service
 * Unified cache management for SlidingSync, FriendsClient, and PrivateChat
 *
 * @module services/slidingSyncCacheService
 */

import { logger } from '@/utils/logger'
import type { CacheEntry } from '@/types/sliding-sync'

/**
 * Cache configuration
 */
interface CacheConfig {
  LISTS: number // 列表缓存: 5分钟
  ROOMS: number // 房间详情: 10分钟
  FRIENDS: number // 好友列表: 5分钟
  PRESENCE: number // 在线状态: 1分钟
  MESSAGES: number // 消息历史: 30分钟
  DEFAULT: number // 默认: 5分钟
}

/**
 * Cache statistics
 */
interface CacheStats {
  hits: number
  misses: number
  size: number
}

/**
 * SlidingSync Cache Service
 * Provides unified caching with IndexedDB and in-memory fallback
 */
export class SlidingSyncCacheService {
  private static instance: SlidingSyncCacheService

  // IndexedDB 配置
  private readonly CACHE_DB = 'sliding-sync-cache'
  private readonly CACHE_VERSION = 1
  private readonly STORE_NAME = 'cache'

  // 内存缓存
  private memoryCache: Map<string, CacheEntry> = new Map()

  // IndexedDB 实例
  private db: IDBDatabase | null = null

  // 缓存 TTL 配置（毫秒）
  private readonly CACHE_TTL: CacheConfig = {
    LISTS: 5 * 60 * 1000, // 5分钟
    ROOMS: 10 * 60 * 1000, // 10分钟
    FRIENDS: 5 * 60 * 1000, // 5分钟（与 FriendsClient 一致）
    PRESENCE: 1 * 60 * 1000, // 1分钟
    MESSAGES: 30 * 60 * 1000, // 30分钟
    DEFAULT: 5 * 60 * 1000 // 默认 5 分钟
  }

  // 统计信息
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0
  }

  // 是否使用 IndexedDB
  private useIndexedDB = true

  /**
   * Get singleton instance
   */
  static getInstance(): SlidingSyncCacheService {
    if (!SlidingSyncCacheService.instance) {
      SlidingSyncCacheService.instance = new SlidingSyncCacheService()
    }
    return SlidingSyncCacheService.instance
  }

  /**
   * Initialize cache service
   */
  async initialize(): Promise<void> {
    try {
      // 尝试打开 IndexedDB
      if (typeof indexedDB !== 'undefined') {
        await this.openDB()
        logger.info('[CacheService] IndexedDB cache initialized')
      } else {
        this.useIndexedDB = false
        logger.info('[CacheService] Using memory-only cache')
      }
    } catch (error) {
      this.useIndexedDB = false
      this.db = null
      logger.warn('[CacheService] IndexedDB not available, using memory cache:', error)
    }
  }

  /**
   * Get cached data
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      // 先查内存缓存
      const memEntry = this.memoryCache.get(key)
      if (memEntry && !this.isExpired(memEntry)) {
        this.stats.hits++
        return memEntry.data as T
      }

      // 如果内存缓存过期或不存在，尝试 IndexedDB
      if (this.useIndexedDB && this.db) {
        const entry = await this.getFromIndexedDB(key)
        if (entry && !this.isExpired(entry)) {
          // 回填内存缓存
          this.memoryCache.set(key, entry)
          this.stats.hits++
          return entry.data as T
        }
      }

      this.stats.misses++
      return null
    } catch (error) {
      logger.error('[CacheService] Failed to get cache:', error)
      this.stats.misses++
      return null
    }
  }

  /**
   * Set cache
   */
  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    try {
      const entry: CacheEntry = {
        key,
        data,
        timestamp: Date.now(),
        ttl: ttl || this.getTTLForKey(key)
      }

      // 写入内存缓存
      this.memoryCache.set(key, entry)

      // 写入 IndexedDB
      if (this.useIndexedDB && this.db) {
        await this.setToIndexedDB(entry)
      }

      this.updateStats()
      logger.debug('[CacheService] Cache set:', key)
    } catch (error) {
      logger.error('[CacheService] Failed to set cache:', error)
    }
  }

  /**
   * Delete cache entry
   */
  async delete(key: string): Promise<void> {
    try {
      // 从内存缓存删除
      this.memoryCache.delete(key)

      // 从 IndexedDB 删除
      if (this.useIndexedDB && this.db) {
        await this.deleteFromIndexedDB(key)
      }

      this.updateStats()
      logger.debug('[CacheService] Cache deleted:', key)
    } catch (error) {
      logger.error('[CacheService] Failed to delete cache:', error)
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    try {
      // 清空内存缓存
      this.memoryCache.clear()

      // 清空 IndexedDB
      if (this.useIndexedDB && this.db) {
        await this.clearIndexedDB()
      }

      this.stats = { hits: 0, misses: 0, size: 0 }
      logger.info('[CacheService] All cache cleared')
    } catch (error) {
      logger.error('[CacheService] Failed to clear cache:', error)
    }
  }

  /**
   * Cleanup expired entries
   */
  async cleanup(): Promise<void> {
    const _now = Date.now()
    const expiredKeys: string[] = []

    // 检查内存缓存
    for (const [key, entry] of this.memoryCache.entries()) {
      if (this.isExpired(entry)) {
        expiredKeys.push(key)
        this.memoryCache.delete(key)
      }
    }

    // 清理 IndexedDB
    if (this.useIndexedDB && this.db) {
      await this.cleanupIndexedDB()
    }

    if (expiredKeys.length > 0) {
      logger.debug('[CacheService] Cleaned up expired entries:', expiredKeys.length)
    }

    this.updateStats()
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats }
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0, size: 0 }
  }

  /**
   * Get cache hit rate
   */
  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses
    return total > 0 ? this.stats.hits / total : 0
  }

  // ========== Private Methods ==========

  /**
   * Get TTL for key based on prefix
   */
  private getTTLForKey(key: string): number {
    if (key.startsWith('list:')) return this.CACHE_TTL.LISTS
    if (key.startsWith('room:')) return this.CACHE_TTL.ROOMS
    if (key.startsWith('friends:')) return this.CACHE_TTL.FRIENDS
    if (key.startsWith('presence:')) return this.CACHE_TTL.PRESENCE
    if (key.startsWith('messages:')) return this.CACHE_TTL.MESSAGES
    return this.CACHE_TTL.DEFAULT
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    const now = Date.now()
    return now - entry.timestamp > entry.ttl
  }

  /**
   * Update cache statistics
   */
  private updateStats(): void {
    this.stats.size = this.memoryCache.size
  }

  /**
   * Open IndexedDB
   */
  private async openDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.CACHE_DB, this.CACHE_VERSION)

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'))
      }

      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // 创建对象存储
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'key' })

          // 创建索引
          store.createIndex('timestamp', 'timestamp', { unique: false })
          store.createIndex('ttl', 'ttl', { unique: false })
        }
      }
    })
  }

  /**
   * Get entry from IndexedDB
   */
  private async getFromIndexedDB(key: string): Promise<CacheEntry | null> {
    if (!this.db) return null

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.STORE_NAME, 'readonly')
      const store = transaction.objectStore(this.STORE_NAME)
      const request = store.get(key)

      request.onsuccess = () => {
        resolve(request.result || null)
      }

      request.onerror = () => {
        reject(new Error('Failed to get from IndexedDB'))
      }
    })
  }

  /**
   * Set entry in IndexedDB
   */
  private async setToIndexedDB(entry: CacheEntry): Promise<void> {
    if (!this.db) return

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.STORE_NAME, 'readwrite')
      const store = transaction.objectStore(this.STORE_NAME)
      const request = store.put(entry)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(new Error('Failed to set in IndexedDB'))
      }
    })
  }

  /**
   * Delete entry from IndexedDB
   */
  private async deleteFromIndexedDB(key: string): Promise<void> {
    if (!this.db) return

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.STORE_NAME, 'readwrite')
      const store = transaction.objectStore(this.STORE_NAME)
      const request = store.delete(key)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(new Error('Failed to delete from IndexedDB'))
      }
    })
  }

  /**
   * Clear IndexedDB
   */
  private async clearIndexedDB(): Promise<void> {
    if (!this.db) return

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.STORE_NAME, 'readwrite')
      const store = transaction.objectStore(this.STORE_NAME)
      const request = store.clear()

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(new Error('Failed to clear IndexedDB'))
      }
    })
  }

  /**
   * Cleanup expired entries in IndexedDB
   */
  private async cleanupIndexedDB(): Promise<void> {
    if (!this.db) return

    const now = Date.now()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.STORE_NAME, 'readwrite')
      const store = transaction.objectStore(this.STORE_NAME)
      const index = store.index('timestamp')
      const request = index.openCursor()

      request.onsuccess = () => {
        const cursor = request.result
        if (cursor) {
          const entry = cursor.value as CacheEntry
          if (now - entry.timestamp > entry.ttl) {
            cursor.delete()
          }
          cursor.continue()
        } else {
          resolve()
        }
      }

      request.onerror = () => {
        reject(new Error('Failed to cleanup IndexedDB'))
      }
    })
  }

  /**
   * Dispose cache service
   */
  dispose(): void {
    this.memoryCache.clear()
    if (this.db) {
      this.db.close()
      this.db = null
    }
    logger.info('[CacheService] Disposed')
  }
}

// Export singleton instance
export const slidingSyncCache = SlidingSyncCacheService.getInstance()

// Export convenience functions
export async function cacheGet<T>(key: string): Promise<T | null> {
  return slidingSyncCache.get<T>(key)
}

export async function cacheSet<T>(key: string, data: T, ttl?: number): Promise<void> {
  return slidingSyncCache.set(key, data, ttl)
}

export async function cacheDelete(key: string): Promise<void> {
  return slidingSyncCache.delete(key)
}

export async function cacheClear(): Promise<void> {
  return slidingSyncCache.clear()
}

export async function cacheCleanup(): Promise<void> {
  return slidingSyncCache.cleanup()
}
