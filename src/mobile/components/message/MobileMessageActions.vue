<!-- Mobile Message Actions - Quick action menu for mobile messages -->
<template>
  <div class="mobile-message-actions">
    <!-- Action Button -->
    <div v-if="showTrigger" class="action-trigger" @click="showMenu = true">
      <van-icon name="ellipsis" :size="20" />
    </div>

    <!-- Action Menu Bottom Sheet -->
    <van-popup v-model:show="showMenu" position="bottom" :style="{ height: '70%', borderRadius: '16px 16px 0 0' }">
      <div class="actions-popup">
        <!-- Handle bar -->
        <div class="handle-bar"></div>

        <!-- Header -->
        <div class="menu-header">
          <span>{{ t('message.actions') }}</span>
          <van-icon name="cross" :size="20" @click="handleClose" />
        </div>

        <!-- Content -->
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
                @click="handleAction(action.key)">
                <div class="action-icon" :class="`action-icon-${action.key}`">
                  <van-icon :name="action.iconName" :size="24" />
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
                @click="handleAction(action.key)">
                <div class="action-item-left">
                  <van-icon :name="action.iconName" :size="18" class="list-icon" />
                  <span class="action-label">{{ action.label }}</span>
                </div>
                <van-icon v-if="action.chevron" name="arrow" :size="16" class="chevron" />
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
                @click="handleAction(action.key)">
                <div class="action-item-left">
                  <van-icon :name="action.iconName" :size="18" class="list-icon" />
                  <span class="action-label">{{ action.label }}</span>
                </div>
                <van-icon name="arrow" :size="16" class="chevron" />
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="actions-footer">
          <van-button block @click="showMenu = false" size="large">
            {{ t('common.cancel') }}
          </van-button>
        </div>
      </div>
    </van-popup>

    <!-- Edit Dialog -->
    <MobileMessageEditDialog
      v-model:show="showEditDialog"
      :room-id="props.message.roomId"
      :event-id="props.message.eventId"
      :original-content="props.message.content"
      @edited="handleMessageEdited" />

    <!-- Reply Dialog -->
    <MobileMessageReplyDialog
      v-model:show="showReplyDialog"
      :room-id="props.message.roomId"
      :reply-to-event-id="props.message.eventId"
      :reply-to-content="props.message.content"
      @sent="handleMessageReplied" />

    <!-- Forward Dialog -->
    <MobileMessageForwardDialog
      v-model:show="showForwardDialog"
      :room-id="props.message.roomId"
      :event-id="props.message.eventId"
      :content="props.message.content"
      @forwarded="handleMessageForwarded" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMessage } from '@/utils/vant-adapter'
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

// Icon name mapping for Vant
const iconMap: Record<string, string> = {
  DotsVertical: 'ellipsis',
  ChevronRight: 'arrow',
  Repeat: 'replay',
  Edit: 'edit',
  Copy: 'description',
  Share: 'share',
  Trash: 'delete',
  Flag: 'warning-o',
  Pin: 'location-o',
  Bookmark: 'star-o',
  Download: 'down',
  Select: 'checked',
  Refresh: 'replay',
  Shield: 'shield-o'
}

const getIconName = (iconName: string): string => {
  return iconMap[iconName] || 'circle'
}

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
    iconName: string
    danger?: boolean
  }> = [
    {
      key: 'reply',
      label: t('message.reply'),
      iconName: 'replay'
    },
    {
      key: 'react',
      label: t('message.reaction'),
      iconName: 'replay'
    }
  ]

  if (props.message.isOwn) {
    actions.push({
      key: 'edit',
      label: t('message.edit'),
      iconName: 'edit'
    })
  }

  actions.push({
    key: 'copy',
    label: t('message.copy'),
    iconName: 'description'
  })

  actions.push({
    key: 'forward',
    label: t('message.forward'),
    iconName: 'share'
  })

  return actions
})

const secondaryActions = computed(() => {
  const actions: Array<{
    key: string
    label: string
    iconName: string
    danger?: boolean
    chevron?: boolean
  }> = []

  if (props.message.isOwn) {
    actions.push({
      key: 'delete',
      label: t('message.delete'),
      iconName: 'delete',
      danger: true
    })
  }

  actions.push(
    {
      key: 'pin',
      label: props.message.isPinned ? t('message.unpin') : t('message.pin'),
      iconName: 'location-o',
      chevron: true
    },
    {
      key: 'bookmark',
      label: props.message.isBookmarked ? t('message.unbookmark') : t('message.bookmark'),
      iconName: 'star-o',
      chevron: true
    },
    {
      key: 'select',
      label: t('message.select'),
      iconName: 'checked',
      chevron: true
    }
  )

  // Media download action for image/video/file messages
  if (['m.image', 'm.video', 'm.file'].includes(props.message.messageType)) {
    actions.push({
      key: 'download',
      label: t('message.download'),
      iconName: 'down'
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
      iconName: 'warning-o',
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

.actions-popup {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
}

.handle-bar {
  width: 40px;
  height: 4px;
  background: var(--hula-gray-200);
  border-radius: 2px;
  margin: 8px auto;
  flex-shrink: 0;
}

.menu-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--hula-gray-100);
  flex-shrink: 0;

  span:first-child {
    font-size: 16px;
    font-weight: 600;
    color: var(--hula-gray-900);
  }

  .van-icon {
    cursor: pointer;
    color: var(--hula-gray-700);
    padding: 8px;

    &:active {
      opacity: 0.6;
    }
  }
}

.actions-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.actions-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--hula-gray-100);
  flex-shrink: 0;
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
      background: rgba(var(--hula-error-rgb), 0.1);
      color: var(--hula-error);
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
      color: var(--hula-error);
    }

    .action-label {
      color: var(--hula-error);
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
