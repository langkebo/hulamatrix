<template>
  <div class="matrix-chat-main">
    <!-- 通话状态栏 -->
    <MatrixCallBar
      v-if="activeCall"
      :call="activeCall as never"
      @click="handleCallBarClick"
    />

    <!-- 消息列表 -->
    <div class="message-list" ref="messageListRef">
      <!-- 加载更多 -->
      <div v-if="hasMore" class="load-more">
        <n-button
          text
          :loading="loadingHistory"
          @click="loadHistory"
        >
          加载历史消息
        </n-button>
      </div>

    <!-- 消息项 -->
    <n-virtual-list
      v-if="messages.length > 200"
      :items="messages"
      :item-size="72">
      <template #default="{ item: message }">
        <div
          :key="message.eventId"
          class="message-item"
          data-test="message-item"
          :class="{
            'own': isOwnMessage(message),
            'highlight': (message as ExtendedMatrixMessage).highlighted,
            'bot': (message as ExtendedMatrixMessage).senderType === 'bot'
          }"
        >
          <MatrixMessage
            :message="matrixMessageToMsgType(message)"
            :show-avatar="!isConsecutive(message)"
            :show-timestamp="shouldShowTimestamp(message)"
            @user-click="handleUserClick"
            @react="(_msg, emoji) => handleReaction(message.eventId, emoji)"
            @reply="handleReply"
            @edit="handleEdit"
            @delete="handleDelete"
            @retry="handleRetry"
          />
        </div>
      </template>
    </n-virtual-list>
    <template v-else>
      <div
        v-for="message in messages"
        :key="message.eventId"
        class="message-item"
        data-test="message-item"
        :class="{
          'own': isOwnMessage(message),
          'highlight': (message as ExtendedMatrixMessage).highlighted,
          'bot': (message as ExtendedMatrixMessage).senderType === 'bot'
        }"
      >
        <MatrixMessage
          :message="matrixMessageToMsgType(message)"
          :show-avatar="!isConsecutive(message)"
          :show-timestamp="shouldShowTimestamp(message)"
          @user-click="handleUserClick"
          @react="(_msg, emoji) => handleReaction(message.eventId, emoji)"
          @reply="handleReply"
          @edit="handleEdit"
          @delete="handleDelete"
          @retry="handleRetry"
        />
      </div>
    </template>

      <!-- 正在输入 -->
      <div v-if="typingUsers.length > 0" class="typing-indicator">
        <div class="typing-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <span class="typing-text">
          {{ getTypingText() }}
        </span>
      </div>

      <!-- 空状态 -->
      <div v-if="messages.length === 0 && !loadingHistory" class="empty-state">
        <n-empty
          description="暂无消息"
          size="large"
        >
          <template #icon>
            <n-icon :component="Messages" size="48" />
          </template>
          <n-button @click="handleEmptyAction">
            发送第一条消息
          </n-button>
        </n-empty>
      </div>
    </div>

    <!-- 消息回复预览 -->
    <div
      v-if="replyingTo"
      class="message-reply-preview"
    >
      <div class="reply-content">
        <n-icon :component="ArrowLeft" />
        <span>回复 {{ isMsgType(replyingTo) ? (replyingTo.fromUser?.uid || replyingTo.id) : ((replyingTo as ExtendedMatrixMessage).senderName || replyingTo.sender) }} 的消息</span>
        <span class="reply-text">{{ truncateText(getReplyText(), 50) }}</span>
      </div>
      <n-button
        text
        size="small"
        @click="cancelReply"
      >
        <n-icon :component="X" />
      </n-button>
    </div>

    <!-- 消息编辑预览 -->
    <div
      v-if="editingMessage"
      class="message-edit-preview"
    >
      <div class="edit-content">
        <n-icon :component="Edit" />
        <span>编辑消息</span>
        <span class="edit-text">{{ truncateText(getMatrixMessageText(editingMessage.content), 50) }}</span>
      </div>
      <n-button
        text
        size="small"
        @click="cancelEdit"
      >
        <n-icon :component="X" />
      </n-button>
    </div>

    <!-- 未读消息分隔线 -->
    <div
      v-if="unreadMarker"
      class="unread-divider"
      :style="{ top: unreadMarker.top + 'px' }"
    >
      <div class="unread-line"></div>
      <span class="unread-text">{{ unreadMarker.count }} 条未读消息</span>
      <div class="unread-line"></div>
    </div>

    <!-- 跳转到底部 -->
    <Transition name="fade">
      <div
        v-if="showScrollToBottom"
        class="scroll-to-bottom"
        @click="scrollToBottom"
      >
        <n-badge :value="newMessageCount" :max="99" show-zero>
          <n-button circle type="primary">
            <n-icon :component="ChevronDown" />
          </n-button>
        </n-badge>
      </div>
    </Transition>

    <!-- 引用消息弹窗 -->
    <n-modal
      v-model:show="showQuoteModal"
      preset="card"
      style="width: 600px"
      title="引用消息"
    >
      <MatrixMessageQuote
        v-if="quotedMessage"
        :message="quotedMessage"
        @close="showQuoteModal = false"
      />
    </n-modal>

    <!-- 消息详情弹窗 -->
    <n-modal
      v-model:show="showMessageDetail"
      preset="card"
      style="width: 500px"
      title="消息详情"
    >
      <MessageDetail
        v-if="detailMessage"
        :message="detailMessage"
        @close="showMessageDetail = false"
      />
    </n-modal>

    <!-- 通话全屏覆盖 -->
    <MatrixCallOptimized
      v-if="activeCall"
      :room-id="roomId"
      :compact="false"
      @call-ended="handleCallEnded"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { NButton, NIcon, NEmpty, NBadge, NModal, NVirtualList, useMessage } from 'naive-ui'
