<template>
  <ChatMultiMsg :content-list="body.content" :msg-ids="msgIds" :msg-id="message.id" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MergeBody, MsgType } from '@/services/types'

const { body, message } = defineProps<{
  body: MergeBody
  message: MsgType
}>()

const msgIds = computed((): string[] => {
  return body.body.map((item) => item.messageId)
})
</script>

<style scoped lang="scss"></style>
