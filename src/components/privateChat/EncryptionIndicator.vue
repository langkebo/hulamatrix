<template>
  <div class="encryption-indicator" :class="statusClass">
    <!-- 加密状态图标 -->
    <div class="encryption-icon" :style="{ width: `${iconSize}px`, height: `${iconSize}px` }">
      <svg v-if="status.encrypted" viewBox="0 0 24 24" fill="currentColor">
        <path
          d="M12 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm6-9h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zM9 6a3 3 0 1 1 6 0v2H9V6z" />
      </svg>
      <svg v-else viewBox="0 0 24 24" fill="currentColor">
        <path
          d="M12 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm6-9h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zM9 6a3 3 0 1 1 6 0v2H9V6z"
          opacity="0.5" />
        <path d="M12 23a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2z" />
      </svg>
    </div>

    <!-- 加密状态文本 -->
    <div v-if="showLabel" class="encryption-label">
      <span v-if="status.encrypted">{{ statusText }}</span>
      <span v-else class="unencrypted-warning">未加密</span>
    </div>

    <!-- 加密详情（悬停显示） -->
    <n-tooltip v-if="showDetails" trigger="hover" placement="top">
      <template #trigger>
        <svg class="info-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
        </svg>
      </template>
      <div class="encryption-details">
        <div class="detail-row">
          <span class="detail-label">加密状态:</span>
          <span :class="status.encrypted ? 'encrypted' : 'unencrypted'">
            {{ status.encrypted ? '已加密' : '未加密' }}
          </span>
        </div>
        <div v-if="status.encrypted" class="detail-row">
          <span class="detail-label">算法:</span>
          <span>{{ status.algorithm }}</span>
        </div>
        <div v-if="status.keyId" class="detail-row">
          <span class="detail-label">密钥 ID:</span>
          <span class="key-id">{{ truncateKeyId(status.keyId) }}</span>
        </div>
        <div v-if="status.keyCreatedAt" class="detail-row">
          <span class="detail-label">密钥创建:</span>
          <span>{{ formatTimestamp(status.keyCreatedAt) }}</span>
        </div>
        <div v-if="status.keyExpiresAt" class="detail-row">
          <span class="detail-label">密钥过期:</span>
          <span :class="{ 'expiring-soon': isKeyExpiringSoon() }">
            {{ formatTimestamp(status.keyExpiresAt) }}
          </span>
        </div>
        <div v-if="status.needsRotation" class="detail-row warning">
          <span class="detail-label">⚠️ 密钥需要轮换</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">加密强度:</span>
          <n-progress
            type="line"
            :percentage="status.strengthScore"
            :show-indicator="false"
            :height="4"
            :border-radius="2"
            :color="strengthColor" />
          <span class="strength-score">{{ status.strengthScore }}/100</span>
        </div>
      </div>
    </n-tooltip>

    <!-- 安全警告 -->
    <n-badge v-if="hasWarnings" :value="warningCount" :max="9" class="warning-badge" />
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted, ref } from 'vue'
import { logger } from '@/utils/logger'
import { NTooltip, NProgress, NBadge } from 'naive-ui'
import type { EncryptionStatus } from '@/types/private-chat-security'
import { EncryptionLevel } from '@/types/private-chat-security'

// Inline SVG icons (since @vicons/material is not installed)
const LockClosedIcon = {
  template: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm6-9h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zM9 6a3 3 0 1 1 6 0v2H9V6z"/></svg>`
}

const LockOpenIcon = {
  template: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm6-9h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zM9 6a3 3 0 1 1 6 0v2H9V6z" opacity="0.5"/><path d="M12 23a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2z"/></svg>`
}

