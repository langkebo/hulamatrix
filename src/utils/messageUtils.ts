/**
 * 消息工具函数
 */

import { MsgEnum, MessageStatusEnum } from '@/enums'

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 消息体基础类型
 */
interface BaseMessageBody {
  text?: string | undefined
  caption?: string | undefined
  mentions?: Record<string, unknown> | null | undefined
}

/**
 * 文本消息体
 */
interface TextMessageBody extends BaseMessageBody {
  text: string
}

/**
 * 图片消息体
 */
interface ImageMessageBody extends BaseMessageBody {
  url?: string | undefined
  mimeType?: string | undefined
  width?: number | undefined
  height?: number | undefined
  fileSize?: number | undefined
  thumbnailUrl?: string | undefined
  thumbnailPath?: string | undefined
}

/**
 * 视频消息体
 */
interface VideoMessageBody extends BaseMessageBody {
  url?: string | undefined
  mimeType?: string | undefined
  width?: number | undefined
  height?: number | undefined
  fileSize?: number | undefined
  duration?: number | undefined
  thumbnailUrl?: string | undefined
}

/**
 * 语音消息体
 */
interface VoiceMessageBody extends BaseMessageBody {
  url?: string | undefined
  mimeType?: string | undefined
  fileSize?: number | undefined
  duration?: number | undefined
  waveform?: number[] | undefined
}

/**
 * 文件消息体
 */
interface FileMessageBody extends BaseMessageBody {
  url?: string | undefined
  fileName?: string | undefined
  name?: string | undefined
  mimeType?: string | undefined
  fileSize?: number | undefined
}

/**
 * 位置消息体
 */
interface LocationMessageBody extends BaseMessageBody {
  latitude?: number | undefined
  longitude?: number | undefined
  description?: string | undefined
  geoUri?: string | undefined
}

/**
 * 回复消息体
 */
interface ReplyMessageBody extends BaseMessageBody {
  replyEventId?: string | undefined
  reply?:
    | {
        id: string
        username: string
        type: MsgEnum
        body: string
        canCallback: number
        gapCount: number
      }
    | undefined
  formattedBody?: string | undefined
}

/**
 * 表情回应消息体
 */
interface EmojiMessageBody {
  eventId?: string | undefined
  key?: string | undefined
}

/**
 * 撤回/编辑消息体
 */
interface RecallMessageBody extends BaseMessageBody {
  newContent?: Record<string, unknown> | undefined
  originalEventId?: string | undefined
}

/**
 * 线程消息体
 */
interface ThreadInfo {
  rootEventId: string
  isRoot: boolean
  threadId: string
  participant: string
}

/**
 * 消息体联合类型
 */
export type MessageBody =
  | TextMessageBody
  | ImageMessageBody
  | VideoMessageBody
  | VoiceMessageBody
  | FileMessageBody
  | LocationMessageBody
  | ReplyMessageBody
  | RecallMessageBody
  | EmojiMessageBody
  | Record<string, unknown>

/**
 * 格式化后的Matrix消息内容
 */
interface FormattedMatrixContent {
  msgtype: string
  body: string
  timestamp?: number | undefined
  info?: Record<string, unknown> | undefined
  url?: string | undefined
  thumbnail_url?: string | undefined
  filename?: string | undefined
  geo_uri?: string | undefined
  'm.relates_to'?: Record<string, unknown> | undefined
  'm.new_content'?: Record<string, unknown> | undefined
  formatted_body?: string | undefined
  [key: string]: unknown // 添加索引签名以支持额外的 Matrix 属性
}

/**
 * 内部消息格式（类型文档，供将来迁移使用）
 */
export interface InternalMessage {
  id: string
  localId: string
  type: MsgEnum
  body: MessageBody
  sendTime: number
  fromUser: { uid: string }
  roomId: string
  message: {
    id: string
    type: MsgEnum
    body: MessageBody
    sendTime: number
    fromUser: { uid: string }
    status: MessageStatusEnum
    roomId: string
    messageMarks?: Record<string, unknown>
  }
  encrypted?: boolean
  reactions?: Record<string, { count: number; users: string[] }>
}

/**
 * Matrix 事件内容接口（通用）
 */
