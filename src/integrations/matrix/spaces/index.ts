/**
 * Matrix Spaces 类型定义
 */

/**
 * 权限级别内容
 */
export interface PowerLevelContent {
  users?: Record<string, number>
  users_default?: number
  events?: Record<string, number>
  events_default?: number
  state_default?: number
  ban?: number
  kick?: number
  redact?: number
  invite?: number
  [key: string]: unknown
}

/**
 * 未签名事件数据
 */
export interface UnsignedData {
  age?: number
  prev_content?: unknown
  prev_sender?: string
  replaced_by_state?: string
  [key: string]: unknown
}

export interface Space {
  id: string
  name: string
  topic?: string
  avatar?: string
  roomId: string
  joinedMembers: Member[]
  memberCount: number
  isPublic: boolean
  canonicalAlias?: string
  visibility: 'public' | 'private'
  guestAccess: 'can_join' | 'forbidden'
  historyVisibility: 'world_readable' | 'shared' | 'invited' | 'joined'
  joinRule: 'public' | 'knock' | 'invite' | 'private'
  creationTs: number
  creator: string
  version?: string
  powerLevelContent?: PowerLevelContent
  children: Space[]
  parents: Space[]
}

export interface Member {
  userId: string
  displayName?: string
  avatarUrl?: string
  membership: 'join' | 'leave' | 'ban' | 'invite' | 'knock'
  powerLevel?: number
  presence?: 'online' | 'offline' | 'unavailable'
  lastActiveAgo?: number
  currentlyActive?: boolean
  statusMsg?: string
  isDirect?: boolean
  roomId?: string
  joinTs?: number
  invitedBy?: string
  banReason?: string
  unsigned?: UnsignedData
}

/**
 * 房间标签
 */
export interface RoomTag {
  order?: number
  [key: string]: unknown
}

export interface Room {
  id: string
  roomId: string
  name: string
  topic?: string
  avatar?: string
  type: 'm.room' | 'm.space'
  isDirect: boolean
  isSpace: boolean
  joinRule: 'public' | 'invite' | 'knock' | 'private'
  historyVisibility: 'world_readable' | 'shared' | 'invited' | 'joined'
  guestAccess: 'can_join' | 'forbidden'
  memberCount: number
  heroes?: string[]
  unreadMessages: number
  unreadNotifications: number
  unreadHighlights: number
  timestamp: number
  lastEvent?: SpaceEvent
  tags?: Record<string, RoomTag>
  parentIds?: string[]
  children?: Room[]
}

/**
 * 事件内容
 */
export interface EventContent {
  [key: string]: unknown
}

export interface SpaceEvent {
  type: string
  content: EventContent
  sender: string
  origin_server_ts: number
  state_key?: string
  room_id: string
  event_id: string
  unsigned?: UnsignedData
}

/**
 * 子空间状态
 */
export interface ChildState {
  type: string
  state_key: string
  content: EventContent
  sender: string
  [key: string]: unknown
}

export interface SpaceHierarchy {
  room_id: string
  name?: string
  topic?: string
  num_joined_members: number
  world_readable: boolean
  guest_can_join: boolean
  avatar_url?: string
  join_rule?: string
  room_type?: string
  children_state?: ChildState[]
}
