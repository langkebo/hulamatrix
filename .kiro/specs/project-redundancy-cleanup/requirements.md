# Requirements Document

## Introduction

本文档定义了项目冗余清理的需求规范。经过全面分析，项目中存在大量重复代码、功能重叠的模块和命名不一致的文件，需要系统性地进行整合和清理。

## Glossary

- **Redundancy_Analyzer**: 负责识别和分析项目中冗余代码的系统
- **Config_Manager**: 统一的配置管理模块
- **Error_Handler**: 统一的错误处理模块
- **Performance_Monitor**: 统一的性能监控模块
- **Message_Service**: 统一的消息服务模块
- **Event_System**: 统一的事件管理系统
- **Store_Manager**: 统一的状态存储管理

## Requirements

### Requirement 1: Matrix 配置文件整合

**User Story:** 作为开发者，我希望有一个统一的 Matrix 配置管理模块，以避免配置分散和冲突。

#### Acceptance Criteria

1. THE Config_Manager SHALL consolidate the following files into a single source:
   - `src/config/matrix.ts` (仅包含房间别名常量)
   - `src/config/matrix-config.ts` (MatrixConfigManager 类)
   - `src/config/matrixConfig.ts` (服务发现功能)

2. WHEN the consolidated config module is used, THE Config_Manager SHALL provide all existing functionality including:
   - 服务发现 (discoverServer)
   - 配置获取 (getMatrixConfig, getHomeserverUrl)
   - 房间别名常量 (PUBLIC_ROOM_ALIASES)

3. THE Config_Manager SHALL maintain backward compatibility by exporting deprecated aliases for old function names

### Requirement 2: 错误处理模块整合

**User Story:** 作为开发者，我希望有一个统一的错误处理系统，以便一致地处理和报告错误。

#### Acceptance Criteria

1. THE Error_Handler SHALL consolidate the following files:
   - `src/utils/errorHandler.ts` (MatrixErrorHandler 类)
   - `src/utils/MatrixErrorHandler.ts` (同名类，不同实现)
   - `src/utils/errorLogManager.ts` (ErrorLogManager 类)
   - `src/utils/ErrorReporter.ts` (ErrorReporter 类)

2. WHEN an error occurs, THE Error_Handler SHALL provide:
   - 错误分类 (ErrorCategory)
   - 用户友好消息 (userMessage)
   - 重试机制 (retryError)
   - 错误日志记录

3. IF duplicate class names exist, THEN THE Error_Handler SHALL resolve naming conflicts

### Requirement 3: 性能监控模块整合

**User Story:** 作为开发者，我希望有一个统一的性能监控系统，以便一致地收集和报告性能指标。

#### Acceptance Criteria

1. THE Performance_Monitor SHALL consolidate the following files:
   - `src/utils/performance-monitor.ts` (PerformanceMonitor 类)
   - `src/utils/performanceMonitor.ts` (createPerformanceMonitor 函数)
   - `src/utils/performance-reporter.ts` (startPerformanceReporter 函数)

2. WHEN performance monitoring is enabled, THE Performance_Monitor SHALL provide:
   - 指标收集 (start, end, measure)
   - 报告生成 (report, getMetrics)
   - 自动报告 (startPerformanceReporter)

3. THE Performance_Monitor SHALL use consistent naming convention (kebab-case for files)

### Requirement 4: 消息服务整合

**User Story:** 作为开发者，我希望有清晰分离的消息服务，以避免功能重叠和混淆。

#### Acceptance Criteria

1. THE Message_Service SHALL consolidate the following files:
   - `src/services/message-sync.ts` (MessageSyncService)
   - `src/services/messageSyncService.ts` (MessageSyncService - 不同实现)
   - `src/services/messages.ts` (工具函数)

2. WHEN message sync is performed, THE Message_Service SHALL provide:
   - 消息去重 (deduplication)
   - 重试机制 (retry queue)
   - 状态管理 (message status cache)

3. THE Message_Service SHALL maintain clear separation:
   - MessageService: 发送/接收
   - MessageSyncService: 同步
   - MessageDecryptService: 解密

### Requirement 5: 事件系统整合

**User Story:** 作为开发者，我希望有一个统一的事件管理系统，以便一致地处理应用事件。

#### Acceptance Criteria

1. THE Event_System SHALL consolidate the following files:
   - `src/utils/EventBus.ts` (TypedEventBus 类)
   - `src/utils/EventDispatcher.ts` (EventDispatcher 类)
   - `src/utils/eventManager.ts` (EventManager 类)

