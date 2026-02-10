/**
 * Messages API Service
 * Replaces deprecated ImRequestUtils message-related functions
 */

import MatrixClientService from '../matrix/MatrixClientService'
import type { SessionItem } from '@/services/types'
import { RoomTypeEnum, SessionOperateEnum, NotificationTypeEnum } from '@/enums'
import type {
  RecallMessageParams,
  GetMsgReadCountParams,
  MsgReadCountResponse,
  MarkMsgReadParams,
  GetSessionDetailParams,
  GetSessionDetailWithFriendsParams,
  MarkMsgParams,
  MergeMsgParams
} from './types'

class MessagesApiService {
  /**
   * Recall/redact a message
   */
  async recallMsg(params: RecallMessageParams): Promise<{ success: boolean }> {
    console.log('[MessagesApiService] recallMsg called with:', params)
    const client = MatrixClientService.getInstance().getClient()

    if (!client) {
      return { success: false }
    }

    try {
      await client.redactEvent(
        params.roomId,
        params.eventId,
        undefined, // txnId
        params.reason ? { reason: params.reason } : undefined // opts
      )
      return { success: true }
    } catch (error) {
      console.error('[MessagesApiService] recallMsg failed:', error)
      return { success: false }
    }
  }

  /**
   * Get message read count
   * @deprecated Mock function - needs Matrix Receipt API implementation
   */
  async getMsgReadCount(params: GetMsgReadCountParams): Promise<MsgReadCountResponse> {
    console.log('[MessagesApiService] getMsgReadCount called with:', params)
    const client = MatrixClientService.getInstance().getClient()

    if (!client) {
      return { code: 500, data: { count: 0 } }
    }

    try {
      // TODO: Implement with Matrix Receipt API
      // const room = client.getRoom(params.roomId)
      // const event = room?.getEvent(params.eventId)
      // const receipts = event?.getReceipts()
      // const count = receipts?.filter(r => r.type === 'm.read').length || 0
      return { code: 200, data: { count: 0 } }
    } catch (error) {
      console.error('[MessagesApiService] getMsgReadCount failed:', error)
      return { code: 500, data: { count: 0 } }
    }
  }

  /**
   * Mark messages as read in a room
   * Uses Matrix Receipt API to send read receipts
   */
  async markMsgRead(params: MarkMsgReadParams): Promise<{ success: boolean }> {
    console.log('[MessagesApiService] markMsgRead called with:', params)
    const client = MatrixClientService.getInstance().getClient()

    if (!client) {
      return { success: false }
    }

    try {
      const room = client.getRoom(params.roomId)
      if (!room) {
        console.warn('[MessagesApiService] Room not found:', params.roomId)
        return { success: false }
      }

      // Get the latest event in the room
      const timeline = room.getLiveTimeline()
      const events = timeline.getEvents()

      if (events.length > 0) {
        // Find the latest non-ignored event
        // We want to mark the last actual message as read, not system events
        let latestEvent = events[events.length - 1]

        // Try to find the latest m.room.message event
        for (let i = events.length - 1; i >= 0; i--) {
          const event = events[i]
          const eventType = event.getType?.()
          if (eventType === 'm.room.message') {
            latestEvent = event
            break
          }
        }

        // Get the event ID - Matrix SDK has getId() method on MatrixEvent
        const eventId = latestEvent.getId?.()
        if (!eventId) {
          console.warn('[MessagesApiService] Could not get event ID')
          return { success: false }
        }

        // Send read receipt
        // The Matrix SDK's sendReadReceipt method signature is:
        // sendReadReceipt(roomId: string, eventId: string): Promise<void>
        // or it can take a MatrixEvent directly
        try {
          // Try with eventId first (most compatible)
          await (client.sendReadReceipt as any)(params.roomId, eventId)
          console.log('[MessagesApiService] Read receipt sent for event:', eventId)
        } catch (e) {
          console.warn('[MessagesApiService] sendReadReceipt failed, trying alternative method:', e)

          // Fallback: try with the event object directly
          try {
            await (client.sendReadReceipt as any)(params.roomId, latestEvent)
            console.log('[MessagesApiService] Read receipt sent using event object')
          } catch (e2) {
            console.error('[MessagesApiService] All sendReadReceipt methods failed:', e2)
            return { success: false }
          }
        }
      } else {
        console.warn('[MessagesApiService] No events in room timeline')
        return { success: false }
      }

      return { success: true }
    } catch (error) {
      console.error('[MessagesApiService] markMsgRead failed:', error)
      return { success: false }
    }
  }

