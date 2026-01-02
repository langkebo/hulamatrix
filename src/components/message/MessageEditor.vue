<template>
  <div class="message-editor" :class="{ 'is-inline': inline, 'is-fullscreen': isFullscreen }">
    <!-- 内联编辑模式 -->
    <div v-if="inline && !isFullscreen" class="inline-editor">
      <div class="edit-input">
        <n-input
          ref="inlineInputRef"
          v-model:value="editContent"
          type="textarea"
          :autosize="{ minRows: 1, maxRows: 4 }"
          :placeholder="isEditing ? '编辑消息...' : '输入新消息...'"
          @keydown="handleKeyDown"
          @focus="handleFocus"
          @blur="handleBlur"
        />
        <div class="edit-toolbar">
          <div class="toolbar-left">
            <!-- 格式化工具 -->
            <n-button-group size="small">
              <n-button quaternary @click="formatText('bold')" :disabled="!hasSelection">
                <template #icon>
                  <n-icon><Bold /></n-icon>
                </template>
              </n-button>
              <n-button quaternary @click="formatText('italic')" :disabled="!hasSelection">
                <template #icon>
                  <n-icon><Italic /></n-icon>
                </template>
              </n-button>
              <n-button quaternary @click="formatText('underline')" :disabled="!hasSelection">
                <template #icon>
                  <n-icon><Underline /></n-icon>
                </template>
              </n-button>
            </n-button-group>

            <!-- 表情选择 -->
            <n-popover trigger="click" placement="top">
              <template #trigger>
                <n-button quaternary size="small">
                  <template #icon>
                    <n-icon><MoodSmile /></n-icon>
                  </template>
                </n-button>
              </template>
              <EmojiPicker @select="insertEmoji" />
            </n-popover>

            <!-- 文件附件 -->
            <n-upload
              :file-list="attachedFiles as UploadFileInfo[]"
              :show-file-list="false"
              :max="5"
              @before-upload="beforeUpload"
              @finish="handleFileUpload"
            >
              <n-button quaternary size="small">
                <template #icon>
                  <n-icon><Paperclip /></n-icon>
                </template>
              </n-button>
            </n-upload>

            <!-- @提及 -->
            <n-button quaternary size="small" @click="showMentionDialog = true">
              <template #icon>
                <n-icon><At /></n-icon>
              </template>
            </n-button>
          </div>

          <div class="toolbar-right">
            <span class="char-count">{{ editContent.length }}/{{ maxLength }}</span>
            <n-button
              v-if="isEditing"
              type="warning"
              size="small"
              @click="cancelEdit"
            >
              取消
            </n-button>
            <n-button
              type="primary"
              size="small"
              @click="saveMessage"
              :disabled="!canSave"
              :loading="isSaving"
            >
              {{ isEditing ? '保存' : '发送' }}
            </n-button>
          </div>
        </div>
      </div>

      <!-- 附件预览 -->
      <div v-if="typedAttachedFiles.length > 0" class="attached-files">
        <div
          v-for="file in typedAttachedFiles"
          :key="String(file.id)"
          class="file-item"
        >
          <div class="file-preview">
            <n-icon v-if="file.file?.type?.startsWith('image/')"><Photo /></n-icon>
            <n-icon v-else-if="file.file?.type?.startsWith('video/')"><Video /></n-icon>
            <n-icon v-else-if="file.file?.type?.startsWith('audio/')"><Music /></n-icon>
            <n-icon v-else><File /></n-icon>
          </div>
          <div class="file-info">
            <div class="file-name">{{ file.name }}</div>
            <div class="file-size">{{ formatFileSize(Number(file.size || 0)) }}</div>
          </div>
          <n-button
            quaternary
            circle
            size="tiny"
            @click="removeFile(file.id)"
          >
            <template #icon>
              <n-icon><X /></n-icon>
            </template>
          </n-button>
        </div>
      </div>

      <!-- 编辑历史记录 -->
      <div v-if="isEditing && editHistory.length > 0" class="edit-history">
        <n-dropdown
          :options="historyOptions"
          @select="restoreFromHistory"
        >
          <n-button quaternary size="tiny">
            <template #icon>
              <n-icon><History /></n-icon>
            </template>
            历史版本
          </n-button>
        </n-dropdown>
      </div>
    </div>

    <!-- 全屏编辑模式 -->
    <div v-else class="fullscreen-editor">
      <div class="editor-header">
        <div class="header-left">
          <h3>{{ isEditing ? '编辑消息' : '新消息' }}</h3>
          <span v-if="roomId" class="room-info">发送到: {{ getRoomName(roomId) }}</span>
        </div>
        <div class="header-right">
          <n-button quaternary @click="toggleFullscreen">
            <template #icon>
              <n-icon><Minimize /></n-icon>
            </template>
          </n-button>
          <n-button quaternary @click="closeEditor">
            <template #icon>
              <n-icon><X /></n-icon>
            </template>
          </n-button>
        </div>
      </div>

      <div class="editor-content">
        <!-- 富文本编辑器 -->
        <div class="rich-editor">
          <div
            ref="editorRef"
            class="editor-area"
            contenteditable="true"
            @input="handleRichInput"
            @keydown="handleRichKeyDown"
            @paste="handlePaste"
            @drop="handleDrop"
            @dragover.prevent
          ></div>

          <!-- 格式化工具栏 -->
          <div class="format-toolbar">
            <n-button-group>
              <n-button quaternary @click="execCommand('bold')" :class="{ active: isCommandActive('bold') }">
                <template #icon>
                  <n-icon><Bold /></n-icon>
                </template>
              </n-button>
              <n-button quaternary @click="execCommand('italic')" :class="{ active: isCommandActive('italic') }">
                <template #icon>
                  <n-icon><Italic /></n-icon>
                </template>
              </n-button>
              <n-button quaternary @click="execCommand('underline')" :class="{ active: isCommandActive('underline') }">
                <template #icon>
                  <n-icon><Underline /></n-icon>
                </template>
              </n-button>
              <n-button quaternary @click="execCommand('strikethrough')" :class="{ active: isCommandActive('strikethrough') }">
                <template #icon>
                  <n-icon><Strikethrough /></n-icon>
                </template>
              </n-button>
            </n-button-group>

            <n-divider vertical />

            <n-button-group>
              <n-button quaternary @click="insertHeading('h2')">H2</n-button>
              <n-button quaternary @click="insertHeading('h3')">H3</n-button>
              <n-button quaternary @click="execCommand('insertUnorderedList')" :class="{ active: isCommandActive('insertUnorderedList') }">
                <template #icon>
                  <n-icon><List /></n-icon>
                </template>
              </n-button>
              <n-button quaternary @click="execCommand('insertOrderedList')" :class="{ active: isCommandActive('insertOrderedList') }">
                <template #icon>
                  <n-icon><ListNumbers /></n-icon>
                </template>
              </n-button>
            </n-button-group>

            <n-divider vertical />

            <n-button-group>
              <n-button quaternary @click="insertLink">
                <template #icon>
                  <n-icon><Link /></n-icon>
                </template>
              </n-button>
              <n-button quaternary @click="insertCode">
                <template #icon>
                  <n-icon><Code /></n-icon>
                </template>
              </n-button>
              <n-button quaternary @click="insertQuote">
                <template #icon>
                  <n-icon><Quote /></n-icon>
                </template>
              </n-button>
            </n-button-group>

            <n-divider vertical />

            <n-button quaternary @click="showEmojiPicker = !showEmojiPicker">
              <template #icon>
                <n-icon><Smile /></n-icon>
              </template>
            </n-button>
          </div>

          <!-- 表情选择器 -->
          <div v-if="showEmojiPicker" class="emoji-picker">
            <EmojiPicker @select="insertEmojiToEditor" @close="showEmojiPicker = false" />
          </div>
        </div>

        <!-- 侧边栏 -->
        <div class="editor-sidebar">
          <!-- 附件管理 -->
          <div class="sidebar-section">
            <h4>附件</h4>
            <n-upload
              :file-list="attachedFiles as UploadFileInfo[]"
              :show-file-list="true"
              :max="10"
              multiple
              directory-dnd
              @before-upload="beforeUpload"
              @finish="handleFileUpload"
              @remove="removeFile"
            >
              <n-button block dashed>
                <template #icon>
                  <n-icon><Upload /></n-icon>
                </template>
                上传文件
              </n-button>
            </n-upload>
          </div>

          <!-- @提及 -->
          <div class="sidebar-section">
            <h4>@提及</h4>
            <n-input
              v-model:value="mentionSearch"
              placeholder="搜索用户..."
              @input="searchUsers"
            />
            <div v-if="mentionResults.length > 0" class="mention-results">
              <div
                v-for="user in mentionResults"
                :key="user.id"
                class="mention-item"
                @click="insertMention(user)"
              >
                <n-avatar
                  v-bind="createStrictAvatarProps({
                    src: user.avatar || null,
                    size: 24,
                    round: true
                  })"
                />
                <span>{{ user.name }}</span>
              </div>
            </div>
          </div>

          <!-- 话题标签 -->
          <div class="sidebar-section">
            <h4>#话题</h4>
            <n-button
              v-for="tag in popularTags"
              :key="tag"
              quaternary
              size="small"
              @click="insertTag(tag)"
            >
              #{{ tag }}
            </n-button>
          </div>

          <!-- 消息选项 -->
          <div class="sidebar-section">
            <h4>选项</h4>
            <n-form :model="messageOptions" label-placement="left">
              <n-form-item label="消息类型">
                <n-select
                  v-model:value="messageOptions.type"
                  :options="messageTypeOptions"
                />
              </n-form-item>
              <n-form-item label="优先级">
                <n-select
                  v-model:value="messageOptions.priority"
                  :options="priorityOptions"
                />
              </n-form-item>
              <n-form-item label="定时发送">
                <n-switch v-model:value="messageOptions.scheduled" />
              </n-form-item>
              <n-form-item v-if="messageOptions.scheduled" label="发送时间">
                <n-date-picker
                  v-model:value="messageOptions.scheduledTime"
                  type="datetime"
                />
              </n-form-item>
            </n-form>
          </div>
        </div>
      </div>

      <!-- 底部操作栏 -->
      <div class="editor-footer">
        <div class="footer-left">
          <span class="char-count">{{ contentLength }}/{{ maxLength }}</span>
          <n-tag v-if="messageOptions.scheduled" type="info" size="small">
            定时发送
          </n-tag>
        </div>
        <div class="footer-right">
          <n-button v-if="isEditing" @click="cancelEdit">
            取消编辑
          </n-button>
          <n-button @click="saveDraft">
            保存草稿
          </n-button>
          <n-button
            type="primary"
            @click="saveMessage"
            :disabled="!canSave"
            :loading="isSaving"
          >
            {{ isEditing ? '保存编辑' : '发送消息' }}
          </n-button>
        </div>
      </div>
    </div>

    <!-- 提及对话框 -->
    <n-modal v-model:show="showMentionDialog" preset="dialog" title="选择要提及的用户">
      <n-input
        v-model:value="mentionSearch"
        placeholder="搜索用户..."
        @input="searchUsers"
      />
      <div class="mention-list">
        <div
          v-for="user in mentionResults"
          :key="user.id"
          class="mention-item"
          @click="insertInlineMention(user)"
        >
          <n-avatar
              v-bind="createStrictAvatarProps({
                src: user.avatar || null,
                size: 32,
                round: true
              })"
            />
          <div class="mention-info">
            <div class="mention-name">{{ user.name }}</div>
            <div class="mention-status">{{ user.status }}</div>
          </div>
        </div>
      </div>
    </n-modal>

    <!-- 链接插入对话框 -->
    <n-modal v-model:show="showLinkDialog" preset="dialog" title="插入链接">
      <n-form :model="linkData" label-placement="left">
        <n-form-item label="链接文本">
          <n-input v-model:value="linkData.text" placeholder="显示的文本" />
        </n-form-item>
        <n-form-item label="链接地址">
          <n-input v-model:value="linkData.url" placeholder="https://..." />
        </n-form-item>
      </n-form>
      <template #action>
        <n-space>
          <n-button @click="showLinkDialog = false">取消</n-button>
          <n-button type="primary" @click="confirmLink">插入</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import {
  NInput,
  NButton,
  NButtonGroup,
  NIcon,
  NUpload,
  NAvatar,
  NTag,
  NDropdown,
  NPopover,
  NModal,
  NForm,
  NFormItem,
  NSelect,
  NSwitch,
  NDatePicker,
  NDivider,
  type UploadFileInfo
} from 'naive-ui'
import { createStrictAvatarProps } from '@/utils/naive-types'
import { msg } from '@/utils/SafeUI'
import {
  Bold,
  Italic,
  Underline,
  Paperclip,
  X,
  History,
  Video,
  Music,
  File,
  Minimize,
  Strikethrough,
  List,
  ListNumbers,
  Link,
  Code,
  Quote,
  Upload
} from '@vicons/tabler'
import MoodSmile from '@vicons/tabler/MoodSmile'
import At from '@vicons/tabler/At'
import Photo from '@vicons/tabler/Photo'
import EmojiPicker from './EmojiPicker.vue'
import { logger } from '@/utils/logger'
import DOMPurify from 'dompurify'
//
//

