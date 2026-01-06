# Matrix PrivateChat SDK

基于 matrix-js-sdk v39.1.3 的 PrivateChat API 扩展，为 HuLa Matrix 应用提供私聊功能。

## 特性

- ✅ **完整的 API 支持**: 会话管理、消息发送、历史查询等
- ✅ **自动缓存**: 会话列表自动缓存，减少网络请求
- ✅ **智能轮询**: 3秒间隔自动轮询新消息
- ✅ **事件系统**: EventEmitter 模式，监听会话和消息事件
- ✅ **类型安全**: 完整的 TypeScript 类型定义
- ✅ **错误处理**: 自定义错误类型，易于调试
- ✅ **资源管理**: 自动清理轮询和缓存

## 安装

```bash
# SDK 已集成到项目中，无需额外安装
```

## 快速开始

### 方式 1: 创建新的增强客户端

```typescript
import { createEnhancedMatrixClient } from '@/sdk/matrix-private-chat';

const client = await createEnhancedMatrixClient({
  baseUrl: 'https://matrix.cjystx.top',
  accessToken: 'syt_...',
  userId: '@user:server.com',
});

// 使用 PrivateChat API
const sessions = await client.privateChatV2.listSessions();
```

### 方式 2: 扩展现有客户端

```typescript
import { extendMatrixClient } from '@/sdk/matrix-private-chat';
import { MatrixClient } from 'matrix-js-sdk';

const client = new MatrixClient({ ... });
extendMatrixClient(client);

// 现在可以使用 PrivateChat API
await client.privateChatV2.createSession({ ... });
```

## API 文档

### 会话管理

#### 获取会话列表

```typescript
const response = await client.privateChatV2.listSessions({
  user_id: '@user:server.com', // 可选
});

console.log(response.sessions); // PrivateChatSession[]
```

#### 创建会话

```typescript
const response = await client.privateChatV2.createSession({
  participants: ['@alice:server.com', '@bob:server.com'],
  session_name: 'Private Chat',
  ttl_seconds: 3600, // 可选，会话生存时间（秒）
  auto_delete: false, // 可选，是否自动删除
});

console.log(response.session_id); // 新创建的会话 ID
console.log(response.session); // 会话详情
```

#### 删除会话

```typescript
await client.privateChatV2.deleteSession('session-uuid', {
  user_id: '@user:server.com', // 可选
});
```

#### 获取单个会话

```typescript
const session = client.privateChatV2.getSession('session-uuid');
if (session) {
  console.log(session.session_name);
  console.log(session.participants);
}
```

#### 检查会话是否存在

```typescript
const exists = client.privateChatV2.hasSession('session-uuid');
```

### 消息管理

#### 发送消息

```typescript
const response = await client.privateChatV2.sendMessage({
  session_id: 'session-uuid',
  content: 'Hello, World!',
  type: 'text', // 'text' | 'image' | 'file' | 'audio' | 'video'
  ttl_seconds: 3600, // 可选，消息生存时间
});

console.log(response.message_id);
```

#### 发送文本消息（便捷方法）

```typescript
const messageId = await client.privateChatV2.sendText(
  'session-uuid',
  'Hello, World!'
);
```

#### 获取消息列表

```typescript
const response = await client.privateChatV2.getMessages({
  session_id: 'session-uuid',
  limit: 50, // 每页数量，默认 50
  before: 'message-id', // 可选，获取此消息之前的消息
  user_id: '@user:server.com', // 可选
});

console.log(response.messages); // PrivateChatMessage[]
```

### 统计信息

```typescript
const response = await client.privateChatV2.getStats({
  session_id: 'session-uuid',
});

console.log(response.stats); // PrivateChatStats
```

### 订阅和缓存

#### 订阅新消息

```typescript
const unsubscribe = client.privateChatV2.subscribeToMessages(
  'session-uuid',
  (message) => {
    console.log('New message:', message.content);
    console.log('From:', message.sender_id);
    console.log('Type:', message.type);
  }
);

// 取消订阅
unsubscribe();
```

#### 清除缓存

```typescript
client.privateChatV2.invalidateCache();
```

