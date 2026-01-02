<template>
  <n-config-provider>
    <div class="p-16px">
      <n-spin v-if="loading" />
      <n-result v-else-if="error" status="error" title="SSO 登录失败" :description="error" />
      <n-result v-else status="success" title="SSO 登录成功" description="正在跳转..." />
    </div>
  </n-config-provider>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isMobile } from '@/utils/PlatformConstants'
import { matrixClientService } from '@/integrations/matrix/client'
import { useMatrixAuthStore } from '@/stores/matrixAuth'
import { TokenManager } from '@/utils/TokenManager'

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const error = ref('')

const exchangeLoginToken = async (loginToken: string) => {
  const auth = useMatrixAuthStore()
  const base = auth.getHomeserverBaseUrl() || ''
  const url = `${base.replace(/\/$/, '')}/_matrix/client/v3/login`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'm.login.token', token: loginToken })
  })
  if (!res.ok) throw new Error('登录令牌交换失败')
  const js = await res.json()
  const access = js?.access_token
  const refresh = js?.refresh_token || ''
  const userId = js?.user_id || ''
  await TokenManager.updateToken(access, refresh)
  await matrixClientService.initialize({ baseUrl: base, accessToken: access, refreshToken: refresh, userId })
}

onMounted(async () => {
  try {
    const loginToken = (route.query?.loginToken as string) || (route.query?.login_token as string)
    if (!loginToken) throw new Error('未找到登录令牌')
    await exchangeLoginToken(loginToken)
    loading.value = false
    setTimeout(() => {
      const to = isMobile() ? '/mobile/home' : '/login'
      router.push(to)
    }, 800)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '未知错误'
    loading.value = false
  }
})
</script>
