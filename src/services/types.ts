/**
 * 类型定义文件
 * 注意：请使用TSDoc规范进行注释，以便在使用时能够获得良好提示。
 * @see TSDoc规范https://tsdoc.org/
 **/
import type {
  ActEnum,
  IsYesEnum,
  MarkEnum,
  MessageStatusEnum,
  MsgEnum,
  NotificationTypeEnum,
  OnlineEnum,
  RoomTypeEnum,
  SessionOperateEnum,
  SexEnum
} from '../enums'

/**响应请求体*/
export type ServiceResponse<T = unknown> = {
  /** 成功标识true or false */
  success: boolean
  /** 状态码 */
  code: number
  /** 错误消息 */
  msg: string
  /** 数据 */
  data: T
  /** 版本号 */
  version: string
}

export type PageInfo<T> = {
  total: number
  size: number
  current: number
  records: T[]
}

/** 分页消息响应 */
export type PageMessagesResponse = {
  list: MsgType[]
  cursor: string
  hasMore?: boolean
  isLast?: boolean
}

/* ======================================================== */

export type LoginUserReq = {
  /** 账号 */
  account: string
  /** 密码 */
  password: string
  /** 登录方式 PC/MOBILE */
  deviceType: 'PC' | 'MOBILE'
  systemType: number
  grantType: 'CAPTCHA' | 'REFRESH_TOKEN' | 'PASSWORD' | 'MOBILE'
  key?: string
  code?: string
}

export type RegisterUserReq = {
  /** 默认随机头像 */
  avatar: string
  /** 昵称 */
  nickName: string
  /** 邮箱 */
  email: string
  /** 密码 */
  password: string
  /** 邮箱验证码 */
  code: string
  /** 识别码 */
  uuid: string
  key?: string
  confirmPassword: string
  systemType: number
}

/** 分页翻页 */
export type PageResponse<T> = {
  /** 总数 */
  total: string
  /** 总页数 */
  pages: string
  /** 当前页 */
  current: string
  /** 每页大小 */
  size: string
  /** 数据 */
  records: T[]
}

/** 游标翻页 */
export type ListResponse<T> = {
  /** 游标（下次翻页带上这参数）*/
  cursor: string
  /** 当前页数 */
  pageNo?: number
  /** 是否最后一页 */
  isLast: boolean
  list: T[]
}

export type CacheBadgeReq = {
  /** 最后更新时间 更新超过 10 分钟异步去更新。 */
  lastModifyTime?: number
  /** 徽章 ID */
  itemId: string
}

// ===== 群相关类型（保持兼容性） =====
export type GroupDetailReq = {
  /** 群头像 */
  avatar: string
  /** 群名称 */
  groupName: string
  /** 在线人数 */
  onlineNum: number
  /** 成员角色 1群主 2管理员 3普通成员 4踢出群聊 */
  roleId: number
  /** 房间id */
  roomId: string
  /** 群号 */
  account: string
  /** 群成员数 */
  memberNum: number
  /** 群备注 */
  remark: string
  /** 我的群昵称 */
  myName: string
  allowScanEnter: boolean
}

export type GroupListReq = {
  /** 群聊id */
  groupId: string
  /** 房间id */
  roomId: string
  /** 群名称 */
  roomName: string
  /** 群头像 */
  avatar: string
  /** 群备注 */
  remark?: string
}

// ===== 房间相关类型（Matrix SDK 映射） =====
export interface RoomDetail {
  /** 房间ID */
  roomId: string
  /** 房间名称 */
  name: string
  /** 房间主题 */
  topic?: string
  /** 房间头像 */
  avatar?: string
  /** 是否加密 */
  isEncrypted: boolean
  /** 加入规则 */
  joinRule: 'public' | 'invite' | 'knock'
  /** 访客访问权限 */
  guestAccess: 'can_join' | 'forbidden'
  /** 历史记录可见性 */
  historyVisibility: 'world_readable' | 'shared' | 'invited' | 'joined'
  /** 成员总数 */
  memberCount: number
  /** 在线成员数 */
  onlineCount: number
  /** 我的权限等级 */
  myPowerLevel: number
  /** 创建者ID */
  creatorId?: string
  /** 创建时间 */
  createdAt: number
  /** 房间别名 */
  alias?: string
  /** 我的昵称 */
  myDisplayName?: string
}

