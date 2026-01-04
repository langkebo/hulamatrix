/**
 * 数据缓存服务
 * 支持 localStorage、sessionStorage 和 IndexedDB
 */

import { CACHE_CONFIG } from '@/constants'

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 缓存项接口
 */
interface CacheItem<T = unknown> {
  value: T
  timestamp: number
  ttl?: number
}

/**
 * 存储类型
 */
export type StorageType = 'memory' | 'indexedDB' | 'localStorage' | 'sessionStorage'

/**
 * 缓存选项
 */
export interface CacheOptions {
  storage?: StorageType
  ttl?: number
}

// ============================================================================
// 内存缓存实现
// ============================================================================

/**
 * 简单的内存缓存实现
 */
class MemoryCache {
  private cache = new Map<string, CacheItem<unknown>>()

  set<T = unknown>(key: string, value: T, ttl?: number): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: ttl || CACHE_CONFIG.USER_INFO_CACHE_TTL
    })
  }

  get<T = unknown>(key: string): T | null {
    const item = this.cache.get(key) as CacheItem<T> | undefined
    if (!item) return null

    if (item.ttl && Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key)
      return null
    }

    return item.value
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }
}

// ============================================================================
// IndexedDB 封装
// ============================================================================

/**
 * IndexedDB 封装
 */
class IndexedDBCache {
  private db: IDBDatabase | null = null
  private dbName = 'HuLaCache'
  private version = 1
  private storeName = 'cache'

  async init(): Promise<void> {
    if (this.db) return

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'key' })
          store.createIndex('timestamp', 'timestamp', { unique: false })
          store.createIndex('ttl', 'ttl', { unique: false })
        }
      }
    })
  }

  async set<T = unknown>(key: string, value: T, ttl?: number): Promise<void> {
    await this.init()
    if (!this.db) throw new Error('IndexedDB not initialized')

    const item = {
      key,
      value: JSON.stringify(value),
      timestamp: Date.now(),
      ttl: ttl || CACHE_CONFIG.USER_INFO_CACHE_TTL
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.put(item)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    await this.init()
    if (!this.db) throw new Error('IndexedDB not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.get(key)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const item = request.result
        if (!item) {
          resolve(null)
          return
        }

        // 检查是否过期
        if (Date.now() - item.timestamp > item.ttl) {
          // 删除过期项
          const deleteTransaction = this.db!.transaction([this.storeName], 'readwrite')
          const deleteStore = deleteTransaction.objectStore(this.storeName)
          deleteStore.delete(key)
          resolve(null)
          return
        }

        try {
          resolve(JSON.parse(item.value))
        } catch {
          resolve(null)
        }
      }
    })
  }

  async delete(key: string): Promise<void> {
    await this.init()
    if (!this.db) throw new Error('IndexedDB not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.delete(key)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async clear(): Promise<void> {
    await this.init()
    if (!this.db) throw new Error('IndexedDB not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.clear()

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async cleanExpired(): Promise<void> {
    await this.init()
    if (!this.db) throw new Error('IndexedDB not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const index = store.index('timestamp')
      const request = index.openCursor()

      request.onerror = () => reject(request.error)

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (!cursor) {
          resolve()
          return
        }

        const item = cursor.value
        if (Date.now() - item.timestamp > item.ttl) {
          cursor.delete()
        }

        cursor.continue()
      }
    })
  }
}

// ============================================================================
// 缓存管理器
// ============================================================================

/**
 * 缓存管理器
 */
export class CacheManager {
  private memoryCache = new MemoryCache()
  private indexedDBCache = new IndexedDBCache()
  private userId: string | null = null

  setUserId(userId: string): void {
    this.userId = userId
  }

  // 设置缓存
  async set<T = unknown>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const storage = options?.storage || 'memory'
    const ttl = options?.ttl

    // 添加用户ID前缀（如果有）
    const fullKey = this.userId ? `${this.userId}:${key}` : key

