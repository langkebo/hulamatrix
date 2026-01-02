import { describe, it, expect, beforeEach } from 'vitest'
import { useCursorManager } from '../useMsgInput/composables/useCursorManager'
import type { SelectionRange } from '../useCommon'

describe('useCursorManager', () => {
  let cursorManager: ReturnType<typeof useCursorManager>
  let testElement: HTMLElement

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = '<div id="test" contenteditable="true">Hello World</div>'
    testElement = document.getElementById('test') as HTMLElement
    cursorManager = useCursorManager()
  })

  it('should get cursor position', () => {
    testElement.focus()

    // Set cursor at position 5
    const range = document.createRange()
    const selection = window.getSelection()!
    range.setStart(testElement.firstChild!, 5)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)

    const position = cursorManager.getCursorPosition(testElement)
    expect(position).toBe(5)
  })

  it('should set cursor position', () => {
    testElement.focus()

    cursorManager.setCursorPosition(testElement, 3)

    const position = cursorManager.getCursorPosition(testElement)
    expect(position).toBe(3)
  })

  it('should insert text at cursor', () => {
    testElement.focus()
    cursorManager.setCursorPosition(testElement, 5)

    cursorManager.insertTextAtCursor(testElement, ' Test')

    expect(testElement.textContent).toBe('Hello Test World')
  })

  it('should handle empty element', () => {
    const element = document.createElement('div')
    element.contentEditable = 'true'

    const position = cursorManager.getCursorPosition(element)
    expect(position).toBe(0)
  })

  it('should focus on element', () => {
    testElement.blur()

    cursorManager.focusOn(testElement)
    expect(document.activeElement).toBe(testElement)
  })

  it('should get cursor selection range', () => {
    testElement.focus()

    // Select 'llo Wo'
    const range = document.createRange()
    const selection = window.getSelection()!
    range.setStart(testElement.firstChild!, 2)
    range.setEnd(testElement.firstChild!, 8)
    selection.removeAllRanges()
    selection.addRange(range)

    cursorManager.updateSelectionRange({
      range,
      selection
    })

    const selectionRange = cursorManager.getCursorSelectionRange()
    expect(selectionRange?.range.toString()).toBe('llo Wo')
  })

  it('should update selection range', () => {
    testElement.focus()

    const range = document.createRange()
    const selection = window.getSelection()!
    range.setStart(testElement.firstChild!, 2)
    range.setEnd(testElement.firstChild!, 8)
    selection.removeAllRanges()
    selection.addRange(range)

    const selectionRange: SelectionRange = {
      range,
      selection
    }

    cursorManager.updateSelectionRange(selectionRange)

    const retrievedRange = cursorManager.getCursorSelectionRange()
    expect(retrievedRange).toEqual(selectionRange)
  })

  it('should handle element with no child nodes', () => {
    const element = document.createElement('div')
    element.contentEditable = 'true'

    cursorManager.setCursorPosition(element, 0)
    // Should not throw error
    expect(element.textContent).toBe('')
  })
})
