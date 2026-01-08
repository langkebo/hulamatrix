/**
 * Unified Message Receiver Service
 * 统一消息接收服务 - 处理所有来源的消息（Matrix SDK）
 * WebSocket 支持已移除，现在完全使用 Matrix SDK
 */

import { useChatStore } from '@/stores/chat'
import { useGlobalStore } from '@/stores/global'
import { logger } from '@/utils/logger'
import { invoke } from '@tauri-apps/api/core'
import type { MessageType } from '@/services/types'
import { TauriCommand } from '@/enums'
import { matrixClientService } from '@/integrations/matrix/client'
import { parseMatrixEvent } from '@/utils/messageUtils'
import { threadService } from './matrixThreadAdapter'
import { messageSyncService } from './messageSyncService'

export type MessageSource = 'matrix' | 'local'

export interface MessageReceiveOptions {
  skipDuplicateCheck?: boolean
  silent?: boolean
  priority?: 'high' | 'normal' | 'low'
}

export interface MessageReceiveResult {
  success: boolean
  messageId: string
  roomId: string
  wasDuplicate: boolean
  processed: boolean
  error?: string | undefined
}

export interface MessageReceiverStats {
  totalReceived: number
  totalProcessed: number
  totalDuplicates: number
  totalErrors: number
  lastReceivedTime?: number
}

interface MatrixEventLike {
  getId?(): string
  eventId?: string
  event_id?: string
  getType?(): string
  type?: string
  getRoomId?(): string
  getContent?<T = unknown>(): T
  getEventId?(): string
}

interface MatrixRoomLike {
  roomId: string
  name?: string
  topic?: string
  [key: string]: unknown
}
interface MatrixMemberLike {
  roomId: string
  userId: string
  name?: string
  displayName?: string
}
interface ParsedMessage {
  id: string
  localId: string
  type: string | number
  body: unknown
  sendTime: number
  fromUser: { uid: string }
  roomId: string
  message: {
    id: string
    type: string | number
    body: unknown
    sendTime: number
    fromUser: { uid: string }
    status: string | number
    roomId: string
  }
}
interface ChatStoreLike {
  pushMsg?(message: ParsedMessage): Promise<void> | void
  addMessageToSessionList?(message: ParsedMessage): void
  updateMessageStatus?(eventId: string, status: string): Promise<void> | void
  updateMemberInfo?(roomId: string, userId: string, info: { name?: string; displayName?: string }): Promise<void> | void
  updateRoomInfo?(roomId: string, info: { name?: string; topic?: string }): Promise<void> | void
  updateUnreadCount?(roomId: string, count: number): Promise<void> | void
  updateTotalUnreadCount?(): void
  checkMsgExist?(roomId: string, messageId: string): boolean
}
interface ThreadRelation {
  rootEventId: string
  isRoot: boolean
  eventId: string
}
interface SyncHistoryResponse {
  chunk: unknown[]
  end?: string
  start?: string
}

class UnifiedMessageReceiver {
  private static instance: UnifiedMessageReceiver
  private isInitialized = false
  private processingQueue = new Map<string, Promise<MessageReceiveResult>>()
  private syncProcessing = false
  private stats: MessageReceiverStats = { totalReceived: 0, totalProcessed: 0, totalDuplicates: 0, totalErrors: 0 }

