<template>
  <div class="group-call-interface" :class="{ 'is-minimized': isMinimized, 'is-fullscreen': isFullscreen }">
    <!-- 主通话界面 -->
    <div v-if="!isMinimized" class="call-main">
      <!-- 视频网格区域 -->
      <div class="video-grid" :class="getGridClass(totalParticipants)">
        <!-- 本地视频 -->
        <div class="video-participant local-participant">
          <div class="video-container">
            <video
              v-if="callType === 'video' && localStream && !isCameraOff"
              ref="localVideoRef"
              class="participant-video"
              :srcObject="localStream"
              autoplay
              playsinline
              muted
            />
            <div v-else class="video-placeholder">
              <n-avatar
                :src="currentUser?.avatar || ''"
                :size="80"
                round
                :fallback="currentUser?.name?.charAt(0) || 'M'
              "
              />
            </div>
          </div>
          <div class="participant-info">
            <div class="participant-name">{{ currentUser?.name || '我' }}</div>
            <div class="participant-status">
              <n-tag v-if="isMuted" type="error" size="small" round>静音</n-tag>
              <n-tag v-if="isCameraOff && callType === 'video'" type="warning" size="small" round>摄像头关闭</n-tag>
            </div>
          </div>
        </div>

        <!-- 远程参与者视频 -->
        <div
          v-for="participant in remoteParticipants"
          :key="participant.userId"
          class="video-participant"
          :class="{ 'speaking': participant.isSpeaking }"
        >
          <div class="video-container">
            <video
              v-if="participant.stream && callType === 'video'"
              :ref="`remoteVideo_${participant.userId}`"
              class="participant-video"
              :srcObject="participant.stream"
              autoplay
              playsinline
            />
            <div v-else class="video-placeholder">
              <n-avatar
                :src="participant.avatar || ''"
                :size="80"
                round
                :fallback="participant.name?.charAt(0) || '?'
              "
              />
            </div>
          </div>
          <div class="participant-info">
            <div class="participant-name">{{ participant.name }}</div>
            <div class="participant-status">
              <n-tag v-if="participant.isMuted" type="error" size="small" round>静音</n-tag>
              <n-tag v-if="participant.hasCamera && !participant.stream" type="warning" size="small" round">摄像头关闭</n-tag>
            </div>
          </div>
        </div>
      </div>

      <!-- 侧边栏 - 参与者列表 -->
      <div class="sidebar" :class="{ 'collapsed': isSidebarCollapsed }">
        <div class="sidebar-header">
          <h3>参与者 ({{ totalParticipants }})</h3>
          <n-button quaternary circle size="small" @click="toggleSidebar">
            <template #icon>
              <n-icon>
                <ChevronRight v-if="isSidebarCollapsed" />
                <ChevronLeft v-else />
              </n-icon>
            </template>
          </n-button>
        </div>

        <div v-if="!isSidebarCollapsed" class="participants-list">
          <!-- 本地用户 -->
          <div class="participant-item local-user">
            <n-avatar
              :src="currentUser?.avatar || ''"
              :size="40"
              round
              :fallback="currentUser?.name?.charAt(0) || 'M'
            "
            />
            <div class="participant-details">
              <div class="name">{{ currentUser?.name || '我' }} (您)</div>
              <div class="status">
                <n-tag v-if="isMuted" type="error" size="tiny">静音</n-tag>
                <n-tag v-if="isCameraOff && callType === 'video'" type="warning" size="tiny">摄像头关闭</n-tag>
                <n-tag type="success" size="tiny">主持人</n-tag>
              </div>
            </div>
            <div class="participant-actions">
              <n-button quaternary circle size="tiny" @click="toggleMicrophone">
                <template #icon>
                  <n-icon>
                    <MicrophoneOff v-if="isMuted" />
                    <Microphone v-else />
                  </n-icon>
                </template>
              </n-button>
            </div>
          </div>

          <!-- 远程参与者 -->
          <div
            v-for="participant in remoteParticipants"
            :key="participant.userId"
            class="participant-item"
            :class="{ 'speaking': participant.isSpeaking }"
          >
            <n-avatar
              :src="participant.avatar || ''"
              :size="40"
              round
              :fallback="participant.name?.charAt(0) || '?'
            "
            />
            <div class="participant-details">
              <div class="name">{{ participant.name }}</div>
              <div class="status">
                <n-tag v-if="participant.isMuted" type="error" size="tiny">静音</n-tag>
                <n-tag v-if="participant.hasCamera && !participant.stream" type="warning" size="tiny">摄像头关闭</n-tag>
                <n-tag v-if="participant.isHost" type="success" size="tiny">主持人</n-tag>
              </div>
            </div>
            <div class="participant-actions">
              <n-dropdown
                :options="getParticipantActions(currentUser?.isHost || false)"
                @select="handleParticipantAction($event, participant)"
              >
                <n-button quaternary circle size="tiny">
                  <template #icon>
                    <n-icon><DotsVertical /></n-icon>
                  </template>
                </n-button>
              </n-dropdown>
            </div>
          </div>
        </div>

        <!-- 通话统计 -->
        <div v-if="!isSidebarCollapsed" class="call-stats">
          <h4>通话统计</h4>
          <div class="stats-item">
            <span>通话时长</span>
            <span>{{ formatCallDuration(callDuration) }}</span>
          </div>
          <div class="stats-item">
            <span>网络质量</span>
            <n-tag :type="networkQuality.type" size="tiny">
              {{ networkQuality.text }}
            </n-tag>
          </div>
        </div>
      </div>

      <!-- 控制面板 -->
      <div class="control-panel">
        <div class="primary-controls">
          <!-- 麦克风 -->
          <n-button
            :type="isMuted ? 'error' : 'default'"
            circle
            size="large"
            @click="toggleMicrophone"
            :disabled="!localStream"
          >
            <template #icon>
              <n-icon>
                <MicrophoneOff v-if="isMuted" />
                <Microphone v-else />
              </n-icon>
            </template>
          </n-button>

          <!-- 摄像头 -->
          <n-button
            v-if="callType === 'video'"
            :type="isCameraOff ? 'error' : 'default'"
            circle
            size="large"
            @click="toggleCamera"
            :disabled="!localStream"
          >
            <template #icon>
              <n-icon>
                <VideoOff v-if="isCameraOff" />
                <Video v-else />
              </n-icon>
            </template>
          </n-button>

          <!-- 结束通话 -->
          <n-button type="error" circle size="large" @click="endCall">
            <template #icon>
              <n-icon><PhoneOff /></n-icon>
            </template>
          </n-button>

          <!-- 屏幕共享 -->
          <n-button
            v-if="callType === 'video' && !isMobile"
            quaternary
            circle
            size="large"
            @click="toggleScreenShare"
            :type="isScreenSharing ? 'primary' : 'default'"
            :loading="isTogglingScreenShare"
          >
            <template #icon>
              <n-icon><DeviceComputerCamera /></n-icon>
            </template>
          </n-button>

          <!-- 录制 -->
          <n-button
            quaternary
            circle
            size="large"
            @click="toggleRecording"
            :type="isRecording ? 'error' : 'default'"
            :loading="isTogglingRecording"
          >
            <template #icon>
              <n-icon><Radio /></n-icon>
            </template>
          </n-button>
        </div>

        <div class="secondary-controls">
          <!-- 邀请参与者 -->
          <n-button quaternary circle @click="showInviteDialog = true">
            <template #icon>
              <n-icon><UserPlus /></n-icon>
            </template>
          </n-button>

          <!-- 聊天 -->
          <n-button quaternary circle @click="toggleChat" :type="isChatOpen ? 'primary' : 'default'">
            <template #icon>
              <n-icon><MessageCircle /></n-icon>
            </template>
            <n-badge
              v-if="unreadChatCount > 0"
              :value="unreadChatCount"
              :max="99"
              class="chat-unread-badge"
            />
          </n-button>

          <!-- 参与者管理 -->
          <n-button quaternary circle @click="toggleSidebar">
            <template #icon>
              <n-icon><Users /></n-icon>
            </template>
          </n-button>

          <!-- 设置 -->
          <n-button quaternary circle @click="showCallSettings = true">
            <template #icon>
              <n-icon><Settings /></n-icon>
            </template>
          </n-button>

          <!-- 最小化 -->
          <n-button quaternary circle @click="minimizeCall">
            <template #icon>
              <n-icon><ArrowsDiagonalMinimize2 /></n-icon>
            </template>
          </n-button>

          <!-- 全屏 -->
          <n-button quaternary circle @click="toggleFullscreen">
            <template #icon>
              <n-icon>
                <Minimize v-if="isFullscreen" />
                <ArrowsMaximize v-else />
              </n-icon>
            </template>
          </n-button>
        </div>
      </div>
    </div>

    <!-- 最小化界面 -->
    <div v-else class="minimized-call">
      <div class="minimized-content" @click="restoreCall">
        <div class="call-icon">
          <n-icon size="20">
            <Users />
          </n-icon>
        </div>
        <div class="call-info">
          <div class="participant-count">{{ totalParticipants }} 人通话中</div>
          <div class="call-duration">{{ formatCallDuration(callDuration) }}</div>
        </div>
      </div>
      <n-button quaternary circle size="small" @click.stop="endCall">
        <template #icon>
          <n-icon><PhoneOff /></n-icon>
        </template>
      </n-button>
    </div>

    <!-- 侧边栏聊天 -->
    <div v-if="isChatOpen" class="chat-sidebar">
      <div class="chat-header">
        <h3>群聊</h3>
        <n-button quaternary circle size="small" @click="toggleChat">
          <template #icon>
            <n-icon><X /></n-icon>
          </template>
        </n-button>
      </div>
      <div class="chat-messages" ref="chatMessagesRef">
        <div
          v-for="message in chatMessages"
          :key="message.id"
          class="chat-message"
          :class="{ 'own-message': message.senderId === currentUserId }"
        >
          <div class="message-sender">{{ message.senderName }}</div>
          <div class="message-content">{{ message.content }}</div>
          <div class="message-time">{{ formatMessageTime(message.timestamp) }}</div>
        </div>
      </div>
      <div class="chat-input">
        <n-input
          v-model:value="chatInput"
          placeholder="输入消息..."
          @keyup.enter="sendChatMessage"
          :disabled="!isConnected"
        >
          <template #suffix>
            <n-button quaternary size="small" @click="sendChatMessage">
              <template #icon>
                <n-icon><Send /></n-icon>
              </template>
            </n-button>
          </template>
        </n-input>
      </div>
    </div>

    <!-- 邀请对话框 -->
    <n-modal v-model:show="showInviteDialog" preset="dialog" title="邀请参与者">
      <div class="invite-content">
        <n-input
          v-model:value="inviteInput"
          placeholder="输入用户ID或搜索用户"
          @keyup.enter="inviteParticipant"
        />
        <div class="invite-suggestions">
          <div
            v-for="user in suggestedUsers"
            :key="user.id"
            class="suggestion-item"
            @click="selectInviteUser(user)"
          >
            <n-avatar :src="user.avatar" :size="32" round />
            <span>{{ user.name }}</span>
          </div>
        </div>
      </div>
      <template #action>
        <n-space>
          <n-button @click="showInviteDialog = false">取消</n-button>
          <n-button type="primary" @click="inviteParticipant" :disabled="!inviteInput">
            邀请
          </n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- 通话设置抽屉 -->
    <n-drawer v-model:show="showCallSettings" :width="400" placement="right">
      <GroupCallSettings
        :call-type="callType"
        :local-stream="localStream"
        @closed="showCallSettings = false"
      />
    </n-drawer>

    <!-- 录制指示器 -->
    <div v-if="isRecording" class="recording-indicator">
      <n-icon color="#f0a020"><Radio /></n-icon>
      <span>录制中</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { NButton, NIcon, NAvatar, NTag, NDropdown, NModal, NInput, NSpace, NBadge, NDrawer } from 'naive-ui'
