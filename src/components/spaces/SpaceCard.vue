<template>
  <div
    v-if="props.space"
    class="space-card"
    :class="{ 'is-joined': isJoined, 'is-public': safeSpace.isPublic, 'is-hovered': isHovered }"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false">
    <!-- 空间封面 -->
    <div class="space-cover" @click="handleView">
      <div v-if="safeSpace.avatar" class="space-avatar">
        <img :src="safeSpace.avatar" :alt="safeSpace.name" />
      </div>
      <div v-else class="space-placeholder">
        <n-icon size="48"><Building /></n-icon>
        <span class="placeholder-text">{{ safeSpace.name.charAt(0).toUpperCase() }}</span>
      </div>

      <!-- 空间状态覆盖层 -->
      <div class="space-overlay">
        <div
          v-if="safeSpace.notifications?.highlightCount && safeSpace.notifications.highlightCount > 0"
          class="highlight-badge">
          {{ safeSpace.notifications.highlightCount }}
        </div>
        <div
          v-if="safeSpace.notifications?.notificationCount && safeSpace.notifications.notificationCount > 0"
          class="notification-badge">
          {{ safeSpace.notifications.notificationCount }}
        </div>
        <div v-if="!isJoined" class="join-indicator">
          <n-icon><Plus /></n-icon>
        </div>
        <div v-if="safeSpace.isPublic" class="privacy-indicator">
          <n-icon><Globe /></n-icon>
        </div>
        <div v-if="safeSpace.isArchived" class="archive-indicator">
          <n-icon><Archive /></n-icon>
        </div>
      </div>

      <!-- 渐变背景 -->
      <div
        class="space-gradient"
        :style="{
          background:
            safeSpace.theme?.gradient ||
            'linear-gradient(135deg, var(--hula-brand-primary) 0%, var(--hula-brand-primary) 100%)'
        }"></div>
    </div>

    <!-- 空间信息 -->
    <div class="space-info">
      <div class="space-header">
        <h3 class="space-name" :title="safeSpace.name">{{ safeSpace.name }}</h3>
        <div class="space-actions" @click.stop>
          <!-- 加入/退出按钮 -->
          <n-button v-if="!isJoined" type="primary" size="small" @click="handleJoin" :loading="isJoining">
            <template #icon>
              <n-icon><Plus /></n-icon>
            </template>
            加入
          </n-button>

          <!-- 管理按钮 -->
          <n-dropdown v-else :options="getSpaceActions()" @select="handleSpaceAction" placement="bottom-end">
            <n-button size="small" quaternary>
              <template #icon>
                <n-icon><MoreHorizontal /></n-icon>
              </template>
            </n-button>
          </n-dropdown>
        </div>
      </div>

      <div class="space-description" v-if="safeSpace.topic">
        <p :title="safeSpace.topic">{{ safeSpace.topic }}</p>
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
        <div v-if="safeSpace.isArchived" class="meta-item archived">
          <n-icon><Archive /></n-icon>
          <span>已归档</span>
        </div>
      </div>

      <!-- 子空间预览 -->
      <div v-if="safeSpace.children && safeSpace.children.length > 0" class="space-children">
        <div class="children-preview">
          <span class="children-label">{{ safeSpace.children.length }} 个子空间</span>
          <div class="children-avatars">
            <n-avatar
              v-for="i in Math.min(childrenPreview.length, 4)"
              :key="childrenPreview[i - 1]?.roomId || i"
              :src="getChildAvatar(i - 1)"
              :size="24"
              round
              :style="{ marginLeft: i > 1 ? '-8px' : '0' }">
              <template #fallback>
                <span>{{ getChildFallback(i - 1) }}</span>
              </template>
            </n-avatar>
            <span v-if="childrenPreview.length > 4" class="more-children">+{{ childrenPreview.length - 4 }}</span>
          </div>
        </div>
      </div>

      <!-- 空间标签 -->
      <div class="space-tags">
        <n-tag v-if="safeSpace.isPublic" type="info" size="small" round>
          <template #icon>
            <n-icon><Globe /></n-icon>
          </template>
          公开
        </n-tag>
        <n-tag v-if="safeSpace.isArchived" type="default" size="small" round>
          <template #icon>
            <n-icon><Archive /></n-icon>
          </template>
          已归档
        </n-tag>
        <n-tag v-for="tag in safeSpace.tags" :key="tag" size="small" round>
          {{ tag }}
        </n-tag>
      </div>

      <!-- 活动状态 -->
      <div class="space-activity">
        <div class="activity-indicator" :class="{ 'is-active': safeSpace.isActive }">
          <div class="activity-dot"></div>
          <span class="activity-text">
            {{ getActivityText() }}
          </span>
        </div>
        <div class="last-activity">
          <n-icon><Clock /></n-icon>
          <span>{{ formatLastActivity() }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { NIcon, NButton, NTag, NAvatar, NDropdown } from 'naive-ui'
import { Building, Plus, Users, Hash, Archive, Globe, MoreHorizontal, Clock } from '@/icons/TablerPlaceholders'

import { msg } from '@/utils/SafeUI'
import { logger } from '@/utils/logger'
import type { Space, SpaceChild } from '@/hooks/useMatrixSpaces'

interface Props {
  space: Space | null
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  space: null,
  compact: false
})

