<template>
  <div class="friend-stats">
    <!-- 头部 -->
    <div class="stats-header">
      <h3 class="stats-title">
        <svg class="size-18px">
          <use href="#chart"></use>
        </svg>
        {{ t('friends.stats.title') }}
      </h3>
      <n-button text size="small" @click="handleRefresh" :loading="isLoading">
        <svg class="size-16px">
          <use href="#refresh"></use>
        </svg>
      </n-button>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-content">
      <!-- 加载状态 -->
      <div v-if="isLoading && !stats" class="loading-state">
        <n-spin size="medium" />
      </div>

      <!-- 统计卡片网格 -->
      <div v-else class="stats-grid">
        <!-- 总好友数 -->
        <div class="stat-card">
          <div class="stat-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)">
            <svg class="size-24px text-white">
              <use href="#users"></use>
            </svg>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ totalFriendsCount }}</div>
            <div class="stat-label">{{ t('friends.stats.total_friends') }}</div>
          </div>
        </div>

        <!-- 在线好友 -->
        <div class="stat-card">
          <div class="stat-icon" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%)">
            <svg class="size-24px text-white">
              <use href="#circle"></use>
            </svg>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ onlineFriendsCount }}</div>
            <div class="stat-label">{{ t('friends.stats.online_friends') }}</div>
          </div>
        </div>

        <!-- 待处理请求 -->
        <div class="stat-card">
          <div class="stat-icon" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)">
            <svg class="size-24px text-white">
              <use href="#user-add"></use>
            </svg>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ pendingCount }}</div>
            <div class="stat-label">{{ t('friends.stats.pending_requests') }}</div>
          </div>
        </div>

        <!-- 黑名单 -->
        <div class="stat-card">
          <div class="stat-icon" style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%)">
            <svg class="size-24px text-white">
              <use href="#block"></use>
            </svg>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ blockedCount }}</div>
            <div class="stat-label">{{ t('friends.stats.blocked_users') }}</div>
          </div>
        </div>
      </div>

      <!-- 详细统计（如果有） -->
      <div v-if="stats" class="stats-detail">
        <n-divider style="margin: 12px 0" />
        <div class="detail-grid">
          <!-- 分组数量 -->
          <div class="detail-item">
            <span class="detail-label">{{ t('friends.stats.categories') }}</span>
            <span class="detail-value">{{ categories.length }}</span>
          </div>

          <!-- 待处理请求 -->
          <div class="detail-item">
            <span class="detail-label">{{ t('friends.stats.pending_requests') }}</span>
            <span class="detail-value">{{ stats.pending_requests }}</span>
          </div>

          <!-- 黑名单 -->
          <div class="detail-item">
            <span class="detail-label">{{ t('friends.stats.blocked_users') }}</span>
            <span class="detail-value">{{ stats.blocked_count }}</span>
          </div>

          <!-- 好友总数 -->
          <div class="detail-item">
            <span class="detail-label">{{ t('friends.stats.total_friends') }}</span>
            <span class="detail-value">{{ stats.total_friends }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFriendsSDKStore } from '@/stores/friendsSDK'
import { msg } from '@/utils/SafeUI'
import { logger } from '@/utils/logger'

const { t } = useI18n()
const friendsStore = useFriendsSDKStore()

const isLoading = ref(false)

// 统计数据
const stats = computed(() => friendsStore.stats)
const totalFriendsCount = computed(() => friendsStore.totalFriendsCount)
const onlineFriendsCount = computed(() => friendsStore.onlineFriendsCount)
const pendingCount = computed(() => friendsStore.pendingCount)
const blockedCount = computed(() => friendsStore.blockedCount)
const categories = computed(() => friendsStore.categories)

// 刷新统计数据
const handleRefresh = async () => {
  isLoading.value = true
  try {
    await Promise.all([friendsStore.fetchStats(), friendsStore.fetchFriends()])
    msg.success(t('friends.stats.refreshed'))
  } catch (error) {
    msg.error(t('friends.stats.refresh_failed'))
    logger.error('[FriendStats] Failed to refresh stats:', error)
  } finally {
    isLoading.value = false
  }
}

// 组件挂载时加载统计
onMounted(async () => {
  if (!friendsStore.initialized) {
    await friendsStore.initialize()
  }
  if (!stats.value) {
    await friendsStore.fetchStats()
  }
})
</script>

<style scoped lang="scss">
.friend-stats {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--right-chat-footer-bg);
  border-radius: 8px;
  overflow: hidden;
}

.stats-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--line-color);
  background: var(--bg-color);
}

.stats-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
  margin: 0;
}

.stats-content {
  flex: 1;
  padding: 12px;
  overflow-y: auto;
}

.loading-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  min-height: 200px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--bg-color);
  border-radius: 12px;
  border: 1px solid var(--line-color);
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    border-color: var(--hula-primary);
  }
}

.stat-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  flex-shrink: 0;
}

.stat-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-color);
  line-height: 1;
}

.stat-label {
  font-size: 12px;
  color: #909090;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stats-detail {
  margin-top: 12px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--bg-color);
  border-radius: 8px;
}

.detail-label {
  font-size: 12px;
  color: #909090;
}

.detail-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
}
</style>
