/**
 * Matrix 通用配置管理
 * 支持动态服务器发现和配置
 *
 * 此文件整合了以下模块的功能：
 * - src/config/matrix.ts (房间别名常量)
 * - src/config/matrixConfig.ts (服务发现功能)
 */

import { matrixDiscovery, type DiscoveryResult } from '@/services/matrix-discovery'
import { logger } from '@/utils/logger'

// ============================================================================
// Vite import.meta.env 类型定义
// ============================================================================

/**
 * Vite import.meta.env 类型定义
 */
interface ImportMetaEnv {
  MODE?: string
  DEV?: boolean
  PROD?: boolean
  SSR?: boolean
  VITE_APP_NAME?: string
  VITE_PC_URL?: string
  VITE_SERVICE_URL?: string
  VITE_MATRIX_ENABLED?: string
  VITE_MATRIX_SERVER_NAME?: string
  VITE_MATRIX_SERVER?: string
  VITE_MATRIX_ROOMS_ENABLED?: string
  VITE_MATRIX_MEDIA_ENABLED?: string
  VITE_MATRIX_PUSH_ENABLED?: string
  VITE_MATRIX_E2EE_ENABLED?: string
  VITE_MATRIX_RTC_ENABLED?: string
  VITE_MATRIX_ADMIN_ENABLED?: string
  VITE_SYNAPSE_FRIENDS_ENABLED?: string
  VITE_MOBILE_FEATURES_ENABLED?: string
  VITE_MATRIX_DEV_SYNC?: string
  VITE_MATRIX_ACCESS_TOKEN?: string
  VITE_MATRIX_USER_ID?: string
  VITE_GITEE_TOKEN?: string
  VITE_MIGRATE_MESSAGING?: string
  VITE_PUBLIC_ROOM_ALIASES?: string
  VITE_PUBLIC_ROOM_ALIAS?: string
  VITE_ADMIN_ACCOUNTS?: string
  VITEST?: string
  BASE_URL?: string
  [key: string]: string | boolean | undefined
}

interface ImportMeta {
  env: ImportMetaEnv
}

// Type-safe import.meta.env access helper
const getImportMetaEnv = (): ImportMetaEnv => {
  return typeof import.meta !== 'undefined' && (import.meta as ImportMeta).env
    ? (import.meta as ImportMeta).env
    : ({} as ImportMetaEnv)
}

// ============================================================================
// 房间别名常量 (从 matrix.ts 合并)
// ============================================================================

/**
 * 公共房间别名列表
 * 从环境变量 VITE_PUBLIC_ROOM_ALIASES 或 VITE_PUBLIC_ROOM_ALIAS 读取
 */
const _env = getImportMetaEnv()
const rawAliases = _env.VITE_PUBLIC_ROOM_ALIASES || _env.VITE_PUBLIC_ROOM_ALIAS || ''
export const PUBLIC_ROOM_ALIASES: string[] = String(rawAliases)
  .split(',')
  .map((s) => s.trim())
  .filter((s) => s.startsWith('#') && s.includes(':'))

/**
 * 默认公共房间别名（第一个有效别名）
 */
export const PUBLIC_ROOM_ALIAS = PUBLIC_ROOM_ALIASES[0] || ''

// ============================================================================
// 配置接口定义
// ============================================================================

export interface MatrixConfigOptions {
  homeserverUrl?: string
  deviceName?: string
  deviceId?: string
  enableRefreshTokens?: boolean
  slidingSyncEnabled?: boolean
  initialSyncLimit?: number
}

/** Matrix client configuration object */
export interface MatrixClientConfig {
  baseUrl: string
  deviceId: string
  deviceName: string
  timelineSupport: boolean
  refreshToken?: boolean
  slidingSyncProxyUrl?: string | null
  identityServer?: string | null
  [key: string]: unknown
}

