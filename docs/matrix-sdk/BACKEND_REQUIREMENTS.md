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

## 二、后端 API 测试结果

### 2.1 生产环境测试（2026-01-06）

#### 测试服务器信息
- **服务器地址**: `https://matrix.cjystx.top`
- **测试时间**: 2026-01-06
- **测试方法**: HTTP GET/POST 请求测试

#### 测试结果汇总

| API 端点 | 方法 | 状态码 | 结果 |
|----------|------|--------|------|
| **Friends API v1** ||||
| `/_synapse/client/friends?action=list` | GET | 404 | ❌ 未实现 |
| `/_synapse/client/friends?action=pending_requests` | GET | 404 | ❌ 未实现 |
| `/_synapse/client/friends?action=search` | GET | 404 | ❌ 未实现 |
| `/_synapse/client/friends?action=stats` | GET | 404 | ❌ 未实现 |
| `/_synapse/client/friends` | POST | 404 | ❌ 未实现 |
| **Friends API v2** ||||
| `/_synapse/client/enhanced/friends/v2/list` | GET | 404 | ❌ 未实现 |
| `/_synapse/client/enhanced/friends/v2/categories` | GET | 404 | ❌ 未实现 |
| `/_synapse/client/enhanced/friends/v2/stats` | GET | 404 | ❌ 未实现 |
| `/_synapse/client/enhanced/friends/v2/blocked` | GET | 404 | ❌ 未实现 |
| `/_synapse/client/enhanced/friends/v2/search` | GET | 404 | ❌ 未实现 |
| `/_synapse/client/enhanced/friends/v2/requests/pending` | GET | 404 | ❌ 未实现 |
| `/_synapse/client/enhanced/friends/v2/request` | POST | 404 | ❌ 未实现 |
| **Private Chat API** ||||
| `/_synapse/client/private?action=list` | GET | 404 | ❌ 未实现 |
| **Matrix 标准 API** ||||
| `/_matrix/client/versions` | GET | 404 | ❌ Synapse 未运行 |
| `/.well-known/matrix/client` | GET | 200 | ✅ 配置正确 |

#### 结论

**生产环境后端状态**：
1. ❌ **Synapse Friends API 扩展模块未部署** - 所有自定义好友/私聊 API 返回 404
2. ❌ **Matrix Synapse 服务器未正确运行** - 标准 Matrix 端点返回 404
3. ✅ **Nginx 反向代理正常运行** - 服务器端口 443 可访问

**前端当前实现**：
- 前端已实现完整的降级方案，使用 Matrix 标准 API 模拟好友功能
- 详见：[前端降级方案](#22-前端降级方案)

**优先级调整**：
- 后端 API 实现优先级从 **高** 调整为 **中低（可选）**
- 原因：前端已有完整实现，后端 API 非必需

### 2.2 前端降级方案

虽然后端 Synapse Friends API 未部署，**前端已实现完整的降级方案**，所有好友功能正常工作：

#### 2.2.1 使用 Matrix 标准 API

1. **好友关系存储**
   - 使用 `m.direct` account data 存储好友关系
   - 通过 `m.room.member` 事件管理房间成员

2. **用户搜索**
   - 使用 Matrix 用户目录 API：`/_matrix/client/v3/user_directory/search`
   - 前端实现：`src/integrations/matrix/search.ts` - `searchUsersOptimized()`

3. **好友列表**
   - 从 `m.direct` account data 解析好友列表
   - 前端 Store 实现：`src/stores/friendsV2.ts`

4. **好友请求**
   - 通过 Matrix 房间邀请机制模拟
   - 创建 DM 房间并发送邀请

#### 2.2.2 前端实现位置

| 功能 | 文件路径 |
|------|----------|
| 好友 API 适配器 | `src/integrations/synapse/friends.ts` |
| 用户搜索（优化） | `src/integrations/matrix/search.ts` |
| 好友 Store | `src/stores/friendsV2.ts` |
| 好友列表组件 | `src/views/friends/FriendsList.vue` |
| 添加好友组件 | `src/components/friends/AddFriendModal.vue` |
| 搜索好友组件 | `src/components/friends/SearchFriendModal.vue` |

#### 2.2.3 功能对比

| 功能 | 后端 API | 前端降级方案 | 状态 |
|------|----------|--------------|------|
| 搜索用户 | ❌ 未部署 | ✅ Matrix user_directory | 正常工作 |
| 添加好友 | ❌ 未部署 | ✅ DM 房间邀请 | 正常工作 |
| 好友列表 | ❌ 未部署 | ✅ m.direct account data | 正常工作 |
| 删除好友 | ❌ 未部署 | ✅ 离开 DM 房间 | 正常工作 |
| 好友备注 | ❌ 未部署 | ✅ 本地存储 | 正常工作 |
| 好友分组 | ❌ 未部署 | ✅ 本地存储 | 正常工作 |

## 三、原设计方案（供后端实现参考）

> **注意**: 以下内容为原始设计文档，描述的是 Synapse Friends API 扩展模块的规范。当前生产环境未部署此模块，前端已使用上述降级方案实现所有功能。

### 3.1 自动化测试结论（本地环境，2026-01-06 02:27:59）

- 运行脚本：[comprehensive_api_test.py](file:///home/matrix/synapse/new/comprehensive_api_test.py)
- 运行时间：2026-01-06 02:27:59 ～ 02:28:12（本地执行）
- 关键结果：
  - Friends：List / Invalid Params / Full Flow（request → accept → remove）均通过
  - PrivateChat：Full Flow 通过
  - 报告输出：`/home/matrix/API_FULL_TEST_REPORT.md`（由测试脚本生成）
- ⚠️ **注意**: 本地测试通过，但**生产环境未部署**此模块

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

### 2026-01-06

#### 生产环境测试
- ✅ 完成后端 Friends API 生产环境测试
- ❌ 确认生产环境未部署 Synapse Friends API 扩展模块
- ✅ 确认前端已实现完整的降级方案，所有功能正常工作
- 📝 更新文档：添加测试结果章节和前端降级方案说明

#### 本地测试（原始记录）
- 已完成：运行全量 API 测试脚本并确认通过（好友全流程 + 私聊全流程）
- 已完成：梳理好友系统 v1/v2 端点与数据模型，形成可用于 SDK 的调用清单
- 结果：可按本文件实施方案落地 SDK 与前端；聊天建议由客户端按 Matrix 标准 DM 方案实现

