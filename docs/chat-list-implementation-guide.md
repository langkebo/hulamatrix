# 聊天列表功能开发指南

> HuLamatrix 项目 - 基于 Vue 3 + Naive UI + Pinia

## 目录

1. [功能概述](#功能概述)
2. [数据模型设计](#数据模型设计)
3. [状态管理](#状态管理)
4. [聊天列表组件](#聊天列表组件)
5. [右键菜单实现](#右键菜单实现)
6. [置顶功能](#置顶功能)
7. [删除功能](#删除功能)
8. [标记功能](#标记功能)
9. [退出/删除会话](#退出删除会话)
10. [完整示例代码](#完整示例代码)

---

## 功能概述

聊天列表页面需要实现以下核心功能：

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 聊天列表展示 | 显示所有对话/房间 | P0 |
| 未读消息数量 | 显示未读消息数量徽章 | P0 |
| 最后消息预览 | 显示最后一条消息内容 | P0 |
| 时间戳显示 | 消息时间格式化显示 | P0 |
| 在线状态 | 显示用户在线状态 | P1 |
| 右键菜单 | 置顶、删除、标记、退出 | P0 |
| 搜索过滤 | 搜索聊天列表 | P1 |
| 分组显示 | 按分组/类型显示聊天 | P2 |

---

## 数据模型设计

### 聊天会话数据结构

```typescript
// src/types/chat.ts

/** 聊天会话项 */
export interface ChatSession {
  /** 唯一标识 */
  id: string
  /** 房间ID (Matrix) */
  roomId: string
  /** 会话名称 */
  name: string
  /** 头像URL */
  avatar?: string
  /** 会话类型 */
  type: 'direct' | 'group' | 'space' | 'channel'
  /** 最后消息内容 */
  lastMessage?: {
    /** 消息内容 */
    content: string
    /** 发送者名称 */
    senderName?: string
    /** 消息类型 */
    type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'notification'
    /** 时间戳 */
    timestamp: number
  }
  /** 未读消息数量 */
  unreadCount: number
  /** 是否置顶 */
  isPinned: boolean
  /** 是否免打扰 */
  isMuted: boolean
  /** 是否屏蔽 */
  isShielded: boolean
  /** 在线状态 */
  onlineStatus?: 'online' | 'offline' | 'unavailable'
  /** 分组ID */
  categoryId?: string
  /** 标签 */
  tags?: string[]
  /** 创建时间 */
  createdAt: number
  /** 更新时间 */
  updatedAt: number
}

/** 会话分组 */
export interface SessionCategory {
  id: string
  name: string
  color?: string
  order: number
}

/** 聊天列表过滤选项 */
export interface ChatListFilter {
  /** 搜索关键词 */
  keyword?: string
  /** 会话类型筛选 */
  type?: ChatSession['type'][] | 'all'
  /** 分组筛选 */
  category?: string
  /** 是否只显示置顶 */
  pinnedOnly?: boolean
  /** 是否只显示未读 */
  unreadOnly?: boolean
}
```

---

## 状态管理

### 创建聊天会话 Store

```typescript
// src/stores/chatSession.ts

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ChatSession, ChatListFilter, SessionCategory } from '@/types/chat'

export const useChatSessionStore = defineStore('chatSession', () => {
  // ==================== State ====================
  /** 所有会话列表 */
  const sessions = ref<Map<string, ChatSession>>(new Map())

  /** 当前选中的会话ID */
  const currentSessionId = ref<string | null>(null)

  /** 会话分组列表 */
  const categories = ref<SessionCategory[]>([
    { id: 'all', name: '全部', order: 0 },
    { id: 'pinned', name: '置顶', order: 1 },
    { id: 'direct', name: '私信', order: 2 },
    { id: 'group', name: '群组', order: 3 },
  ])

  /** 加载状态 */
  const loading = ref(false)

  /** 过滤选项 */
  const filter = ref<ChatListFilter>({
    keyword: '',
    type: 'all',
    pinnedOnly: false,
    unreadOnly: false
  })

  // ==================== Getters ====================

  /** 当前选中的会话 */
  const currentSession = computed(() => {
    if (!currentSessionId.value) return null
    return sessions.value.get(currentSessionId.value)
  })

  /** 置顶的会话列表 */
  const pinnedSessions = computed(() => {
    return Array.from(sessions.value.values())
      .filter(session => session.isPinned)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  })

  /** 未置顶的会话列表 */
  const unpinnedSessions = computed(() => {
    return Array.from(sessions.value.values())
      .filter(session => !session.isPinned)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  })

  /** 总未读数 */
  const totalUnreadCount = computed(() => {
    return Array.from(sessions.value.values())
      .reduce((sum, session) => {
        // 不统计免打扰和屏蔽的会话
        if (session.isMuted || session.isShielded) {
          return sum
        }
        return sum + Math.max(0, session.unreadCount)
      }, 0)
  })

  /** 过滤后的会话列表 */
  const filteredSessions = computed(() => {
    let result = Array.from(sessions.value.values())

    // 关键词搜索
    if (filter.value.keyword) {
      const keyword = filter.value.keyword.toLowerCase()
      result = result.filter(session =>
        session.name.toLowerCase().includes(keyword) ||
        session.lastMessage?.content?.toLowerCase().includes(keyword)
      )
    }

    // 类型筛选
    if (filter.value.type && filter.value.type !== 'all') {
      result = result.filter(session =>
        filter.value.type!.includes(session.type)
      )
    }

    // 只显示置顶
    if (filter.value.pinnedOnly) {
      result = result.filter(session => session.isPinned)
    }

    // 只显示未读
    if (filter.value.unreadOnly) {
      result = result.filter(session => session.unreadCount > 0)
    }

    // 排序：置顶在前，然后按更新时间排序
    result.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      return b.updatedAt - a.updatedAt
    })

    return result
  })

  // ==================== Actions ====================

  /**
   * 添加或更新会话
   */
  const upsertSession = (session: ChatSession) => {
    sessions.value.set(session.id, { ...session })
  }

  /**
   * 批量更新会话
   */
  const upsertSessions = (sessionList: ChatSession[]) => {
    sessionList.forEach(session => {
      sessions.value.set(session.id, { ...session })
    })
  }

  /**
   * 删除会话
   */
  const removeSession = (sessionId: string) => {
    sessions.value.delete(sessionId)
    // 如果删除的是当前会话，清空当前会话ID
    if (currentSessionId.value === sessionId) {
      currentSessionId.value = null
    }
  }

  /**
   * 设置当前会话
   */
  const setCurrentSession = (sessionId: string | null) => {
    currentSessionId.value = sessionId
  }

  /**
   * 置顶/取消置顶会话
   */
  const togglePinSession = (sessionId: string) => {
    const session = sessions.value.get(sessionId)
    if (session) {
      session.isPinned = !session.isPinned
      session.updatedAt = Date.now()
    }
  }

  /**
   * 更新会话未读数
   */
  const updateUnreadCount = (sessionId: string, count: number) => {
    const session = sessions.value.get(sessionId)
    if (session) {
      session.unreadCount = Math.max(0, count)
      session.updatedAt = Date.now()
    }
  }

  /**
   * 清空会话未读数
   */
  const clearUnreadCount = (sessionId: string) => {
    updateUnreadCount(sessionId, 0)
  }

  /**
   * 设置会话免打扰
   */
  const setMuteSession = (sessionId: string, muted: boolean) => {
    const session = sessions.value.get(sessionId)
    if (session) {
      session.isMuted = muted
      session.updatedAt = Date.now()
    }
  }

  /**
   * 屏蔽会话
   */
  const setShieldSession = (sessionId: string, shielded: boolean) => {
    const session = sessions.value.get(sessionId)
    if (session) {
      session.isShielded = shielded
      session.updatedAt = Date.now()
    }
  }

  /**
   * 更新最后消息
   */
  const updateLastMessage = (
    sessionId: string,
    message: ChatSession['lastMessage']
  ) => {
    const session = sessions.value.get(sessionId)
    if (session) {
      session.lastMessage = message
      session.updatedAt = Date.now()
    }
  }

  /**
   * 设置过滤器
   */
  const setFilter = (newFilter: Partial<ChatListFilter>) => {
    filter.value = { ...filter.value, ...newFilter }
  }

  /**
   * 清空所有会话
   */
  const clearAllSessions = () => {
    sessions.value.clear()
    currentSessionId.value = null
  }

  return {
    // State
    sessions,
    currentSessionId,
    categories,
    loading,
    filter,

    // Getters
    currentSession,
    pinnedSessions,
    unpinnedSessions,
    totalUnreadCount,
    filteredSessions,

    // Actions
    upsertSession,
    upsertSessions,
    removeSession,
    setCurrentSession,
    togglePinSession,
    updateUnreadCount,
    clearUnreadCount,
    setMuteSession,
    setShieldSession,
    updateLastMessage,
    setFilter,
    clearAllSessions
  }
})
```

---

## 聊天列表组件

### ChatList 主组件

```vue
<!-- src/components/chat/ChatList.vue -->
<template>
  <div class="chat-list">
    <!-- 搜索栏 -->
    <div class="chat-list-search">
      <n-input
        v-model:value="searchKeyword"
        placeholder="搜索聊天..."
        clearable
        @input="handleSearch"
      >
        <template #prefix>
          <n-icon :component="SearchIcon" />
        </template>
      </n-input>
    </div>

    <!-- 置顶会话 -->
    <div v-if="pinnedSessions.length > 0" class="chat-list-section">
      <div class="chat-list-section-header">
        <span>置顶聊天</span>
      </div>
      <ChatListItem
        v-for="session in pinnedSessions"
        :key="session.id"
        :session="session"
        :active="currentSessionId === session.id"
        @click="handleSessionClick(session)"
        @contextmenu="handleContextMenu($event, session)"
      />
    </div>

    <!-- 普通会话 -->
    <div class="chat-list-section">
      <div v-if="pinnedSessions.length > 0" class="chat-list-section-header">
        <span>全部聊天</span>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="chat-list-loading">
        <n-spin size="small" />
        <span>加载中...</span>
      </div>

      <!-- 空状态 -->
      <div v-else-if="filteredSessions.length === 0" class="chat-list-empty">
        <n-icon size="48" :component="MessageCircleIcon" />
        <p>{{ searchKeyword ? '没有找到匹配的聊天' : '还没有聊天记录' }}</p>
      </div>

      <!-- 会话列表 -->
      <ChatListItem
        v-for="session in displaySessions"
        :key="session.id"
        :session="session"
        :active="currentSessionId === session.id"
        @click="handleSessionClick(session)"
        @contextmenu="handleContextMenu($event, session)"
      />
    </div>

    <!-- 右键菜单 -->
    <ContextMenu
      :content="contextMenuContent"
      :menu="contextMenuItems"
      @select="handleContextMenuSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { NInput, NIcon, NSpin, useDialog, useMessage } from 'naive-ui'
import { Search as SearchIcon, MessageCircle as MessageCircleIcon } from '@vicons/tabler'
import { useChatSessionStore } from '@/stores/chatSession'
import { useChatUnread } from '@/stores/composables/chat-unread'
import ChatListItem from './ChatListItem.vue'
import ContextMenu from '@/components/common/ContextMenu.vue'
import type { ChatSession } from '@/types/chat'

const router = useRouter()
const dialog = useDialog()
const message = useMessage()

// Store
const chatSessionStore = useChatSessionStore()
const { clearUnreadCount } = useChatUnread({
  sessionList: computed(() => Array.from(chatSessionStore.sessions.values())),
  updateSession: chatSessionStore.upsertSession
})

// State
const searchKeyword = ref('')

// Computed
const loading = computed(() => chatSessionStore.loading)
const currentSessionId = computed(() => chatSessionStore.currentSessionId)
const pinnedSessions = computed(() => chatSessionStore.pinnedSessions)
const filteredSessions = computed(() => chatSessionStore.filteredSessions)

// 显示的会话列表（排除置顶的）
const displaySessions = computed(() => {
  return filteredSessions.value.filter(s => !s.isPinned)
})

// 右键菜单
const contextMenuContent = ref<ChatSession | null>(null)
const contextMenuItems = computed(() => [
  {
    label: '置顶聊天',
    icon: 'pin',
    visible: () => !contextMenuContent.value?.isPinned,
    click: handlePinSession
  },
  {
    label: '取消置顶',
    icon: 'pin-off',
    visible: () => contextMenuContent.value?.isPinned,
    click: handleUnpinSession
  },
  {
    label: '标记已读',
    icon: 'check',
    visible: () => (contextMenuContent.value?.unreadCount || 0) > 0,
    click: handleMarkAsRead
  },
  {
    label: '免打扰',
    icon: 'bell-off',
    visible: () => !contextMenuContent.value?.isMuted,
    click: handleMuteSession
  },
  {
    label: '取消免打扰',
    icon: 'bell',
    visible: () => contextMenuContent.value?.isMuted,
    click: handleUnmuteSession
  },
  {
    label: '删除聊天',
    icon: 'delete',
    click: handleDeleteSession
  }
])

// Methods
const handleSearch = () => {
  chatSessionStore.setFilter({ keyword: searchKeyword.value })
}

const handleSessionClick = (session: ChatSession) => {
  chatSessionStore.setCurrentSession(session.id)
  // 清空未读数
  if (session.unreadCount > 0) {
    clearUnreadCount(session.id)
  }
  // 导航到聊天页面
  router.push({
    name: 'chat',
    params: { sessionId: session.id }
  })
}

const handleContextMenu = (event: MouseEvent, session: ChatSession) => {
  event.preventDefault()
  event.stopPropagation()
  contextMenuContent.value = session
}

const handleContextMenuSelect = (item: any) => {
  if (typeof item.click === 'function') {
    item.click(contextMenuContent.value)
  }
}

// 右键菜单操作
const handlePinSession = (session: ChatSession | null) => {
  if (!session) return
  chatSessionStore.togglePinSession(session.id)
  message.success('已置顶聊天')
}

const handleUnpinSession = (session: ChatSession | null) => {
  if (!session) return
  chatSessionStore.togglePinSession(session.id)
  message.info('已取消置顶')
}

const handleMarkAsRead = (session: ChatSession | null) => {
  if (!session) return
  clearUnreadCount(session.id)
  message.success('已标记为已读')
}

const handleMuteSession = (session: ChatSession | null) => {
  if (!session) return
  chatSessionStore.setMuteSession(session.id, true)
  message.success('已开启免打扰')
}

const handleUnmuteSession = (session: ChatSession | null) => {
  if (!session) return
  chatSessionStore.setMuteSession(session.id, false)
  message.info('已取消免打扰')
}

const handleDeleteSession = (session: ChatSession | null) => {
  if (!session) return

  dialog.warning({
    title: '删除聊天',
    content: `确定要删除与 "${session.name}" 的聊天吗？此操作不可恢复。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        // TODO: 调用删除会话的 API
        chatSessionStore.removeSession(session.id)
        message.success('聊天已删除')
      } catch (error) {
        message.error('删除聊天失败')
      }
    }
  })
}
</script>

<style scoped lang="scss">
.chat-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--n-color);
}

.chat-list-search {
  padding: 12px;
  border-bottom: 1px solid var(--n-border-color);
}

.chat-list-section {
  flex: 1;
  overflow-y: auto;
}

.chat-list-section-header {
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--n-text-color-3);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.chat-list-loading,
.chat-list-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px;
  color: var(--n-text-color-3);
}
</style>
```

### ChatListItem 会话项组件

```vue
<!-- src/components/chat/ChatListItem.vue -->
<template>
  <div
    class="chat-list-item"
    :class="{ active }"
    @click="$emit('click')"
    @contextmenu="$emit('contextmenu', $event)"
  >
    <!-- 头像 -->
    <div class="chat-list-item-avatar">
      <n-avatar
        :src="session.avatar"
        :fallback-src="defaultAvatar"
        round
        size="medium"
      >
        {{ avatarInitials }}
      </n-avatar>

      <!-- 在线状态指示器 -->
      <div
        v-if="showOnlineStatus"
        class="chat-list-item-online"
        :class="onlineStatusClass"
      />
    </div>

    <!-- 内容区域 -->
    <div class="chat-list-item-content">
      <!-- 顶部行：名称和时间 -->
      <div class="chat-list-item-header">
        <span class="chat-list-item-name">{{ session.name }}</span>
        <div class="chat-list-item-meta">
          <!-- 免打扰图标 -->
          <n-icon
            v-if="session.isMuted"
            size="14"
            :component="BellOffIcon"
            class="chat-list-item-muted"
          />
          <!-- 置顶图标 -->
          <n-icon
            v-if="session.isPinned"
            size="14"
            :component="PinIcon"
            class="chat-list-item-pinned"
          />
          <!-- 时间戳 -->
          <span class="chat-list-item-time">{{ formattedTime }}</span>
        </div>
      </div>

      <!-- 底部行：最后消息和未读数 -->
      <div class="chat-list-item-footer">
        <span class="chat-list-item-message">{{ messagePreview }}</span>
        <!-- 未读数徽章 -->
        <n-badge
          v-if="session.unreadCount > 0"
          :value="session.unreadCount"
          :max="99"
          type="error"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NAvatar, NBadge, NIcon } from 'naive-ui'
import { BellOff as BellOffIcon, Pin as PinIcon } from '@vicons/tabler'
import type { ChatSession } from '@/types/chat'

interface Props {
  session: ChatSession
  active?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  active: false
})

