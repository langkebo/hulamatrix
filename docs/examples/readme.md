# Matrix SDK 快速开始示例

本目录包含 Matrix JavaScript SDK 的使用示例，展示如何集成和使用各种功能。

## 目录结构

| 文件                                                             | 说明                                                         | 难度          |
| ---------------------------------------------------------------- | ------------------------------------------------------------ | ------------- |
| [01-basic-client.js](./01-basic-client.js)                       | 基础客户端连接和认证示例                                     | ⭐ 入门       |
| [01-basic-client.ts](./01-basic-client.ts)                       | 基础客户端连接和认证示例 (TypeScript)                        | ⭐ 入门       |
| [02-friends-api.js](./02-friends-api.js)                         | 好友功能完整演示（添加、删除、搜索、分类）                   | ⭐⭐ 中级     |
| [02-friends-api.ts](./02-friends-api.ts)                         | 好友功能完整演示 (TypeScript)                                | ⭐⭐ 中级     |
| [03-private-chat.js](./03-private-chat.js)                       | 私聊功能演示（会话创建、消息发送、文件分享）                 | ⭐⭐ 中级     |
| [03-private-chat.ts](./03-private-chat.ts)                       | 私聊功能演示 (TypeScript)                                    | ⭐⭐ 中级     |
| [04-admin-api.js](./04-admin-api.js)                             | 管理功能演示（用户管理、房间管理、系统统计）                 | ⭐⭐⭐ 高级   |
| [04-admin-api.ts](./04-admin-api.ts)                             | 管理功能演示 (TypeScript)                                    | ⭐⭐⭐ 高级   |
| [05-error-handling.js](./05-error-handling.js)                   | 错误处理和重试机制演示                                       | ⭐⭐ 中级     |
| [05-error-handling.ts](./05-error-handling.ts)                   | 错误处理和重试机制演示 (TypeScript)                          | ⭐⭐ 中级     |
| [06-performance.js](./06-performance.js)                         | 性能监控和优化演示                                           | ⭐⭐⭐ 高级   |
| [07-unified-client.ts](./07-unified-client.ts)                   | UnifiedMatrixClient 使用示例（推荐方式）                     | ⭐⭐ 中级     |
| [08-enhanced-friends-api.ts](./08-enhanced-friends-api.ts)       | Enhanced Friends API 高级功能（批量操作、统计）              | ⭐⭐⭐ 高级   |
| [09-complete-app.ts](./09-complete-app.ts)                       | 完整的 TypeScript 应用示例（聊天应用）                       | ⭐⭐⭐⭐ 专家 |
| [10-batch-and-streaming-api.ts](./10-batch-and-streaming-api.ts) | 批量操作和流式 API 示例 (TypeScript)                         | ⭐⭐⭐⭐ 专家 |

## 快速开始

### 1. 安装依赖

```bash
npm install matrix-js-sdk
```

### 2. 推荐方式：使用 UnifiedMatrixClient

```typescript
import { UnifiedMatrixClient } from "matrix-js-sdk";

// 创建统一客户端（推荐）
const client = new UnifiedMatrixClient({
    baseUrl: "https://matrix.example.com",
    accessToken: "your-access-token",
});

// 获取好友列表
const result = await client.enhanced.friends.getFriends({
    page: 1,
    limit: 20,
});

console.log(`共有 ${result.total} 个好友`);
```

### 3. 直接使用 SynapseEnhancedClient

```typescript
import { SynapseEnhancedClient, createClient } from "matrix-js-sdk";

// 先创建标准 MatrixClient
const matrixClient = createClient({
    baseUrl: "https://matrix.example.com",
    accessToken: "your-access-token",
    userId: "@user:example.com",
});

// 然后创建 Enhanced 客户端（需要 MatrixClient）
const enhancedClient = new SynapseEnhancedClient({
    baseUrl: "https://matrix.example.com",
    accessToken: "your-access-token",
    userId: "@user:example.com",
}, matrixClient);

// 使用 Enhanced API
const friends = await enhancedClient.friends.getFriends({ page: 1, limit: 20 });
```

