<template>
  <n-flex vertical :size="16" class="block-list-panel">
    <!-- 头部 -->
    <n-flex align="center" justify="space-between" class="header">
      <n-flex align="center" :size="8">
        <svg class="size-18px"><use href="#shield"></use></svg>
        <span class="text-14px font-600">{{ t('friends.block.title') }}</span>
        <n-tag :bordered="false" size="small" type="info">
          {{ blockedCount }}
        </n-tag>
      </n-flex>
      <n-button v-if="blockedUsers.length > 0" size="small" type="error" secondary @click="handleClearAll">
        {{ t('friends.block.clear_all') }}
      </n-button>
    </n-flex>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-container">
      <n-spin size="medium" />
      <span class="text-14px mt-2">{{ t('friends.block.loading') }}</span>
    </div>

    <!-- 空状态 -->
    <n-empty v-else-if="blockedUsers.length === 0" :description="t('friends.block.empty')" size="small">
      <template #icon>
        <svg class="size-48px"><use href="#shield-check"></use></svg>
      </template>
      <template #extra>
        <n-text depth="3">{{ t('friends.block.empty_hint') }}</n-text>
      </template>
    </n-empty>

    <!-- 黑名单列表 -->
    <n-virtual-list v-else :items="blockedUsers" :item-size="80" class="block-list">
      <template #default="{ item: blockedUser }">
        <div class="blocked-user-item">
          <n-flex align="center" :size="12" class="flex-1">
            <n-avatar :size="44" round>
              <svg class="size-22px"><use href="#user"></use></svg>
            </n-avatar>
            <n-flex vertical :size="4" class="user-info">
              <span class="user-name">{{ blockedUser.user_id }}</span>
              <span v-if="blockedUser.blocked_at" class="block-time">
                {{ t('friends.block.since') }} {{ formatTime(blockedUser.blocked_at) }}
              </span>
            </n-flex>
          </n-flex>

          <n-button
            circle
            size="small"
            quaternary
            type="error"
            :aria-label="t('friends.block.unblock_aria')"
            @click="handleUnblock(blockedUser)">
            <template #icon>
              <svg class="size-14px"><use href="#shield-off"></use></svg>
            </template>
          </n-button>
        </div>
      </template>
    </n-virtual-list>

    <!-- 统计信息 -->
    <n-collapse v-if="blockedUsers.length > 0" class="stats-collapse">
      <n-collapse-item :title="t('friends.block.stats_title')" name="stats">
        <n-space :size="16">
          <n-statistic :label="t('friends.block.total')" :value="blockedCount" />
          <n-statistic
            :label="t('friends.block.recent')"
            :value="recentBlockCount"
            :value-style="{ fontSize: '14px', color: 'var(--color-warning)' }" />
        </n-space>
      </n-collapse-item>
    </n-collapse>
  </n-flex>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NFlex,
  NSpace,
  NButton,
  NTag,
  NAvatar,
  NEmpty,
  NVirtualList,
  NCollapse,
  NCollapseItem,
  NStatistic,
  NText,
  NSpin,
  useDialog,
  useMessage
} from 'naive-ui'
import { useFriendsSDKStore } from '@/stores/friendsSDK'
import type { BlockedUser } from '@/stores/friendsSDK'
import { logger } from '@/utils/logger'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

const { t } = useI18n()
const dialog = useDialog()
const message = useMessage()
const friendsStore = useFriendsSDKStore()

// 状态
const loading = ref(false)

// 计算属性
const blockedUsers = computed(() => friendsStore.blockedUsers)
const blockedCount = computed(() => friendsStore.blockedCount)

// 最近 7 天拉黑的数量
const recentBlockCount = computed(() => {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  return blockedUsers.value.filter((u) => {
    if (!u.blocked_at) return false
    return new Date(u.blocked_at).getTime() > weekAgo
  }).length
})

// 格式化时间
const formatTime = (timestamp: string): string => {
  try {
    return formatDistanceToNow(new Date(timestamp), {
      addSuffix: true,
      locale: zhCN
    })
  } catch {
    return timestamp
  }
}

// 解除拉黑
const handleUnblock = (blockedUser: BlockedUser) => {
  dialog.success({
    title: t('friends.block.unblock_confirm_title'),
    content: t('friends.block.unblock_confirm_content', { userId: blockedUser.user_id }),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      try {
        await friendsStore.unblockUser(blockedUser.user_id)
        message.success(t('friends.block.unblock_success'))
        await fetchBlocked()
      } catch (error) {
        message.error(t('friends.block.unblock_failed'))
        logger.error('Failed to unblock user:', error)
      }
    }
  })
}

// 清空黑名单
const handleClearAll = () => {
  dialog.warning({
    title: t('friends.block.clear_all_confirm_title'),
    content: t('friends.block.clear_all_confirm_content', { count: blockedCount.value }),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      try {
        // 逐个解除拉黑
        const promises = blockedUsers.value.map((u) => friendsStore.unblockUser(u.user_id))
        await Promise.all(promises)

        message.success(t('friends.block.clear_all_success', { count: blockedCount.value }))
        await fetchBlocked()
      } catch (error) {
        message.error(t('friends.block.clear_all_failed'))
        logger.error('Failed to clear block list:', error)
      }
    }
  })
}

// 获取黑名单
const fetchBlocked = async () => {
  try {
    loading.value = true
    await friendsStore.fetchBlocked()
  } catch (error) {
    message.error(t('friends.block.fetch_failed'))
    logger.error('Failed to fetch blocked users:', error)
  } finally {
    loading.value = false
  }
}

// 初始化
onMounted(async () => {
  await fetchBlocked()
})

// 暴露刷新方法
defineExpose({
  refresh: fetchBlocked
})
</script>

<style scoped lang="scss">
.block-list-panel {
  width: 100%;
  height: 100%;
  padding: 16px;
}

.header {
  padding: 12px;
  background: var(--bg-setting-item);
  border-radius: 12px;
  border: 1px solid var(--line-color);
}

.loading-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 200px;
  gap: 12px;
}

.block-list {
  max-height: calc(100vh - 300px);
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb-color);
    border-radius: 3px;
  }
}

.blocked-user-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--hula-spacing-sm);
  margin-bottom: var(--hula-spacing-xs);
  background: var(--bg-setting-item);
  border: 1px solid var(--line-color);
  border-radius: var(--hula-radius-sm);
  transition:
    background 0.2s ease,
    border-color 0.2s ease;

  &:hover {
    background: var(--hover-color);
    border-color: var(--border-active-color);
  }
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: var(--hula-text-sm);
  font-weight: 600;
  color: var(--text-color-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.block-time {
  font-size: var(--hula-text-xs);
  color: var(--text-color-3);
}

.stats-collapse {
  padding: 12px;
  background: var(--bg-setting-item);
  border: 1px solid var(--line-color);
  border-radius: 12px;
}
</style>
