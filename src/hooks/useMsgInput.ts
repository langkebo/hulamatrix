import { ref, onMounted, onUnmounted, type Ref } from 'vue'
import { MittEnum } from '@/enums'

import { useMitt } from '@/hooks/useMitt'
import { useUpload } from '@/hooks/useUpload'

import { useMessageSender } from './useMsgInput/composables/useMessageSender'
import { useMentionHandler } from './useMsgInput/composables/useMentionHandler'
import { useDirectSend } from './useMsgInput/composables/useDirectSend'
import { useInputEvents } from './useMsgInput/composables/useInputEvents'
import { useInputUtils } from './useMsgInput/composables/useInputUtils'

// 导入类型
import type { UseMsgInputReturn } from './useMsgInput/types'

/**
 * 消息输入 Hook - 重构后的主入口
 * 整合所有拆分后的功能模块
 */
export function useMsgInput(messageInputDom: Ref<HTMLElement | null>): UseMsgInputReturn {
  // 基础状态
  const msgInput = ref('')
  const reply = ref<{
    messageId: string
    senderId?: string
    senderName?: string
    content?: string
    [key: string]: unknown
  } | null>(null)
  const menuList = ref([])
  const editorRange = ref(null)

  // 话题相关状态
  const topicDialogVisible = ref(false)
  const topicKeyword = ref('')
  const topicList = ref([])

  // 上传 hook
  const uploadHook = useUpload()

  // 1. 消息发送模块
  const messageSender = useMessageSender(messageInputDom, uploadHook)

  // 2. @提及模块
  const mentionHandler = useMentionHandler(messageInputDom, editorRange)

  // 3. 直接发送模块（文件、语音、位置、表情）
  const directSend = useDirectSend()

  // 4. 输入工具模块
  const inputUtils = useInputUtils(messageInputDom, editorRange)

  // 5. 输入事件处理模块
  const resetAllStates = () => {
    reply.value = null
    ait.value = false
    messageInputDom.value?.focus()
  }

  const inputEvents = useInputEvents(
    messageInputDom,
    msgInput,
    mentionHandler.ait,
    editorRange,
    resetAllStates,
    inputUtils.insertNode,
    mentionHandler.handleAit
  )

  // 暴露@提及的状态
  const { ait, aitKey, selectedAitKey, personList } = mentionHandler

  // 生命周期管理
  onMounted(() => {
    // 添加事件监听
    document.addEventListener('click', handleClickOutside)
    document.addEventListener('keydown', handleGlobalKeydown)

    // 监听回复事件
    useMitt.on(MittEnum.REPLY_MEG, handleReplyMessage)
  })

  onUnmounted(() => {
    // 清理事件监听
    document.removeEventListener('click', handleClickOutside)
    document.removeEventListener('keydown', handleGlobalKeydown)

    useMitt.off(MittEnum.REPLY_MEG, handleReplyMessage)
  })

  // 事件处理函数
  const handleClickOutside = (e: MouseEvent) => {
    mentionHandler.handleClickOutside(e)
  }

  const handleGlobalKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (mentionHandler.ait.value) {
        mentionHandler.hideMentionPanel()
      }
    }
  }

  const handleReplyMessage = (message: {
    messageId: string
    senderId?: string
    senderName?: string
    content?: string
    [key: string]: unknown
  }) => {
    reply.value = message
    if (messageInputDom.value) {
      inputUtils.focusOn(messageInputDom.value)
    }
  }

  // 发送消息（整合消息发送器的发送功能）
  const send = async () => {
    await messageSender.send()
  }

  // 返回所有需要的状态和方法
  return {
    // 状态
    msgInput,
    disabledSend: inputEvents.disabledSend,
    chatKey: inputEvents.chatKey,
    ait,
    aitKey,
    selectedAitKey,
    personList,
    reply,
    menuList,
    editorRange,
    isChinese: inputEvents.isChinese,

    // 话题相关状态
    topicDialogVisible,
    topicKeyword,
    topicList,

    // 发送相关方法
    send,
    sendFilesDirect: directSend.sendFilesDirect,
    sendVoiceDirect: directSend.sendVoiceDirect as (voiceData: unknown) => Promise<void>,
    sendLocationDirect: directSend.sendLocationDirect as (locationData: unknown) => Promise<void>,
    sendEmojiDirect: directSend.sendEmojiDirect,

    // 事件处理方法
    handleInput: inputEvents.handleInput,
    inputKeyDown: inputEvents.inputKeyDown,
    handleAit: mentionHandler.handleAit,

    // 工具方法
    stripHtml: inputUtils.stripHtml,
    resetInput: inputUtils.resetInput,
    focusOn: inputUtils.focusOn,
    getCursorSelectionRange: inputUtils.getCursorSelectionRange,
    updateSelectionRange: inputUtils.updateSelectionRange,
    extractAtUserIds: messageSender.extractAtUserIds
  }
}

// 导出默认
export default useMsgInput
