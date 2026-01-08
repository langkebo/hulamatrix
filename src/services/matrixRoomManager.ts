/**
 * Matrix Room Manager
 * Handles Matrix room member management, permissions, and room settings
 */

import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'
import type { MatrixRoom, MatrixMember, MatrixPowerLevels } from '@/types/matrix'

// Type definitions for Matrix SDK client and room extensions
interface MatrixClientLike {
  baseUrl?: string
  getRoom(roomId: string): MatrixRoomLike | undefined
  sendStateEvent(roomId: string, eventType: string, content: Record<string, unknown>): Promise<unknown>
  uploadContent(file: File): Promise<UploadContentResponse>
  createRoom(options: CreateRoomOptions): Promise<CreateRoomResponse>
  invite(roomId: string, userId: string, reason?: string): Promise<unknown>
  kick(roomId: string, userId: string, reason?: string): Promise<unknown>
  ban(roomId: string, userId: string, reason?: string): Promise<unknown>
  unban(roomId: string, userId: string): Promise<unknown>
  joinRoom(roomId: string, opts?: unknown): Promise<unknown>
  leave(roomId: string): Promise<unknown>
  forget(roomId: string): Promise<unknown>
  getRooms(): MatrixRoomLike[]
  createMessagesRequest(roomId: string, from: string, dir: number, limit: number): Promise<MessagesResponse>
}

export interface MatrixRoomLike {
  roomId: string
  name: string
  getJoinedMembers?(): MatrixMemberLike[]
  currentState?: {
    getStateEvents?(eventType: string): Record<string, unknown> | unknown[] | MatrixEventLike
  }
  getMember?(userId: string): MatrixMemberLike | undefined
  getAvatarUrl?(
    baseUrl: string,
    width: number,
    height: number,
    resizeMethod: string,
    allowDefault: boolean,
    allowDirectLinks: boolean
  ): string
  isDirectMessage?(): boolean
  hasEncryptionStateEvent?(): boolean
  getJoinRule?(): string
  getGuestAccess?(): string
  getHistoryVisibility?(): string
  getJoinedMemberCount?(): number
  getMyMembership?(): string
}

export interface MatrixMemberLike {
  userId: string
  name: string
  displayName?: string
  avatarUrl?: string
  getAvatarUrl?(
    baseUrl: string,
    width: number,
    height: number,
    resizeMethod: string,
    allowDefault: boolean,
    allowDirectLinks: boolean
  ): string
  powerLevel?: number
  membership?: string
  reason?: string
}

export interface MatrixEventLike {
  getContent?(): Record<string, unknown>
}

interface UploadContentResponse {
  content_uri: string
}

interface CreateRoomOptions {
  preset: string
  invite: string[]
  is_direct: boolean
  [key: string]: unknown
}

interface CreateRoomResponse {
  room_id: string
  [key: string]: unknown
}

interface MessagesResponse {
  chunk: unknown[]
  start?: string
  end?: string
  [key: string]: unknown
}

export interface RoomSettings {
  name?: string
  topic?: string
  avatar?: File
  joinRule?: 'public' | 'invite' | 'knock' | 'restricted'
  guestAccess?: 'can_join' | 'forbidden'
  historyVisibility?: 'world_readable' | 'shared' | 'invited' | 'joined'
  encryption?: boolean
  roomVersion?: string
}

export interface MemberChangeOptions {
  reason?: string
  powerLevel?: number
}

export interface PowerLevelChanges {
  users?: Record<string, number>
  events?: Record<string, number>
  usersDefault?: number
  eventsDefault?: number
  stateDefault?: number
  ban?: number
  kick?: number
  redact?: number
  invite?: number
  roomName?: number
  roomAvatar?: number
  roomTopic?: number
  powerLevel?: number
}

/**
 * Matrix Room Manager
 *
 * Phase 12 优化: 使用缓存的 client 引用，避免重复调用 getClient()
 */
export class MatrixRoomManager {
  private static instance: MatrixRoomManager

  static getInstance(): MatrixRoomManager {
    if (!MatrixRoomManager.instance) {
      MatrixRoomManager.instance = new MatrixRoomManager()
    }
    return MatrixRoomManager.instance
  }

  /**
   * Phase 12 优化: 获取缓存的 Matrix client 引用
   * 避免重复调用 matrixClientService.getClient()
   */
  private get client(): MatrixClientLike | null {
    return matrixClientService.getClient() as MatrixClientLike | null
  }

