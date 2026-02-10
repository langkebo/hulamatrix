/**
 * 错误处理和重试机制演示
 *
 * 本示例演示如何：
 * 1. 使用 SynapseEnhancedError 识别错误类型
 * 2. 使用 ErrorCode 枚举处理特定错误
 * 3. 实现自定义重试逻辑
 * 4. 处理批量操作中的部分失败
 * 5. 使用 error.retryable 判断是否可重试
 */

import { UnifiedMatrixClient, SynapseEnhancedError, ErrorCode } from 'matrix-js-sdk'

// 配置信息
const BASE_URL = 'https://matrix.example.com'
const ACCESS_TOKEN = process.env.MATRIX_ACCESS_TOKEN || 'your-access-token'
const USER_ID = process.env.MATRIX_USER_ID || '@user:example.com'

// 创建客户端
const client = new UnifiedMatrixClient({
  baseUrl: BASE_URL,
  accessToken: ACCESS_TOKEN,
  userId: USER_ID
})

/**
 * 示例 1: 基本错误处理
 */
async function exampleBasicErrorHandling(): Promise<void> {
  console.log('=== 示例 1: 基本错误处理 ===\n')

  try {
    const friends = await client.enhanced.friends.getFriends({
      page: 1,
      limit: 20
    })
    console.log(`✅ 获取到 ${friends.total} 个好友`)
  } catch (error) {
    if (error instanceof SynapseEnhancedError) {
      console.error(`❌ 错误发生:`)
      console.error(`  错误码: ${error.code}`)
      console.error(`  错误信息: ${error.message}`)
      console.error(`  HTTP 状态: ${error.statusCode}`)
      console.error(`  可重试: ${error.retryable}`)
      console.error(`  详细信息:`, error.detail)
    } else {
      console.error('❌ 未知错误:', error)
    }
  }
}

/**
 * 示例 2: 使用 ErrorCode 枚举处理特定错误
 */
async function exampleErrorCodeHandling(): Promise<void> {
  console.log('\n=== 示例 2: 使用 ErrorCode 枚举 ===\n')

  try {
    // 模拟参数错误
    await client.enhanced.friends.getFriends({ page: -1, limit: 0 })
  } catch (error) {
    if (error instanceof SynapseEnhancedError) {
      switch (error.code) {
        case ErrorCode.INVALID_PARAM:
          console.log('❌ 参数错误: 请检查输入参数')
          break
        case ErrorCode.UNKNOWN_TOKEN:
          console.log('❌ 认证失败: 请检查访问令牌')
          break
        case ErrorCode.FORBIDDEN:
          console.log('❌ 权限不足: 您没有执行此操作的权限')
          break
        case ErrorCode.NOT_FOUND:
          console.log('❌ 资源不存在: 请求的资源未找到')
          break
        case ErrorCode.RATE_LIMITED: {
          console.log('❌ 速率限制: 请求过于频繁，请稍后重试')
          // 获取重试时间
          const retryAfter = error.detail?.retry_after as number
          if (retryAfter) {
            console.log(`   建议 ${retryAfter} 秒后重试`)
          }
          break
        }
        case ErrorCode.INTERNAL_ERROR:
          console.log('❌ 内部错误: 服务器处理请求时发生错误')
          break
        case ErrorCode.UNAVAILABLE:
          console.log('❌ 服务不可用: 服务器暂时无法响应')
          break
        default:
          console.log(`❌ 未知错误: ${error.message}`)
      }
    }
  }
}

/**
 * 示例 3: 使用 retryable 属性判断是否可重试
 */
async function exampleRetryableCheck(): Promise<void> {
  console.log('\n=== 示例 3: 判断错误是否可重试 ===\n')

  // 测试不同的错误类型
  const testCases = [
    {
      name: '参数错误',
      fn: () => client.enhanced.friends.getFriends({ page: -1 })
    },
    {
      name: '网络错误（模拟）',
      fn: () =>
        new UnifiedMatrixClient({
          baseUrl: 'https://invalid.example.com',
          accessToken: 'invalid'
        }).user.whoami()
    }
  ]

  for (const testCase of testCases) {
    console.log(`\n测试: ${testCase.name}`)
    try {
      await testCase.fn()
    } catch (error) {
      if (error instanceof SynapseEnhancedError) {
        console.log(`  错误码: ${error.code}`)
        console.log(`  可重试: ${error.retryable ? '是' : '否'}`)

        if (error.retryable) {
          console.log(`  → 建议实现重试逻辑`)
        } else {
          console.log(`  → 不建议重试，需要修复问题后重试`)
        }
      }
    }
  }
}

/**
 * 示例 4: 实现指数退避重试
 */
