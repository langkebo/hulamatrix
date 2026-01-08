<template>
  <div class="admin-dashboard">
    <n-page-header :title="t('admin.dashboard.title')" @back="handleBack">
      <template #extra>
        <n-space>
          <n-button @click="handleRefresh">
            <template #icon>
              <n-icon><Refresh /></n-icon>
            </template>
            {{ t('admin.refresh') }}
          </n-button>
        </n-space>
      </template>
    </n-page-header>

    <!-- Server Stats -->
    <n-grid :cols="4" :x-gap="16" :y-gap="16" responsive="screen">
      <n-gi>
        <n-card :bordered="false" class="stat-card">
          <n-statistic :label="t('admin.stats.total_users')" :value="stats.totalUsers">
            <template #prefix>
              <n-icon size="24" color="#18a058"><Users /></n-icon>
            </template>
          </n-statistic>
        </n-card>
      </n-gi>

      <n-gi>
        <n-card :bordered="false" class="stat-card">
          <n-statistic :label="t('admin.stats.active_users')" :value="stats.activeUsers">
            <template #prefix>
              <n-icon size="24" color="#2080f0"><User /></n-icon>
            </template>
          </n-statistic>
        </n-card>
      </n-gi>

      <n-gi>
        <n-card :bordered="false" class="stat-card">
          <n-statistic :label="t('admin.stats.total_rooms')" :value="stats.totalRooms">
            <template #prefix>
              <n-icon size="24" color="#f0a020"><Home /></n-icon>
            </template>
          </n-statistic>
        </n-card>
      </n-gi>

      <n-gi>
        <n-card :bordered="false" class="stat-card">
          <n-statistic :label="t('admin.stats.media_storage')" :value="formatBytes(stats.mediaStorage)">
            <template #prefix>
              <n-icon size="24" color="var(--hula-error, #d03050)"><Database /></n-icon>
            </template>
          </n-statistic>
        </n-card>
      </n-gi>
    </n-grid>

    <!-- Quick Actions -->
    <n-card :title="t('admin.quick_actions')" :bordered="false" class="card-spacing">
      <n-space>
        <n-button type="primary" @click="handleManageUsers">
          <template #icon>
            <n-icon><Users /></n-icon>
          </template>
          {{ t('admin.manage_users') }}
        </n-button>

        <n-button type="primary" @click="handleManageRooms">
          <template #icon>
            <n-icon><Home /></n-icon>
          </template>
          {{ t('admin.manage_rooms') }}
        </n-button>

        <n-button type="primary" @click="handleManageMedia">
          <template #icon>
            <n-icon><Database /></n-icon>
          </template>
          {{ t('admin.manage_media') }}
        </n-button>
      </n-space>
    </n-card>

    <!-- Recent Activity -->
    <n-card :title="t('admin.recent_activity')" :bordered="false" class="card-spacing">
      <n-timeline>
        <n-timeline-item
          v-for="activity in recentActivities"
          :key="activity.id"
          :type="activity.type"
          :title="activity.title"
          :time="formatTime(activity.timestamp)" />
      </n-timeline>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  NPageHeader,
  NIcon,
  NSpace,
  NButton,
  NGrid,
  NGi,
  NCard,
  NStatistic,
  NTimeline,
  NTimelineItem,
  useMessage
} from 'naive-ui'
import { Refresh, Users, User, Home, Database } from '@vicons/tabler'
import { adminClient } from '@/services/adminClient'
import { logger } from '@/utils/logger'

const { t } = useI18n()
const router = useRouter()
const message = useMessage()

const stats = ref({
  totalUsers: 0,
  activeUsers: 0,
  totalRooms: 0,
  mediaStorage: 0
})

const recentActivities = ref([
  {
    id: 1,
    type: 'success' as const,
    title: 'User registered: @alice:example.com',
    timestamp: Date.now() - 300000
  },
  {
    id: 2,
    type: 'info' as const,
    title: 'Room created: #general',
    timestamp: Date.now() - 600000
  },
  {
    id: 3,
    type: 'warning' as const,
    title: 'Media cache purged: 1.2GB freed',
    timestamp: Date.now() - 3600000
  }
])

onMounted(async () => {
  await loadStats()
})

async function loadStats() {
  try {
    // Load server statistics
    // In a real implementation, this would call adminClient.getServerStats()
    stats.value = {
      totalUsers: 1234,
      activeUsers: 567,
      totalRooms: 89,
      mediaStorage: 5368709120 // 5GB
    }
  } catch (error) {
    logger.error('[AdminDashboard] Failed to load stats:', error)
    message.error(t('admin.error.load_stats_failed'))
  }
}

function handleBack() {
  router.back()
}

async function handleRefresh() {
  message.loading(t('admin.refreshing'))
  await loadStats()
  message.success(t('admin.refreshed'))
}

function handleManageUsers() {
  router.push('/admin/users')
}

function handleManageRooms() {
  router.push('/admin/rooms')
}

function handleManageMedia() {
  router.push('/admin/media')
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`
}

function formatTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  if (diff < 60000) return t('admin.time.just_now')
  if (diff < 3600000) return t('admin.time.minutes_ago', { minutes: Math.floor(diff / 60000) })
  if (diff < 86400000) return t('admin.time.hours_ago', { hours: Math.floor(diff / 3600000) })
  return new Date(timestamp).toLocaleDateString()
}
</script>

<style lang="scss" scoped>
.admin-dashboard {
  padding: 24px;

  .stat-card {
    :deep(.n-statistic__label) {
      font-size: 13px;
      color: var(--text-color-3);
    }

    :deep(.n-statistic__value) {
      font-size: 28px;
      font-weight: 600;
    }
  }

  .card-spacing {
    margin-top: 16px;
  }
}
</style>
