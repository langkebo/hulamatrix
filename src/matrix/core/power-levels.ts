import { matrixClientService } from '@/matrix/core/client'

interface MatrixClientLike {
  getRoom?(roomId: string):
    | {
        currentState?: {
          getStateEvents?(type: string, stateKey: string): { getContent?(): Record<string, unknown> } | undefined
        }
      }
    | undefined
  sendStateEvent?(
    roomId: string,
    eventType: string,
    content: Record<string, unknown>,
    stateKey: string
  ): Promise<unknown>
  [key: string]: unknown
}

export async function getPowerLevels(roomId: string): Promise<Record<string, unknown>> {
  const client = matrixClientService.getClient() as unknown as MatrixClientLike
  if (!client) return {}
  const getRoomFn = client.getRoom as
    | ((roomId: string) =>
        | {
            currentState?: {
              getStateEvents?(type: string, stateKey: string): { getContent?(): Record<string, unknown> } | undefined
            }
          }
        | undefined)
    | undefined
  const room = getRoomFn?.(roomId)
  const ev = room?.currentState?.getStateEvents?.('m.room.power_levels', '')
  const getContentFn = ev?.getContent as (() => Record<string, unknown>) | undefined
  const content = getContentFn?.() || (ev as Record<string, unknown>) || {}
  return content || {}
}

export async function setPowerLevels(roomId: string, content: Record<string, unknown>): Promise<void> {
  const client = matrixClientService.getClient() as unknown as MatrixClientLike
  if (!client) return
  const sendStateEventFn = client.sendStateEvent as
    | ((roomId: string, eventType: string, content: Record<string, unknown>, stateKey: string) => Promise<unknown>)
    | undefined
  await sendStateEventFn?.(roomId, 'm.room.power_levels', content, '')
}
