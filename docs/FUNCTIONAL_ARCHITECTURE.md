项目功能架构与实现方案手册

**版本**: v1.1
**日期**: 2025-12-27
**状态**: 正式发布

---

## 一、 功能清单 (Functional Checklist)

### 1. 核心通讯模块 (Core Communication)
| 功能名称 | Description | 优先级 | 关联模块 |
| :--- | :--- | :--- | :--- |
| **即时消息 (Instant Messaging)** | 支持文本、图片、文件、表情的实时收发与状态回执。 | **P0** | `matrix-client`, `synapse` |
| **端到端加密 (E2EE)** | 基于 Olm/Megolm 协议的消息加密，确保隐私安全。 | **P0** | `e2ee-service`, `crypto-rust` |
| **群组聊天 (Group Chat)** | 支持多人群聊、邀请、踢人、权限管理。 | **P0** | `room-management` |
| **VoIP 通话 (Voice/Video Call)** | 1v1 及多人音视频通话，支持 WebRTC。 | **P1** | `voip-service`, `turn-server` |
| **私密会话 (Private Chat)** | 独立于普通房间的阅后即焚或受控私聊，支持删除会话。 | **P1** | `enhanced-private-chat` |

### 2. 社交与组织模块 (Social & Organization)
| 功能名称 | Description | 优先级 | 关联模块 |
| :--- | :--- | :--- | :--- |
| **好友系统 (Friend System)** | 添加、搜索好友，管理好友列表及分类。 | **P0** | `enhanced-friends`, `user-directory` |
| **空间管理 (Spaces)** | 树状组织架构，支持社区、子频道层级管理 (MSC1772)。 | **P1** | `matrix-spaces` |
| **用户状态 (Presence)** | 实时显示在线、忙碌、离线状态及自定义签名。 | **P1** | `presence-module` |
| **服务发现 (Service Discovery)** | 自动通过 Matrix ID 解析服务器地址。 | **P0** | `well-known` |

### 3. 系统管理模块 (System Administration)
| 功能名称 | Description | 优先级 | 关联模块 |
| :--- | :--- | :--- | :--- |
| **用户管理 (User Admin)** | 管理员对用户账户的增删改查及封禁。 | **P1** | `admin-api`, `synapse-admin` |
| **房间管理 (Room Admin)** | 查询房间详情，清理违规内容或未使用的房间。 | **P2** | `admin-api` |
| **在线监控 (Online Monitoring)** | 实时查看在线用户列表。 | **P2** | `admin-presence-list` |
| **服务器监控 (Monitoring)** | 监控服务器版本、资源使用及联邦状态。 | **P2** | `prometheus`, `grafana` |

---

## 二、 前端实现规范 (Frontend Implementation)

### 1. 技术架构
*   **框架**: Vue 3 + TypeScript + Vite
*   **状态管理**: Pinia (模块化 Store: `auth`, `room`, `friend`, `sync`)
*   **UI 组件库**: Naive UI (搭配 Tailwind CSS 进行原子化布局)
*   **Matrix SDK**: `matrix-js-sdk` (处理底层协议与加密)

### 2. 核心流程与规范
*   **接口调用**:
    *   统一封装 `apiClient`，拦截器处理 Token 注入与 401 刷新。
    *   **核心功能**: 使用 Matrix SDK (`matrixClient.startClient()`) 维护 `/sync` 长连接。
    *   **增强功能**: 使用 REST API 调用 `/_synapse/client/*` (如好友、私密会话)。
*   **组件拆分**:
    *   **Atomic**: 基础 UI (Avatar, Badge, Button)。
    *   **Business**: 业务组件 (ChatInput, RoomList, MessageBubble)。
    *   **Layout**: 布局容器 (MainLayout, Sidebar, ChatWindow)。

### 3. 异常处理
*   **全局捕获**: Vue `errorHandler` 捕获渲染错误。
*   **网络错误**: 统一 Toast 提示 (如 "网络连接中断，重试中...")。
*   **降级策略**: WebSocket 断开时自动切换为 HTTP 轮询；图片加载失败显示占位符。

---

## 三、 后端实现方案 (Backend Implementation)

### 1. 核心架构
*   **服务**: Matrix Synapse (Python/Twisted)
*   **数据库**: PostgreSQL 15 (主从架构支持)
*   **缓存**: Redis 7 (会话、同步流缓存)
*   **网关**: Nginx (反向代理、SSL 卸载、CORS 处理)

### 2. 增强模块实现 (Enhanced Modules)
本项目通过 `EnhancedModule` (`synapse_module.py`) 实现原生 Synapse 缺失的业务功能：
*   **Friends API** (`/_synapse/client/friends`):
    *   **Actions**: `list`, `request`, `accept`, `reject`, `remove`, `search`.
    *   **Logic**: 独立关系表，支持双向好友关系确认。
*   **Private Chat** (`/_synapse/client/private`):
    *   **Actions**: `create`, `send`, `messages`, `sessions`, `delete`.
    *   **Logic**: 轻量级会话，支持**物理删除** (`action=delete`)。
*   **Admin Presence** (`/_synapse/admin/v1/presence/list`):
    *   **Logic**: 提供当前在线用户列表查询接口 (仅管理员可用)。

### 3. 性能优化
*   **Worker 拆分**: 将 `federation_sender`, `pusher`, `client_reader` 拆分为独立 Worker 进程。
*   **数据库优化**: 对 `state_groups_state` 等大表进行索引优化；定期 VACUUM。
*   **连接池**: 使用 `pgbouncer` 管理数据库连接，避免 Synapse 进程耗尽连接数。

---

## 四、 前后端协作要求 (Collaboration)

### 1. 接口文档
*   **标准**: OpenAPI 3.0 (Swagger)
*   **规范**:
    *   所有 API 需包含 `Authorization: Bearer <token>` 头。
    *   增强模块 POST 请求统一使用 JSON Body，字段 `action` 指定操作。
    *   时间戳统一使用毫秒级 Unix Timestamp。
    *   错误码遵循 Matrix 规范 (如 `M_FORBIDDEN`) 或 HTTP 状态码。

### 2. 联调检查清单
*   **跨域 (CORS)**: Nginx 已配置 `Access-Control-Allow-Origin: *`。
*   **文件上传**: 统一使用 `/_matrix/media/v3/upload`，前端需处理 `mxc://` URI 的转换。
*   **Mock 数据**: 前端开发阶段可使用 Mock Service Worker (MSW)，但后端现已提供完整 API，建议直接联调。

---

## 五、 实施计划 (Implementation Plan)

| 阶段 | 任务 | 负责人 | 周期 |
| :--- | :--- | :--- | :--- |
| **Phase 1** | 好友系统前端对接 (Search, Add, List) | 前端组 | 已完成 |
| **Phase 2** | 空间 (Spaces) 侧边栏 UI 实现 | 前端组 | 1周 |
| **Phase 3** | 私密会话删除功能对接 | 前端组 | 3天 |
| **Phase 4** | E2EE 加密全流程验证 | 联调组 | 1周 |