export class MatrixConfigManager {
  private static instance: MatrixConfigManager
  private currentDiscovery: DiscoveryResult | null = null
  private customHomeserver: string | null = null

  static getInstance(): MatrixConfigManager {
    if (!MatrixConfigManager.instance) {
      MatrixConfigManager.instance = new MatrixConfigManager()
    }
    return MatrixConfigManager.instance
  }

  /**
   * 默认配置
   */
  private readonly defaultConfig = {
    deviceName: 'HuLa Desktop',
    enableRefreshTokens: true,
    slidingSyncEnabled: true,
    initialSyncLimit: 100,
    cacheTimeout: 5 * 60 * 1000 // 5分钟
  }

  /**
   * 使用发现机制初始化
   */
  async initializeWithDiscovery(serverName?: string): Promise<DiscoveryResult> {
    const targetServer = serverName || this.getDefaultServer()

    try {
      const isVitest = getImportMetaEnv().VITEST !== undefined
      if (isVitest) {
        const domain =
          String(targetServer)
            .trim()
            .replace(/^https?:\/\//, '')
            .split('/')[0] || ''
        const host = domain.startsWith('matrix.') ? domain : `matrix.${domain}`
        const homeserverUrl = `https://${host}`
        this.customHomeserver = null
        this.currentDiscovery = {
          homeserverUrl,
          slidingSyncUrl: `${homeserverUrl}/_matrix/client/unstable/org.matrix.msc3575/sync`,
          integrations: [],
          capabilities: { versions: [], unstable_features: {} },
          rawConfig: { 'm.homeserver': { base_url: homeserverUrl } }
        }
        return this.currentDiscovery
      }

      const previousHomeserverUrl = this.currentDiscovery?.homeserverUrl || null
      this.currentDiscovery = await matrixDiscovery.discoverServices(targetServer)
      this.customHomeserver = null

      logger.info('Matrix services discovered successfully', {
        homeserverUrl: this.currentDiscovery.homeserverUrl,
        hasIdentityServer: !!this.currentDiscovery.identityServerUrl,
        hasSlidingSync: !!this.currentDiscovery.slidingSyncUrl
      })
      if (previousHomeserverUrl && previousHomeserverUrl !== this.currentDiscovery.homeserverUrl) {
        logger.warn('Matrix homeserver changed', {
          serverName: targetServer,
          from: previousHomeserverUrl,
          to: this.currentDiscovery.homeserverUrl
        })
      }

      return this.currentDiscovery
    } catch (error) {
      logger.error('Failed to discover Matrix services:', error)
      throw error
    }
  }

  /**
   * 直接设置自定义homeserver
   */
  setCustomHomeserver(homeserverUrl: string): void {
    this.customHomeserver = homeserverUrl
    this.currentDiscovery = null
  }

  /**
   * 获取homeserver URL
   */
  getHomeserverUrl(): string {
    if (this.customHomeserver) {
      return this.customHomeserver
    }

    if (this.currentDiscovery) {
      return this.currentDiscovery.homeserverUrl
    }

    return this.getDefaultHomeserverUrl()
  }

  /**
   * 获取滑动同步URL
   */
  getSlidingSyncUrl(): string | null {
    if (this.customHomeserver) {
      return `${this.customHomeserver}/_matrix/client/unstable/org.matrix.msc3575/sync`
    }

    return this.currentDiscovery?.slidingSyncUrl || null
  }

  /**
   * 获取身份服务器URL
   */
  getIdentityServerUrl(): string | null {
    return this.currentDiscovery?.identityServerUrl || null
  }

  /**
   * 获取服务器能力
   */
  getServerCapabilities(): Record<string, unknown> {
    const capabilities = this.currentDiscovery?.capabilities
    if (!capabilities) return {}

    // Convert ServerCapabilities to a plain object to avoid union type issues
    return {
      versions: capabilities.versions ?? [],
      unstable_features: capabilities.unstable_features ?? {},
      ...(capabilities['m.room_versions'] ? { 'm.room_versions': capabilities['m.room_versions'] } : {})
    }
  }

  /**
   * 获取集成服务
   */
  getIntegrations(): Array<{ apiUrl: string; uiUrl?: string }> | null {
    return this.currentDiscovery?.integrations || null
  }

  /**
   * 获取设备名称
   */
  getDeviceName(): string {
    return this.defaultConfig.deviceName
  }

  /**
   * 获取设备ID
   */
  getDeviceId(): string {
    let deviceId = localStorage.getItem('matrix_device_id')
    if (!deviceId) {
      deviceId = this.generateDeviceId()
      localStorage.setItem('matrix_device_id', deviceId)
    }
    return deviceId
  }

  /**
   * 生成设备ID
   */
  private generateDeviceId(): string {
    return `HULA-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 获取默认服务器
   */
  private getDefaultServer(): string {
    const env = getImportMetaEnv()
    const v = env.VITE_MATRIX_SERVER_NAME || env.VITE_MATRIX_SERVER || ''
    return String(v).trim() || 'cjystx.top'
  }

  /**
   * 获取默认homeserver URL（回退方案）
   */
  private getDefaultHomeserverUrl(): string {
    return `https://matrix.${this.getDefaultServer()}`
  }

  /**
   * 创建客户端配置
   */
  async createClientConfig(options: MatrixConfigOptions = {}): Promise<MatrixClientConfig> {
    // 确保已执行发现
    if (!this.currentDiscovery && !this.customHomeserver) {
      await this.initializeWithDiscovery()
    }

    const config = {
      baseUrl: this.getHomeserverUrl(),
      deviceId: options.deviceId || this.getDeviceId(),
      deviceName: options.deviceName || this.getDeviceName(),
      timelineSupport: true,
      // 令牌刷新
      refreshToken: options.enableRefreshTokens ?? this.defaultConfig.enableRefreshTokens,
      // 滑动同步
      slidingSyncProxyUrl: options.slidingSyncEnabled !== false ? this.getSlidingSyncUrl() : undefined,
      // 身份服务器
      identityServer: this.getIdentityServerUrl(),
      // 服务器能力
      ...this.getServerCapabilities()
    }

    logger.info('Created Matrix client config', {
      baseUrl: config.baseUrl,
      hasSlidingSync: !!config.slidingSyncProxyUrl,
      hasIdentityServer: !!config.identityServer
    })

    return config
  }

  /**
   * 重置配置
   */
  reset(): void {
    this.currentDiscovery = null
    this.customHomeserver = null
    matrixDiscovery.clearCache()
  }

  /**
   * 获取当前发现结果
   */
  getCurrentDiscovery(): DiscoveryResult | null {
    return this.currentDiscovery
  }

  /**
   * 获取当前 homeserver URL
   */
  getCurrentHomeserver(): string {
    if (this.customHomeserver) {
      return this.customHomeserver
    }

    if (this.currentDiscovery?.homeserverUrl) {
      return this.currentDiscovery.homeserverUrl
    }

    // 默认值
    return this.getDefaultHomeserverUrl()
  }

  /**
   * 获取原始.well-known配置
   */
  getRawWellKnownConfig(): Record<string, unknown> | null {
    const rawConfig = this.currentDiscovery?.rawConfig
    if (!rawConfig) return null

    // Convert WellKnownConfig to a plain object to avoid union type issues
    return {
      'm.homeserver': rawConfig['m.homeserver'] ? { base_url: rawConfig['m.homeserver'].base_url } : undefined,
      ...(rawConfig['m.identity_server'] ? { 'm.identity_server': rawConfig['m.identity_server'] } : {}),
      ...(rawConfig['org.matrix.msc3575.proxy']
        ? { 'org.matrix.msc3575.proxy': rawConfig['org.matrix.msc3575.proxy'] }
        : {}),
      ...(rawConfig['m.integrations'] ? { 'm.integrations': rawConfig['m.integrations'] } : {})
    }
  }

  /**
   * 验证服务器配置
   */
  async validateServerConfig(serverName: string): Promise<boolean> {
    try {
      await matrixDiscovery.discoverServices(serverName)
      return true
    } catch (error) {
      logger.error(`Server validation failed for ${serverName}:`, error)
      return false
    }
  }
}

// 导出单例
export const matrixConfig = MatrixConfigManager.getInstance()

// ============================================================================
// 服务发现功能 (从 matrixConfig.ts 合并)
// ============================================================================

import { safeAutoDiscovery, type DiscoveryResult as LegacyDiscoveryResult } from '@/integrations/matrix/discovery'

const env = getImportMetaEnv()

/**
 * Matrix 配置状态接口 (从 matrixConfig.ts 合并)
 */
export interface MatrixConfigState {
  /** 服务器名称（域名），用于服务发现 */
  serverName: string
  /** 发现的 homeserver URL */
  homeserverUrl: string | null
  /** 服务器能力信息 */
  capabilities: Record<string, unknown> | null
  /** 是否已完成服务发现 */
  discovered: boolean
}

/**
 * 默认服务器名称
 */
export const DEFAULT_SERVER_NAME = String(env.VITE_MATRIX_SERVER_NAME || 'cjystx.top').trim()

/**
 * 全局 Matrix 配置状态 (从 matrixConfig.ts 合并)
 */
let matrixConfigState: MatrixConfigState = {
  serverName: DEFAULT_SERVER_NAME,
  homeserverUrl: null,
  capabilities: null,
  discovered: false
}

/**
 * 服务发现缓存 (从 matrixConfig.ts 合并)
 */
const discoveryCache = new Map<string, LegacyDiscoveryResult>()

/**
 * 执行服务发现并更新配置 (从 matrixConfig.ts 合并)
 * @param serverName 服务器名称（域名）
 * @returns 发现结果
 */
export async function discoverServer(serverName?: string): Promise<LegacyDiscoveryResult> {
  const target = serverName || matrixConfigState.serverName || DEFAULT_SERVER_NAME

  // 检查缓存
  const cached = discoveryCache.get(target)
  if (cached) {
    logger.debug('[MatrixConfig] 使用缓存的服务发现结果', { target })
    return cached
  }

  logger.info('[MatrixConfig] 开始服务发现', { serverName: target })

  try {
    const sleep = async (ms: number) => {
      await new Promise((resolve) => setTimeout(resolve, ms))
    }

    let result: LegacyDiscoveryResult | null = null
    let lastError: unknown = null
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        result = await safeAutoDiscovery(target)
        break
      } catch (e) {
        lastError = e
        const delay = Math.min(1000 * 2 ** attempt, 5000)
        logger.warn('[MatrixConfig] 服务发现失败，准备重试', { serverName: target, attempt: attempt + 1, delay })
        if (attempt < 2) {
          await sleep(delay)
        }
      }
    }

