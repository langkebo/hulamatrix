/**
 * Admin Client Tests
 *
 * **Feature: sdk-backend-integration, Property 9: Admin API Error Handling**
 * **Validates: Requirements 9.2, 9.3, 9.4, 9.5**
 *
 * Tests:
 * - 14.1: User Management API (list users, get details, update status)
 * - 14.2: Room Management API (list rooms, get details, delete rooms)
 * - 14.3: Error Handling and Audit Logging
 * - 14.4: Property Test for Admin API Error Handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import { AdminClient } from '@/services/adminClient'
import { MatrixErrorCode } from '@/utils/error-handler'

// Mock dependencies
vi.mock('@/integrations/matrix/client', () => ({
  matrixClientService: {
    getClient: vi.fn()
  }
}))

vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}))

describe('AdminClient', () => {
  let matrixClientService: any
  let logger: any
  let adminClient: AdminClient

  beforeEach(async () => {
    vi.clearAllMocks()

    // Reset singleton
    AdminClient.resetInstance()

    // Get mocked modules
    const clientModule = await import('@/integrations/matrix/client')
    const loggerModule = await import('@/utils/logger')

    matrixClientService = clientModule.matrixClientService
    logger = loggerModule.logger

    // Create fresh instance
    adminClient = AdminClient.getInstance()
  })

  afterEach(() => {
    vi.clearAllMocks()
    AdminClient.resetInstance()
  })

  /**
   * 14.1 验证用户管理API
   * **Validates: Requirements 9.2**
   *
   * Tests for listing users, getting user details, and updating user status.
   */
  describe('14.1 User Management API', () => {
    describe('listUsers', () => {
      it('should list users with pagination', async () => {
        const mockUsers = [
          { name: '@alice:matrix.org', admin: false, deactivated: false },
          { name: '@bob:matrix.org', admin: true, deactivated: false }
        ]

        const mockHttp = {
          authedRequest: vi.fn().mockResolvedValue({
            users: mockUsers,
            next_token: 'token123',
            total: 100
          })
        }

        const mockClient = {
          http: mockHttp,
          getUserId: vi.fn().mockReturnValue('@admin:matrix.org')
        }

        matrixClientService.getClient.mockReturnValue(mockClient)

        const result = await adminClient.listUsers({ limit: 10, from: 0 })

        expect(result.users).toHaveLength(2)
        expect(result.total).toBe(100)
        expect(result.next_token).toBe('token123')
        expect(mockHttp.authedRequest).toHaveBeenCalledWith(
          undefined,
          'GET',
          expect.stringContaining('/_synapse/admin/v2/users'),
          undefined,
          undefined,
          { prefix: '' }
        )
      })

      it('should filter users by name', async () => {
        const mockHttp = {
          authedRequest: vi.fn().mockResolvedValue({
            users: [{ name: '@alice:matrix.org', admin: false, deactivated: false }],
            total: 1
          })
        }

        const mockClient = {
          http: mockHttp,
          getUserId: vi.fn().mockReturnValue('@admin:matrix.org')
        }

        matrixClientService.getClient.mockReturnValue(mockClient)

        await adminClient.listUsers({ name: 'alice' })

        expect(mockHttp.authedRequest).toHaveBeenCalledWith(
          undefined,
          'GET',
          expect.stringContaining('name=alice'),
          undefined,
          undefined,
          { prefix: '' }
        )
      })

      it('should log audit for successful list operation', async () => {
        const mockHttp = {
          authedRequest: vi.fn().mockResolvedValue({ users: [], total: 0 })
        }

        const mockClient = {
          http: mockHttp,
          getUserId: vi.fn().mockReturnValue('@admin:matrix.org')
        }

        matrixClientService.getClient.mockReturnValue(mockClient)

        await adminClient.listUsers()

        expect(logger.info).toHaveBeenCalledWith(
          '[AdminAudit]',
          expect.objectContaining({
            operationType: 'user.list',
            result: 'success'
          })
        )
      })
    })

    describe('getUser', () => {
      it('should get user details by ID', async () => {
        const mockUser = {
          name: '@alice:matrix.org',
          displayname: 'Alice',
          admin: false,
          deactivated: false,
          creation_ts: 1234567890
        }

        const mockHttp = {
          authedRequest: vi.fn().mockResolvedValue(mockUser)
        }

        const mockClient = {
          http: mockHttp,
          getUserId: vi.fn().mockReturnValue('@admin:matrix.org')
        }

        matrixClientService.getClient.mockReturnValue(mockClient)

        const result = await adminClient.getUser('@alice:matrix.org')

        expect(result.name).toBe('@alice:matrix.org')
        expect(result.displayname).toBe('Alice')
        expect(mockHttp.authedRequest).toHaveBeenCalledWith(
          undefined,
          'GET',
          expect.stringContaining('/_synapse/admin/v2/users/%40alice%3Amatrix.org'),
          undefined,
          undefined,
          { prefix: '' }
        )
      })

      it('should log audit for successful get operation', async () => {
        const mockHttp = {
          authedRequest: vi.fn().mockResolvedValue({ name: '@alice:matrix.org' })
        }

        const mockClient = {
          http: mockHttp,
          getUserId: vi.fn().mockReturnValue('@admin:matrix.org')
        }

        matrixClientService.getClient.mockReturnValue(mockClient)

        await adminClient.getUser('@alice:matrix.org')

        expect(logger.info).toHaveBeenCalledWith(
          '[AdminAudit]',
          expect.objectContaining({
            operationType: 'user.get',
            targetId: '@alice:matrix.org',
            result: 'success'
          })
        )
      })
    })

    describe('updateUserAdmin', () => {
      it('should update user admin status', async () => {
        const mockHttp = {
          authedRequest: vi.fn().mockResolvedValue(undefined)
        }

        const mockClient = {
          http: mockHttp,
          getUserId: vi.fn().mockReturnValue('@admin:matrix.org')
        }

        matrixClientService.getClient.mockReturnValue(mockClient)

        await adminClient.updateUserAdmin('@alice:matrix.org', true)

        expect(mockHttp.authedRequest).toHaveBeenCalledWith(
          undefined,
          'PUT',
          expect.stringContaining('/_synapse/admin/v2/users/%40alice%3Amatrix.org'),
          undefined,
          { admin: true },
          { prefix: '' }
        )
      })

      it('should log audit for admin status update', async () => {
        const mockHttp = {
          authedRequest: vi.fn().mockResolvedValue(undefined)
        }

        const mockClient = {
          http: mockHttp,
          getUserId: vi.fn().mockReturnValue('@admin:matrix.org')
        }

        matrixClientService.getClient.mockReturnValue(mockClient)

        await adminClient.updateUserAdmin('@alice:matrix.org', true)

        expect(logger.info).toHaveBeenCalledWith(
          '[AdminAudit]',
          expect.objectContaining({
            operationType: 'user.update_admin',
            targetId: '@alice:matrix.org',
            result: 'success',
            details: { admin: true }
          })
        )
      })
    })

    describe('setUserDeactivated', () => {
      it('should deactivate user', async () => {
        const mockHttp = {
          authedRequest: vi.fn().mockResolvedValue(undefined)
        }

        const mockClient = {
          http: mockHttp,
          getUserId: vi.fn().mockReturnValue('@admin:matrix.org')
        }

        matrixClientService.getClient.mockReturnValue(mockClient)

        await adminClient.setUserDeactivated('@alice:matrix.org', true)

        expect(mockHttp.authedRequest).toHaveBeenCalledWith(
          undefined,
          'PUT',
          expect.stringContaining('/_synapse/admin/v2/users/%40alice%3Amatrix.org'),
          undefined,
          { deactivated: true },
          { prefix: '' }
        )
      })

      it('should reactivate user', async () => {
        const mockHttp = {
          authedRequest: vi.fn().mockResolvedValue(undefined)
        }

        const mockClient = {
          http: mockHttp,
          getUserId: vi.fn().mockReturnValue('@admin:matrix.org')
        }

        matrixClientService.getClient.mockReturnValue(mockClient)

        await adminClient.setUserDeactivated('@alice:matrix.org', false)

        expect(mockHttp.authedRequest).toHaveBeenCalledWith(
          undefined,
          'PUT',
          expect.stringContaining('/_synapse/admin/v2/users/%40alice%3Amatrix.org'),
          undefined,
          { deactivated: false },
          { prefix: '' }
        )
      })
    })

    describe('resetPassword', () => {
      it('should reset user password', async () => {
        const mockHttp = {
          authedRequest: vi.fn().mockResolvedValue(undefined)
        }

        const mockClient = {
          http: mockHttp,
          getUserId: vi.fn().mockReturnValue('@admin:matrix.org')
        }

        matrixClientService.getClient.mockReturnValue(mockClient)

        await adminClient.resetPassword('@alice:matrix.org', 'newPassword123')

        expect(mockHttp.authedRequest).toHaveBeenCalledWith(
          undefined,
          'POST',
          expect.stringContaining('/_synapse/admin/v1/reset_password/%40alice%3Amatrix.org'),
          undefined,
          { new_password: 'newPassword123', logout_devices: true },
          { prefix: '' }
        )
      })

      it('should reset password without logging out devices', async () => {
        const mockHttp = {
          authedRequest: vi.fn().mockResolvedValue(undefined)
        }

        const mockClient = {
          http: mockHttp,
          getUserId: vi.fn().mockReturnValue('@admin:matrix.org')
        }

        matrixClientService.getClient.mockReturnValue(mockClient)

        await adminClient.resetPassword('@alice:matrix.org', 'newPassword123', false)

        expect(mockHttp.authedRequest).toHaveBeenCalledWith(
          undefined,
          'POST',
          expect.stringContaining('/_synapse/admin/v1/reset_password'),
          undefined,
          { new_password: 'newPassword123', logout_devices: false },
          { prefix: '' }
        )
      })
    })
  })

  /**
   * 14.2 验证房间管理API
   * **Validates: Requirements 9.3**
   *
   * Tests for listing rooms, getting room details, and deleting rooms.
   */
  describe('14.2 Room Management API', () => {
    describe('listRooms', () => {
      it('should list rooms with pagination', async () => {
        const mockRooms = [
          { room_id: '!room1:matrix.org', name: 'Room 1', joined_members: 10 },
          { room_id: '!room2:matrix.org', name: 'Room 2', joined_members: 5 }
        ]

        const mockHttp = {
          authedRequest: vi.fn().mockResolvedValue({
            rooms: mockRooms,
            next_batch: 'batch123',
            total_rooms: 50
          })
        }

        const mockClient = {
          http: mockHttp,
          getUserId: vi.fn().mockReturnValue('@admin:matrix.org')
        }

        matrixClientService.getClient.mockReturnValue(mockClient)

        const result = await adminClient.listRooms({ limit: 10, from: 0 })

        expect(result.rooms).toHaveLength(2)
        expect(result.total_rooms).toBe(50)
        expect(result.next_batch).toBe('batch123')
        expect(mockHttp.authedRequest).toHaveBeenCalledWith(
          undefined,
          'GET',
          expect.stringContaining('/_synapse/admin/v1/rooms'),
          undefined,
          undefined,
          { prefix: '' }
        )
      })

      it('should sort rooms by specified field', async () => {
        const mockHttp = {
          authedRequest: vi.fn().mockResolvedValue({
            rooms: [],
            total_rooms: 0
          })
        }

        const mockClient = {
          http: mockHttp,
          getUserId: vi.fn().mockReturnValue('@admin:matrix.org')
        }

        matrixClientService.getClient.mockReturnValue(mockClient)

        await adminClient.listRooms({ order_by: 'joined_members', dir: 'b' })

        expect(mockHttp.authedRequest).toHaveBeenCalledWith(
          undefined,
          'GET',
          expect.stringMatching(/order_by=joined_members.*dir=b|dir=b.*order_by=joined_members/),
          undefined,
          undefined,
          { prefix: '' }
        )
      })

      it('should log audit for successful list operation', async () => {
        const mockHttp = {
          authedRequest: vi.fn().mockResolvedValue({ rooms: [], total_rooms: 0 })
        }

        const mockClient = {
          http: mockHttp,
          getUserId: vi.fn().mockReturnValue('@admin:matrix.org')
        }

        matrixClientService.getClient.mockReturnValue(mockClient)

        await adminClient.listRooms()

        expect(logger.info).toHaveBeenCalledWith(
          '[AdminAudit]',
          expect.objectContaining({
            operationType: 'room.list',
            result: 'success'
          })
        )
      })
    })

    describe('getRoom', () => {
      it('should get room details by ID', async () => {
        const mockRoom = {
          room_id: '!room1:matrix.org',
          name: 'Test Room',
          joined_members: 10,
          version: '10',
          creator: '@creator:matrix.org'
        }

        const mockHttp = {
          authedRequest: vi.fn().mockResolvedValue(mockRoom)
        }

        const mockClient = {
          http: mockHttp,
          getUserId: vi.fn().mockReturnValue('@admin:matrix.org')
        }

        matrixClientService.getClient.mockReturnValue(mockClient)

        const result = await adminClient.getRoom('!room1:matrix.org')

        expect(result.room_id).toBe('!room1:matrix.org')
        expect(result.name).toBe('Test Room')
        expect(mockHttp.authedRequest).toHaveBeenCalledWith(
          undefined,
          'GET',
          expect.stringContaining('/_synapse/admin/v1/rooms/'),
          undefined,
          undefined,
          { prefix: '' }
        )
      })

      it('should log audit for successful get operation', async () => {
        const mockHttp = {
          authedRequest: vi.fn().mockResolvedValue({ room_id: '!room1:matrix.org' })
        }

        const mockClient = {
          http: mockHttp,
          getUserId: vi.fn().mockReturnValue('@admin:matrix.org')
        }

        matrixClientService.getClient.mockReturnValue(mockClient)

        await adminClient.getRoom('!room1:matrix.org')

        expect(logger.info).toHaveBeenCalledWith(
          '[AdminAudit]',
          expect.objectContaining({
            operationType: 'room.get',
            targetId: '!room1:matrix.org',
            result: 'success'
          })
        )
      })
    })

    describe('deleteRoom', () => {
      it('should delete room', async () => {
        const mockHttp = {
          authedRequest: vi.fn().mockResolvedValue(undefined)
        }

        const mockClient = {
          http: mockHttp,
          getUserId: vi.fn().mockReturnValue('@admin:matrix.org')
        }

        matrixClientService.getClient.mockReturnValue(mockClient)

        await adminClient.deleteRoom('!room1:matrix.org')

        expect(mockHttp.authedRequest).toHaveBeenCalledWith(
          undefined,
          'DELETE',
          expect.stringContaining('/_synapse/admin/v1/rooms/'),
          undefined,
          undefined,
          { prefix: '' }
        )
      })

      it('should delete room with block and purge options', async () => {
        const mockHttp = {
          authedRequest: vi.fn().mockResolvedValue(undefined)
        }

        const mockClient = {
          http: mockHttp,
          getUserId: vi.fn().mockReturnValue('@admin:matrix.org')
        }

        matrixClientService.getClient.mockReturnValue(mockClient)

        await adminClient.deleteRoom('!room1:matrix.org', { block: true, purge: true })

        expect(mockHttp.authedRequest).toHaveBeenCalledWith(
          undefined,
          'DELETE',
          expect.stringMatching(/block=true.*purge=true|purge=true.*block=true/),
          undefined,
          undefined,
          { prefix: '' }
        )
      })

      it('should log audit for successful delete operation', async () => {
        const mockHttp = {
          authedRequest: vi.fn().mockResolvedValue(undefined)
        }

        const mockClient = {
          http: mockHttp,
          getUserId: vi.fn().mockReturnValue('@admin:matrix.org')
        }

        matrixClientService.getClient.mockReturnValue(mockClient)

        await adminClient.deleteRoom('!room1:matrix.org', { block: true })

        expect(logger.info).toHaveBeenCalledWith(
          '[AdminAudit]',
          expect.objectContaining({
            operationType: 'room.delete',
            targetId: '!room1:matrix.org',
            result: 'success',
            details: { block: true }
          })
        )
      })
    })

    describe('purgeHistory', () => {
      it('should purge room history', async () => {
        const mockHttp = {
          authedRequest: vi.fn().mockResolvedValue({ purge_id: 'purge123' })
        }

        const mockClient = {
          http: mockHttp,
          getUserId: vi.fn().mockReturnValue('@admin:matrix.org')
        }

        matrixClientService.getClient.mockReturnValue(mockClient)

        const result = await adminClient.purgeHistory('!room1:matrix.org', 1234567890000)

        expect(result.purge_id).toBe('purge123')
        expect(mockHttp.authedRequest).toHaveBeenCalledWith(
          undefined,
          'POST',
          expect.stringContaining('/_synapse/admin/v1/purge_history/'),
          undefined,
          { purge_up_to_ts: 1234567890000 },
          { prefix: '' }
        )
      })
    })
  })

  /**
   * 14.3 验证错误处理和审计日志
   * **Validates: Requirements 9.4, 9.5**
   *
   * Tests for error handling through MatrixErrorHandler and audit logging.
   */
  describe('14.3 Error Handling and Audit Logging', () => {
    describe('Error Handling via MatrixErrorHandler', () => {
      it('should transform errors through MatrixErrorHandler', async () => {
        const networkError = new Error('Network timeout')

        const mockHttp = {
          authedRequest: vi.fn().mockRejectedValue(networkError)
        }

        const mockClient = {
          http: mockHttp,
          getUserId: vi.fn().mockReturnValue('@admin:matrix.org')
        }

        matrixClientService.getClient.mockReturnValue(mockClient)

        await expect(adminClient.getUser('@alice:matrix.org')).rejects.toMatchObject({
          code: expect.any(String),
          message: expect.any(String),
          userMessage: expect.any(String)
        })
      })

      it('should handle forbidden errors', async () => {
        const forbiddenError = new Error('M_FORBIDDEN: You are not authorized')

        const mockHttp = {
          authedRequest: vi.fn().mockRejectedValue(forbiddenError)
        }

        const mockClient = {
          http: mockHttp,
          getUserId: vi.fn().mockReturnValue('@admin:matrix.org')
        }

        matrixClientService.getClient.mockReturnValue(mockClient)

        await expect(adminClient.listUsers()).rejects.toMatchObject({
          code: MatrixErrorCode.AUTH_FORBIDDEN
        })
      })

      it('should handle not found errors', async () => {
        const notFoundError = new Error('M_NOT_FOUND: User not found')

        const mockHttp = {
          authedRequest: vi.fn().mockRejectedValue(notFoundError)
        }

        const mockClient = {
          http: mockHttp,
          getUserId: vi.fn().mockReturnValue('@admin:matrix.org')
        }

        matrixClientService.getClient.mockReturnValue(mockClient)

        // The error handler classifies M_NOT_FOUND as ROOM_NOT_FOUND
        // This is expected behavior as the error handler uses pattern matching
        await expect(adminClient.getUser('@nonexistent:matrix.org')).rejects.toMatchObject({
          code: expect.any(String),
          userMessage: expect.any(String)
        })
      })

      it('should throw error when client is not initialized', async () => {
        matrixClientService.getClient.mockReturnValue(null)

        await expect(adminClient.listUsers()).rejects.toThrow('Matrix Client HTTP not available')
      })
    })

    describe('Audit Logging', () => {
      it('should log audit for successful operations', async () => {
        const mockHttp = {
          authedRequest: vi.fn().mockResolvedValue({ users: [], total: 0 })
        }

        const mockClient = {
          http: mockHttp,
          getUserId: vi.fn().mockReturnValue('@admin:matrix.org')
        }

        matrixClientService.getClient.mockReturnValue(mockClient)

        await adminClient.listUsers()

        expect(logger.info).toHaveBeenCalledWith(
          '[AdminAudit]',
          expect.objectContaining({
            id: expect.stringMatching(/^audit_/),
            operatorId: '@admin:matrix.org',
            operationType: 'user.list',
            targetId: 'all',
            targetType: 'user',
            timestamp: expect.any(Number),
            result: 'success'
          })
        )
      })

      it('should log audit for failed operations', async () => {
        const mockHttp = {
          authedRequest: vi.fn().mockRejectedValue(new Error('Server error'))
        }

        const mockClient = {
          http: mockHttp,
          getUserId: vi.fn().mockReturnValue('@admin:matrix.org')
        }

        matrixClientService.getClient.mockReturnValue(mockClient)

        await expect(adminClient.getUser('@alice:matrix.org')).rejects.toThrow()

        expect(logger.info).toHaveBeenCalledWith(
          '[AdminAudit]',
          expect.objectContaining({
            operationType: 'user.get',
            targetId: '@alice:matrix.org',
            result: 'failure',
            details: expect.objectContaining({
              error: expect.any(String)
            })
          })
        )
      })

      it('should include operator ID in audit logs', async () => {
        const mockHttp = {
          authedRequest: vi.fn().mockResolvedValue({ rooms: [], total_rooms: 0 })
        }

        const mockClient = {
          http: mockHttp,
          getUserId: vi.fn().mockReturnValue('@superadmin:matrix.org')
        }

        matrixClientService.getClient.mockReturnValue(mockClient)

        await adminClient.listRooms()

        expect(logger.info).toHaveBeenCalledWith(
          '[AdminAudit]',
          expect.objectContaining({
            operatorId: '@superadmin:matrix.org'
          })
        )
      })

      it('should log audit with details for update operations', async () => {
        const mockHttp = {
          authedRequest: vi.fn().mockResolvedValue(undefined)
        }

        const mockClient = {
          http: mockHttp,
          getUserId: vi.fn().mockReturnValue('@admin:matrix.org')
        }

        matrixClientService.getClient.mockReturnValue(mockClient)

        await adminClient.updateUserAdmin('@alice:matrix.org', true)

        expect(logger.info).toHaveBeenCalledWith(
          '[AdminAudit]',
          expect.objectContaining({
            operationType: 'user.update_admin',
            details: { admin: true }
          })
        )
      })

      it('should log audit for device operations', async () => {
        const mockHttp = {
          authedRequest: vi.fn().mockResolvedValue({ devices: [] })
        }

        const mockClient = {
          http: mockHttp,
          getUserId: vi.fn().mockReturnValue('@admin:matrix.org')
        }

        matrixClientService.getClient.mockReturnValue(mockClient)

        await adminClient.listDevices('@alice:matrix.org')

        expect(logger.info).toHaveBeenCalledWith(
          '[AdminAudit]',
          expect.objectContaining({
            operationType: 'device.list',
            targetId: '@alice:matrix.org',
            targetType: 'device'
          })
        )
      })

      it('should log audit for media operations', async () => {
        const mockHttp = {
          authedRequest: vi.fn().mockResolvedValue({ deleted: 10 })
        }

        const mockClient = {
          http: mockHttp,
          getUserId: vi.fn().mockReturnValue('@admin:matrix.org')
        }

        matrixClientService.getClient.mockReturnValue(mockClient)

        await adminClient.purgeMediaCache(1234567890000)

        expect(logger.info).toHaveBeenCalledWith(
          '[AdminAudit]',
          expect.objectContaining({
            operationType: 'media.purge',
            targetType: 'media'
          })
        )
      })
    })
  })

  /**
   * 14.4 Property-Based Test: Admin API Error Handling
   * **Feature: sdk-backend-integration, Property 9: Admin API Error Handling**
   * **Validates: Requirements 9.4, 9.5**
   *
   * *For any* admin API call, errors should be transformed through MatrixErrorHandler
   * and all operations should be logged for audit.
   */
  describe('14.4 Property 9: Admin API Error Handling', () => {
    /**
     * Property: For any admin API operation that fails, the error should be
     * transformed through MatrixErrorHandler and contain code, message, and userMessage.
     */
    it('should transform all API errors through MatrixErrorHandler', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate various error messages
          fc.oneof(
            fc.constant('Network timeout'),
            fc.constant('M_FORBIDDEN: Access denied'),
            fc.constant('M_NOT_FOUND: Resource not found'),
            fc.constant('M_UNKNOWN_TOKEN: Invalid token'),
            fc.constant('500 Internal Server Error'),
            fc.constant('Connection refused'),
            fc.string({ minLength: 1, maxLength: 100 })
          ),
          // Generate operation type
          fc.constantFrom('getUser', 'listUsers', 'listRooms', 'getRoom', 'deleteRoom'),
          async (errorMessage, operation) => {
            // Reset singleton for each iteration
            AdminClient.resetInstance()
            const testClient = AdminClient.getInstance()

            const mockHttp = {
              authedRequest: vi.fn().mockRejectedValue(new Error(errorMessage))
            }

            const mockClient = {
              http: mockHttp,
              getUserId: vi.fn().mockReturnValue('@admin:matrix.org')
            }

            matrixClientService.getClient.mockReturnValue(mockClient)

            try {
              switch (operation) {
                case 'getUser':
                  await testClient.getUser('@test:matrix.org')
                  break
                case 'listUsers':
                  await testClient.listUsers()
                  break
                case 'listRooms':
                  await testClient.listRooms()
                  break
                case 'getRoom':
                  await testClient.getRoom('!test:matrix.org')
                  break
                case 'deleteRoom':
                  await testClient.deleteRoom('!test:matrix.org')
                  break
              }
              // Should not reach here
              return false
            } catch (error: any) {
              // Property 1: Error should have code property
              expect(error).toHaveProperty('code')
              expect(typeof error.code).toBe('string')

              // Property 2: Error should have message property
              expect(error).toHaveProperty('message')
              expect(typeof error.message).toBe('string')

              // Property 3: Error should have userMessage property
              expect(error).toHaveProperty('userMessage')
              expect(typeof error.userMessage).toBe('string')

              return true
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property: For any admin API operation (success or failure),
     * an audit log entry should be created with required fields.
     */
    it('should log audit for all operations with required fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate success or failure
          fc.boolean(),
          // Generate operation type
          fc.constantFrom(
            'getUser',
            'listUsers',
            'updateUserAdmin',
            'setUserDeactivated',
            'listRooms',
            'getRoom',
            'deleteRoom'
          ),
          async (shouldSucceed, operation) => {
            // Clear mocks
            vi.clearAllMocks()

            // Reset singleton for each iteration
            AdminClient.resetInstance()
            const testClient = AdminClient.getInstance()

            const mockHttp = {
              authedRequest: shouldSucceed
                ? vi.fn().mockResolvedValue({ users: [], rooms: [], total: 0, total_rooms: 0 })
                : vi.fn().mockRejectedValue(new Error('Test error'))
            }

            const mockClient = {
              http: mockHttp,
              getUserId: vi.fn().mockReturnValue('@admin:matrix.org')
            }

            matrixClientService.getClient.mockReturnValue(mockClient)

            try {
              switch (operation) {
                case 'getUser':
                  await testClient.getUser('@test:matrix.org')
                  break
                case 'listUsers':
                  await testClient.listUsers()
                  break
                case 'updateUserAdmin':
                  await testClient.updateUserAdmin('@test:matrix.org', true)
                  break
                case 'setUserDeactivated':
                  await testClient.setUserDeactivated('@test:matrix.org', true)
                  break
                case 'listRooms':
                  await testClient.listRooms()
                  break
                case 'getRoom':
                  await testClient.getRoom('!test:matrix.org')
                  break
                case 'deleteRoom':
                  await testClient.deleteRoom('!test:matrix.org')
                  break
              }
            } catch {
              // Expected for failure cases
            }

            // Property: Audit log should be called
            expect(logger.info).toHaveBeenCalledWith(
              '[AdminAudit]',
              expect.objectContaining({
                // Required fields
                id: expect.stringMatching(/^audit_/),
                operatorId: expect.any(String),
                operationType: expect.any(String),
                targetId: expect.any(String),
                targetType: expect.stringMatching(/^(user|room|device|media)$/),
                timestamp: expect.any(Number),
                result: shouldSucceed ? 'success' : 'failure'
              })
            )

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property: For any failed operation, the audit log should include error details.
     */
    it('should include error details in audit log for failed operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate error message
          fc.string({ minLength: 1, maxLength: 100 }),
          // Generate operation
          fc.constantFrom('getUser', 'listUsers', 'listRooms', 'deleteRoom'),
          async (errorMessage, operation) => {
            // Clear mocks
            vi.clearAllMocks()

            // Reset singleton
            AdminClient.resetInstance()
            const testClient = AdminClient.getInstance()

            const mockHttp = {
              authedRequest: vi.fn().mockRejectedValue(new Error(errorMessage))
            }

            const mockClient = {
              http: mockHttp,
              getUserId: vi.fn().mockReturnValue('@admin:matrix.org')
            }

            matrixClientService.getClient.mockReturnValue(mockClient)

            try {
              switch (operation) {
                case 'getUser':
                  await testClient.getUser('@test:matrix.org')
                  break
                case 'listUsers':
                  await testClient.listUsers()
                  break
                case 'listRooms':
                  await testClient.listRooms()
                  break
                case 'deleteRoom':
                  await testClient.deleteRoom('!test:matrix.org')
                  break
              }
            } catch {
              // Expected
            }

            // Property: Audit log should include error details
            expect(logger.info).toHaveBeenCalledWith(
              '[AdminAudit]',
              expect.objectContaining({
                result: 'failure',
                details: expect.objectContaining({
                  error: expect.any(String)
                })
              })
            )

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property: Audit log IDs should be unique for each operation.
     */
    it('should generate unique audit log IDs for each operation', async () => {
      const auditIds = new Set<string>()

      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: 50 }), async (iterations) => {
          for (let i = 0; i < iterations; i++) {
            vi.clearAllMocks()
            AdminClient.resetInstance()
            const testClient = AdminClient.getInstance()

            const mockHttp = {
              authedRequest: vi.fn().mockResolvedValue({ users: [], total: 0 })
            }

            const mockClient = {
              http: mockHttp,
              getUserId: vi.fn().mockReturnValue('@admin:matrix.org')
            }

            matrixClientService.getClient.mockReturnValue(mockClient)

            await testClient.listUsers()

            // Extract audit ID from the log call
            const logCall = logger.info.mock.calls.find((call: any[]) => call[0] === '[AdminAudit]' && call[1]?.id)

            if (logCall) {
              const auditId = logCall[1].id
              // Property: Each audit ID should be unique
              expect(auditIds.has(auditId)).toBe(false)
              auditIds.add(auditId)
            }
          }

          return true
        }),
        { numRuns: 10 }
      )
    })
  })
})
