# 群组邀请功能清理计划

**创建日期**: 2026-01-08
**目的**: 删除老项目遗留的群组邀请功能，该功能使用自定义 WebSocket API，后端不存在对应实现
**状态**: ✅ 已完成

---

## 执行摘要

项目中存在两种"群组"功能：

1. **核心群组管理** (保留) - 使用 Matrix SDK 的 Room 功能
2. **群组邀请功能** (删除) - 老项目遗留的 WebSocket API

### 结论

群组邀请功能（`pendingGroups`, `acceptGroupInvite`, `rejectGroupInvite`）使用自定义 WebSocket API (`request_friend_list`, `agree_friend_request`)，这些 API 在后端**不存在**。

Matrix 有**原生房间邀请机制**，无需自定义 API。

---

## 功能分析

### 1. 核心群组管理 ✅ 保留

**实现**: `src/stores/group.ts` + `src/adapters/group-to-room-adapter.ts`

```typescript
/**
 * 群功能到房间功能的适配器
 * 提供向后兼容的API，内部使用Matrix房间功能
 */
export class GroupToRoomAdapter {
  // 这些功能使用 Matrix SDK，是正确的
  async getGroupList()      // → client.getJoinedRooms()
  async getGroupDetail()    // → Room State
  async getGroupMembers()   // → client.getJoinedMembers()
  async setGroupAdmin()     // → Power Levels
  async kickFromGroup()     // → client.kick()
  async leaveGroup()        // → client.leave()
}
```

### 2. 群组邀请功能 ❌ 删除

**实现**: `src/stores/friends.ts` (lines 136, 240-286)

```typescript
// 这些功能使用自定义 WebSocket API，后端不存在
state: {
  pendingGroups: [] as NoticeItem[]  // ❌ API: request_friend_list
}

methods: {
  async refreshGroupPending()      // ❌ API: request_friend_list
  async acceptGroupInvite()        // ❌ API: agree_friend_request
  async rejectGroupInvite()        // ❌ API: agree_friend_request
}
```

---

## Matrix 原生替代方案

Matrix SDK 提供完整的房间邀请机制：

### 邀请用户加入房间

```typescript
// 邀请用户
await client.invite(roomId, userId)

// 带原因的邀请
await client.invite(roomId, userId, { reason: "请加入我们的群组" })
```

### 接受邀请

```typescript
// 接受邀请
await client.join(roomId)

// 带原因的加入
await client.join(roomId, { viaServers: ["server.com"] })
```

### 拒绝邀请

```typescript
// 拒绝邀请（即离开房间）
await client.leave(roomId)

// 带原因的拒绝
await client.leave(roomId, { reason: "暂时不感兴趣" })
```

### 监听邀请事件

```typescript
// 监听成员事件
client.on('RoomMember.event', (event) => {
  const content = event.getContent()
  const membership = content.membership

  if (membership === 'invite') {
    // 处理邀请
    console.log('收到邀请:', event.getSender())
  } else if (membership === 'join') {
    // 用户加入
  } else if (membership === 'leave') {
    // 用户离开/拒绝
  }
})

// 获取当前用户收到的邀请
const rooms = client.getRooms()
const invitedRooms = rooms.filter(room =>
  room.getMyMembership() === 'invite'
)
```

---

## 删除清单

### 1. Store 修改

**文件**: `src/stores/friends.ts`

| 行号 | 删除内容 | 类型 |
|-----|---------|------|
| 136 | `pendingGroups: [] as NoticeItem[]` | 状态 |
| 240-262 | `refreshGroupPending()` 方法 | 方法 |
| 263-273 | `acceptGroupInvite()` 方法 | 方法 |
| 275-284 | `rejectGroupInvite()` 方法 | 方法 |

### 2. 组件修改

#### 2.1 FriendsList.vue

**文件**: `src/views/homeWindow/FriendsList.vue`

| 行号 | 删除内容 | 原因 |
|-----|---------|------|
| 20-31 | 群通知入口 UI | 功能不存在 |
| 319-326 | `handleApply('group')` 相关逻辑 | API 不存在 |

#### 2.2 ApplyList.vue

