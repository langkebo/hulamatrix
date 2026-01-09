<template>
  <div class="friend-requests-panel">
    <!-- 头部 -->
    <div class="panel-header">
      <h3 class="panel-title">
        <svg class="size-18px">
          <use href="#user-add"></use>
        </svg>
        {{ t('friends.requests.title') }}
        <n-badge v-if="pendingCount > 0" :value="pendingCount" :max="99" />
      </h3>
      <n-button text size="small" @click="handleRefresh" :loading="isLoading">
        <svg class="size-16px">
          <use href="#refresh"></use>
        </svg>
      </n-button>
    </div>

    <!-- 内容区域 -->
    <div class="panel-content">
      <!-- 加载状态 -->
      <div v-if="isLoading" class="loading-state">
        <n-spin size="medium" />
      </div>

      <!-- 空状态 -->
      <n-empty
        v-else-if="pendingRequests.length === 0"
        :description="t('friends.requests.no_requests')"
        size="small">
        <template #icon>
          <svg class="size-48px text-var(--hula-brand-primary)">
            <use href="#check-circle"></use>
          </svg>
        </template>
      </n-empty>

      <!-- 请求列表 -->
      <n-scrollbar v-else class="requests-scrollbar">
        <div class="requests-list">
          <div
            v-for="request in pendingRequests"
            :key="request.id"
            class="request-item">
            <!-- 用户头像 -->
            <n-avatar round :size="48" :src="request.requester_avatar_url || ''">
              <svg class="size-24px">
                <use href="#user"></use>
              </svg>
            </n-avatar>

            <!-- 用户信息 -->
            <div class="request-info">
              <div class="request-name">
                {{ request.requester_display_name || request.requester_id }}
              </div>
              <div class="request-message" v-if="request.message">
                {{ request.message }}
              </div>
              <div class="request-time">
                {{ formatRequestTime(request.created_at) }}
              </div>
            </div>

            <!-- 操作按钮 -->
            <div class="request-actions">
              <n-button
                size="small"
                secondary
                type="error"
                @click="handleReject(request)"
                :loading="request.id === processingRequestId">
                <template #icon>
                  <svg class="size-14px">
                    <use href="#close"></use>
                  </svg>
                </template>
                {{ t('friends.requests.reject') }}
              </n-button>
              <n-button
                size="small"
                type="primary"
                @click="handleAccept(request)"
                :loading="request.id === processingRequestId">
                <template #icon>
                  <svg class="size-14px">
                    <use href="#check"></use>
                  </svg>
                </template>
                {{ t('friends.requests.accept') }}
              </n-button>
            </div>
          </div>
        </div>
      </n-scrollbar>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFriendsSDKStore, type FriendRequestWithProfile } from '@/stores/friendsSDK'
import { msg } from '@/utils/SafeUI'
import { logger } from '@/utils/logger'

const { t } = useI18n()
const friendsStore = useFriendsSDKStore()

const isLoading = ref(false)
const processingRequestId = ref<string | null>(null)

// 待处理请求列表
const pendingRequests = computed(() => friendsStore.pendingRequests)
const pendingCount = computed(() => friendsStore.pendingCount)

// 刷新请求列表
const handleRefresh = async () => {
  isLoading.value = true
  try {
    await friendsStore.fetchPendingRequests()
    msg.success(t('friends.requests.refreshed'))
  } catch (error) {
    msg.error(t('friends.requests.refresh_failed'))
    logger.error('[FriendRequestsPanel] Failed to refresh requests:', error)
  } finally {
    isLoading.value = false
  }
}

// 接受好友请求
const handleAccept = async (request: FriendRequestWithProfile) => {
  processingRequestId.value = request.id

  try {
    const result = await friendsStore.acceptFriendRequest(request.id)

    msg.success(
      t('friends.requests.accept_success', {
        name: request.requester_display_name || request.requester_id
      })
    )

    logger.info('[FriendRequestsPanel] Friend request accepted', {
      requestId: request.id,
      requesterId: result.requester_id
    })
  } catch (error) {
    msg.error(t('friends.requests.accept_failed'))
    logger.error('[FriendRequestsPanel] Failed to accept request:', error)
  } finally {
    processingRequestId.value = null
  }
}

// 拒绝好友请求
const handleReject = async (request: FriendRequestWithProfile) => {
  processingRequestId.value = request.id

  try {
    await friendsStore.rejectFriendRequest(request.id)

    msg.success(
      t('friends.requests.reject_success', {
        name: request.requester_display_name || request.requester_id
      })
    )

    logger.info('[FriendRequestsPanel] Friend request rejected', {
      requestId: request.id
    })
  } catch (error) {
    msg.error(t('friends.requests.reject_failed'))
    logger.error('[FriendRequestsPanel] Failed to reject request:', error)
  } finally {
    processingRequestId.value = null
  }
}

// 格式化请求时间
const formatRequestTime = (isoString?: string): string => {
  if (!isoString) return ''

  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return t('friends.time.just_now')
  if (diffMins < 60) return t('friends.time.minutes_ago', { minutes: diffMins })
  if (diffHours < 24) return t('friends.time.hours_ago', { hours: diffHours })
  if (diffDays < 7) return t('friends.time.days_ago', { days: diffDays })

  // 显示具体日期
  const month = date.getMonth() + 1
  const day = date.getDate()
  return `${month}/${day}`
}

// 组件挂载时加载请求
onMounted(async () => {
  if (!friendsStore.initialized) {
    await friendsStore.initialize()
  }
  if (pendingRequests.value.length === 0) {
    await friendsStore.fetchPendingRequests()
  }
})
</script>

<style scoped lang="scss">
.friend-requests-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--right-chat-footer-bg);
  border-radius: 8px;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--line-color);
  background: var(--bg-color);
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
  margin: 0;
}

.panel-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.loading-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  min-height: 200px;
}

.requests-scrollbar {
  height: 100%;
}

.requests-list {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.request-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--bg-color);
  border-radius: 8px;
  border: 1px solid var(--line-color);
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--hula-primary);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }
}

.request-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.request-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.request-message {
  font-size: 12px;
  color: var(--hula-brand-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.request-time {
  font-size: 11px;
  color: var(--hula-brand-primary);
}

.request-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
</style>
