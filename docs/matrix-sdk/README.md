# Matrix JS SDK - HuLa 完整集成文档

> **项目**: HuLa Matrix 前端
> **SDK 版本**: matrix-js-sdk 39.1.3
> **最后更新**: 2026-01-06
> **文档版本**: 3.0.0

## 概述

本文档是 HuLa Matrix 项目中 Matrix JS SDK 的完整集成参考，涵盖了 SDK 的核心功能、企业扩展、前端集成状态以及最佳实践。

### 项目集成状态

| 模块 | SDK 实现 | 前端集成 | 后端支持 | 整体状态 |
|------|---------|---------|---------|---------|
| 客户端基础 | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 完成 |
| 身份验证 | ✅ 95% | ✅ 95% | ✅ 90% | ✅ 完成 |
| 房间管理 | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 完成 |
| 消息传递 | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 完成 |
| 事件处理 | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 完成 |
| 端到端加密 | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 完成 |
| WebRTC 通话 | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 完成 |
| 在线状态 | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 完成 |
| 媒体文件 | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 完成 |
| 搜索功能 | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 完成 |
| **好友系统** | ✅ **100%** | ✅ **100%** | ✅ 80% | ✅ **SDK 完成** |
| **私密聊天** | ✅ **100%** | ✅ **100%** | ✅ 100% | ✅ **SDK 完成** |
| 管理员 API | ✅ 90% | ✅ 80% | ✅ 100% | ✅ **核心完成** |

> **重要**:
> - Friends SDK 和 PrivateChat SDK 已完成开发并通过所有测试，前端集成 100% 完成
> - 管理员 API 核心功能已实现（用户、房间、设备、媒体管理），UI 组件可访问性优化完成
> - UI 技术审计 Phase 1-3 全部完成，项目达到高标准类型安全与可访问性

---

## 快速导航

### 核心文档
- [后端需求](./BACKEND_REQUIREMENTS_OPTIMIZED.md) - 服务器配置和 API 端点
- [前端集成指南](./FRONTEND_INTEGRATION_GUIDE.md) - 前端集成步骤
- [前端集成状态](./FRONTEND_INTEGRATION_STATUS.md) - 集成完成情况
- [前端检查清单](./FRONTEND_CHECKLIST.md) - 集成检查项

### SDK 实现文档
- [Friends SDK 优化方案](./MATRIX_SDK_OPTIMIZATION_PLAN.md) - Friends API 扩展
- [PrivateChat SDK 优化方案](./PRIVATE_CHAT_SDK_OPTIMIZATION_PLAN.md) - PrivateChat API 扩展
- [E2EE 和存储优化](./PRIVATE_CHAT_E2EE_STORAGE_OPTIMIZATION_PLAN.md) - 加密和存储实现
- [SDK 实现指南](./SDK_IMPLEMENTATION_GUIDE.md) - SDK 开发指南

### 功能参考文档

#### 基础功能
- [01. 客户端基础](./01-client-basics.md) ✅ - 初始化、配置、IndexedDB 存储
- [02. 用户认证](./02-authentication.md) ✅ - 登录、注册、令牌刷新
- [03. 房间管理](./03-room-management.md) ✅ - 创建、加入、管理房间
- [04. 消息功能](./04-messaging.md) ✅ - 发送、接收、处理消息
- [05. 事件处理](./05-events-handling.md) ✅ - 监听和处理事件

#### 高级功能
- [06. 加密功能](./06-encryption.md) ✅ - E2EE 加密、密钥管理
- [07. WebRTC 通话](./07-webrtc-calling.md) ✅ - 音视频通话、屏幕共享
- [08. 在线状态](./08-presence-typing.md) ✅ - 在线状态、输入提示
- [09. 媒体文件](./09-media-files.md) ✅ - 上传、下载、IndexedDB 缓存
- [10. 搜索功能](./10-search.md) ✅ - 搜索消息、用户、房间

#### 企业功能
- [11. 好友系统](./11-friends-system.md) ✅ v3.0.0 - **Friends SDK 完整实现**
- [12. 私密聊天](./12-private-chat.md) ✅ v3.0.0 - **PrivateChat SDK 完整实现**
- [13. 管理功能](./13-admin-api.md) ✅ - Synapse Admin API
- [15. 企业功能](./15-enterprise-features.md) ✅ - 企业功能完整参考

#### 高级功能
- [16. 服务发现](./16-server-discovery.md) ✅ - Well-Known URI
- [17. 推送通知](./17-push-notifications.md) ✅ - 推送规则
- [18. 帐号数据](./18-account-data.md) ✅ - 设置同步
- [19. 空间和群组](./19-spaces-groups.md) ✅ - Spaces
- [20. 位置共享](./20-location-sharing.md) ✅ - 位置信标
- [21. 投票功能](./21-polls.md) ✅ - 创建投票
- [22. Sliding Sync](./22-sliding-sync.md) ✅ - MSC3575
- [23. OIDC 认证](./23-oidc-authentication.md) ✅ - SSO

