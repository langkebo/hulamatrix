import { ref } from 'vue'
import { startSasVerification, startQrVerification } from '@/integrations/matrix/encryption'
import { useE2EEStore } from '@/stores/e2ee'

export type VerificationStep = 'method' | 'sas' | 'qr' | 'success'

export interface SasData {
  decimals?: number[]
  emojis?: Array<{ emoji: string; name: string }>
  confirm?: () => Promise<void>
  cancel?: () => Promise<void>
}

export interface QrData {
  dataUri?: string
  confirm?: () => Promise<void>
  cancel?: () => Promise<void>
}

export function useDeviceVerification() {
  const e2eeStore = useE2EEStore()

  const step = ref<VerificationStep>('method')
  const loading = ref(false)
  const confirming = ref(false)
  const error = ref<string | null>(null)
  
  const sasData = ref<SasData | null>(null)
  const qrData = ref<QrData | null>(null)

  const reset = () => {
    step.value = 'method'
    loading.value = false
    confirming.value = false
    error.value = null
    sasData.value = null
    qrData.value = null
  }

  const startSas = async (userId: string, deviceId: string) => {
    loading.value = true
    error.value = null
    try {
      const result = await startSasVerification(userId, deviceId)
      if (!result.ok) {
        error.value = result.reason || 'SAS 验证启动失败'
        return
      }
      sasData.value = {
        decimals: result.decimals,
        emojis: result.emojis,
        confirm: result.confirm,
        cancel: result.cancel
      }
      step.value = 'sas'
    } catch (e: any) {
      error.value = e.message || 'SAS 验证启动失败'
    } finally {
      loading.value = false
    }
  }

  const startQr = async (userId: string, deviceId: string) => {
    loading.value = true
    error.value = null
    try {
      const result = await startQrVerification(userId, deviceId)
      if (!result.ok) {
        error.value = result.reason || '二维码生成失败'
        return
      }
      qrData.value = {
        dataUri: result.dataUri,
        confirm: result.confirm,
        cancel: result.cancel
      }
      step.value = 'qr'
    } catch (e: any) {
      error.value = e.message || '二维码生成失败'
    } finally {
      loading.value = false
    }
  }

  const confirmSas = async (deviceId: string) => {
    if (!sasData.value?.confirm) return
    confirming.value = true
    try {
      await sasData.value.confirm()
      // Update store state
      e2eeStore.updateDevice(deviceId, { verified: true })
      step.value = 'success'
    } catch (e: any) {
      error.value = e.message || '验证失败'
    } finally {
      confirming.value = false
    }
  }

  const confirmQr = async (deviceId: string) => {
    if (!qrData.value?.confirm) return
    confirming.value = true
    try {
      await qrData.value.confirm()
      // Update store state
      e2eeStore.updateDevice(deviceId, { verified: true })
      step.value = 'success'
    } catch (e: any) {
      error.value = e.message || '验证失败'
    } finally {
      confirming.value = false
    }
  }

  const cancel = async () => {
    confirming.value = true
    try {
      if (sasData.value?.cancel) await sasData.value.cancel()
      if (qrData.value?.cancel) await qrData.value.cancel()
    } catch (e) {
      // ignore cancel errors
    } finally {
      confirming.value = false
      reset()
    }
  }

  return {
    step,
    loading,
    confirming,
    error,
    sasData,
    qrData,
    reset,
    startSas,
    startQr,
    confirmSas,
    confirmQr,
    cancel
  }
}
