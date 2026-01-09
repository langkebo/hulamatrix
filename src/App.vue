<template>
  <div id="app-container" class="h-100vh w-100vw">
    <!-- 全局加载状态组件 -->
    <AppLoading />
    <NaiveProvider :message-max="3" :notific-max="3" class="h-full">
      <div v-if="!isLock" class="h-full">
        <router-view />
      </div>
      <!-- 锁屏页面 -->
      <LockScreen v-else />
      <div v-if="showConnectionIndicator" class="connection-indicator" :data-state="connectionIndicatorState">
        <span class="connection-dot" :data-state="connectionIndicatorState"></span>
        <span class="connection-text">{{ connectionIndicatorText }}</span>
      </div>
    </NaiveProvider>
  </div>
  <component :is="mobileRtcCallFloatCell" v-if="mobileRtcCallFloatCell" />
</template>
<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch, nextTick, ref } from 'vue'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { exit } from '@tauri-apps/plugin-process'
import { logger } from '@/utils/logger'
import { loadLanguage } from '@/services/i18n'
import {
  CallTypeEnum,
  EventEnum,
  StoresEnum,
  ThemeEnum,
  ChangeTypeEnum,
  MittEnum,
  OnlineEnum,
  RoomTypeEnum
} from '@/enums'
import { useFixedScale } from '@/hooks/useFixedScale'
import { useGlobalShortcut } from '@/hooks/useGlobalShortcut.ts'
import { useMitt } from '@/hooks/useMitt.ts'
import { useWindow } from '@/hooks/useWindow.ts'
import { useGlobalStore } from '@/stores/global'
import { useSettingStore } from '@/stores/setting'
import { isDesktop, isIOS, isMobile, isWindows } from '@/utils/PlatformConstants'
import LockScreen from '@/views/LockScreen.vue'
import { unreadCountManager } from '@/utils/UnreadCountManager'
import AppLoading from '@/components/common/AppLoading.vue'
import { useAppStateStore } from '@/stores/appState'
import { AppState } from '@/enums'
import { useMatrixAuthStore } from '@/stores/matrixAuth'
import { appInitMonitor, AppInitPhase } from '@/utils/performanceMonitor'
import { handleAppError, AppErrorType } from '@/utils/appErrorHandler'
import {
  type LoginSuccessResType,
  type OnStatusChangeType,
  WsResponseMessageType,
  type WsTokenExpire,
  type VideoCallRequestEvent
} from '@/services/wsType.ts'
import { useGroupStore } from '@/stores/group'
import { useUserStore } from '@/stores/user'
import { useChatStore } from '@/stores/chat'
import { useAnnouncementStore } from '@/stores/announcement'
// REMOVED: useFeedStore - Moments/Feed feature removed (custom backend no longer supported)
import { useNotificationStore } from '@/stores/notifications'
import type { MarkItemType, RevokedMsgType, UserItem } from '@/services/types'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useTauriListener } from '@/hooks/useTauriListener'
import { defineAsyncComponent } from 'vue'
import { useRouter } from 'vue-router'
import { flags } from '@/utils/envFlags'
import { useMatrixStore } from '@/stores/matrix'
const mobileRtcCallFloatCell = isMobile()
  ? defineAsyncComponent(() => import('@/mobile/components/RtcCallFloatCell.vue'))
  : null

const userStore = useUserStore()
const announcementStore = useAnnouncementStore()
const notificationStore = useNotificationStore()
// REMOVED: feedStore - Moments/Feed feature removed
const userUid = computed(() => userStore.userInfo!.uid)
const groupStore = useGroupStore()
const chatStore = useChatStore()
const matrixStore = useMatrixStore()
const appWindow = typeof window !== 'undefined' && '__TAURI__' in window ? WebviewWindow.getCurrent() : null
const { createRtcCallWindow, sendWindowPayload } = useWindow()
const globalStore = useGlobalStore()
const router = useRouter()
const { addListener } = useTauriListener()
// 只在桌面端初始化窗口管理功能
const { createWebviewWindow } = isDesktop() ? useWindow() : { createWebviewWindow: () => {} }
const settingStore = useSettingStore()
const themes = computed(() => settingStore.themes)
const lockScreen = computed(() => settingStore.lockScreen)
const page = computed(() => settingStore.page)
const login = computed(() => settingStore.login)
// 全局快捷键管理
const { initializeGlobalShortcut, cleanupGlobalShortcut } = useGlobalShortcut()

