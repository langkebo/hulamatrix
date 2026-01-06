# Matrix SDK 后端待完善事项汇总

说明文档.md

## 一、项目规划

### 1.1 目标

- 通过自动化脚本验证好友系统全流程（搜索/添加/接受/删除）可用
- 基于实际可用的后端接口，给出 SDK 与前端实现完整好友功能的落地方案（含聊天集成与本地保存策略）
- 若后端存在缺口，给出可执行的优化与完善方案（按优先级与风险拆解）

### 1.2 范围（以当前仓库实现为准）

- 好友系统端点：`/_synapse/client/friends`（action 风格）与 `/_synapse/client/enhanced/friends/v2/*`（REST v2）
- 相关管理器：好友系统管理器 `FriendSystemManager`
- 聊天能力：以 Matrix 标准客户端 API 为主（创建房间、发送消息、m.direct 维护）

## 二、后端 API 测试结果（更新：2026-01-06）

### 2.1 生产环境测试（带认证）

#### 测试环境配置
- **服务器地址**: `https://matrix.cjystx.top:8443` ⚠️ 注意端口
- **服务发现**: `https://cjystx.top/.well-known/matrix/client`
- **测试用户**: `@rere:cjystx.top`
- **测试时间**: 2026-01-06 13:42:15
- **认证方式**: Bearer Token (必需)

#### 测试结果汇总

| API 端点 | 方法 | 状态码 | 结果 |
|----------|------|--------|------|
| **Friends API v1** ||||
| `/_synapse/client/friends?action=list` | GET | 200 | ✅ 正常 |
| `/_synapse/client/friends?action=pending_requests` | GET | 200 | ✅ 正常 |
| `/_synapse/client/friends?action=search` | GET | 200 | ✅ 正常 |
| `/_synapse/client/friends?action=stats` | GET | 200 | ✅ 正常 |
| **Friends API v2** ||||
| `/_synapse/client/enhanced/friends/v2/list` | GET | 200 | ✅ 正常 |
| `/_synapse/client/enhanced/friends/v2/categories` | GET | 200 | ✅ 正常 |
| `/_synapse/client/enhanced/friends/v2/stats` | GET | 200 | ✅ 正常 |
| `/_synapse/client/enhanced/friends/v2/blocked` | GET | 200 | ✅ 正常 |
| `/_synapse/client/enhanced/friends/v2/search` | GET | 200 | ✅ 正常 |
| `/_synapse/client/enhanced/friends/v2/requests/pending` | GET | 200 | ✅ 正常 |
| `/_synapse/client/enhanced/friends/v2/request` | POST | 200 | ✅ 正常 |
| **Matrix 用户搜索** ||||
| `/_matrix/client/v3/user_directory/search` | POST | 200 | ✅ 正常 |
| **Private Chat API** ||||
| `/_synapse/client/private?action=list` | GET | 200 | ⚠️ 不支持此 action |
| **认证测试** ||||
| 无 token 访问任意端点 | GET | 401 | ✅ 鉴权正常 |

#### API 响应示例

**v1: list**
```json
{"status": "ok", "friends": []}
```

**v1: stats**
```json
{"status": "ok", "stats": {"total_friends": 0, "pending_requests": 0, "blocked_count": 0}}
```

**v2: categories**
```json
{"status": "ok", "categories": [{"id": "default", "name": "默认分组", "created_at": ""}]}
```

**v2: request (添加好友)**
```json
{"status": "ok", "request_id": "4bc9fc2b-77dd-46ca-8a6d-0277c7fc1ffb"}
```

**用户目录搜索 (搜索 "tete")**
```json
{
  "limited": false,
  "results": [
    {"user_id": "@tete:cjystx.top", "display_name": "tete", "avatar_url": null},
    {"user_id": "@tete1:cjystx.top", "display_name": null, "avatar_url": null}
  ]
}
```

**无 token 访问**
```json
{"errcode": "M_MISSING_TOKEN", "error": "missing access token"}
```

### 2.2 关键发现

