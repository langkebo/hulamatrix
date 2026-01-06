# PrivateChat SDK 优化方案

> **项目**: HuLa Matrix PrivateChat SDK
> **基于**: matrix-js-sdk v39.1.3
> **后端服务器**: https://matrix.cjystx.top:443
> **创建时间**: 2026-01-06
> **状态**: 待实现

---

## 执行摘要

### 问题分析

通过对比 `12-private-chat.md` 文档和当前代码实现，发现以下主要问题：

1. **SDK 扩展缺失**: 文档描述了完整的 `PrivateChatClient` API，但 `src/sdk` 目录下没有对应的实现
2. **API 不一致**: 应用代码期望使用 `client.privateChatV2`，但实际未实现
3. **功能不完整**: 缺少缓存机制、轮询订阅、事件系统等核心功能
4. **测试覆盖**: 没有 PrivateChat SDK 的单元测试和集成测试

### 解决方案

创建完整的 `matrix-private-chat` SDK 扩展，与 `matrix-friends` 保持一致的架构和代码质量。

---

## 1. 文档与代码差异分析

### 1.1 文档描述的功能

根据 `12-private-chat.md`，`PrivateChatClient` 应该提供：

#### 核心功能
- ✅ `listSessions()` - 获取会话列表（支持缓存）
- ✅ `createSession()` - 创建私聊会话
- ✅ `sendMessage()` - 发送消息
- ✅ `sendText()` - 发送文本消息（便捷方法）
- ✅ `getMessages()` - 获取消息历史（支持分页）
- ✅ `deleteSession()` - 删除会话
- ✅ `getSession()` - 获取单个会话（缓存）
- ✅ `hasSession()` - 检查会话是否存在
- ✅ `subscribeToMessages()` - 订阅消息（轮询机制）
- ✅ `invalidateCache()` - 清除缓存
- ✅ `dispose()` - 清理资源

#### 事件系统
- ✅ 继承 EventEmitter
- ✅ `session.created` - 会话创建事件
- ✅ `session.deleted` - 会话删除事件
- ✅ `message.received` - 消息接收事件
- ✅ `message.sent` - 消息发送事件

#### 特性
- ✅ 自动轮询（3秒间隔）
- ✅ 会话缓存
- ✅ 消息过滤（只通知非自己发送的消息）
- ✅ TTL 支持
- ✅ 错误处理

### 1.2 当前实现状态

| 组件 | 状态 | 说明 |
|------|------|------|
| SDK 扩展 | ❌ 缺失 | `src/sdk` 下无 `matrix-private-chat` |
| 类型定义 | ❌ 缺失 | 文档中的类型定义不存在 |
| Service 层 | ⚠️ 部分 | `privateChatServiceV2.ts` 期望 `client.privateChatV2` |
| Store 层 | ⚠️ 部分 | `privateChatV2.ts` 依赖不存在的 API |
| 测试 | ❌ 缺失 | 无 SDK 测试用例 |

### 1.3 API 端点

根据文档，后端提供以下端点：

| 功能 | V1 端点 | V2 端点 |
|------|---------|---------|
| 创建会话 | POST `/_synapse/client/private` | - |
| 发送消息 | POST `/_synapse/client/private` | - |
| 会话列表 | GET `/_synapse/client/private` | GET `/_synapse/client/enhanced/private_chat/v2/sessions` |
| 消息列表 | GET `/_synapse/client/private` | GET `/_synapse/client/enhanced/private_chat/v2/messages` |
| 删除会话 | POST `/_synapse/client/private` | - |
| 会话统计 | - | GET `/_synapse/client/enhanced/private_chat/v2/stats` |

---

## 2. SDK 架构设计

### 2.1 目录结构

```
src/sdk/matrix-private-chat/
├── types.ts                    # 类型定义
├── PrivateChatExtension.ts    # PrivateChat API 实现
├── factory.ts                  # 工厂函数
├── utils.ts                    # 工具函数
├── index.ts                    # 统一导出
├── README.md                   # 配置指南
├── OPTIMIZATION_REPORT.md      # 优化报告
└── __tests__/                  # 测试用例
    ├── PrivateChatExtension.spec.ts   # 单元测试
    └── integration.spec.ts          # 集成测试
```

### 2.2 核心接口设计