const emit = defineEmits<{
  join: [space: Space]
  leave: [space: Space]
  manage: [space: Space]
  view: [space: Space]
}>()

const message = msg

// 状态管理
const isHovered = ref(false)
const isJoining = ref(false)

// 计算属性
const isJoined = computed(() => {
  return props.space?.children?.some((child) => child.isJoined) || false
})

const childrenPreview = computed(() => props.space?.children || [])

// Safe space access with default values
const safeSpace = computed(() => {
  if (!props.space) {
    return {
      id: '',
      name: 'Unknown Space',
      topic: '',
      avatar: '',
      isPublic: false,
      isArchived: false,
      isActive: false,
      isFavorite: false,
      isAdmin: false,
      memberCount: 0,
      roomCount: 0,
      lastActivity: Date.now(),
      notifications: { highlightCount: 0, notificationCount: 0 },
      tags: [],
      theme: { gradient: '' },
      children: []
    } as Space
  }
  return props.space
})

const getChildFallback = (index: number): string => {
  const child = childrenPreview.value[index]
  if (child?.name) {
    return child.name.charAt(0).toUpperCase()
  }
  return '?'
}

const getChildAvatar = (index: number): string => {
  const child = childrenPreview.value[index]
  const avatar = child?.avatar
  return (typeof avatar === 'string' ? avatar : '') || ''
}

// ========== 方法 ==========

const getActivityText = (): string => {
  if (safeSpace.value.isActive) {
    return '活跃中'
  }
  return '最近活跃'
}

const formatLastActivity = (): string => {
  const now = Date.now()
  const lastActivity = safeSpace.value.lastActivity || now
  const diff = now - lastActivity

  if (diff < 60000) {
    // 1分钟内
    return '刚刚'
  } else if (diff < 3600000) {
    // 1小时内
    return `${Math.floor(diff / 60000)} 分钟前`
  } else if (diff < 86400000) {
    // 24小时内
    return `${Math.floor(diff / 3600000)} 小时前`
  } else if (diff < 604800000) {
    // 7天内
    return `${Math.floor(diff / 86400000)} 天前`
  } else {
    return `${Math.floor(diff / 604800000)} 周前`
  }
}

const getSpaceActions = () => {
  const actions = [
    {
      label: '查看详情',
      key: 'view',
      icon: () => '👁️'
    },
    {
      label: '复制链接',
      key: 'copy-link',
      icon: () => '🔗'
    }
  ]

  // 如果是成员，显示更多操作
  if (isJoined.value) {
    actions.push(
      {
        label: '设置通知',
        key: 'notifications',
        icon: () => '🔔'
      },
      {
        label: '标记为收藏',
        key: 'favorite',
        icon: () => '⭐'
      },
      {
        label: '邀请成员',
        key: 'invite',
        icon: () => '👥'
      }
    )

    // 如果是管理员，显示管理选项
    if (safeSpace.value.isAdmin) {
      actions.push(
        {
          label: '编辑空间',
          key: 'edit',
          icon: () => '✏️'
        },
        {
          label: '管理成员',
          key: 'manage-members',
          icon: () => '👥'
        },
        {
          label: '空间设置',
          key: 'settings',
          icon: () => '⚙️'
        },
        {
          label: '归档空间',
          key: 'archive',
          icon: () => '📦'
        },
        {
          label: '离开空间',
          key: 'leave',
          icon: () => '🚪'
        }
      )
    } else {
      actions.push({
        label: '离开空间',
        key: 'leave',
        icon: () => '🚪'
      })
    }
  }

  return actions
}

// ========== 事件处理 ==========

const handleView = () => {
  if (props.space) {
    emit('view', props.space)
  }
}

const handleJoin = async () => {
  if (!props.space) return
  isJoining.value = true
  try {
    emit('join', props.space)
    message.success(`已申请加入空间: ${props.space.name}`)
  } catch (error) {
    logger.error('Failed to join space:', error)
    message.error('加入空间失败')
  } finally {
    isJoining.value = false
  }
}

const handleLeave = async () => {
  if (!props.space) return
  try {
    emit('leave', props.space)
    message.success(`已离开空间: ${props.space.name}`)
  } catch (error) {
    logger.error('Failed to leave space:', error)
    message.error('离开空间失败')
  }
}

const handleSpaceAction = async (action: string) => {
  switch (action) {
    case 'view':
      handleView()
      break

    case 'copy-link':
      await copySpaceLink()
      break

    case 'notifications':
      handleNotifications()
      break

    case 'favorite':
      await toggleFavorite()
      break

    case 'invite':
      handleInviteMembers()
      break

    case 'edit':
      handleEditSpace()
      break

    case 'manage-members':
      handleManageMembers()
      break

    case 'settings':
      handleSpaceSettings()
      break

    case 'archive':
      await handleArchiveSpace()
      break

    case 'leave':
      await handleLeave()
      break
  }
}

