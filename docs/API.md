# 后端技术文档与 API 接口规范

**版本**: v1.0
**最后更新**: 2025-12-27
**状态**: 正式发布

---

## 一、 功能模块 (Functional Modules)

后端系统基于 Matrix Synapse 构建，通过自定义模块 (`EnhancedModule`) 扩展了原生不支持的业务功能。

### 1. 核心通讯模块 (Core Communication)
*   **功能**: 即时消息 (IM)、群组聊天、端到端加密 (E2EE)、VoIP 信令、用户状态 (Presence)。
*   **实现**: 原生 Synapse 功能。
*   **依赖**: Matrix Client SDK, PostgreSQL (存储), Redis (缓存)。

### 2. 好友系统 (Friend System)
*   **功能**: 独立于 Matrix Room 的好友关系管理，支持添加、接受、拒绝、删除及分组。
*   **业务逻辑**:
    *   双向确认机制：A 请求 -> B 接受 -> 建立关系。
    *   状态管理：Pending (待处理), Accepted (已接受), Rejected (已拒绝)。
*   **技术实现**: `FriendsResource` 封装，独立数据库表 `user_friends`, `friend_requests` (推测)。

### 3. 私密会话 (Private Chat)
*   **功能**: 轻量级、可销毁的端到端加密会话，支持阅后即焚。
*   **业务逻辑**:
    *   独立于标准 Matrix Room，元数据存储在 `private_chat_sessions`。
    *   消息存储在 `private_messages`，支持 TTL (Time-To-Live)。
    *   支持物理删除会话及其所有消息。
*   **技术实现**: `PrivateChatResource` + `PrivateChatManager`。

### 4. 系统管理 (System Administration)
*   **功能**: 用户管理、房间管理、在线用户监控、隐私屏蔽与举报管理。
*   **技术实现**: Synapse Admin API + 自定义 `AdminPresenceListResource` + `PrivacyResource`。

---

## 二、 API 接口规范 (API Reference)

所有增强 API 均位于 `/_synapse/client` (客户端) 或 `/_synapse/admin` (管理端) 命名空间下。

### 通用规范
*   **鉴权**: `Authorization: Bearer <access_token>`
*   **格式**: JSON
*   **错误码**:
    *   `M_MISSING_TOKEN`: 未提供 Token (401)
    *   `M_FORBIDDEN`: 权限不足 (403)
    *   `M_LIMIT_EXCEEDED`: 速率限制 (429)
    *   `M_UNRECOGNIZED`: 未识别的 Action (404)

---

### 1. 好友系统 (Friends API)

**Base URL**: `/_synapse/client/friends`

#### 1.1 获取好友列表
*   **Method**: `GET`
*   **Query Params**:
    *   `action`: `list` (必填)
    *   `user_id`: 目标用户 ID (可选，默认为当前用户)
*   **Response**:
    ```json
    {
      "status": "ok",
      "friends": [
        { "user_id": "@alice:example.com", "displayname": "Alice", "avatar_url": "mxc://..." }
      ]
    }
    ```

#### 1.2 发送好友请求
*   **Method**: `POST`
*   **Body**:
    ```json
    {
      "action": "request",
      "target_id": "@bob:example.com",
      "message": "Hi Bob!",
      "category_id": "default"
    }
    ```
*   **Response**:
    ```json
    { "status": "ok", "request_id": "req_12345" }
    ```

#### 1.3 接受/拒绝请求
*   **Method**: `POST`
*   **Body**:
    ```json
    {
      "action": "accept", // 或 "reject"
      "request_id": "req_12345"
    }
    ```

#### 1.4 删除好友
*   **Method**: `POST`
*   **Body**:
    ```json
    {
      "action": "remove",
      "friend_id": "@bob:example.com"
    }
    ```

#### 1.5 搜索用户
*   **Method**: `GET`
*   **Query Params**:
    *   `action`: `search`
    *   `query`: 搜索关键词 (MXID 或 昵称)
    *   `limit`: 数量限制 (默认 20)
