# Matrix Sliding Sync (MSC 3575) 实现方案

**版本**: 2.0.0
**创建日期**: 2026-01-07
**最后更新**: 2026-01-07
**目标**: 实现完整的 Sliding Sync 支持，提升同步性能和用户体验
**参考文档**:
- [11-friends-system.md](./11-friends-system.md) - 好友系统
- [12-private-chat-VERIFICATION.md](./12-private-chat-VERIFICATION.md) - 私聊系统

---

## 一、项目现状分析

### 1.1 当前系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        UI Layer (Vue)                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ RoomList.vue │  │ FriendsList  │  │ PrivateChat  │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────┐
│                     Pinia Stores (状态层)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │ useChatStore │  │useFriendsSDK │  │privateChat   │        │
│  │              │  │     Store     │  │    Store     │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │ useRoomStore │  │ usePresence  │  │   useMatrix  │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────┐
│                   Services (服务层)                            │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ Matrix SDK (传统 /sync) + 扩展 API                       │   │
│  │                                                          │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐   │   │
│  │  │ FriendsClient│  │PrivateChat   │  │E2EE Service │   │   │
│  │  │   (v2 API)   │  │   (轮询 3s)  │  │             │   │   │
│  │  └──────────────┘  └──────────────┘  └─────────────┘   │   │
│  │                                                          │   │
│  │  后端 API:                                               │   │
│  │  - /_synapse/client/enhanced/friends/*                   │   │
│  │  - /_synapse/client/enhanced/private_chat/v2/*          │   │
│  └────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 现有系统特性

#### 好友系统 (FriendsClient V2)

**特性**:
- ✅ 完整的好友管理 API
- ✅ 5分钟自动缓存
- ✅ 事件系统: `friend.add`, `friend.remove`, `request.received`, `request.accepted`
- ✅ 好友分组支持 (category_id)
- ✅ 用户搜索功能

**数据结构**:
```typescript
interface Friend {
  user_id: string
  category_id?: number
  category_name?: string
  category_color?: string
  created_at: string
  updated_at?: string
}
```

#### 私聊系统 (PrivateChat SDK)

**特性**:
- ✅ 强制 E2EE 加密
- ✅ 3秒轮询间隔
- ✅ IndexedDB 持久化存储
- ✅ 会话自动过期清理
- ✅ 事件系统: `session.created`, `session.deleted`, `message.received`, `message.sent`

**数据结构**:
```typescript
interface PrivateChatSession {
  session_id: string
  participants: string[]
  session_name?: string
  created_by: string
  created_at: string
  ttl_seconds?: number
  expires_at?: string
  status?: 'active' | 'expired' | 'deleted'
}
```

#### Presence 系统

**特性**:
- ✅ 在线状态管理
- ✅ Presence 事件监听
- ✅ 状态缓存机制

### 1.3 需要解决的问题

| 问题 | 当前状态 | Sliding Sync 方案 |
|------|---------|-----------------|
| 好友列表同步 | FriendsClient API (轮询) | Sliding Sync 实时推送 |
| 私聊会话同步 | PrivateChat 轮询 (3s) | 保持独立轮询（实时性要求） |
| 房间列表同步 | 传统 /sync 全量 | Sliding Sync 滑动窗口 |
| Presence 同步 | Presence 事件 | Sliding Sync 扩展 |
| 缓存策略 | 多套独立缓存 | 统一缓存层 |
| 事件处理 | 分散的事件系统 | 统一事件聚合器 |

---

## 二、Sliding Sync 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        UI Layer (Vue)                            │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐     │
│  │ SlidingRoomList│  │SlidingDMList  │  │ SlidingSession │     │
│  │                │  │                │  │    List        │     │
│  └────────────────┘  └────────────────┘  └────────────────┘     │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────┐
│                   Composables (Hook 层)                       │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ useSlidingSync() - 主 Hook                              │   │
│  │ - 列表管理                                               │   │
│  │ - 滑动窗口控制                                           │   │
│  │ - 事件聚合                                               │   │
│  └────────────────────────────────────────────────────────┘   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │useRoomList   │  │  useDMList   │  │usePresence   │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────┐
│                   Services (服务层)                            │
│  ┌────────────────────────────────────────────────────────┐   │
│  │        SlidingSyncService (核心服务)                   │   │
│  │  - 列表管理 (all_rooms, dms, favorites, etc.)           │   │
│  │  - 滑动窗口控制 (ranges)                                 │   │
│  │  - 事件聚合与分发                                        │   │
│  │  - 与现有系统桥接                                        │   │
│  └────────────────────────────────────────────────────────┘   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │FriendsClient │  │PrivateChat   │  │ Presence     │        │
│  │   (V2 API)   │  │  (轮询 3s)   │  │   Extension   │        │
│  │  ⚠️ 保持独立  │  │  ⚠️ 保持独立  │  │  集成到SS    │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────┐
│              Matrix SDK + SlidingSync (MSC3575)                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              SlidingSync Proxy (滑动同步代理)            │  │
│  │  - 按需同步，高性能                                        │  │
│  │  - 列表 + 过滤 + 排序                                      │  │
│  │  - 扩展支持 (Presence, E2EE, Typing, etc.)               │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 设计决策

#### 决策 1: FriendsClient 保持独立

**原因**:
- FriendsClient V2 已有完整的 API 和缓存机制
- 好友分组系统复杂，Sliding Sync 难以完全替代
- 后端 API 端点独立 (`/_synapse/client/enhanced/friends/*`)

**方案**:
- Sliding Sync 的 `direct_messages` 列表用于**DM 房间列表**（不包括好友关系）
- FriendsClient 继续用于**好友关系管理**
- 两者通过事件系统同步数据

#### 决策 2: PrivateChat 保持独立轮询

**原因**:
- 私聊系统的强 E2EE 要求和实时性需求
- 已有 3 秒轮询机制，运行良好
- 后端 API 独立 (`/_synapse/client/enhanced/private_chat/v2/*`)
- IndexedDB 存储完善

**方案**:
- PrivateChat 继续独立轮询
- Sliding Sync 不管理私聊会话
- 两者通过事件系统保持同步

#### 决策 3: Presence 集成到 Sliding Sync

**原因**:
- Presence 扩展是 Sliding Sync 的标准功能
- 可以减少传统 /sync 的依赖
- 提升在线状态更新的实时性

**方案**:
- 启用 Sliding Sync 的 `e2ee` 扩展
- Presence 事件通过 Sliding Sync 推送
- 现有 Presence Store 兼容接收

---

## 三、实现阶段

### 阶段 1: 类型定义 (1天)

#### 1.1 创建 SlidingSync 类型定义

**文件**: `src/types/sliding-sync.ts`

```typescript
/**
 * MSC3575 Sliding Sync 类型定义
 * @module types/sliding-sync
 */

// 列表配置
export interface MSC3575List {
  ranges: number[][]
  sort?: string[]
  filters?: MSC3575Filters
  required_state?: string[][]
  timeline_limit?: number
  name?: string
}

// 过滤器
export interface MSC3575Filters {
  is_dm?: boolean
  is_encrypted?: boolean
  is_invite?: boolean
  room_name_like?: string
  room_types?: string[]
  spaces?: string[]
  tags?: string[]
  not_tags?: string[]
  not_room_types?: string[]
}

// 房间订阅
export interface MSC3575RoomSubscription {
  required_state?: string[][]
  timeline_limit?: number
  include_old_rooms?: MSC3575RoomSubscription
}

// 房间数据
export interface MSC3575RoomData {
  room_id: string
  name?: string
  avatar_url?: string
  topic?: string
  joined_count?: number
  invited_count?: number
  heroes?: string[]
  notification_count?: number
  highlight_count?: number
  required_state?: Record<string, unknown>
  timeline?: MSC3575Event[]
  updated?: number
  state?: string
}

