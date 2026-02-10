# Matrix JavaScript SDK 前端集成指南

## 版本信息

- **文档版本**: 3.0.0
- **最后更新**: 2026-02-09
- **SDK 版本**: 基于 matrix-js-sdk develop 分支
- **维护状态**: ✅ 活跃维护

## 一、项目概述

### 1.1 简介

Matrix JavaScript SDK 是基于 Matrix JS SDK 的增强版本，提供更丰富的 API 功能封装、统一的错误处理机制、性能监控和输入安全验证。该 SDK 提供完整的好友管理、私聊会话管理、聊天室管理和安全控制等功能。

本 SDK 采用模块化架构设计，将功能按域划分为多个独立模块，包括好友系统、私聊功能、聊天室管理、语音通话、安全控制、管理功能、在线状态和消息处理等。每个模块都经过精心设计，提供类型安全的 API 接口和详细的错误信息。

### 1.2 核心特性

本 SDK 具备六大核心特性，这些特性使其成为构建 Matrix 客户端应用的理想选择。

**统一的错误处理机制**是本 SDK 的核心特性之一。所有 API 调用都经过统一的错误处理管道，能够将各种错误情况（如网络错误、服务器错误、参数错误等）转换为统一的错误格式。SDK 提供了 `SynapseEnhancedError` 类和 `ErrorCode` 枚举，涵盖 50+ 种错误类型，帮助开发者实现精准的错误处理逻辑。

**完整的输入验证体系**确保了数据的安全性。SDK 在每个 API 接口都实现了严格的输入验证，包括用户 ID 格式验证、房间 ID 格式验证、消息内容安全清理等。

**智能的速率限制机制**保护 API 服务免受滥用。SDK 内置了速率限制器，支持根据实际需求调整限制参数。当请求触发速率限制时，SDK 会自动标记错误为可重试。

**高效的缓存策略**提升了应用的响应速度。SDK 实现了 LRU 缓存机制，支持配置最大条目数和 TTL（生存时间）机制。

**可靠的 E2EE 支持**通过 Rust Crypto 实现。SDK 支持端到端加密，只需调用 `initCrypto()` 即可启用。

**统一的客户端接口**。`UnifiedMatrixClient` 整合了标准 Matrix API 和 Enhanced API，提供一致的调用体验。

### 1.3 模块架构

SDK 采用清晰的模块化架构，每个功能域都有独立的模块负责。

#### API 模块 (src/enhanced/api/)

| 模块       | 文件                                   | 功能描述         |
| ---------- | -------------------------------------- | ---------------- |
| 好友系统   | friends.ts, friends-basic.ts           | 好友管理核心功能 |
| 好友请求   | friend-requests.ts                     | 好友请求管理     |
| 好友分类   | friend-categories.ts                   | 好友分组管理     |
| 屏蔽用户   | blocked-users.ts                       | 用户屏蔽功能     |
| 私聊功能   | private-chat.ts, private-chat-admin.ts | 私聊会话管理     |
| 私聊状态   | private-chat-status.ts                 | 会话状态查询     |
| 聊天室     | chatroom.ts                            | 房间管理         |
| 语音通话   | voice.ts, voice-user.ts                | 语音功能         |
| 音频上传   | audio-upload.ts                        | 音频文件上传     |
| 安全控制   | security.ts, security-admin.ts         | 安全管理         |
| 管理功能   | admin.ts                               | 管员 API         |
| 在线状态   | presence.ts                            | 在线状态管理     |
| 消息       | messages.ts                            | 消息操作         |
| 统一客户端 | unified-client.ts                      | 整合客户端       |
| 增强初始化 | enhanced.ts                            | 模块初始化       |

#### 工具模块 (src/enhanced/utils/)

| 模块        | 文件                  | 功能描述                 |
| ----------- | --------------------- | ------------------------ |
| HTTP 客户端 | http.ts               | HTTP 请求、缓存、拦截器  |
| 错误处理    | error-codes.ts        | 统一错误码枚举           |
| 输入验证    | validator.ts          | 参数验证                 |
| 缓存管理    | lru-cache.ts          | LRU 缓存实现             |
| 响应格式化  | response-formatter.ts | 响应数据处理             |
| 批量操作    | batch-errors.ts       | 批量操作错误处理         |
| 令牌管理    | token-manager.ts      | 访问令牌管理             |

