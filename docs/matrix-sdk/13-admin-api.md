# 13. Synapse Admin API

> HuLaMatrix Synapse Admin API 客户端，用于服务器管理功能

## 目录
- [概述](#概述)
- [用户管理](#用户管理)
- [房间管理](#房间管理)
- [设备管理](#设备管理)
- [媒体管理](#媒体管理)
- [服务器管理](#服务器管理)
- [审计日志](#审计日志)
- [完整示例](#完整示例)

## 概述

Synapse Admin API 是 Matrix Synapse 服务器的管理接口，允许执行服务器级别的管理操作。HuLaMatrix 通过 `AdminClient` 类封装了这些 API。

### 特性

- 复用 Matrix SDK 网络层（`MatrixClient.http.authedRequest`）
- 自动 token 刷新和错误处理
- 内置审计日志记录
- TypeScript 类型安全

### 获取客户端实例

```typescript
import { adminClient } from '@/services/adminClient'

// 单例模式，全局共享
const client = adminClient
```

## 用户管理

### 获取用户信息

```typescript
// 获取单个用户详细信息
const user = await adminClient.getUser('@user:server.com')

console.log('User:', user)
// user 包含:
// {
//   name: "@user:server.com",
//   admin: boolean,
//   deactivated: boolean,
//   guest: boolean,
//   user_type: number,
//   is_guest: boolean,
//   appservice_id: string | null,
//   creation_ts: number,
//   displayname: string | null,
//   avatar_url: string | null,
//   threepids: Array<{
//     medium: string,
//     address: string,
//     validated_at: number | null
//   }>
// }
```

### 列出用户

```typescript
// 列出所有用户
const result = await adminClient.listUsers({
  from: 0,
  limit: 100,
  name: 'john',          // 可选：按用户名搜索
  guests: false,         // 可选：是否包含访客
  deactivated: false     // 可选：是否包含已停用用户
})

console.log(`Total users: ${result.total}`)
console.log(`Next token: ${result.next_token}`)

result.users.forEach(user => {
  console.log(`- ${user.name} (${user.displayname || 'No display name'})`)
  console.log(`  Admin: ${user.admin}`)
  console.log(`  Deactivated: ${user.deactivated}`)
})
```

### 更新用户管理员状态

```typescript
// 将用户设置为管理员
await adminClient.updateUserAdmin('@user:server.com', true)

// 取消管理员权限
await adminClient.updateUserAdmin('@user:server.com', false)
```

### 停用/激活用户

```typescript
// 停用用户账户
await adminClient.setUserDeactivated('@user:server.com', true)

// 重新激活用户账户
await adminClient.setUserDeactivated('@user:server.com', false)
```

### 重置用户密码

```typescript
// 重置用户密码
await adminClient.resetPassword(
  '@user:server.com',
  'new_secure_password',
  true  // logout_devices: 是否登出所有设备
)

console.log('Password reset successfully')
```

### 删除用户令牌

```typescript
// 删除用户的所有访问令牌（强制重新登录）
await adminClient.deleteTokens('@user:server.com')

console.log('All tokens deleted, user must re-login')
```

## 房间管理

### 列出房间

```typescript
// 列出服务器上的房间
const result = await adminClient.listRooms({
  from: 0,
  limit: 50,
  order_by: 'name',      // 按名称排序
  dir: 'f'               // 'f'=forward(升序), 'b'=backward(降序)
})

console.log(`Total rooms: ${result.total_rooms}`)
console.log(`Next batch: ${result.next_batch}`)

result.rooms.forEach(room => {
  console.log(`- ${room.room_id}`)
  console.log(`  Name: ${room.name}`)
  console.log(`  Members: ${room.joined_members}`)
  console.log(`  State: ${room.joined_local_members} local members`)
  console.log(`  Version: ${room.room_version}`)
  console.log(`  Encryption: ${room.encryption}`)
  console.log(`  Federatable: ${room.federatable}`)
  console.log(`  Public: ${room.public}`)
  console.log(`  Creator: ${room.creator}`)
  console.log(`  Created: ${new Date(room.created_ts).toLocaleString()}`)
})
```

### 获取房间详情

```typescript
// 获取特定房间的详细信息
const room = await adminClient.getRoom('!roomId:server.com')

console.log('Room details:', room)
// room 包含:
// {
//   room_id: string,
//   name: string,
//   canonical_alias: string,
//   topic: string,
//   num_joined_members: number,
//   num_joined_local_members: number,
//   num_local_events: number,
//   version: string,
//   room_version: string,
//   creator: string,
//   encryption: string,
//   federatable: boolean,
//   public: boolean,
//   join_rules: string,
//   guest_access: string,
//   history_visibility: string,
//   state_events: number,
//   created_ts: number
// }
```

### 删除房间

```typescript
// 删除房间
await adminClient.deleteRoom('!roomId:server.com', {
  block: false,   // block: 是否阻止服务器重新加入此房间
  purge: false    // purge: 是否从数据库中完全删除
})

console.log('Room deleted')
```

### 清除房间历史

```typescript
// 清除房间历史记录
const purgeTs = Math.floor(Date.now() / 1000) - 86400 * 30  // 30天前
const result = await adminClient.purgeHistory('!roomId:server.com', purgeTs)

console.log(`Purge ID: ${result.purge_id}`)
console.log('History purged successfully')
```

## 设备管理

### 列出用户设备

```typescript
// 获取用户的所有设备
const devices = await adminClient.listDevices('@user:server.com')

devices.forEach(device => {
  console.log(`- ${device.device_id}`)
  console.log(`  Display name: ${device.display_name}`)
  console.log(`  Last seen: ${new Date(device.last_seen_ts).toLocaleString()}`)
  console.log(`  IP: ${device.last_seen_ip}`)
  console.log(`  User agent: ${device.last_seen_user_agent}`)
})
```

### 删除设备

```typescript
// 删除特定设备
await adminClient.deleteDevice('@user:server.com', 'DEVICE_ID')

console.log('Device deleted, user will need to re-authenticate')
```

## 媒体管理

### 清除媒体缓存

```typescript
// 清除指定时间之前的媒体缓存
const beforeTs = Math.floor(Date.now() / 1000) - 86400 * 90  // 90天前
const result = await adminClient.purgeMediaCache(beforeTs)

console.log(`Deleted ${result.deleted} media items from cache`)
```

### 删除用户媒体

```typescript
// 删除特定用户上传的所有媒体
const result = await adminClient.deleteUserMedia('@user:server.com')

console.log(`Deleted ${result.deleted_media} of ${result.total} media items`)
```

## 服务器管理

### 获取服务器版本

```typescript
// 获取 Synapse 服务器版本信息
const version = await adminClient.getServerVersion()

console.log(`Server version: ${version.server_version}`)
console.log(`Python version: ${version.python_version}`)
```

## 审计日志

### 审计日志格式

所有管理操作都会自动记录审计日志：

```typescript
interface AdminAuditLog {
  id: string                    // 审计日志ID
  operatorId: string            // 操作者用户ID
  operationType: AdminOperationType  // 操作类型
  targetId: string              // 目标ID
  targetType: 'user' | 'room' | 'device' | 'media'  // 目标类型
  timestamp: number             // 操作时间戳
  result: 'success' | 'failure' // 操作结果
  details?: Record<string, unknown>  // 详细信息
}

type AdminOperationType =
  | 'user.get' | 'user.list' | 'user.update_admin' | 'user.deactivate'
  | 'user.reset_password' | 'user.delete_tokens'
  | 'device.list' | 'device.delete'
  | 'room.list' | 'room.get' | 'room.delete' | 'room.purge_history'
  | 'media.purge' | 'media.delete_user'
```

### 查看审计日志

```typescript
import { logger } from '@/utils/logger'

// 审计日志会自动输出到控制台
// [AdminAudit] {
//   id: 'audit_1234567890_abc123',
//   operatorId: '@admin:server.com',
//   operationType: 'user.update_admin',
//   targetId: '@user:server.com',
//   targetType: 'user',
//   timestamp: 1234567890123,
//   result: 'success',
//   details: { admin: true }
// }
```

## 完整示例

### 管理员仪表板

```typescript
import { adminClient } from '@/services/adminClient'
import { logger } from '@/utils/logger'

class AdminDashboard {
  // 显示用户统计
  async showUserStats() {
    const result = await adminClient.listUsers({
      from: 0,
      limit: 1,
      deactivated: false,
      guests: false
    })

    console.log('=== User Statistics ===')
    console.log(`Total active users: ${result.total}`)
  }

  // 显示房间统计
  async showRoomStats() {
    const result = await adminClient.listRooms({
      from: 0,
      limit: 1
    })

    console.log('=== Room Statistics ===')
    console.log(`Total rooms: ${result.total_rooms}`)
  }

  // 搜索用户
  async searchUser(searchTerm: string) {
    const result = await adminClient.listUsers({
      name: searchTerm,
      limit: 10,
      deactivated: false
    })

    console.log(`Found ${result.users.length} users matching "${searchTerm}":`)
    result.users.forEach(user => {
      console.log(`- ${user.name}`)
      console.log(`  Display: ${user.display_name || 'N/A'}`)
      console.log(`  Admin: ${user.admin ? 'Yes' : 'No'}`)
      console.log(`  Created: ${new Date(user.creation_ts * 1000).toLocaleDateString()}`)
    })
  }

  // 管理用户
  async manageUser(userId: string, action: 'deactivate' | 'activate' | 'make_admin' | 'remove_admin') {
    try {
      switch (action) {
        case 'deactivate':
          await adminClient.setUserDeactivated(userId, true)
          console.log(`User ${userId} has been deactivated`)
          break

        case 'activate':
          await adminClient.setUserDeactivated(userId, false)
          console.log(`User ${userId} has been activated`)
          break

        case 'make_admin':
          await adminClient.updateUserAdmin(userId, true)
          console.log(`User ${userId} is now an admin`)
          break

        case 'remove_admin':
          await adminClient.updateUserAdmin(userId, false)
          console.log(`Admin rights removed from ${userId}`)
          break
      }
    } catch (error) {
      console.error(`Failed to ${action} user ${userId}:`, error)
    }
  }

  // 清理旧媒体
  async cleanupOldMedia(daysOld = 90) {
    const beforeTs = Math.floor(Date.now() / 1000) - (daysOld * 86400)

    console.log(`Cleaning up media older than ${daysOld} days...`)

    const result = await adminClient.purgeMediaCache(beforeTs)
    console.log(`Cleaned up ${result.deleted} media items`)
  }

  // 显示服务器信息
  async showServerInfo() {
    const version = await adminClient.getServerVersion()

    console.log('=== Server Information ===')
    console.log(`Synapse version: ${version.server_version}`)
    console.log(`Python version: ${version.python_version}`)
  }
}

// 使用示例
async function adminExample() {
  const dashboard = new AdminDashboard()

  try {
    // 显示服务器信息
    await dashboard.showServerInfo()

    // 显示统计信息
    await dashboard.showUserStats()
    await dashboard.showRoomStats()

    // 搜索用户
    await dashboard.searchUser('john')

    // 管理用户
    await dashboard.manageUser('@john:server.com', 'make_admin')
    await dashboard.manageUser('@spam:server.com', 'deactivate')

    // 清理旧媒体
    await dashboard.cleanupOldMedia(90)

  } catch (error) {
    logger.error('Admin operation failed:', error)
  }
}
```

### 用户批量操作

```typescript
class UserBatchOperations {
  // 批量停用不活跃用户
  async deactivateInactiveUsers(daysInactive = 180) {
    const inactiveBefore = Date.now() - (daysInactive * 86400 * 1000)

    // 获取所有用户
    const result = await adminClient.listUsers({
      from: 0,
      limit: 1000,
      deactivated: false
    })

    let deactivatedCount = 0

    for (const user of result.users) {
      // 检查用户是否活跃（假设有 last_seen_ts 字段）
      // 注意：这可能需要额外的 API 调用来获取用户活动信息
      // 这里只是示例逻辑

      // if (user.last_seen_ts && user.last_seen_ts < inactiveBefore) {
      //   await adminClient.setUserDeactivated(user.name, true)
      //   deactivatedCount++
      //   console.log(`Deactivated ${user.name}`)
      // }
    }

    console.log(`Deactivated ${deactivatedCount} inactive users`)
  }

  // 批量提升用户为管理员
  async makeUsersAdmin(userIds: string[]) {
    for (const userId of userIds) {
      try {
        await adminClient.updateUserAdmin(userId, true)
        console.log(`Made ${userId} an admin`)
      } catch (error) {
        console.error(`Failed to make ${userId} an admin:`, error)
      }
    }
  }
}
```

### 房间清理工具

```typescript
class RoomCleanupTool {
  // 删除空房间
  async deleteEmptyRooms() {
    const result = await adminClient.listRooms({
      limit: 1000,
      order_by: 'joined_members',
      dir: 'f'  // 升序排列，空房间在前
    })

    let deletedCount = 0

    for (const room of result.rooms) {
      if (room.joined_members === 0) {
        try {
          await adminClient.deleteRoom(room.room_id, {
            block: false,
            purge: true  // 完全删除
          })
          deletedCount++
          console.log(`Deleted empty room: ${room.room_id}`)
        } catch (error) {
          console.error(`Failed to delete room ${room.room_id}:`, error)
        }
      }
    }

    console.log(`Deleted ${deletedCount} empty rooms`)
  }

  // 清除旧房间历史
  async purgeOldRoomHistories(daysToKeep = 365) {
    const purgeBeforeTs = Math.floor(Date.now() / 1000) - (daysToKeep * 86400)

    const result = await adminClient.listRooms({
      limit: 1000
    })

    let purgedCount = 0

    for (const room of result.rooms) {
      try {
        const purgeResult = await adminClient.purgeHistory(
          room.room_id,
          purgeBeforeTs
        )
        purgedCount++
        console.log(`Purged history for ${room.room_id}: ${purgeResult.purge_id}`)
      } catch (error) {
        console.error(`Failed to purge history for ${room.room_id}:`, error)
      }
    }

    console.log(`Purged history for ${purgedCount} rooms`)
  }
}
```

## 注意事项

### 权限要求

使用 Synapse Admin API 需要用户具有管理员权限。确保用户是服务器管理员：

```typescript
// 检查当前用户是否为管理员
import { useMatrixAuthStore } from '@/stores/matrixAuth'

const auth = useMatrixAuthStore()
// 用户需要是服务器配置文件中的 admin_users
```

### 错误处理

所有 AdminClient 方法都会抛出错误，应该使用 try-catch 处理：

```typescript
try {
  await adminClient.setUserDeactivated('@user:server.com', true)
} catch (error) {
  // 错误已经被 MatrixErrorHandler 转换
  console.error('Operation failed:', error)
}
```

### 审计日志

所有管理操作都会自动记录审计日志，包括：
- 操作者 ID
- 操作类型
- 目标 ID 和类型
- 操作结果（成功/失败）
- 时间戳

这些日志对于安全和合规非常重要。

### 性能考虑

- 列出操作（`listUsers`, `listRooms`）支持分页，使用 `from` 和 `limit` 参数控制
- 批量操作时应该添加延迟以避免服务器过载
- 清除历史和媒体是资源密集型操作，应该在低峰期执行

## API 参考

### AdminClient 类

```typescript
class AdminClient {
  // 单例
  static getInstance(): AdminClient

  // 用户管理
  getUser(userId: string): Promise<AdminUser>
  listUsers(params?: AdminUserListParams): Promise<{
    users: AdminUser[]
    next_token?: string
    total: number
  }>
  updateUserAdmin(userId: string, admin: boolean): Promise<void>
  setUserDeactivated(userId: string, deactivated: boolean): Promise<void>
  resetPassword(userId: string, newPassword: string, logoutDevices?: boolean): Promise<void>
  deleteTokens(userId: string): Promise<void>

  // 设备管理
  listDevices(userId: string): Promise<AdminDevice[]>
  deleteDevice(userId: string, deviceId: string): Promise<void>

  // 房间管理
  listRooms(params?: AdminRoomListParams): Promise<{
    rooms: AdminRoom[]
    next_batch?: string
    total_rooms: number
  }>
  getRoom(roomId: string): Promise<AdminRoom>
  deleteRoom(roomId: string, options?: {
    block?: boolean
    purge?: boolean
  }): Promise<void>
  purgeHistory(roomId: string, purgeUpToTs: number): Promise<{
    purge_id: string
  }>

  // 媒体管理
  purgeMediaCache(beforeTs: number): Promise<{ deleted: number }>
  deleteUserMedia(userId: string): Promise<{
    deleted_media: number
    total: number
  }>

  // 服务器管理
  getServerVersion(): Promise<{
    server_version: string
    python_version: string
  }>
}
```

### 类型定义

```typescript
interface AdminUser {
  name: string
  admin: boolean
  deactivated: boolean
  guest: boolean
  user_type: number
  is_guest: boolean
  appservice_id: string | null
  creation_ts: number
  displayname: string | null
  avatar_url: string | null
  threepids: Array<{
    medium: string
    address: string
    validated_at: number | null
  }>
}

interface AdminRoom {
  room_id: string
  name: string
  canonical_alias: string
  topic: string
  num_joined_members: number
  num_joined_local_members: number
  num_local_events: number
  version: string
  room_version: string
  creator: string
  encryption: string
  federatable: boolean
  public: boolean
  join_rules: string
  guest_access: string
  history_visibility: string
  state_events: number
  created_ts: number
}

interface AdminDevice {
  device_id: string
  display_name: string
  last_seen_ts: number
  last_seen_ip: string
  last_seen_user_agent: string
}

interface AdminUserListParams {
  from?: number
  limit?: number
  name?: string
  guests?: boolean
  deactivated?: boolean
}

interface AdminRoomListParams {
  from?: string
  limit?: number
  order_by?: 'name' | 'joined_members' | 'created_ts' | 'current_state_events'
  dir?: 'f' | 'b'
}
```
