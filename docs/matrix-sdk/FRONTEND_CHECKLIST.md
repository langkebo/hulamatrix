# HuLa 前端 Friends SDK 集成检查清单

> **项目**: HuLa Matrix 前端
> **目标**: 集成 Friends API SDK
> **后端**: https://matrix.cjystx.top:443
> **更新时间**: 2026-01-06

---

## ✅ 已完成工作

### SDK 实现 (100%)
- ✅ `src/sdk/matrix-friends/types.ts` - 类型定义
- ✅ `src/sdk/matrix-friends/utils.ts` - 工具函数
- ✅ `src/sdk/matrix-friends/FriendsApiExtension.ts` - API 实现
- ✅ `src/sdk/matrix-friends/factory.ts` - 工厂函数
- ✅ `src/sdk/matrix-friends/index.ts` - 统一导出
- ✅ 测试文件: 33个测试用例全部通过

### 文档更新
- ✅ `BACKEND_REQUIREMENTS_OPTIMIZED.md` - 更新为 443 端口
- ✅ `MATRIX_SDK_OPTIMIZATION_PLAN.md` - 优化方案
- ✅ `SDK_IMPLEMENTATION_GUIDE.md` - 实现指南
- ✅ `FRONTEND_INTEGRATION_GUIDE.md` - 前端集成指南 (新建)

---

## 📋 前端项目修改清单

### 1. 环境配置修改

#### `.env`
```diff
- VITE_MATRIX_BASE_URL=https://matrix.cjystx.top:8443
+ VITE_MATRIX_BASE_URL=https://matrix.cjystx.top:443
```

#### `.env.production`
```diff
- VITE_MATRIX_BASE_URL=https://matrix.cjystx.top:8443
+ VITE_MATRIX_BASE_URL=https://matrix.cjystx.top:443
```

#### `vite.config.ts`
```diff
export default defineConfig({
  server: {
    proxy: {
      '/_matrix': {
-       target: 'https://matrix.cjystx.top:8443',
+       target: 'https://matrix.cjystx.top:443',
        changeOrigin: true,
+       secure: true,
      },
      '/_synapse': {
-       target: 'https://matrix.cjystx.top:8443',
+       target: 'https://matrix.cjystx.top:443',
        changeOrigin: true,
+       secure: true,
      },
    },
  },
});
```

---

### 2. Matrix 客户端集成

#### `src/integrations/matrix/client.ts`

在文件末尾添加:

```typescript
import { extendMatrixClient, isFriendsApiEnabled } from '@/sdk/matrix-friends';

/**
 * 获取增强的 Matrix 客户端（包含 Friends API）
 */
export function getEnhancedMatrixClient() {
  const client = matrixClientService.getClient();

  if (!client) {
    throw new Error('Matrix client not initialized');
  }

  if (!isFriendsApiEnabled(client)) {
    extendMatrixClient(client);
  }

  return client;
}
```

---

### 3. 创建 Friends Store

#### 创建 `src/stores/friends.ts`

完整的 store 实现，包含:
- State: friends, categories, pendingRequests, stats
- Actions: fetchFriends, sendFriendRequest, acceptFriendRequest 等
- Getters: friendCount, pendingCount 等

**参考**: `FRONTEND_INTEGRATION_GUIDE.md` 第 3.1 节

---

### 4. 创建 Friends 组件

#### 需要创建的组件

1. **`src/components/friends/FriendsList.vue`** - 好友列表
2. **`src/components/friends/AddFriendModal.vue`** - 添加好友弹窗
3. **`src/components/friends/FriendRequestsPanel.vue`** - 好友请求面板
4. **`src/components/friends/FriendCategories.vue`** - 好友分组
5. **`src/components/friends/FriendStats.vue`** - 好友统计

**参考**: `FRONTEND_INTEGRATION_GUIDE.md` 第 3.2 节

---

### 5. 更新现有服务 (可选)

#### `src/services/friendsServiceV2.ts`

