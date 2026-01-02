# 私密聊天功能文档

> Matrix JS SDK 39.1.3 企业功能 - 完整 API 参考

## 概述

私密聊天 (Private Chat) 是 matrix-js-sdk 39.1.3 的企业功能之一，提供了端到端加密的临时会话能力，支持阅后即焚、消息自毁等增强隐私功能。

## 功能特性

- ✅ 创建临时私密会话
- ✅ 阅后即焚消息
- ✅ 消息自毁定时器
- ✅ 端到端加密
- ✅ 会话过期自动清理
- ✅ 已读状态管理
- ✅ 多种消息类型支持

## 获取私密聊天管理器

```typescript
import * as sdk from "matrix-js-sdk";

const client = sdk.createClient({
    baseUrl: "https://matrix.example.com",
    accessToken: "your_access_token",
    userId: "@user:example.com"
});

// 获取私密聊天管理器
const privateChat = client.privateChat;
```

## API 参考

### 1. 创建私密会话

创建一个新的临时私密聊天会话。

```typescript
const session = await client.privateChat.createPrivateChat(
    ["@alice:example.com", "@bob:example.com"],  // 参与者
    {
        session_name: "机密讨论",
        ttl_seconds: 3600,       // 会话1小时后过期
        auto_delete: true,        // 过期后自动删除
        read_only: false
    }
);

console.log("会话ID:", session.session_id);
console.log("过期时间:", session.expires_at);
```

**参数:**
```typescript
interface PrivateChatOptions {
    session_name?: string;   // 会话名称
    ttl_seconds?: number;    // 会话生存时间（秒），默认86400（24小时）
    auto_delete?: boolean;   // 过期后自动删除，默认false
    read_only?: boolean;     // 是否只读，默认false
}
```

**返回值:**
```typescript
interface CreatePrivateChatResponse {
    session_id: string;          // 会话唯一ID
    session_name: string;        // 会话名称
    participants: string[];      // 参与者列表
    created_at: number;          // 创建时间戳
    expires_at: number;          // 过期时间戳
    auto_delete: boolean;        // 是否自动删除
    encryption_key_id: string;   // 加密密钥ID
}
```

**TTL 推荐:**
- `300` (5分钟) - 极敏感信息
- `1800` (30分钟) - 敏感讨论
- `3600` (1小时) - 一般私密对话
- `86400` (24小时) - 长期私密会话
- `604800` (7天) - 延迟敏感内容

### 2. 发送私密消息

向私密会话发送消息。

```typescript
// 发送普通文本消息
const msg1 = await client.privateChat.sendPrivateMessage(
    "session_123",
    "这是一条私密消息"
);

// 发送带TTL的消息（1分钟后自毁）
const msg2 = await client.privateChat.sendPrivateMessage(
    "session_123",
    "这条消息将在1分钟后自动销毁",
    {
        ttl_seconds: 60,
        burn_after_reading: true  // 阅后即焚
    }
);

// 发送文件
const msg3 = await client.privateChat.sendPrivateMessage(
    "session_123",
    "文件内容",
    {
        message_type: "file",
        file_url: "mxc://example.com/abc123",
        file_size: 1024000,
        ttl_seconds: 300
    }
);
```

**参数:**
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `sessionId` | `string` | 是 | 会话ID |
| `content` | `string` | 是 | 消息内容 |
| `options` | `PrivateMessageOptions` | 否 | 消息选项 |

**消息选项:**
```typescript
interface PrivateMessageOptions {
    message_type?: "text" | "file" | "image" | "audio" | "video";  // 消息类型
    ttl_seconds?: number;           // 消息生存时间（秒）
    burn_after_reading?: boolean;   // 阅后即焚，默认false
    file_url?: string;              // 文件URL (mxc://)
    file_size?: number;             // 文件大小（字节）
}
```

**返回值:**
```typescript
interface SendPrivateMessageResponse {
    message_id: string;         // 消息ID
    session_id: string;         // 会话ID
    content: string;            // 消息内容
    sent_at: number;            // 发送时间
    expires_at?: number;        // 过期时间（如果设置了TTL）
    burn_after_reading: boolean; // 是否阅后即焚
}
```

### 3. 获取私密消息

