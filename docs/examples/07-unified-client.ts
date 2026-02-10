/**
 * UnifiedMatrixClient 使用示例
 *
 * 本文档展示了如何使用 UnifiedMatrixClient 来访问 API-Documentation.md 中定义的所有 API 功能
 */

import { UnifiedMatrixClient, type IUnifiedClientConfig } from '../../src/enhanced/index.ts'

/**
 * 示例 1: 初始化客户端
 */
async function exampleInitialization(): Promise<void> {
  const config: IUnifiedClientConfig = {
    baseUrl: 'https://matrix.example.com',
    accessToken: 'your-access-token',
    apiPrefix: '/_synapse/client',
    timeout: 30000
  }

  const _client = new UnifiedMatrixClient(config)

  console.log('客户端初始化成功')
  console.log('基础URL:', config.baseUrl)
}

/**
 * 示例 2: 认证 API
 */
async function exampleAuthentication(): Promise<void> {
  const client = new UnifiedMatrixClient({
    baseUrl: 'https://matrix.example.com',
    accessToken: 'your-access-token'
  })

  try {
    // 注册新用户
    const registerResponse = await client.auth.register({
      username: 'newuser',
      password: 'securePassword123',
      device_id: 'DEVICE001',
      initial_device_display_name: 'My Device'
    })
    console.log('用户注册成功:', registerResponse.user_id)

    // 用户登录
    const loginResponse = await client.auth.login({
      type: 'm.login.password',
      user: 'newuser',
      password: 'securePassword123'
    })
    console.log('登录成功:', loginResponse.user_id)

    // 刷新令牌
    const _refreshResponse = await client.auth.refreshToken({
      refresh_token: 'current-refresh-token'
    })
    console.log('令牌刷新成功')

    // 登出
    await client.auth.logout()
    console.log('登出成功')

    // 登出所有设备
    await client.auth.logoutAll()
    console.log('所有设备已登出')
  } catch (error) {
    console.error('认证操作失败:', error)
  }
}

/**
 * 示例 3: 用户 API
 */
async function exampleUserApi(): Promise<void> {
  const client = new UnifiedMatrixClient({
    baseUrl: 'https://matrix.example.com',
    accessToken: 'your-access-token'
  })

  try {
    // 获取当前用户信息
    const whoami = await client.user.whoami()
    console.log('当前用户ID:', whoami.user_id)

    // 获取用户资料
    const profile = await client.user.getProfile('@alice:example.com')
    console.log('用户显示名:', profile.displayname)
    console.log('用户头像:', profile.avatar_url)

    // 更新显示名
    await client.user.updateDisplayname('@alice:example.com', 'Alice Smith')

    // 更新头像
    await client.user.updateDisplayname('@alice:example.com', 'mxc://example.com/avatar123')

    // 修改密码
    await client.user.changePassword('newSecurePassword456')

    // 停用账户
    const result = await client.user.deactivateAccount()
    console.log('账户停用结果:', result.id_server_unbind_result)
  } catch (error) {
    console.error('用户操作失败:', error)
  }
}

/**
 * 示例 4: 房间 API
 */
async function exampleRoomApi(): Promise<void> {
  const client = new UnifiedMatrixClient({
    baseUrl: 'https://matrix.example.com',
    accessToken: 'your-access-token'
  })

  try {
    // 创建房间
    const room = await client.room.createRoom({
      name: 'My Room',
      topic: 'Discussion about SDK',
      preset: 'private_chat',
      invite: ['@bob:example.com']
    })
    console.log('房间创建成功:', room.room_id)

    // 加入房间
    const joinResult = await client.room.joinRoom('!room:example.com')
    console.log('加入房间成功:', joinResult.room_id)

    // 邀请用户
    await client.room.inviteUser(room.room_id, {
      user_id: '@charlie:example.com',
      reason: 'Join our discussion'
    })

    // 踢出用户
    await client.room.kickUser(room.room_id, '@charlie:example.com', 'Policy violation')

    // 禁止用户
    await client.room.banUser(room.room_id, '@spam:example.com', 'Spamming')

    // 解禁用户
    await client.room.unbanUser(room.room_id, '@reformed:example.com')

    // 获取房间信息
    const roomInfo = await client.room.getRoomInfo(room.room_id)
    console.log('房间名称:', roomInfo.name)
    console.log('房间成员数:', roomInfo.num_joined_members)

    // 获取公开房间列表
    const publicRooms = await client.room.getPublicRooms({
      limit: 20,
      search_term: 'Matrix'
    })
    console.log('公开房间数量:', publicRooms.chunk.length)

    // 获取用户房间列表
    const userRooms = await client.room.getUserRooms('@alice:example.com')
    console.log('用户加入的房间数:', userRooms.joined.length)

    // 离开房间
    await client.room.leaveRoom(room.room_id)

    // 删除房间
    await client.room.deleteRoom(room.room_id)
  } catch (error) {
    console.error('房间操作失败:', error)
  }
}

