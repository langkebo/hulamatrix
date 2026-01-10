# HuLa UI/UX 最佳实践指南

本文档提供 HuLa Matrix 项目中 UI/UX 开发的最佳实践指南，确保一致的用户体验和代码质量。

---

## 目录

1. [设计系统](#设计系统)
2. [交互反馈](#交互反馈)
3. [动画与过渡](#动画与过渡)
4. [可访问性](#可访问性)
5. [响应式设计](#响应式设计)
6. [性能优化](#性能优化)
7. [组件开发规范](#组件开发规范)
8. [常见反模式](#常见反模式)

---

## 设计系统

### 使用设计令牌 (Design Tokens)

**✅ 推荐:** 使用 CSS 变量定义的标准化设计令牌

```scss
/* 间距 - 基于 8px 网格 */
padding: var(--hula-spacing-sm);      // 8px
padding: var(--hula-spacing-md);      // 16px
padding: var(--hula-spacing-lg);      // 24px
gap: var(--hula-spacing-md);          // 16px

/* 字体大小 */
font-size: var(--hula-text-xs);       // 12px
font-size: var(--hula-text-sm);       // 14px
font-size: var(--hula-text-base);     // 16px

/* 边框宽度 */
border: var(--hula-border-thin) solid var(--n-border-color);     // 1px
border: var(--hula-border-base) solid var(--n-border-color);     // 2px

/* 边框半径 */
border-radius: var(--hula-radius-sm);  // 4px
border-radius: var(--hula-radius-md);  // 8px
border-radius: var(--hula-radius-xl);  // 16px
border-radius: var(--hula-radius-round);  // 9999px
```

**❌ 避免:** 硬编码的魔数

```scss
/* 不推荐 */
padding: 7px;
font-size: 13px;
border-radius: 9px;
```

### 颜色使用规范

**✅ 推荐:** 使用语义化的 CSS 变量

```scss
/* 品牌色 */
color: var(--hula-brand-primary);
background: rgba(var(--hula-brand-rgb), 0.1);

/* 语义色 */
color: var(--hula-success);
color: var(--hula-warning);
color: var(--hula-error);

/* 文本颜色 */
color: var(--text-color);  /* 自动适配明暗模式 */
```

**❌ 避免:** 硬编码颜色值

```scss
/* 不推荐 */
color: #1890ff;
background: rgba(24, 144, 226, 0.1);
```

---

## 交互反馈

### Cursor Pointer

所有可点击元素必须有明确的视觉反馈。

**✅ 推荐:** 使用 `v-cursor-pointer` 指令

```vue
<template>
  <div v-cursor-pointer @click="handleClick">
    点击我
  </div>
</template>
```

**或者使用 Composable:**

```vue
<script setup>
import { useAutoCursor } from '@/composables/useAutoCursor'
const containerRef = ref(null)
onMounted(() => {
  useAutoCursor(containerRef.value)
})
</script>

<template>
  <div ref="containerRef" @click="handleClick">
    点击我
  </div>
</template>
```

**❌ 避免:** 手动添加 cursor 样式（容易遗漏）

```vue
<!-- 不推荐 -->
<div @click="handleClick">点击我</div>
```

### Hover 状态

**✅ 推荐:** 使用 opacity 而非 scale

```scss
.button {
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 0.8;  /* 推荐: 不改变布局 */
  }

  &:active {
    opacity: 0.6;
  }
}
```

**❌ 避免:** 使用 scale 导致布局跳动

```scss
/* 不推荐 */
.button {
  &:hover {
    transform: scale(1.05);  /* 会导致布局跳动 */
  }

  &:active {
    transform: scale(0.95);
  }
}
```

### Focus 可见性

**✅ 推荐:** 明确的焦点指示

```scss
/* 使用全局样式，默认已提供 */
:focus-visible {
  outline: 2px solid var(--hula-brand-primary);
  outline-offset: 2px;
}
```

---

## 动画与过渡

### 动画时长

遵循 WCAG 指导原则，动画时长在 **150-300ms** 之间：

| 场景 | 推荐时长 | 说明 |
|------|---------|------|
| 微交互（按钮、链接） | 150-200ms | 快速反馈 |
| 标准过渡（显示/隐藏） | 200-250ms | 平衡体验 |
| 复杂动画（模态框、页面） | 250-300ms | 视觉舒适 |
| 装饰性动画 | 避免或最短 | 避免干扰 |

**✅ 推荐:**

```scss
.transition {
  transition: opacity 0.2s ease;           /* 200ms - 推荐 */
  transition: all 0.25s cubic-bezier(...); /* 250ms - 可接受 */
}
```

**❌ 避免:**

```scss
/* 不推荐 */
.transition {
  transition: opacity 0.4s ease;    /* 太慢 */
  transition: all 0.8s ease;        /* 严重影响体验 */
}
```

### 过渡属性

**✅ 推荐:** 明确指定过渡属性

```scss
/* 推荐: 仅过渡需要的属性 */
.button {
  transition: opacity 0.2s ease, background-color 0.2s ease;
}

/* 推荐: 常用组合 */
.fade {
  transition: opacity 0.2s ease;
}

.slide {
  transition: transform 0.2s ease;
}
```

**❌ 避免:** 使用 `all` 过渡所有属性

```scss
/* 不推荐 */
.button {
  transition: all 0.2s ease;  /* 性能差，难以预测 */
}
```

### Easing 函数

| Easing | 适用场景 | CSS 值 |
|--------|---------|--------|
| Ease | 标准过渡 | `ease` |
| Ease In | 进入视图 | `ease-in` |
| Ease Out | 退出视图 | `ease-out` |
| Ease In Out | 往返动画 | `ease-in-out` |
| Custom | 品牌/强调 | `cubic-bezier(0.4, 0, 0.2, 1)` |

**✅ 推荐:**

```scss
/* Material Design 标准 */
transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

/* iOS 风格 */
transition: all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1);
```

---

## 可访问性

### ARIA 属性

**✅ 推荐:** 适当的 ARIA 标签

```vue
<template>
  <!-- 按钮应有明确标签 -->
  <button @click="handleClose" aria-label="关闭对话框">
    <svg aria-hidden="true"><use href="#close"></use></svg>
  </button>

  <!-- 加载状态 -->
  <div :aria-busy="loading">
    <span v-if="loading">加载中...</span>
  </div>

  <!-- 展开/折叠 -->
  <button
    :aria-expanded="isExpanded"
    aria-controls="content-panel">
    {{ isExpanded ? '收起' : '展开' }}
  </button>
  <div id="content-panel" :hidden="!isExpanded">
    内容...
  </div>
</template>
```

### 屏幕阅读器

**✅ 推荐:** 为屏幕阅读器提供上下文

```vue
<template>
  <!-- 仅屏幕阅读器可见 -->
  <span class="sr-only">必填字段</span>

  <!-- 图标按钮应有文字说明 -->
  <button aria-label="删除项目">
    <svg aria-hidden="true"><use href="#delete"></use></svg>
  </button>

  <!-- 状态变化通知 -->
  <div role="status" aria-live="polite">
    {{ statusMessage }}
  </div>
</template>
```

### 键盘导航

**✅ 推荐:** 确保所有交互可通过键盘访问

```vue
<template>
  <!-- 使用语义化元素 -->
  <button @click="handleClick">点击</button>

  <!-- 或添加 role 和 tabindex -->
  <div
    role="button"
    tabindex="0"
    @click="handleClick"
    @keydown.enter="handleClick"
    @keydown.space.prevent="handleClick">
    点击
  </div>
</template>
```

### Reduced Motion 支持

**✅ 推荐:** 尊重用户的动画偏好

```scss
/* 使用全局样式（已内置在 accessibility.scss） */
/* 如果需要自定义动画，添加条件类 */
@media (prefers-reduced-motion: no-preference) {
  .my-animation {
    animation: slideIn 0.3s ease;
  }
}
```

---

## 响应式设计

### 断点系统

```scss
/* 项目断点 */
$breakpoint-mobile: 640px;
$breakpoint-tablet: 768px;
$breakpoint-desktop: 1024px;
$breakpoint-wide: 1280px;

/* 使用方法 */
@media (min-width: $breakpoint-tablet) {
  /* 平板及以上样式 */
}
```

### 移动优先

**✅ 推荐:** 移动优先的响应式设计

```scss
/* 默认移动端样式 */
.container {
  padding: var(--hula-spacing-sm);
  font-size: var(--hula-text-sm);
}

/* 逐步增强到桌面端 */
@media (min-width: 768px) {
  .container {
    padding: var(--hula-spacing-md);
    font-size: var(--hula-text-base);
  }
}
```

### 触摸目标尺寸

**✅ 推荐:** 最小 44x44px 触摸目标（WCAG 2.5.5）

```scss
.button {
  min-height: 44px;
  min-width: 44px;
  padding: 10px 16px;
}
```

---

## 性能优化

### 渲染性能

**✅ 推荐:** 使用 GPU 加速的属性

```scss
/* 推荐: GPU 加速 */
.animate {
  transform: translateX(100px);
  opacity: 0.8;
  filter: blur(5px);
}

/* 不推荐: 触发重排 */
.animate {
  left: 100px;
  width: 200px;
}
```

### 图片优化

**✅ 推荐:** 使用适当的图片格式和尺寸

```vue
<template>
  <!-- 响应式图片 -->
  <img
    :src="imageSrc"
    :srcset="`${imageSrc}?w=400 400w, ${imageSrc}?w=800 800w`"
    sizes="(max-width: 768px) 400px, 800px"
    :alt="imageAlt"
    loading="lazy">

  <!-- 或使用组件 -->
  <n-image
    :src="imageSrc"
    :alt="imageAlt"
    object-fit="cover" />
</template>
```

### 代码分割

**✅ 推荐:** 懒加载非关键组件

```vue
<script setup>
// 路由级代码分割（自动）
const RouterView = defineAsyncComponent(() => import('@/views/Detail.vue'))

// 条件性组件加载
const HeavyComponent = defineAsyncComponent(() =>
  import('@/components/HeavyComponent.vue')
)
</script>
```

---

## 组件开发规范

### 组件结构

```vue
<template>
  <!-- 1. 模板注释 -->
  <div class="component-name">
    <!-- 使用语义化类名 -->
  </div>
</template>

<script setup lang="ts">
// 2. 导入
import { ref, computed, onMounted } from 'vue'

// 3. Props 定义
interface Props {
  modelValue: string
  disabled?: boolean
}
const props = withDefaults(defineProps<Props>(), {
  disabled: false
})

// 4. Emits 定义
interface Emits {
  'update:modelValue': [value: string]
  'submit': []
}
const emit = defineEmits<Emits>()

// 5. 响应式状态
const state = ref('')

// 6. 计算属性
const computedValue = computed(() => props.modelValue)

// 7. 方法
const handleSubmit = () => {
  emit('submit')
}

// 8. 生命周期
onMounted(() => {
  // 初始化
})
</script>

<style scoped lang="scss">
/* 9. 样式 */
.component-name {
  /* 使用 BEM 或其他命名约定 */
  &__element {
    // 元素样式
  }

  &--modifier {
    // 修饰符样式
  }
}
</style>
```

### 类名规范

**✅ 推荐:** 使用 BEM 或 Utility-First

```scss
/* BEM 风格 */
.card {
  &__header {
    // 头部样式
  }

  &__body {
    // 主体样式
  }

  &--featured {
    // 特色卡片样式
  }
}

/* Utility-First (UnoCSS) */
<div class="flex items-center gap-2 p-4 rounded-lg">
```

---

## 常见反模式

### ❌ 反模式 1: Hover Scale

```scss
/* 不推荐 */
.button:hover {
  transform: scale(1.1);  /* 布局跳动 */
}

/* 推荐 */
.button:hover {
  opacity: 0.8;  /* 无布局影响 */
}
```

### ❌ 反模式 2: 硬编码颜色

```scss
/* 不推荐 */
.button {
  background: #1890ff;
}

/* 推荐 */
.button {
  background: var(--hula-brand-primary);
}
```

### ❌ 反模式 3: 过长动画

```scss
/* 不推荐 */
.modal {
  transition: all 0.8s ease;  /* 太慢 */
}

/* 推荐 */
.modal {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
```

### ❌ 反模式 4: 缺少 Cursor Pointer

```vue
<!-- 不推荐 -->
<div @click="handleClick">点击</div>

<!-- 推荐 -->
<div v-cursor-pointer @click="handleClick">点击</div>
```

### ❌ 反模式 5: 非标准间距

```scss
/* 不推荐 */
.card {
  padding: 13px;
  gap: 11px;
}

/* 推荐 */
.card {
  padding: var(--hula-spacing-md);  /* 16px */
  gap: var(--hula-spacing-sm);      /* 8px */
}
```

---

## 检查清单

在提交代码前，确保：

- [ ] 所有可点击元素有 `cursor-pointer` (使用 `v-cursor-pointer`)
- [ ] Hover 状态使用 `opacity` 而非 `scale`
- [ ] 动画时长在 150-300ms 之间
- [ ] 使用设计令牌（CSS 变量）而非硬编码值
- [ ] 图片有适当的 `alt` 属性
- [ ] 表单元素有关联的 `label`
- [ ] 焦点状态清晰可见
- [ ] 支持 `prefers-reduced-motion`
- [ ] 触摸目标最小 44x44px
- [ ] 颜色对比度符合 WCAG AA 标准

---

## 相关文档

- [设计令牌参考](../src/styles/scss/global/theme-variables.scss)
- [可访问性样式](../src/styles/scss/global/accessibility.scss)
- [UI/UX 工具类](../src/styles/scss/global/ui-ux-utilities.scss)
- [Cursor Pointer 指南](./CURSOR_POINTER_GUIDE.md)
- [UI/UX 审计报告](./UI_UX_AUDIT_DETAILED.md)
- [快速开始指南](./UI_UX_QUICK_START.md)

---

## 更新日志

- **2025-01-10**: 初始版本，基于 ui-ux-pro-max 技能指导
- 汇总项目 UI/UX 优化经验
- 提供 cursor-pointer 自动化解决方案
- 添加 prefers-reduced-motion 支持
- 标准化设计令牌使用
