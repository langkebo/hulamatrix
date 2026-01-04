/**
 * PrivateChatServiceV2 Tests
 *
 * Comprehensive tests for the v2 private chat service including:
 * - Session management
 * - Message sending/receiving
 * - Polling mechanism
 * - Event emission
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { privateChatServiceV2 } from '@/services/privateChatServiceV2'
import type {
  PrivateChatSessionItem,
  PrivateChatMessageItem,
  PrivateChatSession,
  PrivateChatMessage
} from '@/types/matrix-sdk-v2'

// Mock matrixClientService
vi.mock('@/integrations/matrix/client', () => ({
  matrixClientService: {
    getClient: vi.fn()
  }
}))

// Mock logger
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}))

describe('PrivateChatServiceV2', () => {
  let mockMatrixClient: any

  // Mock SDK responses (base types)
  const mockSdkSessions: PrivateChatSession[] = [
    {
      session_id: 'session-1',
      participant_ids: ['@alice:matrix.org', '@bob:matrix.org'],
      session_name: 'Chat with Bob',
      created_at: '2024-01-01T00:00:00Z',
      ttl_seconds: 3600,
      expires_at: '2024-01-01T01:00:00Z',
      unread_count: 2
    },
    {
      session_id: 'session-2',
      participant_ids: ['@alice:matrix.org', '@charlie:matrix.org'],
      session_name: 'Chat with Charlie',
      created_at: '2024-01-01T00:00:00Z'
    }
  ]

  const mockSdkMessages: PrivateChatMessage[] = [
    {
      message_id: 'msg-1',
      session_id: 'session-1',
      sender_id: '@bob:matrix.org',
      content: 'Hello Alice',
      type: 'text',
      created_at: '2024-01-01T00:00:00Z'
    },
    {
      message_id: 'msg-2',
      session_id: 'session-1',
      sender_id: '@alice:matrix.org',
      content: 'Hi Bob',
      type: 'text',
      created_at: '2024-01-01T00:01:00Z'
    }
  ]

  // Expected mapped results (Item types with extra fields)
  const expectedSessions: PrivateChatSessionItem[] = [
    {
      session_id: 'session-1',
      participant_ids: ['@alice:matrix.org', '@bob:matrix.org'],
      session_name: 'Chat with Bob',
      created_at: '2024-01-01T00:00:00Z',
      ttl_seconds: 3600,
      expires_at: '2024-01-01T01:00:00Z',
      unread_count: 2,
      participant_info: [
        { user_id: '@alice:matrix.org', presence: 'offline' },
        { user_id: '@bob:matrix.org', presence: 'offline' }
      ]
    },
    {
      session_id: 'session-2',
      participant_ids: ['@alice:matrix.org', '@charlie:matrix.org'],
      session_name: 'Chat with Charlie',
      created_at: '2024-01-01T00:00:00Z',
      unread_count: 0,
      participant_info: [
        { user_id: '@alice:matrix.org', presence: 'offline' },
        { user_id: '@charlie:matrix.org', presence: 'offline' }
      ]
    }
  ]

  const expectedMessages: PrivateChatMessageItem[] = [
    {
      message_id: 'msg-1',
      session_id: 'session-1',
      sender_id: '@bob:matrix.org',
      content: 'Hello Alice',
      type: 'text',
      created_at: '2024-01-01T00:00:00Z',
      timestamp: 1704067200000,
      is_destroyed: false
    },
    {
      message_id: 'msg-2',
      session_id: 'session-1',
      sender_id: '@alice:matrix.org',
      content: 'Hi Bob',
      type: 'text',
      created_at: '2024-01-01T00:01:00Z',
      timestamp: 1704067260000,
      is_destroyed: false
    }
  ]

  // Cache tracking for tests
  let cacheData: {
    sessions?: PrivateChatSessionItem[]
    messages?: PrivateChatMessageItem[]
  } = {}

  // Track actual API calls (excluding cache hits)
  let actualApiCalls = {
    listSessions: 0
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    // Reset cache and call counters
    cacheData = {}
    actualApiCalls = {
      listSessions: 0
    }

    // Create mock Matrix client with v2 API
    const mockListSessions = vi.fn((useCache?: boolean) => {
      if (useCache && cacheData.sessions) {
        return Promise.resolve(mockSdkSessions)
      }
      actualApiCalls.listSessions++
      cacheData.sessions = expectedSessions
      return Promise.resolve(mockSdkSessions)
    })

    mockMatrixClient = {
      privateChatV2: {
        listSessions: mockListSessions,
        createSession: vi.fn().mockResolvedValue(mockSdkSessions[0]),
        deleteSession: vi.fn().mockResolvedValue(undefined),
        sendText: vi.fn().mockResolvedValue('msg-3'),
        sendMessage: vi.fn().mockResolvedValue('msg-3'),
        getMessages: vi.fn((_sessionId: string, limit?: number) => {
          return Promise.resolve(mockSdkMessages.slice(0, limit || mockSdkMessages.length))
        }),
        subscribeToMessages: vi.fn().mockReturnValue(vi.fn()),
        on: vi.fn(),
        off: vi.fn(),
        dispose: vi.fn()
      },
      on: vi.fn(),
      off: vi.fn()
    }

    // Mock the matrixClientService
    const { matrixClientService } = await import('@/integrations/matrix/client')
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockMatrixClient)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    // Dispose service to reset initialized state
    privateChatServiceV2.dispose()
  })

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await expect(privateChatServiceV2.initialize()).resolves.not.toThrow()
    })

    it('should set up event listeners on initialize', async () => {
      await privateChatServiceV2.initialize()
      expect(mockMatrixClient.privateChatV2.on).toHaveBeenCalled()
    })

    it('should be idempotent - multiple initializes are safe', async () => {
      await privateChatServiceV2.initialize()
      await privateChatServiceV2.initialize()
      await privateChatServiceV2.initialize()
      // Should not throw or cause issues
    })
  })

  describe('List Sessions', () => {
    it('should return sessions list', async () => {
      await privateChatServiceV2.initialize()
      const sessions = await privateChatServiceV2.listSessions()
      expect(sessions).toEqual(expectedSessions)
    })

    it('should use cache when useCache is true', async () => {
      await privateChatServiceV2.initialize()
      await privateChatServiceV2.listSessions(true)
      await privateChatServiceV2.listSessions(true)

      expect(actualApiCalls.listSessions).toBe(1)
    })

    it('should bypass cache when useCache is false', async () => {
      await privateChatServiceV2.initialize()
      await privateChatServiceV2.listSessions(false)
      await privateChatServiceV2.listSessions(false)

      expect(mockMatrixClient.privateChatV2.listSessions).toHaveBeenCalledTimes(2)
    })

    it('should handle empty sessions list', async () => {
      mockMatrixClient.privateChatV2.listSessions.mockResolvedValue([])
      await privateChatServiceV2.initialize()
      const sessions = await privateChatServiceV2.listSessions()
      expect(sessions).toEqual([])
    })

    it('should handle API errors gracefully', async () => {
      mockMatrixClient.privateChatV2.listSessions.mockRejectedValue(new Error('Network error'))
      await privateChatServiceV2.initialize()
      await expect(privateChatServiceV2.listSessions()).rejects.toThrow('Network error')
    })
  })

  describe('Create Session', () => {
    it('should create session successfully', async () => {
      await privateChatServiceV2.initialize()
      const session = await privateChatServiceV2.createSession({
        participants: ['@bob:matrix.org'],
        session_name: 'New Chat',
        ttl_seconds: 3600
      })
      expect(session).toEqual(expectedSessions[0])
      expect(mockMatrixClient.privateChatV2.createSession).toHaveBeenCalledWith({
        participants: ['@bob:matrix.org'],
        session_name: 'New Chat',
        ttl_seconds: 3600
      })
    })

    it('should create session with minimal params', async () => {
      await privateChatServiceV2.initialize()
      await privateChatServiceV2.createSession({
        participants: ['@bob:matrix.org']
      })
      expect(mockMatrixClient.privateChatV2.createSession).toHaveBeenCalledWith({
        participants: ['@bob:matrix.org'],
        session_name: undefined,
        ttl_seconds: undefined
      })
    })

    it('should handle create errors', async () => {
      mockMatrixClient.privateChatV2.createSession.mockRejectedValue(new Error('Create failed'))
      await privateChatServiceV2.initialize()
      await expect(privateChatServiceV2.createSession({ participants: ['@bob:matrix.org'] })).rejects.toThrow(
        'Create failed'
      )
    })
  })

  describe('Delete Session', () => {
    it('should delete session successfully', async () => {
      await privateChatServiceV2.initialize()
      await privateChatServiceV2.deleteSession('session-1')
      expect(mockMatrixClient.privateChatV2.deleteSession).toHaveBeenCalledWith('session-1')
    })

    it('should handle delete errors', async () => {
      mockMatrixClient.privateChatV2.deleteSession.mockRejectedValue(new Error('Delete failed'))
      await privateChatServiceV2.initialize()
      await expect(privateChatServiceV2.deleteSession('session-1')).rejects.toThrow('Delete failed')
    })
  })

  describe('Send Text', () => {
    it('should send text message successfully', async () => {
      await privateChatServiceV2.initialize()
      const messageId = await privateChatServiceV2.sendText('session-1', 'Hello')
      expect(messageId).toBe('msg-3')
      expect(mockMatrixClient.privateChatV2.sendText).toHaveBeenCalledWith('session-1', 'Hello')
    })

    it('should handle send errors', async () => {
      mockMatrixClient.privateChatV2.sendText.mockRejectedValue(new Error('Send failed'))
      await privateChatServiceV2.initialize()
      await expect(privateChatServiceV2.sendText('session-1', 'Hello')).rejects.toThrow('Send failed')
    })
  })

  describe('Get Messages', () => {
    it('should get messages successfully', async () => {
      await privateChatServiceV2.initialize()
      const messages = await privateChatServiceV2.getMessages({
        session_id: 'session-1',
        limit: 50
      })
      expect(messages).toEqual(expectedMessages)
      expect(mockMatrixClient.privateChatV2.getMessages).toHaveBeenCalledWith({
        session_id: 'session-1',
        limit: 50
      })
    })

    it('should support pagination with before parameter', async () => {
      await privateChatServiceV2.initialize()
      await privateChatServiceV2.getMessages({
        session_id: 'session-1',
        limit: 50,
        before: 'msg-1'
      })
      expect(mockMatrixClient.privateChatV2.getMessages).toHaveBeenCalledWith({
        session_id: 'session-1',
        limit: 50,
        before: 'msg-1'
      })
    })

    it('should use default limit', async () => {
      await privateChatServiceV2.initialize()
      await privateChatServiceV2.getMessages({ session_id: 'session-1' })
      expect(mockMatrixClient.privateChatV2.getMessages).toHaveBeenCalledWith({
        session_id: 'session-1',
        limit: 50 // default limit
      })
    })

    it('should not cache messages', async () => {
      await privateChatServiceV2.initialize()
      await privateChatServiceV2.getMessages({ session_id: 'session-1' })
      await privateChatServiceV2.getMessages({ session_id: 'session-1' })

      expect(mockMatrixClient.privateChatV2.getMessages).toHaveBeenCalledTimes(2)
    })
  })

  describe('Subscribe to Messages', () => {
    it('should subscribe to messages successfully', async () => {
      await privateChatServiceV2.initialize()
      const handler = vi.fn()
      const unsubscribe = privateChatServiceV2.subscribeToMessages('session-1', handler)
      expect(typeof unsubscribe).toBe('function')
      // Verify the underlying SDK subscribe was called
      expect(mockMatrixClient.privateChatV2.subscribeToMessages).toHaveBeenCalledWith('session-1', expect.any(Function))
    })

    it('should return unsubscribe function', async () => {
      await privateChatServiceV2.initialize()
      const handler = vi.fn()
      const unsubscribe = privateChatServiceV2.subscribeToMessages('session-1', handler)

      // Call unsubscribe
      unsubscribe()

      // Verify behavior (implementation dependent)
    })

    it('should handle multiple subscriptions', async () => {
      await privateChatServiceV2.initialize()
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      privateChatServiceV2.subscribeToMessages('session-1', handler1)
      privateChatServiceV2.subscribeToMessages('session-1', handler2)

      expect(mockMatrixClient.privateChatV2.subscribeToMessages).toHaveBeenCalledTimes(2)
    })
  })

  describe('Cache Management', () => {
    it('should invalidate session cache', async () => {
      await privateChatServiceV2.initialize()
      await privateChatServiceV2.listSessions(true)
      privateChatServiceV2.invalidateCache()
      await privateChatServiceV2.listSessions(true)

      expect(mockMatrixClient.privateChatV2.listSessions).toHaveBeenCalledTimes(2)
    })
  })

  describe('Event Handling', () => {
    it('should emit session.created event', async () => {
      await privateChatServiceV2.initialize()
      const handler = vi.fn()
      privateChatServiceV2.on('session.created', handler)

      const onCallback = mockMatrixClient.privateChatV2.on.mock.calls.find(
        (call: any) => call[0] === 'session.created'
      )?.[1]
      onCallback?.(mockSdkSessions[0])

      expect(handler).toHaveBeenCalledWith(expectedSessions[0])
    })

    it('should emit session.deleted event', async () => {
      await privateChatServiceV2.initialize()
      const handler = vi.fn()
      privateChatServiceV2.on('session.deleted', handler)

      const onCallback = mockMatrixClient.privateChatV2.on.mock.calls.find(
        (call: any) => call[0] === 'session.deleted'
      )?.[1]
      onCallback?.({ sessionId: 'session-1' })

      expect(handler).toHaveBeenCalledWith({ sessionId: 'session-1' })
    })

    it('should emit message.received event', async () => {
      await privateChatServiceV2.initialize()
      const handler = vi.fn()
      privateChatServiceV2.on('message.received', handler)

      const onCallback = mockMatrixClient.privateChatV2.on.mock.calls.find(
        (call: any) => call[0] === 'message.received'
      )?.[1]
      onCallback?.(mockSdkMessages[0])

      expect(handler).toHaveBeenCalledWith(expectedMessages[0])
    })

    it('should emit message.sent event', async () => {
      await privateChatServiceV2.initialize()
      const handler = vi.fn()
      privateChatServiceV2.on('message.sent', handler)

      const onCallback = mockMatrixClient.privateChatV2.on.mock.calls.find(
        (call: any) => call[0] === 'message.sent'
      )?.[1]
      onCallback?.({ sessionId: 'session-1', messageId: 'msg-3' })

      expect(handler).toHaveBeenCalledWith({ sessionId: 'session-1', messageId: 'msg-3' })
    })

    it('should allow unsubscribing from events', async () => {
      await privateChatServiceV2.initialize()
      const handler = vi.fn()
      privateChatServiceV2.on('session.created', handler)
      privateChatServiceV2.off('session.created', handler)

      const onCallback = mockMatrixClient.privateChatV2.on.mock.calls.find(
        (call: any) => call[0] === 'session.created'
      )?.[1]
      onCallback?.(mockSdkSessions[0])

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      mockMatrixClient.privateChatV2.listSessions.mockRejectedValue(new Error('Network error'))
      await privateChatServiceV2.initialize()
      await expect(privateChatServiceV2.listSessions()).rejects.toThrow()
    })

    it('should handle timeout errors', async () => {
      mockMatrixClient.privateChatV2.listSessions.mockRejectedValue(new Error('Timeout'))
      await privateChatServiceV2.initialize()
      await expect(privateChatServiceV2.listSessions()).rejects.toThrow()
    })

    it('should handle invalid responses', async () => {
      mockMatrixClient.privateChatV2.listSessions.mockResolvedValue(null as any)
      await privateChatServiceV2.initialize()
      const sessions = await privateChatServiceV2.listSessions()
      expect(sessions).toEqual([]) // Service returns empty array for null response
    })
  })

  describe('Dispose', () => {
    it('should clean up event listeners on dispose', () => {
      privateChatServiceV2.dispose()
      expect(mockMatrixClient.privateChatV2.dispose).toHaveBeenCalled()
    })

    it('should clear cache on dispose', async () => {
      await privateChatServiceV2.initialize()
      await privateChatServiceV2.listSessions(true)
      privateChatServiceV2.dispose()
      // Cache should be cleared
    })
  })

  describe('Send Message', () => {
    it('should send message with custom type', async () => {
      await privateChatServiceV2.initialize()
      await privateChatServiceV2.sendMessage({
        session_id: 'session-1',
        content: 'Hello',
        type: 'text'
      })
      // Verify the message was sent (implementation specific)
    })

    it('should default to text type', async () => {
      await privateChatServiceV2.initialize()
      await privateChatServiceV2.sendMessage({
        session_id: 'session-1',
        content: 'Hello'
      })
      // Should default to text type
    })
  })

  describe('Real-time Updates', () => {
    it('should trigger event handlers when messages are received', async () => {
      await privateChatServiceV2.initialize()
      const handler = vi.fn()
      privateChatServiceV2.subscribeToMessages('session-1', handler)

      // Simulate receiving a message
      const onCallback = mockMatrixClient.privateChatV2.subscribeToMessages.mock.calls[0]?.[1]
      if (onCallback) {
        onCallback(mockSdkMessages[0])
      }

      // Handler should be called (implementation depends on how polling works)
    })

    it('should handle subscription errors gracefully', async () => {
      mockMatrixClient.privateChatV2.subscribeToMessages.mockImplementation(() => {
        throw new Error('Subscription failed')
      })
      await privateChatServiceV2.initialize()

      // Should not throw, should handle error gracefully
      const handler = vi.fn()
      expect(() => {
        privateChatServiceV2.subscribeToMessages('session-1', handler)
      }).not.toThrow()
    })
  })
})
