<!--
  Room Avatar Cropper

  Crop and upload room avatars using SDK.
  Supports square and circle crop shapes, zoom, and pan.

  SDK Integration:
  - client.uploadContent(blob) - Upload avatar
  - client.sendStateEvent(roomId, 'm.room.avatar', { url }) - Set room avatar
-->
<script setup lang="ts">
import { ref, computed, watch, onMounted, h, nextTick } from 'vue'
import {
  NCard,
  NButton,
  NSpace,
  NUpload,
  NModal,
  NAlert,
  NIcon,
  NSpin,
  NSlider,
  NRadioGroup,
  NRadio,
  NTooltip,
  useMessage
} from 'naive-ui'
import { CloudUpload, Check, X, Crop, ArrowBack } from '@vicons/tabler'
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
  avatarUploaded: [contentUri: string]
}>()

const message = useMessage()
const { t } = useI18n()

// Type definitions
interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

interface ImagePosition {
  x: number
  y: number
  scale: number
}

// State
const file = ref<File | null>(null)
const imageUrl = ref<string>('')
const imageElement = ref<HTMLImageElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const isUploading = ref<boolean>(false)
const isProcessing = ref<boolean>(false)
const error = ref<string>('')

// Cropper state
const cropShape = ref<'square' | 'circle'>('square')
const imagePosition = ref<ImagePosition>({ x: 0, y: 0, scale: 1 })
const isDragging = ref<boolean>(false)
const dragStart = ref<{ x: number; y: number }>({ x: 0, y: 0 })

// Computed
const show = computed({
  get: () => props.show,
  set: (value: boolean) => emit('update:show', value)
})

const hasImage = computed(() => !!imageUrl.value)
const hasError = computed(() => error.value.length > 0)

const cropSize = 300 // Base size for cropper area

// Styles
const canvasStyle = computed(() => ({
  width: `${cropSize}px`,
  height: `${cropSize}px`,
  border: '2px dashed #ccc',
  borderRadius: cropShape.value === 'circle' ? '50%' : '8px',
  overflow: 'hidden',
  position: 'relative' as const,
  cursor: isDragging.value ? 'grabbing' : 'grab',
  backgroundColor: 'var(--hula-gray-100, var(--hula-brand-primary))'
}))

const imageStyle = computed(() => ({
  position: 'absolute' as const,
  transform: `translate(${imagePosition.value.x}px, ${imagePosition.value.y}px) scale(${imagePosition.value.scale})`,
  transformOrigin: 'center center',
  maxWidth: 'none',
  maxHeight: 'none',
  pointerEvents: 'none' as const
}))

// File handling
function handleFileSelect(options: {
  file: { file?: File | null; name: string }
  onProgress?: (e: { percent: number }) => void
  onFinish?: () => void
  onError?: (error: Error) => void
}): void {
  const selectedFile = options.file.file

  if (!selectedFile) {
    message.error('No file selected')
    return
  }

  if (!selectedFile.type.startsWith('image/')) {
    message.error('Please select an image file')
    return
  }

  // Check file size (max 10MB)
  if (selectedFile.size > 10 * 1024 * 1024) {
    message.error('Image file must be smaller than 10MB')
    return
  }

  file.value = selectedFile
  loadImage(selectedFile)
}

function loadImage(file: File): void {
  isProcessing.value = true
  error.value = ''

  const reader = new FileReader()
  reader.onload = (e) => {
    imageUrl.value = e.target?.result as string

    // Load image to get dimensions
    const img = new Image()
    img.onload = () => {
      imageElement.value = img

      // Fit image to crop area
      fitImageToCropArea(img)

      isProcessing.value = false
    }
    img.onerror = () => {
      error.value = 'Failed to load image'
      isProcessing.value = false
    }
    img.src = imageUrl.value
  }
  reader.onerror = () => {
    error.value = 'Failed to read file'
    isProcessing.value = false
  }
  reader.readAsDataURL(file)
}

function fitImageToCropArea(img: HTMLImageElement): void {
  // Calculate scale to fit image within crop area
  const scaleX = cropSize / img.width
  const scaleY = cropSize / img.height
  const scale = Math.max(scaleX, scaleY)

  imagePosition.value = {
    x: 0,
    y: 0,
    scale: scale
  }
}

// Pan handling
function handleMouseDown(e: MouseEvent): void {
  if (!hasImage.value) return

  isDragging.value = true
  dragStart.value = {
    x: e.clientX - imagePosition.value.x,
    y: e.clientY - imagePosition.value.y
  }
}

function handleMouseMove(e: MouseEvent): void {
  if (!isDragging.value) return

  imagePosition.value = {
    ...imagePosition.value,
    x: e.clientX - dragStart.value.x,
    y: e.clientY - dragStart.value.y
  }
}

function handleMouseUp(): void {
  isDragging.value = false
}

