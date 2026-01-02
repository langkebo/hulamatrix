<template>
  <component
    :is="computedTag"
    :class="buttonClasses"
    :type="computedType"
    :disabled="disabled || loading"
    :href="href"
    :to="to"
    :loading="loading"
    v-bind="$attrs"
    @click="handleClick"
  >
    <!-- 加载状态 -->
    <span v-if="loading" class="h-button__loading">
      <LoadingSpinner :size="spinnerSize" />
    </span>

    <!-- 图标 -->
    <span v-if="$slots.icon && !loading" class="h-button__icon">
      <slot name="icon" />
    </span>

    <!-- 按钮内容 -->
    <span v-if="$slots.default" class="h-button__content" :class="{ 'h-button__content--has-icon': $slots.icon }">
      <slot />
    </span>

    <!-- 后缀图标 -->
    <span v-if="$slots.suffix && !loading" class="h-button__suffix">
      <slot name="suffix" />
    </span>

    <!-- 涟漪效果容器 -->
    <span ref="rippleContainer" class="h-button__ripple-container"></span>
  </component>
</template>

<script setup lang="ts">
import { computed, useTemplateRef, useSlots } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import LoadingSpinner from './LoadingSpinner.vue'

// 获取 slots
const slots = useSlots()

// Props 定义
interface Props {
  // 基础属性
  type?: 'button' | 'submit' | 'reset'
  size?: 'mini' | 'small' | 'medium' | 'large'
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'warning' | 'success'
  disabled?: boolean
  loading?: boolean
  block?: boolean
  round?: boolean
  circle?: boolean
  href?: string
  to?: RouteLocationRaw

  // 图标属性
  iconPosition?: 'left' | 'right'

  // 提示信息
  tooltip?: string
  tooltipPlacement?: 'top' | 'bottom' | 'left' | 'right'

  // 动画
  ripple?: boolean
  bounce?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  type: 'button',
  size: 'medium',
  variant: 'primary',
  disabled: false,
  loading: false,
  block: false,
  round: false,
  circle: false,
  iconPosition: 'left',
  ripple: true,
  bounce: false
})

// Emits
const emit = defineEmits<{
  click: [event: Event]
}>()

// Refs
const rippleContainer = useTemplateRef<HTMLElement>('rippleContainer')

// 计算属性
const computedTag = computed(() => {
  if (props.href) return 'a'
  if (props.to) return 'router-link'
  return 'button'
})

const computedType = computed(() => {
  if (computedTag.value === 'button') {
    return props.type
  }
  return undefined
})

const spinnerSize = computed(() => {
  switch (props.size) {
    case 'mini':
    case 'small':
      return 'small'
    case 'large':
      return 'large'
    default:
      return 'medium'
  }
})

const buttonClasses = computed(() => [
  'h-button',
  `h-button--${props.size}`,
  `h-button--${props.variant}`,
  {
    'h-button--disabled': props.disabled,
    'h-button--loading': props.loading,
    'h-button--block': props.block,
    'h-button--round': props.round,
    'h-button--circle': props.circle,
    'h-button--bounce': props.bounce,
    'h-button--has-icon': slots.icon,
    'h-button--has-suffix': slots.suffix
  }
])

// 方法
const handleClick = (event: Event) => {
  if (props.disabled || props.loading) {
    event.preventDefault()
    return
  }

  if (props.ripple && rippleContainer.value) {
    createRipple(event)
  }

  emit('click', event)
}

