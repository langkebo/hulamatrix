/*
 * Matrix Services Index
 *
 * Central export point for all Matrix-related services
 */

export { default as MatrixClientService } from './MatrixClientService'
export { default as MatrixSyncService } from './MatrixSyncService'
export { default as MatrixAuthService } from './MatrixAuthService'
export { default as MatrixUserService } from './MatrixUserService'
export { default as MatrixMessageService } from './MatrixMessageService'
export { default as MatrixSettingsService } from './MatrixSettingsService'
export { default as MatrixNotificationService } from './MatrixNotificationService'
export { default as MatrixI18nService } from './MatrixI18nService'
export { default as MatrixPerformanceService } from './MatrixPerformanceService'
export { default as MatrixCrossSigningService } from './MatrixCrossSigningService'
export { default as MatrixKeyBackupService } from './MatrixKeyBackupService'
export { default as MatrixDataDeletionService } from './MatrixDataDeletionService'
export { default as MatrixDataExportService } from './MatrixDataExportService'
export { default as MatrixPollService } from './MatrixPollService'

// SDK v40.0.0 New Features
export { matrixRTCService } from './MatrixRTCService'
export { default as MatrixRTCService } from './MatrixRTCService'
export type {
  RTCTransportInfo,
  RTCMemberEventContent,
  RTCFocusInfo,
  CallNotificationContent,
  MatrixRTCConfig
} from './MatrixRTCService'
export type { CallIntent } from './MatrixRTCService'

export { matrixDelayedEventService } from './MatrixDelayedEventService'
export { default as MatrixDelayedEventService } from './MatrixDelayedEventService'
export type {
  DelayedEvent,
  DelayedEventStatus,
  DelayedEventFilter,
  ScheduleDelayedEventRequest
} from './MatrixDelayedEventService'

export { matrixSafetyService } from './MatrixSafetyService'
export { default as MatrixSafetyService } from './MatrixSafetyService'
export type {
  SafetyErrorContent,
  SafetyErrorEvent,
  RecommendedAction
} from './MatrixSafetyService'

export { enhancedSdkService, useEnhancedSdk } from './EnhancedSdkService'
export type { EnhancedSdkConfig } from './EnhancedSdkService'

export {
  default as FriendsService,
  type Friend,
  type FriendRequest,
  type FriendCategory,
  type BlockedUser,
  type FriendStatistics,
  type PaginatedFriends
} from './FriendsService'

export {
  default as ChatroomService,
  type Chatroom,
  type ChatroomMessage,
  type PaginatedChatrooms,
  type UnreadCountInfo
} from './ChatroomService'
