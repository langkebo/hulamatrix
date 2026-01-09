<template>
  <component
    v-memo="[
      message.message.id,
      message.message.status,
      message.message.body?.translatedText?.text || '',
      uploadProgress,
      searchKeyword,
      historyMode
    ]"
    v-if="historyMode || !hasBubble(message.message.type)"
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

  <!-- 好友或者群聊的信息 -->
  <div v-else class="flex flex-col w-full" :class="{ 'justify-end': isMe }">
    <!-- 信息时间(单聊) -->
    <div
      v-if="!isGroup"
      class="text-(12px var(--hula-brand-primary)) h-12px flex select-none"
      :class="{
        'pr-48px justify-end': isMe,
        'pl-42px justify-start': !isMe
      }">
      <Transition name="fade-single">
        <span v-if="hoverMsgId === message.message.id">
          {{ formatTimestamp(message.message.sendTime, true) }}
        </span>
      </Transition>
    </div>
    <div class="flex justify-center items-center">
      <n-checkbox
        v-model:checked="message.isCheck"
        v-if="chatStore.isMsgMultiChoose && chatStore.msgMultiChooseMode !== 'forward' && !isMultiSelectDisabled"
        class="mr-3 select-none"
        :focusable="false"
        @click.stop />
      <div class="flex items-start flex-1" :class="isMe ? 'flex-row-reverse' : ''">
        <!-- 回复消息提示的箭头 -->
        <svg
          v-if="activeReply === message.message.id"
          class="size-16px pt-4px color-var(--hula-brand-primary)"
          :class="isMe ? 'ml-8px' : 'mr-8px'">
          <use :href="isMe ? `#corner-down-left` : `#corner-down-right`"></use>
        </svg>
        <!-- 头像 -->
        <n-popover
          :ref="(el: unknown) => el && (infoPopoverRefs[message.message.id] = el)"
          @update:show="handlePopoverUpdate(message.message.id, $event)"
          trigger="click"
          placement="right"
          :show-arrow="false"
          class="message-info-popover">
          <template #trigger>
            <ContextMenu
              @select="$event.click(message, 'Main')"
              :content="message"
              :menu="isGroup ? (optionsList as MenuItem[]) : void 0"
              :special-menu="report as MenuItem[]">
              <!-- 存在头像时候显示 -->
              <n-avatar
                round
                :size="34"
                @click="handleAvatarClick(message.fromUser.uid, message.message.id)"
                class="select-none"
                :color="themes.content === ThemeEnum.DARK ? 'var(--hula-brand-primary)' : 'var(--hula-white)'"
                :fallback-src="themes.content === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
                :src="getAvatarSrc(message.fromUser.uid) || ''"
                :class="isMe ? '' : 'mr-10px'" />
            </ContextMenu>
          </template>
          <!-- 用户个人信息框 -->
          <InfoPopover v-if="selectKey === message.message.id" :uid="fromUser.uid" />
        </n-popover>

        <n-flex vertical :size="6" class="color-[--text-color] flex-1" :class="isMe ? 'items-end mr-10px' : ''">
          <n-flex :size="6" align="center" :style="isMe ? 'flex-direction: row-reverse' : ''">
            <ContextMenu
              @select="$event.click(message, 'Main')"
              :content="message"
              :menu="isGroup ? (optionsList as MenuItem[]) : void 0"
              :special-menu="report as MenuItem[]">
              <n-flex
                :size="6"
                class="select-none cursor-default"
                align="center"
                v-if="isGroup"
                :style="isMe ? 'flex-direction: row-reverse' : ''">
                <!-- 用户名 -->
                <span
                  :class="[
                    'text-12px select-none color-var(--hula-brand-primary) inline-block align-top',
                    !isMe ? 'cursor-pointer hover:text-brand transition-colors' : ''
                  ]"
                  @click.stop="handleMentionUser">
                  {{ senderDisplayName }}
                </span>
                <!-- 消息归属地 -->
                <span v-if="senderLocPlace" class="text-(12px var(--hula-brand-primary))">({{ senderLocPlace }})</span>
              </n-flex>
            </ContextMenu>
            <!-- 群主 -->
            <div
              v-if="groupStore.isCurrentLord(fromUser.uid)"
              class="flex px-4px py-3px rounded-4px bg-var(--hula-brand-primary)30 size-fit select-none">
              <span class="text-(9px var(--hula-brand-primary))">{{ t('home.chat_sidebar.roles.owner') }}</span>
            </div>
            <!-- 管理员 -->
            <div
              v-if="groupStore.isAdmin(fromUser.uid)"
              class="flex px-4px py-3px rounded-4px bg-var(--hula-brand-primary)30 size-fit select-none">
              <span class="text-(9px var(--hula-brand-primary))">{{ t('home.chat_sidebar.roles.admin') }}</span>
            </div>
            <!-- 信息时间(群聊) -->
            <Transition name="fade-group">
              <span
                v-if="isGroup && hoverMsgId === message.message.id"
                class="text-(12px var(--hula-brand-primary)) select-none">
                {{ formatTimestamp(message.message.sendTime, true) }}
              </span>
            </Transition>
          </n-flex>
          <!--  气泡样式  -->
          <ContextMenu
            v-on-long-press="[(e) => handleLongPress(e, handleItemType(message.message.type)), longPressOption]"
            :content="message"
            @mousedown.right="recordSelectionBeforeContext"
            @contextmenu="handleContextMenuSelection"
            @mouseenter="() => (hoverMsgId = message.message.id)"
            @mouseleave="() => (hoverMsgId = '')"
            class="w-fit relative flex flex-col chat-message-max-width"
            :data-key="isMe ? `U${message.message.id}` : `Q${message.message.id}`"
            :class="isMe ? 'items-end' : 'items-start'"
            :style="{ '--bubble-max-width': bubbleMaxWidth }"
            @select="$event.click(message, 'Main')"
            :menu="handleItemType(message.message.type) as MenuItem[]"
            :emoji="emojiList"
            :special-menu="specialMenuList(message.message.type) as MenuItem[]"
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
                !isSpecialMsgType(message.message.type) ? (isMe ? 'bubble-oneself' : 'bubble') : '',
                {
                  active:
                    activeBubble === message.message.id &&
                    !isSpecialMsgType(message.message.type) &&
                    message.message.type !== MsgEnum.VOICE &&
                    !isMobile()
                },
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

            <!-- 自毁消息倒计时显示 -->
            <SelfDestructCountdown
              v-if="isSelfDestructingMessage(message.message)"
              :message-id="message.message.id"
              :room-id="message.message.roomId"
              :event-id="message.message.id"
              :message-body="message.message.body"
              :inline="true"
              @destroy="handleMessageDestroyed"
              @warning="handleMessageWarning" />

            <!-- 显示翻译文本 -->
            <Transition name="fade-translate" appear mode="out-in">
              <div v-if="message.message.body.translatedText" class="translated-text cursor-default flex flex-col">
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
            </Transition>

            <!-- 消息状态指示器 -->
            <div v-if="isMe" class="absolute -left-6 top-2 flex flex-col items-end">
              <n-icon v-if="message.message.status === MessageStatusEnum.SENDING" class="text-gray-400">
                <img class="size-16px" src="@/assets/img/loading-one.svg" alt="消息发送中..." />
              </n-icon>
              <n-icon
                v-if="message.message.status === MessageStatusEnum.FAILED"
                class="text-var(--hula-brand-primary) cursor-pointer"
                @click.stop="handleRetry(message)">
                <svg class="size-16px">
                  <use href="#cloudError"></use>
                </svg>
              </n-icon>
              <span
                v-if="readCount > 0"
                class="text-(10px var(--hula-brand-primary)) whitespace-nowrap mt-2px select-none">
                {{ readCount }} 已读
              </span>
            </div>
          </ContextMenu>

          <!-- 回复的内容 -->
          <n-flex
            align="center"
            :size="6"
            v-if="message.message.body.reply"
            @click="emit('jump2Reply', message.message.body.reply.id)"
            :class="isMobile() ? 'bg-var(--hula-brand-primary) text-13px' : 'bg-[--right-chat-reply-color] text-12px'"
            class="reply-bubble relative w-fit custom-shadow select-none chat-message-max-width"
            :style="{ 'max-width': bubbleMaxWidth }">
            <svg class="size-14px">
              <use href="#to-top"></use>
            </svg>
            <n-avatar
              class="reply-avatar"
              round
              :size="20"
              :color="themes.content === ThemeEnum.DARK ? 'var(--hula-brand-primary)' : 'var(--hula-white)'"
              :fallback-src="themes.content === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
              :src="getAvatarSrc(message.message.body.reply.uid ?? '') || ''" />
            <span>{{ `${message.message.body.reply.username}: ` }}</span>
            <span class="content-span">
              {{ message.message.body.reply.body }}
            </span>
            <div v-if="message.message.body.reply.imgCount" class="reply-img-sub">
              {{ message.message.body.reply.imgCount }}
            </div>
          </n-flex>

          <!-- 动态渲染所有回复表情反应 -->
          <div
            v-if="message.message"
            class="flex-y-center gap-6px flex-wrap w-270px"
            :class="{ 'justify-end': isSingleLineEmojis(message) }">
            <template v-for="emoji in emojiList" :key="emoji.value">
              <!-- 根据表情类型获取对应的计数属性名 -->
              <div class="flex-y-center" v-if="message && getEmojiCount(message, emoji.value) > 0">
                <div
                  class="emoji-reply-bubble"
                  :class="{ 'emoji-reply-bubble--active': hasUserMarkedEmoji(message, emoji.value) }"
                  @click.stop="message && cancelReplyEmoji(message, emoji.value)">
                  <img :title="emoji.title" class="size-18px" :src="emoji.url" :alt="emoji.title" />
                  <span
                    :class="
                      hasUserMarkedEmoji(message, emoji.value)
                        ? 'text-var(--hula-brand-primary)'
                        : 'text-(12px var(--hula-gray-200))'
                    ">
                    {{ message ? getEmojiCount(message, emoji.value) : 0 }}
                  </span>
                </div>
              </div>
            </template>
          </div>
        </n-flex>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import type { Component } from 'vue'
