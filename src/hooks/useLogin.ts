import { useRouter } from 'vue-router'
import { EventEnum, MittEnum, TauriCommand } from '@/enums'
import { useWindow } from '@/hooks/useWindow.ts'
import { useChatStore } from '@/stores/chat'
import { useGlobalStore } from '@/stores/global.ts'
import { LoginStatus, useWsLoginStore } from '@/stores/ws'
import { isDesktop, isMac, isMobile } from '@/utils/PlatformConstants'
import { clearListener } from '@/utils/ReadCountQueue'
import { ErrorType, invokeSilently, invokeWithErrorHandler } from '@/utils/TauriInvokeHandler.ts'
import { useSettingStore } from '../stores/setting'
import { useGroupStore } from '../stores/group'
import { useCachedStore } from '../stores/cached'
import { useConfigStore } from '../stores/config'
import { useUserStatusStore } from '../stores/userStatus'
import { useUserStore } from '../stores/user'
import { useLoginHistoriesStore } from '../stores/loginHistory'
import rustWebSocketClient from '@/services/webSocketRust'
import { useEmojiStore } from '@/stores/emoji'
import { getAllUserState, getUserDetail } from '@/utils/ImRequestUtils'
import { useNetwork } from '@vueuse/core'
import { UserInfoType } from '../services/types'
import { getEnhancedFingerprint } from '../services/fingerprint'
import { useMitt } from './useMitt'
import { ensureAppStateReady } from '@/utils/AppStateReady'
import { useI18nGlobal } from '../services/i18n'
import { useInitialSyncStore } from '@/stores/initialSync'
import { openExternalUrl } from './useLinkSegments'
import { TokenManager } from '@/utils/TokenManager'
import MatrixAuthService from '@/services/matrix/MatrixAuthService'
import { SexEnum } from '@/enums'

const isTauriContext = () =>
  Boolean((window as any).__TAURI__ || (window as any).__TAURI_INTERNALS__ || (window as any).__TAURI_INVOKE__)

let emitImpl: any = null
let listenImpl: any = null
let WebviewWindowImpl: any = null
let invokeImpl: any = null
let logInfoImpl: any = null

const getTauriEmit = async () => {
  if (!isTauriContext()) return null
  if (!emitImpl) {
    const tauri = await import('@tauri-apps/api/event')
    emitImpl = tauri.emit
    listenImpl = tauri.listen
  }
  return emitImpl
}

const getTauriListen = async () => {
  if (!isTauriContext()) return null
  if (!listenImpl) {
    const tauri = await import('@tauri-apps/api/event')
    emitImpl = tauri.emit
    listenImpl = tauri.listen
  }
  return listenImpl
}

const getWebviewWindow = async () => {
  if (!isTauriContext()) return null
  if (!WebviewWindowImpl) {
    const webview = await import('@tauri-apps/api/webviewWindow')
    WebviewWindowImpl = webview.WebviewWindow
  }
  return WebviewWindowImpl
}

const getInvoke = async () => {
  if (!isTauriContext()) return null
  if (!invokeImpl) {
    const tauri = await import('@tauri-apps/api/core')
    invokeImpl = tauri.invoke
  }
  return invokeImpl
}

const safeLogInfo = async (message: string) => {
  if (!isTauriContext()) {
    console.log(message)
    return
  }
  if (!logInfoImpl) {
    const log = await import('@tauri-apps/plugin-log')
    logInfoImpl = log.info
  }
  await logInfoImpl(message)
}

