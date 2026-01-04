# 登录验证逻辑深度排查报告

**排查时间**: 2026-01-04
**问题严重性**: 🔴 严重 - 安全漏洞
**影响范围**: 所有登录用户

---

## 执行摘要

### 关键发现 ⚠️

**用户报告的问题得到确认**:
1. ✅ 用户输入不存在的账号 `ete123456` 能够"登录成功"
2. ✅ 用户 `tete` 使用错误密码也能"登录成功"
3. ✅ 根本原因: **登录流程完全没有进行任何身份验证!**

### 问题本质

这是一个**严重的安全漏洞**，当前登录系统:
- 自定义后端登录已被禁用（返回空 Promise，总是成功）
- Matrix 登录被环境变量控制，默认为**跳过**
- 无论账号密码是否正确，登录都**100%成功**

---

## 问题详细分析

### 1. 自定义后端登录已禁用

**位置**: `src/hooks/useLogin.ts:487`

```typescript
// Phase 1 Migration: 临时禁用自定义后端登录
const loginPromise = Promise.resolve({}) // 暂时跳过自定义后端登录，直接使用 Matrix 登录
```

**问题**:
- 原本的登录调用 `invoke('login_command', ...)` 被注释掉
- 替换为 `Promise.resolve({})`，这意味着:
  - 无论用户输入什么，都立即返回成功
  - **完全没有验证用户名或密码**
  - 这是"临时"方案，但成为了永久方案

**原始代码**（已注释）:
```typescript
// const loginPromise = isTauri
//   ? invoke('login_command', {
//       data: {
//         ...loginParams,
//         password: loginPassword
//       }
//     })
//   : Promise.resolve({})
```

### 2. Matrix 登录被跳过

**位置**: `src/hooks/useLogin.ts:584-766`

```typescript
// 检查是否需要 Matrix 登录
const requireMatrixLogin = import.meta.env.VITE_REQUIRE_MATRIX_LOGIN === 'true'

if (requireMatrixLogin) {
  // 执行 Matrix 登录...
  await loginMatrix(mxid, loginPassword)
  matrixOk = true
} else {
  // Phase 1 Migration: Matrix登录被跳过
  logger.info('[Login] Phase 1 Migration: Matrix登录已跳过 (VITE_REQUIRE_MATRIX_LOGIN=false)')
  matrixOk = false // 但不阻止登录流程
  matrixErrorMessage.value = ''
  matrixTimeout.value = false
}
```

**问题**:
1. `VITE_REQUIRE_MATRIX_LOGIN` 默认**不是** `'true'`
2. 当为 `false` 时，Matrix 登录被**完全跳过**
3. `matrixOk = false` 但**不阻止登录流程**
4. 登录继续进行，用户被允许进入系统

### 3. 错误处理不阻止登录

**位置**: `src/hooks/useLogin.ts:769-779`

```typescript
// Web 环境必须校验成功才能进入主页
if (!isTauri && !matrixOk && requireMatrixLogin) {
  msg.error(`Matrix 登录失败：${matrixErrorMessage.value}`)
}

// 如果未被 Matrix 登录流程导航（如管理员已进入 /admin），则进入首页
```

**问题**:
1. 条件 `!isTauri && !matrixOk && requireMatrixLogin` 太严格
2. Tauri 环境（桌面应用）即使 Matrix 登录失败也会继续
3. 当 `requireMatrixLogin=false` 时，完全不执行错误提示
4. 用户被导航到首页，完全没有意识到登录失败

### 4. 实际登录流程

#### 当前流程（有漏洞）:
```
用户输入账号密码
  ↓
自定义后端登录（已禁用）→ Promise.resolve({}) → 总是成功 ✓
  ↓
检查 VITE_REQUIRE_MATRIX_LOGIN
  ↓
  false → 跳过 Matrix 登录 → matrixOk = false
  ↓
检查 !isTauri && !matrixOk && requireMatrixLogin
  ↓
  false (因为 requireMatrixLogin=false) → 不显示错误
  ↓
登录"成功"，进入主页 ❌
```

