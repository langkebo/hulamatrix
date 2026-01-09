import { ref, type Ref } from 'vue'
import type { MatrixMember } from '@/types/matrix'

export interface FormatRange {
  start: number
  end: number
  type: 'bold' | 'italic' | 'strike'
}

export interface CommandSuggestion {
  name: string
  description: string
  action: () => void
}

interface UseMessageEditorOptions {
  maxLength?: number
  members?: () => MatrixMember[]
  commands?: CommandSuggestion[]
}

interface UseMessageEditorReturn {
  // States
  formatBold: Ref<boolean>
  formatItalic: Ref<boolean>
  formatStrike: Ref<boolean>
  formatRanges: Ref<FormatRange[]>
  mentionSuggestions: Ref<MatrixMember[]>
  activeMentionIndex: Ref<number>
  mentionPosition: Ref<{ top: number; left: number }>
  commandSuggestions: Ref<CommandSuggestion[]>
  activeCommandIndex: Ref<number>
  commandPosition: Ref<{ top: number; left: number }>
  isComposing: Ref<boolean>

  // Actions
  handleEditorInput: (editor: HTMLElement) => void
  handleKeyDown: (e: KeyboardEvent, editor: HTMLElement, onSend: () => void) => void
  handlePaste: (e: ClipboardEvent) => Promise<void>
  handleCompositionStart: () => void
  handleCompositionEnd: () => void
  toggleFormat: (format: 'bold' | 'italic' | 'strike', editor: HTMLElement) => void
  insertText: (text: string) => void
  insertCodeBlock: () => void
  selectMention: (member: MatrixMember, editor: HTMLElement) => void
  selectCommand: (cmd: CommandSuggestion) => void
  clearEditor: (editor: HTMLElement) => void
  getMessageLength: (editor: HTMLElement) => number
  getCaretPosition: (editor: HTMLElement) => number
  generateFormattedBody: (plainText: string) => string
}

/**
 * Composable for managing message editor functionality
 * Handles text input, formatting, mentions, and commands
 */
