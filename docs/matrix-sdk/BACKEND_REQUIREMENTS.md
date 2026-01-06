# Matrix SDK 后端待完善事项汇总

> **最后更新**: 2026-01-06 | **文档版本**: 1.2.0
> **用途**: 汇总所有需要后端（Synapse/Matrix 服务器）支持或配置的功能事项

> **相关文档**:
> - [SDK 功能参考](./README.md) - Matrix JS SDK 完整功能文档
> - [前端 PC/移动端要求](./PC_MOBILE_REQUIREMENTS.md) - 前端待实现功能清单
> - [SDK 集成指南](./SDK_INTEGRATION_GUIDE.md) - 本地 SDK 集成文档

---

## 📊 总体状态概览

| 模块 | 前端实现 | 后端支持 | 状态 |
|------|---------|---------|------|
| 客户端基础 | 100% | 100% | ✅ 完成 |
| 身份验证 | 95% | 90% | ⚠️ 部分完成 |
| 房间管理 | 100% | 100% | ✅ 完成 |
| 消息传递 | 94% | 100% | ✅ 完成 |
| 事件处理 | 96% | 100% | ✅ 完成 |
| 端到端加密 | 100% | 100% | ✅ 完成 |
| WebRTC 通话 | 100% | 100% | ✅ 完成 |
| 在线状态/输入提示 | 100% | 100% | ✅ 完成 |
| 媒体文件 | 93% | 100% | ✅ 完成 |
| 搜索功能 | 100% | 100% | ✅ 完成 |
| 好友系统 | 100% | 0% | ❌ 后端未实现，前端使用降级方案 |
| 私聊功能 | 95% | 0% | ❌ 后端未实现，前端使用降级方案 |
| 管理员 API | 68% | 60% | ⚠️ 部分实现 |
| 企业功能 | 100% | 80% | ⚠️ 需要扩展 |

---

## 🔴 高优先级后端需求

### 1. Synapse 扩展 API - 好友系统

**前端实现状态**: 100% ✅
**后端支持状态**: ❌ **未实现** (已测试验证，2026-01-06)

#### 测试结果

**测试日期**: 2026-01-06
**测试服务器**: `https://matrix.cjystx.top`
**测试方法**: HTTP GET/POST 请求测试

| API 端点 | 方法 | 状态码 | 结果 |
|----------|------|--------|------|
| `/_synapse/client/friends?action=list` | GET | 404 | ❌ 未实现 |
| `/_synapse/client/friends?action=pending_requests` | GET | 404 | ❌ 未实现 |
| `/_synapse/client/friends?action=search` | GET | 404 | ❌ 未实现 |
| `/_synapse/client/friends?action=stats` | GET | 404 | ❌ 未实现 |
| `/_synapse/client/friends` | POST | 404 | ❌ 未实现 |

#### 前端降级方案

虽然后端 API 未实现，**前端已实现完整的降级方案**，所有好友功能正常工作：

1. **使用 Matrix 标准 API**
   - `m.direct` 账户数据存储好友关系
   - `m.room.member` 事件管理好友状态
   - Matrix 用户目录 API (`/_matrix/client/v3/user_directory/search`)

2. **前端实现的功能**
   - ✅ 添加/删除好友
   - ✅ 搜索用户
   - ✅ 好友列表展示
   - ✅ 在线状态显示
   - ✅ 好友请求（通过房间邀请）
   - ✅ 好友分类（通过账户数据）

3. **降级代码位置**
   ```typescript
   // src/integrations/synapse/friends.ts
   // src/integrations/matrix/search.ts (searchUsersOptimized)
   // src/stores/friendsV2.ts (完整的好友 Store 实现)
   ```

#### 需要实现的自定义 API 端点

如果需要实现后端好友系统（可选），需要实现以下端点：

```http
# 好友关系管理
GET    /_synapse/client/friends                      # 获取好友列表
POST   /_synapse/client/friends/send_request         # 发送好友请求
POST   /_synapse/client/friends/accept/{userId}      # 接受好友请求
POST   /_synapse/client/friends/reject/{userId}      # 拒绝好友请求
DELETE /_synapse/client/friends/remove/{userId}      # 删除好友
GET    /_synapse/client/friends/pending              # 获取待处理请求
GET    /_synapse/client/friends/search?query=xxx     # 搜索用户
```

