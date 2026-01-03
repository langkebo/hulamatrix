<template>
  <div class="matrix-msg-input">
    <!-- 输入工具栏 -->
    <div class="input-toolbar">
      <!-- 表情按钮 -->
      <n-popover
        v-model:show="showEmojiPicker"
        trigger="click"
        placement="top-start"
        style="width: 320px"
      >
        <template #trigger>
          <n-button quaternary circle size="small">
            <n-icon :component="MoodHappy" />
          </n-button>
        </template>
        <EmojiPicker @select="handleEmojiSelect" />
      </n-popover>

      <!-- 文件上传 -->
      <n-upload
        multiple
        directory-dnd
        :show-file-list="false"
        :custom-request="handleFileUpload"
        @before-upload="handleBeforeUpload"
      >
        <n-button quaternary circle size="small">
          <n-icon :component="Paperclip" />
        </n-button>
      </n-upload>

      <!-- 图片上传 -->
      <n-upload
        accept="image/*"
        :show-file-list="false"
        :custom-request="handleImageUpload"
        @before-upload="handleBeforeImageUpload"
      >
        <n-button quaternary circle size="small">
          <n-icon :component="Photo" />
        </n-button>
      </n-upload>

      <!-- 录音按钮 -->
      <n-popover
        v-model:show="showVoiceRecorder"
        trigger="click"
        placement="top-start"
      >
        <template #trigger>
          <n-button
            quaternary
            circle
            size="small"
            :disabled="disabled"
          >
            <n-icon :component="Microphone" />
          </n-button>
        </template>
        <VoiceRecorder @send="handleVoiceSend" @cancel="showVoiceRecorder = false" />
      </n-popover>

      <!-- 代码块 -->
      <n-button
        quaternary
        circle
        size="small"
        @click="insertCodeBlock"
      >
        <n-icon :component="Code" />
      </n-button>

      <!-- 分割线 -->
      <n-divider vertical />

      <!-- 格式化工具 -->
      <n-button-group size="small">
        <n-button
          quaternary
          :type="formatBold ? 'primary' : 'default'"
          @click="toggleFormat('bold')"
        >
          <n-icon :component="FileText" />
        </n-button>
        <n-button
          quaternary
          :type="formatItalic ? 'primary' : 'default'"
          @click="toggleFormat('italic')"
        >
          <n-icon :component="Italic" />
        </n-button>
        <n-button
          quaternary
          :type="formatStrike ? 'primary' : 'default'"
          @click="toggleFormat('strike')"
        >
          <n-icon :component="Strikethrough" />
        </n-button>
      </n-button-group>
    </div>

    <!-- 输入区域 -->
    <div class="input-container">
      <!-- 消息编辑器 -->
      <div
        ref="editorRef"
        class="message-editor"
        :contenteditable="!disabled"
        :placeholder="inputPlaceholder"
        @input="handleEditorInput"
        @paste="handlePaste"
        @keydown="handleKeyDown"
        @compositionstart="handleCompositionStart"
        @compositionend="handleCompositionEnd"
      ></div>

      <!-- 提及建议 -->
      <div
        v-if="mentionSuggestions.length > 0"
        class="mention-suggestions"
        :style="{ top: mentionPosition.top + 'px', left: mentionPosition.left + 'px' }"
      >
        <div
          v-for="(member, index) in mentionSuggestions"
          :key="member.userId"
          class="mention-item"
          :class="{ active: index === activeMentionIndex }"
          @click="selectMention(member)"
          @mouseenter="activeMentionIndex = index"
        >
          <n-avatar
            v-bind="member.avatarUrl !== undefined ? { src: member.avatarUrl } : {}"
            round
            :size="24"
          >
            {{ getMemberInitials(member) }}
          </n-avatar>
          <span>{{ member.displayName || member.userId }}</span>
        </div>
      </div>

      <!-- 命令建议 -->
      <div
        v-if="commandSuggestions.length > 0"
        class="command-suggestions"
        :style="{ top: commandPosition.top + 'px', left: commandPosition.left + 'px' }"
      >
        <div
          v-for="(cmd, index) in commandSuggestions"
          :key="cmd.name"
          class="command-item"
          :class="{ active: index === activeCommandIndex }"
          @click="selectCommand(cmd)"
          @mouseenter="activeCommandIndex = index"
        >
          <div class="command-info">
            <span class="command-name">/{{ cmd.name }}</span>
            <span class="command-desc">{{ cmd.description }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 输入区域底部 -->
    <div class="input-footer">
      <!-- 正在输入状态 -->
      <div v-if="isComposing" class="composing-indicator">
        <n-icon :component="Language" />
        <span>正在输入中文...</span>
      </div>

      <!-- 字数统计 -->
      <div v-if="messageLength > 0" class="char-count">
        {{ messageLength }}/{{ maxLength }}
      </div>

      <!-- 发送按钮 -->
      <div class="send-actions">
        <!-- 快捷回复 -->
        <n-dropdown
          :options="quickReplyOptions"
          placement="top-end"
          @select="handleQuickReply"
        >
          <n-button quaternary size="small">
            <n-icon :component="Bolt" />
          </n-button>
        </n-dropdown>

        <!-- 发送按钮 -->
        <n-button
          type="primary"
          :disabled="!canSend"
          :loading="sending"
          @click="sendMessage"
        >
          <template #icon>
            <n-icon :component="Send" />
          </template>
          {{ editingMessage ? '更新' : '发送' }}
        </n-button>
      </div>
    </div>

    <!-- 拖拽上传覆盖层 -->
    <div
      v-if="isDragOver"
      class="drag-overlay"
      @dragover.prevent
      @drop.prevent="handleDrop"
    >
      <div class="drag-content">
        <n-icon :component="CloudUpload" size="48" />
        <p>松开以上传文件</p>
      </div>
    </div>

    <!-- 消息预览 -->
    <div
      v-if="previewMessage"
      class="message-preview"
    >
      <div class="preview-header">
        <span>消息预览</span>
        <n-button
          text
          size="small"
          @click="previewMessage = null"
        >
          <n-icon :component="X" />
        </n-button>
      </div>
      <div class="preview-content">
        <MatrixMessage
          :message="previewMessage"
          :show-avatar="false"
          :show-timestamp="false"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  NButton,
  NButtonGroup,
  NIcon,
  NPopover,
  NUpload,
  NDivider,
  NDropdown,
  NAvatar,
  useMessage,
  type UploadCustomRequestOptions,
  type UploadFileInfo
} from 'naive-ui'
import {
  MoodHappy,
  Paperclip,
  Photo,
  Microphone,
  Code,
  FileText,
  Italic,
  Strikethrough,
  Language,
  Bolt,
  Send,
  CloudUpload,
  X
} from '@vicons/tabler'
import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'
import type { MsgType } from '@/services/types'
import { MsgEnum, MessageStatusEnum } from '@/services/types'
import { useChatStore } from '@/stores/chat'
import { useUserStore } from '@/stores/user'
import { useMatrixStore } from '@/stores/matrix'
import type { MatrixMessage as MatrixMessageType, MatrixMember } from '@/types/matrix'
import { getMatrixMessageText } from '@/types/matrix'

