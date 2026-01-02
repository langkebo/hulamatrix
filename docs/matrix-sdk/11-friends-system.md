# 好友系统功能文档

> Matrix JS SDK 39.1.3 - FriendsClient API 完整参考

## 概述

好友系统 (FriendsClient) 是 matrix-js-sdk 39.1.3 的核心功能之一，提供了完整的好友关系管理能力，包括好友请求、好友列表、好友分组、用户搜索等功能。

## 功能特性

- ✅ 发送/接受/拒绝好友请求
- ✅ 好友列表管理（支持缓存）
- ✅ 好友分组分类
- ✅ 用户搜索
- ✅ 待处理请求管理
- ✅ 好友统计
- ✅ 用户拉黑功能
- ✅ 好友备注功能
- ✅ 事件系统支持

## 获取 FriendsClient

```typescript
import { MatrixClient } from "matrix-js-sdk";

const client = new MatrixClient("https://matrix.cjystx.top");
await client.login("m.login.password", {
    user: "username",
    password: "password"
});

// 获取好友系统客户端
const friends = client.friendsV2;
```

## API 参考

### 1. 获取好友列表

获取当前用户的好友列表，支持筛选和分页。

```typescript
// 获取所有好友
const friendList = await friends.listFriends();

// 获取指定分组的好友
const workFriends = await friends.listFriends({
    category_id: 1
});

// 分页获取
const page1 = await friends.listFriends({
    limit: 20,
    offset: 0
});

// 强制刷新缓存
const freshList = await friends.listFriends({}, false);
```

**参数:**
```typescript
interface ListFriendsOptions {
    limit?: number;      // 每页数量
    offset?: number;     // 分页偏移
    category_id?: number; // 按分组筛选
}
```

**返回值:**
```typescript
type Friend[] = Array<{
    user_id: string;          // Matrix 用户 ID
    category_id?: number;     // 分组 ID
    category_name?: string;   // 分组名称
    category_color?: string;  // 分组颜色
    created_at: string;       // 创建时间 (ISO 8601)
    updated_at?: string;      // 更新时间 (ISO 8601)
}>;
```

---

### 2. 发送好友请求

向指定用户发送好友请求。

```typescript
const requestId = await friends.sendFriendRequest({
    target_id: "@alice:matrix.org",
    message: "你好，我想添加你为好友",
    category_id: 1
});

console.log("请求ID:", requestId);
```

**参数:**
```typescript
interface SendFriendRequestOptions {
    target_id: string;      // 目标用户 ID (必需)
    message?: string;       // 请求附言消息
    category_id?: number;   // 分组 ID (默认: 1)
}
```

**返回值:**
```typescript
Promise<string>  // 返回请求 ID
```

**错误处理:**
```typescript
import { FriendRequestError, AlreadyFriendsError } from "matrix-js-sdk";

try {
    const requestId = await friends.sendFriendRequest({
        target_id: "@alice:matrix.org",
        message: "Hi!"
    });
    console.log("请求ID:", requestId);
} catch (error) {
    if (error instanceof AlreadyFriendsError) {
        console.error("已经是好友关系");
    } else if (error instanceof FriendRequestError) {
        console.error("发送失败:", error.message);
    }
}
```

---

### 3. 获取待处理请求

获取所有待处理的好友请求。

```typescript
const pendingRequests = await friends.getPendingRequests();

console.log(`待处理请求: ${pendingRequests.length}`);

for (const request of pendingRequests) {
    console.log(`来自 ${request.requester_id}: ${request.message || "无消息"}`);
}
```

**返回值:**
```typescript
type PendingFriendRequest[] = Array<{
    id: string;              // 请求 ID
    requester_id: string;    // 请求者用户 ID
    message?: string;        // 请求消息
    created_at: string;      // 创建时间 (ISO 8601)
    expires_at: string;      // 过期时间 (ISO 8601)
}>;
```

---

### 4. 接受好友请求

接受好友请求。

```typescript
await friends.acceptFriendRequest("request-id-123", 1);
console.log("已接受好友请求");
```

**参数:**
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `requestId` | `string` | 是 | 好友请求 ID |
| `categoryId` | `number` | 否 | 分组 ID (默认: 1) |

---

### 5. 拒绝好友请求

拒绝好友请求。

```typescript
await friends.rejectFriendRequest("request-id-456");
console.log("已拒绝好友请求");
```