  /**
   * Get session/room detail
   * @deprecated Mock function - needs Matrix Room API implementation
   */
  async getSessionDetail(params: GetSessionDetailParams): Promise<SessionItem> {
    console.log('[MessagesApiService] getSessionDetail called with:', params)
    const client = MatrixClientService.getInstance().getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      const room = client.getRoom(params.id)
      if (!room) {
        throw new Error('Room not found')
      }

      // TODO: Implement with Matrix Room API
      // For now, return a basic session item
      return {
        id: params.id,
        roomId: params.id,
        account: '',
        activeTime: Date.now(),
        avatar: '',
        detailId: '',
        hotFlag: 0 as any,
        name: room.name || params.id,
        text: '',
        type: RoomTypeEnum.SINGLE,
        unreadCount: 0,
        lastMsg: '',
        sticky: false,
        status: 1,
        allowScanEnter: false,
        createTime: Date.now(),
        updateTime: Date.now(),
        top: false,
        operate: SessionOperateEnum.DELETE_FRIEND,
        hide: false,
        muteNotification: NotificationTypeEnum.RECEPTION,
        shield: false
      } as SessionItem
    } catch (error) {
      console.error('[MessagesApiService] getSessionDetail failed:', error)
      throw error
    }
  }

  /**
   * Mark message with emoji reaction
   * Uses Matrix m.reaction (m.annotation) event for emoji reactions
   */
  async markMsg(params: MarkMsgParams): Promise<{ code: number; success: boolean }> {
    console.log('[MessagesApiService] markMsg called with:', params)
    const client = MatrixClientService.getInstance().getClient()

    if (!client) {
      return { code: 500, success: false }
    }

    try {
      // Use provided roomId or try to extract from msgId
      // Matrix event IDs don't contain roomId, so we need the caller to provide it
      if (!params.roomId) {
        console.warn('[MessagesApiService] markMsg: roomId is required')
        return { code: 400, success: false }
      }

      // Emoji key mapping (markType to emoji)
      // This maps the markType number to an emoji character
      const emojiMap: Record<number, string> = {
        1: '👍', // thumbs up
        2: '❤️', // heart
        3: '😂', // laugh
        4: '😮', // surprised
        5: '😢', // sad
        6: '😡', // angry
        7: '🎉', // party
        8: '👎' // clap
      }

      const emoji = emojiMap[params.markType] || '👍'

      if (params.actType === 1) {
        // Add reaction
        await (client as any).sendEvent(params.roomId, 'm.reaction', {
          'm.relates_to': {
            event_id: params.msgId,
            key: emoji,
            rel_type: 'm.annotation'
          }
        })
      } else if (params.actType === 2) {
        // Remove reaction (redact the reaction event)
        const room = client.getRoom(params.roomId)
        if (room) {
          const timeline = room.getLiveTimeline()
          const events = timeline.getEvents()

          // Find the reaction event for this user and emoji
          const userId = client.getUserId()
          const reactionEvent = events.find((event: any) => {
            const sender = event.getSender?.() || event.getSender()
            return (
              event.getType?.() === 'm.reaction' &&
              sender === userId &&
              event.event?.content?.['m.relates_to']?.event_id === params.msgId &&
              event.event?.content?.['m.relates_to']?.key === emoji
            )
          })

          if (reactionEvent) {
            const eventId = reactionEvent.getId?.()
            if (eventId) {
              await client.redactEvent(params.roomId, eventId)
            }
          }
        }
      }

      return { code: 200, success: true }
    } catch (error) {
      console.error('[MessagesApiService] markMsg failed:', error)
      return { code: 500, success: false }
    }
  }

  /**
   * Get session/room detail with friends information
   * Returns a response object with code and data fields
   */
  async getSessionDetailWithFriends(params: GetSessionDetailWithFriendsParams): Promise<{
    code: number
    data?: {
      roomId?: string
      [key: string]: unknown
    }
  }> {
    console.log('[MessagesApiService] getSessionDetailWithFriends called with:', params)
    const client = MatrixClientService.getInstance().getClient()

    if (!client) {
      return { code: 500 }
    }

    try {
      // Get session detail and wrap in response object
      const sessionItem = await this.getSessionDetail({ id: params.id })
      return {
        code: 200,
        data: sessionItem
      }
    } catch (error) {
      console.error('[MessagesApiService] getSessionDetailWithFriends failed:', error)
      return { code: 500 }
    }
  }

  /**
   * Merge/forward messages to multiple rooms
   * @deprecated Mock function - needs backend implementation or Matrix forwarding API
   */
  async mergeMsg(params: MergeMsgParams): Promise<{ code: number; success: boolean }> {
    console.log('[MessagesApiService] mergeMsg called with:', params)
    // TODO: Implement with Matrix message forwarding API
    // This would involve:
    // 1. Getting the original messages from sourceRoomId
    // 2. Creating forwarding messages in each target roomId
    // Matrix has m.forward (MSC 3381) for message forwarding
    return { code: 200, success: true }
  }
}

export default new MessagesApiService()
