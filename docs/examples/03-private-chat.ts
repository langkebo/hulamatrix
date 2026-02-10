/**
 * 私聊功能完整演示
 *
 * 本示例演示如何：
 * 1. 创建私聊会话
 * 2. 发送文本/图片/文件消息
 * 3. 获取聊天历史
 * 4. 未读消息统计
 * 5. 标记消息为已读
 * 6. 搜索私聊消息
 * 7. 回复消息
 * 8. 阅后即焚（Burn After Reading）
 */

import { UnifiedMatrixClient, SynapseEnhancedError } from 'matrix-js-sdk'

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
 * 示例 1: 创建私聊会话
 */
async function exampleCreateSession(): Promise<void> {
  console.log('=== 示例 1: 创建私聊会话 ===\n')

  const targetUserId = '@friend:example.com'

  try {
    // 创建私聊会话（自动启用端到端加密）
    const sessionId = await client.enhanced.privateChat.createSession({
      participants: [targetUserId],
      session_name: '与朋友的私聊', // 可选
      ttl_seconds: 0, // 可选：消息生存时间（0 = 永久）
      auto_delete: false // 可选：是否自动删除
    })

    console.log(`✅ 私聊会话创建成功`)
    console.log(`  会话 ID: ${sessionId}`)
    console.log(`  会话已启用端到端加密`)
  } catch (error) {
    if (error instanceof SynapseEnhancedError) {
      console.error(`❌ 创建会话失败 [${error.code}]: ${error.message}`)
    }
  }
}

/**
 * 示例 2: 发送文本消息
 */
async function exampleSendTextMessage(): Promise<void> {
  console.log('\n=== 示例 2: 发送文本消息 ===\n')

  const roomId = '!room:example.com' // 私聊房间的 ID

  try {
    // 发送文本消息
    const eventId = await client.enhanced.privateChat.sendMessage({
      room_id: roomId,
      content: '你好！这是一条私聊消息。',
      type: 'm.text'
    })

    console.log(`✅ 文本消息发送成功`)
    console.log(`  事件 ID: ${eventId}`)
  } catch (error) {
    if (error instanceof SynapseEnhancedError) {
      console.error(`❌ 发送消息失败 [${error.code}]: ${error.message}`)
    }
  }
}

/**
 * 示例 3: 发送图片消息
 */
async function exampleSendImageMessage(): Promise<void> {
  console.log('\n=== 示例 3: 发送图片消息 ===\n')

  const roomId = '!room:example.com'
  const imageUrl = 'mxc://example.com/image123' // 已上传的图片 URL

  try {
    // 发送图片消息
    const eventId = await client.enhanced.privateChat.sendMessage({
      room_id: roomId,
      content: '这是一张图片',
      type: 'm.image',
      file_url: imageUrl
    })

    console.log(`✅ 图片消息发送成功`)
    console.log(`  事件 ID: ${eventId}`)
  } catch (error) {
    if (error instanceof SynapseEnhancedError) {
      console.error(`❌ 发送图片失败 [${error.code}]: ${error.message}`)
    }
  }
}

/**
 * 示例 4: 发送文件消息
 */
async function exampleSendFileMessage(): Promise<void> {
  console.log('\n=== 示例 4: 发送文件消息 ===\n')

  const roomId = '!room:example.com'
  const fileUrl = 'mxc://example.com/file123' // 已上传的文件 URL

  try {
    // 发送文件消息
    const eventId = await client.enhanced.privateChat.sendMessage({
      room_id: roomId,
      content: '请查看附件',
      type: 'm.file',
      file_url: fileUrl
    })

    console.log(`✅ 文件消息发送成功`)
    console.log(`  事件 ID: ${eventId}`)
  } catch (error) {
    if (error instanceof SynapseEnhancedError) {
      console.error(`❌ 发送文件失败 [${error.code}]: ${error.message}`)
    }
  }
}

/**
 * 示例 5: 获取聊天历史
 */
async function exampleGetMessages(): Promise<void> {
  console.log('\n=== 示例 5: 获取聊天历史 ===\n')

  const sessionId = '!room:example.com'

  try {
    // 获取最近的消息
    const messages = await client.enhanced.privateChat.getMessages(sessionId, {
      limit: 20
    })

    console.log(`✅ 获取到 ${messages.length} 条消息`)

    messages.forEach((msg) => {
      console.log(`  [${msg.sender_id}] ${msg.content}`)
    })
  } catch (error) {
    if (error instanceof SynapseEnhancedError) {
      console.error(`❌ 获取消息失败 [${error.code}]: ${error.message}`)
    }
  }
}

/**
 * 示例 6: 获取会话列表
 */
