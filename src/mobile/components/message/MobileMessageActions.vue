<!-- Mobile Message Actions - Quick action menu for mobile messages -->
<template>
  <div class="mobile-message-actions">
    <!-- Action Button -->
    <div v-if="showTrigger" class="action-trigger" @click="showMenu = true">
      <n-icon :size="20">
        <DotsVertical />
      </n-icon>
    </div>

    <!-- Action Menu Bottom Sheet -->
    <n-modal
      v-model:show="showMenu"
      :mask-closable="true"
      :style="{
        width: '100%',
        maxWidth: '100%',
        position: 'fixed',
        bottom: '0',
        margin: '0',
        borderRadius: '16px 16px 0 0'
      }"
      preset="card"
      @close="handleClose"
    >
      <template #header>
        <div class="menu-header">
          <span>{{ t('message.actions') }}</span>
        </div>
      </template>

      <div class="actions-content">
        <!-- Message Preview -->
        <div v-if="showPreview" class="message-preview">
          <div class="preview-label">选中消息</div>
          <div class="preview-content">{{ messagePreview }}</div>
        </div>

        <!-- Primary Actions -->
        <div class="action-section">
          <div class="section-title">常用操作</div>
          <div class="action-grid">
            <div
              v-for="action in primaryActions"
              :key="action.key"
              class="action-item"
              :class="{ danger: action.danger }"
              @click="handleAction(action.key)"
            >
              <div class="action-icon" :class="`action-icon-${action.key}`">
                <n-icon :size="24">
                  <component :is="action.icon" />
                </n-icon>
              </div>
              <span class="action-label">{{ action.label }}</span>
            </div>
          </div>
        </div>

        <!-- Secondary Actions -->
        <div v-if="secondaryActions.length > 0" class="action-section">
          <div class="section-title">更多操作</div>
          <div class="action-list">
            <div
              v-for="action in secondaryActions"
              :key="action.key"
              class="action-list-item"
              :class="{ danger: action.danger }"
              @click="handleAction(action.key)"
            >
              <div class="action-item-left">
                <n-icon :size="18" class="list-icon">
                  <component :is="action.icon" />
                </n-icon>
                <span class="action-label">{{ action.label }}</span>
              </div>
              <n-icon v-if="action.chevron" :size="16" class="chevron">
                <ChevronRight />
              </n-icon>
            </div>
          </div>
        </div>

        <!-- Admin Actions (if admin) -->
        <div v-if="adminActions.length > 0" class="action-section">
          <div class="section-title">管理操作</div>
          <div class="action-list">
            <div
              v-for="action in adminActions"
              :key="action.key"
              class="action-list-item"
              :class="{ danger: action.danger }"
              @click="handleAction(action.key)"
            >
              <div class="action-item-left">
                <n-icon :size="18" class="list-icon">
                  <component :is="action.icon" />
                </n-icon>
                <span class="action-label">{{ action.label }}</span>
              </div>
              <n-icon :size="16" class="chevron">
                <ChevronRight />
              </n-icon>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <n-button block @click="showMenu = false" size="large">
          {{ t('common.cancel') }}
        </n-button>
      </template>
    </n-modal>

    <!-- Edit Dialog -->
    <MobileMessageEditDialog
      v-model:show="showEditDialog"
      :room-id="props.message.roomId"
      :event-id="props.message.eventId"
      :original-content="props.message.content"
      @edited="handleMessageEdited"
    />

    <!-- Reply Dialog -->
    <MobileMessageReplyDialog
      v-model:show="showReplyDialog"
      :room-id="props.message.roomId"
      :reply-to-event-id="props.message.eventId"
      :reply-to-content="props.message.content"
      @sent="handleMessageReplied"
    />

    <!-- Forward Dialog -->
    <MobileMessageForwardDialog
      v-model:show="showForwardDialog"
      :room-id="props.message.roomId"
      :event-id="props.message.eventId"
      :content="props.message.content"
      @forwarded="handleMessageForwarded"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { NModal, NIcon, NButton, useMessage } from 'naive-ui'
import {
  DotsVertical,
  ChevronRight,
  Repeat,
  Edit,
  Copy,
  Share,
  Trash,
  Flag,
  Pin,
  Bookmark,
  Download,
  Select,
  Refresh,
  Shield
} from '@vicons/tabler'
import MobileMessageEditDialog from './MobileMessageEditDialog.vue'
import MobileMessageReplyDialog from './MobileMessageReplyDialog.vue'
import MobileMessageForwardDialog from './MobileMessageForwardDialog.vue'
import { msg } from '@/utils/SafeUI'
import { logger } from '@/utils/logger'

