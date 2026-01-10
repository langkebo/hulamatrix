<template>
  <MessageBubble
    :position="isMe ? 'right' : 'left'"
    :selected="activeBubble === message.message.id"
    v-bind="messageStatus !== undefined ? { status: messageStatus } : {}"
    :status-text="statusText"
    :send-time="message.message.sendTime"
    :show-timestamp="showTimestamp"
    :loading="message.message.status === MessageStatusEnum.SENDING"
    v-bind="bubbleMaxWidth !== undefined ? { customMaxWidth: bubbleMaxWidth } : {}"
    v-bind="replyMessage !== undefined ? { replyMessage } : {}"
    v-bind="messageActions.length > 0 ? { actions: messageActions } : {}"
    @click="handleBubbleClick">
    <!-- 用户头像和名称 -->
    <template #avatar>
      <n-popover
        :ref="(el: unknown) => el && (infoPopoverRefs[message.message.id] = el)"
        @update:show="handlePopoverUpdate(message.message.id, $event)"
        trigger="click"
        placement="right"
        :show-arrow="false"
        class="user-info-popover">
        <template #trigger>
          <ContextMenu
            @select="$event.click(message, 'Main')"
            :content="message"
            :menu="isGroup ? optionsList : undefined"
            :special-menu="report">
            <n-avatar
              round
              :size="34"
              @click="handleAvatarClick(message.fromUser.uid, message.message.id)"
              class="select-none cursor-pointer"
              :color="themes.content === ThemeEnum.DARK ? 'var(--hula-brand-primary)' : 'var(--hula-white)'"
              :fallback-src="themes.content === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
              :src="getAvatarSrc(message.fromUser.uid) || ''" />
          </ContextMenu>
        </template>
        <InfoPopover v-if="selectKey === message.message.id" :uid="String(fromUser.uid)" />
      </n-popover>
    </template>

    <!-- 用户名和徽章 -->
    <template #username v-if="isGroup">
      <ContextMenu
        @select="$event.click(message, 'Main')"
        :content="message"
        :menu="isGroup ? optionsList : undefined"
        :special-menu="report">
        <n-flex :size="6" class="select-none cursor-default" align="center">
          <!-- 用户徽章 -->
          <!--
          <n-popover
            v-if="
              globalStore.currentSessionRoomId === '1' &&
              cachedStore.badgeById(groupStore.getUserInfo(String(fromUser.uid))?.wearingItemId)?.img
            "
            trigger="hover">
            <template #trigger>
              <n-avatar
                class="select-none"
                :size="18"
                round
                :fallback-src="themes.content === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
                :src="cachedStore.badgeById(groupStore.getUserInfo(String(fromUser.uid))?.wearingItemId)?.img || ''" />
            </template>
            <span>
              {{ cachedStore.badgeById(groupStore.getUserInfo(String(fromUser.uid))?.wearingItemId)?.describe }}
            </span>
          </n-popover>
          -->

          <!-- 用户名 -->
          <span
            :class="[
              'text-12px select-none inline-block align-top',
              !isMe ? 'username-hover cursor-pointer transition-colors' : ''
            ]"
            @click.stop="handleMentionUser">
            {{ senderDisplayName }}
          </span>

          <!-- 消息归属地 -->
          <span v-if="senderLocPlace" class="text-(12px var(--hula-brand-primary))">({{ senderLocPlace }})</span>
        </n-flex>
      </ContextMenu>

      <!-- 身份标识 -->
      <div class="flex gap-6px">
        <!-- 群主 -->
        <div
          v-if="roomStore.getMember(globalStore.currentSessionRoomId, String(fromUser.uid))?.role === 'owner'"
          class="flex px-4px py-3px rounded-4px bg-var(--hula-brand-primary)30 size-fit select-none">
          <span class="text-(9px var(--hula-brand-primary))">{{ t('home.chat_sidebar.roles.owner') }}</span>
        </div>
        <!-- 管理员 -->
        <div
          v-if="roomStore.getMember(globalStore.currentSessionRoomId, String(fromUser.uid))?.role === 'admin'"
          class="flex px-4px py-3px rounded-4px bg-var(--hula-brand-primary)30 size-fit select-none">
          <span class="text-(9px var(--hula-brand-primary))">{{ t('home.chat_sidebar.roles.admin') }}</span>
        </div>
      </div>
    </template>

    <!-- 消息内容 -->
    <ContextMenu
      v-on-long-press="[(e: MouseEvent) => handleLongPress(e, handleItemType(message.message.type)), longPressOption]"
      :content="message"
      @mousedown.right="recordSelectionBeforeContext"
      @contextmenu="handleContextMenuSelection"
      @mouseenter="() => (hoverMsgId = message.message.id)"
      @mouseleave="() => (hoverMsgId = '')"
      class="w-fit relative flex flex-col"
      :data-key="isMe ? `U${message.message.id}` : `Q${message.message.id}`"
      @select="$event.click(message, 'Main')"
      :menu="handleItemType(message.message.type)"
      :emoji="emojiList"
      :special-menu="specialMenuList(message.message.type)"
      @reply-emoji="handleEmojiSelect($event, message)"
      @click="handleMsgClick(message)">
      <component
        v-memo="[
          message.message.id,
          message.message.status,
          message.message.body?.translatedText?.text || '',
          uploadProgress,
          searchKeyword,
          historyMode
        ]"
        :class="[
          message.message.type === MsgEnum.VOICE ? 'select-none cursor-pointer' : 'select-text cursor-text',
          isMobile() ? 'max-w-170px!' : ''
        ]"
        :is="componentMap[message.message.type]"
        :body="message.message.body"
        :message-status="message.message.status"
        :upload-progress="uploadProgress"
        :from-user-uid="fromUser?.uid"
        :message="message.message"
        :data-message-id="message.message.id"
        :is-group="isGroup"
        :on-image-click="onImageClick"
        :on-video-click="onVideoClick"
        :search-keyword="searchKeyword"
        :history-mode="historyMode" />
    </ContextMenu>

    <!-- 翻译文本 -->
    <template v-if="message.message.body.translatedText" #extra>
      <div class="translated-text cursor-default flex flex-col bg-[--right-chat-reply-color] p-8px rounded-8px mt-6px">
        <n-flex align="center" justify="space-between" class="mb-6px">
          <n-flex align="center" :size="4">
            <span class="text-(12px var(--hula-brand-primary))">
              {{ message.message.body.translatedText.provider }}
            </span>
            <svg class="size-12px">
              <use href="#success"></use>
            </svg>
            <n-tooltip trigger="hover">
              <template #trigger>
                <svg
                  class="pl-6px size-10px cursor-pointer hover:color-var(--hula-brand-primary) hover:transition-colors"
                  @click="handleCopyTranslation(message.message.body.translatedText.text)">
                  <use href="#copy"></use>
                </svg>
              </template>
              <span>复制翻译</span>
            </n-tooltip>
          </n-flex>
          <svg
            class="size-10px cursor-pointer"
            @click="delete (message.message.body as Record<string, unknown>).translatedText">
            <use href="#close"></use>
          </svg>
        </n-flex>
        <p class="select-text cursor-text">{{ message.message.body.translatedText.text }}</p>
      </div>
    </template>

    <!-- 回复内容 -->
    <template v-if="message.message.body.reply" #reply>
      <n-flex
        align="center"
        :size="6"
        @click="emit('jump2Reply', message.message.body.reply.id)"
        class="reply-bubble relative w-fit custom-shadow select-none chat-message-max-width bg-[--right-chat-reply-color] p-8px rounded-8px">
        <svg class="size-14px">
          <use href="#to-top"></use>
        </svg>
        <n-avatar
          class="reply-avatar"
          round
          :size="20"
          :color="themes.content === ThemeEnum.DARK ? 'var(--hula-brand-primary)' : 'var(--hula-white)'"
          :fallback-src="themes.content === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
          :src="getAvatarSrc(message.message.body.reply.uid) || ''" />
        <span>{{ `${message.message.body.reply.username}: ` }}</span>
        <span class="content-span">{{ message.message.body.reply.body }}</span>
        <div v-if="message.message.body.reply.imgCount" class="reply-img-sub">
          {{ message.message.body.reply.imgCount }}
        </div>
      </n-flex>
    </template>

    <!-- 表情回应 -->
    <template #footer>
      <div
        v-if="message.message"
        class="flex-y-center gap-6px flex-wrap"
        :class="{ 'justify-end': isSingleLineEmojis(message) }">
        <template v-for="emoji in emojiList" :key="emoji.value">
          <div class="flex-y-center" v-if="message && emoji.value && getEmojiCount(message, emoji.value) > 0">
            <div
              class="emoji-reply-bubble"
              :class="{ 'emoji-reply-bubble--active': emoji.value && hasUserMarkedEmoji(message, emoji.value) }"
              @click.stop="message && emoji.value && cancelReplyEmoji(message, emoji.value)">
              <img :title="emoji.title || ''" class="size-18px" :src="emoji.url || ''" :alt="emoji.title || ''" />
              <span
                :class="
                  emoji.value && hasUserMarkedEmoji(message, emoji.value)
                    ? 'text-var(--hula-brand-primary)'
                    : 'text-(12px var(--hula-gray-200))'
                ">
                {{ message && emoji.value ? getEmojiCount(message, emoji.value) : 0 }}
              </span>
            </div>
          </div>
        </template>
      </div>
    </template>

    <!-- 多选框 -->
    <template
      #prefix
      v-if="chatStore.isMsgMultiChoose && chatStore.msgMultiChooseMode !== 'forward' && !isMultiSelectDisabled">
      <n-checkbox v-model:checked="message.isCheck" class="select-none" :focusable="false" @click.stop />
    </template>
  </MessageBubble>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import MessageBubble from '@/components/common/MessageBubble.vue'
