<template>
  <div class="p-12px">
    <n-space align="center" :size="8">
      <n-input v-model:value="start" placeholder="开始 HH:MM" class="time-input" />
      <n-input v-model:value="end" placeholder="结束 HH:MM" class="time-input" />
      <n-button type="primary" @click="save">保存静音时段</n-button>
    </n-space>
    <div class="mt-8px">{{ tip }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getQuietHours, setQuietHours } from '@/integrations/matrix/pushers'
const start = ref('22:00')
const end = ref('08:00')
const tip = ref('')
onMounted(() => {
  const q = getQuietHours()
  if (q) {
    start.value = q.start
    end.value = q.end
  }
})
const save = () => {
  const ok = setQuietHours(start.value, end.value)
  tip.value = ok ? '已保存' : '时间格式无效'
}
</script>

<style scoped>
/* 时间输入框 */
.time-input {
  width: 120px;
}
</style>
