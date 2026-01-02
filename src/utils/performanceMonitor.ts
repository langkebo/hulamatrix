/**
 * Performance Monitoring and Testing Utilities for Mobile
 *
 * Features:
 * - FPS monitoring
 * - Memory tracking
 * - Render performance measurement
 * - Network performance tracking
 * - Component render time analysis
 */

import { ref, type Ref } from 'vue'
import { logger } from '@/utils/logger'

// ==================== Types ====================

export interface PerformanceMetrics {
  fps: number
  memory: {
    used: number
    total: number
    limit: number
    usedJSHeapSize: number
    totalJSHeapSize: number
    jsHeapSizeLimit: number
  } | null
  renderTime: number
  networkLatency: number
}

export interface PerformanceReport {
  timestamp: number
  metrics: PerformanceMetrics
  issues: PerformanceIssue[]
}

export interface PerformanceIssue {
  type: 'low-fps' | 'high-memory' | 'slow-render' | 'network-issue'
  severity: 'warning' | 'error' | 'critical'
  message: string
  value: number
  threshold: number
}

export interface ComponentPerformanceData {
  name: string
  renderCount: number
  totalRenderTime: number
  avgRenderTime: number
  maxRenderTime: number
  lastRenderTime: number
}

// ==================== FPS Monitor ====================

export class FPSMonitor {
  private frames: number[] = []
  private lastTime = performance.now()
  private isRunning = false
  private animationFrameId: number | null = null
  private fpsCallback?: (fps: number) => void

  start(callback?: (fps: number) => void) {
    if (this.isRunning) return

    this.isRunning = true
    this.fpsCallback = callback
    this.lastTime = performance.now()
    this.frames = []
    this.tick()

    logger.info('[FPSMonitor] Started monitoring')
  }

  stop() {
    if (!this.isRunning) return

    this.isRunning = false
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }

    logger.info('[FPSMonitor] Stopped monitoring')
  }

  private tick = () => {
    if (!this.isRunning) return

    const now = performance.now()
    const delta = now - this.lastTime

    this.frames.push(delta)
    this.lastTime = now

    // Keep only last 60 frames (~1 second)
    if (this.frames.length > 60) {
      this.frames.shift()
    }

    // Calculate FPS every second
    if (this.frames.length >= 60) {
      const avgFrameTime = this.frames.reduce((a, b) => a + b, 0) / this.frames.length
      const fps = Math.round(1000 / avgFrameTime)

      if (this.fpsCallback) {
        this.fpsCallback(fps)
      }
    }

    this.animationFrameId = requestAnimationFrame(this.tick)
  }

  getFPS(): number {
    if (this.frames.length === 0) return 0

    const avgFrameTime = this.frames.reduce((a, b) => a + b, 0) / this.frames.length
    return Math.round(1000 / avgFrameTime)
  }
}

// ==================== Memory Monitor ====================

export class MemoryMonitor {
  private measurements: number[] = []
  private isRunning = false
  private intervalId: number | null = null
  private memoryCallback?: (memory: PerformanceMetrics['memory']) => void

  start(interval: number = 1000, callback?: (memory: PerformanceMetrics['memory']) => void) {
    if (this.isRunning) return
    if (!(performance as any).memory) {
      logger.warn('[MemoryMonitor] Memory API not available')
      return
    }

    this.isRunning = true
    this.memoryCallback = callback

    this.intervalId = window.setInterval(() => {
      this.measure()
    }, interval)

    logger.info('[MemoryMonitor] Started monitoring')
  }

  stop() {
    if (!this.isRunning) return

    this.isRunning = false
    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    logger.info('[MemoryMonitor] Stopped monitoring')
  }

  private measure() {
    const memory = (performance as any).memory
    if (!memory) return null

    const used = memory.usedJSHeapSize
    this.measurements.push(used)

    // Keep only last 60 measurements
    if (this.measurements.length > 60) {
      this.measurements.shift()
    }

    const data = {
      used: memory.usedJSHeapSize,
      total: memory.totalJSHeapSize,
      limit: memory.jsHeapSizeLimit,
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit
    }

    if (this.memoryCallback) {
      this.memoryCallback(data)
    }

    return data
  }

  getMemory(): PerformanceMetrics['memory'] {
    const memory = (performance as any).memory
    if (!memory) return null

    return {
      used: memory.usedJSHeapSize,
      total: memory.totalJSHeapSize,
      limit: memory.jsHeapSizeLimit,
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit
    }
  }

  formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`
  }
}

// ==================== Render Time Monitor ====================

export class RenderMonitor {
  private renderTimes: Map<string, number[]> = new Map()
  private isRunning = false

  start() {
    this.isRunning = true
    logger.info('[RenderMonitor] Started monitoring')
  }

  stop() {
    this.isRunning = false
    logger.info('[RenderMonitor] Stopped monitoring')
  }

  recordRender(componentName: string, duration: number) {
    if (!this.isRunning) return

    if (!this.renderTimes.has(componentName)) {
      this.renderTimes.set(componentName, [])
    }

    const times = this.renderTimes.get(componentName)!
    times.push(duration)

    // Keep only last 100 measurements
    if (times.length > 100) {
      times.shift()
    }
  }

  getComponentStats(componentName: string): ComponentPerformanceData | null {
    const times = this.renderTimes.get(componentName)
    if (!times || times.length === 0) return null

    const total = times.reduce((a, b) => a + b, 0)
    const avg = total / times.length
    const max = Math.max(...times)

    return {
      name: componentName,
      renderCount: times.length,
      totalRenderTime: total,
      avgRenderTime: avg,
      maxRenderTime: max,
      lastRenderTime: times[times.length - 1]
    }
  }

  getAllStats(): ComponentPerformanceData[] {
    const stats: ComponentPerformanceData[] = []

    for (const [name, times] of this.renderTimes.entries()) {
      if (times.length > 0) {
        const data = this.getComponentStats(name)
        if (data) stats.push(data)
      }
    }

    return stats.sort((a, b) => b.avgRenderTime - a.avgRenderTime)
  }
}

// ==================== Network Monitor ====================

export class NetworkMonitor {
  private measurements: number[] = []

  start() {
    logger.info('[NetworkMonitor] Started monitoring')
  }

  stop() {
    logger.info('[NetworkMonitor] Stopped monitoring')
  }

  async measureLatency(url: string = '/api/ping'): Promise<number> {
    const start = performance.now()

    try {
      await fetch(url, { method: 'HEAD', cache: 'no-store' })
      const latency = performance.now() - start

      this.measurements.push(latency)

      // Keep only last 50 measurements
      if (this.measurements.length > 50) {
        this.measurements.shift()
      }

      return latency
    } catch (error) {
      logger.error('[NetworkMonitor] Failed to measure latency:', error)
      return -1
    }
  }

  getAverageLatency(): number {
    if (this.measurements.length === 0) return 0
    return this.measurements.reduce((a, b) => a + b, 0) / this.measurements.length
  }

  getLatencyStats(): { min: number; max: number; avg: number; current: number } {
    if (this.measurements.length === 0) {
      return { min: 0, max: 0, avg: 0, current: 0 }
    }

    return {
      min: Math.min(...this.measurements),
      max: Math.max(...this.measurements),
      avg: this.getAverageLatency(),
      current: this.measurements[this.measurements.length - 1]
    }
  }
}

// ==================== Performance Analyzer ====================

export class PerformanceAnalyzer {
  private fpsMonitor = new FPSMonitor()
  private memoryMonitor = new MemoryMonitor()
  private renderMonitor = new RenderMonitor()
  private networkMonitor = new NetworkMonitor()

  private metrics: Ref<PerformanceMetrics> = ref({
    fps: 0,
    memory: null,
    renderTime: 0,
    networkLatency: 0
  })

  private thresholds = {
    minFPS: 30,
    minMemory: 100 * 1024 * 1024, // 100MB
    maxRenderTime: 16, // 60fps = 16.67ms per frame
    maxNetworkLatency: 1000
  }

  start() {
    // Start FPS monitoring
    this.fpsMonitor.start((fps) => {
      this.metrics.value.fps = fps
    })

    // Start memory monitoring
    this.memoryMonitor.start(2000, (memory) => {
      this.metrics.value.memory = memory
    })

    // Start render monitoring
    this.renderMonitor.start()

    // Start network monitoring
    this.networkMonitor.start()

    logger.info('[PerformanceAnalyzer] Started monitoring')
  }

  stop() {
    this.fpsMonitor.stop()
    this.memoryMonitor.stop()
    this.renderMonitor.stop()
    this.networkMonitor.stop()

    logger.info('[PerformanceAnalyzer] Stopped monitoring')
  }

  getMetrics(): PerformanceMetrics {
    return this.metrics.value
  }

  analyze(): PerformanceReport {
    const metrics = this.metrics.value
    const issues: PerformanceIssue[] = []

    // Check FPS
    if (metrics.fps < this.thresholds.minFPS) {
      issues.push({
        type: 'low-fps',
        severity: metrics.fps < 20 ? 'critical' : 'warning',
        message: `FPS below threshold (${metrics.fps} < ${this.thresholds.minFPS})`,
        value: metrics.fps,
        threshold: this.thresholds.minFPS
      })
    }

    // Check Memory
    if (metrics.memory) {
      const memoryPercent = (metrics.memory.used / metrics.memory.limit) * 100
      if (memoryPercent > 80) {
        issues.push({
          type: 'high-memory',
          severity: memoryPercent > 90 ? 'critical' : 'warning',
          message: `High memory usage (${memoryPercent.toFixed(1)}%)`,
          value: memoryPercent,
          threshold: 80
        })
      }
    }

    // Check render times
    const slowRenders = this.renderMonitor.getAllStats().filter((s) => s.avgRenderTime > this.thresholds.maxRenderTime)

    if (slowRenders.length > 0) {
      issues.push({
        type: 'slow-render',
        severity: 'warning',
        message: `${slowRenders.length} components with slow render times`,
        value: slowRenders.length,
        threshold: 0
      })
    }

    // Check network latency
    const latency = this.networkMonitor.getAverageLatency()
    if (latency > this.thresholds.maxNetworkLatency) {
      issues.push({
        type: 'network-issue',
        severity: 'warning',
        message: `High network latency (${latency.toFixed(0)}ms)`,
        value: latency,
        threshold: this.thresholds.maxNetworkLatency
      })
    }

    return {
      timestamp: Date.now(),
      metrics,
      issues
    }
  }

  getReport(): string {
    const report = this.analyze()
    const metrics = report.metrics

    let output = '=== Performance Report ===\n\n'
    output += `FPS: ${metrics.fps}\n`

    if (metrics.memory) {
      const memMonitor = new MemoryMonitor()
      output += `Memory: ${memMonitor.formatBytes(metrics.memory.used)} / ${memMonitor.formatBytes(metrics.memory.limit)}\n`
    }

    output += `Network Latency: ${metrics.networkLatency.toFixed(0)}ms\n`

    if (report.issues.length > 0) {
      output += '\n=== Issues ===\n'
      report.issues.forEach((issue, index) => {
        output += `${index + 1}. [${issue.severity.toUpperCase()}] ${issue.message}\n`
      })
    } else {
      output += '\n✅ No performance issues detected'
    }

    return output
  }

  getRenderMonitor() {
    return this.renderMonitor
  }

  getNetworkMonitor() {
    return this.networkMonitor
  }
}

// ==================== Vue Composable ====================

let globalAnalyzer: PerformanceAnalyzer | null = null

export function usePerformanceMonitor() {
  if (!globalAnalyzer) {
    globalAnalyzer = new PerformanceAnalyzer()
  }

  const isMonitoring = ref(false)
  const metrics = ref<PerformanceMetrics>({
    fps: 0,
    memory: null,
    renderTime: 0,
    networkLatency: 0
  })

  const startMonitoring = () => {
    if (isMonitoring.value) return

    globalAnalyzer!.start()
    isMonitoring.value = true

    // Update metrics periodically
    const interval = setInterval(() => {
      metrics.value = globalAnalyzer!.getMetrics()
    }, 1000)

    // Store interval ID for cleanup
    ;(startMonitoring as any).intervalId = interval
  }

  const stopMonitoring = () => {
    if (!isMonitoring.value) return

    globalAnalyzer!.stop()
    isMonitoring.value = false

    const intervalId = (startMonitoring as any).intervalId
    if (intervalId) {
      clearInterval(intervalId)
    }
  }

  const analyze = () => {
    return globalAnalyzer!.analyze()
  }

  const getReport = () => {
    return globalAnalyzer!.getReport()
  }

  const getSlowComponents = () => {
    return globalAnalyzer!.getRenderMonitor().getAllStats()
  }

  const measureNetworkLatency = async (url?: string) => {
    return await globalAnalyzer!.getNetworkMonitor().measureLatency(url)
  }

  return {
    isMonitoring,
    metrics,
    startMonitoring,
    stopMonitoring,
    analyze,
    getReport,
    getSlowComponents,
    measureNetworkLatency
  }
}

// ==================== Benchmark Utilities ====================

export interface BenchmarkConfig {
  iterations: number
  warmupIterations: number
}

export interface BenchmarkResult {
  name: string
  iterations: number
  totalTime: number
  avgTime: number
  minTime: number
  maxTime: number
  opsPerSecond: number
}

export async function runBenchmark(
  name: string,
  fn: () => void | Promise<void>,
  config: BenchmarkConfig = { iterations: 100, warmupIterations: 10 }
): Promise<BenchmarkResult> {
  const { iterations, warmupIterations } = config

  // Warmup
  for (let i = 0; i < warmupIterations; i++) {
    await fn()
  }

  // Actual benchmark
  const times: number[] = []

  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    await fn()
    const end = performance.now()
    times.push(end - start)
  }

  const totalTime = times.reduce((a, b) => a + b, 0)
  const avgTime = totalTime / iterations
  const minTime = Math.min(...times)
  const maxTime = Math.max(...times)
  const opsPerSecond = 1000 / avgTime

  const result: BenchmarkResult = {
    name,
    iterations,
    totalTime,
    avgTime,
    minTime,
    maxTime,
    opsPerSecond
  }

  logger.info(`[Benchmark] ${name}:`, result)

  return result
}

export function formatBenchmarkResult(result: BenchmarkResult): string {
  return `
=== ${result.name} ===
Iterations: ${result.iterations}
Total Time: ${result.totalTime.toFixed(2)}ms
Average: ${result.avgTime.toFixed(4)}ms
Min: ${result.minTime.toFixed(4)}ms
Max: ${result.maxTime.toFixed(4)}ms
Ops/sec: ${result.opsPerSecond.toFixed(2)}
  `.trim()
}
