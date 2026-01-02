/**
 * Chat Main - Group Nickname Module
 *
 * Handles group nickname modification modal and logic
 */

import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMitt } from '@/hooks/useMitt'
import { MittEnum } from '@/enums'
import { useCachedStore } from '@/stores/dataCache'
import { useRoomStore } from '@/stores/room'
import { useCommon } from '@/hooks/useCommon'
import { updateMyRoomInfo } from '@/utils/ImRequestUtils'
import { msg } from '@/utils/SafeUI'

export type GroupNicknameModalPayload = {
  roomId: string
  currentUid: string
  originalNickname: string
}

export interface UseChatGroupNicknameState {
  groupNicknameModalVisible: boolean
  groupNicknameValue: string
  groupNicknameError: string
  groupNicknameSubmitting: boolean
}

export interface UseChatGroupNicknameActions {
  handleGroupNicknameConfirm: () => void
}

export interface UseChatGroupNicknameOptions {
  enableGroupNicknameModal?: boolean
}

/**
 * Group nickname management composable
 */
export function useChatGroupNickname(options: UseChatGroupNicknameOptions = {}) {
  const { t } = useI18n()
  const { userUid } = useCommon()
  const cachedStore = useCachedStore()
  const roomStore = useRoomStore()

  const enableGroupNicknameModal = options.enableGroupNicknameModal ?? false

  // State
  const groupNicknameModalVisible = ref(false)
  const groupNicknameValue = ref('')
  const groupNicknameError = ref('')
  const groupNicknameSubmitting = ref(false)
  const groupNicknameContext = ref<GroupNicknameModalPayload | null>(null)

  /**
   * Handle group nickname confirmation
   */
  const handleGroupNicknameConfirm = async () => {
    if (!groupNicknameContext.value) {
      return
    }

    const trimmedName = groupNicknameValue.value.trim()
    if (!trimmedName) {
      groupNicknameError.value = t('home.chat_main.group_nickname.errors.empty')
      return
    }

    if (trimmedName === groupNicknameContext.value.originalNickname) {
      groupNicknameModalVisible.value = false
      return
    }

    const { roomId, currentUid } = groupNicknameContext.value
    if (!roomId) {
      msg.error(t('home.chat_main.group_nickname.errors.room_error'))
      return
    }

    try {
      groupNicknameSubmitting.value = true
      const remark = ''
      const payload = {
        id: roomId,
        myName: trimmedName,
        remark
      }
      await cachedStore.updateMyRoomInfo(payload)
      await updateMyRoomInfo(payload)
      roomStore.updateMember(roomId, currentUid, { displayName: trimmedName })

      if (currentUid === userUid.value) {
        // Update local state if needed
      }
      groupNicknameSubmitting.value = false
      groupNicknameModalVisible.value = false
    } catch (_error) {
      msg.error(t('home.chat_main.group_nickname.errors.update_fail'))
      groupNicknameSubmitting.value = false
    }
  }

  // Set up event listener for opening the modal
  if (enableGroupNicknameModal) {
    useMitt.on(MittEnum.OPEN_GROUP_NICKNAME_MODAL, (payload: GroupNicknameModalPayload) => {
      groupNicknameContext.value = payload
      groupNicknameValue.value = payload.originalNickname || ''
      groupNicknameError.value = ''
      groupNicknameSubmitting.value = false
      groupNicknameModalVisible.value = true
    })
  }

  return {
    // State
    groupNicknameModalVisible,
    groupNicknameValue,
    groupNicknameError,
    groupNicknameSubmitting,
    groupNicknameContext,

    // Actions
    handleGroupNicknameConfirm
  }
}
