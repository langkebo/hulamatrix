# Cursor Pointer 自动化指南

本文档介绍 HuLa 项目中用于确保可点击元素具有适当视觉反馈的自动化工具。

## 问题背景

在 UI/UX 审计中，我们发现 **664 个** 可点击元素缺少 `cursor: pointer` 样式。这会导致用户难以识别哪些元素是可交互的，降低用户体验。

## 解决方案

我们提供了三种自动化解决方案：

1. **Vue 指令** (`v-cursor-pointer`) - 最简单的方式
2. **Composable 函数** (`useAutoCursor`) - 需要更多控制时使用
3. **全局自动应用** (`useGlobalAutoCursor`) - 用于快速修复现有代码

---

## 1. Vue 指令 `v-cursor-pointer`

### 基本用法

```vue
<template>
  <!-- 自动添加 cursor-pointer -->
  <div v-cursor-pointer @click="handleClick">
    点击我
  </div>

  <!-- 条件应用 -->
  <div v-cursor-pointer="isClickable" @click="handleClick">
    有条件地可点击
  </div>
</template>
```

### 功能特性

- ✅ 自动添加 `cursor: pointer`
- ✅ 自动添加 `role="button"` (可访问性)
- ✅ 自动添加 `tabindex="0"` (键盘导航)
- ✅ 支持动态绑定 (条件启用/禁用)
- ✅ 组件卸载时自动清理

### 使用场景

| 场景 | 推荐方案 |
|------|---------|
| 简单可点击元素 | `v-cursor-pointer` |
| 需要 hover 效果 | `useAutoCursor` composable |
| 大量现有组件 | `useAutoCursorForChildren` |

---

## 2. Composable `useAutoCursor`

### 基本用法

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAutoCursor } from '@/composables/useAutoCursor'

const containerRef = ref<HTMLElement | null>(null)

onMounted(() => {
  // 为单个元素添加交互反馈
  const { el, addHover, removeHover } = useAutoCursor(containerRef.value, {
    hoverClass: 'hover:bg-opacity-75',
    activeClass: 'active:opacity-80',
    focusClass: 'focus-visible:ring-2 focus-visible:ring-brand-primary'
  })

  // 手动控制效果
  // addHover()
  // removeHover()
})
</script>

<template>
  <div ref="containerRef" @click="handleClick">
    点击我
  </div>
</template>
```

### 参数选项

```typescript
interface AutoCursorOptions {
  hoverClass?: string    // hover 时添加的类 (默认: 'hover:bg-opacity-75')
  activeClass?: string   // active 时添加的类 (默认: 'active:opacity-80')
  focusClass?: string    // focus 时添加的类 (默认: 'focus-visible:ring-2 focus-visible:ring-brand-primary')
}
```

### 返回值

```typescript
{
  el: HTMLElement | null,           // 目标元素
  addHover: () => void,              // 手动添加 hover 效果
  removeHover: () => void            // 手动移除 hover 效果
}
```

---

## 3. Composable `useAutoCursorForChildren`

### 基本用法

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAutoCursorForChildren } from '@/composables/useAutoCursor'

const containerRef = ref<HTMLElement | null>(null)

onMounted(() => {
  // 自动为所有可点击子元素添加 cursor-pointer
  useAutoCursorForChildren(containerRef.value)
})
</script>

<template>
  <div ref="containerRef">
    <!-- 这些子元素会自动获得 cursor-pointer -->
    <div @click="handle1">按钮 1</div>
    <div @click="handle2">按钮 2</div>
    <button>按钮 3</button>
    <a href="#">链接</a>
  </div>
</template>
```

### 自动检测的选择器

此 composable 会自动为以下选择器匹配的元素添加 `cursor-pointer`:

```css
[@click],           <!-- Vue @click 指令 -->
[onclick],          <!-- 原生 onclick 事件 -->
button:not([disabled]),  <!-- 未禁用的按钮 -->
a[href],            <!-- 带有 href 的链接 -->
[role="button"],    <!-- role="button" 的元素 -->
.clickable          <!-- .clickable 类 -->
```

### 使用 MutationObserver

使用 `useAutoCursorForChildren` 会启动 MutationObserver，自动检测并处理动态添加的元素：

```vue
<script setup>
import { useAutoCursorForChildren } from '@/composables/useAutoCursor'

const listRef = ref(null)

onMounted(() => {
  useAutoCursorForChildren(listRef.value)
})

// 动态添加的元素也会自动获得 cursor-pointer
const addItem = () => {
  const newItem = document.createElement('div')
  newItem.textContent = '动态添加的按钮'
  newItem.onclick = () => console.log('clicked')
  listRef.value.appendChild(newItem)
}
</script>
```

