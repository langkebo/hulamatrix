# Matrix JS SDK 39.1.3 完整功能参考

> 为 HuLamatrix 项目开发优化使用
> **最后更新**: 2026-01-06 | **文档版本**: 2.1.0

## 概述

本文档详细介绍了 `matrix-js-sdk-39.1.3` 的所有功能，包括完整的 API 参考和实用示例代码。Matrix JS SDK 是 Matrix 协议的官方 JavaScript/TypeScript 客户端 SDK，支持浏览器和 Node.js 环境。

### 实现状态概览

| 模块 | 前端实现 | 后端支持 | 整体状态 |
|------|---------|---------|---------|
| 客户端基础 | 100% ✅ | 100% ✅ | ✅ 完成 |
| 身份验证 | 95% ⚠️ | 90% ⚠️ | ⚠️ 部分完成 |
| 房间管理 | 100% ✅ | 100% ✅ | ✅ 完成 |
| 消息传递 | 94% ✅ | 100% ✅ | ✅ 完成 |
| 事件处理 | 96% ✅ | 100% ✅ | ✅ 完成 |
| 端到端加密 | 100% ✅ | 100% ✅ | ✅ 完成 |
| WebRTC 通话 | 100% ✅ | 100% ✅ | ✅ 完成 |
| 在线状态/输入提示 | 100% ✅ | 100% ✅ | ✅ 完成 |
| 媒体文件 | 93% ✅ | 100% ✅ | ✅ 完成 |
| 搜索功能 | 100% ✅ | 100% ✅ | ✅ 完成 |
| 好友系统 | 100% ✅ | 80% ⚠️ | ⚠️ 需要自定义 API |
| 私聊功能 | 95% ✅ | 100% ✅ | ✅ 完成 |
| 管理员 API | 68% ⚠️ | 60% ⚠️ | ⚠️ 部分实现 |
| 企业功能 | 100% ✅ | 80% ⚠️ | ⚠️ 需要扩展 |

> 详细状态报告和后端需求请查看 [BACKEND_REQUIREMENTS.md](./BACKEND_REQUIREMENTS.md)

## 官方资源

- **Matrix 官网**: https://matrix.org
- **SDK 仓库**: https://github.com/matrix-org/matrix-js-sdk
- **API 文档**: https://matrix-org.github.io/matrix-js-sdk/
- **Matrix 规范**: https://spec.matrix.org/

## SDK 特性

### 核心功能
- ✅ 完整的 Matrix Client-Server API 实现
- ✅ 端到端加密 (E2EE) 支持
- ✅ WebRTC 音视频通话
- ✅ 实时同步 (Sliding Sync)
- ✅ 推送通知支持
- ✅ 设备管理
- ✅ 房间和消息管理
- ✅ 用户和成员管理
- ✅ 搜索功能
- ✅ 在线状态和输入提示
- ✅ 文件和媒体处理
- ✅ 群组和空间支持

### 企业功能
- ✅ 朋友管理系统
- ✅ 私密聊天
- ✅ 语音消息
- ✅ 安全控制
- ✅ 隐私管理
- ✅ 反馈系统
- ✅ 管理员功能

## 文档结构

### 基础功能
- [01. 客户端基础](./01-client-basics.md) ✅ - 初始化、配置、启动客户端
- [02. 用户认证](./02-authentication.md) ✅ - 登录、注册、登出
- [03. 房间管理](./03-room-management.md) ✅ - 创建、加入、管理房间
- [04. 消息功能](./04-messaging.md) ✅ - 发送、接收、处理消息
- [05. 事件处理](./05-events-handling.md) ✅ - 监听和处理事件

### 高级功能
- [06. 加密功能](./06-encryption.md) ✅ - E2EE 加密、密钥管理、设备验证
- [07. WebRTC 通话](./07-webrtc-calling.md) ✅ - 音视频通话、群组通话、屏幕共享
- [08. 在线状态](./08-presence-typing.md) ✅ - 在线状态、输入提示、已读回执
- [09. 媒体文件](./09-media-files.md) ✅ - 上传、下载、处理媒体文件 (含 IndexedDB 缓存)
- [10. 搜索功能](./10-search.md) ✅ - 搜索消息、用户、房间

