<!--
  Sticker Picker

  Send Matrix stickers using SDK.
  Browse sticker libraries, recent stickers, and favorites.

  SDK Integration:
  - client.sendMessage(roomId, { msgtype: 'm.sticker', body, url }) - Send sticker
  - client.uploadContent(blob) - Upload custom sticker
-->
<script setup lang="ts">
import { ref, computed, watch, onMounted, h } from 'vue'
import {
  NButton,
  NSpace,
  NCard,
  NInput,
  NTabs,
  NTabPane,
  NImage,
  NGrid,
  NGridItem,
  NTooltip,
  NIcon,
  NSpin,
  NEmpty,
  NUpload,
  NModal,
  NScrollbar,
  useMessage,
  NTag
} from 'naive-ui'
import { MoodHappy, Star, Clock, Plus } from '@vicons/tabler'
import { matrixClientService } from '@/integrations/matrix/client'
import { logger } from '@/utils/logger'
import { useI18n } from 'vue-i18n'
import { mediaService } from '@/services/mediaService'

interface Props {
  roomId: string
  show: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  stickerSent: [contentUri: string]
}>()

const message = useMessage()
const { t } = useI18n()

// Type definitions
interface Sticker {
  id: string
  contentUri: string // MXC URI
  thumbnailUrl?: string // HTTP URL for display
  body: string
  tags?: string[]
}

interface StickerPack {
  id: string
  title: string
  stickers: Sticker[]
  isFavorite?: boolean
}

// State
const activeTab = ref<string>('recent')
const searchQuery = ref<string>('')
const recentStickers = ref<Sticker[]>([])
const favoriteStickers = ref<Sticker[]>([])
const stickerPacks = ref<StickerPack[]>([])
const isLoading = ref<boolean>(false)
const isUploading = ref<boolean>(false)

// Computed
const show = computed({
  get: () => props.show,
  set: (value: boolean) => emit('update:show', value)
})

const filteredStickers = computed(() => {
  const allStickers = [
    ...recentStickers.value,
    ...favoriteStickers.value,
    ...stickerPacks.value.flatMap((pack) => pack.stickers)
  ]

  if (!searchQuery.value) {
    return allStickers
  }

  const query = searchQuery.value.toLowerCase()
  return allStickers.filter(
    (sticker) =>
      sticker.body.toLowerCase().includes(query) || sticker.tags?.some((tag) => tag.toLowerCase().includes(query))
  )
})

const displayedStickers = computed(() => {
  switch (activeTab.value) {
    case 'recent':
      return searchQuery.value ? filteredStickers.value : recentStickers.value
    case 'favorites':
      return searchQuery.value ? filteredStickers.value : favoriteStickers.value
    case 'library':
      return searchQuery.value ? filteredStickers.value : stickerPacks.value.flatMap((pack) => pack.stickers)
    default:
      return filteredStickers.value
  }
})

