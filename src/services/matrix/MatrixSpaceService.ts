import MatrixClientService from './MatrixClientService'
import { ref, type Ref } from 'vue'
import type { SpaceInfo, SpaceChild, HierarchicalRoom } from '@/types/matrix-extended'
import { Room, EventType } from '@/lib/matrix-sdk'

export const SpaceLoadingStatus = {
  Idle: 'idle',
  Loading: 'loading',
  Loaded: 'loaded',
  Error: 'error'
}

export type SpaceLoadingStatusValue =
  | typeof SpaceLoadingStatus.Idle
  | typeof SpaceLoadingStatus.Loading
  | typeof SpaceLoadingStatus.Loaded
  | typeof SpaceLoadingStatus.Error

class MatrixSpaceService {
  private static instance: MatrixSpaceService
  private spaces: Map<string, SpaceInfo> = new Map()
  private hierarchyCache: Map<string, HierarchicalRoom[]> = new Map()
  private spaceListeners: Map<string, ((space: SpaceInfo | null) => void)[]> = new Map()

  private _spacesList: Ref<SpaceInfo[]> = ref([])
  private _currentSpace: Ref<SpaceInfo | null> = ref(null)
  private _loadingStatus: Ref<SpaceLoadingStatusValue> = ref(SpaceLoadingStatus.Idle)

  private constructor() {}

  static getInstance(): MatrixSpaceService {
    if (!MatrixSpaceService.instance) {
      MatrixSpaceService.instance = new MatrixSpaceService()
    }
    return MatrixSpaceService.instance
  }

  get spacesList(): Ref<SpaceInfo[]> {
    return this._spacesList
  }

  get currentSpace(): Ref<SpaceInfo | null> {
    return this._currentSpace
  }

  get loadingStatus(): Ref<SpaceLoadingStatusValue> {
    return this._loadingStatus
  }

  async loadSpaces(): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    this._loadingStatus.value = SpaceLoadingStatus.Loading
    this.spaces.clear()
    this._spacesList.value = []

