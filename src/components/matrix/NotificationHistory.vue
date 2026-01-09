<template>
  <div class="notification-history">
    <!-- Header -->
    <div class="notification-header">
      <h3>通知历史</h3>
      <div class="header-actions">
        <n-button quaternary size="small" @click="markAllAsRead">
          <n-icon :component="CircleCheck" />
          全部已读
        </n-button>
        <n-button quaternary size="small" @click="clearAllNotifications">
          <n-icon :component="Trash" />
          清空
        </n-button>
      </div>
    </div>

    <!-- Filter Tabs -->
    <n-tabs v-model:value="activeFilter" type="segment" size="small">
      <n-tab-pane name="all" tab="全部">
        <n-badge :value="notificationCount" :max="99" show-zero />
      </n-tab-pane>
      <n-tab-pane name="unread" tab="未读">
        <n-badge :value="unreadCount" :max="99" show-zero />
      </n-tab-pane>
      <n-tab-pane name="mentions" tab="提及">
        <n-badge :value="mentionCount" :max="99" show-zero />
      </n-tab-pane>
      <n-tab-pane name="invites" tab="邀请">
        <n-badge :value="inviteCount" :max="99" show-zero />
      </n-tab-pane>
    </n-tabs>

    <!-- Search -->
    <div class="notification-search">
      <n-input v-model:value="searchQuery" placeholder="搜索通知..." clearable>
        <template #prefix>
          <n-icon :component="Search" />
        </template>
      </n-input>
    </div>

    <!-- Notification List -->
    <div class="notification-list">
      <!-- Group by Date -->
      <div v-for="group in groupedNotifications" :key="group.date" class="notification-group">
        <div class="group-header">
          <span class="group-date">{{ group.date }}</span>
        </div>

        <div
          v-for="notification in group.notifications"
          :key="notification.id"
          class="notification-item"
          :class="{
            unread: !notification.read,
            urgent: notification.urgent,
            mention: notification.type === 'mention'
          }"
          @click="handleNotificationClick(notification)">
          <!-- Room Avatar -->
          <div class="notification-avatar">
            <n-avatar
              v-bind="notification.roomAvatar !== undefined ? { src: notification.roomAvatar } : {}"
              round
              size="small"
              :fallback-src="'/default-room-avatar.png'">
              <n-icon v-if="notification.type === 'invite'" :component="UserPlus" />
              <n-icon v-else-if="notification.type === 'mention'" :component="At" />
              <n-icon v-else :component="MessageCircle" />
            </n-avatar>
            <div v-if="notification.urgent" class="urgent-indicator"></div>
          </div>

          <!-- Content -->
          <div class="notification-content">
            <div class="notification-header-info">
              <span class="room-name">{{ notification.roomName }}</span>
              <span class="notification-time">{{ formatTime(notification.timestamp || Date.now()) }}</span>
            </div>

            <!-- Title -->
            <div class="notification-title">
              <n-icon :component="getNotificationIcon(notification.type || 'message')" size="16" />
              <span>{{ notification.title }}</span>
            </div>

            <!-- Body -->
            <div class="notification-body">
              <div v-html="sanitizedBody(notification)"></div>
            </div>

            <!-- Actions -->
            <div v-if="notification.actions && notification.actions.length > 0" class="notification-actions">
              <n-button
                v-for="action in notification.actions"
                :key="action.action"
                text
                size="tiny"
                @click.stop="handleNotificationAction(action, notification)">
                {{ action.title }}
              </n-button>
            </div>
          </div>

          <!-- Status -->
          <div class="notification-status">
            <n-button v-if="!notification.read" text size="small" @click.stop="markAsRead(notification)">
              <n-icon :component="Check" />
            </n-button>
            <n-dropdown
              :options="getNotificationMenuOptions(notification)"
              @select="handleNotificationMenuAction($event, notification)">
              <n-button text size="small">
                <n-icon :component="DotsVertical" />
              </n-button>
            </n-dropdown>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="filteredNotifications.length === 0" class="empty-state">
        <n-empty :description="getEmptyDescription()" size="large">
          <template #icon>
            <n-icon size="48" :component="BellOff" />
          </template>
        </n-empty>
      </div>

      <!-- Load More -->
      <div v-if="hasMore" class="load-more">
        <n-button @click="loadMore" :loading="loading">加载更多</n-button>
      </div>
    </div>

    <!-- Notification Settings Modal -->
    <n-modal v-model:show="showSettings" preset="dialog" title="通知设置" class="notification-settings-modal">
      <div class="notification-settings">
        <n-form :model="settings" label-placement="left">
          <n-form-item label="桌面通知">
            <n-switch v-model:value="settings.desktopEnabled" />
          </n-form-item>

          <n-form-item label="声音提醒">
            <n-switch v-model:value="settings.soundEnabled" />
          </n-form-item>

          <n-form-item label="显示预览">
            <n-switch v-model:value="settings.showPreview" />
          </n-form-item>

          <n-form-item label="紧急通知">
            <n-switch v-model:value="settings.urgentEnabled" />
          </n-form-item>

          <n-form-item label="提及通知">
            <n-switch v-model:value="settings.mentionsEnabled" />
          </n-form-item>

          <n-form-item label="邀请通知">
            <n-switch v-model:value="settings.invitesEnabled" />
          </n-form-item>

          <n-form-item label="免打扰时段">
            <n-time-picker v-model:value="settings.doNotDisturbStart" format="HH:mm" placeholder="开始时间" />
            <span class="time-picker-separator">至</span>
            <n-time-picker v-model:value="settings.doNotDisturbEnd" format="HH:mm" placeholder="结束时间" />
          </n-form-item>
        </n-form>
      </div>
      <template #action>
        <n-button @click="showSettings = false">取消</n-button>
        <n-button type="primary" @click="saveSettings">保存设置</n-button>
      </template>
    </n-modal>

    <!-- Floating Settings Button -->
    <n-button circle type="primary" class="settings-fab" @click="showSettings = true">
      <n-icon :component="Settings" />
    </n-button>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import {
  NTabs,
  NTabPane,
  NBadge,
  NInput,
  NIcon,
  NAvatar,
  NButton,
  NDropdown,
  NEmpty,
  NModal,
  NForm,
  NFormItem,
  NSwitch,
  NTimePicker,
  useMessage
} from 'naive-ui'
import {
  CircleCheck,
  Trash,
  Search,
  UserPlus,
  At,
  MessageCircle,
  BellOff,
  DotsVertical,
  Check,
  Settings,
  Bell,
  Volume,
  AlertTriangle
} from '@vicons/tabler'
import type { NotificationContent, NotificationAction } from '@/matrix/services/notification/push'
import { sanitizeHtml } from '@/utils/htmlSanitizer'
import { logger } from '@/utils/logger'