---

## SDK 扩展架构

### Friends SDK v3.0.0 ✅

**位置**: `src/sdk/matrix-friends/`

**功能特性**:
- ✅ 完整的 Friends API 实现
- ✅ TypeScript 类型安全
- ✅ 缓存机制优化
- ✅ 事件系统集成
- ✅ 自定义错误处理
- ✅ 33/33 单元测试通过

**API 端点**:
```http
GET    /_synapse/client/friends/list
POST   /_synapse/client/friends/request
POST   /_synapse/client/friends/accept/{userId}
DELETE /_synapse/client/friends/remove/{userId}
GET    /_synapse/client/friends/categories
POST   /_synapse/client/friends/categories
DELETE /_synapse/client/friends/categories/{categoryId}
```

**使用示例**:
```typescript
import { getEnhancedMatrixClient } from '@/integrations/matrix/client'

const client = await getEnhancedMatrixClient()

// 获取好友列表
const { friends } = await client.friends.list()

// 发送好友请求
const { request_id } = await client.friends.sendRequest('@user:server', {
  message: '请加我好友'
})

// 接受好友请求
await client.friends.acceptRequest(request_id, { category_id: '1' })
```

### PrivateChat SDK v3.0.0 ✅

**位置**: `src/sdk/matrix-private-chat/`

**功能特性**:
- ✅ PrivateChat API 完整实现
- ✅ E2EE 加密 (AES-GCM-256)
- ✅ IndexedDB 存储优化
- ✅ 消息轮询和缓存
- ✅ 自毁时间支持
- ✅ 完整测试覆盖

**API 端点**:
```http
GET    /_synapse/client/private_chat/sessions
POST   /_synapse/client/private_chat/sessions
DELETE /_synapse/client/private_chat/sessions/{sessionId}
GET    /_synapse/client/private_chat/sessions/{sessionId}/messages
POST   /_synapse/client/private_chat/sessions/{sessionId}/messages
```

**使用示例**:
```typescript
import { getEnhancedMatrixClient } from '@/integrations/matrix/client'

const client = await getEnhancedMatrixClient()

// 创建私密聊天会话
const { session_id } = await client.privateChat.createSession({
  participants: ['@alice:server'],
  session_name: '私聊',
  ttl_seconds: 3600
})

// 发送消息
await client.privateChat.sendMessage(session_id, {
  content: '你好！',
  ttl_seconds: 300
})

// 获取消息历史
const { messages } = await client.privateChat.getMessages(session_id, {
  limit: 50
})
```

---

## 前端集成状态

### 环境配置 ✅

**`.env`**:
```bash
VITE_MATRIX_BASE_URL=https://matrix.cjystx.top:443
VITE_SYNAPSE_FRIENDS_ENABLED=on
```

**`vite.config.ts`**:
```typescript
proxy: {
  '/_synapse': { target: matrixTarget, changeOrigin: true, secure: true },
  '/_matrix': { target: matrixTarget, changeOrigin: true, secure: true }
}
```

### Matrix 客户端集成 ✅

**位置**: `src/integrations/matrix/client.ts`

```typescript
export async function getEnhancedMatrixClient(): Promise<EnhancedMatrixClient> {
  const client = matrixClientService.getClient()

  // 自动扩展 Friends API
  const { extendMatrixClient } = await import('@/sdk/matrix-friends')
  extendMatrixClient(client, baseUrl)

  // 自动扩展 PrivateChat API
  const { extendMatrixClient: extendPrivateChat } = await import('@/sdk/matrix-private-chat')
  extendPrivateChatClient(client, baseUrl)

  return client as EnhancedMatrixClient
}
```

### Stores 实现 ✅

**Friends Store**: `src/stores/friendsSDK.ts`
- ✅ `useFriendsSDKStore` - Friends API 状态管理
- ✅ 完整的 actions (fetchFriends, sendRequest, acceptRequest, etc.)
- ✅ 计算属性 (friendsByCategory, stats, etc.)
- ✅ 用户资料扩展 (display_name, avatar_url)

**PrivateChat Store**: `src/stores/privateChatSDK.ts`
- ✅ `usePrivateChatSDKStore` - PrivateChat API 状态管理
- ✅ 会话管理 (sessions, messages)
- ✅ E2EE 初始化
- ✅ 存储管理 (IndexedDB)

### 组件实现 ✅

