<template>
  <div class="group-call-interface" :class="{ 'is-minimized': isMinimized, 'is-fullscreen': isFullscreen }">
    <!-- 主通话界面 -->
    <div v-if="!isMinimized" class="call-main">
      <!-- 视频网格区域 -->
      <div class="video-grid" :class="getGridClass()">
        <!-- 本地视频 -->
        <div class="video-participant local-participant">
          <div class="video-container">
            <video
              v-if="callType === 'video' && localStream && !isCameraOff"
              :ref="
                (el) => {
                  if (el) localVideoRef = el as HTMLVideoElement
                }
              "
              class="participant-video"
              :srcObject="localStream"
              autoplay
              playsinline
              muted />
            <div v-else class="video-placeholder">
              <n-avatar :src="currentUser?.avatar || ''" :size="80" round>
                {{ currentUser?.name?.charAt(0) || 'M' }}
              </n-avatar>
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
          :class="{ speaking: participant.isSpeaking }">
          <div class="video-container">
            <video
              v-if="participant.stream && callType === 'video'"
              class="participant-video"
              :srcObject="participant.stream"
              autoplay
              playsinline />
            <div v-else class="video-placeholder">
              <n-avatar :src="participant.avatar || ''" :size="80" round>
                {{ participant.name?.charAt(0) || '?' }}
              </n-avatar>
            </div>
          </div>
          <div class="participant-info">
            <div class="participant-name">{{ participant.name }}</div>
            <div class="participant-status">
              <n-tag v-if="participant.isMuted" type="error" size="small" round>静音</n-tag>
              <n-tag v-if="participant.hasCamera && !participant.stream" type="warning" size="small" round>
                摄像头关闭
              </n-tag>
            </div>
          </div>
        </div>
      </div>

      <!-- 侧边栏 - 参与者列表 -->
      <div class="sidebar" :class="{ collapsed: isSidebarCollapsed }">
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
            <n-avatar :src="currentUser?.avatar || ''" :size="40" round>
              {{ currentUser?.name?.charAt(0) || 'M' }}
            </n-avatar>
            <div class="participant-details">
              <div class="name">{{ currentUser?.name || '我' }} (您)</div>
              <div class="status">
                <n-tag v-if="isMuted" type="error" size="small" round>静音</n-tag>
                <n-tag v-if="isCameraOff && callType === 'video'" type="warning" size="small" round>摄像头关闭</n-tag>
              </div>
            </div>
          </div>

          <!-- 远程参与者 -->
          <div v-for="participant in remoteParticipants" :key="participant.userId" class="participant-item">
            <n-avatar :src="participant.avatar || ''" :size="40" round>
              {{ participant.name?.charAt(0) || '?' }}
            </n-avatar>
            <div class="participant-details">
              <div class="name">{{ participant.name }}</div>
              <div class="status">
                <n-tag v-if="participant.isMuted" type="error" size="small" round>静音</n-tag>
              </div>
            </div>
            <n-dropdown
              :options="getParticipantActions(participant)"
              placement="bottom-end"
              @select="(key) => handleParticipantAction(key, participant)">
              <n-button quaternary circle size="small">
                <template #icon>
                  <n-icon><DotsVertical /></n-icon>
                </template>
              </n-button>
            </n-dropdown>
          </div>
        </div>
      </div>

      <!-- 底部控制栏 -->
      <div class="call-controls">
        <div class="controls-left">
          <div class="call-info">
            <span class="duration">{{ formatCallDuration(callDuration) }}</span>
            <n-tag :type="networkQuality.type" size="small" round>{{ networkQuality.text }}</n-tag>
          </div>
        </div>

        <div class="controls-center">
          <n-button quaternary circle size="large" :type="isMuted ? 'error' : 'default'" @click="toggleMicrophone">
            <template #icon>
              <n-icon>
                <MicrophoneOff v-if="isMuted" />
                <Microphone v-else />
              </n-icon>
            </template>
          </n-button>

          <n-button
            v-if="callType === 'video'"
            quaternary
            circle
            size="large"
            :type="isCameraOff ? 'warning' : 'default'"
            @click="toggleCamera">
            <template #icon>
              <n-icon>
                <VideoOff v-if="isCameraOff" />
                <Video v-else />
              </n-icon>
            </template>
          </n-button>

          <n-button
            quaternary
            circle
            size="large"
            :type="isScreenSharing ? 'primary' : 'default'"
            :loading="isTogglingScreenShare"
            @click="toggleScreenShare">
            <template #icon>
              <n-icon><DeviceComputerCamera /></n-icon>
            </template>
          </n-button>

          <n-button
            quaternary
            circle
            size="large"
            :type="isRecording ? 'error' : 'default'"
            :loading="isTogglingRecording"
            @click="toggleRecording">
            <template #icon>
              <n-icon><Radio /></n-icon>
            </template>
          </n-button>

          <n-button type="error" circle size="large" @click="endCall">
            <template #icon>
              <n-icon><PhoneOff /></n-icon>
            </template>
          </n-button>
        </div>

        <div class="controls-right">
          <!-- 邀请 -->
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
            <n-badge v-if="unreadChatCount > 0" :value="unreadChatCount" :max="99" class="chat-unread-badge" />
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
          :class="{ 'own-message': message.senderId === currentUserId }">
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
          :disabled="!isConnected">
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
      <n-input v-model:value="inviteInput" placeholder="输入用户ID或搜索用户" clearable class="invite-input" />
      <div v-if="suggestedUsers.length > 0" class="suggested-users">
        <div v-for="user in suggestedUsers" :key="user.id" class="suggestion-item" @click="selectInviteUser(user)">
          <n-avatar :src="user.avatar" :size="32" round />
          <span>{{ user.name }}</span>
        </div>
      </div>
      <template #action>
        <n-space>
          <n-button @click="showInviteDialog = false">取消</n-button>
          <n-button type="primary" @click="inviteParticipant" :disabled="!inviteInput">邀请</n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- 通话设置抽屉 -->
    <n-drawer v-model:show="showCallSettings" :width="400" placement="right">
      <GroupCallSettings :call-type="callType" :local-stream="localStream" @closed="showCallSettings = false" />
    </n-drawer>

    <!-- 录制指示器 -->
    <div v-if="isRecording" class="recording-indicator">
      <n-icon color="var(--hula-brand-primary)"><Radio /></n-icon>
      <span>录制中</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, type Ref } from 'vue'
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
import { useGroupCall } from './useGroupCall'
import GroupCallSettings from '../GroupCallSettings.vue'
import type { GroupConfig, CurrentUser, CallParticipant } from './types'

