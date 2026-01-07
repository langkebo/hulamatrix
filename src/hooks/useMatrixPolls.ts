/**
 * useMatrixPolls Hook
 * Composable for managing Matrix Polls
 *
 * @module hooks/useMatrixPolls
 */

import { ref, computed, onUnmounted } from 'vue'
import { matrixPollService, type Poll, type PollResults, type CreatePollOptions } from '@/services/matrixPollService'
import { logger } from '@/utils/logger'

export interface UseMatrixPollsOptions {
  roomId?: string
  autoLoad?: boolean
}

export function useMatrixPolls(options: UseMatrixPollsOptions = {}) {
  const { roomId, autoLoad = true } = options

  // State
  const polls = ref<Map<string, Poll>>(new Map())
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const pollsList = computed(() => Array.from(polls.value.values()))
  const activePolls = computed(() => pollsList.value.filter((p) => !p.isEnded))
  const endedPolls = computed(() => pollsList.value.filter((p) => p.isEnded))

  /**
   * Load polls for a room
   */
  const loadPolls = async (targetRoomId: string) => {
    if (!targetRoomId) {
      logger.warn('[useMatrixPolls] No room ID provided')
      return
    }

    loading.value = true
    error.value = null

    try {
      logger.info('[useMatrixPolls] Loading polls for room', { roomId: targetRoomId })

      const roomPolls = matrixPollService.getRoomPolls(targetRoomId)

      // Update state
      const newPollMap = new Map<string, Poll>()
      for (const poll of roomPolls) {
        newPollMap.set(poll.id, poll)
      }
      polls.value = newPollMap

      logger.info('[useMatrixPolls] Polls loaded', {
        total: roomPolls.length,
        active: activePolls.value.length,
        ended: endedPolls.value.length
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load polls'
      error.value = errorMessage
      logger.error('[useMatrixPolls] Failed to load polls:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * Create a new poll
   */
  const createPoll = async (targetRoomId: string, pollOptions: CreatePollOptions): Promise<string | null> => {
    if (!targetRoomId) {
      error.value = 'No room ID provided'
      return null
    }

    loading.value = true
    error.value = null

    try {
      logger.info('[useMatrixPolls] Creating poll', { roomId: targetRoomId, pollOptions })

      const pollId = await matrixPollService.createPoll(targetRoomId, pollOptions)

      // Reload polls
      await loadPolls(targetRoomId)

      logger.info('[useMatrixPolls] Poll created', { pollId, roomId: targetRoomId })

      return pollId
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create poll'
      error.value = errorMessage
      logger.error('[useMatrixPolls] Failed to create poll:', err)
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Vote on a poll
   */
  const vote = async (targetRoomId: string, pollId: string, selectedAnswers: string[]): Promise<void> => {
    if (!targetRoomId) {
      error.value = 'No room ID provided'
      return
    }

    loading.value = true
    error.value = null

    try {
      logger.info('[useMatrixPolls] Voting on poll', { roomId: targetRoomId, pollId, selectedAnswers })

      await matrixPollService.respondToPoll(targetRoomId, pollId, selectedAnswers)

      // Update the poll in state
      const _results = matrixPollService.getPollResults(targetRoomId, pollId)
      const poll = polls.value.get(pollId)
      if (poll) {
        // Trigger reactivity by creating a new map entry
        polls.value.set(pollId, { ...poll })
      }

      logger.info('[useMatrixPolls] Vote submitted', { pollId })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to vote'
      error.value = errorMessage
      logger.error('[useMatrixPolls] Failed to vote:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * End a poll
   */
  const endPoll = async (targetRoomId: string, pollId: string): Promise<void> => {
    if (!targetRoomId) {
      error.value = 'No room ID provided'
      return
    }

    loading.value = true
    error.value = null

    try {
      logger.info('[useMatrixPolls] Ending poll', { roomId: targetRoomId, pollId })

      // Get results before ending
      const results = matrixPollService.getPollResults(targetRoomId, pollId)

      await matrixPollService.endPoll(targetRoomId, pollId, results)

      // Update the poll in state
      const poll = polls.value.get(pollId)
      if (poll) {
        poll.isEnded = true
        polls.value.set(pollId, { ...poll })
      }

      logger.info('[useMatrixPolls] Poll ended', { pollId })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to end poll'
      error.value = errorMessage
      logger.error('[useMatrixPolls] Failed to end poll:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * Get poll results
   */
  const getPollResults = (targetRoomId: string, pollId: string): PollResults => {
    return matrixPollService.getPollResults(targetRoomId, pollId)
  }

  /**
   * Get current user's vote
   */
  const getUserVote = (targetRoomId: string, pollId: string): string[] | null => {
    return matrixPollService.getUserVote(targetRoomId, pollId)
  }

  /**
   * Get a specific poll
   */
  const getPoll = (pollId: string): Poll | undefined => {
    return polls.value.get(pollId)
  }

  /**
   * Refresh polls
   */
  const refresh = async (targetRoomId?: string): Promise<void> => {
    const roomIdToUse = targetRoomId || roomId
    if (roomIdToUse) {
      await loadPolls(roomIdToUse)
    }
  }

  // Cleanup
  const cleanup = () => {
    logger.debug('[useMatrixPolls] Cleanup')
  }

  // Setup event listeners
  const unsubscribePollStart = matrixPollService.onPollStart((poll) => {
    polls.value.set(poll.id, poll)
    logger.debug('[useMatrixPolls] New poll added', { pollId: poll.id })
  })

  const unsubscribePollResponse = matrixPollService.onPollResponse((_pollId, _userId, _answers) => {
    // Trigger reactivity for the poll
    const poll = polls.value.get(_pollId)
    if (poll) {
      polls.value.set(_pollId, { ...poll })
    }
  })

  const unsubscribePollEnd = matrixPollService.onPollEnd((_pollId, _results) => {
    const poll = polls.value.get(_pollId)
    if (poll) {
      poll.isEnded = true
      polls.value.set(_pollId, { ...poll })
    }
    logger.debug('[useMatrixPolls] Poll ended', { pollId: _pollId })
  })

  // Auto load
  if (autoLoad && roomId) {
    loadPolls(roomId)
  }

  // Component unmount
  onUnmounted(() => {
    cleanup()
    unsubscribePollStart()
    unsubscribePollResponse()
    unsubscribePollEnd()
  })

  return {
    // State
    polls,
    pollsList,
    activePolls,
    endedPolls,
    loading,
    error,

    // Methods
    loadPolls,
    createPoll,
    vote,
    endPoll,
    getPollResults,
    getUserVote,
    getPoll,
    refresh,
    cleanup
  }
}
