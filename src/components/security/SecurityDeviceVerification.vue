<template>
  <div class="device-verification">
    <n-card title="设备验证" :bordered="false">
      <template #header-extra>
        <n-button @click="refreshDevices" :loading="loading" quaternary>
          <template #icon>
            <n-icon><RefreshIcon /></n-icon>
          </template>
          刷新
        </n-button>
      </template>

      <!-- My Devices -->
      <div class="mb-6">
        <h3 class="text-lg font-semibold mb-3">我的设备</h3>
        <n-data-table
          :columns="myDeviceColumns"
          :data="myDevices"
          :pagination="false"
          :bordered="false"
        />
      </div>

      <!-- Pending Verification Requests -->
      <div v-if="pendingRequests.length > 0" class="mb-6">
        <h3 class="text-lg font-semibold mb-3">待验证请求</h3>
        <n-list>
          <n-list-item v-for="request in pendingRequests" :key="request.requestId">
            <n-thing>
              <template #header>
                来自 {{ request.fromDevice.displayName || request.fromDevice.deviceId }}
              </template>
              <template #description>
                设备ID: {{ request.fromDevice.deviceId }}<br>
                用户ID: {{ request.fromDevice.userId }}
              </template>
              <template #action>
                <n-space>
                  <n-button
                    type="primary"
                    size="small"
                    @click="acceptVerification(request.requestId)"
                  >
                    接受
                  </n-button>
                  <n-button
                    size="small"
                    @click="declineVerification(request.requestId)"
                  >
                    拒绝
                  </n-button>
                </n-space>
              </template>
            </n-thing>
          </n-list-item>
        </n-list>
      </div>

      <!-- SAS Verification Modal -->
      <n-modal v-model:show="showSasModal" :mask-closable="false">
        <n-card
          style="width: 500px"
          title="设备验证"
          :bordered="false"
          size="huge"
          role="dialog"
          aria-modal="true"
        >
          <template #header-extra>
            <n-button circle @click="showSasModal = false">
              <template #icon>
                <n-icon><CloseIcon /></n-icon>
              </template>
            </n-button>
          </template>

          <div v-if="currentSas" class="space-y-4">
            <!-- Emoji SAS -->
            <div v-if="currentSas.emoji" class="text-center">
              <p class="mb-2">请确认您看到相同的表情符号：</p>
              <div class="flex justify-center flex-wrap gap-2">
                <div
                  v-for="(emoji, index) in currentSas.emoji"
                  :key="index"
                  class="text-center"
                >
                  <div class="text-2xl">{{ emoji.symbol }}</div>
                  <div class="text-xs text-gray-500">{{ emoji.name }}</div>
                </div>
              </div>
            </div>

            <!-- Decimal SAS -->
            <div v-if="currentSas.decimal" class="text-center">
              <p class="mb-2">请确认您看到相同的数字：</p>
              <div class="text-2xl font-mono">
                {{ currentSas.decimal.join(' - ') }}
              </div>
            </div>

            <n-alert type="info" show-icon>
              如果两台设备上显示的信息相同，请点击"确认匹配"
            </n-alert>
          </div>

          <template #footer>
            <n-space justify="end">
              <n-button @click="cancelSasVerification">不匹配</n-button>
              <n-button type="primary" @click="confirmSasVerification">确认匹配</n-button>
            </n-space>
          </template>
        </n-card>
      </n-modal>
    </n-card>

    <!-- Encryption Status -->
    <n-card title="加密状态" :bordered="false" class="mt-4">
      <n-descriptions :column="2">
        <n-descriptions-item label="端到端加密">
          <n-tag :type="encryptionStatus.enabled ? 'success' : 'error'">
            {{ encryptionStatus.enabled ? '已启用' : '未启用' }}
          </n-tag>
        </n-descriptions-item>
        <n-descriptions-item label="交叉签名">
          <n-tag :type="encryptionStatus.crossSigningReady ? 'success' : 'warning'">
            {{ encryptionStatus.crossSigningReady ? '已设置' : '未设置' }}
          </n-tag>
        </n-descriptions-item>
        <n-descriptions-item label="安全存储">
          <n-tag :type="encryptionStatus.secretStorageReady ? 'success' : 'warning'">
            {{ encryptionStatus.secretStorageReady ? '已启用' : '未启用' }}
          </n-tag>
        </n-descriptions-item>
        <n-descriptions-item label="已验证设备">
          {{ encryptionStatus.verifiedDeviceCount }} / {{ encryptionStatus.deviceCount }}
        </n-descriptions-item>
      </n-descriptions>

      <n-alert v-if="!encryptionStatus.crossSigningReady" type="warning" show-icon class="mt-4">
        交叉签名未设置，建议设置以增强安全性。
      </n-alert>
      <div v-if="!encryptionStatus.crossSigningReady" class="mt-2">
        <n-button size="small" @click="setupCrossSigning">设置</n-button>
      </div>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, h } from 'vue'
