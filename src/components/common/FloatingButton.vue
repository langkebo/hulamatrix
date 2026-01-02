<template>
  <div :class="fabClasses" :style="fabStyles">
    <transition-group name="fab-transition" tag="div" class="h-fab__actions">
      <!-- 展开的迷你按钮 -->
      <template v-if="expanded && actions.length > 0">
        <button
          v-for="(action, index) in actions"
          :key="action.key"
          :class="['h-fab__mini-btn', `h-fab__mini-btn--${action.variant || 'secondary'}`]"
          :style="getActionStyle(index)"
          @click="handleActionClick(action)"
          v-bind="action.attrs"
        >
          <Tooltip :text="action.tooltip" :placement="tooltipPlacement">
            <component :is="action.icon" v-if="typeof action.icon === 'object'" />
            <span v-else-if="action.text" class="h-fab__mini-btn-text">{{ action.text }}</span>
          </Tooltip>
        </button>
      </template>
    </transition-group>

    <!-- 主按钮 -->
    <button
      ref="mainButton"
      :class="mainButtonClasses"
      :disabled="disabled"
      @click="handleMainClick"
      v-bind="$attrs"
    >
      <!-- 主图标 -->
      <transition name="fab-icon-transition" mode="out-in">
        <component :is="expanded ? closeIcon : icon" :key="expanded ? 'close' : 'icon'" />
      </transition>

      <!-- 涟漪效果 -->
      <span ref="rippleContainer" class="h-fab__ripple-container"></span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef, type StyleValue, type Component } from 'vue'
import Tooltip from './Tooltip.vue'

/** 图标类型：可以是组件、字符串或其他 */
type IconType = Component | string | { render?: () => unknown; [key: string]: unknown }

interface Action {
  key: string
  icon?: IconType
  text?: string
  tooltip: string
  variant?: 'primary' | 'secondary' | 'danger' | 'warning' | 'success'
  handler: () => void
  attrs?: Record<string, unknown>
}

interface Props {
  // 主按钮配置
  icon: IconType
  closeIcon?: IconType
  size?: 'small' | 'medium' | 'large'
  variant?: 'primary' | 'secondary' | 'danger' | 'warning' | 'success'
  disabled?: boolean

  // 位置配置
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  offsetX?: number
  offsetY?: number

  // 操作配置
  actions?: Action[]
  expandOnHover?: boolean
  tooltipPlacement?: 'top' | 'bottom' | 'left' | 'right'
}

const props = withDefaults(defineProps<Props>(), {
  closeIcon: 'material-symbols:close',
  size: 'medium',
  variant: 'primary',
  position: 'bottom-right',
  offsetX: 24,
  offsetY: 24,
  actions: () => [],
  expandOnHover: false,
  tooltipPlacement: 'top'
})

const emit = defineEmits<{
  click: [event: Event]
  actionClick: [action: Action]
  expand: [expanded: boolean]
}>()

// Refs
const expanded = ref(false)
const mainButton = useTemplateRef<HTMLButtonElement>('mainButton')
const rippleContainer = useTemplateRef<HTMLElement>('ripple-container')

// 计算属性
const fabClasses = computed(() => [
  'h-fab',
  `h-fab--${props.position}`,
  `h-fab--${props.size}`,
  `h-fab--${props.variant}`,
  {
    'h-fab--expanded': expanded.value,
    'h-fab--disabled': props.disabled,
    'h-fab--has-actions': props.actions.length > 0
  }
])

const fabStyles = computed<StyleValue>(() => ({
  '--fab-offset-x': `${props.offsetX}px`,
  '--fab-offset-y': `${props.offsetY}px`
}))

const mainButtonClasses = computed(() => [
  'h-fab__main',
  {
    'h-fab__main--rotated': expanded.value
  }
])

// 方法
const handleMainClick = (event: Event) => {
  if (props.disabled) return

  if (props.actions.length > 0) {
    toggleExpanded()
  } else {
    createRipple(event)
    emit('click', event)
  }
}

const handleActionClick = (action: Action) => {
  action.handler()
  emit('actionClick', action)
  if (!props.expandOnHover) {
    expanded.value = false
  }
}

const toggleExpanded = () => {
  expanded.value = !expanded.value
  emit('expand', expanded.value)
}

const getActionStyle = (index: number): StyleValue => {
  const baseOffset = 56 + 16 // 按钮高度 + 间距
  const offset = baseOffset * (index + 1)

  const positionMap = {
    'top-right': { bottom: `${offset}px` },
    'bottom-right': { bottom: `${offset}px` },
    'top-left': { bottom: `${offset}px` },
    'bottom-left': { bottom: `${offset}px` }
  }

  return {
    ...positionMap[props.position],
    opacity: 0,
    transform: 'scale(0.3)',
    animation: `fab-action-in 0.3s ease ${index * 0.05}s forwards`
  }
}

