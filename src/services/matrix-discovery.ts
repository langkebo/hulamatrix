/**
 * Matrix 服务发现和配置管理
 * 支持 .well-known 发现和动态服务配置
 * 包含fallback机制、缓存TTL和服务器能力验证
 */

import { logger } from '@/utils/logger'

export interface WellKnownConfig {
  'm.homeserver': {
    base_url: string
  }
  'm.identity_server'?: {
    base_url: string
  }
  'org.matrix.msc3575.proxy'?: {
    url: string
  }
  'm.integrations'?: {
    managers: Array<{
      api_url: string
      ui_url?: string
    }>
  }
}

export interface ServerCapabilities {
  versions: string[]
  unstable_features: Record<string, boolean>
  'm.room_versions'?: Record<string, unknown>
}

export interface DiscoveryResult {
  homeserverUrl: string
  identityServerUrl?: string
  slidingSyncUrl: string
  integrations: Array<{
    apiUrl: string
    uiUrl?: string
  }>
  capabilities: ServerCapabilities
  rawConfig: WellKnownConfig
}

export interface CachedDiscoveryResult extends DiscoveryResult {
  _timestamp: number
  _ttl: number
}

/**
 * Required unstable features for full functionality
 */
export const REQUIRED_UNSTABLE_FEATURES = [
  'org.matrix.msc3575' // Sliding sync
] as const

/**
 * Recommended unstable features
 */
export const RECOMMENDED_UNSTABLE_FEATURES = [
  'org.matrix.msc2716', // History import
  'org.matrix.msc3440', // Threading
  'org.matrix.msc3773' // Notifications
] as const

/**
 * Matrix 服务发现管理器
 * 支持 .well-known 发现、fallback URL、缓存TTL和服务器能力验证
 */
export class MatrixDiscoveryService {
  private static instance: MatrixDiscoveryService
  private discoveryCache = new Map<string, CachedDiscoveryResult>()
  private defaultCacheTTL = 5 * 60 * 1000 // 5分钟默认缓存TTL
  private requestTimeout = 5000 // 5秒请求超时

  static getInstance(): MatrixDiscoveryService {
    if (!MatrixDiscoveryService.instance) {
      MatrixDiscoveryService.instance = new MatrixDiscoveryService()
    }
    return MatrixDiscoveryService.instance
  }

  /**
   * 设置缓存TTL
   * @param ttlMs TTL in milliseconds
   */
  setCacheTTL(ttlMs: number): void {
    this.defaultCacheTTL = Math.max(60000, ttlMs) // 最小1分钟
  }

  /**
   * 获取当前缓存TTL
   */
  getCacheTTL(): number {
    return this.defaultCacheTTL
  }

