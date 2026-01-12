# HuLa Design System Documentation

> Comprehensive UI/UX Design System for HuLa Matrix Messaging Application
> Version 2.1 - Updated 2026-01-12

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Design Tokens](#design-tokens)
- [Components](#components)
- [Hooks & Composables](#hooks--composables)
- [Theming](#theming)
- [Accessibility](#accessibility)
- [Performance](#performance)
- [Best Practices](#best-practices)

---

## Overview

The HuLa Design System is a comprehensive Vue 3 + TypeScript component library built with:

- **Vue 3 Composition API** with `<script setup>` syntax
- **TypeScript** for full type safety
- **SCSS** with CSS custom properties for theming
- **Accessibility-first** approach (WCAG 2.1 AA compliant)
- **Mobile-responsive** design
- **Dark mode** support out of the box

### Key Features

| Feature | Description |
|---------|-------------|
| **Theme System** | Light/dark/system modes with persistent storage |
| **Glassmorphism** | Modern glass effects with backdrop blur |
| **Virtual Scrolling** | Efficient rendering for long lists |
| **Lazy Loading** | Images and components load on demand |
| **Performance Monitoring** | Built-in FPS and memory tracking |
| **Accessibility** | ARIA, keyboard navigation, screen reader support |

---

## Installation

### Prerequisites

```json
{
  "vue": "^3.4.0",
  "typescript": "^5.0.0",
  "sass": "^1.70.0"
}
```

### Setup

```typescript
// main.ts
import { createApp } from 'vue'
import { initTheme } from '@/composables/useThemeProvider'
import App from './App.vue'

const app = createApp(App)

// Initialize theme system
initTheme()

app.mount('#app')
```

### Import SCSS

```scss
// styles/main.scss
@import './tokens/variables.scss';
@import './tokens/colors-unified.scss';
@import './tokens/spacing.scss';
@import './tokens/animations-theme.scss';
```

---

## Design Tokens

### Color Tokens

#### Brand Colors

```scss
// Primary brand color (deep green)
--hula-brand-primary: #13987F;
--hula-brand-primary-hover: #0E6B58;
--hula-brand-primary-active: #0B5A48;

// Secondary brand color (light green)
--hula-brand-secondary: #4CAF50;

// Accent color (gold)
--hula-brand-accent: #FFD700;
```

#### Functional Colors

```scss
--hula-success: #10b981;
--hula-warning: #f59e0b;
--hula-error: #ef4444;
--hula-info: #3b82f6;
```

#### Text Colors

```scss
--hula-text-primary: #1E293B;
--hula-text-secondary: #64748B;
--hula-text-tertiary: #94A3B8;
--hula-text-disabled: #CBD5E1;
```

#### Background Colors

```scss
--hula-bg-primary: #FFFFFF;
--hula-bg-secondary: #F8FAFC;
--hula-bg-tertiary: #F1F5F9;
--hula-bg-elevated: #FFFFFF;
```

### Spacing Tokens

```scss
// Spacing scale (4px base unit)
--spacing-xs: 4px;
--spacing-sm: 8px;
--spacing-md: 12px;
--spacing-lg: 16px;
--spacing-xl: 24px;
--spacing-2xl: 32px;
--spacing-3xl: 48px;
```

### Shadow Tokens

```scss
--hula-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
--hula-shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
--hula-shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
--hula-shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.1);
```

---

## Components

### Button Components

#### PrimaryButton

Main call-to-action button with brand color.

```vue
<template>
  <PrimaryButton @click="handleClick">
    Save Changes
  </PrimaryButton>

  <!-- With loading state -->
  <PrimaryButton :loading="isSaving">
    Saving...
  </PrimaryButton>

  <!-- Disabled state -->
  <PrimaryButton disabled>
    Cannot Submit
  </PrimaryButton>
</template>

<script setup lang="ts">
import PrimaryButton from '@/components/shared/buttons/PrimaryButton.vue'

const handleClick = () => {
  console.log('Button clicked')
}
</script>
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'primary' \| 'secondary' \| 'danger'` | `'primary'` | Button style variant |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Button size |
| `loading` | `boolean` | `false` | Show loading spinner |
| `disabled` | `boolean` | `false` | Disable button |
| `block` | `boolean` | `false` | Full width button |

#### SecondaryButton

Secondary action button.

```vue
<SecondaryButton @click="handleCancel">
  Cancel
</SecondaryButton>
```

#### IconButton

Icon-only button with tooltip.

```vue
<template>
  <IconButton
    icon="heroicons:trash"
    :tooltip="'Delete item'"
    @click="handleDelete"
  />
</template>

<script setup lang="ts">
import IconButton from '@/components/shared/buttons/IconButton.vue'

const handleDelete = () => {
  // Delete logic
}
</script>
```

### Card Components

#### GlassCard

Glassmorphism card with blur effect.

```vue
<template>
  <!-- Default glass card -->
  <GlassCard>
    <h3>Card Title</h3>
    <p>Card content with glass effect</p>
  </GlassCard>

  <!-- Brand variant with hover -->
  <GlassCard variant="brand" hoverable clickable @click="handleClick">
    <h3>Interactive Card</h3>
  </GlassCard>

  <!-- Strong glass effect -->
  <GlassCard variant="strong" :blur="30">
    High blur effect card
  </GlassCard>

  <!-- Custom opacity -->
  <GlassCard :opacity="0.9" :border-opacity="0.2">
    Custom opacity card
  </GlassCard>
</template>

<script setup lang="ts">
import GlassCard from '@/components/common/GlassCard.vue'
</script>
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'default' \| 'subtle' \| 'strong' \| 'brand'` | `'default'` | Glass effect variant |
| `blur` | `number` | `20` | Blur amount in pixels |
| `opacity` | `number` | `0.7` | Background opacity (0-1) |
| `borderWidth` | `number` | `1` | Border width in pixels |
| `borderOpacity` | `number` | `0.1` | Border opacity (0-1) |
| `hoverable` | `boolean` | `false` | Enable hover effect |
| `clickable` | `boolean` | `false` | Make card clickable |
| `rounded` | `boolean \| string` | `true` | Border radius |
| `shadow` | `'none' \| 'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'` | Shadow intensity |

### Performance Components

#### VirtualList

Efficient virtual scrolling for long lists.

```vue
<template>
  <VirtualList
    :items="largeDataSet"
    :item-height="60"
    :overscan="5"
    @load-more="loadMoreData"
  >
    <template #default="{ item, index }">
      <div class="list-item">
        {{ item.name }}
      </div>
    </template>

    <template #loading>
      <div>Loading more items...</div>
    </template>
  </VirtualList>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import VirtualList from '@/components/common/VirtualList.vue'

const largeDataSet = ref([]) // Your large data set

const loadMoreData = () => {
  // Load more items
}
</script>
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `items` | `unknown[]` | `[]` | Data items to render |
| `itemHeight` | `number \| function` | `50` | Height of each item |
| `overscan` | `number` | `3` | Extra items to render |
| `height` | `number \| string` | `'100%'` | Container height |
| `loadMoreThreshold` | `number` | `200` | Distance from bottom to trigger load more |

#### LazyImage

Progressive image loading with placeholder.

```vue
<template>
  <!-- Basic lazy loading -->
  <LazyImage
    src="/path/to/image.jpg"
    alt="Description"
    :width="300"
    :height="200"
  />

  <!-- With skeleton placeholder -->
  <LazyImage
    src="/path/to/image.jpg"
    alt="Description"
    :skeleton="true"
    @load="handleImageLoad"
    @error="handleImageError"
  />

  <!-- Background image variant -->
  <LazyImage
    src="/path/to/image.jpg"
    :background="true"
    fit="cover"
  />
</template>

<script setup lang="ts">
import LazyImage from '@/components/common/LazyImage.vue'

const handleImageLoad = () => {
  console.log('Image loaded')
}

const handleImageError = () => {
  console.log('Image failed to load')
}
</script>
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `src` | `string` | - | Image source URL |
| `alt` | `string` | `''` | Alt text for accessibility |
| `width` | `number \| string` | `'100%'` | Image width |
| `height` | `number \| string` | `'auto'` | Image height |
| `fit` | `'contain' \| 'cover' \| 'fill' \| 'none' \| 'scale-down'` | `'cover'` | Object fit |
| `threshold` | `number` | `0.01` | Intersection threshold |
| `skeleton` | `boolean` | `true` | Show skeleton placeholder |
| `delay` | `number` | `0` | Delay before loading (ms) |

#### LazyComponent

Code splitting wrapper for heavy components.

```vue
<template>
  <LazyComponent
    :component="asyncComponent"
    :delay="200"
    :load-on-visible="true"
    @loaded="handleComponentLoaded"
  >
    <template #fallback>
      <Skeleton />
    </template>
    <template #skeleton>
      <Skeleton :width="100" :height="200" variant="rectangular" />
    </template>
  </LazyComponent>
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import LazyComponent from '@/components/common/LazyComponent.vue'
import Skeleton from '@/components/common/Skeleton.vue'

const asyncComponent = defineAsyncComponent(() =>
  import('./HeavyComponent.vue')
)

const handleComponentLoaded = () => {
  console.log('Component loaded')
}
</script>
```

### Loading Components

#### Skeleton

Skeleton placeholder for loading states.

```vue
<template>
  <!-- Text skeleton -->
  <Skeleton :width="200" :height="16" variant="text" />

  <!-- Rectangular skeleton -->
  <Skeleton :width="100" :height="100" variant="rectangular" :animate="true" />

  <!-- Circular skeleton -->
  <Skeleton :width="40" :height="40" variant="circular" />

  <!-- Custom animation -->
  <Skeleton :width="150" :height="20" variant="text" animation="pulse" />
</template>

<script setup lang="ts">
import Skeleton from '@/components/common/Skeleton.vue'
</script>
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'text' \| 'rectangular' \| 'circular'` | `'text'` | Skeleton shape |
| `width` | `number \| string` | `'100%'` | Skeleton width |
| `height` | `number \| string` | `'auto'` | Skeleton height |
| `animate` | `boolean` | `true` | Enable shimmer animation |
| `animation` | `'wave' \| 'pulse'` | `'wave'` | Animation type |

#### LoadingState

Animated loading indicators.

```vue
<template>
  <!-- Dots animation -->
  <LoadingState type="dots" size="md" />

  <!-- Spinner animation -->
  <LoadingState type="spinner" size="lg" />

  <!-- Bar animation -->
  <LoadingState type="bar" size="sm" />

  <!-- Custom color -->
  <LoadingState type="dots" color="#13987F" />
</template>

<script setup lang="ts">
import LoadingState from '@/components/common/LoadingState.vue'
</script>
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `type` | `'dots' \| 'spinner' \| 'bar' \| 'circle'` | `'dots'` | Loading animation type |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Size variant |
| `color` | `string` | - | Custom color (CSS variable) |

---

## Hooks & Composables

### useThemeProvider

Complete theme management system.

```typescript
import { useThemeProvider, useThemeColors, initTheme } from '@/composables/useThemeProvider'

// Basic usage
const { theme, isDark, toggleTheme, setTheme } = useThemeProvider()

// Theme colors
const { textColor, backgroundColor, borderColor } = useThemeColors()

// Initialize on app startup
initTheme()
```

**API:**
| Method/Property | Type | Description |
|-----------------|------|-------------|
| `theme` | `ComputedRef<'light' \| 'dark'>` | Current theme |
| `themeMode` | `ComputedRef<'light' \| 'dark' \| 'system'>` | Theme mode |
| `isDark` | `ComputedRef<boolean>` | Is dark mode active |
| `isLight` | `ComputedRef<boolean>` | Is light mode active |
| `toggleTheme(animate?)` | `function` | Toggle between light/dark |
| `setTheme(mode, animate?)` | `function` | Set specific theme |
| `getThemeColor(var)` | `function` | Get CSS variable value |

### useDarkMode

Simplified dark mode interface.

```typescript
import {
  useDarkMode,
  useAutoDarkMode,
  useSystemDarkMode
} from '@/hooks/useDarkMode'

// Basic dark mode toggle
const { isDark, toggleDark, enableDark, disableDark } = useDarkMode()

// Auto dark mode based on time
const { isDarkTime, updateForTime, startAutoUpdate } = useAutoDarkMode()

// System preference tracking
const { systemPreference, watchSystemPreference } = useSystemDarkMode()
```

**API:**
| Method/Property | Type | Description |
|-----------------|------|-------------|
| `isDark` | `ComputedRef<boolean>` | Dark mode state |
| `toggleDark()` | `function` | Toggle dark mode |
| `enableDark()` | `function` | Enable dark mode |
| `disableDark()` | `function` | Disable dark mode |
| `setDark(value)` | `function` | Set dark mode state |
| `setMode(mode)` | `function` | Set theme mode |

### usePerformanceMonitor

Performance tracking and metrics.

```typescript
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor'

const {
  startMeasure,
  endMeasure,
  measureAsync,
  startFPSMonitor,
  stopFPSMonitor,
  getMemoryUsage,
  getReport
} = usePerformanceMonitor('MyComponent')

// Measure execution time
const start = startMeasure('operation')
// ... do work ...
endMeasure('operation', start)

// Measure async operation
const result = await measureAsync('fetch', async () => {
  return await fetchData()
})

// Get comprehensive report
const report = getReport()
console.log(report.metrics)
```

### useDebouncedFn / useThrottledFn

Event optimization utilities.

```typescript
import { useDebouncedFn, useThrottledFn } from '@/hooks/usePerformanceMonitor'

// Debounced search input
const debouncedSearch = useDebouncedFn((query: string) => {
  performSearch(query)
}, 300)

// Throttled scroll handler
const throttledScroll = useThrottledFn((event: Event) => {
  handleScroll(event)
}, 100)
```

### Performance Utilities

```typescript
import {
  debounce,
  throttle,
  rafThrottle,
  idleThrottle,
  memoize
} from '@/utils/performance'

// Debounce function
const debouncedFn = debounce((value: string) => {
  console.log('Debounced:', value)
}, 300)

// Throttle function
const throttledFn = throttle((event: Event) => {
  console.log('Throttled:', event)
}, 100)

// RAF throttle (for scroll/resize)
const rafFn = rafThrottle(() => {
  updateLayout()
})

// Memoize expensive function
const expensiveFn = memoize((input: string) => {
  return complexCalculation(input)
})
```

---

## Theming

### Dark Mode

The design system includes comprehensive dark mode support:

```vue
<template>
  <div :class="{ 'dark': isDark }">
    <!-- Content automatically adapts to theme -->
  </div>
</template>

<script setup lang="ts">
import { useDarkMode } from '@/hooks/useDarkMode'

const { isDark, toggleDark } = useDarkMode()
</script>
```

### Custom Theme Variables

Override design tokens locally:

```vue
<template>
  <div class="custom-themed">
    Custom themed content
  </div>
</template>

<style scoped lang="scss">
.custom-themed {
  --hula-brand-primary: #8B5CF6;
  --hula-text-primary: #1E293B;
  background: var(--hula-bg-primary);
  color: var(--hula-text-primary);
}
</style>
```

### Theme-Aware Animations

Animations automatically adapt to current theme:

```scss
@import '@/styles/tokens/animations-theme.scss';

.my-element {
  // Fade in with theme-aware colors
  animation: fade-in 0.3s ease-out;

  // Hover glow adapts to theme
  &:hover {
    animation: hover-glow 0.2s ease forwards;
  }
}
```

---

## Accessibility

### ARIA Support

Components include proper ARIA attributes:

```vue
<template>
  <!-- Button with aria-label -->
  <IconButton
    icon="heroicons:trash"
    :aria-label="'Delete item'"
    @click="handleDelete"
  />

  <!-- Loading with aria-live -->
  <div
    v-if="isLoading"
    role="status"
    aria-live="polite"
  >
    Loading...
  </div>
</template>
```

### Keyboard Navigation

All interactive components support keyboard:

```vue
<template>
  <!-- Clickable card with keyboard support -->
  <GlassCard
    clickable
    tabindex="0"
    @click="handleClick"
    @keydown.enter="handleClick"
    @keydown.space.prevent="handleClick"
  >
    Keyboard accessible content
  </GlassCard>
</template>
```

### Focus Management

```typescript
import { useFocusManagement } from '@/composables/useFocusManagement'

const {
  trapFocus,
  restoreFocus,
  setFocus
} = useFocusManagement()

// Trap focus in modal
onMounted(() => {
  trapFocus(modalRef.value)
})

// Restore focus when modal closes
onUnmounted(() => {
  restoreFocus()
})
```

### Reduced Motion

Respect user's motion preferences:

```scss
// Automatically handled by animations-theme.scss
// Or manually check:

@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Performance

### Virtual Scrolling

Use `VirtualList` for datasets with 100+ items:

```vue
<VirtualList
  :items="largeDataSet"
  :item-height="60"
  :overscan="5"
>
  <template #default="{ item }">
    {{ item.name }}
  </template>
</VirtualList>
```

**Performance impact:**
- Renders only visible + overscan items
- Constant memory regardless of dataset size
- Smooth 60fps scrolling with 10,000+ items

### Lazy Loading

```vue
<!-- Lazy load images -->
<LazyImage
  v-for="image in images"
  :key="image.id"
  :src="image.url"
  :threshold="0.1"
/>

<!-- Lazy load components -->
<LazyComponent
  :component="HeavyChart"
  :load-on-visible="true"
/>
```

### Code Splitting

```typescript
// Route-based splitting
const routes = [
  {
    path: '/settings',
    component: () => import('@/views/Settings.vue')
  }
]

// Component-based splitting
const HeavyModal = defineAsyncComponent({
  loader: () => import('./HeavyModal.vue'),
  loadingComponent: LoadingSpinner,
  delay: 200,
  timeout: 3000
})
```

### Performance Monitoring

```typescript
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor'

const perf = usePerformanceMonitor('MyComponent')

// Monitor FPS
perf.startFPSMonitor()
onUnmounted(() => perf.stopFPSMonitor())

// Check memory usage
const memory = perf.getMemoryUsage()
console.log(`Memory: ${(memory?.percentage || 0).toFixed(1)}%`)

// Measure operations
const start = perf.startMeasure('render')
// ... render logic ...
perf.endMeasure('render', start)
```

---

## Best Practices

### Component Design

1. **Use composition over inheritance**
   ```vue
   <!-- Good: Compose multiple components -->
   <Card>
     <CardHeader>
       <CardTitle>Title</CardTitle>
     </CardHeader>
     <CardContent>Content</CardContent>
   </Card>

   <!-- Avoid: Monolithic component -->
   <ComplexCard title="Title" content="Content" />
   ```

2. **Prefer controlled components**
   ```vue
   <!-- Good: Controlled state -->
   <Input
     :model-value="value"
     @update:model-value="value = $event"
   />

   <!-- Avoid: Uncontrolled state -->
   <Input v-model="localValue" @change="handleChange" />
   ```

3. **Provide clear prop types**
   ```typescript
   interface Props {
     /** User ID for the avatar */
     userId: string
     /** Avatar size in pixels */
     size?: number
     /** Show online status indicator */
     showStatus?: boolean
   }

   const props = withDefaults(defineProps<Props>(), {
     size: 40,
     showStatus: true
   })
   ```

### Performance

1. **Memoize expensive computations**
   ```typescript
   import { computed } from 'vue'

   // Good: Memoized
   const filteredItems = computed(() => {
     return items.value.filter(/* complex filter */)
   })

   // Avoid: Recalculated on every access
   const getFilteredItems = () => {
     return items.value.filter(/* complex filter */)
   }
   ```

2. **Use v-memo for list rendering**
   ```vue
   <template>
     <div
       v-for="item in items"
       :key="item.id"
       v-memo="[item.id, item.active]"
     >
       {{ item.name }}
     </div>
   </template>
   ```

3. **Debounce event handlers**
   ```typescript
   import { useDebouncedFn } from '@/hooks/usePerformanceMonitor'

   const handleSearch = useDebouncedFn((query: string) => {
     performSearch(query)
   }, 300)
   ```

### Accessibility

1. **Always include alt text for images**
   ```vue
   <LazyImage
     src="/profile.jpg"
     alt="User profile picture"
   />
   ```

2. **Use semantic HTML**
   ```vue
   <!-- Good: Semantic -->
   <nav>
     <ul>
       <li><a href="/">Home</a></li>
     </ul>
   </nav>

   <!-- Avoid: Generic divs -->
   <div class="navigation">
     <div class="nav-item">Home</div>
   </div>
   ```

3. **Support keyboard navigation**
   ```vue
   <div
     @click="handleAction"
     @keydown.enter="handleAction"
     @keydown.space.prevent="handleAction"
     role="button"
     tabindex="0"
   >
     Action
   </div>
   ```

### Styling

1. **Use design tokens, not hardcoded values**
   ```scss
   // Good: Design tokens
   .my-component {
     padding: var(--spacing-md);
     background: var(--hula-bg-primary);
     border: 1px solid var(--hula-border-default);
   }

   // Avoid: Hardcoded values
   .my-component {
     padding: 12px;
     background: #ffffff;
     border: 1px solid #e2e8f0;
   }
   ```

2. **Prefer utility classes for simple styles**
   ```vue
   <!-- Good: Utility classes -->
   <div class="flex items-center gap-4">
     Content
   </div>

   <!-- Unnecessary: Custom styles for simple layout -->
   <div class="custom-layout">
     Content
   </div>
   ```

3. **Use scoped styles for component-specific CSS**
   ```vue
   <style scoped lang="scss">
   .my-component {
     // Component-specific styles
   }
   </style>
   ```

---

## Contributing

When adding new components to the design system:

1. **Follow TypeScript strict mode**
2. **Include JSDoc comments**
3. **Add accessibility attributes**
4. **Support dark mode**
5. **Include story/example**
6. **Test with keyboard navigation**
7. **Verify with screen reader**

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.1 | 2026-01-12 | Phase 4-5: Performance optimization, Dark mode refinement |
| 2.0 | 2026-01-11 | Phase 1-3: Design system foundation, Component library, Responsive design |
| 1.0 | 2026-01-10 | Initial design system |

---

## Support

For issues, questions, or contributions:
- Create an issue in the project repository
- Contact the design system team
- Refer to component examples in `/examples`
