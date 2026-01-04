/** * Matrix SDK v2.0 快速开始示例组件 * 展示如何在组件中使用新的 v2.0 API * * PC 端和移动端通用 */

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { friendsServiceV2, privateChatServiceV2, useFriendsStoreV2, usePrivateChatStoreV2 } from '@/services/index-v2'

// ==================== Store ====================

const friendsStore = useFriendsStoreV2()
const privateChatStore = usePrivateChatStoreV2()

// ==================== 本地状态 ====================

const searchQuery = ref('')
const selectedFriendId = ref<string | null>(null)
const messageInput = ref('')

// ==================== 计算属性 ====================

// 过滤后的好友列表
const filteredFriends = computed(() => {
  if (!searchQuery.value) {
    return friendsStore.friends
  }

  const query = searchQuery.value.toLowerCase()
  return friendsStore.friends.filter((friend) => {
    const name = (friend.display_name || '').toLowerCase()
    const id = friend.user_id.toLowerCase()
    return name.includes(query) || id.includes(query)
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
  console.log('[Example] Component mounted')

  try {
    // 初始化服务
    await Promise.all([friendsStore.initialize(), privateChatStore.initialize()])

    console.log('[Example] Services initialized')
    console.log('[Example] Friends:', friendsStore.totalFriendsCount)
    console.log('[Example] Sessions:', privateChatStore.totalSessionsCount)
  } catch (error) {
    console.error('[Example] Initialization failed:', error)
  }
})

onUnmounted(() => {
  console.log('[Example] Component unmounted')

  // 清理私聊资源
  privateChatStore.dispose()
})

// ==================== 方法 ====================

/**
 * 发送好友请求
 */
async function handleSendRequest(friendId: string) {
  try {
    const requestId = await friendsStore.sendRequest(
      friendId,
      '请加我好友',
      1 // 默认分类
    )

    console.log('[Example] Friend request sent:', requestId)
    alert(`好友请求已发送！ID: ${requestId}`)
  } catch (error) {
    console.error('[Example] Failed to send request:', error)
    alert(`发送失败: ${error}`)
  }
}

/**
 * 开始私聊
 */
async function handleStartChat(friendId: string) {
  try {
    const session = await privateChatStore.createSession({
      participants: [friendId],
      session_name: '私密聊天',
      ttl_seconds: 3600 // 1小时
    })

    console.log('[Example] Session created:', session.session_id)

    // 选择会话
    await privateChatStore.selectSession(session.session_id)

    alert(`会话已创建！ID: ${session.session_id}`)
  } catch (error) {
    console.error('[Example] Failed to create session:', error)
    alert(`创建会话失败: ${error}`)
  }
}

/**
 * 搜索用户
 */
async function handleSearch() {
  if (!searchQuery.value.trim()) {
    friendsStore.clearSearchResults()
    return
  }

  try {
    await friendsStore.searchUsers(searchQuery.value)
    console.log('[Example] Search results:', friendsStore.searchResults)
  } catch (error) {
    console.error('[Example] Search failed:', error)
  }
}

/**
 * 刷新数据
 */
async function handleRefresh() {
  try {
    await friendsStore.refreshAll()
    await privateChatStore.refreshSessions()
    console.log('[Example] Data refreshed')
  } catch (error) {
    console.error('[Example] Refresh failed:', error)
  }
}

/**
 * 清除缓存
 */
function handleInvalidateCache() {
  friendsStore.invalidateCache()
  privateChatStore.invalidateCache()
  console.log('[Example] Cache invalidated')
  alert('缓存已清除')
}

/**
 * 发送消息
 */
async function handleSendMessage() {
  if (!messageInput.value.trim() || !privateChatStore.currentSessionId) {
    return
  }

  try {
    await privateChatStore.sendMessage(messageInput.value)
    messageInput.value = ''
    console.log('[Example] Message sent')
  } catch (error) {
    console.error('[Example] Failed to send message:', error)
    alert(`发送失败: ${error}`)
  }
}
</script>

<template>
  <div class="sdk-v2-example">
    <h1>Matrix SDK v2.0 示例</h1>

    <!-- 状态栏 -->
    <div class="status-bar">
      <div v-if="friendsStore.loading || privateChatStore.loading">⏳ 加载中...</div>
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
      <div class="stat-item">
        <span class="label">会话总数:</span>
        <span class="value">{{ privateChatStore.totalSessionsCount }}</span>
      </div>
    </div>

    <!-- 搜索框 -->
    <div class="search-bar">
      <input v-model="searchQuery" type="text" placeholder="搜索好友..." @keyup.enter="handleSearch" />
      <button @click="handleSearch">搜索</button>
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
            <div class="friend-category">
              分类: {{ friendsStore.getCategoryName(friend.category_id ? String(friend.category_id) : undefined) }}
            </div>
            <div class="friend-presence">状态: {{ friend.presence || 'unknown' }}</div>
          </div>

          <div class="friend-actions">
            <button :disabled="!friendsStore.isLoaded" @click="handleSendRequest(friend.user_id)">➕ 添加</button>
            <button :disabled="!privateChatStore.isLoaded" @click="handleStartChat(friend.user_id)">💬 聊天</button>
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
            <button @click="friendsStore.acceptRequest(request.id, 1)">✅ 接受</button>
            <button @click="friendsStore.rejectRequest(request.id)">❌ 拒绝</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 会话列表 -->
    <div class="section">
      <h2>私聊会话 ({{ privateChatStore.totalSessionsCount }})</h2>

      <div v-if="privateChatStore.loading" class="loading">加载中...</div>

      <div v-else-if="privateChatStore.sessions.length === 0" class="empty">暂无私聊会话</div>

      <div v-else class="session-list">
        <div
          v-for="session in privateChatStore.sessions"
          :key="session.session_id"
          class="session-item"
          :class="{ active: session.session_id === privateChatStore.currentSessionId }">
          <div class="session-info">
            <div class="session-name">
              {{ session.session_name || '未命名会话' }}
            </div>
            <div class="session-id">{{ session.session_id }}</div>
            <div class="session-participants">参与者: {{ session.participant_ids.join(', ') }}</div>
            <div v-if="session.expires_at" class="session-expiry">
              过期: {{ new Date(session.expires_at).toLocaleString() }}
            </div>
          </div>

          <div class="session-actions">
            <button
              v-if="session.session_id !== privateChatStore.currentSessionId"
              @click="privateChatStore.selectSession(session.session_id)">
              选择
            </button>
            <button v-else @click="privateChatStore.deselectSession()">取消选择</button>

            <button @click="privateChatStore.deleteSession(session.session_id)">🗑️ 删除</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 当前会话消息 -->
    <div class="section" v-if="privateChatStore.currentSession">
      <h2>
        当前会话: {{ privateChatStore.currentSession?.session_name }} ({{
          privateChatStore.currentMessages.length
        }}
        条消息)
      </h2>

      <div class="message-list">
        <div
          v-for="message in privateChatStore.currentMessages"
          :key="message.message_id"
          class="message-item"
          :class="{ own: message.is_own }">
          <div class="message-sender">{{ message.sender_id }}</div>
          <div class="message-content">{{ message.content }}</div>
          <div class="message-time">
            {{ message.created_at ? new Date(message.created_at).toLocaleString() : '' }}
          </div>
        </div>
      </div>

      <div class="message-input">
        <input v-model="messageInput" type="text" placeholder="输入消息..." @keyup.enter="handleSendMessage" />
        <button @click="handleSendMessage">发送</button>
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
  color: #333;
  margin-bottom: 20px;
}

h2 {
  color: #666;
  margin-bottom: 15px;
  font-size: 1.2em;
}

/* 状态栏 */
.status-bar {
  display: flex;
  gap: 20px;
  padding: 10px;
  background: #f5f5f5;
  border-radius: 8px;
  margin-bottom: 20px;
}

.error {
  color: #d32f2f;
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
  background: #e3f2fd;
  border-radius: 8px;
}

.stat-item .label {
  font-weight: bold;
  color: #1976d2;
}

.stat-item .value {
  color: #333;
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
  border: 1px solid #ddd;
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
  background: #1976d2;
  color: white;
  cursor: pointer;
  font-size: 14px;
}

.actions button:hover {
  background: #1565c0;
}

/* 区块 */
.section {
  margin-bottom: 30px;
  padding: 20px;
  background: #fafafa;
  border-radius: 12px;
}

.loading,
.empty {
  padding: 40px;
  text-align: center;
  color: #999;
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
  border-left: 4px solid #999;
}

.friend-item.online {
  border-left-color: #4caf50;
}

.friend-info {
  flex: 1;
}

.friend-name {
  font-weight: bold;
  font-size: 16px;
  color: #333;
}

.friend-id {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.friend-category,
.friend-presence {
  font-size: 12px;
  color: #666;
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
  background: #e3f2fd;
  color: #1976d2;
  cursor: pointer;
  font-size: 13px;
}

.friend-actions button:hover:not(:disabled) {
  background: #bbdefb;
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
  color: #333;
}

.request-message {
  font-size: 13px;
  color: #666;
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
  background: #4caf50;
  color: white;
}

.request-actions button:nth-child(2) {
  background: #f44336;
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
  border-left: 4px solid #2196f3;
}

.session-item.active {
  border-left-color: #4caf50;
  background: #e8f5e9;
}

.session-info {
  flex: 1;
}

.session-name {
  font-weight: bold;
  font-size: 16px;
  color: #333;
}

.session-id,
.session-participants,
.session-expiry {
  font-size: 12px;
  color: #666;
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
  background: #e3f2fd;
  color: #1976d2;
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
  background: #f5f5f5;
}

.message-item.own {
  background: #e3f2fd;
  align-items: flex-end;
}

.message-sender {
  font-size: 12px;
  font-weight: bold;
  color: #666;
}

.message-content {
  font-size: 14px;
  color: #333;
}

.message-time {
  font-size: 11px;
  color: #999;
}

/* 消息输入 */
.message-input {
  display: flex;
  gap: 10px;
}

.message-input input {
  flex: 1;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
}

.message-input button {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  background: #4caf50;
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