interface MatrixEventContent {
  msgtype?: string
  body?: string
  url?: string
  filename?: string
  thumbnail_url?: string
  local_path?: string
  geo_uri?: string
  waveform?: number[]
  info?: {
    mimetype?: string
    w?: number
    h?: number
    size?: number
    duration?: number
    description?: string
    thumbnail_info?: Record<string, unknown>
  }
  'm.mentions'?: Record<string, unknown> | null
  'm.relates_to'?: {
    'm.in_reply_to'?: { event_id?: string }
    rel_type?: string
    event_id?: string
    key?: string
  }
  'm.new_content'?: Record<string, unknown>
  [key: string]: unknown
}

/**
 * Matrix事件接口（兼容SDK）
 */
export interface MatrixEventLike {
  getContent?: <T = Record<string, unknown>>() => T
  content?: Record<string, unknown>
  getSender?: () => string
  sender?: string | { userId?: string } | null // 兼容Matrix SDK的sender类型（RoomMember | null）
  getRoomId?: () => string
  roomId?: string
  getId?: () => string
  eventId?: string
  getTs?: () => number
  timestamp?: number
  getRelations?: () => MatrixRelationsLike | undefined
  getRoom?: () => MatrixRoomLike | undefined
}

interface MatrixRelationsLike {
  getAnnotations?: () => Record<string, unknown>
  getThread?: () => { rootEvent?: MatrixEventLike } | undefined
}

interface MatrixRoomLike {
  findEventById?: (eventId: string) => MatrixEventLike | undefined
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 生成消息ID
 */
export function generateMessageId(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substr(2, 9)
  return `${timestamp}_${random}`
}

/**
 * 生成本地ID（用于临时标识）
 */
export function generateLocalId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
}

/**
 * 格式化消息内容
 */
export function formatMessageContent(type: MsgEnum, body: MessageBody): FormattedMatrixContent {
  // 获取基础文本内容
  const getBodyText = (): string => {
    const baseBody = body as BaseMessageBody
    return baseBody.text || baseBody.caption || ''
  }

  const baseContent: FormattedMatrixContent = {
    msgtype: getMatrixMsgType(type),
    body: getBodyText(),
    timestamp: Date.now()
  }

  switch (type) {
    case MsgEnum.IMAGE: {
      const imgBody = body as ImageMessageBody
      return {
        ...baseContent,
        info: {
          mimetype: imgBody.mimeType || 'image/jpeg',
          w: imgBody.width,
          h: imgBody.height,
          size: imgBody.fileSize,
          thumbnail_info: (imgBody as Record<string, unknown>).thumbnailInfo
        },
        url: imgBody.url,
        thumbnail_url: imgBody.thumbnailUrl
      }
    }

    case MsgEnum.VIDEO: {
      const vidBody = body as VideoMessageBody
      return {
        ...baseContent,
        info: {
          mimetype: vidBody.mimeType || 'video/mp4',
          w: vidBody.width,
          h: vidBody.height,
          size: vidBody.fileSize,
          duration: vidBody.duration
        },
        url: vidBody.url
      }
    }

    case MsgEnum.VOICE: {
      const voiceBody = body as VoiceMessageBody
      return {
        ...baseContent,
        info: {
          mimetype: voiceBody.mimeType || 'audio/ogg',
          size: voiceBody.fileSize,
          duration: voiceBody.duration
        },
        url: voiceBody.url
      }
    }

    case MsgEnum.FILE: {
      const fileBody = body as FileMessageBody
      return {
        ...baseContent,
        info: {
          mimetype: fileBody.mimeType || 'application/octet-stream',
          size: fileBody.fileSize
        },
        url: fileBody.url,
        filename: fileBody.fileName || fileBody.name
      }
    }

    case MsgEnum.LOCATION: {
      const locBody = body as LocationMessageBody
      return {
        ...baseContent,
        geo_uri: `geo:${locBody.latitude ?? 0},${locBody.longitude ?? 0}`,
        info: {
          location: {
            uri: `geo:${locBody.latitude ?? 0},${locBody.longitude ?? 0}`
          },
          description: locBody.description || ''
        }
      }
    }

    case MsgEnum.RECALL: {
      const recallBody = body as RecallMessageBody
      return {
        ...baseContent,
        body: getBodyText(),
        'm.new_content': recallBody.newContent,
        'm.relates_to': {
          event_id: recallBody.originalEventId,
          rel_type: 'm.replace'
        }
      }
    }

    case MsgEnum.EMOJI: {
      const emojiBody = body as EmojiMessageBody
      return {
        ...baseContent,
        'm.relates_to': {
          event_id: emojiBody.eventId,
          key: emojiBody.key,
          rel_type: 'm.annotation',
          type: 'm.reaction'
        }
      }
    }

    case MsgEnum.REPLY: {
      const replyBody = body as ReplyMessageBody
      return {
        ...baseContent,
        'm.relates_to': {
          'm.in_reply_to': {
            event_id: replyBody.replyEventId
          }
        },
        formatted_body: replyBody.formattedBody
      }
    }

    case MsgEnum.NOTICE:
      return {
        ...baseContent,
        msgtype: 'm.notice'
      }

    default:
      return baseContent
  }
}