```typescript
/**
 * PrivateChat API 接口定义
 */
export interface PrivateChatApi {
  // 会话管理
  listSessions(options?: ListSessionsOptions): Promise<ListSessionsResponse>;
  createSession(options: CreateSessionOptions): Promise<CreateSessionResponse>;
  deleteSession(sessionId: string): Promise<OperationResponse>;
  getSession(sessionId: string): PrivateChatSession | null;
  hasSession(sessionId: string): boolean;

  // 消息管理
  sendMessage(options: SendMessageOptions): Promise<SendMessageResponse>;
  sendText(sessionId: string, content: string): Promise<string>;
  getMessages(options: GetMessagesOptions): Promise<GetMessagesResponse>;

  // 统计信息
  getStats(sessionId: string): Promise<GetStatsResponse>;

  // 订阅和缓存
  subscribeToMessages(sessionId: string, handler: MessageHandler): () => void;
  invalidateCache(): void;

  // 资源清理
  dispose(): void;
}
```

### 2.3 类型定义

```typescript
// 私聊会话
export interface PrivateChatSession {
  session_id: string;          // 会话唯一 ID
  participants: string[];       // 参与者列表
  session_name?: string;        // 会话名称
  created_by: string;           // 创建者用户 ID
  created_at: string;           // 创建时间 (ISO 8601)
  ttl_seconds?: number;         // 会话生存时间（秒）
  expires_at?: string;          // 过期时间 (ISO 8601)
  updated_at?: string;          // 更新时间 (ISO 8601)
  status?: string;              // 会话状态
}

// 私聊消息
export interface PrivateChatMessage {
  message_id: string;          // 消息 ID
  session_id: string;           // 会话 ID
  sender_id: string;            // 发送者用户 ID
  content: string;              // 消息内容
  type: "text" | "image" | "file" | "audio" | "video";  // 消息类型
  created_at: string;           // 创建时间 (ISO 8601)
  expires_at?: string;          // 过期时间 (ISO 8601)
}

// API 请求/响应类型
export interface CreateSessionOptions {
  participants: string[];
  session_name?: string;
  ttl_seconds?: number;
}

export interface CreateSessionResponse {
  status: string;
  session_id: string;
  session?: PrivateChatSession;
}

export interface SendMessageOptions {
  session_id: string;
  content: string;
  type?: "text" | "image" | "file" | "audio" | "video";
  ttl_seconds?: number;
}

export interface SendMessageResponse {
  status: string;
  message_id: string;
}

export interface GetMessagesOptions {
  session_id: string;
  limit?: number;
  before?: string;
}

export interface GetMessagesResponse {
  status: string;
  messages: PrivateChatMessage[];
}
```

---

## 3. 实现计划

### 3.1 阶段 1: 基础结构（5分钟）

创建文件结构和基础类型定义：
- ✅ `types.ts` - 完整类型定义
- ✅ `utils.ts` - 工具函数
- ✅ `index.ts` - 导出配置

### 3.2 阶段 2: API 实现（30分钟）

实现核心 API 功能：
- ✅ `PrivateChatExtension.ts` - PrivateChatApi 实现
  - HTTP 请求封装
  - 错误处理
  - 类型安全
- ✅ `factory.ts` - 客户端扩展工厂函数

### 3.3 阶段 3: 高级特性（20分钟）

实现高级功能：
- ✅ 缓存机制（会话列表缓存）
- ✅ 轮询机制（3秒间隔自动轮询）
- ✅ 事件系统（EventEmitter）
- ✅ 订阅管理（自动清理）

### 3.4 阶段 4: 测试验证（15分钟）

创建测试用例：
- ✅ 单元测试（API 方法测试）
- ✅ 集成测试（完整流程测试）
- ✅ 类型检查
- ✅ ESLint 检查

### 3.5 阶段 5: 文档更新（10分钟）

更新文档：
- ✅ `README.md` - 使用说明
- ✅ `OPTIMIZATION_REPORT.md` - 优化报告
- ✅ 同步 `12-private-chat.md` 文档

---

## 4. 关键技术点

### 4.1 缓存机制

```typescript
class PrivateChatExtension implements PrivateChatApi {
  private sessionCache: Map<string, PrivateChatSession> = new Map();
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5分钟

  async listSessions(): Promise<ListSessionsResponse> {
    const now = Date.now();

    // 检查缓存是否有效
    if (this.cacheExpiry > now && this.sessionCache.size > 0) {
      return {
        status: 'ok',
        sessions: Array.from(this.sessionCache.values())
      };
    }

    // 从服务器获取
    const response = await this.fetchSessions();

    // 更新缓存
    this.sessionCache.clear();
    for (const session of response.sessions) {
      this.sessionCache.set(session.session_id, session);
    }
    this.cacheExpiry = now + this.CACHE_TTL_MS;

    return response;
  }

  invalidateCache(): void {
    this.sessionCache.clear();
    this.cacheExpiry = 0;
  }
}
```