import { Messages, ArrowLeft, X, Edit, ChevronDown } from '@vicons/tabler'
import { useUserStore } from '@/stores/user'
import { matrixClientService } from '@/integrations/matrix/client'
import { matrixCallService } from '@/services/matrixCallService'
import { logger } from '@/utils/logger'
import type { MatrixMessage as MatrixMessageType, MatrixMessageContent } from '@/types/matrix'
import type { IMatrixRoom, IMatrixTimeline, IMatrixEvent, IMatrixRoomState } from '@/types/matrix'
import { getMatrixMessageText, getMatrixContentProperty, isMatrixContentObject } from '@/types/matrix'
import { MatrixCall } from '@/services/matrixCallService'
import type { MsgType } from '@/services/types'
import { MsgEnum, MessageStatusEnum } from '@/enums'

// Components
import MatrixCallBar from './MatrixCallBar.vue'
import MatrixMessage from './MatrixMessage.vue'
import MatrixMessageQuote from './MatrixMessageQuote.vue'
import MessageDetail from './MessageDetail.vue'
import MatrixCallOptimized from './MatrixCallOptimized.vue'

/**
 * Convert Matrix message type to MsgEnum
 */
function convertMatrixTypeToMsgEnum(matrixType: string): MsgEnum {
  const typeMap: Record<string, MsgEnum> = {
    'm.text': MsgEnum.TEXT,
    'm.image': MsgEnum.IMAGE,
    'm.audio': MsgEnum.VOICE,
    'm.video': MsgEnum.VIDEO,
    'm.file': MsgEnum.FILE,
    'm.notice': MsgEnum.SYSTEM,
    'm.room.message': MsgEnum.TEXT,
    'm.room.encrypted': MsgEnum.TEXT
  }
  return typeMap[matrixType] || MsgEnum.UNKNOWN
}

interface Props {
  roomId: string
  showSidebar?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showSidebar: false
})

const emit = defineEmits<{
  toggleSidebar: []
  messageFocus: [messageId: string]
  showUserProfile: [userId: string]
}>()

// Message utility (renamed to avoid shadowing with parameter names)
const nMessage = useMessage()

// Stores
const userStore = useUserStore()

// Refs
const messageListRef = ref<HTMLElement>()
const loadingHistory = ref(false)
const hasMore = ref(true)
const messages = ref<MatrixMessageType[]>([])
const typingUsers = ref<string[]>([])
const activeCall = ref<MatrixCall | null>(null)
const replyingTo = ref<MsgType | MatrixMessageType | null>(null)
const editingMessage = ref<MatrixMessageType | null>(null)
const showQuoteModal = ref(false)
const quotedMessage = ref<MatrixMessageType | null>(null)
const showMessageDetail = ref(false)
const detailMessage = ref<MatrixMessageType | null>(null)
const showScrollToBottom = ref(false)
const newMessageCount = ref(0)
const unreadMarker = ref<{ top: number; count: number } | null>(null)
const lastReadEventId = ref<string>('')

