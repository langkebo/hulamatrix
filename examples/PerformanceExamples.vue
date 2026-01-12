<!--
  Performance Components Examples
  Demonstrates VirtualList, LazyImage, and LazyComponent
-->
<template>
  <div class="performance-examples">
    <section class="example-section">
      <h2>VirtualList - Large Dataset</h2>
      <p class="hint">Renders 10,000 items efficiently. Only visible items are in DOM.</p>
      <div class="virtual-list-demo">
        <VirtualList :items="largeDataSet" :item-height="60" :overscan="5" height="400px" @load-more="handleLoadMore">
          <template #default="{ item, index }">
            <div class="list-item" :class="{ odd: index % 2 === 0 }">
              <span class="item-index">#{{ index + 1 }}</span>
              <span class="item-name">{{ item.name }}</span>
              <span class="item-value">{{ item.value }}</span>
            </div>
          </template>

          <template #loading>
            <div class="loading-more">
              <LoadingState type="dots" size="md" />
              <span>Loading more items...</span>
            </div>
          </template>
        </VirtualList>
        <div class="list-stats">
          <span>Items: {{ largeDataSet.length }}</span>
          <span>FPS: {{ currentFPS }}</span>
          <span>Memory: {{ memoryUsage }}%</span>
        </div>
      </div>
    </section>

    <section class="example-section">
      <h2>VirtualList - Dynamic Heights</h2>
      <p class="hint">Items with varying heights. Automatically measures and adjusts.</p>
      <div class="virtual-list-demo">
        <VirtualList :items="dynamicHeightItems" :item-height="getItemHeight" :dynamic="true" height="400px">
          <template #default="{ item }">
            <div class="dynamic-item" :style="{ height: `${item.height}px` }">
              <h4>{{ item.title }}</h4>
              <p>{{ item.content }}</p>
            </div>
          </template>
        </VirtualList>
      </div>
    </section>

    <section class="example-section">
      <h2>LazyImage - Progressive Loading</h2>
      <p class="hint">Images load as they enter viewport. Scroll down to see more.</p>
      <div class="image-gallery">
        <LazyImage
          v-for="image in images"
          :key="image.id"
          :src="image.url"
          :alt="image.alt"
          :width="300"
          :height="200"
          :skeleton="true"
          @load="handleImageLoad"
          @error="handleImageError" />
      </div>
    </section>

    <section class="example-section">
      <h2>LazyImage - Variants</h2>
      <div class="image-variants">
        <div class="variant-item">
          <h4>Default</h4>
          <LazyImage :src="placeholderImage" alt="Default lazy image" :width="200" :height="150" />
        </div>

        <div class="variant-item">
          <h4>With Skeleton</h4>
          <LazyImage :src="placeholderImage" alt="Skeleton placeholder" :width="200" :height="150" :skeleton="true" />
        </div>

        <div class="variant-item">
          <h4>Background</h4>
          <LazyImage
            :src="placeholderImage"
            alt="Background image"
            :width="200"
            :height="150"
            :background="true"
            fit="cover" />
        </div>

        <div class="variant-item">
          <h4>Contain Fit</h4>
          <LazyImage :src="placeholderImage" alt="Contained image" :width="200" :height="150" fit="contain" />
        </div>
      </div>
    </section>

    <section class="example-section">
      <h2>LazyComponent - Code Splitting</h2>
      <p class="hint">Heavy components load on demand. Scroll to trigger loading.</p>
      <div class="lazy-components">
        <LazyComponent
          v-for="index in 5"
          :key="index"
          :component="heavyComponent"
          :delay="100 * index"
          :load-on-visible="true"
          @loading="() => handleLoadingStart(index)"
          @loaded="() => handleLoaded(index)"
          @error="() => handleError(index)">
          <template #fallback>
            <div class="component-fallback">
              <LoadingState type="spinner" size="sm" />
              <span>Loading component {{ index }}...</span>
            </div>
          </template>

          <template #skeleton>
            <Skeleton :width="200" :height="100" variant="rectangular" />
          </template>
        </LazyComponent>
      </div>
    </section>

    <section class="example-section">
      <h2>Performance Monitor</h2>
      <div class="performance-stats">
        <div class="stat-card">
          <h4>FPS</h4>
          <div class="stat-value">{{ currentFPS }}</div>
        </div>
        <div class="stat-card">
          <h4>Memory</h4>
          <div class="stat-value">{{ memoryUsage }}%</div>
        </div>
        <div class="stat-card">
          <h4>Render Time</h4>
          <div class="stat-value">{{ renderTime }}ms</div>
        </div>
      </div>

      <div class="monitor-controls">
        <button @click="startMonitoring">Start Monitoring</button>
        <button @click="stopMonitoring">Stop Monitoring</button>
        <button @click="generateReport">Generate Report</button>
      </div>

      <div v-if="report" class="report-output">
        <h4>Performance Report</h4>
        <pre>{{ JSON.stringify(report, null, 2) }}</pre>
      </div>
    </section>

    <section class="example-section">
      <h2>Debounce & Throttle</h2>
      <div class="demo-controls">
        <div class="control-group">
          <label>Debounced Input (300ms)</label>
          <input v-model="searchQuery" type="text" placeholder="Type to search..." />
          <span class="output">Searches: {{ searchCount }}</span>
        </div>

        <div class="control-group">
          <label>Throttled Scroll</label>
          <div class="scroll-box" @scroll="handleScroll">
            <div class="scroll-content"></div>
          </div>
          <span class="output">Scroll events: {{ scrollCount }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, defineAsyncComponent } from 'vue'
