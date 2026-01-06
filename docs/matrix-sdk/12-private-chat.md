# 私聊增强功能文档

> Matrix JS SDK 39.1.3 - PrivateChatClient API 完整参考

## 概述

私聊增强 (PrivateChatClient) 是 matrix-js-sdk 39.1.3 的核心功能之一，提供了临时会话能力，支持会话过期、消息管理、轮询订阅等增强功能。

## 功能特性

- ✅ 创建临时私聊会话
- ✅ 会话列表管理（支持缓存）
- ✅ 发送多种类型消息
- ✅ 消息历史查询
- ✅ 会话过期自动清理
- ✅ 消息订阅轮询
- ✅ 事件系统支持

---

## SDK 集成指南

### 安装和配置

PrivateChat SDK 已集成到 HuLa 项目中，位于 `src/sdk/matrix-private-chat/`。

### 方式一：创建新的增强客户端

```typescript
import { createEnhancedMatrixClient } from '@/sdk/matrix-private-chat';

// 创建包含 PrivateChat API 的增强客户端
const client = await createEnhancedMatrixClient({
  baseUrl: 'https://matrix.cjystx.top',
  accessToken: 'syt_...',  // 从登录获取
  userId: '@user:server.com',
  deviceId: 'device-id'  // 可选
});

// 现在可以使用 PrivateChat API
const privateChat = client.privateChatV2;
```

### 方式二：扩展现有 Matrix 客户端

```typescript
import { extendMatrixClient, isPrivateChatApiEnabled } from '@/sdk/matrix-private-chat';
import { getEnhancedMatrixClient } from '@/integrations/matrix/client';

// 获取现有的 Matrix 客户端
const client = await getEnhancedMatrixClient();

// 检查是否已扩展
if (!isPrivateChatApiEnabled(client)) {
  // 扩展客户端以添加 PrivateChat API
  extendMatrixClient(client);
}

// 使用 PrivateChat API
const privateChat = client.privateChatV2;
```

### 方式三：在 Pinia Store 中集成

```typescript
// stores/privateChat.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getEnhancedMatrixClient } from '@/integrations/matrix/client';
import type { PrivateChatSession } from '@/sdk/matrix-private-chat';

export const usePrivateChatStore = defineStore('privateChat', () => {
  const sessions = ref<PrivateChatSession[]>([]);

  async function fetchSessions() {
    const client = await getEnhancedMatrixClient();
    const response = await client.privateChatV2.listSessions();
    sessions.value = response.sessions || [];
  }

  async function createSession(participants: string[], name?: string) {
    const client = await getEnhancedMatrixClient();
    const response = await client.privateChatV2.createSession({
      participants,
      session_name: name,
    });
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

### 类型导入

```typescript
// 导入所有类型
import type {
  PrivateChatSession,
  PrivateChatMessage,
  PrivateChatStats,
  CreateSessionOptions,
  SendMessageOptions,
  GetMessagesOptions,
  MessageHandler
} from '@/sdk/matrix-private-chat';

// 导入错误类
import {
  PrivateChatError,
  CreateSessionError,
  SendMessageError,
  SessionNotFoundError,
  DeleteSessionError,
  NetworkError
} from '@/sdk/matrix-private-chat';
```

### 错误处理示例

```typescript
import { CreateSessionError, PrivateChatError } from '@/sdk/matrix-private-chat';

try {
  const session = await privateChat.createSession({
    participants: ['@alice:cjystx.top'],
    session_name: 'Private Chat',
  });
  console.log('Session created:', session.session_id);
} catch (error) {
  if (error instanceof CreateSessionError) {
    console.error('创建会话失败:', error.message);
    console.error('状态码:', error.statusCode);
    console.error('响应体:', error.body);

    // 检查错误类型
    if (error.isInvalidParam()) {
      console.error('参数错误');
    } else if (error.isAuthError()) {
      console.error('认证失败');
    }
  } else if (error instanceof PrivateChatError) {
    console.error('PrivateChat 错误:', error.message);
  }
}
```

### 事件监听示例

```typescript
// 监听会话创建事件
privateChat.on('session.created', (session) => {
  console.log('新会话创建:', session.session_name);
});

// 监听消息接收事件
privateChat.on('message.received', (message) => {
  console.log('收到新消息:', message.content);
});

// 监听消息发送事件
privateChat.on('message.sent', ({ sessionId, messageId }) => {
  console.log('消息已发送:', messageId);
});

// 取消监听
const handler = (session) => console.log('Created:', session.session_id);
privateChat.on('session.created', handler);
// 后续...
privateChat.off('session.created', handler);
```

### 订阅新消息示例

```typescript
import { onUnmounted } from 'vue';

// 在组件中订阅消息
const unsubscribe = privateChat.subscribeToMessages(
  'session-uuid',
  (message) => {
    console.log('新消息:', {
      from: message.sender_id,
      content: message.content,
      type: message.type,
      time: message.created_at
    });
  }
);

// 组件卸载时取消订阅
onUnmounted(() => {
  unsubscribe();
});

// 或者手动取消
// unsubscribe();
```

### 资源清理

```typescript
// 在应用关闭或用户登出时清理资源
privateChat.dispose(); // 清理所有轮询、缓存和监听器
```

---

## 获取 PrivateChatClient

### 标准 Matrix JS SDK 方式

```typescript
import { MatrixClient } from "matrix-js-sdk";

const client = new MatrixClient("https://matrix.cjystx.top");
await client.login("m.login.password", {
    user: "username",
    password: "password"
});

// 获取私聊增强客户端
const privateChat = client.privateChatV2;
```

> **注意**: 上述方式适用于标准的 matrix-js-sdk。在 HuLa 项目中，推荐使用上面"SDK 集成指南"中的方式。

## API 参考

### 1. 获取会话列表

获取当前用户的所有私聊会话。

```typescript
// 获取所有会话
const sessions = await privateChat.listSessions();

// 强制刷新缓存
const freshSessions = await privateChat.listSessions();

console.log(`活跃会话: ${sessions.length}个`);
```

**返回值:**
```typescript
type PrivateChatSession[] = Array<{
    session_id: string;          // 会话唯一 ID
    participants: string[];       // 参与者列表
    session_name?: string;        // 会话名称
    created_by: string;           // 创建者用户 ID
    created_at: string;           // 创建时间 (ISO 8601)
    ttl_seconds?: number;         // 会话生存时间（秒）
    expires_at?: string;          // 过期时间 (ISO 8601)
    updated_at?: string;          // 更新时间 (ISO 8601)
}>;
```

---

### 2. 创建私聊会话

创建一个新的临时私聊会话。

```typescript
// 创建一个1小时后过期的私聊会话
const response = await privateChat.createSession({
    participants: ["@alice:cjystx.top", "@bob:cjystx.top"],
    session_name: "项目讨论",
    ttl_seconds: 3600  // 1小时后过期
});

