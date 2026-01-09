/**
 * Core Store - Settings and UI State Management
 * Handles app settings, theme, language, and UI configuration
 */

import { ref, type Ref } from 'vue'
import type { AppSettings, MenuItem, CacheSettings, NotificationSettings } from './types'

/**
 * Settings and UI state manager
 */
export class SettingsStateManager {
  /** App settings */
  settings: Ref<AppSettings>

  /** Menu top configuration */
  menuTop: Ref<MenuItem[]>

  constructor() {
    this.menuTop = ref<MenuItem[]>([
      {
        url: 'message',
        icon: 'message',
        iconAction: 'message-action',
        state: 'builtin',
        isAdd: true,
        dot: false,
        progress: 0,
        miniShow: false
      },
      {
        url: 'friendsList',
        icon: 'avatar',
        iconAction: 'avatar-action',
        state: 'builtin',
        isAdd: true,
        dot: false,
        progress: 0,
        miniShow: false
      }
    ])

    this.settings = ref<AppSettings>({
      theme: 'auto',
      language: 'zh-CN',
      fontSize: 'medium',
      messageDensity: 'comfortable',
      autoPlayGifs: true,
      showReadReceipts: true,
      showTypingNotifications: true,
      enableEncryption: true,
      backupFrequency: 'weekly',
      cache: {
        maxSize: 500,
        ttl: 24,
        compressionEnabled: true,
        paths: {
          cache: './cache',
          temp: './temp',
          downloads: './downloads'
        }
      },
      notifications: {
        global: {
          enabled: true,
          soundEnabled: true,
          doNotDisturb: false
        },
        room: {},
        rules: []
      }
    })
  }

  /**
   * Update theme
   */
  setTheme(theme: AppSettings['theme']): void {
    this.settings.value.theme = theme
  }

  /**
   * Update language
   */
  setLanguage(language: string): void {
    this.settings.value.language = language
  }

  /**
   * Update font size
   */
  setFontSize(fontSize: AppSettings['fontSize']): void {
    this.settings.value.fontSize = fontSize
  }

  /**
   * Update message density
   */
  setMessageDensity(density: AppSettings['messageDensity']): void {
    this.settings.value.messageDensity = density
  }

  /**
   * Toggle auto-play GIFs
   */
  toggleAutoPlayGifs(): void {
    this.settings.value.autoPlayGifs = !this.settings.value.autoPlayGifs
  }

  /**
   * Toggle show read receipts
   */
  toggleShowReadReceipts(): void {
    this.settings.value.showReadReceipts = !this.settings.value.showReadReceipts
  }

  /**
   * Toggle show typing notifications
   */
  toggleShowTypingNotifications(): void {
    this.settings.value.showTypingNotifications = !this.settings.value.showTypingNotifications
  }

  /**
   * Toggle enable encryption
   */
  toggleEnableEncryption(): void {
    this.settings.value.enableEncryption = !this.settings.value.enableEncryption
  }

  /**
   * Update backup frequency
   */
  setBackupFrequency(frequency: AppSettings['backupFrequency']): void {
    this.settings.value.backupFrequency = frequency
  }

  /**
   * Update cache settings
   */
  updateCacheSettings(cache: Partial<CacheSettings>): void {
    Object.assign(this.settings.value.cache, cache)
  }

  /**
   * Update notification settings
   */
  updateNotificationSettings(notifications: Partial<NotificationSettings>): void {
    Object.assign(this.settings.value.notifications, notifications)
  }

  /**
   * Update menu top configuration
   */
  updateMenuTop(newMenuTop: MenuItem[]): void {
    this.menuTop.value = newMenuTop
  }

  /**
   * Get current theme
   */
  getTheme(): AppSettings['theme'] {
    return this.settings.value.theme
  }

  /**
   * Get current language
   */
  getLanguage(): string {
    return this.settings.value.language
  }

  /**
   * Reset settings to defaults
   */
  resetToDefaults(): void {
    this.settings.value = {
      theme: 'auto',
      language: 'zh-CN',
      fontSize: 'medium',
      messageDensity: 'comfortable',
      autoPlayGifs: true,
      showReadReceipts: true,
      showTypingNotifications: true,
      enableEncryption: true,
      backupFrequency: 'weekly',
      cache: {
        maxSize: 500,
        ttl: 24,
        compressionEnabled: true,
        paths: {
          cache: './cache',
          temp: './temp',
          downloads: './downloads'
        }
      },
      notifications: {
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

  /**
   * Export settings
   */
  exportSettings(): string {
    return JSON.stringify(this.settings.value, null, 2)
  }

  /**
   * Import settings
   */
  importSettings(json: string): boolean {
    try {
      const imported = JSON.parse(json) as Partial<AppSettings>
      Object.assign(this.settings.value, imported)
      return true
    } catch {
      return false
    }
  }
}
