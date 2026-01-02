/**
 * Matrix SDK v2.0.0 类型定义
 * 基于 matrix-js-sdk-39.1.3
 *
 * 统一的好友系统和私聊增强系统的类型定义
 * 支持 PC 端和移动端
 */

// ==================== 导入 SDK 原始类型 ====================

import type {
    Friend,
    FriendCategory
} from "matrix-js-sdk";

// SDK 中可能没有导出，我们自定义
export interface PendingFriendRequest {
    id: string
    requester_id: string
    target_id: string
    message?: string
    created_at?: string
}

// ==================== 自定义类型定义 ====================

// 这些类型可能不在 SDK 中导出，我们自定义它们
export interface FriendStats {
    total_friends: number
    online_friends: number
    pending_requests: number
}

export interface SearchedUser {
    user_id: string
    display_name?: string
    avatar_url?: string
}

export interface ListFriendsOptions {
    includePresence?: boolean
    includeActivity?: boolean
}

export interface SendFriendRequestOptions {
    targetId: string
    message?: string
    categoryId?: number
}

export interface RespondFriendRequestOptions {
    requestId: string
    accept: boolean
    categoryId?: number
}

// ==================== 私聊系统类型定义 ====================

// 这些类型可能不在 SDK 中导出，我们自定义它们
export interface PrivateChatSession {
    session_id: string
    participant_ids: string[]
    session_name?: string
    ttl_seconds?: number
    created_at?: string
    expires_at?: string
}

export interface PrivateChatMessage {
    message_id: string
    session_id: string
    sender_id: string
    content: string
    type: string
    created_at?: string
    destroy_at?: string
    is_destroyed?: boolean
}

export interface CreateSessionOptions {
    participants: string[]
    session_name?: string
    ttl_seconds?: number
}

export interface GetMessagesOptions {
    session_id: string
    limit?: number
    before?: string
}

export interface SendMessageOptions {
    session_id: string
    content: string
    type?: 'text' | 'image' | 'file' | 'audio' | 'video'
    ttl_seconds?: number
}

// ==================== 导出 SDK 原始类型 ====================

export type {
    // 好友系统原始类型
    Friend,
    FriendCategory
};

// ==================== 好友系统扩展类型 ====================

/**
 * 好友项目（扩展 SDK 基础类型）
 * 添加 UI 层需要的缓存字段
 */
export interface FriendItem extends Friend {
    /** 显示名称（从用户资料缓存） */
    display_name?: string
    /** 头像 URL（从用户资料缓存） */
    avatar_url?: string
    /** 在线状态（从 presence 同步） */
    presence?: 'online' | 'offline' | 'unavailable' | 'away'
    /** 状态文本 */
    status_text?: string
    /** 最后活跃时间（毫秒前） */
    last_active_ago?: number
    /** 关联的私聊房间 ID */
    room_id?: string
}

/**
 * 好友分类项目（扩展 SDK 基础类型）
 */
export interface FriendCategoryItem {
    /** 分类 ID */
    id: number
    /** 分类名称 */
    name: string
    /** 分类描述 */
    description?: string
    /** 该分类下的好友数量 */
    friend_count?: number
    /** 分类颜色（十六进制） */
    color?: string
}

/**
 * 待处理好友请求项目（扩展 SDK 基础类型）
 */
export interface PendingRequestItem extends PendingFriendRequest {
    /** 发送者显示名称 */
    requester_display_name?: string
    /** 发送者头像 URL */
    requester_avatar_url?: string
    /** 发送者在线状态 */
    requester_presence?: 'online' | 'offline' | 'unavailable' | 'away'
}

// ==================== 私聊系统扩展类型 ====================

/**
 * 私聊会话项目（扩展 SDK 基础类型）
 */
