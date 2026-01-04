<template>
  <div
    class="matrix-message"
    :class="[
      `message-${message.type}`,
      { 'is-own': isOwnMessage, 'is-reply': isReply, 'is-encrypted': isEncrypted }
    ]"
  >
    <!-- Sender Avatar (not for own messages) -->
    <div v-if="!isOwnMessage && showAvatar" class="message-avatar">
      <n-avatar
        v-bind="senderAvatar !== undefined ? { src: senderAvatar } : {}"
        :fallback-src="'/default-avatar.png'"
        round
        size="medium"
      >
        {{ senderInitials }}
      </n-avatar>
    </div>

    <!-- Message Content -->
    <div class="message-content">
      <!-- Sender Info (for group messages) -->
      <div v-if="!isOwnMessage && showSenderInfo" class="message-sender">
        <span class="sender-name">{{ senderDisplayName }}</span>
        <n-tag
          v-if="isModerator"
          size="tiny"
          type="warning"
          round
        >
          管理员
        </n-tag>
      </div>

      <!-- Reply Indicator -->
      <div v-if="isReply" class="reply-indicator">
        <n-icon :component="ArrowLeft" />
        <span>回复 {{ replyMessage?.sender?.displayName || replyMessage?.fromUser?.uid || '未知' }}</span>
      </div>

      <!-- Message Body -->
      <div class="message-body">
        <!-- Text Message -->
        <div v-if="message.type === MsgEnum.TEXT" class="text-message">
          <div class="message-text" v-html="sanitizedText"></div>
        </div>

        <!-- Image Message -->
        <div v-else-if="message.type === MsgEnum.IMAGE" class="image-message">
          <div class="image-container" @click="previewImage">
            <n-image
              v-if="message.body.url"
              :src="message.body.url"
              :alt="message.body.text ?? '图片'"
              :previewed-img-props="{ alt: message.body.text ?? '图片' }"
              lazy
              object-fit="cover"
            >
              <template #placeholder>
                <div class="image-placeholder">
                  <n-icon size="24" :component="Photo" />
                  <span>加载中...</span>
                </div>
              </template>
            </n-image>
          </div>
          <div v-if="message.body.text" class="image-caption">
            {{ message.body.text }}
          </div>
        </div>

        <!-- Video Message -->
        <div v-else-if="message.type === MsgEnum.VIDEO" class="video-message">
          <div class="video-container">
            <video
              :src="message.body.url"
              :poster="message.body.thumbnailUrl"
              controls
              preload="metadata"
            >
              您的浏览器不支持视频播放
            </video>
            <div v-if="message.body.duration" class="video-duration">
              {{ formatDuration(message.body.duration) }}
            </div>
          </div>
          <div v-if="message.body.text" class="video-caption">
            {{ message.body.text }}
          </div>
        </div>

        <!-- Audio/Voice Message -->
        <div v-else-if="message.type === MsgEnum.VOICE" class="voice-message">
          <div class="voice-player">
            <n-button
              circle
              type="primary"
              @click="toggleVoicePlayback"
            >
              <n-icon
                :component="isPlaying ? PlayerPause : PlayerPlay"
                size="20"
              />
            </n-button>
            <div class="voice-info">
              <div class="voice-waveform">
                <!-- Simple waveform visualization -->
                <div
                  v-for="i in 20"
                  :key="i"
                  class="wave-bar"
                  :style="{ height: `${Math.random() * 100}%` }"
                ></div>
              </div>
              <div class="voice-duration">
                {{ formatDuration(message.body.duration ?? 0) }}
              </div>
            </div>
          </div>
        </div>

        <!-- File Message -->
        <div v-else-if="message.type === MsgEnum.FILE" class="file-message">
          <div class="file-container" @click="downloadFile">
            <n-icon size="24" :component="FileText" />
            <div class="file-info">
              <span class="file-name">{{ message.body.fileName || '未知文件' }}</span>
              <span class="file-size">{{ formatFileSize(message.body.fileSize ?? 0) }}</span>
            </div>
            <n-button quaternary size="small">
              <n-icon :component="Download" />
            </n-button>
          </div>
        </div>

        <!-- Location Message -->
        <div v-else-if="message.type === MsgEnum.LOCATION" class="location-message">
          <div class="location-container">
            <div class="location-map">
              <img
                :src="`https://maps.googleapis.com/maps/api/staticmap?center=${message.body.latitude},${message.body.longitude}&zoom=15&size=400x200&markers=${message.body.latitude},${message.body.longitude}`"
                :alt="message.body.description || '位置'"
              />
            </div>
            <div class="location-info">
              <n-icon :component="MapPin" />
              <span>{{ message.body.description || '位置信息' }}</span>
            </div>
          </div>
        </div>

        <!-- Notice Message -->
        <div v-else-if="message.type === MsgEnum.NOTICE" class="notice-message">
          <n-icon :component="Bell" />
          <span>{{ message.body.text }}</span>
        </div>

        <!-- Encrypted Message -->
        <div v-else-if="isEncrypted" class="encrypted-message">
          <n-icon :component="Lock" />
          <span>{{ isDecrypted ? message.body.text : '[加密消息]' }}</span>
          <n-button
            v-if="!isDecrypted"
            text
            size="tiny"
            @click="decryptMessage"
          >
            解密
          </n-button>
        </div>

        <!-- Reaction Emojis -->
        <div v-if="reactions && Object.keys(reactions).length > 0" class="message-reactions">
          <div
            v-for="(reaction, key) in reactions"
            :key="key"
            class="reaction-item"
            @click="toggleReaction(String(key))"
          >
            <span class="reaction-emoji">{{ key }}</span>
            <span class="reaction-count">{{ reaction.count }}</span>
          </div>
        </div>
      </div>

      <!-- Message Status -->
      <div class="message-status">
        <span class="message-time">{{ formatTime(message.sendTime) }}</span>
        <n-icon
          v-if="isOwnMessage"
          :component="getStatusIcon"
          :class="`status-${message.status}`"
          size="14"
        />
      </div>
    </div>

    <!-- Sender Avatar (for own messages) -->
    <div v-if="isOwnMessage && showAvatar" class="message-avatar">
      <n-avatar
        v-bind="currentUserAvatar !== undefined ? { src: currentUserAvatar } : {}"
        :fallback-src="'/default-avatar.png'"
        round
        size="medium"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { NAvatar, NTag, NIcon, NImage, NButton, useMessage } from 'naive-ui'
