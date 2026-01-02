<template>
  <div class="relative h-100vh w-full overflow-hidden">
    <CallWindow ref="callWindowRef" />

    <div
      @click="handleBackClick"
      class="absolute z-30 flex items-center cursor-pointer"
      :style="{ top: backButtonTop, left: '16px' }">
      <svg class="size-24px p-5px">
        <use href="#fanhui"></use>
      </svg>
    </div>

    <div
      v-if="true"
      @click="handleSettingsClick"
      class="absolute z-30 flex items-center cursor-pointer"
      :style="{ top: backButtonTop, right: '16px' }">
      <svg class="size-24px p-5px">
        <use href="#settings"></use>
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import CallWindow from '@/views/callWindow/index.vue'
import { useMobileStore } from '@/stores/mobile'

const mobileStore = useMobileStore()
const callWindowRef = ref<InstanceType<typeof CallWindow>>()

const safeAreaTop = computed(() => Math.max(mobileStore.safeArea.top, 0))
const backButtonTop = computed(() => `${safeAreaTop.value + 16}px`)

const handleBackClick = () => {
  callWindowRef.value?.hangUp()
}

const handleSettingsClick = () => {
  callWindowRef.value?.openDeviceDrawer?.()
}
</script>

<style scoped lang="scss"></style>
