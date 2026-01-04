/* ==========================================================================
   Service Worker Registration and Management
   Handles service worker registration, updates, and communication
   ========================================================================== */

import { logger } from '@/utils/logger'

export interface ServiceWorkerConfig {
  /** Service worker script path */
  scriptURL: string
  /** Service worker scope */
  scope?: string
  /** Enable automatic updates */
  autoUpdate?: boolean
  /** Update check interval in milliseconds */
  updateInterval?: number
}

export interface PushSubscriptionData {
  /** Push subscription endpoint */
  endpoint: string
  /** Push subscription keys */
  keys: {
    p256dh: string
    auth: string
  }
  /** Subscription expiration time */
  expirationTime?: number | null
}

export interface PushMessage {
  /** Message title */
  title: string
  /** Message body */
  body: string
  /** Message icon */
  icon?: string
  /** Message badge */
  badge?: string
  /** Message tag for grouping */
  tag?: string
  /** Message data */
  data?: Record<string, unknown>
  /** Message actions */
  actions?: Array<{
    action: string
    title: string
    icon?: string
  }>
  /** Require interaction */
  requireInteraction?: boolean
  /** Silent notification */
  silent?: boolean
}

type MessageHandler = (data: unknown) => void
type UpdateHandler = (registration: ServiceWorkerRegistration) => void