interface Props {
  roomId: string
  callId: string
  callType: 'audio' | 'video'
  groupConfig: GroupConfig
  currentUser?: CurrentUser
  participants?: CallParticipant[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'call-ended': [callId: string]
  'participant-joined': [participant: CallParticipant]
  'participant-left': [participant: CallParticipant]
}>()

// Create reactive refs for props
const callIdRef = ref(props.callId)
const callTypeRef = ref(props.callType)
const groupConfigRef = ref(props.groupConfig)
const currentUserRef = ref(props.currentUser)
const participantsRef = ref(props.participants)

// Use composable
const {
  // State
  callState,
  callDuration,
  isMinimized,
  isFullscreen,
  isSidebarCollapsed,
  isChatOpen,
  isConnected,
  localStream,
  isMuted,
  isCameraOff,
  isScreenSharing,
  isRecording,
  isTogglingScreenShare,
  isTogglingRecording,
  remoteParticipants,
  suggestedUsers,
  chatMessages,
  chatInput,
  unreadChatCount,
  showInviteDialog,
  showCallSettings,
  inviteInput,

  // Refs
  chatMessagesRef,
  localVideoRef,

  // Computed
  currentUserId,
  totalParticipants,
  networkQuality,

  // Methods
  startGroupCall,
  endCall,
  inviteParticipant,
  selectInviteUser,
  handleParticipantAction,
  toggleChat,
  sendChatMessage,
  toggleMicrophone,
  toggleCamera,
  toggleScreenShare,
  toggleRecording,
  toggleSidebar,
  minimizeCall,
  restoreCall,
  toggleFullscreen,
  getGridClass,
  formatCallDuration,
  formatMessageTime,
  getParticipantActions
} = useGroupCall({
  roomId: props.roomId,
  callId: callIdRef,
  callType: callTypeRef,
  groupConfig: groupConfigRef,
  currentUser: currentUserRef,
  participants: participantsRef,
  emit: (event: 'call-ended' | 'participant-joined' | 'participant-left', value?: string | CallParticipant) => {
    if (event === 'call-ended') emit('call-ended', value as string)
    if (event === 'participant-joined') emit('participant-joined', value as CallParticipant)
    if (event === 'participant-left') emit('participant-left', value as CallParticipant)
  }
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
    box-shadow: 0 4px 24px rgba(var(--hula-black-rgb), 0.15);
  }

  &.is-fullscreen {
    background: var(--hula-black);
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
  background: var(--hula-brand-primary);

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
  background: var(--hula-brand-primary);
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
      background: var(--hula-brand-primary);
    }
  }

