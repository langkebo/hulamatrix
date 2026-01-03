<template>
  <div class="mobile-admin-media">
    <!-- Header -->
    <van-nav-bar :title="t('admin.media.title')" left-arrow @click-left="handleBack">
      <template #right>
        <van-icon name="replay" @click="handleRefresh" />
      </template>
    </van-nav-bar>

    <!-- Stats Overview -->
    <van-cell-group inset title="媒体存储统计">
      <van-cell title="总存储空间" :value="formatBytes(stats.totalStorage)" />
      <van-cell title="媒体文件数量" :value="stats.totalMediaCount.toString()" />
      <van-cell title="本月上传" :value="stats.thisMonthUploads.toString()" />
    </van-cell-group>

    <!-- Search & Filter -->
    <van-search
      v-model="searchQuery"
      :placeholder="t('admin.media.search_placeholder')"
      @input="handleSearch" />

    <van-dropdown-menu>
      <van-dropdown-item v-model="mediaTypeFilter" :options="mediaTypeOptions" @change="handleFilterChange" />
      <van-dropdown-item v-model="sortOption" :options="sortOptions" @change="handleFilterChange" />
    </van-dropdown-menu>

    <!-- Media List -->
    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-list
        v-model:loading="loading"
        :finished="finished"
        :finished-text="t('common.no_more')"
        @load="onLoad">
        <van-card
          v-for="media in filteredMedia"
          :key="media.id"
          :thumb="media.thumbnailUrl"
          :title="media.filename"
          :desc="media.mediaId">
          <template #tags>
            <van-tag :type="getMediaTypeColor(media.type)">
              {{ getMediaTypeLabel(media.type) }}
            </van-tag>
            <van-tag type="primary">{{ formatBytes(media.size) }}</van-tag>
          </template>
          <template #footer>
            <van-space>
              <van-button size="small" @click="handleViewMedia(media)">查看</van-button>
              <van-button size="small" type="danger" @click="handleDeleteMedia(media)">删除</van-button>
            </van-space>
          </template>
        </van-card>
      </van-list>
    </van-pull-refresh>

    <!-- Empty State -->
    <van-empty v-if="filteredMedia.length === 0 && !loading" :description="t('admin.media.no_media')" />

    <!-- Media Preview -->
    <van-image-preview
      v-model:show="showPreview"
      :images="previewImages"
      :start-position="previewIndex"
      @change="onPreviewChange" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { showToast, showLoadingToast, closeToast, showConfirmDialog } from 'vant'
import { logger } from '@/utils/logger'
import { adminClient } from '@/services/adminClient'

const { t } = useI18n()
const router = useRouter()

interface Media {
  id: string
  mediaId: string
  filename: string
  type: 'image' | 'video' | 'audio' | 'file'
  size: number
  uploadDate: number
  uploaderId: string
  thumbnailUrl?: string
  url?: string
}

interface MediaStats {
  totalStorage: number
  totalMediaCount: number
  thisMonthUploads: number
  byType: Record<string, { count: number; size: number }>
}

const searchQuery = ref('')
const mediaTypeFilter = ref<'all' | 'image' | 'video' | 'audio' | 'file'>('all')
const sortOption = ref<'date' | 'size' | 'name'>('date')
const loading = ref(false)
const refreshing = ref(false)
const finished = ref(false)
const mediaList = ref<Media[]>([])
const showPreview = ref(false)
const previewIndex = ref(0)

const stats = ref<MediaStats>({
  totalStorage: 5368709120, // 5GB
  totalMediaCount: 1234,
  thisMonthUploads: 89,
  byType: {
    image: { count: 890, size: 3221225472 },
    video: { count: 156, size: 2147483648 },
    audio: { count: 98, size: 52428800 },
    file: { count: 90, size: 52428800 }
  }
})

const mediaTypeOptions = [
  { text: '全部', value: 'all' },
  { text: '图片', value: 'image' },
  { text: '视频', value: 'video' },
  { text: '音频', value: 'audio' },
  { text: '文件', value: 'file' }
]

const sortOptions = [
  { text: '最新上传', value: 'date' },
  { text: '文件大小', value: 'size' },
  { text: '文件名', value: 'name' }
]

// Mock data - Synapse Admin API doesn't provide a media listing endpoint
// Available media operations: purgeMediaCache, deleteUserMedia
// For production, consider implementing a custom backend endpoint or using database queries
const mockMedia: Media[] = [
  {
    id: 'media1',
    mediaId: 'mxc://matrix.cjystx.top/abc123',
    filename: 'photo1.jpg',
    type: 'image',
    size: 524288,
    uploadDate: Date.now() - 86400000,
    uploaderId: '@user1:matrix.cjystx.top',
    thumbnailUrl: 'https://picsum.photos/seed/media1/200/200',
    url: 'https://picsum.photos/seed/media1/800/600'
  },
  {
    id: 'media2',
    mediaId: 'mxc://matrix.cjystx.top/def456',
    filename: 'video1.mp4',
    type: 'video',
    size: 10485760,
    uploadDate: Date.now() - 172800000,
    uploaderId: '@user2:matrix.cjystx.top',
    thumbnailUrl: 'https://picsum.photos/seed/media2/200/200',
    url: 'https://picsum.photos/seed/media2/800/600'
  },
  {
    id: 'media3',
    mediaId: 'mxc://matrix.cjystx.top/ghi789',
    filename: 'document.pdf',
    type: 'file',
    size: 2097152,
    uploadDate: Date.now() - 259200000,
    uploaderId: '@user3:matrix.cjystx.top'
  }
]