#### 正确流程（应该是）:
```
用户输入账号密码
  ↓
服务发现 (发现真实的 Matrix 服务器)
  ↓
Matrix 登录 (验证用户名密码)
  ↓
  成功 → 创建会话 → 进入主页 ✓
  失败 → 显示错误 → 留在登录页 ✓
```

---

## 服务发现功能分析

### 当前实现

**位置**: `src/integrations/matrix/discovery.ts`

```typescript
export async function performAutoDiscovery(serverName: string): Promise<DiscoveryResult> {
  // 1) SDK 自动发现
  const result = await AutoDiscovery.findClientConfig(serverName)

  // 2) 手动读取 .well-known 作为回退
  if (!hs) {
    // 尝试从 .well-known/matrix/client 获取
  }

  // 3) 测试服务器可达性
  const picked = await pickReachableBaseUrl(hs)

  return { homeserverUrl: picked, capabilities }
}
```

**功能完整性**: ✅ 良好
- 使用 Matrix SDK 的 `AutoDiscovery.findClientConfig()`
- 有 .well-known 回退机制
- 有服务器可达性测试
- 有能力信息收集

**问题**: 服务发现功能存在，但**登录时不使用**!

### 服务发现调用位置

**位置**: `src/hooks/useLogin.ts:591-596`

```typescript
// 快速初始化服务器URL（已优化，带缓存）
if (!matrixStore.getHomeserverBaseUrl()) {
  matrixStore.setDefaultBaseUrlFromEnv()
}
if (!matrixStore.getHomeserverBaseUrl()) {
  await matrixStore.discover()
}
```

**问题**:
1. 这段代码在 `requireMatrixLogin` 条件**内部**
2. 当 `requireMatrixLogin=false` 时，服务发现**不会执行**
3. 导致系统不知道真实的 Matrix 服务器地址

---

## 环境变量配置问题

### .env 配置检查

**当前配置**（推测）:
```bash
VITE_MATRIX_ENABLED=on          # Matrix 功能已启用
VITE_MATRIX_BASE_URL=https://matrix.cjystx.top  # Matrix 服务器地址
VITE_REQUIRE_MATRIX_LOGIN=false  # ❌ 关键问题: 不要求 Matrix 登录
```

**问题**:
1. `VITE_MATRIX_ENABLED=on` 表示使用 Matrix 功能
2. `VITE_REQUIRE_MATRIX_LOGIN=false` 表示不**要求** Matrix 登录成功
3. 这是矛盾的配置，导致没有任何身份验证

### 正确的配置应该是

```bash
VITE_MATRIX_ENABLED=on
VITE_MATRIX_BASE_URL=https://matrix.cjystx.top
VITE_REQUIRE_MATRIX_LOGIN=true   # ✅ 必须要求 Matrix 登录
```

或者如果完全使用自定义后端:
```bash
VITE_MATRIX_ENABLED=off          # 禁用 Matrix
```

---

## 安全风险评估

### 风险等级: 🔴 严重 (Critical)

### 影响
1. **任何人都可以"登录"**
   - 不需要账号
   - 不需要密码
   - 只需要点击登录按钮

2. **数据安全问题**
   - 未授权用户可以访问所有功能
   - 可以查看其他用户的消息（如果后端没有正确隔离）
   - 可以发送消息冒充其他用户

3. **合规问题**
   - 违反基本的安全原则
   - 可能违反数据保护法规
   - 无法审计谁访问了系统

### 利用场景
- 恶意用户无需凭证即可访问系统
- 竞争对手可以爬取数据
- 前员工可以继续访问系统

---

## 修复方案

### 方案 1: 启用 Matrix 登录验证（推荐）

**优先级**: 🔴 立即修复

#### 步骤 1: 修改 .env 配置

```bash
# .env
VITE_REQUIRE_MATRIX_LOGIN=true
```

#### 步骤 2: 修改登录逻辑

**文件**: `src/hooks/useLogin.ts`

