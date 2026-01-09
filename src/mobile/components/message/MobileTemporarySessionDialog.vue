<!-- Mobile Temporary Session Dialog - Self-destruct timer for private chats -->
<template>
  <div class="mobile-temporary-session">
    <!-- Bottom Sheet Dialog -->
    <n-modal
      v-model:show="showDialog"
      :mask-closable="true"
      :style="{
        width: '100%',
        maxWidth: '100%',
        position: 'fixed',
        bottom: '0',
        margin: '0',
        borderRadius: '16px 16px 0 0'
      }"
      preset="card"
      @close="handleClose">
      <template #header>
        <div class="dialog-header">
          <h3>临时会话</h3>
          <n-button quaternary circle size="small" @click="handleClose">
            <template #icon>
              <n-icon><X /></n-icon>
            </template>
          </n-button>
        </div>
      </template>

      <!-- Content -->
      <div class="session-content">
        <!-- Info Section -->
        <div class="info-section">
          <n-alert type="info">
            <template #icon>
              <n-icon><InfoCircle /></n-icon>
            </template>
            设置消息自动销毁时间。时间到后，双方设备上的所有消息将被永久删除。
          </n-alert>
        </div>

        <!-- Timer Options -->
        <div class="timer-section">
          <div class="section-title">选择销毁时间</div>
          <div class="timer-grid">
            <div
              v-for="option in timerOptions"
              :key="option.value"
              class="timer-option"
              :class="{ active: selectedTimer === option.value }"
              @click="selectTimer(option.value)">
              <n-icon :size="24" :color="selectedTimer === option.value ? 'var(--hula-success)' : '#c0c0c0'">
                <component :is="option.icon" />
              </n-icon>
              <div class="timer-info">
                <span class="timer-label">{{ option.label }}</span>
                <span class="timer-desc">{{ option.desc }}</span>
              </div>
              <n-icon v-if="selectedTimer === option.value" :size="18" color="var(--hula-success)">
                <CircleCheck />
              </n-icon>
            </div>
          </div>
        </div>

        <!-- Custom Timer -->
        <div v-if="showCustomTimer" class="custom-timer-section">
          <div class="section-title">自定义时间</div>
          <div class="custom-timer-inputs">
            <n-input-number v-model:value="customValue" :min="1" :max="60" placeholder="数值" style="flex: 1" />
            <n-select v-model:value="customUnit" :options="timeUnits" style="width: 100px" />
          </div>
          <n-button secondary block @click="applyCustomTimer" style="margin-top: 8px">应用自定义时间</n-button>
        </div>

        <!-- Current Setting -->
        <div v-if="currentTimer" class="current-section">
          <div class="section-title">当前设置</div>
          <div class="current-timer-card">
            <n-icon :size="20" color="var(--hula-warning)">
              <Clock />
            </n-icon>
            <span class="current-timer-text">{{ formatTimerDisplay(currentTimer) }}</span>
          </div>
        </div>

        <!-- Warning -->
        <div class="warning-section">
          <n-alert type="warning" :closable="false">
            <template #icon>
              <n-icon><AlertTriangle /></n-icon>
            </template>
            消息一旦销毁将无法恢复。请确保已保存重要信息。
          </n-alert>
        </div>
      </div>

      <!-- Actions -->
      <template #footer>
        <div class="dialog-footer">
          <n-button size="large" @click="handleClear" :disabled="!currentTimer">清除设置</n-button>
          <n-button type="primary" size="large" @click="handleConfirm" :disabled="!selectedTimer">确认设置</n-button>
        </div>
      </template>
    </n-modal>

    <!-- Countdown Indicator (shown when active) -->
    <div v-if="showCountdown && remainingTime > 0" class="countdown-indicator" @click="showDialog = true">
      <n-icon :size="16" color="var(--hula-warning)">
        <Clock />
      </n-icon>
      <span class="countdown-text">{{ formatCountdown(remainingTime) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, type Component } from 'vue'
import { NModal, NButton, NIcon, NAlert, NInputNumber, NSelect, useMessage, useDialog } from 'naive-ui'
import {
  X,
  Clock,
  InfoCircle,
  AlertTriangle,
  CircleCheck,
  Flame,
  Trash,
  Hourglass,
  Clock as ClockIcon
} from '@vicons/tabler'
import { logger } from '@/utils/logger'

defineOptions({
  name: 'MobileTemporarySessionDialog'
})

interface TimerOption {
  value: number // seconds
  label: string
  desc: string
  icon: Component
}

interface Props {
  roomId?: string
  currentTimer?: number // current setting in seconds
  show?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  show: false
})

const emit = defineEmits<{
  (e: 'timer-set', seconds: number): void
  (e: 'timer-cleared'): void
  (e: 'close'): void
}>()

const message = useMessage()
const dialog = useDialog()

// State
const showDialog = ref(false)
const selectedTimer = ref<number | null>(null)
const showCustomTimer = ref(false)
const customValue = ref(1)
const customUnit = ref('minutes')
const remainingTime = ref(0) // remaining seconds
const showCountdown = ref(false)

