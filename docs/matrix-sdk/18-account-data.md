# Matrix SDK - 帐号数据 (Account Data)

**文档版本**: 1.0.0
**SDK 版本**: 39.1.3
**最后更新**: 2026-01-04
**相关规范**: [Account Data API](https://spec.matrix.org/v1.10/client-server-api/#account-data)

---

## 概述

Matrix SDK 提供**帐号数据（Account Data）**功能，允许客户端存储用户特定的数据和配置。

帐号数据的特点：
- ✅ **全局作用域** - 存储的数据与帐号关联，不限于特定设备
- ✅ **自动同步** - 通过 `/sync` 端点自动同步到所有设备
- ✅ **任意类型** - 支持任意 JSON 数据结构
- ✅ **事件类型** - 每个帐号数据项都有唯一的事件类型标识

---

## 常见帐号数据类型

SDK 内置支持以下常见帐号数据类型：

| 事件类型 | 用途 |
|---------|------|
| `m.direct` | 直接消息房间列表 |
| `m.ignored_user_list` | 忽略的用户列表 |
| `m.push_rules` | 推送通知规则 |
| `m.rule_master` | 主推送到规则状态 |
| `im.vector.web.settings` | Element Web 特定设置 |
| `org.matrix.conditional_auth` | 条件认证状态 |

---

## API 使用方法

### 获取帐号数据

```typescript
import * as sdk from "matrix-js-sdk";

const client = sdk.createClient({ ... });

// 方式 1: 获取本地缓存的帐号数据（快速）
const directRooms = client.getAccountData("m.direct");
console.log(directRooms?.getContent());
// { "@user1:server.com": ["!room1:server.com", "!room2:server.com"] }

// 方式 2: 从服务器获取最新数据（较慢，但保证最新）
const latestDirectRooms = await client.getAccountDataFromServer("m.direct");
console.log(latestDirectRooms);
```

### 设置帐号数据

```typescript
// 方式 1: 等待远程回执（推荐，确保数据已保存）
await client.setAccountData("m.direct", {
    "@user1:server.com": ["!room1:server.com"],
    "@user2:server.com": ["!room2:server.com"],
});

// 方式 2: 直接发送，不等待回执（更快，但不保证已保存）
await client.setAccountDataRaw("m.direct", {
    "@user1:server.com": ["!room1:server.com"],
});
```

---

## 内置帐号数据类型

### 1. 直接消息列表 (m.direct)

```typescript
// 获取直接消息房间
const directRooms = client.getAccountData("m.direct")?.getContent();
// 返回: { "@user:server.com": ["!roomId:server.com"] }

// 设置直接消息房间
await client.setAccountData("m.direct", {
    "@alice:example.com": ["!dmRoom1:example.com"],
    "@bob:example.com": ["!dmRoom2:example.com"],
});

// 检查房间是否为直接消息
function isDirectRoom(roomId: string): boolean {
    const directRooms = client.getAccountData("m.direct")?.getContent() || {};
    return Object.values(directRooms).some((rooms: string[]) =>
        rooms.includes(roomId)
    );
}

// 获取与特定用户的直接消息房间
function getDirectRoomForUser(userId: string): string[] {
    const directRooms = client.getAccountData("m.direct")?.getContent() || {};
    return directRooms[userId] || [];
}
```

### 2. 忽略用户列表 (m.ignored_user_list)

```typescript
// 忽略用户
await client.setIgnoredUsers(["@spam:server.com", "@bot:server.com"]);

// 取消忽略用户
await client.unignoreUsers(["@bot:server.com"]);

// 检查用户是否被忽略
const isIgnored = client.isUserIgnored("@spam:server.com");
// 返回: true

// 获取所有被忽略的用户
const ignoredUsers = client.getIgnoredUsers();
// 返回: ["@spam:server.com"]
```

### 3. 推送规则 (m.push_rules)

```typescript
// 推送规则已在 17-push-notifications.md 中详细介绍

// 获取推送规则
const pushRules = await client.getPushRules();

// 修改推送规则（SDK 会自动保存到帐号数据）
await client.setPushRuleEnabled(
    "global",
    sdk.PushRuleKind.Override,
    ".m.rule.master",
    true
);
```

---

## 自定义帐号数据

### 存储应用设置

```typescript
// 定义应用设置接口
interface AppSettings {
    theme: "light" | "dark" | "auto";
    language: string;
    notifications: boolean;
    fontSize: number;
}

// 保存应用设置
await client.setAccountData("com.example.app.settings", {
    theme: "dark",
    language: "zh-CN",
    notifications: true,
    fontSize: 14,
});

// 读取应用设置
const settingsEvent = client.getAccountData("com.example.app.settings");
const settings = settingsEvent?.getContent() as AppSettings;
console.log(settings.theme); // "dark"
```

### 存储用户偏好

```typescript
// 保存房间排序偏好
await client.setAccountData("com.example.app.room_sort", {
    sortBy: "activity", // 'activity' | 'name' | 'manual'
    ascending: false,
    favoritesFirst: true,
});

// 保存侧边栏状态
await client.setAccountData("com.example.app.sidebar", {
    collapsedRooms: ["!room1:server.com", "!room2:server.com"],
    pinnedSpaces: ["!space1:server.com"],
    width: 300,
});
```

### 存储聊天记录

```typescript
// 保存最近搜索
await client.setAccountData("com.example.app.search_history", {
    recentQueries: ["matrix", "synapse", "dendrite"],
    maxHistory: 10,
});

// 保存表情符号使用记录
await client.setAccountData("com.example.app.emoji_stats", {
    frequentlyUsed: ["\u{1F44D}", "\u{1F60A}", "\u{2764}"],
    lastUsed: {
        "\u{1F44D}": Date.now(),
    },
});
```

---

## 帐号数据事件处理

### 监听帐号数据变化

```typescript
// 监听帐号数据事件
client.on(sdk.ClientEvent.AccountData, (event) => {
    const eventType = event.getType();
    const content = event.getContent();

    console.log(`帐号数据更新: ${eventType}`, content);

    switch (eventType) {
        case "m.direct":
            console.log("直接消息列表已更新");
            break;
        case "m.ignored_user_list":
            console.log("忽略用户列表已更新");
            break;
        case "com.example.app.settings":
            console.log("应用设置已更新");
            break;
    }
});
```

### 特定帐号数据类型监听

```typescript
// 监听特定类型
function watchAccountData(eventType: string, callback: (content: any) => void) {
    const handler = (event: sdk.MatrixEvent) => {
        if (event.getType() === eventType) {
            callback(event.getContent());
        }
    };

    client.on(sdk.ClientEvent.AccountData, handler);

    // 返回取消监听函数
    return () => client.off(sdk.ClientEvent.AccountData, handler);
}

// 使用示例
const unsubscribe = watchAccountData("com.example.app.settings", (settings) => {
    console.log("设置已更新:", settings);
    // 更新 UI
});

// 取消监听
unsubscribe();
```

---

## 完整示例：应用设置管理器

```typescript
import * as sdk from "matrix-js-sdk";

interface AppSettings {
    theme: "light" | "dark" | "auto";
    language: string;
    notifications: boolean;
    fontSize: number;
    sidebarCollapsed: boolean;
}

class SettingsManager {
    private readonly eventType = "com.example.app.settings";
    private settings: AppSettings;
    private listeners: Set<(settings: AppSettings) => void> = new Set();

    constructor(private client: sdk.MatrixClient) {
        // 加载初始设置
        const event = this.client.getAccountData(this.eventType);
        this.settings = this.getDefaultSettings();

        if (event) {
            this.settings = { ...this.settings, ...event.getContent() };
        }

        // 监听设置变更
        this.client.on(sdk.ClientEvent.AccountData, (event) => {
            if (event.getType() === this.eventType) {
                this.settings = event.getContent();
                this.notifyListeners();
            }
        });
    }

    private getDefaultSettings(): AppSettings {
        return {
            theme: "auto",
            language: "en",
            notifications: true,
            fontSize: 14,
            sidebarCollapsed: false,
        };
    }

    // 获取当前设置
    getSettings(): AppSettings {
        return { ...this.settings };
    }

    // 更新单个设置
    async updateSetting<K extends keyof AppSettings>(
        key: K,
        value: AppSettings[K]
    ): Promise<void> {
        this.settings[key] = value;
        await this.save();
    }

    // 批量更新设置
    async updateSettings(updates: Partial<AppSettings>): Promise<void> {
        this.settings = { ...this.settings, ...updates };
        await this.save();
    }

    // 保存设置到服务器
    private async save(): Promise<void> {
        await this.client.setAccountData(this.eventType, this.settings);
    }

    // 监听设置变更
    onChange(callback: (settings: AppSettings) => void): () => void {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    private notifyListeners(): void {
        this.listeners.forEach((callback) => callback(this.getSettings()));
    }
}

// 使用示例
const client = sdk.createClient({ ... });
await client.startClient();

const settingsManager = new SettingsManager(client);

// 读取设置
const settings = settingsManager.getSettings();
console.log("当前主题:", settings.theme);

// 更新设置
await settingsManager.updateSetting("theme", "dark");

// 监听设置变更
settingsManager.onChange((newSettings) => {
    console.log("设置已更新:", newSettings);
    applyTheme(newSettings.theme);
});
```

---

## 帐号数据最佳实践

### 1. 使用命名空间

```typescript
// ✅ 推荐: 使用反向域名表示法
await client.setAccountData("com.example.app.settings", { ... });
await client.setAccountData("com.example.app.preferences", { ... });
await client.setAccountData("com.example.app.cache", { ... });

// ❌ 不推荐: 使用简短或通用的名称
await client.setAccountData("settings", { ... }); // 可能冲突
await client.setAccountData("data", { ... }); // 太通用
```

### 2. 数据结构设计

```typescript
// ✅ 推荐: 结构化，易于扩展
await client.setAccountData("com.example.app.ui", {
    theme: "dark",
    fontSize: 14,
    sidebar: {
        width: 300,
        collapsed: false,
        position: "left",
    },
    chat: {
        inputHeight: 100,
        showTimestamps: true,
    },
});

// ❌ 不推荐: 扁平结构，难以组织
await client.setAccountData("com.example.app.ui", {
    theme: "dark",
    sidebar_width: 300,
    sidebar_collapsed: false,
    chat_input_height: 100,
});
```

### 3. 数据大小限制

```typescript
// ✅ 推荐: 只存储必要的数据
await client.setAccountData("com.example.app.recent_rooms", {
    roomIds: ["!room1:server.com", "!room2:server.com"], // 只存 ID
    timestamp: Date.now(),
});

// ❌ 不推荐: 存储大量数据
await client.setAccountData("com.example.app.room_cache", {
    rooms: fullRoomDetails, // 可能包含大量数据
});
```

### 4. 版本控制

```typescript
// ✅ 推荐: 包含版本信息
interface AppData {
    version: 1; // 数据版本
    settings: { ... };
    migrated: boolean;
}

await client.setAccountData("com.example.app.data", {
    version: 1,
    settings: { ... },
    migrated: true,
});

// 读取时检查版本
const data = client.getAccountData("com.example.app.data")?.getContent();
if (data?.version < 2) {
    // 执行数据迁移
    await migrateData(data);
}
```

---

## 帐号数据与房间标签的区别

| 特性 | 帐号数据 | 房间标签 (m.tag) |
|------|---------|-----------------|
| 作用域 | 全局 | 特定房间 |
| 存储位置 | 帐号数据事件 | 房间账户数据事件 |
| 同步范围 | 所有设备 | 所有设备 |
| 典型用途 | 应用设置、用户偏好 | 房间分类（收藏、低优先级等） |
| API | `setAccountData()` | `setRoomTag()` |

```typescript
// 帐号数据示例
await client.setAccountData("com.example.settings", {
    theme: "dark",
});

// 房间标签示例
await client.setRoomTag("!roomId:server.com", "m.favourite", {
    order: 0.5, // 排序值
});
```

---

## 故障排查

### 帐号数据不同步

```typescript
// 强制从服务器刷新
const latest = await client.getAccountDataFromServer("m.direct");

// 检查同步状态
if (client.isSyncing()) {
    console.log("正在同步，请稍后...");
} else {
    console.log("同步已完成");
}
```

### 帐号数据丢失

```typescript
// 备份重要帐号数据
async function backupAccountData(eventTypes: string[]) {
    const backup: Record<string, any> = {};

    for (const type of eventTypes) {
        const event = await client.getAccountDataFromServer(type);
        if (event) {
            backup[type] = event;
        }
    }

    // 下载备份
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `matrix-account-data-backup-${Date.now()}.json`;
    a.click();
}

// 使用示例
await backupAccountData([
    "m.direct",
    "m.ignored_user_list",
    "m.push_rules",
    "com.example.app.settings",
]);
```

---

## 相关文档

- [01-client-basics.md](./01-client-basics.md) - 客户端基础
- [03-room-management.md](./03-room-management.md) - 房间管理（房间标签）
- [17-push-notifications.md](./17-push-notifications.md) - 推送通知
- [Matrix 规范 - 帐号数据](https://spec.matrix.org/v1.10/client-server-api/#account-data)

---

**文档维护**: 如有更新，请同步修改 Matrix SDK 版本号和最后更新日期。
