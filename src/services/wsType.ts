export enum WsType {
  HEARTBEAT = 'heartbeat',
  MESSAGE = 'message',
  STATUS = 'status',
  NOTIFICATION = 'notification'
}

export enum WsRequestMsgType {
  CALL_INVITE = 'call_invite',
  CALL_CANCEL = 'call_cancel',
  CALL_ANSWER = 'call_answer',
  CALL_REJECT = 'call_reject',
  CALL_HANGUP = 'call_hangup',
  HEARTBEAT = 'heartbeat',
  MESSAGE = 'message',
  VIDEO_CALL_REQUEST = 'video_call_request',
  VIDEO_CALL_RESPONSE = 'video_call_response',
  WEBRTC_SIGNAL = 'webrtc_signal'
}

export enum CallResponseStatus {
  INVITED = 'INVITED',
  ACCEPT = 'ACCEPT',
  REJECTED = 'REJECTED',
  DROPPED = 'DROPPED',
  BUSY = 'BUSY'
}

export enum WsResponseMessageType {
  VIDEO_CALL_REQUEST = 'VideoCallRequest',
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  MSG_RECALL = 'MSG_RECALL',
  MY_ROOM_INFO_CHANGE = 'MY_ROOM_INFO_CHANGE',
  REQUEST_NEW_FRIEND = 'REQUEST_NEW_FRIEND',
  NOTIFY_EVENT = 'NOTIFY_EVENT',
  WS_MEMBER_CHANGE = 'WS_MEMBER_CHANGE',
  MSG_MARK_ITEM = 'MSG_MARK_ITEM',
  REQUEST_APPROVAL_FRIEND = 'REQUEST_APPROVAL_FRIEND',
  ROOM_INFO_CHANGE = 'ROOM_INFO_CHANGE',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_USER = 'INVALID_USER',
  ONLINE = 'ONLINE',
  ROOM_DISSOLUTION = 'ROOM_DISSOLUTION',
  USER_STATE_CHANGE = 'USER_STATE_CHANGE',
  FEED_SEND_MSG = 'FEED_SEND_MSG',
  FEED_NOTIFY = 'FEED_NOTIFY',
  GROUP_SET_ADMIN_SUCCESS = 'GROUP_SET_ADMIN_SUCCESS',
  OFFLINE = 'OFFLINE',
  NO_INTERNET = 'NO_INTERNET',
  RECEIVE_MESSAGE = 'RECEIVE_MESSAGE',
  ROOM_GROUP_NOTICE_MSG = 'ROOM_GROUP_NOTICE_MSG',
  ROOM_EDIT_GROUP_NOTICE_MSG = 'ROOM_EDIT_GROUP_NOTICE_MSG',
  VIDEO_CALL_RESPONSE = 'VIDEO_CALL_RESPONSE',
  CANCEL = 'CANCEL',
  DROPPED = 'DROPPED',
  TIMEOUT = 'TIMEOUT',
  CALL_REJECTED = 'CallRejected',
  CALL_ACCEPTED = 'CallAccepted',
  ROOM_CLOSED = 'RoomClosed',
  WEBRTC_SIGNAL = 'webrtc_signal'
}

export interface WsConfig {
  url: string
  reconnectInterval: number
  maxReconnectAttempts: number
}

export interface LoginSuccessResType {
  uid: string
  account: string
  name: string
  avatar: string
  client: string
  token: string
  lastOptTime: number
}

export interface OnStatusChangeType {
  type: number
  uid: string
  roomId?: string
  onlineNum?: number
  lastOptTime?: number
}

export interface WsTokenExpire {
  uid: string
  client: string
  ip?: string
}

export interface VideoCallRequestType {
  callerUid: string
  isVideo: boolean
  roomId: string
  callType?: string
}

export interface RevokedMsgType {
  msgId: string
  roomId: string
  newMsgContent?: string
}

export interface MarkItemType {
  msgId: string
  markType: number
}

export interface WsMessage<T = any> {
  type: WsType
  data: T
  timestamp: number
}
