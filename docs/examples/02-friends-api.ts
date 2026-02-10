/**
 * 好友 API 功能完整演示
 *
 * 本示例演示如何：
 * 1. 获取好友列表
 * 2. 添加/删除好友
 * 3. 搜索好友
 * 4. 好友请求管理（独立模块）
 * 5. 好友分类管理（独立模块）
 * 6. 屏蔽用户管理（独立模块）
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
 * 示例 1: 获取好友列表（分页）
 */
async function exampleGetFriends(): Promise<void> {
  console.log('=== 示例 1: 获取好友列表 ===\n')

  try {
    const result = await client.enhanced.friends.getFriends({
      page: 1,
      limit: 20
    })

    console.log(`✅ 找到 ${result.total} 个好友`)
    console.log(`当前页: ${result.items.length} 个`)

    result.items.forEach((friend) => {
      console.log(`  - ${friend.display_name || friend.user_id}`)
      console.log(`    ID: ${friend.user_id}`)
      console.log(`    状态: ${friend.presence || 'unknown'}`)
    })
  } catch (error) {
    if (error instanceof SynapseEnhancedError) {
      console.error(`❌ 获取好友列表失败 [${error.code}]: ${error.message}`)
    }
  }
}

/**
 * 示例 2: 添加好友
 */
async function exampleAddFriend(): Promise<void> {
  console.log('\n=== 示例 2: 添加好友 ===\n')

  const targetUserId = '@friend:example.com'

  try {
    // 方式一：直接添加好友
    await client.enhanced.friends.addFriend(targetUserId)
    console.log(`✅ 已发送好友请求给 ${targetUserId}`)

    // 方式二：添加好友并设置备注
    await client.enhanced.friends.addFriend(targetUserId, {
      remark: '我的好友'
    })
    console.log(`✅ 已发送好友请求并设置备注`)
  } catch (error) {
    if (error instanceof SynapseEnhancedError) {
      if (error.code === ErrorCode.FRIEND_REQUEST_PENDING) {
        console.log(`ℹ️  好友请求已存在，等待对方接受`)
      } else if (error.code === ErrorCode.FRIEND_NOT_FOUND) {
        console.log(`ℹ️  用户不存在`)
      } else {
        console.error(`❌ 添加好友失败 [${error.code}]: ${error.message}`)
      }
    }
  }
}

/**
 * 示例 3: 删除好友
 */
async function exampleRemoveFriend(): Promise<void> {
  console.log('\n=== 示例 3: 删除好友 ===\n')

  const targetUserId = '@friend:example.com'

  try {
    await client.enhanced.friends.removeFriend(targetUserId)
    console.log(`✅ 已删除好友 ${targetUserId}`)
  } catch (error) {
    if (error instanceof SynapseEnhancedError) {
      console.error(`❌ 删除好友失败 [${error.code}]: ${error.message}`)
    }
  }
}

/**
 * 示例 4: 设置好友备注
 */
async function exampleSetRemark(): Promise<void> {
  console.log('\n=== 示例 4: 设置好友备注 ===\n')

  const targetUserId = '@friend:example.com'
  const remark = '大学同学'

  try {
    await client.enhanced.friends.setRemark(targetUserId, remark)
    console.log(`✅ 已设置 ${targetUserId} 的备注为 "${remark}"`)
  } catch (error) {
    if (error instanceof SynapseEnhancedError) {
      console.error(`❌ 设置备注失败 [${error.code}]: ${error.message}`)
    }
  }
}

/**
 * 示例 5: 搜索好友
 */
