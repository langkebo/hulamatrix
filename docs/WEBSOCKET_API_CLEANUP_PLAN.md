# WebSocket API 清理方案

**创建日期**: 2026-01-08
**目的**: 彻底清除老项目 WebSocket API 相关代码，只保留 Matrix 服务器对接代码
**状态**: 计划中

---

## 执行摘要

项目已完成从老后端到 Matrix 服务器的迁移，但仍存在大量与老 WebSocket API 相关的桥接代码。本方案提供系统化的清理路径，确保项目整洁高效。

### 核心发现

| 类别 | 文件数量 | API 端点 | 清理优先级 |
|------|----------|---------|-----------|
| 核心 API 桥接 | 1 | 9 个端点 | 🔴 高 |
| Stores | 6 | 15+ 个端点 | 🔴 高 |
| Hooks | 2 | 4 个端点 | 🟡 中 |
| Services | 3 | 6+ 个端点 | 🟡 中 |
| 特色功能 | 2 | 6+ 个端点 | 🟢 低 |

---

## 第 1 部分：核心架构清理（最高优先级）

### 1.1 MatrixApiBridgeAdapter.ts

**文件**: `src/utils/MatrixApiBridgeAdapter.ts`
**状态**: 🟡 需要保留部分功能
**原因**:
- 该文件实现了 `requestWithFallback` 函数，是 WebSocket 和 Matrix API 之间的桥接层
- 部分功能（如表情、上传）仍需要此桥接
- 清理策略：**删除文件，将必要功能迁移到对应服务**

**清理步骤**:
1. 确认所有使用 `requestWithFallback` 的地方
2. 将必要的端点迁移到各自的服务模块
3. 删除整个文件

**影响范围**:
- `src/services/tauriCommand.ts`
- `src/stores/group.ts`
- `src/stores/user.ts`
- `src/stores/config.ts`
- `src/stores/emoji.ts`
- `src/stores/dataCache.ts`
- `src/utils/chatListMenu.ts`
- `src/hooks/useMessage.ts`
- `src/hooks/useUpload.ts`
- `src/views/friendWindow/AddGroupVerify.vue`

### 1.2 flags.matrixEnabled 检查

**文件**: 多个文件
**状态**: 🟢 可以移除
**原因**: 项目已完全迁移到 Matrix，不再需要功能开关

**需要移除的位置**:
```typescript
// 移除这些检查
if (adapter && flags.matrixEnabled) { ... }
if (flags.matrixEnabled) { ... }
if (VITE_MATRIX_ENABLED === 'on') { ... }
```

---

## 第 2 部分：Stores 清理（高优先级）

### 2.1 stores/group.ts

**文件**: `src/stores/group.ts` (1280 行)
**WebSocket API 端点**: 9 个
**状态**: 🟡 部分可清理

#### 需要清理的代码

| 行号 | API 端点 | 方法 | Matrix 替代方案 | 操作 |
|------|---------|------|-----------------|------|
| 95-106 | `set_group_announcement` | `setGroupAnnouncement` | ✅ `adapter.setGroupAnnouncement()` | 保留 fallback |
| 117-131 | `get_group_announcement` | `getGroupAnnouncement` | ✅ `adapter.getGroupAnnouncement()` | 保留 fallback |
| 343-350 | `get_room_list` | `setGroupDetails` | ✅ `adapter.getGroupList()` | **删除 fallback** |
| 367-381 | `get_room_detail` | `addGroupDetail` | ✅ `adapter.getGroupDetail()` | **删除 fallback** |
| 830-835 | `get_room_members` | `getGroupUserList` | ✅ `sdkGetJoinedMembers()` | **删除 fallback** |
| 999-1003 | `add_room_admin` | `addAdmin` | ✅ `sdkSetPowerLevel()` | **删除 fallback** |
| 1040-1044 | `revoke_room_admin` | `revokeAdmin` | ✅ `sdkSetPowerLevel()` | **删除 fallback** |
| 1084-1088 | `remove_group_member` | `removeGroupMembers` | ✅ `sdkKickFromRoom()` | **删除 fallback** |
| 1119-1123 | `exit_group` | `exitGroup` | ✅ `sdkLeaveRoom()` | **删除 fallback** |

#### 清理策略

