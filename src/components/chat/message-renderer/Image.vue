<template>
  <div>
    <n-image
      v-if="body?.url"
      class="select-none cursor-pointer"
      :img-props="{
        style: {
          ...imageStyle
        }
      }"
      object-fit="cover"
      show-toolbar-tooltip
      preview-disabled
      style="border-radius: 8px; cursor: pointer !important"
      :src="displayImageSrc"
      @dblclick="handleOpenImageViewer"
      @click="handleOpenImage"
      @error="handleImageError">
      <template #placeholder>
        <n-flex
          v-if="!isError"
          align="center"
          justify="center"
          :style="{
            width: `${imageStyle.width}`,
            height: `${imageStyle.height}`,
            backgroundColor: '#c8c8c833'
          }"
          class="rounded-10px">
          <img class="size-24px select-none" src="@/assets/img/loading.svg" alt="loading" />
        </n-flex>
      </template>
      <template #error>
        <n-flex v-if="isError" align="center" justify="center" class="w-200px h-150px bg-#c8c8c833 rounded-10px">
          <svg class="size-34px color-[--chat-text-color]">
            <use href="#error-picture"></use>
          </svg>
        </n-flex>
      </template>
    </n-image>

    <!-- 图片预览组件 -->
    <component
      :is="ImagePreview"
      v-if="ImagePreview"
      v-model:visible="showImagePreviewRef"
      :image-url="body?.url || ''"
      :message="message" />
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue'
import { convertFileSrc } from '@tauri-apps/api/core'
import { MsgEnum } from '@/enums'
import { useImageViewer } from '@/hooks/useImageViewer'
import type { ImageBody, MsgType, MessageBodyExtensions } from '@/services/types'
import { isMobile } from '@/utils/PlatformConstants'
import { useCacheStore } from '@/stores/mediaCache'
import { useMediaStore } from '@/stores/useMediaStore'
import type { EncryptedFile } from '@/integrations/matrix/mediaCrypto'
import { fileService } from '@/services/file-service'
import { TauriCommand } from '@/enums'
import { appDataDir, join, resourceDir } from '@tauri-apps/api/path'
import { BaseDirectory, exists, mkdir, writeFile } from '@tauri-apps/plugin-fs'
import { useUserStore } from '@/stores/user'
import { useChatStore } from '@/stores/chat'
import { md5FromString } from '@/utils/Md5Util'
import { detectRemoteFileType } from '@/utils/PathUtil'
import { invokeSilently } from '@/utils/TauriInvokeHandler'
import { logger } from '@/utils/logger'

const ImagePreview = isMobile() ? defineAsyncComponent(() => import('@/mobile/components/ImagePreview.vue')) : void 0

// Extended ImageBody type with encrypted file support
type ImageBodyWithEncryption = ImageBody & {
  file?: EncryptedFile
}

// Helper to safely extract encrypted file information from MsgType
function getEncryptedFileInfo(msg: MsgType): { enc?: EncryptedFile; url: string } | null {
  // MsgType has a body property which can be ImageBody with optional extensions
  const body = msg.body as unknown as ImageBodyWithEncryption
  const enc = body?.file
  const url = body?.url || ''

  if (!enc || !url) return null
  return { enc, url }
}

// Helper to safely access encrypted file from message prop
function getMessageEncryptedFile(message: MsgType): { enc?: EncryptedFile; cipherUrl: string } | null {
  // The message prop structure: message (MsgType) -> body (unknown) -> file (EncryptedFile)
  const body = message.body as unknown as ImageBodyWithEncryption
  const enc = body?.file
  const cipherUrl = enc?.url || body?.url || ''

  if (!enc || !cipherUrl) return null
  return { enc, cipherUrl }
}

// Message interface for SAVE_MSG command
interface MessageForSave {
  message: {
    id: string
    status?: number | unknown
    body: Record<string, unknown>
  }
  [key: string]: unknown
}