### 4. 错误处理

```typescript
import { SynapseEnhancedError, ErrorCode } from "matrix-js-sdk";

try {
    await client.enhanced.privateChat.sendMessage("@user:example.com", {
        msgtype: "m.text",
        body: "Hello!",
    });
} catch (error) {
    if (error instanceof SynapseEnhancedError) {
        console.error(`Error [${error.code}]: ${error.message}`);
        console.error(`可重试: ${error.retryable}`);

        // 处理特定错误
        if (error.code === ErrorCode.RATE_LIMITED) {
            // 实现重试逻辑
            const retryAfter = error.detail?.retry_after as number;
            await sleep(retryAfter * 1000);
        }
    }
}
```

## 示例详解

### 01 - 基础客户端 (Basic Client)

**内容**:

- UnifiedMatrixClient 初始化（推荐方式）
- 用户登录和注册
- 获取状态
- 初始化 E2EE
- 基本错误处理

**适用场景**:

- 第一次使用 SDK
- 了解基本认证流程
- 测试服务器连接

### 02 - 好友 API (Friends API)

**内容**:

- 获取好友列表
- 添加/删除好友
- 搜索好友
- 好友请求管理（独立模块）
- 好友分类管理（独立模块）
- 屏蔽用户管理（独立模块）

**适用场景**:

- 社交应用开发
- 用户关系管理
- 好友推荐系统

### 03 - 私聊功能 (Private Chat)

**内容**:

- 创建私聊会话
- 发送文本/图片/文件消息
- 获取聊天历史
- 未读消息统计
- 标记已读

**适用场景**:

- 即时通讯应用
- 客服系统
- 一对一聊天

### 04 - 管理 API (Admin API)

**内容**:

- 用户管理（列表、详情、停用、激活）
- 房间管理（列表、详情、删除）
- 系统统计查询
- 批量操作

**适用场景**:

- 后台管理系统
- 运营工具
- 数据分析平台

### 05 - 错误处理 (Error Handling)

**内容**:

- SynapseEnhancedError 错误类型识别
- ErrorCode 枚举使用
- 自定义错误处理
- 重试机制
- 批量操作错误处理

**适用场景**:

- 生产环境部署
- 网络不稳定场景
- 大规模数据处理

### 06 - 性能监控 (Performance)

**内容**:

- 请求性能追踪
- 缓存命中率统计
- 批量操作性能对比

**适用场景**:

- 性能优化
- 容量规划
- 问题诊断

### 07 - 统一客户端 (Unified Client) ⭐ 推荐

**内容**:

- UnifiedMatrixClient 使用
- 标准 Matrix API 和 Enhanced API 整合
- 统一认证和会话管理
- E2EE 初始化

**适用场景**:

- 需要同时使用标准和增强功能
- 简化客户端初始化
- 新项目推荐使用

### 08 - Enhanced Friends API 高级功能

**内容**:

- 批量好友操作
- 好友统计信息
- 高级搜索功能
- 好友分组管理

**适用场景**:

- 大规模好友管理
- 社交网络分析
- 推荐系统

### 09 - 完整应用 (Complete App)

**内容**:

- 完整的聊天应用架构
- 事件监听和处理
- UI 更新逻辑
- 状态管理

**适用场景**:

- 完整应用开发参考
- 架构设计学习
- 最佳实践示例

### 10 - 批量和流式 API (Batch & Streaming)

**内容**:

- 批量用户操作
- 批量房间操作
- 批量消息删除
- 流式数据获取

**适用场景**:

- 大规模数据处理
- 数据迁移
- 批量导入导出

## 运行示例

### 方式一：直接运行（推荐用于开发测试）

```bash
# 安装依赖
npm install

# 运行 JavaScript 示例
node docs/examples/01-basic-client.js

# 运行 TypeScript 示例（需先编译）
npx ts-node docs/examples/01-basic-client.ts
```