interface Props {
  roomId?: string
  messageId?: string // 如果提供，则为编辑模式
  inline?: boolean // 是否为内联编辑器
  initialContent?: string // 初始内容
  maxLength?: number
}

interface User {
  id: string
  name: string
  avatar?: string
  status?: string
}

interface MessageEdit {
  eventId: string
  timestamp: number
  newContent: { body?: string }
}

const props = withDefaults(defineProps<Props>(), {
  inline: true,
  maxLength: 4000
})

const emit = defineEmits<{
  'message-sent': [message: unknown]
  'message-updated': [message: unknown]
  'edit-cancelled': []
  closed: []
}>()

interface MessageManager {
  editMessage: (roomId: string, messageId: string | number, content: string) => Promise<void>
}
const messageManager: MessageManager = { editMessage: async () => {} }

// Type definitions
interface AttachedFile {
  id: string | number
  name: string
  batchId?: string | null
  percentage?: number | null
  status?: 'error' | 'pending' | 'uploading' | 'finished' | 'removed'
  file?: File
  url?: string
  thumbnailUrl?: string
  fullPath?: string
  size?: number | string
  [key: string]: unknown
}

interface EditHistoryItem {
  eventId: string
  timestamp: number
  [key: string]: unknown
}

// 状态管理
const isEditing = ref(!!props.messageId)
const isFullscreen = ref(false)
const isSaving = ref(false)
const editContent = ref(props.initialContent || '')
const contentLength = ref(0)