    if (!result) {
      throw lastError instanceof Error ? lastError : new Error(String(lastError))
    }

    // 更新配置
    matrixConfigState = {
      serverName: target,
      homeserverUrl: result.homeserverUrl,
      capabilities: result.capabilities || null,
      discovered: true
    }

    // 缓存结果
    discoveryCache.set(target, result)

    logger.info('[MatrixConfig] 服务发现成功', {
      serverName: target,
      homeserverUrl: result.homeserverUrl
    })

    return result
  } catch (error) {
    logger.error('[MatrixConfig] 服务发现失败', { serverName: target, error })
    throw error
  }
}

/**
 * 获取当前 Matrix 配置状态 (从 matrixConfig.ts 合并)
 */
export function getMatrixConfigState(): Readonly<MatrixConfigState> {
  return { ...matrixConfigState }
}

/**
 * 获取 homeserver URL（如果未发现则返回 null）(从 matrixConfig.ts 合并)
 * @deprecated 请使用 matrixConfig.getHomeserverUrl() 替代
 */
export function getHomeserverUrl(): string | null {
  return matrixConfigState.homeserverUrl
}

/**
 * 获取服务器名称 (从 matrixConfig.ts 合并)
 */
export function getServerName(): string {
  return matrixConfigState.serverName || DEFAULT_SERVER_NAME
}

