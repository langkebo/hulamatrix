# Implementation Plan: Project Redundancy Cleanup

## Overview

本实现计划将项目冗余清理分为四个阶段，按优先级从高到低执行。每个阶段包含具体的整合任务、测试任务和检查点。

## Tasks

### Phase 1: Critical - 核心模块整合

- [x] 1. 整合 Matrix 配置模块
  - [x] 1.1 合并 `matrix.ts` 常量到 `matrix-config.ts`
    - 将 `PUBLIC_ROOM_ALIASES` 和 `PUBLIC_ROOM_ALIAS` 移动到 `matrix-config.ts`
    - 更新所有导入引用
    - _Requirements: 1.1, 1.2_
  - [x] 1.2 合并 `matrixConfig.ts` 功能到 `matrix-config.ts`
    - 整合 `discoverServer()`, `getMatrixConfig()`, `getHomeserverUrl()` 函数
    - 合并服务发现缓存逻辑
    - _Requirements: 1.2_
  - [x] 1.3 添加向后兼容导出
    - 导出旧函数名作为别名
    - 添加 `@deprecated` 注释
    - _Requirements: 1.3_
  - [x] 1.4 编写属性测试：配置发现一致性
    - **Property 1: Config Discovery Consistency**
    - **Validates: Requirements 1.2**
  - [x] 1.5 废弃原文件
    - 在 `matrix.ts` 和 `matrixConfig.ts` 添加废弃警告
    - 重新导出到新位置
    - _Requirements: 1.1_

- [x] 2. 整合错误处理模块
  - [x] 2.1 创建统一的 `error-handler.ts`
    - 合并 `ErrorCategory` 枚举（包含所有值）
    - 创建 `UnifiedErrorHandler` 类
    - _Requirements: 2.1_
  - [x] 2.2 整合错误分类逻辑
    - 从 `MatrixErrorHandler.ts` 合并 `classifyError()` 函数
    - 从 `errorHandler.ts` 合并 `analyzeError()` 方法
    - _Requirements: 2.2_
  - [x] 2.3 整合错误日志功能
    - 从 `errorLogManager.ts` 合并日志记录和统计功能
    - 整合 `ErrorEntry` 和 `ErrorStats` 类型
    - _Requirements: 2.2_
  - [ ] 2.4 编写属性测试：错误处理完整性
    - **Property 2: Error Handling Completeness**
    - **Validates: Requirements 2.2**
  - [x] 2.5 添加向后兼容导出
    - 导出 `MatrixErrorHandler` 作为别名
    - 导出 `errorLogManager` 作为别名
    - _Requirements: 2.3_
  - [x] 2.6 废弃原文件
    - 废弃 `MatrixErrorHandler.ts`, `errorLogManager.ts`, `ErrorReporter.ts`
    - _Requirements: 2.1_

- [x] 3. 整合性能监控模块
  - [x] 3.1 扩展 `performance-monitor.ts`
    - 整合 `createPerformanceMonitor()` 函数
    - 整合 `startPerformanceReporter()` 功能
    - _Requirements: 3.1_
  - [x] 3.2 统一 API 接口
    - 添加 `start()`, `end()`, `measure()` 方法
    - 添加 `report()`, `getMetrics()` 方法
    - _Requirements: 3.2_
  - [ ]* 3.3 编写属性测试：性能指标追踪
    - **Property 3: Performance Metric Tracking**
    - **Validates: Requirements 3.2**
  - [x] 3.4 废弃原文件
    - 废弃 `performanceMonitor.ts` 和 `performance-reporter.ts`
    - _Requirements: 3.1_

- [ ] 4. Checkpoint - Phase 1 完成检查
  - 确保所有测试通过
  - 验证向后兼容性
  - 如有问题请询问用户

### Phase 2: High - 服务层整合

- [ ] 5. 整合消息同步服务
  - [ ] 5.1 创建统一的 `message-sync-service.ts`
    - 合并 `message-sync.ts` 和 `messageSyncService.ts`
    - 保留更完整的实现（`messageSyncService.ts`）
    - _Requirements: 4.1_
  - [ ] 5.2 整合去重和重试逻辑
    - 合并 `processedEventIds` 去重机制
    - 合并 `retryQueue` 重试队列
    - _Requirements: 4.2_
  - [ ]* 5.3 编写属性测试：消息去重
    - **Property 4: Message Deduplication**
    - **Validates: Requirements 4.2**
  - [ ] 5.4 废弃原文件
    - 废弃 `message-sync.ts`
    - _Requirements: 4.1_

