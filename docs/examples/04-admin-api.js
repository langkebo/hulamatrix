/**
 * 管理功能 API 示例
 *
 * 演示如何：
 * 1. 获取系统统计信息
 * 2. 管理房间
 * 3. 管理用户
 * 4. 获取服务器信息
 */

import { SynapseEnhancedClient } from 'matrix-js-sdk'

async function main() {
  console.log('=== 管理功能 API 示例 ===\n')

  const client = new SynapseEnhancedClient({
    baseUrl: 'https://matrix.example.com',
    accessToken: process.env.MATRIX_ACCESS_TOKEN || 'your-access-token'
  })

  try {
    console.log('1. 获取系统统计信息')
    const stats = await client.admin.getStatistics()
    console.log('   - 服务器统计:')
    console.log(`     房间总数: ${stats.room_count}`)
    console.log(`     用户总数: ${stats.user_count}`)
    console.log(`     消息总数: ${stats.message_count}`)
    console.log(`     月活跃用户: ${stats.monthly_active_users}`)
    console.log(`     存储使用: ${(stats.storage_usage / 1024 / 1024).toFixed(2)} MB`)

    console.log('\n2. 获取服务器版本信息')
    const version = await client.admin.getServerVersion()
    console.log(`   - Matrix 版本: ${version.matrix_version}`)
    console.log(`   - Synapse 版本: ${version.synapse_version}`)
    console.log(`   - Python 版本: ${version.python_version}`)

    console.log('\n3. 获取用户列表（分页）')
    const usersResult = await client.admin.getUsers({
      from: 0,
      limit: 10,
      name: null,
      guests: true
    })
    console.log(`   - 用户总数: ${usersResult.total}`)
    console.log(`   - 当前页用户数: ${usersResult.users.length}`)

    if (usersResult.users.length > 0) {
      console.log('\n   前5个用户:')
      usersResult.users.slice(0, 5).forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.name} (${user.user_type || '普通用户'})`)
      })
    }

    console.log('\n4. 获取房间列表（分页）')
    const roomsResult = await client.admin.getRooms({
      from: 0,
      limit: 10,
      order_by: 'join_count',
      search_term: null
    })
    console.log(`   - 房间总数: ${roomsResult.total}`)
    console.log(`   - 当前页房间数: ${roomsResult.rooms.length}`)

    if (roomsResult.rooms.length > 0) {
      console.log('\n   前5个房间:')
      roomsResult.rooms.slice(0, 5).forEach((room, index) => {
        console.log(`   ${index + 1}. ${room.name || room.room_id}`)
        console.log(`      成员数: ${room.member_count}`)
        console.log(`      状态: ${room.state}`)
      })
    }

    console.log('\n5. 获取房间详情')
    if (roomsResult.rooms.length > 0) {
      const roomId = roomsResult.rooms[0].room_id
      const roomDetail = await client.admin.getRoomDetails(roomId)
      console.log(`   - 房间 ID: ${roomDetail.room_id}`)
      console.log(`   - 名称: ${roomDetail.name || '未设置'}`)
      console.log(`   - 创建者: ${roomDetail.creator}`)
      console.log(`   - 成员数: ${roomDetail.member_count}`)
      console.log(`   - 已加入: ${roomDetail.joined_members}`)
      console.log(`   - 已邀请: ${roomDetail.invited_members}`)
    }

    console.log('\n✅ 管理功能示例运行成功')
  } catch (error) {
    console.error('\n❌ 错误:', error.message)
    console.log('\n请确保:')
    console.log('1. 管理模块已启用')
    console.log('2. 用户有管理员权限')
    console.log('3. 目标房间/用户存在')
  }
}

main()
