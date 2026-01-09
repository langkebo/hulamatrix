<template>
  <n-flex vertical :size="40">
    <!-- 当前设备 -->
    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">当前设备</span>

      <n-flex class="item" :size="12" vertical>
        <n-flex align="center" :size="12">
          <n-avatar :size="48" round>
            <svg class="size-24px"><use href="#device"></use></svg>
          </n-avatar>
          <n-flex vertical :size="4">
            <span class="text-14px font-600">{{ currentDevice.displayName }}</span>
            <span class="text-(12px var(--hula-brand-primary))">{{ currentDevice.deviceId }}</span>
          </n-flex>
          <n-tag v-if="currentDevice.verified" type="success" size="small">已验证</n-tag>
          <n-tag v-else type="warning" size="small">未验证</n-tag>
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-flex align="center" justify="space-between">
          <span>设备名称</span>
          <n-button text size="small">编辑</n-button>
        </n-flex>

        <n-flex align="center" justify="space-between">
          <span>通知</span>
          <n-switch size="small" v-model:value="currentDevice.notificationsEnabled" />
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-space>
          <n-button
            size="small"
            type="primary"
            @click="() => handleVerifyDevice(currentDevice)"
            :disabled="currentDevice.verified">
            验证设备
          </n-button>
          <n-button size="small" type="error" ghost @click="handleSignOut">退出登录</n-button>
        </n-space>
      </n-flex>
    </n-flex>

    <!-- 其他会话 -->
    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <n-flex align="center" justify="space-between">
        <span class="pl-10px">其他会话</span>
        <n-select class="w-120px" size="small" v-model:value="deviceFilter" :options="filterOptions" />
      </n-flex>

      <n-flex class="item" :size="12" vertical>
        <!-- 骨架屏加载状态 -->
        <SettingsSkeleton v-if="isLoading" :rows="3" variant="card" :loading="isLoading" />

        <!-- 设备列表 -->
        <template v-else-if="filteredDevices.length > 0">
          <div v-for="device in filteredDevices" :key="device.deviceId" class="device-item">
            <n-flex align="center" justify="flex-1" :size="12">
              <n-avatar :size="40" round>
                <svg class="size-20px"><use href="#device"></use></svg>
              </n-avatar>

              <n-flex vertical :size="4" class="flex-1">
                <span class="text-14px font-600">{{ device.displayName }}</span>
                <span class="text-(12px var(--hula-brand-primary))">{{ device.deviceId.substring(0, 12) }}...</span>
              </n-flex>

              <n-space>
                <n-tag v-if="device.verified" type="success" size="small">已验证</n-tag>
                <n-tag v-else type="warning" size="small">未验证</n-tag>
                <n-dropdown :options="getDeviceActions(device)" @select="handleDeviceAction">
                  <n-button circle size="small" quaternary>
                    <svg class="size-14px"><use href="#more"></use></svg>
                  </n-button>
                </n-dropdown>
              </n-space>
            </n-flex>
          </div>
        </template>

        <n-empty v-else description="没有其他设备" size="small" />
      </n-flex>
    </n-flex>

    <!-- 批量操作 -->
    <n-flex v-if="hasUnverifiedDevices" vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">批量操作</span>

      <n-flex class="item" :size="12" vertical>
        <n-alert type="warning" title="发现未验证设备">
          发现 {{ unverifiedDevicesCount }} 个未验证设备，可能存在安全风险。
        </n-alert>

        <n-space>
          <n-button size="small" type="primary" @click="handleVerifyAll">全部验证</n-button>
          <n-button size="small" type="error" ghost @click="handleSignOutAll">全部退出</n-button>
        </n-space>
      </n-flex>
    </n-flex>
  </n-flex>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  NFlex,
  NSwitch,
  NButton,
  NSpace,
  NTag,
  NAvatar,
  NSelect,
  NDropdown,
  NEmpty,
  NAlert,
  useDialog,
  useMessage
} from 'naive-ui'
import SettingsSkeleton from '@/components/settings/SettingsSkeleton.vue'
import { useUserStore } from '@/stores/user'
import { flags } from '@/utils/envFlags'
import { matrixClientService } from '@/integrations/matrix/client'
import type { DeviceInfo } from '@/services/e2eeService'
import { logger } from '@/utils/logger'
import { useAppStateStore } from '@/stores/appState'

