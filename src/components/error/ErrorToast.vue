<template>
  <teleport to="body">
    <transition-group name="toast" tag="div" class="error-toast-container">
      <div
        v-for="toast in activeToasts"
        :key="toast.id"
        class="error-toast"
        :class="[`toast-${toast.severity}`, { 'toast-with-actions': toast.actions?.length }]"
        @click="handleToastClick(toast)">
        <!-- 图标 -->
        <div class="toast-icon">
          <Icon :icon="getToastIcon(toast.severity)" :size="20" />
        </div>

        <!-- 内容 -->
        <div class="toast-content">
          <div class="toast-title" v-if="toast.title">
            {{ toast.title }}
          </div>
          <div class="toast-message">
            {{ toast.message }}
          </div>

          <!-- 进度条 -->
          <div
            v-if="toast.duration && toast.duration > 0 && !toast.persistent"
            class="toast-progress"
            :style="{ animationDuration: `${toast.duration}ms` }" />
        </div>

        <!-- 操作按钮 -->
        <div v-if="toast.actions?.length" class="toast-actions">
          <button
            v-for="action in toast.actions"
            :key="action.key"
            @click.stop="handleActionClick(toast, action)"
            class="toast-action-btn"
            :class="`action-${action.type}`">
            <Icon v-if="action.icon" :icon="action.icon" :size="16" />
            {{ action.label }}
          </button>
        </div>

        <!-- 关闭按钮 -->
        <button v-if="toast.closable" @click.stop="removeToast(toast.id)" class="toast-close" aria-label="关闭通知">
          <Icon icon="mdi:close" :size="16" />
        </button>

        <!-- 详情展开按钮 -->
        <button
          v-if="toast.details"
          @click.stop="toggleDetails(toast.id)"
          class="toast-details-toggle"
          :class="{ expanded: expandedDetails.has(toast.id) }">
          <Icon icon="mdi:chevron-down" :size="16" />
        </button>
      </div>

      <!-- 详情面板 -->
      <div
        v-for="toast in activeToasts"
        :key="`details-${toast.id}`"
        v-show="expandedDetails.has(toast.id) && toast.details"
        class="toast-details-panel">
        <div class="details-content">
          <div class="details-header">
            <span class="details-title">错误详情</span>
            <button @click="toggleDetails(toast.id)" class="details-close" aria-label="关闭详情">
              <Icon icon="mdi:close" :size="16" />
            </button>
          </div>
          <div class="details-body">
            <div v-if="toast.details?.errorCode" class="detail-item">
              <span class="detail-label">错误代码:</span>
              <code class="detail-value">{{ toast.details?.errorCode }}</code>
            </div>
            <div v-if="toast.details?.category" class="detail-item">
              <span class="detail-label">错误类别:</span>
              <span class="detail-value">{{ toast.details?.category }}</span>
            </div>
            <div v-if="toast.details?.timestamp" class="detail-item">
              <span class="detail-label">发生时间:</span>
              <span class="detail-value">{{ formatTime(toast.details?.timestamp) }}</span>
            </div>
            <div v-if="toast.details?.context" class="detail-item">
              <span class="detail-label">上下文:</span>
              <pre class="detail-value">{{ JSON.stringify(toast.details.context, null, 2) }}</pre>
            </div>
            <div v-if="toast.details?.stack" class="detail-item">
              <span class="detail-label">堆栈跟踪:</span>
              <pre class="detail-value stack-trace">{{ toast.details.stack }}</pre>
            </div>
          </div>
          <div class="details-actions">
            <button @click="copyErrorDetails(toast)" class="details-action-btn">
              <Icon icon="mdi:content-copy" :size="16" />
              复制详情
            </button>
            <button @click="reportError(toast)" class="details-action-btn">
              <Icon icon="mdi:bug" :size="16" />
              报告问题
            </button>
          </div>
        </div>
      </div>
    </transition-group>
  </teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { type StandardError, ErrorSeverity, ErrorCategory } from '@/utils/error-handler'
