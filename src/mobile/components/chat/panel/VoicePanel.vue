<template>
  <div class="h-40 w-full flex flex-col">
    <VoiceRecorderMobile v-show="isVoiceMode" @cancel="handleVoiceCancel" @send="handleVoiceSend" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import VoiceRecorderMobile from '@/components/VoiceRecorderMobile.vue'

const emit = defineEmits(['cancel', 'send'])

const isVoiceMode = ref(true)

const handleVoiceCancel = () => {
  emit('cancel')
}

const handleVoiceSend = async (voiceData: unknown) => {
  emit('send', voiceData)
}
</script>

<style lang="scss" scoped></style>
