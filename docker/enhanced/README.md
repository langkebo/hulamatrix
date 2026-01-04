# HuLaMatrix Synapse Enhanced Module

## 概述

这是 HuLaMatrix 的 Synapse 增强模块，实现了 V1 和 V2 REST API 端点，用于好友系统和私聊增强功能。

## 版本支持

### V1 (Legacy/Compatible) 路径

基础路径: `/_synapse/client/enhanced/friends/*`, `/_synapse/client/enhanced/private/*`

- 被 matrix-js-sdk 39.1.3 用于向后兼容
- 同时兼容 v1 和 v2 后端

### V2 (Explicit Versioning) 路径

基础路径: `/_synapse/client/enhanced/friends/v2/*`, `/_synapse/client/enhanced/private_chat/v2/*`

- 显式版本控制，便于未来 API 演化
- 镜像 v1 功能，具有清晰的版本路径

## 路径映射

| 操作 | V1 路径 | V2 路径 |
|------|---------|---------|
| 列出好友 | GET `/_synapse/client/enhanced/friends/list` | GET `/_synapse/client/enhanced/friends/v2/list` |
| 获取分类 | GET `/_synapse/client/enhanced/friends/categories` | - |
| 获取待处理请求 | GET `/_synapse/client/enhanced/friends/requests/pending` | - |
| 发送请求 | POST `/_synapse/client/enhanced/friends/request` | POST `/_synapse/client/enhanced/friends/v2/request` |
| 接受请求 | POST `/_synapse/client/enhanced/friends/request/accept` | POST `/_synapse/client/enhanced/friends/v2/request/accept` |
| 拒绝请求 | POST `/_synapse/client/enhanced/friends/request/reject` | POST `/_synapse/client/enhanced/friends/v2/request/reject` |
| 删除好友 | DELETE `/_synapse/client/enhanced/friends/remove` | DELETE `/_synapse/client/enhanced/friends/v2/remove` |
| 列出会话 | GET `/_synapse/client/enhanced/private/sessions` | GET `/_synapse/client/enhanced/private_chat/v2/sessions` |
| 发送消息 | POST `/_synapse/client/enhanced/private/send` | POST `/_synapse/client/enhanced/private_chat/v2/send` |
| 删除会话 | DELETE `/_synapse/client/enhanced/private/session/:id` | DELETE `/_synapse/client/enhanced/private_chat/v2/session/:id` |

## 文件说明

### synapse_module.py

Synapse 服务器端模块，实现 V1/V2 REST API 端点。

**主要组件**:
- `FriendsRestV2Resource` - 好友系统 API 资源类
- `PrivateChatRestV2Resource` - 私聊系统 API 资源类
- `register_servlets()` - 注册 API 端点
- `register_module()` - Synapse 模块注册钩子

### v2_api_test.py

API 测试套件，验证 V1/V2 端点功能。

**使用方法**:
```bash
python v2_api_test.py <access_token> <user_id>
```

**示例**:
```bash
python v2_api_test.py syt_abc123def456 '@user:matrix.cjystx.top'
```

## 安装配置

### 1. Synapse 配置

在 Synapse 配置文件 (`homeserver.yaml`) 中添加模块:

```yaml
modules:
  - module: docker.enhanced.synapse_module
    config:
      # 模块配置（如果需要）
      enabled: true
```

### 2. 安装模块

将模块文件复制到 Synapse 的模块目录:

```bash
# 创建模块目录
mkdir -p /path/to/synapse/modules

# 复制模块文件
cp synapse_module.py /path/to/synapse/modules/
```

### 3. 重启 Synapse

```bash
# 使用 systemd
sudo systemctl restart synapse

# 或使用 Docker
docker restart synapse
```

### 4. 验证安装

运行测试套件验证 API 端点:

```bash
python v2_api_test.py <access_token> <user_id>
```

## 前端集成

### matrix-js-sdk 配置

SDK 已配置使用 V1 路径（兼容路径）:

```typescript
// Friends API
basePath = "/_synapse/client/enhanced/friends"

// Private Chat API
basePath = "/_synapse/client/enhanced/private"
```

### V2 路径使用

如需使用 V2 路径，可以更新 SDK 的 HTTP API 层:

```typescript
// 更新 friends.ts
private readonly basePath = "/_synapse/client/enhanced/friends/v2";

// 更新 private-chat.ts
private readonly basePath = "/_synapse/client/enhanced/private_chat/v2";
```

