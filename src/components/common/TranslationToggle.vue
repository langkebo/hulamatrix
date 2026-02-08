<template>
  <div class="translation-toggle">
    <n-popover trigger="click" placement="bottom-end">
      <template #trigger>
        <div class="translate-btn" :class="{ active: translationStore.autoTranslate }">
          <svg class="w-20px h-20px">
            <use href="#translation"></use>
          </svg>
          <span v-if="translationStore.autoTranslate" class="translate-badge"></span>
        </div>
      </template>
      <div class="translation-popover">
        <div class="popover-header">
          <n-flex align="center" :size="8">
            <svg class="w-18px h-18px">
              <use href="#translation"></use>
            </svg>
            <span class="font-14px font-medium">{{ t('translation.title') }}</span>
          </n-flex>
        </div>

        <n-divider />

        <div class="popover-section">
          <div class="section-label">{{ t('translation.auto_translate') }}</div>
          <n-switch
            v-model:value="translationStore.autoTranslate"
            :loading="translationStore.translating"
            size="small" />
        </div>

        <n-divider v-if="translationStore.autoTranslate" />

        <template v-if="translationStore.autoTranslate">
          <div class="popover-section">
            <div class="section-label">{{ t('translation.target_language') }}</div>
            <n-select
              v-model:value="translationStore.targetLanguage"
              :options="languageOptions"
              size="small"
              style="width: 160px" />
          </div>

          <n-divider />

          <div class="popover-section">
            <div class="section-label">{{ t('translation.provider') }}</div>
            <n-select
              v-model:value="translationStore.provider"
              :options="providerOptions"
              size="small"
              style="width: 160px" />
          </div>
        </template>
      </div>
    </n-popover>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTranslationStore } from '@/stores/translation'

const { t } = useI18n()
const translationStore = useTranslationStore()

const languageOptions = computed(() =>
  translationStore.supportedLanguages.map((lang) => ({
    label: `${lang.nativeName} (${lang.name})`,
    value: lang.code
  }))
)

const providerOptions = computed(() =>
  translationStore.availableProviders.map((p) => ({
    label: p.name,
    value: p.id
  }))
)
</script>

<style scoped lang="scss">
.translation-toggle {
  display: flex;
  align-items: center;
}

.translate-btn {
  position: relative;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-color);
  transition: all 0.2s ease;

  &:hover {
    background: var(--bg-left-menu-hover);
  }

  &.active {
    color: var(--primary-color);
    background: var(--bg-active-msg);
  }

  .translate-badge {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--primary-color);
  }
}

.translation-popover {
  min-width: 200px;
  padding: 4px;

  .popover-header {
    padding: 4px 8px;
  }

  .popover-section {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px;

    .section-label {
      font-size: 12px;
      color: var(--text-color);
    }
  }
}
</style>
