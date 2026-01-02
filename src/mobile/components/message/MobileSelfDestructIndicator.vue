<!-- 移动端自毁消息指示器 -->
<template>
  <div class="mobile-self-destruct-indicator">
    <!-- 倒计时模式 -->
    <div v-if="mode === 'countdown'" class="countdown-mode">
      <div class="timer-ring" :class="{ 'is-warning': isWarning, 'is-critical': isCritical }">
        <svg class="ring-svg" viewBox="0 0 100 100">
          <circle
            class="ring-bg"
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            stroke-width="6"
            opacity="0.2"
          />
          <circle
            class="ring-progress"
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            stroke-width="6"
            :stroke-dasharray="circumference"
            :stroke-dashoffset="dashOffset"
            transform="rotate(-90 50 50)"
            :color="ringColor"
          />
        </svg>
        <div class="timer-content">
          <n-icon :size="18" :color="ringColor">
            <Clock />
          </n-icon>
          <span class="timer-text" :style="{ color: ringColor }">
            {{ formattedTime }}
          </span>
        </div>
      </div>
    </div>

    <!-- 图标模式 -->
    <div v-else-if="mode === 'icon'" class="icon-mode">
      <div class="destruct-icon" :class="{ 'is-pulsing': isPulsing }">
        <n-icon :size="16" :color="iconColor">
          <Clock />
        </n-icon>
      </div>
      <span v-if="showText" class="destruct-text" :style="{ color: iconColor }">
        {{ formattedShortTime }}
      </span>
    </div>

    <!-- 徽章模式 -->
    <div v-else-if="mode === 'badge'" class="badge-mode">
      <div class="destruct-badge" :class="{ 'is-warning': isWarning, 'is-critical': isCritical }">
        <n-icon :size="12" color="white">
          <Clock />
        </n-icon>
        <span class="badge-text">{{ formattedShortTime }}</span>
      </div>
    </div>

    <!-- 条纹模式 -->
    <div v-else-if="mode === 'strip'" class="strip-mode">
      <div
        class="destruct-strip"
        :class="{ 'is-warning': isWarning, 'is-critical': isCritical }"
        :style="{ width: progress + '%' }"
      >
        <n-icon :size="14" color="white">
          <Clock />
        </n-icon>
      </div>
    </div>

    <!-- 销毁动画 -->
    <transition name="destroy-fade">
      <div v-if="isDestroyed" class="destroyed-overlay">
        <n-icon :size="32" color="#d03050">
          <Trash />
        </n-icon>
        <span class="destroyed-text">已销毁</span>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { NIcon } from 'naive-ui'
import { Clock, Trash } from '@vicons/tabler'

interface Props {
  destroyAt: number // 销毁时间戳
  createdAt?: number // 创建时间戳
  mode?: 'countdown' | 'icon' | 'badge' | 'strip'
  showText?: boolean
  autoUpdate?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  createdAt: Date.now(),
  mode: 'icon',
  showText: false,
  autoUpdate: true
})

const emit = defineEmits<{
  destroyed: []
}>()

// 状态
const remainingTime = ref(0)
const isDestroyed = ref(false)
const isPulsing = ref(false)
let updateTimer: number | null = null

// 计算属性
const circumference = 2 * Math.PI * 45 // r=45

const totalDuration = computed(() => props.destroyAt - props.createdAt)

const progress = computed(() => {
  if (totalDuration.value <= 0) return 0
  return (remainingTime.value / totalDuration.value) * 100
})

const dashOffset = computed(() => {
  return circumference - (progress.value / 100) * circumference
})

const remainingSeconds = computed(() => {
  return Math.max(0, Math.floor(remainingTime.value / 1000))
})

const isWarning = computed(() => {
  return remainingSeconds.value <= 60 && remainingSeconds.value > 10
})

const isCritical = computed(() => {
  return remainingSeconds.value <= 10
})

const ringColor = computed(() => {
  if (isCritical.value) return '#d03050'
  if (isWarning.value) return '#f0a020'
  return '#18a058'
})

const iconColor = computed(() => {
  if (isCritical.value) return '#d03050'
  if (isWarning.value) return '#f0a020'
  return '#13987f'
})

