/**
 * Matrix Presence and Typing Service
 * Unified service for managing presence, typing indicators, and read receipts
 *
 * @see docs/matrix-sdk/08-presence-typing.md
 */

import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'

// ==================== Type Definitions ====================

/** Presence state types */
export type PresenceState = 'online' | 'offline' | 'unavailable' | 'unknown'

/** Presence information */
export interface PresenceInfo {
  userId: string
  displayName?: string
  presence: PresenceState
  statusMsg?: string
  lastActive?: Date
}

/** Typing information */
export interface TypingInfo {
  userId: string
  displayName: string
  since: Date
}

/** Read receipt types */
export type ReadReceiptType = 'm.read' | 'm.read.private'

/** Read receipt information */
export interface ReadReceipt {
  userId: string
  eventId: string
  type: ReadReceiptType
  timestamp: number
}

/** Unread count information */
export interface UnreadCount {
  notifications: number
  highlights: number
}

/** Room unread counts */
export interface RoomUnreadCounts {
  roomId: string
  roomName: string
  notifications: number
  highlights: number
}

/** Global unread counts */
export interface GlobalUnreadCounts {
  totalNotifications: number
  totalHighlights: number
  rooms: RoomUnreadCounts[]
}

/** Presence statistics for a room */
export interface PresenceStats {
  online: number
  unavailable: number
  offline: number
  unknown: number
  total: number
}

// ==================== Typing Notifier ====================

/**
 * TypingNotifier - Auto-managed typing notices with debouncing
 *
 * Features:
 * - 300ms debounce before sending typing notice
 * - Auto-stop after 10 seconds of inactivity
 * - Auto-stop when message is sent
 */
export class TypingNotifier {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private timeoutId: ReturnType<typeof setTimeout> | null = null
  private typingNoticeSent = false

  constructor(
    private roomId: string,
    private sendFn: (roomId: string, isTyping: boolean, timeout?: number) => Promise<void>
  ) {}

  /**
   * User started typing - debounced notification
   */
  onUserTyping(): void {
    // Clear previous debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    // Debounce for 300ms before sending typing notice
    this.debounceTimer = setTimeout(async () => {
      if (!this.typingNoticeSent) {
        try {
          await this.sendFn(this.roomId, true, 10000) // 10 second timeout
          this.typingNoticeSent = true

          // Set auto-stop timer
          this.timeoutId = setTimeout(() => {
            this.stopTyping()
          }, 10000)

          logger.debug('[TypingNotifier] Started typing', { roomId: this.roomId })
        } catch (error) {
          logger.error('[TypingNotifier] Failed to send typing notice:', error)
        }
      }
    }, 300)
  }

  /**
   * User stopped typing - send stop notice immediately
   */
  onUserStoppedTyping(): void {
    this.stopTyping()
  }

  /**
   * Stop typing and clear all timers
   */
  private stopTyping(): void {
    // Clear debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }

    // Clear auto-stop timer
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }

    // Send typing stop notice if was typing
    if (this.typingNoticeSent) {
      this.sendFn(this.roomId, false)
        .then(() => {
          logger.debug('[TypingNotifier] Stopped typing', { roomId: this.roomId })
        })
        .catch((error) => {
          logger.error('[TypingNotifier] Failed to stop typing notice:', error)
        })
      this.typingNoticeSent = false
    }
  }

  /**
   * Send message - automatically stops typing
   */
  async sendMessage<T>(sendFn: () => Promise<T>): Promise<T> {
    this.stopTyping()
    return await sendFn()
  }

  /**
   * Cleanup - clear all timers
   */
  destroy(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
    }
    if (this.typingNoticeSent) {
      this.sendFn(this.roomId, false).catch(() => {
        // Ignore errors during cleanup
      })
    }
  }
}

// ==================== Read Receipt Utilities ====================

/**
 * Send a read receipt for a message
 *
 * @param roomId - Room ID
 * @param eventId - Event ID to mark as read
 * @param type - Receipt type (m.read or m.read.private)
 */
