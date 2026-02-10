import { ref, watch } from 'vue'
import MatrixClientService from './MatrixClientService'
import { type MatrixClient } from 'matrix-js-sdk'

interface UserSettings {
  appearance: {
    theme: 'light' | 'dark' | 'system'
    language: string
    fontSize: number
    zoom: number
  }
  messages: {
    historyLimit: string
    autoRead: boolean
    emojiPanel: boolean
    gifSearch: boolean
  }
  calls: {
    camera: string
    microphone: string
    speaker: string
    noiseSuppression: boolean
    autoAnswer: boolean
    videoQuality: 'low' | 'medium' | 'high'
  }
  accessibility: {
    screenReader: boolean
    highContrast: boolean
    reduceMotion: boolean
    keyboardNavigation: boolean
    fontSize: number
  }
  labs: {
    enabled: boolean
    features: Array<{
      key: string
      labelKey: string
      descriptionKey: string
      enabled: boolean
    }>
  }
  privacy?: PrivacySettings
}

interface NotificationSettings {
  roomId?: string
  notifications: 'all' | 'mention' | 'none'
  sound: boolean
  desktop: boolean
  highlights: string[]
}

interface PrivacySettings {
  readReceipts: boolean
  typingIndicator: boolean
  linkPreviews: boolean
  autoDownload: boolean
  allowUserDiscover: boolean
  allowGroupInvites: boolean
  profileVisibility: string
  presenceVisibility: string
  messageAutoDelete?: {
    enabled: boolean
    deleteAfter: '1h' | '24h' | '7d' | '30d' | 'never'
  }
}

interface LoginHistoryEntry {
  id: string
  deviceId: string
  deviceName: string
  platform: string
  ipAddress: string
  timestamp: number
  userAgent: string
}

interface AccessToken {
  id: string
  name: string
  createdAt: number
  lastUsedAt: number
  expiresAt: number
  scope: string[]
}

interface ThirdPartyApp {
  id: string
  name: string
  description: string
  icon: string
  website: string
  permissions: string[]
  createdAt: number
  lastUsedAt: number
  enabled: boolean
}

interface SaveSettingsParams {
  appearance: Record<string, any>
  messages: Record<string, any>
  calls: Record<string, any>
  accessibility: Record<string, any>
  labs: Record<string, any>
}

interface StorageCache {
  data: string
  timestamp: number
}

const STORAGE_CACHE_TTL = 5000
const STORAGE_WRITE_DEBOUNCE = 100
const MAX_LOGIN_HISTORY = 50
const MAX_ACCESS_TOKENS = 20
const MAX_THIRD_PARTY_APPS = 30

class MatrixSettingsService {
  private static instance: MatrixSettingsService
  private _settings: Ref<UserSettings>

  private storageCache: Map<string, StorageCache> = new Map()
  private pendingWrites: Map<string, NodeJS.Timeout> = new Map()

  private defaultSettings: UserSettings = {
    appearance: {
      theme: 'dark',
      language: 'zh-CN',
      fontSize: 16,
      zoom: 100
    },
    messages: {
      historyLimit: '1m',
      autoRead: false,
      emojiPanel: true,
      gifSearch: true
    },
    calls: {
      camera: '',
      microphone: '',
      speaker: '',
      noiseSuppression: true,
      autoAnswer: false,
      videoQuality: 'high'
    },
    accessibility: {
      screenReader: false,
      highContrast: false,
      reduceMotion: false,
      keyboardNavigation: false,
      fontSize: 16
    },
    labs: {
      enabled: true,
      features: []
    }
  }

  private constructor() {
    this._settings = ref(this.defaultSettings)
    this.initializeSettings()
    this.setupSettingsWatcher()
  }

  private setupSettingsWatcher(): void {
    watch(
      this._settings,
      () => {
        this.scheduleSave()
      },
      { deep: true }
    )
  }