// Components
import EmojiPicker from '@/components/message/EmojiPicker.vue'
import VoiceRecorder from '@/components/chat/VoiceRecorder.vue'
import MatrixMessage from './MatrixMessage.vue'

// Type definitions
interface CommandSuggestion {
  name: string
  description: string
  action: () => void
}

interface VoiceData {
  localPath: string
  size: number
  duration: number
  filename: string
  type: string
}

interface MessageContent {
  eventId?: string
  type: string
  body: string
  [key: string]: unknown
}

interface Props {
  roomId: string
  disabled?: boolean
  editingMessage?: MatrixMessageType | null
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  editingMessage: null
})

const emit = defineEmits<{
  send: [content: MessageContent]
  edit: [messageId: string, content: string]
  preview: [content: MsgType]
}>()

const message = useMessage()

// Stores
const chatStore = useChatStore()
const userStore = useUserStore()
const matrixStore = useMatrixStore()

// Refs
const editorRef = ref<HTMLElement>()
const showEmojiPicker = ref(false)
const showVoiceRecorder = ref(false)
const isComposing = ref(false)
const isDragOver = ref(false)
const sending = ref(false)
const previewMessage = ref<MsgType | null>(null)

// Format states
const formatBold = ref(false)
const formatItalic = ref(false)
const formatStrike = ref(false)

