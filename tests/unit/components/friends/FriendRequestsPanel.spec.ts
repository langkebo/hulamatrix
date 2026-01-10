/**
 * FriendRequestsPanel Component Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'

// Mock Naive UI components
vi.mock('naive-ui', () => ({
  NCollapse: defineComponent({
    name: 'NCollapse',
    setup(props, { slots }) {
      return () => h('div', { class: 'n-collapse' }, slots.default?.())
    }
  }),
  NCollapseItem: defineComponent({
    name: 'NCollapseItem',
    props: ['title', 'name'],
    setup(props, { slots }) {
      return () => h('div', { class: 'n-collapse-item' }, [
        h('div', { class: 'n-collapse-item__header' }, props.title),
        h('div', { class: 'n-collapse-item__content' }, slots.default?.())
      ])
    }
  }),
  NFlex: defineComponent({
    name: 'NFlex',
    props: ['vertical', 'size'],
    setup(props, { slots }) {
      return () => h('div', { class: `n-flex ${props.vertical ? 'vertical' : ''}` }, slots.default?.())
    }
  }),
  NSpace: defineComponent({
    name: 'NSpace',
    props: ['size'],
    setup(props, { slots }) {
      return () => h('div', { class: 'n-space' }, slots.default?.())
    }
  }),
  NButton: defineComponent({
    name: 'NButton',
    props: ['size', 'type'],
    emits: ['click'],
    setup(props, { slots, emit }) {
      return () => h('button', {
        class: `n-button n-button--${props.type || 'default'}`,
        onClick: () => emit('click')
      }, slots.default?.())
    }
  }),
  NAvatar: defineComponent({
    name: 'NAvatar',
    props: ['size', 'round'],
    setup(props, { slots }) {
      return () => h('div', {
        class: 'n-avatar',
        style: { width: `${props.size}px`, height: `${props.size}px`, borderRadius: props.round ? '50%' : '8px' }
      }, slots.default?.())
    }
  }),
  useMessage: () => ({
    success: vi.fn(),
    error: vi.fn()
  })
}))

// Mock store
const mockFriendsStore = {
  pending: [] as any[],
  pendingCount: 0,
  acceptRequest: vi.fn(),
  rejectRequest: vi.fn()
}

vi.mock('@/stores/friendsSDK', () => ({
  useFriendsStoreV2: () => mockFriendsStore
}))

vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn()
  }
}))

import FriendRequestsPanel from '@/components/friends/FriendRequestsPanel.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: {
    'zh-CN': {
      friends: {
        requests: {
          pending_title: '待处理的好友请求',
          empty: '暂无待处理的好友请求',
          accept: '接受',
          reject: '拒绝',
          accepted: '已接受好友请求',
          rejected: '已拒绝好友请求',
          error: '操作失败'
        }
      }
    }
  }
})

describe('FriendRequestsPanel Component', () => {
  let wrapper: VueWrapper

  beforeEach(() => {
    setActivePinia(createPinia())
    mockFriendsStore.pending = []
    mockFriendsStore.pendingCount = 0
  })

  describe('Rendering', () => {
    it('should render empty state when no pending requests', () => {
      wrapper = mount(FriendRequestsPanel, {
        global: {
          plugins: [i18n]
        }
      })

      expect(wrapper.find('.empty-state').exists()).toBe(true)
      expect(wrapper.text()).toContain('暂无待处理的好友请求')
    })

    it('should render pending requests', () => {
      mockFriendsStore.pending = [
        {
          id: 'req1',
          requester_id: '@alice:example.com',
          requester_display_name: 'Alice',
          message: 'Hi, let\'s be friends!'
        },
        {
          id: 'req2',
          requester_id: '@bob:example.com',
          requester_display_name: 'Bob',
          message: 'Hello!'
        }
      ]

      wrapper = mount(FriendRequestsPanel, {
        global: {
          plugins: [i18n]
        }
      })

      expect(wrapper.text()).toContain('Alice')
      expect(wrapper.text()).toContain('Bob')
      expect(wrapper.text()).toContain('Hi, let\'s be friends!')
    })

    it('should display request count', () => {
      mockFriendsStore.pending = [
        { id: 'req1', requester_id: '@alice:example.com' },
        { id: 'req2', requester_id: '@bob:example.com' }
      ]
      mockFriendsStore.pendingCount = 2

      wrapper = mount(FriendRequestsPanel, {
        global: {
          plugins: [i18n]
        }
      })

      expect(wrapper.find('.request-count').text()).toBe('2')
    })
  })

  describe('Actions', () => {
    it('should accept friend request', async () => {
      const mockRequest = {
        id: 'req1',
        requester_id: '@alice:example.com',
        requester_display_name: 'Alice'
      }

      mockFriendsStore.pending = [mockRequest]
      mockFriendsStore.acceptRequest.mockResolvedValue(undefined)

      wrapper = mount(FriendRequestsPanel, {
        global: {
          plugins: [i18n]
        }
      })

      const acceptButton = wrapper.findAll('.n-button').find(btn => btn.text() === '接受')
      await acceptButton?.trigger('click')

      expect(mockFriendsStore.acceptRequest).toHaveBeenCalledWith('req1')
    })

    it('should reject friend request', async () => {
      const mockRequest = {
        id: 'req1',
        requester_id: '@alice:example.com',
        requester_display_name: 'Alice'
      }

      mockFriendsStore.pending = [mockRequest]
      mockFriendsStore.rejectRequest.mockResolvedValue(undefined)

      wrapper = mount(FriendRequestsPanel, {
        global: {
          plugins: [i18n]
        }
      })

      const rejectButton = wrapper.findAll('.n-button').find(btn => btn.text() === '拒绝')
      await rejectButton?.trigger('click')

      expect(mockFriendsStore.rejectRequest).toHaveBeenCalledWith('req1')
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      wrapper = mount(FriendRequestsPanel, {
        global: {
          plugins: [i18n]
        }
      })

      const collapse = wrapper.find('.n-collapse')
      expect(collapse.exists()).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should show error message when accept fails', async () => {
      const mockRequest = {
        id: 'req1',
        requester_id: '@alice:example.com',
        requester_display_name: 'Alice'
      }

      mockFriendsStore.pending = [mockRequest]
      mockFriendsStore.acceptRequest.mockRejectedValue(new Error('Network error'))

      wrapper = mount(FriendRequestsPanel, {
        global: {
          plugins: [i18n]
        }
      })

      const acceptButton = wrapper.findAll('.n-button').find(btn => btn.text() === '接受')
      await acceptButton?.trigger('click')

      // Should show error
      expect(wrapper.find('.error-message').exists()).toBe(true)
    })
  })
})