/**
 * 将内部消息类型转换为Matrix消息类型
 */
function getMatrixMsgType(type: MsgEnum): string {
  switch (type) {
    case MsgEnum.TEXT:
    case MsgEnum.REPLY:
    case MsgEnum.NOTICE:
      return 'm.text'
    case MsgEnum.IMAGE:
      return 'm.image'
    case MsgEnum.VIDEO:
      return 'm.video'
    case MsgEnum.VOICE:
      return 'm.audio'
    case MsgEnum.FILE:
      return 'm.file'
    case MsgEnum.LOCATION:
      return 'm.location'
    case MsgEnum.EMOJI:
      return 'm.reaction'
    case MsgEnum.RECALL:
      return 'm.room.message'
    default:
      return 'm.text'
  }
}

/**
 * 解析Matrix事件为内部消息格式
 * @param event Matrix事件对象
 * @returns 解析后的内部消息格式
 */
export function parseMatrixEvent(event: MatrixEventLike): InternalMessage {
  const content = (event.getContent ? event.getContent<MatrixEventContent>() : event.content) as
    | MatrixEventContent
    | undefined
  // 处理 sender 可能是对象的情况
  const rawSender = event.getSender ? event.getSender() : event.sender
  const sender = typeof rawSender === 'string' ? rawSender : (rawSender?.userId ?? '')
  const roomId = event.getRoomId ? event.getRoomId() : event.roomId
  const eventId = (event.getId ? event.getId() : event.eventId) ?? ''
  const timestamp = (event.getTs ? event.getTs() : event.timestamp) ?? Date.now()

  let type = MsgEnum.TEXT
  let body: MessageBody = {
    text: content?.body || '',
    mentions: content?.['m.mentions'] || null
  }

  // 处理加密消息
  if (isEncryptedMessage(event)) {
    return {
      id: eventId,
      localId: `matrix_${eventId}`,
      type: MsgEnum.TEXT,
      body: { text: '[加密消息]' },
      sendTime: timestamp,
      fromUser: { uid: sender ?? '' },
      roomId: roomId ?? '',
      message: {
        id: eventId,
        type: MsgEnum.TEXT,
        body: { text: '[加密消息]' },
        sendTime: timestamp,
        fromUser: { uid: sender ?? '' },
        status: MessageStatusEnum.SUCCESS,
        roomId: roomId ?? ''
      },
      encrypted: true
    }
  }

  // 根据msgtype确定消息类型
  const contentMsgType = content?.msgtype
  // 确保 content 非空，使用空对象作为默认值
  const safeContent: MatrixEventContent = content ?? {}
  switch (contentMsgType) {
    case 'm.image':
      type = MsgEnum.IMAGE
      body = {
        url: safeContent.url,
        mimeType: safeContent.info?.mimetype,
        width: safeContent.info?.w,
        height: safeContent.info?.h,
        fileSize: safeContent.info?.size,
        thumbnailUrl: safeContent.thumbnail_url,
        thumbnailPath: safeContent.local_path
      }
      break

    case 'm.video':
      type = MsgEnum.VIDEO
      body = {
        url: safeContent.url,
        mimeType: safeContent.info?.mimetype,
        width: safeContent.info?.w,
        height: safeContent.info?.h,
        fileSize: safeContent.info?.size,
        duration: safeContent.info?.duration,
        thumbnailUrl: safeContent.thumbnail_url
      }
      break

    case 'm.audio':
      type = safeContent.info?.duration ? MsgEnum.VOICE : MsgEnum.FILE
      body = {
        url: safeContent.url,
        mimeType: safeContent.info?.mimetype,
        fileSize: safeContent.info?.size,
        duration: safeContent.info?.duration,
        waveform: safeContent.waveform
      }
      break

    case 'm.file':
      type = MsgEnum.FILE
      body = {
        url: safeContent.url,
        fileName: safeContent.filename || safeContent.body,
        mimeType: safeContent.info?.mimetype,
        fileSize: safeContent.info?.size
      }
      break

    case 'm.location': {
      type = MsgEnum.LOCATION
      // 解析 geo URI
      const geoMatch = safeContent.geo_uri?.match(/geo:(-?\d+\.?\d*),(-?\d+\.?\d*)/)
      body = {
        geoUri: safeContent.geo_uri,
        latitude: geoMatch && geoMatch[1] ? parseFloat(geoMatch[1]) : 0,
        longitude: geoMatch && geoMatch[2] ? parseFloat(geoMatch[2]) : 0,
        description: safeContent.body || safeContent.info?.description
      }
      break
    }

    case 'm.emote':
      type = MsgEnum.TEXT
      ;(body as TextMessageBody).text = `/me ${safeContent.body || ''}`
      break

    case 'm.notice':
      type = MsgEnum.NOTICE
      break
  }

  // 检查是否是回复消息
  if (safeContent['m.relates_to']?.['m.in_reply_to']) {
    type = MsgEnum.REPLY
    ;(body as ReplyMessageBody).replyEventId = safeContent['m.relates_to']?.['m.in_reply_to']?.event_id
    // 获取被回复消息的信息
    const replyEvent = getReplyEvent(event)
    if (replyEvent) {
      const replyContent = replyEvent.getContent
        ? replyEvent.getContent()
        : (replyEvent.content as Record<string, unknown> | undefined)
      // 处理 sender 可能是对象的情况
      const replySender = typeof replyEvent.sender === 'string' ? replyEvent.sender : (replyEvent.sender?.userId ?? '')
      ;(body as ReplyMessageBody).reply = {
        id: (body as ReplyMessageBody).replyEventId!,
        username: replySender.split(':')[0]?.substring(1) || 'Unknown',
        type: parseMatrixMsgType(replyEvent),
        body: (replyContent?.body as string | undefined) || '',
        canCallback: 1,
        gapCount: 0
      }
    }
  }

  // 检查是否是编辑消息
  if (safeContent['m.relates_to']?.rel_type === 'm.replace') {
    type = MsgEnum.RECALL
    const recallBody = body as RecallMessageBody
    recallBody.newContent = safeContent['m.new_content']
    recallBody.originalEventId = safeContent['m.relates_to']?.event_id
    // 更新内容为编辑后的内容
    if (recallBody.newContent?.body) {
      ;(body as TextMessageBody).text = recallBody.newContent.body as string
    }
  }

  // 检查是否是反应（表情回应）
  if (safeContent['m.relates_to']?.rel_type === 'm.annotation') {
    type = MsgEnum.EMOJI
    const emojiBody = body as EmojiMessageBody
    emojiBody.key = safeContent['m.relates_to']?.key
    emojiBody.eventId = safeContent['m.relates_to']?.event_id
  }

  // 检查是否是线程消息
  const threadInfo = getThreadInfo(event)
  if (threadInfo) {
    ;(body as ReplyMessageBody & { threadInfo?: ThreadInfo }).threadInfo = {
      rootEventId: threadInfo.rootEventId,
      isRoot: threadInfo.isRoot,
      threadId: threadInfo.rootEventId, // 简化处理
      participant: sender as string
    }
  }

  // 处理消息关系（聚合）
  const getRelations = (event as MatrixEventLike).getRelations
  if (getRelations) {
    const relations = getRelations()

    // 处理反应
    if (relations) {
      const annotations = (relations as MatrixRelationsLike).getAnnotations?.() as
        | Record<string, { count: number; chunk?: Array<{ sender: string }> }>
        | undefined
      if (annotations) {
        const reactions: Record<string, { count: number; users: string[] }> = {}

        Object.entries(annotations).forEach(([key, annotation]) => {
          if (key.startsWith('m.reaction:')) {
            const emoji = key.substring(12) // 移除 'm.reaction:' 前缀
            reactions[emoji] = {
              count: Number(annotation.count || 0),
              users: (annotation.chunk || []).map((a) => a.sender)
            }
          }
        })

        if (Object.keys(reactions).length > 0) {
          ;(body as Record<string, unknown>).reactions = reactions
        }
      }
    }
  }

  return {
    id: eventId,
    localId: `matrix_${eventId}`,
    type,
    body,
    sendTime: timestamp,
    fromUser: { uid: sender ?? '' },
    roomId: roomId ?? '',
    message: {
      id: eventId,
      type,
      body,
      sendTime: timestamp,
      fromUser: { uid: sender ?? '' },
      status: MessageStatusEnum.SUCCESS,
      roomId: roomId ?? '',
      messageMarks: {} // 初始化空的标记
    },
    encrypted: false
  }
}

