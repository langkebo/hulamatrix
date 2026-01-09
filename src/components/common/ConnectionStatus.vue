<template>
  <div
    v-if="isVisible"
    class="connection-status"
    :class="[`connection-status--${displayState}`, { 'connection-status--clickable': clickable }]"
    :title="tooltip"
    @click="handleClick">
    <div class="connection-status__dot" :data-state="displayState"></div>
    <span class="connection-status__text">{{ userFriendlyText }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

// 定义状态类型
type ConnectionState = 'CONNECTED' | 'SYNCING' | 'DISCONNECTED' | 'CONNECTING' | 'ERROR'

interface Props {
  // WebSocket 连接状态
  wsState?: string | null
  // Matrix 同步状态
  matrixState?: string | null
  // 是否正在同步
  isSyncing?: boolean
  // 是否可点击（用于重试等操作）
  clickable?: boolean
  // 显示模式：'full' | 'mini' | 'minimal'
  mode?: 'full' | 'mini' | 'minimal'
}

const props = withDefaults(defineProps<Props>(), {
  wsState: null,
  matrixState: 'READY',
  isSyncing: false,
  clickable: false,
  mode: 'mini'
})

const emit = defineEmits<{
  click: [state: ConnectionState]
  retry: []
}>()

// 计算显示状态
const displayState = computed<ConnectionState>(() => {
  // 优先检查错误状态
  if (props.matrixState === 'ERROR') return 'ERROR'
  if (props.wsState === 'ERROR') return 'ERROR'

  // 检查同步状态
  if (props.isSyncing) return 'SYNCING'
  if (props.matrixState === 'SYNCING') return 'SYNCING'

  // 检查连接状态
  if (props.wsState === 'CONNECTED') return 'CONNECTED'
  if (props.wsState === 'CONNECTING') return 'CONNECTING'

  // 默认为断开连接
  return 'DISCONNECTED'
})

// 用户友好的文本
const userFriendlyText = computed(() => {
  switch (displayState.value) {
    case 'CONNECTED':
      return props.mode === 'full' ? '已连接' : ''
    case 'SYNCING':
      return '同步中...'
    case 'DISCONNECTED':
      return '连接断开'
    case 'CONNECTING':
      return '连接中...'
    case 'ERROR':
      return '连接错误'
    default:
      return ''
  }
})

// 工具提示（显示技术细节用于调试）
const tooltip = computed(() => {
  if (props.mode === 'minimal') return ''

  const ws = props.wsState || 'UNKNOWN'
  const matrix = props.matrixState || 'UNKNOWN'
  return `WebSocket: ${ws} | Matrix: ${matrix}`
})

// 是否可见（仅在非正常状态下显示）
const isVisible = computed(() => {
  return displayState.value !== 'CONNECTED' || props.mode === 'full'
})

// 处理点击
const handleClick = () => {
  if (!props.clickable) return

  emit('click', displayState.value)

  // 如果是错误状态，触发重试
  if (displayState.value === 'ERROR' || displayState.value === 'DISCONNECTED') {
    emit('retry')
  }
}
</script>

<style lang="scss" scoped>
.connection-status {
  position: fixed;
  right: 12px;
  bottom: 12px;
  z-index: 9999;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 10px;
  background: rgba(var(--hula-black-rgb), 0.75);
  backdrop-filter: blur(8px);
  color: var(--hula-white);
  font-size: 12px;
  line-height: 1;
  user-select: none;
  transition: all 0.3s ease;

  &__dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: var(--hula-gray-400);
    animation: pulse 2s ease-in-out infinite;

    &[data-state='SYNCING'] {
      background: var(--hula-brand-primary);
      animation: pulse 1s ease-in-out infinite;
    }

    &[data-state='DISCONNECTED'],
    &[data-state='ERROR'] {
      background: var(--hula-brand-primary);
      animation: none;
    }

    &[data-state='CONNECTED'] {
      background: var(--hula-brand-primary);
      animation: none;
    }

    &[data-state='CONNECTING'] {
      background: var(--hula-brand-primary);
      animation: pulse 1.5s ease-in-out infinite;
    }
  }

  &__text {
    font-weight: 500;
  }

  &--clickable {
    cursor: pointer;

    &:hover {
      background: rgba(var(--hula-black-rgb), 0.85);
      transform: scale(1.02);
    }

    &:active {
      transform: scale(0.98);
    }
  }

  // 迷你模式：只显示圆点
  &:has(.connection-status__text:empty) {
    padding: 6px;

    .connection-status__dot {
      width: 10px;
      height: 10px;
    }
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(0.95);
  }
}

// 深色模式适配
[data-theme='dark'] {
  .connection-status {
    background: rgba(var(--hula-gray-800-rgb), 0.9);

    &--clickable:hover {
      background: rgba(var(--hula-gray-800-rgb), 0.95);
    }
  }
}

// 移动端适配
@media (max-width: 768px) {
  .connection-status {
    right: 8px;
    bottom: 8px;
    padding: 4px 8px;
    font-size: 11px;

    &__dot {
      width: 6px;
      height: 6px;
    }
  }
}
</style>
