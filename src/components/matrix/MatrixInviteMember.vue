<template>
  <div class="matrix-invite-member">
    <!-- Placeholder for invite member functionality -->
    <n-modal v-bind="show !== undefined ? { show } : {}" @update:show="$emit('update:show', $event)">
      <n-card
        title="邀请成员"
        :bordered="false"
        size="huge"
        role="dialog"
        aria-modal="true"
      >
        <n-space vertical>
          <n-input placeholder="搜索用户" v-model:value="searchQuery" />
          <n-text depth="3">
            此功能正在开发中。请使用 Matrix 客户端邀请成员。
          </n-text>
        </n-space>
        <template #footer>
          <n-space justify="end">
            <n-button @click="$emit('update:show', false)">取消</n-button>
            <n-button type="primary" disabled>邀请</n-button>
          </n-space>
        </template>
      </n-card>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { NModal, NCard, NSpace, NButton, NInput, NText } from 'naive-ui'

interface Props {
  show?: boolean
  roomId?: string
}

defineProps<Props>()
defineEmits<{
  'update:show': [value: boolean]
}>()

const searchQuery = ref('')
</script>

<style scoped>
.matrix-invite-member {
  /* Modal styles handled by Naive UI */
}
</style>
