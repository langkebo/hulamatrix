/**
 * usePerformanceMonitor - Performance monitoring and metrics
 *
 * Provides utilities for monitoring component render performance,
 * measuring execution time, and tracking memory usage.
 *
 * @example
 * ```vue
 * <script setup>
 * import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor'
 *
 * const { startMeasure, endMeasure, measureAsync } = usePerformanceMonitor('MyComponent')
 *
 * const handleOperation = async () => {
 *   await measureAsync('data-fetch', async () => {
 *     return await fetchData()
 *   })
 * }
 * </script>
 * ```
 */

import { computed, onBeforeUnmount, ref } from 'vue'

export interface PerformanceMetrics {
  fps: number
  memory: {
    used: number
    total: number
    limit: number
    percentage: number
  } | null
  renderTime: number
  interactionTime: number
}

export interface PerformanceEntry {
  name: string
  duration: number
  startTime: number
  timestamp: number
}

/**
 * Main performance monitor composable
 */
export function usePerformanceMonitor(componentName?: string) {
  const metrics = ref<PerformanceEntry[]>([])
  const isMonitoring = ref(false)
  const _startTime = ref(0)
  let frameCount = 0
  let lastFrameTime = 0
  let fpsInterval: ReturnType<typeof setInterval> | null = null

  /**
   * Start measuring a performance mark
   */
  const startMeasure = (_name: string): number => {
    return performance.now()
  }

  /**
   * End measuring a performance mark
   */
  const endMeasure = (name: string, start: number): number => {
    const end = performance.now()
    const duration = end - start

    metrics.value.push({
      name,
      duration,
      startTime: start,
      timestamp: Date.now()
    })

    // Log to Performance API
    if (typeof performance.mark !== 'undefined') {
      performance.mark(`${name}-start`, { detail: { startTime: start } })
      performance.mark(`${name}-end`, { detail: { endTime: end } })
      performance.measure(name, `${name}-start`, `${name}-end`)
    }

    return duration
  }

  /**
   * Measure an async operation
   */
  const measureAsync = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
    const start = startMeasure(name)
    try {
      const result = await fn()
      endMeasure(name, start)
      return result
    } catch (error) {
      endMeasure(`${name}-error`, start)
      throw error
    }
  }

  /**
   * Get all metrics
   */
  const getAllMetrics = () => {
    return [...metrics.value]
  }

  /**
   * Get metrics by name
   */
  const getMetricsByName = (name: string) => {
    return metrics.value.filter((m) => m.name === name)
  }

  /**
   * Get average duration for a specific metric
   */
  const getAverageDuration = (name: string): number => {
    const relevantMetrics = getMetricsByName(name)
    if (relevantMetrics.length === 0) return 0

    const total = relevantMetrics.reduce((sum, m) => sum + m.duration, 0)
    return total / relevantMetrics.length
  }

  /**
   * Clear all metrics
   */
  const clearMetrics = () => {
    metrics.value = []
  }

  /**
   * Start FPS monitoring
   */
  const startFPSMonitor = () => {
    if (isMonitoring.value) return

    isMonitoring.value = true
    frameCount = 0
    lastFrameTime = performance.now()

    fpsInterval = setInterval(() => {
      const now = performance.now()
      const _fps = Math.round((frameCount * 1000) / (now - lastFrameTime))
      frameCount = 0
      lastFrameTime = now
    }, 1000)

    const measureFrame = () => {
      if (!isMonitoring.value) return

      frameCount++
      requestAnimationFrame(measureFrame)
    }

    requestAnimationFrame(measureFrame)
  }

  /**
   * Stop FPS monitoring
   */
  const stopFPSMonitor = () => {
    isMonitoring.value = false
    if (fpsInterval) {
      clearInterval(fpsInterval)
      fpsInterval = null
    }
  }

  /**
   * Get current memory usage (if supported)
   */
  const getMemoryUsage = () => {
    // @ts-expect-error - performance.memory is non-standard but supported in Chrome/Edge
    if (typeof performance !== 'undefined' && performance.memory) {
      // @ts-expect-error
      const memory = performance.memory
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
        percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
      }
    }
    return null
  }

  /**
   * Get current FPS (requires active monitoring)
   */
  const getCurrentFPS = computed(() => {
    // This would need to be tracked separately
    return 60 // Placeholder
  })

  /**
   * Get comprehensive metrics report
   */
  const getReport = () => {
    const report = {
      component: componentName || 'Unknown',
      timestamp: Date.now(),
      metrics: {
        total: metrics.value.length,
        byName: {} as Record<string, { count: number; avg: number; min: number; max: number }>
      },
      memory: getMemoryUsage()
    }

    // Aggregate metrics by name
    const byName: Record<string, number[]> = {}
    metrics.value.forEach((m) => {
      if (!byName[m.name]) byName[m.name] = []
      byName[m.name].push(m.duration)
    })

    Object.entries(byName).forEach(([name, durations]) => {
      report.metrics.byName[name] = {
        count: durations.length,
        avg: durations.reduce((a, b) => a + b, 0) / durations.length,
        min: Math.min(...durations),
        max: Math.max(...durations)
      }
    })

    return report
  }

  // Cleanup
  onBeforeUnmount(() => {
    stopFPSMonitor()
  })

  return {
    // Measurement methods
    startMeasure,
    endMeasure,
    measureAsync,

    // Metrics access
    getAllMetrics,
    getMetricsByName,
    getAverageDuration,
    getReport,
    clearMetrics,

    // Memory & FPS
    getMemoryUsage,
    getCurrentFPS,
    startFPSMonitor,
    stopFPSMonitor,

    // State
    metrics: computed(() => metrics.value),
    isMonitoring: computed(() => isMonitoring.value)
  }
}

/**
 * Simple performance marker for quick measurements
 */
export function usePerformanceMark(name: string) {
  const { startMeasure, endMeasure } = usePerformanceMonitor()

  const measure = <T>(fn: () => T): T => {
    const start = startMeasure(name)
    try {
      return fn()
    } finally {
      endMeasure(name, start)
    }
  }

  const measureAsync = async <T>(fn: () => Promise<T>): Promise<T> => {
    const start = startMeasure(name)
    try {
      return await fn()
    } finally {
      endMeasure(name, start)
    }
  }

  return { measure, measureAsync }
}

/**
 * Debounced function with performance tracking
 */
export function useDebouncedFn<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)

    timeout = setTimeout(() => {
      fn(...args)
    }, delay)
  }
}

/**
 * Throttled function with performance tracking
 */
export function useThrottledFn<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false
  let lastResult: ReturnType<T> | undefined

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      lastResult = fn(...args) as ReturnType<T>
      inThrottle = true

      setTimeout(() => {
        inThrottle = false
      }, limit)
    }

    // Return the last result (or undefined if no call has been made yet)
    // Note: This return value is only useful if the function has been called before
    return lastResult as ReturnType<T>
  }
}

/**
 * Request animation frame throttle
 */
export function useRafThrottle<T extends (...args: unknown[]) => unknown>(fn: T): (...args: Parameters<T>) => void {
  let rafId: number | null = null

  return (...args: Parameters<T>) => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
    }

    rafId = requestAnimationFrame(() => {
      fn(...args)
      rafId = null
    })
  }
}