import {
  ArrowLeft,
  Photo,
  PlayerPlay,
  PlayerPause,
  FileText,
  Download,
  MapPin,
  Bell,
  Lock,
  Check,
  CircleCheck,
  Clock
} from '@vicons/tabler'
import { messageDecryptService } from '@/services/messageDecryptService'
import { sanitizeHtml } from '@/utils/htmlSanitizer'
import { MsgEnum } from '../../enums'
import type { MsgType } from '@/services/types'

interface RoomMember {
  displayName?: string
  avatarUrl?: string
  powerLevel?: number
}

// Extended message type for reply messages (extends MsgType but makes fromUser.uid optional)
interface ReplyMessage {
  sender?: {
    displayName?: string
  }
  fromUser?: {
    uid?: string
  }
  [key: string]: unknown // Allow all other MsgType properties
}

interface Props {
  message: MsgType
  showAvatar?: boolean
  showSenderInfo?: boolean
  replyMessage?: ReplyMessage | null
  currentUser?: { uid: string; avatar?: string }
}

const props = withDefaults(defineProps<Props>(), {
  showAvatar: true,
  showSenderInfo: true,
  replyMessage: null
})

const emit = defineEmits<{
  reply: [message: MsgType]
  react: [message: MsgType, emoji: string]
  downloadFile: [fileUrl: string, fileName: string]
}>()

const messageApi = useMessage()
const audioRef = ref<HTMLAudioElement | null>(null)
const isPlaying = ref(false)
const isDecrypted = ref(false)

// Computed
const isOwnMessage = computed(() => {
  return props.currentUser && props.message.fromUser?.uid === props.currentUser.uid
})

const isReply = computed(() => {
  return props.message.type === MsgEnum.REPLY || props.message.body?.replyEventId
})

const isEncrypted = computed(() => {
  return props.message.encrypted
})

const senderDisplayName = computed(() => {
  const member = props.message.message?.member as RoomMember | undefined
  return member?.displayName || props.message.fromUser?.uid || 'Unknown'
})

const senderAvatar = computed(() => {
  const member = props.message.message?.member as RoomMember | undefined
  return member?.avatarUrl
})

const senderInitials = computed(() => {
  const name = senderDisplayName.value
  if (!name) return '?'

  const names = name.split(' ')
  if (names.length >= 2) {
    return (names[0]?.[0] || '') + (names[1]?.[0] || '')
  }
  return name.substring(0, 2).toUpperCase()
})

const currentUserAvatar = computed(() => {
  return props.currentUser?.avatar
})

const isModerator = computed(() => {
  const member = props.message.message?.member as RoomMember | undefined
  return (member?.powerLevel ?? 0) >= 50
})

const sanitizedText = computed(() => {
  let text = props.message.body?.text || ''

  // Convert URLs to links
  text = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')

  // Convert line breaks
  text = text.replace(/\n/g, '<br>')

  // Highlight mentions
  text = text.replace(/@(\w+)/g, '<span class="mention">@$1</span>')

  // Sanitize HTML to prevent XSS
  return sanitizeHtml(text)
})

const reactions = computed<Record<string, { count: number; users: string[] }>>(() => {
  const r = props.message.body?.reactions
  if (!r) return {}
  // Convert string[] to { count, users } format
  if (typeof r === 'object' && !Array.isArray(r)) {
    return r as Record<string, { count: number; users: string[] }>
  }
  return {}
})

const getStatusIcon = computed(() => {
  switch (props.message.status) {
    case 'success':
    case 'sent':
      return Check
    case 'delivered':
      return CircleCheck
    case 'failed':
      return Clock
    default:
      return Clock
  }
})

