/**
 * Global Type Definitions
 *
 * Extends global interfaces for platform-specific APIs
 */

// ==================== Performance API Extensions ====================

/**
 * Extended Performance interface with memory API (Chrome-specific)
 */
interface PerformanceWithMemory extends Performance {
  memory?: {
    usedJSHeapSize: number
    totalJSHeapSize: number
    jsHeapSizeLimit: number
  }
}

// ==================== Global Extensions ====================

declare global {
  /**
   * Tauri global object (available when running in Tauri context)
   */
  interface Window {
    __TAURI__?: Record<string, unknown>
    PublicKeyCredential?: typeof PublicKeyCredential
  }

  /**
   * Matrix Client global object
   * Stores the global Matrix client instance for easy access
   */
  interface Window {
    __MATRIX_CLIENT__?: {
      getUserId?(): string
      getAccessToken?(): string
      getHomeserverUrl?(): string
      [key: string]: unknown
    }
  }

  /**
   * Capacitor Plugins
   */
  interface Window {
    Capacitor?: {
      Plugins: {
        BiometricAuth?: {
          isAvailable(): Promise<{ isAvailable: boolean; biometricType?: string }>
          authenticate(options: {
            title?: string
            subtitle?: string
            description?: string
            negativeButtonText?: string
            maxAttempts?: number
          }): Promise<{ success: boolean; error?: string }>
          verify?(options: {
            title?: string
            subtitle?: string
            description?: string
            reason?: string
            negativeButtonText?: string
            maxAttempts?: number
          }): Promise<{ success: boolean; error?: string; biometricType?: string }>
        }
        [key: string]: unknown
      }
      getPlatform(): () => string
    }
  }
}

// ==================== CSS Module Extensions ====================

/**
 * Allow CSS modules with any string index
 */
export interface CSSModule extends Record<string, string> {}

// ==================== Export extended types ====================

export type { PerformanceWithMemory }