/**
 * 设置服务器名称（会清除已发现的配置）(从 matrixConfig.ts 合并)
 */
export function setServerName(serverName: string): void {
  if (serverName !== matrixConfigState.serverName) {
    matrixConfigState = {
      serverName,
      homeserverUrl: null,
      capabilities: null,
      discovered: false
    }
  }
}

/**
 * 清除服务发现缓存 (从 matrixConfig.ts 合并)
 */
export function clearDiscoveryCache(): void {
  discoveryCache.clear()
  matrixConfigState.discovered = false
  matrixConfigState.homeserverUrl = null
  matrixConfigState.capabilities = null
}

/**
 * 检查是否已完成服务发现 (从 matrixConfig.ts 合并)
 */
export function isDiscovered(): boolean {
  return matrixConfigState.discovered && !!matrixConfigState.homeserverUrl
}

/**
 * 获取或发现 homeserver URL (从 matrixConfig.ts 合并)
 * 如果已发现则直接返回，否则执行服务发现
 */
export async function getOrDiscoverHomeserver(serverName?: string): Promise<string> {
  const target = serverName || matrixConfigState.serverName || DEFAULT_SERVER_NAME

  // 如果目标服务器已发现，直接返回
  if (matrixConfigState.discovered && matrixConfigState.homeserverUrl && target === matrixConfigState.serverName) {
    return matrixConfigState.homeserverUrl
  }

  // 检查缓存
  const cached = discoveryCache.get(target)
  if (cached) {
    return cached.homeserverUrl
  }

  // 执行服务发现
  const result = await discoverServer(target)
  return result.homeserverUrl
}

