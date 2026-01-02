# HuLamatrix 组件迁移指南 - SDK v2.0

> 基于 Matrix SDK v2.0 的组件迁移指南

**版本**: 1.0.0
**更新日期**: 2026-01-02
**状态**: Phase 5 - UI 组件更新

---

## 📋 目录

1. [迁移概述](#迁移概述)
2. [当前架构分析](#当前架构分析)
3. [迁移策略](#迁移策略)
4. [组件迁移清单](#组件迁移清单)
5. [迁移步骤](#迁移步骤)
6. [代码示例](#代码示例)
7. [测试验证](#测试验证)

---

## 迁移概述

### 目标

将现有 UI 组件从旧的实现方式迁移到新的 SDK v2.0 API，实现：
- ✅ **统一实现**: PC 端和移动端使用相同的服务和 Store
- ✅ **简化代码**: 减少重复代码和适配器层
- ✅ **更好性能**: 利用 SDK v2.0 内置缓存和事件系统
- ✅ **向后兼容**: 旧代码继续可用，渐进式迁移

### 迁移范围

| 组件类型 | PC 端 | 移动端 | 优先级 |
|---------|-------|--------|--------|
| 好友列表 | FriendsList.vue | AddFriends.vue | P0 |
| 好友详情 | FriendCard.vue | FriendInfo.vue | P1 |
| 私聊会话 | PrivateChatView.vue | MobilePrivateChatView.vue | P0 |
| 私聊输入 | MsgInput.vue | ChatMain.vue | P1 |
| 好友请求 | ApplyList.vue | ConfirmAddFriend.vue | P1 |

---

## 当前架构分析

### 现有组件使用模式

#### 模式 1: 使用旧 Store

**示例**: `SynapseFriends.vue`, `MobilePrivateChatView.vue`

```typescript
// 旧代码
import { useFriendsStore } from '@/stores/friends'
import { usePrivateChatStore } from '@/stores/privateChat'

const friendsStore = useFriendsStore()
const privateChatStore = usePrivateChatStore()
```

**问题**:
- 与适配器层重复实现
- 缺少事件系统集成
- 手动缓存管理

#### 模式 2: 使用 Adapter

**示例**: `FriendsList.vue`, `PrivateChatView.vue`

```typescript
// 旧代码
import { matrixFriendAdapter } from '@/adapters'
import { matrixPrivateChatAdapter } from '@/adapters'

const friends = await matrixFriendAdapter.listFriends()
const sessions = await matrixPrivateChatAdapter.listSessions()
```

**问题**:
- Adapter 层重复 SDK 功能
- 额外的类型转换开销
- 与 Store 状态不同步

#### 模式 3: 使用 Integration 层

**示例**: `AddFriends.vue` (mobile)

```typescript
// 旧代码
import { sendFriendRequest, listFriendsWithPresenceAndActivity } from '@/integrations/matrix/friendsManager'
import { searchDirectory, getOrCreateDirectRoom } from '@/integrations/matrix/contacts'

await sendFriendRequest(userId)
const rooms = await searchDirectory(query)
```

**问题**:
- 移动端和 PC 端使用不同的 API
- 难以维护和测试
- 状态管理分散

### 目标架构

#### 统一使用 v2 Store

```typescript
// 新代码（PC 端和移动端统一）
import { useFriendsStoreV2 } from '@/stores/friendsV2'
import { usePrivateChatStoreV2 } from '@/stores/privateChatV2'

const friendsStore = useFriendsStoreV2()
const privateChatStore = usePrivateChatStoreV2()

// 初始化
await friendsStore.initialize()
await privateChatStore.initialize()

// 使用
console.log(friendsStore.friends)
console.log(privateChatStore.sessions)
```

**优势**:
- ✅ PC 端和移动端相同代码
- ✅ 内置事件同步
- ✅ SDK 自动缓存
- ✅ 简化错误处理

---

## 迁移策略

### 渐进式迁移

1. **Phase 5.1**: 创建适配器包装器（可选）
2. **Phase 5.2**: 更新 PC 端核心组件
3. **Phase 5.3**: 更新移动端核心组件
4. **Phase 5.4**: 测试和验证
5. **Phase 5.5**: 清理旧代码（可选）

### 兼容性策略

#### 选项 A: 并行运行（推荐）

保留旧代码和新代码，通过特性开关切换：

```typescript
// vite.config.ts
define: {
  __VUE_FRIENDS_V2__: JSON.stringify(process.env.VITE_FRIENDS_V2 ?? 'false')
}

// 组件中
const USE_V2 = __VUE_FRIENDS_V2__ === 'true'

const friendsStore = USE_V2
  ? useFriendsStoreV2()
  : useFriendsStore()
```

#### 选项 B: 适配器包装器

创建 v2 适配器，提供与旧适配器相同的接口：

```typescript
// src/adapters/matrix-friends-adapter-v2.ts
import { friendsServiceV2 } from '@/services/friendsServiceV2'

export const matrixFriendAdapterV2 = {
  async listFriends() {
    return await friendsServiceV2.listFriends()
  },
  // ... 其他方法
}
```

#### 选项 C: 直接迁移（最激进）

直接替换 import 和使用方式，确保测试覆盖。

---

## 组件迁移清单

### PC 端组件

| 组件文件 | 当前使用 | 迁移到 | 状态 |
|---------|---------|--------|------|
| `src/components/friends/FriendsList.vue` | adapter | store v2 | 待迁移 |
| `src/components/friends/AddFriendModal.vue` | adapter | store v2 | 待迁移 |
| `src/components/friends/SearchFriendModal.vue` | adapter | store v2 | 待迁移 |
| `src/views/friends/SynapseFriends.vue` | store | store v2 | 待迁移 |
| `src/views/private-chat/PrivateChatView.vue` | adapter | store v2 | 待迁移 |
| `src/components/rightBox/PrivateChatDialog.vue` | adapter | store v2 | 待迁移 |

### 移动端组件

| 组件文件 | 当前使用 | 迁移到 | 状态 |
|---------|---------|--------|------|
| `src/mobile/views/friends/AddFriends.vue` | integration | store v2 | 待迁移 |
| `src/mobile/views/friends/FriendInfo.vue` | integration | store v2 | 待迁移 |
| `src/mobile/views/friends/ConfirmAddFriend.vue` | integration | store v2 | 待迁移 |
| `src/mobile/views/private-chat/MobilePrivateChatView.vue` | store | store v2 | 待迁移 |

---

## 迁移步骤

### 步骤 1: 更新 Import

#### 旧代码

```typescript
// 旧 Store
import { useFriendsStore } from '@/stores/friends'
import { usePrivateChatStore } from '@/stores/privateChat'

// 旧 Adapter
import { matrixFriendAdapter } from '@/adapters'
import { matrixPrivateChatAdapter } from '@/adapters'

// 旧 Integration
import { sendFriendRequest } from '@/integrations/matrix/friendsManager'
```

#### 新代码

```typescript
// 新 Store v2
import { useFriendsStoreV2 } from '@/stores/friendsV2'
import { usePrivateChatStoreV2 } from '@/stores/privateChatV2'

// 或者使用统一入口
import { useFriendsStoreV2, usePrivateChatStoreV2 } from '@/services/index-v2'
```

### 步骤 2: 初始化 Store

#### 旧代码

```typescript
const friendsStore = useFriendsStore()

onMounted(async () => {
  await friendsStore.refreshAll()
})
```

#### 新代码

```typescript
const friendsStore = useFriendsStoreV2()

onMounted(async () => {
  // initialize() 会自动加载数据
  await friendsStore.initialize()
})
```

### 步骤 3: 更新状态访问

#### 好友 Store

| 旧属性 | 新属性 | 说明 |
|-------|-------|------|
| `friends` | `friends` | 相同 |
| `categories` | `categories` | 相同 |
| `pending` | `pending` | 相同 |
| `loading` | `loading` | 相同 |
| `error` | `error` | 相同 |
| N/A | `friendsByCategory` | 新增：按分类分组 |
| N/A | `onlineFriendsCount` | 新增：在线好友数 |
| N/A | `totalFriendsCount` | 新增：好友总数 |
| N/A | `pendingCount` | 新增：待处理请求数 |

#### 私聊 Store

| 旧属性 | 新属性 | 说明 |
|-------|-------|------|
| `sessions` | `sessions` | 相同 |
| `messages` | `messages` | Map 结构，按 sessionId 组织 |
| `currentRoomId` | `currentSessionId` | 名称变更 |
| N/A | `currentSession` | 新增：当前会话对象 |
| N/A | `currentMessages` | 新增：当前会话消息 |
| N/A | `currentUnreadCount` | 新增：当前会话未读数 |
| N/A | `totalSessionsCount` | 新增：会话总数 |

### 步骤 4: 更新方法调用

#### 好友方法

| 旧方法 | 新方法 | 说明 |
|-------|-------|------|
| `refreshAll()` | `initialize()` | 新方法自动加载数据 |
| `request(targetId, message)` | `sendRequest(targetId, message, categoryId?)` | 参数更明确 |
| `accept(requestId, categoryId)` | `acceptRequest(requestId, categoryId?)` | 方法名更清晰 |
| `reject(requestId)` | `rejectRequest(requestId)` | 方法名更清晰 |
| `search(query)` | `searchUsers(query, limit)` | 方法名更清晰 |

#### 私聊方法

| 旧方法 | 新方法 | 说明 |
|-------|-------|------|
| `createSession(targetId)` | `createSession({ participants, session_name, ttl_seconds })` | 参数结构化 |
| `sendMessage(content)` | `sendMessage(content)` | 相同（需要先 selectSession） |
| N/A | `selectSession(sessionId)` | 新增：选择会话 |
| N/A | `loadMessages(sessionId, limit, before?)` | 新增：加载消息 |

### 步骤 5: 更新类型引用

#### 旧类型

```typescript
import type { Friend, FriendCategory, FriendRequest } from '@/adapters/service-adapter'
import type { PrivateChatSession, PrivateChatMessage } from '@/adapters/service-adapter'
```

#### 新类型

```typescript
import type { FriendItem, FriendCategoryItem, PendingRequestItem } from '@/types/matrix-sdk-v2'
import type { PrivateChatSessionItem, PrivateChatMessageItem } from '@/types/matrix-sdk-v2'
```

---

## 代码示例

### 示例 1: 好友列表组件

#### 旧代码（FriendsList.vue）

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { matrixFriendAdapter } from '@/adapters'
import type { Friend, FriendCategory, FriendRequest } from '@/adapters/service-adapter'

const friends = ref<Friend[]>([])
const categories = ref<FriendCategory[]>([])
const pendingRequests = ref<FriendRequest[]>([])

const loadFriends = async () => {
  friends.value = await matrixFriendAdapter.listFriends({ includePresence: true })
}

const loadCategories = async () => {
  categories.value = await matrixFriendAdapter.listCategories()
}

const loadPending = async () => {
  pendingRequests.value = await matrixFriendAdapter.getPendingRequests()
}

onMounted(async () => {
  await Promise.all([loadFriends(), loadCategories(), loadPending()])
})

const sendRequest = async (userId: string) => {
  await matrixFriendAdapter.sendFriendRequest(userId, '请加我好友')
  await loadFriends()
}
</script>
```

#### 新代码（使用 v2 Store）

```vue
<script setup lang="ts">
import { onMounted } from 'vue'
import { useFriendsStoreV2 } from '@/stores/friendsV2'

// 使用 v2 Store
const friendsStore = useFriendsStoreV2()

// 访问状态（响应式）
const { friends, categories, pending, loading, error } = storeToRefs(friendsStore)

// 计算属性
const onlineCount = computed(() => friendsStore.onlineFriendsCount)
const totalCount = computed(() => friendsStore.totalFriendsCount)

// 初始化（自动加载所有数据）
onMounted(async () => {
  await friendsStore.initialize()
})

// 发送好友请求
const sendRequest = async (userId: string) => {
  await friendsStore.sendRequest(userId, '请加我好友')
  // 无需手动刷新，Store 会自动更新
}
</script>

<template>
  <div v-if="loading">加载中...</div>
  <div v-else-if="error">{{ error }}</div>
  <div v-else>
    <div>好友总数: {{ totalCount }}</div>
    <div>在线好友: {{ onlineCount }}</div>

    <div v-for="friend in friends" :key="friend.user_id">
      {{ friend.display_name || friend.user_id }}
    </div>
  </div>
</template>
```

### 示例 2: 私聊组件

#### 旧代码（PrivateChatView.vue）

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { matrixPrivateChatAdapter } from '@/adapters'
import type { PrivateChatSession, PrivateChatMessage } from '@/adapters/service-adapter'

const sessions = ref<PrivateChatSession[]>([])
const messages = ref<PrivateChatMessage[]>([])
const activeSessionId = ref<string>()

const loadSessions = async () => {
  sessions.value = await matrixPrivateChatAdapter.listSessions()
}

const loadMessages = async (sessionId: string) => {
  messages.value = await matrixPrivateChatAdapter.getMessages(sessionId, 50)
}

const sendMessage = async (content: string) => {
  if (!activeSessionId.value) return
  await matrixPrivateChatAdapter.sendMessage(activeSessionId.value, content, 'text')
  await loadMessages(activeSessionId.value)
}

onMounted(loadSessions)
</script>
```

#### 新代码（使用 v2 Store）

```vue
<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { usePrivateChatStoreV2 } from '@/stores/privateChatV2'

// 使用 v2 Store
const privateChatStore = usePrivateChatStoreV2()

// 访问状态
const { sessions, currentSession, currentMessages, loading, error } = storeToRefs(privateChatStore)

// 选择会话
const selectSession = async (sessionId: string) => {
  await privateChatStore.selectSession(sessionId)
  // 消息会自动加载并订阅更新
}

// 发送消息
const sendMessage = async (content: string) => {
  await privateChatStore.sendMessage(content)
  // 消息会自动添加到列表
}

// 生命周期
onMounted(async () => {
  await privateChatStore.initialize()
})

onUnmounted(() => {
  // 清理资源
  privateChatStore.dispose()
})
</script>

<template>
  <div>
    <!-- 会话列表 -->
    <div v-for="session in sessions" :key="session.session_id" @click="selectSession(session.session_id)">
      {{ session.session_name || '未命名' }}
    </div>

    <!-- 当前会话消息 -->
    <div v-if="currentSession">
      <h3>{{ currentSession.session_name }}</h3>
      <div v-for="message in currentMessages" :key="message.message_id">
        {{ message.content }}
      </div>
    </div>
  </div>
</template>
```

---

## 测试验证

### 单元测试

```typescript
// tests/components/FriendsList.spec.ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import FriendsList from '@/components/friends/FriendsList.vue'

describe('FriendsList (v2)', () => {
  it('should load friends on mount', async () => {
    const wrapper = mount(FriendsList, {
      global: {
        plugins: [createPinia()]
      }
    })

    // 等待初始化
    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 100))

    // 验证状态
    expect(wrapper.vm.friendsStore.loading).toBe(false)
    expect(wrapper.vm.friendsStore.friends).toBeDefined()
  })

  it('should send friend request', async () => {
    const wrapper = mount(FriendsList, {
      global: {
        plugins: [createPinia()]
      }
    })

    await wrapper.vm.sendRequest('@alice:matrix.org')
    expect(wrapper.vm.friendsStore.friends.length).toBeGreaterThan(0)
  })
})
```

### 集成测试

```bash
# 运行所有测试
pnpm run test:run

# 运行特定测试
pnpm run test:run -- FriendsList

# 查看覆盖率
pnpm run coverage
```

### 手动测试清单

#### 好友功能

- [ ] 加载好友列表
- [ ] 按分类筛选好友
- [ ] 搜索好友
- [ ] 发送好友请求
- [ ] 接受好友请求
- [ ] 拒绝好友请求
- [ ] 删除好友
- [ ] 设置好友备注
- [ ] 设置好友分类
- [ ] 查看好友在线状态

#### 私聊功能

- [ ] 加载会话列表
- [ ] 创建新会话
- [ ] 选择会话
- [ ] 发送消息
- [ ] 接收新消息
- [ ] 加载历史消息
- [ ] 删除会话
- [ ] 清空历史
- [ ] 消息自毁设置

---

## 注意事项

### 1. 生命周期管理

```typescript
// 正确：清理资源
onUnmounted(() => {
  privateChatStore.dispose()
})

// 错误：忘记清理
// 会导致内存泄漏
```

### 2. 错误处理

```typescript
// 推荐：使用 try-catch
try {
  await friendsStore.sendRequest(userId, message)
  message.success('请求已发送')
} catch (error) {
  message.error('发送失败: ' + error)
}
```

### 3. 响应式访问

```typescript
// 推荐：使用 storeToRefs
const { friends, loading } = storeToRefs(friendsStore)

// 不推荐：直接解构（失去响应性）
const { friends, loading } = friendsStore
```

### 4. 平台检测

```typescript
// PC 端和移动端使用相同代码
import { isMobile } from '@/utils/platform'

const friendsStore = useFriendsStoreV2() // 统一

// UI 层适配
const className = isMobile ? 'mobile-friends-list' : 'friends-list'
```

---

## 故障排除

### 问题: Store 初始化失败

**症状**: `friendsStore.initialize()` 抛出错误

**原因**: Matrix 客户端未初始化

**解决**:
```typescript
import { matrixClientService } from '@/services/matrixClientService'

// 先初始化 Matrix 客户端
await matrixClientService.initialize({ ... })

// 再初始化 Store
await friendsStore.initialize()
```

### 问题: 消息不更新

**症状**: 发送消息后列表不更新

**原因**: 未调用 `selectSession`

**解决**:
```typescript
// 选择会话后才能发送消息
await privateChatStore.selectSession(sessionId)
await privateChatStore.sendMessage(content)
```

### 问题: 类型错误

**症状**: TypeScript 编译错误

**原因**: 类型不匹配

**解决**:
```typescript
// 确保导入正确的类型
import type { FriendItem } from '@/types/matrix-sdk-v2'

// 而不是旧类型
// import type { Friend } from '@/adapters/service-adapter'
```

---

## 下一步

1. **阅读使用文档**: `docs/MATRIX_SDK_V2_USAGE.md`
2. **查看示例组件**: `src/components/examples/MatrixSDKV2Example.vue`
3. **运行测试**: `pnpm run test:run`
4. **开始迁移**: 从优先级 P0 组件开始

---

**文档版本**: v1.0.0
**最后更新**: 2026-01-02
**状态**: ✅ Phase 5 进行中