import {
  Microphone,
  MicrophoneOff,
  Video,
  VideoOff,
  PhoneOff,
  DeviceComputerCamera,
  Radio,
  UserPlus,
  MessageCircle,
  Users,
  Settings,
  ArrowsDiagonalMinimize2,
  ArrowsMaximize,
  Minimize,
  X,
  ChevronRight,
  ChevronLeft,
  DotsVertical,
  Send
} from '@vicons/tabler'
import type { MediaStream, MediaStreamTrack } from '@/types/rtc'
import { useWebRtc } from '@/hooks/useWebRtc'
import { usePlatformConstants } from '@/utils/PlatformConstants'
import { CallTypeEnum } from '@/enums'
import { useCallMediaControls } from '@/composables/useCallMediaControls'
import { useCallState } from '@/composables/useCallState'
import { useCallParticipants } from '@/composables/useCallParticipants'
import { useCallChat } from '@/composables/useCallChat'
import GroupCallSettings from './GroupCallSettings.vue'
import {
  getCallTypeEnum,
  getGridClass,
  formatCallDuration,
  formatMessageTime,
  getParticipantActions,
  getNameInitials
} from './groupCallUtils'
import { dlg } from '@/utils/SafeUI'
import { logger } from '@/utils/logger'

// Type definitions for group call
interface GroupConfig {
  callType?: 'audio' | 'video'
  [key: string]: unknown
}