const InfoIcon = {
  template: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`
}

// Props
interface Props {
  sessionId?: string
  showLabel?: boolean
  showDetails?: boolean
  iconSize?: number
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showLabel: true,
  showDetails: true,
  iconSize: 20,
  compact: false
})

// 注入 PrivateChat 扩展
const privateChat = inject<any>('privateChat')
const e2eeService = inject<any>('e2eeService')

// 加密状态
const status = ref<EncryptionStatus>({
  level: EncryptionLevel.BASIC,
  encrypted: false,
  algorithm: 'aes-gcm-256',
  needsRotation: false,
  strengthScore: 0
})

// 安全警告
const warnings = ref<string[]>([])
const warningCount = computed(() => warnings.value.length)
const hasWarnings = computed(() => warningCount.value > 0)

// 刷新状态
const refreshStatus = async () => {
  if (!props.sessionId || !e2eeService) return

  try {
    // 获取加密状态
    const encryptionStatus = await e2eeService.getSessionEncryptionStatus?.(props.sessionId)

    if (encryptionStatus) {
      status.value = {
        level: encryptionStatus.level || EncryptionLevel.STANDARD,
        encrypted: encryptionStatus.encrypted,
        algorithm: encryptionStatus.algorithm || 'aes-gcm-256',
        keyId: encryptionStatus.keyId,
        keyCreatedAt: encryptionStatus.keyCreatedAt,
        keyExpiresAt: encryptionStatus.keyExpiresAt,
        needsRotation: encryptionStatus.needsRotation || false,
        lastVerifiedAt: encryptionStatus.lastVerifiedAt,
        strengthScore: calculateStrengthScore(encryptionStatus)
      }
    }

    // 获取安全警告
    warnings.value = (await e2eeService.getSecurityWarnings?.(props.sessionId)) || []
  } catch (error) {
    logger.error('Failed to refresh encryption status:', error)
  }
}

// 计算加密强度评分
const calculateStrengthScore = (encryptionStatus: EncryptionStatus): number => {
  let score = 0

  // 基础加密 (40分)
  if (encryptionStatus.encrypted) score += 40

  // 算法强度 (20分)
  if (encryptionStatus.algorithm === 'aes-gcm-256') score += 20

  // 密钥轮换 (20分)
  if (!encryptionStatus.needsRotation) score += 20

  // 密钥新鲜度 (10分)
  if (encryptionStatus.keyExpiresAt) {
    const timeUntilExpiry = encryptionStatus.keyExpiresAt - Date.now()
    if (timeUntilExpiry > 7 * 24 * 60 * 60 * 1000) score += 10
    else if (timeUntilExpiry > 24 * 60 * 60 * 1000) score += 5
  }

  // 最近验证 (10分)
  if (encryptionStatus.lastVerifiedAt) {
    const timeSinceVerification = Date.now() - encryptionStatus.lastVerifiedAt
    if (timeSinceVerification < 60 * 60 * 1000) score += 10
    else if (timeSinceVerification < 24 * 60 * 60 * 1000) score += 5
  }

  return Math.min(100, score)
}

// 计算样式类
const statusClass = computed(() => ({
  encrypted: status.value.encrypted,
  unencrypted: !status.value.encrypted,
  expiring: status.value.needsRotation,
  compact: props.compact
}))

// 状态文本
const statusText = computed(() => {
  if (!status.value.encrypted) return '未加密'

  switch (status.value.level) {
    case 'advanced':
      return '高级加密'
    case 'standard':
      return '标准加密'
    case 'basic':
      return '基础加密'
    default:
      return '已加密'
  }
})

// 加密强度颜色
const strengthColor = computed(() => {
  const score = status.value.strengthScore
  if (score >= 80) return 'var(--hula-brand-primary)' // green
  if (score >= 60) return 'var(--hula-brand-primary)' // blue
  if (score >= 40) return 'var(--hula-brand-primary)' // orange
  return 'var(--hula-brand-primary)' // red
})

// 截断密钥 ID
const truncateKeyId = (keyId: string): string => {
  if (!keyId) return ''
  return keyId.length > 12 ? `${keyId.slice(0, 6)}...${keyId.slice(-6)}` : keyId
}

// 格式化时间戳
const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins}分钟后`
  if (diffHours < 24) return `${diffHours}小时后`
  if (diffDays < 7) return `${diffDays}天后`

  return date.toLocaleDateString('zh-CN')
}

// 检查密钥是否即将过期
const isKeyExpiringSoon = (): boolean => {
  if (!status.value.keyExpiresAt) return false
  const timeUntilExpiry = status.value.keyExpiresAt - Date.now()
  return timeUntilExpiry < 24 * 60 * 60 * 1000 // 24小时内
}

// 监听安全警告事件
const handleSecurityWarning = (event: CustomEvent) => {
  const { sessionId, type } = event.detail
  if (sessionId === props.sessionId) {
    warnings.value.push(type)
    refreshStatus()
  }
}

// 生命周期
let refreshInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  refreshStatus()

  // 定期刷新状态
  refreshInterval = setInterval(refreshStatus, 30000) // 30秒

  // 监听安全警告事件
  window.addEventListener('security.warning', handleSecurityWarning as EventListener)
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }

  window.removeEventListener('security.warning', handleSecurityWarning as EventListener)
})

// 暴露刷新方法
defineExpose({
  refresh: refreshStatus
})
</script>

<style scoped lang="scss">
.encryption-indicator {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.3s ease;

  &.encrypted {
    background-color: rgba(var(--hula-success-rgb), 0.1);
    color: var(--hula-brand-primary);

    .encryption-icon {
      color: var(--hula-brand-primary);
    }
  }

  &.unencrypted {
    background-color: rgba(245, 34, 45, 0.1);
    color: var(--hula-brand-primary);

    .encryption-icon {
      color: var(--hula-brand-primary);
    }
  }

  &.expiring {
    background-color: rgba(250, 173, 20, 0.1);
    color: var(--hula-brand-primary);

    .encryption-icon {
      color: var(--hula-brand-primary);
    }
  }

  &.compact {
    padding: 2px 6px;
    gap: 2px;

    .encryption-label {
      display: none;
    }
  }
}

.encryption-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.encryption-label {
  font-size: 12px;
  font-weight: 500;

  .unencrypted-warning {
    font-weight: 700;
  }
}

.info-icon {
  margin-left: 4px;
  cursor: help;
  color: var(--hula-gray-400);

  &:hover {
    color: var(--hula-gray-700);
  }
}

.encryption-details {
  min-width: 200px;
  padding: 8px;

  .detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
    font-size: 12px;

    &:last-child {
      margin-bottom: 0;
    }

    &.warning {
      color: var(--hula-brand-primary);
      font-weight: 500;
    }
  }

  .detail-label {
    color: var(--hula-gray-400);
    margin-right: 8px;
  }

  .key-id {
    font-family: 'Courier New', monospace;
    font-size: 11px;
  }

  .encrypted {
    color: var(--hula-brand-primary);
    font-weight: 500;
  }

  .unencrypted {
    color: var(--hula-brand-primary);
    font-weight: 700;
  }

  .expiring-soon {
    color: var(--hula-brand-primary);
    font-weight: 500;
  }

  .strength-score {
    margin-left: 8px;
    font-weight: 500;
  }
}

.warning-badge {
  position: absolute;
  top: -4px;
  right: -4px;
}
</style>
