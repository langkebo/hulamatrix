# Requirements Document

## Introduction

本文档定义了项目SDK集成与后端对接的完整需求规范。基于ProjectAudit.md发现的问题和API.md定义的后端接口，系统性地整合Matrix SDK与Synapse扩展API，确保项目精简高效、功能完整。

## 核心问题总结

根据ProjectAudit.md的审计结果：
1. **服务实例分裂**: 存在两套`matrixClientService`导致消息接收失败
2. **聊天列表删除问题**: 未调用Matrix协议的`leave`接口
3. **好友添加流程**: 需要确保UI正确调用并给用户明确反馈
4. **冗余代码**: 需要清理重复的配置、错误处理、性能监控模块

## Glossary

- **Matrix_Client_Service**: 统一的Matrix客户端服务，位于`src/integrations/matrix/client.ts`
- **Synapse_Extension_API**: Synapse服务器扩展API，包括好友、私密会话、隐私反馈等
- **Friends_Service**: 好友管理服务，支持Synapse扩展和m.direct fallback
- **Private_Chat_Manager**: 私密聊天管理器，支持E2EE和自毁消息
- **Admin_Client**: 管理员API客户端，封装Synapse Admin API
- **Privacy_Service**: 隐私与反馈服务，支持举报、屏蔽功能
- **Message_Receiver**: 消息接收器，处理实时消息事件
- **Chat_Store**: 聊天状态存储，管理会话列表

## Requirements

### Requirement 1: Matrix客户端服务统一

**User Story:** 作为开发者，我希望有一个统一的Matrix客户端服务实例，以避免服务分裂导致的消息接收问题。

#### Acceptance Criteria

1. THE Matrix_Client_Service SHALL be the single source of truth for Matrix client operations
2. WHEN any component needs Matrix client access, THE component SHALL import from `src/integrations/matrix/client.ts`
3. IF `src/services/matrixClientService.ts` exists, THEN THE System SHALL either delete it or make it re-export from the unified location
4. WHEN Message_Receiver initializes, THE System SHALL ensure it uses the same client instance as the core application
5. THE System SHALL initialize Message_Receiver BEFORE calling `startClient` to capture initial sync events

### Requirement 2: 聊天会话删除功能

**User Story:** 作为用户，我希望能够彻底删除聊天会话，而不是仅仅隐藏它们。

#### Acceptance Criteria

1. WHEN a user deletes a chat session, THE Chat_Store SHALL call Matrix client's `leave` method
2. THE Chat_Store.removeSession method SHALL accept a `leaveRoom` option parameter
3. WHEN `leaveRoom` is true, THE System SHALL call Matrix protocol's leave interface
4. WHEN a room is left, THE System SHALL remove it from local storage and prevent re-activation
5. THE UI SHALL pass `{ leaveRoom: true }` when user explicitly deletes a session

### Requirement 3: 好友系统完整实现

**User Story:** 作为用户，我希望能够添加、接受、拒绝和删除好友，并获得明确的操作反馈。

#### Acceptance Criteria

1. WHEN Synapse extension API is available, THE Friends_Service SHALL use `/_synapse/client/friends` endpoints
2. WHEN Synapse extension is unavailable, THE Friends_Service SHALL fallback to Matrix m.direct account data
3. THE Friends_Service SHALL support the following actions:
   - `list`: 获取好友列表
   - `request`: 发送好友请求
   - `accept`: 接受好友请求
   - `reject`: 拒绝好友请求
   - `remove`: 删除好友
   - `search`: 搜索用户
4. WHEN a friend request is sent, THE UI SHALL display "请求已发送" feedback
5. WHEN a friend request fails, THE UI SHALL display specific error message

### Requirement 4: 好友在线状态同步

**User Story:** 作为用户，我希望能够看到好友的实时在线状态。

#### Acceptance Criteria

1. THE Friends_Service SHALL subscribe to presence events for all friends
2. WHEN a friend's presence changes, THE UI SHALL update in real-time
3. THE Friends_Service SHALL handle presence unavailable gracefully (show last known status)
4. THE Friends_Service SHALL cache last known presence status

### Requirement 5: 好友分类管理

**User Story:** 作为用户，我希望能够将好友分组到不同的分类中。

#### Acceptance Criteria

1. THE Friends_Service SHALL support creating friend categories using room tags
2. THE Friends_Service SHALL support moving friends between categories
3. THE Friends_Service SHALL support renaming and deleting categories
4. WHEN a category is deleted, THE System SHALL move friends to default category

### Requirement 6: 私密聊天E2EE强制启用

**User Story:** 作为用户，我希望私密聊天始终启用端到端加密以保护隐私。

#### Acceptance Criteria

1. WHEN creating a private chat, THE PrivateChat_Manager SHALL enable E2EE with `m.megolm.v1.aes-sha2` algorithm
2. THE PrivateChat_Manager SHALL verify encryption is active before sending messages
3. THE PrivateChat_Manager SHALL support high encryption mode with shorter key rotation
4. IF encryption setup fails, THEN THE System SHALL notify user and prevent unencrypted messages

