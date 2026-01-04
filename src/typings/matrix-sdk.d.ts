/**
 * Matrix SDK 类型定义
 * 为 Matrix 集成提供基础类型支持
 *
 * @module MatrixSDKTypes
 * @description
 * 本文件定义了Matrix SDK的核心类型接口，用于与本地SDK（../matrix-js-sdk-39.1.3）配合使用。
 * 这些类型定义是对SDK类型的补充，用于项目中的类型安全。
 *
 * Requirements 11.1, 11.2, 11.3: Type definitions matching local SDK
 */

/**
 * Matrix客户端接口
 * 定义了与Matrix服务器交互的核心方法
 */
export interface MatrixClient {
  /** 客户端是否已登录到验证服务器 */
  isLoggedIntoVerifiedServer(): boolean

  /** 启动客户端同步 */
  startClient(opts?: unknown): void

  /** 停止客户端 */
  stopClient(): Promise<void>

  /** 发送事件 */
  sendEvent(roomId: string, type: string, content: unknown): Promise<{ event_id: string }>

  /** 获取房间消息 */
  getRoomMessages(roomId: string, from: string, dir: string, limit?: number): Promise<{
    chunk: unknown[]
    start: string
    end: string
  }>

  /** 发送已读回执 */
  sendReadReceipt(roomId: string, eventId: string): Promise<void>

  /** 获取房间 */
  getRoom(roomId: string): MatrixRoom | null

  /** 登录 */
  login(type: string, params: {
    user: string
    password: string
    device_display_name?: string
    initial_device_display_name?: string
  }): Promise<{
    access_token: string
    device_id: string
    user_id: string
  }>

  /** 登出 */
  logout(): Promise<void>

  /** 获取当前用户信息 */
  getWhoAmI(): Promise<{
    user_id: string
  }>

  /** 创建房间 */
  createRoom(params: {
    name?: string
    room_alias_name?: string
    topic?: string
    preset?: 'private_chat' | 'public_chat' | 'trusted_private_chat'
    visibility?: 'private' | 'public'
    invite?: string[]
    invite_3pid?: unknown[]
    initial_state?: unknown[]
    is_direct?: boolean
    room_version?: string
    creation_content?: { type?: string }
  }): Promise<{
    room_id: string
  }>

  /** 加入房间 */
  joinRoom(roomId: string, opts?: { reason?: string; viaServers?: string[] }): Promise<{
    room_id: string
  }>

  /** 离开房间 */
  leaveRoom(roomId: string, opts?: { reason?: string }): Promise<unknown>

  /** 获取所有房间 */
  getRooms(): MatrixRoom[]

  /** 上传内容 */
  uploadContent(
    file: File | Blob,
    opts?: {
      name?: string
      type?: string
      progressHandler?: (event: { loaded: number; total: number }) => void
    }
  ): Promise<{
    content_uri: string
  }>

  /** 检查是否正在同步 */
  isSyncing(): boolean

  /** 获取同步状态 */
  getSyncState(): string | null

  /** 获取最后同步时间 */
  getLastSyncTime(): number | null

  /** 搜索房间事件 */
  searchRoomEvents(opts: {
    room_ids?: string[]
    search_terms?: string
    filter?: {
      senders?: string[]
      types?: string[]
      start_ts?: number
      end_ts?: number
    }
  }): Promise<{
    results: unknown[]
    count: number
  }>

  /** 获取推送规则 */
  getPushRules(): Promise<{
    global: {
      override: unknown[]
      content: unknown[]
      room: unknown[]
      sender: unknown[]
      underride: unknown[]
    }
    device: Record<string, unknown>
  }>

  /** 发送状态事件 */
  sendStateEvent(roomId: string, type: string, content: unknown, stateKey?: string): Promise<unknown>

  /** 获取用户ID */
  getUserId(): string | null

  /** 获取设备ID */
  getDeviceId(): string | null

  /** 获取用户 */
  getUser(userId: string): MatrixUser | null

  /** 获取账户数据 */
  getAccountData(eventType: string): { getContent(): unknown } | null

  /** 设置账户数据 */
  setAccountData(eventType: string, content: unknown): Promise<void>

  /** 邀请用户 */
  invite(roomId: string, userId: string): Promise<void>

  /** 离开房间 */
  leave(roomId: string): Promise<void>

