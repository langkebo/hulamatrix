# Sliding Sync 使用示例

本文档提供了 HuLa 应用中使用 Sliding Sync 的实际示例。

## 目录

1. [基本初始化](#基本初始化)
2. [在 Vue 组件中使用](#在-vue-组件中使用)
3. [与现有 MatrixRoomList 集成](#与现有-matrixroomlist-集成)
4. [监听事件](#监听事件)
5. [调试和监控](#调试和监控)

---

## 基本初始化

### 应用启动时初始化

在应用启动时检测服务器能力并初始化 Sliding Sync：

```typescript
// src/App.vue 或 src/main.ts
import { slidingSyncFallback } from '@/services/slidingSyncFallback'
import { logger } from '@/utils/logger'

async function initializeSlidingSync() {
  try {
    // 检测服务器能力
    const capabilities = await slidingSyncFallback.detectCapabilities()

    logger.info('[App] Server capabilities:', capabilities)

    if (capabilities.slidingSync) {
      logger.info('[App] Sliding Sync is available')
    } else {
      logger.info('[App] Falling back to traditional sync')
    }
  } catch (error) {
    logger.error('[App] Failed to initialize Sliding Sync:', error)
  }
}

// 在应用挂载后调用
onMounted(async () => {
  await initializeSlidingSync()
})
```

---

## 在 Vue 组件中使用

### 示例 1: 简单的房间列表

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useRoomList } from '@/hooks/useSlidingSync'
import type { MSC3575RoomData } from '@/types/sliding-sync'

const {
  list: rooms,
  loading,
  error,
  hasMore,
  loadMore
} = useRoomList({
  autoLoad: true
})

const selectedRoom = ref<MSC3575RoomData | null>(null)

function selectRoom(room: MSC3575RoomData) {
  selectedRoom.value = room
  // 处理房间选择逻辑
}
</script>

<template>
  <div class="room-list">
    <div v-if="loading">Loading...</div>
    <div v-else-if="error">Error: {{ error }}</div>
    <div v-else>
      <div
        v-for="room in rooms"
        :key="room.room_id"
        @click="selectRoom(room)"
      >
        {{ room.name }}
      </div>
      <button
        v-if="hasMore"
        @click="loadMore"
      >
        Load More
      </button>
    </div>
  </div>
</template>
```

### 示例 2: 使用 SlidingSyncRoomList 组件

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { SlidingSyncRoomList } from '@/components/sliding-sync'
import type { MSC3575RoomData } from '@/types/sliding-sync'

const selectedRoomId = ref('')

function handleSelectRoom(room: MSC3575RoomData) {
  selectedRoomId.value = room.room_id
  console.log('Selected room:', room)
}

function handleError(error: string) {
  console.error('Room list error:', error)
}
</script>

<template>
  <div class="chat-sidebar">
    <SlidingSyncRoomList
      :selected-room-id="selectedRoomId"
      :show-search="true"
      @select-room="handleSelectRoom"
      @error="handleError"
    />
  </div>
</template>
```

### 示例 3: 搜索房间

```vue
<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoomList } from '@/hooks/useSlidingSync'

const searchQuery = ref('')

const {
  list: rooms,
  search: searchRooms,
  clearFilter
} = useRoomList()

// 防抖搜索
let searchTimeout: ReturnType<typeof setTimeout>

watch(searchQuery, (newQuery) => {
  clearTimeout(searchTimeout)

  if (newQuery) {
    searchTimeout = setTimeout(() => {
      searchRooms(newQuery)
    }, 300)
  } else {
    clearFilter()
  }
})
</script>

<template>
  <div>
    <input
      v-model="searchQuery"
      type="text"
      placeholder="搜索房间..."
    />

    <div v-for="room in rooms" :key="room.room_id">
      {{ room.name }}
    </div>
  </div>
</template>
```

### 示例 4: 显示在线状态

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useSlidingSyncPresence } from '@/hooks/useSlidingSync'
import { SlidingSyncPresenceIndicator } from '@/components/sliding-sync'

const props = defineProps<{
  userId: string
  displayName?: string
}>()

const { getPresence, isOnline } = useSlidingSyncPresence()

const presence = computed(() => getPresence(props.userId))
const online = computed(() => isOnline(props.userId))
</script>

<template>
  <div class="user-status">
    <span>{{ displayName || userId }}</span>
    <SlidingSyncPresenceIndicator
      :user-id="userId"
      :display-name="displayName"
    />
    <span>{{ online ? '在线' : '离线' }}</span>
  </div>
</template>
```

---

## 与现有 MatrixRoomList 集成

### 渐进式集成策略

逐步替换现有的房间列表实现：

```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { slidingSyncFallback } from '@/services/slidingSyncFallback'
import { SlidingSyncRoomList } from '@/components/sliding-sync'
import { MatrixRoomList } from '@/components/matrix' // 现有组件

const isSlidingSyncAvailable = computed(() =>
  slidingSyncFallback.isSlidingSync()
)
</script>

<template>
  <div class="room-list-container">
    <!-- 使用 Sliding Sync 如果可用 -->
    <SlidingSyncRoomList
      v-if="isSlidingSyncAvailable"
      :selected-room-id="selectedRoomId"
      @select-room="handleSelectRoom"
    />

    <!-- 否则使用传统组件 -->
    <MatrixRoomList
      v-else
      :selected-room-id="selectedRoomId"
      @select-room="handleSelectRoom"
    />
  </div>
</template>
```

### 混合模式

同时使用两种数据源：

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useRoomList } from '@/hooks/useSlidingSync'
import { useFriendsStore } from '@/stores/friends'

// Sliding Sync 提供房间列表
const { list: rooms } = useRoomList()

// FriendsClient 提供好友信息
const friendsStore = useFriendsStore()

// 合并数据
const enrichedRooms = computed(() => {
  return rooms.value?.map(room => {
    const friend = friendsStore.friends.find(f =>
      f.user_id === extractUserIdFromRoom(room.room_id)
    )

    return {
      ...room,
      friendInfo: friend,
      displayName: friend?.display_name || room.name,
      category: friend?.category_id
    }
  }) || []
})
</script>
```

---

## 监听事件

### 监听房间更新

```typescript
import { subscribeToEvent } from '@/services/slidingSyncEventAggregator'
import { onUnmounted } from 'vue'

// 订阅房间更新事件
const unsubscribe = subscribeToEvent('room.updated', (data) => {
  console.log('Room updated:', data)
  // 更新 UI
})

// 组件卸载时取消订阅
onUnmounted(() => {
  unsubscribe()
})
```

### 监听 Presence 更新

```typescript
import { subscribeToEvent } from '@/services/slidingSyncEventAggregator'

const unsubscribe = subscribeToEvent('presence.updated', (data) => {
  const { source, originalEvent, data: presenceData } = data

  if (source === 'SlidingSync') {
    console.log('Presence from Sliding Sync:', presenceData)
  } else if (source === 'TraditionalSync') {
    console.log('Presence from traditional sync:', presenceData)
  }
})
```

### 监听好友事件

```typescript
const unsubscribe = subscribeToEvent('friend.added', (data) => {
  console.log('Friend added:', data)
  // 刷新好友列表
  friendsStore.loadFriends()
})
```

---

## 调试和监控

### 添加状态面板

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { SlidingSyncStatusPanel } from '@/components/sliding-sync'

const showStatusPanel = ref(false)

// 快捷键 Ctrl+Shift+S 打开状态面板
function toggleStatusPanel() {
  showStatusPanel.value = !showStatusPanel.value
}

onMounted(() => {
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'S') {
      toggleStatusPanel()
    }
  })
})
</script>