// 事件
export interface MSC3575Event {
  event_id: string
  sender: string
  type: string
  origin_server_ts: number
  content?: Record<string, unknown>
}

// 列表数据
export interface SlidingListData {
  listId: string
  rooms: MSC3575RoomData[]
  count: number
  ranges: number[][]
  hasMore: boolean
}

// 扩展配置
export interface MSC3575Extensions {
  e2ee?: {
    enabled: boolean
  }
  receipt?: {
    enabled: boolean
  }
  typing?: {
    enabled: boolean
  }
  account_data?: {
    enabled: boolean
  }
  unread_notifications?: {
    enabled: boolean
  }
}

// 生命周期状态
export type SlidingSyncLifecycleState =
  | 'LOADING'
  | 'READY'
  | 'CATCHUP'
  | 'SYNCING'
  | 'ERROR'
  | 'STOPPED'

// 事件类型
export interface SlidingSyncEvents {
  LIFECYCLE: SlidingSyncLifecycleState
  LIST: (listId: string, data: SlidingListData) => void
  ROOM: (roomId: string, roomData: MSC3575RoomData) => void
  ROOM_DATA: (roomId: string, roomData: MSC3575RoomData) => void
}

// 好友/DM 集成类型
export interface DMWithFriendInfo extends MSC3575RoomData {
  friend_id?: string
  display_name?: string
  category_id?: number
  category_name?: string
  category_color?: string
  is_online?: boolean
  last_active?: number
}
```

---

### 阶段 2: 核心服务实现 (2-3天)

#### 2.1 创建 SlidingSync 服务

**文件**: `src/services/matrixSlidingSyncService.ts`

**核心功能**:

```typescript
export class MatrixSlidingSyncService {
  private static instance: MatrixSlidingSyncService
  private slidingSync: SlidingSync | null = null
  private lists: Map<string, SlidingList> = new Map()
  private eventHandlers: Map<string, Set<Function>> = new Map()

  // ========== 初始化 ==========

  async initialize(proxyUrl: string): Promise<void> {
    const client = await this.getMatrixClient()

    this.slidingSync = new SlidingSync({
      client,
      proxyBaseUrl: proxyUrl,
      listPrefix: 'hula_',
    })

    this.setupExtensions()
    this.setupEventListeners()
  }

  async start(): Promise<void> {
    if (!this.slidingSync) {
      throw new Error('SlidingSync not initialized')
    }

    await this.slidingSync.start()
  }

  // ========== 列表管理 ==========

  createList(name: string, config: MSC3575List): SlidingList {
    if (!this.slidingSync) {
      throw new Error('SlidingSync not initialized')
    }

    const list = this.slidingSync.list(name, config)
    this.lists.set(name, list)

    return list
  }

  getList(name: string): SlidingList | null {
    return this.lists.get(name) || null
  }

  // ========== 预定义列表 ==========

  setupDefaultLists(): void {
    // 1. 所有房间列表
    this.createList('all_rooms', {
      ranges: [[0, 49]],
      sort: ['by_recency', 'by_name'],
      filters: {
        is_dm: false
      },
      required_state: [
        ['m.room.avatar', ''],
        ['m.room.name', ''],
        ['m.room.topic', ''],
        ['m.room.encryption', ''],
      ],
      timeline_limit: 10,
    })

    // 2. DM 房间列表（用于 FriendsList 显示）
    this.createList('direct_messages', {
      ranges: [[0, 49]],
      sort: ['by_recency'],
      filters: {
        is_dm: true
      },
      required_state: [
        ['m.room.avatar', ''],
        ['m.room.name', ''],
        ['m.direct', ''],
        ['m.room.encryption', ''],
      ],
      timeline_limit: 5,
    })

    // 3. 收藏房间
    this.createList('favorites', {
      ranges: [[0, 19]],
      sort: ['by_recency'],
      filters: {
        tags: ['m.favourite']
      },
      required_state: [
        ['m.room.avatar', ''],
        ['m.room.name', ''],
      ],
      timeline_limit: 5,
    })

    // 4. 未读房间
    this.createList('unread', {
      ranges: [[0, 29]],
      sort: ['by_notification_count', 'by_recency'],
      filters: {
        is_dm: false
      },
      required_state: [
        ['m.room.avatar', ''],
        ['m.room.name', ''],
      ],
      timeline_limit: 5,
    })
  }

  // ========== 事件监听 ==========

  setupEventListeners(): void {
    if (!this.slidingSync) return

    // 列表生命周期
    this.slidingSync.on('SlidingSyncEvent.Lifecycle', (state, list) => {
      this.handleLifecycleChange(state, list)
    })

    // 列表更新
    this.slidingSync.on('SlidingSyncEvent.List', (listIndex, list, rooms) => {
      this.handleListUpdate(listIndex, list, rooms)
    })

    // 房间更新
    this.slidingSync.on('SlidingSyncEvent.Room', (roomId, roomData) => {
      this.handleRoomUpdate(roomId, roomData)
    })

    // 房间数据更新
    this.slidingSync.on('SlidingSyncEvent.RoomData', (roomId, roomData) => {
      this.handleRoomDataUpdate(roomId, roomData)
    })
  }

  // ========== 扩展配置 ==========

  setupExtensions(): void {
    if (!this.slidingSync) return

    this.slidingSync.setExtensions({
      e2ee: { enabled: true },
      receipt: { enabled: true },
      typing: { enabled: true },
      account_data: { enabled: true },
      unread_notifications: { enabled: true },
    })
  }

  // ========== 滑动窗口操作 ==========

  adjustRange(listName: string, ranges: number[][]): void {
    const list = this.getList(listName)
    if (list) {
      list.setRanges(ranges)
    }
  }

  loadMore(listName: string, count: number = 50): void {
    const list = this.getList(listName)
    if (!list) return

    const currentRanges = list.getRanges()
    const maxIndex = Math.max(...currentRanges.flat())

    const newRanges = [...currentRanges, [maxIndex + 1, maxIndex + count]]
    list.setRanges(newRanges)
  }

  // ========== 过滤和搜索 ==========

  searchRooms(listName: string, query: string): void {
    const list = this.getList(listName)
    if (list) {
      list.setFilters({
        is_dm: false,
        room_name_like: query,
      })
    }
  }

  clearFilter(listName: string): void {
    const list = this.getList(listName)
    if (list) {
      list.setFilters({})
    }
  }

  // ========== 房间订阅 ==========

  subscribeToRoom(roomId: string, config?: MSC3575RoomSubscription): void {
    if (!this.slidingSync) return

    this.slidingSync.setRoomSubscriptions({
      [roomId]: config || {
        required_state: [
          ['m.room.avatar', ''],
          ['m.room.name', ''],
          ['m.room.topic', ''],
          ['m.room.power_levels', ''],
        ],
        timeline_limit: 50,
      }
    })
  }

  unsubscribeFromRoom(roomId: string): void {
    if (!this.slidingSync) return

    this.slidingSync.setRoomSubscriptions({
      [roomId]: null
    })
  }

  // ========== 好友系统集成 ==========

  /**
   * 获取带好友信息的 DM 列表
   * 从 Sliding Sync 的 direct_messages 列表获取 DM 房间
   * 然后与 FriendsClient 的好友数据合并
   */
  async getDMListWithFriendInfo(): Promise<DMWithFriendInfo[]> {
    const dmList = this.getList('direct_messages')
    if (!dmList) return []

    const rooms = dmList.getRoomIds()
    const client = await this.getMatrixClient()
    const friends = client.friendsV2

    // 获取好友列表（从缓存）
    const friendList = await friends.listFriends()
    const friendMap = new Map(
      friendList.map(f => [f.user_id, f])
    )

    // 合并数据
    const enriched: DMWithFriendInfo[] = rooms.map(roomId => {
      const roomData = this.getRoomData(roomId)
      const friend = this.extractFriendFromDM(roomId, friendMap)

      return {
        ...roomData,
        friend_id: friend?.user_id,
        display_name: friend?.display_name,
        category_id: friend?.category_id,
        category_name: friend?.category_name,
        category_color: friend?.category_color,
      }
    })

    return enriched
  }

