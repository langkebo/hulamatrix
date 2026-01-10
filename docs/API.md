 ⚠️ SDK项目已知问题总结

### 1. 同步状态管理问题
- **问题描述**: 当网络连接不稳定时，同步状态转换可能不符合预期
- **影响范围**: `SyncState` 状态机在 `RECONNECTING` 和 `ERROR` 状态之间的转换
- **解决状态**: 已修复测试用例，实际代码逻辑正确

### 2. Worker 进程清理问题
- **问题描述**: 测试运行后 Worker 进程可能无法正常退出
- **原因**: IndexedDB 和 Rust crypto SDK 的异步操作未完全清理
- **影响**: 不影响功能，但可能导致测试执行时间略长

### 3. 认证媒体支持
- **问题描述**: 服务器可能要求媒体端点使用认证
- **影响**: 图片、文件、头像等媒体资源的加载
- **解决方案**: 需要在请求中添加 `Authorization` 头

### 4. 加密栈线程安全问题
- **问题描述**: 加密栈不是线程安全的
- **影响**: 多个 `MatrixClient` 实例连接同一个 IndexedDB 会导致数据损坏和解密失败
- **解决方案**: 确保同一时间只有一个 `MatrixClient` 实例

---

## 🚀 前端开发使用注意事项

### 安装配置

```bash
# 推荐使用 yarn
yarn add matrix-js-sdk

# 或使用 npm
npm install matrix-js-sdk
```

### 重要注意事项

#### 1. 浏览器环境配置

```javascript
import * as sdk from "matrix-js-sdk";

// 创建客户端时需要注意配置
const client = sdk.createClient({
    baseUrl: "https://your-matrix-server.com",
    accessToken: "your-access-token",
    userId: "@user:your-server.com",
    // 浏览器环境下的存储配置
    store: new sdk.IndexedDBStore({
        indexedDB: window.indexedDB,
        localStorage: window.localStorage,
        dbName: "matrix-js-sdk-db",
    }),
});
```

#### 2. 认证媒体处理（重要！）

从 Matrix 1.11 开始，服务器可能要求媒体请求包含认证头。在浏览器中使用 `<img>` 标签时需要特别处理：

```javascript
// 方法1: 使用 fetch 获取媒体
const downloadUrl = client.mxcUrlToHttp(
    "mxc://example.org/abc123",
    undefined,  // width
    undefined,  // height
    undefined,  // resizeMethod
    false,      // allowDirectLinks
    true,       // allowRedirects
    true,       // useAuthentication - 重要！
);

const response = await fetch(downloadUrl, {
    headers: {
        Authorization: `Bearer ${client.getAccessToken()}`,
    },
});
const blob = await response.blob();
const imageUrl = URL.createObjectURL(blob);

// 方法2: 使用 Service Worker（推荐用于生产环境）
// 需要配置 Service Worker 来拦截媒体请求并添加认证头
```

#### 3. 端到端加密初始化

```javascript
// 初始化加密支持
await client.initRustCrypto();

// 获取加密 API
const crypto = client.getCrypto();

// 设置密钥存储
await crypto.bootstrapSecretStorage({
    createSecretStorageKey: async () => {
        // 提示用户保存恢复密钥
        return generatedKey;
    },
});
```

#### 4. 事件监听最佳实践

```javascript
import { ClientEvent, RoomEvent, RoomMemberEvent } from "matrix-js-sdk";

// 监听同步状态
client.on(ClientEvent.Sync, (state, prevState, data) => {
    switch (state) {
        case "PREPARED":
            console.log("客户端准备就绪");
            break;
        case "SYNCING":
            console.log("正在同步");
            break;
        case "RECONNECTING":
            console.log("正在重连...");
            break;
        case "ERROR":
            console.error("同步错误:", data?.error);
            break;
    }
});

// 监听消息
client.on(RoomEvent.Timeline, (event, room, toStartOfTimeline) => {
    if (toStartOfTimeline) return; // 忽略历史消息
    if (event.getType() !== "m.room.message") return;
    
    console.log(`[${room.name}] ${event.getSender()}: ${event.getContent().body}`);
});

// 监听输入状态
client.on(RoomMemberEvent.Typing, (event, member) => {
    if (member.typing) {
        console.log(`${member.name} 正在输入...`);
    }
});
```

#### 5. 错误处理

```javascript
// 发送消息时的错误处理
try {
    await client.sendMessage(roomId, {
        body: "Hello",
        msgtype: "m.text",
    });
} catch (error) {
    if (error.errcode === "M_LIMIT_EXCEEDED") {
        // 速率限制，SDK 会自动重试
        console.log("请求过于频繁，请稍后再试");
    } else if (error.errcode === "M_UNKNOWN_TOKEN") {
        // Token 失效，需要重新登录
        console.log("登录已过期，请重新登录");
    } else {
        console.error("发送失败:", error);
    }
}
```