export async function sendReadReceipt(
  roomId: string,
  eventId: string,
  type: ReadReceiptType = 'm.read'
): Promise<void> {
  const client = matrixClientService.getClient()
  if (!client) {
    throw new Error('Matrix client not available')
  }

  try {
    const sendReceiptMethod = client.sendReadReceipt as
      | ((roomId: string, eventId: string, type: string) => Promise<unknown>)
      | undefined

    if (!sendReceiptMethod) {
      throw new Error('sendReadReceipt method not available on client')
    }

    await sendReceiptMethod(roomId, eventId, type)
    logger.info('[MatrixPresenceTyping] Read receipt sent', { roomId, eventId, type })
  } catch (error) {
    logger.error('[MatrixPresenceTyping] Failed to send read receipt:', error)
    throw error
  }
}

/**
 * Mark all messages in a room as read
 *
 * @param roomId - Room ID
 */
export async function markRoomAsRead(roomId: string): Promise<void> {
  const client = matrixClientService.getClient()
  if (!client) {
    throw new Error('Matrix client not available')
  }

  try {
    const getRoomMethod = client.getRoom as ((roomId: string) => RoomLike | undefined) | undefined
    const room = getRoomMethod?.(roomId)

    if (!room) {
      throw new Error(`Room not found: ${roomId}`)
    }

    // Get the latest event from the timeline
    const getLiveTimelineMethod = room.getLiveTimeline as (() => TimelineLike | null) | undefined
    const timeline = getLiveTimelineMethod?.()

    if (!timeline) {
      throw new Error('Room timeline not available')
    }

    const getEventsMethod = timeline.getEvents as (() => EventLike[]) | undefined
    const events = getEventsMethod?.() || []

    if (events.length === 0) {
      logger.debug('[MatrixPresenceTyping] No events to mark as read', { roomId })
      return
    }

    // Get the last event
    const lastEvent = events[events.length - 1]
    const eventId = lastEvent.getId?.()

    if (!eventId) {
      throw new Error('Last event has no ID')
    }

    await sendReadReceipt(roomId, eventId)
    logger.info('[MatrixPresenceTyping] Room marked as read', { roomId, eventId })
  } catch (error) {
    logger.error('[MatrixPresenceTyping] Failed to mark room as read:', error)
    throw error
  }
}

/**
 * Get read receipts for an event
 *
 * @param roomId - Room ID
 * @param eventId - Event ID
 * @returns Array of read receipts
 */
export async function getReceiptsForEvent(roomId: string, eventId: string): Promise<ReadReceipt[]> {
  const client = matrixClientService.getClient()
  if (!client) {
    throw new Error('Matrix client not available')
  }

  try {
    const getRoomMethod = client.getRoom as ((roomId: string) => RoomLike | undefined) | undefined
    const room = getRoomMethod?.(roomId)

    if (!room) {
      throw new Error(`Room not found: ${roomId}`)
    }

    const findEventMethod = room.findEventById as ((eventId: string) => EventLike | null) | undefined
    const event = findEventMethod?.(eventId)

    if (!event) {
      throw new Error(`Event not found: ${eventId}`)
    }

    const getReceiptsMethod = client.getReceiptsForEvent as
      | ((event: EventLike) => Array<{ userId: string; data: { ts: number } }>)
      | undefined

    if (!getReceiptsMethod) {
      throw new Error('getReceiptsForEvent method not available on client')
    }

    const receipts = getReceiptsMethod(event)

    return receipts.map((receipt) => ({
      userId: receipt.userId,
      eventId,
      type: 'm.read',
      timestamp: receipt.data.ts
    }))
  } catch (error) {
    logger.error('[MatrixPresenceTyping] Failed to get receipts for event:', error)
    throw error
  }
}

// ==================== Unread Count Utilities ====================

/**
 * Get unread notification count for a room
 *
 * @param roomId - Room ID
 * @returns Notification and highlight counts
 */