// Initialize with sample sticker packs (in production, load from Matrix content repository)
function initializeStickerPacks(): void {
  stickerPacks.value = [
    {
      id: 'pack-1',
      title: 'Emoji',
      stickers: [
        {
          id: 'sticker-1-1',
          contentUri: 'mxc://example.com/thumbsup',
          thumbnailUrl:
            'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iI2ZmZiIgZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bS0yIDE1bC01LTUgMS40MS0xLjQxTDEwIDE0LjE3bDcuNTktNy41OUwxOSA4bC05IDl6Ii8+PC9zdmc+',
          body: '👍',
          tags: ['thumb', 'up', 'approve']
        },
        {
          id: 'sticker-1-2',
          contentUri: 'mxc://example.com/heart',
          thumbnailUrl:
            'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iI2Y0NDMzNiIgZD0iTTEyIDIxLjM1bC0xLjQ1LTEuMzJDNS40IDE1LjM2IDIgMTIuMjggMiA4LjUgMiA1LjQyIDQuNDIgMyA3LjUgM2MxLjc0IDAgMy40MS44MSA0LjUgMi4wOUMxMy4wOSAzLjgxIDE0Ljc2IDMgMTYuNSAzIDE5LjU4IDMgMjIgNS40MiAyMiA4LjVjMCAzLjc4LTMuNCA2Ljg2LTguNTUgMTEuNTRMMTIgMjEuMzV6Ii8+PC9zdmc+',
          body: '❤️',
          tags: ['love', 'heart', 'like']
        },
        {
          id: 'sticker-1-3',
          contentUri: 'mxc://example.com/laugh',
          thumbnailUrl:
            'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iI2ZmYjMwMCIgZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTA2IDE0aC0zdjJoM3YtMnptLTQgMGgtMnYyaDJ2LTJ6bTQtNGMwLTMuNzMtMy4wMS03LjItNS44Mi03LjI4LTMuNDEuMDgtNS44MiAzLjU1LTUuODIgNy4yOGgyLjM2YzAtMi43IDEuOTctNS4yMiA0LjQtNS4yMiA0LjM3IDAgNC40MSAyLjcyIDQuNDggNS4yMmgyLjM2em0tMi40Mi00LjM1Yy0uNTEgMC0uOTIuNDEtLjkyLjkyczAuNDEuOTIuOTIuOTIuOTEtLjQxLjkyLS45Mi0uNDEtLjkyLS45Mi0uOTJ6bS00IDBjLS41MSAwLS45Mi40MS0uOTIuOTJzLjQxLjkyLjkyLjkyLjkxLS40MS45Mi0uOTItLjQxLS45Mi0uOTItLjkyeiIvPjwvc3ZnPg==',
          body: '😂',
          tags: ['laugh', 'joy', 'funny']
        },
        {
          id: 'sticker-1-4',
          contentUri: 'mxc://example.com/fire',
          thumbnailUrl:
            'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iI2Y1NzIyNCIgZD0iTTEzLjUgMTguNDZsLjIxLS4yOWMxLjg3LTIuNjMgNS44NS02Ljg3IDUuODUtMTAuNTRDMTkuNTYgNC40OSAxNS44NSAyIDEyIDJzLTcuNTYgMi40OS03LjU2IDUuNjNjMCAzLjY3IDMuOTcgNy45IDUuODUgMTAuNTRsLjIxLjI5em0tMy40NS0zLjM3YzAuNDIgMCAuNzYtLjM0Ljc2LS43NnMtLjM0LS43Ni0uNzYtLjc2LS43Ni4zNC0uNzYuNzYuMzQuNzYuNzYuNzZ6Ii8+PC9zdmc+',
          body: '🔥',
          tags: ['fire', 'hot', 'burn']
        },
        {
          id: 'sticker-1-5',
          contentUri: 'mxc://example.com/party',
          thumbnailUrl:
            'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iI2Q4MDA3NiIgZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bS0yIDE1bC01LTUgMS40MS0xLjQxTDEwIDE0LjE3bDcuNTktNy41OUwxOSA4bC05IDl6Ii8+PC9zdmc+',
          body: '🎉',
          tags: ['party', 'celebrate', 'confetti']
        }
      ]
    },
    {
      id: 'pack-2',
      title: 'Reactions',
      stickers: [
        {
          id: 'sticker-2-1',
          contentUri: 'mxc://example.com/thumbsdown',
          thumbnailUrl:
            'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iIzY2NiIgZD0iTTE1IDNINkMzLjkgMyAzIDMuOSAzIDZ2MTJjMCAyLjEgMS45IDMgNCAzaDl2LTJoLTN2MmgtM3YtMmgtM3YtMmgtM3YtMmgtM3YyaDN2M2g5YzEuMSAwIDItLjkgMi0yVjVjMC0xLjEtLjktMi0yLTJ6Ii8+PC9zdmc+',
          body: '👎',
          tags: ['down', 'disapprove', 'bad']
        },
        {
          id: 'sticker-2-2',
          contentUri: 'mxc://example.com/clap',
          thumbnailUrl:
            'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iIzc1NzU3NSIgZD0iTTEyLjU4IDYuMzZMMTEgNC43OWwtLjczLjczIDMuNzYgMy43Ni0uNzMuNzMtMy43NiAxLjU3IDEuNTdMMTMuOTMgOWwtLjczLjczIDEuNTctMS41N3oiLz48cGF0aCBmaWxsPSIjNzU3NTc1IiBkPSJNMTEuMjQgMjAuOTZsLTMuNTgtMy41OC0uNzMuNzMgMy41OCAzLjU4LS43My43M2wzLjU4IDMuNTguNzMtLjczLTMuNTgtMy41OHpNMTUuNzYgMTYuNDNsMy41OC0zLjU4LS43My0uNzMtMy41OCAzLjU4LjczLjczIDMuNTggMy41OC43My0uNzN6Ii8+PC9zdmc+',
          body: '👏',
          tags: ['clap', 'applause', 'praise']
        }
      ]
    }
  ]

  // Load from localStorage
  loadFromStorage()
}

// Load saved stickers from localStorage
function loadFromStorage(): void {
  try {
    const recent = localStorage.getItem(`stickers_recent_${props.roomId}`)
    if (recent) {
      recentStickers.value = JSON.parse(recent)
    }

    const favorites = localStorage.getItem('stickers_favorites')
    if (favorites) {
      favoriteStickers.value = JSON.parse(favorites)
    }
  } catch (err) {
    logger.warn('[StickerPicker] Failed to load stickers from storage:', err)
  }
}

