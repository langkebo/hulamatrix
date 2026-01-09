/**
 * Enhanced Friends Service - Main Entry Point
 * Orchestrates all friends-related modules and provides unified API
 */

import { logger } from '@/utils/logger'
import { PresenceManager } from './presence'
import { IgnoredUsersManager } from './ignored-users'
import { FriendListManager } from './friend-list'
import { FriendRequestsManager } from './friend-requests'
import { FriendManager } from './friend-management'
import { CategoriesManager } from './categories'
import type { Friend, FriendCategory, PresenceUpdateCallback, PresenceCacheEntry } from './types'

/**
 * Enhanced Friends Service
 * Main service class that orchestrates all friends functionality
 */
export class EnhancedFriendsService {
  private static instance: EnhancedFriendsService

  /** 服务是否已初始化 */
  private initialized = false

  /** Sub-managers */
  private presence: PresenceManager
  private ignoredUsers: IgnoredUsersManager
  private friendList: FriendListManager
  private friendRequests: FriendRequestsManager
  private friendManager: FriendManager
  private categories: CategoriesManager

  private constructor() {
    this.presence = new PresenceManager()
    this.ignoredUsers = new IgnoredUsersManager()
    this.friendList = new FriendListManager()
    this.friendRequests = new FriendRequestsManager()
    this.friendManager = new FriendManager()
    this.categories = new CategoriesManager()
  }

  static getInstance(): EnhancedFriendsService {
    if (!EnhancedFriendsService.instance) {
      EnhancedFriendsService.instance = new EnhancedFriendsService()
    }
    return EnhancedFriendsService.instance
  }

  /**
   * 重置单例实例（仅用于测试）
   * @internal
   */
  static resetInstance(): void {
    EnhancedFriendsService.instance = null as unknown as EnhancedFriendsService
  }

  /**
   * 创建测试实例（仅用于测试）
   * @internal
   */
  static createTestInstance(): EnhancedFriendsService {
    return new EnhancedFriendsService()
  }

  /**
   * Initialize the friends service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      await this.presence.initialize()
      this.initialized = true
      logger.info('[EnhancedFriends] Service initialized')
    } catch (error) {
      logger.error('[EnhancedFriends] Failed to initialize:', error)
      throw error
    }
  }

  /**
   * 忽略用户
   */
  async ignoreUsers(userIds: string[]): Promise<void> {
    return this.ignoredUsers.ignoreUsers(userIds)
  }

  /**
   * 取消忽略用户
   */
  async unignoreUsers(userIds: string[]): Promise<void> {
    return this.ignoredUsers.unignoreUsers(userIds)
  }

  /**
   * 获取已忽略的用户列表
   */
  async getIgnoredUsers(): Promise<string[]> {
    return this.ignoredUsers.getIgnoredUsers()
  }

  /**
   * 检查用户是否被忽略
   */
  async isUserIgnored(userId: string): Promise<boolean> {
    return this.ignoredUsers.isUserIgnored(userId)
  }

  /**
   * 订阅Presence更新
   */
  subscribeToPresence(): void {
    this.presence.isPresenceSubscribed()
  }

  /**
   * 取消订阅Presence更新
   */
  unsubscribeFromPresence(): void {
    // Presence manager handles this internally
  }

  /**
   * 添加Presence更新监听器
   */
  onPresenceUpdate(callback: PresenceUpdateCallback): void {
    this.presence.onPresenceUpdate(callback)
  }

  /**
   * 移除Presence更新监听器
   */
  offPresenceUpdate(callback: PresenceUpdateCallback): void {
    this.presence.offPresenceUpdate(callback)
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized
  }

  /**
   * 列出所有好友
   */
  async listFriends(): Promise<Friend[]> {
    return this.friendList.listFriends()
  }

  /**
   * 从 m.direct 获取好友列表
   */
  async listFriendsFromMDirect(): Promise<Friend[]> {
    return this.friendList.listFriendsFromMDirect()
  }

  /**
   * 获取带有Presence的好友列表
   */
  async listFriendsWithPresence(): Promise<Friend[]> {
    return this.presence.syncPresenceForFriends(await this.friendList.listFriends())
  }

