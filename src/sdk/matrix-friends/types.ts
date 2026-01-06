/**
 * Matrix Friends API 扩展类型定义
 * 基于 matrix-js-sdk v39.1.3
 * 后端服务器端口: 443
 */

// ==================== 基础类型 ====================

/**
 * 基础 API 响应
 */
export interface BaseResponse {
  status: 'ok' | 'failed'
  error?: string
  errcode?: string
}

/**
 * 基础查询选项
 */
export interface BaseOptions {
  userId?: string
}

// ==================== 数据模型 ====================

/**
 * 好友信息
 */
export interface Friend {
  /** 用户 ID (Matrix MXID) */
  friend_id: string
  /** 备注名 */
  remark: string
  /** 好友状态 */
  status: 'accepted' | 'pending' | 'blocked'
  /** 创建时间 (ISO8601) */
  created_at: string
  /** 分组 ID */
  category_id: string
  /** 分组名称（联表查询） */
  category_name?: string | null
  /** 用户 ID (备用字段) */
  user_id?: string
}

/**
 * 好友分组
 */
export interface Category {
  /** 分组 ID */
  id: string
  /** 分组名称 */
  name: string
  /** 创建时间 (ISO8601) */
  created_at: string
}

/**
 * 统计信息
 */
export interface Stats {
  /** 好友总数 */
  total_friends: number
  /** 待处理请求数 */
  pending_requests: number
  /** 被拉黑数 */
  blocked_count: number
}

/**
 * 好友请求
 */
export interface FriendRequest {
  /** 请求 ID (UUID) */
  id: string
  /** 发起人用户 ID */
  requester_id: string
  /** 请求消息 */
  message: string
  /** 创建时间 (ISO8601) */
  created_at: string
  /** 期望分组 ID */
  category_id?: string | null
  /** 目标用户 ID */
  target_id?: string
}

/**
 * 黑名单用户
 */
export interface BlockedUser {
  /** 用户 ID */
  user_id: string
  /** 拉黑时间 (ISO8601) */
  blocked_at: string
}

/**
 * 搜索结果用户
 */
export interface SearchResultUser {
  /** 用户 ID */
  user_id: string
  /** 显示名称 */
  display_name?: string | null
  /** 头像 URL */
  avatar_url?: string | null
}

// ==================== API 响应类型 ====================

/**
 * 好友列表响应
 */
export interface ListFriendsResponse extends BaseResponse {
  friends: Friend[]
}

/**
 * 分组列表响应
 */
export interface ListCategoriesResponse extends BaseResponse {
  categories: Category[]
}

/**
 * 统计信息响应
 */
export interface GetStatsResponse extends BaseResponse {
  stats: Stats
}

/**
 * 黑名单列表响应
 */
export interface ListBlockedResponse extends BaseResponse {
  blocked: BlockedUser[]
}

/**
 * 待处理请求列表响应
 */
export interface ListPendingRequestsResponse extends BaseResponse {
  requests: FriendRequest[]
}

/**
 * 搜索好友响应
 */
export interface SearchFriendsResponse extends BaseResponse {
  users: SearchResultUser[]
  limited?: boolean
}

/**
 * 发送好友请求响应
 */
export interface SendRequestResponse extends BaseResponse {
  request_id?: string
}

/**
 * 接受好友请求响应
 */
export interface AcceptRequestResponse extends BaseResponse {
  requester_id?: string
  dm_room_id?: string
  m_direct_updated?: boolean
  dm_note?: string
}

/**
 * 创建分组响应
 */
export interface CreateCategoryResponse extends BaseResponse {
  category_id?: string
}

/**
 * 操作响应 (通用)
 */
export interface OperationResponse extends BaseResponse {}

// ==================== API 请求类型 ====================

/**
 * 发送好友请求选项
 */
export interface SendRequestOptions extends BaseOptions {
  message?: string
  categoryId?: string
}

/**
 * 接受好友请求选项
 */
export interface AcceptRequestOptions extends BaseOptions {
  categoryId?: string
}

// ==================== FriendsApi 接口定义 ====================

/**
 * Friends API 接口
 * 扩展 Matrix Client，添加好友系统功能
 */
export interface FriendsApi {
  // ========== 查询类 API ==========

  /**
   * 获取好友列表
   * @param options 可选参数
   * @returns 好友列表响应
   */
  list(options?: BaseOptions): Promise<ListFriendsResponse>

  /**
   * 获取分组列表
   * @param options 可选参数
   * @returns 分组列表响应
   */
  listCategories(options?: BaseOptions): Promise<ListCategoriesResponse>

  /**
   * 获取统计信息
   * @param options 可选参数
   * @returns 统计信息响应
   */
  getStats(options?: BaseOptions): Promise<GetStatsResponse>

  /**
   * 获取黑名单
   * @param options 可选参数
   * @returns 黑名单列表响应
   */
  listBlocked(options?: BaseOptions): Promise<ListBlockedResponse>

