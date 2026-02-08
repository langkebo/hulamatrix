export interface NotificationSettings {
  enabled: boolean
  sound: boolean
  desktop: boolean
  desktopPreview: 'all' | 'sender' | 'none'
  mentionOnly: boolean
  dndEnabled: boolean
  dndStart: number
  dndEnd: number
}

export interface RoomNotificationSetting {
  roomId: string
  name: string
  avatar?: string
  notificationLevel: 'all' | 'mention' | 'mute'
}

export type NotificationLevel = 'all' | 'mention' | 'mute'

export interface PushRule {
  ruleId: string
  scope: string
  kind: string
  actions: any[]
  conditions?: any[]
  enabled: boolean
  pattern?: string
}

export interface PushRules {
  global: {
    override: PushRule[]
    content: PushRule[]
    room: PushRule[]
    sender: PushRule[]
    underride: PushRule[]
  }
  device: Record<string, any>
}

export interface NotificationPermission {
  granted: boolean
  default: boolean
  denied: boolean
}
