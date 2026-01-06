# Matrix SDK - Sliding Sync (MSC3575)

**文档版本**: 1.0.0
**SDK 版本**: 24.0.0+
**最后更新**: 2026-01-04
**相关规范**: [MSC 3575 - Sliding Sync](https://github.com/matrix-org/matrix-spec-proposals/pull/3575), [MSC 4186 - Room Summary](https://github.com/matrix-org/matrix-spec-proposals/pull/4186)

---

## 概述

**Sliding Sync** 是 Matrix 的下一代同步协议，提供更高效、更灵活的数据同步方式。

### 主要优势

| 特性 | 传统 /sync | Sliding Sync |
|------|-----------|--------------|
| 数据粒度 | 全量同步 | 按需同步（滑动窗口） |
| 性能 | 大房间响应慢 | 响应快，资源少 |
| 灵活性 | 固定返回格式 | 完全自定义 |
| 扩展性 | 难以扩展 | 支持扩展 |
| 过滤 | 有限过滤 | 强大过滤能力 |

---

## 核心概念

### 列表（Lists）

Sliding Sync 使用**列表**来组织房间：

```typescript
interface MSC3575List {
    ranges: number[][];    // 滑动窗口范围 [[0, 19], [50, 99]]
    sort?: string[];       // 排序字段
    filters?: {            // 过滤条件
        is_dm?: boolean;
        is_encrypted?: boolean;
        is_invite?: boolean;
        room_name_like?: string;
        room_types?: string[];
        spaces?: string[];
        tags?: string[];
    };
    required_state?: string[][]; // 需要的状态事件
    timeline_limit?: number;     // 时间线限制
}
```

### 房间订阅（Room Subscriptions）

控制单个房间返回的数据：

```typescript
interface MSC3575RoomSubscription {
    required_state?: string[][];
    timeline_limit?: number;
    include_old_rooms?: MSC3575RoomSubscription;
}
```

---

## 基本使用

### 创建 Sliding Sync 实例

```typescript
import { SlidingSync } from "matrix-js-sdk";

const client = sdk.createClient({ ... });

// 创建 Sliding Sync
const slidingSync = new SlidingSync({
    client: client,
    proxyBaseUrl: "https://sync.proxy.server", // 滑动同步代理 URL
    listPrefix: "my_app_", // 列表前缀（用于存储状态）
});

// 启动同步
await slidingSync.start();
```

### 定义列表

```typescript
// 定义一个"所有房间"列表
slidingSync.list("all_rooms", {
    ranges: [[0, 19]], // 前 20 个房间
    sort: ["by_recency", "by_name"], // 按最近时间和名称排序
    filters: {
        is_dm: false, // 排除直接消息
    },
    required_state: [
        ["m.room.avatar", ""],          // 房间头像
        ["m.room.name", ""],            // 房间名称
        ["m.room.topic", ""],           // 房间主题
        ["m.room.encryption", ""],      // 加密状态
    ],
    timeline_limit: 10, // 每个房间最多 10 条消息
});

// 定义一个"未读房间"列表
slidingSync.list("unread_rooms", {
    ranges: [[0, 9]],
    sort: ["by_notification_count", "by_recency"],
    filters: {
        is_dm: false,
        // 通过扩展过滤未读
    },
    required_state: [
        ["m.room.name", ""],
        ["m.room.encryption", ""],
    ],
    timeline_limit: 5,
});

// 定义一个"直接消息"列表
slidingSync.list("direct_messages", {
    ranges: [[0, 49]],
    sort: ["by_recency"],
    filters: {
        is_dm: true, // 仅直接消息
    },
    required_state: [
        ["m.room.avatar", ""],
        ["m.room.name", ""],
    ],
    timeline_limit: 5,
});
```

### 设置全局房间订阅

```typescript
// 全局订阅 - 适用于所有房间
slidingSync.setRoomSubscribe({
    required_state: [
        ["m.room.power_levels", ""], // 权限等级
        ["m.room.join_rules", ""],   // 加入规则
    ],
    timeline_limit: 0, // 不需要时间线消息
});

// 针对特定房间的订阅
slidingSync.setRoomSubscriptions({
    "!importantRoom:server.com": {
        required_state: [
            ["m.room.avatar", ""],
            ["m.room.name", ""],
            ["m.room.topic", ""],
            ["m.room.member", "@user:server.com"], // 特定成员
        ],
        timeline_limit: 50, // 更多消息
    },
});
```

---

## 滑动窗口操作

### 调整窗口范围

```typescript
// 获取更多房间（向下滚动）
const list = slidingSync.getList("all_rooms");

// 当前范围 [0, 19]，扩展到 [0, 29]
list.setRanges([[0, 29]]);

// 分页加载第二页 [20, 39]
list.setRanges([[0, 19], [20, 39]]);

// 加载特定索引 [50, 69]
list.setRanges([[50, 69]]);

// 移除不需要的窗口
list.setRanges([[20, 39]]);
```

### 动态过滤

```typescript
// 动态更新过滤条件
const list = slidingSync.getList("all_rooms");

// 按名称搜索
list.setFilters({
    is_dm: false,
    room_name_like: "matrix", // 搜索包含 "matrix" 的房间
});

// 按空间过滤
list.setFilters({
    spaces: ["!spaceId:server.com"], // 仅该空间下的房间
});

// 按标签过滤
list.setFilters({
    tags: ["m.favourite"], // 仅收藏的房间
});

// 清除过滤
list.setFilters({});
```

---

## 事件监听

### 监听列表更新

```typescript
// 监听列表变化
slidingSync.on("SlidingSyncEvent.Lifecycle", (state, list) => {
    if (state === "COMPLETE") {
        // 同步完成，获取房间列表
        const roomIds = list.getRoomIds();
        console.log("房间列表:", roomIds);

        // 获取房间数据
        roomIds.forEach((roomId) => {
            const roomData = list.getRoomData(roomId);
            console.log(roomData);
        });
    }
});

// 监听列表中的房间变化
slippingSync.on("SlidingSyncEvent.Room", (roomId, roomData, list) => {
    console.log("房间更新:", roomId, roomData);
    // {
    //   name: "Room Name",
    //   required_state: [...],
    //   timeline: [...],
    //   notification_count: 5,
    //   highlight_count: 2,
    //   joined_count: 10,
    //   invited_count: 2,
    //   ...
    // }
});
```

### 监听房间数据更新

```typescript
// 监听特定房间的更新
slidingSync.on("SlidingSyncEvent.RoomData", (roomId, roomData) => {
    console.log(`${roomId}:`, {
        name: roomData.name,
        unread: roomData.notification_count,
        highlight: roomData.highlight_count,
        members: roomData.joined_count,
    });
});
```

---

## 完整示例：房间列表管理器

```typescript
import { SlidingSync, SlidingSyncEvent } from "matrix-js-sdk";

class RoomListManager {
    private slidingSync: SlidingSync;
    private pageSize = 50;

    constructor(client: sdk.MatrixClient, proxyUrl: string) {
        this.slidingSync = new SlidingSync({
            client: client,
            proxyBaseUrl: proxyUrl,
        });

        this.setupListeners();
    }

    private setupListeners() {
        // 监听所有房间列表更新
        this.slidingSync.on(
            SlidingSyncEvent.Room,
            (roomId, roomData, list) => {
                if (list.name === "all_rooms") {
                    this.updateRoomUI(roomId, roomData);
                }
            }
        );
    }

    async start() {
        // 定义列表
        this.slidingSync.list("all_rooms", {
            ranges: [[0, this.pageSize - 1]],
            sort: ["by_recency", "by_name"],
            filters: { is_dm: false },
            required_state: [
                ["m.room.avatar", ""],
                ["m.room.name", ""],
                ["m.room.topic", ""],
            ],
            timeline_limit: 5,
        });

        this.slidingSync.list("direct_messages", {
            ranges: [[0, this.pageSize - 1]],
            sort: ["by_recency"],
            filters: { is_dm: true },
            required_state: [
                ["m.room.avatar", ""],
                ["m.room.name", ""],
            ],
            timeline_limit: 5,
        });

        await this.slidingSync.start();
    }

    // 加载更多房间
    loadMoreRooms(listName: string = "all_rooms") {
        const list = this.slidingSync.getList(listName);
        const currentRanges = list.getRanges();
        const maxIndex = Math.max(...currentRanges.flat());

        // 扩展范围
        const newRanges = [...currentRanges, [maxIndex + 1, maxIndex + this.pageSize]];
        list.setRanges(newRanges);
    }

    // 搜索房间
    searchRooms(query: string) {
        const list = this.slidingSync.getList("all_rooms");
        list.setFilters({
            is_dm: false,
            room_name_like: query,
        });
    }

    // 清除搜索
    clearSearch() {
        const list = this.slidingSync.getList("all_rooms");
        list.setFilters({ is_dm: false });
    }

    // 订阅特定房间
    subscribeToRoom(roomId: string) {
        this.slidingSync.setRoomSubscriptions({
            [roomId]: {
                required_state: [
                    ["m.room.avatar", ""],
                    ["m.room.name", ""],
                    ["m.room.topic", ""],
                    ["m.room.power_levels", ""],
                    ["m.room.member", "@me:server.com"],
                ],
                timeline_limit: 100, // 加载更多消息
            },
        });
    }

    // 取消订阅
    unsubscribeFromRoom(roomId: string) {
        this.slidingSync.setRoomSubscriptions({
            [roomId]: null, // null 表示取消订阅
        });
    }

    private updateRoomUI(roomId: string, roomData: sdk.MSC3575RoomData) {
        // 更新 UI
        console.log(`更新房间 ${roomId}:`, {
            name: roomData.name,
            unread: roomData.notification_count,
            highlight: roomData.highlight_count,
        });
    }
}

// 使用示例
const client = sdk.createClient({ ... });
const roomListManager = new RoomListManager(
    client,
    "https://sliding-sync.example.com"
);

await roomListManager.start();

// 加载更多房间
roomListManager.loadMoreRooms();

// 搜索
roomListManager.searchRooms("matrix");

// 清除搜索
roomListManager.clearSearch();
```

---

## 高级功能

### 扩展（Extensions）

Sliding Sync 支持扩展来增强功能：

```typescript
// 启用扩展
slidingSync.setExtensions({
    // 计算未读数
    "unread_notifications": {
        enabled: true,
    },

    // 账户数据
    "account_data": {
        enabled: true,
    },

    // Receipt（已读回执）
    "receipts": {
        enabled: true,
    },

    // 发送者信息
    "e2ee": {
        enabled: true,
    },

    // Typing（输入指示器）
    "typing": {
        enabled: true,
    },
});
```

### 自定义排序

```typescript
// 按多个字段排序
slidingSync.list("custom_sort", {
    ranges: [[0, 19]],
    sort: [
        "by_tag",         // 先按标签排序
        "by_recency",     // 然后按最近时间
        "by_name",        // 最后按名称
    ],
});

// 可用排序选项:
// - by_recency: 最近活动
// - by_name: 房间名称
// - by_notification_count: 未读数
// - by_recency: 优先级
// - by_tag: 标签
```

### 分组列表

```typescript
// 创建多个列表用于不同用途
// 1. 收藏的房间
slidingSync.list("favorites", {
    ranges: [[0, 9]],
    filters: { tags: ["m.favourite"] },
});

// 2. 低优先级房间
slidingSync.list("low_priority", {
    ranges: [[0, 19]],
    filters: { tags: ["m.lowpriority"] },
});

// 3. 特定空间的房间
slidingSync.list("space_rooms", {
    ranges: [[0, 29]],
    filters: { spaces: ["!spaceId:server.com"] },
});
```

---

## 与传统 /sync 共存

### 混合模式

```typescript
// 可以同时使用 Sliding Sync 和传统 /sync
const client = sdk.createClient({ ... });

// 使用传统同步获取账户数据
await client.startClient();

// 使用 Sliding Sync 获取房间列表
const slidingSync = new SlidingSync({
    client: client,
    proxyBaseUrl: "https://sliding-sync.example.com",
});

await slidingSync.start();
```

### 迁移策略

```typescript
// 1. 保留传统 /sync 用于账户数据、设备列表等
// 2. 使用 Sliding Sync 用于房间列表和消息

const client = sdk.createClient({
    baseUrl: "https://matrix.server.com",
});

// 传统同步（后台）
await client.startClient();

// Sliding Sync（前台 UI）
const slidingSync = new SlidingSync({
    client: client,
    proxyBaseUrl: "https://sliding-sync.example.com",
});

await slidingSync.start();
```

---

## 性能优化

### 延迟加载

```typescript
// 仅加载可见窗口的房间
const visibleRange = [scrollTop, scrollTop + pageSize];
slidingSync.getList("all_rooms").setRanges([visibleRange]);

// 滚动时加载更多
onScroll(() => {
    const newRange = [scrollTop, scrollTop + pageSize];
    slidingSync.getList("all_rooms").setRanges([newRange]);
});
```

### 最小化 required_state

```typescript
// 仅请求需要的状态事件
slidingSync.list("minimal", {
    ranges: [[0, 99]],
    required_state: [
        ["m.room.name", ""], // 仅名称
    ],
    timeline_limit: 0, // 不需要消息
});
```

### 智能缓存

```typescript
// 使用本地缓存减少网络请求
const cachedRooms = loadFromCache();

if (cachedRooms) {
    // 显示缓存数据
    renderRooms(cachedRooms);

    // 后台更新
    slidingSync.on("SlidingSyncEvent.Lifecycle", (state) => {
        if (state === "COMPLETE") {
            const updatedRooms = slidingSync.getList("all_rooms").getRoomIds();
            saveToCache(updatedRooms);
            renderRooms(updatedRooms);
        }
    });
}
```

---

## 故障排查

### 连接问题

```typescript
slidingSync.on("SlidingSyncEvent.Lifecycle", (state) => {
    if (state === "ERROR") {
        console.error("Sliding Sync 出错");
        // 回退到传统 /sync
        fallbackToTraditionalSync();
    }
});
```

### 调试模式

```typescript
// 启用详细日志
const slidingSync = new SlidingSync({
    client: client,
    proxyBaseUrl: "https://sliding-sync.example.com",
    logger: {
        debug: (msg) => console.log("[SlidingSync]", msg),
        error: (msg) => console.error("[SlidingSync]", msg),
    },
});
```

---

## 相关文档

- [01-client-basics.md](./01-client-basics.md) - 客户端基础
- [03-room-management.md](./03-room-management.md) - 房间管理
- [MSC 3575 - Sliding Sync](https://github.com/matrix-org/matrix-spec-proposals/pull/3575)
- [MSC 4186 - Room Summary](https://github.com/matrix-org/matrix-spec-proposals/pull/4186)

---

**文档维护**: 如有更新，请同步修改 Matrix SDK 版本号和最后更新日期。
