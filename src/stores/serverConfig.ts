/**
 * Server Configuration Store
 * 服务器配置状态管理
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { matrixServerDiscovery } from '@/integrations/matrix/server-discovery'
import { getMatrixBaseUrl } from '@/utils/matrixEnv'
import type { ServerConfig, HealthStatus, AddServerForm } from '@/types/server'
import { logger } from '@/utils/logger'

export const useServerConfigStore = defineStore('serverConfig', () => {
  // 状态
  const servers = ref<ServerConfig[]>([])
  const currentServerId = ref<string>('')
  const healthStatusMap = ref<Map<string, HealthStatus>>(new Map())
  const isLoading = ref(false)

  // 计算属性
  const currentServer = computed(() => {
    if (currentServerId.value) {
      return servers.value.find((s) => s.id === currentServerId.value)
    }
    return servers.value.find((s) => s.isDefault) || null
  })

  const savedServers = computed(() => {
    return servers.value.filter((s) => s.isCustom)
  })

  const defaultServer = computed(() => {
    return servers.value.find((s) => s.isDefault)
  })

  const currentHealthStatus = computed(() => {
    if (currentServer.value) {
      return healthStatusMap.value.get(currentServer.value.id)
    }
    return null
  })

  /**
   * 初始化服务器配置
   */
  const initialize = async () => {
    try {
      logger.info('[ServerConfig] Initializing server configuration')

      // 加载默认服务器
      const defaultUrl = getMatrixBaseUrl()
      const defaultServer: ServerConfig = {
        id: 'default',
        name: '默认服务器',
        homeserverUrl: defaultUrl,
        displayName: 'Matrix 服务器',
        isCustom: false,
        isDefault: true
      }

      // 加载已保存的自定义服务器
      const saved = loadSavedServers()

      servers.value = [defaultServer, ...saved]

      // 设置当前服务器
      if (currentServerId.value) {
        const exists = servers.value.find((s) => s.id === currentServerId.value)
        if (!exists) {
          currentServerId.value = 'default'
        }
      } else {
        currentServerId.value = 'default'
      }

      // 检查当前服务器健康状态
      if (currentServer.value) {
        await checkHealth(currentServer.value.id)
      }

      logger.info('[ServerConfig] Server configuration initialized', {
        serverCount: servers.value.length,
        currentServer: currentServer.value?.name
      })
    } catch (error) {
      logger.error('[ServerConfig] Failed to initialize:', error)
    }
  }

  /**
   * 从 localStorage 加载已保存的服务器
   */
  const loadSavedServers = (): ServerConfig[] => {
    try {
      const saved = localStorage.getItem('matrix_servers')
      if (saved) {
        return JSON.parse(saved) as ServerConfig[]
      }
    } catch (error) {
      logger.error('[ServerConfig] Failed to load saved servers:', error)
    }
    return []
  }

  /**
   * 保存服务器到 localStorage
   */
  const saveServers = () => {
    try {
      const customServers = servers.value.filter((s) => s.isCustom)
      localStorage.setItem('matrix_servers', JSON.stringify(customServers))
    } catch (error) {
      logger.error('[ServerConfig] Failed to save servers:', error)
    }
  }

  /**
   * 添加服务器
   */
  const addServer = async (form: AddServerForm): Promise<ServerConfig> => {
    isLoading.value = true
    try {
      logger.info('[ServerConfig] Adding server', { name: form.name, url: form.homeserverUrl })

      // 执行服务发现
      const discoveryResult = await matrixServerDiscovery.discover(form.homeserverUrl, {
        timeout: 10000,
        skipCache: false
      })

      const newServer: ServerConfig = {
        id: `server_${Date.now()}`,
        name: form.name,
        homeserverUrl: discoveryResult.homeserverUrl,
        displayName: form.displayName || form.name,
        isCustom: true,
        isDefault: false,
        discoveryResult: {
          homeserver: {
            base_url: discoveryResult.homeserverUrl,
            state: 'success'
          }
        },
        lastConnected: Date.now()
      }

      servers.value.push(newServer)
      saveServers()

      // 检查健康状态
      await checkHealth(newServer.id)

      logger.info('[ServerConfig] Server added successfully', { id: newServer.id, name: newServer.name })

      return newServer
    } catch (error) {
      logger.error('[ServerConfig] Failed to add server:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 删除服务器
   */
  const deleteServer = (serverId: string) => {
    try {
      logger.info('[ServerConfig] Deleting server', { serverId })

      const server = servers.value.find((s) => s.id === serverId)
      if (!server) {
        throw new Error('Server not found')
      }

      if (server.isDefault) {
        throw new Error('Cannot delete default server')
      }

      servers.value = servers.value.filter((s) => s.id !== serverId)
      healthStatusMap.value.delete(serverId)
      saveServers()

      // 如果删除的是当前服务器，切换到默认服务器
      if (currentServerId.value === serverId) {
        currentServerId.value = 'default'
      }

      logger.info('[ServerConfig] Server deleted successfully', { serverId })
    } catch (error) {
      logger.error('[ServerConfig] Failed to delete server:', error)
      throw error
    }
  }

  /**
   * 设置默认服务器
   */
  const setDefaultServer = (serverId: string) => {
    try {
      logger.info('[ServerConfig] Setting default server', { serverId })

      // 取消所有服务器默认状态
      servers.value.forEach((s) => {
        s.isDefault = false
      })

      // 设置新的默认服务器
      const server = servers.value.find((s) => s.id === serverId)
      if (!server) {
        throw new Error('Server not found')
      }

      server.isDefault = true
      currentServerId.value = serverId
      saveServers()

      logger.info('[ServerConfig] Default server set successfully', { serverId, name: server.name })
    } catch (error) {
      logger.error('[ServerConfig] Failed to set default server:', error)
      throw error
    }
  }

  /**
   * 选择服务器
   */
  const selectServer = async (serverId: string) => {
    try {
      logger.info('[ServerConfig] Selecting server', { serverId })

      const server = servers.value.find((s) => s.id === serverId)
      if (!server) {
        throw new Error('Server not found')
      }

      currentServerId.value = serverId
      server.lastConnected = Date.now()
      saveServers()

      // 检查健康状态
      await checkHealth(serverId)

      logger.info('[ServerConfig] Server selected successfully', { serverId, name: server.name })
    } catch (error) {
      logger.error('[ServerConfig] Failed to select server:', error)
      throw error
    }
  }

  /**
   * 检查服务器健康状态
   */
  const checkHealth = async (serverId: string): Promise<HealthStatus> => {
    try {
      const server = servers.value.find((s) => s.id === serverId)
      if (!server) {
        throw new Error('Server not found')
      }

      logger.debug('[ServerConfig] Checking server health', { serverId, url: server.homeserverUrl })

      const healthCheckResult = await matrixServerDiscovery.checkServerHealth(server.homeserverUrl)

      // 转换为 HealthStatus 类型
      const healthStatus: HealthStatus = {
        reachable: healthCheckResult.reachable,
        version: healthCheckResult.version,
        responseTime: healthCheckResult.responseTime,
        error: healthCheckResult.error,
        capabilities: healthCheckResult.capabilities
          ? {
              versions: healthCheckResult.capabilities.versions || [],
              unstableFeatures: healthCheckResult.capabilities.unstableFeatures || {},
              roomVersions: healthCheckResult.capabilities.roomVersions
            }
          : undefined,
        checkedAt: Date.now()
      }

      healthStatusMap.value.set(serverId, healthStatus)

      logger.debug('[ServerConfig] Server health check result', {
        serverId,
        reachable: healthStatus.reachable
      })

      return healthStatus
    } catch (error) {
      logger.error('[ServerConfig] Failed to check server health:', error)
      const errorStatus: HealthStatus = {
        reachable: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        checkedAt: Date.now()
      }
      healthStatusMap.value.set(serverId, errorStatus)
      return errorStatus
    }
  }

  /**
   * 刷新所有服务器健康状态
   */
  const refreshAllHealth = async () => {
    logger.info('[ServerConfig] Refreshing all server health statuses')

    const promises = servers.value.map((server) => checkHealth(server.id))
    await Promise.allSettled(promises)

    logger.info('[ServerConfig] All server health statuses refreshed')
  }

  /**
   * 清除服务器缓存
   */
  const clearCache = () => {
    logger.info('[ServerConfig] Clearing server cache')
    localStorage.removeItem('matrix_servers')
    servers.value = []
    healthStatusMap.value.clear()
  }

  return {
    // 状态
    servers,
    currentServerId,
    isLoading,
    // 计算属性
    currentServer,
    savedServers,
    defaultServer,
    currentHealthStatus,
    // 方法
    initialize,
    addServer,
    deleteServer,
    setDefaultServer,
    selectServer,
    checkHealth,
    refreshAllHealth,
    clearCache
  }
})