#### ✅ **已实现的功能**
1. **Friends API v1 全部端点** - action 风格 API 完全可用
2. **Friends API v2 全部端点** - REST 风格 API 完全可用
3. **用户搜索** - Matrix 用户目录 API 正常工作
4. **好友请求** - 成功发送请求并返回 request_id
5. **好友分组** - 默认分组已创建
6. **统计信息** - 实时统计好友数、待处理请求数等
7. **鉴权机制** - 正确返回 401 当 token 缺失或无效

#### ⚠️ **需要注意的问题**
1. **端口配置**
   - Matrix Synapse 运行在 **8443 端口**（不是标准的 443）
   - 443 端口只返回 Nginx 页面（404）
   - **前端配置必须使用**: `https://matrix.cjystx.top:8443`

2. **服务发现**
   - ✅ **正确**: `https://cjystx.top/.well-known/matrix/client` → 200
   - ❌ **错误**: `https://matrix.cjystx.top/.well-known/matrix/client` → 404
   - **前端必须使用**: `cjystx.top` 做服务发现

3. **认证要求**
   - **所有 Friends API 端点都需要 Bearer Token**
   - 无 token 返回: `{"errcode": "M_MISSING_TOKEN", "error": "missing access token"}` (HTTP 401)
   - 之前测试返回 404 是因为**没有带 token**

4. **Private Chat API**
   - `/_synapse/client/private?action=list` 返回: `{"errcode": "M_UNRECOGNIZED", "error": "unsupported_action: list"}`
   - **此 API 端点未实现**，但 Friends API 已足够

#### 🔧 **前端配置建议**

**.env 配置**:
```bash
# 正确的服务器配置
VITE_MATRIX_BASE_URL=https://matrix.cjystx.top:8443
VITE_MATRIX_SERVER_NAME=cjystx.top
```

**vite.config.ts 代理配置**:
```typescript
proxy: {
  '/_matrix': {
    target: 'https://matrix.cjystx.top:8443',  // 注意 8443 端口
    changeOrigin: true,
    rewrite: (p: string) => p
  },
  '/_synapse': {
    target: 'https://matrix.cjystx.top:8443',  // 注意 8443 端口
    changeOrigin: true,
    rewrite: (p: string) => p
  }
}
```

### 2.3 测试方法

**正确的测试流程**:
```bash
# 1. 通过服务发现获取真实服务器地址
curl -s "https://cjystx.top/.well-known/matrix/client"
# 返回: {"m.homeserver": {"base_url": "https://matrix.cjystx.top"}}

# 2. 登录获取 access_token (使用 8443 端口)
curl -s -X POST "https://matrix.cjystx.top:8443/_matrix/client/v3/login" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "m.login.password",
    "identifier": {"type": "m.id.user", "user": "rere"},
    "password": "Ljf3790791"
  }' | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])'

# 3. 使用 token 访问 Friends API
curl -s "https://matrix.cjystx.top:8443/_synapse/client/enhanced/friends/v2/list?user_id=@rere:cjystx.top" \
  -H "Authorization: Bearer $TOKEN"
```

**常见错误**:
| 错误做法 | 正确做法 |
|---------|---------|
| 使用 443 端口 | 使用 8443 端口 |
| 不带 token 测试 | 必须带 `Authorization: Bearer $TOKEN` |
| 使用 matrix.cjystx.top 做服务发现 | 使用 cjystx.top 做服务发现 |
| 期望返回 404 | 无 token 应返回 401 |

## 三、API 使用指南

> **注意**: 本章节基于实际测试结果，描述如何在生产环境正确使用 Friends API。
> **生产环境状态**: ✅ Friends API v1/v2 已部署并正常运行 (2026-01-06 测试确认)

### 3.1 认证流程

所有 Friends API 请求都需要 Bearer Token 认证：

