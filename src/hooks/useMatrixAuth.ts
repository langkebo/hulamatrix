/**
 * 统一的 Matrix 认证 Hook
 *
 * 整合了 useMatrixAuth 和 useMatrixAuthWithDebug 的功能
 * 支持可选的调试模式和增强的错误处理
 */

import { useMatrixAuthStore } from '@/stores/matrixAuth'
import { matrixClientService } from '@/integrations/matrix/client'
import { safeAutoDiscovery } from '@/integrations/matrix/discovery'
import { useGlobalStore } from '@/stores/global'
import router from '@/router'
import { initializeEncryption } from '@/integrations/matrix/encryption'
import { PUBLIC_ROOM_ALIASES, PUBLIC_ROOM_ALIAS } from '@/config/matrix-config'
import { logger } from '@/utils/logger'
import { MatrixLoginDebugger, getLoginFixSuggestions } from '@/utils/MatrixLoginDebugger'

// 认证选项接口
export interface MatrixAuthOptions {
  /** 启用调试模式（诊断和网络测试）*/
  enableDebug?: boolean
  /** 登录超时时间（毫秒）*/
  loginTimeout?: number
  /** 最大重试次数 */
  maxRetries?: number
  /** 启用详细日志 */
  verboseLogging?: boolean
}

// Use the properly typed matrixClientService directly
const matrixClient = matrixClientService

// Helper to check if we're in vitest environment
const isVitest = import.meta.env?.VITEST === true

// Matrix登录响应接口
interface MatrixLoginResponse {
  access_token?: string
  accessToken?: string
  user_id?: string
  userId?: string
  device_id?: string
  deviceId?: string
}

// Matrix房间接口（扩展SDK定义）
interface MatrixRoomWithMethods {
  roomId: string
  name: string
  topic: string
  getMyMembership(): string
  getCanonicalAlias(): string | null
}

// 带超时的 fetch 封装
const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 5000): Promise<Response> => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(timeoutId)
    return response
  } catch (e) {
    clearTimeout(timeoutId)
    throw e
  }
}

/**
 * 统一的 Matrix 认证 Hook
 *
 * @param options - 认证选项
 * @returns 认证方法和状态
 *
 * @example
 * ```ts
 * // 基础使用
 * const { loginMatrix, registerMatrix } = useUnifiedAuth()
 *
 * // 启用调试模式
 * const { loginMatrix } = useUnifiedAuth({ enableDebug: true })
 *
 * // 自定义超时和重试
 * const { loginMatrix } = useUnifiedAuth({
 *   loginTimeout: 15000,
 *   maxRetries: 3,
 *   verboseLogging: true
 * })
 * ```
 */