### Requirement 7: 自毁消息功能

**User Story:** 作为用户，我希望能够发送阅后即焚的消息。

#### Acceptance Criteria

1. WHEN sending a self-destruct message, THE PrivateChat_Manager SHALL set expiration time in message content
2. THE System SHALL display countdown timer for self-destruct messages
3. WHEN countdown reaches zero, THE System SHALL remove message from local storage
4. THE System SHALL send redaction event to remove message from server
5. THE System SHALL persist self-destruct timers across app restarts

### Requirement 8: 密钥备份功能

**User Story:** 作为用户，我希望能够备份和恢复我的加密密钥。

#### Acceptance Criteria

1. THE System SHALL support checking key backup status
2. THE System SHALL support creating encrypted key backup with recovery key
3. THE System SHALL support restoring keys from backup on new device login
4. THE UI SHALL show key backup status in settings

### Requirement 9: 管理员API集成

**User Story:** 作为管理员，我希望能够管理用户、房间和媒体。

#### Acceptance Criteria

1. THE AdminClient SHALL use MatrixClient.http.authedRequest for Synapse Admin API calls
2. THE AdminClient SHALL implement user management APIs:
   - List users with pagination
   - Get user details
   - Update user admin status
   - Deactivate/reactivate users
   - Reset user passwords
3. THE AdminClient SHALL implement room management APIs:
   - List rooms with pagination
   - Get room details
   - Delete rooms
   - Purge room history
4. THE AdminClient SHALL integrate with MatrixErrorHandler for error transformation
5. THE AdminClient SHALL log all admin operations for audit

### Requirement 10: 隐私与反馈功能

**User Story:** 作为用户，我希望能够举报违规内容和屏蔽不想看到的用户/房间。

#### Acceptance Criteria

1. THE Privacy_Service SHALL support reporting users with reason
2. THE Privacy_Service SHALL support reporting rooms with reason
3. THE Privacy_Service SHALL support blocking/unblocking users
4. THE Privacy_Service SHALL support blocking/unblocking rooms
5. THE Privacy_Service SHALL support listing blocked users and rooms
6. THE Privacy_Service SHALL support submitting feedback with optional attachment

### Requirement 11: 冗余代码清理

**User Story:** 作为开发者，我希望项目代码精简无冗余，便于维护。

#### Acceptance Criteria

1. THE System SHALL consolidate Matrix config files into single `matrix-config.ts`
2. THE System SHALL consolidate error handling into single `error-handler.ts`
3. THE System SHALL consolidate performance monitoring into single `performance-monitor.ts`
4. THE System SHALL consolidate message sync services into single implementation
5. THE System SHALL remove deprecated files with proper migration path
6. WHEN deprecated APIs are used, THE System SHALL log warning in development mode

### Requirement 12: API请求统一处理

**User Story:** 作为开发者，我希望所有API请求有统一的错误处理和超时机制。

#### Acceptance Criteria

1. THE System SHALL implement unified fetch wrapper with timeout support
2. THE System SHALL implement automatic retry for transient failures
3. THE System SHALL transform API errors to user-friendly messages
4. THE System SHALL support request cancellation via AbortController
5. WHEN API request times out, THE System SHALL provide clear timeout error message

### Requirement 13: 服务发现与配置

**User Story:** 作为用户，我希望能够连接到自定义的Matrix服务器。

#### Acceptance Criteria

1. THE Config_Manager SHALL support Matrix well-known discovery
2. THE Config_Manager SHALL cache discovered server configuration
3. THE Config_Manager SHALL support custom homeserver URL input
4. WHEN discovery fails, THE System SHALL provide fallback options
5. THE Config_Manager SHALL validate server URL format before discovery

### Requirement 14: 消息同步与去重

**User Story:** 作为用户，我希望消息能够可靠同步且不重复显示。

#### Acceptance Criteria

1. THE Message_Sync_Service SHALL deduplicate messages by event ID
2. THE Message_Sync_Service SHALL maintain retry queue for failed sends
3. THE Message_Sync_Service SHALL track message status (sending, sent, failed)
4. THE Message_Sync_Service SHALL sync message history on room join
5. WHEN message send fails, THE System SHALL allow manual retry

### Requirement 15: 事件系统统一

**User Story:** 作为开发者，我希望有统一的事件系统来处理应用内通信。

#### Acceptance Criteria

1. THE Event_System SHALL provide typed event bus with namespace support
2. THE Event_System SHALL support event history for debugging
3. THE Event_System SHALL provide specialized buses for different domains:
   - globalEventBus: 全局事件
   - matrixEventBus: Matrix相关事件
   - rtcEventBus: 实时通信事件
   - chatEventBus: 聊天相关事件
4. THE Event_System SHALL support one-time event listeners