/**
 * 会话设备信息
 */
interface Device {
  displayName: string
  deviceId: string
  verified: boolean
  notificationsEnabled?: boolean
  isInactive?: boolean
  isCurrentDevice?: boolean
  userId?: string
}

/**
 * 下拉菜单选项
 */
interface DropdownOption {
  label: string
  key: string
  disabled?: boolean
  [key: string]: unknown
}

const dialog = useDialog()
const message = useMessage()
const userStore = useUserStore()

// 加载状态
const isLoading = ref(true)

// 当前设备
const currentDevice = ref({
  displayName: '当前设备',
  deviceId: 'Loading...',
  verified: false,
  notificationsEnabled: true
})

const devices = ref<Device[]>([])
const deviceFilter = ref('all')

// 过滤选项
const filterOptions = computed(() => [
  { label: '全部', value: 'all' },
  { label: '未验证', value: 'unverified' },
  { label: '不活跃', value: 'inactive' }
])

// 过滤后的设备列表
const filteredDevices = computed(() => {
  switch (deviceFilter.value) {
    case 'unverified':
      return devices.value.filter((d) => !d.verified)
    case 'inactive':
      return devices.value.filter((d) => d.isInactive)
    default:
      return devices.value
  }
})

// 未验证设备计数
const unverifiedDevicesCount = computed(() => devices.value.filter((d) => !d.verified).length)

// 是否有未验证设备
const hasUnverifiedDevices = computed(() => unverifiedDevicesCount.value > 0)

/**
 * 从 Matrix 获取设备列表
 */
async function loadMatrixDevices(): Promise<void> {
  try {
    const client = matrixClientService.getClient()
    if (!client) {
      logger.warn('[Sessions] Matrix client not available')
      return
    }

    // 获取 E2EE 服务
    const { e2eeService } = await import('@/services/e2eeService')

    // 获取当前用户 ID
    const getUserId = client.getUserId as (() => string) | undefined
    const userId = getUserId?.()
    if (!userId) {
      logger.warn('[Sessions] Unable to get current user ID')
      return
    }

    // 获取当前设备 ID
    const getDeviceId = client.getDeviceId as (() => string) | undefined
    const currentDeviceId = getDeviceId?.()

    // 获取用户的设备列表
    const deviceInfos: DeviceInfo[] = await e2eeService.getUserDevices(userId)

    // 转换为 UI 设备格式
    devices.value = deviceInfos
      .filter((d) => d.deviceId !== currentDeviceId) // 排除当前设备
      .map(
        (d): Device => ({
          displayName: d.displayName || d.deviceId.substring(0, 8),
          deviceId: d.deviceId,
          verified: d.trustLevel === 'verified' || d.verified === true,
          isInactive: d.lastSeen ? Date.now() - d.lastSeen > 30 * 24 * 60 * 60 * 1000 : false, // 30天未活跃
          isCurrentDevice: false,
          userId: d.userId,
          notificationsEnabled: true
        })
      )

    // 更新当前设备信息
    if (currentDeviceId) {
      currentDevice.value.deviceId = currentDeviceId
      const currentDeviceInfo = deviceInfos.find((d) => d.deviceId === currentDeviceId)
      if (currentDeviceInfo) {
        currentDevice.value.verified =
          currentDeviceInfo.trustLevel === 'verified' || currentDeviceInfo.verified === true
      }
    }

    logger.info('[Sessions] Loaded devices from Matrix:', { count: devices.value.length })
  } catch (error) {
    logger.error('[Sessions] Failed to load Matrix devices:', error)
    // 不抛出错误，允许显示空列表
  }
}

