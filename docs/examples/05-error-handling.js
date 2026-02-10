/**
 * 错误处理示例
 *
 * 演示如何：
 * 1. 使用 SynapseEnhancedError 处理错误
 * 2. 格式化错误响应
 * 3. 获取恢复建议
 * 4. 处理不同类型的错误
 */

import { SynapseEnhancedError, ErrorCode } from 'matrix-js-sdk'

async function main() {
  console.log('=== 错误处理示例 ===\n')

  console.log('1. 处理认证错误')
  const authError = new SynapseEnhancedError('Authentication failed: Invalid access token', 401, ErrorCode.AUTH_FAILED)
  console.log('   - 错误码:', authError.code)
  console.log('   - 消息:', authError.message)
  console.log('   - 状态码:', authError.statusCode)

  console.log('\n2. 处理速率限制错误')
  const rateLimitError = new SynapseEnhancedError(
    'Rate limit exceeded. Please try again later',
    429,
    ErrorCode.RATE_LIMIT_EXCEEDED
  )
  console.log('   - 错误码:', rateLimitError.code)
  console.log('   - 消息:', rateLimitError.message)
  console.log('   - 可重试:', rateLimitError.retryable)

  console.log('\n3. 处理房间不存在错误')
  const notFoundError = new SynapseEnhancedError('Room !room123:example.com not found', 404, ErrorCode.ROOM_NOT_FOUND)
  console.log('   - 错误码:', notFoundError.code)
  console.log('   - 消息:', notFoundError.message)

  console.log('\n4. 处理服务器内部错误')
  const serverError = new SynapseEnhancedError('Internal server error', 500, ErrorCode.INTERNAL_SERVER_ERROR)
  console.log('   - 错误码:', serverError.code)
  console.log('   - 消息:', serverError.message)

  console.log('\n5. 处理自定义错误')
  const customError = new SynapseEnhancedError('Custom error occurred', 400, ErrorCode.UNKNOWN)
  console.log('   - 错误码:', customError.code)
  console.log('   - 消息:', customError.message)

  console.log('\n✅ 错误处理示例运行成功')
}

main().catch(console.error)
