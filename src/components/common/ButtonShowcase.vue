<template>
  <div
    class="button"
    :class="[
      `button--${variant}`,
      `button--${size}`,
      {
        'button--disabled': disabled,
        'button--loading': loading,
        'button--block': block
      }
    ]"
    :disabled="disabled || loading"
    @click="handleClick">
    <!-- 加载状态 -->
    <span v-if="loading" class="button__spinner" aria-hidden="true"></span>

    <!-- 图标 -->
    <span v-if="icon && !loading" class="button__icon" aria-hidden="true">
      <component :is="iconComponent" />
    </span>

    <!-- 内容 -->
    <span class="button__content">
      <slot />
    </span>

    <!-- 后置图标 -->
    <span v-if="iconRight && !loading" class="button__icon button__icon--right" aria-hidden="true">
      <component :is="iconRightComponent" />
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

/**
 * Button - 符合最佳实践的按钮组件
 *
 * 特性:
 * - 使用设计令牌
 * - 正确的交互反馈
 * - 无障碍支持
 * - 加载状态
 * - 尺寸变体
 * - 颜色变体
 */

interface Props {
  /** 按钮类型 */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  /** 尺寸 */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  /** 是否禁用 */
  disabled?: boolean
  /** 是否加载中 */
  loading?: boolean
  /** 是否块级 */
  block?: boolean
  /** 左侧图标 */
  icon?: string | object
  /** 右侧图标 */
  iconRight?: string | object
  /** HTML 类型 */
  type?: 'button' | 'submit' | 'reset'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false,
  block: false,
  type: 'button'
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

/**
 * 处理点击事件
 */
function handleClick(event: MouseEvent) {
  if (props.disabled || props.loading) return
  emit('click', event)
}

/**
 * 获取图标组件
 */
const iconComponent = computed(() => props.icon)
const iconRightComponent = computed(() => props.iconRight)
</script>

<style scoped lang="scss">
.button {
  // 使用设计令牌
  --button-bg: var(--hula-brand-primary);
  --button-hover: var(--hula-brand-hover);
  --button-text: #ffffff;
  --button-border: transparent;
  --button-shadow: var(--shadow-sm);

  // 基础样式
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  font-family: inherit;
  font-weight: var(--font-weight-medium);
  line-height: 1;
  text-align: center;
  text-decoration: none;
  border: 1px solid var(--button-border);
  border-radius: var(--radius-md);
  background-color: var(--button-bg);
  color: var(--button-text);
  cursor: pointer;
  user-select: none;
  transition: all var(--duration-base) var(--ease-out);
  box-shadow: var(--button-shadow);

  // 尺寸变体
  &--xs {
    padding: var(--padding-xs) var(--padding-sm);
    font-size: var(--text-xs);
    min-height: var(--touch-target-min);
  }

  &--sm {
    padding: var(--padding-sm) var(--padding-md);
    font-size: var(--text-sm);
    min-height: var(--touch-target-min);
  }

  &--md {
    padding: var(--padding-sm) var(--padding-lg);
    font-size: var(--text-base);
    min-height: var(--touch-target-min);
  }

  &--lg {
    padding: var(--padding-md) var(--padding-xl);
    font-size: var(--text-lg);
    min-height: var(--touch-target-comfortable);
  }

  &--xl {
    padding: var(--padding-lg) var(--padding-2xl);
    font-size: var(--text-xl);
    min-height: var(--touch-target-comfortable);
  }

  // 变体样式
  &--secondary {
    --button-bg: var(--hula-gray-200);
    --button-hover: var(--hula-gray-300);
    --button-text: var(--hula-gray-900);
  }

  &--outline {
    --button-bg: transparent;
    --button-text: var(--hula-brand-primary);
    --button-border: var(--hula-brand-primary);

    &:hover {
      background-color: var(--hula-brand-primary);
      color: #ffffff;
    }
  }

  &--ghost {
    --button-bg: transparent;
    --button-text: var(--hula-gray-700);
    --button-shadow: none;

    &:hover {
      background-color: var(--hula-gray-100);
    }
  }

  &--danger {
    --button-bg: var(--hula-error);
    --button-hover: var(--hula-error-dark);
    --button-text: #ffffff;
  }

  // 交互状态 - 使用 opacity 而非 scale
  &:hover:not(.button--disabled) {
    opacity: 0.9;
    box-shadow: var(--shadow-md);
  }

  &:active:not(.button--disabled) {
    opacity: 0.8;
    transform: translateY(1px);
  }

  // 焦点状态 - 可访问性
  &:focus-visible {
    outline: 2px solid var(--hula-brand-primary);
    outline-offset: 2px;
  }

  // 禁用状态
  &--disabled {
    opacity: var(--disabled-opacity);
    cursor: not-allowed;
    pointer-events: none;
  }

  // 加载状态
  &--loading {
    pointer-events: none;
  }

  // 块级
  &--block {
    width: 100%;
  }

  // 内容
  &__content {
    flex: 1;
  }

  // 图标
  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;

    &--right {
      order: 1;
    }
  }

  // 加载动画
  &__spinner {
    display: inline-block;
    width: 1em;
    height: 1em;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: button-spin 0.6s linear infinite;
  }
}

@keyframes button-spin {
  to {
    transform: rotate(360deg);
  }
}

// 减少动画（可访问性）
@media (prefers-reduced-motion: reduce) {
  .button {
    transition-duration: 0.01ms !important;

    &__spinner {
      animation-duration: 3s !important;
    }
  }
}
</style>