// Extended message interface with optional UI properties
interface ExtendedMatrixMessage extends MatrixMessageType {
  highlighted?: boolean
  senderType?: string
  senderName?: string
}

// Helper to check if replyingTo is MsgType
function isMsgType(obj: MsgType | MatrixMessageType | null): obj is MsgType {
  return obj !== null && 'type' in obj && typeof obj.type === 'number'
}

// Computed
const currentUserId = computed(() => userStore.userInfo?.uid || '')

// Methods
const matrixMessageToMsgType = (matrixMsg: MatrixMessageType): MsgType => {
  return {
    id: matrixMsg.eventId,
    roomId: matrixMsg.roomId,
    type: convertMatrixTypeToMsgEnum(matrixMsg.type),
    body: { content: getMatrixMessageText(matrixMsg.content) },
    sendTime: matrixMsg.timestamp,
    messageMarks: {},
    status: MessageStatusEnum.SUCCESS,
    // Add additional properties for MatrixMessage compatibility
    encrypted: matrixMsg.encrypted || false,
    fromUser: { uid: matrixMsg.sender },
    message: {
      id: matrixMsg.eventId,
      roomId: matrixMsg.roomId,
      sendTime: matrixMsg.timestamp,
      type: convertMatrixTypeToMsgEnum(matrixMsg.type),
      body: { content: getMatrixMessageText(matrixMsg.content) },
      status: MessageStatusEnum.SUCCESS
    },
    isReply:
      matrixMsg.type === 'm.reply' ||
      (getMatrixContentProperty(matrixMsg.content, 'm.relates_to') as Record<string, unknown> | undefined)?.[
        'rel_type'
      ] === 'm.reply'
  }
}

const loadMessages = async () => {
  try {
    loadingHistory.value = true
    const client = matrixClientService.getClient()
    if (!client) {
      nMessage.error('Matrix 客户端未初始化')
      return
    }

    // Get room from client
    const getRoomMethod = client.getRoom as ((roomId: string) => IMatrixRoom | null) | undefined
    const room = getRoomMethod?.(props.roomId)
    if (!room) {
      nMessage.error('房间不存在')
      return
    }

    // Get live timeline from room
    const getLiveTimelineMethod = room.getLiveTimeline as (() => IMatrixTimeline | null) | undefined
    const timeline = getLiveTimelineMethod?.()
    if (!timeline) {
      messages.value = []
      hasMore.value = false
      return
    }

    // Get events from timeline
    const getEventsMethod = timeline.getEvents as (() => IMatrixEvent[]) | undefined
    const events = getEventsMethod?.() || []

    // Convert SDK events to MatrixMessageType
    const roomMessages: MatrixMessageType[] = events
      .filter((event) => {
        // Filter out state events and non-message events
        const eventType = event.getType ? event.getType() : undefined
        const isState = event.isState ? event.isState() : false
        return !isState && (eventType === 'm.room.message' || eventType === 'm.room.encrypted')
      })
      .map((event): MatrixMessageType => {
        const content = event.getContent ? event.getContent() : {}
        return {
          eventId: event.getId ? event.getId() : '',
          roomId: event.getRoomId ? event.getRoomId() : props.roomId,
          sender: event.getSender ? event.getSender() : '',
          type: content.msgtype || 'm.text',
          content: content as MatrixMessageContent,
          timestamp: event.getTs ? event.getTs() : Date.now(),
          encrypted: event.isEncrypted ? event.isEncrypted() : false,
          _event: event
        }
      })

    messages.value = roomMessages
    hasMore.value = room.canPaginateBackward ? room.canPaginateBackward() : false
    await nextTick()
    scrollToBottom()
  } catch (error) {
    logger.error('[MatrixChatMain] 加载消息失败:', error)
    nMessage.error('加载消息失败')
  } finally {
    loadingHistory.value = false
  }
}

