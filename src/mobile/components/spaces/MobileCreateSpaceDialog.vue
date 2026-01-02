<template>
  <n-modal v-model:show="show" preset="dialog" title="创建工作区" :mask-closable="false">
    <n-form>
      <n-form-item label="名称">
        <n-input v-model:value="name" placeholder="请输入工作区名称" />
      </n-form-item>
    </n-form>
    <template #action>
      <n-button tertiary @click="show = false">取消</n-button>
      <n-button type="primary" @click="handleCreate">创建</n-button>
    </template>
  </n-modal>
</template>
<script setup lang="ts">
import { ref } from 'vue'

interface Space {
  id: string
  name: string
  avatar: string
  children: unknown[]
  isPublic: boolean
  topic: string
  memberCount: number
  notifications: { highlightCount: number; notificationCount: number }
}

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ (e: 'update:show', v: boolean): void; (e: 'created', space: Space): void }>()
const show = ref(props.show)
const name = ref('')
const handleCreate = () => {
  const space: Space = {
    id: `space_${Date.now()}`,
    name: name.value || '未命名工作区',
    avatar: '',
    children: [],
    isPublic: false,
    topic: '',
    memberCount: 1,
    notifications: { highlightCount: 0, notificationCount: 0 }
  }
  emit('created', space)
  show.value = false
  emit('update:show', false)
}
</script>
