/**
 * Matrix Enhanced V2 Features Bridge
 *
 * Sets up and initializes the enhanced v2 API clients (friendsV2, privateChatV2)
 * that use the new RESTful API endpoints.
 *
 * API Changes:
 * - Friends API: /_synapse/client/friends → /_synapse/client/enhanced/friends
 * - Private Chat API: /_synapse/client/private → /_synapse/client/enhanced/private
 * - HTTP methods: DELETE for remove operations instead of POST
 */

import { matrixClientService } from './client'
import { logger } from '@/utils/logger'
import { friendsServiceV2 } from '@/services/friendsServiceV2'
import { privateChatServiceV2 } from '@/services/privateChatServiceV2'

/**
 * Setup function for enhanced v2 features
 * This initializes the friendsV2 and privateChatV2 services
 */
export async function setupEnhancedV2Features(): Promise<void> {
    try {
        // Get the Matrix client instance
        const client = matrixClientService.getClient()
        if (!client) {
            logger.warn('[EnhancedV2] Matrix client not available, skipping v2 initialization')
            return
        }

        // Check if v2 clients are available
        const matrixClient = client as any
        if (!matrixClient.friendsV2 || !matrixClient.privateChatV2) {
            logger.warn(
                '[EnhancedV2] v2 clients not available. Please ensure matrix-js-sdk version is 39.1.3 or higher'
            )
            return
        }

        // Initialize Friends Service V2
        await friendsServiceV2.initialize()
        logger.info('[EnhancedV2] Friends v2 service initialized')

        // Initialize Private Chat Service V2
        await privateChatServiceV2.initialize()
        logger.info('[EnhancedV2] Private Chat v2 service initialized')

        // Log API endpoint information
        logger.info('[EnhancedV2] Using RESTful API endpoints:', {
            friends: '/_synapse/client/enhanced/friends/*',
            privateChat: '/_synapse/client/enhanced/private/*'
        })
    } catch (error) {
        logger.error('[EnhancedV2] Failed to initialize enhanced v2 features', { error })
        throw error
    }
}

/**
 * Cleanup function for enhanced v2 features
 */
export function disposeEnhancedV2Features(): void {
    try {
        // Dispose Private Chat Service (stops polling, clears cache)
        privateChatServiceV2.dispose()
        logger.info('[EnhancedV2] Private Chat v2 service disposed')
    } catch (error) {
        logger.error('[EnhancedV2] Failed to dispose enhanced v2 features', { error })
    }
}

/**
 * Get v2 feature availability status
 */
export function getV2FeatureStatus(): {
    available: boolean
    friendsAvailable: boolean
    privateChatAvailable: boolean
} {
    try {
        const client = matrixClientService.getClient()
        if (!client) {
            return { available: false, friendsAvailable: false, privateChatAvailable: false }
        }

        const matrixClient = client as any
        return {
            available: !!matrixClient.friendsV2 || !!matrixClient.privateChatV2,
            friendsAvailable: !!matrixClient.friendsV2,
            privateChatAvailable: !!matrixClient.privateChatV2
        }
    } catch {
        return { available: false, friendsAvailable: false, privateChatAvailable: false }
    }
}
