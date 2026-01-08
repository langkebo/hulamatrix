/**
 * Matrix Friends API 扩展实现
 * 基于 matrix-js-sdk v39.1.3
 * 后端服务器: https://matrix.cjystx.top:443
 */

import { logger } from '@/utils/logger'
import type {
  FriendsApi,
  BaseOptions,
  ListFriendsResponse,
  ListCategoriesResponse,
  GetStatsResponse,
  ListBlockedResponse,
  ListPendingRequestsResponse,
  SearchFriendsResponse,
  SendRequestOptions,
  SendRequestResponse,
  AcceptRequestOptions,
  AcceptRequestResponse,
  OperationResponse
} from './types'
import { FriendsApiError, NetworkError } from './types'
import { buildQueryString } from './utils'

/**
 * Matrix 客户端接口 (最小化)
 */
export interface MatrixClientLike {
  getAccessToken?(): string
  getUserId?(): string
  setUserId?(userId: string): void
  getHomeserverUrl?(): string
  createRoom?(opts: {
    preset?: string
    invite?: string[]
    is_direct?: boolean
  }): Promise<{ room_id?: string; roomId?: string }>
  getAccountData?(type: string): Promise<Record<string, string[]> | { getContent?: () => Record<string, string[]> }>
  setAccountData?(type: string, data: Record<string, string[]>): Promise<void>
  // 动态扩展的 API
  friends?: unknown
}

/**
 * Friends API 扩展实现类
 */
export class MatrixFriendsApiExtension implements FriendsApi {
  constructor(
    private client: MatrixClientLike,
    private baseUrl: string
  ) {}

  /**
   * 获取访问 token
   */
  private getAccessToken(): string {
    if (!this.client.getAccessToken) {
      throw new FriendsApiError(
        401,
        JSON.stringify({
          errcode: 'M_MISSING_TOKEN',
          error: 'getAccessToken method not available'
        })
      )
    }
    const token = this.client.getAccessToken()
    if (!token) {
      throw new FriendsApiError(
        401,
        JSON.stringify({
          errcode: 'M_MISSING_TOKEN',
          error: 'Access token not found'
        })
      )
    }
    return token
  }

  /**
   * 获取当前用户 ID
   */
  private getUserId(): string {
    if (!this.client.getUserId) {
      throw new FriendsApiError(
        400,
        JSON.stringify({
          errcode: 'M_INVALID_PARAM',
          error: 'getUserId method not available'
        })
      )
    }
    return this.client.getUserId()
  }

  /**
   * 获取基础 URL
   */
  private getBaseUrl(): string {
    return this.baseUrl || this.client.getHomeserverUrl?.() || ''
  }