console.log("会话ID:", response.session_id);
console.log("会话详情:", response.session);

// 响应格式
// {
//   status: "ok",
//   session_id: "uuid-string",
//   session: {
//     session_id: "uuid-string",
//     session_name: "项目讨论",
//     creator_id: "@user:cjystx.top",
//     participants: ["@alice:cjystx.top", "@bob:cjystx.top"],
//     created_at: "2024-01-01T00:00:00Z",
//     expires_at: "2024-01-01T01:00:00Z",
//     ttl_seconds: 3600
//   }
// }
```

**参数:**
```typescript
interface CreateSessionOptions {
    participants: string[];      // 参与者列表 (必需，最多10人)
    session_name?: string;       // 会话名称 (可选)
    creator_id?: string;        // 创建者 ID (可选，默认使用当前用户)
    ttl_seconds?: number;       // 会话生存时间-秒 (可选，默认0永不过期)
    auto_delete?: boolean;      // 是否自动删除会话 (可选)
}
```

**返回值:**
```typescript
Promise<CreateSessionResponse>
// {
//   status: "ok" | "error",
//   session_id?: string,
//   session?: PrivateChatSession,
//   error?: string  // 错误时返回
// }
```

**完整示例:**
```typescript
import { CreateSessionError } from '@/sdk/matrix-private-chat';

async function createPrivateChat() {
  try {
    const response = await privateChat.createSession({
      participants: ['@alice:cjystx.top'],
      session_name: 'Private Discussion',
      ttl_seconds: 7200, // 2小时
    });

    if (response.status === 'ok') {
      console.log('会话创建成功:', response.session_id);

      // 会话已自动缓存，可以直接访问
      const session = privateChat.getSession(response.session_id);
      console.log('参与者:', session?.participants);
    }
  } catch (error) {
    if (error instanceof CreateSessionError) {
      console.error('创建失败:', error.message);
      if (error.isInvalidParam()) {
        console.error('请检查参与者列表格式');
      }
    }
  }
}
```

**注意**:
- 参与者数量限制: 最少1人，最多10人
- 参与者ID格式: `@username:server.com`
- 当前用户会自动添加到参与者列表中

---

### 3. 发送消息

向私聊会话发送消息。

#### 方式一: 使用 sendMessage

```typescript
// 发送文本消息
const response = await privateChat.sendMessage({
    session_id: "session-123",
    content: "这是一条私密消息",
    type: "text"
});

console.log("消息ID:", response.message_id);
```

#### 方式二: 使用 sendText (便捷方法)

```typescript
// 快速发送文本消息
const messageId = await privateChat.sendText("session-123", "Hello!");

console.log("消息已发送:", messageId);
```

#### 发送不同类型的消息

```typescript
// 发送图片
await privateChat.sendMessage({
  session_id: "session-123",
  content: "base64_encoded_image_data",
  type: "image"
});

// 发送文件
await privateChat.sendMessage({
  session_id: "session-123",
  content: "file_url_or_data",
  type: "file"
});

// 发送语音
await privateChat.sendMessage({
  session_id: "session-123",
  content: "audio_data",
  type: "audio"
});

// 发送视频
await privateChat.sendMessage({
  session_id: "session-123",
  content: "video_data",
  type: "video"
});
```

**sendMessage 参数:**
```typescript
interface SendMessageOptions {
  session_id: string;          // 会话 ID (必需)
  content: string;             // 消息内容 (必需)
  sender_id?: string;          // 发送者 ID (可选，默认当前用户)
  type?: "text" | "image" | "file" | "audio" | "video";  // 消息类型 (默认 text)
  message_type?: string;       // 消息类型（后端字段）
  ttl_seconds?: number;        // 该条消息的生存时间-秒 (可选)
}
```

**返回值:**
```typescript
Promise<SendMessageResponse>
// {
//   status: "ok" | "error",
//   message_id?: string,
//   error?: string
// }
```

**完整示例:**
```typescript
import { SendMessageError } from '@/sdk/matrix-private-chat';

async function sendMessageWithRetry(sessionId: string, content: string) {
  try {
    // 发送消息
    const response = await privateChat.sendMessage({
      session_id: sessionId,
      content,
      type: 'text',
    });

    if (response.status === 'ok') {
      console.log('消息发送成功:', response.message_id);

      // 监听发送事件
      privateChat.once('message.sent', ({ sessionId, messageId }) => {
        console.log(`消息 ${messageId} 已发送到会话 ${sessionId}`);
      });
    }
  } catch (error) {
    if (error instanceof SendMessageError) {
      console.error('发送失败:', error.message);
      if (error.isNotFound()) {
        console.error('会话不存在，请先创建会话');
      }
    }
  }
}
```

// 使用便捷方法
const msgId = await privateChat.sendText("session-123", "快速发送文本");
```

**参数:**
```typescript
interface SendMessageOptions {
    session_id: string;         // 会话 ID (必需)
    content: string;            // 消息内容 (必需)
    type?: "text" | "image" | "file" | "audio" | "video";  // 消息类型
}
```

**返回值:**
```typescript
Promise<string>  // 返回消息 ID
```

---

### 4. 获取消息

获取会话中的消息列表，支持分页。

```typescript
// 获取最新50条消息
const response = await privateChat.getMessages({
    session_id: "session-123",
    limit: 50
});

console.log(`收到 ${response.messages?.length} 条消息`);

// 分页获取（向前翻页）
const page1 = await privateChat.getMessages({
    session_id: "session-123",
    limit: 50,
    before: "msg-456"  // 获取此消息之前的消息
});

// 带用户ID过滤
const userMessages = await privateChat.getMessages({
    session_id: "session-123",
    limit: 20,
    user_id: "@user:server.com"  // V2 API支持
});
```

**参数:**
```typescript
interface GetMessagesOptions {
    session_id: string;      // 会话 ID (必需)
    limit?: number;         // 每页数量 (默认: 50)
    before?: string;        // 获取此消息 ID 之前的消息（分页用）
    user_id?: string;       // 用户 ID (V2 API，可选)
}
```

