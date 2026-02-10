import MatrixClientService from './MatrixClientService'
import {
  type PollCreateParams,
  type PollVoteParams,
  type PollEndParams,
  type PollDetail,
  type PollAnswer,
  type PollStatistics,
  type PollVoteRecord,
  type PollKind
} from '@/types/poll'

const M_POLL_START = 'm.poll.start'
const M_POLL_RESPONSE = 'm.poll.response'
const M_POLL_END = 'm.poll.end'

class MatrixPollService {
  private static instance: MatrixPollService
  private pollListeners: Map<string, ((event: any) => void)[]> = new Map()
  private pollsCache: Map<string, { poll: any; timestamp: number }> = new Map()
  private readonly CACHE_TTL = 5 * 60 * 1000

  private constructor() {}

  static getInstance(): MatrixPollService {
    if (!MatrixPollService.instance) {
      MatrixPollService.instance = new MatrixPollService()
    }
    return MatrixPollService.instance
  }

  private getClient() {
    const client = MatrixClientService.getInstance().getClient()
    if (!client) {
      throw new Error('Matrix client not available')
    }
    return client
  }

  async createPoll(params: PollCreateParams): Promise<string> {
    const { roomId, question, answers, kind = 'disclosed', maxSelections = 1 } = params
    const client = this.getClient()

    const content = {
      [M_POLL_START]: {
        question: {
          'org.matrix.msc1767.text': question
        },
        kind: kind === 'disclosed' ? 'm.poll.disclosed' : 'm.poll.undisclosed',
        max_selections: maxSelections,
        answers: answers.map((answer, index) => ({
          id: answer.id || `answer_${index}`,
          'org.matrix.msc1767.text': answer.content
        }))
      }
    }

    try {
      const response = await client.sendEvent(roomId, M_POLL_START as any, content)
      return response.event_id
    } catch (error) {
      console.error('[MatrixPollService] Failed to create poll:', error)
      throw error
    }
  }

  async vote(params: PollVoteParams): Promise<void> {
    const { roomId, pollId, answers } = params
    const client = this.getClient()

    const content = {
      [M_POLL_RESPONSE]: {
        answers
      },
      'm.relates_to': {
        event_id: pollId,
        rel_type: 'm.reference'
      }
    }

    try {
      await client.sendEvent(roomId, M_POLL_RESPONSE as any, content)
    } catch (error) {
      console.error('[MatrixPollService] Failed to vote:', error)
      throw error
    }
  }

  async endPoll(params: PollEndParams): Promise<void> {
    const { roomId, pollId } = params
    const client = this.getClient()

    const content = {
      [M_POLL_END]: {},
      'm.relates_to': {
        event_id: pollId,
        rel_type: 'm.reference'
      }
    }

    try {
      await client.sendEvent(roomId, M_POLL_END as any, content)
    } catch (error) {
      console.error('[MatrixPollService] Failed to end poll:', error)
      throw error
    }
  }

  async getPollDetail(roomId: string, pollId: string): Promise<PollDetail | null> {
    const client = this.getClient()
    const cacheKey = `${roomId}:${pollId}`

    const cached = this.pollsCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return this.pollToDetail(cached.poll)
    }

