/**
 * Matrix UIA (User-Interactive Authentication) Service
 *
 * Handles operations that require interactive authentication:
 * - Password changes
 * - Account deletion
 * - Email/phone number changes
 * - Other sensitive operations
 *
 * @module matrixUiaService
 */

import { matrixClientService } from '@/matrix/core/client'
import { logger } from '@/utils/logger'

/**
 * UIA Flow types
 */
export type UiaFlowType = 'm.login.password' | 'm.login.email.identity' | 'm.login.msisdn' | 'm.login.dummy'

/**
 * UIA Flow interface
 */
export interface IUiaFlow {
  stages: UiaFlowType[]
}

/**
 * UIA Session data interface
 */
export interface IUiaSession {
  session: string
  flows: IUiaFlow[]
  params?: Record<string, unknown>
}

/**
 * Matrix error response with UIA data
 */
export interface IMatrixUiaError {
  errcode: string
  error?: string
  data?: {
    session?: string
    flows?: IUiaFlow[]
    params?: Record<string, unknown>
  }
  status?: number
}

/**
 * Password change result
 */
export interface IPasswordChangeResult {
  success: boolean
  error?: string
}

/**
 * Account deletion result
 */
export interface IAccountDeletionResult {
  success: boolean
  error?: string
}

/**
 * UIA Auth data interface
 */
export interface IUiaAuthData {
  type: UiaFlowType
  session?: string
  identifier?: {
    type: string
    user: string
  }
  password?: string
}

// Re-export types for convenience
export type UiaFlow = IUiaFlow
export type UiaSession = IUiaSession
export type MatrixUiaError = IMatrixUiaError
export type PasswordChangeResult = IPasswordChangeResult
export type AccountDeletionResult = IAccountDeletionResult
export type UiaAuthData = IUiaAuthData

/**
 * Matrix UIA Service
 */