export interface RoomMember {
  /** 用户ID */
  userId: string
  /** 显示名称 */
  displayName: string
  /** 头像URL */
  avatarUrl?: string
  /** 权限等级 */
  powerLevel: number
  /** 成员状态 */
  membership: 'join' | 'invite' | 'leave' | 'ban'
  /** 加入时间 */
  joinedAt?: number
  /** 最后活跃时间 */
  lastActive?: number
  /** 角色 */
  role?: 'owner' | 'admin' | 'moderator' | 'member'
  /** 在线状态 */
  onlineStatus?: OnlineEnum
}

export interface CreateRoomOptions {
  /** 房间名称 */
  name: string
  /** 房间主题 */
  topic?: string
  /** 是否私有 */
  isPrivate?: boolean
  /** 房间别名 */
  alias?: string
  /** 邀请的用户列表 */
  invite?: string[]
  /** 管理员列表 */
  admins?: string[]
  /** 头像URL */
  avatar?: string
  /** 是否加密 */
  encryption?: boolean
  /** 预设类型 */
  preset?: 'private_chat' | 'public_chat' | 'trusted_private_chat'
}

export interface RoomPowerLevels {
  /** 用户权限级别 */
  users: Record<string, number>
  /** 默认用户权限 */
  users_default: number
  /** 事件权限 */
  events: Record<string, number>
  /** 默认事件权限 */
  events_default: number
  /** 默认状态事件权限 */
  state_default: number
  /** 踢人权限 */
  ban: number
  /** 移除权限 */
  kick: number
  /** 红撤权限 */
  redact: number
  /** 邀请权限 */
  invite: number
}

// ===== 搜索相关 =====
export type SearchRoom = {
  /** 房间ID */
  roomId: string
  /** 房间名称 */
  name: string
  /** 房间头像 */
  avatar: string
  /** 主题 */
  topic?: string
  /** 成员数 */
  numJoinedMembers: number
  /** 是否可加入 */
  worldReadable: boolean
  /** 房间别名 */
  roomAlias?: string
}

// ===== 权限级别常量 =====
export const ROOM_POWER_LEVELS = {
  OWNER: 100, // 房主
  ADMIN: 50, // 管理员
  MODERATOR: 10, // 协管员
  MEMBER: 0, // 普通成员
  DEFAULT: 50 // 默认邀请用户权限
} as const

export type CacheUserReq = {
  /** 最后更新时间 更新超过 10 分钟异步去更新。 */
  lastModifyTime?: number
  /** uid */
  uid: string
}

export type CacheUserItem = {
  /** 是否需要更新数据源。 */
  needRefresh?: boolean
  /** 最后更新时间 更新超过 10 分钟异步去更新。 */
  lastModifyTime: number
  /** 归属地 */
  locPlace: string
  /** 头像 */
  avatar: string
  /** 最后一次上下线时间 */
  lastOptTime: number
  /** 用户名称 */
  name: string
  /** uid */
  uid: string
  /** 用户状态 */
  userStateId: string
  /** 账号 */
  account: string
}

export type UserItem = {
  /** 在线状态 */
  activeStatus: OnlineEnum
  /** 头像 */
  avatar: string
  /** 最后一次上下线时间 */
  lastOptTime: number
  /** 用户名称 */
  name: string
  /** uid */
  uid: string
  /** 归属地 */
  locPlace?: string
  /** 角色ID */
  roleId?: number
  /** 账号 */
  account: string
  /** 我的群昵称 */
  myName?: string
  /** 当前佩戴的徽章 */
  wearingItemId?: string
  /** 徽章集合 */
  itemIds?: string[]
  /** 用户状态 */
  userStateId?: string
  /** 徽章信息 */
  badge?: {
    img: string
    describe: string
  }
}

export type GroupStatisticType = {
  /** 在线人数 */
  onlineNum: number
  /** 总人数 */
  totalNum: number
}

export type MessageReplyType = {
  /** 是否可消息跳转 0否 1是 */
  canCallback: number
  /** 是否可消息跳转 0否 1是 */
  content: string
  /** 跳转间隔的消息条数 */
  gapCount: number
  /** 消息id */
  id: string
  /** 用户名称 */
  username: string
}