interface CurrentUser {
  id: string
  name: string
  avatar?: string
  isHost?: boolean
  [key: string]: unknown
}

interface SuggestedUser {
  id: string
  name: string
  avatar?: string
  [key: string]: unknown
}

interface ParticipantJoinedData {
  callId: string
  participant: CallParticipant
}

interface ParticipantLeftData {
  callId: string
  participant: CallParticipant
}

interface MessageReceivedData {
  callId: string
  senderId: string
  senderName: string
  content: string
  timestamp: number
}

interface SpeakingChangedData {
  callId: string
  participantId: string
  isSpeaking: boolean
}

interface Props {
  roomId: string
  callId: string
  callType: 'audio' | 'video'
  groupConfig: GroupConfig
  currentUser?: CurrentUser
  participants?: CallParticipant[]
}

interface ChatMessage {
  id: string
  senderId: string
  senderName: string
  content: string
  timestamp: number
}

interface CallParticipant {
  userId: string
  name?: string
  avatar?: string
  isMuted?: boolean
  hasCamera?: boolean
  isHost?: boolean
  isSpeaking?: boolean
  stream?: MediaStream | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'call-ended': [callId: string]
  'participant-joined': [participant: CallParticipant]
  'participant-left': [participant: CallParticipant]
}>()

const { isMobile } = usePlatformConstants()
const rtc = useWebRtc(props.roomId, 'group-call', getCallTypeEnum(props.callType), false)
const rtcManager = {
  getUserMedia: navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices),
  initiateGroupCall: async (_roomId: string, _config: GroupConfig) => {},
  endGroupCall: async (_callId: string) => {},
  inviteToGroupCall: async (_callId: string, _userId: string) => {},
  muteParticipant: async (_callId: string, _userId: string) => {},
  removeFromGroupCall: async (_callId: string, _userId: string) => {},
  sendGroupCallMessage: async (_callId: string, _content: string) => {},
  startGroupScreenShare: rtc.startScreenShare,
  stopGroupScreenShare: rtc.stopScreenShare,
  startGroupRecording: async (_callId: string, _format: string) => {},
  stopGroupRecording: async (_callId: string) => ({ url: '' }),
  addEventListener: (_event: string, _listener: (...args: unknown[]) => void) => {}
}