// 创建固定缩放控制器（使用 #app-container 作为目标，避免影响浮层定位）
const fixedScale = useFixedScale({
  target: '#app-container',
  mode: 'transform',
  enableWindowsTextScaleDetection: true
})

/** 不需要锁屏的页面 */
const LockExclusion = new Set(['/login', '/tray', '/qrCode', '/about', '/onlineStatus', '/capture'])
const isLock = computed(() => {
  return !LockExclusion.has(router.currentRoute.value.path) && lockScreen.value.enable
})

/** 禁止图片以及输入框的拖拽 */
const preventDrag = (e: MouseEvent) => {
  const event = e.target as HTMLElement
  // 检查目标元素是否是<img>元素
  if (event.nodeName.toLowerCase() === 'img' || event.nodeName.toLowerCase() === 'input') {
    e.preventDefault()
  }
}
const preventGlobalContextMenu = (event: MouseEvent) => event.preventDefault()

const notifyError = (message: string) => {
  try {
    window.$message?.error?.(message)
  } catch {}
}

useMitt.on(WsResponseMessageType.VideoCallRequest, (event: VideoCallRequestEvent) => {
  logger.info(`收到通话请求：${JSON.stringify(event)}`)
  const remoteUid = event.callerUid
  const callType = event.isVideo ? CallTypeEnum.VIDEO : CallTypeEnum.AUDIO

  if (isMobile()) {
    useMitt.emit(MittEnum.MOBILE_RTC_CALL_REQUEST, {
      ...event,
      callerUid: remoteUid
    })
    return
  }

  handleVideoCall(remoteUid, callType)
})

useMitt.on(WsResponseMessageType.LOGIN_SUCCESS, async (data: LoginSuccessResType) => {
  const { ...rest } = data
  // 自己更新自己上线
  groupStore.updateOnlineNum({
    uid: rest.uid,
    isAdd: true
  })
  groupStore.updateUserItem(rest.uid, {
    activeStatus: OnlineEnum.ONLINE,
    avatar: rest.avatar,
    account: rest.account,
    lastOptTime: Date.now(),
    name: rest.name,
    uid: rest.uid
  })
})

useMitt.on(WsResponseMessageType.MSG_RECALL, (data: RevokedMsgType) => {
  chatStore.updateRecallMsg(data)
})

useMitt.on(WsResponseMessageType.MY_ROOM_INFO_CHANGE, (data: { myName: string; roomId: string; uid: string }) => {
  // 更新用户在群聊中的昵称
  groupStore.updateUserItem(data.uid, { myName: data.myName }, data.roomId)
})

useMitt.on(
  WsResponseMessageType.REQUEST_NEW_FRIEND,
  async (data: { uid: number; unReadCount4Friend: number; unReadCount4Group: number }) => {
    // 更新未读数
    globalStore.unReadMark.newFriendUnreadCount = data.unReadCount4Friend || 0
    globalStore.unReadMark.newGroupUnreadCount = data.unReadCount4Group || 0

    // 获取通知未读计数
    const noticeUnreadCount = notificationStore.getUnreadCount()
    globalStore.unReadMark.noticeUnreadCount = noticeUnreadCount

    unreadCountManager.refreshBadge(globalStore.unReadMark)
  }
)

useMitt.on(WsResponseMessageType.NOTIFY_EVENT, async () => {
  // 获取通知未读计数
  const noticeUnreadCount = notificationStore.getUnreadCount()
  globalStore.unReadMark.noticeUnreadCount = noticeUnreadCount

  unreadCountManager.refreshBadge(globalStore.unReadMark)
})

// 处理自己被移除
const handleSelfRemove = async (roomId: string) => {
  logger.info('本人退出群聊，移除会话数据')

  // 移除会话和群成员数据
  chatStore.removeSession(roomId)
  groupStore.removeAllUsers(roomId)

  // 如果当前会话就是被移除的群聊，切换到其他会话
  if (globalStore.currentSessionRoomId === roomId) {
    const firstSession = chatStore.sessionList[0]
    if (firstSession) {
      globalStore.updateCurrentSessionRoomId(firstSession.roomId)
    }
  }
}

// 处理其他成员被移除
const handleOtherMemberRemove = async (uid: string, roomId: string) => {
  logger.info('群成员退出群聊，移除群内的成员数据')
  groupStore.removeUserItem(uid, roomId)
}

