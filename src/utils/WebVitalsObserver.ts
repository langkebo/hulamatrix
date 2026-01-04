import { logger } from '@/utils/logger'

interface PaintMetric {
  id: string
  name: 'first-paint' | 'first-contentful-paint'
  startTime: number
  value: number
  entries: PerformanceEntry[]
}

type WebVitalMetric =
  | PaintMetric
  | {
      type: 'longtask'
      name: string
      startTime: number
      duration: number
      attribution?: Record<string, unknown>
    }

type Reporter = (metric: WebVitalMetric) => void

const defaultReporter: Reporter = (metric) => {
  const label = 'name' in metric ? metric.name : 'longtask'
  logger.info('[performance]', { label, metric })
}

export const startWebVitalObserver = (_reporter: Reporter = defaultReporter) => {
  try {
    if (!('PerformanceObserver' in window)) {
      logger.warn('[performance] PerformanceObserver not supported')
      return
    }
    const paintObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'paint') {
          const metric: PaintMetric = {
            id: `${entry.name}_${entry.startTime.toFixed(1)}`,
            name: entry.name as 'first-paint' | 'first-contentful-paint',
            startTime: entry.startTime,
            value: entry.startTime,
            entries: [entry]
          }
          _reporter(metric)
        }
      }
    })
    paintObserver.observe({ entryTypes: ['paint'] })
    try {
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'longtask') {
            _reporter({
              type: 'longtask',
              name: 'longtask',
              startTime: entry.startTime,
              duration: entry.duration
            })
          }
        }
      })
      longTaskObserver.observe({ entryTypes: ['longtask'] })
    } catch {}
  } catch (e) {
    logger.warn('[performance] observer init failed', e instanceof Error ? e : new Error(String(e)))
  }
}
