import type { Component } from 'vue'

/**
 * Vant UI component type definitions
 * This module provides basic type declarations for Vant 4 components
 * For full type safety, install @vant/auto-import-resolver or use specific imports
 */

// Toast options interface
interface ToastOptions {
  message?: string
  icon?: string
  type?: 'success' | 'fail' | 'warning' | 'loading'
  position?: 'top' | 'bottom' | 'middle'
  duration?: number
  forbidClick?: boolean
  loadingType?: 'circular' | 'spinner'
  closeOnClick?: boolean
  closeOnPopstate?: boolean
}

// Dialog options interface
interface DialogOptions {
  title?: string
  message?: string
  showCancelButton?: boolean
  confirmButtonText?: string
  cancelButtonText?: string
  closeOnPopstate?: boolean
  lockScroll?: boolean
  messageAlign?: 'left' | 'center' | 'right'
  className?: string | string[]
  showConfirmButton?: boolean
}

// Toast function type
type ToastFunction = (options: ToastOptions | string) => void

// Toast interface with static methods
interface ToastConstructor extends ToastFunction {
  success: ToastFunction
  fail: ToastFunction
  warning: ToastFunction
  loading: (options?: Omit<ToastOptions, 'type'> | string) => void
  clear: () => void
}

// Notify function type
type NotifyFunction = (options: ToastOptions | string) => void

// Notify interface with static methods
interface NotifyConstructor extends NotifyFunction {
  success: NotifyFunction
  fail: NotifyFunction
  warning: NotifyFunction
  primary: NotifyFunction
}

declare module 'vant' {
  // Component exports
  export const Popup: Component
  export const NavBar: Component
  export const Icon: Component
  export const Grid: Component
  export const GridItem: Component
  export const Cell: Component
  export const CellGroup: Component
  export const Button: Component
  export const Tag: Component
  export const Circle: Component
  export const Loading: Component
  export const Empty: Component
  export const NoticeBar: Component
  export const Checkbox: Component
  export const CheckboxGroup: Component
  export const Field: Component
  export const Form: Component
  export const ActionSheet: Component
  export const Toast: Component
  export const Switch: Component
  export const Steps: Component
  export const Step: Component
  export const Popover: Component
  export const Image: Component
  export const ImagePreview: Component
  export const List: Component
  export const ListItem: Component
  export const Divider: Component
  export const Space: Component
  export const Tab: Component
  export const Tabs: Component
  export const Tabbar: Component
  export const TabbarItem: Component
  export const Search: Component
  export const SwipeCell: Component
  export const Collapse: Component
  export const CollapseItem: Component
  export const Picker: Component
  export const DatetimePicker: Component
  export const Overlay: Component
  export const Scrollspy: Component
  export const PullRefresh: Component
  export const DropdownMenu: Component
  export const DropdownItem: Component
  export const ConfigProvider: Component
  export const Notify: Component
  export const Rate: Component
  export const Stepper: Component
  export const Uploader: Component

  // Toast utility with method chaining
  export const showToast: ToastConstructor
  export const showLoadingToast: (options?: Omit<ToastOptions, 'type'> | string) => void
  export const closeToast: (options?: boolean | { all?: boolean }) => void

  // Notify utility
  export const showNotify: NotifyConstructor

  // Dialog utilities
  export const showDialog: (options: DialogOptions) => Promise<{ confirm: boolean; cancel: boolean }>

  export const showConfirmDialog: (options: Omit<DialogOptions, 'showCancelButton'>) => Promise<{
    confirm: boolean
    cancel: boolean
  }>

  export const closeDialog: () => void
}
