<template>
  <n-flex :size="16" horizontal>
    <n-flex :size="0" style="width: 160px" vertical class="settings-sidebar">
      <div
        v-for="item in settingsSections"
        :key="item.key"
        class="settings-section-item"
        :class="{ 'settings-section-active': activeSection === item.key }"
        @click="activeSection = item.key">
        <svg class="size-16px"><use :href="`#${item.icon}`"></use></svg>
        <span class="text-13px">{{ t(item.labelKey) }}</span>
      </div>
    </n-flex>
    <n-divider vertical style="height: 100%" />
    <div class="settings-content flex-1">
      <n-spin :show="loading">
        <template v-if="activeSection === 'appearance'">
          <n-flex :size="20" vertical>
            <span class="text-16px font-bold text-[--text-color]">{{ t('user_menu.settings.appearance') }}</span>
            <n-flex align="center" justify="space-between">
              <span class="text-14px text-[--text-color]">{{ t('user_menu.settings.theme') }}</span>
              <n-select
                v-model:value="appearanceSettings.theme"
                :options="themeOptions"
                size="small"
                style="width: 150px" />
            </n-flex>
            <n-flex align="center" justify="space-between">
              <span class="text-14px text-[--text-color]">{{ t('user_menu.settings.language') }}</span>
              <n-select
                v-model:value="appearanceSettings.language"
                :options="languageOptions"
                size="small"
                style="width: 150px" />
            </n-flex>
            <n-flex align="center" justify="space-between">
              <span class="text-14px text-[--text-color]">{{ t('user_menu.settings.font_size') }}</span>
              <n-slider
                v-model:value="appearanceSettings.fontSize"
                :min="12"
                :max="20"
                style="width: 150px" />
            </n-flex>
            <n-flex align="center" justify="space-between">
              <span class="text-14px text-[--text-color]">{{ t('user_menu.settings.zoom') }}</span>
              <n-slider
                v-model:value="appearanceSettings.zoom"
                :min="80"
                :max="120"
                :format-tooltip="(val: number) => `${val}%`"
                style="width: 150px" />
            </n-flex>
          </n-flex>
        </template>
        <template v-if="activeSection === 'messages'">
          <n-flex :size="20" vertical>
            <span class="text-16px font-bold text-[--text-color]">{{ t('user_menu.settings.messages') }}</span>
            <n-flex align="center" justify="space-between">
              <span class="text-14px text-[--text-color]">{{ t('user_menu.settings.message_history') }}</span>
              <n-select
                v-model:value="messageSettings.historyLimit"
                :options="historyLimitOptions"
                size="small"
                style="width: 150px" />
            </n-flex>
            <n-flex align="center" justify="space-between">
              <span class="text-14px text-[--text-color]">{{ t('user_menu.settings.auto_read') }}</span>
              <n-switch v-model:value="messageSettings.autoRead" />
            </n-flex>
            <n-flex align="center" justify="space-between">
              <span class="text-14px text-[--text-color]">{{ t('user_menu.settings.emoji_panel') }}</span>
              <n-switch v-model:value="messageSettings.emojiPanel" />
            </n-flex>
            <n-flex align="center" justify="space-between">
              <span class="text-14px text-[--text-color]">{{ t('user_menu.settings.gif_search') }}</span>
              <n-switch v-model:value="messageSettings.gifSearch" />
            </n-flex>
          </n-flex>
        </template>
        <template v-if="activeSection === 'calls'">
          <n-flex :size="20" vertical>
            <span class="text-16px font-bold text-[--text-color]">{{ t('user_menu.settings.calls') }}</span>
            <n-flex align="center" justify="space-between">
              <span class="text-14px text-[--text-color]">{{ t('user_menu.settings.default_camera') }}</span>
              <n-select
                v-model:value="callSettings.camera"
                :options="cameraOptions"
                size="small"
                style="width: 200px" />
            </n-flex>
            <n-flex align="center" justify="space-between">
              <span class="text-14px text-[--text-color]">{{ t('user_menu.settings.default_microphone') }}</span>
              <n-select
                v-model:value="callSettings.microphone"
                :options="microphoneOptions"
                size="small"
                style="width: 200px" />
            </n-flex>
            <n-flex align="center" justify="space-between">
              <span class="text-14px text-[--text-color]">{{ t('user_menu.settings.default_speaker') }}</span>
              <n-select
                v-model:value="callSettings.speaker"
                :options="speakerOptions"
                size="small"
                style="width: 200px" />
            </n-flex>
            <n-flex align="center" justify="space-between">
              <span class="text-14px text-[--text-color]">{{ t('user_menu.settings.noise_suppression') }}</span>
              <n-switch v-model:value="callSettings.noiseSuppression" />
            </n-flex>
            <n-flex align="center" justify="space-between">
              <span class="text-14px text-[--text-color]">{{ t('user_menu.settings.auto_answer') }}</span>
              <n-switch v-model:value="callSettings.autoAnswer" />
            </n-flex>
            <n-flex :size="10" vertical>
              <span class="text-14px text-[--text-color]">{{ t('user_menu.settings.video_quality') }}</span>
              <n-select
                v-model:value="callSettings.videoQuality"
                :options="videoQualityOptions"
                size="small"
                style="width: 200px" />
            </n-flex>
          </n-flex>
        </template>
        <template v-if="activeSection === 'shortcuts'">
          <n-flex :size="16" vertical>
            <span class="text-16px font-bold text-[--text-color]">{{ t('user_menu.settings.shortcuts') }}</span>
            <div class="shortcut-list">
              <div v-for="shortcut in shortcuts" :key="shortcut.key" class="shortcut-item">
                <span class="text-14px text-[--text-color]">{{ t(shortcut.labelKey) }}</span>
                <n-flex :size="4">
                  <n-tag v-for="key in shortcut.keys" :key="key" size="small" round>
                    {{ key }}
                  </n-tag>
                </n-flex>
              </div>
            </div>
          </n-flex>
        </template>
        <template v-if="activeSection === 'accessibility'">
          <n-flex :size="20" vertical>
            <span class="text-16px font-bold text-[--text-color]">{{ t('user_menu.settings.accessibility') }}</span>
            <n-flex align="center" justify="space-between">
              <span class="text-14px text-[--text-color]">{{ t('user_menu.settings.screen_reader') }}</span>
              <n-switch v-model:value="accessibilitySettings.screenReader" />
            </n-flex>
            <n-flex align="center" justify="space-between">
              <span class="text-14px text-[--text-color]">{{ t('user_menu.settings.high_contrast') }}</span>
              <n-switch v-model:value="accessibilitySettings.highContrast" />
            </n-flex>
            <n-flex align="center" justify="space-between">
              <span class="text-14px text-[--text-color]">{{ t('user_menu.settings.reduce_motion') }}</span>
              <n-switch v-model:value="accessibilitySettings.reduceMotion" />
            </n-flex>
            <n-flex align="center" justify="space-between">
              <span class="text-14px text-[--text-color]">{{ t('user_menu.settings.keyboard_navigation') }}</span>
              <n-switch v-model:value="accessibilitySettings.keyboardNavigation" />
            </n-flex>
          </n-flex>
        </template>
        <template v-if="activeSection === 'labs'">
          <n-flex :size="16" vertical>
            <n-flex align="center" justify="space-between">
              <n-flex vertical :size="4">
                <span class="text-14px font-medium text-[--text-color]">{{ t('user_menu.settings.labs_enabled') }}</span>
                <span class="text-12px text-[--info-text-color]">{{ t('user_menu.settings.labs_desc') }}</span>
              </n-flex>
              <n-switch v-model:value="labsSettings.enabled" />
            </n-flex>
            <n-divider style="margin: 0" />
            <n-flex :size="12" vertical>
              <div v-for="lab in labsFeatures" :key="lab.key" class="lab-item">
                <n-flex align="center" justify="space-between" class="w-full">
                  <n-flex vertical :size="4">
                    <span class="text-14px text-[--text-color]">{{ t(lab.labelKey) }}</span>
                    <span class="text-12px text-[--info-text-color]">{{ t(lab.descriptionKey) }}</span>
                  </n-flex>
                  <n-switch v-model:value="lab.enabled" />
                </n-flex>
              </div>
            </n-flex>
          </n-flex>
        </template>
      </n-spin>
    </div>
  </n-flex>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import MatrixSettingsService from '@/services/matrix/MatrixSettingsService'