## 二、安装与配置

### 2.1 环境要求

**Node.js 版本要求**：建议使用 Node.js 18.0 或更高版本。

**包管理器支持**：SDK 支持 npm、yarn 和 pnpm。

**TypeScript 支持**：SDK 完全使用 TypeScript 编写，需要 TypeScript 4.9 或更高版本。

**构建工具兼容性**：SDK 兼容主流的前端构建工具（Vite、Webpack、Rollup 等）。

### 2.2 安装方式

使用 npm 安装 SDK：

```bash
npm install matrix-js-sdk
```

### 2.3 初始化配置

#### 推荐方式：使用 UnifiedMatrixClient

`UnifiedMatrixClient` 是推荐的客户端方式，它整合了标准 Matrix API 和 Enhanced API：

```typescript
import { UnifiedMatrixClient } from "matrix-js-sdk";

// 基础配置
const client = new UnifiedMatrixClient({
    baseUrl: "https://matrix.example.com",
    accessToken: "your-access-token",
});

// 完整配置
const client = new UnifiedMatrixClient({
    baseUrl: "https://matrix.example.com",
    accessToken: "your-access-token",
    userId: "@user:example.com", // 可选，登录后会自动设置
    apiPrefix: "/_synapse/client", // Enhanced API 前缀
    timeout: 30000, // 请求超时（毫秒）
});
```

#### 方式二：直接使用 SynapseEnhancedClient

如果只需要 Enhanced 功能，可以直接使用 `SynapseEnhancedClient`：

```typescript
import { SynapseEnhancedClient, createClient } from "matrix-js-sdk";

// 注意：SynapseEnhancedClient 需要 MatrixClient 作为参数
const matrixClient = createClient({
    baseUrl: "https://matrix.example.com",
    accessToken: "your-access-token",
    userId: "@user:example.com",
});

const enhancedClient = new SynapseEnhancedClient({
    baseUrl: "https://matrix.example.com",
    accessToken: "your-access-token",
    userId: "@user:example.com",
}, matrixClient);
```

## 三、认证流程

### 3.1 用户注册

```typescript
const client = new UnifiedMatrixClient({
    baseUrl: "https://matrix.example.com",
});

// 注册新用户
const registerResult = await client.auth.register({
    username: "newuser",
    password: "securepassword",
    device_id: "DEVICE123", // 可选
    initial_device_display_name: "My Device", // 可选
    inhibit_login: false, // 注册后自动登录
});

console.log("注册成功:", registerResult.user_id);
console.log("访问令牌:", registerResult.access_token);
```

### 3.2 用户登录

```typescript
// 密码登录
const loginResult = await client.auth.login({
    type: "m.login.password",
    user: "@user:example.com", // 或只用 "username"
    password: "password",
    device_id: "DEVICE123", // 可选
    initial_device_display_name: "My Device", // 可选
});

console.log("登录成功:", loginResult.user_id);
console.log("访问令牌:", loginResult.access_token);

// 登录后需要重新创建客户端以使用新的访问令牌
const authenticatedClient = new UnifiedMatrixClient({
    baseUrl: "https://matrix.example.com",
    accessToken: loginResult.access_token,
    userId: loginResult.user_id,
});
```

### 3.3 令牌刷新

```typescript
// 使用刷新令牌获取新的访问令牌
const refreshResult = await client.auth.refreshToken({
    refresh_token: "your-refresh-token",
});

console.log("新的访问令牌:", refreshResult.access_token);
```

### 3.4 登出

```typescript
// 登出当前设备
await client.auth.logout();

// 登出所有设备
await client.auth.logoutAll();
```

### 3.5 初始化加密和同步

