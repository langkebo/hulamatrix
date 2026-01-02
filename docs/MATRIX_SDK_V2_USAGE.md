# Matrix SDK v2.0 使用指南

> HuLamatrix 项目 - 统一 PC 端和移动端实现

**版本**: 2.0.0
**更新日期**: 2026-01-02

---

## 📋 目录

1. [快速开始](#快速开始)
2. [好友系统](#好友系统)
3. [私聊增强](#私聊增强)
4. [Store 使用](#store-使用)
5. [平台适配](#平台适配)
6. [迁移指南](#迁移指南)

---

## 快速开始

### 安装依赖

确保 `matrix-js-sdk` 版本为 39.1.3 或更高：

```bash
pnpm install matrix-js-sdk@39.1.3
```

### 导入

```typescript
// 导入服务和 Store
import {
    friendsServiceV2,
    privateChatServiceV2,
    useFriendsStoreV2,
    usePrivateChatStoreV2
} from '@/services/index-v2'

// 或单独导入
import { friendsServiceV2 } from '@/services/friendsServiceV2'
import { useFriendsStoreV2 } from '@/stores/friendsV2'
```

### 初始化

```typescript
import { onMounted } from 'vue'
import { initializeV2Services } from '@/services/index-v2'

onMounted(async () => {
    await initializeV2Services()
})
```

---

## 好友系统

### 基础用法

#### 获取好友列表

```typescript
import { useFriendsStoreV2 } from '@/stores/friendsV2'

const friendsStore = useFriendsStoreV2()

// 初始化并加载好友
await friendsStore.initialize()

// 访问好友列表
console.log(friendsStore.friends) // FriendItem[]

// 按分类分组
console.log(friendsStore.friendsByCategory) // Map<string | null, FriendItem[]>
```

#### 发送好友请求

```typescript
async function addFriend(userId: string) {
    try {
        const requestId = await friendsStore.sendRequest(
            userId,
            '请加我好友',
            1 // 分类 ID
        )
        console.log('请求已发送:', requestId)
    } catch (error) {
        console.error('发送失败:', error)
    }
}
```

#### 处理好友请求

```typescript
// 接受请求
await friendsStore.acceptRequest(requestId, 1)

// 拒绝请求
await friendsStore.rejectRequest(requestId)

// 批量接受
await friendsStore.acceptBatch([requestId1, requestId2], 1)
```

#### 搜索用户

```typescript
await friendsStore.searchUsers('alice')

// 访问搜索结果
console.log(friendsStore.searchResults)
```

### 事件监听

```typescript
import { friendsServiceV2 } from '@/services/friendsServiceV2'

// 监听好友添加
friendsServiceV2.on('friend.add', (data) => {
    console.log('新好友:', data.friendId)
})

// 监听好友请求
friendsServiceV2.on('request.received', (request) => {
    console.log('收到好友请求:', request)
})
```

---

## 私聊增强

### 基础用法

#### 获取会话列表

```typescript
import { usePrivateChatStoreV2 } from '@/stores/privateChatV2'

const privateChatStore = usePrivateChatStoreV2()

// 初始化并加载会话
await privateChatStore.initialize()

// 访问会话列表
console.log(privateChatStore.sessions) // PrivateChatSessionItem[]
```

#### 创建会话

```typescript
async function startPrivateChat(userId: string) {
    try {
        const session = await privateChatStore.createSession({
            participants: [userId],
            session_name: '私密聊天',
            ttl_seconds: 3600 // 1小时后过期
        })

        // 选择会话
        await privateChatStore.selectSession(session.session_id)

        return session
    } catch (error) {
        console.error('创建会话失败:', error)
    }
}
```

#### 发送消息

```typescript
// 发送文本
await privateChatStore.sendMessage('你好！')
```

#### 获取消息

```typescript
// 加载消息
await privateChatStore.loadMessages(sessionId, 50)

// 加载更多消息（分页）
await privateChatStore.loadMoreMessages(sessionId)

// 访问当前会话消息
console.log(privateChatStore.currentMessages)
```

### 订阅新消息

SDK v2.0 会自动轮询新消息（3秒间隔），无需手动实现：

```typescript
// 选择会话时自动订阅
await privateChatStore.selectSession(sessionId)

// 新消息会自动添加到 privateChatStore.currentMessages

// 取消选择时自动取消订阅
privateChatStore.deselectSession()
```

### 事件监听

```typescript
import { privateChatServiceV2 } from '@/services/privateChatServiceV2'

// 监听新消息
privateChatServiceV2.on('message.received', (message) => {
    console.log('新消息:', message.content)
})
```

---

## Store 使用

### 好友 Store (useFriendsStoreV2)

#### 状态

```typescript
const friendsStore = useFriendsStoreV2()

// 状态
friendsStore.loading        // boolean
friendsStore.error          // string
friendsStore.friends        // FriendItem[]
friendsStore.categories     // FriendCategoryItem[]
friendsStore.pending        // PendingRequestItem[]
friendsStore.stats          // FriendStats | null
friendsStore.initialized    // boolean
```

#### 计算属性

```typescript
friendsStore.friendsByCategory    // Map<string | null, FriendItem[]>
friendsStore.onlineFriendsCount  // number
friendsStore.pendingCount        // number
friendsStore.totalFriendsCount   // number
friendsStore.isLoaded           // boolean
```

#### 操作

```typescript
// 初始化
await friendsStore.initialize()

// 刷新数据
await friendsStore.refreshAll()
await friendsStore.refreshFriends()
await friendsStore.refreshPending()

// 发送请求
await friendsStore.sendRequest(targetId, message, categoryId)

// 响应请求
await friendsStore.acceptRequest(requestId, categoryId)
await friendsStore.rejectRequest(requestId)
await friendsStore.acceptBatch([id1, id2])
await friendsStore.rejectBatch([id1, id2])

// 删除好友
await friendsStore.removeFriend(friendId)

// 搜索
await friendsStore.searchUsers(query, limit)
friendsStore.clearSearchResults()

// 工具
friendsStore.invalidateCache()
friendsStore.isFriend(userId)
friendsStore.getFriend(userId)
friendsStore.getCategory(categoryId)
```

### 私聊 Store (usePrivateChatStoreV2)

#### 状态

```typescript
const privateChatStore = usePrivateChatStoreV2()

// 状态
privateChatStore.loading              // boolean
privateChatStore.error                // string
privateChatStore.sessions             // PrivateChatSessionItem[]
privateChatStore.currentSessionId     // string | null
privateChatStore.initialized          // boolean
```

#### 计算属性

```typescript
privateChatStore.currentSession      // PrivateChatSessionItem | null
privateChatStore.currentMessages     // PrivateChatMessageItem[]
privateChatStore.currentUnreadCount  // number
privateChatStore.totalSessionsCount  // number
privateChatStore.isLoaded           // boolean
```

#### 操作

```typescript
// 初始化
await privateChatStore.initialize()

// 刷新会话
await privateChatStore.refreshSessions()

// 会话管理
await privateChatStore.createSession({ participants, session_name, ttl_seconds })
await privateChatStore.deleteSession(sessionId)
await privateChatStore.selectSession(sessionId)
privateChatStore.deselectSession()

// 消息操作
await privateChatStore.loadMessages(sessionId, limit, before)
await privateChatStore.loadMoreMessages(sessionId)
await privateChatStore.sendMessage(content)

// 工具
privateChatStore.invalidateCache()
privateChatStore.dispose()
privateChatStore.getSession(sessionId)
privateChatStore.hasSession(sessionId)
```

---

## 平台适配

### PC 端组件示例

```vue
<script setup lang="ts">
import { onMounted } from 'vue'
import { useFriendsStoreV2 } from '@/stores/friendsV2'

const friendsStore = useFriendsStoreV2()

onMounted(async () => {
    await friendsStore.initialize()
})

function handleSendRequest(userId: string) {
    friendsStore.sendRequest(userId, '请加我好友')
}
</script>

<template>
    <div class="friends-page">
        <h1>好友列表</h1>
        <div v-if="friendsStore.loading">加载中...</div>
        <div v-else>
            <div v-for="friend in friendsStore.friends" :key="friend.user_id">
                {{ friend.display_name || friend.user_id }}
                <button @click="handleSendRequest(friend.user_id)">添加</button>
            </div>
        </div>
    </div>
</template>
```

### 移动端组件示例

```vue
<script setup lang="ts">
import { onMounted } from 'vue'
import { useFriendsStoreV2 } from '@/stores/friendsV2'

const friendsStore = useFriendsStoreV2()

onMounted(async () => {
    await friendsStore.initialize()
})
</script>

<template>
    <div class="friends-mobile">
        <!-- 移动端样式适配 -->
        <div class="friend-item" v-for="friend in friendsStore.friends" :key="friend.user_id">
            {{ friend.display_name || friend.user_id }}
        </div>
    </div>
</template>

<style scoped>
.friend-item {
    padding: 12px;
    border-bottom: 1px solid #eee;
}
</style>
```

---

## 迁移指南

### 从旧 Store 迁移

#### 旧代码

```typescript
// 旧好友 Store
import { useFriendsStore } from '@/stores/friends'
const friendsStore = useFriendsStore()
await friendsStore.refreshAll()
```

#### 新代码

```typescript
// 新好友 Store v2
import { useFriendsStoreV2 } from '@/stores/friendsV2'
const friendsStore = useFriendsStoreV2()
await friendsStore.initialize() // 自动刷新
```

### API 变更对照

| 旧 API | 新 API | 说明 |
|--------|--------|------|
| `refreshAll()` | `initialize()` | 新版本自动加载数据 |
| `request(targetId, message)` | `sendRequest(targetId, message, categoryId?)` | 参数更明确 |
| `accept(requestId, categoryId)` | `acceptRequest(requestId, categoryId?)` | 方法名更清晰 |
| `reject(requestId)` | `rejectRequest(requestId)` | 方法名更清晰 |

### 类型变更

```typescript
// 旧类型
import type { FriendItem } from '@/stores/friends'

// 新类型
import type { FriendItem } from '@/types/matrix-sdk-v2'
```

---

## 最佳实践

### 1. 组件初始化

```typescript
import { onMounted, onUnmounted } from 'vue'
import { useFriendsStoreV2, usePrivateChatStoreV2 } from '@/stores/index-v2'

const friendsStore = useFriendsStoreV2()
const privateChatStore = usePrivateChatStoreV2()

onMounted(async () => {
    // 初始化 Store
    await Promise.all([
        friendsStore.initialize(),
        privateChatStore.initialize()
    ])
})

onUnmounted(() => {
    // 清理私聊资源
    privateChatStore.dispose()
})
```

### 2. 错误处理

```typescript
try {
    await friendsStore.sendRequest(userId, '请加我好友')
    // 成功处理
} catch (error) {
    // 错误处理
    console.error('发送失败:', error)
    // 显示用户友好的错误提示
}
```

### 3. 响应式使用

```vue
<template>
    <div>
        <!-- 自动响应数据变化 -->
        <div v-if="friendsStore.loading">加载中...</div>
        <div v-else-if="friendsStore.error">错误: {{ friendsStore.error }}</div>
        <div v-else>
            好友数量: {{ friendsStore.totalFriendsCount }}
        </div>
    </div>
</template>
```

### 4. 性能优化

```typescript
// 使用缓存（默认）
await friendsStore.refreshFriends() // 使用 5 分钟缓存

// 强制刷新
friendsStore.invalidateCache()
await friendsStore.refreshFriends()
```

---

## 完整示例

### Vue 3 组件

```vue
<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useFriendsStoreV2, usePrivateChatStoreV2 } from '@/services/index-v2'

const friendsStore = useFriendsStoreV2()
const privateChatStore = usePrivateChatStoreV2()

// 搜索关键词
const searchQuery = ref('')

// 过滤后的好友列表
const filteredFriends = computed(() => {
    if (!searchQuery.value) return friendsStore.friends
    return friendsStore.friends.filter(f =>
        f.display_name?.includes(searchQuery.value) ||
        f.user_id.includes(searchQuery.value)
    )
})

onMounted(async () => {
    await Promise.all([
        friendsStore.initialize(),
        privateChatStore.initialize()
    ])
})

async function handleAddFriend(userId: string) {
    try {
        await friendsStore.sendRequest(userId, '请加我好友')
        alert('好友请求已发送')
    } catch (error) {
        alert('发送失败: ' + error)
    }
}

async function handleStartChat(userId: string) {
    try {
        const session = await privateChatStore.createSession({
            participants: [userId],
            session_name: '私聊'
        })
        await privateChatStore.selectSession(session.session_id)
        // 导航到聊天页面
        router.push(`/chat/${session.session_id}`)
    } catch (error) {
        alert('创建会话失败: ' + error)
    }
}
</script>

<template>
    <div class="friends-page">
        <h1>好友系统</h1>

        <!-- 搜索框 -->
        <input v-model="searchQuery" placeholder="搜索好友..." />

        <!-- 统计信息 -->
        <div class="stats">
            <span>总好友: {{ friendsStore.totalFriendsCount }}</span>
            <span>在线: {{ friendsStore.onlineFriendsCount }}</span>
            <span>待处理: {{ friendsStore.pendingCount }}</span>
        </div>

        <!-- 好友列表 -->
        <div v-if="friendsStore.loading">加载中...</div>
        <div v-else>
            <div v-for="friend in filteredFriends" :key="friend.user_id" class="friend-item">
                <span>{{ friend.display_name || friend.user_id }}</span>
                <span :class="{ online: friend.presence === 'online' }">
                    {{ friend.presence }}
                </span>
                <button @click="handleAddFriend(friend.user_id)">添加</button>
                <button @click="handleStartChat(friend.user_id)">聊天</button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.friend-item {
    display: flex;
    gap: 12px;
    padding: 12px;
    border-bottom: 1px solid #eee;
}

.online {
    color: green;
}
</style>
```

---

**文档版本**: v1.0
**最后更新**: 2026-01-02
