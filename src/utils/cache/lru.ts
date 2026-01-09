/**
 * Generic LRU (Least Recently Used) Cache Implementation
 *
 * Provides thread-safe, generic in-memory LRU cache with:
 * - Maximum size enforcement
 * - TTL (Time To Live) support
 * - Efficient O(1) get/set operations
 * - Statistics tracking
 */

/**
 * Cache entry with metadata
 */
interface LRUCacheEntry<V> {
  /** Cached value */
  value: V
  /** Last access timestamp */
  timestamp: number
  /** Expiration timestamp (0 = no expiration) */
  expires: number
  /** Value size in bytes (0 = unknown) */
  size: number
}

/**
 * Cache statistics
 */
export interface LRUStats {
  /** Current number of entries */
  size: number
  /** Maximum number of entries */
  maxSize: number
  /** Total memory usage in bytes */
  memoryUsage: number
  /** Maximum memory in bytes (0 = unlimited) */
  maxMemory: number
  /** Cache hit rate (0-100) */
  hitRate: number
  /** Number of cache hits */
  hits: number
  /** Number of cache misses */
  misses: number
  /** Number of evictions */
  evictions: number
}

/**
 * LRU cache options
 */
export interface LRUOptions<V = unknown> {
  /** Maximum number of entries (0 = unlimited) */
  maxSize?: number
  /** Maximum memory in bytes (0 = unlimited) */
  maxMemory?: number
  /** Default TTL in milliseconds (0 = no expiration) */
  defaultTTL?: number
  /** Size calculator function */
  sizeCalculator?: (value: V) => number
  /** Cleanup interval in milliseconds (0 = disabled) */
  cleanupInterval?: number
}

/**
 * Generic LRU Cache class
 *
 * @example
 * ```ts
 * // Create a simple string cache
 * const cache = new LRUCache<string>({ maxSize: 100 })
 * cache.set('key1', 'value1')
 * const value = cache.get('key1')
 * ```
 *
 * @example
 * ```ts
 * // Create a Blob cache with memory limits
 * const blobCache = new LRUCache<Blob>({
 *   maxSize: 50,
 *   maxMemory: 50 * 1024 * 1024, // 50MB
 *   sizeCalculator: (blob) => blob.size,
 *   defaultTTL: 24 * 60 * 60 * 1000 // 24 hours
 * })
 * ```
 */
export class LRUCache<K = string, V = unknown> {
  private cache: Map<K, LRUCacheEntry<V>>
  private maxSize: number
  private maxMemory: number
  private defaultTTL: number
  private sizeCalculator?: (value: V) => number