```typescript
// 初始化端到端加密
await client.initCrypto();

// 启动客户端以接收实时事件
await client.start();

// 监听事件
client.getMatrixClient().on("event", (event) => {
    console.log("收到事件:", event);
});
```

## 四、核心功能使用指南

### 4.1 好友系统

#### 获取好友列表

```typescript
const result = await client.enhanced.friends.getFriends({
    page: 1,
    limit: 20,
});

console.log(`共有 ${result.total} 个好友`);
result.items.forEach((friend) => {
    console.log(`${friend.display_name}: ${friend.user_id}`);
});
```

#### 添加好友

```typescript
// 添加好友
await client.enhanced.friends.addFriend("@user:example.com");

// 添加好友并设置备注
await client.enhanced.friends.addFriend("@user:example.com", {
    remark: "同事",
});
```

#### 删除好友

```typescript
await client.enhanced.friends.removeFriend("@user:example.com");
```

#### 搜索好友

```typescript
// 搜索好友
const results = await client.enhanced.friends.searchFriends("keyword");

// 搜索用户（非好友）
const userResults = await client.enhanced.friends.searchUsers("keyword");
```

#### 设置好友备注

```typescript
await client.enhanced.friends.setRemark("@user:example.com", "我的好友");
```

### 4.2 好友请求

#### 发送好友请求

```typescript
await client.enhanced.friendRequests.sendRequest("@user:example.com");
```

#### 获取好友请求列表

```typescript
// 获取收到的好友请求
const incoming = await client.enhanced.friendRequests.getIncomingRequests();

// 获取发送的好友请求
const outgoing = await client.enhanced.friendRequests.getOutgoingRequests();
```

#### 接受/拒绝好友请求

```typescript
// 接受好友请求
await client.enhanced.friendRequests.acceptRequest("request-id");

// 拒绝好友请求
await client.enhanced.friendRequests.declineRequest("request-id");
```

### 4.3 好友分类

#### 创建分类

```typescript
await client.enhanced.friendCategories.createCategory("工作", "同事");
```

#### 获取所有分类

```typescript
const categories = await client.enhanced.friendCategories.getCategories();
```

#### 添加好友到分类

```typescript
await client.enhanced.friendCategories.addUserToCategory(
    "@user:example.com",
    "工作"
);
```

#### 从分类移除好友

```typescript
await client.enhanced.friendCategories.removeUserFromCategory(
    "@user:example.com",
    "工作"
);
```

#### 设置好友的分类

```typescript
// 设置好友的分类列表（覆盖现有分类）
await client.enhanced.friendCategories.setCategories("@user:example.com", [
    "工作",
    "家人",
]);
```

#### 删除分类

```typescript
await client.enhanced.friendCategories.deleteCategory("工作");
```

### 4.4 屏蔽用户

#### 屏蔽用户

```typescript
await client.enhanced.blockedUsers.block("@spam:example.com", "Spam user");
```

#### 解除屏蔽

```typescript
await client.enhanced.blockedUsers.unblock("@spam:example.com");
```

#### 获取屏蔽列表

```typescript
const blocked = await client.enhanced.blockedUsers.getBlocked();
```

#### 检查用户是否被屏蔽

```typescript
const isBlocked = await client.enhanced.blockedUsers.check("@spam:example.com");
console.log("是否被屏蔽:", isBlocked);
```

### 4.5 私聊功能

#### 创建私聊会话

```typescript
const session = await client.enhanced.privateChat.createSession("@user:example.com");
console.log("会话 ID:", session.id);
```

#### 发送消息

```typescript
// 文本消息
await client.enhanced.privateChat.sendMessage("@user:example.com", {
    msgtype: "m.text",
    body: "Hello!",
});

// 图片消息
await client.enhanced.privateChat.sendMessage("@user:example.com", {
    msgtype: "m.image",
    body: "图片描述",
    url: "mxc://example.com/abcdef",
});

// 文件消息
await client.enhanced.privateChat.sendFile("@user:example.com", fileBlob, "document.pdf");
```

#### 获取聊天历史

```typescript
const messages = await client.enhanced.privateChat.getMessages("@user:example.com", {
    limit: 50,
    from: "pagination-token",
});
```

