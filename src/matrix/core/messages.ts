import { matrixClientService } from '@/matrix/core/client'
import { useChatStore } from '@/stores/chat'
import { MsgEnum, MessageStatusEnum } from '@/enums'
import { useGlobalStore } from '@/stores/global'
import { Perf } from '@/utils/Perf'
import { tryBackfillWhenNoPagination } from '@/matrix/core/history'
import type { MatrixEventLike, MatrixRoomLike } from '@/types/matrix'
import type { MessageType, TextBody, ImageBody, VideoBody, VoiceBody, FileBody } from '@/services/types'

// Extended type definitions for message handling
interface MatrixEventExtendedLike extends MatrixEventLike {
  getRoomId?(): string
  event?: {
    room_id?: string
    type?: string
    sender?: string
    [key: string]: unknown
  }
  // Don't override getRoom - it's incompatible with the base type
}

interface MatrixClientLike {
  on?(event: string, handler: (...args: unknown[]) => void): void
  getRoom?(roomId: string): MatrixRoomLike | null | undefined
  [key: string]: unknown
}

function mapEventToMsgEnum(ev: MatrixEventLike): MsgEnum {
  const t =
    typeof ev.getType === 'function'
      ? ev.getType()
      : String((ev as Partial<MatrixEventExtendedLike>)?.event?.type || '')
  const content =
    typeof ev.getContent === 'function'
      ? (ev.getContent() as Record<string, unknown>)
      : (((ev as Partial<MatrixEventExtendedLike>)?.event?.content as Record<string, unknown>) ?? {})
  if (t === 'm.room.message') {
    switch (content.msgtype) {
      case 'm.text':
        return MsgEnum.TEXT
      case 'm.image':
        return MsgEnum.IMAGE
      case 'm.audio':
        return MsgEnum.VOICE
      case 'm.video':
        return MsgEnum.VIDEO
      case 'm.file':
        return MsgEnum.FILE
      default:
        return MsgEnum.UNKNOWN
    }
  }
  if (t && t.startsWith('m.call.')) {
    return MsgEnum.SYSTEM
  }
  return MsgEnum.SYSTEM
}

function buildMessageType(ev: MatrixEventLike): MessageType {
  const extendedEv = ev as Partial<MatrixEventExtendedLike>
  const roomId =
    typeof ev.getRoomId === 'function'
      ? ev.getRoomId()
      : String(
          extendedEv?.event?.room_id ||
            (ev as { getRoom?: () => { roomId?: string } | undefined })?.getRoom?.()?.roomId ||
            ''
        )
  const sender = typeof ev.getSender === 'function' ? ev.getSender() : String(extendedEv?.event?.sender || '')
  const content =
    typeof ev.getContent === 'function'
      ? (ev.getContent() as Record<string, unknown>)
      : ((extendedEv?.event?.content as Record<string, unknown>) ?? {})
  const typeName = typeof ev.getType === 'function' ? ev.getType() : String(extendedEv?.event?.type || '')
  const type = mapEventToMsgEnum(ev)
  const ts = typeof ev.getTs === 'function' ? ev.getTs() : Date.now()
  const id = typeof ev.getId === 'function' ? ev.getId() : `${roomId}_${ts}`
  const username = sender?.split(':')[0]?.replace('@', '') || sender || ''
  const body: TextBody | ImageBody | VideoBody | VoiceBody | FileBody | TextBody =
    type === MsgEnum.TEXT
      ? {
          content: String(content.body || ''),
          reply: { id: '', username: '', type: MsgEnum.TEXT, body: {}, canCallback: 0, gapCount: 0 },
          urlContentMap: {},
          atUidList: []
        }
      : type === MsgEnum.IMAGE
        ? {
            url: String(content.url || ''),
            size: Number((content.info as Record<string, unknown>)?.size || 0),
            width: Number((content.info as Record<string, unknown>)?.w || 0),
            height: Number((content.info as Record<string, unknown>)?.h || 0)
          }
        : type === MsgEnum.VIDEO
          ? {
              url: String(content.url || ''),
              size: Number((content.info as Record<string, unknown>)?.size || 0),
              filename: String(content.filename || '')
            }
          : type === MsgEnum.VOICE
            ? {
                url: String(content.url || ''),
                size: Number((content.info as Record<string, unknown>)?.size || 0),
                second: Number((content.info as Record<string, unknown>)?.duration || 0)
              }
            : type === MsgEnum.FILE
              ? {
                  url: String(content.url || ''),
                  size: Number((content.info as Record<string, unknown>)?.size || 0),
                  fileName: String(content.filename || '')
                }
              : typeName && typeName.startsWith('m.call.')
                ? {
                    content: mapCallBody(typeName, content),
                    reply: { id: '', username: '', type: MsgEnum.TEXT, body: {}, canCallback: 0, gapCount: 0 },
                    urlContentMap: {},
                    atUidList: []
                  }
                : {
                    content: String(content.body || ''),
                    reply: { id: '', username: '', type: MsgEnum.TEXT, body: {}, canCallback: 0, gapCount: 0 },
                    urlContentMap: {},
                    atUidList: []
                  }

  return {
    fromUser: { uid: sender || '', username, avatar: '', locPlace: '' },
    message: {
      id,
      roomId,
      type,
      body,
      sendTime: ts,
      messageMarks: {},
      status: MessageStatusEnum.SUCCESS
    },
    sendTime: ts
  }
}

