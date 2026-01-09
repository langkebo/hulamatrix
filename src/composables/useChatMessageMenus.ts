import { ref, computed, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RightMenu } from '@/typings/components'
import type { MessageType, RightMouseMessageItem, FilesMeta } from '@/services/types.ts'
import { MittEnum, MsgEnum, CallTypeEnum, RoleEnum, RoomTypeEnum } from '@/enums'
import { BaseDirectory } from '@tauri-apps/plugin-fs'
import { save } from '@tauri-apps/plugin-dialog'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import { appDataDir, join, resourceDir } from '@tauri-apps/api/path'
import { msg } from '@/utils/SafeUI'
import { logger } from '@/utils/logger'
import { isDiffNow } from '@/utils/ComputedTime.ts'
import { extractFileName } from '@/utils/formatUtils'
import { isMobile, isMac } from '@/utils/PlatformConstants'
import { useCommon } from '@/hooks/useCommon.ts'
import { useDownload } from '@/hooks/useDownload'
import { useVideoViewer } from '@/hooks/useVideoViewer'
import { useMitt } from '@/hooks/useMitt.ts'
import { useWindow } from '@/hooks/useWindow'
import { useChatStore } from '@/stores/chat.ts'
import { useEmojiStore } from '@/stores/emoji'
import { useGlobalStore } from '@/stores/global.ts'
import { useRoomStore } from '@/stores/room'
import { useSettingStore } from '@/stores/setting.ts'
import { useUserStore } from '@/stores/user'
import { translateText } from '@/services/translate'
import type { TranslateProvider } from '@/services/types'
import { saveFileAttachmentAs, saveVideoAttachmentAs } from '@/utils/AttachmentSaver'
import { matrixClientService } from '@/integrations/matrix/client'
import { getFilesMeta } from '@/utils/PathUtil'

// Type definitions for message bodies
interface UrlMessageBody {
  url: string
  [key: string]: unknown
}

interface FileMessageBody extends UrlMessageBody {
  fileName: string
  size?: string
}

interface TextMessageBody {
  content: string
  translatedText?: { provider: string; text: string }
}

interface TextBody {
  content: string
  [key: string]: unknown
}

interface VideoCallMessageBody {
  [key: string]: unknown
}

interface AudioCallMessageBody {
  [key: string]: unknown
}

type MessageBody =
  | UrlMessageBody
  | FileMessageBody
  | TextMessageBody
  | TextBody
  | VideoCallMessageBody
  | AudioCallMessageBody

interface RightMouseMessageItemLike {
  message: {
    id: string
    body?: MessageBody
    [key: string]: unknown
  }
  uid?: string
  fromUser?: {
    uid: string
    [key: string]: unknown
  }
  roleId?: number
  [key: string]: unknown
}

type UseChatMessageMenusOptions = {
  isHistoryMode?: boolean
  disableHistoryActions?: boolean
  handleForward: (item: MessageType) => Promise<void>
  handleCopy: (content: string, prioritizeSelection?: boolean, messageId?: string) => Promise<void>
  startRtcCall: (type: CallTypeEnum) => void
  handlePreviewFile?: (item: RightMouseMessageItem) => Promise<void>
}

type UseChatMessageMenusReturn = {
  // Menu lists
  menuList: Ref<RightMenu[]>
  videoMenuList: Ref<RightMenu[]>
  fileMenuList: Ref<RightMenu[]>
  imageMenuList: Ref<RightMenu[]>
  optionsList: Ref<RightMenu[]>
  report: Ref<RightMenu[]>
  emojiList: Ref<{ url: string; value: number; title: string }[]>

  // Computed menus
  specialMenuList: Ref<(messageType?: MsgEnum) => RightMenu[]>

  // Utilities
  handleItemType: (type: MsgEnum) => RightMenu[]
  checkFriendRelation: (uid: string, type?: 'friend' | 'all') => boolean
}

/**
 * Composable for managing chat message right-click menus
 * Handles context menus for different message types and user actions
 */