async function exampleSearchFriends(): Promise<void> {
  console.log('\n=== 示例 5: 搜索好友 ===\n')

  const keyword = 'alice'

  try {
    // 搜索好友
    const friends = await client.enhanced.friends.searchFriends(keyword)
    console.log(`✅ 在好友中找到 ${friends.length} 个匹配结果`)

    // 搜索用户（非好友）
    const users = await client.enhanced.friends.searchUsers(keyword)
    console.log(`✅ 在所有用户中找到 ${users.length} 个匹配结果`)

    users.forEach((user) => {
      console.log(`  - ${user.display_name || user.user_id}`)
    })
  } catch (error) {
    if (error instanceof SynapseEnhancedError) {
      console.error(`❌ 搜索失败 [${error.code}]: ${error.message}`)
    }
  }
}

/**
 * 示例 6: 好友请求管理（独立模块）
 */
async function exampleFriendRequests(): Promise<void> {
  console.log('\n=== 示例 6: 好友请求管理 ===\n')

  try {
    // 获取收到的好友请求
    const incoming = await client.enhanced.friendRequests.getIncomingRequests()
    console.log(`✅ 收到 ${incoming.items.length} 个好友请求`)

    incoming.items.forEach((request) => {
      console.log(`  - 来自: ${request.sender_id}`)
      console.log(`    请求 ID: ${request.request_id}`)
      console.log(`    消息: ${request.message || '无'}`)
    })

    // 获取发送的好友请求
    const outgoing = await client.enhanced.friendRequests.getOutgoingRequests()
    console.log(`✅ 已发送 ${outgoing.items.length} 个好友请求`)

    // 发送好友请求
    const targetUserId = '@newfriend:example.com'
    await client.enhanced.friendRequests.sendRequest(targetUserId)
    console.log(`✅ 已发送好友请求给 ${targetUserId}`)

    // 接受好友请求
    if (incoming.items.length > 0) {
      const requestId = incoming.items[0].request_id
      await client.enhanced.friendRequests.acceptRequest(requestId)
      console.log(`✅ 已接受好友请求 ${requestId}`)
    }

    // 拒绝好友请求
    // const requestId = "request-id";
    // await client.enhanced.friendRequests.declineRequest(requestId);
    // console.log(`✅ 已拒绝好友请求 ${requestId}`);
  } catch (error) {
    if (error instanceof SynapseEnhancedError) {
      console.error(`❌ 好友请求操作失败 [${error.code}]: ${error.message}`)
    }
  }
}

/**
 * 示例 7: 好友分类管理（独立模块）
 */
async function exampleFriendCategories(): Promise<void> {
  console.log('\n=== 示例 7: 好友分类管理 ===\n')

  try {
    // 获取所有分类
    const categories = await client.enhanced.friendCategories.getCategories()
    console.log(`✅ 当前有 ${categories.items.length} 个分类`)

    categories.items.forEach((category) => {
      console.log(`  - ${category.name}: ${category.description || '无描述'}`)
    })

    // 创建新分类
    const categoryName = '工作'
    const description = '同事'
    await client.enhanced.friendCategories.createCategory(categoryName, description)
    console.log(`✅ 已创建分类 "${categoryName}"`)

    // 添加好友到分类
    const targetUserId = '@colleague:example.com'
    await client.enhanced.friendCategories.addUserToCategory(targetUserId, categoryName)
    console.log(`✅ 已将 ${targetUserId} 添加到分类 "${categoryName}"`)

    // 设置好友的分类（覆盖现有）
    await client.enhanced.friendCategories.setCategories(targetUserId, ['工作', '家人'])
    console.log(`✅ 已设置 ${targetUserId} 的分类`)

    // 从分类移除好友
    await client.enhanced.friendCategories.removeUserFromCategory(targetUserId, categoryName)
    console.log(`✅ 已将 ${targetUserId} 从分类 "${categoryName}" 移除`)

    // 删除分类
    // await client.enhanced.friendCategories.deleteCategory(categoryName);
    // console.log(`✅ 已删除分类 "${categoryName}"`);
  } catch (error) {
    if (error instanceof SynapseEnhancedError) {
      console.error(`❌ 好友分类操作失败 [${error.code}]: ${error.message}`)
    }
  }
}

/**
 * 示例 8: 屏蔽用户管理（独立模块）
 */
