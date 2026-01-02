<template>
  <div class="e2ee-manager">
    <!-- 设备列表 -->
    <div class="device-section">
      <div class="section-header">
        <h3>我的设备</h3>
        <n-button @click="showAddDeviceDialog = true" type="primary" size="small">
          <template #icon>
            <n-icon><Plus /></n-icon>
          </template>
          添加设备
        </n-button>
        <n-button @click="showKeyBackupDialog = true" type="primary" size="small">
          <template #icon>
            <n-icon><Backup /></n-icon>
          备份密钥
        </n-button>
        <n-button @click="refreshDevices" type="tertiary" size="small">
          <template #icon>
            <n-icon><Refresh /></n-icon>
          刷新
        </n-button>
      </div>

      <div v-if="isLoading" class="loading-state">
        <n-spin size="medium" />
        <p>加载设备中...</p>
      </div>

      <div v-else-if="error" class="error-state">
        <n-result status="error" title="加载失败" :description="error">
          <template #footer>
            <n-button @click="refreshDevices">重试</n-button>
          </template>
        </n-result>
      </div>

      <div v-else-if="devices.length === 0" class="empty-state">
        <n-result status="info" title="暂无设备" description="点击上方按钮添加设备">
          <template #footer>
            <n-button type="primary" @click="showAddDeviceDialog = true">添加第一个设备</n-button>
          </template>
        </n-result>
      </div>

      <div v-else class="device-list">
        <div
          v-for="device in devices"
          :key="device.deviceId"
          class="device-item"
          :class="{ 'is-verified': device.verified }"
          @click="openDeviceDetails(device)"
        >
          <div class="device-info">
            <div class="device-name">
              <n-avatar
                v-bind="createStrictAvatarProps({
                  src: device.avatar || null,
                  size: 64,
                  round: true
                })"
              >{{ device.displayName?.charAt(0) || 'D' }}</n-avatar>
              <div class="device-details">
                <div class="device-name">{{ device.displayName || device.deviceId }}</div>
                <div class="device-id">{{ device.deviceId }}</div>
                <div class="device-meta">
                  <n-tag v-if="device.verified" type="success" size="small" round>已验证</n-tag>
                  <n-tag v-if="device.blocked" type="error" size="small" round>已屏蔽</n-tag>
                </div>
              </div>
            </div>
          </div>

          <div class="device-actions">
            <n-button
              v-if="device.verified && !device.blocked"
              quaternary
              circle
              size="tiny"
              @click="toggleDeviceVerification(device)"
            >
              <template #icon>
                <n-icon><Check /></n-icon>
              </template>
            </n-button>

            <n-dropdown
              trigger="click"
              :options="getDeviceOptions(device)"
              @select="handleDeviceAction($event, device)"
            >
              <n-button quaternary circle size="tiny">
                <template #icon>
                  <n-icon><DotsVertical /></n-icon>
                </template>
              </n-button>
            </n-dropdown>
          </div>
        </div>
      </div>
    </div>

    <!-- 设备详情抽屉 -->
    <n-drawer
      v-model:show="showDeviceDetails"
      :width="600"
      placement="right"
      :on-mask-closable="false"
      displayDirective="show"
    >
      <DeviceDetails
        v-if="selectedDevice"
        :device="selectedDevice!"
        @updated="handleDeviceUpdated"
        @verified="handleDeviceVerified"
        @blocked="handleDeviceBlocked"
      />
    </n-drawer>

    <!-- 添加设备对话框 -->
    <AddDeviceDialog
      v-model:show="showAddDeviceDialog"
      @device-added="handleDeviceAdded"
    />

    <!-- 密钥备份对话框 -->
    <KeyBackupDialog
      v-model:show="showKeyBackupDialog"
      @backup-completed="handleKeyBackupCompleted"
    />

    <!-- 设备详情组件在抽屉中呈现 -->
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { NButton, NIcon, NAvatar, NTag, NDropdown, NDrawer, NResult, NSpin } from 'naive-ui'
import { Plus } from '@vicons/tabler'
import Check from '@vicons/tabler/Check'
import DotsVertical from '@vicons/tabler/DotsVertical'
import DeviceDetails from './DeviceDetails.vue'
import AddDeviceDialog from './AddDeviceDialog.vue'
import KeyBackupDialog from './KeyBackupDialog.vue'
import type { Device } from '@/stores/core/index'
import { createStrictAvatarProps } from '@/utils/naive-types'
import { useE2EE } from '@/hooks/useE2EE'
import { msg } from '@/utils/SafeUI'

