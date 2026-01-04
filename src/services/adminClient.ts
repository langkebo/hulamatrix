/**
 * Synapse Admin API 客户端
 * 仅封装Synapse特有的管理API，复用SDK网络层
 *
 * Requirements 9.1: THE AdminClient SHALL use MatrixClient.http.authedRequest for Synapse Admin API calls
 * Requirements 9.4: THE AdminClient SHALL integrate with MatrixErrorHandler for error transformation
 * Requirements 9.5: THE AdminClient SHALL log all admin operations for audit
 *
 * @module AdminClient
 */

import { matrixClientService } from '@/integrations/matrix/client'
import { MatrixErrorHandler } from '@/utils/error-handler'
import { logger } from '@/utils/logger'
import type {
  AdminUser,
  AdminRoom,
  AdminDevice,
  AdminUserListParams,
  AdminRoomListParams,
  AdminAuditLog,
  AdminOperationType
} from '@/types/admin'

/** Matrix SDK HTTP client interface (subset of methods used) */
interface MatrixHttpClient {
  authedRequest<T>(
    callback: undefined,
    method: string,
    path: string,
    queryParams: undefined,
    data: unknown,
    options?: { prefix?: string }
  ): Promise<T>
}

/** Extended Matrix client with HTTP property */
interface MatrixClientWithHttp {
  http?: MatrixHttpClient
}

/**
 * Synapse Admin API 客户端
 * 仅封装Synapse特有的管理API，复用SDK网络层
 */
export class AdminClient {
  private static instance: AdminClient | null = null

  static getInstance(): AdminClient {
    if (!AdminClient.instance) {
      AdminClient.instance = new AdminClient()
    }
    return AdminClient.instance
  }

  /**
   * 重置单例实例（仅用于测试）
   */
  static resetInstance(): void {
    AdminClient.instance = null
  }

  /**
   * 获取SDK的HTTP客户端
   * Requirements 9.1: Use MatrixClient.http for API calls
   */
  private getHttp(): MatrixHttpClient {
    const client = matrixClientService.getClient() as MatrixClientWithHttp | null
    if (!client?.http) {
      throw new Error('Matrix Client HTTP not available')
    }
    return client.http
  }

  /**
   * 获取当前用户ID（用于审计日志）
   */
  private getOperatorId(): string {
    const client = matrixClientService.getClient()
    const getUserIdMethod = client?.getUserId as (() => string) | undefined
    return getUserIdMethod?.() || 'unknown'
  }

  /**
   * 记录审计日志
   * Requirements 9.5: Log all admin operations for audit
   */
  private logAudit(
    operationType: AdminOperationType,
    targetId: string,
    targetType: 'user' | 'room' | 'device' | 'media',
    result: 'success' | 'failure',
    details?: Record<string, unknown>
  ): void {
    const operatorId = this.getOperatorId()

    const log: AdminAuditLog = (() => {
      const logEntry: AdminAuditLog = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        operatorId,
        operationType,
        targetId,
        targetType,
        timestamp: Date.now(),
        result
      }
      if (details !== undefined) logEntry.details = details
      return logEntry
    })()

