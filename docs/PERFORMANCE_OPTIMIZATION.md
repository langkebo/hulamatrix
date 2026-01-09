# HuLa 性能优化最佳实践

## 目录

- [代码优化](#代码优化)
- [资源优化](#资源优化)
- [渲染优化](#渲染优化)
- [网络优化](#网络优化)
- [监控和分析](#监控和分析)

---

## 📊 代码优化

### 1. 组件懒加载

**问题**: 打包体积过大，首屏加载慢

**解决方案**: 使用 Vue 3 的异步组件

```vue
<script setup>
// ❌ 同步导入（慢）
import HeavyComponent from './HeavyComponent.vue'

// ✅ 异步导入（快）
const HeavyComponent = defineAsyncComponent(() =>
  import('./HeavyComponent.vue')
)
</script>

<template>
  <Suspense>
    <HeavyComponent />
  </Suspense>
</template>
```

**优点**:
- 减少初始包体积
- 按需加载组件
- 提升首屏速度

---

### 2. 列表虚拟化

**问题**: 长列表渲染卡顿

**解决方案**: 使用虚拟滚动

```vue
<script setup>
import { VirtualList } from '@vueuse/components'

const items = ref([...]) // 大量数据
</script>

<template>
  <!-- ✅ 虚拟列表 - 只渲染可见项 -->
  <VirtualList :data="items" :item-height="50">
    <template #default="{ item }">
      <div>{{ item.name }}</div>
    </template>
  </VirtualList>

  <!-- ❌ 普通列表 - 渲染所有项 -->
  <div v-for="item in items" :key="item.id">
    {{ item.name }}
  </div>
</template>
```

**优点**:
- 只渲染可见项
- 大幅减少 DOM 节点
- 滚动流畅

---

### 3. 计算属性缓存

**问题**: 重复计算影响性能

**解决方案**: 使用 computed 缓存

```vue
<script setup>
import { computed, ref } from 'vue'

const items = ref([...])

// ❌ 每次调用都重新计算
function getTotal() {
  return items.value.reduce((sum, item) => sum + item.price, 0)
}

// ✅ 使用 computed 缓存
const total = computed(() => {
  return items.value.reduce((sum, item) => sum + item.price, 0)
})
</script>

<template>
  <!-- ❌ 每次渲染都计算 -->
  <div>{{ getTotal() }}</div>

  <!-- ✅ 只在依赖变化时计算 -->
  <div>{{ total }}</div>
</template>
```

---

### 4. 防抖和节流

**问题**: 频繁触发的事件影响性能

**解决方案**: 使用防抖/节流

```vue
<script setup>
import { ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'

// ❌ 每次输入都触发
function handleInput(value) {
  search(value)
}

// ✅ 防抖 - 延迟执行
const debouncedSearch = useDebounceFn((value) => {
  search(value)
}, 300)

// ✅ 节流 - 限制频率
import { useThrottleFn } from '@vueuse/core'
const throttledScroll = useThrottleFn(() => {
  handleScroll()
}, 100)
</script>

<template>
  <input @input="debouncedSearch($event.target.value)" />
  <div @scroll="throttledScroll" />
</template>
```

---

## 🖼️ 资源优化

### 1. 图片优化

#### 使用正确的格式

```html
<!-- ❌ 使用大文件 PNG -->
<img src="large-image.png" alt="描述" />

<!-- ✅ 使用 WebP (更小) -->
<img src="image.webp" alt="描述" />

<!-- ✅ 使用 picture 元素提供回退 -->
<picture>
  <source srcset="image.avif" type="image/avif" />
  <source srcset="image.webp" type="image/webp" />
  <img src="image.jpg" alt="描述" />
</picture>
```

#### 响应式图片

```html
<img
  src="image-800.jpg"
  srcset="image-400.jpg 400w,
          image-800.jpg 800w,
          image-1200.jpg 1200w"
  sizes="(max-width: 600px) 400px,
         (max-width: 1200px) 800px,
         1200px"
  alt="响应式图片"
/>
```

#### 图片懒加载

```vue
<script setup>
import LazyImage from '@/components/common/LazyImage.vue'
</script>

<template>
  <!-- ✅ 使用 LazyImage 组件 -->
  <LazyImage
    :mxc-url="imageUrl"
    alt="产品图片"
    :width="800"
    :height="600"
  />

  <!-- ❌ 直接加载 -->
  <img :src="imageUrl" alt="产品图片" />
</template>
```

---

### 2. 字体优化

#### 使用系统字体栈

```css
/* ✅ 系统字体栈 - 快速 */
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI',
               'Helvetica Neue', Arial, sans-serif;
}

/* ❌ 自定义字体 - 需要下载 */
body {
  font-family: 'CustomFont', sans-serif;
}
```

#### 字体显示策略

```css
/* ✅ 立即显示后备字体 */
@font-face {
  font-family: 'CustomFont';
  src: url('font.woff2') format('woff2');
  font-display: swap; /* 立即显示文本 */
}

/* ✅ 限制 FOUT */
@font-face {
  font-family: 'CustomFont';
  src: url('font.woff2') format('woff2');
  font-display: optional; /* 仅在已缓存时使用 */
}
```

---

### 3. 代码分割

```javascript
// ❌ 导入整个库
import _ from 'lodash'

// ✅ 只导入需要的函数
import debounce from 'lodash/debounce'

// ✅ 使用 Tree-shaking
import { debounce } from 'lodash-es'

// 路由级别代码分割
const routes = [
  {
    path: '/dashboard',
    component: () => import('./views/Dashboard.vue')
  }
]
```

---

## 🎨 渲染优化

### 1. v-for 优化

```vue
<template>
  <!-- ❌ 使用 index 作为 key（性能差） -->
  <div v-for="(item, index) in items" :key="index">
    {{ item.name }}
  </div>

  <!-- ✅ 使用唯一 ID 作为 key -->
  <div v-for="item in items" :key="item.id">
    {{ item.name }}
  </div>

  <!-- ✅ 大量数据使用虚拟滚动 -->
  <VirtualList :data="items" />
</template>
```

### 2. v-if vs v-show

```vue
<template>
  <!-- ✅ 频繁切换 - 使用 v-show（保留 DOM） -->
  <div v-show="isVisible">内容</div>

  <!-- ✅ 很少切换 - 使用 v-if（销毁 DOM） -->
  <div v-if="isAuthenticated">受保护的内容</div>

  <!-- ❌ 同时使用 -->
  <div v-if="condition" v-show="otherCondition">错误</div>
</template>
```

### 3. 减少响应式数据

```vue
<script setup>
import { reactive, shallowRef, ref } from 'vue'

// ❌ 深度响应式（性能差）
const data = reactive({
  list: [...], // 大数组
  config: { ... } // 嵌套对象
})

// ✅ 浅响应式（性能好）
const data = shallowReactive({
  list: [...],
  config: { ... }
})

// ✅ 不需要响应式
const staticData = ref(Object.freeze({...}))
</script>
```

---

## 🌐 网络优化

### 1. 请求合并

```javascript
// ❌ 多个请求
async function fetchData() {
  const user = await fetchUser(id)
  const posts = await fetchPosts(id)
  const comments = await fetchComments(id)
}

// ✅ 并行请求
async function fetchData() {
  const [user, posts, comments] = await Promise.all([
    fetchUser(id),
    fetchPosts(id),
    fetchComments(id)
  ])
}
```

### 2. 请求缓存

```javascript
// 使用 SWR 或 React Query
import useSWR from 'swr'

function useUser(id) {
  const { data, error } = useSWR(`/api/user/${id}`, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000 // 1分钟缓存
  })

  return { user: data, error }
}
```

### 3. 预加载关键资源

```html
<head>
  <!-- 预连接到重要域名 -->
  <link rel="preconnect" href="https://api.example.com">
  <link rel="dns-prefetch" href="https://cdn.example.com">

  <!-- 预加载关键资源 -->
  <link rel="preload" href="/fonts/main.woff2" as="font" crossorigin>
  <link rel="preload" href="/images/hero.webp" as="image">
</head>
```

---

## 📈 监控和分析

### 1. Lighthouse CI

**配置**: `.github/workflows/ui-ux-quality.yml`

**关键指标**:
```json
{
  "performance": 85,
  "accessibility": 95,
  "best-practices": 90,
  "seo": 85
}
```

### 2. 性能监控

```javascript
// 使用 Performance API
export function measurePerformance() {
  // 测量特定操作
  performance.mark('fetch-start')
  await fetchData()
  performance.mark('fetch-end')

  performance.measure('fetch', 'fetch-start', 'fetch-end')

  const measure = performance.getEntriesByName('fetch')[0]
  console.log(`Fetch took ${measure.duration}ms`)
}

// 测量页面加载
window.addEventListener('load', () => {
  const perfData = performance.getEntriesByType('navigation')[0]
  console.log({
    domContentLoaded: perfData.domContentLoadedEventEnd - perfData.navigationStart,
    loadComplete: perfData.loadEventEnd - perfData.navigationStart,
    firstPaint: perfData.responseStart - perfData.navigationStart
  })
})
```

### 3. 错误监控

```javascript
// 全局错误处理
window.addEventListener('error', (event) => {
  logger.error('Global error:', event.error)
  // 发送到错误监控服务
})

window.addEventListener('unhandledrejection', (event) => {
  logger.error('Unhandled rejection:', event.reason)
  // 发送到错误监控服务
})
```

---

## 🎯 性能目标

### 关键指标

| 指标 | 目标 | 当前 | 状态 |
|------|------|------|------|
| First Contentful Paint (FCP) | < 2s | ~3s | 🔄 |
| Largest Contentful Paint (LCP) | < 2.5s | ~4s | 🔄 |
| Cumulative Layout Shift (CLS) | < 0.1 | TBD | 🔄 |
| First Input Delay (FID) | < 100ms | TBD | 🔄 |
| Time to Interactive (TTI) | < 3s | TBD | 🔄 |

### 资源预算

```json
{
  "scripts": {
    "limit": 300,
    "count": 10
  },
  "stylesheets": {
    "limit": 100,
    "count": 3
  },
  "images": {
    "limit": 200,
    "count": 20
  },
  "fonts": {
    "limit": 100,
    "count": 3
  },
  "total": {
    "limit": 1000
  }
}
```

---

## 💡 快速优化清单

### 立即可做

- [ ] 使用异步组件导入
- [ ] 为图片添加懒加载
- [ ] 使用 computed 缓存计算
- [ ] 为频繁事件添加防抖/节流
- [ ] 优化关键渲染路径

### 本周完成

- [ ] 实施虚拟滚动
- [ ] 优化图片资源
- [ ] 配置代码分割
- [ ] 添加性能监控
- [ ] 优化包大小

### 持续改进

- [ ] 定期运行 Lighthouse
- [ ] 监控真实用户指标 (RUM)
- [ ] 进行 A/B 测试
- [ ] 优化 Core Web Vitals

---

## 📚 相关资源

- [Web.dev Performance](https://web.dev/performance/)
- [Vue.js Performance Guide](https://vuejs.org/guide/best-practices/performance.html)
- [Lighthouse Documentation](https://github.com/GoogleChrome/lighthouse)
- [Core Web Vitals](https://web.dev/vitals/)

---

**版本**: 1.0.0
**更新日期**: 2026-01-09
**维护者**: HuLa Performance Team
