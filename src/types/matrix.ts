/**
 * Matrix SDK Type Definitions
 * Adapter layer between SDK and UI
 */

import type { MatrixClient as SDKMatrixClient, Room, RoomMember, MatrixEvent } from 'matrix-js-sdk'

// Re-export SDK types with SDK prefix for clarity
export type SDKRoom = Room
export type SDKRoomMember = RoomMember
export type SDKMatrixEvent = MatrixEvent
export type { MatrixEvent }
export type MatrixClient = SDKMatrixClient

export interface MatrixLoginResponse {
  access_token?: string
  accessToken?: string
  device_id?: string
  deviceId?: string
  user_id?: string
  userId?: string
  refresh_token?: string
  refreshToken?: string
  home_server?: string
  homeServer?: string
  [key: string]: unknown
}

export type MessageContent = Record<string, unknown>

export interface MatrixPushRuleAction {
  notify?: boolean
  set_tweak?: string
  value?: string
  [key: string]: unknown
}

export interface MatrixPushRule {
  ruleId: string
  type: string
  enabled: boolean
  default?: boolean
  pattern?: string
  conditions?: unknown[]
  actions: MatrixPushRuleAction[]
  [key: string]: unknown
}

export type MatrixPresence = unknown
export type MatrixTypingEvent = unknown

export interface MatrixPowerLevels {
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
  notifications?: Record<string, number>
}

/**
 * UI-Facing Room Interface
 * Preserves compatibility with existing components while wrapping SDK Room
 */
export interface MatrixRoom {
  roomId: string
  name: string
  topic?: string | undefined
  avatarUrl?: string | undefined // UI expects string URL
  avatar?: string | undefined // Alias for compatibility
  encrypted: boolean
  joinRule: string
  guestAccess: string
  historyVisibility: string
  memberCount?: number | undefined
  type?: string | undefined // Room type (e.g., 'm.space' for spaces)
  created?: string | undefined // Room creation timestamp
  creator?: string | undefined // Room creator user ID
  isSpace?: boolean | undefined // Whether this room is a space
  // Reference to original SDK object for advanced usage
  _room?: unknown
}

/**
 * UI-Facing Member Interface
 */
export interface MatrixMember {
  userId: string
  displayName: string
  avatarUrl?: string | undefined
  powerLevel: number
  membership: string
  presence?: string | undefined
  // Legacy fields for compatibility
  presenceActive?: boolean | undefined
  lastActiveAgo?: number | undefined
  currentlyActive?: boolean | undefined
  deviceDisplay?: string | undefined
  joinedAt?: number | undefined
  reason?: string | undefined
  // Reference to original SDK object
  _member?: unknown
}

/**
 * UI-Facing Message Content Type
 * Supports both object (Matrix format) and string (legacy compatibility)
 */
export type MatrixMessageContent =
  | {
      body?: string
      msgtype?: string
      url?: string
      info?: {
        mimetype?: string
        size?: number
        w?: number
        h?: number
        thumbnail_url?: string
        thumbnail_info?: {
          mimetype?: string
          size?: number
          w?: number
          h?: number
        }
        duration?: number
      }
      format?: string
      formatted_body?: string
      filename?: string
      ['m.relates_to']?: {
        rel_type: string
        event_id: string
        key?: string
        is_falling_back?: boolean
        in_reply_to?: {
          event_id: string
        }
      }
      [key: string]: unknown
    }
  | string

/**
 * UI-Facing Message Interface
 */
export interface MatrixMessage {
  eventId: string
  roomId: string
  sender: string
  type: string
  content: MatrixMessageContent // Raw content object for UI access
  timestamp: number
  isOutgoing?: boolean
  status?: MessageStatus
  encrypted?: boolean // Whether message is encrypted
  localEventId?: string // Local event ID before send
  error?: Error | string // Error if send failed
  // Reference to original SDK object
  _event?: unknown
}

/**
 * Message status enumeration
 */
export enum MessageStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed'
}

export interface MatrixCredentials {
  baseUrl: string
  homeserver: string
  userId: string
  accessToken: string
  refreshToken?: string
  deviceId: string
  expiresAt?: number
}

/**
 * Matrix File Type
 * Represents a file uploaded to Matrix (mxc:// URL)
 * Extended to include message-related properties
 */
export interface MatrixFile {
  url: string // mxc:// URL
  name?: string
  mimeType?: string
  size?: number
  thumbnailUrl?: string
  thumbnailInfo?: {
    mimetype: string
    size: number
    w: number
    h: number
  }
  // Message-related properties for file messages
  eventId?: string
  roomId?: string
  senderId?: string
  content?: string
  timestamp?: number
}

/**
 * Space Info Type
 * Represents a Matrix Space (room grouping)
 */
export interface SpaceInfo {
  roomId: string
  name: string
  avatarUrl?: string
  avatar?: string // Alias for compatibility
  topic?: string
  memberCount?: number
  joined: boolean
  rooms?: string[] // Child room IDs
}

/**
 * Search Result Type
 * Represents a message search result
 */
