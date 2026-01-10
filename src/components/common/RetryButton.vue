<!--
  RetryButton Component - Button with retry logic and loading states

  Usage:
  <RetryButton
    :action="async () => await fetchData()"
    :max-retries="3"
    :retry-delay="1000"
    @success="handleSuccess"
    @failed="handleFailed"
  >
    Load Data
  </RetryButton>
-->
<template>
  <n-button
    :type="buttonType"
    :size="size"
    :disabled="disabled || isLoading"
    :loading="isLoading"
    :icon="renderIcon"
    v-bind="$attrs"
    @click="handleClick"
    @keydown.enter="handleClick">
    <template v-if="showRetryCount && retryCount > 0" #icon>
      <n-badge :value="retryCount" :max="maxRetries" processing />
    </template>

    <slot :loading="isLoading" :retry-count="retryCount" :error="lastError">
      <template v-if="lastError && !isLoading">
        {{ errorText }}
      </template>
      <template v-else>
        <slot name="default" />
      </template>
    </slot>
  </n-button>
</template>

<script setup lang="ts">
import { ref, computed, h, watch, type PropType, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NBadge, NIcon, type ButtonProps } from 'naive-ui'
import { Icon } from '@iconify/vue'

type ButtonType = 'default' | 'tertiary' | 'primary' | 'success' | 'warning' | 'error'

interface RetryOptions {
  maxRetries?: number
  retryDelay?: number
  backoffMultiplier?: number
  showRetryCount?: boolean
  resetOnSuccess?: boolean
  onError?: (error: Error, retryCount: number) => void
}

const props = withDefaults(
  defineProps<{
    action: () => Promise<void>
    disabled?: boolean
    size?: ButtonProps['size']
    type?: ButtonType
    maxRetries?: number
    retryDelay?: number
    backoffMultiplier?: number
    showRetryCount?: boolean
    resetOnSuccess?: boolean
    errorText?: string
  }>(),
  {
    disabled: false,
    size: 'medium',
    type: 'default',
    maxRetries: 3,
    retryDelay: 1000,
    backoffMultiplier: 2,
    showRetryCount: true,
    resetOnSuccess: true,
    errorText: 'Retry'
  }
)

const emit = defineEmits<{
  success: []
  failed: [error: Error, finalRetryCount: number]
  retry: [retryCount: number]
  loading: [isLoading: boolean]
}>()

const { t } = useI18n()

// State
const isLoading = ref(false)
const retryCount = ref(0)
const lastError = ref<Error | null>(null)
const delayTimer = ref<ReturnType<typeof setTimeout> | null>(null)

const startDelay = (delay: number) => {
  delayTimer.value = setTimeout(() => {
    executeAction()
  }, delay)
}

// Computed
const buttonType = computed<ButtonType>(() => {
  if (lastError.value && !isLoading.value) return 'error'
  return props.type
})

const canRetry = computed(() => retryCount.value < props.maxRetries)

const renderIcon = () => {
  if (lastError.value && !isLoading.value) {
    return h(Icon, { icon: 'mdi:refresh' })
  }
  return null
}

// Methods
const calculateDelay = (): number => {
  return props.retryDelay * props.backoffMultiplier ** retryCount.value
}

const executeAction = async () => {
  if (isLoading.value) return

  isLoading.value = true
  lastError.value = null
  emit('loading', true)

  try {
    await props.action()

    // Success
    if (props.resetOnSuccess) {
      retryCount.value = 0
    }
    emit('success')
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    lastError.value = err

    // Check if we can retry
    if (retryCount.value < props.maxRetries) {
      retryCount.value++
      emit('retry', retryCount.value)

      // Delay before retry
      const delay = calculateDelay()
      startDelay(delay)
    } else {
      // Final failure
      emit('failed', err, retryCount.value)
    }
  } finally {
    // Only clear loading if we're not waiting for a retry
    if (!canRetry.value || !lastError.value) {
      isLoading.value = false
      emit('loading', false)
    }
  }
}

const handleClick = () => {
  // If there was an error and we're not at max retries, retry
  if (lastError.value && canRetry.value) {
    executeAction()
  } else if (!lastError.value) {
    // Fresh start
    retryCount.value = 0
    executeAction()
  }
}

// Reset on action change
watch(
  () => props.action,
  () => {
    retryCount.value = 0
    lastError.value = null
    if (delayTimer.value) {
      clearTimeout(delayTimer.value)
      delayTimer.value = null
    }
  }
)

// Cleanup on unmount
onUnmounted(() => {
  if (delayTimer.value) {
    clearTimeout(delayTimer.value)
  }
})

// Expose methods
defineExpose({
  retry: () => {
    retryCount.value = 0
    lastError.value = null
    executeAction()
  },
  reset: () => {
    retryCount.value = 0
    lastError.value = null
    isLoading.value = false
  },
  isLoading,
  retryCount,
  lastError
})
</script>

<style scoped lang="scss">
// Retry button styles are handled by Naive UI
// Custom animations for retry indication
@keyframes shake {
  0%, 100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-4px);
  }
  75% {
    transform: translateX(4px);
  }
}

:deep(.n-button--error) {
  animation: shake 0.3s ease-in-out;
}
</style>
