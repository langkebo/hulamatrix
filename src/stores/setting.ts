import { defineStore } from 'pinia'
import { CloseBxEnum, ShowModeEnum, ThemeEnum } from '@/enums'
import { isMac } from '@/utils/PlatformConstants'
import { cache } from '@/services/cache'
import { STORAGE_KEYS } from '@/constants'
import { applyThemeTokens, type ThemeMode } from '@/theme/tokens'
import { matrixClientService } from '@/integrations/matrix/client'

/** 成员排序枚举 */
export enum MemberSortEnum {
  ONLINE_FIRST = 'online_first' /** 在线优先 > 角色 > 字母 */,
  ROLE_FIRST = 'role_first' /** 角色优先 > 在线 > 字母 */,
  ALPHABETICAL = 'alphabetical' /** 纯字母排序 */
}

// 获取平台对应的默认快捷键
const getDefaultShortcuts = () => {
  return {
    screenshot: isMac() ? 'Cmd+Ctrl+H' : 'Ctrl+Alt+H',
    openMainPanel: isMac() ? 'Cmd+Ctrl+P' : 'Ctrl+Alt+P',
    globalEnabled: false // 默认关闭全局快捷键
  }
}
interface SettingState {
  themes: { content: string; pattern: string; versatile: string }
  themeMode?: 'light' | 'dark' | 'system'
  escClose: boolean
  showMode: ShowModeEnum
  lockScreen: { enable: boolean; password: string }
  tips: { type: CloseBxEnum; notTips: boolean }
  login: { autoLogin: boolean; autoStartup: boolean }
  chat: {
    sendKey: string
    isDouble: boolean
    translate: string
    layoutMode: string
    compactLayout: boolean
    imageSizeLimit: string
  }
  shortcuts: { screenshot: string; openMainPanel: string; globalEnabled: boolean }
  page: { shadow: boolean; fonts: string; blur: boolean; lang: string; fontScale: number }
  update: { dismiss: string }
  screenshot: { isConceal: boolean }
  notification: {
    messageSound: boolean
    keywords: string[]
    quietHours: { enabled: boolean; start: string; end: string }
  }
  /** 布局偏好：PC 端三栏布局设置 */
  layout?: {
    centerColumnWidth: number /** 中间列宽度 (px) */
    memberSortOrder: MemberSortEnum /** 成员排序方式 */
    memberListCollapsed: boolean /** 成员列表折叠状态 */
  }
  levels?: {
    account?: Record<string, unknown>
    device?: Record<string, unknown>
    defaults?: Record<string, unknown>
  }
}