#### 后端实现要点

1. **好友关系存储**
   - 在 Synapse 数据库中添加好友关系表
   - 或使用现有的 `event_auth_states` 表通过自定义事件存储

2. **API 认证**
   - 使用 Matrix 标准的 `access_token` 认证
   - 验证请求者权限

3. **与 m.direct 的同步**
   - 接受好友请求时自动创建 DM 房间
   - 更新用户的 `m.direct` 账户数据

#### 优先级建议

**优先级**: 🟡 中低（可选）
**理由**:
- 前端降级方案完全可用，所有功能正常
- 实现 Synapse 扩展需要修改服务器代码
- 建议优先完成其他高优先级功能
- 如需更好的性能和扩展性，可在后期实现

---

### 2. Synapse 扩展 API - 私聊系统

**前端实现状态**: 95% ✅
**后端支持状态**: ❌ **未实现** (已测试验证，2026-01-06)

#### 测试结果

**测试日期**: 2026-01-06
**测试服务器**: `https://matrix.cjystx.top`
**测试方法**: HTTP GET/POST 请求测试

| API 端点 | 方法 | 状态码 | 结果 |
|----------|------|--------|------|
| `/_synapse/client/private?action=list` | GET | 404 | ❌ 未实现 |
| `/_synapse/client/private` | POST | 404 | ❌ 未实现 |

#### 前端降级方案

虽然后端 API 未实现，**前端已实现完整的降级方案**：

1. **使用 Matrix 标准 API**
   - `m.direct` 账户数据管理私聊关系
   - `m.room.membership` 事件管理会话状态
   - 标准 Matrix 房间 API 发送消息

2. **前端实现的功能**
   - ✅ 创建私聊会话
   - ✅ 发送/接收消息
   - ✅ 消息历史加载
   - ✅ 消息 TTL（销毁模式）
   - ✅ 会话列表
   - ✅ 会话隐藏/删除

3. **降级代码位置**
   ```typescript
   // src/integrations/matrix/contacts.ts (getOrCreateDirectRoom)
   // src/stores/privateChatV2.ts (完整的私聊 Store 实现)
   // src/views/private-chat/PrivateChatView.vue (私聊界面)
   ```

#### 需要实现的自定义 API 端点

如果需要实现后端私聊系统（可选），需要实现以下端点：

```http
# 私聊会话管理
GET    /_synapse/client/private?action=list&user_id=xxx        # 获取私聊列表
POST   /_synapse/client/private                                 # 创建私聊会话
POST   /_synapse/client/private?action=delete                   # 删除私聊会话
POST   /_synapse/client/private?action=hide                     # 隐藏私聊会话
GET    /_synapse/client/private?action=history&session_id=xxx    # 获取会话历史
```

#### 优先级建议

**优先级**: 🟡 中低（可选）
**理由**:
- 前端降级方案完全可用，所有功能正常
- Matrix 标准 API 已提供完整的私聊功能
- 建议优先完成其他高优先级功能

---

### 2. Synapse Admin API - 媒体管理

**前端实现状态**: 0% ❌
**后端支持状态**: 需要实现 ⚠️

#### 需要实现的 API 端点

```http
GET    /_synapse/admin/v1/media/{mediaId}                          # 获取媒体信息
GET    /_synapse/admin/v1/media/{serverName}/{mediaId}             # 获取媒体信息（跨服务器）
POST   /_synapse/admin/v1/quarantine_media/{mediaId}               # 隔离媒体
POST   /_synapse/admin/v1/quarantine_media/{serverName}/{mediaId}  # 隔离媒体（跨服务器）
GET    /_synapse/admin/v1/user/{userId}/media                      # 获取用户所有媒体
POST   /_synapse/admin/v1/user/{userId}/media/delete               # 删除用户所有媒体
```

#### 后端实现要点

1. **媒体元数据存储**
   - 在 `media_repository` 表中添加隔离标志
   - 记录媒体上传者和时间戳

2. **隔离功能**
   - 修改媒体服务端点，检查隔离状态
   - 被隔离的媒体返回 404 或特定错误

3. **批量删除**
   - 支持按用户删除所有媒体
   - 清理本地存储和远程缓存

---

### 3. Synapse Admin API - 服务器管理

**前端实现状态**: 0% ❌
**后端支持状态**: 需要实现 ⚠️

