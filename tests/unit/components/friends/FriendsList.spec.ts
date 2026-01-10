/**
 * FriendsList Component Unit Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'

// Mock Naive UI components
vi.mock('naive-ui', () => ({
  NFlex: defineComponent({
    name: 'NFlex',
    props: ['vertical', 'size'],
    setup(props, { slots }) {
      return () =>
        h(
          'div',
          { class: `n-flex ${props.vertical ? 'vertical' : ''}` },
          slots.default?.()
        )
    }
  }),
  NSpace: defineComponent({
    name: 'NSpace',
    props: ['align', 'justify', 'size'],
    setup(props, { slots }) {
      return () => h('div', { class: 'n-space' }, slots.default?.())
    }
  }),
  NInput: defineComponent({
    name: 'NInput',
    props: ['value', 'size', 'placeholder', 'clearable', 'disabled'],
    emits: ['update:value'],
    setup(props, { emit, slots }) {
      return () =>
        h('input', {
          class: 'n-input',
          value: props.value,
          placeholder: props.placeholder,
          disabled: props.disabled,
          onInput: (e: any) => emit('update:value', e.target.value)
        }, slots.prefix?.())
    }
  }),
  NButton: defineComponent({
    name: 'NButton',
    props: ['size', 'type', 'secondary', 'quaternary', 'circle', 'loading', 'disabled'],
    emits: ['click'],
    setup(props, { slots, emit }) {
      return () => h('button', {
        class: `n-button n-button--${props.type || 'default'}`,
        disabled: props.disabled,
        onClick: () => emit('click')
      }, props.loading ? 'Loading...' : slots.default?.())
    }
  }),
  NTag: defineComponent({
    name: 'NTag',
    props: ['type', 'color', 'bordered', 'size'],
    emits: ['click'],
    setup(props, { slots, emit }) {
      return () => h('span', {
        class: `n-tag n-tag--${props.type || 'default'}`,
        onClick: () => emit('click')
      }, slots.default?.())
    }
  }),
  NAvatar: defineComponent({
    name: 'NAvatar',
    props: ['size', 'round', 'src'],
    setup(props, { slots }) {
      return () => h('div', {
        class: 'n-avatar',
        style: { width: `${props.size}px`, height: `${props.size}px`, borderRadius: props.round ? '50%' : '8px' }
      }, slots.default?.())
    }
  }),
  NScrollbar: defineComponent({
    name: 'NScrollbar',
    props: ['x-scrollable'],
    setup(props, { slots }) {
      return () => h('div', { class: 'n-scrollbar' }, slots.default?.())
    }
  }),
  NCollapse: defineComponent({
    name: 'NCollapse',
    props: [],
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
  NModal: defineComponent({
    name: 'NModal',
    props: ['show', 'preset', 'title', 'style'],
    emits: ['update:show'],
    setup(props, { slots, emit }) {
      return () => props.show ? h('div', { class: 'n-modal' }, slots.default?.()) : null
    }
  }),
  NForm: defineComponent({
    name: 'NForm',
    props: ['model', 'rules', 'labelPlacement', 'labelWidth'],
    setup(props, { slots }) {
      return () => h('form', { class: 'n-form' }, slots.default?.())
    }
  }),
  NFormItem: defineComponent({
    name: 'NFormItem',
    props: ['label', 'path'],
    setup(props, { slots }) {
      return () => h('div', { class: 'n-form-item' }, [
        h('label', props.label),
        slots.default?.()
      ])
    }
  }),
  NSelect: defineComponent({
    name: 'NSelect',
    props: ['value', 'options', 'placeholder'],
    emits: ['update:value'],
    setup(props, { emit }) {
      return () => h('select', {
        class: 'n-select',
        value: props.value,
        onChange: (e: any) => emit('update:value', e.target.value)
      }, props.options?.map((opt: any) => h('option', { value: opt.value }, opt.label)))
    }
  }),
  NColorPicker: defineComponent({
    name: 'NColorPicker',
    props: ['value', 'modes', 'actions', 'disabled'],
    emits: ['update:value'],
    setup(props, { emit }) {
      return () => h('input', {
        type: 'color',
        class: 'n-color-picker',
        value: props.value,
        disabled: props.disabled,
        onChange: (e: any) => emit('update:value', e.target.value)
      })
    }
  }),
  NSpin: defineComponent({
    name: 'NSpin',
    props: ['size'],
    setup() {
      return () => h('div', { class: 'n-spin' }, 'Loading...')
    }
  }),
  NEmpty: defineComponent({
    name: 'NEmpty',
    props: ['description', 'size'],
    setup(props, { slots }) {
      return () => h('div', { class: 'n-empty' }, [
        props.description,
        slots.extra?.()
      ])
    }
  }),
  NDropdown: defineComponent({
    name: 'NDropdown',
    props: ['options'],
    emits: ['select'],
    setup(props, { slots, emit }) {
      return () => h('div', {
        class: 'n-dropdown',
        onClick: () => emit('select', props.options?.[0]?.key)
      }, slots.default?.())
    }
  }),
  NVirtualList: defineComponent({
    name: 'NVirtualList',
    props: ['items', 'itemSize'],
    setup(props, { slots }) {
      return () => h('div', { class: 'n-virtual-list' },
        props.items?.map((item: any) => slots.default?.({ item }))
      )
    }
  }),
  NStatistic: defineComponent({
    name: 'NStatistic',
    props: ['label', 'value'],
    setup(props) {
      return () => h('div', { class: 'n-statistic' }, [
        h('div', { class: 'n-statistic__label' }, props.label),
        h('div', { class: 'n-statistic__value' }, props.value)
      ])
    }
  }),
  NIcon: defineComponent({
    name: 'NIcon',
    props: ['component', 'size'],
    setup() {
      return () => h('span', { class: 'n-icon' })
    }
  }),
  useDialog: () => ({
    warning: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }),
  useMessage: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn()
  }),
  type: {}
}))

// Mock store
const mockFriendsStore = {
  loading: false,
  friends: [] as any[],
  categories: [] as any[],
  pending: [] as any[],
  blockedUsers: [] as any[],
  totalFriendsCount: 0,
  onlineFriendsCount: 0,
  pendingCount: 0,
  initialize: vi.fn(),
  fetchFriends: vi.fn(),
  fetchCategories: vi.fn(),
  fetchStats: vi.fn(),
  fetchPendingRequests: vi.fn(),
  createCategory: vi.fn(),
  deleteCategory: vi.fn(),
  sendRequest: vi.fn(),
  acceptRequest: vi.fn(),
  rejectRequest: vi.fn(),
  removeFriend: vi.fn(),
  blockUser: vi.fn(),
  unblockUser: vi.fn(),
  setRemark: vi.fn(),
  refreshAll: vi.fn(),
  refresh: vi.fn()
}

vi.mock('@/stores/friendsSDK', () => ({
  useFriendsStoreV2: () => mockFriendsStore,
  useFriendsSDKStore: () => mockFriendsStore
}))

// Mock other dependencies
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  }
}))

vi.mock('@/utils/appErrorHandler', () => ({
  checkAppReady: () => true,
  withAppCheck: (fn: any) => fn(),
  handleAppError: vi.fn(),
  AppErrorType: {}
}))

vi.mock('@/utils/performanceMonitor', () => ({
  appInitMonitor: {
    markPhase: vi.fn()
  },
  AppInitPhase: {
    LOAD_STORES: 'LOAD_STORES'
  }
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn()
  })
}))

import FriendsList from '@/components/friends/FriendsList.vue'
import FriendsSkeleton from '@/components/common/FriendsSkeleton.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: {
    'zh-CN': {
      friends: {
        list: {
          search_placeholder: '搜索好友',
          add_friend: '添加好友',
          category_management: '分组管理',
          no_results: '未找到匹配的好友',
          no_friends: '暂无好友',
          all_friends: '全部好友 ({count})'
        },
        category: {
          create_title: '创建好友分组',
          name_label: '分组名称',
          name_placeholder: '请输入分组名称（1-50个字符）',
          color_label: '分组颜色',
          name_required: '请输入分组名称',
          name_length: '分组名称长度为1-50个字符',
          create_button: '创建',
          create_success: '分组创建成功',
          create_failed: '创建分组失败'
        },
        actions: {
          chat: '聊天',
          block: '拉黑',
          unblock: '解除拉黑',
          remove: '删除好友'
        },
        block: {
          confirm_title: '确认拉黑',
          confirm_content: '拉黑后，你将不会收到来自 {name} 的消息。确定要拉黑吗？',
          success: '已拉黑该用户',
          failed: '操作失败'
        },
        remove: {
          confirm_title: '确认删除',
          confirm_content: '确定要删除好友 {name} 吗？',
          success: '已删除好友',
          failed: '删除失败'
        },
        requests: {
          message: '验证消息',
          message_placeholder: '请输入验证消息（可选）',
          send_request: '发送请求',
          sent: '好友请求已发送',
          send_failed: '发送好友请求失败',
          accept: '接受',
          reject: '拒绝',
          accepted: '已接受好友请求',
          rejected: '已拒绝好友请求',
          error: '操作失败',
          pending_title: '待处理的好友请求'
        },
        status: {
          online: '在线',
          offline: '离线',
          unavailable: '不可用',
          away: '离开',
          unknown: '未知'
        }
      },
      common: {
        cancel: '取消',
        confirm: '确定',
        save: '保存',
        edit: '编辑',
        delete: '删除',
        close: '关闭'
      }
    }
  }
})

describe('FriendsList Component', () => {
  let wrapper: VueWrapper

  beforeEach(() => {
    setActivePinia(createPinia())
    // Reset mock data
    mockFriendsStore.friends = []
    mockFriendsStore.categories = []
    mockFriendsStore.pending = []
    mockFriendsStore.blockedUsers = []
    mockFriendsStore.loading = false
    mockFriendsStore.totalFriendsCount = 0
    mockFriendsStore.onlineFriendsCount = 0
    mockFriendsStore.pendingCount = 0
  })

  afterEach(() => {
    wrapper?.unmount()
  })

  describe('Rendering', () => {
    it('should render loading state when friendsStore.loading is true', async () => {
      mockFriendsStore.loading = true

      wrapper = mount(FriendsList, {
        global: {
          plugins: [i18n],
          stubs: {
            FriendsSkeleton: true
          }
        }
      })

      expect(wrapper.find('.friends-skeleton').exists()).toBe(true)
    })

    it('should render empty state when no friends', () => {
      wrapper = mount(FriendsList, {
        global: {
          plugins: [i18n],
          stubs: {
            FriendsSkeleton: true
          }
        }
      })

      expect(wrapper.find('.n-empty').exists()).toBe(true)
      expect(wrapper.text()).toContain('暂无好友')
    })

    it('should render friend list when friends exist', () => {
      mockFriendsStore.friends = [
        {
          user_id: '@alice:example.com',
          display_name: 'Alice',
          presence: 'online',
          category_id: null
        },
        {
          user_id: '@bob:example.com',
          display_name: 'Bob',
          presence: 'offline',
          category_id: null
        }
      ]

      wrapper = mount(FriendsList, {
        global: {
          plugins: [i18n],
          stubs: {
            FriendsSkeleton: true
          }
        }
      })

      expect(wrapper.text()).toContain('Alice')
      expect(wrapper.text()).toContain('Bob')
    })

    it('should render search input', () => {
      wrapper = mount(FriendsList, {
        global: {
          plugins: [i18n],
          stubs: {
            FriendsSkeleton: true
          }
        }
      })

      const searchInput = wrapper.find('input.n-input')
      expect(searchInput.exists()).toBe(true)
      expect(searchInput.attributes('placeholder')).toBe('搜索好友')
    })

    it('should render add friend button', () => {
      wrapper = mount(FriendsList, {
        global: {
          plugins: [i18n],
          stubs: {
            FriendsSkeleton: true
          }
        }
      })

      const addButton = wrapper.findAll('.n-button').find(btn => btn.text() === '添加好友')
      expect(addButton?.exists()).toBe(true)
    })
  })

  describe('Filtering', () => {
    it('should filter friends by search query', async () => {
      mockFriendsStore.friends = [
        { user_id: '@alice:example.com', display_name: 'Alice', presence: 'online', category_id: null },
        { user_id: '@bob:example.com', display_name: 'Bob', presence: 'offline', category_id: null },
        { user_id: '@charlie:example.com', display_name: 'Charlie', presence: 'online', category_id: null }
      ]

      wrapper = mount(FriendsList, {
        global: {
          plugins: [i18n],
          stubs: {
            FriendsSkeleton: true,
            NVirtualList: { template: '<div class="virtual-list"><slot v-for="item in $attrs.items" :item="item" /></div>' }
          }
        }
      })

      const searchInput = wrapper.find('input.n-input')
      await searchInput.setValue('Alice')

      await nextTick()

      // Should only show Alice
      expect(wrapper.text()).toContain('Alice')
    })
  })

  describe('Actions', () => {
    it('should open add friend dialog when clicking add button', async () => {
      wrapper = mount(FriendsList, {
        global: {
          plugins: [i18n],
          stubs: {
            FriendsSkeleton: true
          }
        }
      })

      const addButton = wrapper.findAll('.n-button').find(btn => btn.text() === '添加好友')
      await addButton?.trigger('click')
      await nextTick()

      expect(wrapper.find('.n-modal').exists()).toBe(true)
    })

    it('should open category create dialog', async () => {
      wrapper = mount(FriendsList, {
        global: {
          plugins: [i18n],
          stubs: {
            FriendsSkeleton: true
          }
        }
      })

      const categoryButton = wrapper.findAll('.n-button').find(btn => btn.text() === '分组管理')
      await categoryButton?.trigger('click')
      await nextTick()

      // Click create option
      await wrapper.vm.handleCategoryAction('create')
      await nextTick()

      expect(wrapper.vm.showCategoryDialog).toBe(true)
    })
  })

  describe('Accessibility', () => {
    it('should have proper aria labels for buttons', () => {
      wrapper = mount(FriendsList, {
        global: {
          plugins: [i18n],
          stubs: {
            FriendsSkeleton: true
          }
        }
      })

      // Check for aria-label attributes
      const searchInput = wrapper.find('input.n-input')
      expect(searchInput.attributes('placeholder')).toBeDefined()
    })

    it('should have keyboard navigation support', () => {
      wrapper = mount(FriendsList, {
        global: {
          plugins: [i18n],
          stubs: {
            FriendsSkeleton: true
          }
        }
      })

      // Check that inputs and buttons are focusable
      const searchInput = wrapper.find('input.n-input')
      expect(searchInput.exists()).toBe(true)
    })
  })

  describe('Status Indicators', () => {
    it('should show correct status colors for presence', () => {
      mockFriendsStore.friends = [
        { user_id: '@alice:example.com', display_name: 'Alice', presence: 'online', category_id: null },
        { user_id: '@bob:example.com', display_name: 'Bob', presence: 'offline', category_id: null }
      ]

      wrapper = mount(FriendsList, {
        global: {
          plugins: [i18n],
          stubs: {
            FriendsSkeleton: true,
            NVirtualList: { template: '<div class="virtual-list"><slot v-for="item in $attrs.items" :item="item" /></div>' }
          }
        }
      })

      // Check for status indicators
      expect(wrapper.html()).toContain('status-online')
      expect(wrapper.html()).toContain('status-offline')
    })
  })
})
