<template>
  <div class="error-boundary">
    <!-- 正常内容 -->
    <slot v-if="!hasError" />

    <!-- 错误状态 -->
    <div v-else class="error-fallback">
      <div class="error-container">
        <div class="error-icon">
          <Icon :icon="getErrorIcon" :size="48" />
        </div>

        <div class="error-content">
          <h2 class="error-title">{{ errorTitle }}</h2>
          <p class="error-message">{{ errorMessage }}</p>

          <!-- 错误详情 (开发环境) -->
          <div v-if="showDetails && errorDetails" class="error-details">
            <details>
              <summary>技术详情</summary>
              <pre class="error-stack">{{ errorDetails }}</pre>
            </details>
          </div>

          <!-- 操作按钮 -->
          <div class="error-actions">
            <button v-if="canRetry" @click="handleRetry" :disabled="retrying" class="btn btn-primary">
              <Icon v-if="retrying" icon="mdi:loading" class="animate-spin" />
              {{ retrying ? '重试中...' : '重试' }}
            </button>

            <button v-if="canRefresh" @click="handleRefresh" class="btn btn-secondary">
              <Icon icon="mdi:refresh" />
              刷新页面
            </button>

            <button v-if="canGoHome" @click="handleGoHome" class="btn btn-outline">
              <Icon icon="mdi:home" />
              返回首页
            </button>

            <button v-if="showReportButton" @click="handleReport" class="btn btn-outline">
              <Icon icon="mdi:bug" />
              报告问题
            </button>
          </div>

          <!-- 错误反馈 -->
          <div v-if="showFeedback" class="error-feedback">
            <p class="feedback-question">这个错误对您有帮助吗？</p>
            <div class="feedback-buttons">
              <button
                @click="handleFeedback('positive')"
                class="feedback-btn positive"
                :class="{ active: feedback === 'positive' }">
                <Icon icon="mdi:thumb-up" />
                有帮助
              </button>
              <button
                @click="handleFeedback('negative')"
                class="feedback-btn negative"
                :class="{ active: feedback === 'negative' }">
                <Icon icon="mdi:thumb-down" />
                没帮助
              </button>
              <button
                @click="handleFeedback('neutral')"
                class="feedback-btn neutral"
                :class="{ active: feedback === 'neutral' }">
                <Icon icon="mdi:help" />
                不确定
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 错误通知横幅 -->
      <div v-if="showNotification && !dismissed" class="error-notification" :class="`notification-${errorSeverity}`">
        <div class="notification-content">
          <Icon :icon="getNotificationIcon" class="notification-icon" />
          <span class="notification-text">{{ notificationMessage }}</span>
        </div>
        <button @click="dismissNotification" class="notification-close" aria-label="关闭通知">
          <Icon icon="mdi:close" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, getCurrentInstance, type Component } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { useErrorHandler } from '@/hooks/useErrorHandler'
import { type StandardError, ErrorSeverity, ErrorCategory, resolveError } from '@/utils/error-handler'
import { logger } from '@/utils/logger'

interface Props {
  fallbackComponent?: Component
  showErrorDetails?: boolean
  showNotification?: boolean
  showFeedback?: boolean
  showReportButton?: boolean
  autoRetry?: boolean
  maxRetries?: number
  retryDelay?: number
  onError?: (error: StandardError) => void
  onRetry?: (attempt: number) => void
  onResolved?: () => void
}

const props = withDefaults(defineProps<Props>(), {
  showErrorDetails: false,
  showNotification: true,
  showFeedback: true,
  showReportButton: true,
  autoRetry: false,
  maxRetries: 3,
  retryDelay: 2000
})

const emit = defineEmits<{
  error: [error: StandardError]
  retry: [attempt: number]
  resolved: []
  feedback: [feedback: 'positive' | 'negative' | 'neutral']
}>()

const router = useRouter()
const { handleManualError } = useErrorHandler()

// 错误状态
const currentError = ref<StandardError | null>(null)
const hasError = ref(false)
const retrying = ref(false)
const retryCount = ref(0)
const feedback = ref<'positive' | 'negative' | 'neutral' | null>(null)
const dismissed = ref(false)

