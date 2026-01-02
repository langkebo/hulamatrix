import type { Ref, ComputedRef } from 'vue'
import type { UserItem } from '@/services/types'

/**
 * 文件处理结果
 */
export interface FileProcessResult {
  success: boolean
  processedFile?: File
  thumbnailFile?: File
  error?: string
  type?: string
}

/**
 * 编辑器范围信息
 */
export interface EditorRange {
  range: Range
  selection: Selection
}

/** Reply message information */
export interface ReplyMessage {
  messageId: string
  senderId?: string
  senderName?: string
  content?: string
  [key: string]: unknown
}

/** Menu item */
export interface MenuItem {
  label: string
  value: string
  icon?: string
  [key: string]: unknown
}

/** Topic item */
export interface TopicItem {
  id: string
  name: string
  [key: string]: unknown
}

/**
 * 消息输入状态
 */
export interface MessageInputState {
  // 输入框相关
  msgInput: Ref<string>
  disabledSend: ComputedRef<boolean>
  chatKey: Ref<string>

  // @提及相关
  ait: Ref<boolean>
  aitKey: Ref<string>
  selectedAitKey: Ref<string>
  personList: ComputedRef<UserItem[]>

  // 其他
  reply: Ref<ReplyMessage | null>
  menuList: Ref<MenuItem[]>
  editorRange: Ref<EditorRange | null>
  isChinese: Ref<boolean>

  // 话题相关
  topicDialogVisible: Ref<boolean>
  topicKeyword: Ref<string>
  topicList: Ref<TopicItem[]>
}

/**
 * 消息发送功能
 */
export interface MessageSendFunctions {
  send: () => Promise<void>
  sendFilesDirect: (files: File[]) => Promise<void>
  sendVoiceDirect: (voiceData: unknown) => Promise<void>
  sendLocationDirect: (locationData: unknown) => Promise<void>
  sendEmojiDirect: (emojiUrl: string) => Promise<void>
}

/**
 * 输入事件处理
 */
export interface InputEventHandlers {
  handleInput: (e: Event) => void
  inputKeyDown: (e: KeyboardEvent) => void
  handleAit: (item: UserItem) => void
}

/**
 * 工具函数
 */
export interface InputUtils {
  stripHtml: (html: string) => string
  resetInput: () => void
  focusOn: (editor: HTMLElement) => void
  getCursorSelectionRange: () => EditorRange | null
  updateSelectionRange: () => void
  extractAtUserIds: (content: string, userList: UserItem[]) => string[]
}

/**
 * useMsgInput 返回类型
 */
export type UseMsgInputReturn = MessageInputState & MessageSendFunctions & InputEventHandlers & InputUtils
