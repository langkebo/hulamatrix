/**
 * 统一的 Matrix 服务发现模块
 * 基于 Matrix SDK 的 AutoDiscovery API
 * 提供服务发现、服务器验证和状态检查功能
 */

import { AutoDiscovery, type ClientConfig } from 'matrix-js-sdk'
import { logger } from '@/utils/logger'

/**
 * Matrix 版本信息
 */
interface MatrixVersion {
  version: string
  [key: string]: unknown
}

/**
 * 服务发现结果
 */
export interface DiscoveryResult {
  homeserverUrl: string
  identityServerUrl?: string
  slidingSyncUrl?: string
  capabilities: ServerCapabilities
  rawConfig: ClientConfig
  discovered: boolean
  timestamp: number
}

/**
 * 服务器能力信息
 */
export interface ServerCapabilities {
  versions: string[]
  unstableFeatures: Record<string, boolean>
  roomVersions?: Record<string, unknown>
}

/**
 * 服务器健康状态
 */
export interface ServerHealthStatus {
  reachable: boolean
  version?: string
  responseTime?: number
  error?: string
  capabilities?: ServerCapabilities
}

/**
 * 服务发现配置选项
 */
export interface DiscoveryOptions {
  timeout?: number
  allowCrossDomain?: boolean
  skipCache?: boolean
  validateCapabilities?: boolean
}

/**
 * Matrix 服务发现类
 * 统一使用 Matrix SDK 的 AutoDiscovery API
 */
export class MatrixServerDiscovery {
  private static instance: MatrixServerDiscovery
  private cache = new Map<string, DiscoveryResult>()
  private defaultTimeout = 10000 // 10秒
  private cacheTTL = 5 * 60 * 1000 // 5分钟缓存

  private constructor() {}

  static getInstance(): MatrixServerDiscovery {
    if (!MatrixServerDiscovery.instance) {
      MatrixServerDiscovery.instance = new MatrixServerDiscovery()
    }
    return MatrixServerDiscovery.instance
  }

  /**
   * 发现 Matrix 服务器
   * @param serverName 服务器域名或 URL
   * @param options 发现选项
   * @returns 发现结果
   */
  async discover(serverName: string, options: DiscoveryOptions = {}): Promise<DiscoveryResult> {
    const { timeout = this.defaultTimeout, skipCache = false } = options

    // 检查缓存
    if (!skipCache && this.cache.has(serverName)) {
      const cached = this.cache.get(serverName)!
      const age = Date.now() - cached.timestamp
      if (age < this.cacheTTL) {
        logger.debug(`[Discovery] 使用缓存结果: ${serverName}`)
        return cached
      }
      this.cache.delete(serverName)
    }

    logger.info(`[Discovery] 开始服务发现: ${serverName}`)

    try {
      // 使用 Matrix SDK 的 AutoDiscovery
      const result = await this.discoverWithTimeout(serverName, timeout)

      // 验证服务器可达性
      const healthStatus = await this.checkServerHealth(result.homeserverUrl)
      if (!healthStatus.reachable) {
        throw new Error(`服务器不可达: ${healthStatus.error || '未知错误'}`)
      }

      // 构建发现结果
      const discoveryResult: DiscoveryResult = {
        homeserverUrl: result.homeserver.base_url,
        identityServerUrl: result.identityServer?.base_url,
        slidingSyncUrl: this.buildSlidingSyncUrl(result.homeserver.base_url),
        capabilities: await this.gatherCapabilities(result.homeserver.base_url),
        rawConfig: result,
        discovered: true,
        timestamp: Date.now()
      }

      // 缓存结果
      this.cache.set(serverName, discoveryResult)

      logger.info(`[Discovery] 服务发现成功: ${serverName}`, {
        homeserverUrl: discoveryResult.homeserverUrl,
        hasIdentityServer: !!discoveryResult.identityServerUrl,
        versions: discoveryResult.capabilities.versions?.length || 0
      })

      return discoveryResult
    } catch (error) {
      logger.error(`[Discovery] 服务发现失败: ${serverName}`, error)
      throw error
    }
  }

