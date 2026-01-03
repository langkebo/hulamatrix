<template>
  <div class="msg-input-container">
    <!-- 录音模式 -->
    <VoiceRecorder v-show="isVoiceMode" @cancel="handleVoiceCancel" @send="sendVoiceDirect" />

    <!-- 输入框表单 -->
    <form
      v-show="!isVoiceMode"
      id="message-form"
      @submit.prevent="handleFormSubmit"
      :class="[isMobile() ? 'gap-10px ' : '']"
      class="w-full flex flex-1 min-h-0">
      <div
        class="w-full flex"
        :class="isMobile() ? 'flex flex-1 p-5px gap-2 pt-5px items-center min-h-2.25rem' : ' flex-col'">
        <div v-if="isMobile()" class="flex items-center justify-center w-6 ms-5px h-2.5rem">
          <svg
            @click="handleVoiceClick"
            :class="mobilePanelState === MobilePanelStateEnum.VOICE ? 'text-#169781' : ''"
            class="w-25px h-25px mt-2px outline-none">
            <use href="#voice"></use>
          </svg>
        </div>

        <ContextMenu class="w-full flex-1 min-h-0" @select="$event.click()" :menu="menuList">
          <div v-if="!isMobile() && isTyping" class="px-10px py-4px text-12px text-#606060 flex items-center gap-6px">
            <span class="dot-online" v-if="onlineCount > 0"></span>
            正在输入…
          </div>
          <n-scrollbar @click="focusInput">
            <div
              id="message-input"
              ref="messageInputDom"
              :style="{
                minHeight: isMobile() ? 'var(--sz-chat-input-min-h-mobile)' : 'var(--sz-chat-input-min-h)',
                lineHeight:
                  isMobile() && !msgInput ? 'var(--sz-chat-input-line-h-mobile)' : 'var(--sz-chat-input-line-h)',
                outline: 'none'
              }"
              contenteditable
              spellcheck="false"
              @paste="onPaste($event)"
              @input="handleInternalInput"
              @keydown.exact.enter="handleEnterKey"
              @keydown.exact.meta.enter="handleEnterKey"
              @keydown="updateSelectionRange"
              @keyup="updateSelectionRange"
              @click="updateSelectionRange"
              @blur="handleBlur"
              @compositionend="updateSelectionRange"
              @keydown.exact.ctrl.enter="handleEnterKey"
              :data-placeholder="t('editor.placeholder')"
              :class="
                isMobile()
                  ? 'empty:before:content-[attr(data-placeholder)] before:text-(12px #777) p-2 min-h-2rem ps-10px! text-14px! bg-white! rounded-10px! max-h-8rem! flex items-center'
                  : 'empty:before:content-[attr(data-placeholder)] before:text-(12px #777) p-2'
              "></div>
          </n-scrollbar>
        </ContextMenu>

        <!-- 发送按钮 -->
        <div
          v-if="!isMobile()"
          class="flex-shrink-0 max-h-52px p-4px pr-12px border-t border-gray-200/50 flex justify-end mb-4px">
          <n-config-provider :theme="lightTheme">
            <n-button-group size="small">
              <n-button :color="'var(--hula-accent, #13987f)'" :disabled="disabledSend" class="w-65px" @click="handleDesktopSend">
                {{ t('editor.send') }}
              </n-button>
              <n-button :color="'var(--hula-accent, #13987f)'" class="p-[0_6px]">
                <template #icon>
                  <n-config-provider :theme="themes.content === ThemeEnum.DARK ? darkTheme : lightTheme">
                    <n-popselect
                      v-model:show="arrow"
                      v-model:value="chatKey"
                      :options="sendOptions"
                      trigger="click"
                      placement="top-end">
                      <svg @click="arrow = true" v-if="!arrow" class="w-22px h-22px mt-2px outline-none">
                        <use href="#down"></use>
                      </svg>
                      <svg @click="arrow = false" v-else class="w-22px h-22px mt-2px outline-none">
                        <use href="#up"></use>
                      </svg>
                      <template #action>
                        <n-flex
                          justify="center"
                          align="center"
                          :size="4"
                          class="text-(12px #777) cursor-default tracking-1 select-none">
                          <i18n-t keypath="editor.send_or_newline">
                            <template #send>
                              <span v-if="chatKey !== 'Enter'">
                                {{ isMac() ? MacOsKeyEnum['⌘'] : WinKeyEnum.CTRL }}
                              </span>
                              <svg class="size-12px">
                                <use href="#Enter"></use>
                              </svg>
                            </template>
                            <template #newline>
                              <n-flex align="center" :size="0">
                                {{ isMac() ? MacOsKeyEnum['⇧'] : WinKeyEnum.SHIFT }}
                                <svg class="size-12px">
                                  <use href="#Enter"></use>
                                </svg>
                              </n-flex>
                            </template>
                          </i18n-t>
                        </n-flex>
                      </template>
                    </n-popselect>
                  </n-config-provider>
                </template>
              </n-button>
            </n-button-group>
          </n-config-provider>
        </div>

        <!-- @提及框  -->
        <div v-if="ait && activeItem?.type === RoomTypeEnum.GROUP && personList.length > 0" class="ait-options">
          <n-virtual-list
            id="image-chat-ait"
            ref="virtualListInst-ait"
            style="max-height: 180px"
            :item-size="36"
            :items="personList"
            v-model:selectedKey="selectedAitKey">
            <template #default="{ item }">
              <n-flex
                @mouseover="() => (selectedAitKey = item.uid)"
                :class="{ active: selectedAitKey === item.uid }"
                @click="handleAit(item)"
                :key="item.uid"
                align="center"
                class="ait-item">
                <n-avatar
                  lazy
                  round
                  :size="22"
                  :src="AvatarUtils.getAvatarUrl(item.avatar)"
                  :color="themes.content === ThemeEnum.DARK ? '' : '#fff'"
                  :fallback-src="themes.content === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
                  :render-placeholder="() => null"
                  :intersection-observer-options="{
                    root: '#image-chat-ait'
                  }" />
                <span>{{ item.myName || item.name }}</span>
              </n-flex>
            </template>
          </n-virtual-list>
        </div>

        <div
          v-if="isMobile()"
          class="grid gap-2 h-2.5rem items-center"
          :class="msgInput ? 'grid-cols-[2rem_3rem]' : 'grid-cols-[2rem_2rem]'">
          <div class="w-full flex-center h-full">
            <svg @click="handleEmojiClick" class="w-25px h-25px mt-2px outline-none iconpark-icon">
              <use :href="mobilePanelState === MobilePanelStateEnum.EMOJI ? '#face' : '#smiling-face'"></use>
            </svg>
          </div>
          <div
            v-if="msgInput"
            class="flex-shrink-0 max-h-62px h-full border-t border-gray-200/50 flex items-center justify-end">
            <n-config-provider class="h-full" :theme="lightTheme">
              <n-button-group size="small" :class="isMobile() ? 'h-full' : 'pr-20px'">
                <n-button :color="'var(--hula-accent, #13987f)'" :disabled="disabledSend" class="w-3rem h-full" @click="handleMobileSend">
                  发送
                </n-button>
              </n-button-group>
            </n-config-provider>
          </div>
          <div v-if="!msgInput" class="flex items-center justify-start h-full">
            <svg
              @click="handleMoreClick"
              :class="mobilePanelState === MobilePanelStateEnum.MORE ? 'rotate-45' : 'rotate-0'"
              class="w-25px h-25px mt-2px outline-none iconpark-icon transition-transform duration-300 ease">
              <use href="#add-one"></use>
            </svg>
          </div>
        </div>
      </div>
    </form>

    <!-- 文件上传弹窗 -->
    <FileUploadModal
      v-model:show="showFileModal"
      :files="pendingFiles"
      @confirm="handleFileConfirm"
      @cancel="handleFileCancel" />
  </div>