获取会话中的消息列表。

```typescript
// 获取最新消息
const messages = await client.privateChat.getPrivateMessages("session_123");

// 分页获取
const page1 = await client.privateChat.getPrivateMessages("session_123", {
    limit: 50,
    before: "msg_456"  // 获取此消息之前的消息
});

// 向前分页
const page2 = await client.privateChat.getPrivateMessages("session_123", {
    limit: 50,
    after: "msg_123"   // 获取此消息之后的消息
});
```

**参数:**
```typescript
interface GetMessagesOptions {
    limit?: number;      // 每页数量 (默认: 50)
    before?: string;     // 获取此消息ID之前的消息
    after?: string;      // 获取此消息ID之后的消息
}
```

**返回值:**
```typescript
interface PrivateMessagesResponse {
    messages: Array<{
        message_id: string;
        sender_id: string;
        content: string;
        message_type: string;
        sent_at: number;
        expires_at?: number;
        burn_after_reading: boolean;
        is_read: boolean;
    }>;
    total: number;           // 消息总数
    has_more: boolean;       // 是否有更多消息
    next_token?: string;     // 下一页标记
    prev_token?: string;     // 上一页标记
}
```

### 4. 获取用户会话列表

获取当前用户的所有私密会话。

```typescript
const sessions = await client.privateChat.getUserSessions();

console.log(`活跃会话: ${sessions.sessions.length}个`);

sessions.sessions.forEach(session => {
    const expires = new Date(session.expires_at);
    const remaining = Math.floor((expires.getTime() - Date.now()) / 1000 / 60);
    console.log(`${session.session_name}: ${remaining}分钟后过期`);
});
```

**返回值:**
```typescript
interface UserSessionsResponse {
    sessions: Array<{
        session_id: string;
        session_name: string;
        participants: string[];
        created_at: number;
        expires_at: number;
        auto_delete: boolean;
        message_count: number;
        unread_count: number;
    }>;
    total: number;
    active_count: number;  // 未过期的会话数
}
```

### 5. 标记消息已读

标记指定消息为已读状态。

```typescript
await client.privateChat.markMessageRead(
    "session_123",
    "msg_456"
);
```

**参数:**
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `sessionId` | `string` | 是 | 会话ID |
| `messageId` | `string` | 是 | 消息ID |

**返回值:**
```typescript
interface MarkReadResponse {
    success: boolean;
    read_at: number;
    message_id: string;
}
```

**注意**: 对于设置了 `burn_after_reading: true` 的消息，标记已读后消息将被立即销毁。

### 6. 设置消息自毁

设置消息的自毁时间。

```typescript
// 60秒后自毁
await client.privateChat.setMessageSelfDestruct(
    "session_123",
    "msg_456",
    60
);
```

**参数:**
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `sessionId` | `string` | 是 | 会话ID |
| `messageId` | `string` | 是 | 消息ID |
| `afterSeconds` | `number` | 是 | 多少秒后自毁 |

**返回值:**
```typescript
interface SelfDestructResponse {
    success: boolean;
    message_id: string;
    self_destruct_at: number;  // 自毁时间戳
}
```

## 完整使用示例

### 创建临时会话并发送消息

```typescript
import * as sdk from "matrix-js-sdk";

const client = sdk.createClient({
    baseUrl: "https://matrix.example.com",
    accessToken: "your_access_token",
    userId: "@user:example.com"
});

// 1. 创建1小时后过期的临时会话
async function createTemporarySession(participants: string[], name: string) {
    const session = await client.privateChat.createPrivateChat(
        participants,
        {
            session_name: name,
            ttl_seconds: 3600,      // 1小时后过期
            auto_delete: true,       // 自动删除
        }
    );

    console.log(`私密会话 "${name}" 已创建`);
    console.log(`会话ID: ${session.session_id}`);
    console.log(`过期时间: ${new Date(session.expires_at).toLocaleString()}`);

    return session;
}

// 2. 发送阅后即焚消息
async function sendBurnAfterReading(sessionId: string, content: string) {
    const message = await client.privateChat.sendPrivateMessage(
        sessionId,
        content,
        {
            burn_after_reading: true,
            ttl_seconds: 60  // 1分钟后自动销毁
        }
    );

    console.log(`阅后即焚消息已发送: ${message.message_id}`);
    return message;
}

// 3. 发送普通消息（5分钟后自毁）
async function sendSelfDestructMessage(sessionId: string, content: string) {
    const message = await client.privateChat.sendPrivateMessage(
        sessionId,
        content,
        {
            ttl_seconds: 300  // 5分钟后自毁
        }
    );

    console.log(`消息已发送，5分钟后自动销毁`);
    return message;
}

// 使用示例
const session = await createTemporarySession(
    ["@alice:example.com"],
    "机密讨论"
);

await sendBurnAfterReading(
    session.session_id,
    "这是一条阅后即焚的消息，阅读后立即销毁"
);

await sendSelfDestructMessage(
    session.session_id,
    "这条消息将在5分钟后自动销毁"
);
```

