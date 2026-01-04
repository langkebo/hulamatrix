import { matrixClientService } from './client'
import { useChatStore } from '@/stores/chat'

// Type definitions for Matrix SDK objects
interface MatrixClientLike {
  sendEvent?(
    roomId: string,
    eventType: string,
    content: Record<string, unknown>
  ): Promise<SendEventResponse | undefined>
  getRoom?(roomId: string): MatrixRoomLike | undefined
  on?(event: string, handler: (...args: unknown[]) => void): void
  [key: string]: unknown
}

interface SendEventResponse {
  event_id?: string
  [key: string]: unknown
}

interface MatrixRoomLike {
  roomId?: string
  getThread?(threadId: string): ThreadLike | undefined
  [key: string]: unknown
}

interface ThreadLike {
  timeline?: unknown[]
  [key: string]: unknown
}

interface MatrixEventLike {
  getType?(): string
  getId?(): string
  getContent?<T = Record<string, unknown>>(): T
  getRoomId?(): string
  content?: Record<string, unknown>
  [key: string]: unknown
}

export async function createThreadReply(roomId: string, rootEventId: string, message: string): Promise<string> {
  const client = matrixClientService.getClient() as unknown as MatrixClientLike
  if (!client) throw new Error('Matrix 客户端未初始化')
  const content = { body: message, msgtype: 'm.text', 'm.relates_to': { rel_type: 'm.thread', event_id: rootEventId } }
  const res = await client.sendEvent?.(roomId, 'm.room.message', content)
  return res?.event_id || ''
}

export async function getThreadMessages(roomId: string, threadId: string, limit = 50): Promise<unknown[]> {
  const client = matrixClientService.getClient() as unknown as MatrixClientLike
  if (!client) throw new Error('Matrix 客户端未初始化')
  const room = client.getRoom?.(roomId)
  if (!room) return []
  const thread = room.getThread?.(threadId)
  if (!thread) return []
  const timeline = thread.timeline || []
  return timeline.slice(-limit)
}

export function setupMatrixThreadsBridge(): void {
  const client = matrixClientService.getClient() as unknown as MatrixClientLike
  if (!client) return
  const chat = useChatStore()
  client.on?.('Room.timeline', (event: unknown, room: unknown) => {
    const ev = event as Partial<MatrixEventLike>
    const roomLike = room as Partial<MatrixRoomLike>
    const type = typeof ev?.getType === 'function' ? ev.getType() : ''
    if (type !== 'm.room.message') return
    const content =
      typeof ev?.getContent === 'function' ? ev.getContent() : (ev?.content as Record<string, unknown> | undefined)
    const relates = content?.['m.relates_to'] as Record<string, unknown> | undefined
    if (relates?.rel_type === 'm.thread' && relates?.event_id) {
      const childId = typeof ev?.getId === 'function' ? ev.getId() : ''
      // 触发当前房间回复映射的初始化
      void chat.currentReplyMap
      chat.addThreadChild(
        String(relates.event_id),
        childId,
        roomLike?.roomId || (typeof ev?.getRoomId === 'function' ? ev.getRoomId() : '')
      )
    }
  })
}