**参数:**
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `requestId` | `string` | 是 | 好友请求 ID |

---

### 6. 删除好友

移除好友关系。

```typescript
await friends.removeFriend("@alice:matrix.org");
console.log("已删除好友");
```

**参数:**
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `friendId` | `string` | 是 | 要删除的好友用户 ID |

---

### 7. 获取好友分组

获取所有好友分组列表。

```typescript
const categories = await friends.getCategories();

for (const category of categories) {
    console.log(`${category.name}: ${category.description || "无描述"}`);
}
```

**返回值:**
```typescript
type FriendCategory[] = Array<{
    id: number;                // 分组 ID
    name: string;              // 分组名称
    description?: string;      // 分组描述
    color?: string;            // 分组颜色 (hex 格式)
    created_at: string;        // 创建时间 (ISO 8601)
    updated_at?: string;       // 更新时间 (ISO 8601)
}>;
```

---

### 8. 获取好友统计

获取好友系统统计数据。

```typescript
const stats = await friends.getStats();

console.log(`好友总数: ${stats.total_friends}`);
console.log(`已拉黑: ${stats.blocked_friends}`);
console.log(`使用分组: ${stats.categories_used}`);
console.log(`最近添加: ${stats.recent_friends}`);
console.log(`待处理请求: ${stats.pending_requests}`);
```

**返回值:**
```typescript
interface FriendStats {
    total_friends: number;      // 好友总数
    blocked_friends: number;    // 已拉黑的好友数
    categories_used: number;    // 使用的分组数
    recent_friends: number;     // 最近添加的好友数
    pending_requests: number;   // 待处理请求数
}
```

---

### 9. 搜索用户

按用户名或显示名搜索用户。

```typescript
const results = await friends.searchUsers("alice", 20);

console.log(`找到 ${results.length} 个匹配用户`);

for (const user of results) {
    console.log(`${user.display_name || user.user_id}`);
}
```

**参数:**
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `query` | `string` | 是 | 搜索关键词 |
| `limit` | `number` | 否 | 最大结果数 (默认: 20) |

**返回值:**
```typescript
type SearchedUser[] = Array<{
    user_id: string;          // Matrix 用户 ID
    display_name?: string;    // 显示名称
    avatar_url?: string;      // 头像 URL (mxc://)
}>;
```

---

### 10. 检查好友关系

检查指定用户是否为好友。

```typescript
const isFriend = await friends.isFriend("@alice:matrix.org");

if (isFriend) {
    console.log("是好友关系");
} else {
    console.log("不是好友关系");
}
```

---

### 11. 获取单个好友

获取指定好友的详细信息。

```typescript
const friend = await friends.getFriend("@alice:matrix.org");

if (friend) {
    console.log(`好友: ${friend.user_id}, 分组: ${friend.category_name}`);
}
```

---

### 12. 清除缓存

清除好友列表缓存。

```typescript
friends.invalidateCache();
// 下次调用 listFriends 时将重新从服务器获取
```

---

## 事件系统

FriendsClient 继承自 EventEmitter，支持监听好友相关事件。

```typescript
import { FriendsClient } from "matrix-js-sdk";

// 监听好友添加事件
friends.on("friend.add", (data) => {
    console.log("新增好友:", data);
});

// 监听好友移除事件
friends.on("friend.remove", (data) => {
    console.log("删除好友:", data.friendId);
});

// 监听好友请求接收事件
friends.on("request.received", (data) => {
    console.log("收到好友请求:", data);
});

// 监听好友请求接受事件
friends.on("request.accepted", (data) => {
    console.log("好友请求已接受:", data);
});
```

**可用事件:**
| 事件名 | 数据 | 描述 |
|--------|------|------|
| `friend.add` | `{ friendId }` | 添加好友后触发 |
| `friend.remove` | `{ friendId }` | 删除好友后触发 |
| `request.received` | 请求对象 | 收到好友请求时触发 |
| `request.accepted` | `{ requestId, categoryId }` | 接受好友请求后触发 |

---

## 完整使用示例

### 好友请求完整流程