// 引用
const inlineInputRef = ref()
const editorRef = ref()

// UI状态
const showEmojiPicker = ref(false)
const showMentionDialog = ref(false)
const showLinkDialog = ref(false)
const hasSelection = ref(false)

// 文件管理
const attachedFiles = ref<AttachedFile[]>([])

// Computed for typed files (for template usage)
const typedAttachedFiles = computed(() => attachedFiles.value)

// 搜索和提及
const mentionSearch = ref('')
const mentionResults = ref<User[]>([])

// 链接数据
const linkData = ref({
  text: '',
  url: ''
})

// Message type options
type MessageType = 'text' | 'notice' | 'announcement' | 'private'
type MessagePriority = 'normal' | 'important' | 'urgent'

// 消息选项
const messageOptions = ref<{
  type: MessageType
  priority: MessagePriority
  scheduled: boolean
  scheduledTime: number | null
}>({
  type: 'text',
  priority: 'normal',
  scheduled: false,
  scheduledTime: null
})

// 编辑历史
const editHistory = ref<EditHistoryItem[]>([])

// 选项
const messageTypeOptions: Array<{ label: string; value: MessageType }> = [
  { label: '普通消息', value: 'text' },
  { label: '通知消息', value: 'notice' },
  { label: '公告消息', value: 'announcement' },
  { label: '私密消息', value: 'private' }
]

