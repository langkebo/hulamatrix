# Matrix SDK v39.1.3 快速入门指南

**更新日期**: 2026-01-07
**SDK 版本**: matrix-js-sdk v39.1.3
**目标**: 快速了解项目中的 Matrix SDK 使用方式

---

## 概述

HuLamatrix 项目已全面升级到 matrix-js-sdk v39.1.3。本指南帮助开发者快速了解如何使用新版本的 SDK。

---

## 核心变化

### 1. 登录 API 格式变化

#### ✅ 新格式（SDK v39.1.3）

```typescript
// 使用 identifier 替代 user
const response = await client.login('m.login.password', {
  identifier: {
    type: 'm.id.user',
    user: 'username'
  },
  password: 'password'
})

// 响应包含 refresh_token
if (response.refresh_token) {
  localStorage.setItem('refreshToken', response.refresh_token)
}
```

#### ❌ 旧格式（SDK v24.0.0）

```typescript
// 旧格式不再推荐
const response = await client.login('m.login.password', {
  user: 'username',
  password: 'password'
})
```

---

### 2. 线程支持

所有客户端启动时必须启用线程支持：

```typescript
await matrixClientService.startClient({
  initialSyncLimit: 5,
  pollTimeout: 15000,
  threadSupport: true  // ✅ 必需：启用线程功能
})
```

**影响**:
- ✅ 支持发送和接收线程消息
- ✅ 改进消息同步性能
- ❌ 不启用则线程消息功能受限

---

### 3. 客户端创建参数

```typescript
const client = createClient({
  baseUrl: 'https://matrix.org',
  accessToken: 'token',
  userId: '@user:matrix.org',
  deviceId: 'DEVICE_ID',  // ✅ 推荐：用于加密
  refreshToken: 'refresh_token',  // ✅ 新增：刷新令牌
  tokenRefreshFunction: async (refreshToken) => {  // ✅ 新增
    // 自定义刷新逻辑
    return await fetchNewToken(refreshToken)
  },
  threadSupport: true,  // ✅ 新增：线程支持
  timelineSupport: true,  // ✅ 明确：时间线支持
  // ... 其他参数
})
```

---

## 使用示例

### 示例 1: 基本登录流程

```typescript
import { matrixClientService } from '@/integrations/matrix/client'

// 1. 登录
const response = await matrixClientService.loginWithPassword('username', 'password')

console.log('User ID:', response.user_id)
console.log('Device ID:', response.device_id)
console.log('Access Token:', response.access_token)
if (response.refresh_token) {
  console.log('Refresh Token:', response.refresh_token)
}

// 2. 启动客户端（启用线程支持）
await matrixClientService.startClient({
  initialSyncLimit: 20,
  threadSupport: true  // ✅ 重要
})
```

---

### 示例 2: 发送线程消息

```typescript
import { sendMessage } from '@/services/unified-message-service'

// 发送普通消息
await sendMessage({
  roomId: '!room:matrix.org',
  content: { msgtype: 'm.text', body: 'Hello' },
  type: 'm.room.message'
})

// 发送线程消息
await sendMessage({
  roomId: '!room:matrix.org',
  content: { msgtype: 'm.text', body: 'Thread reply' },
  type: 'm.room.message',
  threadRootId: '$event_id'  // 线程根消息 ID
})
```

---

### 示例 3: 添加反应

```typescript
import { addReaction } from '@/composables/useMessageReactions'

// 添加反应到消息
await addReaction('roomId', 'eventId', '👍')
```

---

### 示例 4: 监听同步状态

```typescript
import { ClientEvent, SyncState } from 'matrix-js-sdk'

client.on(ClientEvent.Sync, (state: SyncState, prevState: SyncState, data) => {
  console.log(`Sync: ${prevState} -> ${state}`)

  switch (state) {
    case SyncState.Prepared:
      console.log('✅ 客户端已准备好')
      break

    case SyncState.Syncing:
      console.log('🔄 正在同步...')
      break

    case SyncState.Reconnecting:  // ✅ 新增
      console.log('🔌 正在重新连接...')
      break

    case SyncState.Catchup:  // ✅ 新增
      console.log('📥 正在捕获历史消息...')
      break

    case SyncState.Error:
      console.error('❌ 同步错误:', data?.error)
      break
  }
})
```

---

## 常见问题

### Q1: 如何检查线程支持是否已启用？

**A**: 查看启动日志或检查 `startClient` 调用：

