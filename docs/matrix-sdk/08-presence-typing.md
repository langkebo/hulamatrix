# 08. 在线状态和输入提示

> Matrix JS SDK 在线状态 (Presence) 和输入提示 (Typing Indicators)

## 目录
- [在线状态](#在线状态)
- [输入提示](#输入提示)
- [已读回执](#已读回执)
- [完整示例](#完整示例)

## 在线状态

### 设置自己的在线状态

```typescript
import * as sdk from "matrix-js-sdk";

// 设置在线状态
await client.setPresence("online", "Available");

// 设置离开状态
await client.setPresence("unavailable", "Away from keyboard");

// 设置离线状态
await client.setPresence("offline", "Not available");

// 设置自定义状态
await client.setPresence("online", "Working on Matrix SDK");
```

### 在线状态类型

```typescript
// 可能的在线状态值:
// - "online": 在线
// - "unavailable": 暂时离开
// - "offline": 离线

// 设置在线
await client.setPresence("online");

// 设置暂时离开
await client.setPresence("unavailable", "In a meeting");

// 设置离线
await client.setPresence("offline");
```

### 获取用户的在线状态

```typescript
// 获取特定用户的在线状态
const userId = "@user:server.com";
const user = client.getUser(userId);

if (user) {
  console.log("Presence:", user.presence);
  console.log("Status message:", user.presenceStatusMsg);
  console.log("Last active:", user.lastActiveAgo);
}
```

### 监听在线状态变化

```typescript
import { ClientEvent } from "matrix-js-sdk";

// 监听任何用户的在线状态变化
client.on(ClientEvent.Presence, (event) => {
  const content = event.getContent();
  const userId = event.getSender();

  console.log(`User ${userId} presence: ${content.presence}`);
  console.log(`Status: ${content.status_msg || "No status"}`);

  // last_active_ago 是毫秒数
  if (content.last_active_ago !== undefined) {
    const lastActive = new Date(Date.now() - content.last_active_ago);
    console.log(`Last active: ${lastActive.toLocaleString()}`);
  }
});
```

### 批量获取用户状态

```typescript
// 获取多个用户的在线状态
const userIds = [
  "@user1:server.com",
  "@user2:server.com",
  "@user3:server.com"
];

userIds.forEach(userId => {
  const user = client.getUser(userId);
  if (user) {
    console.log(`${userId}: ${user.presence}`);
  }
});
```

### 按在线状态过滤用户

```typescript
// 获取所有在线用户
const room = client.getRoom("!roomId:server.com");
if (room) {
  const members = room.getJoinedMembers();

  const onlineMembers = members.filter(member => {
    const user = client.getUser(member.userId);
    return user?.presence === "online";
  });

  console.log("Online members:", onlineMembers.map(m => m.name));
}
```

### 持续更新在线状态

```typescript
// 定期更新在线状态以保持活跃
class PresenceManager {
  private intervalId: NodeJS.Timeout | null = null;

  constructor(private client: sdk.MatrixClient) {}

  // 开始持续更新
  start(intervalMs: number = 60000) {
    this.intervalId = setInterval(async () => {
      await this.client.setPresence("online");
      console.log("Presence updated");
    }, intervalMs);
  }

  // 停止更新
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  // 设置特定状态
  async setPresence(presence: "online" | "unavailable" | "offline", statusMsg?: string) {
    await this.client.setPresence(presence, statusMsg);
  }
}

// 使用
const presenceManager = new PresenceManager(client);
presenceManager.start(60000);  // 每 60 秒更新一次

// 设置为离开
await presenceManager.setPresence("unavailable", "In a meeting");

// 恢复在线
await presenceManager.setPresence("online", "Back to work");
```

### 在线状态统计

```typescript
// 统计房间中的在线状态
function getPresenceStats(client: sdk.MatrixClient, roomId: string) {
  const room = client.getRoom(roomId);
  if (!room) return null;

  const members = room.getJoinedMembers();
  const stats = {
    online: 0,
    unavailable: 0,
    offline: 0,
    unknown: 0,
    total: members.length
  };

  members.forEach(member => {
    const user = client.getUser(member.userId);
    if (!user) {
      stats.unknown++;
      return;
    }

    switch (user.presence) {
      case "online":
        stats.online++;
        break;
      case "unavailable":
        stats.unavailable++;
        break;
      case "offline":
        stats.offline++;
        break;
      default:
        stats.unknown++;
    }
  });

  return stats;
}

// 使用
const stats = getPresenceStats(client, "!roomId:server.com");
console.log("Presence stats:", stats);
// {
//   online: 15,
//   unavailable: 5,
//   offline: 10,
//   unknown: 2,
//   total: 32
// }
```

## 输入提示

### 发送输入提示

```typescript
// 开始输入时发送提示
const roomId = "!roomId:server.com";

// 发送输入提示（默认 4.5 秒超时）
await client.sendTypingNotice(roomId, true);

// 停止输入提示
await client.sendTypingNotice(roomId, false);
```

### 发送带超时的输入提示

```typescript
// 发送输入提示并指定超时时间（毫秒）
const roomId = "!roomId:server.com";
const timeout = 10000;  // 10 秒

await client.sendTypingNotice(roomId, true, timeout);

console.log("Typing notice sent (will expire in 10s)");
```

### 自动管理输入提示

```typescript
// 输入框自动发送输入提示
class TypingNotifier {
  private timeoutId: NodeJS.Timeout | null = null;
  private typingNoticeSent = false;

  constructor(
    private client: sdk.MatrixClient,
    private roomId: string
  ) {}

  // 用户开始输入
  onUserTyping() {
    // 清除之前的定时器
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    // 如果还没发送输入提示，立即发送
    if (!this.typingNoticeSent) {
      this.client.sendTypingNotice(this.roomId, true, 10000);
      this.typingNoticeSent = true;
    }

    // 设置 10 秒后停止
    this.timeoutId = setTimeout(() => {
      this.stopTyping();
    }, 10000);
  }

  // 用户停止输入
  onUserStoppedTyping() {
    this.stopTyping();
  }

  // 停止输入提示
  private stopTyping() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    if (this.typingNoticeSent) {
      this.client.sendTypingNotice(this.roomId, false);
      this.typingNoticeSent = false;
    }
  }

  // 发送消息时自动停止输入提示
  async sendMessage(content: any) {
    this.stopTyping();
    return await this.client.sendMessage(this.roomId, content);
  }
}

// 在输入框中使用
const inputElement = document.getElementById("messageInput") as HTMLInputElement;
const typingNotifier = new TypingNotifier(client, "!roomId:server.com");

let debounceTimer: NodeJS.Timeout;

inputElement.addEventListener("input", () => {
  clearTimeout(debounceTimer);

  debounceTimer = setTimeout(() => {
    typingNotifier.onUserTyping();
  }, 300);  // 防抖 300ms
});

inputElement.addEventListener("blur", () => {
  typingNotifier.onUserStoppedTyping();
});
```

### 监听其他用户的输入状态

```typescript
import { RoomEvent } from "matrix-js-sdk";

// 监听房间中的输入状态
client.on(RoomEvent.Typing, (event, room) => {
  const content = event.getContent();
  const typingUsers = content.user_ids;

  // 过滤掉自己
  const otherTypingUsers = typingUsers.filter(
    userId => userId !== client.getUserId()
  );

  if (otherTypingUsers.length > 0) {
    console.log(`Typing in ${room.name}:`);

    otherTypingUsers.forEach(userId => {
      const member = room.getMember(userId);
      const name = member?.displayName || userId;
      console.log(`  - ${name} is typing...`);
    });
  }
});
```

### 显示输入状态 UI

```typescript
// 输入状态 UI 管理器
class TypingIndicatorUI {
  private typingUsers: Set<string> = new Set();
  private element: HTMLElement;

  constructor(roomId: string, client: sdk.MatrixClient) {
    // 创建 UI 元素
    this.element = document.createElement("div");
    this.element.className = "typing-indicator";
    document.body.appendChild(this.element);

    // 监听输入事件
    client.on(RoomEvent.Typing, (event, room) => {
      if (room.roomId === roomId) {
        this.updateTypingUsers(event.getContent().user_ids, client);
      }
    });
  }

  private updateTypingUsers(userIds: string[], client: sdk.MatrixClient) {
    // 过滤掉自己
    const otherUsers = userIds.filter(
      userId => userId !== client.getUserId()
    );

    // 更新集合
    this.typingUsers = new Set(otherUsers);

    // 更新 UI
    this.updateUI();
  }

  private updateUI() {
    if (this.typingUsers.size === 0) {
      this.element.style.display = "none";
    } else {
      this.element.style.display = "block";

      const names = Array.from(this.typingUsers).map(userId => {
        const member = client.getRoom("!roomId:server.com")?.getMember(userId);
        return member?.displayName || userId;
      });

      if (names.length === 1) {
        this.element.textContent = `${names[0]} is typing...`;
      } else if (names.length === 2) {
        this.element.textContent = `${names[0]} and ${names[1]} are typing...`;
      } else {
        this.element.textContent = `${names.length} people are typing...`;
      }
    }
  }
}
```

## 已读回执

### 发送已读回执

```typescript
// 标记消息为已读
const roomId = "!roomId:server.com";
const eventId = "$event_id";

await client.sendReadReceipt(roomId, eventId);

console.log("Read receipt sent");
```

### 发送已读回执（公开方式）

```typescript
// 发送已读回执（其他用户可以看到）
await client.sendReadReceipt(roomId, eventId, "m.read");

// 发送私有的已读回执（只有自己能看到）
await client.sendReadReceipt(roomId, eventId, "m.read.private");
```

### 标记整个房间为已读

```typescript
// 标记房间所有消息为已读
const room = client.getRoom(roomId);
if (room) {
  const latestEvent = room.timeline[room.timeline.length - 1];

  if (latestEvent) {
    await client.sendReadReceipt(roomId, latestEvent.getId());
    console.log("All messages marked as read");
  }
}
```

### 获取消息的已读状态

```typescript
// 获取特定消息的已读回执
const room = client.getRoom(roomId);
if (room) {
  const event = room.findEventById("$event_id");

  if (event) {
    const receipts = room.getReceiptsForEvent(event);

    console.log("Read by:");
    receipts.forEach(receipt => {
      const member = room.getMember(receipt.userId);
      const name = member?.displayName || receipt.userId;
      console.log(`  - ${name} at ${new Date(receipt.data.ts).toLocaleString()}`);
    });
  }
}
```

### 监听已读回执

```typescript
// 监听新的已读回执
client.on(RoomEvent.NewReadReceipt, (event, room) => {
  const receipt = event.getContent();
  const userId = event.getSender();

  console.log(`${userId} read message ${receipt.event_id}`);

  // 获取用户信息
  const member = room.getMember(userId);
  if (member) {
    console.log(`User: ${member.displayName}`);
  }

  // 获取被读取的消息
  const readEvent = room.findEventById(receipt.event_id);
  if (readEvent) {
    console.log(`Message: ${readEvent.getContent().body}`);
  }
});
```

### 获取房间未读计数

```typescript
// 获取房间未读消息数
const room = client.getRoom(roomId);
if (room) {
  // 未读通知数量（高亮消息）
  const notificationCount = room.getUnreadNotificationCount();
  console.log("Notification count:", notificationCount);

  // 未读高亮数量（@mentions 等）
  const highlightCount = room.getUnreadHighlightCount();
  console.log("Highlight count:", highlightCount);
}
```

### 获取全局未读计数

```typescript
// 获取所有房间的未读计数
function getGlobalUnreadCounts(client: sdk.MatrixClient) {
  const rooms = client.getRooms();

  let totalNotifications = 0;
  let totalHighlights = 0;

  const roomCounts = rooms.map(room => ({
    roomId: room.roomId,
    name: room.name,
    notifications: room.getUnreadNotificationCount(),
    highlights: room.getUnreadHighlightCount()
  }));

  roomCounts.forEach(count => {
    totalNotifications += count.notifications;
    totalHighlights += count.highlights;
  });

  return {
    totalNotifications,
    totalHighlights,
    rooms: roomCounts
  };
}

// 使用
const unread = getGlobalUnreadCounts(client);
console.log("Total notifications:", unread.totalNotifications);
console.log("Total highlights:", unread.totalHighlights);
```

## 完整示例

### 完整的在线状态和输入提示管理器

```typescript
import * as sdk from "matrix-js-sdk";
import { RoomEvent, ClientEvent } from "matrix-js-sdk";

interface TypingInfo {
  userId: string;
  displayName: string;
  since: Date;
}

interface PresenceInfo {
  userId: string;
  displayName: string;
  presence: "online" | "unavailable" | "offline";
  statusMsg?: string;
  lastActive?: Date;
}

class PresenceTypingManager {
  private typingInfo: Map<string, TypingInfo> = new Map();
  private presenceCache: Map<string, PresenceInfo> = new Map();
  private typingTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(private client: sdk.MatrixClient) {
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    // 监听在线状态变化
    this.client.on(ClientEvent.Presence, (event) => {
      this.handlePresenceUpdate(event);
    });

    // 监听输入状态（所有房间）
    this.client.on(RoomEvent.Typing, (event, room) => {
      this.handleTypingUpdate(event, room);
    });
  }

  // 处理在线状态更新
  private handlePresenceUpdate(event: sdk.MatrixEvent) {
    const content = event.getContent();
    const userId = event.getSender();

    if (!userId) return;

    const member = this.getAnyRoomMember(userId);
    const displayName = member?.displayName || userId;

    const presenceInfo: PresenceInfo = {
      userId,
      displayName,
      presence: content.presence,
      statusMsg: content.status_msg,
      lastActive: content.last_active_ago
        ? new Date(Date.now() - content.last_active_ago)
        : undefined
    };

    this.presenceCache.set(userId, presenceInfo);

    console.log(`Presence update: ${displayName} is ${content.presence}`);

    // 触发自定义事件
    this.onPresenceUpdate?.(presenceInfo);
  }

  // 处理输入状态更新
  private handleTypingUpdate(event: sdk.MatrixEvent, room: sdk.Room) {
    const content = event.getContent();
    const typingUsers = content.user_ids;
    const myUserId = this.client.getUserId();

    if (!myUserId) return;

    // 清除之前的输入状态
    typingUsers.forEach(userId => {
      if (userId !== myUserId) {
        const timer = this.typingTimers.get(userId);
        if (timer) {
          clearTimeout(timer);
        }
      }
    });

    // 更新输入状态
    const newTypingUsers = typingUsers
      .filter(userId => userId !== myUserId)
      .map(userId => {
        const member = room.getMember(userId);
        return {
          userId,
          displayName: member?.displayName || userId,
          since: new Date()
        };
      });

    // 设置 10 秒后自动清除
    newTypingUsers.forEach(info => {
      const timer = setTimeout(() => {
        this.typingInfo.delete(info.userId);
        this.onTypingUpdate?.(Array.from(this.typingInfo.values()), room);
      }, 10000);

      this.typingTimers.set(info.userId, timer);
      this.typingInfo.set(info.userId, info);
    });

    // 移除不再输入的用户
    const newTypingSet = new Set(newTypingUsers.map(u => u.userId));
    for (const [userId] of this.typingInfo) {
      if (!newTypingSet.has(userId)) {
        this.typingInfo.delete(userId);
      }
    }

    // 触发回调
    this.onTypingUpdate?.(Array.from(this.typingInfo.values()), room);
  }

  // 获取任意房间的成员信息
  private getAnyRoomMember(userId: string): sdk.RoomMember | null {
    const rooms = this.client.getRooms();

    for (const room of rooms) {
      const member = room.getMember(userId);
      if (member) {
        return member;
      }
    }

    return null;
  }

  // 设置自己的在线状态
  async setPresence(
    presence: "online" | "unavailable" | "offline",
    statusMsg?: string
  ) {
    await this.client.setPresence(presence, statusMsg);
  }

  // 发送输入提示
  async sendTypingNotice(roomId: string, isTyping: boolean, timeout?: number) {
    await this.client.sendTypingNotice(roomId, isTyping, timeout);
  }

  // 发送已读回执
  async sendReadReceipt(roomId: string, eventId: string) {
    await this.client.sendReadReceipt(roomId, eventId);
  }

  // 获取用户在线状态
  getUserPresence(userId: string): PresenceInfo | undefined {
    return this.presenceCache.get(userId);
  }

  // 获取房间未读计数
  getRoomUnreadCount(roomId: string): { notifications: number; highlights: number } {
    const room = this.client.getRoom(roomId);
    if (!room) {
      return { notifications: 0, highlights: 0 };
    }

    return {
      notifications: room.getUnreadNotificationCount(),
      highlights: room.getUnreadHighlightCount()
    };
  }

  // 获取全局未读计数
  getGlobalUnreadCount(): { notifications: number; highlights: number } {
    const rooms = this.client.getRooms();
    let notifications = 0;
    let highlights = 0;

    rooms.forEach(room => {
      notifications += room.getUnreadNotificationCount();
      highlights += room.getUnreadHighlightCount();
    });

    return { notifications, highlights };
  }

  // 回调函数
  onPresenceUpdate?: (info: PresenceInfo) => void;
  onTypingUpdate?: (typingUsers: TypingInfo[], room: sdk.Room) => void;
}

// 使用示例
async function example() {
  const client = sdk.createClient({
    baseUrl: "https://matrix.org",
    accessToken: "token",
    userId: "@user:matrix.org"
  });

  await client.startClient();

  const manager = new PresenceTypingManager(client);

  // 监听在线状态更新
  manager.onPresenceUpdate = (info) => {
    console.log(`${info.displayName} is ${info.presence}`);
    if (info.statusMsg) {
      console.log(`  Status: ${info.statusMsg}`);
    }
  };

  // 监听输入状态更新
  manager.onTypingUpdate = (typingUsers, room) => {
    if (typingUsers.length > 0) {
      const names = typingUsers.map(u => u.displayName).join(", ");
      console.log(`${room.name}: ${names} typing...`);
    }
  };

  // 设置自己的状态
  await manager.setPresence("online", "Available");

  // 发送输入提示
  await manager.sendTypingNotice("!roomId:server.com", true, 10000);

  // 获取未读计数
  const unread = manager.getGlobalUnreadCount();
  console.log("Unread:", unread);
}

example();
```

### UI 集成示例

```typescript
// 在线状态和输入提示 UI 组件
class ChatStatusBar {
  private presenceManager: PresenceTypingManager;

  constructor(
    client: sdk.MatrixClient,
    private roomId: string
  ) {
    this.presenceManager = new PresenceTypingManager(client);
    this.setupUI();
  }

  private setupUI() {
    // 监听输入状态
    this.presenceManager.onTypingUpdate = (typingUsers) => {
      this.updateTypingIndicator(typingUsers);
    };

    // 监听在线状态（可选）
    this.presenceManager.onPresenceUpdate = (info) => {
      this.updatePresenceIndicator(info);
    };
  }

  private updateTypingIndicator(typingUsers: TypingInfo[]) {
    const indicator = document.getElementById("typingIndicator");
    if (!indicator) return;

    if (typingUsers.length === 0) {
      indicator.style.display = "none";
    } else {
      indicator.style.display = "block";

      const names = typingUsers.map(u => u.displayName).join(", ");
      indicator.textContent = `${names} typing...`;
    }
  }

  private updatePresenceIndicator(info: PresenceInfo) {
    // 可以更新用户列表中的在线状态显示
    const userElement = document.querySelector(`[data-user-id="${info.userId}"]`);
    if (userElement) {
      const statusElement = userElement.querySelector(".presence-status");
      if (statusElement) {
        statusElement.className = `presence-status ${info.presence}`;
        statusElement.title = info.statusMsg || info.presence;
      }
    }
  }

  // 用户输入时调用
  onUserInput() {
    this.presenceManager.sendTypingNotice(this.roomId, true, 10000);
  }

  // 发送消息时调用
  async sendMessage(content: any) {
    await this.presenceManager.sendTypingNotice(this.roomId, false);
    return await this.client.sendMessage(this.roomId, content);
  }

  // 标记消息为已读
  async markAsRead(eventId: string) {
    await this.presenceManager.sendReadReceipt(this.roomId, eventId);
  }
}
```
