import { architectureSelector } from '@/utils/architecture-selector'
import { migrationManager } from '@/utils/migration-manager'

/**
 * 监控快照类型
 */
interface MonitorSnapshot {
  ts: number
  net: ReturnType<typeof architectureSelector.getNetworkMetrics>
  perf: ReturnType<typeof architectureSelector.getPerformanceMetrics>
  migrate: {
    messaging: ReturnType<typeof migrationManager.getStatus>
  }
}

export class TransitionMonitor {
  private logs: MonitorSnapshot[] = []

  async start(): Promise<void> {
    setInterval(() => {
      this.collect()
    }, 30000)
  }

  collect(): void {
    const net = architectureSelector.getNetworkMetrics()
    const perf = architectureSelector.getPerformanceMetrics()
    const snapshot: MonitorSnapshot = {
      ts: Date.now(),
      net,
      perf,
      migrate: {
        messaging: migrationManager.getStatus('messaging')
      }
    }
    this.logs.push(snapshot)
  }

  report(): { count: number; last?: MonitorSnapshot } {
    const last = this.logs[this.logs.length - 1]
    return last ? { count: this.logs.length, last } : { count: this.logs.length }
  }
}

export const transitionMonitor = new TransitionMonitor()