export async function getRoomUnreadCount(roomId: string): Promise<UnreadCount> {
  const client = matrixClientService.getClient()
  if (!client) {
    return { notifications: 0, highlights: 0 }
  }

  try {
    const getRoomMethod = client.getRoom as ((roomId: string) => RoomLike | undefined) | undefined
    const room = getRoomMethod?.(roomId)

    if (!room) {
      logger.debug('[MatrixPresenceTyping] Room not found for unread count', { roomId })
      return { notifications: 0, highlights: 0 }
    }

    const getNotificationMethod = room.getUnreadNotificationCount as (() => number) | undefined
    const getHighlightMethod = room.getUnreadHighlightCount as (() => number) | undefined

    const notifications = getNotificationMethod?.() || 0
    const highlights = getHighlightMethod?.() || 0

    return { notifications, highlights }
  } catch (error) {
    logger.error('[MatrixPresenceTyping] Failed to get room unread count:', error)
    return { notifications: 0, highlights: 0 }
  }
}

/**
 * Get global unread counts across all rooms
 *
 * @returns Global unread counts
 */
export async function getGlobalUnreadCount(): Promise<GlobalUnreadCounts> {
  const client = matrixClientService.getClient()
  if (!client) {
    return { totalNotifications: 0, totalHighlights: 0, rooms: [] }
  }

  try {
    const getRoomsMethod = client.getRooms as (() => RoomLike[]) | undefined
    const rooms = getRoomsMethod?.() || []

    let totalNotifications = 0
    let totalHighlights = 0

    const roomCounts: RoomUnreadCounts[] = []

    for (const room of rooms) {
      const notifications = (room.getUnreadNotificationCount as (() => number) | undefined)?.() || 0
      const highlights = (room.getUnreadHighlightCount as (() => number) | undefined)?.() || 0

      totalNotifications += notifications
      totalHighlights += highlights

      if (notifications > 0 || highlights > 0) {
        roomCounts.push({
          roomId: room.roomId,
          roomName: room.name || room.roomId,
          notifications,
          highlights
        })
      }
    }

    return {
      totalNotifications,
      totalHighlights,
      rooms: roomCounts
    }
  } catch (error) {
    logger.error('[MatrixPresenceTyping] Failed to get global unread count:', error)
    return { totalNotifications: 0, totalHighlights: 0, rooms: [] }
  }
}

// ==================== Presence Statistics ====================

/**
 * Get presence statistics for a room
 *
 * @param roomId - Room ID
 * @returns Presence statistics
 */
export async function getPresenceStats(roomId: string): Promise<PresenceStats | null> {
  const client = matrixClientService.getClient()
  if (!client) {
    return null
  }

  try {
    const getRoomMethod = client.getRoom as ((roomId: string) => RoomLike | undefined) | undefined
    const room = getRoomMethod?.(roomId)

    if (!room) {
      logger.debug('[MatrixPresenceTyping] Room not found for presence stats', { roomId })
      return null
    }

    const getJoinedMembersMethod = room.getJoinedMemberCount as (() => number) | undefined
    const memberCount = getJoinedMembersMethod?.() || 0

    const stats: PresenceStats = {
      online: 0,
      unavailable: 0,
      offline: 0,
      unknown: memberCount,
      total: memberCount
    }

    // Try to get detailed member presence
    const getMembersMethod = room.getJoinedMembers as (() => MemberLike[]) | undefined
    const members = getMembersMethod?.()

    if (members) {
      stats.total = members.length
      stats.unknown = 0

      for (const member of members) {
        const presence = member.presence as PresenceState | undefined

        switch (presence) {
          case 'online':
            stats.online++
            break
          case 'unavailable':
            stats.unavailable++
            break
          case 'offline':
            stats.offline++
            break
          default:
            stats.unknown++
        }
      }
    }

    return stats
  } catch (error) {
    logger.error('[MatrixPresenceTyping] Failed to get presence stats:', error)
    return null
  }
}

/**
 * Get online members from a room
 *
 * @param roomId - Room ID
 * @returns Array of online member user IDs
 */
export async function getOnlineMembers(roomId: string): Promise<string[]> {
  const client = matrixClientService.getClient()
  if (!client) {
    return []
  }

  try {
    const getRoomMethod = client.getRoom as ((roomId: string) => RoomLike | undefined) | undefined
    const room = getRoomMethod?.(roomId)

    if (!room) {
      return []
    }

    const getMembersMethod = room.getJoinedMembers as (() => MemberLike[]) | undefined
    const members = getMembersMethod?.()

    if (!members) {
      return []
    }

    return members.filter((member) => member.presence === 'online').map((member) => member.userId)
  } catch (error) {
    logger.error('[MatrixPresenceTyping] Failed to get online members:', error)
    return []
  }
}