// Touch handling
function handleTouchStart(e: TouchEvent): void {
  if (!hasImage.value || e.touches.length !== 1) return

  isDragging.value = true
  const touch = e.touches[0]
  dragStart.value = {
    x: touch.clientX - imagePosition.value.x,
    y: touch.clientY - imagePosition.value.y
  }
}

function handleTouchMove(e: TouchEvent): void {
  if (!isDragging.value || e.touches.length !== 1) return

  const touch = e.touches[0]
  imagePosition.value = {
    ...imagePosition.value,
    x: touch.clientX - dragStart.value.x,
    y: touch.clientY - dragStart.value.y
  }
}

function handleTouchEnd(): void {
  isDragging.value = false
}

// Zoom handling
function handleZoomChange(value: number): void {
  imagePosition.value = {
    ...imagePosition.value,
    scale: value / 100
  }
}

// Crop and upload
async function cropAndUpload(): Promise<void> {
  if (!file.value || !imageElement.value) {
    message.error('Please select an image first')
    return
  }

  isUploading.value = true
  error.value = ''

  try {
    // Create canvas for cropping
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      throw new Error('Failed to get canvas context')
    }

    // Set canvas size
    canvas.width = cropSize
    canvas.height = cropSize

    // Clear canvas
    ctx.clearRect(0, 0, cropSize, cropSize)

    // Apply transformations for crop
    const img = imageElement.value
    const pos = imagePosition.value

    // Calculate draw parameters
    const drawWidth = img.width * pos.scale
    const drawHeight = img.height * pos.scale
    const drawX = (cropSize - drawWidth) / 2 + pos.x
    const drawY = (cropSize - drawHeight) / 2 + pos.y

    // For circle crop, create clipping path
    if (cropShape.value === 'circle') {
      ctx.save()
      ctx.beginPath()
      ctx.arc(cropSize / 2, cropSize / 2, cropSize / 2, 0, Math.PI * 2)
      ctx.clip()
    }

    // Draw image
    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight)

    if (cropShape.value === 'circle') {
      ctx.restore()
    }

    // Convert to blob
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Failed to create image blob'))
          }
        },
        'image/png',
        0.9
      )
    })

    // Upload using media service
    const uploadResult = await mediaService.uploadMedia(new File([blob], 'avatar.png'), {
      filename: 'avatar.png',
      contentType: 'image/png'
    })

    logger.info('[RoomAvatarCropper] Avatar uploaded:', {
      contentUri: uploadResult.contentUri
    })

    // Set room avatar using SDK
    await setRoomAvatar(uploadResult.contentUri)

    message.success('Room avatar updated successfully')
    emit('avatarUploaded', uploadResult.contentUri)
    show.value = false

    // Reset state
    reset()
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    error.value = `Failed to upload avatar: ${errorMessage}`
    message.error(`Failed to upload avatar: ${errorMessage}`)
    logger.error('[RoomAvatarCropper] Failed to upload avatar:', err)
  } finally {
    isUploading.value = false
  }
}

async function setRoomAvatar(contentUri: string): Promise<void> {
  const client = matrixClientService.getClient()
  if (!client) {
    throw new Error('Matrix client not initialized')
  }

  const sendStateEventMethod = (
    client as unknown as {
      sendStateEvent?: (roomId: string, eventType: string, content: Record<string, unknown>) => Promise<void>
    }
  ).sendStateEvent

  if (!sendStateEventMethod) {
    throw new Error('sendStateEvent method not available')
  }

  await sendStateEventMethod.call(client, props.roomId, 'm.room.avatar', {
    url: contentUri
  })

  logger.info('[RoomAvatarCropper] Room avatar set:', { roomId: props.roomId, contentUri })
}

function reset(): void {
  file.value = null
  imageUrl.value = ''
  imageElement.value = null
  imagePosition.value = { x: 0, y: 0, scale: 1 }
  error.value = ''
}

function handleCancel(): void {
  reset()
  show.value = false
}

// Key commands
function handleKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    handleCancel()
  }
}

// Lifecycle
onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

// Cleanup
watch(
  () => props.show,
  (newShow) => {
    if (!newShow) {
      reset()
    }
  }
)
</script>

