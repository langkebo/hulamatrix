<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar
        :isOfficial="false"
        class="bg-white"
        style="border-bottom: 1px solid; border-color: #dfdfdf"
        :hidden-right="true"
        :room-name="t('user_menu.settings.title')" />
    </template>

    <template #container>
      <img src="@/assets/mobile/chat-home/background.webp" class="w-100% absolute top-0 -z-1" alt="hula" />
      <div class="flex flex-col z-1">
        <div class="flex flex-col p-20px gap-20px">
          <n-spin :show="loading">
            <div class="flex flex-col gap-20px">
              <div
                v-for="section in settingsSections"
                :key="section.key"
                class="bg-white p-12px rounded-lg shadow-sm">
                <div class="text-base font-medium mb-12px">{{ t(section.labelKey) }}</div>
                <div class="flex flex-col gap-12px">
                  <div
                    v-for="item in section.items"
                    :key="item.key"
                    class="flex justify-between items-center">
                    <div class="text-sm flex-1">{{ t(item.labelKey) }}</div>
                    <div>
                      <n-switch
                        v-if="item.type === 'switch'"
                        :value="item.value"
                        @update:value="(val: boolean) => updateSetting(section.key, item.key, val)" />
                      <n-input
                        v-else-if="item.type === 'input'"
                        :value="item.value"
                        @update:value="(val: string) => updateSetting(section.key, item.key, val)"
                        placeholder="请输入"
                        class="w-40" />
                      <n-select
                        v-else-if="item.type === 'select'"
                        :value="item.value"
                        @update:value="(val: string) => updateSetting(section.key, item.key, val)"
                        :options="item.options"
                        placeholder="请选择"
                        class="w-40" />
                      <n-slider
                        v-else-if="item.type === 'slider'"
                        :value="item.value"
                        @update:value="(val: number) => updateSetting(section.key, item.key, val)"
                        :min="item.min"
                        :max="item.max"
                        :format-tooltip="item.formatTooltip"
                        class="w-40" />
                    </div>
                  </div>
                </div>
              </div>

              <div class="bg-white p-12px rounded-lg shadow-sm">
                <div class="text-base font-medium mb-12px">{{ t('user_menu.settings.shortcuts') }}</div>
                <div class="flex flex-col gap-8px">
                  <div
                    v-for="shortcut in shortcuts"
                    :key="shortcut.key"
                    class="flex justify-between items-center p-8px bg-gray-50 rounded-lg">
                    <span class="text-sm">{{ t(shortcut.labelKey) }}</span>
                    <n-flex :size="4">
                      <n-tag v-for="key in shortcut.keys" :key="key" size="small" round>
                        {{ key }}
                      </n-tag>
                    </n-flex>
                  </div>
                </div>
              </div>

              <div class="bg-white p-12px rounded-lg shadow-sm">
                <div class="flex flex-col gap-12px">
                  <n-flex align="center" justify="space-between">
                    <n-flex vertical :size="4">
                      <span class="text-sm font-medium">{{ t('user_menu.settings.labs_enabled') }}</span>
                      <span class="text-xs text-gray-500">{{ t('user_menu.settings.labs_desc') }}</span>
                    </n-flex>
                    <n-switch v-model:value="labsSettings.enabled" />
                  </n-flex>
                  <n-divider style="margin: 4px 0" />
                  <div v-for="lab in labsFeatures" :key="lab.key" class="p-8px bg-gray-50 rounded-lg">
                    <n-flex align="center" justify="space-between" class="w-full">
                      <n-flex vertical :size="4">
                        <span class="text-sm">{{ t(lab.labelKey) }}</span>
                        <span class="text-xs text-gray-500">{{ t(lab.descriptionKey) }}</span>
                      </n-flex>
                      <n-switch v-model:value="lab.enabled" />
                    </n-flex>
                  </div>
                </div>
              </div>
            </div>
          </n-spin>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import MatrixSettingsService from '@/services/matrix/MatrixSettingsService'

interface SettingsItem {
  key: string
  labelKey: string
  type: 'select' | 'slider' | 'switch' | 'input'
  value: any
  options?: { label: string; value: string }[]
  min?: number
  max?: number
  formatTooltip?: (val: number) => string
}

interface SettingsSection {
  key: string
  labelKey: string
  icon?: string
  items: SettingsItem[]
}

const { t } = useI18n()
const settingsService = MatrixSettingsService.getInstance()

const loading = ref(false)

