export interface PrivacySettings {
  readReceipts: boolean
  typingIndicator: boolean
  linkPreviews: boolean
  autoDownload: boolean
  profileVisibility: 'public' | 'restricted' | 'private'
  presenceVisibility: 'public' | 'restricted' | 'private'
}

export interface AppearanceSettings {
  theme: 'light' | 'dark' | 'system'
  language: string
  fontSize: number
  zoom: number
}

export interface MessageSettings {
  historyLimit: '1w' | '1m' | '3m' | '1y' | 'all'
  autoRead: boolean
  emojiPanel: boolean
  gifSearch: boolean
  linkPreviews: boolean
}

export interface CallSettings {
  camera: string
  microphone: string
  speaker: string
  noiseSuppression: boolean
  autoAnswer: boolean
  videoQuality: 'low' | 'medium' | 'high'
}

export interface AccessibilitySettings {
  screenReader: boolean
  highContrast: boolean
  reduceMotion: boolean
  keyboardNavigation: boolean
  fontSize: number
}

export interface LabFeature {
  key: string
  labelKey: string
  descriptionKey: string
  enabled: boolean
}

export interface LabsSettings {
  enabled: boolean
  features: LabFeature[]
}

export interface UserSettings {
  privacy: PrivacySettings
  appearance: AppearanceSettings
  messages: MessageSettings
  calls: CallSettings
  accessibility: AccessibilitySettings
  labs: LabsSettings
}