defineEmits<{
  click: []
  contextmenu: [event: MouseEvent]
}>()

// 默认头像
const defaultAvatar = computed(() => {
  return `/default-avatar-${props.session.type}.png`
})

// 头像首字母
const avatarInitials = computed(() => {
  const name = props.session.name
  if (!name) return '?'

  // 群组显示图标
  if (props.session.type === 'group') {
    return ''
  }

  // 私信显示首字母
  const words = name.trim().split(/\s+/)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
})

// 是否显示在线状态
const showOnlineStatus = computed(() => {
  return props.session.type === 'direct' && props.session.onlineStatus
})

// 在线状态样式类
const onlineStatusClass = computed(() => {
  return `chat-list-item-online--${props.session.onlineStatus || 'offline'}`
})

// 消息预览
const messagePreview = computed(() => {
  const msg = props.session.lastMessage
  if (!msg) return '暂无消息'

  let content = msg.content

  // 添加发送者前缀（群组消息）
  if (props.session.type === 'group' && msg.senderName) {
    content = `${msg.senderName}: ${content}`
  }

  // 根据消息类型添加前缀
  switch (msg.type) {
    case 'image':
      content = '[图片]'
      break
    case 'video':
      content = '[视频]'
      break
    case 'audio':
      content = '[语音]'
      break
    case 'file':
      content = '[文件]'
      break
    case 'notification':
      content = '[通知]'
      break
  }

  return content
})