### 获取和显示消息

```typescript
// 获取会话消息
async function getSessionMessages(sessionId: string) {
    const response = await client.privateChat.getPrivateMessages(sessionId);

    console.log(`=== 私密消息 (${response.total}条) ===`);

    for (const msg of response.messages) {
        const time = new Date(msg.sent_at).toLocaleTimeString();
        const sender = msg.sender_id.split(':')[0];
        const status = msg.is_read ? "已读" : "未读";
        const destruct = msg.expires_at
            ? ` [${Math.floor((msg.expires_at - Date.now()) / 1000)}秒后销毁]`
            : "";

        console.log(`[${time}] ${sender}: ${msg.content} ${status}${destruct}`);
    }

    return response;
}

// 分页加载消息
async function loadMessagesPaginated(sessionId: string) {
    let hasMore = true;
    let before: string | undefined;

    while (hasMore) {
        const response = await client.privateChat.getPrivateMessages(sessionId, {
            limit: 50,
            before
        });

        // 处理消息
        console.log(`加载了 ${response.messages.length} 条消息`);
        for (const msg of response.messages) {
            // 处理每条消息
        }

        hasMore = response.has_more;
        before = response.messages[response.messages.length - 1]?.message_id;
    }
}
```

### 会话管理

```typescript
// 显示所有活跃会话
async function displayActiveSessions() {
    const response = await client.privateChat.getUserSessions();

    console.log(`=== 活跃会话 (${response.active_count}/${response.total}) ===`);

    for (const session of response.sessions) {
        const now = Date.now();
        const expiresAt = session.expires_at;
        const remaining = Math.max(0, expiresAt - now);
        const minutes = Math.floor(remaining / 1000 / 60);

        const status = remaining > 0 ? `${minutes}分钟后过期` : "已过期";
        const unread = session.unread_count > 0 ? ` (${session.unread_count}条未读)` : "";

        console.log(`${session.session_name}: ${status}${unread}`);
        console.log(`  参与者: ${session.participants.join(", ")}`);
        console.log(`  消息数: ${session.message_count}`);
        console.log("");
    }

    return response;
}

// 标记所有消息为已读
async function markAllAsRead(sessionId: string) {
    const messages = await client.privateChat.getPrivateMessages(sessionId);

    for (const msg of messages.messages) {
        if (!msg.is_read) {
            await client.privateChat.markMessageRead(sessionId, msg.message_id);
            console.log(`已标记消息: ${msg.message_id}`);
        }
    }
}

// 设置消息自毁
async function setMessageDestructTimer(sessionId: string, messageId: string, seconds: number) {
    const result = await client.privateChat.setMessageSelfDestruct(
        sessionId,
        messageId,
        seconds
    );

    const destructTime = new Date(result.self_destruct_at);
    console.log(`消息将在 ${destructTime.toLocaleString()} 自动销毁`);

    return result;
}
```

### 文件消息