const props = defineProps<{
  body: ImageBody
  onImageClick?: ((url: string) => void) | undefined
  message: MsgType
}>()
// 图片显示相关常量
const MAX_WIDTH = isMobile() ? 240 : 320
const MAX_HEIGHT = 240
const MIN_WIDTH = 60
const MIN_HEIGHT = 60
const THUMB_QUALITY = 60
// 错误状态控制
const isError = ref(false)
// 使用图片查看器hook
const { openImageViewer } = useImageViewer()
const showImagePreviewRef = ref(false)
const imagesRef = ref<string[]>([])
const cacheStore = useCacheStore()
const mediaStore = useMediaStore()
const localThumbnailSrc = ref<string | null>(null)

// 处理图片加载错误
const handleImageError = () => {
  isError.value = true
}

const handleOpenImage = () => {
  if (!isMobile()) return // 非移动端直接返回

  if (props.body?.url) {
    imagesRef.value = [props.body.url]
    showImagePreviewRef.value = true
  }
}

// 处理打开图片查看器
const handleOpenImageViewer = () => {
  if (isMobile()) {
    return
  }

  if (props.body?.url) {
    // 如果有自定义点击处理函数，使用它；否则使用默认逻辑
    if (props.onImageClick) {
      props.onImageClick(props.body.url)
    } else {
      void downloadOriginalEncryptedImage()
      openImageViewer(props.body.url, [MsgEnum.IMAGE, MsgEnum.EMOJI])
    }
  }
}

/**
 * 计算图片样式
 */
const remoteThumbnailSrc = computed(() => {
  const originalUrl = props.body?.url
  if (!originalUrl) return ''
  // Direct use of original URL - Matrix media server handles thumbnails
  return originalUrl
})

const downloadKey = computed(() => remoteThumbnailSrc.value || props.body?.url || '')

const displayImageSrc = computed(() => localThumbnailSrc.value || remoteThumbnailSrc.value)

const requestThumbnailDownload = async () => {
  if (!downloadKey.value || !props.message) return
  await mediaStore.enqueueThumbnail(props.body.url, downloadKey.value)
}

const fetchEncryptedImagePreview = async (): Promise<string | null> => {
  const encryptedInfo = getMessageEncryptedFile(props.message)
  if (!encryptedInfo) return null
  const { enc, cipherUrl } = encryptedInfo
  const res = await fileService.downloadWithResumeAndDecrypt(cipherUrl, enc)
  const plain = res.data
  try {
    const userStore = useUserStore()
    const chatStore = useChatStore()
    const dir = await userStore.getUserRoomDir()
    const folder = await join(dir, 'thumbnails')
    const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.Resource
    const existsFlag = await exists(folder, { baseDir })
    if (!existsFlag) await mkdir(folder, { baseDir, recursive: true })
    const extInfo = await detectRemoteFileType({ url: cipherUrl, fileSize: plain.length })
    const ext = extInfo?.ext || 'jpg'
    const name = `${await md5FromString(cipherUrl)}.${ext}`
    const rel = await join(folder, name)
    await writeFile(rel, plain, { baseDir })
    const baseDirPath = isMobile() ? await appDataDir() : await resourceDir()
    const abs = await join(baseDirPath, rel)
    // 持久化到消息体
    if (props.message?.id) {
      const msg = chatStore.getMessage(props.message.id)
      if (msg) {
        const nextBody = { ...(msg.message.body || {}), thumbnailPath: abs }
        chatStore.updateMsg({ msgId: msg.message.id, status: msg.message.status, body: nextBody })
        const updated = { ...msg, message: { ...msg.message, body: nextBody } }
        await invokeSilently(TauriCommand.SAVE_MSG, { data: updated as MessageForSave })
      }
    }
    return convertFileSrc(abs)
  } catch {
    return URL.createObjectURL(new Blob([plain.buffer as unknown as ArrayBuffer]))
  }
}

