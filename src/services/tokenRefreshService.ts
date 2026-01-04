/**
 * Token Refresh Service
 * Handles Matrix access token refresh and session recovery
 */

import { matrixClientService } from '@/integrations/matrix/client'
import { useUserStore } from '@/stores/user'
import { logger } from '@/utils/logger'
import type { MatrixCredentials, UserInfoType } from './types'

/** Error type that can be thrown from refresh operations */
export type RefreshError = unknown

/** Extended user info with token field */
export interface UserInfoWithToken extends UserInfoType {
  token?: string
}

export interface TokenRefreshOptions {
  /** Force refresh even if token is still valid */
  force?: boolean
  /** Silent refresh without showing errors to user */
  silent?: boolean
}

export interface SessionInfo {
  /** Access token */
  accessToken: string
  /** Refresh token */
  refreshToken: string
  /** Device ID */
  deviceId: string
  /** User ID */
  userId: string
  /** Homeserver URL */
  homeserver: string
  /** Token expiration time */
  expiresAt?: number
  /** Last refresh time */
  lastRefresh: number
}

/**
 * Token refresh service class
 */
export class TokenRefreshService {
  private static instance: TokenRefreshService
  private refreshPromise: Promise<string> | null = null
  private refreshTimer: ReturnType<typeof setInterval> | null = null
  private readonly REFRESH_BUFFER = 5 * 60 * 1000 // 5 minutes before expiration
  private readonly MAX_RETRY_ATTEMPTS = 3

  static getInstance(): TokenRefreshService {
    if (!TokenRefreshService.instance) {
      TokenRefreshService.instance = new TokenRefreshService()
    }
    return TokenRefreshService.instance
  }

  /**
   * Initialize the token refresh service
   */
  async initialize(credentials: MatrixCredentials): Promise<void> {
    try {
      logger.info('[TokenRefreshService] Initializing token refresh service')

      // Store session info
      const sessionInfo: SessionInfo = {
        accessToken: credentials.accessToken || '',
        refreshToken: credentials.refreshToken || '',
        deviceId: credentials.deviceId || '',
        userId: credentials.userId || '',
        homeserver: credentials.homeserver || '',
        lastRefresh: Date.now()
      }

      if (credentials.expiresAt !== undefined) {
        sessionInfo.expiresAt = credentials.expiresAt
      }

      // Save to secure storage
      await this.saveSessionInfo(sessionInfo)

      // Setup automatic refresh
      this.setupAutomaticRefresh(sessionInfo)

      logger.info('[TokenRefreshService] Token refresh service initialized')
    } catch (error) {
      logger.error('[TokenRefreshService] Failed to initialize:', error)
      throw error
    }
  }

  /**
   * Refresh the access token
   */
  async refreshToken(options: TokenRefreshOptions = {}): Promise<string> {
    // If already refreshing, return the existing promise
    if (this.refreshPromise && !options.force) {
      return this.refreshPromise
    }

    this.refreshPromise = this.performTokenRefresh(options)

    try {
      const newToken = await this.refreshPromise
      return newToken
    } finally {
      this.refreshPromise = null
    }
  }

