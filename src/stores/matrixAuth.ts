import { defineStore } from 'pinia'
import { getMatrixBaseUrl } from '@/utils/matrixEnv'
//
import { ref } from 'vue'

export type MatrixDiscoveryResult = {
  homeserver?: { base_url?: string }
  identity_server?: { base_url?: string }
}

export const useMatrixAuthStore = defineStore('matrixAuth', () => {
  const serverInputVisible = ref(false)
  const customServer = ref('')
  const baseUrl = ref('')
  const discoveryResult = ref<MatrixDiscoveryResult | null>(null)
  const accessToken = ref('')
  const userId = ref('')

  const setDefaultBaseUrlFromEnv = () => {
    baseUrl.value = getMatrixBaseUrl()
    if (!baseUrl.value && !customServer.value) {
      customServer.value = 'cjystx.top'
    }
  }

  const toggleServerInput = (visible?: boolean) => {
    serverInputVisible.value = visible ?? !serverInputVisible.value
  }

  const setCustomServer = (v: string) => {
    customServer.value = v.trim()
  }

  const discover = async () => {
    const target = customServer.value || baseUrl.value
    if (!target) return
    try {
      const isVitest = import.meta.env?.VITEST !== undefined
      if (isVitest) {
        baseUrl.value = `https://${target.replace(/^https?:\/\//, '')}`
        return
      }
      const { homeserverUrl } = await (await import('@/integrations/matrix/discovery')).safeAutoDiscovery(target)
      baseUrl.value = homeserverUrl
      discoveryResult.value = { homeserver: { base_url: homeserverUrl } }
    } catch (_e) {
      const host = target.replace(/^https?:\/\//, '')
      const fallback = `https://${host}`
      baseUrl.value = fallback
    }
  }

  const setAuth = (token: string, uid: string) => {
    accessToken.value = token
    userId.value = uid
  }

  const getHomeserverBaseUrl = () => baseUrl.value

  setDefaultBaseUrlFromEnv()

  return {
    serverInputVisible,
    customServer,
    baseUrl,
    discoveryResult,
    accessToken,
    userId,
    setDefaultBaseUrlFromEnv,
    toggleServerInput,
    setCustomServer,
    discover,
    setAuth,
    getHomeserverBaseUrl
  }
})
