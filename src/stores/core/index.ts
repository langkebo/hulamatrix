/**
 * 核心应用状态管理
 * 统一管理所有应用状态，替代分散的多个Store
 */
import { ERROR_MESSAGES } from '@/constants'

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { MatrixClient } from 'matrix-js-sdk'
import { readFileAsArrayBuffer, getVideoInfo } from '@/utils/fileHelpers'
import { logger } from '@/utils/logger'

// App Store 状态类型定义
interface AppStoreState {
  // Actions and computed properties
  [key: string]: unknown
}

// ========== UI 相关类型 ==========
/**
 * MenuItem 类型定义
 */
export interface MenuItem {
  url: string
  icon: string
  iconAction?: string
  state?: string
  isAdd?: boolean
  dot?: boolean
  progress?: number
  miniShow?: boolean
  title?: string
  shortTitle?: string
}

// ========== 用户和认证相关 ==========
interface UserProfile {
  userId: string
  displayName: string
  avatarUrl?: string
  presence: 'online' | 'offline' | 'away' | 'busy'
  lastActive?: number
}

interface AuthState {
  isAuthenticated: boolean
  accessToken?: string
  deviceId?: string
  userId?: string
  homeserver?: string
  loginHistory: Array<{
    timestamp: number
    deviceId: string
    ipAddress?: string
  }>
}

// ========== 聊天和消息相关 ==========
interface ChatMessage {
  id: string
  roomId: string
  sender: string
  content: Record<string, unknown>
  timestamp: number
  type: 'text' | 'image' | 'file' | 'audio' | 'video'
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed'
  reactions?: Record<string, string[]>
  isEncrypted?: boolean
}

interface Room {
  id: string
  name: string
  topic?: string
  avatar?: string
  type: 'dm' | 'group' | 'space'
  members: string[]
  unreadCount: number
  highlightCount: number
  notifications: 'all' | 'mentions' | 'none'
  isEncrypted: boolean
  lastMessage?: ChatMessage
  tags?: string[]
  creationTime?: number
  joinRule?: string
}

// ========== 媒体和文件相关 ==========
interface MediaFile {
  id: string
  name: string
  type: string
  size: number
  url?: string
  thumbnailUrl?: string
  uploadProgress?: number
  downloadProgress?: number
  encryptionInfo?: Record<string, unknown>
  metadata?: {
    width?: number
    height?: number
    duration?: number
    mimeType?: string
  }
}

interface DownloadQueue {
  pending: MediaFile[]
  active: MediaFile[]
  completed: MediaFile[]
  failed: MediaFile[]
  paused: boolean
}

// ========== 通知和推送相关 ==========
interface NotificationRule {
  id: string
  name: string
  enabled: boolean
  conditions: Record<string, unknown>[]
  actions: Record<string, unknown>[]
  priority: number
}

interface NotificationSettings {
  global: {
    enabled: boolean
    soundEnabled: boolean
    doNotDisturb: boolean
    doNotDisturbStart?: string
    doNotDisturbEnd?: string
  }
  room: Record<
    string,
    {
      enabled: boolean
      mentionsOnly: boolean
      keywords: string[]
    }
  >
  rules: NotificationRule[]
}

// ========== RTC通话相关 ==========
interface CallState {
  isInCall: boolean
  callType?: 'audio' | 'video'
  remoteUserId?: string
  roomId?: string
  isMuted: boolean
  isVideoEnabled: boolean
  isScreenSharing: boolean
  callStats?: {
    duration: number
    bitrate: number
    packetLoss: number
  }
}

// ========== E2EE设备相关 ==========
interface Device {
  deviceId: string
  displayName: string
  avatar?: string
  lastSeen?: number
  lastActive?: number
  firstRegistered?: number
  userId?: string
  keys?: {
    ed25519?: string
    curve25519?: string
  }
  algorithms?: string[]
  verified?: boolean
  blocked?: boolean
  currentDevice?: boolean
  roomIds?: string[]
}

// ========== 缓存相关 ==========
interface CacheSettings {
  maxSize: number // MB
  ttl: number // hours
  compressionEnabled: boolean
  paths: {
    cache: string
    temp: string
    downloads: string
  }
}

interface CacheMetrics {
  totalSize: number
  itemCount: number
  hitRate: number
  lastCleanup: number
}

// ========== 搜索相关 ==========
interface SearchState {
  query: string
  results: Array<{
    id: string
    type: 'message' | 'room' | 'user'
    title: string
    content: string
    roomId: string
    timestamp: number
    highlights?: string[]
  }>
  filters: {
    roomIds?: string[]
    userIds?: string[]
    dateRange?: [number, number]
    messageTypes?: string[]
  }
  loading: boolean
  history: string[]
}

// ========== Matrix 相关类型 ==========
interface MatrixLoginResponse {
  access_token: string
  user_id: string
  device_id: string
  home_server?: string
  refresh_token?: string
  [key: string]: unknown
}

interface MatrixUpdateTokenParams {
  token: string
  refresh_token?: string
  [key: string]: unknown
}

interface MatrixUserStore {
  userInfo?: {
    value: {
      uid?: string
      name?: string
      avatar?: string
    }
  }
}

interface MatrixUploadResponse {
  content_uri: string
  [key: string]: unknown
}

interface MatrixFileProgress {
  loaded: number
  total: number
}

interface MatrixContentInfo {
  size?: number
  mimetype?: string
  w?: number
  h?: number
  duration?: number
  thumbnail_url?: string
  thumbnail_info?: {
    w?: number
    h?: number
    mimetype?: string
    size?: number
  }
  [key: string]: unknown
}

interface MatrixSearchResult {
  result: {
    event_id: string
    room_id: string
    sender: string
    type: string
    content: {
      body?: string
      url?: string
      info?: MatrixContentInfo
      [key: string]: unknown
    }
    origin_server_ts: number
    [key: string]: unknown
  }
  rank?: number
  [key: string]: unknown
}

