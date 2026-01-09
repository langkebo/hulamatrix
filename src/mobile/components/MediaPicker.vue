<script setup lang="ts">
/**
 * Mobile Media Picker Component
 * Touch-friendly media selection and preview component for mobile devices
 *
 * @module mobile/components/MediaPicker
 */

import { ref, computed } from 'vue'
import { logger } from '@/utils/logger'
import type { ClientThumbnailOptions } from '@/matrix/services/media/thumbnail'

interface Props {
  /** Maximum number of files */
  maxFiles?: number
  /** Maximum file size in bytes */
  maxSize?: number
  /** Accepted file types */
  accept?: string
  /** Enable camera capture */
  enableCamera?: boolean
  /** Enable video capture */
  enableVideo?: boolean
  /** Enable compression */
  enableCompression?: boolean
  /** Compression options */
  compressionOptions?: ClientThumbnailOptions
}

const props = withDefaults(defineProps<Props>(), {
  maxFiles: 10,
  maxSize: 10 * 1024 * 1024, // 10MB
  accept: 'image/*,video/*',
  enableCamera: true,
  enableVideo: true,
  enableCompression: true,
  compressionOptions: () => ({
    width: 1920,
    height: 1920,
    quality: 0.85,
    format: 'image/jpeg',
    maintainAspectRatio: true
  })
})

const emit = defineEmits<{
  /** Emitted when files are selected */
  selected: [files: File[]]
  /** Emitted when files are removed */
  removed: [index: number]
  /** Emitted when selection is cancelled */
  cancel: []
}>()

// State
const selectedFiles = ref<Array<{ file: File; preview?: string; id: string }>>([])
const isProcessing = ref(false)
const showCamera = ref(false)
const error = ref<string | null>(null)

// Computed
const canAddMore = computed(() => selectedFiles.value.length < props.maxFiles)
const hasFiles = computed(() => selectedFiles.value.length > 0)
const selectedCount = computed(() => selectedFiles.value.length)

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Validate file
 */
function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > props.maxSize) {
    return {
      valid: false,
      error: `File size exceeds ${Math.round(props.maxSize / 1024 / 1024)}MB limit`
    }
  }

  // Check file type
  if (props.accept && props.accept !== '*') {
    const acceptedTypes = props.accept.split(',').map((t) => t.trim())
    const matches = acceptedTypes.some((type) => {
      if (type.endsWith('/*')) {
        return file.type.startsWith(type.slice(0, -2))
      }
      return file.type === type
    })

    if (!matches) {
      return {
        valid: false,
        error: `File type ${file.type} not accepted`
      }
    }
  }

  return { valid: true }
}

/**
 * Generate preview for image/video files
 */
async function generatePreview(file: File): Promise<string | undefined> {
  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
    return undefined
  }

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)

    if (file.type.startsWith('image/')) {
      const img = new Image()
      img.onload = () => {
        URL.revokeObjectURL(url)
        resolve(url)
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        resolve(undefined)
      }
      img.src = url
    } else {
      resolve(url) // For video, just return the blob URL
    }
  })
}

/**
 * Compress image if enabled
 */
async function compressImage(file: File): Promise<File> {
  if (!props.enableCompression || !file.type.startsWith('image/')) {
    return file
  }

  try {
    const { matrixMediaMetadataService } = await import('@/matrix/services/media/metadata')

    // Check if compression is needed
    const metadata = await matrixMediaMetadataService.extractImageMetadata(file)

    if (
      metadata.width &&
      metadata.height &&
      metadata.width <= (props.compressionOptions?.width || 1920) &&
      metadata.height <= (props.compressionOptions?.height || 1920)
    ) {
      return file // No compression needed
    }

    // Generate compressed thumbnail
    const { matrixThumbnailService } = await import('@/matrix/services/media/thumbnail')
    const compressedBlob = await matrixThumbnailService.generateClientThumbnail(file, props.compressionOptions)

    return new File([compressedBlob], file.name, {
      type: props.compressionOptions?.format || 'image/jpeg',
      lastModified: Date.now()
    })
  } catch (error) {
    logger.warn('[MediaPicker] Failed to compress image, using original:', error)
    return file
  }
}

/**
 * Handle file selection
 */
async function handleFileSelect(files: FileList | File[]) {
  error.value = null
  isProcessing.value = true

  const processedFiles: File[] = []

  for (const file of Array.from(files)) {
    // Check if we can add more files
    if (!canAddMore.value) {
      error.value = `Maximum ${props.maxFiles} files allowed`
      break
    }

    // Validate file
    const validation = validateFile(file)
    if (!validation.valid) {
      error.value = validation.error || 'Invalid file'
      continue
    }

    try {
      // Compress if enabled
      const processedFile = await compressImage(file)

      // Generate preview
      const preview = await generatePreview(processedFile)

      // Add to selected files
      selectedFiles.value.push({
        file: processedFile,
        preview,
        id: generateId()
      })

      processedFiles.push(processedFile)
    } catch (err) {
      logger.error('[MediaPicker] Failed to process file:', err)
      error.value = `Failed to process ${file.name}`
    }
  }

  isProcessing.value = false

  if (processedFiles.length > 0) {
    emit('selected', processedFiles)
  }
}

/**
 * Trigger file input
 */
function triggerFileInput() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = props.accept
  input.multiple = props.maxFiles > 1

  input.onchange = (e) => {
    const target = e.target as HTMLInputElement
    if (target.files) {
      handleFileSelect(target.files)
    }
  }

  input.click()
}

/**
 * Trigger camera
 */
