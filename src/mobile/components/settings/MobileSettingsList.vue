<template>
  <div class="mobile-settings-list">
    <div
      v-for="(section, sectionIndex) in sections"
      :key="`section-${sectionIndex}`"
      class="mobile-settings-list__section">
      <!-- Section Title -->
      <div v-if="section.title" class="mobile-settings-list__section-title">
        {{ section.title }}
      </div>

      <!-- Section Items -->
      <div class="mobile-settings-list__section-items">
        <MobileSettingsItem
          v-for="(item, itemIndex) in section.items"
          :key="`item-${item.key || itemIndex}`"
          :item="item"
          @change="handleChange"
          @click="handleClick" />
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="sections.length === 0" class="mobile-settings-list__empty">
      <div class="mobile-settings-list__empty-icon">
        <Icon name="settings" :size="48" />
      </div>
      <div class="mobile-settings-list__empty-text">No settings available</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import Icon from '#/components/icons/Icon.vue'
import MobileSettingsItem from '#/components/settings/MobileSettingsItem.vue'
import type { SettingsSection, SettingsItem } from '#/views/settings/types'

interface Props {
  sections: SettingsSection[]
}

type Emits = (e: 'change', key: string, value: string | boolean | number) => void

defineProps<Props>()
const emit = defineEmits<Emits>()

const router = useRouter()

// Handle item value change
const handleChange = (key: string, value: string | boolean | number) => {
  emit('change', key, value)
}

// Handle item click (navigation)
const handleClick = (item: SettingsItem) => {
  if (item.type === 'navigation' && item.route) {
    router.push(item.route)
  }
}
</script>

<style lang="scss" scoped>
.mobile-settings-list {
  &__section {
    margin-bottom: 24px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  &__section-title {
    font-size: 12px;
    font-weight: 500;
    color: var(--hula-gray-400);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 0 16px 8px;
  }

  &__section-items {
    background: white;
    border-radius: 8px;
    overflow: hidden;

    .mobile-settings-item {
      border-radius: 0;

      &:not(:last-child) {
        .mobile-settings-item__divider {
          display: none;
        }
      }

      &:after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 60px;
        right: 0;
        height: 1px;
        background: #f0f0f0;
      }

      &:last-child:after {
        display: none;
      }
    }
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    color: var(--hula-gray-400);
  }

  &__empty-icon {
    margin-bottom: 16px;
    opacity: 0.3;
  }

  &__empty-text {
    font-size: 14px;
  }
}
</style>