### 企业功能
- [11. 好友系统](./11-friends-system.md) ✅ v2.0.0 - 好友管理、好友请求、好友分类 (使用 `client.friendsV2`)
- [12. 私密聊天](./12-private-chat.md) ✅ v2.0.0 - 阅后即焚、临时会话、私密消息 (使用 `client.privateChatV2`)
- [13. 管理功能](./13-admin-api.md) ✅ - Synapse Admin API、用户管理、房间管理、媒体管理
- [15. 企业功能](./15-enterprise-features.md) ✅ - 企业功能完整参考

> **重要更新 (v2.0.0)**: 好友系统和私聊系统已升级为 v2.0.0 API，提供更完善的类型定义、缓存机制、事件系统和错误处理。使用 `client.friendsV2` 和 `client.privateChatV2` 访问新 API。

### 高级功能 (NEW!)
- [16. 服务发现](./16-server-discovery.md) ✅ - Well-Known URI、自动发现、客户端配置
- [17. 推送通知](./17-push-notifications.md) ✅ - 推送规则、推送处理器、通知动作
- [18. 帐号数据](./18-account-data.md) ✅ - 全局帐号数据、设置同步、数据存储
- [19. 空间和群组](./19-spaces-groups.md) ✅ - Spaces（空间）、层级结构、嵌套空间
- [20. 位置共享](./20-location-sharing.md) ✅ - 静态位置、实时信标（Beacon）、位置追踪
- [21. 投票功能](./21-polls.md) ✅ - 创建投票、响应投票、投票结果
- [22. Sliding Sync](./22-sliding-sync.md) ✅ - MSC3575、高效同步、滑动窗口
- [23. OIDC 认证](./23-oidc-authentication.md) ✅ - OpenID Connect、第三方登录、SSO

### 验证报告
- [01. 客户端基础验证](./01-client-basics-VERIFICATION.md) ✅ - 100% 完成
- [02. 用户认证验证](./02-authentication-VERIFICATION.md) ✅ - 95% 完成
- [03. 房间管理验证](./03-room-management-VERIFICATION.md) ✅ - 95% 完成
- [04. 消息功能验证](./04-messaging-VERIFICATION.md) ✅ - 98% 完成
- [05. 事件处理验证](./05-events-handling-VERIFICATION.md) ✅ - 95% 完成
- [06. 加密功能验证](./06-encryption-VERIFICATION.md) ✅ - 95% 完成
- [07. WebRTC 通话验证](./07-webrtc-calling-VERIFICATION.md) ✅ - 100% 完成
- [08. 在线状态验证](./08-presence-typing-VERIFICATION.md) ✅ - 100% 完成
- [09. 媒体文件验证](./09-media-files-VERIFICATION.md) ✅ - 100% 完成
- [10. 搜索功能验证](./10-search-VERIFICATION.md) ✅ - 100% 完成
- [11. 好友系统验证](./11-friends-system-VERIFICATION.md) ✅ - 100% 完成
- [12. 私密聊天验证](./12-private-chat-VERIFICATION.md) ✅ - 95% 完成
- [15. 企业功能验证](./15-enterprise-features-VERIFICATION.md) ✅ - 100% 完成

### 项目状态
- [项目状态与任务清单](./PROJECT_STATUS_AND_TASKS.md) 📋 - 未解决问题和任务清单

> **注意**: 验证报告显示了各模块在 HuLaMatrix 项目中的实际实现状态。

## 快速开始

### 安装

```bash
# 使用 npm
npm install matrix-js-sdk

# 使用 yarn
yarn add matrix-js-sdk

# 使用 pnpm
pnpm add matrix-js-sdk
```

### 基本使用

```typescript
import * as sdk from "matrix-js-sdk";

// 创建客户端
const client = sdk.createClient({
  baseUrl: "https://cjystx.top",
  accessToken: "your_access_token",
  userId: "@user:cjystx.top"
});

// 启动客户端
await client.startClient();

// 监听消息事件
client.on(sdk.RoomEvent.Timeline, (event, room) => {
  if (event.getType() === "m.room.message") {
    console.log(`(${room.name}) ${event.getSender()}: ${event.getContent().body}`);
  }
});

// 发送消息
await client.sendMessage("!roomId:server", {
  msgtype: "m.text",
  body: "Hello, World!"
});
```

