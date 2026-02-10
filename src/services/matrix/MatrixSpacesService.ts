import { type MatrixClient, type Room, EventType, Preset, Visibility } from 'matrix-js-sdk'
import type {
  SpaceCreateParams,
  SpaceHierarchyNode,
  SpaceInfo,
  SpaceMemberInfo,
  SpaceNotificationSettings,
  SpaceRoomInfo
} from '@/types/space'

type PublicRoomsChunkRoom = {
  room_type?: string | null
  room_id: string
  name?: string | null
  topic?: string | null
  avatar_url?: string | null
  num_joined_members?: number | null
}

interface SpaceCache {
  spaceList: { data: SpaceInfo[]; timestamp: number }
  spaceRooms: Map<string, { data: SpaceRoomInfo[]; timestamp: number }>
  spaceMembers: Map<string, { data: SpaceMemberInfo[]; timestamp: number }>
  spaceHierarchy: Map<string, { data: SpaceHierarchyNode[]; timestamp: number }>
}

class MatrixSpacesService {
  private client: MatrixClient | null = null

  private static instance: MatrixSpacesService

  private cache: SpaceCache = {
    spaceList: { data: [], timestamp: 0 },
    spaceRooms: new Map(),
    spaceMembers: new Map(),
    spaceHierarchy: new Map()
  }

  private readonly CACHE_TTL = 5 * 60 * 1000

  private getRoomCreatedAt(room: Room): number {
    const createEvent = room.currentState.getStateEvents(EventType.RoomCreate, '')
    const ts = typeof createEvent?.getTs === 'function' ? createEvent.getTs() : undefined
    return typeof ts === 'number' ? ts : Date.now()
  }

  static getInstance(): MatrixSpacesService {
    if (!MatrixSpacesService.instance) {
      MatrixSpacesService.instance = new MatrixSpacesService()
    }
    return MatrixSpacesService.instance
  }

  setClient(client: MatrixClient): void {
    this.client = client
  }

  getClient(): MatrixClient | null {
    return this.client
  }