// Timer options
const timerOptions: TimerOption[] = [
  {
    value: 30,
    label: '30秒',
    desc: '极短时间，适合敏感信息',
    icon: Flame
  },
  {
    value: 60,
    label: '1分钟',
    desc: '快速自动销毁',
    icon: ClockIcon
  },
  {
    value: 300,
    label: '5分钟',
    desc: '短期私密对话',
    icon: Hourglass
  },
  {
    value: 3600,
    label: '1小时',
    desc: '中等时长',
    icon: Clock
  },
  {
    value: 86400,
    label: '1天',
    desc: '长期私密对话',
    icon: Trash
  }
]

const timeUnits = [
  { label: '秒', value: 'seconds' },
  { label: '分钟', value: 'minutes' },
  { label: '小时', value: 'hours' }
]

// Methods
const selectTimer = (value: number) => {
  if (selectedTimer.value === value) {
    selectedTimer.value = null
    showCustomTimer.value = false
  } else {
    selectedTimer.value = value
    showCustomTimer.value = false
  }
}

const applyCustomTimer = () => {
  let seconds = customValue.value

  switch (customUnit.value) {
    case 'minutes':
      seconds *= 60
      break
    case 'hours':
      seconds *= 3600
      break
  }

  if (seconds < 10 || seconds > 604800) {
    message.warning('自定义时间必须在 10秒 到 7天 之间')
    return
  }

  selectedTimer.value = seconds
  showCustomTimer.value = false
}

const formatTimerDisplay = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds}秒`
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60)
    return `${minutes}分钟`
  } else if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return minutes > 0 ? `${hours}小时${minutes}分` : `${hours}小时`
  } else {
    const days = Math.floor(seconds / 86400)
    return `${days}天`
  }
}

const formatCountdown = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

const handleConfirm = () => {
  if (!selectedTimer.value) {
    message.warning('请选择销毁时间')
    return
  }

  dialog.info({
    title: '确认设置',
    content: `消息将在 ${formatTimerDisplay(selectedTimer.value)} 后自动销毁，此操作不可撤销。确定要继续吗？`,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: () => {
      emit('timer-set', selectedTimer.value!)
      message.success(`已设置消息在 ${formatTimerDisplay(selectedTimer.value!)} 后销毁`)
      showDialog.value = false

      // Start countdown simulation
      remainingTime.value = selectedTimer.value!
      showCountdown.value = true

      logger.info('[MobileTemporarySession] Timer set:', {
        roomId: props.roomId,
        seconds: selectedTimer.value
      })
    }
  })
}

const handleClear = () => {
  dialog.warning({
    title: '清除设置',
    content: '确定要清除自动销毁设置吗？消息将不再自动删除。',
    positiveText: '清除',
    negativeText: '取消',
    onPositiveClick: () => {
      selectedTimer.value = null
      emit('timer-cleared')
      message.info('已清除自动销毁设置')
      showDialog.value = false
      showCountdown.value = false

      logger.info('[MobileTemporarySession] Timer cleared:', {
        roomId: props.roomId
      })
    }
  })
}

const handleClose = () => {
  showDialog.value = false
  emit('close')
}

// Watch show prop
watch(
  () => props.show,
  (newValue) => {
    showDialog.value = newValue
    if (newValue && props.currentTimer) {
      selectedTimer.value = props.currentTimer
    }
  },
  { immediate: true }
)

// Expose methods
defineExpose({
  show: () => {
    showDialog.value = true
  },
  hide: () => {
    showDialog.value = false
  },
  setRemainingTime: (seconds: number) => {
    remainingTime.value = seconds
  }
})
</script>

<style scoped lang="scss">
.mobile-temporary-session {
  // Container
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-color-1);
  }
}

.session-content {
  padding: 16px 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-height: 60vh;
  overflow-y: auto;
}

.info-section {
  // Info alert styling
}

.timer-section {
  .section-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-color-2);
    margin-bottom: 12px;
  }

  .timer-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .timer-option {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    background: var(--bg-color);
    border-radius: 12px;
    border: 2px solid transparent;
    cursor: pointer;
    transition: all 0.2s;

    &.active {
      border-color: var(--primary-color);
      background: rgba(var(--hula-success-rgb), 0.05);
    }

    &:active {
      transform: scale(0.98);
    }

    .timer-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;

      .timer-label {
        font-size: 15px;
        font-weight: 500;
        color: var(--text-color-1);
      }

      .timer-desc {
        font-size: 12px;
        color: var(--text-color-3);
      }
    }
  }
}

.custom-timer-section {
  .section-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-color-2);
    margin-bottom: 12px;
  }

  .custom-timer-inputs {
    display: flex;
    gap: 8px;
  }
}

.current-section {
  .section-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-color-2);
    margin-bottom: 12px;
  }

  .current-timer-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    background: rgba(var(--hula-warning-rgb), 0.1);
    border-radius: 12px;

    .current-timer-text {
      font-size: 15px;
      font-weight: 500;
      color: var(--hula-warning);
    }
  }
}

.warning-section {
  // Warning styling
}

.dialog-footer {
  display: flex;
  gap: 8px;
}

.countdown-indicator {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: rgba(var(--hula-warning-rgb), 0.1);
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.2s;

  &:active {
    background: rgba(var(--hula-warning-rgb), 0.2);
  }

  .countdown-text {
    font-size: 12px;
    font-weight: 500;
    color: var(--hula-warning);
  }
}

// Safe area support
@supports (padding: env(safe-area-inset-bottom)) {
  .dialog-footer {
    padding-bottom: calc(env(safe-area-inset-bottom) + 8px);
  }
}
</style>