  private extractFriendFromDM(
    roomId: string,
    friendMap: Map<string, Friend>
  ): Friend | null {
    // 从 DM 房间 ID 提取好友 ID
    // DM 房间通常是 1:1 房间，room_id 就是好友 ID
    if (!roomId.startsWith('!')) {
      // 可能是直接的用户 ID
      return friendMap.get(roomId) || null
    }

    // 从房间成员中查找对方
    const room = this.slidingSync?.client?.getRoom(roomId)
    if (!room) return null

    const members = room.getJoinedMembers()
    const myUserId = this.slidingSync?.client?.getUserId()

    for (const member of members) {
      const userId = member.userId
      if (userId !== myUserId) {
        return friendMap.get(userId) || null
      }
    }

    return null
  }

  // ========== Presence 集成 ==========

  /**
   * 订阅 Presence 更新
   * Presence 通过 Sliding Sync 的 e2ee 扩展推送
   */
  subscribeToPresence(callback: (presences: Record<string, PresenceState>) => void): () => void {
    const handler = (event: MatrixEvent) => {
      const content = event.getContent()
      if (event.getType() === 'm.presence') {
        this.handlePresenceUpdate(content, callback)
      }
    }

    // 监听 Presence 事件
    this.slidingSync?.client.on('event', handler)

    // 返回取消订阅函数
    return () => {
      this.slidingSync?.client.removeListener('event', handler)
    }
  }

  // ========== 清理 ==========

  dispose(): void {
    if (this.slidingSync) {
      this.slidingSync.stop()
      this.slidingSync = null
    }

    this.lists.clear()
    this.eventHandlers.clear()
  }
}

export const matrixSlidingSyncService = MatrixSlidingSyncService.getInstance()
```

---

### 阶段 3: Store 层实现 (1-2天)

#### 3.1 创建 SlidingSync Store

**文件**: `src/stores/slidingSync.ts`

```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { matrixSlidingSyncService } from '@/services/matrixSlidingSyncService'
import { logger } from '@/utils/logger'
import type { MSC3575RoomData, DMWithFriendInfo } from '@/types/sliding-sync'

export const useSlidingSyncStore = defineStore('slidingSync', () => {
  // ========== 状态 ==========

  const isInitialized = ref(false)
  const isRunning = ref(false)
  const proxyUrl = ref<string | null>(null)
  const error = ref<string | null>(null)

  // 列表数据
  const lists = ref<Record<string, MSC3575RoomData[]>>({
    all_rooms: [],
    direct_messages: [],
    favorites: [],
    unread: [],
  })

  // 加载状态
  const loading = ref<Record<string, boolean>>({
    all_rooms: false,
    direct_messages: false,
    favorites: false,
    unread: false,
  })

  // 列表计数
  const counts = ref<Record<string, number>>({
    all_rooms: 0,
    direct_messages: 0,
    favorites: 0,
    unread: 0,
  })

  // ========== 初始化 ==========

  async function initialize(): Promise<void> {
    try {
      error.value = null

      const config = useMatrixConfig()
      const syncUrl = config.getSlidingSyncUrl()

      if (!syncUrl) {
        throw new Error('Sliding Sync URL not configured')
      }

      proxyUrl.value = syncUrl
      await matrixSlidingSyncService.initialize(syncUrl)

      // 设置默认列表
      matrixSlidingSyncService.setupDefaultLists()

      // 设置事件监听
      setupEventHandlers()

      isInitialized.value = true
      logger.info('[SlidingSyncStore] Initialized successfully')
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to initialize'
      logger.error('[SlidingSyncStore] Initialization failed:', err)
      throw err
    }
  }

  async function start(): Promise<void> {
    if (!isInitialized.value) {
      await initialize()
    }

    try {
      await matrixSlidingSyncService.start()
      isRunning.value = true
      logger.info('[SlidingSyncStore] Started')
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to start'
      logger.error('[SlidingSyncStore] Start failed:', err)
      throw err
    }
  }

  function stop(): void {
    matrixSlidingSyncService.dispose()
    isRunning.value = false
    logger.info('[SlidingSyncStore] Stopped')
  }

  // ========== 列表操作 ==========

  async function loadList(listName: string, ranges?: number[][]): Promise<void> {
    if (!isRunning.value) {
      await start()
    }

    loading.value[listName] = true

    try {
      const list = matrixSlidingSyncService.getList(listName)
      if (!list) {
        throw new Error(`List ${listName} not found`)
      }

      // 设置窗口范围
      if (ranges) {
        list.setRanges(ranges)
      }

      logger.debug(`[SlidingSyncStore] Loaded list: ${listName}`)
    } catch (err) {
      error.value = err instanceof Error ? err.message : `Failed to load ${listName}`
      logger.error(`[SlidingSyncStore] Failed to load list ${listName}:`, err)
    } finally {
      loading.value[listName] = false
    }
  }

  async function loadMore(listName: string, count: number = 50): Promise<void> {
    try {
      matrixSlidingSyncService.loadMore(listName, count)
      logger.debug(`[SlidingSyncStore] Loaded more in ${listName}`)
    } catch (err) {
      error.value = err instanceof Error ? err.message : `Failed to load more in ${listName}`
      logger.error(`[SlidingSyncStore] Failed to load more in ${listName}:`, err)
    }
  }

  // ========== 搜索和过滤 ==========

  async function searchRooms(listName: string, query: string): Promise<void> {
    try {
      loading.value[listName] = true
      matrixSlidingSyncService.searchRooms(listName, query)

      // 等待列表更新
      await new Promise(resolve => setTimeout(resolve, 500))
      logger.debug(`[SlidingSyncStore] Searched in ${listName}: ${query}`)
    } catch (err) {
      error.value = err instanceof Error ? err.message : `Failed to search in ${listName}`
      logger.error(`[SlidingSyncStore] Search failed in ${listName}:`, err)
    } finally {
      loading.value[listName] = false
    }
  }

  function clearFilter(listName: string): void {
    matrixSlidingSyncService.clearFilter(listName)
    logger.debug(`[SlidingSyncStore] Cleared filter in ${listName}`)
  }

  // ========== 好友系统集成 ==========

  async function loadDMListWithFriends(): Promise<void> {
    loading.value.direct_messages = true

    try {
      const enriched = await matrixSlidingSyncService.getDMListWithFriendInfo()
      lists.value.direct_messages = enriched
      counts.value.direct_messages = enriched.length

      logger.debug(`[SlidingSyncStore] Loaded DM list with friends: ${enriched.length}`)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load DM list'
      logger.error('[SlidingSyncStore] Failed to load DM list:', err)
    } finally {
      loading.value.direct_messages = false
    }
  }

  // ========== 房间订阅 ==========

  function subscribeToRoom(roomId: string): void {
    matrixSlidingSyncService.subscribeToRoom(roomId)
    logger.debug(`[SlidingSyncStore] Subscribed to room: ${roomId}`)
  }

  function unsubscribeFromRoom(roomId: string): void {
    matrixSlidingSyncService.unsubscribeFromRoom(roomId)
    logger.debug(`[SlidingSyncStore] Unsubscribed from room: ${roomId}`)
  }

  // ========== 计算属性 ==========

  const allRooms = computed(() => lists.value.all_rooms)
  const directMessages = computed(() => lists.value.direct_messages)
  const favorites = computed(() => lists.value.favorites)
  const unread = computed(() => lists.value.unread)

  const hasUnread = computed(() => counts.value.unread > 0)
  const isReady = computed(() => isInitialized.value && isRunning.value)

  // ========== 事件处理 ==========

  function setupEventHandlers(): void {
    // 监听列表更新
    matrixSlidingSyncService.onListUpdate((listName, data) => {
      lists.value[listName] = data.rooms
      counts.value[listName] = data.count
      loading.value[listName] = false
    })
  }

  return {
    // 状态
    isInitialized,
    isRunning,
    proxyUrl,
    error,
    loading,
    lists,
    counts,

    // 计算属性
    allRooms,
    directMessages,
    favorites,
    unread,
    hasUnread,
    isReady,

    // 方法
    initialize,
    start,
    stop,
    loadList,
    loadMore,
    searchRooms,
    clearFilter,
    loadDMListWithFriends,
    subscribeToRoom,
    unsubscribeFromRoom,
  }
})
```

#### 3.2 集成现有 Store

**修改**: `src/stores/chat.ts`

```typescript
// 在 useChatStore 中添加 SlidingSync 支持

