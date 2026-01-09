/**
 * Chat Store Type Definitions
 * Contains all type definitions and interfaces for the chat store
 */

import type { MessageBody } from '@/services/types'
import { MsgEnum } from '@/enums'

/**
 * Send message parameters
 */
export interface SendMessageParams {
  type: MsgEnum
  body?: MessageBody
  roomId?: string
  [key: string]: unknown
}

/**
 * Timer Worker interface
 */
export interface TimerWorker {
  postMessage: (data: unknown) => void
  terminate: () => void
  onmessage: ((event: MessageEvent<unknown>) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
}

/**
 * Matrix member interface for updates
 */
export interface MatrixMemberLike {
  name: string
  getAvatarUrl?: (
    baseUrl: string,
    width: number,
    height: number,
    resizeMethod: string,
    allowDefault: boolean,
    animated: boolean
  ) => string | undefined
}

/**
 * Matrix room interface for updates
 */
export interface MatrixRoomLikeForUpdate {
  getMember?: (userId: string) => MatrixMemberLike | undefined
  [key: string]: unknown
}

/**
 * Matrix client interface for updates
 */
export interface MatrixClientLikeForUpdate {
  getRoom: (roomId: string) => MatrixRoomLikeForUpdate | null | undefined
  baseUrl?: string
  [key: string]: unknown
}

/**
 * Remove session options
 */
export interface RemoveSessionOptions {
  /** Whether to clear chat history for the room */
  clearMessages?: boolean
  /** Whether to call Matrix leave API to completely leave the room */
  leaveRoom?: boolean
}

/**
 * Recalled message data
 */
export type RecalledMessage = {
  messageId: string
  content: string
  recallTime: number
  originalType: MsgEnum
}

/**
 * Message options for loading state
 */
export interface MessageOptions {
  isLast: boolean
  isLoading: boolean
  cursor: string
}

/**
 * New message count state
 */
export interface NewMsgCountState {
  count: number
  isStart: boolean
}

/**
 * Constants
 */
export const PAGE_SIZE = 20

export const RECALL_EXPIRATION_TIME = 2 * 60 * 1000 // 2 minutes in milliseconds
