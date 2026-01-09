<!-- Mobile Media Cache View - Media cache management for mobile -->
<template>
  <div class="media-cache-view">
    <!-- Header -->
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">媒体缓存</h1>
      </div>
      <div class="header-actions">
        <n-button v-if="cacheStats.totalSize > 0" text type="error" @click="handleClearAll">
          <template #icon>
            <n-icon><Trash /></n-icon>
          </template>
          清空
        </n-button>
      </div>
    </div>

    <!-- Content -->
    <div class="page-content">
      <!-- Loading State -->
      <div v-if="isLoading" class="loading-state">
        <n-spin size="large" />
        <p>加载中...</p>
      </div>

      <!-- Cache Stats -->
      <div v-else class="cache-content">
        <!-- Storage Usage Card -->
        <div class="stats-card">
          <h3 class="card-title">存储使用情况</h3>
          <div class="storage-info">
            <div class="storage-visual">
              <n-progress
                type="circle"
                :percentage="storagePercentage"
                :stroke-width="8"
                :color="getProgressColor(storagePercentage)">
                <template var(--hula-gray-100)ult="{ percentage }">
                  <span class="percentage-text">{{ percentage }}%</span>
                </template>
              </n-progress>
            </div>
            <div class="storage-details">
              <div class="detail-item">
                <span class="detail-label">已使用</span>
                <span class="detail-value">{{ formatSize(cacheStats.totalSize) }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">文件数量</span>
                <span class="detail-value">{{ cacheStats.totalItems }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">限制</span>
                <span class="detail-value">{{ formatSize(settings.maxCacheSize) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Type Breakdown -->
        <div class="type-breakdown">
          <h3 class="card-title">类型分布</h3>
          <div class="type-list">
            <div v-for="stat in cacheStats.byType" :key="stat.type" class="type-item">
              <div class="type-icon">
                <n-icon :size="24" :color="getTypeColor(stat.type)">
                  <component :is="getTypeIcon(stat.type)" />
                </n-icon>
              </div>
              <div class="type-info">
                <span class="type-name">{{ getTypeLabel(stat.type) }}</span>
                <span class="type-size">{{ formatSize(stat.size) }}</span>
              </div>
              <div class="type-count">{{ stat.count }} 项</div>
            </div>
          </div>
        </div>

        <!-- Settings -->
        <div class="settings-card">
          <h3 class="card-title">缓存设置</h3>
          <n-list hoverable clickable>
            <n-list-item>
              <template #prefix>
                <n-icon :size="20"><Database /></n-icon>
              </template>
              最大缓存大小
              <template #suffix>
                <n-select
                  v-model:value="settings.maxCacheSize"
                  :options="sizeOptions"
                  size="small"
                  class="max-cache-size-select"
                  @update:value="handleSettingChange" />
              </template>
            </n-list-item>
            <n-list-item>
              <template #prefix>
                <n-icon :size="20"><Clock /></n-icon>
              </template>
              自动清理过期
              <template #suffix>
                <n-switch v-model:value="settings.autoCleanup" @update:value="handleSettingChange" />
              </template>
            </n-list-item>
            <n-list-item @click="handleCleanupExpired">
              <template #prefix>
                <n-icon :size="20"><TrashX /></n-icon>
              </template>
              清理过期文件
              <template #suffix>
                <n-button text type="primary" size="small">立即清理</n-button>
              </template>
            </n-list-item>
          </n-list>
        </div>

        <!-- Cached Items -->
        <div class="items-section">
          <div class="section-header">
            <h3 class="card-title">缓存文件</h3>
            <n-select v-model:value="filterType" :options="filterOptions" size="small" class="filter-type-select" />
          </div>

          <div v-if="cacheItems.length === 0" class="empty-state">
            <n-empty description="暂无缓存文件" size="small" />
          </div>

          <div v-else class="items-list">
            <div v-for="item in paginatedItems" :key="item.url" class="cache-item" @click="handlePreview(item)">
              <div class="item-preview">
                <img v-if="item.type === 'image'" :src="item.preview" :alt="'图片预览: ' + item.name" />
                <n-icon v-else :size="32" :color="getTypeColor(item.type)">
                  <component :is="getTypeIcon(item.type)" />
                </n-icon>
              </div>
              <div class="item-info">
                <div class="item-name">{{ item.name || 'Unknown' }}</div>
                <div class="item-meta">
                  <span>{{ formatSize(item.size) }}</span>
                  <span>{{ formatDate(item.timestamp) }}</span>
                </div>
              </div>
              <div class="item-actions">
                <n-button text @click.stop="handleDownload(item)">
                  <template #icon>
                    <n-icon><Download /></n-icon>
                  </template>
                </n-button>
                <n-button text type="error" @click.stop="handleDelete(item)">
                  <template #icon>
                    <n-icon><Trash /></n-icon>
                  </template>
                </n-button>
              </div>
            </div>
          </div>

          <!-- Pagination -->
          <div v-if="totalPages > 1" class="pagination">
            <n-pagination v-model:page="currentPage" :page-count="totalPages" :page-size="pageSize" simple />
          </div>
        </div>
      </div>
    </div>

    <!-- Preview Modal -->
    <n-modal v-model:show="showPreview" preset="card" class="preview-modal">
      <template #header>
        <span>文件预览</span>
      </template>
      <div v-if="previewItem" class="preview-content">
        <img v-if="previewItem.type === 'image'" :src="previewItem.preview" alt="Preview" class="preview-media" />
        <video v-else-if="previewItem.type === 'video'" :src="previewItem.preview" controls class="preview-media" />
        <n-empty v-else description="无法预览此文件类型" />
        <div class="preview-info">
          <n-descriptions :column="1" bordered size="small">
            <n-descriptions-item label="文件名">
              {{ previewItem.name || 'Unknown' }}
            </n-descriptions-item>
            <n-descriptions-item label="类型">
              {{ previewItem.type }}
            </n-descriptions-item>
            <n-descriptions-item label="大小">
              {{ formatSize(previewItem.size) }}
            </n-descriptions-item>
            <n-descriptions-item label="缓存时间">
              {{ formatDate(previewItem.timestamp) }}
            </n-descriptions-item>
          </n-descriptions>
        </div>
      </div>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showPreview = false">关闭</n-button>
          <n-button v-if="previewItem" type="primary" @click="handleDownload(previewItem)">
            <template #icon>
              <n-icon><Download /></n-icon>
            </template>
            下载
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import {
  NButton,
  NIcon,
  NSpin,
  NProgress,
  NSelect,
  NSwitch,
  NList,
  NListItem,
  NModal,
  NDescriptions,
  NDescriptionsItem,
  NPagination,
  NEmpty,
  NSpace,
  useDialog,
  useMessage
} from 'naive-ui'
import { Trash, Database, Clock, TrashX, Download, Photo, Video, File, Music } from '@vicons/tabler'
import { useHaptic } from '@/composables/useMobileGestures'
import { logger } from '@/utils/logger'

// Types - Local definitions for the view
interface CacheItem {
  key: string
  url: string
  blob: Blob
  name: string
  size: number
  type: string
  timestamp: number
  preview: string
  metadata: {
    fileName: string
    mimeType: string
    [key: string]: unknown
  }
}

interface CacheStats {
  totalItems: number
  totalSize: number
  maxSize: number
  images: number
  videos: number
  audios: number
  byType: Array<{
    type: string
    count: number
    size: number
  }>
}

// IndexedDB Media Cache class
class IndexedDBMediaCache {
  private db: IDBDatabase | null = null
  private readonly DB_NAME = 'MobileMediaCache'
  private readonly STORE_NAME = 'cache'
  private readonly VERSION = 1

  async init(): Promise<void> {
    if (this.db) return

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'url' })
          store.createIndex('timestamp', 'timestamp', { unique: false })
          store.createIndex('type', 'type', { unique: false })
        }
      }
    })
  }

  async put(url: string, blob: Blob, metadata: Partial<CacheItem> = {}): Promise<void> {
    await this.init()

    const item: CacheItem = {
      key: url,
      url,
      blob,
      name: metadata.name || url.split('/').pop() || 'unknown',
      size: blob.size,
      type: metadata.type || this.getTypeFromBlob(blob),
      timestamp: Date.now(),
      preview: metadata.preview || URL.createObjectURL(blob),
      metadata: {
        fileName: metadata.name || url.split('/').pop() || 'unknown',
        mimeType: blob.type,
        ...metadata
      }
    } as CacheItem

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite')
      const store = transaction.objectStore(this.STORE_NAME)
      const request = store.put(item)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async get(url: string): Promise<Blob | undefined> {
    await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readonly')
      const store = transaction.objectStore(this.STORE_NAME)
      const request = store.get(url)

      request.onsuccess = () => {
        const item = request.result as CacheItem | undefined
        resolve(item?.blob)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async getAll(type?: string): Promise<CacheItem[]> {
    await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readonly')
      const store = transaction.objectStore(this.STORE_NAME)
      const request = store.getAll()

      request.onsuccess = () => {
        let items = request.result as CacheItem[]
        if (type) {
          items = items.filter((item) => item.type === type)
        }
        resolve(items)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async delete(url: string): Promise<void> {
    await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite')
      const store = transaction.objectStore(this.STORE_NAME)
      const request = store.delete(url)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async clear(): Promise<void> {
    await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite')
      const store = transaction.objectStore(this.STORE_NAME)
      const request = store.clear()

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getStats(): Promise<CacheStats> {
    const items = await this.getAll()

    const stats: CacheStats = {
      totalItems: items.length,
      totalSize: items.reduce((sum, item) => sum + item.size, 0),
      maxSize: 500 * 1024 * 1024, // 500MB default
      images: items.filter((i) => i.type === 'image').length,
      videos: items.filter((i) => i.type === 'video').length,
      audios: items.filter((i) => i.type === 'audio').length,
      byType: []
    }

    // Group by type
    const typeMap = new Map<string, { count: number; size: number }>()
    items.forEach((item) => {
      const existing = typeMap.get(item.type) || { count: 0, size: 0 }
      existing.count++
      existing.size += item.size
      typeMap.set(item.type, existing)
    })

    stats.byType = Array.from(typeMap.entries()).map(([type, data]) => ({
      type,
      count: data.count,
      size: data.size
    }))

    return stats
  }

  async cleanExpired(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    const items = await this.getAll()
    const now = Date.now()
    const expired = items.filter((item) => now - item.timestamp > maxAge)

    for (const item of expired) {
      await this.delete(item.url)
    }

    return expired.length
  }

  async cleanToSize(targetSize: number): Promise<number> {
    const items = await this.getAll()
    items.sort((a: CacheItem, b: CacheItem) => a.timestamp - b.timestamp)

    let deleted = 0
    let totalSize = items.reduce((sum: number, item: CacheItem) => sum + item.size, 0)

    for (const item of items) {
      if (totalSize <= targetSize) break
      await this.delete(item.url)
      totalSize -= item.size
      deleted++
    }

    return deleted
  }

  private getTypeFromBlob(blob: Blob): string {
    if (blob.type.startsWith('image/')) return 'image'
    if (blob.type.startsWith('video/')) return 'video'
    if (blob.type.startsWith('audio/')) return 'audio'
    return 'file'
  }
}

// Types
type MediaType = 'image' | 'video' | 'audio' | 'file'

// State
const cache = new IndexedDBMediaCache()
const isLoading = ref(true)
const cacheStats = ref<CacheStats>({
  totalSize: 0,
  totalItems: 0,
  maxSize: 500 * 1024 * 1024,
  images: 0,
  videos: 0,
  audios: 0,
  byType: []
})
const cacheItems = ref<CacheItem[]>([])
const showPreview = ref(false)
const previewItem = ref<CacheItem | null>(null)
const currentPage = ref(1)
const pageSize = 20
const filterType = ref<MediaType | 'all'>('all')

// Settings
const settings = ref({
  maxCacheSize: 500 * 1024 * 1024, // 500MB
  autoCleanup: true
})

const sizeOptions = [
  { label: '100MB', value: 100 * 1024 * 1024 },
  { label: '250MB', value: 250 * 1024 * 1024 },
  { label: '500MB', value: 500 * 1024 * 1024 },
  { label: '1GB', value: 1024 * 1024 * 1024 },
  { label: '2GB', value: 2 * 1024 * 1024 * 1024 }
]

const filterOptions = [
  { label: '全部', value: 'all' },
  { label: '图片', value: 'image' },
  { label: '视频', value: 'video' },
  { label: '音频', value: 'audio' },
  { label: '文件', value: 'file' }
]

const dialog = useDialog()
const message = useMessage()
const { selection, success, error: hapticError, warning } = useHaptic()

// Computed
const storagePercentage = computed(() => {
  if (settings.value.maxCacheSize === 0) return 0
  return Math.min(100, Math.round((cacheStats.value.totalSize / settings.value.maxCacheSize) * 100))
})

const filteredItems = computed(() => {
  if (filterType.value === 'all') return cacheItems.value
  return cacheItems.value.filter((item) => item.type === filterType.value)
})

const totalPages = computed(() => Math.ceil(filteredItems.value.length / pageSize))

const paginatedItems = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredItems.value.slice(start, start + pageSize)
})

// Methods
const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / k ** i).toFixed(1)} ${sizes[i]}`
}

const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) {
    return '今天'
  } else if (days === 1) {
    return '昨天'
  } else if (days < 7) {
    return `${days} 天前`
  } else {
    return date.toLocaleDateString()
  }
}

const getProgressColor = (percentage: number): string => {
  if (percentage < 50) return 'var(--hula-success)'
  if (percentage < 80) return 'var(--hula-warning)'
  return 'var(--hula-error)'
}

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'image':
      return Photo
    case 'video':
      return Video
    case 'audio':
      return Music
    default:
      return File
  }
}

const getTypeColor = (type: string): string => {
  switch (type) {
    case 'image':
      return 'var(--hula-success)'
    case 'video':
      return 'var(--hula-warning)'
    case 'audio':
      return '#7c4dff'
    default:
      return '#909090'
  }
}

const getTypeLabel = (type: string): string => {
  switch (type) {
    case 'image':
      return '图片'
    case 'video':
      return '视频'
    case 'audio':
      return '音频'
    case 'file':
      return '文件'
    default:
      return type
  }
}

const loadCacheData = async () => {
  try {
    isLoading.value = true
    const stats = await cache.getStats()
    cacheStats.value = stats
    const items = await cache.getAll()
    cacheItems.value = items.sort((a, b) => b.timestamp - a.timestamp)
  } catch (e) {
    logger.error('Failed to load cache data:', e)
  } finally {
    isLoading.value = false
  }
}

const handleSettingChange = () => {
  selection()
  // Save settings to localStorage
  localStorage.setItem('mediaCacheSettings', JSON.stringify(settings.value))
}

const handleCleanupExpired = async () => {
  warning()
  try {
    const count = await cache.cleanExpired(7 * 24 * 60 * 60 * 1000) // 7 days
    if (count > 0) {
      success()
      message.success(`已清理 ${count} 个过期文件`)
      await loadCacheData()
    } else {
      message.info('没有过期文件需要清理')
    }
  } catch (e) {
    hapticError()
    message.error('清理失败')
  }
}

const handleClearAll = () => {
  dialog.warning({
    title: '清空缓存',
    content: '确定要清空所有缓存文件吗？此操作不可恢复。',
    positiveText: '清空',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await cache.clear()
        success()
        message.success('缓存已清空')
        await loadCacheData()
      } catch (e) {
        hapticError()
        message.error('清空失败')
      }
    }
  })
}

const handlePreview = (item: CacheItem) => {
  previewItem.value = item
  showPreview.value = true
  selection()
}

const handleDownload = async (item: CacheItem) => {
  try {
    const blob = await cache.get(item.url)
    if (blob) {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = (item.metadata?.fileName as string) || 'download'
      a.click()
      URL.revokeObjectURL(url)
      success()
      message.success('下载已开始')
    } else {
      hapticError()
      message.error('文件不存在')
    }
  } catch (e) {
    hapticError()
    message.error('下载失败')
  }
}

const handleDelete = (item: CacheItem) => {
  dialog.warning({
    title: '删除文件',
    content: `确定要删除 "${item.name}" 吗？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await cache.delete(item.url)
        selection()
        message.success('文件已删除')
        await loadCacheData()
      } catch (e) {
        hapticError()
        message.error('删除失败')
      }
    }
  })
}

