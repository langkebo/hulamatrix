/**
 * Enhanced Friends Service Property-Based Tests
 *
 * **Feature: sdk-integration-audit, Property 4: Friends Fallback**
 * **Feature: sdk-integration-audit, Property 5: Friend Request Creates Direct Room**
 * **Feature: sdk-integration-audit, Property 6: Presence Sync**
 * **Feature: admin-module-optimization, Property 2: Friend Request Lifecycle**
 * **Feature: admin-module-optimization, Property 4: Presence Handling**
 * **Validates: Requirements 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 4.1, 4.3, 4.4**
 *
 * Tests:
 * - Property 4 (sdk-integration-audit): Fallback to m.direct when Synapse extension unavailable
 * - Property 5: Friend request creates direct room and updates m.direct
 * - Property 6: Presence sync for all friends
 * - Property 2 (admin-module-optimization): Friend Request Lifecycle
 * - Property 4 (admin-module-optimization): Presence Handling - subscription, caching, graceful handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import { EnhancedFriendsService, type Friend } from '@/services/enhancedFriendsService'

// Mock dependencies
vi.mock('@/integrations/matrix/client', () => ({
  matrixClientService: {
    getClient: vi.fn()
  }
}))

vi.mock('@/integrations/synapse/friends', () => ({
  listFriends: vi.fn(),
  sendRequest: vi.fn(),
  acceptRequest: vi.fn(),
  rejectRequest: vi.fn()
}))

vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}))

describe('EnhancedFriendsService', () => {
  let matrixClientService: any
  let synapseApi: any
  let service: EnhancedFriendsService

  beforeEach(async () => {
    vi.clearAllMocks()

    // Get mocked modules
    const clientModule = await import('@/integrations/matrix/client')
    const synapseModule = await import('@/integrations/synapse/friends')

    matrixClientService = clientModule.matrixClientService
    synapseApi = synapseModule

    // Create fresh service instance for each test
    service = new EnhancedFriendsService()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  /**
   * Property-Based Test: Friends Fallback
   * **Feature: sdk-integration-audit, Property 4: Friends Fallback**
   * **Validates: Requirements 3.1**
   *
   * *For any* call to listFriends when Synapse extension is unavailable,
   * the EnhancedFriendsService SHALL return friends from m.direct account data
   * without throwing an error.
   */
  describe('Property 4: Friends Fallback', () => {
    it('should fallback to m.direct when Synapse extension fails', async () => {
      // Setup: Synapse API throws error
      synapseApi.listFriends.mockRejectedValue(new Error('Synapse unavailable'))

      // Setup: m.direct data
      const mDirectData = {
        '@alice:matrix.org': ['!room1:matrix.org'],
        '@bob:matrix.org': ['!room2:matrix.org']
      }

      const mockClient = {
        getAccountData: vi.fn().mockReturnValue({
          getContent: () => mDirectData
        }),
        getProfileInfo: vi.fn().mockResolvedValue({
          displayname: 'Test User',
          avatar_url: 'mxc://test/avatar'
        }),
        getUser: vi.fn().mockReturnValue({
          presence: 'online'
        })
      }

      matrixClientService.getClient.mockReturnValue(mockClient)

      // Execute
      const friends = await service.listFriends()

      // Verify: Should return friends from m.direct without throwing
      expect(friends).toHaveLength(2)
      expect(friends.map((f) => f.userId)).toContain('@alice:matrix.org')
      expect(friends.map((f) => f.userId)).toContain('@bob:matrix.org')
    })

    it('should return empty array when both Synapse and m.direct fail', async () => {
      // Setup: Both fail
      synapseApi.listFriends.mockRejectedValue(new Error('Synapse unavailable'))

      const mockClient = {
        getAccountData: vi.fn().mockReturnValue(null)
      }

      matrixClientService.getClient.mockReturnValue(mockClient)

      // Execute
      const friends = await service.listFriends()

      // Verify: Should return empty array without throwing
      expect(friends).toEqual([])
    })

    it('should return empty array when client is not initialized', async () => {
      // Setup: No client
      synapseApi.listFriends.mockRejectedValue(new Error('Synapse unavailable'))
      matrixClientService.getClient.mockReturnValue(null)

      // Execute
      const friends = await service.listFriends()

      // Verify: Should return empty array without throwing
      expect(friends).toEqual([])
    })

    it('should use Synapse data when available', async () => {
      // Setup: Synapse returns data
      const synapseFriends = [
        { user_id: '@alice:matrix.org', display_name: 'Alice', presence: 'online' },
        { user_id: '@bob:matrix.org', display_name: 'Bob', presence: 'offline' }
      ]
      synapseApi.listFriends.mockResolvedValue({ friends: synapseFriends })

      // Execute
      const friends = await service.listFriends()

      // Verify: Should use Synapse data
      expect(friends).toHaveLength(2)
      expect(friends[0].userId).toBe('@alice:matrix.org')
      expect(friends[0].displayName).toBe('Alice')
    })

    it('should handle arbitrary m.direct data without throwing', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary m.direct-like data
          fc.dictionary(
            fc.string().filter((s) => s.startsWith('@') && s.includes(':')),
            fc.array(fc.string().filter((s) => s.startsWith('!')))
          ),
          async (mDirectData) => {
            // Setup
            synapseApi.listFriends.mockRejectedValue(new Error('Synapse unavailable'))

            const mockClient = {
              getAccountData: vi.fn().mockReturnValue({
                getContent: () => mDirectData
              }),
              getProfileInfo: vi.fn().mockResolvedValue({}),
              getUser: vi.fn().mockReturnValue(null)
            }

            matrixClientService.getClient.mockReturnValue(mockClient)

            // Create fresh service for this iteration
            const testService = new EnhancedFriendsService()

            // Execute - should not throw
            const friends = await testService.listFriends()

            // Verify: Should return array (possibly empty)
            expect(Array.isArray(friends)).toBe(true)

            // Verify: Each friend should have required fields
            for (const friend of friends) {
              expect(typeof friend.userId).toBe('string')
              expect(['online', 'offline', 'unavailable']).toContain(friend.presence)
            }

            return true
          }
        ),
        { numRuns: 50 }
      )
    })
  })

  /**
   * Property-Based Test: Friend Request Creates Direct Room
   * **Feature: sdk-integration-audit, Property 5: Friend Request Creates Direct Room**
   * **Validates: Requirements 3.2, 3.3**
   *
   * *For any* friend request sent to a valid user ID, the EnhancedFriendsService
   * SHALL create a direct room, update m.direct account data, and return the room ID.
   */
  describe('Property 5: Friend Request Creates Direct Room', () => {
    it('should create direct room and update m.direct when sending friend request', async () => {
      // Setup
      const targetUserId = '@target:matrix.org'
      const createdRoomId = '!newroom:matrix.org'

      const mockClient = {
        createRoom: vi.fn().mockResolvedValue({ room_id: createdRoomId }),
        getAccountData: vi.fn().mockReturnValue({
          getContent: () => ({})
        }),
        setAccountData: vi.fn().mockResolvedValue(undefined),
        sendEvent: vi.fn().mockResolvedValue(undefined),
        getUserId: vi.fn().mockReturnValue('@me:matrix.org')
      }

      matrixClientService.getClient.mockReturnValue(mockClient)

      // Execute
      const roomId = await service.sendFriendRequest(targetUserId, 'Hello!')

      // Verify: Room was created with correct parameters
      expect(mockClient.createRoom).toHaveBeenCalledWith({
        is_direct: true,
        preset: 'trusted_private_chat',
        invite: [targetUserId]
      })

      // Verify: m.direct was updated
      expect(mockClient.setAccountData).toHaveBeenCalledWith(
        'm.direct',
        expect.objectContaining({
          [targetUserId]: expect.arrayContaining([createdRoomId])
        })
      )

      // Verify: Room ID was returned
      expect(roomId).toBe(createdRoomId)
    })

    it('should send message when provided', async () => {
      // Setup
      const targetUserId = '@target:matrix.org'
      const message = 'Please add me as a friend!'
      const createdRoomId = '!newroom:matrix.org'

      const mockClient = {
        createRoom: vi.fn().mockResolvedValue({ room_id: createdRoomId }),
        getAccountData: vi.fn().mockReturnValue({
          getContent: () => ({})
        }),
        setAccountData: vi.fn().mockResolvedValue(undefined),
        sendEvent: vi.fn().mockResolvedValue(undefined),
        getUserId: vi.fn().mockReturnValue('@me:matrix.org')
      }

      matrixClientService.getClient.mockReturnValue(mockClient)

      // Execute
      await service.sendFriendRequest(targetUserId, message)

      // Verify: Message was sent
      expect(mockClient.sendEvent).toHaveBeenCalledWith(
        createdRoomId,
        'm.room.message',
        expect.objectContaining({
          msgtype: 'm.text',
          body: message
        })
      )
    })

    it('should throw error when client is not initialized', async () => {
      matrixClientService.getClient.mockReturnValue(null)

      await expect(service.sendFriendRequest('@target:matrix.org')).rejects.toThrow('Matrix client not initialized')
    })

    it('should handle room creation for any valid user ID', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate valid Matrix user IDs
          fc
            .tuple(
              fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-z0-9._=-]+$/i.test(s)),
              fc.string({ minLength: 1, maxLength: 50 }).filter((s) => /^[a-z0-9.-]+$/i.test(s))
            )
            .map(([local, domain]) => `@${local}:${domain}`),
          fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
          async (targetUserId, message) => {
            // Setup
            const createdRoomId = `!room_${Date.now()}:matrix.org`

            const mockClient = {
              createRoom: vi.fn().mockResolvedValue({ room_id: createdRoomId }),
              getAccountData: vi.fn().mockReturnValue({
                getContent: () => ({})
              }),
              setAccountData: vi.fn().mockResolvedValue(undefined),
              sendEvent: vi.fn().mockResolvedValue(undefined),
              getUserId: vi.fn().mockReturnValue('@me:matrix.org')
            }

            matrixClientService.getClient.mockReturnValue(mockClient)

            // Create fresh service
            const testService = new EnhancedFriendsService()

            // Execute
            const roomId = await testService.sendFriendRequest(targetUserId, message)

            // Verify: Room ID was returned
            expect(typeof roomId).toBe('string')
            expect(roomId.length).toBeGreaterThan(0)

            // Verify: createRoom was called with target user
            expect(mockClient.createRoom).toHaveBeenCalledWith(
              expect.objectContaining({
                invite: [targetUserId]
              })
            )

            return true
          }
        ),
        { numRuns: 50 }
      )
    })
  })

  /**
   * Property-Based Test: Presence Sync
   * **Feature: sdk-integration-audit, Property 6: Presence Sync**
   * **Validates: Requirements 3.4**
   *
   * *For any* friend in the friends list, the service SHALL attempt to fetch
   * and include presence status (online/offline/unavailable).
   */
  describe('Property 6: Presence Sync', () => {
    it('should sync presence for all friends', async () => {
      // Setup: Friends with various presence states
      const friends: Friend[] = [
        { userId: '@alice:matrix.org', presence: 'offline' },
        { userId: '@bob:matrix.org', presence: 'offline' },
        { userId: '@charlie:matrix.org', presence: 'offline' }
      ]

      const presenceMap: Record<string, string> = {
        '@alice:matrix.org': 'online',
        '@bob:matrix.org': 'unavailable',
        '@charlie:matrix.org': 'offline'
      }

      const mockClient = {
        getUser: vi.fn().mockImplementation((userId: string) => ({
          presence: presenceMap[userId] || 'offline'
        }))
      }

      matrixClientService.getClient.mockReturnValue(mockClient)

      // Execute
      const updatedFriends = await service.syncPresenceForFriends(friends)

      // Verify: All friends have presence synced
      expect(updatedFriends).toHaveLength(3)
      expect(updatedFriends.find((f) => f.userId === '@alice:matrix.org')?.presence).toBe('online')
      expect(updatedFriends.find((f) => f.userId === '@bob:matrix.org')?.presence).toBe('unavailable')
      expect(updatedFriends.find((f) => f.userId === '@charlie:matrix.org')?.presence).toBe('offline')
    })

    it('should handle presence fetch failures gracefully', async () => {
      // Setup: Friends list
      const friends: Friend[] = [
        { userId: '@alice:matrix.org', presence: 'offline' },
        { userId: '@bob:matrix.org', presence: 'online' }
      ]

      const mockClient = {
        getUser: vi.fn().mockImplementation(() => {
          throw new Error('Presence fetch failed')
        })
      }

      matrixClientService.getClient.mockReturnValue(mockClient)

      // Execute - should not throw
      const updatedFriends = await service.syncPresenceForFriends(friends)

      // Verify: Friends are returned with original presence
      expect(updatedFriends).toHaveLength(2)
      expect(updatedFriends[0].presence).toBe('offline')
      expect(updatedFriends[1].presence).toBe('online')
    })

    it('should return original friends when client is not initialized', async () => {
      const friends: Friend[] = [{ userId: '@alice:matrix.org', presence: 'offline' }]

      matrixClientService.getClient.mockReturnValue(null)

      const updatedFriends = await service.syncPresenceForFriends(friends)

      expect(updatedFriends).toEqual(friends)
    })

    it('should sync presence for any number of friends', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate array of friends
          fc.array(
            fc.record({
              userId: fc
                .tuple(
                  fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-z0-9]+$/i.test(s)),
                  fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-z0-9.]+$/i.test(s))
                )
                .map(([local, domain]) => `@${local}:${domain}`),
              presence: fc.constantFrom('online', 'offline', 'unavailable') as fc.Arbitrary<
                'online' | 'offline' | 'unavailable'
              >
            }),
            { minLength: 0, maxLength: 20 }
          ),
          async (friends) => {
            // Setup
            const mockClient = {
              getUser: vi.fn().mockImplementation(() => ({
                presence: 'online'
              }))
            }

            matrixClientService.getClient.mockReturnValue(mockClient)

            // Create fresh service
            const testService = new EnhancedFriendsService()

            // Execute
            const updatedFriends = await testService.syncPresenceForFriends(friends)

            // Verify: Same number of friends returned
            expect(updatedFriends).toHaveLength(friends.length)

            // Verify: All friends have valid presence
            for (const friend of updatedFriends) {
              expect(['online', 'offline', 'unavailable']).toContain(friend.presence)
            }

            return true
          }
        ),
        { numRuns: 50 }
      )
    })

    it('should get presence for single user', async () => {
      const mockClient = {
        getUser: vi.fn().mockReturnValue({ presence: 'online' })
      }

      matrixClientService.getClient.mockReturnValue(mockClient)

      const presence = await service.getPresence('@alice:matrix.org')

      expect(presence).toBe('online')
    })

    it('should return offline when user presence is not available', async () => {
      const mockClient = {
        getUser: vi.fn().mockReturnValue(null)
      }

      matrixClientService.getClient.mockReturnValue(mockClient)

      const presence = await service.getPresence('@alice:matrix.org')

      expect(presence).toBe('offline')
    })
  })

  /**
   * Property-Based Test: Friend Request Lifecycle
   * **Feature: admin-module-optimization, Property 2: Friend Request Lifecycle**
   * **Validates: Requirements 2.2, 2.3, 2.4**
   *
   * *For any* friend request operation (send, accept, reject, remove),
   * the Friends_Service SHALL create/update direct rooms and m.direct account data correctly.
   */
  describe('Property 2: Friend Request Lifecycle', () => {
    /**
     * Property: For any valid user ID and optional message, sending a friend request
     * SHALL create a direct room with is_direct=true and update m.direct account data.
     */
    it('should create direct room and update m.direct for any valid friend request', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate valid Matrix user IDs
          fc
            .tuple(
              fc.string({ minLength: 1, maxLength: 15 }).filter((s) => /^[a-z0-9._=-]+$/i.test(s)),
              fc.string({ minLength: 1, maxLength: 30 }).filter((s) => /^[a-z0-9.-]+$/i.test(s))
            )
            .map(([local, domain]) => `@${local}:${domain}`),
          // Generate optional message
          fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
          async (targetUserId, message) => {
            // Setup: Track m.direct state
            let mDirectState: Record<string, string[]> = {}
            const createdRoomId = `!room_${Date.now()}_${Math.random().toString(36).slice(2)}:matrix.org`

            const mockClient = {
              createRoom: vi.fn().mockResolvedValue({ room_id: createdRoomId }),
              getAccountData: vi.fn().mockReturnValue({
                getContent: () => ({ ...mDirectState })
              }),
              setAccountData: vi.fn().mockImplementation((_type: string, data: Record<string, string[]>) => {
                mDirectState = { ...data }
                return Promise.resolve()
              }),
              sendEvent: vi.fn().mockResolvedValue({ event_id: '$event123' }),
              getUserId: vi.fn().mockReturnValue('@me:matrix.org')
            }

            matrixClientService.getClient.mockReturnValue(mockClient)

            // Create fresh service for this iteration
            const testService = new EnhancedFriendsService()

            // Execute: Send friend request
            const roomId = await testService.sendFriendRequest(targetUserId, message)

            // Property 1: Room ID should be returned
            expect(typeof roomId).toBe('string')
            expect(roomId.length).toBeGreaterThan(0)

            // Property 2: createRoom should be called with is_direct=true
            expect(mockClient.createRoom).toHaveBeenCalledWith(
              expect.objectContaining({
                is_direct: true,
                preset: 'trusted_private_chat',
                invite: [targetUserId]
              })
            )

            // Property 3: m.direct should be updated with the target user and room
            expect(mDirectState[targetUserId]).toBeDefined()
            expect(mDirectState[targetUserId]).toContain(createdRoomId)

            // Property 4: If message provided, sendEvent should be called
            if (message) {
              expect(mockClient.sendEvent).toHaveBeenCalledWith(
                createdRoomId,
                'm.room.message',
                expect.objectContaining({
                  msgtype: 'm.text',
                  body: message
                })
              )
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property: For any friend request acceptance, the service SHALL join the room
     * and update m.direct with the sender's user ID.
     */
    it('should join room and update m.direct for any accepted friend request', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate room ID
          fc
            .string({ minLength: 1, maxLength: 20 })
            .filter((s) => /^[a-z0-9]+$/i.test(s))
            .map((id) => `!${id}:matrix.org`),
          // Generate sender user ID
          fc
            .tuple(
              fc.string({ minLength: 1, maxLength: 15 }).filter((s) => /^[a-z0-9._=-]+$/i.test(s)),
              fc.string({ minLength: 1, maxLength: 30 }).filter((s) => /^[a-z0-9.-]+$/i.test(s))
            )
            .map(([local, domain]) => `@${local}:${domain}`),
          async (roomId, fromUserId) => {
            // Setup: Track m.direct state
            let mDirectState: Record<string, string[]> = {}

            const mockClient = {
              joinRoom: vi.fn().mockResolvedValue(undefined),
              getAccountData: vi.fn().mockReturnValue({
                getContent: () => ({ ...mDirectState })
              }),
              setAccountData: vi.fn().mockImplementation((_type: string, data: Record<string, string[]>) => {
                mDirectState = { ...data }
                return Promise.resolve()
              }),
              getUserId: vi.fn().mockReturnValue('@me:matrix.org')
            }

            matrixClientService.getClient.mockReturnValue(mockClient)

            // Create fresh service for this iteration
            const testService = new EnhancedFriendsService()

            // Execute: Accept friend request
            await testService.acceptFriendRequest(roomId, fromUserId)

            // Property 1: joinRoom should be called with the room ID
            expect(mockClient.joinRoom).toHaveBeenCalledWith(roomId)

            // Property 2: m.direct should be updated with the sender and room
            expect(mDirectState[fromUserId]).toBeDefined()
            expect(mDirectState[fromUserId]).toContain(roomId)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property: For any friend request rejection, the service SHALL leave the room.
     */
    it('should leave room for any rejected friend request', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate room ID
          fc
            .string({ minLength: 1, maxLength: 20 })
            .filter((s) => /^[a-z0-9]+$/i.test(s))
            .map((id) => `!${id}:matrix.org`),
          async (roomId) => {
            // Setup
            const mockClient = {
              leave: vi.fn().mockResolvedValue(undefined),
              getUserId: vi.fn().mockReturnValue('@me:matrix.org')
            }

            matrixClientService.getClient.mockReturnValue(mockClient)

            // Create fresh service for this iteration
            const testService = new EnhancedFriendsService()

            // Execute: Reject friend request
            await testService.rejectFriendRequest(roomId)

            // Property: leave should be called with the room ID
            expect(mockClient.leave).toHaveBeenCalledWith(roomId)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property: For any friend removal, the service SHALL leave the room
     * and remove the user from m.direct.
     */
    it('should leave room and remove from m.direct for any friend removal', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate user ID
          fc
            .tuple(
              fc.string({ minLength: 1, maxLength: 15 }).filter((s) => /^[a-z0-9._=-]+$/i.test(s)),
              fc.string({ minLength: 1, maxLength: 30 }).filter((s) => /^[a-z0-9.-]+$/i.test(s))
            )
            .map(([local, domain]) => `@${local}:${domain}`),
          // Generate room ID
          fc
            .string({ minLength: 1, maxLength: 20 })
            .filter((s) => /^[a-z0-9]+$/i.test(s))
            .map((id) => `!${id}:matrix.org`),
          async (userId, roomId) => {
            // Setup: Initial m.direct state with the friend
            let mDirectState: Record<string, string[]> = {
              [userId]: [roomId]
            }

            const mockClient = {
              leave: vi.fn().mockResolvedValue(undefined),
              getAccountData: vi.fn().mockReturnValue({
                getContent: () => ({ ...mDirectState })
              }),
              setAccountData: vi.fn().mockImplementation((_type: string, data: Record<string, string[]>) => {
                mDirectState = { ...data }
                return Promise.resolve()
              })
            }

            matrixClientService.getClient.mockReturnValue(mockClient)

            // Create fresh service for this iteration
            const testService = new EnhancedFriendsService()

            // Execute: Remove friend
            await testService.removeFriend(userId, roomId)

            // Property 1: leave should be called with the room ID
            expect(mockClient.leave).toHaveBeenCalledWith(roomId)

            // Property 2: m.direct should no longer contain the user (or the room)
            // Either the user is removed entirely, or the room is removed from their list
            if (mDirectState[userId]) {
              expect(mDirectState[userId]).not.toContain(roomId)
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property: Friend request lifecycle should be consistent -
     * send then remove should result in clean m.direct state.
     */
    it('should maintain consistent m.direct state through send-remove lifecycle', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate target user ID
          fc
            .tuple(
              fc.string({ minLength: 1, maxLength: 15 }).filter((s) => /^[a-z0-9._=-]+$/i.test(s)),
              fc.string({ minLength: 1, maxLength: 30 }).filter((s) => /^[a-z0-9.-]+$/i.test(s))
            )
            .map(([local, domain]) => `@${local}:${domain}`),
          async (targetUserId) => {
            // Setup: Track m.direct state
            let mDirectState: Record<string, string[]> = {}
            const createdRoomId = `!room_${Date.now()}_${Math.random().toString(36).slice(2)}:matrix.org`

            const mockClient = {
              createRoom: vi.fn().mockResolvedValue({ room_id: createdRoomId }),
              leave: vi.fn().mockResolvedValue(undefined),
              getAccountData: vi.fn().mockReturnValue({
                getContent: () => ({ ...mDirectState })
              }),
              setAccountData: vi.fn().mockImplementation((_type: string, data: Record<string, string[]>) => {
                mDirectState = { ...data }
                return Promise.resolve()
              }),
              sendEvent: vi.fn().mockResolvedValue({ event_id: '$event123' }),
              getUserId: vi.fn().mockReturnValue('@me:matrix.org')
            }

            matrixClientService.getClient.mockReturnValue(mockClient)

            // Create fresh service for this iteration
            const testService = new EnhancedFriendsService()

            // Step 1: Send friend request
            const roomId = await testService.sendFriendRequest(targetUserId)

            // Verify: m.direct contains the user
            expect(mDirectState[targetUserId]).toBeDefined()
            expect(mDirectState[targetUserId]).toContain(roomId)

            // Step 2: Remove friend
            await testService.removeFriend(targetUserId, roomId)

            // Property: After removal, m.direct should not contain the user
            // (assuming this was their only room)
            expect(mDirectState[targetUserId]).toBeUndefined()

            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property-Based Test: Synapse API Fallback
   * **Feature: sdk-backend-integration, Property 3: Synapse API Fallback**
   * **Validates: Requirements 3.1, 3.2**
   *
   * *For any* friends operation, when Synapse extension API fails (404, timeout),
   * the service should automatically fallback to m.direct account data and return valid results.
   */
  describe('Property 3: Synapse API Fallback', () => {
    /**
     * Property: For any m.direct data structure with valid user IDs and room IDs,
     * listFriends SHALL return a Friend object for each user entry without throwing.
     */
    it('should return friends from m.direct for any valid m.direct structure', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate m.direct-like data with valid Matrix IDs
          fc.array(
            fc.tuple(
              // Generate valid Matrix user ID
              fc
                .tuple(
                  fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-z0-9._=-]+$/i.test(s)),
                  fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-z0-9.-]+$/i.test(s))
                )
                .map(([local, domain]) => `@${local}:${domain}`),
              // Generate array of valid room IDs
              fc.array(
                fc
                  .string({ minLength: 1, maxLength: 15 })
                  .filter((s) => /^[a-z0-9]+$/i.test(s))
                  .map((id) => `!${id}:matrix.org`),
                { minLength: 1, maxLength: 3 }
              )
            ),
            { minLength: 0, maxLength: 10 }
          ),
          async (mDirectEntries) => {
            // Build m.direct object from entries
            const mDirectData: Record<string, string[]> = {}
            for (const [userId, roomIds] of mDirectEntries) {
              mDirectData[userId] = roomIds
            }

            // Setup: Synapse API throws error (unavailable)
            synapseApi.listFriends.mockRejectedValue(new Error('Synapse unavailable'))

            const mockClient = {
              getAccountData: vi.fn().mockReturnValue({
                getContent: () => mDirectData
              }),
              getProfileInfo: vi.fn().mockResolvedValue({
                displayname: 'Test User',
                avatar_url: 'mxc://test/avatar'
              }),
              getUser: vi.fn().mockReturnValue({
                presence: 'online'
              })
            }

            matrixClientService.getClient.mockReturnValue(mockClient)

            // Create fresh service for this iteration
            const testService = new EnhancedFriendsService()

            // Execute - should not throw
            const friends = await testService.listFriends()

            // Property 1: Should return array without throwing
            expect(Array.isArray(friends)).toBe(true)

            // Property 2: Number of friends should match number of m.direct entries
            expect(friends.length).toBe(mDirectEntries.length)

            // Property 3: Each friend should have required fields
            for (const friend of friends) {
              expect(typeof friend.userId).toBe('string')
              expect(friend.userId.startsWith('@')).toBe(true)
              expect(['online', 'offline', 'unavailable']).toContain(friend.presence)
            }

            // Property 4: All user IDs from m.direct should be in friends list
            const friendUserIds = friends.map((f) => f.userId)
            for (const [userId] of mDirectEntries) {
              expect(friendUserIds).toContain(userId)
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property: For any m.direct data, the service SHALL detect existing direct rooms
     * and include the first room ID in the Friend object.
     * Validates: Requirement 3.4
     */
    it('should detect existing direct rooms as friend relationships', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate user ID and multiple room IDs
          fc.tuple(
            fc
              .tuple(
                fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-z0-9._=-]+$/i.test(s)),
                fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-z0-9.-]+$/i.test(s))
              )
              .map(([local, domain]) => `@${local}:${domain}`),
            fc.array(
              fc
                .string({ minLength: 1, maxLength: 15 })
                .filter((s) => /^[a-z0-9]+$/i.test(s))
                .map((id) => `!${id}:matrix.org`),
              { minLength: 1, maxLength: 5 }
            )
          ),
          async ([userId, roomIds]) => {
            // Setup: m.direct with user having multiple rooms
            const mDirectData: Record<string, string[]> = {
              [userId]: roomIds
            }

            synapseApi.listFriends.mockRejectedValue(new Error('Synapse unavailable'))

            const mockClient = {
              getAccountData: vi.fn().mockReturnValue({
                getContent: () => mDirectData
              }),
              getProfileInfo: vi.fn().mockResolvedValue({}),
              getUser: vi.fn().mockReturnValue(null)
            }

            matrixClientService.getClient.mockReturnValue(mockClient)

            const testService = new EnhancedFriendsService()
            const friends = await testService.listFriends()

            // Property: Friend should have the first room ID from m.direct
            expect(friends.length).toBe(1)
            expect(friends[0].userId).toBe(userId)
            expect(friends[0].roomId).toBe(roomIds[0])

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property: The service SHALL handle both Synapse and standard Matrix servers seamlessly.
     * When Synapse fails, it should transparently fallback to m.direct without user intervention.
     * Validates: Requirement 3.5
     */
    it('should handle Synapse failure and m.direct seamlessly', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate m.direct data
          fc.array(
            fc.tuple(
              fc
                .tuple(
                  fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-z0-9._=-]+$/i.test(s)),
                  fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-z0-9.-]+$/i.test(s))
                )
                .map(([local, domain]) => `@${local}:${domain}`),
              fc.array(
                fc
                  .string({ minLength: 1, maxLength: 15 })
                  .filter((s) => /^[a-z0-9]+$/i.test(s))
                  .map((id) => `!${id}:matrix.org`),
                { minLength: 1, maxLength: 2 }
              )
            ),
            { minLength: 1, maxLength: 5 }
          ),
          // Generate different Synapse error types
          fc.constantFrom(
            new Error('Synapse unavailable'),
            new Error('Network error'),
            new Error('404 Not Found'),
            new Error('Connection refused')
          ),
          async (mDirectEntries, synapseError) => {
            // Build m.direct object
            const mDirectData: Record<string, string[]> = {}
            for (const [userId, roomIds] of mDirectEntries) {
              mDirectData[userId] = roomIds
            }

            // Setup: Synapse API throws various errors
            synapseApi.listFriends.mockRejectedValue(synapseError)

            const mockClient = {
              getAccountData: vi.fn().mockReturnValue({
                getContent: () => mDirectData
              }),
              getProfileInfo: vi.fn().mockResolvedValue({}),
              getUser: vi.fn().mockReturnValue({ presence: 'offline' })
            }

            matrixClientService.getClient.mockReturnValue(mockClient)

            const testService = new EnhancedFriendsService()

            // Execute - should not throw regardless of Synapse error type
            const friends = await testService.listFriends()

            // Property 1: Should return friends from m.direct without throwing
            expect(Array.isArray(friends)).toBe(true)
            // Service deduplicates users, so check against unique user IDs
            const uniqueUserIds = new Set(mDirectEntries.map(([userId]) => userId))
            expect(friends.length).toBe(uniqueUserIds.size)

            // Property 2: Service should have switched to m.direct mode
            expect(testService.isSynapseExtensionAvailable()).toBe(false)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property: For any empty or malformed m.direct entries, the service SHALL
     * gracefully skip them without throwing.
     */
    it('should handle empty or malformed m.direct entries gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate mix of valid and invalid m.direct entries
          fc.record({
            // Valid entry
            validUser: fc.tuple(
              fc
                .tuple(
                  fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-z0-9._=-]+$/i.test(s)),
                  fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-z0-9.-]+$/i.test(s))
                )
                .map(([local, domain]) => `@${local}:${domain}`),
              fc.array(
                fc
                  .string({ minLength: 1, maxLength: 15 })
                  .filter((s) => /^[a-z0-9]+$/i.test(s))
                  .map((id) => `!${id}:matrix.org`),
                { minLength: 1, maxLength: 2 }
              )
            ),
            // Empty array entry
            emptyArrayUser: fc
              .tuple(
                fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-z0-9._=-]+$/i.test(s)),
                fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-z0-9.-]+$/i.test(s))
              )
              .map(([local, domain]) => `@${local}:${domain}`)
          }),
          async ({ validUser, emptyArrayUser }) => {
            const [validUserId, validRoomIds] = validUser

            // Build m.direct with mix of valid and empty entries
            const mDirectData: Record<string, string[]> = {
              [validUserId]: validRoomIds,
              [emptyArrayUser]: [] // Empty array - should be skipped
            }

            synapseApi.listFriends.mockRejectedValue(new Error('Synapse unavailable'))

            const mockClient = {
              getAccountData: vi.fn().mockReturnValue({
                getContent: () => mDirectData
              }),
              getProfileInfo: vi.fn().mockResolvedValue({}),
              getUser: vi.fn().mockReturnValue(null)
            }

            matrixClientService.getClient.mockReturnValue(mockClient)

            const testService = new EnhancedFriendsService()
            const friends = await testService.listFriends()

            // Property: Only valid entries should be returned
            expect(friends.length).toBe(1)
            expect(friends[0].userId).toBe(validUserId)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property: listFriendsFromMDirect should be directly callable and return
     * consistent results with listFriends when Synapse is unavailable.
     */
    it('should have consistent results between listFriends and listFriendsFromMDirect', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate m.direct data
          fc.array(
            fc.tuple(
              fc
                .tuple(
                  fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-z0-9._=-]+$/i.test(s)),
                  fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-z0-9.-]+$/i.test(s))
                )
                .map(([local, domain]) => `@${local}:${domain}`),
              fc.array(
                fc
                  .string({ minLength: 1, maxLength: 15 })
                  .filter((s) => /^[a-z0-9]+$/i.test(s))
                  .map((id) => `!${id}:matrix.org`),
                { minLength: 1, maxLength: 2 }
              )
            ),
            { minLength: 0, maxLength: 5 }
          ),
          async (mDirectEntries) => {
            // Build m.direct object
            const mDirectData: Record<string, string[]> = {}
            for (const [userId, roomIds] of mDirectEntries) {
              mDirectData[userId] = roomIds
            }

            synapseApi.listFriends.mockRejectedValue(new Error('Synapse unavailable'))

            const mockClient = {
              getAccountData: vi.fn().mockReturnValue({
                getContent: () => mDirectData
              }),
              getProfileInfo: vi.fn().mockResolvedValue({}),
              getUser: vi.fn().mockReturnValue(null)
            }

            matrixClientService.getClient.mockReturnValue(mockClient)

            const testService = new EnhancedFriendsService()

            // Call both methods
            const friendsFromList = await testService.listFriends()
            const friendsFromMDirect = await testService.listFriendsFromMDirect()

            // Property: Both should return same number of friends
            expect(friendsFromList.length).toBe(friendsFromMDirect.length)

            // Property: Both should have same user IDs
            const listUserIds = friendsFromList.map((f) => f.userId).sort()
            const mDirectUserIds = friendsFromMDirect.map((f) => f.userId).sort()
            expect(listUserIds).toEqual(mDirectUserIds)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property-Based Test: Presence Handling
   * **Feature: admin-module-optimization, Property 4: Presence Handling**
   * **Validates: Requirements 4.1, 4.3, 4.4**
   *
   * *For any* friend in the friends list, the Friends_Service SHALL subscribe to presence events,
   * cache presence status, and handle unavailable presence gracefully.
   */
  describe('Property 4: Presence Handling', () => {
    /**
     * Property: For any friend, the service SHALL subscribe to presence events.
     * Validates: Requirement 4.1
     */
    it('should subscribe to presence events after initialization', async () => {
      // Setup: Mock client with on method
      const mockClient = {
        on: vi.fn(),
        off: vi.fn()
      }
      matrixClientService.getClient.mockReturnValue(mockClient)
      synapseApi.listFriends.mockResolvedValue({ friends: [] })

      // Execute: Initialize service
      await service.initialize()

      // SDK Integration: Service now subscribes to 'Presence' events (not 'User.presence')
      expect(mockClient.on).toHaveBeenCalledWith('Presence', expect.any(Function))
      expect(service.isPresenceSubscribed()).toBe(true)
    })

    /**
     * Property: For any presence event received, the service SHALL cache the presence status.
     * Validates: Requirement 4.4
     */
    it('should cache presence status for any presence event', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate valid Matrix user ID
          fc
            .tuple(
              fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-z0-9._=-]+$/i.test(s)),
              fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-z0-9.-]+$/i.test(s))
            )
            .map(([local, domain]) => `@${local}:${domain}`),
          // Generate presence state
          fc.constantFrom('online' as const, 'offline' as const, 'unavailable' as const, 'away' as const),
          // Generate optional lastActiveAgo
          fc.option(fc.integer({ min: 0, max: 3600000 }), { nil: undefined }),
          async (userId, presence, lastActiveAgo) => {
            // Setup: Mock client with presence handler (SDK Integration: Uses 'Presence' event)
            let presenceHandler: ((event: unknown) => void) | null = null
            const mockClient = {
              on: vi.fn().mockImplementation((event: string, handler: (event: unknown) => void) => {
                // SDK Integration: Changed from 'User.presence' to 'Presence'
                if (event === 'Presence') {
                  presenceHandler = handler
                }
              }),
              off: vi.fn()
            }
            matrixClientService.getClient.mockReturnValue(mockClient)
            synapseApi.listFriends.mockResolvedValue({ friends: [] })

            // Create fresh service
            const testService = new EnhancedFriendsService()
            await testService.initialize()

            // Simulate presence event (SDK Integration: Use MatrixEvent format)
            if (presenceHandler) {
              ;(presenceHandler as (event: unknown) => void)({
                getSender: () => userId,
                getContent: () => ({ presence, last_active_ago: lastActiveAgo })
              })
            }

            // Property: Presence should be cached
            const cached = testService.getCachedPresence(userId)
            expect(cached).toBeDefined()
            expect(cached?.presence).toBe(presence === 'away' ? 'away' : presence)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property: For any friend, enrichWithPresence SHALL use cached presence when available.
     * Validates: Requirement 4.4
     */
    it('should use cached presence when enriching friends list', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate array of friends
          fc.array(
            fc.tuple(
              fc
                .tuple(
                  fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-z0-9._=-]+$/i.test(s)),
                  fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-z0-9.-]+$/i.test(s))
                )
                .map(([local, domain]) => `@${local}:${domain}`),
              fc.constantFrom('online' as const, 'offline' as const, 'unavailable' as const, 'away' as const)
            ),
            { minLength: 1, maxLength: 10 }
          ),
          async (friendsData) => {
            // Setup: Mock client with presence handler (SDK Integration: Uses 'Presence' event)
            let presenceHandler: ((event: unknown) => void) | null = null
            const mockClient = {
              on: vi.fn().mockImplementation((event: string, handler: (event: unknown) => void) => {
                // SDK Integration: Changed from 'User.presence' to 'Presence'
                if (event === 'Presence') {
                  presenceHandler = handler
                }
              }),
              off: vi.fn(),
              getUser: vi.fn().mockReturnValue(null) // Return null to force cache usage
            }
            matrixClientService.getClient.mockReturnValue(mockClient)
            synapseApi.listFriends.mockResolvedValue({ friends: [] })

            // Create fresh service and initialize
            const testService = new EnhancedFriendsService()
            await testService.initialize()

            // Simulate presence events to populate cache (SDK Integration: Use MatrixEvent format)
            for (const [userId, presence] of friendsData) {
              if (presenceHandler) {
                ;(presenceHandler as (event: unknown) => void)({
                  getSender: () => userId,
                  getContent: () => ({ presence, last_active_ago: 1000 })
                })
              }
            }

            // Create friends list
            const friends: Friend[] = friendsData.map(([userId]) => ({
              userId,
              presence: 'offline' as const // Start with offline
            }))

            // Execute: Enrich with presence
            await testService.enrichWithPresence(friends)

            // Property: Each friend should have presence from cache
            for (let i = 0; i < friends.length; i++) {
              const expectedPresence = friendsData[i][1]
              expect(friends[i].presence).toBe(expectedPresence)
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property: For any presence fetch failure, the service SHALL handle it gracefully
     * without throwing and preserve the original presence state.
     * Validates: Requirement 4.3
     */
    it('should handle presence unavailable gracefully for any friend', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate array of friends with initial presence
          fc.array(
            fc.record({
              userId: fc
                .tuple(
                  fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-z0-9._=-]+$/i.test(s)),
                  fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-z0-9.-]+$/i.test(s))
                )
                .map(([local, domain]) => `@${local}:${domain}`),
              presence: fc.constantFrom('online' as const, 'offline' as const, 'unavailable' as const, 'away' as const)
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (friendsData) => {
            // Setup: Mock client that throws on getUser
            const mockClient = {
              on: vi.fn(),
              off: vi.fn(),
              getUser: vi.fn().mockImplementation(() => {
                throw new Error('Presence unavailable')
              })
            }
            matrixClientService.getClient.mockReturnValue(mockClient)

            // Create fresh service
            const testService = new EnhancedFriendsService()

            // Create friends list with initial presence
            const friends: Friend[] = friendsData.map((f) => ({
              userId: f.userId,
              presence: f.presence
            }))

            // Store original presence values
            const originalPresence = friends.map((f) => f.presence)

            // Execute: Enrich with presence - should not throw
            await testService.enrichWithPresence(friends)

            // Property 1: Should not throw
            // (If we got here, it didn't throw)

            // Property 2: Original presence should be preserved when fetch fails
            for (let i = 0; i < friends.length; i++) {
              expect(friends[i].presence).toBe(originalPresence[i])
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property: For any user ID, getPresence SHALL return cached value if available and not expired.
     * Validates: Requirement 4.4
     */
    it('should return cached presence for any user when cache is valid', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate valid Matrix user ID
          fc
            .tuple(
              fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-z0-9._=-]+$/i.test(s)),
              fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-z0-9.-]+$/i.test(s))
            )
            .map(([local, domain]) => `@${local}:${domain}`),
          // Generate presence state
          fc.constantFrom('online' as const, 'offline' as const, 'unavailable' as const, 'away' as const),
          async (userId, cachedPresence) => {
            // Setup: Mock client with presence handler (SDK Integration: Uses 'Presence' event)
            let presenceHandler: ((event: unknown) => void) | null = null
            const mockClient = {
              on: vi.fn().mockImplementation((event: string, handler: (event: unknown) => void) => {
                // SDK Integration: Changed from 'User.presence' to 'Presence'
                if (event === 'Presence') {
                  presenceHandler = handler
                }
              }),
              off: vi.fn(),
              getUser: vi.fn().mockReturnValue({ presence: 'offline' }) // Different from cached
            }
            matrixClientService.getClient.mockReturnValue(mockClient)
            synapseApi.listFriends.mockResolvedValue({ friends: [] })

            // Create fresh service and initialize
            const testService = new EnhancedFriendsService()
            await testService.initialize()

            // Simulate presence event to populate cache (SDK Integration: Use MatrixEvent format)
            if (presenceHandler) {
              ;(presenceHandler as (event: unknown) => void)({
                getSender: () => userId,
                getContent: () => ({ presence: cachedPresence, last_active_ago: 0 })
              })
            }

            // Execute: Get presence
            const presence = await testService.getPresence(userId)

            // Property: Should return cached presence, not the one from getUser
            expect(presence).toBe(cachedPresence)

            // Verify: getUser should not have been called (cache hit)
            expect(mockClient.getUser).not.toHaveBeenCalled()

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property: Presence listeners SHALL be notified for any presence update.
     * Validates: Requirement 4.1 (subscription implies notification)
     */
    it('should notify listeners for any presence update', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate valid Matrix user ID
          fc
            .tuple(
              fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-z0-9._=-]+$/i.test(s)),
              fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-z0-9.-]+$/i.test(s))
            )
            .map(([local, domain]) => `@${local}:${domain}`),
          // Generate presence state
          fc.constantFrom('online' as const, 'offline' as const, 'unavailable' as const, 'away' as const),
          async (userId, presence) => {
            // Setup: Mock client with presence handler (SDK Integration: Uses 'Presence' event)
            let presenceHandler: ((event: unknown) => void) | null = null
            const mockClient = {
              on: vi.fn().mockImplementation((event: string, handler: (event: unknown) => void) => {
                // SDK Integration: Changed from 'User.presence' to 'Presence'
                if (event === 'Presence') {
                  presenceHandler = handler
                }
              }),
              off: vi.fn()
            }
            matrixClientService.getClient.mockReturnValue(mockClient)
            synapseApi.listFriends.mockResolvedValue({ friends: [] })

            // Create fresh service and initialize
            const testService = new EnhancedFriendsService()
            await testService.initialize()

            // Setup: Add listener
            const receivedEvents: Array<{ userId: string; presence: string }> = []
            const listener = (event: { userId: string; presence: string }) => {
              receivedEvents.push(event)
            }
            testService.onPresenceUpdate(listener)

            // Simulate presence event (SDK Integration: Use MatrixEvent format)
            if (presenceHandler) {
              ;(presenceHandler as (event: unknown) => void)({
                getSender: () => userId,
                getContent: () => ({ presence, last_active_ago: 0 })
              })
            }

            // Property: Listener should have been notified
            expect(receivedEvents.length).toBe(1)
            expect(receivedEvents[0].userId).toBe(userId)
            expect(receivedEvents[0].presence).toBe(presence)

            // Cleanup
            testService.offPresenceUpdate(listener)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property: clearPresenceCache SHALL remove all cached presence data.
     * Validates: Requirement 4.4 (cache management)
     */
    it('should clear all cached presence data', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate multiple user IDs with presence
          fc.array(
            fc.tuple(
              fc
                .tuple(
                  fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-z0-9._=-]+$/i.test(s)),
                  fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-z0-9.-]+$/i.test(s))
                )
                .map(([local, domain]) => `@${local}:${domain}`),
              fc.constantFrom('online' as const, 'offline' as const, 'unavailable' as const, 'away' as const)
            ),
            { minLength: 1, maxLength: 10 }
          ),
          async (usersData) => {
            // Setup: Mock client with presence handler (SDK Integration: Uses 'Presence' event)
            let presenceHandler: ((event: unknown) => void) | null = null
            const mockClient = {
              on: vi.fn().mockImplementation((event: string, handler: (event: unknown) => void) => {
                // SDK Integration: Changed from 'User.presence' to 'Presence'
                if (event === 'Presence') {
                  presenceHandler = handler
                }
              }),
              off: vi.fn()
            }
            matrixClientService.getClient.mockReturnValue(mockClient)
            synapseApi.listFriends.mockResolvedValue({ friends: [] })

            // Create fresh service and initialize
            const testService = new EnhancedFriendsService()
            await testService.initialize()

            // Populate cache with presence events (SDK Integration: Use MatrixEvent format)
            for (const [userId, presence] of usersData) {
              if (presenceHandler) {
                // SDK's Presence event format: event with getSender() and getContent()
                ;(presenceHandler as (event: unknown) => void)({
                  getSender: () => userId,
                  getContent: () => ({ presence, last_active_ago: 0 })
                })
              }
            }

            // Verify cache is populated
            for (const [userId] of usersData) {
              expect(testService.getCachedPresence(userId)).toBeDefined()
            }

            // Execute: Clear cache
            testService.clearPresenceCache()

            // Property: All cached presence should be cleared
            for (const [userId] of usersData) {
              expect(testService.getCachedPresence(userId)).toBeUndefined()
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property: For any null/undefined user in presence event, the service SHALL handle gracefully.
     * Validates: Requirement 4.3
     */
    it('should handle malformed presence events gracefully', async () => {
      // Setup: Mock client with presence handler (SDK Integration: Uses 'Presence' event)
      let presenceHandler: ((event: unknown) => void) | undefined
      const mockClient = {
        on: vi.fn().mockImplementation((event: string, handler: (event: unknown) => void) => {
          // SDK Integration: Changed from 'User.presence' to 'Presence'
          if (event === 'Presence') {
            presenceHandler = handler
          }
        }),
        off: vi.fn()
      }
      matrixClientService.getClient.mockReturnValue(mockClient)
      synapseApi.listFriends.mockResolvedValue({ friends: [] })

      await service.initialize()

      // Execute: Send malformed events - should not throw
      expect(presenceHandler).toBeDefined()
      const handler = presenceHandler!
      // SDK Integration: Events only have one parameter (event), not two (event, user)
      // Event without getSender
      expect(() => handler({})).not.toThrow()
      // Event with null getSender
      expect(() => handler({ getSender: () => null })).not.toThrow()
      // Event with undefined getContent
      expect(() => handler({ getSender: () => '@user:server', getContent: () => undefined })).not.toThrow()
      // Event without presence
      expect(() => handler({ getSender: () => '@user:server', getContent: () => ({}) })).not.toThrow()
    })
  })

  /**
   * Additional unit tests
   */
  describe('Accept/Reject Friend Request', () => {
    it('should accept friend request by joining room and updating m.direct', async () => {
      const roomId = '!room:matrix.org'
      const fromUserId = '@sender:matrix.org'

      const mockClient = {
        joinRoom: vi.fn().mockResolvedValue(undefined),
        getAccountData: vi.fn().mockReturnValue({
          getContent: () => ({})
        }),
        setAccountData: vi.fn().mockResolvedValue(undefined)
      }

      matrixClientService.getClient.mockReturnValue(mockClient)

      await service.acceptFriendRequest(roomId, fromUserId)

      expect(mockClient.joinRoom).toHaveBeenCalledWith(roomId)
      expect(mockClient.setAccountData).toHaveBeenCalledWith(
        'm.direct',
        expect.objectContaining({
          [fromUserId]: expect.arrayContaining([roomId])
        })
      )
    })

    it('should reject friend request by leaving room', async () => {
      const roomId = '!room:matrix.org'

      const mockClient = {
        leave: vi.fn().mockResolvedValue(undefined)
      }

      matrixClientService.getClient.mockReturnValue(mockClient)

      await service.rejectFriendRequest(roomId)

      expect(mockClient.leave).toHaveBeenCalledWith(roomId)
    })
  })

  describe('Synapse Availability', () => {
    it('should reset Synapse availability', () => {
      // Force Synapse to be unavailable
      service['useSynapseExtension'] = false
      service['synapseAvailabilityChecked'] = true

      // Reset
      service.resetSynapseAvailability()

      // Verify
      expect(service.isSynapseExtensionAvailable()).toBe(true)
    })
  })

  /**
   * Tests for initialize method
   * **Feature: admin-module-optimization, Property 1: Synapse API Priority**
   * **Validates: Requirements 2.1**
   */
  describe('Initialize', () => {
    it('should detect Synapse extension availability on initialize', async () => {
      // Setup: Synapse API returns data
      synapseApi.listFriends.mockResolvedValue({ friends: [] })

      // Execute
      await service.initialize()

      // Verify
      expect(service.isInitialized()).toBe(true)
      expect(service.isSynapseExtensionAvailable()).toBe(true)
    })

    it('should set useSynapseExtension to false when Synapse unavailable', async () => {
      // Setup: Synapse API throws error
      synapseApi.listFriends.mockRejectedValue(new Error('Synapse unavailable'))

      // Execute
      await service.initialize()

      // Verify
      expect(service.isInitialized()).toBe(true)
      expect(service.isSynapseExtensionAvailable()).toBe(false)
    })

    it('should not re-initialize if already initialized', async () => {
      // Setup: Synapse API returns data
      synapseApi.listFriends.mockResolvedValue({ friends: [] })

      // Execute: Initialize twice
      await service.initialize()
      await service.initialize()

      // Verify: listFriends should only be called once
      expect(synapseApi.listFriends).toHaveBeenCalledTimes(1)
    })
  })

  /**
   * Tests for removeFriend method
   * **Feature: admin-module-optimization, Property 2: Friend Request Lifecycle**
   * **Validates: Requirements 2.4**
   */
  describe('Remove Friend', () => {
    it('should leave room and remove from m.direct when removing friend', async () => {
      const userId = '@friend:matrix.org'
      const roomId = '!room:matrix.org'

      const mockClient = {
        leave: vi.fn().mockResolvedValue(undefined),
        getAccountData: vi.fn().mockReturnValue({
          getContent: () => ({
            [userId]: [roomId]
          })
        }),
        setAccountData: vi.fn().mockResolvedValue(undefined)
      }

      matrixClientService.getClient.mockReturnValue(mockClient)

      await service.removeFriend(userId, roomId)

      // Verify: Room was left
      expect(mockClient.leave).toHaveBeenCalledWith(roomId)

      // Verify: m.direct was updated (user removed)
      expect(mockClient.setAccountData).toHaveBeenCalledWith('m.direct', {})
    })

    it('should continue removing from m.direct even if leave fails', async () => {
      const userId = '@friend:matrix.org'
      const roomId = '!room:matrix.org'

      const mockClient = {
        leave: vi.fn().mockRejectedValue(new Error('Leave failed')),
        getAccountData: vi.fn().mockReturnValue({
          getContent: () => ({
            [userId]: [roomId]
          })
        }),
        setAccountData: vi.fn().mockResolvedValue(undefined)
      }

      matrixClientService.getClient.mockReturnValue(mockClient)

      // Should not throw
      await service.removeFriend(userId, roomId)

      // Verify: m.direct was still updated
      expect(mockClient.setAccountData).toHaveBeenCalled()
    })

    it('should throw error when client is not initialized', async () => {
      matrixClientService.getClient.mockReturnValue(null)

      await expect(service.removeFriend('@friend:matrix.org', '!room:matrix.org')).rejects.toThrow(
        'Matrix client not initialized'
      )
    })

    it('should keep other rooms when removing one room from m.direct', async () => {
      const userId = '@friend:matrix.org'
      const roomId1 = '!room1:matrix.org'
      const roomId2 = '!room2:matrix.org'

      const mockClient = {
        leave: vi.fn().mockResolvedValue(undefined),
        getAccountData: vi.fn().mockReturnValue({
          getContent: () => ({
            [userId]: [roomId1, roomId2]
          })
        }),
        setAccountData: vi.fn().mockResolvedValue(undefined)
      }

      matrixClientService.getClient.mockReturnValue(mockClient)

      await service.removeFriend(userId, roomId1)

      // Verify: Only roomId1 was removed, roomId2 remains
      expect(mockClient.setAccountData).toHaveBeenCalledWith('m.direct', {
        [userId]: [roomId2]
      })
    })
  })

  /**
   * Tests for enhanced acceptFriendRequest with Synapse integration
   */
  describe('Accept Friend Request with Synapse', () => {
    it('should call Synapse acceptRequest when requestId is provided', async () => {
      const roomId = '!room:matrix.org'
      const fromUserId = '@sender:matrix.org'
      const requestId = 'req_123'

      const mockClient = {
        joinRoom: vi.fn().mockResolvedValue(undefined),
        getAccountData: vi.fn().mockReturnValue({
          getContent: () => ({})
        }),
        setAccountData: vi.fn().mockResolvedValue(undefined),
        getUserId: vi.fn().mockReturnValue('@me:matrix.org')
      }

      matrixClientService.getClient.mockReturnValue(mockClient)
      synapseApi.acceptRequest.mockResolvedValue({})

      await service.acceptFriendRequest(roomId, fromUserId, requestId)

      // Verify: Synapse API was called
      expect(synapseApi.acceptRequest).toHaveBeenCalledWith({
        request_id: requestId,
        user_id: '@me:matrix.org',
        category_id: undefined
      })
    })

    it('should not call Synapse acceptRequest when requestId is not provided', async () => {
      const roomId = '!room:matrix.org'
      const fromUserId = '@sender:matrix.org'

      const mockClient = {
        joinRoom: vi.fn().mockResolvedValue(undefined),
        getAccountData: vi.fn().mockReturnValue({
          getContent: () => ({})
        }),
        setAccountData: vi.fn().mockResolvedValue(undefined)
      }

      matrixClientService.getClient.mockReturnValue(mockClient)

      await service.acceptFriendRequest(roomId, fromUserId)

      // Verify: Synapse API was not called
      expect(synapseApi.acceptRequest).not.toHaveBeenCalled()
    })
  })

  /**
   * Tests for enhanced rejectFriendRequest with Synapse integration
   */
  describe('Reject Friend Request with Synapse', () => {
    it('should call Synapse rejectRequest when requestId is provided', async () => {
      const roomId = '!room:matrix.org'
      const requestId = 'req_123'

      const mockClient = {
        leave: vi.fn().mockResolvedValue(undefined),
        getUserId: vi.fn().mockReturnValue('@me:matrix.org')
      }

      matrixClientService.getClient.mockReturnValue(mockClient)
      synapseApi.rejectRequest.mockResolvedValue({})

      await service.rejectFriendRequest(roomId, requestId)

      // Verify: Synapse API was called
      expect(synapseApi.rejectRequest).toHaveBeenCalledWith({
        request_id: requestId,
        user_id: '@me:matrix.org'
      })
    })

    it('should not call Synapse rejectRequest when requestId is not provided', async () => {
      const roomId = '!room:matrix.org'

      const mockClient = {
        leave: vi.fn().mockResolvedValue(undefined)
      }

      matrixClientService.getClient.mockReturnValue(mockClient)

      await service.rejectFriendRequest(roomId)

      // Verify: Synapse API was not called
      expect(synapseApi.rejectRequest).not.toHaveBeenCalled()
    })
  })
})

