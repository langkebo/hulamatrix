/**
 * Chat Main Hook - Modular Entry Point
 *
 * Main hook that combines all chat main functionality from smaller modules
 *
 * This is a refactor of the original useChatMain.ts (1366 lines) into:
 * - useChatGroupNickname.ts - Group nickname modal management
 * - useChatSelection.ts - Selection and clipboard operations
 * - useChatHelpers.ts - Utility functions
 *
 * Note: The remaining menu and action logic is still in useChatMain.ts
 * and needs to be further refactored into:
 * - useChatMenus.ts - Menu list construction
 * - useChatActions.ts - Message action handlers
 *
 * Migration status:
 * - Phase 1 (Completed): Extracted group nickname, selection, and helpers
 * - Phase 2 (Pending): Extract menu list construction logic
 * - Phase 3 (Pending): Extract message action handlers
 * - Phase 4 (Pending): Update all imports to use modular approach
 */

import { type InjectionKey } from 'vue'
import type { UseChatMainContext } from '../useChatMain'

// Re-export the original hook for now
// The modular extraction is in progress - see phases above
export { useChatMain } from '../useChatMain'
export type { UseChatMainContext } from '../useChatMain'
export const chatMainInjectionKey = Symbol('chatMainInjectionKey') as InjectionKey<UseChatMainContext>

// Re-export modules for direct use if needed
export { useChatGroupNickname } from './useChatGroupNickname'
export type {
  GroupNicknameModalPayload,
  UseChatGroupNicknameState,
  UseChatGroupNicknameActions,
  UseChatGroupNicknameOptions
} from './useChatGroupNickname'

export { useChatSelection } from './useChatSelection'
export type {
  UseChatSelectionState,
  UseChatSelectionActions
} from './useChatSelection'

export {
  checkFriendRelation,
  isNoticeMessage,
  shouldHideCopy,
  extractMsgIdFromDataKey,
  resolveSelectionMessageId,
  getUserInitials,
  REPORT_REASONS
} from './useChatHelpers'
