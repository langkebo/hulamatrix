/**
 * Matrix Friends SDK 集成测试
 * 测试完整的 Friends API 流程
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createEnhancedMatrixClient, extendMatrixClient, isFriendsApiEnabled } from '@/sdk/matrix-friends/factory'
import type { EnhancedMatrixClient } from '@/sdk/matrix-friends/factory'

describe('Matrix Friends SDK 集成测试', () => {
  // Mock matrix-js-sdk
  const mockCreateClient = vi.fn()
  const mockMatrixJs = {
    createClient: mockCreateClient
  }

  // Mock 客户端实例
  const mockBaseClient = {
    getAccessToken: vi.fn(() => 'test_access_token'),
    getUserId: vi.fn(() => '@testuser:cjystx.top'),
    getHomeserverUrl: vi.fn(() => 'https://matrix.cjystx.top:443'),
    createRoom: vi.fn(),
    getAccountData: vi.fn(),
    setAccountData: vi.fn(),
    startClient: vi.fn(),
    stopClient: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.doMock('matrix-js-sdk', () => mockMatrixJs)
    mockCreateClient.mockReturnValue(mockBaseClient)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('createEnhancedMatrixClient', () => {
    it('应该成功创建增强客户端', async () => {
      mockCreateClient.mockReturnValue(mockBaseClient)

      const client = await createEnhancedMatrixClient({
        baseUrl: 'https://matrix.cjystx.top:443',
        accessToken: 'test_token',
        userId: '@testuser:cjystx.top'
      })

      expect(client).toBeDefined()
      expect(isFriendsApiEnabled(client)).toBe(true)
      expect(client.friends).toBeDefined()
    })

    it('应该使用自定义 Friends API URL', async () => {
      mockCreateClient.mockReturnValue(mockBaseClient)

      const client = await createEnhancedMatrixClient({
        baseUrl: 'https://matrix.cjystx.top:443',
        accessToken: 'test_token',
        userId: '@testuser:cjystx.top',
        friendsApiBaseUrl: 'https://custom.server:443'
      })

      expect(client).toBeDefined()
      expect(client.friends).toBeDefined()
    })
  })

  describe('extendMatrixClient', () => {
    it('应该成功扩展现有客户端', () => {
      const extendedClient = extendMatrixClient(mockBaseClient as any)

      expect(isFriendsApiEnabled(extendedClient)).toBe(true)
      expect(extendedClient.friends).toBeDefined()
      expect(typeof extendedClient.friends.list).toBe('function')
    })

    it('应该使用自定义 Friends API URL', () => {
      const extendedClient = extendMatrixClient(mockBaseClient as any, 'https://custom.server:443')

      expect(isFriendsApiEnabled(extendedClient)).toBe(true)
    })
  })

  describe('isFriendsApiEnabled', () => {
    it('应该正确检测已扩展的客户端', () => {
      const extendedClient = extendMatrixClient(mockBaseClient as any)
      expect(isFriendsApiEnabled(extendedClient)).toBe(true)
    })

    it('应该正确检测未扩展的客户端', () => {
      // 创建一个新的 mock 客户端（未被扩展）
      const freshMockClient = {
        getAccessToken: vi.fn(() => 'test_access_token'),
        getUserId: vi.fn(() => '@testuser:cjystx.top'),
        getHomeserverUrl: vi.fn(() => 'https://matrix.cjystx.top:443')
      }
      expect(isFriendsApiEnabled(freshMockClient as any)).toBe(false)
    })
  })

  describe('Friends API 完整流程', () => {
    let client: EnhancedMatrixClient

    beforeEach(async () => {
      mockCreateClient.mockReturnValue(mockBaseClient)
      client = await createEnhancedMatrixClient({
        baseUrl: 'https://matrix.cjystx.top:443',
        accessToken: 'test_token',
        userId: '@testuser:cjystx.top'
      })

      // Mock fetch responses
      ;(global.fetch as any) = vi.fn()
    })

    it('应该完成完整的添加好友流程', async () => {
      // 1. 搜索用户
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ok',
          users: [{ user_id: '@friend:cjystx.top', display_name: 'Friend' }]
        }),
        text: async () =>
          JSON.stringify({
            status: 'ok',
            users: [{ user_id: '@friend:cjystx.top', display_name: 'Friend' }]
          })
      })

      const searchResult = await client.friends.searchFriends('friend')
      expect(searchResult.users).toHaveLength(1)
      expect(searchResult.users[0].user_id).toBe('@friend:cjystx.top')

      // 2. 发送好友请求
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ok',
          request_id: 'req-123'
        }),
        text: async () =>
          JSON.stringify({
            status: 'ok',
            request_id: 'req-123'
          })
      })

      const sendResult = await client.friends.sendRequest('@friend:cjystx.top', {
        message: '添加好友'
      })
      expect(sendResult.request_id).toBe('req-123')

      // 3. 获取待处理请求
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ok',
          requests: [
            {
              id: 'req-123',
              requester_id: '@testuser:cjystx.top',
              message: '添加好友',
              created_at: '2026-01-06T00:00:00Z'
            }
          ]
        }),
        text: async () =>
          JSON.stringify({
            status: 'ok',
            requests: [
              {
                id: 'req-123',
                requester_id: '@testuser:cjystx.top',
                message: '添加好友',
                created_at: '2026-01-06T00:00:00Z'
              }
            ]
          })
      })

      const pendingResult = await client.friends.listPendingRequests()
      expect(pendingResult.requests).toHaveLength(1)

      // 4. 接受好友请求
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ok',
          requester_id: '@testuser:cjystx.top',
          dm_room_id: '!dmroom:cjystx.top'
        }),
        text: async () =>
          JSON.stringify({
            status: 'ok',
            requester_id: '@testuser:cjystx.top',
            dm_room_id: '!dmroom:cjystx.top'
          })
      })

      const acceptResult = await client.friends.acceptRequest('req-123')
      expect(acceptResult.dm_room_id).toBe('!dmroom:cjystx.top')

      // 5. 获取好友列表
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ok',
          friends: [
            {
              friend_id: '@friend:cjystx.top',
              remark: 'Friend',
              status: 'accepted',
              created_at: '2026-01-06T00:00:00Z',
              category_id: 'default'
            }
          ]
        }),
        text: async () =>
          JSON.stringify({
            status: 'ok',
            friends: [
              {
                friend_id: '@friend:cjystx.top',
                remark: 'Friend',
                status: 'accepted',
                created_at: '2026-01-06T00:00:00Z',
                category_id: 'default'
              }
            ]
          })
      })

      const listResult = await client.friends.list()
      expect(listResult.friends).toHaveLength(1)
      expect(listResult.friends[0].friend_id).toBe('@friend:cjystx.top')

      // 6. 获取统计信息
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ok',
          stats: {
            total_friends: 1,
            pending_requests: 0,
            blocked_count: 0
          }
        }),
        text: async () =>
          JSON.stringify({
            status: 'ok',
            stats: {
              total_friends: 1,
              pending_requests: 0,
              blocked_count: 0
            }
          })
      })

      const statsResult = await client.friends.getStats()
      expect(statsResult.stats.total_friends).toBe(1)
    })

    it('应该完成分组管理流程', async () => {
      // 1. 创建分组
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ok',
          category_id: 'cat-123'
        }),
        text: async () =>
          JSON.stringify({
            status: 'ok',
            category_id: 'cat-123'
          })
      })

      const createResult = await client.friends.createCategory('工作')
      expect(createResult.category_id).toBe('cat-123')

      // 2. 获取分组列表
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ok',
          categories: [
            {
              id: 'cat-123',
              name: '工作',
              created_at: '2026-01-06T00:00:00Z'
            }
          ]
        }),
        text: async () =>
          JSON.stringify({
            status: 'ok',
            categories: [
              {
                id: 'cat-123',
                name: '工作',
                created_at: '2026-01-06T00:00:00Z'
              }
            ]
          })
      })

      const listResult = await client.friends.listCategories()
      expect(listResult.categories).toHaveLength(1)
      expect(listResult.categories[0].name).toBe('工作')

      // 3. 删除分组
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ok'
        }),
        text: async () =>
          JSON.stringify({
            status: 'ok'
          })
      })

      const deleteResult = await client.friends.deleteCategory('cat-123')
      expect(deleteResult.status).toBe('ok')
    })

    it('应该完成备注管理流程', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'ok'
        }),
        text: async () =>
          JSON.stringify({
            status: 'ok'
          })
      })

      const result = await client.friends.setRemark('@friend:cjystx.top', '新备注')
      expect(result.status).toBe('ok')
    })

    it('应该完成黑名单管理流程', async () => {
      // 拉黑
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ok'
        }),
        text: async () =>
          JSON.stringify({
            status: 'ok'
          })
      })

      const blockResult = await client.friends.blockUser('@friend:cjystx.top')
      expect(blockResult.status).toBe('ok')

      // 取消拉黑
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ok'
        }),
        text: async () =>
          JSON.stringify({
            status: 'ok'
          })
      })

      const unblockResult = await client.friends.unblockUser('@friend:cjystx.top')
      expect(unblockResult.status).toBe('ok')
    })
  })

  describe('错误处理集成测试', () => {
    let client: EnhancedMatrixClient

    beforeEach(async () => {
      mockCreateClient.mockReturnValue(mockBaseClient)
      client = await createEnhancedMatrixClient({
        baseUrl: 'https://matrix.cjystx.top:443',
        accessToken: 'test_token',
        userId: '@testuser:cjystx.top'
      })

      ;(global.fetch as any) = vi.fn()
    })

    it('应该正确处理认证错误', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: false,
        status: 401,
        text: async () =>
          JSON.stringify({
            errcode: 'M_MISSING_TOKEN',
            error: 'Missing access token'
          })
      })

      await expect(client.friends.list()).rejects.toThrow()
    })

    it('应该正确处理网络错误', async () => {
      ;(global.fetch as any).mockRejectedValue(new Error('Network error'))

      await expect(client.friends.list()).rejects.toThrow('Network Error')
    })
  })
})