**阶段 1**: 删除 `if-else` 双模式逻辑
```typescript
// 删除前
if (adapter && flags.matrixEnabled) {
  try {
    await adapter.setGroupAnnouncement(roomId, announcement)
  } catch (error) {
    // 降级到原有方式
    await requestWithFallback({
      url: 'set_group_announcement',
      body: { roomId, announcement }
    })
  }
} else {
  // 使用原有方式
  await requestWithFallback({
    url: 'set_group_announcement',
    body: { roomId, announcement }
  })
}

// 保留后（仅 Matrix 模式）
await adapter.setGroupAnnouncement(roomId, announcement)
```

**阶段 2**: 删除 GroupToRoomAdapter 的降级逻辑

#### 具体修改

```typescript
// 第 86-106 行: setGroupAnnouncement
// 删除 fallback，仅保留 Matrix 实现

// 第 109-131 行: getGroupAnnouncement
// 删除 fallback，仅保留 Matrix 实现

// 第 295-351 行: setGroupDetails
// 删除 lines 342-345 (fallback)

// 第 353-381 行: addGroupDetail
// 删除 lines 366-372 (fallback)

// 第 779-848 行: getGroupUserList
// 删除 lines 828-835 (WebSocket 模式)

// 第 978-1014 行: addAdmin
// 删除 lines 997-1003 (fallback)

// 第 1019-1055 行: revokeAdmin
// 删除 lines 1038-1044 (fallback)

// 第 1061-1094 行: removeGroupMembers
// 删除 lines 1083-1088 (fallback)

// 第 1099-1141 行: exitGroup
// 删除 lines 1117-1123 (fallback)
```

#### 删除的导入

```typescript
// 删除这些导入
import { requestWithFallback } from '@/utils/MatrixApiBridgeAdapter'
```

### 2.2 stores/user.ts

**文件**: `src/stores/user.ts`
**WebSocket API 端点**: 1 个
**状态**: 🟢 可以清理

#### 需要清理的代码

| 行号 | API 端点 | 方法 | Matrix 替代方案 |
|------|---------|------|-----------------|
| 37-39 | `get_user_info` | `getUserDetailAction` | ✅ `matrixClientService.getClient().getUser()` |

#### 清理策略

**阶段 1**: 替换为 Matrix SDK 方法
```typescript
// 删除前
await requestWithFallback({ url: 'get_user_info' })

// 保留后
const client = matrixClientService.getClient()
const userInfo = client.getUser(userId)
```

### 2.3 stores/config.ts

**文件**: `src/stores/config.ts`
**WebSocket API 端点**: 1 个
**状态**: 🟡 需要重新设计

#### 需要清理的代码

| 行号 | API 端点 | 方法 | 替代方案 |
|------|---------|------|----------|
| 24-26 | `init_config` | `initConfig` | ❌ 无直接替代 |

#### 清理策略

**注意**: 配置初始化是关键功能，需要重新设计
- 使用 Matrix Account Data API 存储用户配置
- 或使用本地存储 + Matrix 同步

### 2.4 stores/emoji.ts

**文件**: `src/stores/emoji.ts`
**WebSocket API 端点**: 3 个
**状态**: 🔴 需要重新设计

#### 需要清理的代码

| 行号 | API 端点 | 方法 | 替代方案 |
|------|---------|------|----------|
| 19-24 | `get_emoji` | `getEmojiList` | ❌ 需重新设计 |
| 35-38 | `add_emoji` | `addEmoji` | ❌ 需重新设计 |
| 50-53 | `delete_emoji` | `deleteEmoji` | ❌ 需重新设计 |

#### 清理策略

**选项 A**: 删除表情功能（最简单）
**选项 B**: 使用 Matrix Room Events 存储表情
**选项 C**: 使用 Matrix Account Data

**建议**: 选项 A - 删除表情功能，后续可通过 Matrix m.room.emoji 事件重新实现

### 2.5 stores/dataCache.ts

**文件**: `src/stores/dataCache.ts`
**WebSocket API 端点**: 1 个
**状态**: 🔴 需要重新设计

#### 需要清理的代码

| 行号 | API 端点 | 方法 | 替代方案 |
|------|---------|------|----------|
| 21-24 | `get_announcement_list` | `getGroupAnnouncementList` | ❌ 需重新设计 |

#### 清理策略

**建议**: 使用 Matrix Room State Events 存储公告

---

## 第 3 部分：Hooks 清理（中优先级）

### 3.1 hooks/useMessage.ts

**文件**: `src/hooks/useMessage.ts`
**WebSocket API 端点**: 2 个
**状态**: 🟢 可以清理

