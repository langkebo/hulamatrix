# SDK 集成最佳实践

本指南基于 `matrix-js-sdk` (HuLa 定制版) 编写，旨在规范前端项目对 SDK 的调用方式。

## 1. 依赖配置
推荐使用 `pnpm workspace` 进行管理，确保本地开发的 SDK 变更能即时反映在前端项目中。

```json
// package.json
{
  "dependencies": {
    "matrix-js-sdk": "workspace:*"
  }
}
```

## 2. 客户端初始化
始终通过 `MatrixClientService` 单例访问 SDK，禁止在组件中私自实例化 Client。

```typescript
import MatrixClientService from '@/services/matrix/MatrixClientService';

// 获取实例
const matrixService = MatrixClientService.getInstance();
const client = matrixService.getClient();

if (!client) {
  throw new Error('Matrix Client not initialized');
}
```

## 3. 批量数据获取 (Batch API)
为提升性能，获取好友列表或详情时，**严禁**使用循环并发请求。必须使用定制的批量接口。

### ❌ 错误示范
```typescript
const friends = ['@user1:server', '@user2:server'];
// 导致 N 个 HTTP 请求
await Promise.all(friends.map(id => client.getProfileInfo(id)));
```

### ✅ 正确示范
使用 `SynapseEnhancedClient` 提供的 `getFriendsBatch` 能力（需确保 SDK 已升级且后端支持）。

```typescript
// 假设 SDK 已封装此方法在 enhanced 模块中
const friendManager = matrixService.getFriendSystemManager();
if (friendManager) {
  // 单次 HTTP 请求获取所有数据
  const profiles = await friendManager.getFriendsBatch(); 
  console.log(profiles);
}
```

## 4. 错误处理规范
所有 SDK 调用应包裹在 `try-catch` 块中，并统一处理网络异常与协议错误。

```typescript
import { MatrixError } from 'matrix-js-sdk';

try {
  await client.joinRoom(roomId);
} catch (error) {
  if (error instanceof MatrixError) {
    if (error.errcode === 'M_FORBIDDEN') {
      // 处理无权限
    } else if (error.errcode === 'M_LIMIT_EXCEEDED') {
      // 处理速率限制
    }
  }
  console.error('SDK Operation Failed:', error);
}
```

## 5. 状态同步与事件监听
*   **挂载**: 在组件 `onMounted` 中注册 `client.on` 监听器。
*   **卸载**: 务必在 `onUnmounted` 中调用 `client.removeListener`，防止内存泄漏。

```typescript
import { onMounted, onUnmounted } from 'vue';
import { ClientEvent } from 'matrix-js-sdk';

const onMessage = (event) => {
  // Handle new message
};

onMounted(() => {
  const client = MatrixClientService.getInstance().getClient();
  client?.on(ClientEvent.Event, onMessage);
});

onUnmounted(() => {
  const client = MatrixClientService.getInstance().getClient();
  client?.removeListener(ClientEvent.Event, onMessage);
});
```
