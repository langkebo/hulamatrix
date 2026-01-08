<template>
  <div class="server-card" :class="{ active: isActive, clickable: isClickable }" @click="handleClick">
    <!-- 服务器头像 -->
    <div class="server-avatar">
      <n-avatar :size="48" round :src="server.avatar" color="#00BFA5">
        <template #fallback>
          <n-icon size="24">
            <Server />
          </n-icon>
        </template>
      </n-avatar>
      <div v-if="server.isDefault" class="default-badge">默认</div>
    </div>

    <!-- 服务器信息 -->
    <div class="server-info">
      <div class="server-header">
        <span class="server-name">{{ server.displayName || server.name }}</span>
        <div class="server-actions">
          <n-dropdown v-if="showActions" :options="actionOptions" @select="handleAction">
            <n-button quaternary circle size="small">
              <template #icon>
                <n-icon><DotsVertical /></n-icon>
              </template>
            </n-button>
          </n-dropdown>
        </div>
      </div>

      <div class="server-url">{{ formatUrl(server.homeserverUrl) }}</div>

      <!-- 健康状态 -->
      <div class="server-status">
        <HealthStatusBadge
          :health-status="healthStatus"
          :show-response-time="true"
          :show-refresh-button="true"
          :compact="true"
          @refresh="$emit('refresh', server.id)" />
      </div>

      <!-- 最后连接时间 -->
      <div v-if="server.lastConnected" class="last-connected">
        {{ formatLastConnected(server.lastConnected) }}
      </div>
    </div>

    <!-- 连接状态指示 -->
    <div class="connection-indicator" :class="connectionStatusClass"></div>
  </div>
</template>

<script setup lang="ts">
import { computed, h } from 'vue'
import { NAvatar, NIcon, NButton, NDropdown } from 'naive-ui'
import { Server, DotsVertical, Refresh, Star, Trash, Edit } from '@vicons/tabler'
import HealthStatusBadge from './HealthStatusBadge.vue'
import type { ServerConfig, HealthStatus } from '@/types/server'

interface Props {
  server: ServerConfig
  healthStatus: HealthStatus | null
  isActive?: boolean
  isClickable?: boolean
  showActions?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isActive: false,
  isClickable: true,
  showActions: true
})

const emit = defineEmits<{
  click: [server: ServerConfig]
  refresh: [serverId: string]
  setDefault: [server: ServerConfig]
  delete: [server: ServerConfig]
  edit: [server: ServerConfig]
}>()

const connectionStatusClass = computed(() => {
  if (!props.healthStatus) return 'unknown'
  if (props.healthStatus.reachable) return 'connected'
  return 'disconnected'
})

const actionOptions = computed(() => {
  const options = [
    {
      label: '刷新状态',
      key: 'refresh',
      icon: () => h(NIcon, null, { default: () => h(Refresh) })
    }
  ]

  if (!props.server.isDefault) {
    options.push({
      label: '设为默认',
      key: 'setDefault',
      icon: () => h(NIcon, null, { default: () => h(Star) })
    })
  }

  if (props.server.isCustom) {
    options.push({
      label: '编辑',
      key: 'edit',
      icon: () => h(NIcon, null, { default: () => h(Edit) })
    })
    options.push({
      label: '删除',
      key: 'delete',
      icon: () => h(NIcon, null, { default: () => h(Trash) })
    })
  }

  return options
})

const handleClick = () => {
  if (props.isClickable) {
    emit('click', props.server)
  }
}

const handleAction = (key: string) => {
  switch (key) {
    case 'refresh':
      emit('refresh', props.server.id)
      break
    case 'setDefault':
      emit('setDefault', props.server)
      break
    case 'edit':
      emit('edit', props.server)
      break
    case 'delete':
      emit('delete', props.server)
      break
  }
}

const formatUrl = (url: string) => {
  try {
    const urlObj = new URL(url)
    return urlObj.host
  } catch {
    return url
  }
}

const formatLastConnected = (timestamp: number) => {
  const now = Date.now()
  const diff = now - timestamp

  if (diff < 60 * 1000) {
    return '刚刚连接'
  } else if (diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (60 * 1000))
    return `${minutes} 分钟前连接`
  } else if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000))
    return `${hours} 小时前连接`
  } else {
    const days = Math.floor(diff / (24 * 60 * 60 * 1000))
    return `${days} 天前连接`
  }
}
</script>

<style scoped lang="scss">
.server-card {
  position: relative;
  display: flex;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  background: var(--n-color);
  transition: all 0.2s;

  &.clickable {
    cursor: pointer;

    &:hover {
      border-color: var(--n-primary-color);
      background: var(--n-hover-color);
    }
  }

  &.active {
    border-color: var(--n-primary-color);
    background: rgba(var(--n-primary-color), 0.05);
  }
}

.server-avatar {
  position: relative;
  flex-shrink: 0;
}

.default-badge {
  position: absolute;
  bottom: -2px;
  right: -2px;
  padding: 2px 4px;
  background: var(--n-primary-color);
  color: white;
  font-size: 9px;
  border-radius: 8px;
  line-height: 1;
}

.server-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.server-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.server-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--n-text-color-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.server-url {
  font-size: 12px;
  color: var(--n-text-color-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.server-status {
  display: flex;
  align-items: center;
}

.last-connected {
  font-size: 11px;
  color: var(--n-text-color-3);
}

.connection-indicator {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;

  &.connected {
    background: var(--n-success-color);
    box-shadow: 0 0 6px var(--n-success-color);
  }

  &.disconnected {
    background: var(--n-error-color);
  }

  &.unknown {
    background: var(--n-text-color-3);
  }
}
</style>
