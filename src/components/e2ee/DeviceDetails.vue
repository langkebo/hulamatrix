<template>
  <div class="device-details">
    <div class="details-header">
      <div class="device-info">
        <n-avatar
          v-bind="createStrictAvatarProps({
            src: device.avatar || null,
            size: 64,
            round: true
          })"
        >{{ device.displayName?.charAt(0) || 'D' }}</n-avatar>
        <div class="device-basic">
          <h3>{{ device.displayName || device.deviceId }}</h3>
          <p class="device-id">{{ device.deviceId }}</p>
          <div class="device-status">
            <n-tag v-if="device.verified" type="success" size="small">已验证</n-tag>
            <n-tag v-if="device.blocked" type="error" size="small">已屏蔽</n-tag>
            <n-tag v-if="device.currentDevice" type="primary" size="small">当前设备</n-tag>
          </div>
        </div>
      </div>
      <div class="header-actions">
        <n-button
          v-if="!device.blocked && !device.currentDevice"
          :type="device.verified ? 'warning' : 'success'"
          @click="toggleVerification"
          size="small"
        >
          {{ device.verified ? '取消验证' : '验证设备' }}
        </n-button>
        <n-button
          v-if="!device.currentDevice"
          :type="device.blocked ? 'warning' : 'error'"
          @click="toggleBlock"
          size="small"
        >
          {{ device.blocked ? '解除屏蔽' : '屏蔽设备' }}
        </n-button>
      </div>
    </div>

    <n-divider />

    <!-- 设备详情信息 -->
    <div class="device-details-section">
      <h4>设备信息</h4>
      <n-descriptions :column="1" size="small">
        <n-descriptions-item label="设备ID">
          <n-text code>{{ device.deviceId }}</n-text>
        </n-descriptions-item>
        <n-descriptions-item label="显示名称">
          {{ device.displayName || '未设置' }}
        </n-descriptions-item>
        <n-descriptions-item label="设备类型">
          {{ getDeviceType(device.deviceId) }}
        </n-descriptions-item>
        <n-descriptions-item label="最后活跃时间">
          {{ formatTimestamp(device.lastActive) }}
        </n-descriptions-item>
        <n-descriptions-item label="首次注册时间">
          {{ formatTimestamp(device.firstRegistered) }}
        </n-descriptions-item>
        <n-descriptions-item label="用户ID">
          <n-text code>{{ device.userId }}</n-text>
        </n-descriptions-item>
      </n-descriptions>
    </div>

    <!-- 加密密钥信息 -->
    <div class="device-details-section">
      <h4>加密密钥</h4>
      <n-descriptions :column="1" size="small">
        <n-descriptions-item label="身份密钥指纹">
          <n-text code class="fingerprint">{{ device.keys?.ed25519 || 'N/A' }}</n-text>
        </n-descriptions-item>
        <n-descriptions-item label="一次性密钥数量">
          {{ device.keys?.curve25519?.length || 0 }}
        </n-descriptions-item>
        <n-descriptions-item label="密钥算法">
          {{ device.algorithms?.join(', ') || 'N/A' }}
        </n-descriptions-item>
      </n-descriptions>
    </div>

    <!-- 验证状态 -->
    <div class="device-details-section">
      <h4>验证状态</h4>
      <div class="verification-status">
        <n-steps :current="getVerificationStep()" :status="getVerificationStatus()" size="small">
          <n-step title="设备发现" description="设备已在网络中发现" />
          <n-step title="身份验证" description="验证设备身份" />
          <n-step title="密钥确认" description="确认设备密钥指纹" />
          <n-step title="验证完成" description="设备验证完成" />
        </n-steps>
      </div>
    </div>

    <!-- 设备操作历史 -->
    <div class="device-details-section">
      <h4>操作历史</h4>
      <n-timeline>
        <n-timeline-item
          v-for="event in deviceHistory"
          :key="event.id"
          :type="event.type"
          :title="event.title"
          :content="event.description"
          :time="formatTimestamp(event.timestamp)"
        />
      </n-timeline>
    </div>

    <!-- 房间权限 -->
    <div class="device-details-section" v-if="device.roomIds && device.roomIds.length > 0">
      <h4>共享房间 ({{ device.roomIds.length }})</h4>
      <div class="room-list">
        <n-tag
          v-for="roomId in device.roomIds"
          :key="roomId"
          size="small"
          round
          class="room-tag"
        >
          {{ getRoomName(roomId) }}
        </n-tag>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="device-actions">
      <n-space>
        <n-button @click="exportDeviceInfo" size="small">
          <template #icon>
            <n-icon><Download /></n-icon>
          </template>
          导出设备信息
        </n-button>
        <n-button @click="refreshDeviceInfo" size="small" :loading="isRefreshing">
          <template #icon>
            <n-icon><Refresh /></n-icon>
          </template>
          刷新信息
        </n-button>
        <n-button
          v-if="!device.currentDevice"
          type="error"
          @click="confirmRemoveDevice"
          size="small"
        >
          <template #icon>
            <n-icon><Trash /></n-icon>
          </template>
          删除设备
        </n-button>
      </n-space>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  NAvatar,
  NTag,
  NButton,
  NDescriptions,
  NDescriptionsItem,
  NText,
  NDivider,
  NSpace,
  NIcon,
  NSteps,
  NStep,
  NTimeline,
  NTimelineItem
} from 'naive-ui'
import { dlg, msg } from '@/utils/SafeUI'

import type { Device } from '@/stores/core/index'
import { createStrictAvatarProps } from '@/utils/naive-types'

interface Props {
  device: Device
}

