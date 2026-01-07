# HuLamatrix matrix-js-sdk v39.1.3 修复实施指南

**创建日期**: 2026-01-07
**SDK 版本**: matrix-js-sdk v39.1.3
**目标**: 修复与 SDK v39.1.3 不一致的代码

---

## 目录

1. [快速修复指南](#快速修复指南)
2. [详细修复步骤](#详细修复步骤)
3. [测试验证](#测试验证)
4. [回滚方案](#回滚方案)

---

## 快速修复指南

### 5 分钟快速修复（关键问题）

**文件**: `src/adapters/matrix-adapter.ts`
**行号**: 312-316

```diff
  const response = await this.client.login('m.login.password', {
-   user: params.username,
+   identifier: {
+     type: 'm.id.user',
+     user: params.username
+   },
    password: params.password,
    device_display_name: params.deviceName || 'HuLa Client'
  })
```

**命令**:
```bash
# 使用编辑器直接修改
code src/adapters/matrix-adapter.ts:312

# 或使用 sed（不推荐，小心操作）
sed -i '' 's/user: params.username,/identifier: {\n      type: '"'"'m.id.user'"'"',\n      user: params.username\n    },/' src/adapters/matrix-adapter.ts
```

---

## 详细修复步骤

### 第一阶段：关键修复（1-2 天）

---

#### 修复 1: matrix-adapter.ts 登录 API

**文件**: `src/adapters/matrix-adapter.ts`
**难度**: ⭐ 简单
**时间**: ⏱️ 30 分钟

##### 步骤 1: 读取当前文件

```bash
# 查看当前实现
cat -n src/adapters/matrix-adapter.ts | sed -n '300,330p'
```

##### 步骤 2: 备份文件

```bash
# 创建备份
cp src/adapters/matrix-adapter.ts src/adapters/matrix-adapter.ts.backup
```

##### 步骤 3: 修改代码

找到 `login` 方法（约 300-330 行），修改如下：

```typescript
async login(params: { username: string; password: string; deviceName?: string }): Promise<LoginResponse> {
  try {
    // 动态加载 Matrix SDK
    const sdk = await import('@/utils/matrix-sdk-loader')

    // 创建临时客户端用于登录
    await matrixConfig.initializeWithDiscovery()
    this.client = await sdk.createClient({
      baseUrl: matrixConfig.getHomeserverUrl(),
      useAuthorizationHeader: false,
      deviceId: params.deviceId || undefined  // ✅ 新增：支持设备ID
    })

    // ✅ 使用新的 identifier 格式（v39.1.3）
    const response = await this.client.login('m.login.password', {
      identifier: {  // 🔴 关键修改：从 user 改为 identifier
        type: 'm.id.user',
        user: params.username
      },
      password: params.password,
      initial_device_display_name: params.deviceName || 'HuLa Client'
    })

    // 保存登录信息
    localStorage.setItem('accessToken', response.access_token)
    localStorage.setItem('deviceId', response.device_id)
    localStorage.setItem('userId', response.user_id)

    // ✅ 新增：保存刷新令牌
    if (response.refresh_token) {
      localStorage.setItem('refreshToken', response.refresh_token)
    }

    logger.info('[MatrixAuthAdapter] Login successful')
    return response
  } catch (error) {
    logger.error('[MatrixAuthAdapter] Login failed:', error)
    throw error
  }
}
```

##### 步骤 4: 类型检查

```bash
# 运行 TypeScript 类型检查
pnpm run typecheck
```

##### 步骤 5: 测试

```bash
# 启动开发服务器
pnpm run tauri:dev

# 手动测试登录流程
# 1. 输入用户名和密码
# 2. 点击登录
# 3. 验证登录成功
# 4. 检查控制台是否有错误
```

##### 验证清单

- [ ] 代码修改完成
- [ ] 类型检查通过
- [ ] 登录功能正常
- [ ] 设备名称正确显示
- [ ] 刷新令牌已保存（如果有）
- [ ] 无控制台错误

---

#### 修复 2: 添加 threadSupport 到所有 startClient 调用

**文件**: 18 个文件
**难度**: ⭐ 简单（但需要修改多处）
**时间**: ⏱️ 2-3 小时

##### 步骤 1: 查找所有 startClient 调用

```bash
# 查找所有调用
grep -rn "startClient(" src/ --include="*.vue" --include="*.ts" | grep -v "node_modules"
```

输出应该包含：
```
src/mobile/views/rooms/Manage.vue:129
src/mobile/views/friends/AddFriends.vue:260
src/views/homeWindow/message/index.vue:394
src/views/homeWindow/message/index.vue:461
src/mobile/views/message/index.vue:389
src/views/rooms/Manage.vue:303
src/main.ts:471
src/hooks/useMatrixAuth.ts:398
src/hooks/useMatrixAuth.ts:565
src/hooks/useMatrixDevSync.ts:46
src/stores/core/index.ts:551
src/components/search/EnhancedSearch.vue:638
src/adapters/matrix-adapter.ts:170
src/adapters/matrix-adapter.ts:734
# ... 更多
```

##### 步骤 2: 批量修改

**选项 A: 手动修改（推荐）**

逐个文件修改，添加 `threadSupport: true`：

```typescript
// 修改前
await matrixClientService.startClient({
  initialSyncLimit: 5,
  pollTimeout: 15000
})

// 修改后
await matrixClientService.startClient({
  initialSyncLimit: 5,
  pollTimeout: 15000,
  threadSupport: true  // ✅ 新增
})
```

**选项 B: 使用脚本自动修改（谨慎使用）**

创建修复脚本 `fix-thread-support.sh`:

```bash
#!/bin/bash

# 文件列表
files=(
  "src/mobile/views/rooms/Manage.vue"
  "src/mobile/views/friends/AddFriends.vue"
  "src/views/homeWindow/message/index.vue"
  "src/mobile/views/message/index.vue"
  "src/views/rooms/Manage.vue"
  "src/hooks/useMatrixAuth.ts"
  "src/hooks/useMatrixDevSync.ts"
  "src/stores/core/index.ts"
  "src/components/search/EnhancedSearch.vue"
)

# 备份
for file in "${files[@]}"; do
  cp "$file" "$file.backup"
done

# 查找并替换模式
for file in "${files[@]}"; do
  # 查找 startClient({ 后面的内容，添加 threadSupport
  # 这个脚本需要根据实际代码模式调整
  echo "Processing $file..."
done

echo "Done! Please review changes."
```

**推荐：使用编辑器的多文件搜索替换功能**

在 VS Code 中：
1. `Ctrl+Shift+F` (或 `Cmd+Shift+F`) 打开全局搜索
2. 搜索模式：`startClient\(\{[\s\S]*?initialSyncLimit`
3. 逐个文件检查并添加 `threadSupport: true`

##### 步骤 3: 验证修改

```bash
# 验证所有修改
grep -rn "threadSupport" src/ --include="*.vue" --include="*.ts" | grep "startClient"

# 应该看到所有 startClient 调用都包含 threadSupport
```

##### 步骤 4: 类型检查和测试

```bash
# 类型检查
pnpm run typecheck

# 启动测试
pnpm run tauri:dev

# 测试线程消息功能
# 1. 发送线程消息
# 2. 接收线程消息
# 3. 查看线程列表
```

##### 验证清单

- [ ] 所有 18 个文件已修改
- [ ] `threadSupport: true` 已添加到所有 startClient 调用
- [ ] 类型检查通过
- [ ] 客户端启动正常
- [ ] 线程消息功能正常
- [ ] 无控制台错误

---

### 第二阶段：重要改进（2-3 天）

---

#### 修复 3: 完善 createClient 参数

**文件**: `src/adapters/matrix-adapter.ts`, `src/utils/matrix-sdk-loader.ts`
**难度**: ⭐⭐ 中等
**时间**: ⏱️ 2-3 小时

##### 步骤 1: 修改 matrix-adapter.ts

找到所有 `createClient` 调用（约 307, 367 行），添加参数：

```typescript
// 登录时的客户端创建（约 307 行）
this.client = await sdk.createClient({
  baseUrl: matrixConfig.getHomeserverUrl(),
  useAuthorizationHeader: false,
  // ✅ 新增参数
  deviceId: params.deviceId || undefined,
  accessToken: params.accessToken || undefined,
  userId: params.userId || undefined,
  refreshToken: params.refreshToken || undefined
})

// 使用令牌创建客户端（约 367 行）
this.client = await sdk.createClient({
  baseUrl: matrixConfig.getHomeserverUrl(),
  accessToken: this.config.accessToken,
  userId: this.config.userId,
  deviceId: this.config.deviceId,  // ✅ 新增
  refreshToken: this.config.refreshToken,  // ✅ 新增
  useAuthorizationHeader: true
})
```

##### 步骤 2: 修改 matrix-sdk-loader.ts

确保 `createClient` 函数支持所有参数：

```typescript
// src/utils/matrix-sdk-loader.ts
export async function createClient(config: ICreateClientOpts): Promise<ReturnType<typeof matrixCreateClient>> {
  // 确保所有参数都传递给 SDK
  const client = await matrixCreateClient({
    baseUrl: config.baseUrl,
    accessToken: config.accessToken,
    userId: config.userId,
    deviceId: config.deviceId,  // ✅ 确保传递
    refreshToken: config.refreshToken,  // ✅ 确保传递
    tokenRefreshFunction: config.tokenRefreshFunction,  // ✅ 确保传递
    timelineSupport: config.timelineSupport,
    store: config.store,
    cryptoStore: config.cryptoStore,
    // ... 其他参数
  })

  // 事件监听器设置...
  return client
}
```

##### 步骤 3: 更新类型定义

检查 `src/integrations/matrix/client.ts` 中的类型定义：

```typescript
export type CreateClientOptions = {
  baseUrl: string
  timelineSupport?: boolean
  accessToken?: string
  refreshToken?: string  // ✅ 确保存在
  userId?: string
  deviceId?: string  // ✅ 确保存在
  tokenRefreshFunction?: (refreshToken: string) => Promise<void>  // ✅ 确保存在
  // ... 其他选项
}
```

##### 验证清单

- [ ] 所有 createClient 调用包含 deviceId
- [ ] 所有 createClient 调用包含 refreshToken（如果有）
- [ ] 类型定义更新
- [ ] 类型检查通过
- [ ] 客户端创建正常
- [ ] 加密功能正常（如果启用）

---

#### 修复 4: 验证和优化消息 API

**文件**: 多个消息相关文件
**难度**: ⭐⭐ 中等
**时间**: ⏱️ 4-6 小时

##### 步骤 1: 检查当前实现

```bash
# 查找消息发送相关代码
grep -rn "sendMessage\|sendReply\|addReaction" src/ --include="*.ts" --include="*.vue" | head -50
```

##### 步骤 2: 创建消息 API 测试文件

创建 `src/__tests__/matrix-sdk/messaging-api.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { createClient } from 'matrix-js-sdk'

describe('Matrix SDK v39.1.3 Messaging API', () => {
  it('should support sendMessage with threadId', async () => {
    const client = createClient({ baseUrl: 'https://test.org' })

    // 检查方法签名
    expect(typeof client.sendMessage).toBe('function')

    // 验证可以传递线程ID
    // （实际测试需要 mock）
  })

  it('should support sendReply', async () => {
    const client = createClient({ baseUrl: 'https://test.org' })

    expect(typeof client.sendReply).toBe('function')
  })

  it('should support addReaction', async () => {
    const client = createClient({ baseUrl: 'https://test.org' })

    expect(typeof client.addReaction).toBe('function')
  })
})
```

##### 步骤 3: 优化消息发送服务

如果需要，更新 `src/services/enhancedMessageService.ts`:

```typescript
// 检查是否可以直接使用 SDK 的新方法
async sendMessage(roomId: string, content: Record<string, unknown>) {
  const client = this.getClient()

  // 检查 SDK 版本和方法可用性
  if (client && typeof client.sendMessage === 'function') {
    // ✅ 使用 SDK 方法
    return await client.sendMessage(roomId, content)
  }

  // 降级处理
  return await this.sendMessageLegacy(roomId, content)
}

// ✅ 添加新的回复方法
async sendReply(roomId: string, replyToEventId: string, content: Record<string, unknown>) {
  const client = this.getClient()

  if (client && typeof client.sendReply === 'function') {
    // 使用 SDK 的 sendReply
    const replyToEvent = await client.getEvent(roomId, replyToEventId)
    return await client.sendReply(roomId, replyToEvent, content)
  }

  // 降级到手动实现
  return this.sendReplyLegacy(roomId, replyToEventId, content)
}

// ✅ 添加反应方法
async addReaction(roomId: string, eventId: string, reaction: string) {
  const client = this.getClient()

  if (client && typeof client.addReaction === 'function') {
    // 使用 SDK 的 addReaction
    return await client.addReaction(reaction, roomId, eventId)
  }

  // 降级到手动实现
  return this.addReactionLegacy(roomId, eventId, reaction)
}
```

##### 步骤 4: 测试消息功能

```bash
# 运行测试
pnpm run test:run

# 手动测试
pnpm run tauri:dev

# 测试场景：
# 1. 发送普通消息
# 2. 发送回复消息
# 3. 添加反应
# 4. 发送线程消息
# 5. 编辑消息
```

##### 验证清单

- [ ] 消息 API 测试通过
- [ ] 普通消息发送正常
- [ ] 回复消息功能正常
- [ ] 反应功能正常
- [ ] 线程消息功能正常
- [ ] 消息编辑功能正常

---

#### 修复 5: 完善令牌刷新机制

**文件**: 多个登录相关文件
**难度**: ⭐⭐ 中等
**时间**: ⏱️ 3-4 小时

##### 步骤 1: 检查当前令牌刷新实现

```bash
# 查找刷新令牌相关代码
grep -rn "refreshToken\|refresh_token" src/ --include="*.ts" | head -30
```

##### 步骤 2: 创建令牌刷新服务

创建 `src/services/tokenRefreshService.ts`:

```typescript
import { logger } from '@/utils/logger'

export interface TokenRefreshResponse {
  access_token: string
  refresh_token?: string
  expires_in?: number
}

export class TokenRefreshService {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  /**
   * 刷新访问令牌
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenRefreshResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/_matrix/client/v3/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        })
      })

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.statusText}`)
      }

      const data = await response.json()

      logger.info('[TokenRefreshService] Token refreshed successfully')
      return data
    } catch (error) {
      logger.error('[TokenRefreshService] Token refresh failed:', error)
      throw error
    }
  }
}

