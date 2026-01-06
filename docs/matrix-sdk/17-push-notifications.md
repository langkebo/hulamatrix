# Matrix SDK - 推送通知 (Push Notifications)

**文档版本**: 1.0.0
**SDK 版本**: 39.1.3
**最后更新**: 2026-01-04
**相关规范**: [Push Notifications API](https://spec.matrix.org/v1.10/client-server-api/#push-notifications)

---

## 概述

Matrix SDK 提供完整的**推送通知（Push Notifications）**功能，包括：

- **推送规则（Push Rules）** - 定义何时发送通知
- **推送处理器（Push Processor）** - 评估事件是否应该触发通知
- **推送动作（Push Actions）** - 定义通知的行为（通知、声音、高亮等）
- **推送网关集成** - 与原生推送系统集成（FCM、APNs 等）

---

## 核心概念

### 推送通知类型

```typescript
enum PushRuleActionName {
    Notify = "notify",           // 发送通知
    DontNotify = "dont_notify",  // 不发送通知
    Coalesce = "coalesce",       // 合并通知
}

enum TweakName {
    Sound = "sound",             // 播放声音
    Highlight = "highlight",     // 高亮显示
    Value = "value",             // 设置值（如音量）
}
```

### 推送规则类型

```typescript
enum PushRuleKind {
    Override = "override",         // 覆盖规则（最高优先级）
    ContentSpecific = "content",   // 内容特定规则
    RoomSpecific = "room",         // 房间特定规则
    SenderSpecific = "sender",     // 发送者特定规则
    Underride = "underride",       // 底层规则（最低优先级）
}
```

---

## 推送规则（Push Rules）

### 获取推送规则

```typescript
import * as sdk from "matrix-js-sdk";

const client = sdk.createClient({ ... });

// 获取所有推送规则
const pushRules = await client.getPushRules();
console.log(pushRules);

// 输出结构:
// {
//   global: {
//     override: [...],
//     content: [...],
//     room: [...],
//     sender: [...],
//     underride: [...]
//   },
//   device: { ... }
// }
```

### 推送规则结构

```typescript
interface IPushRule {
    rule_id: string;              // 规则 ID
    default: boolean;             // 是否为默认规则
    enabled: boolean;             // 是否启用
    actions: PushRuleAction[];    // 动作列表
    conditions?: PushRuleCondition[]; // 条件列表
    pattern?: string;             // 匹配模式（仅内容规则）
}

interface IPushRuleCondition {
    kind: ConditionKind;          // 条件类型
    key: string;                  // 条件键
    pattern?: string;             // 匹配模式
    value?: any;                  // 条件值
}
```

### 推送规则条件类型

```typescript
enum ConditionKind {
    EventMatch = "event_match",                    // 事件匹配
    EventPropertyIs = "event_property_is",        // 属性等于值
    EventPropertyContains = "event_property_contains", // 属性包含值
    RoomMemberCount = "room_member_count",        // 房间成员数
    SenderNotificationPermission = "sender_notification_permission", // 发送者权限
    ContainsDisplayName = "contains_display_name", // 包含显示名称
    CallStarted = "org.matrix.msc3914.call_started", // 通话开始
}
```

---

## 推送处理器（PushProcessor）

### 创建推送处理器

```typescript
import { PushProcessor } from "matrix-js-sdk";

const pushProcessor = new PushProcessor({
    client: client,
});
```

### 评估事件是否应该通知

```typescript
// 检查事件是否应该触发通知
const event = room.getLiveTimeline().getEvents()[0];

const pushDetails = pushProcessor.actionsForEvent(event);

console.log(pushDetails);
// {
//   notify: true,
//   tweaks: {
//     sound: "default",
//     highlight: true
//   },
//   rule: { ... }
// }
```

### 推送详情结构

```typescript
interface PushDetails {
    notify: boolean;           // 是否应该通知
    tweaks?: {                 // 调整参数
        sound?: string;        // 声音名称
        highlight?: boolean;   // 是否高亮
        value?: number;        // 值（如音量）
    };
    rule?: IPushRule;          // 匹配的规则
}
```

---

## 推送规则管理

### 启用/禁用规则

```typescript
// 启用规则
await client.setPushRuleEnabled("global", PushRuleKind.Override, ".m.rule.master", true);

// 禁用规则
await client.setPushRuleEnabled("global", PushRuleKind.Override, ".m.rule.master", false);
```

### 添加规则

```typescript
// 添加内容规则（包含关键词时通知）
await client.addPushRule(
    "global",                    // scope
    PushRuleKind.ContentSpecific, // kind
    "my_custom_rule",           // rule_id
    {
        actions: [
            PushRuleActionName.Notify,
            { set_tweak: TweakName.Highlight, value: true },
            { set_tweak: TweakName.Sound, value: "default" },
        ],
        pattern: "urgent",       // 匹配 "urgent" 关键词
    }
);

// 添加房间规则（特定房间通知）
await client.addPushRule(
    "global",
    PushRuleKind.RoomSpecific,
    "!roomId:server.com",
    {
        actions: [
            PushRuleActionName.Notify,
            { set_tweak: TweakName.Sound, value: "bell" },
        ],
    }
);

// 添加覆盖规则（高级条件）
await client.addPushRule(
    "global",
    PushRuleKind.Override,
    "my_override_rule",
    {
        actions: [
            PushRuleActionName.Notify,
            { set_tweak: TweakName.Highlight, value: true },
        ],
        conditions: [
            {
                kind: ConditionKind.EventMatch,
                key: "type",
                pattern: "m.room.message",
            },
            {
                kind: ConditionKind.RoomMemberCount,
                is: "2", // 仅 1 对 1 聊天
            },
        ],
    }
);
```

### 删除规则

```typescript
await client.deletePushRule("global", PushRuleKind.ContentSpecific, "my_custom_rule");
```

---

## 推送规则条件示例

### 1. 匹配特定事件类型

```typescript
{
    kind: ConditionKind.EventMatch,
    key: "type",
    pattern: "m.room.message"
}
```

### 2. 匹配房间成员数

```typescript
// 1 对 1 聊天
{
    kind: ConditionKind.RoomMemberCount,
    is: "2"
}

// 群聊（3-10人）
{
    kind: ConditionKind.RoomMemberCount,
    is: "3|10"
}
```

### 3. 包含显示名称

```typescript
{
    kind: ConditionKind.ContainsDisplayName
}
```

### 4. 属性等于值

```typescript
// 检查是否为房间提及
{
    kind: ConditionKind.EventPropertyIs,
    key: "content.m\\.mentions.room",
    value: true
}
```

### 5. 属性包含值

```typescript
{
    kind: ConditionKind.EventPropertyContains,
    key: "content.body",
    value: "keyword"
}
```

---

## 默认推送规则

SDK 提供以下默认推送规则：

### 覆盖规则（Override）

| 规则 ID | 描述 |
|---------|------|
| `.m.rule.master` | 主规则，禁用后所有通知被阻止 |
| `.m.rule.suppress_notices` | 抑制通知消息（m.notice） |
| `.m.rule.invite_for_me` | 邀请我时通知 |
| `.m.rule.member_event` | 成员事件（离开/加入） |
| `.m.rule.is_user_mention` | 用户提及（@username） |
| `.m.rule.contains_display_name` | 包含显示名称 |
| `.m.rule.is_room_mention` | 房间提及（@room） |
| `.m.rule.at_room_notification` | @room 通知 |
| `.m.rule.reaction` | 反应事件（默认不通知） |
| `.m.rule.suppress_edits` | 抑制编辑通知 |

### 底层规则（Underride）

| 规则 ID | 描述 |
|---------|------|
| `.m.rule.call` | 来电通知 |
| `.m.rule.encrypted_room` | 加密房间消息 |
| `.m.rule.message` | 普通消息 |
| `.m.rule.encrypted` | 加密消息 |

---

## 推送通知集成

### Web Push API

```typescript
// 使用 Web Push API
await client.setPusher({
    kind: "http",
    app_id: "my.app.id",
    app_display_name: "My Matrix App",
    device_display_name: "Chrome on Windows",
    pushkey: await webPushSubscription.getKey("p256dh"),
    lang: "en",
    data: {
        url: webPushSubscription.endpoint,
    },
    tags: {
        ["uk.half-arrow.msc2654.notify"]: true,
    },
});
```

### Firebase Cloud Messaging (FCM)

```typescript
await client.setPusher({
    kind: "http",
    app_id: "com.example.matrix",
    app_display_name: "Matrix App",
    device_display_name: "Android Device",
    pushkey: fcmToken,
    lang: "en",
    data: {
        url: "https://fcm.googleapis.com/",
    },
    tags: {
        ["uk.half-arrow.msc2654.notify"]: true,
    },
});
```

### Apple Push Notification Service (APNs)

```typescript
await client.setPusher({
    kind: "http",
    app_id: "com.example.matrix",
    app_display_name: "Matrix App",
    device_display_name: "iPhone",
    pushkey: apnsDeviceToken,
    lang: "en",
    data: {
        url: "https://push.apple.com/",
    },
    tags: {
        ["uk.half-arrow.msc2654.notify"]: true,
    },
});
```

---

## 处理推送通知

### 监听推送事件

```typescript
client.on(sdk.RoomEvent.Timeline, (event, room) => {
    // 评估是否应该通知
    const pushDetails = pushProcessor.actionsForEvent(event);

    if (pushDetails.notify) {
        // 发送本地通知
        sendLocalNotification({
            title: room.name,
            body: event.getContent().body,
            sound: pushDetails.tweaks?.sound || "default",
            highlight: pushDetails.tweaks?.highlight || false,
        });
    }
});
```

### 未读计数

```typescript
// 获取房间未读计数
const room = client.getRoom("!roomId:server.com");
const notificationCount = room.getUnreadNotificationCount();
const highlightCount = room.getUnreadHighlightCount();

// 获取全局未读计数
const totalUnread = Object.values(client.getRooms()).reduce((sum, room) => {
    return sum + room.getUnreadNotificationCount();
}, 0);
```

---

## 完整示例：推送通知管理

```typescript
import * as sdk from "matrix-js-sdk";

class NotificationManager {
    private client: sdk.MatrixClient;
    private pushProcessor: sdk.PushProcessor;

    constructor(client: sdk.MatrixClient) {
        this.client = client;
        this.pushProcessor = new sdk.PushProcessor({ client });
        this.setupListeners();
    }

    private setupListeners() {
        // 监听新消息
        this.client.on(sdk.RoomEvent.Timeline, (event, room) => {
            if (event.getType() !== sdk.EventType.RoomMessage) return;

            const pushDetails = this.pushProcessor.actionsForEvent(event);
            if (pushDetails.notify) {
                this.showNotification(event, room, pushDetails);
            }
        });
    }

    private showNotification(
        event: sdk.MatrixEvent,
        room: sdk.Room,
        pushDetails: sdk.PushDetails
    ) {
        const content = event.getContent();
        const sender = room.getMember(event.getSender())?.name || "Unknown";

        new Notification(`${sender} in ${room.name}`, {
            body: content.body,
            icon: room.getAvatarUrl(this.client.baseUrl),
            tag: event.getRoomId(),
            sound: pushDetails.tweaks?.sound || "default",
        });
    }

    // 自定义推送规则
    async addCustomKeywordRule(keyword: string) {
        await this.client.addPushRule(
            "global",
            sdk.PushRuleKind.ContentSpecific,
            `keyword_${keyword}`,
            {
                actions: [
                    sdk.PushRuleActionName.Notify,
                    { set_tweak: sdk.TweakName.Highlight, value: true },
                    { set_tweak: sdk.TweakName.Sound, value: "default" },
                ],
                pattern: keyword,
            }
        );
    }

    // 禁用特定房间的通知
    async muteRoom(roomId: string) {
        await this.client.addPushRule(
            "global",
            sdk.PushRuleKind.Override,
            `mute_${roomId}`,
            {
                actions: [sdk.PushRuleActionName.DontNotify],
                conditions: [
                    {
                        kind: sdk.ConditionKind.EventMatch,
                        key: "room_id",
                        pattern: roomId,
                    },
                ],
            }
        );
    }

    // 启用 1 对 1 聊天的特殊通知
    async enableDirectChatNotifications() {
        await this.client.addPushRule(
            "global",
            sdk.PushRuleKind.Override,
            "direct_chats",
            {
                actions: [
                    sdk.PushRuleActionName.Notify,
                    { set_tweak: sdk.TweakName.Highlight, value: true },
                    { set_tweak: sdk.TweakName.Sound, value: "ring" },
                ],
                conditions: [
                    {
                        kind: sdk.ConditionKind.EventMatch,
                        key: "type",
                        pattern: "m.room.message",
                    },
                    {
                        kind: sdk.ConditionKind.RoomMemberCount,
                        is: "2",
                    },
                ],
            }
        );
    }
}

// 使用示例
const client = sdk.createClient({ ... });
await client.startClient();
const notificationManager = new NotificationManager(client);
```

---

## 推送规则最佳实践

### 1. 按优先级组织规则

```typescript
// Override: 最高优先级，可以完全阻止通知
await client.addPushRule("global", PushRuleKind.Override, ...);

// Content: 特定内容匹配
await client.addPushRule("global", PushRuleKind.ContentSpecific, ...);

// Room: 特定房间
await client.addPushRule("global", PushRuleKind.RoomSpecific, ...);

// Sender: 特定发送者
await client.addPushRule("global", PushRuleKind.SenderSpecific, ...);

// Underride: 最低优先级，默认规则
await client.addPushRule("global", PushRuleKind.Underride, ...);
```

### 2. 使用 DontNotify 抑制通知

```typescript
// 抑制机器人消息
await client.addPushRule("global", PushRuleKind.SenderSpecific, "suppress_bot", {
    actions: [sdk.PushRuleActionName.DontNotify],
    pattern: "@bot:server.com",
});
```

### 3. 条件组合

```typescript
// 仅在非工作时间且包含紧急关键词时通知
await client.addPushRule("global", PushRuleKind.Override, "urgent_after_hours", {
    actions: [
        sdk.PushRuleActionName.Notify,
        { set_tweak: sdk.TweakName.Sound, value: "alert" },
        { set_tweak: sdk.TweakName.Highlight, value: true },
    ],
    conditions: [
        {
            kind: sdk.ConditionKind.EventPropertyContains,
            key: "content.body",
            value: "紧急",
        },
        // 添加时间条件（需要自定义实现）
    ],
});
```

---

## 调试推送规则

### 测试推送规则

```typescript
async function testPushRules(event: sdk.MatrixEvent) {
    const pushProcessor = new sdk.PushProcessor({ client });

    const pushDetails = pushProcessor.actionsForEvent(event);

    console.log("Should notify:", pushDetails.notify);
    console.log("Tweaks:", pushDetails.tweaks);
    console.log("Matching rule:", pushDetails.rule?.rule_id);
}
```

### 获取所有活动的规则

```typescript
function getActiveRules(client: sdk.MatrixClient): sdk.IPushRule[] {
    const pushRules = client.pushRules;
    const activeRules: sdk.IPushRule[] = [];

    for (const scope of ["global", "device"]) {
        for (const kind of Object.values(sdk.PushRuleKind)) {
            if (pushRules?.[scope]?.[kind]) {
                for (const rule of pushRules[scope][kind]) {
                    if (rule.enabled) {
                        activeRules.push(rule);
                    }
                }
            }
        }
    }

    return activeRules;
}
```

---

## 相关文档

- [01-client-basics.md](./01-client-basics.md) - 客户端基础
- [05-events-handling.md](./05-events-handling.md) - 事件处理
- [Matrix 规范 - 推送通知](https://spec.matrix.org/v1.10/client-server-api/#push-notifications)
- [Push Rules 规范](https://spec.matrix.org/v1.10/client-server-api/#push-rules)

---

**文档维护**: 如有更新，请同步修改 Matrix SDK 版本号和最后更新日期。
