<template>
  <BaseButton
    :class="iconButtonClasses"
    v-bind="size !== undefined ? { size } : {}"
    v-bind="variant !== undefined ? { variant } : {}"
    v-bind="disabled !== undefined ? { disabled } : {}"
    v-bind="loading !== undefined ? { loading } : {}"
    v-bind="tooltip !== undefined ? { tooltip } : {}"
    v-bind="tooltipPlacement !== undefined ? { tooltipPlacement } : {}"
    v-bind="ripple !== undefined ? { ripple } : {}"
    v-bind="$attrs"
    @click="handleClick"
  >
    <template #icon>
      <slot />
    </template>
    <template v-if="$slots.default" #default>
      <slot />
    </template>
  </BaseButton>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import BaseButton from './BaseButton.vue'

interface Props {
  size?: 'mini' | 'small' | 'medium' | 'large'
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  disabled?: boolean
  loading?: boolean
  tooltip?: string
  tooltipPlacement?: 'top' | 'bottom' | 'left' | 'right'
  ripple?: boolean
  // 图标按钮特有属性
  badge?: number | string
  pulse?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'ghost',
  ripple: true
})

const emit = defineEmits<{
  click: [event: Event]
}>()

const iconButtonClasses = computed(() => [
  'h-icon-button',
  {
    'h-icon-button--has-badge': props.badge,
    'h-icon-button--pulse': props.pulse
  }
])

const handleClick = (event: Event) => {
  emit('click', event)
}
</script>

<style lang="scss" scoped>
.h-icon-button {
  position: relative;

  // 调整基础按钮的样式以适应图标按钮
  :deep(.h-button) {
    min-width: auto;
    padding: 0;
    aspect-ratio: 1;

    // 图标大小调整
    svg {
      width: 1.2em;
      height: 1.2em;
    }
  }

  // 徽章样式
  &--has-badge {
    :deep(.h-button)::after {
      content: attr(data-badge);
      position: absolute;
      top: -4px;
      right: -4px;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      background: var(--danger-color);
      color: #ffffff;
      font-size: 10px;
      font-weight: 500;
      line-height: 16px;
      text-align: center;
      border-radius: 8px;
      z-index: 1;
      transform: scale(1);
      animation: badge-bounce 0.3s ease;
    }
  }

  // 脉冲效果
  &--pulse {
    :deep(.h-button) {
      animation: icon-button-pulse 2s infinite;
    }
  }
}

// 徽章动画
@keyframes badge-bounce {
  0% {
    transform: scale(0);
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
  }
}

// 脉冲动画
@keyframes icon-button-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(19, 152, 127, 0.4);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(19, 152, 127, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(19, 152, 127, 0);
  }
}

// 暗色模式适配
[data-theme-content="dark"] {
  .h-icon-button {
    &--pulse :deep(.h-button) {
      animation: icon-button-pulse-dark 2s infinite;
    }
  }
}

@keyframes icon-button-pulse-dark {
  0% {
    box-shadow: 0 0 0 0 rgba(19, 152, 127, 0.6);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(19, 152, 127, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(19, 152, 127, 0);
  }
}
</style>