// ============================================================================
// 向后兼容导出
// ============================================================================

/**
 * @deprecated 请使用 matrixConfig 单例替代
 * 为了向后兼容，导出静态方法对象
 */
export const MatrixConfig = {
  /** @deprecated 请使用 matrixConfig.getHomeserverUrl() */
  getHomeserverUrl: (customUrl?: string) => customUrl || matrixConfig.getHomeserverUrl(),
  /** @deprecated 请使用 matrixConfig.getDeviceName() */
  getDeviceName: () => matrixConfig.getDeviceName(),
  /** @deprecated 请使用 matrixConfig.getDeviceId() */
  getDeviceId: () => matrixConfig.getDeviceId(),
  /** @deprecated 请使用 matrixConfig.getSlidingSyncUrl() */
  getSlidingSyncUrl: (homeserverUrl?: string) => {
    if (homeserverUrl) {
      return `${homeserverUrl}/_matrix/client/unstable/org.matrix.msc3575/sync`
    }
    return matrixConfig.getSlidingSyncUrl()
  },
  /** @deprecated 请使用 matrixConfig.initializeWithDiscovery() */
  initializeWithDiscovery: (serverName?: string) => matrixConfig.initializeWithDiscovery(serverName),
  /** @deprecated 请使用 matrixConfig.setCustomHomeserver() */
  setCustomHomeserver: (url: string) => matrixConfig.setCustomHomeserver(url)
}

/**
 * 获取当前 Matrix 配置状态
 * @deprecated 请使用 getMatrixConfigState() 替代
 * @see getMatrixConfigState
 */
export const getMatrixConfig = getMatrixConfigState

// 重新导出 DiscoveryResult 类型以保持向后兼容
export type { DiscoveryResult as MatrixDiscoveryResult }
export type { LegacyDiscoveryResult as LegacyMatrixDiscoveryResult }
