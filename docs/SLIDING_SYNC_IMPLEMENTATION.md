# Matrix Sliding Sync (MSC3575) Implementation Guide

## 概述 (Overview)

本文档描述了 HuLa 应用中 Matrix Sliding Sync (MSC3575) 的完整实现。Sliding Sync 是 Matrix 的下一代同步协议，相比传统的 `/sync` 端点，它提供更高效、更灵活的房间同步机制。

### 主要特性

- **高效同步**: 使用滑动窗口机制按需加载房间数据
- **自动降级**: 当服务器不支持时自动回退到传统同步
- **混合模式**: 可同时使用 Sliding Sync 和传统同步
- **统一缓存**: 所有系统共享 IndexedDB 和内存缓存
- **事件聚合**: 统一处理来自多个源的事件

---

## 架构 (Architecture)

### 核心组件

```
┌─────────────────────────────────────────────────────────────┐
│                      Vue Components                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ ChatList    │  │ FriendsList │  │ PrivateChat         │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
│         │                │                     │             │
│         └────────────────┴─────────────────────┘             │
│                          │                                   │
┌──────────────────────────┴───────────────────────────────────┤
│                    Vue Composables (use*)                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ useSlidingSync() │ useRoomList() │ useDMList()       │  │
│  └───────────────────────┬──────────────────────────────┘  │
└──────────────────────────┴───────────────────────────────────┘
                           │
┌──────────────────────────┴───────────────────────────────────┐
│                      Pinia Stores                             │
│  ┌─────────────────┐  ┌──────────────────────────────────┐  │
│  │ useSlidingSync  │  │ useChat │ usePresence │ useFriends│  │
│  │     Store       │  │   Store │    Store    │   Store   │  │
│  └────────┬────────┘  └────────────┬─────────────────────┘  │
└───────────┴─────────────────────────┴────────────────────────┘
            │
┌───────────┴───────────────────────────────────────────────────┐
│                    Services Layer                              │
│  ┌─────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ SlidingSync │  │   Fallback      │  │  Event          │  │
│  │   Service    │  │   Strategy      │  │  Aggregator     │  │
│  └──────┬──────┘  └────────┬────────┘  └────────┬────────┘  │
│         │                  │                     │            │
│  ┌──────┴──────┐  ┌────────┴────────┐  ┌────────┴────────┐  │
│  │    Cache    │  │ MatrixClient    │  │  FriendsClient  │  │
│  │   Service   │  │     Service      │  │   & PrivateChat │  │
│  └─────────────┘  └─────────────────┘  └─────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### 文件结构

```
src/
├── types/
│   └── sliding-sync.ts           # MSC3575 类型定义
├── services/
│   ├── matrixSlidingSyncService.ts    # 核心服务
│   ├── slidingSyncCacheService.ts     # 缓存服务
│   ├── slidingSyncEventAggregator.ts  # 事件聚合
│   └── slidingSyncFallback.ts         # 降级策略
├── stores/
│   └── slidingSync.ts            # Pinia Store
├── hooks/
│   └── useSlidingSync.ts         # Vue Composables
└── components/
    └── sliding-sync/             # UI 组件 (可选)
```

---

## 配置 (Configuration)

### 环境变量

在 `.env` 文件中添加以下配置：

```bash
# 启用 Sliding Sync (默认关闭)
VITE_MATRIX_SLIDING_SYNC_ENABLED=on

# Sliding Sync 代理 URL (如果 homeserver 不原生支持)
VITE_MATRIX_SLIDING_SYNC_PROXY=https://sslip.io:8443

# 强制同步模式 (可选)
# sliding-sync = 仅使用 Sliding Sync
# traditional = 仅使用传统同步
# hybrid = 混合模式
VITE_MATRIX_SYNC_MODE=
```

### 服务器要求

Sliding Sync 需要：
1. Matrix Homeserver 支持 MSC3575
2. 或使用 Sliding Sync 代理服务器

---

## 使用方法 (Usage)

### 1. 初始化 Sliding Sync

```typescript
import { slidingSyncFallback } from '@/services/slidingSyncFallback'
import { useSlidingSyncStore } from '@/stores/slidingSync'

// 自动检测服务器能力并初始化
await slidingSyncFallback.detectCapabilities()

// 或者手动初始化
const store = useSlidingSyncStore()
await store.initialize('https://sslip.io:8443')
await store.start()
```

### 2. 使用 Composables

#### 基础使用

```typescript
import { useSlidingSync } from '@/hooks/useSlidingSync'

const {
  isReady,
  loading,
  error,
  list,
  count,
  hasMore,
  load,
  loadMore,
  search
} = useSlidingSync({
  listName: 'all_rooms',
  autoLoad: true,
  initialRanges: [[0, 49]]
})

// 加载房间列表
await load()

// 加载更多
if (hasMore.value) {
  await loadMore(50)
}

// 搜索房间
await search('会议室')
```

#### 专用 Hooks

```typescript
// 房间列表
import { useRoomList } from '@/hooks/useSlidingSync'
const { list: rooms, loading, loadMore } = useRoomList()