export type MarkMsgReq = {
  // actType	动作类型 1确认 2取消
  actType: ActEnum
  // 标记类型 1点赞 2举报
  markType: MarkEnum
  // 消息 ID
  msgId: string
}

export type UserInfoType = {
  /** 用户唯一标识 */
  uid: string
  /** 用户账号 */
  account: string
  /** 邮箱 */
  email: string
  /** 密码 */
  password?: string
  /** 用户头像 */
  avatar: string
  /** 用户名 */
  name: string
  /** 剩余改名次数 */
  modifyNameChance: number
  /** 性别 1为男性，2为女性 */
  sex: SexEnum
  /** 权限 */
  power?: number
  /** 手机号 */
  phone?: string
  // DEPRECATED: Badge system is custom backend feature, not supported by Matrix
  // These fields are kept for backward compatibility but will always be undefined
  /** @deprecated Badge system not supported by Matrix */
  wearingItemId?: string
  /** @deprecated Badge system not supported by Matrix */
  itemIds?: string[]
  /** 用户状态id */
  userStateId: string
  /** 头像更新时间 */
  avatarUpdateTime: number
  /** 客户端 */
  client: string
  /** 个人简介 */
  resume: string
}

export type MarkItemType = {
  /** 操作用户 */
  uid: string
  /** 消息id */
  msgId: string
  /** 操作类型 */
  markType: MarkEnum
  /** 数量 */
  markCount: number
  /** 动作类型 1确认 2取消 */
  actType: ActEnum
}

export type RevokedMsgType = {
  /** 消息ID */
  msgId: string
  /** 会话ID */
  roomId?: string
  /** 撤回人ID */
  recallUid?: string
  messageId?: string
  operatorUid?: string
  recallTime?: number
}

export type EmojiItem = {
  expressionUrl: string
  id: string
}

// -------------------- ⬇消息体类型定义⬇ ----------------

/**
 * 消息返回体
 */
export type MessageType = {
  /** 发送者信息 */
  fromUser: MsgUserType
  /** 消息主体 */
  message: MsgType
  /** 发送时间 */
  sendTime: number
  /** 时间段（可选） */
  timeBlock?: number
  /** 是否加载中 */
  loading?: boolean
  uploadProgress?: number
  isCheck?: boolean
}

/**
 * 消息中用户信息
 */
export type MsgUserType = {
  /** 用户ID */
  uid: string
  /** 用户名 */
  username: string
  /** 头像 */
  avatar: string
  /** 归属地 */
  locPlace: string
  /** 徽章 */
  badge?: {
    /** 徽章地址 */
    img: string
    /** 描述 */
    describe: string // 描述
  }
}

/**
 * 消息互动信息
 */
export type MessageMarkType = Record<
  string,
  {
    /** 该表情的计数 */
    count: number
    /** 当前用户是否标记了该表情 */
    userMarked: boolean
  }
>

/** 图片消息体 */
export type ImageBody = {
  size: number
  url: string
  width: number
  height: number
  thumbnailPath?: string
}
/** 语音消息体 */
export type VoiceBody = {
  size: number
  second: number
  url: string
}

export type MergeBodyBody = {
  messageId: string
  uid: string
}

export type MergeBody = {
  body: MergeBodyBody[]
  content: string[]
}
/** 视频 */
export type VideoBody = {
  size: number
  url: string
  filename: string
  thumbSize?: number
  thumbWidth?: number
  thumbHeight?: number
  thumbUrl?: string
  thumbnailPath?: string
  localPath?: string
}
/** 文件消息体 */
export type FileBody = {
  size: number
  fileName: string
  url: string
  localPath?: string
}
/** 文本消息体 */
export type TextBody = {
  /** 消息内容 */
  content: string
  /** 回复 */
  reply: ReplyType
  /** @用户uid列表，用于精准渲染高亮 */
  atUidList?: string[] | null
  /**
   * 消息链接映射
   */
  urlContentMap: Record<
    string,
    {
      title: string
      description: string
      image: string
    }
  >
  /** 线程信息 */
  threadInfo?: {
    rootEventId: string
    threadId: string
    isRoot: boolean
    participant: string
  }
}
/** 公告消息体 */
export type AnnouncementBody = TextBody & {
  /** 公告ID */
  id: string
  /** 创建时间 */
  createTime: number
  /** 更新时间 */
  updateTime: number
}
/** 表情消息 */
export type EmojiBody = {
  url: string
  localPath?: string
}