import { computed, inject, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { logger, toError } from '@/utils/logger'
import { MessageStatusEnum, MittEnum, MsgEnum, ThemeEnum } from '@/enums'
import { chatMainInjectionKey, useChatMain } from '@/hooks/useChatMain'
import { useMitt } from '@/hooks/useMitt'
import { usePopover } from '@/hooks/usePopover'
import type { MessageType, MsgType } from '@/services/types'
import { useCachedStore } from '@/stores/dataCache'
import { useGlobalStore } from '@/stores/global'
import { useGroupStore } from '@/stores/group'
import { useSettingStore } from '@/stores/setting'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { formatTimestamp } from '@/utils/ComputedTime'
import { isMessageMultiSelectEnabled } from '@/utils/MessageSelect'
import { useChatStore } from '@/stores/chat'
import { useUserStore } from '@/stores/user'
import { createMacContextSelectionGuard } from '@/utils/MacSelectionGuard'
import { addMessageReaction, removeMessageReaction } from '@/integrations/matrix/reactions'
import { isMobile } from '@/utils/PlatformConstants'
import { sdkGetReceipts } from '@/services/messages'
import { flags } from '@/utils/envFlags'
import Announcement from './Announcement.vue'
import AudioCall from './AudioCall.vue'
import Emoji from './Emoji.vue'
import File from './File.vue'
import Image from './Image.vue'
import Location from './Location.vue'
import MergeMessage from './MergeMessage.vue'
import RecallMessage from './special/RecallMessage.vue'
import SystemMessage from './special/SystemMessage.vue'
import Text from './Text.vue'
import Video from './Video.vue'
import VideoCall from './VideoCall.vue'
import Voice from './Voice.vue'
import { toFriendInfoPage } from '@/utils/RouterUtils'
import { vOnLongPress } from '@vueuse/components'
import { msg } from '@/utils/SafeUI'
import SelfDestructCountdown from '@/components/message/SelfDestructCountdown.vue'

// MenuItem type for context menu items
interface MenuItem {
  visible?: (content?: Record<string, unknown>) => boolean
  click?: (content?: Record<string, unknown>) => void
  children?: MenuItem[] | ((content?: Record<string, unknown>) => MenuItem[])
  icon?: string | ((content?: Record<string, unknown>) => string)
  label?: string | ((content?: Record<string, unknown>) => string)
  [key: string]: unknown
}

const props = withDefaults(
  defineProps<{
    message: MessageType
    uploadProgress?: number | undefined
    isGroup: boolean
    fromUser: {
      uid: string
    }
    onImageClick?: ((url: string) => void) | undefined
    onVideoClick?: ((url: string) => void) | undefined
    searchKeyword?: string | undefined
    historyMode?: boolean
  }>(),
  {
    historyMode: false
  }
)

const emit = defineEmits(['jump2Reply'])
const { t } = useI18n()
const globalStore = useGlobalStore()
const selectKey = ref(props.fromUser!.uid)
// Interface for popover ref that has setShow method
interface PopoverRef {
  setShow: (show: boolean) => void
}
const infoPopoverRefs = reactive<Record<string, PopoverRef | unknown>>({})
const { handlePopoverUpdate } = usePopover(selectKey, 'image-chat-main')

const userStore = useUserStore()
// 响应式状态变量
const activeReply = ref<string>('')
const hoverMsgId = ref<string>('')
const readCount = ref(0)

onMounted(async () => {
  if (props.message.message.id && props.message.message.roomId) {
    try {
      const receipts = await sdkGetReceipts(props.message.message.roomId, props.message.message.id)
      readCount.value = receipts.length
    } catch (e) {
      // ignore error
    }
  }
})

const settingStore = useSettingStore()
const themes = computed(() => settingStore.themes)
const injectedChatMain = inject(chatMainInjectionKey, null)
const chatMainApi = injectedChatMain ?? useChatMain()
const { optionsList, report, activeBubble, handleItemType, emojiList, specialMenuList, handleMsgClick } = chatMainApi
const groupStore = useGroupStore()
const chatStore = useChatStore()
const cachedStore = useCachedStore()
const isMultiSelectDisabled = computed(() => !isMessageMultiSelectEnabled(props.message.message.type))
const bubbleMaxWidth = computed(() => {
  if (isMobile()) {
    return '70vw'
  }
  return props.isGroup ? '32vw' : '50vw'
})

const { recordSelectionBeforeContext, handleContextMenuSelection } = createMacContextSelectionGuard({
  lockSelector: '.chat-message-max-width'
})

const handleAvatarClick = (uid: string, msgId: string) => {
  if (isMobile()) {
    toFriendInfoPage(uid)
  } else {
    selectKey.value = msgId
  }
}

const handleMentionUser = () => {
  if (!props.isGroup || isMe.value) return
  const targetUid = props.fromUser?.uid
  if (!targetUid) return
  useMitt.emit(MittEnum.AT, targetUid)
}

// 获取用户头像
const getAvatarSrc = computed(() => (uid: string) => {
  const isCurrentUser = uid === userStore.userInfo?.uid
  const storeUser = groupStore.getUserInfo(uid)
  if (isMe.value && isCurrentUser) {
    return AvatarUtils.getAvatarUrl(userStore.userInfo!.avatar as string)
  }
  const resolvedAvatar = storeUser?.avatar || (uid === props.fromUser.uid ? props.message.fromUser.avatar : '')
  return AvatarUtils.getAvatarUrl(resolvedAvatar as string)
})

const senderDisplayName = computed(() => {
  const displayName = groupStore.getUserDisplayName(props.fromUser.uid)
  if (displayName) {
    return displayName
  }

  const storeUser = groupStore.getUserInfo(props.fromUser.uid)
  if (storeUser?.myName || storeUser?.name) {
    return storeUser.myName || storeUser.name || ''
  }

  return props.message.fromUser.username || '未知用户'
})

const senderLocPlace = computed(() => {
  const storeLocPlace = groupStore.getUserInfo(props.fromUser.uid)?.locPlace
  if (storeLocPlace) {
    return storeLocPlace
  }
  return props.message.fromUser.locPlace || ''
})

const componentMap: Partial<Record<MsgEnum, Component>> = {
  [MsgEnum.TEXT]: Text,
  [MsgEnum.IMAGE]: Image,
  [MsgEnum.EMOJI]: Emoji,
  [MsgEnum.VIDEO]: Video,
  [MsgEnum.VOICE]: Voice,
  [MsgEnum.FILE]: File,
  [MsgEnum.NOTICE]: Announcement,
  [MsgEnum.VIDEO_CALL]: VideoCall,
  [MsgEnum.AUDIO_CALL]: AudioCall,
  [MsgEnum.SYSTEM]: SystemMessage,
  [MsgEnum.RECALL]: RecallMessage,
  [MsgEnum.MERGE]: MergeMessage,
  [MsgEnum.LOCATION]: Location
}

const isSpecialMsgType = (type: number): boolean => {
  return (
    type === MsgEnum.IMAGE ||
    type === MsgEnum.EMOJI ||
    type === MsgEnum.NOTICE ||
    type === MsgEnum.VIDEO ||
    type === MsgEnum.FILE ||
    type === MsgEnum.MERGE ||
    type === MsgEnum.LOCATION
  )
}

/**
 * 检查消息是否为自毁消息
 * @param msg 消息对象
 * @returns 是否为自毁消息
 */
const isSelfDestructingMessage = (msg: MsgType): boolean => {
  if (!msg || !msg.body) return false

  // 检查 com.hula.self_destruct 元数据
  const selfDestructMeta = (msg.body as Record<string, unknown>)['com.hula.self_destruct']
  return (selfDestructMeta as { will_self_destruct?: boolean })?.will_self_destruct === true
}

/**
 * 处理消息销毁事件
 * @param messageId 消息ID
 */
const handleMessageDestroyed = (messageId: string) => {
  logger.debug('[RenderMessage] Message self-destructed:', messageId)
  // 可以在这里添加额外的清理逻辑，比如从消息列表中移除
}

/**
 * 处理消息即将销毁的警告
 * @param messageId 消息ID
 * @param remainingTime 剩余时间（毫秒）
 */
const handleMessageWarning = (messageId: string, remainingTime: number) => {
  logger.debug('[RenderMessage] Message will self-destruct soon:', { messageId, remainingTime })
}

// 判断表情反应是否只有一行
const isSingleLineEmojis = (item: MessageType): boolean => {
  if (!item || !item.fromUser || !item.message) return false

  // 计算有多少个表情反应
  let emojiCount = 0
  for (const emoji of emojiList.value) {
    if (getEmojiCount(item, emoji.value) > 0) {
      emojiCount++
    }
  }

  // 如果表情数量小于等于3个，认为是一行
  // 这个阈值可以根据实际UI调整
  return isMe.value && emojiCount <= 5
}

// 取消表情反应
const cancelReplyEmoji = async (item: MessageType, type: number): Promise<void> => {
  if (!item || !item.message || !item.message.messageMarks) return

  // 检查该表情是否已被当前用户标记
  const userMarked = item.message.messageMarks[String(type)]?.userMarked

  // 只有当用户已标记时才发送取消请求
  if (userMarked) {
    try {
      // 将数字类型转换为表情字符串
      const emoji = String.fromCodePoint(type)
      const roomId = item.message.roomId
      const eventId = item.message.id

      // 使用 Matrix SDK 移除反应
      await removeMessageReaction(roomId, eventId, emoji)
    } catch (error) {
      logger.error('取消表情标记失败:', toError(error))
    }
  }
}

/**
 * 根据表情类型获取对应的计数
 * @param item 消息项
 * @param emojiType 表情类型值
 * @returns 计数值
 */
const getEmojiCount = (item: MessageType, emojiType: number): number => {
  if (!item || !item.message || !item.message.messageMarks) return 0

  // messageMarks 是一个对象，键是表情类型，值是包含 count 和 userMarked 的对象
  // 如果存在该表情类型的统计数据，返回其计数值，否则返回0
  return item.message.messageMarks[String(emojiType)]?.count || 0
}

// 是否是当前登录用户标记
const hasUserMarkedEmoji = (item: MessageType, emojiType: number) => {
  if (!item || !item.message || !item.message.messageMarks) return false

  return item.message.messageMarks[String(emojiType)]?.userMarked
}

const handleRetry = async (item: MessageType): Promise<void> => {
  try {
    logger.debug('[MessageRender] 重试发送消息:', item)

    // 检查消息状态
    if (item.message?.status !== MessageStatusEnum.FAILED) {
      logger.warn('[MessageRender] 消息未处于失败状态，无需重试')
      return
    }

    // 导入 UnifiedMessageService
    const { unifiedMessageService } = await import('@/services/unified-message-service')

    // 从消息体中获取房间 ID，如果没有则使用当前会话的房间 ID
    const roomId = (item.message?.body as Record<string, unknown>)?.roomId as string | undefined

    // 准备重试的消息参数
    const retryParams = {
      type: item.message!.type,
      body: item.message!.body as Record<string, unknown> | undefined
    }

    // 更新消息状态为发送中
    const chatStore = useChatStore()
    chatStore.updateMsg({
      msgId: item.message!.id,
      status: MessageStatusEnum.SENDING
    })

    // 重新发送消息
    const result = await unifiedMessageService.sendMessage({
      roomId: roomId || '',
      type: retryParams.type,
      body: retryParams.body || {}
    })

    // 更新消息状态
    chatStore.updateMsg({
      msgId: item.message!.id,
      status: MessageStatusEnum.SUCCESS
    })

    // 如果是新的消息 ID，更新映射
    if (result.id && result.id !== item.message!.id) {
      logger.info('[MessageRender] 消息重试成功，新 ID:', result.id)
      // 可以选择更新本地消息映射
    }

    msg.success('消息已重新发送')
  } catch (error) {
    logger.error('[MessageRender] 重试发送消息失败:', error)

    // 更新消息状态为失败
    const chatStore = useChatStore()
    chatStore.updateMsg({
      msgId: item.message!.id,
      status: MessageStatusEnum.FAILED
    })

    msg.error('发送失败，请稍后重试')
  }
}

// 处理复制翻译文本
const handleCopyTranslation = (text: string) => {
  if (text) {
    navigator.clipboard.writeText(text)
    msg.success('复制成功')
  }
}

const hasBubble = (type: MsgEnum) => {
  return !(type === MsgEnum.RECALL || type === MsgEnum.SYSTEM)
}

const isMe = computed(() => {
  return props.fromUser?.uid === userStore.userInfo!.uid
})

// 解决mac右键会选中文本的问题
const closeMenu = (event: unknown) => {
  const e = event as { target: Element }
  if (!e.target.matches('.bubble') && !e.target.matches('.bubble-oneself')) {
    activeBubble.value = ''
  }
}

// 处理表情回应
const handleEmojiSelect = async (
  context: { label: string; value: number; title: string },
  item: MessageType
): Promise<void> => {
  if (!item || !item.message) return

  if (!item.message.messageMarks) {
    item.message.messageMarks = {}
  }

  // 检查该表情是否已被当前用户标记
  const userMarked = item.message.messageMarks[String(context.value)]?.userMarked
  // 只给没有标记过的图标标记
  if (!userMarked) {
    try {
      // 将数字类型转换为表情字符串
      const emoji = String.fromCodePoint(context.value)
      const roomId = item.message.roomId
      const eventId = item.message.id

      // 使用 Matrix SDK 添加反应
      await addMessageReaction(roomId, eventId, emoji)
    } catch (error) {
      logger.error('标记表情失败:', toError(error))
    }
  } else {
    msg.warning('该表情已标记')
  }
}

useMitt.on(`${MittEnum.INFO_POPOVER}-Main`, (event: unknown) => {
  const e = event as { uid: string | number }
  const messageId = String(e.uid)

  // 首先设置 selectKey 以显示 InfoPopover 组件
  selectKey.value = messageId

  // 如果有对应的 popover 引用，则显示 popover
  const popoverRef = infoPopoverRefs[messageId] as PopoverRef | undefined
  if (popoverRef?.setShow) {
    popoverRef.setShow(true)
    handlePopoverUpdate(messageId)
  }
})

onMounted(() => {
  window.addEventListener('click', closeMenu, true)
})

onUnmounted(() => {
  window.removeEventListener('click', closeMenu, true)
})

/**
 * 长按事件（开始）
 */

const longPressOption = computed(() => ({
  delay: 700,
  modifiers: {
    // 只在移动端阻止默认行为，桌面端允许文本选中
    prevent: isMobile(),
    stop: isMobile()
  },
  reset: true,
  windowResize: true,
  windowScroll: true,
  immediate: true,
  updateTiming: 'sync'
}))

const handleLongPress = (e: PointerEvent, _menu: unknown) => {
  if (!isMobile()) return

  // 1. 阻止默认行为（防止系统菜单出现）
  e.preventDefault()
  e.stopPropagation()

  // // 2. 获取目标元素
  const target = e.target as HTMLElement

  const preventClick = (event: Event) => {
    event.stopPropagation()
    event.preventDefault()
    document.removeEventListener('click', preventClick, true)
    document.removeEventListener('pointerup', preventClick, true)
  }

  // 3. 添加临时事件监听器，阻止后续点击事件
  document.addEventListener('click', preventClick, true)
  document.addEventListener('pointerup', preventClick, true)

  // 4. 模拟右键点击事件
  const contextMenuEvent = new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    clientX: e.clientX,
    clientY: e.clientY,
    button: 2 // 明确指定右键
  })

  target.dispatchEvent(contextMenuEvent)

  setTimeout(() => {
    document.removeEventListener('click', preventClick, true)
    document.removeEventListener('pointerup', preventClick, true)
  }, 300)
}

/**
 * 长按事件（结束）
 */
</script>
<style scoped lang="scss">
@use '@/styles/scss/render-message';

.message-info-popover {
  padding: 0;
  background: var(--bg-info);
}
</style>
