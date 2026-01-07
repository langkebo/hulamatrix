/** * OnlineStatus - 在线状态指示器组件 * 使用 public/status/ 目录下的状态图标 */
<template>
  <div class="online-status" :class="[variant, sizeClass, statusClass]">
    <!-- 点状指示器 -->
    <div v-if="variant === 'dot'" class="status-dot"></div>

    <!-- 文字指示器 -->
    <span v-if="variant === 'text'" class="status-text">{{ statusText }}</span>

    <!-- 徽章指示器 -->
    <div v-if="variant === 'badge'" class="status-badge">
      <span v-if="showPulse" class="pulse"></span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

/**
 * 用户状态
 */
export type UserStatus = 'online' | 'offline' | 'away' | 'busy' | 'invisible'

/**
 * 自定义状态类型
 */
export type CustomStatus = 'working' | 'studying' | 'gaming' | 'meeting' | 'vacation'

/**
 * 指示器变体
 */
export type StatusVariant = 'dot' | 'text' | 'badge'

/**
 * 指示器尺寸
 */
export type StatusSize = 'sm' | 'md' | 'lg'

/**
 * Props定义
 */
interface Props {
  /** 用户状态 */
  status?: UserStatus | CustomStatus
  /** 指示器变体 */
  variant?: StatusVariant
  /** 指示器尺寸 */
  size?: StatusSize
  /** 是否显示脉冲动画 */
  showPulse?: boolean
  /** 自定义状态文本 */
  customText?: string
}

const props = withDefaults(defineProps<Props>(), {
  status: 'offline',
  variant: 'dot',
  size: 'md',
  showPulse: true
})

/**
 * 状态文本映射
 */
const statusTextMap: Record<UserStatus | CustomStatus, string> = {
  online: '在线',
  offline: '离线',
  away: '离开',
  busy: '忙碌',
  invisible: '隐身',
  working: '工作中',
  studying: '学习中',
  gaming: '游戏中',
  meeting: '会议中',
  vacation: '度假中'
}

/**
 * 计算状态文本
 */
const statusText = computed(() => {
  if (props.customText) return props.customText
  return statusTextMap[props.status] || '未知'
})

/**
 * 状态类名
 */
const statusClass = computed(() => `status-${props.status}`)

/**
 * 尺寸类名
 */
const sizeClass = computed(() => `size-${props.size}`)
</script>

<style scoped>
/* ==========================================================================
   基础样式
   ========================================================================== */
.online-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* ==========================================================================
   点状指示器
   ========================================================================== */
.status-dot {
  border-radius: 50%;
  position: relative;
}

.size-sm .status-dot {
  width: 8px;
  height: 8px;
}

.size-md .status-dot {
  width: 12px;
  height: 12px;
}

.size-lg .status-dot {
  width: 16px;
  height: 16px;
}

/* PC端状态颜色 */
@media (min-width: 769px) {
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

  /* 自定义状态 */
  .status-working {
    background: #4a90e2;
  }
  .status-studying {
    background: #9b59b6;
  }
  .status-gaming {
    background: #e74c3c;
  }
  .status-meeting {
    background: #f39c12;
  }
  .status-vacation {
    background: #2ecc71;
  }
}

/* 移动端状态颜色 */
@media (max-width: 768px) {
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

  /* 自定义状态 */
  .status-working {
    background: #4a90e2;
  }
  .status-studying {
    background: #9b59b6;
  }
  .status-gaming {
    background: #e74c3c;
  }
  .status-meeting {
    background: #f39c12;
  }
  .status-vacation {
    background: #2ecc71;
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
  animation: statusPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes statusPulse {
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
   文字指示器
   ========================================================================== */
.status-text {
  font-size: var(--font-sm);
  font-weight: var(--font-medium);
}

.size-sm .status-text {
  font-size: var(--font-xs);
}

.size-lg .status-text {
  font-size: var(--font-md);
}

/* PC端文字颜色 */
@media (min-width: 769px) {
  .status-text {
    color: var(--pc-text-secondary);
  }
}

/* 移动端文字颜色 */
@media (max-width: 768px) {
  .status-text {
    color: var(--mobile-text-secondary);
  }
}

/* ==========================================================================
   徽章指示器
   ========================================================================== */
.status-badge {
  position: relative;
  width: 100%;
  height: 100%;
  border: 2px solid transparent;
  border-radius: 50%;
}

.size-md .status-badge {
  border-width: 2px;
}

.size-lg .status-badge {
  border-width: 3px;
}

/* PC端徽章边框 */
@media (min-width: 769px) {
  .status-online .status-badge {
    border-color: var(--pc-success);
  }
  .status-away .status-badge {
    border-color: var(--pc-warning);
  }
  .status-busy .status-badge {
    border-color: var(--pc-error);
  }
  .status-offline .status-badge {
    border-color: var(--pc-text-tertiary);
  }
}

/* 移动端徽章边框 */
@media (max-width: 768px) {
  .status-online .status-badge {
    border-color: var(--mobile-success);
  }
  .status-away .status-badge {
    border-color: var(--mobile-warning);
  }
  .status-busy .status-badge {
    border-color: var(--mobile-error);
  }
  .status-offline .status-badge {
    border-color: var(--mobile-text-tertiary);
  }
}
</style>
