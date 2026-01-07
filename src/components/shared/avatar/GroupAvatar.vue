/** * GroupAvatar - 群组头像组件 * 显示多个用户头像的堆叠效果 */
<template>
  <div class="group-avatar" :class="[sizeClass]">
    <UserAvatar
      v-for="(user, index) in visibleUsers"
      :key="user.userId"
      :user-id="user.userId"
      :display-name="user.displayName"
      :avatar-url="user.avatarUrl"
      :size="avatarSize"
      class="avatar-item"
      :style="{ zIndex: 10 - index }" />

    <!-- 更多用户指示器 -->
    <div v-if="remainingCount > 0" class="more-indicator" :style="{ zIndex: 0 }">+{{ remainingCount }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { type AvatarSize, type UserStatus } from './UserAvatar.vue'

/**
 * 群组成员信息
 */
interface GroupMember {
  userId: string
  displayName?: string
  avatarUrl?: string
  status?: UserStatus
}

/**
 * Props定义
 */
interface Props {
  /** 群组成员列表 */
  members: GroupMember[]
  /** 组件尺寸 */
  size?: AvatarSize
  /** 最多显示的头像数量 */
  maxVisible?: number
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  maxVisible: 3
})

/**
 * 计算可见用户
 */
const visibleUsers = computed(() => {
  return props.members.slice(0, props.maxVisible)
})

/**
 * 计算剩余用户数量
 */
const remainingCount = computed(() => {
  return Math.max(0, props.members.length - props.maxVisible)
})

/**
 * 尺寸映射 (群组头像使用稍小尺寸)
 */
const avatarSize = computed(() => {
  const sizeMap: Record<AvatarSize, AvatarSize> = {
    '2xl': 'xl',
    xl: 'lg',
    lg: 'md',
    md: 'sm',
    sm: 'xs',
    xs: 'xs'
  }
  return sizeMap[props.size] || 'sm'
})

/**
 * 尺寸类名
 */
const sizeClass = computed(() => `group-avatar-${props.size}`)
</script>

<style scoped>
.group-avatar {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.avatar-item {
  margin-left: -8px;
  border: 2px solid var(--pc-bg-elevated);
  box-shadow: var(--shadow-dark-sm);
}

.avatar-item:first-child {
  margin-left: 0;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .avatar-item {
    border-color: var(--mobile-bg-secondary);
    box-shadow: var(--shadow-light-sm);
  }
}

/* 更多用户指示器 */
.more-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: -8px;
  border: 2px solid var(--pc-bg-elevated);
  border-radius: var(--radius-full);
  background: var(--pc-accent-primary);
  color: white;
  font-weight: var(--font-semibold);
  box-shadow: var(--shadow-dark-sm);
}

/* 响应式尺寸 */
.group-avatar-xs .more-indicator {
  width: 24px;
  height: 24px;
  font-size: 10px;
}
.group-avatar-sm .more-indicator {
  width: 32px;
  height: 32px;
  font-size: 12px;
}
.group-avatar-md .more-indicator {
  width: 40px;
  height: 40px;
  font-size: 14px;
}
.group-avatar-lg .more-indicator {
  width: 48px;
  height: 48px;
  font-size: 16px;
}
.group-avatar-xl .more-indicator {
  width: 64px;
  height: 64px;
  font-size: 18px;
}
.group-avatar-2xl .more-indicator {
  width: 96px;
  height: 96px;
  font-size: 24px;
}

/* 移动端更多指示器 */
@media (max-width: 768px) {
  .more-indicator {
    border-color: var(--mobile-bg-secondary);
    background: var(--mobile-accent-primary);
  }
}
</style>