const loadHistory = async () => {
  if (!hasMore.value || loadingHistory.value) return

  try {
    loadingHistory.value = true
    const client = matrixClientService.getClient()
    if (!client) {
      nMessage.error('Matrix 客户端未初始化')
      return
    }

    // Get room from client
    const getRoomMethod = client.getRoom as ((roomId: string) => IMatrixRoom | null) | undefined
    const room = getRoomMethod?.(props.roomId)
    if (!room) {
      nMessage.error('房间不存在')
      return
    }

    // Get live timeline from room
    const getLiveTimelineMethod = room.getLiveTimeline as (() => IMatrixTimeline | null) | undefined
    const timeline = getLiveTimelineMethod?.()
    if (!timeline) {
      hasMore.value = false
      return
    }

    // Use paginateEventTimeline to load older events
    const paginateEventTimelineMethod = client.paginateEventTimeline as
      | ((eventTimeline: unknown, opts: { backwards: boolean; limit: number }) => Promise<boolean>)
      | undefined

    if (!paginateEventTimelineMethod) {
      hasMore.value = false
      return
    }

    // Pagination: load 50 older events
    const paginated = await paginateEventTimelineMethod(timeline, {
      backwards: true,
      limit: 50
    })

    if (!paginated) {
      hasMore.value = false
      return
    }

    // Get the updated events from timeline
    const getEventsMethod = timeline.getEvents as (() => IMatrixEvent[]) | undefined
    const events = getEventsMethod?.() || []

    // Convert SDK events to MatrixMessageType
    const olderMessages: MatrixMessageType[] = events
      .filter((event) => {
        // Filter out state events and non-message events
        const eventType = event.getType ? event.getType() : undefined
        const isState = event.isState ? event.isState() : false
        return !isState && (eventType === 'm.room.message' || eventType === 'm.room.encrypted')
      })
      .map((event): MatrixMessageType => {
        const content = event.getContent ? event.getContent() : {}
        return {
          eventId: event.getId ? event.getId() : '',
          roomId: event.getRoomId ? event.getRoomId() : props.roomId,
          sender: event.getSender ? event.getSender() : '',
          type: content.msgtype || 'm.text',
          content: content as MatrixMessageContent,
          timestamp: event.getTs ? event.getTs() : Date.now(),
          encrypted: event.isEncrypted ? event.isEncrypted() : false,
          _event: event
        }
      })

    // Merge with existing messages, avoiding duplicates
    const existingEventIds = new Set(messages.value.map((m) => m.eventId))
    const newMessages = olderMessages.filter((m) => !existingEventIds.has(m.eventId))

    if (newMessages.length > 0) {
      messages.value = [...newMessages, ...messages.value]
    }

    // Update hasMore based on whether we can still paginate
    hasMore.value = room.canPaginateBackward ? room.canPaginateBackward() : false

    logger.info('[MatrixChatMain] 加载历史消息成功', { count: newMessages.length })
  } catch (error) {
    logger.error('[MatrixChatMain] 加载历史消息失败:', error)
    nMessage.error('加载历史消息失败')
    hasMore.value = false
  } finally {
    loadingHistory.value = false
  }
}

const isOwnMessage = (message: MatrixMessageType): boolean => {
  return message.sender === currentUserId.value
}

const isConsecutive = (message: MatrixMessageType): boolean => {
  const index = messages.value.findIndex((m) => m.eventId === message.eventId)
  if (index <= 0) return false

  const prevMessage = messages.value[index - 1]
  if (!prevMessage) return false

  const timeDiff = message.timestamp - prevMessage.timestamp
  return (
    prevMessage.sender === message.sender &&
    timeDiff < 5 * 60 * 1000 && // 5 minutes
    message.type !== 'm.room.member' &&
    prevMessage.type !== 'm.room.member'
  )
}

const shouldShowTimestamp = (message: MatrixMessageType): boolean => {
  const index = messages.value.findIndex((m) => m.eventId === message.eventId)
  if (index <= 0) return true

  const prevMessage = messages.value[index - 1]
  if (!prevMessage) return true

  const timeDiff = message.timestamp - prevMessage.timestamp
  return timeDiff > 30 * 60 * 1000 // 30 minutes
}

const handleUserClick = (userId: string) => {
  // Emit event to show user profile in the sidebar
  logger.info('[MatrixChatMain] 用户点击:', { userId })
  emit('showUserProfile', userId)
}