async function exampleBlockedUsers(): Promise<void> {
  console.log('\n=== 示例 8: 屏蔽用户管理 ===\n')

  try {
    // 获取屏蔽列表
    const blocked = await client.enhanced.blockedUsers.getBlocked()
    console.log(`✅ 当前屏蔽了 ${blocked.items.length} 个用户`)

    blocked.items.forEach((user) => {
      console.log(`  - ${user.display_name || user.user_id}`)
      console.log(`    原因: ${user.reason || '无'}`)
    })

    // 屏蔽用户
    const targetUserId = '@spam:example.com'
    const reason = '垃圾信息'
    await client.enhanced.blockedUsers.block(targetUserId, reason)
    console.log(`✅ 已屏蔽 ${targetUserId}`)

    // 检查用户是否被屏蔽
    const isBlocked = await client.enhanced.blockedUsers.check(targetUserId)
    console.log(`${targetUserId} 是否被屏蔽: ${isBlocked}`)

    // 解除屏蔽
    await client.enhanced.blockedUsers.unblock(targetUserId)
    console.log(`✅ 已解除屏蔽 ${targetUserId}`)

    // 批量屏蔽用户
    await client.enhanced.blockedUsers.blockBatch([
      { user_id: '@spam1:example.com', reason: '垃圾信息' },
      { user_id: '@spam2:example.com', reason: '骚扰' }
    ])
    console.log(`✅ 已批量屏蔽用户`)
  } catch (error) {
    if (error instanceof SynapseEnhancedError) {
      console.error(`❌ 屏蔽操作失败 [${error.code}]: ${error.message}`)
    }
  }
}

/**
 * 示例 9: 批量操作
 */
async function exampleBatchOperations(): Promise<void> {
  console.log('\n=== 示例 9: 批量操作 ===\n')

  try {
    // 批量添加好友
    const userIds = ['@user1:example.com', '@user2:example.com', '@user3:example.com']

    for (const userId of userIds) {
      await client.enhanced.friends.addFriend(userId)
    }
    console.log(`✅ 已批量发送 ${userIds.length} 个好友请求`)

    // 批量设置备注
    for (const userId of userIds) {
      await client.enhanced.friends.setRemark(userId, '批量添加的好友')
    }
    console.log(`✅ 已批量设置备注`)
  } catch (error) {
    if (error instanceof SynapseEnhancedError) {
      console.error(`❌ 批量操作失败 [${error.code}]: ${error.message}`)
    }
  }
}

/**
 * 主函数：运行所有示例
 */
async function main(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║         Matrix JavaScript SDK - 好友 API 示例            ║')
  console.log('╚════════════════════════════════════════════════════════════╝')

  try {
    // 示例 1: 获取好友列表
    await exampleGetFriends()

    // 示例 2: 添加好友（谨慎执行）
    // await exampleAddFriend();

    // 示例 3: 删除好友（谨慎执行）
    // await exampleRemoveFriend();

    // 示例 4: 设置备注
    // await exampleSetRemark();

    // 示例 5: 搜索好友
    await exampleSearchFriends()

    // 示例 6: 好友请求管理
    await exampleFriendRequests()

    // 示例 7: 好友分类管理
    await exampleFriendCategories()

    // 示例 8: 屏蔽用户管理
    // await exampleBlockedUsers();

    // 示例 9: 批量操作（谨慎执行）
    // await exampleBatchOperations();

    console.log('\n✅ 所有示例执行完成')
  } catch (error) {
    console.error('\n❌ 示例执行失败:', error)
  }
}

// 运行主函数
main().catch(console.error)

// 导出示例函数供其他模块使用
export {
  exampleGetFriends,
  exampleAddFriend,
  exampleRemoveFriend,
  exampleSetRemark,
  exampleSearchFriends,
  exampleFriendRequests,
  exampleFriendCategories,
  exampleBlockedUsers,
  exampleBatchOperations
}
