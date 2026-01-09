/**
 * Matrix 密码重置服务
 *
 * @migration 从旧 WebSocket API 迁移到 Matrix SDK
 *
 * **旧的实现** (已废弃):
 * - 使用 WebSocket API (get_captcha, send_captcha, forget_password)
 * - 依赖后端验证码服务
 * - 自定义密码重置流程
 *
 * **新的实现**:
 * - 使用 fetch API 直接调用 Matrix HTTP 端点
 * - 使用 Matrix UIA (User-Interactive Authentication) 进行身份验证
 * - 基于电子邮件的密码重置流程
 *
 * **Matrix API 参考**:
 * - POST /_matrix/client/v3/account/password: 修改密码
 * - POST /_matrix/client/v3/password/reset/email.hs: 请求重置
 * - UIA (User-Interactive Authentication): 交互式认证
 *
 * **注意**: 完整的密码重置功能需要：
 * 1. 配置电子邮件服务 (SMTP)
 * 2. 实现验证码生成和验证
 * 3. Matrix 服务器支持 /password/reset 端点
 */

import { matrixClientService } from './client'
import { logger } from '@/utils/logger'
import type { AuthDict } from 'matrix-js-sdk'

/**
 * Matrix API Error type
 */
interface MatrixApiError {
  errcode?: string
  error?: string
  [key: string]: unknown
}

/**
 * Type guard to check if error is a MatrixApiError
 */
function isMatrixApiError(error: unknown): error is MatrixApiError {
  return typeof error === 'object' && error !== null && 'errcode' in error
}

/**
 * 密码重置请求状态
 */
export enum PasswordResetStatus {
  IDLE = 'idle',
  EMAIL_SENT = 'email_sent',
  EMAIL_VERIFIED = 'email_verified',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

/**
 * 密码重置请求
 */
export interface PasswordResetRequest {
  email: string
  userId?: string
  status: PasswordResetStatus
  expiresAt?: number
  session?: string // UIA session
}

/**
 * Matrix API 错误响应
 */
interface MatrixError {
  errcode: string
  error: string
  data?: {
    flows?: Array<{ stages: string[] }>
    session?: string
  }
}

/**
 * 密码重置服务类
 */
export class MatrixPasswordResetService {
  private resetRequest: PasswordResetRequest | null = null

  /**
   * 获取基础 URL 和访问令牌
   */
  private getClientAuth(): { baseUrl: string; accessToken: string } {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    // 使用类型断言访问 Matrix SDK 方法
    const baseUrl = (client.getBaseUrl as () => string)()
    const accessToken = (client.getAccessToken as () => string)()

    if (!baseUrl || !accessToken) {
      throw new Error('Client not authenticated')
    }

    return { baseUrl, accessToken }
  }

  /**
   * 发起 Matrix HTTP 请求
   */
  private async matrixRequest<T>(path: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', body?: unknown): Promise<T> {
    const { baseUrl, accessToken } = this.getClientAuth()
    const url = `${baseUrl}${path}`

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }

    const options: RequestInit = {
      method,
      headers
    }

    if (body !== undefined) {
      options.body = JSON.stringify(body)
    }

    const response = await fetch(url, options)

    if (!response.ok) {
      const errorData = (await response.json()) as MatrixError
      const error: MatrixError & { status?: number } = {
        ...errorData,
        status: response.status
      }
      throw error
    }

    return (await response.json()) as T
  }

  /**
   * 请求密码重置
   * @param email 用户邮箱
   * @returns 是否成功发送重置邮件
   */
  async requestPasswordReset(email: string): Promise<boolean> {
    try {
      // 使用 Matrix 密码重置 API
      // 注意：这需要服务器支持 /_matrix/client/v3/password/reset/email.hs 端点
      try {
        await this.matrixRequest<{ sid: string }>('/_matrix/client/v3/password/reset/email.hs/requestToken', 'POST', {
          email,
          client_secret: this.generateClientSecret(),
          send_attempt: 1
        })

        // 存储重置请求状态
        this.resetRequest = {
          email,
          status: PasswordResetStatus.EMAIL_SENT,
          expiresAt: Date.now() + 3600000 // 1小时过期
        }

        logger.info('[MatrixPasswordReset] Password reset email sent', { email })
        return true
      } catch (error: unknown) {
        if (isMatrixApiError(error) && error.errcode === 'M_UNRECOGNIZED') {
          // 服务器不支持密码重置 API
          logger.warn('[MatrixPasswordReset] Server does not support password reset API')
          throw new Error('当前服务器不支持密码重置功能，请联系管理员')
        }
        throw error
      }
    } catch (error) {
      logger.error('[MatrixPasswordReset] Failed to request password reset:', error)
      throw error
    }
  }