/**
 * Matrix 客户端接口（最小化）
 */
interface MatrixClient {
  getDevices(): Promise<{ devices: MatrixDevice[] }>
  [key: string]: unknown
}

/**
 * Matrix 设备信息
 */
interface MatrixDevice {
  device_id: string
  display_name?: string
  last_seen_ts?: number
  verified?: boolean
  blacklisted?: boolean
  [key: string]: unknown
}

/**
 * 加载状态
 */
interface LoadingState {
  value: boolean
  [key: string]: unknown
}

/**
 * E2EE 错误状态
 */
interface E2EEError {
  value: string | null
  [key: string]: unknown
}

/**
 * E2EE 状态
 */
interface E2EEState {
  enabled: boolean
  [key: string]: unknown
}

/**
 * 加密管理器接口（最小化）
 */
interface CryptoManager {
  unverifyDevice(deviceId: string, roomId: string): Promise<void>
  [key: string]: unknown
}

/**
 * E2EE hook返回类型接口
 */
interface E2EEHookReturn {
  matrixClient?: MatrixClient
  cryptoManager?: CryptoManager
  isLoading: LoadingState
  error: E2EEError
  e2eeState: E2EEState
  verifyDevice: (deviceId: string) => Promise<boolean>
  unverifyDevice: (deviceId: string) => Promise<boolean>
  blockDevice: (deviceId: string) => Promise<boolean>
  unblockDevice: (deviceId: string) => Promise<boolean>
}

const e2ee = useE2EE() as unknown as E2EEHookReturn
const { verifyDevice, unverifyDevice, blockDevice, unblockDevice } = e2ee

const deviceList = ref<Device[]>([])
const devices = computed(() => deviceList.value)

const isLoading = ref(false)
const error = ref<string | null>(null)

const showDeviceDetails = ref(false)
const selectedDevice = ref<Device | null>(null)
const showAddDeviceDialog = ref(false)
const showKeyBackupDialog = ref(false)

// 初始加载设备列表
const loadDevices = async () => {
  if (e2ee.matrixClient) {
    await refreshDevices()
  }
}

// 刷新设备列表
const refreshDevices = async () => {
  isLoading.value = true
  error.value = null
  try {
    // 从 Matrix SDK 获取设备列表
    const client = e2ee.matrixClient
    if (!client) {
      throw new Error('Matrix client not available')
    }

    // 获取设备列表
    const devices = await client.getDevices()

    // 转换为统一格式
    const formattedDevices = devices.devices || []

    deviceList.value = formattedDevices.map((device: MatrixDevice) => ({
      deviceId: device.device_id,
      displayName: device.display_name || device.device_id,
      lastSeen: device.last_seen_ts,
      verified: device.verified || false,
      blocked: device.blacklisted || false,
      ...(device || {})
    }))

    msg.success(`成功加载 ${deviceList.value.length} 个设备`)
  } catch (err) {
    error.value = err instanceof Error ? err.message : '刷新失败'
    msg.error(`刷新设备列表失败: ${error.value}`)
  } finally {
    isLoading.value = false
  }
}

// 显示设备详情
const openDeviceDetails = (device: Device) => {
  selectedDevice.value = device
  showDeviceDetails.value = true
}

// 切换设备验证状态
const toggleDeviceVerification = async (device: Device) => {
  if (device.verified) {
    await unverifyDevice(device.deviceId)
  } else {
    await verifyDevice(device.deviceId)
  }
  // 更新本地状态
  const index = deviceList.value.findIndex((d) => d.deviceId === device.deviceId)
  if (index > -1 && deviceList.value[index]) {
    deviceList.value[index].verified = !device.verified
  }
}