### 使用好友系统 (v2.0.0)

```typescript
import { MatrixClient } from "matrix-js-sdk";

const client = new MatrixClient("https://matrix.cjystx.top");
await client.login("m.login.password", {
  user: "username",
  password: "password"
});

// 获取好友客户端 v2.0.0
const friends = client.friendsV2;

// 获取好友列表
const friendList = await friends.listFriends();
console.log("好友列表:", friendList);

// 搜索用户
const results = await friends.searchUsers("alice");
console.log("搜索结果:", results);

// 发送好友请求
const requestId = await friends.sendFriendRequest({
  target_id: "@alice:matrix.org",
  message: "请加我好友",
  category_id: 1
});

// 监听好友请求
friends.on("request.received", (request) => {
  console.log("收到好友请求:", request);
});

// 接受好友请求
await friends.acceptFriendRequest(requestId, 1);
```

### 使用私聊增强 (v2.0.0)

```typescript
// 获取私聊客户端 v2.0.0
const privateChat = client.privateChatV2;

// 获取会话列表
const sessions = await privateChat.listSessions();

// 创建新会话
const session = await privateChat.createSession({
  participants: ["@alice:matrix.org"],
  session_name: "私聊",
  ttl_seconds: 3600  // 1小时后过期
});

// 发送消息
await privateChat.sendText(session.session_id, "你好！");

// 订阅新消息
const unsubscribe = privateChat.subscribeToMessages(
  session.session_id,
  (message) => {
    console.log("收到新消息:", message.content);
  }
);

// 获取消息历史
const messages = await privateChat.getMessages({
  session_id: session.session_id,
  limit: 50
});

// 取消订阅
unsubscribe();

// 删除会话
await privateChat.deleteSession(session.session_id);
```

### 启用加密

```typescript
const client = sdk.createClient({
  baseUrl: "https://matrix.org",
  accessToken: "your_access_token",
  userId: "@user:matrix.org"
});

// 初始化加密
await client.initRustCrypto();

// 启动客户端
await client.startClient();
```

## 后端要求和部署

### Synapse 服务器要求

HuLaMatrix 项目使用 Matrix Synapse 服务器作为后端，需要以下配置：

#### 核心要求

```yaml
# synapse.config.yaml - 最小配置
server_name: "matrix.cjystx.top"
public_baseurl: "https://matrix.cjystx.top/"

# 启用媒体仓库
media_store_path: /var/lib/matrixsynapse/media
url_preview_enabled: true

# 启用注册
enable_registration: true
registrations_requires_3pid: false

# 房间目录配置
room_list_publication_rules:
  - action: allow
    room_id: "*"
```

#### Synapse Enhanced Module

项目依赖自定义的 Synapse Enhanced Module v1.0.2+：

**需要实现的 API 端点**:
```http
# 好友系统 (v2.0.0)
GET    /_synapse/client/enhanced/friends/list
POST   /_synapse/client/enhanced/friends/request
POST   /_synapse/client/enhanced/friends/accept/{userId}
DELETE /_synapse/client/enhanced/friends/remove/{userId}

# 私聊系统 (v2.0.0)
GET    /_synapse/client/enhanced/private/sessions
POST   /_synapse/client/enhanced/private/sessions
DELETE /_synapse/client/enhanced/private/sessions/{sessionId}
```

> 完整的后端开发清单请参考 [BACKEND_REQUIREMENTS.md](./BACKEND_REQUIREMENTS.md)

### 环境变量配置

在项目根目录创建 `.env` 文件：

```bash
# Matrix 基础配置
VITE_MATRIX_ENABLED=on
VITE_MATRIX_BASE_URL=https://matrix.cjystx.top

# 功能模块开关
VITE_MATRIX_ROOMS_ENABLED=on
VITE_MATRIX_MEDIA_ENABLED=on
VITE_MATRIX_E2EE_ENABLED=on
VITE_MATRIX_RTC_ENABLED=on
VITE_MATRIX_ADMIN_ENABLED=off

# 开发选项
VITE_MATRIX_DEV_SYNC=false
```

