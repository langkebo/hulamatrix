# Matrix 服务架构迁移跟踪

## 概述

将 Matrix 服务从分散的 `integrations/matrix/` 和 `services/matrix*.ts` 迁移到统一的 `src/matrix/` 架构。

## 迁移进度

### Phase 0: 准备 ✅
- [x] 分析现有架构
- [x] 识别关键依赖
- [x] 设计目标结构
- [x] 制定迁移计划

### Phase 1: 基础设置 ✅ (进行中)
- [x] 创建 `src/matrix/` 目录结构
- [x] 更新 `tsconfig.json` 添加 `@/matrix/*` 路径别名
- [x] 创建初始类型文件
- [ ] 验证类型检查通过

### Phase 2: 核心 Client 迁移 (待开始)
- [ ] 迁移 `client.ts`
- [ ] 迁移 `auth.ts`
- [ ] 迁移 `discovery.ts`
- [ ] 创建重新导出 facade

### Phase 3-11: (待开始)

详见完整计划: [plan file](/.claude/plans/enchanted-plotting-lake.md)

## 文件映射

### 已迁移

| 旧路径 | 新路径 | 状态 |
|--------|--------|------|
| - | `src/matrix/` 目录 | ✅ Phase 1 |
| - | `@/matrix/*` 路径别名 | ✅ Phase 1 |

### 待迁移

| 旧路径 | 新路径 | 优先级 |
|--------|--------|--------|
| `src/integrations/matrix/client.ts` | `src/matrix/core/client.ts` | 🔴 高 |
| `src/services/matrixRoomManager.ts` | `src/matrix/services/room/manager.ts` | 🔴 高 |
| `src/services/matrixEventHandler.ts` | `src/matrix/services/message/event-handler.ts` | 🔴 高 |

## 问题跟踪

### 已解决的问题

无

### 当前问题

无

### 已知风险

1. **Phase 2**: Client 迁移影响 215+ 文件
   - 缓解: 使用重新导出 facade
2. **Phase 9**: 批量更新导入路径
   - 缓解: 自动化工具 + 分批验证

## 回滚记录

| 日期 | Phase | 原因 | 操作 |
|------|-------|------|------|
| - | - | - | - |