/** 位置消息体 */
export type LocationBody = {
  /** 纬度 */
  latitude: string
  /** 经度 */
  longitude: string
  /** 地址描述 */
  address: string
  /** 精度描述 */
  precision: string
  /** 时间戳 */
  timestamp: string
}

/**
 * 消息体扩展属性
 * 运行时动态添加的可选属性
 */
export interface MessageBodyExtensions {
  /** 翻译文本 */
  translatedText?: { text: string; provider: string }
  /** 回复事件ID */
  replyEventId?: string
  /** 本地路径 */
  localPath?: string
  /** 文本内容 */
  text?: string
  /** 文件名 */
  fileName?: string
  /** 文件大小 */
  fileSize?: number
  /** 持续时间 */
  duration?: number
  /** URL */
  url?: string
  /** 本地文件预览URL */
  fileUrl?: string
  /** 缩略图URL */
  thumbnailUrl?: string
  /** 回复信息 */
  reply?: ReplyType
  /** 反应 */
  reactions?: Record<string, string[]> | Record<string, { count: number; users: string[] }>
  /** 描述 */
  description?: string
  /** 内容 */
  content?: string | unknown[]
  /** 地理信息 */
  geoUri?: string
  /** 经纬度 */
  latitude?: number
  longitude?: number
  /** @用户列表 */
  atUidList?: string[] | null
}

/**
 * 消息内容
 */
export type MessageBody =
  | (TextBody & Partial<MessageBodyExtensions>)
  | (ImageBody & Partial<MessageBodyExtensions>)
  | (VoiceBody & Partial<MessageBodyExtensions>)
  | (VideoBody & Partial<MessageBodyExtensions>)
  | (FileBody & Partial<MessageBodyExtensions>)
  | (EmojiBody & Partial<MessageBodyExtensions>)
  | (LocationBody & Partial<MessageBodyExtensions>)
  | (AnnouncementBody & Partial<MessageBodyExtensions>)
  | (MergeBody & Partial<MessageBodyExtensions>)
  | (Record<string, unknown> & Partial<MessageBodyExtensions>)
export type MsgType = {
  /** 消息ID */
  id: string
  /**  房间 ID */
  roomId: string
  /** 消息类型 */
  type: MsgEnum
  /** 动态消息体-`根据消息类型变化` */
  body: MessageBody
  /** 发送时间戳 */
  sendTime: number
  /** 消息互动信息 */
  messageMarks: MessageMarkType
  /** 消息发送状态 */
  status: MessageStatusEnum
  /** Matrix compatibility properties - optional */
  encrypted?: boolean
  /** Matrix compatibility properties - optional */
  fromUser?: { uid: string }
  /** Matrix compatibility properties - optional */
  message?: {
    id: string
    roomId: string
    sendTime: number
    type: MsgEnum
    body: MessageBody
    status: MessageStatusEnum
    [key: string]: unknown
  }
  /** Matrix compatibility properties - optional */
  isReply?: boolean
  /** 上传进度 */
  progress?: number
}

export type ReplyType = {
  id: string
  username: string
  uid?: string
  type: MsgEnum
  /** 根据不同类型回复的消息展示也不同-`过渡版` */
  body: MessageBody | Record<string, unknown>
  /**
   * 是否可消息跳转
   * @enum {number}  `0`否 `1`是
   */
  canCallback: number
  /** 跳转间隔的消息条数  */
  gapCount: number
  /** 图片数量（用于图片类型回复） */
  imgCount?: number
}

/**
 * 发送消息载体
 */
export type MessageReq = {
  /** 会话id */
  roomId: string
  /** 消息类型 */
  msgType: MsgEnum
  /** 消息体 */
  body: {
    /** 文本消息内容 */
    content?: string
    /** 回复的消息id */
    replyMsgId?: number
    /** 其他字段 */
    [key: string]: unknown
  }
}

