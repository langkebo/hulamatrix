# HuLa 设计令牌系统

## 概述

HuLa 使用统一的设计令牌系统来确保整个应用的视觉一致性。设计令牌是存储设计决策的变量，包括颜色、间距、字体、动画等。

---

## 颜色系统

### 品牌颜色

```css
/* 主品牌色 */
--hula-brand-primary: #00BFA5;
--hula-brand-hover: #00E6C8;
--hula-brand-rgb: 0, 191, 165;

/* 浅色变体 */
--hula-brand-light: #4DDAD1;
--hula-brand-lighter: #80E7E1;

/* 深色变体 */
--hula-brand-dark: #00967A;
--hula-brand-darker: #006D58;
```

### 语义颜色

```css
/* 成功状态 */
--hula-success: #00B894;
--hula-success-light: #4DDBC6;
--hula-success-dark: #008A6F;

/* 警告状态 */
--hula-warning: #ff976a;
--hula-warning-light: #ffb899;
--hula-warning-dark: #cc7743;

/* 错误状态 */
--hula-error: #ee0a24;
--hula-error-light: #f45d6f;
--hula-error-dark: #bd081d;

/* 信息状态 */
--hula-info: #409EFF;
--hula-info-light: #7abbff;
--hula-info-dark: #337ecc;
```

### 中性色（灰度）

```css
/* 文本颜色 */
--hula-gray-900: #1a1a1a;  /* 主要文本 */
--hula-gray-700: #666666;  /* 次要文本 */
--hula-gray-500: #999999;  /* 辅助文本 */
--hula-gray-400: #cccccc;  /* 禁用文本 */

/* 背景颜色 */
--hula-gray-50:  #f9f9f9;  /* 主要背景 */
--hula-gray-100: #f5f5f5;  /* 次要背景 */
--hula-gray-200: #eeeeee;  /* 分割线/边框 */
--hula-gray-300: #e0e0e0;  /* 输入框边框 */

/* 边框颜色 */
--hula-border-light: #e2e8f0;
--hula-border-dark:  #334155;
```

### 功能颜色

```css
/* 链接 */
--link-color: #00BFA5;
--link-hover: #00967A;

/* 在线状态 */
--online-color:  #00B894;
--offline-color: #999999;
--busy-color:    #ee0a24;
--away-color:    #ff976a;
```

---

## 间距系统

### 基础间距单位

```css
--spacing-xs:   4px;   /* 0.25rem */
--spacing-sm:   8px;   /* 0.5rem */
--spacing-md:   16px;  /* 1rem */
--spacing-lg:   24px;  /* 1.5rem */
--spacing-xl:   32px;  /* 2rem */
--spacing-2xl:  48px;  /* 3rem */
--spacing-3xl:  64px;  /* 4rem */
```

### 组件间距

```css
/* 内边距 */
--padding-xs:  8px;
--padding-sm:  12px;
--padding-md:  16px;
--padding-lg:  24px;
--padding-xl:  32px;

/* 外边距 */
--margin-xs:  8px;
--margin-sm:  12px;
--margin-md:  16px;
--margin-lg:  24px;
--margin-xl:  32px;
```

---

## 字体系统

### 字体家族

```css
/* 主要字体 */
--font-family-base: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont,
                    'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;

/* 等宽字体（代码） */
--font-family-mono: 'Fira Code', 'Monaco', 'Consolas', 'Liberation Mono',
                    'Courier New', monospace;
```

### 字体大小

```css
--text-xs:   12px;  /* 辅助文本 */
--text-sm:   14px;  /* 小文本 */
--text-base: 16px;  /* 基础文本 */
--text-lg:   18px;  /* 大文本 */
--text-xl:   20px;  /* 标题 */
--text-2xl:  24px;  /* 大标题 */
--text-3xl:  30px;  /* 特大标题 */
--text-4xl:  36px;  /* 超大标题 */
```

### 字重

```css
--font-weight-light:   300;
--font-weight-normal:  400;
--font-weight-medium:  500;
--font-weight-semibold: 600;
--font-weight-bold:     700;
```

