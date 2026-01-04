/**
 * Chat Main - Helper Functions Module
 *
 * Utility functions for chat operations
 */

import type { MessageType } from '@/services/types'
import { MsgEnum } from '@/enums'
import { useFriendsStore } from '@/stores/friends'
import { logger } from '@/utils/logger'

/**
 * Check friend relation status
 * @param uid - The user ID to check
 * @param type - Check type: 'friend' for friends only, 'all' for any relation
 * @returns true if the relation matches the type, false otherwise
 */
export function checkFriendRelation(uid: string, type: 'friend' | 'all' = 'all'): boolean {
  if (!uid) return false

  try {
    const friendsStore = useFriendsStore()

    // Check if user is a friend
    const isFriend = friendsStore.isFriend(uid)

    // For 'friend' type, only return true if the user is a friend
    if (type === 'friend') {
      return isFriend
    }

    // For 'all' type, return true for any relation (friend or other)
    // Currently only friends are supported, but this could be extended
    return isFriend
  } catch (error) {
    // If store is not available or other error, return false
    logger.warn('[checkFriendRelation] Failed to check friend relation:', error)
    return false
  }
}

/**
 * Check if message is a notice message
 */
export function isNoticeMessage(item: MessageType): boolean {
  // Check if the message type is NOTICE or SYSTEM (for Matrix notice messages)
  return item.message?.type === MsgEnum.NOTICE || item.message?.type === MsgEnum.SYSTEM
}

/**
 * Check if copy should be hidden for message type
 */
const COPY_DISABLED_TYPES = [
  MsgEnum.NOTICE,
  MsgEnum.MERGE,
  MsgEnum.LOCATION,
  MsgEnum.VOICE,
  MsgEnum.VIDEO,
  MsgEnum.FILE
]

export function shouldHideCopy(item: MessageType): boolean {
  // Check if the message type is in the disabled list
  return item.message?.type ? COPY_DISABLED_TYPES.includes(item.message.type) : false
}

/**
 * Extract message ID from data key
 * dataKey format: "message_${messageId}_${random}"
 */
export function extractMsgIdFromDataKey(dataKey?: string | null): string {
  if (!dataKey) return ''
  const parts = dataKey.split('_')
  return parts[1] || ''
}

/**
 * Resolve selection to message ID
 */
export function resolveSelectionMessageId(selection: {
  baseNodeId?: string
  extentNodeId?: string
  [key: string]: unknown
}): string {
  if (selection.baseNodeId) {
    return extractMsgIdFromDataKey(selection.baseNodeId)
  }
  if (selection.extentNodeId) {
    return extractMsgIdFromDataKey(selection.extentNodeId)
  }
  return ''
}

/**
 * Get user initials from display name
 */
export function getUserInitials(displayName?: string): string {
  if (!displayName) return '?'
  const names = displayName.split(' ')
  if (names.length >= 2) {
    const first = names[0]
    const second = names[1]
    if (first && second) {
      const firstChar = first[0]
      const secondChar = second[0]
      if (firstChar !== undefined && secondChar !== undefined) {
        return firstChar + secondChar
      }
    }
  }
  return displayName.substring(0, 2).toUpperCase()
}

/**
 * Report list options
 */
export const REPORT_REASONS = [
  { label: 'spam', value: 'spam' },
  { label: 'inappropriate', value: 'inappropriate' },
  { label: 'violence', value: 'violence' },
  { label: 'other', value: 'other' }
]
