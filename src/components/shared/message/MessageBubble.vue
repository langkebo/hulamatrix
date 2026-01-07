/** * MessageBubble - 统一的消息气泡组件 * 支持PC和移动端，多种消息类型，快捷操作 */
<template>
  <div class="message-bubble" :class="[direction, type, { 'with-actions': showActions }]">
    <!-- 发送者信息 (仅接收消息) -->
    <div v-if="direction === 'received' && showSenderInfo" class="sender-info">
      <UserAvatar
        :user-id="senderId || ''"
        :display-name="senderName"
        :avatar-url="senderAvatar || undefined"
        :size="avatarSize"
        :status="senderStatus" />
      <span class="sender-name">{{ senderName }}</span>
    </div>

    <!-- 消息内容容器 -->
    <div class="bubble-container" @click="handleClick">
      <!-- 消息气泡 -->
      <div class="bubble-content">
        <!-- 回复引用 -->
        <div v-if="replyTo" class="reply-reference">
          <div class="reply-line"></div>
          <div class="reply-content">
            <span class="reply-sender">{{ replyTo.senderName }}</span>
            <span class="reply-text">{{ truncateText(replyTo.text, 30) }}</span>
          </div>
        </div>

        <!-- 文本消息 -->
        <div v-if="type === 'text'" class="text-content">
          {{ content }}
        </div>

        <!-- 图片消息 -->
        <div v-else-if="type === 'image'" class="image-content">
          <img :src="content" :alt="'图片'" @click.stop="previewImage" loading="lazy" />
          <div v-if="loading" class="loading-overlay">
            <n-spin size="small" />
          </div>
        </div>

        <!-- 文件消息 -->
        <div v-else-if="type === 'file'" class="file-content">
          <div class="file-icon">
            <img :src="getFileIconUrl(fileType || 'file')" :alt="fileType" />
          </div>
          <div class="file-info">
            <div class="file-name">{{ fileName }}</div>
            <div class="file-meta">
              <span v-if="fileSize !== undefined" class="file-size">{{ formatFileSize(fileSize) }}</span>
              <span v-if="uploadProgress !== undefined" class="upload-progress">{{ uploadProgress }}%</span>
            </div>
          </div>
          <n-button v-if="!uploaded" size="small" type="primary" @click.stop="downloadFile">下载</n-button>
        </div>

        <!-- 语音消息 -->
        <div v-else-if="type === 'voice'" class="voice-content">
          <button class="play-button" @click.stop="togglePlay">
            <n-icon v-if="!isPlaying" :size="20">
              <PlayIcon />
            </n-icon>
            <n-icon v-else :size="20">
              <PauseIcon />
            </n-icon>
          </button>
          <div class="voice-waveform">
            <div v-for="i in 20" :key="i" class="wave-bar" :class="{ active: isPlaying }"></div>
          </div>
          <span v-if="duration !== undefined" class="voice-duration">{{ formatDuration(duration) }}</span>
        </div>

        <!-- 表情消息 (使用 public/emoji/) -->
        <div v-else-if="type === 'emoji'" class="emoji-content">
          <img :src="getEmojiUrl(content)" :alt="content" loading="lazy" />
        </div>

        <!-- 系统消息 -->
        <div v-else-if="type === 'system'" class="system-content">
          {{ content }}
        </div>
      </div>

      <!-- 时间戳和状态 -->
      <div class="message-meta">
        <span class="timestamp">{{ formatTime(timestamp) }}</span>

        <!-- 消息状态 (仅发送消息) -->
        <div v-if="direction === 'sent'" class="message-status">
          <n-icon v-if="status === 'sending'" :size="14" class="status-icon spinning">
            <ClockIcon />
          </n-icon>
          <n-icon v-else-if="status === 'sent'" :size="14" class="status-icon">
            <CheckIcon />
          </n-icon>
          <n-icon v-else-if="status === 'delivered'" :size="14" class="status-icon">
            <CheckIcon />
          </n-icon>
          <n-icon v-else-if="status === 'read'" :size="14" class="status-icon read">
            <CheckDoubleIcon />
          </n-icon>
          <n-icon v-else-if="status === 'failed'" :size="14" class="status-icon error">
            <ExclamationIcon />
          </n-icon>
        </div>
      </div>
    </div>

    <!-- 快捷操作栏 -->
    <div v-if="showActions" class="message-actions">
      <n-button-group size="small">
        <n-button @click.stop="handleReply" quaternary circle>
          <template #icon>
            <n-icon><ReplyIcon /></n-icon>
          </template>
        </n-button>
        <n-button @click.stop="handleForward" quaternary circle>
          <template #icon>
            <n-icon><ForwardIcon /></n-icon>
          </template>
        </n-button>
        <n-button @click.stop="handleReact" quaternary circle>
          <template #icon>
            <n-icon><EmojiIcon /></n-icon>
          </template>
        </n-button>
        <n-button @click.stop="handleMore" quaternary circle>
          <template #icon>
            <n-icon><MoreIcon /></n-icon>
          </template>
        </n-button>
      </n-button-group>
    </div>

    <!-- 反应表情列表 -->
    <div v-if="reactions && reactions.length > 0" class="reactions-list">
      <div
        v-for="reaction in reactions"
        :key="reaction.emoji"
        class="reaction-item"
        :class="{ reacted: reaction.hasReacted }"
        @click.stop="toggleReaction(reaction.emoji)">
        <img v-if="isCustomEmoji(reaction.emoji)" :src="getEmojiUrl(reaction.emoji)" class="reaction-emoji" />
        <span v-else class="reaction-emoji">{{ reaction.emoji }}</span>
        <span class="reaction-count">{{ reaction.count }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { NButton, NButtonGroup, NIcon, NSpin } from 'naive-ui'
import UserAvatar from '../avatar/UserAvatar.vue'
import type { AvatarSize, UserStatus } from '../avatar/UserAvatar.vue'

/**
 * 消息方向
 */
export type MessageDirection = 'sent' | 'received'

/**
 * 消息类型
 */
export type MessageType = 'text' | 'image' | 'file' | 'voice' | 'emoji' | 'system'

/**
 * 消息状态
 */
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed'

/**
 * 回复引用信息
 */
interface ReplyReference {
  messageId: string
  senderName: string
  text: string
}

/**
 * 反应信息
 */
interface Reaction {
  emoji: string
  count: number
  hasReacted: boolean
}

/**
 * Props定义
 */
interface Props {
  /** 消息ID */
  messageId: string
  /** 消息方向 */
  direction: MessageDirection
  /** 消息类型 */
  type: MessageType
  /** 消息内容 */
  content: string
  /** 发送者ID (接收消息必需) */
  senderId?: string
  /** 发送者名称 */
  senderName?: string
  /** 发送者头像 */
  senderAvatar?: string
  /** 发送者状态 */
  senderStatus?: UserStatus
  /** 时间戳 */
  timestamp: number
  /** 消息状态 */
  status?: MessageStatus
  /** 回复引用 */
  replyTo?: ReplyReference
  /** 文件类型 */
  fileType?: string
  /** 文件名 */
  fileName?: string
  /** 文件大小 */
  fileSize?: number
  /** 上传进度 */
  uploadProgress?: number
  /** 是否已上传 */
  uploaded?: boolean
  /** 语音时长(秒) */
  duration?: number
  /** 反应列表 */
  reactions?: Reaction[]
  /** 是否显示发送者信息 */
  showSenderInfo?: boolean
  /** 头像尺寸 */
  avatarSize?: AvatarSize
}

const props = withDefaults(defineProps<Props>(), {
  direction: 'received',
  type: 'text',
  status: 'sent',
  showSenderInfo: true,
  avatarSize: 'sm'
})

/**
 * 是否显示操作栏
 */
const showActions = ref(false)
const isPlaying = ref(false)
const loading = ref(!props.uploaded)

/**
 * 判断是否为自定义表情
 */
function isCustomEmoji(emoji: string): boolean {
  const customEmojis = ['party', 'rocket', 'fire', 'alien', 'bug', 'comet']
  return customEmojis.includes(emoji)
}

/**
 * 获取表情URL
 */
function getEmojiUrl(emoji: string): string {
  if (isCustomEmoji(emoji)) {
    return `/emoji/${emoji}.webp`
  }
  // 返回系统表情的URL或使用Unicode
  return emoji
}

/**
 * 获取文件类型图标URL
 */
function getFileIconUrl(fileType: string): string {
  const iconMap: Record<string, string> = {
    pdf: '/file/pdf.svg',
    doc: '/file/doc.svg',
    docx: '/file/docx.svg',
    xls: '/file/xls.svg',
    xlsx: '/file/xlsx.svg',
    ppt: '/file/ppt.svg',
    pptx: '/file/pptx.svg',
    zip: '/file/zip.svg',
    rar: '/file/rar.svg',
    txt: '/file/txt.svg',
    image: '/file/image.svg',
    video: '/file/video.svg',
    audio: '/file/audio.svg'
  }
  return iconMap[fileType.toLowerCase()] || '/file/file.svg'
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / k ** i) * 100) / 100 + ' ' + sizes[i]
}

