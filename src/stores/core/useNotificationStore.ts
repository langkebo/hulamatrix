import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'

export interface FeedNotificationItem {
  id: string
  type: 'like' | 'comment'
  feedId: string
  feedContent: string
  operatorUid: string
  operatorName: string
  operatorAvatar: string
  commentContent?: string
  createTime: number
  isRead: boolean
}

interface NotificationStats {
  unreadCount: number
  totalCount: number
}

export const useNotificationStore = defineStore('notification', () => {
  const systemNotice = ref(false)
  const notifications = ref<FeedNotificationItem[]>([])
  const notificationStats = reactive<NotificationStats>({ unreadCount: 0, totalCount: 0 })

  const addNotification = (notification: FeedNotificationItem) => {
    const exists = notifications.value.some(
      (n) =>
        n.feedId === notification.feedId &&
        n.operatorUid === notification.operatorUid &&
        n.type === notification.type &&
        Math.abs(n.createTime - notification.createTime) < 1000
    )
    if (!exists) {
      notifications.value.unshift(notification)
      notificationStats.totalCount++
      if (!notification.isRead) notificationStats.unreadCount++
    }
  }

  const markAsRead = (notificationId: string) => {
    const notification = notifications.value.find((n) => n.id === notificationId)
    if (notification && !notification.isRead) {
      notification.isRead = true
      notificationStats.unreadCount = Math.max(0, notificationStats.unreadCount - 1)
    }
  }

  const markAllAsRead = () => {
    notifications.value.forEach((n) => (n.isRead = true))
    notificationStats.unreadCount = 0
  }

  const deleteNotification = (notificationId: string) => {
    const index = notifications.value.findIndex((n) => n.id === notificationId)
    if (index > -1) {
      const notification = notifications.value[index]
      if (!notification?.isRead) {
        notificationStats.unreadCount = Math.max(0, notificationStats.unreadCount - 1)
      }
      notifications.value.splice(index, 1)
      notificationStats.totalCount = Math.max(0, notificationStats.totalCount - 1)
    }
  }

  const clearAllNotifications = () => {
    notifications.value = []
    notificationStats.unreadCount = 0
    notificationStats.totalCount = 0
  }

  return {
    systemNotice,
    notifications,
    notificationStats,
    addNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications
  }
})