```typescript
// 第 760-766 行
// ❌ 删除这个 else 块
// else {
//   logger.info('[Login] Phase 1 Migration: Matrix登录已跳过')
//   matrixOk = false
//   matrixErrorMessage.value = ''
//   matrixTimeout.value = false
// }

// ✅ 替换为
else {
  logger.error('[Login] Matrix 登录被禁用，拒绝登录')
  matrixOk = false
  matrixErrorMessage.value = '系统配置错误: Matrix 登录未启用'
  matrixTimeout.value = false

  // 阻止登录继续
  loginDisabled.value = false
  loginText.value = t('login.button.login.default')
  loading.value = false

  // 显示错误给用户
  msg.error('系统配置错误，请联系管理员')

  // 退出函数，不执行后续逻辑
  return
}
```

#### 步骤 3: 移除空 Promise

**文件**: `src/hooks/useLogin.ts`

```typescript
// 第 487 行
// ❌ 删除
// const loginPromise = Promise.resolve({})

// ✅ 恢复自定义后端登录，或者完全移除
const loginPromise = isTauri
  ? invoke('login_command', {
      data: {
        ...loginParams,
        password: loginPassword
      }
    })
  : Promise.resolve({}) // Web 环境可以跳过后端登录
```

#### 步骤 4: 添加登录验证

```typescript
// 在登录流程的最后，添加验证
// 第 770 行之后
if (!matrixOk) {
  // Matrix 登录失败，阻止进入系统
  loginDisabled.value = false
  loginText.value = t('login.button.login.default')
  loading.value = false

  if (!matrixErrorMessage.value) {
    matrixErrorMessage.value = '登录失败，请检查用户名和密码'
  }

  msg.error(matrixErrorMessage.value)
  return
}

// 只有 Matrix 登录成功才能继续
logger.info('[Login] 身份验证通过，允许访问系统')
```

### 方案 2: 修复自定义后端登录（如果使用自定义后端）

**优先级**: 🟡 中等

#### 步骤 1: 修复 nginx 配置

```nginx
# /etc/nginx/sites-available/hula
location /api/login {
    proxy_pass http://backend:3000;
    proxy_redirect off;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # 禁止 301 重定向
    proxy_intercept_errors off;
}
```

#### 步骤 2: 恢复登录命令调用

**文件**: `src/hooks/useLogin.ts`

```typescript
// 第 489-496 行，取消注释
const loginPromise = isTauri
  ? invoke('login_command', {
      data: {
        ...loginParams,
        password: loginPassword
      }
    })
  : Promise.resolve({})
```

#### 步骤 3: 添加后端登录验证

```typescript
loginPromise.then(async (response) => {
  // 验证响应
  if (!response || !response.token) {
    throw new Error('后端登录失败: 无效的响应')
  }

  // 保存令牌
  localStorage.setItem('TOKEN', response.token)
  // ...

  // 继续登录流程
}).catch((error) => {
  // 后端登录失败，阻止登录
  loginDisabled.value = false
  loginText.value = t('login.button.login.default')
  loading.value = false
  msg.error(`登录失败: ${error.message}`)
  return
})
```

### 方案 3: 增强服务发现

**优先级**: 🟢 优化

#### 在登录前强制执行服务发现

```typescript
// src/hooks/useLogin.ts
// 在 normalLogin 函数中，添加服务发现

async function normalLogin(...) {
  // ... 现有代码 ...

  // 强制执行服务发现
  logInfo('[Login] 开始服务发现...')
  const { store: matrixStore } = useMatrixAuth()

  try {
    if (!matrixStore.getHomeserverBaseUrl()) {
      await matrixStore.discover()
    }

    const hsUrl = matrixStore.getHomeserverBaseUrl()
    logInfo(`[Login] 服务发现成功: ${hsUrl}`)
  } catch (error) {
    logError(`[Login] 服务发现失败: ${error}`)
    msg.error('无法连接到 Matrix 服务器，请检查网络或服务器配置')
    return
  }

  // 然后执行 Matrix 登录
  // ...
}
```

---

## 测试验证

### 服务发现测试

使用提供的测试脚本:

```bash
# 测试服务发现
node test-server-discovery.js cjystx.top

# 测试登录
node test-server-discovery.js cjystx.top tete tete123456
```

