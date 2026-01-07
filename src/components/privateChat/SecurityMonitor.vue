<template>
  <div class="security-monitor" :class="{ 'has-warnings': hasWarnings }">
    <!-- 安全状态指示器 -->
    <div class="security-status" :class="statusClass">
      <span class="status-icon">{{ statusIcon }}</span>
      <span class="status-text">{{ statusText }}</span>
    </div>

    <!-- 警告列表（展开时显示） -->
    <div v-if="hasWarnings && showDetails" class="warnings-collapse">
      <div class="warnings-header">安全警告</div>
      <div class="warnings-list">
        <div v-for="(warning, index) in warnings" :key="index" class="warning-item">
          <n-icon :component="AlertTriangle" :size="16" color="#f5222d" />
          <span>{{ warning }}</span>
        </div>
      </div>
    </div>

    <!-- 加密统计（可选显示） -->
    <div v-if="showStats && encryptionStats" class="encryption-stats">
      <div class="stat-item">
        <span class="stat-label">加密消息:</span>
        <span class="stat-value">{{ encryptionStats.encryptedMessages }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">成功率:</span>
        <span class="stat-value">{{ encryptionStats.encryptionSuccessRate.toFixed(1) }}%</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">密钥轮换:</span>
        <span class="stat-value">{{ encryptionStats.keyRotations }} 次</span>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div v-if="showActions" class="security-actions">
      <n-button size="small" @click="handleRefresh">
        <template #icon>
          <n-icon :component="Refresh" />
        </template>
        刷新状态
      </n-button>
      <n-button size="small" type="error" v-if="hasWarnings" @click="handleClearWarnings">
        <template #icon>
          <n-icon :component="X" />
        </template>
        清除警告
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { NButton, NIcon } from 'naive-ui'
import { AlertTriangle, Refresh, Shield, X } from '@vicons/tabler'
import { usePrivateChatSDKStore } from '@/stores/privateChatSDK'
import { e2eeServiceEnhanced } from '@/services/e2eeServiceEnhanced'
import type { EncryptionStats } from '@/types/private-chat-security'

// Props
interface Props {
  sessionId?: string
  showDetails?: boolean
  showStats?: boolean
  showActions?: boolean
  autoRefresh?: boolean
  refreshInterval?: number
}

const props = withDefaults(defineProps<Props>(), {
  showDetails: true,
  showStats: false,
  showActions: true,
  autoRefresh: true,
  refreshInterval: 30000 // 30秒
})

// Store
const privateChatStore = usePrivateChatSDKStore()

// 加密统计
const encryptionStats = ref<EncryptionStats | null>(null)

// 计算样式类
const statusClass = computed(() => {
  if (hasWarnings.value) return 'warning'
  if (privateChatStore.isCurrentEncrypted) return 'secure'
  return 'insecure'
})

// 状态图标
const statusIcon = computed(() => {
  if (hasWarnings.value) return '⚠️'
  if (privateChatStore.isCurrentEncrypted) return '🔒'
  return '🔓'
})

// 状态文本
const statusText = computed(() => {
  if (hasWarnings.value) return '存在安全问题'
  if (privateChatStore.isCurrentEncrypted) {
    const score = privateChatStore.currentStrengthScore
    if (score >= 80) return '加密安全'
    if (score >= 60) return '加密良好'
    return '已加密'
  }
  return '未加密'
})

// 是否有警告
const hasWarnings = computed(() => {
  return privateChatStore.securityWarnings.length > 0
})

// 安全警告列表
const warnings = computed(() => {
  return privateChatStore.securityWarnings
})

// 刷新状态
const handleRefresh = async () => {
  const sessionId = props.sessionId || privateChatStore.currentSessionId
  if (sessionId) {
    await privateChatStore.getEncryptionStatus(sessionId)
    encryptionStats.value = e2eeServiceEnhanced.getEncryptionStats(sessionId)
  }
}

// 清除警告
const handleClearWarnings = () => {
  const sessionId = props.sessionId || privateChatStore.currentSessionId
  if (sessionId) {
    e2eeServiceEnhanced.clearAuditLog(sessionId)
    privateChatStore.securityWarnings = []
  }
}

// 监听安全警告事件
const handleSecurityWarning = (event: CustomEvent) => {
  const { sessionId } = event.detail
  const currentSessionId = props.sessionId || privateChatStore.currentSessionId

  if (sessionId === currentSessionId) {
    handleRefresh()
  }
}

// 自动刷新定时器
let refreshTimer: ReturnType<typeof setInterval> | null = null

// 生命周期
onMounted(() => {
  handleRefresh()

  // 设置自动刷新
  if (props.autoRefresh && props.refreshInterval > 0) {
    refreshTimer = setInterval(handleRefresh, props.refreshInterval)
  }

  // 监听安全警告事件
  window.addEventListener('security.warning', handleSecurityWarning as EventListener)
})

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
  }

  window.removeEventListener('security.warning', handleSecurityWarning as EventListener)
})

// 暴露刷新方法
defineExpose({
  refresh: handleRefresh,
  clearWarnings: handleClearWarnings
})
</script>

<style scoped lang="scss">
.security-monitor {
  padding: 12px;
  border-radius: 8px;
  background-color: var(--n-color);
  border: 1px solid var(--n-border-color);

  &.has-warnings {
    border-color: #f5222d;
    background-color: rgba(245, 34, 45, 0.05);
  }
}

.security-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 4px;
  margin-bottom: 8px;

  &.secure {
    background-color: rgba(82, 196, 26, 0.1);
    color: #52c41a;
  }

  &.insecure {
    background-color: rgba(245, 34, 45, 0.1);
    color: #f5222d;
  }

  &.warning {
    background-color: rgba(250, 173, 20, 0.1);
    color: #faad14;
  }
}

.status-icon {
  font-size: 18px;
}

.status-text {
  font-weight: 500;
  font-size: 14px;
}

.warnings-collapse {
  margin-top: 8px;
}

.warnings-header {
  font-size: 13px;
  font-weight: 500;
  padding: 6px 8px;
  color: var(--n-text-color-2);
}

.warnings-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.warning-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px;
  background-color: rgba(245, 34, 45, 0.05);
  border-radius: 4px;
  font-size: 13px;
}

.encryption-stats {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--n-divider-color);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  font-size: 12px;

  .stat-label {
    color: var(--n-text-color-2);
  }

  .stat-value {
    font-weight: 500;
    color: var(--n-text-color-1);
  }
}

.security-actions {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--n-divider-color);
  display: flex;
  gap: 8px;
}
</style>
