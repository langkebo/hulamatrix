/**
 * Matrix message reactions functionality
 */

import { matrixClientService } from './client'

// Type definitions for Matrix SDK objects
interface MatrixClientLike {
  sendEvent?(roomId: string, eventType: string, content: Record<string, unknown>): Promise<void>
  relations?(
    roomId: string,
    eventId: string,
    relationType: string,
    options?: Record<string, unknown>
  ): Promise<RelationsResponseLike>
  redactEvent?(roomId: string, eventId: string, reason?: string): Promise<void>
  getUserId?(): string
  [key: string]: unknown
}

interface RelationsResponseLike {
  events?: MatrixEventLike[]
  chunk?: MatrixEventLike[]
  [key: string]: unknown
}

interface MatrixEventLike {
  getId?(): string
  getSender?(): string
  getContent?<T = Record<string, unknown>>(): T
  content?: Record<string, unknown>
  [key: string]: unknown
}

interface ReactionData {
  key: string
  count: number
  userMarked: boolean
  users?: string[]
  [key: string]: unknown
}

export interface ReactionSummary {
  eventId: string
  reactions: {
    [key: string]: ReactionData
  }
  totalCount: number
  hasCurrentUserReaction: boolean
}

export interface ReactionCategory {
  name: string
  reactions: string[]
}

/**
 * Add a reaction to a message
 */
export async function addMessageReaction(roomId: string, eventId: string, reaction: string): Promise<boolean> {
  try {
    const client = matrixClientService.getClient() as unknown as MatrixClientLike
    if (!client) return false

    // Validate reaction length
    if (reaction.length > 10) return false

    await client.sendEvent?.(roomId, 'm.reaction', {
      'm.relates_to': {
        rel_type: 'm.annotation',
        event_id: eventId,
        key: reaction
      }
    })

    return true
  } catch (_error) {
    return false
  }
}

/**
 * Remove a reaction from a message
 */
export async function removeMessageReaction(roomId: string, eventId: string, reaction: string): Promise<boolean> {
  try {
    const client = matrixClientService.getClient() as unknown as MatrixClientLike
    if (!client) return false

    // Find existing reaction event
    const relations = await client.relations?.(roomId, eventId, 'm.annotation')
    const events = relations?.events || relations?.chunk || []
    const reactionEvents = events.filter((event: MatrixEventLike) => {
      const content = typeof event.getContent === 'function' ? event.getContent() : event.content
      const relatesTo = content?.['m.relates_to'] as Record<string, unknown> | undefined
      return relatesTo?.key === reaction && relatesTo?.event_id === eventId
    })

    if (reactionEvents.length === 0) return false

    // Redact the reaction event
    const firstEvent = reactionEvents[0]
    const id = typeof firstEvent?.getId === 'function' ? firstEvent.getId() : ''
    await client.redactEvent?.(roomId, id)

    return true
  } catch (_error) {
    return false
  }
}

/**
 * Toggle a reaction (add if not present, remove if present)
 */
export async function toggleMessageReaction(roomId: string, eventId: string, reaction: string): Promise<boolean> {
  try {
    const client = matrixClientService.getClient() as unknown as MatrixClientLike
    if (!client) return false

    // Check if user has already reacted
    const hasReacted = await hasUserReaction(roomId, eventId, reaction)

    if (hasReacted) {
      await removeMessageReaction(roomId, eventId, reaction)
      return false // Reaction was removed
    } else {
      await addMessageReaction(roomId, eventId, reaction)
      return true // Reaction was added
    }
  } catch (_error) {
    return false
  }
}

/**
 * Check if current user has reacted with a specific reaction
 */
export async function hasUserReaction(roomId: string, eventId: string, reaction: string): Promise<boolean> {
  try {
    const client = matrixClientService.getClient() as unknown as MatrixClientLike
    if (!client) return false

    const userId = client.getUserId?.()
    if (!userId) return false

    const relations = await client.relations?.(roomId, eventId, 'm.annotation')
    const events = relations?.events || relations?.chunk || []
    const userReactions = events.filter((event: MatrixEventLike) => {
      const content = typeof event.getContent === 'function' ? event.getContent() : event.content
      const relatesTo = content?.['m.relates_to'] as Record<string, unknown> | undefined
      const sender = typeof event.getSender === 'function' ? event.getSender() : (event['sender'] as string)
      return sender === userId && relatesTo?.key === reaction && relatesTo?.event_id === eventId
    })

    return userReactions.length > 0
  } catch (_error) {
    return false
  }
}

/**
 * Get all reactions for a message
 */
export async function getMessageReactions(roomId: string, eventId: string): Promise<ReactionSummary> {
  try {
    const client = matrixClientService.getClient() as unknown as MatrixClientLike
    if (!client) {
      return {
        eventId,
        reactions: {},
        totalCount: 0,
        hasCurrentUserReaction: false
      }
    }

    const userId = client.getUserId?.()
    const relations = await client.relations?.(roomId, eventId, 'm.annotation')
    const events = relations?.events || relations?.chunk || []
    const reactions: Record<string, ReactionData> = {}
    let hasCurrentUserReaction = false

    events.forEach((event: MatrixEventLike) => {
      const content = typeof event.getContent === 'function' ? event.getContent() : event.content
      const relation = content?.['m.relates_to'] as Record<string, unknown> | undefined

      if (relation?.rel_type === 'm.annotation' && relation?.event_id === eventId) {
        const key = String(relation.key || '')
        const sender = typeof event.getSender === 'function' ? event.getSender() : (event['sender'] as string)

        if (!reactions[key]) {
          reactions[key] = {
            key,
            count: 0,
            userMarked: false,
            users: []
          }
        }

        reactions[key].count++
        if (reactions[key].users && sender) {
          reactions[key].users!.push(sender)
        }

        if (sender === userId) {
          reactions[key].userMarked = true
          hasCurrentUserReaction = true
        }
      }
    })

    const totalCount = Object.values(reactions).reduce((sum: number, r: ReactionData) => sum + r.count, 0)

    return {
      eventId,
      reactions,
      totalCount,
      hasCurrentUserReaction
    }
  } catch (_error) {
    return {
      eventId,
      reactions: {},
      totalCount: 0,
      hasCurrentUserReaction: false
    }
  }
}

/**
 * Get popular reactions list
 */
export function getPopularReactions(): string[] {
  return [
    '👍',
    '👎',
    '❤️',
    '😄',
    '😂',
    '😮',
    '😢',
    '😠',
    '🎉',
    '🎈',
    '🎁',
    '👏',
    '🙌',
    '👋',
    '🤝',
    '💪',
    '🙏',
    '✨',
    '🔥',
    '💯',
    '🌟',
    '🚀',
    '💥',
    '⚡',
    '🌈',
    '🦄',
    '🎯',
    '🏆',
    '👑',
    '💎',
    '🌸'
  ]
}

/**
 * Get reaction categories
 */
export function getReactionCategories(): ReactionCategory[] {
  return [
    {
      name: '表情',
      reactions: ['😀', '😃', '😄', '😁', '😆', '😂', '🤣', '😭', '😢', '😿']
    },
    {
      name: '手势',
      reactions: ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '👏', '🙌', '👐']
    },
    {
      name: '爱心',
      reactions: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔']
    },
    {
      name: '动物',
      reactions: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯']
    },
    {
      name: '食物',
      reactions: ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🥝', '🍅', '🥑']
    }
  ]
}
