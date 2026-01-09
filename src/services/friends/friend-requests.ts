/**
 * Friend Request Management
 * Handles sending, accepting, and rejecting friend requests
 */

import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'

/**
 * Friend Requests Manager
 */
export class FriendRequestsManager {
  /**
   * 发送好友请求
   */
  async sendFriendRequest(targetUserId: string, message?: string): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    logger.info('[FriendRequests] Sending friend request', { targetUserId })

    try {
      // 优先使用 Synapse 扩展 API
      const synapseApi = await import('@/integrations/synapse/friends')
      type UserIdGetter = () => string
      const getUserIdMethod = client.getUserId as UserIdGetter | undefined
      const myUserId = getUserIdMethod?.() || ''

      const result = await synapseApi.sendRequest({
        requester_id: myUserId,
        target_id: targetUserId,
        message
      })
      const requestId = (result as { request_id?: string })?.request_id || ''
      logger.info('[FriendRequests] Friend request sent via Synapse API', { requestId, targetUserId })
      return requestId
    } catch (synapseError) {
      logger.warn('[FriendRequests] Synapse API failed, falling back to m.direct', synapseError)
      return this.sendFriendRequestViaMDirect(targetUserId)
    }
  }

  /**
   * 通过 m.direct 发送好友请求
   */
  private async sendFriendRequestViaMDirect(targetUserId: string): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      // 创建1:1房间
      type CreateRoomOpts = { is_direct?: boolean; invite?: string[]; preset?: 'private_chat' }
      type CreateRoomMethod = (opts: CreateRoomOpts) => Promise<{ room_id: string } | undefined>
      const createRoomMethod = client.createRoom as CreateRoomMethod | undefined
      const roomResult = await createRoomMethod?.({
        is_direct: true,
        invite: [targetUserId],
        preset: 'private_chat'
      })

      if (!roomResult?.room_id) {
        throw new Error('Failed to create room')
      }

      const roomId = roomResult.room_id

      // 更新 m.direct
      await this.updateMDirect(targetUserId, roomId)

      logger.info('[FriendRequests] Friend request sent via m.direct', { roomId, targetUserId })
      return roomId
    } catch (error) {
      logger.error('[FriendRequests] Failed to send friend request via m.direct:', error)
      throw error
    }
  }

  /**
   * 接受好友请求
   */
  async acceptFriendRequest(roomId: string, requestId?: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      // 优先使用 Synapse 扩展 API
      if (requestId) {
        const synapseApi = await import('@/integrations/synapse/friends')
        type UserIdGetter = () => string
        const getUserIdMethod = client.getUserId as UserIdGetter | undefined
        const myUserId = getUserIdMethod?.() || ''

        await synapseApi.acceptRequest({
          request_id: requestId,
          user_id: myUserId
        })
        logger.info('[FriendRequests] Friend request accepted via Synapse API', { requestId })
      }

      // 通过房间成员操作接受
      await this.acceptFriendRequestViaRoomMembership(roomId)
    } catch (synapseError) {
      logger.warn('[FriendRequests] Synapse API failed, using fallback', synapseError)
      await this.acceptFriendRequestViaRoomMembership(roomId)
    }
  }

  /**
   * 通过房间成员操作接受好友请求
   */
  private async acceptFriendRequestViaRoomMembership(roomId: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      type RoomWithMembers = {
        getJoinedMembers?: () => Array<{ userId: string }>
      }
      type GetRoomMethod = (roomId: string) => RoomWithMembers | undefined
      const getRoomMethod = client.getRoom as GetRoomMethod | undefined
      const room = getRoomMethod?.(roomId)

      if (!room) {
        throw new Error('Room not found')
      }

      const members = room.getJoinedMembers?.() || []
      if (members.length < 2) {
        throw new Error('Invalid room state')
      }

      type UserIdGetter = () => string
      const getUserIdMethod = client.getUserId as UserIdGetter | undefined
      const myUserId = getUserIdMethod?.() || ''
      const otherMember = members.find((m) => m.userId !== myUserId)
      if (!otherMember) {
        throw new Error('Other user not found in room')
      }

      // 更新双方的 m.direct
      await this.updateMDirect(otherMember.userId, roomId)
      await this.updateMDirect(myUserId, roomId)

      logger.info('[FriendRequests] Friend request accepted via room membership', { roomId })
    } catch (error) {
      logger.error('[FriendRequests] Failed to accept friend request via room membership:', error)
      throw error
    }
  }

  /**
   * 拒绝好友请求
   */
  async rejectFriendRequest(roomId: string, requestId?: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      // 优先使用 Synapse 扩展 API
      if (requestId) {
        const synapseApi = await import('@/integrations/synapse/friends')
        type UserIdGetter = () => string
        const getUserIdMethod = client.getUserId as UserIdGetter | undefined
        const myUserId = getUserIdMethod?.() || ''

        await synapseApi.rejectRequest({
          request_id: requestId,
          user_id: myUserId
        })
        logger.info('[FriendRequests] Friend request rejected via Synapse API', { requestId })
      }

      // 如果没有 requestId，离开房间并清理 m.direct
      await this.rejectFriendRequestViaLeavingRoom(roomId)
    } catch (synapseError) {
      logger.warn('[FriendRequests] Synapse API failed, using fallback', synapseError)
      await this.rejectFriendRequestViaLeavingRoom(roomId)
    }
  }

  /**
   * 通过离开房间拒绝好友请求
   */
  private async rejectFriendRequestViaLeavingRoom(roomId: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      type LeaveMethod = (roomId: string) => Promise<void>
      const leaveMethod = client.leave as LeaveMethod | undefined
      await leaveMethod?.(roomId)

      logger.info('[FriendRequests] Friend request rejected via leaving room', { roomId })
    } catch (error) {
      logger.error('[FriendRequests] Failed to reject friend request via leaving room:', error)
      throw error
    }
  }

  /**
   * 更新 m.direct 事件
   */
  async updateMDirect(userId: string, roomId: string): Promise<void> {
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
      const mDirectContent = { ...(getContentMethod?.() || {}) }

      // 更新目标用户的房间列表
      if (!mDirectContent[userId]) {
        mDirectContent[userId] = []
      }

      if (!mDirectContent[userId].includes(roomId)) {
        mDirectContent[userId].push(roomId)
      }

      // 设置更新后的 m.direct
      type AccountDataSetter = (type: string, content: Record<string, string[]>) => Promise<void>
      const setAccountDataMethod = client.setAccountData as AccountDataSetter | undefined
      await setAccountDataMethod?.('m.direct', mDirectContent)

      logger.debug('[FriendRequests] Updated m.direct', { userId, roomId })
    } catch (error) {
      logger.error('[FriendRequests] Failed to update m.direct:', error)
      throw error
    }
  }

  /**
   * 从 m.direct 移除用户
   */
  async removeMDirect(userId: string, roomId: string): Promise<void> {
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
      const mDirectContent = { ...(getContentMethod?.() || {}) }

      // 从目标用户的房间列表中移除
      if (mDirectContent[userId]) {
        mDirectContent[userId] = mDirectContent[userId].filter((id) => id !== roomId)

        // 如果列表为空，删除该条目
        if (mDirectContent[userId].length === 0) {
          delete mDirectContent[userId]
        }
      }

      // 设置更新后的 m.direct
      type AccountDataSetter = (type: string, content: Record<string, string[]>) => Promise<void>
      const setAccountDataMethod = client.setAccountData as AccountDataSetter | undefined
      await setAccountDataMethod?.('m.direct', mDirectContent)

      logger.debug('[FriendRequests] Removed from m.direct', { userId, roomId })
    } catch (error) {
      logger.error('[FriendRequests] Failed to remove from m.direct:', error)
      throw error
    }
  }
}
