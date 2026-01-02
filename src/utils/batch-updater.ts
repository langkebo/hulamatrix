/**
 * 批量更新和节流工具
 * 用于优化频繁的状态更新，减少不必要的重渲染
 */

import { nextTick, Ref, ref } from 'vue'
import { debounce, throttle } from 'es-toolkit'

export interface BatchUpdateOptions {
  /** 批量更新延迟，毫秒 */
  delay?: number
  /** 最大批量大小 */
  maxBatchSize?: number
  /** 是否立即执行第一个更新 */
  immediate?: boolean
  /** 节流间隔 */
  throttleInterval?: number
}

/** Update function type */
export type UpdateFunction = () => void | Promise<void>

/** Arguments array type for throttled/debounced functions */
export type ArgumentsList = unknown[]

export class BatchUpdater {
  private queue: UpdateFunction[] = []
  private isProcessing = false
  private options: Required<BatchUpdateOptions>
  private pendingUpdates = new Set<string>()
  private triggerProcessBatch: () => void

  constructor(options: BatchUpdateOptions = {}) {
    this.options = {
      delay: 16, // ~60fps
      maxBatchSize: 100,
      immediate: true,
      throttleInterval: 100,
      ...options
    }

    // 创建防抖触发器
    this.triggerProcessBatch = debounce(() => {
      void this.processBatch()
    }, this.options.delay)
  }

  /** 添加更新到队列 */
  add(updateFn: UpdateFunction, id?: string) {
    // 如果有ID且已存在，跳过
    if (id && this.pendingUpdates.has(id)) {
      return
    }

    // 添加到队列
    this.queue.push(updateFn)

    // 记录ID
    if (id) {
      this.pendingUpdates.add(id)
    }

    // 立即处理第一个更新
    if (this.options.immediate && this.queue.length === 1) {
      nextTick(() => this.triggerProcessBatch())
    } else {
      this.triggerProcessBatch()
    }
  }

  /** 处理批量更新 */
  private async processBatch() {
    if (this.isProcessing || this.queue.length === 0) return

    this.isProcessing = true

    try {
      const batch = this.queue.splice(0, this.options.maxBatchSize)

      // 并行执行所有更新
      await Promise.all(batch.map((update) => update()))

      // 清理已完成的ID
      this.pendingUpdates.clear()

      // 如果还有待处理的更新，继续处理
      if (this.queue.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.options.delay))
        this.processBatch()
      }
    } finally {
      this.isProcessing = false
    }
  }

  /** 立即刷新所有待处理的更新 */
  async flush() {
    while (this.queue.length > 0) {
      await this.processBatch()
    }
  }

  /** 清空队列 */
  clear() {
    this.queue = []
    this.pendingUpdates.clear()
  }
}

/** 批量状态更新器 */
export class BatchStateUpdater<T extends Record<string, unknown>> {
  private batcher: BatchUpdater
  private state: Ref<T>
  private pending: Partial<T> = {}
  // 移除未使用的状态标记

  constructor(initialState: T, options?: BatchUpdateOptions) {
    this.state = ref(initialState) as Ref<T>
    this.batcher = new BatchUpdater(options)
  }

  /** 获取当前状态 */
  get value(): T {
    return this.state.value
  }

  /** 批量更新状态 */
  update(updates: Partial<T>) {
    // 合并更新
    Object.assign(this.pending, updates)

    // 添加到批量队列
    this.batcher.add(() => {
      if (Object.keys(this.pending).length > 0) {
        // 使用 Object.assign 保持响应性
        Object.assign(this.state.value, this.pending)
        this.pending = {}
      }
    }, 'state-update')
  }

  /** 立即应用所有待处理的更新 */
  async flush() {
    await this.batcher.flush()
  }
}

/** 创建节流函数 */
export function createThrottledUpdate<T extends ArgumentsList>(fn: (...args: T) => void, delay: number) {
  return throttle(fn, delay)
}

/** 创建防抖函数 */
export function createDebouncedUpdate<T extends ArgumentsList>(fn: (...args: T) => void, delay: number) {
  return debounce(fn, delay)
}

/** 批量DOM更新器 */
export class BatchDOMUpdater {
  private updates: Map<HTMLElement, Partial<CSSStyleDeclaration>> = new Map()
  private batcher: BatchUpdater

