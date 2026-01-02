<template>
  <ChatListEnhancer
    :loading="syncLoading"
    :is-empty="sessionList.length === 0 && !syncLoading"
    :error="false"
    :error-message="''"
    @retry="handleRetry"
    @refresh="handleRefresh"
    @start-chat="handleStartChat">
    <template #default>
      <n-alert v-if="devDegraded" type="warning" :show-icon="true" class="mx-8px my-6px">
        开发模式：后端未接入，界面使用本地缓存与降级操作
      </n-alert>
      <div class="p-8px flex items-center gap-10px">
        <n-button size="tiny" secondary @click="joinPublicRoom">加入公共大厅</n-button>
        <n-input v-model:value="mxid" size="tiny" class="w-240px" placeholder="输入完整 MXID 如 @user:domain" />
        <n-button size="tiny" tertiary type="primary" class="mxid-dm-btn" @click="startDmByMxid">按MXID发起私聊</n-button>
        <n-button size="tiny" tertiary type="error" @click="handleDeleteCurrent">删除选中会话</n-button>
      </div>
      <!-- 统一的会话列表组件 -->
      <ChatList
        :sessions="sessionList"
        :current-room-id="globalStore.currentSessionRoomId"
        :show-search="true"
        :virtual-scroll="true"
        @click="handleItemClick"
        @dblclick="handleMsgDblclick"
        @contextmenu="handleContextMenu"
        @search="handleSearch" />
    </template>
  </ChatListEnhancer>
</template>
<script lang="ts" setup name="message">
import { reactive, ref, useTemplateRef, computed, watch, onBeforeMount, onMounted, nextTick } from 'vue'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { MittEnum, RoomTypeEnum, ThemeEnum, UserType, MsgEnum } from '@/enums'
import { useCommon } from '@/hooks/useCommon'
import { useMessage } from '@/hooks/useMessage'
import { useMitt } from '@/hooks/useMitt'
import { useReplaceMsg } from '@/hooks/useReplaceMsg'
import { useTauriListener } from '@/hooks/useTauriListener'
import { IsAllUserEnum, type SessionItem } from '@/services/types'
import { useChatStore } from '@/stores/chat'
import { useGlobalStore } from '@/stores/global'
import { useRoomStore } from '@/stores/room'
import { useSettingStore } from '@/stores/setting'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { formatTimestamp } from '@/utils/ComputedTime'
import { useI18n } from 'vue-i18n'
import { matrixClientService } from '@/integrations/matrix/client'
import { PUBLIC_ROOM_ALIASES, PUBLIC_ROOM_ALIAS } from '@/config/matrix-config'
import { useMatrixAuth } from '@/hooks/useMatrixAuth'
import { msg } from '@/utils/SafeUI'
import { getOrCreateDirectRoom, updateDirectMapping } from '@/integrations/matrix/contacts'
import { logger } from '@/utils/logger'
import ChatListEnhancer from '@/components/common/ChatListEnhancer.vue'
import ChatList from '@/components/common/ChatList.vue'
import { useDevConnectivity } from '@/hooks/useDevConnectivity'
import { hiddenSessions } from '@/utils/HiddenSessions'

// Matrix Client interface for joinRoom and getRooms methods
interface MatrixClientWithRooms {
  joinRoom?: (roomId: string) => Promise<unknown>
  getRooms?: () => unknown[]
}

const { t } = useI18n()
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window

type UnlistenFn = () => void

interface AppWindow {
  label: string
  listen?: <T = unknown>(event: string, handler: (event: T) => void) => Promise<UnlistenFn>
  [key: string]: unknown
}

const appWindow = (isTauri ? WebviewWindow.getCurrent() : { label: 'web', listen: async () => () => {} }) as AppWindow
const chatStore = useChatStore()
const globalStore = useGlobalStore()
const roomStore = useRoomStore()
const settingStore = useSettingStore()
const { addListener } = useTauriListener()
const themes = computed(() => settingStore.themes)
const syncLoading = computed(() => chatStore.syncLoading)
const { openMsgSession } = useCommon()
const { handleMsgClick, handleMsgDelete, handleMsgDblclick } = useMessage()