const appearanceSettings = ref({
  theme: 'system',
  language: 'zh-CN',
  fontSize: 14,
  zoom: 100
})

const messageSettings = ref({
  historyLimit: '3m',
  autoRead: false,
  emojiPanel: true,
  gifSearch: true
})

const callSettings = ref({
  camera: 'default',
  microphone: 'default',
  noiseSuppression: true,
  autoAnswer: false,
  videoQuality: 'high'
})

const accessibilitySettings = ref({
  screenReader: false,
  highContrast: false,
  reduceMotion: false,
  keyboardNavigation: true
})

const labsSettings = ref({
  enabled: false
})

const labsFeatures = ref<any[]>([
  {
    key: 'threading',
    labelKey: 'user_menu.labs.threading',
    descriptionKey: 'user_menu.labs.threading_desc',
    enabled: false
  },
  {
    key: 'video_rooms',
    labelKey: 'user_menu.labs.video_rooms',
    descriptionKey: 'user_menu.labs.video_rooms_desc',
    enabled: false
  }
])

const themeOptions = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
  { label: 'System', value: 'system' }
]

const languageOptions = [
  { label: 'English', value: 'en' },
  { label: '简体中文', value: 'zh-CN' }
]

const historyLimitOptions = [
  { label: '1 week', value: '1w' },
  { label: '1 month', value: '1m' },
  { label: '3 months', value: '3m' },
  { label: '1 year', value: '1y' },
  { label: 'All', value: 'all' }
]

const videoQualityOptions = [
  { label: t('user_menu.settings.quality_low'), value: 'low' },
  { label: t('user_menu.settings.quality_medium'), value: 'medium' },
  { label: t('user_menu.settings.quality_high'), value: 'high' }
]

const cameraOptions = ref([{ label: 'Default Camera', value: 'default' }])
const microphoneOptions = ref([{ label: 'Default Microphone', value: 'default' }])

const loadMediaDevices = async () => {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      console.warn('Media devices API not supported')
      return
    }

    const devices = await navigator.mediaDevices.enumerateDevices()

    const cameras = devices.filter((d) => d.kind === 'videoinput')
    if (cameras.length > 0) {
      cameraOptions.value = cameras.map((d) => ({
        label: d.label || `Camera ${d.deviceId.slice(0, 8)}`,
        value: d.deviceId
      }))
    }

    const microphones = devices.filter((d) => d.kind === 'audioinput')
    if (microphones.length > 0) {
      microphoneOptions.value = microphones.map((d) => ({
        label: d.label || `Microphone ${d.deviceId.slice(0, 8)}`,
        value: d.deviceId
      }))
    }
  } catch (error) {
    console.error('Failed to enumerate media devices:', error)
  }
}

const shortcuts = [
  { key: 'new_message', labelKey: 'user_menu.shortcuts.new_message', keys: ['Ctrl', 'N'] },
  { key: 'search', labelKey: 'user_menu.shortcuts.search', keys: ['Ctrl', 'K'] },
  { key: 'quick_reply', labelKey: 'user_menu.shortcuts.quick_reply', keys: ['Ctrl', 'R'] },
  { key: 'mark_all_read', labelKey: 'user_menu.shortcuts.mark_all_read', keys: ['Ctrl', 'Shift', 'O'] },
  { key: 'toggle_emoji', labelKey: 'user_menu.shortcuts.toggle_emoji', keys: ['Ctrl', 'E'] }
]

