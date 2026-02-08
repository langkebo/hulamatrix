import { type MatrixEvent, NotificationCountType } from '@/lib/matrix-sdk'
import MatrixClientService from './MatrixClientService'
import MatrixSyncService from './MatrixSyncService'
import type { MatrixMessage, MatrixRoom, MatrixUser, MatrixEventWrapper, MessageType } from '@/types/matrix'

class MatrixEventService {
  private static instance: MatrixEventService
  private eventListeners: Map<string, Set<(event: MatrixEventWrapper) => void>> = new Map()
  private messageListeners: Set<(message: MatrixMessage) => void> = new Set()
  private roomListeners: Set<(room: MatrixRoom) => void> = new Set()
  private userListeners: Set<(user: MatrixUser) => void> = new Set()

  private constructor() {}

  static getInstance(): MatrixEventService {
    if (!MatrixEventService.instance) {
      MatrixEventService.instance = new MatrixEventService()
    }
    return MatrixEventService.instance
  }

  setupEventListeners(): void {
    const syncService = MatrixSyncService.getInstance()

    syncService.onEvent((eventWrapper) => {
      this.processEvent(eventWrapper)
    })
  }

  private processEvent(eventWrapper: MatrixEventWrapper): void {
    const { event, roomId: _roomId, isLocal: _isLocal } = eventWrapper

    if (!event) {
      return
    }

    const eventType = event.getType()

    switch (eventType) {
      case 'm.room.message':
        this.handleMessageEvent(eventWrapper)
        break
      case 'm.room.name':
      case 'm.room.topic':
      case 'm.room.avatar':
        this.handleRoomEvent(eventWrapper)
        break
      case 'm.room.member':
        this.handleMemberEvent(eventWrapper)
        break
      case 'm.presence':
        this.handlePresenceEvent(eventWrapper)
        break
      case 'm.reaction':
        this.handleReactionEvent(eventWrapper)
        break
      case 'm.room.redaction':
        this.handleRedactionEvent(eventWrapper)
        break
      default:
        this.handleGenericEvent(eventWrapper)
    }
  }

