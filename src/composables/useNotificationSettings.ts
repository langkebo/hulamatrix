/**
 * useNotificationSettings - Shared notification settings logic composable
 *
 * This composable extracts common notification settings logic that can be shared
 * between desktop and mobile notification settings components.
 *
 * Phase 12 Optimization: Extract shared logic from duplicate notification settings
 */

import { ref, computed, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingStore } from '@/stores/setting'
import { useChatStore } from '@/stores/chat'
import {
  setKeywordHighlight,
  setQuietHours,
  clearQuietHours,
  getNotificationPolicy
} from '@/integrations/matrix/pusher'
import { matrixClientService } from '@/integrations/matrix/client'
import { msg } from '@/utils/SafeUI'
import { logger } from '@/utils/logger'

export interface NotificationSettingsOptions {
  platform?: 'desktop' | 'mobile'
}

export interface NotificationSettingsResult {
  // State
  messageSound: Ref<boolean>
  quietEnabled: Ref<boolean>
  quietStartMs: Ref<number>
  quietEndMs: Ref<number>
  keywords: Ref<string[]>
  newKeyword: Ref<string>
  highlightOnly: Ref<boolean>
  soundOn: Ref<boolean>

  // Computed
  quietStartTime: Ref<string>
  quietEndTime: Ref<string>

  // Methods
  formatTime: (ms: number) => string
  timeToMs: (time: string) => number
  msToTime: (ms: number) => string
  setPresetNight: () => void
  setPresetWork: () => void
  addKeyword: () => Promise<void>
  removeKeyword: (keyword: string) => Promise<void>
  loadSettings: () => Promise<void>
}

/**
 * Composable for shared notification settings logic
 */
