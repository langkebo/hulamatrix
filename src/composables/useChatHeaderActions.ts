import { computed, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMitt } from '@/hooks/useMitt'
import { MittEnum, RoomTypeEnum, CallTypeEnum } from '@/enums'
import { useGlobalStore } from '@/stores/global'
import { msg } from '@/utils/SafeUI'
import { useWindow } from '@/hooks/useWindow'
import type { SessionItem } from '@/services/types'

export interface UseChatHeaderActionsOptions {
  currentSession: Ref<SessionItem | null>
}

export interface UseChatHeaderActionsReturn {
  // Computed
  isChannel: Ref<boolean>

  // Actions
  startRtcCall: (type: CallTypeEnum) => void
  handleMedia: () => void
  handleAssist: () => void
  handleCreateGroupOrInvite: () => Promise<void>
}

/**
 * Composable for chat header toolbar actions
 * Handles RTC calls, screen sharing, remote assistance, and group invites
 */
export function useChatHeaderActions(options: UseChatHeaderActionsOptions): UseChatHeaderActionsReturn {
  const { currentSession } = options
  const { t } = useI18n()
  const { createModalWindow, startRtcCall: rtcCall } = useWindow()
  const _globalStore = useGlobalStore()

  // Computed
  const isChannel = computed(() => currentSession.value?.hotFlag === 1 || currentSession.value?.roomId === '1')

  // Actions
  const startRtcCall = (type: CallTypeEnum) => {
    const session = currentSession.value
    if (!session) return

    rtcCall(type)
  }

  const handleMedia = () => {
    msg.warning(t('home.chat_header.toast.todo'))
  }

  const handleAssist = () => {
    msg.warning(t('home.chat_header.toast.todo'))
  }

  const handleCreateGroupOrInvite = async () => {
    const session = currentSession.value
    if (!session) return

    if (session.type === RoomTypeEnum.GROUP) {
      await handleInvite()
    } else {
      handleCreateGroup()
    }
  }

  const handleCreateGroup = () => {
    const session = currentSession.value
    if (!session) return

    useMitt.emit(MittEnum.CREATE_GROUP, { id: session.detailId })
  }

  const handleInvite = async () => {
    const session = currentSession.value
    if (!session) return

    await createModalWindow(t('home.chat_header.modal.invite_friends'), 'modal-invite', 600, 500, 'home', {
      roomId: session.roomId,
      type: session.type
    })
  }

  return {
    isChannel,
    startRtcCall,
    handleMedia,
    handleAssist,
    handleCreateGroupOrInvite
  }
}
