# Matrix SDK 扩展实现指南

> **基于**: matrix-js-sdk v39.1.3
> **目标**: 可直接使用的 Friends API 扩展代码
> **更新时间**: 2026-01-06

---

## 目录

- [快速开始](#快速开始)
- [文件结构](#文件结构)
- [完整实现](#完整实现)
- [使用示例](#使用示例)
- [故障排除](#故障排除)

---

## 快速开始

### 1. 安装依赖

```bash
pnpm add matrix-js-sdk@39.1.3
```

### 2. 创建项目结构

```
src/
├── sdk/
│   ├── matrix-friends/
│   │   ├── types.ts           # 类型定义
│   │   ├── extension.ts        # 扩展实现
│   │   ├── client-factory.ts   # 客户端工厂
│   │   └── index.ts            # 导出
│   └── matrix-friends.spec.ts # 测试
```

### 3. 复制代码

直接复制以下章节的完整代码到对应文件。

---

## 文件结构

```
src/sdk/matrix-friends/
├── types.ts              # 所有 TypeScript 类型定义
├── extension.ts          # Friends API 扩展实现
├── client-factory.ts     # 增强客户端工厂
├── error.ts              # 自定义错误类
├── utils.ts              # 工具函数
└── index.ts              # 统一导出
```

---

## 完整实现

### 1. 类型定义 (types.ts)

```typescript
// src/sdk/matrix-friends/types.ts

/**
 * ============ 基础类型 ============
 */

/**
 * 基础 API 响应
 */
export interface BaseResponse {
  status: 'ok' | 'failed';
}

/**
 * 基础查询选项
 */
export interface BaseOptions {
  userId?: string;
}

/**
 * ============ 数据模型 ============
 */

/**
 * 好友信息
 */
export interface Friend {
  friend_id: string;
  remark: string;
  status: 'accepted' | 'pending' | 'blocked';
  created_at: string;
  category_id: string;
  category_name?: string | null;
}

/**
 * 好友分组
 */
export interface Category {
  id: string;
  name: string;
  created_at: string;
}

/**
 * 统计信息
 */
export interface Stats {
  total_friends: number;
  pending_requests: number;
  blocked_count: number;
}

/**
 * 好友请求
 */
export interface FriendRequest {
  id: string;
  requester_id: string;
  message: string;
  created_at: string;
  category_id?: string | null;
}

/**
 * 黑名单用户
 */
export interface BlockedUser {
  user_id: string;
  blocked_at: string;
}

/**
 * 搜索结果用户
 */
export interface SearchResultUser {
  user_id: string;
  display_name?: string | null;
  avatar_url?: string | null;
}

/**
 * ============ API 响应类型 ============
 */

/**
 * 好友列表响应
 */
export interface ListFriendsResponse extends BaseResponse {
  friends: Friend[];
}

/**
 * 分组列表响应
 */
export interface ListCategoriesResponse extends BaseResponse {
  categories: Category[];
}

/**
 * 统计信息响应
 */
export interface GetStatsResponse extends BaseResponse {
  stats: Stats;
}

/**
 * 黑名单列表响应
 */
export interface ListBlockedResponse extends BaseResponse {
  blocked: BlockedUser[];
}

/**
 * 待处理请求列表响应
 */
export interface ListPendingRequestsResponse extends BaseResponse {
  requests: FriendRequest[];
}

/**
 * 搜索好友响应
 */
export interface SearchFriendsResponse extends BaseResponse {
  users: SearchResultUser[];
  limited?: boolean;
}

/**
 * 用户目录搜索响应 (Matrix 标准 API)
 */
export interface UserDirectoryResponse {
  results: Array<{
    user_id: string;
    display_name: string | null;
    avatar_url: string | null;
  }>;
  limited: boolean;
}

/**
 * 发送好友请求响应
 */
export interface SendRequestResponse extends BaseResponse {
  request_id?: string;
}

/**
 * 接受好友请求响应
 */
export interface AcceptRequestResponse extends BaseResponse {
  requester_id?: string;
  dm_room_id?: string;
  m_direct_updated?: boolean;
  dm_note?: string;
}

/**
 * 创建分组响应
 */
export interface CreateCategoryResponse extends BaseResponse {
  category_id?: string;
}

/**
 * 操作响应 (通用)
 */
export interface OperationResponse extends BaseResponse {}

/**
 * ============ API 请求类型 ============
 */

/**
 * 发送好友请求选项
 */
export interface SendRequestOptions extends BaseOptions {
  message?: string;
  categoryId?: string;
}

/**
 * 接受好友请求选项
 */
export interface AcceptRequestOptions extends BaseOptions {
  categoryId?: string;
}

/**
 * ============ FriendsApi 接口定义 ============
 */

/**
 * Friends API 接口
 */
export interface FriendsApi {
  // ========== 查询类 API ==========

  /**
   * 获取好友列表
   */
  list(options?: BaseOptions): Promise<ListFriendsResponse>;

  /**
   * 获取分组列表
   */
  listCategories(options?: BaseOptions): Promise<ListCategoriesResponse>;

  /**
   * 获取统计信息
   */
  getStats(options?: BaseOptions): Promise<GetStatsResponse>;

  /**
   * 获取黑名单
   */
  listBlocked(options?: BaseOptions): Promise<ListBlockedResponse>;

  /**
   * 获取待处理请求
   */
  listPendingRequests(options?: BaseOptions): Promise<ListPendingRequestsResponse>;

  /**
   * 搜索好友
   */
  searchFriends(query: string, options?: BaseOptions): Promise<SearchFriendsResponse>;

  // ========== 操作类 API ==========

  /**
   * 发送好友请求
   */
  sendRequest(targetId: string, options?: SendRequestOptions): Promise<SendRequestResponse>;

  /**
   * 接受好友请求
   */
  acceptRequest(requestId: string, options?: AcceptRequestOptions): Promise<AcceptRequestResponse>;

  /**
   * 拒绝好友请求
   */
  rejectRequest(requestId: string, options?: BaseOptions): Promise<OperationResponse>;

  /**
   * 删除好友
   */
  removeFriend(friendId: string, options?: BaseOptions): Promise<OperationResponse>;

  // ========== 分组管理 ==========

  /**
   * 创建分组
   */
  createCategory(name: string, options?: BaseOptions): Promise<CreateCategoryResponse>;

  /**
   * 删除分组
   */
  deleteCategory(categoryId: string, options?: BaseOptions): Promise<OperationResponse>;

  // ========== 备注管理 ==========

  /**
   * 设置好友备注
   */
  setRemark(friendId: string, remark: string, options?: BaseOptions): Promise<OperationResponse>;

  // ========== 黑名单管理 ==========

  /**
   * 拉黑用户
   */
  blockUser(targetId: string, options?: BaseOptions): Promise<OperationResponse>;

  /**
   * 取消拉黑
   */
  unblockUser(targetId: string, options?: BaseOptions): Promise<OperationResponse>;
}

/**
 * ============ Matrix 类型扩展 ============
 */

/**
 * Matrix 客户端接口扩展
 */
export interface MatrixClientExtensions {
  readonly friends: FriendsApi;
}
```

### 2. 错误处理 (error.ts)

```typescript
// src/sdk/matrix-friends/error.ts

/**
 * Friends API 错误
 */
export class FriendsApiError extends Error {
  constructor(
    public statusCode: number,
    public body: string
  ) {
    super(`Friends API Error ${statusCode}: ${body}`);
    this.name = 'FriendsApiError';
    Object.setPrototypeOf(this, FriendsApiError.prototype);
  }

  /**
   * 解析错误详情
   */
  getDetails(): { errcode?: string; error?: string } {
    try {
      return JSON.parse(this.body);
    } catch {
      return { error: this.body };
    }
  }

  /**
   * 是否为认证错误
   */
  isAuthError(): boolean {
    const details = this.getDetails();
    return this.statusCode === 401 || details.errcode === 'M_MISSING_TOKEN';
  }

  /**
   * 是否为权限错误
   */
  isForbidden(): boolean {
    const details = this.getDetails();
    return this.statusCode === 403 || details.errcode === 'M_FORBIDDEN';
  }

  /**
   * 是否为参数错误
   */
  isInvalidParam(): boolean {
    return this.statusCode === 400;
  }

  /**
   * 是否为未找到
   */
  isNotFound(): boolean {
    return this.statusCode === 404;
  }

  /**
   * 获取用户友好的错误消息
   */
  getUserMessage(): string {
    const details = this.getDetails();

    switch (details.errcode) {
      case 'M_MISSING_TOKEN':
        return '未授权访问，请重新登录';
      case 'M_UNKNOWN_TOKEN':
        return '登录已过期，请重新登录';
      case 'M_FORBIDDEN':
        return '没有权限执行此操作';
      case 'M_NOT_FOUND':
        return '请求的资源不存在';
      case 'M_INVALID_PARAM':
        return '请求参数无效';
      default:
        return details.error || '操作失败，请稍后重试';
    }
  }
}

/**
 * 网络错误
 */
export class NetworkError extends Error {
  constructor(message: string) {
    super(`Network Error: ${message}`);
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}
```

### 3. 工具函数 (utils.ts)

```typescript
// src/sdk/matrix-friends/utils.ts

/**
 * 检查响应是否成功
 */
export function checkResponse(response: Response): void {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
}

/**
 * 解析 JSON 响应
 */
export async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

/**
 * 构建查询字符串
 */
export function buildQueryString(params: Record<string, string | number | undefined>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      searchParams.append(key, String(value));
    }
  });
  return searchParams.toString();
}

/**
 * 格式化用户 ID
 */
export function formatUserId(userId: string): string {
  if (!userId.startsWith('@')) {
    throw new Error('Invalid user ID: must start with @');
  }
  return userId;
}
```

### 4. 扩展实现 (extension.ts)

```typescript
// src/sdk/matrix-friends/extension.ts

import type {
  FriendsApi,
  BaseOptions,
  ListFriendsResponse,
  ListCategoriesResponse,
  GetStatsResponse,
  ListBlockedResponse,
  ListPendingRequestsResponse,
  SearchFriendsResponse,
  SendRequestOptions,
  SendRequestResponse,
  AcceptRequestOptions,
  AcceptRequestResponse,
  CreateCategoryResponse,
  OperationResponse,
} from './types';
import { FriendsApiError, NetworkError } from './error';
import { buildQueryString } from './utils';

/**
 * Matrix 客户端接口 (最小化)
 */
interface MatrixClient {
  getAccessToken(): string;
  getUserId(): string;
  getHomeserverUrl(): string;
  createRoom(opts: {
    preset: string;
    invite: string[];
    is_direct: boolean;
  }): Promise<{ room_id: string }>;
  getAccountData(type: string): Promise<Record<string, string[]>>;
  setAccountData(type: string, data: Record<string, string[]>): Promise<void>;
}

/**
 * Friends API 扩展实现
 */
export class MatrixFriendsApiExtension implements FriendsApi {
  constructor(
    private client: MatrixClient,
    private baseUrl: string
  ) {}

  /**
   * 获取访问 token
   */
  private getAccessToken(): string {
    const token = this.client.getAccessToken();
    if (!token) {
      throw new FriendsApiError(401, JSON.stringify({
        errcode: 'M_MISSING_TOKEN',
        error: 'Access token not found'
      }));
    }
    return token;
  }

  /**
   * 获取当前用户 ID
   */
  private getUserId(): string {
    return this.client.getUserId();
  }

  /**
   * 获取基础 URL
   */
  private getBaseUrl(): string {
    return this.baseUrl || this.client.getHomeserverUrl();
  }

  /**
   * 通用 HTTP 请求方法
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.getBaseUrl()}${path}`;
    const accessToken = this.getAccessToken();

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const text = await response.text();
      const data = text ? JSON.parse(text) : {};

      if (!response.ok) {
        throw new FriendsApiError(response.status, text);
      }

      return data as T;
    } catch (error) {
      if (error instanceof FriendsApiError) {
        throw error;
      }
      throw new NetworkError(error instanceof Error ? error.message : String(error));
    }
  }

  // ==================== 查询类 API ====================

  async list(options?: BaseOptions): Promise<ListFriendsResponse> {
    const userId = options?.userId || this.getUserId();
    const query = buildQueryString({ user_id: userId });
    return this.request<ListFriendsResponse>(
      'GET',
      `/_synapse/client/enhanced/friends/v2/list?${query}`
    );
  }

  async listCategories(options?: BaseOptions): Promise<ListCategoriesResponse> {
    const userId = options?.userId || this.getUserId();
    const query = buildQueryString({ user_id: userId });
    return this.request<ListCategoriesResponse>(
      'GET',
      `/_synapse/client/enhanced/friends/v2/categories?${query}`
    );
  }

  async getStats(options?: BaseOptions): Promise<GetStatsResponse> {
    const userId = options?.userId || this.getUserId();
    const query = buildQueryString({ user_id: userId });
    return this.request<GetStatsResponse>(
      'GET',
      `/_synapse/client/enhanced/friends/v2/stats?${query}`
    );
  }

  async listBlocked(options?: BaseOptions): Promise<ListBlockedResponse> {
    const userId = options?.userId || this.getUserId();
    const query = buildQueryString({ user_id: userId });
    return this.request<ListBlockedResponse>(
      'GET',
      `/_synapse/client/enhanced/friends/v2/blocked?${query}`
    );
  }

  async listPendingRequests(options?: BaseOptions): Promise<ListPendingRequestsResponse> {
    const userId = options?.userId || this.getUserId();
    const query = buildQueryString({ user_id: userId });
    return this.request<ListPendingRequestsResponse>(
      'GET',
      `/_synapse/client/enhanced/friends/v2/requests/pending?${query}`
    );
  }

  async searchFriends(
    query: string,
    options?: BaseOptions
  ): Promise<SearchFriendsResponse> {
    const userId = options?.userId || this.getUserId();
    const qs = buildQueryString({ user_id: userId, query });
    return this.request<SearchFriendsResponse>(
      'GET',
      `/_synapse/client/enhanced/friends/v2/search?${qs}`
    );
  }

  // ==================== 操作类 API ====================

  async sendRequest(
    targetId: string,
    options?: SendRequestOptions
  ): Promise<SendRequestResponse> {
    const body = {
      target_id: targetId,
      message: options?.message,
      category_id: options?.categoryId,
    };

    return this.request<SendRequestResponse>(
      'POST',
      '/_synapse/client/enhanced/friends/v2/request',
      body
    );
  }

  async acceptRequest(
    requestId: string,
    options?: AcceptRequestOptions
  ): Promise<AcceptRequestResponse> {
    const body = {
      request_id: requestId,
      category_id: options?.categoryId,
    };

    const response = await this.request<AcceptRequestResponse>(
      'POST',
      '/_synapse/client/enhanced/friends/v2/request/accept',
      body
    );

    // 如果后端没有返回 dm_room_id，尝试自动创建
    if (!response.dm_room_id && response.requester_id) {
      try {
        response.dm_room_id = await this.createDM(response.requester_id);
        response.dm_note = 'DM room created by client';
      } catch (error) {
        console.warn('Failed to create DM room:', error);
      }
    }

    return response;
  }

  async rejectRequest(
    requestId: string,
    options?: BaseOptions
  ): Promise<OperationResponse> {
    return this.request<OperationResponse>(
      'POST',
      '/_synapse/client/enhanced/friends/v2/request/reject',
      { request_id: requestId }
    );
  }

  async removeFriend(
    friendId: string,
    options?: BaseOptions
  ): Promise<OperationResponse> {
    return this.request<OperationResponse>(
      'POST',
      '/_synapse/client/enhanced/friends/v2/remove',
      { friend_id: friendId }
    );
  }

  // ==================== 分组管理 ====================

  async createCategory(
    name: string,
    options?: BaseOptions
  ): Promise<CreateCategoryResponse> {
    return this.request<CreateCategoryResponse>(
      'POST',
      '/_synapse/client/enhanced/friends/v2/categories',
      { name }
    );
  }

  async deleteCategory(
    categoryId: string,
    options?: BaseOptions
  ): Promise<OperationResponse> {
    return this.request<OperationResponse>(
      'POST',
      '/_synapse/client/enhanced/friends/v2/categories/delete',
      { category_id: categoryId }
    );
  }

  // ==================== 备注管理 ====================

  async setRemark(
    friendId: string,
    remark: string,
    options?: BaseOptions
  ): Promise<OperationResponse> {
    return this.request<OperationResponse>(
      'POST',
      '/_synapse/client/enhanced/friends/v2/remark',
      { friend_id: friendId, remark }
    );
  }

  // ==================== 黑名单管理 ====================

  async blockUser(
    targetId: string,
    options?: BaseOptions
  ): Promise<OperationResponse> {
    return this.request<OperationResponse>(
      'POST',
      '/_synapse/client/enhanced/friends/v2/block',
      { target_id: targetId }
    );
  }

  async unblockUser(
    targetId: string,
    options?: BaseOptions
  ): Promise<OperationResponse> {
    return this.request<OperationResponse>(
      'POST',
      '/_synapse/client/enhanced/friends/v2/unblock',
      { target_id: targetId }
    );
  }

  // ==================== 辅助方法 ====================

  /**
   * 创建 DM 房间
   */
  private async createDM(friendId: string): Promise<string> {
    try {
      // 检查是否已有 DM 房间
      const mDirect = await this.client.getAccountData('m.direct');
      if (mDirect?.[friendId]?.[0]) {
        return mDirect[friendId][0];
      }

      // 创建新的 DM 房间
      const { room_id } = await this.client.createRoom({
        preset: 'trusted_private_chat',
        invite: [friendId],
        is_direct: true,
      });

      // 更新 m.direct
      const updatedMDirect = mDirect || {};
      updatedMDirect[friendId] = [room_id];
      await this.client.setAccountData('m.direct', updatedMDirect);

      return room_id;
    } catch (error) {
      throw new Error(`Failed to create DM room: ${error}`);
    }
  }
}
```

### 5. 客户端工厂 (client-factory.ts)

```typescript
// src/sdk/matrix-friends/client-factory.ts

import { MatrixClient } from 'matrix-js-sdk';
import { MatrixFriendsApiExtension } from './extension';
import type { MatrixClientExtensions } from './types';

/**
 * 增强的 Matrix 客户端配置
 */
export interface EnhancedMatrixClientConfig {
  baseUrl: string;
  accessToken: string;
  userId: string;
  friendsApiBaseUrl?: string;
  deviceId?: string;
}

/**
 * 增强的 Matrix 客户端类型
 */
export type EnhancedMatrixClient = MatrixClient & MatrixClientExtensions;

/**
 * 创建增强的 Matrix 客户端
 */
export async function createEnhancedMatrixClient(
  config: EnhancedMatrixClientConfig
): Promise<EnhancedMatrixClient> {
  // 创建标准 Matrix 客户端
  const client = (await createMatrixClient({
    baseUrl: config.baseUrl,
    accessToken: config.accessToken,
    userId: config.userId,
    deviceId: config.deviceId,
  })) as EnhancedMatrixClient;

  // 创建 Friends API 扩展
  const friendsApi = new MatrixFriendsApiExtension(
    client,
    config.friendsApiBaseUrl || config.baseUrl
  );

  // 将扩展添加到客户端
  Object.defineProperty(client, 'friends', {
    value: friendsApi,
    writable: false,
    enumerable: true,
    configurable: false,
  });

  return client;
}

/**
 * 简化版创建函数 (用于登录后)
 */
export async function createClientFromToken(
  baseUrl: string,
  accessToken: string,
  userId: string,
  friendsApiBaseUrl?: string
): Promise<EnhancedMatrixClient> {
  return createEnhancedMatrixClient({
    baseUrl,
    accessToken,
    userId,
    friendsApiBaseUrl,
  });
}

/**
 * 兼容 matrix-js-sdk 的 createClient 函数
 */
async function createMatrixClient(config: {
  baseUrl: string;
  accessToken: string;
  userId: string;
  deviceId?: string;
}): Promise<MatrixClient> {
  // 动态导入 matrix-js-sdk
  const matrixJs = await import('matrix-js-sdk');

  return matrixJs.createClient({
    baseUrl: config.baseUrl,
    accessToken: config.accessToken,
    userId: config.userId,
    deviceId: config.deviceId,
  });
}
```

### 6. 统一导出 (index.ts)

```typescript
// src/sdk/matrix-friends/index.ts

// 类型导出
export * from './types';

// 类导出
export { MatrixFriendsApiExtension } from './extension';
export { FriendsApiError, NetworkError } from './error';

// 工厂函数导出
export {
  createEnhancedMatrixClient,
  createClientFromToken,
  type EnhancedMatrixClient,
  type EnhancedMatrixClientConfig,
} from './client-factory';

// 工具函数导出
export * from './utils';
```

---

## 使用示例

### 1. 登录并创建客户端

```typescript
// services/auth-service.ts

import { createClientFromToken } from '@/sdk/matrix-friends';

export async function login(username: string, password: string) {
  // 1. 调用 Matrix 登录 API
  const response = await fetch('https://matrix.cjystx.top:8443/_matrix/client/v3/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'm.login.password',
      identifier: { type: 'm.id.user', user: username },
      password,
    }),
  });

  const { access_token, user_id } = await response.json();

  // 2. 创建增强客户端
  const client = await createClientFromToken(
    'https://matrix.cjystx.top:8443',
    access_token,
    user_id
  );

  // 3. 启动客户端
  await client.startClient();

  return client;
}
```

### 2. 使用 Friends API

```typescript
// stores/friends.ts

