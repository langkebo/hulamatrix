<template>
  <div
    :class="['glass-card', variantClass, { 'glass-card-hover': hoverable, 'glass-card-clickable': clickable }]"
    :style="cardStyle"
    @click="handleClick">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from 'vue'

interface Props {
  /**
   * Card variant for different glass effects
   */
  variant?: 'default' | 'subtle' | 'strong' | 'brand'
  /**
   * Blur amount in pixels
   */
  blur?: number
  /**
   * Background opacity (0-1)
   */
  opacity?: number
  /**
   * Border width in pixels
   */
  borderWidth?: number
  /**
   * Border opacity (0-1)
   */
  borderOpacity?: number
  /**
   * Add hover effect
   */
  hoverable?: boolean
  /**
   * Make card clickable
   */
  clickable?: boolean
  /**
   * Rounded corners
   */
  rounded?: boolean | string
  /**
   * Shadow intensity
   */
  shadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  /**
   * Custom background color
   */
  bgColor?: string
  /**
   * Custom border color
   */
  borderColor?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  blur: undefined,
  opacity: undefined,
  borderWidth: 1,
  borderOpacity: 0.1,
  hoverable: false,
  clickable: false,
  rounded: true,
  shadow: 'md',
  bgColor: undefined,
  borderColor: undefined
})

const emit = defineEmits<(e: 'click', event: MouseEvent) => void>()

const variantClass = computed(() => `glass-card-${props.variant}`)

const cardStyle = computed<CSSProperties>(() => {
  const style: CSSProperties = {}

  // Blur amount - use variant defaults or custom
  const blurMap = {
    default: 20,
    subtle: 10,
    strong: 30,
    brand: 20
  }
  const blur = props.blur ?? blurMap[props.variant]
  style.backdropFilter = `blur(${blur}px)`
  style.WebkitBackdropFilter = `blur(${blur}px)` // Safari support

  // Background opacity
  const opacityMap = {
    default: 0.7,
    subtle: 0.5,
    strong: 0.85,
    brand: 0.7
  }
  const opacity = props.opacity ?? opacityMap[props.variant]

  // Background color
  if (props.bgColor) {
    style.backgroundColor = props.bgColor
  } else if (props.variant === 'brand') {
    style.backgroundColor = `rgba(var(--hula-brand-rgb, 19, 152, 127), ${opacity})`
  } else {
    style.backgroundColor = `rgba(30, 41, 55, ${opacity})`
  }

  // Border
  if (props.borderWidth > 0) {
    style.border = `${props.borderWidth}px solid`
    if (props.borderColor) {
      style.borderColor = props.borderColor
    } else {
      style.borderColor = `rgba(255, 255, 255, ${props.borderOpacity})`
    }
  }

  // Rounded corners
  if (typeof props.rounded === 'boolean') {
    style.borderRadius = props.rounded ? '16px' : '0'
  } else {
    style.borderRadius = props.rounded
  }

  // Shadow
  const shadowMap = {
    none: 'none',
    sm: '0 2px 8px rgba(0, 0, 0, 0.1)',
    md: '0 8px 32px rgba(0, 0, 0, 0.15)',
    lg: '0 12px 48px rgba(0, 0, 0, 0.2)',
    xl: '0 20px 64px rgba(0, 0, 0, 0.25)'
  }
  style.boxShadow = shadowMap[props.shadow]

  return style
})

const handleClick = (event: MouseEvent) => {
  if (props.clickable) {
    emit('click', event)
  }
}
</script>

<style scoped lang="scss">
@import '@/styles/scss/global/variables.scss';

.glass-card {
  position: relative;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  // Light mode adjustments
  html:not([data-theme='dark']) & {
    background-color: rgba(255, 255, 255, 0.8) !important;
    border-color: rgba(255, 255, 255, 0.5) !important;
  }

  // Brand variant
  &.glass-card-brand {
    background-color: rgba(var(--hula-brand-rgb), 0.15);
    border-color: rgba(var(--hula-brand-rgb), 0.3);

    html:not([data-theme='dark']) & {
      background-color: rgba(var(--hula-brand-rgb), 0.08);
    }
  }

  // Hover effect
  &.glass-card-hover {
    cursor: pointer;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);

      html:not([data-theme='dark']) & {
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.1);
      }
    }
  }

  // Clickable effect
  &.glass-card-clickable {
    cursor: pointer;
    user-select: none;

    &:active {
      transform: translateY(0);
    }
  }

  // Strong variant
  &.glass-card-strong {
    html:not([data-theme='dark']) & {
      background-color: rgba(255, 255, 255, 0.95) !important;
    }

    [data-theme='dark'] & {
      background-color: rgba(30, 41, 55, 0.95) !important;
    }
  }

  // Subtle variant
  &.glass-card-subtle {
    html:not([data-theme='dark']) & {
      background-color: rgba(255, 255, 255, 0.5) !important;
    }

    [data-theme='dark'] & {
      background-color: rgba(30, 41, 55, 0.4) !important;
    }
  }
}

// Respect reduced motion
@media (prefers-reduced-motion: reduce) {
  .glass-card {
    transition: opacity 0.1s ease;

    &.glass-card-hover:hover {
      transform: none;
    }
  }
}
</style>