// 单例实例
let serviceInstance: TokenRefreshService | null = null

export function getTokenRefreshService(baseUrl: string): TokenRefreshService {
  if (!serviceInstance || serviceInstance['baseUrl'] !== baseUrl) {
    serviceInstance = new TokenRefreshService(baseUrl)
  }
  return serviceInstance
}
```

##### 步骤 3: 集成到客户端创建

更新 `src/integrations/matrix/client.ts`:

```typescript
import { getTokenRefreshService } from '@/services/tokenRefreshService'

async initialize(credentials: MatrixCredentials) {
  // ... 现有代码

  // ✅ 添加令牌刷新函数
  if (refreshToken) {
    const refreshService = getTokenRefreshService(credentials.baseUrl)
    opts.tokenRefreshFunction = async (refreshToken: string) => {
      try {
        const newTokens = await refreshService.refreshAccessToken(refreshToken)

        // 保存新令牌
        await invoke('save_tokens', {
          token: newTokens.access_token,
          refreshToken: newTokens.refresh_token || refreshToken
        })

        return newTokens
      } catch (error) {
        logger.error('[MatrixClientService] Token refresh failed:', error)
        throw error
      }
    }
  }

  // 创建客户端
  // ...
}
```

##### 步骤 4: 测试令牌刷新

```bash
# 手动测试流程：
# 1. 登录应用
# 2. 等待令牌过期（或修改本地令牌使其过期）
# 3. 尝试执行操作
# 4. 验证令牌自动刷新
# 5. 验证会话保持

