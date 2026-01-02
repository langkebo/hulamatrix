/**
 * Matrix 登录调试工具
 * 用于诊断和解决 Matrix 登录问题
 */

// import { safeAutoDiscovery } from '@/integrations/matrix/discovery'
import { getMatrixBaseUrl } from '@/utils/matrixEnv'
import { logger } from '@/utils/logger'

// Vite 环境变量类型定义
interface ImportMetaEnv {
  DEV?: boolean
  MODE?: string
  VITE_MATRIX_SERVER_NAME?: string
  [key: string]: string | boolean | undefined
}

interface ImportMetaWithEnv {
  env?: ImportMetaEnv
}

export interface LoginDebugInfo {
  homeserverUrl: string
  serverName: string
  formattedUsername: string
  localpart: string
  networkTest: {
    versionsEndpoint: boolean
    wellKnown: boolean
    loginEndpoint: boolean
  }
  errors: string[]
}

export class MatrixLoginDebugger {
  /**
   * 诊断登录问题
   */
  static async diagnoseLogin(username: string, password: string): Promise<LoginDebugInfo> {
    const debugInfo: LoginDebugInfo = {
      homeserverUrl: '',
      serverName: '',
      formattedUsername: '',
      localpart: '',
      networkTest: {
        versionsEndpoint: false,
        wellKnown: false,
        loginEndpoint: false
      },
      errors: []
    }

    try {
      // 1. 获取服务器配置
      let homeserverUrl = getMatrixBaseUrl()
      if (!homeserverUrl) {
        const meta = import.meta as unknown as ImportMetaWithEnv
        const env = meta.env || {}
        const defaultServerName = String(env.VITE_MATRIX_SERVER_NAME || '').trim() || 'cjystx.top'
        homeserverUrl = `https://matrix.${defaultServerName}`
        debugInfo.errors.push('使用默认服务器配置')
      }
      debugInfo.homeserverUrl = homeserverUrl
      debugInfo.serverName = new URL(homeserverUrl).host

      // 2. 测试网络连接
      debugInfo.networkTest = await MatrixLoginDebugger.testNetworkConnectivity(homeserverUrl)

      // 3. 处理用户名格式
      const { formattedUsername, localpart } = MatrixLoginDebugger.formatUsername(username, debugInfo.serverName)
      debugInfo.formattedUsername = formattedUsername
      debugInfo.localpart = localpart

      // 4. 测试登录端点
      if (debugInfo.networkTest.versionsEndpoint) {
        debugInfo.networkTest.loginEndpoint = await MatrixLoginDebugger.testLoginEndpoint(
          homeserverUrl,
          localpart,
          password
        )
      }
    } catch (error) {
      debugInfo.errors.push(`诊断过程出错: ${error instanceof Error ? error.message : String(error)}`)
    }

    return debugInfo
  }

  /**
   * 测试网络连接
   */
  private static async testNetworkConnectivity(homeserverUrl: string): Promise<LoginDebugInfo['networkTest']> {
    const result = {
      versionsEndpoint: false,
      wellKnown: false,
      loginEndpoint: false
    }

    // 测试 /_matrix/client/versions 端点
    try {
      const versionsResponse = await fetch(`${homeserverUrl}/_matrix/client/versions`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      })
      result.versionsEndpoint = versionsResponse.ok
    } catch (error) {
      logger.error('Versions endpoint test failed:', error)
    }

