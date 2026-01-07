/**
 * Matrix Poll Service
 * Handles poll creation, voting, and result management using MSC 3381
 *
 * @module services/matrixPollService
 */

import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'

// Type definitions for Matrix SDK objects
interface MatrixClientLike {
  getUserId?(): string
  sendEvent?(
    roomId: string,
    eventType: string,
    content: Record<string, unknown>
  ): Promise<{ event_id?: string } | string>
  getRoom?(roomId: string): MatrixRoomLike | null
}

interface MatrixRoomLike {
  roomId: string
  getLiveTimeline?(): MatrixTimelineLike | null
  findEventById?(eventId: string): MatrixEventLike | null
}

interface MatrixTimelineLike {
  getEvents?(): MatrixEventLike[]
}

interface MatrixEventLike {
  getId?(): string
  getType?(): string
  getSender?(): string
  getContent?(): Record<string, unknown>
}

/**
 * Poll kind (disclosed or undisclosed)
 */
export type PollKind = 'm.poll.disclosed' | 'm.poll.undisclosed'

/**
 * Poll answer option
 */
export interface PollAnswer {
  id: string
  text: string
}

/**
 * Poll start event data
 */
export interface PollStartData {
  question: {
    body: string
    format?: string
    formatted_body?: string
  }
  kind: PollKind
  max_selections: number
  answers: Array<{
    id: string
    'm.canvas': Array<{ body: string; type: string }>
  }>
  fallback_text: string
}

/**
 * Poll response event data
 */
export interface PollResponseData {
  'm.relates_to': {
    rel_type: string
    event_id: string
  }
  answers: string[]
}

/**
 * Poll end event data
 */
export interface PollEndData {
  'm.relates_to': {
    rel_type: string
    event_id: string
  }
  results?: Record<string, number>
  total?: number
  users?: Record<string, string[]>
  text?: string
}

/**
 * Complete poll information
 */
export interface Poll {
  id: string // Event ID of m.poll.start
  roomId: string
  question: string
  kind: PollKind
  maxSelections: number
  answers: PollAnswer[]
  senderId: string
  isEnded: boolean
  endData?: PollEndData
}

/**
 * Poll results
 */
export interface PollResults {
  results: Record<string, number>
  totalVotes: number
  votesByUser: Record<string, string[]>
  userVotes: Record<string, string[]> // Map userId -> answerIds
}

/**
 * Create poll options
 */
export interface CreatePollOptions {
  question: string
  answers: string[]
  maxSelections?: number
  disclosed?: boolean // true: show results, false: hide results
}

/**
 * Matrix Poll Service
 */
export class MatrixPollService {
  private static instance: MatrixPollService

  // Poll cache
  private pollCache: Map<string, Map<string, Poll>> = new Map() // roomId -> pollId -> poll

  // Event listeners
  private pollStartListeners: Set<(poll: Poll) => void> = new Set()
  private pollResponseListeners: Set<(pollId: string, userId: string, answers: string[]) => void> = new Set()
  private pollEndListeners: Set<(pollId: string, results: PollResults) => void> = new Set()

  static getInstance(): MatrixPollService {
    if (!MatrixPollService.instance) {
      MatrixPollService.instance = new MatrixPollService()
    }
    return MatrixPollService.instance
  }

  /**
   * Create a new poll
   */
  async createPoll(roomId: string, options: CreatePollOptions): Promise<string> {
    const client = matrixClientService.getClient() as unknown as MatrixClientLike
    if (!client) {
      throw new Error('Matrix client not available')
    }

    const { question, answers, maxSelections = 1, disclosed = true } = options

    // Validate inputs
    if (!question || question.trim().length === 0) {
      throw new Error('Question cannot be empty')
    }
    if (!answers || answers.length < 2) {
      throw new Error('Poll must have at least 2 answers')
    }
    if (answers.length > 20) {
      throw new Error('Poll cannot have more than 20 answers')
    }

    // Generate answer IDs
    const answerList = answers.map((text, index) => ({
      id: `option_${index}`,
      'm.canvas': [{ body: text, type: 'text' }]
    }))

    const pollStartData: PollStartData = {
      question: {
        body: question,
        format: 'org.matrix.custom.html',
        formatted_body: question
      },
      kind: disclosed ? 'm.poll.disclosed' : 'm.poll.undisclosed',
      max_selections: maxSelections,
      answers: answerList,
      fallback_text: `Poll: ${question}`
    }

    const sendEvent = client.sendEvent as (
      roomId: string,
      eventType: string,
      content: Record<string, unknown>
    ) => Promise<{ event_id?: string } | string>

    const response = await sendEvent?.(roomId, 'm.poll.start', {
      'm.poll.start': pollStartData,
      'm.message': [
        {
          body: `Poll: ${question}`,
          msgtype: 'm.text'
        }
      ]
    })

    const eventId = typeof response === 'string' ? response : response?.event_id || ''

    logger.info('[PollService] Poll created', { roomId, question, eventId })

    return eventId
  }

