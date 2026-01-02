/**
 * Matrix SDK Type Adapter Utilities
 *
 * This module provides type-safe adapters and converters for Matrix SDK types.
 * It bridges the gap between SDK types and UI-facing types while maintaining
 * type safety without using 'any'.
 */

import type { MatrixRoom, MatrixEvent, MatrixRoomMember } from '@/types/matrix'

/**
 * Extended MatrixEvent with additional properties from SDK
 */
export interface ExtendedMatrixEvent extends Omit<MatrixEvent, 'event'> {
  event?: {
    event_id?: string
    type?: string
    content?: Record<string, unknown>
    origin_server_ts?: number
    sender?: string
    room_id?: string
    [key: string]: unknown
  }
  timestamp?: number
  type?: string
  content?: Record<string, unknown>
  [key: string]: unknown
}

/**
 * Extended MatrixRoomMember with display name
 */
export interface ExtendedMatrixRoomMember extends MatrixRoomMember {
  displayName?: string
  userId: string
  avatarUrl?: string
  powerLevel?: number
  membership?: string
  [key: string]: unknown
}

/**
 * Extended MatrixRoom with metadata
 */
export interface ExtendedMatrixRoom extends MatrixRoom {
  unreadCount?: number
  lastEvent?: ExtendedMatrixEvent | null
  members?: ExtendedMatrixRoomMember[]
  isDirectMessage?: boolean
  [key: string]: unknown
}

/**
 * Type guard to check if an object is a valid MatrixEvent
 */
export function isMatrixEvent(obj: unknown): obj is ExtendedMatrixEvent {
  if (!obj || typeof obj !== 'object') return false
  const event = obj as Record<string, unknown>
  return (
    typeof event.eventId === 'string' ||
    typeof (event.event as Record<string, unknown> | undefined)?.event_id === 'string'
  )
}

/**
 * Type guard to check if an object has timestamp
 */
export function hasTimestamp(obj: unknown): obj is { timestamp: number } {
  if (!obj || typeof obj !== 'object') return false
  const event = obj as Record<string, unknown>
  return typeof event.timestamp === 'number'
}

/**
 * Safely get timestamp from event
 */
export function getEventTimestamp(event: ExtendedMatrixEvent | unknown): number {
  if (!event || typeof event !== 'object') return 0

  const evt = event as Record<string, unknown>

  // Try timestamp first
  if (typeof evt.timestamp === 'number') {
    return evt.timestamp
  }

  // Try origin_server_ts
  const eventObj = evt.event as Record<string, unknown> | undefined
  if (eventObj && typeof eventObj.origin_server_ts === 'number') {
    return eventObj.origin_server_ts
  }

  // Try getTs method
  if (typeof evt.getTs === 'function') {
    const result = evt.getTs()
    if (typeof result === 'number') {
      return result
    }
  }

  return 0
}

/**
 * Safely get event type
 */
export function getEventType(event: ExtendedMatrixEvent | unknown): string {
  if (!event || typeof event !== 'object') return ''

  const evt = event as Record<string, unknown>

  // Try type property first
  if (typeof evt.type === 'string') {
    return evt.type
  }

  // Try event.type
  const eventObj = evt.event as Record<string, unknown> | undefined
  if (eventObj && typeof eventObj.type === 'string') {
    return eventObj.type
  }

  // Try getType method
  if (typeof evt.getType === 'function') {
    const result = evt.getType()
    if (typeof result === 'string') {
      return result
    }
  }

  return ''
}

/**
 * Safely get event content
 */
export function getEventContent(event: ExtendedMatrixEvent | unknown): Record<string, unknown> {
  if (!event || typeof event !== 'object') return {}

  const evt = event as Record<string, unknown>

  // Try content property first
  if (evt.content && typeof evt.content === 'object') {
    return evt.content as Record<string, unknown>
  }

  // Try event.content
  const eventObj = evt.event as Record<string, unknown> | undefined
  if (eventObj?.content && typeof eventObj.content === 'object') {
    return eventObj.content as Record<string, unknown>
  }

  // Try getContent method
  if (typeof evt.getContent === 'function') {
    const result = evt.getContent()
    if (result && typeof result === 'object') {
      return result as Record<string, unknown>
    }
  }

  return {}
}