// 处理设备更新
const handleDeviceUpdated = (device: Device) => {
  // 更新设备信息
  const index = deviceList.value.findIndex((d) => d.deviceId === device.deviceId)
  if (index > -1) {
    deviceList.value[index] = device
  }
}

// 处理设备验证
const handleDeviceVerified = async (device: Device) => {
  await toggleDeviceVerification(device)
}

// 处理设备屏蔽
const handleDeviceBlocked = async (device: Device) => {
  if (device.blocked) {
    await unblockDevice(device.deviceId)
  } else {
    await blockDevice(device.deviceId)
  }
  // 更新本地状态
  const index = deviceList.value.findIndex((d) => d.deviceId === device.deviceId)
  if (index > -1 && deviceList.value[index]) {
    deviceList.value[index].blocked = !device.blocked
    deviceList.value[index].verified = device.blocked ? false : deviceList.value[index]!.verified || false
  }
}

// 处理添加设备
const handleDeviceAdded = (device: Device) => {
  // 更新设备列表
  deviceList.value.push(device)
  showAddDeviceDialog.value = false
}

// 处理密钥备份完成
const handleKeyBackupCompleted = (options: { success: boolean; exportedKey?: string }) => {
  showKeyBackupDialog.value = false
  if (options.success && options.exportedKey) {
    msg.success('密钥备份成功')
  } else if (!options.success) {
    msg.error('密钥备份失败')
  }
}

// 获取设备操作选项
const getDeviceOptions = (device: Device) => {
  const canVerify = !device.verified && !device.blocked

  const actions = [
    {
      label: '查看详情',
      key: 'view',
      icon: () => '👁️',
      action: 'view'
    }
  ]

  if (canVerify) {
    actions.push(
      {
        label: '验证设备',
        key: 'verify',
        icon: () => '🔐',
        action: 'verify'
      },
      {
        label: '屏蔽设备',
        key: 'block',
        icon: () => '🛑',
        action: 'block'
      }
    )
  } else if (device.verified && !device.blocked) {
    actions.push({
      label: '取消验证',
      key: 'unverify',
      icon: () => '🔐',
      action: 'unverify'
    })
  }

  return actions
}

// 处理设备操作
const handleDeviceAction = async (action: string, device: Device) => {
  switch (action) {
    case 'view':
      openDeviceDetails(device)
      break
    case 'verify':
      await handleDeviceVerified(device)
      break
    case 'block':
      await handleDeviceBlocked(device)
      break
    case 'unverify': {
      const roomId = device.roomIds?.[0] ?? device.deviceId
      await e2ee.cryptoManager?.unverifyDevice(device.deviceId, roomId)
      device.verified = false
      break
    }
  }
}

// 组件挂载时加载设备列表
onMounted(() => {
  loadDevices()
})
</script>

<style lang="scss" scoped>
.e2ee-manager {
  padding: 20px;
  height: 100%;
  overflow-y: auto;

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .device-item {
  display: flex;
  align-items: center;
  padding: 12px;
  background: var(--card-color);
  border-radius: 8px;
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: 12px;

  &:hover {
    border-color: var(--primary-color);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  &.verified {
    background-color: rgba(16, 185, 129, 0.1);
  }

  &.blocked {
    background-color: rgba(239, 68, 68, 0.1);
  }
}

.device-info {
  margin-left: 12px;
  flex: 1;
  overflow: hidden;

  .device-name {
    font-weight: 600;
    color: var(--text-color-1);
    line-height: 1.4;
    margin-bottom: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .device-id {
    font-size: 12px;
    color: var(--text-color-3);
  }

  .device-meta {
    display: flex;
    gap: 8px;
    margin-top: 8px;
    flex-wrap: wrap;
  }

  .device-actions {
  display: flex;
    gap: 8px;
  }
}

.loading-state,
.error-state,
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  flex-direction: column;
}

.empty-state {
  padding: 32px;
  text-align: center;
}

@media (max-width: 768px) {
  .space-toolbar {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .device-actions {
    width: 100%;
    flex-wrap: wrap;
  }
}

@media (max-width: 480px) {
  .section-header {
    flex-direction: column;
  }
}
</style>