</template>
<script setup lang="ts">
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { onKeyStroke } from '@vueuse/core'
import { darkTheme, lightTheme, type VirtualListInst } from 'naive-ui'
import { computed, nextTick, onMounted, onUnmounted, readonly, ref, useTemplateRef, watch } from 'vue'
import type { Ref } from 'vue'
import { MacOsKeyEnum, MittEnum, RoomTypeEnum, ThemeEnum, WinKeyEnum } from '@/enums'
import { useCommon } from '@/hooks/useCommon'
import { useMitt } from '@/hooks/useMitt'
import { useMsgInput } from '@/hooks/useMsgInput'
import { useGlobalStore } from '@/stores/global'
import { useSettingStore } from '@/stores/setting'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { isMac, isMobile } from '@/utils/PlatformConstants'
import { useSendOptions } from '@/views/moreWindow/settings/config'
import { useGroupStore } from '@/stores/group'
import { MobilePanelStateEnum } from '@/enums'
import { useI18n, I18nT } from 'vue-i18n'
import { useTypingStore } from '@/integrations/matrix/typing'
import { usePresenceStore } from '@/stores/presence'
import { useUserStore } from '@/stores/user'
import { matrixClientService } from '@/integrations/matrix/client'
import { getRoom } from '@/utils/matrixClientUtils'
// 手动导入VoiceRecorder组件以避免命名冲突
import VoiceRecorder from './VoiceRecorder.vue'
import { msg } from '@/utils/SafeUI'
import { logger } from '@/utils/logger'

