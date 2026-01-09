/**
 * Group Call Interface - 类型定义
 */

import type { Ref, ComputedRef } from 'vue'
import type { MediaStream } from '@/types/rtc'

/** 群组配置 */
export interface GroupConfig {
  callType?: 'audio' | 'video'
  [key: string]: unknown
}

/** 当前用户 */
export interface CurrentUser {
  id: string
  name: string
  avatar?: string
  isHost?: boolean
  [key: string]: unknown
}

/** 建议的用户 */
export interface SuggestedUser {
  id: string
  name: string
  avatar?: string
  [key: string]: unknown
}

/** 通话参与者 */
export interface CallParticipant {
  userId: string
  name?: string
  avatar?: string
  isMuted?: boolean
  hasCamera?: boolean
  isHost?: boolean
  isSpeaking?: boolean
  stream?: MediaStream | null
}

/** 聊天消息 */
export interface ChatMessage {
  id: string
  senderId: string
  senderName: string
  content: string
  timestamp: number
}

/** 参与者加入数据 */
export interface ParticipantJoinedData {
  callId: string
  participant: CallParticipant
}

/** 参与者离开数据 */
export interface ParticipantLeftData {
  callId: string
  participant: CallParticipant
}

/** 消息接收数据 */
export interface MessageReceivedData {
  callId: string
  senderId: string
  senderName: string
  content: string
  timestamp: number
}

/** 说话状态变化数据 */
export interface SpeakingChangedData {
  callId: string
  participantId: string
  isSpeaking: boolean
}

/** 网络质量 */
export interface NetworkQuality {
  type: 'success' | 'warning' | 'error' | 'default'
  text: string
}

/** 参与者操作选项 */
export interface ParticipantActionOption {
  label: string
  key: string
  icon: () => string
  [key: string]: unknown
}

/** Composable 返回值 */
export interface UseGroupCallReturn {
  // 状态
  callState: Ref<'calling' | 'connected' | 'ended'>
  callDuration: Ref<number>
  isMinimized: Ref<boolean>
  isFullscreen: Ref<boolean>
  isSidebarCollapsed: Ref<boolean>
  isChatOpen: Ref<boolean>
  isConnected: Ref<boolean>
  localStream: Ref<MediaStream | null>
  isMuted: Ref<boolean>
  isCameraOff: Ref<boolean>
  isScreenSharing: Ref<boolean>
  isRecording: Ref<boolean>
  isTogglingScreenShare: Ref<boolean>
  isTogglingRecording: Ref<boolean>
  remoteParticipants: Ref<CallParticipant[]>
  suggestedUsers: Ref<SuggestedUser[]>
  chatMessages: Ref<ChatMessage[]>
  chatInput: Ref<string>
  unreadChatCount: Ref<number>
  showInviteDialog: Ref<boolean>
  showCallSettings: Ref<boolean>
  inviteInput: Ref<string>

  // 引用
  chatMessagesRef: Ref<HTMLElement | undefined>
  localVideoRef: Ref<HTMLVideoElement | undefined>

  // 计算属性
  currentUserId: ComputedRef<string>
  totalParticipants: ComputedRef<number>
  networkQuality: ComputedRef<NetworkQuality>

  // 通话控制
  startGroupCall: () => Promise<void>
  endCall: () => Promise<void>

  // 参与者管理
  inviteParticipant: () => Promise<void>
  selectInviteUser: (user: SuggestedUser) => void
  handleParticipantAction: (action: string, participant: CallParticipant) => Promise<void>

  // 聊天功能
  toggleChat: () => void
  sendChatMessage: () => Promise<void>

  // 媒体控制
  toggleMicrophone: () => void
  toggleCamera: () => void

  // 屏幕共享
  toggleScreenShare: () => Promise<void>

  // 录制
  toggleRecording: () => Promise<void>

  // UI控制
  toggleSidebar: () => void
  minimizeCall: () => void
  restoreCall: () => void
  toggleFullscreen: () => void

  // 工具方法
  getGridClass: () => string
  formatCallDuration: (seconds: number) => string
  formatMessageTime: (timestamp: number) => string
  getParticipantActions: (participant: CallParticipant) => ParticipantActionOption[]
}
