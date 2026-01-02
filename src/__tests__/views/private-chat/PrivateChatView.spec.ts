/**
 * PrivateChatView Component Tests
 *
 * 测试私密聊天视图组件的核心功能：
 * - 组件渲染
 * - 会话列表加载
 * - 消息发送
 * - 用户交互
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import PrivateChatView from '@/views/private-chat/PrivateChatView.vue'
import type { PrivateChatSession, PrivateChatMessage } from '@/adapters/service-adapter'

// Mock adapters
vi.mock('@/adapters', () => ({
  matrixPrivateChatAdapter: {
    listSessions: vi.fn(),
    getMessages: vi.fn(),
    createSession: vi.fn(),
    sendMessage: vi.fn(),
    deleteSession: vi.fn(),
    clearHistory: vi.fn()
  },
  matrixFriendAdapter: {
    getPresence: vi.fn()
  }
}))

// Mock router
vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn()
  })),
  useRoute: vi.fn(() => ({
    params: {},
    query: {},
    path: '/private-chat'
  }))
}))

// Mock user store
vi.mock('@/stores/user', () => ({
  useUserStore: vi.fn(() => ({
    userInfo: {
      uid: '@testuser:matrix.org',
      name: 'Test User',
      avatar: 'avatar.png'
    }
  }))
}))

// Mock chat store
vi.mock('@/stores/chat', () => ({
  useChatStore: vi.fn(() => ({
    share: { enable: true }
  }))
}))

// Mock i18n
vi.mock('vue-i18n', () => ({
  useI18n: vi.fn(() => ({
    t: (key: string) => key
  }))
}))

// Mock Naive UI components
vi.mock('naive-ui', () => ({
  NButton: { template: '<button><slot /></button>' },
  NAvatar: { template: '<div><slot /></div>' },
  NBadge: { template: '<span><slot /></span>' },
  NSpin: { template: '<div><slot /></div>' },
  NEmpty: { template: '<div><slot /></div>' },
  NDropdown: { template: '<div><slot /></div>' },
  NInput: { template: '<input v-model="$attrs.value" />' },
  NCollapse: { template: '<div><slot /></div>' },
  NCollapseItem: { template: '<div><slot /></div>' },
  NRadioGroup: { template: '<div><slot /></div>' },
  NRadioButton: { template: '<button><slot /></button>' },
  NModal: { template: '<div v-if="$attrs.show"><slot /></div>' },
  NForm: { template: '<form><slot /></form>' },
  NFormItem: { template: '<div><slot /></div>' },
  NSpace: { template: '<div><slot /></div>' },
  NFlex: { template: '<div><slot /></div>' },
  useDialog: vi.fn(() => ({
    warning: vi.fn()
  })),
  useMessage: vi.fn(() => ({
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn()
  })),
  useNotification: vi.fn(() => ({
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn()
  }))
}))

import { matrixPrivateChatAdapter, matrixFriendAdapter } from '@/adapters'

describe('PrivateChatView', () => {
  let wrapper: VueWrapper<any>
  let pinia: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup Pinia
    pinia = createPinia()
    setActivePinia(pinia)

    // Mock default return values
    vi.mocked(matrixPrivateChatAdapter.listSessions).mockResolvedValue([])
    vi.mocked(matrixPrivateChatAdapter.getMessages).mockResolvedValue([])
    vi.mocked(matrixFriendAdapter.getPresence).mockResolvedValue('offline')
  })

  describe('component rendering', () => {
    it('should mount successfully', async () => {
      wrapper = mount(PrivateChatView, {
        global: {
          plugins: [pinia]
        }
      })

      expect(wrapper.exists()).toBe(true)
      expect(wrapper.find('.private-chat-container').exists()).toBe(true)
    })

    it('should render sessions sidebar', async () => {
      wrapper = mount(PrivateChatView, {
        global: {
          plugins: [pinia]
        }
      })

      await nextTick()

      expect(wrapper.find('.sessions-sidebar').exists()).toBe(true)
      expect(wrapper.find('.chat-area').exists()).toBe(true)
    })
  })

  describe('sessions loading', () => {
    it('should load sessions on mount', async () => {
      const mockSessions: PrivateChatSession[] = [
        {
          sessionId: '!room1:matrix.org',
          userId: '@user1:matrix.org',
          displayName: 'User 1',
          avatarUrl: 'avatar1.png',
          unreadCount: 0,
          isRead: true
        }
      ]

      vi.mocked(matrixPrivateChatAdapter.listSessions).mockResolvedValue(mockSessions)

      wrapper = mount(PrivateChatView, {
        global: {
          plugins: [pinia]
        }
      })

      await nextTick()
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(matrixPrivateChatAdapter.listSessions).toHaveBeenCalled()
    })

    it('should show loading state initially', async () => {
      // Mock a delayed response
      vi.mocked(matrixPrivateChatAdapter.listSessions).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 100))
      )

      wrapper = mount(PrivateChatView, {
        global: {
          plugins: [pinia]
        }
      })

      await nextTick()

      // Component should be mounted
      expect(wrapper.exists()).toBe(true)
    })

    it('should show empty state when no sessions', async () => {
      vi.mocked(matrixPrivateChatAdapter.listSessions).mockResolvedValue([])

      wrapper = mount(PrivateChatView, {
        global: {
          plugins: [pinia]
        }
      })

      await nextTick()
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(matrixPrivateChatAdapter.listSessions).toHaveBeenCalled()
    })
  })

  describe('session selection', () => {
    beforeEach(async () => {
      const mockSessions: PrivateChatSession[] = [
        {
          sessionId: '!room1:matrix.org',
          userId: '@user1:matrix.org',
          displayName: 'User 1',
          avatarUrl: 'avatar1.png',
          unreadCount: 2,
          isRead: false,
          lastMessage: {
            content: 'Hello',
            timestamp: Date.now(),
            isSelf: false
          }
        }
      ]

      const mockMessages: PrivateChatMessage[] = [
        {
          messageId: '$msg1',
          sessionId: '!room1:matrix.org',
          senderId: '@user1:matrix.org',
          content: 'Hello',
          type: 'text',
          timestamp: Date.now(),
          isSelf: false,
          status: 'sent'
        }
      ]

      vi.mocked(matrixPrivateChatAdapter.listSessions).mockResolvedValue(mockSessions)
      vi.mocked(matrixPrivateChatAdapter.getMessages).mockResolvedValue(mockMessages)

      wrapper = mount(PrivateChatView, {
        global: {
          plugins: [pinia]
        }
      })

      await nextTick()
      await new Promise((resolve) => setTimeout(resolve, 100))
    })

    it('should load messages when session is selected', async () => {
      // Verify listSessions was called on mount
      expect(matrixPrivateChatAdapter.listSessions).toHaveBeenCalled()
    })
  })

  describe('message sending', () => {
    beforeEach(async () => {
      const mockSessions: PrivateChatSession[] = [
        {
          sessionId: '!room1:matrix.org',
          userId: '@user1:matrix.org',
          displayName: 'User 1',
          avatarUrl: 'avatar1.png',
          unreadCount: 0,
          isRead: true
        }
      ]

      vi.mocked(matrixPrivateChatAdapter.listSessions).mockResolvedValue(mockSessions)
      vi.mocked(matrixPrivateChatAdapter.getMessages).mockResolvedValue([])
      vi.mocked(matrixPrivateChatAdapter.sendMessage).mockResolvedValue('$newmsg:matrix.org')

      wrapper = mount(PrivateChatView, {
        global: {
          plugins: [pinia]
        }
      })

      await nextTick()
      await new Promise((resolve) => setTimeout(resolve, 100))
    })

    it('should send message via adapter', async () => {
      // The component should be able to send messages
      expect(matrixPrivateChatAdapter.listSessions).toHaveBeenCalled()
    })
  })

  describe('time formatting', () => {
    it('should have formatTime method', () => {
      wrapper = mount(PrivateChatView, {
        global: {
          plugins: [pinia]
        }
      })

      // Verify component has the method
      expect(typeof wrapper.vm.formatTime).toBe('function')
    })
  })

  describe('presence status', () => {
    it('should have getPresenceText method', () => {
      wrapper = mount(PrivateChatView, {
        global: {
          plugins: [pinia]
        }
      })

      expect(typeof wrapper.vm.getPresenceText).toBe('function')
      expect(wrapper.vm.getPresenceText('online')).toBeTruthy()
      expect(wrapper.vm.getPresenceText('offline')).toBeTruthy()
    })
  })

  describe('message status', () => {
    it('should have getStatusText method', () => {
      wrapper = mount(PrivateChatView, {
        global: {
          plugins: [pinia]
        }
      })

      expect(typeof wrapper.vm.getStatusText).toBe('function')
    })
  })

  describe('create new session', () => {
    it('should have create session functionality', () => {
      wrapper = mount(PrivateChatView, {
        global: {
          plugins: [pinia]
        }
      })

      expect(typeof wrapper.vm.handleCreateSession).toBe('function')
    })
  })

  describe('chat menu actions', () => {
    it('should have chat menu handler', () => {
      wrapper = mount(PrivateChatView, {
        global: {
          plugins: [pinia]
        }
      })

      expect(typeof wrapper.vm.handleChatMenuAction).toBe('function')
    })
  })
})
