/**
 * Chat Session Removal Property-Based Tests
 *
 * **Feature: sdk-backend-integration, Property 2: Session Removal with Leave**
 * **Validates: Requirements 2.1, 2.3, 2.4**
 *
 * *For any* session removal operation with `leaveRoom=true`, the Matrix client's
 * `leave` method should be called, and the room should not reappear in the
 * session list even after receiving new messages.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import { createPinia, setActivePinia } from 'pinia'

// Mock logger - must be before any imports that use it
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}))

// Mock Tauri APIs
vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: {
    getCurrent: vi.fn().mockReturnValue({ label: 'home' })
  }
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}))

vi.mock('@tauri-apps/plugin-notification', () => ({
  sendNotification: vi.fn()
}))

// Mock vue-router
vi.mock('vue-router', () => ({
  useRoute: vi.fn().mockReturnValue({ path: '/message' })
}))

// Mock useMitt
vi.mock('@/hooks/useMitt', () => ({
  useMitt: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn()
  }
}))

// Mock envFlags
vi.mock('@/utils/envFlags', () => ({
  flags: {
    matrixEnabled: true
  }
}))

// Mock TauriInvokeHandler
vi.mock('@/utils/TauriInvokeHandler', () => ({
  invokeWithErrorHandler: vi.fn().mockResolvedValue(null)
}))

// Mock services
vi.mock('@/services/messages', () => ({
  getSessionDetail: vi.fn(),
  pageMessages: vi.fn().mockResolvedValue({ list: [], cursor: '', isLast: true }),
  runInBatches: vi.fn().mockResolvedValue([]),
  MESSAGES_POLICY: { MAX_CONCURRENCY: 5 },
  sdkPageMessagesWithCursor: vi.fn().mockResolvedValue({ data: [], nextCursor: '', hasMore: false })
}))

vi.mock('@/services/session', () => ({
  applyPersistedUnreadCounts: vi.fn(),
  persistUnreadCount: vi.fn(),
  removeUnreadCountCache: vi.fn(),
  requestUnreadUpdate: vi.fn(),
  setUnreadUpdateCallback: vi.fn()
}))

vi.mock('@/integrations/matrix/history', () => ({
  prefetchShallowHistory: vi.fn(),
  tryBackfillWhenNoPagination: vi.fn()
}))

// Mock Matrix client service - use vi.fn() inside factory
vi.mock('@/integrations/matrix/client', () => {
  const leaveFn = vi.fn().mockResolvedValue(undefined)
  return {
    matrixClientService: {
      getClient: vi.fn().mockReturnValue({
        leave: leaveFn,
        getUserId: vi.fn().mockReturnValue('@user:example.org')
      }),
      initialize: vi.fn(),
      startClient: vi.fn(),
      stopClient: vi.fn()
    }
  }
})

// Mock other stores
vi.mock('@/stores/room', () => ({
  useRoomStore: vi.fn().mockReturnValue({
    getMember: vi.fn(),
    getService: vi.fn()
  })
}))

vi.mock('@/stores/user', () => ({
  useUserStore: vi.fn().mockReturnValue({
    userInfo: { uid: 'test-user-id' }
  })
}))

vi.mock('@/stores/sessionUnread', () => ({
  useSessionUnreadStore: vi.fn().mockReturnValue({
    unreadCounts: {}
  })
}))

// Mock HiddenSessions - use a module-level Set that persists
vi.mock('@/utils/HiddenSessions', () => {
  const hiddenSet = new Set<string>()
  return {
    hiddenSessions: {
      add: vi.fn((roomId: string) => hiddenSet.add(roomId)),
      remove: vi.fn((roomId: string) => hiddenSet.delete(roomId)),
      isHidden: vi.fn((roomId: string) => hiddenSet.has(roomId)),
      clear: vi.fn(() => hiddenSet.clear()),
      getAll: vi.fn(() => Array.from(hiddenSet)),
      _getSet: () => hiddenSet // For test access
    }
  }
})

// Mock enhancedMessageService
vi.mock('@/services/enhancedMessageService', () => ({
  enhancedMessageService: {
    sendMessage: vi.fn()
  }
}))

// Mock threadService
vi.mock('@/services/threadService', () => ({
  threadService: {
    getThreadRoot: vi.fn()
  }
}))

// Import after mocks
import { useChatStore } from '@/stores/chat'
import { hiddenSessions } from '@/utils/HiddenSessions'
import { matrixClientService } from '@/integrations/matrix/client'
import { RoomTypeEnum } from '@/enums'

// Helper to create a test session
const createTestSession = (roomId: string) => ({
  roomId,
  name: 'Test Room',
  avatar: '/avatar/001.webp',
  text: 'Last message',
  activeTime: Date.now(),
  unreadCount: 0,
  type: RoomTypeEnum.SINGLE,
  top: false,
  id: roomId,
  detailId: 'test-detail',
  hotFlag: 0,
  account: '',
  operate: 0,
  hide: false,
  muteNotification: 0,
  shield: false,
  allowScanEnter: true
})

// Get the mock leave function
const getMockLeave = () => {
  const client = matrixClientService.getClient()
  return client?.leave as ReturnType<typeof vi.fn>
}

// Get the hidden sessions set for clearing
const getHiddenSet = () => {
  return (hiddenSessions as any)._getSet() as Set<string>
}

describe('Chat Session Removal Property-Based Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    getHiddenSet().clear()
  })

  afterEach(() => {
    vi.clearAllMocks()
    getHiddenSet().clear()
  })

  /**
   * Property-Based Test: Session Removal with Leave
   * **Feature: sdk-backend-integration, Property 2: Session Removal with Leave**
   * **Validates: Requirements 2.1, 2.3, 2.4**
   */
  describe('Property 2: Session Removal with Leave', () => {
    // Generate random room IDs
    const roomIdArb = fc.string({ minLength: 1, maxLength: 50 }).map((s) => `!${s}:example.org`)

    it('should call Matrix leave when leaveRoom=true for any room', async () => {
      await fc.assert(
        fc.asyncProperty(roomIdArb, async (roomId) => {
          // Reset state for each iteration
          const mockLeave = getMockLeave()
          mockLeave.mockClear()
          getHiddenSet().clear()
          setActivePinia(createPinia())

          const chatStore = useChatStore()
          const session = createTestSession(roomId)

          // Add session to store
          chatStore.sessionList.push(session as any)
          chatStore.sessionMap[roomId] = session as any

          // Remove session with leaveRoom=true
          await chatStore.removeSession(roomId, { leaveRoom: true })

          // Verify Matrix leave was called
          expect(mockLeave).toHaveBeenCalledWith(roomId)
          expect(mockLeave).toHaveBeenCalledTimes(1)
        }),
        { numRuns: 100 }
      )
    })

    it('should NOT call Matrix leave when leaveRoom=false for any room', async () => {
      await fc.assert(
        fc.asyncProperty(roomIdArb, async (roomId) => {
          // Reset state for each iteration
          const mockLeave = getMockLeave()
          mockLeave.mockClear()
          getHiddenSet().clear()
          setActivePinia(createPinia())

          const chatStore = useChatStore()
          const session = createTestSession(roomId)

          // Add session to store
          chatStore.sessionList.push(session as any)
          chatStore.sessionMap[roomId] = session as any

          // Remove session with leaveRoom=false
          await chatStore.removeSession(roomId, { leaveRoom: false })

          // Verify Matrix leave was NOT called
          expect(mockLeave).not.toHaveBeenCalled()
        }),
        { numRuns: 100 }
      )
    })

    it('should add room to hidden sessions to prevent re-activation for any room', async () => {
      await fc.assert(
        fc.asyncProperty(roomIdArb, async (roomId) => {
          // Reset state for each iteration
          const mockLeave = getMockLeave()
          mockLeave.mockClear()
          getHiddenSet().clear()
          setActivePinia(createPinia())

          const chatStore = useChatStore()
          const session = createTestSession(roomId)

          // Add session to store
          chatStore.sessionList.push(session as any)
          chatStore.sessionMap[roomId] = session as any

          // Remove session with leaveRoom=true
          await chatStore.removeSession(roomId, { leaveRoom: true })

          // Verify room is added to hidden sessions
          expect(hiddenSessions.add).toHaveBeenCalledWith(roomId)
          expect(hiddenSessions.isHidden(roomId)).toBe(true)
        }),
        { numRuns: 100 }
      )
    })

    it('should remove session from sessionList and sessionMap for any room', async () => {
      await fc.assert(
        fc.asyncProperty(roomIdArb, async (roomId) => {
          // Reset state for each iteration
          const mockLeave = getMockLeave()
          mockLeave.mockClear()
          getHiddenSet().clear()
          setActivePinia(createPinia())

          const chatStore = useChatStore()
          const session = createTestSession(roomId)

          // Add session to store
          chatStore.sessionList.push(session as any)
          chatStore.sessionMap[roomId] = session as any

          // Verify session exists before removal
          expect(chatStore.sessionList.find((s) => s.roomId === roomId)).toBeDefined()

          // Remove session with leaveRoom=true
          await chatStore.removeSession(roomId, { leaveRoom: true })

          // Verify session is removed from both sessionList and sessionMap
          expect(chatStore.sessionList.find((s) => s.roomId === roomId)).toBeUndefined()
          expect(chatStore.getSession(roomId)).toBeUndefined()
        }),
        { numRuns: 100 }
      )
    })

    it('should handle leave failure gracefully and still remove session locally', async () => {
      await fc.assert(
        fc.asyncProperty(roomIdArb, async (roomId) => {
          // Reset state for each iteration
          getHiddenSet().clear()
          setActivePinia(createPinia())

          // Make leave fail for this test
          const mockLeave = getMockLeave()
          mockLeave.mockRejectedValueOnce(new Error('Network error'))

          const chatStore = useChatStore()
          const session = createTestSession(roomId)

          // Add session to store
          chatStore.sessionList.push(session as any)
          chatStore.sessionMap[roomId] = session as any

          // Remove session with leaveRoom=true (should not throw even if leave fails)
          await chatStore.removeSession(roomId, { leaveRoom: true })

          // Verify session is still removed locally even if leave failed
          expect(chatStore.sessionList.find((s) => s.roomId === roomId)).toBeUndefined()
          expect(hiddenSessions.isHidden(roomId)).toBe(true)
        }),
        { numRuns: 50 }
      )
    })
  })
})