#### 需要实现的 API 端点

```http
GET    /_synapse/admin/v1/server_version             # 获取服务器版本
GET    /_synapse/admin/v1/purge_media_status         # 获取媒体清理状态
POST   /_synapse/admin/v1/purge_media_cache          # 清理媒体缓存
GET    /_synapse/admin/v1/users/{userId}/login/as_token  # 生成用户登录令牌（用于调试）
```

#### 后端实现要点

1. **版本信息**
   - 返回 Synapse 版本号
   - 返回支持的 Matrix 规范版本

2. **媒体缓存管理**
   - 实现后台清理任务
   - 返回清理进度状态

3. **调试令牌**
   - 管理员可生成用户的访问令牌
   - 用于调试用户问题

---

## 🟡 中优先级后端需求

### 4. UIA (User-Interactive Authentication) 扩展

**前端实现状态**: 0% ❌
**后端支持状态**: 部分支持 ⚠️

#### 需要支持的认证流程

1. **邮箱验证**
   ```
   POST /_matrix/client/v3/account/password/email/requestToken
   POST /_matrix/client/v3/account/password/email/submitToken
   ```

2. **手机号验证**
   ```
   POST /_matrix/client/v3/account/password/msisdn/requestToken
   POST /_matrix/client/v3/account/password/msisdn/submitToken
   ```

3. **Terms of Service 同意**
   ```
   POST /_matrix/client/v3/account/password/tos
   ```

#### 后端实现要点

1. **邮件服务配置**
   - 配置 SMTP 服务器
   - 实现邮件模板

2. **短信服务集成**
   - 集成短信网关
   - 实现验证码生成和验证

3. **条款管理**
   - 配置服务条款 URL
   - 记录用户同意记录

---

### 5. 审计日志存储

**前端实现状态**: 100% ✅
**后端支持状态**: 仅本地日志 ⚠️

#### 需要实现的 API 端点

```http
GET    /_synapse/admin/v1/audit                    # 获取审计日志
POST   /_synapse/admin/v1/audit/export             # 导出审计日志
```

#### 后端实现要点

1. **日志存储**
   - 在数据库中添加审计日志表
   - 包含：操作者、操作类型、目标、时间戳、结果

2. **查询接口**
   - 支持按时间范围筛选
   - 支持按操作类型筛选
   - 支持按操作者筛选

3. **导出功能**
   - 支持 JSON/CSV 格式导出
   - 支持按日期范围导出

---

## 🟢 低优先级后端需求

### 6. 公开房间目录优化

**前端实现状态**: 80% ⚠️
**后端支持状态**: 标准支持 ✅

#### 建议优化

1. **房间搜索增强**
   - 支持中文拼音搜索
   - 支持模糊匹配

2. **分类标签**
   - 添加房间分类功能
   - 支持按分类筛选

---

### 7. 推送通知网关

**前端实现状态**: 100% ✅
**后端支持状态**: 需要配置 ⚠️

#### 需要配置的推送网关

1. **APNs (Apple Push Notification Service)**
   - 配置 APNs 证书和密钥
   - 使用 `sygnal` 作为推送网关

2. **FCM (Firebase Cloud Messaging)**
   - 配置 FCM 服务端密钥
   - 使用 `sygnal` 作为推送网关

3. **配置示例**

```yaml
# synapse.config.yaml
push:
  include_content: true
  endpoints:
    - url: "https://push.example.com/_matrix/push/v1/notify"
```

---

## 📋 后端配置检查清单

### Synapse 配置检查

- [ ] 启用媒体仓库
  ```yaml
  media_store_path: /var/lib/matrixsynapse/media
  ```

- [ ] 配置 URL 预览
  ```yaml
  url_preview_enabled: true
  url_preview_ip_range_blacklist: [...]
  ```

- [ ] 配置邮件服务器
  ```yaml
  email:
    smtp_host: smtp.example.com
    smtp_port: 587
    smtp_user: "noreply@example.com"
  ```

- [ ] 配置注册策略
  ```yaml
  registrations_requires_3pid: false
  enable_registration: true
  ```

- [ ] 配置房间目录
  ```yaml
  room_list_publication_rules:
    - action: allow
      room_id: "*"
  ```

### 数据库优化

