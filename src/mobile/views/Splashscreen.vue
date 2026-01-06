<template>
  <!-- 🚀 加载页 DOM -->
  <div id="loading-page" class="h-100vh"></div>
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingStore } from '@/stores/setting'
import { useLogin } from '@/hooks/useLogin'
import { invoke } from '@tauri-apps/api/core'
import { isAndroid, isIOS } from '@/utils/PlatformConstants'

const settingStore = useSettingStore()
const router = useRouter()
const { normalLogin } = useLogin()

// 根据平台选择启动图片
const splashImage = computed(() => {
  if (isAndroid()) {
    return '/Mobile/3.png'
  }
  if (isIOS()) {
    return '/Mobile/4.png'
  }
  // 默认启动图片
  return '/Mobile/2.png'
})

const init = async () => {
  if (settingStore.login.autoLogin) {
    normalLogin('MOBILE', true, true)
  } else {
    router.push('/mobile/login')
    await invoke('hide_splash_screen')
  }
}

onMounted(() => {
  // 动态设置背景图片
  const loadingPage = document.getElementById('loading-page')
  if (loadingPage) {
    loadingPage.style.backgroundImage = `url('${splashImage.value}')`
  }

  init()
})
</script>

<style scoped lang="scss">
#loading-page {
  z-index: 9999;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  opacity: 1;
}
</style>
