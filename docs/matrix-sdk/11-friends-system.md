# 好友系统功能文档

> Matrix JS SDK 39.1.3 企业功能 - 完整 API 参考

## 概述

好友系统 (FriendSystem) 是 matrix-js-sdk 39.1.3 的企业功能之一，提供了完整的好友关系管理能力，包括好友请求、好友列表、好友分组等功能。

## 功能特性

- ✅ 发送/接受/拒绝好友请求
- ✅ 好友列表管理
- ✅ 好友分组分类
- ✅ 好友搜索
- ✅ 待处理请求管理
- ✅ 删除好友关系

## 获取好友管理器

```typescript
import * as sdk from "matrix-js-sdk";

const client = sdk.createClient({
    baseUrl: "https://matrix.example.com",
    accessToken: "your_access_token",
    userId: "@user:example.com"
});

// 获取好友系统管理器
const friends = client.friends;
```

## API 参考

### 1. 发送好友请求

向指定用户发送好友请求。

```typescript
await client.friends.sendFriendRequest(
    "@alice:example.com",  // 目标用户ID
    "Hi! Let's be friends"  // 可选的附言消息
);
```

**参数:**
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `userId` | `string` | 是 | Matrix 用户 ID (格式: `@user:server.com`) |
| `message` | `string` | 否 | 请求附言消息 |

**返回值:**
```typescript
interface FriendRequestResponse {
    request_id: string;      // 请求ID
    status: string;          // 状态: "pending"
    created_at: number;      // 创建时间戳
}
```

**错误处理:**
```typescript
try {
    const result = await client.friends.sendFriendRequest("@alice:example.com");
    console.log("请求ID:", result.request_id);
} catch (error) {
    if (error.errcode === "M_NOT_FOUND") {
        console.error("用户不存在");
    } else if (error.errcode === "M_ALREADY_FRIENDS") {
        console.error("已经是好友关系");
    }
}
```

### 2. 响应好友请求

接受或拒绝好友请求。

```typescript
// 接受好友请求
await client.friends.respondToFriendRequest(
    "request_123",    // 请求ID
    "accept",         // 操作: "accept" 或 "reject"
    "Nice to meet you!"  // 可选的响应消息
);

// 拒绝好友请求
await client.friends.respondToFriendRequest(
    "request_456",
    "reject",
    "Sorry, not interested"
);
```

**参数:**
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `requestId` | `string` | 是 | 好友请求的唯一ID |
| `action` | `"accept" \| "reject"` | 是 | 接受或拒绝 |
| `message` | `string` | 否 | 响应消息 |

**返回值:**
```typescript
interface FriendResponseResult {
    success: boolean;
    status: "accepted" | "rejected";
    friendship_id?: string;  // 接受后返回好友关系ID
}
```

### 3. 获取好友列表

获取当前用户的好友列表，支持筛选和分页。

```typescript
// 获取所有好友
const allFriends = await client.friends.getFriendsList();

// 获取在线好友
const onlineFriends = await client.friends.getFriendsList({
    status: "online",
    limit: 20,
    offset: 0
});

// 分页获取
const page1 = await client.friends.getFriendsList({
    limit: 50,
    offset: 0
});
```

**参数:**
```typescript
interface FriendsListOptions {
    status?: "all" | "online" | "offline";  // 好友状态筛选
    limit?: number;   // 每页数量 (默认: 50)
    offset?: number;  // 分页偏移
    category_id?: string;  // 按分组筛选
}
```

**返回值:**
```typescript
interface FriendsListResponse {
    friends: Array<{
        user_id: string;
        display_name: string;
        avatar_url?: string;
        status: "online" | "offline";
        since: number;           // 成为好友的时间
        category_id?: string;    // 所属分组ID
    }>;
    total: number;       // 总数
    offset: number;      // 当前偏移
    limit: number;       // 每页数量
}
```

### 4. 删除好友

移除好友关系。

```typescript
await client.friends.deleteFriend("@bob:example.com");
```

**参数:**
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `userId` | `string` | 是 | 要删除的好友用户ID |

**返回值:**
```typescript
interface DeleteFriendResponse {
    success: boolean;
    removed_at: number;
}
```