- [ ] 6. 整合事件系统
  - [ ] 6.1 确定 `EventBus.ts` 为主要实现
    - 保留 `TypedEventBus` 类和所有专用实例
    - _Requirements: 5.1_
  - [ ] 6.2 添加兼容层
    - 创建 `EventDispatcher.getInstance()` 返回 `globalEventBus`
    - 创建 `EventManager.getInstance()` 返回 `globalEventBus`
    - _Requirements: 5.2_
  - [ ]* 6.3 编写属性测试：事件分发
    - **Property 5: Event Dispatch Delivery**
    - **Validates: Requirements 5.2**
  - [ ] 6.4 废弃原文件
    - 废弃 `EventDispatcher.ts` 和 `eventManager.ts`
    - _Requirements: 5.1_

- [ ] 7. 整合 WebSocket Store
  - [ ] 7.1 合并 `ws.ts` 到 `websocket.ts`
    - 添加 `loginQrCode` 和 `loginStatus` 状态
    - 添加 `resetLoginState()` 方法
    - 修复 `ws.ts` 中缺失的导入
    - _Requirements: 6.1, 6.2, 6.3_
  - [ ]* 7.2 编写属性测试：WebSocket 状态一致性
    - **Property 6: WebSocket State Consistency**
    - **Validates: Requirements 6.2**
  - [ ] 7.3 添加向后兼容导出
    - 导出 `useWsLoginStore` 作为 `useWebSocketStore` 的别名
    - _Requirements: 6.1_
  - [ ] 7.4 废弃原文件
    - 废弃 `ws.ts`
    - _Requirements: 6.1_

- [ ] 8. Checkpoint - Phase 2 完成检查
  - 确保所有测试通过
  - 验证服务层功能正常
  - 如有问题请询问用户

### Phase 3: Medium - 辅助模块整合

- [ ] 9. 重命名缓存 Store
  - [ ] 9.1 重命名 `cache.ts` 为 `mediaCache.ts`
    - 更新所有导入引用
    - _Requirements: 7.1_
  - [ ] 9.2 重命名 `cached.ts` 为 `dataCache.ts`
    - 更新所有导入引用
    - _Requirements: 7.1_
  - [ ] 9.3 添加文档说明
    - 在文件头部添加用途说明注释
    - _Requirements: 7.2_

- [ ] 10. 整合房间服务
  - [ ] 10.1 合并 `rooms.ts` 函数到 `roomService.ts`
    - 将 SDK 包装函数移动到 `RoomService` 类
    - _Requirements: 10.1_
  - [ ] 10.2 更新导入引用
    - 更新所有使用 `rooms.ts` 的文件
    - _Requirements: 10.1_
  - [ ] 10.3 废弃原文件
    - 废弃 `rooms.ts`
    - _Requirements: 10.1_

- [ ] 11. 整合类型定义
  - [ ] 11.1 合并 Matrix 类型定义
    - 合并 `src/types/matrix.ts` 和 `src/typings/matrix.ts`
    - 保留 UI 相关类型在 `src/types/`
    - _Requirements: 8.1, 8.2_
  - [ ] 11.2 创建统一的类型索引
    - 更新 `src/types/index.ts` 导出所有类型
    - _Requirements: 8.3_

- [ ] 12. 整合 ESLint 配置
  - [ ] 12.1 确定主配置文件
    - 保留 `eslint.config.cjs` 作为主配置
    - _Requirements: 9.1_
  - [ ] 12.2 删除冗余配置
    - 删除 `.eslintrc.cjs` 和 `.eslintrc.src.js`
    - _Requirements: 9.1, 9.2_

- [ ] 13. Checkpoint - Phase 3 完成检查
  - 确保所有测试通过
  - 验证 ESLint 正常工作
  - 如有问题请询问用户

### Phase 4: Low - Hooks 和适配器优化

- [ ] 14. 整合 Matrix Auth Hooks
  - [ ] 14.1 合并 debug 变体到主 hook
    - 在 `useMatrixAuth.ts` 添加可选的 `debug` 参数
    - _Requirements: 11.1_
  - [ ] 14.2 废弃 debug 变体
    - 废弃 `useMatrixAuthWithDebug.ts`
    - _Requirements: 11.2_

- [ ] 15. 提取适配器基类（可选）
  - [ ]* 15.1 创建 `BaseAdapter` 抽象类
    - 提取 Matrix 和 WebSocket 适配器的共享逻辑
    - _Requirements: 12.1_
  - [ ]* 15.2 重构现有适配器
    - 让 `MatrixMessageAdapter` 和 `WebSocketMessageAdapter` 继承基类
    - _Requirements: 12.2_

- [ ] 16. Final Checkpoint - 全部完成检查
  - 运行完整测试套件
  - 验证所有功能正常
  - 清理所有废弃文件的警告
  - 如有问题请询问用户

## Notes

- 标记 `*` 的任务为可选任务，可跳过以加快 MVP 进度
- 每个 Checkpoint 都应确保测试通过后再继续
- 废弃文件应保留至少一个版本周期后再删除
- 属性测试使用 `fast-check` 库，每个测试至少运行 100 次迭代