```typescript
// 1. 登录获取 token
const loginResponse = await fetch('https://matrix.cjystx.top:8443/_matrix/client/v3/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'm.login.password',
    identifier: { type: 'm.id.user', user: 'username' },
    password: 'password'
  })
})

const { access_token, user_id } = await loginResponse.json()

// 2. 使用 token 访问 Friends API
const response = await fetch(
  `https://matrix.cjystx.top:8443/_synapse/client/enhanced/friends/v2/list?user_id=${user_id}`,
  {
    headers: { 'Authorization': `Bearer ${access_token}` }
  }
)
```

### 3.2 好友 API 契约（可用于 SDK 对接）

#### 3.2.1 端点总览

- v1（action 风格，测试脚本使用）
  - `GET  /_synapse/client/friends?action=...`
  - `POST /_synapse/client/friends`（JSON body 传 action）
- v2（REST 风格，更适合 SDK 固化，且对 user_id 参数校验更严格）
  - `GET  /_synapse/client/enhanced/friends/v2/{list|categories|stats|blocked|search}`
  - `GET  /_synapse/client/enhanced/friends/v2/requests/pending`
  - `POST /_synapse/client/enhanced/friends/v2/request`（发起请求）
  - `POST /_synapse/client/enhanced/friends/v2/request/{accept|reject}`
  - `POST /_synapse/client/enhanced/friends/v2/remove`
  - `POST /_synapse/client/enhanced/friends/v2/categories`、`POST /_synapse/client/enhanced/friends/v2/categories/delete`
  - `POST /_synapse/client/enhanced/friends/v2/remark`
  - `POST /_synapse/client/enhanced/friends/v2/{block|unblock}`

相关实现入口（便于追踪返回字段与错误行为）：
- [FriendsResource](file:///home/matrix/synapse/deplo/work/synapse_module.py#L320-L520)
- [FriendsRestV2Resource](file:///home/matrix/synapse/deplo/work/synapse_module.py#L758-L910)
- [FriendSystemManager](file:///home/matrix/synapse/deplo/work/enhanced/friend_manager.py#L40-L524)

#### 3.2.2 数据模型（服务端返回为准）

- Friend（好友列表项，来自 `user_friends` + `friend_categories`）
  - `friend_id: string`（Matrix user_id）
  - `remark: string`
  - `status: 'accepted' | ...`
  - `created_at: string`（ISO8601）
  - `category_id: string`
  - `category_name?: string | null`
- FriendRequest（待处理请求项，来自 `friend_requests`）
  - `id: string`（request_id）
  - `requester_id: string`
  - `message: string`
  - `created_at: string`（ISO8601）
  - `category_id?: string | null`

#### 3.2.3 v2 推荐调用清单（SDK 侧建议优先固化这一套）

- 获取好友列表
  - `GET /_synapse/client/enhanced/friends/v2/list?user_id=@me:server`
  - 返回：`{ status: "ok", friends: Friend[] }`
- 搜索好友（注意：当前仅在“已是好友”的集合内搜索）
  - `GET /_synapse/client/enhanced/friends/v2/search?user_id=@me:server&query=xxx`
  - 返回：`{ status: "ok", users: Array<{user_id, status, created_at}> }`
- 发起好友请求
  - `POST /_synapse/client/enhanced/friends/v2/request`
  - body：`{ requester_id, target_id, message?, category_id? }`
  - 返回：`{ status: "ok"|"failed", request_id?: string }`
- 拉取待处理请求
  - `GET /_synapse/client/enhanced/friends/v2/requests/pending?user_id=@me:server`
  - 返回：`{ status: "ok", requests: FriendRequest[] }`
- 接受/拒绝请求
  - `POST /_synapse/client/enhanced/friends/v2/request/accept`，body：`{ request_id, user_id, category_id? }`
  - `POST /_synapse/client/enhanced/friends/v2/request/reject`，body：`{ request_id, user_id }`
- 删除好友
  - `POST /_synapse/client/enhanced/friends/v2/remove`，body：`{ user_id, friend_id }`
- 备注/分组/黑名单（可选）
  - 备注：`POST /_synapse/client/enhanced/friends/v2/remark`，body：`{ user_id, friend_id, remark }`
  - 分组：`POST /_synapse/client/enhanced/friends/v2/categories`（创建），`.../categories/delete`（删除）
  - 黑名单：`POST /_synapse/client/enhanced/friends/v2/block` / `.../unblock`

### 3.3 SDK 实现（以 Web/Node TypeScript 形态示例，其他语言同构）

#### 3.3.1 约定

- SDK 仅封装“好友相关”的增强端点（v2 为主），聊天走 Matrix 标准客户端 API
- 鉴权：请求头 `Authorization: Bearer <access_token>`
- baseUrl：建议由外部注入（如 `https://localhost:8443` 或线上域名）