- [ ] 为 `event_json` 表添加索引
  ```sql
  CREATE INDEX idx_event_json_room_id ON event_json(room_id);
  CREATE INDEX idx_event_json_sender ON event_json(sender);
  CREATE INDEX idx_event_json_type ON event_json(type);
  ```

- [ ] 配置定期清理
  ```yaml
  # 删除超过 30 天的旧事件
  redaction_retention_period: 30d
  ```

---

## 🔧 后端开发任务清单

### Phase 1: 核心功能 (高优先级)

1. **实现 Synapse 好友系统扩展**
   - [ ] 设计数据库 schema
   - [ ] 实现 API 端点
   - [ ] 与 m.direct 同步
   - [ ] 编写单元测试
   - [ ] 文档编写

2. **实现媒体管理 API**
   - [ ] 添加隔离功能
   - [ ] 实现批量删除
   - [ ] 添加媒体元数据查询
   - [ ] 编写管理界面

### Phase 2: 管理功能 (中优先级)

3. **实现服务器管理 API**
   - [ ] 版本信息端点
   - [ ] 媒体清理状态
   - [ ] 调试令牌生成

4. **实现审计日志存储**
   - [ ] 设计日志 schema
   - [ ] 实现日志收集
   - [ ] 实现查询接口
   - [ ] 实现导出功能

### Phase 3: 增强功能 (低优先级)

5. **优化公开房间目录**
   - [ ] 添加中文搜索支持
   - [ ] 添加房间分类

6. **配置推送通知**
   - [ ] 部署 sygnal
   - [ ] 配置 APNs
   - [ ] 配置 FCM

---

## 📚 参考文档

### Matrix 规范

- [Matrix Spec - Client-Server API](https://spec.matrix.org/v1.11/client-server-api/)
- [Matrix Spec - Server-Server API](https://spec.matrix.org/v1.11/server-server-api/)
- [Matrix Spec - Application Service API](https://spec.matrix.org/v1.11/application-service-api/)

### Synapse 文档

- [Synapse Admin API](https://matrix-org.github.io/synapse/latest/admin_api/)
- [Synapse Configuration](https://matrix-org.github.io/synapse/latest/configuration/)
- [Synapse Module Development](https://matrix-org.github.io/synapse/latest/modules/)

### 自定义开发

- [Writing Synapse Modules](https://matrix-org.github.io/synapse/latest/modules.html)
- [Synapse Extension APIs](https://matrix-org.github.io/synapse/latest/usage/administration/admin_api/index.html)

---

## 🔗 相关文档

### 项目文档
- [SDK 功能参考](./README.md) - Matrix JS SDK 完整功能文档
- [前端 PC/移动端要求](./PC_MOBILE_REQUIREMENTS.md) - 前端待实现功能清单
- [SDK 集成指南](./SDK_INTEGRATION_GUIDE.md) - 本地 SDK 集成文档
- [认证分析和优化](../../AUTHENTICATION_ANALYSIS_AND_OPTIMIZATION.md) - 项目认证流程分析

### Matrix 规范

- [Matrix Spec - Client-Server API](https://spec.matrix.org/v1.11/client-server-api/)
- [Matrix Spec - Server-Server API](https://spec.matrix.org/v1.11/server-server-api/)
- [Matrix Spec - Application Service API](https://spec.matrix.org/v1.11/application-service-api/)

### Synapse 文档

- [Synapse Admin API](https://matrix-org.github.io/synapse/latest/admin_api/)
- [Synapse Configuration](https://matrix-org.github.io/synapse/latest/configuration/)
- [Synapse Module Development](https://matrix-org.github.io/synapse/latest/modules/)

### 自定义开发

- [Writing Synapse Modules](https://matrix-org.github.io/synapse/latest/modules.html)
- [Synapse Extension APIs](https://matrix-org.github.io/synapse/latest/usage/administration/admin_api/index.html)

---

**最后更新**: 2026-01-06
**文档版本**: 1.2.0
**维护者**: HuLaMatrix 开发团队

**更新内容 (v1.2.0)**:
- ✅ 添加后端 API 测试结果（Friends, Private Chat）
- ✅ 更新后端实现状态为"未实现"（基于 404 测试结果）
- ✅ 添加前端降级方案详细说明
- ✅ 更新优先级建议为"中低（可选）"
- ✅ 说明前端已实现完整功能，使用 Matrix 标准 API
- ✅ 添加降级代码位置说明