/**
 * Get presence information for a user
 *
 * @param userId - User ID
 * @returns Presence information
 */
export async function getUserPresence(userId: string): Promise<PresenceInfo | null> {
  const client = matrixClientService.getClient()
  if (!client) {
    return null
  }

  try {
    const getUserMethod = client.getUser as ((userId: string) => UserLike | undefined) | undefined
    const user = getUserMethod?.(userId)

    if (!user) {
      return null
    }

    const presence = user.presence as PresenceState | undefined
    const lastActiveAgo = user.lastActiveAgo as number | undefined

    let displayName: string | undefined
    try {
      const getProfileInfoMethod = client.getProfileInfo as
        | ((userId: string) => Promise<{ displayname?: string }>)
        | undefined
      const profile = await getProfileInfoMethod?.(userId)
      displayName = profile?.displayname
    } catch {
      // Ignore profile fetch errors
    }

    return {
      userId,
      displayName,
      presence: presence || 'unknown',
      statusMsg: user.statusMsg as string | undefined,
      lastActive: lastActiveAgo ? new Date(Date.now() - lastActiveAgo) : undefined
    }
  } catch (error) {
    logger.error('[MatrixPresenceTyping] Failed to get user presence:', error)
    return null
  }
}

// ==================== Typing Notice Sending ====================

/**
 * Send typing notice
 *
 * @param roomId - Room ID
 * @param isTyping - Whether user is typing
 * @param timeout - Timeout in milliseconds (default: 4500)
 */
export async function sendTypingNotice(roomId: string, isTyping: boolean, timeout: number = 4500): Promise<void> {
  const client = matrixClientService.getClient()
  if (!client) {
    throw new Error('Matrix client not available')
  }

  try {
    const sendTypingMethod = client.sendTypingNotice as
      | ((roomId: string, isTyping: boolean, timeout?: number) => Promise<unknown>)
      | undefined

    if (!sendTypingMethod) {
      throw new Error('sendTypingNotice method not available on client')
    }

    await sendTypingMethod(roomId, isTyping, timeout)
    logger.debug('[MatrixPresenceTyping] Typing notice sent', { roomId, isTyping, timeout })
  } catch (error) {
    logger.error('[MatrixPresenceTyping] Failed to send typing notice:', error)
    throw error
  }
}

// ==================== Unified Manager Class ====================

/**
 * MatrixPresenceTypingManager - Unified service for presence, typing, and read receipts
 *
 * Features:
 * - Set own presence status
 * - Send typing notices (with auto-management via TypingNotifier)
 * - Send read receipts
 * - Get user presence information
 * - Get room unread counts
 * - Get presence statistics
 */
export class MatrixPresenceTypingManager {
  private static instance: MatrixPresenceTypingManager
  private typingNotifiers = new Map<string, TypingNotifier>()

  static getInstance(): MatrixPresenceTypingManager {
    if (!MatrixPresenceTypingManager.instance) {
      MatrixPresenceTypingManager.instance = new MatrixPresenceTypingManager()
    }
    return MatrixPresenceTypingManager.instance
  }

  /**
   * Create a typing notifier for a room
   */
  createTypingNotifier(roomId: string): TypingNotifier {
    // Destroy existing notifier if any
    const existing = this.typingNotifiers.get(roomId)
    if (existing) {
      existing.destroy()
    }

    const notifier = new TypingNotifier(roomId, sendTypingNotice)
    this.typingNotifiers.set(roomId, notifier)
    return notifier
  }

  /**
   * Get existing typing notifier for a room
   */
  getTypingNotifier(roomId: string): TypingNotifier | undefined {
    return this.typingNotifiers.get(roomId)
  }

  /**
   * Destroy typing notifier for a room
   */
  destroyTypingNotifier(roomId: string): void {
    const notifier = this.typingNotifiers.get(roomId)
    if (notifier) {
      notifier.destroy()
      this.typingNotifiers.delete(roomId)
    }
  }