export interface PrivateChatSessionItem extends PrivateChatSession {
    /** 最后一条消息 */
    last_message?: PrivateChatMessageItem
    /** 未读消息数 */
    unread_count?: number
    /** 参与者详细信息 */
    participant_info?: ParticipantInfo[]
    /** 显示名称（从 participant_info 提取的便捷属性） */
    display_name?: string
    /** 头像 URL（从 participant_info 提取的便捷属性） */
    avatar_url?: string
}

/**
 * 参与者信息
 */
export interface ParticipantInfo {
    /** 用户 ID */
    user_id: string
    /** 显示名称 */
    display_name?: string
    /** 头像 URL */
    avatar_url?: string
    /** 在线状态 */
    presence?: 'online' | 'offline' | 'unavailable' | 'away'
}

/**
 * 私聊消息项目（扩展 SDK 基础类型）
 */
export interface PrivateChatMessageItem extends PrivateChatMessage {
    /** 发送者显示名称 */
    sender_display_name?: string
    /** 发送者头像 URL */
    sender_avatar_url?: string
    /** 是否为当前用户发送 */
    is_own?: boolean
    /** 发送时间戳（毫秒） */
    timestamp?: number
    /** 消息状态 */
    status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed'
}

// ==================== Store 状态类型 ====================

/**
 * 好友 Store 状态
 */
export interface FriendsState {
    /** 加载状态 */
    loading: boolean
    /** 错误信息 */
    error: string
    /** 好友列表 */
    friends: FriendItem[]
    /** 好友分类列表 */
    categories: FriendCategoryItem[]
    /** 待处理请求列表 */
    pending: PendingRequestItem[]
    /** 好友统计 */
    stats: FriendStats | null
    /** 搜索结果 */
    search_results: SearchedUser[]
    /** 是否已初始化 */
    initialized: boolean
}

/**
 * 私聊 Store 状态
 */
export interface PrivateChatState {
    /** 加载状态 */
    loading: boolean
    /** 错误信息 */
    error: string
    /** 会话列表 */
    sessions: PrivateChatSessionItem[]
    /** 当前会话 ID */
    current_session_id: string | null
    /** 消息映射（会话 ID -> 消息列表） */
    messages: Map<string, PrivateChatMessageItem[]>
    /** 是否已初始化 */
    initialized: boolean
}

// ==================== 服务层类型 ====================

/**
 * 好友服务接口
 */
export interface IFriendsServiceV2 {
    /** 初始化服务 */
    initialize(): Promise<void>
    /** 获取好友列表 */
    listFriends(useCache?: boolean): Promise<FriendItem[]>
    /** 获取好友分类 */
    getCategories(useCache?: boolean): Promise<FriendCategoryItem[]>
    /** 获取待处理请求 */
    getPendingRequests(): Promise<PendingRequestItem[]>
    /** 发送好友请求 */
    sendFriendRequest(targetId: string, message?: string, categoryId?: number): Promise<string>
    /** 接受好友请求 */
    acceptFriendRequest(requestId: string, categoryId?: number): Promise<void>
    /** 拒绝好友请求 */
    rejectFriendRequest(requestId: string): Promise<void>
    /** 删除好友 */
    removeFriend(friendId: string): Promise<void>
    /** 搜索用户 */
    searchUsers(query: string, limit?: number): Promise<SearchedUser[]>
    /** 获取统计 */
    getStats(): Promise<FriendStats>
    /** 清除缓存 */
    invalidateCache(): void
}

/**
 * 私聊服务接口
 */
export interface IPrivateChatServiceV2 {
    /** 初始化服务 */
    initialize(): Promise<void>
    /** 获取会话列表 */
    listSessions(useCache?: boolean): Promise<PrivateChatSessionItem[]>
    /** 创建会话 */
    createSession(options: CreateSessionParams): Promise<PrivateChatSessionItem>
    /** 发送消息 */
    sendMessage(options: SendMessageParams): Promise<string>
    /** 发送文本（便捷方法） */
    sendText(sessionId: string, content: string): Promise<string>
    /** 获取消息 */
    getMessages(options: GetMessagesParams): Promise<PrivateChatMessageItem[]>
    /** 删除会话 */
    deleteSession(sessionId: string): Promise<void>
    /** 订阅消息 */
    subscribeToMessages(sessionId: string, handler: MessageHandler): () => void
    /** 清除缓存 */
    invalidateCache(): void
    /** 清理资源 */
    dispose(): void
}

