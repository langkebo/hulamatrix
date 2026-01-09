/**
 * Group Call Interface - Composable
 *
 * 提取 GroupCallInterface 组件的业务逻辑
 */

import { ref, watch, onMounted, onUnmounted, nextTick, type Ref } from 'vue'
import { useWebRtc } from '@/hooks/useWebRtc'
import { CallTypeEnum } from '@/enums'
import { logger } from '@/utils/logger'
import type {
  GroupConfig,
  CurrentUser,
  SuggestedUser,
  CallParticipant,
  ChatMessage,
  ParticipantJoinedData,
  ParticipantLeftData,
  MessageReceivedData,
  SpeakingChangedData,
  NetworkQuality,
  ParticipantActionOption
} from './types'

interface Options {
  roomId: string
  callId: Ref<string>
  callType: Ref<'audio' | 'video'>
  groupConfig: Ref<GroupConfig>
  currentUser?: Ref<CurrentUser | undefined>
  participants?: Ref<CallParticipant[] | undefined>
  emit: (event: 'call-ended' | 'participant-joined' | 'participant-left', value?: string | CallParticipant) => void
}

export function useGroupCall(options: Options) {
  const rtc = useWebRtc(
    options.roomId,
    'group-call',
    options.callType.value === 'video' ? CallTypeEnum.VIDEO : CallTypeEnum.AUDIO,
    false
  )

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

  // ============ 状态管理 ============
  const callState = ref<'calling' | 'connected' | 'ended'>('calling')
  const callDuration = ref(0)
  const isMinimized = ref(false)
  const isFullscreen = ref(false)
  const isSidebarCollapsed = ref(false)
  const isChatOpen = ref(false)
  const isConnected = ref(false)

  // 媒体流
  const localStream = ref<MediaStream | null>(null)

  // 设备状态
  const isMuted = ref(false)
  const isCameraOff = ref(false)

  // 功能状态
  const isScreenSharing = ref(false)
  const isRecording = ref(false)
  const isTogglingScreenShare = ref(false)
  const isTogglingRecording = ref(false)

  // 参与者
  const remoteParticipants = ref<CallParticipant[]>([])
  const suggestedUsers = ref<SuggestedUser[]>([])

  // 聊天
  const chatMessages = ref<ChatMessage[]>([])
  const chatInput = ref('')
  const unreadChatCount = ref(0)

  // UI状态
  const showInviteDialog = ref(false)
  const showCallSettings = ref(false)
  const inviteInput = ref('')

  // 引用
  const chatMessagesRef = ref<HTMLElement>()
  const localVideoRef = ref<HTMLVideoElement>()

  // ============ 计算属性 ============
  const currentUserId = computed(() => options.currentUser?.value?.id || 'current-user')
  const totalParticipants = computed(() => 1 + remoteParticipants.value.length)

  const networkQuality = computed<NetworkQuality>(() => ({ type: 'default' as const, text: '检测中' }))

  // ============ 工具方法 ============
  const getGridClass = (): string => {
    const count = totalParticipants.value
    if (count <= 2) return 'grid-1x1'
    if (count <= 4) return 'grid-2x2'
    if (count <= 6) return 'grid-2x3'
    if (count <= 9) return 'grid-3x3'
    return 'grid-auto'
  }

  const formatCallDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`
    }
  }

  const formatMessageTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getParticipantActions = (_participant: CallParticipant): ParticipantActionOption[] => {
    const actions: ParticipantActionOption[] = [{ label: '发送私信', key: 'private-message', icon: () => '💬' }]

    if (options.currentUser?.value?.isHost) {
      actions.push({ label: '静音', key: 'mute', icon: () => '🔇' }, { label: '移除', key: 'remove', icon: () => '🚪' })
    }

    return actions
  }

  // ============ 群组通话控制 ============
  const startGroupCall = async () => {
    try {
      // 获取本地媒体流
      localStream.value = await rtcManager.getUserMedia({
        audio: true,
        video: options.callType.value === 'video'
      })

      // 设置视频元素源
      if (localVideoRef.value && localStream.value) {
        localVideoRef.value.srcObject = localStream.value
      }

      // 初始化群组通话
      await rtcManager.initiateGroupCall(options.roomId, {
        ...options.groupConfig.value,
        callType: options.callType.value
      })

      callState.value = 'connected'
      isConnected.value = true
      startCallTimer()
    } catch (error) {
      logger.error('Failed to start group call:', error)
      const message = ref('')
      message.value = '无法启动群组通话'
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
      if (isScreenSharing.value) {
        await stopScreenShare()
      }

      // 结束群组通话
      await rtcManager.endGroupCall(options.callId.value)

      // 停止本地流
      if (localStream.value) {
        localStream.value.getTracks().forEach((track: MediaStreamTrack) => track.stop())
        localStream.value = null
      }

      callState.value = 'ended'
      isConnected.value = false
      stopCallTimer()
      options.emit('call-ended', options.callId.value)
    } catch (error) {
      logger.error('Failed to end group call:', error)
    }
  }

  // ============ 参与者管理 ============
  const inviteParticipant = async () => {
    try {
      await rtcManager.inviteToGroupCall(options.callId.value, inviteInput.value)
      logger.debug(`已邀请 ${inviteInput.value}`)
      showInviteDialog.value = false
      inviteInput.value = ''
    } catch (error) {
      logger.error('Failed to invite participant:', error)
      const message = ref('')
      message.value = '邀请失败'
    }
  }

  const selectInviteUser = (user: SuggestedUser) => {
    inviteInput.value = user.id
    inviteParticipant()
  }

  const handleParticipantAction = async (action: string, participant: CallParticipant) => {
    switch (action) {
      case 'private-message':
        logger.debug(`打开与 ${participant.name} 的私信`)
        break
      case 'mute':
        await rtcManager.muteParticipant(options.callId.value, participant.userId)
        logger.debug(`已静音 ${participant.name}`)
        break
      case 'remove':
        // TODO: Show confirmation dialog
        await rtcManager.removeFromGroupCall(options.callId.value, participant.userId)
        logger.debug(`已移除 ${participant.name}`)
        break
    }
  }

  // ============ 聊天功能 ============
  const toggleChat = () => {
    isChatOpen.value = !isChatOpen.value
    if (isChatOpen.value) {
      unreadChatCount.value = 0
      nextTick(() => {
        scrollToBottomChat()
      })
    }
  }

  const sendChatMessage = async () => {
    if (!chatInput.value.trim()) return

    const message: ChatMessage = {
      id: `msg_${Date.now()}`,
      senderId: currentUserId.value,
      senderName: options.currentUser?.value?.name || '我',
      content: chatInput.value.trim(),
      timestamp: Date.now()
    }

    chatMessages.value.push(message)
    await rtcManager.sendGroupCallMessage(options.callId.value, message.content)
    chatInput.value = ''

    nextTick(() => {
      scrollToBottomChat()
    })
  }

  const scrollToBottomChat = () => {
    if (chatMessagesRef.value) {
      chatMessagesRef.value.scrollTop = chatMessagesRef.value.scrollHeight
    }
  }

  // ============ 媒体控制 ============
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

  // ============ 屏幕共享 ============
  const toggleScreenShare = async () => {
    if (isScreenSharing.value) {
      await stopScreenShare()
    } else {
      await startScreenShare()
    }
  }

  const startScreenShare = async () => {
    try {
      isTogglingScreenShare.value = true
      await rtcManager.startGroupScreenShare()
      isScreenSharing.value = true
      logger.debug('屏幕共享已开启')
    } catch (error) {
      logger.error('Failed to start screen share:', error)
      const message = ref('')
      message.value = '无法开启屏幕共享'
    } finally {
      isTogglingScreenShare.value = false
    }
  }

  const stopScreenShare = async () => {
    try {
      isTogglingScreenShare.value = true
      await rtcManager.stopGroupScreenShare()
      isScreenSharing.value = false
      logger.debug('屏幕共享已停止')
    } catch (error) {
      logger.error('Failed to stop screen share:', error)
    } finally {
      isTogglingScreenShare.value = false
    }
  }

  // ============ 录制功能 ============
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
      await rtcManager.startGroupRecording(options.callId.value, 'webm')
      isRecording.value = true
      logger.debug('群组录制已开始')
    } catch (error) {
      logger.error('Failed to start recording:', error)
      const message = ref('')
      message.value = '无法开始录制'
    } finally {
      isTogglingRecording.value = false
    }
  }

  const stopRecording = async () => {
    try {
      isTogglingRecording.value = true
      const recording = await rtcManager.stopGroupRecording(options.callId.value)
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

  // ============ UI控制 ============
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

  // ============ 计时器 ============
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

  // ============ 监听器 ============
  watch(
    () => options.participants?.value,
    (newParticipants) => {
      if (newParticipants) {
        remoteParticipants.value = newParticipants.filter((p) => p.userId !== currentUserId.value)
      }
    },
    { immediate: true, deep: true }
  )

  watch(
    () => options.callId.value,
    (newCallId) => {
      if (newCallId) {
        startGroupCall()
      }
    },
    { immediate: true }
  )

  // ============ 生命周期 ============
  onMounted(() => {
    // 监听群组通话事件
    rtcManager.addEventListener('group-participant-joined', (...args: unknown[]) => {
      const data = args[0] as ParticipantJoinedData
      if (data.callId === options.callId.value) {
        remoteParticipants.value.push(data.participant)
        options.emit('participant-joined', data.participant)

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
      if (data.callId === options.callId.value) {
        const index = remoteParticipants.value.findIndex((p) => p.userId === data.participant.userId)
        if (index > -1) {
          remoteParticipants.value.splice(index, 1)
        }
        options.emit('participant-left', data.participant)

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
      if (data.callId === options.callId.value) {
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
      if (data.callId === options.callId.value) {
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

  return {
    // 状态
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

    // 引用
    chatMessagesRef,
    localVideoRef,

    // 计算属性
    currentUserId,
    totalParticipants,
    networkQuality,

    // 通话控制
    startGroupCall,
    endCall,

    // 参与者管理
    inviteParticipant,
    selectInviteUser,
    handleParticipantAction,

    // 聊天功能
    toggleChat,
    sendChatMessage,

    // 媒体控制
    toggleMicrophone,
    toggleCamera,

    // 屏幕共享
    toggleScreenShare,

    // 录制
    toggleRecording,

    // UI控制
    toggleSidebar,
    minimizeCall,
    restoreCall,
    toggleFullscreen,

    // 工具方法
    getGridClass,
    formatCallDuration,
    formatMessageTime,
    getParticipantActions
  }
}
