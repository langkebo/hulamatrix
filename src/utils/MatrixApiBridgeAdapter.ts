/**
 * Matrix API Bridge Adapter
 *
 * @deprecated 此适配器已废弃，大部分功能已迁移到 Matrix SDK
 *
 * 将旧的 API 调用桥接到新的 Matrix SDK 实现
 * 此适配器主要用于向后兼容，逐步迁移后使用
 *
 * **已迁移的功能**（不再使用此适配器）:
 * - `search_group` → 使用 Matrix User Directory API
 * - `search_friend` → 使用 Matrix User Directory API
 * - `get_user_info` → 使用 `matrixClientService.getClient().getUser()`
 * - `get_room_list` → 使用 `client.getRooms()`
 *
 * **保留的功能**（需要独立服务）:
 * - `get_captcha`, `send_captcha` - 验证码服务
 * - `forget_password` - 密码重置服务
 * - `generate_qr_code`, `check_qr_status` - 二维码登录
 * - `send_add_friend_request` - 好友请求
 *
 * **迁移计划**:
 * 这些保留的功能应该迁移到独立的服务：
 * 1. 使用 Matrix Account Data 存储用户偏好
 * 2. 使用 Matrix Room Events 处理好友请求
 * 3. 使用第三方验证码服务（如 Google reCAPTCHA）
 * 4. 实现基于 Matrix 的二维码登录
 */

import { matrixSearchServiceCompat as matrixSearchService } from '@/integrations/matrix/search'
import { friendsServiceV2 } from '@/services/friendsServiceV2'
import { logger } from '@/utils/logger'
import { matrixClientService } from '@/integrations/matrix/client'

// Type definitions for Matrix SDK objects
interface MatrixUser {
  displayName?: string
  avatarUrl?: string
}

interface MatrixRoom {
  roomId: string
  name?: string
  getAvatarUrl?(baseUrl?: string): string
  getJoinedMemberCount?(): number
  getTopic?(): string
}

/**
 * 请求并回退到 Matrix SDK 实现
 *
 * @deprecated 此函数已废弃，请直接使用 Matrix SDK
 *
 * @param options - 请求选项
 * @param options.url - API 端点
 * @param options.body - 请求体
 * @param options.params - 查询参数
 * @returns Promise<T> - API 响应
 *
 * @example
 * // 旧用法（已废弃）
 * await requestWithFallback({ url: 'search_group', params: { account: 'keyword' } })
 *
 * // 新用法 - 直接使用 Matrix SDK
 * import { matrixSearchService } from '@/integrations/matrix/search'
 * await matrixSearchService.searchRooms('keyword', 20)
 */
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
        const userId = typeof client.getUserId === 'function' ? client.getUserId() : null
        if (!userId) {
          logger.warn('[MatrixApiBridgeAdapter] No user ID found')
          return {} as T
        }
        const user = typeof client.getUser === 'function' ? client.getUser(userId) : undefined
        const typedUser = user as MatrixUser | undefined
        return {
          uid: userId,
          account: userId,
          name: typedUser?.displayName || userId.split(':')[0].substring(1),
          avatar: typedUser?.avatarUrl || '',
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
        const rooms = typeof client.getRooms === 'function' ? client.getRooms() : []
        return rooms.map((room: MatrixRoom) => ({
          roomId: room.roomId,
          name: room.name || room.roomId,
          avatar: typeof room.getAvatarUrl === 'function' ? room.getAvatarUrl('') || '' : '',
          memberNum: typeof room.getJoinedMemberCount === 'function' ? room.getJoinedMemberCount() : 0,
          topic: typeof room.getTopic === 'function' ? room.getTopic() || '' : ''
        })) as T
      } catch (error) {
        logger.error('[MatrixApiBridgeAdapter] get_room_list failed:', error)
        return [] as T
      }

    case 'get_captcha':
    case 'send_captcha':
    case 'forget_password':
    case 'generate_qr_code':
    case 'check_qr_status':
    case 'send_add_friend_request':
      // 这些功能需要迁移到独立服务
      logger.warn(
        `[MatrixApiBridgeAdapter] Legacy API '${url}' called. This feature needs to be reimplemented using Matrix or independent services.`
      )
      throw new Error(
        `Legacy API '${url}' is deprecated and needs to be reimplemented. See docs/LEGACY_API_MIGRATION.md for guidance.`
      )

    default:
      // 对于不支持的 URL，记录并返回空值（保持向后兼容）
      logger.warn('[MatrixApiBridgeAdapter] Unsupported URL:', url)
      return undefined as T
  }
}