export const useSettingStore = defineStore('setting', {
  state: (): SettingState => ({
    themes: {
      content: 'light',
      pattern: ThemeEnum.OS,
      versatile: 'default'
    },
    escClose: true,
    showMode: ShowModeEnum.ICON,
    lockScreen: {
      enable: false,
      password: ''
    },
    tips: {
      type: CloseBxEnum.HIDE,
      notTips: false
    },
    login: {
      autoLogin: false,
      autoStartup: false
    },
    chat: {
      sendKey: 'Enter',
      isDouble: true,
      translate: 'youdao',
      layoutMode: 'default',
      compactLayout: false,
      imageSizeLimit: 'auto'
    },
    shortcuts: getDefaultShortcuts(),
    page: {
      shadow: true,
      fonts: 'PingFang',
      blur: true,
      lang: 'AUTO',
      fontScale: 100
    },
    update: {
      dismiss: ''
    },
    screenshot: {
      isConceal: false
    },
    notification: {
      messageSound: true,
      keywords: [],
      quietHours: { enabled: false, start: '22:00', end: '08:00' }
    },
    /** 布局偏好默认值 */
    layout: {
      centerColumnWidth: 360 /** 匹配当前 initWidth 默认值 */,
      memberSortOrder: MemberSortEnum.ONLINE_FIRST,
      memberListCollapsed: false
    },
    levels: {
      account: {},
      device: {},
      defaults: {}
    }
  }),
  actions: {
    /** 初始化主题 */
    initTheme(theme: string) {
      this.themes.content = theme
      document.documentElement.dataset.theme = theme
      this.themes.pattern = theme
      try {
        applyThemeTokens(theme as ThemeMode)
        matrixClientService.setAccountSetting('appearance.theme', theme, 'account').then(async () => {
          const rb = await matrixClientService.getAccountSetting('appearance.theme')
          if (String(rb) !== String(theme)) {
            await matrixClientService.rollbackAccountSettings()
          }
        })
      } catch {}
    },
    /** 切换主题 */
    toggleTheme(theme: string) {
      if (theme === ThemeEnum.OS) {
        this.themes.pattern = theme
        const os = matchMedia('(prefers-color-scheme: dark)').matches ? ThemeEnum.DARK : ThemeEnum.LIGHT
        document.documentElement.dataset.theme = os
        this.themes.content = os
        try {
          applyThemeTokens(os as ThemeMode)
          matrixClientService.setAccountSetting('appearance.theme', os, 'account').then(async () => {
            const rb = await matrixClientService.getAccountSetting('appearance.theme')
            if (String(rb) !== String(os)) {
              await matrixClientService.rollbackAccountSettings()
            }
          })
        } catch {}
      } else {
        this.themes.content = theme
        document.documentElement.dataset.theme = theme
        this.themes.pattern = theme
        try {
          applyThemeTokens(theme as ThemeMode)
          matrixClientService.setAccountSetting('appearance.theme', theme, 'account').then(async () => {
            const rb = await matrixClientService.getAccountSetting('appearance.theme')
            if (String(rb) !== String(theme)) {
              await matrixClientService.rollbackAccountSettings()
            }
          })
        } catch {}
      }
    },
    /** 切换登录设置 */
    toggleLogin(autoLogin: boolean, autoStartup: boolean) {
      this.login.autoLogin = autoLogin
      this.login.autoStartup = autoStartup
    },

    setAutoLogin(autoLogin: boolean) {
      this.login.autoLogin = autoLogin
    },
    /** 设置菜单显示模式 */
    setShowMode(showMode: ShowModeEnum) {
      this.showMode = showMode
    },
    /** 设置截图快捷键 */
    setScreenshotShortcut(shortcut: string) {
      if (!this.shortcuts) {
        this.shortcuts = getDefaultShortcuts()
      }
      this.shortcuts.screenshot = shortcut
      matrixClientService
        .setAccountSetting('shortcuts.screenshot', shortcut, 'account')
        .then(async () => {
          const rb = await matrixClientService.getAccountSetting('shortcuts.screenshot')
          if (String(rb) !== String(shortcut)) {
            await matrixClientService.rollbackAccountSettings()
          }
        })
        .catch(() => {})
    },
    /** 设置打开主面板快捷键 */
    setOpenMainPanelShortcut(shortcut: string) {
      if (!this.shortcuts) {
        this.shortcuts = getDefaultShortcuts()
      }
      this.shortcuts.openMainPanel = shortcut
      matrixClientService
        .setAccountSetting('shortcuts.openMainPanel', shortcut, 'account')
        .then(async () => {
          const rb = await matrixClientService.getAccountSetting('shortcuts.openMainPanel')
          if (String(rb) !== String(shortcut)) {
            await matrixClientService.rollbackAccountSettings()
          }
        })
        .catch(() => {})
    },
    /** 设置发送消息快捷键 */
    setSendMessageShortcut(shortcut: string) {
      if (!this.chat) {
        this.chat = {
          sendKey: 'Enter',
          isDouble: true,
          translate: 'youdao',
          layoutMode: 'default',
          compactLayout: false,
          imageSizeLimit: 'auto'
        }
      }
      this.chat.sendKey = shortcut
    },
    /** 设置字体缩放 */
    setFontScale(scale: number) {
      this.page.fontScale = scale
      matrixClientService
        .setAccountSetting('appearance.fontScale', scale, 'account')
        .then(async () => {
          const rb = await matrixClientService.getAccountSetting('appearance.fontScale')
          if (String(rb) !== String(scale)) {
            await matrixClientService.rollbackAccountSettings()
          }
        })
        .catch(() => {})
    },
    /** 设置消息布局模式 */
    setLayoutMode(mode: string) {
      if (!this.chat) {
        this.chat = {
          sendKey: 'Enter',
          isDouble: true,
          translate: 'youdao',
          layoutMode: 'default',
          compactLayout: false,
          imageSizeLimit: 'auto'
        }
      }
      this.chat.layoutMode = mode
      matrixClientService
        .setAccountSetting('appearance.layoutMode', mode, 'account')
        .then(async () => {
          const rb = await matrixClientService.getAccountSetting('appearance.layoutMode')
          if (String(rb) !== String(mode)) {
            await matrixClientService.rollbackAccountSettings()
          }
        })
        .catch(() => {})
    },
    /** 设置紧凑布局 */
    setCompactLayout(compact: boolean) {
      if (!this.chat) {
        this.chat = {
          sendKey: 'Enter',
          isDouble: true,
          translate: 'youdao',
          layoutMode: 'default',
          compactLayout: false,
          imageSizeLimit: 'auto'
        }
      }
      this.chat.compactLayout = compact
      matrixClientService
        .setAccountSetting('appearance.compactLayout', compact, 'account')
        .then(async () => {
          const rb = await matrixClientService.getAccountSetting('appearance.compactLayout')
          if (String(rb) !== String(compact)) {
            await matrixClientService.rollbackAccountSettings()
          }
        })
        .catch(() => {})
    },
    /** 设置图片大小限制 */
    setImageSizeLimit(limit: string) {
      if (!this.chat) {
        this.chat = {
          sendKey: 'Enter',
          isDouble: true,
          translate: 'youdao',
          layoutMode: 'default',
          compactLayout: false,
          imageSizeLimit: 'auto'
        }
      }
      this.chat.imageSizeLimit = limit
      matrixClientService
        .setAccountSetting('appearance.imageSizeLimit', limit, 'account')
        .then(async () => {
          const rb = await matrixClientService.getAccountSetting('appearance.imageSizeLimit')
          if (String(rb) !== String(limit)) {
            await matrixClientService.rollbackAccountSettings()
          }
        })
        .catch(() => {})
    },
    /** 设置全局快捷键开关状态 */
    setGlobalShortcutEnabled(enabled: boolean) {
      if (!this.shortcuts) {
        this.shortcuts = getDefaultShortcuts()
      }
      this.shortcuts.globalEnabled = enabled
      matrixClientService
        .setAccountSetting('shortcuts.globalEnabled', enabled, 'account')
        .then(async () => {
          const rb = await matrixClientService.getAccountSetting('shortcuts.globalEnabled')
          if (String(rb) !== String(enabled)) {
            await matrixClientService.rollbackAccountSettings()
          }
        })
        .catch(() => {})
    },
    closeAutoLogin() {
      this.login.autoLogin = false
    },
    /** 设置截图时是否隐藏窗口 */
    setScreenshotConceal(isConceal: boolean) {
      if (!this.screenshot) {
        this.screenshot = { isConceal: false }
      }
      this.screenshot.isConceal = isConceal
    },
    /** 设置消息提示音开关 */
    setMessageSoundEnabled(enabled: boolean) {
      if (!this.notification) {
        this.notification = {
          messageSound: true,
          keywords: [],
          quietHours: { enabled: false, start: '22:00', end: '08:00' }
        }
      }
      this.notification.messageSound = enabled
    },
    /** 设置关键字列表 */
    setNotificationKeywords(list: string[]) {
      if (!this.notification) {
        this.notification = {
          messageSound: true,
          keywords: [],
          quietHours: { enabled: false, start: '22:00', end: '08:00' }
        }
      }
      this.notification.keywords = Array.from(new Set(list))
    },
    /** 设置静默时段 */
    setQuietHours(enabled: boolean, start: string, end: string) {
      if (!this.notification) {
        this.notification = {
          messageSound: true,
          keywords: [],
          quietHours: { enabled: false, start: '22:00', end: '08:00' }
        }
      }
      this.notification.quietHours = { enabled, start, end }
    },
    /** 异步保存设置到缓存 */
    async saveToCache(userId?: string) {
      if (userId) {
        cache.setUserId(userId)
      }
      await cache.set(STORAGE_KEYS.SETTINGS, this.$state, {
        storage: 'indexedDB',
        ttl: 30 * 24 * 60 * 60 * 1000 // 30天
      })
    },
    /** 从缓存加载设置 */
    async loadFromCache(userId?: string) {
      if (userId) {
        cache.setUserId(userId)
      }
      const cachedSettings = await cache.get(STORAGE_KEYS.SETTINGS, 'indexedDB')
      if (cachedSettings) {
        this.$patch(cachedSettings)
        return true
      }
      return false
    },
    /** SettingLevel: 账户/设备/默认 分层设置写入（骨架） */
    setLevelSetting(level: 'account' | 'device' | 'defaults', key: string, value: unknown) {
      if (!this.levels) {
        this.levels = { account: {}, device: {}, defaults: {} }
      }
      const target = this.levels[level] || {}
      target[key] = value
      this.levels[level] = target
    },
    /** SettingLevel: 分层读取（账户优先，其次设备，最后默认） */
    getLevelSetting(key: string) {
      const acc = this.levels?.account?.[key]
      if (acc !== undefined) return acc
      const dev = this.levels?.device?.[key]
      if (dev !== undefined) return dev
      return this.levels?.defaults?.[key]
    },
    /** 设置主题模式（light/dark/system） */
    setThemeMode(mode: 'light' | 'dark' | 'system') {
      this.themeMode = mode
      localStorage.setItem('theme-mode', mode)
      // 根据模式更新主题
      if (mode === 'dark') {
        this.initTheme(ThemeEnum.DARK)
      } else if (mode === 'light') {
        this.initTheme(ThemeEnum.LIGHT)
      } else {
        this.toggleTheme(ThemeEnum.OS)
      }
    },
    /** 设置主题（用于 ThemeSelector） */
    setTheme(options: { theme: string; darkMode: boolean }) {
      const theme = options.darkMode ? ThemeEnum.DARK : ThemeEnum.LIGHT
      this.initTheme(theme)
      // 同时更新 versatile（主题风格）
      if (this.themes) {
        this.themes.versatile = options.theme
      }
    },
    /** 设置中间列宽度并持久化 */
    setCenterColumnWidth(width: number) {
      if (!this.layout) {
        this.layout = {
          centerColumnWidth: 360,
          memberSortOrder: MemberSortEnum.ONLINE_FIRST,
          memberListCollapsed: false
        }
      }
      this.layout.centerColumnWidth = width
      this.saveToCache()
    },
    /** 设置成员排序方式并持久化 */
    setMemberSortOrder(order: MemberSortEnum) {
      if (!this.layout) {
        this.layout = {
          centerColumnWidth: 360,
          memberSortOrder: MemberSortEnum.ONLINE_FIRST,
          memberListCollapsed: false
        }
      }
      this.layout.memberSortOrder = order
      this.saveToCache()
    },
    /** 设置成员列表折叠状态并持久化 */
    setMemberListCollapsed(collapsed: boolean) {
      if (!this.layout) {
        this.layout = {
          centerColumnWidth: 360,
          memberSortOrder: MemberSortEnum.ONLINE_FIRST,
          memberListCollapsed: false
        }
      }
      this.layout.memberListCollapsed = collapsed
      this.saveToCache()
    }
  }
})
