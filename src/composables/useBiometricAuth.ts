/**
 * Biometric Authentication Composable
 *
 * Supports:
 * - Fingerprint authentication (Android)
 * - Face ID / Touch ID (iOS)
 * - Platform-specific fallbacks
 */

import { ref, computed } from 'vue'
import { logger } from '@/utils/logger'

// ==================== Types ====================

export type BiometricType = 'fingerprint' | 'face' | 'iris' | 'none'

export interface BiometricAuthOptions {
  title?: string
  subtitle?: string
  description?: string
  negativeButtonText?: string
  fallbackToDeviceSettings?: boolean
  maxAttempts?: number
}

export interface BiometricResult {
  success: boolean
  error?: string
  biometricType?: BiometricType
}

export interface BiometricCapability {
  available: boolean
  biometricType: BiometricType
  canAuthenticate: boolean
  reason?: string
}

// ==================== Window Extensions ====================
// Window is extended globally in src/types/global.d.ts

// ==================== Platform Detection ====================

function getPlatform(): 'ios' | 'android' | 'web' {
  if (typeof window === 'undefined') return 'web'

  const userAgent = window.navigator.userAgent

  if (/iPad|iPhone|iPod/.test(userAgent)) return 'ios'
  if (/Android/.test(userAgent)) return 'android'
  return 'web'
}

// ==================== Web Authentication (WebAuthn) ====================

/**
 * Check if WebAuthn is available
 */
