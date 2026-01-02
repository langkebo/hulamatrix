import { appDataDir, join, resourceDir } from '@tauri-apps/api/path'
import { writeImage, writeText } from '@tauri-apps/plugin-clipboard-manager'
import { save } from '@tauri-apps/plugin-dialog'
import { BaseDirectory } from '@tauri-apps/plugin-fs'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import type { FileTypeResult } from 'file-type'
import type { RightMenu } from '@/typings/components'
import { ref, computed, nextTick, onUnmounted, type InjectionKey } from 'vue'
import { storeToRefs } from 'pinia'
import { ErrorType } from '@/common/exception'
import {
  MergeMessageType,
  MittEnum,
  MsgEnum,
  PowerEnum,
  CallTypeEnum,
  RoleEnum,
  RoomTypeEnum,
  TauriCommand
} from '@/enums'
import { useCommon } from '@/hooks/useCommon.ts'
import { useDownload } from '@/hooks/useDownload'
import { useMitt } from '@/hooks/useMitt.ts'
import { useVideoViewer } from '@/hooks/useVideoViewer'
import { translateText } from '@/services/translate'
import type { TranslateProvider } from '@/services/types'
import type { FilesMeta, MessageType, RightMouseMessageItem, TextBody } from '@/services/types.ts'
import { useCachedStore } from '@/stores/dataCache'
import { useChatStore } from '@/stores/chat.ts'
import { useEmojiStore } from '@/stores/emoji'
import { useGlobalStore } from '@/stores/global.ts'
import { useRoomStore } from '@/stores/room'
import { useSettingStore } from '@/stores/setting.ts'
import { useUserStore } from '@/stores/user'
import { saveFileAttachmentAs, saveVideoAttachmentAs } from '@/utils/AttachmentSaver'
import { isDiffNow } from '@/utils/ComputedTime.ts'
import { extractFileName, removeTag } from '@/utils/Formatting'
import { detectImageFormat, imageUrlToUint8Array, isImageUrl } from '@/utils/ImageUtils'
import { recallMsg, updateMyRoomInfo } from '@/utils/ImRequestUtils'
import { detectRemoteFileType, getFilesMeta } from '@/utils/PathUtil'
import { isMac, isMobile } from '@/utils/PlatformConstants'
import { invokeWithErrorHandler } from '@/utils/TauriInvokeHandler'
import { useWindow } from './useWindow'
import { useI18n } from 'vue-i18n'
import { msg } from '@/utils/SafeUI'

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

type UseChatMainOptions = {
  enableGroupNicknameModal?: boolean
  disableHistoryActions?: boolean
}

type GroupNicknameModalPayload = {
  roomId: string
  currentUid: string
  originalNickname: string
}

