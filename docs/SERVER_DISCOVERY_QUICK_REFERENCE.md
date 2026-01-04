# Matrix 服务发现 - 快速参考

**更新时间**: 2026-01-04

---

## 🚀 快速开始

### 导入

```typescript
// 服务发现
import { matrixServerDiscovery } from '@/integrations/matrix/server-discovery'

// 服务器验证
import { validateMatrixServer, testServerConnection, isServerOnline } from '@/utils/server-validator'
```

### 基本用法

```typescript
// 1. 发现服务器
const discovery = await matrixServerDiscovery.discover('cjystx.top')
console.log('Homeserver URL:', discovery.homeserverUrl)

// 2. 验证服务器
const validation = await validateMatrixServer('cjystx.top')
if (validation.valid) {
  console.log('服务器有效:', validation.homeserverUrl)
}

// 3. 检查服务器健康状态
const health = await matrixServerDiscovery.checkServerHealth(discovery.homeserverUrl)
console.log('可达性:', health.reachable)
console.log('响应时间:', health.responseTime, 'ms')
```

---

## 📦 API 参考

### matrixServerDiscovery

#### `discover(serverName, options?)`

发现 Matrix 服务器并返回配置信息。

**参数**:
- `serverName: string` - 服务器域名或 URL
- `options?: DiscoveryOptions` - 可选配置
  - `timeout?: number` - 请求超时 (毫秒，默认 10000)
  - `allowCrossDomain?: boolean` - 允许跨域 (默认 false)
  - `skipCache?: boolean` - 跳过缓存 (默认 false)
  - `validateCapabilities?: boolean` - 验证能力 (默认 true)

**返回**: `Promise<DiscoveryResult>`

**示例**:
```typescript
const discovery = await matrixServerDiscovery.discover('matrix.org', {
  timeout: 15000,
  skipCache: true
})
```

#### `checkServerHealth(homeserverUrl)`

检查服务器健康状态。

**参数**:
- `homeserverUrl: string` - Homeserver URL

**返回**: `Promise<ServerHealthStatus>`

**示例**:
```typescript
const health = await matrixServerDiscovery.checkServerHealth(
  'https://matrix.org'
)
console.log(health.reachable) // true/false
console.log(health.responseTime) // 响应时间 (ms)
console.log(health.version) // 服务器版本
```

#### `clearCache(serverName?)`

清除服务发现缓存。

**参数**:
- `serverName?: string` - 可选的服务器名称

**示例**:
```typescript
// 清除特定服务器缓存
matrixServerDiscovery.clearCache('matrix.org')

// 清除所有缓存
matrixServerDiscovery.clearCache()
```

### 服务器验证函数

#### `validateMatrixServer(serverName)`

验证服务器配置。

**返回**: `Promise<ValidationResult>`

**示例**:
```typescript
const result = await validateMatrixServer('matrix.org')
if (result.valid) {
  console.log('✓ 服务器有效:', result.homeserverUrl)
} else {
  console.error('✗ 服务器无效:', result.error)
}
```

#### `testServerConnection(serverName, timeout?)`

测试服务器连接。

**参数**:
- `serverName: string` - 服务器域名
- `timeout?: number` - 超时时间 (毫秒，默认 10000)

**返回**: `Promise<ConnectionTestResult>`

**示例**:
```typescript
const test = await testServerConnection('matrix.org', 5000)
console.log('可达性:', test.reachable)
console.log('响应时间:', test.responseTime, 'ms')
console.log('版本:', test.version)
```

#### `isServerOnline(serverName)`

快速检查服务器是否在线。

**返回**: `Promise<boolean>`

**示例**:
```typescript
const online = await isServerOnline('matrix.org')
if (online) {
  console.log('服务器在线')
} else {
  console.log('服务器离线')
}
```

---

## 🔧 高级用法

### 缓存管理

```typescript
// 设置缓存 TTL (最小 1 分钟)
matrixServerDiscovery.setCacheTTL(10 * 60 * 1000) // 10 分钟

// 获取剩余 TTL
const ttl = matrixServerDiscovery.getCacheRemainingTTL('matrix.org')
console.log(`缓存剩余时间: ${ttl}ms`)

// 清除缓存
matrixServerDiscovery.clearCache('matrix.org')
```

### 批量验证

```typescript
import { matrixServerValidator } from '@/utils/server-validator'

const servers = ['matrix.org', 'libera.chat', 'gitter.im']
const results = await matrixServerValidator.validateBatch(servers)

results.forEach(result => {
  console.log(`${result.serverName}: ${result.valid ? '✓' : '✗'}`)
  if (!result.valid) {
    console.error(`  错误: ${result.error}`)
  }
})
```