// 媒体流
const localStream = ref<MediaStream | null>(null)

// 使用 composables
const callStateComposable = useCallState()
const mediaControls = useCallMediaControls({ localStream })

// Initialize participants and chat composables
const callId = ref(props.callId)
const currentUserId = computed(() => props.currentUser?.id || 'current-user')
const currentUserName = computed(() => props.currentUser?.name || '我')

const participantsComposable = useCallParticipants({
  callId,
  rtcManager: {
    inviteToGroupCall: rtcManager.inviteToGroupCall,
    muteParticipant: rtcManager.muteParticipant,
    removeFromGroupCall: rtcManager.removeFromGroupCall
  },
  currentUserId
})

const chatComposable = useCallChat({
  callId,
  rtcManager: {
    sendGroupCallMessage: rtcManager.sendGroupCallMessage
  },
  currentUserId,
  currentUserName
})

// Alias composable states for template use
const callState = callStateComposable.callState
const callDuration = callStateComposable.callDuration
const isConnected = callStateComposable.isConnected
const isMuted = mediaControls.isMuted
const isCameraOff = mediaControls.isCameraOff
const isScreenSharing = mediaControls.isScreenSharing
const isTogglingScreenShare = mediaControls.isTogglingScreenShare

// Alias participant composable states
const remoteParticipants = participantsComposable.remoteParticipants
const suggestedUsers = participantsComposable.suggestedUsers
const showInviteDialog = participantsComposable.showInviteDialog
const inviteInput = participantsComposable.inviteInput
const totalParticipants = participantsComposable.totalParticipants