#### 3.3.2 SDK 接口（建议）

- FriendApi
  - `listFriends(userId)`
  - `searchFriends(userId, query)`
  - `sendRequest(requesterId, targetId, message?, categoryId?)`
  - `listPendingRequests(userId)`
  - `acceptRequest(requestId, userId, categoryId?)`
  - `rejectRequest(requestId, userId)`
  - `removeFriend(userId, friendId)`
  - `setRemark(userId, friendId, remark)`
  - `listCategories(userId)` / `createCategory(userId, name)` / `deleteCategory(categoryId)`
  - `listBlocked(userId)` / `block(userId, targetId)` / `unblock(userId, targetId)`

#### 3.3.3 SDK 请求示例（fetch 伪代码）

```ts
type Json = Record<string, unknown>;

async function httpJson<T>(
  baseUrl: string,
  path: string,
  accessToken: string,
  init: RequestInit,
): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
  return data as T;
}

export async function listFriends(baseUrl: string, token: string, userId: string) {
  const q = new URLSearchParams({ user_id: userId });
  return httpJson<{ status: string; friends: any[] }>(
    baseUrl,
    `/_synapse/client/enhanced/friends/v2/list?${q.toString()}`,
    token,
    { method: "GET" },
  );
}
```

### 3.4 前端实现方案（页面/状态/本地保存）

#### 2.4.1 页面拆分（建议最小闭环）

- 好友页
  - 好友列表（分组 + 备注展示）
  - 搜索（默认搜“好友”；如要搜“全站用户”，走 Matrix user_directory）
  - 好友请求入口（待处理列表）
- 请求页
  - 待处理请求列表（接受/拒绝）
- 会话页（聊天）
  - 直接复用 Matrix 客户端会话能力（DM 房间）

#### 2.4.2 状态与缓存（“保存好友/搜索”等）

- 关键本地状态（建议持久化）
  - `friendsByUserId`：好友列表缓存（按 userId 维度）
  - `pendingRequestsByUserId`：待处理请求缓存
  - `dmRoomIdByFriendId`：好友 → DM room_id 的映射
  - `friendSearchHistory`：搜索历史（仅 UI 体验，避免上报敏感信息）
- 缓存策略（建议）
  - 页面进入先读本地缓存即时渲染
  - 后台刷新（list / requests）完成后覆盖缓存
  - 发起请求/接受/删除/备注/拉黑成功后，立即局部更新缓存并触发一次后台全量刷新

### 3.5 聊天（DM）落地方式

#### 2.5.1 当前后端实际能力边界

- 好友“接受请求”的接口当前只返回 `{status:"ok"}`，不会稳定返回 `dm_room_id`
  - 代码中存在“尝试自动创建 DM 并写 m.direct”的逻辑，但当前 `requester_id` 未被设置，导致该分支不会触发
  - 结论：聊天房间的创建与 m.direct 写入，建议客户端自行完成（标准 Matrix 做法）

#### 2.5.2 客户端创建 DM（推荐）

1. 用户点击好友/开始聊天：
   - 若本地 `dmRoomIdByFriendId[friendId]` 存在，直接进入
   - 否则创建 DM 房间：
     - `POST /_matrix/client/v3/createRoom`，body：`{ "preset":"trusted_private_chat", "invite":[friendId], "is_direct":true }`
   - 成功后写入 account_data：
     - `PUT /_matrix/client/v3/user/{userId}/account_data/m.direct`，把 `friendId -> [roomId]` 合并进去
   - 将 `friendId -> roomId` 缓存到本地
2. 发送消息：
   - `PUT /_matrix/client/v3/rooms/{roomId}/send/m.room.message/{txnId}`

### 3.6 后端缺口与优化完善方案（按优先级）

#### P0（安全与一致性，建议优先修）

- 身份校验缺口：当前好友接口大量依赖 body/query 里的 `user_id/requester_id`，未强制与 access_token 绑定一致，存在“伪造他人身份操作”的风险
  - 建议：在资源层通过 access_token 解析出真实 user_id，并覆盖/忽略外部传入的 user_id；校验 `requester_id == token_user_id`
