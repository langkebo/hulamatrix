# Matrix 服务发现统一和验证

**更新时间**: 2026-01-04
**变更类型**: 重大重构 - 删除自定义实现，统一使用 SDK

---

## 📋 执行摘要

### 主要变更

1. ✅ 删除了两个自定义服务发现实现
2. ✅ 创建了基于 Matrix SDK 的统一服务发现模块
3. ✅ 添加了服务器健康状态验证功能
4. ✅ 更新了所有引用代码
5. ✅ 创建了服务发现测试工具

### 影响范围

- **删除的文件**: 2个
- **新增的文件**: 2个
- **修改的文件**: 4个

---

## 🗑️ 删除的文件

### 1. `src/integrations/matrix/discovery-client.ts` (已删除)

**原因**: 完全自定义的 `DiscoveryMatrixClient` 类，功能重复

**替代方案**: 使用项目中已有的 `matrixClientService`

**功能**:
- 客户端初始化
- 登录管理
- 令牌管理

**迁移**: 所有引用已更新为使用 `matrixClientService`

### 2. `src/services/matrix-discovery.ts` (已删除)

**原因**: 717行的自定义服务发现实现，维护成本高

**替代方案**: `src/integrations/matrix/server-discovery.ts` (基于 Matrix SDK)

**功能**:
- .well-known 配置获取
- 服务发现缓存
- Fallback URL 机制
- 服务器能力验证

**迁移**: 所有引用已更新为使用 `matrixServerDiscovery`

---

## ➕ 新增的文件

### 1. `src/integrations/matrix/server-discovery.ts` (新增)

**功能**: 统一的 Matrix 服务发现模块

**主要特性**:
- ✅ 基于 Matrix SDK 的 `AutoDiscovery` API
- ✅ 服务发现缓存 (5分钟 TTL)
- ✅ 服务器健康状态检查
- ✅ 服务器能力验证
- ✅ 超时控制 (默认10秒)
- ✅ 单例模式

**主要类**:
```typescript
export class MatrixServerDiscovery {
  async discover(serverName: string, options?: DiscoveryOptions): Promise<DiscoveryResult>
  async checkServerHealth(homeserverUrl: string): Promise<ServerHealthStatus>
  async validateServerCapabilities(homeserverUrl: string): Promise<ValidationResult>
  clearCache(serverName?: string): void
  setCacheTTL(ttl: number): void
}
```

**导出**:
```typescript
export const matrixServerDiscovery = MatrixServerDiscovery.getInstance()
export async function discoverMatrixServer(serverName: string, options?: DiscoveryOptions)
export async function checkServerHealth(homeserverUrl: string)
export async function validateServerCapabilities(homeserverUrl: string)
```

### 2. `src/utils/server-validator.ts` (新增)

**功能**: Matrix 服务器验证工具

**主要特性**:
- ✅ 服务器配置验证
- ✅ 连接测试
- ✅ 批量验证
- ✅ 在线状态检查
- ✅ 版本信息获取

**主要类**:
```typescript
export class MatrixServerValidator {
  async validate(serverName: string): Promise<ValidationResult>
  async testConnection(serverName: string, timeout?: number): Promise<ConnectionTestResult>
  async validateBatch(serverNames: string[]): Promise<ValidationResult[]>
  async isOnline(serverName: string): Promise<boolean>
  async getServerVersion(serverName: string): Promise<string | null>
}
```

**导出**:
```typescript
export const matrixServerValidator = new MatrixServerValidator()
export async function validateMatrixServer(serverName: string)
export async function testServerConnection(serverName: string, timeout?: number)
export async function isServerOnline(serverName: string)
```

---

## 📝 修改的文件

### 1. `src/config/matrix-config.ts`

**变更**:
```typescript
// 旧
import { matrixDiscovery, type DiscoveryResult } from '@/services/matrix-discovery'

// 新
import { matrixServerDiscovery, type DiscoveryResult } from '@/integrations/matrix/server-discovery'
```

**更新调用**:
```typescript
// 旧
this.currentDiscovery = await matrixDiscovery.discoverServices(targetServer)
matrixDiscovery.clearCache()

// 新
const discovery = await matrixServerDiscovery.discover(targetServer)
this.currentDiscovery = discovery
matrixServerDiscovery.clearCache()
```

### 2. `src/adapters/architecture-manager.ts`

