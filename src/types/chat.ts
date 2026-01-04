/**
 * Chat Session Types
 *
 * Standardized type definitions for chat sessions across the application.
 * Designed to work with existing SessionItem type from @/services/types
 *
 * @module types/chat
 */

import type { SessionItem } from '@/services/types'
import { RoomTypeEnum, NotificationTypeEnum, OnlineEnum } from '@/enums'

/**
 * Chat session type enum
 */
export type ChatSessionType = 'direct' | 'group' | 'space' | 'channel'

/**
 * Online status enum
 */
export type OnlineStatus = 'online' | 'offline' | 'unavailable'

/**
 * Last message type enum
 */
export type LastMessageType = 'text' | 'image' | 'video' | 'audio' | 'file' | 'notification'

/**
 * Last message info
 */
export interface LastMessage {
  /** Message content */
  content: string
  /** Sender name */
  senderName?: string
  /** Message type */
  type: LastMessageType
  /** Timestamp */
  timestamp: number
  /** Event ID (Matrix) */
  eventId?: string
}

/**
 * Standardized chat session interface
 * Compatible with SessionItem from @/services/types
 */
export interface ChatSession {
  /** Unique identifier */
  id: string
  /** Room ID (Matrix) */
  roomId: string
  /** Session name */
  name: string
  /** Avatar URL */
  avatar?: string
  /** Session type */
  type: ChatSessionType
  /** Last message info */
  lastMessage?: LastMessage
  /** Last message formatted text */
  lastMsg?: string
  /** Last message timestamp (for sorting) */
  activeTime: number
  /** Last message formatted time string */
  lastMsgTime?: string
  /** Unread message count */
  unreadCount: number
  /** Is pinned to top */
  isPinned: boolean
  /** Is muted (do not disturb) */
  isMuted: boolean
  /** Is shielded (blocked) */
  isShielded: boolean
  /** Online status */
  onlineStatus?: OnlineStatus
  /** Category ID */
  categoryId?: string
  /** Tags */
  tags?: string[]
  /** Created timestamp */
  createdAt: number
  /** Updated timestamp */
  updatedAt: number
  /** Is @me in last message */
  isAtMe?: boolean
  /** Is official/bot account */
  isOfficial?: boolean
  /** Member count (for groups) */
  memberNum?: number
  /** Group remark */
  remark?: string
  /** My display name in group */
  myName?: string
  /** Account identifier */
  account?: string
  /** Detail ID (user ID for direct chats) */
  detailId?: string
}

/**
 * Session category for grouping
 */
export interface SessionCategory {
  id: string
  name: string
  color?: string
  order: number
}

/**
 * Chat list filter options
 */
export interface ChatListFilter {
  /** Search keyword */
  keyword?: string
  /** Session type filter */
  type?: ChatSessionType[] | 'all'
  /** Category filter */
  category?: string
  /** Show pinned only */
  pinnedOnly?: boolean
  /** Show unread only */
  unreadOnly?: boolean
  /** Show muted only */
  mutedOnly?: boolean
}

/**
 * Convert SessionItem to ChatSession
 */
export function toChatSession(item: SessionItem): ChatSession {
  const typeMap: Partial<Record<RoomTypeEnum, ChatSessionType>> = {
    [RoomTypeEnum.SINGLE]: 'direct',
    [RoomTypeEnum.GROUP]: 'group'
  }

  return {
    id: item.id,
    roomId: item.roomId,
    name: item.name,
    avatar: item.avatar,
    type: typeMap[item.type] || 'direct',
    lastMsg: item.text,
    activeTime: item.activeTime,
    unreadCount: item.unreadCount,
    isPinned: item.top,
    isMuted: item.muteNotification === NotificationTypeEnum.NOT_DISTURB,
    isShielded: item.shield,
    onlineStatus: item.activeStatus === OnlineEnum.ONLINE ? 'online' : 'offline',
    memberNum: item.memberNum,
    remark: item.remark,
    myName: item.myName,
    account: item.account,
    detailId: item.detailId,
    createdAt: item.activeTime,
    updatedAt: item.activeTime
  }
}

/**
 * Convert ChatSession back to SessionItem (partial)
 */
export function fromChatSession(session: ChatSession): Partial<SessionItem> {
  const typeMap: Partial<Record<ChatSessionType, RoomTypeEnum>> = {
    direct: RoomTypeEnum.SINGLE,
    group: RoomTypeEnum.GROUP
  }

  return {
    id: session.id,
    roomId: session.roomId,
    name: session.name,
    avatar: session.avatar,
    type: typeMap[session.type] || RoomTypeEnum.SINGLE,
    text: session.lastMsg,
    activeTime: session.activeTime,
    unreadCount: session.unreadCount,
    top: session.isPinned,
    muteNotification: session.isMuted ? NotificationTypeEnum.NOT_DISTURB : NotificationTypeEnum.RECEPTION,
    shield: session.isShielded,
    memberNum: session.memberNum,
    remark: session.remark,
    myName: session.myName
  }
}

/**
 * Session menu item interface
 */
export interface SessionMenuItem {
  /** Menu label (static or function) */
  label: string | ((item: SessionItem) => string)
  /** Icon name (static or function) */
  icon: string | ((item: SessionItem) => string)
  /** Is disabled */
  disabled?: boolean | ((item: SessionItem) => boolean)
  /** Is visible */
  visible?: boolean | ((item: SessionItem) => boolean)
  /** Click handler */
  click?: (item: SessionItem) => void | Promise<void>
  /** Child menu items */
  children?: SessionMenuItem[] | ((item: SessionItem) => SessionMenuItem[])
  /** Action handler (alternative to click) */
  action?: (item: SessionItem) => void | Promise<void>
}

/**
 * Chat list props
 */
export interface ChatListProps {
  /** Session items */
  sessions: SessionItem[]
  /** Current session room ID */
  currentRoomId?: string
  /** Show search bar */
  showSearch?: boolean
  /** Enable virtual scroll */
  virtualScroll?: boolean
  /** Item height for virtual scroll */
  itemHeight?: number
  /** Loading state */
  loading?: boolean
  /** Empty state */
  empty?: boolean
  /** Search placeholder */
  searchPlaceholder?: string
  /** Custom item render */
  itemRender?: (item: SessionItem, index: number) => void
}

/**
 * Chat list emits
 */
export interface ChatListEmits {
  /** Session click */
  (event: 'click', item: SessionItem): void
  /** Session double click */
  (event: 'dblclick', item: SessionItem): void
  /** Session context menu */
  (event: 'contextmenu', item: SessionItem, mouseEvent: MouseEvent): void
  /** Search input */
  (event: 'search', keyword: string): void
  /** Load more */
  (event: 'loadmore'): void
  /** Refresh */
  (event: 'refresh'): void
}