### 资源清理

```typescript
// 清理所有轮询、缓存和监听器
client.privateChatV2.dispose();
```

## 事件系统

SDK 继承自 `EventEmitter`，可以监听以下事件：

### `session.created`

会话创建时触发

```typescript
client.privateChatV2.on('session.created', (session) => {
  console.log('Session created:', session.session_id);
});
```

### `session.deleted`

会话删除时触发

```typescript
client.privateChatV2.on('session.deleted', ({ sessionId, session }) => {
  console.log('Session deleted:', sessionId);
});
```

### `message.received`

收到新消息时触发

```typescript
client.privateChatV2.on('message.received', (message) => {
  console.log('Message received:', message.content);
});
```

### `message.sent`

发送消息成功时触发

```typescript
client.privateChatV2.on('message.sent', ({ sessionId, messageId }) => {
  console.log('Message sent:', messageId);
});
```

## 类型定义

### PrivateChatSession

```typescript
interface PrivateChatSession {
  session_id: string;          // 会话唯一 ID
  session_name?: string;        // 会话名称
  creator_id: string;           // 创建者用户 ID
  participants: string[];       // 参与者列表
  created_at: string;           // 创建时间 (ISO 8601)
  updated_at?: string;          // 更新时间 (ISO 8601)
  ttl_seconds?: number;         // 会话生存时间（秒）
  expires_at?: string;          // 过期时间 (ISO 8601)
  status?: string;              // 会话状态
}
```

### PrivateChatMessage

```typescript
interface PrivateChatMessage {
  id?: string;                  // 消息 ID (V1)
  message_id?: string;          // 消息 ID (V2)
  session_id: string;           // 会话 ID
  sender_id: string;            // 发送者用户 ID
  content: string;              // 消息内容
  type: "text" | "image" | "file" | "audio" | "video";  // 消息类型
  message_type?: string;        // 消息类型（后端字段）
  created_at: string;           // 创建时间 (ISO 8601)
  expires_at?: string;          // 过期时间 (ISO 8601)
}
```

### PrivateChatStats

```typescript
interface PrivateChatStats {
  message_count: number;       // 消息总数
  participant_count: number;    // 参与者数量
  last_activity: string;        // 最后活跃时间 (ISO 8601)
}
```

## 错误处理

SDK 提供了自定义错误类型：

```typescript
import {
  PrivateChatError,
  CreateSessionError,
  SendMessageError,
  SessionNotFoundError,
  DeleteSessionError,
  NetworkError,
} from '@/sdk/matrix-private-chat';

try {
  await client.privateChatV2.createSession({ ... });
} catch (error) {
  if (error instanceof CreateSessionError) {
    console.error('Failed to create session:', error.message);
    console.error('Status code:', error.statusCode);
    console.error('Response body:', error.body);
  } else if (error instanceof NetworkError) {
    console.error('Network error:', error.message);
  }
}
```

### 错误类型

- `PrivateChatError`: 基础错误类
  - `isAuthError()`: 是否为认证错误 (401)
  - `isForbidden()`: 是否为权限错误 (403)
  - `isInvalidParam()`: 是否为参数错误 (400)
  - `isNotFound()`: 是否为未找到错误 (404)

- `CreateSessionError`: 创建会话错误
- `SendMessageError`: 发送消息错误
- `SessionNotFoundError`: 会话不存在错误
- `DeleteSessionError`: 删除会话错误
- `NetworkError`: 网络错误

## 工具函数

SDK 提供了一些实用的工具函数：

```typescript
import {
  formatUserId,
  isValidSessionId,
  validateParticipants,
  isSessionExpired,
  getSessionTTL,
  createDebugLogger,
} from '@/sdk/matrix-private-chat';

// 格式化用户 ID
const userId = formatUserId('user:server.com'); // @user:server.com

// 验证会话 ID
const valid = isValidSessionId('uuid-string');

// 验证参与者列表
validateParticipants(['@user1:server.com', '@user2:server.com']);

// 检查会话是否过期
const expired = isSessionExpired('2024-01-01T00:00:00Z');

// 获取会话剩余时间
const ttl = getSessionTTL('2024-12-31T23:59:59Z'); // 秒

// 创建调试日志
const logger = createDebugLogger('MyComponent');
logger.debug('Debug message', { data: 'value' });
logger.info('Info message');
logger.warn('Warning message');
logger.error('Error message', error);
```

