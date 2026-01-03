/**
 * IM Request Utils - Placeholder
 *
 * @deprecated 此文件已被移除，旧的后端 API 已废弃
 * 所有函数都是空实现，请使用 Matrix SDK 或 v2 services 代替
 */

import { logger } from '@/utils/logger'

// ============================================================================
// 好友/联系人相关 (使用 friendsServiceV2)
// ============================================================================

export async function deleteFriend(..._args: unknown[]): Promise<void> {
  logger.warn('[ImRequestUtils] deleteFriend() is deprecated, use friendsServiceV2.removeFriend() instead')
}

export async function sendAddFriendRequest(..._args: unknown[]): Promise<void> {
  logger.warn('[ImRequestUtils] sendAddFriendRequest() is deprecated, use friendsServiceV2.sendFriendRequest() instead')
}

export async function modifyFriendRemark(..._args: unknown[]): Promise<void> {
  logger.warn(
    '[ImRequestUtils] modifyFriendRemark() is deprecated, use sessionSettingsService.setFriendRemark() instead'
  )
}

export async function searchFriend(..._args: unknown[]): Promise<unknown[]> {
  logger.warn('[ImRequestUtils] searchFriend() is deprecated, use friendsServiceV2.searchUsers() instead')
  return []
}

export async function getSessionDetailWithFriends(..._args: unknown[]): Promise<unknown> {
  logger.warn(
    '[ImRequestUtils] getSessionDetailWithFriends() is deprecated, use matrixRoomManager.createDMRoom() instead'
  )
  return {}
}

// ============================================================================
// 群组相关 (使用 Matrix SDK rooms)
// ============================================================================

export async function createGroup(..._args: unknown[]): Promise<unknown> {
  logger.warn('[ImRequestUtils] createGroup() is deprecated, use Matrix SDK room creation instead')
  return {}
}

export async function inviteGroupMember(..._args: unknown[]): Promise<void> {
  logger.warn('[ImRequestUtils] inviteGroupMember() is deprecated, use Matrix SDK instead')
}

export async function applyGroup(..._args: unknown[]): Promise<void> {
  logger.warn('[ImRequestUtils] applyGroup() is deprecated, use Matrix SDK instead')
}

export async function getGroupInfo(..._args: unknown[]): Promise<unknown> {
  logger.warn('[ImRequestUtils] getGroupInfo() is deprecated, use Matrix SDK room API instead')
  return {}
}

export async function getGroupDetail(..._args: unknown[]): Promise<unknown> {
  logger.warn('[ImRequestUtils] getGroupDetail() is deprecated, use Matrix SDK room API instead')
  return {}
}

export async function searchGroup(..._args: unknown[]): Promise<unknown[]> {
  logger.warn('[ImRequestUtils] searchGroup() is deprecated, use Matrix SDK room search instead')
  return []
}

// ============================================================================
// 消息相关
// ============================================================================

export async function recallMsg(..._args: unknown[]): Promise<void> {
  logger.warn('[ImRequestUtils] recallMsg() is deprecated, use Matrix SDK instead')
}

export async function mergeMsg(..._args: unknown[]): Promise<void> {
  logger.warn('[ImRequestUtils] mergeMsg() is deprecated')
}

export async function getMsgList(..._args: unknown[]): Promise<unknown[]> {
  logger.warn('[ImRequestUtils] getMsgList() is deprecated, use unifiedMessageService.pageMessages() instead')
  return []
}

// ============================================================================
// 用户相关
// ============================================================================

export async function ModifyUserInfo(..._args: unknown[]): Promise<void> {
  logger.warn('[ImRequestUtils] ModifyUserInfo() is deprecated, use userProfileService.setDisplayName() instead')
}

export async function uploadAvatar(..._args: unknown[]): Promise<string> {
  logger.warn(
    '[ImRequestUtils] uploadAvatar() is deprecated, use userProfileService.setAvatar() or setAvatarUrl() instead'
  )
  return ''
}

export async function getUserByIds(..._args: unknown[]): Promise<unknown[]> {
  logger.warn('[ImRequestUtils] getUserByIds() is deprecated, use userQueryService.getUsersByIds() instead')
  return []
}