async function exampleGetSessions(): Promise<void> {
  console.log('\n=== 示例 6: 获取会话列表 ===\n')

  try {
    // 获取所有私聊会话
    const sessions = await client.enhanced.privateChat.getSessions()

    console.log(`✅ 找到 ${sessions.length} 个私聊会话`)

    sessions.forEach((session) => {
      console.log(`  - ${session.session_id}`)
      console.log(`    名称: ${session.session_name || '未命名'}`)
      console.log(`    参与者: ${session.participants?.join(', ')}`)
      console.log(`    加密: ${session.is_encrypted ? '是' : '否'}`)
    })
  } catch (error) {
    if (error instanceof SynapseEnhancedError) {
      console.error(`❌ 获取会话列表失败 [${error.code}]: ${error.message}`)
    }
  }
}

/**
 * 示例 7: 获取未读消息数
 */
async function exampleGetUnreadCount(): Promise<void> {
  console.log('\n=== 示例 7: 获取未读消息数 ===\n')

  try {
    // 获取未读消息统计
    const unread = await client.enhanced.privateChat.getUnreadCount()

    console.log(`✅ 未读消息统计:`)
    console.log(`  总未读: ${unread.total_unread}`)
    console.log(`  按房间: ${unread.by_room?.length || 0} 个房间`)
  } catch (error) {
    if (error instanceof SynapseEnhancedError) {
      console.error(`❌ 获取未读数失败 [${error.code}]: ${error.message}`)
    }
  }
}

/**
 * 示例 8: 标记消息为已读
 */
async function exampleMarkAsRead(): Promise<void> {
  console.log('\n=== 示例 8: 标记消息为已读 ===\n')

  const messageId = '$event:example.com'

  try {
    // 标记消息为已读
    await client.enhanced.privateChat.markAsRead(messageId, USER_ID)
    console.log(`✅ 消息已标记为已读`)
  } catch (error) {
    if (error instanceof SynapseEnhancedError) {
      console.error(`❌ 标记已读失败 [${error.code}]: ${error.message}`)
    }
  }
}

/**
 * 示例 9: 搜索私聊消息
 */
async function exampleSearchMessages(): Promise<void> {
  console.log('\n=== 示例 9: 搜索私聊消息 ===\n')

  try {
    // 搜索消息
    const results = await client.enhanced.privateChat.searchMessages({
      query: '关键词',
      room_id: '!room:example.com',
      limit: 20
    })

    console.log(`✅ 搜索到 ${results.length} 条匹配消息`)

    results.forEach((msg) => {
      console.log(`  [${msg.sender_id}] ${msg.content}`)
    })
  } catch (error) {
    if (error instanceof SynapseEnhancedError) {
      console.error(`❌ 搜索消息失败 [${error.code}]: ${error.message}`)
    }
  }
}

/**
 * 示例 10: 回复消息
 */
async function exampleReplyMessage(): Promise<void> {
  console.log('\n=== 示例 10: 回复消息 ===\n')

  const roomId = '!room:example.com'
  const replyToEventId = '$event:example.com'

  try {
    // 回复消息
    const eventId = await client.enhanced.privateChat.sendMessage({
      room_id: roomId,
      content: '这是一条回复消息',
      type: 'm.text',
      reply_to: replyToEventId
    })

    console.log(`✅ 回复消息发送成功`)
    console.log(`  事件 ID: ${eventId}`)
  } catch (error) {
    if (error instanceof SynapseEnhancedError) {
      console.error(`❌ 回复消息失败 [${error.code}]: ${error.message}`)
    }
  }
}

/**
 * 示例 11: 创建阅后即焚会话
 */
async function exampleBurnAfterReading(): Promise<void> {
  console.log('\n=== 示例 11: 创建阅后即焚会话 ===\n')

  const targetUserId = '@friend:example.com'

  try {
    // 创建阅后即焚会话
    const sessionId = await client.enhanced.privateChat.createSession({
      participants: [targetUserId],
      session_name: '阅后即焚聊天',
      ttl_seconds: 60, // 消息 60 秒后自动删除
      auto_delete: true // 启用自动删除
    })

    console.log(`✅ 阅后即焚会话创建成功`)
    console.log(`  会话 ID: ${sessionId}`)
    console.log(`  消息将在阅读后 60 秒自动删除`)
  } catch (error) {
    if (error instanceof SynapseEnhancedError) {
      console.error(`❌ 创建会话失败 [${error.code}]: ${error.message}`)
    }
  }
}

/**
 * 示例 12: 获取会话统计信息
 */
async function exampleGetSessionStatistics(): Promise<void> {
  console.log('\n=== 示例 12: 获取会话统计 ===\n')

  const sessionId = '!room:example.com'

  try {
    // 获取会话统计
    const stats = await client.enhanced.privateChat.getSessionStatistics(sessionId)

    console.log(`✅ 会话统计:`)
    console.log(`  消息数: ${stats.messageCount}`)
    console.log(`  参与者数: ${stats.participantCount}`)
    console.log(`  最后活动: ${stats.lastActivity}`)
  } catch (error) {
    if (error instanceof SynapseEnhancedError) {
      console.error(`❌ 获取统计失败 [${error.code}]: ${error.message}`)
    }
  }
}

/**
 * 示例 13: 获取会话详情
 */