  /**
   * Respond to a poll
   */
  async respondToPoll(roomId: string, pollEventId: string, selectedAnswers: string[]): Promise<void> {
    const client = matrixClientService.getClient() as unknown as MatrixClientLike
    if (!client) {
      throw new Error('Matrix client not available')
    }

    // Validate inputs
    if (!selectedAnswers || selectedAnswers.length === 0) {
      throw new Error('Must select at least one answer')
    }

    const pollResponseData: PollResponseData = {
      'm.relates_to': {
        rel_type: 'm.reference',
        event_id: pollEventId
      },
      answers: selectedAnswers
    }

    const sendEvent = client.sendEvent as (
      roomId: string,
      eventType: string,
      content: Record<string, unknown>
    ) => Promise<{ event_id?: string } | string>

    await sendEvent?.(roomId, 'm.poll.response', {
      'm.poll.response': pollResponseData,
      'm.message': [
        {
          body: `I voted for ${selectedAnswers.length} option(s)`,
          msgtype: 'm.text'
        }
      ]
    })

    logger.info('[PollService] Poll response sent', { roomId, pollEventId, selectedAnswers })
  }

  /**
   * End a poll
   */
  async endPoll(roomId: string, pollEventId: string, results?: PollResults): Promise<void> {
    const client = matrixClientService.getClient() as unknown as MatrixClientLike
    if (!client) {
      throw new Error('Matrix client not available')
    }

    const pollEndData: PollEndData = {
      'm.relates_to': {
        rel_type: 'm.reference',
        event_id: pollEventId
      }
    }

    if (results) {
      pollEndData.results = results.results
      pollEndData.total = results.totalVotes
      pollEndData.users = {}
      // Convert votesByUser to users format
      Object.entries(results.votesByUser).forEach(([answerId, userIds]) => {
        pollEndData.users![answerId] = userIds
      })
    }

    const sendEvent = client.sendEvent as (
      roomId: string,
      eventType: string,
      content: Record<string, unknown>
    ) => Promise<{ event_id?: string } | string>

    await sendEvent?.(roomId, 'm.poll.end', {
      'm.poll.end': pollEndData,
      'm.message': [
        {
          body: results ? `Poll ended: ${results.totalVotes} total votes` : 'Poll ended',
          msgtype: 'm.text'
        }
      ]
    })

    logger.info('[PollService] Poll ended', { roomId, pollEventId })
  }

  /**
   * Get all polls in a room
   */
  getRoomPolls(roomId: string): Poll[] {
    const client = matrixClientService.getClient() as unknown as MatrixClientLike
    if (!client) {
      return []
    }

    const getRoom = client.getRoom as ((roomId: string) => MatrixRoomLike | null) | undefined
    const room = getRoom?.(roomId)
    if (!room) {
      return []
    }

    const getLiveTimeline = room.getLiveTimeline as (() => MatrixTimelineLike | null) | undefined
    const timeline = getLiveTimeline?.()
    if (!timeline) {
      return []
    }

    const getEvents = timeline.getEvents as (() => MatrixEventLike[]) | undefined
    const events = getEvents?.() || []

    const pollStartEvents = events.filter((e) => e.getType?.() === 'm.poll.start')

    const polls: Poll[] = []
    const pollMap = new Map<string, Poll>()

    for (const event of pollStartEvents) {
      const eventId = event.getId?.()
      if (!eventId) continue

      const content = event.getContent?.()
      const pollData = content?.['m.poll.start'] as PollStartData | undefined

      if (!pollData) continue

      const poll: Poll = {
        id: eventId,
        roomId,
        question: pollData.question.body,
        kind: pollData.kind,
        maxSelections: pollData.max_selections,
        answers: pollData.answers.map((a) => ({
          id: a.id,
          text: a['m.canvas'][0]?.body || ''
        })),
        senderId: event.getSender?.() || '',
        isEnded: false
      }

      polls.push(poll)
      pollMap.set(eventId, poll)
    }

    // Check for poll end events
    const pollEndEvents = events.filter((e) => e.getType?.() === 'm.poll.end')
    for (const event of pollEndEvents) {
      const content = event.getContent?.()
      const endData = content?.['m.poll.end'] as PollEndData | undefined
      const pollId = endData?.['m.relates_to']?.event_id

      if (pollId && pollMap.has(pollId)) {
        const poll = pollMap.get(pollId)!
        poll.isEnded = true
        poll.endData = endData
      }
    }

    // Update cache
    this.pollCache.set(roomId, pollMap)

    return polls
  }