// Alias chat composable states
const chatMessages = chatComposable.chatMessages
const chatInput = chatComposable.chatInput
const unreadChatCount = chatComposable.unreadChatCount
const isChatOpen = chatComposable.isChatOpen
const chatMessagesRef = chatComposable.chatMessagesRef

// UI状态
const isMinimized = ref(false)
const isFullscreen = ref(false)
const isSidebarCollapsed = ref(false)

// 功能状态
const isRecording = ref(false)
const isTogglingRecording = ref(false)

// UI状态
const showCallSettings = ref(false)

// 引用
const localVideoRef = ref<HTMLVideoElement>()

const networkQuality = computed(() => ({ type: 'default' as const, text: '检测中' }))

// ========== 群组通话控制 ==========

const startGroupCall = async () => {
  try {
    // 获取本地媒体流
    localStream.value = await rtcManager.getUserMedia({
      audio: true,
      video: props.callType === 'video'
    })

    // 设置视频元素源
    if (localVideoRef.value && localStream.value) {
      localVideoRef.value.srcObject = localStream.value
    }

    // 初始化群组通话
    await rtcManager.initiateGroupCall(props.roomId, {
      ...props.groupConfig,
      callType: props.callType
    })

    callStateComposable.startCall()
  } catch (error) {
    logger.error('Failed to start group call:', error)
    logger.error('无法启动群组通话')
    endCall()
  }
}

const endCall = async () => {
  try {
    // 停止录制
    if (isRecording.value) {
      await stopRecording()
    }

    // 停止屏幕共享
    if (mediaControls.isScreenSharing.value) {
      await stopScreenShare()
    }

    // 结束群组通话
    await rtcManager.endGroupCall(props.callId)

    // 停止本地流
    if (localStream.value) {
      localStream.value.getTracks().forEach((track: MediaStreamTrack) => track.stop())
      localStream.value = null
    }

    callStateComposable.endCall()
    emit('call-ended', props.callId)
  } catch (error) {
    logger.error('Failed to end group call:', error)
  }
}

// ========== 参与者管理 ==========
// These methods are now provided by useCallParticipants composable
const inviteParticipant = participantsComposable.inviteParticipant
const selectInviteUser = participantsComposable.selectInviteUser
const handleParticipantAction = participantsComposable.handleParticipantAction

// ========== 聊天功能 ==========
// These methods are now provided by useCallChat composable
const toggleChat = chatComposable.toggleChat
const sendChatMessage = chatComposable.sendChatMessage
const scrollToBottomChat = chatComposable.scrollToBottomChat

// ========== 媒体控制 ==========

const toggleMicrophone = () => {
  if (localStream.value) {
    const audioTracks = localStream.value.getAudioTracks()
    audioTracks.forEach((track: MediaStreamTrack) => {
      track.enabled = !isMuted.value
    })
    isMuted.value = !isMuted.value
  }
}