import { defineStore } from 'pinia';
import type { Friend, FriendRequest, Category } from '@/sdk/matrix-friends';

export const useFriendsStore = defineStore('friends', {
  state: () => ({
    friends: [] as Friend[],
    categories: [] as Category[],
    pendingRequests: [] as FriendRequest[],
    stats: null as any,
  }),

  actions: {
    async refreshAll() {
      const client = getMatrixClient(); // 获取全局客户端实例

      const [friends, categories, stats] = await Promise.all([
        client.friends.list(),
        client.friends.listCategories(),
        client.friends.getStats(),
      ]);

      this.friends = friends.friends;
      this.categories = categories.categories;
      this.stats = stats.stats;
    },

    async sendFriendRequest(targetId: string, message?: string) {
      const client = getMatrixClient();
      const result = await client.friends.sendRequest(targetId, { message });
      return result.request_id;
    },

    async acceptFriendRequest(requestId: string) {
      const client = getMatrixClient();
      const result = await client.friends.acceptRequest(requestId);

      // 如果返回了 dm_room_id，可以跳转到聊天
      if (result.dm_room_id) {
        navigateToChat(result.dm_room_id);
      }

      return result;
    },
  },
});
```

### 3. 在 Vue 组件中使用

```vue
<!-- components/FriendsList.vue -->
<script setup lang="ts">
import { onMounted } from 'vue';
import { useFriendsStore } from '@/stores/friends';
import type { Friend } from '@/sdk/matrix-friends';

