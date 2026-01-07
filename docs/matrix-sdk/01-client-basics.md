# 01. 客户端基础

> Matrix JS SDK 客户端初始化、配置和基础操作

## 实现验证状态

> **验证日期**: 2025-12-30> **验证报告**: [01-client-basics-VERIFICATION.md](./01-client-basics-VERIFICATION.md)

> **总体完成度**: 100% ✅
>
> ### 功能状态
> - ✅ 创建客户端: 已完整实现
> - ✅ 客户端配置: 完整实现（包括高级配置）
> - ✅ 启动/停止客户端: 已完整实现
> - ✅ 同步状态管理: 完整实现（包括自动重连）
> - ✅ 获取客户端信息: 完整实现
> - ✅ 存储后端: 完整实现（IndexedDB 显式配置）
>
> ### 主要发现
> 1. **已实现**: 客户端创建、认证、启动/停止、完整同步、自动重连
> 2. **已完成**: 同步状态 UI 指示器、高级配置选项、IndexedDB 存储
> 3. **状态**: 所有文档要求的功能均已实现

## 目录
- [创建客户端](#创建客户端)
- [客户端配置选项](#客户端配置选项)
- [启动和停止客户端](#启动和停止客户端)
- [同步状态](#同步状态)
- [获取客户端信息](#获取客户端信息)
- [存储后端](#存储后端)
- [完整示例](#完整示例)

## 创建客户端

### 基本创建方式

```typescript
import * as sdk from "matrix-js-sdk";

// 最简单的创建方式（匿名客户端）
const client = sdk.createClient({
  baseUrl: "https://cjystx.top"
});
```

### 使用访问令牌创建

```typescript
const client = sdk.createClient({
  baseUrl: "https://cjystx.top",
  accessToken: "syt_YourAccessTokenHere",
  userId: "@user:cjystx.top"
});
```

### 使用登录凭据创建

```typescript
// 创建后登录
const client = sdk.createClient({
  baseUrl: "https://cjystx.top"
});

const loginResponse = await client.login("m.login.password", {
  user: "username",
  password: "password"
});

console.log("Access token:", loginResponse.access_token);
console.log("Device ID:", loginResponse.device_id);
```

### 完整配置示例

```typescript
const client = sdk.createClient({
  // 基础配置
  baseUrl: "https://cjystx.top",
  accessToken: "your_token",
  userId: "@user:cjystx.top",
  deviceId: "your_device_id",

  // 存储配置
  store: new sdk.MemoryStore(),
  storeStartTime: Date.now(),

  // 同步配置
  timelineSupport: true,
  pendingEventOrdering: "chronological",

  // 加密配置
  cryptoCallback: undefined, // 稍后设置

  // 其他选项
  forceTurn: true,  // 强制使用 TURN
  fallbackICEServerAllowed: true
});
```

## 客户端配置选项

### ICreateClientOpts 接口

```typescript
interface ICreateClientOpts {
  // === 必需配置 ===
  baseUrl: string;              // Matrix 服务器 URL

  // === 认证配置 ===
  accessToken?: string;         // 访问令牌
  userId?: string;              // 用户 ID
  deviceId?: string;            // 设备 ID
  guestAccessToken?: string;    // 访客令牌

  // === 存储配置 ===
  store?: IStore;               // 存储后端实例
  cryptoStore?: ICryptoStore;   // 加密存储
  pickleKey?: string;           // pickle 密钥（用于加密存储）

  // === 同步配置 ===
  timelineSupport?: boolean;    // 启用时间线支持
  pendingEventOrdering?: "chronological" | "detached";  // 待处理事件排序
  filter?: ISyncFilter;         // 同步过滤器

  // === 加密配置 ===
  cryptoCallbacks?: CryptoCallbacks;  // 加密回调
  verificationMethods?: string[];     // 验证方法

  // === WebRTC 配置 ===
  forceTurn?: boolean;          // 强制使用 TURN
  fallbackICEServerAllowed?: boolean;
  turnServers?: ITurnServer[];  // TURN 服务器列表

  // === 其他配置 ===
  idBaseUrl?: string;           // Identity 服务器 URL
  localTimeoutMs?: number;      // 本地超时时间
  useAuthorizationHeader?: boolean;
  request?: IRequestFunction;   // 自定义请求函数

  // === 实验性功能 ===
  experimentalScheduler?: boolean;
  experimentalThreadSupport?: boolean;

  // === Sliding Sync ===
  slidingSyncProxy?: string;
}
```

### 配置示例

```typescript
// 生产环境配置
const client = sdk.createClient({
  baseUrl: "https://matrix.cjystx.top",
  accessToken: "token",
  userId: "@user:cjystx.top",

  // 启用时间线支持
  timelineSupport: true,

  // 按时间顺序排序待处理事件
  pendingEventOrdering: "chronological",

  // 设置自定义请求超时
  localTimeoutMs: 30000,

  // 强制使用 TURN（用于 WebRTC）
  forceTurn: false
});

// 开发环境配置
const devClient = sdk.createClient({
  baseUrl: "http://localhost:8008",
  userId: "@dev:localhost",

  // 开发环境禁用一些检查
  useAuthorizationHeader: true,

  // 自定义请求函数用于调试
  request: (opts, callback) => {
    console.log("Request:", opts);
    return sdk.request(opts, callback);
  }
});
```

## 启动和停止客户端

### startClient()

启动客户端并开始同步事件。

```typescript
// 基本启动
await client.startClient();

// 带选项启动
await client.startClient({
  initialSyncLimit: 20,        // 初始同步事件数量
  enableSync: true,            // 启用同步
  syncTimeout: 30000,          // 同步超时
  includeArchivedRooms: false, // 包含已归档房间
  lazyLoadMembers: true        // 懒加载成员
});
```

### IStartClientOpts 选项

```typescript
interface IStartClientOpts {
  initialSyncLimit?: number;     // 初始同步限制 (默认: 8)
  filter?: string | ISyncFilter; // 同步过滤器
  enableSync?: boolean;          // 是否启用同步 (默认: true)
  syncTimeout?: number;          // 同步超时 (毫秒)
  includeArchivedRooms?: boolean;// 包含已归档房间 (默认: false)
  lazyLoadMembers?: boolean;     // 懒加载成员 (默认: true)
  pendingEventOrdering?: "chronological" | "detached";
}
```

### 停止客户端

```typescript
// 停止客户端（停止同步）
client.stopClient();

// 停止并清理资源
client.stopClient();
await client.clearStores();

// 完全停止（包括加密）
client.stopClient();
const crypto = client.getCrypto();
if (crypto) {
  await crypto.stop();
}
```

### 重新启动客户端

```typescript
// 停止
client.stopClient();

// 等待一段时间
await new Promise(resolve => setTimeout(resolve, 1000));

// 重新启动
await client.startClient();
```

## 同步状态

### 监听同步状态

```typescript
import { ClientEvent } from "matrix-js-sdk";

// 监听同步状态变化
client.on(ClientEvent.Sync, (state, prevState, res) => {
  console.log(`Sync state: ${prevState} -> ${state}`);

  switch (state) {
    case "PREPARED":
      // 客户端已准备好，可以开始使用
      console.log("Client prepared");
      break;

    case "SYNCING":
      // 正在同步
      console.log("Syncing...");
      break;

    case "RECONNECTING":
      // 正在重新连接
      console.log("Reconnecting...");
      break;

    case "ERROR":
      // 同步错误
      console.error("Sync error:", res);
      break;

    case "STOPPED":
      // 同步已停止
      console.log("Sync stopped");
      break;
  }
});
```

### 同步状态类型

| 状态 | 描述 |
|------|------|
| `SYNCING` | 正在同步 |
| `PREPARED` | 初始同步完成，客户端已准备好 |
| `RECONNECTING` | 正在重新连接 |
| `ERROR` | 同步错误 |
| `STOPPED` | 同步已停止 |

### 等待客户端准备就绪

```typescript
// 方法1: 使用 Promise
function waitForPrepared(client: sdk.MatrixClient): Promise<void> {
  return new Promise((resolve, reject) => {
    const checkState = () => {
      const syncState = client.getSyncState();
      if (syncState === "PREPARED" || syncState === "SYNCING") {
        resolve();
      } else if (syncState === "ERROR") {
        reject(new Error("Sync failed"));
      } else {
        setTimeout(checkState, 100);
      }
    };
    checkState();
  });
}

await client.startClient();
await waitForPrepared(client);
console.log("Client is ready!");

// 方法2: 使用事件监听器
await new Promise<void>((resolve) => {
  const onSync = (state: string) => {
    if (state === "PREPARED") {
      client.off(ClientEvent.Sync, onSync);
      resolve();
    }
  };
  client.on(ClientEvent.Sync, onSync);
});
```

## 获取客户端信息

### 获取凭据信息

```typescript
// 获取用户 ID
const userId = client.getUserId();
console.log("User ID:", userId);

// 获取设备 ID
const deviceId = client.getDeviceId();
console.log("Device ID:", deviceId);

// 获取访问令牌
const accessToken = client.getAccessToken();
console.log("Access token:", accessToken);

// 获取完整凭据
const credentials = client.getCredentials();
console.log("Credentials:", credentials);
```

### 获取服务器信息

```typescript
// 获取基础 URL
const baseUrl = client.getBaseUrl();
console.log("Base URL:", baseUrl);

// 获取 Identity 服务器 URL
const idBaseUrl = client.getIdentityServerUrl();
console.log("Identity server:", idBaseUrl);
```

### 获取客户端状态

```typescript
// 获取同步状态
const syncState = client.getSyncState();
console.log("Sync state:", syncState);

// 获取当前同步令牌
const syncToken = client.getSyncToken();
console.log("Sync token:", syncToken);

// 检查客户端是否正在运行
const isRunning = client.isRunning();
console.log("Is running:", isRunning);

// 检查是否为访客
const isGuest = client.isGuest();
console.log("Is guest:", isGuest);
```

## 存储后端

### 使用内存存储（默认）

```typescript
const client = sdk.createClient({
  baseUrl: "https://cjystx.top",
  store: new sdk.MemoryStore()
});
```

### 使用 IndexedDB 存储（浏览器）

```typescript
// 使用 SDK 内置的 IndexedDB 存储
const client = sdk.createClient({
  baseUrl: "https://cjystx.top",
  store: new sdk.IndexedDBStore({
    indexedDB: window.indexedDB,
    dbName: "matrix-js-sdk",
    workerScript: "matrix-sdk-worker.js"
  })
});

// 初始化存储
await client.store.start();
```

### 自定义存储实现

```typescript
import { IStore } from "matrix-js-sdk";

class CustomStore implements IStore {
  // 实现接口方法
  async getRoom(roomId: string) { /* ... */ }
  async setRoom(roomId: string, roomData: any) { /* ... */ }
  // ... 其他方法
}

const client = sdk.createClient({
  baseUrl: "https://cjystx.top",
  store: new CustomStore()
});
```

### 存储操作

```typescript
// 获取房间
const room = client.getRoom("!roomId:server");
if (room) {
  console.log("Room name:", room.name);
}

// 获取所有房间
const rooms = client.getRooms();
console.log("Total rooms:", rooms.length);

// 获取用户
const user = client.getUser("@user:cjystx.top");
if (user) {
  console.log("User display name:", user.displayName);
}

// 清除所有存储
await client.clearStores();
```

## 完整示例

### 完整的客户端初始化流程

```typescript
import * as sdk from "matrix-js-sdk";
import { ClientEvent, RoomEvent } from "matrix-js-sdk";

async function initMatrixClient() {
  // 1. 创建客户端
  const client = sdk.createClient({
    baseUrl: "https://cjystx.top",
    accessToken: "your_access_token",
    userId: "@user:cjystx.top",
    deviceId: "your_device_id",

    // 配置选项
    timelineSupport: true,
    pendingEventOrdering: "chronological",
  });

  // 2. 设置事件监听器
  setupEventListeners(client);

  // 3. 启动客户端
  await client.startClient({
    initialSyncLimit: 20,
    lazyLoadMembers: true
  });

  // 4. 等待准备就绪
  await waitForPrepared(client);

  console.log("Matrix client initialized successfully!");
  return client;

  function setupEventListeners(client: sdk.MatrixClient) {
    // 监听同步状态
    client.on(ClientEvent.Sync, (state, prevState, res) => {
      console.log(`Sync state: ${prevState} -> ${state}`);

      if (state === "ERROR") {
        console.error("Sync error:", res?.getError());
      }
    });

    // 监听新消息
    client.on(RoomEvent.Timeline, (event, room) => {
      if (event.getType() === "m.room.message") {
        const content = event.getContent();
        console.log(`New message in ${room.name}:`);
        console.log(`  From: ${event.getSender()}`);
        console.log(`  Content: ${content.body}`);
      }
    });

    // 监听成员变化
    client.on(RoomEvent.MyMembership, (room, membership, prevMembership) => {
      console.log(`Membership in ${room.roomId} changed: ${prevMembership} -> ${membership}`);
    });
  }

  function waitForPrepared(client: sdk.MatrixClient): Promise<void> {
    return new Promise((resolve, reject) => {
      const onSync = (state: string) => {
        if (state === "PREPARED") {
          client.off(ClientEvent.Sync, onSync);
          resolve();
        } else if (state === "ERROR") {
          client.off(ClientEvent.Sync, onSync);
          reject(new Error("Failed to prepare client"));
        }
      };

      // 检查是否已经准备就绪
      const currentState = client.getSyncState();
      if (currentState === "PREPARED" || currentState === "SYNCING") {
        resolve();
      } else {
        client.on(ClientEvent.Sync, onSync);
      }
    });
  }
}

// 使用示例
async function main() {
  try {
    const client = await initMatrixClient();

    // 客户端已准备就绪，可以执行操作
    const rooms = client.getRooms();
    console.log(`You are in ${rooms.length} rooms`);

    // 发送消息
    if (rooms.length > 0) {
      await client.sendMessage(rooms[0].roomId, {
        msgtype: "m.text",
        body: "Hello from Matrix SDK!"
      });
    }

  } catch (error) {
    console.error("Failed to initialize client:", error);
  }
}

main();
```

### 带重连的客户端

```typescript
class MatrixClientManager {
  private client: sdk.MatrixClient;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(config: sdk.ICreateClientOpts) {
    this.client = sdk.createClient(config);
    this.setupReconnect();
  }

  private setupReconnect() {
    this.client.on(ClientEvent.Sync, (state) => {
      if (state === "ERROR") {
        this.handleReconnect();
      } else if (state === "SYNCING") {
        this.reconnectAttempts = 0;
      }
    });
  }

  private async handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

      console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

      setTimeout(async () => {
        try {
          await this.client.startClient();
          console.log("Reconnected successfully");
        } catch (error) {
          console.error("Reconnect failed:", error);
        }
      }, delay);
    } else {
      console.error("Max reconnection attempts reached");
    }
  }

  getClient(): sdk.MatrixClient {
    return this.client;
  }

  async stop() {
    this.client.stopClient();
    const crypto = this.client.getCrypto();
    if (crypto) {
      await crypto.stop();
    }
  }
}

// 使用
const manager = new MatrixClientManager({
  baseUrl: "https://cjystx.top",
  accessToken: "token",
  userId: "@user:cjystx.top"
});

await manager.getClient().startClient();
```

### 使用滑动同步的客户端

```typescript
async function initClientWithSlidingSync() {
  const client = sdk.createClient({
    baseUrl: "https://cjystx.top",
    accessToken: "token",
    userId: "@user:cjystx.top",
    slidingSyncProxy: "https://sliding-sync.cjystx.top"
  });

  // 创建滑动同步实例
  const slidingSync = new sdk.SlidingSyncSdk(
    "https://sliding-sync.cjystx.top",
    client,
    new sdk.MemoryStore()
  );

  // 配置滑动同步列表
  await slidingSync.start({
    lists: {
      "all_rooms": {
        ranges: [[0, 20]],
        filters: {
          is_dm: false
        },
        timelineLimit: 20
      },
      "dms": {
        ranges: [[0, 10]],
        filters: {
          is_dm: true
        }
      }
    }
  });

  return { client, slidingSync };
}
```

## 常见问题

### Q: 如何处理客户端错误？

```typescript
client.on(ClientEvent.Sync, (state, prevState, res) => {
  if (state === "ERROR") {
    const error = res?.getError();
    console.error("Client error:", error);

    // 根据错误类型处理
    if (error?.httpStatus === 401) {
      // 令牌过期，需要重新登录
      console.log("Token expired, please login again");
    } else if (error?.httpStatus >= 500) {
      // 服务器错误，可以重试
      console.log("Server error, will retry");
    }
  }
});
```

### Q: 如何检查客户端连接状态？

```typescript
function getConnectionStatus(client: sdk.MatrixClient): string {
  const syncState = client.getSyncState();

  if (syncState === "SYNCING" || syncState === "PREPARED") {
    return "connected";
  } else if (syncState === "RECONNECTING") {
    return "reconnecting";
  } else if (syncState === "ERROR") {
    return "error";
  } else {
    return "disconnected";
  }
}
```

### Q: 如何优雅地停止客户端？

```typescript
async function gracefulStop(client: sdk.MatrixClient) {
  // 1. 停止同步
  client.stopClient();

  // 2. 等待待处理的请求
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 3. 停止加密
  const crypto = client.getCrypto();
  if (crypto) {
    await crypto.stop();
  }

  // 4. 清理存储（可选）
  // await client.clearStores();

  console.log("Client stopped gracefully");
}
```