```typescript
// 上传并发送私密文件
async function sendPrivateFile(sessionId: string, file: File) {
    // 首先上传文件到媒体服务器
    const uploadResponse = await client.uploadContent(file.blob);

    // 发送私密文件消息
    const message = await client.privateChat.sendPrivateMessage(
        sessionId,
        file.name,
        {
            message_type: "file",
            file_url: uploadResponse.content_uri,
            file_size: file.size,
            ttl_seconds: 300,  // 5分钟后文件链接失效
            burn_after_reading: true
        }
    );

    console.log(`私密文件已发送: ${message.message_id}`);
    return message;
}

// 发送私密图片
async function sendPrivateImage(sessionId: string, imageBlob: Blob) {
    const uploadResponse = await client.uploadContent(imageBlob, {
        name: "image.jpg",
        type: "image/jpeg"
    });

    const message = await client.privateChat.sendPrivateMessage(
        sessionId,
        "[图片]",
        {
            message_type: "image",
            file_url: uploadResponse.content_uri,
            file_size: imageBlob.size,
            ttl_seconds: 600
        }
    );

    return message;
}
```

## 监听私密消息事件

```typescript
// 监听私密消息
client.on(sdk.ClientEvent.Event, async (event) => {
    if (event.getType() === "m.private.message") {
        const content = event.getContent();

        console.log(`收到私密消息:`, content);
        console.log(`会话ID: ${content.session_id}`);
        console.log(`发送者: ${event.getSender()}`);

        // 处理阅后即焚消息
        if (content.burn_after_reading && !content.is_read) {
            console.log("这是阅后即焚消息，阅读后将自动销毁");

            // 标记为已读（消息将自动销毁）
            await client.privateChat.markMessageRead(
                content.session_id,
                content.message_id
            );
        }
    }
});

// 监听会话过期
client.on(sdk.ClientEvent.Event, (event) => {
    if (event.getType() === "m.private.session.expired") {
        const content = event.getContent();
        console.log(`会话 "${content.session_name}" 已过期`);

        // 通知用户会话已过期
        // 清理本地缓存
    }
});
```

## 类型定义

```typescript
// 私密会话
interface PrivateChatSession {
    session_id: string;
    session_name: string;
    participants: string[];
    created_at: number;
    expires_at: number;
    auto_delete: boolean;
    message_count: number;
    unread_count: number;
}

// 私密消息
interface PrivateMessage {
    message_id: string;
    session_id: string;
    sender_id: string;
    content: string;
    message_type: "text" | "file" | "image" | "audio" | "video";
    sent_at: number;
    expires_at?: number;
    burn_after_reading: boolean;
    is_read: boolean;
}

// 会话选项
interface PrivateChatOptions {
    session_name?: string;
    ttl_seconds?: number;
    auto_delete?: boolean;
    read_only?: boolean;
}

// 消息选项
interface PrivateMessageOptions {
    message_type?: "text" | "file" | "image" | "audio" | "video";
    ttl_seconds?: number;
    burn_after_reading?: boolean;
    file_url?: string;
    file_size?: number;
}
```

## 安全注意事项

1. **加密**: 私密聊天使用端到端加密，消息内容只有参与者能够解密
2. **服务器无法读取**: 即使是服务器管理员也无法读取私密消息内容
3. **元数据**: 虽然消息内容加密，但会话存在等元数据可能可见
4. **密钥管理**: 加密密钥会在会话过期后自动销毁
5. **截图防护**: 无法防止对方截图或复制消息内容

## 错误处理

```typescript
// 处理会话过期
try {
    await client.privateChat.sendPrivateMessage(sessionId, content);
} catch (error) {
    if (error.errcode === "M_SESSION_EXPIRED") {
        console.error("会话已过期，请创建新会话");
    } else if (error.errcode === "M_SESSION_NOT_FOUND") {
        console.error("会话不存在");
    }
}

// 处理消息销毁
try {
    await client.privateChat.markMessageRead(sessionId, messageId);
} catch (error) {
    if (error.errcode === "M_MESSAGE_ALREADY_DESTROYED") {
        console.error("消息已被销毁");
    }
}
```

## 最佳实践

1. **TTL 设置**: 根据敏感程度设置合适的消息生存时间
2. **会话管理**: 及时清理过期会话，避免内存泄漏
3. **错误恢复**: 会话过期后创建新会话继续对话
4. **用户提示**: 清晰提示用户消息的阅后即焚特性
5. **本地缓存**: 可以缓存消息但要注意同步服务器状态

---

**文档版本**: 1.0.0
**SDK 版本**: 39.1.3
**最后更新**: 2024-12-28
