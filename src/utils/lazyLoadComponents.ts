/* ==========================================================================
   组件懒加载优化工具
   ========================================================================== */

import { defineAsyncComponent, type Component } from 'vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import ErrorComponent from '@/components/common/ErrorComponent.vue'

/**
 * 创建懒加载组件的配置
 */
interface LazyLoadOptions {
  /** 加载超时时间（毫秒） */
  timeout?: number
  /** 延迟显示加载组件的时间（毫秒） */
  delay?: number
  /** 可重试次数 */
  retryCount?: number
  /** 自定义加载组件 */
  loadingComponent?: Component
  /** 自定义错误组件 */
  errorComponent?: Component
  /** 组件加载前的钩子 */
  onBeforeLoad?: () => void
  /** 组件加载后的钩子 */
  onAfterLoad?: () => void
  /** 加载失败的钩子 */
  onError?: (error: Error) => void
}

/**
 * 默认懒加载配置
 */
const defaultOptions: LazyLoadOptions = {
  timeout: 10000,
  delay: 200,
  retryCount: 3,
  loadingComponent: LoadingSpinner,
  errorComponent: ErrorComponent
}

/**
 * 创建带重试机制的加载器
 */
function createRetryLoader(loader: () => Promise<Component>, retryCount: number = 3): () => Promise<Component> {
  return async () => {
    let lastError: Error | undefined

    for (let i = 0; i <= retryCount; i++) {
      try {
        return await loader()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        if (i < retryCount) {
          // 指数退避重试
          await new Promise((resolve) => setTimeout(resolve, 2 ** i * 1000))
        }
      }
    }

    throw lastError || new Error('Component loader failed')
  }
}

/**
 * 创建优化的异步组件
 */
export function createOptimizedAsyncComponent(loader: () => Promise<Component>, options: LazyLoadOptions = {}) {
  const opts = { ...defaultOptions, ...options }

  return defineAsyncComponent({
    loader: createRetryLoader(loader, opts.retryCount),
    loadingComponent: opts.loadingComponent as Component,
    errorComponent: opts.errorComponent as Component,
    delay: opts.delay || 200,
    timeout: opts.timeout || 10000,
    suspensible: false,
    onError(error: Error) {
      opts.onError?.(error)
    }
  })
}

/**
 * 预加载组件
 */
export function preloadComponent(componentPath: string) {
  // 使用动态 import 进行预加载
  import(/* webpackPrefetch: true */ `@/components/${componentPath}.vue`).catch((_error) => {})
}

/**
 * 批量预加载组件
 */
export function batchPreloadComponents(componentPaths: string[]) {
  const promises = componentPaths.map((path) => preloadComponent(path))
  Promise.allSettled(promises).then((results) => {
    const failed = results.filter((result) => result.status === 'rejected')
    if (failed.length > 0) {
    }
  })
}

/**
 * 创建带优先级的组件加载器
 */
export function createPriorityLoader() {
  type QueueItem = {
    loader: () => Promise<Component>
    priority: number
    resolve: (value: Component) => void
    reject: (reason: Error) => void
  }

  const queue: QueueItem[] = []

  let isProcessing = false

  const processQueue = async () => {
    if (isProcessing || queue.length === 0) return

    isProcessing = true

    // 按优先级排序
    queue.sort((a, b) => b.priority - a.priority)

    const { loader, resolve, reject } = queue.shift()!

    try {
      const component = await loader()
      resolve(component)
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)))
    } finally {
      isProcessing = false
      // 处理下一个
      processQueue()
    }
  }

  return (loader: () => Promise<Component>, priority: number = 0) => {
    return new Promise<Component>((resolve, reject) => {
      queue.push({ loader, priority, resolve, reject })
      processQueue()
    })
  }
}

/**
 * 创建虚拟滚动组件的懒加载
 */
export function createVirtualScrollAsyncComponent(
  loader: () => Promise<Component>,
  itemHeight: number,
  options: LazyLoadOptions = {}
) {
  const AsyncComponent = createOptimizedAsyncComponent(loader, options)

  return {
    ...AsyncComponent,
    itemHeight,
    prefetch: true // 启用预取
  }
}

/**
 * 组件缓存管理
 */
class ComponentCache {
  private cache = new Map<string, Component>()
  private maxCacheSize = 50

  set(key: string, component: Component) {
    if (this.cache.size >= this.maxCacheSize) {
      // 删除最旧的缓存
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }
    this.cache.set(key, component)
  }

  get(key: string) {
    return this.cache.get(key)
  }

  has(key: string) {
    return this.cache.has(key)
  }

  clear() {
    this.cache.clear()
  }
}

export const componentCache = new ComponentCache()

/**
 * 创建带缓存的组件加载器
 */
export function createCachedLoader(loader: () => Promise<Component>, cacheKey: string) {
  return async () => {
    if (componentCache.has(cacheKey)) {
      return componentCache.get(cacheKey)
    }

    const component = await loader()
    componentCache.set(cacheKey, component)
    return component
  }
}

/**
 * 预加载策略
 */
export const preloadStrategies = {
  // 立即预加载
  immediate: (paths: string[]) => batchPreloadComponents(paths),

  // 空闲时预加载
  whenIdle: (paths: string[]) => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        batchPreloadComponents(paths)
      })
    } else {
      // 降级方案
      setTimeout(() => {
        batchPreloadComponents(paths)
      }, 100)
    }
  },

  // 用户交互时预加载
  onInteraction: (paths: string[], event: string) => {
    const handleInteraction = () => {
      batchPreloadComponents(paths)
      document.removeEventListener(event, handleInteraction)
    }
    document.addEventListener(event, handleInteraction, { once: true })
  },

  // 可视时预加载
  whenVisible: (paths: string[], element?: HTMLElement) => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          batchPreloadComponents(paths)
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )

    if (element) {
      observer.observe(element)
    } else {
      observer.observe(document.body)
    }
  }
}

/**
 * 使用示例：
 *
 * // 基础懒加载
 * const LazyComponent = createOptimizedAsyncComponent(() => import('./MyComponent.vue'))
 *
 * // 带自定义配置
 * const LazyComponent = createOptimizedAsyncComponent(
 *   () => import('./MyComponent.vue'),
 *   { timeout: 5000, retryCount: 5 }
 * )
 *
 * // 预加载关键组件
 * preloadStrategies.whenIdle([
 *   'chat/ChatWindow',
 *   'message/MessageList',
 *   'user/UserProfile'
 * ])
 */
