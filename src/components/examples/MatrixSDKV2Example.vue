/** * Matrix SDK v2.0 快速开始示例组件 * 展示如何在组件中使用新的 v2.0 API * * PC 端和移动端通用 */

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { logger } from '@/utils/logger'
import { useFriendsStoreV2 } from '@/stores/friendsSDK'

// ==================== Store ====================

const friendsStore = useFriendsStoreV2()

// ==================== 本地状态 ====================

const searchQuery = ref('')
const selectedFriendId = ref<string | null>(null)

// ==================== 计算属性 ====================

// 获取分类名称
const getCategoryName = (categoryId: string | undefined): string => {
  if (!categoryId) return '未分类'
  const category = friendsStore.categories.find((c) => c.id === categoryId)
  return category?.name || '未知分类'
}

// 过滤后的好友列表
const filteredFriends = computed(() => {
  if (!searchQuery.value) {
    return friendsStore.friends
  }

  const query = searchQuery.value.toLowerCase()
  return friendsStore.friends.filter((friend) => {
    const name = (friend.display_name || '').toLowerCase()
    const id = friend.user_id || ''
    return name.includes(query) || id.toLowerCase().includes(query)
  })
})

// 按分类分组的好友
const friendsGroupedByCategory = computed(() => {
  const grouped = new Map<string | null, typeof friendsStore.friends>()

  // 初始化未分类组
  grouped.set(null, [])

  // 初始化所有分类组
  for (const category of friendsStore.categories) {
    grouped.set(String(category.id), [])
  }

  // 分组好友
  for (const friend of friendsStore.friends) {
    const key = friend.category_id ? String(friend.category_id) : null
    const group = grouped.get(key) || []
    group.push(friend)
    grouped.set(key, group)
  }

  return grouped
})

// ==================== 生命周期 ====================

onMounted(async () => {
  logger.debug('[Example] Component mounted')

  try {
    // 初始化服务
    await friendsStore.initialize()

    logger.debug('[Example] Services initialized')
    logger.debug('[Example] Friends:', friendsStore.totalFriendsCount)
  } catch (error) {
    logger.error('[Example] Initialization failed:', error)
  }
})

onUnmounted(() => {
  logger.debug('[Example] Component unmounted')
})

// ==================== 方法 ====================

/**
 * 发送好友请求
 */
async function handleSendRequest(friendId: string) {
  try {
    const requestId = await friendsStore.sendFriendRequest(friendId, {
      message: '请加我好友'
    })

    logger.debug('[Example] Friend request sent:', requestId)
    alert(`好友请求已发送！ID: ${requestId}`)
  } catch (error) {
    logger.error('[Example] Failed to send request:', error)
    alert(`发送失败: ${error}`)
  }
}

/**
 * 刷新数据
 */
async function handleRefresh() {
  try {
    await friendsStore.refresh()
    logger.debug('[Example] Data refreshed')
  } catch (error) {
    logger.error('[Example] Refresh failed:', error)
  }
}

/**
 * 清除缓存
 */
function handleInvalidateCache() {
  friendsStore.reset()
  logger.debug('[Example] Cache invalidated')
  alert('缓存已清除')
}
</script>