export const useChatStore = defineStore('chat', () => {
  // ... 现有状态 ...

  // ========== SlidingSync 集成 ==========

  const slidingSyncStore = useSlidingSyncStore()
  const useSlidingSyncMode = ref(false) // 是否使用 Sliding Sync 模式

  // ========== 会话列表获取（双模式） ==========

  async function getSessionList(options?: {
    useSlidingSync?: boolean  // 是否使用 Sliding Sync
  }): Promise<SessionItem[]> {
    const { useSlidingSync = false } = options || {}

    // 检测是否支持 Sliding Sync
    const shouldUseSlidingSync = useSlidingSync || useSlidingSyncMode.value

    if (shouldUseSlidingSync && slidingSyncStore.isReady) {
      return getSessionListFromSlidingSync()
    } else {
      return getSessionListFromMatrix()
    }
  }

  async function getSessionListFromSlidingSync(): Promise<SessionItem[]> {
    try {
      // 从 Sliding Sync 获取所有房间
      const allRooms = slidingSyncStore.allRooms

      // 转换为 SessionItem 格式
      const sessions = allRooms.map(room => getSessionFromMatrix(room))

      logger.info('[ChatStore] Loaded sessions from SlidingSync:', sessions.length)
      return sessions
    } catch (error) {
      logger.error('[ChatStore] Failed to load from SlidingSync, falling back:', error)
      // 降级到传统方式
      return getSessionListFromMatrix()
    }
  }

  // ========== Presence 集成 ==========

  // 现有的 Presence 逻辑保持不变
  // Sliding Sync 会通过扩展推送 Presence 更新

  return {
    // ... 现有返回 ...

    // 新增
    slidingSyncStore,
    useSlidingSyncMode,
    getSessionList,
  }
})
```

**修改**: `src/stores/presence.ts`

```typescript
// 在 Presence Store 中集成 Sliding Sync Presence 扩展

export const usePresenceStore = defineStore('presence', () => {
  // ... 现有状态 ...

  const slidingSyncStore = useSlidingSyncStore()

  // ========== Presence 订阅 ==========

  async function subscribeToPresenceChanges(): Promise<void> {
    if (slidingSyncStore.isReady) {
      // 从 Sliding Sync 订阅 Presence
      const unsubscribe = matrixSlidingSyncService.subscribeToPresence((presences) => {
        // 更新本地 Presence 状态
        Object.entries(presences).forEach(([userId, state]) => {
          presences.value[userId] = state
        })
      })

      // 存储取消订阅函数
      presenceUnsubscribers.value.push(unsubscribe)

      logger.info('[PresenceStore] Subscribed to Presence via SlidingSync')
    } else {
      // 降级到传统 Presence 订阅
      subscribeToPresenceTraditional()
    }
  }

  return {
    // ... 现有返回 ...

    // 新增
    subscribeToPresenceChanges,
  }
})
```

---

### 阶段 4: Vue Composables (Hook 层)

**文件**: `src/hooks/useSlidingSync.ts`

```typescript
import { computed } from 'vue'
import { useSlidingSyncStore } from '@/stores/slidingSync'
import { logger } from '@/utils/logger'

export function useSlidingSync(listName?: string) {
  const store = useSlidingSyncStore()

  // 状态
  const isReady = computed(() => store.isReady)
  const loading = computed(() => listName ? store.loading[listName] || false : false)
  const error = computed(() => store.error)

  // 列表数据
  const list = computed(() => {
    if (!listName) return null
    return store.lists[listName] || []
  })

  const count = computed(() => {
    if (!listName) return 0
    return store.counts[listName] || 0
  })

  // ========== 方法 ==========

  const load = async (ranges?: number[][]) => {
    if (!listName) {
      throw new Error('listName is required')
    }
    await store.loadList(listName, ranges)
  }

  const loadMore = async (count?: number) => {
    if (!listName) {
      throw new Error('listName is required')
    }
    await store.loadMore(listName, count)
  }

  const search = async (query: string) => {
    if (!listName) {
      throw new Error('listName is required')
    }
    await store.searchRooms(listName, query)
  }

  const clearFilter = () => {
    if (!listName) {
      throw new Error('listName is required')
    }
    store.clearFilter(listName)
  }

  const refresh = async () => {
    await load()
  }

  return {
    // 状态
    isReady,
    loading,
    error,
    list,
    count,

    // 方法
    load,
    loadMore,
    search,
    clearFilter,
    refresh,
  }
}

// ========== 专用 Hooks ==========

export function useRoomList() {
  return useSlidingSync('all_rooms')
}

export function useDMList() {
  const slidingSync = useSlidingSync('direct_messages')

  // 额外加载好友信息
  const store = useSlidingSyncStore()

  const loadWithFriends = async () => {
    await store.loadDMListWithFriends()
  }

  return {
    ...slidingSync,
    loadWithFriends,
  }
}

export function useFavoriteRooms() {
  return useSlidingSync('favorites')
}

export function useUnreadRooms() {
  return useSlidingSync('unread')
}
```

---

### 阶段 5: UI 组件更新

#### 5.1 创建 SlidingSync 组件目录

**新文件结构**:
```
src/components/sliding-sync/
├── SlidingRoomList.vue       # 房间列表组件
├── SlidingDMList.vue         # DM 列表组件（带好友信息）
├── SlidingFavorites.vue      # 收藏列表组件
├── RoomListFilter.vue        # 过滤器组件
└── SlidingSyncStatus.vue     # 同步状态指示器
```

**示例**: `src/components/sliding-sync/SlidingDMList.vue`

```vue
<template>
  <div class="sliding-dm-list">
    <!-- 过滤器 -->
    <RoomListFilter
      v-model="searchQuery"
      :category-filter="categoryFilter"
      @filter-change="handleFilterChange"
    />

    <!-- 列表 -->
    <div v-if="!loading || list.length > 0" class="dm-list">
      <div
        v-for="item in list"
        :key="item.room_id"
        class="dm-item"
        @click="handleClick(item)"
      >
        <!-- 在线状态指示 -->
        <PresenceStatus
          :user-id="item.friend_id"
          :show-status="true"
        />

        <!-- 头像 -->
        <Avatar
          :user-id="item.friend_id"
          :room-id="item.room_id"
          :size="40"
        />

        <!-- 好友信息 -->
        <div class="dm-info">
          <div class="dm-name">
            {{ item.display_name || item.name }}
            <span v-if="item.category_name" class="category-tag">
              {{ item.category_name }}
            </span>
          </div>
          <div class="dm-preview">
            {{ getLastMessage(item) }}
          </div>
        </div>

        <!-- 时间戳 -->
        <div class="dm-time">
          {{ formatTime(item.updated) }}
        </div>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading && list.length === 0" class="loading-state">
      <n-spin size="medium" />
      <p>加载中...</p>
    </div>

    <!-- 空状态 -->
    <div v-if="!loading && list.length === 0" class="empty-state">
      <p>暂无直接消息</p>
    </div>

    <!-- 加载更多 -->
    <div v-if="hasMore" class="load-more">
      <n-button
        text
        @click="handleLoadMore"
        :loading="loadingMore"
      >
        加载更多
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useDMList } from '@/hooks/useSlidingSync'
import type { DMWithFriendInfo } from '@/types/sliding-sync'

