# Matrix Friends SDK 配置指南

> **后端服务器端口**: 443 (标准 HTTPS 端口)
> **更新时间**: 2026-01-06

---

## 生产环境配置

### 服务器信息

- **服务器地址**: `https://matrix.cjystx.top:443`
- **服务器名称**: `cjystx.top`
- **端口**: 443 (标准 HTTPS)
- **协议**: HTTPS

### 环境变量配置

在 `.env.production` 文件中添加：

```bash
# Matrix 服务器配置
VITE_MATRIX_BASE_URL=https://matrix.cjystx.top:443
VITE_MATRIX_SERVER_NAME=cjystx.top
VITE_MATRIX_FRIENDS_API_BASE_URL=https://matrix.cjystx.top:443

# 开关配置
VITE_MATRIX_ENABLED=on
VITE_SYNAPSE_FRIENDS_ENABLED=on
VITE_MATRIX_ROOMS_ENABLED=on
```

---

## 开发环境配置

### 本地开发（通过代理）

在 `.env.development` 文件中添加：

```bash
# 开发环境使用代理路径（通过 Vite 代理到 443 端口）
VITE_MATRIX_BASE_URL=/_matrix
VITE_MATRIX_SERVER_NAME=cjystx.top
VITE_SYNAPSE_FRIENDS_ENABLED=on
```

### Vite 代理配置

在 `vite.config.ts` 中配置代理：

```typescript
export default defineConfig({
  server: {
    proxy: {
      // Matrix 标准 API 代理
      '/_matrix': {
        target: 'https://matrix.cjystx.top:443',
        changeOrigin: true,
        rewrite: (path) => path,
        secure: true,
      },
      // Synapse 扩展 API 代理
      '/_synapse': {
        target: 'https://matrix.cjystx.top:443',
        changeOrigin: true,
        rewrite: (path) => path,
        secure: true,
      },
    },
  },
});
```

---

## 使用示例

### 1. 创建增强客户端

```typescript
import { createClientFromToken } from '@/sdk/matrix-friends';

async function initializeClient() {
  const client = await createClientFromToken(
    'https://matrix.cjystx.top:443',
    'syt_xxxxxxxxxxxxx',
    '@user:cjystx.top'
  );

  return client;
}
```

### 2. 使用 Friends API

```typescript
// 获取好友列表
const { friends } = await client.friends.list();

// 发送好友请求
const { request_id } = await client.friends.sendRequest('@friend:cjystx.top', {
  message: '添加好友'
});

// 获取待处理请求
const { requests } = await client.friends.listPendingRequests();

// 接受好友请求
const { dm_room_id } = await client.friends.acceptRequest(request_id);

// 获取统计信息
const { stats } = await client.friends.getStats();
```

### 3. 集成到现有服务

```typescript
import { extendMatrixClient } from '@/sdk/matrix-friends';
import { matrixClientService } from '@/integrations/matrix/client';

// 扩展现有客户端
const baseClient = matrixClientService.getClient();
if (baseClient && !isFriendsApiEnabled(baseClient)) {
  extendMatrixClient(baseClient);
}

// 现在可以使用 friends API
const friends = await baseClient.friends.list();
```

---

## 端口说明

### 为什么使用 443 端口？

1. **标准 HTTPS 端口**: 443 是 HTTPS 的标准端口，不需要在 URL 中显式指定
2. **防火墙友好**: 大多数防火墙默认允许 443 端口流量
3. **简化配置**: 不需要额外配置非标准端口

### URL 格式

```
# 使用 443 端口（推荐，可以省略端口号）
https://matrix.cjystx.top

# 明确指定 443 端口（等价于上面）
https://matrix.cjystx.top:443

# ⚠️ 错误：不要使用 8443
# https://matrix.cjystx.top:8443
```

---

## 测试

### 运行测试

```bash
# 安装依赖
pnpm install

# 运行 Friends SDK 测试
pnpm run test:run src/sdk/matrix-friends/__tests__/

# 运行测试并生成覆盖率报告
pnpm run coverage src/sdk/matrix-friends/__tests__/
```

---

## 故障排除

### 问题 1: 连接失败

**错误**: `Failed to fetch` 或 `Network Error`

**解决方案**:
1. 检查服务器地址是否正确: `https://matrix.cjystx.top:443`
2. 确认网络可以访问服务器
3. 检查防火墙设置

### 问题 2: 401 Unauthorized

**错误**: `M_MISSING_TOKEN` 或 `M_UNKNOWN_TOKEN`

**解决方案**:
1. 确认 access_token 有效
2. 重新登录获取新 token
3. 检查 Authorization 头是否正确设置

### 问题 3: 404 Not Found

**错误**: Friends API 返回 404

**解决方案**:
1. 确认后端已部署 Friends API 扩展
2. 检查路径是否正确: `/_synapse/client/enhanced/friends/v2/*`
3. 联系管理员确认服务器配置

---

## API 端点列表

### 查询类 API

| 端点 | 方法 | 描述 |
|------|------|------|
| `/_synapse/client/enhanced/friends/v2/list` | GET | 获取好友列表 |
| `/_synapse/client/enhanced/friends/v2/categories` | GET | 获取分组列表 |
| `/_synapse/client/enhanced/friends/v2/stats` | GET | 获取统计信息 |
| `/_synapse/client/enhanced/friends/v2/blocked` | GET | 获取黑名单 |
| `/_synapse/client/enhanced/friends/v2/search` | GET | 搜索好友 |
| `/_synapse/client/enhanced/friends/v2/requests/pending` | GET | 获取待处理请求 |

### 操作类 API

| 端点 | 方法 | 描述 |
|------|------|------|
| `/_synapse/client/enhanced/friends/v2/request` | POST | 发送好友请求 |
| `/_synapse/client/enhanced/friends/v2/request/accept` | POST | 接受好友请求 |
| `/_synapse/client/enhanced/friends/v2/request/reject` | POST | 拒绝好友请求 |
| `/_synapse/client/enhanced/friends/v2/remove` | POST | 删除好友 |
| `/_synapse/client/enhanced/friends/v2/categories` | POST | 创建分组 |
| `/_synapse/client/enhanced/friends/v2/categories/delete` | POST | 删除分组 |
| `/_synapse/client/enhanced/friends/v2/remark` | POST | 设置备注 |
| `/_synapse/client/enhanced/friends/v2/block` | POST | 拉黑用户 |
| `/_synapse/client/enhanced/friends/v2/unblock` | POST | 取消拉黑 |