### 4.2 轮询机制

```typescript
class PrivateChatExtension extends EventEmitter implements PrivateChatApi {
  private readonly POLL_INTERVAL_MS = 3000; // 3秒
  private pollTimers: Map<string, NodeJS.Timeout> = new Map();
  private messageHandlers: Map<string, Set<MessageHandler>> = new Map();
  private lastMessageIds: Map<string, string> = new Map();

  subscribeToMessages(sessionId: string, handler: MessageHandler): () => void {
    // 注册处理器
    if (!this.messageHandlers.has(sessionId)) {
      this.messageHandlers.set(sessionId, new Set());
    }
    this.messageHandlers.get(sessionId)!.add(handler);

    // 启动轮询
    this.startPolling(sessionId);

    // 返回取消订阅函数
    return () => this.unsubscribeFromMessages(sessionId, handler);
  }

  private startPolling(sessionId: string): void {
    if (this.pollTimers.has(sessionId)) {
      return; // 已在轮询
    }

    const timer = setInterval(async () => {
      await this.pollForNewMessages(sessionId);
    }, this.POLL_INTERVAL_MS);

    this.pollTimers.set(sessionId, timer);
  }

  private async pollForNewMessages(sessionId: string): Promise<void> {
    try {
      const { messages } = await this.getMessages({ session_id: sessionId, limit: 10 });

      // 过滤出新消息（只保留非自己发送的）
      const currentUserId = this.client.getUserId();
      const newMessages = messages.filter(msg => msg.sender_id !== currentUserId);

      // 通知处理器
      const handlers = this.messageHandlers.get(sessionId);
      if (handlers) {
        for (const message of newMessages) {
          for (const handler of handlers) {
            handler(message);
          }
        }
      }
    } catch (error) {
      // 轮询错误不抛出异常
      console.error('[PrivateChatExtension] Polling error:', error);
    }
  }
}
```

### 4.3 事件系统

```typescript
import { EventEmitter } from 'events';

class PrivateChatExtension extends EventEmitter {
  // 监听会话创建事件
  on(event: 'session.created', listener: (session: PrivateChatSession) => void): this;

  // 监听会话删除事件
  on(event: 'session.deleted', listener: (data: { sessionId: string; session?: PrivateChatSession }) => void): this;

  // 监听消息接收事件
  on(event: 'message.received', listener: (message: PrivateChatMessage) => void): this;

  // 监听消息发送事件
  on(event: 'message.sent', listener: (data: { sessionId: string; messageId: string }) => void): this;

  // 触发事件
  private emitSessionCreated(session: PrivateChatSession): void {
    this.emit('session.created', session);
  }

  private emitMessageReceived(message: PrivateChatMessage): void {
    this.emit('message.received', message);
  }
}
```

### 4.4 工厂函数

```typescript
/**
 * 创建增强的 Matrix 客户端（包含 PrivateChat API）
 */
export async function createEnhancedMatrixClient(
  config: EnhancedMatrixClientConfig
): Promise<EnhancedMatrixClient> {
  const matrixJs = await import('matrix-js-sdk');

  const baseClient = matrixJs.createClient({
    baseUrl: config.baseUrl,
    accessToken: config.accessToken,
    userId: config.userId,
    deviceId: config.deviceId,
  }) as unknown as MatrixClientLike;

  // 创建 PrivateChat API 扩展
  const privateChatApi = new PrivateChatExtension(baseClient, config.privateChatApiBaseUrl || config.baseUrl);

  // 添加到客户端
  Object.defineProperty(baseClient, 'privateChatV2', {
    value: privateChatApi,
    writable: false,
    enumerable: true,
    configurable: true,
  });

  return baseClient as EnhancedMatrixClient;
}

/**
 * 扩展现有 Matrix 客户端
 */
export function extendMatrixClient(
  client: MatrixClientLike,
  privateChatApiBaseUrl?: string
): void {
  if (isPrivateChatApiEnabled(client)) {
    return; // 已扩展
  }

  const privateChatApi = new PrivateChatExtension(client, privateChatApiBaseUrl || client.getHomeserverUrl?.() || '');

  Object.defineProperty(client, 'privateChatV2', {
    value: privateChatApi,
    writable: false,
    enumerable: true,
    configurable: true,
  });
}

/**
 * 检查是否已扩展
 */
export function isPrivateChatApiEnabled(client: MatrixClientLike): boolean {
  return 'privateChatV2' in client && typeof (client as any).privateChatV2 === 'object';
}
```

---

## 5. 与 Friends SDK 保持一致