/**
 * 计算消息预览文本
 */
export function getMessagePreview(message: InternalMessage): string {
  const { type, body } = message

  switch (type) {
    case MsgEnum.TEXT:
    case MsgEnum.REPLY:
    case MsgEnum.NOTICE:
      return (body as TextMessageBody).text || ''

    case MsgEnum.IMAGE:
      return '[图片]'

    case MsgEnum.VIDEO:
      return '[视频]'

    case MsgEnum.VOICE:
      return '[语音]'

    case MsgEnum.FILE:
      return `[文件] ${(body as FileMessageBody).fileName || ''}`

    case MsgEnum.LOCATION:
      return '[位置]'

    case MsgEnum.EMOJI:
      return '[表情回应]'

    case MsgEnum.RECALL:
      return '[撤回了一条消息]'

    default:
      return '[未知消息类型]'
  }
}

/**
 * 检查消息是否为加密消息
 */
export function isEncryptedMessage(event: MatrixEventLike): boolean {
  const content = event.getContent!()
  return !!(content.algorithm && content.ciphertext)
}

/**
 * 获取消息的线程信息
 */
export function getThreadInfo(event: MatrixEventLike): { rootEventId: string; isRoot: boolean } | null {
  const relations = event.getRelations ? event.getRelations() : null
  if (!relations) return null

  const thread = (relations as MatrixRelationsLike).getThread ? (relations as MatrixRelationsLike).getThread!() : null
  if (!thread) return null

  const rootEvent = thread.rootEvent
  if (!rootEvent) return null

  return {
    rootEventId: rootEvent.getId ? rootEvent.getId() : (rootEvent.eventId as string),
    isRoot: event.getId!() === rootEvent.getId!()
  }
}