function triggerCamera() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.capture = 'environment'

  input.onchange = (e) => {
    const target = e.target as HTMLInputElement
    if (target.files) {
      handleFileSelect(target.files)
    }
  }

  input.click()
}

/**
 * Trigger video capture
 */
function triggerVideo() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'video/*'
  input.capture = 'environment'

  input.onchange = (e) => {
    const target = e.target as HTMLInputElement
    if (target.files) {
      handleFileSelect(target.files)
    }
  }

  input.click()
}

/**
 * Remove file
 */
function removeFile(index: number) {
  const removed = selectedFiles.value.splice(index, 1)[0]

  // Revoke preview URL
  if (removed.preview) {
    URL.revokeObjectURL(removed.preview)
  }

  emit('removed', index)
}

/**
 * Clear all files
 */
function clearAll() {
  // Revoke all preview URLs
  selectedFiles.value.forEach((item) => {
    if (item.preview) {
      URL.revokeObjectURL(item.preview)
    }
  })

  selectedFiles.value = []
  error.value = null
}

/**
 * Cancel selection
 */
function cancel() {
  clearAll()
  emit('cancel')
}

/**
 * Get selected files
 */
function getFiles(): File[] {
  return selectedFiles.value.map((item) => item.file)
}

// Expose methods
defineExpose({
  triggerFileInput,
  triggerCamera,
  triggerVideo,
  clearAll,
  getFiles
})
</script>

<template>
  <div class="mobile-media-picker">
    <!-- Selected files preview -->
    <div v-if="hasFiles" class="selected-files">
      <div v-for="(item, index) in selectedFiles" :key="item.id" class="file-preview">
        <!-- Image preview -->
        <img v-if="item.file.type.startsWith('image/')" :src="item.preview || ''" class="preview-image" alt="Preview" />

        <!-- Video preview -->
        <video v-else-if="item.file.type.startsWith('video/')" :src="item.preview" class="preview-video" muted />

        <!-- File icon -->
        <div v-else class="preview-file">
          <span class="file-icon">📄</span>
        </div>

        <!-- Remove button -->
        <button class="remove-button" @click="removeFile(index)">
          <span class="icon">×</span>
        </button>

        <!-- File info -->
        <div class="file-info">
          <p class="file-name">{{ item.file.name }}</p>
          <p class="file-size">{{ formatFileSize(item.file.size) }}</p>
        </div>
      </div>
    </div>

    <!-- Error message -->
    <Transition name="fade">
      <div v-if="error" class="error-message">
        <span class="error-icon">⚠️</span>
        {{ error }}
      </div>
    </Transition>

    <!-- Action buttons -->
    <div class="action-buttons">
      <button v-if="enableCamera && canAddMore" class="action-button camera" @click="triggerCamera">
        <span class="button-icon">📷</span>
        <span class="button-label">Camera</span>
      </button>

      <button v-if="enableVideo && canAddMore" class="action-button video" @click="triggerVideo">
        <span class="button-icon">🎥</span>
        <span class="button-label">Video</span>
      </button>

      <button v-if="canAddMore" class="action-button gallery" @click="triggerFileInput">
        <span class="button-icon">🖼️</span>
        <span class="button-label">Gallery</span>
      </button>

      <button v-if="hasFiles" class="action-button cancel" @click="cancel">
        <span class="button-icon">✕</span>
        <span class="button-label">Clear</span>
      </button>
    </div>

    <!-- Selection counter -->
    <div v-if="hasFiles" class="selection-counter">{{ selectedCount }} / {{ maxFiles }}</div>

    <!-- Processing overlay -->
    <Transition name="fade">
      <div v-if="isProcessing" class="processing-overlay">
        <div class="processing-spinner" />
        <p class="processing-text">Processing...</p>
      </div>
    </Transition>
  </div>
</template>

<script lang="ts">
/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`
}
</script>

<style scoped lang="scss">
.mobile-media-picker {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  background-color: var(--color-bg-secondary, #f5f5f5);
  border-radius: 12px;
}

.selected-files {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 12px;
}

.file-preview {
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  background-color: var(--color-bg-tertiary, #e8e8e8);
}

.preview-image,
.preview-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview-file {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.file-icon {
  font-size: 32px;
}

.remove-button {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: white;
  background-color: rgba(0, 0, 0, 0.6);
  border: none;
  border-radius: 50%;
  cursor: pointer;

  &:active {
    transform: scale(0.95);
  }
}

.file-info {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 4px 8px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.7), transparent);
  color: white;
  font-size: 10px;
}

.file-name {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  margin: 0;
  opacity: 0.8;
}

.action-buttons {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.action-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary, #333);
  background-color: white;
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 12px;
  cursor: pointer;
  transition:
    background-color 0.2s,
    transform 0.1s;

  &:active {
    transform: scale(0.98);
  }
}

.button-icon {
  font-size: 24px;
}

.button-label {
  font-size: 12px;
}

.selection-counter {
  text-align: center;
  font-size: 12px;
  color: var(--color-text-secondary, #666);
}

.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  font-size: 14px;
  color: var(--color-error, #ff4d4f);
  background-color: var(--color-bg-error, #fff2f0);
  border-radius: 8px;
}

.processing-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background-color: rgba(255, 255, 255, 0.9);
  border-radius: 12px;
}

.processing-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--color-border, #e0e0e0);
  border-top-color: var(--color-primary, #1890ff);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.processing-text {
  margin: 0;
  font-size: 14px;
  color: var(--color-text-secondary, #666);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

// Transitions
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
