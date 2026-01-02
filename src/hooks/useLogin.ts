import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { emit } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useRouter } from 'vue-router'
import { EventEnum, MittEnum, TauriCommand } from '@/enums'
import { useWindow } from '@/hooks/useWindow'
import { useChatStore } from '@/stores/chat'
import { useGlobalStore } from '@/stores/global'
import { LoginStatus, useWebSocketStore as useWsLoginStore } from '@/stores/websocket'
import { isDesktop, isMac, isMobile } from '@/utils/PlatformConstants'
import { clearListener } from '@/utils/ReadCountQueue'
import { ErrorType, invokeSilently, invokeWithErrorHandler } from '@/utils/TauriInvokeHandler'
import { useSettingStore } from '../stores/setting'
import { useGroupStore } from '../stores/group'
import { useCachedStore } from '../stores/dataCache'
import { useConfigStore } from '../stores/config'
import { useUserStatusStore } from '../stores/userStatus'
import { useUserStore } from '../stores/user'
import { useLoginHistoriesStore } from '../stores/loginHistory'
import rustWebSocketClient from '@/services/webSocketRust'
// 旧 IM 层已禁用，用户状态与详情改由 Matrix 或占位提供
import { useNetwork } from '@vueuse/core'
import { UserInfoType } from '../services/types'
import { getEnhancedFingerprint } from '../services/fingerprint'
import { invoke } from '@tauri-apps/api/core'
import { useMitt } from './useMitt'
import { info as logInfo } from '@tauri-apps/plugin-log'
import { ensureAppStateReady } from '@/utils/AppStateReady'
import { useI18nGlobal } from '../services/i18n'
import { useInitialSyncStore } from '@/stores/initialSync'
import { useMatrixAuth } from '@/hooks/useMatrixAuth'
import { ADMIN_ACCOUNTS } from '@/config/admin'
import { msg } from '@/utils/SafeUI'
import { logger } from '@/utils/logger'
import { MatrixLoginDebugger } from '@/utils/MatrixLoginDebugger'
import { createTimer } from '@/utils/Perf'

/** Pinia store with $persist method */
interface PersistableStore {
  $persist?: () => void
}

/** Setting store with $persist and setAutoLogin methods */
interface SettingStoreExtended extends PersistableStore {
  login: {
    autoLogin: boolean
  }
  setAutoLogin?: (value: boolean) => void
  closeAutoLogin?: () => void
}

/** Group store with additional methods */
interface GroupStoreExtended extends PersistableStore {
  getGroupUserList?: (roomId: string, forceRefresh?: boolean) => Promise<unknown>
  setGroupDetails?: () => Promise<unknown>
}

/** Cached store with getAllBadgeList method */
interface CachedStoreExtended extends PersistableStore {
  getAllBadgeList?: () => Promise<void>
}

/** Matrix error response interface */
interface MatrixErrorResponse {
  errcode?: string
  error?: string
  message?: string
  status?: number
  errCode?: string
  err?: string
  msg?: string
}

/** Admin user info interface */
interface AdminUserInfo {
  isAdmin?: boolean
  roleId?: string | number
  roleID?: string | number
  role?: string | number
  roles?: Array<string | number | { code?: string; name?: string; id?: string | number }>
  [key: string]: unknown
}

