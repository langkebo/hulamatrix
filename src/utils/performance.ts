/**
 * Performance Optimization Utilities
 *
 * Collection of utility functions and composables for optimizing
 * component performance through memoization, debouncing, and throttling.
 *
 * @module utils/performance
 */

import {
  computed,
  type ComputedRef,
  type Ref,
  shallowRef,
  type ShallowRef
} from 'vue'
import {
  useDebounceFn,
  useThrottleFn,
  type MaybeComputedRef,
  type EventHookOn
} from '@vueuse/core'

// ============================================
// Type Definitions
// ============================================

export type MemoizeOptions<T> = {
  key?: (item: T) => string | number
  equalityFn?: (a: T, b: T) => boolean
}

export type LazyComputedOptions<T> = {
  initialValue?: T
  shouldRecompute?: () => boolean
}

// ============================================
// Memoization Utilities
// ============================================

/**
 * Memoize array transformation to avoid re-computing on every render
 *
 * @example
 * ```ts
 * const adaptedFriends = memoizeArray(
 *   () => friends.value,
 *   () => friends.value.map(f => adaptFriend(f)),
 *   { key: (f) => f.friend_id }
 * )
 * ```
 */
export function memoizeArray<T, R>(
  source: () => T[],
  transform: (items: T[]) => R[],
  options?: MemoizeOptions<T>
): ComputedRef<R[]> {
  const cache = new Map<string | number, R>()
  const previousSource: ShallowRef<string> = shallowRef('')

  return computed(() => {
    const items = source()
    const sourceKey = JSON.stringify(items.map(options?.key || ((item) => item)))

    // Return cached result if source hasn't changed
    if (sourceKey === previousSource.value && cache.size > 0) {
      return Array.from(cache.values())
    }

    previousSource.value = sourceKey
    cache.clear()

    // Transform and cache each item
    for (const item of items) {
      const key = options?.key ? options.key(item) : (item as unknown as string | number)
      const transformed = transform([item])[0]
      cache.set(key, transformed)
    }

    return Array.from(cache.values())
  })
}

/**
 * Memoize expensive function calls
 *
 * @example
 * ```ts
 * const expensiveCompute = memoize((n: number) => {
 *   return fib(n) // Some expensive computation
 * })
 * ```
 */
export function memoize<Args extends unknown[], Return>(
  fn: (...args: Args) => Return,
  keyGenerator?: (...args: Args) => string
): (...args: Args) => Return {
  const cache = new Map<string, Return>()

  return (...args: Args): Return => {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args)

    if (cache.has(key)) {
      return cache.get(key)!
    }

    const result = fn(...args)
    cache.set(key, result)
    return result
  }
}

/**
 * Clear memoization cache
 */
export function clearMemoizationCache(): void {
  // Global cache clearing if needed
}

// ============================================
// Lazy Computed Properties
// ============================================

/**
 * Create a computed that only recalculates when explicitly needed
 *
 * @example
 * ```ts
 * const expensiveValue = lazyComputed(
 *   () => data.value,
 *   () => calculateExpensive(data.value),
 *   { initialValue: null }
 * )
 * ```
 */
export function lazyComputed<T>(
  source: () => T,
  fn: (value: T) => unknown,
  options?: LazyComputedOptions<unknown>
): ComputedRef<unknown> {
  const cachedValue: Ref<unknown> = shallowRef(options?.initialValue)
  const isDirty: Ref<boolean> = shallowRef(true)

  return computed(() => {
    const shouldRecompute = options?.shouldRecompute?.() ?? isDirty.value

    if (shouldRecompute) {
      cachedValue.value = fn(source())
      isDirty.value = false
    }

    return cachedValue.value
  })
}

// ============================================
// Debounce and Throttle Wrappers
// ============================================

/**
 * Create a debounced version of a computed property
 *
 * @example
 * ```ts
 * const debouncedSearchQuery = debouncedComputed(
 *   () => searchQuery.value,
 *   300
 * )
 * ```
 */
export function debouncedComputed<T>(
  source: () => T,
  delay: number
): ComputedRef<T> {
  const debounced = useDebounceFn(source, delay)
  const cached: Ref<T> = shallowRef(source()) as Ref<T>

  // Update cached value immediately for initial render
  const result = computed(() => {
    const newValue = debounced()
    cached.value = newValue
    return cached.value
  })

  return result
}

/**
 * Create a throttled version of a computed property
 *
 * @example
 * ```ts
 * const throttledScrollPos = throttledComputed(
 *   () => scrollPosition.value,
 *   100
 * )
 * ```
 */
export function throttledComputed<T>(
  source: () => T,
  limit: number
): ComputedRef<T> {
  const throttled = useThrottleFn(source, limit)
  const cached: Ref<T> = shallowRef(source()) as Ref<T>

  const result = computed(() => {
    const newValue = throttled()
    cached.value = newValue
    return cached.value
  })

  return result
}

