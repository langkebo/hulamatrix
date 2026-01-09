# HuLa 组件开发规范

> 基于 HuLa 统一设计系统的组件开发指南
> 更新日期：2026-01-09

---

## 目录

1. [设计原则](#设计原则)
2. [命名规范](#命名规范)
3. [色彩使用](#色彩使用)
4. [组件结构](#组件结构)
5. [响应式设计](#响应式设计)
6. [无障碍要求](#无障碍要求)
7. [性能优化](#性能优化)
8. [测试要求](#测试要求)

---

## 设计原则

### 1. 一致性优先

- **色彩统一**：始终使用 `var(--hula-*)` 变量
- **间距统一**：使用 `var(--spacing-*)` 变量
- **圆角统一**：使用 `var(--radius-*)` 变量
- **阴影统一**：使用 `var(--hula-shadow-*)` 变量

### 2. 移动优先

- **默认移动端**：从小屏幕开始设计
- **响应式增强**：为更大屏幕添加功能
- **触摸优化**：确保最小触摸目标 44x44px

### 3. 渐进增强

- **基础功能**：确保核心功能在所有设备可用
- **增强体验**：为现代浏览器添加动画和特效
- **优雅降级**：在不支持的浏览器中提供替代方案

### 4. 性能优先

- **懒加载**：大组件使用异步加载
- **虚拟滚动**：列表数据使用虚拟化
- **代码分割**：按路由拆分代码

---

## 命名规范

### 文件命名

```
组件文件：PascalCase
  例：MessageBubble.vue, ChatList.vue

样式文件：kebab-case
  例：message-bubble.scss, chat-input.scss

工具文件：kebab-case
  例：color-utils.ts, format-date.ts

常量文件：UPPER_CASE
  例：API_ENDPOINTS.ts, APP_CONFIG.ts
```

### CSS 类命名

使用 **BEM** (Block Element Modifier) 方法论：

```scss
// Block
.message-bubble { }

// Element
.message-bubble__content { }
.message-bubble__action { }

// Modifier
.message-bubble--sent { }
.message-bubble--received { }
.message-bubble--loading { }
```

### 变量命名

```typescript
// 组件状态：使用 use 开头的组合式函数
const isActive = ref(false)
const isLoading = computed(() => ...)

// 事件处理：使用 handle 开头
const handleClick = () => { }
const handleSubmit = () => { }

// 布尔值：使用 is/has/should 前缀
const isVisible = ref(true)
const hasError = ref(false)
const shouldShow = ref(true)

// 回调函数：使用 on 开头
const onConfirm = () => { }
const onCancel = () => { }
```

---

## 色彩使用

### 使用 CSS 变量

```vue
<style lang="scss" scoped>
.my-component {
  // ✅ 正确：使用 CSS 变量
  color: var(--hula-text-primary);
  background: var(--hula-bg-component);
  border-color: var(--hula-border);

  // ❌ 错误：硬编码颜色值
  color: #13987f;
  background: #f0f0f0;
  border-color: #e0e0e0;
}
</style>
```

### 透明度处理

```scss
// ✅ 正确：使用 rgba 变量或 color-mix
.background {
  background: var(--hula-brand-rgba-10); // 10% 透明度
  background: color-mix(in srgb, var(--hula-brand-primary) 90%, transparent);
}

// ❌ 错误：硬编码 rgba 值
.background {
  background: rgba(19, 152, 127, 0.1);
}
```

### 状态色彩

```vue
<style lang="scss" scoped>
// 成功状态
.success-state {
  color: var(--hula-success);
  border-color: var(--hula-success);
}

// 错误状态
.error-state {
  color: var(--hula-error);
  border-color: var(--hula-error);
}

// 警告状态
.warning-state {
  color: var(--hula-warning);
  border-color: var(--hula-warning);
}
</style>
```

---

## 组件结构

### 标准组件模板

```vue
<template>
  <div
    class="my-component"
    :class="componentClasses"
    v-bind="attrs"
  >
    <!-- 组件内容 -->
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import type { ComponentProps } from './types'

// 定义 Props
interface Props {
  // Props 定义
  variant?: 'primary' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  disabled: false
})

// 定义 Emits
interface Emits {
  click: [event: MouseEvent]
}

const emit = defineEmits<Emits>()

// 获取属性
const attrs = useAttrs()

// 计算属性
const componentClasses = computed(() => [
  `my-component--${props.variant}`,
  `my-component--${props.size}`,
  { 'my-component--disabled': props.disabled }
])

// 方法
const handleClick = (event: MouseEvent) => {
  if (!props.disabled) {
    emit('click', event)
  }
}
</script>

<style lang="scss" scoped>
@import '@/styles/scss/responsive' as responsive;

.my-component {
  // 基础样式
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  background: var(--hula-bg-component);

  // 变体样式
  &--primary {
    background: var(--hula-brand-primary);
    color: #FFFFFF;
  }

  &--secondary {
    background: transparent;
    color: var(--hula-brand-primary);
    border: 2px solid var(--hula-brand-primary);
  }

  // 尺寸变体
  &--sm {
    padding: var(--spacing-sm);
    font-size: var(--font-size-sm);
  }

  &--lg {
    padding: var(--spacing-lg);
    font-size: var(--font-size-lg);
  }

  // 状态样式
  &--disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  // 响应式
  @include responsive.down(md) {
    padding: var(--spacing-sm);
  }
}
</style>
```

### Props 定义规范

```typescript
// ✅ 正确：详细的 Props 定义和注释
interface Props {
  /** 组件显示的文本 */
  label: string

  /** 组件变体 */
  variant?: 'primary' | 'secondary' | 'ghost'

  /** 组件尺寸 */
  size?: 'sm' | 'md' | 'lg'

  /** 是否禁用 */
  disabled?: boolean

  /** 点击回调 */
  onClick?: () => void
}

// ❌ 错误：缺少类型和注释
defineProps({
  label: String,
  variant: String,
  size: String
})
```

### 事件定义规范

```typescript
// ✅ 正确：使用 TypeScript 接口定义事件
interface Emits {
  /** 点击事件 */
  click: [event: MouseEvent]

  /** 值改变事件 */
  'update:modelValue': [value: string]

  /** 自定义事件 */
  custom: [payload: { id: string; data: unknown }]
}

const emit = defineEmits<Emits>()

// ❌ 错误：使用字符串字面量
const emit = defineEmits(['click', 'update:modelValue', 'custom'])
```

---

## 响应式设计

### 使用响应式工具类

```vue
<template>
  <div>
    <!-- ✅ 正确：使用工具类 -->
    <aside class="sidebar u-hide-mobile">
      桌面端侧边栏
    </aside>

    <div class="main-content u-mobile-full-width">
      主要内容
    </div>

    <button class="btn-brand u-touch-target">
      按钮
    </button>
  </div>
</template>
```

### 响应式混合器

```scss
// 在 SCSS 中使用响应式混合器
@import '@/styles/scss/responsive' as responsive;

.component {
  // 基础样式（移动端）
  padding: 16px;
  font-size: 14px;

  // 平板及以上
  @include responsive.up(md) {
    padding: 24px;
    font-size: 16px;
  }

  // 桌面及以上
  @include responsive.up(xl) {
    padding: 32px;
    font-size: 18px;
  }
}
```

### 响应式图片

```vue
<template>
  <picture>
    <!-- 移动端图片 -->
    <source
      media="(max-width: 768px)"
      srcset="image-mobile.webp"
    />
    <!-- 桌面端图片 -->
    <source
      media="(min-width: 769px)"
      srcset="image-desktop.webp"
    />
    <!-- 后备方案 -->
    <img
      src="image-desktop.jpg"
      alt="描述文本"
      loading="lazy"
    />
  </picture>
</template>
```

---

## 无障碍要求

### 语义化 HTML

```vue
<template>
  <!-- ✅ 正确：使用语义化标签 -->
  <nav aria-label="主导航">
    <ul>
      <li><a href="/home">首页</a></li>
      <li><a href="/about">关于</a></li>
    </ul>
  </nav>

  <!-- ❌ 错误：使用 div 模拟 -->
  <div class="nav">
    <div class="nav-item" onclick="goHome()">首页</div>
  </div>
</template>
```

### ARIA 属性

```vue
<template>
  <!-- 按钮 -->
  <button
    :aria-pressed="isActive"
    :aria-label="isActive ? '已激活' : '未激活'"
    @click="toggle"
  >
    切换
  </button>

  <!-- 展开面板 -->
  <button
    :aria-expanded="isExpanded"
    aria-controls="panel-1"
    @click="toggle"
  >
    {{ isExpanded ? '收起' : '展开' }}
  </button>

  <div
    id="panel-1"
    role="region"
    aria-live="polite"
    v-show="isExpanded"
  >
    面板内容
  </div>

  <!-- 表单 -->
  <label for="email">邮箱</label>
  <input
    id="email"
    type="email"
    required
    aria-invalid="hasError"
    aria-describedby="email-error"
  />
  <span
    id="email-error"
    role="alert"
    v-show="hasError"
  >
    {{ errorMessage }}
  </span>

  <!-- 加载状态 -->
  <div
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    加载中...
  </div>
</template>
```

### 键盘导航

```vue
<script setup lang="ts">
const handleKeydown = (event: KeyboardEvent) => {
  // Escape 键关闭
  if (event.key === 'Escape') {
    close()
  }

  // Enter 键确认
  if (event.key === 'Enter') {
    confirm()
  }

  // 方向键导航
  if (event.key === 'ArrowDown') {
    nextItem()
  }
}
</script>

<template>
  <div
    tabindex="0"
    @keydown="handleKeydown"
  >
    可聚焦的内容
  </div>
</template>
```

### 焦点管理

```scss
// ✅ 正确：清晰的焦点指示
:focus-visible {
  outline: 2px solid var(--hula-brand-primary);
  outline-offset: 2px;
  border-radius: 4px;
}

// ❌ 错误：移除所有焦点样式
:focus {
  outline: none;
}
```

---

## 性能优化

### 组件懒加载

```vue
<script setup lang="ts">
// ✅ 异步组件加载
const HeavyComponent = defineAsyncComponent(() =>
  import('./HeavyComponent.vue')
)

// ✅ 带加载状态的异步组件
const AsyncComponent = defineAsyncComponent({
  loader: () => import('./AsyncComponent.vue'),
  loadingComponent: LoadingSpinner,
  delay: 200,
  timeout: 3000
})
</script>
```

### 列表虚拟化

```vue
<script setup lang="ts">
import { useVirtualList } from '@/hooks/useVirtualList'

const { containerRef, listProps } = useVirtualList({
  items: largeList,
  itemHeight: 80,
  overscan: 5
})
</script>

<template>
  <div ref="containerRef" style="height: 500px; overflow: auto;">
    <div v-bind="listProps">
      <div
        v-for="item in items"
        :key="item.id"
        :style="{ height: '80px' }"
      >
        {{ item.content }}
      </div>
    </div>
  </div>
</template>
```

### 图片优化

```vue
<template>
  <!-- ✅ 正确：使用懒加载和适当的尺寸 -->
  <img
    :src="imageUrl"
    :srcset="`${imageUrl}@2x 2x, ${imageUrl}@3x 3x`"
    :sizes="(max-width: 768px) 100vw, 50vw"
    loading="lazy"
    decoding="async"
    alt="图片描述"
    width="800"
    height="600"
  />

  <!-- ✅ 使用 Picture 组件 -->
  <picture>
    <source
      :srcset="imageUrlWebp"
      type="image/webp"
    />
    <img
      :src="imageUrlJpg"
      :alt="altText"
      loading="lazy"
    />
  </picture>
</template>
```

---

## 测试要求

### 单元测试

```typescript
// 组件单元测试示例
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MyComponent from './MyComponent.vue'

describe('MyComponent', () => {
  it('应该正确渲染默认状态', () => {
    const wrapper = mount(MyComponent)
    expect(wrapper.classes()).toContain('my-component')
  })

  it('应该响应 props 变化', async () => {
    const wrapper = mount(MyComponent, {
      props: { disabled: false }
    })

    await wrapper.setProps({ disabled: true })
    expect(wrapper.classes()).toContain('my-component--disabled')
  })

  it('应该在点击时触发事件', async () => {
    const wrapper = mount(MyComponent)

    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeTruthy()
  })

  it('应该在禁用状态下不触发事件', async () => {
    const wrapper = mount(MyComponent, {
      props: { disabled: true }
    })

    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeFalsy()
  })
})
```

### 无障碍测试

```typescript
// 无障碍测试示例
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/vue'
import MyComponent from './MyComponent.vue'

describe('MyComponent - 无障碍', () => {
  it('应该有正确的 ARIA 属性', () => {
    const { getByRole } = render(MyComponent, {
      props: { expanded: true }
    })

    const button = getByRole('button')
    expect(button).toHaveAttribute('aria-expanded', 'true')
  })

  it('应该支持键盘导航', () => {
    const { getByRole } = render(MyComponent)

    const button = getByRole('button')
    expect(button).toHaveAttribute('tabindex', '0')
  })

  it('应该有 alt 文本', () => {
    const { getByAltText } = render(MyComponent, {
      props: { imageSrc: 'test.jpg' }
    })

    const img = getByAltText(/描述/)
    expect(img).toBeTruthy()
  })
})
```

---

## 快速检查清单

在提交代码前，请确认：

- [ ] 使用 `var(--hula-*)` 变量而非硬编码颜色
- [ ] 响应式工具类已正确应用
- [ ] 触摸目标符合最小尺寸要求（44x44px）
- [ ] 交互元素支持键盘导航
- [ ] 正确的 ARIA 属性已添加
- [ ] 组件有适当的 focus-visible 样式
- [ ] 图片有 alt 文本
- [ ] 表单有关联的 label
- [ ] 单元测试已编写
- [ ] 类型检查通过（`pnpm run typecheck`）

---

## 相关资源

- **设计系统展示**：访问 `/home/design-system` 查看完整示例
- **优化文档**：查看 `docs/UI_UX_OPTIMIZATION_SUMMARY.md`
- **迁移脚本**：运行 `node scripts/migrate-colors.js --check`

---

## 更新日志

- **2026-01-09**：创建初始规范文档
- 包含统一色彩系统使用指南
- 响应式设计最佳实践
- 无障碍开发要求
