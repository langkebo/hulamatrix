import { requestWithFallback } from '@/utils/MatrixApiBridgeAdapter'
import { matrixClientService } from '@/integrations/matrix/client'
import { MsgEnum, MessageStatusEnum } from '@/enums'
import type { MatrixEventLike } from '@/types/matrix'
import pLimit from 'p-limit'
import { MESSAGES_CONFIG } from '@/constants'

/** Extended Matrix event with both method and property access */
interface ExtendedMatrixEventLike extends MatrixEventLike {
  event_id?: string
  type?: string
  content?: MessageContent
  origin_server_ts?: number
  sender?: string
}

/** Matrix room with timeline */
interface MatrixRoomLike {
  getLiveTimeline?: () => MatrixTimelineLike
  timeline?: ExtendedMatrixEventLike[]
  getJoinedMembers?: () => MatrixMemberLike[]
  getMembers?: () => MatrixMemberLike[]
  getReceiptsForEvent?: (event: ExtendedMatrixEventLike) => MatrixReceiptLike[]
}

/** Matrix timeline */
interface MatrixTimelineLike {
  getEvents?: () => ExtendedMatrixEventLike[]
}

/** Matrix room member */
interface MatrixMemberLike {
  userId?: string
  name?: string
  avatarUrl?: string
}

/** Matrix read receipt */
interface MatrixReceiptLike {
  userId: string
  data?: Record<string, unknown>
}

