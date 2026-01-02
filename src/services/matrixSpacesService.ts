/**
 * Matrix Spaces Service
 * Handles Matrix spaces (communities) management and hierarchy
 */

import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'

// Type definitions for Matrix SDK client and room objects
export interface MatrixClientLike {
  baseUrl?: string
  getRoom(roomId: string): MatrixRoomLike | undefined
  getRooms(): MatrixRoomLike[]
  createRoom(options: Record<string, unknown>): Promise<CreateRoomResultLike>
  sendStateEvent(
    roomId: string,
    eventType: string,
    content: Record<string, unknown>,
    stateKey?: string
  ): Promise<unknown>
  uploadContent(file: File): Promise<{ content_uri: string }>
  joinRoom(roomId: string): Promise<unknown>
  leave(roomId: string): Promise<unknown>
  invite(roomId: string, userId: string): Promise<unknown>
}

interface MatrixRoomLike {
  roomId: string
  name?: string
  currentState?: {
    getStateEvents?(eventType: string): Record<string, unknown> | MatrixEventLike[] | unknown
  }
  getAvatarUrl?(
    baseUrl: string,
    width: number,
    height: number,
    resizeMethod: string,
    allowDefault: boolean,
    allowDirectLinks: boolean
  ): string
  hasEncryptionStateEvent?(): boolean
  getJoinRule?(): string
  getGuestAccess?(): string
  getHistoryVisibility?(): string
  getJoinedMemberCount?(): number
  getJoinedMembers?(): MatrixMemberLike[]
}

interface MatrixEventLike {
  getStateKey?(): string
  stateKey?: string
  getContent?(): Record<string, unknown>
  getTs?(): number
  getSender?(): string
  getType?(): string
}

interface MatrixMemberLike {
  userId: string
  name?: string
  powerLevel?: number
  membership?: string
  getAvatarUrl?(
    baseUrl: string,
    width: number,
    height: number,
    resizeMethod: string,
    allowDefault: boolean,
    allowDirectLinks: boolean
  ): string
}

interface CreateRoomResultLike {
  room_id?: string
  roomId?: string
  [key: string]: unknown
}

export interface SpaceInfo {
  roomId: string
  name: string
  topic?: string
  avatar?: string
  type: string
  encrypted: boolean
  joinRule: 'public' | 'invite' | 'knock' | 'restricted'
  guestAccess: 'can_join' | 'forbidden'
  historyVisibility: 'world_readable' | 'shared' | 'invited' | 'joined'
  memberCount?: number
  parents: SpaceParent[]
  children: SpaceChild[]
  members: SpaceMember[]
  spaceType: 'space' | 'room' | 'dm'
  created?: number
  creator?: string
}

export interface SpaceParent {
  roomId: string
  via: string[]
  canonical?: boolean
  accepted?: boolean
}

export interface SpaceChild {
  roomId: string
  type: 'room' | 'space'
  name?: string
  topic?: string
  avatar?: string
  memberCount?: number
  worldReadable?: boolean
  guestCanJoin?: boolean
  suggested?: boolean
  order?: string
  via: string[]
}

export interface SpaceMember {
  userId: string
  displayName?: string
  avatarUrl?: string
  powerLevel?: number
  membership: 'join' | 'invite' | 'leave'
  invited?: boolean
}

export interface CreateSpaceOptions {
  name: string
  topic?: string
  avatar?: File
  visibility: 'public' | 'private'
  preset?: 'public_chat' | 'private_chat' | 'trusted_private_chat'
  invite?: string[]
  powerLevelContentOverride?: number
}

/**
 * Matrix Spaces Service
 */
export class MatrixSpacesService {
  private static instance: MatrixSpacesService
  private spaces = new Map<string, SpaceInfo>()
  private spaceHierarchy = new Map<string, string[]>() // roomId -> parent roomIds

  static getInstance(): MatrixSpacesService {
    if (!MatrixSpacesService.instance) {
      MatrixSpacesService.instance = new MatrixSpacesService()
    }
    return MatrixSpacesService.instance
  }

  /**
   * Initialize the spaces service
   */
  async initialize(): Promise<void> {
    try {
      logger.info('[MatrixSpacesService] Initializing spaces service')

      // Load existing spaces
      await this.loadSpaces()

      logger.info('[MatrixSpacesService] Spaces service initialized')
    } catch (error) {
      logger.error('[MatrixSpacesService] Failed to initialize spaces service:', error)
      throw error
    }
  }

