import MatrixClientService from '@/services/matrix/MatrixClientService'
import { getMatrixConfig } from '@/config/matrix'

interface UserDetail {
  id?: string
  uid: string
  account: string
  name: string
  avatar: string
  userStateId: string
  email?: string
  phone?: string
}

interface UserState {
  id: string
  name: string
  url: string
  bgColor?: string
}

async function getUserDetail(): Promise<UserDetail> {
  console.log('[ImRequestUtils] getUserDetail called')

  const clientService = MatrixClientService.getInstance()
  const client = clientService.getClient()

  if (!client) {
    console.warn('[ImRequestUtils] No Matrix client, returning default user')
    const config = getMatrixConfig()
    return {
      uid: config.userId?.replace('@', '').split(':')[0] || 'unknown',
      account: config.userId?.split(':')[0] || 'unknown',
      name: config.userId?.split(':')[0] || 'Unknown User',
      avatar: '',
      userStateId: '1'
    }
  }

  const userId = client.getUserId()
  const user = client.getUser(userId || '')

  return {
    uid: userId?.replace('@', '').split(':')[0] || 'unknown',
    account: userId?.split(':')[0] || 'unknown',
    name: user?.displayName || userId?.split(':')[0] || 'Unknown User',
    avatar: user?.avatarUrl || '',
    userStateId: '1'
  }
}

async function getAllUserState(): Promise<UserState[]> {
  console.log('[ImRequestUtils] getAllUserState called')

  return [
    {
      id: '1',
      name: 'Online',
      url: ''
    },
    {
      id: '2',
      name: 'Busy',
      url: ''
    },
    {
      id: '3',
      name: 'Away',
      url: ''
    },
    {
      id: '4',
      name: 'Invisible',
      url: ''
    }
  ]
}

async function getUserByIds(userIds: string[]): Promise<any[]> {
  console.log('[ImRequestUtils] getUserByIds called with:', userIds)
  return Promise.resolve([])
}

async function getMsgList(params: any): Promise<any> {
  console.log('[ImRequestUtils] getMsgList called with:', params)
  return Promise.resolve({ messages: [], total: 0 })
}

async function changeUserState(params: any): Promise<any> {
  console.log('[ImRequestUtils] changeUserState called with:', params)
  return Promise.resolve({ success: true })
}

async function sendCaptcha(params: any): Promise<any> {
  console.log('[ImRequestUtils] sendCaptcha called with:', params)
  return Promise.resolve({ code: 200, data: { ticket: 'mock-ticket' } })
}

async function register(params: any): Promise<any> {
  console.log('[ImRequestUtils] register called with:', params)
  return Promise.resolve({ code: 200, data: { uid: 'new-user-id' } })
}

async function checkQRStatus(params: any): Promise<any> {
  console.log('[ImRequestUtils] checkQRStatus called with:', params)
  return Promise.resolve({ code: 200, data: { status: 'pending' } })
}

async function generateQRCode(params: any): Promise<any> {
  console.log('[ImRequestUtils] generateQRCode called with:', params)
  return Promise.resolve({ code: 200, data: { qrCode: 'mock-qr-code' } })
}

async function scanQRCodeAPI(params: any): Promise<any> {
  console.log('[ImRequestUtils] scanQRCodeAPI called with:', params)
  return Promise.resolve({ code: 200, data: { ip: '192.168.1.1', expireTime: 300 } })
}

async function confirmQRCodeAPI(params: any): Promise<any> {
  console.log('[ImRequestUtils] confirmQRCodeAPI called with:', params)
  return Promise.resolve({ code: 200, success: true })
}

async function searchFriend(params: any): Promise<any> {
  console.log('[ImRequestUtils] searchFriend called with:', params)
  return Promise.resolve({ code: 200, data: { friends: [] } })
}

async function searchGroup(params: any): Promise<any> {
  console.log('[ImRequestUtils] searchGroup called with:', params)
  return Promise.resolve({ code: 200, data: { groups: [] } })
}

async function inviteGroupMember(params: any): Promise<any> {
  console.log('[ImRequestUtils] inviteGroupMember called with:', params)
  return Promise.resolve({ code: 200, success: true })
}

async function notification(params: any): Promise<any> {
  console.log('[ImRequestUtils] notification called with:', params)
  return Promise.resolve({ code: 200, success: true })
}

