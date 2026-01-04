<template>
  <div
    class="h-message-wrapper"
    :class="[
      `h-message-wrapper--${position}`,
      { 'h-message-wrapper--selected': selected }
    ]"
    @click="handleClick"
  >
    <!-- 消息时间戳（悬停时显示） -->
    <div class="h-message-timestamp" v-if="showTimestamp">
      {{ formatTime(sendTime) }}
    </div>

    <!-- 消息状态指示器 -->
    <div class="h-message-status" v-if="status" :class="`h-message-status--${status}`">
      <component :is="statusIcon" />
      <span v-if="statusText">{{ statusText }}</span>
    </div>

    <!-- 消息气泡主体 -->
    <div
      class="h-message-bubble"
      :class="[
        `h-message-bubble--${position}`,
        { 'h-message-bubble--selected': selected },
        { 'h-message-bubble--loading': loading }
      ]"
      :style="{ maxWidth: customMaxWidth }"
    >
      <!-- 回复消息引用 -->
      <div v-if="replyMessage" class="h-message-reply">
        <div class="h-message-reply__content">
          <Icon class="h-message-reply__icon" :icon="replyIcon" />
          <div class="h-message-reply__text">
            {{ replyMessage.content }}
          </div>
        </div>
      </div>

      <!-- 消息内容插槽 -->
      <div class="h-message-content">
        <slot></slot>
      </div>

      <!-- 消息操作栏（悬停时显示） -->
      <div class="h-message-actions">
        <Tooltip v-for="action in actions" :key="action.key" :text="action.tooltip">
          <button
            class="h-message-action"
            @click="action.handler"
            :disabled="action.disabled"
          >
            <Icon :icon="action.icon" />
          </button>
        </Tooltip>
      </div>

      <!-- 加载中遮罩 -->
      <div v-if="loading" class="h-message-loading">
        <LoadingSpinner size="small" />
      </div>
    </div>

    <!-- 涟漪效果 -->
    <div ref="rippleEl" class="h-message-ripple"></div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import LoadingSpinner from './LoadingSpinner.vue'
import Tooltip from './Tooltip.vue'

// 定义props
interface Props {
  // 消息位置：left（他人）或 right（自己）
  position?: 'left' | 'right'
  // 是否被选中
  selected?: boolean
  // 消息状态
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed'
  // 状态文本
  statusText?: string
  // 发送时间
  sendTime: number
  // 是否显示时间戳
  showTimestamp?: boolean
  // 是否正在加载
  loading?: boolean
  // 自定义最大宽度
  customMaxWidth?: string
  // 回复消息
  replyMessage?: {
    id: string
    content: string
    sender: string
  }
  // 操作按钮
  actions?: Array<{
    key: string
    icon: string
    tooltip: string
    handler: () => void
    disabled?: boolean
  }>
  // 点击回调
  onClick?: () => void
}

const props = withDefaults(defineProps<Props>(), {
  position: 'left',
  selected: false,
  statusText: '',
  showTimestamp: false,
  loading: false,
  customMaxWidth: '',
  actions: () => []
})

// 状态管理
const emit = defineEmits<{
  click: []
}>()

// refs
const rippleEl = ref<HTMLElement>()

// 计算属性
const statusIcon = computed(() => {
  switch (props.status) {
    case 'sending':
      return 'material-symbols:hourglass-empty'
    case 'sent':
      return 'material-symbols:check'
    case 'delivered':
      return 'material-symbols:done-all'
    case 'read':
      return 'material-symbols:done-all'
    case 'failed':
      return 'material-symbols:error'
    default:
      return ''
  }
})

const replyIcon = 'material-symbols:reply'

// 方法
const formatTime = (timestamp: number) => {
  return formatDistanceToNow(new Date(timestamp), {
    addSuffix: true,
    locale: zhCN
  })
}

const handleClick = () => {
  props.onClick?.()
  createRipple()
}

// 创建涟漪效果
const createRipple = () => {
  if (!rippleEl.value) return

  const ripple = document.createElement('span')
  ripple.className = 'h-message-ripple-effect'
  rippleEl.value.appendChild(ripple)

  const rect = rippleEl.value.getBoundingClientRect()
  const size = Math.max(rect.width, rect.height)

  ripple.style.width = ripple.style.height = '0px'
  ripple.style.left = '50%'
  ripple.style.top = '50%'

  requestAnimationFrame(() => {
    ripple.style.width = ripple.style.height = `${size * 2}px`
    ripple.style.marginLeft = `-${size}px`
    ripple.style.marginTop = `-${size}px`
  })

  setTimeout(() => {
    ripple.style.opacity = '0'
    setTimeout(() => {
      if (rippleEl.value && ripple.contains(ripple)) {
        rippleEl.value.removeChild(ripple)
      }
    }, 600)
  })
}

// 监听props变化
watch(
  () => props.selected,
  (newVal) => {
    if (newVal) {
      // 选中时的处理
    }
  }
)
</script>

<style lang="scss" scoped>
@import '@/styles/scss/components/message-bubble.scss';

// 如果需要覆盖样式，可以在这里添加
</style>