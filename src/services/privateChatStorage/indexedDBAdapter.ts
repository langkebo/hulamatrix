/**
 * PrivateChat IndexedDB Storage Adapter
 * IndexedDB 存储适配器 - 用于 Web 和移动端
 *
 * @module services/privateChatStorage/indexedDBAdapter
 */

import type { StorageAdapter, StorageAdapterOptions } from './adapter'

/**
 * IndexedDB 适配器配置选项
 */
export interface IndexedDBAdapterOptions extends StorageAdapterOptions {
  /**
   * 数据库名称
   */
  dbName?: string

  /**
   * 数据库版本
   */
  version?: number

  /**
   * 存储键前缀
   */
  keyPrefix?: string
}

/**
 * IndexedDB 存储适配器
 */
export class IndexedDBAdapter implements StorageAdapter {
  private db: IDBDatabase | null = null
  private readonly dbName: string
  private readonly version: number
  private readonly keyPrefix: string
  private readonly enableEncryption: boolean
  private initialized = false
  private onError?: (error: unknown) => void

  // 对象存储名称
  private readonly STORES = {
    DATA: 'data',
    METADATA: 'metadata'
  } as const

  constructor(options: IndexedDBAdapterOptions = {}) {
    this.dbName = options.dbName || 'FoxChatPrivateChatDB'
    this.version = options.version || 1
    this.keyPrefix = options.keyPrefix || 'pc_'
    this.enableEncryption = options.enableEncryption || false
    this.onError = options.onError
  }

  /**
   * 初始化数据库
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)

      request.onerror = () => {
        const error = request.error
        this.handleError(error)
        reject(error)
      }

      request.onsuccess = () => {
        this.db = request.result
        this.initialized = true
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // 创建主数据存储
        if (!db.objectStoreNames.contains(this.STORES.DATA)) {
          const dataStore = db.createObjectStore(this.STORES.DATA, { keyPath: 'key' })
          dataStore.createIndex('prefix', 'key', { unique: false })
        }

        // 创建元数据存储
        if (!db.objectStoreNames.contains(this.STORES.METADATA)) {
          db.createObjectStore(this.STORES.METADATA, { keyPath: 'key' })
        }
      }
    })
  }

  /**
   * 获取单个值
   */
  async get<T>(key: string): Promise<T | null> {
    this.ensureInitialized()

    const fullKey = this.addPrefix(key)
    const tx = this.db!.transaction(this.STORES.DATA, 'readonly')

    return new Promise((resolve, reject) => {
      const request = tx.objectStore(this.STORES.DATA).get(fullKey)

      request.onsuccess = () => {
        const result = request.result
        if (result) {
          resolve(result.value as T)
        } else {
          resolve(null)
        }
      }

      request.onerror = () => {
        const error = request.error
        this.handleError(error)
        reject(error)
      }
    })
  }

  /**
   * 设置单个值
   */
  async set<T>(key: string, value: T): Promise<void> {
    this.ensureInitialized()

    const fullKey = this.addPrefix(key)
    const tx = this.db!.transaction(this.STORES.DATA, 'readwrite')

    return new Promise((resolve, reject) => {
      const request = tx.objectStore(this.STORES.DATA).put({
        key: fullKey,
        value,
        timestamp: Date.now()
      })

      request.onsuccess = () => resolve()
      request.onerror = () => {
        const error = request.error
        this.handleError(error)
        reject(error)
      }
    })
  }

  /**
   * 删除单个值
   */
  async delete(key: string): Promise<void> {
    this.ensureInitialized()

    const fullKey = this.addPrefix(key)
    const tx = this.db!.transaction(this.STORES.DATA, 'readwrite')

    return new Promise((resolve, reject) => {
      const request = tx.objectStore(this.STORES.DATA).delete(fullKey)

      request.onsuccess = () => resolve()
      request.onerror = () => {
        const error = request.error
        this.handleError(error)
        reject(error)
      }
    })
  }

  /**
   * 清空所有数据
   */
  async clear(): Promise<void> {
    this.ensureInitialized()

    const tx = this.db!.transaction(this.STORES.DATA, 'readwrite')

    return new Promise((resolve, reject) => {
      const request = tx.objectStore(this.STORES.DATA).clear()

      request.onsuccess = () => resolve()
      request.onerror = () => {
        const error = request.error
        this.handleError(error)
        reject(error)
      }
    })
  }

  /**
   * 批量获取（按前缀）
   */
  async getAll<T>(prefix: string): Promise<Map<string, T>> {
    this.ensureInitialized()

    const fullPrefix = this.addPrefix(prefix)
    const tx = this.db!.transaction(this.STORES.DATA, 'readonly')
    const index = tx.objectStore(this.STORES.DATA).index('prefix')
    const range = IDBKeyRange.bound(fullPrefix, fullPrefix + '\uffff')

    return new Promise((resolve, reject) => {
      const request = index.openCursor(range)
      const results = new Map<string, T>()

      request.onsuccess = () => {
        const cursor = request.result
        if (cursor) {
          const key = this.removePrefix(cursor.value.key)
          results.set(key, cursor.value.value as T)
          cursor.continue()
        } else {
          resolve(results)
        }
      }

      request.onerror = () => {
        const error = request.error
        this.handleError(error)
        reject(error)
      }
    })
  }