**返回值:**
```typescript
Promise<GetMessagesResponse>
// {
//   status: "ok" | "error",
//   messages?: PrivateChatMessage[],
//   error?: string
// }

// PrivateChatMessage 格式
// {
//   message_id?: string;     // 消息 ID (V2)
//   id?: string;             // 消息 ID (V1)
//   session_id: string;      // 会话 ID
//   sender_id: string;       // 发送者用户 ID
//   content: string;         // 消息内容
//   type: "text" | "image" | "file" | "audio" | "video";
//   message_type?: string;   // 消息类型（后端字段）
//   created_at: string;      // 创建时间 (ISO 8601)
//   expires_at?: string;     // 过期时间 (可选)
// }
```

**完整示例 - 消息加载器:**
```typescript
class MessageLoader {
  private currentMessageId: string | null = null;
  private allMessages: PrivateChatMessage[] = [];

  async loadMore(sessionId: string, count: number = 50) {
    const response = await privateChat.getMessages({
      session_id: sessionId,
      limit: count,
      before: this.currentMessageId || undefined,
    });

    if (response.messages && response.messages.length > 0) {
      this.allMessages = [...this.allMessages, ...response.messages];
      this.currentMessageId = response.messages[0].message_id || null;
    }

    return response.messages || [];
  }

  getMessages() {
    return this.allMessages;
  }

  reset() {
    this.currentMessageId = null;
    this.allMessages = [];
  }
}
```

---

### 5. 删除会话

删除私聊会话及其所有消息。

```typescript
// 基础删除
await privateChat.deleteSession("session-123");
console.log("会话已删除");

// 带用户ID删除（V2 API）
await privateChat.deleteSession("session-123", {
  user_id: "@user:server.com"
});
```

**参数:**
```typescript
function deleteSession(
  sessionId: string,
  options?: {
    user_id?: string;  // 用户 ID (V2 API，可选)
  }
): Promise<OperationResponse>
```

**返回值:**
```typescript
Promise<OperationResponse>
// {
//   status: "ok" | "error",
//   error?: string
// }
```

**完整示例:**
```typescript
import { DeleteSessionError, SessionNotFoundError } from '@/sdk/matrix-private-chat';

async function deleteSessionWithCheck(sessionId: string) {
  try {
    // 检查会话是否存在
    if (!privateChat.hasSession(sessionId)) {
      console.log('会话不存在，可能已被删除');
      return;
    }

    // 获取会话信息（用于日志）
    const session = privateChat.getSession(sessionId);
    console.log(`删除会话: ${session?.session_name || sessionId}`);

    // 删除会话
    await privateChat.deleteSession(sessionId);

    // 会话已从缓存中移除，轮询也已停止
    console.log('会话已成功删除');

  } catch (error) {
    if (error instanceof SessionNotFoundError) {
      console.log('会话不存在');
    } else if (error instanceof DeleteSessionError) {
      console.error('删除失败:', error.message);
    }
  }
}
```

**注意**: 删除会话会：
- 从服务器删除会话和所有消息
- 从本地缓存中移除会话
- 停止该会话的所有轮询
- 触发 `session.deleted` 事件

---

### 6. 获取单个会话

从缓存中获取会话对象（不会发起网络请求）。

```typescript
const session = privateChat.getSession("session-123");

if (session) {
    console.log("会话名称:", session.session_name);
    console.log("参与者:", session.participants);
    console.log("创建时间:", session.created_at);

    // 检查是否过期
    if (session.expires_at) {
      const expiryDate = new Date(session.expires_at);
      const now = new Date();
      const isExpired = expiryDate < now;
      console.log("是否过期:", isExpired);
    }
} else {
    console.log("会话不存在或已过期");
}
```

**优势**:
- ✅ 同步调用，无需等待
- ✅ 无网络请求，速度快
- ✅ 自动过滤过期会话
- ✅ 返回 null 而非 undefined

---

### 7. 检查会话存在

快速检查会话是否存在于缓存中。

```typescript
// 基础用法
const exists = privateChat.hasSession("session-123");

if (exists) {
    console.log("会话存在且未过期");
} else {
    console.log("会话不存在、已过期或已被删除");
}

// 在循环中使用
const sessionIds = ["session-1", "session-2", "session-3"];
const existingSessions = sessionIds.filter(id => privateChat.hasSession(id));

console.log("存在的会话:", existingSessions);
```

**返回值:**
- `true`: 会话存在且未过期
- `false`: 会话不存在、已过期或已被删除

**性能提示**: 该方法是同步的，不会发起网络请求，适合在循环中使用。
} else {
    console.log("会话不存在");
}
```

---

---

### 8. 订阅消息

订阅会话的新消息（自动轮询机制）。

```typescript
// 基础订阅
const unsubscribe = privateChat.subscribeToMessages(
    "session-123",
    (message) => {
        console.log("收到新消息:", {
            from: message.sender_id,
            content: message.content,
            type: message.type,
            time: message.created_at
        });
    }
);

// 取消订阅
unsubscribe();
```

**工作原理:**
- ⏱️ 每 3 秒自动轮询一次新消息
- 🔍 只通知非自己发送的消息
- 🔄 自动管理轮询定时器
- 🧹 取消订阅时自动停止轮询

**完整示例 - Vue 组件集成:**
```typescript
import { onUnmounted, ref } from 'vue';
import type { PrivateChatMessage } from '@/sdk/matrix-private-chat';

export function usePrivateChatMessages(sessionId: string) {
  const messages = ref<PrivateChatMessage[]>([]);

  // 订阅新消息
  const unsubscribe = privateChat.subscribeToMessages(
    sessionId,
    (message) => {
      // 只添加新消息
      if (!messages.value.find(m => m.message_id === message.message_id)) {
        messages.value.push(message);
      }
    }
  );

  // 组件卸载时取消订阅
  onUnmounted(() => {
    unsubscribe();
  });

  return {
    messages
  };
}
```

**参数:**
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `sessionId` | `string` | 是 | 会话 ID |
| `handler` | `(message: PrivateChatMessage) => void` | 是 | 消息处理函数 |

**返回值:**
```typescript
() => void  // 取消订阅函数
```

---

### 9. 清除缓存

手动清除会话缓存，强制下次从服务器重新获取。

```typescript
// 创建会话后清除缓存
await privateChat.createSession({
  participants: ['@alice:cjystx.top']
});
privateChat.invalidateCache();

// 删除会话后清除缓存
await privateChat.deleteSession('session-123');
privateChat.invalidateCache();

