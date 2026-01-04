/**
 * Matrix API Bridge Adapter
 *
 * 将旧的API调用桥接到新的 Matrix SDK 实现
 * 这个适配器主要用于向后兼容，逐步迁移后使用
 */

import { matrixSearchServiceCompat as matrixSearchService } from '@/integrations/matrix/search'
import { friendsServiceV2 } from '@/services/friendsServiceV2'
import { logger } from '@/utils/logger'

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

    default:
      // 对于不支持的 URL，返回空数组（保持向后兼容）
      logger.warn('[MatrixApiBridgeAdapter] Unsupported URL:', url)
      return [] as T
  }
}
