<template>
  <n-flex vertical :size="12">
    <n-card title="加密管理">
      <n-flex :size="12">
        <n-tag :type="e2ee.available ? 'success' : 'warning'">库可用: {{ e2ee.available }}</n-tag>
        <n-tag :type="e2ee.initialized ? 'success' : 'warning'">已初始化: {{ e2ee.initialized }}</n-tag>
        <n-tag :type="e2ee.enabled ? 'success' : 'warning'">已启用: {{ e2ee.enabled }}</n-tag>
      </n-flex>
      <n-flex :size="12" class="mt-8px">
        <n-button @click="init">初始化加密</n-button>
      </n-flex>
    </n-card>
  </n-flex>
</template>
<script setup lang="ts">
import { useE2EEStore } from '@/stores/e2ee'
import { initializeEncryption } from '@/integrations/matrix/encryption'

import { msg } from '@/utils/SafeUI'
const e2ee = useE2EEStore()
const init = async () => {
  const ok = await initializeEncryption()
  ;(ok ? msg.success : msg.error)(ok ? '加密已初始化' : '初始化失败')
}
</script>