**变更**:
```typescript
// 旧
import { matrixDiscovery } from '@/services/matrix-discovery'
const discovery = await matrixDiscovery.discoverDefaultServer()

// 新
import { matrixServerDiscovery } from '@/integrations/matrix/server-discovery'
const defaultServer = String(env.VITE_MATRIX_SERVER_NAME || 'cjystx.top').trim()
const discovery = await matrixServerDiscovery.discover(defaultServer)
```

### 3. `src/stores/group.ts`

**变更**:
```typescript
// 旧
import { discoveryMatrixClient } from '@/integrations/matrix/discovery-client'
const client = discoveryMatrixClient.getClient()

// 新
import { matrixClientService } from '@/integrations/matrix/client'
const client = matrixClientService.getClient()
```

**原因**: `discoveryMatrixClient` 是重复实现，项目中已有统一的 `matrixClientService`

### 4. `src/utils/test-discovery.ts`

**变更**:
```typescript
// 旧
import { matrixDiscovery, type DiscoveryResult } from '@/services/matrix-discovery'
const result = await matrixDiscovery.discoverServices(serverName)

// 新
import { matrixServerDiscovery, type DiscoveryResult } from '@/integrations/matrix/server-discovery'
const result = await matrixServerDiscovery.discover(serverName)
```

---

## 🔍 API 变更对照表

### 服务发现

| 旧 API | 新 API | 说明 |
|--------|--------|------|
| `matrixDiscovery.discoverServices(serverName)` | `matrixServerDiscovery.discover(serverName)` | 方法名简化 |
| `matrixDiscovery.discoverDefaultServer()` | `matrixServerDiscovery.discover(serverName)` | 需要手动传入默认服务器名 |
| `matrixDiscovery.clearCache(serverName?)` | `matrixServerDiscovery.clearCache(serverName?)` | 相同 |
| `matrixDiscovery.validateServer(homeserverUrl)` | `matrixServerDiscovery.validateServerCapabilities(homeserverUrl)` | 方法名更明确 |

### 服务器验证

| 功能 | API |
|------|-----|
| 验证服务器 | `validateMatrixServer(serverName)` |
| 测试连接 | `testServerConnection(serverName, timeout?)` |
| 检查在线状态 | `isServerOnline(serverName)` |
| 获取版本 | `matrixServerValidator.getServerVersion(serverName)` |

---

## 🧪 测试和验证

### 使用测试脚本

```bash
# 进入项目根目录
cd /Users/ljf/Desktop/back/foxchat

# 测试默认服务器
node test-server-discovery.js cjystx.top

# 测试 Matrix 子域名
node test-server-discovery.js matrix.cjystx.top
```

### 在浏览器控制台测试

```javascript
// 开发环境中，以下函数可用

// 测试服务发现
await window.testDiscovery()

// 测试网络连接
await window.testNetwork()
```

### 在代码中验证

```typescript
import { matrixServerDiscovery } from '@/integrations/matrix/server-discovery'
import { validateMatrixServer } from '@/utils/server-validator'

// 示例 1: 发现服务器
const discovery = await matrixServerDiscovery.discover('cjystx.top')
console.log('Homeserver:', discovery.homeserverUrl)
console.log('Capabilities:', discovery.capabilities)

// 示例 2: 验证服务器
const validation = await validateMatrixServer('cjystx.top')
if (validation.valid) {
  console.log('服务器有效:', validation.homeserverUrl)
} else {
  console.error('服务器无效:', validation.error)
}

// 示例 3: 检查服务器健康状态
const health = await matrixServerDiscovery.checkServerHealth(discovery.homeserverUrl)
console.log('可达性:', health.reachable)
console.log('响应时间:', health.responseTime, 'ms')
console.log('版本:', health.version)
```

---

## 🔧 配置要求

### 环境变量

确保 `.env` 文件中配置了以下变量:

```bash
# Matrix 功能开关
VITE_MATRIX_ENABLED=on

# Matrix 服务器地址
VITE_MATRIX_BASE_URL=https://matrix.cjystx.top

# Matrix 服务器域名 (用于服务发现)
VITE_MATRIX_SERVER_NAME=cjystx.top

# 要求 Matrix 登录验证 (重要!)
VITE_REQUIRE_MATRIX_LOGIN=true
```

### 默认服务器配置

如果未配置 `VITE_MATRIX_SERVER_NAME`，将使用 `cjystx.top` 作为默认服务器。

---

## 📊 服务器状态验证

### 验证流程