export const useChatMain = (isHistoryMode = false, options: UseChatMainOptions = {}) => {
  const { t } = useI18n()
  const { openMsgSession, userUid } = useCommon()
  const { createWebviewWindow, sendWindowPayload, startRtcCall } = useWindow()
  const { getLocalVideoPath, checkVideoDownloaded } = useVideoViewer()
  // const fileDownloadStore = useFileDownloadStore()
  const settingStore = useSettingStore()
  const { chat } = storeToRefs(settingStore)
  const globalStore = useGlobalStore()
  const roomStore = useRoomStore()
  const chatStore = useChatStore()
  const cachedStore = useCachedStore()
  const emojiStore = useEmojiStore()
  const userStore = useUserStore()
  const { downloadFile } = useDownload()
  const enableGroupNicknameModal = options.enableGroupNicknameModal ?? false
  const disableHistoryActions = options.disableHistoryActions ?? false
  /** 滚动条位置 */
  const scrollTop = ref(-1)
  /** 提醒框标题 */
  const tips = ref()
  /** 是否显示删除信息的弹窗 */
  const modalShow = ref(false)
  /** 需要删除信息的下标 */
  const delIndex = ref('')
  const delRoomId = ref('')
  /** 选中的气泡消息 */
  const activeBubble = ref('')
  /** 记录历史消息下标 */
  const historyIndex = ref(0)
  /** 当前点击的用户的key */
  const selectKey = ref()

  /** 修改群昵称的模态框是否显示 */
  const groupNicknameModalVisible = ref(false)
  /** 修改群昵称输入的值 */
  const groupNicknameValue = ref('')
  /** 修改群昵称错误提示 */
  const groupNicknameError = ref('')
  /** 修改群昵称提交状态 */
  const groupNicknameSubmitting = ref(false)
  /** 修改群昵称上下文信息 */
  const groupNicknameContext = ref<{ roomId: string; currentUid: string; originalNickname: string } | null>(null)

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
      // Remark 功能说明：
      // - remark 字段用于设置用户在群组中的备注/别名
      // - 当前架构迁移中，RoomStore 暂未实现 remark 功能
      // - 如需启用，需要在 RoomStore 中添加 remark 状态管理
      // - Matrix 协议中可以通过 m.room.member 事件的 displayname 实现
      // - 当前使用空字符串作为默认值，不影响核心功能
      const remark = ''
      const payload = {
        id: roomId,
        myName: trimmedName,
        remark
      }
      await cachedStore.updateMyRoomInfo(payload)
      await updateMyRoomInfo(payload)
      // groupStore.updateUserItem(currentUid, { myName: trimmedName }, roomId)
      roomStore.updateMember(roomId, currentUid, { displayName: trimmedName })

      // await groupStore.updateGroupDetail(roomId, { myName: trimmedName })
      if (currentUid === userUid.value) {
        // groupStore.myNameInCurrentGroup = trimmedName
      }
      groupNicknameSubmitting.value = false
      groupNicknameModalVisible.value = false
    } catch (_error) {
      msg.error(t('home.chat_main.group_nickname.errors.update_fail'))
      groupNicknameSubmitting.value = false
    }
  }

  if (enableGroupNicknameModal) {
    useMitt.on(MittEnum.OPEN_GROUP_NICKNAME_MODAL, (payload: GroupNicknameModalPayload) => {
      groupNicknameContext.value = payload
      groupNicknameValue.value = payload.originalNickname || ''
      groupNicknameError.value = ''
      groupNicknameSubmitting.value = false
      groupNicknameModalVisible.value = true
    })
  }

  /** 通用右键菜单 */
  const handleForward = async (item: MessageType) => {
    if (!item?.message?.id) return
    const target = chatStore.chatMessageList.find((msg) => msg.message.id === item.message.id)
    if (!target) {
      return
    }
    chatStore.clearMsgCheck()
    target.isCheck = true
    chatStore.setMsgMultiChoose(true, 'forward')
    await nextTick()
    useMitt.emit(MittEnum.MSG_MULTI_CHOOSE, {
      action: 'open-forward',
      mergeType: MergeMessageType.SINGLE
    })
  }

  // 复制禁用类型
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
        // 移动端：触发转发事件，由移动端UI处理
        if (isMobile()) {
          useMitt.emit(MittEnum.FORWARD_MESSAGE, item)
        } else {
          handleForward(item)
        }
      },
      visible: (item: MessageType) => !isNoticeMessage(item)
    },
    // {
    //   label: '收藏',
    //   icon: 'collection-files',
    //   action: () => {
    //     msg.warning('暂未实现')
    //   }
    // },
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
        const res = await recallMsg({ roomId: globalStore.currentSessionRoomId, msgId: item.message.id })
        if (res) {
          ;(msg as unknown as { error: (error: unknown) => void }).error(res)
          return
        }
        chatStore.recordRecallMsg({
          recallUid: userStore.userInfo!.uid,
          msg
        })
        await chatStore.updateRecallMsg({
          recallUid: userStore.userInfo!.uid,
          roomId: msg.message.roomId,
          msgId: msg.message.id
        })
      },
      visible: (item: MessageType) => {
        const isSystemAdmin = userStore.userInfo?.power === PowerEnum.ADMIN
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
  const videoMenuList = ref<RightMenu[]>([
    {
      label: () => t('menu.copy'),
      icon: 'copy',
      action: (item: MessageType) => {
        const url = (item.message.body as UrlMessageBody)?.url || ''
        // 移动端和PC端都支持复制URL
        handleCopy(url, true, item.message.id)
      }
    },
    ...commonMenuList.value,
    {
      label: () => t('menu.save_as'),
      icon: 'Importing',
      action: async (item: MessageType) => {
        const fileBody = item.message.body as FileMessageBody
        // 移动端：触发下载事件或使用Tauri下载API
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

          // 检查视频是否已下载
          const isDownloaded = await checkVideoDownloaded(url)

          if (!isDownloaded) {
            // 如果未下载，先下载视频
            const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.Resource
            await downloadFile(url, localPath, baseDir)
            // 通知相关组件更新视频下载状态
            useMitt.emit(MittEnum.VIDEO_DOWNLOAD_STATUS_UPDATED, {
              url,
              downloaded: true
            })
          }

          // 获取视频的绝对路径
          const baseDirPath = isMobile() ? await appDataDir() : await resourceDir()
          const absolutePath = await join(baseDirPath, localPath)
          await revealInDirSafely(absolutePath)
        } catch (_error) {}
      }
    }
  ])
  /** 右键消息菜单列表 */
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
        const selectedText = getSelectedText(rawItem.message.id)
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
          const translateProvider = (chat.value.translate || 'youdao') as TranslateProvider
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
  const specialMenuList = computed(() => {
    return (messageType?: MsgEnum): RightMenu[] => {
      if (isHistoryMode) {
        // 历史记录模式：基础菜单（复制、转发）
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

        // 媒体文件额外菜单（收藏、另存为、在文件中打开）
        if (
          messageType === MsgEnum.IMAGE ||
          messageType === MsgEnum.EMOJI ||
          messageType === MsgEnum.VIDEO ||
          messageType === MsgEnum.FILE
        ) {
          const mediaMenus: RightMenu[] = [
            // {
            //   label: '收藏',
            //   icon: 'collection-files',
            //   action: () => {
            //     msg.warning('暂未实现')
            //   }
            // },
            {
              label: () => t('menu.save_as'),
              icon: 'Importing',
              action: async (item: MessageType) => {
                const fileBody = item.message.body as FileMessageBody
                const fileUrl = fileBody.url || ''
                const fileName = fileBody.fileName || ''
                // 移动端：触发下载事件
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

                // 最后判断文件不存在本地，那就下载它
                if (!fileMeta?.exists) {
                  // 文件不存在本地
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
        // 正常聊天模式：只显示删除
        return [
          {
            label: () => t('menu.del'),
            icon: 'delete',
            action: (item: MessageType) => {
              tips.value = '删除后将不会出现在你的消息记录中，确定删除吗?'
              modalShow.value = true
              delIndex.value = item.message.id
              delRoomId.value = item.message.roomId
            }
          }
        ]
      }
    }
  })
  /** 文件类型右键菜单 */
  const fileMenuList = ref<RightMenu[]>([
    {
      label: () => t('menu.preview'),
      icon: 'preview-open',
      action: (item: RightMouseMessageItem) => {
        nextTick(async () => {
          const path = 'previewFile'
          const LABEL = 'previewFile'

          /**
           * 构建窗口所需的 payload 数据，用于传递文件预览相关的信息。
           *
           * 包括用户 ID、房间 ID、消息 ID、文件路径、类型、是否存在本地等。
           * 若本地存在文件，则 url 使用本地路径，否则使用远程 URL。
           *
           * @param item - 右键点击的消息项，包含文件的消息结构和用户信息。
           * @param type - 文件类型信息（扩展名和 MIME 类型），可为空。
           * @param localExists - 文件是否存在于本地，用于决定路径选择。
           * @returns 构建后的 payload 对象。
           */
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

          /**
           * 当本地文件不存在或获取元数据失败时，执行远程文件类型检测，并构建 fallback payload。
           *
           * 构建完成后通过窗口通信接口发送该 payload，供目标窗口使用。
           *
           * @returns Promise<void>
           */
          const fallbackToRemotePayload = async () => {
            const body = item.message.body as unknown as { size: string; url: string; fileName: string }
            const remoteType = await detectRemoteFileType({
              url: body.url || '',
              fileSize: Number(body.size || 0)
            })
            const fallbackPayload = buildPayload(item, remoteType, false)
            await sendWindowPayload(LABEL, fallbackPayload)
          }

          // 这里不用状态中的absolute，是因为不能完全相信状态的绝对路径是否存在，有时不存在
          const resourceDirPath = await userStore.getUserRoomAbsoluteDir()
          const body = item.message.body as unknown as { size: string; url: string; fileName: string }
          const fileName = body?.fileName
          if (!fileName) return
          const absolutePath = await join(resourceDirPath, fileName)

          // 获取文件元信息（判断文件是否已下载/存在）
          const result = await getFilesMeta<FilesMeta>([absolutePath || body?.url || ''])
          const fileMeta = result[0]

          try {
            // 如果本地不存在该文件，清空旧的下载状态，准备读取远程链接作为兜底
            if (!fileMeta?.exists) {
              await fallbackToRemotePayload()
            } else {
              // 本地存在文件，构造 payload 使用本地路径和已知类型
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
            // 本地信息获取失败，可能是路径非法或 RPC 异常，兜底走远程解析
            await fallbackToRemotePayload()
          }

          // 最后创建用于预览文件的 WebView 窗口
          await createWebviewWindow('预览文件', path, 860, 720, '', true)
        })
      }
    },
    ...commonMenuList.value,
    {
      label: () => t('menu.save_as'),
      icon: 'Importing',
      action: async (item: RightMouseMessageItem) => {
        const fileBody = item.message.body as FileMessageBody
        // 移动端：触发下载事件
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

        // 最后判断文件不存在本地，那就下载它
        if (!fileMeta?.exists) {
          // 文件不存在本地
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
  /** 图片类型右键菜单 */
  const imageMenuList = ref<RightMenu[]>([
    {
      label: () => t('menu.copy'),
      icon: 'copy',
      action: async (item: MessageType) => {
        // 对于图片消息，优先使用 url 字段，回退到 content 字段
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
        // 移动端：触发下载事件
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

          // 这里会自动截取url后的文件名，可以尝试打印一下
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
  /** 右键用户信息菜单(群聊的时候显示) */
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
        // 如果是聊天框内的资料就使用的是消息的key，如果是群聊成员的资料就使用的是uid
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
        } as GroupNicknameModalPayload)
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
          // await groupStore.addAdmin([targetUid])
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
        // 1. 检查是否在群聊中
        const isInGroup = globalStore.currentSession?.type === RoomTypeEnum.GROUP
        if (!isInGroup) return false

        // 2. 检查房间号是否为1(频道)
        const roomId = globalStore.currentSessionRoomId
        if (!roomId || roomId === '1') return false

        // 3. 获取目标用户ID
        const targetUid = item.uid || item.fromUser?.uid
        if (!targetUid) return false

        // 4. 检查目标用户角色
        let targetRoleId = item.roleId

        // 如果item中没有roleId，则通过uid从群成员列表中查找
        if (targetRoleId === void 0) {
          const targetUser = roomStore.getMember(roomId, targetUid)
          targetRoleId =
            targetUser?.role === 'owner'
              ? RoleEnum.LORD
              : targetUser?.role === 'admin'
                ? RoleEnum.ADMIN
                : RoleEnum.NORMAL
        }

        // 检查目标用户是否已经是管理员或群主
        if (targetRoleId === RoleEnum.ADMIN || targetRoleId === RoleEnum.LORD) return false

        // 5. 检查当前用户是否是群主
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
          // await groupStore.revokeAdmin([targetUid])
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
        // 1. 检查是否在群聊中
        const isInGroup = globalStore.currentSession?.type === RoomTypeEnum.GROUP
        if (!isInGroup) return false

        // 2. 检查房间号是否为1(频道)
        const roomId = globalStore.currentSessionRoomId
        if (!roomId || roomId === '1') return false

        // 3. 获取目标用户ID
        const targetUid = item.uid || item.fromUser?.uid
        if (!targetUid) return false

        // 4. 检查目标用户角色
        let targetRoleId = item.roleId

        // 如果item中没有roleId，则通过uid从群成员列表中查找
        if (targetRoleId === void 0) {
          const targetUser = roomStore.getMember(roomId, targetUid)
          targetRoleId =
            targetUser?.role === 'owner'
              ? RoleEnum.LORD
              : targetUser?.role === 'admin'
                ? RoleEnum.ADMIN
                : RoleEnum.NORMAL
        }

        // 检查目标用户是否是管理员(只能撤销管理员,不能撤销群主)
        if (targetRoleId !== RoleEnum.ADMIN) return false

        // 5. 检查当前用户是否是群主
        const currentUser = roomStore.getMember(roomId, userUid.value)
        return currentUser?.role === 'owner'
      }
    }
  ])
  /** 举报选项 */
  const report = ref([
    {
      label: () => t('menu.remove_from_group'),
      icon: 'delete',
      action: async (item: RightMouseMessageItemLike) => {
        const targetUid = item.uid || item.fromUser?.uid || ''
        const roomId = globalStore.currentSessionRoomId
        if (!roomId) return

        try {
          // await groupStore.removeUserItem(targetUid, roomId)
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
        // 1. 检查是否在群聊中
        const isInGroup = globalStore.currentSession?.type === RoomTypeEnum.GROUP
        if (!isInGroup) return false

        // 2. 检查房间号是否为1(频道)
        const roomId = globalStore.currentSessionRoomId
        if (!roomId || roomId === '1') return false

        // 3. 获取目标用户ID
        const targetUid = item.uid || item.fromUser?.uid
        if (!targetUid) return false

        // 4. 检查目标用户角色
        let targetRoleId = item.roleId

        // 如果item中没有roleId，则通过uid从群成员列表中查找
        if (targetRoleId === void 0) {
          const targetUser = roomStore.getMember(roomId, targetUid)
          targetRoleId =
            targetUser?.role === 'owner'
              ? RoleEnum.LORD
              : targetUser?.role === 'admin'
                ? RoleEnum.ADMIN
                : RoleEnum.NORMAL
        }

        // 检查目标用户是否是群主(群主不能被移出)
        if (targetRoleId === RoleEnum.LORD) return false

        // 5. 检查当前用户是否有权限(群主或管理员)
        const currentUser = roomStore.getMember(roomId, userUid.value)
        const isLord = currentUser?.role === 'owner'
        const isAdmin = currentUser?.role === 'admin'

        // 6. 如果当前用户是管理员,则不能移出其他管理员
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
  /** emoji表情菜单 */
  const emojiList = computed(() => [
    {
      url: '/msgAction/like.png',
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
      url: '/msgAction/clapping.png',
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
   * 检查用户关系
   * @param uid 用户ID
   * @param type 检查类型: 'friend' - 仅好友, 'all' - 好友或自己
   */
  const checkFriendRelation = (uid: string, type: 'friend' | 'all' = 'all') => {
    try {
      // ContactStore has been removed, always return false for friend checks
      const userStore = useUserStore()
      const myUid = userStore.userInfo!.uid
      const isFriend = false // contactStore.friends?.some?.((item: { uid: string }) => item.uid === uid) ?? false
      return type === 'friend' ? isFriend && uid !== myUid : isFriend || uid === myUid
    } catch {
      return false
    }
  }

  const extractMsgIdFromDataKey = (dataKey?: string | null) => {
    if (!dataKey) return ''
    return dataKey.replace(/^[A-Za-z]/, '')
  }

  const resolveSelectionMessageId = (selection: Selection): string => {
    const resolveElement = (node: Node | null) => {
      if (!node) return null
      return node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement
    }

    const anchorElement = resolveElement(selection.anchorNode)
    const focusElement = resolveElement(selection.focusNode)

    if (!anchorElement || !focusElement) return ''

    const anchorKey = anchorElement.closest('[data-key]')?.getAttribute('data-key')
    const focusKey = focusElement.closest('[data-key]')?.getAttribute('data-key')

    if (!anchorKey || !focusKey || anchorKey !== focusKey) {
      return ''
    }

    const chatMainElement = document.getElementById('image-chat-main')
    if (chatMainElement && (!chatMainElement.contains(anchorElement) || !chatMainElement.contains(focusElement))) {
      return ''
    }

    return extractMsgIdFromDataKey(anchorKey)
  }

  /**
   * 获取用户选中的文本（仅返回聊天气泡内的选择，并可校验消息ID）
   */
  const getSelectedText = (messageId?: string): string => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      return ''
    }

    const text = selection.toString().trim()
    if (!text) {
      return ''
    }

    const selectedMessageId = resolveSelectionMessageId(selection)
    if (!selectedMessageId) {
      return ''
    }

    if (messageId && selectedMessageId !== messageId) {
      return ''
    }

    return text
  }

  /**
   * 检查是否有文本被选中
   */
  const hasSelectedText = (messageId?: string): boolean => {
    return getSelectedText(messageId).length > 0
  }

  /**
   * 清除文本选择
   */
  const clearSelection = (): void => {
    const selection = window.getSelection()
    if (selection) {
      selection.removeAllRanges()
    }
  }

  /**
   * 处理复制事件
   * @param content 复制的内容（作为回退）
   * @param prioritizeSelection 是否优先复制选中的文本
   */
  const handleCopy = async (content: string | undefined, prioritizeSelection: boolean = true, messageId?: string) => {
    try {
      let textToCopy = content || ''
      let isSelectedText = false

      // 如果启用了优先选择模式，检查是否有选中的文本
      if (prioritizeSelection) {
        const selectedText = getSelectedText(messageId)
        if (selectedText) {
          textToCopy = selectedText
          isSelectedText = true
        }
      }

      // 检查内容是否为空
      if (!textToCopy) {
        msg.warning('没有可复制的内容')
        return
      }

      // 如果是图片
      if (isImageUrl(textToCopy)) {
        try {
          const imageFormat = detectImageFormat(textToCopy)

          // 提示用户正在处理不同格式的图片
          if (imageFormat === 'GIF' || imageFormat === 'WEBP') {
            msg.info(`正在将 ${imageFormat} 格式图片转换为 PNG 并复制...`)
          }

          // 使用 Tauri 的 clipboard API 复制图片（自动转换为 PNG 格式）
          const imageBytes = await imageUrlToUint8Array(textToCopy)
          await writeImage(imageBytes)

          const successMessage = imageFormat === 'PNG' ? '图片已复制到剪贴板' : '图片已转换为 PNG 格式并复制到剪贴板'
          msg.success(successMessage)
        } catch (_imageError) {}
      } else {
        // 如果是纯文本
        await writeText(removeTag(textToCopy))
        const message = isSelectedText ? '选中文本已复制' : '消息内容已复制'
        msg.success(message)
      }
    } catch (_error) {}
  }

  /**
   * 根据消息类型获取右键菜单列表
   * @param type 消息类型
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

  /** 删除信息事件 */
  const handleConfirm = async () => {
    if (!delIndex.value) return
    const targetRoomId = delRoomId.value || globalStore.currentSessionRoomId
    if (!targetRoomId) {
      msg.error('无法确定消息所属的会话')
      return
    }
    try {
      await invokeWithErrorHandler(
        TauriCommand.DELETE_MESSAGE,
        {
          messageId: delIndex.value,
          roomId: targetRoomId
        },
        {
          customErrorMessage: '删除消息失败',
          errorType: ErrorType.Client
        }
      )
      chatStore.deleteMsg(delIndex.value)
      useMitt.emit(MittEnum.UPDATE_SESSION_LAST_MSG, { roomId: targetRoomId })
      delIndex.value = ''
      delRoomId.value = ''
      modalShow.value = false
      msg.success('消息已删除')
    } catch (_error) {}
  }

  let activeKeyPressListener: ((e: KeyboardEvent) => void) | null = null

  const removeKeyPressListener = () => {
    if (activeKeyPressListener) {
      document.removeEventListener('keydown', activeKeyPressListener)
      activeKeyPressListener = null
    }
  }

  /** 点击气泡消息时候监听用户是否按下ctrl+c来复制内容 */
  const handleMsgClick = (item: MessageType) => {
    if (item.message.type === MsgEnum.VIDEO_CALL) {
      startRtcCall(CallTypeEnum.VIDEO)
      return
    } else if (item.message.type === MsgEnum.AUDIO_CALL) {
      startRtcCall(CallTypeEnum.AUDIO)
      return
    }

    // 移动端不触发 active 效果
    if (!isMobile()) {
      if (chatStore.msgMultiChooseMode === 'forward') {
        activeBubble.value = ''
      } else {
        activeBubble.value = item.message.id
      }
    }

    // 先移除可能残留的监听，避免重复绑定
    removeKeyPressListener()

    // 启用键盘监听
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.key === 'c') || (e.metaKey && e.key === 'c')) {
        // 优先复制用户选中的文本，如果没有选中则复制整个消息内容
        // 对于图片或其他类型的消息，优先使用 url 字段
        const urlBody = item.message.body as UrlMessageBody
        const textBody = item.message.body as TextBody
        const contentToCopy = urlBody?.url || textBody?.content || ''
        handleCopy(contentToCopy, true, item.message.id)
        // 取消监听键盘事件，以免多次绑定
        removeKeyPressListener()
      }
    }
    activeKeyPressListener = handleKeyPress
    // 绑定键盘事件到 document
    document.addEventListener('keydown', handleKeyPress)
  }

  onUnmounted(() => {
    removeKeyPressListener()
  })

  return {
    handleMsgClick,
    handleConfirm,
    handleItemType,
    handleCopy,
    videoMenuList,
    getSelectedText,
    hasSelectedText,
    clearSelection,
    historyIndex,
    tips,
    modalShow,
    specialMenuList,
    optionsList,
    report,
    selectKey,
    emojiList,
    commonMenuList,
    scrollTop,
    groupNicknameModalVisible,
    groupNicknameValue,
    groupNicknameError,
    groupNicknameSubmitting,
    handleGroupNicknameConfirm,
    activeBubble
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
