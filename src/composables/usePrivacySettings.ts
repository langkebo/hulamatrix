import { ref } from 'vue'
import {
  blockUser,
  unblockUser,
  blockRoom,
  unblockRoom,
  reportUser,
  reportRoom,
  listBlockedUsers,
  listBlockedRooms,
  listReports
} from '@/integrations/synapse/privacy'

// Types
export interface PrivacyActionForm {
  targetType: 'user' | 'room'
  targetId: string
  action: 'block' | 'unblock' | 'report'
  reason: string
}

export interface BlockedUser {
  mxid: string
  [key: string]: unknown
}

export interface BlockedRoom {
  roomId: string
  [key: string]: unknown
}

export interface Report {
  target: string
  reason: string
  time: string
  [key: string]: unknown
}

export function usePrivacySettings() {
  // --- Actions (Block/Unblock/Report) ---
  const actionForm = ref<PrivacyActionForm>({
    targetType: 'user',
    targetId: '',
    action: 'block',
    reason: ''
  })
  const actionLoading = ref(false)

  const resetActionForm = () => {
    actionForm.value = {
      targetType: 'user',
      targetId: '',
      action: 'block',
      reason: ''
    }
  }

  const executeAction = async () => {
    const { targetType, targetId, action, reason } = actionForm.value
    if (!targetId.trim()) throw new Error('Target ID is required')

    actionLoading.value = true
    try {
      if (targetType === 'user') {
        if (action === 'block') await blockUser(targetId)
        else if (action === 'unblock') await unblockUser(targetId)
        else if (action === 'report') await reportUser(targetId, reason)
      } else {
        if (action === 'block') await blockRoom(targetId)
        else if (action === 'unblock') await unblockRoom(targetId)
        else if (action === 'report') await reportRoom(targetId, reason)
      }
    } finally {
      actionLoading.value = false
    }
  }

  // --- Management (List/Unblock) ---
  const blockedUsers = ref<BlockedUser[]>([])
  const blockedRooms = ref<BlockedRoom[]>([])
  const reports = ref<Report[]>([])
  const manageLoading = ref(false)

  const fetchPrivacyData = async () => {
    manageLoading.value = true
    try {
      const [users, rooms, reportsData] = await Promise.all([listBlockedUsers(), listBlockedRooms(), listReports()])
      blockedUsers.value = users
      blockedRooms.value = rooms
      reports.value = reportsData
    } finally {
      manageLoading.value = false
    }
  }

  const handleUnblockUser = async (mxid: string) => {
    await unblockUser(mxid)
    await fetchPrivacyData()
  }

  const handleUnblockRoom = async (roomId: string) => {
    await unblockRoom(roomId)
    await fetchPrivacyData()
  }

  return {
    // Actions
    actionForm,
    actionLoading,
    resetActionForm,
    executeAction,

    // Management
    blockedUsers,
    blockedRooms,
    reports,
    manageLoading,
    fetchPrivacyData,
    handleUnblockUser,
    handleUnblockRoom
  }
}