interface Props {
  categoryFilter?: number
}

const props = withDefaults(defineProps<Props>(), {
  categoryFilter: undefined
})

const emit = defineEmits<{
  select: [room: DMWithFriendInfo]
}>()

// Hook
const { list, loading, count, load, loadMore, search, clearFilter } = useDMList()

// 状态
const searchQuery = ref('')
const loadingMore = ref(false)
const hasMore = computed(() => list.value.length < count.value)

// 方法
const handleFilterChange = (filters: { search: string; category?: number }) => {
  if (filters.search) {
    search(filters.search)
  } else {
    clearFilter()
  }
}

const handleClick = (item: DMWithFriendInfo) => {
  emit('select', item)
}

const handleLoadMore = async () => {
  loadingMore.value = true
  try {
    await loadMore(50)
  } finally {
    loadingMore.value = false
  }
}

// 初始化
onMounted(async () => {
  await load()
})

// 搜索防抖
let searchTimer: ReturnType<typeof setTimeout>
watch(searchQuery, (query) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    handleFilterChange({ search: query })
  }, 300)
})
</script>
```

---

## 四、事件系统集成

### 4.1 统一事件聚合器

**文件**: `src/services/slidingSyncEventAggregator.ts`

```typescript
/**
 * 统一事件聚合器
 * 整合 SlidingSync、FriendsClient、PrivateChat 的事件
 */

export class SlidingSyncEventAggregator extends EventEmitter {
  private static instance: SlidingSyncEventAggregator

  // 事件映射
  private eventMapping: Map<string, string[]> = new Map([
    // FriendsClient 事件 -> 统一事件
    ['FriendsClient.friend.add', ['dm.updated', 'friend.added']],
    ['FriendsClient.friend.remove', ['dm.updated', 'friend.removed']],
    ['FriendsClient.request.received', ['dm.request.received']],
    ['FriendsClient.request.accepted', ['dm.updated', 'friend.accepted']],

    // PrivateChat 事件 -> 统一事件
    ['PrivateChat.session.created', ['session.created']],
    ['PrivateChat.session.deleted', ['session.deleted']],
    ['PrivateChat.message.received', ['message.received']],
    ['PrivateChat.message.sent', ['message.sent']],

    // SlidingSync 事件 -> 统一事件
    ['SlidingSync.Room', ['room.updated']],
    ['SlidingSync.RoomData', ['room.updated']],
    ['SlidingSync.List', ['list.updated']],
  ])

  static getInstance(): SlidingSyncEventAggregator {
    if (!SlidingSyncEventAggregator.instance) {
      SlidingSyncEventAggregator.instance = new SlidingSyncEventAggregator()
    }
    return SlidingSyncEventAggregator.instance
  }

  /**
   * 注册事件源
   */
  registerEventSource(sourceName: string, eventEmitter: EventEmitter): void {
    eventEmitter.getEventNames().forEach(eventName => {
      eventEmitter.on(eventName, (data) => {
        this.aggregateEvent(sourceName, eventName, data)
      })
    })
  }

  /**
   * 聚合事件
   */
  private aggregateEvent(source: string, originalEvent: string, data: unknown): void {
    const key = `${source}.${originalEvent}`
    const unifiedEvents = this.eventMapping.get(key) || []

    unifiedEvents.forEach((unifiedEvent) => {
      this.emit(unifiedEvent, {
        source,
        originalEvent,
        data,
        timestamp: Date.now()
      })
    })
  }

  /**
   * 订阅统一事件
   */
  subscribe(unifiedEvent: string, callback: (data: any) => void): () => void {
    this.on(unifiedEvent, callback)

    // 返回取消订阅函数
    return () => {
      this.removeListener(unifiedEvent, callback)
    }
  }
}

export const slidingSyncEventAggregator = SlidingSyncEventAggregator.getInstance()
```

### 4.2 事件流图

```
┌──────────────────────────────────────────────────────────────┐
│                       事件源                                   │
├──────────────┬──────────────┬──────────────┬──────────────────────┤
│ FriendsClient│ PrivateChat  │ SlidingSync │ 传统 /sync         │
└──────┬───────┴──────┬───────┴──────┬───────┴──────────┬──────────┘
       │              │              │              │
       ▼              ▼              ▼              ▼
┌──────────────────────────────────────────────────────────────┐
│              SlidingSyncEventAggregator                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  dm.updated        session.created      room.updated     │ │
│  │  friend.added       message.received    list.updated     │ │
│  │  friend.removed    message.sent       presence.updated │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                    UI Components                            │
│  - DMList.vue (监听 dm.updated, friend.added, friend.removed)   │
│  - SessionList.vue (监听 session.created, session.deleted)    │
│  - RoomList.vue (监听 room.updated, presence.updated)         │
│  - ChatView.vue (监听 message.received, message.sent)          │
└──────────────────────────────────────────────────────────────┘
```

---

## 五、缓存策略

### 5.1 统一缓存层

**文件**: `src/services/slidingSyncCache.ts`

```typescript
/**
 * SlidingSync 缓存服务
 * 统一管理 SlidingSync、FriendsClient、PrivateChat 的缓存
 */

export class SlidingSyncCacheService {
  private static instance: SlidingSyncCacheService

  // IndexedDB 存储
  private readonly CACHE_DB = 'sliding-sync-cache'
  private readonly CACHE_VERSION = 1

  // 内存缓存
  private memoryCache: Map<string, CacheEntry> = new Map()

  // 缓存 TTL
  private readonly CACHE_TTL = {
    LISTS: 5 * 60 * 1000,      // 列表缓存: 5分钟
    ROOMS: 10 * 60 * 1000,     // 房间详情: 10分钟
    FRIENDS: 5 * 60 * 1000,    // 好友列表: 5分钟 (与 FriendsClient 一致)
    PRESENCE: 1 * 60 * 1000,   // 在线状态: 1分钟
    MESSAGES: 30 * 60 * 1000,  // 消息历史: 30分钟
  }

  /**
   * 获取缓存数据
   */
  async get<T>(key: string): Promise<T | null> {
    // 先查内存缓存
    const memEntry = this.memoryCache.get(key)
    if (memEntry && !this.isExpired(memEntry)) {
      return memEntry.data as T
    }

    // 再查 IndexedDB
    try {
      const db = await this.openDB()
      const store = db.transaction('cache', 'readonly').objectStore('cache')
      const entry = await store.get(key)

      if (entry && !this.isExpired(entry)) {
        // 回填内存缓存
        this.memoryCache.set(key, entry)
        return entry.data as T
      }

      return null
    } catch (error) {
      logger.error('[Cache] Failed to get cache:', error)
      return null
    }
  }

  /**
   * 设置缓存
   */
  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    const entry: CacheEntry = {
      key,
      data,
      timestamp: Date.now(),
      ttl: ttl || this.getTTLForKey(key),
    }

    // 写入内存缓存
    this.memoryCache.set(key, entry)