// 初始化
onMounted(async () => {
  // 检查应用状态
  const appStateStore = useAppStateStore()
  if (!appStateStore.isReady) {
    logger.warn('[Sessions] Application not ready')
    message.warning('应用正在初始化，请稍后再试')
    isLoading.value = false
    return
  }

  isLoading.value = true
  try {
    // 获取当前设备信息
    const deviceId = userStore.userInfo.uid || 'unknown'
    currentDevice.value.deviceId = deviceId.substring(0, 12) + '...'
    currentDevice.value.displayName = '当前设备'
    currentDevice.value.verified = true

    // 获取设备列表
    await loadMatrixDevices()
  } catch (e) {
    logger.error('[Sessions] Failed to load devices:', e)
  } finally {
    isLoading.value = false
  }
})

// 方法

function getDeviceActions(device: Device): DropdownOption[] {
  return [
    {
      label: '验证',
      key: 'verify',
      disabled: device.verified
    },
    {
      label: '退出',
      key: 'signout'
    }
  ]
}

async function handleDeviceAction(key: string): Promise<void> {
  // 检查应用状态
  const appStateStore = useAppStateStore()
  if (!appStateStore.isReady) {
    message.warning('应用正在初始化，请稍后再试')
    return
  }

  // Find the device from the current filtered list
  const device = filteredDevices.value.find((d) => {
    const actions = getDeviceActions(d)
    return actions.some((a) => a.key === key)
  })
  if (!device) return

  switch (key) {
    case 'verify':
      await handleVerifyDevice(device)
      break
    case 'signout':
      await handleSignOutDevice(device)
      break
  }
}

async function handleVerifyDevice(device?: Device): Promise<void> {
  try {
    if (!device) {
      message.warning('无法验证：设备信息未提供')
      return
    }

    const client = matrixClientService.getClient()
    if (!client) {
      message.warning('Matrix 客户端未初始化')
      return
    }

    // 获取 E2EE 服务
    const { e2eeService } = await import('@/services/e2eeService')

    // 请求设备验证
    await e2eeService.requestDeviceVerification(device.userId || '', device.deviceId)
    message.info('验证请求已发送，请在其他设备上确认')
  } catch (error) {
    logger.error('[Sessions] Failed to verify device:', error)
    message.error('设备验证失败：' + (error instanceof Error ? error.message : String(error)))
  }
}

async function handleSignOut(): Promise<void> {
  dialog.warning({
    title: '退出登录',
    content: '确定要退出登录吗？',
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        // 调用 Matrix 登出
        const client = matrixClientService.getClient()
        if (client) {
          const logoutMethod = client.logout as (() => Promise<void>) | undefined
          await logoutMethod?.()
        }

        // 清除本地存储
        localStorage.removeItem('token')
        localStorage.removeItem('refreshToken')
        localStorage.removeItem('userId')

        message.success('已退出登录')
        // 跳转到登录页
        const { useRouter } = await import('vue-router')
        const router = useRouter()
        router.push({ name: 'Login' })
      } catch (error) {
        logger.error('[Sessions] Failed to logout:', error)
        message.error('退出登录失败')
      }
    }
  })
}

async function handleSignOutDevice(device: Device): Promise<void> {
  dialog.warning({
    title: '退出设备',
    content: `确定要退出 ${device.displayName} 吗？`,
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        const client = matrixClientService.getClient()
        if (!client) {
          message.warning('Matrix 客户端未初始化')
          return
        }

        // 获取设备列表并删除指定设备
        const getDevicesMethod = client.getDevices as
          | (() => Promise<{ devices: { device_id: string; id: string }[] }>)
          | undefined
        if (!getDevicesMethod) {
          message.warning('设备管理功能不可用')
          return
        }

        // 使用 Matrix SDK 删除设备
        const deleteDeviceMethod = client.deleteDevice as
          | ((deviceId: string, authData: Record<string, unknown>) => Promise<void>)
          | undefined
        if (deleteDeviceMethod && device.userId) {
          try {
            // 需要先获取认证会话
            await deleteDeviceMethod(device.deviceId, {
              type: 'm.login.password',
              user: device.userId,
              // 密码需要从用户输入获取，这里简化处理
              identifier: {
                type: 'm.id.user',
                user: device.userId
              }
            })
          } catch (_authError) {
            // 如果需要用户认证，提示用户
            message.warning('需要密码验证才能删除设备，请在设置中完成设备管理')
            return
          }
        }

        // 从列表中移除
        devices.value = devices.value.filter((d) => d.deviceId !== device.deviceId)
        message.success('设备已退出')
      } catch (error) {
        logger.error('[Sessions] Failed to sign out device:', error)
        message.error('退出设备失败：' + (error instanceof Error ? error.message : String(error)))
      }
    }
  })
}