// 计算属性
const errorTitle = computed(() => {
  if (!currentError.value) return '发生错误'

  const titles: Partial<Record<ErrorCategory, string>> = {
    [ErrorCategory.NETWORK]: '网络连接问题',
    [ErrorCategory.TIMEOUT]: '操作超时',
    [ErrorCategory.CONNECTION]: '连接问题',
    [ErrorCategory.AUTHENTICATION]: '身份验证失败',
    [ErrorCategory.AUTH]: '身份验证失败',
    [ErrorCategory.PERMISSION]: '权限不足',
    [ErrorCategory.TOKEN_EXPIRED]: '登录已过期',
    [ErrorCategory.VALIDATION]: '数据验证错误',
    [ErrorCategory.RESOURCE]: '资源未找到',
    [ErrorCategory.NOT_FOUND]: '资源未找到',
    [ErrorCategory.CONFLICT]: '操作冲突',
    [ErrorCategory.LIMIT_EXCEEDED]: '超出限制',
    [ErrorCategory.ENCRYPTION]: '加密错误',
    [ErrorCategory.RTC]: '实时连接问题',
    [ErrorCategory.RTC_CONNECTION]: '实时连接问题',
    [ErrorCategory.RTC_MEDIA]: '媒体设备问题',
    [ErrorCategory.RTC_PERMISSION]: '媒体权限问题',
    [ErrorCategory.MATRIX_API]: 'Matrix 服务问题',
    [ErrorCategory.MATRIX_SYNC]: '同步服务问题',
    [ErrorCategory.MATRIX_ENCRYPTION]: '端到端加密问题',
    [ErrorCategory.MATRIX_MEDIA]: '媒体服务问题',
    [ErrorCategory.SYNAPSE_API]: '服务器 API 问题',
    [ErrorCategory.SEARCH]: '搜索功能异常',
    [ErrorCategory.REACTIONS]: '消息反应错误',
    [ErrorCategory.PUSH_RULES]: '通知规则错误',
    [ErrorCategory.STORAGE]: '存储空间不足',
    [ErrorCategory.INDEXED_DB]: '本地数据库问题',
    [ErrorCategory.MEMORY]: '内存不足',
    [ErrorCategory.SYSTEM]: '系统错误',
    [ErrorCategory.CLIENT]: '客户端错误',
    [ErrorCategory.SERVER]: '服务器错误',
    [ErrorCategory.UNKNOWN]: '未知错误'
  }

  return titles[currentError.value.category] || '发生错误'
})

const errorMessage = computed(() => {
  return currentError.value?.userMessage || '应用程序遇到了意外错误'
})

const errorDetails = computed(() => {
  if (!currentError.value) return ''

  const error = currentError.value
  let details = `错误代码: ${error.code}\n`
  details += `错误类别: ${error.category}\n`
  details += `严重程度: ${error.severity}\n`

  if (error.originalError?.stack) {
    details += `堆栈跟踪:\n${error.originalError.stack}`
  }

  return details
})

const errorSeverity = computed(() => currentError.value?.severity || ErrorSeverity.LOW)

const canRetry = computed(() => {
  return currentError.value?.retryable && retryCount.value < (props.maxRetries || 3)
})

const canRefresh = computed(() => {
  return [ErrorCategory.NETWORK, ErrorCategory.TIMEOUT, ErrorCategory.UNKNOWN].includes(
    currentError.value?.category || ErrorCategory.UNKNOWN
  )
})

const canGoHome = computed(() => {
  return router.currentRoute.value.path !== '/'
})

const showDetails = computed(() => {
  return props.showErrorDetails && import.meta.env.DEV
})

const getErrorIcon = computed(() => {
  const icons: Record<ErrorSeverity, string> = {
    [ErrorSeverity.LOW]: 'mdi:information',
    [ErrorSeverity.MEDIUM]: 'mdi:alert',
    [ErrorSeverity.HIGH]: 'mdi:alert-circle',
    [ErrorSeverity.CRITICAL]: 'mdi:alert-octagon'
  }
  return icons[errorSeverity.value] || 'mdi:alert'
})