/** 创建会话参数 */
export interface CreateSessionParams {
    participants: string[]
    session_name?: string
    ttl_seconds?: number
}

/** 发送消息参数 */
export interface SendMessageParams {
    session_id: string
    content: string
    type?: 'text' | 'image' | 'file' | 'audio' | 'video'
}

/** 获取消息参数 */
export interface GetMessagesParams {
    session_id: string
    limit?: number
    before?: string
}

/** 消息处理函数 */
export type MessageHandler = (message: PrivateChatMessageItem) => void

// ==================== 错误类型 ====================

/**
 * 好友系统错误基类
 */
export class FriendsSystemError extends Error {
    constructor(
        message: string,
        public code: string,
        public details?: unknown
    ) {
        super(message)
        this.name = 'FriendsSystemError'
    }
}

/**
 * 私聊系统错误基类
 */
export class PrivateChatSystemError extends Error {
    constructor(
        message: string,
        public code: string,
        public details?: unknown
    ) {
        super(message)
        this.name = 'PrivateChatSystemError'
    }
}

// ==================== 事件类型 ====================

/**
 * 好友事件类型
 */
export type FriendsEventType =
    | 'friend.add'
    | 'friend.remove'
    | 'request.received'
    | 'request.accepted'
    | 'request.rejected'

/**
 * 好友事件数据
 */
export interface FriendsEventData {
    'friend.add': { friendId: string }
    'friend.remove': { friendId: string }
    'request.received': PendingRequestItem
    'request.accepted': { requestId: string; categoryId: number }
    'request.rejected': { requestId: string }
}

/**
 * 私聊事件类型
 */
export type PrivateChatEventType =
    | 'session.created'
    | 'session.deleted'
    | 'message.received'
    | 'message.sent'

/**
 * 私聊事件数据
 */
export interface PrivateChatEventData {
    'session.created': PrivateChatSessionItem
    'session.deleted': { sessionId: string }
    'message.received': PrivateChatMessageItem
    'message.sent': { sessionId: string; messageId: string }
}

// ==================== UI 相关类型 ====================

/**
 * 好友列表项（用于 UI 显示）
 */
export interface FriendListItem extends FriendItem {
    /** 是否在线 */
    is_online?: boolean
    /** 拼音搜索键 */
    pinyin?: string
}

/**
 * 会话列表项（用于 UI 显示）
 */
export interface SessionListItem extends PrivateChatSessionItem {
    /** 最后消息预览 */
    last_message_preview?: string
    /** 最后消息时间 */
    last_message_time?: string
    /** 是否为当前会话 */
    is_active?: boolean
}

// ==================== 平台特定类型 ====================

/**
 * 移动端特定选项
 */
export interface MobileOptions {
    /** 是否启用触觉反馈 */
    haptic_feedback?: boolean
    /** 是否启用滑动操作 */
    swipe_actions?: boolean
}

/**
 * PC 端特定选项
 */
export interface DesktopOptions {
    /** 是否启用键盘快捷键 */
    keyboard_shortcuts?: boolean
    /** 是否启用拖拽操作 */
    drag_drop?: boolean
}

// ==================== 工具类型 ====================

/**
 * 分页选项
 */
export interface PaginationOptions {
    limit?: number
    offset?: number
    before?: string
    after?: string
}

/**
 * 分页结果
 */
export interface PaginatedResult<T> {
    data: T[]
    total: number
    has_more: boolean
    next_token?: string
}

/**
 * 排序选项
 */
export interface SortOptions {
    field?: 'created_at' | 'updated_at' | 'name'
    order?: 'asc' | 'desc'
}
