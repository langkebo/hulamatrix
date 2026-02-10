/**
 * @deprecated This file contains legacy/mock functions.
 * Please migrate to the new API services:
 * - @/services/api/AuthApi
 * - @/services/api/FriendsApi
 * - @/services/api/GroupsApi
 * - @/services/api/MessagesApi
 * - @/services/api/UserApi
 * - @/services/api/SystemConfigApi
 *
 * Migration guide:
 * - import { AuthApi, FriendsApi, GroupsApi, MessagesApi, UserApi, SystemConfigApi } from '@/services/api'
 */

import MatrixClientService from '@/services/matrix/MatrixClientService'
import MatrixUserService from '@/services/matrix/MatrixUserService'
import { getMatrixConfig } from '@/config/matrix'
import type { UserDetail, UserState } from '@/services/types'
import { AuthApi, FriendsApi, GroupsApi, MessagesApi, UserApi, SystemConfigApi } from '@/services/api'

/**
 * 获取当前登录用户的详细信息
 * @deprecated 建议直接使用 MatrixUserService.getInstance().currentUser
 */
async function getUserDetail(): Promise<UserDetail> {
  // console.log('[ImRequestUtils] getUserDetail called')

  const userService = MatrixUserService.getInstance()

  // 尝试加载最新的 Profile
  if (!userService.currentUser) {
    try {
      await userService.loadCurrentProfile()
    } catch (e) {
      console.warn('[ImRequestUtils] Failed to load profile from service', e)
    }
  }

  const profile = userService.currentUser

  if (profile) {
    // 适配旧版 UserDetail 结构
    // 注意：uid 和 account 的处理可能需要根据实际业务调整，这里保持原 Mock 逻辑的风格
    const localPart = profile.userId.split(':')[0].replace('@', '')
    return {
      id: profile.userId,
      uid: localPart,
      account: localPart,
      name: profile.displayName || localPart,
      avatar: profile.avatarUrl || '',
      userStateId: '1', // 默认在线
      email: undefined,
      phone: undefined
    }
  }

  // Fallback: 如果 Service 没准备好，尝试直接从 Client 获取或配置获取
  const clientService = MatrixClientService.getInstance()
  const client = clientService.getClient()

  if (!client) {
    // console.warn('[ImRequestUtils] No Matrix client, returning default user')
    const config = getMatrixConfig()
    const userId = config.userId || 'unknown'
    const localPart = userId.split(':')[0].replace('@', '')

    return {
      uid: localPart,
      account: localPart,
      name: localPart,
      avatar: '',
      userStateId: '1'
    }
  }

  const userId = client.getUserId()
  const user = client.getUser(userId || '')
  const localPart = (userId || 'unknown').split(':')[0].replace('@', '')

  return {
    uid: localPart,
    account: localPart,
    name: user?.displayName || localPart,
    avatar: user?.avatarUrl || '',
    userStateId: '1'
  }
}

/**
 * @deprecated Use UserApi.getAllUserState() instead
 */
async function getAllUserState(): Promise<UserState[]> {
  return UserApi.getAllUserState()
}

/** @deprecated Use UserApi.getUserByIds() instead */
async function getUserByIds(userIds: string[]): Promise<any[]> {
  return UserApi.getUserByIds({ userIds })
}

/** @deprecated Mock Function */
async function getMsgList(params: any): Promise<any> {
  console.log('[ImRequestUtils] getMsgList called with:', params)
  return Promise.resolve({ messages: [], total: 0 })
}

/** @deprecated Mock Function */
async function changeUserState(params: any): Promise<any> {
  console.log('[ImRequestUtils] changeUserState called with:', params)
  return Promise.resolve({ success: true })
}

/** @deprecated Use AuthApi.sendCaptcha() instead */
async function sendCaptcha(params: any): Promise<any> {
  console.log('[ImRequestUtils] sendCaptcha called with:', params)
  return AuthApi.sendCaptcha(params)
}

/** @deprecated Use AuthApi.register() instead */
async function register(params: any): Promise<any> {
  return AuthApi.register(params)
}

/** @deprecated Use AuthApi.checkQRStatus() instead */
async function checkQRStatus(params: any): Promise<any> {
  console.log('[ImRequestUtils] checkQRStatus called with:', params)
  return AuthApi.checkQRStatus(params)
}

/** @deprecated Use AuthApi.generateQRCode() instead */
async function generateQRCode(params: any): Promise<any> {
  console.log('[ImRequestUtils] generateQRCode called with:', params)
  return AuthApi.generateQRCode(params)
}

