/**
 * MatrixStorageAdapter - Matrix SDK 的存储适配器
 * 将 Matrix SDK 的存储需求适配到项目的存储系统
 */

import { logger } from '@/utils/logger'
import type { IStorageProvider } from '../storage'

export class MatrixStorageAdapter {
  private readonly storageProvider: IStorageProvider
  private readonly prefix = 'matrix:'
  private initialized = false

  constructor(storageProvider: IStorageProvider) {
    this.storageProvider = storageProvider
  }

  /**
   * 初始化存储适配器
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      // 确保存储提供者已准备就绪
      if (typeof this.storageProvider.ready === 'function') {
        await this.storageProvider.ready()
      }

      this.initialized = true
      logger.info('Matrix storage adapter initialized')
    } catch (error) {
      logger.error('Failed to initialize Matrix storage adapter', error)
      throw error
    }
  }

  /**
   * 存储键值对
   */
  async setItem(key: string, value: string): Promise<void> {
    this.ensureInitialized()
    try {
      await this.storageProvider.setItem(`${this.prefix}${key}`, value)
    } catch (error) {
      logger.error('Failed to store item', { key, error })
      throw error
    }
  }

  /**
   * 获取值
   */
  async getItem(key: string): Promise<string | null> {
    this.ensureInitialized()
    try {
      return await this.storageProvider.getItem(`${this.prefix}${key}`)
    } catch (error) {
      logger.error('Failed to get item', { key, error })
      return null
    }
  }

  /**
   * 删除键
   */
  async removeItem(key: string): Promise<void> {
    this.ensureInitialized()
    try {
      await this.storageProvider.removeItem(`${this.prefix}${key}`)
    } catch (error) {
      logger.error('Failed to remove item', { key, error })
      throw error
    }
  }

  /**
   * 清空所有 Matrix 相关数据
   */
  async clear(): Promise<void> {
    this.ensureInitialized()
    try {
      // 获取所有键
      const keys = await this.getAllKeys()

      // 删除所有 Matrix 相关的键
      const removePromises = keys
        .filter((key) => key.startsWith(this.prefix))
        .map((key) => this.storageProvider.removeItem(key))

      await Promise.all(removePromises)

      logger.info('Matrix storage cleared')
    } catch (error) {
      logger.error('Failed to clear Matrix storage', error)
      throw error
    }
  }

  /**
   * 获取所有键
   */
  async getAllKeys(): Promise<string[]> {
    this.ensureInitialized()
    try {
      // 如果存储提供者支持 getAllKeys，使用它
      if (typeof this.storageProvider.getAllKeys === 'function') {
        return await this.storageProvider.getAllKeys()
      }

      // 否则返回空数组（需要根据具体存储实现调整）
      return []
    } catch (error) {
      logger.error('Failed to get all keys', error)
      return []
    }
  }

  /**
   * 存储用户数据
   */
  async setUser_data(userId: string, data: unknown): Promise<void> {
    const key = `user_data:${userId}`
    await this.setItem(key, JSON.stringify(data))
  }

  /**
   * 获取用户数据
   */
  async getUser_data(userId: string): Promise<unknown | null> {
    const key = `user_data:${userId}`
    const value = await this.getItem(key)
    return value ? JSON.parse(value) : null
  }

  /**
   * 删除用户数据
   */
  async removeUser_data(userId: string): Promise<void> {
    const key = `user_data:${userId}`
    await this.removeItem(key)
  }

  /**
   * 存储设备数据
   */
  async setDevice_data(deviceId: string, data: unknown): Promise<void> {
    const key = `device_data:${deviceId}`
    await this.setItem(key, JSON.stringify(data))
  }

  /**
   * 获取设备数据
   */
  async getDevice_data(deviceId: string): Promise<unknown | null> {
    const key = `device_data:${deviceId}`
    const value = await this.getItem(key)
    return value ? JSON.parse(value) : null
  }

  /**
   * 存储房间数据
   */
  async setRoom_data(roomId: string, data: unknown): Promise<void> {
    const key = `room_data:${roomId}`
    await this.setItem(key, JSON.stringify(data))
  }

  /**
   * 获取房间数据
   */
  async getRoom_data(roomId: string): Promise<unknown | null> {
    const key = `room_data:${roomId}`
    const value = await this.getItem(key)
    return value ? JSON.parse(value) : null
  }

  /**
   * 存储同步令牌
   */
  async setSync_token(token: string): Promise<void> {
    await this.setItem('sync_token', token)
  }

  /**
   * 获取同步令牌
   */
  async getSync_token(): Promise<string | null> {
    return await this.getItem('sync_token')
  }

  /**
   * 存储过滤 ID
   */
  async setFilter_id(filterId: string): Promise<void> {
    await this.setItem('filter_id', filterId)
  }

  /**
   * 获取过滤 ID
   */
  async getFilter_id(): Promise<string | null> {
    return await this.getItem('filter_id')
  }

  /**
   * 确保适配器已初始化
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Matrix storage adapter not initialized')
    }
  }

  /**
   * 创建用于 Matrix SDK 的存储适配器实例
   */
  static createForSDK(storageProvider: IStorageProvider): Record<string, unknown> {
    const adapter = new MatrixStorageAdapter(storageProvider)

    // 返回符合 Matrix SDK 期望的存储接口
    return {
      setItem: (key: string, value: string) => adapter.setItem(key, value),
      getItem: (key: string) => adapter.getItem(key),
      removeItem: (key: string) => adapter.removeItem(key),
      clear: () => adapter.clear(),
      // Matrix SDK 可能需要的其他方法
      length: 0, // 可以通过计算键数实现
      key: (_index: number) => null // 可以通过索引获取键实现
    }
  }
}