const emit = defineEmits<{
  notificationClick: [notification: NotificationContent]
  roomOpen: [roomId: string]
}>()

const message = useMessage()

// Storage keys
const NOTIFICATIONS_STORAGE_KEY = 'matrix_notifications'
const MAX_NOTIFICATIONS = 1000

// State
const activeFilter = ref<'all' | 'unread' | 'mentions' | 'invites'>('all')
const searchQuery = ref('')
const notifications = ref<NotificationContent[]>([])
const loading = ref(false)
const hasMore = ref(false)
const showSettings = ref(false)
const currentPage = ref(0)
const pageSize = 50

// Settings
const settings = reactive({
  desktopEnabled: true,
  soundEnabled: true,
  showPreview: true,
  urgentEnabled: true,
  mentionsEnabled: true,
  invitesEnabled: true,
  doNotDisturbStart: null,
  doNotDisturbEnd: null
})

// Computed
const notificationCount = computed(() => notifications.value.length)

const unreadCount = computed(() => notifications.value.filter((n) => !n.read).length)

const mentionCount = computed(() => notifications.value.filter((n) => n.type === 'mention' && !n.read).length)

const inviteCount = computed(() => notifications.value.filter((n) => n.type === 'invite' && !n.read).length)

const filteredNotifications = computed(() => {
  let filtered = notifications.value

  // Apply filter
  switch (activeFilter.value) {
    case 'unread':
      filtered = filtered.filter((n) => !n.read)
      break
    case 'mentions':
      filtered = filtered.filter((n) => n.type === 'mention')
      break
    case 'invites':
      filtered = filtered.filter((n) => n.type === 'invite')
      break
  }

  // Apply search
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(
      (n) =>
        n.title.toLowerCase().includes(query) ||
        n.body.toLowerCase().includes(query) ||
        n.roomName?.toLowerCase().includes(query)
    )
  }

  return filtered
})