// 错误状态
const { backendConnected, isWebDev } = useDevConnectivity()
const devDegraded = computed(() => isWebDev.value && !backendConnected.value)

// 错误处理函数
const handleRetry = () => {
  logger.info('[MessageList] 用户点击重试')
  // 重新加载会话列表
  chatStore.getSessionList()
}

const handleRefresh = () => {
  logger.info('[MessageList] 用户点击刷新')
  // 刷新会话列表
  chatStore.getSessionList()
}

const handleStartChat = () => {
  logger.info('[MessageList] 开始聊天')
  // 可以打开添加好友或创建群组的界面
  openMsgSession('')
}
const handleDeleteCurrent = async () => {
  try {
    const roomId = globalStore.currentSessionRoomId
    if (!roomId) {
      msg.warning('请先选择会话')
      return
    }
    const item = chatStore.getSession(roomId) as SessionItem | undefined
    if (!item) {
      msg.warning('未找到会话')
      return
    }
    const confirmed = window.confirm('确定删除该会话吗？')
    if (!confirmed) return
    if (item.type === RoomTypeEnum.GROUP) {
      const service = roomStore.getService()
      if (service) {
        try {
          await service.leaveRoom(roomId)
        } catch {}
      }
      await chatStore.removeSession(roomId, { clearMessages: true, leaveRoom: true })
      hiddenSessions.add(roomId)
      msg.success('已退出并删除会话')
      return
    }
    try {
      const { deletePrivateSession } = await import('@/integrations/synapse/friends')
      await deletePrivateSession(roomId)
    } catch {}
    await chatStore.removeSession(roomId, { clearMessages: true, leaveRoom: true })
    hiddenSessions.add(roomId)
    msg.success('已删除会话')
  } catch (e) {
    msg.error('删除失败，请重试')
    logger.warn('handleDeleteCurrent failed', e)
  }
}
const handleItemClick = async (item: SessionItem, event?: MouseEvent) => {
  try {
    const isGroup = item?.type === RoomTypeEnum.GROUP
    if (isGroup && event && (event.altKey || event.metaKey)) {
      const confirmed = window.confirm('确定退出该群聊吗？')
      if (!confirmed) return
      const service = roomStore.getService()
      if (service) {
        await service.leaveRoom(item.roomId)
      }
      await chatStore.removeSession(item.roomId, { clearMessages: true, leaveRoom: true })
      msg.success('已退出群聊')
      return
    }
    await handleMsgClick(item)
  } catch (err) {
    msg.error('操作失败，请重试')
    logger.warn('handleItemClick failed', err)
  }
}

// Handle context menu event (now handled internally by ChatList, but we keep handler for logging)
const handleContextMenu = (item: SessionItem, _event: MouseEvent) => {
  logger.debug('[MessageList] Context menu triggered:', { roomId: item.roomId })
  // Context menu is now handled internally by ChatList component
}

// Handle search input
const handleSearch = (keyword: string) => {
  logger.debug('[MessageList] Search:', { keyword })
  // Search is now handled internally by ChatList component
}

type SessionMsgCacheItem = { msg: string; isAtMe: boolean; time: number; senderName: string }

// 缓存每个会话的格式化消息，避免重复计算
const sessionMsgCache = reactive<Record<string, SessionMsgCacheItem>>({})