  constructor(options?: BatchUpdateOptions) {
    this.batcher = new BatchUpdater({
      delay: 0, // DOM更新应该尽快执行
      ...options
    })
  }

  /** 更新元素样式 */
  updateStyle(element: HTMLElement, styles: Partial<CSSStyleDeclaration>) {
    if (!this.updates.has(element)) {
      this.updates.set(element, {})
    }

    Object.assign(this.updates.get(element)!, styles)

    this.batcher.add(() => {
      const elementStyles = this.updates.get(element)
      if (elementStyles) {
        Object.assign(element.style, elementStyles)
        this.updates.delete(element)
      }
    }, `dom-${element.tagName}`)
  }

  /** 批量更新多个元素 */
  updateStyles(
    updates: Array<{
      element: HTMLElement
      styles: Partial<CSSStyleDeclaration>
    }>
  ) {
    updates.forEach(({ element, styles }) => {
      this.updateStyle(element, styles)
    })
  }
}

/** 虚拟列表优化器 */
export class VirtualListOptimizer {
  private visibleItems = new Set<number>()
  private itemHeight = 0
  private containerHeight = 0
  private scrollTop = 0
  private bufferSize = 5 // 上下缓冲区大小

  constructor(itemHeight: number, containerHeight: number) {
    this.itemHeight = itemHeight
    this.containerHeight = containerHeight
  }

  /** 更新滚动位置 */
  updateScrollTop(scrollTop: number) {
    this.scrollTop = scrollTop
    this.calculateVisibleItems()
  }

  /** 计算可见项目 */
  private calculateVisibleItems() {
    const startIndex = Math.floor(this.scrollTop / this.itemHeight)
    const endIndex = Math.ceil((this.scrollTop + this.containerHeight) / this.itemHeight)

    // 清空之前的项目
    this.visibleItems.clear()

    // 添加可见项目（包含缓冲区）
    for (let i = Math.max(0, startIndex - this.bufferSize); i <= endIndex + this.bufferSize; i++) {
      this.visibleItems.add(i)
    }
  }

  /** 获取应该渲染的项目索引 */
  getVisibleIndices(): number[] {
    return Array.from(this.visibleItems).sort((a, b) => a - b)
  }

  /** 获取可见项目数量 */
  getVisibleCount(): number {
    return this.visibleItems.size
  }

  /** 更新容器高度 */
  updateContainerHeight(height: number) {
    this.containerHeight = height
    this.calculateVisibleItems()
  }

  /** 更新项目高度 */
  updateItemHeight(height: number) {
    this.itemHeight = height
    this.calculateVisibleItems()
  }

  /** 计算总高度 */
  getTotalHeight(totalItems: number): number {
    return totalItems * this.itemHeight
  }

  /** 获取项目偏移量 */
  getItemOffset(index: number): number {
    return index * this.itemHeight
  }
}

/** 导出工厂函数 */
export function useBatchUpdater(options?: BatchUpdateOptions) {
  return new BatchUpdater(options)
}

export function useBatchStateUpdater<T extends Record<string, unknown>>(initialState: T, options?: BatchUpdateOptions) {
  return new BatchStateUpdater(initialState, options)
}

export function useBatchDOMUpdater(options?: BatchUpdateOptions) {
  return new BatchDOMUpdater(options)
}

export function useVirtualListOptimizer(itemHeight: number, containerHeight: number) {
  return new VirtualListOptimizer(itemHeight, containerHeight)
}

export function useBatchUpdaterWithDelay(opts: { delay: number }) {
  let queue: Array<() => void> = []
  let timer: ReturnType<typeof setTimeout> | null = null
  const flush = () => {
    const tasks = queue.slice()
    queue = []
    tasks.forEach((fn) => fn())
  }
  return {
    schedule(fn: () => void) {
      queue.push(fn)
      if (!timer) {
        timer = setTimeout(() => {
          timer = null
          flush()
        }, opts.delay)
      }
      return Promise.resolve()
    }
  }
}

export function useVirtualListOptimizerSimple(viewport: number, total: number) {
  return {
    visibleCount: Math.min(total, viewport),
    recompute() {
      return this.visibleCount
    }
  }
}
