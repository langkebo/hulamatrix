import { matrixClientService } from './client'

export async function getMessageStatistics(
  roomId: string
): Promise<{ total: number; bySender: Record<string, number> }> {
  const client = matrixClientService.getClient()
  if (!client) throw new Error('Matrix 客户端未初始化')

  const clientWithGetRoom = client as {
    getRoom?: (roomId: string) => {
      getLiveTimeline?: () => {
        getEvents?: () => Array<{ getSender?: () => string }>
      } | null
    } | null
  } | null

  const room = clientWithGetRoom?.getRoom?.(roomId)
  const events = room?.getLiveTimeline?.()?.getEvents?.() || []
  const bySender: Record<string, number> = {}

  for (const ev of events) {
    const s = ev.getSender?.() || ''
    bySender[s] = (bySender[s] || 0) + 1
  }

  return { total: events.length, bySender }
}
