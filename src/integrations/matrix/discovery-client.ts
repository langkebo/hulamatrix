/**
 * 基于.well-known发现的Matrix客户端服务
 */

import { matrixConfig, type MatrixConfigOptions } from '@/config/matrix-config'
import type { MatrixClient } from '@/typings/matrix-sdk.d.ts'
import { logger } from '@/utils/logger'
import { invoke } from '@tauri-apps/api/core'
import { TauriCommand } from '@/enums'

/**
 * Matrix 登录参数
 */
interface LoginParams {
  user: string
  password: string
  device_id?: string
  initial_device_display_name: string
  [key: string]: unknown
}

/**
 * Matrix 登录响应
 */
interface LoginResponse {
  access_token: string
  device_id: string
  user_id: string
  refresh_token?: string
  well_known?: {
    'm.homeserver'?: {
      base_url: string
    }
  }
  [key: string]: unknown
}

/**
 * 客户端启动选项
 */
interface ClientStartOptions {
  initialSyncLimit?: number
  includePresence?: boolean
  [key: string]: unknown
}

/**
 * 消息内容
 */
interface MessageContent {
  msgtype: string
  body: string
  [key: string]: unknown
}

/**
 * 存储的令牌
 */
interface StoredTokens {
  accessToken?: string
  refreshToken?: string
  deviceId?: string
  userId?: string
  [key: string]: unknown
}

export class DiscoveryMatrixClient {
  private client: MatrixClient | null = null
  private isInitialized = false
  private isConnecting = false

  /**
   * 初始化客户端（使用发现机制）
   */
  async initialize(options: MatrixConfigOptions = {}): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Client already initialized')
      return
    }

    if (this.isConnecting) {
      logger.warn('Client initialization already in progress')
      return
    }

    this.isConnecting = true

    try {
      logger.info('Initializing Matrix client with discovery...')

      // 1. 执行服务发现
      await matrixConfig.initializeWithDiscovery(options.homeserverUrl)

      // 2. 获取令牌（如果有）
      const tokens = await this.getStoredTokens()

      // 3. 创建客户端配置
      const clientConfig = await matrixConfig.createClientConfig({
        deviceId: tokens?.deviceId,
        ...options
      })

      // 4. 创建客户端
      const { createClient } = await import('matrix-js-sdk')
      const client = await createClient(clientConfig)

      // 验证客户端是否成功创建
      if (!client) {
        throw new Error('Failed to create Matrix client')
      }

      this.client = client

      // 5. 如果有令牌，设置认证
      if (tokens?.accessToken && this.client) {
        try {
          // MatrixClient doesn't have setAccessToken method in our type definition
          // Access token should be set during client creation
          logger.debug('Access token available for client')
        } catch (error) {
          logger.error('Failed to set access token:', error)
          throw new Error('Failed to set access token')
        }
      }

      this.isInitialized = true
      this.isConnecting = false

      logger.info('Matrix client initialized successfully', {
        homeserver: matrixConfig.getHomeserverUrl(),
        hasAccessToken: !!tokens?.accessToken,
        deviceId: clientConfig.deviceId
      })
    } catch (error) {
      this.isConnecting = false
      logger.error('Failed to initialize Matrix client:', error)
      throw error
    }
  }

  /**
   * 登录
   */
  async login(username: string, password: string): Promise<LoginResponse> {
    if (!this.client) {
      throw new Error('Client not initialized')
    }

    try {
      logger.info('Starting Matrix login...')

      const deviceId = matrixConfig.getDeviceId()
      const loginParams: LoginParams = {
        user: username,
        password: password,
        initial_device_display_name: matrixConfig.getDeviceName()
      }

      // Only add device_id if it exists
      if (deviceId !== undefined && deviceId !== null && deviceId !== '') {
        loginParams.device_id = deviceId
      }

      const loginResponse = (await this.client.login('m.login.password', loginParams)) as unknown as LoginResponse

      // 保存令牌
      await this.saveTokens({
        accessToken: loginResponse.access_token,
        refreshToken: loginResponse.refresh_token,
        deviceId: loginResponse.device_id,
        userId: loginResponse.user_id
      })

      logger.info('Matrix login successful', {
        userId: loginResponse.user_id,
        deviceId: loginResponse.device_id,
        hasRefreshToken: !!loginResponse.refresh_token
      })

      return loginResponse
    } catch (error) {
      logger.error('Matrix login failed:', error)
      throw error
    }
  }

  /**
   * 启动客户端同步
   */
  async startClient(options: ClientStartOptions = {}): Promise<void> {
    if (!this.client) {
      throw new Error('Client not initialized')
    }

    try {
      logger.info('Starting Matrix client sync...')

      await this.client.startClient({
        initialSyncLimit: 10000,
        includePresence: true,
        ...options
      })

      logger.info('Matrix client sync started')
    } catch (error) {
      logger.error('Failed to start Matrix client sync:', error)
      throw error
    }
  }

  /**
   * 停止客户端
   */
  async stopClient(): Promise<void> {
    if (this.client) {
      try {
        await this.client.stopClient()
        logger.info('Matrix client stopped')
      } catch (error) {
        logger.error('Error stopping Matrix client:', error)
      }

      this.client = null
      this.isInitialized = false
    }
  }

  /**
   * 获取客户端实例
   */
  getClient(): MatrixClient | null {
    return this.client
  }

  /**
   * 发送消息
   */
  async sendMessage(roomId: string, content: MessageContent): Promise<unknown> {
    if (!this.client) {
      throw new Error('Client not initialized')
    }

    try {
      return await this.client.sendEvent(roomId, 'm.room.message', content)
    } catch (error) {
      logger.error('Failed to send message:', error)
      throw error
    }
  }

  /**
   * 获取发现的服务信息
   */
  getDiscoveredServices() {
    return matrixConfig.getCurrentDiscovery()
  }

  /**
   * 获取服务器能力
   */
  getServerCapabilities() {
    return matrixConfig.getServerCapabilities()
  }

  /**
   * 切换服务器
   */
  async switchServer(serverName: string): Promise<void> {
    logger.info(`Switching to server: ${serverName}`)

    // 停止当前客户端
    await this.stopClient()

    // 重置配置
    matrixConfig.reset()

    // 重新初始化
    await this.initialize({ homeserverUrl: serverName })
  }

  /**
   * 保存令牌
   */
  private async saveTokens(tokens: StoredTokens): Promise<void> {
    try {
      await invoke(TauriCommand.UPDATE_TOKEN, tokens)
      logger.debug('Tokens saved successfully')
    } catch (error) {
      logger.error('Failed to save tokens:', error)
    }
  }

  /**
   * 获取存储的令牌
   */
  private async getStoredTokens(): Promise<StoredTokens | null> {
    try {
      const tokens = (await invoke(TauriCommand.GET_USER_TOKENS)) as StoredTokens | null
      return tokens || null
    } catch (_error) {
      logger.debug('No stored tokens found')
      return null
    }
  }

  /**
   * 检查是否已初始化
   */
  isClientInitialized(): boolean {
    return this.isInitialized
  }

  /**
   * 检查是否正在连接
   */
  isClientConnecting(): boolean {
    return this.isConnecting
  }

  /**
   * 获取当前homeserver URL
   */
  getCurrentHomeserverUrl(): string {
    return matrixConfig.getHomeserverUrl()
  }

  /**
   * 获取滑动同步URL
   */
  getSlidingSyncUrl(): string | null {
    return matrixConfig.getSlidingSyncUrl()
  }
}

// 导出单例
export const discoveryMatrixClient = new DiscoveryMatrixClient()