const groupedNotifications = computed(() => {
  const groups = new Map<string, NotificationContent[]>()

  filteredNotifications.value.forEach((notification) => {
    const date = formatDate(notification.timestamp || Date.now())
    if (!groups.has(date)) {
      groups.set(date, [])
    }
    groups.get(date)!.push(notification)
  })

  return Array.from(groups.entries()).map(([date, notifications]) => ({
    date,
    notifications: notifications.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
  }))
})

// Methods
const loadNotifications = async () => {
  loading.value = true
  currentPage.value = 0
  try {
    // Load notifications from localStorage
    const saved = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as NotificationContent[]
        // Sort by timestamp descending and take first page
        notifications.value = parsed.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, pageSize)
        hasMore.value = parsed.length > pageSize
      } catch (parseError) {
        logger.error('[NotificationHistory] Failed to parse notifications:', parseError)
        notifications.value = []
        hasMore.value = false
      }
    } else {
      notifications.value = []
      hasMore.value = false
    }
  } catch (error) {
    logger.error('[NotificationHistory] Failed to load notifications:', error)
    notifications.value = []
    hasMore.value = false
  } finally {
    loading.value = false
  }
}

const loadMore = async () => {
  loading.value = true
  try {
    currentPage.value++
    const saved = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as NotificationContent[]
        const start = currentPage.value * pageSize
        const end = start + pageSize
        const moreNotifications = parsed.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(start, end)

        if (moreNotifications.length > 0) {
          notifications.value.push(...moreNotifications)
          hasMore.value = end < parsed.length
        } else {
          hasMore.value = false
        }
      } catch (parseError) {
        logger.error('[NotificationHistory] Failed to parse notifications for loadMore:', parseError)
        hasMore.value = false
      }
    } else {
      hasMore.value = false
    }
  } catch (error) {
    logger.error('[NotificationHistory] Failed to load more notifications:', error)
  } finally {
    loading.value = false
  }
}

const handleNotificationClick = (notification: NotificationContent) => {
  emit('notificationClick', notification)
  emit('roomOpen', notification.roomId)
  markAsRead(notification)
}

// Helper function to save notifications to localStorage
const saveNotificationsToStorage = (notifs: NotificationContent[]) => {
  try {
    // Keep only the most recent MAX_NOTIFICATIONS
    const toSave = notifs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, MAX_NOTIFICATIONS)
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(toSave))
  } catch (error) {
    logger.error('[NotificationHistory] Failed to save notifications:', error)
  }
}

const markAsRead = (notification: NotificationContent) => {
  notification.read = true

  // Update in localStorage
  const saved = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY)
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as NotificationContent[]
      const index = parsed.findIndex((n) => n.id === notification.id)
      if (index > -1) {
        parsed[index].read = true
        saveNotificationsToStorage(parsed)
      }
    } catch (error) {
      logger.error('[NotificationHistory] Failed to mark as read:', error)
    }
  }
}