interface Props {
  message: {
    eventId: string
    roomId: string
    content: string
    senderId: string
    messageType: string
    isOwn: boolean
    isPinned?: boolean
    isBookmarked?: boolean
  }
  showTrigger?: boolean
  showPreview?: boolean
  isAdmin?: boolean
}

interface Emits {
  (e: 'reply', eventId: string): void
  (e: 'edit', eventId: string): void
  (e: 'delete', eventId: string): void
  (e: 'copy', eventId: string): void
  (e: 'forward', eventId: string): void
  (e: 'pin', eventId: string): void
  (e: 'bookmark', eventId: string): void
  (e: 'report', eventId: string): void
  (e: 'select', eventId: string): void
  (e: 'close'): void
}

const props = withDefaults(defineProps<Props>(), {
  showTrigger: true,
  showPreview: true,
  isAdmin: false
})

const emit = defineEmits<Emits>()

const { t } = useI18n()
const messageApi = useMessage()

// State
const showMenu = ref(false)
const showEditDialog = ref(false)
const showReplyDialog = ref(false)
const showForwardDialog = ref(false)

// Computed
const messagePreview = computed(() => {
  const content = props.message.content || ''
  return content.length > 50 ? content.substring(0, 50) + '...' : content
})

const primaryActions = computed(() => {
  const actions: Array<{
    key: string
    label: string
    icon: Component
    danger?: boolean
  }> = [
    {
      key: 'reply',
      label: t('message.reply'),
      icon: Repeat
    },
    {
      key: 'react',
      label: t('message.reaction'),
      icon: Refresh
    }
  ]

  if (props.message.isOwn) {
    actions.push({
      key: 'edit',
      label: t('message.edit'),
      icon: Edit
    })
  }

  actions.push({
    key: 'copy',
    label: t('message.copy'),
    icon: Copy
  })

  actions.push({
    key: 'forward',
    label: t('message.forward'),
    icon: Share
  })

  return actions
})

const secondaryActions = computed(() => {
  const actions: Array<{
    key: string
    label: string
    icon: Component
    danger?: boolean
    chevron?: boolean
  }> = []

  if (props.message.isOwn) {
    actions.push({
      key: 'delete',
      label: t('message.delete'),
      icon: Trash,
      danger: true
    })
  }

  actions.push(
    {
      key: 'pin',
      label: props.message.isPinned ? t('message.unpin') : t('message.pin'),
      icon: Pin,
      chevron: true
    },
    {
      key: 'bookmark',
      label: props.message.isBookmarked ? t('message.unbookmark') : t('message.bookmark'),
      icon: Bookmark,
      chevron: true
    },
    {
      key: 'select',
      label: t('message.select'),
      icon: Select,
      chevron: true
    }
  )

  // Media download action for image/video/file messages
  if (['m.image', 'm.video', 'm.file'].includes(props.message.messageType)) {
    actions.push({
      key: 'download',
      label: t('message.download'),
      icon: Download
    })
  }

  return actions
})

const adminActions = computed(() => {
  if (!props.isAdmin) return []

  return [
    {
      key: 'report',
      label: t('message.report'),
      icon: Flag,
      danger: true
    }
  ]
})

// Methods
const handleClose = () => {
  showMenu.value = false
  emit('close')
}

const handleAction = (key: string) => {
  showMenu.value = false

  switch (key) {
    case 'reply':
      showReplyDialog.value = true
      emit('reply', props.message.eventId)
      break

    case 'edit':
      showEditDialog.value = true
      emit('edit', props.message.eventId)
      break

    case 'delete':
      confirmDelete()
      break

    case 'copy':
      copyMessage()
      emit('copy', props.message.eventId)
      break

    case 'forward':
      showForwardDialog.value = true
      emit('forward', props.message.eventId)
      break

    case 'pin':
      emit('pin', props.message.eventId)
      messageApi.success(props.message.isPinned ? '已取消置顶' : '已置顶')
      break

    case 'bookmark':
      emit('bookmark', props.message.eventId)
      messageApi.success(props.message.isBookmarked ? '已取消收藏' : '已收藏')
      break

    case 'report':
      emit('report', props.message.eventId)
      messageApi.info('举报功能开发中')
      break

    case 'select':
      emit('select', props.message.eventId)
      messageApi.info('已选中消息')
      break

    case 'download':
      downloadMedia()
      break

    case 'react':
      // Open reactions - handled by parent component
      messageApi.info('请点击消息上的表情按钮添加反应')
      break

    default:
      logger.warn('[MobileMessageActions] Unknown action:', key)
  }
}

const confirmDelete = () => {
  emit('delete', props.message.eventId)
}

