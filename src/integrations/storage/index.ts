/**
 * 存储接口定义
 * 为 Matrix SDK 和其他组件提供统一的存储抽象层
 */

import { logger } from '@/utils/logger'

// Type definition for Tauri Store (dynamically imported)
type TauriStore = {
  new (path: string): TauriStore
  set(key: string, value: unknown): Promise<void>
  get<T = unknown>(key: string): Promise<T | null>
  delete(key: string): Promise<void>
  keys(): Promise<string[]>
}

export interface IStorageProvider {
  /**
   * 存储键值对
   */
  setItem(key: string, value: string): Promise<void>

  /**
   * 获取值
   */
  getItem(key: string): Promise<string | null>

  /**
   * 删除键
   */
  removeItem(key: string): Promise<void>

  /**
   * 清空所有数据
   */
  clear(): Promise<void>

  /**
   * 获取所有键（可选）
   */
  getAllKeys?(): Promise<string[]>

  /**
   * 获取存储中的键数量（可选）
   */
  length?: number

  /**
   * 根据索引获取键（可选）
   */
  key?(index: number): Promise<string | null>

  /**
   * 存储准备就绪（可选）
   */
  ready?(): Promise<void>
}

/**
 * 本地存储提供者（基于 localStorage）
 */
export class LocalStorageProvider implements IStorageProvider {
  private readonly prefix: string

  constructor(prefix = 'hula:') {
    this.prefix = prefix
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(this.prefix + key, value)
    } catch (error) {
      // 处理存储空间不足等错误
      throw new Error(`Failed to set item ${key}: ${error}`)
    }
  }

  async getItem(key: string): Promise<string | null> {
    try {
      return localStorage.getItem(this.prefix + key)
    } catch (error) {
      throw new Error(`Failed to get item ${key}: ${error}`)
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      localStorage.removeItem(this.prefix + key)
    } catch (error) {
      throw new Error(`Failed to remove item ${key}: ${error}`)
    }
  }

  async clear(): Promise<void> {
    try {
      const keys = Object.keys(localStorage).filter((key) => key.startsWith(this.prefix))
      keys.forEach((key) => localStorage.removeItem(key))
    } catch (error) {
      throw new Error(`Failed to clear storage: ${error}`)
    }
  }

  async getAllKeys(): Promise<string[]> {
    try {
      return Object.keys(localStorage)
        .filter((key) => key.startsWith(this.prefix))
        .map((key) => key.slice(this.prefix.length))
    } catch (error) {
      throw new Error(`Failed to get all keys: ${error}`)
    }
  }

  async ready(): Promise<void> {
    // localStorage 总是准备就绪
  }

  get length(): number {
    return Object.keys(localStorage).filter((key) => key.startsWith(this.prefix)).length
  }

  async key(index: number): Promise<string | null> {
    const keys = Object.keys(localStorage).filter((key) => key.startsWith(this.prefix))
    return keys[index]?.slice(this.prefix.length) || null
  }
}

/**
 * 内存存储提供者（用于测试或临时存储）
 */
export class MemoryStorageProvider implements IStorageProvider {
  private readonly storage = new Map<string, string>()
  private readonly prefix: string

  constructor(prefix = 'hula:') {
    this.prefix = prefix
  }

  async setItem(key: string, value: string): Promise<void> {
    this.storage.set(this.prefix + key, value)
  }

  async getItem(key: string): Promise<string | null> {
    return this.storage.get(this.prefix + key) || null
  }

  async removeItem(key: string): Promise<void> {
    this.storage.delete(this.prefix + key)
  }

  async clear(): Promise<void> {
    this.storage.clear()
  }

  async getAllKeys(): Promise<string[]> {
    return Array.from(this.storage.keys())
      .filter((key) => key.startsWith(this.prefix))
      .map((key) => key.slice(this.prefix.length))
  }

  async ready(): Promise<void> {
    // 内存存储总是准备就绪
  }

  get length(): number {
    return Array.from(this.storage.keys()).filter((key) => key.startsWith(this.prefix)).length
  }

  async key(index: number): Promise<string | null> {
    const keys = Array.from(this.storage.keys()).filter((key) => key.startsWith(this.prefix))
    return keys[index]?.slice(this.prefix.length) || null
  }
}

/**
 * Tauri 存储提供者（使用 Tauri 的存储 API）
 */
export class TauriStorageProvider implements IStorageProvider {
  private readonly prefix: string
  private readyPromise: Promise<void> | null = null

