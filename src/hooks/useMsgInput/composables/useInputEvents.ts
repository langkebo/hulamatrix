import { ref, computed, watchEffect, nextTick } from 'vue'
import { useGlobalStore } from '@/stores/global'
import { useGroupStore } from '@/stores/group'
import { useSettingStore } from '@/stores/setting'
import { useUserStore } from '@/stores/user'
import type { Ref, ComputedRef } from 'vue'
import type { UserItem } from '@/services/types'
import type { EditorRange } from '../types'
import { logger } from '@/utils/logger'
import DOMPurify from 'dompurify'
import { isWindows } from '@/utils/PlatformConstants'
import { useDirectSend } from './useDirectSend'
import { MsgEnum } from '@/enums'

/**
 * 输入事件处理 Composable
 */
export function useInputEvents(
  messageInputDom: Ref<HTMLElement | null | undefined>,
  msgInput: Ref<string>,
  ait: Ref<boolean>,
  _editorRange: Ref<EditorRange | null>,
  resetAllStates: () => void,
  _insertNode: (type: MsgEnum, data: unknown, element: HTMLElement) => void,
  handleAit: (item: UserItem) => void
) {
  const globalStore = useGlobalStore()
  const groupStore = useGroupStore()
  const settingStore = useSettingStore()
  const userStore = useUserStore()

  const isChinese = ref(false)
  const lastComposing = ref(false)
  const chatKey = ref('')

  // 计算属性：发送按钮是否禁用
  const disabledSend: ComputedRef<boolean> = computed(() => {
    const text = msgInput.value?.trim() || messageInputDom.value?.innerHTML?.trim() || ''
    return !text
  })

  // 监听输入框变化
  const handleInput = (e: Event) => {
    const target = e.target as HTMLElement
    msgInput.value = target.innerHTML || ''
    chatKey.value = Date.now().toString()

    // 检查@提及
    const textContent = target.textContent || ''
    const lastChar = textContent[textContent.length - 1]

    if (lastChar === '@' && !ait.value) {
      ait.value = true
      nextTick(() => {
        // 滚动到第一个用户
        const firstUser = document.querySelector('.ait-item:first-child')
        if (firstUser) {
          ;(firstUser as HTMLElement).scrollIntoView({ block: 'nearest' })
        }
      })
    }

    // 保存草稿
    const draftKey = `draft_${globalStore.currentSessionRoomId}`
    localStorage.setItem(
      draftKey,
      JSON.stringify({
        content: msgInput.value,
        timestamp: Date.now()
      })
    )
  }

  // 键盘事件处理
  const inputKeyDown = (e: KeyboardEvent) => {
    const isEnterKey = e.key === 'Enter'
    const isCtrlOrMetaKey = e.ctrlKey || e.metaKey
    const sendKeySetting = (settingStore.chat?.sendKey || 'Enter').toLowerCase()
    const sendKeyIsEnter = sendKeySetting === 'enter'
    const sendKeyIsCtrlEnter = sendKeySetting === 'ctrl+enter'

    // 处理输入法组合键
    if (isWindows() && e.keyCode === 229) {
      e.preventDefault()
      return
    }
    if (!isWindows() && e.ctrlKey && isEnterKey && sendKeyIsEnter) {
      e?.preventDefault()
      return
    }

    // 发送消息
    if ((sendKeyIsEnter && isEnterKey && !isCtrlOrMetaKey) || (sendKeyIsCtrlEnter && isCtrlOrMetaKey && isEnterKey)) {
      e?.preventDefault()
      const form = document.getElementById('message-form') as HTMLFormElement
      if (form) {
        form.requestSubmit()
      }
      resetAllStates()
    }

    // 处理@提及键盘导航
    if (ait.value) {
      handleAitKeyNavigation(e)
    }
  }

  // @提及键盘导航
  const handleAitKeyNavigation = (e: KeyboardEvent) => {
    const items = document.querySelectorAll('.ait-item')
    const currentIndex = Array.from(items).findIndex((item) => item.classList.contains('selected'))

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault()
        if (currentIndex > 0) {
          items[currentIndex]?.classList.remove('selected')
          items[currentIndex - 1]?.classList.add('selected')
          ;(items[currentIndex - 1] as HTMLElement).scrollIntoView({ block: 'nearest' })
        }
        break

      case 'ArrowDown':
        e.preventDefault()
        if (currentIndex < items.length - 1) {
          items[currentIndex]?.classList.remove('selected')
          items[currentIndex + 1]?.classList.add('selected')
          ;(items[currentIndex + 1] as HTMLElement).scrollIntoView({ block: 'nearest' })
        }
        break

      case 'Enter':
        e.preventDefault()
        if (currentIndex >= 0 && items[currentIndex]) {
          const uid = items[currentIndex].getAttribute('data-uid')
          if (uid) {
            const user = groupStore.userList.find((u) => u.uid === uid)
            if (user) {
              handleAit(user)
            }
          }
        }
        break

      case 'Escape':
        e.preventDefault()
        ait.value = false
        break
    }
  }

  // 处理粘贴事件
  const handlePaste = (e: ClipboardEvent) => {
    e.preventDefault()
    const items = e.clipboardData?.items
    if (!items) return

    const files: File[] = []

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (!item) continue

      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file) {
          files.push(file)
        }
      } else if (item.kind === 'string' && item.type === 'text/plain') {
        item.getAsString((text) => {
          document.execCommand('insertText', false, text)
        })
      }
    }

    // 如果有文件，触发文件上传
    if (files.length > 0) {
      ;(async () => {
        await useDirectSend().sendFilesDirect(files)
      })()
    }
  }

  // 处理拖拽事件
  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer?.files || [])

    if (files.length > 0) {
      ;(async () => {
        await useDirectSend().sendFilesDirect(files)
      })()
    }
  }

  // 处理拖拽悬停
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
  }

  // 组合输入开始
  const handleCompositionStart = () => {
    isChinese.value = true
    lastComposing.value = true
  }

  // 组合输入结束
  const handleCompositionEnd = (e: CompositionEvent) => {
    isChinese.value = false
    lastComposing.value = false

    // 触发输入事件
    const inputEvent = new InputEvent('input', {
      data: e.data,
      bubbles: true
    })
    messageInputDom.value?.dispatchEvent(inputEvent)
  }

  // 处理@符号输入
  const handleAtSymbolInput = () => {
    if (!groupStore.userList || groupStore.userList.length === 0) return

    // 显示@提及面板
    ait.value = true

    // 过滤用户列表
    groupStore.userList.filter((user) => {
      // 过滤掉自己
      if (user.uid === userStore.userInfo?.uid) return false
      // 过滤掉机器人
      if (user.roleId && user.roleId >= 100) return false
      return true
    })
  }

  // 监听房间变化，加载草稿
  watchEffect(() => {
    const roomId = globalStore.currentSessionRoomId
    if (roomId) {
      const draftKey = `draft_${roomId}`
      const draftData = localStorage.getItem(draftKey)

      if (draftData) {
        try {
          const draft = JSON.parse(draftData)
          // 检查草稿是否过期（24小时）
          if (Date.now() - draft.timestamp < 24 * 60 * 60 * 1000) {
            msgInput.value = draft.content
            if (messageInputDom.value) {
              messageInputDom.value.innerHTML = DOMPurify.sanitize(draft.content)
            }
          } else {
            localStorage.removeItem(draftKey)
          }
        } catch (error) {
          logger.error('解析草稿失败:', error)
          localStorage.removeItem(draftKey)
        }
      }
    }
  })

  return {
    // 状态
    isChinese,
    lastComposing,
    chatKey,
    disabledSend,

    // 事件处理方法
    handleInput,
    inputKeyDown,
    handlePaste,
    handleDrop,
    handleDragOver,
    handleCompositionStart,
    handleCompositionEnd,
    handleAtSymbolInput
  }
}