// 处理群成员移除
const handleMemberRemove = async (userList: UserItem[], roomId: string) => {
  for (const user of userList) {
    if (isSelfUser(user.uid)) {
      await handleSelfRemove(roomId)
    } else {
      await handleOtherMemberRemove(user.uid, roomId)
    }
  }
}

// 处理其他成员加入群聊
const handleOtherMemberAdd = async (user: UserItem, roomId: string) => {
  logger.info('群成员加入群聊，添加群成员数据')
  groupStore.addUserItem(user, roomId)
}

// 检查是否为当前用户
const isSelfUser = (uid: string): boolean => {
  return uid === userStore.userInfo!.uid
}

// 处理自己加入群聊
const handleSelfAdd = async (roomId: string) => {
  logger.info('本人加入群聊，加载该群聊的会话数据')
  await chatStore.addSession(roomId)
  try {
    await groupStore.getGroupUserList(roomId, true)
  } catch (error) {
    notifyError('群成员同步失败，请稍后重试')
  }
}

// 处理群成员添加
const handleMemberAdd = async (userList: UserItem[], roomId: string) => {
  for (const user of userList) {
    if (isSelfUser(user.uid)) {
      await handleSelfAdd(roomId)
    } else {
      await handleOtherMemberAdd(user, roomId)
    }
  }
}

useMitt.on(
  WsResponseMessageType.WS_MEMBER_CHANGE,
  async (param: {
    roomId: string
    changeType: ChangeTypeEnum
    userList: UserItem[]
    totalNum: number
    onlineNum: number
  }) => {
    logger.info('监听到群成员变更消息')
    const isRemoveAction = param.changeType === ChangeTypeEnum.REMOVE || param.changeType === ChangeTypeEnum.EXIT_GROUP
    if (isRemoveAction) {
      await handleMemberRemove(param.userList, param.roomId)
    } else {
      await handleMemberAdd(param.userList, param.roomId)
    }

    groupStore.addGroupDetail(param.roomId)
    // 更新群内的总人数
    groupStore.updateGroupNumber(param.roomId, param.totalNum, param.onlineNum)
  }
)

useMitt.on(WsResponseMessageType.MSG_MARK_ITEM, async (data: { markList: MarkItemType[] } | MarkItemType) => {
  // 确保data.markList是一个数组再传递给updateMarkCount
  if ('markList' in data && data.markList && Array.isArray(data.markList)) {
    await chatStore.updateMarkCount(data.markList)
  } else if (!('markList' in data)) {
    // 兼容处理：如果直接收到了单个MarkItemType对象
    await chatStore.updateMarkCount([data])
  }
})

useMitt.on(WsResponseMessageType.REQUEST_APPROVAL_FRIEND, async () => {
  // 刷新好友列表以获取最新状态
  // Migrated to friendsServiceV2
  try {
    const { friendsServiceV2 } = await import('@/services/index-v2')
    await friendsServiceV2.listFriends(false) // useCache=false to refresh
  } catch (error) {
    logger.warn('[App] Failed to refresh friends list:', error)
  }

  // 获取通知未读计数
  const noticeUnreadCount = notificationStore.getUnreadCount()
  globalStore.unReadMark.noticeUnreadCount = noticeUnreadCount

  unreadCountManager.refreshBadge(globalStore.unReadMark)
})

useMitt.on(WsResponseMessageType.ROOM_INFO_CHANGE, async (data: { roomId: string; name: string; avatar: string }) => {
  // 根据roomId修改对应房间中的群名称和群头像
  const { roomId, name, avatar } = data

  // 更新chatStore中的会话信息
  chatStore.updateSession(roomId, {
    name,
    avatar
  })
})