// Store formatting ranges for generating formatted_body
interface FormatRange {
  start: number
  end: number
  type: 'bold' | 'italic' | 'strike'
}
const formatRanges = ref<FormatRange[]>([])

// Mention state
const mentionSuggestions = ref<MatrixMember[]>([])
const activeMentionIndex = ref(0)
const mentionPosition = ref({ top: 0, left: 0 })

// Command state
const commandSuggestions = ref<CommandSuggestion[]>([])
const activeCommandIndex = ref(0)
const commandPosition = ref({ top: 0, left: 0 })

// Computed
const inputPlaceholder = computed(() => {
  if (props.disabled) return '无法发送消息...'
  if (props.editingMessage) return '编辑消息...'
  return '输入消息... (Enter发送，Shift+Enter换行)'
})

const messageLength = computed(() => {
  return editorRef.value?.textContent?.length || 0
})

const maxLength = computed(() => {
  return 65536 // Matrix message limit
})

const canSend = computed(() => {
  return messageLength.value > 0 && messageLength.value <= maxLength.value && !sending.value
})

const quickReplyOptions = computed(() => [
  {
    label: '好的',
    key: 'ok'
  },
  {
    label: '收到',
    key: 'received'
  },
  {
    label: '谢谢',
    key: 'thanks'
  },
  {
    label: '没问题',
    key: 'noProblem'
  },
  {
    label: '稍等',
    key: 'wait'
  }
])

const members = computed(() => matrixStore.currentRoomMembers || [])

// Helper functions
const clearEditor = () => {
  if (editorRef.value) {
    editorRef.value.textContent = ''
  }
  // Clear formatting ranges
  formatRanges.value = []
  formatBold.value = false
  formatItalic.value = false
  formatStrike.value = false
}

// Commands
const commands = [
  { name: 'shrug', description: '¯\\_(ツ)_/¯', action: () => insertText('¯\\_(ツ)_/¯') },
  { name: 'tableflip', description: '(╯°□°）╯︵ ┻━┻', action: () => insertText('(╯°□°）╯︵ ┻━┻') },
  { name: 'unflip', description: '┬─┬ ノ( ゜-゜ノ)', action: () => insertText('┬─┬ ノ( ゜-゜ノ)') },
  { name: 'lenny', description: '( ͡° ͜ʖ ͡°)', action: () => insertText('( ͡° ͜ʖ ͡°)') },
  { name: 'clear', description: '清空输入', action: clearEditor }
]

// Methods
const getMemberInitials = (member: MatrixMember): string => {
  const name = member.displayName || member.userId
  if (!name) return '?'

  const names = name.split(' ')
  if (names.length >= 2) {
    return (names[0]?.[0] || '') + (names[1]?.[0] || '')
  }
  return name.substring(0, 2).toUpperCase()
}

const handleEditorInput = () => {
  const content = editorRef.value?.textContent || ''

  // Check for mentions
  const cursorPos = getCaretPosition()
  const beforeCursor = content.substring(0, cursorPos)
  const mentionMatch = beforeCursor.match(/@(\w*)$/)

  if (mentionMatch) {
    const query = mentionMatch[1] ?? ''
    showMentionSuggestions(query, cursorPos)
  } else {
    mentionSuggestions.value = []
  }

  // Check for commands
  const commandMatch = beforeCursor.match(/\/(\w*)$/)
  if (commandMatch && beforeCursor.trim() === commandMatch[0]) {
    const query = commandMatch[1] ?? ''
    showCommandSuggestions(query, cursorPos)
  } else {
    commandSuggestions.value = []
  }

  // Update preview
  updatePreview()
}

