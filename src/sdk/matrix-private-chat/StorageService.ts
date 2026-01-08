/**
 * Matrix PrivateChat Storage Service
 * 实现本地持久化存储
 *
 * @module sdk/matrix-private-chat/StorageService
 */

import type { PrivateChatStorageApi, StoredPrivateChatSession, StoredPrivateChatMessage, SyncResult } from './types'
import { logger } from '@/utils/logger'

/**
 * 存储键前缀
 */
const STORAGE_PREFIX = 'private_chat_'

/**
 * 存储键
 */
const STORAGE_KEYS = {
  SESSIONS: `${STORAGE_PREFIX}sessions`,
  MESSAGES: (sessionId: string) => `${STORAGE_PREFIX}messages_${sessionId}`,
  SESSION_KEYS: `${STORAGE_PREFIX}session_keys`,
  LAST_SYNC: `${STORAGE_PREFIX}last_sync`,
  SYNC_STATE: `${STORAGE_PREFIX}sync_state`
} as const

/**
 * 存储服务实现类
 * 使用 IndexedDB 进行本地存储（Web 环境）
 * 或 localStorage 作为后备
 */
export class PrivateChatStorageService implements PrivateChatStorageApi {
  private readonly dbName = 'PrivateChatDB'
  private readonly dbVersion = 1
  private readonly storeNames = ['sessions', 'messages', 'sessionKeys'] as const
  private db: IDBDatabase | null = null
  private initialized = false

  /**
   * 初始化存储服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      // 尝试使用 IndexedDB
      await this.initializeIndexedDB()
      this.initialized = true
    } catch (error) {
      // IndexedDB 不可用，使用 localStorage 作为后备
      logger.warn('IndexedDB not available, falling back to localStorage:', error)
      this.initialized = true
    }
  }

  /**
   * 保存会话
   *
   * @param session - 会话数据
   * @returns Promise<void>
   */
  async saveSession(session: StoredPrivateChatSession): Promise<void> {
    this.ensureInitialized()

    if (this.db) {
      await this.saveSessionIndexedDB(session)
    } else {
      this.saveSessionLocalStorage(session)
    }
  }

  /**
   * 获取所有会话
   *
   * @returns Promise<StoredPrivateChatSession[]>
   */
  async getSessions(): Promise<StoredPrivateChatSession[]> {
    this.ensureInitialized()

    if (this.db) {
      return await this.getSessionsIndexedDB()
    } else {
      return this.getSessionsLocalStorage()
    }
  }

  /**
   * 获取单个会话
   *
   * @param sessionId - 会话 ID
   * @returns Promise<StoredPrivateChatSession | null>
   */
  async getSession(sessionId: string): Promise<StoredPrivateChatSession | null> {
    this.ensureInitialized()

    if (this.db) {
      return await this.getSessionIndexedDB(sessionId)
    } else {
      return this.getSessionLocalStorage(sessionId)
    }
  }

  /**
   * 删除会话
   *
   * @param sessionId - 会话 ID
   * @returns Promise<void>
   */
  async deleteSession(sessionId: string): Promise<void> {
    this.ensureInitialized()

    if (this.db) {
      await this.deleteSessionIndexedDB(sessionId)
    } else {
      this.deleteSessionLocalStorage(sessionId)
    }
  }

  /**
   * 保存消息
   *
   * @param message - 消息数据
   * @returns Promise<void>
   */
  async saveMessage(message: StoredPrivateChatMessage): Promise<void> {
    this.ensureInitialized()

    if (this.db) {
      await this.saveMessageIndexedDB(message)
    } else {
      this.saveMessageLocalStorage(message)
    }
  }

  /**
   * 获取会话消息
   *
   * @param sessionId - 会话 ID
   * @returns Promise<StoredPrivateChatMessage[]>
   */
  async getMessages(sessionId: string): Promise<StoredPrivateChatMessage[]> {
    this.ensureInitialized()

    if (this.db) {
      return await this.getMessagesIndexedDB(sessionId)
    } else {
      return this.getMessagesLocalStorage(sessionId)
    }
  }

  /**
   * 删除会话消息
   *
   * @param sessionId - 会话 ID
   * @returns Promise<void>
   */
  async deleteMessages(sessionId: string): Promise<void> {
    this.ensureInitialized()

    if (this.db) {
      await this.deleteMessagesIndexedDB(sessionId)
    } else {
      this.deleteMessagesLocalStorage(sessionId)
    }
  }