  private handleMessageEvent(eventWrapper: MatrixEventWrapper): void {
    const { event, roomId } = eventWrapper
    const content = event.getContent()
    const eventId = event.getId()
    const sender = event.getSender()

    const message: MatrixMessage = {
      eventId: eventId ?? `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      roomId,
      sender: sender ?? 'unknown',
      content: {
        body: content.body as string | undefined,
        msgtype: (content.msgtype as MessageType) || 'm.text',
        url: content.url as string | undefined,
        info: content.info as MatrixMessage['content']['info'] | undefined
      },
      status: 'sent',
      timestamp: event.getTs(),
      isLocal: eventWrapper.isLocal || false,
      isEncrypted: event.isEncrypted()
    }

    this.notifyMessageListeners(message)
    this.notifyEventListeners('m.room.message', eventWrapper)
  }

  private handleRoomEvent(eventWrapper: MatrixEventWrapper): void {
    const { event, roomId } = eventWrapper
    const eventType = event.getType()

    if (eventType === 'm.room.name' || eventType === 'm.room.topic' || eventType === 'm.room.avatar') {
      const room = this.getRoomInfo(roomId)
      if (room) {
        this.notifyRoomListeners(room)
      }
    }

    this.notifyEventListeners(eventType, eventWrapper)
  }

  private handleMemberEvent(eventWrapper: MatrixEventWrapper): void {
    const { event } = eventWrapper
    const content = event.getContent()
    const prevContent = event.getPrevContent()

    if (content.membership === 'join' || prevContent?.membership === 'join') {
      const user: MatrixUser = {
        userId: event.getStateKey() || '',
        displayName: content.displayname,
        avatarUrl: content.avatar_url,
        presence: 'online'
      }

      this.notifyUserListeners(user)
    }

    this.notifyEventListeners('m.room.member', eventWrapper)
  }

  private handlePresenceEvent(eventWrapper: MatrixEventWrapper): void {
    const { event } = eventWrapper
    const content = event.getContent()
    const sender = event.getSender()

    const user: MatrixUser = {
      userId: sender ?? 'unknown',
      displayName: content.displayname as string | undefined,
      avatarUrl: content.avatar_url as string | undefined,
      presence: (content.presence as 'online' | 'offline' | 'unavailable') || 'offline',
      lastActiveAgo: content.last_active_ago as number | undefined
    }

    this.notifyUserListeners(user)
    this.notifyEventListeners('m.presence', eventWrapper)
  }

  private handleReactionEvent(eventWrapper: MatrixEventWrapper): void {
    this.notifyEventListeners('m.reaction', eventWrapper)
  }

  private handleRedactionEvent(eventWrapper: MatrixEventWrapper): void {
    this.notifyEventListeners('m.room.redaction', eventWrapper)
  }

  private handleGenericEvent(eventWrapper: MatrixEventWrapper): void {
    const eventType = eventWrapper.event.getType()
    this.notifyEventListeners(eventType, eventWrapper)
  }

  onMessage(callback: (message: MatrixMessage) => void): () => void {
    this.messageListeners.add(callback)
    return () => {
      this.messageListeners.delete(callback)
    }
  }

  onRoom(callback: (room: MatrixRoom) => void): () => void {
    this.roomListeners.add(callback)
    return () => {
      this.roomListeners.delete(callback)
    }
  }

  onUser(callback: (user: MatrixUser) => void): () => void {
    this.userListeners.add(callback)
    return () => {
      this.userListeners.delete(callback)
    }
  }

  onEvent(eventType: string, callback: (event: MatrixEventWrapper) => void): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set())
    }
    this.eventListeners.get(eventType)?.add(callback)
    return () => {
      this.eventListeners.get(eventType)?.delete(callback)
    }
  }

  private notifyMessageListeners(message: MatrixMessage): void {
    this.messageListeners.forEach((callback) => {
      try {
        callback(message)
      } catch (error) {
        console.error('Error in message listener:', error)
      }
    })
  }

  private notifyRoomListeners(room: MatrixRoom): void {
    this.roomListeners.forEach((callback) => {
      try {
        callback(room)
      } catch (error) {
        console.error('Error in room listener:', error)
      }
    })
  }

  private notifyUserListeners(user: MatrixUser): void {
    this.userListeners.forEach((callback) => {
      try {
        callback(user)
      } catch (error) {
        console.error('Error in user listener:', error)
      }
    })
  }

  private notifyEventListeners(eventType: string, event: MatrixEventWrapper): void {
    const listeners = this.eventListeners.get(eventType)
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(event)
        } catch (error) {
          console.error(`Error in ${eventType} listener:`, error)
        }
      })
    }
  }

  convertMatrixEventToMessage(event: MatrixEvent, roomId: string): MatrixMessage | null {
    if (event.getType() !== 'm.room.message') {
      return null
    }

    const content = event.getContent()
    const eventId = event.getId()
    const sender = event.getSender()

    return {
      eventId: eventId ?? `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      roomId,
      sender: sender ?? 'unknown',
      content: {
        body: content.body as string | undefined,
        msgtype: (content.msgtype as MessageType) || 'm.text',
        url: content.url as string | undefined,
        info: content.info as MatrixMessage['content']['info'] | undefined
      },
      status: 'sent',
      timestamp: event.getTs(),
      isLocal: false,
      isEncrypted: event.isEncrypted()
    }
  }

  convertMatrixEventToRoom(_event: MatrixEvent, roomId: string): MatrixRoom | null {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      return null
    }

    const room = client.getRoom(roomId)
    if (!room) {
      return null
    }

