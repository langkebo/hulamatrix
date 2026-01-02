import { TauriCommand } from '@/enums'
import { invokeWithErrorHandler } from '@/utils/TauriInvokeHandler'
import { logger, toError } from '@/utils/logger'

/**
 * Token 管理工具类
 * 用于更新应用中的 token 信息
 */
export class TokenManager {
  /**
   * 更新 token
   * @param token 新的访问令牌
   * @param refreshToken 新的刷新令牌
   * @returns Promise<void>
   */
  static async updateToken(token: string, refreshToken: string): Promise<void> {
    try {
      await invokeWithErrorHandler(
        TauriCommand.UPDATE_TOKEN,
        {
          token,
          refresh_token: refreshToken
        },
        {
          customErrorMessage: '更新 token 失败',
          showError: true
        }
      )
    } catch (error) {
      logger.error('Token 更新失败:', toError(error))
      throw error
    }
  }

  /**
   * 静默更新 token（不显示错误提示）
   * @param token 新的访问令牌
   * @param refreshToken 新的刷新令牌
   * @returns Promise<boolean> 成功返回 true，失败返回 false
   */
  static async updateTokenSilently(token: string, refreshToken: string): Promise<boolean> {
    try {
      await invokeWithErrorHandler(
        TauriCommand.UPDATE_TOKEN,
        {
          tokenInfo: {
            token,
            refreshToken
          }
        },
        {
          showError: false
        }
      )
      return true
    } catch (error) {
      logger.error('静默更新 token 失败:', toError(error))
      return false
    }
  }
}

/**
 * 更新 token 的便捷函数
 * @param token 新的访问令牌
 * @param refreshToken 新的刷新令牌
 */
export const updateToken = TokenManager.updateToken

/**
 * 静默更新 token 的便捷函数
 * @param token 新的访问令牌
 * @param refreshToken 新的刷新令牌
 */
export const updateTokenSilently = TokenManager.updateTokenSilently
