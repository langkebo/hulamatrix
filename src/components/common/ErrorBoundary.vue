<!--
  ErrorBoundary Component - Catches and handles Vue component errors

  Usage:
  <ErrorBoundary @error="handleError" fallback="custom">
    <YourComponent />
  </ErrorBoundary>
-->
<template>
  <slot v-if="!hasError" />

  <!-- Default Error Fallback -->
  <div
    v-else-if="fallback === 'default'"
    class="error-boundary-default"
    role="alert"
    aria-live="assertive"
    aria-atomic="true">
    <div class="error-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4" stroke-linecap="round" />
        <path d="M12 16h.01" stroke-linecap="round" />
      </svg>
    </div>
    <div class="error-content">
      <h3 class="error-title">{{ $t('error.boundary.title') }}</h3>
      <p class="error-message">{{ errorMessage }}</p>
      <div v-if="showDetails && errorDetails" class="error-details">
        <pre>{{ errorDetails }}</pre>
      </div>
      <div class="error-actions">
        <n-button size="small" @click="handleRetry">
          {{ $t('error.boundary.retry') }}
        </n-button>
        <n-button size="small" tertiary @click="toggleDetails">
          {{ showDetails ? $t('error.boundary.hide_details') : $t('error.boundary.show_details') }}
        </n-button>
      </div>
    </div>
  </div>

  <!-- Minimal Error Fallback -->
  <div
    v-else-if="fallback === 'minimal'"
    class="error-boundary-minimal"
    role="alert"
    aria-live="assertive">
    <span class="error-text">{{ $t('error.boundary.something_wrong') }}</span>
    <n-button text size="small" @click="handleRetry">
      {{ $t('error.boundary.retry') }}
    </n-button>
  </div>

  <!-- Card Error Fallback -->
  <n-card v-else-if="fallback === 'card'" class="error-boundary-card" size="small">
    <template #header>
      <div class="error-card-header">
        <n-icon :component="AlertCircleIcon" :size="20" color="var(--color-error)" />
        <span>{{ $t('error.boundary.error_occurred') }}</span>
      </div>
    </template>
    <p>{{ errorMessage }}</p>
    <template #footer>
      <n-space justify="end">
        <n-button size="small" @click="handleRetry">
          {{ $t('error.boundary.retry') }}
        </n-button>
        <n-button size="small" @click="handleReset">
          {{ $t('error.boundary.reset') }}
        </n-button>
      </n-space>
    </template>
  </n-card>

  <!-- Custom Fallback Slot -->
  <slot
    v-else
    name="error"
    :error="error"
    :error-message="errorMessage"
    :error-details="errorDetails"
    :retry="handleRetry"
    :reset="handleReset" />
</template>

<script setup lang="ts">
import { ref, computed, onErrorCaptured, type ErrorInfo, type ErrorCapturedHook } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NCard, NSpace, NIcon, type CardProps } from 'naive-ui'
import { AlertCircle as AlertCircleIcon } from '@vicons/ionicons5'
import { logger } from '@/utils/logger'

interface Props {
  fallback?: 'default' | 'minimal' | 'card' | 'custom'
  onError?: (error: Error, instance: any, info: string) => void
  logErrors?: boolean
  showErrorDetails?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  fallback: 'default',
  logErrors: true,
  showErrorDetails: false
})

const emit = defineEmits<{
  error: [error: Error, instance: any, info: string]
  reset: []
}>()

const { t } = useI18n()

// State
const error = ref<Error | null>(null)
const errorInfo = ref<string>('')
const showDetails = ref(props.showErrorDetails)

// Computed
const hasError = computed(() => error.value !== null)

const errorMessage = computed(() => {
  if (!error.value) return ''
  return error.value.message || t('error.boundary.unknown_error')
})

const errorDetails = computed(() => {
  if (!error.value) return null

  return {
    message: error.value.message,
    stack: error.value.stack,
    componentStack: errorInfo.value
  }
})

// Methods
const handleRetry = () => {
  error.value = null
  errorInfo.value = ''
}

const handleReset = () => {
  handleRetry()
  emit('reset')
}

const toggleDetails = () => {
  showDetails.value = !showDetails.value
}

// Error Handler
const handleError = (err: Error, instance: any, info: string) => {
  error.value = err
  errorInfo.value = info

  // Log error
  if (props.logErrors) {
    logger.error('[ErrorBoundary] Error caught:', {
      error: err,
      componentName: instance?.$?.type?.name || 'Unknown',
      info
    })
  }

  // Call custom error handler
  props.onError?.(err, instance, info)

  // Emit error event
  emit('error', err, instance, info)

  // Prevent error from propagating
  return false
}

// Lifecycle hook to capture errors from children
onErrorCaptured((err: Error, instance: any, info: string) => {
  return handleError(err, instance, info)
})
</script>

<style scoped lang="scss">
.error-boundary-default {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 20px;
  background: var(--bg-color-2);
  border: 1px solid var(--color-error);
  border-radius: 12px;
  margin: 16px 0;
}

.error-icon {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-error);
  background: rgba(var(--color-error-rgb, 255, 77, 79), 0.1);
  border-radius: 50%;

  svg {
    width: 24px;
    height: 24px;
  }
}

.error-content {
  flex: 1;
}

.error-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color-1);
  margin: 0 0 8px 0;
}

.error-message {
  font-size: 14px;
  color: var(--text-color-2);
  margin: 0 0 12px 0;
}

.error-details {
  margin: 12px 0;
  padding: 12px;
  background: var(--bg-color);
  border-radius: 8px;
  overflow: auto;

  pre {
    margin: 0;
    font-size: 12px;
    font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
    color: var(--text-color-2);
    white-space: pre-wrap;
    word-break: break-all;
  }
}

.error-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.error-boundary-minimal {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px;
  background: var(--bg-color-2);
  border-radius: 8px;
  margin: 8px 0;
}

.error-text {
  font-size: 14px;
  color: var(--text-color-2);
}

.error-boundary-card {
  border-color: var(--color-error);
}

.error-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-error);
}
</style>
