<!-- Mobile Media Cache - IndexedDB-based persistent media cache for mobile -->
<template>
  <div class="mobile-media-cache">
    <!-- Cache Stats Card -->
    <n-card :bordered="false" class="stats-card">
      <template #header>
        <div class="card-header">
          <n-icon :size="24">
            <Database />
          </n-icon>
          <span>媒体缓存</span>
        </div>
      </template>

      <!-- Storage Usage -->
      <div class="storage-usage">
        <div class="usage-header">
          <span class="usage-label">已用存储</span>
          <span class="usage-value">{{ formattedTotalSize }} / {{ formattedMaxSize }}</span>
        </div>
        <n-progress
          type="line"
          :percentage="usagePercentage"
          :color="getUsageColor()"
          :show-indicator="false"
        />
        <div class="usage-details">
          <span>{{ usagePercentage }}% 已使用</span>
        </div>
      </div>

      <!-- Cache Stats -->
      <div class="cache-stats">
        <div class="stat-item">
          <div class="stat-value">{{ cacheStats.totalItems }}</div>
          <div class="stat-label">已缓存文件</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ cacheStats.images }}</div>
          <div class="stat-label">图片</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ cacheStats.videos }}</div>
          <div class="stat-label">视频</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ cacheStats.audios }}</div>
          <div class="stat-label">音频</div>
        </div>
      </div>
    </n-card>

    <!-- Cache Settings -->
    <n-card :bordered="false" title="缓存设置" class="settings-card">
      <n-space vertical :size="16">
        <!-- Max Cache Size -->
        <div class="setting-item">
          <div class="setting-label">
            <span>最大缓存大小</span>
            <n-text depth="3">超过此大小时将自动清理旧文件</n-text>
          </div>
          <n-select
            v-model:value="maxCacheSize"
            :options="cacheSizeOptions"
            size="small"
            style="width: 150px"
            @update:value="handleMaxSizeChange"
          />
        </div>

        <!-- Auto Cleanup -->
        <div class="setting-item">
          <div class="setting-label">
            <span>自动清理</span>
            <n-text depth="3">当缓存接近上限时自动清理</n-text>
          </div>
          <n-switch
            v-model:value="autoCleanup"
            :disabled="!cacheEnabled"
            @update:value="handleAutoCleanupChange"
          />
        </div>

        <!-- Cache Enabled -->
        <div class="setting-item">
          <div class="setting-label">
            <span>启用媒体缓存</span>
            <n-text depth="3">离线时也能查看已缓存的媒体</n-text>
          </div>
          <n-switch
            v-model:value="cacheEnabled"
            @update:value="handleCacheEnableChange"
          />
        </div>
      </n-space>
    </n-card>

    <!-- Cache Actions -->
    <n-card :bordered="false" title="缓存操作" class="actions-card">
      <n-space vertical :size="12">
        <n-button
          type="primary"
          block
          :loading="refreshing"
          @click="refreshCache"
        >
          <template #icon>
            <n-icon><Refresh /></n-icon>
          </template>
          刷新缓存状态
        </n-button>

        <n-button
          type="warning"
          block
          :disabled="cacheStats.totalItems === 0"
          :loading="cleaningExpired"
          @click="cleanExpiredItems"
        >
          <template #icon>
            <n-icon><Trash /></n-icon>
          </template>
          清理过期文件
        </n-button>

        <n-button
          type="error"
          block
          :disabled="cacheStats.totalItems === 0"
          :loading="clearing"
          @click="confirmClearAll"
        >
          <template #icon>
            <n-icon><DatabaseExport /></n-icon>
          </template>
          清空所有缓存
        </n-button>
      </n-space>
    </n-card>

    <!-- Cached Items List -->
    <n-card :bordered="false" title="已缓存文件" class="items-card">
      <template #header-extra>
        <n-dropdown :options="filterOptions" @select="handleFilterSelect">
          <n-button text>
            <template #icon>
              <n-icon><Filter /></n-icon>
            </template>
            {{ currentFilterLabel }}
          </n-button>
        </n-dropdown>
      </template>

      <!-- Loading State -->
      <div v-if="loadingItems" class="loading-state">
        <n-spin size="medium" />
        <p class="mt-12px">加载中...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredItems.length === 0" class="empty-state">
        <n-icon :size="48" color="#d0d0d0">
          <Database />
        </n-icon>
        <p>{{ cacheStats.totalItems === 0 ? '暂无缓存文件' : '没有符合条件的文件' }}</p>
      </div>

      <!-- Items List -->
      <div v-else class="items-list">
        <div
          v-for="item in paginatedItems"
          :key="item.key"
          class="cache-item"
          @click="showPreviewDialog(item)"
        >
          <!-- Thumbnail -->
          <div class="item-thumbnail" @click.stop="openItem(item)">
            <img v-if="item.type === 'image'" :src="item.url" :alt="item.name" />
            <video v-else-if="item.type === 'video'" :src="item.url" />
            <div v-else class="file-icon">
              <n-icon :size="32">
                <File v-if="item.type === 'file'" />
                <Volume v-else />
              </n-icon>
            </div>
          </div>

          <!-- Item Info -->
          <div class="item-info">
            <div class="item-name">{{ item.name }}</div>
            <div class="item-meta">
              <span>{{ formatSize(item.size) }}</span>
              <span>{{ formatDate(item.timestamp) }}</span>
            </div>
          </div>

          <!-- Actions -->
          <div class="item-actions">
            <n-button
              text
              type="error"
              size="small"
              @click.stop="deleteItem(item)"
            >
              <template #icon>
                <n-icon><Trash /></n-icon>
              </template>
            </n-button>
          </div>
        </div>
      </div>

      <!-- Load More -->
      <div v-if="hasMore && filteredItems.length > itemsPerPage" class="load-more">
        <n-button text block @click="loadMore">
          加载更多
        </n-button>
      </div>
    </n-card>

    <!-- Preview Modal -->
    <n-modal
      v-model:show="showPreview"
      preset="card"
      :style="{ width: '90%', maxWidth: '600px' }"
      @close="closePreview"
    >
      <template #header>
        <div class="preview-header">
          <span>{{ previewItem?.name }}</span>
          <span class="preview-size">{{ previewItem ? formatSize(previewItem.size) : '' }}</span>
        </div>
      </template>

      <div v-if="previewItem" class="preview-content">
        <img
          v-if="previewItem.type === 'image'"
          :src="previewItem.url"
          :alt="previewItem.name"
        />
        <video
          v-else-if="previewItem.type === 'video'"
          :src="previewItem.url"
          controls
        />
        <audio
          v-else-if="previewItem.type === 'audio'"
          :src="previewItem.url"
          controls
        />
        <div v-else class="file-preview">
          <n-icon :size="64">
            <File />
          </n-icon>
          <p>文件类型: {{ previewItem.mimeType }}</p>
        </div>
      </div>

      <template #footer>
        <n-space vertical style="width: 100%">
          <n-button type="primary" block @click="openItem(previewItem!)">
            打开文件
          </n-button>
          <n-button block @click="closePreview">
            关闭
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  NCard,
  NButton,
  NSpace,
  NSwitch,
  NSelect,
  NProgress,
  NIcon,
  NText,
  NModal,
  NSpin,
  NDropdown,
  useDialog,
  useMessage
} from 'naive-ui'
import { Database, Refresh, Trash, DatabaseExport, Filter, File, Volume, Check } from '@vicons/tabler'
import { msg } from '@/utils/SafeUI'
import { logger } from '@/utils/logger'

