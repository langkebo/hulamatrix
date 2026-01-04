/**
 * SafeUI - UI 组件安全封装
 * 提供对 Naive UI 组件的类型安全访问
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 全局 window 对象（包含 Vue 实例）
 */
interface WindowWithVue {
  $message?: MessageApi
  $notification?: NotificationApi
  $dialog?: DialogApi
}

declare const window: Window & WindowWithVue

/**
 * 消息实例（可销毁）
 */
export interface MessageInstance {
  destroy?: () => void
}

/**
 * 消息选项
 */
interface MessageOptions {
  duration?: number
  closable?: boolean
  onClose?: () => void
  onAfterLeave?: () => void
}

/**
 * 通知实例（可销毁）
 */
export interface NotificationInstance {
  destroy?: () => void
}

/**
 * 通知选项
 */
interface NotificationOptions {
  title?: string | (() => unknown)
  content?: string | (() => unknown)
  duration?: number
  closable?: boolean
  onClose?: () => void
  meta?: string | (() => unknown)
  avatar?: (() => unknown) | unknown
  action?: (() => unknown) | unknown
}

/**
 * 对话框选项
 */
interface DialogOptions {
  title?: string
  content?: string
  positiveText?: string
  negativeText?: string
  onPositiveClick?: () => void
  onNegativeClick?: () => void
}

/**
 * 消息 API
 */
interface MessageApi {
  success(content: string | number | boolean, options?: MessageOptions): MessageInstance | undefined
  error(content: string | number | boolean, options?: MessageOptions): MessageInstance | undefined
  info(content: string | number | boolean, options?: MessageOptions): MessageInstance | undefined
  warning(content: string | number | boolean, options?: MessageOptions): MessageInstance | undefined
}

/**
 * 通知 API
 */
interface NotificationApi {
  create(options: NotificationOptions): NotificationInstance | undefined
}

/**
 * 对话框 API
 */
interface DialogApi {
  warning(options: DialogOptions): void
  success(options: DialogOptions): void
  info(options: DialogOptions): void
  error(options: DialogOptions): void
}

// ============================================================================
// UI 组件封装
// ============================================================================

const win: WindowWithVue | undefined = globalThis.window as WindowWithVue | undefined

export const msg = {
  success: (content: string | number | boolean, options?: MessageOptions): MessageInstance | undefined =>
    win?.$message?.success?.(content, options),
  error: (content: string | number | boolean, options?: MessageOptions): MessageInstance | undefined =>
    win?.$message?.error?.(content, options),
  info: (content: string | number | boolean, options?: MessageOptions): MessageInstance | undefined =>
    win?.$message?.info?.(content, options),
  warning: (content: string | number | boolean, options?: MessageOptions): MessageInstance | undefined =>
    win?.$message?.warning?.(content, options)
}

export const ntf = {
  create: (options: NotificationOptions): NotificationInstance | undefined => win?.$notification?.create?.(options)
}

export const dlg = {
  warning: (options: DialogOptions) => win?.$dialog?.warning?.(options),
  success: (options: DialogOptions) => win?.$dialog?.success?.(options),
  info: (options: DialogOptions) => win?.$dialog?.info?.(options),
  error: (options: DialogOptions) => win?.$dialog?.error?.(options)
}