// 手动刷新会话列表
privateChat.invalidateCache();
const freshSessions = await privateChat.listSessions();
```

**何时使用:**
- ✅ 创建新会话后
- ✅ 删除会话后
- ✅ 需要强制刷新时
- ❌ 不需要频繁调用（有自动缓存管理）

**缓存机制:**
- 📅 会话列表缓存 TTL: 5分钟
- ⏰ 过期会话自动过滤
- 🔄 自动刷新机制

---

### 10. 清理资源

完全清理所有资源（轮询、缓存、监听器）。

```typescript
// 应用关闭或用户登出时
privateChat.dispose();
```

**清理内容:**
- ✅ 停止所有轮询定时器
- ✅ 清除所有消息处理器
- ✅ 清除所有缓存数据
- ✅ 移除所有事件监听器

**使用场景:**
```typescript
import { onUnmounted } from 'vue';

// 在组件中使用
onUnmounted(() => {
  privateChat.dispose();
});

// 或在用户登出时
async function logout() {
  await performLogout();
  privateChat.dispose();
}
```

**注意**: 调用 `dispose()` 后，需要重新扩展客户端才能继续使用 PrivateChat API。

---

## 事件系统

PrivateChat SDK 继承自 `EventEmitter`，支持监听各种私聊事件。

### 可用事件

| 事件名 | 数据类型 | 描述 | 触发时机 |
|--------|---------|------|----------|
| `session.created` | `PrivateChatSession` | 会话创建 | 创建会话成功后 |
| `session.deleted` | `{ sessionId, session }` | 会话删除 | 删除会话成功后 |
| `message.received` | `PrivateChatMessage` | 消息接收 | 收到新消息时（轮询） |
| `message.sent` | `{ sessionId, messageId }` | 消息发送 | 发送消息成功后 |

### 事件监听示例

```typescript
import { onUnmounted } from 'vue';

// 1. 监听会话创建
privateChat.on("session.created", (session) => {
    console.log("新会话创建:", session.session_name);
    console.log("参与者:", session.participants);
});

// 2. 监听会话删除
privateChat.on("session.deleted", ({ sessionId, session }) => {
    console.log("会话已删除:", sessionId);
    if (session) {
        console.log("会话名称:", session.session_name);
    }
});

// 3. 监听消息接收（新消息通知）
privateChat.on("message.received", (message) => {
    console.log("收到新消息:", {
        from: message.sender_id,
        content: message.content,
        session: message.session_id
    });

    // 显示通知
    showNotification(`新消息来自 ${message.sender_id}`);
});

// 4. 监听消息发送
privateChat.on("message.sent", ({ sessionId, messageId }) => {
    console.log(`消息 ${messageId} 已发送到 ${sessionId}`);
});

// 5. 一次性监听（只触发一次）
privateChat.once("session.created", (session) => {
    console.log("这是第一次创建会话");
});

// 6. 取消监听
const messageHandler = (message) => console.log("Message:", message.content);
privateChat.on("message.received", messageHandler);

// 后续取消
// privateChat.off("message.received", messageHandler);

// 7. 组件卸载时清理
onUnmounted(() => {
    privateChat.removeAllListeners();
});
```

### 完整事件管理器

```typescript
class PrivateChatEventManager {
  private listeners: Array<() => void> = [];

  registerAll() {
    // 会话创建
    privateChat.on('session.created', this.handleSessionCreated);

    // 会话删除
    privateChat.on('session.deleted', this.handleSessionDeleted);

    // 消息接收
    privateChat.on('message.received', this.handleMessageReceived);

    // 消息发送
    privateChat.on('message.sent', this.handleMessageSent);
  }

  private handleSessionCreated = (session: PrivateChatSession) => {
    console.log('[Event] Session created:', session.session_id);
    // 更新UI、刷新列表等
  };

  private handleSessionDeleted = ({ sessionId, session }: { sessionId: string; session?: PrivateChatSession }) => {
    console.log('[Event] Session deleted:', sessionId);
    // 从UI移除、更新状态等
  };

  private handleMessageReceived = (message: PrivateChatMessage) => {
    console.log('[Event] Message received:', message.message_id);
    // 显示通知、更新消息列表等
  };

  private handleMessageSent = ({ sessionId, messageId }: { sessionId: string; messageId: string }) => {
    console.log('[Event] Message sent:', messageId);
    // 更新消息状态、标记已发送等
  };

  unregisterAll() {
    privateChat.removeAllListeners();
  }
}
```

---

## 完整使用示例

### 示例 1: 创建会话并发送消息

```typescript
import { createEnhancedMatrixClient } from '@/sdk/matrix-private-chat';

// 创建客户端
const client = await createEnhancedMatrixClient({
  baseUrl: 'https://matrix.cjystx.top',
  accessToken: 'your-access-token',
  userId: '@user:server.com',
});

const privateChat = client.privateChatV2;

// 1. 创建会话
async function createSession(participants: string[], name: string) {
    try {
        const response = await privateChat.createSession({
            participants: participants,
            session_name: name,
            ttl_seconds: 3600  // 1小时后过期
        });

        if (response.status === 'ok') {
            console.log(`会话 "${name}" 已创建`);
            console.log(`会话ID: ${response.session_id}`);
            console.log(`参与者: ${response.session?.participants.join(", ")}`);

            return response.session_id;
        }
    } catch (error) {
        console.error("创建会话失败:", error.message);
        throw error;
    }
}

// 2. 发送消息
async function sendMessage(sessionId: string, content: string) {
    try {
        const messageId = await privateChat.sendText(sessionId, content);
        console.log(`消息已发送: ${messageId}`);
        return messageId;
    } catch (error) {
        console.error("发送消息失败:", error.message);
        throw error;
    }
}

// 使用示例
const sessionId = await createSession(
    ["@alice:cjystx.top"],
    "机密讨论"
);

await sendMessage(sessionId, "这是一条私密消息");
```

### 示例 2: 获取和显示消息

```typescript
// 获取会话消息
async function getSessionMessages(sessionId: string) {
    try {
        const response = await privateChat.getMessages({
            session_id: sessionId,
            limit: 50
        });

        const messages = response.messages || [];

        console.log(`=== 消息 (${messages.length}条) ===`);

        for (const msg of messages) {
            const time = new Date(msg.created_at).toLocaleTimeString();
            const sender = msg.sender_id.split(':')[0];

            console.log(`[${time}] ${sender}: ${msg.content}`);
        }

        return messages;
    } catch (error) {
        console.error("获取消息失败:", error.message);
        return [];
    }
}

