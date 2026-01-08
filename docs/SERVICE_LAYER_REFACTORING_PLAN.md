# 服务层重构计划

## 问题分析

### 当前状态
项目中存在多个重复的服务实现，导致代码冗余和维护困难：

1. **好友服务**
   - `friends.ts` - 基于 Synapse 扩展 API（19+ 处引用）
   - `friendsV2.ts` - 基于 SDK v2.0 API（移动端新组件使用）
   - `friendsSDK.ts` - 基于 Friends SDK（桌面端新组件使用）

2. **消息服务**
   - `messageSyncService.ts` - 消息状态管理
   - `unified-message-service.ts` - 整合多个消息服务
   - `messages.ts` - 消息处理服务

### 影响分析
- **代码维护成本高**：需要在多处同时修改
- **测试复杂**：需要测试多个实现
- **类型不一致**：不同服务使用不同的类型定义

## 重构策略

### 阶段 1：统一好友服务（高优先级）

#### 目标
将三个好友 store 统一为一个，保持向后兼容。

#### 方案
创建一个统一的 Facade（外观模式）接口：

```typescript
// stores/unifiedFriends.ts
/**
 * 统一的好友 Store Facade
 * 根据配置选择底层实现
 */
import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useFriendsStoreV2 } from './friendsV2'
import { useFriendsSDKStore } from './friendsSDK'

export const useUnifiedFriendsStore = defineStore('unifiedFriends', () => {
  // 根据平台或配置选择实现
  const useV2 = computed(() => /* 配置逻辑 */ true)

  const v2Store = useFriendsStoreV2()
  const sdkStore = useFriendsSDKStore()

  // 统一接口
  return {
    // 状态
    friends: computed(() => useV2.value ? v2Store.friends : sdkStore.friends),
    categories: computed(() => useV2.value ? v2Store.categories : sdkStore.categories),
    pending: computed(() => useV2.value ? v2Store.pending : sdkStore.pendingRequests),
    stats: computed(() => useV2.value ? v2Store.stats : sdkStore.stats),

    // 操作
    initialize: () => useV2.value ? v2Store.initialize() : sdkStore.initialize(),
    searchUsers: (query: string, limit?: number) =>
      useV2.value ? v2Store.searchUsers(query, limit) : sdkStore.searchUsers(query, limit),
    // ... 其他统一方法
  }
})
```

#### 迁移步骤
1. 创建 `stores/unifiedFriends.ts` Facade
2. 更新新组件使用 Facade
3. 逐步迁移旧组件（保持 friends.ts 用于向后兼容）
4. 标记旧实现为 `@deprecated`

### 阶段 2：统一消息服务（中优先级）

#### 目标
整合消息服务，提供统一的 API。

#### 方案
```
services/message/
├── index.ts              # 统一导出
├── MessageService.ts     # 核心服务接口
├── SyncService.ts        # 同步服务
├── SendService.ts        # 发送服务
└── handlers/
    ├── TextHandler.ts
    ├── ImageHandler.ts
    └── FileHandler.ts
```

### 阶段 3：类型统一（高优先级）

#### 目标
确保所有服务使用相同的类型定义。

#### 方案
创建共享类型定义：
```typescript
// types/friends.ts
export interface Friend {
  user_id: string
  display_name?: string
  avatar_url?: string
  // ... 统一的字段
}

export interface FriendCategory {
  id: string
  name: string
  color?: string
}
```

## 实施时间表

| 阶段 | 任务 | 优先级 | 预计时间 |
|------|------|--------|----------|
| 1 | 创建统一好友服务 Facade | 高 | 2-3 天 |
| 2 | 更新新组件使用 Facade | 高 | 1 天 |
| 3 | 逐步迁移旧组件 | 中 | 3-5 天 |
| 4 | 统一消息服务 | 中 | 5-7 天 |
| 5 | 统一类型定义 | 高 | 1-2 天 |
| 6 | 移除废弃代码 | 低 | 2-3 天 |

## 向后兼容策略

1. **保留旧 API**：使用 `@deprecated` 标记
2. **提供迁移指南**：文档说明如何从旧 API 迁移
3. **过渡期**：保留旧实现 2-3 个版本
4. **渐进式迁移**：新代码使用新 API，旧代码逐步迁移

## 测试策略

1. **单元测试**：每个服务都有对应测试
2. **集成测试**：测试 Facade 的各种场景
3. **E2E 测试**：确保用户场景正常
4. **性能测试**：确保性能不降低

## 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 破坏现有功能 | 高 | 充分测试，保留旧实现 |
| 性能下降 | 中 | 性能基准测试 |
| 迁移成本高 | 中 | 渐进式迁移 |
| 类型不兼容 | 中 | 类型转换适配器 |

## 成功指标

- [ ] 代码重复减少 50%+
- [ ] 测试覆盖率提升到 60%+
- [ ] 所有测试通过
- [ ] 无性能下降
- [ ] 文档完整更新