// Matrix成员接口
interface MatrixMember {
  userId?: string
  user_id?: string
  membership?: string
  [key: string]: unknown
}

// 用户项接口
interface UserItem {
  uid: string | number
  account?: string
  name?: string
  avatar?: string
  [key: string]: unknown
}

// Tauri事件接口
interface TauriEvent<T = unknown> {
  payload: T
}

interface ScreenshotEventPayload {
  buffer: ArrayBuffer
  mimeType: string
}

const { t } = useI18n()
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window
const appWindow = isTauri ? WebviewWindow.getCurrent() : null
const settingStore = useSettingStore()
const themes = computed(() => settingStore.themes)
const { handlePaste, processFiles } = useCommon()
const sendOptions = useSendOptions()
/** 发送按钮旁的箭头 */
const arrow = ref(false)
/** 输入框dom元素 */
const messageInputDom = useTemplateRef<HTMLElement>('message-input')
const gloabalStore = useGlobalStore()
const currentSession = computed(() => gloabalStore.currentSession)
const activeItem = computed(() => currentSession.value ?? { type: RoomTypeEnum.SINGLE })
/** ait 虚拟列表 */
const virtualListInstAit = useTemplateRef<VirtualListInst>('virtualListInst-ait')
// 录音模式状态
const isVoiceMode = ref(false)
const groupStore = useGroupStore()
const typingStore = useTypingStore()
const presenceStore = usePresenceStore()
const userStore = useUserStore()

const typingUsers = computed(() => {
  const list = typingStore.get(gloabalStore.currentSessionRoomId)
  const selfIds = [userStore.userInfo?.uid, userStore.userInfo?.account].filter(Boolean)
  return list.filter((u) => !selfIds.includes(u))
})
const isTyping = computed(() => typingUsers.value.length > 0)
const onlineCount = computed(() => {
  try {
    const client = matrixClientService.getClient()
    const room = getRoom(client, gloabalStore.currentSessionRoomId) as {
      getJoinedMembers?: () => MatrixMember[]
    } | null
    const members = (room?.getJoinedMembers?.()?.map((m: MatrixMember) => m.userId || m.user_id) as string[]) || []
    return members.filter((uid: string) => uid && presenceStore.isOnline(uid)).length
  } catch {
    return 0
  }
})

// 文件上传弹窗状态
const showFileModal = ref(false)
const pendingFiles = ref<File[]>([])

/** 引入useMsgInput的相关方法 */
const {
  inputKeyDown,
  handleAit,
  handleInput,
  msgInput,
  send,
  sendLocationDirect,
  sendFilesDirect,
  sendVoiceDirect,
  sendEmojiDirect,
  personList,
  disabledSend,
  ait,
  chatKey,
  menuList,
  selectedAitKey,
  updateSelectionRange,
  focusOn,
  getCursorSelectionRange
} = useMsgInput(messageInputDom)

/** 表单提交处理函数 */
const handleFormSubmit = async (e: Event) => {
  e.preventDefault()
  await send()
}

/** 聚焦输入框函数 */
const focusInput = () => {
  if (messageInputDom.value) {
    focusOn(messageInputDom.value)
    setIsFocus(true) // 移动端适配
  }
}

/** 输入框失焦处理函数 */
const handleBlur = () => {
  setIsFocus(false) // 移动端适配
}

