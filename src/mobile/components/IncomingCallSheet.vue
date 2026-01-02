<template>
  <div
    v-if="rtc.status === 'incoming'"
    class="fixed left-0 top-0 w-100vw h-100vh z-1000 bg-#00000070 flex items-center justify-center">
    <div class="w-88vw max-w-360px bg-white rounded-12px p-16px">
      <div class="flex items-center gap-8px mb-12px">
        <svg class="size-18px"><use href="#Telephone"></use></svg>
        <span class="text-15px">来电</span>
        <span class="ml-auto text-12px color-#909090">{{ rtc.callType === 'video' ? '视频' : '语音' }}</span>
      </div>
      <div class="flex gap-12px">
        <n-button type="primary" class="flex-1" @click="rtc.acceptCall()">接听</n-button>
        <n-button tertiary class="flex-1" @click="rtc.declineCall()">拒绝</n-button>
      </div>
      <div class="mt-12px flex gap-12px">
        <n-button text class="flex-1" @click="rtc.requestPermissions()">检查权限</n-button>
        <n-button text class="flex-1" @click="rtc.enumerateDevices()">刷新设备</n-button>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { useRtcStore } from '@/stores/rtc'
const rtc = useRtcStore()
</script>