**预期输出**:
```
============================================================
  Matrix 服务发现测试
============================================================

ℹ 服务器: cjystx.top

✓ 找到 .well-known 配置: https://cjystx.top/.well-known/matrix/client
✓ 从 .well-known 获取到 homeserver URL: https://matrix.cjystx.top

============================================================
  测试 Matrix 服务器
============================================================

ℹ 测试 Matrix 服务器: https://matrix.cjystx.top
✓ Matrix 服务器响应正常!
  支持的版本: r0.0.1, r0.1.0, ...

============================================================
  测试 Matrix 登录
============================================================

ℹ 测试登录: tete@matrix.cjystx.top
✗ 登录失败: 用户名或密码错误
  (如果密码错误) 或
✓ 登录成功!
  (如果密码正确)

============================================================
  测试总结
============================================================

✓ Matrix 服务器可用
  Homeserver URL: https://matrix.cjystx.top
✓ .well-known 配置已找到
```

### 登录验证测试

修复后，测试以下场景:

1. **测试错误的用户名**
   - 输入: `nonexistent_user`
   - 密码: `any_password`
   - 预期: ❌ 登录失败，显示错误

2. **测试正确的用户名，错误的密码**
   - 输入: `tete`
   - 密码: `wrong_password`
   - 预期: ❌ 登录失败，显示"用户名或密码错误"

3. **测试正确的用户名和密码**
   - 输入: `tete`
   - 密码: `correct_password`
   - 预期: ✅ 登录成功

---

## 临时应急措施

如果需要立即阻止未授权访问，可以采取以下临时措施:

### 措施 1: 修改登录函数立即返回

**文件**: `src/hooks/useLogin.ts:400`

```typescript
const normalLogin = async (...) => {
  // 临时措施: 禁用所有登录
  msg.error('系统维护中，暂时无法登录')
  return

  // 原有代码...
}
```

### 措施 2: 在路由层面拦截

**文件**: `src/router/index.ts`

```typescript
router.beforeEach((to, from, next) => {
  // 临时措施: 只允许登录页
  if (to.path !== '/login') {
    next('/login')
    return
  }
  next()
})
```

---

## 根本原因分析

### 为什么会这样？

1. **Phase 1 Migration**
   - 开发过程中迁移到 Matrix
   - 禁用了自定义后端登录，打算逐步替换
   - 但忘记启用 Matrix 登录验证

2. **环境变量设置错误**
   - `VITE_REQUIRE_MATRIX_LOGIN=false` 应该是 `true`
   - 或者这个变量根本不存在，导致默认为 false

3. **缺乏测试**
   - 没有端到端的登录测试
   - 没有测试错误密码的情况
   - 只测试了"登录成功"的场景

### 为什么没有发现？

1. **测试账号总是使用正确的密码**
   - 开发者可能总是用测试账号登录
   - 测试账号密码正确，所以没发现这个问题

2. **专注于功能开发，忽略安全**
   - 重点在让 Matrix 功能工作
   - 忽略了基本的身份验证

3. **缺少代码审查**
   - 这个明显的安全漏洞应该在 PR 中被发现

---

## 后续建议

### 短期（1-2天）

1. ✅ **立即修复**: 启用 `VITE_REQUIRE_MATRIX_LOGIN=true`
2. ✅ **代码审查**: 检查所有认证相关代码
3. ✅ **安全测试**: 测试各种错误场景

### 中期（1周）

1. **端到端测试**: 添加登录流程的自动化测试
2. **监控告警**: 添加登录失败率和异常登录的监控
3. **文档更新**: 更新部署文档，明确环境变量配置

### 长期（1个月）

1. **安全审计**: 进行全面的安全审计
2. **代码审查流程**: 建立强制性的代码审查制度
3. **渗透测试**: 进行专业的渗透测试

---

## 参考资源

- [Matrix 认证文档](../matrix-sdk/02-authentication.md)
- [服务发现测试脚本](./test-server-discovery.js)
- [Matrix SDK 服务发现](https://matrix-org.github.io/matrix-js-sdk/)

---

**报告版本**: 1.0.0
**作者**: Claude Code Security Analysis
**最后更新**: 2026-01-04