#### 需要清理的代码

| 行号 | API 端点 | Matrix 替代方案 |
|------|---------|-----------------|
| 67 | `mark_msg_read` | ✅ `sdkMarkRead()` |
| 145 | `set_session_top` | ✅ `sdkSetSessionTop()` |

#### 清理策略

**标记已读功能** (line 67):
```typescript
// 删除前
await requestWithFallback({
  url: 'mark_msg_read',
  params: { roomId: item.roomId }
})

// 保留后
await sdkMarkRead(item.roomId)
```

**会话置顶功能** (line 145):
```typescript
// 删除前
await requestWithFallback({
  url: 'set_session_top',
  body: { roomId: item.roomId, top: !item.top }
})

// 保留后
await sdkSetSessionTop(item.roomId, !item.top)
```

### 3.2 hooks/useUpload.ts

**文件**: `src/hooks/useUpload.ts`
**WebSocket API 端点**: 1 个
**状态**: 🔴 需要重新设计

#### 需要清理的代码

| 行号 | API 端点 | 方法 | 替代方案 |
|------|---------|------|----------|
| 668, 736, 779 | `get_qiniu_token` | 获取上传 token | ❌ 需重新设计 |

#### 清理策略

**Matrix 媒体上传**:
```typescript
// 使用 Matrix Content Repository
const mxcUri = await client.uploadContent(file)
```

---

## 第 4 部分：Services 清理（中优先级）

### 4.1 services/tauriCommand.ts

**文件**: `src/services/tauriCommand.ts`
**WebSocket API 端点**: 2 个
**状态**: 🟢 可以清理

#### 需要清理的代码

| 行号 | API 端点 | 方法 | Matrix 替代方案 |
|------|---------|------|-----------------|
| 130-131 | `get_all_user_state` | `loginProcess` | ❌ 使用 Presence API |
| 137-138 | `get_user_info` | `loginProcess` | ✅ `client.getUser()` |

#### 清理策略

**用户状态列表**:
```typescript
// 使用 Matrix Presence API
const presence = new Presence(client)
```

### 4.2 utils/chatListMenu.ts

**文件**: `src/utils/chatListMenu.ts`
**WebSocket API 端点**: 1 个
**状态**: 🟢 可以清理

#### 需要清理的代码

| 行号 | API 端点 | 方法 | Matrix 替代方案 |
|------|---------|------|----------|
| 168-174 | `notification` | `handleNotificationChange` | ✅ `muteRoom()` / `unmuteRoom()` |

#### 清理策略

**通知设置**:
```typescript
// 使用 Matrix 通知规则
await client.setRoomMuteState(roomId, !muted)
```

---

## 第 5 部分：组件清理（低优先级）

### 5.1 views/friendWindow/AddGroupVerify.vue

**文件**: `src/views/friendWindow/AddGroupVerify.vue`
**WebSocket API 端点**: 1 个
**状态**: 🟢 可以清理

#### 需要清理的代码

| 行号 | API 端点 | 方法 | Matrix 替代方案 |
|------|---------|------|----------|
| 79-86 | `apply_group` | `addFriend` | ✅ `client.join()` 或 `client.invite()` |

#### 清理策略

**加入/申请群组**:
```typescript
// 私有房间：申请加入
await client.join(roomId)

// 公开房间：直接加入
await client.join(roomId)
```

---

## 第 6 部分：特色功能清理（需要重新设计）

### 6.1 表情系统

**状态**: 🔴 建议删除
**原因**: Matrix 标准不包含表情包系统
**建议**:
- 删除 `src/stores/emoji.ts`
- 删除相关 UI 组件
- 后续可通过 Matrix m.room.emoji 事件重新实现

### 6.2 七牛云上传

**状态**: 🔴 必须重新设计
**原因**: Matrix 使用自己的 Content Repository
**建议**:
- 删除 `get_qiniu_token` 调用
- 使用 `client.uploadContent()` API

### 6.3 公告系统

**状态**: 🔴 需要重新设计
**原因**: 老后端的公告系统不可用
**建议**:
- 使用 Matrix Room State Events
- 或使用 Matrix Account Data

---

## 执行计划

### 阶段 1: 核心清理（1-2 天）

**前置条件**:
- [x] 完成代码审查
- [ ] 创建详细清理方案
- [ ] 备份当前代码