async function shield(params: any): Promise<any> {
  console.log('[ImRequestUtils] shield called with:', params)
  return Promise.resolve({ code: 200, success: true })
}

async function getGroupInfo(params: any): Promise<any> {
  console.log('[ImRequestUtils] getGroupInfo called with:', params)
  return Promise.resolve({ code: 200, data: {} })
}

async function setSessionTop(params: any): Promise<any> {
  console.log('[ImRequestUtils] setSessionTop called with:', params)
  return Promise.resolve({ code: 200, success: true })
}

async function updateRoomInfo(params: any): Promise<any> {
  console.log('[ImRequestUtils] updateRoomInfo called with:', params)
  return Promise.resolve({ code: 200, success: true })
}

async function mergeMsg(params: any): Promise<any> {
  console.log('[ImRequestUtils] mergeMsg called with:', params)
  return Promise.resolve({ code: 200, success: true })
}

async function getGroupDetail(params: any): Promise<any> {
  console.log('[ImRequestUtils] getGroupDetail called with:', params)
  return Promise.resolve({ code: 200, data: {} })
}

async function markMsg(params: any): Promise<any> {
  console.log('[ImRequestUtils] markMsg called with:', params)
  return Promise.resolve({ code: 200, success: true })
}

async function recallMsg(params: any): Promise<any> {
  console.log('[ImRequestUtils] recallMsg called with:', params)
  return Promise.resolve({ code: 200, success: true })
}

async function removeGroupMember(params: any): Promise<any> {
  console.log('[ImRequestUtils] removeGroupMember called with:', params)
  return Promise.resolve({ code: 200, success: true })
}

async function updateMyRoomInfo(params: any): Promise<any> {
  console.log('[ImRequestUtils] updateMyRoomInfo called with:', params)
  return Promise.resolve({ code: 200, success: true })
}

async function getSessionDetailWithFriends(params: any): Promise<any> {
  console.log('[ImRequestUtils] getSessionDetailWithFriends called with:', params)
  return Promise.resolve({ code: 200, data: {} })
}

async function exitGroup(params: any): Promise<any> {
  console.log('[ImRequestUtils] exitGroup called with:', params)
  return Promise.resolve({ code: 200, success: true })
}

async function logout(params: any): Promise<any> {
  console.log('[ImRequestUtils] logout called with:', params)
  return Promise.resolve({ code: 200, success: true })
}

async function initConfig(): Promise<any> {
  console.log('[ImRequestUtils] initConfig called')
  return Promise.resolve({ code: 200, data: {} })
}

async function deleteFriend(params: any): Promise<any> {
  console.log('[ImRequestUtils] deleteFriend called with:', params)
  return Promise.resolve({ code: 200, success: true })
}

async function modifyFriendRemark(params: any): Promise<any> {
  console.log('[ImRequestUtils] modifyFriendRemark called with:', params)
  return Promise.resolve({ code: 200, success: true })
}

async function getFriendPage(params: any): Promise<any> {
  console.log('[ImRequestUtils] getFriendPage called with:', params)
  return Promise.resolve({ code: 200, data: { list: [], total: 0 } })
}

async function getNoticeUnreadCount(): Promise<any> {
  console.log('[ImRequestUtils] getNoticeUnreadCount called')
  return Promise.resolve({ code: 200, data: { count: 0 } })
}

async function handleInvite(params: any): Promise<any> {
  console.log('[ImRequestUtils] handleInvite called with:', params)
  return Promise.resolve({ code: 200, success: true })
}

async function requestNoticePage(params: any): Promise<any> {
  console.log('[ImRequestUtils] requestNoticePage called with:', params)
  return Promise.resolve({ code: 200, data: { list: [], total: 0 } })
}

async function getEmoji(): Promise<any> {
  console.log('[ImRequestUtils] getEmoji called')
  return Promise.resolve({ code: 200, data: { list: [] } })
}

async function addEmoji(params: any): Promise<any> {
  console.log('[ImRequestUtils] addEmoji called with:', params)
  return Promise.resolve({ code: 200, data: {} })
}

async function deleteEmoji(params: any): Promise<any> {
  console.log('[ImRequestUtils] deleteEmoji called with:', params)
  return Promise.resolve({ code: 200, success: true })
}

async function groupList(params: any): Promise<any> {
  console.log('[ImRequestUtils] groupList called with:', params)
  return Promise.resolve({ code: 200, data: { list: [], total: 0 } })
}

