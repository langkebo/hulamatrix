<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar
        :isOfficial="false"
        class="bg-white"
        style="border-bottom: 1px solid; border-color: #dfdfdf"
        :hidden-right="true"
        :room-name="t('user_menu.notifications.title')" />
    </template>

    <template #container>
      <img src="@/assets/mobile/chat-home/background.webp" class="w-100% absolute top-0 -z-1" alt="hula" />
      <div class="flex flex-col z-1">
        <div class="flex flex-col p-20px gap-20px">
          <n-spin :show="loading">
            <div class="flex flex-col gap-20px">
              <div class="bg-white p-12px rounded-lg shadow-sm">
                <div class="text-base font-medium mb-12px">{{ t('user_menu.notifications.general') }}</div>
                <div class="flex flex-col gap-12px">
                  <div class="flex justify-between items-center">
                    <span class="text-sm">{{ t('user_menu.notifications.enable') }}</span>
                    <n-switch v-model:value="settings.enabled" @update:value="handleSettingChange" />
                  </div>
                  <div class="flex justify-between items-center">
                    <span class="text-sm">{{ t('user_menu.notifications.sound') }}</span>
                    <n-switch v-model:value="settings.sound" @update:value="handleSettingChange" />
                  </div>
                  <div class="flex justify-between items-center">
                    <span class="text-sm">{{ t('user_menu.notifications.desktop') }}</span>
                    <n-switch v-model:value="settings.desktop" @update:value="handleDesktopChange" />
                  </div>
                  <div class="flex justify-between items-center">
                    <span class="text-sm">{{ t('user_menu.notifications.mention_only') }}</span>
                    <n-switch v-model:value="settings.mentionOnly" @update:value="handleSettingChange" />
                  </div>
                </div>
              </div>

              <div class="bg-white p-12px rounded-lg shadow-sm">
                <div class="text-base font-medium mb-12px">{{ t('user_menu.notifications.do_not_disturb') }}</div>
                <div class="flex flex-col gap-12px">
                  <div class="flex justify-between items-center">
                    <span class="text-sm">{{ t('user_menu.notifications.dnd_enabled') }}</span>
                    <n-switch v-model:value="settings.dndEnabled" @update:value="handleSettingChange" />
                  </div>
                  <div v-if="settings.dndEnabled" class="flex flex-col gap-8px">
                    <div class="flex justify-between items-center">
                      <span class="text-sm">{{ t('user_menu.notifications.dnd_start') }}</span>
                      <n-time-picker
                        v-model:value="dndStartTime"
                        format="HH:mm"
                        :is-hour-disabled="disableStartHour"
                        @update:value="handleDndChange" />
                    </div>
                    <div class="flex justify-between items-center">
                      <span class="text-sm">{{ t('user_menu.notifications.dnd_end') }}</span>
                      <n-time-picker
                        v-model:value="dndEndTime"
                        format="HH:mm"
                        :is-hour-disabled="disableEndHour"
                        @update:value="handleDndChange" />
                    </div>
                  </div>
                </div>
              </div>

              <div class="bg-white p-12px rounded-lg shadow-sm">
                <div class="flex justify-between items-center mb-12px">
                  <div class="text-base font-medium">{{ t('user_menu.notifications.room_notifications') }}</div>
                  <n-button text size="small" @click="showRoomSettings = true">
                    {{ t('user_menu.notifications.manage_rooms') }}
                  </n-button>
                </div>
                <div class="text-sm text-gray-500">
                  {{ t('user_menu.notifications.room_notifications_desc') }}
                </div>
              </div>
            </div>
          </n-spin>
        </div>
      </div>
    </template>

    <n-drawer v-model:show="showRoomSettings" :width="300" placement="right">
      <n-drawer-content :title="t('user_menu.notifications.room_notifications')">
        <n-spin :show="loadingRooms">
          <div class="flex flex-col gap-12px">
            <div
              v-for="room in roomNotifications"
              :key="room.roomId"
              class="flex flex-col gap-8px p-12px bg-gray-50 rounded-lg">
              <div class="flex items-center gap-8px">
                <n-avatar :size="32" :src="room.avatar" round />
                <span class="text-sm font-medium flex-1">{{ room.name }}</span>
              </div>
              <n-select
                v-model:value="room.notificationLevel"
                :options="notificationLevelOptions"
                size="small"
                @update:value="handleRoomNotificationChange(room)" />
            </div>
            <div v-if="roomNotifications.length === 0" class="text-sm text-gray-500 text-center py-20px">
              {{ t('user_menu.notifications.no_rooms') }}
            </div>
          </div>
        </n-spin>
      </n-drawer-content>
    </n-drawer>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import MatrixNotificationService from '@/services/matrix/MatrixNotificationService'

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