// Watch page changes
watch(currentPage, () => {
  selection()
})

// Lifecycle
onMounted(async () => {
  // Load settings
  const savedSettings = localStorage.getItem('mediaCacheSettings')
  if (savedSettings) {
    try {
      settings.value = JSON.parse(savedSettings)
    } catch {
      // Use defaults
    }
  }

  await loadCacheData()
})
</script>

<style scoped lang="scss">
.media-cache-view {
  min-height: 100vh;
  background: var(--bg-color);
  padding-bottom: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--card-color);
  border-bottom: 1px solid var(--border-color);
  position: sticky;
  top: 0;
  z-index: 10;

  .page-title {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
  }
}

.page-content {
  padding: 16px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  text-align: center;

  p {
    margin-top: 16px;
    color: var(--text-color-3);
  }
}

.cache-content {
  .stats-card,
  .settings-card,
  .type-breakdown {
    background: var(--card-color);
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 16px;

    .card-title {
      margin: 0 0 16px 0;
      font-size: 16px;
      font-weight: 600;
    }
  }

  .storage-info {
    display: flex;
    align-items: center;
    justify-content: space-around;
    flex-wrap: wrap;
    gap: 20px;

    .storage-visual {
      flex-shrink: 0;

      .percentage-text {
        font-size: 24px;
        font-weight: 600;
      }
    }

    .storage-details {
      flex: 1;
      min-width: 200px;

      .detail-item {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid var(--divider-color);

        &:last-child {
          border-bottom: none;
        }

        .detail-label {
          color: var(--text-color-2);
        }

        .detail-value {
          font-weight: 600;
          color: var(--text-color-1);
        }
      }
    }
  }

  .type-list {
    .type-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      border-radius: 8px;
      background: var(--bg-color);
      margin-bottom: 8px;

      .type-icon {
        flex-shrink: 0;
      }

      .type-info {
        flex: 1;

        .type-name {
          display: block;
          font-size: 14px;
          font-weight: 500;
        }

        .type-size {
          display: block;
          font-size: 12px;
          color: var(--text-color-3);
        }
      }

      .type-count {
        font-size: 12px;
        color: var(--text-color-3);
      }
    }
  }

  .items-section {
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .items-list {
      .cache-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: var(--card-color);
        border-radius: 8px;
        margin-bottom: 8px;

        .item-preview {
          width: 48px;
          height: 48px;
          flex-shrink: 0;
          border-radius: 8px;
          overflow: hidden;
          background: var(--bg-color);
          display: flex;
          align-items: center;
          justify-content: center;

          img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
        }

        .item-info {
          flex: 1;
          min-width: 0;

          .item-name {
            font-size: 14px;
            font-weight: 500;
            margin-bottom: 4px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .item-meta {
            display: flex;
            gap: 8px;
            font-size: 12px;
            color: var(--text-color-3);
          }
        }

        .item-actions {
          flex-shrink: 0;
          display: flex;
          gap: 4px;
        }
      }
    }

    .pagination {
      display: flex;
      justify-content: center;
      margin-top: 16px;
    }
  }

  .preview-content {
    img,
    video {
      max-height: 50vh;
    }

    .preview-media {
      max-width: 100%;
      border-radius: 8px;
    }

    .preview-info {
      margin-top: 16px;
    }
  }
}

.max-cache-size-select {
  width: 120px;
}

.filter-type-select {
  width: 100px;
}

.preview-modal {
  width: 90vw;
  max-width: 600px;
}

// Safe area for mobile
@supports (padding: env(safe-area-inset-bottom)) {
  .media-cache-view {
    padding-bottom: calc(20px + env(safe-area-inset-bottom));
  }
}
</style>
