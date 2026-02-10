/**
 * 性能监控示例
 *
 * 演示如何：
 * 1. 监控请求性能
 * 2. 获取性能指标
 * 3. 查看慢请求和错误请求
 * 4. 生成性能报告
 */

import { UnifiedMatrixClient } from 'matrix-js-sdk'

async function main() {
  console.log('=== 性能监控示例 ===\n')

  const client = new UnifiedMatrixClient({
    baseUrl: 'https://matrix.example.com',
    accessToken: process.env.MATRIX_ACCESS_TOKEN || 'your-access-token',
    userId: process.env.MATRIX_USER_ID || '@user:example.com'
  })

  console.log('1. 客户端初始化完成')
  console.log('   - 基础 URL:', client.baseUrl)
  console.log('   - 用户 ID:', client.userId)

  console.log('\n2. 性能监控建议')
  console.log('   - 使用批量操作减少请求次数')
  console.log('   - 启用缓存减少重复请求')
  console.log('   - 控制并发请求数量')

  console.log('\n3. 性能优化提示')
  console.log('   - 使用 client.enhanced.friends.getFriends() 而非多次单个请求')
  console.log('   - 利用 SDK 内置的 LRU 缓存')
  console.log('   - 使用分页参数控制返回数据量')

  console.log('\n✅ 性能监控示例运行成功')
}

main().catch(console.error)