/** @deprecated Use AuthApi.scanQRCodeAPI() instead */
async function scanQRCodeAPI(params: any): Promise<any> {
  console.log('[ImRequestUtils] scanQRCodeAPI called with:', params)
  return AuthApi.scanQRCodeAPI(params)
}

/** @deprecated Use AuthApi.confirmQRCodeAPI() instead */
async function confirmQRCodeAPI(params: any): Promise<any> {
  console.log('[ImRequestUtils] confirmQRCodeAPI called with:', params)
  return AuthApi.confirmQRCodeAPI(params)
}

/** @deprecated Use FriendsApi.searchFriend() instead */
async function searchFriend(params: any): Promise<any> {
  console.log('[ImRequestUtils] searchFriend called with:', params)
  return FriendsApi.searchFriend(params)
}

/** @deprecated Use FriendsApi.searchGroup() instead */
async function searchGroup(params: any): Promise<any> {
  console.log('[ImRequestUtils] searchGroup called with:', params)
  return FriendsApi.searchGroup(params)
}

/** @deprecated Mock Function */
async function inviteGroupMember(params: any): Promise<any> {
  console.log('[ImRequestUtils] inviteGroupMember called with:', params)
  return Promise.resolve({ code: 200, success: true })
}

/** @deprecated Use SystemConfigApi.notification() instead */
async function notification(params: any): Promise<any> {
  return SystemConfigApi.notification(params)
}

/** @deprecated Use SystemConfigApi.shield() instead */
async function shield(params: any): Promise<any> {
  return SystemConfigApi.shield(params)
}

/** @deprecated Use SystemConfigApi.getGroupInfo() instead */
async function getGroupInfo(params: any): Promise<any> {
  // Note: getGroupInfo takes roomId directly, not an object
  return SystemConfigApi.getGroupInfo(params)
}

/** @deprecated Use SystemConfigApi.setSessionTop() instead */
async function setSessionTop(params: any): Promise<any> {
  return SystemConfigApi.setSessionTop(params)
}

/** @deprecated Use SystemConfigApi.updateRoomInfo() instead */
async function updateRoomInfo(params: any): Promise<any> {
  return SystemConfigApi.updateRoomInfo(params)
}

/** @deprecated Use MessagesApi.mergeMsg() instead */
async function mergeMsg(params: any): Promise<any> {
  console.log('[ImRequestUtils] mergeMsg called with:', params)
  return MessagesApi.mergeMsg(params)
}

/** @deprecated Use SystemConfigApi.getGroupDetail() instead */
async function getGroupDetail(params: any): Promise<any> {
  return SystemConfigApi.getGroupDetail(params)
}

/** @deprecated Use MessagesApi.markMsg() instead */
async function markMsg(params: any): Promise<any> {
  return MessagesApi.markMsg(params)
}

/** @deprecated Use MessagesApi.recallMsg() instead */
async function recallMsg(params: any): Promise<any> {
  console.log('[ImRequestUtils] recallMsg called with:', params)
  return MessagesApi.recallMsg(params)
}

/** @deprecated Use GroupsApi.removeGroupMember() instead */
async function removeGroupMember(params: any): Promise<any> {
  console.log('[ImRequestUtils] removeGroupMember called with:', params)
  return GroupsApi.removeGroupMember(params)
}

/** @deprecated Use GroupsApi.updateMyRoomInfo() instead */
async function updateMyRoomInfo(params: any): Promise<any> {
  console.log('[ImRequestUtils] updateMyRoomInfo called with:', params)
  return GroupsApi.updateMyRoomInfo(params)
}

/** @deprecated Use MessagesApi.getSessionDetailWithFriends() instead */
async function getSessionDetailWithFriends(params: any): Promise<any> {
  return MessagesApi.getSessionDetailWithFriends(params)
}

/** @deprecated Mock Function */
async function exitGroup(params: any): Promise<any> {
  console.log('[ImRequestUtils] exitGroup called with:', params)
  return Promise.resolve({ code: 200, success: true })
}

/** @deprecated Use AuthApi.logout() instead */
async function logout(params: any): Promise<any> {
  console.log('[ImRequestUtils] logout called with:', params)
  return AuthApi.logout(params)
}

/** @deprecated Use SystemConfigApi.initConfig() instead */
async function initConfig(): Promise<any> {
  return SystemConfigApi.initConfig()
}

