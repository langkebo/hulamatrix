<template>
  <n-space vertical :size="16" class="p-16px">
    <n-card>
      <n-form :model="form" size="medium">
        <n-form-item label="标题">
          <n-input v-model:value="form.subject" placeholder="请输入标题" />
        </n-form-item>
        <n-form-item label="内容">
          <n-input v-model:value="form.content" type="textarea" rows="6" placeholder="请输入详细描述" />
        </n-form-item>
        <n-form-item label="附件">
          <input type="file" @change="onFileChange" />
        </n-form-item>
        <n-space>
          <n-button type="primary" @click="submit">提交</n-button>
          <n-button tertiary @click="reset">重置</n-button>
        </n-space>
      </n-form>
    </n-card>
  </n-space>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { useMessage } from 'naive-ui'
const msg = useMessage()
const form = ref({ subject: '', content: '' })
const fileRef = ref<File | null>(null)
const onFileChange = (e: Event) => {
  const t = e.target as HTMLInputElement
  fileRef.value = (t.files && t.files[0]) || null
}
const submit = async () => {
  try {
    const { submitFeedback, submitFeedbackWithAttachment, submitFeedbackWithMxc } = await import(
      '@/integrations/synapse/privacy'
    )
    if (fileRef.value) {
      try {
        await submitFeedbackWithMxc(form.value.subject, form.value.content, fileRef.value)
      } catch {
        await submitFeedbackWithAttachment(form.value.subject, form.value.content, fileRef.value)
      }
    } else {
      await submitFeedback(form.value.subject, form.value.content)
    }
    msg.success('反馈已提交')
  } catch {
    msg.error('提交失败')
  }
}
const reset = () => {
  form.value = { subject: '', content: '' }
}
</script>