```typescript
import { MatrixClient } from "matrix-js-sdk";

const client = new MatrixClient("https://matrix.cjystx.top");
await client.login("m.login.password", {
    user: "username",
    password: "password"
});

const friends = client.friendsV2;

// 1. 发送好友请求
async function sendFriendRequest(targetUserId: string, message: string) {
    try {
        const requestId = await friends.sendFriendRequest({
            target_id: targetUserId,
            message: message
        });
        console.log("好友请求已发送，ID:", requestId);
        return requestId;
    } catch (error) {
        console.error("发送失败:", error.message);
        throw error;
    }
}

// 2. 检查待处理请求
async function checkPendingRequests() {
    try {
        const pending = await friends.getPendingRequests();
        console.log(`收到 ${pending.length} 个好友请求`);

        for (const request of pending) {
            console.log(`来自 ${request.requester_id}: ${request.message || "无消息"}`);
        }

        return pending;
    } catch (error) {
        console.error("获取请求失败:", error.message);
        return [];
    }
}

// 3. 响应好友请求
async function respondToRequest(requestId: string, accept: boolean) {
    try {
        if (accept) {
            await friends.acceptFriendRequest(requestId, 1);
            console.log("已接受好友请求");
        } else {
            await friends.rejectFriendRequest(requestId);
            console.log("已拒绝好友请求");
        }
    } catch (error) {
        console.error("响应失败:", error.message);
        throw error;
    }
}

// 使用示例
await sendFriendRequest("@alice:matrix.org", "你好，我想添加你为好友");
const pending = await checkPendingRequests();
if (pending.length > 0) {
    await respondToRequest(pending[0].id, true);
}
```

### 好友列表管理

```typescript
// 获取并显示好友列表
async function displayFriendsList() {
    try {
        const friendList = await friends.listFriends();

        console.log(`=== 好友列表 (${friendList.length}人) ===`);

        for (const friend of friendList) {
            const category = friend.category_name || "未分组";
            console.log(`${friend.user_id} - ${category}`);
        }
    } catch (error) {
        console.error("获取好友列表失败:", error.message);
    }
}

// 搜索用户
async function searchUser(query: string) {
    try {
        const results = await friends.searchUsers(query, 10);

        console.log(`=== 搜索 "${query}" 的结果 ===`);
        for (const user of results) {
            console.log(`${user.display_name || user.user_id}`);
        }
    } catch (error) {
        console.error("搜索失败:", error.message);
    }
}

// 删除好友
async function removeFriend(userId: string) {
    try {
        await friends.removeFriend(userId);
        console.log(`已删除好友: ${userId}`);
    } catch (error) {
        console.error("删除失败:", error.message);
    }
}
```

### 好友分组管理

```typescript
// 获取所有分组
async function displayFriendCategories() {
    try {
        const categories = await friends.getCategories();

        console.log("=== 好友分组 ===");
        for (const category of categories) {
            console.log(`${category.id}. ${category.name} - ${category.description || "无描述"}`);
        }
    } catch (error) {
        console.error("获取分组失败:", error.message);
    }
}

// 按分组获取好友
async function getFriendsByCategory(categoryId: number) {
    try {
        const friends = await friends.listFriends({
            category_id: categoryId
        });

        console.log(`分组 ${categoryId} 的好友:`, friends.length);
        return friends;
    } catch (error) {
        console.error("获取分组好友失败:", error.message);
        return [];
    }
}
```

### 监听好友事件

```typescript
// 设置事件监听
function setupFriendListeners() {
    // 监听好友添加
    friends.on("friend.add", (data) => {
        console.log("新增好友:", data.friendId);
        // 刷新好友列表
        friends.invalidateCache();
        displayFriendsList();
    });

    // 监听好友移除
    friends.on("friend.remove", (data) => {
        console.log("删除好友:", data.friendId);
        // 刷新好友列表
        friends.invalidateCache();
        displayFriendsList();
    });

    // 监听好友请求
    friends.on("request.received", (request) => {
        console.log("收到好友请求:", request.requester_id);
        // 显示通知
        showNotification(`来自 ${request.requester_id} 的好友请求`);
    });

    // 监听请求接受
    friends.on("request.accepted", (data) => {
        console.log("好友请求已接受:", data.requestId);
        // 刷新好友列表
        friends.invalidateCache();
        displayFriendsList();
    });
}

function showNotification(message: string) {
    // 实现通知逻辑
    console.log("通知:", message);
}
```

---

## 类型定义

完整的 TypeScript 类型定义在 `src/@types/friends.ts`。

