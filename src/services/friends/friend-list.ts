/**
 * Friend List Management
 * Handles listing friends from various sources
 */

import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'
import type { Friend } from './types'

/**
 * Friend List Manager
 */
export class FriendListManager {
  /**
   * 列出所有好友
   */
  async listFriends(): Promise<Friend[]> {
    try {
      // 优先使用 Synapse 扩展 API
      const synapseApi = await import('@/integrations/synapse/friends')
      const result = await synapseApi.listFriends()
      const friends = result?.friends || []
      logger.info('[FriendList] Listed friends via Synapse API', { count: friends.length })
      return this.mapSynapseFriends(friends)
    } catch (synapseError) {
      logger.warn('[FriendList] Synapse API failed, falling back to m.direct', synapseError)
      return this.listFriendsFromMDirect()
    }
  }

  /**
   * 映射Synapse好友数据到Friend接口
   */
  private mapSynapseFriends(synapseFriends: Record<string, unknown>[]): Friend[] {
    return synapseFriends.map((f) => {
      const friend: Friend = {
        userId: (f.user_id || f.userId) as string,
        presence: this.normalizePresence(f.presence as string | undefined)
      }

      if (f.display_name || f.displayName) {
        friend.displayName = (f.display_name || f.displayName) as string
      }

      if (f.avatar_url || f.avatarUrl) {
        friend.avatarUrl = (f.avatar_url || f.avatarUrl) as string
      }

      if (f.category_id || f.categoryId) {
        friend.categoryId = (f.category_id || f.categoryId) as string
      }

      if (f.room_id || f.roomId) {
        friend.roomId = (f.room_id || f.roomId) as string
      }

      if (f.status_text || f.statusText) {
        friend.statusText = (f.status_text || f.statusText) as string
      }

      if (f.last_active_ago || f.lastActiveAgo) {
        friend.lastActiveAgo = (f.last_active_ago || f.lastActiveAgo) as number
      }

      return friend
    })
  }

  /**
   * 标准化presence状态值
   */
  private normalizePresence(presence?: string): 'online' | 'offline' | 'unavailable' | 'away' {
    switch (presence) {
      case 'online':
        return 'online'
      case 'unavailable':
        return 'unavailable'
      case 'away':
        return 'away'
      default:
        return 'offline'
    }
  }

  /**
   * 从 m.direct 事件获取好友列表
   */
  async listFriendsFromMDirect(): Promise<Friend[]> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      type AccountDataGetter = (type: string) => { getContent?: () => Record<string, string[]> } | undefined
      const getAccountDataMethod = client.getAccountData as AccountDataGetter | undefined
      const mDirectEvent = getAccountDataMethod?.('m.direct')
      type ContentGetter = () => Record<string, string[]>
      const getContentMethod = mDirectEvent?.getContent as ContentGetter | undefined
      const mDirectContent = getContentMethod?.() || {}

      const friends: Friend[] = []
      const processedUserIds = new Set<string>()

      for (const [userId, roomIds] of Object.entries(mDirectContent)) {
        if (!Array.isArray(roomIds) || roomIds.length === 0) {
          continue
        }

        // 避免重复处理
        if (processedUserIds.has(userId)) {
          continue
        }
        processedUserIds.add(userId)

        // 获取用户信息
        type UserGetter = (userId: string) => { displayName?: string; getAvatarUrl?: () => string } | undefined
        const getUserMethod = client.getUser as UserGetter | undefined
        const user = getUserMethod?.(userId)

        // 获取房间信息
        const roomId = roomIds[0]
        type RoomGetter = (roomId: string) => { name?: string } | undefined
        const getRoomMethod = client.getRoom as RoomGetter | undefined
        const room = getRoomMethod?.(roomId)

        friends.push({
          userId,
          displayName: user?.displayName || userId,
          avatarUrl: user?.getAvatarUrl?.(),
          presence: 'offline',
          roomId,
          statusText: room?.name
        })
      }

      logger.info('[FriendList] Listed friends via m.direct', { count: friends.length })
      return friends
    } catch (error) {
      logger.error('[FriendList] Failed to list friends from m.direct:', error)
      return []
    }
  }

  /**
   * 获取带有Presence信息的好友列表
   */
  async listFriendsWithPresence(enrichFriendsFunc: (friends: Friend[]) => Promise<void>): Promise<Friend[]> {
    const friends = await this.listFriends()
    await enrichFriendsFunc(friends)
    return friends
  }
}