## API 使用示例

### 好友系统

#### 列出好友 (V1)

```bash
curl -X GET \
  https://matrix.cjystx.top/_synapse/client/enhanced/friends/list \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### 发送好友请求 (V2)

```bash
curl -X POST \
  https://matrix.cjystx.top/_synapse/client/enhanced/friends/v2/request \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "@friend:matrix.cjystx.top",
    "message": "请加我好友"
  }'
```

#### 接受好友请求 (V2)

```bash
curl -X POST \
  https://matrix.cjystx.top/_synapse/client/enhanced/friends/v2/request/accept \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "123"
  }'
```

### 私聊系统

#### 列出会话 (V1)

```bash
curl -X GET \
  https://matrix.cjystx.top/_synapse/client/enhanced/private/sessions \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### 发送消息 (V2)

```bash
curl -X POST \
  https://matrix.cjystx.top/_synapse/client/enhanced/private_chat/v2/send \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "friend_id": "@friend:matrix.cjystx.top",
    "content": {
      "msgtype": "m.text",
      "body": "你好！"
    }
  }'
```

## 数据库表结构

### friends

```sql
CREATE TABLE friends (
    user_id TEXT NOT NULL,
    friend_id TEXT NOT NULL,
    category_id INTEGER,
    note TEXT,
    created_ts BIGINT,
    PRIMARY KEY (user_id, friend_id)
);
```

### friend_requests

```sql
CREATE TABLE friend_requests (
    request_id INTEGER PRIMARY KEY,
    from_user_id TEXT NOT NULL,
    to_user_id TEXT NOT NULL,
    message TEXT,
    state TEXT NOT NULL,  -- 'pending', 'accepted', 'rejected'
    created_ts BIGINT
);
```

### friend_categories

```sql
CREATE TABLE friend_categories (
    category_id INTEGER PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    order_index INTEGER
);
```

### private_chat_sessions

```sql
CREATE TABLE private_chat_sessions (
    session_id INTEGER PRIMARY KEY,
    user_id TEXT NOT NULL,
    friend_id TEXT NOT NULL,
    created_ts BIGINT,
    updated_ts BIGINT,
    last_message_ts BIGINT
);
```

## 测试

### 运行测试套件

```bash
# 确保已安装依赖
pip install requests

# 运行测试
python v2_api_test.py <access_token> <user_id>
```

### 预期输出

```
================================================================================
Testing Friends API V1 Endpoints
================================================================================
✅ PASS - V1 - List Friends
✅ PASS - V1 - Get Pending Requests
✅ PASS - V1 - Get Categories
✅ PASS - V1 - Search Users

================================================================================
Testing Friends API V2 Endpoints
================================================================================
✅ PASS - V2 - List Friends
✅ PASS - V2 - Send Friend Request
✅ PASS - V2 - Accept Friend Request
✅ PASS - V2 - Reject Friend Request

================================================================================
Test Summary
================================================================================
Total Tests: 20
Passed: 18 ✅
Failed: 2 ❌
Success Rate: 90.0%
```

## 故障排查

### 模块未加载

检查 Synapse 日志:
```bash
tail -f /var/log/synapse/homeserver.log | grep "V1/V2 REST"
```

### 端点返回 404

1. 确认模块已正确加载
2. 检查 Synapse 配置
3. 重启 Synapse 服务

### 认证失败

1. 验证 access_token 是否有效
2. 检查用户权限
3. 确认 token 未过期

## 版本历史

### v2.0.0 (2026-01-03)

- ✅ 实现 V1 REST API 端点
- ✅ 实现 V2 REST API 端点
- ✅ V1/V2 路径兼容性
- ✅ 完整的测试套件
- ✅ 详细的文档

## 相关文档

- [matrix-js-sdk README](../../docs/matrix-sdk/README.md)
- [Friends System Documentation](../../docs/matrix-sdk/11-friends-system.md)
- [Private Chat Documentation](../../docs/matrix-sdk/12-private-chat.md)
- [Admin API Documentation](../../docs/matrix-sdk/13-admin-api.md)

## 支持

如有问题或建议，请联系 HuLaMatrix 开发团队。

---

**版本**: 2.0.0
**最后更新**: 2026-01-03
**作者**: HuLaMatrix Team
