<template>
  <SettingsLayout :title="t('setting.notification.title')">
    <div class="notification-settings">
      <!-- Message Sound Toggle -->
      <div class="settings-section">
        <div class="section-title">{{ t('setting.notice.sound') }}</div>
        <div class="settings-item">
          <div class="item-content">
            <div class="item-label">{{ t('setting.notice.message_sound') }}</div>
            <div class="item-description">{{ t('setting.notice.message_sound_descript') }}</div>
          </div>
          <n-switch size="medium" v-model:value="messageSound" />
        </div>
      </div>

      <!-- Quiet Hours -->
      <div class="settings-section">
        <div class="section-title">{{ t('setting.notice.quiet_hours') }}</div>
        <div class="settings-card">
          <div class="settings-item">
            <div class="item-content">
              <div class="item-label">{{ t('setting.notice.quiet_enabled') }}</div>
            </div>
            <n-switch size="medium" v-model:value="quietEnabled" />
          </div>
          <div v-if="quietEnabled" class="time-range">
            <div class="time-picker" @click="showStartTimePicker = true">
              <div class="time-label">{{ t('setting.notice.start_time') }}</div>
              <div class="time-value">{{ formatTime(quietStartMs) }}</div>
            </div>
            <div class="time-separator">-</div>
            <div class="time-picker" @click="showEndTimePicker = true">
              <div class="time-label">{{ t('setting.notice.end_time') }}</div>
              <div class="time-value">{{ formatTime(quietEndMs) }}</div>
            </div>
          </div>
          <div v-if="quietEnabled" class="preset-buttons">
            <n-button size="small" secondary @click="setPresetNight">{{ t('setting.notice.preset_night') }}</n-button>
            <n-button size="small" secondary @click="setPresetWork">{{ t('setting.notice.preset_work') }}</n-button>
          </div>
        </div>
      </div>

      <!-- Keywords -->
      <div class="settings-section">
        <div class="section-header">
          <span class="section-title">{{ t('setting.notice.keywords') }}</span>
          <n-button size="small" @click="showKeywordEditor = !showKeywordEditor">
            {{ showKeywordEditor ? t('common.close') : t('common.edit') }}
          </n-button>
        </div>

        <div class="keywords-preview">
          <div v-if="keywords.length === 0" class="empty-keywords">
            {{ t('setting.notice.no_keywords') }}
          </div>
          <div v-else class="keywords-list">
            <n-tag
              v-for="keyword in displayKeywords"
              :key="keyword"
              closable
              @close="removeKeyword(keyword)"
              type="success"
              size="small">
              {{ keyword }}
            </n-tag>
          </div>
        </div>

        <div v-if="showKeywordEditor" class="keywords-editor">
          <div class="keyword-input">
            <n-input
              v-model:value="newKeyword"
              :placeholder="t('setting.notice.add_keyword_placeholder')"
              @keyup.enter="addKeyword" />
            <n-button type="primary" secondary @click="addKeyword">{{ t('action.add') }}</n-button>
          </div>
          <div class="keyword-options">
            <div class="option-item">
              <span>{{ t('setting.notice.highlight_only') }}</span>
              <n-switch v-model:value="highlightOnly" size="small" />
            </div>
            <div class="option-item">
              <span>{{ t('setting.notice.sound_alert') }}</span>
              <n-switch v-model:value="soundOn" size="small" />
            </div>
          </div>
        </div>
      </div>

      <!-- Group Notification Settings (Simplified for Mobile) -->
      <div class="settings-section">
        <div class="section-header">
          <span class="section-title">{{ t('setting.notice.group_setting') }}</span>
        </div>
        <div class="settings-item" @click="openGroupSettings">
          <div class="item-content">
            <div class="item-label">{{ t('setting.notice.manage_group_notification') }}</div>
            <div class="item-description">{{ t('setting.notice.manage_group_notification_desc') }}</div>
          </div>
          <Icon name="chevron-right" :size="16" />
        </div>
      </div>
    </div>

    <!-- Time Pickers -->
    <n-modal v-model:show="showStartTimePicker" preset="card" :title="t('setting.notice.select_start_time')">
      <n-time-picker
        v-model:value="quietStartMs"
        format="HH:mm"
        :is-hour-disabled="disableStartHour"
        @update:value="updateQuietStart" />
    </n-modal>
    <n-modal v-model:show="showEndTimePicker" preset="card" :title="t('setting.notice.select_end_time')">
      <n-time-picker
        v-model:value="quietEndMs"
        format="HH:mm"
        :is-hour-disabled="disableEndHour"
        @update:value="updateQuietEnd" />
    </n-modal>
  </SettingsLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { NSwitch, NButton, NTag, NInput, NModal, NTimePicker, useMessage } from 'naive-ui'