  async getSpaceList(forceRefresh = false): Promise<SpaceInfo[]> {
    if (!this.client) {
      if (import.meta.env.DEV) {
        console.error('[MatrixSpacesService] Matrix client not initialized')
      }
      return []
    }

    const now = Date.now()
    if (
      !forceRefresh &&
      this.cache.spaceList.data.length > 0 &&
      now - this.cache.spaceList.timestamp < this.CACHE_TTL
    ) {
      if (import.meta.env.DEV) {
        console.log('[MatrixSpacesService] Using cached space list')
      }
      return this.cache.spaceList.data
    }

    try {
      if (import.meta.env.DEV) {
        console.log('[MatrixSpacesService] Fetching space list...')
      }
      const rooms = this.client.getRooms() || []
      const spaceList: SpaceInfo[] = []

      for (const room of rooms) {
        if (this.isSpace(room)) {
          const spaceInfo = this.extractSpaceInfo(room)
          spaceList.push(spaceInfo)
        }
      }

      this.cache.spaceList = { data: spaceList, timestamp: now }
      if (import.meta.env.DEV) {
        console.log(`[MatrixSpacesService] Found ${spaceList.length} spaces`)
      }
      return spaceList
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixSpacesService] Failed to fetch space list:', error)
      }
      return this.cache.spaceList.data
    }
  }

  private isSpace(room: Room): boolean {
    try {
      if (room.getType() === 'm.space') return true
    } catch {
      // ignore
    }

    const currentState = room.currentState
    const createEvent = currentState.getStateEvents(EventType.RoomCreate, '')
    return createEvent?.getContent()?.type === 'm.space'
  }

  private extractSpaceInfo(room: Room): SpaceInfo {
    const name = (room.name as string | undefined) ?? room.roomId
    const avatar = room.getMxcAvatarUrl() ?? undefined
    const canonicalAlias = room.getCanonicalAlias() ?? undefined
    const memberCount = room.getJoinedMemberCount()

    const topicEvent = room.currentState.getStateEvents(EventType.RoomTopic, '')
    const topic = (topicEvent?.getContent()?.topic as string | undefined) ?? undefined

    const joinRule = room.currentState.getJoinRule?.() ?? 'private'
    const isPublic = joinRule === 'public'

    return {
      roomId: room.roomId,
      name,
      avatar,
      topic,
      canonicalAlias,
      memberCount,
      isPublic,
      createdAt: this.getRoomCreatedAt(room),
      lastActive: room.getLastActiveTimestamp() ?? Date.now()
    }
  }

  async getSpaceRooms(spaceId: string, forceRefresh = false): Promise<SpaceRoomInfo[]> {
    if (!this.client) {
      if (import.meta.env.DEV) {
        console.error('[MatrixSpacesService] Matrix client not initialized')
      }
      return []
    }

    const now = Date.now()
    const cached = this.cache.spaceRooms.get(spaceId)
    if (!forceRefresh && cached && now - cached.timestamp < this.CACHE_TTL) {
      if (import.meta.env.DEV) {
        console.log(`[MatrixSpacesService] Using cached rooms for space ${spaceId}`)
      }
      return cached.data
    }

    try {
      if (import.meta.env.DEV) {
        console.log(`[MatrixSpacesService] Fetching rooms for space ${spaceId}`)
      }
      const rooms = this.client.getRooms() || []
      const spaceRooms: SpaceRoomInfo[] = []

      for (const room of rooms) {
        if (room.roomId === spaceId) continue
        if (this.isSpace(room)) continue

        spaceRooms.push(this.extractSpaceRoomInfo(room))
      }

      this.cache.spaceRooms.set(spaceId, { data: spaceRooms, timestamp: now })
      if (import.meta.env.DEV) {
        console.log(`[MatrixSpacesService] Found ${spaceRooms.length} rooms in space ${spaceId}`)
      }
      return spaceRooms
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error(`[MatrixSpacesService] Failed to fetch rooms for space ${spaceId}:`, error)
      }
      return this.cache.spaceRooms.get(spaceId)?.data ?? []
    }
  }

  private extractSpaceRoomInfo(room: Room): SpaceRoomInfo {
    const name = (room.name as string | undefined) ?? room.roomId
    const avatar = room.getMxcAvatarUrl() ?? undefined
    const memberCount = room.getJoinedMemberCount()

    const topicEvent = room.currentState.getStateEvents(EventType.RoomTopic, '')
    const topic = (topicEvent?.getContent()?.topic as string | undefined) ?? undefined

    return {
      roomId: room.roomId,
      name,
      avatar,
      topic,
      memberCount,
      addedAt: this.getRoomCreatedAt(room),
      isCanonical: false
    }
  }

  async getSpaceMembers(spaceId: string, forceRefresh = false): Promise<SpaceMemberInfo[]> {
    if (!this.client) {
      if (import.meta.env.DEV) {
        console.error('[MatrixSpacesService] Matrix client not initialized')
      }
      return []
    }

    const now = Date.now()
    const cached = this.cache.spaceMembers.get(spaceId)
    if (!forceRefresh && cached && now - cached.timestamp < this.CACHE_TTL) {
      return cached.data
    }

    try {
      if (import.meta.env.DEV) {
        console.log(`[MatrixSpacesService] Fetching members for space ${spaceId}`)
      }
      const room = this.client.getRoom(spaceId)
      if (!room) {
        return []
      }

      const members = room.getMembers() ?? []
      const memberInfos: SpaceMemberInfo[] = []

      for (const member of members) {
        const powerLevel = typeof member.powerLevel === 'number' ? member.powerLevel : 0
        const role: SpaceMemberInfo['role'] = powerLevel >= 100 ? 'owner' : powerLevel >= 50 ? 'admin' : 'member'

        memberInfos.push({
          userId: member.userId,
          displayName: member.name,
          avatarUrl: member.getAvatarUrl(this.client.baseUrl, 96, 96, 'crop', true, false) ?? undefined,
          role,
          membership: member.membership,
          joinedAt: member.events?.member?.getTs?.()
        })
      }

      this.cache.spaceMembers.set(spaceId, { data: memberInfos, timestamp: now })
      return memberInfos
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error(`[MatrixSpacesService] Failed to fetch members for space ${spaceId}:`, error)
      }
      return this.cache.spaceMembers.get(spaceId)?.data ?? []
    }
  }

  async getSpaceNotificationSettings(spaceId: string): Promise<SpaceNotificationSettings> {
    try {
      const room = this.client?.getRoom(spaceId)
      if (!room) {
        return { roomId: spaceId, enabled: true, level: 'all', soundEnabled: true, keywords: [], ignoreUsers: [] }
      }

      const notificationSettingsEvent = room.currentState.getStateEvents('m.room.notification_settings', '')
      if (notificationSettingsEvent) {
        const content = notificationSettingsEvent.getContent()
        const mute = (content?.mute as boolean | undefined) ?? false
        const mentionsOnly = (content?.mentions_only as boolean | undefined) ?? false

        return {
          roomId: spaceId,
          enabled: !mute,
          level: mute ? 'none' : mentionsOnly ? 'mentions' : 'all',
          soundEnabled: (content?.sound_enabled as boolean | undefined) ?? true,
          keywords: Array.isArray(content?.keywords) ? content.keywords : [],
          ignoreUsers: Array.isArray(content?.ignore_users) ? content.ignore_users : []
        }
      }
      return { roomId: spaceId, enabled: true, level: 'all', soundEnabled: true, keywords: [], ignoreUsers: [] }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error(`[MatrixSpacesService] Failed to get notification settings for space ${spaceId}:`, error)
      }
      return { roomId: spaceId, enabled: true, level: 'all', soundEnabled: true, keywords: [], ignoreUsers: [] }
    }
  }

  async searchPublicSpaces(query: string, limit = 20): Promise<SpaceInfo[]> {
    if (!this.client) {
      if (import.meta.env.DEV) {
        console.error('[MatrixSpacesService] Matrix client not initialized')
      }
      return []
    }

    if (import.meta.env.DEV) {
      console.log(`[MatrixSpacesService] Searching public spaces with query: ${query}`)
    }

    try {
      const result = await this.client.publicRooms({
        filter: {
          generic_search_term: query
        },
        limit
      })

      return result.chunk
        .filter((room: PublicRoomsChunkRoom) => room.room_type === 'm.space')
        .map((room: PublicRoomsChunkRoom) => ({
          roomId: room.room_id,
          name: room.name ?? room.room_id,
          topic: room.topic ?? undefined,
          avatar: room.avatar_url ?? undefined,
          isPublic: true,
          memberCount: room.num_joined_members ?? 0,
          createdAt: Date.now(),
          lastActive: Date.now()
        }))
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixSpacesService] Failed to search public spaces:', error)
      }
      return []
    }
  }

  async getPublicSpaces(limit = 50): Promise<SpaceInfo[]> {
    if (!this.client) {
      if (import.meta.env.DEV) {
        console.error('[MatrixSpacesService] Matrix client not initialized')
      }
      return []
    }

    if (import.meta.env.DEV) {
      console.log('[MatrixSpacesService] Fetching public spaces')
    }

    try {
      const result = await this.client.publicRooms({
        limit
      })

      return result.chunk
        .filter((room: PublicRoomsChunkRoom) => room.room_type === 'm.space')
        .map((room: PublicRoomsChunkRoom) => ({
          roomId: room.room_id,
          name: room.name ?? room.room_id,
          topic: room.topic ?? undefined,
          avatar: room.avatar_url ?? undefined,
          isPublic: true,
          memberCount: room.num_joined_members ?? 0,
          createdAt: Date.now(),
          lastActive: Date.now()
        }))
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixSpacesService] Failed to get public spaces:', error)
      }
      return []
    }
  }

  async createSpaceInviteLink(spaceId: string, expiresIn?: number): Promise<string | null> {
    if (!this.client) {
      if (import.meta.env.DEV) {
        console.error('[MatrixSpacesService] Matrix client not initialized')
      }
      return null
    }

    if (import.meta.env.DEV) {
      console.log(`[MatrixSpacesService] Creating invite link for space: ${spaceId}`)
    }

    try {
      const clientAny = this.client as unknown as {
        createInviteLink?: (roomId: string, expiresIn?: number) => Promise<string>
      }
      if (typeof clientAny.createInviteLink === 'function') {
        return await clientAny.createInviteLink(spaceId, expiresIn)
      }

      if (import.meta.env.DEV) {
        console.warn('[MatrixSpacesService] createInviteLink method not available')
      }
      return null
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixSpacesService] Failed to create invite link:', error)
      }
      return null
    }
  }

  async createSpace(params: SpaceCreateParams): Promise<string | null> {
    if (!this.client) {
      if (import.meta.env.DEV) {
        console.error('[MatrixSpacesService] Matrix client not initialized')
      }
      return null
    }

    if (import.meta.env.DEV) {
      console.log(`[MatrixSpacesService] Creating space: ${params.name}`)
    }

    try {
      const initial_state = []
      if (params.avatar) {
        initial_state.push({
          type: EventType.RoomAvatar,
          state_key: '',
          content: { url: params.avatar }
        })
      }

      const result = await this.client.createRoom({
        name: params.name,
        topic: params.topic,
        room_version: '10',
        creation_content: {
          type: 'm.space'
        },
        visibility: params.isPublic ? Visibility.Public : Visibility.Private,
        preset: params.isPublic ? Preset.PublicChat : Preset.PrivateChat,
        invite: params.inviteUsers,
        initial_state
      })

      this.invalidateSpaceListCache()
      return result.room_id
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixSpacesService] Failed to create space:', error)
      }
      return null
    }
  }

  async addRoomToSpace(spaceId: string, roomId: string, suggested?: boolean): Promise<boolean> {
    if (!this.client) {
      if (import.meta.env.DEV) {
        console.error('[MatrixSpacesService] Matrix client not initialized')
      }
      return false
    }

    try {
      const content: Record<string, unknown> = {}
      if (suggested) {
        content.suggested = true
      }
      await this.client.sendStateEvent(spaceId, EventType.SpaceChild, content, roomId)

      this.invalidateSpaceRoomsCache(spaceId)
      return true
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixSpacesService] Failed to add room to space:', error)
      }
      return false
    }
  }

  async removeRoomFromSpace(spaceId: string, roomId: string): Promise<boolean> {
    if (!this.client) {
      if (import.meta.env.DEV) {
        console.error('[MatrixSpacesService] Matrix client not initialized')
      }
      return false
    }

    try {
      await this.client.sendStateEvent(spaceId, EventType.SpaceChild, {}, roomId)

      this.invalidateSpaceRoomsCache(spaceId)
      return true
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixSpacesService] Failed to remove room from space:', error)
      }
      return false
    }
  }

  async getSpaceHierarchy(spaceId: string, maxDepth = 3, forceRefresh = false): Promise<SpaceHierarchyNode[]> {
    if (!this.client) return []

    const now = Date.now()
    const cached = this.cache.spaceHierarchy.get(spaceId)
    if (!forceRefresh && cached && now - cached.timestamp < this.CACHE_TTL) {
      return cached.data
    }

    const visited = new Set<string>()

    const build = (currentSpaceId: string, depth: number, parentId?: string): SpaceHierarchyNode[] => {
      if (!this.client) return []
      if (depth > maxDepth) return []
      if (visited.has(currentSpaceId)) return []
      visited.add(currentSpaceId)

      const room = this.client.getRoom(currentSpaceId)
      if (!room) return []

      const childEvents = room.currentState.getStateEvents(EventType.SpaceChild) ?? []
      const nodes: SpaceHierarchyNode[] = []

      for (const event of childEvents) {
        const childRoomId = event.getStateKey()
        if (!childRoomId) continue

        const childRoom = this.client.getRoom(childRoomId)
        if (!childRoom) continue

        const isChildSpace = this.isSpace(childRoom)
        const joinRule = childRoom.currentState.getJoinRule?.() ?? 'private'
        const isPublic = joinRule === 'public'
        const content = event.getContent()

        const node: SpaceHierarchyNode = {
          roomId: childRoomId,
          name: (childRoom.name as string | undefined) ?? childRoomId,
          avatar: childRoom.getMxcAvatarUrl() ?? undefined,
          topic:
            (childRoom.currentState.getStateEvents(EventType.RoomTopic, '')?.getContent()?.topic as
              | string
              | undefined) ?? undefined,
          type: isChildSpace ? 'space' : 'room',
          memberCount: childRoom.getJoinedMemberCount(),
          isPublic,
          parentId,
          depth,
          suggested: (content?.suggested as boolean | undefined) ?? false
        }

        if (isChildSpace && depth < maxDepth) {
          node.children = build(childRoomId, depth + 1, childRoomId)
        }

        nodes.push(node)
      }

      return nodes
    }

    const hierarchy = build(spaceId, 0, spaceId)
    this.cache.spaceHierarchy.set(spaceId, { data: hierarchy, timestamp: now })
    return hierarchy
  }

  async updateSpaceNotificationSettings(
    spaceId: string,
    settings: Partial<SpaceNotificationSettings>
  ): Promise<boolean> {
    if (!this.client) return false

    try {
      const current = await this.getSpaceNotificationSettings(spaceId)
      const merged: SpaceNotificationSettings = { ...current, ...settings }

      const mute = merged.level === 'none' || !merged.enabled
      const mentionsOnly = merged.level === 'mentions'

      await this.client.sendStateEvent(
        spaceId,
        'm.room.notification_settings' as any,
        {
          mute,
          mentions_only: mentionsOnly,
          sound_enabled: merged.soundEnabled,
          keywords: merged.keywords,
          ignore_users: merged.ignoreUsers
        },
        ''
      )
      return true
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixSpacesService] Failed to update notification settings:', error)
      }
      return false
    }
  }

  async searchJoinedSpaces(query: string): Promise<SpaceInfo[]> {
    const list = await this.getSpaceList()
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter((s) => s.name.toLowerCase().includes(q) || s.roomId.toLowerCase().includes(q))
  }

  async searchSpaces(query: string, includePublic = true, limit = 20): Promise<SpaceInfo[]> {
    const joined = await this.searchJoinedSpaces(query)
    if (!includePublic) return joined.slice(0, limit)

    const publicSpaces = await this.searchPublicSpaces(query, limit)
    const map = new Map<string, SpaceInfo>()
    for (const s of [...joined, ...publicSpaces]) map.set(s.roomId, s)
    return Array.from(map.values()).slice(0, limit)
  }

  async leaveSpace(spaceId: string): Promise<boolean> {
    if (!this.client) return false
    try {
      await this.client.leave(spaceId)
      this.invalidateSpaceListCache()
      this.invalidateSpaceRoomsCache(spaceId)
      this.invalidateSpaceMembersCache(spaceId)
      this.cache.spaceHierarchy.delete(spaceId)
      return true
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixSpacesService] Failed to leave space:', error)
      }
      return false
    }
  }

  async joinSpace(spaceId: string): Promise<boolean> {
    if (!this.client) return false
    try {
      await this.client.joinRoom(spaceId)
      this.invalidateSpaceListCache()
      return true
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixSpacesService] Failed to join space:', error)
      }
      return false
    }
  }

  async inviteUserToSpace(spaceId: string, userId: string): Promise<boolean> {
    if (!this.client) return false
    try {
      await this.client.invite(spaceId, userId)
      this.invalidateSpaceMembersCache(spaceId)
      return true
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixSpacesService] Failed to invite user to space:', error)
      }
      return false
    }
  }

  async kickUserFromSpace(spaceId: string, userId: string, reason?: string): Promise<boolean> {
    if (!this.client) return false
    try {
      await this.client.kick(spaceId, userId, reason)
      this.invalidateSpaceMembersCache(spaceId)
      return true
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixSpacesService] Failed to kick user from space:', error)
      }
      return false
    }
  }

  async updateSpaceInfo(spaceId: string, name?: string, topic?: string, avatar?: string): Promise<boolean> {
    if (!this.client) return false
    try {
      if (name !== undefined) {
        await this.client.setRoomName(spaceId, name)
      }
      if (topic !== undefined) {
        await this.client.setRoomTopic(spaceId, topic)
      }
      if (avatar !== undefined) {
        await this.client.sendStateEvent(spaceId, EventType.RoomAvatar, { url: avatar }, '')
      }

      this.invalidateSpaceListCache()
      return true
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixSpacesService] Failed to update space info:', error)
      }
      return false
    }
  }

  async getSpaceInviteLinks(_spaceId: string): Promise<any[]> {
    return []
  }

  async revokeSpaceInviteLink(_spaceId: string, _inviteCode: string): Promise<boolean> {
    return false
  }

  invalidateSpaceListCache(): void {
    this.cache.spaceList = { data: [], timestamp: 0 }
  }

  invalidateSpaceRoomsCache(spaceId?: string): void {
    if (spaceId) {
      this.cache.spaceRooms.delete(spaceId)
    } else {
      this.cache.spaceRooms.clear()
    }
  }

  invalidateSpaceMembersCache(spaceId?: string): void {
    if (spaceId) {
      this.cache.spaceMembers.delete(spaceId)
    } else {
      this.cache.spaceMembers.clear()
    }
  }

  clearAllCache(): void {
    this.cache.spaceList = { data: [], timestamp: 0 }
    this.cache.spaceRooms.clear()
    this.cache.spaceMembers.clear()
    this.cache.spaceHierarchy.clear()
  }
}

export default MatrixSpacesService
export type { SpaceInfo, SpaceRoomInfo, SpaceMemberInfo, SpaceNotificationSettings }