  /**
   * 同步好友Presence
   */
  async syncPresenceForFriends(friends: Friend[]): Promise<Friend[]> {
    return this.presence.syncPresenceForFriends(friends)
  }

  /**
   * 发送好友请求
   */
  async sendFriendRequest(targetUserId: string, message?: string): Promise<string> {
    return this.friendRequests.sendFriendRequest(targetUserId, message)
  }

  /**
   * 接受好友请求
   */
  async acceptFriendRequest(roomId: string, requestId?: string): Promise<void> {
    return this.friendRequests.acceptFriendRequest(roomId, requestId)
  }

  /**
   * 拒绝好友请求
   */
  async rejectFriendRequest(roomId: string, requestId?: string): Promise<void> {
    return this.friendRequests.rejectFriendRequest(roomId, requestId)
  }

  /**
   * 删除好友
   */
  async removeFriend(userId: string, roomId: string): Promise<void> {
    return this.friendManager.removeFriend(userId, roomId)
  }

  /**
   * 更新 m.direct
   */
  async updateMDirect(userId: string, roomId: string): Promise<void> {
    return this.friendRequests.updateMDirect(userId, roomId)
  }

  /**
   * 从 m.direct 移除
   */
  async removeMDirect(userId: string, roomId: string): Promise<void> {
    return this.friendRequests.removeMDirect(userId, roomId)
  }

  /**
   * 获取用户Presence
   */
  async getPresence(userId: string): Promise<'online' | 'offline' | 'unavailable' | 'away'> {
    return this.presence.getPresence(userId)
  }

  /**
   * 获取缓存的Presence
   */
  getCachedPresence(userId: string): PresenceCacheEntry | undefined {
    return this.presence.getCachedPresence(userId)
  }

  /**
   * 清空Presence缓存
   */
  clearPresenceCache(): void {
    this.presence.clearPresenceCache()
  }

  /**
   * 检查是否已订阅Presence
   */
  isPresenceSubscribed(): boolean {
    return this.presence.isPresenceSubscribed()
  }

  /**
   * 重置Synapse可用性检查
   */
  resetSynapseAvailability(): void {
    this.categories.resetSynapseAvailability()
  }

  /**
   * 检查Synapse扩展是否可用
   */
  isSynapseExtensionAvailable(): boolean {
    return this.categories.isSynapseExtensionAvailable()
  }

  /**
   * 列出所有分类
   */
  async listCategories(): Promise<FriendCategory[]> {
    return this.categories.listCategories()
  }

  /**
   * 创建分类
   */
  async createCategory(name: string): Promise<FriendCategory> {
    return this.categories.createCategory(name)
  }

  /**
   * 重命名分类
   */
  async renameCategory(categoryId: string, newName: string): Promise<void> {
    return this.categories.renameCategory(categoryId, newName)
  }

  /**
   * 删除分类
   */
  async deleteCategory(categoryId: string): Promise<void> {
    return this.categories.deleteCategory(categoryId)
  }

  /**
   * 重新排序分类
   */
  async reorderCategories(categoryIds: string[]): Promise<void> {
    return this.categories.reorderCategories(categoryIds)
  }

  /**
   * 设置好友分类
   */
  async setFriendCategory(roomId: string, categoryId: string | null): Promise<void> {
    return this.categories.setFriendCategory(roomId, categoryId)
  }

  /**
   * 获取好友分类
   */
  async getFriendCategory(roomId: string): Promise<string | undefined> {
    return this.categories.getFriendCategory(roomId)
  }

  /**
   * 获取指定分类的好友
   */
  async getFriendsByCategory(categoryId: string | null): Promise<Friend[]> {
    return this.categories.getFriendsByCategory(categoryId, () => this.listFriends())
  }

  /**
   * 获取按分类分组的好友
   */
  async getFriendsGroupedByCategory(): Promise<Map<string | null, Friend[]>> {
    return this.categories.getFriendsGroupedByCategory(() => this.listFriends())
  }
}

// Export singleton instance
export const enhancedFriendsService = EnhancedFriendsService.getInstance()

// Re-export types
export * from './types'