2. WHEN events are dispatched, THE Event_System SHALL provide:
   - 类型安全的事件订阅/发布
   - 命名空间支持
   - 事件历史记录

3. THE Event_System SHALL export specialized instances:
   - globalEventBus
   - matrixEventBus
   - rtcEventBus
   - chatEventBus

### Requirement 6: WebSocket Store 整合

**User Story:** 作为开发者，我希望有一个统一的 WebSocket 状态管理，以避免状态分散。

#### Acceptance Criteria

1. THE Store_Manager SHALL consolidate the following files:
   - `src/stores/websocket.ts` (useWebSocketStore)
   - `src/stores/ws.ts` (useWsLoginStore)

2. WHEN WebSocket state changes, THE Store_Manager SHALL manage:
   - 连接状态 (connected, connecting)
   - 登录状态 (loginStatus, loginQrCode)
   - 重连尝试 (reconnectAttempts)

3. THE Store_Manager SHALL fix the incomplete implementation in `ws.ts` (missing imports)

### Requirement 7: 缓存 Store 命名规范化

**User Story:** 作为开发者，我希望缓存相关的 Store 有清晰的命名，以便理解其用途。

#### Acceptance Criteria

1. THE Store_Manager SHALL rename cache stores for clarity:
   - `src/stores/cache.ts` → `src/stores/mediaCache.ts` (媒体缓存)
   - `src/stores/cached.ts` → `src/stores/dataCache.ts` (数据缓存)

2. WHEN cache stores are renamed, THE Store_Manager SHALL:
   - 更新所有导入引用
   - 添加文档说明区别

### Requirement 8: 类型定义整合

**User Story:** 作为开发者，我希望有统一的类型定义目录，以避免类型重复和混淆。

#### Acceptance Criteria

1. THE Redundancy_Analyzer SHALL consolidate type directories:
   - `src/types/` (主要类型定义)
   - `src/typings/` (全局类型声明)

2. WHEN type definitions conflict, THE Redundancy_Analyzer SHALL:
   - 合并 `src/types/matrix.ts` 和 `src/typings/matrix.ts`
   - 保留 UI 相关类型在 `src/types/`
   - 保留全局声明在 `src/typings/`

3. THE Redundancy_Analyzer SHALL create clear index file with all exports

### Requirement 9: ESLint 配置整合

**User Story:** 作为开发者，我希望有单一的 ESLint 配置，以避免配置冲突。

#### Acceptance Criteria

1. THE Redundancy_Analyzer SHALL consolidate ESLint configs:
   - `.eslintrc.cjs` (主配置)
   - `.eslintrc.src.js` (源码配置)
   - `eslint.config.cjs` (替代配置)

2. WHEN ESLint is run, THE Redundancy_Analyzer SHALL ensure only one config is active

3. THE Redundancy_Analyzer SHALL migrate to flat config format if appropriate

### Requirement 10: 房间服务整合

**User Story:** 作为开发者，我希望有统一的房间服务 API，以避免功能重复。

#### Acceptance Criteria

1. THE Redundancy_Analyzer SHALL consolidate room services:
   - `src/services/rooms.ts` (SDK 包装函数)
   - `src/services/roomService.ts` (RoomService 类)

2. WHEN room operations are performed, THE Redundancy_Analyzer SHALL:
   - 将 `rooms.ts` 函数合并到 `roomService.ts`
   - 保持 `roomSearchService.ts` 独立

### Requirement 11: Hooks 整合

**User Story:** 作为开发者，我希望减少重复的 hooks，以简化代码维护。

#### Acceptance Criteria

1. THE Redundancy_Analyzer SHALL consolidate hooks:
   - `src/hooks/useMatrixAuth.ts`
   - `src/hooks/useMatrixAuthWithDebug.ts`

2. WHEN debug functionality is needed, THE Redundancy_Analyzer SHALL:
   - 合并 debug 变体到主 hook
   - 添加可选的 debug 标志参数

### Requirement 12: 适配器基类提取

**User Story:** 作为开发者，我希望适配器有共享的基类，以减少代码重复。

#### Acceptance Criteria

1. THE Redundancy_Analyzer SHALL extract common adapter logic:
   - `src/adapters/matrix-adapter.ts` (5 个类)
   - `src/adapters/websocket-adapter.ts` (5 个类)

2. WHEN adapters are refactored, THE Redundancy_Analyzer SHALL:
   - 创建 BaseAdapter 抽象类
   - 提取共享逻辑到基类
   - 使用组合优于继承