// ============================================================================
// IndexedDB Media Cache Implementation
// ============================================================================

interface CacheItem {
  key: string
  url: string
  blob: Blob
  name: string
  size: number
  mimeType: string
  type: 'image' | 'video' | 'audio' | 'file'
  timestamp: number
}

interface CacheStats {
  totalItems: number
  totalSize: number
  maxSize: number
  images: number
  videos: number
  audios: number
  files: number
}

const DB_NAME = 'hula-media-cache'
const DB_VERSION = 1
const STORE_NAME = 'media'

class IndexedDBMediaCache {
  private db: IDBDatabase | null = null
  private initPromise: Promise<void> | null = null

  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        reject(new Error('Failed to open database'))
      }

      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create object store with key path on 'url'
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'url' })

          // Create indexes
          store.createIndex('timestamp', 'timestamp', { unique: false })
          store.createIndex('type', 'type', { unique: false })
          store.createIndex('size', 'size', { unique: false })
        }
      }
    })

    return this.initPromise
  }

  async put(url: string, blob: Blob, metadata: Partial<CacheItem> = {}): Promise<void> {
    await this.init()

    if (!this.db) throw new Error('Database not initialized')

    const item: CacheItem = {
      key: url,
      url,
      blob,
      name: metadata.name || this.extractFileName(url),
      size: blob.size,
      mimeType: blob.type || metadata.mimeType || '',
      type: this.detectType(blob, metadata),
      timestamp: Date.now()
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put(item)

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  async get(url: string): Promise<Blob | undefined> {
    await this.init()

    if (!this.db) return undefined

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
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

    if (!this.db) return []

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
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

    if (!this.db) return

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.delete(url)

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  async clear(): Promise<void> {
    await this.init()

    if (!this.db) return

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.clear()

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
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
      files: items.filter((i) => i.type === 'file').length
    }

    return stats
  }

  async cleanExpired(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    const items = await this.getAll()
    const now = Date.now()
    const expired = items.filter((item) => now - item.timestamp > maxAge)

    await Promise.all(expired.map((item) => this.delete(item.url)))

    return expired.length
  }

  async cleanToSize(targetSize: number): Promise<number> {
    const items = await this.getAll()
    let totalSize = items.reduce((sum, item) => sum + item.size, 0)

    if (totalSize <= targetSize) return 0

    // Sort by timestamp (oldest first)
    const sorted = [...items].sort((a, b) => a.timestamp - b.timestamp)
    let deleted = 0

    for (const item of sorted) {
      if (totalSize <= targetSize) break
      await this.delete(item.url)
      totalSize -= item.size
      deleted++
    }

    return deleted
  }

  private extractFileName(url: string): string {
    try {
      const urlObj = new URL(url)
      const parts = urlObj.pathname.split('/')
      return parts[parts.length - 1] || 'unknown'
    } catch {
      return 'unknown'
    }
  }

  private detectType(blob: Blob, metadata: Partial<CacheItem>): CacheItem['type'] {
    // Check MIME type
    if (blob.type.startsWith('image/')) return 'image'
    if (blob.type.startsWith('video/')) return 'video'
    if (blob.type.startsWith('audio/')) return 'audio'

    // Check metadata
    if (metadata.type) return metadata.type

    // Default to file
    return 'file'
  }
}

// ============================================================================
// Component State
// ============================================================================

const dialog = useDialog()
const messageApi = useMessage()

// Cache instance
const mediaCache = new IndexedDBMediaCache()

// State
const cacheEnabled = ref(true)
const autoCleanup = ref(true)
const maxCacheSize = ref(500) // MB
const refreshing = ref(false)
const cleaningExpired = ref(false)
const clearing = ref(false)
const loadingItems = ref(false)

// Stats
const cacheStats = ref<CacheStats>({
  totalItems: 0,
  totalSize: 0,
  maxSize: 500 * 1024 * 1024,
  images: 0,
  videos: 0,
  audios: 0,
  files: 0
})

// Items
const cacheItems = ref<CacheItem[]>([])
const currentFilter = ref<'all' | 'image' | 'video' | 'audio' | 'file'>('all')
const itemsPerPage = 20
const currentPage = ref(1)

// Preview
const showPreview = ref(false)
const previewItem = ref<CacheItem | null>(null)

// Options
const cacheSizeOptions = [
  { label: '100 MB', value: 100 },
  { label: '250 MB', value: 250 },
  { label: '500 MB', value: 500 },
  { label: '1 GB', value: 1024 },
  { label: '2 GB', value: 2048 }
]

const filterOptions = [
  { label: '全部', key: 'all' },
  { label: '图片', key: 'image' },
  { label: '视频', key: 'video' },
  { label: '音频', key: 'audio' },
  { label: '文件', key: 'file' }
]

// Computed
const formattedTotalSize = computed(() => {
  return formatSize(cacheStats.value.totalSize)
})

const formattedMaxSize = computed(() => {
  return formatSize(cacheStats.value.maxSize)
})

const usagePercentage = computed(() => {
  return Math.round((cacheStats.value.totalSize / cacheStats.value.maxSize) * 100)
})

const filteredItems = computed(() => {
  if (currentFilter.value === 'all') {
    return cacheItems.value
  }
  return cacheItems.value.filter((item) => item.type === currentFilter.value)
})

const paginatedItems = computed(() => {
  return filteredItems.value.slice(0, currentPage.value * itemsPerPage)
})

const hasMore = computed(() => {
  return paginatedItems.value.length < filteredItems.value.length
})

const currentFilterLabel = computed(() => {
  const option = filterOptions.find((o) => o.key === currentFilter.value)
  return option?.label || '全部'
})

// Methods
const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / k ** i).toFixed(2)) + ' ' + sizes[i]
}