const priorityOptions: Array<{ label: string; value: MessagePriority }> = [
  { label: '普通', value: 'normal' },
  { label: '重要', value: 'important' },
  { label: '紧急', value: 'urgent' }
]

const popularTags = ref(['技术', '产品', '设计', '运营', '市场', '客服'])

// 计算属性
const canSave = computed(() => {
  return editContent.value.trim().length > 0 && !isSaving.value
})

const historyOptions = computed(() => {
  return editHistory.value.map((edit: EditHistoryItem, index: number) => ({
    label: `版本 ${editHistory.value.length - index} - ${new Date(edit.timestamp).toLocaleString()}`,
    key: edit.eventId
  }))
})

// ========== 方法 ==========

const formatFileSize = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`
}

const getRoomName = (roomId: string): string => {
  // 从store中获取房间名称
  return `房间 ${roomId.slice(0, 8)}`
}

// ========== 编辑功能 ==========

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    if (event.ctrlKey || event.metaKey) {
      // Ctrl+Enter 发送消息
      event.preventDefault()
      saveMessage()
    }
  }
}

const handleFocus = () => {
  hasSelection.value = true
}

const handleBlur = () => {
  hasSelection.value = false
}

const formatText = (command: string) => {
  if (inlineInputRef.value) {
    const textarea = inlineInputRef.value.inputElRef?.querySelector('textarea')
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const selectedText = editContent.value.substring(start, end)

      let formattedText = selectedText
      switch (command) {
        case 'bold':
          formattedText = `**${selectedText}**`
          break
        case 'italic':
          formattedText = `*${selectedText}*`
          break
        case 'underline':
          formattedText = `__${selectedText}__`
          break
      }

      editContent.value = editContent.value.substring(0, start) + formattedText + editContent.value.substring(end)
    }
  }
}

// ========== 富文本编辑器 ==========

const handleRichInput = () => {
  if (editorRef.value) {
    contentLength.value = editorRef.value.innerText.length
  }
}

const handleRichKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Tab') {
    event.preventDefault()
    document.execCommand('insertText', false, '  ')
  }
}

const handlePaste = (event: ClipboardEvent) => {
  event.preventDefault()
  const text = event.clipboardData?.getData('text/plain')
  if (text) {
    document.execCommand('insertText', false, text)
  }
}

const handleDrop = (event: DragEvent) => {
  event.preventDefault()
  const files = event.dataTransfer?.files
  if (files) {
    handleFileDrop(files)
  }
}

const execCommand = (command: string, value?: string) => {
  document.execCommand(command, false, value)
  hasSelection.value = isCommandActive(command)
}

const isCommandActive = (command: string): boolean => {
  return document.queryCommandState(command)
}

const insertHeading = (level: string) => {
  const selection = window.getSelection()
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0)
    const heading = document.createElement(level)
    heading.textContent = selection.toString() || '标题'
    range.deleteContents()
    range.insertNode(heading)
    range.collapse(false)
  }
}

const insertLink = () => {
  showLinkDialog.value = true
  const selection = window.getSelection()
  if (selection && selection.toString()) {
    linkData.value.text = selection.toString()
  }
}

const confirmLink = () => {
  const selection = window.getSelection()
  if (selection && linkData.value.url) {
    const link = document.createElement('a')
    link.href = linkData.value.url
    link.textContent = linkData.value.text || linkData.value.url
    link.target = '_blank'

    const range = selection.getRangeAt(0)
    range.deleteContents()
    range.insertNode(link)
  }
  showLinkDialog.value = false
  linkData.value = { text: '', url: '' }
}

const insertCode = () => {
  const selection = window.getSelection()
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0)
    const code = document.createElement('code')
    code.textContent = selection.toString() || '代码'
    range.deleteContents()
    range.insertNode(code)
  }
}

const insertQuote = () => {
  const selection = window.getSelection()
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0)
    const blockquote = document.createElement('blockquote')
    blockquote.textContent = selection.toString() || '引用'
    range.deleteContents()
    range.insertNode(blockquote)
  }
}

// ========== 表情和提及 ==========

const insertEmoji = (emoji: string) => {
  editContent.value += emoji
}

const insertEmojiToEditor = (emoji: string) => {
  if (editorRef.value) {
    document.execCommand('insertText', false, emoji)
  }
  showEmojiPicker.value = false
}

const searchUsers = () => {
  // 模拟用户搜索
  mentionResults.value = [
    { id: '1', name: 'Alice Chen', avatar: '', status: '在线' },
    { id: '2', name: 'Bob Smith', avatar: '', status: '忙碌' },
    { id: '3', name: 'Charlie Wang', avatar: '', status: '离开' }
  ].filter((user) => user.name.toLowerCase().includes(mentionSearch.value.toLowerCase()))
}

const insertMention = (user: User) => {
  if (editorRef.value) {
    document.execCommand('insertText', false, `@${user.name} `)
  }
}

const insertInlineMention = (user: User) => {
  editContent.value += `@${user.name} `
  showMentionDialog.value = false
}

const insertTag = (tag: string) => {
  if (editorRef.value) {
    document.execCommand('insertText', false, `#${tag} `)
  }
}