    // 测试 .well-known 配置
    try {
      const serverName = new URL(homeserverUrl).host
      const wellKnownResponse = await fetch(`https://${serverName}/.well-known/matrix/client`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      })
      result.wellKnown = wellKnownResponse.ok
    } catch (error) {
      logger.error('Well-known test failed:', error)
    }

    return result
  }

  /**
   * 测试登录端点（不实际登录）
   */
  private static async testLoginEndpoint(homeserverUrl: string, username: string, _password: string): Promise<boolean> {
    try {
      // 尝试登录以验证端点可用性（但不处理认证响应）
      const loginResponse = await fetch(`${homeserverUrl}/_matrix/client/r0/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'm.login.password',
          identifier: {
            type: 'm.id.user',
            user: username
          },
          password: 'test_invalid_password_to_verify_endpoint',
          initial_device_display_name: 'HuLa Debug'
        }),
        signal: AbortSignal.timeout(5000)
      })

      // 返回端点是否可达（不论认证成功与否）
      return loginResponse.status === 401 || loginResponse.ok
    } catch (error) {
      logger.error('Login endpoint test failed:', error)
      return false
    }
  }

  /**
   * 格式化用户名
   */
  private static formatUsername(
    username: string,
    serverName: string
  ): { formattedUsername: string; localpart: string } {
    const cleanUsername = String(username).trim()

    // 如果已经是完整格式
    if (cleanUsername.startsWith('@') && cleanUsername.includes(':')) {
      return {
        formattedUsername: cleanUsername,
        localpart: cleanUsername.slice(1, cleanUsername.indexOf(':'))
      }
    }

    // 如果只是本地部分
    const formatted = `@${cleanUsername}:${serverName}`
    return {
      formattedUsername: formatted,
      localpart: cleanUsername
    }
  }

  /**
   * 生成诊断报告
   */
  static generateReport(debugInfo: LoginDebugInfo): string {
    const { homeserverUrl, serverName, formattedUsername, localpart, networkTest, errors } = debugInfo

    let report = `=== Matrix 登录诊断报告 ===\n\n`
    report += `🏠 服务器配置:\n`
    report += `  - Homeserver URL: ${homeserverUrl}\n`
    report += `  - 服务器域名: ${serverName}\n\n`

    report += `👤 用户信息:\n`
    report += `  - 输入用户名: ${localpart}\n`
    report += `  - 完整用户ID: ${formattedUsername}\n\n`

    report += `🌐 网络连接测试:\n`
    report += `  - Versions API: ${networkTest.versionsEndpoint ? '✅ 可用' : '❌ 不可用'}\n`
    report += `  - Well-known 配置: ${networkTest.wellKnown ? '✅ 可用' : '❌ 不可用'}\n`
    report += `  - Login API: ${networkTest.loginEndpoint ? '✅ 可用' : '❌ 不可用'}\n\n`

    if (errors.length > 0) {
      report += `⚠️ 发现的问题:\n`
      errors.forEach((error, index) => {
        report += `  ${index + 1}. ${error}\n`
      })
      report += '\n'
    }

    if (networkTest.versionsEndpoint && networkTest.loginEndpoint) {
      report += `✅ 诊断结果: 服务器连接正常，请检查用户名和密码是否正确\n`
    } else {
      report += `❌ 诊断结果: 服务器连接存在问题，请检查网络配置\n`
    }

    return report
  }
}

/**
 * 登录问题修复建议
 */
export function getLoginFixSuggestions(debugInfo: LoginDebugInfo): string[] {
  const suggestions: string[] = []

  if (!debugInfo.networkTest.versionsEndpoint) {
    suggestions.push('检查网络连接，确保可以访问 Matrix 服务器')
    suggestions.push('尝试使用 VPN 或更换网络环境')
    suggestions.push('检查防火墙设置，确保允许访问 Matrix 服务')
  }

  if (!debugInfo.networkTest.wellKnown) {
    suggestions.push('Matrix 服务器配置可能不完整，联系管理员')
  }

  if (!debugInfo.networkTest.loginEndpoint) {
    suggestions.push('登录 API 端点不可用，服务器可能正在维护')
  }

  if (debugInfo.localpart !== debugInfo.localpart.toLowerCase()) {
    suggestions.push('Matrix 用户名通常不区分大小写，建议使用小写')
  }

  if (debugInfo.errors.length > 0) {
    suggestions.push('检查控制台错误日志以获取更多信息')
  }

  return suggestions
}
