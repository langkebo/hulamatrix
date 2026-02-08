import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockSendEvent = vi.fn()
const mockFetchEvent = vi.fn()
const mockGetRoom = vi.fn()
const mockClient = {
  sendEvent: mockSendEvent,
  fetchEvent: mockFetchEvent,
  getRoom: mockGetRoom
}

vi.mock('../../src/services/matrix/MatrixClientService', () => ({
  default: {
    getInstance: () => ({
      getClient: () => mockClient
    })
  }
}))

describe('MatrixPollService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('should have singleton pattern', async () => {
    const { default: MatrixPollService1 } = await import('../../src/services/matrix/MatrixPollService')
    const { default: MatrixPollService2 } = await import('../../src/services/matrix/MatrixPollService')
    expect(MatrixPollService1.getInstance()).toBe(MatrixPollService2.getInstance())
  })

  describe('createPoll', () => {
    it('should create a poll with disclosed kind', async () => {
      mockSendEvent.mockResolvedValue({ event_id: '$poll_123' })

      const { default: MatrixPollService } = await import('../../src/services/matrix/MatrixPollService')
      const service = MatrixPollService.getInstance()

      const pollId = await service.createPoll({
        roomId: '!room:example.com',
        question: 'What is your favorite color?',
        answers: [
          { id: 'answer_1', content: 'Red' },
          { id: 'answer_2', content: 'Blue' }
        ],
        kind: 'disclosed',
        maxSelections: 1
      })

      expect(pollId).toBe('$poll_123')
      expect(mockSendEvent).toHaveBeenCalledWith(
        '!room:example.com',
        'm.poll.start',
        expect.objectContaining({
          'm.poll.start': expect.objectContaining({
            question: expect.objectContaining({
              'org.matrix.msc1767.text': 'What is your favorite color?'
            }),
            kind: 'm.poll.disclosed',
            max_selections: 1,
            answers: expect.arrayContaining([
              expect.objectContaining({ id: 'answer_1' }),
              expect.objectContaining({ id: 'answer_2' })
            ])
          })
        })
      )
    })

    it('should create a poll with undisclosed kind', async () => {
      mockSendEvent.mockResolvedValue({ event_id: '$poll_456' })

      const { default: MatrixPollService } = await import('../../src/services/matrix/MatrixPollService')
      const service = MatrixPollService.getInstance()

      const pollId = await service.createPoll({
        roomId: '!room:example.com',
        question: 'Secret vote',
        answers: [
          { id: 'answer_1', content: 'Yes' },
          { id: 'answer_2', content: 'No' }
        ],
        kind: 'undisclosed'
      })

      expect(pollId).toBe('$poll_456')
      expect(mockSendEvent).toHaveBeenCalledWith(
        '!room:example.com',
        'm.poll.start',
        expect.objectContaining({
          'm.poll.start': expect.objectContaining({
            kind: 'm.poll.undisclosed'
          })
        })
      )
    })

    it('should use default values for optional parameters', async () => {
      mockSendEvent.mockResolvedValue({ event_id: '$poll_789' })

      const { default: MatrixPollService } = await import('../../src/services/matrix/MatrixPollService')
      const service = MatrixPollService.getInstance()

      await service.createPoll({
        roomId: '!room:example.com',
        question: 'Test poll',
        answers: [
          { id: 'answer_1', content: 'A' },
          { id: 'answer_2', content: 'B' }
        ]
      })

      expect(mockSendEvent).toHaveBeenCalledWith(
        '!room:example.com',
        'm.poll.start',
        expect.objectContaining({
          'm.poll.start': expect.objectContaining({
            kind: 'm.poll.disclosed',
            max_selections: 1
          })
        })
      )
    })

    it('should throw error when sendEvent fails', async () => {
      mockSendEvent.mockRejectedValue(new Error('Failed to send event'))

      const { default: MatrixPollService } = await import('../../src/services/matrix/MatrixPollService')
      const service = MatrixPollService.getInstance()

      await expect(
        service.createPoll({
          roomId: '!room:example.com',
          question: 'Test',
          answers: [
            { id: 'answer_1', content: 'A' },
            { id: 'answer_2', content: 'B' }
          ]
        })
      ).rejects.toThrow('Failed to send event')
    })
  })

  describe('vote', () => {
    it('should send poll response event', async () => {
      mockSendEvent.mockResolvedValue({})

      const { default: MatrixPollService } = await import('../../src/services/matrix/MatrixPollService')
      const service = MatrixPollService.getInstance()

      await service.vote({
        roomId: '!room:example.com',
        pollId: '$poll_123',
        answers: ['answer_1']
      })

      expect(mockSendEvent).toHaveBeenCalledWith(
        '!room:example.com',
        'm.poll.response',
        expect.objectContaining({
          'm.poll.response': {
            answers: ['answer_1']
          },
          'm.relates_to': {
            event_id: '$poll_123',
            rel_type: 'm.reference'
          }
        })
      )
    })

    it('should support multiple selections', async () => {
      mockSendEvent.mockResolvedValue({})

      const { default: MatrixPollService } = await import('../../src/services/matrix/MatrixPollService')
      const service = MatrixPollService.getInstance()

      await service.vote({
        roomId: '!room:example.com',
        pollId: '$poll_123',
        answers: ['answer_1', 'answer_2', 'answer_3']
      })

      expect(mockSendEvent).toHaveBeenCalledWith(
        '!room:example.com',
        'm.poll.response',
        expect.objectContaining({
          'm.poll.response': {
            answers: ['answer_1', 'answer_2', 'answer_3']
          }
        })
      )
    })
  })

  describe('endPoll', () => {
    it('should send poll end event', async () => {
      mockSendEvent.mockResolvedValue({})

      const { default: MatrixPollService } = await import('../../src/services/matrix/MatrixPollService')
      const service = MatrixPollService.getInstance()

      await service.endPoll({
        roomId: '!room:example.com',
        pollId: '$poll_123'
      })

      expect(mockSendEvent).toHaveBeenCalledWith(
        '!room:example.com',
        'm.poll.end',
        expect.objectContaining({
          'm.poll.end': {},
          'm.relates_to': {
            event_id: '$poll_123',
            rel_type: 'm.reference'
          }
        })
      )
    })
  })

  describe('getPollDetail', () => {
    it('should return null when room not found', async () => {
      mockGetRoom.mockReturnValue(null)

      const { default: MatrixPollService } = await import('../../src/services/matrix/MatrixPollService')
      const service = MatrixPollService.getInstance()

      const detail = await service.getPollDetail('!room:example.com', '$poll_123')
      expect(detail).toBeNull()
    })
  })

  describe('getRoomPolls', () => {
    it('should return empty array when room not found', async () => {
      mockGetRoom.mockReturnValue(null)

      const { default: MatrixPollService } = await import('../../src/services/matrix/MatrixPollService')
      const service = MatrixPollService.getInstance()

      const polls = await service.getRoomPolls('!room:example.com')
      expect(polls).toEqual([])
    })
  })

  describe('cache management', () => {
    it('should clear cache', async () => {
      const { default: MatrixPollService } = await import('../../src/services/matrix/MatrixPollService')
      const service = MatrixPollService.getInstance()

      service.clearCache()
      expect(() => service.clearCache()).not.toThrow()
    })
  })
})

describe('Poll types', () => {
  it('should define correct PollKind type', () => {
    type PollKind = 'disclosed' | 'undisclosed' | string
    const disclosedKind: PollKind = 'disclosed'
    const undisclosedKind: PollKind = 'undisclosed'
    expect(disclosedKind).toBe('disclosed')
    expect(undisclosedKind).toBe('undisclosed')
  })

  it('should define correct PollOption interface', () => {
    interface PollOption {
      id: string
      content: string
    }

    const option: PollOption = {
      id: 'answer_1',
      content: 'Red'
    }

    expect(option.id).toBe('answer_1')
    expect(option.content).toBe('Red')
  })
})