  /**
   * 带超时的服务发现
   */
  private async discoverWithTimeout(serverName: string, timeout: number): Promise<ClientConfig> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)

    try {
      // 规范化服务器名称
      const normalized = this.normalizeServerName(serverName)

      // 使用 Matrix SDK 的 AutoDiscovery (只接受一个参数)
      const result = await Promise.race([
        AutoDiscovery.findClientConfig(normalized),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`服务发现超时 (${timeout}ms)`)), timeout))
      ])

      clearTimeout(timer)
      return result
    } catch (error) {
      clearTimeout(timer)
      throw error
    }
  }

  /**
   * 检查服务器健康状态
   * @param homeserverUrl Homeserver URL
   * @returns 健康状态
   */
  async checkServerHealth(homeserverUrl: string): Promise<ServerHealthStatus> {
    const startTime = Date.now()

    try {
      const normalized = this.normalizeUrl(homeserverUrl)
      const versionsUrl = `${normalized}/_matrix/client/versions`

      const response = await fetch(versionsUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json'
        }
      })

      const responseTime = Date.now() - startTime

      if (!response.ok) {
        return {
          reachable: false,
          responseTime,
          error: `HTTP ${response.status}: ${response.statusText}`
        }
      }

      const data = await response.json()
      const versions = data?.versions || []
      const unstableFeatures = data?.unstable_features || {}

      return {
        reachable: true,
        version: versions[0]?.version || 'unknown',
        responseTime,
        capabilities: {
          versions: versions.map((v: MatrixVersion) => v.version),
          unstableFeatures,
          roomVersions: data?.['m.room_versions']
        }
      }
    } catch (error) {
      const responseTime = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)

      return {
        reachable: false,
        responseTime,
        error: errorMessage
      }
    }
  }

  /**
   * 验证服务器是否支持所需功能
   */
  async validateServerCapabilities(homeserverUrl: string): Promise<{
    valid: boolean
    capabilities: ServerCapabilities
    missingFeatures: string[]
  }> {
    const healthStatus = await this.checkServerHealth(homeserverUrl)

    if (!healthStatus.reachable || !healthStatus.capabilities) {
      return {
        valid: false,
        capabilities: { versions: [], unstableFeatures: {} },
        missingFeatures: []
      }
    }

    const capabilities = healthStatus.capabilities
    const requiredFeatures = ['org.matrix.msc3575'] // Sliding sync
    const missingFeatures = requiredFeatures.filter((feature) => !capabilities.unstableFeatures[feature])

    return {
      valid: missingFeatures.length === 0,
      capabilities,
      missingFeatures
    }
  }

  /**
   * 收集服务器能力信息
   */
  private async gatherCapabilities(homeserverUrl: string): Promise<ServerCapabilities> {
    const healthStatus = await this.checkServerHealth(homeserverUrl)
    return (
      healthStatus.capabilities || {
        versions: [],
        unstableFeatures: {}
      }
    )
  }

  /**
   * 构建 Sliding Sync URL
   */
  private buildSlidingSyncUrl(homeserverUrl: string): string {
    const normalized = this.normalizeUrl(homeserverUrl)
    return `${normalized}/_matrix/client/unstable/org.matrix.msc3575/sync`
  }

  /**
   * 规范化服务器名称
   */
  private normalizeServerName(serverName: string): string {
    // 移除协议前缀
    let normalized = serverName.replace(/^https?:\/\//, '')

    // 移除路径部分
    const parts = normalized.split('/')
    normalized = parts[0] || ''

    // 移除端口部分（如果不是标准端口）
    return normalized
  }

  /**
   * 规范化 URL
   */
  private normalizeUrl(url: string): string {
    let normalized = url

    // 添加协议前缀
    if (!/^https?:\/\//i.test(normalized)) {
      normalized = `https://${normalized}`
    }

    // 移除尾部斜杠
    normalized = normalized.replace(/\/+$/, '')

    return normalized
  }

  /**
   * 清除缓存
   */
  clearCache(serverName?: string): void {
    if (serverName) {
      this.cache.delete(serverName)
      logger.debug(`[Discovery] 清除缓存: ${serverName}`)
    } else {
      this.cache.clear()
      logger.debug('[Discovery] 清除所有缓存')
    }
  }

  /**
   * 获取缓存大小
   */
  getCacheSize(): number {
    return this.cache.size
  }

  /**
   * 设置缓存 TTL
   */
  setCacheTTL(ttl: number): void {
    this.cacheTTL = Math.max(60000, ttl) // 最小1分钟
    logger.debug(`[Discovery] 设置缓存TTL: ${ttl}ms`)
  }

  /**
   * 获取缓存的剩余 TTL
   */
  getCacheRemainingTTL(serverName: string): number {
    const cached = this.cache.get(serverName)
    if (!cached) return 0

    const age = Date.now() - cached.timestamp
    const remaining = this.cacheTTL - age
    return Math.max(0, remaining)
  }
}

// 导出单例实例
export const matrixServerDiscovery = MatrixServerDiscovery.getInstance()

// 导出便捷函数
export async function discoverMatrixServer(serverName: string, options?: DiscoveryOptions) {
  return matrixServerDiscovery.discover(serverName, options)
}

export async function checkServerHealth(homeserverUrl: string) {
  return matrixServerDiscovery.checkServerHealth(homeserverUrl)
}

export async function validateServerCapabilities(homeserverUrl: string) {
  return matrixServerDiscovery.validateServerCapabilities(homeserverUrl)
}
