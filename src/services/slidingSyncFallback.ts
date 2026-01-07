/**
 * SlidingSync Fallback Strategy
 * Handles server capability detection and automatic fallback to traditional sync
 *
 * @module services/slidingSyncFallback
 */

import { ref, computed } from 'vue'
import { logger } from '@/utils/logger'
import { matrixClientService } from '@/integrations/matrix/client'
import { useSlidingSyncStore } from '@/stores/slidingSync'
import type { ServerCapabilities, SyncMode, FallbackConfig } from '@/types/sliding-sync'

/**
 * Matrix client interface for capability detection
 */
interface MatrixClient {
  supportsLazyLoading?: boolean
  getCrypto?: () => unknown
}

/**
 * Fallback Strategy Service
 * Manages sync mode selection and automatic fallback
 */
export class SlidingSyncFallbackService {
  private static instance: SlidingSyncFallbackService

  // Server capabilities (cached)
  private capabilities = ref<ServerCapabilities>({
    slidingSync: false,
    traditionalSync: true,
    lazyLoading: false,
    e2ee: false
  })

  // Current sync mode
  private currentMode = ref<SyncMode>('traditional')

  // Detection state
  private detectionInProgress = false
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: Tracks retry attempts for server detection
  private _detectionAttempts = 0

  // Configuration
  private config: FallbackConfig = {
    autoDetect: true,
    allowHybrid: false, // Disabled by default until fully tested
    fallbackOnError: true,
    maxRetries: 3
  }

  // Error tracking
  private errorCount = 0
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: Stores last error for debugging and retry logic
  private _lastError: Error | null = null

  /**
   * Get singleton instance
   */
  static getInstance(): SlidingSyncFallbackService {
    if (!SlidingSyncFallbackService.instance) {
      SlidingSyncFallbackService.instance = new SlidingSyncFallbackService()
    }
    return SlidingSyncFallbackService.instance
  }

  /**
   * Set configuration
   */
  setConfig(config: Partial<FallbackConfig>): void {
    this.config = { ...this.config, ...config }
    logger.debug('[FallbackService] Config updated:', this.config)
  }

  /**
   * Get current sync mode
   */
  getMode(): SyncMode {
    return this.currentMode.value
  }

  /**
   * Check if using Sliding Sync
   */
  isSlidingSync(): boolean {
    return this.currentMode.value === 'sliding-sync' || this.currentMode.value === 'hybrid'
  }

  /**
   * Check if using traditional sync
   */
  isTraditional(): boolean {
    return this.currentMode.value === 'traditional' || this.currentMode.value === 'hybrid'
  }

  /**
   * Get server capabilities
   */
  getCapabilities(): ServerCapabilities {
    return this.capabilities.value
  }