### 5. 搜索好友

按用户名或显示名搜索好友。

```typescript
const results = await client.friends.searchFriends("alice", 20);
console.log(`找到 ${results.results.length} 个匹配的好友`);
```

**参数:**
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `query` | `string` | 是 | 搜索关键词 |
| `limit` | `number` | 否 | 最大结果数 (默认: 10) |

**返回值:**
```typescript
interface FriendSearchResponse {
    results: Array<{
        user_id: string;
        display_name: string;
        avatar_url?: string;
        match_score: number;  // 匹配度分数
    }>;
    total: number;
}
```

### 6. 获取待处理请求

获取所有待处理的好友请求（包括收到和发出的）。

```typescript
const pending = await client.friends.getPendingRequests();
console.log(`待处理请求: ${pending.requests.length}`);
```

**返回值:**
```typescript
interface PendingRequestsResponse {
    requests: Array<{
        request_id: string;
        user_id: string;
        display_name: string;
        avatar_url?: string;
        direction: "incoming" | "outgoing";  // 请求方向
        message?: string;
        created_at: number;
    }>;
    incoming_count: number;  // 收到的请求数
    outgoing_count: number;  // 发出的请求数
}
```

### 7. 创建好友分组

创建一个新的好友分类/分组。

```typescript
const category = await client.friends.createFriendCategory(
    "Work Colleagues",    // 分组名称
    "People I work with", // 描述
    "#007bff"             // 颜色
);
```

**参数:**
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `name` | `string` | 是 | 分组名称 |
| `description` | `string` | 否 | 分组描述 |
| `color` | `string` | 否 | 分组颜色 (hex格式, 默认: "#007bff") |

**返回值:**
```typescript
interface CreateCategoryResponse {
    category_id: string;
    name: string;
    description?: string;
    color: string;
    friend_count: number;
    created_at: number;
}
```

### 8. 获取好友分组

获取所有好友分组列表。

```typescript
const categories = await client.friends.getFriendCategories();

categories.categories.forEach(cat => {
    console.log(`${cat.name}: ${cat.friend_count} 个好友`);
});
```

**返回值:**
```typescript
interface CategoriesListResponse {
    categories: Array<{
        category_id: string;
        name: string;
        description?: string;
        color: string;
        friend_count: number;
        created_at: number;
    }>;
    total: number;
}
```

### 9. 添加好友到分组

将指定好友添加到分组。

```typescript
await client.friends.addFriendToCategory(
    "@alice:example.com",
    "category_123"
);
```

**参数:**
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `userId` | `string` | 是 | 好友用户ID |
| `categoryId` | `string` | 是 | 分组ID |

## 完整使用示例

### 好友请求流程

```typescript
import * as sdk from "matrix-js-sdk";

const client = sdk.createClient({
    baseUrl: "https://matrix.example.com",
    accessToken: "your_access_token",
    userId: "@user:example.com"
});

// 1. 发送好友请求
async function sendFriendRequest(targetUserId: string, message: string) {
    try {
        const result = await client.friends.sendFriendRequest(targetUserId, message);
        console.log("好友请求已发送，ID:", result.request_id);
        return result;
    } catch (error) {
        console.error("发送失败:", error.message);
        throw error;
    }
}

// 2. 检查待处理请求
async function checkPendingRequests() {
    const pending = await client.friends.getPendingRequests();
    console.log(`收到 ${pending.incoming_count} 个好友请求`);

    // 处理收到的请求
    for (const request of pending.requests) {
        if (request.direction === "incoming") {
            console.log(`来自 ${request.display_name}: ${request.message || "无消息"}`);
        }
    }

    return pending;
}

// 3. 响应好友请求
async function respondToRequest(requestId: string, accept: boolean) {
    const result = await client.friends.respondToFriendRequest(
        requestId,
        accept ? "accept" : "reject",
        accept ? "很高兴成为好友！" : "抱歉，暂时不能添加"
    );
    console.log("响应结果:", result.status);
    return result;
}

// 使用示例
await sendFriendRequest("@alice:example.com", "你好，我想添加你为好友");
const pending = await checkPendingRequests();
if (pending.requests.length > 0) {
    await respondToRequest(pending.requests[0].request_id, true);
}
```

