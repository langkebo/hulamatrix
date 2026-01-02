# Matrix JS SDK 39.1.3 完整功能参考

> 为 HuLamatrix 项目开发优化使用

## 概述

本文档详细介绍了 `matrix-js-sdk-39.1.3` 的所有功能，包括完整的 API 参考和实用示例代码。Matrix JS SDK 是 Matrix 协议的官方 JavaScript/TypeScript 客户端 SDK，支持浏览器和 Node.js 环境。

## 官方资源

- **Matrix 官网**: https://matrix.org
- **SDK 仓库**: https://github.com/matrix-org/matrix-js-sdk
- **API 文档**: https://matrix-org.github.io/matrix-js-sdk/
- **Matrix 规范**: https://spec.matrix.org/

## SDK 特性

### 核心功能
- ✅ 完整的 Matrix Client-Server API 实现
- ✅ 端到端加密 (E2EE) 支持
- ✅ WebRTC 音视频通话
- ✅ 实时同步 (Sliding Sync)
- ✅ 推送通知支持
- ✅ 设备管理
- ✅ 房间和消息管理
- ✅ 用户和成员管理
- ✅ 搜索功能
- ✅ 在线状态和输入提示
- ✅ 文件和媒体处理
- ✅ 群组和空间支持

### 企业功能
- ✅ 朋友管理系统
- ✅ 私密聊天
- ✅ 语音消息
- ✅ 安全控制
- ✅ 隐私管理
- ✅ 反馈系统
- ✅ 管理员功能

## 文档结构

### 基础功能
- [01. 客户端基础](./01-client-basics.md) ✅ - 初始化、配置、启动客户端
- [02. 用户认证](./02-authentication.md) ✅ - 登录、注册、登出
- [03. 房间管理](./03-room-management.md) ✅ - 创建、加入、管理房间
- [04. 消息功能](./04-messaging.md) ✅ - 发送、接收、处理消息
- [05. 事件处理](./05-events-handling.md) ✅ - 监听和处理事件

### 高级功能
- [06. 加密功能](./06-encryption.md) ✅ - E2EE 加密、密钥管理、设备验证
- [07. WebRTC 通话](./07-webrtc-calling.md) ✅ - 音视频通话、群组通话、屏幕共享
- [08. 在线状态](./08-presence-typing.md) ✅ - 在线状态、输入提示、已读回执
- [09. 媒体文件](./09-media-files.md) ✅ - 上传、下载、处理媒体文件 (含 IndexedDB 缓存)
- [10. 搜索功能](./10-search.md) ✅ - 搜索消息、用户、房间

### 企业功能
- [11. 好友系统](./11-friends-system.md) ✅ - 好友管理、好友请求、好友分类
- [12. 私密聊天](./12-private-chat.md) ✅ - 阅后即焚、临时会话、私密消息
- [15. 企业功能](./15-enterprise-features.md) ✅ - 企业功能完整参考

### 验证报告
- [01. 客户端基础验证](./01-client-basics-VERIFICATION.md) ✅ - 100% 完成
- [02. 用户认证验证](./02-authentication-VERIFICATION.md) ✅ - 95% 完成
- [03. 房间管理验证](./03-room-management-VERIFICATION.md) ✅ - 95% 完成
- [04. 消息功能验证](./04-messaging-VERIFICATION.md) ✅ - 98% 完成
- [05. 事件处理验证](./05-events-handling-VERIFICATION.md) ✅ - 95% 完成
- [06. 加密功能验证](./06-encryption-VERIFICATION.md) ✅ - 95% 完成
- [07. WebRTC 通话验证](./07-webrtc-calling-VERIFICATION.md) ✅ - 100% 完成
- [08. 在线状态验证](./08-presence-typing-VERIFICATION.md) ✅ - 100% 完成
- [09. 媒体文件验证](./09-media-files-VERIFICATION.md) ✅ - 100% 完成
- [10. 搜索功能验证](./10-search-VERIFICATION.md) ✅ - 100% 完成
- [11. 好友系统验证](./11-friends-system-VERIFICATION.md) ✅ - 100% 完成
- [12. 私密聊天验证](./12-private-chat-VERIFICATION.md) ✅ - 95% 完成
- [15. 企业功能验证](./15-enterprise-features-VERIFICATION.md) ✅ - 100% 完成

### 项目状态
- [项目状态与任务清单](./PROJECT_STATUS_AND_TASKS.md) 📋 - 未解决问题和任务清单

> **注意**: 验证报告显示了各模块在 HuLaMatrix 项目中的实际实现状态。

## 快速开始

### 安装

```bash
# 使用 npm
npm install matrix-js-sdk

# 使用 yarn
yarn add matrix-js-sdk

# 使用 pnpm
pnpm add matrix-js-sdk
```

### 基本使用