const getNotificationIcon = computed(() => {
  const icons: Record<ErrorSeverity, string> = {
    [ErrorSeverity.LOW]: 'mdi:information-outline',
    [ErrorSeverity.MEDIUM]: 'mdi:alert-outline',
    [ErrorSeverity.HIGH]: 'mdi:alert-circle-outline',
    [ErrorSeverity.CRITICAL]: 'mdi:alert-octagon-outline'
  }
  return icons[errorSeverity.value] || 'mdi:alert-outline'
})

const notificationMessage = computed(() => {
  if (!currentError.value) return ''
  return `${errorTitle.value}: ${errorMessage.value}`
})

// 方法
const captureError = (error: Error | StandardError) => {
  const standardError = error instanceof Error ? handleManualError(error, { component: 'ErrorBoundary' }) : error

  currentError.value = standardError
  hasError.value = true
  dismissed.value = false
  feedback.value = null

  emit('error', standardError)

  if (props.onError) {
    props.onError(standardError)
  }

  // 自动重试
  if (props.autoRetry && canRetry.value) {
    setTimeout(() => {
      handleRetry()
    }, props.retryDelay)
  }
}

const handleRetry = async () => {
  if (!canRetry.value || retrying.value) return

  retrying.value = true
  retryCount.value++

  emit('retry', retryCount.value)

  if (props.onRetry) {
    props.onRetry(retryCount.value)
  }

  try {
    // 这里可以执行重试逻辑
    // 通常需要传入具体的重试函数
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // 重试成功
    resolveCurrentError()
  } catch (retryError) {
    // 重试失败
    logger.error('Retry failed:', retryError)
  } finally {
    retrying.value = false
  }
}

const resolveCurrentError = () => {
  if (currentError.value) {
    if (feedback.value) {
      resolveError(currentError.value.id, feedback.value)
    } else {
      resolveError(currentError.value.id)
    }
  }

  currentError.value = null
  hasError.value = false
  retryCount.value = 0
  retrying.value = false

  emit('resolved')

  if (props.onResolved) {
    props.onResolved()
  }
}

const handleRefresh = () => {
  window.location.reload()
}

const handleGoHome = () => {
  router.push('/')
  resolveCurrentError()
}

const handleReport = () => {
  if (currentError.value) {
    // 这里可以实现错误报告功能
    // 例如发送到错误跟踪服务或打开GitHub issue
    const errorData = {
      errorId: currentError.value.id,
      code: currentError.value.code,
      message: currentError.value.message,
      category: currentError.value.category,
      severity: currentError.value.severity,
      context: currentError.value.context,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: Date.now()
    }

    // 打开GitHub issue或发送到错误跟踪服务
    const issueUrl = `https://github.com/your-repo/issues/new?title=${encodeURIComponent(
      `Error: ${currentError.value.code}`
    )}&body=${encodeURIComponent(JSON.stringify(errorData, null, 2))}`

    window.open(issueUrl, '_blank')
  }
}

const handleFeedback = (type: 'positive' | 'negative' | 'neutral') => {
  feedback.value = type
  emit('feedback', type)

  // 如果已经选择了反馈，可以延迟自动解决错误
  setTimeout(() => {
    resolveCurrentError()
  }, 2000)
}

const dismissNotification = () => {
  dismissed.value = true
}

const setupErrorHandling = () => {
  // 监听全局错误事件
  const errorHandler = (event: Event) => {
    const customEvent = event as CustomEvent
    if (customEvent.detail) {
      captureError(customEvent.detail)
    }
  }

  // 监听Vue错误
  const vueErrorHandler = (err: unknown, instance: { $options?: { name?: string } } | null, _info: string) => {
    const error = err instanceof Error ? err : new Error(String(err))
    const enhancedError = new Error(error.message)
    enhancedError.stack = error.stack || ''
    enhancedError.name = error.name

    const standardError = handleManualError(enhancedError, {
      component: instance?.$options?.name || 'VueComponent',
      operation: 'render'
    })

    captureError(standardError)
  }

  // 注册事件监听器
  if (typeof window !== 'undefined') {
    window.addEventListener('matrix-error', errorHandler)
    window.addEventListener('error', (event) => {
      vueErrorHandler(event.error || new Error(event.message), null, 'global_error')
    })
    window.addEventListener('unhandledrejection', (event) => {
      vueErrorHandler(event.reason, null, 'unhandled_promise_rejection')
    })
  }

  // Vue应用的错误处理
  const app = getCurrentInstance()?.appContext?.app
  if (app) {
    app.config.errorHandler = vueErrorHandler
  }

  // 清理函数
  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('matrix-error', errorHandler)
    }
  }
}

