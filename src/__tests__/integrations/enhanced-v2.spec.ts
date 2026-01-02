/**
 * Enhanced V2 Bridge Tests
 *
 * Tests for the setupEnhancedV2Features function which initializes
 * the v2 API clients and services.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setupEnhancedV2Features, disposeEnhancedV2Features, getV2FeatureStatus } from '@/integrations/matrix/enhanced-v2'
import { friendsServiceV2 } from '@/services/friendsServiceV2'
import { privateChatServiceV2 } from '@/services/privateChatServiceV2'

// Mock matrixClientService
const mockMatrixClient = {
    friendsV2: {
        listFriends: vi.fn(),
        sendFriendRequest: vi.fn(),
        acceptFriendRequest: vi.fn(),
        rejectFriendRequest: vi.fn(),
        removeFriend: vi.fn(),
        searchUsers: vi.fn(),
        getCategories: vi.fn(),
        getPendingRequests: vi.fn(),
        on: vi.fn(),
        off: vi.fn()
    },
    privateChatV2: {
        listSessions: vi.fn(),
        createSession: vi.fn(),
        deleteSession: vi.fn(),
        sendText: vi.fn(),
        getMessages: vi.fn(),
        subscribeToMessages: vi.fn(),
        on: vi.fn(),
        off: vi.fn()
    },
    on: vi.fn(),
    off: vi.fn()
}

vi.mock('@/integrations/matrix/client', () => ({
    matrixClientService: {
        getClient: vi.fn(() => mockMatrixClient)
    }
}))

// Mock services
vi.mock('@/services/friendsServiceV2', () => ({
    friendsServiceV2: {
        initialize: vi.fn().mockResolvedValue(undefined),
        on: vi.fn(),
        off: vi.fn()
    }
}))

vi.mock('@/services/privateChatServiceV2', () => ({
    privateChatServiceV2: {
        initialize: vi.fn().mockResolvedValue(undefined),
        dispose: vi.fn()
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

describe('Enhanced V2 Bridge', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    describe('setupEnhancedV2Features', () => {
        it('should initialize friends service v2', async () => {
            await setupEnhancedV2Features()
            expect(friendsServiceV2.initialize).toHaveBeenCalled()
        })

        it('should initialize private chat service v2', async () => {
            await setupEnhancedV2Features()
            expect(privateChatServiceV2.initialize).toHaveBeenCalled()
        })

        it('should log successful initialization', async () => {
            const { logger } = await import('@/utils/logger')
            await setupEnhancedV2Features()
            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining('[EnhancedV2]')
            )
        })

        it('should handle missing matrix client gracefully', async () => {
            const { matrixClientService } = await import('@/integrations/matrix/client')
            vi.mocked(matrixClientService.getClient).mockReturnValue(null as any)

            const { logger } = await import('@/utils/logger')
            await setupEnhancedV2Features()

            expect(logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Matrix client not available')
            )
        })

        it('should handle missing v2 clients gracefully', async () => {
            const { matrixClientService } = await import('@/integrations/matrix/client')
            vi.mocked(matrixClientService.getClient).mockReturnValue({
                friendsV2: null,
                privateChatV2: null
            } as any)

            const { logger } = await import('@/utils/logger')
            await setupEnhancedV2Features()

            expect(logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('v2 clients not available')
            )
        })

        it('should handle initialization errors', async () => {
            vi.mocked(friendsServiceV2.initialize).mockRejectedValue(new Error('Init failed'))

            const { logger } = await import('@/utils/logger')
            await expect(setupEnhancedV2Features()).rejects.toThrow()
            expect(logger.error).toHaveBeenCalled()
        })

        it('should use correct API endpoints', async () => {
            const { logger } = await import('@/utils/logger')
            await setupEnhancedV2Features()

            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining('Using RESTful API endpoints'),
                expect.objectContaining({
                    friends: '/_synapse/client/enhanced/friends/*',
                    privateChat: '/_synapse/client/enhanced/private/*'
                })
            )
        })
    })

    describe('disposeEnhancedV2Features', () => {
        it('should dispose private chat service', () => {
            disposeEnhancedV2Features()
            expect(privateChatServiceV2.dispose).toHaveBeenCalled()
        })

        it('should log successful disposal', () => {
            const { logger } = require('@/utils/logger')
            disposeEnhancedV2Features()
            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining('[EnhancedV2]')
            )
        })

        it('should handle dispose errors gracefully', () => {
            vi.mocked(privateChatServiceV2.dispose).mockImplementation(() => {
                throw new Error('Dispose failed')
            })

            const { logger } = require('@/utils/logger')
            disposeEnhancedV2Features()

            expect(logger.error).toHaveBeenCalled()
        })
    })

    describe('getV2FeatureStatus', () => {
        it('should return available status when v2 clients exist', () => {
            const status = getV2FeatureStatus()
            expect(status.available).toBe(true)
            expect(status.friendsAvailable).toBe(true)
            expect(status.privateChatAvailable).toBe(true)
        })

        it('should return unavailable status when matrix client is null', async () => {
            const { matrixClientService } = await import('@/integrations/matrix/client')
            vi.mocked(matrixClientService.getClient).mockReturnValue(null as any)

            const status = getV2FeatureStatus()
            expect(status.available).toBe(false)
            expect(status.friendsAvailable).toBe(false)
            expect(status.privateChatAvailable).toBe(false)
        })

        it('should return partial availability when only friends is available', async () => {
            const { matrixClientService } = await import('@/integrations/matrix/client')
            vi.mocked(matrixClientService.getClient).mockReturnValue({
                friendsV2: {},
                privateChatV2: null
            } as any)

            const status = getV2FeatureStatus()
            expect(status.available).toBe(true)
            expect(status.friendsAvailable).toBe(true)
            expect(status.privateChatAvailable).toBe(false)
        })

        it('should return partial availability when only privateChat is available', async () => {
            const { matrixClientService } = await import('@/integrations/matrix/client')
            vi.mocked(matrixClientService.getClient).mockReturnValue({
                friendsV2: null,
                privateChatV2: {}
            } as any)

            const status = getV2FeatureStatus()
            expect(status.available).toBe(true)
            expect(status.friendsAvailable).toBe(false)
            expect(status.privateChatAvailable).toBe(true)
        })

        it('should handle errors gracefully', async () => {
            const { matrixClientService } = await import('@/integrations/matrix/client')
            vi.mocked(matrixClientService.getClient).mockImplementation(() => {
                throw new Error('Error')
            })

            const status = getV2FeatureStatus()
            expect(status.available).toBe(false)
        })
    })

    describe('Integration with Matrix Bridges', () => {
        it('should be callable from setupMatrixBridges', async () => {
            // This tests that setupEnhancedV2Features can be safely called
            // from the main setupMatrixBridges function
            const { setupMatrixBridges } = await import('@/integrations/matrix')

            // Mock the other bridge functions to avoid side effects
            vi.spyOn(await import('@/integrations/matrix/rooms'), 'setupMatrixRoomBridge').mockImplementation(() => {})
            vi.spyOn(await import('@/integrations/matrix/messages'), 'setupMatrixMessageBridge').mockImplementation(() => {})
            vi.spyOn(await import('@/integrations/matrix/notifications'), 'setupMatrixNotificationBridge').mockImplementation(() => {})
            vi.spyOn(await import('@/integrations/matrix/media'), 'setupMatrixMediaBridge').mockImplementation(() => {})
            vi.spyOn(await import('@/integrations/matrix/threads'), 'setupMatrixThreadsBridge').mockImplementation(() => {})
            vi.spyOn(await import('@/integrations/matrix/rtc'), 'setupMatrixRtcBridge').mockImplementation(() => {})
            vi.spyOn(await import('@/integrations/matrix/typing'), 'setupMatrixTypingBridge').mockImplementation(() => {})
            vi.spyOn(await import('@/integrations/matrix/event-bus'), 'setupMatrixEventBus').mockImplementation(() => {})

            // Should not throw
            await expect(setupMatrixBridges()).resolves.not.toThrow()
        })
    })

    describe('API Endpoint Information', () => {
        it('should log correct RESTful API endpoints', async () => {
            const { logger } = await import('@/utils/logger')
            await setupEnhancedV2Features()

            const infoCalls = vi.mocked(logger.info).mock.calls
            const endpointLog = infoCalls.find(call =>
                call[0]?.includes('Using RESTful API endpoints')
            )

            expect(endpointLog).toBeDefined()
            expect(endpointLog?.[1]).toMatchObject({
                friends: '/_synapse/client/enhanced/friends/*',
                privateChat: '/_synapse/client/enhanced/private/*'
            })
        })
    })
})