  private constructor() {}
  static getInstance(): UnifiedMessageReceiver {
    if (!UnifiedMessageReceiver.instance) UnifiedMessageReceiver.instance = new UnifiedMessageReceiver()
    return UnifiedMessageReceiver.instance
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('[UnifiedMessageReceiver] Already initialized')
      return
    }
    try {
      logger.info('[UnifiedMessageReceiver] Initializing...')
      await this.initializeMatrixListener()
      // WebSocket 支持已移除，现在完全使用 Matrix SDK
      this.isInitialized = true
      logger.info('[UnifiedMessageReceiver] Initialized successfully')
    } catch (err) {
      logger.error('[UnifiedMessageReceiver] Initialization failed:', err)
      throw err
    }
  }

  private async initializeMatrixListener(): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      logger.debug('[UnifiedMessageReceiver] Matrix client not available - will initialize after login')
      return
    }
    const c = client as unknown as { on: (event: string, handler: (...args: unknown[]) => void) => void }
    c.on('Room.timeline', (...args: unknown[]) => {
      const [event, room, toStart] = args as [MatrixEventLike, MatrixRoomLike, boolean]
      if (toStart) return
      if ((event.getType?.() || event.type) === 'm.room.message') this.handleMatrixMessage(event, room)
      this.handleThreadEvent(event, room)
    })
    c.on('Room.receipt', (...args: unknown[]) => {
      const [event, room] = args as [MatrixEventLike, MatrixRoomLike]
      this.handleReceipt(event, room)
    })
    c.on('Room.encryption', (...args: unknown[]) => {
      const [event, room] = args as [MatrixEventLike, MatrixRoomLike]
      this.handleEncryptionEvent(event, room)
    })
    c.on('RoomMember.name', (...args: unknown[]) => {
      const [event, member] = args as [MatrixEventLike, MatrixMemberLike]
      this.handleMemberNameChange(event, member)
    })
    c.on('Room.name', (...args: unknown[]) => {
      const [room] = args as [MatrixRoomLike]
      this.handleRoomNameChange(room)
    })
    logger.info('[UnifiedMessageReceiver] Matrix event listeners initialized')
  }

  private async handleMatrixMessage(event: MatrixEventLike, room: MatrixRoomLike): Promise<void> {
    try {
      const roomId = room.roomId,
        eventId = event.getId?.() || event.eventId || event.event_id
      if (eventId && !messageSyncService.shouldProcessMessage(eventId)) {
        logger.debug('[UnifiedMessageReceiver] Duplicate message ignored:', { eventId, roomId })
        return
      }
      const parsedMessage = parseMatrixEvent(event),
        globalStore = useGlobalStore()
      if (globalStore.currentSession?.roomId === roomId) await this.processMatrixMessage(parsedMessage)
      else await this.updateUnreadCount(roomId)
      logger.debug('[UnifiedMessageReceiver] Matrix message processed:', {
        eventId: event.getId?.(),
        roomId,
        type: event.getType?.()
      })
    } catch (error) {
      logger.error('[UnifiedMessageReceiver] Failed to handle Matrix message:', {
        eventId: event.getId?.(),
        roomId: room.roomId,
        error
      })
    }
  }

  private async handleReceipt(event: MatrixEventLike, room: MatrixRoomLike): Promise<void> {
    try {
      const content = event.getContent?.(),
        eventId = event.getEventId?.(),
        roomId = room.roomId
      if (event.getType?.() === 'm.receipt' && content && typeof content === 'object' && 'm.read' in content) {
        const readByUserId = Object.keys((content as { 'm.read': Record<string, unknown> })['m.read'])[0]
        const chatStore = useChatStore() as unknown as ChatStoreLike
        if (typeof chatStore.updateMessageStatus === 'function' && eventId)
          await chatStore.updateMessageStatus(eventId, 'read')
        logger.debug('[UnifiedMessageReceiver] Read receipt processed:', { roomId, eventId, readBy: readByUserId })
      }
    } catch (error) {
      logger.error('[UnifiedMessageReceiver] Failed to handle receipt:', {
        roomId: room.roomId,
        eventId: event.getId?.(),
        error
      })
    }
  }

  private async handleEncryptionEvent(event: MatrixEventLike, room: MatrixRoomLike): Promise<void> {
    try {
      logger.info('[UnifiedMessageReceiver] Room encryption enabled:', {
        roomId: room.roomId,
        eventId: event.getId?.()
      })
    } catch (error) {
      logger.error('[UnifiedMessageReceiver] Failed to handle encryption event:', {
        roomId: room.roomId,
        eventId: event.getId?.(),
        error
      })
    }
  }

  private async handleMemberNameChange(_event: MatrixEventLike, member: MatrixMemberLike): Promise<void> {
    try {
      // Validate member object has required properties
      if (!member?.roomId || !member?.userId) {
        logger.warn('[UnifiedMessageReceiver] Skipping member name change - missing required properties:', {
          hasRoomId: !!member?.roomId,
          hasUserId: !!member?.userId,
          member
        })
        return
      }

      const chatStore = useChatStore() as unknown as ChatStoreLike
      const info: { name?: string; displayName?: string } = {}
      if (member.name !== undefined) info.name = member.name
      if (member.displayName !== undefined) info.displayName = member.displayName
      await chatStore.updateMemberInfo?.(member.roomId, member.userId, info)
      logger.debug('[UnifiedMessageReceiver] Member name updated:', {
        roomId: member.roomId,
        userId: member.userId,
        name: member.name
      })
    } catch (error) {
      logger.error('[UnifiedMessageReceiver] Failed to handle member name change:', {
        roomId: member?.roomId,
        userId: member?.userId,
        error
      })
    }
  }

  private async handleRoomNameChange(room: MatrixRoomLike): Promise<void> {
    try {
      const chatStore = useChatStore() as unknown as ChatStoreLike
      const updateData: { name?: string; topic?: string } = {}
      if (room.name !== undefined) updateData.name = room.name
      if (room.topic !== undefined) updateData.topic = room.topic
      await chatStore.updateRoomInfo?.(room.roomId, updateData)
      logger.debug('[UnifiedMessageReceiver] Room name updated:', { roomId: room.roomId, name: room.name })
    } catch (error) {
      logger.error('[UnifiedMessageReceiver] Failed to handle room name change:', error)
    }
  }

  private async processMatrixMessage(message: ParsedMessage): Promise<void> {
    try {
      const chatStore = useChatStore() as unknown as ChatStoreLike
      if (typeof chatStore.pushMsg === 'function') await chatStore.pushMsg(message)
      else if (typeof chatStore.addMessageToSessionList === 'function') chatStore.addMessageToSessionList(message)
      const globalStore = useGlobalStore()
      if (globalStore.currentSession?.roomId === message.roomId) {
        const client = matrixClientService.getClient()
        if (client && message.id) {
          try {
            // Use SDK's native sendReadReceipt(roomId, eventId) signature
            await (
              client as unknown as { sendReadReceipt: (roomId: string, eventId: string) => Promise<void> }
            ).sendReadReceipt(message.roomId, message.id)
          } catch (error) {
            logger.warn('[UnifiedMessageReceiver] Failed to send read receipt:', error)
          }
        }
      }
      logger.debug('[UnifiedMessageReceiver] Message processed:', {
        roomId: message.roomId,
        messageId: message.id,
        type: message.type
      })
    } catch (error) {
      logger.error('[UnifiedMessageReceiver] Failed to process message:', {
        roomId: message.roomId,
        messageId: message.id,
        error
      })
    }
  }

  private async updateUnreadCount(roomId: string): Promise<void> {
    try {
      const chatStore = useChatStore() as unknown as ChatStoreLike
      if (typeof chatStore.updateUnreadCount === 'function') await chatStore.updateUnreadCount(roomId, 1)
      else if (typeof chatStore.updateTotalUnreadCount === 'function') chatStore.updateTotalUnreadCount()
      logger.debug('[UnifiedMessageReceiver] Unread count updated:', { roomId })
    } catch (error) {
      logger.error('[UnifiedMessageReceiver] Failed to update unread count:', { roomId, error })
    }
  }

  private async handleThreadEvent(event: MatrixEventLike, room: MatrixRoomLike): Promise<void> {
    try {
      if ((event.getType?.() || event.type) !== 'm.room.message') return
      const eventId = event.getId?.() || event.eventId,
        roomId = room.roomId
      if (!eventId) return
      const threadRelation = threadService.getThreadRelation(eventId, room as unknown as MatrixRoomLike)
      if (threadRelation) {
        logger.debug('[UnifiedMessageReceiver] Thread event detected:', {
          eventId,
          roomId,
          rootEventId: threadRelation.rootEventId,
          isRoot: threadRelation.isRoot
        })
        threadService.invalidateThreadCache(roomId, threadRelation.rootEventId)
        this.emitThreadUpdate(roomId, threadRelation)
      }
    } catch (error) {
      logger.error('[UnifiedMessageReceiver] Failed to handle thread event:', {
        eventId: event.getId?.(),
        roomId: room.roomId,
        error
      })
    }
  }

  private emitThreadUpdate(roomId: string, threadRelation: ThreadRelation): void {
    const globalStore = useGlobalStore()
    if (globalStore.currentSession?.roomId === roomId)
      logger.debug('[UnifiedMessageReceiver] Thread update for current room:', {
        roomId,
        rootEventId: threadRelation.rootEventId
      })
  }

  private async syncThreadStatus(roomId: string): Promise<void> {
    try {
      const threads = await threadService.getRoomThreads(roomId)
      logger.debug('[UnifiedMessageReceiver] Syncing thread status:', { roomId, threadCount: threads.length })
      for (const thread of threads) {
        const unreadCount = await threadService.getThreadUnreadCount(thread.eventId, roomId)
        if (unreadCount > 0)
          logger.debug('[UnifiedMessageReceiver] Thread has unread messages:', {
            threadId: thread.eventId,
            unreadCount
          })
      }
    } catch (error) {
      logger.error('[UnifiedMessageReceiver] Failed to sync thread status:', { roomId, error })
    }
  }

  async syncHistoryMessages(roomId: string, options?: { limit?: number; from?: string }): Promise<void> {
    if (this.syncProcessing) {
      logger.warn('[UnifiedMessageReceiver] Sync already in progress')
      return
    }
    this.syncProcessing = true
    try {
      const client = matrixClientService.getClient()
      if (!client) throw new Error('Matrix client not available')
      const response = await (
        client as unknown as {
          createMessagesRequest: (
            roomId: string,
            from: string | null,
            dir: string,
            limit: number
          ) => Promise<SyncHistoryResponse>
        }
      ).createMessagesRequest(roomId, options?.from ?? null, 'b', options?.limit || 50)
      const chatStore = useChatStore() as unknown as ChatStoreLike
      for (const event of response.chunk) {
        const evt = event as MatrixEventLike
        if ((evt.getType?.() || evt.type) === 'm.room.message') {
          const parsedMessage = parseMatrixEvent(evt)
          if (typeof chatStore.addMessageToSessionList === 'function') chatStore.addMessageToSessionList(parsedMessage)
          else if (typeof chatStore.pushMsg === 'function') await chatStore.pushMsg(parsedMessage)
        }
      }
      logger.info('[UnifiedMessageReceiver] History sync completed:', { roomId, count: response.chunk.length })
      await this.syncThreadStatus(roomId)
    } catch (error) {
      logger.error('[UnifiedMessageReceiver] Failed to sync history messages:', { roomId, error })
      throw error
    } finally {
      this.syncProcessing = false
    }
  }

  async receiveMessage(
    message: MessageType,
    source: MessageSource = 'matrix',
    options: MessageReceiveOptions = {}
  ): Promise<MessageReceiveResult> {
    const messageId = message.message?.id || 'unknown',
      roomId = message.message?.roomId || 'unknown'
    this.stats.totalReceived++
    this.stats.lastReceivedTime = Date.now()
    if (import.meta.env.MODE === 'development')
      logger.debug(`[UnifiedMessageReceiver] Message received from ${source}`, {
        messageId,
        roomId,
        type: message.message?.type,
        fromUser: message.fromUser?.uid
      })
    try {
      const existingPromise = this.processingQueue.get(messageId)
      if (existingPromise) {
        if (import.meta.env.MODE === 'development')
          logger.debug(`[UnifiedMessageReceiver] Message already being processed: ${messageId}`)
        return await existingPromise
      }
      const processingPromise = this.processMessage(message, source, options)
      this.processingQueue.set(messageId, processingPromise)
      const result = await processingPromise
      this.processingQueue.delete(messageId)
      if (result.success) this.stats.totalProcessed++
      if (result.wasDuplicate) this.stats.totalDuplicates++
      if (result.error) this.stats.totalErrors++
      return result
    } catch (err) {
      this.stats.totalErrors++
      this.processingQueue.delete(messageId)
      const errorMsg = err instanceof Error ? err.message : String(err)
      logger.error(`[UnifiedMessageReceiver] Error receiving message:`, { messageId, roomId, error: errorMsg })
      return { success: false, messageId, roomId, wasDuplicate: false, processed: false, error: errorMsg }
    }
  }

  private async processMessage(
    message: MessageType,
    source: MessageSource,
    options: MessageReceiveOptions
  ): Promise<MessageReceiveResult> {
    const messageId = message.message?.id || 'unknown',
      roomId = message.message?.roomId || 'unknown'
    const chatStore = useChatStore()
    if (!options.skipDuplicateCheck && chatStore.checkMsgExist(roomId, messageId)) {
      if (import.meta.env.MODE === 'development')
        logger.debug(`[UnifiedMessageReceiver] Duplicate message detected:`, { messageId, roomId, source })
      return { success: true, messageId, roomId, wasDuplicate: true, processed: false }
    }
    const validationResult = this.validateMessage(message)
    if (!validationResult.valid)
      return { success: false, messageId, roomId, wasDuplicate: false, processed: false, error: validationResult.error }
    const transformedMessage = this.transformMessage(message, source)
    try {
      const globalStore = useGlobalStore()
      const route = (globalStore as unknown as { route?: { path?: string } }).route
      chatStore.pushMsg(transformedMessage, {
        isActiveChatView: route?.path === '/message',
        activeRoomId: globalStore.currentSessionRoomId || ''
      })
      if (import.meta.env.MODE === 'development')
        logger.debug(`[UnifiedMessageReceiver] Message pushed to store:`, { messageId, roomId, source })
    } catch (err) {
      throw new Error(`Failed to push message to store: ${err}`)
    }
    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      try {
        if (message.message?.sendTime) message.message.sendTime = new Date(message.message.sendTime).getTime()
        await invoke(TauriCommand.SAVE_MSG, { data: message })
      } catch (err) {
        logger.warn(`[UnifiedMessageReceiver] Failed to persist message:`, err)
      }
    }
    return { success: true, messageId, roomId, wasDuplicate: false, processed: true }
  }

  private validateMessage(message: MessageType): { valid: boolean; error?: string } {
    if (!message.message) return { valid: false, error: 'Missing message payload' }
    if (!message.message.id) return { valid: false, error: 'Missing message ID' }
    if (!message.message.roomId) return { valid: false, error: 'Missing room ID' }
    if (!message.fromUser?.uid) return { valid: false, error: 'Missing sender information' }
    return { valid: true }
  }

  private transformMessage(message: MessageType, _source: MessageSource): MessageType {
    return message
  }
  getStats(): MessageReceiverStats {
    return { ...this.stats }
  }
  resetStats(): void {
    this.stats = { totalReceived: 0, totalProcessed: 0, totalDuplicates: 0, totalErrors: 0 }
  }
  getProcessingQueueSize(): number {
    return this.processingQueue.size
  }
  getIsInitialized(): boolean {
    return this.isInitialized
  }

  async stop(): Promise<void> {
    if (!this.isInitialized) return
    logger.info('[UnifiedMessageReceiver] Stopping...')
    const promises = Array.from(this.processingQueue.values())
    if (promises.length > 0) {
      logger.info(`[UnifiedMessageReceiver] Waiting for ${promises.length} messages to finish processing...`)
      await Promise.allSettled(promises)
    }
    const client = matrixClientService.getClient()
    if (client && typeof (client as unknown as { removeAllListeners?: () => void }).removeAllListeners === 'function')
      (client as unknown as { removeAllListeners: () => void }).removeAllListeners()
    // WebSocket 支持已移除，现在完全使用 Matrix SDK
    this.processingQueue.clear()
    this.isInitialized = false
    logger.info('[UnifiedMessageReceiver] Stopped')
  }
}

