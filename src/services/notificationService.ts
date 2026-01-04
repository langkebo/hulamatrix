/**
 * Unified Notification Service
 *
 * 统一PC端和移动端的通知系统处理逻辑
 * 提供一致的API接口，内部根据平台选择不同实现
 */

import { isMobile } from '@/utils/PlatformConstants'
import { computeNotificationPolicy, type PolicyInput } from '@/utils/notificationPolicy'
import { useNotificationStore } from '@/stores/notifications'
import { useSettingStore } from '@/stores/setting'
import { audioManager } from '@/utils/AudioManager'
import { logger } from '@/utils/logger'

/**
 * 通知选项
 */
export interface NotificationOptions {
  /** 通知图标URL */
  icon?: string
  /** 是否静音（不播放声音） */
  silent?: boolean
  /** 是否需要用户交互才能关闭 */
  requireInteraction?: boolean
  /** 点击通知后的回调 */
  onClick?: () => void
  /** 额外数据 */
  data?: Record<string, unknown>
}

/**
 * 通知内容
 */
export interface NotificationContent {
  title: string
  body: string
  options?: NotificationOptions
}

/**
 * 通知级别
 */
export type NotificationLevel = 'info' | 'success' | 'warning' | 'error'

/**
 * 统一通知服务类
 */
class NotificationService {
  private lastSoundAt = 0
  private readonly SOUND_WINDOW_MS = 800
  private isTauri = typeof window !== 'undefined' && '__TAURI__' in window

  /**
   * 初始化通知服务
   */
  async initialize(): Promise<void> {
    // 初始化通知store
    const notificationStore = useNotificationStore()
    notificationStore.initialize()

    // 请求桌面通知权限
    if (!this.isTauri && 'Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission()
    }

    // Tauri环境请求通知权限
    if (this.isTauri && !isMobile()) {
      try {
        const { isPermissionGranted, requestPermission } = await import('@tauri-apps/plugin-notification')
        let granted = await isPermissionGranted()
        if (!granted) {
          const result = await requestPermission()
          granted = result === 'granted'
        }
        logger.info('[NotificationService] Desktop notification permission:', granted)
      } catch (error) {
        logger.warn('[NotificationService] Failed to request notification permission:', error)
      }
    }

    logger.info('[NotificationService] Initialized', { platform: isMobile() ? 'mobile' : 'desktop' })
  }

  /**
   * 发送通知
   */
  async send(content: NotificationContent): Promise<void> {
    const { title, body, options = {} } = content

    // 检查通知设置 - 如果声音关闭且不是强制静音，则根据声音设置决定
    const settingStore = useSettingStore()
    const shouldNotify = settingStore.notification?.messageSound !== false
    if (!shouldNotify && !options.silent) {
      logger.debug('[NotificationService] Notification disabled in settings')
      return
    }

    // 显示平台通知
    await this.showPlatformNotification(title, body, options)

    // 播放声音
    if (!options.silent) {
      await this.playNotificationSound()
    }

    // 添加到通知store
    const notificationStore = useNotificationStore()
    if (options.onClick) {
      notificationStore.addMessageNotification(title, body, {
        label: '查看',
        handler: options.onClick
      })
    } else {
      notificationStore.addMessageNotification(title, body)
    }
  }

  /**
   * 显示平台通知
   */
  private async showPlatformNotification(title: string, body: string, options: NotificationOptions): Promise<void> {
    if (isMobile()) {
      await this.showMobileNotification(title, body, options)
    } else {
      await this.showDesktopNotification(title, body, options)
    }
  }

  /**
   * 显示移动端通知
   */
  private async showMobileNotification(title: string, body: string, options: NotificationOptions): Promise<void> {
    if (!this.isTauri) {
      // Web环境移动端 - 使用Web Notification API
      this.showWebNotification(title, body, options)
      return
    }

    try {
      // Tauri移动端 - 使用Rust插件
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('show_mobile_notification', {
        title,
        body,
        icon: options.icon || ''
      })
      logger.debug('[NotificationService] Mobile notification sent via Tauri')
    } catch (error) {
      logger.warn('[NotificationService] Failed to send mobile notification, fallback to web:', error)
      // Fallback to web notification
      this.showWebNotification(title, body, options)
    }
  }

  /**
   * 显示桌面端通知
   */
  private async showDesktopNotification(title: string, body: string, options: NotificationOptions): Promise<void> {
    if (!this.isTauri) {
      // Web环境 - 使用Web Notification API
      this.showWebNotification(title, body, options)
      return
    }

    try {
      // Tauri桌面端 - 使用Tauri通知插件
      const { sendNotification } = await import('@tauri-apps/plugin-notification')
      sendNotification({
        title,
        body,
        icon: options.icon || ''
      })
      logger.debug('[NotificationService] Desktop notification sent via Tauri')
    } catch (error) {
      logger.warn('[NotificationService] Failed to send desktop notification, fallback to web:', error)
      // Fallback to web notification
      this.showWebNotification(title, body, options)
    }
  }

