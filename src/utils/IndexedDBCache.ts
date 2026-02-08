interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

interface DBConfig {
  dbName: string
  version: number
  stores: StoreConfig[]
}

interface StoreConfig {
  name: string
  keyPath: string
  indexes?: { name: string; keyPath: string; unique?: boolean }[]
}

interface AccountCacheConfig {
  accountId: string
  maxSize: number
  defaultTTL: number
}

const DEFAULT_CONFIG: AccountCacheConfig = {
  accountId: 'default',
  maxSize: 50 * 1024 * 1024,
  defaultTTL: 24 * 60 * 60 * 1000
}

const DB_SCHEMAS: DBConfig[] = [
  {
    dbName: 'HulaCache',
    version: 1,
    stores: [
      { name: 'settings', keyPath: 'key' },
      { name: 'sessions', keyPath: 'roomId', indexes: [{ name: 'timestamp', keyPath: 'lastActive' }] },
      {
        name: 'messages',
        keyPath: 'id',
        indexes: [
          { name: 'roomId', keyPath: 'roomId' },
          { name: 'timestamp', keyPath: 'timestamp' }
        ]
      },
      { name: 'contacts', keyPath: 'userId' },
      { name: 'inputDrafts', keyPath: 'key', indexes: [{ name: 'timestamp', keyPath: 'timestamp' }] },
      { name: 'metadata', keyPath: 'key' }
    ]
  }
]

class IndexedDBCache {
  private static instances: Map<string, IndexedDBCache> = new Map()
  private db: IDBDatabase | null = null
  private dbName: string
  private _accountId: string
  private config: AccountCacheConfig
  private initPromise: Promise<void> | null = null

  private constructor(accountId: string, config?: Partial<AccountCacheConfig>) {
    this.dbName = 'HulaCache'
    this._accountId = accountId
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  get accountId(): string {
    return this._accountId
  }

  static getInstance(accountId: string = 'default', config?: Partial<AccountCacheConfig>): IndexedDBCache {
    if (!IndexedDBCache.instances.has(accountId)) {
      IndexedDBCache.instances.set(accountId, new IndexedDBCache(accountId, config))
    }
    return IndexedDBCache.instances.get(accountId)!
  }

  static async closeAll(): Promise<void> {
    for (const instance of IndexedDBCache.instances.values()) {
      await instance.close()
    }
    IndexedDBCache.instances.clear()
  }

  async init(): Promise<void> {
    if (this.db) return
    if (this.initPromise) return this.initPromise

    this.initPromise = this.initializeDB()
    await this.initPromise
  }

  private async initializeDB(): Promise<void> {
    if (typeof window === 'undefined' || !window.indexedDB) {
      console.warn('[IndexedDBCache] IndexedDB is not available')
      return
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1)

      request.onerror = () => {
        console.error('[IndexedDBCache] Failed to open database:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        this.setupEventListeners()
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        for (const store of DB_SCHEMAS[0].stores) {
          if (!db.objectStoreNames.contains(store.name)) {
            const objectStore = db.createObjectStore(store.name, { keyPath: store.keyPath })
            for (const index of store.indexes || []) {
              objectStore.createIndex(index.name, index.keyPath, { unique: index.unique })
            }
          }
        }
      }
    })
  }

  private setupEventListeners(): void {
    if (!this.db) return
    this.db.addEventListener('close', () => {
      this.db = null
    })
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }

  private getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): IDBObjectStore {
    if (!this.db) throw new Error('Database not initialized')
    const transaction = this.db.transaction(storeName, mode)
    return transaction.objectStore(storeName)
  }

  async set<T>(storeName: string, key: string, data: T, ttl?: number): Promise<void> {
    await this.init()
    if (!this.db) return

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl ?? this.config.defaultTTL
    }

    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore(storeName, 'readwrite')
        const request = store.put({
          ...entry,
          [DB_SCHEMAS[0].stores.find((s) => s.name === storeName)?.keyPath || 'key']: key
        })

        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      } catch (error) {
        reject(error)
      }
    })
  }

  async get<T>(storeName: string, key: string): Promise<T | null> {
    await this.init()
    if (!this.db) return null

    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore(storeName)
        const request = store.get(key)

        request.onsuccess = () => {
          const entry = request.result as CacheEntry<T> | undefined
          if (!entry) {
            resolve(null)
            return
          }

          const isExpired = Date.now() - entry.timestamp > entry.ttl
          if (isExpired) {
            this.delete(storeName, key)
            resolve(null)
            return
          }

          resolve(entry.data)
        }

        request.onerror = () => reject(request.error)
      } catch (error) {
        reject(error)
      }
    })
  }

  async delete(storeName: string, key: string): Promise<void> {
    await this.init()
    if (!this.db) return

    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore(storeName, 'readwrite')
        const request = store.delete(key)

        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      } catch (error) {
        reject(error)
      }
    })
  }

  async clear(storeName: string): Promise<void> {
    await this.init()
    if (!this.db) return

    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore(storeName, 'readwrite')
        const request = store.clear()

        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      } catch (error) {
        reject(error)
      }
    })
  }

  async deleteExpired(storeName: string): Promise<number> {
    await this.init()
    if (!this.db) return 0

    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore(storeName, 'readwrite')
        const now = Date.now()
        let deletedCount = 0

        const cursorRequest = store.openCursor()

        cursorRequest.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result
          if (!cursor) {
            resolve(deletedCount)
            return
          }

          const entry = cursor.value as CacheEntry<unknown>
          if (now - entry.timestamp > entry.ttl) {
            cursor.delete()
            deletedCount++
          }
          cursor.continue()
        }

        cursorRequest.onerror = () => reject(cursorRequest.error)
      } catch (error) {
        reject(error)
      }
    })
  }

  async keys(storeName: string): Promise<string[]> {
    await this.init()
    if (!this.db) return []

    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore(storeName)
        const request = store.getAllKeys()

        request.onsuccess = () => resolve(request.result as string[])
        request.onerror = () => reject(request.error)
      } catch (error) {
        reject(error)
      }
    })
  }

  async size(storeName: string): Promise<number> {
    await this.init()
    if (!this.db) return 0

    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore(storeName)
        const request = store.count()

        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      } catch (error) {
        reject(error)
      }
    })
  }

  async forEach<T>(storeName: string, callback: (key: string, value: T) => boolean | void): Promise<void> {
    await this.init()
    if (!this.db) return

    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore(storeName)
        const request = store.openCursor()

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result
          if (!cursor) {
            resolve()
            return
          }

          const entry = cursor.value as CacheEntry<T>
          const isExpired = Date.now() - entry.timestamp > entry.ttl

          if (isExpired) {
            cursor.delete()
          } else {
            const shouldContinue = callback(cursor.key as string, entry.data)
            if (shouldContinue === false) {
              resolve()
              return
            }
          }

          cursor.continue()
        }

        request.onerror = () => reject(request.error)
      } catch (error) {
        reject(error)
      }
    })
  }
}