<template>
  <div class="sdk-v2-example">
    <h1>Matrix SDK v2.0 示例</h1>

    <!-- 状态栏 -->
    <div class="status-bar">
      <div v-if="friendsStore.loading">⏳ 加载中...</div>
      <div v-else>✅ 就绪</div>

      <div v-if="friendsStore.error" class="error">❌ {{ friendsStore.error }}</div>
    </div>

    <!-- 统计信息 -->
    <div class="stats">
      <div class="stat-item">
        <span class="label">好友总数:</span>
        <span class="value">{{ friendsStore.totalFriendsCount }}</span>
      </div>
      <div class="stat-item">
        <span class="label">在线好友:</span>
        <span class="value">{{ friendsStore.onlineFriendsCount }}</span>
      </div>
      <div class="stat-item">
        <span class="label">待处理请求:</span>
        <span class="value">{{ friendsStore.pendingCount }}</span>
      </div>
    </div>

    <!-- 搜索框 -->
    <div class="search-bar">
      <input v-model="searchQuery" type="text" placeholder="搜索好友..." />
    </div>

    <!-- 操作按钮 -->
    <div class="actions">
      <button @click="handleRefresh">🔄 刷新</button>
      <button @click="handleInvalidateCache">🗑️ 清除缓存</button>
    </div>

    <!-- 好友列表 -->
    <div class="section">
      <h2>好友列表</h2>

      <div v-if="friendsStore.loading" class="loading">加载中...</div>

      <div v-else-if="filteredFriends.length === 0" class="empty">
        {{ searchQuery ? '未找到匹配的好友' : '暂无好友' }}
      </div>

      <div v-else class="friend-list">
        <div
          v-for="friend in filteredFriends"
          :key="friend.user_id"
          class="friend-item"
          :class="{ online: friend.presence === 'online' }">
          <div class="friend-info">
            <div class="friend-name">
              {{ friend.display_name || friend.user_id }}
            </div>
            <div class="friend-id">{{ friend.user_id }}</div>
            <div class="friend-category">分类: {{ getCategoryName(friend.category_id) }}</div>
            <div class="friend-presence">状态: {{ friend.presence || 'unknown' }}</div>
          </div>

          <div class="friend-actions">
            <button
              :disabled="!friendsStore.isLoaded || !friend.user_id"
              @click="friend.user_id && handleSendRequest(friend.user_id)">
              ➕ 添加
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 待处理请求 -->
    <div class="section" v-if="friendsStore.pending.length > 0">
      <h2>待处理请求 ({{ friendsStore.pending.length }})</h2>

      <div class="request-list">
        <div v-for="request in friendsStore.pending" :key="request.id" class="request-item">
          <div class="request-info">
            <div class="requester-id">{{ request.requester_id }}</div>
            <div v-if="request.message" class="request-message">
              {{ request.message }}
            </div>
          </div>

          <div class="request-actions">
            <button @click="friendsStore.acceptRequest(request.id)">✅ 接受</button>
            <button @click="friendsStore.rejectRequest(request.id)">❌ 拒绝</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sdk-v2-example {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

h1 {
  color: var(--hula-gray-900);
  margin-bottom: 20px;
}

h2 {
  color: var(--hula-gray-700);
  margin-bottom: 15px;
  font-size: 1.2em;
}

/* 状态栏 */
.status-bar {
  display: flex;
  gap: 20px;
  padding: 10px;
  background: var(--hula-brand-primary);
  border-radius: 8px;
  margin-bottom: 20px;
}

.error {
  color: var(--hula-brand-primary);
}

/* 统计信息 */
.stats {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  gap: 10px;
  padding: 10px 15px;
  background: var(--hula-brand-primary);
  border-radius: 8px;
}

.stat-item .label {
  font-weight: bold;
  color: var(--hula-brand-primary);
}

.stat-item .value {
  color: var(--hula-gray-900);
}

/* 搜索框 */
.search-bar {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.search-bar input {
  flex: 1;
  padding: 10px;
  border: 1px solid var(--hula-gray-300);
  border-radius: 8px;
  font-size: 14px;
}

/* 操作按钮 */
.actions {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.actions button {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  background: var(--hula-brand-primary);
  color: white;
  cursor: pointer;
  font-size: 14px;
}

.actions button:hover {
  background: var(--hula-brand-primary);
}

/* 区块 */
.section {
  margin-bottom: 30px;
  padding: 20px;
  background: var(--hula-brand-primary);
  border-radius: 12px;
}

.loading,
.empty {
  padding: 40px;
  text-align: center;
  color: var(--hula-gray-400);
}

/* 好友列表 */
.friend-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.friend-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  background: white;
  border-radius: 8px;
  border-left: 4px solid var(--hula-gray-400);
}

.friend-item.online {
  border-left-color: var(--hula-brand-primary);
}

.friend-info {
  flex: 1;
}

.friend-name {
  font-weight: bold;
  font-size: 16px;
  color: var(--hula-gray-900);
}

.friend-id {
  font-size: 12px;
  color: var(--hula-gray-400);
  margin-top: 4px;
}

.friend-category,
.friend-presence {
  font-size: 12px;
  color: var(--hula-gray-700);
  margin-top: 4px;
}

.friend-actions {
  display: flex;
  gap: 10px;
}

.friend-actions button {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  background: var(--hula-brand-primary);
  color: var(--hula-brand-primary);
  cursor: pointer;
  font-size: 13px;
}

.friend-actions button:hover:not(:disabled) {
  background: var(--hula-brand-primary);
}

.friend-actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 请求列表 */
.request-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.request-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  background: white;
  border-radius: 8px;
}

.request-info {
  flex: 1;
}

.requester-id {
  font-weight: bold;
  color: var(--hula-gray-900);
}

.request-message {
  font-size: 13px;
  color: var(--hula-gray-700);
  margin-top: 4px;
  font-style: italic;
}

.request-actions {
  display: flex;
  gap: 10px;
}

.request-actions button {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.request-actions button:nth-child(1) {
  background: var(--hula-brand-primary);
  color: white;
}

.request-actions button:nth-child(2) {
  background: var(--hula-brand-primary);
  color: white;
}

/* 会话列表 */
.session-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.session-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  background: white;
  border-radius: 8px;
  border-left: 4px solid var(--hula-brand-primary);
}

.session-item.active {
  border-left-color: var(--hula-brand-primary);
  background: var(--hula-brand-primary);
}

.session-info {
  flex: 1;
}

.session-name {
  font-weight: bold;
  font-size: 16px;
  color: var(--hula-gray-900);
}

.session-id,
.session-participants,
.session-expiry {
  font-size: 12px;
  color: var(--hula-gray-700);
  margin-top: 4px;
}

.session-actions {
  display: flex;
  gap: 10px;
}

.session-actions button {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  background: var(--hula-brand-primary);
  color: var(--hula-brand-primary);
  cursor: pointer;
  font-size: 13px;
}

/* 消息列表 */
.message-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 400px;
  overflow-y: auto;
  padding: 15px;
  background: white;
  border-radius: 8px;
  margin-bottom: 15px;
}