export function useChatMessageMenus(options: UseChatMessageMenusOptions): UseChatMessageMenusReturn {
  const { t } = useI18n()
  const { openMsgSession, userUid } = useCommon()
  const { createWebviewWindow } = useWindow()
  const { getLocalVideoPath, checkVideoDownloaded } = useVideoViewer()
  const { downloadFile } = useDownload()
  const { isHistoryMode = false, disableHistoryActions = false, handleForward, handleCopy, handlePreviewFile } = options

  const settingStore = useSettingStore()
  const { chat } = settingStore
  const globalStore = useGlobalStore()
  const roomStore = useRoomStore()
  const chatStore = useChatStore()
  const emojiStore = useEmojiStore()
  const userStore = useUserStore()

  // Copy disabled types
  const copyDisabledTypes: MsgEnum[] = [MsgEnum.NOTICE, MsgEnum.MERGE, MsgEnum.LOCATION, MsgEnum.VOICE]
  const shouldHideCopy = (item: MessageType) => copyDisabledTypes.includes(item.message.type)
  const isNoticeMessage = (item: MessageType) => item.message.type === MsgEnum.NOTICE

  const revealInDirSafely = async (targetPath?: string | null) => {
    if (!targetPath) {
      msg.error('暂时找不到本地文件，请先下载后再试~')
      return
    }
    try {
      await revealItemInDir(targetPath)
    } catch (_error) {
      msg.error('无法在文件夹中显示该文件')
    }
  }

  /** Common menu items shared across all message types */
  const commonMenuList = ref<RightMenu[]>([
    {
      label: () => t('menu.select'),
      icon: 'list-checkbox',
      action: () => {
        chatStore.setMsgMultiChoose(true)
      },
      visible: (item: MessageType) => !isNoticeMessage(item)
    },
    {
      label: () => t('menu.add_sticker'),
      icon: 'add-expression',
      action: async (item: MessageType) => {
        const imageUrl = item.message.body?.url || (item.message.body as TextBody)?.content
        if (!imageUrl) {
          msg.error('获取图片地址失败')
          return
        }
        await emojiStore.addEmoji(imageUrl)
      },
      visible: (item: MessageType) => {
        return item.message.type === MsgEnum.IMAGE || item.message.type === MsgEnum.EMOJI
      }
    },
    {
      label: () => t('menu.forward'),
      icon: 'share',
      action: (item: MessageType) => {
        // Mobile: trigger forward event, handled by mobile UI
        if (isMobile()) {
          useMitt.emit(MittEnum.FORWARD_MESSAGE, item)
        } else {
          handleForward(item)
        }
      },
      visible: (item: MessageType) => !isNoticeMessage(item)
    },
    {
      label: () => t('menu.reply'),
      icon: 'reply',
      action: (item: MessageType) => {
        useMitt.emit(MittEnum.REPLY_MEG, item)
      }
    },
    {
      label: () => t('menu.recall'),
      icon: 'corner-down-left',
      action: async (item: MessageType) => {
        const msg = { ...item }
        // Use Matrix SDK's redaction feature
        const client = matrixClientService.getClient()
        if (!client) return

        try {
          const redactEvent = client.redactEvent as
            | ((roomId: string, eventId: string, reason?: string) => Promise<unknown>)
            | undefined

          if (redactEvent) {
            await redactEvent(globalStore.currentSessionRoomId, item.message.id)
            chatStore.recordRecallMsg({
              recallUid: userStore.userInfo!.uid,
              msg
            })
            await chatStore.updateRecallMsg({
              recallUid: userStore.userInfo!.uid,
              roomId: msg.message.roomId,
              msgId: msg.message.id
            })
          }
        } catch (error) {
          logger.error('Failed to recall message:', error)
        }
      },
      visible: (item: MessageType) => {
        const isSystemAdmin = userStore.userInfo?.power === 50
        if (isSystemAdmin) {
          return true
        }

        const isGroupSession = globalStore.currentSession?.type === RoomTypeEnum.GROUP
        const currentMember = isGroupSession
          ? roomStore.getMember(globalStore.currentSessionRoomId, userUid.value)
          : undefined
        const isGroupManager = isGroupSession && (currentMember?.role === 'owner' || currentMember?.role === 'admin')

        if (isGroupManager) {
          return true
        }

        const isCurrentUser = item.fromUser.uid === userUid.value
        if (!isCurrentUser) {
          return false
        }

        return !isDiffNow({ time: item.message.sendTime, unit: 'minute', diff: 2 })
      }
    }
  ])

  /** Video message menu */
  const videoMenuList = ref<RightMenu[]>([
    {
      label: () => t('menu.copy'),
      icon: 'copy',
      action: (item: MessageType) => {
        const url = (item.message.body as UrlMessageBody)?.url || ''
        handleCopy(url, true, item.message.id)
      }
    },
    ...commonMenuList.value,
    {
      label: () => t('menu.save_as'),
      icon: 'Importing',
      action: async (item: MessageType) => {
        const fileBody = item.message.body as FileMessageBody
        // Mobile: trigger download event or use Tauri download API
        if (isMobile()) {
          useMitt.emit(MittEnum.SAVE_MEDIA, {
            url: fileBody.url || '',
            fileName: fileBody.fileName || '',
            type: 'video'
          })
        } else {
          await saveVideoAttachmentAs({
            url: fileBody.url || '',
            downloadFile,
            defaultFileName: fileBody.fileName || ''
          })
        }
      }
    },
    {
      label: () => (isMac() ? t('menu.show_in_finder') : t('menu.show_in_folder')),
      icon: 'file2',
      action: async (item: MessageType) => {
        try {
          const url = (item.message.body as UrlMessageBody)?.url || ''
          const localPath = await getLocalVideoPath(url)

          // Check if video is downloaded
          const isDownloaded = await checkVideoDownloaded(url)

          if (!isDownloaded) {
            // If not downloaded, download first
            const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.Resource
            await downloadFile(url, localPath, baseDir)
            // Notify related components to update video download status
            useMitt.emit(MittEnum.VIDEO_DOWNLOAD_STATUS_UPDATED, {
              url,
              downloaded: true
            })
          }

          // Get absolute path of video
          const baseDirPath = isMobile() ? await appDataDir() : await resourceDir()
          const absolutePath = await join(baseDirPath, localPath)
          await revealInDirSafely(absolutePath)
        } catch (_error) {}
      }
    }
  ])

  /** Default text message menu */
  const menuList = ref<RightMenu[]>([
    {
      label: () => t('menu.copy'),
      icon: 'copy',
      action: (item: MessageType) => {
        const textBody = item.message.body as TextBody
        handleCopy(textBody?.content || '', true, item.message.id)
      },
      visible: (item: MessageType) => !shouldHideCopy(item)
    },
    {
      label: () => t('menu.translate'),
      icon: 'translate',
      action: async (rawItem: MessageType) => {
        const selectedText = '' // Use textSelection composable if needed
        const textBody = rawItem.message.body as TextMessageBody

        if (!selectedText && textBody?.translatedText) {
          delete textBody.translatedText
          return
        }

        const content = selectedText || String(textBody?.content || '')
        if (!content) {
          msg.warning('没有可翻译的内容')
          return
        }
        try {
          const translateProvider = (chat.translate || 'youdao') as TranslateProvider
          const result = await translateText(content, translateProvider)
          const provider = result?.provider || ''
          const text = result?.text || ''
          if (textBody) {
            textBody.translatedText = { provider, text }
          }
        } catch {}
      },
      visible: (rawItem: MessageType) => {
        return rawItem.message.type === MsgEnum.TEXT
      }
    },
    ...commonMenuList.value
  ])

  /** Special menu list (computed based on mode and message type) */
  const specialMenuList = computed(() => {
    return (messageType?: MsgEnum): RightMenu[] => {
      if (isHistoryMode) {
        // History mode: basic menu (copy, forward)
        const baseMenus: RightMenu[] = [
          {
            label: () => t('menu.copy'),
            icon: 'copy',
            action: (item: MessageType) => {
              const urlBody = item.message.body as UrlMessageBody
              const textBody = item.message.body as TextBody
              const content = urlBody?.url || textBody?.content || ''
              handleCopy(content, true, item.message.id)
            }
          }
        ]

        if (!disableHistoryActions) {
          baseMenus.push(
            {
              label: () => t('menu.select'),
              icon: 'list-checkbox',
              action: () => {
                chatStore.setMsgMultiChoose(true)
              }
            },
            {
              label: () => t('menu.forward'),
              icon: 'share',
              action: (item: MessageType) => {
                handleForward(item)
              }
            }
          )
        }

        // Additional menu for media files (save as, show in folder)
        if (
          messageType === MsgEnum.IMAGE ||
          messageType === MsgEnum.EMOJI ||
          messageType === MsgEnum.VIDEO ||
          messageType === MsgEnum.FILE
        ) {
          const mediaMenus: RightMenu[] = [
            {
              label: () => t('menu.save_as'),
              icon: 'Importing',
              action: async (item: MessageType) => {
                const fileBody = item.message.body as FileMessageBody
                const fileUrl = fileBody.url || ''
                const fileName = fileBody.fileName || ''
                // Mobile: trigger download event
                if (isMobile()) {
                  useMitt.emit(MittEnum.SAVE_MEDIA, {
                    url: fileUrl,
                    fileName,
                    type: item.message.type === MsgEnum.VIDEO ? 'video' : 'file'
                  })
                  return
                }
                if (item.message.type === MsgEnum.VIDEO) {
                  await saveVideoAttachmentAs({
                    url: fileUrl,
                    downloadFile,
                    defaultFileName: fileName
                  })
                } else {
                  await saveFileAttachmentAs({
                    url: fileUrl,
                    downloadFile,
                    defaultFileName: fileName
                  })
                }
              }
            },
            {
              label: () => (isMac() ? t('menu.show_in_finder') : t('menu.show_in_folder')),
              icon: 'file2',
              action: async (item: RightMouseMessageItem) => {
                const fileUrl = (item.message.body as unknown as { url: string; fileName: string })?.url || ''
                const fileName =
                  (item.message.body as unknown as { url: string; fileName: string })?.fileName ||
                  extractFileName(fileUrl)

                const resourceDirPath = await userStore.getUserRoomAbsoluteDir()
                let absolutePath = await join(resourceDirPath, fileName)

                const [fileMeta] = await getFilesMeta<FilesMeta>([absolutePath || fileUrl])

                // If file doesn't exist locally, download it
                if (!fileMeta?.exists) {
                  const downloadMessage = msg.info('文件没下载哦~ 请下载文件后再打开🚀...')
                  await downloadFile(fileUrl, absolutePath, BaseDirectory.AppData)
                  const _absolutePath = absolutePath

                  if (_absolutePath) {
                    absolutePath = _absolutePath
                    downloadMessage?.destroy?.()
                    msg.success('文件下载好啦！请查看~')
                    await revealInDirSafely(_absolutePath)

                    return
                  } else {
                    absolutePath = ''
                    msg.error('文件下载失败，请重试~')
                    return
                  }
                }

                await revealInDirSafely(absolutePath)
              }
            }
          ]
          return [...baseMenus, ...mediaMenus]
        }

        return baseMenus
      } else {
        // Normal chat mode: only show delete
        return [
          {
            label: () => t('menu.del'),
            icon: 'delete',
            action: (_item: MessageType) => {
              // This will be handled by useChatMessageActions
              // Emit a generic event that the parent can handle
            }
          }
        ]
      }
    }
  })

  /** File message menu */
  const fileMenuList = ref<RightMenu[]>([
    {
      label: () => t('menu.preview'),
      icon: 'preview-open',
      action: async (item: RightMouseMessageItem) => {
        if (handlePreviewFile) {
          await handlePreviewFile(item)
        }
      }
    },
    ...commonMenuList.value,
    {
      label: () => t('menu.save_as'),
      icon: 'Importing',
      action: async (item: RightMouseMessageItem) => {
        const fileBody = item.message.body as FileMessageBody
        // Mobile: trigger download event
        if (isMobile()) {
          useMitt.emit(MittEnum.SAVE_MEDIA, {
            url: fileBody.url || '',
            fileName: fileBody.fileName || '',
            type: 'file'
          })
          return
        }
        await saveFileAttachmentAs({
          url: fileBody.url || '',
          downloadFile,
          defaultFileName: fileBody.fileName || ''
        })
      }
    },
    {
      label: () => (isMac() ? t('menu.show_in_finder') : t('menu.show_in_folder')),
      icon: 'file2',
      action: async (item: RightMouseMessageItem) => {
        const fileUrl = (item.message.body as unknown as { url: string; fileName: string })?.url || ''
        const fileName =
          (item.message.body as unknown as { url: string; fileName: string })?.fileName || extractFileName(fileUrl)

        const resourceDirPath = await userStore.getUserRoomAbsoluteDir()
        let absolutePath = await join(resourceDirPath, fileName)

        const [fileMeta] = await getFilesMeta<FilesMeta>([absolutePath || fileUrl])

        // If file doesn't exist locally, download it
        if (!fileMeta?.exists) {
          const downloadMessage = msg.info('文件没下载哦, 请下载文件后再打开')
          await downloadFile(fileUrl, absolutePath, BaseDirectory.AppData)
          const _absolutePath = absolutePath

          if (_absolutePath) {
            absolutePath = _absolutePath
            downloadMessage?.destroy?.()
            msg.success('文件已保存到本地')
            await revealInDirSafely(_absolutePath)

            return
          } else {
            absolutePath = ''
            msg.error('文件下载失败，请重试')
            return
          }
        }

        await revealInDirSafely(absolutePath)
      }
    }
  ])

  /** Image message menu */
  const imageMenuList = ref<RightMenu[]>([
    {
      label: () => t('menu.copy'),
      icon: 'copy',
      action: async (item: MessageType) => {
        // For image messages, prioritize url field, fallback to content field
        const urlBody = item.message.body as UrlMessageBody
        const textBody = item.message.body as TextBody
        const imageUrl = urlBody?.url || textBody?.content || ''
        await handleCopy(imageUrl, true, item.message.id)
      }
    },
    ...commonMenuList.value,
    {
      label: () => t('menu.save_as'),
      icon: 'Importing',
      action: async (item: MessageType) => {
        // Mobile: trigger download event
        if (isMobile()) {
          const urlBody = item.message.body as UrlMessageBody
          const imageUrl = urlBody?.url || ''
          useMitt.emit(MittEnum.SAVE_MEDIA, {
            url: imageUrl,
            fileName: imageUrl.split('/').pop() || 'image.png',
            type: 'image'
          })
          return
        }
        try {
          const urlBody = item.message.body as UrlMessageBody
          const imageUrl = urlBody?.url || ''
          const suggestedName = imageUrl || 'image.png'

          // Save dialog
          const savePath = await save({
            filters: [
              {
                name: '图片',
                extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp']
              }
            ],
            defaultPath: suggestedName
          })

          if (savePath) {
            await downloadFile(imageUrl, savePath)
          }
        } catch (_error) {
          msg.error('保存图片失败')
        }
      }
    },
    {
      label: () => (isMac() ? t('menu.show_in_finder') : t('menu.show_in_folder')),
      icon: 'file2',
      action: async (item: MessageType) => {
        const urlBody = item.message.body as UrlMessageBody
        const textBody = item.message.body as TextBody
        const fileUrl = urlBody?.url || textBody?.content || ''
        const fileName = (item.message.body as unknown as { fileName: string })?.fileName || extractFileName(fileUrl)
        if (!fileUrl || !fileName) {
          msg.warning('暂时无法定位该图片~')
          return
        }

        const resourceDirPath = await userStore.getUserRoomAbsoluteDir()
        let absolutePath = await join(resourceDirPath, fileName)

        const [fileMeta] = await getFilesMeta<FilesMeta>([absolutePath || fileUrl])

        if (!fileMeta?.exists) {
          const downloadMessage = msg.info('图片没下载, 正在保存到本地...')
          await downloadFile(fileUrl, absolutePath, BaseDirectory.AppData)
          const _absolutePath = absolutePath

          if (_absolutePath) {
            absolutePath = _absolutePath
            downloadMessage?.destroy?.()
            msg.success('图片已保存到本地')
            await revealInDirSafely(_absolutePath)

            return
          } else {
            absolutePath = ''
            msg.error('图片下载失败，请重试~')
            return
          }
        }

        await revealInDirSafely(absolutePath)
      }
    }
  ])

  /** Right-click user menu (shown in group chat) */
  const optionsList = ref<RightMenu[]>([
    {
      label: () => t('menu.send_message'),
      icon: 'message-action',
      action: (item: RightMouseMessageItemLike) => {
        openMsgSession(item.uid || item.fromUser?.uid || '')
      },
      visible: (item: RightMouseMessageItemLike) => checkFriendRelation(item.uid || item.fromUser?.uid || '', 'friend')
    },
    {
      label: 'TA',
      icon: 'aite',
      action: (item: RightMouseMessageItemLike) => {
        useMitt.emit(MittEnum.AT, item.uid || item.fromUser?.uid || '')
      },
      visible: (item: RightMouseMessageItemLike) =>
        item.uid ? item.uid !== userUid.value : item.fromUser?.uid !== userUid.value
    },
    {
      label: () => t('menu.get_user_info'),
      icon: 'notes',
      action: (item: RightMouseMessageItemLike) => {
        // For chat profile use message key, for group member use uid
        const uid = item.uid || item.message.id
        useMitt.emit(`${MittEnum.INFO_POPOVER}-Sidebar`, { uid: uid, type: 'Sidebar' })
      }
    },
    {
      label: () => t('menu.modify_group_nickname'),
      icon: 'edit',
      action: (item: RightMouseMessageItemLike) => {
        const targetUid = item.uid || item.fromUser?.uid || ''
        const currentUid = userUid.value
        const roomId = globalStore.currentSessionRoomId
        const isGroup = globalStore.currentSession?.type === RoomTypeEnum.GROUP

        if (!isGroup || targetUid !== currentUid) {
          return
        }

        const currentUserInfo = roomStore.getMember(roomId, currentUid)
        const currentNickname = currentUserInfo?.displayName || ''

        useMitt.emit(MittEnum.OPEN_GROUP_NICKNAME_MODAL, {
          roomId,
          currentUid,
          originalNickname: currentNickname
        })
      },
      visible: (item: RightMouseMessageItemLike) =>
        item.uid ? item.uid === userUid.value : item.fromUser?.uid === userUid.value
    },
    {
      label: () => t('menu.add_friend'),
      icon: 'people-plus',
      action: async (item: RightMouseMessageItemLike) => {
        await createWebviewWindow('申请加好友', 'addFriendVerify', 380, 300, '', false, 380, 300)
        globalStore.addFriendModalInfo.show = true
        globalStore.addFriendModalInfo.uid = item.uid || item.fromUser?.uid || ''
      },
      visible: (item: RightMouseMessageItemLike) => !checkFriendRelation(item.uid || item.fromUser?.uid || '', 'all')
    },
    {
      label: () => t('menu.set_admin'),
      icon: 'people-safe',
      action: async (item: RightMouseMessageItemLike) => {
        const targetUid = item.uid || item.fromUser?.uid || ''
        const roomId = globalStore.currentSessionRoomId
        if (!roomId) return

        try {
          const service = roomStore.getService()
          if (service) {
            // 50 = Admin, 100 = Owner
            await service.setUserPowerLevel(roomId, targetUid, 50)
          }
          msg.success(t('menu.set_admin_success'))
        } catch (_error) {
          msg.error(t('menu.set_admin_fail'))
        }
      },
      visible: (item: RightMouseMessageItemLike) => {
        // 1. Check if in group chat
        const isInGroup = globalStore.currentSession?.type === RoomTypeEnum.GROUP
        if (!isInGroup) return false

        // 2. Check if room ID is not 1 (channel)
        const roomId = globalStore.currentSessionRoomId
        if (!roomId || roomId === '1') return false

        // 3. Get target user ID
        const targetUid = item.uid || item.fromUser?.uid
        if (!targetUid) return false

        // 4. Check target user role
        let targetRoleId = item.roleId

        // If no roleId in item, find from group member list via uid
        if (targetRoleId === void 0) {
          const targetUser = roomStore.getMember(roomId, targetUid)
          targetRoleId =
            targetUser?.role === 'owner'
              ? RoleEnum.LORD
              : targetUser?.role === 'admin'
                ? RoleEnum.ADMIN
                : RoleEnum.NORMAL
        }

        // Check if target user is already admin or owner
        if (targetRoleId === RoleEnum.ADMIN || targetRoleId === RoleEnum.LORD) return false

        // 5. Check if current user is owner
        const currentUser = roomStore.getMember(roomId, userUid.value)
        return currentUser?.role === 'owner'
      }
    },
    {
      label: () => t('menu.revoke_admin'),
      icon: 'reduce-user',
      action: async (item: RightMouseMessageItemLike) => {
        const targetUid = item.uid || item.fromUser?.uid || ''
        const roomId = globalStore.currentSessionRoomId
        if (!roomId) return

        try {
          const service = roomStore.getService()
          if (service) {
            await service.setUserPowerLevel(roomId, targetUid, 0)
          }
          msg.success(t('menu.revoke_admin_success'))
        } catch (_error) {
          msg.error(t('menu.revoke_admin_fail'))
        }
      },
      visible: (item: RightMouseMessageItemLike) => {
        // 1. Check if in group chat
        const isInGroup = globalStore.currentSession?.type === RoomTypeEnum.GROUP
        if (!isInGroup) return false

        // 2. Check if room ID is not 1 (channel)
        const roomId = globalStore.currentSessionRoomId
        if (!roomId || roomId === '1') return false

        // 3. Get target user ID
        const targetUid = item.uid || item.fromUser?.uid
        if (!targetUid) return false

        // 4. Check target user role
        let targetRoleId = item.roleId

        // If no roleId in item, find from group member list via uid
        if (targetRoleId === void 0) {
          const targetUser = roomStore.getMember(roomId, targetUid)
          targetRoleId =
            targetUser?.role === 'owner'
              ? RoleEnum.LORD
              : targetUser?.role === 'admin'
                ? RoleEnum.ADMIN
                : RoleEnum.NORMAL
        }

        // Check if target user is admin (can only revoke admin, not owner)
        if (targetRoleId !== RoleEnum.ADMIN) return false

        // 5. Check if current user is owner
        const currentUser = roomStore.getMember(roomId, userUid.value)
        return currentUser?.role === 'owner'
      }
    }
  ])

  /** Report options */
  const report = ref([
    {
      label: () => t('menu.remove_from_group'),
      icon: 'delete',
      action: async (item: RightMouseMessageItemLike) => {
        const targetUid = item.uid || item.fromUser?.uid || ''
        const roomId = globalStore.currentSessionRoomId
        if (!roomId) return

        try {
          const service = roomStore.getService()
          if (service) {
            await service.kickUser(roomId, targetUid, 'Removed by admin')
          }
          await roomStore.loadRoomMembers(roomId) // Refresh
          msg.success(t('menu.remove_success'))
        } catch (_error) {
          msg.error(t('menu.remove_from_group_fail'))
        }
      },
      visible: (item: RightMouseMessageItemLike) => {
        // 1. Check if in group chat
        const isInGroup = globalStore.currentSession?.type === RoomTypeEnum.GROUP
        if (!isInGroup) return false

        // 2. Check if room ID is not 1 (channel)
        const roomId = globalStore.currentSessionRoomId
        if (!roomId || roomId === '1') return false

        // 3. Get target user ID
        const targetUid = item.uid || item.fromUser?.uid
        if (!targetUid) return false

        // 4. Check target user role
        let targetRoleId = item.roleId

        // If no roleId in item, find from group member list via uid
        if (targetRoleId === void 0) {
          const targetUser = roomStore.getMember(roomId, targetUid)
          targetRoleId =
            targetUser?.role === 'owner'
              ? RoleEnum.LORD
              : targetUser?.role === 'admin'
                ? RoleEnum.ADMIN
                : RoleEnum.NORMAL
        }

        // Check if target user is owner (owner cannot be removed)
        if (targetRoleId === RoleEnum.LORD) return false

        // 5. Check if current user has permission (owner or admin)
        const currentUser = roomStore.getMember(roomId, userUid.value)
        const isLord = currentUser?.role === 'owner'
        const isAdmin = currentUser?.role === 'admin'

        // 6. If current user is admin, cannot remove other admins
        if (isAdmin && targetRoleId === RoleEnum.ADMIN) return false

        return isLord || isAdmin
      }
    },
    {
      label: () => t('menu.report'),
      icon: 'caution',
      action: () => {}
    }
  ])

  /** Emoji reaction menu */
  const emojiList = computed(() => [
    {
      url: '/msgAction/like.webp',
      value: 1,
      title: t('home.chat_reaction.like')
    },
    {
      url: '/msgAction/slightly-frowning-face.png',
      value: 2,
      title: t('home.chat_reaction.unsatisfied')
    },
    {
      url: '/msgAction/heart-on-fire.png',
      value: 3,
      title: t('home.chat_reaction.heart')
    },
    {
      url: '/msgAction/enraged-face.png',
      value: 4,
      title: t('home.chat_reaction.angry')
    },
    {
      url: '/emoji/party-popper.webp',
      value: 5,
      title: t('home.chat_reaction.party')
    },
    {
      url: '/emoji/rocket.webp',
      value: 6,
      title: t('home.chat_reaction.rocket')
    },
    {
      url: '/msgAction/face-with-tears-of-joy.png',
      value: 7,
      title: t('home.chat_reaction.lol')
    },
    {
      url: '/msgAction/clapping.webp',
      value: 8,
      title: t('home.chat_reaction.clap')
    },
    {
      url: '/msgAction/rose.png',
      value: 9,
      title: t('home.chat_reaction.flower')
    },
    {
      url: '/msgAction/bomb.png',
      value: 10,
      title: t('home.chat_reaction.bomb')
    },
    {
      url: '/msgAction/exploding-head.png',
      value: 11,
      title: t('home.chat_reaction.question')
    },
    {
      url: '/msgAction/victory-hand.png',
      value: 12,
      title: t('home.chat_reaction.victory')
    },
    {
      url: '/msgAction/flashlight.png',
      value: 13,
      title: t('home.chat_reaction.light')
    },
    {
      url: '/msgAction/pocket-money.png',
      value: 14,
      title: t('home.chat_reaction.red_envelope')
    }
  ])

  /**
   * Check user relationship
   * @param uid - User ID
   * @param type - Check type: 'friend' - friends only, 'all' - friends or self
   */
  const checkFriendRelation = (uid: string, type: 'friend' | 'all' = 'all') => {
    try {
      // ContactStore has been removed, always return false for friend checks
      const myUid = userStore.userInfo!.uid
      const isFriend = false
      return type === 'friend' ? isFriend && uid !== myUid : isFriend || uid === myUid
    } catch {
      return false
    }
  }

  /**
   * Get right-click menu list based on message type
   * @param type - Message type
   */
  const handleItemType = (type: MsgEnum) => {
    return type === MsgEnum.IMAGE || type === MsgEnum.EMOJI
      ? imageMenuList.value
      : type === MsgEnum.FILE
        ? fileMenuList.value
        : type === MsgEnum.VIDEO
          ? videoMenuList.value
          : menuList.value
  }

  return {
    menuList,
    videoMenuList,
    fileMenuList,
    imageMenuList,
    optionsList,
    report,
    emojiList,
    specialMenuList,
    handleItemType,
    checkFriendRelation
  }
}
