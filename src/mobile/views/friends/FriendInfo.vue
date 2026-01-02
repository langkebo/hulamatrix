<template>
  <div class="flex flex-col h-full">
    <HeaderBar
      :isOfficial="false"
      :hidden-right="true"
      :enable-default-background="false"
      :enable-shadow="false"
      room-name="用户资料" />

    <img :src="bgImage" class="w-100% fixed top-0" alt="hula" />

    <PersonalInfo :is-my-page="isMyPage" :is-show="isShow"></PersonalInfo>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import PersonalInfo from '#/components/my/PersonalInfo.vue'
import { useUserStore } from '@/stores/user'
import bgImage from '@/assets/mobile/chat-home/background.webp'

// REMOVED: CommunityTab, CommunityContent, useFeedStore - Moments/Feed feature removed (custom backend no longer supported)

const isShow = ref(true)
const userStore = useUserStore()
const route = useRoute()

const uid = route.params.uid as string
const isMyPage = ref(false)

watch(isShow, (show) => {
  const box = ref<HTMLElement | null>(null)
  if (!box.value) return

  box.value.style.overflow = 'hidden'
  box.value.style.transition = 'all 0.3s ease'

  if (show) {
    box.value.style.height = box.value.scrollHeight + 'px'
    box.value.style.opacity = '1'
    box.value.style.transform = 'scale(1) translateY(0)'
  } else {
    box.value.style.height = '0px'
    box.value.style.opacity = '0'
    box.value.style.transform = 'scale(0.8) translateY(-20px)'
  }
})

onMounted(async () => {
  isMyPage.value = !uid || userStore.userInfo?.uid === uid
})
</script>

<style scoped lang="scss">
.custom-rounded {
  border-radius: 20px 20px 0 0;
  backdrop-filter: blur(10px);
  background: rgba(255, 255, 255, 0.85);
}
</style>
