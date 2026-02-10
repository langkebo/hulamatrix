/**
 * Authentication API Service
 * Replaces deprecated ImRequestUtils auth-related functions
 */

import MatrixClientService from '../matrix/MatrixClientService'
import type {
  ForgotPasswordParams,
  CaptchaParams,
  CaptchaResponse,
  LogoutParams,
  RegisterParams,
  RegisterResponse,
  CheckQRStatusParams,
  CheckQRStatusResponse,
  GenerateQRCodeParams,
  GenerateQRCodeResponse,
  ScanQRCodeParams,
  ScanQRCodeResponse,
  ConfirmQRCodeParams
} from './types'

class AuthApiService {
  /**
   * Send captcha code for password reset
   * @deprecated Mock function - needs backend implementation
   */
  async sendCaptcha(_params: CaptchaParams): Promise<CaptchaResponse> {
    console.warn('[AuthApiService] sendCaptcha called - needs implementation')
    // TODO: Implement with MatrixClientService or backend API
    return { code: 200, data: { ticket: 'mock-ticket' } }
  }

  /**
   * Get captcha for verification
   * @deprecated Mock function - needs backend implementation
   */
  async getCaptcha(): Promise<CaptchaResponse> {
    console.warn('[AuthApiService] getCaptcha called - needs implementation')
    // TODO: Implement with MatrixClientService or backend API
    return { code: 200, data: { ticket: 'mock-ticket' } }
  }

  /**
   * Register new user
   * @deprecated Mock function - needs backend implementation
   */
  async register(params: RegisterParams): Promise<RegisterResponse> {
    console.warn('[AuthApiService] register called - needs implementation')
    // TODO: Implement with MatrixClientService or backend API
    // Matrix doesn't have a built-in registration API, needs backend or custom homeserver
    return {
      code: 200,
      data: {
        uid: `@${params.username}:example.com`,
        userId: `@${params.username}:example.com`,
        accessToken: 'mock-token',
        deviceId: params.deviceId || 'mock-device'
      }
    }
  }

  /**
   * Reset password with captcha
   * @deprecated Mock function - needs backend implementation
   */
  async forgetPassword(_params: ForgotPasswordParams): Promise<{ success: boolean }> {
    console.warn('[AuthApiService] forgetPassword called - needs implementation')
    // TODO: Implement with MatrixClientService or backend API
    return { success: true }
  }

  /**
   * Logout from Matrix
   */
  async logout(_params?: LogoutParams): Promise<void> {
    const clientService = MatrixClientService.getInstance()

    try {
      await clientService.destroyClient()
      // TODO: Handle autoLogin parameter if needed
    } catch (error) {
      console.error('[AuthApiService] Logout failed:', error)
      throw error
    }
  }

  /**
   * Check QR code scan status
   * @deprecated Mock function - needs backend QR code login system implementation
   */
  async checkQRStatus(params: CheckQRStatusParams): Promise<CheckQRStatusResponse> {
    console.log('[AuthApiService] checkQRStatus called with:', params)
    // TODO: Implement with backend QR code login system
    return { code: 200, status: 'PENDING' }
  }

  /**
   * Generate QR code for login
   * @deprecated Mock function - needs backend QR code login system implementation
   */
  async generateQRCode(params: GenerateQRCodeParams): Promise<GenerateQRCodeResponse> {
    console.log('[AuthApiService] generateQRCode called with:', params)
    // TODO: Implement with backend QR code login system
    return {
      code: 200,
      data: {
        qrId: `mock-qr-${Date.now()}`,
        deviceHash: 'mock-device-hash',
        expireTime: 300,
        deviceType: 'PC',
        locPlace: '深圳'
      }
    }
  }

  /**
   * Scan QR code
   * @deprecated Mock function - needs backend QR code login system implementation
   */
  async scanQRCodeAPI(params: ScanQRCodeParams): Promise<ScanQRCodeResponse> {
    console.log('[AuthApiService] scanQRCodeAPI called with:', params)
    // TODO: Implement with backend QR code login system
    return {
      code: 200,
      data: {
        ip: '192.168.1.1',
        expireTime: 300
      }
    }
  }

  /**
   * Confirm QR code login
   * @deprecated Mock function - needs backend QR code login system implementation
   */
  async confirmQRCodeAPI(params: ConfirmQRCodeParams): Promise<{ code: number; success: boolean }> {
    console.log('[AuthApiService] confirmQRCodeAPI called with:', params)
    // TODO: Implement with backend QR code login system
    return { code: 200, success: true }
  }
}

export default new AuthApiService()