async function exampleExponentialBackoff(): Promise<void> {
  console.log('\n=== 示例 4: 指数退避重试 ===\n')

  async function fetchWithRetry(fn: () => Promise<unknown>, maxRetries = 3, initialDelay = 1000): Promise<unknown> {
    let lastError: unknown

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error

        if (error instanceof SynapseEnhancedError) {
          if (!error.retryable) {
            console.log(`  不可重试的错误，立即停止`)
            throw error
          }

          if (attempt < maxRetries) {
            const delay = initialDelay * 2 ** (attempt - 1)
            console.log(`  第 ${attempt} 次尝试失败，${delay}ms 后重试...`)
            await sleep(delay)
          }
        }
      }
    }

    throw lastError
  }

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  try {
    const _result = await fetchWithRetry(() => client.enhanced.friends.getFriends({ page: 1, limit: 20 }), 3, 1000)
    console.log('✅ 重试成功!')
  } catch (error) {
    if (error instanceof SynapseEnhancedError) {
      console.log(`❌ 所有重试失败: ${error.message}`)
    }
  }
}

/**
 * 示例 5: 处理速率限制错误
 */
async function exampleRateLimitHandling(): Promise<void> {
  console.log('\n=== 示例 5: 处理速率限制 ===\n')

  async function fetchWithRateLimitHandling(fn: () => Promise<unknown>): Promise<unknown> {
    while (true) {
      try {
        return await fn()
      } catch (error) {
        if (error instanceof SynapseEnhancedError) {
          if (error.code === ErrorCode.RATE_LIMITED) {
            const retryAfter = (error.detail?.retry_after as number) || 5
            console.log(`⏳ 速率限制，等待 ${retryAfter} 秒后重试...`)
            await sleep(retryAfter * 1000)
            continue // 重试
          }
          throw error // 其他错误直接抛出
        }
        throw error
      }
    }
  }

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  try {
    const _result = await fetchWithRateLimitHandling(() => client.enhanced.friends.getFriends({ page: 1, limit: 20 }))
    console.log('✅ 请求成功!')
  } catch (error) {
    if (error instanceof SynapseEnhancedError) {
      console.log(`❌ 请求失败: ${error.message}`)
    }
  }
}

/**
 * 示例 6: 批量操作的错误处理
 */
async function exampleBatchOperationErrors(): Promise<void> {
  console.log('\n=== 示例 6: 批量操作错误处理 ===\n')

  try {
    // 批量用户操作
    const result = await client.enhanced.admin.batchUserOperations([
      { user_id: '@user1:example.com', action: 'suspend' },
      { user_id: '@user2:example.com', action: 'activate' },
      { user_id: '@user3:example.com', action: 'delete' }
    ])

    console.log(`✅ 批量操作完成:`)
    console.log(`  总数: ${result.total_count}`)
    console.log(`  成功: ${result.total_success}`)
    console.log(`  失败: ${result.total_failed}`)

    // 处理失败的操作
    if (result.failures && result.failures.length > 0) {
      console.log(`\n失败的操作:`)
      result.failures.forEach((failure) => {
        console.log(`  - ${failure.user_id}: ${failure.error}`)
      })
    }
  } catch (error) {
    if (error instanceof SynapseEnhancedError) {
      console.log(`❌ 批量操作失败: ${error.message}`)
    }
  }
}

/**
 * 示例 7: 带超时的请求
 */
async function exampleWithTimeout(): Promise<void> {
  console.log('\n=== 示例 7: 带超时的请求 ===\n')

  async function fetchWithTimeout<T>(fn: () => Promise<T>, timeoutMs = 5000): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new SynapseEnhancedError('请求超时', ErrorCode.TIMEOUT, undefined, 408, true))
      }, timeoutMs)
    })

    return Promise.race([fn(), timeoutPromise])
  }

  try {
    const _result = await fetchWithTimeout(() => client.enhanced.friends.getFriends({ page: 1, limit: 20 }), 5000)
    console.log('✅ 请求在超时前完成')
  } catch (error) {
    if (error instanceof SynapseEnhancedError) {
      if (error.code === ErrorCode.TIMEOUT) {
        console.log('❌ 请求超时')
      } else {
        console.log(`❌ 请求失败: ${error.message}`)
      }
    }
  }
}

/**
 * 主函数：运行所有示例
 */
async function main(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║       Matrix JavaScript SDK - 错误处理示例              ║')
  console.log('╚════════════════════════════════════════════════════════════╝')

  try {
    // 示例 1: 基本错误处理
    await exampleBasicErrorHandling()

    // 示例 2: 使用 ErrorCode 枚举
    await exampleErrorCodeHandling()

    // 示例 3: 判断是否可重试
    await exampleRetryableCheck()

    // 示例 4: 指数退避重试
    await exampleExponentialBackoff()

    // 示例 5: 处理速率限制
    await exampleRateLimitHandling()

    // 示例 6: 批量操作错误处理
    await exampleBatchOperationErrors()

    // 示例 7: 带超时的请求
    await exampleWithTimeout()

    console.log('\n✅ 所有示例执行完成')
  } catch (error) {
    console.error('\n❌ 示例执行失败:', error)
  }
}

// 运行主函数
main().catch(console.error)

// 导出示例函数供其他模块使用
export {
  exampleBasicErrorHandling,
  exampleErrorCodeHandling,
  exampleRetryableCheck,
  exampleExponentialBackoff,
  exampleRateLimitHandling,
  exampleBatchOperationErrors,
  exampleWithTimeout
}
