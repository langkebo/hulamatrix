/**
 * Admin模块类型定义
 * Requirements 10.1, 10.2: Define Admin types
 *
 * @module AdminTypes
 */

/**
 * 管理员用户信息
 */
export interface AdminUser {
  /** 用户ID (Matrix格式: @user:server) */
  name: string
  /** 显示名称 */
  displayname?: string
  /** 第三方身份标识 */
  threepids?: Array<{ medium: string; address: string }>
  /** 头像URL */
  avatar_url?: string
  /** 是否为管理员 */
  admin: boolean
  /** 是否已停用 */
  deactivated: boolean
  /** 是否被影子封禁 */
  shadow_banned: boolean
  /** 创建时间戳 */
  creation_ts: number
  /** 是否为访客 */
  is_guest?: boolean
  /** 用户类型 */
  user_type?: string
}

/**
 * 用户列表查询参数
 */
export interface AdminUserListParams {
  /** 按名称搜索 */
  name?: string
  /** 分页起始位置 */
  from?: number
  /** 每页数量 */
  limit?: number
  /** 是否包含访客 */
  guests?: boolean
  /** 是否包含已停用用户 */
  deactivated?: boolean
  /** 排序字段 */
  order_by?: 'name' | 'creation_ts' | 'admin' | 'deactivated'
  /** 排序方向 */
  dir?: 'f' | 'b'
}

/**
 * 管理员房间信息
 */
export interface AdminRoom {
  /** 房间ID */
  room_id: string
  /** 房间名称 */
  name?: string
  /** 规范别名 */
  canonical_alias?: string
  /** 已加入成员数 */
  joined_members: number
  /** 本地已加入成员数 */
  joined_local_members: number
  /** 房间版本 */
  version: string
  /** 创建者 */
  creator: string
  /** 加密算法 */
  encryption?: string
  /** 是否可联邦 */
  federatable: boolean
  /** 是否公开 */
  public: boolean
  /** 加入规则 */
  join_rules?: string
  /** 历史可见性 */
  history_visibility?: string
  /** 状态事件数 */
  state_events?: number
  /** 房间类型 */
  room_type?: string
}

/**
 * 房间列表查询参数
 */
export interface AdminRoomListParams {
  /** 分页起始位置 */
  from?: number
  /** 每页数量 */
  limit?: number
  /** 排序字段 */
  order_by?:
    | 'name'
    | 'canonical_alias'
    | 'joined_members'
    | 'joined_local_members'
    | 'version'
    | 'creator'
    | 'encryption'
    | 'federatable'
    | 'public'
    | 'join_rules'
    | 'history_visibility'
    | 'state_events'
  /** 排序方向 */
  dir?: 'f' | 'b'
  /** 按名称搜索 */
  search_term?: string
}

/**
 * 管理员设备信息
 */
export interface AdminDevice {
  /** 设备ID */
  device_id: string
  /** 显示名称 */
  display_name?: string
  /** 最后访问IP */
  last_seen_ip?: string
  /** 最后访问时间戳 */
  last_seen_ts?: number
  /** 用户ID */
  user_id: string
}

/**
 * 审计日志记录
 */
export interface AdminAuditLog {
  /** 日志ID */
  id: string
  /** 操作者ID */
  operatorId: string
  /** 操作类型 */
  operationType: AdminOperationType
  /** 目标ID */
  targetId: string
  /** 目标类型 */
  targetType: 'user' | 'room' | 'device' | 'media'
  /** 时间戳 */
  timestamp: number
  /** 操作结果 */
  result: 'success' | 'failure'
  /** 额外详情 */
  details?: Record<string, unknown>
}

/**
 * 管理员操作类型
 */
export type AdminOperationType =
  // 用户操作
  | 'user.get'
  | 'user.list'
  | 'user.update_admin'
  | 'user.deactivate'
  | 'user.reset_password'
  | 'user.delete_tokens'
  // 房间操作
  | 'room.get'
  | 'room.list'
  | 'room.delete'
  | 'room.purge_history'
  | 'room.kick'
  | 'room.ban'
  | 'room.unban'
  // 设备操作
  | 'device.list'
  | 'device.delete'
  // 媒体操作
  | 'media.purge'
  | 'media.delete_user'

/**
 * 媒体信息
 */
export interface AdminMedia {
  /** 媒体ID */
  media_id: string
  /** 媒体类型 */
  media_type: string
  /** 媒体长度 */
  media_length: number
  /** 上传名称 */
  upload_name?: string
  /** 创建时间戳 */
  created_ts: number
  /** 最后访问时间戳 */
  last_access_ts?: number
  /** 是否已隔离 */
  quarantined_by?: string
  /** 是否安全 */
  safe_from_quarantine?: boolean
}

/**
 * 服务器版本信息
 */
export interface ServerVersion {
  /** 服务器版本 */
  server_version: string
  /** Python版本 */
  python_version: string
}

/**
 * Matrix 权限等级配置
 * 完整的 m.room.power_levels 事件内容结构
 */
export interface PowerLevelsContent {
  /** 默认用户权限等级 */
  users_default?: number
  /** 默认事件所需权限等级 */
  events_default?: number
  /** 状态事件默认所需权限等级 */
  state_default?: number
  /** 踢出用户所需权限等级 */
  kick?: number
  /** 封禁用户所需权限等级 */
  ban?: number
  /** 邀请用户所需权限等级 */
  invite?: number
  /** 红色事件（通知整个房间）所需权限等级 */
  redact?: number
  /** 每个用户的权限等级 */
  users?: Record<string, number>
  /** 每个事件类型所需权限等级 */
  events?: Record<string, number>
  /** 索引签名，允许额外属性 */
  [key: string]: unknown
}

/**
 * 权限预设类型
 */
export type PowerLevelPreset = 'admin' | 'moderator' | 'user' | 'restricted' | 'custom'

/**
 * 权限预设配置
 */
export interface PowerLevelPresetConfig {
  name: string
  description: string
  level: number
  color: string
}

/**
 * 事件权限配置项
 */
export interface EventPermissionItem {
  event: string
  name: string
  description: string
  defaultLevel: number
}
