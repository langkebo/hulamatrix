<template>
  <div
    class="self-destruct-countdown"
    :class="{ 'countdown-urgent': remainingSeconds <= 10 }"
    role="timer"
    :aria-live="remainingSeconds <= 5 ? 'polite' : 'off'"
    :aria-label="$t('privatechat.self_destruct.countdown_aria', { seconds: remainingSeconds })">
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
    <span class="countdown-text">{{ remainingSeconds }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

interface Props {
  destructAt: string // ISO8601 timestamp
  size?: number
  totalSeconds?: number // Total seconds from creation to destruct
}

const props = withDefaults(defineProps<Props>(), {
  size: 24,
  totalSeconds: 30 // Default 30 seconds
})

const emit = defineEmits<{
  destruct: []
}>()

const { t } = useI18n()

const remainingSeconds = ref(0)
const circumference = 2 * Math.PI * 15.9

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

.countdown-ring {
  position: absolute;
  top: 0;
  left: 0;
}

.countdown-ring-progress {
  transition:
    stroke-dashoffset 1s linear,
    stroke 0.3s var(--ease-out-cubic);
}

.countdown-text {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-color-1);
}

.countdown-urgent .countdown-text {
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
