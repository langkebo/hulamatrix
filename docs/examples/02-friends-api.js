/**
 * 好友功能 API 示例
 *
 * 演示如何：
 * 1. 获取好友列表
 * 2. 搜索好友
 * 3. 管理好友请求
 * 4. 使用好友分类
 */

import { SynapseEnhancedClient } from 'matrix-js-sdk'

async function main() {
  console.log('=== 好友功能 API 示例 ===\n')

  const client = new SynapseEnhancedClient({
    baseUrl: 'https://matrix.example.com',
    accessToken: process.env.MATRIX_ACCESS_TOKEN || 'your-access-token'
  })

  try {
    console.log('1. 获取好友列表')
    const friendsResult = await client.friends.getFriends({
      category: 'all',
      page: 1,
      limit: 20
    })
    console.log(`   - 好友总数: ${friendsResult.total}`)
    console.log(`   - 当前页: ${friendsResult.page}`)
    console.log(`   - 每页数量: ${friendsResult.limit}`)
    console.log(`   - 好友列表长度: ${friendsResult.friends.length}`)

    if (friendsResult.friends.length > 0) {
      console.log('\n   前3个好友:')
      friendsResult.friends.slice(0, 3).forEach((friend, index) => {
        console.log(`   ${index + 1}. ${friend.displayname || friend.userId}`)
      })
    }

    console.log('\n2. 搜索好友')
    const searchResult = await client.friends.searchFriends({
      q: 'test',
      limit: 10
    })
    console.log(`   - 搜索结果数量: ${searchResult.results.length}`)

    if (searchResult.results.length > 0) {
      console.log('\n   搜索结果:')
      searchResult.results.forEach((result) => {
        console.log(`   - ${result.displayname || result.userId} (相似度: ${result.score || 'N/A'})`)
      })
    }

    console.log('\n3. 检查好友关系')
    const isFriend = await client.friends.checkFriendship('@alice:example.com')
    console.log(`   - 与 @alice:example.com 是好友: ${isFriend}`)

    console.log('\n4. 获取好友分类')
    const categories = await client.friends.getCategories()
    console.log(`   - 分类数量: ${categories.length}`)
    categories.forEach((category) => {
      console.log(`   - ${category.name}: ${category.count} 个好友`)
    })

    console.log('\n✅ 好友功能示例运行成功')
  } catch (error) {
    console.error('\n❌ 错误:', error.message)
    console.log('\n请确保:')
    console.log('1. 好友模块已启用')
    console.log('2. 用户存在')
    console.log('3. 有相应的权限')
  }
}

main()