  /**
   * Create a new space
   */
  async createSpace(options: CreateSpaceOptions): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not available')
    }

    try {
      logger.info('[MatrixSpacesService] Creating space', { name: options.name })

      const content: Record<string, unknown> = {
        name: options.name,
        visibility: options.visibility,
        preset: options.preset || 'private_chat',
        creation_content: {
          'm.federate': true,
          type: 'm.space'
        }
      }

      if (options.topic !== undefined) {
        content.topic = options.topic
      }

      // Add initial invitees
      if (options.invite && options.invite.length > 0) {
        content.invite = options.invite
        content.invite_3pid = []
      }

      const createRoomMethod = client.createRoom as
        | ((opts: Record<string, unknown>) => Promise<CreateRoomResultLike | undefined>)
        | undefined
      const createRes = await createRoomMethod?.({
        ...content,
        power_level_content_override: options.powerLevelContentOverride
      } as Record<string, unknown>)
      const roomId: string = createRes?.room_id || createRes?.roomId || ''

      // Add avatar if provided
      if (options.avatar) {
        try {
          await this.setSpaceAvatar(roomId, options.avatar)
        } catch (e) {
          logger.error('[MatrixSpacesService] Failed to set space avatar, continuing', e)
        }
      }

      // Load the newly created space
      await this.loadSpace(roomId)

      logger.info('[MatrixSpacesService] Space created successfully', { roomId, name: options.name })

      return roomId
    } catch (error) {
      logger.error('[MatrixSpacesService] Failed to create space:', error)
      throw error
    }
  }

  /**
   * Add a room or space to a space
   */
  async addChildToSpace(parentSpaceId: string, childRoomId: string, order?: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not available')
    }

    try {
      logger.info('[MatrixSpacesService] Adding child to space', {
        parentSpaceId,
        childRoomId,
        order
      })

      const getRoomMethod = client.getRoom as ((roomId: string) => Record<string, unknown> | null) | undefined
      const room = getRoomMethod?.(parentSpaceId)
      if (!room) {
        throw new Error('Parent space not found')
      }

      // Get room state to find via servers
      const via: string[] = []
      const sendStateEventMethod = client.sendStateEvent as (
        roomId: string,
        eventType: string,
        content: Record<string, unknown>,
        stateKey?: string
      ) => Promise<unknown>
      await sendStateEventMethod?.(
        parentSpaceId,
        'm.space.child',
        {
          via,
          order,
          suggested: false
        },
        childRoomId
      )

      // Update hierarchy
      this.updateHierarchy(parentSpaceId, childRoomId)

      logger.info('[MatrixSpacesService] Child added to space successfully')
    } catch (error) {
      logger.error('[MatrixSpacesService] Failed to add child to space:', error)
      throw error
    }
  }

  /**
   * Remove a room or space from a space
   */
  async removeChildFromSpace(parentSpaceId: string, childRoomId: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not available')
    }

    try {
      logger.info('[MatrixSpacesService] Removing child from space', {
        parentSpaceId,
        childRoomId
      })

      await (
        client.sendStateEvent as (
          roomId: string,
          eventType: string,
          content: Record<string, unknown>,
          stateKey?: string
        ) => Promise<unknown>
      )?.(parentSpaceId, 'm.space.child', {}, childRoomId)

      // Update hierarchy
      this.removeFromHierarchy(parentSpaceId, childRoomId)

      logger.info('[MatrixSpacesService] Child removed from space successfully')
    } catch (error) {
      logger.error('[MatrixSpacesService] Failed to remove child from space:', error)
      throw error
    }
  }

  /**
   * Set space avatar
   */
  async setSpaceAvatar(roomId: string, avatar: File): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not available')
    }

    try {
      logger.info('[MatrixSpacesService] Setting space avatar', { roomId, size: avatar.size })

      const uploadResponse = await (
        (client as unknown as Record<string, unknown>).uploadContent as
          | ((file: File) => Promise<{ content_uri: string }>)
          | undefined
      )?.(avatar)
      const avatarUrl = uploadResponse?.content_uri

      if (!avatarUrl) return ''

      await (
        client.sendStateEvent as (
          roomId: string,
          eventType: string,
          content: Record<string, unknown>,
          stateKey?: string
        ) => Promise<unknown>
      )?.(roomId, 'm.room.avatar', {
        url: avatarUrl
      })

      // Update cached space
      const space = this.spaces.get(roomId)
      if (space) {
        space.avatar = avatarUrl
      }

      logger.info('[MatrixSpacesService] Space avatar set successfully')
      return avatarUrl
    } catch (error) {
      logger.error('[MatrixSpacesService] Failed to set space avatar:', error)
      throw error
    }
  }

  /**
   * Load a specific space
   */
  async loadSpace(roomId: string): Promise<SpaceInfo | null> {
    const client = matrixClientService.getClient()
    if (!client) {
      return null
    }

    try {
      const getRoomMethod = client.getRoom as ((roomId: string) => Record<string, unknown> | null) | undefined
      const room = getRoomMethod?.(roomId)
      if (!room) {
        return null
      }

      // Check if this is a space
      const currentStateLike = room.currentState as Record<string, unknown> | undefined
      const stateCreateArr = currentStateLike?.getStateEvents
        ? (currentStateLike.getStateEvents as ((type: string) => unknown) | undefined)?.('m.room.create') || {}
        : {}
      const createEvent: MatrixEventLike | undefined = (
        Array.isArray(stateCreateArr) ? stateCreateArr[0] : Object.values(stateCreateArr as Record<string, unknown>)[0]
      ) as MatrixEventLike | undefined

      const isSpace = createEvent?.getContent?.()?.type === 'm.space'

      if (!isSpace) {
        // This is a regular room, not a space
        return null
      }

      // Get space name and topic
      const state = room.currentState as Record<string, unknown> | undefined
      const getStateArray = (type: string): MatrixEventLike[] => {
        const getStateEventsMethod = state?.getStateEvents as ((type: string) => unknown) | undefined
        const map = getStateEventsMethod?.(type) || {}
        return Array.isArray(map)
          ? (map as unknown as MatrixEventLike[])
          : (Object.values(map as Record<string, unknown>) as unknown as MatrixEventLike[])
      }
      const firstState = (type: string): MatrixEventLike | null => {
        const arr = getStateArray(type)
        return arr.length > 0 ? (arr[0] ?? null) : null
      }
      const nameEvent = firstState('m.room.name')
      const topicEvent = firstState('m.room.topic')
      const avatarEvent = firstState('m.room.avatar')

      // Get child rooms/spaces
      const childEvents = getStateArray('m.space.child')
      const children: SpaceChild[] = []

      const baseUrl: string = (client.baseUrl as string) || ''
      for (const childEvent of childEvents) {
        const childId: string = childEvent.getStateKey?.() || childEvent.stateKey || ''
        const content: Record<string, unknown> = (childEvent.getContent?.() || {}) as Record<string, unknown>
        const getRoomMethod = client.getRoom as ((roomId: string) => Record<string, unknown> | null) | undefined
        const childRoom = childId ? getRoomMethod?.(childId) : null
        if (childRoom) {
          const avatar =
            (
              (childRoom as unknown as Record<string, unknown>).getAvatarUrl as
                | ((
                    baseUrl: string,
                    width: number,
                    height: number,
                    resizeMethod: string,
                    allowDefault: boolean,
                    allowDirectLinks: boolean
                  ) => string)
                | undefined
            )?.(baseUrl, 48, 48, 'crop', true, true) || undefined
          const childResult: SpaceChild = {
            roomId: childId,
            type: this.isSpace(childRoom as unknown as MatrixRoomLike) ? 'space' : 'room',
            name: (childRoom.name as string | undefined) || childId,
            memberCount:
              (
                (childRoom as unknown as Record<string, unknown>).getJoinedMemberCount as (() => number) | undefined
              )?.() || 0,
            worldReadable: false,
            guestCanJoin:
              (((childRoom as unknown as Record<string, unknown>).getGuestAccess as (() => string) | undefined)?.() ||
                'forbidden') === 'can_join',
            via: (content.via as string[]) || [],
            suggested: !!content.suggested
          }
          if (avatar !== undefined) childResult.avatar = avatar
          if (content.order !== undefined) childResult.order = content.order as string
          children.push(childResult)
        }
      }

      // Get joined members
      const members: SpaceMember[] = []
      const joinedMembers =
        ((room as unknown as Record<string, unknown>).getJoinedMembers as (() => MatrixMemberLike[]) | undefined)?.() ||
        []
      for (const member of joinedMembers) {
        const avatar =
          (
            (member as unknown as Record<string, unknown>).getAvatarUrl as
              | ((
                  baseUrl: string,
                  width: number,
                  height: number,
                  resizeMethod: string,
                  allowDefault: boolean,
                  allowDirectLinks: boolean
                ) => string)
              | undefined
          )?.(baseUrl, 48, 48, 'crop', true, true) || undefined
        const memberResult: SpaceMember = {
          userId: member.userId,
          displayName: member.name || member.userId,
          powerLevel: member.powerLevel || 0,
          membership: 'join',
          invited: false
        }
        if (avatar !== undefined) memberResult.avatarUrl = avatar
        members.push(memberResult)
      }

      // Get parent spaces
      const parents: SpaceParent[] = []
      const parentEvents = getStateArray('m.space.parent')

      for (const parentEvent of parentEvents) {
        const pid: string = parentEvent.getStateKey?.() || parentEvent.stateKey || ''
        const pcontent: Record<string, unknown> = (parentEvent.getContent?.() || {}) as Record<string, unknown>
        parents.push({
          roomId: pid,
          via: (pcontent.via as string[]) || [],
          canonical: pcontent.canonical as boolean | undefined,
          accepted: pcontent.accepted as boolean | undefined
        } as SpaceParent)
      }

      const space: SpaceInfo = {
        roomId,
        name:
          ((nameEvent as MatrixEventLike | undefined)?.getContent as (() => { name?: string }) | undefined)?.()?.name ||
          (room.name as string | undefined) ||
          roomId,
        type: 'm.space',
        encrypted:
          ((room as unknown as Record<string, unknown>).hasEncryptionStateEvent as (() => boolean) | undefined)?.() ??
          false,
        joinRule: (((room as unknown as Record<string, unknown>).getJoinRule as (() => string) | undefined)?.() ||
          'invite') as 'public' | 'invite' | 'knock' | 'restricted',
        guestAccess: (((room as unknown as Record<string, unknown>).getGuestAccess as (() => string) | undefined)?.() ||
          'forbidden') as 'can_join' | 'forbidden',
        historyVisibility: ((
          (room as unknown as Record<string, unknown>).getHistoryVisibility as (() => string) | undefined
        )?.() || 'shared') as 'world_readable' | 'shared' | 'invited' | 'joined',
        parents,
        children,
        members,
        spaceType: 'space'
      }
      const topicValue = (
        (topicEvent as MatrixEventLike | undefined)?.getContent as (() => { topic?: string }) | undefined
      )?.()?.topic
      if (topicValue !== undefined) space.topic = topicValue
      const avatarUrlFromEvent = (
        (avatarEvent as MatrixEventLike | undefined)?.getContent as (() => { url?: string }) | undefined
      )?.()?.url
      const getAvatarUrlMethod = room.getAvatarUrl as
        | ((
            baseUrl: string,
            width: number,
            height: number,
            resizeMethod: string,
            allowDefault: boolean,
            allowDirectLinks: boolean
          ) => string)
        | undefined
      const avatarUrlFromRoom = getAvatarUrlMethod?.(baseUrl, 64, 64, 'crop', true, true)
      const avatarUrl = avatarUrlFromEvent ?? avatarUrlFromRoom
      if (avatarUrl !== undefined && avatarUrl !== null) space.avatar = avatarUrl
      const getMemberCount = (room as unknown as Record<string, unknown>).getJoinedMemberCount as
        | (() => number)
        | undefined
      const memberCount = getMemberCount?.()
      if (memberCount !== undefined) space.memberCount = memberCount
      const createdTs = createEvent?.getTs?.()
      if (createdTs !== undefined) space.created = createdTs
      const creatorValue = createEvent?.getSender?.()
      if (creatorValue !== undefined) space.creator = creatorValue

      // Cache the space
      this.spaces.set(roomId, space)

      // Update hierarchy
      this.updateHierarchyForSpace(space)

      return space
    } catch (error) {
      logger.error('[MatrixSpacesService] Failed to load space:', error)
      return null
    }
  }

  /**
   * Load all spaces the user is a member of
   */
  async loadSpaces(): Promise<SpaceInfo[]> {
    const client = matrixClientService.getClient()
    if (!client) {
      return []
    }

    try {
      logger.info('[MatrixSpacesService] Loading all spaces')

      const getRoomsMethod = client.getRooms as (() => { roomId: string }[]) | undefined
      const rooms = getRoomsMethod?.() || []
      const spaces: SpaceInfo[] = []

      for (const room of rooms) {
        const space = await this.loadSpace(room.roomId)
        if (space) {
          spaces.push(space)
        }
      }

      // Sort spaces by name
      spaces.sort((a, b) => (a.name || '').localeCompare(b.name || ''))

      logger.info('[MatrixSpacesService] Spaces loaded', { count: spaces.length })
      return spaces
    } catch (error) {
      logger.error('[MatrixSpacesService] Failed to load spaces:', error)
      return []
    }
  }

  /**
   * Get space by ID
   */
  getSpace(roomId: string): SpaceInfo | null {
    return this.spaces.get(roomId) || null
  }

  /**
   * Get all spaces
   */
  getSpaces(): SpaceInfo[] {
    return Array.from(this.spaces.values())
  }

  /**
   * Get top-level spaces (spaces with no parents)
   */
  getTopLevelSpaces(): SpaceInfo[] {
    return this.getSpaces().filter((space) => space.parents.length === 0)
  }

  /**
   * Get space hierarchy
   */
  getSpaceHierarchy(
    roomId: string,
    level = 0
  ): {
    space: SpaceInfo
    level: number
    children: Array<{ space: SpaceInfo; level: number; children: unknown[] } | null>
  } | null {
    const space = this.getSpace(roomId)
    if (!space) {
      return null
    }

    return {
      space,
      level,
      children: space.children
        .map((child) => this.getSpaceHierarchy(child.roomId, level + 1))
        .filter((h): h is NonNullable<typeof h> => h !== null)
    }
  }

  /**
   * Check if a room is a space
   */
  private isSpace(room: MatrixRoomLike): boolean {
    const state = room.currentState
    const map = state?.getStateEvents?.('m.room.create') || {}
    const createEvent: MatrixEventLike | undefined = Array.isArray(map)
      ? map[0]
      : (Object.values(map as Record<string, unknown>)[0] as MatrixEventLike | undefined)
    return createEvent?.getContent?.()?.type === 'm.space'
  }

  /**
   * Update hierarchy cache
   */
  private updateHierarchy(parentId: string, childId: string): void {
    if (!this.spaceHierarchy.has(childId)) {
      this.spaceHierarchy.set(childId, [])
    }

    const parents = this.spaceHierarchy.get(childId)!
    if (!parents.includes(parentId)) {
      parents.push(parentId)
    }
  }

  /**
   * Remove from hierarchy
   */
  private removeFromHierarchy(parentId: string, childId: string): void {
    if (this.spaceHierarchy.has(childId)) {
      const parents = this.spaceHierarchy.get(childId)!
      const index = parents.indexOf(parentId)
      if (index > -1) {
        parents.splice(index, 1)
      }
    }
  }

  /**
   * Update hierarchy for space
   */
  private updateHierarchyForSpace(space: SpaceInfo): void {
    // Clear existing hierarchy
    this.spaceHierarchy.delete(space.roomId)

    // Add parent relationships
    for (const parent of space.parents) {
      this.updateHierarchy(parent.roomId, space.roomId)
    }
  }

  /**
   * Search spaces
   */
  async searchSpaces(query: string): Promise<SpaceInfo[]> {
    const spaces = this.getSpaces()

    if (!query) {
      return spaces
    }

    const lowerQuery = query.toLowerCase()
    return spaces.filter(
      (space) => space.name?.toLowerCase().includes(lowerQuery) || space.topic?.toLowerCase().includes(lowerQuery)
    )
  }

  /**
   * Join a space
   */
  async joinSpace(roomId: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not available')
    }

    try {
      logger.info('[MatrixSpacesService] Joining space', { roomId })
      const joinRoomMethod = client.joinRoom as ((roomId: string) => Promise<unknown>) | undefined
      await joinRoomMethod?.(roomId)

      // Load the space after joining
      await this.loadSpace(roomId)
    } catch (error) {
      logger.error('[MatrixSpacesService] Failed to join space:', error)
      throw error
    }
  }

  /**
   * Leave a space
   */
  async leaveSpace(roomId: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not available')
    }

    try {
      logger.info('[MatrixSpacesService] Leaving space', { roomId })
      const leaveMethod = client.leave as ((roomId: string) => Promise<unknown>) | undefined
      await leaveMethod?.(roomId)

      // Remove from cache
      this.spaces.delete(roomId)
      this.spaceHierarchy.delete(roomId)
    } catch (error) {
      logger.error('[MatrixSpacesService] Failed to leave space:', error)
      throw error
    }
  }

  /**
   * Invite user to space
   */
  async inviteToSpace(roomId: string, userId: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not available')
    }

    try {
      logger.info('[MatrixSpacesService] Inviting user to space', { roomId, userId })
      const inviteMethod = client.invite as ((roomId: string, userId: string) => Promise<unknown>) | undefined
      await inviteMethod?.(roomId, userId)
    } catch (error) {
      logger.error('[MatrixSpacesService] Failed to invite user to space:', error)
      throw error
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.spaces.clear()
    this.spaceHierarchy.clear()
    logger.info('[MatrixSpacesService] Cache cleared')
  }
}

// Export singleton instance
export const matrixSpacesService = MatrixSpacesService.getInstance()
