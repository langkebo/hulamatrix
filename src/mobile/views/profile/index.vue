<template>
  <div class="flex flex-col h-full">
    <img :src="bgImage" class="w-100% fixed z-0 top-0" alt="hula" />

    <!-- 设置区 -->
    <Settings />

    <PersonalInfo :is-show="isShow"></PersonalInfo>

    <!-- REMOVED: Dynamic content section - Moments/Feed feature removed (custom backend no longer supported) -->
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import PersonalInfo from '#/components/profile/PersonalInfo.vue'
import Settings from '#/components/profile/Settings.vue'
import bgImage from '@/assets/mobile/chat-home/background.webp'

// REMOVED: useFeedStore, DynamicList - Moments/Feed feature removed

const isShow = ref(true)

onMounted(async () => {
  // REMOVED: Initial feed list loading - Moments/Feed feature removed
})
</script>

<style scoped lang="scss">
.custom-rounded {
  border-radius: 20px 20px 0 0;
  backdrop-filter: blur(10px);
  background: rgba(255, 255, 255, 0.85);
}
</style>
