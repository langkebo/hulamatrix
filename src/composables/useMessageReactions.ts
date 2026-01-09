/**
 * useMessageReactions - Shared message reactions composable
 *
 * This composable extracts common message reaction logic that can be shared
 * between desktop and mobile components, reducing code duplication.
 *
 * Phase 12 Optimization: Extract shared logic from duplicate components
 */

import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { logger } from '@/utils/logger'
import { msg } from '@/utils/SafeUI'
import {
  getMessageReactions as matrixGetMessageReactions,
  toggleMessageReaction as matrixToggleReaction,
  getReactionCategories,
  getPopularReactions,
  type ReactionSummary,
  type ReactionCategory
} from '@/integrations/matrix/reactions'
import { flags } from '@/utils/envFlags'

// Type definitions
export interface MessageReaction {
  emoji: string
  count: number
  users: string[]
  hasReacted: boolean
}

export interface ReactionsState {
  [messageId: string]: {
    [emoji: string]: MessageReaction
  }
}

// ReactionData type (matching Matrix module's internal structure)
export interface ReactionData {
  key: string
  count: number
  userMarked: boolean
  users?: string[]
}

// Re-export Matrix types for convenience
export type { ReactionSummary, ReactionCategory }

export interface MessageReactionsOptions {
  roomId: Ref<string> | string
  eventId?: Ref<string> | string
  initialReactions?: Ref<ReactionsState> | ReactionsState
}

export interface MessageReactionsResult {
  // State
  isLoading: Ref<boolean>
  reactions: Ref<Record<string, ReactionData>>
  reactionSummary: ComputedRef<ReactionSummary | null>
  hasReacted: (messageId: string, emoji: string) => boolean

  // Operations
  fetchReactions: (messageId?: string) => Promise<void>
  toggleReaction: (messageId: string, emoji: string) => Promise<void>
  addReaction: (messageId: string, emoji: string) => Promise<void>
  removeReaction: (messageId: string, emoji: string) => Promise<void>

  // Utilities
  getReactionCount: (messageId: string, emoji: string) => number
  getAllReactionCounts: (messageId: string) => number
  getTopReactions: (messageId: string, limit?: number) => MessageReaction[]

  // Matrix utilities
  getCategories: () => ReactionCategory[]
  getPopularReactions: () => string[]
}

// Common reactions
export const COMMON_REACTIONS = getPopularReactions()

// Helper type for the function result
type TopReactionItem = {
  emoji: string
  count: number
  users: string[]
  hasReacted: boolean
}

/**
 * Composable for shared message reactions logic
 */
export function useMessageReactions(options: MessageReactionsOptions): MessageReactionsResult {
  const { t } = useI18n()
  const isLoading = ref(false)
  const reactionSummary = ref<ReactionSummary | null>(null)

  // Helper functions to get room and event IDs
  const getRoomId = (): string => {
    return typeof options.roomId === 'string' ? options.roomId : options.roomId.value
  }

  const getEventId = (): string | undefined => {
    if (!options.eventId) return undefined
    return typeof options.eventId === 'string' ? options.eventId : options.eventId.value
  }

  // Check if user has reacted with specific emoji
  const hasReacted = (_messageId: string, emoji: string): boolean => {
    if (!reactionSummary.value) return false
    const reaction = reactionSummary.value.reactions[emoji]
    return !!reaction?.userMarked
  }

  // Fetch reactions for a message
  const fetchReactions = async (messageId?: string): Promise<void> => {
    if (!flags.matrixReactionsEnabled) return

    const eventId = messageId || getEventId()
    if (!eventId) return

    const roomId = getRoomId()
    isLoading.value = true

    try {
      logger.info('[useMessageReactions] Fetching reactions', { roomId, eventId })
      reactionSummary.value = await matrixGetMessageReactions(roomId, eventId)
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('[useMessageReactions] Failed to fetch reactions', err)
      msg.error(t('errors.fetchReactionsFailed'))
    } finally {
      isLoading.value = false
    }
  }

  // Toggle a reaction
  const toggleReaction = async (messageId: string, emoji: string): Promise<void> => {
    if (!flags.matrixReactionsEnabled) return

    const roomId = getRoomId()
    isLoading.value = true

    try {
      logger.info('[useMessageReactions] Toggling reaction', { roomId, messageId, emoji })
      const added = await matrixToggleReaction(roomId, messageId, emoji)

      if (added) {
        msg.success(t('reaction.added', { reaction: emoji }))
      } else {
        msg.info(t('reaction.removed', { reaction: emoji }))
      }

      await fetchReactions(messageId)
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('[useMessageReactions] Failed to toggle reaction', err)
      msg.error(t('errors.toggleReactionFailed'))
    } finally {
      isLoading.value = false
    }
  }

  // Add a reaction (uses toggle)
  const addReaction = async (messageId: string, emoji: string): Promise<void> => {
    await toggleReaction(messageId, emoji)
  }

  // Remove a reaction (uses toggle)
  const removeReaction = async (messageId: string, emoji: string): Promise<void> => {
    await toggleReaction(messageId, emoji)
  }

  // Get count for specific emoji
  const getReactionCount = (_messageId: string, emoji: string): number => {
    if (!reactionSummary.value) return 0
    return reactionSummary.value.reactions[emoji]?.count ?? 0
  }

  // Get total count for message
  const getAllReactionCounts = (_messageId: string): number => {
    if (!reactionSummary.value) return 0
    return Object.values(reactionSummary.value.reactions).reduce((sum, r) => sum + r.count, 0)
  }

  // Get top reactions by count
  const getTopReactions = (_messageId: string, limit: number = 5): MessageReaction[] => {
    if (!reactionSummary.value) return []

    const items: TopReactionItem[] = Object.values(reactionSummary.value.reactions).map((r) => ({
      emoji: r.key,
      count: r.count,
      users: r.users || [],
      hasReacted: r.userMarked
    }))

    items.sort((a, b) => b.count - a.count)
    return items.slice(0, limit) as MessageReaction[]
  }

  // Auto-fetch on mount
  const eventId = getEventId()
  if (eventId) {
    fetchReactions(eventId)
  }

  // Watch for changes
  watch(
    [getRoomId, getEventId],
    () => {
      const newEventId = getEventId()
      if (newEventId && flags.matrixReactionsEnabled) {
        fetchReactions(newEventId)
      }
    },
    { immediate: true }
  )

  // Computed states
  const reactionsState = computed(() => {
    if (!reactionSummary.value) return {}
    return reactionSummary.value.reactions
  })

  const summaryState = computed(() => reactionSummary.value)

  // Return result
  return {
    isLoading,
    reactions: reactionsState,
    reactionSummary: summaryState,
    hasReacted,
    fetchReactions,
    toggleReaction,
    addReaction,
    removeReaction,
    getReactionCount,
    getAllReactionCounts,
    getTopReactions,
    getCategories: getReactionCategories,
    getPopularReactions
  }
}

/**
 * Format reaction count for display
 */
export function formatReactionCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`
  }
  return String(count)
}

/**
 * Check if an emoji is a valid reaction emoji
 */
export function isValidReactionEmoji(emoji: string): boolean {
  return /^[\p{Emoji}\u200d]+/u.test(emoji) || COMMON_REACTIONS.includes(emoji)
}