/** @deprecated Use FriendsApi.deleteFriend() instead */
async function deleteFriend(params: any): Promise<any> {
  return FriendsApi.deleteFriend(params)
}

/** @deprecated Use FriendsApi.modifyFriendRemark() instead */
async function modifyFriendRemark(params: any): Promise<any> {
  return FriendsApi.modifyFriendRemark(params)
}

/** @deprecated Mock Function */
async function getFriendPage(params: any): Promise<any> {
  console.log('[ImRequestUtils] getFriendPage called with:', params)
  return Promise.resolve({ code: 200, data: { list: [], total: 0 } })
}

/** @deprecated Mock Function */
async function getNoticeUnreadCount(): Promise<any> {
  console.log('[ImRequestUtils] getNoticeUnreadCount called')
  return Promise.resolve({ code: 200, data: { count: 0 } })
}

/** @deprecated Mock Function */
async function handleInvite(params: any): Promise<any> {
  console.log('[ImRequestUtils] handleInvite called with:', params)
  return Promise.resolve({ code: 200, success: true })
}

/** @deprecated Mock Function */
async function requestNoticePage(params: any): Promise<any> {
  console.log('[ImRequestUtils] requestNoticePage called with:', params)
  return Promise.resolve({ code: 200, data: { list: [], total: 0 } })
}

/** @deprecated Use SystemConfigApi.getEmoji() instead */
async function getEmoji(): Promise<any> {
  return SystemConfigApi.getEmoji()
}

/** @deprecated Use SystemConfigApi.addEmoji() instead */
async function addEmoji(params: any): Promise<any> {
  return SystemConfigApi.addEmoji(params)
}

/** @deprecated Use SystemConfigApi.deleteEmoji() instead */
async function deleteEmoji(params: any): Promise<any> {
  return SystemConfigApi.deleteEmoji(params)
}

/** @deprecated Use SystemConfigApi.groupList() instead */
async function groupList(params: any): Promise<any> {
  return SystemConfigApi.groupList(params)
}

/** @deprecated Use SystemConfigApi.groupListMember() instead */
async function groupListMember(params: any): Promise<any> {
  return SystemConfigApi.groupListMember(params)
}

/** @deprecated Use SystemConfigApi.addAdmin() instead */
async function addAdmin(params: any): Promise<any> {
  return SystemConfigApi.addAdmin(params)
}

/** @deprecated Use SystemConfigApi.revokeAdmin() instead */
async function revokeAdmin(params: any): Promise<any> {
  return SystemConfigApi.revokeAdmin(params)
}

/** @deprecated Use SystemConfigApi.deleteAnnouncement() instead */
async function deleteAnnouncement(params: any): Promise<any> {
  console.log('[ImRequestUtils] deleteAnnouncement called with:', params)
  return SystemConfigApi.deleteAnnouncement(params)
}

/** @deprecated Use SystemConfigApi.getAnnouncementDetail() instead */
async function getAnnouncementDetail(params: any): Promise<any> {
  console.log('[ImRequestUtils] getAnnouncementDetail called with:', params)
  return SystemConfigApi.getAnnouncementDetail(params)
}

/** @deprecated Use SystemConfigApi.editAnnouncement() instead */
async function editAnnouncement(params: any): Promise<any> {
  console.log('[ImRequestUtils] editAnnouncement called with:', params)
  return SystemConfigApi.editAnnouncement(params)
}

/** @deprecated Use SystemConfigApi.pushAnnouncement() instead */
async function pushAnnouncement(params: any): Promise<any> {
  console.log('[ImRequestUtils] pushAnnouncement called with:', params)
  return SystemConfigApi.pushAnnouncement(params)
}

/** @deprecated Use AuthApi.forgetPassword() instead */
async function forgetPassword(params: any): Promise<any> {
  console.log('[ImRequestUtils] forgetPassword called with:', params)
  return AuthApi.forgetPassword(params)
}

/** @deprecated Use AuthApi.getCaptcha() instead */
async function getCaptcha(params: any): Promise<any> {
  console.log('[ImRequestUtils] getCaptcha called with:', params)
  return AuthApi.getCaptcha()
}

/** @deprecated Use FriendsApi.sendAddFriendRequest() instead */
async function sendAddFriendRequest(params: any): Promise<any> {
  console.log('[ImRequestUtils] sendAddFriendRequest called with:', params)
  return FriendsApi.sendAddFriendRequest(params)
}

