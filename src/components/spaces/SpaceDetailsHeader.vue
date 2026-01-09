<template>
  <div class="space-details-header">
    <!-- 空间头像和封面 -->
    <div class="space-cover">
      <div v-if="safeSpace.avatar" class="space-avatar">
        <img :src="safeSpace.avatar" :alt="safeSpace.name" />
      </div>
      <div v-else class="space-placeholder">
        <n-icon size="64"><Building /></n-icon>
        <span class="placeholder-text">{{ safeSpace.name.charAt(0).toUpperCase() }}</span>
      </div>
      <div class="space-overlay">
        <n-button v-if="safeSpace.isPublic" circle size="small" type="info">
          <template #icon>
            <n-icon><World /></n-icon>
          </template>
        </n-button>
        <n-button v-if="safeSpace.isArchived" circle size="small" type="warning">
          <template #icon>
            <n-icon><Archive /></n-icon>
          </template>
        </n-button>
      </div>
    </div>

    <!-- 空间信息 -->
    <div class="space-info">
      <div class="space-title">
        <h2>{{ safeSpace.name }}</h2>
        <div class="space-badges">
          <n-tag v-if="safeSpace.isPublic" type="info" size="small">
            <template #icon>
              <n-icon><World /></n-icon>
            </template>
            公开
          </n-tag>
          <n-tag v-if="safeSpace.isArchived" type="warning" size="small">
            <template #icon>
              <n-icon><Archive /></n-icon>
            </template>
            已归档
          </n-tag>
          <n-tag v-if="safeSpace.isFavorite" type="warning" size="small">
            <template #icon>
              <n-icon><Star /></n-icon>
            </template>
            已收藏
          </n-tag>
        </div>
      </div>

      <div v-if="safeSpace.topic" class="space-description">
        <p>{{ safeSpace.topic }}</p>
      </div>

      <div class="space-meta">
        <div class="meta-item">
          <n-icon><Users /></n-icon>
          <span>{{ safeSpace.memberCount }} 成员</span>
        </div>
        <div class="meta-item">
          <n-icon><Hash /></n-icon>
          <span>{{ safeSpace.roomCount }} 房间</span>
        </div>
        <div class="meta-item">
          <n-icon><Calendar /></n-icon>
          <span>创建于 {{ formatDate(safeSpace.created || Date.now()) }}</span>
        </div>
        <div class="meta-item">
          <n-icon><Clock /></n-icon>
          <span>{{ formatLastActivity() }}</span>
        </div>
      </div>

      <div class="space-actions">
        <n-button v-if="!safeSpace.isJoined" type="primary" @click="$emit('join')" :loading="isJoining">
          <template #icon>
            <n-icon><Plus /></n-icon>
          </template>
          加入空间
        </n-button>

        <n-dropdown v-else :options="spaceActions" @select="$emit('space-action', $event)" placement="bottom-end">
          <n-button type="primary">
            <template #icon>
              <n-icon><Settings /></n-icon>
            </template>
            管理空间
          </n-button>
        </n-dropdown>

        <n-button @click="$emit('close')">关闭</n-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NButton, NTag, NIcon, NDropdown } from 'naive-ui'
import { Building, World, Archive, Star, Users, Hash, Calendar, Clock, Plus, Settings } from '@vicons/tabler'
import type { SpaceDetailsProps } from './types'
import type { NaiveType } from './types'

interface Props {
  space: SpaceDetailsProps['space']
  isJoining?: boolean
}

interface Emits {
  (e: 'join'): void
  (e: 'close'): void
  (e: 'space-action', action: string): void
}

const props = withDefaults(defineProps<Props>(), {
  isJoining: false
})

const emit = defineEmits<Emits>()

const safeSpace = computed(() => {
  if (!props.space) {
    return {
      id: '',
      name: '未知空间',
      topic: '',
      avatar: '',
      isPublic: false,
      isArchived: false,
      isFavorite: false,
      isJoined: false,
      isAdmin: false,
      memberCount: 0,
      roomCount: 0,
      created: Date.now()
    }
  }

  return {
    ...props.space,
    avatar: props.space?.avatar || '',
    name: props.space?.name || '未知空间',
    memberCount: props.space?.memberCount || 0,
    roomCount: props.space?.roomCount || 0,
    created: props.space?.created || Date.now()
  }
})

const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

const formatLastActivity = (): string => {
  if (!safeSpace.value.lastActivity) return '未知'

  const now = Date.now()
  const diff = now - (safeSpace.value.lastActivity || 0)

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`

  return formatDate(safeSpace.value.lastActivity || Date.now())
}

const spaceActions = computed(() => {
  return [
    {
      label: '空间设置',
      key: 'settings',
      disabled: !safeSpace.value.isAdmin
    },
    {
      label: '邀请成员',
      key: 'invite',
      disabled: !safeSpace.value.isJoined
    },
    {
      label: safeSpace.value.isFavorite ? '取消收藏' : '收藏空间',
      key: 'toggle_favorite'
    },
    {
      label: '复制空间链接',
      key: 'copy_link'
    },
    {
      label: safeSpace.value.isArchived ? '取消归档' : '归档空间',
      key: safeSpace.value.isArchived ? 'unarchive' : 'archive'
    },
    {
      label: '退出空间',
      key: 'leave',
      disabled: !safeSpace.value.isJoined
    }
  ]
})
</script>

<style lang="scss" scoped>
.space-details-header {
  .space-cover {
    position: relative;
    height: 200px;
    overflow: hidden;

    .space-avatar {
      width: 100%;
      height: 100%;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }

    .space-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, var(--hula-brand-primary) 0%, var(--hula-brand-primary) 100%);
      color: white;

      .placeholder-text {
        margin-top: 12px;
        font-size: 48px;
        font-weight: bold;
      }
    }

    .space-overlay {
      position: absolute;
      top: 16px;
      right: 16px;
      display: flex;
      gap: 8px;
    }
  }

  .space-info {
    padding: 24px;

    .space-title {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;

      h2 {
        margin: 0;
        font-size: 28px;
        font-weight: 600;
      }

      .space-badges {
        display: flex;
        gap: 8px;
      }
    }

    .space-description {
      margin-bottom: 16px;
      color: var(--text-color-2);
      p {
        margin: 0;
        line-height: 1.6;
      }
    }

    .space-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 24px;
      margin-bottom: 24px;

      .meta-item {
        display: flex;
        align-items: center;
        gap: 6px;
        color: var(--text-color-2);
        font-size: 14px;
      }
    }

    .space-actions {
      display: flex;
      gap: 12px;
    }
  }
}
</style>
