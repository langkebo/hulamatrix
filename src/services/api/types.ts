/**
 * Unified API Types
 * Central type definitions for all API services
 */

// Auth API Types
export interface LoginParams {
  username: string
  password: string
  deviceId?: string
}

export interface ForgotPasswordParams {
  email: string
  newPassword: string
  // TODO: Add missing params
  // code?: string
  // uuid?: string
  // confirmPassword?: string
}

export interface CaptchaParams {
  phone?: string
  email?: string
  uuid?: string
  operationType?: string
  templateCode?: string
}

export interface RegisterParams {
  username: string
  password: string
  email?: string
  phone?: string
  captcha?: string
  deviceId?: string
}

export interface RegisterResponse {
  code: number
  data?: {
    uid?: string
    userId?: string
    accessToken?: string
    deviceId?: string
  }
}

export interface CaptchaResponse {
  code: number
  data?: {
    ticket: string
  }
}

export interface LogoutParams {
  autoLogin?: boolean
}

// Friends API Types
export interface SearchFriendParams {
  keyword: string
  page?: number
  limit?: number
}

export interface SendFriendRequestParams {
  userId: string
  message?: string
}

export interface FriendResponse {
  code: number
  data?: {
    friends?: unknown[]
    groups?: unknown[]
  }
}

export interface DeleteFriendParams {
  userId: string
}

export interface ModifyFriendRemarkParams {
  userId: string
  remark: string
}

export interface GetFriendPageParams {
  page?: number
  limit?: number
}

// Groups API Types
export interface CreateGroupParams {
  name: string
  avatar?: string
  uidList: string[]
}

export interface RemoveGroupMemberParams {
  roomId: string
  userId: string
}

export interface UpdateMyRoomInfoParams {
  roomId: string
  displayName?: string
  avatarUrl?: string
}

export interface ApplyGroupParams {
  msg?: string
  account: string
  type?: number
}

export interface ExitGroupParams {
  roomId: string
}

export interface InviteGroupMemberParams {
  roomId: string
  uidList: string[]
}

// Messages API Types
export interface RecallMessageParams {
  roomId: string
  eventId: string
  reason?: string
}

export interface GetMsgReadCountParams {
  roomId: string
  eventId: string
}

export interface MsgReadCountResponse {
  code: number
  data?: {
    count: number
  }
}

export interface MarkMsgReadParams {
  roomId: string
}

export interface GetSessionDetailParams {
  id: string
}

export interface GetSessionDetailWithFriendsParams {
  id: string
  roomType?: number
}

export interface MarkMsgParams {
  msgId: string
  markType: number
  actType: number
  roomId?: string
}

// User API Types
export interface ModifyUserInfoParams {
  displayName?: string
  avatarUrl?: string
  customData?: Record<string, unknown>
}

export interface SetUserBadgeParams {
  badgeId: string
  roomId?: string
}

export interface Badge {
  id: string
  name: string
  url: string
}

export interface ChangeUserStateParams {
  id: number | string
}

export interface GetUserByIdsParams {
  userIds: string[]
}

export interface UserBasicInfo {
  userId: string
  displayName?: string
  avatarUrl?: string
}

// SystemConfig API Types
export interface SetSessionTopParams {
  roomId: string
  top: boolean
}

export interface ShieldParams {
  roomId: string
  state: boolean
}

export interface NotificationParams {
  roomId: string
  type: number
}

export interface UpdateRoomInfoParams {
  id: string
  avatar?: string
  name?: string
  allowScanEnter?: boolean
}

export interface InitConfigResponse {
  code: number
  data?: Record<string, unknown>
}

export interface GroupInfoResponse {
  code: number
  data?: {
    roomId?: string
    name?: string
    avatar?: string
    memberCount?: number
    [key: string]: unknown
  }
}

export interface EmojiResponse {
  code: number
  data?: {
    list: Array<{
      id: string
      name: string
      url: string
      category?: string
    }>
  }
}

export interface GroupListParams {
  page?: number
  limit?: number
}

export interface GroupListResponse {
  code: number
  data?: {
    list: GroupInfoResponse['data'][]
    total: number
  }
}

export interface GroupListMemberParams {
  roomId: string
  page?: number
  limit?: number
}

export interface GroupListMemberResponse {
  code: number
  data?: {
    list: Array<{
      userId: string
      displayName?: string
      avatarUrl?: string
      powerLevel?: number
      isAdmin?: boolean
    }>
    total: number
  }
}

export interface AdminParams {
  roomId: string
  uidList: string[]
}

export interface AddEmojiParams {
  expressionUrl: string
  category?: string
}

export interface DeleteEmojiParams {
  id: string
}

// QR Code API Types
export interface CheckQRStatusParams {
  qrId: string
  clientId: string
  deviceHash: string
  deviceType: string
}

export interface CheckQRStatusResponse {
  code: number
  status?: 'PENDING' | 'SCANNED' | 'CONFIRMED' | 'EXPIRED'
  data?: {
    uid?: string
    token?: string
    refreshToken?: string
  }
}

export type GenerateQRCodeParams = Record<string, never>

export interface GenerateQRCodeResponse {
  code: number
  data: {
    qrId: string
    deviceHash: string
    expireTime?: number
    deviceType?: string
    locPlace?: string
  }
}

export interface ScanQRCodeParams {
  qrId: string
}

export interface ScanQRCodeResponse {
  code: number
  data: {
    ip: string
    expireTime: number
    deviceType?: string
    locPlace?: string
  }
}

export interface ConfirmQRCodeParams {
  qrId: string
}

// Announcement API Types
export interface AnnouncementDetail {
  id: string
  roomId: string
  uid: string
  content: string
  top?: boolean
  createTime?: number
  updateTime?: number
}

export interface GetAnnouncementDetailParams {
  announcementId: string
}

export interface GetAnnouncementDetailResponse {
  code: number
  data?: AnnouncementDetail
}

export interface EditAnnouncementParams {
  announcementId: string
  content: string
  top?: boolean
}

export interface PushAnnouncementParams {
  roomId: string
  content: string
  top?: boolean
}

export interface DeleteAnnouncementParams {
  announcementId: string
}

// Message Merge API Types
export interface MergeMsgParams {
  roomIds: string[]
  type: number
  messageIds: string[]
  sourceRoomId?: string
}

// Common Response Types
export interface ApiResponse<T = unknown> {
  code: number
  data?: T
  message?: string
}

export interface ApiSuccessResponse<T = unknown> extends ApiResponse<T> {
  code: 200
  data: T
}

export interface ApiErrorResponse extends ApiResponse {
  code: number
  message: string
}