  private scheduleSave(): void {
    if (this.pendingWrites.has('settings')) {
      return
    }

    const timeout = setTimeout(() => {
      this.pendingWrites.delete('settings')
      this.saveToStorage(this._settings.value)
    }, STORAGE_WRITE_DEBOUNCE)

    this.pendingWrites.set('settings', timeout)
  }

  private getCachedStorage<T>(key: string, parser: (data: string) => T): T | null {
    const cached = this.storageCache.get(key)
    if (cached && Date.now() - cached.timestamp < STORAGE_CACHE_TTL) {
      try {
        return parser(cached.data)
      } catch {
        this.storageCache.delete(key)
      }
    }

    if (typeof localStorage !== 'undefined') {
      const data = localStorage.getItem(key)
      if (data) {
        this.storageCache.set(key, { data, timestamp: Date.now() })
        try {
          return parser(data)
        } catch {
          return null
        }
      }
    }
    return null
  }

  private setStorageWithCache(key: string, data: any): void {
    const serialized = JSON.stringify(data)
    this.storageCache.set(key, { data: serialized, timestamp: Date.now() })

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, serialized)
    }
  }

  private invalidateCache(key: string): void {
    this.storageCache.delete(key)
  }

  static getInstance(): MatrixSettingsService {
    if (!MatrixSettingsService.instance) {
      MatrixSettingsService.instance = new MatrixSettingsService()
    }
    return MatrixSettingsService.instance
  }

  private getClient(): MatrixClient | null {
    const clientService = MatrixClientService.getInstance()
    return clientService.getClient()
  }

  private initializeSettings(): void {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('hula_user_settings')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          this._settings.value = { ...this.defaultSettings, ...parsed }
        } catch (_e) {
          if (import.meta.env.DEV) {
            console.warn('[MatrixSettingsService] Failed to parse saved settings')
          }
        }
      }
    }
  }

  private saveToStorage(settings: Partial<UserSettings>): void {
    if (typeof localStorage !== 'undefined') {
      const currentSettings = this._settings.value
      const mergedSettings = { ...currentSettings, ...settings }
      this.setStorageWithCache('hula_user_settings', mergedSettings)
    }
  }

  async getSettings(): Promise<UserSettings> {
    const client = this.getClient()
    if (!client) {
      return this._settings.value
    }

    try {
      const accountData = client.getAccountData('m.hula_settings' as any)
      if (accountData) {
        const content = accountData.getContent() as Partial<UserSettings>
        return { ...this._settings.value, ...content }
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixSettingsService] Failed to get settings from server:', error)
      }
    }

    return this._settings.value
  }

  async updateSettings(updates: Partial<UserSettings>): Promise<boolean> {
    try {
      const currentSettings = await this.getSettings()
      const newSettings = { ...currentSettings, ...updates }

      this._settings.value = newSettings
      this.saveToStorage(newSettings)

      const client = this.getClient()
      if (client) {
        await client.setAccountData('m.hula_settings' as any, newSettings as any)
      }

      return true
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixSettingsService] Failed to update settings:', error)
      }
      return false
    }
  }

  async getNotificationSettings(roomId?: string): Promise<NotificationSettings> {
    const client = this.getClient()

    const baseSettings: NotificationSettings = {
      notifications: 'all',
      sound: true,
      desktop: true,
      highlights: []
    }

    if (!roomId || !client) {
      return { ...baseSettings, roomId }
    }

    try {
      const room = client.getRoom(roomId)
      if (!room) {
        return { ...baseSettings, roomId }
      }

      const accountData = client.getAccountData(`m.hula_notification_settings.${roomId}` as any)
      if (accountData) {
        return { ...baseSettings, roomId, ...accountData.getContent() }
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixSettingsService] Failed to get notification settings:', error)
      }
    }

    return { ...baseSettings, roomId }
  }

  async setNotificationSettings(roomId: string, settings: Partial<NotificationSettings>): Promise<boolean> {
    const client = this.getClient()
    if (!client) {
      return false
    }

    try {
      const currentSettings = await this.getNotificationSettings(roomId)
      const newSettings = { ...currentSettings, ...settings, roomId }

      await client.setAccountData(`m.hula_notification_settings.${roomId}` as any, newSettings as any)

      return true
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixSettingsService] Failed to set notification settings:', error)
      }
      return false
    }
  }

  async getPrivacySettings(): Promise<PrivacySettings> {
    const client = this.getClient()

    const baseSettings: PrivacySettings = {
      readReceipts: true,
      typingIndicator: true,
      linkPreviews: true,
      autoDownload: false,
      allowUserDiscover: true,
      allowGroupInvites: true,
      profileVisibility: 'public',
      presenceVisibility: 'public'
    }

    if (!client) {
      return baseSettings
    }

    try {
      const accountData = client.getAccountData('m.hula_privacy_settings' as any)
      if (accountData) {
        return { ...baseSettings, ...accountData.getContent() }
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixSettingsService] Failed to get privacy settings:', error)
      }
    }

    return baseSettings
  }

  async setPrivacySettings(settings: Partial<PrivacySettings>): Promise<boolean> {
    const client = this.getClient()
    if (!client) {
      return false
    }

    try {
      const currentSettings = await this.getPrivacySettings()
      const newSettings = { ...currentSettings, ...settings }

      await client.setAccountData('m.hula_privacy_settings' as any, newSettings as any)
      this.saveToStorage({ privacy: newSettings })

      return true
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixSettingsService] Failed to set privacy settings:', error)
      }
      return false
    }
  }

  async saveAllSettings(settings: SaveSettingsParams): Promise<void> {
    const mergedSettings: UserSettings = {
      appearance: { ...this.defaultSettings.appearance, ...settings.appearance },
      messages: { ...this.defaultSettings.messages, ...settings.messages },
      calls: { ...this.defaultSettings.calls, ...settings.calls },
      accessibility: { ...this.defaultSettings.accessibility, ...settings.accessibility },
      labs: { ...this.defaultSettings.labs, ...settings.labs }
    }

    await this.updateSettings(mergedSettings)
  }

  async resetToDefaults(): Promise<void> {
    this._settings.value = {
      appearance: {
        theme: 'dark',
        language: 'zh-CN',
        fontSize: 16,
        zoom: 100
      },
      messages: {
        historyLimit: '1m',
        autoRead: false,
        emojiPanel: true,
        gifSearch: true
      },
      calls: {
        camera: '',
        microphone: '',
        speaker: '',
        noiseSuppression: true,
        autoAnswer: false,
        videoQuality: 'high'
      },
      accessibility: {
        screenReader: false,
        highContrast: false,
        reduceMotion: false,
        keyboardNavigation: false,
        fontSize: 16
      },
      labs: {
        enabled: true,
        features: []
      }
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('hula_user_settings')
    }

    const client = this.getClient()
    if (client) {
      try {
        await client.setAccountData('m.hula_settings' as any, this._settings.value as any)
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('[MatrixSettingsService] Failed to reset server settings:', error)
        }
      }
    }
  }

  exportSettings(): string {
    return JSON.stringify(this._settings.value, null, 2)
  }

  async importSettings(jsonSettings: string): Promise<boolean> {
    try {
      const settings = JSON.parse(jsonSettings) as UserSettings
      await this.updateSettings(settings)
      return true
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[MatrixSettingsService] Failed to import settings:', error)
      }
      return false
    }
  }

  addLoginHistoryEntry(entry: Omit<LoginHistoryEntry, 'id'>): void {
    if (typeof localStorage !== 'undefined') {
      const history = this.getLoginHistory()
      const newEntry: LoginHistoryEntry = {
        ...entry,
        id: `login_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }

      const newHistory = [newEntry, ...history]
      if (newHistory.length > MAX_LOGIN_HISTORY) {
        newHistory.length = MAX_LOGIN_HISTORY
      }

      this.setStorageWithCache('hula_login_history', newHistory)
    }
  }

  getLoginHistory(): LoginHistoryEntry[] {
    return (
      this.getCachedStorage<LoginHistoryEntry[]>('hula_login_history', (data) => {
        const parsed = JSON.parse(data)
        return Array.isArray(parsed) ? parsed : []
      }) || []
    )
  }

  clearLoginHistory(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('hula_login_history')
      this.invalidateCache('hula_login_history')
    }
  }

  addAccessToken(token: Omit<AccessToken, 'id'>): void {
    if (typeof localStorage !== 'undefined') {
      const tokens = this.getAccessTokens()
      const newToken: AccessToken = {
        ...token,
        id: `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }

      const newTokens = [newToken, ...tokens]
      if (newTokens.length > MAX_ACCESS_TOKENS) {
        newTokens.length = MAX_ACCESS_TOKENS
      }

      this.setStorageWithCache('hula_access_tokens', newTokens)
    }
  }

  getAccessTokens(): AccessToken[] {
    return (
      this.getCachedStorage<AccessToken[]>('hula_access_tokens', (data) => {
        const parsed = JSON.parse(data)
        return Array.isArray(parsed) ? parsed : []
      }) || []
    )
  }

  revokeAccessToken(tokenId: string): boolean {
    if (typeof localStorage !== 'undefined') {
      const tokens = this.getAccessTokens()
      const filteredTokens = tokens.filter((t) => t.id !== tokenId)
      if (filteredTokens.length !== tokens.length) {
        this.setStorageWithCache('hula_access_tokens', filteredTokens)
        return true
      }
    }
    return false
  }

  clearExpiredTokens(): void {
    if (typeof localStorage !== 'undefined') {
      const tokens = this.getAccessTokens()
      const now = Date.now()
      const validTokens = tokens.filter((t) => !t.expiresAt || t.expiresAt > now)
      this.setStorageWithCache('hula_access_tokens', validTokens)
    }
  }

  addThirdPartyApp(app: Omit<ThirdPartyApp, 'id'>): void {
    if (typeof localStorage !== 'undefined') {
      const apps = this.getThirdPartyApps()
      const newApp: ThirdPartyApp = {
        ...app,
        id: `app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }

      const newApps = [newApp, ...apps]
      if (newApps.length > MAX_THIRD_PARTY_APPS) {
        newApps.length = MAX_THIRD_PARTY_APPS
      }

      this.setStorageWithCache('hula_third_party_apps', newApps)
    }
  }

  getThirdPartyApps(): ThirdPartyApp[] {
    return (
      this.getCachedStorage<ThirdPartyApp[]>('hula_third_party_apps', (data) => {
        const parsed = JSON.parse(data)
        return Array.isArray(parsed) ? parsed : []
      }) || []
    )
  }

  revokeThirdPartyApp(appId: string): boolean {
    if (typeof localStorage !== 'undefined') {
      const apps = this.getThirdPartyApps()
      const filteredApps = apps.filter((a) => a.id !== appId)
      if (filteredApps.length !== apps.length) {
        this.setStorageWithCache('hula_third_party_apps', filteredApps)
        return true
      }
    }
    return false
  }

  updateThirdPartyApp(appId: string, updates: Partial<ThirdPartyApp>): boolean {
    if (typeof localStorage !== 'undefined') {
      const apps = this.getThirdPartyApps()
      const updatedApps = apps.map((app) => (app.id === appId ? { ...app, ...updates } : app))
      if (updatedApps.some((app, index) => index < apps.length && app.id === appId)) {
        this.setStorageWithCache('hula_third_party_apps', updatedApps)
        return true
      }
    }
    return false
  }
}

export default MatrixSettingsService
export type { UserSettings, NotificationSettings, PrivacySettings, SaveSettingsParams }
