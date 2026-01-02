import { getHistoryStats } from '@/integrations/matrix/history'
import { invoke } from '@tauri-apps/api/core'
import { logger } from '@/utils/logger'

// Vite 环境变量类型定义
interface ImportMetaEnv {
  PROD?: boolean
  VITE_PERFORMANCE_ENDPOINT?: string
  [key: string]: string | boolean | undefined
}

interface ImportMetaWithEnv {
  env: ImportMetaEnv
}

export function startHistoryMonitoring(intervalMs = 30000) {
  const tick = async () => {
    try {
      const front = getHistoryStats()
      let conflicts = 0
      let byRoom: Record<string, number> = {}
      try {
        conflicts = await invoke<number>('get_conflict_total')
        byRoom = (await invoke('get_conflict_by_room')) as Record<string, number>
      } catch {}
      const payload = { front, conflicts, byRoom }
      logger.info('[HistoryStats]', payload)

      // 类型安全的环境变量访问
      const meta = import.meta as unknown as ImportMetaWithEnv
      if (meta.env?.PROD && meta.env?.VITE_PERFORMANCE_ENDPOINT) {
        const url = String(meta.env.VITE_PERFORMANCE_ENDPOINT)
        try {
          await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'history_stats', payload, ts: Date.now() })
          })
        } catch {}
      }
    } catch {}
  }
  tick()
  const id = setInterval(tick, intervalMs)
  return () => clearInterval(id)
}
