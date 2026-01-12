<template>
  <div
    :class="['loading-state', `loading-state-${size}`, { 'loading-state-fullscreen': fullscreen }]"
    role="status"
    aria-live="polite">
    <span class="sr-only">{{ label || t('common.loading') }}</span>

    <!-- Spinner -->
    <div v-if="type === 'spinner'" class="loading-spinner">
      <svg class="spinner-svg" viewBox="0 0 50 50" :aria-hidden="true">
        <circle
          class="spinner-path"
          cx="25"
          cy="25"
          r="20"
          fill="none"
          :stroke="color"
          stroke-width="5"
          stroke-linecap="round"
          stroke-dasharray="80"
          stroke-dashoffset="60" />
      </svg>
    </div>

    <!-- Dots -->
    <div v-else-if="type === 'dots'" class="loading-dots">
      <div v-for="i in 3" :key="i" class="loading-dot" :style="{ backgroundColor: color }"></div>
    </div>

    <!-- Pulse -->
    <div v-else-if="type === 'pulse'" class="loading-pulse">
      <div class="pulse-ring" :style="{ borderColor: color }"></div>
      <div class="pulse-ring" :style="{ borderColor: color }"></div>
      <div class="pulse-ring" :style="{ borderColor: color }"></div>
    </div>

    <!-- Bar -->
    <div v-else-if="type === 'bar'" class="loading-bar">
      <div class="bar-track" :style="{ backgroundColor: trackColor }">
        <div class="bar-fill" :style="{ backgroundColor: color }"></div>
      </div>
    </div>

    <!-- Message -->
    <p v-if="message" class="loading-message">{{ message }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

interface Props {
  type?: 'spinner' | 'dots' | 'pulse' | 'bar'
  size?: 'sm' | 'md' | 'lg'
  message?: string
  color?: string
  fullscreen?: boolean
  label?: string
}

const props = withDefaults(defineProps<Props>(), {
  type: 'spinner',
  size: 'md',
  message: '',
  color: '',
  fullscreen: false,
  label: ''
})

const { t } = useI18n()

const color = computed(() => {
  return props.color || 'var(--hula-brand-primary, #13987F)'
})

const trackColor = computed(() => {
  return 'var(--hula-gray-200, #E5E7EB)'
})
</script>

<style scoped lang="scss">
@import '@/styles/scss/global/variables.scss';

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md, 12px);
  padding: var(--spacing-lg, 16px);

  &.loading-state-fullscreen {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 9999;
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(4px);

    html[data-theme='dark'] & {
      background: rgba(0, 0, 0, 0.8);
    }
  }

  /* Size variants */
  &.loading-state-sm {
    gap: var(--spacing-xs, 8px);

    .loading-message {
      font-size: var(--font-size-sm, 14px);
    }
  }

  &.loading-state-lg {
    gap: var(--spacing-lg, 16px);

    .loading-message {
      font-size: var(--font-size-lg, 18px);
    }
  }
}

/* Spinner */
.loading-spinner {
  display: flex;
  align-items: center;
  justify-content: center;
}

.spinner-svg {
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;

  .loading-state-sm & {
    width: 24px;
    height: 24px;
  }

  .loading-state-lg & {
    width: 56px;
    height: 56px;
  }
}

.spinner-path {
  animation: spinner-dash 1.5s ease-in-out infinite;
}

/* Dots */
.loading-dots {
  display: flex;
  gap: var(--spacing-xs, 6px);
  align-items: center;
}

.loading-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  animation: dot-bounce 1.4s ease-in-out infinite both;

  .loading-state-sm & {
    width: 6px;
    height: 6px;
  }

  .loading-state-lg & {
    width: 14px;
    height: 14px;
  }

  &:nth-child(1) {
    animation-delay: -0.32s;
  }

  &:nth-child(2) {
    animation-delay: -0.16s;
  }

  &:nth-child(3) {
    animation-delay: 0s;
  }
}

/* Pulse */
.loading-pulse {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pulse-ring {
  position: absolute;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 3px solid;
  animation: pulse-ring 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;

  .loading-state-sm & {
    width: 24px;
    height: 24px;
    border-width: 2px;
  }

  .loading-state-lg & {
    width: 56px;
    height: 56px;
    border-width: 4px;
  }

  &:nth-child(2) {
    animation-delay: 0.5s;
  }

  &:nth-child(3) {
    animation-delay: 1s;
  }
}

/* Bar */
.loading-bar {
  width: 200px;

  .loading-state-sm & {
    width: 120px;
  }

  .loading-state-lg & {
    width: 280px;
  }
}

.bar-track {
  width: 100%;
  height: 4px;
  border-radius: 2px;
  overflow: hidden;

  .loading-state-sm & {
    height: 3px;
  }

  .loading-state-lg & {
    height: 6px;
  }
}

.bar-fill {
  height: 100%;
  width: 40%;
  border-radius: 2px;
  animation: bar-slide 1.5s ease-in-out infinite;
}

/* Message */
.loading-message {
  margin: 0;
  color: var(--hula-text-secondary, #64748b);
  font-size: var(--font-size-base, 16px);
  text-align: center;
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

/* Animations */
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes spinner-dash {
  0% {
    stroke-dasharray: 1, 150;
    stroke-dashoffset: 0;
  }
  50% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -35;
  }
  100% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -124;
  }
}

@keyframes dot-bounce {
  0%,
  80%,
  100% {
    transform: scale(0.6);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes pulse-ring {
  0% {
    transform: scale(0.6);
    opacity: 1;
  }
  100% {
    transform: scale(1.3);
    opacity: 0;
  }
}

@keyframes bar-slide {
  0% {
    transform: translateX(-100%);
  }
  50% {
    transform: translateX(150%);
  }
  100% {
    transform: translateX(-100%);
  }
}

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  .spinner-svg,
  .spinner-path,
  .loading-dot,
  .pulse-ring,
  .bar-fill {
    animation: none !important;
  }

  .loading-dot,
  .pulse-ring {
    opacity: 1;
    transform: none;
  }

  .bar-fill {
    transform: none;
    width: 40%;
  }
}
</style>
