<template>
  <div :class="componentClasses" :style="componentStyles" v-bind="attrs">
    <!-- 加载状态 -->
    <div v-if="loading" class="showcase__loading">
      <slot name="loading">
        <div class="showcase__spinner" aria-hidden="true"></div>
        <span class="sr-only">加载中...</span>
      </slot>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="showcase__error">
      <slot name="error">
        <div class="showcase__error-content">
          <div class="showcase__error-icon" aria-hidden="true">⚠️</div>
          <p class="showcase__error-message">{{ error }}</p>
          <button type="button" class="showcase__retry-button" @click="retry" aria-label="重试">重试</button>
        </div>
      </slot>
    </div>

    <!-- 空状态 -->
    <div v-else-if="isEmpty" class="showcase__empty">
      <slot name="empty">
        <div class="showcase__empty-content">
          <div class="showcase__empty-icon" aria-hidden="true">📭</div>
          <p class="showcase__empty-message">{{ emptyMessage }}</p>
        </div>
      </slot>
    </div>

    <!-- 主内容 -->
    <div v-else class="showcase__content">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * ShowcaseContainer - 最佳实践容器组件
 *
 * 展示以下最佳实践:
 * 1. 使用设计令牌
 * 2. 正确的 ARIA 标签
 * 3. 加载、错误、空状态处理
 * 4. 响应式设计
 * 5. 无障碍支持
 * 6. 性能优化
 */

import { computed, ref, watch } from 'vue'

interface Props {
  /** 是否加载中 */
  loading?: boolean
  /** 错误信息 */
  error?: string | null
  /** 是否为空 */
  empty?: boolean
  /** 空状态消息 */
  emptyMessage?: string
  /** 基础类名 */
  baseClass?: string
  /** 变体 */
  variant?: 'default' | 'card' | 'panel' | 'surface'
  /** 内边距 */
  padding?: 'none' | 'sm' | 'md' | 'lg'
  /** 圆角 */
  radius?: 'none' | 'sm' | 'md' | 'lg' | 'full'
  /** 背景颜色 */
  bg?: 'default' | 'primary' | 'secondary' | 'transparent'
  /** 是否可点击 */
  clickable?: boolean
  /** 是否禁用 */
  disabled?: boolean
  /** 其他属性 */
  attrs?: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  error: null,
  empty: false,
  emptyMessage: '暂无数据',
  baseClass: 'showcase',
  variant: 'default',
  padding: 'md',
  radius: 'md',
  bg: 'default',
  clickable: false,
  disabled: false,
  attrs: () => ({})
})

const emit = defineEmits<{
  /** 重试事件 */
  retry: []
  /** 点击事件 */
  click: [event: MouseEvent]
}>()

/**
 * 组件类名
 */
const componentClasses = computed(() => {
  return [
    props.baseClass,
    `showcase--${props.variant}`,
    `showcase--padding-${props.padding}`,
    `showcase--radius-${props.radius}`,
    `showcase--bg-${props.bg}`,
    {
      'showcase--clickable': props.clickable && !props.disabled,
      'showcase--disabled': props.disabled
    }
  ]
})

/**
 * 组件样式
 */
const componentStyles = computed(() => {
  return {}
})

/**
 * 处理点击事件
 */
function handleClick(event: MouseEvent) {
  if (props.disabled || !props.clickable) return
  emit('click', event)
}

/**
 * 重试操作
 */
function retry() {
  emit('retry')
}

/**
 * 是否为空
 */
const isEmpty = computed(() => {
  return props.empty || (props.error === null && !props.loading)
})

// 监听空状态变化
watch(
  () => props.empty,
  (newValue) => {
    if (newValue) {
      // 可以添加空状态日志
      console.log('[ShowcaseContainer] 空状态触发')
    }
  }
)
</script>