  /**
   * 执行完整的服务发现
   * @param serverName 服务器域名或URL
   * @param options 发现选项
   * @returns 发现结果
   */
  async discoverServices(
    serverName: string,
    options: {
      skipCache?: boolean
      validateCapabilities?: boolean
      allowCrossDomainWellKnown?: boolean
      maxRetries?: number
    } = {}
  ): Promise<DiscoveryResult> {
    const {
      skipCache = false,
      validateCapabilities = true,
      allowCrossDomainWellKnown = false,
      maxRetries = 3
    } = options

    // 检查缓存
    if (!skipCache) {
      const cached = this.getCachedResult(serverName)
      if (cached) {
        const reachable = await this.testServerReachability(cached.homeserverUrl)
        if (reachable) {
          logger.info(`Using cached discovery result for ${serverName}`)
          return cached
        }
        logger.warn(`Cached homeserver not reachable for ${serverName}, refreshing discovery`, {
          homeserverUrl: cached.homeserverUrl
        })
        this.clearCache(serverName)
      }
    }

    logger.info(`Starting discovery for ${serverName}`)

    try {
      // 1. 解析服务器名称
      const domain = this.parseServerName(serverName)

      // 2. 尝试 .well-known 发现，失败时使用fallback
      let wellKnownConfig: WellKnownConfig
      let homeserverUrl: string

      try {
        wellKnownConfig = await this.fetchWellKnownConfigWithRetry(domain, {
          allowCrossDomainWellKnown,
          maxRetries
        })
        homeserverUrl = await this.getReachableHomeserver(wellKnownConfig)
      } catch (wellKnownError) {
        const msg =
          wellKnownError instanceof Error
            ? wellKnownError.message
            : typeof wellKnownError === 'string'
              ? wellKnownError
              : ''
        const isSecurityFailure =
          msg.includes('homeserver host not allowed') ||
          msg.includes('Well-known server mismatch') ||
          msg.includes('must not contain credentials') ||
          msg.includes('Well-known must be fetched over HTTPS') ||
          msg.includes('Invalid well-known content-type')
        if (isSecurityFailure) {
          throw wellKnownError instanceof Error ? wellKnownError : new Error(msg || 'Well-known validation failed')
        }

        logger.warn(`Well-known discovery failed for ${domain}, trying fallback URLs`, wellKnownError)

        // 使用fallback机制
        const fallbackResult = await this.tryFallbackUrls(domain)
        homeserverUrl = fallbackResult.homeserverUrl
        wellKnownConfig = fallbackResult.config
      }

      // 3. 验证服务器能力
      const capabilities = await this.gatherCapabilities(homeserverUrl)

      if (validateCapabilities) {
        this.validateServerCapabilities(capabilities)
      }

      // 4. 构建其他服务URL
      const identityServerUrl = wellKnownConfig['m.identity_server']?.base_url
      const slidingSyncUrl =
        wellKnownConfig['org.matrix.msc3575.proxy']?.url ||
        `${homeserverUrl}/_matrix/client/unstable/org.matrix.msc3575/sync`

      const integrations =
        wellKnownConfig['m.integrations']?.managers?.map((manager) => ({
          apiUrl: manager.api_url,
          ...(manager.ui_url ? { uiUrl: manager.ui_url } : {})
        })) || []

      const result: DiscoveryResult = {
        homeserverUrl,
        slidingSyncUrl,
        integrations,
        capabilities,
        rawConfig: wellKnownConfig,
        ...(identityServerUrl ? { identityServerUrl } : {})
      }

      // 缓存结果
      const previous = this.getCachedResult(serverName)
      this.cacheResult(serverName, result)
      if (previous?.homeserverUrl && previous.homeserverUrl !== result.homeserverUrl) {
        logger.warn('Homeserver changed for serverName', {
          serverName,
          from: previous.homeserverUrl,
          to: result.homeserverUrl
        })
      }

      logger.info(`Discovery completed for ${serverName}`, {
        homeserverUrl,
        identityServerUrl: !!identityServerUrl,
        slidingSyncUrl: !!slidingSyncUrl,
        hasIntegrations: !!integrations?.length,
        versions: capabilities.versions?.slice(0, 3)
      })

      return result
    } catch (error) {
      logger.error(`Discovery failed for ${serverName}:`, error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to discover Matrix services for ${serverName}: ${errorMessage}`)
    }
  }

  /**
   * 尝试fallback URLs当.well-known失败时
   * @param domain 服务器域名
   * @returns fallback结果
   */
  private async tryFallbackUrls(domain: string): Promise<{ homeserverUrl: string; config: WellKnownConfig }> {
    // Fallback URL候选列表 (按优先级排序)
    const fallbackUrls = [
      `https://${domain}`,
      `https://${domain}:8448`,
      `https://matrix.${domain}`,
      `https://matrix.${domain}:8448`
    ]

    logger.info(`Trying fallback URLs for ${domain}:`, fallbackUrls)

    for (const url of fallbackUrls) {
      try {
        const isReachable = await this.testServerReachability(url)
        if (isReachable) {
          logger.info(`Found reachable server at fallback URL: ${url}`)

          // 创建一个合成的well-known配置
          const syntheticConfig: WellKnownConfig = {
            'm.homeserver': {
              base_url: url
            }
          }

          return {
            homeserverUrl: url,
            config: syntheticConfig
          }
        }
      } catch (error) {
        logger.debug(`Fallback URL ${url} not reachable:`, error)
      }
    }

    throw new Error(`All fallback URLs failed for ${domain}. Tried: ${fallbackUrls.join(', ')}`)
  }

  /**
   * 验证服务器能力
   * @param capabilities 服务器能力
   */
  private validateServerCapabilities(capabilities: ServerCapabilities): void {
    if (!capabilities.versions || capabilities.versions.length === 0) {
      logger.warn('Server did not report any supported versions')
    }

    // 检查必需的unstable features
    const missingRequired: string[] = []
    for (const feature of REQUIRED_UNSTABLE_FEATURES) {
      if (!capabilities.unstable_features?.[feature]) {
        missingRequired.push(feature)
      }
    }

    if (missingRequired.length > 0) {
      logger.warn(`Server missing required unstable features: ${missingRequired.join(', ')}`)
    }

    // 检查推荐的unstable features
    const missingRecommended: string[] = []
    for (const feature of RECOMMENDED_UNSTABLE_FEATURES) {
      if (!capabilities.unstable_features?.[feature]) {
        missingRecommended.push(feature)
      }
    }

    if (missingRecommended.length > 0) {
      logger.info(`Server missing recommended unstable features: ${missingRecommended.join(', ')}`)
    }
  }

  /**
   * 检查服务器是否支持特定能力
   * @param capabilities 服务器能力
   * @param feature 要检查的feature
   */
  hasUnstableFeature(capabilities: ServerCapabilities, feature: string): boolean {
    return capabilities.unstable_features?.[feature] === true
  }

  /**
   * 检查服务器是否支持特定版本
   * @param capabilities 服务器能力
   * @param version 要检查的版本
   */
  hasVersion(capabilities: ServerCapabilities, version: string): boolean {
    return capabilities.versions?.includes(version) ?? false
  }

  /**
   * 解析服务器名称
   */
  private parseServerName(serverName: string): string {
    // 移除协议前缀
    let domain = serverName.replace(/^https?:\/\//, '')

    // 移除路径部分
    const parts = domain.split('/')
    domain = parts[0] ?? ''

    return domain
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms))
  }