  /**
   * 显示Web通知（浏览器原生API）
   */
  private showWebNotification(title: string, body: string, options: NotificationOptions): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: options.icon || '/favicon.ico',
        tag: (options.data?.id as string) || `notif_${Date.now()}`,
        requireInteraction: options.requireInteraction || false,
        silent: options.silent || false
      })

      notification.onclick = () => {
        window.focus()
        if (options.onClick) {
          options.onClick()
        }
        notification.close()
      }

      // 自动关闭（如果不是需要交互的通知）
      if (!options.requireInteraction) {
        setTimeout(() => notification.close(), 5000)
      }
    }
  }

  /**
   * 播放通知声音
   */
  private async playNotificationSound(): Promise<void> {
    const settingStore = useSettingStore()

    // 检查是否启用消息提示音
    if (!settingStore.notification?.messageSound) {
      return
    }

    // 防止声音过于频繁
    const now = Date.now()
    if (now - this.lastSoundAt < this.SOUND_WINDOW_MS) {
      return
    }

    try {
      const audio = new Audio('/sound/message.mp3')
      await audioManager.play(audio, 'message-notification')
      this.lastSoundAt = now
    } catch (error) {
      logger.warn('[NotificationService] Failed to play notification sound:', error)
    }
  }

  /**
   * 根据策略计算是否应该显示通知
   */
  shouldNotify(policyInput: PolicyInput): { skip: boolean; silent: boolean } {
    return computeNotificationPolicy(policyInput)
  }

  /**
   * 发送Matrix消息通知
   */
  async sendMatrixMessage(
    title: string,
    body: string,
    policyInput: PolicyInput,
    options: NotificationOptions = {}
  ): Promise<void> {
    // 计算通知策略
    const policy = this.shouldNotify(policyInput)

    if (policy.skip) {
      logger.debug('[NotificationService] Notification skipped by policy')
      return
    }

    // 更新静音选项
    const finalOptions: NotificationOptions = {
      ...options,
      silent: policy.silent || options.silent
    }

    await this.send({ title, body, options: finalOptions })
  }

  /**
   * 显示系统通知
   */
  async showSystem(level: NotificationLevel, title: string, body?: string): Promise<void> {
    const notificationStore = useNotificationStore()

    switch (level) {
      case 'info':
        notificationStore.addSystemNotification(title, body, 'info')
        break
      case 'success':
        notificationStore.addSystemNotification(title, body, 'success')
        break
      case 'warning':
        notificationStore.addWarning(title, body)
        break
      case 'error':
        notificationStore.addError(title, body)
        break
    }

    // 播放对应级别的声音
    if (level === 'error' || level === 'warning') {
      await this.playNotificationSound()
    }
  }

  /**
   * 显示好友通知
   */
  async showFriend(level: NotificationLevel, title: string, body?: string): Promise<void> {
    const notificationStore = useNotificationStore()
    notificationStore.addFriendNotification(title, body, level)
    await this.playNotificationSound()
  }

  /**
   * 显示群组通知
   */
  async showGroup(title: string, body?: string): Promise<void> {
    const notificationStore = useNotificationStore()
    notificationStore.addGroupNotification(title, body)
    await this.playNotificationSound()
  }

  /**
   * 获取未读通知数量
   */
  getUnreadCount(): number {
    const notificationStore = useNotificationStore()
    return notificationStore.getUnreadCount()
  }

  /**
   * 清除所有通知
   */
  clearAll(): void {
    const notificationStore = useNotificationStore()
    notificationStore.clearNotifications()
  }

  /* ==========================================================================
     Web Push Subscription Methods
     ========================================================================== */

  /**
   * Subscribe to Web Push notifications
   */
  async subscribeToPush(vapidPublicKey?: string): Promise<PushSubscription | null> {
    // Skip in Tauri environment
    if (this.isTauri) {
      logger.warn('[NotificationService] Push subscriptions not supported in Tauri')
      return null
    }

    // Check if service worker is supported
    if (!('serviceWorker' in navigator)) {
      logger.warn('[NotificationService] Service workers not supported')
      return null
    }

    try {
      const { getServiceWorker } = await import('@/utils/serviceWorker')
      const sw = getServiceWorker()

      // Use provided VAPID key or default
      const publicKey = vapidPublicKey || (await import('@/config/vapid')).getVapidPublicKey()

      // Subscribe to push
      const subscription = await sw.subscribeToPush(publicKey)

      if (subscription) {
        logger.info('[NotificationService] Push subscription successful')

        // Send subscription to server for storage
        await this.sendPushSubscriptionToServer(subscription)
      }

      return subscription
    } catch (error) {
      logger.error('[NotificationService] Push subscription failed:', error)
      return null
    }
  }

  /**
   * Get current push subscription
   */
  async getPushSubscription(): Promise<PushSubscription | null> {
    if (this.isTauri || !('serviceWorker' in navigator)) {
      return null
    }

    try {
      const { getServiceWorker } = await import('@/utils/serviceWorker')
      return await getServiceWorker().getPushSubscription()
    } catch (error) {
      logger.error('[NotificationService] Failed to get push subscription:', error)
      return null
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribeFromPush(): Promise<boolean> {
    if (this.isTauri || !('serviceWorker' in navigator)) {
      return false
    }

    try {
      const { getServiceWorker } = await import('@/utils/serviceWorker')
      const sw = getServiceWorker()

      // Get subscription before unsubscribing
      const subscription = await sw.getPushSubscription()

      if (subscription) {
        // Notify server to remove subscription
        await this.removePushSubscriptionFromServer(subscription)
      }

      // Unsubscribe locally
      const unsubscribed = await sw.unsubscribeFromPush()

      if (unsubscribed) {
        logger.info('[NotificationService] Push unsubscribe successful')
      }

      return unsubscribed
    } catch (error) {
      logger.error('[NotificationService] Push unsubscribe failed:', error)
      return false
    }
  }

  /**
   * Get push subscription data for sending to server
   */
  async getPushSubscriptionData() {
    if (this.isTauri || !('serviceWorker' in navigator)) {
      return null
    }

    try {
      const { getServiceWorker } = await import('@/utils/serviceWorker')
      return await getServiceWorker().getSubscriptionData()
    } catch (error) {
      logger.error('[NotificationService] Failed to get subscription data:', error)
      return null
    }
  }

  /**
   * Check if push notifications are supported
   */
  isPushSupported(): boolean {
    if (this.isTauri) return false
    return 'serviceWorker' in navigator && 'PushManager' in window
  }

  /**
   * Check if currently subscribed to push notifications
   */
  async isPushSubscribed(): Promise<boolean> {
    const subscription = await this.getPushSubscription()
    return subscription !== null
  }

  /**
   * Send push subscription to server
   */
  private async sendPushSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    try {
      const subscriptionData = subscription.toJSON()

      // Get current user info
      const { useMatrixAuthStore } = await import('@/stores/matrixAuth')
      const auth = useMatrixAuthStore()

      // Send to your server endpoint
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.accessToken}`
        },
        body: JSON.stringify({
          subscription: subscriptionData,
          userId: auth.userId
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      logger.info('[NotificationService] Push subscription sent to server')
    } catch (error) {
      logger.error('[NotificationService] Failed to send subscription to server:', error)
      // Don't throw - subscription is still valid locally
    }
  }

  /**
   * Remove push subscription from server
   */
  private async removePushSubscriptionFromServer(subscription: PushSubscription): Promise<void> {
    try {
      const subscriptionData = subscription.toJSON()

      const { useMatrixAuthStore } = await import('@/stores/matrixAuth')
      const auth = useMatrixAuthStore()

      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.accessToken}`
        },
        body: JSON.stringify({
          endpoint: subscriptionData.endpoint,
          userId: auth.userId
        })
      })

      logger.info('[NotificationService] Push subscription removed from server')
    } catch (error) {
      logger.error('[NotificationService] Failed to remove subscription from server:', error)
      // Don't throw - local unsubscribe is still valid
    }
  }
}

// 导出单例
export const notificationService = new NotificationService()

// 导出便捷函数
export const initializeNotifications = () => notificationService.initialize()
export const sendNotification = (content: NotificationContent) => notificationService.send(content)
export const showSystemNotification = (level: NotificationLevel, title: string, body?: string) =>
  notificationService.showSystem(level, title, body)
export const showFriendNotification = (level: NotificationLevel, title: string, body?: string) =>
  notificationService.showFriend(level, title, body)
export const showGroupNotification = (title: string, body?: string) => notificationService.showGroup(title, body)
export const shouldNotify = (policyInput: PolicyInput) => notificationService.shouldNotify(policyInput)
export const getNotificationUnreadCount = () => notificationService.getUnreadCount()
export const clearAllNotifications = () => notificationService.clearAll()

export default notificationService
