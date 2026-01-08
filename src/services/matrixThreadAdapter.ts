/**
 * Matrix SDK Native Thread Adapter
 *
 * This adapter uses Matrix SDK's native thread support instead of custom implementation.
 * Replaces threadService.ts (671 lines) with direct SDK calls.
 *
 * SDK Integration:
 * - room.getThread() - Get thread object
 * - thread.liveTimeline - Thread timeline
 * - client.sendMessage() with m.relates_to - Send thread reply
 */

import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'

// Re-export types for compatibility
export interface ThreadRoot {
  eventId: string
  roomId: string
  senderId: string
  body: Record<string, unknown>
  timestamp: number
  latestEventId: string
  replyCount: number
  participants: string[]
}

export interface ThreadRelation {
  eventId: string
  threadId: string
  rootEventId: string
  isRoot: boolean
  participant: string
}

export interface MatrixRoomLike {
  roomId: string
  timeline?: unknown[] | { getEvents?: () => unknown[] }
  getRelationsForEvent?(eventId: string): { getThread?: () => { id?: string; rootEvent?: unknown } } | undefined
  findEventById?(eventId: string): unknown
  getReadReceiptForUserId?(userId: string): { eventId?: string } | undefined
  getThread?(): { findThreadForEvent?: (eventId: string) => unknown } | undefined
  [key: string]: unknown
}

/**
 * Matrix SDK Native Thread Adapter
 *
 * Uses SDK's native thread support instead of custom caching layer.
 */
class MatrixThreadAdapter {
  private threadEventCallbacks = new Map<
    'created' | 'updated' | 'deleted',
    Set<(data: Record<string, unknown>) => void>
  >()
  private clientEventListeners = new Map<string, () => void>()

  /**
   * Initialize SDK event listeners for thread events
   */
  private initializeEventListeners() {
    const client = matrixClientService.getClient()
    if (!client) return

    // Listen for room events that indicate thread activity
    const onRoomEvent = (event: unknown) => {
      try {
        const eventLike = event as {
          getType?: () => string
          type?: string
          getRoomId?: () => string
          room_id?: string
          getContent?: () => { 'm.relates_to'?: { rel_type?: string } }
          content?: { 'm.relates_to'?: { rel_type?: string } }
        }

        const eventType = eventLike.getType?.() || eventLike.type
        if (eventType !== 'm.room.message') return

        const content = eventLike.getContent?.() || eventLike.content
        const relatesTo = content?.['m.relates_to'] as { rel_type?: string; event_id?: string } | undefined

        // Check if this is a thread-related event
        if (relatesTo?.rel_type === 'm.thread') {
          const roomId = eventLike.getRoomId?.() || eventLike.room_id
          const rootEventId = relatesTo.event_id

          // Emit thread updated event
          this.emitThreadEvent('updated', {
            roomId,
            threadRootId: rootEventId,
            eventId:
              (event as { getId?: () => string; event_id?: string })?.getId?.() ||
              (event as { event_id?: string })?.event_id
          })
        }
      } catch (error) {
        logger.error('[MatrixThreadAdapter] Error handling room event:', error)
      }
    }

    // Register event listener with Matrix client
    const clientWithEvents = client as unknown as {
      on?: (event: string, callback: (event: unknown) => void) => void
    }

    if (clientWithEvents.on) {
      const listener = () => clientWithEvents.on?.('Room.event', onRoomEvent)
      listener()
      this.clientEventListeners.set('Room.event', listener)
    }
  }

