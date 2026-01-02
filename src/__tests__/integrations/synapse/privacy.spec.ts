/**
 * Privacy Service Tests
 *
 * **Feature: sdk-backend-integration, Property 10: Block/Unblock Round Trip**
 * **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6**
 *
 * Tests:
 * - 15.1: Report functionality (report users and rooms)
 * - 15.2: Block functionality (block/unblock users and rooms, list blocked)
 * - 15.3: Feedback submission (text and attachment feedback)
 * - 15.4: Property Test for Block/Unblock Round Trip
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'

// Mock dependencies before importing the module
vi.mock('@/stores/matrixAuth', () => ({
  useMatrixAuthStore: vi.fn(() => ({
    getHomeserverBaseUrl: vi.fn(() => 'https://matrix.example.org'),
    accessToken: 'test-access-token'
  }))
}))

vi.mock('@/integrations/matrix/client', () => ({
  matrixClientService: {
    getClient: vi.fn(() => ({
      baseUrl: 'https://matrix.example.org'
    }))
  }
}))

vi.mock('@/integrations/matrix/media', () => ({
  uploadContent: vi.fn().mockResolvedValue('mxc://matrix.example.org/uploaded-file')
}))

// Import after mocks are set up
import {
  reportUser,
  reportRoom,
  blockUser,
  unblockUser,
  blockRoom,
  unblockRoom,
  listBlockedUsers,
  listBlockedRooms,
  listReports,
  submitFeedback,
  submitFeedbackWithAttachment,
  submitFeedbackWithMxc
} from '@/integrations/synapse/privacy'

describe('Privacy Service', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock global fetch
    fetchMock = vi.fn()
    global.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  /**
   * 15.1 验证举报功能
   * **Validates: Requirements 10.1, 10.2**
   *
   * Tests for reporting users and rooms.
   */
  describe('15.1 Report Functionality', () => {
    describe('reportUser', () => {
      it('should report a user with reason', async () => {
        const mockResponse = { success: true, report_id: 'report_123' }
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        })

        const result = await reportUser('@baduser:matrix.org', 'Spam behavior')

        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('/_synapse/client/privacy'),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
              Authorization: 'Bearer test-access-token'
            }),
            body: JSON.stringify({
              action: 'report_user',
              target_id: '@baduser:matrix.org',
              reason: 'Spam behavior'
            })
          })
        )
        expect(result).toEqual(mockResponse)
      })

      it('should throw error when report fails', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: false,
          status: 500
        })

        await expect(reportUser('@baduser:matrix.org', 'Spam')).rejects.toThrow('举报失败')
      })

      it('should handle various user IDs', async () => {
        fetchMock.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ success: true })
        })

        // Test with different user ID formats
        await reportUser('@user:matrix.org', 'reason1')
        await reportUser('@user-with-dash:server.com', 'reason2')
        await reportUser('@user_underscore:example.org', 'reason3')

        expect(fetchMock).toHaveBeenCalledTimes(3)
      })
    })

    describe('reportRoom', () => {
      it('should report a room with reason', async () => {
        const mockResponse = { success: true, report_id: 'report_456' }
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        })

        const result = await reportRoom('!badroom:matrix.org', 'Inappropriate content')

        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('/_synapse/client/privacy'),
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              action: 'report_room',
              target_id: '!badroom:matrix.org',
              reason: 'Inappropriate content'
            })
          })
        )
        expect(result).toEqual(mockResponse)
      })

      it('should throw error when room report fails', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: false,
          status: 403
        })

        await expect(reportRoom('!room:matrix.org', 'Spam')).rejects.toThrow('举报失败')
      })
    })

    describe('listReports', () => {
      it('should list user reports', async () => {
        const mockReports = [
          { id: 'report_1', target_id: '@user1:matrix.org', reason: 'Spam', created_at: 1234567890 },
          { id: 'report_2', target_id: '!room1:matrix.org', reason: 'Abuse', created_at: 1234567891 }
        ]
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ reports: mockReports })
        })

        const result = await listReports()

        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('action=list_reports'),
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer test-access-token'
            })
          })
        )
        expect(result).toEqual(mockReports)
      })

      it('should return empty array when no reports', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ reports: [] })
        })

        const result = await listReports()
        expect(result).toEqual([])
      })

      it('should handle malformed response gracefully', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({})
        })

        const result = await listReports()
        expect(result).toEqual([])
      })
    })
  })

  /**
   * 15.2 验证屏蔽功能
   * **Validates: Requirements 10.3, 10.4, 10.5**
   *
   * Tests for blocking/unblocking users and rooms, and listing blocked entities.
   */
  describe('15.2 Block Functionality', () => {
    describe('blockUser', () => {
      it('should block a user', async () => {
        const mockResponse = { success: true }
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        })

        const result = await blockUser('@annoying:matrix.org')

        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('/_synapse/client/privacy'),
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              action: 'block_user',
              target_id: '@annoying:matrix.org'
            })
          })
        )
        expect(result).toEqual(mockResponse)
      })

      it('should throw error when block fails', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: false,
          status: 500
        })

        await expect(blockUser('@user:matrix.org')).rejects.toThrow('屏蔽失败')
      })
    })

    describe('unblockUser', () => {
      it('should unblock a user', async () => {
        const mockResponse = { success: true }
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        })

        const result = await unblockUser('@annoying:matrix.org')

        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('/_synapse/client/privacy'),
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              action: 'unblock_user',
              target_id: '@annoying:matrix.org'
            })
          })
        )
        expect(result).toEqual(mockResponse)
      })

      it('should throw error when unblock fails', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: false,
          status: 404
        })

        await expect(unblockUser('@user:matrix.org')).rejects.toThrow('取消屏蔽失败')
      })
    })

    describe('blockRoom', () => {
      it('should block a room', async () => {
        const mockResponse = { success: true }
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        })

        const result = await blockRoom('!spamroom:matrix.org')

        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('/_synapse/client/privacy'),
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              action: 'block_room',
              target_id: '!spamroom:matrix.org'
            })
          })
        )
        expect(result).toEqual(mockResponse)
      })

      it('should throw error when room block fails', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: false,
          status: 500
        })

        await expect(blockRoom('!room:matrix.org')).rejects.toThrow('屏蔽失败')
      })
    })

    describe('unblockRoom', () => {
      it('should unblock a room', async () => {
        const mockResponse = { success: true }
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        })

        const result = await unblockRoom('!spamroom:matrix.org')

        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('/_synapse/client/privacy'),
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              action: 'unblock_room',
              target_id: '!spamroom:matrix.org'
            })
          })
        )
        expect(result).toEqual(mockResponse)
      })

      it('should throw error when room unblock fails', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: false,
          status: 404
        })

        await expect(unblockRoom('!room:matrix.org')).rejects.toThrow('取消屏蔽失败')
      })
    })

    describe('listBlockedUsers', () => {
      it('should list blocked users', async () => {
        const mockUsers = [
          { user_id: '@blocked1:matrix.org', blocked_at: 1234567890 },
          { user_id: '@blocked2:matrix.org', blocked_at: 1234567891 }
        ]
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ users: mockUsers })
        })

        const result = await listBlockedUsers()

        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('action=list_blocked_users'),
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer test-access-token'
            })
          })
        )
        expect(result).toEqual(mockUsers)
      })

      it('should return empty array when no blocked users', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ users: [] })
        })

        const result = await listBlockedUsers()
        expect(result).toEqual([])
      })

      it('should handle malformed response gracefully', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({})
        })

        const result = await listBlockedUsers()
        expect(result).toEqual([])
      })

      it('should throw error when list fails', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: false,
          status: 500
        })

        await expect(listBlockedUsers()).rejects.toThrow('获取屏蔽用户失败')
      })
    })

    describe('listBlockedRooms', () => {
      it('should list blocked rooms', async () => {
        const mockRooms = [
          { room_id: '!blocked1:matrix.org', blocked_at: 1234567890 },
          { room_id: '!blocked2:matrix.org', blocked_at: 1234567891 }
        ]
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ rooms: mockRooms })
        })

        const result = await listBlockedRooms()

        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('action=list_blocked_rooms'),
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer test-access-token'
            })
          })
        )
        expect(result).toEqual(mockRooms)
      })

      it('should return empty array when no blocked rooms', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ rooms: [] })
        })

        const result = await listBlockedRooms()
        expect(result).toEqual([])
      })

      it('should handle malformed response gracefully', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({})
        })

        const result = await listBlockedRooms()
        expect(result).toEqual([])
      })

      it('should throw error when list fails', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: false,
          status: 500
        })

        await expect(listBlockedRooms()).rejects.toThrow('获取屏蔽房间失败')
      })
    })
  })

  /**
   * 15.3 验证反馈提交
   * **Validates: Requirements 10.6**
   *
   * Tests for submitting text feedback and feedback with attachments.
   */
  describe('15.3 Feedback Submission', () => {
    describe('submitFeedback', () => {
      it('should submit text feedback', async () => {
        const mockResponse = { success: true, feedback_id: 'feedback_123' }
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        })

        const result = await submitFeedback('Bug Report', 'Found a bug in the chat feature')

        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('/_synapse/client/feedback'),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
              Authorization: 'Bearer test-access-token'
            }),
            body: JSON.stringify({
              subject: 'Bug Report',
              content: 'Found a bug in the chat feature'
            })
          })
        )
        expect(result).toEqual(mockResponse)
      })

      it('should throw error when feedback submission fails', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: false,
          status: 500
        })

        await expect(submitFeedback('Subject', 'Content')).rejects.toThrow('提交失败')
      })

      it('should handle long feedback content', async () => {
        const longContent = 'A'.repeat(10000)
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true })
        })

        await submitFeedback('Long Feedback', longContent)

        expect(fetchMock).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: JSON.stringify({
              subject: 'Long Feedback',
              content: longContent
            })
          })
        )
      })
    })

    describe('submitFeedbackWithAttachment', () => {
      it('should submit feedback with file attachment using FormData', async () => {
        const mockResponse = { success: true, feedback_id: 'feedback_456' }
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        })

        const mockFile = new File(['test content'], 'screenshot.png', { type: 'image/png' })
        const result = await submitFeedbackWithAttachment('Bug with Screenshot', 'See attached', mockFile)

        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('/_synapse/client/feedback'),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              Authorization: 'Bearer test-access-token'
            }),
            body: expect.any(FormData)
          })
        )
        expect(result).toEqual(mockResponse)
      })

      it('should throw error when attachment feedback fails', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: false,
          status: 413 // Payload too large
        })

        const mockFile = new File(['test'], 'file.png', { type: 'image/png' })
        await expect(submitFeedbackWithAttachment('Subject', 'Content', mockFile)).rejects.toThrow('提交失败')
      })
    })

    describe('submitFeedbackWithMxc', () => {
      it('should upload file to Matrix and submit feedback with MXC URL', async () => {
        const mockResponse = { success: true, feedback_id: 'feedback_789' }
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        })

        const mockFile = new File(['test content'], 'document.pdf', { type: 'application/pdf' })
        const result = await submitFeedbackWithMxc('Document Feedback', 'Please review', mockFile)

        // Verify the uploadContent was called (mocked)
        const { uploadContent } = await import('@/integrations/matrix/media')
        expect(uploadContent).toHaveBeenCalledWith(mockFile, { name: 'document.pdf', type: 'application/pdf' })

        // Verify the feedback was submitted with MXC URL
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('/_synapse/client/feedback'),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
              Authorization: 'Bearer test-access-token'
            }),
            body: JSON.stringify({
              subject: 'Document Feedback',
              content: 'Please review',
              attachment: 'mxc://matrix.example.org/uploaded-file'
            })
          })
        )
        expect(result).toEqual(mockResponse)
      })

      it('should throw error when MXC feedback submission fails', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: false,
          status: 500
        })

        const mockFile = new File(['test'], 'file.pdf', { type: 'application/pdf' })
        await expect(submitFeedbackWithMxc('Subject', 'Content', mockFile)).rejects.toThrow('提交失败')
      })
    })
  })

  /**
   * 15.4 Property-Based Test: Block/Unblock Round Trip
   * **Feature: sdk-backend-integration, Property 10: Block/Unblock Round Trip**
   * **Validates: Requirements 10.3, 10.4**
   *
   * *For any* user or room, blocking then unblocking should result in the entity
   * not appearing in the blocked list.
   */
  describe('15.4 Property 10: Block/Unblock Round Trip', () => {
    // Generate valid Matrix user IDs
    const userIdArb = fc
      .string({ minLength: 1, maxLength: 20 })
      .filter((s) => /^[a-z0-9_-]+$/.test(s))
      .chain((localpart) =>
        fc
          .string({ minLength: 3, maxLength: 20 })
          .filter((s) => /^[a-z0-9.-]+$/.test(s))
          .map((domain) => `@${localpart}:${domain}`)
      )

    // Generate valid Matrix room IDs
    const roomIdArb = fc
      .string({ minLength: 1, maxLength: 20 })
      .filter((s) => /^[a-zA-Z0-9]+$/.test(s))
      .chain((localpart) =>
        fc
          .string({ minLength: 3, maxLength: 20 })
          .filter((s) => /^[a-z0-9.-]+$/.test(s))
          .map((domain) => `!${localpart}:${domain}`)
      )

    /**
     * Property: For any valid Matrix user ID, blocking then unblocking should
     * result in the user not appearing in the blocked list.
     */
    it('should complete block/unblock round trip for users', async () => {
      await fc.assert(
        fc.asyncProperty(userIdArb, async (userId) => {
          // Reset fetch mock for each iteration
          fetchMock.mockReset()

          // Track blocked users state
          let blockedUsers: string[] = []

          // Mock block user - adds to blocked list
          fetchMock.mockImplementationOnce(() => {
            blockedUsers.push(userId)
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ success: true })
            })
          })

          // Mock unblock user - removes from blocked list
          fetchMock.mockImplementationOnce(() => {
            blockedUsers = blockedUsers.filter((u) => u !== userId)
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ success: true })
            })
          })

          // Mock list blocked users - returns current state
          fetchMock.mockImplementationOnce(() => {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ users: blockedUsers.map((u) => ({ user_id: u })) })
            })
          })

          // Execute block -> unblock -> list sequence
          await blockUser(userId)
          await unblockUser(userId)
          const blocked = await listBlockedUsers()

          // Property: After block then unblock, user should not be in blocked list
          const isBlocked = blocked.some((u: any) => u.user_id === userId)
          expect(isBlocked).toBe(false)

          return true
        }),
        { numRuns: 100 }
      )
    })

    /**
     * Property: For any valid Matrix room ID, blocking then unblocking should
     * result in the room not appearing in the blocked list.
     */
    it('should complete block/unblock round trip for rooms', async () => {
      await fc.assert(
        fc.asyncProperty(roomIdArb, async (roomId) => {
          // Reset fetch mock for each iteration
          fetchMock.mockReset()

          // Track blocked rooms state
          let blockedRooms: string[] = []

          // Mock block room - adds to blocked list
          fetchMock.mockImplementationOnce(() => {
            blockedRooms.push(roomId)
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ success: true })
            })
          })

          // Mock unblock room - removes from blocked list
          fetchMock.mockImplementationOnce(() => {
            blockedRooms = blockedRooms.filter((r) => r !== roomId)
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ success: true })
            })
          })

          // Mock list blocked rooms - returns current state
          fetchMock.mockImplementationOnce(() => {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ rooms: blockedRooms.map((r) => ({ room_id: r })) })
            })
          })

          // Execute block -> unblock -> list sequence
          await blockRoom(roomId)
          await unblockRoom(roomId)
          const blocked = await listBlockedRooms()

          // Property: After block then unblock, room should not be in blocked list
          const isBlocked = blocked.some((r: any) => r.room_id === roomId)
          expect(isBlocked).toBe(false)

          return true
        }),
        { numRuns: 100 }
      )
    })

    /**
     * Property: Blocking an already blocked user should be idempotent
     * (no error, user remains blocked)
     */
    it('should handle idempotent block operations', async () => {
      await fc.assert(
        fc.asyncProperty(userIdArb, fc.integer({ min: 1, max: 5 }), async (userId, blockCount) => {
          fetchMock.mockReset()

          // Mock all block calls to succeed
          for (let i = 0; i < blockCount; i++) {
            fetchMock.mockImplementationOnce(() => {
              return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ success: true })
              })
            })
          }

          // Execute multiple block operations
          for (let i = 0; i < blockCount; i++) {
            await blockUser(userId)
          }

          // All operations should succeed without error
          expect(fetchMock).toHaveBeenCalledTimes(blockCount)

          return true
        }),
        { numRuns: 50 }
      )
    })

    /**
     * Property: Unblocking a non-blocked user should not cause errors
     * (graceful handling)
     */
    it('should handle unblock of non-blocked entities gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(userIdArb, async (userId) => {
          fetchMock.mockReset()

          // Mock unblock to succeed even if user wasn't blocked
          fetchMock.mockImplementationOnce(() => {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ success: true })
            })
          })

          // Unblock without prior block should succeed
          const result = await unblockUser(userId)
          expect(result).toEqual({ success: true })

          return true
        }),
        { numRuns: 50 }
      )
    })
  })
})