const friendsStore = useFriendsStore();

onMounted(async () => {
  await friendsStore.refreshAll();
});

const handleAddFriend = async (targetId: string) => {
  await friendsStore.sendFriendRequest(targetId, '添加好友');
  await friendsStore.refreshPendingRequests();
};
</script>

<template>
  <div class="friends-list">
    <div v-for="friend in friendsStore.friends" :key="friend.friend_id">
      {{ friend.remark || friend.friend_id }}
    </div>
  </div>
</template>
```

---

## 故障排除

### 问题 1: 401 Unauthorized

**原因**: 未携带 token 或 token 无效

**解决方案**:
```typescript
// 确保在调用前已登录
const client = await login('username', 'password');

// 检查 token 是否存在
const token = client.getAccessToken();
console.log('Access token:', token ? 'exists' : 'missing');
```

### 问题 2: 端口 8443 连接失败

**原因**: 防火墙或网络配置

**解决方案**:
```typescript
// 方案 1: 使用本地端口映射
const client = await createClientFromToken(
  'https://localhost:443',  // 本地端口
  token,
  userId,
  'https://localhost:443'  // Friends API 也使用本地端口
);

// 方案 2: 配置代理
// vite.config.ts:
export default defineConfig({
  server: {
    proxy: {
      '/_matrix': {
        target: 'https://matrix.cjystx.top:8443',
        changeOrigin: true,
      },
      '/_synapse': {
        target: 'https://matrix.cjystx.top:8443',
        changeOrigin: true,
      },
    },
  },
});
```

### 问题 3: TypeScript 类型错误

**原因**: 类型声明未正确导入

**解决方案**:
```typescript
// 创建类型声明文件
// types/matrix-js-sdk.d.ts

import { MatrixClient } from 'matrix-js-sdk';
import type { FriendsApi } from '@/sdk/matrix-friends';

declare module 'matrix-js-sdk' {
  interface MatrixClient {
    readonly friends: FriendsApi;
  }
}
```

---

## 附录

### A. 环境配置

```bash
# .env.production
VITE_MATRIX_BASE_URL=https://matrix.cjystx.top:8443
VITE_MATRIX_SERVER_NAME=cjystx.top
VITE_MATRIX_FRIENDS_API_BASE_URL=https://matrix.cjystx.top:8443
```

```bash
# .env.development
VITE_MATRIX_BASE_URL=https://localhost:443
VITE_MATRIX_SERVER_NAME=cjystx.top
VITE_MATRIX_FRIENDS_API_BASE_URL=https://localhost:443
```

### B. 相关文档

- [优化后的需求文档](./BACKEND_REQUIREMENTS_OPTIMIZED.md)
- [SDK 优化方案](./MATRIX_SDK_OPTIMIZATION_PLAN.md)
- [matrix-js-sdk 文档](https://github.com/matrix-org/matrix-js-sdk)