  /**
   * 批量设置
   */
  async setMultiple<T>(entries: Array<[string, T]>): Promise<void> {
    this.ensureInitialized()

    const tx = this.db!.transaction(this.STORES.DATA, 'readwrite')
    const store = tx.objectStore(this.STORES.DATA)

    const promises = entries.map(([key, value]) => {
      return new Promise<void>((resolve, reject) => {
        const fullKey = this.addPrefix(key)
        const request = store.put({
          key: fullKey,
          value,
          timestamp: Date.now()
        })

        request.onsuccess = () => resolve()
        request.onerror = () => {
          const error = request.error
          this.handleError(error)
          reject(error)
        }
      })
    })

    await Promise.all(promises)
  }

  /**
   * 批量删除
   */
  async deleteMultiple(keys: string[]): Promise<void> {
    this.ensureInitialized()

    const tx = this.db!.transaction(this.STORES.DATA, 'readwrite')
    const store = tx.objectStore(this.STORES.DATA)

    const promises = keys.map((key) => {
      return new Promise<void>((resolve, reject) => {
        const fullKey = this.addPrefix(key)
        const request = store.delete(fullKey)

        request.onsuccess = () => resolve()
        request.onerror = () => {
          const error = request.error
          this.handleError(error)
          reject(error)
        }
      })
    })

    await Promise.all(promises)
  }

  /**
   * 检查键是否存在
   */
  async has(key: string): Promise<boolean> {
    const value = await this.get(key)
    return value !== null
  }

  /**
   * 获取所有键
   */
  async keys(prefix?: string): Promise<string[]> {
    this.ensureInitialized()

    const tx = this.db!.transaction(this.STORES.DATA, 'readonly')

    return new Promise((resolve, reject) => {
      const request = tx.objectStore(this.STORES.DATA).getAllKeys()

      request.onsuccess = () => {
        let allKeys = request.result as string[]
        // 移除前缀
        allKeys = allKeys.map((k) => this.removePrefix(k))

        // 过滤前缀
        if (prefix) {
          allKeys = allKeys.filter((k) => k.startsWith(prefix))
        }

        resolve(allKeys)
      }

      request.onerror = () => {
        const error = request.error
        this.handleError(error)
        reject(error)
      }
    })
  }

  /**
   * 获取存储大小（字节）
   */
  async size(): Promise<number> {
    this.ensureInitialized()

    // 粗略估算：遍历所有记录并计算大小
    const tx = this.db!.transaction(this.STORES.DATA, 'readonly')

    return new Promise((resolve, reject) => {
      const request = tx.objectStore(this.STORES.DATA).openCursor()
      let totalSize = 0

      request.onsuccess = () => {
        const cursor = request.result
        if (cursor) {
          // 估算：键 + 值的 JSON 字符串长度
          const value = cursor.value
          totalSize += JSON.stringify(value).length * 2 // UTF-16
          cursor.continue()
        } else {
          resolve(totalSize)
        }
      }

      request.onerror = () => {
        const error = request.error
        this.handleError(error)
        reject(error)
      }
    })
  }

  /**
   * 索引查询
   */
  async queryByIndex<T>(storeName: string, indexName: string, value: unknown): Promise<T[]> {
    this.ensureInitialized()

    const tx = this.db!.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const index = store.index(indexName)

    return new Promise((resolve, reject) => {
      const request = index.getAll(value as IDBValidKey)

      request.onsuccess = () => resolve(request.result as T[])
      request.onerror = () => {
        const error = request.error
        this.handleError(error)
        reject(error)
      }
    })
  }

  /**
   * 事务操作
   */
  async transaction<T>(stores: string[], callback: (txn: unknown) => Promise<T>): Promise<T> {
    this.ensureInitialized()

    const tx = this.db!.transaction(stores, 'readwrite')

    try {
      const result = await callback(tx)
      return result
    } catch (error) {
      this.handleError(error)
      throw error
    }
  }

  /**
   * 关闭数据库连接
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close()
      this.db = null
      this.initialized = false
    }
  }

  /**
   * 添加前缀
   */
  private addPrefix(key: string): string {
    return this.keyPrefix + key
  }

  /**
   * 移除前缀
   */
  private removePrefix(key: string): string {
    if (key.startsWith(this.keyPrefix)) {
      return key.substring(this.keyPrefix.length)
    }
    return key
  }

  /**
   * 确保已初始化
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.db) {
      throw new Error('IndexedDB adapter not initialized. Call initialize() first.')
    }
  }

  /**
   * 处理错误
   */
  private handleError(error: unknown): void {
    if (this.onError) {
      this.onError(error)
    } else {
      console.error('[IndexedDBAdapter]', error)
    }
  }

  /**
   * 获取数据库实例（仅供内部使用）
   */
  getDatabase(): IDBDatabase | null {
    return this.db
  }
}

/**
 * 创建 IndexedDB 适配器
 *
 * @param options - 配置选项
 * @returns IndexedDBAdapter
 */
export function createIndexedDBAdapter(options?: IndexedDBAdapterOptions): IndexedDBAdapter {
  return new IndexedDBAdapter(options)
}
