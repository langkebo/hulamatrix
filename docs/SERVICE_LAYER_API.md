# Service Layer API 文档

> HuLaMatrix 服务层接口文档，包含所有业务逻辑服务

## 目录
- [概述](#概述)
- [核心服务](#核心服务)
- [Matrix 集成服务](#matrix-集成服务)
- [消息服务](#消息服务)
- [通知服务](#通知服务)
- [RTC 服务](#rtc-服务)
- [E2EE 服务](#e2ee-服务)
- [媒体服务](#媒体服务)
- [辅助服务](#辅助服务)

## 概述

服务层 (Service Layer) 是 HuLaMatrix 的业务逻辑层，负责：
- 与 Matrix SDK 交互
- 数据转换和适配
- 业务逻辑封装
- 与 Tauri 后端通信

### 服务架构

```
┌─────────────────────────────────────┐
│         Components (Vue)             │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│         Service Layer                │
│  ┌──────────┐  ┌─────────────────┐  │
│  │ Core     │  │ Matrix Services │  │
│  │ Services │  │                 │  │
│  └──────────┘  └─────────────────┘  │
│  ┌──────────┐  ┌─────────────────┐  │
│  │ UI       │  │  Helper         │  │
│  │ Services │  │  Services       │  │
│  └──────────┘  └─────────────────┘  │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│     Matrix SDK / Tauri Backend       │
└─────────────────────────────────────┘
```

### 服务约定

所有服务遵循以下约定：

1. **单例模式** - 服务导出为单例实例
2. **错误处理** - 统一使用 `MatrixErrorHandler`
3. **日志记录** - 使用 `logger` 工具
4. **类型安全** - 完整的 TypeScript 类型定义

## 核心服务

### matrixClientService

Matrix 客户端管理服务，负责 Matrix SDK 客户端的生命周期管理。

**文件：** `src/integrations/matrix/client.ts`

```typescript
import { matrixClientService } from '@/integrations/matrix/client'

// 初始化客户端
await matrixClientService.initialize({
  baseUrl: 'https://matrix.example.com',
  accessToken: 'token',
  userId: '@user:example.com'
})

// 启动客户端
await matrixClientService.startClient({
  initialSyncLimit: 20
})

// 获取客户端实例
const client = matrixClientService.getClient()

// 获取房间
const room = matrixClientService.getRoom('!roomId:server.com')
```

**主要方法：**
- `initialize(options)` - 初始化客户端
- `startClient(options)` - 启动同步
- `stopClient()` - 停止同步
- `getClient()` - 获取 MatrixClient 实例
- `getRoom(roomId)` - 获取房间对象
- `logout()` - 登出

### tauriCommand

Tauri 命令封装服务，提供类型安全的 Tauri 命令调用。

**文件：** `src/services/tauriCommand.ts`

```typescript
import { tauriCommand } from '@/services/tauriCommand'

// 调用 Tauri 命令
const result = await tauriCommand.invoke('command_name', {
  param1: 'value1'
})
```

## Matrix 集成服务

### matrixSpacesService

Matrix Spaces 管理服务。

**文件：** `src/services/matrixSpacesService.ts`

```typescript
import { matrixSpacesService } from '@/services/matrixSpacesService'

// 获取用户加入的所有空间
const spaces = await matrixSpacesService.getJoinedSpaces()

// 获取空间详情
const spaceInfo = await matrixSpacesService.getSpaceInfo('!spaceId:server.com')

// 获取空间权限
const permissions = await matrixSpacesService.getSpacePermissions('!spaceId:server.com')

// 获取空间统计
const stats = await matrixSpacesService.getSpaceStats('!spaceId:server.com')

// 创建空间
const space = await matrixSpacesService.createSpace({
  name: 'My Space',
  topic: 'Description'
})

// 导出空间数据
const blob = await matrixSpacesService.exportSpaceData('!spaceId:server.com')
```

**主要接口：**
```typescript
interface SpaceInfo {
  id: string
  name: string
  topic?: string
  avatar?: string
  rooms?: string[]
  memberCount?: number
  state?: 'joined' | 'invited' | 'left'
  notifications?: {
    notificationCount: number
    highlightCount: number
  }
  lastActivity?: number
}

interface SpacePermissions {
  canEdit: boolean
  canInvite: boolean
  canRemove: boolean
  canBan: boolean
  canRedact: boolean
  canSendEvents: boolean
  canUpload: boolean
  canManageChildren: boolean
  canChangePermissions: boolean
}

interface SpaceStats {
  memberCount: number
  roomCount: number
  activeMembers: number
  onlineMembers: number
  notificationCount: number
  highlightCount: number
  created: number
  lastActivity: number
}
```

### matrixRoomManager

房间管理服务。

**文件：** `src/services/matrixRoomManager.ts`

```typescript
import { matrixRoomManager } from '@/services/matrixRoomManager'

// 创建房间
const room = await matrixRoomManager.createRoom({
  name: 'My Room',
  topic: 'Discussion',
  preset: 'private_chat',
  is_direct: true
})

// 加入房间
await matrixRoomManager.joinRoom('!roomId:server.com')

// 离开房间
await matrixRoomManager.leaveRoom('!roomId:server.com')

// 邀请用户
await matrixRoomManager.inviteToRoom('!roomId:server.com', '@user:server.com')

// 设置房间名称
await matrixRoomManager.setRoomName('!roomId:server.com', 'New Name')

// 设置房间头像
await matrixRoomManager.setRoomAvatar('!roomId:server.com', 'mxc://server.com/image')
```

### matrixSearchService

搜索服务。

**文件：** `src/services/matrixSearchService.ts`

```typescript
import { matrixSearchService } from '@/services/matrixSearchService'

// 搜索房间消息
const results = await matrixSearchService.searchRoomMessages(
  '!roomId:server.com',
  'search text'
)

// 全局搜索
const globalResults = await matrixSearchService.searchGlobal('search text')

// 搜索用户
const users = await matrixSearchService.searchUsers('username')
```

## 消息服务

### messageService

统一消息服务。

**文件：** `src/services/messageService.ts`

```typescript
import { messageService } from '@/services/messageService'

// 发送文本消息
await messageService.sendTextMessage('!roomId:server.com', 'Hello')

// 发送表情
await messageService.sendEmoji('!roomId:server.com', '😀')

// 发送文件
await messageService.sendFile('!roomId:server.com', file)

// 编辑消息
await messageService.editMessage('!roomId:server.com', '$eventId', 'Updated text')

// 撤回消息
await messageService.redactMessage('!roomId:server.com', '$eventId')

// 获取消息历史
const messages = await messageService.fetchMessages('!roomId:server.com', {
  limit: 50,
  direction: 'b'
})
```

### messageSyncService

消息同步服务。

**文件：** `src/services/messageSyncService.ts`

```typescript
import { messageSyncService } from '@/services/messageSyncService'

// 启动同步
await messageSyncService.start()

// 停止同步
await messageSyncService.stop()

// 获取同步状态
const status = messageSyncService.getSyncState()
```

### messageDecryptService

消息解密服务（E2EE）。

**文件：** `src/services/messageDecryptService.ts`

```typescript
import { messageDecryptService } from '@/services/messageDecryptService'

// 解密消息
const decrypted = await messageDecryptService.decryptMessage(event)

// 批量解密
const decryptedEvents = await messageDecryptService.decryptEvents(events)
```

## 通知服务

### notificationService

统一通知服务。

**文件：** `src/services/notificationService.ts`

```typescript
import { notificationService } from '@/services/notificationService'

// 初始化通知服务
await notificationService.initialize()

// 发送通知
await notificationService.send({
  title: 'New Message',
  body: 'You have a new message from John',
  options: {
    icon: '/avatar.png',
    silent: false,
    onClick: () => console.log('Clicked')
  }
})

// 发送 Matrix 消息通知
await notificationService.sendMatrixMessage(
  'New Message',
  'Hello from John',
  policyInput,
  { silent: false }
)

// 显示系统通知
await notificationService.showSystem('info', 'Info', 'System message')

// Web Push 订阅
const subscription = await notificationService.subscribeToPush(vapidKey)

// 取消订阅
await notificationService.unsubscribeFromPush()

// 获取未读数量
const unreadCount = notificationService.getUnreadCount()
```

**主要接口：**
```typescript
interface NotificationContent {
  title: string
  body: string
  options?: NotificationOptions
}

interface NotificationOptions {
  icon?: string
  silent?: boolean
  requireInteraction?: boolean
  onClick?: () => void
  data?: Record<string, unknown>
}

interface PolicyInput {
  roomId: string
  isDirect?: boolean
  isMuted?: boolean
  highlight?: boolean
}
```

### matrixPushService

Matrix Push 通知服务。

**文件：** `src/services/matrixPushService.ts`

```typescript
import { matrixPushService } from '@/services/matrixPushService'

// 初始化 Push 服务
await matrixPushService.initialize()

// 请求通知权限
const permission = await matrixPushService.requestNotificationPermission()

// 添加推送规则
await matrixPushService.addPushRule('global', 'content', 'my_rule', {
  pattern: 'keyword',
  actions: [{ notify: true }]
})

// 移除推送规则
await matrixPushService.removePushRule('global', 'content', 'my_rule')

// 获取推送规则
const rules = matrixPushService.getPushRules()
```

## RTC 服务

### matrixCallService

WebRTC 通话服务。

**文件：** `src/services/matrixCallService.ts`

```typescript
import { matrixCallService } from '@/services/matrixCallService'

// 发起语音通话
await matrixCallService.createCall('!roomId:server.com', 'voice')

// 发起视频通话
await matrixCallService.createCall('!roomId:server.com', 'video')

// 接听通话
await matrixCallService.answerCall(callId)

// 拒绝通话
await matrixCallService.rejectCall(callId)

// 挂断通话
await matrixCallService.hangupCall(callId)

// 切换静音
await matrixCallService.toggleAudio(callId, false)

// 切换视频
await matrixCallService.toggleVideo(callId, false)
```

### matrixGroupCallService

群组通话服务。

**文件：** `src/services/matrixGroupCallService.ts`

```typescript
import { matrixGroupCallService } from '@/services/matrixGroupCallService'

// 创建群组通话
const call = await matrixGroupCallService.createGroupCall('!roomId:server.com', {
  isVideo: true
})

// 加入群组通话
await matrixGroupCallService.enter(call.callId, 'roomId')

// 离开通话
await matrixGroupCallService.leave(call.callId)

// 设置麦克风静音
await matrixGroupCallService.setMicrophoneMuted(call.callId, true)

// 设置摄像头状态
await matrixGroupCallService.setCameraEnabled(call.callId, false)

// 开始屏幕共享
await matrixGroupCallService.startScreenShare(call.callId)

// 停止屏幕共享
await matrixGroupCallService.stopScreenShare(call.callId)

// 开始录音
await matrixGroupCallService.startRecording(call.callId, {
  format: 'webm'
})

// 停止录音
await matrixGroupCallService.stopRecording(call.callId)
```

## E2EE 服务

### e2eeService

端到端加密服务。

**文件：** `src/services/e2eeService.ts`

```typescript
import { e2eeService } from '@/services/e2eeService'

// 初始化 E2EE
await e2eeService.initCrypto()

// 检查加密状态
const isEncrypted = await e2eeService.isRoomEncrypted('!roomId:server.com')

// 启用房间加密
await e2eeService.enableEncryption('!roomId:server.com')

// 获取设备列表
const devices = await e2eeService.getUserDevices('@user:server.com')

// 验证设备
await e2eeService.verifyDevice('@user:server.com', 'DEVICE_ID')

// 设置交叉签名
await e2eeService.setupCrossSigning()

// 备份密钥
await e2eeService.backupKey('passphrase')

// 恢复密钥
await e2eeService.restoreKey('passphrase')
```

## 媒体服务

### mediaService

媒体文件服务。

**文件：** `src/services/mediaService.ts`

```typescript
import { mediaService } from '@/services/mediaService'

// 上传文件
const mxcUrl = await mediaService.uploadMedia(file, {
  filename: 'photo.jpg',
  contentType: 'image/jpeg'
})

// 下载媒体
const blob = await mediaService.downloadMedia('mxc://server.com/mediaid')

// 获取缩略图
const thumbnail = await mediaService.getThumbnail(
  'mxc://server.com/mediaid',
  200,
  200
)
```

### fileService

文件操作服务。

**文件：** `src/services/file-service.ts`

```typescript
import { fileService } from '@/services/file-service'

// 保存文件
const path = await fileService.saveFile(file, {
  directory: 'downloads'
})

// 打开文件
await fileService.openFile(path)

// 获取文件信息
const info = await fileService.getFileInfo(path)
```

## 辅助服务

### i18nService

国际化服务。

**文件：** `src/services/i18n.ts`

```typescript
import { i18nService } from '@/services/i18n'

// 翻译文本
const translated = await i18nService.translate('hello', { name: 'World' })

// 切换语言
await i18nService.setLanguage('zh-CN')

// 获取可用语言
const languages = i18nService.getAvailableLanguages()
```

### translateService

翻译服务。

**文件：** `src/services/translate.ts`

```typescript
import { translateService } from '@/services/translate'

// 翻译文本
const result = await translateService.translate('Hello', 'en', 'zh')

// 检测语言
const detected = await translateService.detectLanguage('Hello')
```

### adminClient

Synapse Admin API 客户端。

**文件：** `src/services/adminClient.ts`

```typescript
import { adminClient } from '@/services/adminClient'

// 获取用户信息
const user = await adminClient.getUser('@user:server.com')

// 列出用户
const users = await adminClient.listUsers({ limit: 100 })

// 更新用户管理员状态
await adminClient.updateUserAdmin('@user:server.com', true)

// 停用用户
await adminClient.setUserDeactivated('@user:server.com', true)

// 删除房间
await adminClient.deleteRoom('!roomId:server.com')

// 清除媒体缓存
const result = await adminClient.purgeMediaCache(beforeTs)
```

详细 API 文档参见 [Matrix SDK Admin API](../matrix-sdk/13-admin-api.md)。

## 服务间依赖

### 服务依赖图

```
matrixClientService (核心)
├── matrixRoomManager
├── messageService
│   ├── messageDecryptService (E2EE)
│   └── messageSyncService
├── matrixCallService
│   └── matrixGroupCallService
├── matrixSpacesService
├── matrixSearchService
└── e2eeService

notificationService
├── matrixPushService
└── notificationService (本地)

mediaService
└── fileService
```

### 服务初始化顺序

服务应按以下顺序初始化：

1. `matrixClientService` - 最先初始化
2. `e2eeService` - 依赖 matrixClientService
3. `messageSyncService` - 依赖 matrixClientService
4. `notificationService` - 独立初始化
5. `matrixPushService` - 依赖 matrixClientService
6. 其他服务

## 错误处理

所有服务使用统一的错误处理：

```typescript
import { MatrixErrorHandler } from '@/utils/error-handler'

try {
  await someService.someMethod()
} catch (error) {
  const matrixError = MatrixErrorHandler.handle(error)

  // matrixError 包含:
  // - code: 错误码
  // - message: 用户友好的错误消息
  // - originalError: 原始错误

  console.error('Operation failed:', matrixError.message)
}
```

## 日志记录

所有服务使用统一的日志工具：

```typescript
import { logger } from '@/utils/logger'

// 不同级别
logger.debug('Debug message')
logger.info('Info message')
logger.warn('Warning message')
logger.error('Error message')

// 带上下文
logger.info('[ServiceName] Operation completed', {
  action: 'send_message',
  roomId: '!room:id',
  messageId: '$event:id'
})
```

## 性能优化

### 服务缓存

某些服务实现缓存机制：

```typescript
import { matrixRoomManager } from '@/services/matrixRoomManager'

// 第一次调用从服务器获取
const room1 = await matrixRoomManager.getRoom('!room:id')

// 后续调用从缓存获取
const room2 = await matrixRoomManager.getRoom('!room:id')

// 清除缓存
matrixRoomManager.clearCache()
```

### 批量操作

对于批量操作，使用专用方法：

```typescript
// ❌ 不推荐：多次调用
for (const roomId of roomIds) {
  await matrixRoomManager.leaveRoom(roomId)
}

// ✅ 推荐：批量操作
await matrixRoomManager.batchLeaveRooms(roomIds)
```

## 服务迁移

### 从旧服务迁移到新服务

**旧方式（已弃用）：**
```typescript
// 使用 Tauri 命令
const members = await invoke('get_room_members', { roomId })
```

**新方式（推荐）：**
```typescript
// 使用 Matrix SDK 服务
import { matrixRoomManager } from '@/services/matrixRoomManager'
const members = await matrixRoomManager.getRoomMembers(roomId)
```

## 最佳实践

### 1. 服务导入

```typescript
// ✅ 推荐：从服务文件直接导入
import { matrixClientService } from '@/integrations/matrix/client'

// ❌ 不推荐：通过其他服务间接导入
import { someOtherService } from '@/services/someOtherService'
const client = someOtherService.getClient()
```

### 2. 错误处理

```typescript
// ✅ 推荐：使用 try-catch 处理错误
try {
  await service.doSomething()
} catch (error) {
  logger.error('Operation failed:', error)
}

// ❌ 不推荐：忽略错误
await service.doSomething() // 可能抛出未捕获的异常
```

### 3. 类型安全

```typescript
// ✅ 推荐：使用类型定义
import type { Room } from 'matrix-js-sdk'
const room: Room | undefined = service.getRoom(roomId)

// ❌ 不推荐：使用 any
const room: any = service.getRoom(roomId)
```

### 4. 异步操作

```typescript
// ✅ 推荐：使用 async/await
async function sendMessage() {
  await service.send('hello')
}

// ❌ 不推荐：混合使用 Promise 和 async
function sendMessage() {
  service.send('hello').then(/* ... */)
}
```

## 完整示例

### 发送消息完整流程

```typescript
import { matrixClientService } from '@/integrations/matrix/client'
import { messageService } from '@/services/messageService'
import { notificationService } from '@/services/notificationService'
import { logger } from '@/utils/logger'

async function sendTextMessage(
  roomId: string,
  text: string
) {
  try {
    // 1. 检查客户端是否初始化
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    // 2. 发送消息
    const result = await messageService.sendTextMessage(roomId, text)
    logger.info('Message sent', { eventId: result.eventId })

    // 3. 播放通知音
    // (由 notificationService 自动处理)

    return result

  } catch (error) {
    logger.error('Failed to send message', { roomId, text, error })
    throw error
  }
}

// 使用
await sendTextMessage('!room:server.com', 'Hello, World!')
```

### 创建房间完整流程

```typescript
import { matrixRoomManager } from '@/services/matrixRoomManager'
import { matrixSpacesService } from '@/services/matrixSpacesService'
import { logger } from '@/utils/logger'

async function createAndConfigureRoom(
  name: string,
  topic: string,
  spaceId?: string
) {
  try {
    // 1. 创建房间
    const room = await matrixRoomManager.createRoom({
      name,
      topic,
      preset: 'private_chat',
      is_direct: false
    })

    logger.info('Room created', { roomId: room.room_id })

    // 2. 如果提供了空间ID，添加到空间
    if (spaceId) {
      await matrixSpacesService.addRoomToSpace(spaceId, room.room_id)
      logger.info('Room added to space', { spaceId, roomId: room.room_id })
    }

    return room

  } catch (error) {
    logger.error('Failed to create room', { name, topic, error })
    throw error
  }
}

// 使用
const room = await createAndConfigureRoom(
  'Team Chat',
  'Discussion about project',
  '!space:server.com'
)
```

## API 总结

### 核心服务列表

| 服务 | 文件 | 功能 |
|------|------|------|
| matrixClientService | `integrations/matrix/client.ts` | Matrix 客户端管理 |
| tauriCommand | `services/tauriCommand.ts` | Tauri 命令封装 |
| matrixRoomManager | `services/matrixRoomManager.ts` | 房间管理 |
| matrixSpacesService | `services/matrixSpacesService.ts` | Spaces 管理 |
| messageService | `services/messageService.ts` | 消息发送 |
| messageSyncService | `services/messageSyncService.ts` | 消息同步 |
| messageDecryptService | `services/messageDecryptService.ts` | 消息解密 |
| notificationService | `services/notificationService.ts` | 通知服务 |
| matrixPushService | `services/matrixPushService.ts` | Push 通知 |
| matrixCallService | `services/matrixCallService.ts` | 1v1 通话 |
| matrixGroupCallService | `services/matrixGroupCallService.ts` | 群组通话 |
| e2eeService | `services/e2eeService.ts` | E2EE 加密 |
| mediaService | `services/mediaService.ts` | 媒体上传/下载 |
| fileService | `services/file-service.ts` | 文件操作 |
| adminClient | `services/adminClient.ts` | Synapse Admin API |

### 服务分类

**Core (核心服务):**
- matrixClientService
- tauriCommand

**Matrix Integration (Matrix 集成):**
- matrixRoomManager
- matrixSpacesService
- matrixSearchService
- matrixPresenceTypingService
- matrixThreadAdapter

**Messaging (消息):**
- messageService
- messageSyncService
- messageDecryptService
- enhancedMessageService
- unifiedMessageReceiver

**Real-time Communication (实时通信):**
- matrixCallService
- matrixGroupCallService
- matrixPushService
- notificationService

**Security (安全):**
- e2eeService
- matrixUiaService (User Interactive Auth)

**Media (媒体):**
- mediaService
- fileService

**Admin (管理):**
- adminClient

**Utilities (工具):**
- i18nService
- translateService
- mapApi
- fingerprint