### 前端 PC/移动端要求

详细的前端待实现功能清单请参考 [PC_MOBILE_REQUIREMENTS.md](./PC_MOBILE_REQUIREMENTS.md)

**高优先级待实现功能**:
- E2EE 加密设置界面
- UIA (User-Interactive Authentication) 界面
- 在线状态和输入提示 UI 组件

### 部署检查清单

#### 服务器端

- [ ] Synapse 1.140.0+ 已安装
- [ ] Enhanced Module v1.0.2+ 已启用
- [ ] 媒体仓库已配置
- [ ] 反向代理 (Nginx) 已配置
- [ ] HTTPS 证书已配置
- [ ] 邮件服务 (SMTP) 已配置 (可选，用于 UIA)

#### 客户端端

- [ ] Node.js 20.19.0+ 或 22.12.0+
- [ ] pnpm 10.x+
- [ ] 环境变量已配置
- [ ] TypeScript 配置正确
- [ ] 本地 SDK 链接正确

## SDK 架构

```
matrix-js-sdk-39.1.3/
├── src/
│   ├── client.ts              # 核心客户端
│   ├── matrix.ts              # 主要入口点
│   ├── @types/                # TypeScript 类型定义
│   │   ├── friends.ts         # 好友系统类型
│   │   └── private-chat.ts    # 私聊系统类型
│   ├── http-api/              # HTTP API 封装
│   │   ├── friends.ts         # 好友系统 HTTP API
│   │   └── private-chat.ts    # 私聊系统 HTTP API
│   ├── friends/               # 好友系统模块 (v2.0.0)
│   │   ├── FriendsClient.ts   # 好友系统客户端
│   │   ├── errors.ts          # 错误类
│   │   └── index.ts           # 导出
│   ├── private-chat/          # 私聊增强模块 (v2.0.0)
│   │   ├── PrivateChatClient.ts # 私聊系统客户端
│   │   ├── errors.ts          # 错误类
│   │   └── index.ts           # 导出
│   ├── crypto-api/            # 加密 API
│   ├── models/                # 数据模型
│   ├── webrtc/                # WebRTC 通话
│   ├── matrixrtc/             # MatrixRTC
│   ├── store/                 # 存储后端
│   ├── sync.ts                # 同步处理
│   ├── sliding-sync.ts        # Sliding Sync
│   ├── enterprise/            # 企业功能
│   └── utils/                 # 工具函数
```

## 主要类和接口

| 类/接口 | 描述 |
|--------|------|
| `MatrixClient` | 主客户端类，所有功能的核心入口 |
| `FriendsClient` | 好友系统客户端 (通过 `client.friendsV2` 访问) |
| `PrivateChatClient` | 私聊增强客户端 (通过 `client.privateChatV2` 访问) |
| `Room` | 房间模型，包含房间状态和时间线 |
| `RoomMember` | 房间成员模型 |
| `RoomState` | 房间状态管理 |
| `MatrixEvent` | Matrix 事件模型 |
| `User` | 用户模型 |
| `CryptoApi` | 加密功能接口 |
| `Call` | WebRTC 通话 |
| `GroupCall` | 群组通话 |

## 事件类型

SDK 使用 EventEmitter 模式，支持以下主要事件：

### MatrixClient 核心事件

| 事件 | 触发时机 |
|------|----------|
| `ClientEvent.Sync` | 同步状态变化 |
| `RoomEvent.Timeline` | 房间时间线新事件 |
| `RoomEvent.MyMembership` | 当前用户成员状态变化 |
| `RoomEvent.Name` | 房间名称变化 |
| `RoomMemberEvent.Name` | 成员名称变化 |
| `RoomMemberEvent.Typing` | 成员输入状态变化 |
| `CryptoEvent.KeyVerification` | 密钥验证事件 |
| `CallEvent.Invite` | 收到通话邀请 |
| `CallEvent.Hangup` | 通话挂断 |

### FriendsClient 事件 (v2.0.0)

| 事件 | 触发时机 |
|------|----------|
| `friend.add` | 添加好友后触发 |
| `friend.remove` | 删除好友后触发 |
| `request.received` | 收到好友请求时触发 |
| `request.accepted` | 接受好友请求后触发 |