```typescript
import * as sdk from "matrix-js-sdk";

// 创建客户端
const client = sdk.createClient({
  baseUrl: "https://cjystx.top",
  accessToken: "your_access_token",
  userId: "@user:cjystx.top"
});

// 启动客户端
await client.startClient();

// 监听消息事件
client.on(sdk.RoomEvent.Timeline, (event, room) => {
  if (event.getType() === "m.room.message") {
    console.log(`(${room.name}) ${event.getSender()}: ${event.getContent().body}`);
  }
});

// 发送消息
await client.sendMessage("!roomId:server", {
  msgtype: "m.text",
  body: "Hello, World!"
});
```

### 启用加密

```typescript
const client = sdk.createClient({
  baseUrl: "https://matrix.org",
  accessToken: "your_access_token",
  userId: "@user:matrix.org"
});

// 初始化加密
await client.initRustCrypto();

// 启动客户端
await client.startClient();
```

## SDK 架构

```
matrix-js-sdk-39.1.3/
├── src/
│   ├── client.ts              # 核心客户端
│   ├── matrix.ts              # 主要入口点
│   ├── http-api/              # HTTP API 封装
│   ├── crypto-api/            # 加密 API
│   ├── models/                # 数据模型
│   ├── webrtc/                # WebRTC 通话
│   ├── matrixrtc/             # MatrixRTC
│   ├── store/                 # 存储后端
│   ├── sync.ts                # 同步处理
│   ├── sliding-sync.ts        # Sliding Sync
│   ├── enterprise/            # 企业功能
│   └── utils/                 # 工具函数
```

## 主要类和接口

| 类/接口 | 描述 |
|--------|------|
| `MatrixClient` | 主客户端类，所有功能的核心入口 |
| `Room` | 房间模型，包含房间状态和时间线 |
| `RoomMember` | 房间成员模型 |
| `RoomState` | 房间状态管理 |
| `MatrixEvent` | Matrix 事件模型 |
| `User` | 用户模型 |
| `CryptoApi` | 加密功能接口 |
| `Call` | WebRTC 通话 |
| `GroupCall` | 群组通话 |

## 事件类型

SDK 使用 EventEmitter 模式，支持以下主要事件：

| 事件 | 触发时机 |
|------|----------|
| `ClientEvent.Sync` | 同步状态变化 |
| `RoomEvent.Timeline` | 房间时间线新事件 |
| `RoomEvent.MyMembership` | 当前用户成员状态变化 |
| `RoomEvent.Name` | 房间名称变化 |
| `RoomMemberEvent.Name` | 成员名称变化 |
| `RoomMemberEvent.Typing` | 成员输入状态变化 |
| `CryptoEvent.KeyVerification` | 密钥验证事件 |
| `CallEvent.Invite` | 收到通话邀请 |
| `CallEvent.Hangup` | 通话挂断 |

## 最佳实践

### 1. 错误处理

始终处理可能的错误：

```typescript
try {
  await client.joinRoom("!roomId:server");
} catch (error) {
  if (error.errcode === "M_UNKNOWN_TOKEN") {
    // 处理无效令牌
  } else if (error.errcode === "M_FORBIDDEN") {
    // 处理权限不足
  }
}
```

### 2. 事件监听

正确使用事件监听器：

```typescript
// 添加监听器
const onEvent = (event) => console.log(event);
client.on(sdk.RoomEvent.Timeline, onEvent);

// 移除监听器
client.off(sdk.RoomEvent.Timeline, onEvent);
```

### 3. 资源清理

停止客户端时清理资源：

```typescript
// 停止同步
client.stopClient();

// 清理存储
await client.store.deleteAll();

// 清理加密
await client.getCrypto()?.stop();
```

### 4. 加密最佳实践

```typescript
// 检查房间是否加密
if (client.isRoomEncrypted(roomId)) {
  const crypto = client.getCrypto();
  if (crypto) {
    // 处理加密消息
  }
}

// 验证设备
const crypto = client.getCrypto();
const deviceTrust = await crypto.isDeviceVerified(userId, deviceId);
```

## 浏览器兼容性

| 浏览器 | 版本要求 |
|--------|----------|
| Chrome | 90+ |
| Firefox | 88+ |
| Safari | 14+ |
| Edge | 90+ |

## Node.js 支持

支持 Node.js 16+ LTS 版本。

## 类型定义

SDK 提供完整的 TypeScript 类型定义：

```typescript
import * as sdk from "matrix-js-sdk";

const client: sdk.MatrixClient = sdk.createClient({...});
const room: sdk.Room = client.getRoom("!roomId:server");
const event: sdk.MatrixEvent = room.timeline[0];
```

## 相关资源

- [Matrix 客户端服务器 API](https://spec.matrix.org/v1.12/client-server-api/)
- [Matrix 端到端加密](https://spec.matrix.org/v1.12/client-server-api/#end-to-end-encryption)
- [WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)

## 贡献

如需向 HuLamatrix 项目贡献代码或报告问题，请参考项目 CONTRIBUTING.md。

## 许可证

Matrix JS SDK 使用 Apache 2.0 许可证。

---

**文档版本**: 1.1.0
**SDK 版本**: 39.1.3
**最后更新**: 2025-12-30
**HuLaMatrix 版本**: 3.0.5