  private normalizePowerLevels(raw: Record<string, unknown> | null | undefined): MatrixPowerLevels {
    if (!raw || typeof raw !== 'object') {
      return {
        users: {},
        events: {},
        usersDefault: 0,
        eventsDefault: 0,
        stateDefault: 50,
        ban: 50,
        kick: 50,
        redact: 50,
        invite: 50,
        roomName: 50,
        roomAvatar: 50,
        roomTopic: 50,
        powerLevel: 50
      }
    }

    return {
      ...raw,
      users: (raw.users as Record<string, number> | undefined) ?? {},
      events: (raw.events as Record<string, number> | undefined) ?? {},
      usersDefault: (raw.usersDefault as number | undefined) ?? (raw.users_default as number | undefined) ?? 0,
      eventsDefault: (raw.eventsDefault as number | undefined) ?? (raw.events_default as number | undefined) ?? 0,
      stateDefault: (raw.stateDefault as number | undefined) ?? (raw.state_default as number | undefined) ?? 50,
      ban: (raw.ban as number | undefined) ?? 50,
      kick: (raw.kick as number | undefined) ?? 50,
      redact: (raw.redact as number | undefined) ?? 50,
      invite: (raw.invite as number | undefined) ?? 50,
      roomName: (raw.roomName as number | undefined) ?? 50,
      roomAvatar: (raw.roomAvatar as number | undefined) ?? 50,
      roomTopic: (raw.roomTopic as number | undefined) ?? 50,
      powerLevel: (raw.powerLevel as number | undefined) ?? 50
    }
  }

  /**
   * Update room settings
   */
  async updateRoomSettings(roomId: string, settings: RoomSettings): Promise<void> {
    const client = this.client
    if (!client) {
      throw new Error('Matrix client not available')
    }

    try {
      logger.info('[MatrixRoomManager] Updating room settings', { roomId })

      const room = client.getRoom(roomId)
      if (!room) {
        throw new Error('Room not found')
      }

      // Update name
      if (settings.name !== undefined) {
        await client.sendStateEvent(roomId, 'm.room.name', { name: settings.name })
      }

      // Update topic
      if (settings.topic !== undefined) {
        await client.sendStateEvent(roomId, 'm.room.topic', { topic: settings.topic })
      }

      // Update avatar
      if (settings.avatar) {
        const uploadResponse = await client.uploadContent(settings.avatar)
        await client.sendStateEvent(roomId, 'm.room.avatar', {
          url: uploadResponse.content_uri
        })
      }

      // Update join rule
      if (settings.joinRule !== undefined) {
        await client.sendStateEvent(roomId, 'm.room.join_rules', {
          join_rule: settings.joinRule
        })
      }

      // Update guest access
      if (settings.guestAccess !== undefined) {
        await client.sendStateEvent(roomId, 'm.room.guest_access', {
          guest_access: settings.guestAccess
        })
      }

      // Update history visibility
      if (settings.historyVisibility !== undefined) {
        await client.sendStateEvent(roomId, 'm.room.history_visibility', {
          history_visibility: settings.historyVisibility
        })
      }

      // Enable/disable encryption
      if (settings.encryption !== undefined) {
        if (settings.encryption) {
          await client.sendStateEvent(roomId, 'm.room.encryption', {
            algorithm: 'm.megolm.v1.aes-sha2'
          })
        } else {
          logger.warn('[MatrixRoomManager] Cannot disable encryption for a room once enabled')
        }
      }

      // Update room version
      if (settings.roomVersion !== undefined) {
        // Note: This requires appropriate permissions
        logger.warn('[MatrixRoomManager] Room version update requires admin rights')
      }

      logger.info('[MatrixManager] Room settings updated successfully')
    } catch (error) {
      logger.error('[MatrixRoomManager] Failed to update room settings:', error)
      throw error
    }
  }

