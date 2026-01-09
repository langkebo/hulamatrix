<template>
  <n-image
    v-if="body?.url"
    class="select-none cursor-pointer emoji-message-image"
    :img-props="{
      style: {
        maxWidth: '120px',
        maxHeight: '120px',
        objectFit: 'contain'
      }
    }"
    show-toolbar-tooltip
    preview-disabled
    :src="displayEmojiSrc"
    @dblclick="handleOpenImageViewer"
    @error="handleImageError">
    <template #placeholder>
      <n-flex
        v-if="!isError"
        align="center"
        justify="center"
        :style="{
          width: '120px',
          height: '120px',
          backgroundColor: 'var(--hula-brand-primary)33'
        }"
        class="rounded-10px">
        <img class="size-24px select-none" src="@/assets/img/loading.svg" alt="loading" />
      </n-flex>
    </template>
    <template #error>
      <n-flex v-if="isError" align="center" justify="center" class="w-150px h-150px bg-var(--hula-brand-primary)33 rounded-10px">
        <svg class="size-34px color-[--chat-text-color]"><use href="#error-picture"></use></svg>
      </n-flex>
    </template>
  </n-image>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { convertFileSrc } from '@tauri-apps/api/core'
import { exists } from '@tauri-apps/plugin-fs'
import { MsgEnum } from '@/enums/index'
import { useImageViewer } from '@/hooks/useImageViewer'
import type { EmojiBody, MsgType } from '@/services/types'
import { getRemoteFileSize } from '@/utils/PathUtil'
import { logger, toError } from '@/utils/logger'

const props = defineProps<{
  body: EmojiBody
  onImageClick?: (url: string) => void
  message?: MsgType
}>()
const isError = ref(false)
const localEmojiSrc = ref<string | null>(null)
const { openImageViewer } = useImageViewer()
const EMOJI_AUTO_DOWNLOAD_LIMIT = 1024 * 1024 // 1MB

const displayEmojiSrc = computed(() => localEmojiSrc.value || props.body?.url || '')

const handleImageError = () => {
  isError.value = true
  logger.error('表情包加载失败:', toError(props.body.url))
}

const handleOpenImageViewer = () => {
  if (!props.body?.url) return
  if (props.onImageClick) {
    props.onImageClick(displayEmojiSrc.value)
  } else {
    openImageViewer(props.body.url, [MsgEnum.IMAGE, MsgEnum.EMOJI])
  }
}

const ensureLocalEmoji = async () => {
  const localPath = props.body?.localPath
  if (!localPath) {
    localEmojiSrc.value = null
    await maybeDownloadEmoji()
    return
  }
  try {
    const existsFlag = await exists(localPath)
    if (existsFlag) {
      localEmojiSrc.value = convertFileSrc(localPath)
      return
    }
  } catch (error) {
    logger.warn('[Emoji] 检查本地表情失败:', toError(error))
  }
  localEmojiSrc.value = null
  await maybeDownloadEmoji()
}

const maybeDownloadEmoji = async () => {
  if (!props.body?.url) return

  // Auto-download emoji files smaller than 1MB for better UX
  // Note: Local caching can be implemented when useMediaStore is integrated
  try {
    const size = await getRemoteFileSize(props.body.url)
    if (size === null || size > EMOJI_AUTO_DOWNLOAD_LIMIT) {
      return
    }
    // Future implementation: use mediaStore.downloadMedia() for caching
  } catch (error) {
    logger.warn('[Emoji] 检查表情文件大小失败:', toError(error))
  }
}

watch(
  () => props.body?.localPath,
  () => {
    void ensureLocalEmoji()
  },
  { immediate: true }
)

watch(
  () => props.message?.id,
  () => {
    if (!props.body?.localPath) {
      void maybeDownloadEmoji()
    }
  }
)
</script>

<style scoped>
.emoji-message-image {
  border-radius: 8px;
  cursor: pointer !important;
}
</style>
