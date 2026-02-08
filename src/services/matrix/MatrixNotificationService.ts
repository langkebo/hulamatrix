import MatrixClientService from './MatrixClientService'
import { ref, type Ref } from 'vue'

export const NotificationScope = {
  Global: 'global',
  Device: 'device'
}

export type NotificationScopeValue = typeof NotificationScope.Global | typeof NotificationScope.Device

export interface NotificationRule {
  id: string
  kind: string
  enabled: boolean
  actions: any[]
  conditions?: any[]
  pattern?: string
  isDefault: boolean
}

export interface RoomNotificationSettings {
  roomId: string
  notificationsEnabled: boolean
  soundEnabled: boolean
  highlightEnabled: boolean
  name: string
  avatar: string
  notificationLevel: 'all' | 'mention' | 'mute'
}

export interface NotificationSettings {
  enabled: boolean
  sound: boolean
  desktop: boolean
  desktopPreview: 'none' | 'all' | 'sender'
  mentionOnly: boolean
  dndEnabled: boolean
  dndStart: number
  dndEnd: number
}

export interface LegacyNotificationSettings {
  desktopNotifications: boolean
  pushNotifications: boolean
  soundNotifications: boolean
  showNotificationsInChat: boolean
  highlightWords: string[]
  ringSound: string
  messageSound: string
}

class MatrixNotificationService {
  private static instance: MatrixNotificationService
  private pushRules: any = null
  private notificationListeners: Map<string, ((data: any) => void)[]> = new Map()
  private notificationHistory: Array<{
    id: string
    title: string
    body: string
    timestamp: number
    roomId?: string
    senderId?: string
  }> = []

  private _pushRules: Ref<NotificationRule[]> = ref([])
  private _legacySettings: Ref<LegacyNotificationSettings> = ref({
    desktopNotifications: true,
    pushNotifications: true,
    soundNotifications: true,
    showNotificationsInChat: true,
    highlightWords: [],
    ringSound: 'default',
    messageSound: 'default'
  })
  private _settings: Ref<NotificationSettings> = ref({
    enabled: true,
    sound: true,
    desktop: true,
    desktopPreview: 'all',
    mentionOnly: false,
    dndEnabled: false,
    dndStart: 0,
    dndEnd: 0
  })

  private constructor() {}

  static getInstance(): MatrixNotificationService {
    if (!MatrixNotificationService.instance) {
      MatrixNotificationService.instance = new MatrixNotificationService()
    }
    return MatrixNotificationService.instance
  }

  get pushRulesList(): Ref<NotificationRule[]> {
    return this._pushRules
  }

  get notificationSettings(): Ref<NotificationSettings> {
    return this._settings
  }

  get legacySettings(): Ref<LegacyNotificationSettings> {
    return this._legacySettings
  }

  get globalRules(): NotificationRule[] {
    return this._pushRules.value.filter((r) => r.kind === 'override' || r.kind === 'underride')
  }

  get roomRules(): NotificationRule[] {
    return this._pushRules.value.filter((r) => r.kind === 'room')
  }

  get contentRules(): NotificationRule[] {
    return this._pushRules.value.filter((r) => r.kind === 'content')
  }

  get disabledRules(): NotificationRule[] {
    return this._pushRules.value.filter((r) => !r.enabled)
  }

  get notificationStatus(): { isEnabled: boolean; permission: string; roomCount: number } {
    return {
      isEnabled: this._settings.value.enabled,
      permission: this.getNotificationPermissionStatus(),
      roomCount: this.roomRules.length
    }
  }

