/**
 * Matrix SDK 适配器实现
 * 基于本地 matrix-js-sdk 实现
 * Phase 4: 集成迁移监控，优先使用 Matrix SDK
 */

import type { MessageAdapter, AuthAdapter, RoomAdapter, FileAdapter, SyncAdapter } from './service-adapter'
import type { MatrixClient, MatrixRoom } from '@/typings/matrix-sdk'
import { matrixConfig } from '@/config/matrix-config'
import { logger } from '@/utils/logger'
import { mxcToHttp } from '@/integrations/matrix/mxc'
import { invoke } from '@tauri-apps/api/core'
import { TauriCommand } from '@/enums'
import { migrationMonitor } from '@/utils/migrationMonitor'

/** 发送消息参数接口 */
interface SendMessageParams {
  roomId: string
  content: { body?: string; [key: string]: unknown }
  type?: string
  encrypted?: boolean
}

/** 发送消息响应接口 */
interface SendMessageResponse {
  eventId: string
  roomId: string
}

/** 历史消息响应接口 */
interface HistoryMessageResponse {
  chunk: unknown[]
}

/** 登录响应接口 */
interface LoginResponse {
  access_token: string
  device_id: string
  user_id: string
  [key: string]: unknown
}

/** 创建房间参数接口 */
interface CreateRoomParams {
  name: string
  room_alias_name?: string
  preset?: 'private_chat' | 'public_chat' | 'trusted_private_chat'
  visibility?: 'public' | 'private'
  invite_3pid?: unknown[]
  initial_state?: unknown[]
  topic?: string
}

/** 创建房间响应接口 */
interface CreateRoomResponse {
  room_id: string
}

/** 加入/离开房间选项接口 */
interface RoomOptions {
  reason?: string
}

/** 房间信息接口 */
interface RoomInfo {
  roomId: string
  name: string
  topic?: string
  memberCount: number
  tags: Record<string, unknown>
  encrypted?: boolean
}

/** 上传文件参数接口 */
interface UploadFileParams {
  file: File | Blob
  roomId?: string
  onProgress?: (progress: number) => void
}

/** 上传文件响应接口 */
interface UploadFileResponse {
  url: string
  name: string
  size: number
  type: string
}

/** 上传选项接口 */
interface UploadOptions {
  name: string
  type: string
  progressHandler?: (event: { loaded: number; total: number }) => void
}

/** 下载文件响应接口 */
interface DownloadFileResponse {
  blob: Blob
  url: string
}

/**
 * Matrix SDK 消息适配器
 */
export class MatrixMessageAdapter implements MessageAdapter {
  name = 'matrix-message'
  priority = 80

  private client: MatrixClient | null = null
  private initialized = false

  async isReady(): Promise<boolean> {
    try {
      // 检查 Matrix SDK 是否已加载
      if (typeof window === 'undefined') {
        return false
      }

      // 检查客户端是否已初始化
      if (!this.initialized) {
        return false
      }

      // 检查是否已登录
      if (!this.client) {
        return false
      }

      return this.client.isLoggedIntoVerifiedServer()
    } catch (error) {
      logger.error('[MatrixMessageAdapter] Readiness check failed:', error)
      return false
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      await matrixConfig.initializeWithDiscovery()
      // 动态加载 Matrix SDK
      const sdk = await import('@/utils/matrix-sdk-loader')

      // 创建客户端实例
      const clientConfig: {
        baseUrl: string
        useAuthorizationHeader: boolean
        deviceId?: string
        accessToken?: string
      } = {
        baseUrl: matrixConfig.getHomeserverUrl(),
        useAuthorizationHeader: true
      }

      const deviceId = localStorage.getItem('deviceId')
      const accessToken = localStorage.getItem('accessToken')

      if (deviceId) {
        clientConfig.deviceId = deviceId
      }
      if (accessToken) {
        clientConfig.accessToken = accessToken
      }

      this.client = await sdk.createClient(clientConfig)

      // 启用自动同步
      this.client?.startClient()

      this.initialized = true
      logger.info('[MatrixMessageAdapter] Initialized successfully')
    } catch (error) {
      logger.error('[MatrixMessageAdapter] Initialization failed:', error)
      throw error
    }
  }