  /**
   * 获取待处理请求
   * @param options 可选参数
   * @returns 待处理请求列表响应
   */
  listPendingRequests(options?: BaseOptions): Promise<ListPendingRequestsResponse>

  /**
   * 搜索好友
   * @param query 搜索关键词
   * @param options 可选参数
   * @returns 搜索结果响应
   */
  searchFriends(query: string, options?: BaseOptions): Promise<SearchFriendsResponse>

  // ========== 操作类 API ==========

  /**
   * 发送好友请求
   * @param targetId 目标用户 ID
   * @param options 可选参数
   * @returns 发送请求响应
   */
  sendRequest(targetId: string, options?: SendRequestOptions): Promise<SendRequestResponse>

  /**
   * 接受好友请求
   * @param requestId 请求 ID
   * @param options 可选参数
   * @returns 接受请求响应
   */
  acceptRequest(requestId: string, options?: AcceptRequestOptions): Promise<AcceptRequestResponse>

  /**
   * 拒绝好友请求
   * @param requestId 请求 ID
   * @param options 可选参数
   * @returns 操作响应
   */
  rejectRequest(requestId: string, options?: BaseOptions): Promise<OperationResponse>

  /**
   * 删除好友
   * @param friendId 好友用户 ID
   * @param options 可选参数
   * @returns 操作响应
   */
  removeFriend(friendId: string, options?: BaseOptions): Promise<OperationResponse>

  // ========== 分组管理 ==========

  /**
   * 创建分组
   * @param name 分组名称
   * @param options 可选参数
   * @returns 创建分组响应
   */
  createCategory(name: string, options?: BaseOptions): Promise<CreateCategoryResponse>

  /**
   * 删除分组
   * @param categoryId 分组 ID
   * @param options 可选参数
   * @returns 操作响应
   */
  deleteCategory(categoryId: string, options?: BaseOptions): Promise<OperationResponse>

  // ========== 备注管理 ==========

  /**
   * 设置好友备注
   * @param friendId 好友用户 ID
   * @param remark 备注内容
   * @param options 可选参数
   * @returns 操作响应
   */
  setRemark(friendId: string, remark: string, options?: BaseOptions): Promise<OperationResponse>

  // ========== 黑名单管理 ==========

  /**
   * 拉黑用户
   * @param targetId 目标用户 ID
   * @param options 可选参数
   * @returns 操作响应
   */
  blockUser(targetId: string, options?: BaseOptions): Promise<OperationResponse>

  /**
   * 取消拉黑
   * @param targetId 目标用户 ID
   * @param options 可选参数
   * @returns 操作响应
   */
  unblockUser(targetId: string, options?: BaseOptions): Promise<OperationResponse>
}

/**
 * Matrix Client 扩展类型
 */
export interface MatrixClientExtensions {
  readonly friends: FriendsApi
}

// ==================== 错误类型 ====================

/**
 * Friends API 错误基类
 */
export class FriendsApiError extends Error {
  constructor(
    public statusCode: number,
    public body: string
  ) {
    super(`Friends API Error ${statusCode}: ${body}`)
    this.name = 'FriendsApiError'
    Object.setPrototypeOf(this, FriendsApiError.prototype)
  }

  /**
   * 解析错误详情
   */
  getDetails(): { errcode?: string; error?: string } {
    try {
      return JSON.parse(this.body)
    } catch {
      return { error: this.body }
    }
  }

  /**
   * 是否为认证错误
   */
  isAuthError(): boolean {
    const details = this.getDetails()
    return this.statusCode === 401 || details.errcode === 'M_MISSING_TOKEN'
  }

  /**
   * 是否为权限错误
   */
  isForbidden(): boolean {
    const details = this.getDetails()
    return this.statusCode === 403 || details.errcode === 'M_FORBIDDEN'
  }

  /**
   * 是否为参数错误
   */
  isInvalidParam(): boolean {
    return this.statusCode === 400
  }

  /**
   * 是否为未找到
   */
  isNotFound(): boolean {
    return this.statusCode === 404
  }

  /**
   * 获取用户友好的错误消息
   */
  getUserMessage(): string {
    const details = this.getDetails()

    switch (details.errcode) {
      case 'M_MISSING_TOKEN':
        return '未授权访问，请重新登录'
      case 'M_UNKNOWN_TOKEN':
        return '登录已过期，请重新登录'
      case 'M_FORBIDDEN':
        return '没有权限执行此操作'
      case 'M_NOT_FOUND':
        return '请求的资源不存在'
      case 'M_INVALID_PARAM':
        return '请求参数无效'
      default:
        return details.error || '操作失败，请稍后重试'
    }
  }
}

/**
 * 网络错误
 */
export class NetworkError extends Error {
  constructor(message: string) {
    super(`Network Error: ${message}`)
    this.name = 'NetworkError'
    Object.setPrototypeOf(this, NetworkError.prototype)
  }
}
