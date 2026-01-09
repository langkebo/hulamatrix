import { ref, computed } from 'vue'
import { useE2EEStore } from '@/stores/e2ee'
import { listDevices, deleteDevice, renameDevice } from '@/integrations/matrix/encryption'
import { msg } from '@/utils/SafeUI'

export interface DeviceItem {
  deviceId: string
  displayName?: string
  lastSeenTs?: number
  verified: boolean
  blocked: boolean
}

export function useE2EEDevices() {
  const e2eeStore = useE2EEStore()
  const loading = ref(false)
  const error = ref<string | null>(null)
  const devices = ref<DeviceItem[]>([])

  // Computed properties from store
  const progress = computed(() => e2eeStore.deviceVerificationProgress || 0)
  const securityLevel = computed(() => e2eeStore.securityLevel)
  const e2eeEnabled = computed(() => e2eeStore.enabled)

  const unverifiedDevices = computed(() => devices.value.filter((d) => !d.verified && !d.blocked))

  const verifiedDevices = computed(() => devices.value.filter((d) => d.verified && !d.blocked))

  const blockedDevices = computed(() => devices.value.filter((d) => d.blocked))

  // Actions
  const fetchDevices = async () => {
    loading.value = true
    error.value = null
    try {
      // Fetch fresh list from API
      const rawDevices = await listDevices()

      // Sync with store to ensure verification status is up to date
      // Note: We might want to trigger store reload instead?
      // e2eeStore.loadAllDevices() might be better but listDevices returns the raw list directly

      // Map to unified structure
      devices.value = rawDevices.map((d) => ({
        deviceId: d.device_id,
        displayName: d.display_name,
        lastSeenTs: d.last_seen_ts,
        verified: e2eeStore.isDeviceVerified(d.device_id),
        blocked: e2eeStore.isDeviceBlocked(d.device_id)
      }))
    } catch (e: any) {
      error.value = e.message || '获取设备列表失败'
      console.error('Failed to fetch devices:', e)
    } finally {
      loading.value = false
    }
  }

  const handleRenameDevice = async (deviceId: string, currentName?: string) => {
    const name = prompt('输入新的设备名称', currentName || '')
    if (!name) return false

    try {
      const ok = await renameDevice(deviceId, name)
      if (ok) {
        msg.success('已更新设备名称')
        await fetchDevices() // Refresh list
        return true
      } else {
        msg.error('更新设备名称失败')
        return false
      }
    } catch (_e) {
      msg.error('更新设备名称出错')
      return false
    }
  }

  // Mobile often has custom UI for rename, so we might need a version that just calls API
  const renameDeviceApi = async (deviceId: string, name: string) => {
    try {
      const ok = await renameDevice(deviceId, name)
      if (ok) {
        await fetchDevices()
      }
      return ok
    } catch (_e) {
      return false
    }
  }

  const handleDeleteDevice = async (deviceId: string) => {
    try {
      const ok = await deleteDevice(deviceId)
      if (ok) {
        msg.success('已删除设备')
        await fetchDevices()
        return true
      } else {
        msg.error('删除设备失败')
        return false
      }
    } catch (_e) {
      msg.error('删除设备出错')
      return false
    }
  }

  return {
    devices,
    loading,
    error,
    progress,
    securityLevel,
    e2eeEnabled,
    unverifiedDevices,
    verifiedDevices,
    blockedDevices,
    fetchDevices,
    handleRenameDevice,
    renameDeviceApi,
    handleDeleteDevice
  }
}