export interface SearchResult {
  eventId: string
  roomId: string
  roomName?: string
  roomAvatar?: string
  senderId: string
  senderName?: string
  senderAvatar?: string
  timestamp: number
  content: string
  encrypted: boolean
  highlights?: string[]
}

/**
 * Room with metadata for list views
 */
export interface RoomWithMeta {
  roomId: string
  name: string
  topic?: string
  avatarUrl?: string
  avatar?: string
  encrypted: boolean
  joinRule: string
  guestAccess: string
  historyVisibility: string
  memberCount?: number
  type?: string
  created?: string | number
  creator?: string
  unreadCount?: number
  lastEvent?: { event?: unknown; sender?: string; timestamp?: number }
  members?: Array<{ userId?: string; displayName?: string; avatarUrl?: string }>
  isDirectMessage?: boolean
  isSpace?: boolean
  _room?: Room
}

// ============================================================================
// Types migrated from src/typings/matrix.ts
// ============================================================================

export type MsgType = 'm.text' | 'm.image' | 'm.file' | 'm.audio' | 'm.video' | 'm.notice'

export interface MatrixMessageEvent {
  id: string
  type: MsgType
  body: string
  timestamp: number
  sender: string
  roomId: string
  url?: string
}

export interface FriendPresenceEntry {
  userId: string
  displayName?: string
  avatarUrl?: string
  presence?: 'online' | 'offline' | 'unavailable'
}

export interface FriendActivityRow extends FriendPresenceEntry {
  activeTime?: number
}

// Matrix Room Message Content Types
export interface MatrixRoomMessageContent {
  msgtype: string
  body: string
  url?: string
  info?: {
    mimetype?: string
    size?: number
    w?: number
    h?: number
    thumbnail_url?: string
    thumbnail_info?: {
      mimetype?: string
      size?: number
      w?: number
      h?: number
    }
    duration?: number
  }
  format?: string
  formatted_body?: string
  ['m.new_content']?: MatrixRoomMessageContent
  ['m.relates_to']?: {
    rel_type: string
    event_id: string
    key?: string
    is_falling_back?: boolean
  }
}

export interface MatrixRelatesTo {
  rel_type: string
  event_id: string
  key?: string
  is_falling_back?: boolean
  in_reply_to?: {
    event_id: string
  }
}

// Matrix Event Content Types
export interface MatrixEventContent {
  msgtype?: string
  body?: string
  url?: string
  info?: Record<string, unknown>
  membership?: string
  displayname?: string
  avatar_url?: string
  reason?: string
  algorithm?: string
  ['m.relates_to']?: MatrixRelatesTo
  ['m.new_content']?: MatrixRoomMessageContent
  [key: string]: unknown
}

export type RoomCreateOptions = { name?: string; topic?: string; isPublic?: boolean }
export type CreateRoomResult = { roomId: string }
export type CreateRoomDetailedResult = {
  roomId: string
  preset: 'public_chat' | 'private_chat'
  visibility: RoomVisibility
  name?: string
  topic?: string
}

export type RoomVisibility = 'public' | 'private'
export type HistoryVisibility = 'world_readable' | 'shared' | 'invited' | 'joined'
export type JoinRule = 'public' | 'invite' | 'knock' | 'private'

export type MatrixCallSignalType = 'offer' | 'answer' | 'candidate' | 'hangup' | 'reject' | 'select_answer'

export type InviteContent = {
  call_id: string
  lifetime: number
  version: number
  offer: { sdp: string; type: string }
}

export type AnswerContent = {
  call_id: string
  version: number
  answer: { sdp: string; type: string }
}

export type CandidatesContent = {
  call_id: string
  version: number
  candidates: Array<{ candidate: string; sdpMLineIndex?: number; sdpMid?: string }>
}

export type HangupContent = { call_id: string; version: number; reason: string }
export type RejectContent = { call_id: string; version: number; reason: string }

export type MatrixRtcPayload = InviteContent | AnswerContent | CandidatesContent | HangupContent | RejectContent

export interface MatrixCallEvent {
  type: 'invite' | 'answer' | 'hangup' | 'candidates' | 'select_answer' | 'reject'
  content: MatrixRtcPayload
  sender: string
  roomId: string
  timestamp: number
}

// Matrix Event interface
export interface IMatrixEvent {
  getType(): string
  getContent(): MatrixEventContent
  getRoomId(): string
  getSender(): string
  getTs(): number
  getId(): string
  getRoom(): IMatrixRoom | null
  getRelation(): MatrixRelatesTo | null
  getWireType(): string
  getWireContent(): unknown
  isEncrypted(): boolean
  isState(): boolean
}

export interface MatrixEventLike {
  getType?: () => string
  getContent?: () => MatrixEventContent
  getRoomId?: () => string
  getSender?: () => string
  getTs?: () => number
  getId?: () => string
  getRoom?: () => MatrixRoomLike | null
  getRelation?: () => MatrixRelatesTo | null
  isEncrypted?: () => boolean
  isState?: () => boolean
  attemptDecryption?: (client: unknown, options?: { retry?: boolean }) => Promise<void>
}