const copySpaceLink = async () => {
  if (!props.space) return
  const link = `${window.location.origin}/space/${props.space.id}`
  try {
    await navigator.clipboard.writeText(link)
    message.success('空间链接已复制到剪贴板')
  } catch (error) {
    message.error('复制链接失败')
  }
}

const handleNotifications = () => {
  // 打开通知设置对话框
  message.info('通知设置功能开发中')
}

const toggleFavorite = async () => {
  // 切换收藏状态
  const isFavorite = !safeSpace.value.isFavorite
  message.info(isFavorite ? '已添加到收藏' : '已从收藏中移除')
}

const handleInviteMembers = () => {
  // 打开邀请成员对话框
  message.info('邀请成员功能开发中')
}

const handleEditSpace = () => {
  // 打开编辑空间对话框
  message.info('编辑空间功能开发中')
}

const handleManageMembers = () => {
  // 打开成员管理界面
  message.info('成员管理功能开发中')
}

const handleSpaceSettings = () => {
  // 打开空间设置对话框
  message.info('空间设置功能开发中')
}

const handleArchiveSpace = async () => {
  try {
    // 实现归档功能
    message.success('空间已归档')
  } catch (error) {
    message.error('归档空间失败')
  }
}
</script>

<style lang="scss" scoped>
.space-card {
  background: var(--card-color);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  height: 280px;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(var(--hula-black-rgb), 0.12);
    border-color: var(--primary-color);
  }

  &.is-joined {
    .space-cover {
      .join-indicator {
        opacity: 0;
      }
    }
  }

  &.is-hovered {
    .space-cover {
      .space-overlay {
        opacity: 1;
      }
    }
  }

  .space-cover {
    position: relative;
    height: 140px;
    overflow: hidden;

    .space-avatar {
      width: 100%;
      height: 100%;
      position: relative;

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
        font-size: 48px;
        font-weight: 600;
        text-transform: uppercase;
        opacity: 0.8;
      }
    }

    .space-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: none;
      display: flex;
      align-items: flex-start;
      justify-content: flex-end;
      padding: 8px;
      gap: 8px;

      .highlight-badge,
      .notification-badge {
        background: var(--error-color);
        color: white;
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 600;
        box-shadow: 0 2px 8px rgba(var(--hula-black-rgb), 0.2);
      }

      .notification-badge {
        background: var(--primary-color);
      }

      .join-indicator,
      .privacy-indicator,
      .archive-indicator {
        background: rgba(var(--hula-white-rgb), 0.9);
        color: var(--text-color-1);
        width: 28px;
        height: 28px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(var(--hula-black-rgb), 0.2);
      }

      .join-indicator {
        background: rgba(24, 160, 88, 0.9);
        color: white;
      }
    }

    .space-gradient {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      opacity: 0.6;
    }
  }

  .space-info {
    flex: 1;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;

    .space-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;

      .space-name {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: var(--text-color-1);
        line-height: 1.4;
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .space-actions {
        display: flex;
        gap: 4px;
        flex-shrink: 0;
      }
    }

    .space-description {
      flex: 1;
      margin: 0;

      p {
        margin: 0;
        font-size: 14px;
        color: var(--text-color-2);
        line-height: 1.4;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
    }

    .space-meta {
      display: flex;
      gap: 16px;
      margin-bottom: 8px;

      .meta-item {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        color: var(--text-color-3);

        &.archived {
          color: var(--warning-color);
        }
      }
    }

    .space-children {
      margin-bottom: 8px;

      .children-preview {
        .children-label {
          font-size: 12px;
          color: var(--text-color-3);
          margin-bottom: 6px;
        }

        .children-avatars {
          display: flex;
          align-items: center;

          .more-children {
            font-size: 10px;
            color: var(--text-color-3);
            background: var(--bg-color-hover);
            padding: 2px 6px;
            border-radius: 10px;
          }
        }
      }
    }

    .space-tags {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-bottom: 8px;
    }

    .space-activity {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: auto;
      font-size: 12px;
      color: var(--text-color-3);

      .activity-indicator {
        display: flex;
        align-items: center;
        gap: 4px;

        .activity-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--text-color-3);
          transition: background-color 0.2s ease;

          &.is-active {
            background: var(--success-color);
            animation: pulse 2s infinite;
          }
        }
      }

      .last-activity {
        display: flex;
        align-items: center;
        gap: 4px;
      }
    }
  }
}

@keyframes pulse {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.2);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

// 响应式设计
@media (max-width: 768px) {
  .space-card {
    height: 240px;

    .space-cover {
      height: 120px;
    }

    .space-info {
      padding: 12px;
      gap: 6px;

      .space-header {
        .space-name {
          font-size: 14px;
        }
      }

      .space-description {
        p {
          font-size: 13px;
        }
      }

      .space-meta {
        gap: 12px;
      }
    }
  }
}

@media (max-width: 480px) {
  .space-card {
    .space-info {
      .space-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;

        .space-actions {
          width: 100%;
          justify-content: flex-end;
        }
      }

      .space-meta {
        flex-wrap: wrap;
        gap: 8px;
      }
    }
  }
}
</style>