## 配置

### 环境变量

```bash
# .env
VITE_MATRIX_BASE_URL=https://matrix.cjystx.top
VITE_MATRIX_ACCESS_TOKEN=syt_...
VITE_MATRIX_USER_ID=@user:server.com
```

### 从环境变量创建客户端

```typescript
import { createFromEnv } from '@/sdk/matrix-private-chat';

const client = await createFromEnv();
```

## 最佳实践

### 1. 资源清理

在组件卸载时清理资源：

```typescript
import { onUnmounted } from 'vue';

onUnmounted(() => {
  client.privateChatV2.dispose();
});
```

### 2. 错误处理

始终使用 try-catch 处理错误：

```typescript
try {
  const session = await client.privateChatV2.createSession({ ... });
  // 使用 session
} catch (error) {
  if (error instanceof CreateSessionError) {
    // 处理创建会话错误
  }
}
```

### 3. 订阅管理

订阅后记得取消订阅：

```typescript
const unsubscribe = client.privateChatV2.subscribeToMessages(
  sessionId,
  handler
);

onUnmounted(() => {
  unsubscribe();
});
```

### 4. 缓存管理

在适当的时候清除缓存：

```typescript
// 创建会话后清除缓存
await client.privateChatV2.createSession({ ... });
client.privateChatV2.invalidateCache();

// 删除会话后清除缓存
await client.privateChatV2.deleteSession(sessionId);
client.privateChatV2.invalidateCache();
```

## 完整示例

```typescript
import { createEnhancedMatrixClient } from '@/sdk/matrix-private-chat';

// 1. 创建客户端
const client = await createEnhancedMatrixClient({
  baseUrl: 'https://matrix.cjystx.top',
  accessToken: 'syt_...',
  userId: '@user:server.com',
});

// 2. 创建会话
const { session_id } = await client.privateChatV2.createSession({
  participants: ['@alice:server.com'],
  session_name: 'Private Chat',
});

// 3. 发送消息
await client.privateChatV2.sendText(session_id, 'Hello!');

// 4. 订阅消息
const unsubscribe = client.privateChatV2.subscribeToMessages(
  session_id,
  (message) => {
    console.log('New message:', message.content);
  }
);

// 5. 获取历史消息
const { messages } = await client.privateChatV2.getMessages({
  session_id,
  limit: 20,
});

// 6. 获取统计信息
const { stats } = await client.privateChatV2.getStats({ session_id });

// 7. 监听事件
client.privateChatV2.on('message.sent', ({ sessionId, messageId }) => {
  console.log('Message sent:', messageId);
});

// 8. 清理
unsubscribe();
client.privateChatV2.dispose();
```

## 集成示例

### 与 Pinia Store 集成

```typescript
// stores/privateChat.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getEnhancedMatrixClient } from '@/integrations/matrix/client';

export const usePrivateChatStore = defineStore('privateChat', () => {
  const sessions = ref<PrivateChatSession[]>([]);

  async function fetchSessions() {
    const client = await getEnhancedMatrixClient();
    const response = await client.privateChatV2.listSessions();
    sessions.value = response.sessions || [];
  }

  async function createSession(options: CreateSessionOptions) {
    const client = await getEnhancedMatrixClient();
    const response = await client.privateChatV2.createSession(options);
    await fetchSessions(); // 刷新列表
    return response;
  }

  return {
    sessions,
    fetchSessions,
    createSession,
  };
});
```

## 支持

如有问题，请参考：
- [PrivateChat API 文档](../../docs/matrix-sdk/12-private-chat.md)
- [Friends SDK](../matrix-friends/README.md) - 相同架构的参考实现
- [优化方案](../../docs/matrix-sdk/PRIVATE_CHAT_SDK_OPTIMIZATION_PLAN.md)
