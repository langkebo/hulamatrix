/**
 * MatrixPrivateChatAdapter Tests
 *
 * 测试 Matrix 私密聊天适配器的功能：
 * - 会话列表获取
 * - 会话创建
 * - 消息发送和接收
 * - 消息撤回
 * - 订阅和取消订阅
 */

// Mock dependencies FIRST (before importing the adapter)
let mockClient: any = null

vi.mock('@/integrations/matrix/client', () => ({
  matrixClientService: {
    getClient: vi.fn(() => mockClient)
  }
}))

vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  },
  toError: (e: unknown) => (e instanceof Error ? e : new Error(String(e)))
}))

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MatrixPrivateChatAdapter } from '@/adapters/matrix-private-chat-adapter'

// Mock Matrix event
function createMockMatrixEvent(options: {
  type: string
  sender: string
  content: any
  eventId?: string
  timestamp?: number
  localId?: string
}) {
  return {
    getType: () => options.type,
    getSender: () => options.sender,
    getContent: () => options.content,
    getId: () => options.eventId || `$${Math.random().toString(36).substring(7)}`,
    getTs: () => options.timestamp || Date.now(),
    getLocalId: () => options.localId
  }
}

// Mock Matrix room
function createMockRoom(options: {
  roomId: string
  name?: string
  avatar?: string
  events?: any[]
  unreadCount?: number
}) {
  const events = options.events || []
  return {
    roomId: options.roomId,
    name: options.name,
    currentState: {
      getStateEvents: vi.fn((type: string) => {
        if (type === 'm.room.avatar' && options.avatar) {
          return [{ getContent: () => ({ url: options.avatar }) }]
        }
        if (type === 'm.room.name' && options.name) {
          return [{ getContent: () => ({ name: options.name }) }]
        }
        return []
      })
    },
    getUnreadNotificationCount: () => options.unreadCount || 0,
    getLiveTimeline: () => ({
      getEvents: () => events
    })
  }
}

// Mock Matrix client
function createMockMatrixClient(options?: {
  userId?: string
  rooms?: Map<string, any>
  directRooms?: Record<string, string[]>
}) {
  const rooms = options?.rooms || new Map()
  const directRooms = options?.directRooms || {}

  return {
    getUserId: () => options?.userId || '@testuser:matrix.org',
    getRoom: (roomId: string) => rooms.get(roomId) || null,
    getRooms: () => Array.from(rooms.values()),
    createRoom: vi.fn(async (_config: any) => {
      const roomId = `!${Math.random().toString(36).substring(7)}:matrix.org`
      return { room_id: roomId }
    }),
    invite: vi.fn(async () => ({})),
    sendEvent: vi.fn(async () => ({ event_id: `$${Math.random().toString(36).substring(7)}` })),
    sendStateEvent: vi.fn(async () => ({})),
    sendReadReceipt: vi.fn(async () => ({})),
    redactEvent: vi.fn(async () => ({})),
    leave: vi.fn(async () => ({})),
    getAccountData: vi.fn(() => directRooms),
    on: vi.fn(),
    removeListener: vi.fn()
  }
}

