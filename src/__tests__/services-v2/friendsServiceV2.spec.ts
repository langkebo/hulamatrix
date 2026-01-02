/**
 * FriendsServiceV2 Tests
 *
 * Comprehensive tests for the v2 friends service including:
 * - API interactions
 * - Caching behavior
 * - Error handling
 * - Event emission
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { friendsServiceV2 } from '@/services/friendsServiceV2'
import type { FriendItem, FriendCategoryItem, PendingRequestItem, FriendStats } from '@/types/matrix-sdk-v2'

// Mock matrixClientService
vi.mock('@/integrations/matrix/client', () => ({
    matrixClientService: {
        getClient: vi.fn()
    }
}))

// Mock logger
vi.mock('@/utils/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}))

describe('FriendsServiceV2', () => {
    let mockMatrixClient: any

    const mockFriends: FriendItem[] = [
        {
            user_id: '@alice:matrix.org',
            display_name: 'Alice',
            avatar_url: 'mxc://matrix.org/alice',
            presence: 'online',
            category_id: 1,
            created_at: '2024-01-01T00:00:00Z'
        },
        {
            user_id: '@bob:matrix.org',
            display_name: 'Bob',
            avatar_url: 'mxc://matrix.org/bob',
            presence: 'offline',
            category_id: 2,
            created_at: '2024-01-02T00:00:00Z'
        }
    ]

    const mockCategories: FriendCategoryItem[] = [
        { id: 1, name: 'Family', description: 'Family members' },
        { id: 2, name: 'Friends', description: 'Close friends' }
    ]

    const mockPendingRequests: PendingRequestItem[] = [
        {
            id: 'req1',
            requester_id: '@charlie:matrix.org',
            target_id: '@me:matrix.org',
            message: 'Please add me',
            created_at: '2024-01-01T00:00:00Z'
        }
    ]

    const mockStats: FriendStats = {
        total_friends: 2,
        online_friends: 1,
        pending_requests: 1
    }

    beforeEach(async () => {
        vi.clearAllMocks()

        // Create mock Matrix client with v2 API
        mockMatrixClient = {
            friendsV2: {
                listFriends: vi.fn().mockResolvedValue(mockFriends),
                getCategories: vi.fn().mockResolvedValue(mockCategories),
                getPendingRequests: vi.fn().mockResolvedValue(mockPendingRequests),
                getStats: vi.fn().mockResolvedValue(mockStats),
                sendFriendRequest: vi.fn().mockResolvedValue('req1'),
                acceptFriendRequest: vi.fn().mockResolvedValue(undefined),
                rejectFriendRequest: vi.fn().mockResolvedValue(undefined),
                removeFriend: vi.fn().mockResolvedValue(undefined),
                searchUsers: vi.fn().mockResolvedValue([
                    {
                        user_id: '@dave:matrix.org',
                        display_name: 'Dave'
                    }
                ]),
                on: vi.fn(),
                off: vi.fn()
            },
            on: vi.fn(),
            off: vi.fn()
        }

        // Mock the matrixClientService
        const { matrixClientService } = await import('@/integrations/matrix/client')
        vi.mocked(matrixClientService.getClient).mockReturnValue(mockMatrixClient)
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    describe('Initialization', () => {
        it('should initialize successfully', async () => {
            await expect(friendsServiceV2.initialize()).resolves.not.toThrow()
        })

        it('should set up event listeners on initialize', async () => {
            await friendsServiceV2.initialize()
            expect(mockMatrixClient.friendsV2.on).toHaveBeenCalled()
        })

        it('should be idempotent - multiple initializes are safe', async () => {
            await friendsServiceV2.initialize()
            await friendsServiceV2.initialize()
            await friendsServiceV2.initialize()
            // Should not throw or cause issues
        })
    })

    describe('List Friends', () => {
        it('should return friends list', async () => {
            await friendsServiceV2.initialize()
            const friends = await friendsServiceV2.listFriends()
            expect(friends).toEqual(mockFriends)
        })

        it('should use cache when useCache is true', async () => {
            await friendsServiceV2.initialize()
            await friendsServiceV2.listFriends(true)
            await friendsServiceV2.listFriends(true) // Should use cache

            // Should only call the API once
            expect(mockMatrixClient.friendsV2.listFriends).toHaveBeenCalledTimes(1)
        })

        it('should bypass cache when useCache is false', async () => {
            await friendsServiceV2.initialize()
            await friendsServiceV2.listFriends(false)
            await friendsServiceV2.listFriends(false) // Should not use cache

            // Should call the API twice
            expect(mockMatrixClient.friendsV2.listFriends).toHaveBeenCalledTimes(2)
        })

        it('should handle empty friends list', async () => {
            mockMatrixClient.friendsV2.listFriends.mockResolvedValue([])
            await friendsServiceV2.initialize()
            const friends = await friendsServiceV2.listFriends()
            expect(friends).toEqual([])
        })

        it('should handle API errors gracefully', async () => {
            mockMatrixClient.friendsV2.listFriends.mockRejectedValue(new Error('Network error'))
            await friendsServiceV2.initialize()
            await expect(friendsServiceV2.listFriends()).rejects.toThrow('Network error')
        })
    })

    describe('Get Categories', () => {
        it('should return categories list', async () => {
            await friendsServiceV2.initialize()
            const categories = await friendsServiceV2.getCategories()
            expect(categories).toEqual(mockCategories)
        })

        it('should use cache when useCache is true', async () => {
            await friendsServiceV2.initialize()
            await friendsServiceV2.getCategories(true)
            await friendsServiceV2.getCategories(true)

            expect(mockMatrixClient.friendsV2.getCategories).toHaveBeenCalledTimes(1)
        })

        it('should handle empty categories', async () => {
            mockMatrixClient.friendsV2.getCategories.mockResolvedValue([])
            await friendsServiceV2.initialize()
            const categories = await friendsServiceV2.getCategories()
            expect(categories).toEqual([])
        })
    })

    describe('Get Pending Requests', () => {
        it('should return pending requests', async () => {
            await friendsServiceV2.initialize()
            const requests = await friendsServiceV2.getPendingRequests()
            expect(requests).toEqual(mockPendingRequests)
        })

        it('should not cache pending requests', async () => {
            await friendsServiceV2.initialize()
            await friendsServiceV2.getPendingRequests()
            await friendsServiceV2.getPendingRequests()

            expect(mockMatrixClient.friendsV2.getPendingRequests).toHaveBeenCalledTimes(2)
        })
    })

    describe('Get Stats', () => {
        it('should return friend statistics', async () => {
            await friendsServiceV2.initialize()
            const stats = await friendsServiceV2.getStats()
            expect(stats).toEqual(mockStats)
        })

        it('should not cache stats', async () => {
            await friendsServiceV2.initialize()
            await friendsServiceV2.getStats()
            await friendsServiceV2.getStats()

            expect(mockMatrixClient.friendsV2.getStats).toHaveBeenCalledTimes(2)
        })
    })

    describe('Send Friend Request', () => {
        it('should send friend request successfully', async () => {
            await friendsServiceV2.initialize()
            const requestId = await friendsServiceV2.sendFriendRequest('@bob:matrix.org', 'Hi', 1)
            expect(requestId).toBe('req1')
            expect(mockMatrixClient.friendsV2.sendFriendRequest).toHaveBeenCalledWith(
                '@bob:matrix.org',
                'Hi',
                1
            )
        })

        it('should send request without optional parameters', async () => {
            await friendsServiceV2.initialize()
            await friendsServiceV2.sendFriendRequest('@bob:matrix.org')
            expect(mockMatrixClient.friendsV2.sendFriendRequest).toHaveBeenCalledWith(
                '@bob:matrix.org',
                undefined,
                undefined
            )
        })

        it('should handle send errors', async () => {
            mockMatrixClient.friendsV2.sendFriendRequest.mockRejectedValue(new Error('Send failed'))
            await friendsServiceV2.initialize()
            await expect(
                friendsServiceV2.sendFriendRequest('@bob:matrix.org')
            ).rejects.toThrow('Send failed')
        })
    })

    describe('Accept Friend Request', () => {
        it('should accept friend request successfully', async () => {
            await friendsServiceV2.initialize()
            await friendsServiceV2.acceptFriendRequest('req1', 1)
            expect(mockMatrixClient.friendsV2.acceptFriendRequest).toHaveBeenCalledWith('req1', 1)
        })

        it('should accept without category', async () => {
            await friendsServiceV2.initialize()
            await friendsServiceV2.acceptFriendRequest('req1')
            expect(mockMatrixClient.friendsV2.acceptFriendRequest).toHaveBeenCalledWith('req1', undefined)
        })
    })

    describe('Reject Friend Request', () => {
        it('should reject friend request successfully', async () => {
            await friendsServiceV2.initialize()
            await friendsServiceV2.rejectFriendRequest('req1')
            expect(mockMatrixClient.friendsV2.rejectFriendRequest).toHaveBeenCalledWith('req1')
        })
    })

    describe('Remove Friend', () => {
        it('should remove friend successfully', async () => {
            await friendsServiceV2.initialize()
            await friendsServiceV2.removeFriend('@alice:matrix.org')
            expect(mockMatrixClient.friendsV2.removeFriend).toHaveBeenCalledWith('@alice:matrix.org')
        })
    })

    describe('Search Users', () => {
        it('should search users successfully', async () => {
            await friendsServiceV2.initialize()
            const results = await friendsServiceV2.searchUsers('alice', 20)
            expect(results).toHaveLength(1)
            expect(results[0].user_id).toBe('@dave:matrix.org')
        })

        it('should use default limit', async () => {
            await friendsServiceV2.initialize()
            await friendsServiceV2.searchUsers('alice')
            expect(mockMatrixClient.friendsV2.searchUsers).toHaveBeenCalledWith('alice', 20)
        })

        it('should use custom limit', async () => {
            await friendsServiceV2.initialize()
            await friendsServiceV2.searchUsers('alice', 50)
            expect(mockMatrixClient.friendsV2.searchUsers).toHaveBeenCalledWith('alice', 50)
        })

        it('should handle empty search results', async () => {
            mockMatrixClient.friendsV2.searchUsers.mockResolvedValue([])
            await friendsServiceV2.initialize()
            const results = await friendsServiceV2.searchUsers('nonexistent')
            expect(results).toEqual([])
        })
    })

    describe('Cache Management', () => {
        it('should invalidate cache', async () => {
            await friendsServiceV2.initialize()
            await friendsServiceV2.listFriends(true)
            friendsServiceV2.invalidateCache()
            await friendsServiceV2.listFriends(true)

            expect(mockMatrixClient.friendsV2.listFriends).toHaveBeenCalledTimes(2)
        })
    })

    describe('Event Handling', () => {
        it('should emit friend.add event', async () => {
            await friendsServiceV2.initialize()
            const handler = vi.fn()
            friendsServiceV2.on('friend.add', handler)

            // Simulate event from SDK
            const onCallback = mockMatrixClient.friendsV2.on.mock.calls.find(
                (call: any) => call[0] === 'friend.add'
            )?.[1]
            onCallback?.({ friendId: '@alice:matrix.org' })

            // The service should forward the event
            expect(handler).toHaveBeenCalledWith({ friendId: '@alice:matrix.org' })
        })

        it('should emit friend.remove event', async () => {
            await friendsServiceV2.initialize()
            const handler = vi.fn()
            friendsServiceV2.on('friend.remove', handler)

            const onCallback = mockMatrixClient.friendsV2.on.mock.calls.find(
                (call: any) => call[0] === 'friend.remove'
            )?.[1]
            onCallback?.({ friendId: '@alice:matrix.org' })

            expect(handler).toHaveBeenCalledWith({ friendId: '@alice:matrix.org' })
        })

        it('should emit request.received event', async () => {
            await friendsServiceV2.initialize()
            const handler = vi.fn()
            friendsServiceV2.on('request.received', handler)

            const onCallback = mockMatrixClient.friendsV2.on.mock.calls.find(
                (call: any) => call[0] === 'request.received'
            )?.[1]
            onCallback?.(mockPendingRequests[0])

            expect(handler).toHaveBeenCalledWith(mockPendingRequests[0])
        })

        it('should allow unsubscribing from events', async () => {
            await friendsServiceV2.initialize()
            const handler = vi.fn()
            friendsServiceV2.on('friend.add', handler)
            friendsServiceV2.off('friend.add', handler)

            const onCallback = mockMatrixClient.friendsV2.on.mock.calls.find(
                (call: any) => call[0] === 'friend.add'
            )?.[1]
            onCallback?.({ friendId: '@alice:matrix.org' })

            // Handler should not be called after unsubscribe
            expect(handler).not.toHaveBeenCalled()
        })
    })

    describe('Error Handling', () => {
        it('should handle network errors gracefully', async () => {
            mockMatrixClient.friendsV2.listFriends.mockRejectedValue(new Error('Network error'))
            await friendsServiceV2.initialize()
            await expect(friendsServiceV2.listFriends()).rejects.toThrow()
        })

        it('should handle timeout errors', async () => {
            mockMatrixClient.friendsV2.listFriends.mockRejectedValue(new Error('Timeout'))
            await friendsServiceV2.initialize()
            await expect(friendsServiceV2.listFriends()).rejects.toThrow()
        })

        it('should handle invalid responses', async () => {
            mockMatrixClient.friendsV2.listFriends.mockResolvedValue(null as any)
            await friendsServiceV2.initialize()
            const friends = await friendsServiceV2.listFriends()
            expect(friends).toBeNull()
        })
    })
})
