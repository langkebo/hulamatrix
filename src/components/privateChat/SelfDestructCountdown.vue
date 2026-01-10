<template>
  <div
    class="self-destruct-countdown"
    :class="countdownClass"
    role="timer"
    :aria-live="remainingSeconds <= 5 ? 'polite' : 'off'"
    :aria-label="$t('privatechat.self_destruct.countdown_aria', { seconds: remainingSeconds })">
    <!-- Glow effect ring -->
    <svg v-if="showGlow" class="countdown-glow" :width="size + 8" :height="size + 8" viewBox="0 0 40 40">
      <defs>
        <filter :id="`glow-${uniqueId}`" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur :stdDeviation="glowIntensity" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle
        cx="20"
        cy="20"
        r="16"
        :fill="glowColor"
        :filter="`url(#glow-${uniqueId})`"
        opacity="0.3" />
    </svg>

    <!-- 圆形进度条 -->
    <svg class="countdown-ring" :width="size" :height="size" viewBox="0 0 36 36">
      <!-- 背景圆 -->
      <circle
        class="countdown-ring-bg"
        cx="18"
        cy="18"
        r="15.9"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        opacity="0.2" />
      <!-- 进度圆 -->
      <circle
        class="countdown-ring-progress"
        cx="18"
        cy="18"
        r="15.9"
        fill="none"
        :stroke="strokeColor"
        stroke-width="3"
        stroke-linecap="round"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="strokeDashoffset"
        transform="rotate(-90 18 18)" />
    </svg>

    <!-- 剩余时间 -->
    <span class="countdown-text" :class="{ 'countdown-text-pulse': remainingSeconds <= 5 }">
      {{ remainingSeconds }}
    </span>

    <!-- Warning icon for low time -->
    <transition name="icon-fade">
      <svg v-if="remainingSeconds <= 5 && showWarningIcon" class="countdown-warning" :width="size / 2" :height="size / 2" viewBox="0 0 24 24">
        <path
          d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99zM11 16v2h2v-2h-2zm0-6v4h2v-4h-2z"
          fill="currentColor"
          stroke="none" />
      </svg>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

interface Props {
  destructAt: string // ISO8601 timestamp
  size?: number
  totalSeconds?: number // Total seconds from creation to destruct
  showGlow?: boolean
  showWarningIcon?: boolean
  animationType?: 'pulse' | 'shake' | 'burn' | 'fade'
}

const props = withDefaults(defineProps<Props>(), {
  size: 24,
  totalSeconds: 30, // Default 30 seconds
  showGlow: true,
  showWarningIcon: true,
  animationType: 'pulse'
})

const emit = defineEmits<{
  destruct: []
}>()

const { t } = useI18n()

const remainingSeconds = ref(0)
const circumference = 2 * Math.PI * 15.9
const uniqueId = ref(Math.random().toString(36).substring(2, 9))

let timer: number | null = null

// Calculate remaining time
const calculateRemaining = () => {
  const now = Date.now()
  const destructTime = new Date(props.destructAt).getTime()
  const remaining = Math.max(0, Math.floor((destructTime - now) / 1000))

  remainingSeconds.value = remaining

  // Trigger destruct event
  if (remaining === 0) {
    emit('destruct')
    stopTimer()
  }
}

// Progress offset
const strokeDashoffset = computed(() => {
  if (remainingSeconds.value <= 0 || props.totalSeconds <= 0) return circumference

  const progress = remainingSeconds.value / props.totalSeconds
  return circumference * (1 - progress)
})

// Stroke color
const strokeColor = computed(() => {
  if (remainingSeconds.value <= 5) return 'var(--color-error)'
  if (remainingSeconds.value <= 10) return 'var(--color-warning)'
  return 'var(--color-success)'
})

// Countdown class for styling
const countdownClass = computed(() => {
  const classes: string[] = []

  if (remainingSeconds.value <= 10) {
    classes.push('countdown-urgent')
  }

  if (remainingSeconds.value <= 5) {
    classes.push(`countdown-${props.animationType}`)
  }

  return classes.join(' ')
})

// Glow color matches stroke color
const glowColor = computed(() => strokeColor.value)

// Glow intensity increases as time runs out
const glowIntensity = computed(() => {
  if (remainingSeconds.value <= 3) return 4
  if (remainingSeconds.value <= 5) return 3
  if (remainingSeconds.value <= 10) return 2
  return 1
})

// Start timer
const startTimer = () => {
  calculateRemaining()
  timer = window.setInterval(calculateRemaining, 1000)
}

// Stop timer
const stopTimer = () => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

// Watch for changes in destructAt
watch(
  () => props.destructAt,
  () => {
    stopTimer()
    startTimer()
  }
)

onMounted(() => {
  startTimer()
})

onUnmounted(() => {
  stopTimer()
})
</script>

<style scoped lang="scss">
.self-destruct-countdown {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.countdown-glow {
  position: absolute;
  top: -4px;
  left: -4px;
  pointer-events: none;
  animation: glow-pulse 2s ease-in-out infinite;
}

.countdown-ring {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
}

.countdown-ring-progress {
  transition: stroke-dashoffset 1s linear, stroke 0.3s var(--ease-out-cubic);
}

.countdown-text {
  position: relative;
  z-index: 2;
  font-size: 10px;
  font-weight: 600;
  color: var(--text-color-1);
  transition: all 0.3s var(--ease-out-cubic);
}

.countdown-warning {
  position: absolute;
  bottom: -2px;
  right: -2px;
  z-index: 3;
  color: var(--color-error);
  animation: warning-bounce 0.5s ease-in-out infinite;
}

// Urgent state (<= 10 seconds)
.countdown-urgent {
  .countdown-text {
    font-weight: 700;
    font-size: 11px;
  }
}

// Text pulse animation (<= 5 seconds)
.countdown-text-pulse {
  animation: text-pulse 1s ease-in-out infinite;
}

// Animation types
.countdown-pulse {
  animation: component-pulse 1s ease-in-out infinite;
}

.countdown-shake {
  animation: shake 0.5s ease-in-out infinite;
}

.countdown-burn {
  animation: burn 1s ease-in-out infinite;
}

.countdown-fade {
  animation: fade 1.5s ease-in-out infinite;
}

// Keyframe animations
@keyframes glow-pulse {
  0%,
  100% {
    opacity: 0.3;
  }
  50% {
    opacity: 0.6;
  }
}

@keyframes text-pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(0.95);
  }
}

@keyframes warning-bounce {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-2px) scale(1.1);
  }
}

@keyframes component-pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }
  10%,
  30%,
  50%,
  70%,
  90% {
    transform: translateX(-2px);
  }
  20%,
  40%,
  60%,
  80% {
    transform: translateX(2px);
  }
}

@keyframes burn {
  0%,
  100% {
    filter: brightness(1);
  }
  50% {
    filter: brightness(1.3) drop-shadow(0 0 4px var(--color-error));
  }
}

@keyframes fade {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

// Icon fade transition
.icon-fade-enter-active,
.icon-fade-leave-active {
  transition: all 0.3s ease;
}

.icon-fade-enter-from,
.icon-fade-leave-to {
  opacity: 0;
  transform: scale(0.5);
}

.icon-fade-enter-to,
.icon-fade-leave-from {
  opacity: 1;
  transform: scale(1);
}
</style>