```typescript
// ✅ 正确
await matrixClientService.startClient({ threadSupport: true })

// ❌ 错误 - 缺少线程支持
await matrixClientService.startClient()
```

---

### Q2: 刷新令牌如何工作？

**A**: SDK 支持两种方式：

**方式 1: 自动刷新（推荐）**
```typescript
const client = createClient({
  baseUrl,
  refreshToken,
  tokenRefreshFunction: async (refreshToken) => {
    const newTokens = await fetch('/oauth2/token', {
      method: 'POST',
      body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: refreshToken })
    }).then(r => r.json())

    return {
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token
    }
  }
})
```

**方式 2: 手动刷新**
```typescript
// 监听令牌过期事件
client.on(ClientEvent.AccountData, (event) => {
  if (event.getType() === 'm.refresh_token') {
    const newRefreshToken = event.getContent().refresh_token
    // 保存新的刷新令牌
  }
})
```

---

### Q3: 为什么登录 API 需要使用 `identifier`？

**A**: Matrix 规范 MSC3039 引入了更灵活的用户标识符系统：

```typescript
// 支持多种标识符类型
identifier: {
  type: 'm.id.user',      // 用户名
  type: 'm.id.phone',     // 电话号码
  type: 'm.id.email',     // 邮箱
  type: 'm.id.thirdparty', // 第三方 ID
  user: 'value'
}
```

这样可以支持多种登录方式，不仅仅是用户名。

---

### Q4: 类型错误如何处理？

**A**: 如果遇到类型错误，可以使用类型断言：

```typescript
// 登录参数类型
const loginParams = {
  identifier: { type: 'm.id.user' as const, user: 'username' },
  password: 'password'
}

// 使用 any 绕过类型检查（临时方案）
const response = await client.login('m.login.password', loginParams as any)
```

**注意**: 类型定义会在未来更新以完全支持新格式。

---

## 最佳实践

### ✅ 推荐做法

1. **始终启用线程支持**
   ```typescript
   await matrixClientService.startClient({ threadSupport: true })
   ```

2. **使用新的登录格式**
   ```typescript
   await client.login('m.login.password', {
     identifier: { type: 'm.id.user', user: username },
     password
   })
   ```

3. **保存和使用刷新令牌**
   ```typescript
   if (response.refresh_token) {
     localStorage.setItem('refreshToken', response.refresh_token)
   }
   ```

4. **处理新的同步状态**
   ```typescript
   case SyncState.Reconnecting:
     // 显示重连提示
     break
   case SyncState.Catchup:
     // 显示历史消息加载提示
     break
   ```

### ❌ 避免的做法

1. **不要使用旧的 `user` 格式**
   ```typescript
   // ❌ 旧格式，不推荐
   await client.login('m.login.password', { user, password })
   ```

2. **不要忘记启用线程支持**
   ```typescript
   // ❌ 线程消息功能受限
   await matrixClientService.startClient()
   ```

3. **不要忽略刷新令牌**
   ```typescript
   // ❌ 会话持久化受影响
   // 忽略 refresh_token
   ```

---

## 迁移检查清单

从旧版本迁移到 v39.1.3 时，请检查：

- [ ] 所有 `client.login()` 调用使用 `identifier` 格式
- [ ] 所有 `startClient()` 调用包含 `threadSupport: true`
- [ ] 保存和使用 `refresh_token`
- [ ] 处理新的同步状态（`Reconnecting`, `Catchup`）
- [ ] 更新相关类型定义
- [ ] 测试登录流程
- [ ] 测试线程消息功能
- [ ] 测试令牌刷新

---

## 相关文档

- **完整文档**: [HuLamatrix/docs/matrix-sdk/](../)
- **修复指南**: [FIXING_GUIDE.md](./FIXING_GUIDE.md)
- **不一致性报告**: [CODE_INCONSISTENCY_REPORT.md](./CODE_INCONSISTENCY_REPORT.md)
- **执行报告**: [FIXING_EXECUTION_REPORT.md](./FIXING_EXECUTION_REPORT.md)
- **官方文档**: [matrix-js-sdk Documentation](https://github.com/matrix-org/matrix-js-docs)

---

## 获取帮助

如果遇到问题：

1. **查看文档**: 上述相关文档
2. **检查类型**: 运行 `pnpm run typecheck`
3. **查看日志**: 浏览器控制台或 Tauri 日志
4. **示例代码**: 查看项目中的使用示例

---

**文档版本**: 1.0.0
**最后更新**: 2026-01-07
**维护者**: HuLa Matrix Team
