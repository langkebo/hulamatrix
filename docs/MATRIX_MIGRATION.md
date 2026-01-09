# Matrix 服务架构迁移跟踪

## 概述

将 Matrix 服务从分散的 `src/integrations/matrix/` 和 `src/services/` 迁移到统一的 `src/matrix/` 架构。

**迁移目标:**
- 统一 Matrix 服务位置到 `src/matrix/`
- 创建清晰的模块边界（core、services、types）
- 保持向后兼容性（re-export facades）
- 消除 `any` 类型，提升类型安全

## 迁移进度

### ✅ Phase 0: 准备阶段
- [x] 分析现有架构
- [x] 识别关键依赖
- [x] 设计目标结构
- [x] 创建 `src/matrix/` 目录结构
- [x] 更新 `tsconfig.json` 添加 `@/matrix/*` 路径别名

### ✅ Phase 1: 核心 Client 和基础模块迁移
**Commit:** `979fba12`

**已迁移:**
- `src/matrix/core/client.ts` - Matrix client 核心模块
- `src/matrix/core/auth.ts` - 认证模块
- `src/matrix/core/discovery.ts` - 服务发现

**服务模块:**
- `src/matrix/services/auth/uia.ts` - UIA (User Interactive Auth)
- `src/matrix/services/crypto/manager.ts` - 加密管理器
- `src/matrix/services/presence/` - 在线状态服务 (8 个文件)
  - account-check.ts, announcement.ts, beacon.ts, poll.ts
  - read-receipt.ts, screen-share.ts, service.ts, typing-notifier.ts
- `src/matrix/services/sync/sliding.ts` - 滑动同步

**核心加密模块:**
- `src/matrix/core/crypto.ts` - 加密工具
- `src/matrix/core/e2ee.ts` - 端到端加密
- `src/matrix/core/encryption.ts` - 加密管理

**Re-export facades:**
- `src/integrations/matrix/crypto.ts` → `@/matrix/core/crypto`
- `src/integrations/matrix/e2ee.ts` → `@/matrix/core/e2ee`
- `src/integrations/matrix/encryption.ts` → `@/matrix/core/encryption`
- `src/services/matrixCryptoManager.ts` → `@/matrix/services/crypto/manager`
- `src/services/matrixUiaService.ts` → `@/matrix/services/auth/uia`
- 等 8 个服务文件

### ✅ Phase 2: 核心 Client 模块
**Commit:** `de6580ad`

已迁移核心 Matrix client 模块到 `src/matrix/core/`

### ✅ Phase 3: 媒体服务迁移
**Commit:** `ee695035`

**已迁移:**
- `src/matrix/services/media/` - 媒体服务模块
- 上传、下载、缓存管理

### ✅ Phase 4: 房间服务迁移
**Commits:** `be9e9fa8`, `07daf0e2`

**已迁移:**
- `src/matrix/core/rooms.ts` (458 行) - 房间操作核心
- `src/matrix/core/members.ts` (27 行) - 成员列表
- `src/matrix/core/power-levels.ts` (46 行) - 权限级别
- `src/matrix/core/alias.ts` (11 行) - 房间别名
- `src/matrix/core/spaces.ts` - 基础空间功能

**服务模块:**
- `src/matrix/services/room/manager.ts` (916 行) - 高级房间管理
- `src/matrix/services/room/spaces.ts` (1200 行) - 空间层级管理
- `src/matrix/services/room/service.ts` (1001 行) - RoomService 类
- `src/matrix/services/room/utils.ts` (154 行) - 房间工具函数

**搜索服务:**
- `src/matrix/services/search/room.ts` (512 行) - 房间搜索
- `src/matrix/services/search/space.ts` (451 行) - 空间搜索

### ✅ Phase 5: 消息服务迁移
**Commits:** `149e2c21`, `bf129084`

**已迁移:**
- `src/matrix/services/message/sync.ts` (548 行) - MessageSyncService
  - 消息状态管理 (pending, sent, delivered, read, failed)
  - 消息去重 (eventId 追踪)
  - 重试机制 (指数退避)
  - 状态变更回调

