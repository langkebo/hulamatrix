import { describe, it, expect, vi, beforeEach } from 'vitest'
import MatrixPrivateChatService, {
  type CreateSessionParams,
  type SendMessageParams,
  type PrivateChatSession,
  type PrivateChatMessage,
  setEnhancedClientForTest,
  clearEnhancedClientForTest
} from '../../src/services/matrix/MatrixPrivateChatService'
import MatrixClientService from '../../src/services/matrix/MatrixClientService'

const mockEnhancedClient = {
  privateChat: {
    createSession: vi.fn(),
    getSessions: vi.fn(),
    getSessionDetail: vi.fn(),
    closeSession: vi.fn(),
    sendMessage: vi.fn(),
    getMessages: vi.fn(),
    markAsRead: vi.fn(),
    getUnreadCount: vi.fn(),
    searchMessages: vi.fn(),
    getSessionStatistics: vi.fn()
  }
}

const _mockMatrixConfig = {
  baseUrl: 'https://test.hula.app',
  accessToken: 'test_token',
  userId: '@testuser:hula.app',
  deviceId: 'TEST_DEVICE'
}

const mockSession: PrivateChatSession = {
  sessionId: 'session_123',
  sessionName: 'Test Session',
  creatorId: '@testuser:hula.app',
  participants: ['@testuser:hula.app', '@friend:hula.app'],
  status: 'active',
  ttlSeconds: 86400,
  autoDelete: false,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T12:00:00.000Z',
  unreadCount: 2
}

const _mockMessage: PrivateChatMessage = {
  messageId: 'msg_123',
  sessionId: 'session_123',
  senderId: '@testuser:hula.app',
  content: 'Hello, this is a test message',
  messageType: 'text',
  createdAt: '2024-01-01T12:00:00.000Z',
  expiresAt: null,
  readBy: []
}

