import type { SelectionRange } from '../../useCommon'

/**
 * 光标管理器
 */
export function useCursorManager() {
  /**
   * 记录当前光标范围
   */
  let cursorSelectionRange: SelectionRange | null = null

  /**
   * 记录当前编辑器的选取范围
   */
  const updateSelectionRange = (sr: SelectionRange | null) => {
    cursorSelectionRange = sr
  }

  const getCursorSelectionRange = () => {
    return cursorSelectionRange
  }

  /**
   * 聚焦指定的编辑器元素
   * @param editor 可聚焦的编辑器元素
   */
  const focusOn = (editor: HTMLElement) => {
    if (!editor) return
    editor.focus()
  }

  /**
   * 获取当前光标位置
   */
  const getCursorPosition = (_element: HTMLElement): number => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return 0

    const range = selection.getRangeAt(0)
    const preCaretRange = range.cloneRange()
    // 使用当前活动的元素
    const activeElement = document.activeElement as HTMLElement
    if (activeElement) {
      preCaretRange.selectNodeContents(activeElement)
    }
    preCaretRange.setEnd(range.endContainer, range.endOffset)

    return preCaretRange.toString().length
  }

  /**
   * 设置光标位置
   */
  const setCursorPosition = (element: HTMLElement, position: number): void => {
    const range = document.createRange()
    const selection = window.getSelection()

    if (!selection || !element.childNodes.length) return

    let charCount = 0
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)

    let node: Node | null = null
    while ((node = walker.nextNode())) {
      const nodeLength = node.textContent?.length || 0
      if (charCount + nodeLength >= position) {
        range.setStart(node, position - charCount)
        range.collapse(true)
        selection.removeAllRanges()
        selection.addRange(range)
        break
      }
      charCount += nodeLength
    }
  }

  /**
   * 在光标位置插入文本
   */
  const insertTextAtCursor = (_element: HTMLElement, text: string): void => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    range.deleteContents()

    const textNode = document.createTextNode(text)
    range.insertNode(textNode)
    range.collapse(false)

    selection.removeAllRanges()
    selection.addRange(range)
  }

  return {
    updateSelectionRange,
    getCursorSelectionRange,
    focusOn,
    getCursorPosition,
    setCursorPosition,
    insertTextAtCursor
  }
}