/**
 * 格式化时长
 */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * 格式化时间戳
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  // 小于1分钟显示"刚刚"
  if (diff < 60000) {
    return '刚刚'
  }

  // 小于1小时显示分钟数
  if (diff < 3600000) {
    return `${Math.floor(diff / 60000)}分钟前`
  }

  // 今天显示时间
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }

  // 今年显示日期
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
  }

  // 其他显示完整日期
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

/**
 * 截断文本
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

/**
 * 事件处理
 */
function handleClick() {
  // 点击消息气泡
}

function previewImage() {
  // 预览图片
}

function downloadFile() {
  // 下载文件
}

function togglePlay() {
  isPlaying.value = !isPlaying.value
}

function handleReply() {
  // 回复消息
}

function handleForward() {
  // 转发消息
}

function handleReact() {
  // 添加反应
}

function handleMore() {
  // 更多操作
}

function toggleReaction(_emoji: string) {
  // 切换反应
}
</script>

<style scoped>
/* ==========================================================================
   基础布局
   ========================================================================== */
.message-bubble {
  display: flex;
  flex-direction: column;
  margin-bottom: var(--space-md);
  max-width: 70%;
  animation: messageSlideIn 0.3s ease-out;
}

@keyframes messageSlideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ==========================================================================
   发送/接收方向
   ========================================================================== */