/** 通知状态 */
export enum RequestNoticeAgreeStatus {
  /** 待审批 */
  UNTREATED = 0,
  /** 同意 */
  ACCEPTED,
  /** 拒绝 */
  REJECTED,
  /** 忽略 */
  IGNORE
}

/** 通知事件 */
export enum NoticeType {
  /** 好友申请 */
  FRIEND_APPLY = 1,
  /** 好友被申请 */
  ADD_ME = 6,
  /** 加群申请 */
  GROUP_APPLY = 2,
  /** 群邀请 */
  GROUP_INVITE = 3,
  /** 被邀请进群 */
  GROUP_INVITE_ME = 7,
  /** 移除群成员 */
  GROUP_MEMBER_DELETE = 5,
  /** 设置群管理员 */
  GROUP_SET_ADMIN = 8,
  /** 取消群管理员 */
  GROUP_RECALL_ADMIN = 9
}

/** 请求添加好友的列表项 */
export type RequestFriendItem = {
  /** 申请id */
  applyId: string
  /** 申请信息 */
  msg: string
  /** 申请状态 1待审批 2同意 3拒绝 4忽略 */
  status: RequestNoticeAgreeStatus
  /** 申请类型 1加好友 */
  type: number
  /** 申请人uid */
  uid: string
  /** 被申请人id */
  targetId: string
  /** 申请时间 */
  createTime: number
  /** 会话 ID */
  roomId: string
}

export interface NoticeItem {
  /** 实体ID */
  id?: string
  /** 通知类型:1-好友申请;2-群申请;3-群邀请;5-移除群成员;6-好友被申请;7-被邀请进群 */
  eventType: number
  /** 通知类型 1群聊 2加好友 */
  type: number
  /** 发起人UID */
  senderId: string
  /** 接收人UID */
  receiverId: string
  /** 申请ID */
  applyId: string
  /** 房间ID */
  roomId: string
  /** 被操作的人 */
  operateId?: string
  /** 通知内容 申请时填写的 */
  content: string
  /** 处理状态:0-未处理;1-已同意;2-已拒绝;3-忽略 */
  status: number
  /** 是否已读 */
  isRead: boolean
  /** 创建时间 */
  createTime?: number
}

/** 联系人的列表项 */
export type FriendItem = {
  /** 好友id */
  uid: string
  /** 好友备注 */
  remark: string
  /** 在线状态 1在线 2离线 */
  activeStatus: OnlineEnum
  /** 最后一次上下线时间 */
  lastOptTime: number
  /** 不让他看我（0-允许，1-禁止） */
  hideMyPosts: boolean
  /** 不看他（0-允许，1-禁止） */
  hideTheirPosts: boolean
}

/** 是否全员展示的会话 0否 1是 */
export enum IsAllUserEnum {
  /** 0否 */
  Not,
  /** 1是 */
  Yes
}

/** 会话列表项 */
export type SessionItem = {
  /** hula号 */
  account: string
  /** 房间最后活跃时间(用来排序) */
  activeTime: number
  /** 会话头像 */
  avatar: string
  /** 会话id */
  id: string
  /** 如果是单聊，则是对方的uid，如果是群聊，则是群id */
  detailId: string
  /** 是否全员展示的会话 0否 1是 */
  hotFlag: IsAllUserEnum
  /** 会话名称 */
  name: string
  /** 房间id */
  roomId: string
  /** 最新消息 */
  text: string
  /** 房间类型 1群聊 2单聊 */
  type: RoomTypeEnum
  /** 未读数 */
  unreadCount: number
  /** 是否置顶 0否 1是 */
  top: boolean
  /** 会话操作 */
  operate: SessionOperateEnum
  /** 在线状态 1在线 2离线 */
  activeStatus?: OnlineEnum
  /** 隐藏会话 */
  hide: boolean
  /** 免打扰类型 */
  muteNotification: NotificationTypeEnum
  /** 屏蔽消息 */
  shield: boolean
  /** 群成员数 */
  memberNum?: number
  /** 群备注 */
  remark?: string
  /** 我的群昵称 */
  myName?: string
  /** 是否选中（非后端） */
  isCheck?: boolean
  allowScanEnter: boolean
  /** 是否为 PrivateChat 会话（扩展字段） */
  isPrivateChat?: boolean
  /** PrivateChat session ID（扩展字段） */
  privateChatSessionId?: string
}