// 创建涟漪效果
const createRipple = (event: Event) => {
  if (!rippleContainer.value || !mainButton.value) return

  const rect = mainButton.value.getBoundingClientRect()
  const size = Math.max(rect.width, rect.height)
  const x = (event as MouseEvent).clientX - rect.left
  const y = (event as MouseEvent).clientY - rect.top

  const ripple = document.createElement('span')
  ripple.className = 'h-fab__ripple'
  ripple.style.width = ripple.style.height = '0px'
  ripple.style.left = `${x}px`
  ripple.style.top = `${y}px`

  rippleContainer.value.appendChild(ripple)

  requestAnimationFrame(() => {
    ripple.style.width = ripple.style.height = `${size * 2}px`
    ripple.style.marginLeft = `-${size}px`
    ripple.style.marginTop = `-${size}px`
  })

  setTimeout(() => {
    ripple.style.opacity = '0'
    setTimeout(() => {
      if (rippleContainer.value && rippleContainer.value.contains(ripple)) {
        rippleContainer.value.removeChild(ripple)
      }
    }, 600)
  }, 400)
}
</script>

<style lang="scss" scoped>
.h-fab {
  position: fixed;
  z-index: 1000;

  // 位置设置
  &--bottom-right {
    right: var(--fab-offset-x);
    bottom: var(--fab-offset-y);
  }

  &--bottom-left {
    left: var(--fab-offset-x);
    bottom: var(--fab-offset-y);
  }

  &--top-right {
    right: var(--fab-offset-x);
    top: var(--fab-offset-y);
  }

  &--top-left {
    left: var(--fab-offset-x);
    top: var(--fab-offset-y);
  }

  // 尺寸设置
  &--small {
    .h-fab__main {
      width: 48px;
      height: 48px;
      font-size: 20px;
    }

    .h-fab__mini-btn {
      width: 40px;
      height: 40px;
      font-size: 16px;
    }
  }

  &--medium {
    .h-fab__main {
      width: 56px;
      height: 56px;
      font-size: 24px;
    }

    .h-fab__mini-btn {
      width: 48px;
      height: 48px;
      font-size: 20px;
    }
  }

  &--large {
    .h-fab__main {
      width: 64px;
      height: 64px;
      font-size: 28px;
    }

    .h-fab__mini-btn {
      width: 56px;
      height: 56px;
      font-size: 24px;
    }
  }

  // 变体样式
  &--primary .h-fab__main {
    background: var(--primary-color);
    color: #ffffff;
  }

  &--secondary .h-fab__main {
    background: var(--secondary-color);
    color: #ffffff;
  }

  &--danger .h-fab__main {
    background: var(--danger-color);
    color: #ffffff;
  }

  &--warning .h-fab__main {
    background: var(--warning-color);
    color: #ffffff;
  }

  &--success .h-fab__main {
    background: var(--success-color);
    color: #ffffff;
  }

  // 展开状态
  &--expanded {
    .h-fab__main {
      transform: rotate(45deg);
    }
  }

  // 禁用状态
  &--disabled {
    opacity: 0.6;
    pointer-events: none;
  }
}

// 主按钮
.h-fab__main {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  outline: none;

  &:hover {
    transform: scale(1.1);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
  }

  &:active {
    transform: scale(0.95);
  }

  &:focus {
    box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.2), 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  svg {
    width: 1em;
    height: 1em;
    transition: transform 0.3s ease;
  }
}

// 迷你按钮
.h-fab__mini-btn {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: none;
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: all 0.3s ease;
  outline: none;

  &:hover {
    transform: scale(1.1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  &:focus {
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.5), 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  &--primary {
    background: var(--primary-color);
    color: #ffffff;
  }

  &--secondary {
    background: var(--secondary-color);
    color: #ffffff;
  }

  &--danger {
    background: var(--danger-color);
    color: #ffffff;
  }

  &--warning {
    background: var(--warning-color);
    color: #ffffff;
  }

  &--success {
    background: var(--success-color);
    color: #ffffff;
  }

  svg {
    width: 1em;
    height: 1em;
  }

  &-text {
    font-size: 12px;
    font-weight: 500;
  }
}

// 涟漪效果
.h-fab__ripple-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  overflow: hidden;
  pointer-events: none;
}

.h-fab__ripple {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.5);
  transform: translate(-50%, -50%);
  transition: all 0.6s ease;
}

// 动画定义
@keyframes fab-action-in {
  from {
    opacity: 0;
    transform: scale(0.3);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

// 过渡动画
.fab-transition-enter-active,
.fab-transition-leave-active {
  transition: all 0.3s ease;
}

.fab-transition-enter-from {
  opacity: 0;
  transform: scale(0.3);
}

.fab-transition-leave-to {
  opacity: 0;
  transform: scale(0.3);
}

.fab-transition-move {
  transition: transform 0.3s ease;
}

.fab-icon-transition-enter-active,
.fab-icon-transition-leave-active {
  transition: transform 0.3s ease;
}

.fab-icon-transition-enter-from {
  transform: scale(0) rotate(-180deg);
}

.fab-icon-transition-leave-to {
  transform: scale(0) rotate(180deg);
}
</style>