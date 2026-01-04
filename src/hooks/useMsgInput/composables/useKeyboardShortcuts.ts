import { ref, onMounted, onUnmounted } from 'vue'
import { isMac, isWindows } from '@/utils/PlatformConstants'
import { useCursorManager } from './useCursorManager'
import type { Ref } from 'vue'

interface UseKeyboardShortcutsOptions {
  messageInputDom: Ref<HTMLElement | null>
  inputText: Ref<string>
  onSend?: () => void
  onNewLine?: () => void
  onClearInput?: () => void
  onSelectEmoji?: () => void
  onSelectAt?: () => void
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions) {
  const { messageInputDom, inputText, onSend, onNewLine, onClearInput, onSelectEmoji, onSelectAt } = options

  const { focusOn } = useCursorManager()

  // 快捷键状态
  const isCtrlPressed = ref(false)
  const isShiftPressed = ref(false)
  const isAltPressed = ref(false)
  const isMetaPressed = ref(false) // Mac Cmd key

  /**
   * 更新修饰键状态
   */
  const updateModifierKeys = (event: KeyboardEvent) => {
    isCtrlPressed.value = event.ctrlKey
    isShiftPressed.value = event.shiftKey
    isAltPressed.value = event.altKey
    isMetaPressed.value = event.metaKey
  }

  /**
   * 获取主修饰键（Mac 上是 Cmd，Windows/Linux 上是 Ctrl）
   */
  const getMainModifierKey = (): boolean => {
    return isMac() ? isMetaPressed.value : isCtrlPressed.value
  }

  /**
   * 处理键盘事件
   */
  const handleKeydown = (event: KeyboardEvent) => {
    updateModifierKeys(event)

    // 如果焦点不在输入框内，忽略某些快捷键
    if (messageInputDom.value && !messageInputDom.value.contains(event.target as Node)) {
      // 只处理全局快捷键
      handleGlobalShortcuts(event)
      return
    }

    // 处理输入框快捷键
    handleInputShortcuts(event)
  }

  /**
   * 处理输入框内的快捷键
   */
  const handleInputShortcuts = (event: KeyboardEvent) => {
    const hasMainModifier = getMainModifierKey()
    const hasShift = isShiftPressed.value

    // Enter 发送消息
    if (event.key === 'Enter' && !hasShift) {
      event.preventDefault()
      if (inputText.value.trim()) {
        onSend?.()
      }
      return
    }

    // Shift + Enter 换行
    if (event.key === 'Enter' && hasShift) {
      event.preventDefault()
      onNewLine?.()
      return
    }

    // Ctrl/Cmd + Enter 发送消息（Windows 风格）
    if (event.key === 'Enter' && hasMainModifier && isWindows()) {
      event.preventDefault()
      if (inputText.value.trim()) {
        onSend?.()
      }
      return
    }

    // Ctrl/Cmd + K 清空输入
    if (event.key === 'k' && hasMainModifier) {
      event.preventDefault()
      onClearInput?.()
      return
    }

    // Ctrl/Cmd + E 选择表情
    if (event.key === 'e' && hasMainModifier) {
      event.preventDefault()
      onSelectEmoji?.()
      return
    }

    // Ctrl/Cmd + Shift + A 选择 @
    if (event.key === 'a' && hasMainModifier && hasShift) {
      event.preventDefault()
      onSelectAt?.()
      return
    }

    // Esc 聚焦到输入框
    if (event.key === 'Escape' && !messageInputDom.value?.contains(document.activeElement)) {
      event.preventDefault()
      focusOn(messageInputDom.value!)
      return
    }

    // Ctrl/Cmd + Z 撤销（由浏览器处理）
    // Ctrl/Cmd + Y 重做（由浏览器处理）
  }

  /**
   * 处理全局快捷键
   */
  const handleGlobalShortcuts = (event: KeyboardEvent) => {
    // Ctrl/Cmd + / 聚焦到输入框
    if (event.key === '/' && getMainModifierKey()) {
      event.preventDefault()
      focusOn(messageInputDom.value!)
      return
    }
  }

  /**
   * 处理键盘释放事件
   */
  const handleKeyup = (event: KeyboardEvent) => {
    updateModifierKeys(event)
  }

  /**
   * 处理焦点失去事件
   */
  const handleBlur = () => {
    // 重置修饰键状态
    isCtrlPressed.value = false
    isShiftPressed.value = false
    isAltPressed.value = false
    isMetaPressed.value = false
  }

  /**
   * 监听 Mitt 事件（暂未使用）
   */
  // const handleMittEvent = (event: unknown) => {
  //   if (event.type === 'FOCUS_INPUT' && messageInputDom.value) {
  //     focusOn(messageInputDom.value)
  //   }
  // }

  /**
   * 初始化事件监听
   */
  onMounted(() => {
    document.addEventListener('keydown', handleKeydown)
    document.addEventListener('keyup', handleKeyup)
    window.addEventListener('blur', handleBlur)

    // 监听 Mitt 事件（暂未使用）
    // mitt.on('FOCUS_INPUT', handleMittEvent)
  })

  /**
   * 清理事件监听
   */
  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown)
    document.removeEventListener('keyup', handleKeyup)
    window.removeEventListener('blur', handleBlur)

    // 移除 Mitt 事件监听会在 useMitt hook 中自动处理
  })

  /**
   * 获取快捷键提示文本
   */
  const getShortcutText = (action: string): string => {
    const modifier = isMac() ? 'Cmd' : 'Ctrl'

    switch (action) {
      case 'send':
        return isMac() ? 'Cmd + Enter' : 'Ctrl + Enter'
      case 'newline':
        return 'Shift + Enter'
      case 'clear':
        return `${modifier} + K`
      case 'emoji':
        return `${modifier} + E`
      case 'focus':
        return `Esc / ${modifier} + /`
      default:
        return ''
    }
  }

  return {
    // 状态
    isCtrlPressed,
    isShiftPressed,
    isAltPressed,
    isMetaPressed,

    // 方法
    getMainModifierKey,
    getShortcutText
  }
}
