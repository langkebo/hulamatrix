/*
 * Enhanced Matrix SDK Service
 *
 * This service provides a unified interface to the Synapse Enhanced SDK,
 * supporting all features including friends, private chat, chatroom,
 * voice calls, security, admin functions, and presence management.
 *
 * Performance optimizations include:
 * - Intelligent caching strategy
 * - Rate limiting
 * - Request batching
 * - Performance monitoring
 */

import { SynapseEnhancedClient, UnifiedMatrixClient } from 'matrix-js-sdk'
import { getMatrixConfig } from '@/config/matrix'
import MatrixClientService from './MatrixClientService'

interface EnhancedSdkConfig {
  baseUrl: string
  accessToken: string
  apiPrefix?: string
  timeout?: number
}

// Performance configuration
interface PerformanceConfig {
  enabled: boolean
  logRequests: boolean
  trackEndpoints: boolean
  maxCacheEntries: number
  cacheTTL: number
}

// Cache configuration
interface CacheConfig {
  enabled: boolean
  maxEntries: number
  ttl: number
  strategy: 'lru' | 'fifo' | 'lfu'
}

// Rate limit configuration
interface RateLimitConfig {
  enabled: boolean
  maxRequests: number
  windowMs: number
  burstLimit?: number
}

// SDK configuration
interface SynapseEnhancedClientConfig {
  baseUrl: string
  accessToken: string
  userId?: string
  apiPrefix?: string
  timeout?: number
  performance?: PerformanceConfig
  cache?: CacheConfig
  rateLimit?: RateLimitConfig
}

// Performance metrics
interface PerformanceMetrics {
  requestCount: number
  errorCount: number
  cacheHits: number
  cacheMisses: number
  averageLatency: number
  endpointStats: Map<string, { count: number; avgLatency: number; errors: number }>
}

class EnhancedSdkService {
  private static instance: EnhancedSdkService | null = null
  private client: SynapseEnhancedClient | null = null
  private unifiedClient: UnifiedMatrixClient | null = null
  private initialized: boolean = false

  // Performance tracking
  private performanceConfig: PerformanceConfig = {
    enabled: true,
    logRequests: false,
    trackEndpoints: true,
    maxCacheEntries: 200,
    cacheTTL: 300000 // 5 minutes
  }

  private cacheConfig: CacheConfig = {
    enabled: true,
    maxEntries: 200,
    ttl: 300000,
    strategy: 'lru'
  }

  private rateLimitConfig: RateLimitConfig = {
    enabled: true,
    maxRequests: 100,
    windowMs: 60000, // 1 minute
    burstLimit: 20
  }

  private metrics: PerformanceMetrics = {
    requestCount: 0,
    errorCount: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageLatency: 0,
    endpointStats: new Map()
  }

  private requestTimestamps: number[] = []

  private constructor() {}

  public static getInstance(): EnhancedSdkService {
    if (!EnhancedSdkService.instance) {
      EnhancedSdkService.instance = new EnhancedSdkService()
    }
    return EnhancedSdkService.instance
  }

  public initialize(config?: Partial<SynapseEnhancedClientConfig>): void {
    if (this.initialized) {
      return
    }

    const matrixConfig = getMatrixConfig()
    if (!matrixConfig.baseUrl || !matrixConfig.accessToken) {
      throw new Error('Matrix config is not initialized')
    }

    // Get the shared MatrixClient instance
    const matrixClient = MatrixClientService.getInstance().getClient()
    if (!matrixClient) {
      // We cannot initialize without the shared client because encryption/sync needs to be shared
      console.warn('[EnhancedSdkService] MatrixClient not initialized, deferring initialization')
      return
    }

    const clientConfig: SynapseEnhancedClientConfig = {
      baseUrl: matrixConfig.baseUrl,
      accessToken: matrixConfig.accessToken,
      userId: matrixConfig.userId,
      apiPrefix: '/_synapse/client',
      timeout: 30000,
      performance: this.performanceConfig,
      cache: this.cacheConfig,
      rateLimit: this.rateLimitConfig,
      ...config
    }

    // Initialize UnifiedMatrixClient with the shared MatrixClient
    this.unifiedClient = new UnifiedMatrixClient(clientConfig, matrixClient)
    this.client = this.unifiedClient.getEnhancedClient()
    this.initialized = true
  }

  public getClient(): SynapseEnhancedClient {
    if (!this.client) {
      this.initialize()
      if (!this.client) {
        throw new Error('EnhancedSdkService could not be initialized (MatrixClient missing)')
      }
    }
    return this.client!
  }

  public getUnifiedClient(): UnifiedMatrixClient {
    if (!this.unifiedClient) {
      this.initialize()
      if (!this.unifiedClient) {
        throw new Error('EnhancedSdkService could not be initialized (MatrixClient missing)')
      }
    }
    return this.unifiedClient!
  }

  public isInitialized(): boolean {
    return this.initialized
  }

  /**
   * Update performance configuration
   */
  public updatePerformanceConfig(config: Partial<PerformanceConfig>): void {
    this.performanceConfig = { ...this.performanceConfig, ...config }
  }

  /**
   * Update cache configuration
   */
  public updateCacheConfig(config: Partial<CacheConfig>): void {
    this.cacheConfig = { ...this.cacheConfig, ...config }
  }