import { logger } from '@/utils/logger'

export interface ErrorToastAction {
  key: string
  label: string
  icon?: string
  type: 'primary' | 'secondary' | 'danger'
  handler: () => void | Promise<void>
}

export interface ErrorToastDetails {
  errorCode?: string
  category?: ErrorCategory
  severity?: ErrorSeverity
  timestamp?: number
  context?: Record<string, unknown>
  stack?: string
  originalError?: Error | unknown
}

export interface ErrorToast {
  id: string
  title?: string
  message: string
  severity: ErrorSeverity
  duration?: number
  persistent?: boolean
  closable?: boolean
  actions?: ErrorToastAction[]
  details?: ErrorToastDetails
  onClick?: () => void
  onDismiss?: () => void
}

const props = defineProps<{
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center'
  maxToasts?: number
}>()

const router = useRouter()

// 状态
const toasts = ref<ErrorToast[]>([])
const expandedDetails = ref<Set<string>>(new Set())
const toastTimers = ref<Map<string, number>>(new Map())

// 计算属性
const activeToasts = computed(() => {
  const sorted = [...toasts.value].sort((a, b) => {
    // 按严重程度排序：CRITICAL > HIGH > MEDIUM > LOW
    const severityOrder = {
      [ErrorSeverity.CRITICAL]: 4,
      [ErrorSeverity.HIGH]: 3,
      [ErrorSeverity.MEDIUM]: 2,
      [ErrorSeverity.LOW]: 1
    }
    return (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0)
  })

  return sorted.slice(0, props.maxToasts || 5)
})

// 方法
const addToast = (toast: Omit<ErrorToast, 'id'>): string => {
  const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  const newToast: ErrorToast = {
    id,
    duration: 5000,
    persistent: false,
    closable: true,
    ...toast
  }

  toasts.value.push(newToast)

  // 设置自动消失定时器
  if (newToast.duration && newToast.duration > 0 && !newToast.persistent) {
    const timer = window.setTimeout(() => {
      removeToast(id)
    }, newToast.duration)
    toastTimers.value.set(id, Number(timer))
  }

  return id
}

const removeToast = (id: string) => {
  const index = toasts.value.findIndex((toast) => toast.id === id)
  if (index !== -1) {
    const toast = toasts.value[index]

    // 清除定时器
    const timer = toastTimers.value.get(id)
    if (timer) {
      window.clearTimeout(Number(timer))
      toastTimers.value.delete(id)
    }

    // 移除详情展开状态
    expandedDetails.value.delete(id)

    // 调用消失回调
    if (toast?.onDismiss) {
      toast.onDismiss()
    }

    toasts.value.splice(index, 1)
  }
}

const clearAllToasts = () => {
  // 清除所有定时器
  for (const timer of toastTimers.value.values()) {
    clearTimeout(timer)
  }
  toastTimers.value.clear()

  // 调用所有消失回调
  toasts.value.forEach((toast) => {
    if (toast.onDismiss) {
      toast.onDismiss()
    }
  })

  toasts.value = []
  expandedDetails.value.clear()
}

const toggleDetails = (id: string) => {
  if (expandedDetails.value.has(id)) {
    expandedDetails.value.delete(id)
  } else {
    expandedDetails.value.add(id)
  }
}

const handleToastClick = (toast: ErrorToast) => {
  if (toast.onClick) {
    toast.onClick()
  }
}

const handleActionClick = async (_toast: ErrorToast, action: ErrorToastAction) => {
  try {
    await action.handler()
  } catch (error) {
    logger.error('Toast action failed:', error)
  }
}

const getToastIcon = (severity: ErrorSeverity): string => {
  const icons = {
    [ErrorSeverity.LOW]: 'mdi:information',
    [ErrorSeverity.MEDIUM]: 'mdi:alert',
    [ErrorSeverity.HIGH]: 'mdi:alert-circle',
    [ErrorSeverity.CRITICAL]: 'mdi:alert-octagon'
  }
  return icons[severity] || 'mdi:alert'
}