export const useLogin = () => {
  const { resizeWindow } = useWindow()
  const globalStore = useGlobalStore()
  const loginStore = useWsLoginStore()
  const chatStore = useChatStore()
  const settingStore = useSettingStore() as unknown as SettingStoreExtended
  const { isTrayMenuShow } = storeToRefs(globalStore)
  const groupStore = useGroupStore() as unknown as GroupStoreExtended
  const cachedStore = useCachedStore() as unknown as CachedStoreExtended
  const configStore = useConfigStore()
  const userStatusStore = useUserStatusStore()
  const userStore = useUserStore()
  const loginHistoriesStore = useLoginHistoriesStore()
  const initialSyncStore = useInitialSyncStore()
  const { createWebviewWindow } = useWindow()

  const { t } = useI18nGlobal()

  /**
   * 在 composable 初始化时获取 router 实例
   * 注意: useRouter() 必须在组件 setup 上下文中调用
   * 不能在异步回调中调用 useRouter(),因为那时已经失去了 Vue 组件上下文
   * 所以在这里提前获取并保存 router 实例,供后续异步操作使用
   */
  let router: ReturnType<typeof useRouter> | null = null
  try {
    router = useRouter()
  } catch (e) {
    logger.warn('[useLogin] 无法获取 router 实例,可能不在组件上下文中:', e instanceof Error ? e.message : String(e))
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
  const matrixErrorCode = ref<string | null>(null)
  const matrixErrorMessage = ref('')
  const matrixTimeout = ref(false)
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
    const sendLogoutEvent = async () => {
      // ws 退出连接
      await invokeSilently('ws_disconnect')
      await invokeSilently(TauriCommand.REMOVE_TOKENS)
      await invokeSilently(TauriCommand.UPDATE_USER_LAST_OPT_TIME)
    }

    if (isDesktop()) {
      const { createWebviewWindow } = useWindow()
      isTrayMenuShow.value = false
      try {
        await sendLogoutEvent()
        // 创建登录窗口
        await createWebviewWindow('登录', 'login', 320, 448, undefined, false, 320, 448)
        // 发送登出事件
        await emit(EventEnum.LOGOUT)

        // 调整托盘大小
        await resizeWindow('tray', 130, 44)
      } catch (error) {
        logger.error('创建登录窗口失败:', error)
      }
    } else {
      try {
        await sendLogoutEvent()
        // 发送登出事件
        await emit(EventEnum.LOGOUT)
      } catch (error) {
        logger.error('登出失败:', error)
        msg.error('登出失败')
      }
    }
  }

  /** 重置登录的状态 */
  const resetLoginState = async (isAutoLogin = false) => {
    // 清理消息已读计数监听器
    clearListener()
    // 1. 清理本地存储
    if (!isAutoLogin) {
      // 清理当前账号的本地存储数据
      // 支持多账号存储，使用 account_id 作为键名前缀
      const currentUser = localStorage.getItem('user')
      if (currentUser) {
        try {
          const user = JSON.parse(currentUser)
          const accountId = user.uid || 'default'
          localStorage.removeItem('user')
          localStorage.removeItem('TOKEN')
          localStorage.removeItem(`REFRESH_TOKEN_${accountId}`)
        } catch (_e) {
          // 如果解析失败，清理默认的 token
          localStorage.removeItem('user')
          localStorage.removeItem('TOKEN')
          localStorage.removeItem('REFRESH_TOKEN')
        }
      }
    }
    settingStore.closeAutoLogin?.()
    loginStore.loginStatus = LoginStatus.Init
    globalStore.updateCurrentSessionRoomId('')
    // 2. 清除系统托盘图标上的未读数
    if (isMac()) {
      await invokeWithErrorHandler('set_badge_count', { count: undefined })
    }
  }

  // 全量同步
  const runFullSync = async () => {
    await chatStore.getSessionList()
    // 重置当前选中会话，等待用户主动选择
    globalStore.updateCurrentSessionRoomId('')

    // 加载所有群的成员数据
    const groupSessions = chatStore.getGroupSessions()
    const groupPromises = groupSessions
      .map((session) => groupStore.getGroupUserList?.(session.roomId, true))
      .filter((p): p is Promise<unknown> => p !== undefined)

    await Promise.all(
      [
        ...groupPromises,
        groupStore.setGroupDetails?.(),
        chatStore.setAllSessionMsgList(20),
        cachedStore.getAllBadgeList?.()
      ].filter((p): p is Promise<unknown> => p !== undefined)
    )
  }

  // 增量同步
  const runIncrementalSync = async () => {
    // 优先保证会话列表最新消息和未读数：拉会话即可让未读/最新一条消息就绪
    await chatStore.getSessionList()
    globalStore.updateCurrentSessionRoomId('')

    // 后台同步消息：登录命令已触发一次全量/离线同步，这里避免重复拉取；仅在需要时再显式调用
    // 将消息预取和其他预热放后台，避免阻塞 UI
    await Promise.allSettled(
      [chatStore.setAllSessionMsgList(20), groupStore.setGroupDetails?.(), cachedStore.getAllBadgeList?.()].filter(
        (p): p is Promise<unknown> => p !== undefined
      )
    ).catch((error) => {
      logger.warn('[useLogin] 增量预热任务失败:', error)
    })
  }

  const init = async (options?: { isInitialSync?: boolean }) => {
    // 初始化前清空当前选中的会话，避免自动打开会话
    globalStore.updateCurrentSessionRoomId('')
    // 连接 ws
    await rustWebSocketClient.initConnect()

    // 获取用户详细信息（在 WebSocket 连接建立后）
    try {
      await userStore.getUserDetailAction()
      logger.info('[useLogin] 用户信息加载成功')
    } catch (error) {
      logger.warn('[useLogin] 用户信息加载失败，使用默认值:', error)
      // 保留现有的 userInfo 作为后备
    }

    // 用户相关数据初始化（带健壮性保护）
    userStatusStore.stateList = []
    const currentUser = userStore.userInfo
    if (currentUser && currentUser.uid) {
      // 有有效用户信息
      userStatusStore.stateId = currentUser.userStateId ?? '1'
      loginHistoriesStore.addLoginHistory(currentUser)
      const detectAdmin = (info: unknown): boolean => {
        if (!info || typeof info !== 'object') return false
        const adminInfo = info as AdminUserInfo
        if (adminInfo.isAdmin === true) return true
        const roleId = adminInfo.roleId ?? adminInfo.roleID ?? adminInfo.role
        if (typeof roleId === 'string' && /admin/i.test(roleId)) return true
        if (typeof roleId === 'number' && roleId === 1) return true
        const roles = adminInfo.roles
        if (Array.isArray(roles)) {
          return roles.some((r: unknown) => {
            const val =
              typeof r === 'string'
                ? r
                : typeof r === 'object' && r !== null
                  ? (r as { code?: string; name?: string; id?: string | number }).code ||
                    (r as { code?: string; name?: string; id?: string | number }).name ||
                    (r as { code?: string; name?: string; id?: string | number }).id ||
                    ''
                  : ''
            return /admin|管理员/i.test(String(val))
          })
        }
        return false
      }
      try {
        if (detectAdmin(currentUser)) {
          router?.replace('/admin')
        }
      } catch {}
    } else {
      // 无有效用户信息，使用登录信息
      userStatusStore.stateId = '1'
      const fallback: UserInfoType = {
        uid: '',
        account: info.value.account ?? '',
        email: '',
        name: '',
        avatar: '/logoD.png',
        password: '',
        modifyNameChance: 0,
        sex: 1,
        userStateId: '1',
        avatarUpdateTime: Date.now(),
        client: isDesktop() ? 'PC' : 'MOBILE',
        resume: ''
      }
      userStore.setUserInfo(fallback)
      try {
        loginHistoriesStore.addLoginHistory(fallback)
      } catch {}
    }

    // 在 sqlite 中存储用户信息
    await invokeWithErrorHandler(
      TauriCommand.SAVE_USER_INFO,
      {
        userInfo: currentUser
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
    const isInitialSync = options?.isInitialSync ?? !initialSyncStore.isSynced(currentUser?.uid || '')

    if (isInitialSync) {
      chatStore.syncLoading = true
      try {
        await runFullSync()
      } finally {
        chatStore.syncLoading = false
      }
    } else {
      chatStore.syncLoading = true
      try {
        await runIncrementalSync()
      } finally {
        // 增量登录仅等待会话准备好就关闭提示，后台同步继续进行
        chatStore.syncLoading = false
      }
    }
    // 强制持久化
    groupStore.$persist?.()
    chatStore.$persist?.()
    cachedStore.$persist?.()
    ;(globalStore as unknown as PersistableStore).$persist?.()

    await setLoginState()
  }

  /**
   * 根据平台类型执行不同的跳转逻辑
   * 桌面端: 创建主窗口
   * 移动端: 路由跳转到主页
   */
  const routerOrOpenHomeWindow = async () => {
    const isTauri = typeof window !== 'undefined' && '__TAURI__' in window
    if (isDesktop() && isTauri) {
      const registerWindow = await WebviewWindow.getByLabel('register')
      if (registerWindow) {
        await registerWindow.close().catch((error) => {
          logger.warn('关闭注册窗口失败:', error)
        })
      }
      await createWebviewWindow('HuLa', 'home', 960, 720, 'login', true, 330, 480, undefined, false)
      globalStore.isTrayMenuShow = true
      return
    }
    const goMobile = typeof location !== 'undefined' && location.pathname.startsWith('/mobile')
    router?.push(goMobile || isMobile() ? '/mobile/home' : '/home')
  }

  const normalLogin = async (
    deviceType: 'PC' | 'MOBILE',
    syncRecentMessages: boolean,
    auto: boolean = settingStore.login.autoLogin
  ) => {
    // 声明 isTauri 在函数开头以避免作用域问题 (使用var以获得函数作用域)
    var isTauri = typeof window !== 'undefined' && '__TAURI__' in window
    loading.value = true
    loginText.value = t('login.status.logging_in')
    loginDisabled.value = true
    const hasStoredUserInfo = !!userStore.userInfo && !!userStore.userInfo.account
    if (auto && !hasStoredUserInfo) {
      loading.value = false
      loginDisabled.value = false
      loginText.value = isOnline.value ? t('login.button.login.default') : t('login.button.login.network_error')
      uiState.value = 'manual'
      settingStore.setAutoLogin?.(false)
      logInfo('自动登录信息已失效，请手动登录')
      return
    }

    // 根据auto参数决定从哪里获取登录信息
    const loginInfo = auto && userStore.userInfo ? (userStore.userInfo as UserInfoType) : info.value
    const loginAccount = loginInfo?.account
    const loginPassword = loginInfo?.password ?? info.value.password
    if (!loginAccount) {
      loading.value = false
      loginDisabled.value = false
      loginText.value = isOnline.value ? '登录' : '网络异常'
      if (auto) {
        uiState.value = 'manual'
        settingStore.setAutoLogin?.(false)
      }
      logInfo('账号信息缺失，请重新输入')
      return
    }

    // 存储此次登陆设备指纹
    let clientId = ''
    try {
      clientId = await getEnhancedFingerprint()
    } catch (fpError) {
      logger.warn('[useLogin] 获取指纹失败，使用随机ID:', fpError)
      clientId = `fallback-${Date.now()}-${Math.random().toString(36).slice(2)}`
    }
    localStorage.setItem('clientId', clientId)

    if (isTauri) {
      await ensureAppStateReady()
    }

    // 记录登录参数（脱敏）
    const loginParams = {
      account: loginAccount,
      deviceType: deviceType,
      systemType: '2',
      clientId: clientId,
      grantType: 'PASSWORD',
      isAutoLogin: auto,
      asyncData: syncRecentMessages,
      uid: auto ? userStore.userInfo!.uid : null
    }
    logger.info('[useLogin] 发起登录请求:', loginParams)

    // Phase 1 Migration: 临时禁用自定义后端登录
    //
    // 问题说明：
    // - 服务器 nginx 配置导致登录接口返回 301 重定向
    // - 301 重定向后的请求变成 404 Not Found
    // - 这导致自定义后端登录失败
    //
    // 需要的 nginx 配置修复：
    // ```nginx
    // location /api/login {
    //     proxy_pass http://backend:3000;
    //     proxy_redirect off;
    //     proxy_set_header Host $host;
    //     proxy_set_header X-Real-IP $remote_addr;
    //     proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    //     proxy_set_header X-Forwarded-Proto $scheme;
    // }
    // ```
    //
    // 修复后需要：
    // 1. 取消下面注释的 loginPromise 代码
    // 2. 删除当前的 Promise.resolve({}) 临时方案
    // 3. 测试登录流程是否正常
    const loginPromise = Promise.resolve({}) // 暂时跳过自定义后端登录，直接使用 Matrix 登录

    // const loginPromise = isTauri
    //   ? invoke('login_command', {
    //       data: {
    //         ...loginParams,
    //         password: loginPassword
    //       }
    //     })
    //   : Promise.resolve({})

    loginPromise
      .then(async (response: unknown) => {
        try {
          if (response && typeof response === 'object') {
            const tokenResponse = response as { token?: string; refreshToken?: string }
            const t = tokenResponse.token
            const r = tokenResponse.refreshToken
            if (t && r) {
              localStorage.setItem('TOKEN', t)
              localStorage.setItem('REFRESH_TOKEN', r)
              try {
                await invoke(TauriCommand.UPDATE_TOKEN, { token: t, refreshToken: r })
              } catch {}
            }
          }
        } catch {}
        loginDisabled.value = true
        loading.value = false
        loginText.value = t('login.status.success_redirect')

        // 仅在移动端的首次手动登录时，才默认打开自动登录开关
        if (!auto && isMobile()) {
          settingStore.setAutoLogin?.(true)
        }

        // 移动端登录之后，初始化数据
        if (isMobile()) {
          await init()
          if (isTauri) {
            await invoke('hide_splash_screen') // 初始化完再关闭启动页
          }
        }
        ;+useMitt.emit(MittEnum.MSG_INIT)

        if (isTauri && isMobile()) {
          try {
            for (let i = 0; i < 10; i++) {
              const tokens = await invoke<{ token: string | null; refreshToken: string | null }>(
                TauriCommand.GET_USER_TOKENS
              ).catch(() => null)
              if (tokens && tokens.token && tokens.refreshToken) break
              await new Promise((r) => setTimeout(r, 150))
            }
          } catch {}
        }
        // 先进行 Matrix 登录与管理员判定，再做页面路由

        const detectAdmin = (info: unknown): boolean => {
          if (!info || typeof info !== 'object') return false
          const obj = info as Record<string, unknown>
          if (obj.isAdmin === true) return true
          const roleId = obj.roleId ?? obj.roleID ?? obj.role
          if (typeof roleId === 'string' && /admin/i.test(roleId)) return true
          if (typeof roleId === 'number' && roleId === 1) return true
          const roles = obj.roles
          if (Array.isArray(roles)) {
            return roles.some((r: unknown) => {
              const roleObj = typeof r === 'string' ? r : (r as Record<string, unknown>)
              const val =
                typeof r === 'string'
                  ? r
                  : (roleObj as Record<string, unknown>).code ||
                    (roleObj as Record<string, unknown>).name ||
                    (roleObj as Record<string, unknown>).id ||
                    ''
              return /admin|管理员/i.test(String(val))
            })
          }
          const acct = String(obj.account || '')
          const uidVal = String(obj.uid || '')
          if (ADMIN_ACCOUNTS.includes(acct) || ADMIN_ACCOUNTS.includes(uidVal)) return true
          return false
        }

        try {
          const merged = userStore.userInfo
          if (detectAdmin(merged)) {
            router?.replace('/admin')
          }
        } catch {}
        try {
          localStorage.removeItem('LOGIN_IN_PROGRESS')
        } catch {}

        let matrixOk = false
        // Phase 1 Migration: 检查是否需要Matrix登录
        const requireMatrixLogin = import.meta.env.VITE_REQUIRE_MATRIX_LOGIN === 'true'

        if (requireMatrixLogin) {
          try {
            const { loginMatrix, store: matrixStore } = useMatrixAuth()

            // 快速初始化服务器URL（已优化，带缓存）
            if (!matrixStore.getHomeserverBaseUrl()) {
              matrixStore.setDefaultBaseUrlFromEnv()
            }
            if (!matrixStore.getHomeserverBaseUrl()) {
              await matrixStore.discover()
            }
            const hsUrl = matrixStore.getHomeserverBaseUrl() || ''

            let host = ''
            try {
              host = new URL(hsUrl).host || ''
            } catch {}

            const needsFormat = !(loginAccount?.startsWith('@') && loginAccount.includes(':'))
            const mxid = needsFormat ? `@${(loginAccount || '').split(':')[0]}:${host}` : loginAccount

            // 使用优化后的 loginMatrix（内部已包含超时和错误处理）
            const withTimeout = <T>(p: Promise<T>, ms = 20000) =>
              new Promise<T>((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error('登录超时，请检查网络连接')), ms)
                p.then((v) => {
                  clearTimeout(timer)
                  resolve(v)
                }).catch((e) => {
                  clearTimeout(timer)
                  reject(e)
                })
              })

            // 登录重试（最多3次，指数退避），对超时/网络错误/429/5xx进行重试
            const retryLogin = async () => {
              const attempts = 3
              let delay = 300
              for (let i = 0; i < attempts; i++) {
                try {
                  await withTimeout(loginMatrix(mxid, loginPassword))
                  return
                } catch (err: unknown) {
                  const m = err instanceof Error ? String(err.message || '').toLowerCase() : ''
                  const status = err && typeof err === 'object' && 'status' in err ? Number(err.status) || 0 : 0
                  const shouldRetry =
                    m.includes('timeout') ||
                    m.includes('aborted') ||
                    m.includes('network') ||
                    m.includes('fetch') ||
                    status === 429 ||
                    status >= 500
                  if (!shouldRetry || i === attempts - 1) {
                    throw err
                  }
                  await new Promise((r) => setTimeout(r, delay + Math.floor(Math.random() * 150)))
                  delay *= 2
                }
              }
            }

            const loginTimer = createTimer('general')
            loginTimer.start('matrix_login')
            await retryLogin()
            loginTimer.end('matrix_login', { attempts: '≤3' })
            matrixOk = true
            matrixErrorCode.value = null
            matrixErrorMessage.value = ''
            matrixTimeout.value = false
            logger.info('[Login] Matrix 登录成功')
          } catch (e) {
            try {
              const loginTimer = createTimer('general')
              loginTimer.end('matrix_login', { result: 'fail' })
            } catch {}
            logger.warn('[Login] Matrix 登录失败:', e instanceof Error ? e.message : String(e))
            matrixOk = false
            const errMsg = (() => {
              const raw = e as Error | MatrixErrorResponse
              const isMatrixError = typeof raw === 'object' && 'errcode' in raw
              const m = raw instanceof Error ? String(raw.message || '').toLowerCase() : ''

              // 超时错误
              if (m.includes('timeout') || m.includes('aborted') || m.includes('超时')) {
                matrixTimeout.value = true
                matrixErrorCode.value = 'TIMEOUT'
                return '登录超时，请检查网络连接后重试'
              }

              // 认证错误
              if (isMatrixError && (raw as MatrixErrorResponse).errcode === 'M_FORBIDDEN') {
                matrixErrorCode.value = 'M_FORBIDDEN'
                // Phase 1 Migration: 提示用户可能需要注册 Matrix 账户
                return '账号或密码错误。如果您使用的是自定义后端账户，请先注册 Matrix 账户，或在设置中禁用 Matrix 登录要求。'
              }

              if (isMatrixError && (raw as MatrixErrorResponse).errcode === 'M_INVALID_USERNAME') {
                matrixErrorCode.value = 'M_INVALID_USERNAME'
                return '用户名格式错误，应为 @用户名:服务器域名 格式'
              }

              if (isMatrixError && (raw as MatrixErrorResponse).errcode === 'M_USER_IN_USE') {
                matrixErrorCode.value = 'M_USER_IN_USE'
                return '用户名已被使用，请选择其他用户名'
              }

              if (isMatrixError && (raw as MatrixErrorResponse).errcode === 'M_LIMIT_EXCEEDED') {
                matrixErrorCode.value = 'M_LIMIT_EXCEEDED'
                return '登录尝试次数过多，请稍后重试'
              }

              // 网络错误
              if (m.includes('network') || m.includes('fetch') || m.includes('failed') || m.includes('unavailable')) {
                matrixErrorCode.value = 'NETWORK'
                return 'Matrix 服务器不可用，请检查网络连接或联系管理员'
              }

              if (m.includes('cors') || m.includes('cross-origin')) {
                matrixErrorCode.value = 'CORS'
                return '跨域请求被阻止，请联系服务器管理员配置 CORS'
              }

              // HTTP 状态码错误
              if (isMatrixError && 'status' in raw) {
                const status = Number((raw as MatrixErrorResponse).status) || 0
                if (status === 401) {
                  matrixErrorCode.value = 'UNAUTHORIZED'
                  return '认证失败，请检查用户名和密码'
                }
                if (status === 403) {
                  matrixErrorCode.value = 'FORBIDDEN'
                  return '访问被拒绝，账号可能被禁用'
                }
                if (status === 404) {
                  matrixErrorCode.value = 'NOT_FOUND'
                  return 'Matrix 服务器地址不正确或服务不存在'
                }
                if (status >= 500) {
                  matrixErrorCode.value = 'SERVER_ERROR'
                  return 'Matrix 服务器内部错误，请稍后重试'
                }
              }

              // 默认错误信息
              const errCode = isMatrixError ? (raw as MatrixErrorResponse).errcode : undefined
              matrixErrorCode.value = errCode || 'UNKNOWN'
              const errorMsg = isMatrixError
                ? (raw as MatrixErrorResponse).error || (raw as MatrixErrorResponse).message
                : raw instanceof Error
                  ? raw.message
                  : ''
              return `登录失败: ${errorMsg || String(e)}`
            })()
            matrixErrorMessage.value = errMsg
            loginDisabled.value = false
            loginText.value = t('login.button.login.default')

            // 启用调试工具进行问题诊断
            try {
              logger.info('[Login] 启用登录诊断工具...')
              const debugInfo = await MatrixLoginDebugger.diagnoseLogin(loginAccount || '', loginPassword || '')
              const report = MatrixLoginDebugger.generateReport(debugInfo)
              logger.info('[Login] 诊断报告:\n' + report)

              // 如果是开发环境，将诊断信息输出到控制台
              if (import.meta.env.DEV) {
                console.group('🔍 Matrix 登录诊断信息')
                console.groupEnd()
              }
            } catch (debugError) {
              logger.warn('[Login] 诊断工具执行失败:', debugError)
            }
          } // 关闭 catch (e) 块
        } // 关闭 if (requireMatrixLogin) 块
        else {
          // Phase 1 Migration: Matrix登录被跳过
          logger.info('[Login] Phase 1 Migration: Matrix登录已跳过 (VITE_REQUIRE_MATRIX_LOGIN=false)')
          matrixOk = false // 但不阻止登录流程
          matrixErrorMessage.value = ''
          matrixTimeout.value = false
        }

        // Web 环境必须校验成功才能进入主页
        // isTauri 已在函数开头声明 (line 406)
        if (!isTauri && !matrixOk && requireMatrixLogin) {
          msg.error(`Matrix 登录失败：${matrixErrorMessage.value}`)
        }

        // 如果未被 Matrix 登录流程导航（如管理员已进入 /admin），则进入首页
        try {
          const path = location?.pathname || ''
          // isTauri 已在函数开头声明 (line 406)
          // 非管理员且 Web 环境下 Matrix 登录失败，则不导航
          if (!path.startsWith('/admin') && !path.startsWith('/mobile/chatRoom') && !path.startsWith('/message')) {
            const importMetaEnv = (import.meta as { env?: { VITE_ALLOW_LOGIN_WITHOUT_MATRIX?: string } }).env
            const allowFallback = String(importMetaEnv?.VITE_ALLOW_LOGIN_WITHOUT_MATRIX || '') === 'true'
            if (isTauri || matrixOk || allowFallback) {
              await routerOrOpenHomeWindow()
            }
          }
        } catch {}
      })
      .catch((e: unknown) => {
        // 尝试解析详细错误信息
        let errorDetail = String(e)
        try {
          if (typeof e === 'object' && e !== null) {
            errorDetail = JSON.stringify(e)
          }
        } catch {}

        logger.error('登录异常详情: ' + errorDetail, e)

        msg.error(String(e))
        loading.value = false
        loginDisabled.value = false
        loginText.value = t('login.button.login.default')
        if (isMobile()) {
          msg.warning('登录失败，可尝试重试 Matrix 登录或更换服务器')
        }
        // 如果是自动登录失败，切换到手动登录界面并重置按钮状态
        if (auto) {
          uiState.value = 'manual'
          loginDisabled.value = false
          loginText.value = t('login.button.login.default')
          // 取消自动登录
          settingStore.setAutoLogin?.(false)
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

  return {
    resetLoginState,
    setLoginState,
    logout,
    normalLogin,
    loading,
    loginText,
    loginDisabled,
    info,
    uiState,
    init,
    matrixErrorMessage,
    matrixErrorCode,
    matrixTimeout
  }
}
try {
  localStorage.setItem('LOGIN_IN_PROGRESS', '1')
} catch {}