### 方式二：集成到项目

1. **复制示例代码到项目**

```bash
# 复制 TypeScript 示例
cp docs/examples/01-basic-client.ts src/examples/
```

2. **修改配置**

```typescript
// 替换为实际的配置
const client = new UnifiedMatrixClient({
    baseUrl: "https://your-server.com",
    accessToken: "your-actual-access-token",
});
```

3. **在应用中导入使用**

```typescript
import { exampleFunction } from "./examples/01-basic-client";

// 调用示例函数
await exampleFunction();
```

## 配置说明

### UnifiedMatrixClient 配置（推荐）

```typescript
interface IUnifiedClientConfig {
    baseUrl: string;           // Matrix 服务器地址
    accessToken: string;       // 用户访问令牌
    userId?: string;           // 用户 ID（可选）
    apiPrefix?: string;        // Enhanced API 前缀，默认 "/_synapse/client"
    timeout?: number;          // 请求超时时间（毫秒），默认 30000
}
```

### SynapseEnhancedClient 配置

```typescript
interface ISynapseEnhancedConfig {
    baseUrl: string;           // Matrix 服务器地址
    accessToken: string;       // 用户访问令牌
    userId?: string;           // 用户 ID
    apiPrefix?: string;        // API 前缀，默认 "/_synapse/client"
    timeout?: number;          // 请求超时时间（毫秒），默认 30000
}

// 注意：SynapseEnhancedClient 需要 MatrixClient 作为第二个参数
const enhancedClient = new SynapseEnhancedClient(config, matrixClient);
```

### 完整配置示例

```typescript
const client = new UnifiedMatrixClient({
    baseUrl: "https://matrix.example.com",
    accessToken: "your-access-token",
    userId: "@user:example.com",
    apiPrefix: "/_synapse/client",
    timeout: 30000,
});

// 初始化 E2EE（如需加密）
await client.initCrypto();

// 启动客户端以接收实时事件
await client.start();
```

## API 模块结构

### UnifiedMatrixClient 模块

```typescript
const client = new UnifiedMatrixClient(config);

// 标准 Matrix API
client.auth.*        // 注册、登录、登出、令牌刷新
client.user.*        // 用户资料、密码、停用
client.room.*        // 房间创建、加入、管理
client.message.*     // 消息发送、编辑、回复、撤回

// Enhanced API
client.enhanced.friends.*            // 好友管理
client.enhanced.friendRequests.*     // 好友请求
client.enhanced.friendCategories.*   // 好友分类
client.enhanced.blockedUsers.*       // 屏蔽用户
client.enhanced.privateChat.*        // 私聊功能
client.enhanced.admin.*              // 管理功能
client.enhanced.security.*           // 安全功能
client.enhanced.voice.*              // 语音功能
// ... 更多模块
```

## 注意事项

### 1. 客户端选择

- **新项目推荐使用** `UnifiedMatrixClient`
- **仅需 Enhanced 功能** 可使用 `SynapseEnhancedClient`（需要 MatrixClient）
- `SynapseEnhancedClient` **必须传入** `MatrixClient` 参数

### 2. 认证和权限

- 确保 `accessToken` 有效且具有相应权限
- 管理功能需要管理员权限
- 定期刷新访问令牌

### 3. 错误处理

- 始终使用 try-catch 包裹异步调用
- 检查 `error.retryable` 判断是否可重试
- 使用 `ErrorCode` 枚举处理特定错误

### 4. 性能优化

- 使用批量操作减少请求次数
- SDK 内置 LRU 缓存，自动管理
- 控制并发请求数量

### 5. 端到端加密

- 调用 `client.initCrypto()` 初始化加密
- 调用 `client.start()` 启动客户端同步
- 加密消息自动处理

## 常见问题

### Q: 如何获取 accessToken?

A: 通过登录 API 获取：

```typescript
import { UnifiedMatrixClient } from "matrix-js-sdk";

const client = new UnifiedMatrixClient({
    baseUrl: "https://matrix.example.com",
});

const result = await client.auth.login({
    type: "m.login.password",
    user: "@user:example.com",
    password: "password",
});

console.log(result.access_token);
```