const emit = defineEmits(['close'])
const { t } = useI18n()

const activeSection = ref('appearance')
const settingsService = MatrixSettingsService.getInstance()
const loading = ref(false)

interface SettingsSection {
  key: string
  labelKey: string
  icon: string
}

const settingsSections: SettingsSection[] = [
  { key: 'appearance', labelKey: 'user_menu.settings.appearance', icon: 'appearance' },
  { key: 'messages', labelKey: 'user_menu.settings.messages', icon: 'chat' },
  { key: 'calls', labelKey: 'user_menu.settings.calls', icon: 'call' },
  { key: 'shortcuts', labelKey: 'user_menu.settings.shortcuts', icon: 'keyboard' },
  { key: 'accessibility', labelKey: 'user_menu.settings.accessibility', icon: 'accessibility' },
  { key: 'labs', labelKey: 'user_menu.settings.labs', icon: 'flask' }
]

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
const speakerOptions = ref([{ label: 'Default Speaker', value: 'default' }])

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

    const speakers = devices.filter((d) => d.kind === 'audiooutput')
    if (speakers.length > 0) {
      speakerOptions.value = speakers.map((d) => ({
        label: d.label || `Speaker ${d.deviceId.slice(0, 8)}`,
        value: d.deviceId
      }))
    }
  } catch (error) {
    console.error('Failed to enumerate media devices:', error)
  }
}

