<template>
  <div class="self-destruct-message" :class="{ 'is-destroying': remainingTime <= 5 }">
    <!-- 消息内容 -->
    <div class="message-content">
      <slot>
        <div class="content-text">{{ content }}</div>
      </slot>
    </div>

    <!-- 自毁倒计时 -->
    <div class="destruct-timer" v-if="showTimer">
      <div class="timer-icon">
        <Icon icon="mdi:timer" />
      </div>
      <div class="timer-text">
        {{ formatTime(remainingTime) }}
      </div>
      <div class="timer-progress" :style="{ width: `${progress}%` }"></div>
    </div>

    <!-- 自毁提示 -->
    <div class="destruct-hint" v-if="remainingTime <= 10">
      <Icon icon="mdi:alert-circle" />
      <span>消息即将自毁</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { usePrivateChatStore } from '@/stores/privateChat'

interface Props {
  messageId: string
  content: string
  destroyAt: number
  showTimer?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showTimer: true
})

const privateChatStore = usePrivateChatStore()

// 响应式数据
const remainingTime = ref(0)
const timerInterval = ref<NodeJS.Timeout | null>(null)

// 计算属性
const progress = computed(() => {
  const createdAt =
    privateChatStore.getSelfDestructingMessagesList().find((m) => m.id === props.messageId)?.createdAt || Date.now()
  const totalTime = props.destroyAt - createdAt
  const elapsed = totalTime - remainingTime.value
  return totalTime > 0 ? (elapsed / totalTime) * 100 : 100
})

// 方法
const formatTime = (milliseconds: number): string => {
  const seconds = Math.ceil(milliseconds / 1000)

  if (seconds < 60) {
    return `${seconds}秒`
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}分${remainingSeconds}秒` : `${minutes}分`
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  return remainingMinutes > 0 ? `${hours}时${remainingMinutes}分` : `${hours}时`
}

const updateRemainingTime = () => {
  const now = Date.now()
  const remaining = props.destroyAt - now

  if (remaining <= 0) {
    remainingTime.value = 0
    if (timerInterval.value) {
      clearInterval(timerInterval.value)
      timerInterval.value = null
    }
    // 触发自毁事件
    window.dispatchEvent(
      new CustomEvent('message-self-destructed', {
        detail: {
          messageId: props.messageId,
          eventId: props.messageId.split('_')[1] || ''
        }
      })
    )
  } else {
    remainingTime.value = remaining
  }
}

// 监听props变化
watch(
  () => props.destroyAt,
  () => {
    updateRemainingTime()
  }
)

// 生命周期
onMounted(() => {
  updateRemainingTime()
  // 每秒更新一次
  timerInterval.value = setInterval(updateRemainingTime, 1000)
})

onUnmounted(() => {
  if (timerInterval.value) {
    clearInterval(timerInterval.value)
  }
})
</script>

<style scoped lang="scss">
.self-destruct-message {
  position: relative;
  background: rgba(var(--hula-error-rgb), 0.05);
  border: 1px solid rgba(var(--hula-error-rgb), 0.2);
  border-radius: 8px;
  padding: 12px;
  margin: 4px 0;
  transition: all 0.3s ease;

  &.is-destroying {
    animation: pulse 1s infinite;
    background: rgba(var(--hula-error-rgb), 0.1);
    border-color: rgba(var(--hula-error-rgb), 0.4);
  }

  .message-content {
    margin-bottom: 8px;

    .content-text {
      color: var(--text-color-1);
      word-wrap: break-word;
    }
  }

  .destruct-timer {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: rgba(var(--hula-black-rgb), 0.05);
    border-radius: 6px;
    font-size: 12px;
    color: var(--text-color-2);

    .timer-icon {
      color: var(--hula-brand-primary);
    }

    .timer-text {
      font-weight: 500;
    }

    .timer-progress {
      position: absolute;
      bottom: 0;
      left: 0;
      height: 2px;
      background: var(--hula-brand-primary);
      border-radius: 0 0 6px 6px;
      transition: width 1s linear;
    }
  }

  .destruct-hint {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    padding: 6px 10px;
    background: rgba(var(--hula-error-rgb), 0.1);
    border-radius: 6px;
    font-size: 12px;
    color: var(--hula-brand-primary);
    animation: blink 1s infinite;
  }
}

@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
  100% {
    opacity: 1;
  }
}

@keyframes blink {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
  100% {
    opacity: 1;
  }
}

// 暗色主题适配
.dark {
  .self-destruct-message {
    background: rgba(var(--hula-error-rgb), 0.1);
    border-color: rgba(var(--hula-error-rgb), 0.3);

    &.is-destroying {
      background: rgba(var(--hula-error-rgb), 0.15);
      border-color: rgba(var(--hula-error-rgb), 0.5);
    }

    .destruct-timer {
      background: rgba(var(--hula-white-rgb), 0.05);
    }

    .destruct-hint {
      background: rgba(var(--hula-error-rgb), 0.2);
    }
  }
}
</style>
