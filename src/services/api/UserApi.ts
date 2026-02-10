/**
 * User API Service
 * Replaces deprecated ImRequestUtils user-related functions
 */

import MatrixUserService from '../matrix/MatrixUserService'
import MatrixClientService from '../matrix/MatrixClientService'
import type {
  ModifyUserInfoParams,
  SetUserBadgeParams,
  Badge,
  ChangeUserStateParams,
  GetUserByIdsParams,
  UserBasicInfo
} from './types'
import type { UserState } from '@/services/types'

class UserApiService {
  /**
   * Modify current user's profile
   */
  async ModifyUserInfo(params: ModifyUserInfoParams): Promise<{ success: boolean }> {
    console.log('[UserApiService] ModifyUserInfo called with:', params)
    const userService = MatrixUserService.getInstance()

    try {
      if (params.displayName !== undefined) {
        await userService.setDisplayName(params.displayName)
      }
      if (params.avatarUrl !== undefined) {
        await userService.setAvatarUrl(params.avatarUrl)
      }
      return { success: true }
    } catch (error) {
      console.error('[UserApiService] ModifyUserInfo failed:', error)
      return { success: false }
    }
  }

  /**
   * Set user badge
   * @deprecated Mock function - needs backend badge system implementation
   */
  async setUserBadge(params: SetUserBadgeParams): Promise<{ success: boolean }> {
    console.warn('[UserApiService] setUserBadge called with:', params)
    // TODO: Implement with backend badge system
    return { success: true }
  }

  /**
   * Get available badges
   * @deprecated Mock function - needs backend badge system implementation
   */
  async getBadgeList(): Promise<{ code: number; data?: { list: Badge[] } }> {
    console.warn('[UserApiService] getBadgeList called')
    // TODO: Implement with backend badge system
    return { code: 200, data: { list: [] } }
  }

  /**
   * Upload avatar
   * @deprecated Mock function - needs Matrix Content Repository API implementation
   */
  async uploadAvatar(_file: File): Promise<{ code: number; data?: { url: string } }> {
    console.warn('[UserApiService] uploadAvatar called')
    const _userService = MatrixUserService.getInstance()

    try {
      // TODO: Implement with Matrix Content Repository API
      // const url = await userService.uploadContent(file)
      return { code: 200, data: { url: 'https://example.com/avatar.png' } }
    } catch (error) {
      console.error('[UserApiService] uploadAvatar failed:', error)
      return { code: 500 }
    }
  }

  /**
   * Change user online status
   */
  async changeUserState(params: ChangeUserStateParams): Promise<{ success: boolean }> {
    console.log('[UserApiService] changeUserState called with:', params)
    const client = MatrixClientService.getInstance().getClient()

    if (!client) {
      return { success: false }
    }

    try {
      // Map state IDs to Matrix presence states
      // 1 = online, 2 = busy, 3 = offline
      const presenceMap: Record<number, string> = {
        1: 'online',
        2: 'unavailable',
        3: 'offline'
      }

      const presence = presenceMap[Number(params.id)] || 'online'

      await client.setPresence({
        presence: presence as any
      })

      return { success: true }
    } catch (error) {
      console.error('[UserApiService] changeUserState failed:', error)
      return { success: false }
    }
  }

  /**
   * Get multiple users by their IDs
   * @deprecated Mock function - needs Matrix User Profile API implementation
   */
  async getUserByIds(params: GetUserByIdsParams): Promise<UserBasicInfo[]> {
    console.log('[UserApiService] getUserByIds called with:', params)
    const client = MatrixClientService.getInstance().getClient()

    if (!client) {
      return []
    }

    try {
      // TODO: Implement with Matrix User Profile API
      // For each userId, get the user's profile from Matrix
      // const users = await Promise.all(
      //   params.userIds.map(async (userId) => {
      //     const profile = await client.getUserProfile(userId)
      //     return {
      //       userId,
      //       displayName: profile.displayname,
      //       avatarUrl: profile.avatar_url
      //     }
      //   })
      // )
      // return users

      return params.userIds.map((userId) => ({
        userId,
        displayName: undefined,
        avatarUrl: undefined
      }))
    } catch (error) {
      console.error('[UserApiService] getUserByIds failed:', error)
      return []
    }
  }

  /**
   * Get all user states (Online, Busy, Away, Invisible)
   * Returns the list of available user presence states
   */
  async getAllUserState(): Promise<UserState[]> {
    console.log('[UserApiService] getAllUserState called')

    // Return standard user presence states
    // These match the Matrix presence states: online, unavailable, offline
    return [
      {
        id: '1',
        title: 'Online',
        url: '',
        bgColor: '#52c41a' // Green for online
      },
      {
        id: '2',
        title: 'Busy',
        url: '',
        bgColor: '#ff4d4f' // Red for busy
      },
      {
        id: '3',
        title: 'Away',
        url: '',
        bgColor: '#faad14' // Orange for away
      },
      {
        id: '4',
        title: 'Invisible',
        url: '',
        bgColor: '#8c8c8c' // Gray for invisible
      }
    ]
  }
}

export default new UserApiService()