  /**
   * Ensure room members are loaded (lazy loading)
   * Uses Matrix SDK's loadMembersIfNeeded() to avoid loading all members at once
   */
  async ensureMembersLoaded(roomId: string): Promise<boolean> {
    const client = this.client
    if (!client) {
      logger.warn('[MatrixRoomManager] Client not available for loading members')
      return false
    }

    try {
      const room = client.getRoom(roomId)
      if (!room) {
        logger.warn('[MatrixRoomManager] Room not found for loading members', { roomId })
        return false
      }

      // Check if room has loadMembersIfNeeded method (Matrix SDK feature)
      const loadableRoom = room as { loadMembersIfNeeded?: () => Promise<void> }
      if (typeof loadableRoom.loadMembersIfNeeded === 'function') {
        logger.info('[MatrixRoomManager] Lazy loading members for room', { roomId })
        await loadableRoom.loadMembersIfNeeded()
        return true
      }

      // Fallback: room already has members loaded
      const members = room.getJoinedMembers?.()
      if (members && members.length > 0) {
        logger.debug('[MatrixRoomManager] Members already loaded', { roomId, count: members.length })
        return true
      }

      return false
    } catch (error) {
      logger.error('[MatrixRoomManager] Failed to ensure members loaded:', error)
      return false
    }
  }

  /**
   * Get room members with pagination support
   * @param roomId - Room ID
   * @param options - Pagination options
   */
  async getRoomMembersPaginated(
    roomId: string,
    options: {
      limit?: number
      offset?: number
      includeOffline?: boolean
    } = {}
  ): Promise<{ members: MatrixMember[]; total: number; hasMore: boolean }> {
    const { limit = 50, offset = 0, includeOffline = true } = options

    try {
      // Ensure members are loaded first
      await this.ensureMembersLoaded(roomId)

      const client = this.client
      if (!client) {
        throw new Error('Matrix client not available')
      }

      const room = client.getRoom(roomId)
      if (!room) {
        throw new Error('Room not found')
      }

      const members = room.getJoinedMembers?.() || []
      const baseUrl: string = client.baseUrl || ''

      // Convert to MatrixMember format
      const allMembers: MatrixMember[] = []
      for (const member of members) {
        const avatar = member.getAvatarUrl?.(baseUrl, 48, 48, 'crop', true, true) || undefined
        allMembers.push({
          userId: member.userId,
          displayName: member.name,
          avatarUrl: avatar || undefined,
          powerLevel: member.powerLevel || 0,
          membership: (member.membership || 'join') as 'join' | 'invite' | 'leave' | 'ban',
          presenceActive: undefined,
          presence: undefined,
          lastActiveAgo: undefined,
          currentlyActive: undefined,
          deviceDisplay: undefined,
          joinedAt: undefined,
          reason: member.reason
        })
      }

      // Filter by online status if needed
      let filteredMembers = allMembers
      if (!includeOffline) {
        filteredMembers = allMembers.filter((m) => m.presence === 'online')
      }

      // Apply pagination
      const paginatedMembers = filteredMembers.slice(offset, offset + limit)

      return {
        members: paginatedMembers,
        total: filteredMembers.length,
        hasMore: offset + limit < filteredMembers.length
      }
    } catch (error) {
      logger.error('[MatrixRoomManager] Failed to get room members (paginated):', error)
      return { members: [], total: 0, hasMore: false }
    }
  }

  /**
   * Get room members (legacy method - ensures members are loaded first)
   */
  async getRoomMembers(roomId: string): Promise<MatrixMember[]> {
    const client = this.client
    if (!client) {
      throw new Error('Matrix client not available')
    }

    try {
      // Ensure members are loaded using lazy loading
      await this.ensureMembersLoaded(roomId)

      const room = client.getRoom(roomId)
      if (!room) {
        throw new Error('Room not found')
      }

      const members = room.getJoinedMembers?.() || []
      const matrixMembers: MatrixMember[] = []
      const baseUrl: string = client.baseUrl || ''

      for (const member of members) {
        const avatar = member.getAvatarUrl?.(baseUrl, 48, 48, 'crop', true, true) || undefined
        matrixMembers.push({
          userId: member.userId,
          displayName: member.name,
          avatarUrl: avatar || undefined,
          powerLevel: member.powerLevel || 0,
          membership: (member.membership || 'join') as 'join' | 'invite' | 'leave' | 'ban',
          presenceActive: undefined,
          presence: undefined,
          lastActiveAgo: undefined,
          currentlyActive: undefined,
          deviceDisplay: undefined,
          joinedAt: undefined,
          reason: member.reason
        })
      }

      return matrixMembers
    } catch (error) {
      logger.error('[MatrixRoomManager] Failed to get room members:', error)
      return []
    }
  }