### 好友列表管理

```typescript
// 获取并显示好友列表
async function displayFriendsList() {
    const response = await client.friends.getFriendsList({
        status: "all",
        limit: 100
    });

    console.log(`=== 好友列表 (${response.total}人) ===`);

    for (const friend of response.friends) {
        const statusIcon = friend.status === "online" ? "🟢" : "⚫";
        console.log(`${statusIcon} ${friend.display_name} (@${friend.user_id})`);
    }

    return response;
}

// 搜索好友
async function searchFriend(query: string) {
    const results = await client.friends.searchFriends(query, 10);

    console.log(`=== 搜索 "${query}" 的结果 ===`);
    for (const friend of results.results) {
        console.log(`${friend.display_name} (@${friend.user_id})`);
    }

    return results;
}

// 删除好友
async function removeFriend(userId: string) {
    const result = await client.friends.deleteFriend(userId);
    console.log("好友已移除:", result.success);
    return result;
}
```

### 好友分组管理

```typescript
// 创建分组
async function createFriendGroup(name: string, description: string, color: string) {
    const category = await client.friends.createFriendCategory(name, description, color);
    console.log(`创建分组 "${name}" 成功，ID: ${category.category_id}`);
    return category;
}

// 获取所有分组
async function displayFriendCategories() {
    const response = await client.friends.getFriendCategories();

    console.log("=== 好友分组 ===");
    for (const cat of response.categories) {
        console.log(`${cat.name} (${cat.friend_count}人) - ${cat.description || "无描述"}`);
    }

    return response;
}

// 将好友添加到分组
async function addFriendToGroup(userId: string, categoryName: string) {
    // 先获取分组列表找到分组ID
    const categories = await client.friends.getFriendCategories();
    const category = categories.categories.find(c => c.name === categoryName);

    if (!category) {
        throw new Error(`分组 "${categoryName}" 不存在`);
    }

    await client.friends.addFriendToCategory(userId, category.category_id);
    console.log(`已将 ${userId} 添加到分组 ${categoryName}`);
}
```

## 监听好友事件

```typescript
// 监听好友请求
client.on(sdk.ClientEvent.Event, (event) => {
    if (event.getType() === "m.friend.request") {
        const content = event.getContent();
        console.log("收到好友请求:", content);

        // 自动接受或处理请求
        // ...
    }
});

// 监听好友状态变化
client.on(sdk.RoomMemberEvent.Presence, (event, member) => {
    if (member.userId === targetFriendId) {
        console.log(`好友 ${member.name} 状态: ${member.presence}`);
    }
});
```

## 类型定义

```typescript
// 好友信息
interface Friend {
    user_id: string;
    display_name: string;
    avatar_url?: string;
    status: "online" | "offline";
    since: number;
    category_id?: string;
}

// 好友请求
interface FriendRequest {
    request_id: string;
    user_id: string;
    display_name: string;
    avatar_url?: string;
    direction: "incoming" | "outgoing";
    message?: string;
    created_at: number;
}

// 好友分组
interface FriendCategory {
    category_id: string;
    name: string;
    description?: string;
    color: string;
    friend_count: number;
    created_at: number;
}
```

## 错误代码

| 错误代码 | 描述 |
|----------|------|
| `M_NOT_FOUND` | 用户不存在 |
| `M_ALREADY_FRIENDS` | 已经是好友关系 |
| `M_REQUEST_EXISTS` | 好友请求已存在 |
| `M_FORBIDDEN` | 权限不足 |
| `M_LIMIT_EXCEEDED` | 超出限制 |

## 最佳实践

1. **请求前验证**: 发送好友请求前验证用户是否存在
2. **状态管理**: 维护本地好友状态缓存，减少API调用
3. **分组组织**: 合理使用分组功能管理大量好友
4. **错误处理**: 妥善处理各种错误情况，提供友好的用户提示

---

**文档版本**: 1.0.0
**SDK 版本**: 39.1.3
**最后更新**: 2024-12-28