async function groupListMember(params: any): Promise<any> {
  console.log('[ImRequestUtils] groupListMember called with:', params)
  return Promise.resolve({ code: 200, data: { list: [], total: 0 } })
}

async function addAdmin(params: any): Promise<any> {
  console.log('[ImRequestUtils] addAdmin called with:', params)
  return Promise.resolve({ code: 200, success: true })
}

async function revokeAdmin(params: any): Promise<any> {
  console.log('[ImRequestUtils] revokeAdmin called with:', params)
  return Promise.resolve({ code: 200, success: true })
}

async function deleteAnnouncement(params: any): Promise<any> {
  console.log('[ImRequestUtils] deleteAnnouncement called with:', params)
  return Promise.resolve({ code: 200, success: true })
}

async function getAnnouncementDetail(params: any): Promise<any> {
  console.log('[ImRequestUtils] getAnnouncementDetail called with:', params)
  return Promise.resolve({ code: 200, data: {} })
}

async function editAnnouncement(params: any): Promise<any> {
  console.log('[ImRequestUtils] editAnnouncement called with:', params)
  return Promise.resolve({ code: 200, data: {} })
}

async function pushAnnouncement(params: any): Promise<any> {
  console.log('[ImRequestUtils] pushAnnouncement called with:', params)
  return Promise.resolve({ code: 200, data: {} })
}

async function forgetPassword(params: any): Promise<any> {
  console.log('[ImRequestUtils] forgetPassword called with:', params)
  return Promise.resolve({ code: 200, data: {} })
}

async function getCaptcha(params: any): Promise<any> {
  console.log('[ImRequestUtils] getCaptcha called with:', params)
  return Promise.resolve({ code: 200, data: { ticket: 'mock-ticket' } })
}

async function sendAddFriendRequest(params: any): Promise<any> {
  console.log('[ImRequestUtils] sendAddFriendRequest called with:', params)
  return Promise.resolve({ code: 200, data: {} })
}

async function applyGroup(params: any): Promise<any> {
  console.log('[ImRequestUtils] applyGroup called with:', params)
  return Promise.resolve({ code: 200, data: {} })
}

async function getMsgReadCount(params: any): Promise<any> {
  console.log('[ImRequestUtils] getMsgReadCount called with:', params)
  return Promise.resolve({ code: 200, data: { count: 0 } })
}

async function createGroup(params: any): Promise<any> {
  console.log('[ImRequestUtils] createGroup called with:', params)
  return Promise.resolve({ code: 200, data: {} })
}

async function getBadgeList(): Promise<any> {
  console.log('[ImRequestUtils] getBadgeList called')
  return Promise.resolve({ code: 200, data: { list: [] } })
}

async function uploadAvatar(params: any): Promise<any> {
  console.log('[ImRequestUtils] uploadAvatar called with:', params)
  return Promise.resolve({ code: 200, data: { url: 'https://example.com/avatar.png' } })
}

async function ModifyUserInfo(params: any): Promise<any> {
  console.log('[ImRequestUtils] ModifyUserInfo called with:', params)
  return Promise.resolve({ code: 200, success: true })
}

async function setUserBadge(params: any): Promise<any> {
  console.log('[ImRequestUtils] setUserBadge called with:', params)
  return Promise.resolve({ code: 200, success: true })
}

async function getSessionDetail(params: any): Promise<any> {
  console.log('[ImRequestUtils] getSessionDetail called with:', params)
  return Promise.resolve({ code: 200, data: {} })
}

async function markMsgRead(params: any): Promise<any> {
  console.log('[ImRequestUtils] markMsgRead called with:', params)
  return Promise.resolve({ code: 200, success: true })
}

async function videoMyPage(params: any): Promise<any> {
  console.log('[ImRequestUtils] videoMyPage called with:', params)
  return Promise.resolve({ code: 200, data: { records: [], total: 0 } })
}

async function videoGenerate(params: any): Promise<any> {
  console.log('[ImRequestUtils] videoGenerate called with:', params)
  return Promise.resolve({ code: 200, data: { videoUrl: 'https://example.com/video.mp4' } })
}

async function videoDeleteMy(params: any): Promise<any> {
  console.log('[ImRequestUtils] videoDeleteMy called with:', params)
  return Promise.resolve({ code: 200, success: true })
}

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
