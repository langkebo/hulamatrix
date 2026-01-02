# HuLamatrix 前端项目优化方案

> 基于 matrix-js-sdk-39.1.3 v2.0.0 API 升级计划

**项目**: HuLamatrix
**当前版本**: 3.0.5
**目标版本**: 4.0.0
**制定日期**: 2026-01-02
**优化计划版本**: v1.0

---

## 📋 目录

1. [概述](#概述)
2. [当前架构分析](#当前架构分析)
3. [SDK v2.0.0 新特性](#sdk-v200-新特性)
4. [优化目标](#优化目标)
5. [Phase 1: 类型定义优化](#phase-1-类型定义优化)
6. [Phase 2: 服务层优化](#phase-2-服务层优化)
7. [Phase 3: Store 层优化](#phase-3-store-层优化)
8. [Phase 4: 适配器优化](#phase-4-适配器优化)
9. [Phase 5: UI 组件优化](#phase-5-ui-组件优化)
10. [Phase 6: 测试优化](#phase-6-测试优化)
11. [迁移步骤](#迁移步骤)
12. [风险评估](#风险评估)

---

## 概述

本优化方案旨在将 HuLamatrix 前端项目迁移到使用 matrix-js-sdk-39.1.3 的 v2.0.0 API（`friendsV2` 和 `privateChatV2`），充分利用新 SDK 提供的类型安全、缓存机制、事件系统和错误处理能力。

### 核心改进

- ✅ **类型安全**: 完整的 TypeScript 类型定义
- ✅ **缓存机制**: 5分钟 TTL 的好友缓存，会话缓存
- ✅ **事件系统**: 实时事件监听和响应
- ✅ **错误处理**: 自定义错误类，更好的错误信息
- ✅ **性能优化**: 减少不必要的 API 调用
- ✅ **代码简化**: 移除冗余适配器和服务层

---

## 当前架构分析

### 文件结构

```
src/
├── stores/
│   ├── friends.ts                    # 好友 Store (使用旧 API)
│   └── privateChat.ts                # 私聊 Store
│
├── services/
│   └── enhancedFriendsService.ts     # 增强好友服务 (直接调用 SDK)
│
├── integrations/
│   ├── synapse/
│   │   └── friends.ts                # Synapse 好友 API 封装
│   └── matrix/
│       ├── client.ts                 # Matrix 客户端服务
│       └── PrivateChatManager.ts     # 私聊管理器
│
└── adapters/
    └── matrix-private-chat-adapter.ts # 私聊适配器
```

### 当前问题

| 问题 | 描述 | 影响 |
|------|------|------|
| **类型不完整** | 缺少完整的类型定义 | 类型安全性低 |
| **重复实现** | `enhancedFriendsService` 和 SDK v2 功能重复 | 维护成本高 |
| **缺少缓存** | 需要手动实现缓存机制 | 性能不佳 |
| **错误处理** | 错误信息不够详细 | 调试困难 |
| **事件系统分散** | 事件监听逻辑分散在多个文件 | 代码复杂 |

---

## SDK v2.0.0 新特性

### FriendsClient (client.friendsV2)

```typescript
// 完整的 API
import { MatrixClient } from "matrix-js-sdk";

const client = new MatrixClient("https://matrix.cjystx.top");
await client.login("m.login.password", { user: "user", password: "pass" });

const friends = client.friendsV2;

// 获取好友列表（带缓存）
const friendList = await friends.listFriends();

// 搜索用户
const results = await friends.searchUsers("alice");

// 发送好友请求
const requestId = await friends.sendFriendRequest({
    target_id: "@alice:matrix.org",
    message: "Hi!",
    category_id: 1
});

// 监听事件
friends.on("request.received", (request) => {
    console.log("收到好友请求:", request);
});
```

### PrivateChatClient (client.privateChatV2)

```typescript
const privateChat = client.privateChatV2;

// 获取会话列表（带缓存）
const sessions = await privateChat.listSessions();

// 创建会话
const session = await privateChat.createSession({
    participants: ["@alice:matrix.org"],
    session_name: "私聊",
    ttl_seconds: 3600
});

// 发送消息
await privateChat.sendText(session.session_id, "你好！");

// 订阅新消息（自动轮询）
const unsubscribe = privateChat.subscribeToMessages(
    session.session_id,
    (message) => console.log("新消息:", message.content)
);
```

---

## 优化目标

| 指标 | 当前状态 | 目标状态 |
|------|----------|----------|
| 类型覆盖率 | ~60% | 95%+ |
| API 调用次数 | 高（无缓存） | 低（SDK 缓存） |
| 代码行数 | ~2500 行 | ~1800 行 (-28%) |
| 文件数量 | ~15 文件 | ~10 文件 (-33%) |
| 错误处理 | 基础 | 详细（自定义错误类） |
| 事件监听 | 分散 | 统一 |

---

## Phase 1: 类型定义优化

### 1.1 创建统一的类型定义文件

**新建**: `src/types/matrix-sdk-v2.ts`

```typescript
/**
 * Matrix SDK v2.0.0 类型定义
 * 基于 matrix-js-sdk-39.1.3
 */

import type {
    Friend,
    FriendCategory,
    PendingFriendRequest,
    FriendStats,
    SearchedUser,
    ListFriendsOptions,
    SendFriendRequestOptions,
    RespondFriendRequestOptions
} from "matrix-js-sdk";

import type {
    PrivateChatSession,
    PrivateChatMessage,
    CreateSessionOptions,
    SendMessageOptions,
    GetMessagesOptions
} from "matrix-js-sdk";

// ==================== 好友系统类型 ====================

/** 好友项目（扩展 SDK 类型） */
export interface FriendItem extends Friend {
    /** 显示名称（缓存） */
    displayName?: string
    /** 头像 URL（缓存） */
    avatarUrl?: string
    /** 在线状态（缓存） */
    presence?: 'online' | 'offline' | 'unavailable' | 'away'
    /** 状态文本 */
    statusText?: string
    /** 关联的私聊房间 ID */
    roomId?: string
}

/** 好友分类项目（扩展 SDK 类型） */
export interface FriendCategoryItem extends FriendCategory {
    /** 好友数量 */
    friendCount?: number
}

/** 待处理请求项目（扩展 SDK 类型） */
export interface PendingRequestItem extends PendingFriendRequest {
    /** 发送者显示名称 */
    requesterDisplayName?: string
    /** 发送者头像 */
    requesterAvatarUrl?: string
}

// ==================== 私聊系统类型 ====================

/** 私聊会话项目（扩展 SDK 类型） */
export interface PrivateChatSessionItem extends PrivateChatSession {
    /** 最后消息 */
    lastMessage?: PrivateChatMessage
    /** 未读消息数 */
    unreadCount?: number
    /** 参与者信息 */
    participantInfo?: ParticipantInfo[]
}

/** 参与者信息 */
export interface ParticipantInfo {
    userId: string
    displayName?: string
    avatarUrl?: string
}

/** 私聊消息项目（扩展 SDK 类型） */
export interface PrivateChatMessageItem extends PrivateChatMessage {
    /** 发送者显示名称 */
    senderDisplayName?: string
    /** 发送者头像 */
    senderAvatarUrl?: string
    /** 是否为当前用户发送 */
    isOwn?: boolean
}

// ==================== Store 状态类型 ====================

/** 好友 Store 状态 */
export interface FriendsState {
    loading: boolean
    error: string
    friends: FriendItem[]
    categories: FriendCategoryItem[]
    pending: PendingRequestItem[]
    stats: FriendStats | null
    searchResults: SearchedUser[]
    initialized: boolean
}

/** 私聊 Store 状态 */
export interface PrivateChatState {
    loading: boolean
    error: string
    sessions: PrivateChatSessionItem[]
    currentSessionId: string | null
    messages: Map<string, PrivateChatMessageItem[]>
    initialized: boolean
}

// ==================== 错误类型 ====================

/** 好友系统错误 */
export class FriendsSystemError extends Error {
    constructor(
        message: string,
        public code: string,
        public details?: unknown
    ) {
        super(message)
        this.name = 'FriendsSystemError'
    }
}

/** 私聊系统错误 */
export class PrivateChatSystemError extends Error {
    constructor(
        message: string,
        public code: string,
        public details?: unknown
    ) {
        super(message)
        this.name = 'PrivateChatSystemError'
    }
}
```

### 1.2 更新现有类型文件

**修改**: `src/types/matrix.ts`

```typescript
// 导入 SDK v2 类型
export type {
    Friend,
    FriendCategory,
    PendingFriendRequest,
    PrivateChatSession,
    PrivateChatMessage
} from "matrix-js-sdk";
```

---

## Phase 2: 服务层优化

### 2.1 简化好友服务

**重构**: `src/services/enhancedFriendsService.ts`

```typescript
/**
 * 好友服务 v2.0
 * 基于 SDK v2.0.0 API
 */

import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'
import type {
    FriendItem,
    FriendCategoryItem,
    PendingRequestItem,
    FriendsState
} from '@/types/matrix-sdk-v2'
import type {
    Friend,
    FriendCategory,
    PendingFriendRequest
} from 'matrix-js-sdk'

/**
 * 好友服务类
 * 直接使用 SDK v2.0.0 API，无需重复实现
 */
class FriendsServiceV2 {
    private initialized = false

    /**
     * 初始化服务
     */
    async initialize(): Promise<void> {
        if (this.initialized) return

        const client = matrixClientService.getClient()
        if (!client) {
            throw new Error('Matrix client not initialized')
        }

        const friendsV2 = (client as any).friendsV2
        if (!friendsV2) {
            throw new Error('Friends v2 API not available')
        }

        // 设置事件监听
        this.setupEventListeners(friendsV2)

        this.initialized = true
        logger.info('[FriendsServiceV2] Initialized')
    }

    /**
     * 设置事件监听
     */
    private setupEventListeners(friendsV2: any): void {
        // 监听好友添加
        friendsV2.on('friend.add', (data: { friendId: string }) => {
            logger.info('[FriendsServiceV2] Friend added:', data.friendId)
            // 通知 Store 更新
            this.notifyStore('friend:add', data)
        })

        // 监听好友移除
        friendsV2.on('friend.remove', (data: { friendId: string }) => {
            logger.info('[FriendsServiceV2] Friend removed:', data.friendId)
            this.notifyStore('friend:remove', data)
        })

        // 监听好友请求
        friendsV2.on('request.received', (request: PendingFriendRequest) => {
            logger.info('[FriendsServiceV2] Friend request received:', request.id)
            this.notifyStore('request:received', request)
        })

        // 监听请求接受
        friendsV2.on('request.accepted', (data: { requestId: string; categoryId: number }) => {
            logger.info('[FriendsServiceV2] Friend request accepted:', data.requestId)
            this.notifyStore('request:accepted', data)
        })
    }

    /**
     * 通知 Store 更新
     */
    private notifyStore(event: string, data: unknown): void {
        // 通过事件总线或直接调用 Store
        // 实现 depends on 架构选择
    }

    /**
     * 获取好友列表（使用 SDK 缓存）
     */
    async listFriends(useCache = true): Promise<FriendItem[]> {
        const client = matrixClientService.getClient()
        if (!client) throw new Error('Matrix client not initialized')

        const friendsV2 = (client as any).friendsV2
        const friends = await friendsV2.listFriends({}, useCache)

        return friends.map(this.mapToFriendItem)
    }

    /**
     * 获取好友分类（使用 SDK 缓存）
     */
    async getCategories(useCache = true): Promise<FriendCategoryItem[]> {
        const client = matrixClientService.getClient()
        if (!client) throw new Error('Matrix client not initialized')

        const friendsV2 = (client as any).friendsV2
        const categories = await friendsV2.getCategories(useCache)

        return categories.map(cat => ({
            ...cat,
            friendCount: 0 // 可选：异步获取好友数量
        }))
    }

    /**
     * 获取待处理请求
     */
    async getPendingRequests(): Promise<PendingRequestItem[]> {
        const client = matrixClientService.getClient()
        if (!client) throw new Error('Matrix client not initialized')

        const friendsV2 = (client as any).friendsV2
        return await friendsV2.getPendingRequests()
    }

    /**
     * 发送好友请求
     */
    async sendFriendRequest(
        targetId: string,
        message?: string,
        categoryId?: number
    ): Promise<string> {
        const client = matrixClientService.getClient()
        if (!client) throw new Error('Matrix client not initialized')

        const friendsV2 = (client as any).friendsV2
        return await friendsV2.sendFriendRequest({
            target_id: targetId,
            message,
            category_id: categoryId
        })
    }

    /**
     * 接受好友请求
     */
    async acceptFriendRequest(requestId: string, categoryId?: number): Promise<void> {
        const client = matrixClientService.getClient()
        if (!client) throw new Error('Matrix client not initialized')

        const friendsV2 = (client as any).friendsV2
        await friendsV2.acceptFriendRequest(requestId, categoryId)
    }

    /**
     * 拒绝好友请求
     */
    async rejectFriendRequest(requestId: string): Promise<void> {
        const client = matrixClientService.getClient()
        if (!client) throw new Error('Matrix client not initialized')

        const friendsV2 = (client as any).friendsV2
        await friendsV2.rejectFriendRequest(requestId)
    }

    /**
     * 删除好友
     */
    async removeFriend(friendId: string): Promise<void> {
        const client = matrixClientService.getClient()
        if (!client) throw new Error('Matrix client not initialized')

        const friendsV2 = (client as any).friendsV2
        await friendsV2.removeFriend(friendId)
    }

    /**
     * 搜索用户
     */
    async searchUsers(query: string, limit = 20): Promise<any[]> {
        const client = matrixClientService.getClient()
        if (!client) throw new Error('Matrix client not initialized')

        const friendsV2 = (client as any).friendsV2
        return await friendsV2.searchUsers(query, limit)
    }

    /**
     * 获取好友统计
     */
    async getStats(): Promise<any> {
        const client = matrixClientService.getClient()
        if (!client) throw new Error('Matrix client not initialized')

        const friendsV2 = (client as any).friendsV2
        return await friendsV2.getStats()
    }

    /**
     * 清除缓存
     */
    invalidateCache(): void {
        const client = matrixClientService.getClient()
        if (!client) return

        const friendsV2 = (client as any).friendsV2
        friendsV2?.invalidateCache()
    }

    /**
     * 映射到 FriendItem
     */
    private mapToFriendItem(friend: Friend): FriendItem {
        return {
            ...friend,
            // 可选：添加缓存字段
        }
    }
}

// 导出单例
export const friendsServiceV2 = new FriendsServiceV2()
```

### 2.2 创建私聊服务

**新建**: `src/services/privateChatServiceV2.ts`

```typescript
/**
 * 私聊服务 v2.0
 * 基于 SDK v2.0.0 API
 */

import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'
import type {
    PrivateChatSessionItem,
    PrivateChatMessageItem
} from '@/types/matrix-sdk-v2'
import type {
    PrivateChatSession,
    PrivateChatMessage
} from 'matrix-js-sdk'

/**
 * 私聊服务类
 * 直接使用 SDK v2.0.0 API
 */
class PrivateChatServiceV2 {
    private initialized = false
    private messageUnsubscribes = new Map<string, () => void>()

    /**
     * 初始化服务
     */
    async initialize(): Promise<void> {
        if (this.initialized) return

        const client = matrixClientService.getClient()
        if (!client) {
            throw new Error('Matrix client not initialized')
        }

        const privateChatV2 = (client as any).privateChatV2
        if (!privateChatV2) {
            throw new Error('PrivateChat v2 API not available')
        }

        // 设置事件监听
        this.setupEventListeners(privateChatV2)

        this.initialized = true
        logger.info('[PrivateChatServiceV2] Initialized')
    }

    /**
     * 设置事件监听
     */
    private setupEventListeners(privateChatV2: any): void {
        // 监听会话创建
        privateChatV2.on('session.created', (session: PrivateChatSession) => {
            logger.info('[PrivateChatServiceV2] Session created:', session.session_id)
            this.notifyStore('session:created', session)
        })

        // 监听会话删除
        privateChatV2.on('session.deleted', (data: { sessionId: string }) => {
            logger.info('[PrivateChatServiceV2] Session deleted:', data.sessionId)
            this.notifyStore('session:deleted', data)
        })

        // 监听消息接收
        privateChatV2.on('message.received', (message: PrivateChatMessage) => {
            logger.info('[PrivateChatServiceV2] Message received:', message.message_id)
            this.notifyStore('message:received', message)
        })

        // 监听消息发送
        privateChatV2.on('message.sent', (data: { sessionId: string; messageId: string }) => {
            logger.info('[PrivateChatServiceV2] Message sent:', data.messageId)
            this.notifyStore('message:sent', data)
        })
    }

    /**
     * 通知 Store 更新
     */
    private notifyStore(event: string, data: unknown): void {
        // 实现 depends on 架构
    }

    /**
     * 获取会话列表（使用 SDK 缓存）
     */
    async listSessions(useCache = true): Promise<PrivateChatSessionItem[]> {
        const client = matrixClientService.getClient()
        if (!client) throw new Error('Matrix client not initialized')

        const privateChatV2 = (client as any).privateChatV2
        const sessions = await privateChatV2.listSessions(useCache)

        return sessions.map(this.mapToSessionItem)
    }

    /**
     * 创建会话
     */
    async createSession(options: {
        participants: string[]
        session_name?: string
        ttl_seconds?: number
    }): Promise<PrivateChatSessionItem> {
        const client = matrixClientService.getClient()
        if (!client) throw new Error('Matrix client not initialized')

        const privateChatV2 = (client as any).privateChatV2
        const session = await privateChatV2.createSession(options)

        return this.mapToSessionItem(session)
    }

    /**
     * 发送消息
     */
    async sendMessage(options: {
        session_id: string
        content: string
        type?: 'text' | 'image' | 'file' | 'audio' | 'video'
    }): Promise<string> {
        const client = matrixClientService.getClient()
        if (!client) throw new Error('Matrix client not initialized')

        const privateChatV2 = (client as any).privateChatV2
        return await privateChatV2.sendMessage(options)
    }

    /**
     * 发送文本（便捷方法）
     */
    async sendText(sessionId: string, content: string): Promise<string> {
        const client = matrixClientService.getClient()
        if (!client) throw new Error('Matrix client not initialized')

        const privateChatV2 = (client as any).privateChatV2
        return await privateChatV2.sendText(sessionId, content)
    }

    /**
     * 获取消息
     */
    async getMessages(options: {
        session_id: string
        limit?: number
        before?: string
    }): Promise<PrivateChatMessageItem[]> {
        const client = matrixClientService.getClient()
        if (!client) throw new Error('Matrix client not initialized')

        const privateChatV2 = (client as any).privateChatV2
        const messages = await privateChatV2.getMessages(options)

        return messages.map(msg => this.mapToMessageItem(msg))
    }

    /**
     * 删除会话
     */
    async deleteSession(sessionId: string): Promise<void> {
        const client = matrixClientService.getClient()
        if (!client) throw new Error('Matrix client not initialized')

        const privateChatV2 = (client as any).privateChatV2

        // 取消订阅
        const unsubscribe = this.messageUnsubscribes.get(sessionId)
        if (unsubscribe) {
            unsubscribe()
            this.messageUnsubscribes.delete(sessionId)
        }

        await privateChatV2.deleteSession(sessionId)
    }

    /**
     * 订阅消息
     */
    subscribeToMessages(
        sessionId: string,
        handler: (message: PrivateChatMessageItem) => void
    ): () => void {
        const client = matrixClientService.getClient()
        if (!client) throw new Error('Matrix client not initialized')

        const privateChatV2 = (client as any).privateChatV2

        const unsubscribe = privateChatV2.subscribeToMessages(
            sessionId,
            (message: PrivateChatMessage) => {
                handler(this.mapToMessageItem(message))
            }
        )

        this.messageUnsubscribes.set(sessionId, unsubscribe)

        return unsubscribe
    }

    /**
     * 清除缓存
     */
    invalidateCache(): void {
        const client = matrixClientService.getClient()
        if (!client) return

        const privateChatV2 = (client as any).privateChatV2
        privateChatV2?.invalidateCache()
    }

    /**
     * 清理资源
     */
    dispose(): void {
        // 取消所有订阅
        for (const unsubscribe of this.messageUnsubscribes.values()) {
            unsubscribe()
        }
        this.messageUnsubscribes.clear()

        // 调用 SDK dispose
        const client = matrixClientService.getClient()
        if (client) {
            const privateChatV2 = (client as any).privateChatV2
            privateChatV2?.dispose()
        }

        logger.info('[PrivateChatServiceV2] Disposed')
    }

    /**
     * 映射到会话项目
     */
    private mapToSessionItem(session: PrivateChatSession): PrivateChatSessionItem {
        return { ...session }
    }

    /**
     * 映射到消息项目
     */
    private mapToMessageItem(message: PrivateChatMessage): PrivateChatMessageItem {
        return { ...message }
    }
}

// 导出单例
export const privateChatServiceV2 = new PrivateChatServiceV2()
```

---

## Phase 3: Store 层优化

### 3.1 重构好友 Store

**重构**: `src/stores/friends.ts`

```typescript
/**
 * 好友 Store v2.0
 * 基于 SDK v2.0.0 API 和 FriendsServiceV2
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { friendsServiceV2 } from '@/services/enhancedFriendsServiceV2'
import { logger } from '@/utils/logger'
import type { FriendsState, FriendItem, FriendCategoryItem, PendingRequestItem } from '@/types/matrix-sdk-v2'
import type { SearchedUser } from 'matrix-js-sdk'

export const useFriendsStoreV2 = defineStore('friendsV2', () => {
    // ==================== 状态 ====================

    const loading = ref(false)
    const error = ref('')
    const friends = ref<FriendItem[]>([])
    const categories = ref<FriendCategoryItem[]>([])
    const pending = ref<PendingRequestItem[]>([])
    const stats = ref<any>(null)
    const searchResults = ref<SearchedUser[]>([])
    const initialized = ref(false)

    // ==================== 计算属性 ====================

    const friendsByCategory = computed(() => {
        const map = new Map<string | null, FriendItem[]>()
        map.set(null, []) // 未分类

        for (const cat of categories.value) {
            map.set(cat.id, [])
        }

        for (const friend of friends.value) {
            const key = friend.category_id ? String(friend.category_id) : null
            const group = map.get(key) || []
            group.push(friend)
            map.set(key, group)
        }

        return map
    })

    const onlineFriendsCount = computed(() =>
        friends.value.filter(f => f.presence === 'online').length
    )

    const pendingCount = computed(() => pending.value.length)

    // ==================== 操作 ====================

    /**
     * 初始化 Store
     */
    async function initialize() {
        if (initialized.value) return

        try {
            await friendsServiceV2.initialize()
            await refreshAll()
            initialized.value = true
        } catch (e) {
            error.value = e instanceof Error ? e.message : '初始化失败'
            logger.error('[FriendsStoreV2] Initialization failed', { error: e })
        }
    }

    /**
     * 刷新所有数据
     */
    async function refreshAll() {
        loading.value = true
        error.value = ''

        try {
            const [friendsData, categoriesData, pendingData, statsData] = await Promise.all([
                friendsServiceV2.listFriends(true),
                friendsServiceV2.getCategories(true),
                friendsServiceV2.getPendingRequests(),
                friendsServiceV2.getStats()
            ])

            friends.value = friendsData
            categories.value = categoriesData
            pending.value = pendingData
            stats.value = statsData

            logger.info('[FriendsStoreV2] Data refreshed', {
                friends: friends.value.length,
                categories: categories.value.length,
                pending: pending.value.length
            })
        } catch (e) {
            error.value = e instanceof Error ? e.message : '刷新失败'
            logger.error('[FriendsStoreV2] Failed to refresh', { error: e })
        } finally {
            loading.value = false
        }
    }

    /**
     * 刷新好友列表
     */
    async function refreshFriends() {
        try {
            friends.value = await friendsServiceV2.listFriends(true)
        } catch (e) {
            error.value = e instanceof Error ? e.message : '刷新好友列表失败'
        }
    }

    /**
     * 发送好友请求
     */
    async function sendRequest(targetId: string, message?: string, categoryId?: number) {
        try {
            const requestId = await friendsServiceV2.sendFriendRequest(targetId, message, categoryId)
            await refreshAll()
            return requestId
        } catch (e) {
            error.value = e instanceof Error ? e.message : '发送请求失败'
            throw e
        }
    }

    /**
     * 接受好友请求
     */
    async function acceptRequest(requestId: string, categoryId?: number) {
        try {
            await friendsServiceV2.acceptFriendRequest(requestId, categoryId)
            await refreshAll()
        } catch (e) {
            error.value = e instanceof Error ? e.message : '接受请求失败'
            throw e
        }
    }

    /**
     * 拒绝好友请求
     */
    async function rejectRequest(requestId: string) {
        try {
            await friendsServiceV2.rejectFriendRequest(requestId)
            await refreshAll()
        } catch (e) {
            error.value = e instanceof Error ? e.message : '拒绝请求失败'
            throw e
        }
    }

    /**
     * 删除好友
     */
    async function removeFriend(friendId: string) {
        try {
            await friendsServiceV2.removeFriend(friendId)
            await refreshFriends()
        } catch (e) {
            error.value = e instanceof Error ? e.message : '删除好友失败'
            throw e
        }
    }

    /**
     * 搜索用户
     */
    async function searchUsers(query: string, limit = 20) {
        try {
            searchResults.value = await friendsServiceV2.searchUsers(query, limit)
        } catch (e) {
            error.value = e instanceof Error ? e.message : '搜索失败'
        }
    }

    /**
     * 清除缓存
     */
    function invalidateCache() {
        friendsServiceV2.invalidateCache()
    }

    /**
     * 检查是否为好友
     */
    function isFriend(userId: string): boolean {
        return friends.value.some(f => f.user_id === userId)
    }

    /**
     * 获取好友信息
     */
    function getFriend(userId: string): FriendItem | undefined {
        return friends.value.find(f => f.user_id === userId)
    }

    return {
        // 状态
        loading,
        error,
        friends,
        categories,
        pending,
        stats,
        searchResults,
        initialized,

        // 计算属性
        friendsByCategory,
        onlineFriendsCount,
        pendingCount,

        // 操作
        initialize,
        refreshAll,
        refreshFriends,
        sendRequest,
        acceptRequest,
        rejectRequest,
        removeFriend,
        searchUsers,
        invalidateCache,
        isFriend,
        getFriend
    }
})
```

### 3.2 重构私聊 Store

**重构**: `src/stores/privateChat.ts`

```typescript
/**
 * 私聊 Store v2.0
 * 基于 SDK v2.0.0 API 和 PrivateChatServiceV2
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { privateChatServiceV2 } from '@/services/privateChatServiceV2'
import { logger } from '@/utils/logger'
import type { PrivateChatState, PrivateChatSessionItem, PrivateChatMessageItem } from '@/types/matrix-sdk-v2'

export const usePrivateChatStoreV2 = defineStore('privateChatV2', () => {
    // ==================== 状态 ====================

    const loading = ref(false)
    const error = ref('')
    const sessions = ref<PrivateChatSessionItem[]>([])
    const currentSessionId = ref<string | null>(null)
    const messages = ref<Map<string, PrivateChatMessageItem[]>>(new Map())
    const initialized = ref(false)

    // ==================== 计算属性 ====================

    const currentSession = computed(() =>
        sessions.value.find(s => s.session_id === currentSessionId.value)
    )

    const currentMessages = computed(() =>
        currentSessionId.value ? (messages.value.get(currentSessionId.value) || []) : []
    )

    // ==================== 操作 ====================

    /**
     * 初始化 Store
     */
    async function initialize() {
        if (initialized.value) return

        try {
            await privateChatServiceV2.initialize()
            await refreshSessions()
            initialized.value = true
        } catch (e) {
            error.value = e instanceof Error ? e.message : '初始化失败'
            logger.error('[PrivateChatStoreV2] Initialization failed', { error: e })
        }
    }

    /**
     * 刷新会话列表
     */
    async function refreshSessions() {
        loading.value = true
        error.value = ''

        try {
            sessions.value = await privateChatServiceV2.listSessions(true)
        } catch (e) {
            error.value = e instanceof Error ? e.message : '刷新会话失败'
            logger.error('[PrivateChatStoreV2] Failed to refresh sessions', { error: e })
        } finally {
            loading.value = false
        }
    }

    /**
     * 创建会话
     */
    async function createSession(options: {
        participants: string[]
        session_name?: string
        ttl_seconds?: number
    }) {
        loading.value = true
        error.value = ''

        try {
            const session = await privateChatServiceV2.createSession(options)
            sessions.value.unshift(session)
            return session
        } catch (e) {
            error.value = e instanceof Error ? e.message : '创建会话失败'
            logger.error('[PrivateChatStoreV2] Failed to create session', { error: e })
            throw e
        } finally {
            loading.value = false
        }
    }

    /**
     * 删除会话
     */
    async function deleteSession(sessionId: string) {
        try {
            await privateChatServiceV2.deleteSession(sessionId)
            sessions.value = sessions.value.filter(s => s.session_id !== sessionId)
            messages.value.delete(sessionId)

            if (currentSessionId.value === sessionId) {
                currentSessionId.value = null
            }
        } catch (e) {
            error.value = e instanceof Error ? e.message : '删除会话失败'
            logger.error('[PrivateChatStoreV2] Failed to delete session', { error: e })
            throw e
        }
    }

    /**
     * 选择会话
     */
    async function selectSession(sessionId: string) {
        currentSessionId.value = sessionId

        // 加载消息（如果未加载）
        if (!messages.value.has(sessionId)) {
            await loadMessages(sessionId)
        }

        // 订阅新消息
        subscribeToMessages(sessionId)
    }

    /**
     * 加载消息
     */
    async function loadMessages(sessionId: string, limit = 50) {
        try {
            const msgs = await privateChatServiceV2.getMessages({
                session_id: sessionId,
                limit
            })
            messages.value.set(sessionId, msgs)
        } catch (e) {
            error.value = e instanceof Error ? e.message : '加载消息失败'
            logger.error('[PrivateChatStoreV2] Failed to load messages', { error: e, sessionId })
        }
    }

    /**
     * 发送消息
     */
    async function sendMessage(content: string) {
        if (!currentSessionId.value) {
            throw new Error('No active session')
        }

        try {
            const messageId = await privateChatServiceV2.sendText(currentSessionId.value, content)

            // 添加到本地消息列表（乐观更新）
            const newMessage: PrivateChatMessageItem = {
                message_id: messageId,
                session_id: currentSessionId.value,
                sender_id: '', // 当前用户 ID
                content,
                type: 'text',
                created_at: new Date().toISOString()
            }

            const msgs = messages.value.get(currentSessionId.value) || []
            msgs.push(newMessage)
            messages.value.set(currentSessionId.value, msgs)

            return messageId
        } catch (e) {
            error.value = e instanceof Error ? e.message : '发送消息失败'
            logger.error('[PrivateChatStoreV2] Failed to send message', { error: e })
            throw e
        }
    }

    /**
     * 订阅消息
     */
    function subscribeToMessages(sessionId: string) {
        privateChatServiceV2.subscribeToMessages(sessionId, (message) => {
            const msgs = messages.value.get(sessionId) || []
            msgs.push(message)
            messages.value.set(sessionId, msgs)
        })
    }

    /**
     * 清除缓存
     */
    function invalidateCache() {
        privateChatServiceV2.invalidateCache()
    }

    /**
     * 清理资源
     */
    function dispose() {
        privateChatServiceV2.dispose()
        sessions.value = []
        messages.value.clear()
        currentSessionId.value = null
        initialized.value = false
    }

    return {
        // 状态
        loading,
        error,
        sessions,
        currentSessionId,
        messages,
        initialized,

        // 计算属性
        currentSession,
        currentMessages,

        // 操作
        initialize,
        refreshSessions,
        createSession,
        deleteSession,
        selectSession,
        loadMessages,
        sendMessage,
        invalidateCache,
        dispose
    }
})
```

---

## Phase 4: 适配器优化

### 4.1 简化私聊适配器

**重构**: `src/adapters/matrix-private-chat-adapter.ts`

```typescript
/**
 * 私聊适配器 v2.0
 * 基于新 SDK v2.0.0 API
 */

import { matrixClientService } from '@/integrations/matrix/client'
import type { PrivateChatAdapter } from './service-adapter'
import type { PrivateChatSession, PrivateChatMessage } from '@/types/matrix-sdk-v2'
import { logger } from '@/utils/logger'

export class MatrixPrivateChatAdapterV2 implements PrivateChatAdapter {
    name = 'matrix-private-chat-v2'
    priority = 100 // 最高优先级

    async isReady(): Promise<boolean> {
        try {
            const client = matrixClientService.getClient()
            if (!client) return false

            // 检查 privateChatV2 API 是否可用
            const privateChatV2 = (client as any).privateChatV2
            return !!privateChatV2
        } catch {
            return false
        }
    }

    async listSessions(): Promise<PrivateChatSession[]> {
        const client = matrixClientService.getClient()
        if (!client) throw new Error('Client not initialized')

        const privateChatV2 = (client as any).privateChatV2
        return await privateChatV2.listSessions(true)
    }

    async createSession(params: {
        participants: string[]
        name?: string
        ttl_seconds?: number
    }): Promise<PrivateChatSession> {
        const client = matrixClientService.getClient()
        if (!client) throw new Error('Client not initialized')

        const privateChatV2 = (client as any).privateChatV2
        return await privateChatV2.createSession({
            participants: params.participants,
            session_name: params.name,
            ttl_seconds: params.ttl_seconds
        })
    }

    async sendMessage(sessionId: string, content: string): Promise<string> {
        const client = matrixClientService.getClient()
        if (!client) throw new Error('Client not initialized')

        const privateChatV2 = (client as any).privateChatV2
        return await privateChatV2.sendText(sessionId, content)
    }

    async getMessages(sessionId: string, limit = 50): Promise<PrivateChatMessage[]> {
        const client = matrixClientService.getClient()
        if (!client) throw new Error('Client not initialized')

        const privateChatV2 = (client as any).privateChatV2
        return await privateChatV2.getMessages({ session_id: sessionId, limit })
    }

    async deleteSession(sessionId: string): Promise<void> {
        const client = matrixClientService.getClient()
        if (!client) throw new Error('Client not initialized')

        const privateChatV2 = (client as any).privateChatV2
        await privateChatV2.deleteSession(sessionId)
    }

    onMessage(callback: (message: PrivateChatMessage) => void): () => void {
        const client = matrixClientService.getClient()
        if (!client) {
            logger.warn('[MatrixPrivateChatAdapterV2] Client not initialized')
            return () => {}
        }

        const privateChatV2 = (client as any).privateChatV2

        // 监听所有会话的消息
        const handler = (message: PrivateChatMessage) => {
            callback(message)
        }

        privateChatV2.on('message.received', handler)

        return () => {
            privateChatV2.off('message.received', handler)
        }
    }
}
```

---

## Phase 5: UI 组件优化

### 5.1 好友列表组件

**重构**: `src/components/friends/FriendsList.vue`

```vue
<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useFriendsStoreV2 } from '@/stores/friendsV2'
import { usePrivateChatStoreV2 } from '@/stores/privateChatV2'

const friendsStore = useFriendsStoreV2()
const privateChatStore = usePrivateChatStoreV2()

const friendsByCategory = computed(() => friendsStore.friendsByCategory)

onMounted(async () => {
    await friendsStore.initialize()
})

async function handleStartChat(userId: string) {
    try {
        const session = await privateChatStore.createSession({
            participants: [userId],
            session_name: '私聊'
        })
        await privateChatStore.selectSession(session.session_id)
    } catch (error) {
        console.error('Failed to start chat:', error)
    }
}
</script>

<template>
    <div class="friends-list">
        <div v-for="[categoryId, friends] in friendsByCategory" :key="categoryId || 'default'">
            <h3>{{ categoryId || '未分类' }}</h3>
            <div v-for="friend in friends" :key="friend.user_id" @click="handleStartChat(friend.user_id)">
                {{ friend.display_name || friend.user_id }}
            </div>
        </div>
    </div>
</template>
```

---

## Phase 6: 测试优化

### 6.1 单元测试

**新建**: `src/services/__tests__/friendsServiceV2.spec.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { friendsServiceV2 } from '../friendsServiceV2'
import { matrixClientService } from '@/integrations/matrix/client'

vi.mock('@/integrations/matrix/client')

describe('FriendsServiceV2', () => {
    const mockFriendsV2 = {
        listFriends: vi.fn(),
        getCategories: vi.fn(),
        getPendingRequests: vi.fn(),
        sendFriendRequest: vi.fn(),
        acceptFriendRequest: vi.fn(),
        rejectFriendRequest: vi.fn(),
        removeFriend: vi.fn(),
        searchUsers: vi.fn(),
        getStats: vi.fn(),
        invalidateCache: vi.fn(),
        on: vi.fn()
    }

    beforeEach(() => {
        vi.clearAllMocks()
        ;(matrixClientService.getClient as any).mockReturnValue({
            friendsV2: mockFriendsV2
        })
    })

    it('should list friends', async () => {
        mockFriendsV2.listFriends.mockResolvedValue([
            { user_id: '@alice:matrix.org' }
        ])

        const friends = await friendsServiceV2.listFriends()
        expect(friends).toHaveLength(1)
        expect(friends[0].user_id).toBe('@alice:matrix.org')
    })

    // 更多测试...
})
```

---

## 迁移步骤

### 步骤 1: 准备工作

- [ ] 备份当前代码分支
- [ ] 更新 matrix-js-sdk 到 39.1.3
- [ ] 创建新分支 `feature/sdk-v2-migration`

### 步骤 2: 类型定义

- [ ] 创建 `src/types/matrix-sdk-v2.ts`
- [ ] 更新 `src/types/matrix.ts`
- [ ] 运行类型检查: `pnpm run typecheck`

### 步骤 3: 服务层

- [ ] 重构 `src/services/enhancedFriendsService.ts`
- [ ] 创建 `src/services/privateChatServiceV2.ts`
- [ ] 运行测试: `pnpm run test:run`

### 步骤 4: Store 层

- [ ] 重构 `src/stores/friends.ts` → `friendsV2.ts`
- [ ] 重构 `src/stores/privateChat.ts` → `privateChatV2.ts`
- [ ] 逐步迁移组件使用新 Store

### 步骤 5: 适配器

- [ ] 重构 `src/adapters/matrix-private-chat-adapter.ts`
- [ ] 更新适配器优先级

### 步骤 6: UI 组件

- [ ] 更新好友相关组件
- [ ] 更新私聊相关组件

### 步骤 7: 测试

- [ ] 单元测试
- [ ] 集成测试
- [ ] 手动测试

### 步骤 8: 清理

- [ ] 删除旧代码
- [ ] 更新文档
- [ ] 合并主分支

---

## 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| **后端 API 不兼容** | 高 | 保持现有适配器作为 fallback |
| **类型定义冲突** | 中 | 使用命名空间隔离新旧类型 |
| **性能下降** | 低 | SDK 已优化，预期性能提升 |
| **用户数据丢失** | 高 | 充分测试，渐进式迁移 |

---

## 时间估算

| Phase | 预估时间 |
|-------|----------|
| Phase 1: 类型定义 | 1-2 天 |
| Phase 2: 服务层 | 2-3 天 |
| Phase 3: Store 层 | 3-4 天 |
| Phase 4: 适配器 | 1-2 天 |
| Phase 5: UI 组件 | 2-3 天 |
| Phase 6: 测试 | 2-3 天 |
| **总计** | **11-18 天** |

---

**文档版本**: v1.0
**最后更新**: 2026-01-02
**状态**: 待审核
