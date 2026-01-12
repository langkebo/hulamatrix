<template>
  <div
    :class="['skeleton', `skeleton-${variant}`, { 'skeleton-animated': animate }, { 'skeleton-circle': circle }]"
    :style="skeletonStyle"
    role="status"
    :aria-label="label || t('common.loading')">
    <!-- Screen reader only text -->
    <span class="sr-only">{{ label || t('common.loading') }}</span>

    <!-- For multi-line variant -->
    <template v-if="variant === 'text' && lines > 1">
      <div
        v-for="i in lines"
        :key="i"
        :class="['skeleton-line', { 'skeleton-line-last': i === lines }]"
        :style="{ width: i === lines ? '80%' : '100%' }"></div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

interface Props {
  variant?: 'text' | 'rectangular' | 'circular' | 'text'
  width?: string | number
  height?: string | number
  circle?: boolean
  animate?: boolean
  label?: string
  lines?: number
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'text',
  width: '100%',
  height: '1em',
  circle: false,
  animate: true,
  label: '',
  lines: 1
})

const { t } = useI18n()

const skeletonStyle = computed(() => {
  const style: Record<string, string> = {}

  // Handle width
  if (typeof props.width === 'number') {
    style.width = `${props.width}px`
  } else if (props.width !== '100%') {
    style.width = props.width
  }

  // Handle height
  if (typeof props.height === 'number') {
    style.height = `${props.height}px`
  } else if (props.height !== '1em') {
    style.height = props.height
  }

  return style
})
</script>

<style scoped lang="scss">
@import '@/styles/scss/global/variables.scss';

/* Base skeleton styles */
.skeleton {
  position: relative;
  display: inline-block;
  background: linear-gradient(
    90deg,
    var(--hula-skeleton-base, #f1f5f9) 25%,
    var(--hula-skeleton-highlight, #e2e8f0) 50%,
    var(--hula-skeleton-base, #f1f5f9) 75%
  );
  background-size: 200% 100%;
  border-radius: var(--radius-sm, 4px);
  overflow: hidden;

  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.4) 50%, transparent 100%);
    transform: translateX(-100%);
  }
}

/* Animated variant */
.skeleton-animated {
  &::after {
    animation: skeleton-shimmer 1.5s infinite;
  }
}

/* Text variant */
.skeleton-text {
  min-height: 1em;
  border-radius: var(--radius-sm, 4px);
}

/* Rectangular variant */
.skeleton-rectangular {
  border-radius: var(--radius-sm, 4px);
}

/* Circular variant */
.skeleton-circular,
.skeleton-circle {
  border-radius: 50%;
}

/* Multi-line text */
.skeleton-line {
  height: 1em;
  margin-bottom: 0.5em;
  background: inherit;
  border-radius: var(--radius-sm, 4px);

  &:last-child {
    margin-bottom: 0;
  }
}

/* Screen reader only */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Shimmer animation */
@keyframes skeleton-shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

/* Respect reduced motion preference */
@media (prefers-reduced-motion: reduce) {
  .skeleton-animated::after {
    animation: none;
  }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .skeleton {
    background: linear-gradient(
      90deg,
      var(--hula-gray-700, #374151) 25%,
      var(--hula-gray-600, #4b5563) 50%,
      var(--hula-gray-700, #374151) 75%
    );
    background-size: 200% 100%;

    &::after {
      background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%);
    }
  }
}

/* HTML[data-theme='dark'] support (explicit dark mode) */
html[data-theme='dark'] .skeleton {
  background: linear-gradient(
    90deg,
    var(--hula-gray-700, #374151) 25%,
    var(--hula-gray-600, #4b5563) 50%,
    var(--hula-gray-700, #374151) 75%
  );
  background-size: 200% 100%;

  &::after {
    background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%);
  }
}
</style>