    return this.getRoomInfo(roomId)
  }

  private getRoomInfo(roomId: string): MatrixRoom | null {
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

  async persistEvent(event: MatrixEvent, roomId: string): Promise<void> {
    try {
      const eventWrapper: MatrixEventWrapper = {
        event,
        roomId,
        isLocal: false
      }

      const serializedEvent = JSON.stringify(eventWrapper)

      localStorage.setItem(`matrix_event_${event.getId()}`, serializedEvent)
    } catch (error) {
      console.error('Failed to persist event:', error)
    }
  }

  async retrieveEvent(eventId: string): Promise<MatrixEventWrapper | null> {
    try {
      const serializedEvent = localStorage.getItem(`matrix_event_${eventId}`)
      if (!serializedEvent) {
        return null
      }

      return JSON.parse(serializedEvent) as MatrixEventWrapper
    } catch (error) {
      console.error('Failed to retrieve event:', error)
      return null
    }
  }

  async deleteEvent(eventId: string): Promise<void> {
    try {
      localStorage.removeItem(`matrix_event_${eventId}`)
    } catch (error) {
      console.error('Failed to delete event:', error)
    }
  }

  async clearPersistedEvents(): Promise<void> {
    try {
      const keys = Object.keys(localStorage)
      const eventKeys = keys.filter((key) => key.startsWith('matrix_event_'))

      eventKeys.forEach((key) => {
        localStorage.removeItem(key)
      })
    } catch (error) {
      console.error('Failed to clear persisted events:', error)
    }
  }

  getEventHistory(roomId: string, limit: number = 100): MatrixEvent[] {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      return []
    }

    const room = client.getRoom(roomId)
    if (!room) {
      return []
    }

    const timeline = room.getLiveTimeline()
    const events = timeline.getEvents()

    return events.slice(-limit)
  }

  getEventById(eventId: string): MatrixEvent | null {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      return null
    }

    const rooms = client.getRooms() || []

    for (const room of rooms) {
      const event = room.findEventById(eventId)
      if (event) {
        return event
      }
    }

    return null
  }

  getRelatedEvents(eventId: string, relationType?: string): MatrixEvent[] {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      return []
    }

    const rooms = client.getRooms() || []
    const relatedEvents: MatrixEvent[] = []

    for (const room of rooms) {
      const timeline = room.getLiveTimeline()
      const events = timeline.getEvents()

      for (const event of events) {
        const relation = event.getRelation()
        if (relation && relation.event_id === eventId) {
          if (!relationType || relation.rel_type === relationType) {
            relatedEvents.push(event)
          }
        }
      }
    }

    return relatedEvents
  }

  getReactions(eventId: string): Map<string, number> {
    const reactions = new Map<string, number>()
    const relatedEvents = this.getRelatedEvents(eventId, 'm.annotation')

    for (const event of relatedEvents) {
      const content = event.getContent()
      const key = content['m.relates_to']?.key

      if (key) {
        reactions.set(key, (reactions.get(key) || 0) + 1)
      }
    }

    return reactions
  }

  getEdits(eventId: string): MatrixEvent[] {
    return this.getRelatedEvents(eventId, 'm.replace')
  }

  getReplies(eventId: string): MatrixEvent[] {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      return []
    }

    const rooms = client.getRooms() || []
    const replies: MatrixEvent[] = []

    for (const room of rooms) {
      const timeline = room.getLiveTimeline()
      const events = timeline.getEvents()

      for (const event of events) {
        const content = event.getContent()
        const inReplyTo = content['m.relates_to']?.['m.in_reply_to']?.event_id

        if (inReplyTo === eventId) {
          replies.push(event)
        }
      }
    }

    return replies
  }

  cleanup(): void {
    this.eventListeners.clear()
    this.messageListeners.clear()
    this.roomListeners.clear()
    this.userListeners.clear()
  }

  // ========== MSC4354: Sticky Events Support ==========

  /**
   * Get all sticky events for a room
   * Sticky events are state events that persist across room state changes
   */
  getStickyEvents(roomId: string): Map<string, MatrixEvent> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      return new Map()
    }

    const room = client.getRoom(roomId)
    if (!room) {
      return new Map()
    }

    const stickyEvents = new Map<string, MatrixEvent>()
    const currentState = room.currentState

    // Common sticky event types
    const stickyEventTypes = [
      'm.room.create',
      'm.room.power_levels',
      'm.room.join_rules',
      'm.room.name',
      'm.room.topic',
      'm.room.avatar',
      'm.room.encryption',
      'm.room.history_visibility',
      'm.room.guest_access',
      'm.room.pinned_events',
      'm.room.tombstone',
      'm.room.server_acl',
      // MSC4354: m.rtc.member is also a sticky event
      'm.rtc.member',
      // Safety settings
      'm.room.safety_settings'
    ]

    for (const eventType of stickyEventTypes) {
      const events = currentState.getStateEvents(eventType)
      if (events && events.length > 0) {
        // Get the most recent event for each type
        stickyEvents.set(eventType, events[0])
      }
    }

    return stickyEvents
  }

  /**
   * Get a specific sticky event from a room
   */
  getStickyEvent(roomId: string, eventType: string, stateKey = ''): MatrixEvent | null {
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

    try {
      const events = currentState.getStateEvents(eventType as any, stateKey) as any
      if (events && Array.isArray(events) && events.length > 0) {
        return events[0]
      }
      return null
    } catch (_error) {
      // Event type might not be registered
      return null
    }
  }

  /**
   * Set a sticky event (state event) in a room
   */
  async setStickyEvent(roomId: string, eventType: string, content: Record<string, any>, stateKey = ''): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      await client.sendStateEvent(roomId, eventType as any, content, stateKey)
    } catch (error) {
      console.error(`[MatrixEventService] Failed to set sticky event ${eventType}:`, error)
      throw error
    }
  }

  /**
   * Delete a sticky event from a room
   */
  async deleteStickyEvent(roomId: string, eventType: string, stateKey = ''): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      // Delete by setting empty content
      await client.sendStateEvent(roomId, eventType as any, {}, stateKey)
    } catch (error) {
      console.error(`[MatrixEventService] Failed to delete sticky event ${eventType}:`, error)
      throw error
    }
  }

  /**
   * Get all m.rtc.member sticky events (MSC4354)
   */
  getRTCMembers(roomId: string): Map<string, MatrixEvent> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      return new Map()
    }

    const room = client.getRoom(roomId)
    if (!room) {
      return new Map()
    }

    const rtcMembers = new Map<string, MatrixEvent>()
    const currentState = room.currentState

    try {
      const events = currentState.getStateEvents('m.rtc.member' as any)

      if (events && Array.isArray(events)) {
        for (const event of events) {
          const userId = event.getStateKey()
          if (userId) {
            rtcMembers.set(userId, event)
          }
        }
      }
    } catch (error) {
      // Event type might not be registered, return empty map
      console.debug('[MatrixEventService] m.rtc.member events not available:', error)
    }

    return rtcMembers
  }

  /**
   * Get room safety settings sticky event
   */
  getRoomSafetySettings(roomId: string): Record<string, any> | null {
    const event = this.getStickyEvent(roomId, 'm.room.safety_settings', '')
    return event ? event.getContent() : null
  }

  /**
   * Update room safety settings sticky event
   */
  async updateRoomSafetySettings(
    roomId: string,
    settings: {
      enabled?: boolean
      severity_filter?: string[]
      auto_block?: boolean
    }
  ): Promise<void> {
    const currentSettings = this.getRoomSafetySettings(roomId) || {}
    const updatedSettings = { ...currentSettings, ...settings }

    await this.setStickyEvent(roomId, 'm.room.safety_settings', updatedSettings, '')
  }

  /**
   * Get encrypted state events (experimental feature)
   */
  getEncryptedStateEvents(roomId: string): MatrixEvent[] {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      return []
    }

    const room = client.getRoom(roomId)
    if (!room) {
      return []
    }

    const currentState = room.currentState
    const encryptedEvents: MatrixEvent[] = []

    // Check for encrypted state events
    const stateEvents = currentState.getStateEvents('m.room.encrypted')
    if (stateEvents) {
      encryptedEvents.push(...stateEvents)
    }

    return encryptedEvents
  }
}

export default MatrixEventService