import {
  NCard,
  NButton,
  NIcon,
  NDataTable,
  NTag,
  NSpace,
  NList,
  NListItem,
  NThing,
  NModal,
  NAlert,
  NDescriptions,
  NDescriptionsItem
} from 'naive-ui'
import { Refresh as RefreshIcon, X as CloseIcon } from '@vicons/tabler'
import { e2eeService } from '@/services/e2eeService'
import { logger } from '@/utils/logger'
import type { DeviceInfo, VerificationRequest } from '@/services/e2eeService'
import type { DataTableColumns } from 'naive-ui'

// State
const loading = ref(false)
const myDevices = ref<DeviceInfo[]>([])
const pendingRequests = ref<VerificationRequest[]>([])
const showSasModal = ref(false)

// SAS verification data interface
interface SasData {
  emoji?: Array<{ symbol: string; name: string }>
  decimal?: number[]
  [key: string]: unknown
}

const currentSas = ref<SasData | null>(null)
const currentVerificationRequestId = ref<string | null>(null)

// Computed
const encryptionStatus = ref({
  enabled: false,
  crossSigningReady: false,
  secretStorageReady: false,
  deviceCount: 0,
  verifiedDeviceCount: 0
})

// Table columns for my devices
const myDeviceColumns: DataTableColumns<DeviceInfo> = [
  {
    title: '设备名称',
    key: 'displayName',
    render: (row) => row.displayName || row.deviceId
  },
  {
    title: '设备ID',
    key: 'deviceId',
    ellipsis: {
      tooltip: true
    }
  },
  {
    title: '最后使用',
    key: 'lastSeen',
    render: (row) => {
      if (!row.lastSeen) return '从未'
      return new Date(row.lastSeen).toLocaleString()
    }
  },
  {
    title: '信任级别',
    key: 'trustLevel',
    render: (row) => row.trustLevel
  },
  {
    title: '操作',
    key: 'actions',
    render: (row) => {
      // 返回操作按钮的VNode
      return h('div', { class: 'flex gap-2' }, [
        h(
          NButton,
          {
            size: 'small',
            onClick: () => verifyDevice(row)
          },
          { default: () => '验证' }
        ),
        h(
          NButton,
          {
            size: 'small',
            type: 'error',
            onClick: () => blockDevice(row)
          },
          { default: () => '阻止' }
        )
      ])
    }
  }
]

// Methods
const refreshDevices = async () => {
  loading.value = true
  try {
    myDevices.value = await e2eeService.getMyDevices()
    pendingRequests.value = e2eeService.getPendingVerificationRequests()
    encryptionStatus.value = await e2eeService.getEncryptionStatus()
  } catch (error) {
    logger.error('Failed to refresh devices:', error)
  } finally {
    loading.value = false
  }
}

const verifyDevice = async (device: DeviceInfo) => {
  try {
    await e2eeService.verifyDevice(device.userId, device.deviceId)
    await refreshDevices()
  } catch (error) {
    logger.error('Failed to verify device:', error)
  }
}

const blockDevice = async (device: DeviceInfo) => {
  try {
    await e2eeService.blockDevice(device.userId, device.deviceId)
    await refreshDevices()
  } catch (error) {
    logger.error('Failed to block device:', error)
  }
}

const acceptVerification = async (requestId: string) => {
  try {
    currentVerificationRequestId.value = requestId
    await e2eeService.acceptVerificationRequest(requestId)
    // SAS modal will be shown via event listener
  } catch (error) {
    logger.error('Failed to accept verification:', error)
  }
}

const declineVerification = async (requestId: string) => {
  try {
    await e2eeService.declineVerificationRequest(requestId)
    await refreshDevices()
  } catch (error) {
    logger.error('Failed to decline verification:', error)
  }
}

const confirmSasVerification = () => {
  // This would be handled by the e2eeService's SAS verifier
  showSasModal.value = false
  currentSas.value = null
  currentVerificationRequestId.value = null
}

const cancelSasVerification = () => {
  showSasModal.value = false
  currentSas.value = null
  currentVerificationRequestId.value = null
}

const setupCrossSigning = () => {
  // This would typically involve user interaction to verify identity
  logger.info('Setup cross-signing requested')
}

// Event handlers
const handleVerificationRequest = (event: CustomEvent) => {
  const request = event.detail as VerificationRequest
  pendingRequests.value.push(request)
}

const handleVerificationSas = (event: CustomEvent) => {
  currentSas.value = event.detail
  showSasModal.value = true
}

const handleVerificationComplete = () => {
  showSasModal.value = false
  currentSas.value = null
  currentVerificationRequestId.value = null
  refreshDevices()
}

// Lifecycle
onMounted(() => {
  refreshDevices()

  // Add event listeners
  window.addEventListener('e2ee:verification-request', handleVerificationRequest as EventListener)
  window.addEventListener('e2ee:verification-sas', handleVerificationSas as EventListener)
  window.addEventListener('e2ee:verification-complete', handleVerificationComplete as EventListener)
})

onUnmounted(() => {
  // Remove event listeners
  window.removeEventListener('e2ee:verification-request', handleVerificationRequest as EventListener)
  window.removeEventListener('e2ee:verification-sas', handleVerificationSas as EventListener)
  window.removeEventListener('e2ee:verification-complete', handleVerificationComplete as EventListener)
})
</script>

<style scoped>
.device-verification {
  max-width: 1000px;
  margin: 0 auto;
}
</style>