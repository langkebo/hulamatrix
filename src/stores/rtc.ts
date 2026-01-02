import { defineStore } from 'pinia'
import { ref } from 'vue'
import { sendMatrixRtcSignal } from '@/integrations/matrix/rtc'
import { msg } from '@/utils/SafeUI'
import { logger } from '@/utils/logger'

export const useRtcStore = defineStore('rtc', () => {
  const status = ref<'idle' | 'incoming' | 'ongoing' | 'ended'>('idle')
  const roomId = ref('')
  const fromUser = ref('')
  const callType = ref<'audio' | 'video'>('audio')
  const lastEventTs = ref<number | null>(null)
  const startTime = ref<number | null>(null)
  const durationText = ref('00:00')
  let durationTimer: ReturnType<typeof setInterval> | null = null
  const audioDevices = ref<Array<MediaDeviceInfo>>([])
  const videoDevices = ref<Array<MediaDeviceInfo>>([])
  const selectedAudioId = ref<string | null>(null)
  const selectedVideoId = ref<string | null>(null)

  const setIncoming = (rid: string, from: string, type: 'audio' | 'video') => {
    status.value = 'incoming'
    roomId.value = rid
    fromUser.value = from
    callType.value = type
    lastEventTs.value = Date.now()
    startTime.value = null
    clearTimer()
  }

  const setOngoing = (rid: string) => {
    status.value = 'ongoing'
    roomId.value = rid
    lastEventTs.value = Date.now()
    startTime.value = Date.now()
    startTimer()
  }

  const setEnded = (rid: string) => {
    status.value = 'ended'
    roomId.value = rid
    lastEventTs.value = Date.now()
    clearTimer()
  }

  const clear = () => {
    status.value = 'idle'
    roomId.value = ''
    fromUser.value = ''
    lastEventTs.value = null
    startTime.value = null
    durationText.value = '00:00'
    clearTimer()
  }

  const acceptCall = async () => {
    if (!roomId.value) return
    // Send answer RTC signal with required call_id and version
    await sendMatrixRtcSignal(roomId.value, 'answer', {
      call_id: roomId.value,
      version: 1,
      answer: { type: 'answer' as const, sdp: '' }
    })
    setOngoing(roomId.value)
  }

  const declineCall = async () => {
    if (!roomId.value) return
    // Send hangup/reject RTC signal with required call_id and version
    await sendMatrixRtcSignal(roomId.value, 'hangup', {
      call_id: roomId.value,
      version: 1,
      reason: 'user_hangup'
    })
    setEnded(roomId.value)
  }

  const hangup = async () => {
    if (!roomId.value) return
    // Send hangup RTC signal with required call_id and version
    await sendMatrixRtcSignal(roomId.value, 'hangup', {
      call_id: roomId.value,
      version: 1,
      reason: 'user_hangup'
    })
    setEnded(roomId.value)
  }

  const startTimer = () => {
    clearTimer()
    durationTimer = setInterval(() => {
      if (!startTime.value) return
      const elapsed = Math.floor((Date.now() - startTime.value) / 1000)
      const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
      const ss = String(elapsed % 60).padStart(2, '0')
      durationText.value = `${mm}:${ss}`
    }, 1000)
  }

  const clearTimer = () => {
    if (durationTimer) {
      clearInterval(durationTimer)
      durationTimer = null
    }
  }

  const requestPermissions = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      msg.success('权限正常：麦克风/摄像头可用')
      return true
    } catch (_e: unknown) {
      const error = _e instanceof Error ? _e : new Error(String(_e))
      logger.error('[RTC] Permission request failed:', error)
      msg.error('请授予麦克风/摄像头权限')
      return false
    }
  }

  const enumerateDevices = async () => {
    try {
      const devs = await navigator.mediaDevices.enumerateDevices()
      audioDevices.value = devs.filter((d) => d.kind === 'audioinput')
      videoDevices.value = devs.filter((d) => d.kind === 'videoinput')
      if (!selectedAudioId.value && audioDevices.value[0]) selectedAudioId.value = audioDevices.value[0].deviceId
      if (!selectedVideoId.value && videoDevices.value[0]) selectedVideoId.value = videoDevices.value[0].deviceId
    } catch {
      // Silently ignore device enumeration errors
    }
  }

  const setAudioDevice = (id: string) => {
    selectedAudioId.value = id
    msg.info('已选择麦克风设备，通话时生效')
  }

  const setVideoDevice = (id: string) => {
    selectedVideoId.value = id
    msg.info('已选择摄像头设备，通话时生效')
  }

  return {
    status,
    roomId,
    fromUser,
    callType,
    lastEventTs,
    startTime,
    durationText,
    audioDevices,
    videoDevices,
    selectedAudioId,
    selectedVideoId,
    setIncoming,
    setOngoing,
    setEnded,
    clear,
    acceptCall,
    declineCall,
    hangup,
    requestPermissions,
    enumerateDevices,
    setAudioDevice,
    setVideoDevice
  }
})