  async sendMessage(params: SendMessageParams): Promise<SendMessageResponse> {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      const msgType = params.type || 'm.room.message'
      const content = {
        msgtype: msgType,
        body: params.content.body || JSON.stringify(params.content),
        ...params.content
      }

      // 如果请求加密
      if (params.encrypted) {
        await this.ensureRoomEncrypted(params.roomId)
      }

      const eventResult = (await this.client.sendEvent(params.roomId, msgType, content)) as { event_id: string }
      const eventId = eventResult.event_id

      logger.debug('[MatrixMessageAdapter] Message sent:', { roomId: params.roomId, eventId })
      return { eventId, roomId: params.roomId }
    } catch (error) {
      logger.error('[MatrixMessageAdapter] Send message failed:', error)
      throw error
    }
  }

  async getHistoryMessages(params: { roomId: string; limit?: number; from?: string }): Promise<unknown[]> {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      const response = (await this.client.getRoomMessages(
        params.roomId,
        params.from || 'END',
        'b',
        params.limit || 50
      )) as HistoryMessageResponse

      return response.chunk || []
    } catch (error) {
      logger.error('[MatrixMessageAdapter] Get history failed:', error)
      throw error
    }
  }

  async markAsRead(params: { roomId: string; messageId: string }): Promise<void> {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      await this.client.sendReadReceipt(params.roomId, params.messageId)
    } catch (error) {
      logger.error('[MatrixMessageAdapter] Mark as read failed:', error)
      throw error
    }
  }

  async cleanup(): Promise<void> {
    if (this.client) {
      try {
        await this.client.stopClient()
      } catch (error) {
        logger.error('[MatrixMessageAdapter] Cleanup failed:', error)
      }
      this.client = null
    }
    this.initialized = false
  }

  private async ensureRoomEncrypted(roomId: string): Promise<void> {
    if (!this.client) {
      return
    }

    try {
      // 检查房间是否已加密
      const room = this.client.getRoom(roomId)
      if (!room) {
        return
      }

      if (room.hasEncryptionStateEvent()) {
        return
      }

      // 发送启用加密的事件
      await this.client.sendStateEvent(roomId, 'm.room.encryption', {
        algorithm: 'm.megolm.v1.aes-sha2',
        rotation_period_ms: 604800000, // 7 days
        rotation_period_msgs: 100
      })
    } catch (error) {
      logger.error('[MatrixMessageAdapter] Enable encryption failed:', error)
    }
  }
}

/**
 * Matrix SDK 认证适配器
 */
export class MatrixAuthAdapter implements AuthAdapter {
  name = 'matrix-auth'
  priority = 80

  private client: MatrixClient | null = null

  async isReady(): Promise<boolean> {
    try {
      await matrixConfig.initializeWithDiscovery()
      return !!matrixConfig.getHomeserverUrl()
    } catch (_error) {
      return false
    }
  }

  async login(params: { username: string; password: string; deviceName?: string }): Promise<LoginResponse> {
    try {
      // 动态加载 Matrix SDK
      const sdk = await import('@/utils/matrix-sdk-loader')

      // 创建临时客户端用于登录
      await matrixConfig.initializeWithDiscovery()
      this.client = await sdk.createClient({
        baseUrl: matrixConfig.getHomeserverUrl(),
        useAuthorizationHeader: false
      })

      const response = await this.client.login('m.login.password', {
        user: params.username,
        password: params.password,
        device_display_name: params.deviceName || 'HuLa Client'
      })

      // 保存登录信息
      localStorage.setItem('accessToken', response.access_token)
      localStorage.setItem('deviceId', response.device_id)
      localStorage.setItem('userId', response.user_id)

      logger.info('[MatrixAuthAdapter] Login successful')
      return response
    } catch (error) {
      logger.error('[MatrixAuthAdapter] Login failed:', error)
      throw error
    }
  }