  /**
   * Invite user to room
   */
  async inviteUser(roomId: string, userId: string, reason?: string): Promise<void> {
    const client = this.client
    if (!client) {
      throw new Error('Matrix client not available')
    }

    try {
      logger.info('[MatrixRoomManager] Inviting user to room', { roomId, userId, reason })

      await client.invite(roomId, userId, reason)

      logger.info('[MatrixRoomManager] User invited successfully')
    } catch (error) {
      logger.error('[MatrixRoomManager] Failed to invite user:', error)
      throw error
    }
  }

  /**
   * Kick user from room
   */
  async kickUser(roomId: string, userId: string, reason?: string): Promise<void> {
    const client = this.client
    if (!client) {
      throw new Error('Matrix client not available')
    }

    try {
      logger.info('[MatrixRoomManager] Kicking user from room', { roomId, userId, reason })

      await client.kick(roomId, userId, reason)

      logger.info('[MatrixRoomManager] User kicked successfully')
    } catch (error) {
      logger.error('[MatrixRoomManager] Failed to kick user:', error)
      throw error
    }
  }

  /**
   * Ban user from room
   */
  async banUser(roomId: string, userId: string, reason?: string): Promise<void> {
    const client = this.client
    if (!client) {
      throw new Error('Matrix client not available')
    }

    try {
      logger.info('[MatrixRoomManager] Banning user from room', { roomId, userId, reason })

      await client.ban(roomId, userId, reason)

      logger.info('[MatrixRoomManager] User banned successfully')
    } catch (error) {
      logger.error('[MatrixRoomManager] Failed to ban user:', error)
      throw error
    }
  }

  /**
   * Unban user from room
   */
  async unbanUser(roomId: string, userId: string): Promise<void> {
    const client = this.client
    if (!client) {
      throw new Error('Matrix client not available')
    }

    try {
      logger.info('[MatrixRoomManager] Unbanning user from room', { roomId, userId })

      await client.unban(roomId, userId)

      logger.info('[MatrixRoomManager] User unbanned successfully')
    } catch (error) {
      logger.error('[MatrixRoomManager] Failed to unban user:', error)
      throw error
    }
  }

  /**
   * Set user power level
   */
  async setUserPowerLevel(roomId: string, userId: string, powerLevel: number): Promise<void> {
    const client = this.client
    if (!client) {
      throw new Error('Matrix client not available')
    }

    try {
      logger.info('[MatrixRoomManager] Setting user power level', {
        roomId,
        userId,
        powerLevel
      })

      const room = client.getRoom(roomId)
      if (!room) {
        throw new Error('Room not found')
      }

      const mapPL = room.currentState?.getStateEvents?.('m.room.power_levels') || {}
      const plEvt = Array.isArray(mapPL)
        ? mapPL[0]
        : (Object.values(mapPL as Record<string, unknown>)[0] as unknown as MatrixEventLike | undefined)
      const getContentFn = (plEvt as MatrixEventLike | undefined)?.getContent as (() => MatrixPowerLevels) | undefined
      const currentPL = getContentFn?.()

      if (!currentPL) {
        throw new Error('Power levels not found in room')
      }

      // Create updated power levels
      const updatedPL = { ...currentPL }
      updatedPL.users = {
        ...updatedPL.users,
        [userId]: powerLevel
      }

      await client.sendStateEvent(roomId, 'm.room.power_levels', updatedPL)

      logger.info('[MatrixRoomManager] User power level set successfully')
    } catch (error) {
      logger.error('[MatrixRoomManager] Failed to set user power level:', error)
      throw error
    }
  }

  /**
   * Get room power levels
   */
  async getRoomPowerLevels(roomId: string): Promise<MatrixPowerLevels> {
    const client = this.client
    if (!client) {
      throw new Error('Matrix client not available')
    }

    try {
      const room = client.getRoom(roomId)
      if (!room) {
        throw new Error('Room not found')
      }

      const mapPL2 = room.currentState?.getStateEvents?.('m.room.power_levels') || {}
      const plEvent = (Array.isArray(mapPL2) ? mapPL2[0] : Object.values(mapPL2 as Record<string, unknown>)[0]) as
        | MatrixEventLike
        | undefined

      if (!plEvent) {
        return this.normalizePowerLevels(null)
      }

      return this.normalizePowerLevels(plEvent.getContent?.() as Record<string, unknown> | null)
    } catch (error) {
      logger.error('[MatrixRoomManager] Failed to get room power levels:', error)
      throw error
    }
  }