export async function changeUserState(..._args: unknown[]): Promise<void> {
  logger.warn('[ImRequestUtils] changeUserState() is deprecated, use Matrix SDK presence instead')
}

// ============================================================================
// 会话相关
// ============================================================================

export async function setSessionTop(..._args: unknown[]): Promise<void> {
  logger.warn('[ImRequestUtils] setSessionTop() is deprecated, use sessionSettingsService.setSessionTop() instead')
}

export async function shield(..._args: unknown[]): Promise<void> {
  logger.warn('[ImRequestUtils] shield() is deprecated, use sessionSettingsService.setSessionShield() instead')
}

export async function notification(..._args: unknown[]): Promise<void> {
  logger.warn('[ImRequestUtils] notification() is deprecated, use sessionSettingsService.setNotificationMode() instead')
}

export async function updateMyRoomInfo(..._args: unknown[]): Promise<void> {
  logger.warn('[ImRequestUtils] updateMyRoomInfo() is deprecated, use Matrix SDK room state events instead')
}

// ============================================================================
// 公告相关
// ============================================================================

export async function getAnnouncementDetail(..._args: unknown[]): Promise<unknown> {
  logger.warn('[ImRequestUtils] getAnnouncementDetail() is deprecated')
  return {}
}

export async function editAnnouncement(..._args: unknown[]): Promise<void> {
  logger.warn('[ImRequestUtils] editAnnouncement() is deprecated')
}

export async function pushAnnouncement(..._args: unknown[]): Promise<void> {
  logger.warn('[ImRequestUtils] pushAnnouncement() is deprecated')
}

// ============================================================================
// 认证相关
// ============================================================================

export async function register(..._args: unknown[]): Promise<void> {
  logger.warn('[ImRequestUtils] register() is deprecated, use Matrix SDK registration instead')
}

export async function logout(..._args: unknown[]): Promise<void> {
  logger.warn('[ImRequestUtils] logout() is deprecated, use Matrix SDK logout instead')
}

// ============================================================================
// 二维码相关
// ============================================================================

export async function scanQRCodeAPI(..._args: unknown[]): Promise<unknown> {
  logger.warn('[ImRequestUtils] scanQRCodeAPI() is deprecated')
  return {}
}

export async function confirmQRCodeAPI(..._args: unknown[]): Promise<unknown> {
  logger.warn('[ImRequestUtils] confirmQRCodeAPI() is deprecated')
  return {}
}

// ============================================================================
// 通知和联系人相关
// ============================================================================

export async function getNoticeUnreadCount(..._args: unknown[]): Promise<number> {
  logger.warn('[ImRequestUtils] getNoticeUnreadCount() is deprecated')
  return 0
}

export async function getContactList(..._args: unknown[]): Promise<unknown[]> {
  logger.warn('[ImRequestUtils] getContactList() is deprecated, use Matrix SDK room API instead')
  return []
}

export async function markMsgRead(..._args: unknown[]): Promise<void> {
  logger.warn('[ImRequestUtils] markMsgRead() is deprecated, use Matrix SDK read receipts instead')
}

export async function updateRoomInfo(..._args: unknown[]): Promise<void> {
  logger.warn('[ImRequestUtils] updateRoomInfo() is deprecated, use Matrix SDK room state events instead')
}

// ============================================================================
// 通用请求函数（保留接口以避免编译错误）
// ============================================================================

export async function invokeWithRetry<T>(
  _command: string,
  _args?: Record<string, unknown>,
  _options?: unknown
): Promise<T> {
  logger.warn('[ImRequestUtils] invokeWithRetry() is deprecated - old backend API removed')
  return {} as T
}

export async function invokeWithErrorHandler<T>(
  _command: string,
  _args?: Record<string, unknown>,
  _handlerOptions?: unknown
): Promise<T> {
  logger.warn('[ImRequestUtils] invokeWithErrorHandler() is deprecated - old backend API removed')
  return {} as T
}

export async function invokeSilently<T>(_command: string, _args?: Record<string, unknown>): Promise<T> {
  logger.warn('[ImRequestUtils] invokeSilently() is deprecated - old backend API removed')
  return {} as T
}