  async logout(): Promise<void> {
    try {
      if (this.client) {
        await this.client.logout()
        this.client = null
      }

      // 清除本地存储
      localStorage.removeItem('accessToken')
      localStorage.removeItem('deviceId')
      localStorage.removeItem('userId')

      logger.info('[MatrixAuthAdapter] Logout successful')
    } catch (error) {
      logger.error('[MatrixAuthAdapter] Logout failed:', error)
      throw error
    }
  }

  async validateToken(): Promise<boolean> {
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        return false
      }

      if (!this.client) {
        const sdk = await import('@/utils/matrix-sdk-loader')
        await matrixConfig.initializeWithDiscovery()
        const clientConfig: { baseUrl: string; useAuthorizationHeader: boolean; accessToken?: string } = {
          baseUrl: matrixConfig.getHomeserverUrl(),
          useAuthorizationHeader: true
        }
        if (token) {
          clientConfig.accessToken = token
        }
        this.client = await sdk.createClient(clientConfig)
      }

      // 尝试获取用户信息来验证 token
      await this.client.getWhoAmI()
      return true
    } catch (error) {
      logger.warn('[MatrixAuthAdapter] Token validation failed:', error)
      return false
    }
  }

  async cleanup(): Promise<void> {
    this.client = null
  }
}

/**
 * Matrix SDK 房间适配器
 * Phase 4: 使用 matrixClientService，集成迁移监控
 */
export class MatrixRoomAdapter implements RoomAdapter {
  name = 'matrix-room'
  priority = 100 // Phase 4: 提高优先级到 100（高于 WebSocket 的 90）

  private client: MatrixClient | null = null

  async isReady(): Promise<boolean> {
    try {
      // 使用 matrixClientService 检查客户端状态
      const { matrixClientService } = await import('@/integrations/matrix/client')
      const client = matrixClientService.getClient()
      return !!client && matrixClientService.isClientInitialized()
    } catch (_error) {
      return false
    }
  }