/**
 * 示例 5: 消息 API
 */
async function exampleMessageApi(): Promise<void> {
  const client = new UnifiedMatrixClient({
    baseUrl: 'https://matrix.example.com',
    accessToken: 'your-access-token'
  })

  try {
    const roomId = '!room:example.com'

    // 发送文本消息
    const textMessage = await client.message.sendMessage(roomId, 'm.room.message', {
      msgtype: 'm.text',
      body: 'Hello, World!'
    })
    console.log('文本消息发送成功:', textMessage.event_id)

    // 发送图片消息
    const imageMessage = await client.message.sendMessage(roomId, 'm.room.message', {
      msgtype: 'm.image',
      body: 'My Photo',
      url: 'mxc://example.com/image123',
      info: {
        mimetype: 'image/jpeg',
        width: 800,
        height: 600,
        size: 123456
      }
    })
    console.log('图片消息发送成功:', imageMessage.event_id)

    // 获取消息历史
    const messages = await client.message.getMessages(roomId, {
      from: 'start_token',
      dir: 'f',
      limit: 50
    })
    console.log('获取到消息数:', messages.chunk.length)

    // 编辑消息
    const editResult = await client.message.editMessage(roomId, '$event_id', 'm.room.message', {
      body: 'Updated message',
      msgtype: 'm.text',
      'm.new_content': {
        body: 'Updated message',
        msgtype: 'm.text'
      },
      'm.relates_to': {
        rel_type: 'm.replace',
        event_id: '$original_event_id'
      }
    })
    console.log('消息编辑成功:', editResult.event_id)

    // 回复消息
    const replyResult = await client.message.replyMessage(roomId, '$original_event_id', {
      msgtype: 'm.text',
      body: 'This is a reply'
    })
    console.log('回复发送成功:', replyResult.event_id)

    // 撤回消息
    const redactResult = await client.message.redactEvent(roomId, '$event_to_redact', {
      reason: 'Mistake'
    })
    console.log('消息撤回成功:', redactResult.event_id)
  } catch (error) {
    console.error('消息操作失败:', error)
  }
}

/**
 * 示例 6: 使用增强功能
 */
async function exampleEnhancedFeatures(): Promise<void> {
  const client = new UnifiedMatrixClient({
    baseUrl: 'https://matrix.example.com',
    accessToken: 'your-access-token'
  })

  try {
    // 使用增强功能
    const status = await client.enhanced.enhanced.getStatus()
    console.log('增强模块状态:', status)

    // 好友功能
    const friends = await client.enhanced.friends.getFriends()
    console.log('好友数量:', friends.length)

    // 私聊功能
    const privateChats = await client.enhanced.privateChat.getSessions()
    console.log('私聊会话数:', privateChats.length)

    // 管理员功能
    const adminUsers = await client.enhanced.admin.getUsers()
    console.log('管理员用户数:', adminUsers.items.length)

    // 语音功能
    const voiceMessages = await client.enhanced.voice.getUserMessages('@user:example.com')
    console.log('语音消息数:', voiceMessages.length)
  } catch (error) {
    console.error('增强功能使用失败:', error)
  }
}

/**
 * 完整使用示例
 */
async function completeExample(): Promise<void> {
  // 1. 初始化客户端
  const client = new UnifiedMatrixClient({
    baseUrl: 'https://matrix.example.com',
    accessToken: 'your-access-token'
  })

  try {
    // 2. 获取用户信息
    const whoami = await client.user.whoami()
    console.log('当前用户:', whoami.user_id)

    // 3. 创建房间
    const room = await client.room.createRoom({
      name: 'SDK Test Room',
      topic: 'Testing the new SDK',
      preset: 'public_chat'
    })
    console.log('创建房间:', room.room_id)

    // 4. 发送欢迎消息
    await client.message.sendMessage(room.room_id, 'm.room.message', {
      msgtype: 'm.text',
      body: 'Welcome to the new SDK!'
    })

    // 5. 获取房间消息
    const messages = await client.message.getMessages(room.room_id, {
      from: 'start',
      dir: 'b',
      limit: 10
    })
    console.log('历史消息数:', messages.chunk.length)

    // 6. 使用增强功能
    await client.enhanced.enhanced.checkHealth()

    console.log('完整示例执行成功!')
  } catch (error) {
    console.error('示例执行失败:', error)
  }
}

// 导出所有示例
export {
  exampleInitialization,
  exampleAuthentication,
  exampleUserApi,
  exampleRoomApi,
  exampleMessageApi,
  exampleEnhancedFeatures,
  completeExample
}
