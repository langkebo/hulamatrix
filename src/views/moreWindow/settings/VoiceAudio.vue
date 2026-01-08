<template>
  <n-space vertical :size="16" class="p-16px">
    <n-card>
      <n-space vertical :size="12">
        <n-space align="center" :size="8">
          <span>输入设备</span>
          <n-select v-model:value="selectedInput" :options="inputOptions" placeholder="请选择麦克风" />
        </n-space>
        <n-space align="center" :size="8">
          <span>输出设备</span>
          <n-select v-model:value="selectedOutput" :options="outputOptions" placeholder="请选择扬声器" />
        </n-space>
        <n-space align="center" :size="8">
          <span>麦克风灵敏度</span>
          <n-slider v-model:value="micLevel" :step="1" :min="0" :max="100" class="mic-slider" />
        </n-space>
        <n-space>
          <n-button type="primary" @click="save">保存</n-button>
          <n-button tertiary @click="refresh">刷新设备列表</n-button>
        </n-space>
      </n-space>
    </n-card>
  </n-space>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useMessage } from 'naive-ui'
const msg = useMessage()
const inputOptions = ref<{ label: string; value: string }[]>([])
const outputOptions = ref<{ label: string; value: string }[]>([])
const selectedInput = ref<string>('')
const selectedOutput = ref<string>('')
const micLevel = ref<number>(50)
const refresh = async () => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    inputOptions.value = devices
      .filter((d) => d.kind === 'audioinput')
      .map((d) => ({ label: d.label || '麦克风', value: d.deviceId }))
    outputOptions.value = devices
      .filter((d) => d.kind === 'audiooutput')
      .map((d) => ({ label: d.label || '扬声器', value: d.deviceId }))
    msg.success('设备列表已刷新')
  } catch {
    msg.error('无法获取设备列表')
  }
}
const save = async () => {
  try {
    localStorage.setItem('voice_audio_input', selectedInput.value || '')
    localStorage.setItem('voice_audio_output', selectedOutput.value || '')
    localStorage.setItem('voice_audio_mic_level', String(micLevel.value))
    try {
      const { useRtcStore } = await import('@/stores/rtc')
      const rtc = useRtcStore()
      if (selectedInput.value) rtc.setAudioDevice(selectedInput.value)
      // 输出设备需在具体 audio 元素上 setSinkId，通话界面中读取 localStorage 应用
    } catch {}
    msg.success('设置已保存')
  } catch {
    msg.error('保存失败')
  }
}
onMounted(async () => {
  await refresh()
  selectedInput.value = localStorage.getItem('voice_audio_input') || ''
  selectedOutput.value = localStorage.getItem('voice_audio_output') || ''
  micLevel.value = Number(localStorage.getItem('voice_audio_mic_level') || '50')
})
</script>

<style scoped>
.mic-slider {
  width: 240px;
}
</style>
