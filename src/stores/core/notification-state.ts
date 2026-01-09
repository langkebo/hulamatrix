/**
 * Core Store - Notification State Management
 * Handles notification rules and settings
 */

import { ref, type Ref } from 'vue'
import type { NotificationSettings, NotificationRule } from './types'

/**
 * Notification state manager
 */
export class NotificationStateManager {
  /** Notification settings */
  notifications: Ref<NotificationSettings>

  constructor() {
    this.notifications = ref<NotificationSettings>({
      global: {
        enabled: true,
        soundEnabled: true,
        doNotDisturb: false
      },
      room: {},
      rules: []
    })
  }

  /**
   * Add notification rule
   */
  addNotificationRule(rule: NotificationRule): void {
    this.notifications.value.rules.push(rule)
    this.notifications.value.rules.sort((a, b) => b.priority - a.priority)
  }

  /**
   * Remove notification rule
   */
  removeNotificationRule(ruleId: string): void {
    const index = this.notifications.value.rules.findIndex((r) => r.id === ruleId)
    if (index > -1) {
      this.notifications.value.rules.splice(index, 1)
    }
  }

  /**
   * Update notification rule
   */
  updateNotificationRule(ruleId: string, updates: Partial<NotificationRule>): void {
    const rule = this.notifications.value.rules.find((r) => r.id === ruleId)
    if (rule) {
      Object.assign(rule, updates)
      this.notifications.value.rules.sort((a, b) => b.priority - a.priority)
    }
  }

  /**
   * Toggle global notifications
   */
  toggleGlobalNotifications(): void {
    this.notifications.value.global.enabled = !this.notifications.value.global.enabled
  }

  /**
   * Toggle sound notifications
   */
  toggleSoundNotifications(): void {
    this.notifications.value.global.soundEnabled = !this.notifications.value.global.soundEnabled
  }

  /**
   * Toggle do not disturb mode
   */
  toggleDoNotDisturb(): void {
    this.notifications.value.global.doNotDisturb = !this.notifications.value.global.doNotDisturb
  }

  /**
   * Set do not disturb time range
   */
  setDoNotDisturbTime(start: string, end: string): void {
    this.notifications.value.global.doNotDisturbStart = start
    this.notifications.value.global.doNotDisturbEnd = end
  }

  /**
   * Update room notification settings
   */
  updateRoomNotificationSettings(
    roomId: string,
    settings: {
      enabled?: boolean
      mentionsOnly?: boolean
      keywords?: string[]
    }
  ): void {
    if (!this.notifications.value.room[roomId]) {
      this.notifications.value.room[roomId] = {
        enabled: true,
        mentionsOnly: false,
        keywords: []
      }
    }
    Object.assign(this.notifications.value.room[roomId], settings)
  }

  /**
   * Get room notification settings
   */
  getRoomNotificationSettings(roomId: string) {
    return this.notifications.value.room[roomId]
  }

  /**
   * Clear all notification rules
   */
  clearNotificationRules(): void {
    this.notifications.value.rules = []
  }

  /**
   * Reset to default notification settings
   */
  resetToDefaults(): void {
    this.notifications.value = {
      global: {
        enabled: true,
        soundEnabled: true,
        doNotDisturb: false
      },
      room: {},
      rules: []
    }
  }
}