const markAllAsRead = () => {
  notifications.value.forEach((n) => (n.read = true))

  // Update in localStorage
  const saved = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY)
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as NotificationContent[]
      parsed.forEach((n) => (n.read = true))
      saveNotificationsToStorage(parsed)
    } catch (error) {
      logger.error('[NotificationHistory] Failed to mark all as read:', error)
    }
  }

  message.success('已标记全部为已读')
}

const clearAllNotifications = () => {
  notifications.value = []
  localStorage.removeItem(NOTIFICATIONS_STORAGE_KEY)
  message.success('已清空通知历史')
}

const handleNotificationAction = (action: NotificationAction, notification: NotificationContent) => {
  switch (action.action) {
    case 'reply':
      emit('roomOpen', notification.roomId)
      break
    case 'view':
      emit('roomOpen', notification.roomId)
      break
  }
}

const getNotificationMenuOptions = (notification: NotificationContent) => {
  const options = [
    {
      label: notification.read ? '标记为未读' : '标记为已读',
      key: 'toggleRead'
    },
    {
      label: '删除',
      key: 'delete'
    }
  ]

  if (notification.roomId) {
    options.push({
      label: '打开房间',
      key: 'openRoom'
    })
  }

  return options
}

const handleNotificationMenuAction = (action: string, notification: NotificationContent) => {
  switch (action) {
    case 'toggleRead': {
      notification.read = !notification.read
      // Sync with storage
      const saved = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY)
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as NotificationContent[]
          const index = parsed.findIndex((n) => n.id === notification.id)
          if (index > -1) {
            parsed[index].read = notification.read
            saveNotificationsToStorage(parsed)
          }
        } catch (error) {
          logger.error('[NotificationHistory] Failed to toggle read status:', error)
        }
      }
      break
    }
    case 'delete': {
      const index = notifications.value.findIndex((n) => n.id === notification.id)
      if (index > -1) {
        notifications.value.splice(index, 1)
      }
      // Also remove from storage
      const storageSaved = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY)
      if (storageSaved) {
        try {
          const parsed = JSON.parse(storageSaved) as NotificationContent[]
          const storageIndex = parsed.findIndex((n) => n.id === notification.id)
          if (storageIndex > -1) {
            parsed.splice(storageIndex, 1)
            saveNotificationsToStorage(parsed)
          }
        } catch (error) {
          logger.error('[NotificationHistory] Failed to delete notification:', error)
        }
      }
      break
    }
    case 'openRoom':
      emit('roomOpen', notification.roomId)
      break
  }
}

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'message':
      return MessageCircle
    case 'mention':
      return At
    case 'invite':
      return UserPlus
    case 'urgent':
      return AlertTriangle
    case 'voice':
      return Volume
    default:
      return Bell
  }
}

const getEmptyDescription = () => {
  switch (activeFilter.value) {
    case 'unread':
      return '没有未读通知'
    case 'mentions':
      return '没有提及通知'
    case 'invites':
      return '没有邀请通知'
    default:
      return '没有通知'
  }
}

const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)

  if (date >= today) {
    return '今天'
  } else if (date >= yesterday) {
    return '昨天'
  } else if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
  } else {
    return date.toLocaleDateString('zh-CN')
  }
}

// Sanitize notification body to prevent XSS attacks
const sanitizedBody = (notification: NotificationContent): string => {
  return sanitizeHtml(notification.body || '')
}

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 60 * 1000) {
    return '刚刚'
  } else if (diff < 60 * 60 * 1000) {
    return `${Math.floor(diff / (60 * 1000))}分钟前`
  } else if (diff < 24 * 60 * 60 * 1000) {
    return `${Math.floor(diff / (60 * 60 * 1000))}小时前`
  } else {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }
}

const saveSettings = () => {
  localStorage.setItem('matrix_notification_settings', JSON.stringify(settings))
  message.success('设置已保存')
  showSettings.value = false
}