  /**
   * Emit thread event to all registered callbacks
   */
  private emitThreadEvent(event: 'created' | 'updated' | 'deleted', data: Record<string, unknown>): void {
    const callbacks = this.threadEventCallbacks.get(event)
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(data)
        } catch (error) {
          logger.error('[MatrixThreadAdapter] Error in thread event callback:', { event, error })
        }
      })
    }
  }
  /**
   * Get thread relation for an event using SDK
   */
  getThreadRelation(eventId: string, room: MatrixRoomLike): ThreadRelation | null {
    try {
      // Validate eventId parameter
      if (!eventId) {
        logger.warn('[MatrixThreadAdapter] Cannot get thread relation - eventId is undefined or empty', {
          eventId,
          roomId: room?.roomId
        })
        return null
      }

      const client = matrixClientService.getClient()
      if (!client) return null

      // Use SDK's native getThread().findThreadForEvent()
      const threadGetter = (room as unknown as Record<string, unknown>).getThread as
        | (() => { findThreadForEvent?: (eventId: string) => unknown })
        | undefined

      if (!threadGetter) {
        // Fallback to old method
        const relations = room.getRelationsForEvent?.(eventId)
        const thread = relations?.getThread?.()

        if (!thread) return null

        const rootEvent = thread.rootEvent as { getId?: () => string; event_id?: string } | undefined
        const rootEventId = rootEvent?.getId?.() || rootEvent?.event_id || eventId

        return {
          eventId,
          threadId: (thread.id as string | undefined) || rootEventId,
          rootEventId,
          isRoot: eventId === rootEventId,
          participant: ''
        }
      }

      const thread = threadGetter().findThreadForEvent?.(eventId)
      if (!thread) return null

      const rootEvent = (thread as unknown as Record<string, unknown>).rootEvent as
        | { getId?: () => string; event_id?: string }
        | undefined

      const rootEventId = rootEvent?.getId?.() || rootEvent?.event_id || eventId
      const threadId = ((thread as unknown as Record<string, unknown>).id as string | undefined) || rootEventId

      return {
        eventId,
        threadId,
        rootEventId,
        isRoot: eventId === rootEventId,
        participant: ''
      }
    } catch (error) {
      logger.error('[MatrixThreadAdapter] Failed to get thread relation:', {
        eventId: eventId || 'undefined',
        roomId: room?.roomId || 'undefined',
        error
      })
      return null
    }
  }

  /**
   * Get thread root info using SDK
   */
  async getThreadRoot(eventId: string, roomId: string): Promise<ThreadRoot | null> {
    try {
      const client = matrixClientService.getClient()
      if (!client) return null

      const getRoomMethod = client.getRoom as ((roomId: string) => Record<string, unknown> | null) | undefined
      const room = getRoomMethod?.(roomId)
      if (!room) return null

      // Use SDK's native thread support
      const thread = (room as unknown as Record<string, unknown>).getThread as
        | (() => { findThreadForEvent?: (eventId: string) => unknown })
        | undefined

      if (!thread) return null

      const threadObj = thread().findThreadForEvent?.(eventId)
      if (!threadObj) return null

      const rootEvent = (threadObj as unknown as Record<string, unknown>).rootEvent as
        | {
            getId?: () => string
            event_id?: string
            sender?: string | { userId?: string }
            origin_server_ts?: number
            content?: Record<string, unknown>
          }
        | undefined

      if (!rootEvent) return null

      const rootEventId = rootEvent?.getId?.() || rootEvent.event_id || eventId
      const senderId =
        typeof rootEvent.sender === 'string'
          ? rootEvent.sender
          : (rootEvent.sender as { userId?: string })?.userId || ''

      // Get thread timeline for reply count
      const timeline = (threadObj as unknown as Record<string, unknown>).liveTimeline as
        | { getEvents?: () => unknown[] }
        | undefined

      const events = timeline?.getEvents?.() || []
      const participants = new Set<string>()
      let latestEventId = eventId
      let replyCount = 0

      for (const event of events) {
        const e = event as { getId?: () => string; event_id?: string; sender?: string | { userId?: string } }
        const eid = e.getId?.() || e.event_id
        const esender = typeof e.sender === 'string' ? e.sender : (e.sender as { userId?: string })?.userId || ''

        if (eid) {
          participants.add(esender)
          latestEventId = eid
          replyCount++
        }
      }

      return {
        eventId: rootEventId,
        roomId,
        senderId,
        body: (rootEvent.content as Record<string, unknown>) || {},
        timestamp: rootEvent.origin_server_ts || Date.now(),
        latestEventId,
        replyCount,
        participants: Array.from(participants)
      }
    } catch (error) {
      logger.error('[MatrixThreadAdapter] Failed to get thread root:', { eventId, roomId, error })
      return null
    }
  }

  /**
   * Get all threads in a room using SDK
   */
  async getRoomThreads(
    roomId: string,
    options?: { limit?: number; sortBy?: 'recent' | 'activity' }
  ): Promise<ThreadRoot[]> {
    try {
      const client = matrixClientService.getClient()
      if (!client) return []

      const getRoomMethod = client.getRoom as ((roomId: string) => Record<string, unknown> | null) | undefined
      const room = getRoomMethod?.(roomId)
      if (!room) return []

      // Get all events from timeline
      const getLiveTimeline = (room as unknown as Record<string, unknown>).getLiveTimeline as
        | (() => { getEvents?: () => unknown[] })
        | undefined

      const timelineObj = getLiveTimeline?.()
      const events = (timelineObj?.getEvents?.() ||
        (room as unknown as Record<string, unknown>).timeline ||
        []) as unknown[]

      // Collect unique threads
      const threadRootMap = new Map<string, ThreadRoot>()
      const processedRoots = new Set<string>()

      for (const event of events) {
        const e = event as { type?: string; getId?: () => string; event_id?: string }
        if (e.type !== 'm.room.message') continue

        const eventId = e.getId?.() || e.event_id
        if (!eventId || processedRoots.has(eventId)) continue

        const relation = this.getThreadRelation(eventId, room as unknown as MatrixRoomLike)
        if (relation && relation.rootEventId && !threadRootMap.has(relation.rootEventId)) {
          const threadRoot = await this.getThreadRoot(eventId, roomId)
          if (threadRoot) {
            threadRootMap.set(relation.rootEventId, threadRoot)
            processedRoots.add(relation.rootEventId)
          }
        }
      }

      let threadRoots = Array.from(threadRootMap.values())

      // Sort by options
      if (options?.sortBy === 'recent') {
        threadRoots.sort((a, b) => b.timestamp - a.timestamp)
      } else if (options?.sortBy === 'activity') {
        threadRoots.sort((a, b) => b.replyCount - a.replyCount)
      }

      // Apply limit
      if (options?.limit) {
        threadRoots = threadRoots.slice(0, options.limit)
      }

      return threadRoots
    } catch (error) {
      logger.error('[MatrixThreadAdapter] Failed to get room threads:', { roomId, error })
      return []
    }
  }

  /**
   * Get thread messages using SDK's native thread timeline
   */
  async getThreadMessages(
    threadRootId: string,
    roomId: string,
    options?: { from?: string; limit?: number; dir?: 'b' | 'f' }
  ): Promise<unknown[]> {
    try {
      const client = matrixClientService.getClient()
      if (!client) return []

      const getRoomMethod = client.getRoom as ((roomId: string) => Record<string, unknown> | null) | undefined
      const room = getRoomMethod?.(roomId)
      if (!room) return []

      // Use SDK's native getThread().findThreadForEvent()
      const thread = (room as unknown as Record<string, unknown>).getThread as
        | (() => { findThreadForEvent?: (eventId: string) => unknown })
        | undefined

      if (!thread) return []

      const threadObj = thread().findThreadForEvent?.(threadRootId)
      if (!threadObj) return []

      // Get thread timeline
      const timeline = (threadObj as unknown as Record<string, unknown>).liveTimeline as
        | { getEvents?: () => unknown[] }
        | undefined

      const events = (timeline?.getEvents?.() || []) as unknown[]

      // Filter and paginate
      let startIndex = 0
      if (options?.from) {
        startIndex = events.findIndex((e: unknown) => {
          const eventId =
            (e as { getId?: () => string; event_id?: string })?.getId?.() || (e as { event_id?: string })?.event_id
          return eventId === options.from
        })
        if (startIndex === -1) return []
      }

      const direction = options?.dir || 'b'
      const endIndex =
        direction === 'b'
          ? Math.min(startIndex + (options?.limit || events.length), events.length)
          : Math.min(startIndex + (options?.limit || 20), events.length)

      const result = events.slice(startIndex, endIndex)

      // Reverse if going backwards
      if (direction === 'b') {
        result.reverse()
      }

      return result
    } catch (error) {
      logger.error('[MatrixThreadAdapter] Failed to get thread messages:', { threadRootId, roomId, error })
      return []
    }
  }

  /**
   * Send thread reply using SDK
   */
  async sendThreadReply(
    threadRootId: string,
    roomId: string,
    type: string | number,
    body: Record<string, unknown> | { text?: string; content?: string; formattedBody?: string }
  ): Promise<string> {
    try {
      const client = matrixClientService.getClient()
      if (!client) throw new Error('Matrix client not initialized')

      // Import MsgEnum for type conversion
      const { MsgEnum } = await import('@/enums')
      const toMsgType = (t: string | number): string => {
        if (typeof t === 'string') return t
        switch (t) {
          case MsgEnum.TEXT:
          case MsgEnum.REPLY:
          case MsgEnum.NOTICE:
            return 'm.text'
          case MsgEnum.IMAGE:
            return 'm.image'
          case MsgEnum.VIDEO:
            return 'm.video'
          case MsgEnum.VOICE:
            return 'm.audio'
          case MsgEnum.FILE:
            return 'm.file'
          case MsgEnum.LOCATION:
            return 'm.location'
          default:
            return 'm.text'
        }
      }

      // Build message content with thread relation
      const content: Record<string, unknown> = {
        msgtype: toMsgType(type),
        body: (body.text || body.content || '') as string,
        'm.relates_to': {
          rel_type: 'm.thread',
          event_id: threadRootId
        }
      }

      if (body.formattedBody) {
        content.formatted_body = body.formattedBody as string
      }

      // Send using SDK
      const sendMessageMethod = client.sendMessage as
        | ((roomId: string, content: Record<string, unknown>) => Promise<{ event_id?: string } | string | unknown>)
        | undefined
      const response = await sendMessageMethod?.(roomId, content)
      const eventId = (response as { event_id?: string })?.event_id || String(response)

      logger.info('[MatrixThreadAdapter] Thread reply sent:', { eventId, threadRootId, roomId })

      return eventId
    } catch (error) {
      logger.error('[MatrixThreadAdapter] Failed to send thread reply:', { threadRootId, roomId, error })
      throw error
    }
  }

  /**
   * Mark thread as read using SDK
   */
  async markThreadAsRead(threadRootId: string, roomId: string): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) return

      const getRoomMethod = client.getRoom as ((roomId: string) => Record<string, unknown> | null) | undefined
      const room = getRoomMethod?.(roomId)
      if (!room) return

      // Get latest message in thread
      const messages = await this.getThreadMessages(threadRootId, roomId, { limit: 1, dir: 'f' })
      if (messages.length === 0) return

      const latestEvent = messages[0] as { getId?: () => string; event_id?: string }
      const eventId = latestEvent?.getId?.() || latestEvent?.event_id

      if (!eventId) return

      // Send read receipt
      await (
        client as unknown as {
          sendReadReceipt?: (room: unknown, event: string | { getId: () => string }) => Promise<unknown>
        }
      ).sendReadReceipt?.(room, eventId)

      logger.debug('[MatrixThreadAdapter] Thread marked as read:', { threadRootId, roomId })
    } catch (error) {
      logger.error('[MatrixThreadAdapter] Failed to mark thread as read:', { threadRootId, roomId, error })
    }
  }

  /**
   * Get thread unread count using SDK
   */
  async getThreadUnreadCount(threadRootId: string, roomId: string, userId?: string): Promise<number> {
    try {
      const client = matrixClientService.getClient()
      if (!client) return 0

      const getRoomMethod = client.getRoom as ((roomId: string) => Record<string, unknown> | null) | undefined
      const room = getRoomMethod?.(roomId)
      if (!room) return 0

      const currentUserId = userId || (client as unknown as { getUserId?: () => string })?.getUserId?.() || ''

      // Get read receipt
      const receipt = (room as unknown as MatrixRoomLike).getReadReceiptForUserId?.(currentUserId)
      const readEventIds = new Set(receipt?.eventId ? [receipt.eventId] : [])

      // Get all thread messages
      const messages = await this.getThreadMessages(threadRootId, roomId)
      let unreadCount = 0

      for (const message of messages) {
        const eventId =
          (message as { getId?: () => string; event_id?: string })?.getId?.() ||
          (message as { event_id?: string })?.event_id ||
          ''
        const sender =
          (message as { getSender?: () => string; sender?: string | { userId?: string } })?.getSender?.() ||
          (message as { sender?: string })?.sender ||
          ((message as { sender?: { userId?: string } }).sender as { userId?: string })?.userId ||
          ''

        if (eventId && !readEventIds.has(eventId) && sender !== currentUserId) {
          unreadCount++
        }
      }

      return unreadCount
    } catch (error) {
      logger.error('[MatrixThreadAdapter] Failed to get thread unread count:', { threadRootId, roomId, error })
      return 0
    }
  }

  /**
   * Invalidate thread cache (no-op for SDK native, kept for compatibility)
   */
  invalidateThreadCache(_roomId?: string, _threadRootId?: string): void {
    // SDK handles caching internally, no-op for compatibility
  }

  /**
   * Thread event listeners
   */
  onThreadEvent(event: 'created' | 'updated' | 'deleted', callback: (data: Record<string, unknown>) => void): void {
    // Initialize event listeners on first registration
    if (this.threadEventCallbacks.size === 0) {
      this.initializeEventListeners()
    }

    // Add callback to event set
    if (!this.threadEventCallbacks.has(event)) {
      this.threadEventCallbacks.set(event, new Set())
    }
    this.threadEventCallbacks.get(event)!.add(callback)

    logger.debug('[MatrixThreadAdapter] Registered thread event callback:', { event })
  }

  /**
   * Remove thread event listener
   */
  offThreadEvent(event: 'created' | 'updated' | 'deleted', callback?: (data: Record<string, unknown>) => void): void {
    const callbacks = this.threadEventCallbacks.get(event)

    if (callbacks) {
      if (callback) {
        // Remove specific callback
        callbacks.delete(callback)
        logger.debug('[MatrixThreadAdapter] Removed thread event callback:', { event })
      } else {
        // Remove all callbacks for this event
        callbacks.clear()
        logger.debug('[MatrixThreadAdapter] Cleared all thread event callbacks:', { event })
      }

      // Clean up if no callbacks remain
      if (callbacks.size === 0) {
        this.threadEventCallbacks.delete(event)
      }
    }
  }

  /**
   * Get thread stats
   */
  getThreadStats(): { cachedThreads: number; cachedRelations: number; threadListeners: Record<string, number> } {
    const listenerCounts: Record<string, number> = {}
    for (const [event, callbacks] of this.threadEventCallbacks.entries()) {
      listenerCounts[event] = callbacks.size
    }

    return {
      cachedThreads: 0,
      cachedRelations: 0,
      threadListeners: listenerCounts
    }
  }

  /**
   * Cleanup event listeners
   */
  cleanup(): void {
    // Clear all event callbacks
    this.threadEventCallbacks.clear()

    // Remove client event listeners
    const client = matrixClientService.getClient()
    if (client) {
      const clientWithEvents = client as unknown as {
        off?: (event: string, callback: () => void) => void
      }

      if (clientWithEvents.off) {
        for (const [event, listener] of this.clientEventListeners) {
          clientWithEvents.off?.(event, listener)
        }
      }
    }

    this.clientEventListeners.clear()

    logger.debug('[MatrixThreadAdapter] Cleaned up event listeners')
  }
}

// Export singleton instance
export const matrixThreadAdapter = new MatrixThreadAdapter()

// Re-export as threadService for drop-in compatibility
export const threadService = matrixThreadAdapter

// Re-export ThreadService class as deprecated
/**
 * @deprecated Use matrixThreadAdapter instead
 */
export class ThreadService extends MatrixThreadAdapter {
  static getInstance() {
    return matrixThreadAdapter
  }
}
