<template>
  <div
    ref="messageRef"
    class="self-destructing-message-wrapper"
    :class="{ destroying: isDestroying, warning: isWarningState, compact: compactMode }"
    :data-message-id="messageId">
    <!-- 自毁倒计时显示 -->
    <div
      v-if="showCountdown && remainingTime > 0"
      class="self-destruct-indicator"
      :class="{ 'indicator-compact': compactMode }">
      <div class="countdown-circle" :style="countdownStyle">
        <Icon icon="mdi:timer-sand" class="timer-icon" :class="{ 'animate-pulse': remainingTime <= warningTime }" />
        <span class="countdown-text">{{ formatTime(remainingTime) }}</span>
      </div>
      <div class="countdown-label" v-if="!compactMode">{{ t('message.selfDestruct.willDestroy') }}</div>
    </div>

    <!-- 警告状态显示 -->
    <Transition name="fade">
      <div v-if="isWarningState && !compactMode" class="warning-indicator">
        <Icon icon="mdi:alert" class="warning-icon animate-bounce" />
        <span>{{ t('message.selfDestruct.aboutToDestroy') }}</span>
      </div>
    </Transition>

    <!-- 消息内容插槽 -->
    <div class="message-content" :class="{ blinking: isBlinking }">
      <slot />
    </div>

    <!-- 自毁动画 -->
    <Transition name="destroy">
      <div v-if="isDestroying" class="destroy-animation">
        <div class="particles">
          <div
            v-for="i in 12"
            :key="i"
            class="particle"
            :style="{
              transform: `rotate(${i * 30}deg) translateX(20px)`,
              '--rotation': `${i * 30}deg`
            }" />
        </div>
        <div class="shrink-effect" />
      </div>
    </Transition>

    <!-- 状态指示器 -->
    <div class="status-indicator" v-if="showEncryptionIndicator">
      <n-tooltip trigger="hover" placement="top">
        <template #trigger>
          <Icon icon="mdi:lock" class="private-icon" />
        </template>
        {{ t('message.selfDestruct.privateMessage') }}
      </n-tooltip>
    </div>

    <!-- 已销毁提示 -->
    <Transition name="fade">
      <div v-if="isDestroyed" class="destroyed-indicator">
        <Icon icon="mdi:check-circle" class="destroyed-icon" />
        <span>{{ t('message.selfDestruct.messageDestroyed') }}</span>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
//
import { msg } from '@/utils/SafeUI'

interface Props {
  messageId: string
  roomId: string
  eventId: string
  destroyAfterMs?: number
  showCountdown?: boolean
  showWarning?: boolean
  warningTime?: number // 警告时间（毫秒）
  compactMode?: boolean // 紧凑模式
  showEncryptionIndicator?: boolean // 显示加密指示器
}

const props = withDefaults(defineProps<Props>(), {
  destroyAfterMs: 300000, // 默认5分钟
  showCountdown: true,
  showWarning: true,
  warningTime: 10000, // 提前10秒警告
  compactMode: false,
  showEncryptionIndicator: true
})

const emit = defineEmits<{
  selfDestruct: [messageId: string]
  selfDestructStart: [messageId: string]
  countdownUpdate: [messageId: string, remainingTime: number]
}>()

const { t } = useI18n()
//

// 响应式数据
const messageRef = ref<HTMLElement>()
const remainingTime = ref(props.destroyAfterMs)
const isDestroying = ref(false)
const isWarningState = ref(false)
const isBlinking = ref(false)
const isDestroyed = ref(false)
const intervalId = ref<ReturnType<typeof setInterval> | null>(null)

// 计算属性
const countdownStyle = computed(() => {
  const percentage = Math.max(0, remainingTime.value / props.destroyAfterMs)
  const hue = percentage > 0.3 ? '120' : percentage > 0.1 ? '60' : '0' // 绿->黄->红
  return {
    background: `conic-gradient(hsl(${hue}, 70%, 50%) ${percentage * 360}deg, rgba(var(--hula-white-rgb), 0.2) ${percentage * 360}deg)`
  }
})

