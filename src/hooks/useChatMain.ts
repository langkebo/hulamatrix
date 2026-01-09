import { ref, nextTick, type InjectionKey } from 'vue'
import type { FilesMeta, MessageType, RightMouseMessageItem } from '@/services/types.ts'
import { useChatStore } from '@/stores/chat.ts'
import { useGlobalStore } from '@/stores/global.ts'
import { useUserStore } from '@/stores/user'
import { useWindow } from './useWindow'
import { useMitt } from '@/hooks/useMitt.ts'
import { join } from '@tauri-apps/api/path'
import type { FileTypeResult } from 'file-type'
import { MittEnum } from '@/enums'
import { detectRemoteFileType, getFilesMeta } from '@/utils/PathUtil'

// Composables
import { useGroupNicknameModal } from '@/composables/useGroupNicknameModal'
import { useTextSelection } from '@/composables/useTextSelection'
import { useChatMessageMenus } from '@/composables/useChatMessageMenus'
import { useChatMessageActions } from '@/composables/useChatMessageActions'

type UseChatMainOptions = {
  enableGroupNicknameModal?: boolean
  disableHistoryActions?: boolean
}

export const useChatMain = (isHistoryMode = false, options: UseChatMainOptions = {}) => {
  const { createWebviewWindow, sendWindowPayload, startRtcCall } = useWindow()
  const globalStore = useGlobalStore()
  const chatStore = useChatStore()
  const userStore = useUserStore()

  const enableGroupNicknameModal = options.enableGroupNicknameModal ?? false
  const disableHistoryActions = options.disableHistoryActions ?? false

  // Remaining states not extracted
  const scrollTop = ref(-1)
  const historyIndex = ref(0)
  const selectKey = ref()

  // Initialize text selection composable
  const textSelection = useTextSelection()

  // Initialize group nickname modal composable
  const groupNicknameModal = useGroupNicknameModal({ enableGroupNicknameModal })

  // Create a wrapper for handleForward to pass to menus composable
  const handleForwardWrapper = async (item: MessageType) => {
    if (!item?.message?.id) return
    const target = chatStore.chatMessageList.find((m) => m.message.id === item.message.id)
    if (!target) {
      return
    }
    chatStore.clearMsgCheck()
    target.isCheck = true
    chatStore.setMsgMultiChoose(true, 'forward')
    await nextTick()
    useMitt.emit(MittEnum.MSG_MULTI_CHOOSE, {
      action: 'open-forward',
      mergeType: 'single'
    })
  }

  // Preview file handler - for file menu preview action
  const handlePreviewFile = async (item: RightMouseMessageItem) => {
    const path = 'previewFile'
    const LABEL = 'previewFile'

    const buildPayload = (
      item: RightMouseMessageItem,
      type: FileTypeResult | undefined,
      localExists: boolean,
      filePath?: string
    ) => {
      const currentUserUid = userStore.userInfo?.uid || ''
      const currentChatRoomId = globalStore.currentSessionRoomId || ''
      const body = item.message.body as unknown as { size: string; url: string; fileName: string }
      const payload = {
        userId: currentUserUid,
        roomId: currentChatRoomId,
        messageId: item.message.id,
        resourceFile: {
          fileName: body.fileName,
          absolutePath: filePath,
          url: body.url,
          type,
          localExists
        }
      }
      return payload
    }

    const fallbackToRemotePayload = async () => {
      const body = item.message.body as unknown as { size: string; url: string; fileName: string }
      const remoteType = await detectRemoteFileType({
        url: body.url || '',
        fileSize: Number(body.size || 0)
      })
      const fallbackPayload = buildPayload(item, remoteType, false)
      await sendWindowPayload(LABEL, fallbackPayload)
    }

    const resourceDirPath = await userStore.getUserRoomAbsoluteDir()
    const body = item.message.body as unknown as { size: string; url: string; fileName: string }
    const fileName = body?.fileName
    if (!fileName) return
    const absolutePath = await join(resourceDirPath, fileName)

    const result = await getFilesMeta<FilesMeta>([absolutePath || body?.url || ''])
    const fileMeta = result[0]

    try {
      if (!fileMeta?.exists) {
        await fallbackToRemotePayload()
      } else {
        const payload = buildPayload(
          item,
          {
            ext: fileMeta.file_type,
            mime: fileMeta.mime_type
          },
          fileMeta.exists,
          absolutePath
        )

        await sendWindowPayload(LABEL, payload)
      }
    } catch (_error) {
      await fallbackToRemotePayload()
    }

    await createWebviewWindow('预览文件', path, 860, 720, '', true)
  }

  // Initialize message menus composable
  const messageMenus = useChatMessageMenus({
    isHistoryMode,
    disableHistoryActions,
    handleForward: handleForwardWrapper,
    handleCopy: textSelection.handleCopy,
    startRtcCall,
    handlePreviewFile
  })

  // Initialize message actions composable
  const messageActions = useChatMessageActions({
    handleCopy: textSelection.handleCopy
  })

  return {
    // States
    scrollTop,
    historyIndex,
    selectKey,
    activeBubble: messageActions.activeBubble,
    tips: messageActions.tips,
    modalShow: messageActions.modalShow,
    delIndex: messageActions.delIndex,
    delRoomId: messageActions.delRoomId,

    // Group nickname modal
    groupNicknameModalVisible: groupNicknameModal.groupNicknameModalVisible,
    groupNicknameValue: groupNicknameModal.groupNicknameValue,
    groupNicknameError: groupNicknameModal.groupNicknameError,
    groupNicknameSubmitting: groupNicknameModal.groupNicknameSubmitting,
    handleGroupNicknameConfirm: groupNicknameModal.handleGroupNicknameConfirm,

    // Message menus
    menuList: messageMenus.menuList,
    videoMenuList: messageMenus.videoMenuList,
    fileMenuList: messageMenus.fileMenuList,
    imageMenuList: messageMenus.imageMenuList,
    optionsList: messageMenus.optionsList,
    report: messageMenus.report,
    emojiList: messageMenus.emojiList,
    specialMenuList: messageMenus.specialMenuList,
    handleItemType: messageMenus.handleItemType,

    // Message actions
    handleMsgClick: messageActions.handleMsgClick,
    handleConfirm: messageActions.handleConfirm,
    handlePreviewFile,

    // Text selection
    getSelectedText: textSelection.getSelectedText,
    hasSelectedText: textSelection.hasSelectedText,
    clearSelection: textSelection.clearSelection,
    handleCopy: textSelection.handleCopy
  }
}

export type UseChatMainContext = ReturnType<typeof useChatMain>
export const chatMainInjectionKey = Symbol('chatMainInjectionKey') as InjectionKey<UseChatMainContext>

declare global {
  interface Window {
    $message?: {
      info: (msg: string) => { destroy: () => void }
      success: (msg: string) => void
      warning: (msg: string) => void
      error: (msg: string) => void
    }
  }
}