### Q: UnifiedMatrixClient 和 SynapseEnhancedClient 有什么区别?

A:

- **UnifiedMatrixClient**: 推荐使用，整合了标准 Matrix API 和 Enhanced API，提供统一的接口
- **SynapseEnhancedClient**: 仅包含 Enhanced API，需要额外传入 MatrixClient 参数

### Q: 如何初始化端到端加密?

A:

```typescript
const client = new UnifiedMatrixClient(config);

// 1. 初始化加密
await client.initCrypto();

// 2. 启动客户端
await client.start();

// 3. 监听事件
client.getMatrixClient().on("event", (event) => {
    console.log("收到事件:", event);
});
```

### Q: 如何处理速率限制?

A: SDK 会自动标记错误为可重试：

```typescript
try {
    await client.enhanced.friends.getFriends();
} catch (error) {
    if (error instanceof SynapseEnhancedError) {
        if (error.code === ErrorCode.RATE_LIMITED) {
            const retryAfter = error.detail?.retry_after as number;
            await sleep(retryAfter * 1000);
            // 重试...
        }
    }
}
```

### Q: 好友请求、分类、屏蔽功能在哪里?

A: 这些现在是独立模块：

```typescript
// 好友请求
await client.enhanced.friendRequests.sendRequest("@user:example.com");
await client.enhanced.friendRequests.acceptRequest("request-id");

// 好友分类
await client.enhanced.friendCategories.createCategory("工作", "同事");
await client.enhanced.friendCategories.addUserToCategory("@user:example.com", "工作");

// 屏蔽用户
await client.enhanced.blockedUsers.block("@spam:example.com", "Spam");
await client.enhanced.blockedUsers.unblock("@spam:example.com");
```

## 进阶学习路径

### 第一阶段：基础 (1-2 天)

1. 阅读 01-basic-client 示例
2. 学习 UnifiedMatrixClient 初始化
3. 理解认证流程
4. 运行并修改示例代码

### 第二阶段：核心功能 (3-5 天)

1. 学习 Friends API (02)
2. 学习 Private Chat (03)
3. 了解独立模块结构
4. 实现简单的聊天功能

### 第三阶段：高级功能 (5-7 天)

1. 学习 Admin API (04)
2. 学习错误处理 (05)
3. 了解性能监控 (06)
4. 掌握批量操作

### 第四阶段：完整应用 (7-14 天)

1. 研究 Unified Client (07)
2. 参考 Complete App (09)
3. 学习 E2EE 集成
4. 开发自己的应用

## 示例代码贡献

欢迎贡献更多示例！

### 示例代码规范

1. **文件命名**: `NN-description.ts` (TypeScript) 或 `NN-description.js`
2. **使用 UnifiedMatrixClient**: 新示例推荐使用统一客户端
3. **代码注释**: 详细解释每个步骤
4. **错误处理**: 完整的错误处理逻辑
5. **类型安全**: TypeScript 示例应有完整类型定义

### 提交流程

1. Fork 项目
2. 创建示例分支
3. 添加示例文件和说明
4. 提交 Pull Request

## 更新日志

| 版本  | 日期       | 更新内容                             |
| ----- | ---------- | ------------------------------------ |
| 3.0.0 | 2026-02-09 | 更新所有示例以使用 UnifiedMatrixClient |
|       |            | 更新 SynapseEnhancedClient 初始化方式  |
|       |            | 添加独立模块示例（friendRequests 等）  |
|       |            | 更新错误处理使用 SynapseEnhancedError  |
| 2.0.0 | 2026-02    | 优化错误处理示例                      |
|       |            | 添加批量操作和流式 API 示例           |
| 1.0.0 | 2024-01    | 初始版本                              |

---

**文档版本**: 3.0.0
**最后更新**: 2026-02-09
**维护状态**: ✅ 活跃维护