    // 写入 IndexedDB
    try {
      const db = await this.openDB()
      const store = db.transaction('cache', 'readwrite').objectStore('cache')
      await store.put(entry)
    } catch (error) {
      logger.error('[Cache] Failed to set cache:', error)
    }
  }

  /**
   * 清除过期缓存
   */
  async cleanup(): Promise<void> {
    const now = Date.now()
    const expiredKeys: string[] = []

    // 检查内存缓存
    for (const [key, entry] of this.memoryCache.entries()) {
      if (this.isExpired(entry)) {
        expiredKeys.push(key)
        this.memoryCache.delete(key)
      }
    }

    // 清理 IndexedDB
    try {
      const db = await this.openDB()
      const store = db.transaction('cache', 'readwrite').objectStore('cache')
      const request = store.openCursor()

      await new Promise((resolve) => {
        request.onsuccess = () => {
          if (request.result) {
            const cursor = request.result
            if (this.isExpired(cursor.value)) {
              cursor.delete()
            } else {
              cursor.continue()
            }
          } else {
            resolve(undefined)
          }
        }
      })
    } catch (error) {
      logger.error('[Cache] Failed to cleanup:', error)
    }
  }

  /**
   * 清除所有缓存
   */
  async clear(): Promise<void> {
    this.memoryCache.clear()

    try {
      const db = await this.openDB()
      await db.clear('cache')
      logger.info('[Cache] All cache cleared')
    } catch (error) {
      logger.error('[Cache] Failed to clear:', error)
    }
  }

  /**
   * 根据键名获取 TTL
   */
  private getTTLForKey(key: string): number {
    if (key.startsWith('list:')) return this.CACHE_TTL.LISTS
    if (key.startsWith('room:')) return this.CACHE_TTL.ROOMS
    if (key.startsWith('friends:')) return this.CACHE_TTL.FRIENDS
    if (key.startsWith('presence:')) return this.CACHE_TTL.PRESENCE
    if (key.startsWith('messages:')) return this.CACHE_TTL.MESSAGES
    return 5 * 60 * 1000 // 默认 5 分钟
  }
}

export const slidingSyncCache = SlidingSyncCacheService.getInstance()
```

---

## 六、测试计划

### 6.1 单元测试

```typescript
// src/services/__tests__/matrixSlidingSyncService.spec.ts

describe('MatrixSlidingSyncService', () => {
  test('should initialize with proxy URL')
  test('should create default lists')
  test('should load list by range')
  test('should load more rooms')
  test('should search rooms')
  test('should clear filter')
  test('should subscribe to room')
  test('should unsubscribe from room')
  test('should get DM list with friend info')
})

// src/stores/__tests__/slidingSync.spec.ts

describe('SlidingSync Store', () => {
  test('should initialize service')
  test('should load list data')
  test('should load DM list with friends')
  test('should handle search')
  test('should handle errors')
})

// src/hooks/__tests__/useSlidingSync.spec.ts

describe('useSlidingSync Hook', () => {
  test('should return list data')
  test('should load more items')
  test('should search rooms')
  test('should clear filter')
})
```

### 6.2 集成测试场景

1. **基本同步流程**:
   - 初始化 Sliding Sync
   - 加载所有列表
   - 验证数据完整性

2. **好友列表集成**:
   - Sliding Sync DM 列表加载
   - FriendsClient 好友数据合并
   - 数据一致性验证

3. **Presence 集成**:
   - Sliding Sync Presence 扩展
   - Presence 事件推送
   - 状态更新验证

4. **事件聚合**:
   - 多源事件聚合
   - 事件去重
   - 事件顺序验证

5. **缓存策略**:
   - 缓存命中测试
   - 缓存过期测试
   - 缓存清理测试

### 6.3 性能测试

| 指标 | 目标 | 测试方法 |
|------|------|---------|
| 初始加载时间 | < 2s | 测量从初始化到首屏显示 |
| 滚动响应时间 | < 100ms | 测量滚动到底部的响应时间 |
| 内存使用 | < 100MB | 测量持续使用30分钟的内存占用 |
| 网络请求减少 | > 50% | 对比传统 /sync 的请求次数 |
| 缓存命中率 | > 80% | 测量缓存的命中率 |

---

## 七、实施步骤更新

基于对好友系统和私聊系统的深入分析，更新实施步骤：

### 第 1 步: 类型定义 (1天)
- [ ] 创建 `src/types/sliding-sync.ts`
- [ ] 定义 MSC3575 类型
- [ ] 定义集成类型（DMWithFriendInfo 等）

### 第 2 步: 核心服务 (2-3天)
- [ ] 实现 `matrixSlidingSyncService.ts`
- [ ] 列表管理（all_rooms, direct_messages, favorites, unread）
- [ ] 滑动窗口控制
- [ ] 事件监听和分发
- [ ] **好友系统集成**（DM 列表 + FriendsClient 数据合并）
- [ ] **Presence 集成**（通过扩展）

### 第 3 步: 缓存服务 (1天)
- [ ] 实现 `slidingSyncCacheService.ts`
- [ ] IndexedDB 存储
- [ ] 内存缓存
- [ ] 缓存策略和过期清理

### 第 4 步: 事件聚合器 (1天)
- [ ] 实现 `slidingSyncEventAggregator.ts`
- [ ] 事件源注册
- [ ] 事件映射和聚合
- [ ] 与现有事件系统集成

### 第 5 步: Store 层 (1-2天)
- [ ] 创建 `slidingSync.ts` Store
- [ ] **集成 chat.ts**（双模式：SlidingSync / 传统）
- [ ] **集成 presence.ts**（Presence 扩展订阅）
- [ ] 保持 friends.ts 独立（通过事件同步）

### 第 6 步: Hook 层 (1天)
- [ ] 实现 `useSlidingSync.ts`
- [ ] 实现 `useRoomList.ts`
- [ ] 实现 `useDMList.ts`（含好友信息）
- [ ] 实现 `useFavoriteRooms.ts`

### 第 7 步: UI 组件 (2-3天)
- [ ] 创建 `src/components/sliding-sync/` 目录
- [ ] 实现 `SlidingRoomList.vue`
- [ ] 实现 `SlidingDMList.vue`（带好友信息显示）
- [ ] 实现 `SlidingFavorites.vue`
- [ ] 实现 `RoomListFilter.vue`
- [ ] 实现 `SlidingSyncStatus.vue`
- [ ] 更新 `MatrixRoomList.vue`（可选 SlidingSync）

### 第 8 步: 降级策略 (1天)
- [ ] 实现服务器能力检测
- [ ] 实现自动降级逻辑
- [ ] 测试降级流程

### 第 9 步: 测试和调试 (2-3天)
- [ ] 单元测试
- [ ] 集成测试
- [ ] 性能测试
- [ ] 好友列表集成测试
- [ ] Presence 集成测试

### 第 10 步: 文档和部署 (1天)
- [ ] 更新开发文档
- [ ] 更新用户文档
- [ ] 功能标志启用（保持禁用状态，逐步启用）
- [ ] 灰度发布计划

**总计**: 约 14-20 天（相比原计划增加 2-8 天，主要用于集成测试和调试）

---

## 八、关键注意事项

### 8.1 与 FriendsClient 的关系

| 功能 | FriendsClient | Sliding Sync | 集成方案 |
|------|--------------|--------------|---------|
| 好友关系管理 | ✅ 主要 | ❌ 不支持 | FriendsClient 独立 |
| DM 房间列表 | ⚠️ 有限 | ✅ 主要 | **两者结合** |
| 好友分组 | ✅ 完整 | ❌ 不支持 | FriendsClient 独立 |
| 在线状态 | ⚠️ 基础 | ✅ 扩展 | Sliding Sync 优先 |

### 8.2 与 PrivateChat 的关系

| 功能 | PrivateChat | Sliding Sync | 集成方案 |
|------|-------------|--------------|---------|
| 会话列表 | ✅ 主要 | ❌ 不支持 | PrivateChat 独立 |
| 消息同步 | ✅ 轮询 (3s) | ❌ 不支持 | PrivateChat 独立 |
| E2EE 加密 | ✅ 强制 | ✅ 扩展 | **两者结合** |
| 事件推送 | ✅ 自定义 | ❌ 不支持 | PrivateChat 独立 |

**结论**: PrivateChat 保持独立运行，不通过 Sliding Sync 管理

### 8.3 数据一致性保证

1. **事件驱动**: 通过统一事件聚合器确保数据同步
2. **缓存一致性**: 统一缓存层，避免数据不一致
3. **定期验证**: 定期比对 FriendsClient 和 Sliding Sync 数据
4. **冲突解决**: 以 FriendsClient 数据为准（好友关系），以 Sliding Sync 为准（房间列表）

### 8.4 性能考虑

1. **避免重复轮询**:
   - Sliding Sync 替代房间列表轮询
   - FriendsClient 保持独立（已有缓存）
   - PrivateChat 继续轮询（实时性要求）

2. **网络优化**:
   - Sliding Sync 减少房间列表请求
   - 减少初始加载数据量
   - 按需加载详情

3. **内存管理**:
   - 定期清理过期缓存
   - 限制内存缓存大小
   - 懒加载减少内存占用

---

## 九、相关文档引用

| 文档 | 说明 | 引用关系 |
|------|------|---------|
| [22-sliding-sync.md](./22-sliding-sync.md) | Sliding Sync 规范 | 主要参考 |
| [11-friends-system.md](./11-friends-system.md) | 好友系统 | **集成参考** |
| [12-private-chat-VERIFICATION.md](./12-private-chat-VERIFICATION.md) | 私聊系统 | **独立运行** |
| [01-client-basics.md](./01-client-basics.md) | 客户端基础 | 基础参考 |
| [03-room-management.md](./03-room-management.md) | 房间管理 | 房间参考 |
| [MSC 3575](https://github.com/matrix-org/matrix-spec-proposals/pull/3575) | Sliding Sync 规范 | 规范参考 |
| [MSC 4186](https://github.com/matrix-org/matrix-spec-proposals/pull/4186) | Room Summary | 扩展参考 |

---

## 十、FriendsClient 和 PrivateChat 能否使用 Sliding Sync？

### 10.1 问题概述

用户提出核心问题：**好友系统和私聊系统能否同样使用 Sliding Sync 同步？**

这是一个重要的架构决策问题，需要从技术可行性、性能影响、实现复杂度等多个维度进行分析。

### 10.2 FriendsClient 与 Sliding Sync 集成分析

#### 10.2.1 技术可行性评估

**✅ 理论可行 - 但需要重大架构变更**

当前 FriendsClient 架构：
```typescript
// FriendsClient V2 使用独立的后端 API
const friends = client.friendsV2