describe('MatrixPrivateChatService', () => {
  let service: MatrixPrivateChatService

  beforeEach(() => {
    vi.clearAllMocks()
    clearEnhancedClientForTest()
    service = MatrixPrivateChatService.getInstance()
  })

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = MatrixPrivateChatService.getInstance()
      const instance2 = MatrixPrivateChatService.getInstance()
      expect(instance1).toBe(instance2)
    })
  })

  describe('createSession', () => {
    it('should create a new session successfully', async () => {
      const mockMatrixClient = {
        getUserId: () => '@testuser:hula.app'
      }
      vi.spyOn(MatrixClientService, 'getInstance').mockReturnValue({
        getClient: () => mockMatrixClient,
        getFriendSystemManager: () => null
      } as any)
      setEnhancedClientForTest(mockEnhancedClient)
      mockEnhancedClient.privateChat.createSession.mockResolvedValue('session_123')

      const params: CreateSessionParams = {
        participants: ['@friend:hula.app'],
        sessionName: 'Test Session',
        ttlSeconds: 86400,
        autoDelete: false
      }

      const result = await service.createSession(params)

      expect(result).toBe('session_123')
      expect(mockEnhancedClient.privateChat.createSession).toHaveBeenCalledWith({
        creator_id: '@testuser:hula.app',
        participants: ['@friend:hula.app'],
        session_name: 'Test Session',
        ttl_seconds: 86400,
        auto_delete: false
      })
    })

    it('should throw error when participants is empty', async () => {
      setEnhancedClientForTest(mockEnhancedClient)
      const params: CreateSessionParams = {
        participants: []
      }

      await expect(service.createSession(params)).rejects.toThrow('At least one participant is required')
    })
  })

  describe('getSessions', () => {
    it('should return cached sessions when available', async () => {
      clearEnhancedClientForTest()
      const cachedData = {
        sessions: [mockSession],
        messages: new Map(),
        unreadCount: null,
        timestamp: Date.now()
      }
      ;(service as any).cache.set('sessions', cachedData)

      const result = await service.getSessions()

      expect(result).toHaveLength(1)
      expect(result[0].sessionId).toBe('session_123')
    })

    it('should fetch sessions from API when forceRefresh is true', async () => {
      setEnhancedClientForTest(mockEnhancedClient)
      mockEnhancedClient.privateChat.getSessions.mockResolvedValue([
        {
          session_id: 'session_123',
          session_name: 'Test Session',
          creator_id: '@testuser:hula.app',
          participants: ['@testuser:hula.app', '@friend:hula.app'],
          status: 'active',
          ttl_seconds: 86400,
          auto_delete: false,
          created_at: '2024-01-01T00:00:00.000Z'
        }
      ])

      const result = await service.getSessions(undefined, true)

      expect(result).toHaveLength(1)
      expect(result[0].sessionId).toBe('session_123')
      expect(mockEnhancedClient.privateChat.getSessions).toHaveBeenCalled()
    })
  })

  describe('getSessionDetail', () => {
    it('should return session details', async () => {
      setEnhancedClientForTest(mockEnhancedClient)
      mockEnhancedClient.privateChat.getSessionDetail.mockResolvedValue({
        session_id: 'session_123',
        session_name: 'Test Session',
        creator_id: '@testuser:hula.app',
        participants: ['@testuser:hula.app', '@friend:hula.app'],
        status: 'active',
        ttl_seconds: 86400,
        auto_delete: false,
        created_at: '2024-01-01T00:00:00.000Z'
      })

      const result = await service.getSessionDetail('session_123')

      expect(result).toBeDefined()
      expect(result?.sessionId).toBe('session_123')
    })

    it('should return null when session not found', async () => {
      setEnhancedClientForTest(mockEnhancedClient)
      mockEnhancedClient.privateChat.getSessionDetail.mockResolvedValue(null)

      const result = await service.getSessionDetail('invalid_session')

      expect(result).toBeNull()
    })
  })

  describe('closeSession', () => {
    it('should close session successfully', async () => {
      const mockMatrixClient = {
        getUserId: () => '@testuser:hula.app'
      }
      vi.spyOn(MatrixClientService, 'getInstance').mockReturnValue({
        getClient: () => mockMatrixClient,
        getFriendSystemManager: () => null
      } as any)
      setEnhancedClientForTest(mockEnhancedClient)
      mockEnhancedClient.privateChat.closeSession.mockResolvedValue(true)

      const result = await service.closeSession('session_123')

      expect(result).toBe(true)
      expect(mockEnhancedClient.privateChat.closeSession).toHaveBeenCalledWith('session_123', '@testuser:hula.app')
    })
  })

  describe('sendMessage', () => {
    it('should send text message successfully', async () => {
      const mockMatrixClient = {
        getUserId: () => '@testuser:hula.app'
      }
      vi.spyOn(MatrixClientService, 'getInstance').mockReturnValue({
        getClient: () => mockMatrixClient,
        getFriendSystemManager: () => null
      } as any)
      setEnhancedClientForTest(mockEnhancedClient)
      mockEnhancedClient.privateChat.sendMessage.mockResolvedValue('msg_123')

      const params: SendMessageParams = {
        content: 'Hello, this is a test message',
        messageType: 'text'
      }

      const result = await service.sendMessage('session_123', params)

      expect(result).toBe('msg_123')
      expect(mockEnhancedClient.privateChat.sendMessage).toHaveBeenCalledWith({
        room_id: 'session_123',
        content: 'Hello, this is a test message',
        type: 'text',
        file_url: undefined,
        file_name: undefined,
        file_size: undefined,
        duration: undefined,
        reply_to: undefined
      })
    })
  })

  describe('getMessages', () => {
    it('should return messages for session', async () => {
      setEnhancedClientForTest(mockEnhancedClient)
      mockEnhancedClient.privateChat.getMessages.mockResolvedValue([
        {
          message_id: 'msg_123',
          session_id: 'session_123',
          sender_id: '@testuser:hula.app',
          content: 'Hello',
          message_type: 'text',
          created_at: '2024-01-01T12:00:00.000Z',
          expires_at: null,
          read_by: []
        }
      ])

      const result = await service.getMessages('session_123')

      expect(result).toHaveLength(1)
      expect(result[0].messageId).toBe('msg_123')
    })

    it('should use pagination params', async () => {
      setEnhancedClientForTest(mockEnhancedClient)
      mockEnhancedClient.privateChat.getMessages.mockResolvedValue([])

      await service.getMessages('session_123', { limit: 20, page: 1 })

      expect(mockEnhancedClient.privateChat.getMessages).toHaveBeenCalledWith('session_123', {
        limit: 20,
        cursor: undefined,
        page: 1,
        offset: undefined,
        before: undefined,
        after: undefined
      })
    })
  })

  describe('markAsRead', () => {
    it('should mark session as read', async () => {
      const mockMatrixClient = {
        getUserId: () => '@testuser:hula.app'
      }
      vi.spyOn(MatrixClientService, 'getInstance').mockReturnValue({
        getClient: () => mockMatrixClient,
        getFriendSystemManager: () => null
      } as any)
      setEnhancedClientForTest(mockEnhancedClient)
      mockEnhancedClient.privateChat.markAsRead.mockResolvedValue(true)

      const result = await service.markAsRead('session_123')

      expect(result).toBe(true)
      expect(mockEnhancedClient.privateChat.markAsRead).toHaveBeenCalledWith('session_123', '@testuser:hula.app')
    })
  })

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      setEnhancedClientForTest(mockEnhancedClient)
      mockEnhancedClient.privateChat.getUnreadCount.mockResolvedValue({
        total: 5,
        sessions: [{ sessionId: 'session_123', count: 3 }]
      })

      const result = await service.getUnreadCount()

      expect(result.total).toBe(5)
      expect(result.sessions).toHaveLength(1)
    })
  })

  describe('searchMessages', () => {
    it('should search messages', async () => {
      const mockMatrixClient = {
        getUserId: () => '@testuser:hula.app'
      }
      vi.spyOn(MatrixClientService, 'getInstance').mockReturnValue({
        getClient: () => mockMatrixClient,
        getFriendSystemManager: () => null
      } as any)
      setEnhancedClientForTest(mockEnhancedClient)
      mockEnhancedClient.privateChat.searchMessages.mockResolvedValue([
        {
          message_id: 'msg_123',
          session_id: 'session_123',
          sender_id: '@testuser:hula.app',
          content: 'Hello search',
          message_type: 'text',
          created_at: '2024-01-01T12:00:00.000Z',
          expires_at: null,
          read_by: []
        }
      ])

      const result = await service.searchMessages({ query: 'search' })

      expect(result).toHaveLength(1)
      expect(result[0].content).toBe('Hello search')
    })
  })

  describe('getSessionStatistics', () => {
    it('should return session statistics', async () => {
      setEnhancedClientForTest(mockEnhancedClient)
      mockEnhancedClient.privateChat.getSessionStatistics.mockResolvedValue({
        messageCount: 10,
        participantCount: 2,
        lastActivity: '2024-01-01T12:00:00.000Z'
      })

      const result = await service.getSessionStatistics('session_123')

      expect(result.messageCount).toBe(10)
      expect(result.participantCount).toBe(2)
    })
  })
})