const toggleCamera = () => {
  if (localStream.value) {
    const videoTracks = localStream.value.getVideoTracks()
    videoTracks.forEach((track: MediaStreamTrack) => {
      track.enabled = !isCameraOff.value
    })
    isCameraOff.value = !isCameraOff.value
  }
}

// ========== 屏幕共享 ==========

const toggleScreenShare = async () => {
  if (mediaControls.isScreenSharing.value) {
    await stopScreenShare()
  } else {
    await startScreenShare()
  }
}

const startScreenShare = async () => {
  try {
    await rtcManager.startGroupScreenShare()
    mediaControls.isScreenSharing.value = true
    logger.debug('屏幕共享已开启')
  } catch (error) {
    logger.error('Failed to start screen share:', error)
    logger.error('无法开启屏幕共享')
  }
}

const stopScreenShare = async () => {
  try {
    await rtcManager.stopGroupScreenShare()
    await mediaControls.stopScreenShare()
    logger.debug('屏幕共享已停止')
  } catch (error) {
    logger.error('Failed to stop screen share:', error)
  }
}

// ========== 录制功能 ==========

const toggleRecording = async () => {
  if (isRecording.value) {
    await stopRecording()
  } else {
    await startRecording()
  }
}

const startRecording = async () => {
  try {
    isTogglingRecording.value = true
    await rtcManager.startGroupRecording(props.callId, 'webm')
    isRecording.value = true
    logger.debug('群组录制已开始')
  } catch (error) {
    logger.error('Failed to start recording:', error)
    logger.error('无法开始录制')
  } finally {
    isTogglingRecording.value = false
  }
}

const stopRecording = async () => {
  try {
    isTogglingRecording.value = true
    const recording = await rtcManager.stopGroupRecording(props.callId)
    isRecording.value = false
    logger.debug('录制已停止')

    if (recording && recording.url) {
      // 提供下载链接
      const a = document.createElement('a')
      a.href = recording.url
      a.download = `group-call-recording-${Date.now()}.webm`
      a.click()
    }
  } catch (error) {
    logger.error('Failed to stop recording:', error)
  } finally {
    isTogglingRecording.value = false
  }
}

// ========== UI控制 ==========

const toggleSidebar = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
}

const minimizeCall = () => {
  isMinimized.value = true
}

const restoreCall = () => {
  isMinimized.value = false
}

const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value

  if (isFullscreen.value) {
    document.documentElement.requestFullscreen?.()
  } else {
    document.exitFullscreen?.()
  }
}

// ========== 计时器 ==========

let callTimer: NodeJS.Timeout | null = null

const startCallTimer = () => {
  callTimer = setInterval(() => {
    callDuration.value++
  }, 1000)
}

const stopCallTimer = () => {
  if (callTimer) {
    clearInterval(callTimer)
    callTimer = null
  }
}

// ========== 监听器 ==========

watch(
  () => props.participants,
  (newParticipants) => {
    if (newParticipants) {
      remoteParticipants.value = newParticipants.filter((p) => p.userId !== currentUserId.value)
    }
  },
  { immediate: true, deep: true }
)

watch(
  () => props.callId,
  (newCallId) => {
    if (newCallId) {
      startGroupCall()
    }
  },
  { immediate: true }
)

// ========== 生命周期 ==========

