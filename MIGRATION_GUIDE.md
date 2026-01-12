# Migration Guide: Moving to HuLa Design System v2.1

> A comprehensive guide for migrating existing components to the new design system

## Table of Contents

- [Overview](#overview)
- [Breaking Changes](#breaking-changes)
- [Component Migrations](#component-migrations)
- [Styling Migrations](#styling-migrations)
- [Theme Migration](#theme-migration)
- [Performance Migration](#performance-migration)
- [Checklist](#checklist)

---

## Overview

This guide helps you migrate from the old component architecture to the new HuLa Design System v2.1. The migration focuses on:

1. **Consistent component APIs** across the application
2. **Theme-aware styling** with dark mode support
3. **Performance optimizations** (lazy loading, virtual scrolling)
4. **Accessibility improvements** (ARIA, keyboard navigation)
5. **Type safety** with strict TypeScript

### Migration Strategy

We recommend a **gradual migration** approach:

1. **Phase 1**: Update design tokens and global styles
2. **Phase 2**: Migrate common components (buttons, cards, inputs)
3. **Phase 3**: Migrate performance-critical components (lists, images)
4. **Phase 4**: Migrate feature-specific components
5. **Phase 5**: Enable theme system and dark mode
6. **Phase 6**: Final testing and optimization

---

## Breaking Changes

### Import Paths

**Old:**
```typescript
import { Button } from '@/components/common'
```

**New:**
```typescript
import PrimaryButton from '@/components/shared/buttons/PrimaryButton.vue'
import SecondaryButton from '@/components/shared/buttons/SecondaryButton.vue'
```

### Component Names

| Old Component | New Component | Notes |
|---------------|---------------|-------|
| `Button` | `PrimaryButton` / `SecondaryButton` | Split by semantic meaning |
| `Card` | `GlassCard` | Added glassmorphism effects |
| `Image` | `LazyImage` | Added lazy loading |
| `List` | `VirtualList` | Added virtual scrolling |
| `Loading` | `LoadingState` / `Skeleton` | Split by use case |

### Props Changes

#### Button Props

**Old:**
```vue
<Button variant="primary" size="medium" loading={isLoading}>
  Submit
</Button>
```

**New:**
```vue
<PrimaryButton size="md" :loading="isLoading">
  Submit
</PrimaryButton>
```

| Old Prop | New Prop | Type Change |
|----------|----------|-------------|
| `variant="primary"` | Use `<PrimaryButton>` | Component |
| `variant="secondary"` | Use `<SecondaryButton>` | Component |
| `size="medium"` | `size="md"` | String |
| `loading={true}` | `:loading="true"` | Vue binding |

---

## Component Migrations

### Button Migration

#### Primary Action Button

**Old Code:**
```vue
<template>
  <Button
    variant="primary"
    size="large"
    :loading="isSubmitting"
    @click="handleSubmit"
  >
    Submit Form
  </Button>
</template>

<script>
import { Button } from '@/components/common'
export default {
  components: { Button },
  data() {
    return { isSubmitting: false }
  },
  methods: {
    async handleSubmit() {
      this.isSubmitting = true
      // ...
    }
  }
}
</script>
```

**New Code:**
```vue
<template>
  <PrimaryButton
    size="lg"
    :loading="isSubmitting"
    @click="handleSubmit"
  >
    Submit Form
  </PrimaryButton>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import PrimaryButton from '@/components/shared/buttons/PrimaryButton.vue'

const isSubmitting = ref(false)

const handleSubmit = async () => {
  isSubmitting.value = true
  // ...
}
</script>
```

**Key Changes:**
- Migrated to `<script setup>` syntax
- Changed `variant="primary"` to `<PrimaryButton>` component
- Changed `size="large"` to `size="lg"`
- Added TypeScript types

#### Secondary Action Button

**Old Code:**
```vue
<Button variant="secondary" @click="handleCancel">
  Cancel
</Button>
```

**New Code:**
```vue
<SecondaryButton @click="handleCancel">
  Cancel
</SecondaryButton>
```

#### Icon Button

**Old Code:**
```vue
<Button variant="icon" icon="trash" @click="handleDelete" />
```

**New Code:**
```vue
<IconButton
  icon="heroicons:trash"
  :tooltip="'Delete item'"
  @click="handleDelete"
/>
```

**Key Improvements:**
- Built-in tooltip support
- Better accessibility with aria-label
- Loading state support
- Multiple icon variants

### Card Migration

#### Basic Card

**Old Code:**
```vue
<template>
  <Card class="user-card">
    <h3>{{ user.name }}</h3>
    <p>{{ user.email }}</p>
  </Card>
</template>

<style scoped>
.user-card {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
</style>
```

**New Code:**
```vue
<template>
  <GlassCard>
    <h3>{{ user.name }}</h3>
    <p>{{ user.email }}</p>
  </GlassCard>
</template>

<script setup lang="ts">
import GlassCard from '@/components/common/GlassCard.vue'

defineProps<{
  user: { name: string; email: string }
}>()
</script>
```

**Key Improvements:**
- Built-in glassmorphism effect
- Automatic dark mode support
- No custom styles needed
- Hover and click variants

#### Interactive Card

**Old Code:**
```vue
<template>
  <div
    class="card"
    :class="{ 'card-hover': hoverable }"
    @click="handleClick"
  >
    <!-- content -->
  </div>
</template>

<style scoped>
.card {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  transition: transform 0.2s;
}

.card-hover:hover {
  transform: translateY(-2px);
}
</style>
```

**New Code:**
```vue
<template>
  <GlassCard hoverable clickable @click="handleClick">
    <!-- content -->
  </GlassCard>
</template>

<script setup lang="ts">
import GlassCard from '@/components/common/GlassCard.vue'

const handleClick = () => {
  // Handle click
}
</script>
```

### Image Migration

#### Basic Image

**Old Code:**
```vue
<template>
  <img
    :src="imageUrl"
    :alt="imageAlt"
    class="rounded-image"
    @load="handleLoad"
  />
</template>

<style scoped>
.rounded-image {
  border-radius: 8px;
  width: 100%;
  height: auto;
}
</style>
```

**New Code:**
```vue
<template>
  <LazyImage
    :src="imageUrl"
    :alt="imageAlt"
    rounded
    @load="handleLoad"
  />
</template>

<script setup lang="ts">
import LazyImage from '@/components/common/LazyImage.vue'

defineProps<{
  imageUrl: string
  imageAlt: string
}>()

const handleLoad = () => {
  console.log('Image loaded')
}
</script>
```

**Key Improvements:**
- Lazy loading by default
- Skeleton placeholder
- Error state handling
- Background image variant

### List Migration

#### Long List

**Old Code:**
```vue
<template>
  <div class="user-list">
    <div
      v-for="user in users"
      :key="user.id"
      class="user-item"
    >
      {{ user.name }}
    </div>
  </div>
</template>

<style scoped>
.user-list {
  max-height: 400px;
  overflow-y: auto;
}

.user-item {
  padding: 12px;
  border-bottom: 1px solid #eee;
}
</style>
```

**New Code:**
```vue
<template>
  <VirtualList
    :items="users"
    :item-height="48"
    :overscan="5"
    height="400px"
    @load-more="loadMoreUsers"
  >
    <template #default="{ item }">
      <div class="user-item">
        {{ item.name }}
      </div>
    </template>
  </VirtualList>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import VirtualList from '@/components/common/VirtualList.vue'

const users = ref<any[]>([])

const loadMoreUsers = () => {
  // Load more users
}
</script>

<style scoped>
.user-item {
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--hula-border-subtle);
}
</style>
```

**Key Improvements:**
- Virtual scrolling (renders only visible items)
- Constant performance regardless of list size
- Built-in load-more support
- Dynamic height support

---

## Styling Migrations

### Hardcoded Colors → Design Tokens

**Old:**
```scss
.my-component {
  background: #ffffff;
  color: #1e293b;
  border: 1px solid #e2e8f0;
  padding: 12px;
  border-radius: 8px;
}
```

**New:**
```scss
.my-component {
  background: var(--hula-bg-primary);
  color: var(--hula-text-primary);
  border: 1px solid var(--hula-border-default);
  padding: var(--spacing-md);
  border-radius: 8px;
}
```

**Benefits:**
- Automatic dark mode support
- Consistent color usage
- Easy theme customization
- Better maintainability

### Magic Numbers → Spacing Tokens

**Old:**
```scss
.header {
  padding: 16px 24px;
  margin-bottom: 32px;
}

.content {
  padding: 8px;
  gap: 16px;
}
```

**New:**
```scss
.header {
  padding: var(--spacing-lg) var(--spacing-xl);
  margin-bottom: var(--spacing-2xl);
}

.content {
  padding: var(--spacing-sm);
  gap: var(--spacing-lg);
}
```

**Benefits:**
- Consistent spacing rhythm
- Easier to adjust globally
- Semantic spacing values

### Custom Shadows → Shadow Tokens

**Old:**
```scss
.card {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.modal {
  box-shadow: 0 20px 25px rgba(0, 0, 0, 0.15);
}
```

**New:**
```scss
.card {
  box-shadow: var(--hula-shadow-md);
}

.modal {
  box-shadow: var(--hula-shadow-xl);
}
```

**Benefits:**
- Consistent shadow depth
- Dark mode adjustments
- Lighter code

---

## Theme Migration

### Adding Dark Mode Support

**Step 1: Initialize Theme System**

```typescript
// main.ts
import { createApp } from 'vue'
import { initTheme } from '@/composables/useThemeProvider'
import App from './App.vue'

const app = createApp(App)

// Initialize theme before mounting
initTheme()

app.mount('#app')
```

**Step 2: Use Theme-Aware Styles**

```scss
// Instead of hardcoded colors
.old-component {
  background: #ffffff;
  color: #1e293b;
}

// Use design tokens
.new-component {
  background: var(--hula-bg-primary);
  color: var(--hula-text-primary);
}
```

**Step 3: Add Theme Toggle (Optional)**

```vue
<template>
  <button @click="toggleTheme">
    {{ isDark ? '☀️' : '🌙' }}
  </button>
</template>

<script setup lang="ts">
import { useDarkMode } from '@/hooks/useDarkMode'

const { isDark, toggleTheme } = useDarkMode()
</script>
```

### Custom Theme Colors

**Old:**
```scss
.brand-button {
  background: #13987F;
  color: #ffffff;

  &:hover {
    background: #0E6B58;
  }
}
```

**New (with dark mode):**
```scss
.brand-button {
  background: var(--hula-brand-primary);
  color: var(--hula-text-inverse);

  &:hover {
    background: var(--hula-brand-primary-hover);
  }
}
```

The colors automatically adapt to dark mode through CSS custom properties.

---

## Performance Migration

### Lazy Loading Images

**Old:**
```vue
<template>
  <img
    v-for="image in images"
    :key="image.id"
    :src="image.url"
    :alt="image.alt"
  />
</template>
```

**New:**
```vue
<template>
  <LazyImage
    v-for="image in images"
    :key="image.id"
    :src="image.url"
    :alt="image.alt"
    :threshold="0.1"
  />
</template>

<script setup lang="ts">
import LazyImage from '@/components/common/LazyImage.vue'
</script>
```

**Performance Gains:**
- Loads images only when near viewport
- Reduces initial page load
- Saves bandwidth

### Virtual Scrolling

**Old:**
```vue
<template>
  <div class="scroll-container">
    <div
      v-for="item in largeDataSet"
      :key="item.id"
      class="item"
    >
      {{ item.name }}
    </div>
  </div>
</template>
```

**New:**
```vue
<template>
  <VirtualList
    :items="largeDataSet"
    :item-height="60"
    :overscan="5"
    height="600px"
  >
    <template #default="{ item }">
      <div class="item">
        {{ item.name }}
      </div>
    </template>
  </VirtualList>
</template>

<script setup lang="ts">
import VirtualList from '@/components/common/VirtualList.vue'
</script>
```

**Performance Gains:**
- Handles 10,000+ items smoothly
- Constant memory usage
- 60fps scrolling

### Code Splitting

**Old:**
```typescript
import HeavyChart from '@/components/HeavyChart.vue'

export default {
  components: { HeavyChart }
  // HeavyChart loaded immediately
}
```

**New:**
```typescript
// Route-based splitting
const routes = [
  {
    path: '/analytics',
    component: () => import('@/views/Analytics.vue')
  }
]

// Component-based splitting
const HeavyChart = defineAsyncComponent({
  loader: () => import('@/components/HeavyChart.vue'),
  loadingComponent: LoadingState,
  delay: 200,
  timeout: 3000
})
```

**Performance Gains:**
- Smaller initial bundle
- Faster page load
- Load on-demand

### Debouncing Events

**Old:**
```typescript
const handleSearch = (query: string) => {
  performSearch(query)
}
```

**New:**
```typescript
import { useDebouncedFn } from '@/utils/performance'

const handleSearch = useDebouncedFn((query: string) => {
  performSearch(query)
}, 300)
```

**Performance Gains:**
- Fewer API calls
- Reduced CPU usage
- Better UX

---

## Migration Checklist

### Phase 1: Design Tokens

- [ ] Replace hardcoded colors with design tokens
- [ ] Replace magic numbers with spacing tokens
- [ ] Replace custom shadows with shadow tokens
- [ ] Update SCSS imports to include new token files

### Phase 2: Common Components

- [ ] Migrate all `Button` to `PrimaryButton`/`SecondaryButton`/`IconButton`
- [ ] Migrate `Card` to `GlassCard`
- [ ] Update component imports to use direct paths
- [ ] Add TypeScript props interfaces

### Phase 3: Performance Components

- [ ] Replace long lists (100+ items) with `VirtualList`
- [ ] Replace `<img>` with `LazyImage`
- [ ] Add `LazyComponent` for heavy components
- [ ] Implement code splitting for routes

### Phase 4: Theme System

- [ ] Initialize theme provider in main.ts
- [ ] Replace hardcoded colors with CSS custom properties
- [ ] Add dark mode support to all custom styles
- [ ] Test components in both light and dark modes

### Phase 5: Accessibility

- [ ] Add ARIA labels to interactive elements
- [ ] Ensure keyboard navigation works
- [ ] Test with screen reader
- [ ] Add focus indicators

### Phase 6: Testing

- [ ] Test all migrated components
- [ ] Verify dark mode works correctly
- [ ] Check performance improvements
- [ ] Validate accessibility
- [ ] Run TypeScript compiler
- [ ] Test on mobile devices

---

## Quick Reference

### Import Path Changes

| Old Import | New Import |
|------------|------------|
| `@/components/common` | `@/components/common/GlassCard.vue` |
| `@/components/shared/buttons` | `@/components/shared/buttons/PrimaryButton.vue` |
| `@/components/shared/avatar` | `@/components/shared/avatar/AvatarUserAvatar.vue` |

### Common Conversions

```typescript
// Old: Options API
export default {
  props: {
    title: String
  },
  data() {
    return { count: 0 }
  }
}

// New: Composition API
<script setup lang="ts">
interface Props {
  title: string
}
defineProps<Props>()

const count = ref(0)
</script>
```

```scss
// Old: Hardcoded
background: #ffffff;
color: #1e293b;
padding: 16px;

// New: Design tokens
background: var(--hula-bg-primary);
color: var(--hula-text-primary);
padding: var(--spacing-md);
```

---

## Getting Help

If you encounter issues during migration:

1. **Check examples** in `/examples` directory
2. **Review documentation** in `DESIGN_SYSTEM.md`
3. **Check component props** in component files
4. **Run type check**: `pnpm run typecheck`
5. **Test in isolation**: Create a minimal reproduction

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.1 | 2026-01-12 | Initial migration guide for design system v2.1 |
