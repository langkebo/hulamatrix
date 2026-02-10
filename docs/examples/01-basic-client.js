/**
 * 基础客户端连接示例 (JavaScript)
 *
 * 本示例演示如何：
 * 1. 使用 UnifiedMatrixClient 初始化（推荐方式）
 * 2. 用户登录和注册
 * 3. 获取客户端状态
 * 4. 初始化端到端加密
 * 5. 基本错误处理
 */

const { UnifiedMatrixClient, ErrorCode } = require('matrix-js-sdk')

// 配置信息
const BASE_URL = 'https://matrix.example.com'
const ACCESS_TOKEN = process.env.MATRIX_ACCESS_TOKEN || 'your-access-token'
const USER_ID = process.env.MATRIX_USER_ID || '@user:example.com'

/**
 * 示例 1: 创建 UnifiedMatrixClient（推荐方式）
 */
async function exampleCreateClient() {
  console.log('=== 示例 1: 创建 UnifiedMatrixClient ===\n')

  // 创建统一客户端
  new UnifiedMatrixClient({
    baseUrl: BASE_URL,
    accessToken: ACCESS_TOKEN,
    userId: USER_ID,
    timeout: 30000
  })

  console.log('✅ 客户端创建成功')
  console.log('可用模块:')
  console.log('  - client.auth      (认证模块)')
  console.log('  - client.user      (用户模块)')
  console.log('  - client.room      (房间模块)')
  console.log('  - client.message   (消息模块)')
  console.log('  - client.enhanced  (增强功能模块)')
}

/**
 * 示例 2: 用户登录
 */
async function exampleLogin() {
  console.log('\n=== 示例 2: 用户登录 ===\n')

  const client = new UnifiedMatrixClient({
    baseUrl: BASE_URL
  })

  try {
    const result = await client.auth.login({
      type: 'm.login.password',
      user: 'username', // 或使用完整的 "@user:example.com"
      password: 'password',
      device_id: 'DEVICE001',
      initial_device_display_name: 'My Device'
    })

    console.log('✅ 登录成功:')
    console.log(`  用户 ID: ${result.user_id}`)
    console.log(`  设备 ID: ${result.device_id}`)
    console.log(`  访问令牌: ${result.access_token?.substring(0, 20)}...`)

    // 使用返回的令牌创建新的客户端实例
    const authenticatedClient = new UnifiedMatrixClient({
      baseUrl: BASE_URL,
      accessToken: result.access_token,
      userId: result.user_id
    })

    return authenticatedClient
  } catch (error) {
    console.error(`❌ 登录失败 [${error.code}]: ${error.message}`)
  }
}

/**
 * 示例 3: 获取用户信息
 * @param {Object} client - The UnifiedMatrixClient instance
 */
async function exampleWhoami(client) {
  console.log('\n=== 示例 3: 获取用户信息 ===\n')

  try {
    const whoami = await client.user.whoami()
    console.log('✅ 当前用户信息:')
    console.log(`  用户 ID: ${whoami.user_id}`)
    console.log(`  设备 ID: ${whoami.device_id || 'N/A'}`)
  } catch (error) {
    console.error(`❌ 获取用户信息失败 [${error.code}]: ${error.message}`)
  }
}

/**
 * 示例 4: 获取增强模块状态
 * @param {Object} client - The UnifiedMatrixClient instance
 */
async function exampleEnhancedStatus(client) {
  console.log('\n=== 示例 4: 增强模块状态 ===\n')

  try {
    const status = await client.enhanced.enhanced.getStatus()
    console.log('✅ 增强模块状态:')
    console.log(`  版本: ${status.version}`)
    console.log(`  状态: ${status.status}`)
    console.log(`  已初始化: ${status.initialized}`)
    console.log('  支持的功能:')
    console.log(`    - 好友: ${status.features.friends ? '✅' : '❌'}`)
    console.log(`    - 私聊: ${status.features.privateChat ? '✅' : '❌'}`)
    console.log(`    - 管理: ${status.features.admin ? '✅' : '❌'}`)
    console.log(`    - 安全: ${status.features.security ? '✅' : '❌'}`)
    console.log(`    - 语音: ${status.features.voice ? '✅' : '❌'}`)
  } catch (error) {
    console.error(`❌ 获取状态失败 [${error.code}]: ${error.message}`)
  }
}

/**
 * 示例 5: 错误处理
 * @param {Object} client - The UnifiedMatrixClient instance
 */
async function exampleErrorHandling(client) {
  console.log('\n=== 示例 5: 错误处理 ===\n')

  // 演示不同的错误类型
  console.log('\n测试: 参数错误')
  try {
    await client.enhanced.friends.getFriends({ page: -1, limit: 0 })
  } catch (error) {
    console.log(`  错误码: ${error.code}`)
    console.log(`  错误信息: ${error.message}`)
    console.log(`  HTTP 状态: ${error.statusCode}`)
    console.log(`  可重试: ${error.retryable}`)

    // 处理特定错误
    switch (error.code) {
      case ErrorCode.INVALID_PARAM:
        console.log('  → 参数错误，请检查输入')
        break
      case ErrorCode.RATE_LIMITED:
        console.log('  → 速率限制，请稍后重试')
        break
      case ErrorCode.FORBIDDEN:
        console.log('  → 权限不足，请检查访问令牌')
        break
      default:
        console.log('  → 未知错误')
    }
  }
}

/**
 * 主函数：运行所有示例
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║       Matrix JavaScript SDK - 基础客户端示例            ║')
  console.log('╚════════════════════════════════════════════════════════════╝')

  try {
    // 示例 1: 创建客户端
    await exampleCreateClient()

    // 使用已有的访问令牌创建客户端
    const client = new UnifiedMatrixClient({
      baseUrl: BASE_URL,
      accessToken: ACCESS_TOKEN,
      userId: USER_ID
    })

    // 示例 3: 获取用户信息
    await exampleWhoami(client)

    // 示例 4: 获取增强模块状态
    await exampleEnhancedStatus(client)

    // 示例 5: 错误处理
    await exampleErrorHandling(client)

    console.log('\n✅ 所有示例执行完成')
  } catch (error) {
    console.error('\n❌ 示例执行失败:', error)
  }
}

// 运行主函数
main().catch(console.error)

// 导出示例函数供其他模块使用
module.exports = {
  exampleCreateClient,
  exampleLogin,
  exampleWhoami,
  exampleEnhancedStatus,
  exampleErrorHandling
}
