import type { Ref } from 'vue'
import { MessageStatusEnum, MsgEnum } from '@/enums'
import type { MessageType } from '@/services/types'
import { UploadProviderEnum } from '@/hooks/useUpload'
import { useGroupStore } from '@/stores/group'
import { AppException } from '@/common/exception'

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 回复消息类型
 */
export interface ReplyMessage {
  messageId: string
  senderId: string
  content: string
  type?: MsgEnum
  key?: string
}

/**
 * 消息体基础类型
 */
export interface MessageBody {
  content?: string
  [key: string]: unknown
}

/**
 * 全局 Store 接口
 * 兼容 Pinia Store 类型
 */
export interface GlobalStoreState {
  currentSessionRoomId?: string
  unReadMark?: {
    newFriendUnreadCount: number
    newMsgUnreadCount: number
    newGroupUnreadCount: number
  }
  currentSession?: { id: string } | null
  [key: string]: unknown
}

/**
 * 上传配置
 */
export interface UploadConfig {
  provider?: UploadProviderEnum
  token?: string
  [key: string]: unknown
}

/**
 * 上传进度信息
 */
export interface UploadProgressInfo {
  progress: number
  onChange: (progress: number) => void
}

/**
 * 七牛上传结果
 */
export interface QiniuUploadResult {
  qiniuUrl?: string
  [key: string]: unknown
}

/**
 * 上传结果
 */
export interface UploadResult {
  uploadUrl: string
  downloadUrl: string
  config?: UploadConfig
}

// ============================================================================
// 消息策略接口
// ============================================================================

/**
 * 消息策略接口
 */
export interface MessageStrategy {
  getMsg: (msgInputValue: string, replyValue?: ReplyMessage, fileList?: File[]) => MessageBody | Promise<MessageBody>
  buildMessageBody: (msg: MessageBody, reply?: ReplyMessage) => MessageBody
  buildMessageType: (
    messageId: string,
    messageBody: MessageBody,
    globalStore: GlobalStoreState,
    userUid: Ref<string | number | undefined>
  ) => MessageType
  uploadFile?: (path: string, options?: { provider?: UploadProviderEnum }) => Promise<UploadResult>
  getUploadProgress?: () => UploadProgressInfo
}

/**
 * 用户信息类型
 */
export interface UserInfo {
  uid: string
  name?: string
  avatar?: string
  locPlace?: string
  [key: string]: unknown
}

/**
 * 消息策略抽象类，所有消息策略都必须实现这个接口
 */
export abstract class AbstractMessageStrategy implements MessageStrategy {
  public readonly msgType: MsgEnum

  constructor(msgType: MsgEnum) {
    this.msgType = msgType
  }

  buildMessageType(
    messageId: string,
    messageBody: MessageBody,
    globalStore: GlobalStoreState,
    userUid: Ref<string | number | undefined>
  ): MessageType {
    const currentTime = new Date().getTime()
    const groupStore = useGroupStore()
    const userIdValue = String(userUid.value || 0)
    const userInfo = groupStore.getUserInfo(userIdValue)

    return {
      fromUser: {
        uid: userIdValue,
        username: userInfo?.name || '',
        avatar: userInfo?.avatar || '',
        locPlace: userInfo?.locPlace || ''
      },
      message: {
        id: messageId,
        roomId: globalStore.currentSessionRoomId || '',
        sendTime: currentTime,
        status: MessageStatusEnum.PENDING,
        type: this.msgType,
        body: messageBody,
        messageMarks: {}
      },
      sendTime: Date.now(),
      loading: false
    }
  }

  abstract buildMessageBody(msg: MessageBody, reply?: ReplyMessage): MessageBody
  abstract getMsg(
    msgInputValue: string,
    replyValue?: ReplyMessage,
    fileList?: File[]
  ): MessageBody | Promise<MessageBody>

  uploadFile?(path: string, options?: { provider?: UploadProviderEnum }): Promise<UploadResult> {
    void path
    void options
    throw new AppException('该消息类型不支持文件上传')
  }
}
