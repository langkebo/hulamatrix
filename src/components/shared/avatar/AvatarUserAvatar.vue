/** * UserAvatar - 统一的头像组件 * 支持PC和移动端，在线状态显示，未读消息数徽章 * 使用public/avatar/目录下的默认头像 */
<template>
  <div class="user-avatar" :class="[sizeClass, { 'with-status': showStatus }]">
    <!-- 头像图片 -->
    <img :src="displayAvatarUrl" :alt="displayName || 'User'" class="avatar-image" @error="handleImageError" />

    <!-- 在线状态指示器 -->
    <div v-if="showStatus && status" class="status-indicator" :class="statusClass">
      <span v-if="status === 'online'" class="pulse"></span>
    </div>

    <!-- 未读消息数徽章 -->
    <div v-if="unreadCount > 0" class="unread-badge" :class="badgeSizeClass">
      {{ unreadCount > 99 ? '99+' : unreadCount }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

/**
 * 用户状态类型
 */
export type UserStatus = 'online' | 'offline' | 'away' | 'busy' | 'invisible'

/**
 * 头像尺寸类型
 */
export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'

/**
 * Props定义
 */
interface Props {
  /** 用户ID */
  userId: string
  /** 显示名称 */
  displayName?: string
  /** 头像URL */
  avatarUrl?: string
  /** 头像尺寸 */
  size?: AvatarSize
  /** 是否显示在线状态 */
  showStatus?: boolean
  /** 用户状态 */
  status?: UserStatus
  /** 未读消息数 */
  unreadCount?: number
  /** 点击事件 */
  onClick?: () => void
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  showStatus: true,
  status: 'offline',
  unreadCount: 0
})

/**
 * 图片加载错误处理
 */
const imageError = ref(false)

const handleImageError = () => {
  imageError.value = true
}

/**
 * 计算显示的头像URL
 * 如果没有提供头像URL或加载失败，使用默认头像
 */
const displayAvatarUrl = computed(() => {
  // 如果提供了自定义头像且未出错，使用自定义头像
  if (props.avatarUrl && !imageError.value) {
    return props.avatarUrl
  }

  // 否则使用默认头像
  return getDefaultAvatarUrl(props.userId)
})

/**
 * 根据用户ID生成默认头像URL
 * 使用public/avatar/目录下的头像资源
 */
function getDefaultAvatarUrl(userId: string): string {
  // 简单的哈希函数，确保相同用户ID总是映射到同一头像
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i)
    hash = hash & hash // Convert to 32bit integer
  }

  // 使用绝对值的哈希来选择头像（1-23）
  const index = (Math.abs(hash) % 23) + 1
  const paddedIndex = index.toString().padStart(3, '0')

  return `/avatar/${paddedIndex}.webp`
}

/**
 * 尺寸类名映射
 */
const sizeClass = computed(() => `avatar-${props.size}`)

/**
 * 状态类名映射
 */
const statusClass = computed(() => `status-${props.status}`)

/**
 * 徽章尺寸类名
 */
const badgeSizeClass = computed(() => {
  if (props.size === 'xs' || props.size === 'sm') return 'badge-sm'
  if (props.size === 'lg' || props.size === 'xl' || props.size === '2xl') return 'badge-lg'
  return 'badge-md'
})

// 暴露方法供父组件调用
defineExpose({
  resetError: () => {
    imageError.value = false
  }
})
</script>

<style scoped>
/* ==========================================================================
   基础样式
   ========================================================================== */
.user-avatar {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  overflow: hidden;
  background: var(--pc-bg-elevated);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
  cursor: pointer;
}

.user-avatar:hover {
  transform: scale(1.05);
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* ==========================================================================
   响应式尺寸
   ========================================================================== */
.avatar-xs {
  width: 24px;
  height: 24px;
}
.avatar-sm {
  width: 32px;
  height: 32px;
}
.avatar-md {
  width: 40px;
  height: 40px;
}
.avatar-lg {
  width: 48px;
  height: 48px;
}
.avatar-xl {
  width: 64px;
  height: 64px;
}
.avatar-2xl {
  width: 96px;
  height: 96px;
}

/* ==========================================================================
   PC端样式 (深色主题)
   ========================================================================== */
@media (min-width: 769px) {
  .user-avatar {
    border: 2px solid var(--pc-accent-subtle);
    box-shadow: var(--shadow-dark-sm);
  }

  .user-avatar:hover {
    box-shadow: var(--shadow-dark-md);
  }
}

/* ==========================================================================
   移动端样式 (浅色主题)
   ========================================================================== */
@media (max-width: 768px) {
  .user-avatar {
    border: 2px solid var(--mobile-bg-secondary);
    box-shadow: var(--shadow-light-sm);
  }
}

/* ==========================================================================
   在线状态指示器
   ========================================================================== */
.status-indicator {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--pc-bg-elevated);
  z-index: 1;
}

/* PC端状态指示器 */
@media (min-width: 769px) {
  .status-indicator {
    border-color: var(--pc-bg-elevated);
  }

  .status-online {
    background: var(--pc-success);
  }
  .status-away {
    background: var(--pc-warning);
  }
  .status-busy {
    background: var(--pc-error);
  }
  .status-offline {
    background: var(--pc-text-tertiary);
  }
  .status-invisible {
    background: transparent;
  }
}

/* 移动端状态指示器 */
@media (max-width: 768px) {
  .status-indicator {
    border-color: var(--mobile-bg-secondary);
  }

  .status-online {
    background: var(--mobile-success);
  }
  .status-away {
    background: var(--mobile-warning);
  }
  .status-busy {
    background: var(--mobile-error);
  }
  .status-offline {
    background: var(--mobile-text-tertiary);
  }
  .status-invisible {
    background: transparent;
  }
}

/* ==========================================================================
   脉冲动画 (在线状态)
   ========================================================================== */
.pulse {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0% {
    transform: scale(1);
    opacity: 0.8;
  }
  50% {
    transform: scale(1.5);
    opacity: 0.5;
  }
  100% {
    transform: scale(2);
    opacity: 0;
  }
}

/* ==========================================================================
   未读消息徽章
   ========================================================================== */
.unread-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--pc-error);
  color: white;
  border-radius: var(--radius-full);
  font-weight: var(--font-semibold);
  z-index: 2;
  box-shadow: 0 2px 4px rgba(var(--hula-black-rgb), 0.2);
}

.badge-sm {
  min-width: 16px;
  height: 16px;
  font-size: 10px;
  padding: 0 4px;
}

.badge-md {
  min-width: 20px;
  height: 20px;
  font-size: 12px;
  padding: 0 6px;
}

.badge-lg {
  min-width: 24px;
  height: 24px;
  font-size: 14px;
  padding: 0 8px;
}

/* 移动端徽章样式 */
@media (max-width: 768px) {
  .unread-badge {
    background: var(--mobile-error);
  }
}

/* ==========================================================================
   群组头像变体 (多个头像重叠显示)
   ========================================================================== */
.user-avatar.avatar-group {
  margin-left: -8px;
  border: 2px solid var(--pc-bg-elevated);
}

.user-avatar.avatar-group:first-child {
  margin-left: 0;
}
</style>