// 格式化时间显示
const formatTime = (ms: number): string => {
  const seconds = Math.ceil(ms / 1000)
  if (seconds < 60) return `${seconds}${t('message.selfDestruct.seconds')}`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}${t('message.selfDestruct.minutes')}`
  return `${Math.floor(seconds / 3600)}${t('message.selfDestruct.hours')}`
}

// 开始倒计时
const startCountdown = () => {
  if (intervalId.value) return

  intervalId.value = setInterval(() => {
    const now = Date.now()
    const elapsed = now - startTime
    const newRemaining = Math.max(0, props.destroyAfterMs - elapsed)

    remainingTime.value = newRemaining

    // 发送倒计时更新事件
    emit('countdownUpdate', props.messageId, newRemaining)

    // 检查是否进入警告状态
    if (props.showWarning && newRemaining <= props.warningTime && !isWarningState.value) {
      isWarningState.value = true
      isBlinking.value = true
      msg.warning(t('message.selfDestruct.warningMessage'))
    }

    // 开始自毁动画（最后3秒）
    if (newRemaining <= 3000 && newRemaining > 0 && !isDestroying.value) {
      isDestroying.value = true
      emit('selfDestructStart', props.messageId)
      isBlinking.value = true
    }

    // 触发自毁
    if (newRemaining <= 0) {
      destroyMessage()
    }
  }, 1000) // 每秒更新一次
}

// 记录开始时间
const startTime = Date.now()

// 销毁消息
const destroyMessage = () => {
  if (intervalId.value) {
    clearInterval(intervalId.value)
    intervalId.value = null
  }

  isDestroyed.value = true
  emit('selfDestruct', props.messageId)

  // 300ms后移除DOM元素
  setTimeout(() => {
    const element = document.querySelector(`[data-message-id="${props.messageId}"]`)
    if (element) {
      element.remove()
    }
  }, 300)
}

// 获取存储中的剩余时间
const getStoredRemainingTime = () => {
  const timers = JSON.parse(localStorage.getItem('hula_self_destruct_timers') || '{}')
  const timer = timers[`${props.roomId}_${props.eventId}`]
  if (timer && timer.destroyTime) {
    return Math.max(0, timer.destroyTime - Date.now())
  }
  return props.destroyAfterMs
}

// 重置定时器
const resetTimer = () => {
  remainingTime.value = props.destroyAfterMs
  isDestroying.value = false
  isWarningState.value = false
  isBlinking.value = false

  if (intervalId.value) {
    clearInterval(intervalId.value)
    intervalId.value = null
  }

  startCountdown()
}

// 监听剩余时间变化，更新状态
watch(remainingTime, (newTime) => {
  if (newTime <= 0) {
    isDestroying.value = true
    isBlinking.value = true
  } else if (newTime <= props.warningTime) {
    isWarningState.value = true
    if (newTime <= 3000) {
      isBlinking.value = true
    }
  }
})

onMounted(() => {
  // 从存储中获取剩余时间
  const storedTime = getStoredRemainingTime()
  remainingTime.value = storedTime

  // 如果消息还没过期，开始倒计时
  if (storedTime > 0) {
    startCountdown()
  } else {
    // 消息已过期，直接销毁
    destroyMessage()
  }
})

onUnmounted(() => {
  if (intervalId.value) {
    clearInterval(intervalId.value)
    intervalId.value = null
  }
})

// 暴露方法给父组件
defineExpose({
  resetTimer,
  destroyMessage,
  getRemainingTime: () => remainingTime.value
})
</script>

<style scoped lang="scss">
.self-destructing-message-wrapper {
  position: relative;
  display: inline-block;
  max-width: 100%;
  transition: all 0.3s ease;

  &.destroying {
    opacity: 0;
    transform: scale(0.8);
  }

  &.warning {
    animation: warningPulse 2s infinite;
  }
}

.message-content {
  position: relative;
  z-index: 2;

  &.blinking {
    animation: blink 1s infinite;
  }
}

.self-destruct-indicator {
  position: absolute;
  top: -45px;
  right: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  z-index: 3;

  .countdown-circle {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    background: rgba(var(--hula-white-rgb), 0.9);
    box-shadow: 0 2px 8px rgba(var(--hula-black-rgb), 0.15);

    &::before {
      content: '';
      position: absolute;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: white;
      z-index: 0;
    }

    .timer-icon {
      font-size: 12px;
      color: var(--hula-gray-700);
      z-index: 1;
      margin-bottom: 2px;
    }

    .countdown-text {
      font-size: 10px;
      font-weight: 600;
      color: var(--hula-gray-900);
      z-index: 1;
      line-height: 1;
    }
  }

  .countdown-label {
    font-size: 10px;
    color: var(--hula-brand-primary);
    white-space: nowrap;
    font-weight: 500;
    background: rgba(var(--hula-white-rgb), 0.9);
    padding: 2px 6px;
    border-radius: 10px;
    box-shadow: 0 1px 3px rgba(var(--hula-black-rgb), 0.1);
  }
}

.warning-indicator {
  position: absolute;
  top: -25px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(var(--hula-error-rgb), 0.9);
  color: white;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  z-index: 3;

  .warning-icon {
    font-size: 12px;
  }
}

.status-indicator {
  position: absolute;
  bottom: 4px;
  right: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
  z-index: 2;

  .private-icon {
    font-size: 12px;
    color: rgba(var(--hula-brand-rgb), 0.8);
  }
}

.destroy-animation {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 10;

  .particles {
    position: relative;
    width: 40px;
    height: 40px;

    .particle {
      position: absolute;
      width: 4px;
      height: 4px;
      background: var(--hula-brand-primary);
      border-radius: 50%;
      top: 50%;
      left: 50%;
      transform-origin: center;
      opacity: 0.8;
    }
  }

  .shrink-effect {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 100%;
    height: 100%;
    border: 2px solid var(--hula-brand-primary);
    border-radius: 8px;
    animation: shrink 0.3s ease-out forwards;
  }
}

// 动画
@keyframes warningPulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(var(--hula-error-rgb), 0.4);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(var(--hula-error-rgb), 0);
  }
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@keyframes particleFly {
  0% {
    transform: rotate(var(--rotation)) translateX(0) scale(1);
    opacity: 1;
  }
  100% {
    transform: rotate(var(--rotation)) translateX(40px) scale(0);
    opacity: 0;
  }
}

@keyframes shrink {
  0% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(0);
    opacity: 0;
  }
}

// Transition 动画
.destroy-enter-active,
.destroy-leave-active {
  transition: all 0.3s ease;
}

.destroy-enter-from,
.destroy-leave-to {
  opacity: 0;
  transform: scale(0.5);
}

.destroy-enter-active .particle,
.destroy-leave-active .particle {
  animation: particleFly 1s ease-out forwards;
}

// 紧凑模式样式
.self-destructing-message-wrapper.compact {
  .self-destruct-indicator {
    top: -30px;

    .countdown-circle {
      width: 24px;
      height: 24px;

      &::before {
        width: 20px;
        height: 20px;
      }

      .timer-icon {
        font-size: 10px;
        margin-bottom: 0;
      }

      .countdown-text {
        font-size: 8px;
      }
    }
  }

  &.indicator-compact {
    top: -24px;
  }
}

// 已销毁指示器样式
.destroyed-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(var(--hula-black-rgb), 0.7);
  color: white;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
  z-index: 10;

  .destroyed-icon {
    font-size: 16px;
    color: var(--hula-brand-primary);
  }
}

// Fade transition
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
