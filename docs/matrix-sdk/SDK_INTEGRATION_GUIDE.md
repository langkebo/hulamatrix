# Matrix JS SDK v39.1.3 集成指南

> HuLaMatrix 项目本地SDK集成文档

**版本**: 1.0.0
**SDK版本**: 39.1.3
**后端要求**: Synapse 1.140.0 Enhanced Module v1.0.2+
**更新日期**: 2026-01-02

---

## 目录

- [概述](#概述)
- [SDK配置](#sdk配置)
- [API端点变更](#api端点变更)
- [代码结构](#代码结构)
- [使用示例](#使用示例)
- [类型定义](#类型定义)
- [故障排查](#故障排查)

---

## 概述

HuLaMatrix 项目使用本地的 matrix-js-sdk-39.1.3，该版本经过优化以支持 Synapse Enhanced Module v1.0.2 的 RESTful API 端点。

### 主要特性

- ✅ **本地SDK集成**: 使用 `file:../matrix-js-sdk-39.1.3` 路径引用本地SDK
- ✅ **RESTful API**: 支持新的 RESTful 端点（`/_synapse/client/enhanced/*`）
- ✅ **V2 API客户端**: 提供 `friendsV2` 和 `privateChatV2` 客户端
- ✅ **完整类型定义**: TypeScript 类型安全支持
- ✅ **缓存机制**: 内置 LRU 缓存，5分钟 TTL
- ✅ **事件系统**: EventEmitter 模式，实时更新

---

## SDK配置

### 1. package.json 配置

```json
{
  "dependencies": {
    "matrix-js-sdk": "file:../matrix-js-sdk-39.1.3"
  }
}
```

### 2. TypeScript 路径配置 (tsconfig.json)

```json
{
  "paths": {
    "matrix-js-sdk/*": ["../matrix-js-sdk-39.1.3/*"],
    "matrix-js-sdk": ["../matrix-js-sdk-39.1.3"]
  }
}
```

### 3. 安装命令

```bash
# 在 HuLamatrix 目录下
pnpm install

# 验证 SDK 链接
ls -la node_modules/ | grep matrix
# 应该看到: matrix-js-sdk -> .pnpm/matrix-js-sdk@file+..+matrix-js-sdk-39.1.3/node_modules/matrix-js-sdk
```

---

## API端点变更

### 旧版 API (Action-based)

| 功能 | 端点 | 方法 |
|------|------|------|
| 好友列表 | `/_synapse/client/friends?action=list` | GET |
| 发送请求 | `/_synapse/client/friends` + body `{action: "request"}` | POST |
| 删除好友 | `/_synapse/client/friends` + body `{action: "remove"}` | POST |

### 新版 API (RESTful)

| 功能 | 端点 | 方法 |
|------|------|------|
| 好友列表 | `/_synapse/client/enhanced/friends/list` | GET |
| 发送请求 | `/_synapse/client/enhanced/friends/request` | POST |
| **删除好友** | **`/_synapse/client/enhanced/friends/remove`** | **DELETE** ✨ |

### 关键变更

1. **基础路径**: `/_synapse/client/friends` → `/_synapse/client/enhanced/friends`
2. **移除 action 参数**: `?action=list` → `/list`
3. **HTTP 方法修正**: 删除操作使用 DELETE 而非 POST

---

## 代码结构

```
HuLamatrix/
├── src/
│   ├── adapters/
│   │   ├── matrix-friends-adapter-v2.ts    # V2 好友适配器
│   │   └── matrix-private-chat-adapter-v2.ts # V2 私聊适配器
│   ├── integrations/
│   │   └── matrix/
│   │       ├── client.ts                      # Matrix 客户端服务
│   │       ├── enhanced-v2.ts                 # V2 功能桥接 ⭐ NEW
│   │       └── index.ts                       # 导出 setupEnhancedV2Features
│   ├── services/
│   │   ├── friendsServiceV2.ts               # V2 好友服务
│   │   └── privateChatServiceV2.ts           # V2 私聊服务
│   ├── stores/
│   │   ├── friendsV2.ts                      # V2 好友 Store
│   │   └── privateChatV2.ts                  # V2 私聊 Store
│   └── types/
│       └── matrix-sdk-v2.ts                  # V2 类型定义
└── docs/matrix-sdk/
    ├── README.md                             # SDK 功能参考
    ├── 11-friends-system.md                  # 好友系统文档
    ├── 12-private-chat.md                    # 私聊系统文档
    └── SDK_INTEGRATION_GUIDE.md              # 本文档
```

---

## 使用示例

### 1. 获取好友客户端

```typescript
import { matrixClientService } from '@/integrations/matrix/client'
import { friendsServiceV2 } from '@/services/friendsServiceV2'

// 获取客户端
const client = matrixClientService.getClient()
const friendsV2 = (client as any).friendsV2

// 或通过服务
const friendList = await friendsServiceV2.listFriends()
```

### 2. 发送好友请求

```typescript
// 使用新的 API
const requestId = await friendsServiceV2.sendFriendRequest(
  '@alice:matrix.org',
  'Hi, let\'s be friends!',
  1 // category_id
)
```

### 3. 使用私聊功能

```typescript
import { privateChatServiceV2 } from '@/services/privateChatServiceV2'

// 创建会话
const session = await privateChatServiceV2.createSession({
  participants: ['@user:matrix.org'],
  session_name: 'Private Chat',
  ttl_seconds: 3600
})

// 发送消息
await privateChatServiceV2.sendText(session.session_id, 'Hello!')

// 订阅新消息
const unsubscribe = privateChatServiceV2.subscribeToMessages(
  session.session_id,
  (message) => {
    console.log('New message:', message.content)
  }
)
```

---

## 类型定义

### FriendItem (好友信息)

```typescript
interface FriendItem {
  user_id: string           // Matrix 用户 ID
  display_name?: string    // 显示名称
  avatar_url?: string      // 头像 URL (mxc://)
  presence: 'online' | 'offline' | 'unavailable' | 'away'
  category_id?: number     // 分组 ID
  category_name?: string   // 分组名称
  created_at: string       // 创建时间 (ISO 8601)
}
```

### PrivateChatSessionItem (私聊会话)

```typescript
interface PrivateChatSessionItem {
  session_id: string
  participants: string[]           // 参与者列表
  session_name?: string            // 会话名称
  created_by: string              // 创建者
  created_at: string              // 创建时间
  ttl_seconds?: number            // 生存时间（秒）
  expires_at?: string             // 过期时间
  unread_count?: number           // 未读消息数
}
```

---

## 初始化流程

### 1. 客户端初始化

```typescript
import { matrixClientService } from '@/integrations/matrix/client'
import { setupMatrixBridges } from '@/integrations/matrix'

// 1. 初始化 Matrix 客户端
await matrixClientService.initialize({
  baseUrl: 'https://matrix.cjystx.top',
  accessToken: token,
  userId: userId
})

// 2. 启动客户端
await matrixClientService.startClient()

// 3. 设置桥接（包括 V2 功能）
setupMatrixBridges()
```

### 2. V2 功能自动初始化

`setupMatrixBridges()` 会自动调用 `setupEnhancedV2Features()`：

```typescript
// src/integrations/matrix/enhanced-v2.ts
export async function setupEnhancedV2Features(): Promise<void> {
  // 初始化 Friends Service V2
  await friendsServiceV2.initialize()

  // 初始化 Private Chat Service V2
  await privateChatServiceV2.initialize()
}
```

---

## Store 使用

### FriendsV2 Store

```typescript
import { useFriendsStoreV2 } from '@/stores/friendsV2'

const friendsStore = useFriendsStoreV2()

// 获取好友列表
await friendsStore.fetchFriends()

// 发送好友请求
await friendsStore.sendFriendRequest({
  targetId: '@user:matrix.org',
  message: 'Hi!',
  categoryId: 1
})

// 搜索用户
await friendsStore.searchUsers('alice')
```

### PrivateChatV2 Store

```typescript
import { usePrivateChatStoreV2 } from '@/stores/privateChatV2'

const chatStore = usePrivateChatStoreV2()

// 获取会话列表
await chatStore.fetchSessions()

// 创建会话
await chatStore.createSession({
  participants: ['@user:matrix.org'],
  sessionName: 'Chat',
  ttlSeconds: 3600
})

// 发送消息
await chatStore.sendMessage({
  sessionId: session.session_id,
  content: 'Hello!'
})
```

---

## 故障排查

### 问题 1: v2 客户端不可用

**错误信息**:
```
Friends v2 API not available. Please update matrix-js-sdk to 39.1.3+
```

**解决方案**:
```bash
# 检查 SDK 链接
ls -la node_modules/matrix-js-sdk

# 重新安装 SDK
pnpm install matrix-js-sdk

# 验证 SDK 版本
cat node_modules/matrix-js-sdk/package.json | grep version
```

### 问题 2: API 端点 404

**可能原因**:
- 后端未升级到 v1.0.2+
- RESTful 端点未注册

**验证步骤**:
```bash
# 检查后端是否支持新端点
curl -H "Authorization: Bearer $TOKEN" \
  https://your-server.com/_synapse/client/enhanced/friends/stats

# 预期响应:
# {"status": "ok", "stats": {...}}
```

### 问题 3: 类型错误

**错误**: `Property 'friendsV2' does not exist on type 'MatrixClient'`

**解决方案**:
```typescript
// 使用类型断言
const client = matrixClientService.getClient() as any
const friendsV2 = client.friendsV2
```

---

## 最佳实践

### 1. 使用服务层而非直接访问 SDK

❌ **不推荐**:
```typescript
const client = (matrixClientService.getClient() as any)
await client.friendsV2.listFriends()
```

✅ **推荐**:
```typescript
await friendsServiceV2.listFriends()
```

### 2. 正确处理缓存

```typescript
// 强制刷新缓存
await friendsServiceV2.listFriends(false)

// 清除缓存
friendsServiceV2.invalidateCache()
```

### 3. 正确清理资源

```typescript
onUnmounted(() => {
  // 取消消息订阅
  unsubscribe()

  // 清理私聊资源
  privateChatServiceV2.dispose()
})
```

---

## 相关文档

- [Matrix SDK 官方文档](https://matrix-org.github.io/matrix-js-sdk/)
- [Synapse Enhanced Module 文档](../../synapse-1.140.0/docs/)
- [好友系统完整文档](./11-friends-system.md)
- [私聊系统完整文档](./12-private-chat.md)

---

**文档维护**: HuLaSpark 团队
**最后更新**: 2026-01-02
**版本**: 1.0.0