    switch (storage) {
      case 'memory':
        this.memoryCache.set(fullKey, value, ttl)
        break

      case 'indexedDB':
        await this.indexedDBCache.set(fullKey, value, ttl)
        break

      case 'localStorage':
        localStorage.setItem(
          fullKey,
          JSON.stringify({
            value,
            timestamp: Date.now(),
            ttl
          })
        )
        break

      case 'sessionStorage':
        sessionStorage.setItem(
          fullKey,
          JSON.stringify({
            value,
            timestamp: Date.now(),
            ttl
          })
        )
        break
    }
  }

  // 获取缓存
  async get<T = unknown>(key: string, storage?: StorageType): Promise<T | null> {
    // 添加用户ID前缀（如果有）
    const fullKey = this.userId ? `${this.userId}:${key}` : key

    // 如果指定了存储类型，直接从该存储获取
    if (storage) {
      switch (storage) {
        case 'memory':
          return this.memoryCache.get(fullKey)

        case 'indexedDB':
          return await this.indexedDBCache.get(fullKey)

        case 'localStorage':
          return this.getFromStorage<T>(localStorage, fullKey)

        case 'sessionStorage':
          return this.getFromStorage<T>(sessionStorage, fullKey)
      }
    }

    // 否则按优先级获取：memory -> indexedDB -> localStorage -> sessionStorage
    // 内存缓存
    let value = this.memoryCache.get<T>(fullKey)
    if (value !== null) return value

    // IndexedDB
    value = await this.indexedDBCache.get<T>(fullKey)
    if (value !== null) {
      // 将值缓存到内存
      this.memoryCache.set(fullKey, value)
      return value
    }

    // localStorage
    value = this.getFromStorage<T>(localStorage, fullKey)
    if (value !== null) {
      this.memoryCache.set(fullKey, value)
      return value
    }

    // sessionStorage
    value = this.getFromStorage<T>(sessionStorage, fullKey)
    if (value !== null) {
      this.memoryCache.set(fullKey, value)
      return value
    }

    return null
  }

  // 删除缓存
  async delete(key: string, storage?: 'memory' | 'indexedDB' | 'localStorage' | 'sessionStorage'): Promise<void> {
    const fullKey = this.userId ? `${this.userId}:${key}` : key

    if (storage) {
      switch (storage) {
        case 'memory':
          this.memoryCache.delete(fullKey)
          break

        case 'indexedDB':
          await this.indexedDBCache.delete(fullKey)
          break

        case 'localStorage':
          localStorage.removeItem(fullKey)
          break

        case 'sessionStorage':
          sessionStorage.removeItem(fullKey)
          break
      }
    } else {
      // 从所有存储中删除
      this.memoryCache.delete(fullKey)
      await this.indexedDBCache.delete(fullKey)
      localStorage.removeItem(fullKey)
      sessionStorage.removeItem(fullKey)
    }
  }

  // 清空所有缓存
  async clear(): Promise<void> {
    this.memoryCache.clear()
    await this.indexedDBCache.clear()

    // 清空带当前用户ID前缀的项
    const prefix = this.userId ? `${this.userId}:` : ''
    const keysToRemove: string[] = []

    // localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key))

    // sessionStorage
    keysToRemove.length = 0
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach((key) => sessionStorage.removeItem(key))
  }

  // 清理过期缓存
  async cleanExpired(): Promise<void> {
    // 内存缓存会在 get 时自动清理过期项
    await this.indexedDBCache.cleanExpired()

    // 清理 localStorage 和 sessionStorage
    const prefix = this.userId ? `${this.userId}:` : ''
    const now = Date.now()

    // localStorage
    const keysToCheck: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(prefix)) {
        keysToCheck.push(key)
      }
    }

    keysToCheck.forEach((key) => {
      try {
        const item = JSON.parse(localStorage.getItem(key) || '{}')
        if (item.ttl && now - item.timestamp > item.ttl) {
          localStorage.removeItem(key)
        }
      } catch {
        // 忽略解析错误，直接删除
        localStorage.removeItem(key)
      }
    })

    // sessionStorage
    keysToCheck.length = 0
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key && key.startsWith(prefix)) {
        keysToCheck.push(key)
      }
    }

    keysToCheck.forEach((key) => {
      try {
        const item = JSON.parse(sessionStorage.getItem(key) || '{}')
        if (item.ttl && now - item.timestamp > item.ttl) {
          sessionStorage.removeItem(key)
        }
      } catch {
        // 忽略解析错误，直接删除
        sessionStorage.removeItem(key)
      }
    })
  }

  // 获取缓存大小（仅内存缓存）
  getMemoryCacheSize(): number {
    return this.memoryCache.size()
  }

  // 从 Storage 获取数据
  private getFromStorage<T = unknown>(storage: Storage, key: string): T | null {
    try {
      const item = JSON.parse(storage.getItem(key) || '{}')
      if (!item.timestamp) return null

      // 检查是否过期
      if (item.ttl && Date.now() - item.timestamp > item.ttl) {
        storage.removeItem(key)
        return null
      }

      return item.value as T
    } catch {
      return null
    }
  }
}

// ============================================================================
// 导出实例和便捷方法
// ============================================================================

// 创建全局缓存管理器实例
export const cacheManager = new CacheManager()

// 导出便捷方法
export const cache = {
  set: <T = unknown>(key: string, value: T, options?: CacheOptions) => cacheManager.set(key, value, options),

  get: <T = unknown>(key: string, storage?: StorageType) => cacheManager.get<T>(key, storage),

  delete: (key: string, storage?: StorageType) => cacheManager.delete(key, storage),

  clear: () => cacheManager.clear(),

  cleanExpired: () => cacheManager.cleanExpired(),

  setUserId: (userId: string) => cacheManager.setUserId(userId),

  getMemoryCacheSize: () => cacheManager.getMemoryCacheSize()
}