const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString()
}

const copyErrorDetails = (toast: ErrorToast) => {
  if (!toast.details) return

  const details = {
    title: toast.title,
    message: toast.message,
    errorCode: toast.details.errorCode,
    category: toast.details.category,
    severity: toast.details.severity,
    timestamp: toast.details.timestamp,
    context: toast.details.context,
    stack: toast.details.stack
  }

  navigator.clipboard
    .writeText(JSON.stringify(details, null, 2))
    .then(() => {
      // 可以显示复制成功的提示
      logger.debug('Error details copied to clipboard')
    })
    .catch((err) => {
      logger.error('Failed to copy error details:', err)
    })
}

const reportError = (toast: ErrorToast) => {
  if (!toast.details) return

  const errorData = {
    title: toast.title,
    message: toast.message,
    errorCode: toast.details.errorCode,
    category: toast.details.category,
    severity: toast.details.severity,
    timestamp: toast.details.timestamp,
    context: toast.details.context,
    userAgent: navigator.userAgent,
    url: window.location.href
  }

  const issueUrl = `https://github.com/your-repo/issues/new?title=${encodeURIComponent(
    `Error Report: ${toast.details.errorCode || toast.title || 'Unknown Error'}`
  )}&body=${encodeURIComponent(JSON.stringify(errorData, null, 2))}`

  window.open(issueUrl, '_blank')
}

// 从标准错误创建Toast
const createFromError = (error: StandardError, options: Partial<ErrorToast> = {}): string => {
  const actions: ErrorToastAction[] = []

  // 根据错误类型添加操作按钮
  if (error.retryable) {
    actions.push({
      key: 'retry',
      label: '重试',
      icon: 'mdi:refresh',
      type: 'primary',
      handler: async () => {
        // 触发重试逻辑
        window.dispatchEvent(
          new CustomEvent('retry-error', {
            detail: { errorId: error.id }
          })
        )
      }
    })
  }

  if (error.category === ErrorCategory.AUTHENTICATION) {
    actions.push({
      key: 'reauth',
      label: '重新登录',
      icon: 'mdi:login',
      type: 'primary',
      handler: async () => {
        router.push('/login')
      }
    })
  }

  if (error.category === ErrorCategory.NETWORK) {
    actions.push({
      key: 'refresh',
      label: '刷新页面',
      icon: 'mdi:refresh',
      type: 'secondary',
      handler: async () => {
        window.location.reload()
      }
    })
  }

  actions.push({
    key: 'report',
    label: '报告',
    icon: 'mdi:bug',
    type: 'secondary',
    handler: async () => {
      reportErrorFromError(error)
    }
  })

  // Build base toast object
  const toastBase: Omit<ErrorToast, 'details'> = {
    id: error.id,
    title: getErrorTitle(error.category),
    message: error.userMessage,
    severity: error.severity,
    duration: error.severity === ErrorSeverity.CRITICAL ? 0 : 8000,
    persistent: error.severity === ErrorSeverity.CRITICAL,
    closable: true,
    actions,
    onClick: () => {
      toggleDetails(error.id)
    },
    ...options
  }

  // Build details object conditionally
  const details: ErrorToastDetails = {
    errorCode: error.code,
    category: error.category,
    severity: error.severity,
    timestamp: error.context.timestamp || Date.now(),
    context: error.context
  }

  // Conditionally add optional properties
  if (error.originalError?.stack !== undefined) {
    details.stack = error.originalError.stack
  }

  if (error.originalError !== undefined) {
    details.originalError = error.originalError
  }

  const toast: ErrorToast = {
    ...toastBase,
    details
  }

  return addToast(toast)
}

