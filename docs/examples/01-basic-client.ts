/**
 * 基础客户端连接示例
 *
 * 本示例演示如何：
 * 1. 使用 UnifiedMatrixClient 初始化（推荐方式）
 * 2. 用户注册和登录
 * 3. 获取客户端状态
 * 4. 初始化端到端加密
 * 5. 基本错误处理
 */

import { UnifiedMatrixClient, SynapseEnhancedError, ErrorCode } from 'matrix-js-sdk'

// 配置信息
const BASE_URL = 'https://matrix.example.com'
const ACCESS_TOKEN = process.env.MATRIX_ACCESS_TOKEN || 'your-access-token'
const USER_ID = process.env.MATRIX_USER_ID || '@user:example.com'

/**
 * 示例 1: 创建 UnifiedMatrixClient（推荐方式）
 */
async function exampleCreateClient(): Promise<void> {
  console.log('=== 示例 1: 创建 UnifiedMatrixClient ===\n')

  // 创建统一客户端
  const _client = new UnifiedMatrixClient({
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
 * 示例 2: 用户注册
 */
async function exampleRegister(): Promise<void> {
  console.log('\n=== 示例 2: 用户注册 ===\n')

  const client = new UnifiedMatrixClient({
    baseUrl: BASE_URL
  })

  try {
    const result = await client.auth.register({
      username: 'newuser',
      password: 'securePassword123',
      device_id: 'DEVICE001',
      initial_device_display_name: 'My Device',
      inhibit_login: false // 注册后自动登录
    })

    console.log('✅ 注册成功:')
    console.log(`  用户 ID: ${result.user_id}`)
    console.log(`  设备 ID: ${result.device_id}`)
    console.log(`  访问令牌: ${result.access_token?.substring(0, 20)}...`)

    // 使用返回的令牌创建新的客户端实例
    const authenticatedClient = new UnifiedMatrixClient({
      baseUrl: BASE_URL,
      accessToken: result.access_token!,
      userId: result.user_id
    })

    return authenticatedClient
  } catch (error) {
    if (error instanceof SynapseEnhancedError) {
      console.error(`❌ 注册失败 [${error.code}]: ${error.message}`)
      if (error.code === ErrorCode.USER_NOT_FOUND) {
        console.log('提示: 用户可能已存在')
      }
    }
  }
}

/**
 * 示例 3: 用户登录
 */
async function exampleLogin(): Promise<UnifiedMatrixClient | undefined> {
  console.log('\n=== 示例 3: 用户登录 ===\n')

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
      accessToken: result.access_token!,
      userId: result.user_id
    })

    return authenticatedClient
  } catch (error) {
    if (error instanceof SynapseEnhancedError) {
      console.error(`❌ 登录失败 [${error.code}]: ${error.message}`)
    }
  }
}

/**
 * 示例 4: 获取用户信息
 */
async function exampleWhoami(client: UnifiedMatrixClient): Promise<void> {
  console.log('\n=== 示例 4: 获取用户信息 ===\n')

  try {
    const whoami = await client.user.whoami()
    console.log('✅ 当前用户信息:')
    console.log(`  用户 ID: ${whoami.user_id}`)
    console.log(`  设备 ID: ${whoami.device_id || 'N/A'}`)
  } catch (error) {
    if (error instanceof SynapseEnhancedError) {
      console.error(`❌ 获取用户信息失败 [${error.code}]: ${error.message}`)
    }
  }
}

/**
 * 示例 5: 获取增强模块状态
 */
async function exampleEnhancedStatus(client: UnifiedMatrixClient): Promise<void> {
  console.log('\n=== 示例 5: 增强模块状态 ===\n')

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
    if (error instanceof SynapseEnhancedError) {
      console.error(`❌ 获取状态失败 [${error.code}]: ${error.message}`)
    }
  }
}

/**
 * 示例 6: 初始化端到端加密（可选）
 */
async function exampleInitCrypto(client: UnifiedMatrixClient): Promise<void> {
  console.log('\n=== 示例 6: 初始化端到端加密 ===\n')

  try {
    // 初始化 Rust Crypto
    await client.initCrypto()
    console.log('✅ E2EE 初始化成功')

    // 启动客户端以接收实时事件
    await client.start()
    console.log('✅ 客户端已启动，开始同步...')

    // 监听事件
    client.getMatrixClient().on('event', (event) => {
      console.log(`📨 收到事件: ${event.getType()}`)
    })

    // 5秒后停止客户端
    setTimeout(() => {
      client.stop()
      console.log('⏹️  客户端已停止')
    }, 5000)
  } catch (error) {
    if (error instanceof SynapseEnhancedError) {
      console.error(`❌ E2EE 初始化失败 [${error.code}]: ${error.message}`)
    }
  }
}

/**
 * 示例 7: 错误处理
 */
async function exampleErrorHandling(client: UnifiedMatrixClient): Promise<void> {
  console.log('\n=== 示例 7: 错误处理 ===\n')

  // 演示不同的错误类型
  const examples = [
    {
      name: '参数错误',
      fn: () => client.enhanced.friends.getFriends({ page: -1, limit: 0 })
    },
    {
      name: '网络错误',
      fn: () =>
        new UnifiedMatrixClient({ baseUrl: 'https://invalid.example.com', accessToken: 'invalid' }).user.whoami()
    }
  ]

  for (const example of examples) {
    console.log(`\n测试: ${example.name}`)
    try {
      await example.fn()
    } catch (error) {
      if (error instanceof SynapseEnhancedError) {
        console.log(`  错误码: ${error.code}`)
        console.log(`  错误信息: ${error.message}`)
        console.log(`  HTTP 状态: ${error.statusCode}`)
        console.log(`  可重试: ${error.retryable}`)
      }
    }
  }
}

/**
 * 主函数：运行所有示例
 */
async function main(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║       Matrix JavaScript SDK - 基础客户端示例            ║')
  console.log('╚════════════════════════════════════════════════════════════╝')

  try {
    // 示例 1: 创建客户端
    await exampleCreateClient()

    // 示例 2: 注册（可选，通常用户已存在）
    // await exampleRegister();

    // 示例 3: 登录（或使用已有的访问令牌）
    const client = new UnifiedMatrixClient({
      baseUrl: BASE_URL,
      accessToken: ACCESS_TOKEN,
      userId: USER_ID
    })

    // 示例 4: 获取用户信息
    await exampleWhoami(client)

    // 示例 5: 获取增强模块状态
    await exampleEnhancedStatus(client)

    // 示例 6: 初始化 E2EE（可选）
    // await exampleInitCrypto(client);

    // 示例 7: 错误处理
    // await exampleErrorHandling(client);

    console.log('\n✅ 所有示例执行完成')
  } catch (error) {
    console.error('\n❌ 示例执行失败:', error)
  }
}

// 运行主函数
main().catch(console.error)

// 导出示例函数供其他模块使用
export {
  exampleCreateClient,
  exampleRegister,
  exampleLogin,
  exampleWhoami,
  exampleEnhancedStatus,
  exampleInitCrypto,
  exampleErrorHandling
}