// 后端端点
GET  /_synapse/client/enhanced/friends/list          // 好友列表
GET  /_synapse/client/enhanced/friends/categories    // 好友分组
POST /_synapse/client/enhanced/friends/request       // 发送请求
POST /_synapse/client/enhanced/friends/request/accept // 接受请求
DELETE /_synapse/client/enhanced/friends/remove      // 删除好友
```

**Sliding Sync 的限制**：
```typescript
// Sliding Sync 主要用于房间同步，不支持好友关系管理
slidingSync.list("friends", {
  filters: {
    // ❌ 没有好友关系过滤器
    // ❌ 没有分组过滤器
    // ❌ 没有好友请求过滤器
    is_dm: true, // 只能获取 DM 房间列表
  }
})
```

#### 10.2.2 集成方案对比

| 方案 | 优点 | 缺点 | 实施难度 |
|------|------|------|---------|
| **A. 完全替代 FriendsClient** | 统一同步协议<br/>减少 API 调用 | 需要后端重大改造<br/>失去好友分组功能<br/>失去缓存机制<br/>需迁移所有好友逻辑 | 🔴 **极高** |
| **B. 混合模式** | 保留好友管理<br/>DM 列表用 SS | 需要数据同步机制<br/>可能存在数据不一致 | 🟡 **中等** |
| **C. 保持独立** | 稳定可靠<br/>功能完整<br/>无迁移成本 | 两套同步机制<br/>无法统一优化 | 🟢 **低** |

#### 10.2.3 方案 A：完全替代的技术要求

如果要完全用 Sliding Sync 替代 FriendsClient，需要：

**1. 后端改造**（Synapse Enhanced Module）
```typescript
// 需要新增自定义 MSC 扩展
interface MSC4037FriendsExtension {
  // 好友关系作为房间状态事件
  "m.friend_relation": {
    friend_id: string
    category_id?: number
    created_at: number
  }

  // 好友分组作为账户数据
  "m.friend_categories": {
    categories: FriendCategory[]
  }

  // 好友请求作为房间事件
  "m.friend_request": {
    requester_id: string
    message?: string
    expires_at: number
  }
}

// SlidingSync 扩展配置
slidingSync.setExtensions({
  "org.matrix.msc4037.friends": {
    enabled: true,
    // 这需要后端支持此自定义 MSC
  }
})
```

**2. 前端实现**
```typescript
// 完全重写好友系统
export class FriendsClientSlidingSync {
  // 从 Sliding Sync 获取好友列表
  async listFriends(): Promise<Friend[]> {
    // 扫描所有 DM 房间的 m.friend_relation 状态事件
    const rooms = this.slidingSync.getList("direct_messages")
    const friends: Friend[] = []

    for (const roomId of rooms.getRoomIds()) {
      const room = this.slidingSync.client.getRoom(roomId)
      const friendEvent = room?.currentState.getStateEvents("m.friend_relation", "")

      if (friendEvent) {
        friends.push({
          user_id: friendEvent.getContent().friend_id,
          category_id: friendEvent.getContent().category_id,
          // ...
        })
      }
    }

    return friends
  }

  // 发送好友请求 - 需要创建临时房间
  async sendFriendRequest(targetId: string): Promise<string> {
    // 创建一个临时 DM 房间用于好友请求
    // ❌ 这违反了 Matrix 的设计理念
    // ❌ 房间和好友关系混淆
  }
}
```

**问题分析**：
- ❌ Matrix 中好友关系 ≠ DM 房间
- ❌ 好友分组无法映射到 Sliding Sync 列表
- ❌ 好友请求流程无法通过房间事件实现
- ❌ 需要修改 Synapse 后端（非标准 Matrix 功能）

#### 10.2.4 推荐方案：混合模式（当前 v2.0.0 方案）

```typescript
/**
 * 混合模式：FriendsClient + SlidingSync
 *
 * 职责划分：
 * - FriendsClient: 好友关系管理、分组、请求处理
 * - SlidingSync: DM 房间列表同步、实时更新
 */

export class HybridFriendsService {
  /**
   * 获取完整的 DM 列表（房间 + 好友信息）
   */
  async getEnrichedDMList(): Promise<DMWithFriendInfo[]> {
    // 1. 从 Sliding Sync 获取 DM 房间列表（实时、高效）
    const dmRooms = await this.slidingSync.getList("direct_messages")

    // 2. 从 FriendsClient 获取好友数据（有缓存、快速）
    const friends = await this.friendsClient.listFriends()

    // 3. 合并数据
    return dmRooms.map(room => {
      const friend = this.findFriendForRoom(room, friends)
      return {
        ...room,
        friend_id: friend?.user_id,
        category_id: friend?.category_id,
        category_name: friend?.category_name,
        is_online: this.getPresence(friend?.user_id),
      }
    })
  }
}
```

**优势**：
- ✅ 保留 FriendsClient 完整功能
- ✅ 利用 Sliding Sync 高效同步
- ✅ 最小化代码变更
- ✅ 数据来源清晰

---

### 10.3 PrivateChat 与 Sliding Sync 集成分析

#### 10.3.1 技术可行性评估

**❌ 不可行 - 核心设计冲突**

当前 PrivateChat 架构：
```typescript
// PrivateChat 使用独立的加密会话系统
interface PrivateChatSession {
  session_id: string           // 独立于 room_id
  participants: string[]       // 会话参与者
  ttl_seconds?: number         // 会话过期时间
  expires_at?: string          // 过期时间
  status: 'active' | 'expired' | 'deleted'
}

