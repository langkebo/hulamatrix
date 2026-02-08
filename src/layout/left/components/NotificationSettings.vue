<template>
  <n-spin :show="loading">
    <n-flex :size="20" vertical>
      <n-flex align="center" justify="space-between">
        <span class="text-14px text-[--text-color]">{{ t('user_menu.notifications.enable') }}</span>
        <n-switch v-model:value="settings.enabled" />
      </n-flex>
      <template v-if="settings.enabled">
        <n-divider style="margin: 0" />
        <n-flex align="center" justify="space-between">
          <span class="text-14px text-[--text-color]">{{ t('user_menu.notifications.sound') }}</span>
          <n-switch v-model:value="settings.sound" />
        </n-flex>
        <n-divider style="margin: 0" />
        <n-flex align="center" justify="space-between">
          <span class="text-14px text-[--text-color]">{{ t('user_menu.notifications.desktop') }}</span>
          <n-switch v-model:value="settings.desktop" />
        </n-flex>
        <template v-if="settings.desktop">
          <n-flex :size="10" vertical class="ml-20px">
            <span class="text-12px text-[--info-text-color]">{{ t('user_menu.notifications.preview') }}</span>
            <n-select
              v-model:value="settings.desktopPreview"
              :options="[
                { label: t('user_menu.notifications.preview_all'), value: 'all' },
                { label: t('user_menu.notifications.preview_sender'), value: 'sender' },
                { label: t('user_menu.notifications.preview_none'), value: 'none' }
              ]"
              size="small"
              style="width: 200px" />
          </n-flex>
        </template>
        <n-divider style="margin: 0" />
        <n-flex align="center" justify="space-between">
          <span class="text-14px text-[--text-color]">{{ t('user_menu.notifications.mention_only') }}</span>
          <n-switch v-model:value="settings.mentionOnly" />
        </n-flex>
        <n-divider style="margin: 0" />
        <n-flex align="center" justify="space-between">
          <span class="text-14px text-[--text-color]">{{ t('user_menu.notifications.dnd') }}</span>
          <n-switch v-model:value="settings.dndEnabled" />
        </n-flex>
        <template v-if="settings.dndEnabled">
          <n-flex :size="10" vertical class="ml-20px">
            <span class="text-12px text-[--info-text-color]">{{ t('user_menu.notifications.dnd_hours') }}</span>
            <n-flex :size="10" align="center">
              <n-time-picker
                v-model:value="settings.dndStart"
                format="HH:mm"
                size="small"
                style="width: 100px" />
              <span class="text-12px">-</span>
              <n-time-picker
                v-model:value="settings.dndEnd"
                format="HH:mm"
                size="small"
                style="width: 100px" />
            </n-flex>
          </n-flex>
        </template>
        <n-divider style="margin: 0" />
        <div>
          <span class="text-14px text-[--text-color]">{{ t('user_menu.notifications.room_settings') }}</span>
          <n-flex :size="10" vertical class="mt-10px">
            <div
              v-for="room in roomSettings"
              :key="room.id"
              class="room-notification-item">
              <n-flex align="center" justify="space-between" class="w-full">
                <n-flex align="center" :size="8">
                  <n-avatar :size="32" :src="room.avatar" round />
                  <span class="text-13px text-[--text-color] truncate max-w-150px">{{ room.name }}</span>
                </n-flex>
                <n-select
                  :value="room.notificationLevel"
                  :options="notificationLevelOptions"
                  size="small"
                  style="width: 120px"
                  @update:value="(value: string) => handleNotificationLevelChange(room.id, value)" />
              </n-flex>
            </div>
            <n-empty v-if="roomSettings.length === 0" :description="t('user_menu.notifications.no_rooms')" size="small" />
          </n-flex>
        </div>
        <n-divider style="margin: 0" />
        <div>
          <n-flex align="center" justify="space-between" class="mb-10px">
            <span class="text-14px text-[--text-color]">{{ t('user_menu.notifications.notification_history') }}</span>
            <n-button text size="small" @click="showNotificationHistory = true">
              {{ t('user_menu.notifications.view_history') }}
            </n-button>
          </n-flex>
        </div>
      </template>
    </n-flex>
  </n-spin>
  <n-drawer v-model:show="showNotificationHistory" :width="500" placement="right">
    <n-drawer-content :title="t('user_menu.notifications.notification_history')">
      <template #footer>
        <n-flex justify="space-between">
          <n-button @click="clearHistory">{{ t('user_menu.notifications.clear_history') }}</n-button>
          <n-button type="primary" @click="showNotificationHistory = false">{{ t('common.close') }}</n-button>
        </n-flex>
      </template>
      <n-spin :show="loadingHistory">
        <n-empty v-if="notificationHistory.length === 0" :description="t('user_menu.notifications.no_history')" />
        <n-list v-else bordered>
          <n-list-item v-for="item in notificationHistory" :key="item.id">
            <n-thing>
              <template #header>
                <n-flex align="center" justify="space-between">
                  <span class="font-medium">{{ item.title }}</span>
                  <n-button text size="small" @click="deleteNotification(item.id)">
                    <svg class="size-14px"><use href="#delete"></use></svg>
                  </n-button>
                </n-flex>
              </template>
              <template #description>
                <span class="text-12px text-gray-500">{{ formatTimestamp(item.timestamp) }}</span>
              </template>
              {{ item.body }}
            </n-thing>
          </n-list-item>
        </n-list>
      </n-spin>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import MatrixNotificationService from '@/services/matrix/MatrixNotificationService'