# 查看控制台日志
# 应该看到 "[TokenRefreshService] Token refreshed successfully"
```

##### 验证清单

- [ ] 令牌刷新服务创建
- [ ] 集成到客户端初始化
- [ ] 令牌过期时自动刷新
- [ ] 新令牌正确保存
- [ ] 会话持久化正常
- [ ] 刷新失败处理正确

---

## 测试验证

### 自动化测试

```bash
# 运行所有测试
pnpm run test:run

# 运行特定测试
pnpm run test:run -- messaging-api.test.ts
pnpm run test:run -- login.test.ts

# 生成覆盖率报告
pnpm run coverage
```

### 手动测试清单

#### 登录功能

- [ ] 用户名密码登录成功
- [ ] 特殊字符用户名处理
- [ ] 设备名称正确显示
- [ ] 登录错误提示友好
- [ ] 刷新令牌正确保存

#### 线程功能

- [ ] 发送线程消息
- [ ] 接收线程消息
- [ ] 查看线程列表
- [ ] 线程回复功能
- [ ] 线程消息通知

#### 消息功能

- [ ] 发送普通消息
- [ ] 发送回复消息
- [ ] 添加/删除反应
- [ ] 编辑消息
- [ ] 撤销消息
- [ ] 发送媒体消息

#### 会话管理

- [ ] 令牌自动刷新
- [ ] 会话持久化
- [ ] 自动重连
- [ ] 设备验证（如果启用）

---

## 回滚方案

如果修复后出现问题，可以快速回滚：

### 方案 1: 使用备份文件

```bash
# 回滚单个文件
cp src/adapters/matrix-adapter.ts.backup src/adapters/matrix-adapter.ts