  /**
   * 保存会话密钥（加密）
   *
   * @param sessionId - 会话 ID
   * @param key - CryptoKey
   * @returns Promise<void>
   */
  async saveSessionKey(sessionId: string, key: CryptoKey): Promise<void> {
    this.ensureInitialized()

    // 导出密钥为原始格式
    const rawKey = await crypto.subtle.exportKey('raw', key)

    // 存储为 Base64（注意：实际应用中应该使用更安全的方式）
    const keyData = {
      sessionId,
      key: this.bufferToBase64(new Uint8Array(rawKey)),
      algorithm: key.algorithm.name,
      createdAt: Date.now()
    }

    if (this.db) {
      await this.saveSessionKeyIndexedDB(keyData)
    } else {
      this.saveSessionKeyLocalStorage(keyData)
    }
  }

  /**
   * 获取会话密钥
   *
   * @param sessionId - 会话 ID
   * @returns Promise<CryptoKey | null>
   */
  async getSessionKey(sessionId: string): Promise<CryptoKey | null> {
    this.ensureInitialized()

    let keyData: { key: string; algorithm: string } | null = null

    if (this.db) {
      keyData = await this.getSessionKeyIndexedDB(sessionId)
    } else {
      keyData = this.getSessionKeyLocalStorage(sessionId)
    }

    if (!keyData) {
      return null
    }

    // 导入密钥
    const keyBytes = this.base64ToBuffer(keyData.key)

    return await crypto.subtle.importKey(
      'raw',
      keyBytes as unknown as ArrayBuffer,
      { name: keyData.algorithm as 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    )
  }

  /**
   * 删除会话密钥
   *
   * @param sessionId - 会话 ID
   * @returns Promise<void>
   */
  async deleteSessionKey(sessionId: string): Promise<void> {
    this.ensureInitialized()

    if (this.db) {
      await this.deleteSessionKeyIndexedDB(sessionId)
    } else {
      this.deleteSessionKeyLocalStorage(sessionId)
    }
  }

  /**
   * 同步数据
   *
   * @returns Promise<SyncResult>
   */
  async syncFromServer(): Promise<SyncResult> {
    this.ensureInitialized()

    const startTime = Date.now()
    const sessionsMerged = 0
    const conflictsResolved = 0

    try {
      // 获取服务器数据（这里需要与 API 集成）
      // const serverData = await fetchFromServer()

      // 合并本地和服务器数据
      // const mergeResult = await mergeData(serverData)

      const duration = Date.now() - startTime

      return {
        success: true,
        duration,
        sessionsMerged,
        conflictsResolved
      }
    } catch (error) {
      const duration = Date.now() - startTime
      return {
        success: false,
        duration,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * 获取最后同步时间
   *
   * @returns Promise<number>
   */
  async getLastSyncTime(): Promise<number> {
    this.ensureInitialized()

    const time = localStorage.getItem(STORAGE_KEYS.LAST_SYNC)
    return time ? parseInt(time, 10) : 0
  }

  /**
   * 清除缓存
   *
   * @returns Promise<void>
   */
  async clearCache(): Promise<void> {
    this.ensureInitialized()

    if (this.db) {
      // 清除 IndexedDB
      for (const storeName of this.storeNames) {
        const tx = this.db!.transaction(storeName, 'readwrite')
        await new Promise<void>((resolve, reject) => {
          const request = tx.objectStore(storeName).clear()
          request.onsuccess = () => resolve()
          request.onerror = () => reject(request.error)
        })
      }
    }

    // 清除 localStorage 后备数据
    const keys = Object.keys(localStorage)
    for (const key of keys) {
      if (key.startsWith(STORAGE_PREFIX)) {
        localStorage.removeItem(key)
      }
    }
  }

  /**
   * 获取缓存大小
   *
   * @returns Promise<number>
   */
  async getCacheSize(): Promise<number> {
    this.ensureInitialized()

    let size = 0

    // 计算 localStorage 大小
    const keys = Object.keys(localStorage)
    for (const key of keys) {
      if (key.startsWith(STORAGE_PREFIX)) {
        size += localStorage.getItem(key)?.length || 0
      }
    }

    // 如果使用 IndexedDB，计算其大小
    if (this.db) {
      for (const storeName of this.storeNames) {
        const tx = this.db.transaction(storeName, 'readonly')
        const count = await new Promise<number>((resolve, reject) => {
          const request = tx.objectStore(storeName).count()
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })

        // 估算大小（假设每条记录约 1KB）
        size += count * 1024
      }
    }

    return size
  }

  // ==================== IndexedDB 实现 ====================

  /**
   * 初始化 IndexedDB
   */
  private async initializeIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // 创建对象存储
        for (const storeName of this.storeNames) {
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, { keyPath: 'id' })
            store.createIndex('sessionId', 'sessionId', { unique: false })
            store.createIndex('createdAt', 'createdAt', { unique: false })
          }
        }
      }
    })
  }

  /**
   * IndexedDB - 保存会话
   */
  private async saveSessionIndexedDB(session: StoredPrivateChatSession): Promise<void> {
    const tx = this.db!.transaction('sessions', 'readwrite')
    await new Promise<void>((resolve, reject) => {
      const request = tx.objectStore('sessions').put({
        id: session.session_id,
        ...session,
        synced_at: Date.now()
      })
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * IndexedDB - 获取所有会话
   */
  private async getSessionsIndexedDB(): Promise<StoredPrivateChatSession[]> {
    const tx = this.db!.transaction('sessions', 'readonly')
    return new Promise((resolve, reject) => {
      const request = tx.objectStore('sessions').getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * IndexedDB - 获取单个会话
   */
  private async getSessionIndexedDB(sessionId: string): Promise<StoredPrivateChatSession | null> {
    const tx = this.db!.transaction('sessions', 'readonly')
    return new Promise((resolve, reject) => {
      const request = tx.objectStore('sessions').get(sessionId)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * IndexedDB - 删除会话
   */
  private async deleteSessionIndexedDB(sessionId: string): Promise<void> {
    const tx = this.db!.transaction('sessions', 'readwrite')
    await new Promise<void>((resolve, reject) => {
      const request = tx.objectStore('sessions').delete(sessionId)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * IndexedDB - 保存消息
   */
  private async saveMessageIndexedDB(message: StoredPrivateChatMessage): Promise<void> {
    const tx = this.db!.transaction('messages', 'readwrite')
    await new Promise<void>((resolve, reject) => {
      const request = tx.objectStore('messages').put({
        id: message.message_id,
        ...message,
        synced_at: Date.now()
      })
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * IndexedDB - 获取会话消息
   */
  private async getMessagesIndexedDB(sessionId: string): Promise<StoredPrivateChatMessage[]> {
    const tx = this.db!.transaction('messages', 'readonly')
    const index = tx.objectStore('messages').index('sessionId')
    return new Promise((resolve, reject) => {
      const request = index.getAll(sessionId)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * IndexedDB - 删除会话消息
   */
  private async deleteMessagesIndexedDB(sessionId: string): Promise<void> {
    const tx = this.db!.transaction('messages', 'readwrite')
    const index = tx.objectStore('messages').index('sessionId')
    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      const request = index.getAllKeys(sessionId)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    for (const key of keys) {
      await new Promise<void>((resolve, reject) => {
        const request = tx.objectStore('messages').delete(key)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    }
  }

  /**
   * IndexedDB - 保存会话密钥
   */
  private async saveSessionKeyIndexedDB(keyData: {
    sessionId: string
    key: string
    algorithm: string
    createdAt: number
  }): Promise<void> {
    const tx = this.db!.transaction('sessionKeys', 'readwrite')
    await new Promise<void>((resolve, reject) => {
      const request = tx.objectStore('sessionKeys').put(keyData)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * IndexedDB - 获取会话密钥
   */
  private async getSessionKeyIndexedDB(sessionId: string): Promise<{
    key: string
    algorithm: string
  } | null> {
    const tx = this.db!.transaction('sessionKeys', 'readonly')
    return new Promise((resolve, reject) => {
      const request = tx.objectStore('sessionKeys').get(sessionId)
      request.onsuccess = () => {
        const result = request.result
        resolve(result ? { key: result.key, algorithm: result.algorithm } : null)
      }
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * IndexedDB - 删除会话密钥
   */
  private async deleteSessionKeyIndexedDB(sessionId: string): Promise<void> {
    const tx = this.db!.transaction('sessionKeys', 'readwrite')
    await new Promise<void>((resolve, reject) => {
      const request = tx.objectStore('sessionKeys').delete(sessionId)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  // ==================== LocalStorage 后备实现 ====================

  /**
   * LocalStorage - 保存会话
   */
  private saveSessionLocalStorage(session: StoredPrivateChatSession): void {
    const sessions = this.getSessionsLocalStorage()
    const index = sessions.findIndex((s) => s.session_id === session.session_id)

    if (index >= 0) {
      sessions[index] = { ...session, synced_at: Date.now() }
    } else {
      sessions.push({ ...session, synced_at: Date.now() })
    }

    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions))
  }

  /**
   * LocalStorage - 获取所有会话
   */
  private getSessionsLocalStorage(): StoredPrivateChatSession[] {
    const data = localStorage.getItem(STORAGE_KEYS.SESSIONS)
    return data ? JSON.parse(data) : []
  }

  /**
   * LocalStorage - 获取单个会话
   */
  private getSessionLocalStorage(sessionId: string): StoredPrivateChatSession | null {
    const sessions = this.getSessionsLocalStorage()
    return sessions.find((s) => s.session_id === sessionId) || null
  }

  /**
   * LocalStorage - 删除会话
   */
  private deleteSessionLocalStorage(sessionId: string): void {
    const sessions = this.getSessionsLocalStorage().filter((s) => s.session_id !== sessionId)
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions))
  }

  /**
   * LocalStorage - 保存消息
   */
  private saveMessageLocalStorage(message: StoredPrivateChatMessage): void {
    const key = STORAGE_KEYS.MESSAGES(message.session_id)
    const messages = this.getMessagesLocalStorage(message.session_id)

    // 检查是否已存在
    const index = messages.findIndex((m) => m.message_id === message.message_id)

    if (index >= 0) {
      messages[index] = { ...message, synced_at: Date.now() }
    } else {
      messages.push({ ...message, synced_at: Date.now() })
    }

    localStorage.setItem(key, JSON.stringify(messages))
  }

  /**
   * LocalStorage - 获取会话消息
   */
  private getMessagesLocalStorage(sessionId: string): StoredPrivateChatMessage[] {
    const key = STORAGE_KEYS.MESSAGES(sessionId)
    const data = localStorage.getItem(key)
    return data ? JSON.parse(data) : []
  }

  /**
   * LocalStorage - 删除会话消息
   */
  private deleteMessagesLocalStorage(sessionId: string): void {
    const key = STORAGE_KEYS.MESSAGES(sessionId)
    localStorage.removeItem(key)
  }

  /**
   * LocalStorage - 保存会话密钥
   */
  private saveSessionKeyLocalStorage(keyData: {
    sessionId: string
    key: string
    algorithm: string
    createdAt: number
  }): void {
    const keys = JSON.parse(localStorage.getItem(STORAGE_KEYS.SESSION_KEYS) || '{}')
    keys[keyData.sessionId] = keyData
    localStorage.setItem(STORAGE_KEYS.SESSION_KEYS, JSON.stringify(keys))
  }

  /**
   * LocalStorage - 获取会话密钥
   */
  private getSessionKeyLocalStorage(sessionId: string): { key: string; algorithm: string } | null {
    const keys = JSON.parse(localStorage.getItem(STORAGE_KEYS.SESSION_KEYS) || '{}')
    const keyData = keys[sessionId]
    return keyData ? { key: keyData.key, algorithm: keyData.algorithm } : null
  }

  /**
   * LocalStorage - 删除会话密钥
   */
  private deleteSessionKeyLocalStorage(sessionId: string): void {
    const keys = JSON.parse(localStorage.getItem(STORAGE_KEYS.SESSION_KEYS) || '{}')
    delete keys[sessionId]
    localStorage.setItem(STORAGE_KEYS.SESSION_KEYS, JSON.stringify(keys))
  }

  // ==================== 工具方法 ====================

  /**
   * 确保已初始化
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Storage service not initialized. Call initialize() first.')
    }
  }

  /**
   * Buffer 转 Base64
   */
  private bufferToBase64(buffer: Uint8Array): string {
    const binary = Array.from(buffer, (byte) => String.fromCharCode(byte)).join('')
    return btoa(binary)
  }

  /**
   * Base64 转 Buffer
   */
  private base64ToBuffer(base64: string): Uint8Array {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  }

  /**
   * 清理资源
   */
  dispose(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
    this.initialized = false
  }
}

/**
 * 创建存储服务实例
 *
 * @returns 存储服务实例
 */
export function createStorageService(): PrivateChatStorageService {
  return new PrivateChatStorageService()
}
