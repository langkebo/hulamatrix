<template>
  <SettingsLayout :title="t('setting.keyboard.title')">
    <div class="settings-placeholder">
      <Icon name="keyboard" :size="48" />
      <p>{{ t('setting.keyboard.coming_soon') }}</p>
    </div>
  </SettingsLayout>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import SettingsLayout from '#/views/settings/SettingsLayout.vue'
import Icon from '#/components/icons/Icon.vue'

const { t } = useI18n()
</script>

<style lang="scss" scoped>
.settings-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--hula-gray-400);

  p {
    margin-top: 16px;
    font-size: 14px;
  }
}
</style>
