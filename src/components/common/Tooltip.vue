<template>
  <div
    class="h-tooltip"
    :class="[`h-tooltip--${placement}`, { 'h-tooltip--visible': isVisible }]"
    @mouseenter="showTooltip"
    @mouseleave="hideTooltip">
    <slot></slot>
    <div v-show="isVisible" class="h-tooltip__content" :class="`h-tooltip__content--${placement}`">
      {{ text }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue'

interface Props {
  text: string
  placement?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
}

const props = withDefaults(defineProps<Props>(), {
  placement: 'top',
  delay: 500
})

const isVisible = ref(false)
let timeoutId: number | null = null

const showTooltip = () => {
  if (timeoutId) clearTimeout(timeoutId)
  timeoutId = window.setTimeout(() => {
    isVisible.value = true
  }, props.delay)
}

const hideTooltip = () => {
  if (timeoutId) {
    clearTimeout(timeoutId)
    timeoutId = null
  }
  isVisible.value = false
}

onUnmounted(() => {
  if (timeoutId) {
    clearTimeout(timeoutId)
  }
})
</script>

<style lang="scss" scoped>
.h-tooltip {
  position: relative;
  display: inline-block;

  &__content {
    position: absolute;
    padding: var(--spacing-xs) var(--spacing-sm);
    background: rgba(var(--hula-black-rgb), 0.9);
    color: var(--hula-white);
    font-size: var(--font-size-sm);
    border-radius: var(--radius-md);
    white-space: nowrap;
    z-index: 1000;
    transition: all var(--transition-fast);
    pointer-events: none;

    &--top {
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%) translateY(-4px);
      margin-bottom: var(--spacing-xs);
    }

    &--bottom {
      top: 100%;
      left: 50%;
      transform: translateX(-50%) translateY(4px);
      margin-top: var(--spacing-xs);
    }

    &--left {
      right: 100%;
      top: 50%;
      transform: translateY(-50%) translateX(-4px);
      margin-right: var(--spacing-xs);
    }

    &--right {
      left: 100%;
      top: 50%;
      transform: translateY(-50%) translateX(4px);
      margin-left: var(--spacing-xs);
    }

    &::before {
      content: '';
      position: absolute;
      width: 0;
      height: 0;
      border: 4px solid transparent;
    }

    &--top::before {
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border-top-color: rgba(var(--hula-black-rgb), 0.9);
    }

    &--bottom::before {
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%) rotate(180deg);
      border-top-color: rgba(var(--hula-black-rgb), 0.9);
    }

    &--left::before {
      left: 100%;
      top: 50%;
      transform: translateY(-50%) rotate(-90deg);
      border-top-color: rgba(var(--hula-black-rgb), 0.9);
    }

    &--right::before {
      right: 100%;
      top: 50%;
      transform: translateY(-50%) rotate(90deg);
      border-top-color: rgba(var(--hula-black-rgb), 0.9);
    }
  }
}
</style>
