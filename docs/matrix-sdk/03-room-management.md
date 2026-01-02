# 03. 房间管理

> Matrix JS SDK 房间创建、加入、管理等功能

## 实现验证状态

> **验证日期**: 2025-12-30
> **验证报告**: [03-room-management-VERIFICATION.md](./03-room-management-VERIFICATION.md)
> **总体完成度**: 95% ✅
>
> ### 功能状态
> - ✅ 创建房间: 已完整实现
> - ✅ 加入房间: 已完整实现 (joinRoom with reason, joinMultipleRooms)
> - ✅ 离开房间: 已完整实现 (leaveRoom with reason, leaveAllRooms)
> - ✅ 房间成员管理: 已完整实现
> - ✅ 房间状态管理: 已完整实现
> - ⚠️ 房间权限: 已完整实现 (UI 待完善)
> - ✅ 房间标签: 已完整实现
>
> ### 主要发现
> 1. **已实现**: 所有核心房间管理功能完整
> 2. **新增功能**: joinRoom (with reason), joinMultipleRooms, leaveRoom (with reason), leaveAllRooms
> 3. **状态**: 核心功能完整，仅第三方签名加入和部分 UI 待实现

## 目录
- [创建房间](#创建房间)
- [加入房间](#加入房间)
- [离开房间](#离开房间)
- [房间成员管理](#房间成员管理)
- [房间状态管理](#房间状态管理)
- [房间权限](#房间权限)
- [房间标签](#房间标签)
- [完整示例](#完整示例)

## 创建房间

### 基本房间创建

```typescript
import * as sdk from "matrix-js-sdk";

// 创建最简单的房间
const roomResponse = await client.createRoom({
  preset: "private_chat"  // 私有聊天预设
});

console.log("Room ID:", roomResponse.room_id);
```

### 创建公开房间

```typescript
const roomResponse = await client.createRoom({
  name: "My Public Room",
  topic: "A public room for discussion",
  preset: "public_chat",  // 公开聊天预设
  visibility: "public"    // 可见性：公开
});

console.log("Created public room:", roomResponse.room_id);
```

### 创建私有房间

```typescript
const roomResponse = await client.createRoom({
  name: "Private Discussion",
  topic: "Private room",
  preset: "private_chat",  // 私有聊天预设
  visibility: "private",   // 可见性：私有
  invite: ["@user1:server.com", "@user2:server.com"]  // 邀请用户
});

console.log("Created private room:", roomResponse.room_id);
```

### 创建带密码保护的房间

```typescript
const roomResponse = await client.createRoom({
  name: "Password Protected Room",
  preset: "private_chat",
  join_rule: "knock",  // 需要申请加入
  guest_access: "can_join"  // 访客可以加入
});
```

### 高级房间创建选项

```typescript
const roomResponse = await client.createRoom({
  // 基本信息
  name: "Advanced Room",
  room_alias_name: "advanced-room",  // 房间别名
  topic: "A room with advanced settings",

  // 可见性和预设
  visibility: "public",
  preset: "public_chat",

  // 房间版本
  room_version: "10",  // 指定房间版本

  // 创建者选项
  creation_content: {
    "m.federate": true  // 允许联合
  },

  // 初始状态
  initial_state: [
    {
      type: "m.room.history_visibility",
      state_key: "",
      content: {
        history_visibility: "joined"  // 只有加入后才能看到历史
      }
    },
    {
      type: "m.room.guest_access",
      state_key: "",
      content: {
        guest_access: "forbidden"  // 禁止访客
      }
    }
  ],

  // 邀请用户
  invite: ["@user1:server.com", "@user2:server.com"],

  // 是否为直接聊天
  is_direct: false,

  // 邀请原因（显示给被邀请用户）
  invite_reason: "Please join this room for discussion"
});
```

### 创建直接聊天（DM）

```typescript
// 创建与其他用户的直接聊天
const dmResponse = await client.createRoom({
  is_direct: true,  // 标记为直接聊天
  preset: "trusted_private_chat",
  invite: ["@friend:server.com"]
});

console.log("Created DM:", dmResponse.room_id);
```

### 创建加密房间

```typescript
// 启用加密的房间（需要先初始化加密）
const roomResponse = await client.createRoom({
  name: "Encrypted Room",
  preset: "private_chat",
  initial_state: [
    {
      type: "m.room.encryption",
      state_key: "",
      content: {
        algorithm: "m.megolm.v1.aes-sha2"  // 加密算法
      }
    }
  ]
});

console.log("Created encrypted room:", roomResponse.room_id);
```

## 加入房间

### 使用房间 ID 加入

```typescript
// 通过房间 ID 加入
const room = await client.joinRoom("!roomId:server.com");
console.log("Joined room:", room.roomId);
```

### 使用房间别名加入

```typescript
// 通过房间别名加入
const room = await client.joinRoom("#room-alias:server.com");
console.log("Joined room:", room.roomId);
```

### 通过邀请加入

```typescript
// 处理房间邀请
client.on(sdk.RoomEvent.MyMembership, (room, membership, prevMembership) => {
  if (membership === "invite" && prevMembership === null) {
    console.log(`Received invite to ${room.name}`);

    // 自动接受邀请
    client.joinRoom(room.roomId).then(() => {
      console.log("Joined room");
    });
  }
});
```

### 带理由的加入

```typescript
// 加入房间时提供理由
const room = await client.joinRoom("!roomId:server.com", {
  reason: "I was invited by a friend"
});
```

### 使用第三方签名加入

```typescript
// 使用第三方签名加入（用于受限房间）
const room = await client.joinRoom("!roomId:server.com", {
  third_party_signed: {
    sender: "@sender:server.com",
    mxid: "@user:server.com",
    token: "signature_token",
    signatures: {
      "server.com": {
        "ed25519:key": "signature"
      }
    }
  }
});
```

### 批量加入房间

```typescript
// 加入多个房间
const roomIds = [
  "!room1:server.com",
  "!room2:server.com",
  "#room3:server.com"
];

const results = await Promise.allSettled(
  roomIds.map(roomId => client.joinRoom(roomId))
);

results.forEach((result, index) => {
  if (result.status === "fulfilled") {
    console.log(`Joined ${roomIds[index]}`);
  } else {
    console.error(`Failed to join ${roomIds[index]}:`, result.reason);
  }
});
```

## 离开房间

### 基本离开房间

```typescript
// 离开房间
await client.leave("!roomId:server.com");
console.log("Left room");
```

### 带理由的离开

```typescript
// 离开房间时提供理由
await client.leave("!roomId:server.com", {
  reason: "Leaving because I'm busy"
});
```

### 拒绝邀请

```typescript
// 拒绝房间邀请
client.on(sdk.RoomEvent.MyMembership, (room, membership) => {
  if (membership === "invite") {
    // 拒绝邀请
    client.leave(room.roomId).then(() => {
      console.log("Declined invite");
    });
  }
});
```

### 离开所有房间

```typescript
// 离开所有房间
const rooms = client.getRooms();
await Promise.all(
  rooms.map(room => client.leave(room.roomId))
);
console.log(`Left ${rooms.length} rooms`);
```

### 忘记房间

```typescript
// 忘记房间（清除本地历史）
await client.forget("!roomId:server.com");
console.log("Forgot room");
```

## 房间成员管理

### 邀请用户

```typescript
// 邀请用户到房间
await client.invite("!roomId:server.com", "@user:server.com");
console.log("Invited user");
```

### 邀请多个用户

```typescript
// 批量邀请用户
const userIds = [
  "@user1:server.com",
  "@user2:server.com",
  "@user3:server.com"
];

for (const userId of userIds) {
  try {
    await client.invite("!roomId:server.com", userId);
    console.log(`Invited ${userId}`);
  } catch (error) {
    console.error(`Failed to invite ${userId}:`, error);
  }
}
```

### 踢出用户

```typescript
// 踢出用户
await client.kick("!roomId:server.com", "@user:server.com", "Disruptive behavior");
console.log("Kicked user");
```

### 封禁用户

```typescript
// 封禁用户
await client.ban("!roomId:server.com", "@user:server.com", "Spamming");
console.log("Banned user");
```

### 解封用户

```typescript
// 解封用户
await client.unban("!roomId:server.com", "@user:server.com");
console.log("Unbanned user");
```

### 设置用户权限

```typescript
// 修改用户权限等级
const room = client.getRoom("!roomId:server.com");
if (room) {
  // 获取当前权限事件
  const powerLevels = room.currentState.getStateEvents("m.room.power_levels", "")?.getContent();

  // 修改用户权限
  powerLevels.users["@user:server.com"] = 50;  // 设置为版主

  // 发送更新
  await client.sendStateEvent(
    "!roomId:server.com",
    "m.room.power_levels",
    powerLevels,
    ""
  );
}
```

### 获取房间成员列表

```typescript
// 获取房间所有成员
const room = client.getRoom("!roomId:server.com");
if (room) {
  const members = room.getJoinedMembers();
  console.log(`Room has ${members.length} members:`);

  members.forEach(member => {
    console.log(`- ${member.name} (${member.userId})`);
  });
}
```

### 获取特定成员信息

```typescript
// 获取特定成员
const room = client.getRoom("!roomId:server.com");
if (room) {
  const member = room.getMember("@user:server.com");
  if (member) {
    console.log("Member:", member.name);
    console.log("Membership:", member.membership);
    console.log("Power level:", member.powerLevel);
    console.log("Display name:", member.displayName);
    console.log("Avatar:", member.getAvatarUrl(client.getBaseUrl()));
  }
}
```

### 监听成员变化

```typescript
// 监听成员加入
client.on(sdk.RoomEvent.Member, (event, member) => {
  if (member.membership === "join") {
    console.log(`${member.name} joined ${member.roomId}`);
  }
});

// 监听成员离开
client.on(sdk.RoomEvent.Member, (event, member) => {
  if (member.membership === "leave") {
    console.log(`${member.name} left ${member.roomId}`);
  }
});

// 监听成员封禁/解封
client.on(sdk.RoomEvent.Member, (event, member) => {
  if (member.membership === "ban") {
    console.log(`${member.name} was banned from ${member.roomId}`);
  } else if (member.membership === "leave" && event.getPrevContent()?.membership === "ban") {
    console.log(`${member.name} was unbanned in ${member.roomId}`);
  }
});
```

## 房间状态管理

### 修改房间名称

```typescript
// 设置房间名称
await client.setRoomName("!roomId:server.com", "New Room Name");
```

### 修改房间主题

```typescript
// 设置房间主题
await client.setRoomTopic("!roomId:server.com", "New topic description");
```

### 设置房间头像

```typescript
// 首先上传图片
const mxcUrl = await client.uploadContent(imageBlob, {
  name: "room_avatar.jpg",
  type: "image/jpeg"
});

// 设置为房间头像
await client.sendStateEvent(
  "!roomId:server.com",
  "m.room.avatar",
  { url: mxcUrl },
  ""
);
```

### 设置房间历史可见性

```typescript
// 设置历史可见性
await client.sendStateEvent(
  "!roomId:server.com",
  "m.room.history_visibility",
  { history_visibility: "joined" },  // "world_readable", "shared", "invited", "joined"
  ""
);
```

### 设置访客访问

```typescript
// 设置访客访问权限
await client.sendStateEvent(
  "!roomId:server.com",
  "m.room.guest_access",
  { guest_access: "can_join" },  // "forbidden" 或 "can_join"
  ""
);
```

### 设置加入规则

```typescript
// 设置加入规则
await client.sendStateEvent(
  "!roomId:server.com",
  "m.room.join_rules",
  {
    join_rule: "public"  // "public", "knock", "invite", "private"
  },
  ""
);
```

### 获取房间状态

```typescript
// 获取房间信息
const room = client.getRoom("!roomId:server.com");
if (room) {
  console.log("Room name:", room.name);
  console.log("Room topic:", room.topic);
  console.log("Room ID:", room.roomId);
  console.log("Is direct:", room.isDirect());
  console.log("Member count:", room.getJoinedMemberCount());
  console.log("Is encrypted:", room.hasEncryptionStateEvent());
}
```

### 监听房间状态变化

```typescript
// 监听房间名称变化
client.on(sdk.RoomEvent.Name, (room) => {
  console.log(`Room ${room.roomId} renamed to "${room.name}"`);
});

// 监听房间主题变化
client.on(sdk.RoomEvent.Topic, (room) => {
  console.log(`Room ${room.roomId} topic changed to "${room.topic}"`);
});

// 监听房间别名变化
client.on(sdk.RoomEvent.Aliases, (room) => {
  console.log(`Room ${room.roomId} aliases changed`);
});
```

## 房间权限

### 获取权限等级

```typescript
// 获取房间权限配置
const room = client.getRoom("!roomId:server.com");
if (room) {
  const powerLevelsEvent = room.currentState.getStateEvents("m.room.power_levels", "");
  const powerLevels = powerLevelsEvent?.getContent();

  console.log("Default power level:", powerLevels.users_default);
  console.log("Events required levels:", powerLevels.events);
  console.log("Users power levels:", powerLevels.users);
}
```

### 修改默认权限

```typescript
// 修改默认权限等级
const room = client.getRoom("!roomId:server.com");
const powerLevels = room.currentState.getStateEvents("m.room.power_levels", "")?.getContent();

// 修改默认用户权限
powerLevels.users_default = 0;

// 修改事件所需权限
powerLevels.events["m.room.message"] = 0;
powerLevels.events["m.room.topic"] = 50;
powerLevels.events["m.room.name"] = 50;

// 发送更新
await client.sendStateEvent(
  "!roomId:server.com",
  "m.room.power_levels",
  powerLevels,
  ""
);
```

### 检查权限

```typescript
// 检查用户是否有权限执行操作
function hasPermission(room: sdk.Room, userId: string, eventType: string): boolean {
  const powerLevels = room.currentState.getStateEvents("m.room.power_levels", "")?.getContent();
  const userLevel = powerLevels?.users?.[userId] ?? powerLevels?.users_default ?? 0;
  const requiredLevel = powerLevels?.events?.[eventType] ?? powerLevels?.events_default ?? 0;

  return userLevel >= requiredLevel;
}

// 使用
const room = client.getRoom("!roomId:server.com");
if (room) {
  const canSendMessage = hasPermission(room, client.getUserId()!, "m.room.message");
  console.log("Can send message:", canSendMessage);
}
```

## 房间标签

### 添加房间标签

```typescript
// 为房间添加标签
await client.setRoomTag("!roomId:server.com", "m.lowpriority", {
  order: "0.5"
});

// 常用标签：
// - "m.favourite": 收藏
// - "m.lowpriority": 低优先级
// - "server.custom_tag": 自定义标签
```

### 设置多个标签

```typescript
// 设置收藏并指定顺序
await client.setRoomTag("!roomId:server.com", "m.favourite", {
  order: "0.1"  // 较小的数字显示在顶部
});

// 添加到低优先级
await client.setRoomTag("!roomId:server.com", "m.lowpriority", {
  order: "0.9"  // 较大的数字显示在底部
});
```

### 获取房间标签

```typescript
// 获取房间所有标签
const room = client.getRoom("!roomId:server.com");
if (room) {
  const tags = room.tags;
  console.log("Room tags:", tags);

  // tags 结构：
  // {
  //   "m.favourite": { order: "0.1" },
  //   "m.lowpriority": { order: "0.9" }
  // }
}
```

### 删除房间标签

```typescript
// 删除房间标签
await client.deleteRoomTag("!roomId:server.com", "m.favourite");
```

### 按标签获取房间列表

```typescript
// 获取所有收藏的房间
const allRooms = client.getRooms();
const favouriteRooms = allRooms.filter(room => room.tags?.["m.favourite"]);

console.log("Favourite rooms:", favouriteRooms.map(r => r.name));

// 按标签顺序排序
const sortedRooms = allRooms
  .filter(room => room.tags?.["m.favourite"])
  .sort((a, b) => {
    const orderA = parseFloat(a.tags["m.favourite"].order || "0");
    const orderB = parseFloat(b.tags["m.favourite"].order || "0");
    return orderA - orderB;
  });
```

## 完整示例

### 房间管理类

```typescript
import * as sdk from "matrix-js-sdk";

class RoomManager {
  constructor(private client: sdk.MatrixClient) {}

  // 创建房间
  async createRoom(options: sdk.ICreateRoomOpts): Promise<string> {
    const response = await this.client.createRoom(options);
    console.log(`Created room: ${response.room_id}`);
    return response.room_id;
  }

  // 创建公开房间
  async createPublicRoom(name: string, topic?: string): Promise<string> {
    return this.createRoom({
      name,
      topic,
      visibility: "public",
      preset: "public_chat"
    });
  }

  // 创建私有房间
  async createPrivateRoom(name: string, invite: string[] = []): Promise<string> {
    return this.createRoom({
      name,
      invite,
      visibility: "private",
      preset: "private_chat"
    });
  }

  // 创建 DM
  async createDM(userId: string): Promise<string> {
    return this.createRoom({
      is_direct: true,
      invite: [userId],
      preset: "trusted_private_chat"
    });
  }

  // 加入房间
  async joinRoom(roomIdOrAlias: string): Promise<void> {
    await this.client.joinRoom(roomIdOrAlias);
    console.log(`Joined room: ${roomIdOrAlias}`);
  }

  // 离开房间
  async leaveRoom(roomId: string, reason?: string): Promise<void> {
    await this.client.leave(roomId, { reason });
    console.log(`Left room: ${roomId}`);
  }

  // 邀请用户
  async inviteUser(roomId: string, userId: string): Promise<void> {
    await this.client.invite(roomId, userId);
    console.log(`Invited ${userId} to ${roomId}`);
  }

  // 踢出用户
  async kickUser(roomId: string, userId: string, reason?: string): Promise<void> {
    await this.client.kick(roomId, userId, reason);
    console.log(`Kicked ${userId} from ${roomId}`);
  }

  // 封禁用户
  async banUser(roomId: string, userId: string, reason?: string): Promise<void> {
    await this.client.ban(roomId, userId, reason);
    console.log(`Banned ${userId} from ${roomId}`);
  }

  // 解封用户
  async unbanUser(roomId: string, userId: string): Promise<void> {
    await this.client.unban(roomId, userId);
    console.log(`Unbanned ${userId} from ${roomId}`);
  }

  // 设置房间名称
  async setRoomName(roomId: string, name: string): Promise<void> {
    await this.client.setRoomName(roomId, name);
    console.log(`Set room name to: ${name}`);
  }

  // 设置房间主题
  async setRoomTopic(roomId: string, topic: string): Promise<void> {
    await this.client.setRoomTopic(roomId, topic);
    console.log(`Set room topic to: ${topic}`);
  }

  // 添加标签
  async tagRoom(roomId: string, tag: string, order?: number): Promise<void> {
    await this.client.setRoomTag(roomId, tag, { order: order?.toString() });
    console.log(`Tagged room with: ${tag}`);
  }

  // 移除标签
  async untagRoom(roomId: string, tag: string): Promise<void> {
    await this.client.deleteRoomTag(roomId, tag);
    console.log(`Removed tag: ${tag}`);
  }

  // 获取房间
  getRoom(roomId: string): sdk.Room | null {
    return this.client.getRoom(roomId);
  }

  // 获取所有房间
  getAllRooms(): sdk.Room[] {
    return this.client.getRooms();
  }

  // 按标签获取房间
  getRoomsByTag(tag: string): sdk.Room[] {
    return this.client.getRooms().filter(room => room.tags?.[tag]);
  }
}

// 使用示例
async function example() {
  const client = sdk.createClient({
    baseUrl: "https://matrix.org",
    accessToken: "token",
    userId: "@user:matrix.org"
  });

  await client.startClient();

  const roomManager = new RoomManager(client);

  // 创建房间
  const roomId = await roomManager.createPublicRoom("My Room", "Discussion");

  // 邀请用户
  await roomManager.inviteUser(roomId, "@friend:matrix.org");

  // 设置标签
  await roomManager.tagRoom(roomId, "m.favourite", 0.1);

  // 获取所有收藏的房间
  const favourites = roomManager.getRoomsByTag("m.favourite");
  console.log("Favourite rooms:", favourites.map(r => r.name));
}
```

### 房间成员管理类

```typescript
class RoomMemberManager {
  constructor(private client: sdk.MatrixClient) {}

  // 获取房间所有成员
  getMembers(roomId: string): sdk.RoomMember[] {
    const room = this.client.getRoom(roomId);
    return room?.getJoinedMembers() || [];
  }

  // 获取在线成员
  getOnlineMembers(roomId: string): sdk.RoomMember[] {
    const room = this.client.getRoom(roomId);
    if (!room) return [];

    return room.getJoinedMembers().filter(member => {
      const user = this.client.getUser(member.userId);
      // 根据用户 presence 判断是否在线
      return user?.presence === "online";
    });
  }

  // 获取管理员
  getAdmins(roomId: string): sdk.RoomMember[] {
    const room = this.client.getRoom(roomId);
    if (!room) return [];

    return room.getJoinedMembers().filter(member => {
      const powerLevels = room.currentState.getStateEvents("m.room.power_levels", "")?.getContent();
      const userLevel = powerLevels?.users?.[member.userId] ?? powerLevels?.users_default ?? 0;
      return userLevel >= 100;
    });
  }

  // 获取版主
  getModerators(roomId: string): sdk.RoomMember[] {
    const room = this.client.getRoom(roomId);
    if (!room) return [];

    return room.getJoinedMembers().filter(member => {
      const powerLevels = room.currentState.getStateEvents("m.room.power_levels", "")?.getContent();
      const userLevel = powerLevels?.users?.[member.userId] ?? powerLevels?.users_default ?? 0;
      return userLevel >= 50 && userLevel < 100;
    });
  }

  // 批量邀请
  async inviteMany(roomId: string, userIds: string[]): Promise<void> {
    for (const userId of userIds) {
      try {
        await this.client.invite(roomId, userId);
        console.log(`Invited ${userId}`);
      } catch (error) {
        console.error(`Failed to invite ${userId}:`, error);
      }
    }
  }

  // 批量踢出
  async kickMany(roomId: string, userIds: string[], reason?: string): Promise<void> {
    for (const userId of userIds) {
      try {
        await this.client.kick(roomId, userId, reason);
        console.log(`Kicked ${userId}`);
      } catch (error) {
        console.error(`Failed to kick ${userId}:`, error);
      }
    }
  }
}
```