```typescript
// 好友信息
interface Friend {
    user_id: string;
    category_id?: number | null;
    category_name?: string | null;
    category_color?: string | null;
    created_at: string;
    updated_at?: string;
}

// 好友分组
interface FriendCategory {
    id: number;
    name: string;
    description?: string;
    color?: string;
    created_at: string;
    updated_at?: string;
}

// 待处理的好友请求
interface PendingFriendRequest {
    id: string;
    requester_id: string;
    message?: string;
    created_at: string;
    expires_at: string;
}

// 好友统计
interface FriendStats {
    total_friends: number;
    blocked_friends: number;
    categories_used: number;
    recent_friends: number;
    pending_requests: number;
}

// 搜索结果用户
interface SearchedUser {
    user_id: string;
    display_name?: string;
    avatar_url?: string;
}

// 好友列表选项
interface ListFriendsOptions {
    limit?: number;
    offset?: number;
    category_id?: number;
}

// 发送好友请求选项
interface SendFriendRequestOptions {
    target_id: string;
    message?: string;
    category_id?: number;
}
```

---

## 错误处理

FriendsClient 提供了详细的错误类型。

```typescript
import {
    FriendsError,
    FriendRequestError,
    FriendResponseError,
    RemoveFriendError,
    FriendRequestNotFoundError,
    AlreadyFriendsError
} from "matrix-js-sdk";

try {
    await friends.sendFriendRequest({
        target_id: "@alice:matrix.org"
    });
} catch (error) {
    if (error instanceof AlreadyFriendsError) {
        console.error("已经是好友关系");
    } else if (error instanceof FriendRequestNotFoundError) {
        console.error("好友请求不存在");
    } else if (error instanceof FriendRequestError) {
        console.error("好友请求操作失败:", error.message);
    } else if (error instanceof FriendsError) {
        console.error("好友系统错误:", error.message);
    }
}
```

**错误类型:**
| 错误类 | 触发场景 |
|--------|----------|
| `FriendsError` | 基础错误类 |
| `FriendRequestError` | 发送好友请求失败 |
| `FriendResponseError` | 响应好友请求失败 |
| `RemoveFriendError` | 删除好友失败 |
| `FriendRequestNotFoundError` | 好友请求不存在 |
| `AlreadyFriendsError` | 已经是好友关系 |

---

## 后端 API 端点

FriendsClient 使用以下后端 API 端点（RESTful 风格）：

| 功能 | 端点 | 方法 |
|------|------|------|
| 好友列表 | `/_synapse/client/enhanced/friends/list` | GET |
| 好友分组 | `/_synapse/client/enhanced/friends/categories` | GET |
| 待处理请求 | `/_synapse/client/enhanced/friends/requests/pending` | GET |
| 好友统计 | `/_synapse/client/enhanced/friends/stats` | GET |
| 搜索用户 | `/_synapse/client/enhanced/friends/search` | GET |
| 发送请求 | `/_synapse/client/enhanced/friends/request` | POST |
| 接受请求 | `/_synapse/client/enhanced/friends/request/accept` | POST |
| 拒绝请求 | `/_synapse/client/enhanced/friends/request/reject` | POST |
| 删除好友 | `/_synapse/client/enhanced/friends/remove` | DELETE |

**后端要求**:
- Synapse 1.140.0 Enhanced Module v1.0.2+
- 支持 v1 RESTful API 路径

---

## 最佳实践

1. **使用缓存**: FriendsClient 自动缓存好友列表 5 分钟，减少 API 调用
2. **事件监听**: 使用事件系统实时响应好友状态变化
3. **错误处理**: 妥善处理各种错误情况，提供友好的用户提示
4. **Matrix ID 验证**: SDK 自动验证 Matrix ID 格式，确保请求有效
5. **缓存管理**: 在添加/删除好友后调用 `invalidateCache()` 刷新缓存

---

## 导入

```typescript
// 导入客户端
import { MatrixClient } from "matrix-js-sdk";

// 导入类型
import type {
    Friend,
    FriendCategory,
    PendingFriendRequest,
    FriendStats,
    SearchedUser
} from "matrix-js-sdk";

// 导入错误类
import {
    FriendsError,
    FriendRequestError,
    AlreadyFriendsError
} from "matrix-js-sdk";

// 导入 FriendsClient
import { FriendsClient } from "matrix-js-sdk";
```

---

**文档版本**: 2.0.1
**SDK 版本**: 39.1.3
**最后更新**: 2026-01-02
