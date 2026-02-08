import MatrixClientService from './MatrixClientService'
import { ref, type Ref } from 'vue'

export interface UserProfile {
  userId: string
  displayName: string | null
  avatarUrl: string | null
  status?: string
  statusMessage?: string
}

export interface UserDevice {
  deviceId: string
  displayName: string
  lastSeen: number
  lastSeenIp?: string
  isCurrentDevice: boolean
  isVerified: boolean
  deviceType: 'mobile' | 'desktop' | 'web' | 'unknown'
}

export interface UserSearchResult {
  userId: string
  displayName: string | null
  avatarUrl: string | null
  isDirectMessage?: boolean
}

class MatrixUserService {
  private static instance: MatrixUserService
  private userListeners: Map<string, ((data: any) => void)[]> = new Map()

  private _currentProfile: Ref<UserProfile | null> = ref(null)
  private _devices: Ref<UserDevice[]> = ref([])
  private _isLoading: Ref<boolean> = ref(false)

  private constructor() {}

  static getInstance(): MatrixUserService {
    if (!MatrixUserService.instance) {
      MatrixUserService.instance = new MatrixUserService()
    }
    return MatrixUserService.instance
  }

  get currentProfile(): Ref<UserProfile | null> {
    return this._currentProfile
  }

  get devices(): Ref<UserDevice[]> {
    return this._devices
  }

  get isLoading(): Ref<boolean> {
    return this._isLoading
  }

  get currentUser(): UserProfile | null {
    return this._currentProfile.value
  }

  get displayName(): string | null {
    return this._currentProfile.value?.displayName || null
  }

  get avatarUrl(): string | null {
    return this._currentProfile.value?.avatarUrl || null
  }

  get statusMessage(): string | undefined {
    return this._currentProfile.value?.statusMessage
  }

  async loadCurrentProfile(): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      this._isLoading.value = true
      const userId = client.getUserId()
      if (!userId) return

