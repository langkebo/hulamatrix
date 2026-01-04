/**
 * Message Router - Stub for Phase 4 Migration
 * This was used for dual-protocol routing, now deprecated
 * All messages now use Matrix SDK directly
 */

export type RouteDecision = 'matrix' | 'websocket' | 'hybrid'

export interface RouteOptions {
  encrypted?: boolean
  fileSize?: number
  priority?: 'low' | 'normal' | 'high'
}

export interface RouteResult {
  success?: boolean
  eventId?: string
  error?: string
  fallback?: RouteDecision
}

export interface MessageContent {
  msgtype?: string
  body?: string
  url?: string
  info?: {
    size?: number
    duration?: number
    mimetype?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

export interface ChatMessage {
  id: string
  roomId: string
  sender: string
  content: MessageContent
  timestamp: number
  type: string
  status: 'pending' | 'sent' | 'failed'
  url?: string
  fileName?: string
  fileSize?: number
  duration?: number
  width?: number
  height?: number
  thumbnailUrl?: string
  previewUrl?: string
  mimetype?: string
  isRead?: boolean
  isDelivered?: boolean
}

export class MessageRouter {
  async routeMessage(_roomId: string, _content: unknown, _opts?: RouteOptions): Promise<RouteResult> {
    // Phase 4 Migration: All messages go through Matrix SDK
    return { success: true }
  }

  decideRoute(_content: Record<string, unknown>, _options?: RouteOptions): RouteDecision {
    // Phase 4 Migration: Always use Matrix SDK
    return 'matrix'
  }

  normalizeIncoming(
    _roomId: string,
    event: { getId: () => string; getSender: () => string; getContent: () => MessageContent; getTs: () => number }
  ): ChatMessage {
    const content = event.getContent()
    return {
      id: event.getId(),
      roomId: _roomId,
      sender: event.getSender(),
      content,
      timestamp: event.getTs(),
      type: content.msgtype || 'm.text',
      status: 'sent',
      url: content.url,
      fileName: content.body,
      fileSize: content.info?.size,
      duration: content.info?.duration,
      mimetype: content.info?.mimetype
    }
  }
}

export const messageRouter = new MessageRouter()