export const unifiedMessageReceiver = UnifiedMessageReceiver.getInstance()
/** @deprecated 请使用 unifiedMessageReceiver 代替 */
export const messageReceiver = unifiedMessageReceiver
/** @deprecated 请使用 UnifiedMessageReceiver 代替 */
export { UnifiedMessageReceiver as MessageReceiver }

/**
 * @deprecated WebSocket 支持已移除，请使用 receiveMatrixMessage 代替
 */
export async function receiveWebSocketMessage(
  message: MessageType,
  options?: MessageReceiveOptions
): Promise<MessageReceiveResult> {
  return unifiedMessageReceiver.receiveMessage(message, 'matrix', options)
}
export async function receiveMatrixMessage(
  message: MessageType,
  options?: MessageReceiveOptions
): Promise<MessageReceiveResult> {
  return unifiedMessageReceiver.receiveMessage(message, 'matrix', options)
}
export async function receiveLocalMessage(
  message: MessageType,
  options?: MessageReceiveOptions
): Promise<MessageReceiveResult> {
  return unifiedMessageReceiver.receiveMessage(message, 'local', options)
}

if (import.meta.env.MODE === 'development' && typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).unifiedMessageReceiver = unifiedMessageReceiver
  ;(window as unknown as Record<string, unknown>).getMessageReceiverStats = () => unifiedMessageReceiver.getStats()
}

export default unifiedMessageReceiver
