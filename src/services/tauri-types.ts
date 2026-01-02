/**
 * Tauri 命令类型定义
 */

import type { MessageBody, SessionItem } from './types'

// 通用的 Tauri 命令响应类型
export interface TauriResponse<T = unknown> {
  success: boolean
  code: number
  msg: string
  data: T
}

// 获取房间成员响应
export interface GetRoomMembersResponse {
  members: Array<{
    userId: string
    roomId: string
    membership: string
    power?: number
    avatar?: string
    name?: string
  }>
  total: number
}

// 分页查询房间响应
export interface PageRoomResponse {
  list: Array<{
    roomId: string
    name: string
    avatar?: string
    type: string
    memberCount: number
    lastMsg?: {
      content: string
      sendTime: number
      senderName: string
    }
  }>
  total: number
  cursor?: string
  hasMore: boolean
}

// 分页查询房间成员响应
export interface CursorPageRoomMembersResponse {
  members: Array<{
    userId: string
    roomId: string
    membership: string
    power?: number
    avatar?: string
    name?: string
  }>
  cursor?: string
  hasMore: boolean
}

// 会话列表响应
export interface ListContactsResponse {
  sessions: SessionItem[]
  total: number
}

// 发送消息参数
export interface SendMsgParams {
  roomId: string
  type: string
  body: MessageBody
  clientId?: string
  localId?: string
}

// 发送消息响应
export interface SendMsgResponse {
  messageId: string
  timestamp: number
}

// 保存用户信息参数
export interface SaveUserInfoParams {
  avatar?: string
  name?: string
  email?: string
  phone?: string
  bio?: string
}

// 获取用户 tokens 响应
export interface GetUserTokensResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

// 更新用户最后操作时间参数
export interface UpdateUserLastOptTimeParams {
  lastOptTime: number
}

// 保存消息标记参数
export interface SaveMessageMarkParams {
  messageId: string
  markType: number
  markStatus: number
}

// 删除消息参数
export interface DeleteMessageParams {
  messageId: string
  roomId: string
}

// 删除房间消息参数
export interface DeleteRoomMessagesParams {
  roomId: string
  messageId?: string
}

// 更新消息撤回状态参数
export interface UpdateMessageRecallStatusParams {
  messageId: string
  recallStatus: number
}

// 文件上传参数
export interface UploadFileParams {
  file: File
  roomId?: string
  type?: string
  onProgress?: (progress: number) => void
}

// 文件上传响应
export interface UploadFileResponse {
  url: string
  filename: string
  size: number
  mimeType: string
}

// 网络请求参数
export interface NetworkRequestParams {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  params?: Record<string, unknown>
  data?: unknown
  headers?: Record<string, string>
}

// 网络请求响应
export interface NetworkResponse<T = unknown> {
  data: T
  status: number
  statusText: string
  headers?: Record<string, string>
}

// 缓存操作参数
export interface CacheOperationParams {
  key: string
  value?: unknown
  ttl?: number
}

// 缓存操作响应
export interface CacheOperationResponse {
  success: boolean
  value?: unknown
  exists?: boolean
}
