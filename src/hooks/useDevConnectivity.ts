import { computed } from 'vue'
import { useMatrixAuthStore } from '@/stores/matrixAuth'
import { matrixClientService } from '@/integrations/matrix/client'
import { isDesktop } from '@/utils/PlatformConstants'

export const useDevConnectivity = () => {
  const store = useMatrixAuthStore()
  const isTauriEnv = typeof window !== 'undefined' && '__TAURI__' in window
  const hasCreds = computed(() => !!store.accessToken && !!store.getHomeserverBaseUrl())
  const matrixReady = computed(() => !!matrixClientService.getClient())
  const backendConnected = computed(() => {
    if (!hasCreds.value) return false
    return matrixReady.value
  })
  const isWebDev = computed(() => !isTauriEnv && import.meta.env.DEV && isDesktop())
  return {
    isTauriEnv,
    backendConnected,
    matrixReady,
    hasCreds,
    isWebDev
  }
}
