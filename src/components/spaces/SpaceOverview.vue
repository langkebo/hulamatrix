<template>
  <div class="space-overview">
    <!-- 空间统计 -->
    <div class="stats-section">
      <h3>空间统计</h3>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">{{ space.memberCount || 0 }}</div>
          <div class="stat-label">总成员</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ space.roomCount || 0 }}</div>
          <div class="stat-label">房间数</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ space.notifications?.notificationCount || 0 }}</div>
          <div class="stat-label">未读消息</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ activeMembersCount }}</div>
          <div class="stat-label">活跃成员</div>
        </div>
      </div>
    </div>

    <!-- 空间描述 -->
    <div v-if="space.description" class="description-section">
      <h3>空间描述</h3>
      <div class="description-content">
        <p>{{ space.description }}</p>
      </div>
    </div>

    <!-- 空间标签 -->
    <div v-if="space.tags && space.tags.length > 0" class="tags-section">
      <h3>标签</h3>
      <div class="tags-content">
        <n-tag v-for="tag in space.tags" :key="tag" type="info" size="small">
          {{ tag }}
        </n-tag>
      </div>
    </div>

    <!-- 最近活动 -->
    <div class="activity-section">
      <h3>最近活动</h3>
      <div v-if="activities.length > 0" class="activity-list">
        <div v-for="activity in activities" :key="activity.id" class="activity-item">
          <div class="activity-icon">
            <n-icon size="20">
              <component :is="getActivityIcon(activity.type)" />
            </n-icon>
          </div>
          <div class="activity-content">
            <div class="activity-description">{{ activity.description }}</div>
            <div class="activity-time">{{ formatActivityTime(activity.timestamp) }}</div>
          </div>
        </div>
      </div>
      <n-empty v-else description="暂无活动" size="small" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NTag, NIcon, NEmpty } from 'naive-ui'
import { CirclePlus, UserPlus, Message } from '@vicons/tabler'
import type { SpaceDetailsProps, Activity } from './types'

interface Props {
  space: NonNullable<SpaceDetailsProps['space']>
  activities?: Activity[]
  activeMembersCount?: number
}

const props = withDefaults(defineProps<Props>(), {
  activities: () => [],
  activeMembersCount: 0
})

const formatActivityTime = (timestamp: number): string => {
  const now = Date.now()
  const diff = now - timestamp

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`

  const date = new Date(timestamp)
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric'
  })
}

const getActivityIcon = (type: Activity['type']) => {
  const iconMap = {
    room_created: CirclePlus,
    member_joined: UserPlus,
    message_sent: Message
  }
  return iconMap[type] || Message
}
</script>

<style lang="scss" scoped>
.space-overview {
  padding: 24px;

  h3 {
    margin: 0 0 16px 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-color-1);
  }

  .stats-section {
    margin-bottom: 32px;

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 16px;

      .stat-card {
        padding: 20px;
        background: var(--bg-setting-item);
        border-radius: 12px;
        text-align: center;

        .stat-value {
          font-size: 32px;
          font-weight: 700;
          color: var(--primary-color);
          margin-bottom: 8px;
        }

        .stat-label {
          font-size: 14px;
          color: var(--text-color-2);
        }
      }
    }
  }

  .description-section {
    margin-bottom: 32px;

    .description-content {
      padding: 16px;
      background: var(--bg-setting-item);
      border-radius: 8px;

      p {
        margin: 0;
        line-height: 1.8;
        color: var(--text-color-2);
      }
    }
  }

  .tags-section {
    margin-bottom: 32px;

    .tags-content {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
  }

  .activity-section {
    .activity-list {
      .activity-item {
        display: flex;
        gap: 12px;
        padding: 12px 0;
        border-bottom: 1px solid var(--divider-color);

        &:last-child {
          border-bottom: none;
        }

        .activity-icon {
          flex-shrink: 0;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-setting-item);
          border-radius: 50%;
          color: var(--primary-color);
        }

        .activity-content {
          flex: 1;

          .activity-description {
            font-size: 14px;
            color: var(--text-color-1);
            margin-bottom: 4px;
          }

          .activity-time {
            font-size: 12px;
            color: var(--text-color-3);
          }
        }
      }
    }
  }
}
</style>