/**
 * Type guard to check if value is a MatrixRoomMember
 */
export function isMatrixRoomMember(obj: unknown): obj is ExtendedMatrixRoomMember {
  if (!obj || typeof obj !== 'object') return false
  const member = obj as Record<string, unknown>
  return typeof member.userId === 'string'
}

/**
 * Safely get display name from member
 */
export function getMemberDisplayName(member: ExtendedMatrixRoomMember | unknown): string {
  if (!member || typeof member !== 'object') return ''

  const m = member as Record<string, unknown>

  // Try displayName first
  if (typeof m.displayName === 'string') {
    return m.displayName
  }

  // Try displayname (lowercase)
  if (typeof m.displayname === 'string') {
    return m.displayname
  }

  // Try getDisplayName method
  if (typeof m.getDisplayName === 'function') {
    const result = m.getDisplayName()
    if (typeof result === 'string') {
      return result
    }
  }

  // Fallback to userId
  if (typeof m.userId === 'string') {
    return m.userId
  }

  return ''
}

/**
 * Convert unknown to RoomWithMeta type safely
 */
export function toRoomWithMeta(room: unknown): ExtendedMatrixRoom | null {
  if (!room || typeof room !== 'object') return null

  const r = room as Record<string, unknown>

  // Must have roomId
  if (typeof r.roomId !== 'string') return null

  return {
    roomId: r.roomId,
    name: typeof r.name === 'string' ? r.name : '',
    topic: typeof r.topic === 'string' ? r.topic : undefined,
    avatarUrl: typeof r.avatarUrl === 'string' ? r.avatarUrl : undefined,
    encrypted: Boolean(r.encrypted),
    joinRule: typeof r.joinRule === 'string' ? r.joinRule : '',
    guestAccess: typeof r.guestAccess === 'string' ? r.guestAccess : '',
    historyVisibility: typeof r.historyVisibility === 'string' ? r.historyVisibility : '',
    unreadCount: typeof r.unreadCount === 'number' ? r.unreadCount : undefined,
    lastEvent: isMatrixEvent(r.lastEvent) ? r.lastEvent : undefined,
    members: Array.isArray(r.members) ? r.members.filter(isMatrixRoomMember) : undefined,
    isDirectMessage: Boolean(r.isDirectMessage),
    _room: r._room
  }
}

/**
 * Batch convert rooms to RoomWithMeta
 */
export function toRoomsWithMeta(rooms: unknown[]): ExtendedMatrixRoom[] {
  return rooms.map(toRoomWithMeta).filter((r): r is ExtendedMatrixRoom => r !== null)
}

/**
 * Type-safe callback wrapper for room operations
 */
export type RoomCallback<T = void> = (room: ExtendedMatrixRoom) => T

/**
 * Type-safe callback wrapper for member operations
 */
export type MemberCallback<T = void> = (member: ExtendedMatrixRoomMember) => T

/**
 * Type-safe callback wrapper for event operations
 */
export type EventCallback<T = void> = (event: ExtendedMatrixEvent) => T

/**
 * Wrap a callback with type safety for room operations
 */
export function wrapRoomCallback<T>(callback: RoomCallback<T>, fallbackValue: T): (room: unknown) => T {
  return (room: unknown) => {
    const typedRoom = toRoomWithMeta(room)
    if (!typedRoom) {
      return fallbackValue
    }
    return callback(typedRoom)
  }
}

/**
 * Wrap a callback with type safety for member operations
 */
export function wrapMemberCallback<T>(callback: MemberCallback<T>, fallbackValue: T): (member: unknown) => T {
  return (member: unknown) => {
    if (!isMatrixRoomMember(member)) {
      return fallbackValue
    }
    return callback(member)
  }
}

/**
 * Wrap a callback with type safety for event operations
 */
export function wrapEventCallback<T>(callback: EventCallback<T>, fallbackValue: T): (event: unknown) => T {
  return (event: unknown) => {
    if (!isMatrixEvent(event)) {
      return fallbackValue
    }
    return callback(event)
  }
}
