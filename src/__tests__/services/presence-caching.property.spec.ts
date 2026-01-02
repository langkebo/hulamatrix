/**
 * Property-Based Test: Presence Caching
 *
 * **Feature: sdk-backend-integration, Property 4: Presence Caching**
 * **Validates: Requirements 4.3, 4.4**
 *
 * *For any* user whose presence has been queried, the service should cache the result
 * and return the cached value when presence is unavailable, with cache TTL of 60 seconds.
 *
 * Requirements:
 * - 4.3: THE Friends_Service SHALL handle presence unavailable gracefully (show last known status)
 * - 4.4: THE Friends_Service SHALL cache last known presence status
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import { EnhancedFriendsService } from '@/services/enhancedFriendsService'

// Mock dependencies
vi.mock('@/integrations/matrix/client', () => ({
  matrixClientService: {
    getClient: vi.fn()
  }
}))

vi.mock('@/integrations/synapse/friends', () => ({
  listFriends: vi.fn()
}))

vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}))

import { matrixClientService } from '@/integrations/matrix/client'

// Presence state arbitrary
const presenceArb = fc.constantFrom('online', 'offline', 'unavailable', 'away') as fc.Arbitrary<
  'online' | 'offline' | 'unavailable' | 'away'
>

// User ID arbitrary
const userIdArb = fc.string({ minLength: 1, maxLength: 30 }).map((s) => `@${s}:example.org`)

// Last active ago arbitrary (milliseconds)
const lastActiveAgoArb = fc.option(fc.integer({ min: 0, max: 86400000 }), { nil: undefined })

describe('Presence Caching Property-Based Tests', () => {
  let _service: EnhancedFriendsService

  beforeEach(() => {
    vi.clearAllMocks()
    _service = new EnhancedFriendsService()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  /**
   * Property-Based Test: Presence Caching
   * **Feature: sdk-backend-integration, Property 4: Presence Caching**
   * **Validates: Requirements 4.3, 4.4**
   */
  describe('Property 4: Presence Caching', () => {
    it('should cache presence after query and return cached value within TTL', async () => {
      await fc.assert(
        fc.asyncProperty(userIdArb, presenceArb, lastActiveAgoArb, async (userId, presence, lastActiveAgo) => {
          // Create a fresh service for each iteration
          const testService = new EnhancedFriendsService()

          // Mock client with user presence
          const mockUser = {
            presence,
            lastActiveAgo
          }
          const mockClient = {
            getUser: vi.fn().mockReturnValue(mockUser)
          }
          vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

          // First query - should fetch from client
          const result1 = await testService.getPresence(userId)
          expect(result1).toBe(presence)
          expect(mockClient.getUser).toHaveBeenCalledWith(userId)

          // Second query immediately after - should use cache
          mockClient.getUser.mockClear()
          const result2 = await testService.getPresence(userId)
          expect(result2).toBe(presence)
          // getUser should not be called again because cache is valid
          expect(mockClient.getUser).not.toHaveBeenCalled()
        }),
        { numRuns: 100 }
      )
    })

    it('should return cached presence when client returns null user', async () => {
      await fc.assert(
        fc.asyncProperty(userIdArb, presenceArb, async (userId, presence) => {
          const testService = new EnhancedFriendsService()

          // First: populate cache with valid presence
          const mockUser = { presence }
          const mockClient = {
            getUser: vi.fn().mockReturnValue(mockUser)
          }
          vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

          await testService.getPresence(userId)

          // Now make client return null user (presence unavailable)
          mockClient.getUser.mockReturnValue(null)

          // Query again - should return cached value
          const result = await testService.getPresence(userId)
          expect(result).toBe(presence)
        }),
        { numRuns: 100 }
      )
    })

    it('should handle presence unavailable gracefully by returning offline', async () => {
      await fc.assert(
        fc.asyncProperty(userIdArb, async (userId) => {
          const testService = new EnhancedFriendsService()

          // Mock client that returns null user (presence unavailable)
          const mockClient = {
            getUser: vi.fn().mockReturnValue(null)
          }
          vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

          // Query presence - should return 'offline' gracefully
          const result = await testService.getPresence(userId)
          expect(result).toBe('offline')
        }),
        { numRuns: 100 }
      )
    })

    it('should handle getUser throwing error gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(userIdArb, async (userId) => {
          const testService = new EnhancedFriendsService()

          // Mock client that throws error
          const mockClient = {
            getUser: vi.fn().mockImplementation(() => {
              throw new Error('Network error')
            })
          }
          vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

          // Query presence - should return 'offline' gracefully without throwing
          const result = await testService.getPresence(userId)
          expect(result).toBe('offline')
        }),
        { numRuns: 100 }
      )
    })

    it('should return offline when client is not initialized', async () => {
      await fc.assert(
        fc.asyncProperty(userIdArb, async (userId) => {
          const testService = new EnhancedFriendsService()

          // Mock client as null (not initialized)
          vi.mocked(matrixClientService.getClient).mockReturnValue(null)

          // Query presence - should return 'offline'
          const result = await testService.getPresence(userId)
          expect(result).toBe('offline')
        }),
        { numRuns: 100 }
      )
    })

    it('should cache lastActiveAgo along with presence', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          presenceArb,
          fc.integer({ min: 0, max: 86400000 }),
          async (userId, presence, lastActiveAgo) => {
            const testService = new EnhancedFriendsService()

            // Mock client with user presence and lastActiveAgo
            const mockUser = {
              presence,
              lastActiveAgo
            }
            const mockClient = {
              getUser: vi.fn().mockReturnValue(mockUser)
            }
            vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

            // Query presence to populate cache
            await testService.getPresence(userId)

            // Get cached presence
            const cached = testService.getCachedPresence(userId)
            expect(cached).toBeDefined()
            expect(cached?.presence).toBe(presence)
            expect(cached?.lastActiveAgo).toBe(lastActiveAgo)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should clear cache when clearPresenceCache is called', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(userIdArb, { minLength: 1, maxLength: 10 }),
          presenceArb,
          async (userIds, presence) => {
            const testService = new EnhancedFriendsService()

            // Mock client
            const mockClient = {
              getUser: vi.fn().mockReturnValue({ presence })
            }
            vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

            // Populate cache for all users
            for (const userId of userIds) {
              await testService.getPresence(userId)
            }

            // Verify cache is populated
            for (const userId of userIds) {
              expect(testService.getCachedPresence(userId)).toBeDefined()
            }

            // Clear cache
            testService.clearPresenceCache()

            // Verify cache is empty
            for (const userId of userIds) {
              expect(testService.getCachedPresence(userId)).toBeUndefined()
            }
          }
        ),
        { numRuns: 50 }
      )
    })
  })
})