const ensureLocalThumbnail = async () => {
  const localPath = props.body?.thumbnailPath
  if (!localPath) {
    localThumbnailSrc.value = null
    return
  }
  try {
    const existsFlag = await exists(localPath)
    if (existsFlag) {
      localThumbnailSrc.value = convertFileSrc(localPath)
      return
    }
  } catch (error) {
    logger.warn('[Image] 检查缩略图文件失败:', error)
  }
  localThumbnailSrc.value = null
  // 移除旧的缓存条目
  cacheStore.removeCacheEntry(downloadKey.value)
  requestThumbnailDownload()
}

const downloadOriginalEncryptedImage = async () => {
  const encryptedInfo = getMessageEncryptedFile(props.message)
  if (!encryptedInfo) return
  const { enc, cipherUrl } = encryptedInfo
  if (!props.message) return
  const res = await fileService.downloadWithResumeAndDecrypt(cipherUrl, enc)
  const plain = res.data
  try {
    const userStore = useUserStore()
    const chatStore = useChatStore()
    const dir = await userStore.getUserRoomDir()
    const folder = await join(dir, 'images')
    const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.Resource
    const ok = await exists(folder, { baseDir })
    if (!ok) await mkdir(folder, { baseDir, recursive: true })
    const extInfo = await detectRemoteFileType({ url: cipherUrl, fileSize: plain.length })
    const ext = extInfo?.ext || 'jpg'
    const name = `${await md5FromString(cipherUrl)}.${ext}`
    const rel = await join(folder, name)
    await writeFile(rel, plain, { baseDir })
    const baseDirPath = isMobile() ? await appDataDir() : await resourceDir()
    const abs = await join(baseDirPath, rel)
    const msg = chatStore.getMessage(props.message.id)
    if (msg) {
      const nextBody = { ...(msg.message.body || {}), localPath: abs }
      chatStore.updateMsg({ msgId: msg.message.id, status: msg.message.status, body: nextBody })
      const updated = { ...msg, message: { ...msg.message, body: nextBody } }
      await invokeSilently(TauriCommand.SAVE_MSG, { data: updated as MessageForSave })
    }
  } catch {}
}

watch(
  () => props.body?.thumbnailPath,
  () => {
    void ensureLocalThumbnail()
  },
  { immediate: true }
)

watch(
  () => downloadKey.value,
  () => {
    if (!props.body?.thumbnailPath) {
      requestThumbnailDownload()
    }
  }
)

const imageStyle = computed(() => {
  // 如果有原始尺寸，使用原始尺寸计算
  let width = props.body?.width
  let height = props.body?.height

  // 如果没有原始尺寸，使用默认尺寸
  if (!width || !height) {
    width = MAX_WIDTH
    height = MAX_HEIGHT
  }

  const aspectRatio = width / height
  let finalWidth = width
  let finalHeight = height

  // 如果图片太大,需要等比缩放
  if (width > MAX_WIDTH || height > MAX_HEIGHT) {
    if (width / height > MAX_WIDTH / MAX_HEIGHT) {
      // 宽度超出更多,以最大宽度为基准缩放
      finalWidth = MAX_WIDTH
      finalHeight = MAX_WIDTH / aspectRatio
    } else {
      // 高度超出更多,以最大高度为基准缩放
      finalHeight = MAX_HEIGHT
      finalWidth = MAX_HEIGHT * aspectRatio
    }
  }

  // 确保不小于最小尺寸
  finalWidth = Math.max(finalWidth, MIN_WIDTH)
  finalHeight = Math.max(finalHeight, MIN_HEIGHT)

  // 向上取整避免小数导致的抖动
  return {
    width: `${Math.ceil(finalWidth)}px`,
    height: `${Math.ceil(finalHeight)}px`
  }
})

onMounted(() => {
  if (props.body?.url && !props.body?.thumbnailPath) {
    const encryptedInfo = getMessageEncryptedFile(props.message)
    if (encryptedInfo) {
      void fetchEncryptedImagePreview().then((url) => {
        localThumbnailSrc.value = url
      })
    } else {
      requestThumbnailDownload()
    }
  }
})
</script>

<style scoped></style>
