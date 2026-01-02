import type {
  LoadingBarApiInjection,
  MessageApiInjection,
  NotificationApiInjection,
  DialogApiInjection,
  ModalApiInjection
} from 'naive-ui'

// 扩展 Window 接口，添加 Naive UI 的全局实例
declare global {
  interface Window {
    $loadingBar?: LoadingBarApiInjection
    $message?: MessageApiInjection
    $notification?: NotificationApiInjection
    $modal?: ModalApiInjection
    $dialog?: DialogApiInjection
  }
}

// 为 vue 组件实例添加全局属性支持
declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $loadingBar?: LoadingBarApiInjection
    $message?: MessageApiInjection
    $notification?: NotificationApiInjection
    $modal?: ModalApiInjection
    $dialog?: DialogApiInjection
  }
}

export {}