import { MsgEnum, MessageStatusEnum, ThemeEnum } from '@/enums'
import { useGlobalStore } from '@/stores/global'
import { useChatStore } from '@/stores/chat'
import { useRoomStore } from '@/stores/room'
import { useSettingStore } from '@/stores/setting'
import { useUserStore } from '@/stores/user'
import { isMobile } from '@/utils/PlatformConstants'
import { AvatarUtils } from '@/utils/AvatarUtils'
import type { MessageItem } from '@/types'

// MenuItem 类型定义
interface MenuItem {
  visible?: (content?: Record<string, unknown>) => boolean
  click?: (content?: Record<string, unknown>) => void
  children?: MenuItem[] | ((content?: Record<string, unknown>) => MenuItem[])
  icon?: string | ((content?: Record<string, unknown>) => string)
  label?: string | ((content?: Record<string, unknown>) => string)
  [key: string]: unknown
}

/**
 * Emoji 表情类型
 */
interface Emoji {
  title: string
  url: string
  value?: string
  [key: string]: unknown
}

/**
 * 组件映射
 */
interface ComponentMap {
  [key: string]: { name?: string; [key: string]: unknown }
}

/**
 * InfoPopover 引用类型
 */
type InfoPopoverRef = Record<string, unknown> | unknown

