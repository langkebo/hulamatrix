import type { Ref } from 'vue'

/** @人员列表项类型 */
export interface PersonListItem {
  userId: string
  displayName: string
  avatar?: string
  [key: string]: unknown
}

/** @回复消息类型 */
export interface ReplyMessage {
  messageId: string
  eventId: string
  content: unknown
  sender?: {
    userId: string
    displayName: string
  }
  [key: string]: unknown
}

/** @菜单项类型 */
export interface MenuItem {
  key: string
  label: string
  icon?: string
  action?: () => void
  [key: string]: unknown
}

/** @编辑器范围类型 */
export interface EditorRange {
  start: number
  end: number
  [key: string]: unknown
}

/** @位置信息类型 */
export interface LocationInfo {
  latitude: number
  longitude: number
  address?: string
  [key: string]: unknown
}

/** @表情信息类型 */
export interface EmojiInfo {
  key: string
  value: string
  category?: string
  [key: string]: unknown
}

export type UseMsgInputReturn = {
  msgInput: Ref<string>
  disabledSend: Ref<boolean>
  chatKey: Ref<string>
  ait: Ref<boolean>
  aitKey: Ref<string>
  selectedAitKey: Ref<string>
  personList: Ref<PersonListItem[]>
  reply: Ref<ReplyMessage | null>
  menuList: Ref<MenuItem[]>
  editorRange: Ref<EditorRange | null>
  isChinese: Ref<boolean>
  send: () => Promise<void>
  sendFilesDirect: (_files?: File[]) => Promise<void>
  sendVoiceDirect: (_file?: File) => Promise<void>
  sendLocationDirect: (_loc?: LocationInfo) => Promise<void>
  sendEmojiDirect: (_emoji?: EmojiInfo) => Promise<void>
  handleInput: (_e: InputEvent) => void
  inputKeyDown: (_e: KeyboardEvent) => void
  handleAit: (_item?: PersonListItem) => void
  stripHtml: (html: string) => string
  resetInput: () => void
  focusOn: (dom?: HTMLElement) => void
  getCursorSelectionRange: () => EditorRange | null
  updateSelectionRange: (_range: EditorRange | null) => void
  extractAtUserIds: () => string[]
}
