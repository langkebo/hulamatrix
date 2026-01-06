# Matrix SDK - 空间和群组 (Spaces and Groups)

**文档版本**: 1.0.0
**SDK 版本**: 39.1.3
**最后更新**: 2026-01-04
**相关规范**: [Spaces MSC](https://github.com/matrix-org/matrix-spec-proposals/blob/main/proposals/1772-groups-as-rooms.md)

---

## 概述

Matrix SDK 支持**空间（Spaces）**功能，这是一种用于组织和分组相关房间的机制。

### 空间 vs 群组 (Groups)

| 特性 | 空间 (Spaces) | 群组 (Communities) |
|------|--------------|-------------------|
| 实现方式 | 特殊类型的房间 | 独立的群组 API |
| 状态 | ✅ 推荐使用 | ⚠️ 已弃用 (MSC) |
| 嵌套支持 | ✅ 支持多层嵌套 | ❌ 不支持 |
| 权限控制 | ✅ 使用房间权限 | ⚠️ 独立权限系统 |
| 成员管理 | ✅ 使用房间成员 | ⚠️ 独立成员管理 |

---

## 空间（Spaces）

### 创建空间

```typescript
import * as sdk from "matrix-js-sdk";

const client = sdk.createClient({ ... });

// 创建空间
const spaceRoom = await client.createRoom({
    name: "My Organization",
    topic: "Official rooms for My Organization",
    preset: "private_chat",
    room_version: "10", // 支持空间的房间版本
    visibility: "private",
    initial_state: [
        {
            type: "m.room.history_visibility",
            state_key: "",
            content: { history_visibility: "shared" },
        },
        {
            type: "m.space.parent", // 标记为空间
            state_key: "",
            content: {},
        },
    ],
    creation_content: {
        type: "m.space", // 指定房间类型为空间
    },
});

console.log("空间已创建:", spaceRoom.room_id);
```

### 检测空间

```typescript
// 检查房间是否为空间
const room = client.getRoom("!roomId:server.com");
const isSpace = room?.isSpaceRoom(); // 返回 true/false

// 或者通过事件类型判断
const spaceEvent = room?.currentState.getStateEvents("m.room.create", "");
const isSpaceRoom = spaceEvent?.getContent()?.type === "m.space";
```

### 获取空间列表

```typescript
// 获取所有空间
const spaces = client.getRooms().filter((room) => room.isSpaceRoom());

console.log("找到空间:", spaces.length);
spaces.forEach((space) => {
    console.log("- " + space.name);
});

// 从帐号数据获取用户的空间
const accountData = client.getAccountData("m.direct");
// 空间也可以存储在自定义帐号数据中
const spaceList = client.getAccountData("com.example.app.spaces");
```

---

## 空间成员管理

### 邀请用户加入空间

```typescript
const spaceId = "!spaceId:server.com";
const userId = "@user:server.com";

// 邀请用户
await client.invite(spaceId, userId);

// 用户接受邀请
await client.join(spaceId);
```

### 获取空间成员

```typescript
const space = client.getRoom("!spaceId:server.com");

// 获取所有成员
const members = space.getJoinedMembers();
console.log("成员数:", members.length);

// 获取成员权限
const member = space.getMember("@user:server.com");
console.log("权限等级:", member?.powerLevel);
console.log("角色:", member?.membership);
```

### 设置空间管理员

```typescript
// 设置用户为空间管理员
await client.setUserPowerLevel(
    "!spaceId:server.com",
    "@admin:server.com",
    100 // 管理员权限等级
);
```

---

## 子房间管理

### 将房间添加到空间

```typescript
const spaceId = "!spaceId:server.com";
const roomId = "!roomId:server.com";

// 通过发送 m.space.child 事件将房间添加为子房间
await client.sendStateEvent(
    spaceId,
    "m.space.child",
    {
        via: ["server.com"], // 指定服务器路由
        suggested: true,     // 建议加入
        order: "0.5",        // 排序顺序
    },
    roomId // state_key 是房间 ID
);
```

### 设置子房间顺序

```typescript
// 更新子房间的排序
await client.sendStateEvent(
    spaceId,
    "m.space.child",
    {
        via: ["server.com"],
        suggested: true,
        order: "1", // 更新顺序
    },
    roomId
);

// 排序规则：
// - 数字字符串按字典序排序
// - "0" < "1" < "10" < "2" < "a"
// - 推荐使用小数或填充零: "0.5", "1.0", "1.5", "2.0"
```

### 移除子房间

```typescript
// 移除子房间（发送空内容）
await client.sendStateEvent(
    spaceId,
    "m.space.child",
    {}, // 空内容表示移除
    roomId
);
```

### 获取空间的子房间

```typescript
const space = client.getRoom("!spaceId:server.com");

// 获取所有子房间事件
const childEvents = space.currentState.getStateEvents("m.space.child");

const children = childEvents
    .filter((event) => event.getContent()?.via) // 过滤已移除的
    .map((event) => ({
        roomId: event.getStateKey(),
        via: event.getContent().via,
        suggested: event.getContent().suggested || false,
        order: event.getContent().order || "",
    }));

console.log("子房间:", children);
// [
//   { roomId: "!room1:server.com", via: ["server.com"], suggested: true, order: "1" },
//   { roomId: "!room2:server.com", via: ["server.com"], suggested: false, order: "2" }
// ]
```

---

## 空间层级（Hierarchy）

### 获取空间层级

```typescript
// 使用 Matrix API 获取空间层级
const spaceId = "!spaceId:server.com";

// 从服务器获取完整的空间层级
const hierarchy = await client.getSpaceHierarchy(spaceId);

console.log("层级数据:", hierarchy);
// {
//   rooms: [...],      // 所有子房间
//   next_batch: "token" // 分页令牌
// }
```

### 分页获取子房间

```typescript
async function getAllSpaceChildren(spaceId: string) {
    let allRooms: sdk.IHierarchyRoom[] = [];
    let nextBatch: string | undefined;

    do {
        const result = await client.getSpaceHierarchy(spaceId, {
            from: nextBatch,
            max_depth: 1, // 只获取直接子房间
            limit: 100,   // 每页数量
            suggested_only: false, // 包含非建议房间
        });

        allRooms = allRooms.concat(result.rooms);
        nextBatch = result.next_batch;
    } while (nextBatch);

    return allRooms;
}

// 使用示例
const allChildren = await getAllSpaceChildren("!spaceId:server.com");
console.log("总子房间数:", allChildren.length);
```

### 解析层级数据

```typescript
interface ParsedSpaceRoom {
    roomId: string;
    name: string;
    topic?: string;
    avatarUrl?: string;
    roomType?: string;
    isSpace: boolean;
    childrenState: Array<{
        roomId: string;
        suggested: boolean;
        order?: string;
        via: string[];
    }>;
}

function parseHierarchyRoom(room: sdk.IHierarchyRoom): ParsedSpaceRoom {
    return {
        roomId: room.room_id,
        name: room.name || "Unnamed Room",
        topic: room.topic,
        avatarUrl: room.avatar_url,
        roomType: room.room_type,
        isSpace: room.room_type === "m.space",
        childrenState: room.children_state.map((child) => ({
            roomId: child.state_key,
            suggested: child.content.suggested || false,
            order: child.content.order,
            via: child.content.via || [],
        })),
    };
}
```

---

## 嵌套空间

### 创建嵌套空间结构

```typescript
// 创建顶层空间
const topLevelSpace = await client.createRoom({
    name: "Organization",
    creation_content: { type: "m.space" },
    preset: "private_chat",
});

// 创建部门空间
const engineeringSpace = await client.createRoom({
    name: "Engineering",
    creation_content: { type: "m.space" },
    preset: "private_chat",
});

const marketingSpace = await client.createRoom({
    name: "Marketing",
    creation_content: { type: "m.space" },
    preset: "private_chat",
});

// 将部门空间添加到顶层空间
await client.sendStateEvent(
    topLevelSpace.room_id,
    "m.space.child",
    { via: ["server.com"], suggested: true, order: "1" },
    engineeringSpace.room_id
);

await client.sendStateEvent(
    topLevelSpace.room_id,
    "m.space.child",
    { via: ["server.com"], suggested: true, order: "2" },
    marketingSpace.room_id
);

// 创建项目房间
const projectRoom = await client.createRoom({
    name: "Project Alpha",
    preset: "private_chat",
});

// 将项目房间添加到工程空间
await client.sendStateEvent(
    engineeringSpace.room_id,
    "m.space.child",
    { via: ["server.com"], suggested: true, order: "1" },
    projectRoom.room_id
);
```

### 设置父空间

```typescript
// 在房间中设置父空间
await client.sendStateEvent(
    roomId,
    "m.space.parent",
    {
        via: ["server.com"],
        canonical: true, // 这是主要父空间
    },
    spaceId // state_key 是父空间 ID
);

// 一个房间可以有多个父空间
await client.sendStateEvent(
    roomId,
    "m.space.parent",
    {
        via: ["server.com"],
        canonical: false, // 不是主要父空间
    },
    anotherSpaceId
);
```

---

## 空间元数据

### 设置空间图标

```typescript
// 上传头像
const avatarUrl = await client.uploadContent(fileBlob);

// 设置房间头像
await client.sendStateEvent(
    spaceId,
    "m.room.avatar",
    { url: avatarUrl },
    ""
);
```

### 设置空间主题

```typescript
await client.sendStateEvent(
    spaceId,
    "m.room.topic",
    { topic: "This is the official space for..." },
    ""
);
```

### 设置空间别名

```typescript
// 创建别名（例如 #organization:server.com）
await client.createAlias(
    "#organization:server.com",
    spaceId
);

// 删除别名
await client.deleteAlias("#organization:server.com");
```

---

## 空间权限

### 限制谁能加入空间

```typescript
// 设置房间为私有（仅邀请）
await client.sendStateEvent(
    spaceId,
    "m.room.join_rules",
    { join_rule: "invite" },
    ""
);

// 设置为公开（任何人可加入）
await client.sendStateEvent(
    spaceId,
    "m.room.join_rules",
    { join_rule: "public" },
    ""
);
```

### 设置 guest 访问

```typescript
// 允许 guest 访问
await client.sendStateEvent(
    spaceId,
    "m.room.guest_access",
    { guest_access: "can_join" },
    ""
);

// 禁止 guest 访问
await client.sendStateEvent(
    spaceId,
    "m.room.guest_access",
    { guest_access: "forbidden" },
    ""
);
```

---

## 完整示例：空间管理器

```typescript
import * as sdk from "matrix-js-sdk";

class SpaceManager {
    constructor(private client: sdk.MatrixClient) {}

    // 创建空间
    async createSpace(options: {
        name: string;
        topic?: string;
        avatar?: File;
        visibility?: "public" | "private";
    }): Promise<sdk.Room> {
        const room = await this.client.createRoom({
            name: options.name,
            topic: options.topic,
            preset: options.visibility === "public" ? "public_chat" : "private_chat",
            visibility: options.visibility || "private",
            creation_content: { type: "m.space" },
        });

        // 上传头像
        if (options.avatar) {
            const avatarUrl = await this.client.uploadContent(options.avatar);
            await this.client.sendStateEvent(
                room.room_id,
                "m.room.avatar",
                { url: avatarUrl },
                ""
            );
        }

        return this.client.getRoom(room.room_id)!;
    }

    // 添加子房间
    async addRoomToSpace(
        spaceId: string,
        roomId: string,
        options: {
            suggested?: boolean;
            order?: string;
        } = {}
    ): Promise<void> {
        await this.client.sendStateEvent(
            spaceId,
            "m.space.child",
            {
                via: this.extractServerName(roomId),
                suggested: options.suggested ?? false,
                order: options.order,
            },
            roomId
        );
    }

    // 获取空间的所有子房间
    async getSpaceChildren(spaceId: string): Promise<sdk.IHierarchyRoom[]> {
        const hierarchy = await this.client.getSpaceHierarchy(spaceId, {
            max_depth: 1,
            suggested_only: false,
        });
        return hierarchy.rooms;
    }

    // 移除子房间
    async removeRoomFromSpace(spaceId: string, roomId: string): Promise<void> {
        await this.client.sendStateEvent(
            spaceId,
            "m.space.child",
            {},
            roomId
        );
    }

    // 获取空间的所有父空间
    getParentSpaces(roomId: string): string[] {
        const room = this.client.getRoom(roomId);
        if (!room) return [];

        const parentEvents = room.currentState.getStateEvents("m.space.parent");
        return parentEvents.map((event) => event.getStateKey()!);
    }

    // 检查房间是否在空间中
    isRoomInSpace(spaceId: string, roomId: string): boolean {
        const space = this.client.getRoom(spaceId);
        if (!space) return false;

        const childEvents = space.currentState.getStateEvents("m.space.child");
        return childEvents.some((event) => event.getStateKey() === roomId);
    }

    private extractServerName(roomId: string): string[] {
        // 从房间 ID 中提取服务器名称
        const match = roomId.match(/^![^:]+:(.+)$/);
        return match ? [match[1]] : [];
    }
}

// 使用示例
const client = sdk.createClient({ ... });
const spaceManager = new SpaceManager(client);

// 创建空间
const orgSpace = await spaceManager.createSpace({
    name: "My Organization",
    topic: "Official organization space",
    visibility: "private",
});

// 添加房间到空间
await spaceManager.addRoomToSpace(orgSpace.room_id, "!roomId:server.com", {
    suggested: true,
    order: "1",
});

// 获取子房间
const children = await spaceManager.getSpaceChildren(orgSpace.room_id);
console.log("子房间:", children.length);
```

---

## 群组（Communities）- 已弃用

> ⚠️ **注意**: 群组 API 已被空间（Spaces）取代，建议新项目使用空间功能。

### 获取群组列表

```typescript
// 获取用户加入的群组
const groups = await client.getGroups();
console.log("群组:", groups);
// { groups: [{ group_id: "+group:server.com", ... }] }
```

### 获取群组信息

```typescript
const groupId = "+group:server.com";
const groupInfo = await client.getGroupInfo(groupId);
console.log("群组信息:", groupInfo);
```

### 群组成员管理

```typescript
// 获取群组成员
const members = await client.getGroupUsers(groupId);

// 邀请用户加入群组
await client.inviteToGroup(groupId, "@user:server.com");

// 从群组移除用户
await client.removeUserFromGroup(groupId, "@user:server.com");
```

---

## 相关文档

- [03-room-management.md](./03-room-management.md) - 房间管理
- [18-account-data.md](./18-account-data.md) - 帐号数据
- [MSC 1772 - Groups as Rooms](https://github.com/matrix-org/matrix-spec-proposals/blob/main/proposals/1772-groups-as-rooms.md)
- [Matrix 规范 - Spaces](https://spec.matrix.org/v1.10/client-server-api/#space-related-events)

---

**文档维护**: 如有更新，请同步修改 Matrix SDK 版本号和最后更新日期。
