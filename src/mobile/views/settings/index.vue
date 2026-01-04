<template>
  <SettingsLayout :title="t('settings.title')">
    <MobileSettingsList
      :sections="settingsSections"
      @change="handleSettingChange"
    />
  </SettingsLayout>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMessage } from 'naive-ui'
import SettingsLayout from '#/views/settings/SettingsLayout.vue'
import MobileSettingsList from '#/components/settings/MobileSettingsList.vue'
import { mainSettingsConfig } from '#/views/settings/config'
import { useSettingStore } from '@/stores/setting'
import { logger } from '@/utils/logger'

const { t } = useI18n()
const message = useMessage()
const settingStore = useSettingStore()

// Settings sections with i18n translations
const settingsSections = computed(() => {
  return mainSettingsConfig.sections.map((section) => ({
    ...section,
    title: t(section.title),
    items: section.items.map((item) => ({
      ...item,
      label: t(item.label)
    }))
  }))
})

// Handle setting value change
const handleSettingChange = (key: string, value: string | boolean | number) => {
  try {
    // Update settings store
    switch (key) {
      // Add specific setting handlers here
      default:
        logger.debug(`Setting changed: ${key} = ${value}`)
    }
    message.success(t('common.success'))
  } catch (error) {
    logger.error('Failed to update setting:', error)
    message.error(t('common.error'))
  }
}
</script>

<style lang="scss" scoped>
// Additional styles if needed
</style>