- `src/matrix/services/message/decrypt.ts` (420 行) - MessageDecryptService
  - E2EE 消息解密
  - 队列化解密处理
  - 房间密钥管理
  - 不可解密消息处理

- `src/matrix/services/message/event-handler.ts` - 事件处理器

**核心模块:**
- `src/matrix/core/messages.ts` - 消息处理
- `src/matrix/core/threads.ts` - 线程处理
- `src/matrix/core/typing.ts` - 输入指示器
- `src/matrix/core/reactions.ts` - 消息反应
- `src/matrix/core/receipts.ts` - 已读回执
- `src/matrix/core/history.ts` - 消息历史

### ✅ Phase 6: 空间和通知服务迁移
**Commit:** `318dd29e`

**已迁移:**
- `src/matrix/services/notification/` - 通知服务模块
- `src/matrix/core/notifications.ts` (15202 行) - 通知核心
- `src/matrix/core/pushers.ts` (1920 行) - 推送设置

### ✅ 导入路径更新
**Commit:** `da3950ab`

更新整个代码库的导入路径:
- 40 个组件文件
- 8 个 store 文件
- 4 个 composables/hooks 文件
- 工具和策略文件

## 当前架构

```
src/matrix/
├── core/                      # 核心模块
│   ├── client.ts             # Matrix Client
│   ├── auth.ts               # 认证
│   ├── discovery.ts          # 服务发现
│   ├── alias.ts              # 房间别名验证
│   ├── crypto.ts             # 加密工具
│   ├── e2ee.ts               # 端到端加密
│   ├── encryption.ts         # 加密管理
│   ├── history.ts            # 消息历史
│   ├── members.ts            # 成员列表
│   ├── messages.ts           # 消息处理
│   ├── notifications.ts      # 通知核心
│   ├── power-levels.ts       # 权限级别
│   ├── pushers.ts            # 推送设置
│   ├── reactions.ts          # 消息反应
│   ├── receipts.ts           # 已读回执
│   ├── rooms.ts              # 房间操作核心
│   ├── spaces.ts             # 基础空间功能
│   ├── threads.ts            # 线程处理
│   ├── typing.ts             # 输入指示器
│   ├── types.ts              # 类型定义
│   └── media-crypto.ts       # 媒体加密
├── services/                  # 服务层
│   ├── auth/                 # 认证服务
│   │   └── uia.ts           # UIA
│   ├── call/                 # 通话服务
│   ├── crypto/               # 加密服务
│   │   └── manager.ts       # 加密管理器
│   ├── media/                # 媒体服务
│   ├── message/              # 消息服务
│   │   ├── decrypt.ts       # 消息解密
│   │   ├── event-handler.ts # 事件处理
│   │   └── sync.ts          # 消息同步
│   ├── notification/         # 通知服务
│   ├── presence/             # 在线状态服务 (8 文件)
│   ├── room/                 # 房间服务
│   │   ├── manager.ts       # 房间管理器
│   │   ├── service.ts       # RoomService
│   │   ├── spaces.ts        # Spaces 服务
│   │   └── utils.ts         # 工具函数
│   ├── search/               # 搜索服务
│   │   ├── room.ts          # 房间搜索
│   │   └── space.ts         # 空间搜索
│   └── sync/                 # 同步服务
│       └── sliding.ts       # 滑动同步
└── types/                    # 类型定义
```

## 待办事项

### 🔴 高优先级

1. **清理遗留代码**
   - [ ] 移除已废弃的 `message-router.ts`
   - [ ] 清理未使用的 `src/services/` 中的遗留服务
   - [ ] 验证所有 re-export facades 的使用情况

2. **类型安全改进**
   - [ ] 修复 `src/matrix/services/room/spaces.ts` 中的 `any` 类型 (1 处)
   - [ ] 修复 `src/components/spaces/` 中的 `any` 类型 (5 处)
   - [ ] 修复 `src/integrations/matrix/` 中的 `any` 类型 (3 处)

### 🟡 中优先级

3. **文档完善**
   - [ ] 更新 ARCHITECTURE.md 反映新结构
   - [ ] 添加 API 文档
   - [ ] 创建迁移指南