```
用户输入服务器域名
    ↓
1. 规范化服务器名称
    ↓
2. 调用 Matrix SDK 的 AutoDiscovery.findClientConfig()
    ↓
3. 检查 .well-known/matrix/client 配置
    ↓
4. 验证 homeserver URL 可达性
    ↓
5. 收集服务器能力信息
    ↓
6. 返回发现结果 (带缓存)
```

### 健康检查指标

| 指标 | 说明 |
|------|------|
| `reachable` | 服务器是否可达 (布尔值) |
| `responseTime` | 响应时间 (毫秒) |
| `version` | 服务器版本 |
| `versions` | 支持的 API 版本列表 |
| `unstableFeatures` | 支持的实验性功能 |
| `error` | 错误信息 (如果失败) |

### 推荐的服务器配置

**必需的实验性功能**:
- `org.matrix.msc3575` - Sliding sync (滑动同步)

**推荐的实验性功能**:
- `org.matrix.msc2716` - History import
- `org.matrix.msc3440` - Threading
- `org.matrix.msc3773` - Notifications

---

## 🚨 故障排查

### 问题 1: 服务器发现失败

**错误信息**: `服务发现失败: xxx`

**排查步骤**:
1. 检查网络连接
2. 验证服务器域名是否正确
3. 检查 `.well-known/matrix/client` 配置是否存在
4. 尝试直接访问: `curl https://your-server/.well-known/matrix/client`

**解决方案**:
- 确保 Matrix 服务器正在运行
- 检查防火墙和网络配置
- 验证 DNS 解析是否正确

### 问题 2: 服务器不可达

**错误信息**: `服务器不可达: xxx`

**排查步骤**:
1. 使用 `testServerConnection` 测试连接
2. 检查 homeserver URL 是否正确
3. 尝试直接访问: `curl https://your-server/_matrix/client/versions`

**解决方案**:
- 确认服务器地址正确
- 检查 SSL/TLS 证书是否有效
- 验证服务器端口是否开放 (通常 443 或 8448)

### 问题 3: 缓存问题

**症状**: 服务器配置已更改，但应用仍使用旧配置

**解决方案**:
```typescript
// 清除缓存
import { matrixServerDiscovery } from '@/integrations/matrix/server-discovery'
matrixServerDiscovery.clearCache('your-server.com')

// 或清除所有缓存
matrixServerDiscovery.clearCache()
```

---

## 📈 性能优化

### 缓存机制

- **默认 TTL**: 5 分钟
- **最小 TTL**: 1 分钟
- **缓存键**: 服务器名称

### 超时控制

- **服务发现超时**: 10 秒 (可配置)
- **健康检查超时**: 5 秒

### 批量操作

```typescript
// 批量验证多个服务器
import { matrixServerValidator } from '@/utils/server-validator'

const servers = ['server1.com', 'server2.com', 'server3.com']
const results = await matrixServerValidator.validateBatch(servers)

results.forEach(result => {
  console.log(`${result.serverName}: ${result.valid ? '✓' : '✗'}`)
})
```

---

## 🎯 最佳实践

### 1. 始终使用服务发现

```typescript
// ✅ 推荐
const discovery = await matrixServerDiscovery.discover('server.com')
const client = createClient({ baseUrl: discovery.homeserverUrl })

// ❌ 不推荐
const client = createClient({ baseUrl: 'https://server.com' })
```

### 2. 处理服务发现失败

```typescript
try {
  const discovery = await matrixServerDiscovery.discover('server.com')
  // 使用 discovery.homeserverUrl
} catch (error) {
  // 显示用户友好的错误信息
  showError('无法连接到 Matrix 服务器，请检查服务器配置')
  // 提供重试选项
  showRetryButton()
}
```

### 3. 定期验证服务器状态

```typescript
// 在应用启动时验证
const validation = await validateMatrixServer('server.com')
if (!validation.valid) {
  logger.warn('Matrix 服务器验证失败', validation.error)
}
```

---

## 📚 相关资源

- [Matrix SDK 文档](https://matrix-org.github.io/matrix-js-sdk/)
- [Matrix 服务发现规范](https://spec.matrix.org/v1.2/client-server-api/#discovery)
- [登录安全审计报告](./LOGIN_SECURITY_AUDIT.md)
- [登录验证深度排查](./LOGIN_VERIFICATION_DEEP_DIVE.md)

---

**文档版本**: 1.0.0
**作者**: Claude Code
**最后更新**: 2026-01-04
