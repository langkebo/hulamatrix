<template>
  <div class="matrix-msg-input">
    <!-- 输入工具栏 -->
    <div class="input-toolbar">
      <!-- 表情按钮 -->
      <n-popover v-model:show="showEmojiPicker" trigger="click" placement="top-start" class="emoji-picker-popover">
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
        @before-upload="handleBeforeUpload">
        <n-button quaternary circle size="small">
          <n-icon :component="Paperclip" />
        </n-button>
      </n-upload>

      <!-- 图片上传 -->
      <n-upload
        accept="image/*"
        :show-file-list="false"
        :custom-request="handleImageUpload"
        @before-upload="handleBeforeImageUpload">
        <n-button quaternary circle size="small">
          <n-icon :component="Photo" />
        </n-button>
      </n-upload>

      <!-- 录音按钮 -->
      <n-popover v-model:show="showVoiceRecorder" trigger="click" placement="top-start">
        <template #trigger>
          <n-button quaternary circle size="small" :disabled="disabled">
            <n-icon :component="Microphone" />
          </n-button>
        </template>
        <VoiceRecorder @send="handleVoiceSend" @cancel="showVoiceRecorder = false" />
      </n-popover>

      <!-- 代码块 -->
      <n-button quaternary circle size="small" @click="insertCodeBlock">
        <n-icon :component="Code" />
      </n-button>

      <!-- 分割线 -->
      <n-divider vertical />

      <!-- 格式化工具 -->
      <n-button-group size="small">
        <n-button quaternary :type="formatBold ? 'primary' : 'default'" @click="toggleBold">
          <n-icon :component="FileText" />
        </n-button>
        <n-button quaternary :type="formatItalic ? 'primary' : 'default'" @click="toggleItalic">
          <n-icon :component="Italic" />
        </n-button>
        <n-button quaternary :type="formatStrike ? 'primary' : 'default'" @click="toggleStrike">
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
        @input="handleEditorInputWrapper"
        @paste="handlePaste"
        @keydown="handleKeyDownWrapper"
        @compositionstart="handleCompositionStart"
        @compositionend="handleCompositionEnd"></div>

      <!-- 提及建议 -->
      <div
        v-if="mentionSuggestions.length > 0"
        class="mention-suggestions"
        :style="{ top: mentionPosition.top + 'px', left: mentionPosition.left + 'px' }">
        <div
          v-for="(member, index) in mentionSuggestions"
          :key="member.userId"
          class="mention-item"
          :class="{ active: index === activeMentionIndex }"
          @click="selectMentionWrapper(member)"
          @mouseenter="activeMentionIndex = index">
          <n-avatar v-bind="member.avatarUrl !== undefined ? { src: member.avatarUrl } : {}" round :size="24">
            {{ getNameInitials(member.displayName || member.userId) }}
          </n-avatar>
          <span>{{ member.displayName || member.userId }}</span>
        </div>
      </div>

      <!-- 命令建议 -->
      <div
        v-if="commandSuggestions.length > 0"
        class="command-suggestions"
        :style="{ top: commandPosition.top + 'px', left: commandPosition.left + 'px' }">
        <div
          v-for="(cmd, index) in commandSuggestions"
          :key="cmd.name"
          class="command-item"
          :class="{ active: index === activeCommandIndex }"
          @click="selectCommand(cmd)"
          @mouseenter="activeCommandIndex = index">
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
      <div v-if="messageLength > 0" class="char-count">{{ messageLength }}/{{ maxLength }}</div>

      <!-- 发送按钮 -->
      <div class="send-actions">
        <!-- 快捷回复 -->
        <n-dropdown :options="quickReplyOptions" placement="top-end" @select="handleQuickReply">
          <n-button quaternary size="small">
            <n-icon :component="Bolt" />
          </n-button>
        </n-dropdown>

        <!-- 发送按钮 -->
        <n-button type="primary" :disabled="!canSend" :loading="sending" @click="handleSendMessage">
          <template #icon>
            <n-icon :component="Send" />
          </template>
          {{ editingMessage ? '更新' : '发送' }}
        </n-button>
      </div>
    </div>

    <!-- 拖拽上传覆盖层 -->
    <div v-if="isDragOver" class="drag-overlay" @dragover.prevent @drop.prevent="handleDrop">
      <div class="drag-content">
        <n-icon :component="CloudUpload" size="48" />
        <p>松开以上传文件</p>
      </div>
    </div>

    <!-- 消息预览 -->
    <div v-if="previewMessage" class="message-preview">
      <div class="preview-header">
        <span>消息预览</span>
        <n-button text size="small" @click="previewMessage = null">
          <n-icon :component="X" />
        </n-button>
      </div>
      <div class="preview-content">
        <MatrixMessage :message="previewMessage" :show-avatar="false" :show-timestamp="false" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { NButton, NButtonGroup, NIcon, NPopover, NUpload, NDivider, NDropdown, NAvatar } from 'naive-ui'
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
import type { MsgType } from '@/services/types'
import { MsgEnum, MessageStatusEnum } from '@/services/types'
import { useChatStore } from '@/stores/chat'
import { useUserStore } from '@/stores/user'
import { useMatrixStore } from '@/stores/matrix'
import type { MatrixMessage as MatrixMessageType, MatrixMember } from '@/types/matrix'
import { getMatrixMessageText } from '@/types/matrix'
import { getNameInitials } from '@/utils/formatUtils'

