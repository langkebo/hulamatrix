import { type Room } from '@/lib/matrix-sdk'
import { Preset, Visibility, EventType, NotificationCountType } from '@/lib/matrix-sdk'
import MatrixClientService from './MatrixClientService'
import type { MatrixRoom, MatrixUser } from '@/types/matrix'

class MatrixRoomService {
  private static instance: MatrixRoomService

  private constructor() {}

  static getInstance(): MatrixRoomService {
    if (!MatrixRoomService.instance) {
      MatrixRoomService.instance = new MatrixRoomService()
    }
    return MatrixRoomService.instance
  }

  async createRoom(options: {
    name?: string
    topic?: string
    isDirect?: boolean
    invite?: string[]
    preset?: 'private_chat' | 'public_chat' | 'trusted_private_chat'
    visibility?: 'private' | 'public'
  }): Promise<string> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      const response = await client.createRoom({
        name: options.name,
        topic: options.topic,
        is_direct: options.isDirect,
        invite: options.invite,
        preset: (options.preset as Preset) || Preset.PrivateChat,
        visibility: (options.visibility as Visibility) || Visibility.Private
      })

      return response.room_id
    } catch (error) {
      console.error('Failed to create room:', error)
      throw error
    }
  }

  async joinRoom(roomIdOrAlias: string, viaServers?: string[]): Promise<string> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      const response = await client.joinRoom(roomIdOrAlias, {
        viaServers
      })
      return response.roomId
    } catch (error) {
      console.error('Failed to join room:', error)
      throw error
    }
  }

  async leaveRoom(roomId: string): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      await client.leave(roomId)
    } catch (error) {
      console.error('Failed to leave room:', error)
      throw error
    }
  }

  async inviteUser(roomId: string, userId: string): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      await client.invite(roomId, userId)
    } catch (error) {
      console.error('Failed to invite user:', error)
      throw error
    }
  }

  async kickUser(roomId: string, userId: string, reason?: string): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      await client.kick(roomId, userId, reason)
    } catch (error) {
      console.error('Failed to kick user:', error)
      throw error
    }
  }

  async banUser(roomId: string, userId: string, reason?: string): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      await client.ban(roomId, userId, reason)
    } catch (error) {
      console.error('Failed to ban user:', error)
      throw error
    }
  }

  async unbanUser(roomId: string, userId: string): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      await client.unban(roomId, userId)
    } catch (error) {
      console.error('Failed to unban user:', error)
      throw error
    }
  }

  async setRoomName(roomId: string, name: string): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      await client.setRoomName(roomId, name)
    } catch (error) {
      console.error('Failed to set room name:', error)
      throw error
    }
  }

  async setRoomTopic(roomId: string, topic: string): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      await client.setRoomTopic(roomId, topic)
    } catch (error) {
      console.error('Failed to set room topic:', error)
      throw error
    }
  }

  async setRoomAvatar(roomId: string, avatarUrl: string): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      await client.sendStateEvent(roomId, EventType.RoomAvatar, {
        url: avatarUrl
      })
    } catch (error) {
      console.error('Failed to set room avatar:', error)
      throw error
    }
  }

  async uploadRoomAvatar(roomId: string, file: File): Promise<string> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      const response = await client.uploadContent(file, {
        type: file.type,
        name: file.name
      })

      await this.setRoomAvatar(roomId, response.content_uri)
      return response.content_uri
    } catch (error) {
      console.error('Failed to upload room avatar:', error)
      throw error
    }
  }

  getRoom(roomId: string): Room | null {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      return null
    }

    return client.getRoom(roomId) || null
  }

  getAllRooms(): Room[] {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      return []
    }

    return client.getRooms() || []
  }

  getRoomMembers(roomId: string): MatrixUser[] {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      return []
    }

    const room = client.getRoom(roomId)
    if (!room) {
      return []
    }

    const members = room.getJoinedMembers()
    return members.map((member) => ({
      userId: member.userId,
      displayName: member.name,
      avatarUrl: member.user?.avatarUrl || null,
      presence: (member.user?.presence as 'online' | 'offline' | 'unavailable') || 'offline',
      lastActiveAgo: member.user?.lastActiveAgo || 0
    }))
  }

  getRoomMember(roomId: string, userId: string): MatrixUser | null {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      return null
    }

    const room = client.getRoom(roomId)
    if (!room) {
      return null
    }

    const member = room.getMember(userId)
    if (!member) {
      return null
    }

    return {
      userId: member.userId,
      displayName: member.name,
      avatarUrl: member.user?.avatarUrl || null,
      presence: (member.user?.presence as 'online' | 'offline' | 'unavailable') || 'offline',
      lastActiveAgo: member.user?.lastActiveAgo || 0
    }
  }

  getRoomInfo(roomId: string): MatrixRoom | null {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      return null
    }

    const room = client.getRoom(roomId)
    if (!room) {
      return null
    }

    const currentState = room.currentState
    const name =
      (room.name as string) || (currentState.getStateEvents('m.room.name')[0]?.getContent().name as string) || roomId
    const avatarEvent = currentState.getStateEvents('m.room.avatar')[0]
    const avatarUrl = avatarEvent?.getContent().url as string | undefined
    const topicEvent = currentState.getStateEvents('m.room.topic')[0]
    const topic = topicEvent?.getContent().topic as string | undefined

    const tags = room.tags
    const isDirect = tags['m.direct'] !== undefined

    const members = room.getJoinedMembers()
    const unreadNotifications = room.getUnreadNotificationCount(NotificationCountType.Total)

    return {
      roomId: room.roomId,
      name,
      avatar: avatarUrl,
      topic,
      members: members.length,
      unreadCount: unreadNotifications,
      isDirect,
      isEncrypted: room.hasEncryptionStateEvent(),
      tags
    }
  }

  getAllRoomsInfo(): MatrixRoom[] {
    const rooms = this.getAllRooms()
    return rooms.map((room) => this.getRoomInfo(room.roomId)).filter((room): room is MatrixRoom => room !== null)
  }

  searchRooms(query: string): MatrixRoom[] {
    const rooms = this.getAllRoomsInfo()
    const lowerQuery = query.toLowerCase()

    return rooms.filter(
      (room) =>
        room.name.toLowerCase().includes(lowerQuery) ||
        room.topic?.toLowerCase().includes(lowerQuery) ||
        room.roomId.toLowerCase().includes(lowerQuery)
    )
  }

  getDirectRooms(): MatrixRoom[] {
    const rooms = this.getAllRoomsInfo()
    return rooms.filter((room) => room.isDirect)
  }

  getGroupRooms(): MatrixRoom[] {
    const rooms = this.getAllRoomsInfo()
    return rooms.filter((room) => !room.isDirect)
  }

  async setRoomTag(roomId: string, tag: string, order: number): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      await client.setRoomTag(roomId, tag, { order })
    } catch (error) {
      console.error('Failed to set room tag:', error)
      throw error
    }
  }

  async removeRoomTag(roomId: string, tag: string): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      await client.deleteRoomTag(roomId, tag)
    } catch (error) {
      console.error('Failed to remove room tag:', error)
      throw error
    }
  }

  async setRoomFavorite(roomId: string, isFavorite: boolean): Promise<void> {
    if (isFavorite) {
      await this.setRoomTag(roomId, 'm.favourite', 0.5)
    } else {
      await this.removeRoomTag(roomId, 'm.favourite')
    }
  }

  async setRoomLowPriority(roomId: string, isLowPriority: boolean): Promise<void> {
    if (isLowPriority) {
      await this.setRoomTag(roomId, 'm.lowpriority', 0.5)
    } else {
      await this.removeRoomTag(roomId, 'm.lowpriority')
    }
  }

  async ignoreRoom(roomId: string, ignore: boolean): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      if (ignore) {
        await client.setRoomTag(roomId, 'm.server_notice', { order: 0.5 })
      } else {
        await this.deleteRoomTag(roomId, 'm.server_notice')
      }
    } catch (error) {
      console.error('Failed to ignore room:', error)
      throw error
    }
  }

  async deleteRoomTag(roomId: string, tag: string): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      await client.deleteRoomTag(roomId, tag)
    } catch (error) {
      console.error('Failed to delete room tag:', error)
      throw error
    }
  }

  async forgetRoom(roomId: string): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      await client.forget(roomId)
    } catch (error) {
      console.error('Failed to forget room:', error)
      throw error
    }
  }

  async enableRoomEncryption(roomId: string): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      await client.sendStateEvent(roomId, EventType.RoomEncryption, {
        algorithm: 'm.megolm.v1.aes-sha2'
      })
    } catch (error) {
      console.error('Failed to enable room encryption:', error)
      throw error
    }
  }

  isRoomEncrypted(roomId: string): boolean {
    const room = this.getRoom(roomId)
    return room ? room.hasEncryptionStateEvent() : false
  }

  getTypingUsers(roomId: string): string[] {
    const room = this.getRoom(roomId)
    if (!room) {
      return []
    }

    const typingEvent = room.currentState.getStateEvents(EventType.Typing, '')
    if (!typingEvent || !Array.isArray(typingEvent)) {
      return []
    }

    const content = typingEvent[0]?.getContent()
    if (content && Array.isArray(content.user_ids)) {
      return content.user_ids as string[]
    }

    return []
  }

  async sendTypingNotification(roomId: string, isTyping: boolean, timeout = 30000): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      await client.sendTyping(roomId, isTyping, timeout)
    } catch (error) {
      console.error('Failed to send typing notification:', error)
      throw error
    }
  }
}

export default MatrixRoomService
