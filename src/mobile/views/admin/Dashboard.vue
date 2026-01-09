<template>
  <div class="mobile-admin-dashboard">
    <!-- Header -->
    <van-nav-bar :title="t('admin.dashboard.title')" left-arrow @click-left="handleBack">
      <template #right>
        <van-icon name="replay" @click="handleRefresh" />
      </template>
    </van-nav-bar>

    <!-- Stats Grid -->
    <van-grid :column-num="2" :border="false" class="stats-grid">
      <van-grid-item>
        <div class="stat-item">
          <van-icon name="friends" size="32" color="var(--hula-success)" />
          <div class="stat-value">{{ stats.totalUsers }}</div>
          <div class="stat-label">{{ t('admin.stats.total_users') }}</div>
        </div>
      </van-grid-item>

      <van-grid-item>
        <div class="stat-item">
          <van-icon name="user" size="32" color="#1989fa" />
          <div class="stat-value">{{ stats.activeUsers }}</div>
          <div class="stat-label">{{ t('admin.stats.active_users') }}</div>
        </div>
      </van-grid-item>

      <van-grid-item>
        <div class="stat-item">
          <van-icon name="chat" size="32" color="#ff976a" />
          <div class="stat-value">{{ stats.totalRooms }}</div>
          <div class="stat-label">{{ t('admin.stats.total_rooms') }}</div>
        </div>
      </van-grid-item>

      <van-grid-item>
        <div class="stat-item">
          <van-icon name="folder" size="32" color="#ee0a24" />
          <div class="stat-value">{{ formatBytes(stats.mediaStorage) }}</div>
          <div class="stat-label">{{ t('admin.stats.media_storage') }}</div>
        </div>
      </van-grid-item>
    </van-grid>

    <!-- Quick Actions -->
    <van-cell-group :title="t('admin.quick_actions')" inset>
      <van-cell :title="t('admin.manage_users')" is-link @click="handleManageUsers">
        <template #icon>
          <van-icon name="friends-o" />
        </template>
      </van-cell>

      <van-cell :title="t('admin.manage_rooms')" is-link @click="handleManageRooms">
        <template #icon>
          <van-icon name="chat-o" />
        </template>
      </van-cell>

      <van-cell :title="t('admin.manage_media')" is-link @click="handleManageMedia">
        <template #icon>
          <van-icon name="folder-o" />
        </template>
      </van-cell>
    </van-cell-group>

    <!-- Recent Activity -->
    <van-cell-group :title="t('admin.recent_activity')" inset>
      <van-cell
        v-for="activity in recentActivities"
        :key="activity.id"
        :title="activity.title"
        :value="formatTime(activity.timestamp)">
        <template #icon>
          <van-icon :name="activity.icon" :color="activity.color" />
        </template>
      </van-cell>
    </van-cell-group>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { showToast, showLoadingToast, closeToast } from 'vant'
import {
  NavBar as VanNavBar,
  Icon as VanIcon,
  Grid as VanGrid,
  GridItem as VanGridItem,
  CellGroup as VanCellGroup,
  Cell as VanCell
} from 'vant'
import { logger } from '@/utils/logger'

const { t } = useI18n()
const router = useRouter()

const stats = ref({
  totalUsers: 1234,
  activeUsers: 567,
  totalRooms: 89,
  mediaStorage: 5368709120
})

const recentActivities = ref([
  {
    id: 1,
    title: 'User registered: @alice:example.com',
    timestamp: Date.now() - 300000,
    icon: 'add',
    color: 'var(--hula-success)'
  },
  {
    id: 2,
    title: 'Room created: #general',
    timestamp: Date.now() - 600000,
    icon: 'chat',
    color: '#1989fa'
  },
  {
    id: 3,
    title: 'Media cache purged: 1.2GB freed',
    timestamp: Date.now() - 3600000,
    icon: 'delete',
    color: '#ff976a'
  }
])

onMounted(async () => {
  await loadStats()
})

async function loadStats() {
  try {
    // Load server statistics
    // In a real implementation, this would call adminClient.getServerStats()
    // For now, using mock data matching the PC dashboard
    stats.value = {
      totalUsers: 1234,
      activeUsers: 567,
      totalRooms: 89,
      mediaStorage: 5368709120 // 5GB
    }
  } catch (error) {
    logger.error('[MobileAdminDashboard] Failed to load stats:', error)
    showToast.fail(t('admin.error.load_stats_failed'))
  }
}

function handleBack() {
  router.back()
}

async function handleRefresh() {
  showLoadingToast({
    message: t('admin.refreshing'),
    forbidClick: true,
    duration: 0
  })
  await loadStats()
  closeToast()
  showToast.success(t('admin.refreshed'))
}

function handleManageUsers() {
  router.push('/mobile/admin/users')
}

function handleManageRooms() {
  router.push('/mobile/admin/rooms')
}

function handleManageMedia() {
  router.push('/mobile/admin/media')
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(1)}${units[unitIndex]}`
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
.mobile-admin-dashboard {
  min-height: 100vh;
  background: var(--van-gray-1);

  .stats-grid {
    padding: 16px;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px;

    .stat-value {
      font-size: 24px;
      font-weight: 600;
      margin: 8px 0;
    }

    .stat-label {
      font-size: 12px;
      color: var(--van-text-color-3);
    }
  }

  :deep(.van-cell-group) {
    margin-bottom: 12px;
  }
}
</style>
