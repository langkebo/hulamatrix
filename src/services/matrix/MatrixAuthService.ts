import { AuthType } from '@/lib/matrix-sdk'
import MatrixClientService from './MatrixClientService'
import { setMatrixConfig } from '@/config/matrix'
import { discoverHomeserver } from './ServerDiscoveryService'
import type { MatrixUser } from '@/types/matrix'

class MatrixAuthService {
  private static instance: MatrixAuthService

  private constructor() {}

  static getInstance(): MatrixAuthService {
    if (!MatrixAuthService.instance) {
      MatrixAuthService.instance = new MatrixAuthService()
    }
    return MatrixAuthService.instance
  }

  async loginWithPassword(
    username: string,
    password: string,
    homeserver?: string
  ): Promise<{ accessToken: string; userId: string; deviceId: string }> {
    const baseUrl = homeserver ? await discoverHomeserver(homeserver) : await discoverHomeserver()

    const clientService = MatrixClientService.getInstance()
    const client = await clientService.createClient({ baseUrl })
    if (!client) {
      throw new Error('Failed to create Matrix client')
    }

    try {
      const response = await client.login(AuthType.Password, {
        user: username,
        password
      })

      const sessionData = {
        accessToken: response.access_token,
        userId: response.user_id,
        deviceId: response.device_id
      }

      setMatrixConfig({
        baseUrl,
        ...sessionData
      })

      return sessionData
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Login failed:', error)
      }
      throw error
    }
  }

  async loginWithToken(token: string, homeserver?: string): Promise<{ userId: string; deviceId: string }> {
    const baseUrl = homeserver ? await discoverHomeserver(homeserver) : await discoverHomeserver()

    const clientService = MatrixClientService.getInstance()
    const client = await clientService.createClient({ baseUrl, accessToken: token })
    if (!client) {
      throw new Error('Failed to create Matrix client')
    }

    try {
      const whoami = await client.whoami()
      const sessionData = {
        userId: whoami.user_id,
        deviceId: whoami.device_id || ''
      }

      setMatrixConfig({
        baseUrl,
        accessToken: token,
        ...sessionData
      })

      return sessionData
    } catch (error) {
      console.error('Token login failed:', error)
      throw error
    }
  }

  async register(
    username: string,
    password: string,
    authType?: AuthType,
    homeserver?: string
  ): Promise<{ accessToken: string; userId: string; deviceId: string }> {
    const baseUrl = homeserver ? await discoverHomeserver(homeserver) : await discoverHomeserver()

    const clientService = MatrixClientService.getInstance()
    const client = await clientService.createClient({ baseUrl })
    if (!client) {
      throw new Error('Failed to create Matrix client')
    }

    try {
      const response = await client.register(username, password, null, { type: authType || AuthType.Dummy })

      const accessToken = response.access_token
      const userId = response.user_id
      const deviceId = response.device_id

      if (!accessToken || !userId || !deviceId) {
        throw new Error('Registration response missing required fields')
      }

      const sessionData = {
        accessToken,
        userId,
        deviceId
      }

      setMatrixConfig({
        baseUrl,
        ...sessionData
      })

      return sessionData
    } catch (error) {
      console.error('Registration failed:', error)
      throw error
    }
  }

  async logout(): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      return
    }

    try {
      await client.logout(true)
    } catch (error) {
      console.error('Logout failed:', error)
    } finally {
      await clientService.clearSession()
    }
  }

  async logoutAll(): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      return
    }

    try {
      await client.logoutAll(true)
    } catch (error) {
      console.error('Logout all devices failed:', error)
    } finally {
      await clientService.clearSession()
    }
  }

  async getCurrentUser(): Promise<MatrixUser | null> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      return null
    }

    try {
      const userId = client.getUserId()
      if (!userId) {
        return null
      }

      const user = client.getUser(userId)
      if (!user) {
        return {
          userId,
          presence: 'offline'
        }
      }

      return {
        userId: user.userId,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        presence: (user.presence as 'online' | 'offline' | 'unavailable') || 'offline',
        lastActiveAgo: user.lastActiveAgo
      }
    } catch (error) {
      console.error('Failed to get current user:', error)
      return null
    }
  }

  async getUserProfile(userId: string): Promise<MatrixUser | null> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      return null
    }

    try {
      const user = client.getUser(userId)
      if (!user) {
        return null
      }

      return {
        userId: user.userId,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        presence: (user.presence as 'online' | 'offline' | 'unavailable') || 'offline',
        lastActiveAgo: user.lastActiveAgo
      }
    } catch (error) {
      console.error('Failed to get user profile:', error)
      return null
    }
  }

  async setDisplayName(displayName: string): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      await client.setDisplayName(displayName)
    } catch (error) {
      console.error('Failed to set display name:', error)
      throw error
    }
  }

  async setAvatarUrl(avatarUrl: string): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      await client.setAvatarUrl(avatarUrl)
    } catch (error) {
      console.error('Failed to set avatar URL:', error)
      throw error
    }
  }

  async uploadAvatar(file: File): Promise<string> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      const response = await client.uploadContent(file, {
        type: file.type,
        name: file.name
      })
      return response.content_uri
    } catch (error) {
      console.error('Failed to upload avatar:', error)
      throw error
    }
  }

  async getDevices(): Promise<any[]> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      const response = await client.getDevices()
      return response.devices || []
    } catch (error) {
      console.error('Failed to get devices:', error)
      throw error
    }
  }

  async deleteDevice(deviceId: string, auth?: any): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      await client.deleteDevice(deviceId, auth)
    } catch (error) {
      console.error('Failed to delete device:', error)
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
      const crypto = client.getCrypto()
      if (!crypto) {
        throw new Error('Crypto not initialized')
      }

      const userId = client.getUserId()
      if (!userId) {
        throw new Error('User not logged in')
      }

      await crypto.setDeviceVerified(userId, deviceId, true)
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
      const crypto = client.getCrypto()
      if (!crypto) {
        throw new Error('Crypto not initialized')
      }

      const userId = client.getUserId()
      if (!userId) {
        throw new Error('User not logged in')
      }

      await crypto.setDeviceVerified(userId, deviceId, false)
    } catch (error) {
      console.error('Failed to unverify device:', error)
      throw error
    }
  }

  async setPresence(presence: 'online' | 'offline' | 'unavailable', statusMessage?: string): Promise<void> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      await client.setPresence({
        presence,
        status_msg: statusMessage
      })
    } catch (error) {
      console.error('Failed to set presence:', error)
      throw error
    }
  }

  async isLoggedIn(): Promise<boolean> {
    const clientService = MatrixClientService.getInstance()
    const client = clientService.getClient()

    if (!client) {
      return false
    }

    try {
      const userId = client.getUserId()
      const accessToken = client.getAccessToken()
      return !!(userId && accessToken)
    } catch (_error) {
      return false
    }
  }
}

export default MatrixAuthService
