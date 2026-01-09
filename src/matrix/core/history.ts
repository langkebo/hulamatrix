import { matrixClientService } from '@/matrix/core/client'
import { useChatStore } from '@/stores/chat'
import { sdkPageMessagesWithCursor } from '@/services/messages'
import type { MessageType } from '@/services/types'
import { MessageStatusEnum } from '@/enums'

// Chat store 接口扩展
interface ChatStoreExtended {
  addMessageToSessionList(message: MessageType): void
  checkMsgExist(roomId: string, msgId: string): boolean
  currentMessageOptions: { isLast: boolean; isLoading: boolean; cursor: string }
  messageOptions: Record<string, { isLast: boolean; isLoading: boolean; cursor: string }>
  messageMap: Record<string, Record<string, MessageType>>
}

type RoomBackfillState = { nextToken: string | null; fetchedCount: number }
const state: Record<string, RoomBackfillState> = {}
const duplicateStats: Record<string, number> = {}

function getState(roomId: string): RoomBackfillState {
  const s = state[roomId]
  if (s) return s
  const init = { nextToken: null, fetchedCount: 0 }
  state[roomId] = init
  return init
}

function mapEventToMessage(ev: unknown, roomId: string) {
  const event = ev as {
    type?: string
    event_id?: string
    origin_server_ts?: number
    sender?: string
    content?: Record<string, unknown>
  }
  const type = event.type
  if (type !== 'm.room.message') return null
  const id = event.event_id
  const ts = event.origin_server_ts || Date.now()
  const sender = event.sender || ''
  const content = event.content || {}
  const msgtype = content.msgtype as string | undefined
  const mappedType = (() => {
    if (msgtype === 'm.text') return 0
    if (msgtype === 'm.image') return 2
    if (msgtype === 'm.audio') return 4
    if (msgtype === 'm.video') return 3
    if (msgtype === 'm.file') return 5
    return 0
  })()
  const body = (() => {
    if (mappedType === 0) return { content: String(content.body || '') }
    return {
      url: (content.url || content['mxc_url']) as string | undefined,
      info: content.info,
      filename: content.filename
    }
  })()
  return {
    fromUser: { uid: sender, username: sender, avatar: '', locPlace: '' },
    message: {
      id,
      roomId,
      sendTime: ts,
      status: 1,
      type: mappedType,
      body,
      messageMarks: {}
    },
    sendTime: ts
  }
}

export async function fetchHistoryViaMessagesApi(roomId: string, limit = 20): Promise<number> {
  const client = matrixClientService.getClient()
  if (!client) return 0
  const chat = useChatStore()
  const s = getState(roomId)
  const fromToken = s.nextToken || undefined
  const messagesFn = (
    client as {
      messages?: (
        roomId: string,
        from: string | undefined,
        dir: 'b' | 'f',
        limit: number
      ) => Promise<{ chunk?: unknown[]; end?: string }>
    }
  ).messages
  if (!messagesFn) return 0
  const res = await messagesFn(roomId, fromToken, 'b', limit)
  const chunk: unknown[] = Array.isArray(res?.chunk) ? res.chunk : []
  s.nextToken = res?.end || null
  let pushed = 0
  for (let i = 0; i < chunk.length; i++) {
    const m = mapEventToMessage(chunk[i], roomId)
    if (!m || !m.message?.id) continue
    if (chat.checkMsgExist(roomId, m.message.id)) {
      duplicateStats[roomId] = (duplicateStats[roomId] || 0) + 1
      continue
    }
    const chatExtended = chat as unknown as ChatStoreExtended
    // 类型转换：将消息状态标准化为 MessageStatusEnum
    // 历史消息默认为已发送状态
    const messageWithCorrectStatus: MessageType = {
      ...m,
      message: {
        ...m.message,
        id: m.message.id, // Ensure id is defined after the check above
        status: MessageStatusEnum.SUCCESS // 历史消息都是已成功发送的
      }
    }
    chatExtended.addMessageToSessionList(messageWithCorrectStatus)
    pushed++
  }
  s.fetchedCount += pushed
  if (pushed === 0 && !s.nextToken) {
    const chatExtended = chat as unknown as ChatStoreExtended
    const opts = chatExtended.currentMessageOptions
    chatExtended.messageOptions[roomId] = { ...opts, isLast: true }
  }
  return pushed
}

export async function tryBackfillWhenNoPagination(roomId: string, limit = 20) {
  try {
    let attempts = 0
    while (attempts < 2) {
      const pushed = await fetchHistoryViaMessagesApi(roomId, limit)
      if (pushed > 0) break
      attempts++
      await new Promise((r) => setTimeout(r, 200 * attempts))
    }
  } catch {}
}

export async function prefetchShallowHistory(roomId: string, desired = 30) {
  try {
    const chat = useChatStore() as unknown as ChatStoreExtended
    const current = chat.messageMap[roomId] || {}
    const have = Object.keys(current).length
    if (have >= desired) return
    const missing = desired - have
    const page = await sdkPageMessagesWithCursor(roomId, missing, chat.messageOptions?.[roomId]?.cursor ?? '', true)
    const list = (page.data || []) as MessageType[]
    let pushed = 0
    for (const m of list) {
      if (!m?.message?.id) continue
      if (chat.checkMsgExist(roomId, m.message.id)) {
        duplicateStats[roomId] = (duplicateStats[roomId] || 0) + 1
        continue
      }
      chat.addMessageToSessionList(m)
      pushed++
    }
    if (pushed < missing) {
      await tryBackfillWhenNoPagination(roomId, Math.max(10, missing - pushed))
    }
  } catch {
    await tryBackfillWhenNoPagination(roomId, 20)
  }
}

export function getHistoryStats() {
  const fetched: Record<string, number> = {}
  for (const k of Object.keys(state)) {
    if (state[k]?.fetchedCount !== undefined) {
      fetched[k] = state[k]!.fetchedCount
    }
  }
  return { duplicateStats: { ...duplicateStats }, fetched }
}