  /**
   * 通用 HTTP 请求方法
   */
  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.getBaseUrl()}${path}`
    const accessToken = this.getAccessToken()

    try {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined
      })

      const text = await response.text()
      const data = text ? JSON.parse(text) : {}

      if (!response.ok) {
        throw new FriendsApiError(response.status, text)
      }

      return data as T
    } catch (error) {
      if (error instanceof FriendsApiError) {
        throw error
      }
      throw new NetworkError(error instanceof Error ? error.message : String(error))
    }
  }

  // ==================== 查询类 API ====================

  async list(options?: BaseOptions): Promise<ListFriendsResponse> {
    const userId = options?.userId || this.getUserId()
    const query = buildQueryString({ user_id: userId })
    return this.request<ListFriendsResponse>('GET', `/_synapse/client/enhanced/friends/v2/list?${query}`)
  }

  async listCategories(options?: BaseOptions): Promise<ListCategoriesResponse> {
    const userId = options?.userId || this.getUserId()
    const query = buildQueryString({ user_id: userId })
    return this.request<ListCategoriesResponse>('GET', `/_synapse/client/enhanced/friends/v2/categories?${query}`)
  }

  async getStats(options?: BaseOptions): Promise<GetStatsResponse> {
    const userId = options?.userId || this.getUserId()
    const query = buildQueryString({ user_id: userId })
    return this.request<GetStatsResponse>('GET', `/_synapse/client/enhanced/friends/v2/stats?${query}`)
  }

  async listBlocked(options?: BaseOptions): Promise<ListBlockedResponse> {
    const userId = options?.userId || this.getUserId()
    const query = buildQueryString({ user_id: userId })
    return this.request<ListBlockedResponse>('GET', `/_synapse/client/enhanced/friends/v2/blocked?${query}`)
  }

  async listPendingRequests(options?: BaseOptions): Promise<ListPendingRequestsResponse> {
    const userId = options?.userId || this.getUserId()
    const query = buildQueryString({ user_id: userId })
    return this.request<ListPendingRequestsResponse>(
      'GET',
      `/_synapse/client/enhanced/friends/v2/requests/pending?${query}`
    )
  }

  async searchFriends(query: string, options?: BaseOptions): Promise<SearchFriendsResponse> {
    const userId = options?.userId || this.getUserId()
    const qs = buildQueryString({ user_id: userId, query })
    return this.request<SearchFriendsResponse>('GET', `/_synapse/client/enhanced/friends/v2/search?${qs}`)
  }

  // ==================== 操作类 API ====================

  async sendRequest(targetId: string, options?: SendRequestOptions): Promise<SendRequestResponse> {
    const body = {
      target_id: targetId,
      message: options?.message,
      category_id: options?.categoryId
    }

    return this.request<SendRequestResponse>('POST', '/_synapse/client/enhanced/friends/v2/request', body)
  }

  async acceptRequest(requestId: string, options?: AcceptRequestOptions): Promise<AcceptRequestResponse> {
    const body = {
      request_id: requestId,
      category_id: options?.categoryId
    }

    const response = await this.request<AcceptRequestResponse>(
      'POST',
      '/_synapse/client/enhanced/friends/v2/request/accept',
      body
    )

    // 如果后端没有返回 dm_room_id，尝试自动创建
    if (!response.dm_room_id && response.requester_id) {
      try {
        response.dm_room_id = await this.createDM(response.requester_id)
        response.dm_note = 'DM room created by client'
      } catch (error) {
        logger.warn('[FriendsApi] Failed to create DM room:', error)
      }
    }

    return response
  }

  async rejectRequest(requestId: string, _options?: BaseOptions): Promise<OperationResponse> {
    return this.request<OperationResponse>('POST', '/_synapse/client/enhanced/friends/v2/request/reject', {
      request_id: requestId
    })
  }

  async removeFriend(friendId: string, _options?: BaseOptions): Promise<OperationResponse> {
    return this.request<OperationResponse>('POST', '/_synapse/client/enhanced/friends/v2/remove', {
      friend_id: friendId
    })
  }

  // ==================== 分组管理 ====================

  async createCategory(name: string, _options?: BaseOptions): Promise<CreateCategoryResponse> {
    return this.request<CreateCategoryResponse>('POST', '/_synapse/client/enhanced/friends/v2/categories', { name })
  }

  async deleteCategory(categoryId: string, _options?: BaseOptions): Promise<OperationResponse> {
    return this.request<OperationResponse>('POST', '/_synapse/client/enhanced/friends/v2/categories/delete', {
      category_id: categoryId
    })
  }

  // ==================== 备注管理 ====================

  async setRemark(friendId: string, remark: string, _options?: BaseOptions): Promise<OperationResponse> {
    return this.request<OperationResponse>('POST', '/_synapse/client/enhanced/friends/v2/remark', {
      friend_id: friendId,
      remark
    })
  }

  // ==================== 黑名单管理 ====================

  async blockUser(targetId: string, _options?: BaseOptions): Promise<OperationResponse> {
    return this.request<OperationResponse>('POST', '/_synapse/client/enhanced/friends/v2/block', {
      target_id: targetId
    })
  }

  async unblockUser(targetId: string, _options?: BaseOptions): Promise<OperationResponse> {
    return this.request<OperationResponse>('POST', '/_synapse/client/enhanced/friends/v2/unblock', {
      target_id: targetId
    })
  }

  // ==================== 辅助方法 ====================

  /**
   * 创建 DM 房间
   * 使用标准 Matrix API
   */
  private async createDM(friendId: string): Promise<string> {
    if (!this.client.createRoom) {
      throw new Error('Matrix client does not support createRoom')
    }

    try {
      // 检查是否已有 DM 房间
      const mDirect = await this.getAccountDataSafely('m.direct')
      if (mDirect?.[friendId]?.[0]) {
        return mDirect[friendId][0]
      }

      // 创建新的 DM 房间
      const { room_id, roomId } = await this.client.createRoom({
        preset: 'trusted_private_chat',
        invite: [friendId],
        is_direct: true
      })

      const finalRoomId = room_id || roomId
      if (!finalRoomId) {
        throw new Error('Failed to create DM room: no room ID returned')
      }

      // 更新 m.direct
      const updatedMDirect = mDirect || {}
      updatedMDirect[friendId] = [finalRoomId]
      await this.setAccountDataSafely('m.direct', updatedMDirect)

      return finalRoomId
    } catch (error) {
      throw new Error(`Failed to create DM room: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 安全获取账户数据
   */
  private async getAccountDataSafely(type: string): Promise<Record<string, string[]> | undefined> {
    if (!this.client.getAccountData) {
      return undefined
    }

    try {
      const data = await this.client.getAccountData(type)
      // 处理两种可能的返回格式
      if (typeof data === 'object' && 'getContent' in data && typeof data.getContent === 'function') {
        return data.getContent() as Record<string, string[]>
      }
      return data as Record<string, string[]>
    } catch {
      return undefined
    }
  }

  /**
   * 安全设置账户数据
   */
  private async setAccountDataSafely(type: string, content: Record<string, string[]>): Promise<void> {
    if (!this.client.setAccountData) {
      logger.warn('[FriendsApi] Cannot set account data: method not available')
      return
    }

    await this.client.setAccountData(type, content)
  }
}

// 重新导出类型
import type { CreateCategoryResponse } from './types'
export type { CreateCategoryResponse }