  /**
   * Detect server capabilities
   */
  async detectCapabilities(): Promise<ServerCapabilities> {
    if (this.detectionInProgress) {
      logger.debug('[FallbackService] Detection already in progress')
      return this.capabilities.value
    }

    this.detectionInProgress = true
    this._detectionAttempts++

    try {
      logger.info('[FallbackService] Detecting server capabilities...')

      const client = await matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not available')
      }

      // Check Sliding Sync proxy from env
      const proxyUrl = import.meta.env.VITE_MATRIX_SLIDING_SYNC_PROXY

      // Detect capabilities
      const capabilities: ServerCapabilities = {
        slidingSync: !!proxyUrl,
        traditionalSync: true,
        lazyLoading: await this.detectLazyLoading(client),
        e2ee: await this.detectE2EE(client),
        slidingSyncProxy: proxyUrl || undefined
      }

      this.capabilities.value = capabilities

      logger.info('[FallbackService] Server capabilities detected:', capabilities)

      // Select appropriate mode
      await this.selectMode()

      return capabilities
    } catch (error) {
      logger.error('[FallbackService] Failed to detect capabilities:', error)
      // Fallback to traditional sync on error
      this.currentMode.value = 'traditional'
      return this.capabilities.value
    } finally {
      this.detectionInProgress = false
    }
  }

  /**
   * Select sync mode based on capabilities and configuration
   */
  private async selectMode(): Promise<void> {
    const { forceMode, allowHybrid } = this.config

    // Force specific mode if configured
    if (forceMode) {
      logger.info('[FallbackService] Using forced mode:', forceMode)
      this.currentMode.value = forceMode

      if (forceMode === 'sliding-sync' || forceMode === 'hybrid') {
        await this.initializeSlidingSync()
      }

      return
    }

    // Auto-detect mode
    const caps = this.capabilities.value

    if (caps.slidingSync && caps.slidingSyncProxy) {
      if (allowHybrid) {
        logger.info('[FallbackService] Selected hybrid mode')
        this.currentMode.value = 'hybrid'
      } else {
        logger.info('[FallbackService] Selected Sliding Sync mode')
        this.currentMode.value = 'sliding-sync'
      }

      await this.initializeSlidingSync()
    } else {
      logger.info('[FallbackService] Selected traditional sync mode')
      this.currentMode.value = 'traditional'
    }
  }

  /**
   * Initialize Sliding Sync
   */
  private async initializeSlidingSync(): Promise<void> {
    try {
      const store = useSlidingSyncStore()
      const proxyUrl = this.capabilities.value.slidingSyncProxy

      if (!proxyUrl) {
        throw new Error('Sliding Sync proxy URL not configured')
      }

      logger.info('[FallbackService] Initializing Sliding Sync...')

      await store.initialize(proxyUrl)
      await store.start()

      logger.info('[FallbackService] Sliding Sync initialized successfully')
    } catch (error) {
      logger.error('[FallbackService] Failed to initialize Sliding Sync:', error)

      if (this.config.fallbackOnError) {
        logger.warn('[FallbackService] Falling back to traditional sync')
        this.currentMode.value = 'traditional'
      }

      throw error
    }
  }

  /**
   * Report error from current sync mode
   */
  async reportError(error: Error): Promise<void> {
    this.errorCount++
    this._lastError = error

    logger.warn('[FallbackService] Error reported:', {
      mode: this.currentMode.value,
      errorCount: this.errorCount,
      error
    })

    // Fallback if too many errors
    if (this.config.fallbackOnError && this.errorCount >= this.config.maxRetries) {
      logger.warn('[FallbackService] Too many errors, falling back to traditional sync')

      this.currentMode.value = 'traditional'
      this.errorCount = 0

      // Stop Sliding Sync if running
      try {
        const store = useSlidingSyncStore()
        store.stop()
      } catch (e) {
        logger.error('[FallbackService] Failed to stop Sliding Sync:', e)
      }
    }
  }

  /**
   * Reset error tracking
   */
  resetErrors(): void {
    this.errorCount = 0
    this._lastError = null
  }

  /**
   * Detect lazy loading support
   */
  private async detectLazyLoading(client: MatrixClient): Promise<boolean> {
    try {
      // Check if client supports lazy loading
      // This is a simplified check - real implementation would check server versions
      return client?.supportsLazyLoading || false
    } catch {
      return false
    }
  }

  /**
   * Detect E2EE support
   */
  private async detectE2EE(client: MatrixClient): Promise<boolean> {
    try {
      // Check if client supports E2EE
      return client?.getCrypto?.() !== undefined
    } catch {
      return false
    }
  }

  /**
   * Get sync mode as a reactive computed
   */
  getModeComputed() {
    return computed(() => this.currentMode.value)
  }

  /**
   * Get capabilities as a reactive computed
   */
  getCapabilitiesComputed() {
    return computed(() => this.capabilities.value)
  }
}

// Export singleton instance
export const slidingSyncFallback = SlidingSyncFallbackService.getInstance()

// Export convenience functions
export function getSyncMode(): SyncMode {
  return slidingSyncFallback.getMode()
}

export function isSlidingSyncMode(): boolean {
  return slidingSyncFallback.isSlidingSync()
}

export function isTraditionalMode(): boolean {
  return slidingSyncFallback.isTraditional()
}

export async function detectServerCapabilities(): Promise<ServerCapabilities> {
  return slidingSyncFallback.detectCapabilities()
}

export function reportSyncError(error: Error): Promise<void> {
  return slidingSyncFallback.reportError(error)
}