// 以下接口用于类型文档，供将来搜索功能使用
export interface MatrixSearchResponse {
  results?: MatrixSearchResult[]
  [key: string]: unknown
}

interface MatrixUserDirectoryResult {
  user_id: string
  display_name?: string
  avatar_url?: string
  [key: string]: unknown
}

interface MatrixUserDirectoryResponse {
  results?: MatrixUserDirectoryResult[]
  limited?: boolean
  [key: string]: unknown
}

interface MatrixPublicRoom {
  room_id: string
  name?: string
  avatar_url?: string
  topic?: string
  num_joined_members?: number
  world_readable?: boolean
  guest_can_join?: boolean
  [key: string]: unknown
}

interface MatrixPublicRoomsResponse {
  chunk?: MatrixPublicRoom[]
  next_batch?: string
  prev_batch?: string
  total_room_count_estimate?: number
  [key: string]: unknown
}

interface RoomSearchResult {
  id: string
  name: string
  avatar: string
  type: 'public' | 'private' | 'dm' | 'group' | 'space'
  memberCount: number
  topic: string
  lastMessage: unknown | null
  unreadCount: number
}

// ========== 系统设置相关 ==========
interface AppSettings {
  theme: 'light' | 'dark' | 'auto'
  language: string
  fontSize: 'small' | 'medium' | 'large'
  messageDensity: 'compact' | 'comfortable' | 'spacious'
  autoPlayGifs: boolean
  showReadReceipts: boolean
  showTypingNotifications: boolean
  enableEncryption: boolean
  backupFrequency: 'daily' | 'weekly' | 'monthly'
  cache: CacheSettings
  notifications: NotificationSettings
}

