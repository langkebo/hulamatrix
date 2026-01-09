/**
 * Matrix Friends Adapter v2.0
 *
 * 基于 SDK v2.0 API 的好友适配器（可选迁移工具）
 *
 * 推荐方式：直接使用 useFriendsStoreV2
 * import { useFriendsStoreV2 } from '@/stores/friendsSDK'
 *
 * 此适配器仅用于平滑迁移，保持与旧适配器相同的接口
 */

import { friendsServiceV2 } from '@/services/friendsServiceV2'
import type { FriendItem, FriendCategoryItem, PendingRequestItem } from '@/types/matrix-sdk-v2'
import { logger } from '@/utils/logger'

/**
 * Matrix Friends Adapter v2.0
 * 简化版，不导出类型以避免冲突
 */
export const matrixFriendAdapterV2 = {
  /**
   * 获取好友列表
   */
  async listFriends(_options?: { includePresence?: boolean }): Promise<FriendItem[]> {
    try {
      return await friendsServiceV2.listFriends(true)
    } catch (error) {
      logger.error('[FriendsAdapterV2] Failed to list friends:', error)
      throw error
    }
  },

  /**
   * 获取好友分类列表
   */
  async listCategories(): Promise<FriendCategoryItem[]> {
    try {
      return await friendsServiceV2.getCategories()
    } catch (error) {
      logger.error('[FriendsAdapterV2] Failed to list categories:', error)
      throw error
    }
  },

  /**
   * 获取待处理的好友请求
   */
  async getPendingRequests(): Promise<PendingRequestItem[]> {
    try {
      return await friendsServiceV2.getPendingRequests()
    } catch (error) {
      logger.error('[FriendsAdapterV2] Failed to get pending requests:', error)
      throw error
    }
  },

  /**
   * 发送好友请求
   */
  async sendFriendRequest(targetId: string, message?: string, categoryId?: string | null): Promise<string> {
    try {
      return await friendsServiceV2.sendFriendRequest(
        targetId,
        message,
        categoryId ? parseInt(categoryId, 10) : undefined
      )
    } catch (error) {
      logger.error('[FriendsAdapterV2] Failed to send friend request:', error)
      throw error
    }
  },

  /**
   * 接受好友请求
   */
  async acceptFriendRequest(requestId: string, categoryId?: string | null): Promise<void> {
    try {
      await friendsServiceV2.acceptFriendRequest(requestId, categoryId ? parseInt(categoryId, 10) : undefined)
    } catch (error) {
      logger.error('[FriendsAdapterV2] Failed to accept friend request:', error)
      throw error
    }
  },

  /**
   * 拒绝好友请求
   */
  async rejectFriendRequest(requestId: string): Promise<void> {
    try {
      await friendsServiceV2.rejectFriendRequest(requestId)
    } catch (error) {
      logger.error('[FriendsAdapterV2] Failed to reject friend request:', error)
      throw error
    }
  },

  /**
   * 删除好友
   */
  async removeFriend(friendId: string): Promise<void> {
    try {
      await friendsServiceV2.removeFriend(friendId)
    } catch (error) {
      logger.error('[FriendsAdapterV2] Failed to remove friend:', error)
      throw error
    }
  },

  /**
   * 搜索用户
   */
  async searchUsers(query: string, limit = 20): Promise<FriendItem[]> {
    try {
      const searchResults = await friendsServiceV2.searchUsers(query, limit)
      // 将 SearchedUser 转换为 FriendItem，添加缺失的 created_at 字段
      return searchResults.map(
        (user): FriendItem => ({
          user_id: user.user_id,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          presence: 'offline',
          created_at: new Date().toISOString() // 搜索结果没有 created_at，使用当前时间
        })
      )
    } catch (error) {
      logger.error('[FriendsAdapterV2] Failed to search users:', error)
      throw error
    }
  },

  /**
   * 清除缓存
   */
  invalidateCache(): void {
    friendsServiceV2.invalidateCache()
  }
}

export default matrixFriendAdapterV2