### 5.1 相同的架构模式

| 特性 | Friends SDK | PrivateChat SDK |
|------|------------|-----------------|
| 目录结构 | ✅ 一致 | ✅ 一致 |
| 类型定义 | ✅ 完整 | ✅ 完整 |
| 工厂函数 | ✅ 提供 | ✅ 提供 |
| 错误处理 | ✅ 统一 | ✅ 统一 |
| 测试覆盖 | ✅ 33/33 | ✅ 目标 100% |

### 5.2 相同的代码质量

- ✅ TypeScript 严格模式
- ✅ ESLint 通过
- ✅ 完整的类型定义
- ✅ 详细的注释
- ✅ 错误处理
- ✅ 日志记录

---

## 6. 测试计划

### 6.1 单元测试（20个）

```
✓ 会话管理 (4个)
  ✓ 应该成功获取会话列表
  ✓ 应该成功创建会话
  ✓ 应该成功删除会话
  ✓ 应该正确检查会话存在

✓ 消息管理 (4个)
  ✓ 应该成功发送消息
  ✓ 应该成功发送文本消息
  ✓ 应该成功获取消息列表
  ✓ 应该支持分页获取消息

✓ 缓存机制 (3个)
  ✓ 应该缓存会话列表
  ✓ 应该支持清除缓存
  ✓ 缓存应该自动过期

✓ 轮询机制 (3个)
  ✓ 应该自动轮询新消息
  ✓ 应该过滤自己的消息
  ✓ 取消订阅应该停止轮询

✓ 事件系统 (4个)
  ✓ 应该触发会话创建事件
  ✓ 应该触发会话删除事件
  ✓ 应该触发消息接收事件
  ✓ 应该触发消息发送事件

✓ 错误处理 (2个)
  ✓ 应该正确处理网络错误
  ✓ 应该正确处理 API 错误
```

### 6.2 集成测试（12个）

```
✓ 工厂函数测试 (2个)
  ✓ 应该成功创建增强客户端
  ✓ 应该成功扩展现有客户端

✓ 完整流程测试 (6个)
  ✓ 应该完成完整的会话创建流程
  ✓ 应该完成完整的消息发送流程
  ✓ 应该完成完整的消息订阅流程
  ✓ 应该完成会话删除流程
  ✓ 应该处理缓存刷新
  ✓ 应该处理错误恢复

✓ 边界条件测试 (4个)
  ✓ 应该处理空参与者列表
  ✓ 应该处理过期会话
  ✓ 应该处理并发操作
  ✓ 应该正确清理资源
```

---

## 7. 成功标准

### 7.1 功能完整性
- ✅ 实现文档中描述的所有 API 方法
- ✅ 实现缓存机制
- ✅ 实现轮询订阅
- ✅ 实现事件系统

### 7.2 代码质量
- ✅ TypeScript 类型检查通过（0 错误）
- ✅ ESLint 检查通过（0 错误）
- ✅ 测试覆盖率 100%（核心功能）

### 7.3 文档完整性
- ✅ README 使用说明
- ✅ API 参考文档
- ✅ 优化报告
- ✅ 同步 `12-private-chat.md`

### 7.4 集成验证
- ✅ 与 `privateChatServiceV2.ts` 集成成功
- ✅ 与 `privateChatV2.ts` store 集成成功
- ✅ 应用可以正常使用 PrivateChat 功能

---

## 8. 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| API 端点变化 | 中 | 使用灵活的 HTTP 封装，支持 V1/V2 |
| 后端兼容性 | 低 | 后端已确认支持 |
| 轮询性能 | 低 | 3秒间隔合理，支持取消订阅 |
| 测试覆盖 | 低 | 详细测试计划，确保质量 |

---

## 9. 后续优化（可选）

### 9.1 性能优化
- 使用 Web Workers 进行轮询
- 实现消息压缩
- 批量操作支持

### 9.2 功能增强
- 端到端加密支持
- 消息已读回执
- 输入状态指示器
- 消息撤回功能

### 9.3 用户体验
- 通知系统集成
- 消息预加载
- 离线消息缓存

---

## 10. 时间估算

| 阶段 | 任务 | 预计时间 |
|------|------|---------|
| 1 | 基础结构创建 | 5 分钟 |
| 2 | API 核心实现 | 30 分钟 |
| 3 | 高级特性实现 | 20 分钟 |
| 4 | 测试用例编写 | 15 分钟 |
| 5 | 文档更新 | 10 分钟 |
| **总计** | | **80 分钟** |

---

**状态**: ✅ 方案已制定，待实现