---

## 4. 全局应用 `useGlobalAutoCursor`

⚠️ **谨慎使用**: 全局应用会影响整个文档，建议在应用根组件调用。

```vue
<!-- App.vue -->
<script setup lang="ts">
import { onMounted } from 'vue'
import { useGlobalAutoCursor } from '@/composables/useAutoCursor'

onMounted(() => {
  // 为整个应用自动添加 cursor-pointer
  useGlobalAutoCursor()
})
</script>
```

### 功能特性

- ✅ 初始扫描整个文档
- ✅ MutationObserver 监听 DOM 变化
- ✅ 自动为动态添加的可点击元素添加样式
- ✅ 组件卸载时自动清理

---

## 最佳实践

### 何时使用指令 vs Composable

| 使用场景 | 推荐方案 | 原因 |
|---------|---------|------|
| 新开发的单个可点击元素 | `v-cursor-pointer` | 最简单，声明式 |
| 需要 hover/active/focus 效果 | `useAutoCursor` | 可自定义交互反馈 |
| 容器内有多个可点击子元素 | `useAutoCursorForChildren` | 自动处理所有子元素 |
| 大量现有组件需要快速修复 | `useGlobalAutoCursor` | 一次性全局应用 |

### 性能考虑

1. **指令方式** (`v-cursor-pointer`) - 性能最佳，推荐用于新组件
2. **Composable 方式** - 需要手动管理引用和生命周期
3. **全局应用** - 会启动 MutationObserver，有轻微性能开销

### 可访问性

所有工具都会自动添加可访问性属性：

- `role="button"` - 标识为按钮
- `tabindex="0"` - 使元素可通过键盘访问
- 焦点样式 - 视觉反馈

### 与现有代码兼容

这些工具可以与现有的样式完美兼容：

```vue
<template>
  <!-- 可以与现有的类一起使用 -->
  <div
    v-cursor-pointer
    class="flex items-center gap-2 p-4 rounded-lg"
    :class="{ 'bg-blue-500': isActive }"
    @click="handleClick">
    兼容现有样式
  </div>
</template>
```

---

## 迁移指南

### 从手动添加 cursor 到使用指令

**之前:**
```vue
<template>
  <div
    class="clickable"
    style="cursor: pointer"
    @click="handleClick">
    点击我
  </div>
</template>
```

**之后:**
```vue
<template>
  <div
    v-cursor-pointer
    @click="handleClick">
    点击我
  </div>
</template>
```

### 批量迁移现有组件

如果你想为大量现有组件添加 cursor-pointer，可以：

1. **选项 1: 全局应用** (最快)
   ```vue
   <!-- App.vue -->
   <script setup>
   import { useGlobalAutoCursor } from '@/composables/useAutoCursor'
   onMounted(() => useGlobalAutoCursor())
   </script>
   ```

2. **选项 2: 逐个组件添加** (更可控)
   ```vue
   <!-- 每个组件 -->
   <script setup>
   import { useAutoCursorForChildren } from '@/composables/useAutoCursor'
   const rootRef = ref(null)
   onMounted(() => useAutoCursorForChildren(rootRef.value))
   </script>

   <template>
     <div ref="rootRef">
       <!-- 组件内容 -->
     </div>
   </template>
   ```

---

## 常见问题

### Q: 为什么要自动化而不是手动添加？

**A:** 手动添加容易遗漏且难以维护。自动化确保：
- 不会遗漏任何可点击元素
- 统一的可访问性标准
- 易于维护和更新

### Q: 会影响性能吗？

**A:**
- 指令方式几乎无性能影响
- Composable 使用 MutationObserver 有轻微开销，但现代浏览器性能优秀
- 建议优先使用指令方式

### Q: 能与现有的 cursor 样式共存吗？

**A:** 可以。指令会设置 `cursor: pointer`，但可以被更具体的选择器覆盖。

### Q: 移动端需要这个吗？

**A:** 移动端没有 hover，但仍有以下好处：
- 统一代码库
- 可访问性 (role, tabindex)
- 为触摸设备提供视觉反馈

---

## 相关文件

- **指令实现**: `src/directives/cursorPointer.ts`
- **Composable 实现**: `src/composables/useAutoCursor.ts`
- **UI/UX 审计报告**: `docs/UI_UX_AUDIT_DETAILED.md`
- **最佳实践文档**: `docs/UI_UX_QUICK_START.md`

---

## 更新日志

- **2025-01-10**: 初始版本，创建指令和 composable
- 解决 664 个 cursor-pointer 缺失问题
- 添加可访问性支持
- 添加 MutationObserver 自动检测