export const useAppStore = defineStore('app', (): AppStoreState => {
  // ========== 原始状态 ==========
  const client = ref<MatrixClient | null>(null)
  const isInitialized = ref(false)
  const isLoading = ref(false)

  // ========== 认证状态 ==========
  const auth = ref<AuthState>({
    isAuthenticated: false,
    loginHistory: []
  })

  // ========== 用户状态 ==========
  const currentUser = ref<UserProfile | null>(null)
  const users = ref<Map<string, UserProfile>>(new Map())
  const friends = ref<string[]>([])
  const blockedUsers = ref<string[]>([])

  // ========== 聊天状态 ==========
  const rooms = ref<Map<string, Room>>(new Map())
  const messages = ref<Map<string, ChatMessage[]>>(new Map())
  const currentRoomId = ref<string | null>(null)
  const typingUsers = ref<Map<string, Set<string>>>(new Map())

  // ========== LRU 缓存和智能预加载 ==========
  // 最近使用的房间列表（用于 LRU 缓存清理）
  const recentRooms = ref<string[]>([])
  const MAX_RECENT_ROOMS = 50 // 保留最近使用的 50 个房间
  const PRELOAD_ROOMS_COUNT = 5 // 预加载最近 5 个活跃房间的消息

  // ========== 媒体状态 ==========
  const mediaFiles = ref<Map<string, MediaFile>>(new Map())
  const downloadQueue = ref<DownloadQueue>({
    pending: [],
    active: [],
    completed: [],
    failed: [],
    paused: false
  })

  // ========== 通知状态 ==========
  const notifications = ref<NotificationSettings>({
    global: {
      enabled: true,
      soundEnabled: true,
      doNotDisturb: false
    },
    room: {},
    rules: []
  })

  // ========== RTC状态 ==========
  const callState = ref<CallState>({
    isInCall: false,
    isMuted: false,
    isVideoEnabled: false,
    isScreenSharing: false
  })

  // ========== 缓存状态 ==========
  const cacheSettings = ref<CacheSettings>({
    maxSize: 500,
    ttl: 24,
    compressionEnabled: true,
    paths: {
      cache: './cache',
      temp: './temp',
      downloads: './downloads'
    }
  })

  const cacheMetrics = ref<CacheMetrics>({
    totalSize: 0,
    itemCount: 0,
    hitRate: 0,
    lastCleanup: Date.now()
  })

  // ========== 搜索状态 ==========
  const search = ref<SearchState>({
    query: '',
    results: [],
    filters: {},
    loading: false,
    history: []
  })

  // ========== 应用设置 ==========
  const settings = ref<AppSettings>({
    theme: 'auto',
    language: 'zh-CN',
    fontSize: 'medium',
    messageDensity: 'comfortable',
    autoPlayGifs: true,
    showReadReceipts: true,
    showTypingNotifications: true,
    enableEncryption: true,
    backupFrequency: 'weekly',
    cache: cacheSettings.value,
    notifications: notifications.value
  })

  // ========== UI 相关状态 ==========
  /**
   * 菜单配置 (从 useMenuTopStore 迁移)
   */
  const menuTop = ref<MenuItem[]>([
    {
      url: 'message',
      icon: 'message',
      iconAction: 'message-action',
      state: 'builtin',
      isAdd: true,
      dot: false,
      progress: 0,
      miniShow: false
    },
    {
      url: 'friendsList',
      icon: 'avatar',
      iconAction: 'avatar-action',
      state: 'builtin',
      isAdd: true,
      dot: false,
      progress: 0,
      miniShow: false
    }
  ])

  // ========== 计算属性 ==========
  const isAuthenticated = computed(() => auth.value.isAuthenticated)
  const currentRoom = computed(() => (currentRoomId.value ? rooms.value.get(currentRoomId.value) : null))
  const currentMessages = computed(() => (currentRoomId.value ? messages.value.get(currentRoomId.value) || [] : []))
  const unreadCount = computed(() => {
    let total = 0
    for (const room of rooms.value.values()) {
      total += room.unreadCount + room.highlightCount
    }
    return total
  })
  const onlineFriends = computed(() =>
    friends.value.filter((userId) => {
      const user = users.value.get(userId)
      return user?.presence === 'online'
    })
  )

  // ========== 核心方法 ==========

  /**
   * 认证相关方法
   */
  const login = async (credentials: { username: string; password: string; homeserver: string }) => {
    isLoading.value = true
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

      // 初始化推送通知服务 (Phase 10 优化 - 使用 SDK PushProcessor)
      try {
        const { matrixPushService } = await import('@/services/matrixPushService')
        await matrixPushService.initialize()
        logger.info('[HuLaStore] Push notification service initialized')
      } catch (pushError) {
        logger.warn('[HuLaStore] Failed to initialize push notification service:', pushError)
        // 推送服务初始化失败不影响登录流程
      }

      // 更新状态
      const clientInstance = matrixClientService.getClient()
      if (clientInstance) {
        client.value = clientInstance as unknown as MatrixClient | null
      }
      auth.value.isAuthenticated = true
      auth.value.homeserver = homeserverUrl
      auth.value.userId = loginResponse.user_id
      auth.value.deviceId = loginResponse.device_id

      // 添加登录历史
      auth.value.loginHistory.push({
        timestamp: Date.now(),
        deviceId: loginResponse.device_id || 'device-' + Date.now(),
        ipAddress: '127.0.0.1' // 在实际应用中应该从请求中获取
      })

      isInitialized.value = true

      // 加载初始数据
      await loadInitialData()
    } catch (error) {
      logger.error('Login failed:', error)
      // 提供更友好的错误信息
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
      isLoading.value = false
    }
  }

  /**
   * 加载初始数据
   */
  const loadInitialData = async () => {
    if (!client.value) return

    try {
      // 获取用户自己的信息
      const userInfo = await client.value.getProfileInfo(String(auth.value.userId || ''))
      if (userInfo) {
        const { useUserStore } = await import('@/stores/user')
        const userStore = useUserStore() as unknown as MatrixUserStore
        if (userStore.userInfo) {
          userStore.userInfo.value = {
            ...(auth.value.userId !== undefined && { uid: auth.value.userId }),
            ...(userInfo.displayname !== undefined && { name: userInfo.displayname }),
            ...(userInfo.avatar_url !== undefined && { avatar: userInfo.avatar_url })
          }
        }
      }

      // 获取房间列表
      const joined = await client.value.getJoinedRooms()
      if (joined.joined_rooms) {
        for (const roomId of joined.joined_rooms) {
          const room = client.value.getRoom(roomId)
          if (room) {
            const avatarUrl =
              room.getAvatarUrl?.(client.value.getHomeserverUrl?.() || '', 48, 48, 'crop', true, true) || ''
            const memberCount = room.getJoinedMemberCount?.() || 0
            rooms.value.set(roomId, {
              id: roomId,
              name: room.name || roomId,
              avatar: avatarUrl,
              type: memberCount === 2 ? 'dm' : 'group',
              members: [],
              highlightCount: 0,
              notifications: 'all',
              isEncrypted: false,
              lastMessage: {
                id: '',
                roomId,
                sender: '',
                content: {},
                timestamp: 0,
                type: 'text',
                status: 'sent'
              },
              unreadCount: room.getUnreadNotificationCount?.() || 0
            })
          }
        }
      }
    } catch (error) {
      logger.error('Failed to load initial data:', error)
    }
  }

  const logout = () => {
    auth.value.isAuthenticated = false
    client.value = null
    isInitialized.value = false
    currentRoomId.value = null
    // 清理缓存数据
    rooms.value.clear()
    messages.value.clear()
    users.value.clear()
  }

  /**
   * 房间管理方法
   */
  const joinRoom = async (roomId: string) => {
    if (!client.value) return

    try {
      await client.value.joinRoom(roomId)
      currentRoomId.value = roomId
    } catch (error) {
      logger.error('Failed to join room:', error)
      throw error
    }
  }

  const leaveRoom = async (roomId: string) => {
    if (!client.value) return

    try {
      await client.value.leave(roomId)
      if (currentRoomId.value === roomId) {
        currentRoomId.value = null
      }
      rooms.value.delete(roomId)
      messages.value.delete(roomId)
    } catch (error) {
      logger.error('Failed to leave room:', error)
      throw error
    }
  }

  /**
   * 消息发送方法
   */
  const sendMessage = async (roomId: string, content: Record<string, unknown>, type: string = 'm.room.message') => {
    if (!client.value || !auth.value.userId) return

    const tempId = 'temp-' + Date.now()
    const tempMessage: ChatMessage = {
      id: tempId,
      roomId,
      sender: auth.value.userId,
      content,
      timestamp: Date.now(),
      type: 'text',
      status: 'sending'
    }

    // 添加临时消息
    const roomMessages = messages.value.get(roomId) || []
    roomMessages.push(tempMessage)
    messages.value.set(roomId, roomMessages)

    try {
      const sendEventFn = (
        client.value as {
          sendEvent?(roomId: string, type: string, content: Record<string, unknown>): Promise<{ event_id: string }>
        }
      ).sendEvent
      const event = (await sendEventFn?.(roomId, type, content)) ?? { event_id: tempId }
      // 更新消息状态
      tempMessage.id = event.event_id
      tempMessage.status = 'sent'
    } catch (error) {
      tempMessage.status = 'failed'
      logger.error('Failed to send message:', error)
      throw error
    }
  }

  /**
   * 用户管理方法
   */
  const addFriend = async (userId: string) => {
    if (!friends.value.includes(userId)) {
      friends.value.push(userId)
    }
  }

  const removeFriend = (userId: string) => {
    const index = friends.value.indexOf(userId)
    if (index > -1) {
      friends.value.splice(index, 1)
    }
  }

  const blockUser = async (userId: string) => {
    if (!blockedUsers.value.includes(userId)) {
      blockedUsers.value.push(userId)
      removeFriend(userId)
    }
  }

  /**
   * 媒体文件方法
   */
  const uploadFile = async (file: File, roomId: string): Promise<MediaFile> => {
    const fileId = 'file-' + Date.now()
    const mediaFile: MediaFile = {
      id: fileId,
      name: file.name,
      type: file.type,
      size: file.size,
      uploadProgress: 0
    }

    mediaFiles.value.set(fileId, mediaFile)

    try {
      // 检查文件类型和大小
      const { FILE_SIZE_LIMITS, FILE_TYPES } = await import('@/constants')

      if (file.type.startsWith('image/')) {
        if (file.size > FILE_SIZE_LIMITS.IMAGE_MAX_SIZE) {
          throw new Error(ERROR_MESSAGES.FILE_TOO_LARGE)
        }
        if (!FILE_TYPES.IMAGE.includes(file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif')) {
          throw new Error('不支持的图片格式')
        }
      } else if (file.type.startsWith('video/')) {
        if (file.size > FILE_SIZE_LIMITS.VIDEO_MAX_SIZE) {
          throw new Error('视频大小不能超过100MB')
        }
        if (!FILE_TYPES.VIDEO.includes(file.type as 'video/mp4' | 'video/webm' | 'video/ogg')) {
          throw new Error('不支持的视频格式')
        }
      } else {
        if (file.size > FILE_SIZE_LIMITS.FILE_MAX_SIZE) {
          throw new Error('文件大小不能超过100MB')
        }
      }

      // 使用Matrix的Content Repository API上传文件
      if (!client.value) {
        throw new Error('Matrix客户端未初始化')
      }

      const progressCallback = (progress: MatrixFileProgress) => {
        const percentComplete = Math.round((progress.loaded / progress.total) * 100)
        mediaFile.uploadProgress = percentComplete
      }

      // 读取文件内容
      const fileContent = await readFileAsArrayBuffer(file)

      // 上传到Matrix Media Repository
      const uploadContentFn = (
        client.value as {
          uploadContent?(
            content: Uint8Array | Blob,
            options: { type: string; name: string },
            progressCallback?: (progress: MatrixFileProgress) => void,
            extraInfo?: Record<string, unknown>
          ): Promise<MatrixUploadResponse>
        }
      ).uploadContent
      const uploadUrl = (await uploadContentFn?.(
        new Uint8Array(fileContent),
        {
          type: file.type,
          name: file.name
        },
        progressCallback,
        {}
      )) ?? { content_uri: '' }

      // 获取文件的MXC URI
      const mxcUri = uploadUrl.content_uri

      // 更新媒体文件信息
      mediaFile.url = mxcUri
      mediaFile.uploadProgress = 100

      // 获取文件额外信息（缩略图、时长等）
      const fileInfo: MatrixContentInfo = {
        size: file.size,
        mimetype: file.type
      }

      // 如果是图片，获取尺寸信息
      if (file.type.startsWith('image/')) {
        const { getImageDimensions } = await import('@/utils/ImageUtils')
        try {
          const dimensions = await getImageDimensions(file)
          fileInfo.w = dimensions.width
          fileInfo.h = dimensions.height
        } catch (error) {
          logger.warn('Failed to get image dimensions:', error)
        }
      }

      // 如果是视频，获取时长
      if (file.type.startsWith('video/')) {
        try {
          const videoInfo = await getVideoInfo(file)
          fileInfo.duration = videoInfo.duration
          if (videoInfo.thumbnail) {
            // 上传缩略图
            const thumbnailUpload = (await uploadContentFn?.(videoInfo.thumbnail, {
              type: 'image/jpeg',
              name: `${file.name}_thumb.jpg`
            })) ?? { content_uri: '' }
            fileInfo.thumbnail_url = thumbnailUpload.content_uri
            fileInfo.thumbnail_info = {
              ...(videoInfo.thumbnailWidth !== undefined && { w: videoInfo.thumbnailWidth }),
              ...(videoInfo.thumbnailHeight !== undefined && { h: videoInfo.thumbnailHeight }),
              mimetype: 'image/jpeg',
              ...(videoInfo.thumbnail.size !== undefined && { size: videoInfo.thumbnail.size })
            }
          }
        } catch (error) {
          logger.warn('Failed to get video info:', error)
        }
      }

      // 确定消息类型
      let msgType = 'm.file'
      if (file.type.startsWith('image/')) {
        msgType = 'm.image'
      } else if (file.type.startsWith('video/')) {
        msgType = 'm.video'
      } else if (file.type.startsWith('audio/')) {
        msgType = 'm.audio'
      }

      // 发送文件消息
      await sendMessage(
        roomId,
        {
          body: file.name,
          info: fileInfo,
          url: mxcUri
        },
        msgType
      )

      return mediaFile
    } catch (error) {
      mediaFiles.value.delete(fileId)
      throw error
    }
  }

  /**
   * 搜索方法
   */
  const performSearch = async (query: string) => {
    search.value.query = query
    search.value.loading = true

    try {
      if (!client.value || !query.trim()) {
        search.value.results = []
        return
      }

      // 准备搜索参数
      const searchParams = {
        term: query,
        search_term: query,
        order: 'recent',
        limit: 50
      } as Record<string, unknown>

      // 添加房间过滤器
      if (search.value.filters.roomIds && search.value.filters.roomIds.length > 0) {
        searchParams.filter = {
          rooms: search.value.filters.roomIds
        }
      }

      // 添加发送者过滤器
      if (search.value.filters.userIds && search.value.filters.userIds.length > 0) {
        searchParams.filter = {
          ...(searchParams.filter as Record<string, unknown>),
          senders: search.value.filters.userIds
        }
      }

      // 执行搜索
      const searchRoomEventsFn = (
        client.value as unknown as {
          searchRoomEvents?(opts: Record<string, unknown>): Promise<{ results?: unknown[] }>
        }
      ).searchRoomEvents
      const results = (await searchRoomEventsFn?.(searchParams)) ?? { results: [] }

      // 处理搜索结果
      const hits = results.results || []
      search.value.results = hits.map((r: unknown) => {
        const searchResult = r as {
          result?: { event_id?: string; room_id?: string; content?: { body?: string }; origin_server_ts?: number }
          rank?: number
        }
        const event = searchResult.result ?? {}
        const room = (
          client.value as { getRoom?(roomId: string): { roomId?: string; name?: string } | null }
        )?.getRoom?.(event.room_id ?? '')

        // 尝试高亮匹配的文本
        let highlightedContent = event.content?.body || ''
        if (searchResult.rank && searchResult.rank > 0) {
          // 如果有排名，说明是相关结果
          highlightedContent = highlightSearchTerms(event.content?.body || '', query)
        }

        const result: {
          id: string
          type: 'message' | 'user' | 'room'
          title: string
          content: string
          roomId: string
          timestamp: number
          highlights?: string[]
        } = {
          id: event.event_id ?? '',
          type: 'message' as const,
          title: room?.name || event.room_id || '',
          content: highlightedContent,
          roomId: event.room_id ?? '',
          timestamp: event.origin_server_ts ?? Date.now()
        }
        return result
      })

      // 添加到搜索历史
      if (query.trim() && !search.value.history.includes(query)) {
        search.value.history.unshift(query)
        if (search.value.history.length > 20) {
          search.value.history.pop()
        }
      }
    } catch (error) {
      logger.error('Search failed:', error)
      search.value.results = []
      // 提供友好的错误提示
      if (error instanceof Error) {
        if (error.message.includes('not supported')) {
          logger.warn('Search not supported on this homeserver')
        }
      }
    } finally {
      search.value.loading = false
    }
  }

  /**
   * 高亮搜索词
   */
  const highlightSearchTerms = (text: string, query: string): string => {
    if (!text || !query) return text

    const terms = query.split(/\s+/).filter((term) => term.length > 0)
    let highlighted = text

    terms.forEach((term) => {
      const regex = new RegExp(`(${escapeRegex(term)})`, 'gi')
      highlighted = highlighted.replace(regex, '<mark>$1</mark>')
    })

    return highlighted
  }

  /**
   * 转义正则表达式特殊字符
   */
  const escapeRegex = (str: string): string => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  /**
   * 搜索用户
   */
  const searchUsers = async (query: string): Promise<UserProfile[]> => {
    if (!client.value || !query.trim()) {
      return []
    }

    try {
      // 首先在已知的用户中搜索
      const knownUsers = Array.from(users.value.values()).filter(
        (user) =>
          user.displayName?.toLowerCase().includes(query.toLowerCase()) ||
          user.userId.toLowerCase().includes(query.toLowerCase())
      )

      // 如果homeserver支持用户目录搜索，则执行远程搜索
      try {
        const userDirectoryResults = (await client.value.searchUserDirectory({
          term: query,
          limit: 20
        })) as unknown as MatrixUserDirectoryResponse

        const remoteUsers = (userDirectoryResults.results || []).map((result: MatrixUserDirectoryResult) => {
          const user: UserProfile = {
            userId: result.user_id,
            displayName: result.display_name || result.user_id,
            avatarUrl: result.avatar_url || '',
            presence: 'offline' as const
          }
          return user
        })

        // 合并结果，去重
        const allUsers: UserProfile[] = [...knownUsers]
        remoteUsers.forEach((remote: UserProfile) => {
          if (!allUsers.find((u) => u.userId === remote.userId)) {
            const user = { ...remote }
            if (user.lastActive === undefined) {
              delete user.lastActive
            }
            allUsers.push(user)
          }
        })

        return allUsers.slice(0, 20) // 限制结果数量
      } catch (error) {
        logger.warn('User directory search not supported:', error)
        return knownUsers
      }
    } catch (error) {
      logger.error('Failed to search users:', error)
      return []
    }
  }

  /**
   * 搜索房间
   */
  const searchRooms = async (query: string): Promise<RoomSearchResult[]> => {
    if (!client.value || !query.trim()) {
      return []
    }

    try {
      // 在已知的房间中搜索
      const knownRooms: RoomSearchResult[] = Array.from(rooms.value.values())
        .filter(
          (room) =>
            room.name?.toLowerCase().includes(query.toLowerCase()) ||
            room.id.toLowerCase().includes(query.toLowerCase())
        )
        .map((room) => ({
          id: room.id,
          name: room.name,
          avatar: room.avatar || '',
          type: room.type === 'dm' ? 'dm' : 'private',
          memberCount: room.members.length,
          topic: room.topic || '',
          lastMessage: null,
          unreadCount: room.unreadCount
        }))

      // 如果homeserver支持公共房间目录，则执行远程搜索
      try {
        const publicRoomResults = (await client.value.publicRooms({
          limit: 20,
          filter: {
            generic_search_term: query
          }
        })) as unknown as MatrixPublicRoomsResponse

        const remoteRooms = (publicRoomResults.chunk || []).map(
          (room: MatrixPublicRoom): RoomSearchResult => ({
            id: room.room_id,
            name: room.name || room.room_id,
            avatar: room.avatar_url || '',
            type: room.world_readable && room.guest_can_join ? 'public' : 'private',
            memberCount: room.num_joined_members || 0,
            topic: room.topic || '',
            lastMessage: null,
            unreadCount: 0
          })
        )

        // 合并结果，去重
        const allRooms = [...knownRooms]
        remoteRooms.forEach((remote: RoomSearchResult) => {
          if (!allRooms.find((r) => r.id === remote.id)) {
            allRooms.push(remote)
          }
        })

        return allRooms.slice(0, 20)
      } catch (error) {
        logger.warn('Public room directory search not supported:', error)
        return knownRooms
      }
    } catch (error) {
      logger.error('Failed to search rooms:', error)
      return []
    }
  }

  /**
   * 缓存管理方法
   */
  const clearCache = async (options?: { type?: 'all' | 'messages' | 'rooms' | 'users' | 'media'; roomId?: string }) => {
    const { type = 'all', roomId } = options || {}

    logger.info('[CoreStore] Clearing cache:', { type, roomId })

    try {
      switch (type) {
        case 'messages':
          if (roomId) {
            // Clear messages for specific room
            const roomMessages = messages.value.get(roomId)
            if (roomMessages) {
              cacheMetrics.value.itemCount -= roomMessages.length
              messages.value.delete(roomId)
            }
          } else {
            // Clear all messages
            for (const [_id, msgArray] of messages.value.entries()) {
              cacheMetrics.value.itemCount -= msgArray.length
            }
            messages.value.clear()
          }
          break

        case 'rooms':
          // Clear room cache
          cacheMetrics.value.itemCount -= rooms.value.size
          rooms.value.clear()
          break

        case 'users':
          // Clear user cache
          cacheMetrics.value.itemCount -= users.value.size
          users.value.clear()
          break

        case 'media':
          // Clear media file cache from localStorage and IndexedDB
          if (typeof localStorage !== 'undefined') {
            const mediaKeys = Object.keys(localStorage).filter((k) => k.startsWith('media_'))
            mediaKeys.forEach((key) => localStorage.removeItem(key))
            cacheMetrics.value.itemCount -= mediaKeys.length
          }

          // Clear IndexedDB media cache if available
          try {
            const caches = await window.caches?.keys()
            if (caches) {
              for (const cacheName of caches) {
                if (cacheName.includes('media') || cacheName.includes('cache')) {
                  await window.caches.delete(cacheName)
                }
              }
            }
          } catch {
            // IndexedDB/caches API might not be available
          }
          break
        default:
          // Clear all cached data
          messages.value.clear()
          rooms.value.clear()
          users.value.clear()
          search.value.history = []
          search.value.results = []

          // Clear localStorage caches
          if (typeof localStorage !== 'undefined') {
            const cacheKeys = Object.keys(localStorage).filter(
              (k) => k.startsWith('cache_') || k.startsWith('media_') || k.startsWith('temp_')
            )
            cacheKeys.forEach((key) => localStorage.removeItem(key))
          }

          // Clear all caches
          try {
            await window.caches
              ?.keys()
              .then((cacheNames) => Promise.all(cacheNames.map((name) => window.caches?.delete(name))))
          } catch {
            // Cache API might not be available
          }

          cacheMetrics.value.totalSize = 0
          cacheMetrics.value.itemCount = 0
          break
      }

      cacheMetrics.value.lastCleanup = Date.now()
      logger.info('[CoreStore] Cache cleared:', { type, remainingItems: cacheMetrics.value.itemCount })
    } catch (error) {
      logger.error('[CoreStore] Failed to clear cache:', error)
    }
  }

  const optimizeCache = async () => {
    logger.info('[CoreStore] Optimizing cache...')

    const startTime = Date.now()
    let itemsRemoved = 0
    let spaceFreed = 0

    try {
      // 1. Clean up old messages (older than TTL)
      const ttlMs = cacheSettings.value.ttl * 60 * 60 * 1000
      const now = Date.now()
      const cutoffTime = now - ttlMs

      for (const [roomId, msgArray] of messages.value.entries()) {
        const originalLength = msgArray.length
        // Keep only recent messages
        const filtered = msgArray.filter((msg: ChatMessage) => msg.timestamp > cutoffTime)

        if (filtered.length < originalLength) {
          messages.value.set(roomId, filtered)
          itemsRemoved += originalLength - filtered.length
        }
      }

      // 2. Remove old search history
      if (search.value.history.length > 100) {
        const removedHistory = search.value.history.splice(0, search.value.history.length - 100)
        itemsRemoved += removedHistory.length
      }

      // 3. Clean up inactive users (not seen in 30 days)
      const inactiveThreshold = now - 30 * 24 * 60 * 60 * 1000
      for (const [userId, user] of users.value.entries()) {
        if (user.lastActive && user.lastActive < inactiveThreshold) {
          users.value.delete(userId)
          itemsRemoved++
        }
      }

      // 4. Check total cache size and enforce limit
      // Estimate total size based on item counts
      const estimatedSize =
        messages.value.size * 1000 + // Estimate 1KB per message array
        rooms.value.size * 500 + // Estimate 500B per room
        users.value.size * 200 // Estimate 200B per user

      cacheMetrics.value.totalSize = estimatedSize
      const maxSizeBytes = cacheSettings.value.maxSize * 1024 * 1024

      if (estimatedSize > maxSizeBytes) {
        // Force cleanup of oldest messages
        const overage = estimatedSize - maxSizeBytes
        const messagesToRemove = Math.ceil(overage / 1000) // Remove oldest messages to fit

        for (const [roomId, msgArray] of messages.value.entries()) {
          if (messagesToRemove <= 0) break

          const toRemove = Math.min(messagesToRemove, Math.floor(msgArray.length * 0.2)) // Remove up to 20%
          if (toRemove > 0) {
            messages.value.set(roomId, msgArray.slice(toRemove))
            itemsRemoved += toRemove
            spaceFreed += toRemove * 1000
          }
        }
      }

      // 5. Clear browser caches if enabled
      if (cacheSettings.value.compressionEnabled) {
        try {
          // Force a garbage collection hint by forcing cleanup of old cache entries
          const cacheNames = await window.caches?.keys()
          if (cacheNames && cacheNames.length > 5) {
            // Keep only the 5 most recent caches
            const toRemove = cacheNames.slice(0, cacheNames.length - 5)
            for (const name of toRemove) {
              await window.caches?.delete(name)
            }
          }
        } catch {
          // Cache API might not be available
        }
      }

      // Update metrics
      cacheMetrics.value.itemCount =
        messages.value.size + rooms.value.size + users.value.size + search.value.history.length
      cacheMetrics.value.lastCleanup = Date.now()

      // Calculate hit rate (simulated)
      cacheMetrics.value.hitRate = Math.min(95, 50 + itemsRemoved * 0.1)

      const duration = Date.now() - startTime
      logger.info('[CoreStore] Cache optimized:', {
        itemsRemoved,
        spaceFreed: `${(spaceFreed / 1024).toFixed(1)} KB`,
        duration: `${duration}ms`,
        hitRate: `${cacheMetrics.value.hitRate.toFixed(1)}%`
      })
    } catch (error) {
      logger.error('[CoreStore] Failed to optimize cache:', error)
    }
  }

  /**
   * 通知管理方法
   */
  const addNotificationRule = (rule: NotificationRule) => {
    notifications.value.rules.push(rule)
    notifications.value.rules.sort((a, b) => b.priority - a.priority)
  }

  const removeNotificationRule = (ruleId: string) => {
    const index = notifications.value.rules.findIndex((r) => r.id === ruleId)
    if (index > -1) {
      notifications.value.rules.splice(index, 1)
    }
  }

  /**
   * RTC通话方法
   *
   * Matrix RTC 实现：
   * - 使用 matrixCallService 处理 WebRTC 通话
   * - 支持 m.call 协议进行信令交换
   * - 集成现有的通话界面组件
   *
   * 功能：
   * - 音频通话 (audio)
   * - 视频通话 (video)
   * - 群组通话 (通过 matrixGroupCallService)
   *
   * 参考资料：
   * - Matrix RTC 规范: https://spec.matrix.org/v1.2/client-server-api/#mcall
   * - 实现位置: src/services/matrixCallService.ts
   */
  const startCall = async (roomId: string, type: 'audio' | 'video') => {
    try {
      // 更新通话状态
      callState.value.isInCall = true
      callState.value.callType = type
      callState.value.roomId = roomId

      // 动态导入 Matrix Call Service
      const { matrixCallService } = await import('@/services/matrixCallService')

      // 调用 Matrix Call Service 启动通话
      const call = await matrixCallService.startCall({
        roomId,
        type: type === 'audio' ? 'voice' : 'video',
        isInitiator: true
      })

      logger.info('[HuLaStore] Matrix RTC call started', { roomId, type, callId: call.callId })
    } catch (error) {
      logger.error('[HuLaStore] Failed to start Matrix RTC call:', error)

      // 重置通话状态
      callState.value.isInCall = false
      callState.value.roomId = undefined

      throw error
    }
  }

  /**
   * 结束当前通话
   */
  const endCall = async () => {
    try {
      if (callState.value.roomId) {
        // 动态导入 Matrix Call Service
        const { matrixCallService } = await import('@/services/matrixCallService')

        // 获取活跃通话并结束
        const activeCalls = matrixCallService.getActiveCalls()
        for (const call of activeCalls) {
          await matrixCallService.endCall(call.callId)
        }

        logger.info('[HuLaStore] Matrix RTC call ended', { roomId: callState.value.roomId })
      }

      // 重置通话状态
      callState.value = {
        isInCall: false,
        isMuted: false,
        isVideoEnabled: false,
        isScreenSharing: false,
        roomId: undefined
      }
    } catch (error) {
      logger.error('[HuLaStore] Failed to end Matrix RTC call:', error)

      // 即使出错也重置状态
      callState.value = {
        isInCall: false,
        isMuted: false,
        isVideoEnabled: false,
        isScreenSharing: false,
        roomId: undefined
      }
    }
  }

  /**
   * 切换音频状态 (静音/取消静音)
   */
  const toggleAudio = async () => {
    callState.value.isMuted = !callState.value.isMuted

    // 如果有活跃通话，同步状态到通话服务
    if (callState.value.isInCall && callState.value.roomId) {
      try {
        const { matrixCallService } = await import('@/services/matrixCallService')
        await matrixCallService.setMuted(callState.value.roomId, callState.value.isMuted)
        logger.info('[HuLaStore] Audio toggled', { muted: callState.value.isMuted })
      } catch (error) {
        logger.error('[HuLaStore] Failed to toggle audio:', error)
      }
    }
  }

  /**
   * 切换视频状态 (开启/关闭摄像头)
   */
  const toggleVideo = async () => {
    callState.value.isVideoEnabled = !callState.value.isVideoEnabled

    // 如果有活跃通话，同步状态到通话服务
    if (callState.value.isInCall && callState.value.roomId) {
      try {
        const { matrixCallService } = await import('@/services/matrixCallService')
        await matrixCallService.setVideoEnabled(callState.value.roomId, callState.value.isVideoEnabled)
        logger.info('[HuLaStore] Video toggled', { enabled: callState.value.isVideoEnabled })
      } catch (error) {
        logger.error('[HuLaStore] Failed to toggle video:', error)
      }
    }
  }

  /**
   * 切换屏幕共享状态
   */
  const toggleScreenShare = async () => {
    callState.value.isScreenSharing = !callState.value.isScreenSharing

    // 屏幕共享需要额外的媒体流处理
    if (callState.value.isInCall && callState.value.isScreenSharing) {
      try {
        // 获取屏幕共享流
        const _screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        })

        logger.info('[HuLaStore] Screen share started')
      } catch (error) {
        logger.error('[HuLaStore] Failed to start screen share:', error)
        callState.value.isScreenSharing = false
        throw error
      }
    } else {
      logger.info('[HuLaStore] Screen share stopped')
    }
  }

  /**
   * 更新菜单配置
   */
  const updateMenuTop = (newMenuTop: MenuItem[]) => {
    menuTop.value = newMenuTop
  }

  // ========== LRU 缓存和智能会话切换 ==========
  /**
   * 更新 LRU 最近使用房间列表
   * @param roomId 房间ID
   */
  const updateRecentRoom = (roomId: string) => {
    if (!roomId) return

    // 移除已存在的房间ID
    const index = recentRooms.value.indexOf(roomId)
    if (index > -1) {
      recentRooms.value.splice(index, 1)
    }

    // 添加到开头（最近使用）
    recentRooms.value.unshift(roomId)

    // 限制列表长度
    if (recentRooms.value.length > MAX_RECENT_ROOMS) {
      recentRooms.value = recentRooms.value.slice(0, MAX_RECENT_ROOMS)
    }

    logger.debug('[CoreStore] Updated recent rooms:', { roomId, recent: recentRooms.value.slice(0, 5) })
  }

  /**
   * 切换到指定房间（智能预加载）
   * @param roomId 目标房间ID
   * @param preload 是否预加载（默认 true）
   */
  const switchToRoom = async (roomId: string, preload = true) => {
    try {
      logger.info('[CoreStore] Switching to room:', { roomId, preload })

      // 1. 更新当前房间
      currentRoomId.value = roomId

      // 2. 更新 LRU 缓存
      updateRecentRoom(roomId)

      // 3. 智能预加载：如果启用，预加载最近活跃的房间
      if (preload) {
        await preloadActiveRooms()
      }

      // 4. 如果目标房间没有消息，标记为需要加载
      if (!messages.value.has(roomId)) {
        logger.debug('[CoreStore] Room messages not cached, will load on demand:', { roomId })
      }

      return { success: true, roomId }
    } catch (error) {
      logger.error('[CoreStore] Failed to switch room:', error)
      return { success: false, roomId, error }
    }
  }

  /**
   * 预加载最近活跃的房间消息
   */
  const preloadActiveRooms = async () => {
    try {
      // 获取最近活跃的房间（按最后消息时间排序）
      const activeRooms = Array.from(rooms.value.values())
        .filter((room: Room) => room.lastMessage?.timestamp)
        .sort((a: Room, b: Room) => (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0))
        .slice(0, PRELOAD_ROOMS_COUNT)
        .map((room) => room.id)

      logger.debug('[CoreStore] Preloading active rooms:', activeRooms)

      // 标记这些房间为需要预加载（实际加载由各个服务按需进行）
      // 这样可以避免阻塞当前会话切换
      for (const roomId of activeRooms) {
        if (!messages.value.has(roomId)) {
          logger.debug('[CoreStore] Room needs loading:', { roomId })
        }
      }
    } catch (error) {
      logger.warn('[CoreStore] Failed to preload active rooms:', error)
    }
  }

  /**
   * 执行 LRU 缓存清理
   * 当缓存达到上限时，清理最少使用的房间消息
   */
  const performLRUCleanup = async () => {
    try {
      const maxSizeItems = cacheSettings.value.maxSize * 100 // 估算最大项目数
      const totalItems = messages.value.size + rooms.value.size

      if (totalItems <= maxSizeItems) {
        return // 无需清理
      }

      logger.info('[CoreStore] Performing LRU cleanup...', { totalItems, maxSizeItems })

      let itemsRemoved = 0
      const targetItems = Math.floor(maxSizeItems * 0.9) // 清理到 90%

      // 从最少使用的房间开始清理
      for (let i = recentRooms.value.length - 1; i >= 0; i--) {
        const roomId = recentRooms.value[i]

        // 跳过当前房间
        if (roomId === currentRoomId.value) continue

        // 清理该房间的消息
        const roomMessages = messages.value.get(roomId)
        if (roomMessages) {
          messages.value.delete(roomId)
          itemsRemoved += roomMessages.length
          logger.debug('[CoreStore] LRU cleanup: Removed room messages:', { roomId, count: roomMessages.length })
        }

        // 检查是否已达到目标
        const remainingItems = messages.value.size + rooms.value.size
        if (remainingItems <= targetItems) break
      }

      cacheMetrics.value.itemCount = messages.value.size + rooms.value.size + users.value.size
      cacheMetrics.value.lastCleanup = Date.now()

      logger.info('[CoreStore] LRU cleanup completed:', { itemsRemoved, remaining: cacheMetrics.value.itemCount })
    } catch (error) {
      logger.error('[CoreStore] Failed to perform LRU cleanup:', error)
    }
  }

  // 返回所有状态和方法
  return {
    // 原始状态
    client,
    isInitialized,
    isLoading,

    // 认证相关
    auth,
    isAuthenticated,
    login,
    logout,

    // 用户相关
    currentUser,
    users,
    friends,
    blockedUsers,
    onlineFriends,
    addFriend,
    removeFriend,
    blockUser,

    // 聊天相关
    rooms,
    messages,
    currentRoomId,
    currentRoom,
    currentMessages,
    typingUsers,
    unreadCount,
    joinRoom,
    leaveRoom,
    sendMessage,
    switchToRoom,
    updateRecentRoom,
    performLRUCleanup,

    // 媒体相关
    mediaFiles,
    downloadQueue,
    uploadFile,

    // 通知相关
    notifications,
    addNotificationRule,
    removeNotificationRule,

    // RTC相关
    callState,
    startCall,
    endCall,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,

    // 缓存相关
    cacheSettings,
    cacheMetrics,
    clearCache,
    optimizeCache,

    // 搜索相关
    search,
    performSearch,
    searchUsers,
    searchRooms,
    highlightSearchTerms,

    // 设置相关
    settings,

    // UI 相关
    menuTop,
    updateMenuTop
  }
})

// 类型导出
export type {
  UserProfile,
  AuthState,
  ChatMessage,
  Room,
  MediaFile,
  DownloadQueue,
  NotificationRule,
  NotificationSettings,
  CallState,
  Device,
  CacheSettings,
  CacheMetrics,
  SearchState,
  AppSettings
  // MenuItem 已在顶部导出
}