// Methods
const formatTime = (timestamp: number | string | Date): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  // Today
  if (diff < 24 * 60 * 60 * 1000 && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // This week
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    return (
      date.toLocaleDateString('zh-CN', {
        weekday: 'short'
      }) +
      ' ' +
      date.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
      })
    )
  }

  // Older
  return (
    date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric'
    }) +
    ' ' +
    date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    })
  )
}

const formatDuration = (duration: number): string => {
  const seconds = Math.floor(duration / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
  }
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / k ** i).toFixed(2)) + ' ' + sizes[i]
}

const previewImage = () => {
  // Handled by n-image component
}

const downloadFile = () => {
  if (props.message.body?.url) {
    emit('downloadFile', props.message.body.url, props.message.body.fileName || 'download')
  }
}

const toggleVoicePlayback = () => {
  if (!audioRef.value) {
    audioRef.value = new Audio(props.message.body.url)
    audioRef.value.addEventListener('ended', () => {
      isPlaying.value = false
    })
  }

  if (isPlaying.value) {
    audioRef.value.pause()
  } else {
    audioRef.value.play()
  }
  isPlaying.value = !isPlaying.value
}

const decryptMessage = async () => {
  if (props.message.encrypted) {
    try {
      const decrypted = (await messageDecryptService.decryptMessage(props.message)) as { body?: { text?: string } }
      isDecrypted.value = true
      // Update message content
      const decryptedBody = decrypted.body
      props.message.body.text = decryptedBody?.text || '[解密失败]'
    } catch (error) {
      messageApi.error('解密失败')
    }
  }
}

const toggleReaction = (emoji: string) => {
  emit('react', props.message, emoji)
}
</script>

<style scoped>
.matrix-message {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
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

.matrix-message.is-own {
  flex-direction: row-reverse;
}

.message-avatar {
  flex-shrink: 0;
}

.message-content {
  flex: 1;
  min-width: 0;
  max-width: 70%;
}

.matrix-message.is-own .message-content {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.message-sender {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
  font-size: 12px;
  color: var(--n-text-color-3);
}

.sender-name {
  font-weight: 500;
}

.reply-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--n-text-color-3);
  margin-bottom: 4px;
}

.message-body {
  background: var(--n-color);
  border-radius: 12px;
  padding: 8px 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.matrix-message.is-own .message-body {
  background: var(--n-primary-color);
  color: white;
}

.text-message {
  white-space: pre-wrap;
  word-break: break-word;
}

.text-message :deep(.mention) {
  background: rgba(var(--n-primary-color-rgb), 0.1);
  color: var(--n-primary-color);
  padding: 0 2px;
  border-radius: 2px;
}

.image-message {
  max-width: 300px;
}

.image-container {
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
}

.image-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  gap: 8px;
  color: var(--n-text-color-3);
}

.image-caption {
  margin-top: 4px;
  font-size: 12px;
  color: var(--n-text-color-3);
}

.video-message {
  max-width: 300px;
}

.video-container {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
}

.video-container video {
  width: 100%;
  max-height: 200px;
  object-fit: cover;
}

.video-duration {
  position: absolute;
  bottom: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
}

.voice-message {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
}

.voice-waveform {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 32px;
  flex: 1;
}

.wave-bar {
  width: 2px;
  background: var(--n-primary-color);
  border-radius: 1px;
  transition: height 0.2s;
}

.voice-duration {
  font-size: 12px;
  color: var(--n-text-color-3);
  min-width: 40px;
}

.file-message {
  max-width: 300px;
}

.file-container {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.file-container:hover {
  background: rgba(0, 0, 0, 0.04);
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  display: block;
  font-weight: 500;
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  font-size: 12px;
  color: var(--n-text-color-3);
}

.location-message {
  max-width: 300px;
}

.location-map img {
  width: 100%;
  height: 150px;
  object-fit: cover;
  border-radius: 8px;
}

.location-info {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  font-size: 12px;
  color: var(--n-text-color-3);
}

.notice-message {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  background: rgba(var(--n-warning-color-rgb), 0.1);
  border-left: 3px solid var(--n-warning-color);
  border-radius: 4px;
  font-size: 14px;
}

.encrypted-message {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  background: rgba(var(--n-info-color-rgb), 0.1);
  border-left: 3px solid var(--n-info-color);
  border-radius: 4px;
}

.message-reactions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.reaction-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 12px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.reaction-item:hover {
  background: rgba(0, 0, 0, 0.08);
}

.reaction-emoji {
  font-size: 14px;
}

.reaction-count {
  font-size: 11px;
  color: var(--n-text-color-3);
}

.message-status {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  font-size: 11px;
  color: var(--n-text-color-3);
}

.matrix-message.is-own .message-status {
  justify-content: flex-end;
}

.status-sent {
  color: var(--n-text-color-3);
}

.status-delivered {
  color: var(--n-primary-color);
}

.status-failed {
  color: var(--n-error-color);
}
</style>