async function exampleGetSessionDetail(): Promise<void> {
  console.log('\n=== 示例 13: 获取会话详情 ===\n')

  const roomId = '!room:example.com'

  try {
    // 获取会话详情
    const detail = await client.enhanced.privateChat.getChatroomDetail(roomId)

    if (detail) {
      console.log(`✅ 会话详情:`)
      console.log(`  房间 ID: ${detail.room_id}`)
      console.log(`  名称: ${detail.name}`)
      console.log(`  主题: ${detail.topic || '无'}`)
      console.log(`  成员数: ${detail.member_count}`)
      console.log(`  是否私聊: ${detail.is_direct}`)
      console.log(`  是否加密: ${detail.is_encrypted}`)
      console.log(`  未读数: ${detail.unread_count}`)
      console.log(`  状态: ${detail.state}`)
    }
  } catch (error) {
    if (error instanceof SynapseEnhancedError) {
      console.error(`❌ 获取详情失败 [${error.code}]: ${error.message}`)
    }
  }
}

/**
 * 示例 14: 离开会话
 */
async function exampleLeaveSession(): Promise<void> {
  console.log('\n=== 示例 14: 离开会话 ===\n')

  const roomId = '!room:example.com'

  try {
    // 离开会话
    await client.enhanced.privateChat.leaveChatroom(roomId)
    console.log(`✅ 已离开会话`)
  } catch (error) {
    if (error instanceof SynapseEnhancedError) {
      console.error(`❌ 离开会话失败 [${error.code}]: ${error.message}`)
    }
  }
}

/**
 * 示例 15: 静音会话
 */
async function exampleMuteSession(): Promise<void> {
  console.log('\n=== 示例 15: 静音会话 ===\n')

  const roomId = '!room:example.com'

  try {
    // 静音会话
    await client.enhanced.privateChat.muteChatroom(roomId, true)
    console.log(`✅ 会话已静音`)

    // 取消静音
    // await client.enhanced.privateChat.muteChatroom(roomId, false);
    // console.log(`✅ 会话已取消静音`);
  } catch (error) {
    if (error instanceof SynapseEnhancedError) {
      console.error(`❌ 静音操作失败 [${error.code}]: ${error.message}`)
    }
  }
}

/**
 * 示例 16: 删除消息
 */
async function exampleDeleteMessage(): Promise<void> {
  console.log('\n=== 示例 16: 删除消息 ===\n')

  const roomId = '!room:example.com'
  const messageId = '$event:example.com'

  try {
    // 删除消息
    await client.enhanced.privateChat.deleteMessage(roomId, messageId)
    console.log(`✅ 消息已删除`)
  } catch (error) {
    if (error instanceof SynapseEnhancedError) {
      console.error(`❌ 删除消息失败 [${error.code}]: ${error.message}`)
    }
  }
}

/**
 * 主函数：运行所有示例
 */
async function main(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║         Matrix JavaScript SDK - 私聊功能示例              ║')
  console.log('╚════════════════════════════════════════════════════════════╝')

  try {
    // 示例 1: 创建私聊会话
    await exampleCreateSession()

    // 示例 2: 发送文本消息
    // await exampleSendTextMessage();

    // 示例 3: 发送图片消息
    // await exampleSendImageMessage();

    // 示例 4: 发送文件消息
    // await exampleSendFileMessage();

    // 示例 5: 获取聊天历史
    // await exampleGetMessages();

    // 示例 6: 获取会话列表
    // await exampleGetSessions();

    // 示例 7: 获取未读消息数
    // await exampleGetUnreadCount();

    // 示例 8: 标记消息为已读
    // await exampleMarkAsRead();

    // 示例 9: 搜索私聊消息
    // await exampleSearchMessages();

    // 示例 10: 回复消息
    // await exampleReplyMessage();

    // 示例 11: 创建阅后即焚会话
    // await exampleBurnAfterReading();

    // 示例 12: 获取会话统计
    // await exampleGetSessionStatistics();

    // 示例 13: 获取会话详情
    // await exampleGetSessionDetail();

    // 示例 14: 离开会话
    // await exampleLeaveSession();

    // 示例 15: 静音会话
    // await exampleMuteSession();

    // 示例 16: 删除消息
    // await exampleDeleteMessage();

    console.log('\n✅ 所有示例执行完成')
  } catch (error) {
    console.error('\n❌ 示例执行失败:', error)
  }
}

// 运行主函数
main().catch(console.error)

// 导出示例函数供其他模块使用
export {
  exampleCreateSession,
  exampleSendTextMessage,
  exampleSendImageMessage,
  exampleSendFileMessage,
  exampleGetMessages,
  exampleGetSessions,
  exampleGetUnreadCount,
  exampleMarkAsRead,
  exampleSearchMessages,
  exampleReplyMessage,
  exampleBurnAfterReading,
  exampleGetSessionStatistics,
  exampleGetSessionDetail,
  exampleLeaveSession,
  exampleMuteSession,
  exampleDeleteMessage
}