// 生命周期
onMounted(() => {
  const cleanup = setupErrorHandling()

  onUnmounted(() => {
    cleanup()
  })
})

// 暴露方法给父组件
defineExpose({
  captureError,
  retry: handleRetry,
  resolve: resolveCurrentError
})
</script>

<style scoped>
.error-boundary {
  position: relative;
}

.error-fallback {
  min-height: 400px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: var(--bg-color);
}

.error-container {
  max-width: 600px;
  width: 100%;
  text-align: center;
}

.error-icon {
  color: var(--error-color);
  margin-bottom: 1.5rem;
}

.error-content {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 2rem;
  border: 1px solid var(--border-color);
  box-shadow: 0 4px 12px rgba(var(--hula-black-rgb), 0.1);
}

.error-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 1rem;
}

.error-message {
  font-size: 1rem;
  color: var(--text-secondary);
  margin-bottom: 1.5rem;
  line-height: 1.5;
}

.error-details {
  margin-bottom: 1.5rem;
  text-align: left;
}

.error-details summary {
  cursor: pointer;
  font-weight: 500;
  color: var(--text-primary);
  padding: 0.5rem;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.error-details summary:hover {
  background-color: var(--hover-bg);
}

.error-stack {
  background: var(--code-bg);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 1rem;
  font-family: monospace;
  font-size: 0.875rem;
  color: var(--text-primary);
  white-space: pre-wrap;
  max-height: 200px;
  overflow-y: auto;
  margin-top: 1rem;
}

.error-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  text-decoration: none;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--primary-color);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-hover);
}

.btn-secondary {
  background: var(--secondary-color);
  color: white;
}

.btn-secondary:hover {
  background: var(--secondary-hover);
}

.btn-outline {
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-outline:hover {
  background: var(--hover-bg);
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.error-feedback {
  border-top: 1px solid var(--border-color);
  padding-top: 1.5rem;
}

.feedback-question {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 1rem;
}

.feedback-buttons {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}

.feedback-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-secondary);
}

.feedback-btn:hover {
  background: var(--hover-bg);
}

.feedback-btn.positive.active {
  background: var(--success-color);
  color: white;
  border-color: var(--success-color);
}

.feedback-btn.negative.active {
  background: var(--error-color);
  color: white;
  border-color: var(--error-color);
}

.feedback-btn.neutral.active {
  background: var(--warning-color);
  color: white;
  border-color: var(--warning-color);
}

.error-notification {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(var(--hula-black-rgb), 0.15);
  max-width: 400px;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.notification-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.notification-icon {
  flex-shrink: 0;
}

.notification-text {
  font-size: 0.875rem;
  color: var(--text-primary);
  line-height: 1.4;
}

.notification-close {
  background: none;
  border: none;
  padding: 0.25rem;
  margin-left: 0.75rem;
  cursor: pointer;
  color: var(--text-secondary);
  border-radius: 4px;
  transition: background-color 0.2s;
}

.notification-close:hover {
  background: rgba(var(--hula-white-rgb), 0.1);
}

.notification-low {
  background: var(--info-color);
  color: white;
}

.notification-medium {
  background: var(--warning-color);
  color: white;
}

.notification-high,
.notification-critical {
  background: var(--error-color);
  color: white;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .error-fallback {
    padding: 1rem;
    min-height: 300px;
  }

  .error-content {
    padding: 1.5rem;
  }

  .error-actions {
    flex-direction: column;
  }

  .btn {
    width: 100%;
    justify-content: center;
  }

  .error-notification {
    top: 10px;
    right: 10px;
    left: 10px;
    max-width: none;
  }

  .feedback-buttons {
    flex-direction: column;
  }

  .feedback-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