  // Statistics
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0
  }

  // Cleanup timer
  private cleanupTimer: ReturnType<typeof setInterval> | null = null

  constructor(options: LRUOptions<V> = {}) {
    this.cache = new Map()
    this.maxSize = options.maxSize ?? 100
    this.maxMemory = options.maxMemory ?? 0
    this.defaultTTL = options.defaultTTL ?? 0
    this.sizeCalculator = options.sizeCalculator

    // Start auto-cleanup if enabled
    if (options.cleanupInterval && options.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(() => {
        this.cleanup()
      }, options.cleanupInterval)
    }
  }

  /**
   * Get a value from the cache
   * Updates the access timestamp for LRU tracking
   */
  get(key: K): V | null {
    const entry = this.cache.get(key)

    if (!entry) {
      this.stats.misses++
      return null
    }

    // Check expiration
    if (entry.expires > 0 && Date.now() > entry.expires) {
      this.delete(key)
      this.stats.misses++
      return null
    }

    // Update access timestamp (LRU)
    entry.timestamp = Date.now()
    this.stats.hits++

    return entry.value
  }

  /**
   * Set a value in the cache
   * Evicts oldest entries if necessary
   */
  set(key: K, value: V, ttl?: number): void {
    // Calculate value size
    const size = this.sizeCalculator ? this.sizeCalculator(value) : 0

    // Check if updating existing entry
    const existing = this.cache.get(key)
    let currentMemory = this.calculateMemoryUsage()

    if (existing) {
      currentMemory -= existing.size
    }

    // Check memory limit
    if (this.maxMemory > 0 && currentMemory + size > this.maxMemory) {
      this.ensureSpace(size)
    }

    // Check size limit
    if (this.maxSize > 0 && this.cache.size >= this.maxSize && !existing) {
      this.evictOldest()
    }

    // Set entry
    const entry: LRUCacheEntry<V> = {
      value,
      timestamp: Date.now(),
      expires: ttl ? Date.now() + ttl : this.defaultTTL > 0 ? Date.now() + this.defaultTTL : 0,
      size
    }

    this.cache.set(key, entry)
  }

  /**
   * Check if a key exists in the cache
   */
  has(key: K): boolean {
    return this.get(key) !== null
  }

  /**
   * Delete a specific entry from the cache
   */
  delete(key: K): boolean {
    return this.cache.delete(key)
  }

  /**
   * Clear all entries from the cache
   */
  clear(): void {
    this.cache.clear()
    this.stats.hits = 0
    this.stats.misses = 0
    this.stats.evictions = 0
  }

  /**
   * Get all keys in the cache
   */
  keys(): K[] {
    return Array.from(this.cache.keys())
  }

  /**
   * Get all values in the cache
   */
  values(): V[] {
    return Array.from(this.cache.values()).map((entry) => entry.value)
  }

  /**
   * Get all entries as key-value pairs
   */
  entries(): [K, V][] {
    return Array.from(this.cache.entries()).map(([key, entry]) => [key, entry.value])
  }

  /**
   * Get current cache size
   */
  get size(): number {
    return this.cache.size
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    const now = Date.now()
    let removed = 0

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expires > 0 && now > entry.expires) {
        this.cache.delete(key)
        removed++
      }
    }

    return removed
  }

  /**
   * Get cache statistics
   */
  getStats(): LRUStats {
    const total = this.stats.hits + this.stats.misses
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      memoryUsage: this.calculateMemoryUsage(),
      maxMemory: this.maxMemory,
      hitRate,
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions
    }
  }

  /**
   * Update cache options
   */
  updateOptions(options: Partial<LRUOptions<V>>): void {
    if (options.maxSize !== undefined) this.maxSize = options.maxSize
    if (options.maxMemory !== undefined) this.maxMemory = options.maxMemory
    if (options.defaultTTL !== undefined) this.defaultTTL = options.defaultTTL
    if (options.sizeCalculator !== undefined) this.sizeCalculator = options.sizeCalculator

    // Update cleanup interval
    if (options.cleanupInterval !== undefined) {
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer)
        this.cleanupTimer = null
      }
      if (options.cleanupInterval > 0) {
        this.cleanupTimer = setInterval(() => this.cleanup(), options.cleanupInterval)
      }
    }
  }

  /**
   * Calculate current memory usage
   */
  private calculateMemoryUsage(): number {
    let total = 0
    for (const entry of this.cache.values()) {
      total += entry.size
    }
    return total
  }

  /**
   * Ensure there's enough space for a new entry
   */
  private ensureSpace(requiredSize: number): void {
    let freed = 0
    const targetFree = requiredSize * 1.2 // Free 20% extra

    // Evict oldest entries until we have enough space
    while (freed < targetFree && this.cache.size > 0) {
      freed += this.evictOldest()
    }
  }

  /**
   * Evict the oldest entry from the cache
   * Returns the size of the evicted entry
   */
  private evictOldest(): number {
    let oldestKey: K | null = null
    let oldestTimestamp = Infinity
    let oldestSize = 0

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp
        oldestKey = key
        oldestSize = entry.size
      }
    }

    if (oldestKey !== null) {
      this.cache.delete(oldestKey)
      this.stats.evictions++
      return oldestSize
    }

    return 0
  }

  /**
   * Clean up and destroy the cache
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
    this.clear()
  }
}

/**
 * LRU List - Simple list-based LRU tracker
 *
 * Useful for tracking "recently used" items without caching values.
 * Items are moved to the front when accessed.
 *
 * @example
 * ```ts
 * const recentRooms = new LRUList<string>(20)
 * recentRooms.add('room1')
 * recentRooms.add('room2')
 * recentRooms.touch('room1') // Move to front
 * ```
 */
export class LRUList<T = string> {
  private items: T[]
  private maxSize: number
  private set: Set<T>

  constructor(maxSize: number) {
    this.maxSize = maxSize
    this.items = []
    this.set = new Set()
  }

  /**
   * Add an item to the list
   * If it already exists, move it to the front
   */
  add(item: T): void {
    this.touch(item)
  }

  /**
   * Touch an item (move to front)
   * If it doesn't exist, add it
   */
  touch(item: T): void {
    // Remove existing
    const index = this.items.indexOf(item)
    if (index > -1) {
      this.items.splice(index, 1)
    } else {
      this.set.add(item)
    }

    // Add to front
    this.items.unshift(item)

    // Enforce size limit
    if (this.items.length > this.maxSize) {
      const removed = this.items.pop()!
      this.set.delete(removed)
    }
  }

  /**
   * Remove an item from the list
   */
  remove(item: T): boolean {
    const index = this.items.indexOf(item)
    if (index > -1) {
      this.items.splice(index, 1)
      this.set.delete(item)
      return true
    }
    return false
  }

  /**
   * Check if an item exists
   */
  has(item: T): boolean {
    return this.set.has(item)
  }

  /**
   * Get all items in order (most recent first)
   */
  getAll(): T[] {
    return [...this.items]
  }

  /**
   * Get the least recently used item
   */
  getLRU(): T | null {
    return this.items[this.items.length - 1] ?? null
  }

  /**
   * Clear the list
   */
  clear(): void {
    this.items = []
    this.set.clear()
  }

  /**
   * Get current size
   */
  get size(): number {
    return this.items.length
  }

  /**
   * Get maximum size
   */
  get capacity(): number {
    return this.maxSize
  }
}

/**
 * Factory function to create an LRU cache
 */
export function createLRUCache<K = string, V = unknown>(options?: LRUOptions<V>): LRUCache<K, V> {
  return new LRUCache<K, V>(options)
}

/**
 * Factory function to create an LRU list
 */
export function createLRUList<T = string>(maxSize: number): LRUList<T> {
  return new LRUList<T>(maxSize)
}