  private normalizeHomeserverBaseUrl(input: string): string {
    let url: URL
    try {
      url = new URL(input)
    } catch {
      url = new URL(`https://${input}`)
    }

    if (url.protocol !== 'https:') {
      url = new URL(url.toString().replace(/^http:/, 'https:'))
    }

    if (url.username || url.password) {
      throw new Error('Homeserver URL must not contain credentials')
    }

    return url.origin
  }

  private isAllowedHomeserverHost(homeserverUrl: string, domain: string, allowCrossDomainWellKnown: boolean): boolean {
    if (allowCrossDomainWellKnown) return true
    const hsHost = new URL(homeserverUrl).hostname.toLowerCase()
    const d = domain.toLowerCase()
    return hsHost === d || hsHost.endsWith(`.${d}`)
  }

  private async fetchWellKnownConfigWithRetry(
    domain: string,
    options: { allowCrossDomainWellKnown: boolean; maxRetries: number }
  ): Promise<WellKnownConfig> {
    const attempts = Math.max(1, Math.min(10, options.maxRetries))
    let lastError: unknown = null

    for (let i = 0; i < attempts; i++) {
      try {
        return await this.fetchWellKnownConfig(domain, options.allowCrossDomainWellKnown)
      } catch (err) {
        lastError = err
        const delay = Math.min(1500 * 2 ** i, 8000)
        logger.warn('Well-known fetch failed, retrying', { domain, attempt: i + 1, attempts, delay })
        if (i < attempts - 1) {
          await this.sleep(delay)
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError))
  }

  /**
   * 获取 .well-known 配置
   */
  private async fetchWellKnownConfig(domain: string, allowCrossDomainWellKnown: boolean): Promise<WellKnownConfig> {
    const wellKnownUrl = `https://${domain}/.well-known/matrix/client`

    try {
      logger.info(`Fetching .well-known from ${wellKnownUrl}`)
      const response = await fetch(wellKnownUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json'
        },
        signal: AbortSignal.timeout(this.requestTimeout)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const finalUrl = (() => {
        try {
          return new URL(response.url)
        } catch {
          return new URL(wellKnownUrl)
        }
      })()
      if (finalUrl.protocol !== 'https:') {
        throw new Error('Well-known must be fetched over HTTPS')
      }

      const contentType = response.headers?.get?.('content-type') || ''
      if (contentType && !contentType.toLowerCase().includes('application/json')) {
        throw new Error(`Invalid well-known content-type: ${contentType}`)
      }

      const config = await response.json()

      // 验证配置格式
      if (!config['m.homeserver']?.base_url) {
        throw new Error('Invalid .well-known config: missing m.homeserver.base_url')
      }

      const normalizedHomeserver = this.normalizeHomeserverBaseUrl(String(config['m.homeserver'].base_url))
      if (!this.isAllowedHomeserverHost(normalizedHomeserver, domain, allowCrossDomainWellKnown)) {
        throw new Error(`Well-known homeserver host not allowed: ${normalizedHomeserver}`)
      }

      const serverWellKnownUrl = `https://${domain}/.well-known/matrix/server`
      let serverCheckError: unknown = null
      try {
        const resp = await fetch(serverWellKnownUrl, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(Math.min(3000, this.requestTimeout))
        })
        if (resp.ok) {
          const js = await resp.json().catch(() => null)
          const mServer = (js as { 'm.server'?: string })?.['m.server']
          if (typeof mServer === 'string' && mServer.trim()) {
            const serverHost = mServer.split(':')[0]?.toLowerCase()
            const hsHost = new URL(normalizedHomeserver).hostname.toLowerCase()
            if (serverHost && hsHost !== serverHost && !hsHost.endsWith(`.${serverHost}`)) {
              throw new Error(`Well-known server mismatch: ${serverHost} vs ${hsHost}`)
            }
          }
        }
      } catch (e) {
        serverCheckError = e
      }
      if (serverCheckError) {
        const msg = serverCheckError instanceof Error ? serverCheckError.message : String(serverCheckError)
        if (msg.startsWith('Well-known server mismatch')) {
          throw serverCheckError instanceof Error ? serverCheckError : new Error(msg)
        }
        logger.warn('Well-known server validation skipped due to error', serverCheckError)
      }

      const normalizedConfig: WellKnownConfig = {
        ...(config as WellKnownConfig),
        'm.homeserver': { base_url: normalizedHomeserver }
      }

      logger.info('Successfully fetched .well-known config', {
        domain,
        homeserverUrl: normalizedHomeserver
      })
      return normalizedConfig
    } catch (error) {
      logger.warn(`Failed to fetch .well-known config from ${wellKnownUrl}:`, error)
      const e = error instanceof Error ? error : new Error(String(error))
      throw new Error(`Well-known discovery failed for ${domain}: ${e.message}`)
    }
  }