#### Friends 组件 (100%)
- ✅ `FriendsList.vue` - 好友列表
- ✅ `AddFriendModal.vue` - 添加好友弹窗
- ✅ `FriendRequestsPanel.vue` - 好友请求面板
- ✅ `FriendCategories.vue` - 好友分组
- ✅ `FriendStats.vue` - 好友统计

#### PrivateChat 组件 (100%)
- ✅ `PrivateChatMain.vue` - 聊天消息显示
- ✅ `PrivateChatFooter.vue` - 聊天输入区域
- ✅ `PrivateChatSettings.vue` - 设置面板
- ✅ `PrivateChatDialog.vue` - 创建会话弹窗
- ✅ `PrivateChatButton.vue` - 聊天按钮

#### PC端集成 (100%)
- ✅ 三栏布局集成 (SpaceTree - ChatList - ChatBox)
- ✅ PrivateChat 会话合并到主会话列表
- ✅ 条件渲染 PrivateChat 组件

#### 移动端集成 (100%)
- ✅ `MobilePrivateChatView.vue` - 使用新 SDK
- ✅ `MobileFriendCategories.vue` - 使用新 SDK
- ✅ `ChatSetting.vue` - 使用新 SDK
- ✅ `PersonalInfo.vue` - 使用新 SDK
- ✅ **保持原有界面设计** (不使用三栏布局)

---

## 快速开始

### 基础使用

```typescript
import * as sdk from "matrix-js-sdk";

// 创建客户端
const client = sdk.createClient({
  baseUrl: "https://matrix.cjystx.top:443",
  accessToken: "your_access_token",
  userId: "@user:cjystx.top"
});

// 启动客户端
await client.startClient();

// 发送消息
await client.sendMessage("!roomId:server", {
  msgtype: "m.text",
  body: "Hello, World!"
});
```

### 使用 Friends SDK

```typescript
import { getEnhancedMatrixClient } from '@/integrations/matrix/client'
import { useFriendsSDKStore } from '@/stores/friendsSDK'

const friendsStore = useFriendsSDKStore()

// 获取好友列表
await friendsStore.fetchFriends()

// 发送好友请求
await friendsStore.sendFriendRequest('@alice:server', '请加我好友')

// 接受好友请求
await friendsStore.acceptFriendRequest(request_id)
```

### 使用 PrivateChat SDK

```typescript
import { getEnhancedMatrixClient } from '@/integrations/matrix/client'
import { usePrivateChatSDKStore } from '@/stores/privateChatSDK'

const privateChatStore = usePrivateChatSDKStore()

// 创建私密聊天会话
const sessionId = await privateChatStore.createSession({
  participants: ['@alice:server'],
  session_name: '私聊',
  ttl_seconds: 3600
})

// 发送消息
await privateChatStore.sendMessage(session_id, '你好！')

// 获取消息历史
const messages = await privateChatStore.fetchMessages(session_id)
```

### 启用 E2EE 加密

```typescript
// 初始化加密
await client.initRustCrypto();

// 启动客户端
await client.startClient();

// PrivateChat SDK 使用 AES-GCM-256 加密
await privateChatStore.initializeE2EE()
```

---

## 后端要求

### Synapse 配置

```yaml
# synapse.config.yaml
server_name: "matrix.cjystx.top"
public_baseurl: "https://matrix.cjystx.top:443/"

# 媒体仓库
media_store_path: /var/lib/matrixsynapse/media

# 启用注册
enable_registration: true
```

### Friends API 端点

```http
GET    /_synapse/client/friends/list
POST   /_synapse/client/friends/request
POST   /_synapse/client/friends/accept/{userId}
DELETE /_synapse/client/friends/remove/{userId}
GET    /_synapse/client/friends/categories
POST   /_synapse/client/friends/categories
```

### PrivateChat API 端点

```http
GET    /_synapse/client/private_chat/sessions
POST   /_synapse/client/private_chat/sessions
DELETE /_synapse/client/private_chat/sessions/{sessionId}
GET    /_synapse/client/private_chat/sessions/{sessionId}/messages
POST   /_synapse/client/private_chat/sessions/{sessionId}/messages
```

> 详细后端需求请参考 [BACKEND_REQUIREMENTS_OPTIMIZED.md](./BACKEND_REQUIREMENTS_OPTIMIZED.md)

---

## 测试验证

### 单元测试

```bash
# Friends SDK 测试
pnpm test src/sdk/matrix-friends/__tests__/
# 结果: 33/33 通过 ✅

# PrivateChat SDK 测试
pnpm test src/sdk/matrix-private-chat/__tests__/
# 结果: 全部通过 ✅
```

### 代码质量检查

```bash
✅ pnpm typecheck    # 0 TypeScript 错误
✅ pnpm check:write  # 0 Biome 警告
```

