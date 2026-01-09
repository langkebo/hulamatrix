<template>
  <div class="room-encryption-panel">
    <h3>加密设置</h3>
    <div class="encryption-settings">
      <div class="encryption-status">
        <n-icon
          :component="encrypted ? Lock : LockOpen"
          :color="encrypted ? 'var(--hula-brand-primary)' : 'var(--hula-brand-primary)'"
          :size="20" />
        <span>房间加密: {{ encrypted ? '已启用' : '未启用' }}</span>
      </div>
      <n-alert v-if="encrypted" type="info" title="端到端加密">
        此房间已启用端到端加密，只有房间成员可以解密消息
      </n-alert>
      <n-button v-else type="primary" :loading="enabling" @click="$emit('enable')">启用端到端加密</n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NIcon, NAlert, NButton } from 'naive-ui'
import { Lock, LockOpen } from '@vicons/tabler'

interface Props {
  encrypted: boolean
  enabling?: boolean
}

defineProps<Props>()

defineEmits<{
  enable: []
}>()
</script>

<style scoped>
.room-encryption-panel {
  margin-bottom: 32px;
}

.room-encryption-panel h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--n-text-color-1);
}

.encryption-settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.encryption-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}
</style>