#### 6. 内存管理

```javascript
// 停止客户端时清理资源
function cleanup() {
    client.stopClient();
    // 如果使用了 IndexedDB store
    client.store?.deleteAllData();
}

// 页面卸载时清理
window.addEventListener("beforeunload", cleanup);
```

#### 7. TypeScript 类型支持

```typescript
import {
    MatrixClient,
    Room,
    RoomMember,
    MatrixEvent,
    IContent,
    RoomMessageEventContent,
} from "matrix-js-sdk";

// 类型安全的消息发送
const content: RoomMessageEventContent = {
    body: "Hello, World!",
    msgtype: "m.text",
};

await client.sendMessage(roomId, content);
```

### 常见问题解决

#### Q1: 图片无法加载
**原因**: 服务器要求认证媒体
**解决**: 使用 `useAuthentication: true` 并添加 Authorization 头

#### Q2: 消息发送失败
**原因**: 可能是网络问题或速率限制
**解决**: SDK 会自动重试，检查错误码进行相应处理

#### Q3: 加密消息无法解密
**原因**: 可能是密钥未同步或多实例冲突
**解决**: 确保只有一个 MatrixClient 实例，并正确初始化加密

#### Q4: 同步状态一直是 RECONNECTING
**原因**: 网络问题或服务器不可达
**解决**: 检查网络连接，确认服务器地址正确

---

## 快速开始

### 基本使用

```javascript
import * as sdk from "matrix-js-sdk";

// 创建客户端
const client = sdk.createClient({ baseUrl: "https://matrix.org" });

// 获取公共房间列表
const publicRooms = await client.publicRooms();
console.log("公共房间:", publicRooms);
```

### 登录并启动客户端

```javascript
// 使用用户名密码登录
const loginResponse = await client.login("m.login.password", {
    user: "username",
    password: "password",
});

// 启动客户端同步
await client.startClient({ initialSyncLimit: 10 });
```

### 发送消息

```javascript
const content = {
    body: "消息内容",
    msgtype: "m.text",
};

await client.sendEvent(roomId, "m.room.message", content);
```

### 监听消息

```javascript
client.on(RoomEvent.Timeline, (event, room, toStartOfTimeline) => {
    if (event.getType() !== "m.room.message") return;
    console.log(event.getContent().body);
});
```

---

## SDK 功能概述

该 SDK 提供了围绕 Matrix 客户端-服务器 API 的完整对象模型，并为传入数据和状态变化发出事件。除了封装 HTTP API 外，它还：

- 处理同步（通过 `/sync`）
- 处理"友好"房间和成员名称的生成
- 处理历史 `RoomMember` 信息（如显示名称）
- 管理跨多个事件的房间成员状态（如输入状态、权限级别和成员变更）
- 暴露高级对象如 `Rooms`、`RoomState`、`RoomMembers` 和 `Users`
- 处理消息的"本地回显"
- 标记发送失败的消息
- 自动重试因网络错误或速率限制而失败的请求
- 处理消息队列
- 处理分页
- 处理推送操作分配
- 处理接受邀请时的房间初始同步
- 处理 WebRTC 通话

---

## 支持的平台

- **Node.js**: 确保安装了最新的 LTS 版本
- **浏览器**: 通过 Webpack 或 Vite 等打包工具使用
- **Deno**: 支持但非官方维护 (`import npm:matrix-js-sdk`)

---

## 端到端加密支持

`matrix-js-sdk` 的端到端加密支持基于 Rust [matrix-sdk-crypto](https://github.com/matrix-org/matrix-rust-sdk/tree/main/crates/matrix-sdk-crypto) 库的 [WebAssembly 绑定](https://github.com/matrix-org/matrix-rust-sdk-crypto-wasm)。

### 初始化加密

```javascript
const matrixClient = sdk.createClient({
    baseUrl: "http://localhost:8008",
    accessToken: myAccessToken,
    userId: myUserId,
});

// 初始化以启用端到端加密支持
await matrixClient.initRustCrypto();
```

> **注意**: 默认情况下会尝试使用浏览器提供的 IndexedDB 作为加密存储。如果在浏览器外运行，需要传递 `useIndexedDB: false` 选项。

---

## API 参考

托管的 API 参考文档：http://matrix-org.github.io/matrix-js-sdk/index.html

本地构建文档：

```bash
yarn gendoc
cd docs
python -m http.server 8005
```

然后访问 `http://localhost:8005` 查看 API 文档。

---

## 开发贡献

### 安装依赖

```bash
yarn install
```

### 构建

```bash
yarn build
```

### 运行测试

```bash
yarn test
```

### 代码检查

```bash
yarn lint
```

---

## 最低 Matrix 服务器版本

**v1.1**

Matrix 规范在不断演进 - 虽然此 SDK 旨在实现最大的向后兼容性，但它只保证一个功能至少支持 4 个规范版本。

---

## 许可证

Apache License 2.0