const { t } = useI18n()

const notificationService = MatrixNotificationService.getInstance()

const loading = ref(false)
const loadingRooms = ref(false)
const showRoomSettings = ref(false)

const settings = ref<NotificationSettings>({
  enabled: true,
  sound: true,
  desktop: false,
  desktopPreview: 'sender',
  mentionOnly: false,
  dndEnabled: false,
  dndStart: new Date().setHours(22, 0, 0, 0),
  dndEnd: new Date().setHours(8, 0, 0, 0)
})

const dndStartTime = ref<number>(new Date().setHours(22, 0, 0, 0))
const dndEndTime = ref<number>(new Date().setHours(8, 0, 0, 0))

const roomNotifications = ref<any[]>([])

const notificationLevelOptions = [
  { label: t('user_menu.notifications.all_messages'), value: 'all' },
  { label: t('user_menu.notifications.mentions_only'), value: 'mention' },
  { label: t('user_menu.notifications.muted'), value: 'mute' }
]

const loadNotificationSettings = async () => {
  try {
    loading.value = true
    const loadedSettings = await notificationService.getNotificationSettings()
    settings.value = loadedSettings

    const permission = notificationService.checkNotificationPermission()
    settings.value.desktop = permission.granted

    dndStartTime.value = loadedSettings.dndStart
    dndEndTime.value = loadedSettings.dndEnd
  } catch (error) {
    console.error('Failed to load notification settings:', error)
  } finally {
    loading.value = false
  }
}

const loadRoomNotifications = async () => {
  try {
    loadingRooms.value = true
    roomNotifications.value = await notificationService.getRoomNotificationSettings()
  } catch (error) {
    console.error('Failed to load room notifications:', error)
  } finally {
    loadingRooms.value = false
  }
}

const handleSettingChange = async () => {
  try {
    await notificationService.setNotificationSettings(settings.value)
    window.$message.success(t('user_menu.notifications.settings_saved'))
  } catch (error) {
    console.error('Failed to save notification settings:', error)
    window.$message.error(t('user_menu.notifications.settings_save_failed'))
  }
}

const handleDesktopChange = async () => {
  if (settings.value.desktop) {
    try {
      await notificationService.requestNotificationPermission()
      window.$message.success(t('user_menu.notifications.desktop_enabled'))
    } catch (error) {
      console.error('Failed to enable desktop notifications:', error)
      settings.value.desktop = false
      window.$message.error(t('user_menu.notifications.desktop_enable_failed'))
    }
  }
}

const handleDndChange = async () => {
  settings.value.dndStart = dndStartTime.value
  settings.value.dndEnd = dndEndTime.value
  await handleSettingChange()
}

const handleRoomNotificationChange = async (room: any) => {
  try {
    await notificationService.setRoomNotificationSetting(room.roomId, room.notificationLevel)
    window.$message.success(t('user_menu.notifications.room_settings_saved'))
  } catch (error) {
    console.error('Failed to save room notification settings:', error)
    window.$message.error(t('user_menu.notifications.room_settings_save_failed'))
  }
}

const disableStartHour = (hour: number) => {
  const endHour = new Date(dndEndTime.value).getHours()
  return hour >= endHour
}

const disableEndHour = (hour: number) => {
  const startHour = new Date(dndStartTime.value).getHours()
  return hour <= startHour
}

watch(showRoomSettings, (val) => {
  if (val) {
    loadRoomNotifications()
  }
})

onMounted(() => {
  loadNotificationSettings()
})
</script>

<style lang="scss" scoped>
@use '@/styles/scss/global/variable.scss' as *;
</style>