/** @deprecated Mock Function */
async function applyGroup(params: any): Promise<any> {
  console.log('[ImRequestUtils] applyGroup called with:', params)
  return Promise.resolve({ code: 200, data: {} })
}

/** @deprecated Use MessagesApi.getMsgReadCount() instead */
async function getMsgReadCount(params: any): Promise<any> {
  console.log('[ImRequestUtils] getMsgReadCount called with:', params)
  return MessagesApi.getMsgReadCount(params)
}

/** @deprecated Use GroupsApi.createGroup() instead */
async function createGroup(params: any): Promise<any> {
  console.log('[ImRequestUtils] createGroup called with:', params)
  return GroupsApi.createGroup(params)
}

/** @deprecated Use UserApi.getBadgeList() instead */
async function getBadgeList(): Promise<any> {
  console.log('[ImRequestUtils] getBadgeList called')
  return UserApi.getBadgeList()
}

/** @deprecated Use UserApi.uploadAvatar() instead */
async function uploadAvatar(params: any): Promise<any> {
  console.log('[ImRequestUtils] uploadAvatar called with:', params)
  return UserApi.uploadAvatar(params)
}

/** @deprecated Use UserApi.ModifyUserInfo() instead */
async function ModifyUserInfo(params: any): Promise<any> {
  console.log('[ImRequestUtils] ModifyUserInfo called with:', params)
  return UserApi.ModifyUserInfo(params)
}

/** @deprecated Use UserApi.setUserBadge() instead */
async function setUserBadge(params: any): Promise<any> {
  console.log('[ImRequestUtils] setUserBadge called with:', params)
  return UserApi.setUserBadge(params)
}

/** @deprecated Mock Function */
async function getSessionDetail(params: any): Promise<any> {
  console.log('[ImRequestUtils] getSessionDetail called with:', params)
  return Promise.resolve({ code: 200, data: {} })
}

/** @deprecated Mock Function */
async function markMsgRead(params: any): Promise<any> {
  console.log('[ImRequestUtils] markMsgRead called with:', params)
  return Promise.resolve({ code: 200, success: true })
}

/** @deprecated Mock Function */
async function videoMyPage(params: any): Promise<any> {
  console.log('[ImRequestUtils] videoMyPage called with:', params)
  return Promise.resolve({ code: 200, data: { records: [], total: 0 } })
}

/** @deprecated Mock Function */
async function videoGenerate(params: any): Promise<any> {
  console.log('[ImRequestUtils] videoGenerate called with:', params)
  return Promise.resolve({ code: 200, data: { videoUrl: 'https://example.com/video.mp4' } })
}

/** @deprecated Mock Function */
async function videoDeleteMy(params: any): Promise<any> {
  console.log('[ImRequestUtils] videoDeleteMy called with:', params)
  return Promise.resolve({ code: 200, success: true })
}

/** @deprecated Mock Function */
async function modelPage(params: any): Promise<any> {
  console.log('[ImRequestUtils] modelPage called with:', params)
  return Promise.resolve({ code: 200, data: { records: [], total: 0 } })
}

export {
  getUserDetail,
  getAllUserState,
  getUserByIds,
  getMsgList,
  changeUserState,
  sendCaptcha,
  register,
  checkQRStatus,
  generateQRCode,
  scanQRCodeAPI,
  confirmQRCodeAPI,
  searchFriend,
  searchGroup,
  inviteGroupMember,
  notification,
  shield,
  getGroupInfo,
  setSessionTop,
  updateRoomInfo,
  mergeMsg,
  getGroupDetail,
  markMsg,
  recallMsg,
  removeGroupMember,
  updateMyRoomInfo,
  getSessionDetailWithFriends,
  exitGroup,
  logout,
  initConfig,
  deleteFriend,
  modifyFriendRemark,
  getFriendPage,
  getNoticeUnreadCount,
  handleInvite,
  requestNoticePage,
  getEmoji,
  addEmoji,
  deleteEmoji,
  groupList,
  groupListMember,
  addAdmin,
  revokeAdmin,
  deleteAnnouncement,
  getAnnouncementDetail,
  editAnnouncement,
  pushAnnouncement,
  forgetPassword,
  getCaptcha,
  sendAddFriendRequest,
  applyGroup,
  getMsgReadCount,
  createGroup,
  getBadgeList,
  uploadAvatar,
  ModifyUserInfo,
  setUserBadge,
  getSessionDetail,
  markMsgRead,
  videoMyPage,
  videoGenerate,
  videoDeleteMy,
  modelPage
}