export interface MatrixRoomLike {
  roomId?: string
  name?: string
  getDefaultRoomName?: (userId?: string) => string
  getLiveTimeline?: () => IMatrixTimelineSet | null
  canPaginateBackward?: () => boolean
  getJoinedMembers?: () => MatrixRoomMember[]
  getMyMembership?: () => string
  currentState?: IMatrixRoomState
}

// Matrix Room State interface
export interface IMatrixRoomState {
  getStateEvents(type: string, stateKey?: string): IMatrixEvent[]
  getStateEvent(type: string, stateKey?: string): IMatrixEvent | null
  getUserDisplayName(userId: string): string | undefined
}

// Matrix Timeline Set interface
export interface IMatrixTimelineSet {
  getLiveTimeline(): IMatrixTimeline | null
  getEvents(): IMatrixEvent[]
}

// Matrix Timeline interface
export interface IMatrixTimeline {
  getEvents(): IMatrixEvent[]
  getState(): IMatrixRoomState | null
}

// Matrix Room interface
export interface IMatrixRoom {
  roomId: string
  name: string
  topic?: string
  getJoinedMembers(): MatrixRoomMember[]
  getMyMembership(): string
  getCanonicalAlias(): string | null
  getDefaultRoomName(userId?: string): string
  getLiveTimeline(): IMatrixTimeline | null
  canPaginateBackward(): boolean
  hasEncryptionStateEvent(): boolean
  findEventById(eventId: string): IMatrixEvent | null
  getUnreadNotificationCount(): { highlightCount: number; notificationCount: number } | null
  currentState?: IMatrixRoomState
}

// Matrix Room Member interface
export interface MatrixRoomMember {
  userId: string
  name: string
  events?: {
    member?: {
      getTs?: () => number
    }
  }
  getAvatarUrl?(): string | null
}

// MatrixClientService 接口定义
export interface IMatrixClientService {
  getClient(): {
    getUserId?(): string
    getRooms?(): Array<{ roomId?: string; name?: string }>
    login?(type: string, params: Record<string, unknown>): Promise<{ user_id?: string; access_token?: string }>
  } | null
  initialize(credentials: {
    baseUrl: string
    accessToken?: string
    refreshToken?: string
    userId?: string
  }): Promise<void>
  stopClient(): Promise<void>
  setBaseUrl(url: string): void
  getBaseUrl(): string | null
  loginWithPassword(username: string, password: string): Promise<{ user_id?: string; access_token?: string }>
  startClient(options?: { initialSyncLimit?: number; pollTimeout?: number }): Promise<void>
  registerWithPassword(username: string, password: string): Promise<{ user_id?: string; access_token?: string }>
  // Backward compatibility aliases
  start(options?: { initialSyncLimit?: number; pollTimeout?: number }): Promise<void>
  stop(): Promise<void>
  getSyncState(): string
  isClientInitialized(): boolean
  // Message methods
  sendTextMessage(roomId: string, text: string, relatesTo?: { eventId: string }): Promise<string>
  sendMediaMessage(
    roomId: string,
    file: File | Blob,
    filename: string,
    mimeType: string,
    relatesTo?: { eventId: string }
  ): Promise<string>
  sendReadReceipt(roomId: string, eventId: string): Promise<void>
  // Account settings methods
  setAccountSetting(key: string, value: unknown, level?: 'account' | 'device' | 'defaults'): Promise<void>
  getAccountSetting<T = unknown>(key: string): Promise<T | undefined>
  getAllAccountSettings(): Promise<Record<string, unknown>>
  rollbackAccountSettings(): Promise<boolean>
  // Crypto
  getCrypto(): unknown
  // Settings history
  lastSettingsSnapshot: Record<string, unknown>
  // Authentication methods from 02-authentication.md
  whoami(): Promise<{ user_id: string; device_id: string; is_guest?: boolean }>
  isUsernameAvailable(username: string): Promise<boolean>
  logoutAll(options?: { erase?: boolean }): Promise<void>
  loginAsGuest(): Promise<{ access_token: string; user_id: string; device_id: string }>
  getOpenIdToken(): Promise<{ access_token: string; token_type: string; matrix_token: string; expires_in: number }>
}

/**
 * Utility function to extract text content from MatrixMessageContent
 * Handles both string and object content types
 */
export function getMatrixMessageText(content: MatrixMessageContent): string {
  if (typeof content === 'string') {
    return content
  }
  return content.body || ''
}

/**
 * Utility function to check if content is an object (not a string)
 */
export function isMatrixContentObject(content: MatrixMessageContent): content is Exclude<MatrixMessageContent, string> {
  return typeof content !== 'string'
}

/**
 * Utility function to safely get a property from MatrixMessageContent
 */
export function getMatrixContentProperty<K extends keyof Exclude<MatrixMessageContent, string>>(
  content: MatrixMessageContent,
  key: K
): Exclude<MatrixMessageContent, string>[K] | undefined {
  if (isMatrixContentObject(content)) {
    return content[key]
  }
  return undefined
}
