<template>
  <SettingsLayout :title="t('setting.appearance.title')">
    <div class="appearance-settings">
      <!-- Theme Selection -->
      <div class="settings-section">
        <div class="section-title">{{ t('setting.general.appearance.title') }}</div>
        <div class="theme-grid">
          <div
            v-for="theme in themeList"
            :key="theme.code"
            class="theme-option"
            :class="{ 'theme-option--active': activeTheme === theme.code }"
            @click="handleThemeChange(theme.code)">
            <div class="theme-preview" :class="`theme-preview--${theme.code}`">
              <component :is="theme.model" />
            </div>
            <div class="theme-name">{{ theme.title }}</div>
          </div>
        </div>
      </div>

      <!-- Font Scale -->
      <div class="settings-section">
        <div class="section-title">{{ t('setting.appearance.font_scale') }}</div>
        <div class="settings-card">
          <div class="font-scale-info">
            <span class="font-scale-label">{{ t('setting.appearance.current_scale') }}</span>
            <span class="font-scale-value">{{ fontScale }}%</span>
          </div>
          <n-slider
            v-model:value="fontScale"
            :min="50"
            :max="150"
            :step="10"
            :marks="{ 80: '80%', 100: '100%', 120: '120%', 150: '150%' }"
            @update:value="handleFontScaleChange" />
          <div class="preset-buttons">
            <n-button size="small" secondary @click="handleFontScaleChange(80)">80%</n-button>
            <n-button size="small" secondary @click="handleFontScaleChange(100)">100%</n-button>
            <n-button size="small" secondary @click="handleFontScaleChange(120)">120%</n-button>
            <n-button size="small" secondary @click="handleFontScaleChange(150)">150%</n-button>
          </div>
        </div>
      </div>

      <!-- Display Options (Mobile-Optimized) -->
      <div class="settings-section">
        <div class="section-title">{{ t('setting.appearance.display_options') }}</div>
        <div class="settings-list">
          <div class="settings-item">
            <div class="item-content">
              <div class="item-label">{{ t('setting.appearance.autoplay_gifs') }}</div>
            </div>
            <n-switch size="medium" v-model:value="autoplayGifs" />
          </div>
          <div class="settings-item">
            <div class="item-content">
              <div class="item-label">{{ t('setting.appearance.autoplay_videos') }}</div>
            </div>
            <n-switch size="medium" v-model:value="autoplayVideos" />
          </div>
          <div class="settings-item">
            <div class="item-content">
              <div class="item-label">{{ t('setting.appearance.show_url_previews') }}</div>
            </div>
            <n-switch size="medium" v-model:value="showUrlPreviews" />
          </div>
        </div>
      </div>

      <!-- Image Settings -->
      <div class="settings-section">
        <div class="section-title">{{ t('setting.appearance.image_settings') }}</div>
        <div class="settings-item">
          <div class="item-content">
            <div class="item-label">{{ t('setting.appearance.image_size_limit') }}</div>
            <div class="item-description">{{ t('setting.appearance.image_size_limit_desc') }}</div>
          </div>
          <n-select
            v-model:value="imageSizeLimit"
            :options="imageSizeOptions"
            size="medium"
            class="image-size-select"
            @update:value="handleImageSizeChange" />
        </div>
      </div>
    </div>
  </SettingsLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue'
import { useI18n } from 'vue-i18n'
import { NSwitch, NButton, NSelect, NSlider, useMessage } from 'naive-ui'
import SettingsLayout from '#/views/settings/SettingsLayout.vue'
import { useTopicsList } from '@/views/moreWindow/settings/model.tsx'
import Icon from '#/components/icons/Icon.vue'
import { useAppearanceSettings } from '@/composables'

const { t } = useI18n()
const message = useMessage()

// Use shared composable
const { activeTheme, fontScale, imageSizeLimit, toggleTheme, setFontScale, setImageSizeLimit } = useAppearanceSettings({
  onThemeChange: () => message.success(t('setting.appearance.theme_changed')),
  onFontScaleChange: (val) => message.success(t('setting.appearance.font_scale_changed', { scale: val })),
  onImageSizeChange: () => message.success(t('setting.appearance.image_size_changed'))
})

// Theme
const themeList = useTopicsList()

const handleThemeChange = (code: string) => {
  toggleTheme(code)
}

// Font Scale
const handleFontScaleChange = (value: number) => {
  setFontScale(value)
}

// Display Options
const autoplayGifs = ref(true)
const autoplayVideos = ref(false)
const showUrlPreviews = ref(true)

// Image Settings
const imageSizeOptions = [
  { label: t('setting.appearance.image_auto'), value: 'auto' },
  { label: t('setting.appearance.image_small'), value: 'small' },
  { label: t('setting.appearance.image_medium'), value: 'medium' },
  { label: t('setting.appearance.image_large'), value: 'large' }
]

const handleImageSizeChange = (value: string) => {
  setImageSizeLimit(value)
}

// onMounted is handled inside useAppearanceSettings for theme and font scale initialization,
// but we might want to ensure the theme is correct if there's specific mobile logic?
// The composable sets activeTheme on mount, which is fine.
</script>

<style lang="scss" scoped>
.appearance-settings {
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

.theme-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.theme-option {
  cursor: pointer;
  transition: transform 0.2s;

  &:active {
    transform: scale(0.95);
  }

  &--active {
    .theme-preview {
      border-color: var(--primary-color);
      box-shadow: 0 0 0 2px var(--primary-color);
    }
  }
}

.theme-preview {
  aspect-ratio: 16/10;
  border-radius: 12px;
  border: 2px solid var(--hula-gray-100);
  overflow: hidden;
  margin-bottom: 8px;
  transition: all 0.2s;
}

.theme-name {
  font-size: 12px;
  color: var(--hula-gray-700);
  text-align: center;
}

.settings-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
}

.font-scale-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.font-scale-label {
  font-size: 14px;
  color: var(--hula-gray-700);
}

.font-scale-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--primary-color);
}

.preset-buttons {
  display: flex;
  gap: 8px;
  margin-top: 16px;

  .n-button {
    flex: 1;
  }
}

.settings-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.settings-item {
  background: white;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;

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

.image-size-select {
  width: 120px;
}
</style>