---

## 架构设计

### SDK 目录结构

```
src/sdk/
├── matrix-friends/          # Friends SDK v3.0.0 ✅
│   ├── types.ts
│   ├── utils.ts
│   ├── FriendsApiExtension.ts
│   ├── factory.ts
│   └── index.ts
└── matrix-private-chat/     # PrivateChat SDK v3.0.0 ✅
    ├── types.ts
    ├── utils.ts
    ├── PrivateChatExtension.ts
    ├── E2EEExtension.ts
    ├── StorageService.ts
    ├── factory.ts
    └── index.ts
```

### Stores 目录结构

```
src/stores/
├── friendsSDK.ts           # Friends Store (新) ✅
├── privateChatSDK.ts       # PrivateChat Store (新) ✅
├── friends.ts              # 旧 Friends Store (@deprecated)
├── friendsV2.ts            # v2 Friends Store (@deprecated)
└── privateChat.ts          # 旧 PrivateChat Store (@deprecated)
```

### 组件目录结构

```
src/components/
├── friends/                # Friends 组件 (PC + Mobile) ✅
│   ├── FriendsList.vue
│   ├── AddFriendModal.vue
│   ├── FriendRequestsPanel.vue
│   ├── FriendCategories.vue
│   └── FriendStats.vue
└── privateChat/            # PrivateChat 组件 ✅
    ├── PrivateChatMain.vue
    ├── PrivateChatFooter.vue
    ├── PrivateChatSettings.vue
    └── CreateSessionModal.vue
```

---

## 最佳实践

### 1. 使用增强客户端

```typescript
// ✅ 推荐
import { getEnhancedMatrixClient } from '@/integrations/matrix/client'
const client = await getEnhancedMatrixClient()

// ❌ 不推荐
import { matrixClientService } from '@/integrations/matrix/client'
const client = matrixClientService.getClient()
```

### 2. 使用 SDK Stores

```typescript
// ✅ 推荐
import { useFriendsSDKStore } from '@/stores/friendsSDK'
const friendsStore = useFriendsSDKStore()

// ❌ 不推荐
import { useFriendsStoreV2 } from '@/stores/friendsV2'
```

### 3. 错误处理

```typescript
try {
  await friendsStore.sendFriendRequest(userId, message)
} catch (error) {
  if (error instanceof FriendsAPIError) {
    // 处理 Friends API 错误
    console.error(error.message, error.code)
  }
}
```

### 4. 事件监听

```typescript
// Friends SDK 事件
client.friends.on('request.received', (request) => {
  console.log('收到好友请求:', request)
})

// PrivateChat SDK 事件
client.privateChat.on('message.received', (message) => {
  console.log('收到新消息:', message)
})
```

---

## 故障排查

### 常见问题

#### 1. Friends API 不可用

**检查**:
```bash
# 检查后端端点
curl -H "Authorization: Bearer $TOKEN" \
  https://matrix.cjystx.top/_synapse/client/friends/list
```

#### 2. 类型错误

**解决方案**:
```typescript
// 使用 getEnhancedMatrixClient
const client = await getEnhancedMatrixClient() as EnhancedMatrixClient
```

#### 3. 存储初始化失败

**检查**:
```typescript
// 清除 IndexedDB
await indexedDB.deleteDatabase('hula-matrix-sdk')
```

---

## 相关资源

### 官方文档
- [Matrix 官网](https://matrix.org)
- [Matrix JS SDK](https://github.com/matrix-org/matrix-js-sdk)
- [Matrix 规范](https://spec.matrix.org/)

### 项目文档
- [后端需求](./BACKEND_REQUIREMENTS_OPTIMIZED.md)
- [前端集成指南](./FRONTEND_INTEGRATION_GUIDE.md)
- [前端集成状态](./FRONTEND_INTEGRATION_STATUS.md)
- [UI 技术审计报告](../UI_TECHNICAL_AUDIT_REPORT.md)

---

**文档版本**: 3.1.0
**SDK 版本**: 39.1.3
**最后更新**: 2026-01-06
**HuLaMatrix 版本**: 3.0.5

**更新内容 (v3.1.0)**:
- ✅ 更新 Friends SDK v3.0.0 实现状态
- ✅ 更新 PrivateChat SDK v3.0.0 实现状态
- ✅ 更新前端集成状态 (100% 完成)
- ✅ 更新组件实现状态 (PC + Mobile)
- ✅ 更新管理员 API 核心功能完成状态
- ✅ UI 技术审计 Phase 1-3 全部完成
- ✅ 项目类型安全: 0 错误
- ✅ 项目代码质量: 0 警告 (1028 个文件)
- ✅ 核心组件可访问性全面优化完成
