import { invoke } from '@tauri-apps/api/core'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
// WebSocket 已废弃，使用 Matrix SDK
import { SexEnum } from '../enums'
import { useLogin } from '../hooks/useLogin'
import { useWindow } from '../hooks/useWindow'
import { useLoginHistoriesStore } from '../stores/loginHistory'
import { useSettingStore } from '../stores/setting'
import { useUserStore } from '../stores/user'
import { useUserStatusStore } from '../stores/userStatus'
import { requestWithFallback } from '@/utils/MatrixApiBridgeAdapter'
import { getEnhancedFingerprint } from './fingerprint'
import { ensureAppStateReady } from '@/utils/AppStateReady'
import type { UserInfoType } from './types'
import { logger } from '@/utils/logger'

/** 登录响应接口 */
interface LoginResponse {
  token: string
  refreshToken: string
  client: string
}

/** 扩展的用户信息接口，包含可选属性 */
interface UserInfoTypeExtended extends UserInfoType {
  power?: number
  phone?: string
  wearingItemId?: string
  itemIds?: string[]
}

/** 用户详情响应接口 */
interface UserDetailResponse {
  userStateId: string | number
  uid?: string | number
  account?: string | number
  email?: string
  avatar?: string
  nickname?: string
  name?: string
  signature?: string
  sex?: string | number
  birthday?: string
  [key: string]: unknown
}

export type Settings = {
  database: {
    sqlite_file: string
  }
  backend: {
    base_url: string
    ws_url: string
  }
  youdao: {
    app_key: string
    app_secret: string
  }
  tencent: {
    api_key: string
    secret_id: string
    map_key: string
  }
  ice_server: {
    urls: string[]
    username: string
    credential: string
  }
}

export type UpdateSettingsParams = {
  baseUrl: string
  wsUrl: string
}

export const getSettings = async (): Promise<Settings> => {
  return await invoke('get_settings')
}

export const updateSettings = async (settings: UpdateSettingsParams) => {
  return await invoke('update_settings', { settings })
}

export const loginCommand = async (
  info: Partial<{
    account: string
    password: string
    avatar: string
    name: string
    uid: string
  }>,
  auto: boolean = false
) => {
  const userStore = useUserStore()
  const settingStore = useSettingStore()

  const loginInfo = settingStore.login.autoLogin ? (userStore.userInfo as UserInfoType) : info
  // 存储此次登陆设备指纹
  const clientId = await getEnhancedFingerprint()

  await ensureAppStateReady()

  await invoke('login_command', {
    data: {
      account: loginInfo.account ? loginInfo.account : '',
      password: loginInfo.password ? loginInfo.password : '',
      deviceType: 'PC',
      systemType: '2',
      clientId: clientId,
      grantType: 'PASSWORD',
      isAutoLogin: auto,
      asyncData: false,
      uid: info.uid
    }
  }).then(async (res: unknown) => {
    // WebSocket 已废弃，使用 Matrix SDK
    logger.info('Using Matrix SDK for communication (WebSocket removed)')

    const loginRes = res as LoginResponse
    await loginProcess(loginRes.token, loginRes.refreshToken, loginRes.client)
  })
}

const loginProcess = async (_token: string, _refreshToken: string, client: string) => {
  const userStatusStore = useUserStatusStore()
  const userStore = useUserStore()
  const loginHistoriesStore = useLoginHistoriesStore()
  const { setLoginState } = useLogin()

  userStatusStore.stateList = (await requestWithFallback({ url: 'get_all_user_state' })) as {
    bgColor?: string
    id: string
    title: string
    url: string
  }[]

  const userDetail: UserDetailResponse = (await requestWithFallback({ url: 'get_user_info' })) as UserDetailResponse
  userStatusStore.stateId = String(userDetail.userStateId)

  // Create the account object without the optional power property
  const account: UserInfoType = {
    uid: String(userDetail.uid || userDetail.userStateId || ''),
    account: String(userDetail.account || userDetail.uid || userDetail.userStateId || ''),
    email: String(userDetail.email || ''),
    avatar: String(userDetail.avatar || ''),
    name: String(userDetail.nickname || userDetail.name || ''),
    password: '',
    modifyNameChance: 0,
    sex: (userDetail.sex as SexEnum) || SexEnum.MAN,
    userStateId: String(userDetail.userStateId || ''),
    avatarUpdateTime: Date.now(),
    client,
    resume: String(userDetail.signature || '')
  }

  // Add optional properties separately to avoid exactOptionalPropertyTypes issues
  const accountExtended = account as UserInfoTypeExtended
  if (userDetail.power !== undefined && userDetail.power !== null) {
    accountExtended.power = Number(userDetail.power)
  }
  if (userDetail.phone) {
    accountExtended.phone = String(userDetail.phone)
  }
  if (userDetail.wearingItemId) {
    accountExtended.wearingItemId = String(userDetail.wearingItemId)
  }
  if (userDetail.itemIds) {
    accountExtended.itemIds = userDetail.itemIds as string[]
  }
  userStore.userInfo = account

  loginHistoriesStore.addLoginHistory(account)

  // SAVE_USER_INFO 命令已在 Phase 4 清理时移除
  // 用户信息现在通过 Pinia store 持久化存储
  // await invokeWithErrorHandler(
  //   TauriCommand.SAVE_USER_INFO,
  //   {
  //     userInfo: userDetail
  //   },
  //   {
  //     customErrorMessage: '保存用户信息失败',
  //     errorType: ErrorType.Client
  //   }
  // )

  await setLoginState()
  await openHomeWindow()
}

const openHomeWindow = async () => {
  const { createWebviewWindow } = useWindow()
  const registerWindow = await WebviewWindow.getByLabel('register')
  if (registerWindow) {
    await registerWindow.close().catch((error) => {
      logger.warn('关闭注册窗口失败:', error)
    })
  }
  await createWebviewWindow('HuLa', 'home', 960, 720, 'login', true, 330, 480, undefined, false)
}
