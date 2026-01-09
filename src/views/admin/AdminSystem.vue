<template>
  <n-flex vertical :size="12">
    <n-card title="系统配置">
      <n-form label-placement="left" label-width="140">
        <n-form-item label="Homeserver Base URL">
          <n-input
            :value="configs.baseUrl ?? ''"
            @update:value="(v: string) => (configs.baseUrl = v)"
            placeholder="https://matrix.example.com" />
        </n-form-item>
        <n-form-item label="加密默认启用">
          <n-switch v-model:value="configs.enableEncryption" />
        </n-form-item>
        <n-form-item>
          <n-button type="primary" @click="save">保存</n-button>
        </n-form-item>
      </n-form>
    </n-card>
  </n-flex>
</template>
<script setup lang="ts">
import { reactive, onMounted } from 'vue'
import { useAdminStore } from '@/stores/admin'

import { msg } from '@/utils/SafeUI'
const store = useAdminStore()
const configs = reactive<{ baseUrl?: string; enableEncryption?: boolean }>({})
onMounted(async () => {
  await store.fetchConfigs()
  Object.assign(configs, store.configs)
})
const save = async () => {
  await store.updateConfig('baseUrl', configs.baseUrl)
  await store.updateConfig('enableEncryption', configs.enableEncryption)
  msg.success?.('已保存系统配置')
}
</script>
