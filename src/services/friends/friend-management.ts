/**
 * Friend Management
 * Handles friend CRUD operations (add, remove, update)
 */

import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'
import type { Friend } from './types'

/**
 * Friend Manager
 */
export class FriendManager {
  /**
   * 删除好友
   */
  async removeFriend(userId: string, roomId: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      // 优先使用 Synapse 扩展 API
      const synapseApi = await import('@/integrations/synapse/friends')
      await synapseApi.removeFriend(userId)
      logger.info('[FriendManager] Friend removed via Synapse API', { userId })
    } catch (synapseError) {
      logger.warn('[FriendManager] Synapse API failed, using fallback', synapseError)
    }

    // Fallback: 离开房间并更新 m.direct
    try {
      const leaveMethod = client.leave as ((roomId: string) => Promise<void>) | undefined
      await leaveMethod?.(roomId)
      logger.debug('[FriendManager] Left room', { roomId })
    } catch (error) {
      logger.warn('[FriendManager] Failed to leave room during friend removal', { error, roomId })
    }

    // 更新 m.direct
    const friendRequests = await import('./friend-requests')
    const friendRequestsManager = new friendRequests.FriendRequestsManager()

    // Create a temporary instance to access the method
    const tempInstance = Object.create(friendRequestsManager)
    await tempInstance.removeMDirect.call(friendRequestsManager, userId, roomId)

    logger.info('[FriendManager] Friend removed', { userId, roomId })
  }

  /**
   * 获取好友信息
   */
  async getFriendInfo(userId: string, roomId: string): Promise<Friend | null> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      type UserGetter = (userId: string) =>
        | {
            displayName?: string
            getAvatarUrl?: () => string
          }
        | undefined
      const getUserMethod = client.getUser as UserGetter | undefined
      const user = getUserMethod?.(userId)

      type RoomGetter = (roomId: string) => { name?: string } | undefined
      const getRoomMethod = client.getRoom as RoomGetter | undefined
      const room = getRoomMethod?.(roomId)

      return {
        userId,
        displayName: user?.displayName || userId,
        avatarUrl: user?.getAvatarUrl?.(),
        presence: 'offline',
        roomId,
        statusText: room?.name
      }
    } catch (error) {
      logger.error('[FriendManager] Failed to get friend info:', { userId, error })
      return null
    }
  }
}