  .participant-info {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 12px;
    background: linear-gradient(to top, rgba(var(--hula-black-rgb), 0.8), transparent);
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
      background: linear-gradient(to top, rgba(var(--hula-success-rgb), 0.8), transparent);
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
    }
  }

  .participants-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .participant-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border-radius: 8px;
    transition: background-color 0.2s;

    &:hover {
      background: var(--bg-color-hover);
    }

    .participant-details {
      flex: 1;

      .name {
        font-weight: 500;
        margin-bottom: 4px;
      }

      .status {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
      }
    }

    &.local-user {
      background: rgba(var(--hula-success-rgb), 0.05);
    }
  }
}

.call-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: var(--card-color);
  border-top: 1px solid var(--border-color);

  .controls-left {
    .call-info {
      display: flex;
      align-items: center;
      gap: 12px;

      .duration {
        font-size: 18px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
      }
    }
  }

  .controls-center {
    display: flex;
    gap: 8px;
  }

  .controls-right {
    display: flex;
    gap: 4px;
  }
}

.minimized-call {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;

  .minimized-content {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    cursor: pointer;

    .call-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      background: var(--primary-color);
      border-radius: 50%;
      color: white;
    }

    .call-info {
      .participant-count {
        font-weight: 600;
        margin-bottom: 2px;
      }

      .call-duration {
        font-size: 12px;
        color: var(--text-color-2);
      }
    }
  }
}

.chat-sidebar {
  position: absolute;
  top: 0;
  right: 300px;
  width: 320px;
  height: 100%;
  background: var(--card-color);
  border-left: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  z-index: 9;

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
    }
  }

  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;

    .chat-message {
      margin-bottom: 16px;

      &.own-message {
        .message-sender {
          color: var(--primary-color);
        }

        .message-content {
          background: var(--primary-color);
          color: white;
          margin-left: auto;
        }
      }

      .message-sender {
        font-size: 12px;
        color: var(--text-color-2);
        margin-bottom: 4px;
      }

      .message-content {
        background: var(--bg-color-hover);
        padding: 8px 12px;
        border-radius: 8px;
        max-width: 80%;
        word-break: break-word;
      }

      .message-time {
        font-size: 11px;
        color: var(--text-color-3);
        margin-top: 4px;
      }
    }
  }

  .chat-input {
    padding: 12px;
    border-top: 1px solid var(--border-color);
  }
}

.suggested-users {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;

  .suggestion-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
      background: var(--bg-color-hover);
    }
  }
}

.invite-input {
  margin-bottom: 16px;
}

.recording-indicator {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(var(--hula-warning-rgb), 0.9);
  color: white;
  border-radius: 20px;
  font-weight: 600;
  z-index: 100;
}

.chat-unread-badge {
  position: absolute;
  top: -4px;
  right: -4px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .sidebar {
    width: 100%;
    transform: translateX(100%);

    &.collapsed {
      transform: translateX(0);
    }
  }

  .chat-sidebar {
    right: 0;
    width: 100%;
  }

  .controls-right {
    display: none;
  }
}
</style>