// 分页加载消息
async function loadMessagesPaginated(sessionId: string) {
    let hasMore = true;
    let before: string | undefined;
    let allMessages: PrivateChatMessage[] = [];

    while (hasMore) {
        const response = await privateChat.getMessages({
            session_id: sessionId,
            limit: 50,
            before
        });

        const messages = response.messages || [];
        allMessages = [...allMessages, ...messages];

        // 处理消息
        console.log(`加载了 ${messages.length} 条消息`);

        // 如果消息少于limit，说明没有更多了
        if (messages.length < 50) {
            hasMore = false;
        } else if (messages.length > 0) {
            // 设置下一页的锚点
            before = messages[messages.length - 1].message_id;
        } else {
            hasMore = false;
        }
    }

    return allMessages;
}
```

### 示例 3: 完整的私聊组件

```typescript
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { getEnhancedMatrixClient } from '@/integrations/matrix/client';
import type { PrivateChatSession, PrivateChatMessage } from '@/sdk/matrix-private-chat';

// 状态
const sessions = ref<PrivateChatSession[]>([]);
const currentSession = ref<PrivateChatSession | null>(null);
const messages = ref<PrivateChatMessage[]>([]);
const newMessage = ref('');
const loading = ref(false);

// 取消订阅函数
let unsubscribeMessages: (() => void) | null = null;

// 加载会话列表
async function loadSessions() {
  loading.value = true;
  try {
    const client = await getEnhancedMatrixClient();
    const response = await client.privateChatV2.listSessions();
    sessions.value = response.sessions || [];
  } finally {
    loading.value = false;
  }
}

// 选择会话
async function selectSession(session: PrivateChatSession) {
  currentSession.value = session;

  // 加载历史消息
  const client = await getEnhancedMatrixClient();
  const response = await client.privateChatV2.getMessages({
    session_id: session.session_id,
    limit: 50
  });
  messages.value = response.messages || [];

  // 订阅新消息
  if (unsubscribeMessages) {
    unsubscribeMessages();
  }

  unsubscribeMessages = client.privateChatV2.subscribeToMessages(
    session.session_id,
    (message) => {
      messages.value.push(message);
    }
  );
}

// 发送消息
async function sendMessage() {
  if (!currentSession.value || !newMessage.value.trim()) {
    return;
  }

  const content = newMessage.value;
  newMessage.value = '';

  try {
    const client = await getEnhancedMatrixClient();
    await client.privateChatV2.sendText(currentSession.value.session_id, content);
  } catch (error) {
    console.error('发送失败:', error);
    newMessage.value = content; // 恢复内容
  }
}

// 组件挂载
onMounted(async () => {
  await loadSessions();

  // 监听会话创建事件
  const client = await getEnhancedMatrixClient();
  client.privateChatV2.on('session.created', async (session) => {
    await loadSessions();
  });
});

// 组件卸载
onUnmounted(() => {
  if (unsubscribeMessages) {
    unsubscribeMessages();
  }
});
</script>

<template>
  <div class="private-chat">
    <!-- 会话列表 -->
    <div class="session-list">
      <h3>私聊会话</h3>
      <div v-if="loading">加载中...</div>
      <div
        v-for="session in sessions"
        :key="session.session_id"
        class="session-item"
        @click="selectSession(session)"
      >
        <div class="session-name">{{ session.session_name || '未命名' }}</div>
        <div class="session-participants">
          {{ session.participants.join(', ') }}
        </div>
      </div>
    </div>

    <!-- 聊天区域 -->
    <div v-if="currentSession" class="chat-area">
      <div class="messages">
        <div
          v-for="message in messages"
          :key="message.message_id"
          class="message"
        >
          <span class="sender">{{ message.sender_id }}:</span>
          <span class="content">{{ message.content }}</span>
        </div>
      </div>

      <div class="input-area">
        <input
          v-model="newMessage"
          @keyup.enter="sendMessage"
          placeholder="输入消息..."
        />
        <button @click="sendMessage">发送</button>
      </div>
    </div>
  </div>
</template>
```

### 示例 4: 错误处理和重试

```typescript
import {
  PrivateChatError,
  CreateSessionError,
  SendMessageError,
  isPrivateChatApiEnabled,
  extendMatrixClient
} from '@/sdk/matrix-private-chat';

// 带重试的会话创建
async function createSessionWithRetry(
  participants: string[],
  maxRetries = 3
): Promise<string | null> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const client = await getEnhancedMatrixClient();

      // 确保客户端已扩展
      if (!isPrivateChatApiEnabled(client)) {
        extendMatrixClient(client);
      }

      const response = await client.privateChatV2.createSession({
        participants,
        session_name: 'Private Chat',
      });

      if (response.status === 'ok') {
        console.log(`会话创建成功 (尝试 ${i + 1}/${maxRetries})`);
        return response.session_id || null;
      }
    } catch (error) {
      if (error instanceof CreateSessionError) {
        console.error(`创建失败 (尝试 ${i + 1}/${maxRetries}):`, error.message);

        // 如果是认证错误，不重试
        if (error.isAuthError()) {
          console.error('认证失败，请重新登录');
          return null;
        }

        // 如果是最后一次尝试，抛出错误
        if (i === maxRetries - 1) {
          throw error;
        }

        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      } else {
        throw error;
      }
    }
  }

  return null;
}

// 使用示例
try {
  const sessionId = await createSessionWithRetry(['@alice:cjystx.top']);
  if (sessionId) {
    console.log('会话创建成功:', sessionId);
  } else {
    console.log('会话创建失败');
  }
} catch (error) {
  console.error('无法创建会话:', error);
}
```

### 示例 5: 消息统计

```typescript
// 获取会话统计信息
async function getSessionStats(sessionId: string) {
  try {
    const client = await getEnhancedMatrixClient();
    const response = await client.privateChatV2.getStats({
      session_id: sessionId
    });

    if (response.status === 'ok' && response.stats) {
      const stats = response.stats;

      console.log(`=== 会话统计 ===`);
      console.log(`消息总数: ${stats.message_count}`);
      console.log(`参与者数量: ${stats.participant_count}`);
      console.log(`最后活跃: ${new Date(stats.last_activity).toLocaleString()}`);

      return stats;
    }
  } catch (error) {
    console.error('获取统计失败:', error);
  }

  return null;
}
```

---

## 最佳实践

### 1. 资源管理

```typescript
import { onUnmounted } from 'vue';

// ✅ 正确：在组件卸载时清理
onUnmounted(() => {
  privateChat.dispose();
});

// ❌ 错误：忘记清理可能导致内存泄漏
```

### 2. 错误处理

```typescript
// ✅ 正确：使用具体的错误类型
try {
  await privateChat.createSession({ participants });
} catch (error) {
  if (error instanceof CreateSessionError) {
    // 处理特定错误
  }
}