/**
 * Tests for Friend Category Management
 * **Feature: sdk-backend-integration, Property 5: Category Deletion Cleanup**
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
 *
 * Tests:
 * - Category CRUD operations (create, rename, delete)
 * - Moving friends between categories
 * - Category deletion cleanup (friends moved to default/uncategorized)
 */
describe('Friend Category Management', () => {
  let matrixClientService: any
  let service: EnhancedFriendsService

  beforeEach(async () => {
    vi.clearAllMocks()

    // Get mocked modules
    const clientModule = await import('@/integrations/matrix/client')
    matrixClientService = clientModule.matrixClientService

    // Create fresh service instance for each test
    service = new EnhancedFriendsService()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  /**
   * Tests for listCategories
   * Validates: Requirement 5.1
   */
  describe('listCategories', () => {
    it('should return empty array when no categories exist', async () => {
      const mockClient = {
        getAccountData: vi.fn().mockReturnValue(null)
      }
      matrixClientService.getClient.mockReturnValue(mockClient)

      const categories = await service.listCategories()

      expect(categories).toEqual([])
    })

    it('should return categories from account data', async () => {
      const mockCategories = [
        { id: 'cat_1', name: '家人', order: 0 },
        { id: 'cat_2', name: '同事', order: 1 }
      ]

      const mockClient = {
        getAccountData: vi.fn().mockReturnValue({
          getContent: () => ({ categories: mockCategories })
        })
      }
      matrixClientService.getClient.mockReturnValue(mockClient)

      const categories = await service.listCategories()

      expect(categories).toEqual(mockCategories)
      expect(mockClient.getAccountData).toHaveBeenCalledWith('im.hula.friend_categories')
    })

    it('should return empty array when client is not initialized', async () => {
      matrixClientService.getClient.mockReturnValue(null)

      const categories = await service.listCategories()

      expect(categories).toEqual([])
    })
  })

  /**
   * Tests for createCategory
   * Validates: Requirement 5.1
   */
  describe('createCategory', () => {
    it('should create a new category', async () => {
      let savedCategories: any[] = []

      const mockClient = {
        getAccountData: vi.fn().mockReturnValue({
          getContent: () => ({ categories: [] })
        }),
        setAccountData: vi.fn().mockImplementation((_type: string, data: any) => {
          savedCategories = data.categories
          return Promise.resolve()
        })
      }
      matrixClientService.getClient.mockReturnValue(mockClient)

      const category = await service.createCategory('家人')

      expect(category.name).toBe('家人')
      expect(category.id).toMatch(/^cat_/)
      expect(category.order).toBe(0)
      expect(savedCategories).toHaveLength(1)
      expect(savedCategories[0].name).toBe('家人')
    })

    it('should return existing category if name already exists', async () => {
      const existingCategory = { id: 'cat_existing', name: '家人', order: 0 }

      const mockClient = {
        getAccountData: vi.fn().mockReturnValue({
          getContent: () => ({ categories: [existingCategory] })
        }),
        setAccountData: vi.fn()
      }
      matrixClientService.getClient.mockReturnValue(mockClient)

      const category = await service.createCategory('家人')

      expect(category).toEqual(existingCategory)
      expect(mockClient.setAccountData).not.toHaveBeenCalled()
    })

    it('should throw error when client is not initialized', async () => {
      matrixClientService.getClient.mockReturnValue(null)

      await expect(service.createCategory('家人')).rejects.toThrow('Matrix client not initialized')
    })

    it('should assign correct order to new category', async () => {
      const existingCategories = [
        { id: 'cat_1', name: '家人', order: 0 },
        { id: 'cat_2', name: '同事', order: 1 }
      ]

      let savedCategories: any[] = []

      const mockClient = {
        getAccountData: vi.fn().mockReturnValue({
          getContent: () => ({ categories: existingCategories })
        }),
        setAccountData: vi.fn().mockImplementation((_type: string, data: any) => {
          savedCategories = data.categories
          return Promise.resolve()
        })
      }
      matrixClientService.getClient.mockReturnValue(mockClient)

      const category = await service.createCategory('朋友')

      expect(category.order).toBe(2)
      expect(savedCategories).toHaveLength(3)
    })
  })

  /**
   * Tests for renameCategory
   * Validates: Requirement 5.3
   */
  describe('renameCategory', () => {
    it('should rename an existing category', async () => {
      const existingCategories = [{ id: 'cat_1', name: '家人', order: 0 }]
      let savedCategories: any[] = []

      const mockClient = {
        getAccountData: vi.fn().mockReturnValue({
          getContent: () => ({ categories: existingCategories })
        }),
        setAccountData: vi.fn().mockImplementation((_type: string, data: any) => {
          savedCategories = data.categories
          return Promise.resolve()
        })
      }
      matrixClientService.getClient.mockReturnValue(mockClient)

      await service.renameCategory('cat_1', '亲人')

      expect(savedCategories[0].name).toBe('亲人')
      expect(savedCategories[0].id).toBe('cat_1')
    })

    it('should throw error when category not found', async () => {
      const mockClient = {
        getAccountData: vi.fn().mockReturnValue({
          getContent: () => ({ categories: [] })
        })
      }
      matrixClientService.getClient.mockReturnValue(mockClient)

      await expect(service.renameCategory('cat_nonexistent', '新名称')).rejects.toThrow('Category not found')
    })

    it('should throw error when new name conflicts with existing category', async () => {
      const existingCategories = [
        { id: 'cat_1', name: '家人', order: 0 },
        { id: 'cat_2', name: '同事', order: 1 }
      ]

      const mockClient = {
        getAccountData: vi.fn().mockReturnValue({
          getContent: () => ({ categories: existingCategories })
        })
      }
      matrixClientService.getClient.mockReturnValue(mockClient)

      await expect(service.renameCategory('cat_1', '同事')).rejects.toThrow('already exists')
    })

    it('should throw error when client is not initialized', async () => {
      matrixClientService.getClient.mockReturnValue(null)

      await expect(service.renameCategory('cat_1', '新名称')).rejects.toThrow('Matrix client not initialized')
    })
  })

  /**
   * Tests for deleteCategory
   * Validates: Requirement 5.3
   */
  describe('deleteCategory', () => {
    it('should delete an existing category', async () => {
      const existingCategories = [
        { id: 'cat_1', name: '家人', order: 0 },
        { id: 'cat_2', name: '同事', order: 1 }
      ]
      let savedCategories: any[] = []

      const mockClient = {
        getAccountData: vi.fn().mockReturnValue({
          getContent: () => ({ categories: existingCategories })
        }),
        setAccountData: vi.fn().mockImplementation((_type: string, data: any) => {
          savedCategories = data.categories
          return Promise.resolve()
        })
      }
      matrixClientService.getClient.mockReturnValue(mockClient)

      await service.deleteCategory('cat_1')

      expect(savedCategories).toHaveLength(1)
      expect(savedCategories[0].id).toBe('cat_2')
      expect(savedCategories[0].order).toBe(0) // Order should be reindexed
    })

    it('should not throw when category not found', async () => {
      const mockClient = {
        getAccountData: vi.fn().mockReturnValue({
          getContent: () => ({ categories: [] })
        }),
        setAccountData: vi.fn()
      }
      matrixClientService.getClient.mockReturnValue(mockClient)

      // Should not throw
      await service.deleteCategory('cat_nonexistent')

      expect(mockClient.setAccountData).not.toHaveBeenCalled()
    })

    it('should throw error when client is not initialized', async () => {
      matrixClientService.getClient.mockReturnValue(null)

      await expect(service.deleteCategory('cat_1')).rejects.toThrow('Matrix client not initialized')
    })

    it('should reorder remaining categories after deletion', async () => {
      const existingCategories = [
        { id: 'cat_1', name: '家人', order: 0 },
        { id: 'cat_2', name: '同事', order: 1 },
        { id: 'cat_3', name: '朋友', order: 2 }
      ]
      let savedCategories: any[] = []

      const mockClient = {
        getAccountData: vi.fn().mockReturnValue({
          getContent: () => ({ categories: existingCategories })
        }),
        setAccountData: vi.fn().mockImplementation((_type: string, data: any) => {
          savedCategories = data.categories
          return Promise.resolve()
        })
      }
      matrixClientService.getClient.mockReturnValue(mockClient)

      await service.deleteCategory('cat_2')

      expect(savedCategories).toHaveLength(2)
      expect(savedCategories[0].order).toBe(0)
      expect(savedCategories[1].order).toBe(1)
    })
  })

  /**
   * Tests for setFriendCategory (moving friends between categories)
   * Validates: Requirement 5.2
   */
  describe('setFriendCategory', () => {
    it('should set category for a friend room', async () => {
      const roomId = '!room:matrix.org'
      const categoryId = 'cat_1'

      const mockClient = {
        getRoom: vi.fn().mockReturnValue({
          tags: {}
        }),
        getAccountData: vi.fn().mockReturnValue({
          getContent: () => ({ categories: [{ id: 'cat_1', name: '家人', order: 0 }] })
        }),
        setRoomTag: vi.fn().mockResolvedValue(undefined),
        deleteRoomTag: vi.fn().mockResolvedValue(undefined)
      }
      matrixClientService.getClient.mockReturnValue(mockClient)

      await service.setFriendCategory(roomId, categoryId)

      expect(mockClient.setRoomTag).toHaveBeenCalledWith(roomId, 'im.hula.category.cat_1', { order: 0 })
    })

    it('should remove existing category tags before setting new one', async () => {
      const roomId = '!room:matrix.org'
      const categoryId = 'cat_2'

      const mockClient = {
        getRoom: vi.fn().mockReturnValue({
          tags: {
            'im.hula.category.cat_1': { order: 0 }
          }
        }),
        getAccountData: vi.fn().mockReturnValue({
          getContent: () => ({
            categories: [
              { id: 'cat_1', name: '家人', order: 0 },
              { id: 'cat_2', name: '同事', order: 1 }
            ]
          })
        }),
        setRoomTag: vi.fn().mockResolvedValue(undefined),
        deleteRoomTag: vi.fn().mockResolvedValue(undefined)
      }
      matrixClientService.getClient.mockReturnValue(mockClient)

      await service.setFriendCategory(roomId, categoryId)

      expect(mockClient.deleteRoomTag).toHaveBeenCalledWith(roomId, 'im.hula.category.cat_1')
      expect(mockClient.setRoomTag).toHaveBeenCalledWith(roomId, 'im.hula.category.cat_2', { order: 0 })
    })

    it('should remove category when categoryId is null', async () => {
      const roomId = '!room:matrix.org'

      const mockClient = {
        getRoom: vi.fn().mockReturnValue({
          tags: {
            'im.hula.category.cat_1': { order: 0 }
          }
        }),
        getAccountData: vi.fn().mockReturnValue({
          getContent: () => ({ categories: [] })
        }),
        deleteRoomTag: vi.fn().mockResolvedValue(undefined),
        setRoomTag: vi.fn()
      }
      matrixClientService.getClient.mockReturnValue(mockClient)

      await service.setFriendCategory(roomId, null)

      expect(mockClient.deleteRoomTag).toHaveBeenCalledWith(roomId, 'im.hula.category.cat_1')
      expect(mockClient.setRoomTag).not.toHaveBeenCalled()
    })

    it('should throw error when room not found', async () => {
      const mockClient = {
        getRoom: vi.fn().mockReturnValue(null)
      }
      matrixClientService.getClient.mockReturnValue(mockClient)

      await expect(service.setFriendCategory('!room:matrix.org', 'cat_1')).rejects.toThrow('Room not found')
    })

    it('should throw error when category not found', async () => {
      const mockClient = {
        getRoom: vi.fn().mockReturnValue({ tags: {} }),
        getAccountData: vi.fn().mockReturnValue({
          getContent: () => ({ categories: [] })
        })
      }
      matrixClientService.getClient.mockReturnValue(mockClient)

      await expect(service.setFriendCategory('!room:matrix.org', 'cat_nonexistent')).rejects.toThrow(
        'Category not found'
      )
    })

    it('should throw error when client is not initialized', async () => {
      matrixClientService.getClient.mockReturnValue(null)

      await expect(service.setFriendCategory('!room:matrix.org', 'cat_1')).rejects.toThrow(
        'Matrix client not initialized'
      )
    })
  })

  /**
   * Tests for getFriendCategory
   * Validates: Requirement 5.5
   */
  describe('getFriendCategory', () => {
    it('should return category ID from room tags', async () => {
      const roomId = '!room:matrix.org'

      const mockClient = {
        getRoom: vi.fn().mockReturnValue({
          tags: {
            'im.hula.category.cat_1': { order: 0 }
          }
        })
      }
      matrixClientService.getClient.mockReturnValue(mockClient)

      const categoryId = await service.getFriendCategory(roomId)

      expect(categoryId).toBe('cat_1')
    })

    it('should return undefined when no category tag exists', async () => {
      const roomId = '!room:matrix.org'

      const mockClient = {
        getRoom: vi.fn().mockReturnValue({
          tags: {}
        })
      }
      matrixClientService.getClient.mockReturnValue(mockClient)

      const categoryId = await service.getFriendCategory(roomId)

      expect(categoryId).toBeUndefined()
    })

    it('should return undefined when room not found', async () => {
      const mockClient = {
        getRoom: vi.fn().mockReturnValue(null)
      }
      matrixClientService.getClient.mockReturnValue(mockClient)

      const categoryId = await service.getFriendCategory('!room:matrix.org')

      expect(categoryId).toBeUndefined()
    })

    it('should return undefined when client is not initialized', async () => {
      matrixClientService.getClient.mockReturnValue(null)

      const categoryId = await service.getFriendCategory('!room:matrix.org')

      expect(categoryId).toBeUndefined()
    })
  })

  /**
   * Tests for reorderCategories
   */
  describe('reorderCategories', () => {
    it('should reorder categories according to new order', async () => {
      const existingCategories = [
        { id: 'cat_1', name: '家人', order: 0 },
        { id: 'cat_2', name: '同事', order: 1 },
        { id: 'cat_3', name: '朋友', order: 2 }
      ]
      let savedCategories: any[] = []

      const mockClient = {
        getAccountData: vi.fn().mockReturnValue({
          getContent: () => ({ categories: existingCategories })
        }),
        setAccountData: vi.fn().mockImplementation((_type: string, data: any) => {
          savedCategories = data.categories
          return Promise.resolve()
        })
      }
      matrixClientService.getClient.mockReturnValue(mockClient)

      await service.reorderCategories(['cat_3', 'cat_1', 'cat_2'])

      expect(savedCategories[0].id).toBe('cat_3')
      expect(savedCategories[0].order).toBe(0)
      expect(savedCategories[1].id).toBe('cat_1')
      expect(savedCategories[1].order).toBe(1)
      expect(savedCategories[2].id).toBe('cat_2')
      expect(savedCategories[2].order).toBe(2)
    })

    it('should throw error when client is not initialized', async () => {
      matrixClientService.getClient.mockReturnValue(null)

      await expect(service.reorderCategories(['cat_1', 'cat_2'])).rejects.toThrow('Matrix client not initialized')
    })
  })

  /**
   * Tests for getFriendsByCategory
   * Validates: Requirement 5.4
   */
  describe('getFriendsByCategory', () => {
    it('should return friends in specified category', async () => {
      const synapseApi = await import('@/integrations/synapse/friends')

      // Setup: Friends with rooms
      ;(synapseApi.listFriends as any).mockResolvedValue({
        friends: [
          { user_id: '@alice:matrix.org', room_id: '!room1:matrix.org' },
          { user_id: '@bob:matrix.org', room_id: '!room2:matrix.org' }
        ]
      })

      const mockClient = {
        getRoom: vi.fn().mockImplementation((roomId: string) => {
          if (roomId === '!room1:matrix.org') {
            return { tags: { 'im.hula.category.cat_1': { order: 0 } } }
          }
          return { tags: {} }
        }),
        getAccountData: vi.fn().mockReturnValue({
          getContent: () => ({ categories: [{ id: 'cat_1', name: '家人', order: 0 }] })
        })
      }
      matrixClientService.getClient.mockReturnValue(mockClient)

      const friends = await service.getFriendsByCategory('cat_1')

      expect(friends).toHaveLength(1)
      expect(friends[0].userId).toBe('@alice:matrix.org')
      expect(friends[0].categoryId).toBe('cat_1')
    })

    it('should return uncategorized friends when categoryId is null', async () => {
      const synapseApi = await import('@/integrations/synapse/friends')

      // Setup: Friends with rooms
      ;(synapseApi.listFriends as any).mockResolvedValue({
        friends: [
          { user_id: '@alice:matrix.org', room_id: '!room1:matrix.org' },
          { user_id: '@bob:matrix.org', room_id: '!room2:matrix.org' }
        ]
      })

      const mockClient = {
        getRoom: vi.fn().mockImplementation((roomId: string) => {
          if (roomId === '!room1:matrix.org') {
            return { tags: { 'im.hula.category.cat_1': { order: 0 } } }
          }
          return { tags: {} }
        }),
        getAccountData: vi.fn().mockReturnValue({
          getContent: () => ({ categories: [{ id: 'cat_1', name: '家人', order: 0 }] })
        })
      }
      matrixClientService.getClient.mockReturnValue(mockClient)

      const friends = await service.getFriendsByCategory(null)

      expect(friends).toHaveLength(1)
      expect(friends[0].userId).toBe('@bob:matrix.org')
      expect(friends[0].categoryId).toBeUndefined()
    })
  })

  /**
   * Tests for getFriendsGroupedByCategory
   * Validates: Requirement 5.4
   */
  describe('getFriendsGroupedByCategory', () => {
    it('should group friends by category', async () => {
      const synapseApi = await import('@/integrations/synapse/friends')

      // Setup: Friends with rooms
      ;(synapseApi.listFriends as any).mockResolvedValue({
        friends: [
          { user_id: '@alice:matrix.org', room_id: '!room1:matrix.org' },
          { user_id: '@bob:matrix.org', room_id: '!room2:matrix.org' },
          { user_id: '@charlie:matrix.org', room_id: '!room3:matrix.org' }
        ]
      })

      const mockClient = {
        getRoom: vi.fn().mockImplementation((roomId: string) => {
          if (roomId === '!room1:matrix.org') {
            return { tags: { 'im.hula.category.cat_1': { order: 0 } } }
          }
          if (roomId === '!room2:matrix.org') {
            return { tags: { 'im.hula.category.cat_1': { order: 0 } } }
          }
          return { tags: {} }
        }),
        getAccountData: vi.fn().mockReturnValue({
          getContent: () => ({ categories: [{ id: 'cat_1', name: '家人', order: 0 }] })
        })
      }
      matrixClientService.getClient.mockReturnValue(mockClient)

      const grouped = await service.getFriendsGroupedByCategory()

      expect(grouped.get('cat_1')).toHaveLength(2)
      expect(grouped.get(null)).toHaveLength(1)
      expect(grouped.get(null)?.[0].userId).toBe('@charlie:matrix.org')
    })
  })
})

/**
 * Tests for Category Deletion Cleanup
 * **Feature: sdk-backend-integration, Property 5: Category Deletion Cleanup**
 * **Validates: Requirements 5.4**
 *
 * Tests that when a category is deleted, all friends in that category
 * are moved to the default (uncategorized) category.
 */
describe('Category Deletion Cleanup', () => {
  let matrixClientService: any
  let synapseApi: any
  let service: EnhancedFriendsService

  beforeEach(async () => {
    vi.clearAllMocks()

    // Get mocked modules
    const clientModule = await import('@/integrations/matrix/client')
    const synapseModule = await import('@/integrations/synapse/friends')

    matrixClientService = clientModule.matrixClientService
    synapseApi = synapseModule

    // Create fresh service instance for each test
    service = new EnhancedFriendsService()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  /**
   * Test: Category deletion should remove category tags from all friends in that category
   * Validates: Requirement 5.4
   */
  it('should remove category tags from friends when category is deleted', async () => {
    const categoryId = 'cat_1'
    const existingCategories = [
      { id: 'cat_1', name: '家人', order: 0 },
      { id: 'cat_2', name: '同事', order: 1 }
    ]

    // Setup: Friends with rooms in the category to be deleted
    ;(synapseApi.listFriends as any).mockResolvedValue({
      friends: [
        { user_id: '@alice:matrix.org', room_id: '!room1:matrix.org' },
        { user_id: '@bob:matrix.org', room_id: '!room2:matrix.org' }
      ]
    })

    const deleteRoomTagCalls: Array<{ roomId: string; tag: string }> = []

    const mockClient = {
      getAccountData: vi.fn().mockReturnValue({
        getContent: () => ({ categories: existingCategories })
      }),
      setAccountData: vi.fn().mockResolvedValue(undefined),
      getRoom: vi.fn().mockImplementation((roomId: string) => {
        if (roomId === '!room1:matrix.org') {
          return { tags: { 'im.hula.category.cat_1': { order: 0 } } }
        }
        if (roomId === '!room2:matrix.org') {
          return { tags: { 'im.hula.category.cat_1': { order: 0 } } }
        }
        return { tags: {} }
      }),
      deleteRoomTag: vi.fn().mockImplementation((roomId: string, tag: string) => {
        deleteRoomTagCalls.push({ roomId, tag })
        return Promise.resolve()
      })
    }
    matrixClientService.getClient.mockReturnValue(mockClient)

    // Execute: Delete the category
    await service.deleteCategory(categoryId)

    // Verify: Category tags were removed from both rooms
    expect(deleteRoomTagCalls).toHaveLength(2)
    expect(deleteRoomTagCalls).toContainEqual({ roomId: '!room1:matrix.org', tag: 'im.hula.category.cat_1' })
    expect(deleteRoomTagCalls).toContainEqual({ roomId: '!room2:matrix.org', tag: 'im.hula.category.cat_1' })
  })

  /**
   * Test: Category deletion should not affect friends in other categories
   * Validates: Requirement 5.4
   */
  it('should not affect friends in other categories when deleting a category', async () => {
    const categoryId = 'cat_1'
    const existingCategories = [
      { id: 'cat_1', name: '家人', order: 0 },
      { id: 'cat_2', name: '同事', order: 1 }
    ]

    // Setup: Friends in different categories
    ;(synapseApi.listFriends as any).mockResolvedValue({
      friends: [
        { user_id: '@alice:matrix.org', room_id: '!room1:matrix.org' }, // In cat_1
        { user_id: '@bob:matrix.org', room_id: '!room2:matrix.org' } // In cat_2
      ]
    })

    const deleteRoomTagCalls: Array<{ roomId: string; tag: string }> = []

    const mockClient = {
      getAccountData: vi.fn().mockReturnValue({
        getContent: () => ({ categories: existingCategories })
      }),
      setAccountData: vi.fn().mockResolvedValue(undefined),
      getRoom: vi.fn().mockImplementation((roomId: string) => {
        if (roomId === '!room1:matrix.org') {
          return { tags: { 'im.hula.category.cat_1': { order: 0 } } }
        }
        if (roomId === '!room2:matrix.org') {
          return { tags: { 'im.hula.category.cat_2': { order: 0 } } }
        }
        return { tags: {} }
      }),
      deleteRoomTag: vi.fn().mockImplementation((roomId: string, tag: string) => {
        deleteRoomTagCalls.push({ roomId, tag })
        return Promise.resolve()
      })
    }
    matrixClientService.getClient.mockReturnValue(mockClient)

    // Execute: Delete cat_1
    await service.deleteCategory(categoryId)

    // Verify: Only cat_1 tag was removed, cat_2 tag was not touched
    expect(deleteRoomTagCalls).toHaveLength(1)
    expect(deleteRoomTagCalls[0]).toEqual({ roomId: '!room1:matrix.org', tag: 'im.hula.category.cat_1' })
  })

  /**
   * Test: Category deletion should handle friends without rooms gracefully
   * Validates: Requirement 5.4
   */
  it('should handle friends without rooms gracefully during category deletion', async () => {
    const categoryId = 'cat_1'
    const existingCategories = [{ id: 'cat_1', name: '家人', order: 0 }]

    // Setup: Friend without room
    ;(synapseApi.listFriends as any).mockResolvedValue({
      friends: [{ user_id: '@alice:matrix.org' }] // No room_id
    })

    const mockClient = {
      getAccountData: vi.fn().mockReturnValue({
        getContent: () => ({ categories: existingCategories })
      }),
      setAccountData: vi.fn().mockResolvedValue(undefined),
      getRoom: vi.fn(),
      deleteRoomTag: vi.fn()
    }
    matrixClientService.getClient.mockReturnValue(mockClient)

    // Execute: Should not throw
    await service.deleteCategory(categoryId)

    // Verify: getRoom was not called (no room to check)
    expect(mockClient.getRoom).not.toHaveBeenCalled()
    expect(mockClient.deleteRoomTag).not.toHaveBeenCalled()
  })

  /**
   * Test: Category deletion should continue even if tag removal fails for some rooms
   * Validates: Requirement 5.4
   */
  it('should continue cleanup even if tag removal fails for some rooms', async () => {
    const categoryId = 'cat_1'
    const existingCategories = [{ id: 'cat_1', name: '家人', order: 0 }]

    // Setup: Multiple friends in the category
    ;(synapseApi.listFriends as any).mockResolvedValue({
      friends: [
        { user_id: '@alice:matrix.org', room_id: '!room1:matrix.org' },
        { user_id: '@bob:matrix.org', room_id: '!room2:matrix.org' },
        { user_id: '@charlie:matrix.org', room_id: '!room3:matrix.org' }
      ]
    })

    const deleteRoomTagCalls: string[] = []

    const mockClient = {
      getAccountData: vi.fn().mockReturnValue({
        getContent: () => ({ categories: existingCategories })
      }),
      setAccountData: vi.fn().mockResolvedValue(undefined),
      getRoom: vi.fn().mockImplementation(() => ({
        tags: { 'im.hula.category.cat_1': { order: 0 } }
      })),
      deleteRoomTag: vi.fn().mockImplementation((roomId: string) => {
        deleteRoomTagCalls.push(roomId)
        if (roomId === '!room2:matrix.org') {
          return Promise.reject(new Error('Failed to delete tag'))
        }
        return Promise.resolve()
      })
    }
    matrixClientService.getClient.mockReturnValue(mockClient)

    // Execute: Should not throw even if one tag removal fails
    await service.deleteCategory(categoryId)

    // Verify: All rooms were attempted
    expect(deleteRoomTagCalls).toHaveLength(3)
    expect(deleteRoomTagCalls).toContain('!room1:matrix.org')
    expect(deleteRoomTagCalls).toContain('!room2:matrix.org')
    expect(deleteRoomTagCalls).toContain('!room3:matrix.org')

    // Verify: Category was still deleted
    expect(mockClient.setAccountData).toHaveBeenCalled()
  })

  /**
   * Test: After category deletion, friends should appear as uncategorized
   * Validates: Requirement 5.4
   */
  it('should result in friends being uncategorized after category deletion', async () => {
    const categoryId = 'cat_1'
    let currentCategories = [
      { id: 'cat_1', name: '家人', order: 0 },
      { id: 'cat_2', name: '同事', order: 1 }
    ]

    // Track room tags state
    const roomTags: Record<string, Record<string, any>> = {
      '!room1:matrix.org': { 'im.hula.category.cat_1': { order: 0 } }
    }

    // Setup: Friend in cat_1
    ;(synapseApi.listFriends as any).mockResolvedValue({
      friends: [{ user_id: '@alice:matrix.org', room_id: '!room1:matrix.org' }]
    })

    const mockClient = {
      getAccountData: vi.fn().mockReturnValue({
        getContent: () => ({ categories: currentCategories })
      }),
      setAccountData: vi.fn().mockImplementation((_type: string, data: any) => {
        currentCategories = data.categories
        return Promise.resolve()
      }),
      getRoom: vi.fn().mockImplementation((roomId: string) => ({
        tags: roomTags[roomId] || {}
      })),
      deleteRoomTag: vi.fn().mockImplementation((roomId: string, tag: string) => {
        if (roomTags[roomId]) {
          delete roomTags[roomId][tag]
        }
        return Promise.resolve()
      })
    }
    matrixClientService.getClient.mockReturnValue(mockClient)

    // Execute: Delete cat_1
    await service.deleteCategory(categoryId)

    // Verify: Room no longer has the category tag
    expect(roomTags['!room1:matrix.org']).toEqual({})

    // Verify: Category was removed from list
    expect(currentCategories.find((c) => c.id === 'cat_1')).toBeUndefined()
    expect(currentCategories).toHaveLength(1)
    expect(currentCategories[0].id).toBe('cat_2')
  })
})

/**
 * Property-Based Test: Category Deletion Cleanup
 * **Feature: sdk-backend-integration, Property 5: Category Deletion Cleanup**
 * **Validates: Requirements 5.4**
 *
 * *For any* category deletion, all friends in that category should be moved to the
 * default category (uncategorized), and no friend should be left without a category.
 *
 * This property test verifies:
 * 1. When a category is deleted, all friends in that category have their category tags removed
 * 2. Friends in other categories are not affected
 * 3. The category is removed from the categories list
 * 4. No friend is left in an invalid state (referencing a deleted category)
 */
describe('Property 5: Category Deletion Cleanup (PBT)', () => {
  let matrixClientService: any
  let synapseApi: any
  let _service: EnhancedFriendsService

  beforeEach(async () => {
    vi.clearAllMocks()

    // Get mocked modules
    const clientModule = await import('@/integrations/matrix/client')
    const synapseModule = await import('@/integrations/synapse/friends')

    matrixClientService = clientModule.matrixClientService
    synapseApi = synapseModule

    // Create fresh service instance for each test
    _service = new EnhancedFriendsService()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  /**
   * Property: For any category deletion, all friends in that category should have
   * their category tags removed (moved to default/uncategorized).
   */
  it('should remove category tags from all friends in deleted category for any valid input', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate category ID
        fc
          .string({ minLength: 1, maxLength: 20 })
          .filter((s) => /^[a-z0-9_]+$/i.test(s))
          .map((id) => `cat_${id}`),
        // Generate number of friends in the category to delete (1-10)
        fc.integer({ min: 1, max: 10 }),
        // Generate number of friends in other categories (0-5)
        fc.integer({ min: 0, max: 5 }),
        async (categoryIdToDelete, friendsInDeletedCategory, friendsInOtherCategories) => {
          // Setup: Create categories
          const otherCategoryId = 'cat_other'
          const categories = [
            { id: categoryIdToDelete, name: 'Category To Delete', order: 0 },
            { id: otherCategoryId, name: 'Other Category', order: 1 }
          ]

          // Setup: Create friends
          const friends: Array<{ user_id: string; room_id: string }> = []

          // Friends in the category to be deleted
          for (let i = 0; i < friendsInDeletedCategory; i++) {
            friends.push({
              user_id: `@user_deleted_${i}:matrix.org`,
              room_id: `!room_deleted_${i}:matrix.org`
            })
          }

          // Friends in other categories
          for (let i = 0; i < friendsInOtherCategories; i++) {
            friends.push({
              user_id: `@user_other_${i}:matrix.org`,
              room_id: `!room_other_${i}:matrix.org`
            })
          }

          // Setup: Room tags state
          const roomTags: Record<string, Record<string, any>> = {}
          for (let i = 0; i < friendsInDeletedCategory; i++) {
            roomTags[`!room_deleted_${i}:matrix.org`] = {
              [`im.hula.category.${categoryIdToDelete}`]: { order: 0 }
            }
          }
          for (let i = 0; i < friendsInOtherCategories; i++) {
            roomTags[`!room_other_${i}:matrix.org`] = {
              [`im.hula.category.${otherCategoryId}`]: { order: 0 }
            }
          }

          // Track deleted tags
          const deletedTags: Array<{ roomId: string; tag: string }> = []
          let finalCategories = [...categories]

          // Setup: Mock Synapse API
          ;(synapseApi.listFriends as any).mockResolvedValue({ friends })

          // Setup: Mock client
          const mockClient = {
            getAccountData: vi.fn().mockReturnValue({
              getContent: () => ({ categories: finalCategories })
            }),
            setAccountData: vi.fn().mockImplementation((_type: string, data: any) => {
              finalCategories = data.categories
              return Promise.resolve()
            }),
            getRoom: vi.fn().mockImplementation((roomId: string) => ({
              tags: roomTags[roomId] || {}
            })),
            deleteRoomTag: vi.fn().mockImplementation((roomId: string, tag: string) => {
              deletedTags.push({ roomId, tag })
              if (roomTags[roomId]) {
                delete roomTags[roomId][tag]
              }
              return Promise.resolve()
            })
          }
          matrixClientService.getClient.mockReturnValue(mockClient)

          // Create fresh service for this iteration
          const testService = new EnhancedFriendsService()

          // Execute: Delete the category
          await testService.deleteCategory(categoryIdToDelete)

          // Property 1: All friends in deleted category should have their tags removed
          expect(deletedTags.length).toBe(friendsInDeletedCategory)

          // Property 2: Only tags for the deleted category should be removed
          for (const { tag } of deletedTags) {
            expect(tag).toBe(`im.hula.category.${categoryIdToDelete}`)
          }

          // Property 3: Friends in other categories should not be affected
          for (let i = 0; i < friendsInOtherCategories; i++) {
            const roomId = `!room_other_${i}:matrix.org`
            expect(roomTags[roomId][`im.hula.category.${otherCategoryId}`]).toBeDefined()
          }

          // Property 4: The deleted category should be removed from the list
          expect(finalCategories.find((c) => c.id === categoryIdToDelete)).toBeUndefined()

          // Property 5: Other categories should remain
          expect(finalCategories.find((c) => c.id === otherCategoryId)).toBeDefined()

          // Property 6: No room should have a tag referencing the deleted category
          for (const roomId of Object.keys(roomTags)) {
            const tags = roomTags[roomId]
            expect(tags[`im.hula.category.${categoryIdToDelete}`]).toBeUndefined()
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Category deletion should be idempotent - deleting a non-existent
   * category should not throw and should not affect other categories.
   */
  it('should handle deletion of non-existent category gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate non-existent category ID
        fc
          .string({ minLength: 1, maxLength: 20 })
          .filter((s) => /^[a-z0-9_]+$/i.test(s))
          .map((id) => `cat_nonexistent_${id}`),
        // Generate existing categories (1-5)
        fc.array(
          fc.record({
            id: fc
              .string({ minLength: 1, maxLength: 10 })
              .filter((s) => /^[a-z0-9_]+$/i.test(s))
              .map((id) => `cat_existing_${id}`),
            name: fc.string({ minLength: 1, maxLength: 20 }),
            order: fc.integer({ min: 0, max: 10 })
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (nonExistentCategoryId, existingCategories) => {
          // Ensure the non-existent category is not in the existing list
          const filteredCategories = existingCategories.filter((c) => c.id !== nonExistentCategoryId)

          let finalCategories = [...filteredCategories]

          // Setup: Mock Synapse API
          ;(synapseApi.listFriends as any).mockResolvedValue({ friends: [] })

          // Setup: Mock client
          const mockClient = {
            getAccountData: vi.fn().mockReturnValue({
              getContent: () => ({ categories: finalCategories })
            }),
            setAccountData: vi.fn().mockImplementation((_type: string, data: any) => {
              finalCategories = data.categories
              return Promise.resolve()
            }),
            getRoom: vi.fn().mockReturnValue({ tags: {} }),
            deleteRoomTag: vi.fn().mockResolvedValue(undefined)
          }
          matrixClientService.getClient.mockReturnValue(mockClient)

          // Create fresh service for this iteration
          const testService = new EnhancedFriendsService()

          // Execute: Delete non-existent category - should not throw
          await testService.deleteCategory(nonExistentCategoryId)

          // Property: Existing categories should remain unchanged
          expect(finalCategories.length).toBe(filteredCategories.length)
          for (const category of filteredCategories) {
            expect(finalCategories.find((c) => c.id === category.id)).toBeDefined()
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: After category deletion, getFriendsByCategory(null) should include
   * all friends that were in the deleted category.
   */
  it('should move friends to uncategorized after category deletion', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate number of friends in the category to delete (1-5)
        fc.integer({ min: 1, max: 5 }),
        async (friendCount) => {
          const categoryIdToDelete = 'cat_to_delete'
          let categories = [{ id: categoryIdToDelete, name: 'To Delete', order: 0 }]

          // Setup: Create friends
          const friends: Array<{ user_id: string; room_id: string }> = []
          for (let i = 0; i < friendCount; i++) {
            friends.push({
              user_id: `@user_${i}:matrix.org`,
              room_id: `!room_${i}:matrix.org`
            })
          }

          // Setup: Room tags state - all friends in the category to delete
          const roomTags: Record<string, Record<string, any>> = {}
          for (let i = 0; i < friendCount; i++) {
            roomTags[`!room_${i}:matrix.org`] = {
              [`im.hula.category.${categoryIdToDelete}`]: { order: 0 }
            }
          }
          // Setup: Mock Synapse API
          ;(synapseApi.listFriends as any).mockResolvedValue({ friends })

          // Setup: Mock client
          const mockClient = {
            getAccountData: vi.fn().mockReturnValue({
              getContent: () => ({ categories })
            }),
            setAccountData: vi.fn().mockImplementation((_type: string, data: any) => {
              categories = data.categories
              return Promise.resolve()
            }),
            getRoom: vi.fn().mockImplementation((roomId: string) => ({
              tags: roomTags[roomId] || {}
            })),
            deleteRoomTag: vi.fn().mockImplementation((roomId: string, tag: string) => {
              if (roomTags[roomId]) {
                delete roomTags[roomId][tag]
              }
              return Promise.resolve()
            })
          }
          matrixClientService.getClient.mockReturnValue(mockClient)

          // Create fresh service for this iteration
          const testService = new EnhancedFriendsService()

          // Execute: Delete the category
          await testService.deleteCategory(categoryIdToDelete)

          // Verify: All friends should now be uncategorized (no category tags)
          for (let i = 0; i < friendCount; i++) {
            const roomId = `!room_${i}:matrix.org`
            const tags = roomTags[roomId] || {}
            const hasCategoryTag = Object.keys(tags).some((tag) => tag.startsWith('im.hula.category.'))
            expect(hasCategoryTag).toBe(false)
          }

          // Property: Category should be removed
          expect(categories.find((c) => c.id === categoryIdToDelete)).toBeUndefined()

          return true
        }
      ),
      { numRuns: 100 }
    )
  })
})
