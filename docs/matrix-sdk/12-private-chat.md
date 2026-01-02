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

## 获取 PrivateChatClient

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
const session = await privateChat.createSession({
    participants: ["@alice:matrix.org"],
    session_name: "私聊讨论",
    ttl_seconds: 3600
});

console.log("会话ID:", session.session_id);
console.log("过期时间:", session.expires_at);
```

**参数:**
```typescript
interface CreateSessionOptions {
    participants: string[];      // 参与者列表 (必需)
    session_name?: string;       // 会话名称
    ttl_seconds?: number;        // 会话生存时间（秒）
}
```

**返回值:**
```typescript
Promise<PrivateChatSession>  // 返回创建的会话对象
```

**注意**: 当前用户会自动添加到参与者列表中。

---

### 3. 发送消息

向私聊会话发送消息。

```typescript
// 发送文本消息
const messageId = await privateChat.sendMessage({
    session_id: "session-123",
    content: "这是一条私密消息",
    type: "text"
});

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

获取会话中的消息列表。

```typescript
// 获取最新消息
const messages = await privateChat.getMessages({
    session_id: "session-123",
    limit: 50
});

// 分页获取
const page1 = await privateChat.getMessages({
    session_id: "session-123",
    limit: 50,
    before: "msg-456"  // 获取此消息之前的消息
});
```

**参数:**
```typescript
interface GetMessagesOptions {
    session_id: string;      // 会话 ID (必需)
    limit?: number;         // 每页数量 (默认: 10)
    before?: string;        // 获取此消息 ID 之前的消息
}
```

**返回值:**
```typescript
type PrivateChatMessage[] = Array<{
    message_id: string;      // 消息 ID
    session_id: string;      // 会话 ID
    sender_id: string;       // 发送者用户 ID
    content: string;         // 消息内容
    type: "text" | "image" | "file" | "audio" | "video";  // 消息类型
    created_at: string;      // 创建时间 (ISO 8601)
}>;
```

---

### 5. 删除会话

删除私聊会话。

```typescript
await privateChat.deleteSession("session-123");
console.log("会话已删除");
```

**参数:**
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `sessionId` | `string` | 是 | 会话 ID |

---

### 6. 获取单个会话

获取缓存的会话对象。

```typescript
const session = privateChat.getSession("session-123");

if (session) {
    console.log("会话名称:", session.session_name);
} else {
    console.log("会话不存在");
}
```

---

### 7. 检查会话存在

检查指定会话是否存在。

```typescript
const exists = await privateChat.hasSession("session-123");

if (exists) {
    console.log("会话存在");
} else {
    console.log("会话不存在");
}
```

---

### 8. 订阅消息

订阅会话的新消息（自动轮询）。

```typescript
const unsubscribe = privateChat.subscribeToMessages(
    "session-123",
    (message) => {
        console.log("收到新消息:", message.content);
    }
);

// 取消订阅
unsubscribe();
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

**轮询机制**: PrivateChatClient 每 3 秒自动轮询新消息。

---

### 9. 清除缓存

清除会话缓存。

```typescript
privateChat.invalidateCache();
// 下次调用 listSessions 时将重新从服务器获取
```

---

### 10. 清理资源

清理所有轮询和缓存。

```typescript
privateChat.dispose();
// 停止所有轮询
// 清除所有缓存
// 移除所有事件监听器
```

---

## 事件系统

PrivateChatClient 继承自 EventEmitter，支持监听私聊相关事件。

```typescript
import { PrivateChatClient } from "matrix-js-sdk";

// 监听会话创建事件
privateChat.on("session.created", (session) => {
    console.log("会话已创建:", session.session_id);
});

// 监听会话删除事件
privateChat.on("session.deleted", (data) => {
    console.log("会话已删除:", data.sessionId);
});

// 监听消息接收事件
privateChat.on("message.received", (message) => {
    console.log("收到新消息:", message.content);
});

// 监听消息发送事件
privateChat.on("message.sent", (data) => {
    console.log("消息已发送:", data.messageId);
});
```

**可用事件:**
| 事件名 | 数据 | 描述 |
|--------|------|------|
| `session.created` | 会话对象 | 创建会话后触发 |
| `session.deleted` | `{ sessionId, session }` | 删除会话后触发 |
| `message.received` | 消息对象 | 收到新消息时触发 |
| `message.sent` | `{ sessionId, messageId }` | 发送消息后触发 |

---

## 完整使用示例

### 创建会话并发送消息

```typescript
import { MatrixClient } from "matrix-js-sdk";

const client = new MatrixClient("https://matrix.cjystx.top");
await client.login("m.login.password", {
    user: "username",
    password: "password"
});

const privateChat = client.privateChatV2;

// 1. 创建会话
async function createSession(participants: string[], name: string) {
    try {
        const session = await privateChat.createSession({
            participants: participants,
            session_name: name,
            ttl_seconds: 3600  // 1小时后过期
        });

        console.log(`会话 "${name}" 已创建`);
        console.log(`会话ID: ${session.session_id}`);
        console.log(`参与者: ${session.participants.join(", ")}`);

        return session;
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
const session = await createSession(
    ["@alice:matrix.org"],
    "机密讨论"
);

await sendMessage(
    session.session_id,
    "这是一条私密消息"
);
```

### 获取和显示消息

```typescript
// 获取会话消息
async function getSessionMessages(sessionId: string) {
    try {
        const messages = await privateChat.getMessages({
            session_id: sessionId,
            limit: 50
        });

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

    while (hasMore) {
        const messages = await privateChat.getMessages({
            session_id: sessionId,
            limit: 50,
            before
        });

        // 处理消息
        console.log(`加载了 ${messages.length} 条消息`);

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
        participants: ["@alice:matrix.org"]
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