**文件**: `src/components/chat/ApplyList.vue`

| 行号 | 删除内容 | 原因 |
|-----|---------|------|
| 183 | `friendsStore.pendingGroups` 引用 | 状态不存在 |
| 338-341 | 群邀请接受逻辑 | API 不存在 |
| 357-360 | 群邀请拒绝逻辑 | API 不存在 |
| 377 | `refreshGroupPending()` 调用 | 方法不存在 |

#### 2.3 MobileApplyList.vue

**文件**: `src/mobile/components/profile/MobileApplyList.vue`

| 行号 | 删除内容 | 原因 |
|-----|---------|------|
| 158 | `friendsStore.pendingGroups` 引用 | 状态不存在 |
| 325-327 | 群邀请接受逻辑 | API 不存在 |
| 342-345 | 群邀请拒绝逻辑 | API 不存在 |
| 355 | `refreshGroupPending()` 调用 | 方法不存在 |

### 3. 测试文件

**文件**: `src/__tests__/e2e/approval_flow.spec.ts`

删除所有与 `refreshGroupPending`, `acceptGroupInvite`, `rejectGroupInvite` 相关的测试用例。

---

## 执行步骤

### 阶段 1: 创建清理计划文档 ✅

- [x] 分析群组功能来源
- [x] 确认 Matrix SDK 替代方案
- [x] 创建清理计划文档

### 阶段 2: 删除 Store 中的群组邀请代码 ✅

- [x] 删除 `pendingGroups` 状态
- [x] 删除 `refreshGroupPending()` 方法
- [x] 删除 `acceptGroupInvite()` 方法
- [x] 删除 `rejectGroupInvite()` 方法

### 阶段 3: 清理组件中的引用 ✅

- [x] 清理 `FriendsList.vue` 中的群通知入口
- [x] 清理 `ApplyList.vue` 中的群邀请处理逻辑
- [x] 清理 `MobileApplyList.vue` 中的群邀请处理逻辑

### 阶段 4: 验证和测试 ✅

- [x] 运行类型检查
- [x] 确认无编译错误
- [x] 更新相关文档

---

## 影响评估

### 用户影响

- ❌ 用户将无法通过 UI 查看"群通知"
- ✅ 用户仍可通过 Matrix 原生机制收到和接受房间邀请
- ✅ 现有群组功能完全正常

### 代码减少

- **删除代码行数**: ~100 行
- **删除文件数**: 0 个（仅修改现有文件）
- **减少维护成本**: 移除无后端支持的死代码

### 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 用户习惯改变 | 🟡 低 | Matrix 原生邀请机制已存在 |
| 功能缺失 | 🟢 无 | 功能本身不工作（后端无 API） |
| 代码回归 | 🟢 无 | 仅删除代码，不添加新逻辑 |

---

## 后续建议

### 1. 使用 Matrix 原生邀请机制

如果需要房间邀请功能，使用 Matrix SDK 原生 API：

```typescript
// 邀请用户到房间
await matrixClientService.getClient().invite(roomId, userId)

// 监听邀请
matrixClientService.getClient().on('RoomMember.event', handleMembershipEvent)
```

### 2. 实现 UI 组件

创建新的邀请管理组件，使用 Matrix 事件系统：

```typescript
// 获取待处理邀请
const getPendingInvites = () => {
  const client = matrixClientService.getClient()
  return client.getRooms().filter(room =>
    room.getMyMembership() === 'invite'
  )
}

// 接受邀请
const acceptInvite = async (roomId: string) => {
  await matrixClientService.getClient().join(roomId)
}

// 拒绝邀请
const declineInvite = async (roomId: string) => {
  await matrixClientService.getClient().leave(roomId)
}
```

---

## 参考资料

- [Matrix JS SDK - Room Management](../matrix-sdk/03-room-management.md)
- [Matrix JS SDK - Events Handling](../matrix-sdk/05-events-handling.md)
- [Matrix Spec - Room Events](https://spec.matrix.org/v1.11/client-server-api/#room-membership)

---

**文档版本**: v1.0
**最后更新**: 2026-01-08
**执行状态**: ✅ 已完成
