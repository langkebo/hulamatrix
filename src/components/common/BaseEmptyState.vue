<template>
  <div
    class="empty-state"
    :class="[`size-${size}`, `type-${type}`]"
    role="status"
    :aria-label="ariaLabel">
    <!-- Icon -->
    <div v-if="showIcon" class="empty-state-icon">
      <slot name="icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path
            d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"
            stroke-linecap="round"
            stroke-linejoin="round" />
        </svg>
      </slot>
    </div>

    <!-- Illustration (custom) -->
    <div v-if="$slots.illustration" class="empty-state-illustration">
      <slot name="illustration" />
    </div>

    <!-- Title -->
    <h3 v-if="title" class="empty-state-title">
      {{ title }}
    </h3>

    <!-- Description -->
    <p v-if="description" class="empty-state-description">
      {{ description }}
    </p>

    <!-- Action -->
    <div v-if="$slots.action || actionText" class="empty-state-action">
      <slot name="action">
        <button v-if="onAction" class="empty-state-button" @click="handleAction" type="button">
          {{ actionText }}
        </button>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  type?: 'no-data' | 'no-results' | 'error' | 'offline' | 'custom'
  size?: 'small' | 'medium' | 'large'
  title?: string
  description?: string
  actionText?: string
  showIcon?: boolean
  onAction?: () => void | Promise<void>
}

const props = withDefaults(defineProps<Props>(), {
  type: 'no-data',
  size: 'medium',
  showIcon: true
})

const emit = defineEmits<(e: 'action') => void>()

const ariaLabel = computed(() => {
  if (props.title) return props.title
  const labels = {
    'no-data': '暂无数据',
    'no-results': '未找到结果',
    error: '出错了',
    offline: '离线',
    custom: '空状态'
  }
  return labels[props.type]
})

const handleAction = () => {
  emit('action')
  props.onAction?.()
}
</script>

<script lang="ts">
import { computed } from 'vue'

export default {
  name: 'EmptyState'
}
</script>

<style scoped lang="scss">
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: var(--spacing-md, 16px);

  // Size variants
  &.size-small {
    gap: 8px;
    min-height: 120px;
  }

  &.size-medium {
    gap: 16px;
    min-height: 200px;
  }

  &.size-large {
    gap: 24px;
    min-height: 300px;
  }
}

.empty-state-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-color-3, #999);
  flex-shrink: 0;

  svg {
    display: block;
  }

  // Icon size by container size
  .size-small & {
    width: 32px;
    height: 32px;

    svg {
      width: 100%;
      height: 100%;
    }
  }

  .size-medium & {
    width: 48px;
    height: 48px;

    svg {
      width: 100%;
      height: 100%;
    }
  }

  .size-large & {
    width: 64px;
    height: 64px;

    svg {
      width: 100%;
      height: 100%;
    }
  }
}

.empty-state-illustration {
  margin-bottom: 8px;
  max-width: 200px;

  :deep(svg),
  :deep(img) {
    width: 100%;
    height: auto;
  }
}

.empty-state-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color-1, #333);
  margin: 0;
  max-width: 400px;

  .size-small & {
    font-size: 14px;
  }

  .size-large & {
    font-size: 18px;
  }
}

.empty-state-description {
  font-size: 14px;
  color: var(--text-color-2, #666);
  margin: 0;
  max-width: 400px;
  line-height: 1.5;

  .size-small & {
    font-size: 12px;
  }

  .size-large & {
    font-size: 15px;
  }
}

.empty-state-action {
  margin-top: 8px;
}

.empty-state-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--hula-spacing-sm);
  padding: var(--hula-spacing-sm) var(--hula-spacing-lg);
  font-size: var(--hula-text-sm);
  font-weight: 500;
  color: var(--color-primary, #1890ff);
  background: transparent;
  border: var(--hula-border-thin) solid var(--color-primary, #1890ff);
  border-radius: var(--hula-radius-md);
  cursor: pointer;
  transition: opacity 0.2s var(--ease-out-cubic, ease-out);

  &:hover {
    background: var(--color-primary, #1890ff);
    color: var(--hula-white);
  }

  &:active {
    opacity: 0.8;
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary, #1890ff);
    outline-offset: 2px;
  }
}

// ============================================
// Type Variants
// ============================================

.type-no-data {
  .empty-state-icon {
    color: var(--text-color-3, #999);
  }
}

.type-no-results {
  .empty-state-icon {
    color: var(--color-warning, #faad14);
  }
}

.type-error {
  .empty-state-icon {
    color: var(--color-error, #ff4d4f);
  }
}

.type-offline {
  .empty-state-icon {
    color: var(--text-color-3, #999);
  }

  .empty-state-title {
    color: var(--color-warning, #faad14);
  }
}

.type-custom {
  // Custom styling via consumer
}

// ============================================
// Card Layout Variant
// ============================================
.empty-state-card {
  background: var(--bg-color-1, #fff);
  border: 1px dashed var(--border-color, #d9d9d9);
  border-radius: 8px;
  padding: 32px;
}

// ============================================
// Inline Layout Variant
// ============================================
.empty-state-inline {
  flex-direction: row;
  text-align: left;
  padding: 16px;

  .empty-state-icon {
    margin-bottom: 0;
    margin-right: 16px;
  }

  .empty-state-content {
    flex: 1;
  }

  .empty-state-action {
    margin-top: 0;
    margin-left: 16px;
  }
}

// ============================================
// Full Page Variant
// ============================================
.empty-state-full-page {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--bg-color-2, #f5f5f5);

  .empty-state-icon {
    width: 96px;
    height: 96px;
    margin-bottom: 24px;

    svg {
      width: 100%;
      height: 100%;
    }
  }

  .empty-state-title {
    font-size: 20px;
  }

  .empty-state-description {
    font-size: 16px;
  }
}

// ============================================
// Animation
// ============================================
.empty-state-icon {
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

// Pause animation on reduce motion preference
@media (prefers-reduced-motion: reduce) {
  .empty-state-icon {
    animation: none;
  }
}

// ============================================
// Dark Mode Support
// ============================================
@media (prefers-color-scheme: dark) {
  .empty-state-title {
    color: var(--text-color-1, #e0e0e0);
  }

  .empty-state-description {
    color: var(--text-color-2, #a0a0a0);
  }

  .empty-state-icon {
    color: var(--text-color-3, #666);
  }
}
</style>
