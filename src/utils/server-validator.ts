/**
 * Matrix 服务器验证工具
 * 提供服务器状态检查、连接测试和验证功能
 */

import { matrixServerDiscovery, type ServerHealthStatus } from '@/integrations/matrix/server-discovery'
import { logger } from '@/utils/logger'

/**
 * 服务器验证结果
 */
export interface ValidationResult {
  valid: boolean
  serverName: string
  homeserverUrl?: string
  healthStatus?: ServerHealthStatus
  error?: string
}

/**
 * 连接测试结果
 */
export interface ConnectionTestResult {
  serverName: string
  homeserverUrl: string
  reachable: boolean
  responseTime: number
  version?: string
  error?: string
}

/**
 * Matrix 服务器验证器
 */
export class MatrixServerValidator {
  /**
   * 验证服务器配置
   * @param serverName 服务器域名或 URL
   * @returns 验证结果
   */
  async validate(serverName: string): Promise<ValidationResult> {
    logger.info(`[Validator] 验证服务器: ${serverName}`)

    try {
      // 1. 执行服务发现
      const discovery = await matrixServerDiscovery.discover(serverName)

      // 2. 检查服务器健康状态
      const healthStatus = await matrixServerDiscovery.checkServerHealth(discovery.homeserverUrl)

      // 3. 验证服务器能力
      const capabilityCheck = await matrixServerDiscovery.validateServerCapabilities(discovery.homeserverUrl)

      const isValid = healthStatus.reachable && capabilityCheck.valid

      logger.info(`[Validator] 验证完成: ${serverName}`, {
        valid: isValid,
        homeserverUrl: discovery.homeserverUrl,
        reachable: healthStatus.reachable,
        responseTime: healthStatus.responseTime
      })

      return {
        valid: isValid,
        serverName,
        homeserverUrl: discovery.homeserverUrl,
        healthStatus,
        error: isValid ? undefined : '服务器不可达或不支持所需功能'
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error(`[Validator] 验证失败: ${serverName}`, error)

      return {
        valid: false,
        serverName,
        error: errorMessage
      }
    }
  }

  /**
   * 测试服务器连接
   * @param serverName 服务器域名或 URL
   * @param timeout 超时时间（毫秒）
   * @returns 连接测试结果
   */
  async testConnection(serverName: string, timeout: number = 10000): Promise<ConnectionTestResult> {
    const startTime = Date.now()

    try {
      logger.info(`[Validator] 测试连接: ${serverName}`)

      // 快速连接测试
      const discovery = await matrixServerDiscovery.discover(serverName, { timeout })
      const healthStatus = await matrixServerDiscovery.checkServerHealth(discovery.homeserverUrl)

      const responseTime = Date.now() - startTime

      logger.info(`[Validator] 连接测试完成: ${serverName}`, {
        reachable: healthStatus.reachable,
        responseTime
      })

      return {
        serverName,
        homeserverUrl: discovery.homeserverUrl,
        reachable: healthStatus.reachable,
        responseTime,
        version: healthStatus.version,
        error: healthStatus.error
      }
    } catch (error) {
      const responseTime = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)

      logger.error(`[Validator] 连接测试失败: ${serverName}`, error)

      return {
        serverName,
        homeserverUrl: '',
        reachable: false,
        responseTime,
        error: errorMessage
      }
    }
  }

  /**
   * 批量验证多个服务器
   * @param serverNames 服务器列表
   * @returns 验证结果列表
   */
  async validateBatch(serverNames: string[]): Promise<ValidationResult[]> {
    logger.info(`[Validator] 批量验证 ${serverNames.length} 个服务器`)

    const results = await Promise.all(serverNames.map((serverName) => this.validate(serverName)))

    const validCount = results.filter((r) => r.valid).length
    logger.info(`[Validator] 批量验证完成: ${validCount}/${serverNames.length} 有效`)

    return results
  }

  /**
   * 检查服务器是否在线
   * @param serverName 服务器域名或 URL
   * @returns 是否在线
   */
  async isOnline(serverName: string): Promise<boolean> {
    try {
      const result = await this.testConnection(serverName, 5000)
      return result.reachable
    } catch {
      return false
    }
  }

  /**
   * 获取服务器版本信息
   * @param serverName 服务器域名或 URL
   * @returns 版本信息
   */
  async getServerVersion(serverName: string): Promise<string | null> {
    try {
      const result = await this.testConnection(serverName, 5000)
      return result.version || null
    } catch {
      return null
    }
  }
}

// 导出单例实例
export const matrixServerValidator = new MatrixServerValidator()

// 导出便捷函数
export async function validateMatrixServer(serverName: string): Promise<ValidationResult> {
  return matrixServerValidator.validate(serverName)
}

export async function testServerConnection(serverName: string, timeout?: number): Promise<ConnectionTestResult> {
  return matrixServerValidator.testConnection(serverName, timeout)
}

export async function isServerOnline(serverName: string): Promise<boolean> {
  return matrixServerValidator.isOnline(serverName)
}