/** 当切换聊天对象时，重新获取焦点 */
watch(activeItem, () => {
  nextTick(() => {
    // 移动端不自动聚焦
    if (!isMobile()) {
      const inputDiv = document.getElementById('message-input')
      inputDiv?.focus()
      setIsFocus(true)
    }
  })
})

/** 当ait人员列表发生变化的时候始终select第一个 */
watch(personList, (newList) => {
  if (newList.length > 0) {
    const firstUser = newList[0]
    if (firstUser) {
      /** 先设置滚动条滚动到第一个 */
      virtualListInstAit.value?.scrollTo({ key: firstUser.uid })
      selectedAitKey.value = firstUser.uid
    }
  } else {
    // 无匹配用户时立即关闭@状态，放开回车键让用户可以发送消息
    ait.value = false
  }
})

const handleInternalInput = (e: Event) => {
  handleInput(e as InputEvent)
  selfEmitter('input', e)
}

// 显示文件弹窗的回调函数
const showFileModalCallback = (files: File[]) => {
  pendingFiles.value = files
  showFileModal.value = true
}

const onPaste = async (e: ClipboardEvent) => {
  if (messageInputDom.value) await handlePaste(e, messageInputDom.value, showFileModalCallback)
}

// 处理弹窗确认
const handleFileConfirm = async (files: File[]) => {
  try {
    await sendFilesDirect(files)
  } catch (error) {
    logger.error('弹窗发送文件失败:', error instanceof Error ? error : new Error(String(error)))
  }
  showFileModal.value = false
  pendingFiles.value = []
}

// 处理弹窗取消
const handleFileCancel = () => {
  showFileModal.value = false
  pendingFiles.value = []
}

/** 位置选择完成的回调 */
const handleLocationSelected = async (locationData: unknown) => {
  await sendLocationDirect(locationData)
}

/** 处理键盘上下键切换提及项 */
const handleAitKeyChange = (
  direction: 1 | -1,
  list: Ref<UserItem[]>,
  virtualListInst: VirtualListInst,
  key: Ref<number | string | null>
) => {
  const currentIndex = list.value.findIndex((item) => item.uid === key.value)
  const newIndex = Math.max(0, Math.min(currentIndex + direction, list.value.length - 1))
  key.value = list.value[newIndex].uid
  // 获取新选中项在列表中的索引，并滚动到该位置(使用key来进行定位)
  virtualListInst?.scrollTo({ index: newIndex })
}

const closeMenu = (event: Event) => {
  /** 需要判断点击如果不是.context-menu类的元素的时候，menu才会关闭 */
  const target = event.target as Element
  if (!target.matches('#message-input, #message-input *')) {
    ait.value = false
  }
}

/** 禁用浏览器默认的全选快捷键，当输入框有内容或者聚焦时不禁用 */
const disableSelectAll = (e: KeyboardEvent) => {
  if (e.ctrlKey && e.key === 'a') {
    const inputDiv = document.getElementById('message-input')
    // 检查输入框是否存在、是否有内容、是否聚焦
    const hasFocus = document.activeElement === inputDiv
    const hasContent = inputDiv && inputDiv.textContent && inputDiv.textContent.trim().length > 0

    // 只有当输入框没有聚焦或没有内容时才阻止默认行为
    if (!hasFocus || !hasContent) {
      e.preventDefault()
    }
  }
}

// 语音录制相关事件处理
const handleVoiceCancel = () => {
  isVoiceMode.value = false
}

// 使用枚举管理移动端面板状态
const mobilePanelState = ref<MobilePanelStateEnum>(MobilePanelStateEnum.NONE)

// 定义公共类型
interface ClickState {
  panelState: MobilePanelStateEnum
}

/**
 * 自定义事件
 * clickMore: 点击更多按钮
 * clickEmoji: 点击表情按钮
 * clickVoice: 点击语音按钮
 */
const selfEmitter = defineEmits<{
  (e: 'clickMore', data: ClickState): void
  (e: 'clickEmoji', data: ClickState): void
  (e: 'clickVoice', data: ClickState): void
  (e: 'customFocus', data: ClickState): void
  (e: 'send', data: ClickState): void
  (e: 'input', event: Event): void
}>()