// 会话列表
const sessionList = computed(() => {
  const { checkRoomAtMe, getMessageSenderName, formatMessageContent } = useReplaceMsg()

  return (
    chatStore.sessionList
      .map((item) => {
        // 获取最新的头像
        let latestAvatar = item.avatar
        if (item.type === RoomTypeEnum.SINGLE && item.detailId) {
          // latestAvatar = groupStore.getUserInfo(item.detailId)?.avatar || item.avatar
          latestAvatar = item.avatar // ChatStore should have correct avatar
        }

        // 获取群聊备注名称（如果有）
        let displayName = item.name
        if (item.type === RoomTypeEnum.GROUP && item.remark) {
          displayName = item.remark
        }

        // 获取该会话的所有消息用于检查@我
        const messages = chatStore.chatMessageListByRoomId(item.roomId)

        // 优化：使用缓存的消息，或者计算新的消息
        let displayMsg = ''
        let isAtMe = false

        const lastMsg = messages[messages.length - 1]
        const cacheKey = item.roomId
        const cached = sessionMsgCache[cacheKey]
        const sendTime = lastMsg?.message?.sendTime || 0

        // 如果有消息且缓存不存在或已过期，重新计算
        if (lastMsg) {
          const senderName = getMessageSenderName(lastMsg, '', item.roomId, item.type)
          // 修复缓存逻辑：增加更严格的缓存失效条件
          const shouldRefreshCache =
            !cached || cached.time < sendTime || cached.senderName !== senderName || !cached.msg // 缓存消息为空时重新计算

          if (shouldRefreshCache) {
            isAtMe = checkRoomAtMe(
              item.roomId,
              item.type,
              globalStore.currentSessionRoomId!,
              messages,
              item.unreadCount
            )
            // 获取纯文本消息内容（不包含 @我 标记）
            displayMsg = formatMessageContent(lastMsg, item.type, senderName, item.roomId)

            // 如果是群系统消息（如成员加入），不再前置发送者昵称
            if (item.type === RoomTypeEnum.GROUP && lastMsg.message?.type === MsgEnum.SYSTEM && displayMsg) {
              const separatorIndex = displayMsg.indexOf(':')
              if (separatorIndex > -1) {
                displayMsg = displayMsg.slice(separatorIndex + 1)
              }
            }

            // 过滤 JSON 格式的元数据消息（如 {"content": ...}）
            if (displayMsg && displayMsg.trim().startsWith('{') && displayMsg.trim().endsWith('}')) {
              try {
                // 尝试解析 JSON，如果成功且结构符合预期，则显示占位符或提取内容
                const json = JSON.parse(displayMsg)
                if (json.content !== undefined || json.body !== undefined || json.type !== undefined) {
                  // 这很可能是一个未正确渲染的消息对象，显示为[未知消息]
                  displayMsg = '[未知消息]'
                }
              } catch {
                // 解析失败，说明可能只是普通文本包含大括号，保持原样
              }
            }

            // 更新缓存（只缓存纯文本消息内容）
            sessionMsgCache[cacheKey] = {
              msg: displayMsg,
              isAtMe,
              time: sendTime,
              senderName
            }
          } else {
            displayMsg = cached.msg
            isAtMe = item.unreadCount > 0 ? cached.isAtMe : false
          }
        } else if (cached) {
          // 使用缓存的值，但如果未读数为0，强制isAtMe为false
          displayMsg = cached.msg
          isAtMe = item.unreadCount > 0 ? cached.isAtMe : false
        }

        // 优先使用会话存储的文本，其次使用计算的消息
        const finalDisplayMsg = item.text || displayMsg

        return {
          ...item,
          avatar: latestAvatar,
          name: displayName,
          lastMsg: finalDisplayMsg || displayMsg || '欢迎使用HuLa',
          lastMsgTime: formatTimestamp(item?.activeTime),
          isAtMe
        }
      })
      // 添加排序逻辑：先按置顶状态排序，再按活跃时间排序
      .sort((a, b) => {
        // 1. 先按置顶状态排序（置顶的排在前面）
        if (a.top && !b.top) return -1
        if (!a.top && b.top) return 1

        // 2. 在相同置顶状态下，按最后活跃时间降序排序（最新的排在前面）
        return b.activeTime - a.activeTime
      })
  )
})

/**
 * 会话切换优化
 *
 * 使用防抖和请求去重机制避免快速切换会话时导致频繁请求
 * - switchingState: 跟踪当前切换状态，防止并发切换
 * - pendingSwitchId: 记录待处理的切换目标，只处理最新的切换请求
 * - debounceTimer: 防抖定时器
 */