// Save to localStorage
function saveToStorage(): void {
  try {
    localStorage.setItem(`stickers_recent_${props.roomId}`, JSON.stringify(recentStickers.value))
    localStorage.setItem('stickers_favorites', JSON.stringify(favoriteStickers.value))
  } catch (err) {
    logger.warn('[StickerPicker] Failed to save stickers to storage:', err)
  }
}

// Send sticker using SDK
async function sendSticker(sticker: Sticker): Promise<void> {
  try {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    const sendMessageMethod = (
      client as unknown as {
        sendMessage?: (roomId: string, content: Record<string, unknown>) => Promise<{ event_id?: string } | string>
      }
    ).sendMessage

    if (!sendMessageMethod) {
      throw new Error('sendMessage method not available')
    }

    const content = {
      body: sticker.body,
      url: sticker.contentUri,
      msgtype: 'm.sticker' as const
    }

    const result = await sendMessageMethod.call(client, props.roomId, content)

    const eventId = typeof result === 'string' ? result : result.event_id

    logger.info('[StickerPicker] Sticker sent:', { eventId, roomId: props.roomId })

    // Add to recent stickers
    addToRecent(sticker)

    message.success('Sticker sent')
    emit('stickerSent', sticker.contentUri)
    show.value = false
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    message.error(`Failed to send sticker: ${errorMessage}`)
    logger.error('[StickerPicker] Failed to send sticker:', err)
  }
}

// Add to recent stickers
function addToRecent(sticker: Sticker): void {
  // Remove if already exists
  recentStickers.value = recentStickers.value.filter((s) => s.id !== sticker.id)

  // Add to front
  recentStickers.value.unshift(sticker)

  // Keep only 20 recent stickers
  if (recentStickers.value.length > 20) {
    recentStickers.value = recentStickers.value.slice(0, 20)
  }

  saveToStorage()
}

// Toggle favorite
function toggleFavorite(sticker: Sticker): void {
  const index = favoriteStickers.value.findIndex((s) => s.id === sticker.id)

  if (index >= 0) {
    favoriteStickers.value.splice(index, 1)
    message.info('Removed from favorites')
  } else {
    favoriteStickers.value.push(sticker)
    message.success('Added to favorites')
  }

  saveToStorage()
}

// Check if sticker is favorite
function isFavorite(sticker: Sticker): boolean {
  return favoriteStickers.value.some((s) => s.id === sticker.id)
}

// Upload custom sticker
async function handleUpload(options: {
  file: { file?: File | null; name: string }
  onProgress?: (e: { percent: number }) => void
  onFinish?: () => void
  onError?: (error: Error) => void
}): Promise<void> {
  const uploadFile = options.file.file

  if (!uploadFile) {
    message.error('No file selected')
    return
  }

  if (!uploadFile.type.startsWith('image/')) {
    message.error('Only image files can be uploaded as stickers')
    return
  }

  isUploading.value = true

  // Report progress
  options.onProgress?.({ percent: 50 })

  try {
    // Upload using media service
    const uploadResult = await mediaService.uploadMedia(uploadFile, {
      filename: uploadFile.name,
      contentType: uploadFile.type
    })

    // Report complete
    options.onProgress?.({ percent: 100 })

    // Create sticker object
    const newSticker: Sticker = {
      id: `custom-${Date.now()}`,
      contentUri: uploadResult.contentUri,
      body: uploadFile.name.replace(/\.[^/.]+$/, ''), // Remove extension
      tags: ['custom']
    }

    // Add to favorites
    favoriteStickers.value.push(newSticker)
    saveToStorage()

    message.success('Sticker uploaded successfully')
    options.onFinish?.()
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    message.error(`Failed to upload sticker: ${errorMessage}`)
    logger.error('[StickerPicker] Failed to upload sticker:', err)
    options.onError?.(err instanceof Error ? err : new Error(errorMessage))
  } finally {
    isUploading.value = false
  }
}

// Render sticker item
function renderStickerItem(sticker: Sticker) {
  return h(
    'div',
    {
      class: 'sticker-item',
      onClick: () => sendSticker(sticker)
    },
    [
      h(
        NTooltip,
        {},
        {
          trigger: () =>
            h(
              'div',
              { class: 'sticker-image-wrapper' },
              h(NImage, {
                src: sticker.thumbnailUrl,
                alt: sticker.body,
                width: 80,
                height: 80,
                objectFit: 'contain',
                previewDisabled: true
              })
            ),
          default: () =>
            h('div', { class: 'sticker-tooltip' }, [
              h('div', { class: 'sticker-tooltip-title' }, sticker.body),
              h('div', { class: 'sticker-tooltip-actions' }, [
                h(
                  NButton,
                  {
                    size: 'tiny',
                    text: true,
                    type: isFavorite(sticker) ? 'warning' : 'default',
                    onClick: (e: Event) => {
                      e.stopPropagation()
                      toggleFavorite(sticker)
                    }
                  },
                  {
                    icon: () => h(NIcon, null, { default: () => h(Star) }),
                    default: () => (isFavorite(sticker) ? 'Favorited' : 'Favorite')
                  }
                )
              ])
            ])
        }
      )
    ]
  )
}