export const cache = {
  settings: {
    async set<T>(key: string, data: T, ttl?: number): Promise<void> {
      const instance = IndexedDBCache.getInstance()
      await instance.set('settings', key, data, ttl)
    },

    async get<T>(key: string): Promise<T | null> {
      const instance = IndexedDBCache.getInstance()
      return instance.get<T>('settings', key)
    },

    async delete(key: string): Promise<void> {
      const instance = IndexedDBCache.getInstance()
      await instance.delete('settings', key)
    },

    async clear(): Promise<void> {
      const instance = IndexedDBCache.getInstance()
      await instance.clear('settings')
    }
  },

  sessions: {
    async set<T>(roomId: string, data: T, ttl?: number): Promise<void> {
      const instance = IndexedDBCache.getInstance()
      await instance.set('sessions', roomId, data, ttl)
    },

    async get<T>(roomId: string): Promise<T | null> {
      const instance = IndexedDBCache.getInstance()
      return instance.get<T>('sessions', roomId)
    },

    async delete(roomId: string): Promise<void> {
      const instance = IndexedDBCache.getInstance()
      await instance.delete('sessions', roomId)
    },

    async clear(): Promise<void> {
      const instance = IndexedDBCache.getInstance()
      await instance.clear('sessions')
    }
  },

  messages: {
    async set<T>(id: string, data: T, ttl?: number): Promise<void> {
      const instance = IndexedDBCache.getInstance()
      await instance.set('messages', id, data, ttl)
    },

    async get<T>(id: string): Promise<T | null> {
      const instance = IndexedDBCache.getInstance()
      return instance.get<T>('messages', id)
    },

    async delete(id: string): Promise<void> {
      const instance = IndexedDBCache.getInstance()
      await instance.delete('messages', id)
    },

    async clear(): Promise<void> {
      const instance = IndexedDBCache.getInstance()
      await instance.clear('messages')
    }
  },

  contacts: {
    async set<T>(userId: string, data: T, ttl?: number): Promise<void> {
      const instance = IndexedDBCache.getInstance()
      await instance.set('contacts', userId, data, ttl)
    },

    async get<T>(userId: string): Promise<T | null> {
      const instance = IndexedDBCache.getInstance()
      return instance.get<T>('contacts', userId)
    },

    async delete(userId: string): Promise<void> {
      const instance = IndexedDBCache.getInstance()
      await instance.delete('contacts', userId)
    },

    async clear(): Promise<void> {
      const instance = IndexedDBCache.getInstance()
      await instance.clear('contacts')
    }
  },

  inputDrafts: {
    async set(key: string, data: string, ttl?: number): Promise<void> {
      const instance = IndexedDBCache.getInstance()
      await instance.set('inputDrafts', key, { content: data, timestamp: Date.now() }, ttl)
    },

    async get(key: string): Promise<string | null> {
      const instance = IndexedDBCache.getInstance()
      const result = await instance.get<{ content: string; timestamp: number }>('inputDrafts', key)
      return result?.content ?? null
    },

    async delete(key: string): Promise<void> {
      const instance = IndexedDBCache.getInstance()
      await instance.delete('inputDrafts', key)
    },

    async clear(): Promise<void> {
      const instance = IndexedDBCache.getInstance()
      await instance.clear('inputDrafts')
    },

    async getAll(): Promise<{ key: string; content: string; timestamp: number }[]> {
      const instance = IndexedDBCache.getInstance()
      const results: { key: string; content: string; timestamp: number }[] = []

      await instance.forEach('inputDrafts', (key, value: { content: string; timestamp: number }) => {
        results.push({ key, ...value })
      })

      return results
    }
  },

  metadata: {
    async set<T>(key: string, data: T, ttl?: number): Promise<void> {
      const instance = IndexedDBCache.getInstance()
      await instance.set('metadata', key, data, ttl)
    },

    async get<T>(key: string): Promise<T | null> {
      const instance = IndexedDBCache.getInstance()
      return instance.get<T>('metadata', key)
    },

    async delete(key: string): Promise<void> {
      const instance = IndexedDBCache.getInstance()
      await instance.delete('metadata', key)
    }
  }
}

export {
  IndexedDBCache,
  DB_SCHEMAS,
  DEFAULT_CONFIG,
  type CacheEntry,
  type DBConfig,
  type StoreConfig,
  type AccountCacheConfig
}