.message-bubble.sent {
  align-self: flex-end;
  align-items: flex-end;
}

.message-bubble.received {
  align-self: flex-start;
  align-items: flex-start;
}

/* ==========================================================================
   发送者信息
   ========================================================================== */
.sender-info {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin-bottom: var(--space-xs);
}

.sender-name {
  font-size: var(--font-sm);
  font-weight: var(--font-medium);
  color: var(--pc-text-secondary);
}

/* ==========================================================================
   消息气泡容器
   ========================================================================== */
.bubble-container {
  display: flex;
  flex-direction: column;
  position: relative;
}

.bubble-container:hover .message-actions {
  opacity: 1;
  pointer-events: auto;
}

/* ==========================================================================
   消息气泡内容
   ========================================================================== */
.bubble-content {
  padding: var(--space-sm) var(--space-md);
  word-wrap: break-word;
  position: relative;
}

.text-content {
  line-height: var(--leading-normal);
  font-size: var(--font-md);
  white-space: pre-wrap;
}

/* ==========================================================================
   PC端样式
   ========================================================================== */
@media (min-width: 769px) {
  .message-bubble.sent .bubble-content {
    background: var(--pc-bubble-sent);
    color: var(--pc-bubble-sent-text);
    border-radius: var(--radius-lg) 0 var(--radius-lg) var(--radius-lg);
    box-shadow: var(--shadow-dark-sm);
  }

  .message-bubble.received .bubble-content {
    background: var(--pc-bubble-received);
    color: var(--pc-bubble-received-text);
    border-radius: 0 var(--radius-lg) var(--radius-lg) var(--radius-lg);
    box-shadow: var(--shadow-dark-sm);
  }

  .sender-name {
    color: var(--pc-text-secondary);
  }
}

/* ==========================================================================
   移动端样式
   ========================================================================== */
@media (max-width: 768px) {
  .message-bubble {
    max-width: 80%;
  }

  .message-bubble.sent .bubble-content {
    background: var(--mobile-bubble-sent);
    color: var(--mobile-bubble-sent-text);
    border-radius: var(--radius-lg) var(--radius-lg) 0 var(--radius-lg);
    box-shadow: var(--shadow-light-sm);
  }

  .message-bubble.received .bubble-content {
    background: var(--mobile-bubble-received);
    color: var(--mobile-bubble-received-text);
    border-radius: var(--radius-lg) var(--radius-lg) var(--radius-lg) 0;
    box-shadow: var(--shadow-light-sm);
  }

  .sender-name {
    color: var(--mobile-text-secondary);
  }
}

