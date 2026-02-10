/**
 * System Configuration API Service
 * Replaces deprecated ImRequestUtils system-related functions
 */

import MatrixClientService from '../matrix/MatrixClientService'
import type {
  SetSessionTopParams,
  ShieldParams,
  NotificationParams,
  UpdateRoomInfoParams,
  InitConfigResponse,
  GroupInfoResponse,
  EmojiResponse,
  GroupListParams,
  GroupListResponse,
  GroupListMemberParams,
  GroupListMemberResponse,
  AdminParams,
  AddEmojiParams,
  DeleteEmojiParams,
  GetAnnouncementDetailParams,
  GetAnnouncementDetailResponse,
  EditAnnouncementParams,
  PushAnnouncementParams,
  DeleteAnnouncementParams
} from './types'

class SystemConfigApiService {
  /**
   * Initialize system configuration
   * @deprecated Mock function - needs backend implementation
   */
  async initConfig(): Promise<InitConfigResponse> {
    console.log('[SystemConfigApiService] initConfig called')
    // TODO: Implement with backend API
    // For now, return default configuration
    return {
      code: 200,
      data: {
        logo: '/hula.png',
        name: 'HuLa',
        qiNiu: {
          ossDomain: '',
          fragmentSize: '1048576', // 1MB
          turnSharSize: '10485760' // 10MB
        },
        roomGroupId: ''
      }
    }
  }

  /**
   * Set session top/pin status
   * Uses Matrix Account Data to store pinned sessions
   */
  async setSessionTop(params: SetSessionTopParams): Promise<{ success: boolean }> {
    console.log('[SystemConfigApiService] setSessionTop called with:', params)
    const client = MatrixClientService.getInstance().getClient()

    if (!client) {
      return { success: false }
    }

    try {
      // Get current pinned rooms from account data
      const accountData = await client.getAccountData('com.hula.pinned_rooms')

      // Parse existing pinned rooms or initialize empty array
      const content = accountData?.getContent() as { pinnedRooms?: string[] } | undefined
      const pinnedRooms = content?.pinnedRooms || []

      if (params.top) {
        // Add room to pinned list if not already there
        if (!pinnedRooms.includes(params.roomId)) {
          pinnedRooms.push(params.roomId)
        }
      } else {
        // Remove room from pinned list
        const index = pinnedRooms.indexOf(params.roomId)
        if (index > -1) {
          pinnedRooms.splice(index, 1)
        }
      }

      // Save updated pinned rooms to account data
      await client.setAccountData('com.hula.pinned_rooms', {
        pinnedRooms,
        updatedAt: Date.now()
      })

      return { success: true }
    } catch (error) {
      console.error('[SystemConfigApiService] setSessionTop failed:', error)
      return { success: false }
    }
  }

  /**
   * Block/unblock user messages
   * Uses Matrix Push Rules API to mute notifications from a room
   */
  async shield(params: ShieldParams): Promise<{ success: boolean }> {
    console.log('[SystemConfigApiService] shield called with:', params)
    const client = MatrixClientService.getInstance().getClient()

    if (!client) {
      return { success: false }
    }

    try {
      const ruleId = `room_${params.roomId}`

      if (params.state) {
        // Block: Add a push rule to mute notifications from this room
        // Use 'override' kind with empty actions to suppress notifications
        try {
          await (client as any).setPushRule('global', 'override', ruleId, {
            actions: [],
            conditions: [
              {
                kind: 'event_match',
                key: 'room_id',
                pattern: params.roomId
              }
            ]
          })
        } catch (e) {
          // Rule might already exist, try to update it
          console.warn('[SystemConfigApiService] Failed to add push rule, might already exist:', e)
        }
      } else {
        // Unblock: Remove the push rule
        try {
          await (client as any).deletePushRule('global', 'override', ruleId)
        } catch (e) {
          // Rule might not exist, that's okay
          console.warn('[SystemConfigApiService] Failed to delete push rule, might not exist:', e)
        }
      }

      return { success: true }
    } catch (error) {
      console.error('[SystemConfigApiService] shield failed:', error)
      return { success: false }
    }
  }

  /**
   * Set notification type for a room
   * Uses Matrix Push Rules API to configure notification settings
   * @param params.type Notification type: 1 = RECEPTION (all), 2 = NOT_DISTURB (muted)
   */
  async notification(params: NotificationParams): Promise<{ success: boolean }> {
    console.log('[SystemConfigApiService] notification called with:', params)
    const client = MatrixClientService.getInstance().getClient()

    if (!client) {
      return { success: false }
    }

    try {
      const ruleId = `room_mute_${params.roomId}`

      if (params.type === 2) {
        // NOT_DISTURB: Add push rule to mute notifications
        try {
          await (client as any).setPushRule('global', 'override', ruleId, {
            actions: [],
            conditions: [
              {
                kind: 'event_match',
                key: 'room_id',
                pattern: params.roomId
              }
            ]
          })
        } catch (e) {
          console.warn('[SystemConfigApiService] Failed to add mute rule, might already exist:', e)
        }
      } else {
        // RECEPTION: Remove mute rule to enable notifications
        try {
          await (client as any).deletePushRule('global', 'override', ruleId)
        } catch (e) {
          console.warn('[SystemConfigApiService] Failed to delete mute rule, might not exist:', e)
        }
      }

      return { success: true }
    } catch (error) {
      console.error('[SystemConfigApiService] notification failed:', error)
      return { success: false }
    }
  }

