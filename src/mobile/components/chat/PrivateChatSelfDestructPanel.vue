<!-- 移动端私密聊天自毁消息设置面板 -->
<template>
  <div class="mobile-self-destruct-panel">
    <!-- 自毁消息开关 -->
    <div class="destruct-toggle-section">
      <div class="section-header">
        <n-icon :size="20">
          <Clock />
        </n-icon>
        <span class="header-title">自毁消息</span>
      </div>

      <div class="toggle-row">
        <span class="toggle-label">{{ isEnabled ? '已启用' : '未启用' }}</span>
        <n-switch v-model:value="isEnabled" :rail-style="railStyle" @update:value="handleToggleChange" />
      </div>
    </div>

    <!-- 自毁时间选择（当启用时显示） -->
    <transition name="slide-down">
      <div v-if="isEnabled" class="destruct-time-section">
        <div class="section-header">
          <n-icon :size="18">
            <Clock />
          </n-icon>
          <span class="header-title">自毁时间</span>
        </div>

        <!-- 时间选项网格 -->
        <div class="time-options-grid">
          <div
            v-for="option in timeOptions"
            :key="option.value"
            class="time-option"
            :class="{ 'is-selected': selectedTime === option.value }"
            @click="selectTime(option.value)">
            <div class="option-icon" :style="{ color: option.color }">
              <component :is="option.icon" />
            </div>
            <div class="option-content">
              <div class="option-label">{{ option.label }}</div>
              <div class="option-desc">{{ option.desc }}</div>
            </div>
            <div v-if="selectedTime === option.value" class="option-check">
              <n-icon :size="20" color="var(--hula-success)">
                <Check />
              </n-icon>
            </div>
          </div>
        </div>

        <!-- 自定义时间 -->
        <div class="custom-time-section">
          <div class="custom-time-header">
            <span>自定义时间</span>
            <n-switch v-model:value="useCustomTime" size="small" />
          </div>

          <div v-if="useCustomTime" class="custom-time-inputs">
            <n-input-number
              v-model:value="customTimeValue"
              :min="10"
              :max="604800"
              placeholder="秒数"
              size="small"
              class="time-input" />
            <n-select v-model:value="customTimeUnit" :options="timeUnits" size="small" class="unit-select" />
            <n-button type="primary" size="small" @click="applyCustomTime">应用</n-button>
          </div>

          <div class="time-preview">
            <span class="preview-label">预览：</span>
            <span class="preview-value">{{ formattedTime }}</span>
          </div>
        </div>
      </div>
    </transition>

    <!-- 安全提示 -->
    <div class="security-hint">
      <n-icon :size="16" color="var(--hula-warning)">
        <InfoCircle />
      </n-icon>
      <span>启用自毁消息后，消息将在设定时间后自动销毁</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { NIcon, NSwitch, NButton, NInputNumber, NSelect } from 'naive-ui'
import { Clock, Check, InfoCircle, Shield } from '@vicons/tabler'

const props = defineProps<{
  modelValue: {
    enabled: boolean
    time: number // 秒
  }
}>()

const emit = defineEmits<{
  'update:modelValue': [value: { enabled: boolean; time: number }]
  change: [value: { enabled: boolean; time: number }]
}>()

// 状态
const isEnabled = ref(props.modelValue.enabled)
const selectedTime = ref(props.modelValue.time)
const useCustomTime = ref(false)
const customTimeValue = ref(60)
const customTimeUnit = ref('seconds')

// 时间单位选项
const timeUnits = [
  { label: '秒', value: 'seconds' },
  { label: '分钟', value: 'minutes' },
  { label: '小时', value: 'hours' },
  { label: '天', value: 'days' }
]

// 预设时间选项
const timeOptions = computed(() => [
  {
    label: '30秒',
    desc: '快速自毁',
    value: 30,
    color: 'var(--hula-error)',
    icon: Clock
  },
  {
    label: '1分钟',
    desc: '短暂保留',
    value: 60,
    color: 'var(--hula-warning)',
    icon: Clock
  },
  {
    label: '5分钟',
    desc: '推荐设置',
    value: 300,
    color: 'var(--hula-warning)',
    icon: Clock
  },
  {
    label: '30分钟',
    desc: '较长保留',
    value: 1800,
    color: 'var(--hula-success)',
    icon: Clock
  },
  {
    label: '1小时',
    desc: '长时间保留',
    value: 3600,
    color: 'var(--hula-info)',
    icon: Clock
  },
  {
    label: '1天',
    desc: '24小时',
    value: 86400,
    color: '#8b5cf6',
    icon: Clock
  }
])

