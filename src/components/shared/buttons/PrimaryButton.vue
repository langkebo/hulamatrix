<template>
  <button
    :class="['primary-button', { 'is-loading': loading, 'is-disabled': disabled }]"
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

.primary-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--hula-white, #ffffff);
  background: linear-gradient(
    135deg,
    var(--hula-brand-primary, #13987f) 0%,
    var(--hula-brand-primary-hover, #0e6b58) 100%
  );
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(.is-disabled) {
    background: linear-gradient(135deg, var(--hula-brand-light, #34b6a8) 0%, var(--hula-brand-primary, #13987f) 100%);
    box-shadow: var(--hula-shadow-brand-lg, 0 4px 12px rgba(19, 152, 127, 0.3));
    transform: translateY(-1px);
  }

  &:active:not(.is-disabled) {
    transform: translateY(0);
    box-shadow: var(--hula-shadow-brand, 0 2px 4px rgba(19, 152, 127, 0.2));
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
    border: 2px solid rgba(var(--hula-white-rgb, 255, 255, 255), 0.3);
    border-top-color: var(--hula-white, #ffffff);
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