const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`

  return date.toLocaleDateString()
}

const getUsageColor = () => {
  const pct = usagePercentage.value
  if (pct < 50) return '#18a058'
  if (pct < 80) return '#f0a020'
  return '#d03050'
}

const refreshCache = async () => {
  refreshing.value = true

  try {
    await mediaCache.init()
    cacheStats.value = await mediaCache.getStats()
    msg.success('缓存状态已刷新')
  } catch (error) {
    logger.error('[MobileMediaCache] Failed to refresh cache:', error)
    msg.error('刷新失败')
  } finally {
    refreshing.value = false
  }
}

const loadItems = async () => {
  loadingItems.value = true

  try {
    const items = await mediaCache.getAll()
    cacheItems.value = items.sort((a, b) => b.timestamp - a.timestamp)
  } catch (error) {
    logger.error('[MobileMediaCache] Failed to load items:', error)
  } finally {
    loadingItems.value = false
  }
}

const loadMore = () => {
  currentPage.value++
}

const cleanExpiredItems = async () => {
  cleaningExpired.value = true

  try {
    const count = await mediaCache.cleanExpired()
    await refreshCache()
    await loadItems()

    if (count > 0) {
      msg.success(`已清理 ${count} 个过期文件`)
    } else {
      msg.info('没有过期文件')
    }
  } catch (error) {
    logger.error('[MobileMediaCache] Failed to clean expired:', error)
    msg.error('清理失败')
  } finally {
    cleaningExpired.value = false
  }
}

const confirmClearAll = () => {
  dialog.warning({
    title: '清空所有缓存',
    content: '确定要清空所有缓存的媒体文件吗？此操作不可撤销。',
    positiveText: '清空',
    negativeText: '取消',
    onPositiveClick: async () => {
      await clearAllCache()
    }
  })
}

const clearAllCache = async () => {
  clearing.value = true

  try {
    await mediaCache.clear()
    cacheStats.value = await mediaCache.getStats()
    cacheItems.value = []
    currentPage.value = 1
    msg.success('缓存已清空')
  } catch (error) {
    logger.error('[MobileMediaCache] Failed to clear cache:', error)
    msg.error('清空失败')
  } finally {
    clearing.value = false
  }
}

const deleteItem = async (item: CacheItem) => {
  try {
    await mediaCache.delete(item.url)
    await refreshCache()
    await loadItems()
    msg.success('文件已删除')
  } catch (error) {
    logger.error('[MobileMediaCache] Failed to delete item:', error)
    msg.error('删除失败')
  }
}

const showPreviewDialog = (item: CacheItem) => {
  previewItem.value = item
  showPreview.value = true
}

const closePreview = () => {
  showPreview.value = false
  previewItem.value = null
}

const openItem = (item: CacheItem) => {
  // Open the file in a new tab or trigger download
  window.open(item.url, '_blank')
}

const handleFilterSelect = (key: string | number) => {
  // Ensure key is a valid filter type
  const validFilters = ['all', 'image', 'video', 'audio', 'file']
  const filterKey = String(key)
  if (validFilters.includes(filterKey)) {
    currentFilter.value = filterKey as 'all' | 'image' | 'video' | 'audio' | 'file'
  }
  currentPage.value = 1
}

const handleMaxSizeChange = async (value: number) => {
  maxCacheSize.value = value

  // Update max size in cache
  cacheStats.value.maxSize = value * 1024 * 1024

  // If over limit, cleanup
  if (autoCleanup.value && cacheStats.value.totalSize > cacheStats.value.maxSize) {
    try {
      await mediaCache.cleanToSize(cacheStats.value.maxSize * 0.8)
      await refreshCache()
    } catch (error) {
      logger.error('[MobileMediaCache] Failed to cleanup after size change:', error)
    }
  }
}

const handleAutoCleanupChange = (value: boolean) => {
  autoCleanup.value = value
}

const handleCacheEnableChange = async (value: boolean) => {
  cacheEnabled.value = value

  if (!value) {
    // Offer to clear cache when disabling
    dialog.warning({
      title: '禁用缓存',
      content: '是否同时清空现有缓存？',
      positiveText: '清空',
      negativeText: '保留',
      onPositiveClick: async () => {
        await clearAllCache()
      }
    })
  }
}

// Lifecycle
onMounted(async () => {
  await refreshCache()
  await loadItems()
})
</script>

<style scoped lang="scss">
.mobile-media-cache {
  padding: 16px;
}

.stats-card {
  margin-bottom: 16px;

  .card-header {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 16px;
    font-weight: 600;
  }

  .storage-usage {
    margin-bottom: 20px;

    .usage-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;

      .usage-label {
        font-size: 14px;
        color: var(--text-color-1);
      }

      .usage-value {
        font-size: 14px;
        font-weight: 600;
        color: var(--text-color-2);
      }
    }

    .usage-details {
      margin-top: 8px;
      font-size: 12px;
      color: var(--text-color-3);
    }
  }

  .cache-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;

    .stat-item {
      text-align: center;

      .stat-value {
        font-size: 20px;
        font-weight: 700;
        color: var(--primary-color);
      }

      .stat-label {
        font-size: 12px;
        color: var(--text-color-3);
        margin-top: 4px;
      }
    }
  }
}

.settings-card,
.actions-card,
.items-card {
  margin-bottom: 16px;

  .setting-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;

    .setting-label {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 14px;
    }
  }
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;

  p {
    margin-top: 16px;
    color: var(--text-color-3);
  }
}

.items-list {
  .cache-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: var(--bg-color);
    border-radius: 8px;
    margin-bottom: 8px;
    cursor: pointer;

    &:active {
      background: var(--item-hover-bg);
    }

    .item-thumbnail {
      width: 56px;
      height: 56px;
      border-radius: 8px;
      overflow: hidden;
      background: var(--card-color);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      img,
      video {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .file-icon {
        color: var(--text-color-3);
      }
    }

    .item-info {
      flex: 1;
      min-width: 0;

      .item-name {
        font-size: 14px;
        font-weight: 500;
        color: var(--text-color-1);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .item-meta {
        display: flex;
        gap: 12px;
        font-size: 12px;
        color: var(--text-color-3);
        margin-top: 4px;
      }
    }

    .item-actions {
      flex-shrink: 0;
    }
  }
}

.load-more {
  margin-top: 12px;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .preview-size {
    font-size: 12px;
    color: var(--text-color-3);
  }
}

.preview-content {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;

  img,
  video {
    max-width: 100%;
    max-height: 400px;
    border-radius: 8px;
  }

  .file-preview {
    text-align: center;

    p {
      margin-top: 16px;
      color: var(--text-color-3);
    }
  }
}
</style>