**选项 A**: 修改为使用新 SDK
```typescript
import { getEnhancedMatrixClient } from '@/integrations/matrix/client';

class FriendsServiceV2 {
  private get client() {
    return getEnhancedMatrixClient().friends;
  }

  async listFriends() {
    const response = await this.client.list();
    return response.friends;
  }

  // ... 其他方法
}
```

**选项 B**: 保持不变，但标记为 `@deprecated`

---

## 📝 集成步骤

### 第 1 步: 更新配置 (5 分钟)
- [ ] 更新 `.env` 文件
- [ ] 更新 `.env.production` 文件
- [ ] 更新 `vite.config.ts` 文件

### 第 2 步: 集成 SDK (10 分钟)
- [ ] 在 `src/integrations/matrix/client.ts` 添加 `getEnhancedMatrixClient()`
- [ ] 创建 `src/stores/friends.ts`
- [ ] 创建基础 Friends 组件

### 第 3 步: 测试验证 (10 分钟)
- [ ] 运行 `pnpm run typecheck` - 应该无错误
- [ ] 运行 `pnpm run lint` - 应该无错误
- [ ] 运行 `pnpm run test:run src/sdk/matrix-friends/__tests__/` - 应该 33/33 通过

### 第 4 步: UI 开发 (根据需求)
- [ ] 创建好友列表页面
- [ ] 创建添加好友功能
- [ ] 创建好友请求处理
- [ ] 创建好友分组管理

---

## 🧪 测试命令

```bash
# 1. 类型检查
pnpm run typecheck

# 2. ESLint 检查
pnpm run lint

# 3. Friends SDK 测试
pnpm run test:run src/sdk/matrix-friends/__tests__/

# 4. 全量测试
pnpm run test:run
```

---

## 📚 相关文档

| 文档 | 说明 |
|------|------|
| `BACKEND_REQUIREMENTS_OPTIMIZED.md` | 后端需求和配置 (已更新为 443) |
| `MATRIX_SDK_OPTIMIZATION_PLAN.md` | SDK 优化方案 |
| `SDK_IMPLEMENTATION_GUIDE.md` | SDK 实现指南 |
| `FRONTEND_INTEGRATION_GUIDE.md` | 前端集成详细指南 (新建) |
| `src/sdk/matrix-friends/README.md` | SDK 使用说明 |
| `src/sdk/matrix-friends/OPTIMIZATION_REPORT.md` | 优化完成报告 |

---

## ⚠️ 注意事项

### 端口配置
- ✅ **正确**: `https://matrix.cjystx.top:443`
- ❌ **错误**: `https://matrix.cjystx.top:8443`

### SDK 导入
```typescript
// ✅ 正确导入
import { createClientFromToken } from '@/sdk/matrix-friends';

// ❌ 错误导入
import { createClientFromToken } from 'matrix-js-sdk';
```

### 客户端使用
```typescript
// ✅ 正确使用
import { getEnhancedMatrixClient } from '@/integrations/matrix/client';
const client = getEnhancedMatrixClient();
const friends = await client.friends.list();

// ❌ 错误使用
import { matrixClientService } from '@/integrations/matrix/client';
const client = matrixClientService.getClient();
const friends = await client.friends.list(); // friends 可能不存在
```

---

## 🎯 快速开始

### 最小化集成 (5 分钟)

```bash
# 1. 更新 .env
VITE_MATRIX_BASE_URL=https://matrix.cjystx.top:443

# 2. 在组件中使用
import { getEnhancedMatrixClient } from '@/integrations/matrix/client';

const client = getEnhancedMatrixClient();
const { friends } = await client.friends.list();
```

### 完整集成 (30 分钟)

参考 `FRONTEND_INTEGRATION_GUIDE.md` 文档完成:
1. 环境配置更新
2. SDK 集成
3. Store 创建
4. 组件开发
5. 测试验证

---

## 📞 支持

如遇到问题，请参考:
1. `FRONTEND_INTEGRATION_GUIDE.md` - 详细集成指南
2. `src/sdk/matrix-friends/README.md` - SDK 使用说明
3. `src/sdk/matrix-friends/__tests__/` - 测试示例

---

**状态**: ✅ SDK 已完成，前端集成待执行
