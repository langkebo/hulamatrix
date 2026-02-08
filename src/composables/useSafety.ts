/*
 * Vue Composable for Matrix Safety Service
 *
 * Provides reactive access to safety error handling functionality
 */

import { ref, computed, onUnmounted } from 'vue'
import { matrixSafetyService } from '@/services/matrix'
import { SafetyErrorType, SafetyErrorSeverity } from '@/services/matrix/MatrixSafetyService'
import type { SafetyErrorEvent, RecommendedAction } from '@/services/matrix'

export function useSafety() {
  const safetyErrors = ref<SafetyErrorEvent[]>([])
  const blockedContent = ref<Set<string>>(new Set())
  const config = ref(matrixSafetyService.getConfig())

  // Subscribe to safety errors
  const unsubscribe = matrixSafetyService.onError((_error) => {
    safetyErrors.value = matrixSafetyService.getSafetyErrors()
    blockedContent.value = new Set(matrixSafetyService.getBlockedContent())
  })

  // Cleanup on unmount
  onUnmounted(() => {
    unsubscribe()
  })

  // Computed properties
  const hasErrors = computed(() => safetyErrors.value.length > 0)
  const hasUnhandledErrors = computed(() => safetyErrors.value.some((e) => !e.handled))
  const criticalErrorsCount = computed(
    () => safetyErrors.value.filter((e) => e.content.severity === SafetyErrorSeverity.CRITICAL).length
  )
  const blockedCount = computed(() => blockedContent.value.size)

  // Methods
  const refreshErrors = () => {
    safetyErrors.value = matrixSafetyService.getSafetyErrors()
    blockedContent.value = new Set(matrixSafetyService.getBlockedContent())
  }

  const getRoomErrors = (roomId: string) => {
    return matrixSafetyService.getSafetyErrorsForRoom(roomId)
  }

  const getUnhandledErrors = () => {
    return matrixSafetyService.getUnhandledSafetyErrors()
  }

  const isContentBlocked = (eventId: string) => {
    return matrixSafetyService.isContentBlocked(eventId)
  }

  const dismissError = (errorId: string) => {
    matrixSafetyService.dismissSafetyError(errorId)
    refreshErrors()
  }

  const reportViolation = async (roomId: string, eventId: string, type: SafetyErrorType, details?: string) => {
    try {
      await matrixSafetyService.reportSafetyViolation(roomId, eventId, type, details)
      refreshErrors()
    } catch (err) {
      console.error('Failed to report violation:', err)
      throw err
    }
  }

  const executeAction = async (errorId: string, action: RecommendedAction) => {
    try {
      await matrixSafetyService.executeRecommendedAction(errorId, action)
      refreshErrors()
    } catch (err) {
      console.error('Failed to execute action:', err)
      throw err
    }
  }

  const updateConfig = (newConfig: Partial<typeof config.value>) => {
    matrixSafetyService.updateConfig(newConfig)
    config.value = matrixSafetyService.getConfig()
  }

  const getStats = () => {
    return matrixSafetyService.getStats()
  }

  const unblockContent = (eventId: string) => {
    matrixSafetyService.unblockContent(eventId)
    blockedContent.value = new Set(matrixSafetyService.getBlockedContent())
  }

  const clearOldErrors = (olderThanMs?: number) => {
    matrixSafetyService.clearOldErrors(olderThanMs)
    refreshErrors()
  }

  const getErrorTitle = (error: SafetyErrorEvent): string => {
    const titles: Record<SafetyErrorType, string> = {
      [SafetyErrorType.MALICIOUS_CONTENT]: '恶意内容警告',
      [SafetyErrorType.SPAM]: '垃圾信息警告',
      [SafetyErrorType.INAPPROPRIATE_CONTENT]: '不当内容警告',
      [SafetyErrorType.PHISHING]: '钓鱼网站警告',
      [SafetyErrorType.MALWARE]: '恶意软件警告',
      [SafetyErrorType.SCAM]: '诈骗警告',
      [SafetyErrorType.VIOLENCE]: '暴力内容警告',
      [SafetyErrorType.SELF_HARM]: '自残内容警告',
      [SafetyErrorType.OTHER]: '安全警告'
    }

    return titles[error.content.type] || '安全警告'
  }

  const getErrorSeverityColor = (severity: SafetyErrorSeverity): string => {
    const colors: Record<SafetyErrorSeverity, string> = {
      [SafetyErrorSeverity.LOW]: 'info',
      [SafetyErrorSeverity.MEDIUM]: 'warning',
      [SafetyErrorSeverity.HIGH]: 'error',
      [SafetyErrorSeverity.CRITICAL]: 'error'
    }

    return colors[severity] || 'info'
  }

  // Initialize with current errors
  refreshErrors()

  return {
    // State
    safetyErrors,
    blockedContent,
    config,

    // Computed
    hasErrors,
    hasUnhandledErrors,
    criticalErrorsCount,
    blockedCount,

    // Methods
    refreshErrors,
    getRoomErrors,
    getUnhandledErrors,
    isContentBlocked,
    dismissError,
    reportViolation,
    executeAction,
    updateConfig,
    getStats,
    unblockContent,
    clearOldErrors,
    getErrorTitle,
    getErrorSeverityColor
  }
}
