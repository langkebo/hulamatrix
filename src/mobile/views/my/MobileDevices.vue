<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar
        :isOfficial="false"
        class="bg-white"
        style="border-bottom: 1px solid; border-color: #dfdfdf"
        :hidden-right="true"
        :room-name="t('user_menu.privacy.devices')" />
    </template>

    <template #container>
      <img src="@/assets/mobile/chat-home/background.webp" class="w-100% absolute top-0 -z-1" alt="hula" />
      <div class="flex flex-col z-1">
        <div class="flex flex-col p-20px gap-20px">
          <n-spin :show="loading">
            <div class="flex flex-col gap-20px">
              <div class="bg-white p-12px rounded-lg shadow-sm">
                <div class="text-base font-medium mb-12px">{{ t('user_menu.privacy.current_device') }}</div>
                <div class="text-sm text-gray-600">{{ currentDeviceInfo }}</div>
              </div>

              <div class="bg-white p-12px rounded-lg shadow-sm">
                <div class="flex justify-between items-center mb-12px">
                  <div class="text-base font-medium">{{ t('user_menu.privacy.other_devices') }}</div>
                  <n-button
                    v-if="devices.length > 0"
                    text
                    type="error"
                    size="small"
                    @click="handleLogoutAllDevices">
                    {{ t('user_menu.privacy.logout_all') }}
                  </n-button>
                </div>

                <div v-if="devices.length === 0" class="text-sm text-gray-500 text-center py-20px">
                  {{ t('user_menu.privacy.no_devices') }}
                </div>

                <div v-else class="flex flex-col gap-12px">
                  <div
                    v-for="device in devices"
                    :key="device.id"
                    class="flex justify-between items-center p-12px bg-gray-50 rounded-lg">
                    <div class="flex-1">
                      <div class="text-sm font-medium">{{ device.name }}</div>
                      <div class="text-xs text-gray-500 mt-4px">
                        {{ device.lastSeen }}
                      </div>
                    </div>
                    <n-flex :size="8">
                      <n-button text size="small" @click="handleRenameDevice(device)">
                        {{ t('user_menu.privacy.rename') }}
                      </n-button>
                      <n-button text type="error" size="small" @click="handleLogoutDevice(device)">
                        {{ t('user_menu.privacy.logout') }}
                      </n-button>
                    </n-flex>
                  </div>
                </div>
              </div>
            </div>
          </n-spin>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import MatrixDeviceService from '@/services/matrix/MatrixDeviceService'

const { t } = useI18n()

const deviceService = MatrixDeviceService.getInstance()

const loading = ref(false)
const currentDeviceInfo = ref('')
const devices = ref<any[]>([])

const loadDevices = async () => {
  try {
    loading.value = true
    const deviceList = await deviceService.getDeviceDisplayInfo()
    const currentDevice = await deviceService.getCurrentDevice()

    if (currentDevice) {
      const platform = navigator.platform
      const userAgent = navigator.userAgent
      currentDeviceInfo.value = `${platform} | ${userAgent.slice(0, 50)}...`
    }

    devices.value = deviceList.filter((d) => !d.isCurrentDevice)
  } catch (error) {
    console.error('Failed to load devices:', error)
    window.$message.error(t('user_menu.privacy.load_devices_failed'))
  } finally {
    loading.value = false
  }
}

const handleLogoutDevice = async (device: any) => {
  window.$dialog.warning({
    title: t('user_menu.privacy.logout_device'),
    content: t('user_menu.privacy.logout_device_confirm', { name: device.name }),
    positiveText: t('user_menu.privacy.logout'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      try {
        await deviceService.deleteDevice(device.id)
        devices.value = devices.value.filter((d) => d.id !== device.id)
        window.$message.success(t('user_menu.privacy.logout_success'))
      } catch (error) {
        console.error('Failed to logout device:', error)
        window.$message.error(t('user_menu.privacy.logout_failed'))
      }
    }
  })
}

const handleRenameDevice = async (device: any) => {
  const inputRef = ref<HTMLInputElement | null>(null)
  window.$dialog.create({
    title: t('user_menu.privacy.rename_device'),
    content: () =>
      h('input', {
        ref: inputRef,
        type: 'text',
        placeholder: t('user_menu.privacy.enter_device_name'),
        value: device.name,
        class: 'n-input w-full',
        style: 'margin-top: 8px;'
      }),
    positiveText: t('common.save'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      try {
        const newName = inputRef.value?.value || ''
        if (!newName.trim()) {
          window.$message.warning(t('user_menu.privacy.device_name_required'))
          return false
        }

        const success = await deviceService.renameDevice(device.id, newName)
        if (success) {
          device.name = newName
          window.$message.success(t('user_menu.privacy.rename_success'))
        } else {
          window.$message.error(t('user_menu.privacy.rename_failed'))
        }
      } catch (error) {
        console.error('Failed to rename device:', error)
        window.$message.error(t('user_menu.privacy.rename_failed'))
      }
    }
  })
}

const handleLogoutAllDevices = async () => {
  window.$dialog.warning({
    title: t('user_menu.privacy.logout_all'),
    content: t('user_menu.privacy.logout_all_confirm'),
    positiveText: t('user_menu.privacy.logout'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      try {
        await deviceService.deleteAllOtherDevices()
        devices.value = []
        window.$message.success(t('user_menu.privacy.logout_success'))
      } catch (error) {
        console.error('Failed to logout all devices:', error)
        window.$message.error(t('user_menu.privacy.logout_failed'))
      }
    }
  })
}

onMounted(() => {
  loadDevices()
})
</script>

<style lang="scss" scoped>
@use '@/styles/scss/global/variable.scss' as *;
</style>