  /** 踢出用户 */
  kick(roomId: string, userId: string, reason?: string): Promise<void>

  /** 封禁用户 */
  ban(roomId: string, userId: string, reason?: string): Promise<void>

  /** 解除封禁 */
  unban(roomId: string, userId: string): Promise<void>

  /** 撤回事件 */
  redactEvent(roomId: string, eventId: string, reason?: string): Promise<unknown>

  /** 设置房间标签 */
  setRoomTag(roomId: string, tag: string, content: { order?: number }): Promise<void>

  /** 删除房间标签 */
  deleteRoomTag(roomId: string, tag: string): Promise<void>

  /** 获取用户资料 */
  getProfileInfo(userId: string): Promise<{ displayname?: string; avatar_url?: string }>

  /** 获取加密模块 */
  getCrypto(): MatrixCrypto | null

  /** HTTP客户端 */
  http: MatrixHttpApi

  /** 注册事件监听器 */
  on(eventName: string, listener: (...args: unknown[]) => void): void

  /** 移除事件监听器 */
  off(eventName: string, listener: (...args: unknown[]) => void): void

  /** 获取用户设备列表 */
  getUserDevices(userId: string): Promise<Device[]>

  /** 获取自己的设备列表 */
  getOwnDevices(): Promise<Map<string, Device>>

  /** 设置设备验证状态 */
  setDeviceVerified(deviceId: string, verified: boolean): Promise<boolean>

  /** 请求设备验证 */
  requestDeviceVerification(deviceId: string, opts: { method: string; from_device_id?: string }): Promise<string>

  /** 开始设备验证 */
  startDeviceVerification(transactionId: string): Promise<void>

  /** 接受验证 */
  acceptVerification(transactionId: string): Promise<void>

  /** 确认验证 */
  confirmVerification(transactionId: string): Promise<void>

  /** 获取二维码 */
  getQRCode(transactionId: string): Promise<string>

  /** 扫描二维码 */
  scanQRCode(transactionId: string, qrData: string): Promise<boolean>

  /** 启用交叉签名 */
  bootstrapCrossSigning(): Promise<boolean>

  /** 重置交叉签名 */
  resetCrossSigning(): Promise<boolean>

  /** 准备密钥备份版本 */
  prepareKeyBackupVersion(passphrase?: string): Promise<KeyBackupInfo | null>

  /** 开始密钥备份 */
  startKeyBackup(backupInfo: KeyBackupInfo): Promise<void>

  /** 获取密钥备份版本 */
  getKeyBackupVersion(): Promise<KeyBackupInfo | null>

  /** 获取密钥备份版本列表 */
  getKeyBackupVersions(): Promise<KeyBackupInfo[]>

  /** 恢复密钥备份 */
  restoreKeyBackup(version: KeyBackupInfo, passphrase?: string): Promise<boolean>

  /** 删除密钥备份版本 */
  deleteKeyBackupVersion(): Promise<void>

  /** 设置房间加密 */
  setRoomEncryption(roomId: string, config: { algorithm: string }): Promise<void>

  /** 获取房间层级 */
  getRoomHierarchy(roomId: string, limit?: number, maxDepth?: number, suggestedOnly?: boolean, fromToken?: string): Promise<{
    rooms: RoomHierarchyRoom[]
    next_batch?: string
  }>

  /** 初始化同步完成状态 */
  isInitialSyncComplete(): boolean

  /** 获取房间层级信息 */
}

export interface Device {
  device_id: string
  user_id: string
  display_name?: string
  last_seen_ts?: number
  keys: {
    ed25519: string
    curve25519: string
  }
  algorithms: string[]
  verified?: boolean
}

export interface KeyBackupInfo {
  version: string
  algorithm: string
  auth_data?: {
    megolm_backup_info?: {
      count: number
    }
  }
}

export interface RoomHierarchyRoom {
  room_id: string
  name?: string
  canonical_alias?: string
  topic?: string
  avatar_url?: string
  room_type?: string
  membership?: string
  num_joined_members?: number
  world_readable?: boolean
  join_rule?: string
  children_state?: Array<{
    type: string
    state_key: string
    content: unknown
  }>
}

