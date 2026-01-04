/**
 * Mobile Settings Configuration
 * 移动端设置页面配置
 */

import type { SettingsPageConfig } from './types'
import { SettingsItemType } from './types'

/**
 * 主设置页面配置
 */
export const mainSettingsConfig: SettingsPageConfig = {
  title: 'settings.title',
  sections: [
    {
      title: 'settings.section.account',
      items: [
        {
          key: 'profile',
          type: SettingsItemType.NAVIGATION,
          label: 'settings.menu.profile',
          icon: 'user',
          route: '/mobile/settings/profile'
        },
        {
          key: 'sessions',
          type: SettingsItemType.NAVIGATION,
          label: 'settings.menu.sessions',
          icon: 'devices',
          route: '/mobile/settings/sessions'
        }
      ]
    },
    {
      title: 'settings.section.preferences',
      items: [
        {
          key: 'notification',
          type: SettingsItemType.NAVIGATION,
          label: 'settings.menu.notification',
          icon: 'bell',
          route: '/mobile/settings/notification'
        },
        {
          key: 'appearance',
          type: SettingsItemType.NAVIGATION,
          label: 'settings.menu.appearance',
          icon: 'palette',
          route: '/mobile/settings/appearance'
        }
      ]
    },
    {
      title: 'settings.section.privacy_security',
      items: [
        {
          key: 'privacy',
          type: SettingsItemType.NAVIGATION,
          label: 'settings.menu.privacy',
          icon: 'shield',
          route: '/mobile/settings/privacy'
        },
        {
          key: 'biometric',
          type: SettingsItemType.NAVIGATION,
          label: 'settings.menu.biometric',
          icon: 'fingerprint',
          route: '/mobile/settings/biometric'
        },
        {
          key: 'encryption',
          type: SettingsItemType.NAVIGATION,
          label: 'settings.menu.encryption',
          icon: 'lock',
          route: '/mobile/e2ee/devices'
        }
      ]
    },
    {
      title: 'settings.section.advanced',
      items: [
        {
          key: 'keyboard',
          type: SettingsItemType.NAVIGATION,
          label: 'settings.menu.keyboard',
          icon: 'keyboard',
          route: '/mobile/settings/keyboard'
        },
        {
          key: 'audio',
          type: SettingsItemType.NAVIGATION,
          label: 'settings.menu.audio',
          icon: 'speaker',
          route: '/mobile/settings/audio'
        },
        {
          key: 'labs',
          type: SettingsItemType.NAVIGATION,
          label: 'settings.menu.labs',
          icon: 'flask',
          route: '/mobile/settings/labs'
        }
      ]
    }
  ]
}

/**
 * 路由映射配置
 */
export const settingsRoutes = {
  profile: '/mobile/settings/profile',
  sessions: '/mobile/settings/sessions',
  notification: '/mobile/settings/notification',
  appearance: '/mobile/settings/appearance',
  privacy: '/mobile/settings/privacy',
  privacyManage: '/mobile/settings/privacy/manage',
  biometric: '/mobile/settings/biometric',
  keyboard: '/mobile/settings/keyboard',
  audio: '/mobile/settings/audio',
  labs: '/mobile/settings/labs',
  feedback: '/mobile/settings/feedback'
} as const