<style scoped lang="scss">
.showcase {
  // 使用设计令牌
  --showcase-bg: var(--hula-gray-50);
  --showcase-border: var(--hula-gray-200);
  --showcase-text: var(--hula-gray-900);
  --showcase-shadow: var(--shadow-sm);

  position: relative;
  box-sizing: border-box;

  // 变体样式
  &--default {
    background-color: var(--showcase-bg);
  }

  &--card {
    background-color: var(--hula-white) fff;
    box-shadow: var(--showcase-shadow);
    border: 1px solid var(--showcase-border);
  }

  &--panel {
    background-color: var(--hula-white) fff;
    box-shadow: var(--shadow-md);
    border-radius: var(--radius-lg);
  }

  &--surface {
    background-color: var(--hula-gray-100);
  }

  // 内边距
  &--padding-none {
    padding: 0;
  }
  &--padding-sm {
    padding: var(--padding-sm);
  }
  &--padding-md {
    padding: var(--padding-md);
  }
  &--padding-lg {
    padding: var(--padding-lg);
  }

  // 圆角
  &--radius-none {
    border-radius: 0;
  }
  &--radius-sm {
    border-radius: var(--radius-sm);
  }
  &--radius-md {
    border-radius: var(--radius-md);
  }
  &--radius-lg {
    border-radius: var(--radius-lg);
  }
  &--radius-full {
    border-radius: var(--radius-full);
  }

  // 背景色
  &--bg-default {
    background-color: var(--hula-gray-50);
  }

  &--bg-primary {
    background-color: var(--hula-brand-primary);
    color: var(--hula-white) fff;
  }

  &--bg-secondary {
    background-color: var(--hula-gray-200);
  }

  &--bg-transparent {
    background-color: transparent;
  }

  // 可点击状态 - 使用 opacity 而非 scale
  &--clickable {
    cursor: pointer;
    transition: opacity var(--duration-base) var(--ease-out);

    &:hover {
      opacity: 0.9;
    }

    &:active {
      opacity: 0.8;
    }
  }

  // 禁用状态
  &--disabled {
    opacity: var(--disabled-opacity);
    cursor: not-allowed;
    pointer-events: none;
  }

  // 焦点状态 - 可访问性
  &:focus-visible {
    outline: 2px solid var(--hula-brand-primary);
    outline-offset: 2px;
  }

  // 加载状态
  &__loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-md);
    padding: var(--padding-2xl);
  }

  &__spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--hula-brand-primary);
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  // 错误状态
  &__error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-md);
    padding: var(--padding-2xl);
    background-color: var(--hula-error-bg, rgba(238, 10, 36, 0.1));
    border: 1px solid var(--hula-error);
    border-radius: var(--radius-md);
  }

  &__error-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-sm);
    text-align: center;
  }

  &__error-icon {
    font-size: 2rem;
    margin-bottom: var(--spacing-xs);
  }

  &__error-message {
    color: var(--hula-error);
    font-size: var(--text-sm);
  }

  &__retry-button {
    padding: var(--padding-sm) var(--padding-md);
    font-size: var(--text-sm);
    color: var(--hula-white) fff;
    background-color: var(--hula-brand-primary);
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background-color var(--duration-base) var(--ease-out);

    &:hover {
      background-color: var(--hula-brand-hover);
    }

    &:focus-visible {
      outline: 2px solid var(--hula-brand-primary);
      outline-offset: 2px;
    }
  }

  // 空状态
  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-md);
    padding: var(--padding-2xl);
    color: var(--hula-gray-500);
  }

  &__empty-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-sm);
    text-align: center;
  }

  &__empty-icon {
    font-size: 3rem;
    opacity: 0.5;
    margin-bottom: var(--spacing-xs);
  }

  &__empty-message {
    font-size: var(--text-sm);
    color: var(--hula-gray-700);
  }

  // 主内容
  &__content {
    // 内容样式
  }
}

// 加载动画
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

// 屏幕阅读器专用
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

// 减少动画（可访问性）
@media (prefers-reduced-motion: reduce) {
  .showcase {
    transition-duration: 0.01ms !important;

    &__spinner {
      animation-duration: 3s !important;
    }
  }
}

// 响应式
@media (max-width: 768px) {
  .showcase {
    &__error,
    &__empty {
      padding: var(--padding-lg);
    }

    &__empty-icon {
      font-size: 2rem;
    }
  }
}
</style>
