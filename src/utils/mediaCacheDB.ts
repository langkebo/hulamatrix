/**
 * IndexedDB Persistent Media Cache
 * Provides persistent storage for media files that survives page reloads
 */

import { logger } from '@/utils/logger'

/** Cache entry metadata */
export interface MediaCacheEntry {
  key: string
  blob: Blob
  timestamp: number
  expires: number
  mimeType: string
  size: number
  url?: string
}

/** Cache statistics */
export interface MediaCacheStats {
  count: number
  totalSize: number
  expiredCount: number
  maxSize: number
}

/** IndexedDB schema configuration */
export interface MediaCacheDBOptions {
  /** Database name */
  dbName?: string
  /** Database version */
  version?: number
  /** Store name */
  storeName?: string
  /** Maximum cache size in bytes (0 = unlimited) */
  maxSize?: number
  /** Default TTL in milliseconds */
  defaultTTL?: number
  /** Auto-cleanup interval in milliseconds (0 = disabled) */
  cleanupInterval?: number
}

/** IndexedDB database state */
type DBState = {
  db: IDBDatabase | null
  ready: boolean
  initPromise: Promise<void> | null
}

/**
 * IndexedDB Persistent Media Cache
 * Provides persistent media caching with automatic cleanup and size management
 */
export class MediaCacheDB {
  private static instance: MediaCacheDB | null = null

  private state: DBState = {
    db: null,
    ready: false,
    initPromise: null
  }

  private readonly options: Required<MediaCacheDBOptions>
  private cleanupTimer: ReturnType<typeof setInterval> | null = null

