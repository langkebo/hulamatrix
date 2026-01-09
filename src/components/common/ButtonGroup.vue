<template>
  <div :class="groupClasses">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed, provide } from 'vue'

interface Props {
  // 按钮排列方向
  direction?: 'horizontal' | 'vertical'
  // 按钮尺寸（统一设置）
  size?: 'mini' | 'small' | 'medium' | 'large'
  // 按钮变体（统一设置）
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'warning' | 'success'
  // 是否等宽
  equalWidth?: boolean
  // 是否紧凑
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  direction: 'horizontal',
  equalWidth: false,
  compact: true
})

// 注入给子组件使用的配置
provide('buttonGroup', {
  size: props.size,
  variant: props.variant,
  inGroup: true,
  direction: props.direction,
  equalWidth: props.equalWidth,
  compact: props.compact
})

const groupClasses = computed(() => [
  'h-button-group',
  `h-button-group--${props.direction}`,
  {
    'h-button-group--equal-width': props.equalWidth,
    'h-button-group--compact': props.compact
  }
])
</script>

<style lang="scss" scoped>
.h-button-group {
  display: inline-flex;

  // 水平排列
  &--horizontal {
    flex-direction: row;

    :deep(.h-button) {
      &:not(:last-child) {
        border-top-right-radius: 0;
        border-bottom-right-radius: 0;
        border-right: none;
      }

      &:not(:first-child) {
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
      }

      &:hover,
      &:focus {
        z-index: 1;
      }
    }
  }

  // 垂直排列
  &--vertical {
    flex-direction: column;

    :deep(.h-button) {
      width: 100%;
      justify-content: center;

      &:not(:last-child) {
        border-bottom-left-radius: 0;
        border-bottom-right-radius: 0;
        border-bottom: none;
      }

      &:not(:first-child) {
        border-top-left-radius: 0;
        border-top-right-radius: 0;
      }

      &:hover,
      &:focus {
        z-index: 1;
      }
    }
  }

  // 等宽
  &--equal-width {
    :deep(.h-button) {
      flex: 1;
      min-width: 0;
    }
  }

  // 紧凑模式
  &--compact {
    :deep(.h-button) {
      margin: 0;
    }
  }

  // 分隔按钮样式
  :deep(.h-button--outline) {
    &:not(:last-child) {
      border-right: 1px solid;
    }
  }

  &--vertical :deep(.h-button--outline) {
    &:not(:last-child) {
      border-right: none;
      border-bottom: 1px solid;
    }
  }
}
</style>