const copyMessage = async () => {
  try {
    await navigator.clipboard.writeText(props.message.content)
    messageApi.success(t('message.copied'))
  } catch (error) {
    logger.error('[MobileMessageActions] Failed to copy:', error)
    messageApi.error(t('message.copyFailed'))
  }
}

const downloadMedia = async () => {
  try {
    const { mediaService } = await import('@/services/mediaService')

    // 从消息内容中提取媒体URL
    const content = props.message.content
    let mediaUrl = ''

    // 尝试解析Matrix媒体URL (mxc://)
    const mxcMatch = content.match(/mxc:\/\/([^/]+)\/([a-zA-Z0-9_-]+)/)
    if (mxcMatch) {
      const serverName = mxcMatch[1]
      const mediaId = mxcMatch[2]
      mediaUrl = `mxc://${serverName}/${mediaId}`
    } else if (content.startsWith('http')) {
      // 直接使用HTTP URL
      mediaUrl = content
    }

    if (!mediaUrl) {
      messageApi.warning('无法找到媒体文件')
      return
    }

    // 使用 mediaService 下载媒体
    const localPath = await mediaService.downloadMedia(mediaUrl)

    if (localPath) {
      messageApi.success('媒体下载成功')
      logger.info('[MobileMessageActions] Media downloaded successfully', { localPath })
    } else {
      messageApi.error('媒体下载失败')
    }
  } catch (error) {
    logger.error('[MobileMessageActions] Failed to download media:', error)
    messageApi.error('下载失败: ' + (error as Error).message)
  }
}

const handleMessageEdited = (eventId: string, newContent: string) => {
  emit('edit', eventId)
  logger.info('[MobileMessageActions] Message edited:', { eventId, newContent })
}

const handleMessageReplied = (data: unknown) => {
  emit('reply', props.message.eventId)
  logger.info('[MobileMessageActions] Message replied:', data)
}

const handleMessageForwarded = (data: unknown) => {
  emit('forward', props.message.eventId)
  messageApi.success('消息已转发')
  logger.info('[MobileMessageActions] Message forwarded:', data)
}

// Expose methods
defineExpose({
  openMenu: () => {
    showMenu.value = true
  },
  closeMenu: () => {
    showMenu.value = false
  }
})
</script>

<style scoped lang="scss">
.mobile-message-actions {
  display: inline-block;
}

.action-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  cursor: pointer;
  color: var(--text-color-3);
  transition: all 0.2s;

  &:active {
    background: var(--item-hover-bg);
  }
}

.menu-header {
  font-size: 16px;
  font-weight: 600;
  text-align: center;
}

.actions-content {
  max-height: 70vh;
  overflow-y: auto;
}

.message-preview {
  padding: 12px;
  background: var(--bg-color);
  border-radius: 8px;
  margin-bottom: 16px;

  .preview-label {
    font-size: 12px;
    color: var(--text-color-3);
    margin-bottom: 6px;
  }

  .preview-content {
    font-size: 14px;
    color: var(--text-color-1);
    line-height: 1.5;
  }
}

.action-section {
  margin-bottom: 20px;

  &:last-child {
    margin-bottom: 0;
  }

  .section-title {
    font-size: 13px;
    color: var(--text-color-3);
    margin-bottom: 10px;
    padding: 0 4px;
  }
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.action-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px 8px;
  background: var(--bg-color);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;

  &:active {
    background: var(--item-hover-bg);
    transform: scale(0.95);
  }

  &.danger {
    .action-icon {
      background: rgba(208, 48, 80, 0.1);
      color: #d03050;
    }
  }

  .action-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background: var(--primary-color);
    color: white;
    border-radius: 50%;
    transition: all 0.2s;

    &.action-icon-react {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    &.action-icon-copy {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }

    &.action-icon-forward {
      background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    }

    &.action-icon-edit {
      background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
    }

    &.action-icon-reply {
      background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
    }
  }

  .action-label {
    font-size: 12px;
    color: var(--text-color-2);
    text-align: center;
  }
}

.action-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.action-list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: var(--bg-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &:active {
    background: var(--item-hover-bg);
  }

  &.danger {
    .list-icon {
      color: #d03050;
    }

    .action-label {
      color: #d03050;
    }
  }

  .action-item-left {
    display: flex;
    align-items: center;
    gap: 12px;

    .list-icon {
      color: var(--text-color-2);
    }

    .action-label {
      font-size: 14px;
      color: var(--text-color-1);
    }
  }

  .chevron {
    color: var(--text-color-3);
  }
}

// Touch-friendly sizing
@media (pointer: coarse) {
  .action-item,
  .action-list-item,
  .action-trigger {
    min-touch-target: 44px;
  }
}
</style>