### 行高

```css
--leading-none:   1;
--leading-tight:  1.25;
--leading-normal: 1.5;
--leading-relaxed: 1.75;
--leading-loose:  2;
```

---

## 圆角系统

```css
--radius-none:   0;
--radius-sm:     4px;
--radius-md:     8px;
--radius-lg:     12px;
--radius-xl:     16px;
--radius-2xl:    24px;
--radius-full:   9999px;  /* 完全圆形 */
```

---

## 阴影系统

```css
/* 小阴影 */
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);

/* 默认阴影 */
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1),
             0 2px 4px -1px rgba(0, 0, 0, 0.06);

/* 大阴影 */
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1),
             0 4px 6px -2px rgba(0, 0, 0, 0.05);

/* 内阴影 */
--shadow-inner: inset 0 2px 4px 0 rgba(0, 0, 0, 0.06);

/* 无阴影 */
--shadow-none: 0 0 #0000;
```

---

## 动画系统

### 时长

```css
--duration-fast:   150ms;  /* 快速交互 */
--duration-base:   200ms;  /* 基础交互 */
--duration-slow:   300ms;  /* 慢速动画 */
--duration-slower: 500ms;  /* 特殊动画 */
```

**重要**: 避免使用超过 300ms 的动画时长，除非有特殊原因。

### 缓动函数

```css
--ease-linear:    linear;
--ease-in:        cubic-bezier(0.4, 0, 1, 1);
--ease-out:       cubic-bezier(0, 0, 0.2, 1);
--ease-in-out:    cubic-bezier(0.4, 0, 0.2, 1);
--ease-bounce:    cubic-bezier(0.68, -0.55, 0.265, 1.55);
```

**推荐**:
- 进入动画: `ease-out`
- 退出动画: `ease-in`
- 常规动画: `ease-in-out`

### 减少动画（无障碍）

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Z-Index 系统

```css
--z-dropdown:    1000;
--z-sticky:      1020;
--z-fixed:       1030;
--z-modal-back:  1040;
--z-modal:       1050;
--z-popover:     1060;
--z-tooltip:     1070;
--z-notification: 1080;
--z-max:         9999;
```

---

## 断点系统

```css
/* 断点值 */
--breakpoint-sm:  640px;
--breakpoint-md:  768px;
--breakpoint-lg:  1024px;
--breakpoint-xl:  1280px;
--breakpoint-2xl: 1536px;

/* 响应式前缀 */
--screen-sm: 'min-width: 640px';
--screen-md: 'min-width: 768px';
--screen-lg: 'min-width: 1024px';
--screen-xl: 'min-width: 1280px';
--screen-2xl: 'min-width: 1536px';
```

### 使用示例（SCSS）

```scss
// 使用 up 断点（最小宽度）
@include bp.up(md) {
  // 768px 及以上
}

// 使用 down 断点（最大宽度）
@include bp.down(md) {
  // 767px 及以下
}

// 使用 between 断点（范围）
@include bp.between(md, lg) {
  // 768px - 1023px
}
```

---

## 触摸目标尺寸（移动端）

### 最小触摸目标

```css
/* 最小触摸目标: 44px x 44px */
--touch-target-min: 44px;

/* 舒适触摸目标: 48px x 48px */
--touch-target-comfortable: 48px;
```

**应用示例**:

```css
.button {
  min-height: var(--touch-target-min);
  min-width: var(--touch-target-min);
  padding: 12px 24px;
}

.icon-button {
  width: var(--touch-target-min);
  height: var(--touch-target-min);
  display: flex;
  align-items: center;
  justify-content: center;
}
```

---

## 组件状态

### 悬停状态

```css
/* 推荐: 使用颜色/透明度变化 */
--hover-opacity: 0.9;
--hover-bg-lighten: rgba(255, 255, 255, 0.1);
--hover-bg-darken: rgba(0, 0, 0, 0.05);

/* 避免: 使用 scale 变换（会导致布局偏移） */
```

### 焦点状态

```css
--focus-ring: 0 0 0 3px rgba(0, 191, 165, 0.3);
--focus-ring-offset: 2px;
```

