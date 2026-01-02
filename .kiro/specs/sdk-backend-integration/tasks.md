# Implementation Plan: SDK Backend Integration

## Overview

本实现计划将SDK后端集成分为五个阶段，按优先级从高到低执行。每个阶段包含具体的整合任务、测试任务和检查点。实现语言为TypeScript。

## Tasks

### Phase 1: Critical - 核心问题修复

- [x] 1. 修复Matrix客户端服务分裂问题
  - [x] 1.1 检查并删除冗余的matrixClientService
    - 检查 `src/services/matrixClientService.ts` 是否存在
    - 如存在，将其改为重导出 `src/integrations/matrix/client.ts`
    - 更新所有导入引用
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 1.2 确保MessageReceiver使用统一客户端
    - 验证 `unifiedMessageReceiver.ts` 使用正确的客户端实例
    - 调整初始化顺序，确保在startClient之前初始化
    - _Requirements: 1.4, 1.5_
  - [x] 1.3 编写属性测试：客户端实例一致性
    - **Property 1: Client Instance Consistency**
    - **Validates: Requirements 1.4**

- [x] 2. 修复聊天会话删除功能
  - [x] 2.1 扩展ChatStore.removeSession方法
    - 添加 `leaveRoom` 选项参数
    - 当 `leaveRoom=true` 时调用Matrix leave接口
    - 从本地存储移除并防止重新激活
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [x] 2.2 更新UI调用
    - 确保删除按钮传入 `{ leaveRoom: true }`
    - _Requirements: 2.5_
  - [x] 2.3 编写属性测试：会话删除与leave调用
    - **Property 2: Session Removal with Leave**
    - **Validates: Requirements 2.1, 2.3, 2.4**

- [x] 3. 删除高优先级冗余文件
  - [x] 3.1 删除errorHandler系列文件
    - 检查引用并更新导入为 `error-handler`
    - 删除 `src/utils/errorHandler.ts`
    - 删除 `src/utils/errorLogManager.ts`
    - 删除 `src/utils/ErrorReporter.ts`
    - _Requirements: 11.1, 11.2_
  - [x] 3.2 删除performance-reporter.ts
    - 检查引用并更新
    - 删除 `src/utils/performance-reporter.ts`
    - _Requirements: 11.3_
  - [x] 3.3 删除重复的类型导出
    - 合并有用内容到 `src/types/index.ts`
    - 删除 `src/typings/index.ts`
    - _Requirements: 11.5_

- [x] 4. Checkpoint - Phase 1 完成检查
  - 运行 `pnpm run typecheck` 确保无错误
  - 运行 `pnpm run test:run` 确保测试通过
  - 如有问题请询问用户

### Phase 2: High - 好友系统完整实现

- [x] 5. 验证好友服务实现
  - [x] 5.1 验证Synapse API集成
    - 确认 `/_synapse/client/friends` 端点调用正确
    - 验证所有action: list, request, accept, reject, remove, search
    - _Requirements: 3.1, 3.3_
  - [x] 5.2 验证m.direct fallback机制
    - 确认Synapse不可用时自动fallback
    - 测试fallback后的好友列表获取
    - _Requirements: 3.2_
  - [x] 5.3 编写属性测试：Synapse API Fallback
    - **Property 3: Synapse API Fallback**
    - **Validates: Requirements 3.1, 3.2**

- [x] 6. 完善好友在线状态功能
  - [x] 6.1 验证Presence订阅
    - 确认 `subscribeToPresence` 正确监听事件
    - 验证实时更新机制
    - _Requirements: 4.1, 4.2_
  - [x] 6.2 验证Presence缓存
    - 确认缓存TTL为60秒
    - 验证缓存命中和过期逻辑
    - _Requirements: 4.3, 4.4_
  - [x] 6.3 编写属性测试：Presence缓存
    - **Property 4: Presence Caching**
    - **Validates: Requirements 4.3, 4.4**

- [x] 7. 完善好友分类功能
  - [x] 7.1 验证分类CRUD操作
    - 验证创建、重命名、删除分类
    - 验证移动好友到分类
    - _Requirements: 5.1, 5.2, 5.3_
  - [x] 7.2 验证分类删除清理
    - 确认删除分类时好友移动到默认分类
    - _Requirements: 5.4_
  - [x] 7.3 编写属性测试：分类删除清理
    - **Property 5: Category Deletion Cleanup**
    - **Validates: Requirements 5.4**