async function handleVerifyAll(): Promise<void> {
  try {
    const client = matrixClientService.getClient()
    if (!client) {
      message.warning('Matrix 客户端未初始化')
      return
    }

    // 获取 E2EE 服务
    const { e2eeService } = await import('@/services/e2eeService')

    // 获取当前用户 ID
    const getUserId = client.getUserId as (() => string) | undefined
    const userId = getUserId?.()
    if (!userId) {
      message.warning('无法获取用户 ID')
      return
    }

    // 批量验证未验证的设备
    const unverifiedDevices = devices.value.filter((d) => !d.verified)
    for (const device of unverifiedDevices) {
      try {
        await e2eeService.requestDeviceVerification(userId, device.deviceId)
      } catch (_error) {
        // 继续处理下一个设备
        logger.warn('[Sessions] Failed to request verification for device:', device.deviceId)
      }
    }

    message.info(`已发送 ${unverifiedDevices.length} 个验证请求`)
  } catch (error) {
    logger.error('[Sessions] Failed to verify all devices:', error)
    message.error('批量验证失败')
  }
}

async function handleSignOutAll(): Promise<void> {
  dialog.warning({
    title: '退出所有设备',
    content: '确定要退出所有其他设备吗？',
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        const client = matrixClientService.getClient()
        if (!client) {
          message.warning('Matrix 客户端未初始化')
          return
        }

        // 获取 E2EE 服务
        const { e2eeService } = await import('@/services/e2eeService')

        // 获取当前用户 ID
        const getUserId = client.getUserId as (() => string) | undefined
        const userId = getUserId?.()
        if (!userId) {
          message.warning('无法获取用户 ID')
          return
        }

        // 获取设备列表
        const deviceInfos = await e2eeService.getUserDevices(userId)

        // 获取当前设备 ID
        const getDeviceId = client.getDeviceId as (() => string) | undefined
        const currentDeviceId = getDeviceId?.()

        // 退出除当前设备外的所有设备
        const deleteDeviceMethod = client.deleteDevice as
          | ((deviceId: string, authData: Record<string, unknown>) => Promise<void>)
          | undefined
        if (deleteDeviceMethod) {
          for (const device of deviceInfos) {
            if (device.deviceId !== currentDeviceId) {
              try {
                await deleteDeviceMethod(device.deviceId, {
                  type: 'm.login.password',
                  user: userId,
                  identifier: {
                    type: 'm.id.user',
                    user: userId
                  }
                })
              } catch (_error) {
                // 继续处理下一个设备
                logger.warn('[Sessions] Failed to delete device:', device.deviceId)
              }
            }
          }
        }

        // 清空设备列表
        devices.value = []
        message.success('所有其他设备已退出')
      } catch (error) {
        logger.error('[Sessions] Failed to sign out all devices:', error)
        message.error('批量退出失败')
      }
    }
  })
}
</script>

<style scoped lang="scss">
.item {
  @apply bg-[--bg-setting-item] rounded-12px size-full box-border border-(solid 1px [--line-color]) custom-shadow;
  padding: var(--pad-container-x);
  font-size: clamp(12px, 2vw, 14px);
}

.device-list {
  max-height: 400px;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb-color);
    border-radius: 3px;
  }
}

.device-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 8px;
  border-bottom: 1px solid var(--line-color);
  transition: background-color 0.2s;

  &:hover {
    background: var(--hover-color);
  }

  &:last-child {
    border-bottom: none;
  }
}
</style>
