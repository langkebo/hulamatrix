/**
 * 统一的通知管理 Store
 * 合并了 notice 和 feedNotification 的功能
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

// 通知类型
export type NotificationType =
  | 'system' // 系统通知
  | 'feed' // 动态通知
  | 'message' // 消息通知
  | 'friend' // 好友通知
  | 'group' // 群组通知
  | 'update' // 更新通知
  | 'warning' // 警告
  | 'error' // 错误

// 通知级别
export type NotificationLevel = 'info' | 'success' | 'warning' | 'error'

// 通知状态
export type NotificationStatus = 'unread' | 'read' | 'archived'

// 通知项
export interface Notification {
  id: string
  type: NotificationType
  level: NotificationLevel
  title: string
  content?: string
  avatar?: string
  timestamp: number
  status: NotificationStatus
  persistent?: boolean // 是否持久化（不会被自动清除）
  action?: {
    label: string
    handler: () => void
  }
  metadata?: Record<string, unknown> // 额外的元数据
  readTime?: number
}

// 通知设置
export interface NotificationSettings {
  enableSystem: boolean
  enableFeed: boolean
  enableMessage: boolean
  enableFriend: boolean
  enableGroup: boolean
  enableSound: boolean
  enableDesktop: boolean
  maxCount: number
  autoArchiveDays: number
}

// 默认设置
const DEFAULT_SETTINGS: NotificationSettings = {
  enableSystem: true,
  enableFeed: true,
  enableMessage: true,
  enableFriend: true,
  enableGroup: true,
  enableSound: true,
  enableDesktop: true,
  maxCount: 100,
  autoArchiveDays: 30
}

// 加载设置
function loadSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem('NOTIFICATION_SETTINGS')
    if (raw) {
      const parsed = JSON.parse(raw)
      return { ...DEFAULT_SETTINGS, ...parsed }
    }
  } catch {}
  return DEFAULT_SETTINGS
}

// 保存设置
function saveSettings(settings: NotificationSettings) {
  try {
    localStorage.setItem('NOTIFICATION_SETTINGS', JSON.stringify(settings))
  } catch {}
}

// 加载通知列表
function loadNotifications(): Notification[] {
  try {
    const raw = localStorage.getItem('NOTIFICATIONS')
    if (raw) return JSON.parse(raw)
  } catch {}
  return []
}

// 保存通知列表
function saveNotifications(notifications: Notification[]) {
  try {
    localStorage.setItem('NOTIFICATIONS', JSON.stringify(notifications))
  } catch {}
}

export const useNotificationStore = defineStore('notifications', () => {
  // 设置
  const settings = ref<NotificationSettings>(loadSettings())

  // 通知列表
  const notifications = ref<Notification[]>(loadNotifications())

  // 当前显示的通知（用于弹窗等）
  const currentNotification = ref<Notification | null>(null)

  // 更新设置
  const updateSettings = (newSettings: Partial<NotificationSettings>) => {
    settings.value = { ...settings.value, ...newSettings }
    saveSettings(settings.value)
  }

  // 生成通知ID
  const generateId = () => {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // 添加通知
  const addNotification = (
    type: NotificationType,
    level: NotificationLevel,
    title: string,
    options: Partial<Omit<Notification, 'id' | 'type' | 'level' | 'title' | 'timestamp' | 'status'>> = {}
  ) => {
    // 检查是否启用该类型的通知
    switch (type) {
      case 'system':
        if (!settings.value.enableSystem) return null
        break
      case 'feed':
        if (!settings.value.enableFeed) return null
        break
      case 'message':
        if (!settings.value.enableMessage) return null
        break
      case 'friend':
        if (!settings.value.enableFriend) return null
        break
      case 'group':
        if (!settings.value.enableGroup) return null
        break
    }

    // 检查最大数量限制
    const activeNotifications = notifications.value.filter((n) => n.status === 'unread')
    if (activeNotifications.length >= settings.value.maxCount) {
      // 自动归档最旧的通知
      const oldestUnread = activeNotifications.sort((a, b) => a.timestamp - b.timestamp)[0]
      if (oldestUnread && !oldestUnread.persistent) {
        archiveNotification(oldestUnread.id)
      }
    }

    const notification: Notification = {
      id: generateId(),
      type,
      level,
      title,
      timestamp: Date.now(),
      status: 'unread',
      ...options
    }

    notifications.value.unshift(notification)
    saveNotifications(notifications.value)

    // 设置为当前通知
    currentNotification.value = notification

    // 触发桌面通知
    if (settings.value.enableDesktop) {
      triggerDesktopNotification(notification)
    }

    // 播放声音
    if (settings.value.enableSound) {
      playNotificationSound(level)
    }

    return notification
  }

  // 快捷方法
  const addSystemNotification = (title: string, content?: string, level: NotificationLevel = 'info') =>
    addNotification('system', level, title, { content: content ?? '' })

  const addFeedNotification = (title: string, content?: string, avatar?: string) =>
    addNotification('feed', 'info', title, { content: content ?? '', avatar: avatar ?? '' })

  const addMessageNotification = (title: string, content?: string, action?: Notification['action']) => {
    const payload: Partial<Omit<Notification, 'id' | 'type' | 'level' | 'title' | 'timestamp' | 'status'>> = {
      content: content ?? ''
    }
    if (action !== undefined) payload.action = action
    addNotification('message', 'info', title, payload)
  }

  const addFriendNotification = (title: string, content?: string, level: NotificationLevel = 'info') =>
    addNotification('friend', level, title, { content: content ?? '' })

  const addGroupNotification = (title: string, content?: string, level: NotificationLevel = 'info') =>
    addNotification('group', level, title, { content: content ?? '' })

  const addWarning = (title: string, content?: string) =>
    addNotification('warning', 'warning', title, { content: content ?? '', persistent: true })

  const addError = (title: string, content?: string) =>
    addNotification('error', 'error', title, { content: content ?? '', persistent: true })

  // 标记为已读
  const markAsRead = (id: string) => {
    const notification = notifications.value.find((n) => n.id === id)
    if (notification && notification.status === 'unread') {
      notification.status = 'read'
      notification.readTime = Date.now()
      saveNotifications(notifications.value)
    }
  }

  // 批量标记为已读
  const markAllAsRead = (type?: NotificationType) => {
    notifications.value
      .filter((n) => n.status === 'unread' && (!type || n.type === type))
      .forEach((n) => {
        n.status = 'read'
        n.readTime = Date.now()
      })
    saveNotifications(notifications.value)
  }

  // 归档通知
  const archiveNotification = (id: string) => {
    const notification = notifications.value.find((n) => n.id === id)
    if (notification) {
      notification.status = 'archived'
      saveNotifications(notifications.value)
    }
  }

  // 批量归档
  const archiveOldNotifications = () => {
    const cutoffTime = Date.now() - settings.value.autoArchiveDays * 24 * 60 * 60 * 1000
    notifications.value
      .filter((n) => n.status === 'read' && n.readTime && n.readTime < cutoffTime && !n.persistent)
      .forEach((n) => {
        n.status = 'archived'
      })
    saveNotifications(notifications.value)
  }

  // 删除通知
  const removeNotification = (id: string) => {
    const index = notifications.value.findIndex((n) => n.id === id)
    if (index !== -1) {
      notifications.value.splice(index, 1)
      saveNotifications(notifications.value)
    }
  }

  // 清空通知
  const clearNotifications = (type?: NotificationType) => {
    if (type) {
      notifications.value = notifications.value.filter((n) => n.type !== type || n.persistent)
    } else {
      notifications.value = notifications.value.filter((n) => n.persistent)
    }
    saveNotifications(notifications.value)
  }

  // 获取未读数量
  const getUnreadCount = (type?: NotificationType) => {
    return notifications.value.filter((n) => n.status === 'unread' && (!type || n.type === type)).length
  }

  // 获取通知列表
  const getNotifications = (status?: NotificationStatus, type?: NotificationType, limit?: number) => {
    let filtered = notifications.value

    if (status) {
      filtered = filtered.filter((n) => n.status === status)
    }
    if (type) {
      filtered = filtered.filter((n) => n.type === type)
    }

    filtered.sort((a, b) => b.timestamp - a.timestamp)

    if (limit) {
      filtered = filtered.slice(0, limit)
    }

    return filtered
  }

  // 触发桌面通知
  const triggerDesktopNotification = (notification: Notification) => {
    if (!('Notification' in window)) return

    if (Notification.permission === 'granted') {
      const desktopNotif = new Notification(notification.title ?? '', {
        body: notification.content ?? '',
        icon: notification.avatar ?? '/favicon.ico',
        tag: notification.id,
        requireInteraction: !!notification.persistent,
        silent: !settings.value.enableSound
      })

      desktopNotif.onclick = () => {
        window.focus()
        if (notification.action) {
          notification.action.handler()
        }
        markAsRead(notification.id)
        desktopNotif.close()
      }
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission()
    }
  }

  // 播放通知声音
  const playNotificationSound = (level: NotificationLevel) => {
    void level
    // 这里可以根据不同的级别播放不同的声音
    // 暂时使用系统默认声音
    try {
      const audio = new Audio()
      audio.src = '/sounds/notification.mp3'
      audio.volume = 0.5
      audio.play().catch(() => {
        // 忽略播放失败
      })
    } catch {
      // 忽略错误
    }
  }

  // 清理当前通知
  const clearCurrentNotification = () => {
    currentNotification.value = null
  }

  // 初始化时清理过期通知
  const initialize = () => {
    archiveOldNotifications()

    // 请求桌面通知权限
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }

  return {
    // 状态
    settings,
    notifications,
    currentNotification,

    // 设置管理
    updateSettings,

    // 通知管理
    addNotification,
    addSystemNotification,
    addFeedNotification,
    addMessageNotification,
    addFriendNotification,
    addGroupNotification,
    addWarning,
    addError,

    // 状态管理
    markAsRead,
    markAllAsRead,
    archiveNotification,
    archiveOldNotifications,
    removeNotification,
    clearNotifications,

    // 查询方法
    getUnreadCount,
    getNotifications,

    // UI 控制
    clearCurrentNotification,
    initialize
  }
})
