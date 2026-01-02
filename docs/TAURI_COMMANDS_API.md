# Tauri Command API 文档

> HuLaMatrix Tauri 命令 API - 前端与 Rust 后端通信接口

## 目录
- [概述](#概述)
- [应用状态命令](#应用状态命令)
- [用户命令](#用户命令)
- [消息命令](#消息命令)
- [房间成员命令](#房间成员命令)
- [联系人命令](#联系人命令)
- [文件管理命令](#文件管理命令)
- [媒体命令](#媒体命令)
- [消息标记命令](#消息标记命令)
- [聊天历史命令](#聊天历史命令)
- [设置命令](#设置命令)
- [请求命令](#请求命令)
- [使用示例](#使用示例)

## 概述

Tauri 命令是前端 (TypeScript/Vue) 与 Rust 后端之间的通信桥梁。前端通过 `invoke()` 函数调用后端命令，后端执行相应操作并返回结果。

### 调用方式

```typescript
import { invoke } from '@tauri-apps/api/core'

// 基本调用
const result = await invoke<ReturnType>('command_name', {
  param1: 'value1',
  param2: 'value2'
})

// 处理错误
try {
  const data = await invoke('command_name', { id: 123 })
  console.log('Success:', data)
} catch (error) {
  console.error('Error:', error)
}
```

### 错误处理

所有命令返回 `Result<T, String>`，成功时返回 `Ok(T)`，失败时返回 `Err(String)`。

```typescript
try {
  const result = await invoke('some_command', { param: value })
  // 处理成功结果
} catch (error) {
  // error 是字符串类型
  console.error('Command failed:', error)
}
```

## 应用状态命令

### set_complete

设置任务完成状态，用于前后端同步初始化进度。

```rust
pub async fn set_complete(
    _app: AppHandle,
    state: State<'_, AppData>,
    task: String,
) -> Result<(), ()>
```

**参数：**
- `task`: 任务名称
  - `"frontend"` - 前端任务完成
  - `"backend"` - 后端任务完成

**示例：**
```typescript
import { invoke } from '@tauri-apps/api/core'

// 前端初始化完成后调用
await invoke('set_complete', { task: 'frontend' })

// 后端初始化完成后调用
await invoke('set_complete', { task: 'backend' })
```

## 用户命令

### save_user_info

保存用户信息到本地数据库。

```rust
pub async fn save_user_info(
    user_info: SaveUserInfoRequest,
    state: State<'_, AppData>,
) -> Result<(), String>
```

**参数：**
```typescript
interface SaveUserInfoRequest {
  uid: string  // 用户ID
}
```

**示例：**
```typescript
await invoke('save_user_info', {
  uid: '@user:server.com'
})
```

### update_user_last_opt_time

更新用户最后操作时间。

```rust
pub async fn update_user_last_opt_time(
    state: State<'_, AppData>
) -> Result<(), String>
```

**示例：**
```typescript
await invoke('update_user_last_opt_time')
```

### update_user_token

更新用户 token（已弃用，改用 Matrix SDK）。

```rust
pub async fn update_user_token(
    req: UpdateUserTokenRequest,
    state: State<'_, AppData>,
) -> Result<TokenResponse, String>
```

**参数：**
```typescript
interface UpdateUserTokenRequest {
  uid: string
  token: string
  refresh_token: string
}
```

**返回：**
```typescript
interface TokenResponse {
  token?: string
  refresh_token?: string
}
```

## 消息命令

### page_msg

分页获取消息列表（已弃用，建议使用 Matrix SDK）。

```rust
pub async fn page_msg(
    param: CursorPageMessageParam,
    state: State<'_, AppData>,
) -> Result<CursorPageResp<MessageResp>, String>
```

### send_msg

发送消息到服务器并保存到本地数据库。

```rust
pub async fn send_msg(
    msg: ChatMessageReq,
    state: State<'_, AppData>,
) -> Result<MessageResp, String>
```

**参数：**
```typescript
interface ChatMessageReq {
  roomId: string
  type: number
  body: any
  replyMsgId?: string
  // ... 其他字段
}
```

**返回：**
```typescript
interface MessageResp {
  createId?: string
  createTime?: number
  updateId?: string
  updateTime?: number
  fromUser: FromUser
  message: Message
  oldMsgId?: string
  timeBlock?: number
}
```

### save_msg

保存消息到本地数据库。

```rust
pub async fn save_msg(
    msg: MessageResp,
    state: State<'_, AppData>,
) -> Result<Option<MessageResp>, String>
```

### get_conflict_total

获取插入冲突的消息总数。

```rust
pub async fn get_conflict_total() -> Result<usize, String>
```

**示例：**
```typescript
const conflictCount = await invoke<number>('get_conflict_total')
console.log(`Conflicts: ${conflictCount}`)
```

## 房间成员命令

### get_room_members

获取房间成员列表（**已弃用**，请使用 Matrix SDK）。

```rust
pub async fn get_room_members(
    _room_id: String,
    _state: State<'_, AppData>,
) -> Result<Vec<RoomMemberResponse>, String>
```

**迁移路径：**
```typescript
// 旧方式（已弃用）
const members = await invoke('get_room_members', { roomId: '!room:id' })

// 新方式（推荐）
import { matrixClientService } from '@/integrations/matrix/client'
const room = matrixClientService.getRoom('!room:id')
const members = room.getJoinedMembers()
```

### update_my_room_info

更新当前用户在房间中的信息。

```rust
pub async fn update_my_room_info(
    my_room_info: MyRoomInfoReq,
    state: State<'_, AppData>,
) -> Result<(), String>
```

**参数：**
```typescript
interface MyRoomInfoReq {
  id: string          // 房间ID
  myName: string      // 用户在房间中的显示名称
  // ... 其他字段
}
```

**示例：**
```typescript
await invoke('update_my_room_info', {
  id: '!room:server.com',
  myName: 'My Display Name'
})
```

## 联系人命令

### list_contacts_command

获取联系人列表。

```rust
pub async fn list_contacts_command(
    state: State<'_, AppData>,
) -> Result<Vec<ContactResponse>, String>
```

### hide_contact_command

隐藏联系人。

```rust
pub async fn hide_contact_command(
    contact_id: String,
    state: State<'_, AppData>,
) -> Result<(), String>
```

**示例：**
```typescript
// 隐藏联系人
await invoke('hide_contact_command', {
  contactId: '@user:server.com'
})
```

## 文件管理命令

### download_media

下载媒体文件到本地。

```rust
pub async fn download_media(
    url: String,
    file_type: String,
    state: State<'_, AppData>,
) -> Result<String, String>
```

**参数：**
- `url`: 媒体文件 URL
- `file_type`: 文件类型（用于确定保存位置）

**返回：**
- `string`: 本地文件路径

**示例：**
```typescript
const localPath = await invoke<string>('download_media', {
  url: 'https://example.com/image.jpg',
  fileType: 'image'
})
console.log('Saved to:', localPath)
```

### clear_media_cache

清除媒体缓存。

```rust
pub async fn clear_media_cache(
    state: State<'_, AppData>,
) -> Result<(), String>
```

**示例：**
```typescript
await invoke('clear_media_cache')
console.log('Media cache cleared')
```

## 媒体命令

### get_media_thumbnail

获取媒体缩略图。

```rust
pub async fn get_media_thumbnail(
    url: String,
    width: u32,
    height: u32,
    state: State<'_, AppData>,
) -> Result<Option<String>, String>
```

**参数：**
- `url`: 媒体 URL (mxc://)
- `width`: 缩略图宽度
- `height`: 缩略图高度

**返回：**
- `Option<string>`: 缩略图 URL 或 null

**示例：**
```typescript
const thumbnail = await invoke<string | null>('get_media_thumbnail', {
  url: 'mxc://server.com/mediaid',
  width: 200,
  height: 200
})

if (thumbnail) {
  console.log('Thumbnail:', thumbnail)
}
```

### get_media_url

获取媒体下载 URL。

```rust
pub async fn get_media_url(
    url: String,
    state: State<'_, AppData>,
) -> Result<String, String>
```

**示例：**
```typescript
const downloadUrl = await invoke<string>('get_media_url', {
  url: 'mxc://server.com/mediaid'
})
```

## 消息标记命令

### get_msg_marks_by_msg_ids

批量获取消息标记。

```rust
pub async fn get_msg_marks_by_msg_ids(
    msg_ids: Vec<String>,
    state: State<'_, AppData>,
) -> Result<HashMap<String, MessageMarkData>, String>
```

**参数：**
- `msg_ids`: 消息 ID 列表

**返回：**
```typescript
// HashMap<messageId, MessageMarkData>
interface MessageMarkData {
  // 标记数据
}
```

## 聊天历史命令

### get_chat_history_by_page

分页获取聊天历史。

```rust
pub async fn get_chat_history_by_page(
    page_param: PageParam,
    state: State<'_, AppData>,
) -> Result<Page<MessageResp>, String>
```

### get_chat_history_by_cursor

使用游标获取聊天历史。

```rust
pub async fn get_chat_history_by_cursor(
    cursor_param: CursorPageParam,
    state: State<'_, AppData>,
) -> Result<CursorPageResp<MessageResp>, String>
```

**参数：**
```typescript
interface CursorPageParam {
  roomId: string
  limit?: number
  cursor?: string
  direction?: 'forward' | 'backward'
}
```

## 设置命令

### update_setting

更新用户设置。

```rust
pub async fn update_setting(
    setting: SettingData,
    state: State<'_, AppData>,
) -> Result<(), String>
```

**示例：**
```typescript
await invoke('update_setting', {
  // 设置数据
})
```

## 请求命令

### send_request

发送自定义请求到服务器。

```rust
pub async fn send_request(
    url: String,
    method: String,
    body: Option<String>,
    state: State<'_, AppData>,
) -> Result<String, String>
```

## 使用示例

### 完整的消息发送流程

```typescript
import { invoke } from '@tauri-apps/api/core'

async function sendMessage(
  roomId: string,
  messageType: number,
  messageBody: any
) {
  try {
    // 1. 发送消息到服务器
    const result = await invoke<MessageResp>('send_msg', {
      roomId,
      type: messageType,
      body: messageBody
    })

    console.log('Message sent:', result.createId)

    // 2. 保存到本地数据库
    await invoke('save_msg', {
      msg: result
    })

    return result
  } catch (error) {
    console.error('Failed to send message:', error)
    throw error
  }
}

// 使用
await sendMessage('!room:server.com', 1, {
  text: 'Hello, World!'
})
```

### 媒体下载和缓存

```typescript
async function downloadAndCacheMedia(mxcUrl: string) {
  try {
    // 1. 检查是否已有缓存
    const cachedPath = await invoke<string | null>('get_cached_media_path', {
      url: mxcUrl
    })

    if (cachedPath) {
      console.log('Using cached:', cachedPath)
      return cachedPath
    }

    // 2. 下载媒体
    const localPath = await invoke<string>('download_media', {
      url: mxcUrl,
      fileType: 'image'
    })

    console.log('Downloaded to:', localPath)
    return localPath

  } catch (error) {
    console.error('Failed to download media:', error)
    throw error
  }
}
```

### 分页加载聊天历史

```typescript
async function loadChatHistory(
  roomId: string,
  cursor?: string,
  limit = 50
) {
  try {
    const result = await invoke<CursorPageResp<MessageResp>>(
      'get_chat_history_by_cursor',
      {
        roomId,
        limit,
        cursor,
        direction: 'backward'  // 向后加载更早的消息
      }
    )

    console.log(`Loaded ${result.data.length} messages`)
    console.log('Next cursor:', result.nextCursor)

    return result
  } catch (error) {
    console.error('Failed to load history:', error)
    throw error
  }
}

// 使用
const history = await loadChatHistory('!room:server.com')
history.data.forEach(msg => {
  console.log(`[${msg.fromUser.nickname}]: ${msg.message.body}`)
})
```

### 清理冲突消息

```typescript
async function cleanupConflicts() {
  try {
    // 获取冲突数量
    const conflictCount = await invoke<number>('get_conflict_total')

    if (conflictCount > 0) {
      console.log(`Found ${conflictCount} conflicting messages`)

      // 清理冲突（假设有清理命令）
      // await invoke('cleanup_conflicts')
    }
  } catch (error) {
    console.error('Failed to check conflicts:', error)
  }
}
```

## 迁移指南

### 从 Tauri 命令迁移到 Matrix SDK

许多 Tauri 命令已被弃用，建议使用 Matrix SDK 替代：

#### 房间成员

**旧方式（已弃用）：**
```typescript
const members = await invoke('get_room_members', { roomId: '!room:id' })
```

**新方式（推荐）：**
```typescript
import { matrixClientService } from '@/integrations/matrix/client'
import { useGroupStore } from '@/stores/group'

// 方式1: 使用客户端服务
const room = matrixClientService.getRoom('!room:id')
const members = room.getJoinedMembers()

// 方式2: 使用 group store
const groupStore = useGroupStore()
const members = await groupStore.fetchRoomMembers('!room:id')
```

#### 消息发送

**旧方式：**
```typescript
await invoke('send_msg', { roomId, type, body })
```

**新方式：**
```typescript
import { matrixClientService } from '@/integrations/matrix/client'

await matrixClientService.sendMessage(roomId, {
  msgtype: 'm.text',
  body: 'Hello'
})
```

#### 用户信息

**旧方式：**
```typescript
await invoke('save_user_info', { uid })
```

**新方式：**
```typescript
import { useMatrixAuthStore } from '@/stores/matrixAuth'
import { matrixClientService } from '@/integrations/matrix/client'

const authStore = useMatrixAuthStore()
// 用户信息由 Matrix SDK 自动管理
```

## 错误码

所有命令在失败时返回错误字符串，常见错误：

- `"Failed to connect to database"` - 数据库连接失败
- `"User not found"` - 用户不存在
- `"Room not found"` - 房间不存在
- `"Invalid token"` - Token 无效
- `"Network error"` - 网络错误

## 注意事项

### 异步操作

所有 Tauri 命令都是异步的，必须使用 `await` 或 `.then()`：

```typescript
// ✅ 正确
const result = await invoke('command_name')

// ❌ 错误（会返回 Promise）
const result = invoke('command_name')
```

### 序列化

参数和返回值必须可序列化为 JSON：

```typescript
// ✅ 支持的类型
await invoke('cmd', {
  str: 'string',
  num: 123,
  bool: true,
  arr: [1, 2, 3],
  obj: { key: 'value' },
  null: null
})

// ❌ 不支持的类型
await invoke('cmd', {
  func: () => {},    // 函数
  date: new Date(),   // Date 对象
  map: new Map(),     // Map/Set
  cls: new MyClass()  // 类实例
})
```

### 性能考虑

- 避免频繁调用命令，应该批量操作
- 大数据量应该使用分页
- 文件操作应该使用后台线程

### 平台差异

某些命令在不同平台表现不同：

```typescript
import { isMobile } from '@/utils/PlatformConstants'

if (isMobile()) {
  // 移动端特定逻辑
} else {
  // 桌面端特定逻辑
}
```

## 类型定义

完整的 TypeScript 类型定义在 `src/services/tauri-types.ts` 中。

```typescript
// 示例类型定义
export interface MessageResp {
  createId?: string
  createTime?: number
  fromUser: FromUser
  message: Message
  // ...
}

export interface FromUser {
  uid: string
  nickname?: string
}

export interface Message {
  id?: string
  roomId?: string
  type?: number
  body?: any
  // ...
}
```