  /**
   * Update room information
   * @deprecated Partially implemented - needs Matrix Room State API implementation
   */
  async updateRoomInfo(params: UpdateRoomInfoParams): Promise<{ success: boolean }> {
    console.log('[SystemConfigApiService] updateRoomInfo called with:', params)
    const client = MatrixClientService.getInstance().getClient()

    if (!client) {
      return { success: false }
    }

    try {
      const room = client.getRoom(params.id)
      if (!room) {
        console.warn('[SystemConfigApiService] Room not found:', params.id)
        return { success: false }
      }

      // Update room name if provided
      if (params.name) {
        await (client.setRoomName as any)(params.id, params.name)
      }

      // Update room avatar if provided
      if (params.avatar) {
        await (client.sendStateEvent as any)(params.id, 'm.room.avatar', {
          url: params.avatar
        })
      }

      // For allowScanEnter, store in account data
      if (params.allowScanEnter !== undefined) {
        await client.setAccountData('com.hula.room.config', {
          [params.id]: {
            allowScanEnter: params.allowScanEnter
          }
        })
      }

      return { success: true }
    } catch (error) {
      console.error('[SystemConfigApiService] updateRoomInfo failed:', error)
      return { success: false }
    }
  }

  /**
   * Get group/room information
   * @deprecated Mock function - needs Matrix Room State API implementation
   */
  async getGroupInfo(roomId: string): Promise<GroupInfoResponse> {
    console.log('[SystemConfigApiService] getGroupInfo called for:', roomId)
    const client = MatrixClientService.getInstance().getClient()

    if (!client) {
      return { code: 500 }
    }

    try {
      const room = client.getRoom(roomId)
      if (!room) {
        return { code: 404, data: undefined }
      }

      // TODO: Implement with Matrix Room State API
      // Get room name, avatar, member count, etc. from room state
      return {
        code: 200,
        data: {
          roomId: room.roomId,
          name: room.name,
          avatar: (room.getAvatarUrl as any)(undefined) || undefined,
          memberCount: room.getJoinedMemberCount()
        }
      }
    } catch (error) {
      console.error('[SystemConfigApiService] getGroupInfo failed:', error)
      return { code: 500, data: undefined }
    }
  }

  /**
   * Get group detail information (alias for getGroupInfo for consistency)
   */
  async getGroupDetail(roomId: string): Promise<GroupInfoResponse> {
    return this.getGroupInfo(roomId)
  }

  /**
   * Get emoji list
   * @deprecated Mock function - needs backend emoji system implementation
   */
  async getEmoji(): Promise<EmojiResponse> {
    console.log('[SystemConfigApiService] getEmoji called')
    // TODO: Implement with backend emoji system
    return {
      code: 200,
      data: {
        list: []
      }
    }
  }

  /**
   * Get group list
   * @deprecated Mock function - needs Matrix Room API implementation
   */
  async groupList(params: GroupListParams): Promise<GroupListResponse> {
    console.log('[SystemConfigApiService] groupList called with:', params)
    const client = MatrixClientService.getInstance().getClient()

    if (!client) {
      return { code: 500 }
    }

    try {
      // Get all rooms the user is a member of
      const rooms = client.getRooms()

      // Filter for group rooms (not direct messages)
      const groups = rooms
        .filter((room) => {
          const isDirect = room.getAccountData('m.direct')?.getContent()
          return !isDirect
        })
        .map((room) => ({
          roomId: room.roomId,
          name: room.name || room.roomId,
          avatar: (room.getAvatarUrl as any)(undefined) || undefined,
          memberCount: room.getJoinedMemberCount()
        }))

      return {
        code: 200,
        data: {
          list: groups,
          total: groups.length
        }
      }
    } catch (error) {
      console.error('[SystemConfigApiService] groupList failed:', error)
      return { code: 500, data: { list: [], total: 0 } }
    }
  }