export interface ISearchParams {
  search_terms?: string
  term?: string
  filter?: {
    room_ids?: string[]
    senders?: string[]
    types?: string[]
    start_ts?: number
    end_ts?: number
  }
}

/**
 * Matrix用户接口
 */
export interface MatrixUser {
  userId: string
  presence?: 'online' | 'offline' | 'unavailable' | 'away'
  lastActiveAgo?: number
  displayName?: string
  avatarUrl?: string
}

/**
 * Matrix加密模块接口
 */
export interface MatrixCrypto {
  /** 检查并启用密钥备份 */
  checkKeyBackupAndEnable(): Promise<{ version: string; algorithm: string } | null>

  /** 检查密钥备份是否可信 */
  isKeyBackupTrusted(backupInfo: unknown): Promise<{ usable: boolean; trusted_locally: boolean }>

  /** 获取备份密钥数量 */
  getBackupKeyCount(): Promise<number>

  /** 重置密钥备份 */
  resetKeyBackup(): Promise<{ version: string; recoveryKey: string }>

  /** 使用恢复密钥恢复密钥备份 */
  restoreKeyBackupWithRecoveryKey(recoveryKey: string): Promise<{ imported: number; total: number }>
}

/**
 * Matrix HTTP API接口
 */
export interface MatrixHttpApi {
  /** 发起认证请求 */
  authedRequest(
    callback: undefined,
    method: string,
    path: string,
    queryParams?: unknown,
    body?: unknown,
    opts?: { prefix?: string }
  ): Promise<unknown>
}

export interface MatrixRoom {
  /** 房间ID */
  roomId: string

  /** 房间名称 */
  name: string

  /** 房间主题 */
  topic: string

  /** 获取加入成员数量 */
  getJoinedMemberCount(): number

  /** 房间标签 */
  tags: Record<string, unknown>

  /** 检查是否有加密状态事件 */
  hasEncryptionStateEvent(): boolean

  /** 获取当前用户的成员状态 */
  getMyMembership(): string

  /** 获取房间规范别名 */
  getCanonicalAlias(): string | null

  /** 查找事件 */
  findEventById(eventId: string): MatrixEvent | null

  /** 获取加入的成员 */
  getJoinedMembers(): MatrixRoomMember[]

  /** 获取未读通知数 */
  getUnreadNotificationCount(): { highlightCount: number; notificationCount: number } | null
}

/**
 * Matrix事件接口
 */
export interface MatrixEvent {
  /** 获取事件类型 */
  getType(): string

  /** 获取事件内容 */
  getContent(): Record<string, unknown>

  /** 获取房间ID */
  getRoomId(): string

  /** 获取发送者 */
  getSender(): string

  /** 获取事件ID */
  getId(): string

  /** 获取时间戳 */
  getTs(): number

  /** 获取关联事件 */
  getRelation(): Record<string, unknown> | null

  /** 是否加密 */
  isEncrypted(): boolean

  /** 是否状态事件 */
  isState(): boolean

  /** 尝试解密 */
  attemptDecryption(client: MatrixClient, options?: { retry?: boolean }): Promise<void>

  /** 获取房间 */
  getRoom(): MatrixRoom | null
}

/**
 * Matrix房间成员接口
 */
export interface MatrixRoomMember {
  /** 用户ID */
  userId: string

  /** 名称 */
  name: string

  /** 获取头像URL */
  getAvatarUrl?: () => string | null
}

export interface MatrixSDKLoader {
  /** 创建客户端 */
  createClient(opts: {
    baseUrl: string
    useAuthorizationHeader?: boolean
    deviceId?: string
    accessToken?: string
  }): Promise<MatrixClient>
}

declare module '@/utils/matrix-sdk-loader' {
  export function createClient(opts: {
    baseUrl: string
    useAuthorizationHeader?: boolean
    deviceId?: string
    accessToken?: string
  }): Promise<MatrixClient>
}

declare module '@matrix-js-sdk' {
  export const createClient: (opts: {
    baseUrl: string
    useAuthorizationHeader?: boolean
    deviceId?: string
    accessToken?: string
  }) => Promise<MatrixClient>
}

declare module 'matrix-js-sdk' {
  export const createClient: (opts: {
    baseUrl: string
    useAuthorizationHeader?: boolean
    deviceId?: string
    accessToken?: string
  }) => Promise<MatrixClient>
}