### PrivateChatClient 事件 (v2.0.0)

| 事件 | 触发时机 |
|------|----------|
| `session.created` | 创建会话后触发 |
| `session.deleted` | 删除会话后触发 |
| `message.received` | 收到新消息时触发 |
| `message.sent` | 发送消息后触发 |

## 最佳实践

### 1. 错误处理

始终处理可能的错误：

```typescript
try {
  await client.joinRoom("!roomId:server");
} catch (error) {
  if (error.errcode === "M_UNKNOWN_TOKEN") {
    // 处理无效令牌
  } else if (error.errcode === "M_FORBIDDEN") {
    // 处理权限不足
  }
}
```

### 2. 事件监听

正确使用事件监听器：

```typescript
// 添加监听器
const onEvent = (event) => console.log(event);
client.on(sdk.RoomEvent.Timeline, onEvent);

// 移除监听器
client.off(sdk.RoomEvent.Timeline, onEvent);
```

### 3. 资源清理

停止客户端时清理资源：

```typescript
// 停止同步
client.stopClient();

// 清理存储
await client.store.deleteAll();

// 清理加密
await client.getCrypto()?.stop();
```

### 4. 加密最佳实践

```typescript
// 检查房间是否加密
if (client.isRoomEncrypted(roomId)) {
  const crypto = client.getCrypto();
  if (crypto) {
    // 处理加密消息
  }
}

// 验证设备
const crypto = client.getCrypto();
const deviceTrust = await crypto.isDeviceVerified(userId, deviceId);
```

## 浏览器兼容性

| 浏览器 | 版本要求 |
|--------|----------|
| Chrome | 90+ |
| Firefox | 88+ |
| Safari | 14+ |
| Edge | 90+ |

## Node.js 支持

支持 Node.js 16+ LTS 版本。

## 类型定义

SDK 提供完整的 TypeScript 类型定义：

```typescript
import * as sdk from "matrix-js-sdk";

const client: sdk.MatrixClient = sdk.createClient({...});
const room: sdk.Room = client.getRoom("!roomId:server");
const event: sdk.MatrixEvent = room.timeline[0];
```

## 故障排查

### 常见问题

#### 1. Friends v2 API 不可用

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

**相关文档**: [SDK_INTEGRATION_GUIDE.md](./SDK_INTEGRATION_GUIDE.md)

#### 2. API 端点返回 404

**可能原因**:
- 后端未升级到 Enhanced Module v1.0.2+
- RESTful 端点未注册
- Nginx 配置问题

**验证步骤**:
```bash
# 检查后端是否支持新端点
curl -H "Authorization: Bearer $TOKEN" \
  https://your-server.com/_synapse/client/enhanced/friends/stats

# 预期响应:
# {"status": "ok", "stats": {...}}
```

#### 3. 用户搜索返回 404

**错误**:
```
GET http://localhost:6130/_matrix/client/r0/user_directory/search
404 Not Found
```

**原因**: Matrix 服务器 `matrix.cjystx.top` 未启用用户目录模块

**解决方案**:
1. 联系服务器管理员启用 `user_directory` 模块
2. 或使用好友系统的 `searchUsers` API 替代

#### 4. 类型错误

**错误**: `Property 'friendsV2' does not exist on type 'MatrixClient'`

**解决方案**:
```typescript
// 使用类型断言
const client = matrixClientService.getClient() as any
const friendsV2 = client.friendsV2
```

#### 5. CORS 错误

**错误**: 浏览器控制台显示 CORS 请求被阻止

**解决方案**:
- 开发环境使用 Vite 代理: `/_matrix` → `https://matrix.cjystx.top/_matrix`
- 生产环境配置 Nginx 反向代理
- 配置正确的 `Access-Control-Allow-Origin` 头

#### 6. 客户端未初始化

**错误**: `[searchUsers] Matrix client not available`

**原因**: 组件在登录完成前调用 API

