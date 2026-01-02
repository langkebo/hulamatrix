/**
 * IndexedDB Persistent Media Cache
 *
 * Provides persistent media caching using IndexedDB for offline access
 * and faster loading of previously downloaded media.
 */

import { logger } from '@/utils/logger'

const DB_NAME = 'hula-media-cache'
const DB_VERSION = 1
const STORE_NAME = 'media'
const MAX_CACHE_SIZE = 500 * 1024 * 1024 // 500MB default

interface CacheEntry {
  url: string
  blob: Blob
  timestamp: number
  size: number
  mimeType?: string
  headers?: Record<string, string>
}

interface CacheMetadata {
  url: string
  size: number
  timestamp: number
}

interface CacheStats {
  totalSize: number
  itemCount: number
  byDomain: Record<string, { count: number; size: number }>
}

/**
 * IndexedDB Media Cache class
 */
export class PersistentMediaCache {
  private db: IDBDatabase | null = null
  private maxSize: number
  private currentSize: number = 0
  private initialized: boolean = false

  constructor(maxSize = MAX_CACHE_SIZE) {
    this.maxSize = maxSize
  }

  /**
   * Initialize the IndexedDB database
   */
  async init(): Promise<void> {
    if (this.initialized) return

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        logger.error('[PersistentMediaCache] Failed to open database:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        this.initialized = true
        logger.info('[PersistentMediaCache] Database initialized')
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create object store for media blobs
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'url' })