// 直接消息列表
import { useDMList } from '@/hooks/useSlidingSync'
const { list: dms, loadWithFriends } = useDMList()

// 收藏房间
import { useFavoriteRooms } from '@/hooks/useSlidingSync'
const { list: favorites } = useFavoriteRooms()

// 未读房间
import { useUnreadRooms } from '@/hooks/useSlidingSync'
const { list: unread } = useUnreadRooms()

// 在线状态
import { useSlidingSyncPresence } from '@/hooks/useSlidingSync'
const { getPresence, isOnline } = useSlidingSyncPresence()
```

### 3. 直接使用 Store

```typescript
import { useSlidingSyncStore } from '@/stores/slidingSync'

const store = useSlidingSyncStore()

// 检查状态
console.log('Is ready:', store.isReady)
console.log('Total rooms:', store.totalRoomsCount)

// 加载列表
await store.loadList('all_rooms', [[0, 49]])

// 订阅房间
store.subscribeToRoom('!roomId:server.com')

// 获取 Presence
const presence = store.getPresence('@user:server.com')
```

### 4. 事件监听

```typescript
import { subscribeToEvent } from '@/services/slidingSyncEventAggregator'

// 监听房间更新
const unsubscribe = subscribeToEvent('room.updated', (data) => {
  console.log('Room updated:', data)
})

// 取消订阅
unsubscribe()
```

---

## API 参考 (API Reference)

### MatrixSlidingSyncService

核心 Sliding Sync 服务。

#### 方法

- `initialize(proxyUrl: string): Promise<void>` - 初始化服务
- `start(): Promise<void>` - 启动同步
- `stop(): void` - 停止同步
- `setupDefaultLists(): void` - 设置默认列表
- `setupExtensions(): void` - 设置扩展
- `createList(name: string, config: MSC3575List): SlidingList | null` - 创建列表
- `adjustRange(listName: string, ranges: number[][]): void` - 调整范围
- `loadMore(listName: string, count?: number): void` - 加载更多
- `searchRooms(listName: string, query: string): void` - 搜索房间
- `subscribeToRoom(roomId: string, config?: MSC3575RoomSubscription): void` - 订阅房间

### SlidingSyncFallbackService

降级策略服务。

#### 方法

- `detectCapabilities(): Promise<ServerCapabilities>` - 检测服务器能力
- `getMode(): SyncMode` - 获取当前同步模式
- `isSlidingSync(): boolean` - 是否使用 Sliding Sync
- `isTraditional(): boolean` - 是否使用传统同步
- `reportError(error: Error): Promise<void>` - 报告错误

### useSlidingSync Store

Pinia store。

#### State

- `isInitialized: boolean` - 是否已初始化
- `isRunning: boolean` - 是否正在运行
- `error: string | null` - 错误信息
- `lists: Record<string, MSC3575RoomData[]>` - 列表数据
- `loading: Record<string, boolean>` - 加载状态
- `counts: Record<string, number>` - 列表计数

#### Computed

- `isReady: boolean` - 是否准备就绪
- `totalRoomsCount: number` - 总房间数
- `hasError: boolean` - 是否有错误

#### Actions

- `initialize(proxyUrl?: string): Promise<void>` - 初始化
- `start(): Promise<void>` - 启动
- `stop(): void` - 停止
- `loadList(listName: string, ranges?: number[][]): Promise<void>` - 加载列表
- `loadMore(listName: string, count?: number): Promise<void>` - 加载更多
- `searchRooms(listName: string, query: string): Promise<void>` - 搜索房间
- `reset(): void` - 重置状态

---

## 集成现有系统 (Integration)

### 与 FriendsClient 集成

FriendsClient 保持独立，但 Sliding Sync 提供增强功能：

```typescript
// 混合模式：Sliding Sync 提供房间列表，FriendsClient 提供好友信息
const { loadWithFriends } = useDMList()
const enrichedDMs = await loadWithFriends()

// 返回的数据包含：
// - Sliding Sync 的房间数据 (room_id, name, avatar_url)
// - FriendsClient 的好友信息 (category_id, category_name, remark)
// - Presence 状态 (is_online, last_active)
```

### 与 Presence Store 集成

```typescript
import { usePresenceStore } from '@/stores/presence'
import { useSlidingSyncPresence } from '@/hooks/useSlidingSync'

// 传统方式：通过 Matrix SDK 事件
const presenceStore = usePresenceStore()
const isOnline = presenceStore.isOnline(userId)

// Sliding Sync 方式：从扩展获取
const { isOnline: ssIsOnline } = useSlidingSyncPresence()
const isOnlineSS = ssIsOnline(userId)
```

---

## 性能优化 (Performance)

### 缓存策略

```typescript
import { slidingSyncCache } from '@/services/slidingSyncCacheService'

// TTL 配置
// LISTS: 5 分钟
// ROOMS: 10 分钟
// FRIENDS: 5 分钟
// PRESENCE: 1 分钟
// MESSAGES: 30 分钟