    try {
      const event = await this.fetchEvent(client, roomId, pollId)
      if (!event) {
        return null
      }

      const poll = await this.getOrCreatePoll(roomId, event)
      if (poll) {
        this.pollsCache.set(cacheKey, { poll, timestamp: Date.now() })
        return this.pollToDetail(poll)
      }

      return null
    } catch (error) {
      console.error('[MatrixPollService] Failed to get poll detail:', error)
      return null
    }
  }

  async getPollStatistics(roomId: string, pollId: string): Promise<PollStatistics | null> {
    const poll = await this.getPoll(roomId, pollId)
    if (!poll) {
      return null
    }

    const responses = await poll.getResponses()
    const relations = responses.getRelations()
    const voteRecords: Map<string, PollVoteRecord> = new Map()
    const answerCounts: Map<string, number> = new Map()

    relations.forEach((event: any) => {
      const sender = event.getSender()
      if (!sender) return

      const content = event.getContent()
      const answers = content?.[M_POLL_RESPONSE]?.answers
      if (!answers || !Array.isArray(answers)) return

      if (!voteRecords.has(sender)) {
        voteRecords.set(sender, {
          userId: sender,
          answers,
          timestamp: event.getTs()
        })
      }

      answers.forEach((answerId: string) => {
        answerCounts.set(answerId, (answerCounts.get(answerId) || 0) + 1)
      })
    })

    const pollStartContent = poll.pollEvent?.[M_POLL_START]
    const answers = pollStartContent?.answers || []
    const totalVotes = voteRecords.size

    const answerStats = answers.map((answer: any) => {
      const answerId = answer.id
      const voteCount = answerCounts.get(answerId) || 0
      const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0

      return {
        answerId,
        answerText: answer['org.matrix.msc1767.text'] || answer.id,
        voteCount,
        percentage
      }
    })

    return {
      pollId,
      totalVotes,
      answerStats,
      votedUsers: Array.from(voteRecords.keys()),
      isEnded: poll.isEnded
    }
  }

  async getUserVote(roomId: string, pollId: string, userId: string): Promise<string[] | null> {
    const poll = await this.getPoll(roomId, pollId)
    if (!poll) {
      return null
    }

    const responses = await poll.getResponses()
    const relations = responses.getRelations()

    for (const event of relations) {
      if (event.getSender() === userId) {
        const content = event.getContent()
        return content?.[M_POLL_RESPONSE]?.answers || null
      }
    }

    return null
  }

  async getRoomPolls(roomId: string): Promise<PollDetail[]> {
    const client = this.getClient()
    const room = client.getRoom(roomId)

    if (!room) {
      console.warn('[MatrixPollService] Room not found:', roomId)
      return []
    }

    const polls: PollDetail[] = []
    for (const [pollId] of room.polls || new Map()) {
      const detail = await this.getPollDetail(roomId, pollId)
      if (detail) {
        polls.push(detail)
      }
    }

    return polls
  }

  subscribeToPoll(pollId: string, callback: (event: any) => void): () => void {
    if (!this.pollListeners.has(pollId)) {
      this.pollListeners.set(pollId, [])
    }
    this.pollListeners.get(pollId)!.push(callback)

    return () => {
      const listeners = this.pollListeners.get(pollId)
      if (listeners) {
        const index = listeners.indexOf(callback)
        if (index > -1) {
          listeners.splice(index, 1)
        }
      }
    }
  }

  private async fetchEvent(client: any, roomId: string, eventId: string): Promise<any> {
    try {
      return await client.fetchEvent(roomId, eventId)
    } catch (error) {
      console.error('[MatrixPollService] Failed to fetch event:', error)
      return null
    }
  }

  private async getOrCreatePoll(roomId: string, event: any): Promise<any> {
    const client = this.getClient()
    const room = client.getRoom(roomId)

    if (!room) {
      return null
    }

    const pollId = event.getId?.()
    if (!pollId) {
      return null
    }

    if (room.polls?.has(pollId)) {
      return room.polls.get(pollId)
    }

    try {
      const sdk = await import('matrix-js-sdk')
      const PollClass = sdk.Poll
      if (!PollClass) {
        console.warn('[MatrixPollService] Poll class not available')
        return null
      }

      const poll = new PollClass(event, client, room)
      if (room.polls) {
        room.polls.set(pollId, poll)
      }
      return poll
    } catch (error) {
      console.error('[MatrixPollService] Failed to create poll:', error)
      return null
    }
  }

  private async getPoll(roomId: string, pollId: string): Promise<any> {
    const client = this.getClient()
    const room = client.getRoom(roomId)

    if (!room) {
      return null
    }

    if (room.polls?.has(pollId)) {
      return room.polls.get(pollId)
    }

    const event = await this.fetchEvent(client, roomId, pollId)
    if (!event) {
      return null
    }

    return this.getOrCreatePoll(roomId, event)
  }

  private pollToDetail(poll: any): PollDetail {
    const pollStartContent = poll.pollEvent?.[M_POLL_START]

    const answers: PollAnswer[] = (pollStartContent?.answers || []).map((answer: any) => ({
      id: answer.id,
      text: answer['org.matrix.msc1767.text'] || answer.id
    }))

    return {
      pollId: poll.pollId || '',
      roomId: poll.roomId || '',
      question: pollStartContent?.question?.['org.matrix.msc1767.text'] || '',
      kind: pollStartContent?.kind as PollKind,
      maxSelections: pollStartContent?.max_selections || 1,
      answers,
      isEnded: poll.isEnded || false,
      endTime: poll.endEvent?.getTs?.(),
      creatorId: poll.rootEvent?.getSender?.() || '',
      createdAt: poll.rootEvent?.getTs?.() || Date.now()
    }
  }

  clearCache(): void {
    this.pollsCache.clear()
  }
}

export default MatrixPollService