class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null
  private config: ServiceWorkerConfig
  private messageHandlers: Set<MessageHandler> = new Set()
  private updateHandlers: Set<UpdateHandler> = new Set()
  private updateTimer: number | null = null

  constructor(config: ServiceWorkerConfig) {
    this.config = {
      ...config,
      autoUpdate: config.autoUpdate ?? true,
      updateInterval: config.updateInterval ?? 3600000 // 1 hour default
    }
  }

  /**
   * Check if service workers are supported
   */
  isSupported(): boolean {
    return 'serviceWorker' in navigator
  }

  /**
   * Register the service worker
   */
  async register(): Promise<ServiceWorkerRegistration | null> {
    if (!this.isSupported()) {
      logger.warn('[ServiceWorker] Service workers are not supported in this browser')
      return null
    }

    try {
      logger.info('[ServiceWorker] Registering service worker', this.config.scriptURL)

      this.registration = await navigator.serviceWorker.register(this.config.scriptURL, {
        scope: this.config.scope,
        updateViaCache: 'imports' // Allow imports to be cached
      })

      logger.info('[ServiceWorker] Service worker registered successfully')

      // Set up update handling
      if (this.config.autoUpdate) {
        this.setupUpdateHandling()
      }

      // Set up message handling
      this.setupMessageHandling()

      // Wait for service worker to be ready
      await navigator.serviceWorker.ready

      return this.registration
    } catch (error) {
      logger.error('[ServiceWorker] Registration failed:', error)
      throw error
    }
  }

  /**
   * Set up automatic update handling
   */
  private setupUpdateHandling(): void {
    if (!this.registration) return

    // Listen for update found
    this.registration.addEventListener('updatefound', () => {
      logger.info('[ServiceWorker] New service worker found')

      const newWorker = this.registration!.installing
      if (!newWorker) return

      // Listen for new worker state changes
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New version available
          logger.info('[ServiceWorker] New service worker available')
          this.notifyUpdateHandlers(this.registration!)
        }
      })
    })

    // Set up periodic update checks
    if (this.config.updateInterval && this.config.updateInterval > 0) {
      this.updateTimer = window.setInterval(() => {
        this.checkForUpdates()
      }, this.config.updateInterval)
    }
  }

  /**
   * Set up message handling from service worker
   */
  private setupMessageHandling(): void {
    navigator.serviceWorker.addEventListener('message', (event) => {
      logger.debug('[ServiceWorker] Message received from service worker:', event.data)

      // Notify all handlers
      this.messageHandlers.forEach((handler) => {
        try {
          handler(event.data)
        } catch (error) {
          logger.error('[ServiceWorker] Message handler error:', error)
        }
      })
    })
  }

  /**
   * Check for service worker updates
   */
  async checkForUpdates(): Promise<boolean> {
    if (!this.registration) return false

    try {
      await this.registration.update()
      logger.info('[ServiceWorker] Update check completed')
      return true
    } catch (error) {
      logger.error('[ServiceWorker] Update check failed:', error)
      return false
    }
  }

  /**
   * Skip waiting and activate the new service worker immediately
   */
  async skipWaiting(): Promise<void> {
    if (!this.registration || !this.registration.waiting) {
      logger.warn('[ServiceWorker] No waiting service worker to skip')
      return
    }

    try {
      // Send message to service worker to skip waiting
      this.registration.waiting.postMessage({ action: 'skip-waiting' })
      logger.info('[ServiceWorker] Skip waiting requested')
    } catch (error) {
      logger.error('[ServiceWorker] Failed to skip waiting:', error)
    }
  }

  /**
   * Get service worker version
   */
  async getVersion(): Promise<string | null> {
    if (!this.registration || !this.registration.active) {
      return null
    }

    try {
      const messageChannel = new MessageChannel()
      const versionPromise = new Promise<string>((resolve) => {
        messageChannel.port1.onmessage = (event) => {
          resolve(event.data.version)
        }
      })

      this.registration.active.postMessage({ action: 'get-version' }, [messageChannel.port2])

      return await versionPromise
    } catch (error) {
      logger.error('[ServiceWorker] Failed to get version:', error)
      return null
    }
  }

  /**
   * Clear all caches
   */
  async clearCache(): Promise<void> {
    if (!this.registration || !this.registration.active) {
      logger.warn('[ServiceWorker] No active service worker to clear cache')
      return
    }

    try {
      const messageChannel = new MessageChannel()
      const clearPromise = new Promise<void>((resolve) => {
        messageChannel.port1.onmessage = () => resolve()
      })

      this.registration.active.postMessage({ action: 'clear-cache' }, [messageChannel.port2])

      await clearPromise
      logger.info('[ServiceWorker] Cache cleared')
    } catch (error) {
      logger.error('[ServiceWorker] Failed to clear cache:', error)
    }
  }

  /**
   * Subscribe to push notifications
   */
  async subscribeToPush(serverKey: string, userVisibleOnly = true): Promise<PushSubscription | null> {
    if (!this.registration) {
      logger.warn('[ServiceWorker] No service worker registration')
      return null
    }

    try {
      // Convert server key to Uint8Array
      const applicationServerKey = this.urlBase64ToUint8Array(serverKey)

      // Subscribe to push - use type assertion to bypass TypeScript strict typing
      const pushSubscription = await this.registration.pushManager.subscribe({
        userVisibleOnly,
        applicationServerKey: applicationServerKey as BufferSource
      })

      logger.info('[ServiceWorker] Push subscription successful')

      return pushSubscription
    } catch (error) {
      logger.error('[ServiceWorker] Push subscription failed:', error)
      return null
    }
  }

  /**
   * Get current push subscription
   */
  async getPushSubscription(): Promise<PushSubscription | null> {
    if (!this.registration) {
      return null
    }

    try {
      return await this.registration.pushManager.getSubscription()
    } catch (error) {
      logger.error('[ServiceWorker] Failed to get push subscription:', error)
      return null
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribeFromPush(): Promise<boolean> {
    try {
      const subscription = await this.getPushSubscription()

      if (!subscription) {
        logger.warn('[ServiceWorker] No push subscription to unsubscribe')
        return false
      }

      const unsubscribed = await subscription.unsubscribe()
      logger.info('[ServiceWorker] Push unsubscribe successful')

      return unsubscribed
    } catch (error) {
      logger.error('[ServiceWorker] Push unsubscribe failed:', error)
      return false
    }
  }

  /**
   * Register a message handler
   */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler)

    // Return unsubscribe function
    return () => {
      this.messageHandlers.delete(handler)
    }
  }

  /**
   * Register an update handler
   */
  onUpdate(handler: UpdateHandler): () => void {
    this.updateHandlers.add(handler)

    // Return unsubscribe function
    return () => {
      this.updateHandlers.delete(handler)
    }
  }

  /**
   * Notify all update handlers
   */
  private notifyUpdateHandlers(registration: ServiceWorkerRegistration): void {
    this.updateHandlers.forEach((handler) => {
      try {
        handler(registration)
      } catch (error) {
        logger.error('[ServiceWorker] Update handler error:', error)
      }
    })
  }

  /**
   * Unregister the service worker
   */
  async unregister(): Promise<boolean> {
    if (!this.registration) {
      logger.warn('[ServiceWorker] No service worker to unregister')
      return false
    }

    try {
      const unregistered = await this.registration.unregister()
      logger.info('[ServiceWorker] Service worker unregistered')

      // Clear update timer
      if (this.updateTimer) {
        clearInterval(this.updateTimer)
        this.updateTimer = null
      }

      this.registration = null
      return unregistered
    } catch (error) {
      logger.error('[ServiceWorker] Unregister failed:', error)
      return false
    }
  }

  /**
   * Convert URL-safe base64 to Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }

    return outputArray
  }

  /**
   * Get push subscription data for sending to server
   */
  async getSubscriptionData(): Promise<PushSubscriptionData | null> {
    const subscription = await this.getPushSubscription()

    if (!subscription) {
      return null
    }

    const subscriptionData = subscription.toJSON()

    return {
      endpoint: subscriptionData.endpoint || '',
      keys: {
        p256dh: subscriptionData.keys?.p256dh || '',
        auth: subscriptionData.keys?.auth || ''
      },
      expirationTime: subscriptionData.expirationTime || null
    }
  }
}

// Create singleton instance for default service worker
const defaultServiceWorker = new ServiceWorkerManager({
  scriptURL: '/sw.js',
  scope: '/',
  autoUpdate: true,
  updateInterval: 3600000 // 1 hour
})

// Export class and singleton
export { ServiceWorkerManager }
export default defaultServiceWorker

// Export convenient functions
export const registerServiceWorker = () => defaultServiceWorker.register()
export const getServiceWorker = () => defaultServiceWorker
export const subscribeToPush = (serverKey: string) => defaultServiceWorker.subscribeToPush(serverKey)
export const unsubscribeFromPush = () => defaultServiceWorker.unsubscribeFromPush()
export const getPushSubscription = () => defaultServiceWorker.getPushSubscription()
export const getSubscriptionData = () => defaultServiceWorker.getSubscriptionData()