const formattedTime = computed(() => {
  const seconds = remainingSeconds.value

  if (seconds < 60) {
    return `${seconds}s`
  }

  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60

  if (minutes < 60) {
    return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`
  }

  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
})

const formattedShortTime = computed(() => {
  const seconds = remainingSeconds.value

  if (seconds < 60) {
    return `${seconds}s`
  }

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return `${minutes}m`
  }

  const hours = Math.floor(minutes / 60)
  return `${hours}h`
})

// 方法
const updateRemainingTime = () => {
  const now = Date.now()
  const remaining = props.destroyAt - now

  if (remaining <= 0) {
    remainingTime.value = 0
    isDestroyed.value = true
    emit('destroyed')
    stopUpdating()
  } else {
    remainingTime.value = remaining

    // 当剩余时间少于10秒时，启用脉冲动画
    isPulsing.value = remainingSeconds.value <= 10
  }
}

const startUpdating = () => {
  if (!props.autoUpdate) return

  updateRemainingTime()

  // 更新频率根据剩余时间动态调整
  const updateInterval = () => {
    if (isDestroyed.value) return

    const seconds = remainingSeconds.value

    if (seconds <= 10) {
      // 最后10秒，每100ms更新一次
      return 100
    } else if (seconds <= 60) {
      // 最后1分钟，每500ms更新一次
      return 500
    } else {
      // 正常每秒更新一次
      return 1000
    }
  }

  const tick = () => {
    updateRemainingTime()
    if (!isDestroyed.value) {
      updateTimer = window.setTimeout(tick, updateInterval())
    }
  }

  tick()
}

const stopUpdating = () => {
  if (updateTimer !== null) {
    clearTimeout(updateTimer)
    updateTimer = null
  }
}

// 生命周期
onMounted(() => {
  startUpdating()
})

onUnmounted(() => {
  stopUpdating()
})

// 监听 props 变化
watch(
  () => props.destroyAt,
  () => {
    stopUpdating()
    isDestroyed.value = false
    isPulsing.value = false
    startUpdating()
  }
)
</script>

<style scoped lang="scss">
.mobile-self-destruct-indicator {
  position: relative;
  display: inline-flex;
  align-items: center;
}

// 倒计时模式
.countdown-mode {
  .timer-ring {
    position: relative;
    width: 48px;
    height: 48px;

    .ring-svg {
      width: 100%;
      height: 100%;
      transform: rotate(-90deg);
    }

    .ring-bg,
    .ring-progress {
      transition: stroke-dashoffset 0.3s ease;
    }

    .timer-content {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;

      .timer-text {
        font-size: 12px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
      }
    }

    &.is-warning {
      .ring-progress {
        color: #f0a020;
      }
    }

    &.is-critical {
      .ring-progress {
        color: #d03050;
        animation: ring-pulse 0.5s ease-in-out infinite;
      }
    }
  }
}

// 图标模式
.icon-mode {
  display: flex;
  align-items: center;
  gap: 6px;

  .destruct-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: rgba(19, 152, 127, 0.1);
    border-radius: 50%;

    &.is-pulsing {
      animation: icon-pulse 1s ease-in-out infinite;
    }
  }

  .destruct-text {
    font-size: 12px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
}

// 徽章模式
.badge-mode {
  .destruct-badge {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    background: #18a058;
    color: white;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;

    &.is-warning {
      background: #f0a020;
    }

    &.is-critical {
      background: #d03050;
      animation: badge-pulse 0.5s ease-in-out infinite;
    }

    .badge-text {
      font-variant-numeric: tabular-nums;
    }
  }
}

// 条纹模式
.strip-mode {
  position: relative;
  width: 100%;
  height: 4px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
  overflow: hidden;

  .destruct-strip {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    background: #18a058;
    border-radius: 2px;
    transition: width 0.3s ease, background-color 0.3s ease;

    &.is-warning {
      background: #f0a020;
    }

    &.is-critical {
      background: #d03050;
    }
  }
}

// 销毁动画
.destroyed-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;

  .destroyed-text {
    font-size: 14px;
    font-weight: 600;
    color: #d03050;
  }
}

// 动画
@keyframes ring-pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

@keyframes icon-pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

@keyframes badge-pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

.destroy-fade-enter-active {
  transition: all 0.5s ease;
}

.destroy-fade-leave-active {
  transition: all 0.3s ease;
}

.destroy-fade-enter-from {
  opacity: 0;
  transform: scale(0.8);
}

.destroy-fade-leave-to {
  opacity: 0;
  transform: scale(0.5);
}
</style>