onMounted(() => {
  // 监听群组通话事件
  rtcManager.addEventListener('group-participant-joined', (...args: unknown[]) => {
    const data = args[0] as ParticipantJoinedData
    if (data.callId === props.callId) {
      remoteParticipants.value.push(data.participant)
      emit('participant-joined', data.participant)

      const systemMessage: ChatMessage = {
        id: `system_${Date.now()}`,
        senderId: 'system',
        senderName: '系统',
        content: `${data.participant.name} 加入了通话`,
        timestamp: Date.now()
      }
      chatMessages.value.push(systemMessage)

      if (!isChatOpen.value) {
        unreadChatCount.value++
      }
    }
  })

  rtcManager.addEventListener('group-participant-left', (...args: unknown[]) => {
    const data = args[0] as ParticipantLeftData
    if (data.callId === props.callId) {
      const index = remoteParticipants.value.findIndex((p) => p.userId === data.participant.userId)
      if (index > -1) {
        remoteParticipants.value.splice(index, 1)
      }
      emit('participant-left', data.participant)

      const systemMessage: ChatMessage = {
        id: `system_${Date.now()}`,
        senderId: 'system',
        senderName: '系统',
        content: `${data.participant.name} 离开了通话`,
        timestamp: Date.now()
      }
      chatMessages.value.push(systemMessage)

      if (!isChatOpen.value) {
        unreadChatCount.value++
      }
    }
  })

  rtcManager.addEventListener('group-message-received', (...args: unknown[]) => {
    const data = args[0] as MessageReceivedData
    if (data.callId === props.callId) {
      const message: ChatMessage = {
        id: `msg_${Date.now()}`,
        senderId: data.senderId,
        senderName: data.senderName,
        content: data.content,
        timestamp: data.timestamp
      }
      chatMessages.value.push(message)

      if (!isChatOpen.value) {
        unreadChatCount.value++
      } else {
        nextTick(() => {
          scrollToBottomChat()
        })
      }
    }
  })

  rtcManager.addEventListener('group-speaking-changed', (...args: unknown[]) => {
    const data = args[0] as SpeakingChangedData
    if (data.callId === props.callId) {
      const participant = remoteParticipants.value.find((p: CallParticipant) => p.userId === data.participantId)
      if (participant) {
        participant.isSpeaking = data.isSpeaking
      }
    }
  })

  // 模拟建议用户
  suggestedUsers.value = [
    { id: 'user1', name: 'Alice', avatar: '' },
    { id: 'user2', name: 'Bob', avatar: '' },
    { id: 'user3', name: 'Charlie', avatar: '' }
  ]
})

onUnmounted(() => {
  stopCallTimer()
  endCall()
})
</script>

<style lang="scss" scoped>
.group-call-interface {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--bg-color);
  z-index: 1000;
  display: flex;
  flex-direction: column;

  &.is-minimized {
    position: fixed;
    bottom: 20px;
    right: 20px;
    top: auto;
    left: auto;
    width: 320px;
    height: 80px;
    background: var(--card-color);
    border-radius: 12px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  }

  &.is-fullscreen {
    background: #000;
  }
}

.call-main {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.video-grid {
  flex: 1;
  display: grid;
  gap: 4px;
  padding: 4px;
  background: #1a1a1a;

  &.grid-1x1 {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr;
  }

  &.grid-2x2 {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
  }

  &.grid-2x3 {
    grid-template-columns: 1fr 1fr 1fr;
    grid-template-rows: 1fr 1fr;
  }

  &.grid-3x3 {
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(3, 1fr);
  }

  &.grid-auto {
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    grid-auto-rows: minmax(200px, 1fr);
  }
}

.video-participant {
  position: relative;
  background: #2a2a2a;
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.2s ease;

  &.speaking {
    box-shadow: 0 0 0 3px var(--primary-color);
  }

  .video-container {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;

    .participant-video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .video-placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      background: #3a3a3a;
    }
  }

  .participant-info {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 12px;
    background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
    color: white;

    .participant-name {
      font-weight: 600;
      margin-bottom: 4px;
      font-size: 14px;
    }

    .participant-status {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }
  }

  &.local-participant {
    .participant-info {
      background: linear-gradient(to top, rgba(24, 160, 88, 0.8); transparent);
    }
  }
}

