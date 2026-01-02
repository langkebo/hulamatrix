import DOMPurify from 'dompurify'
import { MsgEnum } from '@/enums'
import { parseHtmlSafely, stripHtml } from '../utils'
import type { Ref } from 'vue'
import type { EditorRange } from '../types'

/** Node data for different message types */
type NodeData =
  | { name: string; uid: string } // AIT mention
  | { url: string; name?: string } // EMOJI
  | string // Text
  | unknown // Fallback for other types

/**
 * 输入工具函数 Composable
 */
export function useInputUtils(messageInputDom: Ref<HTMLElement | null>, editorRange: Ref<EditorRange | null>) {
  /**
   * 获取光标位置的范围信息
   */
  const getCursorSelectionRange = (): EditorRange | null => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return null

    const range = selection.getRangeAt(0)
    const startContainer = range.startContainer
    const endContainer = range.endContainer

    // 检查是否在输入框内
    const isInInput = messageInputDom.value?.contains(startContainer) && messageInputDom.value?.contains(endContainer)

    if (!isInInput) return null

    return {
      range,
      selection
    }
  }

  /**
   * 更新选择范围
   */
  const updateSelectionRange = () => {
    const range = getCursorSelectionRange()
    if (range) {
      editorRange.value = range
    }
  }

  /**
   * 聚焦输入框
   */
  const focusOn = (editor: HTMLElement) => {
    // 使用 requestAnimationFrame 确保 DOM 更新后再聚焦
    requestAnimationFrame(() => {
      // 获取选择
      const selection = window.getSelection()
      if (!selection) return

      // 创建范围
      const range = document.createRange()

      // 获取最后一个子节点
      const lastChild = editor.lastChild
      if (lastChild) {
        // 如果是文本节点，设置到文本末尾
        if (lastChild.nodeType === Node.TEXT_NODE) {
          range.setStart(lastChild, lastChild.textContent?.length || 0)
          range.collapse(true)
        } else {
          // 如果是元素节点，设置到元素之后
          range.setStartAfter(lastChild)
          range.collapse(true)
        }

        // 应用选择
        selection.removeAllRanges()
        selection.addRange(range)
      }

      // 聚焦元素
      editor.focus()
    })
  }

  /**
   * 插入节点到光标位置
   */
  const insertNode = (type: MsgEnum, data: NodeData, _element: HTMLElement) => {
    const selection = window.getSelection()
    if (!selection) return

    const range = selection.getRangeAt(0)
    const node = createNode(type, data)

    if (node) {
      // 插入节点
      range.insertNode(node)

      // 插入空格
      const spaceNode = document.createTextNode(' ')
      range.insertNode(spaceNode)

      // 移动光标到插入位置之后
      range.setStartAfter(spaceNode)
      range.collapse(true)

      // 更新选择
      selection.removeAllRanges()
      selection.addRange(range)
    }
  }

  /**
   * 创建不同类型的节点
   */
  const createNode = (type: MsgEnum, data: NodeData): Node | null => {
    switch (type) {
      case MsgEnum.AIT:
        return createMentionNode(data as { name: string; uid: string })

      case MsgEnum.EMOJI:
        return createEmojiNode(data as { url: string; name?: string })

      default:
        return createTextNode(String(data))
    }
  }

  /**
   * 创建@提及节点
   */
  const createMentionNode = (data: { name: string; uid: string }): HTMLElement => {
    const span = document.createElement('span')
    span.id = 'aitSpan'
    span.className = 'ait-user'
    span.contentEditable = 'false'
    span.dataset.aitUid = data.uid
    span.innerHTML = DOMPurify.sanitize(`<span class="ait-text">@${data.name}</span>`)
    return span
  }

  /**
   * 创建表情节点
   */
  const createEmojiNode = (data: { url: string; name?: string }): HTMLElement => {
    const img = document.createElement('img')
    img.src = data.url
    img.alt = data.name || ''
    img.className = 'msg-emoji'
    img.contentEditable = 'false'
    img.draggable = false
    img.style.width = '20px'
    img.style.height = '20px'
    img.style.verticalAlign = 'middle'
    return img
  }

  /**
   * 创建文本节点
   */
  const createTextNode = (data: string): Text => {
    return document.createTextNode(data)
  }

  /**
   * 重置输入框
   */
  const resetInput = () => {
    if (messageInputDom.value) {
      messageInputDom.value.innerHTML = DOMPurify.sanitize('')
      messageInputDom.value.focus()
    }
  }

  /**
   * 获取纯文本内容
   */
  const getPlainText = (): string => {
    if (!messageInputDom.value) return ''
    return messageInputDom.value.textContent || ''
  }

  /**
   * 获取HTML内容
   */
  const getHTMLContent = (): string => {
    if (!messageInputDom.value) return ''
    return messageInputDom.value.innerHTML || ''
  }

  /**
   * 设置HTML内容
   */
  const setHTMLContent = (html: string) => {
    if (messageInputDom.value) {
      messageInputDom.value.innerHTML = DOMPurify.sanitize(html)
    }
  }

  /**
   * 插入文本
   */
  const insertText = (text: string) => {
    const selection = window.getSelection()
    if (!selection) return

    const range = selection.getRangeAt(0)
    const textNode = document.createTextNode(text)

    range.insertNode(textNode)
    range.setStartAfter(textNode)
    range.collapse(true)

    selection.removeAllRanges()
    selection.addRange(range)
  }

  /**
   * 插入HTML
   */
  const insertHTML = (html: string) => {
    const selection = window.getSelection()
    if (!selection) return

    const range = selection.getRangeAt(0)
    const fragment = parseHtmlSafely(html)

    range.insertNode(fragment)
    range.collapse(false)

    selection.removeAllRanges()
    selection.addRange(range)
  }

  /**
   * 删除选中的内容
   */
  const deleteSelected = () => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) return

    const range = selection.getRangeAt(0)
    range.deleteContents()
  }

  /**
   * 全选内容
   */
  const selectAll = () => {
    if (!messageInputDom.value) return

    const range = document.createRange()
    range.selectNodeContents(messageInputDom.value)

    const selection = window.getSelection()
    if (selection) {
      selection.removeAllRanges()
      selection.addRange(range)
    }
  }

  /**
   * 获取选中内容的文本
   */
  const getSelectedText = (): string => {
    const selection = window.getSelection()
    return selection?.toString() || ''
  }

  /**
   * 检查输入框是否为空
   */
  const isEmpty = (): boolean => {
    const text = getPlainText().trim()
    const html = getHTMLContent()
    return !text && (!html || html === '<br>')
  }

  /**
   * 获取输入框的高度
   */
  const getHeight = (): number => {
    return messageInputDom.value?.scrollHeight || 0
  }

  /**
   * 设置输入框的高度
   */
  const setHeight = (height: number) => {
    if (messageInputDom.value) {
      messageInputDom.value.style.height = `${height}px`
    }
  }

  /**
   * 自动调整高度
   */
  const autoResize = (maxHeight: number = 120) => {
    if (!messageInputDom.value) return

    // 重置高度
    messageInputDom.value.style.height = 'auto'

    // 获取新的高度
    const newHeight = messageInputDom.value.scrollHeight

    // 限制最大高度
    if (newHeight <= maxHeight) {
      messageInputDom.value.style.height = `${newHeight}px`
    } else {
      messageInputDom.value.style.height = `${maxHeight}px`
      messageInputDom.value.style.overflowY = 'auto'
    }
  }

  /**
   * 滚动到底部
   */
  const scrollToBottom = () => {
    if (messageInputDom.value) {
      messageInputDom.value.scrollTop = messageInputDom.value.scrollHeight
    }
  }

  /**
   * 检查是否可以撤销
   */
  const canUndo = (): boolean => {
    return document.queryCommandState('undo')
  }

  /**
   * 检查是否可以重做
   */
  const canRedo = (): boolean => {
    return document.queryCommandState('redo')
  }

  /**
   * 执行撤销
   */
  const undo = () => {
    if (canUndo()) {
      document.execCommand('undo')
    }
  }

  /**
   * 执行重做
   */
  const redo = () => {
    if (canRedo()) {
      document.execCommand('redo')
    }
  }

  return {
    // 基础工具
    stripHtml,
    parseHtmlSafely,

    // 选择范围相关
    getCursorSelectionRange,
    updateSelectionRange,

    // 焦焦和编辑
    focusOn,
    insertNode,
    createNode,
    resetInput,

    // 内容操作
    getPlainText,
    getHTMLContent,
    setHTMLContent,
    insertText,
    insertHTML,
    deleteSelected,
    selectAll,
    getSelectedText,
    isEmpty,

    // 样式和布局
    getHeight,
    setHeight,
    autoResize,
    scrollToBottom,

    // 历史操作
    canUndo,
    canRedo,
    undo,
    redo
  }
}
