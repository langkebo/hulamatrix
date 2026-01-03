/**
 * User Query Service
 *
 * 使用 Matrix SDK 查询用户信息
 */

import { matrixClientService } from '@/integrations/matrix/client'
import { getProfileInfo } from '@/utils/matrixClientUtils'
import { logger } from '@/utils/logger'

/**
 * 用户查询服务
 */
export const userQueryService = {
  /**
   * 批量获取用户信息
   * @param userIds 用户ID列表
   * @returns 用户信息数组
   */
  async getUsersByIds(userIds: string[]): Promise<
    Array<{
      uid: string
      name?: string
      avatar?: string
    }>
  > {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        logger.warn('[UserQuery] No Matrix client available')
        return []
      }

      const results = await Promise.allSettled(
        userIds.map(async (userId) => {
          try {
            const profile = await getProfileInfo(client, userId)
            return {
              uid: userId,
              name: profile?.displayname,
              avatar: profile?.avatar_url
            }
          } catch (error) {
            logger.error('[UserQuery] Failed to get user profile:', { userId, error })
            // 返回基本信息
            return {
              uid: userId,
              name: userId // 使用 userId 作为后备显示名称
            }
          }
        })
      )

      // 过滤出成功的结果
      return results
        .filter((result) => result.status === 'fulfilled')
        .map((result) => (result as PromiseFulfilledResult<{ uid: string; name?: string; avatar?: string }>).value)
    } catch (error) {
      logger.error('[UserQuery] Failed to get users by IDs:', { error, userIds })
      throw error
    }
  },

  /**
   * 获取单个用户信息
   * @param userId 用户ID
   * @returns 用户信息
   */
  async getUserById(userId: string): Promise<{
    uid: string
    name?: string
    avatar?: string
  } | null> {
    try {
      const results = await this.getUsersByIds([userId])
      return results[0] || null
    } catch (error) {
      logger.error('[UserQuery] Failed to get user by ID:', { error, userId })
      return null
    }
  },

  /**
   * 从房间成员中获取用户信息
   * @param roomId 房间ID
   * @param userIds 用户ID列表
   * @returns 用户信息数组
   */
  async getUsersFromRoom(
    roomId: string,
    userIds: string[]
  ): Promise<
    Array<{
      uid: string
      name?: string
      avatar?: string
    }>
  > {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        logger.warn('[UserQuery] No Matrix client available')
        return []
      }

      const getRoom = client.getRoom as ((roomId: string) => Record<string, unknown> | null) | undefined
      const room = getRoom?.call(client, roomId)
      if (!room) {
        logger.warn('[UserQuery] Room not found:', { roomId })
        return await this.getUsersByIds(userIds)
      }

      // 获取房间成员
      const getMembers = room.getMembers as (() => Array<Record<string, unknown>>) | undefined
      const members = getMembers?.call(room) || []

      // 构建用户ID到成员的映射
      const memberMap = new Map<string, Record<string, unknown>>()
      for (const member of members) {
        const userId = (member as Record<string, unknown>).userId as string
        if (userIds.includes(userId)) {
          memberMap.set(userId, member)
        }
      }

      // 构建结果
      const results: Array<{ uid: string; name?: string; avatar?: string }> = []
      for (const userId of userIds) {
        const member = memberMap.get(userId)
        if (member) {
          const name = (member as Record<string, unknown>).name as string | undefined
          const avatarUrl = (member as Record<string, unknown>).avatarUrl as string | undefined
          results.push({
            uid: userId,
            name,
            avatar: avatarUrl
          })
        } else {
          // 如果不是房间成员，使用 profile API
          const profile = await getProfileInfo(client, userId)
          results.push({
            uid: userId,
            name: profile?.displayname,
            avatar: profile?.avatar_url
          })
        }
      }

      return results
    } catch (error) {
      logger.error('[UserQuery] Failed to get users from room:', { error, roomId, userIds })
      // 降级到使用 profile API
      return this.getUsersByIds(userIds)
    }
  }
}
