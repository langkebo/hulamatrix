/**
 * SDK v2.0 实现验证测试
 *
 * 验证 v2.0 Store 和服务的基本功能
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { friendsServiceV2, privateChatServiceV2 } from '@/services/index-v2'
import { useFriendsStoreV2, usePrivateChatStoreV2 } from '@/stores/index-v2'

// Mock Matrix Client
const mockMatrixClient = {
  friendsV2: {
    listFriends: vi.fn(),
    sendFriendRequest: vi.fn(),
    acceptFriendRequest: vi.fn(),
    rejectFriendRequest: vi.fn(),
    removeFriend: vi.fn(),
    searchUsers: vi.fn(),
    getCategories: vi.fn(),
    getPendingRequests: vi.fn()
  },
  privateChatV2: {
    listSessions: vi.fn(),
    createSession: vi.fn(),
    deleteSession: vi.fn(),
    sendText: vi.fn(),
    getMessages: vi.fn(),
    subscribeToMessages: vi.fn()
  },
  on: vi.fn()
}

// Mock matrixClientService
vi.mock('@/services/matrixClientService', () => ({
  matrixClientService: {
    getClient: vi.fn(() => mockMatrixClient)
  }
}))

describe('SDK v2.0 - Type Validation', () => {
  it('should export all required types', () => {
    // 验证类型导出
    expect(typeof friendsServiceV2).toBe('object')
    expect(typeof privateChatServiceV2).toBe('object')
    expect(typeof useFriendsStoreV2).toBe('function')
    expect(typeof usePrivateChatStoreV2).toBe('function')
  })

  it('should have correct service methods', () => {
    // 验证服务方法存在
    expect(typeof friendsServiceV2.initialize).toBe('function')
    expect(typeof friendsServiceV2.listFriends).toBe('function')
    expect(typeof friendsServiceV2.sendFriendRequest).toBe('function')
    expect(typeof friendsServiceV2.acceptFriendRequest).toBe('function')
    expect(typeof friendsServiceV2.rejectFriendRequest).toBe('function')

    expect(typeof privateChatServiceV2.initialize).toBe('function')
    expect(typeof privateChatServiceV2.listSessions).toBe('function')
    expect(typeof privateChatServiceV2.createSession).toBe('function')
    expect(typeof privateChatServiceV2.sendText).toBe('function')
  })
})

describe('SDK v2.0 - Friends Store', () => {
  let friendsStore: ReturnType<typeof useFriendsStoreV2>

  beforeEach(() => {
    setActivePinia(createPinia())
    friendsStore = useFriendsStoreV2()
  })

  it('should initialize with correct state', () => {
    expect(friendsStore.loading).toBe(false)
    expect(friendsStore.error).toBe('')
    expect(friendsStore.friends).toEqual([])
    expect(friendsStore.categories).toEqual([])
    expect(friendsStore.pending).toEqual([])
    expect(friendsStore.initialized).toBe(false)
  })

  it('should have correct computed properties', () => {
    expect(friendsStore.totalFriendsCount).toBe(0)
    expect(friendsStore.onlineFriendsCount).toBe(0)
    expect(friendsStore.pendingCount).toBe(0)
    expect(friendsStore.isLoaded).toBe(false)
  })

  it('should have all required methods', () => {
    expect(typeof friendsStore.initialize).toBe('function')
    expect(typeof friendsStore.refreshAll).toBe('function')
    expect(typeof friendsStore.sendRequest).toBe('function')
    expect(typeof friendsStore.acceptRequest).toBe('function')
    expect(typeof friendsStore.rejectRequest).toBe('function')
    expect(typeof friendsStore.removeFriend).toBe('function')
    expect(typeof friendsStore.searchUsers).toBe('function')
    expect(typeof friendsStore.invalidateCache).toBe('function')
  })
})

describe('SDK v2.0 - Private Chat Store', () => {
  let privateChatStore: ReturnType<typeof usePrivateChatStoreV2>

  beforeEach(() => {
    setActivePinia(createPinia())
    privateChatStore = usePrivateChatStoreV2()
  })

  it('should initialize with correct state', () => {
    expect(privateChatStore.loading).toBe(false)
    expect(privateChatStore.error).toBe('')
    expect(privateChatStore.sessions).toEqual([])
    expect(privateChatStore.currentSessionId).toBe(null)
    expect(privateChatStore.initialized).toBe(false)
  })

  it('should have correct computed properties', () => {
    expect(privateChatStore.currentSession).toBe(null)
    expect(privateChatStore.currentMessages).toEqual([])
    expect(privateChatStore.currentUnreadCount).toBe(0)
    expect(privateChatStore.totalSessionsCount).toBe(0)
    expect(privateChatStore.isLoaded).toBe(false)
  })

  it('should have all required methods', () => {
    expect(typeof privateChatStore.initialize).toBe('function')
    expect(typeof privateChatStore.refreshSessions).toBe('function')
    expect(typeof privateChatStore.createSession).toBe('function')
    expect(typeof privateChatStore.deleteSession).toBe('function')
    expect(typeof privateChatStore.selectSession).toBe('function')
    expect(typeof privateChatStore.deselectSession).toBe('function')
    expect(typeof privateChatStore.loadMessages).toBe('function')
    expect(typeof privateChatStore.sendMessage).toBe('function')
    expect(typeof privateChatStore.invalidateCache).toBe('function')
    expect(typeof privateChatStore.dispose).toBe('function')
  })
})

describe('SDK v2.0 - Adapter Compatibility', () => {
  it('should export v2 adapters', async () => {
    const { matrixFriendAdapterV2 } = await import('@/adapters/matrix-friends-adapter-v2')
    const { matrixPrivateChatAdapterV2 } = await import('@/adapters/matrix-private-chat-adapter-v2')

    expect(typeof matrixFriendAdapterV2).toBe('object')
    expect(typeof matrixPrivateChatAdapterV2).toBe('object')
  })

  it('should have adapter methods', async () => {
    const { matrixFriendAdapterV2 } = await import('@/adapters/matrix-friends-adapter-v2')
    const { matrixPrivateChatAdapterV2 } = await import('@/adapters/matrix-private-chat-adapter-v2')

    expect(typeof matrixFriendAdapterV2.listFriends).toBe('function')
    expect(typeof matrixFriendAdapterV2.sendFriendRequest).toBe('function')
    expect(typeof matrixFriendAdapterV2.acceptFriendRequest).toBe('function')
    expect(typeof matrixFriendAdapterV2.rejectFriendRequest).toBe('function')

    expect(typeof matrixPrivateChatAdapterV2.listSessions).toBe('function')
    expect(typeof matrixPrivateChatAdapterV2.createSession).toBe('function')
    expect(typeof matrixPrivateChatAdapterV2.sendMessage).toBe('function')
    expect(typeof matrixPrivateChatAdapterV2.getMessages).toBe('function')
  })
})

describe('SDK v2.0 - Documentation', () => {
  it('should have usage documentation', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')

    const docsDir = path.resolve(process.cwd(), 'docs')
    const usageDoc = path.join(docsDir, 'MATRIX_SDK_V2_USAGE.md')
    const migrationDoc = path.join(docsDir, 'COMPONENT_MIGRATION_GUIDE.md')
    const summaryDoc = path.join(docsDir, 'MATRIX_SDK_V2_IMPLEMENTATION_SUMMARY.md')

    expect(fs.existsSync(usageDoc)).toBe(true)
    expect(fs.existsSync(migrationDoc)).toBe(true)
    expect(fs.existsSync(summaryDoc)).toBe(true)
  })

  it('should have example component', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')

    const exampleComponent = path.resolve(process.cwd(), 'src/components/examples/MatrixSDKV2Example.vue')

    expect(fs.existsSync(exampleComponent)).toBe(true)
  })
})
