<template>
  <div class="private-chat-indicator" v-if="isPrivateChat">
    <!-- 私密聊天标识 -->
    <div class="private-chat-badge">
      <Icon icon="mdi:lock" class="lock-icon" />
      <span class="badge-text">私密聊天</span>
      <n-tag :type="encryptionTagType" size="small" round>
        {{ encryptionLevelText }}
      </n-tag>
    </div>

    <!-- 默认自毁时间提示 -->
    <div class="self-destruct-hint" v-if="defaultSelfDestruct > 0">
      <Icon icon="mdi:timer" />
      <span>默认自毁: {{ formatDestructTime(defaultSelfDestruct) }}</span>
    </div>

    <!-- 参与者信息（仅在群组私密聊天中显示） -->
    <div class="participants-info" v-if="participants.length > 2">
      <Icon icon="mdi:account-group" />
      <span>{{ participants.length }}人参与</span>
    </div>

    <!-- 安全提示 -->
    <div class="security-tip" :class="securityLevel">
      <Icon :icon="securityIcon" />
      <span>{{ securityTipText }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { NTag } from 'naive-ui'
import { usePrivateChatStore } from '@/stores/privateChat'

interface Props {
  roomId: string
}

const props = defineProps<Props>()

const privateChatStore = usePrivateChatStore()

// 计算属性
const isPrivateChat = computed(() => {
  return privateChatStore.isPrivateChat(props.roomId)
})

const privateChatInfo = computed(() => {
  return isPrivateChat.value ? privateChatStore.getPrivateChatInfo(props.roomId) : null
})

const encryptionLevel = computed(() => {
  return privateChatInfo.value?.encryptionLevel || 'standard'
})

const encryptionLevelText = computed(() => {
  return privateChatStore.getEncryptionLevelText(encryptionLevel.value)
})

const encryptionTagType = computed(() => {
  return encryptionLevel.value === 'high' ? 'error' : 'info'
})

const defaultSelfDestruct = computed(() => {
  return privateChatInfo.value?.defaultSelfDestruct || 0
})

const participants = computed(() => {
  return privateChatInfo.value?.participants || []
})

const securityLevel = computed(() => {
  // 根据加密级别和设备验证状态计算安全级别
  if (encryptionLevel.value === 'high') return 'high'
  return encryptionLevel.value === 'standard' ? 'medium' : 'low'
})

const securityIcon = computed(() => {
  switch (securityLevel.value) {
    case 'high':
      return 'mdi:shield-check'
    case 'medium':
      return 'mdi:shield'
    default:
      return 'mdi:shield-alert'
  }
})

const securityTipText = computed(() => {
  switch (securityLevel.value) {
    case 'high':
      return '高级加密 - 所有设备已验证'
    case 'medium':
      return '标准加密 - 部分设备未验证'
    default:
      return '存在安全风险 - 请验证设备'
  }
})

// 方法
const formatDestructTime = (seconds: number): string => {
  if (seconds < 60) return `${seconds}秒`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时`
  return `${Math.floor(seconds / 86400)}天`
}
</script>

<style scoped lang="scss">
.private-chat-indicator {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--card-color);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  margin: 8px 0;

  .private-chat-badge {
    display: flex;
    align-items: center;
    gap: 8px;

    .lock-icon {
      color: var(--hula-brand-primary);
      font-size: 16px;
    }

    .badge-text {
      font-weight: 600;
      color: var(--text-color-1);
    }
  }

  .self-destruct-hint,
  .participants-info {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--text-color-2);
  }

  .self-destruct-hint {
    color: var(--hula-brand-primary);
  }

  .participants-info {
    color: var(--hula-brand-primary);
  }

  .security-tip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 12px;

    &.high {
      background: rgba(34, 197, 94, 0.1);
      color: var(--hula-brand-primary);
    }

    &.medium {
      background: rgba(59, 130, 246, 0.1);
      color: var(--hula-brand-primary);
    }

    &.low {
      background: rgba(239, 68, 68, 0.1);
      color: var(--hula-brand-primary);
    }
  }
}

// 暗色主题适配
.dark {
  .private-chat-indicator {
    .security-tip {
      &.high {
        background: rgba(34, 197, 94, 0.2);
      }

      &.medium {
        background: rgba(59, 130, 246, 0.2);
      }

      &.low {
        background: rgba(239, 68, 68, 0.2);
      }
    }
  }
}
</style>