// 获取缓存
const data = await slidingSyncCache.get('list:all_rooms')

// 设置缓存
await slidingSyncCache.set('list:all_rooms', rooms, 5 * 60 * 1000)

// 清理过期缓存
await slidingSyncCache.cleanup()

// 获取统计信息
const stats = slidingSyncCache.getStats()
console.log('Hit rate:', slidingSyncCache.getHitRate())
```

### 滑动窗口

```typescript
// 初始加载：只加载前 20 个房间
await loadList('all_rooms', [[0, 19]])

// 用户滚动到第 15 个房间时，预加载更多
if (currentIndex > 15) {
  await loadMore(20)  // 加载接下来的 20 个
}

// 调整窗口以保持内存效率
adjustRange('all_rooms', [
  [Math.max(0, currentIndex - 10), currentIndex + 20]
])
```

---

## 故障排查 (Troubleshooting)

### Sliding Sync 无法初始化

**问题**: `Failed to initialize: Sliding Sync URL not configured`

**解决方案**:
1. 检查环境变量 `VITE_MATRIX_SLIDING_SYNC_PROXY` 是否设置
2. 确认 homeserver 支持 MSC3575
3. 检查网络连接

### 自动降级到传统同步

**问题**: 服务自动切换到传统同步模式

**原因**:
- 服务器不支持 Sliding Sync
- 连续多次错误（默认 3 次）

**解决方案**:
- 检查服务器能力
- 查看日志了解错误原因
- 手动设置同步模式

### 缓存问题

**问题**: 数据过期或显示不正确

**解决方案**:
```typescript
// 清空所有缓存
await slidingSyncCache.clear()

// 重置状态
store.reset()
```

---

## 调试 (Debugging)

### 启用调试日志

```typescript
import { slidingSyncFallback } from '@/services/slidingSyncFallback'

// 启用调试模式
slidingSyncFallback.setConfig({
  autoDetect: true,
  allowHybrid: false,
  fallbackOnError: true
})

// 查看当前状态
console.log('Sync mode:', slidingSyncFallback.getMode())
console.log('Capabilities:', slidingSyncFallback.getCapabilities())
```

### 检查事件统计

```typescript
import { slidingSyncEventAggregator } from '@/services/slidingSyncEventAggregator'

// 设置调试模式
slidingSyncEventAggregator.setConfig({ debug: true })

// 获取统计信息
const stats = slidingSyncEventAggregator.getStats()
console.log('Event stats:', stats)
```

---

## 示例 (Examples)

### 完整的房间列表组件

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoomList } from '@/hooks/useSlidingSync'
import type { MSC3575RoomData } from '@/types/sliding-sync'

const {
  list: rooms,
  loading,
  hasMore,
  loadMore
} = useRoomList()

const selectedRoom = ref<MSC3575RoomData | null>(null)

onMounted(async () => {
  // 初始加载
  await load()
})

async function handleLoadMore() {
  if (hasMore.value && !loading.value) {
    await loadMore(50)
  }
}

function selectRoom(room: MSC3575RoomData) {
  selectedRoom.value = room
  // 处理房间选择逻辑
}
</script>

<template>
  <div class="room-list">
    <div v-if="loading">Loading...</div>
    <div
      v-for="room in rooms"
      :key="room.room_id"
      @click="selectRoom(room)"
    >
      {{ room.name }}
    </div>
    <button
      v-if="hasMore"
      @click="handleLoadMore"
      :disabled="loading"
    >
      Load More
    </button>
  </div>
</template>
```

### 混合使用多个数据源

```typescript
import { useDMList } from '@/hooks/useSlidingSync'
import { useFriendsStore } from '@/stores/friends'

const { list: dms, loadWithFriends } = useDMList()
const friendsStore = useFriendsStore()

// 加载合并后的 DM 列表
async function loadDMs() {
  // 从 Sliding Sync 加载（包含好友信息）
  const enrichedDMs = await loadWithFriends()

  // 或者分别加载
  await load()  // Sliding Sync 房间
  await friendsStore.loadFriends()  // FriendsClient 好友

  // 手动合并
  return mergeDMsWithFriends(dms.value, friendsStore.friends)
}
```

---

## 参考资料 (References)

- [MSC3575: Sliding Sync](https://github.com/matrix-org/matrix-spec-proposals/pull/3575)
- [Matrix SDK Documentation](https://matrix-org.github.io/matrix-js-sdk/)
- [Sliding Sync 实现方案 v2.0.0](./SLIDING_SYNC_IMPLEMENTATION_PLAN.md)

---

## 更新日志 (Changelog)

### v1.0.0 (2025-01-07)
- ✅ 完整的 MSC3575 类型定义
- ✅ 核心 SlidingSync 服务实现
- ✅ 统一缓存服务（IndexedDB + 内存）
- ✅ 事件聚合器
- ✅ Pinia Store 和 Vue Composables
- ✅ 自动降级策略
- ✅ 服务器能力检测
- ✅ 环境变量配置
- ✅ TypeScript 类型安全