const handleReaction = async (messageId: string, emoji: string) => {
  try {
    const client = matrixClientService.getClient()
    if (!client) {
      nMessage.error('Matrix 客户端未初始化')
      return
    }

    // Find the message to get its event ID
    const targetMessage = messages.value.find((m) => m.eventId === messageId)
    if (!targetMessage) {
      nMessage.error('消息不存在')
      return
    }

    // Get the SDK event from the message
    const event = targetMessage._event as unknown as { getId?: () => string } | undefined
    const eventId = event?.getId?.() || targetMessage.eventId

    // Send reaction event using Matrix SDK
    const sendEventMethod = client.sendEvent as
      | ((
          roomId: string,
          eventType: string,
          content: Record<string, unknown>
        ) => Promise<{ event_id?: string } | string>)
      | undefined

    if (sendEventMethod) {
      const reactionContent = {
        'm.relates_to': {
          rel_type: 'm.annotation',
          event_id: eventId,
          key: emoji
        }
      }

      await sendEventMethod(props.roomId, 'm.reaction', reactionContent)
      logger.info('[MatrixChatMain] 表情回应已发送', { eventId, emoji })
      nMessage.success(`已添加 ${emoji} 反应`)
    } else {
      nMessage.error('表情回应功能不可用')
    }
  } catch (error) {
    logger.error('[MatrixChatMain] 发送表情回应失败:', error)
    nMessage.error('发送表情回应失败：' + (error instanceof Error ? error.message : String(error)))
  }
}

const handleReply = (msg: MsgType) => {
  replyingTo.value = msg
  editingMessage.value = null
  // Focus input
  emit('messageFocus', 'reply-input')
}

const handleEdit = (msg: MatrixMessageType) => {
  if (msg.sender !== currentUserId.value) {
    return
  }

  editingMessage.value = msg
  replyingTo.value = null
  // Focus input with message content
  emit('messageFocus', 'edit-input')
}

const handleDelete = async (msg: MatrixMessageType) => {
  if (msg.sender !== currentUserId.value) {
    nMessage.warning('只能删除自己的消息')
    return
  }

  try {
    const client = matrixClientService.getClient()
    if (!client) {
      nMessage.error('Matrix 客户端未初始化')
      return
    }

    // Get the SDK event from the message
    const event = msg._event as unknown as { getId?: () => string } | undefined
    const eventId = event?.getId?.() || msg.eventId

    // Redact the event using Matrix SDK
    const redactEventMethod = client.redactEvent as
      | ((roomId: string, eventId: string, reason?: string) => Promise<Record<string, unknown>>)
      | undefined

    if (redactEventMethod) {
      await redactEventMethod(props.roomId, eventId)
      logger.info('[MatrixChatMain] 消息已删除', { eventId })

      // Remove from local messages
      const index = messages.value.findIndex((m) => m.eventId === msg.eventId)
      if (index > -1) {
        messages.value.splice(index, 1)
      }
      nMessage.success('消息已删除')
    } else {
      nMessage.error('删除功能不可用')
    }
  } catch (error) {
    logger.error('[MatrixChatMain] 删除消息失败:', error)
    nMessage.error('删除消息失败：' + (error instanceof Error ? error.message : String(error)))
  }
}

const handleRetry = async (msg: MatrixMessageType) => {
  if (!msg.localEventId) return

  try {
    // Remove failed message
    const index = messages.value.findIndex((m) => m.localEventId === msg.localEventId)
    if (index > -1) {
      messages.value.splice(index, 1)
    }

    // Resend based on message type
    if (msg.type === 'm.room.message') {
      await matrixClientService.sendTextMessage(props.roomId, getMatrixMessageText(msg.content))
    }
  } catch (_error) {
    nMessage.error('重发消息失败')
  }
}

const handleCallBarClick = () => {
  // Expand call to full screen
  emit('toggleSidebar')
}