interface Shortcut {
  key: string
  labelKey: string
  keys: string[]
}

const shortcuts: Shortcut[] = [
  { key: 'new_message', labelKey: 'user_menu.shortcuts.new_message', keys: ['Ctrl', 'N'] },
  { key: 'search', labelKey: 'user_menu.shortcuts.search', keys: ['Ctrl', 'K'] },
  { key: 'quick_reply', labelKey: 'user_menu.shortcuts.quick_reply', keys: ['Ctrl', 'R'] },
  { key: 'mark_all_read', labelKey: 'user_menu.shortcuts.mark_all_read', keys: ['Ctrl', 'Shift', 'O'] },
  { key: 'toggle_emoji', labelKey: 'user_menu.shortcuts.toggle_emoji', keys: ['Ctrl', 'E'] }
]

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
  speaker: 'default',
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
    window.$message.success(t('user_menu.settings.save_success'))
  } catch (error) {
    console.error('Failed to save settings:', error)
    window.$message.error(t('user_menu.settings.save_failed'))
  }
}

watch(
  () => [appearanceSettings.value, messageSettings.value, callSettings.value, accessibilitySettings.value],
  () => {
    saveSettings()
  },
  { deep: true }
)

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

.settings-sidebar {
  padding: 8px 0;
}

.settings-section-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s ease;

  &:hover {
    background: var(--bg-menu-hover);
  }
}

.settings-section-active {
  background: var(--bg-menu-hover);
  color: var(--primary-color);
}

.settings-content {
  padding: 8px 16px;
  max-height: 400px;
  overflow-y: auto;
}

.shortcut-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px;
  border-radius: 8px;
  background: var(--bg-menu-hover);
}

.lab-item {
  padding: 10px;
  border-radius: 8px;
  background: var(--bg-menu-hover);
}
</style>