useMitt.on(WsResponseMessageType.TOKEN_EXPIRED, async (wsTokenExpire: WsTokenExpire) => {
  if (Number(userUid.value) === Number(wsTokenExpire.uid) && userStore.userInfo!.client === wsTokenExpire.client) {
    const { useLogin } = await import('@/hooks/useLogin')
    const { resetLoginState, logout } = useLogin()
    if (isMobile()) {
      try {
        // 1. 先重置登录状态（不请求接口，只清理本地）
        await resetLoginState()
        // 2. 调用登出方法
        await logout()

        settingStore.toggleLogin(false, false)
        logger.info('账号在其他设备登录')

        // 3. 立即跳转到登录页，使用 replace 替换当前路由
        const router = await import('@/router')
        await router.default.replace('/mobile/login')

        // 4. 跳转后再显示弹窗提示
        // const { showDialog } = await import('vant') // 临时注释，vant包未安装
        // await import('vant/es/dialog/style') // 临时注释，vant包未安装

        /* showDialog({
          title: '登录失效',
          message: '您的账号已在其他设备登录，请重新登录',
          confirmButtonText: '我知道了',
          showCancelButton: false,
          closeOnClickOverlay: false,
          closeOnPopstate: false,
          allowHtml: false
        }) */ // 临时注释，vant包未安装
      } catch (error) {}
    } else {
      // 桌面端处理：聚焦主窗口并显示远程登录弹窗
      const home = await WebviewWindow.getByLabel('home')
      await home?.setFocus()
      const remoteIp = wsTokenExpire.ip || '未知IP'
      await sendWindowPayload('login', {
        remoteLogin: {
          ip: remoteIp,
          timestamp: Date.now()
        }
      })
      await resetLoginState()
      await logout()
    }
  }
})

useMitt.on(WsResponseMessageType.INVALID_USER, (param: { uid: string }) => {
  const data = param
  // 消息列表删掉拉黑的发言
  // chatStore.filterUser(data.uid)
  // 群成员列表删掉拉黑的用户
  groupStore.removeUserItem(data.uid)
})

useMitt.on(WsResponseMessageType.ONLINE, async (onStatusChangeType: OnStatusChangeType) => {
  // 群聊
  if (onStatusChangeType.type === 1) {
    groupStore.updateOnlineNum({
      roomId: onStatusChangeType.roomId,
      onlineNum: onStatusChangeType.onlineNum,
      isAdd: true
    })
    if (onStatusChangeType) {
      groupStore.updateUserItem(
        onStatusChangeType.uid,
        {
          activeStatus: OnlineEnum.ONLINE,
          lastOptTime: onStatusChangeType.lastOptTime
        },
        onStatusChangeType.roomId
      )
    }
  }
})

useMitt.on(WsResponseMessageType.ROOM_DISSOLUTION, async (roomId: string) => {
  // 移除群聊的会话
  chatStore.removeSession(roomId)
  // 移除群聊的详情
  groupStore.removeGroupDetail(roomId)
  // 如果当前会话为解散的群聊，切换到第一个会话
  if (globalStore.currentSessionRoomId === roomId) {
    const firstSession = chatStore.sessionList[0]
    if (firstSession) {
      globalStore.currentSessionRoomId = firstSession.roomId
    }
  }
})

useMitt.on(WsResponseMessageType.USER_STATE_CHANGE, async (data: { uid: string; userStateId: string }) => {
  groupStore.updateUserItem(data.uid, {
    userStateId: data.userStateId
  })
})

// REMOVED: WsResponseMessageType.FEED_SEND_MSG handler - Moments/Feed feature removed (custom backend no longer supported)
// REMOVED: WsResponseMessageType.FEED_NOTIFY handler - Moments/Feed feature removed (custom backend no longer supported)
// This included the FeedNotifyData interface and all feed notification handling code

useMitt.on(WsResponseMessageType.GROUP_SET_ADMIN_SUCCESS, (event: unknown) => {
  const e = event as { roomId: string; uids: string[]; status: boolean }
  groupStore.updateAdminStatus(e.roomId, e.uids, e.status)
})

useMitt.on(WsResponseMessageType.OFFLINE, async (onStatusChangeType: OnStatusChangeType) => {
  // 群聊
  if (onStatusChangeType.type === 1) {
    groupStore.updateOnlineNum({
      roomId: onStatusChangeType.roomId,
      onlineNum: onStatusChangeType.onlineNum,
      isAdd: false
    })
    if (onStatusChangeType) {
      groupStore.updateUserItem(
        onStatusChangeType.uid,
        {
          activeStatus: OnlineEnum.OFFLINE,
          lastOptTime: onStatusChangeType.lastOptTime
        },
        onStatusChangeType.roomId
      )
    }
  }
})

