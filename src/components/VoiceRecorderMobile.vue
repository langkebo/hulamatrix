<template>
  <div class="p-12px">
    <n-space align="center" :size="8">
      <n-button type="primary" @click="onStart" :disabled="!!recorder">开始录音</n-button>
      <n-button type="error" @click="onStop" :disabled="!recorder">停止并发送</n-button>
    </n-space>
    <div class="mt-8px">{{ status }}</div>
  </div>
</template>

<script setup lang="ts">
defineOptions({
  name: 'VoiceRecorderMobile'
})
import { ref } from 'vue'
import { startRecording, stopRecording, sendVoiceMessage } from '@/integrations/matrix/voice'
import { useGlobalStore } from '@/stores/global'

const recorder = ref<MediaRecorder | null>(null)
const status = ref('')
const onStart = async () => {
  recorder.value = await startRecording()
  recorder.value.start()
  status.value = '录音中'
}
const onStop = async () => {
  if (!recorder.value) return
  const blob = await stopRecording(recorder.value)
  recorder.value = null
  const roomId = useGlobalStore().currentSessionRoomId
  if (!roomId) return
  await sendVoiceMessage(roomId, blob)
  status.value = '已发送'
}
</script>

<style scoped></style>