<template>
  <div>
    <button @click="toggleStatusPanel">
      Toggle Status Panel
    </button>

    <SlidingSyncStatusPanel
      v-if="showStatusPanel"
      :can-toggle="true"
    />
  </div>
</template>
```

### 查看缓存统计

```typescript
import { slidingSyncCache } from '@/services/slidingSyncCacheService'

// 获取缓存统计
const stats = slidingSyncCache.getStats()
console.log('Cache stats:', stats)
console.log('Hit rate:', slidingSyncCache.getHitRate())

// 清理过期缓存
await slidingSyncCache.cleanup()

// 清空所有缓存
await slidingSyncCache.clear()
```

### 查看事件统计

```typescript
import { slidingSyncEventAggregator } from '@/services/slidingSyncEventAggregator'

const stats = slidingSyncEventAggregator.getStats()
console.log('Event stats:', {
  received: stats.eventsReceived,
  emitted: stats.eventsEmitted,
  deduplicated: stats.eventsDeduplicated,
  deduplicationRate: stats.deduplicationRate
})
```

---

## 错误处理

### 全局错误处理

```typescript
import { slidingSyncFallback } from '@/services/slidingSyncFallback'

// 监听 Sliding Sync 错误
async function handleSlidingSyncError(error: Error) {
  console.error('Sliding Sync error:', error)

  // 报告错误，如果连续失败则自动降级
  await slidingSyncFallback.reportError(error)

  // 检查当前模式
  const mode = slidingSyncFallback.getMode()
  console.log('Current sync mode:', mode)
}
```

### 组件级错误处理

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useRoomList } from '@/hooks/useSlidingSync'

const {
  list: rooms,
  loading,
  error,
  load
} = useRoomList()

const retryCount = ref(0)
const maxRetries = 3

async function handleRetry() {
  if (retryCount.value < maxRetries) {
    retryCount.value++
    await load()
  } else {
    // 降级到传统同步
    console.warn('Max retries reached, falling back')
  }
}
</script>

<template>
  <div>
    <div v-if="error" class="error">
      <p>{{ error }}</p>
      <button @click="handleRetry">重试</button>
    </div>
    <div v-else>
      <!-- 正常内容 -->
    </div>
  </div>
</template>
```

---

## 性能优化技巧

### 虚拟滚动

对于大量房间，使用虚拟滚动：

```vue
<script setup lang="ts">
import { useRoomList } from '@/hooks/useSlidingSync'
import { useVirtualList } from '@vueuse/core'

const { list: allRooms } = useRoomList()

const { list: virtualList, containerProps, wrapperProps } = useVirtualList(
  allRooms,
  {
    itemHeight: 60,
    overscan: 10
  }
)
</script>

<template>
  <div v-bind="containerProps" style="height: 500px; overflow: auto;">
    <div v-bind="wrapperProps">
      <div
        v-for="{ data: room, index } in virtualList"
        :key="room.room_id"
        style="height: 60px;"
      >
        {{ room.name }}
      </div>
    </div>
  </div>
</template>
```

### 按需加载

只加载可见区域的数据：

```typescript
const {
  load,
  loadMore
} = useRoomList({
  initialRanges: [[0, 19]] // 只加载前 20 个
})

// 用户滚动到底部时加载更多
function handleScrollToBottom() {
  if (hasMore.value) {
    loadMore(20)
  }
}
```

---

## 总结

- ✅ 使用 Composables 简化组件逻辑
- ✅ 利用自动降级确保兼容性
- ✅ 监听事件实现实时更新
- ✅ 使用状态面板进行调试
- ✅ 实现错误处理和重试逻辑
- ✅ 优化性能使用虚拟滚动

更多详细信息，请参考 [实现文档](./SLIDING_SYNC_IMPLEMENTATION.md)。