  /**
   * 获取可访问的homeserver URL
   */
  private async getReachableHomeserver(config: WellKnownConfig): Promise<string> {
    const homeserverBaseUrl = this.normalizeHomeserverBaseUrl(config['m.homeserver'].base_url)

    // 尝试直接使用配置的URL
    if (await this.testServerReachability(homeserverBaseUrl)) {
      return homeserverBaseUrl
    }

    // 尝试其他候选URL
    const candidates: string[] = [homeserverBaseUrl]
    const base = new URL(homeserverBaseUrl)
    if (!base.port) {
      for (const port of ['8448', '443']) {
        const u = new URL(homeserverBaseUrl)
        u.port = port
        candidates.push(u.origin)
      }
    }

    for (const candidate of candidates) {
      if (await this.testServerReachability(candidate)) {
        logger.info(`Found reachable homeserver at ${candidate}`)
        return candidate
      }
    }

    throw new Error(`Unable to reach any homeserver for ${config['m.homeserver'].base_url}`)
  }

  /**
   * 测试服务器可达性
   */
  private async testServerReachability(baseUrl: string): Promise<boolean> {
    try {
      const normalized = this.normalizeHomeserverBaseUrl(baseUrl)
      const testUrl = `${normalized}/_matrix/client/versions`
      const response = await fetch(testUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(this.requestTimeout)
      })
      return response.ok
    } catch {
      return false
    }
  }

  /**
   * 验证服务器能力是否满足要求
   * @param homeserverUrl 服务器URL
   * @returns 验证结果
   */
  async validateServer(homeserverUrl: string): Promise<{
    valid: boolean
    capabilities: ServerCapabilities
    missingRequired: string[]
    missingRecommended: string[]
  }> {
    const capabilities = await this.gatherCapabilities(homeserverUrl)

    const missingRequired: string[] = []
    for (const feature of REQUIRED_UNSTABLE_FEATURES) {
      if (!capabilities.unstable_features?.[feature]) {
        missingRequired.push(feature)
      }
    }

    const missingRecommended: string[] = []
    for (const feature of RECOMMENDED_UNSTABLE_FEATURES) {
      if (!capabilities.unstable_features?.[feature]) {
        missingRecommended.push(feature)
      }
    }

    return {
      valid: missingRequired.length === 0,
      capabilities,
      missingRequired,
      missingRecommended
    }
  }

  /**
   * 收集服务器能力
   */
  private async gatherCapabilities(homeserverUrl: string): Promise<ServerCapabilities> {
    const defaultCapabilities: ServerCapabilities = {
      versions: [],
      unstable_features: {}
    }

    try {
      const base = this.normalizeHomeserverBaseUrl(homeserverUrl)
      const versionsUrl = `${base}/_matrix/client/versions`
      const response = await fetch(versionsUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(this.requestTimeout)
      })

      if (response.ok) {
        const versions = await response.json()
        return {
          versions: versions.versions || [],
          unstable_features: versions.unstable_features || {},
          'm.room_versions': versions['m.room_versions'] || {}
        }
      }
    } catch (error) {
      logger.warn('Failed to gather server capabilities:', error)
    }

    return defaultCapabilities
  }

  /**
   * 缓存发现结果
   */
  private cacheResult(serverName: string, result: DiscoveryResult, ttl?: number): void {
    const cachedResult: CachedDiscoveryResult = {
      ...result,
      _timestamp: Date.now(),
      _ttl: ttl ?? this.defaultCacheTTL
    }
    this.discoveryCache.set(serverName, cachedResult)
    logger.debug(`Cached discovery result for ${serverName} with TTL ${cachedResult._ttl}ms`)
  }

  /**
   * 获取缓存结果
   */
  private getCachedResult(serverName: string): DiscoveryResult | null {
    const cached = this.discoveryCache.get(serverName)
    if (!cached) return null

    const now = Date.now()
    const age = now - cached._timestamp
    const ttl = cached._ttl

    // 检查是否过期
    if (age > ttl) {
      logger.debug(`Cache expired for ${serverName} (age: ${age}ms, ttl: ${ttl}ms)`)
      this.discoveryCache.delete(serverName)
      return null
    }

    logger.debug(`Cache hit for ${serverName} (age: ${age}ms, ttl: ${ttl}ms)`)

    // 返回不包含内部字段的结果
    const { _timestamp, _ttl, ...result } = cached
    return result
  }

  /**
   * 检查缓存是否存在且有效
   */
  isCacheValid(serverName: string): boolean {
    return this.getCachedResult(serverName) !== null
  }

  /**
   * 获取缓存的剩余TTL
   */
  getCacheRemainingTTL(serverName: string): number {
    const cached = this.discoveryCache.get(serverName)
    if (!cached) return 0

    const now = Date.now()
    const age = now - cached._timestamp
    const remaining = cached._ttl - age

    return Math.max(0, remaining)
  }

  /**
   * 强制刷新缓存
   */
  async refreshCache(serverName: string): Promise<DiscoveryResult> {
    return this.discoverServices(serverName, { skipCache: true })
  }

  /**
   * 清除缓存
   */
  clearCache(serverName?: string): void {
    if (serverName) {
      this.discoveryCache.delete(serverName)
      logger.debug(`Cleared cache for ${serverName}`)
    } else {
      this.discoveryCache.clear()
      logger.debug('Cleared all discovery cache')
    }
  }

  /**
   * 清除所有过期的缓存条目
   */
  clearExpiredCache(): number {
    const now = Date.now()
    let cleared = 0

    for (const [serverName, cached] of this.discoveryCache.entries()) {
      const age = now - cached._timestamp
      if (age > cached._ttl) {
        this.discoveryCache.delete(serverName)
        cleared++
      }
    }

    if (cleared > 0) {
      logger.debug(`Cleared ${cleared} expired cache entries`)
    }

    return cleared
  }

  /**
   * 使用默认服务器进行发现
   */
  async discoverDefaultServer(): Promise<DiscoveryResult> {
    const env = (import.meta as { env?: Record<string, unknown> })?.env || {}
    const defaultServer = String(env.VITE_MATRIX_SERVER_NAME || '').trim() || 'cjystx.top'
    return this.discoverServices(defaultServer)
  }
}

// 导出单例实例
export const matrixDiscovery = MatrixDiscoveryService.getInstance()
