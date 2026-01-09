import { ref, type Ref, computed } from 'vue'
import { dlg } from '@/utils/SafeUI'
import { logger } from '@/utils/logger'

// Define the CallParticipant interface locally
interface CallParticipant {
  userId: string
  name?: string
  avatar?: string
  isMuted?: boolean
  hasCamera?: boolean
  isHost?: boolean
  isSpeaking?: boolean
  stream?: any
}

interface UseCallParticipantsOptions {
  callId: Ref<string>
  rtcManager: {
    inviteToGroupCall: (callId: string, userId: string) => Promise<void>
    muteParticipant: (callId: string, userId: string) => Promise<void>
    removeFromGroupCall: (callId: string, userId: string) => Promise<void>
  }
  currentUserId: Ref<string>
}

interface UseCallParticipantsReturn {
  // States
  remoteParticipants: Ref<CallParticipant[]>
  suggestedUsers: Ref<Array<{ id: string; name: string; avatar?: string }>>
  showInviteDialog: Ref<boolean>
  inviteInput: Ref<string>

  // Computed
  totalParticipants: Ref<number>

  // Actions
  inviteParticipant: () => Promise<void>
  selectInviteUser: (user: { id: string; name: string; avatar?: string }) => void
  handleParticipantAction: (action: string, participant: CallParticipant) => Promise<void>
  addParticipant: (participant: CallParticipant) => void
  removeParticipant: (participant: CallParticipant) => void
  updateParticipantSpeaking: (participantId: string, isSpeaking: boolean) => void
}

/**
 * Composable for managing participants in a group call
 * Handles participant list, invitations, and actions
 */
export function useCallParticipants(options: UseCallParticipantsOptions): UseCallParticipantsReturn {
  const { callId, rtcManager } = options

  // States
  const remoteParticipants = ref<CallParticipant[]>([])
  const suggestedUsers = ref<Array<{ id: string; name: string; avatar?: string }>>([])
  const showInviteDialog = ref(false)
  const inviteInput = ref('')

  // Computed
  const totalParticipants = computed(() => 1 + remoteParticipants.value.length)

  /**
   * Invite a participant to the call
   */
  const inviteParticipant = async () => {
    if (!inviteInput.value.trim()) {
      return
    }

    try {
      await rtcManager.inviteToGroupCall(callId.value, inviteInput.value)
      logger.debug(`[useCallParticipants] Invited ${inviteInput.value}`)
      showInviteDialog.value = false
      inviteInput.value = ''
    } catch (error) {
      logger.error('[useCallParticipants] Failed to invite participant:', error)
      dlg.error({ content: '邀请失败' })
    }
  }

  /**
   * Select a user from the suggested list and invite them
   */
  const selectInviteUser = (user: { id: string; name: string; avatar?: string }) => {
    inviteInput.value = user.id
    inviteParticipant()
  }

  /**
   * Handle participant actions (mute, remove, private message)
   */
  const handleParticipantAction = async (action: string, participant: CallParticipant) => {
    switch (action) {
      case 'private-message':
        // 打开私信聊天
        logger.debug(`[useCallParticipants] Open private chat with ${participant.name}`)
        break

      case 'mute':
        try {
          await rtcManager.muteParticipant(callId.value, participant.userId)
          logger.debug(`[useCallParticipants] Muted ${participant.name}`)
        } catch (error) {
          logger.error('[useCallParticipants] Failed to mute participant:', error)
        }
        break

      case 'remove':
        dlg.warning({
          title: '移除参与者',
          content: `确定要移除 ${participant.name || '该用户'} 吗？`,
          positiveText: '移除',
          negativeText: '取消',
          onPositiveClick: async () => {
            try {
              await rtcManager.removeFromGroupCall(callId.value, participant.userId)
              logger.debug(`[useCallParticipants] Removed ${participant.name}`)
              // Remove from local list
              const index = remoteParticipants.value.findIndex((p: CallParticipant) => p.userId === participant.userId)
              if (index > -1) {
                remoteParticipants.value.splice(index, 1)
              }
            } catch (error) {
              logger.error('[useCallParticipants] Failed to remove participant:', error)
              dlg.error({ content: '移除失败' })
            }
          }
        })
        break
    }
  }

  /**
   * Add a participant to the call
   */
  const addParticipant = (participant: CallParticipant) => {
    const existingIndex = remoteParticipants.value.findIndex((p: CallParticipant) => p.userId === participant.userId)
    if (existingIndex > -1) {
      // Update existing participant
      remoteParticipants.value[existingIndex] = participant
    } else {
      // Add new participant
      remoteParticipants.value.push(participant)
    }
    logger.debug(`[useCallParticipants] Participant added/updated: ${participant.name}`)
  }

  /**
   * Remove a participant from the call
   */
  const removeParticipant = (participant: CallParticipant) => {
    const index = remoteParticipants.value.findIndex((p: CallParticipant) => p.userId === participant.userId)
    if (index > -1) {
      remoteParticipants.value.splice(index, 1)
      logger.debug(`[useCallParticipants] Participant removed: ${participant.name}`)
    }
  }

  /**
   * Update participant speaking state
   */
  const updateParticipantSpeaking = (participantId: string, isSpeaking: boolean) => {
    const participant = remoteParticipants.value.find((p) => p.userId === participantId)
    if (participant) {
      participant.isSpeaking = isSpeaking
    }
  }

  return {
    // States
    remoteParticipants,
    suggestedUsers,
    showInviteDialog,
    inviteInput,

    // Computed
    totalParticipants,

    // Actions
    inviteParticipant,
    selectInviteUser,
    handleParticipantAction,
    addParticipant,
    removeParticipant,
    updateParticipantSpeaking
  }
}
