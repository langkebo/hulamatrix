/**
 * Space Details - 类型定义
 */

/** 房间接口 */
export interface Room {
  id: string
  name: string
  topic?: string
  type: string
  isJoined?: boolean
  isFavorite?: boolean
  memberCount?: number
  lastMessage?: { content?: string } | string
  lastActivity?: number
  avatar?: string
  canonicalAlias?: string
  // Matrix SDK specific properties
  isSpace?: boolean // m.space type
  via?: string[] // Server names for routing (m.space.child)
  suggested?: boolean // Suggested room (m.space.child)
  order?: string // Room order (m.space.child)
}

/** 成员接口 */
export interface Member {
  id: string
  name: string
  avatar?: string
  role: 'admin' | 'moderator' | 'member'
  joinedAt?: number
  isActive?: boolean
  lastActive?: number
  // Matrix SDK specific properties
  powerLevel?: number // Matrix power level (0-100)
  membership?: 'join' | 'invite' | 'ban' | 'leave' // Matrix membership state
}

/** 活动记录接口 */
export interface Activity {
  id: string
  type: 'room_created' | 'member_joined' | 'message_sent'
  description: string
  timestamp: number
  actor?: string
}

/** Space Props */
export interface SpaceDetailsProps {
  space: {
    id: string
    name: string
    topic?: string
    description?: string
    avatar?: string
    isPublic?: boolean
    isArchived?: boolean
    isFavorite?: boolean
    isJoined?: boolean
    isAdmin?: boolean
    isOwner?: boolean
    memberCount?: number
    roomCount?: number
    created?: number
    lastActivity?: number
    // Matrix SDK specific properties
    roomType?: 'm.space' | string // Matrix room type
    canonicalAlias?: string // Matrix canonical alias
    notifications?: {
      notificationCount?: number
      highlightCount?: number
    }
    tags?: string[]
  } | null
}

/** 基础设置表单 */
export interface BasicSettingsForm {
  name: string
  topic: string
  description: string
  avatar: string
}

/** 隐私设置表单 */
export interface PrivacySettingsForm {
  isPublic: boolean
  guestAllowed: boolean
  historyVisible: boolean
}

/** 通知设置表单 */
export interface NotificationSettingsForm {
  allRooms: boolean
  keywords: string[]
  ignoreMentions: boolean
}

/** 创建房间表单 */
export interface CreateRoomForm {
  name: string
  topic: string
  type: 'room' | 'space'
  isPublic: boolean
}

/** Space 动作类型 */
export type SpaceAction = 'settings' | 'invite' | 'archive' | 'unarchive' | 'leave' | 'copy_link' | 'toggle_favorite'

/** 房间动作类型 */
export type RoomAction = 'view' | 'favorite' | 'settings' | 'leave'

/** 成员动作类型 */
export type MemberAction = 'promote' | 'demote' | 'remove' | 'message'

/** 标签页类型 */
export type SpaceTabType = 'overview' | 'rooms' | 'members' | 'settings'

/** 角色类型 */
export type MemberRole = 'admin' | 'moderator' | 'member'

/** 房间类型 */
export type RoomType = 'room' | 'space' | 'direct'

/** Naive UI 类型 */
export type NaiveType = 'error' | 'warning' | 'info' | 'default' | 'success' | 'primary'