// 格式化时间
const formattedTime = computed(() => {
  const timestamp = props.session.lastMessage?.timestamp || props.session.updatedAt
  if (!timestamp) return ''

  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  // 今天：显示时间
  if (diff < 24 * 60 * 60 * 1000 && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // 本周：显示星期
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return weekdays[date.getDay()]
  }

  // 本年：显示月/日
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit'
    })
  }

  // 其他：显示完整日期
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
})
</script>

<style scoped lang="scss">
.chat-list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  cursor: pointer;
  transition: background-color 0.2s;
  user-select: none;

  &:hover {
    background: var(--n-hover-color);
  }

  &.active {
    background: var(--n-pressed-color);
  }
}

.chat-list-item-avatar {
  position: relative;
  flex-shrink: 0;
}

.chat-list-item-online {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--n-color);

  &--online {
    background: #52c41a;
  }

  &--offline {
    background: #8c8c8c;
  }

  &--unavailable {
    background: #faad14;
  }
}

.chat-list-item-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.chat-list-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.chat-list-item-name {
  flex: 1;
  font-weight: 500;
  color: var(--n-text-color-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-list-item-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.chat-list-item-muted,
.chat-list-item-pinned {
  color: var(--n-text-color-3);
}

.chat-list-item-time {
  font-size: 11px;
  color: var(--n-text-color-3);
}

.chat-list-item-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.chat-list-item-message {
  flex: 1;
  font-size: 12px;
  color: var(--n-text-color-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
```

---

## 右键菜单实现

### 使用现有的 ContextMenu 组件

项目中已经有一个完善的 `ContextMenu.vue` 组件（位于 `src/components/common/ContextMenu.vue`），可以直接使用。

### 右键菜单配置

```typescript
// src/components/chat/chatListContextMenu.ts

import type { MenuItem } from '@/components/common/ContextMenu.vue'
import type { ChatSession } from '@/types/chat'

/**
 * 获取聊天列表右键菜单项
 */
export function getChatListContextMenuItems(
  session: ChatSession,
  handlers: {
    onPin: (session: ChatSession) => void
    onUnpin: (session: ChatSession) => void
    onMarkRead: (session: ChatSession) => void
    onMute: (session: ChatSession) => void
    onUnmute: (session: ChatSession) => void
    onDelete: (session: ChatSession) => void
    onQuit: (session: ChatSession) => void
  }
): MenuItem[] {
  return [
    // 置顶/取消置顶
    {
      label: session.isPinned ? '取消置顶' : '置顶聊天',
      icon: session.isPinned ? 'pin-off' : 'pin',
      click: () => session.isPinned ? handlers.onUnpin(session) : handlers.onPin(session)
    },

    // 分隔线以下

    // 标记已读
    {
      label: '标记已读',
      icon: 'check',
      visible: session.unreadCount > 0,
      click: () => handlers.onMarkRead(session)
    },

    // 免打扰开关
    {
      label: '免打扰',
      icon: 'bell-off',
      visible: !session.isMuted,
      click: () => handlers.onMute(session)
    },
    {
      label: '取消免打扰',
      icon: 'bell',
      visible: session.isMuted,
      click: () => handlers.onUnmute(session)
    },

    // 危险操作
    {
      label: '退出群组',
      icon: 'logout',
      visible: session.type === 'group',
      click: () => handlers.onQuit(session)
    },
    {
      label: '删除聊天',
      icon: 'forbid',
      click: () => handlers.onDelete(session)
    }
  ]
}
```

### 在组件中使用右键菜单

```vue
<template>
  <ContextMenu
    :content="contextMenuTarget"
    :menu="contextMenuItems"
    @select="handleContextMenuSelect"
  >
    <ChatListItem
      v-for="session in sessions"
      :key="session.id"
      :session="session"
      @contextmenu="handleItemContextMenu($event, session)"
    />
  </ContextMenu>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import ContextMenu from '@/components/common/ContextMenu.vue'
import { getChatListContextMenuItems } from '@/components/chat/chatListContextMenu'
import type { ChatSession } from '@/types/chat'
import type { MenuItem } from '@/components/common/ContextMenu.vue'

const contextMenuTarget = ref<ChatSession | null>(null)

// 获取右键菜单配置
const contextMenuItems = computed<MenuItem[]>(() => {
  if (!contextMenuTarget.value) return []
  return getChatListContextMenuItems(contextMenuTarget.value, {
    onPin: handlePinSession,
    onUnpin: handleUnpinSession,
    onMarkRead: handleMarkRead,
    onMute: handleMuteSession,
    onUnmute: handleUnmuteSession,
    onDelete: handleDeleteSession,
    onQuit: handleQuitSession
  })
})

// 处理右键菜单
const handleItemContextMenu = (event: MouseEvent, session: ChatSession) => {
  event.preventDefault()
  event.stopPropagation()
  contextMenuTarget.value = session
}

const handleContextMenuSelect = (item: MenuItem) => {
  // 菜单项点击会自动执行对应的 click 函数
  contextMenuTarget.value = null
}

// 操作处理函数
const handlePinSession = (session: ChatSession) => {
  chatSessionStore.togglePinSession(session.id)
  message.success('已置顶')
}

const handleUnpinSession = (session: ChatSession) => {
  chatSessionStore.togglePinSession(session.id)
  message.info('已取消置顶')
}

const handleMarkRead = (session: ChatSession) => {
  clearUnreadCount(session.id)
}

const handleMuteSession = (session: ChatSession) => {
  chatSessionStore.setMuteSession(session.id, true)
  message.success('已开启免打扰')
}

const handleUnmuteSession = (session: ChatSession) => {
  chatSessionStore.setMuteSession(session.id, false)
  message.info('已取消免打扰')
}

const handleQuitSession = (session: ChatSession) => {
  dialog.warning({
    title: '退出群组',
    content: `确定要退出群组 "${session.name}" 吗？`,
    positiveText: '退出',
    negativeText: '取消',
    onPositiveClick: async () => {
      // TODO: 调用退出群组 API
    }
  })
}

const handleDeleteSession = (session: ChatSession) => {
  dialog.warning({
    title: '删除聊天',
    content: `确定要删除与 "${session.name}" 的聊天吗？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      // TODO: 调用删除聊天 API
    }
  })
}
</script>
```

---

## 置顶功能

### 置顶功能实现

```typescript
// src/stores/chatSession.ts (添加到已有 store)

/**
 * 置顶会话
 */
const pinSession = (sessionId: string) => {
  const session = sessions.value.get(sessionId)
  if (session && !session.isPinned) {
    session.isPinned = true
    session.updatedAt = Date.now()
    // 保存到本地存储
    savePinnedSessions()
  }
}

/**
 * 取消置顶会话
 */
const unpinSession = (sessionId: string) => {
  const session = sessions.value.get(sessionId)
  if (session && session.isPinned) {
    session.isPinned = false
    session.updatedAt = Date.now()
    // 保存到本地存储
    savePinnedSessions()
  }
}

/**
 * 获取置顶会话ID列表
 */
const getPinnedSessionIds = (): string[] => {
  return Array.from(sessions.value.values())
    .filter(s => s.isPinned)
    .map(s => s.id)
}

/**
 * 从本地存储加载置顶状态
 */
const loadPinnedSessions = () => {
  try {
    const saved = localStorage.getItem('chat_pinned_sessions')
    if (saved) {
      const pinnedIds = JSON.parse(saved) as string[]
      pinnedIds.forEach(id => {
        const session = sessions.value.get(id)
        if (session) {
          session.isPinned = true
        }
      })
    }
  } catch (error) {
    logger.error('[ChatSession] 加载置顶状态失败:', error)
  }
}

/**
 * 保存置顶状态到本地存储
 */
const savePinnedSessions = () => {
  try {
    const pinnedIds = getPinnedSessionIds()
    localStorage.setItem('chat_pinned_sessions', JSON.stringify(pinnedIds))
  } catch (error) {
    logger.error('[ChatSession] 保存置顶状态失败:', error)
  }
}
```

---

## 删除功能

### 删除会话实现

```typescript
// src/services/chatSessionService.ts

import { matrixClientService } from './matrixClientService'

/**
 * 删除聊天会话
 * @param sessionId 会话ID
 */
export async function deleteChatSession(sessionId: string): Promise<void> {
  const client = matrixClientService.getClient()
  if (!client) {
    throw new Error('Matrix 客户端未初始化')
  }

  try {
    // 对于直接聊天，忽略用户
    // 对于群组，离开房间
    const room = client.getRoom(sessionId)
    if (!room) {
      throw new Error('房间不存在')
    }

    if (room.isDirectMessage()) {
      // 直接聊天：忽略用户
      const userId = room.getDMUserId()
      if (userId) {
        // TODO: 调用忽略用户的 API
      }
    } else {
      // 群组：离开房间
      await client.leave(room.roomId)
    }

    // 从本地存储中移除
    localStorage.removeItem(`chat_session_${sessionId}`)
  } catch (error) {
    logger.error('[ChatSessionService] 删除会话失败:', error)
    throw error
  }
}

/**
 * 退出群组
 * @param roomId 房间ID
 */
export async function leaveGroupRoom(roomId: string): Promise<void> {
  const client = matrixClientService.getClient()
  if (!client) {
    throw new Error('Matrix 客户端未初始化')
  }

  try {
    await client.leave(roomId)
  } catch (error) {
    logger.error('[ChatSessionService] 退出群组失败:', error)
    throw error
  }
}
```

---

## 标记功能

### 标记已读实现

```typescript
// src/services/chatReadService.ts

import { matrixClientService } from './matrixClientService'

/**
 * 标记房间为已读
 * @param roomId 房间ID
 */
export async function markRoomAsRead(roomId: string): Promise<void> {
  const client = matrixClientService.getClient()
  if (!client) {
    throw new Error('Matrix 客户端未初始化')
  }

  try {
    const room = client.getRoom(roomId)
    if (!room) {
      throw new Error('房间不存在')
    }

    // 发送已读回执到最新事件
    // Matrix SDK 会自动处理多读回执的发送
    // 我们只需要确保设置正确的已读位置
    // 这里使用 SDK 内置的方法

    // 获取房间最新事件
    const timeline = room.getLiveTimeline()
    const events = timeline.getEvents()

    if (events.length > 0) {
      const lastEvent = events[events.length - 1]
      await client.sendReadReceipt(roomId, lastEvent.getId())
    }

    // 清除未读计数
    const unreadStats = room.getUnreadNotificationCount()
    if (unreadStats !== 0) {
      // SDK 应该在发送已读回执后自动更新未读计数
    }
  } catch (error) {
    logger.error('[ChatReadService] 标记已读失败:', error)
    throw error
  }
}

/**
 * 标记所有房间为已读
 */
export async function markAllRoomsAsRead(): Promise<void> {
  const client = matrixClientService.getClient()
  if (!client) {
    throw new Error('Matrix 客户端未初始化')
  }

  try {
    const rooms = client.getRooms()
    await Promise.all(
      rooms.map(room => markRoomAsRead(room.roomId))
    )
  } catch (error) {
    logger.error('[ChatReadService] 全部标记已读失败:', error)
    throw error
  }
}
```

---

## 退出/删除会话

### 完整实现

```vue
<!-- 在 ChatList.vue 中添加 -->
<script setup lang="ts">
// ...

/**
 * 退出群组
 */
const handleQuitGroup = (session: ChatSession) => {
  dialog.warning({
    title: '退出群组',
    content: `确定要退出群组 "${session.name}" 吗？退出后你将不再接收此群组的消息。`,
    positiveText: '退出',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        loading.value = true

        // 调用退出群组 API
        await leaveGroupRoom(session.roomId)

        // 从列表中移除
        chatSessionStore.removeSession(session.id)

        // 如果是当前会话，导航到首页
        if (currentSessionId.value === session.id) {
          router.push({ name: 'home' })
        }

        message.success('已退出群组')
      } catch (error) {
        message.error('退出群组失败')
      } finally {
        loading.value = false
      }
    }
  })
}

/**
 * 删除聊天（私信）
 */
const handleDeleteChat = (session: ChatSession) => {
  dialog.warning({
    title: '删除聊天',
    content: session.type === 'direct'
      ? `确定要删除与 "${session.name}" 的聊天吗？此操作只会在本地删除聊天记录。`
      : `确定要删除群组 "${session.name}" 的聊天吗？你需要先退出群组才能删除。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        loading.value = true

        // 调用删除会话 API
        await deleteChatSession(session.id)

        // 从列表中移除
        chatSessionStore.removeSession(session.id)

        // 如果是当前会话，导航到首页
        if (currentSessionId.value === session.id) {
          router.push({ name: 'home' })
        }

        message.success('聊天已删除')
      } catch (error) {
        message.error('删除聊天失败')
      } finally {
        loading.value = false
      }
    }
  })
}
</script>
```

---

## 完整示例代码

### 完整的 ChatList 组件

```vue
<!-- src/components/chat/ChatList.vue -->
<template>
  <div class="chat-list-container">
    <!-- 搜索栏 -->
    <div class="chat-list-header">
      <n-input
        v-model:value="searchKeyword"
        placeholder="搜索聊天..."
        clearable
        size="small"
        @input="handleSearch"
      >
        <template #prefix>
          <n-icon :component="SearchIcon" />
        </template>
      </n-input>
    </div>

    <!-- 聊天列表 -->
    <div class="chat-list-body">
      <!-- 置顶会话 -->
      <div v-if="pinnedSessions.length > 0" class="chat-list-section">
        <div class="chat-list-section-title">置顶</div>
        <ChatListItem
          v-for="session in pinnedSessions"
          :key="session.id"
          :session="session"
          :active="isActive(session)"
          @click="handleClick(session)"
          @contextmenu="handleContextMenu($event, session)"
        />
      </div>

      <!-- 普通会话 -->
      <div class="chat-list-section">
        <div v-if="pinnedSessions.length > 0" class="chat-list-section-title">
          全部
        </div>

        <!-- 空状态 -->
        <div v-if="!loading && displaySessions.length === 0" class="chat-list-empty">
          <n-empty :description="searchKeyword ? '没有找到匹配的聊天' : '还没有聊天'" />
        </div>

        <!-- 加载状态 -->
        <div v-else-if="loading" class="chat-list-loading">
          <n-spin size="small" />
        </div>

        <!-- 会话列表 -->
        <ChatListItem
          v-for="session in displaySessions"
          :key="session.id"
          :session="session"
          :active="isActive(session)"
          @click="handleClick(session)"
          @contextmenu="handleContextMenu($event, session)"
        />
      </div>
    </div>

    <!-- 右键菜单 -->
    <ContextMenu
      :content="contextMenuTarget"
      :menu="contextMenuItems"
      @select="handleMenuSelect"
    />

    <!-- 总未读数徽章 (可选，用于侧边栏图标) -->
    <n-badge
      v-if="totalUnreadCount > 0"
      :value="totalUnreadCount"
      :max="99"
      class="chat-list-badge"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  NInput,
  NIcon,
  NSpin,
  NEmpty,
  NBadge,
  useDialog,
  useMessage
} from 'naive-ui'
import { Search as SearchIcon } from '@vicons/tabler'
import { useChatSessionStore } from '@/stores/chatSession'
import { useChatUnread } from '@/stores/composables/chat-unread'
import { deleteChatSession, leaveGroupRoom } from '@/services/chatSessionService'
import { markRoomAsRead } from '@/services/chatReadService'
import { logger } from '@/utils/logger'
import ChatListItem from './ChatListItem.vue'
import ContextMenu from '@/components/common/ContextMenu.vue'
import { getChatListContextMenuItems } from './chatListContextMenu'
import type { ChatSession } from '@/types/chat'
import type { MenuItem } from '@/components/common/ContextMenu.vue'

const router = useRouter()
const dialog = useDialog()
const message = useMessage()

// Store
const chatSessionStore = useChatSessionStore()
const { clearUnreadCount } = useChatUnread({
  sessionList: computed(() => Array.from(chatSessionStore.sessions.values())),
  updateSession: chatSessionStore.upsertSession
})

// State
const searchKeyword = ref('')
const contextMenuTarget = ref<ChatSession | null>(null)

// Computed
const loading = computed(() => chatSessionStore.loading)
const currentSessionId = computed(() => chatSessionStore.currentSessionId)
const pinnedSessions = computed(() => chatSessionStore.pinnedSessions)
const totalUnreadCount = computed(() => chatSessionStore.totalUnreadCount)

// 过滤后的会话（排除置顶）
const displaySessions = computed(() => {
  const all = chatSessionStore.filteredSessions
  return all.filter(s => !s.isPinned)
})

// 右键菜单配置
const contextMenuItems = computed<MenuItem[]>(() => {
  if (!contextMenuTarget.value) return []
  return getChatListContextMenuItems(contextMenuTarget.value, {
    onPin: handlePin,
    onUnpin: handleUnpin,
    onMarkRead: handleMarkRead,
    onMute: handleMute,
    onUnmute: handleUnmute,
    onDelete: handleDelete,
    onQuit: handleQuit
  })
})

// Methods
const isActive = (session: ChatSession) => {
  return currentSessionId.value === session.id
}

const handleClick = (session: ChatSession) => {
  chatSessionStore.setCurrentSession(session.id)

  // 清空未读数
  if (session.unreadCount > 0) {
    clearUnreadCount(session.id)
  }

  // 导航到聊天页面
  router.push({
    name: 'chat',
    params: { sessionId: session.id }
  })
}

const handleSearch = () => {
  chatSessionStore.setFilter({ keyword: searchKeyword.value })
}

const handleContextMenu = (event: MouseEvent, session: ChatSession) => {
  event.preventDefault()
  event.stopPropagation()
  contextMenuTarget.value = session
}

const handleMenuSelect = (item: MenuItem) => {
  contextMenuTarget.value = null
}

// 右键菜单操作处理
const handlePin = async (session: ChatSession) => {
  try {
    chatSessionStore.togglePinSession(session.id)
    message.success('已置顶')
  } catch (error) {
    logger.error('[ChatList] 置顶失败:', error)
    message.error('置顶失败')
  }
}

const handleUnpin = async (session: ChatSession) => {
  try {
    chatSessionStore.togglePinSession(session.id)
    message.info('已取消置顶')
  } catch (error) {
    logger.error('[ChatList] 取消置顶失败:', error)
    message.error('取消置顶失败')
  }
}

const handleMarkRead = async (session: ChatSession) => {
  try {
    await markRoomAsRead(session.roomId)
    clearUnreadCount(session.id)
    message.success('已标记为已读')
  } catch (error) {
    logger.error('[ChatList] 标记已读失败:', error)
    message.error('标记已读失败')
  }
}

const handleMute = async (session: ChatSession) => {
  try {
    chatSessionStore.setMuteSession(session.id, true)
    message.success('已开启免打扰')
  } catch (error) {
    logger.error('[ChatList] 开启免打扰失败:', error)
    message.error('操作失败')
  }
}

const handleUnmute = async (session: ChatSession) => {
  try {
    chatSessionStore.setMuteSession(session.id, false)
    message.info('已取消免打扰')
  } catch (error) {
    logger.error('[ChatList] 取消免打扰失败:', error)
    message.error('操作失败')
  }
}

const handleDelete = async (session: ChatSession) => {
  dialog.warning({
    title: '删除聊天',
    content: `确定要删除与 "${session.name}" 的聊天吗？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await deleteChatSession(session.id)
        chatSessionStore.removeSession(session.id)

        if (currentSessionId.value === session.id) {
          router.push({ name: 'home' })
        }

        message.success('聊天已删除')
      } catch (error) {
        logger.error('[ChatList] 删除聊天失败:', error)
        message.error('删除聊天失败')
      }
    }
  })
}

const handleQuit = async (session: ChatSession) => {
  dialog.warning({
    title: '退出群组',
    content: `确定要退出群组 "${session.name}" 吗？`,
    positiveText: '退出',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await leaveGroupRoom(session.roomId)
        chatSessionStore.removeSession(session.id)

        if (currentSessionId.value === session.id) {
          router.push({ name: 'home' })
        }

        message.success('已退出群组')
      } catch (error) {
        logger.error('[ChatList] 退出群组失败:', error)
        message.error('退出群组失败')
      }
    }
  })
}

// 生命周期
onMounted(() => {
  // 初始化加载会话列表
  chatSessionStore.loading = true
  // TODO: 从 API 或本地存储加载会话列表
  setTimeout(() => {
    chatSessionStore.loading = false
  }, 1000)
})
</script>

<style scoped lang="scss">
.chat-list-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--n-color);
  position: relative;
}

.chat-list-header {
  padding: 12px;
  border-bottom: 1px solid var(--n-border-color);
}

.chat-list-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.chat-list-section {
  margin-bottom: 8px;
}

.chat-list-section-title {
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--n-text-color-3);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.chat-list-empty {
  padding: 32px;
  text-align: center;
}

.chat-list-loading {
  display: flex;
  justify-content: center;
  padding: 32px;
}

.chat-list-badge {
  position: absolute;
  top: 8px;
  right: 8px;
}
</style>
```

---

## 图标资源

项目中使用 `@vicons/tabler` 图标库，以下是常用的图标：

| 功能 | 图标名称 | 用途 |
|------|----------|------|
| 搜索 | `Search` | 搜索栏 |
| 置顶 | `Pin` | 置顶操作 |
| 取消置顶 | `PinOff` | 取消置顶 |
| 标记已读 | `Check` | 标记已读 |
| 免打扰 | `BellOff` | 开启免打扰 |
| 取消免打扰 | `Bell` | 取消免打扰 |
| 删除 | `Forbid` / `Trash` | 删除聊天 |
| 退出 | `Logout` | 退出群组 |
| 消息 | `MessageCircle` | 空状态图标 |

---

## API 集成说明

### Matrix SDK 集成

```typescript
// src/services/matrixChatService.ts

import * as sdk from 'matrix-js-sdk'
import { matrixClientService } from './matrixClientService'

/**
 * 获取所有加入的房间
 */
export async function getJoinedRooms(): Promise<string[]> {
  const client = matrixClientService.getClient()
  if (!client) {
    throw new Error('Matrix 客户端未初始化')
  }

  const rooms = client.getRooms()
  return rooms.map(room => room.roomId)
}

/**
 * 获取房间未读数
 */
export function getRoomUnreadCount(roomId: string): number {
  const client = matrixClientService.getClient()
  if (!client) return 0

  const room = client.getRoom(roomId)
  if (!room) return 0

  return room.getUnreadNotificationCount() || 0
}

/**
 * 监听房间事件以更新未读数
 */
export function listenToRoomEvents(
  onNewMessage: (roomId: string, message: any) => void
): void {
  const client = matrixClientService.getClient()
  if (!client) return

  client.on(sdk.RoomEvent.Timeline, (event, room) => {
    if (event.getType() === 'm.room.message') {
      onNewMessage(room.roomId, event)
    }
  })
}
```

---

## 最佳实践

### 1. 性能优化

- 使用虚拟列表处理大量会话
- 防抖搜索输入
- 懒加载会话详情

### 2. 用户体验

- 右键菜单位置自适应（避免超出视口）
- 确认对话框使用清晰的文案
- 操作反馈及时（成功/失败提示）

### 3. 数据同步

- 监听 Matrix SDK 事件实时更新
- 本地状态持久化（localStorage）
- 置顶状态同步到服务器

---

**文档版本**: 1.0.0
**最后更新**: 2024-12-28
