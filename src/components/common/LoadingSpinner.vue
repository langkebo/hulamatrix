<template>
  <div
    class="h-loading-spinner"
    :class="[`h-loading-spinner--${size}`, { 'h-loading-spinner--overlay': overlay }]"
    :style="{ color: customColor }">
    <svg class="h-loading-spinner__circle" viewBox="0 0 24 24" fill="none">
      <circle
        class="h-loading-spinner__path"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="4"
        stroke-linecap="round"
        stroke-dasharray="60 20" />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  size?: 'small' | 'medium' | 'large'
  overlay?: boolean
  color?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 'medium',
  overlay: false
})

const spinnerSize = computed(() => {
  switch (props.size) {
    case 'small':
      return '16px'
    case 'large':
      return '48px'
    default:
      return '24px'
  }
})

const customColor = computed(() => props.color || 'var(--primary-color)')
</script>

<style lang="scss" scoped>
.h-loading-spinner {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: v-bind(customColor);

  &--overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(var(--hula-white-rgb), 0.9);
    z-index: 9999;
  }

  &__circle {
    width: v-bind(spinnerSize);
    height: v-bind(spinnerSize);
    animation: spin 1s linear infinite;
  }

  &__path {
    transition: stroke-dasharray 0.6s ease;
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