**任务清单**:
1. [ ] 清理 `src/stores/group.ts` 中的 fallback 逻辑
2. [ ] 清理 `src/stores/user.ts` 中的 `get_user_info` 调用
3. [ ] 清理 `src/hooks/useMessage.ts` 中的 WebSocket 调用
4. [ ] 清理 `src/utils/chatListMenu.ts` 中的 `notification` 调用
5. [ ] 运行类型检查和测试

### 阶段 2: 深度清理（2-3 天）

**任务清单**:
1. [ ] 清理 `src/services/tauriCommand.ts` 中的 WebSocket 调用
2. [ ] 清理 `src/views/friendWindow/AddGroupVerify.vue` 中的 `apply_group`
3. [ ] 清理 `src/hooks/useUpload.ts` 中的七牛云上传
4. [ ] 清理 `src/stores/config.ts` 中的配置初始化
5. [ ] 清理 `src/stores/dataCache.ts` 中的公告系统

### 阶段 3: 特色功能清理（1-2 天）

**任务清单**:
1. [ ] 删除表情系统 (`src/stores/emoji.ts`)
2. [ ] 删除相关 UI 组件
3. [ ] 清理表情相关的导入和引用

### 阶段 4: 最终清理（1 天）

**任务清单**:
1. [ ] 删除 `src/utils/MatrixApiBridgeAdapter.ts`
2. [ ] 删除所有 `flags.matrixEnabled` 检查
3. [ ] 删除环境变量 `VITE_MATRIX_ENABLED` 相关代码
4. [ ] 更新文档
5. [ ] 运行完整测试套件

---

## 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 功能缺失 | 🔴 高 | 分阶段执行，每阶段测试 |
| 类型错误 | 🟡 中 | 严格类型检查，逐个验证 |
| 性能回归 | 🟢 低 | Benchmark 对比 |
| 配置丢失 | 🟡 中 | 使用 Account Data API |

---

## 成功标准

- [ ] 所有 `requestWithFallback` 调用已移除
- [ ] 所有 WebSocket API 端点调用已移除
- [ ] `flags.matrixEnabled` 检查已移除
- [ ] Matrix SDK 替代方案完整实现
- [ ] 类型检查通过（无新增错误）
- [ ] 功能测试通过
- [ ] 项目代码减少 20%+

---

## 附录

### A. WebSocket API 端点清单

#### 群组管理
- `set_group_announcement` - 设置群公告
- `get_group_announcement` - 获取群公告
- `get_room_list` - 获取房间列表
- `get_room_detail` - 获取房间详情
- `get_room_members` - 获取房间成员

#### 成员管理
- `add_room_admin` - 添加管理员
- `revoke_room_admin` - 撤销管理员
- `remove_group_member` - 移除成员
- `exit_group` - 退出群组

#### 用户相关
- `get_user_info` - 获取用户信息
- `get_all_user_state` - 获取用户状态列表

#### 消息相关
- `mark_msg_read` - 标记消息已读
- `set_session_top` - 设置会话置顶

#### 通知系统
- `notification` - 更新通知设置

#### 表情系统
- `get_emoji` - 获取表情列表
- `add_emoji` - 添加表情
- `delete_emoji` - 删除表情

#### 媒体上传
- `get_qiniu_token` - 获取上传 token

#### 群组申请
- `apply_group` - 申请加入群组

#### 配置相关
- `init_config` - 初始化配置

#### 公告系统
- `get_announcement_list` - 获取公告列表

### B. Matrix SDK 替代方案参考

#### 群组管理
```typescript
// 获取房间列表
const rooms = client.getRooms()

// 获取房间详情
const room = client.getRoom(roomId)
const summary = room.getSummary()

// 获取成员列表
const members = await client.getJoinedMembers(roomId)
```

#### 成员管理
```typescript
// 添加管理员（设置 Power Level）
await client.setPowerLevel(roomId, userId, 50)

// 踢出成员
await client.kick(roomId, userId)

// 离开房间
await client.leave(roomId)
```

#### 用户相关
```typescript
// 获取用户信息
const user = client.getUser(userId)
const profile = await client.getProfileInfo(userId)
```

#### 消息相关
```typescript
// 标记已读
await client.setRoomReadMarkers(roomId)

// 设置通知
await client.setRoomMuteState(roomId, true)
```

---

**文档版本**: v1.0
**最后更新**: 2026-01-08
**负责人**: Claude Code