import VirtualList from '@/components/common/VirtualList.vue'
import LazyImage from '@/components/common/LazyImage.vue'
import LazyComponent from '@/components/common/LazyComponent.vue'
import LoadingState from '@/components/common/LoadingState.vue'
import Skeleton from '@/components/common/Skeleton.vue'
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor'
import { useDebouncedFn } from '@/utils/performance'

// Performance monitoring
const perf = usePerformanceMonitor('PerformanceExamples')
const currentFPS = ref(60)
const memoryUsage = ref(0)
const renderTime = ref(0)
const report = ref<any>(null)

// Generate large dataset
const largeDataSet = ref(
  Array.from({ length: 10000 }, (_, i) => ({
    id: i,
    name: `Item ${i + 1}`,
    value: Math.random().toFixed(4)
  }))
)

// Generate dynamic height items
const dynamicHeightItems = ref(
  Array.from({ length: 50 }, (_, i) => ({
    id: i,
    title: `Dynamic Item ${i + 1}`,
    content: `This item has a height of ${60 + Math.random() * 100}px`,
    height: 60 + Math.random() * 100
  }))
)

const getItemHeight = (item: { height: number }) => item.height

// Images for lazy loading
const placeholderImage =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200"%3E%3Crect fill="%23ccc" width="300" height="200"/%3E%3Ctext fill="%23666" font-family="sans-serif" font-size="24" dy="10.5" font-weight="bold" x="50%25" y="50%25" text-anchor="middle"%3ELazy Image%3C/text%3E%3C/svg%3E'

const images = ref(
  Array.from({ length: 12 }, (_, i) => ({
    id: i,
    url: placeholderImage,
    alt: `Image ${i + 1}`
  }))
)

// Heavy component for lazy loading
const heavyComponent = defineAsyncComponent({
  loader: () => import('./HeavyComponent.vue'),
  loadingComponent: LoadingState,
  delay: 200
})

// Debounce & Throttle
const searchQuery = ref('')
const searchCount = ref(0)
const scrollCount = ref(0)

const debouncedSearch = useDebouncedFn((query: string) => {
  searchCount.value++
  console.log('Searching:', query)
}, 300)

const throttledScroll = useDebouncedFn(() => {
  scrollCount.value++
}, 100)

// Watch search query
import { watch } from 'vue'
watch(searchQuery, (newQuery) => {
  debouncedSearch(newQuery)
})

// Methods
const handleLoadMore = () => {
  const newItems = Array.from({ length: 20 }, (_, i) => ({
    id: largeDataSet.value.length + i,
    name: `Item ${largeDataSet.value.length + i + 1}`,
    value: Math.random().toFixed(4)
  }))
  largeDataSet.value.push(...newItems)
}

const handleImageLoad = () => {
  console.log('Image loaded')
}

const handleImageError = () => {
  console.log('Image failed to load')
}

const handleLoadingStart = (index: number) => {
  console.log('Loading component', index)
}

const handleLoaded = (index: number) => {
  console.log('Component loaded', index)
}

const handleError = (index: number) => {
  console.log('Component error', index)
}

const handleScroll = () => {
  throttledScroll()
}