<template>
  <NModal
    v-model:show="show"
    preset="card"
    title="Upload Room Avatar"
    class="modal-medium"
    :mask-closable="false"
    :segmented="{ content: 'soft' }"
    @after-leave="reset">
    <template #header-extra>
      <NTooltip>
        <template #trigger>
          <NButton text circle size="small" @click="reset">
            <template #icon>
              <NIcon><ArrowBack /></NIcon>
            </template>
          </NButton>
        </template>
        Reset and start over
      </NTooltip>
    </template>

    <div class="avatar-cropper">
      <!-- Error Alert -->
      <NAlert v-if="hasError" type="error" :title="error" closable @close="error = ''" class="alert-spacing" />

      <!-- File Upload -->
      <div v-if="!hasImage" class="upload-section">
        <NUpload :show-file-list="false" :custom-request="handleFileSelect" accept="image/*" :disabled="isProcessing">
          <div class="upload-area">
            <NIcon size="64" color="#999">
              <CloudUpload />
            </NIcon>
            <div class="upload-text">
              <div class="upload-title">Click or drag to upload</div>
              <div class="upload-subtitle">PNG, JPG, GIF up to 10MB</div>
            </div>
          </div>
        </NUpload>
      </div>

      <!-- Cropper Section -->
      <template v-else>
        <!-- Crop Shape Selection -->
        <div class="shape-selector">
          <div class="shape-label">Shape</div>
          <NRadioGroup v-model:value="cropShape" size="small">
            <NSpace>
              <NRadio value="square">
                <div class="flex-row">
                  <div
                    :style="{
                      width: '16px',
                      height: '16px',
                      border: '2px solid currentColor',
                      borderRadius: '3px'
                    }" />
                  Square
                </div>
              </NRadio>
              <NRadio value="circle">
                <div class="flex-row">
                  <div
                    :style="{
                      width: '16px',
                      height: '16px',
                      border: '2px solid currentColor',
                      borderRadius: '50%'
                    }" />
                  Circle
                </div>
              </NRadio>
            </NSpace>
          </NRadioGroup>
        </div>

        <!-- Canvas / Preview -->
        <div class="crop-preview-wrapper">
          <div
            :style="canvasStyle"
            @mousedown="handleMouseDown"
            @mousemove="handleMouseMove"
            @mouseup="handleMouseUp"
            @mouseleave="handleMouseUp"
            @touchstart="handleTouchStart"
            @touchmove="handleTouchMove"
            @touchend="handleTouchEnd">
            <img v-if="imageUrl" :src="imageUrl" :style="imageStyle" alt="Preview" />
            <div v-if="isDragging" class="drag-overlay">
              <NIcon size="32"><Crop /></NIcon>
            </div>
          </div>
        </div>

        <!-- Zoom Control -->
        <div class="zoom-control">
          <div class="flex-row-wide">
            <span class="zoom-label">Zoom</span>
            <NSlider
              :value="imagePosition.scale * 100"
              :min="10"
              :max="300"
              :step="5"
              class="flex-1"
              @update:value="handleZoomChange" />
            <span class="zoom-value">{{ Math.round(imagePosition.scale * 100) }}%</span>
          </div>
        </div>

        <!-- Instructions -->
        <NAlert type="info" :bordered="false" class="info-alert">
          Drag to reposition, use slider to zoom. The {{ cropShape }} area will be used as the room avatar.
        </NAlert>
      </template>
    </div>

    <!-- Actions -->
    <template #footer>
      <NSpace justify="end" class="width-full">
        <NButton @click="handleCancel" :disabled="isUploading">
          <template #icon>
            <NIcon><X /></NIcon>
          </template>
          Cancel
        </NButton>
        <NButton type="primary" :disabled="!hasImage" :loading="isUploading" @click="cropAndUpload">
          <template #icon>
            <NIcon><Check /></NIcon>
          </template>
          Upload
        </NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped>
.avatar-cropper {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.upload-section {
  width: 100%;
}

.upload-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  border: 2px dashed var(--n-border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.upload-area:hover {
  border-color: var(--n-primary-color);
  background: rgba(var(--n-primary-color-rgb), 0.05);
}

.upload-text {
  text-align: center;
  margin-top: 16px;
}

.shape-selector {
  margin-bottom: 16px;
}

.crop-preview-wrapper {
  display: flex;
  justify-content: center;
  padding: 20px 0;
  background: var(--n-color-modal);
  border-radius: 8px;
}

.zoom-control {
  padding: 12px;
  background: var(--n-color-modal);
  border-radius: 6px;
}

.drag-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.1);
  color: white;
  pointer-events: none;
}

/* Prevent image dragging */
img {
  -webkit-user-drag: none;
  user-drag: none;
  user-select: none;
  -moz-user-select: none;
  -webkit-user-select: none;
  -ms-user-select: none;
}

/* Inline style replacements */
.modal-medium {
  width: 500px;
}

.alert-spacing {
  margin-bottom: 16px;
}

.upload-title {
  font-weight: 500;
  margin-bottom: 8px;
}

.upload-subtitle {
  font-size: 12px;
  color: #999;
}

.shape-label {
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 8px;
}

.flex-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.flex-row-wide {
  display: flex;
  align-items: center;
  gap: 12px;
}

.zoom-label {
  font-size: 13px;
  min-width: 40px;
}

.flex-1 {
  flex: 1;
}

.zoom-value {
  font-size: 12px;
  min-width: 40px;
  text-align: right;
}

.info-alert {
  font-size: 12px;
  margin-top: 16px;
}

.width-full {
  width: 100%;
}
</style>