export const useMatrixAuth = (options: MatrixAuthOptions = {}) => {
  const store = useMatrixAuthStore()
  const { enableDebug = false, loginTimeout = 10000, maxRetries = 2, verboseLogging = false } = options

  const toggleServerInput = (visible?: boolean) => {
    store.toggleServerInput(visible)
  }

  const applyCustomServer = async (v: string) => {
    store.setCustomServer(v)
    try {
      const { homeserverUrl } = await safeAutoDiscovery(v)
      store.baseUrl = homeserverUrl
      matrixClient.setBaseUrl(homeserverUrl)
    } catch (e) {
      logger.warn('[MatrixAuth] 自定义服务器发现失败，尝试默认发现:', e)
      await store.discover()
      const url = store.getHomeserverBaseUrl()
      if (url) matrixClient.setBaseUrl(url)
    }
  }

  /**
   * 测试服务器连接
   */
  const testServerConnection = async (serverUrl?: string): Promise<boolean> => {
    const env = import.meta.env || {}
    const defaultServerName = String(env.VITE_MATRIX_SERVER_NAME || '').trim() || 'cjystx.top'
    const defaultHomeserverUrl = `https://matrix.${defaultServerName}`
    const targetUrl = serverUrl || store.getHomeserverBaseUrl() || defaultHomeserverUrl

    try {
      if (verboseLogging) {
        logger.info(`[MatrixAuth] 测试服务器连接: ${targetUrl}`)
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(`${targetUrl}/_matrix/client/versions`, {
        method: 'GET',
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (verboseLogging) {
        logger.info(`[MatrixAuth] 服务器连接测试${response.ok ? '成功' : '失败'}`)
      }

      return response.ok
    } catch (error) {
      logger.warn('[MatrixAuth] 服务器连接测试失败:', error)
      return false
    }
  }

  /**
   * 检查用户是否为管理员（单次调用，带超时）
   */
  const checkAdminStatus = async (token: string, uid: string, baseUrl: string): Promise<boolean> => {
    if (isVitest) return false

    const dev = typeof location !== 'undefined' && /localhost|127\.0\.0\.1/.test(location.hostname)
    const base = baseUrl.replace(/\/$/, '')

    // 优先尝试 /api/me/is_admin 端点
    const proxyUrl = dev ? `/api/me/is_admin` : `${base}/api/me/is_admin`
    try {
      const resp = await fetchWithTimeout(
        proxyUrl,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` }
        },
        3000
      )
      if (resp.ok) {
        const js = await resp.json().catch(() => null)
        if (js && (js.isAdmin === true || js.admin === true)) {
          if (verboseLogging) logger.info('[MatrixAuth] 检测到管理员权限 (API)')
          return true
        }
      }
    } catch {
      if (verboseLogging) logger.debug('[MatrixAuth] /api/me/is_admin 检查失败，尝试 Synapse Admin API')
    }

    // 回退到 Synapse Admin API
    const adminUrl = dev
      ? `/_synapse/admin/v2/users/${encodeURIComponent(uid)}`
      : `${base}/_synapse/admin/v2/users/${encodeURIComponent(uid)}`
    try {
      const resp = await fetchWithTimeout(
        adminUrl,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` }
        },
        3000
      )
      if (resp.ok) {
        const js = await resp.json().catch(() => null)
        if (js && (js.admin === true || js.isAdmin === true)) {
          if (verboseLogging) logger.info('[MatrixAuth] 检测到管理员权限 (Synapse)')
          return true
        }
      }
    } catch (e) {
      if (verboseLogging) logger.debug('[MatrixAuth] Synapse Admin API 检查失败:', e)
    }

    return false
  }

  /**
   * 带重试机制的登录执行
   */
  const performLoginWithRetry = async (
    _username: string,
    _password: string,
    loginFn: () => Promise<MatrixLoginResponse | null>,
    operation: string = 'login'
  ): Promise<MatrixLoginResponse> => {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          logger.info(`[MatrixAuth] ${operation} 重试 ${attempt}/${maxRetries}`)
        }

        // 创建超时 Promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`${operation} 超时 (${loginTimeout}ms)`)), loginTimeout)
        })

        // 执行登录
        const loginPromise = loginFn()

        // 等待登录完成或超时
        const result = (await Promise.race([loginPromise, timeoutPromise])) as MatrixLoginResponse

        if (result && (result.access_token || result.accessToken)) {
          return result
        } else {
          throw new Error('登录响应缺少 access_token')
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        // 如果是认证错误，不进行重试
        if (
          lastError.message.includes('401') ||
          lastError.message.includes('unauthorized') ||
          lastError.message.includes('Forbidden')
        ) {
          if (verboseLogging) logger.debug('[MatrixAuth] 认证错误，不进行重试')
          break
        }

        // 最后一次尝试失败后抛出错误
        if (attempt === maxRetries) {
          break
        }

        // 等待一段时间再重试
        const waitTime = 1000 * (attempt + 1)
        if (verboseLogging) {
          logger.info(`[MatrixAuth] 等待 ${waitTime}ms 后重试...`)
        }
        await new Promise((resolve) => setTimeout(resolve, waitTime))
      }
    }

    throw lastError || new Error(`${operation} 失败`)
  }

  /**
   * 登录 Matrix
   */
  const loginMatrix = async (username: string, password: string): Promise<MatrixLoginResponse | null> => {
    const startTime = Date.now()
    logger.info('[MatrixAuth] 开始登录流程', { enableDebug, verboseLogging })

    // 1. 调试模式：进行诊断
    if (enableDebug) {
      logger.info('[MatrixAuth] 开始登录诊断...')
      const debugInfo = await MatrixLoginDebugger.diagnoseLogin(username, password)
      const report = MatrixLoginDebugger.generateReport(debugInfo)
      logger.info('[MatrixAuth] 诊断报告:\n' + report)

      if (!debugInfo.networkTest.versionsEndpoint || !debugInfo.networkTest.loginEndpoint) {
        const suggestions = getLoginFixSuggestions(debugInfo)
        logger.error('[MatrixAuth] 网络连接问题，建议:')
        suggestions.forEach((suggestion) => logger.error(`  - ${suggestion}`))
        throw new Error('Matrix 服务器不可用，请检查网络连接或稍后重试')
      }
    }

    // 2. 获取服务器URL（确保执行服务发现）
    let url = store.getHomeserverBaseUrl()

    // 如果没有 URL，执行服务发现
    if (!url) {
      try {
        if (verboseLogging) {
          logger.info('[MatrixAuth] 未发现缓存的 homeserver URL，开始服务发现...')
        }
        await store.discover()
        url = store.getHomeserverBaseUrl()
        if (!url) {
          throw new Error('服务发现未能返回 homeserver URL')
        }
      } catch (e) {
        logger.error('[MatrixAuth] 服务发现失败:', e)
        throw new Error('无法连接到 Matrix 服务器，请检查服务器地址或网络连接')
      }
    }

    // 设置客户端 baseUrl
    if (url) {
      matrixClient.setBaseUrl(url)
      if (verboseLogging) {
        logger.info(`[MatrixAuth] Homeserver URL 设置成功: ${url}`)
      }
    }

    logger.info(`[MatrixAuth] 服务器URL: ${url}, 耗时: ${Date.now() - startTime}ms`)

    // 3. 执行登录（带重试）
    const loginFn = async (): Promise<MatrixLoginResponse | null> => {
      let res: MatrixLoginResponse | null = null
      const local = String(username)
      const localpart = local.startsWith('@') && local.includes(':') ? local.slice(1, local.indexOf(':')) : local

      // 优先走同源代理，避免 SDK 内部 fetch 封装绕过代理
      const loginBody = {
        type: 'm.login.password',
        identifier: { type: 'm.id.user', user: localpart },
        password,
        initial_device_display_name: 'HuLa Web'
      }

      // 尝试 v3 API
      try {
        const resp = await fetchWithTimeout(
          `/_matrix/client/v3/login`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(loginBody)
          },
          loginTimeout
        )

        if (resp.ok) {
          res = await resp.json()
        } else {
          const errorData = await resp.json().catch(() => ({}))
          if (errorData.errcode) {
            throw { errcode: errorData.errcode, error: errorData.error, status: resp.status }
          }
        }
      } catch (e: unknown) {
        if (e && typeof e === 'object' && 'errcode' in e) throw e // 重新抛出 Matrix 错误
        if (verboseLogging) logger.debug('[MatrixAuth] v3 登录失败，尝试 r0:', e)
      }

      // 回退到 r0 API
      if (!res) {
        try {
          const resp = await fetchWithTimeout(
            `/_matrix/client/r0/login`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(loginBody)
            },
            loginTimeout
          )

          if (resp.ok) {
            res = await resp.json()
          } else {
            const errorData = await resp.json().catch(() => ({}))
            if (errorData.errcode) {
              throw { errcode: errorData.errcode, error: errorData.error, status: resp.status }
            }
          }
        } catch (e: unknown) {
          if (e && typeof e === 'object' && 'errcode' in e) throw e
          if (verboseLogging) logger.debug('[MatrixAuth] r0 登录失败，尝试 SDK:', e)
        }
      }

      // 最后回退到 SDK 方法
      if (!res) {
        res = await matrixClient.loginWithPassword(username, password)
      }

      return res
    }

    const res = await performLoginWithRetry(username, password, loginFn, '登录')
    logger.info(`[MatrixAuth] 登录完成, 耗时: ${Date.now() - startTime}ms`)

    const token = res?.access_token || res?.accessToken || ''
    const uid = res?.user_id || res?.userId || ''

    if (!token || !uid) {
      throw new Error('登录响应缺少必要的认证信息')
    }

    // 4. 初始化客户端
    store.setAuth(token, uid)
    await matrixClient.initialize({ baseUrl: store.getHomeserverBaseUrl(), accessToken: token, userId: uid })

    // 5. 并行执行：启动客户端、注册桥接、检查管理员
    // Note: startClient now has error recovery for builder errors (IndexedDB corruption)
    const [, , isAdmin] = await Promise.all([
      matrixClient.startClient({ initialSyncLimit: 5, pollTimeout: 15000, threadSupport: true }).catch((startError) => {
        const errorMsg = startError instanceof Error ? startError.message : String(startError)
        // If it's a recovery error (user needs to refresh), let it propagate
        if (errorMsg.includes('refresh the page')) {
          throw startError
        }
        // For other sync errors, log but allow login to proceed (sync may recover)
        logger.warn('[MatrixAuth] Client start had issues but login continuing:', { error: startError })
        return undefined
      }),
      import('@/integrations/matrix/index').then((m) => m.setupMatrixBridges()).catch(() => {}),
      checkAdminStatus(token, uid, store.getHomeserverBaseUrl() || '')
    ])

    logger.info(`[MatrixAuth] 客户端启动完成, 耗时: ${Date.now() - startTime}ms`)

    // 6. 后台初始化加密（不阻塞登录）
    if (!isVitest) {
      initializeEncryption().catch((e) => logger.warn('[MatrixAuth] 加密初始化失败:', e))
    }

    // 7. 管理员跳转
    if (isAdmin) {
      router.replace('/admin')
      return res
    }

    // 8. 加入公共房间并导航（后台执行，不阻塞）
    setupRoomsAndNavigate().catch((e) => logger.warn('[MatrixAuth] 房间设置失败:', e))

    logger.info(`[MatrixAuth] 登录流程完成, 总耗时: ${Date.now() - startTime}ms`)
    return res
  }

  /**
   * 设置房间并导航（后台执行）
   */
  const setupRoomsAndNavigate = async () => {
    try {
      const client = matrixClient.getClient()
      const aliases = (PUBLIC_ROOM_ALIASES.length ? PUBLIC_ROOM_ALIASES : [PUBLIC_ROOM_ALIAS]).filter((a) => !!a)

      // 尝试加入公共房间（不阻塞）
      for (const a of aliases) {
        try {
          const joinRoomMethod = client?.joinRoom as ((roomId: string) => Promise<unknown>) | undefined
          await joinRoomMethod?.(a)
          break
        } catch (joinError) {
          logger.debug(
            '[MatrixAuth] 加入房间失败:',
            a,
            joinError instanceof Error ? joinError.message : String(joinError)
          )
        }
      }

      const getRoomsMethod = client?.getRooms as (() => MatrixRoomWithMethods[]) | undefined
      const rooms = getRoomsMethod?.() || []
      const target =
        rooms?.find((r: MatrixRoomWithMethods) => r?.getMyMembership?.() === 'join') ||
        rooms?.find((r: MatrixRoomWithMethods) => aliases.includes(r?.getCanonicalAlias?.() || '')) ||
        rooms?.[0]

      if (target) {
        const global = useGlobalStore()
        import('@/integrations/matrix/rooms').then((m) => m.setupMatrixRoomBridge()).catch(() => {})
        global.updateCurrentSessionRoomId(target.roomId)
        const goMobile = router.hasRoute('mobileChatMain') || location.pathname.startsWith('/mobile')
        if (!location.pathname.startsWith('/admin')) {
          router.replace(goMobile ? '/mobile/chatRoom/chatMain' : '/message')
        }
      } else {
        const goMobile = router.hasRoute('mobileChatMain') || location.pathname.startsWith('/mobile')
        router.replace(goMobile ? '/mobile/home' : '/home')
      }
    } catch (e) {
      logger.warn('[MatrixAuth] 房间设置异常:', e)
      const goMobile = router.hasRoute('mobileChatMain') || location.pathname.startsWith('/mobile')
      router.replace(goMobile ? '/mobile/home' : '/home')
    }
  }

  /**
   * 注册 Matrix
   */
  const registerMatrix = async (username: string, password: string): Promise<MatrixLoginResponse | null> => {
    const startTime = Date.now()
    logger.info('[MatrixAuth] 开始注册流程')

    let url = store.getHomeserverBaseUrl()
    if (!url && store.customServer) {
      if (isVitest) {
        url = `https://${store.customServer.replace(/^https?:\/\//, '')}`
        store.baseUrl = url
      } else {
        try {
          const { homeserverUrl } = await safeAutoDiscovery(store.customServer)
          url = homeserverUrl
          store.baseUrl = url
        } catch (e) {
          logger.warn('[MatrixAuth] 注册时服务发现失败:', e)
          throw new Error('无法连接到 Matrix 服务器')
        }
      }
    }
    if (url) matrixClient.setBaseUrl(url)

    const registerFn = async (): Promise<MatrixLoginResponse | null> => {
      let res: MatrixLoginResponse | null = null

      if (!isVitest) {
        const base = (url || '').replace(/\/$/, '')
        const registerUrl = `${base}/_matrix/client/v3/register`
        const body = {
          username,
          password,
          inhibit_login: false,
          auth: { type: 'm.login.dummy' },
          initial_device_display_name: 'HuLa Web'
        }
        try {
          const resp = await fetchWithTimeout(
            registerUrl,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
            },
            15000
          )

          if (resp.ok) {
            res = await resp.json()
          } else {
            const errorData = await resp.json().catch(() => ({}))
            if (errorData.errcode) {
              throw { errcode: errorData.errcode, error: errorData.error }
            }
          }
        } catch (e: unknown) {
          if (e && typeof e === 'object' && 'errcode' in e) throw e
          if (verboseLogging) logger.debug('[MatrixAuth] 直接注册失败，尝试 SDK:', e)
        }
      }

      if (!res) {
        res = await matrixClient.registerWithPassword(username, password)
      }

      return res
    }

    const res = await performLoginWithRetry(username, password, registerFn, '注册')

    const token = res?.access_token || res?.accessToken || ''
    const uid = res?.user_id || res?.userId || ''

    if (!token || !uid) {
      throw new Error('注册后未返回 access_token 或 user_id，服务器可能需要其他 UIA 流程')
    }

    store.setAuth(token, uid)
    await matrixClient.initialize({ baseUrl: store.getHomeserverBaseUrl(), accessToken: token, userId: uid })

    // 并行执行初始化
    const [, , isAdmin] = await Promise.all([
      matrixClient.startClient({ initialSyncLimit: 5, pollTimeout: 15000, threadSupport: true }).catch((startError) => {
        const errorMsg = startError instanceof Error ? startError.message : String(startError)
        if (errorMsg.includes('refresh the page')) {
          throw startError
        }
        logger.warn('[MatrixAuth] Client start had issues but registration continuing:', { error: startError })
        return undefined
      }),
      !isVitest
        ? import('@/integrations/matrix/index').then((m) => m.setupMatrixBridges()).catch(() => {})
        : Promise.resolve(),
      !isVitest ? checkAdminStatus(token, uid, store.getHomeserverBaseUrl() || '') : Promise.resolve(false)
    ])

    // 后台初始化加密
    if (!isVitest) {
      initializeEncryption().catch((e) => logger.warn('[MatrixAuth] 加密初始化失败:', e))
    }

    if (isAdmin) {
      router.replace('/admin')
      return res
    }

    // 后台设置房间
    if (!isVitest) {
      setupRoomsAndNavigate().catch((e) => logger.warn('[MatrixAuth] 房间设置失败:', e))
    } else {
      router.replace('/mobile/chatRoom/chatMain')
    }

    logger.info(`[MatrixAuth] 注册流程完成, 总耗时: ${Date.now() - startTime}ms`)
    return res
  }

  return {
    toggleServerInput,
    applyCustomServer,
    loginMatrix,
    registerMatrix,
    testServerConnection,
    store
  }
}