#### 获取未读数

```typescript
const unread = await client.enhanced.privateChat.getUnreadCount();
console.log("未读消息数:", unread);
```

#### 标记消息为已读

```typescript
await client.enhanced.privateChat.markRead("message-id");
```

#### 搜索私聊消息

```typescript
const results = await client.enhanced.privateChat.search("@user:example.com", {
    query: "关键词",
    limit: 20,
});
```

### 4.6 聊天室管理

#### 创建聊天室

```typescript
const room = await client.room.createRoom({
    name: "讨论组",
    visibility: "private",
    preset: "private_chat",
    invite: ["@user1:example.com", "@user2:example.com"],
});
```

#### 加入房间

```typescript
// 加入房间
await client.room.joinRoom("!room:example.com");

// 通过别名加入
await client.room.joinRoom("#room_alias:example.com");
```

#### 离开房间

```typescript
await client.room.leaveRoom("!room:example.com");
```

#### 邀请成员

```typescript
await client.room.inviteUser("!room:example.com", {
    user_id: "@newuser:example.com",
});
```

#### 踢出/封禁用户

```typescript
// 踢出用户
await client.room.kickUser("!room:example.com", "@user:example.com", "原因");

// 封禁用户
await client.room.banUser("!room:example.com", "@user:example.com", "原因");

// 解封用户
await client.room.unbanUser("!room:example.com", "@user:example.com");
```

### 4.7 消息操作

#### 发送消息

```typescript
// 发送文本消息
const result = await client.message.sendMessage(
    "!room:example.com",
    "m.room.message",
    {
        msgtype: "m.text",
        body: "Hello!",
    }
);

console.log("事件 ID:", result.event_id);
```

#### 编辑消息

```typescript
await client.message.editMessage(
    "!room:example.com",
    "$event:example.com",
    "m.room.message",
    {
        body: "原始消息",
        msgtype: "m.text",
        "m.new_content": {
            body: "编辑后的消息",
            msgtype: "m.text",
        },
        "m.relates_to": {
            rel_type: "m.replace",
            event_id: "$event:example.com",
        },
    }
);
```

#### 回复消息

```typescript
await client.message.replyMessage(
    "!room:example.com",
    "$event:example.com",
    {
        msgtype: "m.text",
        body: "回复内容",
    }
);
```

#### 撤回消息

```typescript
await client.message.redactEvent(
    "!room:example.com",
    "$event:example.com",
    { reason: "发送错误" }
);
```

### 4.8 语音通话

#### 上传语音消息

```typescript
const voiceMessage = await client.enhanced.voice.uploadVoice("!room:example.com", {
    file: audioBlob,
    name: "语音消息",
    duration: 15000, // 毫秒
});

console.log("语音消息 ID:", voiceMessage.message_id);
```

#### 获取用户语音配额

```typescript
const quota = await client.enhanced.voiceUser.getQuota("@user:example.com");
console.log("已用:", quota.used, "/", quota.total);
```

#### 设置用户语音偏好

```typescript
await client.enhanced.voiceUser.setPreferences("@user:example.com", {
    quality: "high",
    autoPlay: true,
});
```

### 4.9 安全功能

#### 威胁检测

```typescript
const threat = await client.enhanced.security.detectThreats("用户输入内容", {
    user_id: "@user:example.com",
});

if (!threat.safe) {
    console.warn("检测到威胁:", threat.threats);
}
```

#### IP 管理

```typescript
// 封禁 IP
await client.enhanced.security.blockIp("192.168.1.100", {
    reason: "Spam activity",
});

// 获取 IP 状态
const status = await client.enhanced.security.getIpStatus("192.168.1.100");

// 解除 IP 封禁
await client.enhanced.security.unblockIp("192.168.1.100");
```

### 4.10 管理功能

#### 用户管理