/** 设置聚焦状态 */
const setIsFocus = (value: boolean) => {
  // 移动端：如果当前面板是打开状态（表情、语音、更多），不要因为聚焦而关闭面板
  if (
    isMobile() &&
    !value &&
    (mobilePanelState.value === MobilePanelStateEnum.EMOJI ||
      mobilePanelState.value === MobilePanelStateEnum.VOICE ||
      mobilePanelState.value === MobilePanelStateEnum.MORE)
  ) {
    // 保持当前面板状态，不关闭
    return
  }

  mobilePanelState.value = value ? MobilePanelStateEnum.FOCUS : MobilePanelStateEnum.NONE

  selfEmitter('customFocus', {
    panelState: mobilePanelState.value
  })
}

/** 点击更多按钮 */
const handleMoreClick = () => {
  mobilePanelState.value =
    mobilePanelState.value === MobilePanelStateEnum.MORE ? MobilePanelStateEnum.NONE : MobilePanelStateEnum.MORE

  selfEmitter('clickMore', {
    panelState: mobilePanelState.value
  })
}

/** 点击表情按钮 */
const handleEmojiClick = () => {
  mobilePanelState.value =
    mobilePanelState.value === MobilePanelStateEnum.EMOJI ? MobilePanelStateEnum.NONE : MobilePanelStateEnum.EMOJI

  selfEmitter('clickEmoji', {
    panelState: mobilePanelState.value
  })
}

/** 点击语音按钮 */
const handleVoiceClick = () => {
  mobilePanelState.value =
    mobilePanelState.value === MobilePanelStateEnum.VOICE ? MobilePanelStateEnum.NONE : MobilePanelStateEnum.VOICE

  selfEmitter('clickVoice', {
    panelState: mobilePanelState.value
  })
}

const getInputContent = (): string => {
  const el = messageInputDom.value
  if (!el) return ''
  const html = el.innerHTML || ''
  if (html.includes('data-type="emoji"')) return 'emoji'
  if (html.includes('<img') || html.includes('data-type=')) return 'image'
  const temp = document.createElement('div')
  temp.innerHTML = html
  let text = (temp.textContent || temp.innerText || '').replace(/\u00A0|\u200B|\uFEFF/g, ' ')
  text = text.replace(/\s+/g, ' ').trim()
  return text
}

// 手机端发送逻辑
const handleMobileSend = async () => {
  const content = getInputContent()
  if (!content.trim()) {
    msg.warning('请输入消息内容')
    return
  }

  await send()

  // 发送后不关闭面板，保持当前状态
  selfEmitter('send', {
    panelState: mobilePanelState.value
  })

  // 移动端发送消息后重新聚焦输入框
  if (isMobile()) {
    focusInput()
  }
}

// 桌面端发送逻辑
const handleDesktopSend = async () => {
  const content = getInputContent()
  if (!content.trim()) {
    msg.warning('请输入消息内容')
    return
  }

  await send()
}

const handleEnterKey = (e: KeyboardEvent) => {
  inputKeyDown(e)
}

/** 监听移动端关闭面板 */
const listenMobilePanelHandler = () => {
  mobilePanelState.value = MobilePanelStateEnum.NONE
}

/** 监听移动端关闭面板 */
const listenMobileClosePanel = () => {
  useMitt.on(MittEnum.MOBILE_CLOSE_PANEL, listenMobilePanelHandler)
}

/** 移除移动端关闭面板 */
const removeMobileClosePanel = () => {
  useMitt.off(MittEnum.MOBILE_CLOSE_PANEL, listenMobilePanelHandler)
}

/** 导出组件方法和属性 */
defineExpose({
  messageInputDom,
  updateSelectionRange,
  focus: () => focusInput(),
  getLastEditRange: () => getCursorSelectionRange(),
  showFileModal: showFileModalCallback,
  isVoiceMode: readonly(isVoiceMode),
  handleVoiceCancel,
  sendVoiceDirect,
  sendFilesDirect,
  sendEmojiDirect,
  handleLocationSelected
})

/** 移动端专用适配事件（结束） */