// ========== 文件管理 ==========

const beforeUpload = (data: unknown) => {
  const uploadData = data as { file: { file?: File; size?: number } }
  const file = uploadData.file.file || uploadData.file
  const size = file.size || 0
  const isLt10M = size < 10 * 1024 * 1024
  if (!isLt10M) {
    msg.error('文件大小不能超过10MB')
    return false
  }
  return true
}

const handleFileUpload = (data: unknown) => {
  const uploadData = data as { file: AttachedFile }
  attachedFiles.value.push(uploadData.file)
}

const handleFileDrop = (files: FileList) => {
  Array.from(files).forEach((file) => {
    if (beforeUpload({ file })) {
      attachedFiles.value.push({
        id: Date.now().toString() + Math.random(),
        name: file.name,
        size: file.size,
        type: file.type,
        file: file
      })
    }
  })
}

const removeFile = (data: unknown) => {
  const uploadData = data as { file: AttachedFile; fileList: unknown[]; index: number }
  const id = uploadData.file?.id
  const index = attachedFiles.value.findIndex((f) => (f as AttachedFile).id === id)
  if (index > -1) attachedFiles.value.splice(index, 1)
}

// ========== 消息操作 ==========

const saveMessage = async () => {
  if (!canSave.value) return

  isSaving.value = true
  try {
    const messageData: Record<string, unknown> = {
      roomId: props.roomId,
      content: editorRef.value?.innerHTML || editContent.value,
      type: messageOptions.value.type,
      timestamp: Date.now(),
      attachments: attachedFiles.value.map((file) => {
        const f = file as AttachedFile
        return {
          id: f.id,
          name: f.name,
          size: f.size,
          type: f.type,
          url: f.url || (f.file ? URL.createObjectURL(f.file) : undefined)
        }
      })
    }

    if (isEditing.value && props.messageId) {
      // 更新现有消息
      const content = String(messageData.content || '')
      await messageManager.editMessage(props.roomId!, props.messageId, content)
      emit('message-updated', messageData)
      msg.success('消息已更新')
    } else {
      // 发送新消息
      emit('message-sent', messageData)
      msg.success('消息已发送')
    }

    // 清空编辑器
    editContent.value = ''
    attachedFiles.value = []
    if (editorRef.value) {
      editorRef.value.innerHTML = DOMPurify.sanitize('')
    }

    // 如果是内联编辑器，触发关闭
    if (props.inline) {
      emit('closed')
    }
  } catch (error) {
    logger.error('Failed to save message:', error)
    msg.error('保存消息失败')
  } finally {
    isSaving.value = false
  }
}

