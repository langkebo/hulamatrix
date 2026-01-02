/**
 * Transition Cache Manager
 * Manages cache for Matrix and WebSocket protocol transitions
 * Provides backward compatibility during protocol migration
 */

/**
 * Transition Cache Manager class
 * Handles caching of data from both Matrix and WebSocket sources
 * Prioritizes Matrix data over WebSocket data
 */
export class TransitionCacheManager {
  private m = new Map<string, unknown>()
  private w = new Map<string, unknown>()

  /**
   * Set a value in the Matrix cache
   * @param key - Cache key
   * @param value - Value to cache
   */
  setMatrix(key: string, value: unknown): void {
    this.m.set(key, value)
  }

  /**
   * Set a value in the WebSocket cache
   * @param key - Cache key
   * @param value - Value to cache
   */
  setWebSocket(key: string, value: unknown): void {
    this.w.set(key, value)
  }

  /**
   * Get a value from the cache
   * Prioritizes Matrix cache over WebSocket cache
   * @param key - Cache key
   * @returns Cached value or null if not found
   */
  get(key: string): unknown {
    if (this.m.has(key)) return this.m.get(key)
    if (this.w.has(key)) {
      const v = this.w.get(key)
      this.m.set(key, v)
      return v
    }
    return null
  }

  /**
   * Clear all caches
   */
  clear(): void {
    this.m.clear()
    this.w.clear()
  }

  /**
   * Get a value from cache with type assertion
   * @param key - Cache key
   * @returns Typed cached value or null if not found
   */
  getAs<T>(key: string): T | null {
    const value = this.get(key)
    return value !== null ? (value as T) : null
  }

  /**
   * Check if a key exists in either cache
   * @param key - Cache key
   * @returns True if key exists in either cache
   */
  has(key: string): boolean {
    return this.m.has(key) || this.w.has(key)
  }

  /**
   * Delete a key from both caches
   * @param key - Cache key
   * @returns True if key was deleted from at least one cache
   */
  delete(key: string): boolean {
    const deletedFromM = this.m.delete(key)
    const deletedFromW = this.w.delete(key)
    return deletedFromM || deletedFromW
  }

  /**
   * Get cache statistics
   * @returns Object with cache sizes
   */
  getStats(): { matrix: number; webSocket: number } {
    return {
      matrix: this.m.size,
      webSocket: this.w.size
    }
  }
}

/**
 * Global transition cache instance
 */
export const transitionCache = new TransitionCacheManager()