*   **Response**:
    ```json
    {
      "status": "ok",
      "users": [ ... ]
    }
    ```

---

### 2. 私密会话 (Private Chat API)

**Base URL**: `/_synapse/client/private`

#### 2.1 创建会话
*   **Method**: `POST`
*   **Body**:
    ```json
    {
      "action": "create",
      "participants": ["@bob:example.com"],
      "session_name": "Secret Chat",
      "ttl_seconds": 86400,
      "auto_delete": false
    }
    ```
*   **Response**:
    ```json
    { "status": "ok", "session_id": "uuid-..." }
    ```

#### 2.2 发送消息
*   **Method**: `POST`
*   **Body**:
    ```json
    {
      "action": "send",
      "session_id": "uuid-...",
      "content": "Encrypted Payload...",
      "type": "text"
    }
    ```

#### 2.3 获取会话列表
*   **Method**: `GET`
*   **Query Params**: `action=sessions`
*   **Response**:
    ```json
    {
      "status": "ok",
      "sessions": [
        { "id": "...", "session_name": "...", "last_activity": "..." }
      ]
    }
    ```

#### 2.4 获取消息历史
*   **Method**: `GET`
*   **Query Params**:
    *   `action`: `messages`
    *   `session_id`: 会话 ID
    *   `limit`: 条数
    *   `before`: 分页游标
*   **Response**:
    ```json
    {
      "status": "ok",
      "messages": [ ... ]
    }
    ```

#### 2.5 删除会话
*   **Method**: `POST`
*   **Body**:
    ```json
    {
      "action": "delete",
      "session_id": "uuid-..."
    }
    ```
*   **说明**: 物理删除数据库记录，不可恢复。

---

### 3. 隐私与反馈 (Privacy & Feedback API)

**Base URL**: `/_synapse/client/privacy` (隐私) / `/_synapse/client/feedback` (反馈)

#### 3.1 举报与屏蔽
*   **Method**: `POST`
*   **Body**:
    ```json
    {
      "action": "report_user", // 或 report_room, block_user, unblock_user, block_room, unblock_room
      "target_id": "@bad:example.com", // 或 roomId
      "reason": "Spam content" // 可选
    }
    ```
*   **Response**: `{ "status": "ok" }`

#### 3.2 获取屏蔽与举报列表
*   **Method**: `GET`
*   **Query Params**: `action=list_blocked_users` (或 `list_blocked_rooms`, `list_reports`)
*   **Response**:
    ```json
    {
      "status": "ok",
      "users": [ { "mxid": "@bad:example.com", "blocked_at": 1234567890 } ]
    }
    ```

#### 3.3 提交反馈
*   **Method**: `POST`
*   **Headers**: `Content-Type: application/json` 或 `multipart/form-data`
*   **Body (JSON)**:
    ```json
    {
      "subject": "Bug Report",
      "content": "App crashes on login",
      "attachment": "mxc://..." // 可选，推荐使用 Matrix Media API 上传后填入 mxc
    }
    ```
*   **说明**: 若使用 `multipart/form-data`，附件可直接通过 `file` 字段上传（不推荐，建议走 mxc）。

---

### 4. 管理员接口 (Admin API)

本系统集成了 Synapse 原生 Admin API 及自定义扩展 API。所有管理接口均需管理员权限 (`is_admin=true`)。

#### 3.1 扩展管理接口 (Extended Admin)

##### 3.1.1 获取在线用户列表
*   **URL**: `/_synapse/admin/v1/presence/list`
*   **Method**: `GET`
*   **Response**:
    ```json
    {
      "status": "ok",
      "users": [
        { "user_id": "@admin:...", "created_at": 167888..., "presence": "offline" }
      ]
    }
    ```

##### 3.1.2 增强模块状态查询
*   **URL**: `/_synapse/client/enhanced/status`
*   **Method**: `GET`
*   **Response**:
    ```json
    {
      "initialized": true,
      "features": { ... }
    }
    ```

#### 3.2 用户管理 (User Administration)