  /**
   * Perform the actual token refresh
   */
  private async performTokenRefresh(options: TokenRefreshOptions): Promise<string> {
    try {
      const sessionInfo = await this.getSessionInfo()
      if (!sessionInfo || !sessionInfo.refreshToken) {
        throw new Error('No refresh token available')
      }

      // Check if refresh is needed
      if (!options.force && this.isTokenValid(sessionInfo)) {
        return sessionInfo.accessToken
      }

      logger.info('[TokenRefreshService] Refreshing access token')

      // Call the refresh endpoint
      const response = await fetch(`${sessionInfo.homeserver}/_matrix/client/r0/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionInfo.refreshToken}`
        },
        body: JSON.stringify({
          refresh_token: sessionInfo.refreshToken
        })
      })

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.statusText}`)
      }

      const data = await response.json()

      if (!data.access_token) {
        throw new Error('No access token in refresh response')
      }

      // Update session info
      const updatedSession: SessionInfo = {
        ...sessionInfo,
        accessToken: data.access_token,
        expiresAt: data.expires_in_ms ? Date.now() + data.expires_in_ms : undefined,
        lastRefresh: Date.now()
      }

      // Update Matrix client
      const client = matrixClientService.getClient()
      if (client) {
        const setAccessTokenMethod = client.setAccessToken as ((token: string) => void) | undefined
        setAccessTokenMethod?.(data.access_token)
      }

      // Save updated session
      await this.saveSessionInfo(updatedSession)

      const userStore = useUserStore()
      // Extend userInfo with token field
      userStore.userInfo = {
        ...(userStore.userInfo || {}),
        token: data.access_token
      } as UserInfoWithToken

      logger.info('[TokenRefreshService] Token refreshed successfully')

      return data.access_token
    } catch (error) {
      logger.error('[TokenRefreshService] Token refresh failed:', error)

      if (!options.silent) {
        // Show error to user or attempt re-login
        await this.handleRefreshFailure(error)
      }

      throw error
    }
  }

  /**
   * Check if the current token is valid
   */
  private isTokenValid(sessionInfo: SessionInfo): boolean {
    if (!sessionInfo.expiresAt) {
      // If no expiration, assume valid
      return true
    }

    // Check if token expires within the buffer time
    const expiresSoon = sessionInfo.expiresAt - Date.now() < this.REFRESH_BUFFER
    return !expiresSoon
  }

  /**
   * Setup automatic token refresh
   */
  private setupAutomaticRefresh(_sessionInfo: SessionInfo): void {
    // Clear existing timer
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
    }

    // Check every minute if token needs refresh
    this.refreshTimer = setInterval(async () => {
      try {
        const currentSession = await this.getSessionInfo()
        if (currentSession && !this.isTokenValid(currentSession)) {
          await this.refreshToken({ silent: true })
        }
      } catch (error) {
        logger.error('[TokenRefreshService] Automatic refresh failed:', error)
      }
    }, 60 * 1000) // Check every minute
  }

  /**
   * Handle refresh failure
   */
  private async handleRefreshFailure(error: RefreshError): Promise<void> {
    logger.error('[TokenRefreshService] Handling refresh failure:', error)

    // Check if error has message property
    const errorMessage = error instanceof Error ? error.message : String(error)

    // If refresh token is invalid, need to re-login
    if (errorMessage.includes('invalid_grant') || errorMessage.includes('Invalid refresh token')) {
      logger.warn('[TokenRefreshService] Refresh token invalid, requiring re-login')

      // Clear stored session
      await this.clearSession()

      // Emit event for re-login
      const event = new CustomEvent('matrix-reauth-required', {
        detail: { reason: 'refresh_token_invalid' }
      })
      window.dispatchEvent(event)

      return
    }

    // For other errors, try retrying
    let retryCount = 0
    while (retryCount < this.MAX_RETRY_ATTEMPTS) {
      retryCount++

      try {
        logger.info(`[TokenRefreshService] Retry attempt ${retryCount}/${this.MAX_RETRY_ATTEMPTS}`)

        // Wait before retrying (exponential backoff)
        await new Promise((resolve) => setTimeout(resolve, 2 ** retryCount * 1000))

        await this.refreshToken({ silent: true })
        logger.info('[TokenRefreshService] Retry successful')
        return
      } catch (retryError) {
        logger.error(`[TokenRefreshService] Retry ${retryCount} failed:`, retryError)
      }
    }

    // All retries failed, require re-login
    logger.error('[TokenRefreshService] All retry attempts failed, requiring re-login')
    const event = new CustomEvent('matrix-reauth-required', {
      detail: { reason: 'refresh_failed', error }
    })
    window.dispatchEvent(event)
  }

  /**
   * Save session info to secure storage
   */
  private async saveSessionInfo(sessionInfo: SessionInfo): Promise<void> {
    try {
      // In a real app, use secure storage like Tauri's secure storage
      // For now, use localStorage with encryption
      const encrypted = btoa(JSON.stringify(sessionInfo))
      localStorage.setItem('matrix_session', encrypted)
    } catch (error) {
      logger.error('[TokenRefreshService] Failed to save session info:', error)
    }
  }

  /**
   * Get session info from storage
   */
  private async getSessionInfo(): Promise<SessionInfo | null> {
    try {
      const encrypted = localStorage.getItem('matrix_session')
      if (!encrypted) return null

      const decrypted = atob(encrypted)
      return JSON.parse(decrypted)
    } catch (error) {
      logger.error('[TokenRefreshService] Failed to get session info:', error)
      return null
    }
  }

  /**
   * Clear stored session
   */
  private async clearSession(): Promise<void> {
    try {
      localStorage.removeItem('matrix_session')

      // Clear any Matrix client data
      const client = matrixClientService.getClient()
      if (client) {
        const stopClientMethod = client.stopClient as (() => Promise<void>) | undefined
        await stopClientMethod?.()
        const clearStoresMethod = client.clearStores as (() => void) | undefined
        clearStoresMethod?.()
      }
    } catch (error) {
      logger.error('[TokenRefreshService] Failed to clear session:', error)
    }
  }

  /**
   * Recover session from storage
   */
  async recoverSession(): Promise<MatrixCredentials | null> {
    try {
      const sessionInfo = await this.getSessionInfo()
      if (!sessionInfo) {
        return null
      }

      // Check if token is expired and needs refresh
      if (!this.isTokenValid(sessionInfo)) {
        logger.info('[TokenRefreshService] Session token expired, attempting refresh')
        await this.refreshToken()

        // Get updated session info
        const updatedSession = await this.getSessionInfo()
        if (!updatedSession) {
          return null
        }

        return {
          accessToken: updatedSession.accessToken,
          refreshToken: updatedSession.refreshToken,
          deviceId: updatedSession.deviceId,
          userId: updatedSession.userId,
          homeserver: updatedSession.homeserver,
          baseUrl: updatedSession.homeserver
        }
      }

      return {
        accessToken: sessionInfo.accessToken,
        refreshToken: sessionInfo.refreshToken,
        deviceId: sessionInfo.deviceId,
        userId: sessionInfo.userId,
        homeserver: sessionInfo.homeserver,
        baseUrl: sessionInfo.homeserver
      }
    } catch (error) {
      logger.error('[TokenRefreshService] Failed to recover session:', error)
      return null
    }
  }

  /**
   * Logout and clear session
   */
  async logout(): Promise<void> {
    try {
      logger.info('[TokenRefreshService] Logging out')

      // Clear refresh timer
      if (this.refreshTimer) {
        clearInterval(this.refreshTimer)
        this.refreshTimer = null
      }

      // Clear stored session
      await this.clearSession()

      logger.info('[TokenRefreshService] Logged out successfully')
    } catch (error) {
      logger.error('[TokenRefreshService] Failed to logout:', error)
      throw error
    }
  }

  /**
   * Get session status
   */
  async getSessionStatus(): Promise<{
    isLoggedIn: boolean
    tokenValid: boolean
    expiresAt?: number
    lastRefresh?: number
  }> {
    const sessionInfo = await this.getSessionInfo()

    if (!sessionInfo) {
      return {
        isLoggedIn: false,
        tokenValid: false
      }
    }

    const result: {
      isLoggedIn: boolean
      tokenValid: boolean
      expiresAt?: number
      lastRefresh?: number
    } = {
      isLoggedIn: true,
      tokenValid: this.isTokenValid(sessionInfo)
    }
    if (sessionInfo.expiresAt !== undefined) {
      result.expiresAt = sessionInfo.expiresAt
    }
    if (sessionInfo.lastRefresh !== undefined) {
      result.lastRefresh = sessionInfo.lastRefresh
    }
    return result
  }
}

// Export singleton instance
export const tokenRefreshService = TokenRefreshService.getInstance()