  /**
   * Update room power levels
   */
  async updateRoomPowerLevels(roomId: string, changes: PowerLevelChanges): Promise<void> {
    const client = this.client
    if (!client) {
      throw new Error('Matrix client not available')
    }

    try {
      logger.info('[MatrixRoomManager] Updating room power levels', { roomId })

      const currentPL = await this.getRoomPowerLevels(roomId)

      // Apply changes
      const updatedPL = { ...currentPL }

      if (changes.users) {
        updatedPL.users = {
          ...updatedPL.users,
          ...changes.users
        }
      }

      if (changes.events) {
        updatedPL.events = {
          ...updatedPL.events,
          ...changes.events
        }
      }

      if (changes.usersDefault !== undefined) {
        updatedPL.usersDefault = changes.usersDefault
      }

      if (changes.eventsDefault !== undefined) {
        updatedPL.eventsDefault = changes.eventsDefault
      }

      if (changes.stateDefault !== undefined) {
        updatedPL.stateDefault = changes.stateDefault
      }

      if (changes.ban !== undefined) {
        updatedPL.ban = changes.ban
      }

      if (changes.kick !== undefined) {
        updatedPL.kick = changes.kick
      }

      if (changes.redact !== undefined) {
        updatedPL.redact = changes.redact
      }

      if (changes.invite !== undefined) {
        updatedPL.invite = changes.invite
      }

      if (changes.roomName !== undefined) {
        updatedPL.roomName = changes.roomName
      }

      if (changes.roomAvatar !== undefined) {
        updatedPL.roomAvatar = changes.roomAvatar
      }

      if (changes.roomTopic !== undefined) {
        updatedPL.roomTopic = changes.roomTopic
      }

      if (changes.powerLevel !== undefined) {
        updatedPL.powerLevel = changes.powerLevel
      }

      await client.sendStateEvent(roomId, 'm.room.power_levels', updatedPL)

      logger.info('[MatrixRoomManager] Room power levels updated successfully')
    } catch (error) {
      logger.error('[MatrixRoomManager] Failed to update room power levels:', error)
      throw error
    }
  }

  /**
   * Check user permissions in room
   */
  async checkUserPermission(
    roomId: string,
    userId: string,
    action: keyof Omit<MatrixPowerLevels, 'users' | 'events'>
  ): Promise<boolean> {
    try {
      const client = this.client
      const room = client?.getRoom(roomId)
      if (!room) {
        return false
      }

      const member = room.getMember?.(userId)
      if (!member || member.membership !== 'join') {
        return false
      }

      const pl = await this.getRoomPowerLevels(roomId)
      const users = pl.users ?? {}
      const userPL = users[userId] ?? pl.usersDefault ?? 0
      const plRecord = pl as Record<string, number | undefined>
      const required =
        plRecord[action] ?? plRecord[String(action).replace(/[A-Z]/g, (m: string) => `_${m.toLowerCase()}`)] ?? 0

      return userPL >= required
    } catch (error) {
      logger.error('[MatrixRoomManager] Failed to check user permission:', error)
      return false
    }
  }

  /**
   * Create a direct message room with user
   */
  async createDMRoom(userId: string): Promise<string> {
    const client = this.client
    if (!client) {
      throw new Error('Matrix client not available')
    }

    try {
      logger.info('[MatrixRoomManager] Creating DM room', { userId })

      const res = await client.createRoom({
        preset: 'trusted_private_chat',
        invite: [userId],
        is_direct: true
      })
      const roomId = (res as CreateRoomResponse)?.room_id || (res as unknown as string) || ''

      logger.info('[MatrixRoomManager] DM room created successfully', { roomId })
      return roomId
    } catch (error) {
      logger.error('[MatrixRoomManager] Failed to create DM room:', error)
      throw error
    }
  }

  /**
   * Check if room is a direct message
   */
  isDirectMessage(roomId: string): boolean {
    const client = this.client
    if (!client) {
      return false
    }

    const room = client.getRoom(roomId)
    if (!room) {
      return false
    }

    return !!room.isDirectMessage?.()
  }

