# ChatList 虚拟滚动优化方案

## 问题分析

### 当前状态
`src/components/common/ChatList.vue` 组件存在以下问题：

1. **性能瓶颈**
   - 桌面端使用 `v-for` 直接渲染所有会话项（第 61-74 行）
   - 当会话数量超过 100 时，滚动性能下降
   - 每个会话项包含多个 DOM 元素（头像、文本、时间戳等）

2. **虚拟滚动未启用**
   - 组件已有 `virtualScroll` 属性（第 142 行）
   - 但实际未使用该属性来切换渲染模式

3. **移动端已优化**
   - 移动端由于屏幕限制，通常显示的会话项较少
   - 移动端不需要立即优化

## 实施方案

### 方案 A: 使用现有 VirtualList 组件（推荐）

#### 优点
- 复用现有组件
- 已经过测试和验证
- 实现速度快

#### 缺点
- VirtualList 是为消息列表设计的
- 需要适配 ChatList 的需求

#### 实施步骤

1. **修改 ChatList.vue**

```vue
<template>
  <div class="chat-list-wrapper" :class="{ 'mobile-mode': isMobile }">
    <!-- 搜索栏和分类标签保持不变 -->

    <!-- 桌面端：使用虚拟滚动 -->
    <template v-if="!isMobile && virtualScroll && filteredSessions.length > 0">
      <VirtualList
        :items="virtualizedSessions"
        :estimated-item-height="80"
        :buffer="5"
        class="chat-list-virtual"
        @visible-items-change="handleVisibleItemsChange">
        <template #default="{ item, index }">
          <ContextMenu
            :class="getItemClasses(item)"
            :menu="getVisibleMenu(item)"
            :special-menu="getVisibleSpecialMenu(item)"
            :content="item"
            @click="handleClick(item, $event)"
            @dblclick="handleDblClick(item)"
            @select="handleMenuSelect(item, $event)">
            <slot name="item" :item="item" :index="index">
              <ChatListItem :session="item" :is-mobile="false" />
            </slot>
          </ContextMenu>
        </template>
      </VirtualList>
    </template>

    <!-- 保持原有的非虚拟滚动实现作为后备 -->
    <template v-else-if="!isMobile && !virtualScroll && filteredSessions.length > 0">
      <!-- 现有代码 -->
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import VirtualList from './VirtualList.vue'

// 添加虚拟列表数据转换
const virtualizedSessions = computed(() => {
  return filteredSessions.value.map((session, index) => ({
    message: { id: session.roomId },
    _index: index,
    session // 保留原始数据
  }))
})

// 处理可见项目变化（用于懒加载头像等）
function handleVisibleItemsChange(visibleIds: string[]) {
  // 可以在这里实现头像预加载
  logger.debug('[ChatList] Visible items:', visibleIds.length)
}
</script>
```

2. **更新 VirtualList 组件以支持 ChatList**

需要修改 `VirtualList.vue` 以更通用地处理任何类型的项目：

```typescript
// 修改 VirtualList.vue 的 props
interface VirtualListItem {
  message?: { id: string | number }
  [key: string]: unknown
}

// 添加一个选项来使用简单的 ID 而不是 message.id
const getItemId = (item: VirtualListItem): string | number => {
  return item.message?.id ?? (item as { id?: string | number }).id ?? item._index
}
```

### 方案 B: 使用第三方库

#### 推荐库
1. **vue-virtual-scroller** (已有依赖)
   - 项目已使用：`"vue-virtual-scroller": "^1.1.2"`
   - 成熟稳定
   - API 简单

2. **vue3-virtual-scroll-list**
   - 专为 Vue 3 设计
   - 性能优秀
   - TypeScript 支持好

#### 实施示例（使用 vue-virtual-scroller）

```vue
<template>
  <RecycleScroller
    v-if="!isMobile && virtualScroll"
    :items="filteredSessions"
    :item-size="80"
    key-field="roomId"
    v-slot="{ item, index }"
    class="chat-list-scroller">
    <ContextMenu
      :class="getItemClasses(item)"
      :menu="getVisibleMenu(item)"
      :special-menu="getVisibleSpecialMenu(item)"
      :content="item"
      @click="handleClick(item, $event)"
      @dblclick="handleDblClick(item)"
      @select="handleMenuSelect(item, $event)">
      <slot name="item" :item="item" :index="index">
        <ChatListItem :session="item" :is-mobile="false" />
      </slot>
    </ContextMenu>
  </RecycleScroller>
</template>

<script setup lang="ts">
import { RecycleScroller } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
</script>
```

### 方案 C: 分页加载（最简单）

如果会话数量不是特别大（< 500），可以考虑分页加载：

```typescript
const PAGE_SIZE = 50
const displayedCount = ref(PAGE_SIZE)
const displayedSessions = computed(() => {
  return filteredSessions.value.slice(0, displayedCount.value)
})

// 监听滚动事件加载更多
function handleScroll(event: Event) {
  const target = event.target as HTMLElement
  const scrollBottom = target.scrollHeight - target.scrollTop - target.clientHeight
  if (scrollBottom < 100 && displayedCount.value < filteredSessions.value.length) {
    displayedCount.value = Math.min(displayedCount.value + PAGE_SIZE, filteredSessions.value.length)
  }
}
```

## 推荐实施顺序

### 阶段 1: 启用虚拟滚动属性（1 天）
1. 修改 ChatList.vue 使用方案 A 或 B
2. 添加 `virtualScroll` 属性的切换逻辑
3. 测试桌面端功能

### 阶段 2: 性能优化（2-3 天）
1. 实现头像懒加载
2. 优化 ChatListItem 组件渲染
3. 添加滚动位置缓存

### 阶段 3: 用户体验（1-2 天）
1. 添加平滑滚动
2. 保留滚动位置
3. 优化搜索和过滤性能

## 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 破坏现有功能 | 高 | 充分测试，保留非虚拟滚动后备 |
| 上下文菜单问题 | 中 | 测试右键菜单功能 |
| 滚动位置丢失 | 中 | 实现滚动位置缓存 |
| 性能改善不明显 | 低 | 基准测试验证 |

## 成功指标

- [ ] 100+ 会话时滚动 FPS 保持 60
- [ ] 初始渲染时间减少 50%
- [ ] 内存使用减少 30%
- [ ] 所有现有功能正常工作

## 备注

- **优先级**: 中等
- **预计时间**: 3-5 天
- **依赖**: 需要测试团队配合
- **回滚方案**: 保留原有代码，通过 feature flag 控制