  /**
   * Get poll results
   */
  getPollResults(roomId: string, pollEventId: string): PollResults {
    const client = matrixClientService.getClient() as unknown as MatrixClientLike
    if (!client) {
      return { results: {}, totalVotes: 0, votesByUser: {}, userVotes: {} }
    }

    const getRoom = client.getRoom as ((roomId: string) => MatrixRoomLike | null) | undefined
    const room = getRoom?.(roomId)
    if (!room) {
      return { results: {}, totalVotes: 0, votesByUser: {}, userVotes: {} }
    }

    // Get poll start event to get answer options
    const findEventById = room.findEventById as ((eventId: string) => MatrixEventLike | null) | undefined
    const pollEvent = findEventById?.(pollEventId)
    const pollData = pollEvent?.getContent?.()?.['m.poll.start'] as PollStartData | undefined

    if (!pollData) {
      return { results: {}, totalVotes: 0, votesByUser: {}, userVotes: {} }
    }

    // Initialize results with 0 votes for each answer
    const results: Record<string, number> = {}
    pollData.answers.forEach((a) => {
      results[a.id] = 0
    })

    const votesByUser: Record<string, string[]> = {}
    const userVotes: Record<string, string[]> = {}

    // Get all events
    const getLiveTimeline = room.getLiveTimeline as (() => MatrixTimelineLike | null) | undefined
    const timeline = getLiveTimeline?.()
    if (!timeline) {
      return { results, totalVotes: 0, votesByUser: {}, userVotes: {} }
    }

    const getEvents = timeline.getEvents as (() => MatrixEventLike[]) | undefined
    const events = getEvents?.() || []

    // Find all poll response events for this poll
    const responseEvents = events.filter((e) => {
      if (e.getType?.() !== 'm.poll.response') return false
      const content = e.getContent?.()
      const relatesTo = content?.['m.poll.response'] as PollResponseData | undefined
      return relatesTo?.['m.relates_to']?.event_id === pollEventId
    })

    // Count votes
    for (const event of responseEvents) {
      const sender = event.getSender?.()
      if (!sender) continue

      const content = event.getContent?.()
      const responseData = content?.['m.poll.response'] as PollResponseData | undefined
      const answers = responseData?.answers || []

      // Record user's vote
      userVotes[sender] = answers

      // Count votes for each answer
      for (const answerId of answers) {
        if (results[answerId] !== undefined) {
          results[answerId]++
          if (!votesByUser[answerId]) {
            votesByUser[answerId] = []
          }
          votesByUser[answerId].push(sender)
        }
      }
    }

    const totalVotes = Object.keys(userVotes).length

    return { results, totalVotes, votesByUser, userVotes }
  }

  /**
   * Get current user's vote for a poll
   */
  getUserVote(roomId: string, pollEventId: string): string[] | null {
    const client = matrixClientService.getClient() as unknown as MatrixClientLike
    if (!client) {
      return null
    }

    const userId = client.getUserId?.()
    if (!userId) {
      return null
    }

    const results = this.getPollResults(roomId, pollEventId)
    return results.userVotes[userId] || null
  }

  /**
   * Listen for poll start events
   */
  onPollStart(callback: (poll: Poll) => void): () => void {
    this.pollStartListeners.add(callback)
    return () => {
      this.pollStartListeners.delete(callback)
    }
  }

  /**
   * Listen for poll response events
   */
  onPollResponse(callback: (pollId: string, userId: string, answers: string[]) => void): () => void {
    this.pollResponseListeners.add(callback)
    return () => {
      this.pollResponseListeners.delete(callback)
    }
  }