// ============================================
// Batch Updates
// ============================================

/**
 * Batch multiple state updates to reduce re-renders
 *
 * @example
 * ```ts
 * batchUpdates(() => {
 *   state.value1 = newValue1
 *   state.value2 = newValue2
 *   state.value3 = newValue3
 * })
 * ```
 */
export function batchUpdates(fn: () => void): void {
  // Vue 3 automatically batches updates in most cases
  // This is a placeholder for explicit batching if needed
  fn()
}

// ============================================
// Performance Monitoring
// ============================================

export interface PerformanceMetrics {
  renderTime: number
  memoryUsage: number
  timestamp: number
}

const metricsStore = new Map<string, PerformanceMetrics[]>()

/**
 * Record performance metrics for a component
 */
export function recordPerformance(
  componentName: string,
  metrics: Partial<PerformanceMetrics>
): void {
  const entry: PerformanceMetrics = {
    renderTime: metrics.renderTime ?? 0,
    memoryUsage: metrics.memoryUsage ?? performance.memory?.usedJSHeapSize ?? 0,
    timestamp: Date.now()
  }

  if (!metricsStore.has(componentName)) {
    metricsStore.set(componentName, [])
  }

  const metricsArray = metricsStore.get(componentName)!
  metricsArray.push(entry)

  // Keep only last 100 entries
  if (metricsArray.length > 100) {
    metricsArray.shift()
  }
}

/**
 * Get average render time for a component
 */
export function getAverageRenderTime(componentName: string): number {
  const metrics = metricsStore.get(componentName)
  if (!metrics || metrics.length === 0) return 0

  const total = metrics.reduce((sum, m) => sum + m.renderTime, 0)
  return total / metrics.length
}

/**
 * Measure execution time of a function
 *
 * @example
 * ```ts
 * const result = measurePerformance('myFunction', () => {
 *   return expensiveOperation()
 * })
 * ```
 */
export function measurePerformance<T>(
  label: string,
  fn: () => T
): T {
  const start = performance.now()
  const result = fn()
  const end = performance.now()

  recordPerformance(label, { renderTime: end - start })

  return result
}

// ============================================
// Async Performance Utilities
// ============================================

/**
 * Create a cancellable async operation
 *
 * @example
 * ```ts
 * const { execute, cancel } = createCancellable(async () => {
 *   const data = await fetchData()
 *   return processData(data)
 * })
 *
 * await execute()
 * ```
 */
export function createCancellable<T>(fn: () => Promise<T>) {
  let abortController = new AbortController()

  const execute = async (): Promise<T> => {
    abortController = new AbortController()
    return fn()
  }

  const cancel = () => {
    abortController.abort()
  }

  return { execute, cancel }
}

/**
 * Run async operations in parallel with concurrency limit
 *
 * @example
 * ```ts
 * const results = await parallel(
 *   items.map(item => () => processItem(item)),
 *   4 // Max 4 concurrent operations
 * )
 * ```
 */
export async function parallel<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = []
  const executing: Promise<void>[] = []

  for (const task of tasks) {
    const promise = task().then((result) => {
      results.push(result)
      executing.splice(executing.indexOf(promise), 1)
    })

    executing.push(promise)

    if (executing.length >= concurrency) {
      await Promise.race(executing)
    }
  }

  await Promise.all(executing)
  return results
}

// ============================================
// Request Animation Frame Throttle
// ============================================

/**
 * Throttle function using requestAnimationFrame
 *
 * @example
 * ```ts
 * const throttledScroll = rafThrottle(() => {
 *   handleScroll()
 * })
 * ```
 */
export function rafThrottle<T extends (...args: unknown[]) => void>(fn: T): T {
  let rafId: number | null = null

  return ((...args: unknown[]) => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
    }

    rafId = requestAnimationFrame(() => {
      fn(...args)
      rafId = null
    })
  }) as T
}

// ============================================
// Idle Callback Utilities
// ============================================

/**
 * Run function during browser idle time
 *
 * @example
 * ```ts
 * runWhenIdle(() => {
 *   // Non-critical work
 *   preloadData()
 * })
 * ```
 */
export function runWhenIdle(
  fn: () => void,
  timeout?: number
): void {
  if ('requestIdleCallback' in window) {
    ;(window as any).requestIdleCallback(() => fn(), { timeout })
  } else {
    // Fallback: use setTimeout
    setTimeout(fn, 1)
  }
}

/**
 * Schedule multiple tasks to run during idle time
 *
 * @example
 * ```ts
 * scheduleIdleTasks([
 *   () => preloadComponent1(),
 *   () => preloadComponent2(),
 *   () => preloadComponent3()
 * ])
 * ```
 */
export function scheduleIdleTasks(tasks: (() => void)[]): void {
  let index = 0

  function runNext() {
    if (index >= tasks.length) return

    const task = tasks[index++]
    task()

    runWhenIdle(runNext)
  }

  runWhenIdle(runNext)
}