const { t } = useI18n()

const notificationService = MatrixNotificationService.getInstance()

const loading = ref(false)
const loadingHistory = ref(false)
const showNotificationHistory = ref(false)
const settings = ref<NotificationSettings>({
  enabled: true,
  sound: true,
  desktop: true,
  desktopPreview: 'sender',
  mentionOnly: false,
  dndEnabled: false,
  dndStart: new Date().setHours(22, 0, 0, 0),
  dndEnd: new Date().setHours(8, 0, 0, 0)
})

const notificationHistory = ref<
  Array<{
    id: string
    title: string
    body: string
    timestamp: number
    roomId?: string
    senderId?: string
  }>
>([])

interface NotificationSettings {
  enabled: boolean
  sound: boolean
  desktop: boolean
  desktopPreview: 'all' | 'none' | 'sender'
  mentionOnly: boolean
  dndEnabled: boolean
  dndStart: number
  dndEnd: number
}

interface RoomNotificationSetting {
  id: string
  name: string
  avatar: string
  notificationLevel: string
}

const roomSettings = ref<RoomNotificationSetting[]>([])

const notificationLevelOptions = [
  { label: t('user_menu.notifications.level_all'), value: 'all' },
  { label: t('user_menu.notifications.level_mention'), value: 'mention' },
  { label: t('user_menu.notifications.level_mute'), value: 'mute' }
]

const loadNotificationSettings = async () => {
  try {
    loading.value = true
    const loadedSettings = await notificationService.getNotificationSettings()
    settings.value = loadedSettings

    const permission = notificationService.checkNotificationPermission()
    settings.value.desktop = permission.granted
  } catch (error) {
    console.error('Failed to load notification settings:', error)
  } finally {
    loading.value = false
  }
}

const loadRoomSettings = async () => {
  try {
    const loadedRoomSettings = await notificationService.getRoomNotificationSettings()
    roomSettings.value = loadedRoomSettings.slice(0, 5).map((room) => ({
      id: room.roomId,
      name: room.name,
      avatar: room.avatar || '',
      notificationLevel: room.notificationLevel
    }))
  } catch (error) {
    console.error('Failed to load room settings:', error)
  }
}

const handleNotificationLevelChange = async (roomId: string, level: string) => {
  try {
    await notificationService.setRoomNotificationLevel(roomId, level as 'all' | 'mention' | 'mute')
  } catch (error) {
    console.error('Failed to update room notification level:', error)
    window.$message.error(t('user_menu.notifications.update_failed'))
  }
}

const loadNotificationHistory = async () => {
  try {
    loadingHistory.value = true
    notificationHistory.value = notificationService.getNotificationHistory(50)
  } catch (error) {
    console.error('Failed to load notification history:', error)
  } finally {
    loadingHistory.value = false
  }
}

const clearHistory = () => {
  window.$dialog.warning({
    title: t('user_menu.notifications.clear_history'),
    content: t('user_menu.notifications.clear_history_confirm'),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: () => {
      notificationService.clearNotificationHistory()
      notificationHistory.value = []
      window.$message.success(t('user_menu.notifications.history_cleared'))
    }
  })
}

const deleteNotification = (notificationId: string) => {
  notificationService.deleteNotificationFromHistory(notificationId)
  notificationHistory.value = notificationHistory.value.filter((n) => n.id !== notificationId)
}

const formatTimestamp = (timestamp: number) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 60000) {
    return t('user_menu.notifications.just_now')
  } else if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000)
    return t('user_menu.notifications.minutes_ago', { minutes })
  } else if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000)
    return t('user_menu.notifications.hours_ago', { hours })
  } else if (diff < 604800000) {
    const days = Math.floor(diff / 86400000)
    return t('user_menu.notifications.days_ago', { days })
  } else {
    return date.toLocaleDateString()
  }
}

watch(showNotificationHistory, (val) => {
  if (val) {
    loadNotificationHistory()
  }
})

watch(
  settings,
  async (newSettings) => {
    try {
      await notificationService.saveNotificationSettings(newSettings)
    } catch (error) {
      console.error('Failed to save notification settings:', error)
    }
  },
  { deep: true }
)

onMounted(() => {
  loadNotificationSettings()
  loadRoomSettings()
})
</script>

<style lang="scss" scoped>
@use '@/styles/scss/global/variable.scss' as *;

.room-notification-item {
  padding: 10px;
  border-radius: 8px;
  background: var(--bg-menu-hover);
}
</style>