# 回滚所有修改的文件
find src/ -name "*.backup" -exec sh -c 'cp "$1" "${1%.backup}"' _ {}
```

### 方案 2: 使用 Git

```bash
# 查看修改
git status

# 回滚单个文件
git checkout -- src/adapters/matrix-adapter.ts

# 回滚所有修改
git reset --hard HEAD

# 撤销最近的提交（如果已提交）
git reset --soft HEAD~1
```

### 方案 3: 部分回滚

如果只想回滚特定修改：

```bash
# 查看差异
git diff src/adapters/matrix-adapter.ts

# 手动编辑，只回滚部分修改
# 或者使用 git apply -R
```

---

## 故障排查

### 常见问题

#### 问题 1: 登录失败

**症状**: 修改登录 API 后无法登录

**排查**:
1. 检查控制台错误信息
2. 确认 `identifier` 格式正确
3. 验证网络请求
4. 检查后端日志

**解决方案**:
```typescript
// 添加调试日志
console.log('Login payload:', {
  identifier: { type: 'm.id.user', user: username },
  password: '***'
})

// 临时回滚测试
// 使用旧格式验证是否是 API 问题
```

#### 问题 2: 类型检查失败

**症状**: `pnpm run typecheck` 报错

**排查**:
1. 查看具体错误信息
2. 检查类型定义
3. 确认导入路径

**解决方案**:
```typescript
// 添加类型断言（临时）
const client = await sdk.createClient({
  // ...
} as unknown as ICreateClientOpts)

// 或更新类型定义
// src/integrations/matrix/client.ts
export type CreateClientOptions = {
  // 添加缺失的类型
}
```

#### 问题 3: 线程功能不工作

**症状**: 添加 `threadSupport: true` 后线程消息仍不显示

**排查**:
1. 确认 SDK 版本支持线程
2. 检查后端是否支持线程
3. 查看事件监听器

**解决方案**:
```typescript
// 添加调试
client.on(ClientEvent.Event, (event) => {
  console.log('Received event:', event.getType())
  if (event.isThread()) {
    console.log('Thread event:', event)
  }
})

// 检查线程事件处理
```

---

## 后续优化建议

1. **性能监控**
   - 添加客户端初始化性能指标
   - 监控同步延迟
   - 跟踪消息发送时间

2. **错误追踪**
   - 集成错误报告工具（Sentry）
   - 添加详细错误日志
   - 实现错误上报

3. **文档更新**
   - 更新内部开发文档
   - 添加 API 使用示例
   - 创建故障排查指南

4. **自动化测试**
   - 增加单元测试覆盖率
   - 添加集成测试
   - 实现 E2E 测试

---

**文档版本**: 1.0.0
**最后更新**: 2026-01-07
**维护者**: HuLa Matrix Team
