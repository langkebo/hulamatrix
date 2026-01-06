# Matrix SDK 后端需求规范

> **版本**: v2.0
> **更新时间**: 2026-01-06
> **状态**: 生产环境已验证 ✅

---

## 目录

- [1. 项目概述](#1-项目概述)
- [2. 生产环境配置](#2-生产环境配置)
- [3. API 规范](#3-api-规范)
- [4. SDK 实现指南](#4-sdk-实现指南)
- [5. 前端集成方案](#5-前端集成方案)
- [6. 安全与性能优化](#6-安全与性能优化)
- [7. 问题排查指南](#7-问题排查指南)

---

## 1. 项目概述

### 1.1 目标

基于 Matrix 协议扩展的好友系统，提供完整的社交能力：

- ✅ 好友管理（搜索/添加/接受/删除/分组/备注）
- ✅ 黑名单管理
- ✅ 统计信息
- ✅ 与 Matrix DM 聊天集成

### 1.2 技术架构

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   前端 (Vue3)   │────▶│  Matrix SDK     │────▶│ Matrix Synapse │
│                 │     │  (matrix-js)    │     │  + 扩展模块     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ├─ 标准 Matrix API
                               └─ 扩展 Friends API
```

### 1.3 API 版本

| 版本 | 风格 | 路径前缀 | 推荐用途 |
|------|------|----------|----------|
| v1 | action 参数 | `/_synapse/client/friends?action=xxx` | 测试脚本 |
| v2 | REST 风格 | `/_synapse/client/enhanced/friends/v2/*` | SDK 固化 ✅ |

---

## 2. 生产环境配置

### 2.1 服务器配置

⚠️ **关键配置** - 前端必须使用以下配置：

```typescript
// 环境变量 (.env)
VITE_MATRIX_BASE_URL=https://matrix.cjystx.top:443  // 标准 HTTPS 端口
VITE_MATRIX_SERVER_NAME=cjystx.top
```

```typescript
// Vite 代理配置 (vite.config.ts)
export default defineConfig({
  server: {
    proxy: {
      '/_matrix': {
        target: 'https://matrix.cjystx.top:443',  // 使用标准 HTTPS 端口
        changeOrigin: true,
      },
      '/_synapse': {
        target: 'https://matrix.cjystx.top:443',
        changeOrigin: true,
      }
    }
  }
})
```

### 2.2 服务发现

**正确配置**:
```bash
# ✅ 正确 - 使用 cjystx.top
curl https://cjystx.top/.well-known/matrix/client
# 返回: {"m.homeserver": {"base_url": "https://matrix.cjystx.top"}}

# ❌ 错误 - matrix.cjystx.top 不提供服务发现
curl https://matrix.cjystx.top/.well-known/matrix/client
# 返回: 404
```

### 2.3 认证要求

所有 Friends API 请求必须携带 Bearer Token：

```typescript
headers: {
  'Authorization': `Bearer ${access_token}`,
  'Content-Type': 'application/json'
}
```

**错误示例**:
```json
// 无 token 访问返回
HTTP 401
{
  "errcode": "M_MISSING_TOKEN",
  "error": "missing access token"
}
```

### 2.4 端口配置

| 用途 | 外部端口 | 说明 |
|------|----------|------|
| Matrix 客户端 API | 443 | 标准 HTTPS 端口 |
| Matrix Federation | 8448 | 服务器间通信 |

**注意**: 生产环境使用标准 HTTPS 443 端口，无需在 URL 中明确指定端口号。

---

## 3. API 规范

### 3.1 v2 REST API 总览

#### 3.1.1 查询类 API

| 端点 | 方法 | 参数 | 返回 |
|------|------|------|------|
| `/v2/list` | GET | `user_id` | `{ status, friends: Friend[] }` |
| `/v2/categories` | GET | `user_id` | `{ status, categories: Category[] }` |
| `/v2/stats` | GET | `user_id` | `{ status, stats: Stats }` |
| `/v2/blocked` | GET | `user_id` | `{ status, blocked: BlockedUser[] }` |
| `/v2/search` | GET | `user_id, query` | `{ status, users: User[] }` |
| `/v2/requests/pending` | GET | `user_id` | `{ status, requests: Request[] }` |

#### 3.1.2 操作类 API

| 端点 | 方法 | Body | 返回 |
|------|------|------|------|
| `/v2/request` | POST | `{ target_id, message?, category_id? }` | `{ status, request_id? }` |
| `/v2/request/accept` | POST | `{ request_id, category_id? }` | `{ status, requester_id?, dm_room_id? }` |
| `/v2/request/reject` | POST | `{ request_id }` | `{ status }` |
| `/v2/remove` | POST | `{ friend_id }` | `{ status }` |
| `/v2/remark` | POST | `{ friend_id, remark }` | `{ status }` |
| `/v2/block` | POST | `{ target_id }` | `{ status }` |
| `/v2/unblock` | POST | `{ target_id }` | `{ status }` |
| `/v2/categories` | POST | `{ name }` | `{ status, category_id }` |
| `/v2/categories/delete` | POST | `{ category_id }` | `{ status }` |

### 3.2 数据模型

#### Friend
```typescript
interface Friend {
  friend_id: string;          // Matrix user_id: @user:server
  remark: string;             // 备注名
  status: 'accepted';         // 好友状态
  created_at: string;         // ISO8601 时间戳
  category_id: string;        // 分组 ID
  category_name?: string;     // 分组名称（联表查询）
}
```

#### FriendRequest
```typescript
interface FriendRequest {
  id: string;                 // request_id (UUID)
  requester_id: string;       // 发起人 user_id
  message: string;            // 请求消息
  created_at: string;         // ISO8601
  category_id?: string;       // 期望分组
}
```

#### Category
```typescript
interface Category {
  id: string;                 // category_id
  name: string;               // 分组名称
  created_at: string;         // ISO8601
}
```

#### Stats
```typescript
interface Stats {
  total_friends: number;
  pending_requests: number;
  blocked_count: number;
}
```

### 3.3 API 调用示例

#### 获取好友列表
```typescript
const response = await fetch(
  `https://matrix.cjystx.top:8443/_synapse/client/enhanced/friends/v2/list?user_id=@user:server`,
  {
    headers: {
      'Authorization': `Bearer ${access_token}`,
    }
  }
);

const { status, friends } = await response.json();
```

#### 发送好友请求
```typescript
const response = await fetch(
  `https://matrix.cjystx.top:8443/_synapse/client/enhanced/friends/v2/request`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      target_id: '@friend:server',
      message: '添加好友',
      category_id: 'default'
    })
  }
);
```

#### 接受好友请求
```typescript
const response = await fetch(
  `https://matrix.cjystx.top:8443/_synapse/client/enhanced/friends/v2/request/accept`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      request_id: 'uuid-here',
      category_id: 'default'
    })
  }
);

// 返回: { status: "ok", requester_id: "@user:server", dm_room_id: "!room:server" }
```

---

## 4. SDK 实现指南

### 4.1 SDK 设计原则

1. **封装增强 API** - 仅封装 Friends API，聊天使用标准 Matrix SDK
2. **类型安全** - 完整的 TypeScript 类型定义
3. **错误处理** - 统一的错误码和错误消息
4. **可测试性** - 可 mock 的 HTTP 层

### 4.2 核心 API 接口

```typescript
/**
 * Matrix Friends API 接口定义
 */
export interface MatrixFriendsApi {
  // 查询类
  listFriends(userId?: string): Promise<Friend[]>;
  listCategories(userId?: string): Promise<Category[]>;
  getStats(userId?: string): Promise<Stats>;
  listBlocked(userId?: string): Promise<BlockedUser[]>;
  listPendingRequests(userId?: string): Promise<FriendRequest[]>;
  searchFriends(query: string, userId?: string): Promise<User[]>;

  // 操作类
  sendRequest(targetId: string, message?: string, categoryId?: string): Promise<string>;
  acceptRequest(requestId: string, categoryId?: string): Promise<AcceptResult>;
  rejectRequest(requestId: string): Promise<void>;
  removeFriend(friendId: string): Promise<void>;

  // 备注与分组
  setRemark(friendId: string, remark: string): Promise<void>;
  createCategory(name: string): Promise<string>;
  deleteCategory(categoryId: string): Promise<void>;

  // 黑名单
  blockUser(targetId: string): Promise<void>;
  unblockUser(targetId: string): Promise<void>;
}

interface AcceptResult {
  requester_id: string;
  dm_room_id?: string;
  m_direct_updated?: boolean;
}
```

### 4.3 实现 Skeleton

```typescript
/**
 * Matrix Friends API 实现
 */
export class MatrixFriendsClient implements MatrixFriendsApi {
  constructor(
    private baseUrl: string,
    private getAccessToken: () => string,
    private userId?: string
  ) {}

  private async request<T>(
    path: string,
    options?: RequestInit
  ): Promise<T> {
    const token = this.getAccessToken();

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new MatrixApiError(response.status, await response.text());
    }

    return response.json();
  }

  async listFriends(userId?: string): Promise<Friend[]> {
    const uid = userId || this.userId;
    const result = await this.request<{ status: string; friends: Friend[] }>(
      `/_synapse/client/enhanced/friends/v2/list?user_id=${encodeURIComponent(uid)}`
    );
    return result.friends;
  }

  // ... 其他方法实现
}
```

### 4.4 错误处理

```typescript
export class MatrixApiError extends Error {
  constructor(
    public statusCode: number,
    public body: string
  ) {
    super(`Matrix API Error ${statusCode}: ${body}`);
    this.name = 'MatrixApiError';
  }

  static isMissingToken(error: unknown): error is MatrixApiError {
    return error instanceof MatrixApiError && error.statusCode === 401;
  }

  static isForbidden(error: unknown): error is MatrixApiError {
    return error instanceof MatrixApiError && error.statusCode === 403;
  }
}
```

---

## 5. 前端集成方案

### 5.1 状态管理

```typescript
// stores/friends.ts
import { defineStore } from 'pinia';
import { MatrixFriendsClient } from '@/sdk/matrix-friends';

export const useFriendsStore = defineStore('friends', {
  state: () => ({
    friends: [] as Friend[],
    categories: [] as Category[],
    pendingRequests: [] as FriendRequest[],
    blockedUsers: [] as BlockedUser[],
    stats: null as Stats | null,
    dmRoomMapping: new Map<string, string>(), // friendId -> roomId
  }),

  actions: {
    async refreshFriends() {
      const client = useMatrixFriendsClient();
      this.friends = await client.listFriends();
    },

    async refreshPendingRequests() {
      const client = useMatrixFriendsClient();
      this.pendingRequests = await client.listPendingRequests();
    },

    // ... 其他 actions
  },

  persist: {
    key: 'hula-friends',
    storage: localStorage,
    paths: ['friends', 'categories', 'dmRoomMapping'],
  },
});
```

### 5.2 页面组件

```vue
<!-- components/FriendsList.vue -->
<script setup lang="ts">
import { useFriendsStore } from '@/stores/friends';
import { storeToRefs } from 'pinia';

const friendsStore = useFriendsStore();
const { friends, categories, stats } = storeToRefs(friendsStore);

onMounted(async () => {
  await Promise.all([
    friendsStore.refreshFriends(),
    friendsStore.refreshCategories(),
    friendsStore.refreshStats(),
  ]);
});

const handleAddFriend = async (targetId: string) => {
  const client = useMatrixFriendsClient();
  await client.sendRequest(targetId, '添加好友');
  await friendsStore.refreshPendingRequests();
};
</script>

<template>
  <div class="friends-list">
    <!-- 好友列表 UI -->
  </div>
</template>
```

### 5.3 缓存策略

```
┌─────────────────────────────────────────────────────┐
│                   缓存策略                          │
├─────────────────────────────────────────────────────┤
│ 1. 页面加载 → 立即显示缓存数据                      │
│ 2. 后台刷新 → 覆盖缓存                              │
│ 3. 操作成功 → 立即更新缓存 + 触发后台同步           │
│ 4. 错误处理 → 保留缓存, 显示错误提示                │
└─────────────────────────────────────────────────────┘
```

---

## 6. 安全与性能优化

### 6.1 安全加固 (P0)

#### 问题：身份校验依赖客户端传参
当前 API 依赖 `user_id` 查询参数，可能被伪造。

#### 解决方案：
```typescript
// SDK 自动从 token 解析 user_id
class MatrixFriendsClient {
  private getUserId(): string {
    const token = this.getAccessToken();
    // 解析 JWT token 获取 user_id
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub;
  }

  async listFriends(userId?: string): Promise<Friend[]> {
    // 强制使用 token 中的 user_id
    const uid = this.getUserId();
    return this.request(`/v2/list?user_id=${uid}`);
  }
}
```

### 6.2 性能优化 (P1-P2)

| 优化项 | 问题 | 方案 | 优先级 |
|--------|------|------|--------|
| 分页 | 大数据量一次性返回 | 增加 `limit`/`cursor` | P2 |
| 幂等性 | 重复操作产生脏数据 | 状态检查 + 唯一约束 | P2 |
| last_interaction | 字段未更新 | 消息时更新 | P3 |
| 缓存 | 内存缓存不可共享 | Redis 或移除 | P3 |

### 6.3 错误码统一

| HTTP 状态 | errcode | 场景 |
|-----------|---------|------|
| 401 | M_MISSING_TOKEN | 无 token |
| 401 | M_UNKNOWN_TOKEN | token 无效 |
| 403 | M_FORBIDDEN | 权限不足 |
| 400 | M_INVALID_PARAM | 参数错误 |
| 404 | M_NOT_FOUND | 资源不存在 |

---

## 7. 问题排查指南

### 7.1 常见错误

#### Q: 返回 401 Unauthorized
**A**: 检查以下几点：
1. 是否携带了 `Authorization: Bearer ${token}` 头
2. token 是否过期
3. 是否使用了正确的端口 (8443)

#### Q: 返回 404 Not Found
**A**: 可能原因：
1. 使用了错误的端口 (443 而非 8443)
2. 服务发现 URL 错误（应使用 cjystx.top）
3. 端点路径错误

#### Q: 接受好友后没有 dm_room_id
**A**: 当前后端不会稳定返回 `dm_room_id`，建议客户端自行创建：

```typescript
// 客户端创建 DM
async function createDM(friendId: string): Promise<string> {
  const matrixClient = await getMatrixClient();

  // 创建 DM 房间
  const { room_id } = await matrixClient.createRoom({
    preset: 'trusted_private_chat',
    invite: [friendId],
    is_direct: true,
  });

  // 更新 m.direct
  const mDirect = await matrixClient.getAccountData('m.direct');
  mDirect[friendId] = [room_id];
  await matrixClient.setAccountData('m.direct', mDirect);

  return room_id;
}
```

### 7.2 调试命令

```bash
# 1. 测试服务发现
curl -v https://cjystx.top/.well-known/matrix/client

# 2. 测试登录
curl -X POST https://matrix.cjystx.top:8443/_matrix/client/v3/login \
  -H "Content-Type: application/json" \
  -d '{"type":"m.login.password","user":"user","password":"pass"}'

# 3. 测试好友 API
curl https://matrix.cjystx.top:8443/_synapse/client/enhanced/friends/v2/list \
  -H "Authorization: Bearer $TOKEN"

# 4. 测试用户搜索
curl -X POST https://matrix.cjystx.top:8443/_matrix/client/v3/user_directory/search \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"search_term":"user"}'
```

---

## 附录 A：更新记录

### 2026-01-06 v2.0
- ✅ 重构文档结构，提高可读性
- ✅ 添加生产环境配置章节
- ✅ 完善错误处理和调试指南
- ✅ 添加 SDK 实现示例
- ✅ 统一 API 规范格式

### 2026-01-06 v1.0 (原始文档)
- ✅ 完成后端 API 测试
- ✅ 确认所有端点正常工作
- ✅ 输出 SDK 实现方案

---

## 附录 B：相关资源

- [Matrix 规范](https://spec.matrix.org/)
- [matrix-js-sdk 文档](https://github.com/matrix-org/matrix-js-sdk)
- [Synapse 模块开发](https://matrix-org.github.io/synapse/latest/modules.html)
- 项目内文档: `docs/matrix-sdk/`