  /**
   * Listen for poll end events
   */
  onPollEnd(callback: (pollId: string, results: PollResults) => void): () => void {
    this.pollEndListeners.add(callback)
    return () => {
      this.pollEndListeners.delete(callback)
    }
  }

  /**
   * Handle Matrix room event
   */
  handleEvent(event: MatrixEventLike, roomId: string): void {
    const eventType = event.getType?.()
    if (!eventType) return

    if (eventType === 'm.poll.start') {
      const eventId = event.getId?.()
      const content = event.getContent?.()
      const pollData = content?.['m.poll.start'] as PollStartData | undefined

      if (eventId && pollData) {
        const poll: Poll = {
          id: eventId,
          roomId,
          question: pollData.question.body,
          kind: pollData.kind,
          maxSelections: pollData.max_selections,
          answers: pollData.answers.map((a) => ({
            id: a.id,
            text: a['m.canvas'][0]?.body || ''
          })),
          senderId: event.getSender?.() || '',
          isEnded: false
        }

        // Cache the poll
        if (!this.pollCache.has(roomId)) {
          this.pollCache.set(roomId, new Map())
        }
        this.pollCache.get(roomId)!.set(eventId, poll)

        // Notify listeners
        this.pollStartListeners.forEach((callback) => {
          try {
            callback(poll)
          } catch (error) {
            logger.error('[PollService] Error in poll start callback:', error)
          }
        })
      }
    } else if (eventType === 'm.poll.response') {
      const content = event.getContent?.()
      const responseData = content?.['m.poll.response'] as PollResponseData | undefined
      const pollId = responseData?.['m.relates_to']?.event_id
      const userId = event.getSender?.()
      const answers = responseData?.answers || []

      if (pollId && userId) {
        this.pollResponseListeners.forEach((callback) => {
          try {
            callback(pollId, userId, answers)
          } catch (error) {
            logger.error('[PollService] Error in poll response callback:', error)
          }
        })
      }
    } else if (eventType === 'm.poll.end') {
      const content = event.getContent?.()
      const endData = content?.['m.poll.end'] as PollEndData | undefined
      const pollId = endData?.['m.relates_to']?.event_id

      if (pollId) {
        // Get results
        const results = this.getPollResults(roomId, pollId)

        // Update cached poll
        const pollMap = this.pollCache.get(roomId)
        if (pollMap?.has(pollId)) {
          const poll = pollMap.get(pollId)!
          poll.isEnded = true
          poll.endData = endData
        }

        // Notify listeners
        this.pollEndListeners.forEach((callback) => {
          try {
            callback(pollId, results)
          } catch (error) {
            logger.error('[PollService] Error in poll end callback:', error)
          }
        })
      }
    }
  }

  /**
   * Clear poll cache for a room
   */
  clearRoomCache(roomId: string): void {
    this.pollCache.delete(roomId)
    logger.debug('[PollService] Poll cache cleared for room', { roomId })
  }

  /**
   * Clear all cache
   */
  clearAllCache(): void {
    this.pollCache.clear()
    logger.debug('[PollService] All poll cache cleared')
  }

  /**
   * Dispose
   */
  dispose(): void {
    this.clearAllCache()
    this.pollStartListeners.clear()
    this.pollResponseListeners.clear()
    this.pollEndListeners.clear()
    logger.info('[PollService] Disposed')
  }
}

// Export singleton instance
export const matrixPollService = MatrixPollService.getInstance()

// Export convenience functions
export async function createPoll(roomId: string, options: CreatePollOptions): Promise<string> {
  return matrixPollService.createPoll(roomId, options)
}

export async function respondToPoll(roomId: string, pollEventId: string, selectedAnswers: string[]): Promise<void> {
  return matrixPollService.respondToPoll(roomId, pollEventId, selectedAnswers)
}

export async function endPoll(roomId: string, pollEventId: string, results?: PollResults): Promise<void> {
  return matrixPollService.endPoll(roomId, pollEventId, results)
}

export function getRoomPolls(roomId: string): Poll[] {
  return matrixPollService.getRoomPolls(roomId)
}

export function getPollResults(roomId: string, pollEventId: string): PollResults {
  return matrixPollService.getPollResults(roomId, pollEventId)
}

export function getUserVote(roomId: string, pollEventId: string): string[] | null {
  return matrixPollService.getUserVote(roomId, pollEventId)
}