// 后端端点
GET  /_synapse/client/enhanced/private_chat/v2/sessions     // 会话列表
POST /_synapse/client/enhanced/private_chat/v2/sessions     // 创建会话
DELETE /_synapse/client/enhanced/private_chat/v2/sessions/:id  // 删除会话
GET  /_synapse/client/enhanced/private_chat/v2/sessions/:id/messages  // 消息
POST /_synapse/client/enhanced/private_chat/v2/sessions/:id/send     // 发送
```

**Sliding Sync 的限制**：
```typescript
// Sliding Sync 只能管理 Matrix 房间
slidingSync.list("private_chats", {
  filters: {
    // ❌ PrivateChat session 不是 Matrix 房间
    // ❌ 没有 session 过滤器
    // ❌ 没有 TTL 过滤器
    // ❌ 没有会话状态过滤器
  }
})
```

#### 10.3.2 核心冲突点

| 特性 | PrivateChat | Sliding Sync | 冲突 |
|------|-------------|--------------|------|
| 数据模型 | 独立 Session | Matrix Room | ❌ 不兼容 |
| 加密方式 | 自定义 E2EE (AES-GCM-256) | Matrix E2EE (Olm/Megolm) | ❌ 不同 |
| 消息格式 | EncryptedContent | Matrix Event | ❌ 不同 |
| 过期机制 | TTL 自动过期 | 无过期概念 | ❌ 不支持 |
| 同步方式 | 3秒轮询 | 实时推送 | ⚠️ 不同 |

#### 10.3.3 为何无法用 Sliding Sync 替代

**1. PrivateChat 不是 Matrix 房间**
```typescript
// ❌ 错误理解：PrivateChat 是一种特殊房间
// 正确理解：PrivateChat 是完全独立的系统

// PrivateChat 数据结构
{
  session_id: "private_session_abc123",  // 不是 room_id
  participants: ["@alice:server.com", "@bob:server.com"],
  created_at: "2026-01-07T10:00:00Z",
  expires_at: "2026-01-07T12:00:00Z",  // Matrix 房间不过期
}

// Matrix 房间数据结构
{
  room_id: "!abc123:server.com",
  members: ["@alice:server.com", "@bob:server.com"],
  // ❌ 没有 TTL
  // ❌ 不会自动过期
}
```

**2. 加密系统不兼容**
```typescript
// PrivateChat 加密
interface EncryptedContent {
  algorithm: 'aes-gcm-256'  // 自定义算法
  key_id: string
  ciphertext: string
  iv: string
  tag: string
  timestamp: number
}

// Matrix E2EE (Olm/Megolm)
interface MatrixEncryptedEvent {
  algorithm: 'm.megolm.v1.aes-sha2'  // 标准 Matrix 加密
  ciphertext: Record<string, string>
  sender_key: string
  device_id: string
  session_id: string
}

// ❌ 两者完全不兼容
```

**3. 3秒轮询 vs 实时推送的权衡**
```typescript
// PrivateChat 当前设计：3秒轮询
setInterval(async () => {
  const messages = await pollNewMessages()
  // 为何用轮询？
  // 1. 保证消息实时性（最多3秒延迟）
  // 2. 支持离线消息队列
  // 3. 简单可靠
}, 3000)

// 如果用 Sliding Sync 实时推送？
// ❌ PrivateChat 不是 Matrix 房间，无法推送
// ❌ 需要后端完全重写
```

#### 10.3.4 结论

**PrivateChat 无法使用 Sliding Sync**，原因：

1. **数据模型根本不同**：PrivateChat Session ≠ Matrix Room
2. **加密系统独立**：无法映射到 Matrix E2EE
3. **后端 API 独立**：需要完全重写后端
4. **过期机制**：Matrix 房间无 TTL 概念
5. **实施成本**：相当于重新开发 PrivateChat

**保持 PrivateChat 独立是正确的设计决策。**

---

### 10.4 推荐架构决策

基于以上分析，推荐以下架构：

```
┌─────────────────────────────────────────────────────────────────┐
│                    Sliding Sync (MSC3575)                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  职责：Matrix 房间列表同步、Presence、E2EE、Typing         │ │
│  │  - all_rooms: 所有普通房间                                 │ │
│  │  - direct_messages: DM 房间列表（仅房间，不含好友关系）    │ │
│  │  - favorites: 收藏房间                                     │ │
│  │  - unread: 未读房间                                        │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
         │                          │
         │ 混合模式                  │ 独立运行
         ▼                          ▼
┌──────────────────┐      ┌──────────────────┐
│  FriendsClient   │      │   PrivateChat    │
│  (好友关系管理)   │      │   (加密会话)     │
├──────────────────┤      ├──────────────────┤
│ ✅ 好友请求       │      │ ✅ 独立轮询 3s   │
│ ✅ 好友分组       │      │ ✅ IndexedDB 存储│
│ ✅ 用户搜索       │      │ ✅ E2EE 加密     │
│ ✅ 5分钟缓存      │      │ ✅ 会话过期      │
│ ⚠️ 与 SS 协同    │      │ ⚠️ 完全独立      │
└──────────────────┘      └──────────────────┘
```

**关键设计原则**：

1. **FriendsClient + SlidingSync 混合模式**
   - DM 房间列表：使用 Sliding Sync 的 `direct_messages` 列表
   - 好友关系：使用 FriendsClient API
   - 数据合并：在服务层合并两种数据源

2. **PrivateChat 完全独立**
   - 继续使用 3 秒轮询
   - 保持 IndexedDB 存储
   - 不与 Sliding Sync 交互

3. **事件聚合**
   - 通过事件聚合器统一事件流
   - 保持各系统独立性
   - UI 层统一数据来源

---

### 10.5 技术权衡总结表

| 系统 | 使用 Sliding Sync | 保持独立 | 推荐方案 | 原因 |
|------|-------------------|----------|---------|------|
| **FriendsClient** | ⚠️ 需要重大改造 | ✅ 功能完整 | **混合模式** | 保留好友管理功能，DM 列表用 SS |
| **PrivateChat** | ❌ 不可行 | ✅ 必须独立 | **完全独立** | 数据模型不兼容，加密系统不同 |
| **Presence** | ✅ 标准扩展 | ⚠️ 传统方式 | **使用 SS** | 减少依赖，提升性能 |
| **Room List** | ✅ 主要用途 | ❌ 性能差 | **使用 SS** | 核心功能，性能提升显著 |

---

### 10.6 实施建议

基于以上分析，当前 v2.0.0 方案的设计决策是**合理且正确的**：

1. ✅ **FriendsClient 保持独立**，但与 Sliding Sync 的 `direct_messages` 列表协同工作
2. ✅ **PrivateChat 完全独立**，不尝试与 Sliding Sync 集成
3. ✅ **Presence 集成到 Sliding Sync**，使用扩展功能
4. ✅ **Room List 使用 Sliding Sync**，这是其核心用途

**不需要修改当前的架构设计。**

---

## 十一、版本历史

| 版本 | 日期 | 变更说明 |
|------|------|---------|
| 2.1.0 | 2026-01-07 | **技术分析补充**<br>- 添加 FriendsClient 集成可行性分析<br>- 添加 PrivateChat 集成可行性分析<br>- 明确为何保持当前架构决策<br>- 添加技术权衡总结表 |
| 2.0.0 | 2026-01-07 | **重大更新**<br>- 添加好友系统集成方案<br>- 添加私聊系统说明<br>- 明确独立运行的模块<br>- 添加事件聚合器设计<br>- 添加统一缓存层<br>- 更新实施步骤 |
| 1.0.0 | 2026-01-07 | 初始版本<br>- 基础架构设计<br>- 预定义列表配置<br>- 实施步骤规划 |

---

**文档维护**:
- 随着实现进度更新此文档
- 重大架构变更需更新版本号
- 保持与好友系统和私聊系统文档同步
