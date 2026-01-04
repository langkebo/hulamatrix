/**
 * Shared Composables Index
 *
 * Phase 12 Optimization: Shared composables to reduce code duplication
 * between desktop and mobile components.
 *
 * These composables extract common business logic that can be reused
 * across different platform implementations while preserving platform-specific
 * UI differences.
 *
 * @see useMessageOperations - Message sending, forwarding, recalling
 * @see useMessageReactions - Message emoji reactions
 * @see useUserMenu - User menu navigation and actions
 * @see useRoomSearch - Room search functionality
 * @see useCallControls - WebRTC call controls
 * @see useNotificationSettings - Notification settings management
 * @see useMatrixClient - Matrix client access (already exists, unused)
 */

// Export all composables
export { useMessageOperations } from './useMessageOperations'
export { useMessageReactions } from './useMessageReactions'
export { useUserMenu } from './useUserMenu'
export { useRoomSearch } from './useRoomSearch'
export { useCallControls } from './useCallControls'
export { useNotificationSettings } from './useNotificationSettings'
export { useMatrixClient } from './useMatrixClient'
export { usePlatform, useReactivePlatform } from './usePlatform'

// Export types
export type {
  MessageOperationsOptions,
  MessageOperationsResult,
  MessageSendOptions
} from './useMessageOperations'

export type {
  MessageReaction,
  ReactionsState,
  MessageReactionsOptions,
  MessageReactionsResult
} from './useMessageReactions'

// Also export ReactionSummary and ReactionCategory from Matrix integration
export type {
  ReactionSummary,
  ReactionCategory
} from './useMessageReactions'

export type {
  MenuItem,
  UserMenuOptions,
  UserMenuResult
} from './useUserMenu'

export type {
  RoomSearchOptions,
  RoomSearchResult
} from './useRoomSearch'

export type {
  CallControlsOptions,
  CallControlsResult
} from './useCallControls'

export type {
  NotificationSettingsOptions,
  NotificationSettingsResult
} from './useNotificationSettings'

// Export utilities
export {
  isMessageOperationError,
  handleMessageOperationError
} from './useMessageOperations'

export {
  formatReactionCount,
  isValidReactionEmoji
} from './useMessageReactions'

export {
  shouldShowMenuItem,
  getMenuItemLabel
} from './useUserMenu'
