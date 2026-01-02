/**
 * 基于发现的登录服务
 */

import { matrixConfig } from '@/config/matrix-config'
import { logger } from '@/utils/logger'
import { matrixClientService } from '@/integrations/matrix/client'
// Removed: useHuLaStore - functionality now handled by individual stores

export interface LoginCredentials {
  username: string
  password: string
  homeserver?: string
}

export interface LoginResult {
  userId: string
  deviceId: string
  accessToken: string
  refreshToken?: string
  homeserverUrl: string
}

/**
 * Matrix 登录响应（支持多种命名约定）
 */
interface MatrixLoginResponse {
  user_id?: string
  userId?: string
  device_id?: string
  deviceId?: string
  access_token?: string
  accessToken?: string
  refresh_token?: string
  refreshToken?: string
}

/**
 * Matrix 客户端接口
 */
interface MatrixClient {
  getUserId?(): string
  getDeviceId?(): string
}

/**
 * 服务器发现信息
 */
interface ServerDiscoveryInfo {
  [key: string]: unknown
}

/**
 * 当前用户信息
 */
interface CurrentUserInfo {
  userId: string
  deviceId: string
  homeserverUrl: string
}

export class LoginService {
  private static instance: LoginService

  static getInstance(): LoginService {
    if (!LoginService.instance) {
      LoginService.instance = new LoginService()
    }
    return LoginService.instance
  }

  /**
   * 执行登录（使用 matrixClientService）
   */
  async login(credentials: LoginCredentials): Promise<LoginResult> {
    try {
      // Set the base URL from homeserver if provided, otherwise use config
      const homeserverUrl = credentials.homeserver || matrixConfig.getHomeserverUrl()
      if (homeserverUrl) {
        matrixClientService.setBaseUrl(homeserverUrl)
      }

      // Perform login using matrixClientService
      const loginResponse = (await matrixClientService.loginWithPassword(
        credentials.username,
        credentials.password
      )) as unknown as MatrixLoginResponse

      // Start the client sync
      await matrixClientService.startClient()

      // Client is now managed by matrixClientService and related stores

      const normalized: LoginResult = (() => {
        const result: LoginResult = {
          userId: loginResponse.user_id || loginResponse.userId || '',
          deviceId: loginResponse.device_id || loginResponse.deviceId || '',
          accessToken: loginResponse.access_token || loginResponse.accessToken || '',
          homeserverUrl: matrixClientService.getBaseUrl() || matrixConfig.getHomeserverUrl()
        }
        const refreshToken = loginResponse.refresh_token || loginResponse.refreshToken
        if (refreshToken !== undefined) {
          result.refreshToken = refreshToken
        }
        return result
      })()

      try {
        const host = (() => {
          const url = normalized.homeserverUrl || credentials.homeserver || ''
          try {
            return new URL(url).host
          } catch {
            return String(url).replace(/^https?:\/\//, '')
          }
        })()
        if (credentials.username && !String(normalized.userId).startsWith(`@${credentials.username}:`)) {
          normalized.userId = `@${credentials.username}:${host}`
        }
      } catch {}

      logger.info('Login successful', {
        userId: normalized.userId,
        homeserver: normalized.homeserverUrl,
        hasRefreshToken: !!normalized.refreshToken
      })

      return normalized
    } catch (error) {
      logger.error('Login failed:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`登录失败: ${errorMessage}`)
    }
  }

  /**
   * 使用保存的令牌自动登录
   */
  async autoLogin(): Promise<LoginResult | null> {
    try {
      logger.info('Attempting auto login...')

      // Check if client is already initialized
      const client = matrixClientService.getClient() as unknown as MatrixClient | null
      const userId = client?.getUserId?.()
      if (!client || !userId) {
        logger.info('No valid session found for auto login')
        return null
      }

      // Start the client sync
      await matrixClientService.startClient()

      const result: LoginResult = {
        userId,
        deviceId: client.getDeviceId?.() || '',
        accessToken: '', // 客户端内部管理
        homeserverUrl: matrixClientService.getBaseUrl() || matrixConfig.getHomeserverUrl()
      }

      logger.info('Auto login successful', {
        userId: result.userId,
        homeserver: result.homeserverUrl
      })

      return result
    } catch (error) {
      logger.error('Auto login failed:', error)
      return null
    }
  }

  /**
   * 登出
   */
  async logout(): Promise<void> {
    try {
      logger.info('Logging out...')
      await matrixClientService.stopClient()

      // 清理配置
      matrixConfig.reset()

      logger.info('Logout successful')
    } catch (error) {
      logger.error('Logout error:', error)
      throw error
    }
  }

  /**
   * 验证服务器
   */
  async validateServer(serverName: string): Promise<boolean> {
    try {
      return await matrixConfig.validateServerConfig(serverName)
    } catch (error) {
      logger.error('Server validation failed:', error)
      return false
    }
  }

  /**
   * 发现服务器信息
   */
  async discoverServerInfo(serverName?: string): Promise<ServerDiscoveryInfo | null> {
    try {
      await matrixConfig.initializeWithDiscovery(serverName)
      return matrixConfig.getCurrentDiscovery() as ServerDiscoveryInfo | null
    } catch (error) {
      logger.error('Server discovery failed:', error)
      throw error
    }
  }

  /**
   * 获取当前登录状态
   */
  isLoggedIn(): boolean {
    return matrixClientService.isClientInitialized() || !!matrixConfig.getHomeserverUrl()
  }

  /**
   * 获取当前用户信息
   */
  getCurrentUser(): CurrentUserInfo | null {
    const client = matrixClientService.getClient() as unknown as MatrixClient | null
    if (!client) return null

    const userId = client.getUserId?.()
    const deviceId = client.getDeviceId?.()

    if (!userId || !deviceId) return null

    return {
      userId,
      deviceId,
      homeserverUrl: matrixClientService.getBaseUrl() || matrixConfig.getHomeserverUrl()
    }
  }
}

// 导出单例
export const loginService = LoginService.getInstance()