  /**
   * 获取 Matrix 客户端实例
   * Phase 4: 使用 matrixClientService 单例
   */
  private async getClient(): Promise<MatrixClient> {
    if (!this.client) {
      const { matrixClientService } = await import('@/integrations/matrix/client')
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }
      // Cast to unknown first, then to MatrixClient
      this.client = client as unknown as MatrixClient
    }
    return this.client
  }

  async createRoom(params: {
    name: string
    type?: 'private' | 'public'
    topic?: string
    avatar?: string
  }): Promise<CreateRoomResponse> {
    const startTime = Date.now()
    try {
      const client = await this.getClient()
      const createRoomParams: CreateRoomParams = {
        name: params.name,
        room_alias_name: params.name.toLowerCase().replace(/\s+/g, '_'),
        preset: params.type === 'public' ? 'public_chat' : 'private_chat',
        visibility: params.type === 'public' ? 'public' : 'private',
        invite_3pid: [],
        initial_state: []
      }

      if (params.topic !== undefined) {
        createRoomParams.topic = params.topic
      }

      const response = (await client.createRoom(createRoomParams)) as CreateRoomResponse

      // Phase 4: 记录性能
      const latency = Date.now() - startTime
      migrationMonitor.recordPerformance('matrix', latency)

      logger.info('[MatrixRoomAdapter] Room created:', response.room_id)
      return response
    } catch (error) {
      logger.error('[MatrixRoomAdapter] Create room failed:', error)
      migrationMonitor.recordError('matrix', error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  }

  async joinRoom(params: { roomId: string; reason?: string }): Promise<void> {
    const startTime = Date.now()
    try {
      const client = await this.getClient()
      const joinOptions: RoomOptions = {}
      if (params.reason !== undefined) {
        joinOptions.reason = params.reason
      }
      await client.joinRoom(params.roomId, joinOptions)

      // Phase 4: 记录性能
      const latency = Date.now() - startTime
      migrationMonitor.recordPerformance('matrix', latency)

      logger.info('[MatrixRoomAdapter] Joined room:', params.roomId)
    } catch (error) {
      logger.error('[MatrixRoomAdapter] Join room failed:', error)
      migrationMonitor.recordError('matrix', error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  }

  async leaveRoom(params: { roomId: string; reason?: string }): Promise<void> {
    const startTime = Date.now()
    try {
      const client = await this.getClient()
      const leaveOptions: RoomOptions = {}
      if (params.reason !== undefined) {
        leaveOptions.reason = params.reason
      }
      await client.leaveRoom(params.roomId, leaveOptions)

      // Phase 4: 记录性能
      const latency = Date.now() - startTime
      migrationMonitor.recordPerformance('matrix', latency)

      logger.info('[MatrixRoomAdapter] Left room:', params.roomId)
    } catch (error) {
      logger.error('[MatrixRoomAdapter] Leave room failed:', error)
      migrationMonitor.recordError('matrix', error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  }

  async getRooms(): Promise<RoomInfo[]> {
    const startTime = Date.now()
    try {
      const client = await this.getClient()
      const rooms = client.getRooms()
      const result = rooms.map((room: MatrixRoom) => ({
        roomId: room.roomId,
        name: room.name,
        topic: room.topic,
        memberCount: room.getJoinedMemberCount(),
        tags: room.tags || {},
        encrypted: room.hasEncryptionStateEvent()
      }))

      // Phase 4: 记录路由决策和性能
      const latency = Date.now() - startTime
      migrationMonitor.recordRoute({
        route: 'matrix',
        encrypted: false
      })
      migrationMonitor.recordPerformance('matrix', latency)

      logger.info('[MatrixRoomAdapter] Get rooms successful via Matrix SDK', {
        count: result.length,
        latency
      })
      return result
    } catch (error) {
      logger.error('[MatrixRoomAdapter] Get rooms failed:', error)
      migrationMonitor.recordError('matrix', error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  }

  async getRoomInfo(roomId: string): Promise<RoomInfo> {
    const startTime = Date.now()
    try {
      const client = await this.getClient()
      const room = client.getRoom(roomId)
      if (!room) {
        throw new Error('Room not found')
      }

      const result = {
        roomId: room.roomId,
        name: room.name,
        topic: room.topic,
        memberCount: room.getJoinedMemberCount(),
        tags: room.tags || {},
        encrypted: room.hasEncryptionStateEvent()
      }

      // Phase 4: 记录性能
      const latency = Date.now() - startTime
      migrationMonitor.recordPerformance('matrix', latency)

      return result
    } catch (error) {
      logger.error('[MatrixRoomAdapter] Get room info failed:', error)
      migrationMonitor.recordError('matrix', error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  }

  async cleanup(): Promise<void> {
    this.client = null
  }
}

/**
 * Matrix SDK 文件适配器
 */
export class MatrixFileAdapter implements FileAdapter {
  name = 'matrix-file'
  priority = 70

  private client: MatrixClient | null = null

  async isReady(): Promise<boolean> {
    try {
      const token = localStorage.getItem('accessToken')
      return !!token
    } catch (_error) {
      return false
    }
  }

  async uploadFile(params: UploadFileParams): Promise<UploadFileResponse> {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      // 上传文件到 Matrix 媒体仓库
      const uploadOptions: UploadOptions = {
        name: (params.file as File).name,
        type: (params.file as File).type
      }

      // 只在有进度回调时才添加 - 需要转换格式
      if (params.onProgress !== undefined) {
        // 转换从 (progress: number) 到 (event: { loaded: number; total: number })
        uploadOptions.progressHandler = (event: { loaded: number; total: number }) => {
          const progress = event.total > 0 ? Math.floor((event.loaded / event.total) * 100) : 0
          params.onProgress!(progress)
        }
      }

      const response = await this.client.uploadContent(params.file, uploadOptions)

      return {
        url: response.content_uri,
        name: (params.file as File).name,
        size: params.file.size,
        type: (params.file as File).type
      }
    } catch (error) {
      logger.error('[MatrixFileAdapter] Upload failed:', error)
      throw error
    }
  }

  async downloadFile(_params: {
    fileId: string
    savePath?: string
    onProgress?: (progress: number) => void
    resumeFrom?: number
  }): Promise<DownloadFileResponse> {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }
    const httpUrl = mxcToHttp(_params.fileId, { authenticated: true })
    const headers: Record<string, string> = {}
    try {
      const tokens = await invoke<{ token: string | null }>(TauriCommand.GET_USER_TOKENS).catch(() => ({ token: null }))
      const access = tokens?.token || localStorage.getItem('accessToken') || ''
      if (access) headers['Authorization'] = `Bearer ${access}`
    } catch {}
    if (_params.resumeFrom && _params.resumeFrom > 0) {
      headers['Range'] = `bytes=${_params.resumeFrom}-`
    }
    let attempt = 0
    const maxRetries = 3
    while (true) {
      try {
        const res = await fetch(httpUrl, { headers })
        const total = Number(res.headers.get('Content-Length')) || 0
        const reader = res.body?.getReader()
        if (!reader) {
          const blob = await res.blob()
          _params.onProgress?.(100)
          return { blob, url: httpUrl }
        }
        let loaded = 0
        const chunks: Uint8Array[] = []
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(value)
          loaded += value.length
          if (total > 0) {
            const p = Math.floor((loaded / total) * 100)
            _params.onProgress?.(p)
          }
        }
        const size = chunks.reduce((s, c) => s + c.length, 0)
        const data = new Uint8Array(size)
        let off = 0
        for (const c of chunks) {
          data.set(c, off)
          off += c.length
        }
        const blob = new Blob([data])
        _params.onProgress?.(100)
        return { blob, url: httpUrl }
      } catch (e) {
        attempt++
        if (attempt >= maxRetries) throw e
        await new Promise((r) => setTimeout(r, 300 * attempt))
        headers['Range'] = `bytes=${_params.resumeFrom || 0}-`
      }
    }
  }

  async getPreview(fileId: string): Promise<string> {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      const url = mxcToHttp(fileId, { authenticated: true })
      return url
    } catch (error) {
      logger.error('[MatrixFileAdapter] Get preview failed:', error)
      throw error
    }
  }

  async cleanup(): Promise<void> {
    this.client = null
  }
}

/**
 * Matrix SDK 同步适配器
 */
export class MatrixSyncAdapter implements SyncAdapter {
  name = 'matrix-sync'
  priority = 80

  private client: MatrixClient | null = null
  private syncing = false

  async isReady(): Promise<boolean> {
    try {
      return !!this.client && this.client.isSyncing()
    } catch (_error) {
      return false
    }
  }

  async startSync(params?: { roomId?: string; fromToken?: string }): Promise<void> {
    if (!this.client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      if (this.syncing) {
        return
      }

      this.client.startClient(params?.fromToken ? { initialSyncLimit: 20 } : undefined)
      this.syncing = true

      logger.info('[MatrixSyncAdapter] Sync started')
    } catch (error) {
      logger.error('[MatrixSyncAdapter] Start sync failed:', error)
      throw error
    }
  }

  async stopSync(): Promise<void> {
    if (!this.client) {
      return
    }

    try {
      await this.client.stopClient()
      this.syncing = false
      logger.info('[MatrixSyncAdapter] Sync stopped')
    } catch (error) {
      logger.error('[MatrixSyncAdapter] Stop sync failed:', error)
      throw error
    }
  }

  async getSyncStatus(): Promise<{
    status: 'syncing' | 'synced' | 'error'
    lastSync?: number
    error?: string
  }> {
    if (!this.client) {
      return { status: 'error', error: 'Client not initialized' }
    }

    try {
      const status = this.client.getSyncState()
      const lastSync = this.client.getLastSyncTime()

      return {
        status: status === 'SYNCING' ? 'syncing' : 'synced',
        ...(lastSync ? { lastSync: new Date(lastSync).getTime() } : {})
      }
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  async cleanup(): Promise<void> {
    if (this.client && this.syncing) {
      await this.stopSync()
    }
    this.client = null
  }
}
