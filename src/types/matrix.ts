import type { IRoomEvent, MatrixEvent } from 'matrix-js-sdk'

export interface MatrixConfig {
  baseUrl: string
  accessToken?: string
  userId?: string
  deviceId?: string
}

export type SyncState = 'INIT' | 'PREPARED' | 'SYNCING' | 'ERROR' | 'STOPPED'

export type MessageStatus = 'pending' | 'sending' | 'sent' | 'failed'

export type MessageType = 'm.text' | 'm.image' | 'm.file' | 'm.audio' | 'm.video' | 'm.emote' | 'm.notice'

export interface MatrixMessage {
  eventId: string
  roomId: string
  sender: string
  content: {
    body?: string
    msgtype: MessageType
    url?: string
    info?: {
      mimetype?: string
      size?: number
      h?: number
      w?: number
      thumbnail_url?: string
      thumbnail_info?: {
        mimetype?: string
        size?: number
        h?: number
        w?: number
      }
    }
  }
  status: MessageStatus
  timestamp: number
  isLocal?: boolean
  isEncrypted?: boolean
}

export interface MatrixRoom {
  roomId: string
  name: string
  avatar?: string
  topic?: string
  members: number
  unreadCount: number
  lastMessage?: MatrixMessage
  isDirect: boolean
  isEncrypted: boolean
  tags?: Record<string, Record<string, any>>
}

export interface MatrixUser {
  userId: string
  displayName?: string
  avatarUrl?: string | null
  presence?: 'online' | 'offline' | 'unavailable'
  lastActiveAgo?: number
}

export interface MatrixDevice {
  deviceId: string
  userId: string
  displayName?: string
  lastSeenIp?: string
  lastSeenTs?: number
  verified: boolean
}

export interface MatrixSyncResponse {
  nextBatch: string
  rooms: {
    join: Record<
      string,
      {
        state: IRoomEvent[]
        timeline: {
          events: IRoomEvent[]
          limited: boolean
          prev_batch: string
        }
        ephemeral: IRoomEvent[]
        accountData: IRoomEvent[]
        unreadNotifications: {
          highlight_count: number
          notification_count: number
        }
      }
    >
    invite: Record<
      string,
      {
        invite_state: IRoomEvent[]
      }
    >
    leave: Record<
      string,
      {
        state: IRoomEvent[]
        timeline: {
          events: IRoomEvent[]
          limited: boolean
          prev_batch: string
        }
      }
    >
  }
  presence: IRoomEvent[]
  accountData: IRoomEvent[]
  toDevice: IRoomEvent[]
  deviceLists: {
    changed: string[]
    left: string[]
  }
}

export interface MatrixEventWrapper {
  event: MatrixEvent
  roomId: string
  isLocal?: boolean
}