### 错误处理

```typescript
import { matrixServerDiscovery } from '@/integrations/matrix/server-discovery'

try {
  const discovery = await matrixServerDiscovery.discover('unknown-server.com')
  // 使用发现结果...
} catch (error) {
  if (error.message.includes('not found')) {
    console.error('服务器不存在')
  } else if (error.message.includes('timeout')) {
    console.error('连接超时')
  } else {
    console.error('未知错误:', error.message)
  }
}
```

---

## 🧪 测试工具

### 浏览器控制台

```javascript
// 在开发环境中可用
await window.testDiscovery()  // 测试服务发现
await window.testNetwork()    // 测试网络连接
```

### 命令行测试

```bash
# 测试服务发现
node test-server-discovery.js matrix.cjystx.top

# 测试其他服务器
node test-server-discovery.js matrix.org
node test-server-discovery.js libera.chat
```

### 测试登录

```bash
# 测试登录功能
node test-server-discovery.js matrix.cjystx.top username password
```

---

## 📊 类型定义

### DiscoveryResult

```typescript
interface DiscoveryResult {
  homeserverUrl: string
  identityServerUrl?: string
  slidingSyncUrl?: string
  capabilities: ServerCapabilities
  rawConfig: AutoDiscoveryWrapperResult
  discovered: boolean
  timestamp: number
}
```

### ServerHealthStatus

```typescript
interface ServerHealthStatus {
  reachable: boolean
  version?: string
  responseTime?: number
  error?: string
  capabilities?: ServerCapabilities
}
```

### ValidationResult

```typescript
interface ValidationResult {
  valid: boolean
  serverName: string
  homeserverUrl?: string
  healthStatus?: ServerHealthStatus
  error?: string
}
```

### ConnectionTestResult

```typescript
interface ConnectionTestResult {
  serverName: string
  homeserverUrl: string
  reachable: boolean
  responseTime: number
  version?: string
  error?: string
}
```

---

## ⚠️ 注意事项

### 1. 服务器名称格式

```typescript
// ✅ 正确
await matrixServerDiscovery.discover('matrix.org')
await matrixServerDiscovery.discover('cjystx.top')

// ❌ 错误
await matrixServerDiscovery.discover('https://matrix.org')  // 不要包含协议
await matrixServerDiscovery.discover('matrix.org:8448')      // 不要包含端口
```

### 2. 超时设置

```typescript
// 服务发现超时 (默认 10 秒)
const discovery = await matrixServerDiscovery.discover('server.com', {
  timeout: 15000  // 15 秒
})

// 连接测试超时
const test = await testServerConnection('server.com', 5000)  // 5 秒
```

### 3. 缓存策略

```typescript
// 首次调用：执行服务发现
const discovery1 = await matrixServerDiscovery.discover('server.com')

// 5 分钟内再次调用：使用缓存
const discovery2 = await matrixServerDiscovery.discover('server.com')

// 强制刷新：跳过缓存
const discovery3 = await matrixServerDiscovery.discover('server.com', {
  skipCache: true
})
```

---

## 🐛 故障排查

### 问题: 服务器发现失败

```bash
# 1. 检查网络连接
ping matrix.cjystx.top

# 2. 检查 DNS 解析
nslookup matrix.cjystx.top

# 3. 检查 .well-known 配置
curl https://matrix.cjystx.top/.well-known/matrix/client

# 4. 检查 Matrix 版本 API
curl https://matrix.cjystx.top/_matrix/client/versions
```

### 问题: 连接超时

```typescript
// 增加超时时间
const discovery = await matrixServerDiscovery.discover('server.com', {
  timeout: 30000  // 30 秒
})
```

### 问题: 缓存导致使用旧配置

```typescript
// 清除缓存
matrixServerDiscovery.clearCache('server.com')

// 重新发现
const discovery = await matrixServerDiscovery.discover('server.com', {
  skipCache: true
})
```

---

## 📚 相关文档

- [服务发现统一文档](./SERVER_DISCOVERY_UNIFIED.md)
- [迁移报告](./SERVER_DISCOVERY_MIGRATION_REPORT.md)
- [Matrix SDK 文档](https://matrix-org.github.io/matrix-js-sdk/)

---

**文档版本**: 1.0.0
**作者**: Claude Code
**最后更新**: 2026-01-04
