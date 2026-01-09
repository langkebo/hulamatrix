import { ref, type Ref, nextTick } from 'vue'
import { logger } from '@/utils/logger'

interface ChatMessage {
  id: string
  senderId: string
  senderName: string
  content: string
  timestamp: number
}

interface UseCallChatOptions {
  callId: Ref<string>
  rtcManager: {
    sendGroupCallMessage: (callId: string, content: string) => Promise<void>
  }
  currentUserId: Ref<string>
  currentUserName: Ref<string>
}

interface UseCallChatReturn {
  // States
  chatMessages: Ref<ChatMessage[]>
  chatInput: Ref<string>
  unreadChatCount: Ref<number>
  isChatOpen: Ref<boolean>
  chatMessagesRef: Ref<HTMLElement | undefined>

  // Actions
  toggleChat: () => void
  sendChatMessage: () => Promise<void>
  addChatMessage: (message: ChatMessage) => void
  scrollToBottomChat: () => void
}

/**
 * Composable for managing chat in a group call
 * Handles messages, unread count, and chat UI state
 */
export function useCallChat(options: UseCallChatOptions): UseCallChatReturn {
  const { callId, rtcManager, currentUserId, currentUserName } = options

  // States
  const chatMessages = ref<ChatMessage[]>([])
  const chatInput = ref('')
  const unreadChatCount = ref(0)
  const isChatOpen = ref(false)
  const chatMessagesRef = ref<HTMLElement>()

  /**
   * Toggle chat open/close
   */
  const toggleChat = () => {
    isChatOpen.value = !isChatOpen.value
    if (isChatOpen.value) {
      unreadChatCount.value = 0
      nextTick(() => {
        scrollToBottomChat()
      })
    }
  }

  /**
   * Send a chat message
   */
  const sendChatMessage = async () => {
    const trimmedInput = chatInput.value.trim()
    if (!trimmedInput) {
      return
    }

    const message: ChatMessage = {
      id: `msg_${Date.now()}`,
      senderId: currentUserId.value,
      senderName: currentUserName.value,
      content: trimmedInput,
      timestamp: Date.now()
    }

    chatMessages.value.push(message)

    try {
      await rtcManager.sendGroupCallMessage(callId.value, message.content)
      logger.debug(`[useCallChat] Message sent: ${message.content.substring(0, 50)}...`)
    } catch (error) {
      logger.error('[useCallChat] Failed to send message:', error)
    }

    chatInput.value = ''

    nextTick(() => {
      scrollToBottomChat()
    })
  }

  /**
   * Add a chat message (received from other participants)
   */
  const addChatMessage = (message: ChatMessage) => {
    chatMessages.value.push(message)

    // Increment unread count if chat is closed
    if (!isChatOpen.value) {
      unreadChatCount.value++
    }

    // Auto-scroll if chat is open
    if (isChatOpen.value) {
      nextTick(() => {
        scrollToBottomChat()
      })
    }

    logger.debug(`[useCallChat] Message received from ${message.senderName}: ${message.content.substring(0, 50)}...`)
  }

  /**
   * Scroll chat to bottom
   */
  const scrollToBottomChat = () => {
    if (chatMessagesRef.value) {
      chatMessagesRef.value.scrollTop = chatMessagesRef.value.scrollHeight
    }
  }

  return {
    // States
    chatMessages,
    chatInput,
    unreadChatCount,
    isChatOpen,
    chatMessagesRef,

    // Actions
    toggleChat,
    sendChatMessage,
    addChatMessage,
    scrollToBottomChat
  }
}
