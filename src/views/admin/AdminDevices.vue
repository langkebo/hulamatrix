<template>
  <n-flex vertical :size="12">
    <n-card title="设备管理">
      <n-flex class="mb-8px" :size="8">
        <n-button @click="rtc.enumerateDevices()">刷新设备</n-button>
        <n-button @click="rtc.requestPermissions()" tertiary>检查权限</n-button>
      </n-flex>
      <n-flex :size="16">
        <div class="flex-1">
          <p class="text-13px mb-8px">麦克风</p>
          <n-select :options="audioOptions" v-model:value="audioSel" @update:value="onSelectAudio" />
        </div>
        <div class="flex-1">
          <p class="text-13px mb-8px">摄像头</p>
          <n-select :options="videoOptions" v-model:value="videoSel" @update:value="onSelectVideo" />
        </div>
      </n-flex>
    </n-card>
  </n-flex>
</template>
<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRtcStore } from '@/stores/rtc'
const rtc = useRtcStore()
const audioOptions = computed(() => rtc.audioDevices.map((d) => ({ label: d.label || '麦克风', value: d.deviceId })))
const videoOptions = computed(() => rtc.videoDevices.map((d) => ({ label: d.label || '摄像头', value: d.deviceId })))
const audioSel = ref<string | null>(rtc.selectedAudioId)
const videoSel = ref<string | null>(rtc.selectedVideoId)
const onSelectAudio = (v: string) => rtc.setAudioDevice(v)
const onSelectVideo = (v: string) => rtc.setVideoDevice(v)
onMounted(() => rtc.enumerateDevices())
</script>
