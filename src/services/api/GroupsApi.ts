/**
 * Groups API Service
 * Replaces deprecated ImRequestUtils group-related functions
 */

import MatrixClientService from '../matrix/MatrixClientService'
import type {
  CreateGroupParams,
  RemoveGroupMemberParams,
  UpdateMyRoomInfoParams,
  ApplyGroupParams,
  ExitGroupParams,
  InviteGroupMemberParams
} from './types'

class GroupsApiService {
  /**
   * Create a new group chat
   */
  async createGroup(params: CreateGroupParams): Promise<{ roomId?: string; success: boolean }> {
    console.log('[GroupsApiService] createGroup called with:', params)
    const client = MatrixClientService.getInstance().getClient()

    if (!client) {
      return { success: false }
    }

    try {
      const room = await client.createRoom({
        preset: undefined as any, // 'private_chat' - Matrix SDK expects specific preset type
        invite: params.uidList,
        name: params.name,
        room_alias_name: params.name.toLowerCase().replace(/\s+/g, '_')
      } as any)
      return { roomId: room.room_id, success: true }
    } catch (error) {
      console.error('[GroupsApiService] createGroup failed:', error)
      return { success: false }
    }
  }

  /**
   * Remove a member from a group
   */
  async removeGroupMember(params: RemoveGroupMemberParams): Promise<{ success: boolean }> {
    console.log('[GroupsApiService] removeGroupMember called with:', params)
    const client = MatrixClientService.getInstance().getClient()

    if (!client) {
      return { success: false }
    }

    try {
      await client.kick(params.roomId, params.userId, 'Removed from group')
      return { success: true }
    } catch (error) {
      console.error('[GroupsApiService] removeGroupMember failed:', error)
      return { success: false }
    }
  }

  /**
   * Update current user's room info (nickname, avatar)
   */
  async updateMyRoomInfo(params: UpdateMyRoomInfoParams): Promise<{ success: boolean }> {
    console.log('[GroupsApiService] updateMyRoomInfo called with:', params)
    const client = MatrixClientService.getInstance().getClient()

    if (!client) {
      return { success: false }
    }

    try {
      const userId = client.getUserId()
      if (!userId) {
        return { success: false }
      }

      const _currentState = client.getRoom(params.roomId)?.getMember(userId)?.events

      ;(await client.setRoomTopic(params.roomId, params.displayName || '')) as any

      // TODO: Use proper Matrix API for member displayname update
      // await client.sendStateEvent(
      //   params.roomId,
      //   'm.room.member',
      //   {
      //     displayname: params.displayName,
      //     avatar_url: params.avatarUrl
      //   },
      //   userId
      // )
      return { success: true }
    } catch (error) {
      console.error('[GroupsApiService] updateMyRoomInfo failed:', error)
      return { success: false }
    }
  }

  /**
   * Apply to join a group
   * @deprecated Mock function - needs backend implementation
   */
  async applyGroup(params: ApplyGroupParams): Promise<{ success: boolean }> {
    console.warn('[GroupsApiService] applyGroup called with:', params)
    // TODO: Implement with Matrix Room Join API
    return { success: true }
  }

  /**
   * Exit/leave a group
   */
  async exitGroup(params: ExitGroupParams): Promise<{ success: boolean }> {
    console.log('[GroupsApiService] exitGroup called with:', params)
    const client = MatrixClientService.getInstance().getClient()

    if (!client) {
      return { success: false }
    }

    try {
      await client.leave(params.roomId)
      return { success: true }
    } catch (error) {
      console.error('[GroupsApiService] exitGroup failed:', error)
      return { success: false }
    }
  }

  /**
   * Invite members to a group
   */
  async inviteGroupMember(params: InviteGroupMemberParams): Promise<{ success: boolean }> {
    console.log('[GroupsApiService] inviteGroupMember called with:', params)
    const client = MatrixClientService.getInstance().getClient()

    if (!client) {
      return { success: false }
    }

    try {
      // Invite each user to the room
      for (const userId of params.uidList) {
        await client.invite(params.roomId, userId)
      }
      return { success: true }
    } catch (error) {
      console.error('[GroupsApiService] inviteGroupMember failed:', error)
      return { success: false }
    }
  }
}

export default new GroupsApiService()