const settingsSections: SettingsSection[] = computed(() => [
  {
    key: 'appearance',
    labelKey: 'user_menu.settings.appearance',
    items: [
      {
        key: 'theme',
        labelKey: 'user_menu.settings.theme',
        type: 'select',
        value: appearanceSettings.value.theme,
        options: themeOptions
      },
      {
        key: 'language',
        labelKey: 'user_menu.settings.language',
        type: 'select',
        value: appearanceSettings.value.language,
        options: languageOptions
      },
      {
        key: 'fontSize',
        labelKey: 'user_menu.settings.font_size',
        type: 'slider',
        value: appearanceSettings.value.fontSize,
        min: 12,
        max: 20,
        formatTooltip: (val: number) => `${val}px`
      },
      {
        key: 'zoom',
        labelKey: 'user_menu.settings.zoom',
        type: 'slider',
        value: appearanceSettings.value.zoom,
        min: 80,
        max: 120,
        formatTooltip: (val: number) => `${val}%`
      }
    ]
  },
  {
    key: 'messages',
    labelKey: 'user_menu.settings.messages',
    items: [
      {
        key: 'historyLimit',
        labelKey: 'user_menu.settings.message_history',
        type: 'select',
        value: messageSettings.value.historyLimit,
        options: historyLimitOptions
      },
      {
        key: 'autoRead',
        labelKey: 'user_menu.settings.auto_read',
        type: 'switch',
        value: messageSettings.value.autoRead
      },
      {
        key: 'emojiPanel',
        labelKey: 'user_menu.settings.emoji_panel',
        type: 'switch',
        value: messageSettings.value.emojiPanel
      },
      {
        key: 'gifSearch',
        labelKey: 'user_menu.settings.gif_search',
        type: 'switch',
        value: messageSettings.value.gifSearch
      }
    ]
  },
  {
    key: 'calls',
    labelKey: 'user_menu.settings.calls',
    items: [
      {
        key: 'camera',
        labelKey: 'user_menu.settings.default_camera',
        type: 'select',
        value: callSettings.value.camera,
        options: cameraOptions
      },
      {
        key: 'microphone',
        labelKey: 'user_menu.settings.default_microphone',
        type: 'select',
        value: callSettings.value.microphone,
        options: microphoneOptions
      },
      {
        key: 'noiseSuppression',
        labelKey: 'user_menu.settings.noise_suppression',
        type: 'switch',
        value: callSettings.value.noiseSuppression
      },
      {
        key: 'autoAnswer',
        labelKey: 'user_menu.settings.auto_answer',
        type: 'switch',
        value: callSettings.value.autoAnswer
      },
      {
        key: 'videoQuality',
        labelKey: 'user_menu.settings.video_quality',
        type: 'select',
        value: callSettings.value.videoQuality,
        options: videoQualityOptions
      }
    ]
  },
  {
    key: 'accessibility',
    labelKey: 'user_menu.settings.accessibility',
    items: [
      {
        key: 'screenReader',
        labelKey: 'user_menu.settings.screen_reader',
        type: 'switch',
        value: accessibilitySettings.value.screenReader
      },
      {
        key: 'highContrast',
        labelKey: 'user_menu.settings.high_contrast',
        type: 'switch',
        value: accessibilitySettings.value.highContrast
      },
      {
        key: 'reduceMotion',
        labelKey: 'user_menu.settings.reduce_motion',
        type: 'switch',
        value: accessibilitySettings.value.reduceMotion
      },
      {
        key: 'keyboardNavigation',
        labelKey: 'user_menu.settings.keyboard_navigation',
        type: 'switch',
        value: accessibilitySettings.value.keyboardNavigation
      }
    ]
  }
]) as unknown as SettingsSection[]

const updateSetting = (sectionKey: string, itemKey: string, value: any) => {
  switch (sectionKey) {
    case 'appearance':
      ;(appearanceSettings.value as any)[itemKey] = value
      break
    case 'messages':
      ;(messageSettings.value as any)[itemKey] = value
      break
    case 'calls':
      ;(callSettings.value as any)[itemKey] = value
      break
    case 'accessibility':
      ;(accessibilitySettings.value as any)[itemKey] = value
      break
  }
  saveSettings()
}

const loadSettings = async () => {
  try {
    loading.value = true
    const allSettings = await settingsService.getSettings()

    appearanceSettings.value = allSettings.appearance
    messageSettings.value = allSettings.messages
    callSettings.value = allSettings.calls
    accessibilitySettings.value = allSettings.accessibility
    labsSettings.value = allSettings.labs
    labsFeatures.value = allSettings.labs.features
  } catch (error) {
    console.error('Failed to load settings:', error)
  } finally {
    loading.value = false
  }
}

const saveSettings = async () => {
  try {
    await settingsService.saveAllSettings({
      appearance: appearanceSettings.value,
      messages: messageSettings.value,
      calls: callSettings.value,
      accessibility: accessibilitySettings.value,
      labs: {
        enabled: labsSettings.value.enabled,
        features: labsFeatures.value
      }
    })
  } catch (error) {
    console.error('Failed to save settings:', error)
  }
}

watch(
  () => [labsSettings.value, labsFeatures.value],
  () => {
    saveSettings()
  },
  { deep: true }
)

onMounted(() => {
  loadSettings()
  loadMediaDevices()
})
</script>

<style lang="scss" scoped>
@use '@/styles/scss/global/variable.scss' as *;
</style>