// 格式化显示时间
const formattedTime = computed(() => {
  const seconds = selectedTime.value

  if (seconds < 60) {
    return `${seconds}秒`
  }
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60)
    return `${mins}分钟`
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    return `${hours}小时${mins > 0 ? ` ${mins}分钟` : ''}`
  }
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  return `${days}天${hours > 0 ? ` ${hours}小时` : ''}`
})

// Switch 轨道样式
const railStyle = ({ checked }: { focused: boolean; checked: boolean }) => {
  return {
    backgroundColor: checked ? 'var(--hula-brand-primary)' : 'var(--hula-gray-300)'
  }
}

// 方法
const handleToggleChange = (_value: boolean) => {
  emitValue()
}

const selectTime = (time: number) => {
  selectedTime.value = time
  useCustomTime.value = false
  emitValue()
}

const applyCustomTime = () => {
  let seconds = customTimeValue.value

  switch (customTimeUnit.value) {
    case 'minutes':
      seconds *= 60
      break
    case 'hours':
      seconds *= 3600
      break
    case 'days':
      seconds *= 86400
      break
  }

  // 限制范围
  seconds = Math.max(10, Math.min(604800, seconds))

  selectedTime.value = seconds
  useCustomTime.value = false
  emitValue()
}

const emitValue = () => {
  const value = {
    enabled: isEnabled.value,
    time: selectedTime.value
  }
  emit('update:modelValue', value)
  emit('change', value)
}

// 监听 props 变化
watch(
  () => props.modelValue,
  (newValue) => {
    isEnabled.value = newValue.enabled
    selectedTime.value = newValue.time
  },
  { deep: true }
)
</script>

<style scoped lang="scss">
.mobile-self-destruct-panel {
  padding: 16px;
  background: var(--bg-color);
}

.destruct-toggle-section {
  margin-bottom: 16px;

  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;

    .header-title {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-color-1);
    }
  }

  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--card-color);
    border-radius: 12px;

    .toggle-label {
      font-size: 14px;
      color: var(--text-color-2);
    }
  }
}

.destruct-time-section {
  margin-bottom: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--divider-color);

  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;

    .header-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-color-2);
    }
  }

  .time-options-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    margin-bottom: 16px;

    .time-option {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px;
      background: var(--card-color);
      border-radius: 12px;
      border: 2px solid transparent;
      cursor: pointer;
      transition: all 0.2s ease;

      &:active {
        transform: scale(0.98);
      }

      &.is-selected {
        border-color: var(--hula-brand-primary);
        background: rgba(var(--hula-brand-rgb), 0.05);
      }

      .option-icon {
        font-size: 24px;
      }

      .option-content {
        flex: 1;
        min-width: 0;

        .option-label {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-color-1);
        }

        .option-desc {
          font-size: 11px;
          color: var(--text-color-3);
        }
      }

      .option-check {
        flex-shrink: 0;
      }
    }
  }

  .custom-time-section {
    padding: 16px;
    background: var(--card-color);
    border-radius: 12px;

    .custom-time-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      font-size: 14px;
      font-weight: 600;
      color: var(--text-color-1);
    }

    .custom-time-inputs {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;

      .time-input {
        flex: 1;
      }

      .unit-select {
        width: 100px;
      }
    }

    .time-preview {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      background: var(--bg-color);
      border-radius: 8px;
      font-size: 13px;

      .preview-label {
        color: var(--text-color-3);
      }

      .preview-value {
        font-weight: 600;
        color: var(--hula-brand-primary);
      }
    }
  }
}

.security-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: rgba(var(--hula-warning-rgb), 0.1);
  border-radius: 8px;
  font-size: 12px;
  color: var(--hula-warning);
}

// Slide down animation
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.slide-down-enter-from,
.slide-down-leave-to {
  max-height: 0;
  opacity: 0;
  margin-bottom: 0;
  padding-top: 0;
}

.slide-down-enter-to,
.slide-down-leave-from {
  max-height: 500px;
  opacity: 1;
}

// 小屏幕优化
@media (max-width: 480px) {
  .time-options-grid {
    grid-template-columns: 1fr !important;
  }
}
</style>