/**
 * 上下文菜单
 */
type ContextMenu = MenuItem[] | Record<string, unknown>

// Props
interface Props {
  message: MessageItem
  isGroup: boolean
  fromUser: { uid: string | number }
  uploadProgress?: number
  searchKeyword?: string
  historyMode?: boolean
  activeBubble?: string | number
  onImageClick?: (src: string) => void
  onVideoClick?: (src: string) => void
  componentMap: ComponentMap
  optionsList?: MenuItem[]
  report?: MenuItem[]
  emojiList?: Emoji[]
  bubbleMaxWidth?: string
  infoPopoverRefs: Record<string | number, InfoPopoverRef>
  selectKey?: string | number
  hoverMsgId?: string | number
  activeReply?: string | number
}

const props = withDefaults(defineProps<Props>(), {
  uploadProgress: 0,
  searchKeyword: '',
  historyMode: false,
  activeBubble: '',
  bubbleMaxWidth: 'min(100%, 900px)',
  hoverMsgId: '',
  activeReply: ''
})

const { t } = useI18n()
const globalStore = useGlobalStore()
const chatStore = useChatStore()
const roomStore = useRoomStore()
const settingStore = useSettingStore()
const userStore = useUserStore()
const themes = computed(() => settingStore.themes)

// Long press options
const longPressOption = {
  delay: 500,
  preventClick: true
}

// 计算属性
const isMe = computed(() => props.fromUser.uid === userStore.userInfo?.uid)
const messageStatus = computed(() => {
  switch (props.message.message.status) {
    case MessageStatusEnum.SENDING:
      return 'sending'
    case MessageStatusEnum.SUCCESS:
      return 'sent'
    case MessageStatusEnum.DELIVERED:
      return 'delivered'
    case MessageStatusEnum.READ:
      return 'read'
    case MessageStatusEnum.FAILED:
      return 'failed'
    default:
      return undefined
  }
})

const statusText = computed(() => {
  // readCount is not in MessageType, using a default value
  const readCount = 0
  if (isMe.value && readCount > 0) {
    return `${readCount} 已读`
  }
  return ''
})

const showTimestamp = computed(() => props.hoverMsgId === props.message.message.id)
const senderDisplayName = computed(() => props.message.fromUser.username)
const senderLocPlace = computed(() => props.message.fromUser.locPlace)

const replyMessage = computed(() => {
  if (props.message.message.body?.reply) {
    const reply = props.message.message.body.reply
    return {
      id: reply.id,
      content: typeof reply.body === 'string' ? reply.body : JSON.stringify(reply.body),
      sender: reply.username
    }
  }
  return undefined
})