let switchingState = false
let pendingSwitchId: string | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => chatStore.currentSessionInfo,
  async (newVal) => {
    if (newVal) {
      // 避免重复调用：如果新会话与当前会话相同，跳过处理，不然会触发两次
      if (newVal.roomId === globalStore.currentSessionRoomId) {
        return
      }

      // 记录待处理的切换ID（防抖：只处理最新的切换请求）
      pendingSwitchId = newVal.roomId

      // 如果正在切换，清除之前的定时器，重新开始防抖计时
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }

      // 防抖延迟（毫秒）- 快速连续点击时只处理最后一次
      const DEBOUNCE_DELAY = 150

      debounceTimer = setTimeout(async () => {
        // 检查是否是最新的切换请求
        if (pendingSwitchId !== newVal.roomId) {
          logger.debug('[MessageList] 忽略过期的会话切换请求:', {
            pending: pendingSwitchId,
            current: newVal.roomId
          })
          return
        }

        // 如果正在切换，等待完成后再处理新的切换
        if (switchingState) {
          logger.debug('[MessageList] 会话切换进行中，等待完成:', newVal.roomId)
          return
        }

        try {
          switchingState = true

          // 判断是否是群聊
          if (newVal.type === RoomTypeEnum.GROUP) {
            const room = roomStore.rooms[newVal.roomId]
            const sessionItem = {
              ...newVal,
              memberNum: room?.memberCount ?? 0,
              remark: '', // room?.remark ?? '', // Remark not supported yet
              myName: room?.myDisplayName ?? ''
            }
            await handleMsgClick(sessionItem)
          } else {
            // 非群聊直接传递原始信息
            const sessionItem = newVal as SessionItem
            await handleMsgClick(sessionItem)
          }

          logger.debug('[MessageList] 会话切换完成:', newVal.roomId)
        } catch (error) {
          logger.error('[MessageList] 会话切换失败:', { roomId: newVal.roomId, error })
        } finally {
          switchingState = false

          // 如果有新的待处理切换，立即处理
          if (pendingSwitchId && pendingSwitchId !== newVal.roomId) {
            logger.debug('[MessageList] 处理待处理的会话切换:', pendingSwitchId)
            // 使用 globalStore 更新当前会话，触发 watch 执行
            globalStore.updateCurrentSessionRoomId(pendingSwitchId)
          }
        }
      }, DEBOUNCE_DELAY)
    }
  },
  { immediate: true }
)

const joinPublicRoom = async () => {
  try {
    let client = matrixClientService.getClient()
    if (!client) {
      const { store } = useMatrixAuth()
      if (!store.getHomeserverBaseUrl()) store.setDefaultBaseUrlFromEnv()
      const base = store.getHomeserverBaseUrl() || ''
      await matrixClientService.initialize({ baseUrl: base, accessToken: store.accessToken, userId: store.userId })
      await matrixClientService.startClient({ initialSyncLimit: 5, pollTimeout: 15000 })
      client = matrixClientService.getClient()
    }
    const clientWithRooms = client as unknown as MatrixClientWithRooms
    const aliases = PUBLIC_ROOM_ALIASES.length ? PUBLIC_ROOM_ALIASES : [PUBLIC_ROOM_ALIAS]
    for (const a of aliases) {
      try {
        if (typeof clientWithRooms.joinRoom === 'function') {
          await clientWithRooms.joinRoom(a)
        }
        break
      } catch {}
    }
    const rooms = typeof clientWithRooms.getRooms === 'function' ? clientWithRooms.getRooms() : []
    const target =
      rooms.find((r: unknown) =>
        typeof (r as Record<string, unknown>)?.getCanonicalAlias === 'function'
          ? aliases.includes((r as Record<string, unknown>).getCanonicalAlias as string)
          : false
      ) ||
      rooms.find((r: unknown) =>
        typeof (r as Record<string, unknown>)?.getMyMembership === 'function'
          ? (r as Record<string, unknown>).getMyMembership === 'join'
          : false
      ) ||
      rooms[0]
    if (target && typeof (target as Record<string, unknown>).roomId === 'string') {
      await chatStore.getSessionList()
      globalStore.updateCurrentSessionRoomId((target as Record<string, unknown>).roomId as string)
    } else {
      msg.warning('未找到公共房间')
    }
  } catch (e) {
    logger.warn('加入公共房间失败:', e)
    msg.error('加入公共房间失败')
  }
}