```typescript
// 获取用户列表
const users = await client.enhanced.admin.getUsers({ page: 1, limit: 20 });

// 停用用户
await client.enhanced.admin.suspendUser("@user:example.com", "违规行为");

// 激活用户
await client.enhanced.admin.activateUser("@user:example.com");

// 批量操作
const result = await client.enhanced.admin.batchUserOperations([
    { user_id: "@user1:example.com", action: "suspend" },
    { user_id: "@user2:example.com", action: "activate" },
]);
```

#### 房间管理

```typescript
// 获取房间列表
const rooms = await client.enhanced.admin.getRooms({ page: 1, limit: 20 });

// 删除房间
await client.enhanced.admin.deleteRoom("!room:example.com", "违规内容");
```

#### 系统统计

```typescript
const stats = await client.enhanced.admin.getStatistics();
console.log("用户数:", stats.total_users);
console.log("房间数:", stats.total_rooms);
```

## 五、错误处理

### 5.1 错误类型

SDK 使用 `SynapseEnhancedError` 类统一处理所有错误：

```typescript
import { SynapseEnhancedError, ErrorCode } from "matrix-js-sdk";

try {
    await client.enhanced.privateChat.sendMessage(userId, message);
} catch (error) {
    if (error instanceof SynapseEnhancedError) {
        console.error("错误码:", error.code);
        console.error("错误信息:", error.message);
        console.error("HTTP 状态码:", error.statusCode);
        console.error("详细信息:", error.detail);
        console.error("是否可重试:", error.retryable);
    }
}
```

### 5.2 错误码枚举

常用的错误码：

| 错误码 | 说明 | HTTP 状态码 |
| ------ | ---- | ----------- |
| `INVALID_PARAM` | 参数错误 | 400 |
| `UNKNOWN_TOKEN` | 令牌无效 | 401 |
| `FORBIDDEN` | 权限不足 | 403 |
| `NOT_FOUND` | 资源不存在 | 404 |
| `RATE_LIMITED` | 速率限制 | 429 |
| `INTERNAL_ERROR` | 内部错误 | 500 |
| `UNAVAILABLE` | 服务不可用 | 503 |

### 5.3 错误处理示例

```typescript
try {
    const friends = await client.enhanced.friends.getFriends({ page: 1, limit: 20 });
} catch (error) {
    if (error instanceof SynapseEnhancedError) {
        switch (error.code) {
            case ErrorCode.INVALID_PARAM:
                // 处理参数错误
                break;
            case ErrorCode.RATE_LIMITED:
                // 处理速率限制，可重试
                const retryAfter = error.detail?.retry_after as number;
                await sleep(retryAfter * 1000);
                // 重试...
                break;
            case ErrorCode.FORBIDDEN:
                // 处理权限错误
                break;
            default:
                // 处理其他错误
        }
    }
}
```

## 六、性能优化

### 6.1 使用缓存

SDK 内置 LRU 缓存，自动管理内存：

```typescript
// 缓存由 HTTP 客户端自动管理
// 第一次请求会发送到服务器
const response1 = await client.enhanced.friends.getFriends({ page: 1, limit: 20 });

// 相同的请求会从缓存返回（如果未过期）
const response2 = await client.enhanced.friends.getFriends({ page: 1, limit: 20 });
```

### 6.2 批量操作

批量操作比单个操作更高效：

```typescript
// 不推荐：多次请求
for (const userId of userIds) {
    await client.enhanced.admin.suspendUser(userId, "批量停用");
}

// 推荐：一次批量操作
await client.enhanced.admin.batchUserOperations(
    userIds.map((userId) => ({ user_id: userId, action: "suspend" }))
);
```

### 6.3 并发控制

SDK 自动管理并发请求：

```typescript
// SDK 会自动控制并发
const promises = userIds.map((userId) =>
    client.enhanced.friends.addFriend(userId)
);

await Promise.all(promises);
```

## 七、安全最佳实践

### 7.1 输入验证

```typescript
import { InputValidator } from "matrix-js-sdk";

// SDK 内置验证，但也可以手动验证
try {
    InputValidator.assertValidUserId("@user:example.com");
    InputValidator.assertValidRoomId("!room:example.com");
    InputValidator.assertValidEventId("$event:example.com");
} catch (error) {
    console.error("输入验证失败:", error);
}
```