function mapCallBody(t: string, _content: Record<string, unknown>): string {
  if (t === 'm.call.invite') return '来电邀请'
  if (t === 'm.call.answer') return '通话接通'
  if (t === 'm.call.hangup') return '通话结束'
  if (t === 'm.call.candidates') return 'ICE 候选交换'
  return '通话事件'
}

export function setupMatrixMessageBridge() {
  const client = matrixClientService.getClient() as unknown as MatrixClientLike
  if (!client) return
  const chatStore = useChatStore()
  const globalStore = useGlobalStore()

  client.on?.('Room.timeline', (...args: unknown[]) => {
    const event = args[0] as MatrixEventLike
    const room = args[1] as MatrixRoomLike
    const toStartOfTimeline = args[2] as boolean
    if (toStartOfTimeline) return
    const mt = buildMessageType(event)
    const activeRoomId = room?.roomId || mt.message.roomId
    chatStore.pushMsg(mt, { activeRoomId })
  })

  // 覆写分页为 Matrix 房间使用 SDK 分页
  const originalLoadMore = chatStore.loadMore
  chatStore.loadMore = async (size?: number) => {
    const roomId = globalStore.currentSessionRoomId
    if (roomId && roomId.startsWith('!')) {
      const getRoomFn = client.getRoom as ((roomId: string) => MatrixRoomLike | null | undefined) | undefined
      const r = getRoomFn?.(roomId)
      if (!r) return
      const tl = r.getLiveTimeline?.() as
        | {
            getPaginationToken?(direction: string): string | undefined
            paginate?(backwards: boolean, size: number): Promise<unknown>
          }
        | undefined
      const canPaginate = tl?.getPaginationToken?.('b') || r?.canPaginateBackward?.()
      if (!canPaginate) {
        const opts = chatStore.currentMessageOptions
        chatStore.currentMessageOptions = {
          isLast: true,
          isLoading: opts?.isLoading ?? false,
          cursor: opts?.cursor ?? ''
        }
        await tryBackfillWhenNoPagination(roomId, size ?? 20)
        return
      }
      try {
        Perf.mark('paginate-start')
        const paginateBackwardsFn = (r as { paginateBackwards?(size: number): Promise<unknown> }).paginateBackwards
        await paginateBackwardsFn?.(size ?? 20)
        Perf.measure('paginate-duration', 'paginate-start')
      } catch (_e) {
        // fallback：部分版本使用 timeline.paginate 接口
        Perf.mark('paginate-start')
        await tl?.paginate?.(true, size ?? 20)
        Perf.measure('paginate-duration', 'paginate-start')
      }
    } else {
      await originalLoadMore(size)
    }
  }
}