const messageActions = computed(() => [
  {
    key: 'reply',
    icon: 'material-symbols:reply',
    tooltip: '回复',
    handler: () => handleReply()
  },
  {
    key: 'copy',
    icon: 'material-symbols:content-copy',
    tooltip: '复制',
    handler: () => handleCopy()
  },
  {
    key: 'delete',
    icon: 'material-symbols:delete',
    tooltip: '删除',
    handler: () => handleDelete(),
    disabled: !isMe.value
  }
])

// 方法
const emit = defineEmits<{
  click: [message: MessageItem]
  jump2Reply: [replyId: string | number]
  avatarClick: [uid: string | number, messageId: string | number]
  reply: [message: MessageItem]
  copy: [message: MessageItem]
  delete: [message: MessageItem]
  popoverUpdate: [messageId: string | number, show: boolean]
  mentionUser: []
  longPress: [event: MouseEvent, menu: ContextMenu]
  contextMenuSelection: []
  emojiSelect: [emoji: Emoji, message: MessageItem]
  msgClick: [message: MessageItem]
  copyTranslation: [text: string]
  retry: [message: MessageItem]
}>()

const handleBubbleClick = () => {
  emit('click', props.message)
}

const handleAvatarClick = (uid: string | number, messageId: string | number) => {
  emit('avatarClick', uid, messageId)
}

const handlePopoverUpdate = (messageId: string | number, show: boolean) => {
  emit('popoverUpdate', messageId, show)
}

const handleMentionUser = () => {
  emit('mentionUser')
}

const handleLongPress = (e: MouseEvent, menu: ContextMenu) => {
  emit('longPress', e, menu)
}

const handleContextMenuSelection = () => {
  emit('contextMenuSelection')
}

const handleEmojiSelect = (emoji: Emoji, message: MessageItem) => {
  emit('emojiSelect', emoji, message)
}

const handleMsgClick = (message: MessageItem) => {
  emit('msgClick', message)
}

const handleCopyTranslation = (text: string) => {
  emit('copyTranslation', text)
}

const handleReply = () => {
  emit('reply', props.message)
}

const handleCopy = () => {
  emit('copy', props.message)
}

const handleDelete = () => {
  emit('delete', props.message)
}

const getAvatarSrc = (uid: string | number | undefined) => {
  if (!uid) return ''
  return AvatarUtils.getAvatarUrl(String(uid))
}

const handleItemType = (_type: MsgEnum): MenuItem[] => {
  // 这里需要根据实际的菜单配置返回相应的菜单项
  return []
}

const specialMenuList = (_type: MsgEnum): MenuItem[] => {
  // 这里需要根据实际的特殊菜单配置返回相应的菜单项
  return []
}

const recordSelectionBeforeContext = () => {
  // 记录选择内容的逻辑
}

const isMultiSelectDisabled = false // 根据实际情况判断

const isSingleLineEmojis = (_message: MessageItem) => {
  // 判断是否为单行表情消息
  return false
}

const getEmojiCount = (_message: MessageItem, _emojiValue: string) => {
  // 获取表情回应数量
  return 0
}

const hasUserMarkedEmoji = (_message: MessageItem, _emojiValue: string) => {
  // 判断用户是否标记了该表情
  return false
}

const cancelReplyEmoji = (_message: MessageItem, _emojiValue: string) => {
  // 取消表情回应
}
</script>

<style lang="scss" scoped>
.user-info-popover {
  padding: 0;
  background: var(--bg-info);
}

.translated-text {
  animation: fade-in 0.3s ease-in-out;
}

.reply-bubble {
  cursor: pointer;
  transition: opacity 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    opacity: 0.9;
    box-shadow: 0 2px 8px rgba(var(--hula-black-rgb), 0.1);
  }
}

.emoji-reply-bubble {
  display: flex;
  align-items: center;
  gap: var(--hula-spacing-xs);
  padding: var(--hula-spacing-xs) var(--hula-spacing-sm);
  background: rgba(var(--hula-black-rgb), 0.05);
  border-radius: var(--hula-radius-md);
  cursor: pointer;
  transition: background 0.2s ease;

  &:hover {
    background: rgba(var(--hula-black-rgb), 0.1);
  }

  &--active {
    background: rgba(251, 177, 96, 0.2);
    border: 1px solid var(--hula-brand-primary);
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* 用户名悬停效果 - 使用 HuLa 主题色 */
.username-hover {
  color: var(--hula-brand-primary);

  &:hover {
    color: var(--hula-brand-primary);
  }
}
</style>
