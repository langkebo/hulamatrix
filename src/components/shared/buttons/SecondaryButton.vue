<template>
  <button
    :class="['secondary-button', { 'is-loading': loading, 'is-disabled': disabled }]"
    :disabled="disabled || loading"
    v-bind="$attrs">
    <span v-if="loading" class="button-loader"></span>
    <slot />
  </button>
</template>

<script setup lang="ts">
interface Props {
  loading?: boolean
  disabled?: boolean
}

withDefaults(defineProps<Props>(), {
  loading: false,
  disabled: false
})
</script>

<style lang="scss" scoped>
@import '@/styles/scss/global/variables.scss';

.secondary-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.5;
  color: var(--hula-text-primary, #1e293b);
  background: var(--hula-bg-secondary, #f8fafc);
  border: 1px solid var(--hula-border-default, #e2e8f0);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(.is-disabled) {
    background: var(--hula-bg-tertiary, #f1f5f9);
    border-color: var(--hula-border-strong, #cbd5e1);
  }

  &:active:not(.is-disabled) {
    background: var(--hula-border-default, #e2e8f0);
  }

  &.is-disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  &.is-loading {
    pointer-events: none;
  }

  .button-loader {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(var(--hula-text-primary-rgb, 30, 41, 59), 0.3);
    border-top-color: var(--hula-text-primary, #1e293b);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