const handleVideoCall = async (remotedUid: string, callType: CallTypeEnum) => {
  logger.info(`监听到视频通话调用，remotedUid: ${remotedUid}, callType: ${callType}`)
  const currentSession = globalStore.currentSession
  const targetUid = remotedUid || currentSession?.detailId
  if (!targetUid) {
    return
  }
  if (isMobile()) {
    router.push({
      path: '/mobile/rtcCall',
      query: {
        remoteUserId: targetUid,
        roomId: globalStore.currentSessionRoomId,
        callType: callType,
        // 接受方
        isIncoming: 'true'
      }
    })
  } else {
    await createRtcCallWindow(true, targetUid, globalStore.currentSessionRoomId, callType)
  }
}

const listenMobileReLogin = async () => {
  const isTauri = typeof window !== 'undefined' && '__TAURI__' in window
  if (isMobile() && isTauri) {
    const { useLogin } = await import('@/hooks/useLogin')

    const { resetLoginState, logout } = useLogin()
    addListener(
      listen('relogin', async () => {
        logger.info('收到重新登录事件')
        await resetLoginState()
        await logout()
      }),
      'mobile-relogin'
    )
  }
}

const wsConnectionState = ref<string | null>(null)
let reconnectSyncPromise: Promise<void> | null = null
let lastReconnectSyncAt = 0
const RECONNECT_SYNC_COOLDOWN_MS = 3000

// WebSocket 事件类型定义
interface WebSocketEventPayload {
  type: 'connectionStateChanged'
  state?: string
  isReconnection?: boolean
  is_reconnection?: boolean
}

interface WebSocketEvent {
  payload: WebSocketEventPayload
}

const runReconnectSync = async () => {
  const now = Date.now()
  if (reconnectSyncPromise) return reconnectSyncPromise
  if (now - lastReconnectSyncAt < RECONNECT_SYNC_COOLDOWN_MS) return
  lastReconnectSyncAt = now

  reconnectSyncPromise = (async () => {
    chatStore.syncLoading = true
    try {
      if (userStore.userInfo?.uid) {
        await invoke('sync_messages', { param: { asyncData: true, uid: userStore.userInfo.uid } })
      }
      await chatStore.getSessionList()
      if (globalStore.currentSessionRoomId) {
        await chatStore.resetAndRefreshCurrentRoomMessages()
        await chatStore.fetchCurrentRoomRemoteOnce(20)
        const currentSession = chatStore.getSession(globalStore.currentSessionRoomId)
        if (currentSession?.unreadCount) {
          try {
            // Use unifiedMessageService instead of deprecated ImRequestUtils
            const { unifiedMessageService } = await import('@/services/unified-message-service')
            await unifiedMessageService.markRoomRead(currentSession.roomId)
          } catch (error) {}
          chatStore.markSessionRead(currentSession.roomId)
        }
      }
      unreadCountManager.refreshBadge(globalStore.unReadMark)
    } catch (error) {
      notifyError('重连同步失败，请检查网络')
      throw error
    } finally {
      chatStore.syncLoading = false
      reconnectSyncPromise = null
    }
  })()

  return reconnectSyncPromise
}

const handleWebsocketEvent = async (event: WebSocketEvent) => {
  const payload = event.payload
  if (!payload || payload.type !== 'connectionStateChanged') return

  const previousState = wsConnectionState.value
  const nextState = payload.state
  const isReconnectionFlag = payload.isReconnection ?? payload.is_reconnection
  const hasRecoveredFromDrop = Boolean(previousState && previousState !== 'CONNECTED' && nextState === 'CONNECTED')

  wsConnectionState.value = nextState ?? previousState

  if (!(nextState === 'CONNECTED' && (isReconnectionFlag || hasRecoveredFromDrop))) return

  await runReconnectSync()
}

/**
 * iOS网络权限预请求
 * 在应用启动时发起一个轻量级网络请求，触发iOS的网络权限弹窗
 */
const requestNetworkPermissionForIOS = async () => {
  try {
    await fetch('https://www.apple.com/favicon.ico', {
      method: 'HEAD',
      cache: 'no-cache'
    })
  } catch {}
}