const filteredMedia = computed(() => {
  let result = mediaList.value

  // Filter by type
  if (mediaTypeFilter.value !== 'all') {
    result = result.filter((media) => media.type === mediaTypeFilter.value)
  }

  // Filter by search
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(
      (media) =>
        media.filename.toLowerCase().includes(query) ||
        media.mediaId.toLowerCase().includes(query) ||
        media.uploaderId.toLowerCase().includes(query)
    )
  }

  // Sort
  result = [...result].sort((a, b) => {
    switch (sortOption.value) {
      case 'date':
        return b.uploadDate - a.uploadDate
      case 'size':
        return b.size - a.size
      case 'name':
        return a.filename.localeCompare(b.filename)
      default:
        return 0
    }
  })

  return result
})

const previewImages = computed(() => {
  return filteredMedia.value
    .filter((media) => media.type === 'image' && media.url)
    .map((media) => media.url)
    .filter((url): url is string => typeof url === 'string')
})

function getMediaTypeLabel(type?: string): string {
  const labels: Record<string, string> = {
    image: '图片',
    video: '视频',
    audio: '音频',
    file: '文件'
  }
  return labels[type || ''] || '未知'
}

function getMediaTypeColor(type?: string): 'primary' | 'success' | 'warning' | 'danger' {
  const colors: Record<string, 'primary' | 'success' | 'warning' | 'danger'> = {
    image: 'success',
    video: 'primary',
    audio: 'warning',
    file: 'primary'
  }
  return colors[type || ''] || 'primary'
}

async function onLoad() {
  try {
    // NOTE: Synapse Admin API doesn't provide a media listing endpoint
    // Available operations are limited to:
    // - purgeMediaCache(beforeTs): Purge old media from cache
    // - deleteUserMedia(userId): Delete all media from a specific user
    // For a production system, consider implementing a custom backend endpoint
    // or querying the media repository database directly
    if (mediaList.value.length === 0) {
      mediaList.value = mockMedia
    }
    loading.value = false
    finished.value = true
  } catch (error) {
    logger.error('[MobileAdminMedia] Failed to load media:', error)
    showToast.fail('加载媒体列表失败')
    loading.value = false
  }
}

async function onRefresh() {
  finished.value = false
  mediaList.value = []
  await onLoad()
  refreshing.value = false
  showToast.success('刷新成功')
}

function handleSearch() {
  // Search is handled by computed property
}

function handleFilterChange() {
  // Filter is handled by computed property
}

function handleBack() {
  router.back()
}

async function handleRefresh() {
  finished.value = false
  mediaList.value = []
  await onLoad()
  showToast.success('刷新成功')
}

function handleViewMedia(media: Media) {
  if (media.type === 'image' && media.url) {
    const index = filteredMedia.value.findIndex((m) => m.id === media.id)
    previewIndex.value = index
    showPreview.value = true
  } else {
    showToast(`查看 ${media.filename} 功能待实现`)
    // TODO: Implement media preview for non-image types
  }
}

function onPreviewChange(index: number) {
  previewIndex.value = index
}

async function handleDeleteMedia(media: Media) {
  try {
    showConfirmDialog({
      title: '删除用户媒体',
      message: `确认要删除用户 ${media.uploaderId} 的所有媒体吗？\n\n注意：Synapse Admin API 不支持删除单个媒体文件，只能删除指定用户的所有媒体。此操作不可撤销。`
    })
      .then(async () => {
        showLoadingToast({
          message: '删除中...',
          forbidClick: true,
          duration: 0
        })

        // Call AdminClient API to delete all media from the uploader
        const result = await adminClient.deleteUserMedia(media.uploaderId)

        // Remove all media from this user
        mediaList.value = mediaList.value.filter((m) => m.uploaderId !== media.uploaderId)
        stats.value.totalMediaCount -= result.deleted_media
        stats.value.totalStorage -= result.total

        closeToast()
        showToast.success(`成功删除 ${result.deleted_media} 个媒体文件`)
      })
      .catch(() => {
        // User cancelled
      })
  } catch (error) {
    logger.error('[MobileAdminMedia] Failed to delete media:', error)
    showToast.fail('删除失败')
  }
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`
}

onMounted(() => {
  onLoad()
})
</script>

<style scoped>
.mobile-admin-media {
  min-height: 100vh;
  background-color: #f7f8fa;
}

:deep(.van-card) {
  margin-top: 8px;
}
</style>
