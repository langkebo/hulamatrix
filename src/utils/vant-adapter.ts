/**
 * Vant 适配层 - 提供 Naive UI 风格的 API
 *
 * 这个适配层提供与 Naive UI 兼容的 API，使迁移更加平滑
 * 所有函数返回与 Naive UI 相似的接口
 */

import { showToast, showDialog, showConfirmDialog, showLoadingToast, closeToast } from 'vant'
import { showNotify as vantShowNotify } from 'vant/es/notify'

// ============================================
// Message 适配器
// ============================================

/**
 * 消息提示适配器接口
 */
export interface MessageAdapter {
  success: (message: string, duration?: number) => void
  error: (message: string, duration?: number) => void
  warning: (message: string, duration?: number) => void
  info: (message: string, duration?: number) => void
  loading: (message: string, duration?: number) => void
  destroyAll: () => void
}

/**
 * 创建消息提示适配器
 *
 * @example
 * ```typescript
 * const message = useMessage()
 * message.success('操作成功')
 * message.error('操作失败')
 * message.loading('加载中...')
 * ```
 */
export const useMessage = (): MessageAdapter => {
  return {
    success: (message: string, duration = 3000) => {
      showToast({
        type: 'success',
        message,
        duration
      })
    },

    error: (message: string, duration = 3000) => {
      showToast({
        type: 'fail',
        message,
        duration
      })
    },

    warning: (message: string, duration = 3000) => {
      showToast({
        message,
        duration,
        icon: 'warning-o'
      })
    },

    info: (message: string, duration = 3000) => {
      showToast({
        message,
        duration
      })
    },

    loading: (message: string, duration = 0) => {
      showLoadingToast({
        message,
        duration,
        forbidClick: true,
        loadingType: 'spinner'
      })
    },

    destroyAll: () => {
      closeToast(true)
    }
  }
}

// ============================================
// Dialog 适配器
// ============================================

/**
 * 对话框选项接口
 */
export interface DialogAdapterOptions {
  title?: string
  content: string
  confirmText?: string
  cancelText?: string
  onConfirm?: () => void | Promise<void>
  onCancel?: () => void | Promise<void>
  showCancelButton?: boolean
  closeOnPopstate?: boolean
  lockScroll?: boolean
}

/**
 * 对话框适配器接口
 */
export interface DialogAdapter {
  info: (options: DialogAdapterOptions) => void
  success: (options: DialogAdapterOptions) => void
  warning: (options: DialogAdapterOptions) => void
  error: (options: DialogAdapterOptions) => void
  confirm: (options: DialogAdapterOptions) => void
}

/**
 * 通知适配器接口
 */
export interface NotificationAdapter {
  success: (title: string, message?: string, duration?: number) => void
  error: (title: string, message?: string, duration?: number) => void
  warning: (title: string, message?: string, duration?: number) => void
  info: (title: string, message?: string, duration?: number) => void
}

/**
 * 创建对话框适配器
 *
 * @example
 * ```typescript
 * const dialog = useDialog()
 * dialog.info({
 *   title: '提示',
 *   content: '确定要执行此操作吗？',
 *   onConfirm: () => {
 *     logger.debug('确认')
 *   }
 * })
 * ```
 */
export const useDialog = (): DialogAdapter => {
  const createDialog = (options: DialogAdapterOptions, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const titles = {
      info: options.title || '提示',
      success: options.title || '成功',
      warning: options.title || '警告',
      error: options.title || '错误'
    }

    if (options.showCancelButton === false) {
      // 只显示确认按钮
      showDialog({
        title: titles[type],
        message: options.content,
        confirmButtonText: options.confirmText || '确定',
        closeOnPopstate: options.closeOnPopstate,
        lockScroll: options.lockScroll
      })
        .then(() => {
          options.onConfirm?.()
        })
        .catch(() => {
          // ignore
        })
    } else {
      // 显示确认和取消按钮
      showConfirmDialog({
        title: titles[type],
        message: options.content,
        confirmButtonText: options.confirmText || '确定',
        cancelButtonText: options.cancelText || '取消',
        closeOnPopstate: options.closeOnPopstate,
        lockScroll: options.lockScroll
      })
        .then(() => {
          options.onConfirm?.()
        })
        .catch(() => {
          options.onCancel?.()
        })
    }
  }

  return {
    info: (options) => createDialog(options, 'info'),
    success: (options) => createDialog(options, 'success'),
    warning: (options) => createDialog(options, 'warning'),
    error: (options) => createDialog(options, 'error'),
    confirm: (options) => createDialog(options, 'info')
  }
}

// ============================================
// Notification 适配器
// ============================================

/**
 * 创建通知适配器
 *
 * @example
 * ```typescript
 * const notification = useNotification()
 * notification.success('成功', '操作已成功完成')
 * ```
 */
export const useNotification = (): NotificationAdapter => {
  const show = (
    type: 'success' | 'danger' | 'primary' | 'warning',
    title: string,
    message?: string,
    duration = 3000
  ) => {
    vantShowNotify({
      type: type === 'danger' ? 'danger' : type,
      message: message || title,
      duration
    })
  }

  return {
    success: (title: string, message?: string, duration?: number) => show('success', title, message, duration),
    error: (title: string, message?: string, duration?: number) => show('danger', title, message, duration),
    warning: (title: string, message?: string, duration?: number) => show('warning', title, message, duration),
    info: (title: string, message?: string, duration?: number) => show('primary', title, message, duration)
  }
}

// ============================================
// 导出所有适配器
// ============================================

export default {
  useMessage,
  useDialog,
  useNotification
}