  async loadPushRules(): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      this.pushRules = await client.getPushRules()
      this._pushRules.value = this.convertPushRules(this.pushRules)
    } catch (error) {
      console.error('Failed to load push rules:', error)
      throw error
    }
  }

  private convertPushRules(pushRules: any): NotificationRule[] {
    const rules: NotificationRule[] = []
    const kinds = ['override', 'content', 'room', 'sender', 'underride']

    for (const kind of kinds) {
      const ruleSet = pushRules.global?.[kind]
      if (ruleSet) {
        for (const rule of ruleSet) {
          rules.push({
            id: rule.rule_id,
            kind,
            enabled: rule.enabled,
            actions: rule.actions || [],
            conditions: rule.conditions,
            pattern: rule.pattern,
            isDefault: rule.default
          })
        }
      }
    }

    return rules
  }

  async setPushRuleEnabled(
    scope: NotificationScopeValue,
    kind: string,
    ruleId: string,
    enabled: boolean
  ): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      await client.setPushRuleEnabled(scope, kind as any, ruleId, enabled)
      await this.loadPushRules()
      this.notifyListeners('ruleChanged', { ruleId, enabled })
    } catch (error) {
      console.error('Failed to set push rule enabled:', error)
      throw error
    }
  }

  async enablePushRule(ruleId: string): Promise<boolean> {
    try {
      const rule = this._pushRules.value.find((r) => r.id === ruleId)
      if (!rule) return false

      await this.setPushRuleEnabled(NotificationScope.Global, rule.kind, ruleId, true)
      return true
    } catch (error) {
      console.error('Failed to enable push rule:', error)
      return false
    }
  }

  async disablePushRule(ruleId: string): Promise<boolean> {
    try {
      const rule = this._pushRules.value.find((r) => r.id === ruleId)
      if (!rule) return false

      await this.setPushRuleEnabled(NotificationScope.Global, rule.kind, ruleId, false)
      return true
    } catch (error) {
      console.error('Failed to disable push rule:', error)
      return false
    }
  }

  async addPushRule(
    scope: NotificationScopeValue,
    kind: string,
    ruleId: string,
    pattern?: string,
    conditions?: any[],
    actions?: any[]
  ): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      await client.addPushRule(scope, kind as any, ruleId, {
        pattern,
        conditions,
        actions: actions || ['notify', { set_tweak: 'highlight', value: true }]
      })
      await this.loadPushRules()
      this.notifyListeners('ruleAdded', { ruleId, kind })
    } catch (error) {
      console.error('Failed to add push rule:', error)
      throw error
    }
  }

  async deletePushRule(scope: NotificationScopeValue, kind: string, ruleId: string): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      await client.deletePushRule(scope, kind as any, ruleId)
      await this.loadPushRules()
      this.notifyListeners('ruleDeleted', { ruleId, kind })
    } catch (error) {
      console.error('Failed to delete push rule:', error)
      throw error
    }
  }

  async setRoomNotifications(roomId: string, enabled: boolean): Promise<void> {
    const kind = 'room'
    const existingRule = this._pushRules.value.find((r) => r.kind === kind && r.id === roomId)

    if (existingRule) {
      if (!enabled) {
        await this.deletePushRule(NotificationScope.Global, kind, roomId)
      }
    } else if (enabled) {
      await this.addPushRule(NotificationScope.Global, kind, roomId, undefined, undefined, [
        'notify',
        { set_tweak: 'highlight', value: true }
      ])
    }
  }

  async muteRoom(roomId: string): Promise<boolean> {
    try {
      await this.setRoomNotifications(roomId, false)
      return true
    } catch (error) {
      console.error('Failed to mute room:', error)
      return false
    }
  }

  async unmuteRoom(roomId: string): Promise<boolean> {
    try {
      await this.setRoomNotifications(roomId, true)
      return true
    } catch (error) {
      console.error('Failed to unmute room:', error)
      return false
    }
  }

  isRoomMuted(roomId: string): boolean {
    const roomRule = this._pushRules.value.find((r) => r.kind === 'room' && r.id === roomId)
    return roomRule ? !roomRule.enabled : false
  }

  async setMentionNotifications(enabled: boolean): Promise<void> {
    const mentionRules = ['.m.rule.is_user_mention', '.m.rule.is_room_mention']
    for (const ruleId of mentionRules) {
      await this.setPushRuleEnabled(NotificationScope.Global, 'override', ruleId, enabled)
    }
  }

  async addHighlightWord(word: string): Promise<void> {
    const kind = 'content'
    const ruleId = `hl_${word}`
    const pattern = word

    await this.addPushRule(NotificationScope.Global, kind, ruleId, pattern, undefined, [
      'notify',
      { set_tweak: 'highlight', value: true }
    ])
  }

  async removeHighlightWord(word: string): Promise<void> {
    const kind = 'content'
    const ruleId = `hl_${word}`

    try {
      await this.deletePushRule(NotificationScope.Global, kind, ruleId)
    } catch (error) {
      console.warn('Failed to remove highlight word:', error)
    }
  }

  async addHighlightKeyword(word: string): Promise<boolean> {
    try {
      await this.addHighlightWord(word)
      return true
    } catch (error) {
      console.error('Failed to add highlight keyword:', error)
      return false
    }
  }

  async removeHighlightKeyword(word: string): Promise<boolean> {
    try {
      await this.removeHighlightWord(word)
      return true
    } catch (error) {
      console.error('Failed to remove highlight keyword:', error)
      return false
    }
  }

  getHighlightKeywords(): string[] {
    const contentRules = this._pushRules.value.filter((r) => r.kind === 'content' && r.pattern)
    return contentRules.map((r) => r.pattern!).filter((p) => p && !p.startsWith('.m.rule.'))
  }

  getGlobalNotificationLevel(): number {
    if (!this.pushRules) return 2

    const rules = this.pushRules.global?.override || []
    const masterRule = rules.find((r: any) => r.rule_id === '.m.rule.master')

    if (masterRule && !masterRule.enabled) {
      return 0
    }

    const contentRules = this.pushRules.global?.content || []
    const highlightRules = contentRules.filter((r: any) =>
      r.actions?.some((a: any) => typeof a === 'object' && a.set_tweak === 'highlight' && a.value === true)
    )

    if (highlightRules.length > 0) {
      return 3
    }

    return 2
  }

  async requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      return 'denied' as NotificationPermission
    }

    if (Notification.permission === 'granted') {
      return 'granted'
    }

    if (Notification.permission === 'denied') {
      return 'denied'
    }

    return await Notification.requestPermission()
  }

  getNotificationPermissionStatus(): string {
    if (!('Notification' in window)) {
      return 'unsupported'
    }

    return Notification.permission
  }

  isNotificationSupported(): boolean {
    return 'Notification' in window
  }

  checkNotificationPermission(): { granted: boolean } {
    if (!('Notification' in window)) {
      return { granted: false }
    }
    return { granted: Notification.permission === 'granted' }
  }

  async showLocalNotification(title: string, body: string, options?: NotificationOptions): Promise<void> {
    const permission = await this.requestNotificationPermission()
    if (permission !== 'granted') {
      console.warn('Notification permission not granted')
      return
    }

    const notification = new Notification(title, {
      body,
      icon: '/icon.png',
      tag: 'hula-notification',
      ...options
    })

    notification.onclick = () => {
      window.focus()
      notification.close()
    }

    this.addNotificationToHistory({
      title,
      body,
      timestamp: Date.now(),
      roomId: options?.data?.roomId,
      senderId: options?.data?.senderId
    })
  }

  addNotificationToHistory(notification: {
    title: string
    body: string
    timestamp: number
    roomId?: string
    senderId?: string
  }): void {
    const id = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    this.notificationHistory.push({ id, ...notification })

    if (this.notificationHistory.length > 100) {
      this.notificationHistory = this.notificationHistory.slice(-100)
    }

    this.notifyListeners('notificationAdded', { id, notification })
  }

  getNotificationHistory(limit: number = 50): Array<{
    id: string
    title: string
    body: string
    timestamp: number
    roomId?: string
    senderId?: string
  }> {
    return this.notificationHistory.slice(-limit).reverse()
  }

  clearNotificationHistory(): void {
    this.notificationHistory = []
    this.notifyListeners('historyCleared', {})
  }

  deleteNotificationFromHistory(notificationId: string): boolean {
    const index = this.notificationHistory.findIndex((n) => n.id === notificationId)
    if (index !== -1) {
      this.notificationHistory.splice(index, 1)
      this.notifyListeners('notificationDeleted', { id: notificationId })
      return true
    }
    return false
  }

  async getNotificationSettings(): Promise<NotificationSettings> {
    return this._settings.value
  }

  async setNotificationSettings(settings: NotificationSettings): Promise<void> {
    this._settings.value = settings
  }

  async saveNotificationSettings(settings: NotificationSettings): Promise<void> {
    await this.setNotificationSettings(settings)
  }

  async getRoomNotificationSettings(): Promise<RoomNotificationSettings[]> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      return []
    }

    const rooms = client.getRooms()
    const roomSettings: RoomNotificationSettings[] = []

    for (const room of rooms) {
      const roomRule = this._pushRules.value.find((r) => r.kind === 'room' && r.id === room.roomId)

      const currentState = room.currentState
      const name =
        (currentState.getStateEvents?.('m.room.name')?.[0]?.getContent?.()?.name as string) ||
        (room.name as string) ||
        'Unknown Room'
      const avatarUrl = currentState.getStateEvents?.('m.room.avatar')?.[0]?.getContent?.()?.url as string

      let notificationLevel: 'all' | 'mention' | 'mute' = 'all'
      if (roomRule) {
        if (!roomRule.enabled) {
          notificationLevel = 'mute'
        } else {
          const hasHighlight = roomRule.actions.some(
            (a: any) => typeof a === 'object' && a.set_tweak === 'highlight' && a.value === true
          )
          notificationLevel = hasHighlight ? 'all' : 'mention'
        }
      }

      roomSettings.push({
        roomId: room.roomId,
        notificationsEnabled: roomRule?.enabled ?? true,
        soundEnabled: roomRule?.actions.some((a: any) => typeof a === 'object' && a.set_tweak === 'sound') ?? false,
        highlightEnabled:
          roomRule?.actions.some(
            (a: any) => typeof a === 'object' && a.set_tweak === 'highlight' && a.value === true
          ) ?? true,
        name: name || 'Unknown Room',
        avatar: avatarUrl || '',
        notificationLevel
      })
    }

    return roomSettings
  }

  async setRoomNotificationLevel(roomId: string, level: 'all' | 'mention' | 'mute'): Promise<void> {
    switch (level) {
      case 'mute':
        await this.muteRoom(roomId)
        break
      case 'all':
        await this.setRoomNotifications(roomId, true)
        break
      case 'mention':
        await this.setRoomNotifications(roomId, true)
        break
    }
  }

  async setRoomNotificationSetting(roomId: string, level: string): Promise<void> {
    await this.setRoomNotificationLevel(roomId, level as 'all' | 'mention' | 'mute')
  }

  on(event: string, listener: (data: any) => void): void {
    if (!this.notificationListeners.has(event)) {
      this.notificationListeners.set(event, [])
    }
    this.notificationListeners.get(event)?.push(listener)
  }

  off(event: string, listener: (data: any) => void): void {
    const listeners = this.notificationListeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(listener)
      if (index !== -1) {
        listeners.splice(index, 1)
      }
    }
  }

  private notifyListeners(event: string, data: any): void {
    const listeners = this.notificationListeners.get(event)
    if (listeners) {
      listeners.forEach((listener) => listener(data))
    }
  }

  destroy(): void {
    this.notificationListeners.clear()
    this.pushRules = null
    this._pushRules.value = []
  }
}

export default MatrixNotificationService