const mxid = ref('')
const formatMxid = (raw: string) => {
  const s = raw.trim()
  if (!s) return ''
  if (s.startsWith('@') && s.includes(':')) return s
  const { store } = useMatrixAuth()
  if (!store.getHomeserverBaseUrl()) store.setDefaultBaseUrlFromEnv()
  let host = ''
  try {
    const parsed = new URL(store.getHomeserverBaseUrl() || '').host
    host = parsed || host
  } catch {}
  const core = s.replace(/^@/, '')
  return `@${core.includes(':') ? core.split(':')[0] : core}:${host}`
}

const startDmByMxid = async () => {
  try {
    const target = formatMxid(mxid.value)
    if (!target || !target.startsWith('@') || !target.includes(':')) {
      msg.warning('请输入完整的 MXID，如 @user:domain')
      return
    }
    let client = matrixClientService.getClient()
    if (!client) {
      const { store } = useMatrixAuth()
      if (!store.getHomeserverBaseUrl()) store.setDefaultBaseUrlFromEnv()
      const base = store.getHomeserverBaseUrl() || ''
      await matrixClientService.initialize({ baseUrl: base, accessToken: store.accessToken, userId: store.userId })
      await matrixClientService.startClient({ initialSyncLimit: 5, pollTimeout: 15000 })
      client = matrixClientService.getClient()
    }
    const roomId = await getOrCreateDirectRoom(target)
    if (!roomId) {
      msg.error('无法创建会话')
      return
    }
    try {
      await updateDirectMapping(target, roomId)
    } catch {}
    await chatStore.getSessionList()
    globalStore.updateCurrentSessionRoomId(roomId)
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    msg.error(`创建会话失败：${m}`)
  }
}

onBeforeMount(async () => {
  // 从联系人页面切换回消息页面的时候自动定位到选中的会话
  useMitt.emit(MittEnum.LOCATE_SESSION, { roomId: globalStore.currentSessionRoomId })
})

onMounted(async () => {
  // 系统通知功能待完善
  // SysNTF - System notification handling to be implemented

  // 会话切换已优化：使用防抖和请求去重机制，减少频繁请求和卡顿
  if (isTauri && appWindow.label === 'home' && appWindow.listen) {
    const listenPromise = appWindow.listen('search_to_msg', (event: { payload: { uid: string; roomType: number } }) => {
      openMsgSession(event.payload.uid, event.payload.roomType)
    })
    await addListener(listenPromise, 'search_to_msg')
  }
  useMitt.on(MittEnum.UPDATE_SESSION_LAST_MSG, (payload?: { roomId?: string }) => {
    const roomId = payload?.roomId
    if (!roomId) return
    // 清除该会话的消息缓存，强制重新计算
    delete sessionMsgCache[roomId]
    logger.debug('[MessageList] 清除会话消息缓存:', { roomId })
  })
  useMitt.on(MittEnum.DELETE_SESSION, async (roomId: string) => {
    await handleMsgDelete(roomId)
  })
  useMitt.on(MittEnum.LOCATE_SESSION, async (e: { roomId: string }) => {
    // Note: Scrolling to session is now handled by ChatList component internally
    // The component will automatically scroll the selected session into view
    logger.debug('[MessageList] Locate session:', { roomId: e.roomId })
  })

  // 监听会话列表变化，确保UI及时更新
  watch(
    () => chatStore.sessionList,
    () => {
      logger.debug('[MessageList] 会话列表已更新，当前数量:', chatStore.sessionList.length)
    },
    { deep: true }
  )
})
</script>

<style lang="scss" scoped>
@use '@/styles/scss/message';

:deep(.mxid-dm-btn .n-button__content){
  color:#fff !important;
}

#image-no-data {
  @apply size-full mt-60px text-[--text-color] text-14px;
}
</style>
