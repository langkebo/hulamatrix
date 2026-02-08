/*
 * Vue Composable for Matrix RTC Service
 *
 * Provides reactive access to RTC functionality
 */

import { ref, computed, onUnmounted } from 'vue'
import { matrixRTCService } from '@/services/matrix'
import type { RTCMemberEventContent, CallNotificationContent } from '@/services/matrix'

export function useMatrixRTC() {
  const activeCalls = ref<CallNotificationContent[]>([])
  const rtcMembers = ref<Map<string, RTCMemberEventContent>>(new Map())
  const config = ref<any>(matrixRTCService.getConfig())

  // Subscribe to incoming calls
  const unsubscribeCalls = matrixRTCService.onIncomingCall((_call) => {
    activeCalls.value = matrixRTCService.getActiveCalls()
  })

  // Subscribe to RTC member changes
  const unsubscribeMembers = matrixRTCService.onRTCMemberChange((roomId, _userId, _content) => {
    // Update local state
    const members = matrixRTCService.getActiveRTCMembers(roomId)
    rtcMembers.value = members
  })

  // Cleanup on unmount
  onUnmounted(() => {
    unsubscribeCalls()
    unsubscribeMembers()
  })

  // Computed properties
  const hasActiveCalls = computed(() => activeCalls.value.length > 0)
  const activeCallsCount = computed(() => activeCalls.value.length)
  const totalRTCMembers = computed(() => rtcMembers.value.size)

  // Methods
  const sendCallRing = async (
    roomId: string,
    intent: 'notify_ring' | 'notify_prompt' | 'prompt_ring' = 'notify_ring',
    lifetime?: number
  ) => {
    return await matrixRTCService.sendCallRing(roomId, intent, lifetime)
  }

  const cancelCall = async (callId: string) => {
    await matrixRTCService.cancelCall(callId)
    activeCalls.value = matrixRTCService.getActiveCalls()
  }

  const getRoomCalls = (roomId: string) => {
    return matrixRTCService.getCallsForRoom(roomId)
  }

  const getRTCMembers = (roomId: string) => {
    return matrixRTCService.getActiveRTCMembers(roomId)
  }

  const getActiveSFUs = (roomId: string) => {
    return matrixRTCService.getActiveSFUs(roomId)
  }

  const isUserInCall = (roomId: string, userId: string) => {
    return matrixRTCService.isUserInRTCCall(roomId, userId)
  }

  const setRTCMemberState = async (roomId: string, content: Partial<RTCMemberEventContent>) => {
    await matrixRTCService.setRTCMemberState(roomId, content)
  }

  const clearRTCMemberState = async (roomId: string) => {
    await matrixRTCService.clearRTCMemberState(roomId)
  }

  const updateConfig = (newConfig: Partial<any>) => {
    matrixRTCService.updateConfig(newConfig)
    config.value = matrixRTCService.getConfig()
  }

  const getStats = () => {
    return matrixRTCService.getStats()
  }

  return {
    // State
    activeCalls,
    rtcMembers,
    config,

    // Computed
    hasActiveCalls,
    activeCallsCount,
    totalRTCMembers,

    // Methods
    sendCallRing,
    cancelCall,
    getRoomCalls,
    getRTCMembers,
    getActiveSFUs,
    isUserInCall,
    setRTCMemberState,
    clearRTCMemberState,
    updateConfig,
    getStats
  }
}
