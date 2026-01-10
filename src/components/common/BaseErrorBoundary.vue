<template>
  <div class="error-boundary" :class="{ 'has-error': hasError }">
    <!-- Error state -->
    <div v-if="hasError" class="error-boundary-fallback" role="alert" aria-live="assertive">
      <slot name="fallback" :error="error" :reset="resetError">
        <div class="error-container">
          <div class="error-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" stroke-linecap="round" />
              <line x1="12" y1="16" x2="12.01" y2="16" stroke-linecap="round" />
            </svg>
          </div>

          <div class="error-content">
            <h3 class="error-title">{{ title }}</h3>
            <p class="error-message">{{ errorMessage }}</p>

            <div v-if="showDetails && error?.stack" class="error-details">
              <details>
                <summary>技术详情</summary>
                <pre class="error-stack">{{ error.stack }}</pre>
              </details>
            </div>
          </div>

          <div class="error-actions">
            <button
              v-if="onRetry"
              class="error-button error-button-retry"
              @click="handleRetry"
              type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 4v6h-6" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              {{ retryText }}
            </button>

            <button
              class="error-button error-button-reset"
              @click="resetError"
              type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              {{ resetText }}
            </button>
          </div>
        </div>
      </slot>
    </div>

    <!-- Normal content -->
    <slot v-else />
  </div>
</template>

<script setup lang="ts">
import { ref, onErrorCaptured, type Ref, type VNode } from 'vue'

interface Props {
  title?: string
  retryText?: string
  resetText?: string
  showDetails?: boolean
  onError?: (error: Error, instance: any, info: string) => void | boolean
  onRetry?: () => void | Promise<void>
  emitError?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: '出错了',
  retryText: '重试',
  resetText: '重置',
  showDetails: false,
  emitError: false
})

const emit = defineEmits<{
  (e: 'error', error: Error, instance: any, info: string): void
  (e: 'reset'): void
}>()

// Error state
const error: Ref<Error | null> = ref(null)
const hasError = ref(false)

// Capture errors from child components
onErrorCaptured((err: Error, instance: any, info: string): boolean | void => {
  error.value = err
  hasError.value = true

  // Call custom error handler
  const shouldStop = props.onError?.(err, instance, info)

  // Emit error event
  emit('error', err, instance, info)

  // Log to console in development
  if (import.meta.env.DEV) {
    console.error('[ErrorBoundary]:', err)
    console.error('Component:', instance)
    console.error('Info:', info)
  }

  // Report error if enabled
  if (props.emitError) {
    // Error reporting can be added here (e.g., Sentry)
    console.error('Error reported:', err)
  }

  // Return false to stop error propagation
  return shouldStop !== false
})

// Computed error message
const errorMessage = computed(() => {
  if (!error.value) return ''

  // User-friendly error messages
  const message = error.value.message

  // Common error patterns
  if (message.includes('Network')) {
    return '网络连接失败，请检查网络设置'
  }
  if (message.includes('fetch')) {
    return '数据加载失败，请稍后重试'
  }
  if (message.includes('timeout')) {
    return '请求超时，请稍后重试'
  }

  return message || '发生了未知错误'
})

// Reset error state
const resetError = () => {
  error.value = null
  hasError.value = false
  emit('reset')
}

// Handle retry
const handleRetry = async () => {
  if (props.onRetry) {
    try {
      await props.onRetry()
      resetError()
    } catch (err) {
      // Error will be captured by onErrorCaptured
    }
  } else {
    resetError()
  }
}

// Expose reset method for external use
defineExpose({
  resetError,
  hasError
})
</script>

<script lang="ts">
import { computed } from 'vue'

export default {
  name: 'ErrorBoundary'
}
</script>

<style scoped lang="scss">
.error-boundary {
  // No special styles when no error
}

.error-boundary-fallback {
  padding: var(--spacing-lg, 24px);
  max-width: 500px;
  margin: 0 auto;
}

.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;
}

.error-icon {
  width: 64px;
  height: 64px;
  color: var(--color-error, #ff4d4f);
  flex-shrink: 0;

  svg {
    width: 100%;
    height: 100%;
  }
}

.error-content {
  width: 100%;
}

.error-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-color-1, #333);
  margin: 0 0 8px 0;
}

.error-message {
  font-size: 14px;
  color: var(--text-color-2, #666);
  margin: 0;
  line-height: 1.5;
}

.error-details {
  margin-top: 12px;
  text-align: left;

  details {
    summary {
      cursor: pointer;
      font-size: 13px;
      color: var(--text-color-3, #999);
      padding: 4px 0;
      user-select: none;

      &:hover {
        color: var(--text-color-2, #666);
      }
    }
  }

  .error-stack {
    margin-top: 8px;
    padding: 12px;
    background: var(--bg-color-3, #f5f5f5);
    border-radius: 4px;
    font-size: 11px;
    font-family: 'Monaco', 'Courier New', monospace;
    color: var(--text-color-3, #999);
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 200px;
    overflow-y: auto;
  }
}

.error-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.error-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 500;
  border: 1px solid var(--border-color, #d9d9d9);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s var(--ease-out-cubic, ease-out);
  background: var(--bg-color-1, #fff);

  svg {
    width: 16px;
    height: 16px;
  }

  &:hover {
    background: var(--hover-color, #f5f5f5);
  }

  &:active {
    transform: scale(0.98);
  }
}

.error-button-retry {
  color: var(--color-primary, #1890ff);
  border-color: var(--color-primary, #1890ff);

  &:hover {
    background: var(--color-primary, #1890ff);
    color: #fff;
  }
}

.error-button-reset {
  color: var(--text-color-2, #666);

  &:hover {
    border-color: var(--text-color-2, #666);
  }
}

// ============================================
// Inline Error Style
// ============================================
.error-boundary.has-error {
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

// ============================================
// Compact Mode
// ============================================
.error-boundary-compact {
  .error-boundary-fallback {
    padding: 16px;
  }

  .error-icon {
    width: 32px;
    height: 32px;
  }

  .error-title {
    font-size: 14px;
  }

  .error-message {
    font-size: 12px;
  }

  .error-button {
    padding: 6px 12px;
    font-size: 12px;

    svg {
      width: 14px;
      height: 14px;
    }
  }
}

// ============================================
// Card Style
// ============================================
.error-boundary-card {
  .error-boundary-fallback {
    background: var(--bg-color-1, #fff);
    border: 1px solid var(--border-color, #d9d9d9);
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }
}
</style>
