// Path mapping type declarations
// This file helps TypeScript resolve @/ imports

declare module '@/utils/logger' {
  export const logger: {
    debug: (message: string, data?: unknown, component?: string) => void
    info: (message: string, data?: unknown, component?: string) => void
    warn: (message: string, data?: unknown, component?: string) => void
    error: (message: string, error?: Error, data?: unknown, component?: string) => void
    time: (label: string, component?: string) => void
    timeEnd: (label: string, component?: string) => void
    measure: <T>(label: string, fn: () => T, component?: string) => T
    measureAsync: <T>(label: string, fn: () => Promise<T>, component?: string) => Promise<T>
  }
  export function createLogger(component: string): {
    debug: (message: string, data?: unknown) => void
    info: (message: string, data?: unknown) => void
    warn: (message: string, data?: unknown) => void
    error: (message: string, error?: Error, data?: unknown) => void
    time: (label: string) => void
    timeEnd: (label: string) => void
  }
  export function toError(e: unknown): Error
}

declare module '@/utils/*' {
  const content: unknown
  export default content
  export * from '*/index'
}

declare module '@/hooks/*' {
  const content: unknown
  export default content
  export * from '*/index'
}

declare module '@/stores/*' {
  const content: unknown
  export default content
  export * from '*/index'
}

declare module '@/components/*' {
  import { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>
  export default component
}

declare module '@/views/*' {
  import { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>
  export default component
}

declare module '@/layouts/*' {
  import { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>
  export default component
}

declare module '@/services/*' {
  const content: unknown
  export default content
  export * from '*/index'
}

declare module '@/integrations/*' {
  const content: unknown
  export default content
  export * from '*/index'
}

declare module '@/plugins/*' {
  import { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>
  export default component
}

declare module '@/config/*' {
  const content: unknown
  export default content
  export * from '*/index'
}

declare module '@/assets/*' {
  const content: string
  export default content
}

declare module '@/styles/*' {
  const content: string
  export default content
}

declare module '@/types/*' {
  const content: unknown
  export default content
  export * from '*/index'
}



declare module '@/common/*' {
  const content: unknown
  export default content
  export * from '*/index'
}

declare module '@/typings/*' {
  const content: unknown
  export default content
  export * from '*/index'
}