// 创建涟漪效果
const createRipple = (event: Event) => {
  const target = event.currentTarget as HTMLElement
  if (!target || !rippleContainer.value) return

  const rect = target.getBoundingClientRect()
  const size = Math.max(rect.width, rect.height)
  const x = (event as MouseEvent).clientX - rect.left
  const y = (event as MouseEvent).clientY - rect.top

  const ripple = document.createElement('span')
  ripple.className = 'h-button__ripple'
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
.h-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--button-gap, 8px);
  border: none;
  border-radius: var(--button-radius, 6px);
  font-family: inherit;
  font-weight: 500;
  text-align: center;
  text-decoration: none;
  white-space: nowrap;
  vertical-align: middle;
  cursor: pointer;
  transition: all var(--transition-fast);
  user-select: none;
  outline: none;
  overflow: hidden;

  &:focus {
    outline: 2px solid var(--focus-ring-color);
    outline-offset: 2px;
  }

  &:disabled,
  &--disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  // 按钮尺寸
  &--mini {
    height: 24px;
    padding: 0 8px;
    font-size: 12px;
  }

  &--small {
    height: 32px;
    padding: 0 12px;
    font-size: 13px;
  }

  &--medium {
    height: 40px;
    padding: 0 16px;
    font-size: 14px;
  }

  &--large {
    height: 48px;
    padding: 0 24px;
    font-size: 16px;
  }

  // 主要按钮
  &--primary {
    background: var(--primary-color);
    color: #ffffff;

    &:hover:not(:disabled) {
      background: var(--primary-hover);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(19, 152, 127, 0.3);
    }

    &:active:not(:disabled) {
      transform: translateY(0);
    }
  }

  // 次要按钮
  &--secondary {
    background: var(--secondary-color);
    color: #ffffff;

    &:hover:not(:disabled) {
      background: var(--secondary-hover);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(107, 114, 128, 0.3);
    }
  }

  // 轮廓按钮
  &--outline {
    background: transparent;
    color: var(--primary-color);
    border: 1px solid var(--primary-color);

    &:hover:not(:disabled) {
      background: var(--primary-color);
      color: #ffffff;
      transform: translateY(-1px);
    }
  }

  // 幽灵按钮
  &--ghost {
    background: transparent;
    color: var(--primary-color);

    &:hover:not(:disabled) {
      background: var(--primary-bg);
      transform: translateY(-1px);
    }
  }

  // 危险按钮
  &--danger {
    background: var(--danger-color);
    color: #ffffff;

    &:hover:not(:disabled) {
      background: var(--danger-hover);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
    }
  }

  // 警告按钮
  &--warning {
    background: var(--warning-color);
    color: #ffffff;

    &:hover:not(:disabled) {
      background: var(--warning-hover);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
    }
  }

  // 成功按钮
  &--success {
    background: var(--success-color);
    color: #ffffff;

    &:hover:not(:disabled) {
      background: var(--success-hover);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    }
  }

  // 特殊形状
  &--block {
    width: 100%;
  }

  &--round {
    border-radius: 9999px;
  }

  &--circle {
    width: auto;
    height: auto;
    aspect-ratio: 1;
    border-radius: 50%;
    padding: 0;
  }

  // 动画效果
  &--bounce {
    animation: button-bounce 0.6s ease;
  }

  // 子元素
  &__loading {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    :deep(svg) {
      width: 1em;
      height: 1em;
    }
  }

  &__content {
    flex: 1;
    min-width: 0;

    &--has-icon {
      margin-left: 4px;
    }
  }

  &__suffix {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    :deep(svg) {
      width: 1em;
      height: 1em;
    }
  }

  // 涟漪效果容器
  &__ripple-container {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    border-radius: inherit;
    pointer-events: none;
  }

  &__ripple {
    position: absolute;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.5);
    transform: translate(-50%, -50%);
    transition: all 0.6s ease;
    pointer-events: none;
  }
}

// 动画定义
@keyframes button-bounce {
  0%, 20%, 53%, 80%, 100% {
    transform: scale(1);
  }
  40%, 43% {
    transform: scale(1.05);
  }
  70% {
    transform: scale(0.95);
  }
  90% {
    transform: scale(1.02);
  }
}

// 暗色模式适配
[data-theme-content="dark"] {
  .h-button {
    &--outline {
      &:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.1);
      }
    }

    &--ghost {
      &:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.05);
      }
    }

    &__ripple {
      background: rgba(255, 255, 255, 0.2);
    }
  }
}

// 响应式适配
@media (max-width: 768px) {
  .h-button {
    &--large {
      height: 44px;
      padding: 0 20px;
      font-size: 15px;
    }

    &--medium {
      height: 36px;
      padding: 0 14px;
    }
  }
}
</style>