onMounted(async () => {
  // Initialize unified message receiver service
  try {
    const { unifiedMessageReceiver } = await import('@/services/unifiedMessageReceiver')
    await unifiedMessageReceiver.initialize()
    logger.info('[App] Unified message receiver initialized')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('[App] Failed to initialize unified message receiver:', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    })

    // User-friendly notification for critical initialization failure
    // Non-blocking: message receiving may still work through other channels
    logger.warn('[App] Message receiver initialization failed - continuing with limited functionality')
  }

  // WebSocket 已废弃，使用 Matrix SDK 同步消息
  logger.info('[App] Using Matrix SDK for message synchronization (WebSocket removed)')

  // iOS应用启动时预请求网络权限（必须在最开始执行）
  if (isIOS()) {
    requestNetworkPermissionForIOS()
  }

  // 仅在windows上使用
  if (isWindows()) {
    fixedScale.enable()
  }
  // 判断是否是桌面端，桌面端需要调整样式
  isDesktop() && import('@/styles/scss/global/desktop.scss')
  // 判断是否是移动端，移动端需要加载安全区域适配样式
  isMobile() && import('@/styles/scss/global/mobile.scss')
  import(`@/styles/scss/theme/${themes.value.versatile}.scss`)
  // 判断localStorage中是否有设置主题
  if (!localStorage.getItem(StoresEnum.SETTING)) {
    settingStore.initTheme(ThemeEnum.OS)
  }
  document.documentElement.dataset.theme = themes.value.content
  window.addEventListener('dragstart', preventDrag)

  if (typeof window !== 'undefined' && '__TAURI__' in window) {
    addListener(listen('websocket-event', handleWebsocketEvent), 'websocket-event')
  }

  // 只在桌面端的主窗口中初始化全局快捷键
  if (isDesktop() && appWindow && appWindow.label === 'home') {
    initializeGlobalShortcut()
  }
  /** 开发环境不禁止 */
  if (process.env.NODE_ENV !== 'development') {
    /** 禁用浏览器默认的快捷键 */
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey && (e.key === 'f' || e.key === 'r' || e.key === 'g' || e.key === 'j')) {
        e.preventDefault()
      }
    })
    /** 禁止右键菜单 */
    window.addEventListener('contextmenu', preventGlobalContextMenu, false)
  }
  // 只在桌面端处理窗口相关事件
  if (isDesktop() && appWindow) {
    addListener(
      appWindow.listen(EventEnum.EXIT, async () => {
        await exit(0)
      }),
      'app-exit'
    )
  }
  listenMobileReLogin()

  // 应用状态初始化 - 在现有初始化完成后执行
  try {
    const appStateStore = useAppStateStore()
    const matrixAuthStore = useMatrixAuthStore()

    // 开始性能监控
    appInitMonitor.start()

    // 初始状态设为初始化中
    appStateStore.setState(AppState.INITIALIZING)

    // 检查是否有存储的 Matrix 认证信息
    appInitMonitor.markPhase(AppInitPhase.CHECK_CREDENTIALS)
    const hasStoredAuth = !!(matrixAuthStore.accessToken && matrixAuthStore.userId)

    if (!hasStoredAuth) {
      logger.info('[App] No stored credentials, showing login')
      appStateStore.setState(AppState.NOT_LOGGED_IN)
      appInitMonitor.complete()
    } else {
      // 有存储的认证信息，直接设为已登录
      logger.info('[App] Found stored credentials:', matrixAuthStore.userId)
      appStateStore.setState(AppState.LOGGED_IN)
      appInitMonitor.markPhase(AppInitPhase.READY)

      // 等待一小段时间让客户端同步完成，然后设置为就绪
      setTimeout(() => {
        appStateStore.setState(AppState.READY)
        logger.info('[App] Application ready')
        appInitMonitor.complete()
      }, 1000)
    }
  } catch (error) {
    logger.error('[App] Initialization failed:', error)

    // 使用统一的错误处理
    handleAppError(error, {
      customMessage: '应用初始化失败',
      messageType: 'error'
    })

    // 如果初始化失败，设置为未登录状态，让用户重新登录
    try {
      const { useAppStateStore } = await import('@/stores/appState')
      const appStateStore = useAppStateStore()
      appStateStore.setState(AppState.NOT_LOGGED_IN)
      appInitMonitor.complete()
    } catch {
      // 如果连导入都失败，忽略错误
    }
  }
})

onUnmounted(async () => {
  if (stopGroupSessionWatch) {
    stopGroupSessionWatch()
    stopGroupSessionWatch = null
  }

  // 关闭固定缩放，恢复样式与监听
  fixedScale.disable()

  window.removeEventListener('contextmenu', preventGlobalContextMenu, false)
  window.removeEventListener('dragstart', preventDrag)

  // 只在桌面端的主窗口中清理全局快捷键
  if (isDesktop() && appWindow && appWindow.label === 'home') {
    await cleanupGlobalShortcut()
  }
})