const cancelEdit = () => {
  if (isEditing.value) {
    emit('edit-cancelled')
  } else {
    emit('closed')
  }
}

const saveDraft = () => {
  // 保存到本地存储
  const draft = {
    content: editorRef.value?.innerHTML || editContent.value,
    attachments: attachedFiles.value,
    options: messageOptions.value,
    timestamp: Date.now()
  }

  localStorage.setItem(`message-draft-${props.roomId}`, JSON.stringify(draft))
  msg.success('草稿已保存')
}

const restoreFromHistory = (eventId: string) => {
  const list = editHistory.value as unknown as MessageEdit[]
  const edit = list.find((x) => x.eventId === eventId)
  if (edit) {
    editContent.value = edit.newContent.body || ''
  }
}

// ========== UI控制 ==========

const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value
}

const closeEditor = () => {
  emit('closed')
}

// ========== 生命周期 ==========

onMounted(() => {
  // 加载草稿
  if (props.roomId) {
    const draft = localStorage.getItem(`message-draft-${props.roomId}`)
    if (draft) {
      const draftData = JSON.parse(draft)
      editContent.value = draftData.content
      attachedFiles.value = draftData.attachments || []
      messageOptions.value = draftData.options || messageOptions.value
    }
  }

  // 如果是编辑模式，加载原始消息内容
  if (isEditing.value && props.messageId) {
    // 加载消息编辑历史
    // editHistory.value = messageManager.getMessageEditHistory(props.messageId)
  }

  // 自动聚焦
  nextTick(() => {
    if (props.inline) {
      inlineInputRef.value?.focus()
    } else {
      editorRef.value?.focus()
    }
  })
})

watch(
  () => props.initialContent,
  (newContent) => {
    if (newContent) {
      editContent.value = newContent
      if (editorRef.value) {
        editorRef.value.innerHTML = DOMPurify.sanitize(newContent)
      }
    }
  }
)
</script>

<style lang="scss" scoped>
.message-editor {
  position: relative;

  &.is-inline {
    width: 100%;
    max-width: 600px;
  }

  &.is-fullscreen {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--bg-color);
    z-index: 1000;
    display: flex;
    flex-direction: column;
  }
}