const loadSettings = () => {
  try {
    const saved = localStorage.getItem('matrix_notification_settings')
    if (saved) {
      Object.assign(settings, JSON.parse(saved))
    }
  } catch (error) {}
}

// 通知事件类型定义
interface MatrixNotificationEvent extends CustomEvent {
  detail: NotificationContent
}

// Event handlers
const handleMatrixNotificationClick = (event: Event) => {
  const notification = (event as MatrixNotificationEvent).detail

  // Add to current list
  notifications.value.unshift(notification)

  // Also save to storage
  const saved = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY)
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as NotificationContent[]
      // Check if this notification already exists
      const exists = parsed.some((n) => n.id === notification.id)
      if (!exists) {
        parsed.unshift(notification)
        saveNotificationsToStorage(parsed)
      }
    } catch (error) {
      logger.error('[NotificationHistory] Failed to save new notification:', error)
    }
  } else {
    // First notification
    saveNotificationsToStorage([notification])
  }
}

// Lifecycle
onMounted(() => {
  loadNotifications()
  loadSettings()
  window.addEventListener('matrixNotificationClick', (e: Event) => handleMatrixNotificationClick(e as CustomEvent))
})

onUnmounted(() => {
  window.removeEventListener('matrixNotificationClick', (e: Event) => handleMatrixNotificationClick(e as CustomEvent))
})
</script>

<style scoped>
.notification-history {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--n-color);
}

.notification-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--n-border-color);
}

.notification-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.notification-search {
  padding: 16px;
  border-bottom: 1px solid var(--n-border-color);
}

.notification-list {
  flex: 1;
  overflow-y: auto;
}

.notification-group {
  margin-bottom: 16px;
}

.group-header {
  position: sticky;
  top: 0;
  background: var(--n-color);
  padding: 8px 16px;
  border-bottom: 1px solid var(--n-border-color);
  z-index: 1;
}

.group-date {
  font-size: 12px;
  font-weight: 600;
  color: var(--n-text-color-3);
  text-transform: uppercase;
}

.notification-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.2s;
  border-bottom: 1px solid var(--n-border-color);
}

.notification-item:hover {
  background: var(--n-hover-color);
}

.notification-item.unread {
  background: rgba(var(--n-primary-color-rgb), 0.05);
  border-left: 3px solid var(--n-primary-color);
}

.notification-item.urgent {
  border-left-color: var(--n-error-color);
}

.notification-avatar {
  position: relative;
  flex-shrink: 0;
}

.urgent-indicator {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 8px;
  height: 8px;
  background: var(--n-error-color);
  border-radius: 50%;
}

.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-header-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2px;
}

.room-name {
  font-weight: 600;
  color: var(--n-text-color-1);
}

.notification-time {
  font-size: 12px;
  color: var(--n-text-color-3);
}

.notification-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  margin-bottom: 4px;
  color: var(--n-text-color-1);
}

.notification-body {
  font-size: 14px;
  color: var(--n-text-color-2);
  margin-bottom: 8px;
  line-height: 1.4;
}

.notification-body :deep(mark) {
  background: rgba(var(--n-warning-color-rgb), 0.2);
  color: var(--n-warning-color);
  padding: 0 2px;
  border-radius: 2px;
}

.notification-actions {
  display: flex;
  gap: 8px;
}

.notification-status {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  color: var(--n-text-color-3);
}

.load-more {
  display: flex;
  justify-content: center;
  padding: 16px;
}

.notification-settings {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 8px 0;
}

.settings-fab {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 56px;
  height: 56px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 100;
}

.notification-settings-modal {
  width: 500px;
}

.time-picker-separator {
  margin: 0 8px;
}

@media (max-width: 768px) {
  .notification-header {
    padding: 12px;
  }

  .notification-search {
    padding: 12px;
  }

  .notification-item {
    padding: 10px 12px;
  }

  .settings-fab {
    bottom: 16px;
    right: 16px;
    width: 48px;
    height: 48px;
  }
}
</style>