export function useMessageEditor(options: UseMessageEditorOptions = {}): UseMessageEditorReturn {
  const { maxLength: _maxLength = 65536, members = () => [], commands = [] } = options

  // Format states
  const formatBold = ref(false)
  const formatItalic = ref(false)
  const formatStrike = ref(false)
  const formatRanges = ref<FormatRange[]>([])

  // Mention state
  const mentionSuggestions = ref<MatrixMember[]>([])
  const activeMentionIndex = ref(0)
  const mentionPosition = ref({ top: 0, left: 0 })

  // Command state
  const commandSuggestions = ref<CommandSuggestion[]>([])
  const activeCommandIndex = ref(0)
  const commandPosition = ref({ top: 0, left: 0 })

  // Composition state (for Chinese input)
  const isComposing = ref(false)

  /**
   * Get current cursor position in editor
   */
  const getCaretPosition = (editor: HTMLElement): number => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return 0

    const range = selection.getRangeAt(0)
    const preCaretRange = range.cloneRange()
    preCaretRange.selectNodeContents(editor)
    preCaretRange.setEnd(range.endContainer, range.endOffset)

    return preCaretRange.toString().length
  }

  /**
   * Set cursor position in editor
   */
  const setCaretPosition = (editor: HTMLElement, position: number) => {
    const range = document.createRange()
    const selection = window.getSelection()

    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null)

    let charCount = 0
    let found = false

    while (walker.nextNode()) {
      const node = walker.currentNode
      const text = node.textContent || ''

      if (charCount + text.length >= position) {
        range.setStart(node, position - charCount)
        range.collapse(true)
        found = true
        break
      }

      charCount += text.length
    }

    if (found && selection) {
      selection.removeAllRanges()
      selection.addRange(range)
    }
  }

  /**
   * Get message length
   */
  const getMessageLength = (editor: HTMLElement): number => {
    return editor.textContent?.length || 0
  }

  /**
   * Clear editor content and formatting
   */
  const clearEditor = (editor: HTMLElement) => {
    editor.textContent = ''
    formatRanges.value = []
    formatBold.value = false
    formatItalic.value = false
    formatStrike.value = false
  }

  /**
   * Insert text at cursor position
   */
  const insertText = (text: string) => {
    document.execCommand('insertText', false, text)
  }

  /**
   * Insert code block template
   */
  const insertCodeBlock = () => {
    insertText('\n```\n代码\n```\n')
  }

  /**
   * Show mention suggestions
   */
  const showMentionSuggestions = (query: string, editor: HTMLElement) => {
    const filtered = members()
      .filter((member: MatrixMember) =>
        (member.displayName || member.userId).toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, 5)

    mentionSuggestions.value = filtered
    activeMentionIndex.value = 0

    // Calculate position
    const rect = editor.getBoundingClientRect()
    mentionPosition.value = {
      top: rect.bottom,
      left: rect.left
    }
  }

  /**
   * Show command suggestions
   */
  const showCommandSuggestions = (query: string, editor: HTMLElement) => {
    const filtered = commands.filter((cmd) => cmd.name.toLowerCase().includes(query.toLowerCase()))

    commandSuggestions.value = filtered
    activeCommandIndex.value = 0

    // Calculate position
    const rect = editor.getBoundingClientRect()
    commandPosition.value = {
      top: rect.bottom,
      left: rect.left
    }
  }

  /**
   * Select a mention and insert it
   */
  const selectMention = (member: MatrixMember, editor: HTMLElement) => {
    const content = editor.textContent || ''
    const cursorPos = getCaretPosition(editor)
    const beforeCursor = content.substring(0, cursorPos)
    const afterCursor = content.substring(cursorPos)

    // Replace @mention with formatted text
    const mentionText = `@${member.displayName || member.userId}`
    const newContent = beforeCursor.replace(/@\w*$/, mentionText) + afterCursor

    editor.textContent = newContent
    mentionSuggestions.value = []

    // Set cursor position
    const newCursorPos = beforeCursor.replace(/@\w*$/, mentionText).length
    setCaretPosition(editor, newCursorPos)
  }

  /**
   * Select a command and execute it
   */
  const selectCommand = (cmd: CommandSuggestion) => {
    commandSuggestions.value = []
    cmd.action()
  }

  /**
   * Handle editor input
   */
  const handleEditorInput = (editor: HTMLElement) => {
    const content = editor.textContent || ''

    // Check for mentions
    const cursorPos = getCaretPosition(editor)
    const beforeCursor = content.substring(0, cursorPos)
    const mentionMatch = beforeCursor.match(/@(\w*)$/)

    if (mentionMatch) {
      const query = mentionMatch[1] ?? ''
      showMentionSuggestions(query, editor)
    } else {
      mentionSuggestions.value = []
    }

    // Check for commands
    const commandMatch = beforeCursor.match(/\/(\w*)$/)
    if (commandMatch && beforeCursor.trim() === commandMatch[0]) {
      const query = commandMatch[1] ?? ''
      showCommandSuggestions(query, editor)
    } else {
      commandSuggestions.value = []
    }
  }

  /**
   * Handle keyboard events
   */
  const handleKeyDown = (e: KeyboardEvent, editor: HTMLElement, onSend: () => void) => {
    if (isComposing.value) return

    // Enter to send, Shift+Enter for new line
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
      return
    }

    // Escape to cancel suggestions
    if (e.key === 'Escape') {
      mentionSuggestions.value = []
      commandSuggestions.value = []
      return
    }

    // Navigate mention suggestions
    if (mentionSuggestions.value.length > 0) {
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        activeMentionIndex.value = Math.max(0, activeMentionIndex.value - 1)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        activeMentionIndex.value = Math.min(mentionSuggestions.value.length - 1, activeMentionIndex.value + 1)
      } else if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault()
        const member = mentionSuggestions.value[activeMentionIndex.value]
        if (member) selectMention(member, editor)
      }
    }

    // Navigate command suggestions
    if (commandSuggestions.value.length > 0) {
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        activeCommandIndex.value = Math.max(0, activeCommandIndex.value - 1)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        activeCommandIndex.value = Math.min(commandSuggestions.value.length - 1, activeCommandIndex.value + 1)
      } else if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault()
        const cmd = commandSuggestions.value[activeCommandIndex.value]
        if (cmd) selectCommand(cmd)
      }
    }
  }

  /**
   * Handle paste events
   */
  const handlePaste = async (e: ClipboardEvent) => {
    e.preventDefault()

    const items = Array.from(e.clipboardData?.items || [])

    // Check for images
    for (const item of items) {
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile()
        if (file) {
          // Emit event for image handling
          const event = new CustomEvent('image-paste', { detail: { file } })
          document.dispatchEvent(event)
        }
        return
      }
    }

    // Paste text
    const text = e.clipboardData?.getData('text/plain') || ''
    document.execCommand('insertText', false, text)
  }

  /**
   * Handle composition start (Chinese input)
   */
  const handleCompositionStart = () => {
    isComposing.value = true
  }

  /**
   * Handle composition end
   */
  const handleCompositionEnd = () => {
    isComposing.value = false
  }

  /**
   * Escape HTML special characters
   */
  const escapeHtml = (text: string): string => {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  /**
   * Generate formatted body from plain text and format ranges
   */
  const generateFormattedBody = (plainText: string): string => {
    if (formatRanges.value.length === 0) {
      return escapeHtml(plainText).replace(/\n/g, '<br>')
    }

    const sortedRanges = [...formatRanges.value].sort((a, b) => a.start - b.start)

    let html = ''
    let lastIndex = 0

    for (const range of sortedRanges) {
      if (range.start > lastIndex) {
        html += escapeHtml(plainText.substring(lastIndex, range.start)).replace(/\n/g, '<br>')
      }

      const text = plainText.substring(range.start, range.end)
      const tag = range.type === 'bold' ? 'strong' : range.type === 'italic' ? 'em' : 'del'
      html += `<${tag}>${escapeHtml(text).replace(/\n/g, '<br>')}</${tag}>`

      lastIndex = range.end
    }

    if (lastIndex < plainText.length) {
      html += escapeHtml(plainText.substring(lastIndex)).replace(/\n/g, '<br>')
    }

    return html
  }

  /**
   * Toggle text formatting
   */
  const toggleFormat = (format: 'bold' | 'italic' | 'strike', editor: HTMLElement) => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      // No selection, toggle format state for next input
      switch (format) {
        case 'bold':
          formatBold.value = !formatBold.value
          break
        case 'italic':
          formatItalic.value = !formatItalic.value
          break
        case 'strike':
          formatStrike.value = !formatStrike.value
          break
      }
      return
    }

    // Get selected text range
    const range = selection.getRangeAt(0)
    const preCaretRange = range.cloneRange()
    preCaretRange.selectNodeContents(editor)
    preCaretRange.setEnd(range.startContainer, range.startOffset)
    const start = preCaretRange.toString().length

    preCaretRange.setEnd(range.endContainer, range.endOffset)
    const end = preCaretRange.toString().length

    // Check if format already exists at this range
    const existingIndex = formatRanges.value.findIndex((r) => r.type === format && r.start === start && r.end === end)

    if (existingIndex !== -1) {
      formatRanges.value.splice(existingIndex, 1)
    } else {
      formatRanges.value.push({ start, end, type: format })
    }

    // Update toggle state
    switch (format) {
      case 'bold':
        formatBold.value = !formatBold.value
        break
      case 'italic':
        formatItalic.value = !formatItalic.value
        break
      case 'strike':
        formatStrike.value = !formatStrike.value
        break
    }
  }

  return {
    // States
    formatBold,
    formatItalic,
    formatStrike,
    formatRanges,
    mentionSuggestions,
    activeMentionIndex,
    mentionPosition,
    commandSuggestions,
    activeCommandIndex,
    commandPosition,
    isComposing,

    // Actions
    handleEditorInput,
    handleKeyDown,
    handlePaste,
    handleCompositionStart,
    handleCompositionEnd,
    toggleFormat,
    insertText,
    insertCodeBlock,
    selectMention,
    selectCommand,
    clearEditor,
    getMessageLength,
    getCaretPosition,

    // Internal helpers (exposed for parent use)
    generateFormattedBody
  }
}