### 7.2 内容安全

```typescript
// 检测内容安全
const threat = await client.enhanced.security.detectThreats(messageContent);
if (!threat.safe) {
    // 处理威胁
    console.warn("检测到威胁:", threat.threats);
    return;
}

// 安全地发送消息
await client.enhanced.privateChat.sendMessage(userId, messageContent);
```

### 7.3 端到端加密

```typescript
// 初始化加密
await client.initCrypto();

// 发送加密消息（自动处理）
await client.message.sendMessage(roomId, "m.room.message", {
    msgtype: "m.text",
    body: "这是加密消息",
});
```

## 八、故障排查

### 8.1 常见问题

**Q: 连接服务器失败**

A: 检查：

1. baseUrl 是否正确
2. 网络连接是否正常
3. 服务器是否可访问

**Q: 认证失败**

A: 检查：

1. accessToken 是否有效
2. 令牌是否已过期
3. 是否有足够的权限

**Q: 速率限制错误**

A: SDK 会自动标记错误为可重试：

1. 检查 `error.retryable` 属性
2. 查看 `error.detail.retry_after` 获取重试时间
3. 使用批量操作减少请求次数

### 8.2 调试模式

启用调试日志：

```typescript
import { setLogLevel, LogLevel } from "matrix-js-sdk";

// 设置日志级别
setLogLevel(LogLevel.DEBUG);
```

### 8.3 性能监控

获取性能统计：

```typescript
const stats = await client.getHttpClient().getStats();
console.log("缓存命中率:", stats.hitRate);
console.log("平均响应时间:", stats.avgResponseTime);
```

## 九、测试

### 9.1 运行测试

```bash
# 运行所有测试
npm test

# 运行特定模块测试
npm test -- friends
npm test -- admin
npm test -- security
```

### 9.2 测试覆盖率

```
Test Suites: 159 passed, 159 total (100%)
Tests:       3319 passed, 22 skipped (100%)
```

## 十、更新日志

### v3.0.0 (2026-02-09)

**重大更新**:

- ✅ UnifiedMatrixClient 统一客户端
- ✅ SynapseEnhancedClient 需要 MatrixClient 参数
- ✅ Rust Crypto E2EE 支持
- ✅ 错误处理使用 SynapseEnhancedError
- ✅ Admin API v2 标准化

**新增功能**:

- 统一客户端接口
- 端到端加密支持
- 更好的类型定义

### v2.0.0 (2026-02)

**重大更新**:

- ✅ 移除过度工程化代码 (~3000 行)
- ✅ 修复 WebRTC 内存泄漏
- ✅ 整合缓存实现（LRU Cache）
- ✅ Admin API v2 标准化
- ✅ 测试覆盖率达到 100%

**新增功能**:

- 朋友请求独立模块
- 朋友分类独立模块
- 屏蔽用户独立模块
- 私聊管理模块
- 音频上传模块

### v1.0.0 (2024-01)

- 初始版本
- 基础 Enhanced 模块

## 十一、参考资源

### 官档

- [SDK API 文档](../sdk/api-SDK/API-Documentation.md)
- [Rust API 文档](../sdk/api-SDK/rust-api.md)
- [性能优化报告](../sdk/api-SDK/PERFORMANCE_REPORT.md)

### 相关链接

- [Matrix 官方文档](https://matrix.org/docs/)
- [Matrix 规范](https://spec.matrix.org/)
- [Synapse 文档](https://element-hq.github.io/synapse/latest/)

## 十二、支持

### 获取帮助

- 查看 [Issues](https://github.com/matrix-org/matrix-js-sdk/issues)
- Matrix 社区: #matrix-js-sdk:matrix.org
- 开发者支持: [Matrix Dev](https://matrix.org/docs)

### 报告问题

报告问题时请提供：

1. SDK 版本号
2. 问题描述和重现步骤
3. 错误日志
4. 环境信息

---

**文档版本**: 3.0.0
**最后更新**: 2026-02-09
**维护状态**: ✅ 活跃维护