export function useNotificationSettings(_options: NotificationSettingsOptions = {}): NotificationSettingsResult {
  const { t } = useI18n()
  const settingStore = useSettingStore()
  const _chatStore = useChatStore()

  // Message sound
  const messageSound = computed({
    get: () => settingStore.notification.messageSound,
    set: (value: boolean) => {
      settingStore.setMessageSoundEnabled(value)
    }
  })

  // Quiet hours state
  const quietEnabled = ref(false)
  const quietStartMs = ref(22 * 3600 * 1000)
  const quietEndMs = ref(8 * 3600 * 1000)
  const quietStartTime = ref('22:00')
  const quietEndTime = ref('08:00')

  // Keywords state
  const keywords = ref<string[]>([])
  const newKeyword = ref('')
  const highlightOnly = ref(false)
  const soundOn = ref(true)

  // Time utilities
  const formatTime = (ms: number): string => {
    const totalMin = Math.floor(ms / 60000)
    const h = Math.floor(totalMin / 60)
    const m = totalMin % 60
    const hh = String(h).padStart(2, '0')
    const mm = String(m).padStart(2, '0')
    return `${hh}:${mm}`
  }

  const timeToMs = (time: string): number => {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time)
    if (!match) return 0
    const h = Number(match[1])
    const min = Number(match[2])
    return (h * 60 + min) * 60 * 1000
  }

  const msToTime = (ms: number): string => {
    const totalMin = Math.floor(ms / 60000)
    const h = Math.floor(totalMin / 60)
    const m = totalMin % 60
    const hh = String(h).padStart(2, '0')
    const mm = String(m).padStart(2, '0')
    return `${hh}:${mm}`
  }

  // Preset time ranges
  const setPresetNight = () => {
    quietStartTime.value = '22:00'
    quietEndTime.value = '08:00'
    quietStartMs.value = timeToMs('22:00')
    quietEndMs.value = timeToMs('08:00')
    applyQuietHours()
  }

  const setPresetWork = () => {
    quietStartTime.value = '09:00'
    quietEndTime.value = '18:00'
    quietStartMs.value = timeToMs('09:00')
    quietEndMs.value = timeToMs('18:00')
    applyQuietHours()
  }

  // Apply quiet hours
  const applyQuietHours = async () => {
    try {
      if (quietEnabled.value) {
        await setQuietHours(quietStartTime.value, quietEndTime.value)
        msg.success(t('setting.notice.quiet_hours_set'))
      } else {
        await clearQuietHours()
        msg.success(t('setting.notice.quiet_hours_disabled'))
      }
    } catch (error) {
      logger.error('[useNotificationSettings] Failed to set quiet hours:', error)
      msg.error(t('setting.notice.quiet_hours_failed'))
    }
  }

  // Keyword management
  const addKeyword = async () => {
    const k = (newKeyword.value || '').trim()
    if (!k) return

    const list = Array.from(new Set([...keywords.value, k]))
    try {
      await setKeywordHighlight(list, { highlight: true, sound: soundOn.value && !highlightOnly.value })
      keywords.value = list
      newKeyword.value = ''
      msg.success(t('setting.notice.keyword_added'))
      scheduleSaveSettings()
    } catch (error) {
      logger.error('[useNotificationSettings] Failed to add keyword:', error)
      msg.error(t('setting.notice.keyword_add_failed'))
    }
  }

  const removeKeyword = async (k: string) => {
    const list = keywords.value.filter((x) => x !== k)
    try {
      await setKeywordHighlight(list, { highlight: true, sound: soundOn.value && !highlightOnly.value })
      keywords.value = list
      msg.success(t('setting.notice.keyword_removed'))
      scheduleSaveSettings()
    } catch (error) {
      logger.error('[useNotificationSettings] Failed to remove keyword:', error)
      msg.error(t('setting.notice.keyword_remove_failed'))
    }
  }

  // Save settings with debounce
  let saveTimer: NodeJS.Timeout | null = null
  const scheduleSaveSettings = () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      try {
        settingStore.setNotificationKeywords(keywords.value)
        settingStore.setQuietHours(quietEnabled.value, quietStartTime.value, quietEndTime.value)
        settingStore.saveToCache()

        // Sync to Matrix account settings
        settingStore.setLevelSetting('account', 'notification.keywords', keywords.value)
        settingStore.setLevelSetting('account', 'notification.quietHours', {
          enabled: quietEnabled.value,
          start: quietStartTime.value,
          end: quietEndTime.value
        })

        matrixClientService.setAccountSetting('notification.keywords', keywords.value, 'account')
        matrixClientService.setAccountSetting(
          'notification.quietHours',
          {
            enabled: quietEnabled.value,
            start: quietStartTime.value,
            end: quietEndTime.value
          },
          'account'
        )

        // Verify sync
        Promise.all([
          matrixClientService.getAccountSetting('notification.keywords'),
          matrixClientService.getAccountSetting('notification.quietHours')
        ]).then(([kw, qh]) => {
          const okKw = Array.isArray(kw) && kw.join(',') === keywords.value.join(',')
          const okQh =
            qh &&
            typeof qh === 'object' &&
            'enabled' in qh &&
            'start' in qh &&
            'end' in qh &&
            String(qh.enabled) === String(quietEnabled.value) &&
            String(qh.start) === quietStartTime.value &&
            String(qh.end) === quietEndTime.value

          if (!okKw || !okQh) {
            matrixClientService.rollbackAccountSettings()
            logger.warn('[useNotificationSettings] Settings sync failed, rolled back')
          }
        })
      } catch (error) {
        logger.error('[useNotificationSettings] Failed to save settings:', error)
      }
    }, 500)
  }

  // Load settings from store and server
  const loadSettings = async () => {
    try {
      // Load from store
      if (Array.isArray(settingStore.notification?.keywords)) {
        keywords.value = settingStore.notification.keywords
      }

      if (settingStore.notification?.quietHours) {
        quietEnabled.value = !!settingStore.notification.quietHours.enabled
        const start = settingStore.notification.quietHours.start || '22:00'
        const end = settingStore.notification.quietHours.end || '08:00'
        quietStartTime.value = start
        quietEndTime.value = end
        quietStartMs.value = timeToMs(start)
        quietEndMs.value = timeToMs(end)
      }

      // Load from Matrix level settings
      try {
        const k = settingStore.getLevelSetting('notification.keywords')
        if (Array.isArray(k) && k.length > 0) {
          keywords.value = k
        }

        const qh = settingStore.getLevelSetting('notification.quietHours')
        if (qh && typeof qh === 'object') {
          const quietHours = qh as { enabled?: boolean; start?: string; end?: string }
          quietEnabled.value = !!quietHours.enabled
          quietStartTime.value = quietHours.start || quietStartTime.value
          quietEndTime.value = quietHours.end || quietEndTime.value
          quietStartMs.value = timeToMs(quietStartTime.value)
          quietEndMs.value = timeToMs(quietEndTime.value)
        }
      } catch (error) {
        logger.error('[useNotificationSettings] Failed to load level settings:', error)
      }

      // Load from server policy
      const policy = await getNotificationPolicy()
      if ((!keywords.value || keywords.value.length === 0) && Array.isArray(policy.keywords)) {
        keywords.value = policy.keywords
      }

      if (policy.quietHours?.enabled) {
        quietEnabled.value = true
      }
    } catch (error) {
      logger.error('[useNotificationSettings] Failed to load settings:', error)
    }
  }

  // Sync time values
  watch(quietStartMs, (n) => {
    quietStartTime.value = msToTime(n)
  })

  watch(quietEndMs, (n) => {
    quietEndTime.value = msToTime(n)
  })

  // Auto-apply quiet hours when changed
  watch([quietEnabled, quietStartTime, quietEndTime], () => {
    applyQuietHours()
  })

  // Sync message sound to Matrix
  watch(messageSound, async (v) => {
    try {
      await matrixClientService.setAccountSetting('notification.messageSound', v, 'account')
      const readback = await matrixClientService.getAccountSetting('notification.messageSound')
      if (String(readback) !== String(v)) {
        await matrixClientService.rollbackAccountSettings()
        msg.warning(t('setting.notice.message_sound_sync_failed'))
      }
    } catch (error) {
      logger.error('[useNotificationSettings] Failed to sync message sound:', error)
    }
  })

  return {
    // State
    messageSound,
    quietEnabled,
    quietStartMs,
    quietEndMs,
    keywords,
    newKeyword,
    highlightOnly,
    soundOn,

    // Computed
    quietStartTime,
    quietEndTime,

    // Methods
    formatTime,
    timeToMs,
    msToTime,
    setPresetNight,
    setPresetWork,
    addKeyword,
    removeKeyword,
    loadSettings
  }
}

/**
 * Format milliseconds to HH:mm string
 */
export function formatTime(ms: number): string {
  const totalMin = Math.floor(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  const hh = String(h).padStart(2, '0')
  const mm = String(m).padStart(2, '0')
  return `${hh}:${mm}`
}

/**
 * Convert HH:mm string to milliseconds
 */
export function timeToMs(time: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time)
  if (!match) return 0
  const h = Number(match[1])
  const min = Number(match[2])
  return (h * 60 + min) * 60 * 1000
}