.message-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px;
  border-radius: 8px;
  background: var(--hula-brand-primary);
}

.message-item.own {
  background: var(--hula-brand-primary);
  align-items: flex-end;
}

.message-sender {
  font-size: 12px;
  font-weight: bold;
  color: var(--hula-gray-700);
}

.message-content {
  font-size: 14px;
  color: var(--hula-gray-900);
}

.message-time {
  font-size: 11px;
  color: var(--hula-gray-400);
}

/* 消息输入 */
.message-input {
  display: flex;
  gap: 10px;
}

.message-input input {
  flex: 1;
  padding: 10px;
  border: 1px solid var(--hula-gray-300);
  border-radius: 8px;
  font-size: 14px;
}

.message-input button {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  background: var(--hula-brand-primary);
  color: white;
  cursor: pointer;
  font-size: 14px;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .sdk-v2-example {
    padding: 10px;
  }

  .stats {
    flex-direction: column;
    gap: 10px;
  }

  .friend-item,
  .request-item,
  .session-item {
    flex-direction: column;
    gap: 10px;
    align-items: stretch;
  }

  .friend-actions,
  .request-actions,
  .session-actions {
    justify-content: stretch;
  }

  .friend-actions button,
  .request-actions button,
  .session-actions button {
    flex: 1;
  }
}
</style>
