/**
 * Notification Scheduler Service
 * Handles scheduled notifications and quiet hours
 */

import { logger } from '@/utils/logger'

export interface ScheduledNotification {
  id: string
  title: string
  content?: string
  type: 'reminder' | 'alert' | 'message'
  scheduledTime: number // Unix timestamp
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly'
  enabled: boolean
  metadata?: Record<string, unknown>
}

export interface QuietHours {
  enabled: boolean
  startTime: string // HH:mm format
  endTime: string // HH:mm format
  timezone: string
  allowEmergency: boolean
}

export interface NotificationSchedule {
  id: string
  name: string
  quietHours: QuietHours
  scheduledNotifications: ScheduledNotification[]
}

const STORAGE_KEY = 'notification_schedule'

class NotificationScheduler {
  private schedule: NotificationSchedule | null = null
  private timers: Map<string, NodeJS.Timeout> = new Map()
  private checkInterval: NodeJS.Timeout | null = null

  /**
   * Initialize the scheduler
   */
  async initialize(): Promise<void> {
    try {
      this.loadSchedule()
      this.startMonitoring()
      logger.info('[NotificationScheduler] Initialized')
    } catch (error) {
      logger.error('[NotificationScheduler] Failed to initialize:', error)
    }
  }

  /**
   * Load schedule from storage
   */
  private loadSchedule(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        this.schedule = JSON.parse(raw)
      } else {
        // Create default schedule
        this.schedule = {
          id: 'default',
          name: 'Default Schedule',
          quietHours: {
            enabled: false,
            startTime: '22:00',
            endTime: '08:00',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            allowEmergency: true
          },
          scheduledNotifications: []
        }
      }
    } catch (error) {
      logger.error('[NotificationScheduler] Failed to load schedule:', error)
    }
  }

  /**
   * Save schedule to storage
   */
  private saveSchedule(): void {
    try {
      if (this.schedule) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.schedule))
      }
    } catch (error) {
      logger.error('[NotificationScheduler] Failed to save schedule:', error)
    }
  }

  /**
   * Start monitoring for scheduled notifications
   */
  private startMonitoring(): void {
    // Check every minute for due notifications
    this.checkInterval = setInterval(() => {
      this.checkScheduledNotifications()
    }, 60000)

    // Set up individual timers for each scheduled notification
    this.setupScheduledTimers()
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }

    // Clear all timers
    this.timers.forEach((timer) => clearTimeout(timer))
    this.timers.clear()

    logger.info('[NotificationScheduler] Stopped monitoring')
  }

  /**
   * Setup timers for scheduled notifications
   */
  private setupScheduledTimers(): void {
    if (!this.schedule) return

    const now = Date.now()

    for (const notification of this.schedule.scheduledNotifications) {
      if (!notification.enabled) continue

      const delay = notification.scheduledTime - now

      if (delay > 0 && delay < 2147483647) {
        // Max timeout for setTimeout
        const timer = setTimeout(() => {
          this.sendNotification(notification)
          this.handleRepeat(notification)
        }, delay)

        this.timers.set(notification.id, timer)
        logger.info('[NotificationScheduler] Scheduled notification', {
          id: notification.id,
          scheduledTime: new Date(notification.scheduledTime).toISOString()
        })
      } else if (delay <= 0 && notification.repeat !== 'none') {
        // Notification is past due but should repeat
        this.scheduleNextOccurrence(notification)
      }
    }
  }

  /**
   * Check for scheduled notifications that are due
   */
  private checkScheduledNotifications(): void {
    if (!this.schedule || this.isQuietHoursActive()) {
      return
    }

    const now = Date.now()

    for (const notification of this.schedule.scheduledNotifications) {
      if (!notification.enabled) continue

      // Check if notification is due (within the last minute)
      if (notification.scheduledTime <= now && notification.scheduledTime > now - 60000) {
        this.sendNotification(notification)
        this.handleRepeat(notification)
      }
    }
  }

  /**
   * Send a scheduled notification
   */
  private sendNotification(notification: ScheduledNotification): void {
    // Check if quiet hours are active
    if (this.isQuietHoursActive()) {
      const quietHours = this.schedule?.quietHours
      if (quietHours?.allowEmergency && notification.type === 'alert') {
        // Allow emergency alerts during quiet hours
      } else {
        logger.info('[NotificationScheduler] Notification suppressed due to quiet hours', {
          id: notification.id
        })
        return
      }
    }

    // Send notification via system notification API
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.content,
        tag: notification.id
      })
    }

    // Dispatch custom event for app to handle
    window.dispatchEvent(
      new CustomEvent('scheduled-notification', {
        detail: notification
      })
    )

    logger.info('[NotificationScheduler] Notification sent', { id: notification.id })
  }

  /**
   * Handle repeating notifications
   */
  private handleRepeat(notification: ScheduledNotification): void {
    if (notification.repeat !== 'none') {
      this.scheduleNextOccurrence(notification)
    }
  }

  /**
   * Schedule next occurrence of a repeating notification
   */
  private scheduleNextOccurrence(notification: ScheduledNotification): void {
    const nextTime = this.calculateNextOccurrence(notification)

    if (nextTime) {
      // Update the notification in the schedule
      const index = this.schedule!.scheduledNotifications.findIndex((n) => n.id === notification.id)
      if (index !== -1) {
        this.schedule!.scheduledNotifications[index].scheduledTime = nextTime
        this.saveSchedule()
        this.setupScheduledTimers()
      }
    }
  }

  /**
   * Calculate next occurrence time for a repeating notification
   */
  private calculateNextOccurrence(notification: ScheduledNotification): number | null {
    const now = Date.now()
    const current = new Date(notification.scheduledTime)
    const next = new Date(current)

    switch (notification.repeat) {
      case 'daily':
        next.setDate(next.getDate() + 1)
        break
      case 'weekly':
        next.setDate(next.getDate() + 7)
        break
      case 'monthly':
        next.setMonth(next.getMonth() + 1)
        break
      default:
        return null
    }

    // If the next occurrence is still in the past, move it forward
    while (next.getTime() <= now) {
      switch (notification.repeat) {
        case 'daily':
          next.setDate(next.getDate() + 1)
          break
        case 'weekly':
          next.setDate(next.getDate() + 7)
          break
        case 'monthly':
          next.setMonth(next.getMonth() + 1)
          break
      }
    }

    return next.getTime()
  }

  /**
   * Check if quiet hours are currently active
   */
  isQuietHoursActive(): boolean {
    if (!this.schedule?.quietHours.enabled) {
      return false
    }

    const now = new Date()
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const { startTime, endTime } = this.schedule.quietHours

    // Handle overnight quiet hours (e.g., 22:00 to 08:00)
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime < endTime
    }

    return currentTime >= startTime && currentTime < endTime
  }

  /**
   * Get the current schedule
   */
  getSchedule(): NotificationSchedule | null {
    return this.schedule
  }

  /**
   * Update quiet hours settings
   */
  updateQuietHours(quietHours: Partial<QuietHours>): void {
    if (!this.schedule) return

    this.schedule.quietHours = {
      ...this.schedule.quietHours,
      ...quietHours
    }

    this.saveSchedule()
    logger.info('[NotificationScheduler] Quiet hours updated', quietHours)
  }

  /**
   * Add a scheduled notification
   */
  addScheduledNotification(notification: Omit<ScheduledNotification, 'id'>): string {
    if (!this.schedule) {
      throw new Error('Schedule not initialized')
    }

    const id = `scheduled_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const newNotification: ScheduledNotification = {
      ...notification,
      id
    }

    this.schedule.scheduledNotifications.push(newNotification)
    this.saveSchedule()
    this.setupScheduledTimers()

    logger.info('[NotificationScheduler] Scheduled notification added', { id })
    return id
  }

  /**
   * Update a scheduled notification
   */
  updateScheduledNotification(id: string, updates: Partial<ScheduledNotification>): void {
    if (!this.schedule) return

    const index = this.schedule.scheduledNotifications.findIndex((n) => n.id === id)
    if (index === -1) {
      throw new Error('Notification not found')
    }

    this.schedule.scheduledNotifications[index] = {
      ...this.schedule.scheduledNotifications[index],
      ...updates
    }

    this.saveSchedule()
    this.setupScheduledTimers()

    logger.info('[NotificationScheduler] Scheduled notification updated', { id })
  }

  /**
   * Remove a scheduled notification
   */
  removeScheduledNotification(id: string): void {
    if (!this.schedule) return

    const index = this.schedule.scheduledNotifications.findIndex((n) => n.id === id)
    if (index === -1) {
      throw new Error('Notification not found')
    }

    this.schedule.scheduledNotifications.splice(index, 1)
    this.saveSchedule()

    // Clear timer if exists
    const timer = this.timers.get(id)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(id)
    }

    logger.info('[NotificationScheduler] Scheduled notification removed', { id })
  }

  /**
   * Get all scheduled notifications
   */
  getScheduledNotifications(): ScheduledNotification[] {
    return this.schedule?.scheduledNotifications || []
  }

  /**
   * Enable/disable a scheduled notification
   */
  toggleScheduledNotification(id: string, enabled: boolean): void {
    this.updateScheduledNotification(id, { enabled })
  }

  /**
   * Clear all scheduled notifications
   */
  clearAllScheduledNotifications(): void {
    if (!this.schedule) return

    // Clear all timers
    this.timers.forEach((timer) => clearTimeout(timer))
    this.timers.clear()

    this.schedule.scheduledNotifications = []
    this.saveSchedule()

    logger.info('[NotificationScheduler] All scheduled notifications cleared')
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      logger.warn('[NotificationScheduler] Notifications not supported')
      return false
    }

    if (Notification.permission === 'granted') {
      return true
    }

    const permission = await Notification.requestPermission()
    const granted = permission === 'granted'

    logger.info('[NotificationScheduler] Notification permission requested', { granted })
    return granted
  }
}

// Create singleton instance
const notificationScheduler = new NotificationScheduler()

export default notificationScheduler
export { NotificationScheduler }
