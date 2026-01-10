<template>
  <div
    class="loading-spinner"
    :class="[`size-${size}`, `variant-${variant}`, { 'full-page': fullPage }]"
    role="status"
    :aria-label="ariaLabel"
    :aria-busy="true">
    <!-- Default circular spinner -->
    <template v-if="variant === 'circular'">
      <svg class="spinner-svg" viewBox="0 0 50 50">
        <circle
          class="spinner-circle"
          cx="25"
          cy="25"
          r="20"
          fill="none"
          :stroke="color"
          stroke-width="4"
          stroke-linecap="round"
          stroke-dasharray="90 30"
          stroke-dashoffset="0" />
      </svg>
    </template>

    <!-- Dots spinner -->
    <template v-else-if="variant === 'dots'">
      <div class="spinner-dots">
        <span class="spinner-dot" :style="{ backgroundColor: color }"></span>
        <span class="spinner-dot" :style="{ backgroundColor: color }"></span>
        <span class="spinner-dot" :style="{ backgroundColor: color }"></span>
      </div>
    </template>

    <!-- Bar spinner -->
    <template v-else-if="variant === 'bar'">
      <div class="spinner-bar">
        <div class="spinner-bar-progress" :style="{ backgroundColor: color }"></div>
      </div>
    </template>

    <!-- Pulse spinner -->
    <template v-else-if="variant === 'pulse'">
      <div class="spinner-pulse">
        <div class="spinner-pulse-dot" :style="{ backgroundColor: color }"></div>
      </div>
    </template>

    <!-- Custom content -->
    <slot />

    <!-- Loading text -->
    <span v-if="text" class="spinner-text">{{ text }}</span>
  </div>
</template>

<script setup lang="ts">
interface Props {
  variant?: 'circular' | 'dots' | 'bar' | 'pulse'
  size?: 'small' | 'medium' | 'large'
  color?: string
  text?: string
  fullPage?: boolean
  ariaLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'circular',
  size: 'medium',
  color: 'var(--color-primary, #1890ff)',
  ariaLabel: '加载中'
})
</script>

<style scoped lang="scss">
.loading-spinner {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;

  &.full-page {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 9999;
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(4px);
  }
}

.spinner-svg {
  display: block;

  .size-small & {
    width: 20px;
    height: 20px;
  }

  .size-medium & {
    width: 32px;
    height: 32px;
  }

  .size-large & {
    width: 48px;
    height: 48px;
  }
}

.spinner-circle {
  animation: spinner-rotate 1.5s linear infinite;
  transform-origin: center;
}

@keyframes spinner-rotate {
  0% {
    transform: rotate(0deg);
    stroke-dashoffset: 0;
  }
  50% {
    transform: rotate(180deg);
    stroke-dashoffset: -40;
  }
  100% {
    transform: rotate(360deg);
    stroke-dashoffset: 0;
  }
}

.spinner-dots {
  display: flex;
  gap: 6px;
  align-items: center;

  .size-small & {
    gap: 4px;
  }

  .size-large & {
    gap: 8px;
  }
}

.spinner-dot {
  border-radius: 50%;

  .size-small & {
    width: 6px;
    height: 6px;
  }

  .size-medium & {
    width: 8px;
    height: 8px;
  }

  .size-large & {
    width: 10px;
    height: 10px;
  }

  animation: spinner-bounce 1.4s ease-in-out infinite both;

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

@keyframes spinner-bounce {
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

.spinner-bar {
  width: 120px;
  height: 4px;
  background: var(--bg-color-3, #f0f0f0);
  border-radius: 2px;
  overflow: hidden;

  .size-small & {
    width: 80px;
    height: 3px;
  }

  .size-large & {
    width: 160px;
    height: 6px;
  }
}

.spinner-bar-progress {
  height: 100%;
  border-radius: 2px;
  animation: spinner-progress 1.5s ease-in-out infinite;
}

@keyframes spinner-progress {
  0% {
    width: 0%;
    margin-left: 0;
  }
  50% {
    width: 70%;
    margin-left: 15%;
  }
  100% {
    width: 0%;
    margin-left: 100%;
  }
}

.spinner-pulse {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;

  .size-small & {
    width: 20px;
    height: 20px;
  }

  .size-medium & {
    width: 32px;
    height: 32px;
  }

  .size-large & {
    width: 48px;
    height: 48px;
  }
}

.spinner-pulse-dot {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  animation: spinner-pulse 1.5s ease-in-out infinite;
}

.spinner-pulse::before,
.spinner-pulse::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 50%;
  background: inherit;
  animation: spinner-pulse-ring 1.5s ease-in-out infinite;
}

.spinner-pulse::after {
  animation-delay: 0.75s;
}

@keyframes spinner-pulse {
  0%,
  100% {
    transform: scale(0.6);
    opacity: 1;
  }
  50% {
    transform: scale(0.8);
    opacity: 0.8;
  }
}

@keyframes spinner-pulse-ring {
  0% {
    transform: scale(0.6);
    opacity: 0.6;
  }
  50% {
    transform: scale(1);
    opacity: 0;
  }
  100% {
    transform: scale(0.6);
    opacity: 0;
  }
}

.spinner-text {
  font-size: 14px;
  color: var(--text-color-2, #666);
  margin-top: 8px;

  .size-small & {
    font-size: 12px;
  }

  .size-large & {
    font-size: 16px;
  }
}

.loading-spinner.full-page {
  flex-direction: row;
  gap: 16px;

  .spinner-text {
    margin-top: 0;
    font-size: 16px;
    font-weight: 500;
    color: var(--text-color-1, #333);
  }

  @media (prefers-color-scheme: dark) {
    background: rgba(0, 0, 0, 0.8);

    .spinner-text {
      color: var(--text-color-1, #e0e0e0);
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .spinner-circle,
  .spinner-dot,
  .spinner-bar-progress,
  .spinner-pulse-dot,
  .spinner-pulse::before,
  .spinner-pulse::after {
    animation: none;
  }

  .spinner-circle {
    stroke-dasharray: 90 30;
    stroke-dashoffset: 0;
  }
}
</style>