    logger.info('[AdminAudit]', log)
  }

  /**
   * 发起认证请求到Synapse Admin API
   * Requirements 9.1: Use MatrixClient.http.authedRequest
   * Requirements 9.4: Integrate with MatrixErrorHandler
   */
  private async authedRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: Record<string, unknown>,
    queryParams?: Record<string, string>
  ): Promise<T> {
    const http = this.getHttp()

    let fullPath = path
    if (queryParams && Object.keys(queryParams).length > 0) {
      const params = new URLSearchParams(queryParams)
      fullPath = `${path}?${params.toString()}`
    }

    logger.debug('[AdminClient] Request:', { method, path: fullPath })

    try {
      // Use SDK's authedRequest which handles token refresh automatically
      const result = await http.authedRequest(
        undefined, // callback (deprecated)
        method,
        fullPath,
        undefined, // queryParams (already in path)
        body,
        { prefix: '' } // No prefix, we provide full path
      )

      return result as T
    } catch (error) {
      // Requirements 9.4: Transform errors using MatrixErrorHandler
      const matrixError = MatrixErrorHandler.handle(error)
      logger.error('[AdminClient] Request failed:', matrixError)
      throw matrixError
    }
  }

  // ==================== 用户管理 API ====================

  /**
   * 获取单个用户信息
   * Requirements 9.2: Implement user management APIs
   */
  async getUser(userId: string): Promise<AdminUser> {
    try {
      const result = await this.authedRequest<AdminUser>(
        'GET',
        `/_synapse/admin/v2/users/${encodeURIComponent(userId)}`
      )
      this.logAudit('user.get', userId, 'user', 'success')
      return result
    } catch (error) {
      this.logAudit('user.get', userId, 'user', 'failure', { error: String(error) })
      throw error
    }
  }

  /**
   * 列出用户
   * Requirements 9.2: Implement user management APIs
   */
  async listUsers(params?: AdminUserListParams): Promise<{
    users: AdminUser[]
    next_token?: string
    total: number
  }> {
    const queryParams: Record<string, string> = {}
    if (params?.name) queryParams.name = params.name
    if (params?.from !== undefined) queryParams.from = String(params.from)
    if (params?.limit !== undefined) queryParams.limit = String(params.limit)
    if (params?.guests !== undefined) queryParams.guests = String(params.guests)
    if (params?.deactivated !== undefined) queryParams.deactivated = String(params.deactivated)

    try {
      const result = await this.authedRequest<{
        users: AdminUser[]
        next_token?: string
        total: number
      }>('GET', '/_synapse/admin/v2/users', undefined, queryParams)

      this.logAudit('user.list', 'all', 'user', 'success', params as Record<string, unknown>)
      return result
    } catch (error) {
      this.logAudit('user.list', 'all', 'user', 'failure', { error: String(error), ...(params || {}) })
      throw error
    }
  }

  /**
   * 更新用户管理员状态
   * Requirements 9.2: Implement user management APIs
   */
  async updateUserAdmin(userId: string, admin: boolean): Promise<void> {
    try {
      await this.authedRequest<void>('PUT', `/_synapse/admin/v2/users/${encodeURIComponent(userId)}`, { admin })
      this.logAudit('user.update_admin', userId, 'user', 'success', { admin })
    } catch (error) {
      this.logAudit('user.update_admin', userId, 'user', 'failure', { admin, error: String(error) })
      throw error
    }
  }

  /**
   * 设置用户停用状态
   * Requirements 9.2: Implement user management APIs
   */
  async setUserDeactivated(userId: string, deactivated: boolean): Promise<void> {
    try {
      await this.authedRequest<void>('PUT', `/_synapse/admin/v2/users/${encodeURIComponent(userId)}`, { deactivated })
      this.logAudit('user.deactivate', userId, 'user', 'success', { deactivated })
    } catch (error) {
      this.logAudit('user.deactivate', userId, 'user', 'failure', { deactivated, error: String(error) })
      throw error
    }
  }

  /**
   * 重置用户密码
   * Requirements 9.2: Implement user management APIs
   */
  async resetPassword(userId: string, newPassword: string, logoutDevices = true): Promise<void> {
    try {
      await this.authedRequest<void>('POST', `/_synapse/admin/v1/reset_password/${encodeURIComponent(userId)}`, {
        new_password: newPassword,
        logout_devices: logoutDevices
      })
      this.logAudit('user.reset_password', userId, 'user', 'success', { logoutDevices })
    } catch (error) {
      this.logAudit('user.reset_password', userId, 'user', 'failure', { logoutDevices, error: String(error) })
      throw error
    }
  }

  /**
   * 列出用户设备
   */
  async listDevices(userId: string): Promise<AdminDevice[]> {
    try {
      const result = await this.authedRequest<{ devices: AdminDevice[] }>(
        'GET',
        `/_synapse/admin/v2/users/${encodeURIComponent(userId)}/devices`
      )
      this.logAudit('device.list', userId, 'device', 'success')
      return result.devices || []
    } catch (error) {
      this.logAudit('device.list', userId, 'device', 'failure', { error: String(error) })
      throw error
    }
  }

  /**
   * 删除用户设备
   */
  async deleteDevice(userId: string, deviceId: string): Promise<void> {
    try {
      await this.authedRequest<void>(
        'DELETE',
        `/_synapse/admin/v2/users/${encodeURIComponent(userId)}/devices/${encodeURIComponent(deviceId)}`
      )
      this.logAudit('device.delete', `${userId}/${deviceId}`, 'device', 'success')
    } catch (error) {
      this.logAudit('device.delete', `${userId}/${deviceId}`, 'device', 'failure', { error: String(error) })
      throw error
    }
  }

  /**
   * 删除用户所有令牌
   */
  async deleteTokens(userId: string): Promise<void> {
    try {
      await this.authedRequest<void>('POST', `/_synapse/admin/v2/users/${encodeURIComponent(userId)}/delete_tokens`)
      this.logAudit('user.delete_tokens', userId, 'user', 'success')
    } catch (error) {
      this.logAudit('user.delete_tokens', userId, 'user', 'failure', { error: String(error) })
      throw error
    }
  }

  /**
   * 删除用户
   */
  async deleteUser(userId: string): Promise<void> {
    try {
      await this.authedRequest<void>('DELETE', `/_synapse/admin/v2/users/${encodeURIComponent(userId)}`)
      this.logAudit('user.delete', userId, 'user', 'success')
    } catch (error) {
      this.logAudit('user.delete', userId, 'user', 'failure', { error: String(error) })
      throw error
    }
  }

  // ==================== 房间管理 API ====================

  /**
   * 列出房间
   * Requirements 9.2: Implement room management APIs
   */
  async listRooms(params?: AdminRoomListParams): Promise<{
    rooms: AdminRoom[]
    next_batch?: string
    total_rooms: number
  }> {
    const queryParams: Record<string, string> = {}
    if (params?.from !== undefined) queryParams.from = String(params.from)
    if (params?.limit !== undefined) queryParams.limit = String(params.limit)
    if (params?.order_by) queryParams.order_by = params.order_by
    if (params?.dir) queryParams.dir = params.dir

    try {
      const result = await this.authedRequest<{
        rooms: AdminRoom[]
        next_batch?: string
        total_rooms: number
      }>('GET', '/_synapse/admin/v1/rooms', undefined, queryParams)

      this.logAudit('room.list', 'all', 'room', 'success', params as Record<string, unknown>)
      return result
    } catch (error) {
      this.logAudit('room.list', 'all', 'room', 'failure', { error: String(error), ...(params || {}) })
      throw error
    }
  }

  /**
   * 删除房间
   * Requirements 9.2: Implement room management APIs
   */
  async deleteRoom(roomId: string, options?: { block?: boolean; purge?: boolean }): Promise<void> {
    const queryParams: Record<string, string> = {}
    if (options?.block !== undefined) queryParams.block = String(options.block)
    if (options?.purge !== undefined) queryParams.purge = String(options.purge)

    try {
      await this.authedRequest<void>(
        'DELETE',
        `/_synapse/admin/v1/rooms/${encodeURIComponent(roomId)}`,
        undefined,
        queryParams
      )
      this.logAudit('room.delete', roomId, 'room', 'success', options)
    } catch (error) {
      this.logAudit('room.delete', roomId, 'room', 'failure', { error: String(error), options })
      throw error
    }
  }

  /**
   * 清除房间历史
   * Requirements 9.2: Implement room management APIs
   */
  async purgeHistory(roomId: string, purgeUpToTs: number): Promise<{ purge_id: string }> {
    try {
      const result = await this.authedRequest<{ purge_id: string }>(
        'POST',
        `/_synapse/admin/v1/purge_history/${encodeURIComponent(roomId)}`,
        { purge_up_to_ts: purgeUpToTs }
      )
      this.logAudit('room.purge_history', roomId, 'room', 'success', { purgeUpToTs })
      return result
    } catch (error) {
      this.logAudit('room.purge_history', roomId, 'room', 'failure', { purgeUpToTs, error: String(error) })
      throw error
    }
  }

  /**
   * 获取房间详情
   */
  async getRoom(roomId: string): Promise<AdminRoom> {
    try {
      const result = await this.authedRequest<AdminRoom>(
        'GET',
        `/_synapse/admin/v1/rooms/${encodeURIComponent(roomId)}`
      )
      this.logAudit('room.get', roomId, 'room', 'success')
      return result
    } catch (error) {
      this.logAudit('room.get', roomId, 'room', 'failure', { error: String(error) })
      throw error
    }
  }

  // ==================== 媒体管理 API ====================

  /**
   * 清除媒体缓存
   */
  async purgeMediaCache(beforeTs: number): Promise<{ deleted: number }> {
    try {
      const result = await this.authedRequest<{ deleted: number }>('POST', '/_synapse/admin/v1/purge_media_cache', {
        before_ts: beforeTs
      })
      this.logAudit('media.purge', 'cache', 'media', 'success', { beforeTs })
      return result
    } catch (error) {
      this.logAudit('media.purge', 'cache', 'media', 'failure', { beforeTs, error: String(error) })
      throw error
    }
  }

  /**
   * 删除用户媒体
   */
  async deleteUserMedia(userId: string): Promise<{ deleted_media: number; total: number }> {
    try {
      const result = await this.authedRequest<{ deleted_media: number; total: number }>(
        'DELETE',
        `/_synapse/admin/v1/users/${encodeURIComponent(userId)}/media`
      )
      this.logAudit('media.delete_user', userId, 'media', 'success')
      return result
    } catch (error) {
      this.logAudit('media.delete_user', userId, 'media', 'failure', { error: String(error) })
      throw error
    }
  }

  // ==================== 服务器管理 API ====================

  /**
   * 获取服务器版本信息
   */
  async getServerVersion(): Promise<{ server_version: string; python_version: string }> {
    try {
      const result = await this.authedRequest<{ server_version: string; python_version: string }>(
        'GET',
        '/_synapse/admin/v1/server_version'
      )
      return result
    } catch (error) {
      logger.error('[AdminClient] Failed to get server version:', error)
      throw error
    }
  }
}

// 导出单例实例
export const adminClient = AdminClient.getInstance()