// Lifecycle
onMounted(() => {
  initializeStickerPacks()
})

watch(
  () => props.roomId,
  () => {
    loadFromStorage()
  }
)
</script>

<template>
  <NModal
    v-model:show="show"
    preset="card"
    title="Send Sticker"
    class="modal-container"
    :mask-closable="true"
    :segmented="{ content: 'soft' }">
    <template #header-extra>
      <NUpload :show-file-list="false" :custom-request="handleUpload" accept="image/*" :disabled="isUploading">
        <NButton size="tiny" circle :loading="isUploading">
          <template #icon>
            <NIcon><Plus /></NIcon>
          </template>
        </NButton>
      </NUpload>
    </template>

    <div class="sticker-picker">
      <!-- Search -->
      <div class="sticker-search">
        <NInput v-model:value="searchQuery" placeholder="Search stickers..." clearable size="small">
          <template #prefix>
            <NIcon size="16"><MoodHappy /></NIcon>
          </template>
        </NInput>
      </div>

      <!-- Tabs -->
      <NTabs v-model:value="activeTab" type="line" animated>
        <NTabPane name="recent" tab="Recent">
          <template #tab>
            <div class="tab-label">
              <NIcon size="16"><Clock /></NIcon>
              <span>Recent</span>
              <NTag v-if="recentStickers.length > 0" size="small" :bordered="false">
                {{ recentStickers.length }}
              </NTag>
            </div>
          </template>
        </NTabPane>

        <NTabPane name="favorites" tab="Favorites">
          <template #tab>
            <div class="tab-label">
              <NIcon size="16"><Star /></NIcon>
              <span>Favorites</span>
              <NTag v-if="favoriteStickers.length > 0" size="small" :bordered="false">
                {{ favoriteStickers.length }}
              </NTag>
            </div>
          </template>
        </NTabPane>

        <NTabPane name="library" tab="Library">
          <template #tab>
            <div class="tab-label">
              <NIcon size="16"><MoodHappy /></NIcon>
              <span>Library</span>
              <NTag size="small" :bordered="false">
                {{ stickerPacks.reduce((sum, pack) => sum + pack.stickers.length, 0) }}
              </NTag>
            </div>
          </template>
        </NTabPane>
      </NTabs>

      <!-- Stickers Grid -->
      <div class="stickers-content">
        <NScrollbar class="scrollable-area">
          <div v-if="displayedStickers.length === 0" class="stickers-empty">
            <NEmpty description="No stickers found" size="small" />
          </div>

          <NGrid v-else :cols="4" :x-gap="8" :y-gap="8" responsive="screen">
            <NGridItem v-for="sticker in displayedStickers" :key="sticker.id">
              <component :is="renderStickerItem(sticker)" />
            </NGridItem>
          </NGrid>
        </NScrollbar>
      </div>
    </div>

    <!-- Upload Hint -->
    <div v-if="activeTab === 'library'" class="sticker-upload-hint">
      <NText depth="3" class="hint-text">💡 Click the + button in the header to upload custom stickers</NText>
    </div>
  </NModal>
</template>

<style scoped>
.sticker-picker {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sticker-search {
  margin-bottom: 8px;
}

.stickers-content {
  min-height: 200px;
}

.stickers-empty {
  padding: 40px 0;
  text-align: center;
}

.sticker-item {
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.2s;
  background: var(--n-color-modal);
  border: 1px solid transparent;
}

.sticker-item:hover {
  transform: scale(1.05);
  border-color: var(--n-border-color);
  box-shadow: 0 2px 8px rgba(var(--hula-black-rgb), 0.1);
}

.sticker-image-wrapper {
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 96px;
}

.sticker-tooltip {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sticker-tooltip-title {
  font-weight: 500;
}

.sticker-tooltip-actions {
  display: flex;
  justify-content: flex-end;
}

.sticker-upload-hint {
  padding: 8px 0;
  text-align: center;
  border-top: 1px solid var(--n-border-color);
  margin-top: 8px;
}

/* Inline style replacements */
.modal-container {
  width: 500px;
  max-height: 70vh;
}

.tab-label {
  display: flex;
  align-items: center;
  gap: 6px;
}

.scrollable-area {
  max-height: 400px;
}

.hint-text {
  font-size: 11px;
}

:deep(.n-image img) {
  max-width: 100%;
  max-height: 100%;
}
</style>