- [x] 8. 合并中优先级冗余文件
  - [x] 8.1 合并messageReceiver到unifiedMessageReceiver
    - 迁移Matrix事件监听逻辑
    - 添加别名导出保持兼容
    - 删除 `src/services/messageReceiver.ts`
    - _Requirements: 11.4_
  - [x] 8.2 合并WebSocketManager到webSocketService
    - 迁移协调逻辑和故障转移
    - 删除 `src/utils/WebSocketManager.ts`
    - _Requirements: 11.4_

- [x] 9. Checkpoint - Phase 2 完成检查
  - 运行测试确保好友功能正常
  - 手动测试好友添加、删除、在线状态
  - 如有问题请询问用户

### Phase 3: High - 私密聊天与E2EE

- [x] 10. 验证E2EE强制启用
  - [x] 10.1 验证私密聊天创建时E2EE配置
    - 确认使用 `m.megolm.v1.aes-sha2` 算法
    - 验证加密状态事件正确设置
    - _Requirements: 6.1_
  - [x] 10.2 验证发送前加密验证
    - 确认 `verifyEncryptionBeforeSend` 正确阻止未加密消息
    - _Requirements: 6.2, 6.4_
  - [x] 10.3 编写属性测试：E2EE强制启用
    - **Property 6: E2EE Enforcement**
    - **Validates: Requirements 6.1, 6.2, 6.4**

- [x] 11. 验证自毁消息功能
  - [x] 11.1 验证自毁消息发送
    - 确认消息内容包含过期时间
    - 验证定时器正确设置
    - _Requirements: 7.1, 7.2_
  - [x] 11.2 验证消息销毁流程
    - 确认本地移除和服务器redaction
    - _Requirements: 7.3, 7.4_
  - [x] 11.3 验证定时器持久化
    - 确认定时器信息保存到localStorage
    - 验证应用重启后恢复
    - _Requirements: 7.5_
  - [x] 11.4 编写属性测试：自毁消息生命周期
    - **Property 7: Self-Destruct Message Lifecycle**
    - **Validates: Requirements 7.1, 7.3, 7.4**
  - [x] 11.5 编写属性测试：定时器持久化
    - **Property 8: Self-Destruct Timer Persistence**
    - **Validates: Requirements 7.5**

- [x] 12. 验证密钥备份功能
  - [x] 12.1 验证密钥备份状态检查
    - 确认 `checkKeyBackupStatus` 正确返回状态
    - _Requirements: 8.1, 8.4_
  - [x] 12.2 验证密钥备份创建和恢复
    - 确认创建备份返回恢复密钥
    - 确认恢复功能正常
    - _Requirements: 8.2, 8.3_

- [x] 13. Checkpoint - Phase 3 完成检查
  - 运行测试确保E2EE功能正常
  - 手动测试私密聊天创建、自毁消息
  - 如有问题请询问用户

### Phase 4: Medium - 管理与隐私功能

- [x] 14. 验证管理员API集成
  - [x] 14.1 验证用户管理API
    - 测试列出用户、获取详情、更新状态
    - _Requirements: 9.2_
  - [x] 14.2 验证房间管理API
    - 测试列出房间、获取详情、删除房间
    - _Requirements: 9.3_
  - [x] 14.3 验证错误处理和审计日志
    - 确认错误通过MatrixErrorHandler转换
    - 确认所有操作记录审计日志
    - _Requirements: 9.4, 9.5_
  - [x] 14.4 编写属性测试：Admin API错误处理
    - **Property 9: Admin API Error Handling**
    - **Validates: Requirements 9.4, 9.5**

