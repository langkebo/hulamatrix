/**
 * PrivateChat SDK 集成测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PrivateChatExtension } from '@/sdk/matrix-private-chat/PrivateChatExtension.js'
import { extendMatrixClient, isPrivateChatApiEnabled, getPrivateChatApi } from '@/sdk/matrix-private-chat/factory.js'
import type { MatrixClientLike, PrivateChatSession } from '@/sdk/matrix-private-chat/types.js'

// Mock fetch
global.fetch = vi.fn()

// Helper function to generate valid UUID-like session IDs
function generateSessionId(suffix: string): string {
  // Generate a valid UUID format for testing
  const hash = suffix.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return `00000000-0000-4000-8000-${hash.toString(16).padStart(12, '0')}`
}

describe('PrivateChat SDK 集成测试', () => {
  let mockClient: MatrixClientLike

  beforeEach(() => {
    mockClient = {
      getAccessToken: () => 'test-token',
      getUserId: () => '@test:server.com',
      getHomeserverUrl: () => 'https://matrix.cjystx.top'
    }

    vi.mocked(fetch).mockReset()
  })

  describe('工厂函数测试', () => {
    it('应该成功扩展现有客户端', () => {
      extendMatrixClient(mockClient)

      expect(isPrivateChatApiEnabled(mockClient)).toBe(true)
      expect((mockClient as any).privateChatV2).toBeInstanceOf(PrivateChatExtension)
    })

    it('应该检测已扩展的客户端', () => {
      extendMatrixClient(mockClient)

      // 第二次扩展应该被忽略
      extendMatrixClient(mockClient)

      expect(isPrivateChatApiEnabled(mockClient)).toBe(true)
    })

    it('应该获取 PrivateChat API 实例', () => {
      extendMatrixClient(mockClient)

      const api = getPrivateChatApi(mockClient)

      expect(api).toBeInstanceOf(PrivateChatExtension)
    })

    it('未扩展时获取 API 应该抛出错误', () => {
      expect(() => getPrivateChatApi(mockClient)).toThrow()
    })

    it('缺少 base URL 时应该抛出错误', () => {
      const clientWithoutUrl = {
        getAccessToken: () => 'token',
        getUserId: () => '@user:server.com'
      } as MatrixClientLike

      expect(() => extendMatrixClient(clientWithoutUrl)).toThrow()
    })
  })

  describe('完整流程测试', () => {
    it('应该完成完整的会话创建流程', async () => {
      // 1. 扩展客户端
      extendMatrixClient(mockClient)
      const api = getPrivateChatApi(mockClient)

      // 2. 创建会话
      const testSessionId = generateSessionId('test-session')
      const mockSession: PrivateChatSession = {
        session_id: testSessionId,
        session_name: 'Test Chat',
        creator_id: '@test:server.com',
        participants: ['@alice:server.com', '@bob:server.com'],
        created_at: '2024-01-01T00:00:00Z'
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ok',
          session_id: testSessionId,
          session: mockSession
        }),
        text: async () =>
          JSON.stringify({
            status: 'ok',
            session_id: testSessionId,
            session: mockSession
          })
      } as Response)

      const createResponse = await api.createSession({
        participants: ['@alice:server.com', '@bob:server.com'],
        session_name: 'Test Chat'
      })

      expect(createResponse.session_id).toBe(testSessionId)
      expect(createResponse.session).toEqual(mockSession)

      // 3. 验证会话已缓存
      expect(api.hasSession(testSessionId)).toBe(true)
      expect(api.getSession(testSessionId)).toEqual(mockSession)
    })

    it('应该完成完整的消息发送流程', async () => {
      extendMatrixClient(mockClient)
      const api = getPrivateChatApi(mockClient)

      const sessionId = generateSessionId('session-1')

      // 发送消息
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ok',
          message_id: 'msg-123'
        }),
        text: async () => JSON.stringify({ status: 'ok', message_id: 'msg-123' })
      } as Response)

      const messageId = await api.sendText(sessionId, 'Hello, World!')

      expect(messageId).toBe('msg-123')
    })

    it('应该完成完整的消息订阅流程', async () => {
      extendMatrixClient(mockClient)
      const api = getPrivateChatApi(mockClient)

      const sessionId = generateSessionId('session-2')
      const handler = vi.fn()

      // 订阅消息
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'ok',
          messages: [
            {
              message_id: 'msg-1',
              session_id: sessionId,
              sender_id: '@other:server.com',
              content: 'New message',
              type: 'text',
              created_at: '2024-01-01T00:00:00Z'
            }
          ]
        }),
        text: async () =>
          JSON.stringify({
            status: 'ok',
            messages: [
              {
                message_id: 'msg-1',
                session_id: sessionId,
                sender_id: '@other:server.com',
                content: 'New message',
                type: 'text',
                created_at: '2024-01-01T00:00:00Z'
              }
            ]
          })
      } as Response)

      const unsubscribe = api.subscribeToMessages(sessionId, handler)

      // 等待轮询
      await new Promise((resolve) => setTimeout(resolve, 3100))

      expect(handler).toHaveBeenCalled()

      // 取消订阅
      unsubscribe()
    })

    it('应该完成会话删除流程', async () => {
      extendMatrixClient(mockClient)
      const api = getPrivateChatApi(mockClient)

      const toDeleteSessionId = generateSessionId('to-delete')

      // 先创建会话
      const mockSession: PrivateChatSession = {
        session_id: toDeleteSessionId,
        creator_id: '@test:server.com',
        participants: ['@user:server.com'],
        created_at: '2024-01-01T00:00:00Z'
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ok',
          session_id: toDeleteSessionId,
          session: mockSession
        }),
        text: async () =>
          JSON.stringify({
            status: 'ok',
            session_id: toDeleteSessionId,
            session: mockSession
          })
      } as Response)

      await api.createSession({
        participants: ['@user:server.com']
      })

      // 删除会话
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ok' }),
        text: async () => JSON.stringify({ status: 'ok' })
      } as Response)

      await api.deleteSession(toDeleteSessionId)

      // 验证会话已删除
      expect(api.hasSession(toDeleteSessionId)).toBe(false)
    })

    it('应该处理缓存刷新', async () => {
      extendMatrixClient(mockClient)
      const api = getPrivateChatApi(mockClient)

      const sessionId1 = generateSessionId('session-list-1')

      // 第一次获取
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ok',
          sessions: [
            {
              session_id: sessionId1,
              creator_id: '@test:server.com',
              participants: ['@user:server.com'],
              created_at: '2024-01-01T00:00:00Z'
            }
          ]
        }),
        text: async () =>
          JSON.stringify({
            status: 'ok',
            sessions: [
              {
                session_id: sessionId1,
                creator_id: '@test:server.com',
                participants: ['@user:server.com'],
                created_at: '2024-01-01T00:00:00Z'
              }
            ]
          })
      } as Response)

      const response1 = await api.listSessions()
      expect(response1.sessions).toHaveLength(1)

      // 第二次获取应该使用缓存
      const response2 = await api.listSessions()
      expect(response2.sessions).toHaveLength(1)
      expect(fetch).toHaveBeenCalledTimes(1)

      // 清除缓存后再获取
      api.invalidateCache()

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ok',
          sessions: []
        }),
        text: async () => JSON.stringify({ status: 'ok', sessions: [] })
      } as Response)

      const response3 = await api.listSessions()
      expect(response3.sessions).toHaveLength(0)
    })

    it('应该处理错误恢复', async () => {
      extendMatrixClient(mockClient)
      const api = getPrivateChatApi(mockClient)

      // 第一次请求失败
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      await expect(api.listSessions()).rejects.toThrow()

      // 第二次请求成功
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ok',
          sessions: []
        }),
        text: async () => JSON.stringify({ status: 'ok', sessions: [] })
      } as Response)

      const response = await api.listSessions()
      expect(response.status).toBe('ok')
    })
  })

  describe('边界条件测试', () => {
    it('应该处理空参与者列表', async () => {
      extendMatrixClient(mockClient)
      const api = getPrivateChatApi(mockClient)

      await expect(
        api.createSession({
          participants: []
        })
      ).rejects.toThrow()
    })

    it('应该处理过期会话', async () => {
      extendMatrixClient(mockClient)
      const api = getPrivateChatApi(mockClient)

      // 创建一个已过期的会话
      const pastDate = new Date(Date.now() - 10000).toISOString()
      const expiredSessionId = generateSessionId('expired')

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ok',
          sessions: [
            {
              session_id: expiredSessionId,
              creator_id: '@test:server.com',
              participants: ['@user:server.com'],
              created_at: '2024-01-01T00:00:00Z',
              expires_at: pastDate // 已过期
            }
          ]
        }),
        text: async () =>
          JSON.stringify({
            status: 'ok',
            sessions: [
              {
                session_id: expiredSessionId,
                creator_id: '@test:server.com',
                participants: ['@user:server.com'],
                created_at: '2024-01-01T00:00:00Z',
                expires_at: pastDate
              }
            ]
          })
      } as Response)

      await api.listSessions()

      // 过期的会话不应该在缓存中
      expect(api.hasSession(expiredSessionId)).toBe(false)
    })

    it('应该处理并发操作', async () => {
      extendMatrixClient(mockClient)
      const api = getPrivateChatApi(mockClient)

      // 并发创建多个会话
      let callCount = 0
      vi.mocked(fetch).mockImplementation(async () => {
        const sessionId = generateSessionId(`concurrent-${callCount++}`)
        return {
          ok: true,
          json: async () => ({
            status: 'ok',
            session_id: sessionId,
            session: {
              session_id: sessionId,
              creator_id: '@test:server.com',
              participants: ['@user:server.com'],
              created_at: '2024-01-01T00:00:00Z'
            }
          }),
          text: async () =>
            JSON.stringify({
              status: 'ok',
              session_id: sessionId,
              session: {
                session_id: sessionId,
                creator_id: '@test:server.com',
                participants: ['@user:server.com'],
                created_at: '2024-01-01T00:00:00Z'
              }
            })
        } as Response
      })

      const promises = Array.from({ length: 5 }, () =>
        api.createSession({
          participants: ['@user:server.com']
        })
      )

      const results = await Promise.all(promises)

      expect(results).toHaveLength(5)
      results.forEach((result) => {
        expect(result.status).toBe('ok')
        expect(result.session_id).toBeDefined()
      })
    })

    it('应该正确清理资源', () => {
      extendMatrixClient(mockClient)
      const api = getPrivateChatApi(mockClient)

      // 创建一些轮询
      const session1 = generateSessionId('cleanup-1')
      const session2 = generateSessionId('cleanup-2')
      api.subscribeToMessages(session1, () => {})
      api.subscribeToMessages(session2, () => {})

      // 清理
      api.dispose()

      // 验证资源已清理
      expect(api.hasSession(session1)).toBe(false)
      expect(api.hasSession(session2)).toBe(false)
    })

    it('应该处理无效的用户ID格式', async () => {
      extendMatrixClient(mockClient)
      const api = getPrivateChatApi(mockClient)

      await expect(
        api.createSession({
          participants: ['invalid-format'] // 缺少 @ 和 :server
        })
      ).rejects.toThrow()
    })

    it('应该处理超过最大参与者数量', async () => {
      extendMatrixClient(mockClient)
      const api = getPrivateChatApi(mockClient)

      // 创建11个参与者（超过最大10个）
      const participants = Array.from({ length: 11 }, (_, i) => `@user${i}:server.com`)

      await expect(
        api.createSession({
          participants
        })
      ).rejects.toThrow()
    })
  })

  describe('事件系统集成测试', () => {
    it('应该正确触发和监听事件', async () => {
      extendMatrixClient(mockClient)
      const api = getPrivateChatApi(mockClient)

      const createdListener = vi.fn()
      const sentListener = vi.fn()

      api.on('session.created', createdListener)
      api.on('message.sent', sentListener)

      // 创建会话
      const eventTestSessionId = generateSessionId('event-test')
      const mockSession: PrivateChatSession = {
        session_id: eventTestSessionId,
        creator_id: '@test:server.com',
        participants: ['@user:server.com'],
        created_at: '2024-01-01T00:00:00Z'
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ok',
          session_id: eventTestSessionId,
          session: mockSession
        }),
        text: async () =>
          JSON.stringify({
            status: 'ok',
            session_id: eventTestSessionId,
            session: mockSession
          })
      } as Response)

      await api.createSession({
        participants: ['@user:server.com']
      })

      expect(createdListener).toHaveBeenCalled()

      // 发送消息
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ok',
          message_id: 'msg-1'
        }),
        text: async () => JSON.stringify({ status: 'ok', message_id: 'msg-1' })
      } as Response)

      await api.sendMessage({
        session_id: eventTestSessionId,
        content: 'Test'
      })

      expect(sentListener).toHaveBeenCalled()

      // 清理
      api.dispose()
    })

    it('应该移除事件监听器', () => {
      extendMatrixClient(mockClient)
      const api = getPrivateChatApi(mockClient)

      const listener = vi.fn()

      api.on('session.created', listener)
      api.off('session.created', listener)

      // 手动触发事件
      api.emit('session.created', {} as PrivateChatSession)

      expect(listener).not.toHaveBeenCalled()
    })
  })
})