import SettingsLayout from '#/views/settings/SettingsLayout.vue'
import Icon from '#/components/icons/Icon.vue'
import { useNotificationSettings } from '@/composables'

const { t } = useI18n()
const message = useMessage()

// 使用 composable 管理通知设置
const {
  messageSound,
  quietEnabled,
  quietStartMs,
  quietEndMs,
  keywords,
  newKeyword,
  highlightOnly,
  soundOn,
  addKeyword,
  removeKeyword,
  setPresetNight,
  setPresetWork,
  loadSettings,
  formatTime
} = useNotificationSettings()

// 移动端特有的状态
const showStartTimePicker = ref(false)
const showEndTimePicker = ref(false)
const showKeywordEditor = ref(false)

const displayKeywords = computed(() => keywords.value.slice(0, 10))

const disableStartHour = (_hour: number) => {
  return false
}

const disableEndHour = (_hour: number) => {
  return false
}

const updateQuietStart = () => {
  // composable 会自动应用静默时段
}

const updateQuietEnd = () => {
  // composable 会自动应用静默时段
}

const openGroupSettings = () => {
  message.info(t('setting.notice.group_settings_coming_soon'))
}

// 加载设置
onMounted(async () => {
  await loadSettings()
})
</script>

<style lang="scss" scoped>
.notification-settings {
  padding: 0;
}

.settings-section {
  margin-bottom: 24px;

  &:last-child {
    margin-bottom: 0;
  }
}

.section-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--hula-gray-400);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 0 4px 8px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px 8px;

  .section-title {
    padding: 0;
    margin: 0;
  }
}

.settings-item {
  background: white;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: background-color 0.2s;

  &:active {
    background: var(--hula-gray-50);
  }

  .item-content {
    flex: 1;
  }

  .item-label {
    font-size: 16px;
    color: var(--hula-gray-900);
    margin-bottom: 2px;
  }

  .item-description {
    font-size: 12px;
    color: var(--hula-gray-400);
  }
}

.settings-card {
  background: white;
  border-radius: 12px;
  padding: 16px;

  .settings-item {
    background: transparent;
    padding: 0;
    margin-bottom: 16px;
    border-radius: 0;

    &:last-child {
      margin-bottom: 0;
    }
  }
}

.time-range {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin: 16px 0;
}

.time-picker {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px;
  background: var(--hula-gray-50);
  border-radius: 8px;
  cursor: pointer;

  &:active {
    background: var(--hula-gray-200);
  }
}

.time-label {
  font-size: 11px;
  color: var(--hula-gray-400);
  text-transform: uppercase;
}

.time-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--primary-color);
}

.time-separator {
  font-size: 20px;
  color: var(--hula-gray-400);
  font-weight: 500;
}

.preset-buttons {
  display: flex;
  gap: 8px;
  margin-top: 12px;

  .n-button {
    flex: 1;
  }
}

.keywords-preview {
  background: white;
  border-radius: 12px;
  padding: 12px;
  min-height: 60px;
  margin-bottom: 8px;
}

.empty-keywords {
  color: var(--hula-gray-400);
  font-size: 14px;
  text-align: center;
  padding: 16px;
}

.keywords-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.keywords-editor {
  background: var(--hula-gray-50);
  border-radius: 12px;
  padding: 12px;
  margin-top: 8px;
}

.keyword-input {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.keyword-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  color: var(--hula-gray-900);
}
</style>
