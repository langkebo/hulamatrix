/**
 * Core Store - Authentication and User State Management
 * Handles login, logout, user profiles, friends, and blocked users
 */

import { ref, computed, type Ref } from 'vue'
import { logger } from '@/utils/logger'
import type { MatrixClient } from 'matrix-js-sdk'
import type {
  AuthState,
  UserProfile,
  LoginCredentials,
  MatrixLoginResponse,
  MatrixUpdateTokenParams,
  MatrixUserStore
} from './types'

/**
 * Authentication and user state manager
 */
export class AuthStateManager {
  /** Authentication state */
  auth: Ref<AuthState>

  /** Current user profile */
  currentUser: Ref<UserProfile | null>

  /** All users map */
  users: Ref<Map<string, UserProfile>>

  /** Friends list */
  friends: Ref<string[]>

  /** Blocked users list */
  blockedUsers: Ref<string[]>

  /** Loading state */
  isLoading: Ref<boolean>

  /** Is initialized flag */
  isInitialized: Ref<boolean>

  /** Matrix client reference - use any to accommodate extended Matrix SDK types */
  client: Ref<any>

  constructor() {
    this.auth = ref<AuthState>({
      isAuthenticated: false,
      loginHistory: []
    })
    this.currentUser = ref<UserProfile | null>(null)
    this.users = ref<Map<string, UserProfile>>(new Map())
    this.friends = ref<string[]>([])
    this.blockedUsers = ref<string[]>([])
    this.isLoading = ref(false)
    this.isInitialized = ref(false)
    this.client = ref<any>(null)
  }

  /**
   * Check if user is authenticated
   */
  get isAuthenticated() {
    return computed(() => this.auth.value.isAuthenticated)
  }

  /**
   * Get online friends
   */
  get onlineFriends() {
    return computed(() =>
      this.friends.value.filter((userId) => {
        const user = this.users.value.get(userId)
        return user?.presence === 'online'
      })
    )
  }

  /**
   * Login with credentials
   */
  async login(credentials: LoginCredentials): Promise<void> {
    this.isLoading.value = true
    try {
      const { matrixClientService } = await import('@/integrations/matrix/client')

      const homeserverUrl = credentials.homeserver

      // 使用Matrix SDK进行登录
      const { createClient } = await import('matrix-js-sdk')
      const tempClient = createClient({
        baseUrl: homeserverUrl
      })

      // 执行登录
      const loginResponse = await (await tempClient).login('m.login.password', {
        user: credentials.username,
        password: credentials.password
      })

      // 保存登录凭据
      const { invoke } = await import('@tauri-apps/api/core')
      const { TauriCommand } = await import('@/enums')
      const loginResp = loginResponse as unknown as MatrixLoginResponse
      const tokenParams: MatrixUpdateTokenParams = {
        token: loginResp.access_token,
        ...(loginResp.refresh_token !== undefined && { refresh_token: loginResp.refresh_token })
      }
      await invoke(TauriCommand.UPDATE_TOKEN, tokenParams).catch(() => {})

      // 初始化正式的客户端
      const creds = {
        baseUrl: homeserverUrl,
        ...(loginResp.access_token !== undefined && { accessToken: loginResp.access_token }),
        ...(loginResp.refresh_token !== undefined && { refreshToken: loginResp.refresh_token }),
        ...(loginResp.user_id !== undefined && { userId: loginResp.user_id })
      }
      await matrixClientService.initialize(creds)

      // 初始化消息接收器，确保在启动客户端之前监听事件
      const { messageReceiver } = await import('@/services/unifiedMessageReceiver')
      await messageReceiver.initialize()

      // 启动客户端
      await matrixClientService.startClient()

      // 初始化推送通知服务
      try {
        const { matrixPushService } = await import('@/matrix/services/notification/push')
        await matrixPushService.initialize()
        logger.info('[AuthState] Push notification service initialized')
      } catch (pushError) {
        logger.warn('[AuthState] Failed to initialize push notification service:', pushError)
      }

      // 更新状态
      const clientInstance = matrixClientService.getClient()
      if (clientInstance) {
        this.client.value = clientInstance as unknown as MatrixClient | null
      }
      this.auth.value.isAuthenticated = true
      this.auth.value.homeserver = homeserverUrl
      this.auth.value.userId = loginResponse.user_id
      this.auth.value.deviceId = loginResponse.device_id

      // 添加登录历史
      this.auth.value.loginHistory.push({
        timestamp: Date.now(),
        deviceId: loginResponse.device_id || 'device-' + Date.now(),
        ipAddress: '127.0.0.1'
      })

      this.isInitialized.value = true

      // 加载用户信息
      await this.loadCurrentUser()
    } catch (error) {
      logger.error('[AuthState] Login failed:', error)
      if (error instanceof Error) {
        if (error.message.includes('Invalid password')) {
          throw new Error('密码错误，请重新输入')
        } else if (error.message.includes('Invalid username')) {
          throw new Error('用户名不存在，请检查输入')
        } else if (error.message.includes('network')) {
          throw new Error('网络连接失败，请检查网络设置')
        }
      }
      throw error
    } finally {
      this.isLoading.value = false
    }
  }

  /**
   * Load current user profile
   */
  async loadCurrentUser(): Promise<void> {
    if (!this.client.value || !this.auth.value.userId) return

    try {
      const userInfo = await this.client.value.getProfileInfo(String(this.auth.value.userId))
      if (userInfo) {
        const { useUserStore } = await import('@/stores/user')
        const userStore = useUserStore() as unknown as MatrixUserStore
        if (userStore.userInfo) {
          userStore.userInfo.value = {
            ...(this.auth.value.userId !== undefined && { uid: this.auth.value.userId }),
            ...(userInfo.displayname !== undefined && { name: userInfo.displayname }),
            ...(userInfo.avatar_url !== undefined && { avatar: userInfo.avatar_url })
          }
        }

        this.currentUser.value = {
          userId: this.auth.value.userId,
          displayName: userInfo.displayname || '',
          avatarUrl: userInfo.avatar_url,
          presence: 'online'
        }
      }
    } catch (error) {
      logger.error('[AuthState] Failed to load current user:', error)
    }
  }

  /**
   * Logout
   */
  logout(): void {
    this.auth.value.isAuthenticated = false
    this.client.value = null
    this.isInitialized.value = false
    this.currentUser.value = null
    this.users.value.clear()
  }

  /**
   * Add friend
   */
  addFriend(userId: string): void {
    if (!this.friends.value.includes(userId)) {
      this.friends.value.push(userId)
    }
  }

  /**
   * Remove friend
   */
  removeFriend(userId: string): void {
    const index = this.friends.value.indexOf(userId)
    if (index > -1) {
      this.friends.value.splice(index, 1)
    }
  }

  /**
   * Block user
   */
  blockUser(userId: string): void {
    if (!this.blockedUsers.value.includes(userId)) {
      this.blockedUsers.value.push(userId)
      this.removeFriend(userId)
    }
  }

  /**
   * Get user by ID
   */
  getUser(userId: string): UserProfile | undefined {
    return this.users.value.get(userId)
  }

  /**
   * Set user
   */
  setUser(userId: string, profile: UserProfile): void {
    this.users.value.set(userId, profile)
  }

  /**
   * Update user presence
   */
  updateUserPresence(userId: string, presence: UserProfile['presence']): void {
    const user = this.users.value.get(userId)
    if (user) {
      user.presence = presence
      user.lastActive = Date.now()
    }
  }
}