- [x] 15. 验证隐私与反馈功能
  - [x] 15.1 验证举报功能
    - 测试举报用户和房间
    - _Requirements: 10.1, 10.2_
  - [x] 15.2 验证屏蔽功能
    - 测试屏蔽/取消屏蔽用户和房间
    - 验证屏蔽列表获取
    - _Requirements: 10.3, 10.4, 10.5_
  - [x] 15.3 验证反馈提交
    - 测试文本反馈和附件反馈
    - _Requirements: 10.6_
  - [x] 15.4 编写属性测试：屏蔽/取消屏蔽往返
    - **Property 10: Block/Unblock Round Trip**
    - **Validates: Requirements 10.3, 10.4**

- [x] 16. Checkpoint - Phase 4 完成检查
  - 运行测试确保管理功能正常
  - 手动测试管理员界面
  - 如有问题请询问用户

### Phase 5: Low - 优化与清理

- [x] 17. 完善API请求处理
  - [x] 17.1 验证统一fetch包装器
    - 确认超时支持正常
    - 确认AbortController取消功能
    - _Requirements: 12.1, 12.4_
  - [x] 17.2 验证重试机制
    - 确认瞬态错误自动重试
    - _Requirements: 12.2_
  - [x] 17.3 验证错误转换
    - 确认API错误转换为用户友好消息
    - _Requirements: 12.3, 12.5_
  - [x] 17.4 编写属性测试：Fetch包装器超时和取消
    - **Property 12: Fetch Wrapper Timeout and Cancellation**
    - **Validates: Requirements 12.1, 12.4, 12.5**

- [x] 18. 验证服务发现与配置
  - [x] 18.1 验证well-known发现
    - 测试Matrix服务发现流程
    - _Requirements: 13.1_
  - [x] 18.2 验证配置缓存
    - 确认发现结果正确缓存
    - _Requirements: 13.2_
  - [x] 18.3 验证URL验证
    - 确认无效URL被拒绝
    - _Requirements: 13.5_
  - [x] 18.4 编写属性测试：服务器URL验证
    - **Property 13: Server URL Validation**
    - **Validates: Requirements 13.5**

- [x] 19. 验证消息同步服务
  - [x] 19.1 验证消息去重
    - 确认重复eventId被过滤
    - _Requirements: 14.1_
  - [x] 19.2 验证重试队列
    - 确认失败消息加入重试队列
    - _Requirements: 14.2_
  - [x] 19.3 验证状态追踪
    - 确认消息状态正确转换
    - _Requirements: 14.3_
  - [x] 19.4 编写属性测试：消息去重
    - **Property 14: Message Deduplication**
    - **Validates: Requirements 14.1**
  - [x] 19.5 编写属性测试：消息状态追踪
    - **Property 15: Message Status Tracking**
    - **Validates: Requirements 14.2, 14.3**

- [x] 20. 验证事件系统
  - [x] 20.1 验证事件总线功能
    - 确认命名空间支持
    - 确认专用总线存在
    - _Requirements: 15.1, 15.3_
  - [x] 20.2 验证事件历史
    - 确认事件记录到历史
    - _Requirements: 15.2_
  - [x] 20.3 验证once监听器
    - 确认只触发一次
    - _Requirements: 15.4_
  - [x] 20.4 编写属性测试：事件总线once监听器
    - **Property 16: Event Bus Once Listener**
    - **Validates: Requirements 15.4**
  - [x] 20.5 编写属性测试：事件历史记录
    - **Property 17: Event History Recording**
    - **Validates: Requirements 15.2**

- [x] 21. 添加废弃API警告
  - [x] 21.1 为废弃API添加开发模式警告
    - 在废弃文件中添加console.warn
    - 确保只在开发模式触发
    - _Requirements: 11.6_
  - [x] 21.2 编写属性测试：废弃API警告
    - **Property 11: Deprecated API Warning**
    - **Validates: Requirements 11.6**

- [x] 22. Final Checkpoint - 全部完成检查
  - 运行完整测试套件 `pnpm run test:run`
  - 运行类型检查 `pnpm run typecheck`
  - 运行代码检查 `pnpm run check`
  - 验证所有功能正常
  - 如有问题请询问用户

## Notes

- 所有任务都是必须执行的，包括属性测试
- 每个 Checkpoint 都应确保测试通过后再继续
- 废弃文件应保留至少一个版本周期后再删除
- 属性测试使用 `fast-check` 库，每个测试至少运行 100 次迭代
- 预计总减少代码行数: ~6,000 行
