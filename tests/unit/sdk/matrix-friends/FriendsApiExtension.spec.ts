/**
 * Matrix Friends API Extension 单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MatrixFriendsApiExtension } from '@/sdk/matrix-friends/FriendsApiExtension'
import { FriendsApiError } from '@/sdk/matrix-friends/types'

// Mock fetch
global.fetch = vi.fn()

describe('MatrixFriendsApiExtension', () => {
  const mockClient = {
    getAccessToken: vi.fn(() => 'test_token'),
    getUserId: vi.fn(() => '@test:server'),
    getHomeserverUrl: vi.fn(() => 'https://matrix.server:443'),
    createRoom: vi.fn(),
    getAccountData: vi.fn(),
    setAccountData: vi.fn()
  }

  let extension: MatrixFriendsApiExtension

  beforeEach(() => {
    vi.clearAllMocks()
    extension = new MatrixFriendsApiExtension(mockClient as any, 'https://matrix.server:443')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('查询类 API', () => {
    it('应该成功获取好友列表', async () => {
      const mockResponse = {
        status: 'ok',
        friends: [
          {
            friend_id: '@friend1:server',
            remark: 'Friend 1',
            status: 'accepted',
            created_at: '2026-01-06T00:00:00Z',
            category_id: 'default'
          }
        ]
      }

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse)
      })

      const result = await extension.list()

      expect(result.friends).toHaveLength(1)
      expect(result.friends[0].friend_id).toBe('@friend1:server')
      expect(global.fetch).toHaveBeenCalledWith(
        'https://matrix.server:443/_synapse/client/enhanced/friends/v2/list?user_id=%40test%3Aserver',
        {
          method: 'GET',
          headers: {
            Authorization: 'Bearer test_token',
            'Content-Type': 'application/json'
          }
        }
      )
    })

    it('应该成功获取分组列表', async () => {
      const mockResponse = {
        status: 'ok',
        categories: [
          {
            id: 'default',
            name: '默认分组',
            created_at: '2026-01-06T00:00:00Z'
          }
        ]
      }

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse)
      })

      const result = await extension.listCategories()

      expect(result.categories).toHaveLength(1)
      expect(result.categories[0].name).toBe('默认分组')
    })

    it('应该成功获取统计信息', async () => {
      const mockResponse = {
        status: 'ok',
        stats: {
          total_friends: 10,
          pending_requests: 2,
          blocked_count: 1
        }
      }

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse)
      })

      const result = await extension.getStats()

      expect(result.stats.total_friends).toBe(10)
      expect(result.stats.pending_requests).toBe(2)
    })

    it('应该成功获取待处理请求', async () => {
      const mockResponse = {
        status: 'ok',
        requests: [
          {
            id: 'req-1',
            requester_id: '@user1:server',
            message: '添加好友',
            created_at: '2026-01-06T00:00:00Z'
          }
        ]
      }

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse)
      })

      const result = await extension.listPendingRequests()

      expect(result.requests).toHaveLength(1)
      expect(result.requests[0].requester_id).toBe('@user1:server')
    })

    it('应该成功搜索好友', async () => {
      const mockResponse = {
        status: 'ok',
        users: [
          {
            user_id: '@search1:server',
            display_name: 'Search User 1'
          }
        ]
      }

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse)
      })

      const result = await extension.searchFriends('search')

      expect(result.users).toHaveLength(1)
      expect(result.users[0].display_name).toBe('Search User 1')
    })
  })

  describe('操作类 API', () => {
    it('应该成功发送好友请求', async () => {
      const mockResponse = {
        status: 'ok',
        request_id: 'req-123'
      }

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse)
      })

      const result = await extension.sendRequest('@target:server', {
        message: '添加好友'
      })

      expect(result.request_id).toBe('req-123')
      expect(global.fetch).toHaveBeenCalledWith(
        'https://matrix.server:443/_synapse/client/enhanced/friends/v2/request',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            target_id: '@target:server',
            message: '添加好友'
          })
        })
      )
    })

    it('应该成功接受好友请求', async () => {
      const mockResponse = {
        status: 'ok',
        requester_id: '@requester:server',
        dm_room_id: '!room:server'
      }

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse)
      })

      const result = await extension.acceptRequest('req-123')

      expect(result.dm_room_id).toBe('!room:server')
    })

    it('接受请求时应该自动创建 DM 房间（如果后端没有返回）', async () => {
      const mockResponse = {
        status: 'ok',
        requester_id: '@requester:server'
      }

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse)
      })

      // Mock createRoom
      mockClient.createRoom.mockResolvedValue({
        room_id: '!created-room:server'
      })

      // Mock getAccountData 返回空
      mockClient.getAccountData.mockResolvedValue({})

      const result = await extension.acceptRequest('req-123')

      expect(result.dm_room_id).toBe('!created-room:server')
      expect(result.dm_note).toBe('DM room created by client')
    })

    it('应该成功拒绝好友请求', async () => {
      const mockResponse = {
        status: 'ok'
      }

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse)
      })

      const result = await extension.rejectRequest('req-123')

      expect(result.status).toBe('ok')
    })

    it('应该成功删除好友', async () => {
      const mockResponse = {
        status: 'ok'
      }

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse)
      })

      const result = await extension.removeFriend('@friend:server')

      expect(result.status).toBe('ok')
    })
  })

  describe('分组管理', () => {
    it('应该成功创建分组', async () => {
      const mockResponse = {
        status: 'ok',
        category_id: 'cat-123'
      }

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse)
      })

      const result = await extension.createCategory('新分组')

      expect(result.category_id).toBe('cat-123')
    })

    it('应该成功删除分组', async () => {
      const mockResponse = {
        status: 'ok'
      }

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse)
      })

      const result = await extension.deleteCategory('cat-123')

      expect(result.status).toBe('ok')
    })
  })

  describe('备注管理', () => {
    it('应该成功设置备注', async () => {
      const mockResponse = {
        status: 'ok'
      }

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse)
      })

      const result = await extension.setRemark('@friend:server', '新备注')

      expect(result.status).toBe('ok')
    })
  })

  describe('黑名单管理', () => {
    it('应该成功拉黑用户', async () => {
      const mockResponse = {
        status: 'ok'
      }

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse)
      })

      const result = await extension.blockUser('@user:server')

      expect(result.status).toBe('ok')
    })

    it('应该成功取消拉黑', async () => {
      const mockResponse = {
        status: 'ok'
      }

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse)
      })

      const result = await extension.unblockUser('@user:server')

      expect(result.status).toBe('ok')
    })
  })

  describe('错误处理', () => {
    it('应该正确处理 401 错误', async () => {
      const errorResponse = {
        errcode: 'M_MISSING_TOKEN',
        error: 'Missing access token'
      }

      ;(global.fetch as any).mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => JSON.stringify(errorResponse)
      })

      await expect(extension.list()).rejects.toThrow(FriendsApiError)
    })

    it('应该正确处理 404 错误', async () => {
      const errorResponse = {
        errcode: 'M_NOT_FOUND',
        error: 'Resource not found'
      }

      ;(global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => JSON.stringify(errorResponse)
      })

      await expect(extension.list()).rejects.toThrow(FriendsApiError)
    })

    it('应该正确处理网络错误', async () => {
      ;(global.fetch as any).mockRejectedValue(new Error('Network error'))

      await expect(extension.list()).rejects.toThrow('Network Error')
    })

    it('应该在 token 缺失时抛出错误', async () => {
      mockClient.getAccessToken.mockReturnValue('')

      await expect(extension.list()).rejects.toThrow(FriendsApiError)
    })
  })

  describe('辅助方法', () => {
    it('应该正确获取基础 URL', () => {
      const customUrlExtension = new MatrixFriendsApiExtension(mockClient as any, 'https://custom.server:443')

      expect(customUrlExtension['getBaseUrl']()).toBe('https://custom.server:443')
    })

    it('应该回退到 homeserver URL', () => {
      const defaultUrlExtension = new MatrixFriendsApiExtension(mockClient as any, '')

      expect(defaultUrlExtension['getBaseUrl']()).toBe('https://matrix.server:443')
    })
  })
})