*   **List Users**: `GET /_synapse/admin/v2/users`
    *   列出服务器上的所有用户，支持分页和排序。
*   **Query User**: `GET /_synapse/admin/v2/users/{userId}`
    *   查询特定用户的详细信息。
*   **Create/Modify User**: `PUT /_synapse/admin/v2/users/{userId}`
    *   创建新用户或修改现有账户（密码、显示名等）。
*   **Deactivate User**: `POST /_synapse/admin/v1/deactivate/{userId}`
    *   停用用户账户，使其无法登录。
*   **Reset Password**: `POST /_synapse/admin/v1/reset_password/{userId}`
    *   强制重置用户密码。
*   **User Admin Status**: `PUT /_synapse/admin/v1/users/{userId}/admin`
    *   授予或撤销用户的服务器管理员权限。

#### 3.3 房间管理 (Room Administration)

*   **List Rooms**: `GET /_synapse/admin/v1/rooms`
    *   列出服务器上的所有房间。
*   **Room Details**: `GET /_synapse/admin/v1/rooms/{roomId}`
    *   获取房间的详细元数据和状态。
*   **Delete Room**: `DELETE /_synapse/admin/v1/rooms/{roomId}`
    *   从服务器中删除房间，可选择清理历史记录。
*   **Make Room Admin**: `POST /_synapse/admin/v1/rooms/{roomId}/make_room_admin`
    *   将指定用户提升为房间管理员。

#### 3.4 媒体管理 (Media Administration)

*   **List Media**: `GET /_synapse/admin/v1/media/{serverName}/list`
    *   列出指定时间段内的媒体文件。
*   **Delete Media**: `POST /_synapse/admin/v1/media/delete`
    *   删除指定媒体文件或清理过期媒体。
*   **Purge Remote Media**: `POST /_synapse/admin/v1/purge_media_cache`
    *   清理远程服务器的媒体缓存。

#### 3.5 服务器管理 (Server Administration)

*   **Server Version**: `GET /_synapse/admin/v1/server_version`
    *   获取 Synapse 服务器版本信息。
*   **Event Reports**: `GET /_synapse/admin/v1/event_reports`
    *   查看用户举报的违规内容。

---

## 三、 数据库结构 (Database Schema)

### 1. 私密会话表 (`private_chat_sessions`)
| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | UUID | 主键 |
| `session_name` | VARCHAR | 会话名称 |
| `creator_id` | VARCHAR | 创建者 MXID |
| `participant_ids` | TEXT[] | 参与者列表 |
| `encryption_key_id`| VARCHAR | 密钥 ID |
| `ttl_seconds` | INTEGER | 消息存活时间 |
| `auto_delete` | BOOLEAN | 自动销毁开关 |

### 2. 私密消息表 (`private_messages`)
| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | UUID | 主键 |
| `session_id` | UUID | 外键 -> 会话 |
| `sender_id` | VARCHAR | 发送者 |
| `encrypted_content`| TEXT | 加密内容 |
| `nonce` | VARCHAR | 加密随机数 |
| `expires_at` | TIMESTAMP | 过期时间 |

---

## 四、 缓存与性能 (Performance)

1.  **缓存策略**:
    *   **Session Keys**: 内存缓存 (`PrivateChatManager.session_keys`)，减少 DB 读取。
    *   **Synapse Caches**: 利用 Synapse 内置的 Redis 缓存机制处理用户状态与 Sync 流。

2.  **连接池**:
    *   使用 `asyncpg` 连接池，配置 `min_size=5`, `max_size=20`。
    *   生产环境建议配合 `pgbouncer` 使用。

3.  **限流**:
    *   复用 Synapse 的 `rc_message` 和 `rc_login` 配置。
    *   注册接口默认限流：0.2 r/s, burst 5。

---

## 五、 第三方集成 (Integrations)

1.  **Push Notifications**: 集成 Firebase/APNs (通过 Sygnal)。
2.  **Identity Server**: 可选集成 Sydent 用于邮箱/手机号发现。
3.  **TURN Server**: 用于 VoIP 穿透 (coturn)。

