<template>
  <button
    :class="['icon-button', { 'is-active': active, 'is-disabled': disabled }]"
    :disabled="disabled"
    :aria-label="ariaLabel"
    v-bind="$attrs">
    <svg class="icon-button__icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <use :href="`#${icon}`" fill="currentColor" />
    </svg>
    <span v-if="showBadge" class="icon-button__badge">{{ badgeValue }}</span>
  </button>
</template>

<script setup lang="ts">
interface Props {
  icon: string
  active?: boolean
  disabled?: boolean
  ariaLabel?: string
  showBadge?: boolean
  badgeValue?: number | string
}

withDefaults(defineProps<Props>(), {
  active: false,
  disabled: false,
  showBadge: false,
  badgeValue: 0
})
</script>

<style lang="scss" scoped>
@import '@/styles/scss/global/variables.scss';

.icon-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  color: var(--hula-text-secondary, #64748b);
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(.is-disabled) {
    background: var(--hula-bg-tertiary, #f1f5f9);
    color: var(--hula-brand-primary, #13987f);
  }

  &:active:not(.is-disabled) {
    background: var(--hula-border-default, #e2e8f0);
  }

  &.is-active {
    color: var(--hula-brand-primary, #13987f);
    background: var(--hula-brand-bg, #f0fdf9);
  }

  &.is-disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &__icon {
    width: 20px;
    height: 20px;
  }

  &__badge {
    position: absolute;
    top: 4px;
    right: 4px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    background: var(--hula-error, #ef4444);
    color: var(--hula-white, #ffffff);
    font-size: 10px;
    font-weight: 600;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}
</style>
