import { ref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMitt } from '@/hooks/useMitt.ts'
import { MittEnum } from '@/enums'
import { msg } from '@/utils/SafeUI'
import { useCachedStore } from '@/stores/dataCache'
import { useRoomStore } from '@/stores/room'
import { sessionSettingsService } from '@/services/sessionSettingsService'

export interface GroupNicknameModalPayload {
  roomId: string
  currentUid: string
  originalNickname: string
}

interface UseGroupNicknameModalOptions {
  enableGroupNicknameModal?: boolean
}

interface UseGroupNicknameModalReturn {
  // States
  groupNicknameModalVisible: Ref<boolean>
  groupNicknameValue: Ref<string>
  groupNicknameError: Ref<string>
  groupNicknameSubmitting: Ref<boolean>

  // Actions
  handleGroupNicknameConfirm: () => Promise<void>
}

/**
 * Composable for managing group nickname modification modal
 * Handles UI state and Matrix SDK integration for room nicknames
 */
export function useGroupNicknameModal(options: UseGroupNicknameModalOptions = {}): UseGroupNicknameModalReturn {
  const { t } = useI18n()
  const cachedStore = useCachedStore()
  const roomStore = useRoomStore()
  const { enableGroupNicknameModal = false } = options

  // States
  const groupNicknameModalVisible = ref(false)
  const groupNicknameValue = ref('')
  const groupNicknameError = ref('')
  const groupNicknameSubmitting = ref(false)
  const groupNicknameContext = ref<GroupNicknameModalPayload | null>(null)

  /**
   * Handle group nickname confirmation
   * Validates input and updates room nickname via Matrix SDK
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
      // Use Matrix SDK to set room nickname
      await sessionSettingsService.setRoomNickname(roomId, trimmedName)

      // Update local cached room info
      const remark = ''
      const payload = {
        id: roomId,
        myName: trimmedName,
        remark
      }
      await cachedStore.updateMyRoomInfo(payload)
      roomStore.updateMember(roomId, currentUid, { displayName: trimmedName })

      groupNicknameSubmitting.value = false
      groupNicknameModalVisible.value = false
      msg.success(t('home.chat_main.group_nickname.success'))
    } catch (_error) {
      msg.error(t('home.chat_main.group_nickname.errors.update_fail'))
      groupNicknameSubmitting.value = false
    }
  }

  // Listen for open modal events if enabled
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
    // States
    groupNicknameModalVisible,
    groupNicknameValue,
    groupNicknameError,
    groupNicknameSubmitting,

    // Actions
    handleGroupNicknameConfirm
  }
}
