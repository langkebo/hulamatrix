/**
 * Chat List Filter Utilities
 *
 * Utilities for filtering and searching chat sessions
 *
 * @module utils/chatListFilter
 */

import type { SessionItem } from '@/services/types'
import type { ChatListFilter } from '@/types/chat'
import { RoomTypeEnum, NotificationTypeEnum } from '@/enums'

/**
 * Filter sessions by keyword
 */
export function filterByKeyword(sessions: SessionItem[], keyword: string): SessionItem[] {
  if (!keyword.trim()) return sessions

  const lowerKeyword = keyword.toLowerCase()
  return sessions.filter((item) => {
    const nameMatch = item.name.toLowerCase().includes(lowerKeyword)
    const messageMatch = item.text?.toLowerCase().includes(lowerKeyword)
    const accountMatch = item.account?.toLowerCase().includes(lowerKeyword)
    return nameMatch || messageMatch || accountMatch
  })
}

/**
 * Filter sessions by type
 */
export function filterByType(sessions: SessionItem[], types: RoomTypeEnum[] | 'all'): SessionItem[] {
  if (types === 'all') return sessions
  const roomTypes = types as RoomTypeEnum[]
  return sessions.filter((item) => roomTypes.includes(item.type))
}

/**
 * Filter pinned sessions
 */
export function filterPinned(sessions: SessionItem[]): SessionItem[] {
  return sessions.filter((item) => item.top)
}

/**
 * Filter unpinned sessions
 */
export function filterUnpinned(sessions: SessionItem[]): SessionItem[] {
  return sessions.filter((item) => !item.top)
}

/**
 * Filter unread sessions
 */
export function filterUnread(sessions: SessionItem[]): SessionItem[] {
  return sessions.filter((item) => item.unreadCount > 0)
}

/**
 * Filter muted sessions
 */
export function filterMuted(sessions: SessionItem[]): SessionItem[] {
  return sessions.filter((item) => item.muteNotification === NotificationTypeEnum.NOT_DISTURB)
}

/**
 * Filter shielded sessions
 */
export function filterShielded(sessions: SessionItem[]): SessionItem[] {
  return sessions.filter((item) => item.shield)
}

/**
 * Filter by category
 */
export function filterByCategory(sessions: SessionItem[], category: string): SessionItem[] {
  switch (category) {
    case 'pinned':
      return filterPinned(sessions)
    case 'unread':
      return filterUnread(sessions)
    case 'direct':
      return filterByType(sessions, [RoomTypeEnum.SINGLE])
    case 'group':
      return filterByType(sessions, [RoomTypeEnum.GROUP])
    case 'muted':
      return filterMuted(sessions)
    default:
      return sessions
  }
}

/**
 * Apply multiple filters
 */
export function applyFilters(sessions: SessionItem[], filter: ChatListFilter): SessionItem[] {
  let result = [...sessions]

  // Apply keyword filter
  if (filter.keyword) {
    result = filterByKeyword(result, filter.keyword)
  }

  // Apply type filter
  if (filter.type && filter.type !== 'all') {
    // Convert ChatSessionType[] to RoomTypeEnum[] if needed
    const chatTypes = filter.type
    if (Array.isArray(chatTypes)) {
      // Map chat session types to room types
      const roomTypeMap: Record<string, RoomTypeEnum> = {
        direct: RoomTypeEnum.SINGLE,
        group: RoomTypeEnum.GROUP,
        channel: RoomTypeEnum.SINGLE,
        space: RoomTypeEnum.GROUP
      }
      const roomTypes = chatTypes.map((t) => roomTypeMap[t]).filter(Boolean) as RoomTypeEnum[]
      result = filterByType(result, roomTypes)
    }
  }

  // Apply category filter
  if (filter.category) {
    result = filterByCategory(result, filter.category)
  }

  // Apply pinned only filter
  if (filter.pinnedOnly) {
    result = filterPinned(result)
  }

  // Apply unread only filter
  if (filter.unreadOnly) {
    result = filterUnread(result)
  }

  // Apply muted only filter
  if (filter.mutedOnly) {
    result = filterMuted(result)
  }

  return result
}

/**
 * Sort sessions by pinned status and active time
 */
export function sortSessions(sessions: SessionItem[]): SessionItem[] {
  return [...sessions].sort((a, b) => {
    // First sort by pinned status (pinned first)
    if (a.top && !b.top) return -1
    if (!a.top && b.top) return 1

    // Then sort by active time (most recent first)
    return b.activeTime - a.activeTime
  })
}

/**
 * Group sessions by category
 */
export function groupSessionsByCategory(sessions: SessionItem[]): Record<string, SessionItem[]> {
  return {
    pinned: sessions.filter((item) => item.top),
    direct: sessions.filter((item) => item.type === RoomTypeEnum.SINGLE && !item.top),
    group: sessions.filter((item) => item.type === RoomTypeEnum.GROUP && !item.top),
    unread: sessions.filter((item) => item.unreadCount > 0),
    muted: sessions.filter((item) => item.muteNotification === NotificationTypeEnum.NOT_DISTURB)
  }
}

/**
 * Get session statistics
 */
export interface SessionStats {
  total: number
  pinned: number
  unread: number
  muted: number
  direct: number
  group: number
  totalUnreadCount: number
}

export function getSessionStats(sessions: SessionItem[]): SessionStats {
  return {
    total: sessions.length,
    pinned: sessions.filter((item) => item.top).length,
    unread: sessions.filter((item) => item.unreadCount > 0).length,
    muted: sessions.filter((item) => item.muteNotification === NotificationTypeEnum.NOT_DISTURB).length,
    direct: sessions.filter((item) => item.type === RoomTypeEnum.SINGLE).length,
    group: sessions.filter((item) => item.type === RoomTypeEnum.GROUP).length,
    totalUnreadCount: sessions.reduce((sum, item) => {
      // Don't count muted or shielded sessions
      if (item.muteNotification === NotificationTypeEnum.NOT_DISTURB || item.shield) {
        return sum
      }
      return sum + Math.max(0, item.unreadCount)
    }, 0)
  }
}

/**
 * Search and highlight matching text
 */
export function highlightMatch(text: string, keyword: string): string {
  if (!keyword.trim()) return text

  const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return text.replace(regex, '<mark>$1</mark>')
}

/**
 * Debounce function for search input
 */
export function createSearchDebounce(delay = 300) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return <T extends (...args: unknown[]) => unknown>(fn: T): ((...args: Parameters<T>) => void) => {
    return (...args: Parameters<T>) => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      timeoutId = setTimeout(() => {
        fn(...args)
      }, delay)
    }
  }
}

/**
 * Default filter configuration
 */
export const DEFAULT_FILTER: ChatListFilter = {
  keyword: '',
  type: 'all',
  category: 'all',
  pinnedOnly: false,
  unreadOnly: false
}

/**
 * Category definitions
 */
export const SESSION_CATEGORIES = [
  { id: 'all', name: '全部', order: 0 },
  { id: 'pinned', name: '置顶', order: 1 },
  { id: 'unread', name: '未读', order: 2 },
  { id: 'direct', name: '私信', order: 3 },
  { id: 'group', name: '群组', order: 4 },
  { id: 'muted', name: '免打扰', order: 5 }
] as const

/**
 * Type export for categories
 */
export type SessionCategoryId = (typeof SESSION_CATEGORIES)[number]['id']