  /**
   * Destroy all typing notifiers
   */
  destroyAllTypingNotifiers(): void {
    this.typingNotifiers.forEach((notifier) => notifier.destroy())
    this.typingNotifiers.clear()
  }

  // ==================== Presence Methods ====================

  /**
   * Set own presence status
   */
  async setPresence(presence: PresenceState, statusMsg?: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not available')
    }

    try {
      const getUserIdMethod = client.getUserId as (() => string) | undefined
      const myUserId = getUserIdMethod?.()

      if (!myUserId) {
        throw new Error('User ID not available')
      }

      const setPresenceMethod = client.setPresence as
        | ((userId: string, content: { presence: string; status_msg?: string }) => Promise<void>)
        | undefined

      if (!setPresenceMethod) {
        throw new Error('setPresence method not available on client')
      }

      await setPresenceMethod(myUserId, {
        presence,
        ...(statusMsg && { status_msg: statusMsg })
      })

      logger.info('[MatrixPresenceTyping] Presence set', { presence, statusMsg })
    } catch (error) {
      logger.error('[MatrixPresenceTyping] Failed to set presence:', error)
      throw error
    }
  }

  /**
   * Set online status
   */
  async setOnline(statusMsg?: string): Promise<void> {
    await this.setPresence('online', statusMsg)
  }

  /**
   * Set unavailable status
   */
  async setUnavailable(statusMsg?: string): Promise<void> {
    await this.setPresence('unavailable', statusMsg)
  }

  /**
   * Set offline status
   */
  async setOffline(): Promise<void> {
    await this.setPresence('offline')
  }

  /**
   * Get user presence information
   */
  async getUserPresence(userId: string): Promise<PresenceInfo | null> {
    return getUserPresence(userId)
  }

  /**
   * Get presence statistics for a room
   */
  async getPresenceStats(roomId: string): Promise<PresenceStats | null> {
    return getPresenceStats(roomId)
  }

  /**
   * Get online members from a room
   */
  async getOnlineMembers(roomId: string): Promise<string[]> {
    return getOnlineMembers(roomId)
  }

  // ==================== Typing Methods ====================

  /**
   * Send typing notice
   */
  async sendTypingNotice(roomId: string, isTyping: boolean, timeout?: number): Promise<void> {
    return sendTypingNotice(roomId, isTyping, timeout)
  }

  // ==================== Read Receipt Methods ====================

  /**
   * Send read receipt for a message
   */
  async sendReadReceipt(roomId: string, eventId: string, type?: ReadReceiptType): Promise<void> {
    return sendReadReceipt(roomId, eventId, type)
  }

  /**
   * Mark room as read
   */
  async markRoomAsRead(roomId: string): Promise<void> {
    return markRoomAsRead(roomId)
  }

  /**
   * Get read receipts for an event
   */
  async getReceiptsForEvent(roomId: string, eventId: string): Promise<ReadReceipt[]> {
    return getReceiptsForEvent(roomId, eventId)
  }

  // ==================== Unread Count Methods ====================

  /**
   * Get unread count for a room
   */
  async getRoomUnreadCount(roomId: string): Promise<UnreadCount> {
    return getRoomUnreadCount(roomId)
  }

  /**
   * Get global unread counts
   */
  async getGlobalUnreadCount(): Promise<GlobalUnreadCounts> {
    return getGlobalUnreadCount()
  }
}

// ==================== Interfaces ====================

/** Room-like interface */
interface RoomLike {
  roomId: string
  name?: string
  getLiveTimeline?: () => TimelineLike | null
  getJoinedMemberCount?: () => number
  getJoinedMembers?: () => MemberLike[]
  findEventById?: (eventId: string) => EventLike | null
  getUnreadNotificationCount?: () => number
  getUnreadHighlightCount?: () => number
}

/** Timeline-like interface */
interface TimelineLike {
  getEvents: () => EventLike[]
}

/** Event-like interface */
interface EventLike {
  getId?: () => string
}

/** Member-like interface */
interface MemberLike {
  userId: string
  presence?: string
}

/** User-like interface */
interface UserLike {
  presence?: string
  lastActiveAgo?: number
  statusMsg?: string
}

// ==================== Export Singleton ====================

export const matrixPresenceTypingService = MatrixPresenceTypingManager.getInstance()