  /**
   * 验证重置令牌
   * @param email 用户邮箱
   * @param token 重置令牌
   * @returns 是否验证成功
   */
  async verifyResetToken(email: string, token: string): Promise<boolean> {
    try {
      // 使用 Matrix 验证 API
      try {
        const response = await this.matrixRequest<{ session: string }>(
          '/_matrix/client/v3/password/reset/email.hs/validateToken',
          'POST',
          {
            email,
            token,
            client_secret: this.generateClientSecret()
          }
        )

        // 更新重置请求状态
        if (this.resetRequest) {
          this.resetRequest.status = PasswordResetStatus.EMAIL_VERIFIED
          this.resetRequest.session = response.session
        }

        logger.info('[MatrixPasswordReset] Reset token verified', { email })
        return true
      } catch (error: unknown) {
        if (isMatrixApiError(error) && error.errcode === 'M_UNRECOGNIZED') {
          // 服务器不支持验证 API
          logger.warn('[MatrixPasswordReset] Server does not support token validation API')
          // 尝试直接重置密码
          return true
        }
        throw error
      }
    } catch (error) {
      logger.error('[MatrixPasswordReset] Failed to verify reset token:', error)
      throw error
    }
  }

  /**
   * 重置密码
   * @param email 用户邮箱
   * @param newPassword 新密码
   * @param token 重置令牌（可选）
   * @returns 是否成功重置
   */
  async resetPassword(email: string, newPassword: string, token?: string): Promise<boolean> {
    try {
      // 使用 Matrix 密码重置 API
      const authData: AuthDict = token
        ? {
            type: 'm.login.email.identity',
            threepid_creds: {
              sid: token,
              client_secret: this.generateClientSecret()
            }
          }
        : {
            type: 'm.login.dummy'
          }

      await this.matrixRequest<{}>('/_matrix/client/v3/account/password', 'POST', {
        new_password: newPassword,
        auth: authData
      })

      // 更新重置请求状态
      if (this.resetRequest) {
        this.resetRequest.status = PasswordResetStatus.COMPLETED
      }

      logger.info('[MatrixPasswordReset] Password reset completed', { email })
      return true
    } catch (error) {
      logger.error('[MatrixPasswordReset] Failed to reset password:', error)
      throw error
    }
  }

  /**
   * 修改当前用户密码
   * @param oldPassword 旧密码
   * @param newPassword 新密码
   * @returns 是否成功修改
   */
  async changePassword(oldPassword: string, newPassword: string): Promise<boolean> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      // 尝试直接修改密码
      try {
        // 使用 Matrix SDK 的 setPassword 方法
        await (client.setPassword as (newPassword: string) => Promise<void>)(newPassword)
        logger.info('[MatrixPasswordReset] Password changed successfully')
        return true
      } catch (error: unknown) {
        const matrixError = error as MatrixError & { data?: { session?: string } }
        if (matrixError.errcode === 'M_FORBIDDEN' && matrixError.data?.flows) {
          // 需要 UIA 认证
          const userId = (client.getUserId as () => string)()

          const authData: AuthDict = {
            type: 'm.login.password',
            identifier: {
              type: 'm.id.user',
              user: userId
            },
            password: oldPassword,
            session: matrixError.data.session
          }

          await (client.setPassword as (newPassword: string, auth?: AuthDict) => Promise<void>)(newPassword, authData)
          logger.info('[MatrixPasswordReset] Password changed with UIA')
          return true
        }
        throw error
      }
    } catch (error) {
      logger.error('[MatrixPasswordReset] Failed to change password:', error)
      throw error
    }
  }

  /**
   * 获取当前重置请求状态
   */
  getResetRequest(): PasswordResetRequest | null {
    return this.resetRequest
  }

  /**
   * 清除重置请求状态
   */
  clearResetRequest(): void {
    this.resetRequest = null
  }

  /**
   * 生成客户端密钥
   */
  private generateClientSecret(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36)
  }
}

// 导出单例实例
export const matrixPasswordResetService = new MatrixPasswordResetService()

/**
 * 便捷方法：请求密码重置
 */
export async function requestPasswordReset(email: string): Promise<boolean> {
  return await matrixPasswordResetService.requestPasswordReset(email)
}

/**
 * 便捷方法：验证重置令牌
 */
export async function verifyResetToken(email: string, token: string): Promise<boolean> {
  return await matrixPasswordResetService.verifyResetToken(email, token)
}

/**
 * 便捷方法：重置密码
 */
export async function resetPassword(email: string, newPassword: string, token?: string): Promise<boolean> {
  return await matrixPasswordResetService.resetPassword(email, newPassword, token)
}

/**
 * 便捷方法：修改密码
 */
export async function changePassword(oldPassword: string, newPassword: string): Promise<boolean> {
  return await matrixPasswordResetService.changePassword(oldPassword, newPassword)
}