const getErrorTitle = (category: ErrorCategory): string => {
  const titles: Partial<Record<ErrorCategory, string>> = {
    [ErrorCategory.NETWORK]: '网络错误',
    [ErrorCategory.TIMEOUT]: '操作超时',
    [ErrorCategory.CONNECTION]: '连接错误',
    [ErrorCategory.AUTHENTICATION]: '身份验证失败',
    [ErrorCategory.AUTH]: '身份验证失败',
    [ErrorCategory.PERMISSION]: '权限错误',
    [ErrorCategory.TOKEN_EXPIRED]: '登录已过期',
    [ErrorCategory.VALIDATION]: '数据验证错误',
    [ErrorCategory.RESOURCE]: '资源错误',
    [ErrorCategory.NOT_FOUND]: '资源未找到',
    [ErrorCategory.CONFLICT]: '操作冲突',
    [ErrorCategory.LIMIT_EXCEEDED]: '超出限制',
    [ErrorCategory.ENCRYPTION]: '加密错误',
    [ErrorCategory.RTC]: '实时连接错误',
    [ErrorCategory.RTC_CONNECTION]: '实时连接错误',
    [ErrorCategory.RTC_MEDIA]: '媒体设备错误',
    [ErrorCategory.RTC_PERMISSION]: '媒体权限错误',
    [ErrorCategory.MATRIX_API]: 'Matrix 服务错误',
    [ErrorCategory.MATRIX_SYNC]: '同步服务错误',
    [ErrorCategory.MATRIX_ENCRYPTION]: '端到端加密错误',
    [ErrorCategory.MATRIX_MEDIA]: '媒体服务错误',
    [ErrorCategory.SYNAPSE_API]: '服务器 API 错误',
    [ErrorCategory.SEARCH]: '搜索错误',
    [ErrorCategory.REACTIONS]: '消息反应错误',
    [ErrorCategory.PUSH_RULES]: '通知规则错误',
    [ErrorCategory.STORAGE]: '存储错误',
    [ErrorCategory.INDEXED_DB]: '本地数据库错误',
    [ErrorCategory.MEMORY]: '内存错误',
    [ErrorCategory.SYSTEM]: '系统错误',
    [ErrorCategory.CLIENT]: '客户端错误',
    [ErrorCategory.SERVER]: '服务器错误',
    [ErrorCategory.UNKNOWN]: '未知错误'
  }
  return titles[category] || '错误'
}

const reportErrorFromError = (error: StandardError) => {
  const errorData = {
    errorCode: error.code,
    message: error.message,
    category: error.category,
    severity: error.severity,
    context: error.context,
    userAgent: navigator.userAgent,
    url: window.location.href,
    timestamp: Date.now()
  }

  const issueUrl = `https://github.com/your-repo/issues/new?title=${encodeURIComponent(
    `Error: ${error.code}`
  )}&body=${encodeURIComponent(JSON.stringify(errorData, null, 2))}`

  window.open(issueUrl, '_blank')
}

// 监听全局错误事件
const handleGlobalError = (event: CustomEvent) => {
  const error = event.detail as StandardError
  createFromError(error)
}

// 监听重试事件
const handleRetryEvent = (event: CustomEvent) => {
  const { errorId } = event.detail
  removeToast(errorId)
}

// 生命周期
onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('matrix-error', handleGlobalError as EventListener)
    window.addEventListener('retry-error', handleRetryEvent as EventListener)
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('matrix-error', handleGlobalError as EventListener)
    window.removeEventListener('retry-error', handleRetryEvent as EventListener)
  }

  // 清理所有定时器
  for (const timer of toastTimers.value.values()) {
    clearTimeout(timer)
  }
})

// 暴露方法
defineExpose({
  addToast,
  removeToast,
  clearAllToasts,
  createFromError
})
</script>

<style scoped>
.error-toast-container {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-width: 400px;
  width: 100%;
}

/* 位置定位 */
.error-toast-container[class*='top-'] {
  top: 20px;
}

.error-toast-container[class*='bottom-'] {
  bottom: 20px;
}

.error-toast-container[class*='-right'] {
  right: 20px;
}

.error-toast-container[class*='-left'] {
  left: 20px;
}

.error-toast-container.top-center {
  left: 50%;
  transform: translateX(-50%);
}