  private constructor(options: MediaCacheDBOptions = {}) {
    this.options = {
      dbName: 'HuLaMediaCache',
      version: 1,
      storeName: 'media',
      maxSize: 100 * 1024 * 1024, // 100MB default
      defaultTTL: 7 * 24 * 60 * 60 * 1000, // 7 days
      cleanupInterval: 60 * 60 * 1000, // 1 hour
      ...options
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(options?: MediaCacheDBOptions): MediaCacheDB {
    if (!MediaCacheDB.instance) {
      MediaCacheDB.instance = new MediaCacheDB(options)
    }
    return MediaCacheDB.instance
  }

  /**
   * Initialize IndexedDB database
   */
  async init(): Promise<void> {
    // Return existing promise if initialization is in progress
    if (this.state.initPromise) {
      return this.state.initPromise
    }

    // Return immediately if already initialized
    if (this.state.ready && this.state.db) {
      return
    }

    this.state.initPromise = this._init()

    try {
      await this.state.initPromise
    } finally {
      this.state.initPromise = null
    }
  }

  /**
   * Internal initialization
   */
  private async _init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.options.dbName, this.options.version)

      request.onerror = () => {
        reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`))
      }

      request.onsuccess = () => {
        this.state.db = request.result
        this.state.ready = true

        // Start auto-cleanup if enabled
        if (this.options.cleanupInterval > 0) {
          this.startAutoCleanup()
        }

        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create object store for media cache
        if (!db.objectStoreNames.contains(this.options.storeName)) {
          const store = db.createObjectStore(this.options.storeName, { keyPath: 'key' })

          // Create indexes for efficient queries
          store.createIndex('timestamp', 'timestamp', { unique: false })
          store.createIndex('expires', 'expires', { unique: false })
          store.createIndex('size', 'size', { unique: false })
          store.createIndex('mimeType', 'mimeType', { unique: false })
        }
      }
    })
  }

  /**
   * Store media blob in cache
   */
  async put(key: string, blob: Blob, ttl?: number, url?: string): Promise<void> {
    await this.ensureReady()

    const entry: MediaCacheEntry = {
      key,
      blob,
      timestamp: Date.now(),
      expires: Date.now() + (ttl ?? this.options.defaultTTL),
      mimeType: blob.type,
      size: blob.size,
      url
    }

    return new Promise((resolve, reject) => {
      const transaction = this.state.db!.transaction([this.options.storeName], 'readwrite')
      const store = transaction.objectStore(this.options.storeName)
      const request = store.put(entry)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(new Error(`Failed to put entry: ${request.error?.message}`))

      // Check size limit and evict if necessary
      transaction.oncomplete = async () => {
        await this.checkSizeLimit()
      }
    })
  }

  /**
   * Get media blob from cache
   */
  async get(key: string): Promise<Blob | null> {
    await this.ensureReady()

    return new Promise((resolve, reject) => {
      const transaction = this.state.db!.transaction([this.options.storeName], 'readonly')
      const store = transaction.objectStore(this.options.storeName)
      const request = store.get(key)

      request.onsuccess = () => {
        const entry: MediaCacheEntry | undefined = request.result

        if (!entry) {
          resolve(null)
          return
        }

        // Check if expired
        if (Date.now() > entry.expires) {
          // Delete expired entry
          this.delete(key).catch(() => {
            // Ignore delete error
          })
          resolve(null)
          return
        }

        // Update timestamp for LRU
        this.touch(key).catch(() => {
          // Ignore touch error
        })

        resolve(entry.blob)
      }

      request.onerror = () => reject(new Error(`Failed to get entry: ${request.error?.message}`))
    })
  }

  /**
   * Check if key exists in cache
   */
  async has(key: string): Promise<boolean> {
    const blob = await this.get(key)
    return blob !== null
  }

  /**
   * Delete entry from cache
   */
  async delete(key: string): Promise<boolean> {
    await this.ensureReady()

    return new Promise((resolve, reject) => {
      const transaction = this.state.db!.transaction([this.options.storeName], 'readwrite')
      const store = transaction.objectStore(this.options.storeName)
      const request = store.delete(key)

      request.onsuccess = () => resolve(request.result === undefined)
      request.onerror = () => reject(new Error(`Failed to delete entry: ${request.error?.message}`))
    })
  }

  /**
   * Clear all entries from cache
   */
  async clear(): Promise<void> {
    await this.ensureReady()

    return new Promise((resolve, reject) => {
      const transaction = this.state.db!.transaction([this.options.storeName], 'readwrite')
      const store = transaction.objectStore(this.options.storeName)
      const request = store.clear()

      request.onsuccess = () => resolve()
      request.onerror = () => reject(new Error(`Failed to clear cache: ${request.error?.message}`))
    })
  }

  /**
   * Get all cache keys
   */
  async keys(): Promise<string[]> {
    await this.ensureReady()

    return new Promise((resolve, reject) => {
      const transaction = this.state.db!.transaction([this.options.storeName], 'readonly')
      const store = transaction.objectStore(this.options.storeName)
      const request = store.getAllKeys()

      request.onsuccess = () => {
        const keys = request.result as string[]
        resolve(keys)
      }
      request.onerror = () => reject(new Error(`Failed to get keys: ${request.error?.message}`))
    })
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<MediaCacheStats> {
    await this.ensureReady()

    const entries = await this.getAllEntries()
    const now = Date.now()
    let totalSize = 0
    let expiredCount = 0

    for (const entry of entries) {
      totalSize += entry.size
      if (now > entry.expires) {
        expiredCount++
      }
    }

    return {
      count: entries.length,
      totalSize,
      expiredCount,
      maxSize: this.options.maxSize
    }
  }

  /**
   * Clean up expired entries
   */
  async cleanup(): Promise<number> {
    await this.ensureReady()

    const entries = await this.getAllEntries()
    const now = Date.now()
    const expiredKeys = entries.filter((e) => now > e.expires).map((e) => e.key)

    await this.deleteMultiple(expiredKeys)

    return expiredKeys.length
  }

  /**
   * Delete multiple entries
   */
  async deleteMultiple(keys: string[]): Promise<void> {
    if (keys.length === 0) return

    await this.ensureReady()

    return new Promise((resolve, reject) => {
      const transaction = this.state.db!.transaction([this.options.storeName], 'readwrite')
      const store = transaction.objectStore(this.options.storeName)

      for (const key of keys) {
        store.delete(key)
      }

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(new Error(`Failed to delete entries: ${transaction.error?.message}`))
    })
  }

  /**
   * Update entry timestamp (LRU)
   */
  private async touch(key: string): Promise<void> {
    await this.ensureReady()

    const entry = await this.getEntry(key)
    if (!entry) return

    entry.timestamp = Date.now()

    return new Promise((resolve, reject) => {
      const transaction = this.state.db!.transaction([this.options.storeName], 'readwrite')
      const store = transaction.objectStore(this.options.storeName)
      const request = store.put(entry)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(new Error(`Failed to touch entry: ${request.error?.message}`))
    })
  }

  /**
   * Get all entries
   */
  private async getAllEntries(): Promise<MediaCacheEntry[]> {
    await this.ensureReady()

    return new Promise((resolve, reject) => {
      const transaction = this.state.db!.transaction([this.options.storeName], 'readonly')
      const store = transaction.objectStore(this.options.storeName)
      const request = store.getAll()

      request.onsuccess = () => {
        resolve(request.result as MediaCacheEntry[])
      }
      request.onerror = () => reject(new Error(`Failed to get entries: ${request.error?.message}`))
    })
  }

  /**
   * Get single entry metadata
   */
  private async getEntry(key: string): Promise<MediaCacheEntry | null> {
    await this.ensureReady()

    return new Promise((resolve, reject) => {
      const transaction = this.state.db!.transaction([this.options.storeName], 'readonly')
      const store = transaction.objectStore(this.options.storeName)
      const request = store.get(key)

      request.onsuccess = () => {
        resolve(request.result as MediaCacheEntry | null)
      }
      request.onerror = () => reject(new Error(`Failed to get entry: ${request.error?.message}`))
    })
  }

  /**
   * Check size limit and evict oldest entries if necessary
   */
  private async checkSizeLimit(): Promise<void> {
    if (this.options.maxSize === 0) return // Unlimited

    const entries = await this.getAllEntries()
    let totalSize = entries.reduce((sum, e) => sum + e.size, 0)

    // Remove oldest entries until under limit
    while (totalSize > this.options.maxSize && entries.length > 0) {
      // Sort by timestamp (oldest first)
      entries.sort((a, b) => a.timestamp - b.timestamp)
      const oldest = entries.shift()!
      await this.delete(oldest.key)
      totalSize -= oldest.size
    }
  }

  /**
   * Ensure database is ready
   */
  private async ensureReady(): Promise<void> {
    if (!this.state.ready) {
      await this.init()
    }
  }

  /**
   * Start automatic cleanup interval
   */
  private startAutoCleanup(): void {
    if (this.cleanupTimer) return

    this.cleanupTimer = setInterval(async () => {
      try {
        await this.cleanup()
      } catch (error) {
        logger.error('[MediaCacheDB] Auto-cleanup error:', error)
      }
    }, this.options.cleanupInterval)
  }

  /**
   * Stop automatic cleanup
   */
  private stopAutoCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    this.stopAutoCleanup()

    if (this.state.db) {
      this.state.db.close()
      this.state.db = null
      this.state.ready = false
    }
  }

  /**
   * Destroy database (delete all data)
   */
  async destroy(): Promise<void> {
    await this.close()

    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(this.options.dbName)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(new Error(`Failed to destroy database: ${request.error?.message}`))
    })
  }

  /**
   * Export cache to JSON (for backup/debug)
   */
  async exportToJSON(): Promise<string> {
    const entries = await this.getAllEntries()
    const exportData = entries.map((e) => ({
      key: e.key,
      timestamp: e.timestamp,
      expires: e.expires,
      mimeType: e.mimeType,
      size: e.size,
      url: e.url,
      // Note: blob is not exported as it can't be JSON serialized
      hasBlob: !!e.blob
    }))

    return JSON.stringify(exportData, null, 2)
  }

  /**
   * Get cache entries by MIME type prefix
   */
  async getByMimeType(prefix: string): Promise<Map<string, Blob>> {
    await this.ensureReady()

    const entries = await this.getAllEntries()
    const result = new Map<string, Blob>()

    for (const entry of entries) {
      if (entry.mimeType.startsWith(prefix)) {
        result.set(entry.key, entry.blob)
      }
    }

    return result
  }

  /**
   * Get cache entries by URL pattern
   */
  async getByUrlPattern(pattern: RegExp): Promise<Map<string, Blob>> {
    await this.ensureReady()

    const entries = await this.getAllEntries()
    const result = new Map<string, Blob>()

    for (const entry of entries) {
      if (entry.url && pattern.test(entry.url)) {
        result.set(entry.key, entry.blob)
      }
    }

    return result
  }
}

/**
 * Hybrid Media Cache
 * Combines in-memory LRU cache with persistent IndexedDB storage
 */
export class HybridMediaCache {
  private memoryCache: Map<string, { blob: Blob; expires: number; timestamp: number }>
  private dbCache: MediaCacheDB
  private memoryMaxSize: number
  private memoryMaxSizeBytes: number

  constructor(dbCache: MediaCacheDB, memoryMaxSize = 50, memoryMaxSizeBytes = 50 * 1024 * 1024) {
    this.dbCache = dbCache
    this.memoryCache = new Map()
    this.memoryMaxSize = memoryMaxSize
    this.memoryMaxSizeBytes = memoryMaxSizeBytes
  }

  /**
   * Initialize the cache
   */
  async init(): Promise<void> {
    await this.dbCache.init()
  }

  /**
   * Get media blob (checks memory first, then IndexedDB)
   */
  async get(key: string): Promise<Blob | null> {
    // Check memory cache first
    const memEntry = this.memoryCache.get(key)
    if (memEntry && Date.now() < memEntry.expires) {
      // Update LRU timestamp
      memEntry.timestamp = Date.now()
      return memEntry.blob
    }

    // Check IndexedDB
    const blob = await this.dbCache.get(key)
    if (blob) {
      // Promote to memory cache
      this.setToMemory(key, blob, this.dbCache['options'].defaultTTL)
    }

    return blob
  }

  /**
   * Put media blob (stores in both memory and IndexedDB)
   */
  async put(key: string, blob: Blob, ttl?: number, url?: string): Promise<void> {
    // Store in IndexedDB
    await this.dbCache.put(key, blob, ttl, url)

    // Store in memory
    this.setToMemory(key, blob, ttl ?? this.dbCache['options'].defaultTTL)
  }

  /**
   * Check if key exists
   */
  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== null
  }

  /**
   * Delete from both caches
   */
  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key)
    await this.dbCache.delete(key)
  }

  /**
   * Clear both caches
   */
  async clear(): Promise<void> {
    this.memoryCache.clear()
    await this.dbCache.clear()
  }

  /**
   * Get combined statistics
   */
  async getStats(): Promise<{ memory: { count: number; size: number }; db: MediaCacheStats }> {
    let memorySize = 0
    for (const entry of Array.from(this.memoryCache.values())) {
      memorySize += entry.blob.size
    }

    return {
      memory: {
        count: this.memoryCache.size,
        size: memorySize
      },
      db: await this.dbCache.getStats()
    }
  }

  /**
   * Clean up expired entries
   */
  async cleanup(): Promise<number> {
    // Cleanup memory cache
    const now = Date.now()
    for (const [key, entry] of Array.from(this.memoryCache.entries())) {
      if (now > entry.expires) {
        this.memoryCache.delete(key)
      }
    }

    // Cleanup IndexedDB
    return await this.dbCache.cleanup()
  }

  /**
   * Set to memory cache with LRU eviction
   */
  private setToMemory(key: string, blob: Blob, ttl: number): void {
    const expires = Date.now() + ttl

    // Check if updating existing entry
    const existing = this.memoryCache.get(key)
    let currentSize = 0
    for (const entry of Array.from(this.memoryCache.values())) {
      currentSize += entry.blob.size
    }

    if (existing) {
      currentSize -= existing.blob.size
    }

    // Check size limit
    if (currentSize + blob.size > this.memoryMaxSizeBytes || this.memoryCache.size >= this.memoryMaxSize) {
      this.evictLRU()
    }

    this.memoryCache.set(key, { blob, expires, timestamp: Date.now() })
  }

  /**
   * Evict least recently used entry from memory cache
   */
  private evictLRU(): void {
    let oldestKey: string | null = null
    let oldestTimestamp = Infinity

    for (const [key, entry] of Array.from(this.memoryCache.entries())) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.memoryCache.delete(oldestKey)
    }
  }

  /**
   * Close the cache
   */
  async close(): Promise<void> {
    this.memoryCache.clear()
    await this.dbCache.close()
  }
}

/**
 * Factory function to create a new MediaCacheDB instance
 */
export function createMediaCacheDB(options?: MediaCacheDBOptions): MediaCacheDB {
  return MediaCacheDB.getInstance(options)
}

/**
 * Factory function to create a hybrid cache
 */
export function createHybridMediaCache(
  dbOptions?: MediaCacheDBOptions,
  memoryMaxSize?: number,
  memoryMaxSizeBytes?: number
): HybridMediaCache {
  const dbCache = createMediaCacheDB(dbOptions)
  return new HybridMediaCache(dbCache, memoryMaxSize, memoryMaxSizeBytes)
}

// Export singleton instances
export const mediaCacheDB = MediaCacheDB.getInstance()

// Default hybrid cache with sensible defaults
export const hybridMediaCache = new HybridMediaCache(
  mediaCacheDB,
  50, // 50 items in memory
  50 * 1024 * 1024 // 50MB in memory
)