  /**
   * Get group member list
   * @deprecated Mock function - needs Matrix Member API implementation
   */
  async groupListMember(params: GroupListMemberParams): Promise<GroupListMemberResponse> {
    console.log('[SystemConfigApiService] groupListMember called with:', params)
    const client = MatrixClientService.getInstance().getClient()

    if (!client) {
      return { code: 500 }
    }

    try {
      const room = client.getRoom(params.roomId)
      if (!room) {
        return { code: 404, data: { list: [], total: 0 } }
      }

      // Get room members
      const members = room.getJoinedMembers()

      const memberList = members.map((member) => {
        const powerLevel = member.powerLevel || 0
        return {
          userId: member.userId,
          displayName: member.name || member.userId,
          avatarUrl: (member.getAvatarUrl as any)(undefined) || undefined,
          powerLevel,
          isAdmin: powerLevel >= 50 // Common default for admin in Matrix
        }
      })

      return {
        code: 200,
        data: {
          list: memberList,
          total: memberList.length
        }
      }
    } catch (error) {
      console.error('[SystemConfigApiService] groupListMember failed:', error)
      return { code: 500, data: { list: [], total: 0 } }
    }
  }

  /**
   * Add admin to group
   * @deprecated Mock function - needs Matrix Power Levels API implementation
   */
  async addAdmin(params: AdminParams): Promise<{ success: boolean }> {
    console.log('[SystemConfigApiService] addAdmin called with:', params)
    const client = MatrixClientService.getInstance().getClient()

    if (!client) {
      return { success: false }
    }

    try {
      // TODO: Implement with Matrix Power Levels API
      // Need to get current power levels, update them, and send back to room state
      // const powerLevels = await client.getStateEvent(params.roomId, 'm.room.power_levels')
      // powerLevels.users[userId] = adminLevel
      // await client.sendStateEvent(params.roomId, 'm.room.power_levels', powerLevels)
      return { success: true }
    } catch (error) {
      console.error('[SystemConfigApiService] addAdmin failed:', error)
      return { success: false }
    }
  }

  /**
   * Revoke admin from group
   * @deprecated Mock function - needs Matrix Power Levels API implementation
   */
  async revokeAdmin(params: AdminParams): Promise<{ success: boolean }> {
    console.log('[SystemConfigApiService] revokeAdmin called with:', params)
    const client = MatrixClientService.getInstance().getClient()

    if (!client) {
      return { success: false }
    }

    try {
      // TODO: Implement with Matrix Power Levels API
      // Need to get current power levels, update them, and send back to room state
      // const powerLevels = await client.getStateEvent(params.roomId, 'm.room.power_levels')
      // powerLevels.users[userId] = userLevel
      // await client.sendStateEvent(params.roomId, 'm.room.power_levels', powerLevels)
      return { success: true }
    } catch (error) {
      console.error('[SystemConfigApiService] revokeAdmin failed:', error)
      return { success: false }
    }
  }

  /**
   * Add emoji
   * @deprecated Mock function - needs backend emoji system implementation
   */
  async addEmoji(params: AddEmojiParams): Promise<{ code: number; data?: Record<string, unknown> }> {
    console.log('[SystemConfigApiService] addEmoji called with:', params)
    // TODO: Implement with backend emoji system
    return { code: 200, data: {} }
  }

  /**
   * Delete emoji
   * @deprecated Mock function - needs backend emoji system implementation
   */
  async deleteEmoji(params: DeleteEmojiParams): Promise<{ code: number; success: boolean }> {
    console.log('[SystemConfigApiService] deleteEmoji called with:', params)
    // TODO: Implement with backend emoji system
    return { code: 200, success: true }
  }

  /**
   * Get announcement detail
   * @deprecated Mock function - needs backend announcement system implementation
   */
  async getAnnouncementDetail(params: GetAnnouncementDetailParams): Promise<GetAnnouncementDetailResponse> {
    console.log('[SystemConfigApiService] getAnnouncementDetail called with:', params)
    // TODO: Implement with backend announcement system
    return { code: 200, data: undefined }
  }

  /**
   * Edit announcement
   * @deprecated Mock function - needs backend announcement system implementation
   */
  async editAnnouncement(params: EditAnnouncementParams): Promise<{ code: number; success: boolean }> {
    console.log('[SystemConfigApiService] editAnnouncement called with:', params)
    // TODO: Implement with backend announcement system
    return { code: 200, success: true }
  }

  /**
   * Push/Send announcement
   * @deprecated Mock function - needs backend announcement system implementation
   */
  async pushAnnouncement(params: PushAnnouncementParams): Promise<{ code: number; data?: any }> {
    console.log('[SystemConfigApiService] pushAnnouncement called with:', params)
    // TODO: Implement with backend announcement system
    return { code: 200, data: {} }
  }

  /**
   * Delete announcement
   * @deprecated Mock function - needs backend announcement system implementation
   */
  async deleteAnnouncement(params: DeleteAnnouncementParams): Promise<{ code: number; success: boolean }> {
    console.log('[SystemConfigApiService] deleteAnnouncement called with:', params)
    // TODO: Implement with backend announcement system
    return { code: 200, success: true }
  }
}

export default new SystemConfigApiService()