const getTypingText = (): string => {
  // Get user display names from room state
  const client = matrixClientService.getClient()
  const names = typingUsers.value.map((userId) => {
    let displayName = userId

    // Try to get display name from room state
    if (client) {
      try {
        const getRoomMethod = client.getRoom as ((roomId: string) => IMatrixRoom | null) | undefined
        const room = getRoomMethod?.(props.roomId)
        if (room) {
          const getLiveTimelineMethod = room.getLiveTimeline as (() => IMatrixTimeline | null) | undefined
          const timeline = getLiveTimelineMethod?.()
          if (timeline) {
            const getStateMethod = timeline.getState as (() => IMatrixRoomState | null) | undefined
            const state = getStateMethod?.()
            if (state) {
              const getUserDisplayNameMethod = state.getUserDisplayName as
                | ((userId: string) => string | undefined)
                | undefined
              displayName = getUserDisplayNameMethod?.(userId) || userId
            }
          }
        }
      } catch (error) {
        logger.warn('[MatrixChatMain] Failed to get user display name:', error)
        // Fallback to extracting localpart from userId
        const parts = userId.split(':')
        displayName = parts[0]?.substring(1) || userId
      }
    } else {
      // Fallback when client is not available
      const parts = userId.split(':')
      displayName = parts[0]?.substring(1) || userId
    }

    return displayName
  })

  if (names.length === 1) {
    return `${names[0]} 正在输入...`
  } else if (names.length === 2) {
    return `${names[0]} 和 ${names[1]} 正在输入...`
  } else {
    return `${names.length} 人正在输入...`
  }
}

const getReplyText = (): string => {
  if (!replyingTo.value) return ''

  const msg = replyingTo.value

  if (isMsgType(msg)) {
    // Handle MsgType from services/types.ts
    switch (msg.type) {
      case MsgEnum.TEXT:
        return typeof msg.body === 'string'
          ? msg.body
          : (msg.body as Record<string, unknown>)?.content?.toString() || '[文本消息]'
      case MsgEnum.IMAGE:
        return '[图片]'
      case MsgEnum.FILE: {
        const body = msg.body as Record<string, unknown>
        return `[文件] ${(body?.filename as string) || '[未命名文件]'}`
      }
      case MsgEnum.VOICE:
        return '[音频]'
      case MsgEnum.VIDEO:
        return '[视频]'
      default:
        return '[消息]'
    }
  } else {
    // Handle MatrixMessageType from types/matrix.ts
    const matrixMsg = msg as MatrixMessageType
    switch (matrixMsg.type) {
      case 'm.text':
        return getMatrixMessageText(matrixMsg.content) || '[文本消息]'
      case 'm.image':
        return '[图片]'
      case 'm.file':
        return '[文件]'
      case 'm.audio':
        return '[音频]'
      case 'm.video':
        return '[视频]'
      default:
        return '[消息]'
    }
  }
}

const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

const cancelReply = () => {
  replyingTo.value = null
}

const cancelEdit = () => {
  editingMessage.value = null
}

const scrollToBottom = async () => {
  if (messageListRef.value) {
    messageListRef.value.scrollTop = messageListRef.value.scrollHeight
    newMessageCount.value = 0
    showScrollToBottom.value = false
    await updateReadMarker()
  }
}

const updateReadMarker = async () => {
  if (messages.value.length > 0) {
    const lastMessage = messages.value[messages.value.length - 1]
    if (lastMessage) {
      lastReadEventId.value = lastMessage.eventId

      // Send read receipt to Matrix
      try {
        await matrixClientService.sendReadReceipt(props.roomId, lastMessage.eventId)
        logger.info('[MatrixChatMain] 已读回执发送成功', { eventId: lastMessage.eventId })
      } catch (error) {
        logger.warn('[MatrixChatMain] 发送已读回执失败:', error)
        // Non-fatal error, don't show message to user
      }
    }
    unreadMarker.value = null
  }
}

const handleEmptyAction = () => {
  emit('messageFocus', 'message-input')
}

const handleCallEnded = (_call: MatrixCall) => {
  activeCall.value = null
}

// Event handlers
const handleScroll = async () => {
  if (!messageListRef.value) return

  const { scrollTop, scrollHeight, clientHeight } = messageListRef.value

  // Check if near bottom
  const isNearBottom = scrollHeight - scrollTop - clientHeight < 100

  if (isNearBottom) {
    newMessageCount.value = 0
    showScrollToBottom.value = false
    await updateReadMarker()
  } else {
    showScrollToBottom.value = newMessageCount.value > 0
  }

  // Load more when scrolling to top
  if (scrollTop === 0 && hasMore.value) {
    loadHistory()
  }
}