.inline-editor {
  .edit-input {
    .n-input {
      margin-bottom: 8px;
    }

    .edit-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      gap: 12px;

      .toolbar-left,
      .toolbar-right {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .char-count {
        font-size: 12px;
        color: var(--text-color-3);
      }
    }
  }

  .attached-files {
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;

    .file-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px;
      background: var(--card-color);
      border: 1px solid var(--border-color);
      border-radius: 8px;

      .file-preview {
        color: var(--text-color-2);
      }

      .file-info {
        flex: 1;
        min-width: 0;

        .file-name {
          font-weight: 500;
          color: var(--text-color-1);
          margin-bottom: 2px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .file-size {
          font-size: 12px;
          color: var(--text-color-3);
        }
      }
    }
  }

  .edit-history {
    margin-top: 8px;
    display: flex;
    justify-content: flex-end;
  }
}

.fullscreen-editor {
  display: flex;
  flex-direction: column;
  height: 100vh;

  .editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 24px;
    border-bottom: 1px solid var(--border-color);

    .header-left {
      h3 {
        margin: 0 0 4px 0;
        font-size: 18px;
        font-weight: 600;
        color: var(--text-color-1);
      }

      .room-info {
        font-size: 14px;
        color: var(--text-color-3);
      }
    }

    .header-right {
      display: flex;
      gap: 8px;
    }
  }

  .editor-content {
    flex: 1;
    display: flex;
    overflow: hidden;

    .rich-editor {
      flex: 1;
      display: flex;
      flex-direction: column;
      position: relative;

      .editor-area {
        flex: 1;
        padding: 24px;
        overflow-y: auto;
        font-size: 16px;
        line-height: 1.6;
        outline: none;
        min-height: 200px;

        &:focus {
          background: var(--bg-color-hover);
        }
      }

      .format-toolbar {
        padding: 12px 24px;
        border-top: 1px solid var(--border-color);
        border-bottom: 1px solid var(--border-color);
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;

        .n-button.active {
          background: var(--primary-color);
          color: white;
        }
      }

      .emoji-picker {
        position: absolute;
        bottom: 60px;
        right: 24px;
        z-index: 10;
      }
    }

    .editor-sidebar {
      width: 300px;
      background: var(--card-color);
      border-left: 1px solid var(--border-color);
      padding: 20px;
      overflow-y: auto;

      .sidebar-section {
        margin-bottom: 32px;

        h4 {
          margin: 0 0 12px 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-color-1);
        }

        .n-button {
          margin-bottom: 8px;
        }
      }

      .mention-results {
        margin-top: 12px;
        max-height: 200px;
        overflow-y: auto;

        .mention-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px;
          border-radius: 6px;
          cursor: pointer;
          transition: background-color 0.2s ease;

          &:hover {
            background: var(--bg-color-hover);
          }

          .mention-info {
            flex: 1;

            .mention-name {
              font-weight: 500;
              color: var(--text-color-1);
              margin-bottom: 2px;
            }

            .mention-status {
              font-size: 12px;
              color: var(--text-color-3);
            }
          }
        }
      }
    }
  }

  .editor-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 24px;
    border-top: 1px solid var(--border-color);

    .footer-left,
    .footer-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .char-count {
      font-size: 12px;
      color: var(--text-color-3);
    }
  }
}

.mention-list {
  max-height: 300px;
  overflow-y: auto;
  margin-top: 16px;

  .mention-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.2s ease;

    &:hover {
      background: var(--bg-color-hover);
    }

    .mention-info {
      flex: 1;

      .mention-name {
        font-weight: 600;
        color: var(--text-color-1);
        margin-bottom: 4px;
      }

      .mention-status {
        font-size: 14px;
        color: var(--text-color-3);
      }
    }
  }
}

// 响应式设计
@media (max-width: 768px) {
  .fullscreen-editor {
    .editor-content {
      flex-direction: column;

      .editor-sidebar {
        width: 100%;
        max-height: 300px;
        border-left: none;
        border-top: 1px solid var(--border-color);
      }
    }

    .editor-footer {
      flex-direction: column;
      gap: 12px;
      align-items: stretch;

      .footer-left,
      .footer-right {
        justify-content: center;
      }
    }
  }

  .inline-editor {
    .edit-toolbar {
      flex-direction: column;
      gap: 12px;
      align-items: stretch;

      .toolbar-left,
      .toolbar-right {
        justify-content: center;
      }
    }
  }
}
</style>