// ❌ 错误：过于宽泛的错误处理
try {
  await privateChat.createSession({ participants });
} catch (error) {
  // 捕获所有错误但不处理
}
```

### 3. 类型安全

```typescript
// ✅ 正确：使用类型导入
import type { PrivateChatSession } from '@/sdk/matrix-private-chat';
const session: PrivateChatSession = { ... };

// ❌ 错误：使用 any
const session: any = { ... };
```

### 4. 缓存管理

```typescript
// ✅ 正确：在适当的时机清除缓存
await privateChat.createSession({ ... });
privateChat.invalidateCache();

// ❌ 错误：过于频繁地清除缓存
privateChat.invalidateCache(); // 不要每次都调用
```

---

## 常见问题

### Q: 会话ID格式是什么？

A: 会话ID是 UUID 格式，例如：`550e8400-e29b-41d4-a716-446655440000`

### Q: 消息轮询会消耗大量资源吗？

A: 不会。SDK 采用智能轮询策略：
- 只在有订阅时才轮询
- 取消订阅立即停止
- 每3秒一次，间隔合理
- 过滤自己的消息，减少处理

### Q: 如何判断会话是否过期？

A: 检查 `session.expires_at` 字段：

```typescript
function isSessionExpired(session: PrivateChatSession): boolean {
  if (!session.expires_at) return false;
  return new Date(session.expires_at) < new Date();
}
```

### Q: 缓存会自动更新吗？

A: 是的，缓存有5分钟的TTL。你也可以手动调用 `invalidateCache()` 强制刷新。

---

**文档版本**: 2.1.0
**SDK 版本**: 39.1.3
**最后更新**: 2026-01-06
**SDK 状态**: ✅ 已实现并测试

**相关文档**:
- [PrivateChat SDK 优化方案](../../docs/matrix-sdk/PRIVATE_CHAT_SDK_OPTIMIZATION_PLAN.md)
- [PrivateChat SDK README](../../src/sdk/matrix-private-chat/README.md)
- [PrivateChat SDK 优化报告](../../src/sdk/matrix-private-chat/OPTIMIZATION_REPORT.md)

        if (messages.length > 0) {
            hasMore = false;  // 根据实际情况判断
            before = messages[messages.length - 1].message_id;
        } else {
            hasMore = false;
        }
    }
}
```

### 消息订阅

```typescript
// 订阅新消息
async function subscribeToNewMessages(sessionId: string) {
    const unsubscribe = privateChat.subscribeToMessages(
        sessionId,
        (message) => {
            console.log("收到新消息:", message.content);
            console.log("发送者:", message.sender_id);
            console.log("时间:", new Date(message.created_at).toLocaleString());

            // 显示通知
            showNotification(`新消息: ${message.content}`);
        }
    );

    // 返回取消订阅函数
    return unsubscribe;
}

// 使用示例
const unsubscribe = await subscribeToNewMessages("session-123");

// 稍后取消订阅
// unsubscribe();
```

### 会话管理

```typescript
// 显示所有活跃会话
async function displayActiveSessions() {
    try {
        const sessions = await privateChat.listSessions();

        console.log(`=== 活跃会话 (${sessions.length}个) ===`);

        for (const session of sessions) {
            const name = session.session_name || "未命名";
            const expires = session.expires_at
                ? new Date(session.expires_at).toLocaleString()
                : "永不过期";

            console.log(`${name} (${session.session_id})`);
            console.log(`  参与者: ${session.participants.join(", ")}`);
            console.log(`  过期时间: ${expires}`);
            console.log("");
        }
    } catch (error) {
        console.error("获取会话列表失败:", error.message);
    }
}

// 获取会话详情
async function getSessionDetails(sessionId: string) {
    try {
        const session = await privateChat.getSession(sessionId);

        if (session) {
            console.log("会话名称:", session.session_name);
            console.log("创建者:", session.created_by);
            console.log("参与者:", session.participants);
            console.log("创建时间:", new Date(session.created_at).toLocaleString());
            if (session.expires_at) {
                console.log("过期时间:", new Date(session.expires_at).toLocaleString());
            }
        } else {
            console.log("会话不存在");
        }
    } catch (error) {
        console.error("获取会话详情失败:", error.message);
    }
}

// 删除会话
async function deleteSession(sessionId: string) {
    try {
        await privateChat.deleteSession(sessionId);
        console.log(`会话 ${sessionId} 已删除`);
    } catch (error) {
        console.error("删除会话失败:", error.message);
    }
}
```

### 监听私聊事件

```typescript
// 设置事件监听
function setupPrivateChatListeners() {
    // 监听会话创建
    privateChat.on("session.created", (session) => {
        console.log("新会话已创建:", session.session_id);
        console.log("参与者:", session.participants);
        // 刷新会话列表
        displayActiveSessions();
    });

    // 监听会话删除
    privateChat.on("session.deleted", (data) => {
        console.log("会话已删除:", data.sessionId);
        // 刷新会话列表
        displayActiveSessions();
    });

    // 监听消息接收
    privateChat.on("message.received", (message) => {
        console.log("收到新消息:", message.content);
        console.log("会话ID:", message.session_id);
        console.log("发送者:", message.sender_id);
        // 显示通知
        showNotification(`新消息: ${message.content}`);
    });

    // 监听消息发送
    privateChat.on("message.sent", (data) => {
        console.log("消息已发送:", data.messageId);
        console.log("会话ID:", data.sessionId);
    });
}

function showNotification(message: string) {
    // 实现通知逻辑
    console.log("通知:", message);
}
```

---

## 类型定义

完整的 TypeScript 类型定义在 `src/@types/private-chat.ts`。

```typescript
// 私聊会话
interface PrivateChatSession {
    session_id: string;          // 会话唯一 ID
    participants: string[];       // 参与者列表
    session_name?: string;        // 会话名称
    created_by: string;           // 创建者用户 ID
    created_at: string;           // 创建时间 (ISO 8601)
    ttl_seconds?: number;         // 会话生存时间（秒）
    expires_at?: string;          // 过期时间 (ISO 8601)
    updated_at?: string;          // 更新时间 (ISO 8601)
}

// 私聊消息
interface PrivateChatMessage {
    message_id: string;          // 消息 ID
    session_id: string;           // 会话 ID
    sender_id: string;            // 发送者用户 ID
    content: string;              // 消息内容
    type: "text" | "image" | "file" | "audio" | "video";  // 消息类型
    created_at: string;           // 创建时间 (ISO 8601)
}

// 创建会话选项
interface CreateSessionOptions {
    participants: string[];       // 参与者列表 (必需)
    session_name?: string;        // 会话名称
    ttl_seconds?: number;         // 会话生存时间（秒）
}

// 发送消息选项
interface SendMessageOptions {
    session_id: string;           // 会话 ID (必需)
    content: string;              // 消息内容 (必需)
    type?: "text" | "image" | "file" | "audio" | "video";  // 消息类型
}

// 获取消息选项
interface GetMessagesOptions {
    session_id: string;           // 会话 ID (必需)
    limit?: number;               // 每页数量 (默认: 10)
    before?: string;              // 获取此消息 ID 之前的消息
}
```

