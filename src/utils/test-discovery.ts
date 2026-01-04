/**
 * Matrix 服务发现测试工具
 */

import { matrixServerDiscovery, type DiscoveryResult } from '@/integrations/matrix/server-discovery'
import { matrixConfig } from '@/config/matrix-config'
import { logger } from '@/utils/logger'

/** 错误对象类型 */
interface ErrorLike {
  message?: string
  [key: string]: unknown
}

/** Window 扩展类型 */
interface WindowWithTests extends Window {
  testDiscovery?: () => Promise<void>
  testNetwork?: () => Promise<void>
}

/**
 * 测试服务发现功能
 */
export class DiscoveryTester {
  /**
   * 测试默认服务器发现
   */
  async testDefaultServer(): Promise<boolean> {
    try {
      logger.debug('🔍 测试默认服务器发现...')

      const env = (import.meta as { env?: Record<string, unknown> })?.env || {}
      const defaultServer = String(env.VITE_MATRIX_SERVER_NAME || 'cjystx.top').trim()
      const result = await matrixServerDiscovery.discover(defaultServer)

      logger.debug('✅ 发现成功:', {
        homeserverUrl: result.homeserverUrl,
        identityServerUrl: result.identityServerUrl,
        slidingSyncUrl: result.slidingSyncUrl
      })

      // 验证配置
      this.validateDiscoveryResult(result)

      return true
    } catch (error) {
      logger.error('❌ 发现失败:', (error as ErrorLike)?.message ?? String(error))
      return false
    }
  }

  /**
   * 测试指定服务器发现
   */
  async testServerDiscovery(serverName: string): Promise<boolean> {
    try {
      logger.debug(`🔍 测试服务器发现: ${serverName}`)

      const result = await matrixServerDiscovery.discover(serverName)

      logger.debug('✅ 发现成功:', {
        homeserverUrl: result.homeserverUrl,
        identityServerUrl: result.identityServerUrl,
        slidingSyncUrl: result.slidingSyncUrl
      })

      this.validateDiscoveryResult(result)
      return true
    } catch (error) {
      logger.error(`❌ 发现失败 (${serverName}):`, (error as ErrorLike)?.message ?? String(error))
      return false
    }
  }

  /**
   * 验证发现结果
   */
  private validateDiscoveryResult(result: DiscoveryResult): void {
    if (!result.homeserverUrl) {
      throw new Error('缺少homeserver URL')
    }

    try {
      const url = new URL(result.homeserverUrl)
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('无效的homeserver URL协议')
      }
    } catch (error) {
      throw new Error(`无效的homeserver URL格式: ${(error as ErrorLike)?.message ?? String(error)}`)
    }

    if (result.slidingSyncUrl) {
      try {
        new URL(result.slidingSyncUrl)
      } catch (error) {
        logger.warn('⚠️ 无效的滑动同步URL:', (error as ErrorLike)?.message ?? String(error))
      }
    }
  }

  /**
   * 测试配置管理器
   */
  async testConfigManager(): Promise<boolean> {
    try {
      logger.debug('🔍 测试配置管理器...')

      // 1. 测试默认初始化
      await matrixConfig.initializeWithDiscovery()
      const homeserverUrl = matrixConfig.getHomeserverUrl()
      logger.debug('✅ 默认homeserver:', homeserverUrl)

      // 2. 测试设备ID生成
      const deviceId = matrixConfig.getDeviceId()
      logger.debug('✅ 设备ID:', deviceId)

      // 3. 测试服务器能力
      const capabilities = matrixConfig.getServerCapabilities()
      logger.debug('✅ 服务器能力:', Object.keys(capabilities))

      // 4. 测试滑动同步URL
      const slidingSyncUrl = matrixConfig.getSlidingSyncUrl()
      logger.debug('✅ 滑动同步URL:', slidingSyncUrl)

      return true
    } catch (error) {
      logger.error('❌ 配置管理器测试失败:', (error as ErrorLike)?.message ?? String(error))
      return false
    }
  }

  /**
   * 运行完整测试套件
   */
  async runFullTest(): Promise<void> {
    logger.debug('🚀 开始Matrix服务发现完整测试...\n')

    const tests = [
      {
        name: '默认服务器发现',
        test: () => this.testDefaultServer()
      },
      {
        name: '配置管理器',
        test: () => this.testConfigManager()
      }
    ]

    const results: { name: string; success: boolean; error?: string }[] = []

    for (const { name, test } of tests) {
      logger.debug(`\n📋 执行测试: ${name}`)
      try {
        const success = await test()
        results.push({ name, success })
      } catch (error) {
        results.push({
          name,
          success: false,
          error: (error as ErrorLike)?.message ?? String(error)
        })
      }
    }

    // 输出测试结果
    logger.debug('\n📊 测试结果:')
    results.forEach(({ name, success, error }) => {
      const status = success ? '✅' : '❌'
      logger.debug(`${status} ${name}${error ? ` - ${error}` : ''}`)
    })

    const passedCount = results.filter((r) => r.success).length
    logger.debug(`\n总计: ${passedCount}/${results.length} 测试通过`)

    if (passedCount === results.length) {
      logger.debug('🎉 所有测试通过！')
    } else {
      logger.debug('⚠️ 部分测试失败，请检查配置')
    }
  }

  /**
   * 测试网络连接
   */
  async testNetworkConnectivity(): Promise<boolean> {
    try {
      logger.debug('🔍 测试网络连接...')

      const testUrls = [
        'https://cjystx.top',
        'https://matrix.cjystx.top',
        'https://cjystx.top/.well-known/matrix/client'
      ]

      for (const url of testUrls) {
        try {
          const response = await fetch(url, {
            method: 'HEAD',
            signal: AbortSignal.timeout(5000)
          })
          logger.debug(`✅ ${url} - ${response.status}`)
        } catch (error) {
          logger.debug(`❌ ${url} - ${(error as ErrorLike)?.message ?? String(error)}`)
          return false
        }
      }

      return true
    } catch (error) {
      logger.error('❌ 网络连接测试失败:', (error as ErrorLike)?.message ?? String(error))
      return false
    }
  }
}

// 导出测试实例
export const discoveryTester = new DiscoveryTester()

// 在开发环境中自动运行测试
if (import.meta.env.DEV) {
  // 在控制台暴露测试函数
  const win = window as WindowWithTests
  win.testDiscovery = async () => {
    await discoveryTester.runFullTest()
  }
  win.testNetwork = async () => {
    await discoveryTester.testNetworkConnectivity()
  }
}
