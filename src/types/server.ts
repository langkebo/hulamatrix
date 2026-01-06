/**
 * Server Configuration Types
 * 服务器配置相关类型定义
 */

export interface ServerConfig {
  /** 服务器唯一标识 */
  id: string
  /** 服务器名称 */
  name: string
  /** Homeserver URL */
  homeserverUrl: string
  /** 显示名称 */
  displayName?: string
  /** 服务器头像 URL */
  avatar?: string
  /** 是否为自定义服务器（非默认） */
  isCustom: boolean
  /** 是否为默认服务器 */
  isDefault?: boolean
  /** 最后连接时间戳 */
  lastConnected?: number
  /** 健康状态 */
  healthStatus?: HealthStatus
  /** 服务发现结果 */
  discoveryResult?: DiscoveryResult
}

export interface HealthStatus {
  /** 是否可达 */
  reachable: boolean
  /** 服务器版本 */
  version?: string
  /** 响应时间（毫秒） */
  responseTime?: number
  /** 错误信息 */
  error?: string
  /** 功能能力 */
  capabilities?: ServerCapabilities
  /** 检查时间戳 */
  checkedAt?: number
}

export interface ServerCapabilities {
  /** 支持的版本列表 */
  versions: string[]
  /** 不稳定特性 */
  unstableFeatures: Record<string, boolean>
  /** 房间版本 */
  roomVersions?: Record<string, unknown>
}

export interface DiscoveryResult {
  /** Homeserver 配置 */
  homeserver?: {
    base_url: string
    state?: string
  }
  /** 身份服务器配置 */
  identityServer?: {
    base_url: string
    state?: string
  }
}

export interface AddServerForm {
  /** 服务器名称 */
  name: string
  /** Homeserver URL 或域名 */
  homeserverUrl: string
  /** 显示名称 */
  displayName?: string
}

export interface ServerHealthCheckResult {
  serverId: string
  status: HealthStatus
  timestamp: number
}