onMounted(async () => {
  if (isMobile()) {
    listenMobileClosePanel()
  }
  onKeyStroke('Enter', () => {
    if (ait.value && Number(selectedAitKey.value) > -1) {
      const item = personList.value.find((it: UserItem) => it.uid === selectedAitKey.value)
      if (item) {
        handleAit(item)
      }
    }
  })
  onKeyStroke('ArrowUp', (e) => {
    e.preventDefault()
    if (ait.value) {
      handleAitKeyChange(-1, personList, virtualListInstAit.value!, selectedAitKey)
    }
  })
  onKeyStroke('ArrowDown', (e) => {
    e.preventDefault()
    if (ait.value) {
      handleAitKeyChange(1, personList, virtualListInstAit.value!, selectedAitKey)
    }
  })
  // 暂时关闭独立窗口聊天功能（网页环境不触发 Tauri emit）
  if (isTauri) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { emit: tauriEmit } = require('@tauri-apps/api/event')
    try {
      await tauriEmit('aloneWin')
    } catch {}
  }
  nextTick(() => {
    // 移动端不自动聚焦
    if (!isMobile()) {
      const inputDiv = document.getElementById('message-input') as HTMLDivElement
      inputDiv?.focus()
      setIsFocus(true)
    }
  })

  // 输入框状态管理架构改进说明：
  //
  // 当前问题：
  // - 输入框和消息展示模块是分离的，没有独立的会话状态管理
  // - 当切换不同聊天时，输入框内容可能保留到错误的聊天窗口
  // - @提及功能在单聊中也会出现（不应该出现）
  // - 无法暂存输入内容，切换聊天后丢失
  //
  // 建议的架构改进：
  // 1. 创建独立的会话输入状态管理
  //    - 使用 Map<roomId, InputState> 存储每个会话的输入状态
  //    - InputState 包含：输入内容、@提及列表、草稿、光标位置等
  //
  // 2. 输入框组件改进
  //    - 输入框组件应该绑定到当前选中的 roomId
  //    - 切换聊天时，自动保存当前输入状态并加载新聊天的输入状态
  //    - @提及功能应该根据聊天类型（单聊/群聊）启用/禁用
  //
  // 3. 与消息展示模块集成
  //    - 消息展示和输入框应该是同一个组件或共享状态
  //    - 每个 Tab/窗口有独立的输入状态
  //
  // 实现步骤：
  // - 步骤1：创建 useChatInputStore 管理会话输入状态
  // - 步骤2：修改输入框组件使用 store 中的状态
  // - 步骤3：切换聊天时自动保存/恢复输入状态
  // - 步骤4：根据聊天类型（单聊/群聊）控制 @按钮显示
  //
  // (nyh -> 2024-04-09 01:03:59)
  /** 当不是独立窗口的时候也就是组件与组件之间进行通信然后监听信息对话的变化 */
  useMitt.on(MittEnum.AT, (event: unknown) => {
    if (typeof event === 'string') {
      const userInfo = groupStore.getUserInfo(event)
      if (userInfo) {
        handleAit(userInfo)
      }
    }
  })
  // 监听录音模式切换事件
  useMitt.on(MittEnum.VOICE_RECORD_TOGGLE, () => {
    isVoiceMode.value = !isVoiceMode.value
  })

  // 添加ESC键退出语音模式
  onKeyStroke('Escape', () => {
    if (isVoiceMode.value) {
      isVoiceMode.value = false
    }
  })
  if (appWindow && 'listen' in appWindow && typeof appWindow.listen === 'function') {
    appWindow.listen('screenshot', async (e: TauriEvent<ScreenshotEventPayload>) => {
      // 确保输入框获得焦点
      if (messageInputDom.value) {
        messageInputDom.value.focus()
        try {
          // 从 ArrayBuffer 数组重建 Blob 对象
          const buffer = new Uint8Array(e.payload.buffer)
          const blob = new Blob([buffer], { type: e.payload.mimeType })
          const file = new File([blob], 'screenshot.png', { type: e.payload.mimeType })

          await processFiles([file], messageInputDom.value, showFileModalCallback)
        } catch (error) {
          logger.error('处理截图失败:', error instanceof Error ? error : new Error(String(error)))
        }
      }
    })
  }
  window.addEventListener('click', closeMenu, true)
  window.addEventListener('keydown', disableSelectAll)
})

onUnmounted(() => {
  window.removeEventListener('click', closeMenu, true)
  window.removeEventListener('keydown', disableSelectAll)

  if (isMobile()) {
    removeMobileClosePanel()
  }
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/msg-input';
// 传递 props 到子组件是新增了一个div 适配样式
.msg-input-container {
  display: contents;
}
.dot-online {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background-color: #1aaa55;
}
</style>