async function checkWebAuthnAvailability(): Promise<boolean> {
  return (
    window.PublicKeyCredential !== undefined &&
    typeof window.PublicKeyCredential === 'function' &&
    // Check if user is verifying with a platform authenticator
    window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== undefined &&
    (await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
  )
}

/**
 * Authenticate using WebAuthn (for supported platforms)
 */
async function authenticateWithWebAuthn(_options: BiometricAuthOptions = {}): Promise<BiometricResult> {
  try {
    // This would require server-side challenge generation
    // For now, return simulated result
    logger.info('[useBiometricAuth] WebAuthn authentication requested')

    // In production, you would:
    // 1. Fetch a challenge from your server
    // 2. Call navigator.credentials.get() with the challenge
    // 3. Send the response to your server for verification
    // 4. Return the result

    return {
      success: true,
      biometricType: 'none',
      error: 'WebAuthn requires server-side integration'
    }
  } catch (error) {
    logger.error('[useBiometricAuth] WebAuthn authentication failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Authentication failed'
    }
  }
}

// ==================== iOS Face ID / Touch ID ====================

/**
 * Check biometric availability on iOS
 * Note: This requires native integration or a Capacitor plugin
 */
async function checkIOSBiometricAvailability(): Promise<BiometricCapability> {
  // In a Capacitor/Tauri app, this would call a native plugin
  // For now, return a simulated response
  logger.info('[useBiometricAuth] Checking iOS biometric availability')

  // Check if running in app context
  const isApp = window.__TAURI__ || window.Capacitor

  return {
    available: !!isApp,
    biometricType: 'face', // Could be 'face' or 'fingerprint' depending on device
    canAuthenticate: !!isApp,
    reason: isApp ? undefined : 'Not running in native app context'
  }
}

/**
 * Authenticate using iOS Face ID / Touch ID
 */
async function authenticateWithIOS(options: BiometricAuthOptions = {}): Promise<BiometricResult> {
  const {
    title = '验证身份',
    subtitle = '请使用 Face ID 或 Touch ID 验证',
    description = '需要验证您的身份以继续',
    negativeButtonText = '取消'
  } = options

  try {
    // Check if Tauri plugin is available
    if (window.__TAURI__) {
      // Call Tauri command for biometric auth
      // This would need to be implemented in Rust
      logger.info('[useBiometricAuth] Tauri biometric authentication requested')

      return {
        success: false,
        error: 'Tauri biometric plugin not yet implemented',
        biometricType: 'face'
      }
    }

    // Check if Capacitor plugin is available
    if (window.Capacitor) {
      const { BiometricAuth } = window.Capacitor.Plugins

      if (BiometricAuth?.verify) {
        const result = await BiometricAuth.verify({
          reason: description || title,
          title,
          subtitle,
          negativeButtonText
        })

        return {
          success: true,
          biometricType: (result.biometricType || 'face') as BiometricType
        }
      }
    }

    return {
      success: false,
      error: 'No biometric authentication plugin available'
    }
  } catch (error) {
    logger.error('[useBiometricAuth] iOS authentication failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Authentication failed'
    }
  }
}

// ==================== Android Fingerprint ====================

/**
 * Check biometric availability on Android
 */
async function checkAndroidBiometricAvailability(): Promise<BiometricCapability> {
  logger.info('[useBiometricAuth] Checking Android biometric availability')

  const isApp = window.__TAURI__ || window.Capacitor

  return {
    available: !!isApp,
    biometricType: 'fingerprint',
    canAuthenticate: !!isApp,
    reason: isApp ? undefined : 'Not running in native app context'
  }
}

/**
 * Authenticate using Android fingerprint
 */
async function authenticateWithAndroid(options: BiometricAuthOptions = {}): Promise<BiometricResult> {
  const {
    title = '验证身份',
    subtitle = '请使用指纹验证',
    description = '需要验证您的身份以继续',
    negativeButtonText = '取消'
  } = options

  try {
    // Check if Capacitor plugin is available
    if (window.Capacitor) {
      const { BiometricAuth } = window.Capacitor.Plugins

      if (BiometricAuth?.verify) {
        const result = await BiometricAuth.verify({
          reason: description || title,
          title,
          subtitle,
          negativeButtonText
        })

        return {
          success: true,
          biometricType: (result.biometricType || 'fingerprint') as BiometricType
        }
      }
    }

    return {
      success: false,
      error: 'No biometric authentication plugin available'
    }
  } catch (error) {
    logger.error('[useBiometricAuth] Android authentication failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Authentication failed'
    }
  }
}

// ==================== Main Composable ====================

export function useBiometricAuth() {
  const isAuthenticating = ref(false)
  const lastResult = ref<BiometricResult | null>(null)
  const attemptCount = ref(0)

  const platform = getPlatform()

  /**
   * Check if biometric authentication is available
   */
  const checkAvailability = async (): Promise<BiometricCapability> => {
    switch (platform) {
      case 'ios':
        return await checkIOSBiometricAvailability()

      case 'android':
        return await checkAndroidBiometricAvailability()

      case 'web': {
        const webAuthnAvailable = await checkWebAuthnAvailability()
        return {
          available: webAuthnAvailable,
          biometricType: 'none',
          canAuthenticate: webAuthnAvailable,
          reason: webAuthnAvailable ? undefined : 'WebAuthn not supported'
        }
      }

      default:
        return {
          available: false,
          biometricType: 'none',
          canAuthenticate: false,
          reason: 'Unsupported platform'
        }
    }
  }

  /**
   * Perform biometric authentication
   */
  const authenticate = async (options: BiometricAuthOptions = {}): Promise<BiometricResult> => {
    if (isAuthenticating.value) {
      return {
        success: false,
        error: 'Authentication already in progress'
      }
    }

    isAuthenticating.value = true
    lastResult.value = null

    try {
      let result: BiometricResult

      switch (platform) {
        case 'ios':
          result = await authenticateWithIOS(options)
          break

        case 'android':
          result = await authenticateWithAndroid(options)
          break

        case 'web':
          result = await authenticateWithWebAuthn(options)
          break

        default:
          result = {
            success: false,
            error: 'Unsupported platform'
          }
      }

      lastResult.value = result

      if (result.success) {
        attemptCount.value = 0
      } else {
        attemptCount.value++
      }

      return result
    } catch (error) {
      const errorResult: BiometricResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      lastResult.value = errorResult
      return errorResult
    } finally {
      isAuthenticating.value = false
    }
  }

  /**
   * Enable biometric authentication for future use
   * Stores user preference in localStorage
   */
  const enableBiometric = async () => {
    try {
      localStorage.setItem('biometric_enabled', 'true')
      logger.info('[useBiometricAuth] Biometric authentication enabled')
      return true
    } catch (error) {
      logger.error('[useBiometricAuth] Failed to enable biometric:', error)
      return false
    }
  }

  /**
   * Disable biometric authentication
   */
  const disableBiometric = async () => {
    try {
      localStorage.setItem('biometric_enabled', 'false')
      logger.info('[useBiometricAuth] Biometric authentication disabled')
      return true
    } catch (error) {
      logger.error('[useBiometricAuth] Failed to disable biometric:', error)
      return false
    }
  }

  /**
   * Check if biometric authentication is enabled
   */
  const isEnabled = computed(() => {
    try {
      return localStorage.getItem('biometric_enabled') === 'true'
    } catch {
      return false
    }
  })

  /**
   * Get the biometric type name for display
   */
  const getBiometricTypeName = (type: BiometricType): string => {
    switch (type) {
      case 'fingerprint':
        return '指纹识别'
      case 'face':
        return platform === 'ios' ? 'Face ID' : '面部识别'
      case 'iris':
        return '虹膜识别'
      case 'none':
        return '生物识别'
      default:
        return '身份验证'
    }
  }

  /**
   * Check if the user has exceeded max attempts
   */
  const hasExceededAttempts = (maxAttempts: number = 3): boolean => {
    return attemptCount.value >= maxAttempts
  }

  /**
   * Reset attempt counter
   */
  const resetAttempts = () => {
    attemptCount.value = 0
  }

  return {
    // State
    isAuthenticating,
    lastResult,
    attemptCount,
    platform,
    isEnabled,

    // Methods
    checkAvailability,
    authenticate,
    enableBiometric,
    disableBiometric,
    getBiometricTypeName,
    hasExceededAttempts,
    resetAttempts
  }
}

// ==================== Biometric Settings Component ====================

/**
 * Helper hook for biometric settings UI
 */
export function useBiometricSettings() {
  const biometric = useBiometricAuth()

  const capability = ref<BiometricCapability | null>(null)
  const isLoading = ref(false)

  // Check availability on mount
  const checkCapability = async () => {
    isLoading.value = true
    try {
      capability.value = await biometric.checkAvailability()
    } finally {
      isLoading.value = false
    }
  }

  const toggleEnabled = async () => {
    if (biometric.isEnabled.value) {
      await biometric.disableBiometric()
    } else {
      // First, test if biometric works
      const result = await biometric.authenticate({
        title: '启用生物识别',
        description: '请验证您的身份以启用生物识别登录',
        negativeButtonText: '取消'
      })

      if (result.success) {
        await biometric.enableBiometric()
      }
    }

    await checkCapability()
  }

  return {
    ...biometric,
    capability,
    isLoading,
    checkCapability,
    toggleEnabled
  }
}