  constructor(prefix = 'hula:') {
    this.prefix = prefix
  }

  private async ensureTauri(): Promise<TauriStore | null> {
    // 动态导入 Tauri API
    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      try {
        // Check if the plugin is available before importing
        // Note: @tauri-apps/plugin-store is an optional dependency
        const module = await import('@tauri-apps/plugin-store' as string).catch(() => {
          // Store plugin not available, fallback to localStorage
          return { Store: null }
        })
        if (module?.Store) {
          return module.Store as unknown as TauriStore
        }
      } catch (e) {
        // Store plugin not available, fallback to localStorage
        logger.warn('Tauri store plugin not available:', e)
      }
    }
    return null
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      const Store = await this.ensureTauri()
      if (Store) {
        const store = new Store('.settings.dat')
        await store.set(this.prefix + key, value)
      } else {
        // Fallback to localStorage
        localStorage.setItem(this.prefix + key, value)
      }
    } catch (error) {
      throw new Error(`Failed to set item ${key}: ${error}`)
    }
  }

  async getItem(key: string): Promise<string | null> {
    try {
      const Store = await this.ensureTauri()
      if (Store) {
        const store = new Store('.settings.dat')
        const value = await store.get(this.prefix + key)
        return value !== null ? String(value) : null
      } else {
        // Fallback to localStorage
        return localStorage.getItem(this.prefix + key)
      }
    } catch (error) {
      throw new Error(`Failed to get item ${key}: ${error}`)
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      const Store = await this.ensureTauri()
      if (Store) {
        const store = new Store('.settings.dat')
        await store.delete(this.prefix + key)
      } else {
        // Fallback to localStorage
        localStorage.removeItem(this.prefix + key)
      }
    } catch (error) {
      throw new Error(`Failed to remove item ${key}: ${error}`)
    }
  }

  async clear(): Promise<void> {
    try {
      const Store = await this.ensureTauri()
      if (Store) {
        const store = new Store('.settings.dat')
        const keys = await store.keys()
        const matrixKeys = keys.filter((key: string) => key.startsWith(this.prefix))
        await Promise.all(matrixKeys.map((key: string) => store.delete(key)))
      } else {
        // Fallback to localStorage - only clear items with our prefix
        const keys = Object.keys(localStorage).filter((k) => k.startsWith(this.prefix))
        keys.forEach((k) => localStorage.removeItem(k))
      }
    } catch (error) {
      throw new Error(`Failed to clear storage: ${error}`)
    }
  }

  async getAllKeys(): Promise<string[]> {
    try {
      const Store = await this.ensureTauri()
      if (Store) {
        const store = new Store('.settings.dat')
        const keys = await store.keys()
        return keys
          .filter((key: string) => key.startsWith(this.prefix))
          .map((key: string) => key.slice(this.prefix.length))
      } else {
        // Fallback to localStorage
        return Object.keys(localStorage)
          .filter((key) => key.startsWith(this.prefix))
          .map((key) => key.slice(this.prefix.length))
      }
    } catch (error) {
      throw new Error(`Failed to get all keys: ${error}`)
    }
  }

  async ready(): Promise<void> {
    if (!this.readyPromise) {
      this.readyPromise = this.ensureTauri().then(() => undefined)
    }
    await this.readyPromise
  }
}

/**
 * 存储工厂
 */
export class StorageFactory {
  private static instance: StorageFactory | null = null
  private providers = new Map<string, IStorageProvider>()

  static getInstance(): StorageFactory {
    if (!StorageFactory.instance) {
      StorageFactory.instance = new StorageFactory()
    }
    return StorageFactory.instance
  }

  /**
   * 注册存储提供者
   */
  register(name: string, provider: IStorageProvider): void {
    this.providers.set(name, provider)
  }

  /**
   * 获取存储提供者
   */
  get(name: string): IStorageProvider | undefined {
    return this.providers.get(name)
  }

  /**
   * 创建默认的存储提供者
   */
  createDefault(): IStorageProvider {
    // 根据环境自动选择存储提供者
    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      return new TauriStorageProvider()
    } else if (typeof localStorage !== 'undefined') {
      return new LocalStorageProvider()
    } else {
      return new MemoryStorageProvider()
    }
  }

  /**
   * 创建测试用的存储提供者
   */
  createTest(): IStorageProvider {
    return new MemoryStorageProvider('test:')
  }
}
