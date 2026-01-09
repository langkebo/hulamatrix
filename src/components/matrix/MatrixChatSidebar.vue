<template>
  <SidebarMatrixChatSidebar
    v-if="show"
    :room-id="roomId"
    @close="$emit('close')"
    @scroll-to-message="$emit('scrollToMessage', $event)" />
</template>

<script setup lang="ts">
import { defineComponent } from 'vue'
import SidebarMatrixChatSidebar from './sidebar/MatrixChatSidebar.vue'

interface Props {
  roomId: string
  show: boolean
}

defineProps<Props>()

defineEmits<{
  close: []
  scrollToMessage: [eventId: string]
}>()

// Re-export for backward compatibility
defineOptions({
  name: 'MatrixChatSidebar'
})
</script>