export const useLogin = () => {
  const { resizeWindow } = useWindow()
  const globalStore = useGlobalStore()
  const loginStore = useWsLoginStore()
  const chatStore = useChatStore()
  const settingStore = useSettingStore()
  const { isTrayMenuShow } = storeToRefs(globalStore)
  const groupStore = useGroupStore()
  const cachedStore = useCachedStore()
  const configStore = useConfigStore()
  const userStatusStore = useUserStatusStore()
  const userStore = useUserStore()
  const loginHistoriesStore = useLoginHistoriesStore()
  const initialSyncStore = useInitialSyncStore()
  const { createWebviewWindow } = useWindow()

  const { t } = useI18nGlobal()

  /**
   * 清空 localStorage 中用户相关的持久化数据
   * 防止 Pinia 在页面刷新时自动恢复旧账号数据
   */
  const clearUserLocalStorage = () => {
    const userScopedStoreKeys = ['chat', 'group', 'contacts', 'feed', 'cached', 'sessionUnread']
    userScopedStoreKeys.forEach((key) => {
      localStorage.removeItem(key)
    })
    console.log('[useLogin] User localStorage has been cleared')
  }

  /**
   * 清空消息缓存和群组数据
   * 在新数据加载完成后调用，避免旧消息混入
   */
  const clearMessageCache = () => {
    // 清空消息缓存（messageMap 是 reactive Record，需要逐个删除键）
    for (const key of Object.keys(chatStore.messageMap)) {
      delete chatStore.messageMap[key]
    }
    // 清空群组成员数据
    for (const key of Object.keys(groupStore.userListMap)) {
      delete groupStore.userListMap[key]
    }
    console.log('[useLogin] Message cache has been cleared')
  }

  /**
   * 在 composable 初始化时获取 router 实例
   * 注意: useRouter() 必须在组件 setup 上下文中调用
   * 不能在异步回调中调用 useRouter(),因为那时已经失去了 Vue 组件上下文
   * 所以在这里提前获取并保存 router 实例,供后续异步操作使用
   */
  let router: ReturnType<typeof useRouter> | null = null
  try {
    router = useRouter()
  } catch (_e) {
    void safeLogInfo('[useLogin] 无法获取 router 实例,可能不在组件上下文中')
  }

  /** 网络连接是否正常 */
  const { isOnline } = useNetwork()
  const loading = ref(false)
  /** 登录按钮的文本内容 */
  const loginText = ref(isOnline.value ? t('login.button.login.default') : t('login.button.login.network_error'))
  const loginDisabled = ref(!isOnline.value)
  /** 账号信息 */
  const info = ref({
    account: '',
    password: '',
    avatar: '',
    name: '',
    uid: ''
  })
  const uiState = ref<'manual' | 'auto'>('manual')
  /**
   * 设置登录状态(系统托盘图标，系统托盘菜单选项)
   */
  const setLoginState = async () => {
    // 登录成功后删除本地存储的wsLogin，防止用户在二维码页面刷新出二维码但是不使用二维码登录，导致二维码过期或者登录失败
    if (localStorage.getItem('wsLogin')) {
      localStorage.removeItem('wsLogin')
    }
    isTrayMenuShow.value = true
    if (!isMobile()) {
      await resizeWindow('tray', 130, 356)
    }
  }

  /**
   * 登出账号
   */
  const logout = async () => {
    globalStore.updateCurrentSessionRoomId('')

    const sendLogoutEvent = async () => {
      await invokeSilently('ws_disconnect')
      await invokeSilently(TauriCommand.REMOVE_TOKENS)
      await invokeSilently(TauriCommand.UPDATE_USER_LAST_OPT_TIME)
    }

    const matrixLogout = async () => {
      try {
        const authService = MatrixAuthService.getInstance()
        await authService.logout()
      } catch (error) {
        console.error('[useLogin] Matrix logout error:', error)
      }
    }

    if (isDesktop()) {
      const { createWebviewWindow } = useWindow()
      isTrayMenuShow.value = false
      try {
        await sendLogoutEvent()
        await matrixLogout()
        await createWebviewWindow('登录', 'login', 320, 448, undefined, false, 320, 448)
        const emit = await getTauriEmit()
        if (emit) {
          await emit(EventEnum.LOGOUT)
        }
        await resizeWindow('tray', 130, 44)
      } catch (_error) {
        void safeLogInfo('创建登录窗口失败')
      }
    } else {
      try {
        await sendLogoutEvent()
        await matrixLogout()
        const emit = await getTauriEmit()
        if (emit) {
          await emit(EventEnum.LOGOUT)
        }
      } catch (_error) {
        void safeLogInfo('登出失败')
        window.$message.error('登出失败')
      }
    }
  }

  // const { openExternalUrl } = useLinkSegments()

  /** 重置登录的状态 */
  const resetLoginState = async (isAutoLogin = false) => {
    // 清理消息已读计数监听器
    clearListener()
    // 1. 清理本地存储
    if (!isAutoLogin) {
      // TODO 未来这里需要区分账号，切换不同的account；用不同的REFRESH_TOKEN调用
      localStorage.removeItem('user')
      localStorage.removeItem('TOKEN')
      localStorage.removeItem('REFRESH_TOKEN')
    }
    settingStore.closeAutoLogin()
    loginStore.loginStatus = LoginStatus.Init
    globalStore.updateCurrentSessionRoomId('')
    // 2. 清除系统托盘图标上的未读数
    if (isMac() && isTauriContext()) {
      const WebviewWindow = await getWebviewWindow()
      if (WebviewWindow) {
        const homeWindow = await WebviewWindow.getByLabel('home')
        if (homeWindow) {
          await homeWindow.setBadgeCount(undefined)
        }
      }
    }
  }

  // 全量同步
  const runFullSync = async (preserveSession?: string) => {
    await chatStore.getSessionList(true)
    // 如果有需要保留的会话且该会话仍存在于列表中，则恢复选中状态
    if (preserveSession) {
      const sessionExists = chatStore.sessionList.some((s) => s.roomId === preserveSession)
      if (sessionExists) {
        // 会话存在，保持选中状态不变
      } else {
        // 会话不存在了，清空选中
        globalStore.updateCurrentSessionRoomId('')
      }
    } else {
      // 没有需要保留的会话，重置
      globalStore.updateCurrentSessionRoomId('')
    }

    // 加载所有群的成员数据
    const groupSessions = chatStore.getGroupSessions()
    await Promise.all([
      ...groupSessions.map((session) => groupStore.getGroupUserList(session.roomId, true)),
      groupStore.setGroupDetails(),
      chatStore.setAllSessionMsgList(20),
      cachedStore.getAllBadgeList()
    ])
  }

  // 增量同步
  const runIncrementalSync = async (preserveSession?: string) => {
    // 优先保证会话列表最新消息和未读数：拉会话即可让未读/最新一条消息就绪
    await chatStore.getSessionList(true)
    // 如果有需要保留的会话且该会话仍存在于列表中，则保持选中状态
    if (preserveSession) {
      const sessionExists = chatStore.sessionList.some((s) => s.roomId === preserveSession)
      if (!sessionExists) {
        // 会话不存在了，清空选中
        globalStore.updateCurrentSessionRoomId('')
      }
      // 会话存在则保持当前状态不变
    }
    // 没有需要保留的会话时也保持当前状态（增量同步不重置）

    // 加载所有群的成员数据和群公告，确保切换会话时数据已就绪
    const groupSessions = chatStore.getGroupSessions()
    await Promise.allSettled([
      ...groupSessions.map((session) => groupStore.getGroupUserList(session.roomId, true)),
      groupStore.setGroupDetails(),
      chatStore.setAllSessionMsgList(20),
      cachedStore.getAllBadgeList()
    ]).catch(() => {
      void safeLogInfo('[useLogin] 增量预热任务失败')
    })
  }

  const init = async (options?: { isInitialSync?: boolean }) => {
    const emojiStore = useEmojiStore()

    // 保存当前选中的会话，同步后如果该会话仍存在则恢复选中状态
    const previousSessionRoomId = globalStore.currentSessionRoomId

    // 清空 localStorage，防止页面刷新时恢复旧账号数据
    clearUserLocalStorage()

    // 清空消息缓存，避免旧消息混入新账号
    clearMessageCache()

    // 立即清空旧账号的会话列表，并立即获取新账号数据
    // 这样用户看到的是短暂加载而不是错误的旧数据
    chatStore.sessionList.length = 0
    groupStore.groupDetails.length = 0

    // 连接 ws
    await rustWebSocketClient.initConnect()

    // 立即获取新账号的会话列表（优先加载，减少空白时间）
    chatStore.getSessionList(true).catch(() => {
      void safeLogInfo('[useLogin] 获取会话列表失败')
    })

    // 用户相关数据初始化
    userStatusStore.stateList = await getAllUserState()
    const userDetail: any = await getUserDetail()
    userStatusStore.stateId = userDetail.userStateId
    const account = {
      ...userDetail,
      client: isDesktop() ? 'PC' : 'MOBILE'
    }
    userStore.userInfo = account
    loginHistoriesStore.addLoginHistory(account)
    // 初始化表情列表并在后台预取本地缓存（使用 worker + 并发限制）
    void emojiStore.initEmojis().catch(() => {
      void safeLogInfo('[login] 初始化表情失败')
    })

    // 在 sqlite 中存储用户信息
    await invokeWithErrorHandler(
      TauriCommand.SAVE_USER_INFO,
      {
        userInfo: userDetail
      },
      {
        customErrorMessage: '保存用户信息失败',
        errorType: ErrorType.Client
      }
    )

    // 数据初始化
    const cachedConfig = localStorage.getItem('config')
    if (cachedConfig) {
      configStore.config = JSON.parse(cachedConfig).config
    } else {
      await configStore.initConfig()
    }
    const isInitialSync = options?.isInitialSync ?? !initialSyncStore.isSynced(account.uid)

    // 登录后立即预热表情本地缓存（异步，不阻塞后续流程）
    void emojiStore.prefetchEmojiToLocal().catch(() => {
      void safeLogInfo('[login] 预热表情缓存失败')
    })

    if (isInitialSync) {
      chatStore.syncLoading = true
      try {
        await runFullSync(previousSessionRoomId)
      } finally {
        chatStore.syncLoading = false
      }
    } else {
      chatStore.syncLoading = true
      try {
        await runIncrementalSync(previousSessionRoomId)
      } finally {
        // 增量登录仅等待会话准备好就关闭提示，后台同步继续进行
        chatStore.syncLoading = false
      }
    }
    // 强制持久化
    chatStore.$persist?.()
    cachedStore.$persist?.()
    globalStore.$persist?.()

    await setLoginState()
  }

  /**
   * 根据平台类型执行不同的跳转逻辑
   * 桌面端: 创建主窗口
   * 移动端: 路由跳转到主页
   */
  const routerOrOpenHomeWindow = async () => {
    if (isDesktop() && isTauriContext()) {
      const WebviewWindow = await getWebviewWindow()
      if (WebviewWindow) {
        const registerWindow = await WebviewWindow.getByLabel('register')
        if (registerWindow) {
          await registerWindow.close().catch(() => {
            void safeLogInfo('关闭注册窗口失败')
          })
        }
        await createWebviewWindow('HuLa', 'home', 960, 720, 'login', true, 330, 480, undefined, false)
        globalStore.isTrayMenuShow = true
      }
    } else {
      router?.push('/mobile/home')
    }
  }

  const normalLogin = async (
    deviceType: 'PC' | 'MOBILE',
    syncRecentMessages: boolean,
    auto: boolean = settingStore.login.autoLogin
  ) => {
    if (!isTauriContext()) {
      window.$message.warning('当前环境不支持登录，请在 Tauri 桌面应用中运行')
      loading.value = false
      loginDisabled.value = false
      return
    }

    loading.value = true
    loginText.value = t('login.status.logging_in')
    loginDisabled.value = true
    const hasStoredUserInfo = !!userStore.userInfo && !!userStore.userInfo.account
    if (auto && !hasStoredUserInfo) {
      loading.value = false
      loginDisabled.value = false
      loginText.value = isOnline.value ? t('login.button.login.default') : t('login.button.login.network_error')
      uiState.value = 'manual'
      settingStore.setAutoLogin(false)
      safeLogInfo('自动登录信息已失效，请手动登录')
      return
    }

    const loginInfo = auto && userStore.userInfo ? (userStore.userInfo as UserInfoType) : info.value
    const account = loginInfo?.account
    const password = loginInfo?.password ?? info.value.password
    if (!account) {
      loading.value = false
      loginDisabled.value = false
      loginText.value = isOnline.value ? '登录' : '网络异常'
      if (auto) {
        uiState.value = 'manual'
        settingStore.setAutoLogin(false)
      }
      safeLogInfo('账号信息缺失，请重新输入')
      return
    }

    const clientId = await getEnhancedFingerprint()
    localStorage.setItem('clientId', clientId)

    await ensureAppStateReady()

    const invoke = await getInvoke()
    if (!invoke) {
      loading.value = false
      loginDisabled.value = false
      window.$message.warning('当前环境不支持登录')
      return
    }

    invoke('login_command', {
      data: {
        account: account,
        password: password,
        deviceType: deviceType,
        systemType: '2',
        clientId: clientId,
        grantType: 'PASSWORD',
        isAutoLogin: auto,
        asyncData: syncRecentMessages,
        uid: auto ? userStore.userInfo!.uid : null
      }
    })
      .then(async (_: any) => {
        loginDisabled.value = true
        loading.value = false
        loginText.value = t('login.status.success_redirect')

        if (!auto && isMobile()) {
          settingStore.setAutoLogin(true)
        }

        if (isMobile()) {
          await init()
          await invoke('hide_splash_screen')
        }
        useMitt.emit(MittEnum.MSG_INIT)

        await routerOrOpenHomeWindow()
      })
      .catch((e: any) => {
        window.$message.error(e)
        loading.value = false
        loginDisabled.value = false
        loginText.value = t('login.button.login.default')
        // 如果是自动登录失败，切换到手动登录界面并重置按钮状态
        if (auto) {
          uiState.value = 'manual'
          loginDisabled.value = false
          loginText.value = t('login.button.login.default')
          // 取消自动登录
          settingStore.setAutoLogin(false)
          // 自动填充之前尝试登录的账号信息到手动登录表单
          if (userStore.userInfo) {
            info.value.account = userStore.userInfo.account || userStore.userInfo.email || ''
            info.value.avatar = userStore.userInfo.avatar
            info.value.name = userStore.userInfo.name
            info.value.uid = userStore.userInfo.uid
          }
          // Token 过期时,移动端跳转到登录页
          if (isMobile()) {
            router?.replace('/mobile/login')
          }
        }
      })
  }

  const giteeLogin = async () => {
    if (!isTauriContext()) {
      window.$message.warning('当前环境不支持第三方登录，请在 Tauri 桌面应用中运行')
      loading.value = false
      loginDisabled.value = false
      return
    }

    try {
      loading.value = true
      loginDisabled.value = true
      loginText.value = t('login.status.logging_in')

      const clientId = await getEnhancedFingerprint()
      localStorage.setItem('clientId', clientId)

      await ensureAppStateReady()

      const invoke = await getInvoke()
      if (!invoke) {
        window.$message.warning('当前环境不支持登录')
        loading.value = false
        loginDisabled.value = false
        return
      }

      const port: number = await invoke('start_oauth_server')
      const redirectUri = `http://127.0.0.1:${port}/`

      let isProcessing = false
      const listen = await getTauriListen()
      if (!listen) {
        window.$message.warning('当前环境不支持登录')
        loading.value = false
        loginDisabled.value = false
        return
      }

      const unlisten = await listen('oauth-token', async (event: any) => {
        if (isProcessing) return
        isProcessing = true

        try {
          const payload = event.payload || ''
          const params = new URLSearchParams(payload)
          const token = params.get('token') || ''
          const refreshToken = params.get('refreshToken') || ''
          const uid = params.get('uid') || ''
          if (!token || !refreshToken) {
            throw new Error('授权回调缺少 token 或 refreshToken')
          }
          const targetUid = uid || undefined
          if (targetUid) {
            await invoke('switch_user_database', { uid: targetUid })
          }
          await TokenManager.updateToken(token, refreshToken, targetUid)
          await invoke('sync_messages', {
            param: {
              asyncData: true,
              fullSync: false,
              uid: targetUid
            }
          })
          loginDisabled.value = true
          loading.value = false
          loginText.value = t('login.status.success_redirect')
          useMitt.emit(MittEnum.MSG_INIT)
          await routerOrOpenHomeWindow()
        } catch {
          window.$message.error('Gitee 登录失败')
          loading.value = false
          loginDisabled.value = false
          loginText.value = t('login.button.login.default')
        } finally {
          if (typeof unlisten === 'function') {
            unlisten()
          }
        }
      })

      let baseUrl = ''

      try {
        const backendSettings = (await invoke('get_settings')) as Partial<import('@/services/tauriCommand').Settings>
        if (backendSettings && backendSettings.backend) {
          baseUrl = (backendSettings.backend as any).base_url || (backendSettings.backend as any).baseUrl || ''
        }
      } catch (_e) {
        void safeLogInfo('Failed to get settings from backend')
      }

      if (!baseUrl) {
        window.$message.error('请先在设置中配置服务器地址')
        loading.value = false
        loginDisabled.value = false
        return
      }

      baseUrl = baseUrl.replace(/\/$/, '')

      console.log('baseUrl', baseUrl)

      // 后端已配置固定回调地址 http://127.0.0.1:36677/
      const authorizeUrlEndpoint = `${baseUrl}/oauth/anyTenant/gitee/authorize-url?redirect=${encodeURIComponent(redirectUri)}`

      // 先请求后端获取真正的授权地址
      // 注意：这里需要根据项目使用的 HTTP 客户端来调用
      // 假设 invoke 无法直接调用后端 HTTP 接口，需要用 fetch 或 axios
      // 这里暂时使用 fetch，如果项目有封装好的 http client 应该使用它
      const response = await fetch(authorizeUrlEndpoint, {
        method: 'GET',
        headers: {
          Accept: 'application/json'
        }
      })

      const resText = await response.text()

      let resJson
      try {
        resJson = JSON.parse(resText)
      } catch (_e) {
        throw new Error(`解析响应失败: ${resText.substring(0, 100)}...`)
      }

      if (resJson.code === 200 || resJson.code === 0) {
        const giteeAuthUrl = resJson.data
        await openExternalUrl(giteeAuthUrl)
      } else {
        throw new Error(resJson.msg || '获取授权地址失败')
      }
    } catch (_e) {
      window.$message.error('Gitee 登录失败')
      loading.value = false
      loginDisabled.value = false
      loginText.value = t('login.button.login.default')
    }
  }

  const githubLogin = async () => {
    if (!isTauriContext()) {
      window.$message.warning('当前环境不支持第三方登录，请在 Tauri 桌面应用中运行')
      loading.value = false
      loginDisabled.value = false
      return
    }

    try {
      loading.value = true
      loginDisabled.value = true
      loginText.value = t('login.status.logging_in')
      const clientId = await getEnhancedFingerprint()
      localStorage.setItem('clientId', clientId)
      await ensureAppStateReady()

      const invoke = await getInvoke()
      if (!invoke) {
        window.$message.warning('当前环境不支持登录')
        loading.value = false
        loginDisabled.value = false
        return
      }

      const port: number = await invoke('start_oauth_server')
      const redirectUri = `http://127.0.0.1:${port}/`
      let isProcessing = false
      const listen = await getTauriListen()
      if (!listen) {
        window.$message.warning('当前环境不支持登录')
        loading.value = false
        loginDisabled.value = false
        return
      }

      const unlisten = await listen('oauth-token', async (event: any) => {
        if (isProcessing) return
        isProcessing = true
        try {
          const payload = event.payload || ''
          const params = new URLSearchParams(payload)
          const token = params.get('token') || ''
          const refreshToken = params.get('refreshToken') || ''
          const uid = params.get('uid') || ''
          if (!token || !refreshToken) {
            throw new Error('授权回调缺少 token 或 refreshToken')
          }
          const targetUid = uid || undefined
          if (targetUid) {
            await invoke('switch_user_database', { uid: targetUid })
          }
          await TokenManager.updateToken(token, refreshToken, targetUid)
          await invoke('sync_messages', {
            param: {
              asyncData: true,
              fullSync: false,
              uid: targetUid
            }
          })
          loginDisabled.value = true
          loading.value = false
          loginText.value = t('login.status.success_redirect')
          useMitt.emit(MittEnum.MSG_INIT)
          await routerOrOpenHomeWindow()
        } catch {
          window.$message.error('GitHub 登录失败')
          loading.value = false
          loginDisabled.value = false
          loginText.value = t('login.button.login.default')
        } finally {
          if (typeof unlisten === 'function') {
            unlisten()
          }
        }
      })
      let baseUrl = ''
      try {
        const backendSettings = (await invoke('get_settings')) as Partial<import('@/services/tauriCommand').Settings>
        if (backendSettings && backendSettings.backend) {
          // @ts-expect-error
          baseUrl = backendSettings.backend.base_url || backendSettings.backend.baseUrl || ''
        }
      } catch (_e) {}
      if (!baseUrl) {
        window.$message.error('请先在设置中配置服务器地址')
        loading.value = false
        loginDisabled.value = false
        return
      }
      baseUrl = baseUrl.replace(/\/$/, '')
      const authorizeUrlEndpoint = `${baseUrl}/oauth/anyTenant/github/authorize-url?redirect=${encodeURIComponent(redirectUri)}`
      const response = await fetch(authorizeUrlEndpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' }
      })
      const resText = await response.text()
      let resJson
      try {
        resJson = JSON.parse(resText)
      } catch {
        throw new Error(`解析响应失败: ${resText.substring(0, 100)}...`)
      }
      if (resJson.code === 200 || resJson.code === 0) {
        const githubAuthUrl = resJson.data
        await openExternalUrl(githubAuthUrl)
      } else {
        throw new Error(resJson.msg || '获取授权地址失败')
      }
    } catch (_e) {
      window.$message.error('GitHub 登录失败')
      loading.value = false
      loginDisabled.value = false
      loginText.value = t('login.button.login.default')
    }
  }

  const gitcodeLogin = async () => {
    if (!isTauriContext()) {
      window.$message.warning('当前环境不支持第三方登录，请在 Tauri 桌面应用中运行')
      loading.value = false
      loginDisabled.value = false
      return
    }

    try {
      loading.value = true
      loginDisabled.value = true
      loginText.value = t('login.status.logging_in')
      const clientId = await getEnhancedFingerprint()
      localStorage.setItem('clientId', clientId)
      await ensureAppStateReady()

      const invoke = await getInvoke()
      if (!invoke) {
        window.$message.warning('当前环境不支持登录')
        loading.value = false
        loginDisabled.value = false
        return
      }

      const port: number = await invoke('start_oauth_server')
      const redirectUri = `http://127.0.0.1:${port}/`
      let isProcessing = false
      const listen = await getTauriListen()
      if (!listen) {
        window.$message.warning('当前环境不支持登录')
        loading.value = false
        loginDisabled.value = false
        return
      }

      const unlisten = await listen('oauth-token', async (event: any) => {
        if (isProcessing) return
        isProcessing = true
        try {
          const payload = event.payload || ''
          const params = new URLSearchParams(payload)
          const token = params.get('token') || ''
          const refreshToken = params.get('refreshToken') || ''
          const uid = params.get('uid') || ''
          if (!token || !refreshToken) {
            throw new Error('授权回调缺少 token 或 refreshToken')
          }
          const targetUid = uid || undefined
          if (targetUid) {
            await invoke('switch_user_database', { uid: targetUid })
          }
          await TokenManager.updateToken(token, refreshToken, targetUid)
          await invoke('sync_messages', {
            param: {
              asyncData: true,
              fullSync: false,
              uid: targetUid
            }
          })
          loginDisabled.value = true
          loading.value = false
          loginText.value = t('login.status.success_redirect')
          useMitt.emit(MittEnum.MSG_INIT)
          await routerOrOpenHomeWindow()
        } finally {
          if (typeof unlisten === 'function') {
            unlisten()
          }
        }
      })
      let baseUrl = ''
      try {
        const backendSettings = (await invoke('get_settings')) as Partial<import('@/services/tauriCommand').Settings>
        if (backendSettings && backendSettings.backend) {
          baseUrl = (backendSettings.backend as any).base_url || (backendSettings.backend as any).baseUrl || ''
        }
      } catch (_e) {}
      if (!baseUrl) {
        window.$message.error('请先在设置中配置服务器地址')
        loading.value = false
        loginDisabled.value = false
        return
      }
      baseUrl = baseUrl.replace(/\/$/, '')
      const authorizeUrlEndpoint = `${baseUrl}/oauth/anyTenant/gitcode/authorize-url?redirect=${encodeURIComponent(redirectUri)}`
      const response = await fetch(authorizeUrlEndpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' }
      })
      const resText = await response.text()
      let resJson
      try {
        resJson = JSON.parse(resText)
      } catch {
        throw new Error(`解析响应失败: ${resText.substring(0, 100)}...`)
      }
      if (resJson.code === 200 || resJson.code === 0) {
        const gitcodeAuthUrl = resJson.data
        await openExternalUrl(gitcodeAuthUrl)
      } else {
        throw new Error(resJson.msg || '获取授权地址失败')
      }
    } catch (_e) {
      window.$message.error('GitCode 登录失败')
      loading.value = false
      loginDisabled.value = false
      loginText.value = t('login.button.login.default')
    }
  }

  const loginWithMatrix = async (username: string, password: string, homeserver?: string): Promise<boolean> => {
    try {
      loading.value = true
      loginDisabled.value = true
      loginText.value = t('login.status.logging_in')

      const authService = MatrixAuthService.getInstance()
      const sessionData = await authService.loginWithPassword(username, password, homeserver)

      const userId = sessionData.userId.replace('@', '').split(':')[0]

      userStore.userInfo = {
        uid: userId,
        account: username,
        password: password,
        avatar: '',
        name: username,
        email: '',
        modifyNameChance: 0,
        sex: SexEnum.MAN,
        userStateId: '',
        avatarUpdateTime: 0,
        client: sessionData.deviceId,
        resume: ''
      }

      loading.value = false
      loginDisabled.value = true
      loginText.value = t('login.status.success_redirect')

      await routerOrOpenHomeWindow()
      return true
    } catch (error) {
      console.error('[useLogin] Matrix login failed:', error)
      window.$message.error('Matrix 登录失败')
      loading.value = false
      loginDisabled.value = false
      loginText.value = t('login.button.login.default')
      return false
    }
  }

  return {
    resetLoginState,
    setLoginState,
    logout,
    normalLogin,
    giteeLogin,
    githubLogin,
    gitcodeLogin,
    loginWithMatrix,
    loading,
    loginText,
    loginDisabled,
    info,
    uiState,
    init
  }
}
