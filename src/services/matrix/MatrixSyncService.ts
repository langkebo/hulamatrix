import { RoomEvent } from 'matrix-js-sdk'
import type { MatrixEvent, Room } from 'matrix-js-sdk'
import MatrixClientService from './MatrixClientService'
import type { SyncState, MatrixSyncResponse, MatrixEventWrapper } from '@/types/matrix'

class MatrixSyncService {
  private static instance: MatrixSyncService
  private syncCallbacks: Set<(state: SyncState) => void> = new Set()
  private eventCallbacks: Set<(event: MatrixEventWrapper) => void> = new Set()
  private roomEventCallbacks: Set<(roomId: string, event: any) => void> = new Set()

  private constructor() {}

  static getInstance(): MatrixSyncService {
    if (!MatrixSyncService.instance) {
      MatrixSyncService.instance = new MatrixSyncService()
    }
    return MatrixSyncService.instance
  }

  setupSyncListeners(): void {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    client.on(
      RoomEvent.Timeline,
      (
        event: MatrixEvent,
        room: Room | undefined,
        _toStartOfTimeline?: boolean,
        _removed?: boolean,
        _data?: unknown
      ) => {
        if (!room) {
          return
        }

        const eventWrapper: MatrixEventWrapper = {
          event,
          roomId: room.roomId,
          isLocal: false
        }

        this.notifyEventCallbacks(eventWrapper)
        this.notifyRoomEventCallbacks(room.roomId, event)
      }
    )

    client.on(RoomEvent.Name, (room: Room) => {
      if (!room) {
        return
      }

      const stateEvents = room.currentState.getStateEvents('')
      const firstEvent = Array.isArray(stateEvents) ? stateEvents[0] : undefined
      if (!firstEvent) {
        return
      }

      const eventWrapper: MatrixEventWrapper = {
        event: firstEvent,
        roomId: room.roomId,
        isLocal: false
      }

      this.notifyEventCallbacks(eventWrapper)
    })

    client.on(RoomEvent.AccountData, (event: MatrixEvent, room: Room) => {
      if (!room) {
        return
      }

      const eventWrapper: MatrixEventWrapper = {
        event,
        roomId: room.roomId,
        isLocal: false
      }

      this.notifyEventCallbacks(eventWrapper)
    })

    client.on(RoomEvent.MyMembership, (room: Room, _membership: string, _prevMembership?: string) => {
      if (!room) {
        return
      }

      const member = room.getMember(room.myUserId)
      if (!member?.events?.member) {
        return
      }

      const eventWrapper: MatrixEventWrapper = {
        event: member.events.member,
        roomId: room.roomId,
        isLocal: false
      }

      this.notifyEventCallbacks(eventWrapper)
    })

    client.on(RoomEvent.Receipt, (event: MatrixEvent, room: Room) => {
      if (!room) {
        return
      }

      const eventWrapper: MatrixEventWrapper = {
        event,
        roomId: room.roomId,
        isLocal: false
      }

      this.notifyEventCallbacks(eventWrapper)
    })
  }

  onSyncStateChange(callback: (state: SyncState) => void): () => void {
    this.syncCallbacks.add(callback)

    const clientService = MatrixClientService.getInstance()
    callback(clientService.getSyncState())

    return () => {
      this.syncCallbacks.delete(callback)
    }
  }

  onEvent(callback: (event: MatrixEventWrapper) => void): () => void {
    this.eventCallbacks.add(callback)
    return () => {
      this.eventCallbacks.delete(callback)
    }
  }

  onRoomEvent(callback: (roomId: string, event: any) => void): () => void {
    this.roomEventCallbacks.add(callback)
    return () => {
      this.roomEventCallbacks.delete(callback)
    }
  }

  private notifyEventCallbacks(event: MatrixEventWrapper): void {
    this.eventCallbacks.forEach((callback) => {
      try {
        callback(event)
      } catch (error) {
        console.error('Error in event callback:', error)
      }
    })
  }

  private notifyRoomEventCallbacks(roomId: string, event: any): void {
    this.roomEventCallbacks.forEach((callback) => {
      try {
        callback(roomId, event)
      } catch (error) {
        console.error('Error in room event callback:', error)
      }
    })
  }

  async forceSync(): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      await client.startClient()
    } catch (error) {
      console.error('Force sync failed:', error)
      throw error
    }
  }

  getSyncToken(): string | null {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      return null
    }

    return client.getSyncState() || null
  }

  async setSyncToken(_token: string): Promise<void> {
    console.warn('setSyncToken is not supported in this version')
  }

  async getSyncResponse(): Promise<MatrixSyncResponse | null> {
    console.warn('getSyncResponse is not supported in this version')
    return null
  }

  async setSyncFilter(_filterId: string): Promise<void> {
    console.warn('setSyncFilter is not supported in this version')
  }

  async createSyncFilter(filter: any): Promise<string> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      const response = await client.createFilter(filter)
      const filterId = response.getFilterId()
      if (!filterId) {
        throw new Error('Failed to get filter ID')
      }
      return filterId
    } catch (error) {
      console.error('Failed to create sync filter:', error)
      throw error
    }
  }

  async getFilter(filterId: string): Promise<any> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      const userId = client.getUserId() || ''
      const response = await client.getFilter(userId, filterId, true)
      return response
    } catch (error) {
      console.error('Failed to get filter:', error)
      throw error
    }
  }

  cleanup(): void {
    this.syncCallbacks.clear()
    this.eventCallbacks.clear()
    this.roomEventCallbacks.clear()
  }
}

export default MatrixSyncService
