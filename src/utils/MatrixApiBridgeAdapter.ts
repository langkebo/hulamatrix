/**
 * Matrix API Bridge Adapter
 *
 * 将旧的API调用桥接到新的 Matrix SDK 实现
 * 这个适配器主要用于向后兼容，逐步迁移后使用
 */

import { matrixSearchServiceCompat as matrixSearchService } from '@/integrations/matrix/search'
import { friendsServiceV2 } from '@/services/friendsServiceV2'
import { logger } from '@/utils/logger'
import { matrixClientService } from '@/integrations/matrix/client'

export async function requestWithFallback<T = unknown>(options: {
  url: string
  body?: unknown
  params?: Record<string, unknown>
}): Promise<T> {
  const { url, params } = options

  switch (url) {
    case 'search_group':
      // 使用 Matrix SDK 搜索群组
      try {
        const groups = await matrixSearchService.searchRooms(String(params?.account || ''), 20)
        return groups.map((group) => ({
          roomId: group.roomId,
          account: group.roomId,
          name: group.name,
          avatar: group.avatar || '',
          deleteStatus: 0,
          extJson: {} as Record<string, unknown>,
          memberNum: group.memberCount
        })) as T
      } catch (error) {
        logger.error('[MatrixApiBridgeAdapter] searchGroup failed:', error)
        return [] as T
      }

    case 'search_friend':
      // 使用 Matrix SDK v2 搜索用户
      try {
        const users = await friendsServiceV2.searchUsers(String(params?.key || ''), 20)
        return users.map((user) => ({
          uid: user.user_id,
          account: user.user_id,
          name: user.display_name || user.user_id.split(':')[0].substring(1),
          avatar: user.avatar_url || ''
        })) as T
      } catch (error) {
        logger.error('[MatrixApiBridgeAdapter] searchFriend failed:', error)
        return [] as T
      }

    case 'get_user_info':
      // 获取当前用户信息
      try {
        const client = matrixClientService.getClient()
        if (!client) {
          logger.warn('[MatrixApiBridgeAdapter] Client not initialized for get_user_info')
          return {} as T
        }
        const userId = client.getUserId()
        if (!userId) {
          logger.warn('[MatrixApiBridgeAdapter] No user ID found')
          return {} as T
        }
        const user = client.getUser(userId)
        return {
          uid: userId,
          account: userId,
          name: user?.displayName || userId.split(':')[0].substring(1),
          avatar: user?.avatarUrl || '',
          email: '' // Matrix SDK doesn't expose email
        } as T
      } catch (error) {
        logger.error('[MatrixApiBridgeAdapter] get_user_info failed:', error)
        return {} as T
      }

    case 'get_room_list':
      // 获取房间列表
      try {
        const client = matrixClientService.getClient()
        if (!client) {
          logger.warn('[MatrixApiBridgeAdapter] Client not initialized for get_room_list')
          return [] as T
        }
        const rooms = client.getRooms()
        return rooms.map((room) => ({
          roomId: room.roomId,
          name: room.name || room.roomId,
          avatar: room.getAvatarUrl('') || '',
          memberNum: room.getJoinedMemberCount(),
          topic: room.getTopic() || ''
        })) as T
      } catch (error) {
        logger.error('[MatrixApiBridgeAdapter] get_room_list failed:', error)
        return [] as T
      }

    default:
      // 对于不支持的 URL，记录并返回空值（保持向后兼容）
      logger.debug('[MatrixApiBridgeAdapter] Unsupported URL:', url)
      return undefined as T
  }
}
