/**
 * useMatrixBeacons Hook
 * Composable for managing Matrix Beacons (real-time location sharing)
 *
 * @module hooks/useMatrixBeacons
 */

import { ref, computed, onUnmounted, watch } from 'vue'
import { useGeolocation } from './useGeolocation'
import {
  matrixBeaconService,
  type Beacon,
  type BeaconLocation,
  type CreateBeaconOptions
} from '@/services/matrixBeaconService'
import { logger } from '@/utils/logger'

export interface UseMatrixBeaconsOptions {
  roomId?: string
  autoLoad?: boolean
}

export function useMatrixBeacons(options: UseMatrixBeaconsOptions = {}) {
  const { roomId, autoLoad = true } = options

  // 状态
  const beacons = ref<Beacon[]>([])
  const activeBeacons = ref<Beacon[]>([])
  const myActiveBeacon = ref<Beacon | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // 地理位置 Hook
  const { getCurrentPosition, state: geoState } = useGeolocation()

  // 计算属性
  const hasActiveBeacons = computed(() => activeBeacons.value.length > 0)
  const hasMyActiveBeacon = computed(() => myActiveBeacon.value !== null)
  const isSharingLocation = computed(() => hasMyActiveBeacon.value)

  /**
   * 加载房间内的所有 Beacons
   */
  const loadBeacons = async (targetRoomId: string) => {
    if (!targetRoomId) {
      logger.warn('[useMatrixBeacons] No room ID provided')
      return
    }

    loading.value = true
    error.value = null

    try {
      logger.info('[useMatrixBeacons] Loading beacons for room', { roomId: targetRoomId })

      const roomBeacons = await matrixBeaconService.getRoomBeacons(targetRoomId)
      beacons.value = roomBeacons

      // 过滤活跃的 Beacons
      activeBeacons.value = roomBeacons.filter((b) => b.isLive && !b.isExpired)

      // 找到当前用户的 Beacon
      const client = (window as any).__MATRIX_CLIENT__
      const userId = client?.getUserId?.() || ''
      myActiveBeacon.value = activeBeacons.value.find((b) => b.ownerId === userId) || null

      logger.info('[useMatrixBeacons] Beacons loaded', {
        total: roomBeacons.length,
        active: activeBeacons.value.length,
        myBeacon: myActiveBeacon.value?.id
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load beacons'
      error.value = errorMessage
      logger.error('[useMatrixBeacons] Failed to load beacons:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * 创建新的 Beacon（开始共享位置）
   */
  const startSharing = async (
    targetRoomId: string,
    shareOptions: {
      description?: string
      duration?: number // 毫秒
      updateInterval?: number // 毫秒
    } = {}
  ): Promise<string | null> => {
    if (!targetRoomId) {
      error.value = 'No room ID provided'
      return null
    }

    loading.value = true
    error.value = null

    try {
      logger.info('[useMatrixBeacons] Starting location sharing', { roomId: targetRoomId, shareOptions })

      // 获取当前位置
      const position = await getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000
      })

      if (!position) {
        throw new Error('Failed to get current position')
      }

      // 创建位置数据
      const location: BeaconLocation = {
        uri: `geo:${position.coords.latitude},${position.coords.longitude}`,
        description: 'Current Location',
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        altitude: position.coords.altitude ?? undefined,
        timestamp: Date.now()
      }

      // 创建 Beacon
      const beaconOptions: CreateBeaconOptions = {
        description: shareOptions.description || 'Live Location',
        duration: shareOptions.duration || 3600000, // 默认 1 小时
        initialLocation: location
      }

      const beaconId = await matrixBeaconService.createBeacon(targetRoomId, beaconOptions)

      // 启动定期更新
      const updateInterval = shareOptions.updateInterval || 30000 // 默认 30 秒

      await matrixBeaconService.startLiveUpdates(
        targetRoomId,
        beaconId,
        async () => {
          try {
            const pos = await getCurrentPosition({
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 5000
            })

            if (!pos) return null

            return {
              uri: `geo:${pos.coords.latitude},${pos.coords.longitude}`,
              description: 'Current Location',
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              altitude: pos.coords.altitude ?? undefined,
              timestamp: Date.now()
            }
          } catch (err) {
            logger.error('[useMatrixBeacons] Failed to get position for update:', err)
            return null
          }
        },
        updateInterval
      )

      // 重新加载 Beacons
      await loadBeacons(targetRoomId)

      logger.info('[useMatrixBeacons] Location sharing started', { beaconId, roomId: targetRoomId })

      return beaconId
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start sharing'
      error.value = errorMessage
      logger.error('[useMatrixBeacons] Failed to start sharing:', err)
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * 停止共享位置
   */
  const stopSharing = async (targetRoomId?: string): Promise<void> => {
    if (!myActiveBeacon.value) {
      logger.warn('[useMatrixBeacons] No active beacon to stop')
      return
    }

    loading.value = true
    error.value = null

    try {
      const roomIdToUse = targetRoomId || roomId || myActiveBeacon.value.roomId
      const beaconId = myActiveBeacon.value.id

      logger.info('[useMatrixBeacons] Stopping location sharing', { beaconId, roomId: roomIdToUse })

      await matrixBeaconService.stopBeacon(roomIdToUse, beaconId)

      // 重新加载 Beacons
      if (roomIdToUse) {
        await loadBeacons(roomIdToUse)
      }

      logger.info('[useMatrixBeacons] Location sharing stopped')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop sharing'
      error.value = errorMessage
      logger.error('[useMatrixBeacons] Failed to stop sharing:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * 发送单次位置更新
   */
  const sendLocationUpdate = async (targetRoomId: string): Promise<void> => {
    if (!myActiveBeacon.value) {
      error.value = 'No active beacon'
      return
    }

    try {
      const position = await getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000
      })

      if (!position) {
        throw new Error('Failed to get current position')
      }

      const location: BeaconLocation = {
        uri: `geo:${position.coords.latitude},${position.coords.longitude}`,
        description: 'Current Location',
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        altitude: position.coords.altitude ?? undefined,
        timestamp: Date.now()
      }

      await matrixBeaconService.sendLocationUpdate(targetRoomId, myActiveBeacon.value.stateKey, location)

      logger.debug('[useMatrixBeacons] Location update sent')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send location update'
      error.value = errorMessage
      logger.error('[useMatrixBeacons] Failed to send location update:', err)
    }
  }

  /**
   * 监听其他用户的位置更新
   */
  const watchUserLocations = (callback: (beacon: Beacon) => void): (() => void) => {
    const unsubscribers: Array<() => void> = []

    activeBeacons.value.forEach((beacon) => {
      // 监听位置更新
      const unsubLocation = matrixBeaconService.onLocationUpdate(beacon.id, (beaconId, _location) => {
        const updatedBeacon = getBeaconById(beaconId)
        if (updatedBeacon) {
          callback(updatedBeacon)
        }
      })
      unsubscribers.push(unsubLocation)

      // 监听存活状态变化
      const unsubLiveness = matrixBeaconService.onLivenessChange(beacon.id, (beaconId, _isLive) => {
        const updatedBeacon = getBeaconById(beaconId)
        if (updatedBeacon) {
          callback(updatedBeacon)
        }
      })
      unsubscribers.push(unsubLiveness)
    })

    // 返回清理函数
    return () => {
      unsubscribers.forEach((unsub) => unsub())
    }
  }

  /**
   * 获取特定 Beacon
   */
  const getBeaconById = (beaconId: string): Beacon | undefined => {
    return beacons.value.find((b) => b.id === beaconId)
  }

  /**
   * 刷新 Beacons
   */
  const refresh = async (targetRoomId?: string): Promise<void> => {
    const roomIdToUse = targetRoomId || roomId
    if (roomIdToUse) {
      await loadBeacons(roomIdToUse)
    }
  }

  /**
   * 清理
   */
  const cleanup = () => {
    // 停止所有监听
    // （监听器在 watchUserLocations 中自动清理）
    logger.debug('[useMatrixBeacons] Cleanup')
  }

  // 自动加载
  if (autoLoad && roomId) {
    loadBeacons(roomId)
  }

  // 监听 roomId 变化
  if (roomId) {
    watch(
      () => roomId,
      (newRoomId) => {
        if (newRoomId && autoLoad) {
          loadBeacons(newRoomId)
        }
      }
    )
  }

  // 组件卸载时清理
  onUnmounted(() => {
    cleanup()
  })

  return {
    // 状态
    beacons,
    activeBeacons,
    myActiveBeacon,
    loading,
    error,
    geoState,

    // 计算属性
    hasActiveBeacons,
    hasMyActiveBeacon,
    isSharingLocation,

    // 方法
    loadBeacons,
    startSharing,
    stopSharing,
    sendLocationUpdate,
    watchUserLocations,
    getBeaconById,
    refresh,
    cleanup
  }
}