/** Message content types */
interface MessageContent {
  body?: string
  url?: string
  mxc_url?: string
  info?: Record<string, unknown>
  msgtype?: string
  'm.relates_to'?: {
    event_type?: string
    event_id?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

/** Mapped message result */
interface MappedMessageResult {
  fromUser: {
    uid: string
    username: string
    avatar: string
    locPlace: string
  }
  message: {
    id: string
    roomId: string
    sendTime: number
    status: MessageStatusEnum
    type: MsgEnum
    body: Record<string, unknown>
    messageMarks: Record<string, unknown>
  }
  sendTime: number
  loading: boolean
}

export async function markRoomRead(roomId: string): Promise<void> {
  // Use unified message service for Matrix SDK integration
  const { unifiedMessageService } = await import('@/services/unified-message-service')
  await unifiedMessageService.markRoomRead(roomId)
}

export async function getSessionDetail(params: { id: string }): Promise<unknown> {
  return await requestWithFallback({
    url: 'get_session_detail',
    params
  })
}

export async function runInBatches<T, R>(
  items: T[],
  handler: (item: T) => Promise<R>,
  maxConcurrency: number = MESSAGES_CONFIG.MAX_CONCURRENCY
): Promise<PromiseSettledResult<R>[]> {
  const limit = pLimit(Math.max(1, maxConcurrency))
  const tasks = items.map((it) => limit(() => handler(it)))
  const results = await Promise.allSettled(tasks)
  return results
}

export const MESSAGES_POLICY = {
  DEFAULT_PAGE_SIZE: MESSAGES_CONFIG.DEFAULT_PAGE_SIZE,
  MAX_CONCURRENCY: MESSAGES_CONFIG.MAX_CONCURRENCY,
  MICRO_BATCH_WINDOW_MS: MESSAGES_CONFIG.MICRO_BATCH_WINDOW_MS
} as const

// ==================== Matrix SDK 桥接 ====================
export async function sdkPageMessages(
  roomId: string,
  limit: number = MESSAGES_CONFIG.DEFAULT_PAGE_SIZE,
  backwards: boolean = true
): Promise<MappedMessageResult[]> {
  const client = matrixClientService.getClient()
  if (!client) throw new Error('Matrix client 未初始化')
  const getRoomMethod = client.getRoom as ((roomId: string) => MatrixRoomLike | null) | undefined
  const room = getRoomMethod?.(roomId)
  if (!room) throw new Error(`未找到房间: ${roomId}`)
  const roomLike = room as MatrixRoomLike
  const live = room.getLiveTimeline?.() ?? roomLike.timeline
  const liveLike = live as MatrixTimelineLike | undefined

  const paginateMethod = client.paginateEventTimeline as
    | ((timeline: Record<string, unknown>, opts: { limit?: number; backwards?: boolean }) => Promise<unknown>)
    | undefined
  await paginateMethod?.(live as Record<string, unknown>, { limit, backwards })
  const events = typeof liveLike?.getEvents === 'function' ? liveLike.getEvents() : roomLike.timeline || []
  return events
    .map((e: unknown) => mapMatrixEventToMessage(e, roomId))
    .filter((m): m is MappedMessageResult => m !== null)
}

export async function sdkPageMessagesWithCursor(
  roomId: string,
  limit: number = MESSAGES_CONFIG.DEFAULT_PAGE_SIZE,
  cursor: string = '',
  backwards: boolean = true
): Promise<{ data: unknown[]; nextCursor: string; hasMore: boolean }> {
  const client = matrixClientService.getClient()
  if (!client) throw new Error('Matrix client 未初始化')

  // Wait for client to be fully ready (store initialized, sync started)
  const isReady = (matrixClientService as unknown as { isReady?: () => boolean }).isReady?.()
  if (!isReady) {
    const waitForReady = (matrixClientService as unknown as { waitForReady?: (timeout?: number) => Promise<boolean> })
      .waitForReady
    if (waitForReady) {
      const ready = await waitForReady(5000)
      if (!ready) {
        throw new Error('Matrix client 尚未准备好，请稍后重试')
      }
    }
  }

  // ✅ 检查 client.store 是否存在（getRoom 内部会使用）
  if (!client.store) {
    throw new Error('Matrix client store 未初始化，请等待同步完成')
  }

  // 检查 client 是否有 getRoom 方法
  const getRoomMethod = client.getRoom as ((roomId: string) => MatrixRoomLike | null) | undefined
  if (!getRoomMethod) {
    throw new Error('Matrix client 不支持 getRoom 方法')
  }

  const room = getRoomMethod(roomId)
  if (!room) {
    throw new Error(`未找到房间: ${roomId}`)
  }
  const roomLike = room as MatrixRoomLike
  const live = room.getLiveTimeline?.() ?? roomLike.timeline
  const liveLike = live as MatrixTimelineLike | undefined

  const ensureEvents = async (): Promise<ExtendedMatrixEventLike[]> => {
    const evs: ExtendedMatrixEventLike[] =
      typeof liveLike?.getEvents === 'function' ? liveLike.getEvents() : roomLike.timeline || []
    if (evs.length >= limit) return evs
    try {
      const paginateMethod = client.paginateEventTimeline as
        | ((timeline: Record<string, unknown>, opts: { limit?: number; backwards?: boolean }) => Promise<unknown>)
        | undefined
      await paginateMethod?.(live as Record<string, unknown>, { limit, backwards })
      const after: ExtendedMatrixEventLike[] =
        typeof liveLike?.getEvents === 'function' ? liveLike.getEvents() : roomLike.timeline || []
      return after.length ? after : evs
    } catch {
      return evs
    }
  }

  let events: ExtendedMatrixEventLike[] = await ensureEvents()

  if (cursor) {
    let idx = events.findIndex((e: ExtendedMatrixEventLike) => (e.getId?.() || e.event_id) === cursor)
    let attempts = 0
    while (idx === -1 && attempts < 3) {
      try {
        const paginateMethod = client.paginateEventTimeline as
          | ((timeline: Record<string, unknown>, opts: { limit?: number; backwards?: boolean }) => Promise<unknown>)
          | undefined
        const more = await paginateMethod?.(live as Record<string, unknown>, { limit, backwards })
        events = typeof liveLike?.getEvents === 'function' ? liveLike.getEvents() : roomLike.timeline || []
        idx = events.findIndex((e: ExtendedMatrixEventLike) => (e.getId?.() || e.event_id) === cursor)
        if (!more) break
      } catch {
        break
      }
      attempts++
    }

    if (idx !== -1) {
      events = backwards ? events.slice(0, idx) : events.slice(idx + 1)
    }
  }

  const selected = (() => {
    const list = backwards ? events.slice(-limit) : events.slice(0, limit)
    return list
  })()

  const mapped = selected.map((e: unknown) => mapMatrixEventToMessage(e, roomId)).filter(Boolean)
  const nextCursor = mapped.length > 0 ? String(mapped[backwards ? 0 : mapped.length - 1]?.message?.id || '') : ''
  const hasMore = (typeof events.length === 'number' ? events.length : 0) > selected.length

  return { data: mapped, nextCursor, hasMore }
}

export async function sdkMarkRead(roomId: string, eventId: string): Promise<void> {
  const client = matrixClientService.getClient()
  if (!client) throw new Error('Matrix client 未初始化')
  const setRoomReadMarkersMethod = client.setRoomReadMarkers as
    | ((roomId: string, eventId: string, readEventId: string) => Promise<void>)
    | undefined
  await setRoomReadMarkersMethod?.(roomId, eventId, eventId)
}

export async function sdkMarkRoomRead(roomId: string): Promise<void> {
  const client = matrixClientService.getClient()
  if (!client) throw new Error('Matrix client 未初始化')
  const getRoomMethod = client.getRoom as ((roomId: string) => MatrixRoomLike | null) | undefined
  const room = getRoomMethod?.(roomId)
  if (!room) throw new Error(`未找到房间: ${roomId}`)
  const roomLike = room as MatrixRoomLike
  const live = room.getLiveTimeline?.() ?? roomLike.timeline
  const liveLike = live as MatrixTimelineLike | undefined
  const events = typeof liveLike?.getEvents === 'function' ? liveLike.getEvents() : roomLike.timeline || []
  const last = events[events.length - 1]
  const lastId = last?.getId?.() || last?.event_id
  if (!lastId) return
  const setRoomReadMarkersMethod = client.setRoomReadMarkers as
    | ((roomId: string, eventId: string, readEventId: string) => Promise<void>)
    | undefined
  await setRoomReadMarkersMethod?.(roomId, lastId, lastId)
}

function mapMatrixEventToMessage(event: unknown, roomId: string): MappedMessageResult | null {
  try {
    const e = event as ExtendedMatrixEventLike
    const type = e.getType?.() || e?.type
    if (type !== 'm.room.message') return null
    const content = (e.getContent?.() || e?.content || {}) as MessageContent
    const msgtype = content.msgtype || content['m.relates_to']?.event_type
    const id = e.getId?.() || e?.event_id || ''
    const ts = e.getTs?.() || e?.origin_server_ts || Date.now()
    const sender = e.getSender?.() || e?.sender || ''

    const mappedType = (() => {
      switch (msgtype) {
        case 'm.text':
          return MsgEnum.TEXT
        case 'm.image':
          return MsgEnum.IMAGE
        case 'm.file':
          return MsgEnum.FILE
        case 'm.video':
          return MsgEnum.VIDEO
        case 'm.audio':
          return MsgEnum.VOICE
        default:
          return MsgEnum.TEXT
      }
    })()

    const body = (() => {
      if (mappedType === MsgEnum.TEXT) return { content: content.body }
      if (mappedType === MsgEnum.IMAGE)
        return { url: content.url || content.mxc_url, info: content.info, content: content.body }
      if (mappedType === MsgEnum.FILE)
        return { url: content.url || content.mxc_url, filename: content.body, info: content.info }
      if (mappedType === MsgEnum.VIDEO)
        return { url: content.url || content.mxc_url, info: content.info, content: content.body }
      if (mappedType === MsgEnum.VOICE) return { url: content.url || content.mxc_url, info: content.info }
      return { content: content.body }
    })()

    return {
      fromUser: {
        uid: sender,
        username: sender,
        avatar: '',
        locPlace: ''
      },
      message: {
        id,
        roomId,
        sendTime: ts,
        status: MessageStatusEnum.SUCCESS,
        type: mappedType,
        body,
        messageMarks: {}
      },
      sendTime: ts,
      loading: false
    }
  } catch {
    return null
  }
}

export async function sdkGetJoinedMembers(roomId: string): Promise<MatrixMemberLike[]> {
  const client = matrixClientService.getClient()
  if (!client) throw new Error('Matrix client 未初始化')
  const getRoomMethod = client.getRoom as ((roomId: string) => MatrixRoomLike | null) | undefined
  const room = getRoomMethod?.(roomId)
  if (!room) throw new Error(`未找到房间: ${roomId}`)
  const roomLike = room as MatrixRoomLike
  return roomLike.getJoinedMembers?.() || roomLike.getMembers?.() || []
}

export async function sdkGetReceipts(roomId: string, eventId: string): Promise<MatrixReceiptLike[]> {
  const client = matrixClientService.getClient()
  if (!client) throw new Error('Matrix client 未初始化')
  const getRoomMethod = client.getRoom as ((roomId: string) => MatrixRoomLike | null) | undefined
  const room = getRoomMethod?.(roomId)
  if (!room) throw new Error(`未找到房间: ${roomId}`)
  const roomLike = room as MatrixRoomLike
  const live = room.getLiveTimeline?.() ?? roomLike.timeline
  const liveLike = live as MatrixTimelineLike | undefined
  const events = typeof liveLike?.getEvents === 'function' ? liveLike.getEvents() : roomLike.timeline || []
  const ev = events.find((e: ExtendedMatrixEventLike) => (e.getId?.() || e?.event_id) === eventId)
  if (!ev) return []
  return roomLike.getReceiptsForEvent?.(ev) || []
}

export async function sdkGetPushRules(): Promise<Record<string, unknown> | undefined> {
  const client = matrixClientService.getClient()
  if (!client) throw new Error('Matrix client 未初始化')
  const getPushRulesMethod = client.getPushRules as (() => Record<string, unknown>) | undefined
  return getPushRulesMethod?.()
}