  /**
   * Update rate limit configuration
   */
  public updateRateLimitConfig(config: Partial<RateLimitConfig>): void {
    this.rateLimitConfig = { ...this.rateLimitConfig, ...config }
  }

  /**
   * Get performance metrics
   */
  public getMetrics(): PerformanceMetrics {
    return {
      ...this.metrics,
      endpointStats: new Map(this.metrics.endpointStats)
    }
  }

  /**
   * Reset performance metrics
   */
  public resetMetrics(): void {
    this.metrics = {
      requestCount: 0,
      errorCount: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageLatency: 0,
      endpointStats: new Map()
    }
    this.requestTimestamps = []
  }

  /**
   * Check if rate limit would be exceeded
   */
  public checkRateLimit(): boolean {
    if (!this.rateLimitConfig.enabled) {
      return false
    }

    const now = Date.now()
    const windowStart = now - this.rateLimitConfig.windowMs

    // Remove old timestamps
    this.requestTimestamps = this.requestTimestamps.filter((t) => t > windowStart)

    // Check burst limit
    if (this.rateLimitConfig.burstLimit) {
      const recentRequests = this.requestTimestamps.filter((t) => t > now - 1000)
      if (recentRequests.length >= this.rateLimitConfig.burstLimit) {
        return true
      }
    }

    // Check window limit
    return this.requestTimestamps.length >= this.rateLimitConfig.maxRequests
  }

  /**
   * Record a request timestamp
   */
  public recordRequest(): void {
    this.requestTimestamps.push(Date.now())
    this.metrics.requestCount++
  }

  /**
   * Record a cache hit
   */
  public recordCacheHit(): void {
    this.metrics.cacheHits++
  }

  /**
   * Record a cache miss
   */
  public recordCacheMiss(): void {
    this.metrics.cacheMisses++
  }

  /**
   * Record an error
   */
  public recordError(endpoint: string): void {
    this.metrics.errorCount++
    const stats = this.metrics.endpointStats.get(endpoint) || { count: 0, avgLatency: 0, errors: 0 }
    stats.errors++
    this.metrics.endpointStats.set(endpoint, stats)
  }

  /**
   * Record request latency
   */
  public recordLatency(endpoint: string, latency: number): void {
    const stats = this.metrics.endpointStats.get(endpoint) || { count: 0, avgLatency: 0, errors: 0 }
    stats.count++
    stats.avgLatency = (stats.avgLatency * (stats.count - 1) + latency) / stats.count
    this.metrics.endpointStats.set(endpoint, stats)

    // Update overall average
    const totalRequests = this.metrics.requestCount
    this.metrics.averageLatency = (this.metrics.averageLatency * (totalRequests - 1) + latency) / totalRequests
  }

  /**
   * Get cache hit rate
   */
  public getCacheHitRate(): number {
    const total = this.metrics.cacheHits + this.metrics.cacheMisses
    return total > 0 ? this.metrics.cacheHits / total : 0
  }

  /**
   * Get error rate
   */
  public getErrorRate(): number {
    return this.metrics.requestCount > 0 ? this.metrics.errorCount / this.metrics.requestCount : 0
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    // Implementation depends on SynapseEnhancedClient cache API
    this.metrics.cacheHits = 0
    this.metrics.cacheMisses = 0
  }

  /**
   * Reset service
   */
  public reset(): void {
    this.client = null
    this.unifiedClient = null
    this.initialized = false
    this.resetMetrics()
  }
}

export const enhancedSdkService = EnhancedSdkService.getInstance()

export function useEnhancedSdk(): {
  client: SynapseEnhancedClient
  unifiedClient: UnifiedMatrixClient
  isInitialized: boolean
  initialize: (config?: Partial<SynapseEnhancedClientConfig>) => void
  reset: () => void
  getMetrics: () => PerformanceMetrics
  updatePerformanceConfig: (config: Partial<PerformanceConfig>) => void
  updateCacheConfig: (config: Partial<CacheConfig>) => void
  updateRateLimitConfig: (config: Partial<RateLimitConfig>) => void
} {
  return {
    get client() {
      return enhancedSdkService.getClient()
    },
    get unifiedClient() {
      return enhancedSdkService.getUnifiedClient()
    },
    get isInitialized() {
      return enhancedSdkService.isInitialized()
    },
    initialize: (config?: Partial<SynapseEnhancedClientConfig>) => enhancedSdkService.initialize(config),
    reset: () => enhancedSdkService.reset(),
    getMetrics: () => enhancedSdkService.getMetrics(),
    updatePerformanceConfig: (config: Partial<PerformanceConfig>) => enhancedSdkService.updatePerformanceConfig(config),
    updateCacheConfig: (config: Partial<CacheConfig>) => enhancedSdkService.updateCacheConfig(config),
    updateRateLimitConfig: (config: Partial<RateLimitConfig>) => enhancedSdkService.updateRateLimitConfig(config)
  }
}

export type {
  EnhancedSdkConfig,
  PerformanceConfig,
  CacheConfig,
  RateLimitConfig,
  SynapseEnhancedClientConfig,
  PerformanceMetrics
}
