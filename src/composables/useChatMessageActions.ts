import { ref, onUnmounted, nextTick, type Ref } from 'vue'
import type { MessageType } from '@/services/types.ts'
import { MsgEnum, CallTypeEnum, MittEnum, TauriCommand } from '@/enums'
import { useWindow } from '@/hooks/useWindow'
import { useMitt } from '@/hooks/useMitt.ts'
import { useChatStore } from '@/stores/chat.ts'
import { useGlobalStore } from '@/stores/global.ts'
import { isMobile } from '@/utils/PlatformConstants'
import { invokeWithErrorHandler } from '@/utils/TauriInvokeHandler'
import { ErrorType } from '@/common/exception'
import { msg } from '@/utils/SafeUI'

// Type definitions for message bodies
interface UrlMessageBody {
  url: string
  [key: string]: unknown
}

interface TextBody {
  content: string
  [key: string]: unknown
}

type UseChatMessageActionsOptions = {
  handleCopy: (content: string, prioritizeSelection?: boolean, messageId?: string) => Promise<void>
}

type UseChatMessageActionsReturn = {
  // States
  activeBubble: Ref<string>
  delIndex: Ref<string>
  delRoomId: Ref<string>
  modalShow: Ref<boolean>
  tips: Ref<string>

  // Actions
  handleForward: (item: MessageType) => Promise<void>
  handleConfirm: () => Promise<void>
  handleMsgClick: (item: MessageType) => void
}

/**
 * Composable for managing chat message actions
 * Handles message forwarding, deletion, clicking, and active bubble state
 */
export function useChatMessageActions(options: UseChatMessageActionsOptions): UseChatMessageActionsReturn {
  const { handleCopy } = options
  const { startRtcCall } = useWindow()
  const chatStore = useChatStore()
  const globalStore = useGlobalStore()

  // States
  const activeBubble = ref('')
  const delIndex = ref('')
  const delRoomId = ref('')
  const modalShow = ref(false)
  const tips = ref('')

  /**
   * Handle forwarding a message
   */
  const handleForward = async (item: MessageType) => {
    if (!item?.message?.id) return
    const target = chatStore.chatMessageList.find((m) => m.message.id === item.message.id)
    if (!target) {
      return
    }
    chatStore.clearMsgCheck()
    target.isCheck = true
    chatStore.setMsgMultiChoose(true, 'forward')
    await nextTick()
    useMitt.emit(MittEnum.MSG_MULTI_CHOOSE, {
      action: 'open-forward',
      mergeType: 'single'
    })
  }

  /**
   * Handle delete message confirmation
   */
  const handleConfirm = async () => {
    if (!delIndex.value) return
    const targetRoomId = delRoomId.value || globalStore.currentSessionRoomId
    if (!targetRoomId) {
      msg.error('无法确定消息所属的会话')
      return
    }
    try {
      await invokeWithErrorHandler(
        TauriCommand.DELETE_MESSAGE,
        {
          messageId: delIndex.value,
          roomId: targetRoomId
        },
        {
          customErrorMessage: '删除消息失败',
          errorType: ErrorType.Client
        }
      )
      chatStore.deleteMsg(delIndex.value)
      useMitt.emit(MittEnum.UPDATE_SESSION_LAST_MSG, { roomId: targetRoomId })
      delIndex.value = ''
      delRoomId.value = ''
      modalShow.value = false
      msg.success('消息已删除')
    } catch (_error) {}
  }

  let activeKeyPressListener: ((e: KeyboardEvent) => void) | null = null

  const removeKeyPressListener = () => {
    if (activeKeyPressListener) {
      document.removeEventListener('keydown', activeKeyPressListener)
      activeKeyPressListener = null
    }
  }

  /**
   * Handle message bubble click
   * Sets active bubble and enables keyboard shortcut for copy
   */
  const handleMsgClick = (item: MessageType) => {
    if (item.message.type === MsgEnum.VIDEO_CALL) {
      startRtcCall(CallTypeEnum.VIDEO)
      return
    } else if (item.message.type === MsgEnum.AUDIO_CALL) {
      startRtcCall(CallTypeEnum.AUDIO)
      return
    }

    // Mobile doesn't trigger active effect
    if (!isMobile()) {
      if (chatStore.msgMultiChooseMode === 'forward') {
        activeBubble.value = ''
      } else {
        activeBubble.value = item.message.id
      }
    }

    // Remove possible residual listener to avoid duplicate binding
    removeKeyPressListener()

    // Enable keyboard listener
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.key === 'c') || (e.metaKey && e.key === 'c')) {
        // Prioritize copying user selected text, if none then copy entire message content
        // For images or other message types, prioritize url field
        const urlBody = item.message.body as UrlMessageBody
        const textBody = item.message.body as TextBody
        const contentToCopy = urlBody?.url || textBody?.content || ''
        handleCopy(contentToCopy, true, item.message.id)
        // Cancel keyboard event listener to avoid multiple bindings
        removeKeyPressListener()
      }
    }
    activeKeyPressListener = handleKeyPress
    // Bind keyboard event to document
    document.addEventListener('keydown', handleKeyPress)
  }

  onUnmounted(() => {
    removeKeyPressListener()
  })

  return {
    activeBubble,
    delIndex,
    delRoomId,
    modalShow,
    tips,
    handleForward,
    handleConfirm,
    handleMsgClick
  }
}
