import { nextTick, ref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ErrorType } from '@/common/exception'
import { invokeWithErrorHandler } from '@/utils/TauriInvokeHandler'
import { TauriCommand, MittEnum, NotificationTypeEnum, RoomActEnum } from '@/enums'
import { useChatStore } from '@/stores/chat'
import { useGlobalStore } from '@/stores/global'
import { useMitt } from '@/hooks/useMitt'
import { msg } from '@/utils/SafeUI'
import { sessionSettingsService } from '@/services/sessionSettingsService'
import { logger } from '@/utils/logger'

export interface UseChatHeaderSessionSettingsOptions {
  currentSession: Ref<{ roomId: string; shield?: boolean; muteNotification?: NotificationTypeEnum } | null>
}

export interface UseChatHeaderSessionSettingsReturn {
  // State
  tips: Ref<string | undefined>
  optionsType: Ref<RoomActEnum | undefined>
  modalShow: Ref<boolean>

  // Actions
  handleTop: (value: boolean) => Promise<void>
  handleNotification: (value: boolean) => Promise<void>
  handleShield: (value: boolean) => Promise<void>
  handleMessageSetting: (value: string) => Promise<void>
  handleDelete: (label: RoomActEnum) => void
  handleConfirm: () => Promise<void>
  handleCancel: () => void
  deleteRoomMessages: (roomId: string) => Promise<void>
}

/**
 * Composable for chat header session settings
 * Handles top/pin, mute notifications, shield messages, and delete actions
 */
export function useChatHeaderSessionSettings(
  options: UseChatHeaderSessionSettingsOptions
): UseChatHeaderSessionSettingsReturn {
  const { t } = useI18n()
  const { currentSession } = options
  const chatStore = useChatStore()
  const globalStore = useGlobalStore()

  // State
  const tips = ref<string | undefined>()
  const optionsType = ref<RoomActEnum | undefined>()
  const modalShow = ref(false)

  // Actions
  const handleTop = async (value: boolean) => {
    const session = currentSession.value
    if (!session) return

    try {
      await sessionSettingsService.setSessionTop(session.roomId, value)
      chatStore.updateSession(session.roomId, { top: value })
      msg.success(value ? t('home.chat_header.toast.pin_on') : t('home.chat_header.toast.pin_off'))
    } catch (_e) {
      msg.error(t('home.chat_header.toast.pin_failed'))
    }
  }

  const handleNotification = async (value: boolean) => {
    const session = currentSession.value
    if (!session) return

    const newMode = value ? 'not_disturb' : 'reception'

    // If currently shielded, need to unshield first
    if (session.shield) {
      await handleShield(false)
    }

    try {
      await sessionSettingsService.setNotificationMode(session.roomId, newMode)
      const newType = value ? NotificationTypeEnum.NOT_DISTURB : NotificationTypeEnum.RECEPTION
      chatStore.updateSession(session.roomId, {
        muteNotification: newType
      })

      // Recalculate total unread count when switching modes
      if (session.muteNotification === NotificationTypeEnum.NOT_DISTURB && newType === NotificationTypeEnum.RECEPTION) {
        chatStore.updateTotalUnreadCount()
      }

      if (newType === NotificationTypeEnum.NOT_DISTURB) {
        chatStore.updateTotalUnreadCount()
      }

      msg.success(value ? t('home.chat_header.toast.mute_on') : t('home.chat_header.toast.mute_off'))
    } catch (_error) {
      msg.error(t('home.chat_header.toast.action_failed'))
    }
  }

  const handleShield = async (value: boolean) => {
    const session = currentSession.value
    if (!session) return

    try {
      await sessionSettingsService.setSessionShield(session.roomId, value)
      chatStore.updateSession(session.roomId, {
        shield: value
      })

      // Save and restore current room ID to trigger message reload
      const tempRoomId = globalStore.currentSessionRoomId
      nextTick(() => {
        globalStore.updateCurrentSessionRoomId(tempRoomId)
      })

      msg.success(value ? t('home.chat_header.toast.shield_on') : t('home.chat_header.toast.shield_off'))
    } catch (_error) {
      msg.error(t('home.chat_header.toast.action_failed'))
    }
  }

  const handleMessageSetting = async (value: string) => {
    const session = currentSession.value
    if (!session) return

    if (value === 'shield') {
      if (!session.shield) {
        await handleShield(true)
      }
    } else if (value === 'notification') {
      if (session.shield) {
        await handleShield(false)
      }
    }
  }

  const handleDelete = (label: RoomActEnum) => {
    modalShow.value = true
    optionsType.value = label

    if (label === RoomActEnum.DELETE_FRIEND) {
      tips.value = t('home.chat_header.modal.tips.delete_friend')
    } else if (label === RoomActEnum.DISSOLUTION_GROUP) {
      tips.value = t('home.chat_header.modal.tips.dissolve_group')
    } else if (label === RoomActEnum.EXIT_GROUP) {
      tips.value = t('home.chat_header.modal.tips.exit_group')
    } else if (label === RoomActEnum.UPDATE_GROUP_NAME) {
      tips.value = t('home.chat_header.modal.tips.rename_group', { name: '' })
    } else if (label === RoomActEnum.UPDATE_GROUP_INFO) {
      tips.value = t('home.chat_header.modal.tips.update_info')
    } else {
      tips.value = t('home.chat_header.modal.tips.delete_history')
      optionsType.value = RoomActEnum.DELETE_RECORD
    }
  }

  const deleteRoomMessages = async (roomId: string) => {
    if (!roomId) return

    try {
      await invokeWithErrorHandler(
        TauriCommand.DELETE_ROOM_MESSAGES,
        { roomId },
        {
          customErrorMessage: t('home.chat_header.toast.delete_history_failed'),
          errorType: ErrorType.Client
        }
      )
      chatStore.clearRoomMessages(roomId)
      useMitt.emit(MittEnum.UPDATE_SESSION_LAST_MSG, { roomId })
      msg.success(t('home.chat_header.toast.delete_history_success'))
      modalShow.value = false
    } catch (error) {
      logger.error('删除聊天记录失败:', error instanceof Error ? error : new Error(String(error)))
    }
  }

  const handleConfirm = async () => {
    const currentOption = optionsType.value
    const targetRoomId = currentSession.value?.roomId

    if (currentOption === undefined || currentOption === null || !targetRoomId) return

    if (currentOption === RoomActEnum.DELETE_RECORD) {
      await deleteRoomMessages(targetRoomId)
    }

    // Note: Other cases (DELETE_FRIEND, DISSOLUTION_GROUP, EXIT_GROUP, UPDATE_GROUP_NAME, UPDATE_GROUP_INFO)
    // are handled in the component's own handler as they require more context
  }

  const handleCancel = () => {
    modalShow.value = false
    tips.value = undefined
    optionsType.value = undefined
  }

  return {
    tips,
    optionsType,
    modalShow,
    handleTop,
    handleNotification,
    handleShield,
    handleMessageSetting,
    handleDelete,
    handleConfirm,
    handleCancel,
    deleteRoomMessages
  }
}