class MatrixUiaService {
  /**
   * Check if an error is a UIA error
   */
  isUiaError(error: unknown): error is IMatrixUiaError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'errcode' in error &&
      (error as IMatrixUiaError).errcode === 'M_FORBIDDEN' &&
      'data' in error
    )
  }

  /**
   * Extract session from UIA error
   */
  extractSession(error: IMatrixUiaError): string | undefined {
    return error.data?.session
  }

  /**
   * Get available flows from UIA error
   */
  getAvailableFlows(error: IMatrixUiaError): IUiaFlow[] {
    return error.data?.flows || []
  }

  /**
   * Check if a specific flow type is available
   */
  isFlowAvailable(error: IMatrixUiaError, flowType: UiaFlowType): boolean {
    const flows = this.getAvailableFlows(error)
    return flows.some((flow) => flow.stages.includes(flowType))
  }

  /**
   * Change password using UIA if required
   *
   * @param newPassword - The new password
   * @param authData - Optional auth data for UIA
   */
  async changePassword(newPassword: string, authData?: IUiaAuthData): Promise<IPasswordChangeResult> {
    const client = matrixClientService.getClient()
    if (!client) {
      return { success: false, error: 'Matrix client not initialized' }
    }

    try {
      // Try to change password directly first
      const setPasswordMethod = client.setPassword as
        | ((newPassword: string, auth?: unknown) => Promise<unknown>)
        | undefined

      if (!setPasswordMethod) {
        return { success: false, error: 'setPassword method not available' }
      }

      await setPasswordMethod(newPassword, authData)

      logger.info('[MatrixUiaService] Password changed successfully')
      return { success: true }
    } catch (error: unknown) {
      // Check if this is a UIA error
      if (this.isUiaError(error)) {
        logger.warn('[MatrixUiaService] Password change requires UIA', {
          flows: this.getAvailableFlows(error)
        })
        return {
          success: false,
          error: 'UIA_REQUIRED',
          uiaData: {
            session: this.extractSession(error),
            flows: this.getAvailableFlows(error)
          }
        } as IPasswordChangeResult & { uiaData?: unknown }
      }

      logger.error('[MatrixUiaService] Password change failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Change password with user credentials
   *
   * @param oldPassword - The current password for authentication
   * @param newPassword - The new password to set
   */
  async changePasswordWithCredentials(oldPassword: string, newPassword: string): Promise<IPasswordChangeResult> {
    const client = matrixClientService.getClient()
    if (!client) {
      return { success: false, error: 'Matrix client not initialized' }
    }

    // First attempt without auth
    const firstAttempt = await this.changePassword(newPassword)

    // If UIA is required, retry with password auth
    if (!firstAttempt.success && firstAttempt.error === 'UIA_REQUIRED') {
      const result = firstAttempt as IPasswordChangeResult & { uiaData?: { session?: string } }

      const getUserIdMethod = client.getUserId as (() => string) | undefined
      const userId = getUserIdMethod?.() || ''

      const authData: IUiaAuthData = {
        type: 'm.login.password',
        identifier: {
          type: 'm.id.user',
          user: userId
        },
        password: oldPassword,
        session: result.uiaData?.session
      }

      return await this.changePassword(newPassword, authData)
    }

    return firstAttempt
  }

  /**
   * Delete account using UIA if required
   *
   * @param authData - Optional auth data for UIA
   * @param eraseData - Whether to erase all data (default: true)
   */
  async deleteAccount(authData?: IUiaAuthData, eraseData = true): Promise<IAccountDeletionResult> {
    const client = matrixClientService.getClient()
    if (!client) {
      return { success: false, error: 'Matrix client not initialized' }
    }

    try {
      // Get the base URL and access token
      const baseUrl = matrixClientService.getBaseUrl()
      const getAccessTokenMethod = client.getAccessToken as (() => string) | undefined
      const accessToken = getAccessTokenMethod?.()

      if (!baseUrl || !accessToken) {
        return { success: false, error: 'Missing base URL or access token' }
      }

      // Try to delete account directly first
      const url = `${baseUrl}/_matrix/client/v3/account/delete`
      const body: { auth?: unknown; erase?: boolean } = { erase: eraseData }
      if (authData) {
        body.auth = authData
      }

      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        if (errorData.errcode === 'M_FORBIDDEN') {
          throw { ...errorData, status: response.status }
        }
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      logger.info('[MatrixUiaService] Account deleted successfully')
      return { success: true }
    } catch (error: unknown) {
      // Check if this is a UIA error
      if (this.isUiaError(error)) {
        logger.warn('[MatrixUiaService] Account deletion requires UIA', {
          flows: this.getAvailableFlows(error)
        })
        return {
          success: false,
          error: 'UIA_REQUIRED',
          uiaData: {
            session: this.extractSession(error),
            flows: this.getAvailableFlows(error),
            eraseData
          }
        } as IAccountDeletionResult & { uiaData?: unknown }
      }

      logger.error('[MatrixUiaService] Account deletion failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Delete account with user credentials
   *
   * @param password - The user's password for authentication
   * @param eraseData - Whether to erase all data (default: true)
   */
  async deleteAccountWithCredentials(password: string, eraseData = true): Promise<IAccountDeletionResult> {
    const client = matrixClientService.getClient()
    if (!client) {
      return { success: false, error: 'Matrix client not initialized' }
    }

    // First attempt without auth
    const firstAttempt = await this.deleteAccount(undefined, eraseData)

    // If UIA is required, retry with password auth
    if (!firstAttempt.success && firstAttempt.error === 'UIA_REQUIRED') {
      const result = firstAttempt as IAccountDeletionResult & { uiaData?: { session?: string; eraseData?: boolean } }

      const getUserIdMethod = client.getUserId as (() => string) | undefined
      const userId = getUserIdMethod?.() || ''

      const authData: IUiaAuthData = {
        type: 'm.login.password',
        identifier: {
          type: 'm.id.user',
          user: userId
        },
        password,
        session: result.uiaData?.session
      }

      return await this.deleteAccount(authData, result.uiaData?.eraseData)
    }

    return firstAttempt
  }

  /**
   * Execute a UIA flow with provided auth data
   *
   * @param endpoint - The API endpoint to call
   * @param method - HTTP method
   * @param params - Request parameters
   * @param authData - Authentication data
   */
  async executeUiaRequest<T = unknown>(
    endpoint: string,
    method: 'POST' | 'PUT' | 'DELETE' | 'GET' = 'POST',
    params?: Record<string, unknown>,
    authData?: IUiaAuthData
  ): Promise<T> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    const baseUrl = matrixClientService.getBaseUrl()
    const getAccessTokenMethod = client.getAccessToken as (() => string) | undefined
    const accessToken = getAccessTokenMethod?.()

    if (!baseUrl || !accessToken) {
      throw new Error('Missing base URL or access token')
    }

    const url = `${baseUrl}/_matrix/client/v3${endpoint}`
    const body = params ? { ...params, auth: authData } : { auth: authData }

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: method !== 'GET' ? JSON.stringify(body) : undefined
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw { ...errorData, status: response.status }
    }

    return (await response.json()) as T
  }
}

// Export singleton instance
export const matrixUiaService = new MatrixUiaService()