---

## 错误处理

PrivateChatClient 提供了详细的错误类型。

```typescript
import {
    PrivateChatError,
    CreateSessionError,
    SendMessageError,
    SessionNotFoundError,
    DeleteSessionError
} from "matrix-js-sdk";

try {
    await privateChat.createSession({
        participants: ["@alice:cjystx.top"]
    });
} catch (error) {
    if (error instanceof CreateSessionError) {
        console.error("创建会话失败:", error.message);
    } else if (error instanceof SessionNotFoundError) {
        console.error("会话不存在:", error.message);
    } else if (error instanceof SendMessageError) {
        console.error("发送消息失败:", error.message);
    } else if (error instanceof PrivateChatError) {
        console.error("私聊系统错误:", error.message);
    }
}
```

**错误类型:**
| 错误类 | 触发场景 |
|--------|----------|
| `PrivateChatError` | 基础错误类 |
| `CreateSessionError` | 创建会话失败 |
| `SendMessageError` | 发送消息失败 |
| `SessionNotFoundError` | 会话不存在 |
| `DeleteSessionError` | 删除会话失败 |

---

## 后端 API 端点

PrivateChatClient 使用以下后端 API 端点（RESTful 风格）：

| 功能 | 端点 | 方法 |
|------|------|------|
| 会话列表 | `/_synapse/client/enhanced/private/sessions` | GET |
| 获取会话详情 | `/_synapse/client/enhanced/private/sessions/:id` | GET |
| 获取消息 | `/_synapse/client/enhanced/private/sessions/:id/messages` | GET |
| 创建会话 | `/_synapse/client/enhanced/private/sessions` | POST |
| 发送消息 | `/_synapse/client/enhanced/private/sessions/:id/messages` | POST |
| 删除会话 | `/_synapse/client/enhanced/private/sessions/:id` | DELETE |

**后端要求**:
- Synapse 1.140.0 Enhanced Module v1.0.2+
- 支持 v1 RESTful API 路径

---

## 轮询机制

PrivateChatClient 实现了自动轮询机制来获取新消息。

### 轮询配置

```typescript
class PrivateChatClient {
    private readonly POLL_INTERVAL_MS = 3000;  // 轮询间隔：3秒
}
```

### 订阅消息

```typescript
const unsubscribe = privateChat.subscribeToMessages(
    "session-123",
    (message) => {
        console.log("新消息:", message.content);
    }
);

// 取消订阅时自动停止轮询
unsubscribe();
```

### 轮询行为

1. **自动启动**: 首次订阅时自动开始轮询
2. **自动停止**: 取消订阅时自动停止轮询
3. **智能过滤**: 只通知非自己发送的新消息
4. **错误处理**: 轮询错误不会抛出异常

---

## 缓存机制

PrivateChatClient 实现了会话缓存。

### 缓存使用

```typescript
// 使用缓存（默认）
const sessions = await privateChat.listSessions();

// 强制刷新
const freshSessions = await privateChat.listSessions();

// 清除缓存
privateChat.invalidateCache();
```

### 缓存策略

- **会话列表**: 自动缓存，支持手动刷新
- **消息历史**: 不缓存，每次重新获取
- **会话详情**: 使用缓存数据

---

## 最佳实践

1. **会话管理**: 及时清理不需要的会话，释放资源
2. **消息订阅**: 使用完毕后取消订阅，避免不必要的轮询
3. **错误处理**: 妥善处理各种错误情况，提供友好的用户提示
4. **Matrix ID 验证**: SDK 自动验证 Matrix ID 格式
5. **资源清理**: 组件卸载时调用 `dispose()` 清理资源

---

## Vue 3 集成示例

```vue
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { MatrixClient } from "matrix-js-sdk";

const client = new MatrixClient("https://matrix.cjystx.top");
const privateChat = client.privateChatV2;

const sessions = ref<PrivateChatSession[]>([]);
const messages = ref<PrivateChatMessage[]>([]);
const currentSessionId = ref<string>();
let unsubscribe: (() => void) | undefined;

onMounted(async () => {
    // 加载会话列表
    sessions.value = await privateChat.listSessions();

    // 如果有当前会话，订阅消息
    if (currentSessionId.value) {
        subscribeToMessages(currentSessionId.value);
    }
});

onUnmounted(() => {
    // 清理资源
    if (unsubscribe) {
        unsubscribe();
    }
});

async function selectSession(sessionId: string) {
    currentSessionId.value = sessionId;

    // 取消之前的订阅
    if (unsubscribe) {
        unsubscribe();
    }

    // 订阅新消息
    unsubscribe = subscribeToMessages(sessionId);

    // 加载消息历史
    messages.value = await privateChat.getMessages({
        session_id: sessionId,
        limit: 50
    });
}

function subscribeToMessages(sessionId: string) {
    return privateChat.subscribeToMessages(sessionId, (message) => {
        messages.value.push(message);
    });
}

async function sendMessage(content: string) {
    if (!currentSessionId.value) return;

    await privateChat.sendText(currentSessionId.value, content);
}
</script>
```

---

## 导入

```typescript
// 导入客户端
import { MatrixClient } from "matrix-js-sdk";

// 导入类型
import type {
    PrivateChatSession,
    PrivateChatMessage,
    CreateSessionOptions,
    SendMessageOptions,
    GetMessagesOptions
} from "matrix-js-sdk";

// 导入错误类
import {
    PrivateChatError,
    CreateSessionError,
    SendMessageError,
    SessionNotFoundError
} from "matrix-js-sdk";

// 导入 PrivateChatClient
import { PrivateChatClient } from "matrix-js-sdk";
```

---

**文档版本**: 2.0.1
**SDK 版本**: 39.1.3
**最后更新**: 2026-01-02
# 私密聊天 (Private Chat) API 接口文档

**版本**: v1.1
**状态**: 生产可用
**适用对象**: SDK 开发人员、前端开发人员

---

## 1. 概述