const startMonitoring = () => {
  perf.startFPSMonitor()

  // Update stats periodically
  const interval = setInterval(() => {
    const mem = perf.getMemoryUsage()
    if (mem) {
      memoryUsage.value = Math.round(mem.percentage)
    }
  }, 1000)

  onUnmounted(() => clearInterval(interval))
}

const stopMonitoring = () => {
  perf.stopFPSMonitor()
}

const generateReport = () => {
  report.value = perf.getReport()
  console.log('Performance report:', report.value)
}

// Lifecycle
onMounted(() => {
  startMonitoring()
})
</script>

<style scoped lang="scss">
@import '@/styles/scss/global/variables.scss';

.performance-examples {
  padding: var(--spacing-xl);
  max-width: 1200px;
  margin: 0 auto;
}

.example-section {
  margin-bottom: var(--spacing-3xl);

  h2 {
    margin-bottom: var(--spacing-sm);
    font-size: 1.5rem;
    color: var(--hula-text-primary);
  }

  .hint {
    margin-bottom: var(--spacing-md);
    color: var(--hula-text-secondary);
    font-size: 0.875rem;
  }
}

// VirtualList styles
.virtual-list-demo {
  border: 1px solid var(--hula-border-default);
  border-radius: 12px;
  overflow: hidden;
}

.list-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--hula-border-subtle);

  &.odd {
    background: var(--hula-bg-secondary);
  }

  .item-index {
    font-weight: 600;
    color: var(--hula-text-tertiary);
    min-width: 50px;
  }

  .item-name {
    flex: 1;
    color: var(--hula-text-primary);
  }

  .item-value {
    font-family: monospace;
    color: var(--hula-text-secondary);
  }
}

.loading-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  color: var(--hula-text-secondary);
}

.list-stats {
  display: flex;
  justify-content: space-around;
  padding: var(--spacing-md);
  background: var(--hula-bg-tertiary);
  font-size: 0.875rem;
  color: var(--hula-text-secondary);
}

// Dynamic items
.dynamic-item {
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--hula-border-subtle);

  h4 {
    margin: 0 0 var(--spacing-xs) 0;
    color: var(--hula-text-primary);
  }

  p {
    margin: 0;
    color: var(--hula-text-secondary);
    font-size: 0.875rem;
  }
}

// Image gallery
.image-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--spacing-md);
}

.image-variants {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--spacing-lg);

  .variant-item {
    text-align: center;

    h4 {
      margin-bottom: var(--spacing-sm);
      color: var(--hula-text-secondary);
    }
  }
}

// Lazy components
.lazy-components {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.component-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-lg);
  background: var(--hula-bg-tertiary);
  border-radius: 8px;
  color: var(--hula-text-secondary);
}

// Performance stats
.performance-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.stat-card {
  padding: var(--spacing-lg);
  background: var(--hula-bg-elevated);
  border: 1px solid var(--hula-border-default);
  border-radius: 12px;
  text-align: center;

  h4 {
    margin: 0 0 var(--spacing-sm) 0;
    color: var(--hula-text-secondary);
    font-size: 0.875rem;
  }

  .stat-value {
    font-size: 2rem;
    font-weight: 700;
    color: var(--hula-brand-primary);
  }
}

.monitor-controls {
  display: flex;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);

  button {
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--hula-brand-primary);
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 500;

    &:hover {
      background: var(--hula-brand-primary-hover);
    }
  }
}

.report-output {
  margin-top: var(--spacing-lg);
  padding: var(--spacing-md);
  background: var(--hula-bg-tertiary);
  border-radius: 8px;
  overflow-x: auto;

  h4 {
    margin: 0 0 var(--spacing-sm) 0;
    color: var(--hula-text-primary);
  }

  pre {
    margin: 0;
    font-size: 0.75rem;
    color: var(--hula-text-secondary);
  }
}

// Demo controls
.demo-controls {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--spacing-lg);
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);

  label {
    font-weight: 500;
    color: var(--hula-text-primary);
  }

  input {
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--hula-border-default);
    border-radius: 8px;
    font-size: 1rem;
  }

  .output {
    font-size: 0.875rem;
    color: var(--hula-text-tertiary);
  }

  .scroll-box {
    height: 150px;
    overflow-y: auto;
    border: 1px solid var(--hula-border-default);
    border-radius: 8px;

    .scroll-content {
      height: 500px;
      background: linear-gradient(to bottom, var(--hula-bg-secondary), var(--hula-bg-tertiary));
    }
  }
}
</style>