      const profile = await (client as any).getUserProfile(userId)
      this._currentProfile.value = {
        userId,
        displayName: profile.displayname || null,
        avatarUrl: profile.avatar_url || null
      }
    } catch (error) {
      console.error('Failed to load current profile:', error)
    } finally {
      this._isLoading.value = false
    }
  }

  async updateDisplayName(name: string): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      await client.setDisplayName(name)
      if (this._currentProfile.value) {
        this._currentProfile.value.displayName = name
      }
      this.notifyListeners('displayNameChanged', { displayName: name })
    } catch (error) {
      console.error('Failed to update display name:', error)
      throw error
    }
  }

  async setDisplayName(name: string): Promise<boolean> {
    try {
      await this.updateDisplayName(name)
      return true
    } catch (error) {
      console.error('Failed to set display name:', error)
      return false
    }
  }

  async updateAvatar(avatarUrl: string): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      await client.setAvatarUrl(avatarUrl)
      if (this._currentProfile.value) {
        this._currentProfile.value.avatarUrl = avatarUrl
      }
      this.notifyListeners('avatarChanged', { avatarUrl })
    } catch (error) {
      console.error('Failed to update avatar:', error)
      throw error
    }
  }

  async setAvatarUrl(avatarUrl: string): Promise<boolean> {
    try {
      await this.updateAvatar(avatarUrl)
      return true
    } catch (error) {
      console.error('Failed to set avatar URL:', error)
      return false
    }
  }

  async setStatusMessage(message: string): Promise<boolean> {
    try {
      if (this._currentProfile.value) {
        this._currentProfile.value.statusMessage = message
      }
      this.notifyListeners('statusMessageChanged', { message })
      return true
    } catch (error) {
      console.error('Failed to set status message:', error)
      return false
    }
  }

  async clearStatusMessage(): Promise<boolean> {
    return this.setStatusMessage('')
  }

  async loadDevices(): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      this._isLoading.value = true

      const deviceList = await client.getDevices()
      const currentDeviceId = client.getDeviceId()

      this._devices.value = deviceList.devices.map((device: any) =>
        this.convertDevice(device, currentDeviceId || undefined)
      )
    } catch (error) {
      console.error('Failed to load devices:', error)
    } finally {
      this._isLoading.value = false
    }
  }

  async getDevices(): Promise<UserDevice[]> {
    await this.loadDevices()
    return this._devices.value
  }

  async getDevice(deviceId: string): Promise<UserDevice | null> {
    await this.loadDevices()
    return this._devices.value.find((d) => d.deviceId === deviceId) || null
  }

  private convertDevice(device: any, currentDeviceId?: string): UserDevice {
    return {
      deviceId: device.device_id,
      displayName: device.display_name || `Device ${(device.device_id || '').slice(0, 8)}`,
      lastSeen: device.last_seen_ts || 0,
      lastSeenIp: device.last_seen_ip,
      isCurrentDevice: device.device_id === currentDeviceId,
      isVerified: device.verified || false,
      deviceType: this.detectDeviceType(device.display_name)
    }
  }

  private detectDeviceType(displayName?: string): UserDevice['deviceType'] {
    if (!displayName) return 'unknown'

    const name = displayName.toLowerCase()
    if (name.includes('mobile') || name.includes('phone') || name.includes('android') || name.includes('iphone')) {
      return 'mobile'
    }
    if (name.includes('desktop') || name.includes('windows') || name.includes('mac') || name.includes('linux')) {
      return 'desktop'
    }
    if (name.includes('web') || name.includes('browser')) {
      return 'web'
    }
    return 'unknown'
  }

  async renameDevice(deviceId: string, newName: string): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      await (client as any).setDeviceName(deviceId, newName)
      await this.loadDevices()
      this.notifyListeners('deviceRenamed', { deviceId, name: newName })
    } catch (error) {
      console.error('Failed to rename device:', error)
      throw error
    }
  }

  async verifyDevice(deviceId: string): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      await (client as any).setDeviceVerified(deviceId, true)
      await this.loadDevices()
      this.notifyListeners('deviceVerified', { deviceId })
    } catch (error) {
      console.error('Failed to verify device:', error)
      throw error
    }
  }

  async unverifyDevice(deviceId: string): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      await (client as any).setDeviceVerified(deviceId, false)
      await this.loadDevices()
      this.notifyListeners('deviceUnverified', { deviceId })
    } catch (error) {
      console.error('Failed to unverify device:', error)
      throw error
    }
  }

  async logoutDevice(deviceId: string): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      await client.deleteDevice(deviceId)
      await this.loadDevices()
      this.notifyListeners('deviceLoggedOut', { deviceId })
    } catch (error) {
      console.error('Failed to logout device:', error)
      throw error
    }
  }

  async remoteLogoutDevice(deviceId: string): Promise<boolean> {
    try {
      await this.logoutDevice(deviceId)
      return true
    } catch (error) {
      console.error('Failed to remote logout device:', error)
      return false
    }
  }

  async getDeviceLogoutHistory(): Promise<any[]> {
    return []
  }

  async searchUsers(query: string, limit = 10): Promise<UserSearchResult[]> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      const results = await client.searchUserDirectory({
        term: query,
        limit
      })

      return results.results.map((profile: any) => ({
        userId: profile.user_id,
        displayName: profile.display_name || null,
        avatarUrl: profile.avatar_url || null
      }))
    } catch (error) {
      console.error('Failed to search users:', error)
      return []
    }
  }

  async searchUserDirectory(query: string, limit = 10): Promise<UserSearchResult[]> {
    return this.searchUsers(query, limit)
  }

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      const profile = await (client as any).getUserProfile(userId)
      return {
        userId,
        displayName: profile.displayname || null,
        avatarUrl: profile.avatar_url || null
      }
    } catch (error) {
      console.error('Failed to get user profile:', error)
      return null
    }
  }

  async getUser(userId: string): Promise<any> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      return null
    }

    return client.getUser(userId)
  }

  async getDirectMessageRoom(userId: string): Promise<string | null> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      return null
    }

    const dmRooms = client.getRooms().filter((room: any) => {
      if (!room.isDirectMessageRoom?.()) return false
      const members = room.getJoinedMembers()
      return members.some((member: any) => member.userId === userId)
    })

    return dmRooms.length > 0 ? dmRooms[0].roomId : null
  }

  async createDirectMessageRoom(userId: string): Promise<string> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      const result = await client.createRoom({
        is_direct: true,
        invite: [userId],
        preset: 'private_chat' as any
      })
      return result.room_id
    } catch (error) {
      console.error('Failed to create direct message room:', error)
      throw error
    }
  }

  async createDirectChat(userId: string): Promise<string> {
    return this.createDirectMessageRoom(userId)
  }

  async getDirectChatRooms(): Promise<any[]> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      return []
    }

    try {
      const rooms = client.getRooms()
      return rooms.filter((room: any) => room.isDirectMessageRoom?.())
    } catch (error) {
      console.error('Failed to get direct chat rooms:', error)
      return []
    }
  }

  async startDirectMessage(userId: string): Promise<string> {
    const existingRoomId = await this.getDirectMessageRoom(userId)
    if (existingRoomId) {
      return existingRoomId
    }
    return await this.createDirectMessageRoom(userId)
  }

  async getUserOnlineStatus(userId: string): Promise<string> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      return 'offline'
    }

    try {
      const user = client.getUser(userId)
      return user?.presence || 'offline'
    } catch (error) {
      console.error('Failed to get user online status:', error)
      return 'offline'
    }
  }

  async getUsersOnlineStatus(userIds: string[]): Promise<string[]> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      return userIds.map(() => 'offline')
    }

    try {
      const statuses: string[] = []
      for (const userId of userIds) {
        const user = client.getUser(userId)
        statuses.push(user?.presence || 'offline')
      }
      return statuses
    } catch (error) {
      console.error('Failed to get users online status:', error)
      return userIds.map(() => 'offline')
    }
  }

  async setOnlineStatus(status: 'online' | 'offline' | 'unavailable' | 'invisible'): Promise<boolean> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      return false
    }

    try {
      await client.setPresence({ presence: status === 'invisible' ? 'offline' : status })
      return true
    } catch (error) {
      console.error('Failed to set online status:', error)
      return false
    }
  }

  on(event: string, listener: (data: any) => void): void {
    if (!this.userListeners.has(event)) {
      this.userListeners.set(event, [])
    }
    this.userListeners.get(event)?.push(listener)
  }

  off(event: string, listener: (data: any) => void): void {
    const listeners = this.userListeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(listener)
      if (index !== -1) {
        listeners.splice(index, 1)
      }
    }
  }

  private notifyListeners(event: string, data: any): void {
    const listeners = this.userListeners.get(event)
    if (listeners) {
      listeners.forEach((listener) => listener(data))
    }
  }

  destroy(): void {
    this.userListeners.clear()
    this._currentProfile.value = null
    this._devices.value = []
    this._isLoading.value = false
  }
}

export default MatrixUserService