    try {
      const clientRooms = client.getRooms()
      const spaceRooms = clientRooms.filter((room: Room) => room.getType() === 'm.space' || false)

      for (const room of spaceRooms) {
        const spaceInfo = await this.getSpaceInfo(room)
        this.spaces.set(room.roomId, spaceInfo)
      }

      this._spacesList.value = Array.from(this.spaces.values())
      this._loadingStatus.value = SpaceLoadingStatus.Loaded

      this.notifySpaceListeners(null)
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to load spaces:', error)
      }
      this._loadingStatus.value = SpaceLoadingStatus.Error
      throw error
    }
  }

  async getSpaceInfo(room: Room): Promise<SpaceInfo> {
    const currentState = room.currentState
    const nameEvent = currentState.getStateEvents(EventType.RoomName, '')
    const name = (nameEvent?.getContent()?.name as string) ?? (room.name as string) ?? 'Unnamed Space'
    const avatarEvent = currentState.getStateEvents(EventType.RoomAvatar, '')
    const avatarUrl = avatarEvent?.getContent()?.url as string | undefined
    const topicEvent = currentState.getStateEvents(EventType.RoomTopic, '')
    const topic = topicEvent?.getContent()?.topic as string | undefined
    const description = topicEvent?.getContent()?.description as string | undefined

    const joinRule = currentState.getJoinRule() ?? 'private'
    const isPublic = joinRule === 'public'

    let children: SpaceChild[] = []
    let parentIds: string[] = []

    try {
      const hierarchy = await this.loadRoomHierarchy(room.roomId)
      children = hierarchy.map((hr) => ({
        roomId: hr.roomId,
        name: hr.name,
        avatarUrl: hr.avatarUrl,
        type: hr.type as 'direct' | 'public' | 'private' | 'space',
        isPublic: hr.isPublic,
        memberCount: hr.children?.length ?? 0
      }))

      const parentEvents = currentState.getStateEvents(EventType.SpaceParent) ?? []
      parentIds = parentEvents
        .filter((e: any) => e.getContent()?.canonical)
        .map((e: any) => e.getStateKey())
        .filter((id: any): id is string => typeof id === 'string')
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn(`Failed to load hierarchy for space ${room.roomId}:`, error)
      }
    }

    return {
      spaceId: room.roomId,
      name,
      avatarUrl,
      topic,
      description,
      isPublic,
      children,
      parentIds
    }
  }

  async loadRoomHierarchy(spaceId: string): Promise<HierarchicalRoom[]> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      const room = client.getRoom(spaceId)
      if (!room) {
        return []
      }

      const cached = this.hierarchyCache.get(spaceId)
      if (cached) {
        return cached
      }

      const childEvents = room.currentState.getStateEvents(EventType.SpaceChild) ?? []
      const hierarchy: HierarchicalRoom[] = []

      for (const event of childEvents) {
        const childRoomId = event.getStateKey()
        if (!childRoomId) continue

        const content = event.getContent()
        const childRoom = client.getRoom(childRoomId)

        if (childRoom) {
          const roomInfo: HierarchicalRoom = {
            roomId: childRoomId,
            name: childRoom.name || childRoomId,
            avatarUrl: childRoom.getAvatarUrl(client.baseUrl ?? '', 50, 50, 'crop') ?? undefined,
            type: (childRoom.getType() || 'm.room') as HierarchicalRoom['type'],
            isPublic: childRoom.currentState.getJoinRule() === 'public',
            isJoined: childRoom.getMyMembership() === 'join',
            children: [],
            depth: 0,
            via: (Array.isArray(content.via) ? content.via : []) as string[]
          }
          hierarchy.push(roomInfo)
        }
      }

      this.hierarchyCache.set(spaceId, hierarchy)
      return hierarchy
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error(`Failed to load hierarchy for space ${spaceId}:`, error)
      }
      return this.hierarchyCache.get(spaceId) ?? []
    }
  }

  async createSpace(name: string, isPrivate: boolean, inviteUserIds?: string[]): Promise<string | null> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      const result = await client.createRoom({
        name,
        room_version: '10',
        creation_content: {
          type: 'm.space'
        },
        invite: inviteUserIds,
        preset: (isPrivate ? 'private_chat' : 'public_chat') as any,
        initial_state: isPrivate
          ? []
          : [
              {
                type: 'm.room.join_rules',
                content: { join_rule: 'public' }
              }
            ]
      })

      await this.loadSpaces()
      return result.room_id
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to create space:', error)
      }
      throw error
    }
  }

  async addRoomToSpace(spaceId: string, roomId: string, suggested?: boolean): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      const content: Record<string, unknown> = {}
      if (suggested) {
        content.suggested = true
      }
      await client.sendStateEvent(spaceId, EventType.SpaceChild, content, roomId)
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to add room to space:', error)
      }
      throw error
    }
  }

  async removeRoomFromSpace(spaceId: string, roomId: string): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      await client.sendStateEvent(spaceId, EventType.SpaceChild, {}, roomId)
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to remove room from space:', error)
      }
      throw error
    }
  }

  async inviteUserToSpace(spaceId: string, userId: string): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      await client.invite(spaceId, userId)
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to invite user to space:', error)
      }
      throw error
    }
  }

  async kickUserFromSpace(spaceId: string, userId: string, reason?: string): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      await client.kick(spaceId, userId, reason)
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to kick user from space:', error)
      }
      throw error
    }
  }

  async leaveSpace(spaceId: string): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      await client.leave(spaceId)
      this.spaces.delete(spaceId)
      this._spacesList.value = Array.from(this.spaces.values())
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to leave space:', error)
      }
      throw error
    }
  }

  async deleteSpace(spaceId: string): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      await client.forget(spaceId, true)
      this.spaces.delete(spaceId)
      this.hierarchyCache.delete(spaceId)
      this._spacesList.value = Array.from(this.spaces.values())
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to delete space:', error)
      }
      throw error
    }
  }

  onSpaceUpdated(callback: (space: SpaceInfo | null) => void): () => void {
    const listenerId = Math.random().toString(36)
    if (!this.spaceListeners.has(listenerId)) {
      this.spaceListeners.set(listenerId, [])
    }
    this.spaceListeners.get(listenerId)?.push(callback)
    return () => {
      this.spaceListeners.delete(listenerId)
    }
  }

  private notifySpaceListeners(space: SpaceInfo | null): void {
    this.spaceListeners.forEach((listeners) => {
      listeners.forEach((callback) => callback(space))
    })
  }

  async setActiveSpace(spaceId: string | null): Promise<void> {
    if (!spaceId) {
      this._currentSpace.value = null
      return
    }

    const space = this.spaces.get(spaceId)
    if (space) {
      this._currentSpace.value = space
      this.notifySpaceListeners(space)
    }
  }

  async refreshSpace(spaceId: string): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      const room = client.getRoom(spaceId)
      if (!room) {
        return
      }

      const spaceInfo = await this.getSpaceInfo(room)
      this.spaces.set(spaceId, spaceInfo)
      this._spacesList.value = Array.from(this.spaces.values())

      if (this._currentSpace.value?.spaceId === spaceId) {
        this._currentSpace.value = spaceInfo
      }

      this.notifySpaceListeners(spaceInfo)
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to refresh space:', error)
      }
    }
  }

  clearCache(): void {
    this.hierarchyCache.clear()
  }
}

export default MatrixSpaceService
export type { SpaceInfo, SpaceChild, HierarchicalRoom }