/** 控制阴影 */
watch(
  () => page.value.shadow,
  (val) => {
    // 移动端始终禁用阴影
    if (isMobile()) {
      document.documentElement.style.setProperty('--shadow-enabled', '1')
    } else {
      document.documentElement.style.setProperty('--shadow-enabled', val ? '0' : '1')
    }
  },
  { immediate: true }
)

/** 控制高斯模糊 */
watch(
  () => page.value.blur,
  (val) => {
    document.documentElement.setAttribute('data-blur', val ? '1' : '0')
  },
  { immediate: true }
)

/** 控制字体样式 */
watch(
  () => page.value.fonts,
  (val) => {
    document.documentElement.style.setProperty('--font-family', val)
  },
  { immediate: true }
)

/**
 * 语言发生变化
 */
watch(
  () => page.value.lang,
  (lang) => {
    lang = lang === 'AUTO' ? navigator.language : lang
    loadLanguage(lang)
  }
)

/** 控制变化主题 */
watch(
  () => themes.value.versatile,
  async (val, oldVal) => {
    await import(`@/styles/scss/theme/${val}.scss`)
    // 然后给最顶层的div设置val的类样式
    const app = document.querySelector('#app')?.classList as DOMTokenList
    app.remove(oldVal as string)
    await nextTick(() => {
      app.add(val)
    })
  },
  { immediate: true }
)

/** 监听会话变化 */
let stopGroupSessionWatch: null | (() => void) = null
const ensureGroupSessionWatch = () => {
  if (stopGroupSessionWatch) return
  stopGroupSessionWatch = watch(
    () => [globalStore.currentSessionRoomId, globalStore.currentSession?.type],
    async () => {
      const sessionRoomId = globalStore.currentSessionRoomId
      const sessionType = globalStore.currentSession?.type
      const currentSession = globalStore.currentSession

      if (!sessionRoomId || sessionType !== RoomTypeEnum.GROUP || !currentSession) return

      try {
        const result = await groupStore.switchSession(currentSession)
        if (result?.success) {
          await announcementStore.loadGroupAnnouncements()
        }
      } catch (error) {
        notifyError('群聊状态同步失败')
      }
    },
    { immediate: true }
  )
}

useMitt.on(MittEnum.MSG_INIT, () => {
  ensureGroupSessionWatch()
})

onMounted(() => {
  ensureGroupSessionWatch()
})

const showConnectionIndicator = computed(() => {
  if (chatStore.syncLoading) return true
  if (wsConnectionState.value && wsConnectionState.value !== 'CONNECTED') return true
  if (matrixStore.syncState === 'ERROR') return true
  return false
})

const connectionIndicatorState = computed(() => {
  if (chatStore.syncLoading || matrixStore.isSyncing) return 'SYNCING'
  if (wsConnectionState.value && wsConnectionState.value !== 'CONNECTED') return 'DISCONNECTED'
  if (matrixStore.syncState === 'ERROR') return 'DISCONNECTED'
  return 'CONNECTED'
})

const connectionIndicatorText = computed(() => {
  const ws = wsConnectionState.value || 'UNKNOWN'
  return `WS:${ws} · Matrix:${matrixStore.syncState}`
})
</script>
<style lang="scss">
/* 修改naive-ui select 组件的样式 */
.n-base-selection,
.n-base-select-menu,
.n-base-select-menu .n-base-select-option .n-base-select-option__content,
.n-base-select-menu .n-base-select-option::before {
  border-radius: 8px;
  font-size: 12px;
}

img {
  user-select: none;
  -webkit-user-select: none;
}

input,
button,
a {
  user-select: auto;
  cursor: auto;
}

.connection-indicator {
  position: fixed;
  right: 12px;
  bottom: 12px;
  z-index: 9999;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 12px;
  line-height: 1;
  user-select: none;
  pointer-events: none;
}

.connection-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #999;
}

.connection-dot[data-state='SYNCING'] {
  background: #f0b429;
}

.connection-dot[data-state='DISCONNECTED'] {
  background: #e55353;
}

.connection-dot[data-state='CONNECTED'] {
  background: #2fb344;
}
</style>
