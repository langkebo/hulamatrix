// HuLa 项目全局类型定义

/// <reference types="vite/client" />

// 模块声明
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

declare module '*.svg' {
  import type { FunctionalComponent } from 'vue'
  const content: FunctionalComponent
  export default content
}

declare module '*.png' {
  const content: string
  export default content
}

declare module '*.jpg' {
  const content: string
  export default content
}

declare module '*.jpeg' {
  const content: string
  export default content
}

declare module '*.gif' {
  const content: string
  export default content
}

declare module '*.webp' {
  const content: string
  export default content
}

declare module '*.ico' {
  const content: string
  export default content
}

declare module '*.bmp' {
  const content: string
  export default content
}

declare module '*.json' {
  const content: Record<string, unknown>
  export default content
}

declare module '*.txt' {
  const content: string
  export default content
}

declare module '*.md' {
  const content: string
  export default content
}

declare module '*.scss' {
  const content: string
  export default content
}

declare module '*.css' {
  const content: string
  export default content
}

// HuLa 项目全局类型定义

// 扩展原生对象类型
declare global {
  interface String {
    format(...args: unknown[]): string
  }

  interface Array<T> {
    unique(): T[]
    groupBy<K extends keyof T>(key: K): Record<string, T[]>
  }

  interface Window {
    // Naive UI 全局实例
    $dialog?: import('naive-ui').DialogApiInjection
    $message?: import('naive-ui').MessageApiInjection
    $notification?: import('naive-ui').NotificationApiInjection
    $modal?: import('naive-ui').ModalApiInjection
    $loadingBar?: import('naive-ui').LoadingBarApiInjection

    // Tauri 相关
    __TAURI__?: Record<string, unknown>
    __TAURI_METADATA__?: {
      __currentWindow?: {
        label: string
      }
    }

    // HuLa 特定全局属性
    __hula__?: {
      version?: string
      env?: 'development' | 'production'
      isDesktop?: boolean
      isMobile?: boolean
      platform?: 'windows' | 'macos' | 'linux'
    }

    // 全局配置
    HULA_CONFIG?: {
      apiBaseUrl?: string
      wsUrl?: string
      debug?: boolean
    }

    // 性能监控
    __PERFORMANCE__?: {
      mark?: (name: string) => void
      measure?: (name: string, startMark?: string, endMark?: string) => void
    }

    // V8 垃圾回收 (仅在启用 --expose-gc 时可用)
    gc?: () => void
  }

  interface Navigator {
    // 扩展 navigator 类型
    userAgentData?: {
      platform?: string
      mobile?: boolean
      getHighEntropyValues?: (hints: string[]) => Promise<Record<string, unknown>>
    }
  }
}

// Node.js 扩展类型
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test'
    TAURI_ENV_PLATFORM?: 'darwin' | 'linux' | 'windows' | 'android' | 'ios'
    TAURI_ENV_DEBUG?: string
  }
}

// Reference legacy type definitions
/// <reference path="./legacy.d.ts" />

export {}