- 权限与错误码统一：同一类参数缺失/不支持 action 的返回结构不完全一致
  - 建议：统一返回 `{errcode, error}` 并使用稳定的 HTTP 状态码；同时为 v1/v2 对齐

#### P1（体验闭环）

- 接受好友请求后 DM 不自动建立：代码里已有“创建 DM + 写 m.direct”的雏形，但当前 `requester_id` 未被正确带出
  - 建议：accept 时从请求记录中取出 `requester_id`，并作为响应字段返回；可选：由后端完成 DM 创建与 m.direct 双向写入，返回 `dm_room_id`
- “搜索用户”语义不完整：当前 `search_friends` 仅在“已添加好友”集合中搜索，无法支撑“搜索用户→加好友”的常见产品链路
  - 建议 A：前端搜索用户走 Matrix 官方 user_directory（最小改动）
  - 建议 B：后端补充“搜索全站用户/服务器用户目录”的代理端点（需限流与权限控制）

#### P2（可扩展性）

- 列表分页：好友列表/请求列表目前一次性返回，数据量大时性能与带宽压力上升
  - 建议：增加 `limit`/`cursor`（或 `since`）参数，并在 SQL 层按索引列分页
- 幂等与并发：重复请求、重复接受、并发 accept/remove 可能产生边界状态
  - 建议：将关键操作变为幂等（例如 accept 返回明确的“已接受/已过期/不存在”状态），并补充事务内唯一约束与状态检查

#### P3（数据质量与性能）

- last_interaction 未更新：表字段存在但当前流程未写入
  - 建议：在发送消息或创建 DM 时更新双方 `last_interaction`；或通过后台任务从事件流聚合
- 清理任务 SQL 可疑：`cleanup_expired_requests` 的 interval 写法容易导致参数无法生效
  - 建议：调整为数据库可参数化的写法，并为清理任务增加单测/回归用例
- 缓存策略：当前内存缓存未启用或未使用 TTL 驱逐，且多进程/多 worker 下不可共享
  - 建议：要么移除内存缓存以避免一致性问题；要么引入外部缓存（Redis）并实现带版本/TTL 的一致性策略

## 四、更新记录

### 2026-01-06 (第二次更新)

#### 生产环境测试 (带认证)
- ✅ **完成带认证的后端 Friends API 测试**
- ✅ **确认生产环境已部署** Synapse Friends API 扩展模块
- ✅ **所有 Friends API v1/v2 端点正常工作**
- ✅ Matrix 用户目录搜索正常
- ✅ 好友请求功能正常 (成功发送请求)
- ⚠️ 发现关键配置问题：
  - **服务器端口**: 必须使用 8443 (不是 443)
  - **服务发现**: 必须使用 cjystx.top (不是 matrix.cjystx.top)
  - **认证要求**: 所有端点需要 Bearer Token
- 📝 **重大更新**: 完全重写"后端 API 测试结果"章节

#### 修正之前的错误结论
- ❌ 之前错误结论: "生产环境未部署，返回 404"
- ✅ 正确结论: "已部署，需带 token 访问，使用 8443 端口"
- 原因分析: 之前测试未带 token 且使用了错误的端口 (443)

### 2026-01-06 (第一次更新 - 已过时)

> ⚠️ **以下结论已证明不正确，仅供参考**

#### 生产环境测试 (无认证)
- ❌ 错误结论: 确认生产环境未部署 Synapse Friends API 扩展模块
- ❌ 错误结论: Matrix Synapse 服务器未正确运行
- ✅ 正确发现: Nginx 反向代理正常运行
- 📝 添加了"前端降级方案"章节 (现已证明不需要)

#### 本地测试（原始记录）
- 已完成：运行全量 API 测试脚本并确认通过（好友全流程 + 私聊全流程）
- 已完成：梳理好友系统 v1/v2 端点与数据模型，形成可用于 SDK 的调用清单
- 结果：可按本文件实施方案落地 SDK 与前端；聊天建议由客户端按 Matrix 标准 DM 方案实现

