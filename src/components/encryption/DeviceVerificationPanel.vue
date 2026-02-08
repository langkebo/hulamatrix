<template>
  <n-card :title="t('encryption.device_verification.title')" :bordered="false" class="device-verification-panel">
    <template #header-extra>
      <n-tag :type="verificationStatus" size="small">
        {{ verificationStatusText }}
      </n-tag>
    </template>

    <n-flex :size="16" vertical>
      <n-alert type="info" :bordered="false">
        <template #icon>
          <svg class="size-20px"><use href="#info"></use></svg>
        </template>
        {{ t('encryption.device_verification.description') }}
      </n-alert>

      <n-divider style="margin: 8px 0" />

      <n-spin :show="loading">
        <n-list bordered>
          <n-list-item v-for="device in devices" :key="device.deviceId">
            <n-thing>
              <template #header>
                <n-flex align="center" justify="space-between">
                  <n-flex align="center" :size="12">
                    <svg class="size-24px text-[--text-color]">
                      <use :href="device.isCurrentDevice ? '#device-desktop' : '#device-mobile'"></use>
                    </svg>
                    <n-flex vertical :size="4">
                      <span class="text-14px font-medium text-[--text-color]">
                        {{ device.displayName }}
                        <n-tag v-if="device.isCurrentDevice" type="success" size="tiny" round>
                          {{ t('encryption.device_verification.current') }}
                        </n-tag>
                      </span>
                      <span class="text-12px text-[--info-text-color]">
                        {{ device.deviceId }}
                      </span>
                    </n-flex>
                  </n-flex>
                  <n-tag :type="device.isVerified ? 'success' : 'warning'" size="small">
                    {{ device.isVerified ? t('encryption.device_verification.verified') : t('encryption.device_verification.unverified') }}
                  </n-tag>
                </n-flex>
              </template>
              <template #description>
                <n-flex :size="8" vertical>
                  <span class="text-12px text-gray-500">
                    {{ t('encryption.device_verification.last_seen') }}: {{ formatLastSeen(device.lastSeen) }}
                  </span>
                  <span v-if="device.lastSeenIp" class="text-12px text-gray-500">
                    {{ t('encryption.device_verification.last_seen_ip') }}: {{ device.lastSeenIp }}
                  </span>
                </n-flex>
              </template>
              <template #action>
                <n-flex justify="flex-end" :size="8">
                  <n-button
                    v-if="!device.isVerified && !device.isCurrentDevice"
                    size="small"
                    type="primary"
                    @click="handleVerifyDevice(device)">
                    {{ t('encryption.device_verification.verify') }}
                  </n-button>
                  <n-button
                    v-if="device.isVerified && !device.isCurrentDevice"
                    size="small"
                    @click="handleUnverifyDevice(device)">
                    {{ t('encryption.device_verification.unverify') }}
                  </n-button>
                  <n-button
                    v-if="device.blocked"
                    size="small"
                    type="error"
                    @click="handleUnblockDevice(device)">
                    {{ t('encryption.device_verification.unblock') }}
                  </n-button>
                  <n-button
                    v-else-if="!device.isCurrentDevice"
                    size="small"
                    type="error"
                    @click="handleBlockDevice(device)">
                    {{ t('encryption.device_verification.block') }}
                  </n-button>
                </n-flex>
              </template>
            </n-thing>
          </n-list-item>
        </n-list>
        <n-empty v-if="devices.length === 0" :description="t('encryption.device_verification.no_devices')" />
      </n-spin>
    </n-flex>

    <n-modal v-model:show="showVerifyModal" preset="card" :title="t('encryption.device_verification.verify_modal_title')" style="width: 500px">
      <n-flex :size="16" vertical>
        <n-alert type="info" :bordered="false">
          {{ t('encryption.device_verification.verify_modal_description') }}
        </n-alert>

        <n-descriptions :column="1" bordered size="small">
          <n-descriptions-item :label="t('encryption.device_verification.device_name')">
            {{ selectedDevice?.displayName }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('encryption.device_verification.device_id')">
            {{ selectedDevice?.deviceId }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('encryption.device_verification.last_seen')">
            {{ selectedDevice ? formatLastSeen(selectedDevice.lastSeen) : '' }}
          </n-descriptions-item>
        </n-descriptions>

        <n-button type="primary" block @click="handleConfirmVerify" :loading="loading">
          {{ t('encryption.device_verification.confirm_verify') }}
        </n-button>
      </n-flex>
    </n-modal>
  </n-card>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import MatrixCrossSigningService from '@/services/matrix/MatrixCrossSigningService'
import MatrixDeviceService from '@/services/matrix/MatrixDeviceService'

const { t } = useI18n()
const crossSigningService = MatrixCrossSigningService.getInstance()
const deviceService = MatrixDeviceService.getInstance()

const loading = ref(false)
const devices = ref<any[]>([])

const showVerifyModal = ref(false)
const selectedDevice = ref<any>(null)

const verificationStatus = computed(() => {
  const allVerified = devices.value.every((d) => d.isVerified)
  const anyVerified = devices.value.some((d) => d.isVerified)

  if (allVerified && devices.value.length > 0) return 'success'
  if (anyVerified) return 'warning'
  return 'error'
})

const verificationStatusText = computed(() => {
  const allVerified = devices.value.every((d) => d.isVerified)
  const anyVerified = devices.value.some((d) => d.isVerified)

  if (allVerified && devices.value.length > 0) return t('encryption.device_verification.all_verified')
  if (anyVerified) return t('encryption.device_verification.partially_verified')
  return t('encryption.device_verification.none_verified')
})

const loadDevices = async () => {
  try {
    loading.value = true
    const deviceList = await deviceService.getDeviceDisplayInfo()
    devices.value = deviceList.map((device) => ({
      ...device,
      isVerified: device.isVerified || false
    }))
  } catch (error) {
    console.error('Failed to load devices:', error)
  } finally {
    loading.value = false
  }
}

const handleVerifyDevice = (device: any) => {
  selectedDevice.value = device
  showVerifyModal.value = true
}

const handleConfirmVerify = async () => {
  if (!selectedDevice.value) return

  try {
    loading.value = true
    const success = await crossSigningService.verifyDevice(selectedDevice.value.deviceId)
    if (success) {
      window.$message.success(t('encryption.device_verification.verify_success'))
      showVerifyModal.value = false
      await loadDevices()
    } else {
      window.$message.error(t('encryption.device_verification.verify_failed'))
    }
  } catch (error) {
    console.error('Failed to verify device:', error)
    window.$message.error(t('encryption.device_verification.verify_failed'))
  } finally {
    loading.value = false
  }
}

const handleUnverifyDevice = async (device: any) => {
  try {
    loading.value = true
    const success = await crossSigningService.unverifyDevice(device.deviceId)
    if (success) {
      window.$message.success(t('encryption.device_verification.unverify_success'))
      await loadDevices()
    } else {
      window.$message.error(t('encryption.device_verification.unverify_failed'))
    }
  } catch (error) {
    console.error('Failed to unverify device:', error)
    window.$message.error(t('encryption.device_verification.unverify_failed'))
  } finally {
    loading.value = false
  }
}

const handleBlockDevice = async (device: any) => {
  window.$dialog.warning({
    title: t('encryption.device_verification.block_device_title'),
    content: t('encryption.device_verification.block_device_confirm', { name: device.displayName }),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      try {
        loading.value = true
        const success = await crossSigningService.blockDevice(device.deviceId)
        if (success) {
          window.$message.success(t('encryption.device_verification.block_success'))
          await loadDevices()
        } else {
          window.$message.error(t('encryption.device_verification.block_failed'))
        }
      } catch (error) {
        console.error('Failed to block device:', error)
        window.$message.error(t('encryption.device_verification.block_failed'))
      } finally {
        loading.value = false
      }
    }
  })
}

const handleUnblockDevice = async (device: any) => {
  try {
    loading.value = true
    const success = await crossSigningService.unblockDevice(device.deviceId)
    if (success) {
      window.$message.success(t('encryption.device_verification.unblock_success'))
      await loadDevices()
    } else {
      window.$message.error(t('encryption.device_verification.unblock_failed'))
    }
  } catch (error) {
    console.error('Failed to unblock device:', error)
    window.$message.error(t('encryption.device_verification.unblock_failed'))
  } finally {
    loading.value = false
  }
}

const formatLastSeen = (timestamp: number) => {
  if (!timestamp) return t('encryption.device_verification.never')

  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 60000) {
    return t('encryption.device_verification.just_now')
  } else if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000)
    return t('encryption.device_verification.minutes_ago', { minutes })
  } else if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000)
    return t('encryption.device_verification.hours_ago', { hours })
  } else if (diff < 604800000) {
    const days = Math.floor(diff / 86400000)
    return t('encryption.device_verification.days_ago', { days })
  } else {
    return date.toLocaleDateString()
  }
}

onMounted(() => {
  loadDevices()
})
</script>

<style scoped>
.device-verification-panel {
  background: var(--bg-color);
}
</style>