4. **测试覆盖**
   - [ ] 更新测试用例的导入路径
   - [ ] 确保所有迁移模块有测试覆盖

### 🟢 低优先级

5. **性能优化**
   - [ ] 评估服务初始化性能
   - [ ] 优化导入依赖

## 文件映射

### 完全迁移模块

| 旧路径 | 新路径 | Commit |
|--------|--------|--------|
| `src/integrations/matrix/crypto.ts` | `src/matrix/core/crypto.ts` | 979fba12 |
| `src/integrations/matrix/e2ee.ts` | `src/matrix/core/e2ee.ts` | 979fba12 |
| `src/integrations/matrix/encryption.ts` | `src/matrix/core/encryption.ts` | 979fba12 |
| `src/services/matrixCryptoManager.ts` | `src/matrix/services/crypto/manager.ts` | 979fba12 |
| `src/services/roomService.ts` | `src/matrix/services/room/service.ts` | 07daf0e2 |
| `src/services/rooms.ts` | `src/matrix/services/room/utils.ts` | 07daf0e2 |
| `src/services/roomSearchService.ts` | `src/matrix/services/search/room.ts` | 07daf0e2 |
| `src/services/spaceSearchService.ts` | `src/matrix/services/search/space.ts` | 07daf0e2 |
| `src/services/messageSyncService.ts` | `src/matrix/services/message/sync.ts` | bf129084 |
| `src/services/messageDecryptService.ts` | `src/matrix/services/message/decrypt.ts` | bf129084 |

### Re-export Facades

| 文件 | Re-exports | 状态 |
|------|------------|------|
| `src/services/roomService.ts` | `@/matrix/services/room/service` | ✅ |
| `src/services/rooms.ts` | `@/matrix/services/room/utils` | ✅ |
| `src/services/roomSearchService.ts` | `@/matrix/services/search/room` | ✅ |
| `src/services/spaceSearchService.ts` | `@/matrix/services/search/space` | ✅ |
| `src/services/messageSyncService.ts` | `@/matrix/services/message/sync` | ✅ |
| `src/services/messageDecryptService.ts` | `@/matrix/services/message/decrypt` | ✅ |
| `src/integrations/matrix/crypto.ts` | `@/matrix/core/crypto` | ✅ |
| `src/integrations/matrix/e2ee.ts` | `@/matrix/core/e2ee` | ✅ |
| `src/integrations/matrix/encryption.ts` | `@/matrix/core/encryption` | ✅ |

## 问题跟踪

### 已解决的问题

| 问题 | Phase | 解决方案 |
|------|-------|----------|
| 分散的服务位置 | 全部 | 统一到 `src/matrix/` |
| 导入路径混乱 | 全部 | 使用路径别名 `@/matrix/*` |
| 向后兼容性 | 全部 | Re-export facades |

### 当前问题

无严重问题。TypeScript 检查通过 ✅

### 类型安全问题

**源文件中的 `any` 类型 (非测试文件):**
- `src/matrix/services/room/spaces.ts`: 1 处
- `src/components/spaces/SpaceDetails.vue`: 4 处
- `src/components/spaces/useSpaceDetails.ts`: 1 处
- `src/integrations/matrix/password-reset.ts`: 2 处
- `src/integrations/matrix/server-discovery.ts`: 1 处

**总计:** 约 69 处 `any` 类型，其中大部分在测试文件中。源文件中约 9 处需要修复。

## 回滚记录

| 日期 | Phase | 原因 | 操作 |
|------|-------|------|------|
| - | - | - | - |

## 下一步

1. **立即执行:** 修复源文件中的 9 处 `any` 类型
2. **本周完成:** 清理遗留代码和废弃文件
3. **持续改进:** 完善文档和测试覆盖

## 相关文档

- [ARCHITECTURE.md](../ARCHITECTURE.md) - 整体架构文档
- [CLAUDE.md](../CLAUDE.md) - 开发指南
- [tsconfig.json](../tsconfig.json) - TypeScript 配置

---

**最后更新:** 2026-01-09
**迁移完成度:** ~85% (核心模块已完成，剩余清理和优化工作)
