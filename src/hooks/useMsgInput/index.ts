import { ref, computed, nextTick, watch } from 'vue'
import { useMessageSender } from './composables/useMessageSender'
import { useUpload } from '@/hooks/useUpload'
import { useGlobalStore } from '@/stores/global'
import { useMitt } from '@/hooks/useMitt'
import { logger } from '@/utils/logger'
import type { ReplyMessage } from './types'
import type { UserItem } from '@/services/types'

export default function useMsgInput(messageInputDom?: Ref<HTMLElement | null>) {
  const msgInput = ref('')
  const disabledSend = ref(false)
  const chatKey = ref('enter')
  const ait = ref(false)
  const reply = ref<ReplyMessage | null>(null)
  const personList = ref<UserItem[]>([])

  const globalStore = useGlobalStore()

  // 创建上传hook实例
  const uploadHook = useUpload()

  // 使用消息发送器
  const messageSender = useMessageSender(messageInputDom || ref(null), uploadHook)

  // 计算属性：是否可以发送
  const canSend = computed(() => {
    const hasContent = (messageInputDom?.value?.innerHTML?.trim().length ?? 0) > 0
    const isNotDisabled = !disabledSend.value
    const hasCurrentRoom = !!globalStore.currentSessionRoomId
    return hasContent && isNotDisabled && hasCurrentRoom
  })

  // 发送消息 - 使用实际的发送实现
  const send = async () => {
    if (!canSend.value) {
      logger.warn('[useMsgInput] 无法发送消息：未满足发送条件')
      return
    }

    try {
      disabledSend.value = true
      await messageSender.send()

      // 触发消息发送事件
      useMitt.emit('SEND_MESSAGE', {
        roomId: globalStore.currentSessionRoomId,
        timestamp: Date.now()
      })
    } catch (error) {
      logger.error('[useMsgInput] 发送消息失败:', error)
    } finally {
      disabledSend.value = false
    }
  }

  // 发送文件
  const sendFilesDirect = async (files: File[]) => {
    try {
      disabledSend.value = true

      const roomId = globalStore.currentSessionRoomId
      if (!roomId) {
        logger.warn('[useMsgInput] 无法发送文件：未选择房间')
        return
      }

      // 使用 unifiedMessageService 发送文件
      const { unifiedMessageService } = await import('@/services/unified-message-service')

      for (const file of files) {
        await unifiedMessageService.sendMessage({
          roomId,
          type: 4, // MsgEnum.FILE
          body: { file }
        })
      }

      logger.info('[useMsgInput] 发送文件成功:', { count: files.length, roomId })
    } catch (error) {
      logger.error('[useMsgInput] 发送文件失败:', error)
    } finally {
      disabledSend.value = false
    }
  }

  // 发送语音
  const sendVoiceDirect = async (voiceData: { url: string; duration: number }) => {
    try {
      disabledSend.value = true

      const roomId = globalStore.currentSessionRoomId
      if (!roomId) {
        logger.warn('[useMsgInput] 无法发送语音：未选择房间')
        return
      }

      // 使用 unifiedMessageService 发送语音
      const { unifiedMessageService } = await import('@/services/unified-message-service')
      await unifiedMessageService.sendMessage({
        roomId,
        type: 3, // MsgEnum.VOICE
        body: {
          content: voiceData.url,
          duration: voiceData.duration
        }
      })

      logger.info('[useMsgInput] 发送语音成功:', { duration: voiceData.duration, roomId })
    } catch (error) {
      logger.error('[useMsgInput] 发送语音失败:', error)
    } finally {
      disabledSend.value = false
    }
  }

  // 发送位置
  const sendLocationDirect = async (location: { lat: number; lng: number; address: string }) => {
    try {
      disabledSend.value = true

      const roomId = globalStore.currentSessionRoomId
      if (!roomId) {
        logger.warn('[useMsgInput] 无法发送位置：未选择房间')
        return
      }

      // 使用 unifiedMessageService 发送位置消息
      const { unifiedMessageService } = await import('@/services/unified-message-service')
      await unifiedMessageService.sendLocationMessage(roomId, {
        latitude: location.lat,
        longitude: location.lng,
        description: location.address
      })

      logger.info('[useMsgInput] 发送位置成功:', { address: location.address, roomId })
    } catch (error) {
      logger.error('[useMsgInput] 发送位置失败:', error)
    } finally {
      disabledSend.value = false
    }
  }

  // 发送表情 (贴图)
  const sendEmojiDirect = async (emojiUrl: string) => {
    try {
      disabledSend.value = true

      const roomId = globalStore.currentSessionRoomId
      if (!roomId) {
        logger.warn('[useMsgInput] 无法发送表情：未选择房间')
        return
      }

      // 使用 unifiedMessageService 发送表情/贴图
      const { unifiedMessageService } = await import('@/services/unified-message-service')
      await unifiedMessageService.sendMessage({
        roomId,
        type: 0, // MsgEnum.TEXT (表情作为图片消息发送)
        body: {
          content: emojiUrl,
          msgtype: 'm.emote' // Matrix 表情消息类型
        }
      })

      logger.info('[useMsgInput] 发送表情成功:', { emojiUrl, roomId })
    } catch (error) {
      logger.error('[useMsgInput] 发送表情失败:', error)
    } finally {
      disabledSend.value = false
    }
  }

  // 处理输入
  const handleInput = async () => {
    if (!messageInputDom?.value) return

    // 更新草稿
    const roomId = globalStore.currentSessionRoomId
    if (roomId) {
      const content = messageInputDom.value.innerHTML
      const draftKey = `draft_${roomId}`
      if (content && content.trim()) {
        localStorage.setItem(draftKey, content)
      } else {
        localStorage.removeItem(draftKey)
      }
    }

    // 处理@提及
    await handleAtMention()
  }

  // 处理键盘事件
  const inputKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      if (chatKey.value === 'enter') {
        event.preventDefault()
        send()
      }
    }
  }

  // 处理@提及
  const handleAit = () => {
    ait.value = !ait.value
    if (ait.value) {
      // 显示@用户选择面板
      logger.info('[useMsgInput] 显示@用户面板')
    }
  }

  // 清理HTML标签
  const stripHtml = (html: string): string => {
    const div = document.createElement('div')
    div.innerHTML = html
    return div.textContent || div.innerText || ''
  }

  // 重置输入框
  const resetInput = () => {
    msgInput.value = ''
    reply.value = null
    if (messageInputDom?.value) {
      messageInputDom.value.innerHTML = ''
      messageInputDom.value.focus()
    }
  }

  // 聚焦输入框
  const focusOn = async () => {
    if (messageInputDom?.value) {
      await nextTick()
      messageInputDom.value.focus()
    }
  }

  // 获取光标选择范围
  const getCursorSelectionRange = () => {
    if (!messageInputDom?.value) return { start: 0, end: 0 }

    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const preSelectionRange = range.cloneRange()
      preSelectionRange.selectNodeContents(messageInputDom.value)
      preSelectionRange.setEnd(range.startContainer, range.startOffset)
      const start = preSelectionRange.toString().length

      return { start, end: start + range.toString().length }
    }

    return { start: 0, end: 0 }
  }

  // 更新选择范围
  const updateSelectionRange = (start: number, end: number) => {
    if (!messageInputDom?.value) return

    const textNode = messageInputDom.value.firstChild
    if (textNode && textNode.nodeType === Node.TEXT_NODE) {
      const text = textNode.textContent || ''
      const range = document.createRange()
      range.setStart(textNode, Math.min(start, text.length))
      range.setEnd(textNode, Math.min(end, text.length))

      const selection = window.getSelection()
      if (selection) {
        selection.removeAllRanges()
        selection.addRange(range)
      }
    }
  }

  // 提取@用户ID
  const extractAtUserIds = () => {
    if (!messageInputDom?.value) return []
    return messageSender.extractAtUserIds(messageInputDom.value.innerHTML || '', personList.value)
  }

  // 处理@提及逻辑
  const handleAtMention = async () => {
    if (!messageInputDom?.value) return

    const selection = window.getSelection()
    if (!selection || !selection.rangeCount) return

    const _range = selection.getRangeAt(0)
    const textContent = messageInputDom.value.innerText || ''

    // 查找光标位置
    const cursorPosition = getCursorSelectionRange().end

    // 查找光标前的 @ 符号和用户名
    const beforeCursor = textContent.substring(0, cursorPosition)
    const atMatch = beforeCursor.match(/@(\w*)$/)

    if (atMatch) {
      const searchQuery = atMatch[1].toLowerCase()

      // 过滤匹配的用户
      const matchedUsers = personList.value.filter((user) => user.name?.toLowerCase().includes(searchQuery))

      if (matchedUsers.length > 0) {
        // 触发显示用户选择面板的事件
        useMitt.emit('SHOW_AT_USER_PANEL', {
          users: matchedUsers,
          query: searchQuery,
          position: { start: cursorPosition - atMatch[0].length, end: cursorPosition }
        })

        logger.info('[useMsgInput] 显示@用户自动完成面板', { count: matchedUsers.length, query: searchQuery })
      }
    }
  }

  // 插入@用户提及
  const insertAtUser = (user: UserItem) => {
    if (!messageInputDom?.value) return

    const selection = window.getSelection()
    if (!selection || !selection.rangeCount) return

    const range = selection.getRangeAt(0)
    const textContent = messageInputDom.value.innerText || ''

    // 找到并替换 @ 符号和部分用户名
    const cursorPosition = getCursorSelectionRange().end
    const beforeCursor = textContent.substring(0, cursorPosition)
    const atMatch = beforeCursor.match(/@(\w*)$/)

    if (atMatch) {
      const startPosition = cursorPosition - atMatch[0].length

      // 创建 @mention 元素
      const mentionSpan = document.createElement('span')
      mentionSpan.contentEditable = 'false'
      mentionSpan.id = 'aitSpan'
      mentionSpan.dataset.aitUid = user.uid
      mentionSpan.className = 'at-mention'
      mentionSpan.textContent = `@${user.name}`
      mentionSpan.style.cssText = 'color: var(--hula-brand-primary); font-weight: 500;'

      // 替换文本
      const textNode = range.startContainer
      if (textNode.nodeType === Node.TEXT_NODE) {
        const _text = textNode.textContent || ''
        range.setStart(textNode, startPosition)
        range.setEnd(textNode, cursorPosition)
        range.deleteContents()
        range.insertNode(mentionSpan)

        // 在提及后插入一个空格
        const space = document.createTextNode('\u00A0')
        mentionSpan.after(space)

        // 移动光标到空格后
        const newRange = document.createRange()
        newRange.setStartAfter(space)
        newRange.collapse(true)
        selection.removeAllRanges()
        selection.addRange(newRange)
      }

      logger.info('[useMsgInput] 插入@提及用户', { user: user.name, uid: user.uid })
    }
  }

  // 恢复草稿
  const restoreDraft = () => {
    const roomId = globalStore.currentSessionRoomId
    if (roomId && messageInputDom?.value) {
      const draftKey = `draft_${roomId}`
      const draft = localStorage.getItem(draftKey)
      if (draft) {
        messageInputDom.value.innerHTML = draft
        msgInput.value = stripHtml(draft)
      }
    }
  }

  // 监听房间变化，恢复草稿
  const stopWatch = watch(
    () => globalStore.currentSessionRoomId,
    () => {
      restoreDraft()
    }
  )

  return {
    msgInput,
    disabledSend,
    chatKey,
    ait,
    reply,
    personList,
    canSend,
    send,
    sendFilesDirect,
    sendVoiceDirect,
    sendLocationDirect,
    sendEmojiDirect,
    handleInput,
    inputKeyDown,
    handleAit,
    handleAtMention,
    insertAtUser,
    stripHtml,
    resetInput,
    focusOn,
    getCursorSelectionRange,
    updateSelectionRange,
    extractAtUserIds,
    restoreDraft,
    // 清理函数
    cleanup: () => {
      stopWatch?.()
    }
  }
}