/**
 * 获取回复的事件
 */
function getReplyEvent(event: MatrixEventLike): MatrixEventLike | null {
  const content = (event.getContent ? event.getContent<MatrixEventContent>() : event.content) as
    | MatrixEventContent
    | undefined
  const replyId = content?.['m.relates_to']?.['m.in_reply_to']?.event_id

  if (!replyId) return null

  // 尝试从房间的timeline获取回复的事件
  const room = event.getRoom ? event.getRoom() : null
  if (room && room.findEventById) {
    return room.findEventById(replyId) ?? null
  }

  return null
}

/**
 * 解析Matrix消息类型为内部类型
 */
function parseMatrixMsgType(event: MatrixEventLike): MsgEnum {
  const content = (event.getContent ? event.getContent<MatrixEventContent>() : event.content) as
    | MatrixEventContent
    | undefined

  switch (content?.msgtype) {
    case 'm.text':
    case 'm.emote':
      return MsgEnum.TEXT
    case 'm.notice':
      return MsgEnum.NOTICE
    case 'm.image':
      return MsgEnum.IMAGE
    case 'm.video':
      return MsgEnum.VIDEO
    case 'm.audio':
      return content?.info?.duration ? MsgEnum.VOICE : MsgEnum.FILE
    case 'm.file':
      return MsgEnum.FILE
    case 'm.location':
      return MsgEnum.LOCATION
    default:
      return MsgEnum.TEXT
  }
}