**解决方案**:
```typescript
// 检查客户端状态
const client = matrixClientService.getClient()
if (!client) {
  console.warn('Matrix client not initialized')
  return
}

// 或使用应用状态检查
import { useAppStateStore } from '@/stores/appState'
const appStateStore = useAppStateStore()
if (!appStateStore.isReady) {
  console.warn('Application not ready')
  return
}
```

### 调试技巧

#### 启用详细日志

```typescript
// vite.config.ts
export default defineConfig({
  define: {
    __DEBUG__: JSON.stringify(true)
  }
})

// 在代码中
if (__DEBUG__) {
  console.log('[Matrix] Debug info:', data)
}
```

#### 检查同步状态

```typescript
const client = matrixClientService.getClient()

// 检查同步状态
console.log('Sync state:', client.getSyncState())

// 监听同步事件
client.on(ClientEvent.Sync, (state, prevState, data) => {
  console.log('Sync state changed:', state, 'from:', prevState)
})
```

#### 验证加密状态

```typescript
const crypto = client.getCrypto()
if (crypto) {
  // 检查是否已备份密钥
  const backupInfo = await crypto.getKeyBackupInfo()
  console.log('Key backup:', backupInfo)

  // 检查设备信任状态
  const trust = await crypto.isDeviceVerified(userId, deviceId)
  console.log('Device trusted:', trust)
}
```

### 获取帮助

1. 查看详细文档: [docs/matrix-sdk/](./)
2. 检查后端需求: [BACKEND_REQUIREMENTS.md](./BACKEND_REQUIREMENTS.md)
3. 查看集成指南: [SDK_INTEGRATION_GUIDE.md](./SDK_INTEGRATION_GUIDE.md)
4. 查看前端要求: [PC_MOBILE_REQUIREMENTS.md](./PC_MOBILE_REQUIREMENTS.md)
5. 查看 Matrix 官方文档: https://spec.matrix.org/

## 相关资源

### Matrix 官方文档

- [Matrix 客户端服务器 API](https://spec.matrix.org/v1.12/client-server-api/)
- [Matrix 端到端加密](https://spec.matrix.org/v1.12/client-server-api/#end-to-end-encryption)
- [WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [Matrix JS SDK 官方文档](https://matrix-org.github.io/matrix-js-sdk/)

### 项目文档

- [后端需求详情](./BACKEND_REQUIREMENTS.md) - Synapse Enhanced Module 开发清单
- [前端 PC/移动端要求](./PC_MOBILE_REQUIREMENTS.md) - 前端待实现功能清单
- [SDK 集成指南](./SDK_INTEGRATION_GUIDE.md) - 本地 SDK 集成文档
- [认证分析和优化](../../AUTHENTICATION_ANALYSIS_AND_OPTIMIZATION.md) - 项目认证流程分析

## 贡献

如需向 HuLamatrix 项目贡献代码或报告问题，请参考项目 CONTRIBUTING.md。

## 许可证

Matrix JS SDK 使用 Apache 2.0 许可证。

---

**文档版本**: 2.1.0
**SDK 版本**: 39.1.3
**最后更新**: 2026-01-06
**HuLaMatrix 版本**: 3.0.5

**更新内容 (v2.1.0)**:
- ✅ 新增实现状态概览表
- ✅ 新增后端要求和部署章节
- ✅ 新增故障排查章节
- ✅ 改进文档交叉引用
- ✅ 更新相关资源链接

**历史更新**:
- ✅ 好友系统 API 升级到 v2.0.0 (`client.friendsV2`)
- ✅ 私聊增强 API 升级到 v2.0.0 (`client.privateChatV2`)
- ✅ 完整的 TypeScript 类型定义
- ✅ 缓存机制和事件系统
- ✅ 自定义错误类和错误处理
- ✅ **RESTful API 端点** - 使用 `/_synapse/client/enhanced/` 路径

**后端要求**:
- Synapse 1.140.0 Enhanced Module v1.0.2+
- 支持 v1 RESTful API 路径 (`/_synapse/client/enhanced/friends/*`, `/_synapse/client/enhanced/private/*`)

**注意**: Nginx 简短路径（如 `/friends/list`）因端口 80 冲突暂未启用，但所有功能通过完整路径（如 `/_synapse/client/enhanced/friends/list`）均可正常访问，完全满足业务需求。