/* ==========================================================================
   回复引用
   ========================================================================== */
.reply-reference {
  display: flex;
  gap: var(--space-xs);
  margin-bottom: var(--space-xs);
  padding: var(--space-xs);
  background: rgba(0, 0, 0, 0.05);
  border-radius: var(--radius-sm);
  border-left: 2px solid var(--pc-accent-subtle);
}

.reply-line {
  width: 2px;
  background: var(--pc-accent-subtle);
}

.reply-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.reply-sender {
  font-size: var(--font-xs);
  font-weight: var(--font-semibold);
  color: var(--pc-accent-primary);
}

.reply-text {
  font-size: var(--font-xs);
  color: var(--pc-text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ==========================================================================
   图片消息
   ========================================================================== */
.image-content {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-md);
}

.image-content img {
  max-width: 100%;
  max-height: 300px;
  display: block;
  cursor: pointer;
  transition: transform 0.2s;
}

.image-content:hover img {
  transform: scale(1.02);
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
}

/* ==========================================================================
   文件消息
   ========================================================================== */
.file-content {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  min-width: 200px;
}

.file-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.file-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.file-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.file-name {
  font-size: var(--font-sm);
  font-weight: var(--font-medium);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-meta {
  display: flex;
  gap: var(--space-sm);
  font-size: var(--font-xs);
  color: var(--pc-text-tertiary);
}

/* ==========================================================================
   语音消息
   ========================================================================== */
.voice-content {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  min-width: 120px;
}

.play-button {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--pc-accent-primary);
  border: none;
  border-radius: 50%;
  color: white;
  cursor: pointer;
  transition: background 0.2s;
}

.play-button:hover {
  background: var(--pc-accent-hover);
}

.voice-waveform {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 2px;
  height: 24px;
}

.wave-bar {
  flex: 1;
  background: var(--pc-text-tertiary);
  border-radius: 2px;
  transition: height 0.2s;
}

.wave-bar.active {
  background: var(--pc-accent-primary);
  animation: waveAnimation 1s ease-in-out infinite;
}

@keyframes waveAnimation {
  0%,
  100% {
    height: 4px;
  }
  50% {
    height: 16px;
  }
}

.voice-duration {
  font-size: var(--font-xs);
  color: var(--pc-text-tertiary);
}

/* ==========================================================================
   表情消息
   ========================================================================== */
.emoji-content {
  padding: 0;
  background: transparent;
}

.emoji-content img {
  width: 64px;
  height: 64px;
  display: block;
}

/* ==========================================================================
   系统消息
   ========================================================================== */
.system-content {
  font-size: var(--font-sm);
  color: var(--pc-text-tertiary);
  text-align: center;
  padding: var(--space-sm);
}

/* ==========================================================================
   消息元数据
   ========================================================================== */
.message-meta {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin-top: var(--space-xs);
  padding: 0 var(--space-xs);
}

.timestamp {
  font-size: var(--font-xs);
  color: var(--pc-text-tertiary);
}

.message-status {
  display: flex;
  align-items: center;
}

.status-icon {
  transition: color 0.2s;
}

.status-icon.read {
  color: var(--pc-accent-primary);
}

.status-icon.error {
  color: var(--pc-error);
}

.status-icon.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* ==========================================================================
   快捷操作栏
   ========================================================================== */
.message-actions {
  margin-top: var(--space-xs);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
}

/* ==========================================================================
   反应列表
   ========================================================================== */
.reactions-list {
  display: flex;
  gap: var(--space-xs);
  margin-top: var(--space-xs);
}

.reaction-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px var(--space-xs);
  background: var(--pc-bg-elevated);
  border: 1px solid var(--pc-border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s;
}

.reaction-item:hover {
  border-color: var(--pc-accent-primary);
}

.reaction-item.reacted {
  background: var(--pc-accent-subtle);
  border-color: var(--pc-accent-primary);
}

.reaction-emoji {
  font-size: 16px;
}

.reaction-count {
  font-size: var(--font-xs);
  font-weight: var(--font-medium);
}

/* 移动端反应 */
@media (max-width: 768px) {
  .reaction-item {
    background: var(--mobile-bg-tertiary);
    border-color: var(--mobile-border-color);
  }

  .reaction-item.reacted {
    background: var(--mobile-accent-subtle);
    border-color: var(--mobile-accent-primary);
  }
}
</style>