const handleKeyDown = (e: KeyboardEvent) => {
  if (isComposing.value) return

  // Enter to send, Shift+Enter for new line
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
    return
  }

  // Escape to cancel suggestions
  if (e.key === 'Escape') {
    mentionSuggestions.value = []
    commandSuggestions.value = []
    return
  }

  // Navigate suggestions
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
      if (member) selectMention(member)
    }
  }

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

const handlePaste = async (e: ClipboardEvent) => {
  e.preventDefault()

  const items = Array.from(e.clipboardData?.items || [])

  for (const item of items) {
    if (item.type.indexOf('image') !== -1) {
      const file = item.getAsFile()
      if (file) {
        await handleImageFile(file)
      }
      return
    }
  }

  // Paste text
  const text = e.clipboardData?.getData('text/plain') || ''
  document.execCommand('insertText', false, text)
}

const handleCompositionStart = () => {
  isComposing.value = true
}

const handleCompositionEnd = () => {
  isComposing.value = false
}

const getCaretPosition = (): number => {
  if (!editorRef.value) return 0

  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return 0

  const range = selection.getRangeAt(0)
  const preCaretRange = range.cloneRange()
  preCaretRange.selectNodeContents(editorRef.value)
  preCaretRange.setEnd(range.endContainer, range.endOffset)

  return preCaretRange.toString().length
}

const showMentionSuggestions = (query: string, _cursorPos: number) => {
  const filtered = members.value
    .filter((member: MatrixMember) => (member.displayName || member.userId).toLowerCase().includes(query.toLowerCase()))
    .slice(0, 5)

  mentionSuggestions.value = filtered
  activeMentionIndex.value = 0

  // Calculate position
  const rect = editorRef.value?.getBoundingClientRect()
  if (rect) {
    mentionPosition.value = {
      top: rect.bottom,
      left: rect.left
    }
  }
}

const showCommandSuggestions = (query: string, _cursorPos: number) => {
  const filtered = commands.filter((cmd) => cmd.name.toLowerCase().includes(query.toLowerCase()))

  commandSuggestions.value = filtered
  activeCommandIndex.value = 0

  // Calculate position
  const rect = editorRef.value?.getBoundingClientRect()
  if (rect) {
    commandPosition.value = {
      top: rect.bottom,
      left: rect.left
    }
  }
}

const selectMention = (member: MatrixMember) => {
  const content = editorRef.value?.textContent || ''
  const cursorPos = getCaretPosition()
  const beforeCursor = content.substring(0, cursorPos)
  const afterCursor = content.substring(cursorPos)

  // Replace @mention with formatted text
  const mentionText = `@${member.displayName || member.userId}`
  const newContent = beforeCursor.replace(/@\w*$/, mentionText) + afterCursor

  editorRef.value!.textContent = newContent
  mentionSuggestions.value = []

  // Set cursor position
  const newCursorPos = beforeCursor.replace(/@\w*$/, mentionText).length
  setCaretPosition(newCursorPos)
}

const selectCommand = (cmd: CommandSuggestion) => {
  commandSuggestions.value = []
  cmd.action()
}