// Composables
import { useMessageEditor } from '@/composables/useMessageEditor'
import { useMessageAttachments, type VoiceData } from '@/composables/useMessageAttachments'
import { useMessageSender } from '@/composables/useMessageSender'

// Components
import EmojiPicker from '@/components/message/EmojiPicker.vue'
import VoiceRecorder from '@/components/chat/VoiceRecorder.vue'
import MatrixMessage from './MatrixMessage.vue'

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

// Stores
const chatStore = useChatStore()
const userStore = useUserStore()
const matrixStore = useMatrixStore()

// Refs
const editorRef = ref<HTMLElement>()
const showEmojiPicker = ref(false)
const showVoiceRecorder = ref(false)
const previewMessage = ref<MsgType | null>(null)

// Initialize message editor composable with lazy command initialization
const messageEditor = useMessageEditor({
  maxLength: 65536,
  members: () => matrixStore.currentRoomMembers,
  commands: [] // Will be set after destructuring
})

// Initialize message attachments composable
const attachments = useMessageAttachments({
  roomId: computed(() => props.roomId),
  onSend: (event) => emit('send', event),
  onClearEditor: () => messageEditor.clearEditor(editorRef.value!)
})

// Initialize message sender composable
const messageSender = useMessageSender({
  roomId: computed(() => props.roomId),
  editingMessage: computed(() => props.editingMessage),
  formatRanges: messageEditor.formatRanges,
  onSend: (event) => emit('send', event),
  onEdit: (messageId, content) => emit('edit', messageId, content),
  onClearEditor: () => messageEditor.clearEditor(editorRef.value!)
})

// Destructure from composables
const {
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
  getCaretPosition
} = messageEditor

const {
  isDragOver,
  sending: attachmentsSending,
  handleBeforeUpload,
  handleFileUpload,
  handleBeforeImageUpload,
  handleImageUpload,
  handleVoiceSend,
  handleDrop,
  handleDragOver,
  handleDragLeave
} = attachments

const { sending: senderSending, sendMessage } = messageSender

// Set commands after insertText is available (lazy initialization)
// Commands will be handled internally by the composable

// Combined sending state
const sending = computed(() => attachmentsSending.value || senderSending.value)

// Computed
const inputPlaceholder = computed(() => {
  if (props.disabled) return '无法发送消息...'
  if (props.editingMessage) return '编辑消息...'
  return '输入消息... (Enter发送，Shift+Enter换行)'
})

const messageLength = computed(() => getMessageLength(editorRef.value!))

const maxLength = computed(() => 65536)

const canSend = computed(() => {
  return messageLength.value > 0 && messageLength.value <= maxLength.value && !sending.value
})

const quickReplyOptions = computed(() => [
  { label: '好的', key: 'ok' },
  { label: '收到', key: 'received' },
  { label: '谢谢', key: 'thanks' },
  { label: '没问题', key: 'noProblem' },
  { label: '稍等', key: 'wait' }
])

// Helper functions
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

const handleQuickReply = (reply: string) => {
  const replies: Record<string, string> = {
    ok: '好的',
    received: '收到',
    thanks: '谢谢',
    noProblem: '没问题',
    wait: '稍等'
  }
  insertText(replies[reply])
}

const handleSendMessage = async () => {
  if (!canSend.value) return
  const content = editorRef.value?.textContent || ''
  if (!content.trim()) return
  await sendMessage(content, messageEditor.generateFormattedBody)
}

// Wrapper functions that pass editorRef
const toggleBold = () => {
  if (editorRef.value) toggleFormat('bold', editorRef.value)
}

const toggleItalic = () => {
  if (editorRef.value) toggleFormat('italic', editorRef.value)
}

const toggleStrike = () => {
  if (editorRef.value) toggleFormat('strike', editorRef.value)
}

// Wrapper for keyboard handler with editor reference
const handleKeyDownWrapper = (e: KeyboardEvent) => {
  handleKeyDown(e, editorRef.value!, handleSendMessage)
}

// Wrapper for input handler with editor reference
const handleEditorInputWrapper = () => {
  if (editorRef.value) {
    handleEditorInput(editorRef.value)
    updatePreview()
  }
}

// Wrapper for selectMention with editor reference
const selectMentionWrapper = (member: MatrixMember) => {
  if (editorRef.value) {
    selectMention(member, editorRef.value)
  }
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

.emoji-picker-popover {
  width: 320px;
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
  box-shadow: 0 4px 12px rgba(var(--hula-black-rgb), 0.1);
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
  background: rgba(var(--hula-black-rgb), 0.5);
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