.error-toast-container.bottom-center {
  left: 50%;
  transform: translateX(-50%);
  bottom: 20px;
}

.error-toast {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  background: var(--card-bg);
  border-left: 4px solid;
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;
  cursor: pointer;
}

.toast-low {
  border-left-color: var(--info-color);
}

.toast-medium {
  border-left-color: var(--warning-color);
}

.toast-high {
  border-left-color: var(--error-color);
}

.toast-critical {
  border-left-color: #d32f2f;
}

.toast:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.toast-icon {
  flex-shrink: 0;
  margin-top: 2px;
}

.toast-low .toast-icon {
  color: var(--info-color);
}

.toast-medium .toast-icon {
  color: var(--warning-color);
}

.toast-high .toast-icon,
.toast-critical .toast-icon {
  color: var(--error-color);
}

.toast-content {
  flex: 1;
  min-width: 0;
}

.toast-title {
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
  font-size: 0.9rem;
}

.toast-message {
  color: var(--text-secondary);
  font-size: 0.85rem;
  line-height: 1.4;
  word-break: break-word;
}

.toast-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 3px;
  background: currentColor;
  opacity: 0.3;
  animation: progress linear forwards;
}

@keyframes progress {
  from {
    width: 100%;
  }
  to {
    width: 0;
  }
}

.toast-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.toast-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  background: var(--hover-bg);
  color: var(--text-primary);
}

.toast-action-btn:hover {
  background: var(--button-hover-bg);
}

.action-primary {
  background: var(--primary-color);
  color: white;
}

.action-primary:hover {
  background: var(--primary-hover);
}

.action-danger {
  background: var(--error-color);
  color: white;
}

.action-danger:hover {
  background: var(--error-hover);
}

.toast-close,
.toast-details-toggle {
  flex-shrink: 0;
  padding: 0.25rem;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  border-radius: 4px;
  transition: all 0.2s;
}

.toast-close:hover,
.toast-details-toggle:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}

.toast-details-toggle.expanded {
  transform: rotate(180deg);
}

.toast-details-panel {
  margin-top: -0.5rem;
  border-radius: 0 0 8px 8px;
  overflow: hidden;
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.details-content {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-top: none;
  padding: 1rem;
}

.details-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border-color);
}

.details-title {
  font-weight: 600;
  color: var(--text-primary);
}

.details-close {
  padding: 0.25rem;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  border-radius: 4px;
  transition: background-color 0.2s;
}

.details-close:hover {
  background: var(--hover-bg);
}

.details-body {
  margin-bottom: 1rem;
}

.detail-item {
  margin-bottom: 0.75rem;
}

.detail-label {
  font-weight: 500;
  color: var(--text-secondary);
  font-size: 0.8rem;
}

.detail-value {
  color: var(--text-primary);
  font-family: monospace;
  font-size: 0.8rem;
  word-break: break-all;
  margin-top: 0.25rem;
}

.detail-value.stack-trace {
  max-height: 150px;
  overflow-y: auto;
  background: var(--code-bg);
  padding: 0.5rem;
  border-radius: 4px;
  border: 1px solid var(--border-color);
}

.details-actions {
  display: flex;
  gap: 0.5rem;
}

.details-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-primary);
}

.details-action-btn:hover {
  background: var(--hover-bg);
  border-color: var(--primary-color);
}

/* 过渡动画 */
.toast-enter-active {
  transition: all 0.3s ease-out;
}

.toast-leave-active {
  transition: all 0.3s ease-in;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.toast-move {
  transition: transform 0.3s ease;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .error-toast-container {
    left: 10px !important;
    right: 10px !important;
    max-width: none;
    top: 10px;
    bottom: auto;
  }

  .error-toast {
    padding: 0.875rem;
  }

  .toast-actions {
    flex-direction: column;
    gap: 0.25rem;
  }

  .toast-action-btn {
    font-size: 0.7rem;
    padding: 0.2rem 0.5rem;
  }

  .details-actions {
    flex-direction: column;
  }

  .details-action-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
