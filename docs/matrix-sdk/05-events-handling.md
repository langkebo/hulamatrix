# 05. 事件处理

> Matrix JS SDK 事件系统、监听器、事件处理等

## 目录
- [事件系统概述](#事件系统概述)
- [客户端事件](#客户端事件)
- [房间事件](#房间事件)
- [成员事件](#成员事件)
- [加密事件](#加密事件)
- [通话事件](#通话事件)
- [自定义事件处理](#自定义事件处理)
- [事件过滤器](#事件过滤器)
- [完整示例](#完整示例)

## 事件系统概述

### EventEmitter 模式

Matrix JS SDK 使用 EventEmitter 模式处理事件：

```typescript
import * as sdk from "matrix-js-sdk";
import { ClientEvent, RoomEvent, RoomMemberEvent } from "matrix-js-sdk";

// 添加事件监听器
client.on(ClientEvent.Sync, (state, prevState, res) => {
  console.log(`Sync state: ${state}`);
});

// 添加一次性监听器
client.once(ClientEvent.Sync, (state) => {
  console.log("First sync:", state);
});

// 移除监听器
const handler = (state: string) => console.log(state);
client.on(ClientEvent.Sync, handler);
client.off(ClientEvent.Sync, handler);
```

### 事件类型

```typescript
// 客户端事件
enum ClientEvent {
  Sync,                    // 同步状态变化
  Event,                   // 接收到任何事件
  AccountData,             // 账户数据变化
  ToDevice,                // 设备到设备事件
  Presence,                // 在线状态变化
  Receipt,                 // 已读回执
  Tags,                    // 房间标签变化
  NewRoom,                 // 新房间
  DeleteRoom,              // 删除房间
  Room,                    // 房间相关事件
  Session,                 // 会话变化
  UserCrossSigningUpdated, // 交叉签名更新
  KeyVerificationStatus,   // 密钥验证状态
  KeyVerificationRequest,  // 密钥验证请求
  Devices,                 // 设备变化
  Crypto,                  // 加密事件
  Group,                   // 群组事件
}

// 房间事件
enum RoomEvent {
  Name,           // 房间名称变化
  Topic,          // 房间主题变化
  Avatar,         // 房间头像变化
  Alias,          // 房间别名变化
  Aliases,        // 房间别名列表变化
  MyMembership,   // 当前用户成员状态变化
  Member,         // 成员变化
  History,        // 历史可见性变化
  Tags,           // 标签变化
  Redaction,      // 事件被删除
  RedactionAction,// 删除操作
  LocalEchoUpdated, // 本地回显更新
  Timeline,       // 时间线新事件
  Receipt,        // 已读回执
  Typing,         // 输入状态
  NewReadReceipt, // 新的已读回执
}

// 成员事件
enum RoomMemberEvent {
  Name,           // 成员名称变化
  Avatar,         // 成员头像变化
  Presence,       // 成员在线状态变化
  Typing,         // 成员输入状态变化
  PowerLevel,     // 成员权限等级变化
  Membership,     // 成员状态变化
}
```

## 客户端事件

### 同步状态事件

```typescript
import { ClientEvent } from "matrix-js-sdk";

client.on(ClientEvent.Sync, (state, prevState, res) => {
  console.log(`Sync: ${prevState} -> ${state}`);

  switch (state) {
    case "PREPARED":
      // 初始同步完成，客户端准备就绪
      console.log("Client prepared");
      break;

    case "SYNCING":
      // 正在同步
      console.log("Syncing...");
      break;

    case "RECONNECTING":
      // 重新连接中
      console.log("Reconnecting...");
      break;

    case "ERROR":
      // 同步错误
      console.error("Sync error:", res?.getError());
      break;

    case "STOPPED":
      // 同步已停止
      console.log("Sync stopped");
      break;
  }
});
```

### 接收所有事件

```typescript
client.on(ClientEvent.Event, (event) => {
  console.log("Event type:", event.getType());
  console.log("Event ID:", event.getId());
  console.log("Room ID:", event.getRoomId());
  console.log("Sender:", event.getSender());
  console.log("Content:", event.getContent());
});
```

### 账户数据变化

```typescript
client.on(ClientEvent.AccountData, (event) => {
  console.log("Account data type:", event.getType());
  console.log("Account data content:", event.getContent());

  // 常见账户数据类型：
  // - m.direct: 直接聊天列表
  // - m.ignored_user_list: 忽略用户列表
  // - m.push_rules: 推送规则
});
```

### 设备到设备事件

```typescript
client.on(ClientEvent.ToDevice, (event) => {
  console.log("ToDevice event:", event.getType());
  console.log("Content:", event.getContent());

  // 常用于：
  // - 加密密钥交换
  // - 设备验证
  // - 安全确认
});
```

### 在线状态事件

```typescript
client.on(ClientEvent.Presence, (event) => {
  const content = event.getContent();
  console.log(`User ${event.getSender()} presence: ${content.presence}`);
  console.log(`Status: ${content.status_msg}`);
});
```

### 新房间事件

```typescript
client.on(ClientEvent.NewRoom, (room) => {
  console.log("New room:", room.roomId);
  console.log("Room name:", room.name);
  console.log("Is DM:", room.isDirect());
});
```

### 删除房间事件

```typescript
client.on(ClientEvent.DeleteRoom, (roomId) => {
  console.log("Room deleted:", roomId);
});
```

### 会话事件

```typescript
client.on(ClientEvent.Session, (sessionData) => {
  if (sessionData === "soft_logout") {
    // 软登出 - 令牌过期
    console.log("Soft logout detected");
  } else if (sessionData === "logout") {
    // 硬登出
    console.log("Logged out");
  }
});
```

## 房间事件

### 监听房间时间线

```typescript
import { RoomEvent } from "matrix-js-sdk";

client.on(RoomEvent.Timeline, (event, room, toStartOfTimeline) => {
  // toStartOfTimeline 为 true 表示这是历史消息
  if (toStartOfTimeline) {
    return;
  }

  console.log(`New event in ${room.name}:`);
  console.log(`  Type: ${event.getType()}`);
  console.log(`  Sender: ${event.getSender()}`);
  console.log(`  Content:`, event.getContent());
});
```

### 房间名称变化

```typescript
client.on(RoomEvent.Name, (room) => {
  console.log(`Room ${room.roomId} renamed to: ${room.name}`);
});
```

### 房间主题变化

```typescript
client.on(RoomEvent.Topic, (room) => {
  console.log(`Room ${room.roomId} topic changed to: ${room.topic}`);
});
```

### 成员状态变化

```typescript
client.on(RoomEvent.MyMembership, (room, membership, prevMembership) => {
  console.log(`Membership in ${room.roomId} changed: ${prevMembership} -> ${membership}`);

  if (membership === "invite") {
    console.log("You've been invited!");
  } else if (membership === "join") {
    console.log("You joined the room!");
  } else if (membership === "leave") {
    console.log("You left the room!");
  }
});
```

### 成员加入/离开

```typescript
client.on(RoomEvent.Member, (event, member) => {
  console.log(`Member ${member.name} ${member.membership} ${member.roomId}`);

  switch (member.membership) {
    case "join":
      console.log(`${member.name} joined`);
      break;

    case "leave":
      console.log(`${member.name} left`);
      break;

    case "invite":
      console.log(`${member.name} was invited`);
      break;

    case "ban":
      console.log(`${member.name} was banned`);
      break;

    case "knock":
      console.log(`${member.name} requested to join`);
      break;
  }
});
```

### 输入状态

```typescript
client.on(RoomEvent.Typing, (event, room) => {
  const content = event.getContent();
  const typingUsers = content.user_ids;

  console.log("Typing users:", typingUsers);
});
```

### 已读回执

```typescript
client.on(RoomEvent.NewReadReceipt, (event, room) => {
  console.log(`New read receipt in ${room.name}`);

  // 获取已读状态
  const receipts = room.getReceiptsForEvent(event);
  receipts.forEach(receipt => {
    console.log(`Read by ${receipt.userId}`);
  });
});
```

### 事件删除

```typescript
client.on(RoomEvent.Redaction, (event, room) => {
  const redactedEventId = event.redacts;
  const reason = event.getContent().reason;

  console.log(`Event ${redactedEventId} was redacted`);
  if (reason) {
    console.log(`Reason: ${reason}`);
  }
});
```

## 成员事件

### 成员名称变化

```typescript
import { RoomMemberEvent } from "matrix-js-sdk";

client.on(RoomMemberEvent.Name, (event, member) => {
  console.log(`Member ${member.userId} changed name to: ${member.name}`);
});
```

### 成员头像变化

```typescript
client.on(RoomMemberEvent.Avatar, (event, member) => {
  console.log(`Member ${member.userId} changed avatar`);
  console.log(`New avatar URL: ${member.getAvatarUrl(client.getBaseUrl())}`);
});
```

### 成员在线状态变化

```typescript
client.on(RoomMemberEvent.Presence, (event, member) => {
  console.log(`Member ${member.name} presence: ${member.presence}`);
  console.log(`Status: ${member.presenceStatusMsg}`);

  // presence 可能的值：
  // - online: 在线
  // - offline: 离线
  // - unavailable: 暂时离开
  // - undefined: 未知
});
```

### 成员输入状态

```typescript
client.on(RoomMemberEvent.Typing, (event, member) => {
  if (member.typing) {
    console.log(`${member.name} is typing...`);
  } else {
    console.log(`${member.name} stopped typing`);
  }
});
```

### 成员权限等级变化

```typescript
client.on(RoomMemberEvent.PowerLevel, (event, member) => {
  console.log(`Member ${member.name} power level changed to: ${member.powerLevel}`);

  // 权限等级通常为：
  // - 0: 普通用户
  // - 50: 版主
  // - 100: 管理员
});
```

## 加密事件

### 密钥验证请求

```typescript
import { CryptoEvent, KeyVerificationEvent } from "matrix-js-sdk";

const crypto = client.getCrypto();
if (crypto) {
  crypto.on(CryptoEvent.KeyVerificationRequest, (request) => {
    console.log("Received key verification request from:", request.requestingDevice.userId);

    // 自动接受（或让用户选择）
    request.accept();
  });
}
```

### 密钥验证状态变化

```typescript
crypto.on(CryptoEvent.KeyVerificationChanged, (request) => {
  console.log("Verification status:", request.state);

  switch (request.state) {
    case sdk.VerificationRequestState.Pending:
      console.log("Verification pending");
      break;

    case sdk.VerificationRequestState.Started:
      console.log("Verification started");
      break;

    case sdk.VerificationRequestState.Cancelled:
      console.log("Verification cancelled");
      break;

    case sdk.VerificationRequestState.Done:
      console.log("Verification completed!");
      break;
  }
});
```

### 信任状态变化

```typescript
crypto.on(CryptoEvent.UserTrustStatusChanged, (userId, trustLevel) => {
  console.log(`User ${userId} trust level: ${trustLevel}`);

  // trustLevel 可能的值：
  // - "trusted": 已信任
  // - "untrusted": 未信任
  // - "unknown": 未知
});
```

### 设备信任变化

```typescript
crypto.on(CryptoEvent.DeviceVerificationChanged, (userId, deviceInfo, trustLevel) => {
  console.log(`Device ${deviceInfo.deviceId} of ${userId} trust level: ${trustLevel}`);

  // trustLevel 可能的值：
  // - "verified": 已验证
  // - "unverified": 未验证
  // - "blocked": 已阻止
});
```

## 通话事件

### 接收通话邀请

```typescript
import { CallEvent } from "matrix-js-sdk";

client.on(CallEvent.Invite, (call) => {
  console.log(`Incoming call from ${call.getOpponentMember().name}`);
  console.log("Call type:", call.type === "voice" ? "Voice" : "Video");

  // 自动接听（或让用户选择）
  // call.answer();
});
```

### 通话状态变化

```typescript
client.on(CallEvent.State, (call) => {
  console.log("Call state:", call.state);

  switch (call.state) {
    case "fledgling":
      console.log("Call initializing");
      break;

    case "invite_sent":
      console.log("Invite sent");
      break;

    case "ringing":
      console.log("Ringing...");
      break;

    case "connected":
      console.log("Call connected!");
      break;

    case "ended":
      console.log("Call ended");
      break;
  }
});
```

### 通话挂断

```typescript
client.on(CallEvent.Hangup, (call) => {
  console.log("Call hangup by:", call.getHangupParty());
  console.log("Reason:", call.getHangupReason());
});
```

### 通话错误

```typescript
client.on(CallEvent.Error, (call, error) => {
  console.error("Call error:", error);
});
```

## 自定义事件处理

### 事件过滤器

```typescript
// 只处理特定类型的事件
client.on(RoomEvent.Timeline, (event, room) => {
  // 只处理消息事件
  if (event.getType() !== "m.room.message") {
    return;
  }

  // 只处理文本消息
  const content = event.getContent();
  if (content.msgtype !== "m.text") {
    return;
  }

  // 只处理特定用户的消息
  if (event.getSender() === client.getUserId()) {
    return;  // 忽略自己的消息
  }

  // 处理消息
  console.log("Message:", content.body);
});
```

### 多条件过滤

```typescript
// 复杂的事件过滤
client.on(RoomEvent.Timeline, (event, room) => {
  // 检查多个条件
  if (
    event.getType() === "m.room.message" &&
    event.getContent().msgtype === "m.text" &&
    event.getSender() !== client.getUserId() &&
    !event.isRedacted() &&
    room.isDirect() === false
  ) {
    // 处理符合条件的消息
    handlePublicRoomMessage(event, room);
  }
});
```

### 房间特定的事件处理器

```typescript
class RoomEventHandler {
  private handlers: Map<string, (event: sdk.MatrixEvent) => void> = new Map();

  onRoomMessage(roomId: string, callback: (event: sdk.MatrixEvent) => void) {
    this.handlers.set(roomId, callback);
  }

  processEvent(event: sdk.MatrixEvent, room: sdk.Room) {
    const handler = this.handlers.get(room.roomId);
    if (handler) {
      handler(event);
    }
  }
}

// 使用
const roomHandler = new RoomEventHandler();

roomHandler.onRoomMessage("!room1:server.com", (event) => {
  console.log("Room 1 message:", event.getContent().body);
});

roomHandler.onRoomMessage("!room2:server.com", (event) => {
  console.log("Room 2 message:", event.getContent().body);
});

client.on(RoomEvent.Timeline, (event, room) => {
  roomHandler.processEvent(event, room);
});
```

## 事件过滤器

### 客户端过滤器

```typescript
// 创建同步过滤器
const filter = {
  event_fields: ["type", "content", "sender", "event_id"],
  event_format: "client",
  account_data: {
    limit: 10,
    types: ["m.direct"]
  },
  room: {
    rooms: ["!roomId:server.com"],
    timeline: {
      limit: 20,
      types: ["m.room.message"]
    },
    state: {
      limit: 10
    },
    ephemeral: {
      limit: 10,
      types: ["m.typing", "m.receipt"]
    }
  },
  presence: {
    limit: 20,
    types: ["m.presence"]
  }
};

// 应用过滤器启动客户端
await client.startClient({
  filter: JSON.stringify(filter)
});
```

### 动态更新过滤器

```typescript
// 创建并上传过滤器
const filterId = await client.createFilter({
  room: {
    timeline: {
      limit: 50,
      types: ["m.room.message"]
    }
  }
});

// 使用过滤器 ID
await client.startClient({
  filter: filterId
});
```

## 完整示例

### 统一事件处理器

```typescript
import * as sdk from "matrix-js-sdk";
import {
  ClientEvent,
  RoomEvent,
  RoomMemberEvent,
  CallEvent,
  CryptoEvent
} from "matrix-js-sdk";

class MatrixEventHandler {
  constructor(private client: sdk.MatrixClient) {
    this.setupClientEvents();
    this.setupRoomEvents();
    this.setupMemberEvents();
    this.setupCallEvents();
    this.setupCryptoEvents();
  }

  // 客户端事件
  private setupClientEvents() {
    // 同步状态
    this.client.on(ClientEvent.Sync, (state, prevState) => {
      console.log(`Sync: ${prevState} -> ${state}`);

      if (state === "PREPARED") {
        console.log("Client ready!");
      } else if (state === "ERROR") {
        console.error("Sync error");
      }
    });

    // 新房间
    this.client.on(ClientEvent.NewRoom, (room) => {
      console.log(`New room: ${room.name} (${room.roomId})`);
    });

    // 会话变化
    this.client.on(ClientEvent.Session, (sessionData) => {
      if (sessionData === "soft_logout") {
        console.log("Token expired, need to refresh");
      }
    });
  }

  // 房间事件
  private setupRoomEvents() {
    // 时间线事件
    this.client.on(RoomEvent.Timeline, (event, room, toStartOfTimeline) => {
      if (toStartOfTimeline) return;

      const type = event.getType();
      const sender = event.getSender();

      console.log(`[${room.name}] ${sender}: ${type}`);

      if (type === "m.room.message") {
        this.handleMessage(event, room);
      }
    });

    // 成员状态变化
    this.client.on(RoomEvent.MyMembership, (room, membership) => {
      console.log(`My membership in ${room.name}: ${membership}`);

      if (membership === "invite") {
        this.handleInvite(room);
      }
    });

    // 输入状态
    this.client.on(RoomEvent.Typing, (event, room) => {
      const content = event.getContent();
      const typingUsers = content.user_ids.filter(
        userId => userId !== this.client.getUserId()
      );

      if (typingUsers.length > 0) {
        console.log(`${room.name}: ${typingUsers.join(", ")} typing...`);
      }
    });
  }

  // 成员事件
  private setupMemberEvents() {
    // 名称变化
    this.client.on(RoomMemberEvent.Name, (event, member) => {
      console.log(`${member.name} changed display name`);
    });

    // 在线状态
    this.client.on(RoomMemberEvent.Presence, (event, member) => {
      console.log(`${member.name} is ${member.presence}`);
    });
  }

  // 通话事件
  private setupCallEvents() {
    this.client.on(CallEvent.Invite, (call) => {
      const opponent = call.getOpponentMember();
      console.log(`Incoming call from ${opponent.name}`);

      // 自动拒绝（可以改为提示用户）
      call.hangup();
    });
  }

  // 加密事件
  private setupCryptoEvents() {
    const crypto = this.client.getCrypto();
    if (!crypto) return;

    crypto.on(CryptoEvent.KeyVerificationRequest, (request) => {
      console.log(`Verification request from ${request.requestingDevice.userId}`);
      request.reject();
    });
  }

  // 消息处理
  private handleMessage(event: sdk.MatrixEvent, room: sdk.Room) {
    const content = event.getContent();
    const sender = event.getSender();

    if (sender === this.client.getUserId()) {
      // 自己的消息
      console.log(`[Me] ${content.body}`);
    } else {
      // 他人的消息
      const member = room.getMember(sender);
      const displayName = member?.displayName || sender;
      console.log(`[${displayName}] ${content.body}`);
    }
  }

  // 处理邀请
  private async handleInvite(room: sdk.Room) {
    console.log(`Invited to ${room.name}`);

    // 可以自动接受或提示用户
    try {
      await this.client.joinRoom(room.roomId);
      console.log(`Joined ${room.name}`);
    } catch (error) {
      console.error("Failed to join:", error);
    }
  }
}

// 使用示例
async function main() {
  const client = sdk.createClient({
    baseUrl: "https://matrix.org",
    accessToken: "token",
    userId: "@user:matrix.org"
  });

  const handler = new MatrixEventHandler(client);

  await client.startClient();
}

main();
```

### 事件路由器

```typescript
class EventRouter {
  private routes: Map<string, (event: sdk.MatrixEvent) => void> = new Map();

  on(eventType: string, handler: (event: sdk.MatrixEvent) => void) {
    this.routes.set(eventType, handler);
  }

  route(event: sdk.MatrixEvent) {
    const type = event.getType();
    const handler = this.routes.get(type);

    if (handler) {
      handler(event);
    }
  }
}

// 使用
const router = new EventRouter();

router.on("m.room.message", (event) => {
  console.log("Message:", event.getContent().body);
});

router.on("m.room.member", (event) => {
  console.log("Member event");
});

client.on(RoomEvent.Timeline, (event) => {
  router.route(event);
});
```
