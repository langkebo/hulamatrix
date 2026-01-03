<template>
  <div
    v-if="item.visible !== false"
    :class="['mobile-settings-item', `mobile-settings-item--${item.type}`, { 'mobile-settings-item--disabled': item.disabled }]"
    @click="handleClick"
  >
    <!-- Navigation / Action Item -->
    <template v-if="item.type === SettingsItemType.NAVIGATION || item.type === SettingsItemType.ACTION">
      <div v-if="item.icon" class="mobile-settings-item__icon">
        <Icon :name="item.icon" :size="20" />
      </div>
      <div class="mobile-settings-item__content">
        <div class="mobile-settings-item__label">{{ item.label }}</div>
        <div v-if="item.description" class="mobile-settings-item__description">{{ item.description }}</div>
      </div>
      <div class="mobile-settings-item__chevron">
        <Icon name="chevron-right" :size="16" />
      </div>
    </template>

    <!-- Switch Item -->
    <template v-else-if="item.type === SettingsItemType.SWITCH">
      <div v-if="item.icon" class="mobile-settings-item__icon">
        <Icon :name="item.icon" :size="20" />
      </div>
      <div class="mobile-settings-item__content">
        <div class="mobile-settings-item__label">{{ item.label }}</div>
        <div v-if="item.description" class="mobile-settings-item__description">{{ item.description }}</div>
      </div>
      <div class="mobile-settings-item__control" @click.stop>
        <n-switch
          v-model:value="localValue as boolean"
          :disabled="item.disabled"
          size="medium"
        />
      </div>
    </template>

    <!-- Input Item -->
    <template v-else-if="item.type === SettingsItemType.INPUT">
      <div v-if="item.icon" class="mobile-settings-item__icon">
        <Icon :name="item.icon" :size="20" />
      </div>
      <div class="mobile-settings-item__content">
        <div class="mobile-settings-item__label">{{ item.label }}</div>
      </div>
      <div class="mobile-settings-item__control" @click.stop>
        <n-input
          v-model:value="localValue as string"
          :disabled="item.disabled"
          placeholder=""
          size="medium"
          @update:value="handleInputChange"
        />
      </div>
    </template>

    <!-- Select Item -->
    <template v-else-if="item.type === SettingsItemType.SELECT">
      <div v-if="item.icon" class="mobile-settings-item__icon">
        <Icon :name="item.icon" :size="20" />
      </div>
      <div class="mobile-settings-item__content">
        <div class="mobile-settings-item__label">{{ item.label }}</div>
      </div>
      <div class="mobile-settings-item__control" @click.stop>
        <n-select
          v-model:value="localValue as string | number"
          :disabled="item.disabled"
          :options="(item.options || []) as Array<{ label: string; value: string | number }>"
          size="medium"
          @update:value="handleSelectChange"
        />
      </div>
    </template>

    <!-- Divider -->
    <div v-else-if="item.type === SettingsItemType.DIVIDER" class="mobile-settings-item__divider" />

    <!-- Section Header -->
    <div v-else-if="item.type === SettingsItemType.SECTION" class="mobile-settings-item__section">
      {{ item.label }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { NSwitch, NInput, NSelect } from 'naive-ui'
import Icon from '#/components/icons/Icon.vue'
import { SettingsItemType } from '#/views/settings/types'
import type { SettingsItem, SelectOption } from '#/views/settings/types'

interface Props {
  item: SettingsItem
}

interface Emits {
  (e: 'change', key: string, value: string | boolean | number): void
  (e: 'click', item: SettingsItem): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Local state for value binding
const localValue = ref(props.item.value ?? props.item.defaultValue)

// Watch for external value changes
watch(
  () => props.item.value,
  (newValue) => {
    localValue.value = newValue
  }
)

// Handle click event
const handleClick = () => {
  if (props.item.disabled) return

  if (props.item.type === SettingsItemType.NAVIGATION && props.item.route) {
    emit('click', props.item)
  } else if (props.item.type === SettingsItemType.ACTION && props.item.action) {
    props.item.action()
    emit('click', props.item)
  }
}

// Handle input change
const handleInputChange = (value: string) => {
  emit('change', props.item.key, value)
}

// Handle select change
const handleSelectChange = (value: string | number) => {
  emit('change', props.item.key, value)
}

// Watch local value changes for switch/select
watch(localValue, (newValue) => {
  if (props.item.type === SettingsItemType.SWITCH || props.item.type === SettingsItemType.SELECT) {
    // Only emit if value is defined
    if (newValue !== undefined) {
      emit('change', props.item.key, newValue)
    }
  }
})
</script>

<style lang="scss" scoped>
.mobile-settings-item {
  display: flex;
  align-items: center;
  min-height: 48px;
  padding: 12px 16px;
  background: white;
  transition: background-color 0.2s;

  &:not(&--divider):not(&--section):active {
    background: #f5f5f5;
  }

  &--disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  &__icon {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 12px;
    color: #666;
  }

  &__content {
    flex: 1;
    min-width: 0;
  }

  &__label {
    font-size: 16px;
    font-weight: 400;
    color: #333;
    line-height: 1.4;
  }

  &__description {
    font-size: 12px;
    color: #999;
    margin-top: 2px;
    line-height: 1.3;
  }

  &__chevron {
    flex-shrink: 0;
    margin-left: 8px;
    color: #999;
  }

  &__control {
    flex-shrink: 0;
    margin-left: 12px;
  }

  &__divider {
    height: 1px;
    background: #f0f0f0;
    margin: 8px 0;
  }

  &__section {
    font-size: 12px;
    font-weight: 500;
    color: #999;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 8px 4px;
  }
}
</style>