describe('MatrixPrivateChatAdapter', () => {
  let adapter: MatrixPrivateChatAdapter
  let mockRooms: Map<string, any>

  beforeEach(() => {
    vi.clearAllMocks()
    mockRooms = new Map()

    // Setup mock rooms
    const directRooms: Record<string, string[]> = {
      '@user1:matrix.org': ['!room1:matrix.org'],
      '@user2:matrix.org': ['!room2:matrix.org']
    }

    mockClient = createMockMatrixClient({
      userId: '@testuser:matrix.org',
      rooms: mockRooms,
      directRooms
    })

    // Create adapter
    adapter = new MatrixPrivateChatAdapter()
  })

  afterEach(async () => {
    await adapter.cleanup()
    vi.clearAllMocks()
  })

  describe('isReady', () => {
    it('should return true when Matrix client is available', async () => {
      const ready = await adapter.isReady()
      expect(ready).toBe(true)
    })

    it('should return false when Matrix client is not available', async () => {
      mockClient = null
      const adapter2 = new MatrixPrivateChatAdapter()
      const ready = await adapter2.isReady()
      expect(ready).toBe(false)
    })
  })

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await expect(adapter.initialize()).resolves.toBeUndefined()
    })

    it('should throw error when Matrix client is not initialized', async () => {
      mockClient = null
      const adapter2 = new MatrixPrivateChatAdapter()
      await expect(adapter2.initialize()).rejects.toThrow('Matrix 客户端未初始化')
    })
  })

  describe('listSessions', () => {
    beforeEach(() => {
      // Setup mock rooms with events
      const room1 = createMockRoom({
        roomId: '!room1:matrix.org',
        name: 'User 1',
        avatar: 'mxc://matrix.org/avatar1',
        events: [
          createMockMatrixEvent({
            type: 'm.room.message',
            sender: '@user1:matrix.org',
            content: { msgtype: 'm.text', body: 'Hello' },
            timestamp: Date.now() - 1000
          })
        ],
        unreadCount: 2
      })

      const room2 = createMockRoom({
        roomId: '!room2:matrix.org',
        name: 'User 2',
        events: [],
        unreadCount: 0
      })

      mockRooms.set('!room1:matrix.org', room1)
      mockRooms.set('!room2:matrix.org', room2)
    })

    it('should return list of private chat sessions', async () => {
      const sessions = await adapter.listSessions()

      expect(sessions).toHaveLength(2)
      expect(sessions[0]).toMatchObject({
        sessionId: '!room1:matrix.org',
        userId: '@user1:matrix.org',
        displayName: 'User 1',
        avatarUrl: 'mxc://matrix.org/avatar1',
        unreadCount: 2
      })
    })

    it('should return sessions sorted by last message time', async () => {
      const sessions = await adapter.listSessions()

      // Room1 has more recent message, should be first
      expect(sessions[0].sessionId).toBe('!room1:matrix.org')
    })

    it('should return empty array when no direct rooms exist', async () => {
      mockClient.getAccountData = vi.fn(() => ({}))
      const sessions = await adapter.listSessions()
      expect(sessions).toEqual([])
    })

    it('should handle errors gracefully', async () => {
      mockClient.getRoom = vi.fn(() => {
        throw new Error('Room error')
      })

      const sessions = await adapter.listSessions()
      // Should return empty array on error
      expect(Array.isArray(sessions)).toBe(true)
    })
  })

  describe('createSession', () => {
    it('should create new private chat session', async () => {
      const roomId = await adapter.createSession('@newuser:matrix.org')

      expect(roomId).toBeDefined()
      expect(typeof roomId).toBe('string')
      expect(roomId).toMatch(/^!/)
    })

    it('should return existing room ID if direct room already exists', async () => {
      const roomId1 = await adapter.createSession('@user1:matrix.org')
      const roomId2 = await adapter.createSession('@user1:matrix.org')

      expect(roomId1).toBe(roomId2)
    })

    it('should create room with correct configuration', async () => {
      await adapter.createSession('@newuser:matrix.org')

      expect(mockClient.createRoom).toHaveBeenCalledWith(
        expect.objectContaining({
          is_direct: true,
          preset: 'trusted_private_chat',
          visibility: 'private',
          invite: ['@newuser:matrix.org']
        })
      )
    })
  })

  describe('getMessages', () => {
    beforeEach(() => {
      const room = createMockRoom({
        roomId: '!room1:matrix.org',
        events: [
          createMockMatrixEvent({
            type: 'm.room.message',
            sender: '@user1:matrix.org',
            content: { msgtype: 'm.text', body: 'Message 1' },
            eventId: '$event1',
            timestamp: 1000
          }),
          createMockMatrixEvent({
            type: 'm.room.message',
            sender: '@testuser:matrix.org',
            content: { msgtype: 'm.text', body: 'Message 2' },
            eventId: '$event2',
            timestamp: 2000
          }),
          createMockMatrixEvent({
            type: 'm.room.member', // Non-message event
            sender: '@user1:matrix.org',
            content: {},
            eventId: '$event3',
            timestamp: 3000
          })
        ]
      })

      mockRooms.set('!room1:matrix.org', room)
    })

    it('should return messages for a session', async () => {
      const messages = await adapter.getMessages('!room1:matrix.org')

      expect(messages).toHaveLength(2)
      expect(messages[0]).toMatchObject({
        sessionId: '!room1:matrix.org',
        content: 'Message 1',
        type: 'text'
      })
    })

    it('should return messages sorted by timestamp', async () => {
      const messages = await adapter.getMessages('!room1:matrix.org')

      expect(messages[0].timestamp).toBeLessThan(messages[1].timestamp)
    })

    it('should limit number of messages returned', async () => {
      const messages = await adapter.getMessages('!room1:matrix.org', 1)

      expect(messages).toHaveLength(1)
    })

    it('should return empty array for non-existent room', async () => {
      const messages = await adapter.getMessages('!nonexistent:matrix.org')
      expect(messages).toEqual([])
    })

    it('should handle message types correctly', async () => {
      const room = createMockRoom({
        roomId: '!room2:matrix.org',
        events: [
          createMockMatrixEvent({
            type: 'm.room.message',
            sender: '@user1:matrix.org',
            content: { msgtype: 'm.image', body: 'image.png', url: 'mxc://matrix.org/img' },
            timestamp: 1000
          }),
          createMockMatrixEvent({
            type: 'm.room.message',
            sender: '@user1:matrix.org',
            content: { msgtype: 'm.file', body: 'file.pdf', url: 'mxc://matrix.org/file' },
            timestamp: 2000
          }),
          createMockMatrixEvent({
            type: 'm.room.message',
            sender: '@user1:matrix.org',
            content: { msgtype: 'm.audio', body: 'audio.mp3', url: 'mxc://matrix.org/audio' },
            timestamp: 3000
          }),
          createMockMatrixEvent({
            type: 'm.room.message',
            sender: '@user1:matrix.org',
            content: { msgtype: 'm.video', body: 'video.mp4', url: 'mxc://matrix.org/video' },
            timestamp: 4000
          })
        ]
      })

      mockRooms.set('!room2:matrix.org', room)

      const messages = await adapter.getMessages('!room2:matrix.org')

      expect(messages).toHaveLength(4)
      expect(messages[0].type).toBe('image')
      expect(messages[1].type).toBe('file')
      expect(messages[2].type).toBe('voice')
      expect(messages[3].type).toBe('video')
    })
  })

  describe('sendMessage', () => {
    beforeEach(() => {
      // Setup test room for sendMessage tests
      const room = createMockRoom({
        roomId: '!room1:matrix.org',
        events: []
      })
      mockRooms.set('!room1:matrix.org', room)
    })

    it('should send text message', async () => {
      const messageId = await adapter.sendMessage('!room1:matrix.org', 'Hello World', 'text')

      expect(messageId).toBeDefined()
      expect(mockClient.sendEvent).toHaveBeenCalledWith('!room1:matrix.org', 'm.room.message', {
        msgtype: 'm.text',
        body: 'Hello World'
      })
    })

    it('should send image message', async () => {
      const url = 'mxc://matrix.org/image'
      await adapter.sendMessage('!room1:matrix.org', url, 'image')

      expect(mockClient.sendEvent).toHaveBeenCalledWith('!room1:matrix.org', 'm.room.message', {
        msgtype: 'm.image',
        body: url,
        url
      })
    })

    it('should send file message', async () => {
      const url = 'mxc://matrix.org/file'
      await adapter.sendMessage('!room1:matrix.org', url, 'file')

      expect(mockClient.sendEvent).toHaveBeenCalledWith('!room1:matrix.org', 'm.room.message', {
        msgtype: 'm.file',
        body: '[文件]',
        url,
        filename: url
      })
    })

    it('should send voice message', async () => {
      const url = 'mxc://matrix.org/voice'
      await adapter.sendMessage('!room1:matrix.org', url, 'voice')

      expect(mockClient.sendEvent).toHaveBeenCalledWith('!room1:matrix.org', 'm.room.message', {
        msgtype: 'm.audio',
        body: '[语音]',
        url
      })
    })

    it('should send video message', async () => {
      const url = 'mxc://matrix.org/video'
      await adapter.sendMessage('!room1:matrix.org', url, 'video')

      expect(mockClient.sendEvent).toHaveBeenCalledWith('!room1:matrix.org', 'm.room.message', {
        msgtype: 'm.video',
        body: '[视频]',
        url
      })
    })

    it('should set message self-destruct when TTL is provided', async () => {
      const roomId = '!room1:matrix.org'
      const ttl = 60 // seconds

      await adapter.sendMessage(roomId, 'Test message', 'text', ttl)

      // Verify self-destruct state event was sent
      expect(mockClient.sendStateEvent).toHaveBeenCalledWith(
        roomId,
        'm.message_ttl',
        {},
        expect.any(String) // messageId
      )
    })

    it('should throw error when room does not exist', async () => {
      await expect(adapter.sendMessage('!nonexistent:matrix.org', 'Test', 'text')).rejects.toThrow('房间不存在')
    })
  })

  describe('markAsRead', () => {
    it('should mark message as read', async () => {
      await adapter.markAsRead('!room1:matrix.org', '$event1')

      expect(mockClient.sendReadReceipt).toHaveBeenCalledWith('!room1:matrix.org', '$event1')
    })
  })

  describe('recallMessage', () => {
    it('should recall (redact) message', async () => {
      await adapter.recallMessage('!room1:matrix.org', '$event1')

      expect(mockClient.redactEvent).toHaveBeenCalledWith('!room1:matrix.org', '$event1')
    })
  })

  describe('deleteSession', () => {
    it('should delete (leave) session', async () => {
      await adapter.deleteSession('!room1:matrix.org')

      expect(mockClient.leave).toHaveBeenCalledWith('!room1:matrix.org')
    })
  })

  describe('subscribeToMessages', () => {
    it('should subscribe to new messages', async () => {
      const callback = vi.fn()
      const unsubscribe = adapter.subscribeToMessages('!room1:matrix.org', callback)

      expect(typeof unsubscribe).toBe('function')
    })

    it('should return unsubscribe function', async () => {
      const callback = vi.fn()
      const unsubscribe = adapter.subscribeToMessages('!room1:matrix.org', callback)

      unsubscribe()
      // Should not throw
      expect(() => unsubscribe()).not.toThrow()
    })
  })

  describe('subscribeToSessionUpdates', () => {
    it('should subscribe to session updates', async () => {
      const callback = vi.fn()
      const unsubscribe = adapter.subscribeToSessionUpdates(callback)

      expect(typeof unsubscribe).toBe('function')
    })
  })

  describe('cleanup', () => {
    it('should cleanup resources', async () => {
      await expect(adapter.cleanup()).resolves.toBeUndefined()
    })
  })

  describe('priority', () => {
    it('should have priority 80', () => {
      expect(adapter.priority).toBe(80)
    })
  })

  describe('name', () => {
    it('should have name matrix-private-chat', () => {
      expect(adapter.name).toBe('matrix-private-chat')
    })
  })
})