.sidebar {
  position: absolute;
  top: 0;
  right: 0;
  width: 300px;
  height: 100%;
  background: var(--card-color);
  border-left: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  transition: transform 0.3s ease;
  z-index: 10;

  &.collapsed {
    transform: translateX(100%);
  }

  .sidebar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid var(--border-color);

    h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--text-color-1);
    }
  }

  .participants-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;

    .participant-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 4px;
      transition: background-color 0.2s ease;

      &:hover {
        background: var(--bg-color-hover);
      }

      &.speaking {
        background: rgba(24, 160, 88, 0.1);
      }

      &.local-user {
        background: rgba(24, 160, 88, 0.05);
      }

      .participant-details {
        flex: 1;
        min-width: 0;

        .name {
          font-weight: 500;
          color: var(--text-color-1);
          margin-bottom: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .status {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
        }
      }
    }
  }

  .call-stats {
    padding: 16px;
    border-top: 1px solid var(--border-color);

    h4 {
      margin: 0 0 12px 0;
      font-size: 14px;
      font-weight: 600;
      color: var(--text-color-1);
    }

    .stats-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      font-size: 12px;

      &:first-child {
        color: var(--text-color-2);
      }
    }
  }
}

.control-panel {
  background: var(--card-color);
  border-top: 1px solid var(--border-color);
  padding: 16px;

  .primary-controls {
    display: flex;
    justify-content: center;
    gap: 16px;
    margin-bottom: 12px;
  }

  .secondary-controls {
    display: flex;
    justify-content: center;
    gap: 12px;
    flex-wrap: wrap;
  }
}

.minimized-call {
  display: flex;
  align-items: center;
  padding: 16px;
  gap: 12px;

  .minimized-content {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;

    .call-icon {
      width: 40px;
      height: 40px;
      background: var(--primary-color);
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .call-info {
      .participant-count {
        font-weight: 600;
        color: var(--text-color-1);
        margin-bottom: 4px;
      }

      .call-duration {
        font-size: 12px;
        color: var(--text-color-3);
      }
    }
  }
}

.chat-sidebar {
  position: absolute;
  top: 0;
  left: 0;
  width: 350px;
  height: 100%;
  background: var(--card-color);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  z-index: 10;

  .chat-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid var(--border-color);

    h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--text-color-1);
    }
  }

  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;

    .chat-message {
      margin-bottom: 16px;

      &.own-message {
        .message-content {
          background: var(--primary-color);
          color: white;
          margin-left: auto;
        }
      }

      .message-sender {
        font-size: 12px;
        color: var(--text-color-3);
        margin-bottom: 4px;
      }

      .message-content {
        background: var(--bg-color-hover);
        padding: 8px 12px;
        border-radius: 12px;
        max-width: 80%;
        word-wrap: break-word;
      }

      .message-time {
        font-size: 10px;
        color: var(--text-color-3);
        margin-top: 4px;
      }
    }
  }

  .chat-input {
    padding: 16px;
    border-top: 1px solid var(--border-color);
  }
}

.invite-content {
  margin-bottom: 20px;

  .invite-suggestions {
    margin-top: 12px;
    max-height: 200px;
    overflow-y: auto;

    .suggestion-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px;
      border-radius: 6px;
      cursor: pointer;
      transition: background-color 0.2s ease;

      &:hover {
        background: var(--bg-color-hover);
      }
    }
  }
}

.recording-indicator {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(240, 160, 32, 0.9);
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  z-index: 20;
}

.chat-unread-badge {
  position: absolute;
  top: -4px;
  right: -4px;
}

// 响应式设计
@media (max-width: 768px) {
  .group-call-interface:not(.is-minimized) {
    .sidebar {
      width: 100%;
      position: relative;
      height: auto;
      max-height: 40vh;
    }

    .chat-sidebar {
      width: 100%;
      position: relative;
      height: auto;
      max-height: 50vh;
    }

    .video-grid {
      &.grid-2x3 {
        grid-template-columns: 1fr 1fr;
        grid-template-rows: repeat(3, 1fr);
      }

      &.grid-3x3 {
        grid-template-columns: repeat(2, 1fr);
        grid-auto-rows: minmax(150px, 1fr);
      }
    }

    .control-panel {
      .primary-controls {
        gap: 12px;
      }

      .secondary-controls {
        gap: 8px;
      }
    }
  }
}
</style>
