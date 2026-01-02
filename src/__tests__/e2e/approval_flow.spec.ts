import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock requestWithFallback
const mockRequestWithFallback = vi.fn()

vi.mock('@/utils/MatrixApiBridgeAdapter', () => ({
  requestWithFallback: mockRequestWithFallback
}))

// Mock matrixAuth store
vi.mock('@/stores/matrixAuth', () => ({
  useMatrixAuthStore: () => ({
    userId: '@me:example.org',
    accessToken: 'mock-token'
  })
}))

describe('group approval flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock response
    mockRequestWithFallback.mockResolvedValue({
      list: [
        {
          applyId: 'a1',
          senderId: 'u1',
          receiverId: 'me',
          type: 'group',
          eventType: 'invite',
          roomId: '!r',
          content: '邀请',
          status: 0,
          createTime: Date.now()
        }
      ]
    })
  })

  it('accept and refresh pending', async () => {
    const { createPinia, setActivePinia } = await import('pinia')
    setActivePinia(createPinia())

    const { useFriendsStore } = await import('@/stores/friends')
    const store = useFriendsStore()

    // Mock refreshGroupPending
    await store.refreshGroupPending()
    expect(mockRequestWithFallback).toHaveBeenCalledWith({
      url: 'get_notices',
      params: { pageNo: 1, pageSize: 50, click: false, applyType: 'group', cursor: '' }
    })
    expect(store.pendingGroups.length).toBeGreaterThan(0)

    // Mock acceptGroupInvite
    mockRequestWithFallback.mockResolvedValueOnce({})

    await store.acceptGroupInvite('a1')
    expect(mockRequestWithFallback).toHaveBeenCalledWith({
      url: 'handle_notice',
      body: { applyId: 'a1', state: 1 } // ACCEPTED
    })

    // Verify error is not set
    expect(store.error).toBe('')
  })

  it('reject and refresh pending', async () => {
    const { createPinia, setActivePinia } = await import('pinia')
    setActivePinia(createPinia())

    const { useFriendsStore } = await import('@/stores/friends')
    const store = useFriendsStore()

    // Mock refreshGroupPending
    await store.refreshGroupPending()
    expect(store.pendingGroups.length).toBeGreaterThan(0)

    // Mock rejectGroupInvite
    mockRequestWithFallback.mockResolvedValueOnce({})

    await store.rejectGroupInvite('a1')
    expect(mockRequestWithFallback).toHaveBeenCalledWith({
      url: 'handle_notice',
      body: { applyId: 'a1', state: 2 } // REJECTED
    })

    // Verify error is not set
    expect(store.error).toBe('')
  })

  it('should handle refresh errors', async () => {
    const { createPinia, setActivePinia } = await import('pinia')
    setActivePinia(createPinia())

    const { useFriendsStore } = await import('@/stores/friends')
    const store = useFriendsStore()

    // Mock error response - use error without message to test fallback
    mockRequestWithFallback.mockRejectedValueOnce(new Error())

    await store.refreshGroupPending()

    expect(store.error).toBe('加载群通知失败')
    expect(store.pendingGroups.length).toBe(0)
  })

  it('should handle accept errors', async () => {
    const { createPinia, setActivePinia } = await import('pinia')
    setActivePinia(createPinia())

    const { useFriendsStore } = await import('@/stores/friends')
    const store = useFriendsStore()

    // Mock error on accept - use error without message to test fallback
    const acceptError = new Error()
    mockRequestWithFallback.mockRejectedValueOnce(acceptError)

    await expect(store.acceptGroupInvite('a1')).rejects.toThrow(acceptError)
    expect(store.error).toBe('接受群邀请失败')
  })

  it('should handle reject errors', async () => {
    const { createPinia, setActivePinia } = await import('pinia')
    setActivePinia(createPinia())

    const { useFriendsStore } = await import('@/stores/friends')
    const store = useFriendsStore()

    // Mock error on reject - use error without message to test fallback
    const rejectError = new Error()
    mockRequestWithFallback.mockRejectedValueOnce(rejectError)

    await expect(store.rejectGroupInvite('a1')).rejects.toThrow(rejectError)
    expect(store.error).toBe('拒绝群邀请失败')
  })

  it('should handle empty pending list', async () => {
    const { createPinia, setActivePinia } = await import('pinia')
    setActivePinia(createPinia())

    const { useFriendsStore } = await import('@/stores/friends')
    const store = useFriendsStore()

    // Mock empty response
    mockRequestWithFallback.mockResolvedValueOnce({
      list: []
    })

    await store.refreshGroupPending()

    expect(store.pendingGroups.length).toBe(0)
    expect(store.error).toBe('')
  })
})