interface DeviceHistoryEvent {
  id: string
  type: 'success' | 'info' | 'warning' | 'error'
  title: string
  description: string
  timestamp: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  updated: [device: Device]
  verified: [device: Device]
  blocked: [device: Device]
  removed: [deviceId: string]
}>()

const message = msg

const isRefreshing = ref(false)
const deviceHistory = ref<DeviceHistoryEvent[]>([])

// ========== 计算属性 ==========

const getVerificationStep = (): number => {
  if (props.device.blocked) return 0
  if (!props.device.verified) return 1
  return 4
}

const getVerificationStatus = (): 'process' | 'finish' | 'error' | 'wait' => {
  if (props.device.blocked) return 'error'
  if (!props.device.verified) return 'process'
  return 'finish'
}

// ========== 方法 ==========

const getDeviceType = (deviceId: string): string => {
  if (deviceId.includes('DESKTOP')) return '桌面设备'
  if (deviceId.includes('MOBILE')) return '移动设备'
  if (deviceId.includes('WEB')) return 'Web设备'
  if (deviceId.includes('BOT')) return '机器人'
  return '未知设备'
}

const formatTimestamp = (timestamp?: number): string => {
  if (!timestamp) return '未知'
  return new Date(timestamp).toLocaleString('zh-CN')
}

const getRoomName = (roomId: string): string => {
  // 这里应该从store或服务中获取房间名称
  return roomId.substring(0, 8) + '...'
}

// ========== 事件处理 ==========

const toggleVerification = async () => {
  try {
    if (props.device.verified) {
      // 取消验证
      emit('updated', { ...props.device, verified: false })
      message.success('已取消设备验证')
    } else {
      // 验证设备
      emit('verified', props.device)
      message.success('设备验证成功')
    }
  } catch (error) {
    message.error(`操作失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

const toggleBlock = async () => {
  try {
    if (props.device.blocked) {
      // 解除屏蔽
      emit('updated', { ...props.device, blocked: false })
      message.success('已解除设备屏蔽')
    } else {
      // 屏蔽设备
      emit('blocked', props.device)
      message.success('已屏蔽设备')
    }
  } catch (error) {
    message.error(`操作失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

const exportDeviceInfo = () => {
  const deviceInfo = {
    deviceId: props.device.deviceId,
    displayName: props.device.displayName,
    keys: props.device.keys,
    algorithms: props.device.algorithms,
    userId: props.device.userId,
    verified: props.device.verified,
    blocked: props.device.blocked,
    lastActive: props.device.lastActive,
    firstRegistered: props.device.firstRegistered
  }

  const blob = new Blob([JSON.stringify(deviceInfo, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `device-${props.device.deviceId}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  message.success('设备信息已导出')
}

const refreshDeviceInfo = async () => {
  isRefreshing.value = true
  try {
    // 这里应该调用API刷新设备信息
    await new Promise((resolve) => setTimeout(resolve, 1000))
    message.success('设备信息已刷新')
  } catch (error) {
    message.error(`刷新失败: ${error instanceof Error ? error.message : '未知错误'}`)
  } finally {
    isRefreshing.value = false
  }
}

const confirmRemoveDevice = () => {
  dlg.warning({
    title: '确认删除设备',
    content: `确定要删除设备 "${props.device.displayName || props.device.deviceId}" 吗？此操作不可撤销。`,
    positiveText: '确定删除',
    negativeText: '取消',
    onPositiveClick: () => {
      emit('removed', props.device.deviceId)
      message.success('设备已删除')
    }
  })
}

// ========== 生命周期 ==========

onMounted(() => {
  // 模拟设备历史记录
  deviceHistory.value = [
    {
      id: '1',
      type: 'info',
      title: '设备注册',
      description: '设备首次在网络上注册',
      timestamp: props.device.firstRegistered || Date.now()
    },
    {
      id: '2',
      type: props.device.verified ? 'success' : 'warning',
      title: props.device.verified ? '设备验证' : '等待验证',
      description: props.device.verified ? '设备验证已完成' : '设备等待验证',
      timestamp: props.device.lastActive || Date.now()
    }
  ]
})
</script>

<style lang="scss" scoped>
.device-details {
  padding: 20px;

  .details-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 20px;

    .device-info {
      display: flex;
      align-items: flex-start;
      gap: 16px;

      .device-basic {
        h3 {
          margin: 0 0 8px 0;
          font-size: 18px;
          font-weight: 600;
          color: var(--text-color-1);
        }

        .device-id {
          margin: 0 0 8px 0;
          font-size: 14px;
          color: var(--text-color-3);
          font-family: monospace;
        }

        .device-status {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
      }
    }

    .header-actions {
      display: flex;
      gap: 8px;
      flex-shrink: 0;
    }
  }

  .device-details-section {
    margin-bottom: 24px;

    h4 {
      margin: 0 0 12px 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--text-color-1);
    }

    .fingerprint {
      font-family: monospace;
      font-size: 12px;
      word-break: break-all;
    }

    .verification-status {
      margin-top: 12px;
    }

    .room-list {
      .room-tag {
        margin: 4px;
      }
    }
  }

  .device-actions {
    display: flex;
    justify-content: flex-end;
    padding-top: 16px;
    border-top: 1px solid var(--border-color);
  }
}

// 响应式设计
@media (max-width: 768px) {
  .device-details {
    padding: 16px;

    .details-header {
      flex-direction: column;
      gap: 16px;

      .device-info {
        width: 100%;
      }

      .header-actions {
        width: 100%;
        justify-content: flex-start;
      }
    }

    .device-actions {
      justify-content: center;

      .n-space {
        width: 100%;
        justify-content: center;
      }
    }
  }
}
</style>