const handleNewMessage = (event: CustomEvent) => {
  const { message } = event.detail

  // Add message if it belongs to current room
  if (message.roomId === props.roomId) {
    messages.value.push(message)

    // Update scroll position
    nextTick(() => {
      if (messageListRef.value) {
        const isNearBottom =
          messageListRef.value.scrollHeight - messageListRef.value.scrollTop - messageListRef.value.clientHeight < 100

        if (isNearBottom) {
          scrollToBottom()
        } else {
          newMessageCount.value++
          showScrollToBottom.value = true
        }
      }
    })
  }
}

const handleTypingEvent = (event: CustomEvent) => {
  const { roomId, userIds } = event.detail

  if (roomId === props.roomId) {
    // Filter out current user
    typingUsers.value = userIds.filter((id: string) => id !== currentUserId.value)
  }
}

const handleCallInvite = (event: CustomEvent) => {
  const { call } = event.detail

  if (call.roomId === props.roomId) {
    // Get the actual call object from the service to preserve methods
    // Use type assertion to ensure we get the full MatrixCall class
    const serviceCall = matrixCallService.getActiveCall(call.callId)
    activeCall.value = (serviceCall ?? call) as MatrixCall
  }
}

// Watchers
watch(
  () => props.roomId,
  () => {
    loadMessages()
  }
)

// Lifecycle
onMounted(() => {
  loadMessages()

  // Add scroll listener
  if (messageListRef.value) {
    messageListRef.value.addEventListener('scroll', handleScroll)
  }

  // Listen for Matrix events
  window.addEventListener('matrixMessage', handleNewMessage as EventListener)
  window.addEventListener('matrixTyping', handleTypingEvent as EventListener)
  window.addEventListener('matrixCallInvite', handleCallInvite as EventListener)

  // Check for active call
  activeCall.value = matrixCallService.getActiveCall(props.roomId) ?? null
})

onUnmounted(() => {
  // Remove scroll listener
  if (messageListRef.value) {
    messageListRef.value.removeEventListener('scroll', handleScroll)
  }

  // Remove event listeners
  window.removeEventListener('matrixMessage', handleNewMessage as EventListener)
  window.removeEventListener('matrixTyping', handleTypingEvent as EventListener)
  window.removeEventListener('matrixCallInvite', handleCallInvite as EventListener)
})
</script>

<style scoped>
.matrix-chat-main {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  background: var(--n-color);
}

.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.load-more {
  display: flex;
  justify-content: center;
  padding: 8px;
}

.message-item {
  position: relative;
}

.message-item.own {
  display: flex;
  justify-content: flex-end;
}

.message-item.highlight {
  background: rgba(var(--n-warning-color-rgb), 0.1);
  border-radius: 8px;
  padding: 4px;
}

.message-item.bot {
  opacity: 0.8;
}

.typing-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  color: var(--n-text-color-3);
  font-size: 12px;
}

.typing-dots {
  display: flex;
  gap: 4px;
}

.typing-dots span {
  width: 4px;
  height: 4px;
  background: var(--n-text-color-3);
  border-radius: 50%;
  animation: typing 1.4s infinite ease-in-out;
}

.typing-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%, 60%, 100% {
    transform: translateY(0);
    opacity: 0.5;
  }
  30% {
    transform: translateY(-10px);
    opacity: 1;
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
}

.message-reply-preview,
.message-edit-preview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: var(--n-hover-color);
  border-top: 1px solid var(--n-border-color);
  gap: 12px;
}

.reply-content,
.edit-content {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.reply-text,
.edit-text {
  color: var(--n-text-color-3);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.unread-divider {
  position: absolute;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  z-index: 10;
  pointer-events: none;
}

.unread-line {
  flex: 1;
  height: 1px;
  background: var(--n-primary-color);
}

.unread-text {
  font-size: 12px;
  color: var(--n-primary-color);
  white-space: nowrap;
}

.scroll-to-bottom {
  position: absolute;
  bottom: 20px;
  right: 20px;
  z-index: 10;
  cursor: pointer;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Responsive */
@media (max-width: 768px) {
  .message-list {
    padding: 12px;
  }

  .typing-indicator {
    padding: 6px 12px;
  }

  .scroll-to-bottom {
    bottom: 16px;
    right: 16px;
  }
}
</style>