          // Create indexes for metadata queries
          store.createIndex('timestamp', 'timestamp', { unique: false })
          store.createIndex('size', 'size', { unique: false })
        }
      }
    })
  }

  /**
   * Put a blob into the cache
   */
  async put(url: string, blob: Blob, metadata?: Partial<CacheEntry>): Promise<void> {
    await this.ensureInitialized()

    const entry: CacheEntry = {
      url,
      blob,
      timestamp: Date.now(),
      size: blob.size,
      mimeType: blob.type,
      ...metadata
    }

    // Check if we need to make space
    await this.ensureSpace(entry.size)

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put(entry)

      request.onsuccess = () => {
        this.currentSize += entry.size
        logger.debug('[PersistentMediaCache] Cached:', { url, size: entry.size, unit: 'bytes' })
        resolve(undefined)
      }

      request.onerror = () => {
        logger.error('[PersistentMediaCache] Failed to put:', request.error)
        reject(request.error)
      }
    })
  }

  /**
   * Get a blob from the cache
   */
  async get(url: string): Promise<Blob | undefined> {
    await this.ensureInitialized()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(url)

      request.onsuccess = () => {
        const entry = request.result as CacheEntry | undefined
        if (entry) {
          logger.debug('[PersistentMediaCache] Cache hit:', url)
          resolve(entry.blob)
        } else {
          logger.debug('[PersistentMediaCache] Cache miss:', url)
          resolve(undefined)
        }
      }

      request.onerror = () => {
        logger.error('[PersistentMediaCache] Failed to get:', request.error)
        reject(request.error)
      }
    })
  }

  /**
   * Check if a URL is cached
   */
  async has(url: string): Promise<boolean> {
    await this.ensureInitialized()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.count(url)

      request.onsuccess = () => {
        resolve(request.result > 0)
      }

      request.onerror = () => {
        logger.error('[PersistentMediaCache] Failed to check:', request.error)
        reject(request.error)
      }
    })
  }

  /**
   * Delete a specific entry from cache
   */
  async delete(url: string): Promise<void> {
    await this.ensureInitialized()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const getRequest = store.get(url)

      getRequest.onsuccess = () => {
        const entry = getRequest.result as CacheEntry | undefined
        const size = entry?.size || 0

        const deleteRequest = store.delete(url)

        deleteRequest.onsuccess = () => {
          this.currentSize -= size
          logger.debug('[PersistentMediaCache] Deleted:', url)
          resolve()
        }

        deleteRequest.onerror = () => {
          logger.error('[PersistentMediaCache] Failed to delete:', deleteRequest.error)
          reject(deleteRequest.error)
        }
      }

      getRequest.onerror = () => {
        logger.error('[PersistentMediaCache] Failed to get for delete:', getRequest.error)
        reject(getRequest.error)
      }
    })
  }

  /**
   * Clear all cached media
   */
  async clear(): Promise<void> {
    await this.ensureInitialized()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.clear()

      request.onsuccess = () => {
        this.currentSize = 0
        logger.info('[PersistentMediaCache] Cache cleared')
        resolve()
      }

      request.onerror = () => {
        logger.error('[PersistentMediaCache] Failed to clear:', request.error)
        reject(request.error)
      }
    })
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    await this.ensureInitialized()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const getAllRequest = store.getAll()

      getAllRequest.onsuccess = () => {
        const entries = getAllRequest.result as CacheEntry[]

        const stats: CacheStats = {
          totalSize: 0,
          itemCount: entries.length,
          byDomain: {}
        }

        entries.forEach((entry) => {
          stats.totalSize += entry.size

          try {
            const url = new URL(entry.url)
            const domain = url.hostname

            if (!stats.byDomain[domain]) {
              stats.byDomain[domain] = { count: 0, size: 0 }
            }

            stats.byDomain[domain].count++
            stats.byDomain[domain].size += entry.size
          } catch {
            // Invalid URL, skip
          }
        })

        this.currentSize = stats.totalSize
        resolve(stats)
      }

      getAllRequest.onerror = () => {
        logger.error('[PersistentMediaCache] Failed to get stats:', getAllRequest.error)
        reject(getAllRequest.error)
      }
    })
  }

  /**
   * Clean up old entries to free space
   */
  async cleanup(maxAge = 30 * 24 * 60 * 60 * 1000): Promise<void> {
    await this.ensureInitialized()

    const cutoffTime = Date.now() - maxAge

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const index = store.index('timestamp')
      const range = IDBKeyRange.upperBound(cutoffTime)
      const request = index.openCursor(range)

      let deleted = 0

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          const entry = cursor.value as CacheEntry
          this.currentSize -= entry.size
          cursor.delete()
          deleted++
          cursor.continue()
        } else {
          logger.info('[PersistentMediaCache] Cleaned up', deleted, 'old entries')
          resolve()
        }
      }

      request.onerror = () => {
        logger.error('[PersistentMediaCache] Failed to cleanup:', request.error)
        reject(request.error)
      }
    })
  }

  /**
   * Ensure database is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.init()
    }
  }

  /**
   * Ensure there's enough space for a new entry
   * Uses LRU eviction if needed
   */
  private async ensureSpace(requiredSize: number): Promise<void> {
    if (this.currentSize + requiredSize <= this.maxSize) {
      return
    }

    // Calculate how much to free (target: 80% of max size)
    const targetSize = Math.floor(this.maxSize * 0.8)
    const toFree = this.currentSize + requiredSize - targetSize

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const index = store.index('timestamp')

      // Get all entries sorted by timestamp (oldest first)
      const getAllRequest = index.getAll()

      getAllRequest.onsuccess = () => {
        const entries = getAllRequest.result as CacheEntry[]
        let freed = 0

        // Delete oldest entries until we have enough space
        const deleteTransaction = this.db!.transaction([STORE_NAME], 'readwrite')
        const deleteStore = deleteTransaction.objectStore(STORE_NAME)

        for (const entry of entries) {
          if (freed >= toFree) break

          deleteStore.delete(entry.url)
          this.currentSize -= entry.size
          freed += entry.size
        }

        deleteTransaction.oncomplete = () => {
          logger.info('[PersistentMediaCache] Freed', freed, 'bytes using LRU')
          resolve()
        }

        deleteTransaction.onerror = () => {
          logger.error('[PersistentMediaCache] Failed to free space:', deleteTransaction.error)
          reject(deleteTransaction.error)
        }
      }

      getAllRequest.onerror = () => {
        logger.error('[PersistentMediaCache] Failed to get entries for cleanup:', getAllRequest.error)
        reject(getAllRequest.error)
      }
    })
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
      this.initialized = false
      logger.info('[PersistentMediaCache] Database closed')
    }
  }
}

/**
 * Singleton instance
 */
let cacheInstance: PersistentMediaCache | null = null

/**
 * Get or create the persistent media cache singleton
 */
export function getPersistentMediaCache(maxSize?: number): PersistentMediaCache {
  if (!cacheInstance) {
    cacheInstance = new PersistentMediaCache(maxSize)
  }
  return cacheInstance
}

/**
 * Factory function for creating a new cache instance
 */
export function createPersistentMediaCache(maxSize = MAX_CACHE_SIZE): PersistentMediaCache {
  return new PersistentMediaCache(maxSize)
}