  /**
   * Get room summary
   */
  getRoomSummary(roomId: string): Partial<MatrixRoom> | null {
    const client = this.client
    if (!client) {
      return null
    }

    const room = client.getRoom(roomId)
    if (!room) {
      return null
    }

    const baseUrl = client.baseUrl || ''
    const avatar = room.getAvatarUrl?.(baseUrl, 64, 64, 'crop', true, true) || undefined
    return {
      roomId: room.roomId,
      name: room.name,
      topic: undefined,
      avatar,
      encrypted: !!room.hasEncryptionStateEvent?.(),
      joinRule: room.getJoinRule?.() || 'invite',
      guestAccess: room.getGuestAccess?.() || 'forbidden',
      historyVisibility: room.getHistoryVisibility?.() || 'joined',
      memberCount: room.getJoinedMemberCount?.() || 0
    }
  }

  /**
   * Join room
   * @param roomId - The room ID to join
   * @param viaServers - Optional list of servers to try and join through
   */
  async joinRoom(roomId: string, viaServers?: string[]): Promise<void> {
    const client = this.client
    if (!client) {
      throw new Error('Matrix client not available')
    }

    try {
      logger.info('[MatrixRoomManager] Joining room', { roomId, viaServers })

      // Build join options with viaServers if provided
      const opts: Record<string, unknown> = {}
      if (viaServers !== undefined) {
        opts.viaServers = viaServers
      }

      // Use type assertion to match the Matrix SDK signature
      await client.joinRoom(roomId, opts as unknown)
      logger.info('[MatrixRoomManager] Room joined successfully')
    } catch (error) {
      logger.error('[MatrixRoomManager] Failed to join room:', error)
      throw error
    }
  }

  /**
   * Leave room
   */
  async leaveRoom(roomId: string): Promise<void> {
    const client = this.client
    if (!client) {
      throw new Error('Matrix client not available')
    }

    try {
      logger.info('[MatrixRoomManager] Leaving room', { roomId })
      await client.leave(roomId)
      logger.info('[MatrixRoomManager] Room left successfully')
    } catch (error) {
      logger.error('[MatrixRoomManager] Failed to leave room:', error)
      throw error
    }
  }

  /**
   * Forget room (remove from room list)
   */
  async forgetRoom(roomId: string): Promise<void> {
    const client = this.client
    if (!client) {
      throw new Error('Matrix client not available')
    }

    try {
      logger.info('[MatrixRoomManager] Forgetting room', { roomId })
      await client.forget(roomId)
      logger.info('[MatrixRoomManager] Room forgotten successfully')
    } catch (error) {
      logger.error('[MatrixRoomManager] Failed to forget room:', error)
      throw error
    }
  }

  /**
   * Get all joined rooms
   */
  async getJoinedRooms(): Promise<string[]> {
    const client = this.client
    if (!client) {
      throw new Error('Matrix client not available')
    }

    try {
      const rooms = client.getRooms()
      const joinedRoomIds = rooms.filter((room) => room.getMyMembership?.() === 'join').map((room) => room.roomId)

      logger.info('[MatrixRoomManager] Retrieved joined rooms', { count: joinedRoomIds.length })
      return joinedRoomIds
    } catch (error) {
      logger.error('[MatrixRoomManager] Failed to get joined rooms:', error)
      throw error
    }
  }

  /**
   * Get room messages
   */
  async getRoomMessages(
    roomId: string,
    limit: number = 50,
    from?: string
  ): Promise<{
    events: unknown[]
    nextBatch?: string
    prevBatch?: string
  }> {
    const client = this.client
    if (!client) {
      throw new Error('Matrix client not available')
    }

    try {
      const response = await client.createMessagesRequest(roomId, from || 'END', -1, limit)

      logger.info('[MatrixRoomManager] Retrieved room messages', {
        roomId,
        count: response.chunk.length
      })

      return (() => {
        const result: {
          events: unknown[]
          nextBatch?: string
          prevBatch?: string
        } = {
          events: response.chunk
        }
        if (response.end !== undefined) result.nextBatch = response.end
        if (response.start !== undefined) result.prevBatch = response.start
        return result
      })()
    } catch (error) {
      logger.error('[MatrixRoomManager] Failed to get room messages:', error)
      throw error
    }
  }
}

// Export singleton instance
export const matrixRoomManager = MatrixRoomManager.getInstance()
