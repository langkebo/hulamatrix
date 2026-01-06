# HuLa 前端项目 Friends SDK 集成指南

> **项目**: HuLa Matrix 前端
> **SDK**: matrix-js-sdk v39.1.3 + Friends API 扩展
> **后端**: https://matrix.cjystx.top:443
> **更新时间**: 2026-01-06

---

## 目录

- [1. 已完成的优化](#1-已完成的优化)
- [2. 前端项目需要修改的文件](#2-前端项目需要修改的文件)
- [3. 前端项目需要新增的代码](#3-前端项目需要新增的代码)
- [4. 前端项目需要移除的代码](#4-前端项目需要移除的代码)
- [5. 集成步骤](#5-集成步骤)
- [6. 测试验证](#6-测试验证)

---

## 1. 已完成的优化

### 1.1 SDK 扩展实现

✅ **已完成** - 在 `src/sdk/matrix-friends/` 目录下创建了完整的 Friends API 扩展：

```
src/sdk/matrix-friends/
├── types.ts                    # 完整类型定义
├── utils.ts                    # 工具函数
├── FriendsApiExtension.ts      # Friends API 实现
├── factory.ts                  # 客户端工厂
├── index.ts                    # 统一导出
├── README.md                   # 配置指南
├── IMPLEMENTATION_SUMMARY.md   # 实现总结
├── OPTIMIZATION_REPORT.md      # 优化报告
└── __tests__/                  # 测试用例 (33个全部通过)
```

### 1.2 测试验证

✅ **已通过**:
- 单元测试: 21/21 通过
- 集成测试: 12/12 通过
- 类型检查: 零错误
- ESLint: 零错误

### 1.3 文档更新

✅ **已更新**:
- `BACKEND_REQUIREMENTS_OPTIMIZED.md` - 更新为 443 端口
- `MATRIX_SDK_OPTIMIZATION_PLAN.md` - 优化方案文档
- `SDK_IMPLEMENTATION_GUIDE.md` - 实现指南文档

---

## 2. 前端项目需要修改的文件

### 2.1 环境配置文件

#### 📄 `.env` 和 `.env.production`

**需要修改**: 更新端口为 443

```bash
# 现有配置 (需要修改)
VITE_MATRIX_BASE_URL=https://matrix.cjystx.top:8443  # ❌ 旧端口
VITE_MATRIX_SERVER_NAME=cjystx.top

# 修改为
VITE_MATRIX_BASE_URL=https://matrix.cjystx.top:443   # ✅ 新端口 (标准 HTTPS)
VITE_MATRIX_SERVER_NAME=cjystx.top
```

#### 📄 `.env.development`

```bash
# 开发环境配置
VITE_MATRIX_BASE_URL=https://matrix.cjystx.top:443
VITE_MATRIX_SERVER_NAME=cjystx.top
VITE_SYNAPSE_FRIENDS_ENABLED=on
```

### 2.2 Vite 配置文件

#### 📄 `vite.config.ts`

**需要修改**: 更新代理目标端口

```typescript
// 现有配置 (需要修改)
export default defineConfig({
  server: {
    proxy: {
      '/_matrix': {
        target: 'https://matrix.cjystx.top:8443',  // ❌ 旧端口
        changeOrigin: true,
      },
      '/_synapse': {
        target: 'https://matrix.cjystx.top:8443',  // ❌ 旧端口
        changeOrigin: true,
      }
    }
  }
})

// 修改为
export default defineConfig({
  server: {
    proxy: {
      '/_matrix': {
        target: 'https://matrix.cjystx.top:443',   // ✅ 新端口
        changeOrigin: true,
        secure: true,
      },
      '/_synapse': {
        target: 'https://matrix.cjystx.top:443',   // ✅ 新端口
        changeOrigin: true,
        secure: true,
      }
    }
  }
})
```

### 2.3 Matrix 客户端集成

#### 📄 `src/integrations/matrix/client.ts`

**需要修改**: 添加 Friends API 扩展

```typescript
// 在文件末尾添加

import { extendMatrixClient, isFriendsApiEnabled } from '@/sdk/matrix-friends';

/**
 * 获取增强的 Matrix 客户端（包含 Friends API）
 */
export function getEnhancedMatrixClient() {
  const client = matrixClientService.getClient();

  if (!client) {
    throw new Error('Matrix client not initialized');
  }

  // 检查是否已扩展 Friends API
  if (!isFriendsApiEnabled(client)) {
    extendMatrixClient(client);
  }

  return client;
}
```

### 2.4 移除或弃用旧代码

#### 📄 `src/integrations/synapse/friends.ts`

**需要标记为弃用**: 此文件包含直接调用 Synapse API 的代码，应该使用 SDK 扩展替代

```typescript
/**
 * @deprecated 请使用 @/sdk/matrix-friends 中的 Friends API 扩展
 * 此文件将在未来版本中移除
 */
```

#### 📄 `src/services/friendsServiceV2.ts`

**需要修改**: 集成新的 SDK 扩展

```typescript
/**
 * 好友服务 v2.1
 * 使用新的 Friends SDK 扩展
 */

import { getEnhancedMatrixClient } from '@/integrations/matrix/client';
import type { Friend, Category, FriendRequest } from '@/sdk/matrix-friends';

class FriendsServiceV2 {
  private get client() {
    return getEnhancedMatrixClient();
  }

  async listFriends(): Promise<Friend[]> {
    const response = await this.client.friends.list();
    return response.friends;
  }

  // ... 其他方法
}
```

---

## 3. 前端项目需要新增的代码

### 3.1 创建 Friends Store

#### 📄 `src/stores/friends.ts`

**新增文件**: Pinia store 用于管理好友状态

```typescript
import { defineStore } from 'pinia';
import type { Friend, Category, FriendRequest, Stats } from '@/sdk/matrix-friends';
import { getEnhancedMatrixClient } from '@/integrations/matrix/client';

export const useFriendsStore = defineStore('friends', {
  state: () => ({
    friends: [] as Friend[],
    categories: [] as Category[],
    pendingRequests: [] as FriendRequest[],
    stats: null as Stats | null,
    loading: false,
    error: null as string | null,
  }),

  getters: {
    friendCount: (state) => state.friends.length,
    pendingCount: (state) => state.pendingRequests.length,
    onlineFriendCount: (state) => state.friends.filter(f => f.status === 'accepted').length,
  },

  actions: {
    async fetchFriends() {
      this.loading = true;
      this.error = null;
      try {
        const client = getEnhancedMatrixClient();
        const response = await client.friends.list();
        this.friends = response.friends;
      } catch (error) {
        this.error = error instanceof Error ? error.message : '获取好友列表失败';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async fetchCategories() {
      this.loading = true;
      try {
        const client = getEnhancedMatrixClient();
        const response = await client.friends.listCategories();
        this.categories = response.categories;
      } catch (error) {
        this.error = error instanceof Error ? error.message : '获取分组失败';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async fetchPendingRequests() {
      const client = getEnhancedMatrixClient();
      const response = await client.friends.listPendingRequests();
      this.pendingRequests = response.requests;
    },

    async fetchStats() {
      const client = getEnhancedMatrixClient();
      const response = await client.friends.getStats();
      this.stats = response.stats;
    },

    async sendFriendRequest(targetId: string, message?: string) {
      const client = getEnhancedMatrixClient();
      const response = await client.friends.sendRequest(targetId, { message });
      return response.request_id;
    },

    async acceptFriendRequest(requestId: string, categoryId?: string) {
      const client = getEnhancedMatrixClient();
      return await client.friends.acceptRequest(requestId, { categoryId });
    },

    async rejectFriendRequest(requestId: string) {
      const client = getEnhancedMatrixClient();
      await client.friends.rejectRequest(requestId);
    },

    async removeFriend(friendId: string) {
      const client = getEnhancedMatrixClient();
      await client.friends.removeFriend(friendId);
    },

    async createCategory(name: string) {
      const client = getEnhancedMatrixClient();
      const response = await client.friends.createCategory(name);
      return response.category_id;
    },

    async deleteCategory(categoryId: string) {
      const client = getEnhancedMatrixClient();
      await client.friends.deleteCategory(categoryId);
    },

    async setRemark(friendId: string, remark: string) {
      const client = getEnhancedMatrixClient();
      await client.friends.setRemark(friendId, remark);
    },
  },
});
```

### 3.2 创建 Friends 组件

#### 📄 `src/components/friends/FriendsList.vue`

**新增文件**: 好友列表组件

```vue
<template>
  <div class="friends-list">
    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else-if="friends.length === 0" class="empty">暂无好友</div>
    <div v-else class="friend-items">
      <div
        v-for="friend in friends"
        :key="friend.friend_id"
        class="friend-item"
        @click="handleClick(friend)"
      >
        <Avatar :userId="friend.friend_id" />
        <div class="friend-info">
          <div class="friend-name">{{ friend.remark || friend.friend_id }}</div>
          <div class="friend-status">{{ friend.status }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useFriendsStore } from '@/stores/friends';
import type { Friend } from '@/sdk/matrix-friends';

const emit = defineEmits<{
  (e: 'click', friend: Friend): void;
}>();

const friendsStore = useFriendsStore();

const { friends, loading, error } = storeToRefs(friendsStore);

onMounted(async () => {
  await friendsStore.fetchFriends();
});

const handleClick = (friend: Friend) => {
  emit('click', friend);
};
</script>

<style scoped>
.friends-list {
  /* 样式 */
}
</style>
```

#### 📄 `src/components/friends/AddFriendModal.vue`

**新增文件**: 添加好友弹窗组件

```vue
<template>
  <Modal v-model:open="visible" title="添加好友">
    <form @submit.prevent="handleSubmit">
      <Input
        v-model="targetId"
        placeholder="输入用户 ID (例如: @user:server)"
        :rules="[
          { required: true, message: '请输入用户 ID' },
          { pattern: /^@[^:]+:[^:]+$/, message: '请输入正确的用户 ID 格式' }
        ]"
      />
      <Textarea
        v-model="message"
        placeholder="添加好友验证消息（可选）"
      />
      <Button type="primary" html-type="submit" :loading="sending">
        发送请求
      </Button>
    </form>
  </Modal>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useFriendsStore } from '@/stores/friends';

const emit = defineEmits<{
  (e: 'success'): void;
}>();

const friendsStore = useFriendsStore();

const visible = ref(false);
const targetId = ref('');
const message = ref('');
const sending = ref(false);

const handleSubmit = async () => {
  sending.value = true;
  try {
    await friendsStore.sendFriendRequest(targetId.value, message.value);
    emit('success');
    visible.value = false;
  } finally {
    sending.value = false;
  }
};

const open = () => {
  visible.value = true;
};

defineExpose({ open });
</script>
```

#### 📄 `src/components/friends/FriendRequestsPanel.vue`

**新增文件**: 好友请求面板组件

```vue
<template>
  <div class="friend-requests-panel">
    <h3>好友请求 ({{ pendingCount }})</h3>
    <div v-if="pendingRequests.length === 0" class="empty">
      暂无待处理请求
    </div>
    <div v-else class="request-list">
      <div
        v-for="request in pendingRequests"
        :key="request.id"
        class="request-item"
      >
        <div class="request-info">
          <div class="requester-id">{{ request.requester_id }}</div>
          <div class="request-message">{{ request.message || '无验证消息' }}</div>
        </div>
        <div class="request-actions">
          <Button
            type="primary"
            size="small"
            @click="handleAccept(request.id)"
          >
            接受
          </Button>
          <Button
            type="default"
            size="small"
            @click="handleReject(request.id)"
          >
            拒绝
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useFriendsStore } from '@/stores/friends';

const emit = defineEmits<{
  (e: 'accepted', roomId: string): void;
}>();

const friendsStore = useFriendsStore();
const { pendingRequests } = storeToRefs(friendsStore);

onMounted(async () => {
  await friendsStore.fetchPendingRequests();
});

const handleAccept = async (requestId: string) => {
  try {
    const result = await friendsStore.acceptFriendRequest(requestId);
    if (result.dm_room_id) {
      emit('accepted', result.dm_room_id);
    }
    await friendsStore.fetchPendingRequests();
  } catch (error) {
    console.error('接受好友请求失败:', error);
  }
};

const handleReject = async (requestId: string) => {
  try {
    await friendsStore.rejectFriendRequest(requestId);
    await friendsStore.fetchPendingRequests();
  } catch (error) {
    console.error('拒绝好友请求失败:', error);
  }
};
</script>
```

---

## 4. 前端项目需要移除的代码

### 4.1 标记为弃用的文件

以下文件应该标记为 `@deprecated`，但在过渡期间保留：

1. **`src/integrations/synapse/friends.ts`**
   - 包含直接调用 Synapse API 的代码
   - 应该使用 `src/sdk/matrix-friends` 替代

2. **`src/services/enhancedFriendsService.ts`**
   - 包含旧的 Friends 服务实现
   - 应该使用新的 SDK 扩展

### 4.2 建议的迁移策略

```typescript
// 旧代码 (需要标记为 @deprecated)
/**
 * @deprecated 请使用 getEnhancedMatrixClient().friends.list() 替代
 * 将在 v2.1 版本中移除
 */
export async function listFriends() {
  // ... 旧实现
}

// 新代码
import { getEnhancedMatrixClient } from '@/integrations/matrix/client';

export async function listFriends() {
  const client = getEnhancedMatrixClient();
  return await client.friends.list();
}
```

---

## 5. 集成步骤

### 步骤 1: 更新环境配置

```bash
# 1. 更新 .env 文件
VITE_MATRIX_BASE_URL=https://matrix.cjystx.top:443
VITE_MATRIX_SERVER_NAME=cjystx.top
```

### 步骤 2: 更新 Vite 配置

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/_matrix': {
        target: 'https://matrix.cjystx.top:443',
        changeOrigin: true,
        secure: true,
      },
      '/_synapse': {
        target: 'https://matrix.cjystx.top:443',
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
```

### 步骤 3: 创建 Friends Store

```bash
# 创建 store 文件
touch src/stores/friends.ts
```

复制上面第 3.1 节的代码到文件中。

### 步骤 4: 创建 Friends 组件

```bash
# 创建组件目录和文件
mkdir -p src/components/friends
touch src/components/friends/FriendsList.vue
touch src/components/friends/AddFriendModal.vue
touch src/components/friends/FriendRequestsPanel.vue
```

复制第 3.2 节的代码到对应文件。

### 步骤 5: 更新 Matrix 客户端集成

在 `src/integrations/matrix/client.ts` 文件末尾添加：

```typescript
import { extendMatrixClient, isFriendsApiEnabled } from '@/sdk/matrix-friends';

/**
 * 获取增强的 Matrix 客户端（包含 Friends API）
 */
export function getEnhancedMatrixClient() {
  const client = matrixClientService.getClient();

  if (!client) {
    throw new Error('Matrix client not initialized');
  }

  if (!isFriendsApiEnabled(client)) {
    extendMatrixClient(client);
  }

  return client;
}
```

### 步骤 6: 在登录流程中集成

```typescript
// 在登录成功后扩展客户端
import { extendMatrixClient } from '@/sdk/matrix-friends';

async function handleLogin(username: string, password: string) {
  // ... 现有登录逻辑

  // 登录成功后扩展客户端
  const client = await matrixClientService.loginWithPassword(username, password);
  extendMatrixClient(client);

  return client;
}
```

### 步骤 7: 在页面中使用 Friends API

```vue
<script setup lang="ts">
import { onMounted } from 'vue';
import { useFriendsStore } from '@/stores/friends';
import { getEnhancedMatrixClient } from '@/integrations/matrix/client';

const friendsStore = useFriendsStore();

onMounted(async () => {
  // 初始化好友数据
  await Promise.all([
    friendsStore.fetchFriends(),
    friendsStore.fetchCategories(),
    friendsStore.fetchStats(),
  ]);
});

const handleAddFriend = async (targetId: string) => {
  await friendsStore.sendFriendRequest(targetId, '添加好友');
  await friendsStore.fetchPendingRequests();
};
</script>
```

---

## 6. 测试验证

### 6.1 单元测试

```bash
# 运行 Friends SDK 测试
pnpm run test:run src/sdk/matrix-friends/__tests__/

# 预期结果: 33/33 通过
```

### 6.2 类型检查

```bash
# 运行类型检查
pnpm run typecheck

# 预期结果: 无错误
```

### 6.3 ESLint 检查

```bash
# 运行 ESLint
pnpm run lint

# 预期结果: 无错误
```

### 6.4 集成测试

创建集成测试文件 `src/stores/__tests__/friends.spec.ts`:

```typescript
import { setActivePinia, createPinia } from 'pinia';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFriendsStore } from '../friends';
import { getEnhancedMatrixClient } from '@/integrations/matrix/client';

describe('FriendsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('应该获取好友列表', async () => {
    const store = useFriendsStore();

    // Mock client.friends.list
    const mockClient = {
      friends: {
        list: vi.fn().mockResolvedValue({
          status: 'ok',
          friends: [
            {
              friend_id: '@friend:server',
              remark: 'Friend',
              status: 'accepted',
              created_at: '2026-01-06T00:00:00Z',
              category_id: 'default',
            },
          ],
        }),
      },
    };

    vi.mock('@/integrations/matrix/client', () => ({
      getEnhancedMatrixClient: vi.fn(() => mockClient),
    }));

    await store.fetchFriends();

    expect(store.friends).toHaveLength(1);
    expect(store.friends[0].friend_id).toBe('@friend:server');
  });
});
```

---

## 7. 检查清单

### 环境配置
- [ ] 更新 `.env` 使用 443 端口
- [ ] 更新 `.env.production` 使用 443 端口
- [ ] 更新 `.env.development` 使用 443 端口

### Vite 配置
- [ ] 更新 `vite.config.ts` 代理目标为 443 端口
- [ ] 添加 `secure: true` 配置

### 代码修改
- [ ] 在 `src/integrations/matrix/client.ts` 添加 `getEnhancedMatrixClient()`
- [ ] 创建 `src/stores/friends.ts`
- [ ] 创建 Friends 组件

### 测试
- [ ] 运行类型检查通过
- [ ] 运行 ESLint 通过
- [ ] 运行单元测试通过 (33/33)
- [ ] 手动测试好友功能

### 文档
- [ ] 更新组件文档
- [ ] 更新 API 文档
- [ ] 添加使用示例

---

## 8. 时间线

### 阶段 1: 配置更新 (立即执行)
1. 更新 `.env` 文件
2. 更新 `vite.config.ts`

### 阶段 2: SDK 集成 (立即执行)
1. 在 Matrix 客户端中添加扩展
2. 创建 Friends Store
3. 创建 Friends 组件

### 阶段 3: 测试验证 (立即执行)
1. 运行类型检查
2. 运行单元测试
3. 手动功能测试

### 阶段 4: 代码清理 (后续执行)
1. 标记旧代码为 `@deprecated`
2. 逐步迁移到新 SDK
3. 移除旧代码

---

**总结**: 前端项目需要进行的主要修改是更新端口配置到 443，集成已创建的 Friends SDK，并创建相应的 UI 组件。所有核心 SDK 代码已经完成并通过测试。