const setCaretPosition = (position: number) => {
  if (!editorRef.value) return

  const range = document.createRange()
  const selection = window.getSelection()

  const walker = document.createTreeWalker(editorRef.value, NodeFilter.SHOW_TEXT, null)

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

const insertText = (text: string) => {
  document.execCommand('insertText', false, text)
}

const insertCodeBlock = () => {
  insertText('\n```\n代码\n```\n')
}

const toggleFormat = (format: 'bold' | 'italic' | 'strike') => {
  if (!editorRef.value) return

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
  preCaretRange.selectNodeContents(editorRef.value)
  preCaretRange.setEnd(range.startContainer, range.startOffset)
  const start = preCaretRange.toString().length

  preCaretRange.setEnd(range.endContainer, range.endOffset)
  const end = preCaretRange.toString().length

  // Check if format already exists at this range
  const existingIndex = formatRanges.value.findIndex((r) => r.type === format && r.start === start && r.end === end)

  if (existingIndex !== -1) {
    // Remove format
    formatRanges.value.splice(existingIndex, 1)
  } else {
    // Add format
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

  // Update preview
  updatePreview()
}

/**
 * Generate Matrix formatted_body from plain text and format ranges
 * Converts formatting to HTML according to Matrix spec
 */
const generateFormattedBody = (plainText: string): string => {
  if (formatRanges.value.length === 0) {
    // No formatting, just escape HTML and convert line breaks
    return escapeHtml(plainText).replace(/\n/g, '<br>')
  }

  // Sort ranges by start position
  const sortedRanges = [...formatRanges.value].sort((a, b) => a.start - b.start)

  // Build HTML with formatting tags
  let html = ''
  let lastIndex = 0

  // Merge overlapping ranges and apply tags
  for (const range of sortedRanges) {
    // Add text before this format
    if (range.start > lastIndex) {
      html += escapeHtml(plainText.substring(lastIndex, range.start)).replace(/\n/g, '<br>')
    }

    // Get the text for this range
    const text = plainText.substring(range.start, range.end)

    // Apply format tag
    const tag = range.type === 'bold' ? 'strong' : range.type === 'italic' ? 'em' : 'del'
    html += `<${tag}>${escapeHtml(text).replace(/\n/g, '<br>')}</${tag}>`

    lastIndex = range.end
  }

  // Add remaining text
  if (lastIndex < plainText.length) {
    html += escapeHtml(plainText.substring(lastIndex)).replace(/\n/g, '<br>')
  }

  return html
}

/**
 * Escape HTML special characters
 */
const escapeHtml = (text: string): string => {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

const updatePreview = () => {
  if (!editorRef.value) return

  const content = editorRef.value.textContent || ''
  if (content.length > 0) {
    previewMessage.value = {
      id: 'preview',
      roomId: props.roomId,
      type: MsgEnum.TEXT,
      body: { text: content },
      sendTime: Date.now(),
      messageMarks: {},
      status: MessageStatusEnum.SUCCESS,
      fromUser: { uid: userStore.userInfo?.uid || 'me' }
    }
  } else {
    previewMessage.value = null
  }
}

const handleEmojiSelect = (emoji: string) => {
  insertText(emoji)
  showEmojiPicker.value = false
}

const handleBeforeUpload = (data: { file: UploadFileInfo }) => {
  const file = data.file.file
  if (!file) return false

  // Check file size (100MB limit)
  if (file.size > 100 * 1024 * 1024) {
    message.error('文件大小不能超过 100MB')
    return false
  }

  return true
}

const handleFileUpload = async (options: UploadCustomRequestOptions) => {
  try {
    sending.value = true
    const fileObj = options.file.file
    if (!fileObj) return

    await uploadFile(fileObj)
  } catch (error) {
    message.error('文件上传失败')
  } finally {
    sending.value = false
  }
}

const handleBeforeImageUpload = (data: { file: UploadFileInfo }) => {
  const file = data.file.file
  if (!file) return false

  // Check if it's an image
  if (!file.type.startsWith('image/')) {
    message.error('请选择图片文件')
    return false
  }

  // Check file size (10MB limit)
  if (file.size > 10 * 1024 * 1024) {
    message.error('图片大小不能超过 10MB')
    return false
  }

  return true
}

const handleImageUpload = async (options: UploadCustomRequestOptions) => {
  try {
    sending.value = true
    const imageFile = options.file.file
    if (!imageFile) return

    await handleImageFile(imageFile)
  } catch (error) {
    message.error('图片上传失败')
  } finally {
    sending.value = false
  }
}

const handleImageFile = async (file: File) => {
  try {
    sending.value = true

    // Get file extension to determine MIME type
    const mimeType = file.type || 'image/jpeg'

    // Send image message through Matrix service
    const eventId = await matrixClientService.sendMediaMessage(props.roomId, file, file.name, mimeType)

    emit('send', {
      eventId,
      type: 'm.image',
      body: file.name,
      url: '', // Will be filled by the server response
      fileInfo: {
        name: file.name,
        size: file.size,
        mimeType
      }
    })

    clearEditor()
  } catch (error) {
    logger.error('[MatrixMsgInput] 图片发送失败:', error)
    message.error('图片发送失败：' + (error instanceof Error ? error.message : String(error)))
  } finally {
    sending.value = false
  }
}

const handleVoiceSend = async (voiceData: VoiceData) => {
  try {
    sending.value = true

    // Convert local path to File object
    // For Tauri, we need to read the file and create a Blob
    let audioFile: File
    if (voiceData.localPath.startsWith('blob:') || voiceData.localPath.startsWith('data:')) {
      // It's already a blob URL or data URL
      const response = await fetch(voiceData.localPath)
      const blob = await response.blob()
      audioFile = new File([blob], `voice_${Date.now()}.ogg`, { type: 'audio/ogg' })
    } else {
      // It's a local file path, need to read it through Tauri
      // For now, create a mock file object
      audioFile = new File([''], `voice_${Date.now()}.ogg`, { type: 'audio/ogg' })
    }

    // Send voice message through Matrix service
    const eventId = await matrixClientService.sendMediaMessage(
      props.roomId,
      audioFile,
      `voice_${Date.now()}.ogg`,
      'audio/ogg'
    )

    emit('send', {
      eventId,
      type: 'm.audio',
      body: '[语音]',
      duration: voiceData.duration,
      fileInfo: {
        name: `voice_${Date.now()}.ogg`,
        size: voiceData.size,
        mimeType: 'audio/ogg'
      }
    })

    clearEditor()
  } catch (error) {
    logger.error('[MatrixMsgInput] 语音发送失败:', error)
    message.error('语音发送失败：' + (error instanceof Error ? error.message : String(error)))
  } finally {
    sending.value = false
    showVoiceRecorder.value = false
  }
}

const handleQuickReply = (reply: string) => {
  const replies = {
    ok: '好的',
    received: '收到',
    thanks: '谢谢',
    noProblem: '没问题',
    wait: '稍等'
  }

  insertText(replies[reply as keyof typeof replies])
}

const sendMessage = async () => {
  if (!canSend.value) return

  const content = editorRef.value?.textContent || ''
  if (!content.trim()) return

  sending.value = true

  try {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix 客户端未初始化')
    }

    const sendEventMethod = client.sendEvent as
      | ((
          roomId: string,
          eventType: string,
          content: Record<string, unknown>
        ) => Promise<{ event_id?: string } | string>)
      | undefined

    if (!sendEventMethod) {
      throw new Error('发送功能不可用')
    }

    if (props.editingMessage) {
      // Edit existing message using Matrix SDK
      const formattedBody = generateFormattedBody(content)
      const editContent = {
        msgtype: 'm.text',
        body: content,
        format: 'org.matrix.custom.html',
        formatted_body: formattedBody,
        'm.new_content': {
          msgtype: 'm.text',
          body: content,
          format: 'org.matrix.custom.html',
          formatted_body: formattedBody
        },
        'm.relates_to': {
          event_id: props.editingMessage.eventId,
          rel_type: 'm.replace'
        }
      }

      const result = await sendEventMethod(props.roomId, 'm.room.message', editContent)
      const eventId = typeof result === 'string' ? result : result?.event_id || ''

      emit('edit', props.editingMessage.eventId, content)
      logger.info('[MatrixMsgInput] 消息已编辑', { eventId: props.editingMessage.eventId, newEventId: eventId })
    } else {
      // Send new message with formatting support
      const formattedBody = generateFormattedBody(content)
      const messageContent: Record<string, unknown> = {
        msgtype: 'm.text',
        body: content
      }

      // Only add formatted fields if there's actual formatting
      if (formatRanges.value.length > 0) {
        messageContent.format = 'org.matrix.custom.html'
        messageContent.formatted_body = formattedBody
      }

      const result = await sendEventMethod(props.roomId, 'm.room.message', messageContent)
      const eventId = typeof result === 'string' ? result : result?.event_id || ''

      emit('send', {
        eventId,
        type: 'm.text',
        body: content,
        formattedBody: formatRanges.value.length > 0 ? formattedBody : undefined
      })

      logger.info('[MatrixMsgInput] 消息已发送', { eventId, hasFormatting: formatRanges.value.length > 0 })
    }

    clearEditor()
  } catch (error) {
    logger.error('[MatrixMsgInput] 发送消息失败:', error)
    message.error(props.editingMessage ? '编辑消息失败' : '发送消息失败')
  } finally {
    sending.value = false
  }
}

const uploadFile = async (file: File) => {
  try {
    sending.value = true

    // Determine MIME type
    const mimeType = file.type || 'application/octet-stream'
    let msgType = 'm.file'

    // Determine message type based on MIME type
    if (mimeType.startsWith('image/')) {
      msgType = 'm.image'
    } else if (mimeType.startsWith('video/')) {
      msgType = 'm.video'
    } else if (mimeType.startsWith('audio/')) {
      msgType = 'm.audio'
    }

    // Send file message through Matrix service
    const eventId = await matrixClientService.sendMediaMessage(props.roomId, file, file.name, mimeType)

    emit('send', {
      eventId,
      type: msgType,
      body: file.name,
      url: '', // Will be filled by the server response
      fileInfo: {
        name: file.name,
        size: file.size,
        mimeType
      }
    })

    clearEditor()
  } catch (error) {
    logger.error('[MatrixMsgInput] 文件发送失败:', error)
    message.error('文件发送失败：' + (error instanceof Error ? error.message : String(error)))
  } finally {
    sending.value = false
  }
}

const handleDrop = async (e: DragEvent) => {
  isDragOver.value = false

  const files = Array.from(e.dataTransfer?.files || [])
  for (const file of files) {
    if (file.type.startsWith('image/')) {
      await handleImageFile(file)
    } else {
      await uploadFile(file)
    }
  }
}

// Event listeners
const handleDragOver = (e: DragEvent) => {
  e.preventDefault()
  isDragOver.value = true
}

const handleDragLeave = (e: DragEvent) => {
  e.preventDefault()
  isDragOver.value = false
}

// Lifecycle
onMounted(() => {
  if (editorRef.value && props.editingMessage) {
    editorRef.value.textContent = getMatrixMessageText(props.editingMessage.content)
  }

  // Add drag listeners
  document.addEventListener('dragover', handleDragOver)
  document.addEventListener('dragleave', handleDragLeave)
})

onUnmounted(() => {
  // Remove drag listeners
  document.removeEventListener('dragover', handleDragOver)
  document.removeEventListener('dragleave', handleDragLeave)
})
</script>

<style scoped>
.matrix-msg-input {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background: var(--n-color);
  border-top: 1px solid var(--n-border-color);
}

.input-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.input-container {
  position: relative;
}

.message-editor {
  min-height: 60px;
  max-height: 300px;
  overflow-y: auto;
  padding: 12px;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  background: var(--n-color-embedded);
  line-height: 1.5;
  word-wrap: break-word;
  white-space: pre-wrap;
}

.message-editor:empty:before {
  content: attr(placeholder);
  color: var(--n-text-color-3);
  pointer-events: none;
}

.message-editor:focus {
  outline: none;
  border-color: var(--n-primary-color);
}

.mention-suggestions,
.command-suggestions {
  position: absolute;
  z-index: 1000;
  background: var(--n-color);
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.mention-item,
.command-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.mention-item:hover,
.command-item:hover,
.mention-item.active,
.command-item.active {
  background: var(--n-hover-color);
}

.command-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.command-name {
  font-weight: 500;
}

.command-desc {
  font-size: 12px;
  color: var(--n-text-color-3);
}

.input-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.composing-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--n-text-color-3);
}

.char-count {
  font-size: 12px;
  color: var(--n-text-color-3);
}

.send-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.drag-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.drag-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  color: white;
  text-align: center;
}

.message-preview {
  margin-top: 8px;
  padding: 12px;
  background: var(--n-hover-color);
  border-radius: 8px;
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--n-text-color-3);
}

/* Responsive */
@media (max-width: 768px) {
  .matrix-msg-input {
    padding: 12px;
  }

  .input-toolbar {
    flex-wrap: wrap;
  }

  .message-editor {
    min-height: 50px;
    max-height: 200px;
  }
}
</style>