私密聊天模块提供了一种独立于 Matrix 标准 Room 的轻量级、端到端加密会话机制。
其特点包括：
- **独立性**: 不依赖 Matrix Room 图谱，元数据独立存储。
- **安全性**: 设计上支持端到端加密（内容由客户端加密后传输，服务端仅存储密文）。
- **生命周期**: 支持 TTL (Time-To-Live) 和物理删除（阅后即焚）。

### 1.1 鉴权
所有接口均需携带 Matrix Access Token。
- **Header**: `Authorization: Bearer <access_token>`

### 1.2 接口风格说明
当前系统采用 **V1 (Action-based)** 与 **V2 (RESTful)** 混合模式：
- **写操作** (创建/发送/删除): 使用 **V1** 接口。
- **读操作** (列表/消息/统计): 推荐使用 **V2** 接口 (结构更清晰)，也可使用 V1。

---

## 2. API 详情

### 2.1 创建会话 (Create Session)
*   **用途**: 发起一个新的私密聊天会话。
*   **URL**: `POST /_synapse/client/private`
*   **Body**:
    ```json
    {
      "action": "create",
      "participants": ["@bob:cjystx.top"],  // 对方的 User ID
      "session_name": "Secret Chat",        // 会话名称 (可选)
      "creator_id": "@alice:cjystx.top",    // 创建者 ID (必填，需与 Token 对应)
      "ttl_seconds": 86400,                 // 消息存活秒数 (可选，默认 0 不销毁)
      "auto_delete": false                  // 是否自动销毁会话 (可选)
    }
    ```
*   **Response (200 OK)**:
    ```json
    {
      "status": "ok",
      "session_id": "5032ece5-29ae-473d-a5e9-b8ef78f1a086"
    }
    ```

### 2.2 发送消息 (Send Message)
*   **用途**: 向指定会话发送加密消息。
*   **URL**: `POST /_synapse/client/private`
*   **Body**:
    ```json
    {
      "action": "send",
      "session_id": "5032ece5-29ae-473d-a5e9-b8ef78f1a086",
      "sender_id": "@alice:cjystx.top",
      "content": "EncryptedPayloadString...", // 建议客户端加密后的 Base64 字符串
      "message_type": "text",                 // 消息类型 (text, image, etc.)
      "ttl_seconds": 3600                     // 该条消息的 TTL (可选)
    }
    ```
*   **Response (200 OK)**:
    ```json
    {
      "status": "ok",
      "message_id": "8f34a1a4-6e3d-470d-ba23-d467b0743963"
    }
    ```

### 2.3 获取会话列表 (List Sessions)
*   **用途**: 获取当前用户参与的所有活跃私密会话。
*   **方式 A (V2 REST - 推荐)**:
    *   **URL**: `GET /_synapse/client/enhanced/private_chat/v2/sessions`
    *   **Params**: `user_id=@alice:cjystx.top`
*   **方式 B (V1 Action)**:
    *   **URL**: `GET /_synapse/client/private`
    *   **Params**: `action=sessions&user_id=@alice:cjystx.top`
*   **Response (200 OK)**:
    ```json
    {
      "status": "ok",
      "sessions": [
        {
          "session_id": "5032ece5-...",
          "session_name": "Secret Chat",
          "creator_id": "@alice:cjystx.top",
          "participants": ["@alice:cjystx.top", "@bob:cjystx.top"],
          "created_at": "2026-01-06T06:54:48.609Z",
          "updated_at": "2026-01-06T06:54:48.637Z",
          "status": "active"
        }
      ]
    }
    ```

### 2.4 获取消息历史 (Get Messages)
*   **用途**: 分页拉取会话内的历史消息。
*   **方式 A (V2 REST - 推荐)**:
    *   **URL**: `GET /_synapse/client/enhanced/private_chat/v2/messages`
    *   **Params**:
        *   `session_id`: 会话 ID
        *   `user_id`: 当前用户 ID (用于鉴权)
        *   `limit`: 数量 (默认 50)
        *   `before`: 分页游标 (可选)
*   **方式 B (V1 Action)**:
    *   **URL**: `GET /_synapse/client/private`
    *   **Params**: `action=messages&session_id=...&user_id=...&limit=50`
*   **Response (200 OK)**:
    ```json
    {
      "status": "ok",
      "messages": [
        {
          "id": "8f34a1a4-...",
          "session_id": "5032ece5-...",
          "sender_id": "@alice:cjystx.top",
          "content": "EncryptedPayloadString...",
          "type": "text",
          "created_at": "2026-01-06T06:54:48.637Z",
          "expires_at": "2026-01-06T07:54:48.637Z"
        }
      ]
    }
    ```

### 2.5 获取会话统计 (Get Stats)
*   **用途**: 获取会话的消息数、成员数及最后活跃时间。
*   **方式 A (V2 REST - 推荐)**:
    *   **URL**: `GET /_synapse/client/enhanced/private_chat/v2/stats`
    *   **Params**: `session_id=...`
*   **Response (200 OK)**:
    ```json
    {
      "status": "ok",
      "stats": {
        "message_count": 15,
        "participant_count": 2,
        "last_activity": "2026-01-06T06:54:48.637Z"
      }
    }
    ```

### 2.6 删除会话 (Delete Session)
*   **用途**: 物理删除会话及其所有消息（双方均不可见）。
*   **URL**: `POST /_synapse/client/private`
*   **Body**:
    ```json
    {
      "action": "delete",
      "session_id": "5032ece5-...",
      "user_id": "@alice:cjystx.top"
    }
    ```
*   **Response (200 OK)**:
    ```json
    { "status": "ok" }
    ```

---

## 3. 前端/SDK 开发建议

### 3.1 端到端加密 (E2EE) 实现
后端对 `content` 字段内容不进行任何处理。前端应当：
1.  **会话密钥协商**: 利用 Matrix 账户的 `device_keys` 或 `OTK` (One-Time Keys) 在参与者间协商一个对称密钥 (Session Key)。
2.  **内容加密**: 发送前使用 Session Key 对文本/图片进行 AES-GCM 加密。
3.  **内容解密**: 接收后使用本地存储的 Session Key 解密展示。

### 3.2 本地存储
建议在客户端本地数据库 (如 IndexedDB, SQLite) 缓存：
- 会话列表 (`sessions`)
- 消息历史 (`messages`)
- 会话密钥 (`session_keys`)

### 3.3 轮询与实时性
由于私密聊天独立于 Matrix Sync 机制：
- **即时性**: 建议前端以固定间隔 (如 5-10s) 轮询 `messages` 接口获取新消息。
- **优化**: 利用 `stats` 接口的 `last_activity` 字段判断是否有更新，减少无效的消息拉取。