/** 消息已读未读数列表项 */
export type MsgReadUnReadCountType = {
  /** 消息 ID */
  msgId: string
  /** 已读数 */
  readCount: number
  /** 未读数 */
  unReadCount: number | null
}

/** 支持的翻译服务提供商类型  */
export type TranslateProvider = 'youdao' | 'tencent'

/** 修改用户基础信息的类型 */
export type ModifyUserInfoType = {
  name: string
  avatar: string
  sex?: number
  phone?: string
  resume?: string
  /** 昵称修改次数 */
  modifyNameChance: number
}

/** 登录 */
export type Login = {
  /** token */
  token: string
  /** 刷新token */
  refreshToken: string
  /** 客户端 */
  client: string
}

/** 用户状态 */
export type UserState = {
  /** id */
  id: string
  /** 标题 */
  title: string
  /** 链接 */
  url: string
  /** 背景颜色 */
  bgColor?: string
}

/** 搜索好友 */
export type SearchFriend = {
  /** 用户ID */
  uid: string
  /** 用户名 */
  name: string
  /** 头像 */
  avatar: string
  /** 账号 */
  account: string
}

/** 搜索群 */
export type SearchGroup = {
  /** 群ID */
  roomId: string
  /** 群名称 */
  name: string
  /** 头像 */
  avatar: string
  /** 账号 */
  account: string
  /** 额外信息 */
  extJson: string
  /** 是否删除 */
  deleteStatus: IsYesEnum
}

/** 配置 */
export type ConfigType = {
  /** logo */
  logo: string
  /** 系统名称 */
  name: string
  /** 七牛 */
  qiNiu: {
    /** oss域名 */
    ossDomain: string
    /** 分片大小 */
    fragmentSize: string
    /** 超过多少MB开启分片上传 */
    turnSharSize: string
  }
  /** 大群ID */
  roomGroupId: string
}

/** 群组公告 */
export type AnnouncementItem = {
  /** 公告ID */
  id: string
  /** 房间ID */
  roomId: string
  /** 发布者ID */
  uid: string
  /** 公告内容 */
  content: string
  /** 创建时间 */
  createdTime: number
  /** 是否置顶 */
  top: boolean
}

/* ======================================================== */
/**! 模拟信息数据的类型 */
export type MockItem = {
  key: number
  type: RoomTypeEnum
  avatar: string
  accountId: number
  accountName: string
}

export type FilesMeta = {
  name: string
  path: string
  file_type: string
  mime_type: string
  exists: boolean
}[]

export type RightMouseMessageItem = {
  createId: string | null
  updateId: string | null
  fromUser: {
    uid: string
    nickname: string | null
  }
  message: {
    id: string
    roomId: string
    sendTime: number
    type: number
    body: {
      size: string
      url: string
      fileName: string
      replyMsgId: string | null
      atUidList: string[] | null
      reply: ReplyType | Record<string, unknown> | null // 可进一步细化
    }
    messageMarks: {
      [key: string]: {
        count: number
        userMarked: boolean
      }
    }
  }
  createTime: number | null
  updateTime: number | null
  _index: number
}

export type DetailsContent = {
  type: 'apply'
  applyType: 'friend' | 'group'
}

/**
 * 媒体类型枚举
 */
export enum MediaType {
  TEXT = 0, // 纯文本
  IMAGE = 1, // 图片
  VIDEO = 2 // 视频
}

/**
 * 朋友圈权限枚举
 */
export enum FeedPermission {
  PRIVACY = 'privacy', // 私密
  OPEN = 'open', // 公开
  PART_VISIBLE = 'partVisible', // 部分可见
  NOT_ANYONE = 'notAnyone' // 不给谁看
}

// Re-export Matrix types for convenience
export type { MatrixCredentials } from '../types/matrix'

// Re-export enums for convenience
export {
  MsgEnum,
  MessageStatusEnum,
  ActEnum,
  IsYesEnum,
  MarkEnum,
  NotificationTypeEnum,
  OnlineEnum,
  RoomTypeEnum,
  SessionOperateEnum,
  SexEnum
} from '../enums'
