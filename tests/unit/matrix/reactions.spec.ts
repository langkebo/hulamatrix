/**
 * Matrix 消息反应功能测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  addMessageReaction,
  removeMessageReaction,
  toggleMessageReaction,
  hasUserReaction,
  getMessageReactions,
  getPopularReactions,
  getReactionCategories
} from '@/integrations/matrix/reactions'

// Mock matrix client service - mock the actual import path used by the implementation
vi.mock('@/matrix/core/client', () => {
  const client = {
    getUserId: vi.fn(() => '@test:user.example.com'),
    sendEvent: vi.fn(),
    relations: vi.fn(),
    redactEvent: vi.fn()
  }
  return { matrixClientService: { getClient: vi.fn(() => client) } }
})

const client = {
  getUserId: vi.fn(() => '@test:user.example.com'),
  sendEvent: vi.fn(),
  relations: vi.fn(),
  redactEvent: vi.fn()
}
beforeEach(async () => {
  const { matrixClientService } = await import('@/matrix/core/client')
  const serviceLike = matrixClientService as unknown as { getClient: () => Record<string, unknown> | null }
  serviceLike.getClient = vi.fn(() => client) as () => Record<string, unknown> | null
})

describe('Matrix Reactions', () => {
  const mockRoomId = '!test:room.example.com'
  const mockEventId = '$test:event:example.com'
  const mockReaction = '👍'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('addMessageReaction', () => {
    it('should successfully add a reaction', async () => {
      const { matrixClientService } = await import('@/matrix/core/client')
      const mockClient = matrixClientService.getClient()

      if (!mockClient) {
        throw new Error('Client not initialized')
      }

      const sendEventMethod = mockClient.sendEvent as ReturnType<typeof vi.fn>
      sendEventMethod.mockResolvedValue({ event_id: '$new:event' })

      const result = await addMessageReaction(mockRoomId, mockEventId, mockReaction)

      expect(result).toBe(true)
      expect(sendEventMethod).toHaveBeenCalledWith(
        mockRoomId,
        'm.reaction',
        expect.objectContaining({
          'm.relates_to': {
            rel_type: 'm.annotation',
            event_id: mockEventId,
            key: mockReaction
          }
        })
      )
    })

    it('should reject invalid reactions', async () => {
      const invalidReaction = 'a'.repeat(11) // Too long

      const result = await addMessageReaction(mockRoomId, mockEventId, invalidReaction)

      expect(result).toBe(false)
    })

    it('should handle client not initialized', async () => {
      const { matrixClientService } = await import('@/matrix/core/client')
      const serviceLike = matrixClientService as unknown as { getClient: () => Record<string, unknown> | null }
      serviceLike.getClient = vi.fn(() => null) as () => Record<string, unknown> | null

      const result = await addMessageReaction(mockRoomId, mockEventId, mockReaction)

      expect(result).toBe(false)
    })
  })

  describe('removeMessageReaction', () => {
    it('should successfully remove a reaction', async () => {
      const { matrixClientService } = await import('@/matrix/core/client')
      const mockClient = matrixClientService.getClient()

      if (!mockClient) {
        throw new Error('Client not initialized')
      }

      const relationsMethod = mockClient.relations as ReturnType<typeof vi.fn>
      relationsMethod.mockResolvedValue({
        events: [
          {
            getId: vi.fn(() => '$reaction:event'),
            getSender: vi.fn(() => '@test:user.example.com'),
            getContent: vi.fn(() => ({
              'm.relates_to': {
                rel_type: 'm.annotation',
                event_id: mockEventId,
                key: mockReaction
              }
            }))
          }
        ]
      })

      const redactEventMethod = mockClient.redactEvent as ReturnType<typeof vi.fn>
      redactEventMethod.mockResolvedValue({})

      const result = await removeMessageReaction(mockRoomId, mockEventId, mockReaction)

      expect(result).toBe(true)
      expect(redactEventMethod).toHaveBeenCalledWith(mockRoomId, '$reaction:event')
    })

    it('should return false if reaction not found', async () => {
      const { matrixClientService } = await import('@/matrix/core/client')
      const mockClient = matrixClientService.getClient()

      if (!mockClient) {
        throw new Error('Client not initialized')
      }

      const relationsMethod = mockClient.relations as ReturnType<typeof vi.fn>
      relationsMethod.mockResolvedValue({ events: [] })

      const result = await removeMessageReaction(mockRoomId, mockEventId, mockReaction)

      expect(result).toBe(false)
    })
  })

  describe('toggleMessageReaction', () => {
    it('should add reaction if not present', async () => {
      const { matrixClientService } = await import('@/matrix/core/client')
      const mockClient = matrixClientService.getClient()

      if (!mockClient) {
        throw new Error('Client not initialized')
      }

      // Mock hasUserReaction to return false
      const relationsMethod = mockClient.relations as ReturnType<typeof vi.fn>
      relationsMethod.mockResolvedValue({ events: [] })
      const sendEventMethod = mockClient.sendEvent as ReturnType<typeof vi.fn>
      sendEventMethod.mockResolvedValue({ event_id: '$new:event' })

      const result = await toggleMessageReaction(mockRoomId, mockEventId, mockReaction)

      expect(result).toBe(true)
      expect(sendEventMethod).toHaveBeenCalled()
    })

    it('should remove reaction if present', async () => {
      const { matrixClientService } = await import('@/matrix/core/client')
      const mockClient = matrixClientService.getClient()

      if (!mockClient) {
        throw new Error('Client not initialized')
      }

      // Mock hasUserReaction to return true
      const relationsMethod = mockClient.relations as ReturnType<typeof vi.fn>
      relationsMethod.mockResolvedValue({
        events: [
          {
            getId: vi.fn(() => '$reaction:event'),
            getSender: vi.fn(() => '@test:user.example.com'),
            getContent: vi.fn(() => ({
              'm.relates_to': {
                rel_type: 'm.annotation',
                event_id: mockEventId,
                key: mockReaction
              }
            }))
          }
        ]
      })

      const redactEventMethod = mockClient.redactEvent as ReturnType<typeof vi.fn>
      redactEventMethod.mockResolvedValue({})

      const result = await toggleMessageReaction(mockRoomId, mockEventId, mockReaction)

      expect(result).toBe(false)
      expect(redactEventMethod).toHaveBeenCalled()
    })
  })

  describe('hasUserReaction', () => {
    it('should return true if user has reacted', async () => {
      const { matrixClientService } = await import('@/matrix/core/client')
      const mockClient = matrixClientService.getClient()

      if (!mockClient) {
        throw new Error('Client not initialized')
      }

      const relationsMethod = mockClient.relations as ReturnType<typeof vi.fn>
      relationsMethod.mockResolvedValue({
        events: [
          {
            getSender: vi.fn(() => '@test:user.example.com'),
            getContent: vi.fn(() => ({
              'm.relates_to': {
                rel_type: 'm.annotation',
                event_id: mockEventId,
                key: mockReaction
              }
            }))
          }
        ]
      })

      const result = await hasUserReaction(mockRoomId, mockEventId, mockReaction)

      expect(result).toBe(true)
    })

    it('should return false if user has not reacted', async () => {
      const { matrixClientService } = await import('@/matrix/core/client')
      const mockClient = matrixClientService.getClient()

      if (!mockClient) {
        throw new Error('Client not initialized')
      }

      const relationsMethod = mockClient.relations as ReturnType<typeof vi.fn>
      relationsMethod.mockResolvedValue({ events: [] })

      const result = await hasUserReaction(mockRoomId, mockEventId, mockReaction)

      expect(result).toBe(false)
    })
  })

  describe('getMessageReactions', () => {
    it('should return correct reaction summary', async () => {
      const { matrixClientService } = await import('@/matrix/core/client')
      const mockClient = matrixClientService.getClient()

      if (!mockClient) {
        throw new Error('Client not initialized')
      }

      const relationsMethod = mockClient.relations as ReturnType<typeof vi.fn>
      relationsMethod.mockResolvedValue({
        events: [
          {
            getSender: vi.fn(() => '@user1:example.com'),
            getContent: vi.fn(() => ({
              'm.relates_to': {
                rel_type: 'm.annotation',
                event_id: mockEventId,
                key: '👍'
              }
            }))
          },
          {
            getSender: vi.fn(() => '@test:user.example.com'),
            getContent: vi.fn(() => ({
              'm.relates_to': {
                rel_type: 'm.annotation',
                event_id: mockEventId,
                key: '👍'
              }
            }))
          },
          {
            getSender: vi.fn(() => '@user2:example.com'),
            getContent: vi.fn(() => ({
              'm.relates_to': {
                rel_type: 'm.annotation',
                event_id: mockEventId,
                key: '❤️'
              }
            }))
          }
        ]
      })

      const result = await getMessageReactions(mockRoomId, mockEventId)

      expect(result).toEqual({
        eventId: mockEventId,
        reactions: {
          '👍': {
            key: '👍',
            count: 2,
            userMarked: true,
            users: ['@user1:example.com', '@test:user.example.com']
          },
          '❤️': {
            key: '❤️',
            count: 1,
            userMarked: false,
            users: ['@user2:example.com']
          }
        },
        totalCount: 3,
        hasCurrentUserReaction: true
      })
    })

    it('should return empty summary for no reactions', async () => {
      const { matrixClientService } = await import('@/matrix/core/client')
      const mockClient = matrixClientService.getClient()

      if (!mockClient) {
        throw new Error('Client not initialized')
      }

      const relationsMethod = mockClient.relations as ReturnType<typeof vi.fn>
      relationsMethod.mockResolvedValue({ events: [] })

      const result = await getMessageReactions(mockRoomId, mockEventId)

      expect(result).toEqual({
        eventId: mockEventId,
        reactions: {},
        totalCount: 0,
        hasCurrentUserReaction: false
      })
    })
  })

  describe('getPopularReactions', () => {
    it('should return popular reactions array', () => {
      const reactions = getPopularReactions()

      expect(reactions).toBeInstanceOf(Array)
      expect(reactions).toContain('👍')
      expect(reactions).toContain('❤️')
      expect(reactions).toContain('😄')
      expect(reactions.length).toBeGreaterThan(10)
    })
  })

  describe('getReactionCategories', () => {
    it('should return reaction categories', () => {
      const categories = getReactionCategories()

      expect(categories).toBeInstanceOf(Array)
      expect(categories.length).toBeGreaterThan(0)

      const emojiCategory = categories.find((cat) => cat.name === '表情')
      expect(emojiCategory).toBeDefined()
      expect(emojiCategory?.reactions).toContain('😄')

      const gestureCategory = categories.find((cat) => cat.name === '手势')
      expect(gestureCategory).toBeDefined()
      expect(gestureCategory?.reactions).toContain('👍')
    })
  })
})