### 激活状态

```css
--active-scale: 0.98;
--active-opacity: 0.8;
```

### 禁用状态

```css
--disabled-opacity: 0.5;
--disabled-cursor: not-allowed;
```

---

## 使用指南

### 在 CSS 中使用

```css
.my-component {
  color: var(--hula-brand-primary);
  padding: var(--padding-md);
  border-radius: var(--radius-lg);
  transition: all var(--duration-base) var(--ease-in-out);
}
```

### 在 SCSS 中使用

```scss
@use '@/styles/tokens' as *;

.my-component {
  background: var(--hula-brand-primary);
  padding: spacing(md);
  border-radius: radius(lg);
}
```

### 在 Vue 组件中使用

```vue
<template>
  <div
    class="my-component"
    :style="{
      color: colors.brandPrimary,
      padding: spacing.md
    }"
  >
    Content
  </div>
</template>

<script setup lang="ts">
import { colors, spacing } from '@/styles/tokens'
</script>
```

---

## 最佳实践

### ✅ 推荐做法

1. **始终使用设计令牌**，而不是硬编码值
   ```css
   /* ✅ 好 */
   color: var(--hula-brand-primary);
   padding: var(--padding-md);

   /* ❌ 不好 */
   color: #00BFA5;
   padding: 16px;
   ```

2. **使用语义化令牌**，而不是原始颜色值
   ```css
   /* ✅ 好 */
   color: var(--hula-error);

   /* ❌ 不好 */
   color: #ee0a24;
   ```

3. **保持动画简短**
   ```css
   /* ✅ 好 */
   transition: all 200ms ease-out;

   /* ❌ 不好 */
   transition: all 1000ms ease-in-out;
   ```

4. **为所有交互元素提供反馈**
   ```css
   /* ✅ 好 */
   .button {
     cursor: pointer;
     transition: opacity 200ms ease;
   }
   .button:hover {
     opacity: 0.9;
   }

   /* ❌ 不好 */
   .button {
     /* 无悬停状态 */
   }
   ```

### ❌ 避免的做法

1. **不要使用 hover:scale**
   ```css
   /* ❌ 会导致布局偏移 */
   .item:hover {
     transform: scale(1.1);
   }

   /* ✅ 使用颜色变化 */
   .item:hover {
     opacity: 0.9;
     background: var(--hover-bg-lighten);
   }
   ```

2. **不要使用过长的动画**
   ```css
   /* ❌ 太慢 */
   transition: all 1000ms ease;

   /* ✅ 适中的速度 */
   transition: all 200ms ease;
   ```

3. **不要硬编码值**
   ```css
   /* ❌ 硬编码 */
   margin: 16px;
   font-size: 14px;

   /* ✅ 使用令牌 */
   margin: var(--spacing-md);
   font-size: var(--text-sm);
   ```

---

## 可访问性考虑

### 颜色对比度

所有文本必须满足 WCAG AA 标准:
- 正常文本: 最小 4.5:1 对比度
- 大文本 (18px+): 最小 3:1 对比度

### 触摸目标

移动端触摸目标最小 44px x 44px

### 焦点可见

所有交互元素必须有可见的焦点状态

### 减少动画

尊重 `prefers-reduced-motion` 设置

---

## 扩展指南

### 添加新颜色

1. 在 `src/styles/tokens/_colors.scss` 中定义
2. 更新此文档
3. 添加到 Storybook/设计系统展示

### 添加新间距

1. 在 `src/styles/tokens/_spacing.scss` 中定义
2. 确保遵循 8px 基础网格系统
3. 更新此文档

---

## 维护

- **文档版本**: 1.0.0
- **最后更新**: 2026-01-09
- **维护者**: HuLa Design Team

---

## 相关资源

- [UI/UX 审计报告](./UI_UX_AUDIT_REPORT.md)
- [组件开发指南](./COMPONENT_DEVELOPMENT_GUIDELINES.md)
- [Web Content Accessibility Guidelines (WCAG)](https://www.w3.org/WAI/WCAG21/quickref/)
