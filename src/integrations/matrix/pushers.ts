import { matrixClientService } from './client'

interface MatrixClientLike {
  addPushRule?(scope: string, kind: string, ruleId: string, content: Record<string, unknown>): Promise<unknown>
  getNotifications?(opts: { limit: number }): Promise<{ notifications?: unknown[] } | undefined>
  [key: string]: unknown
}

export async function setupThreadPushRule(): Promise<void> {
  const client = matrixClientService.getClient() as unknown as MatrixClientLike
  if (!client) return
  try {
    const addPushRuleFn = client.addPushRule as
      | ((scope: string, kind: string, ruleId: string, content: Record<string, unknown>) => Promise<unknown>)
      | undefined
    await addPushRuleFn?.('global', 'override', '.m.thread', {
      conditions: [{ kind: 'event_match', key: 'type', pattern: 'm.room.message' }],
      actions: ['notify', { set_tweak: 'sound', value: 'thread' }]
    })
  } catch {}
}

export async function getNotificationHistory(limit = 20): Promise<unknown[]> {
  const client = matrixClientService.getClient() as unknown as MatrixClientLike
  if (!client) return []
  try {
    const getNotificationsFn = client.getNotifications as
      | ((opts: { limit: number }) => Promise<{ notifications?: unknown[] } | undefined>)
      | undefined
    const resp = await getNotificationsFn?.({ limit })
    return resp?.notifications || []
  } catch {
    return []
  }
}

export function setQuietHours(start: string, end: string): boolean {
  const isValid = /^\d{2}:\d{2}$/.test(start) && /^\d{2}:\d{2}$/.test(end)
  if (!isValid) return false
  try {
    localStorage.setItem('matrix-quiet-hours', JSON.stringify({ start, end }))
    return true
  } catch {
    return false
  }
}

export function getQuietHours(): { start: string; end: string } | null {
  try {
    const raw = localStorage.getItem('matrix-quiet-hours')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
