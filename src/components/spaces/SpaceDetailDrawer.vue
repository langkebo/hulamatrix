<template>
  <div v-if="show" class="space-detail-drawer">
    <slot />
  </div>
  <div v-else></div>
</template>

<script setup lang="ts">
import type { Space } from '@/hooks/useMatrixSpaces'

defineProps<{ show: boolean; space?: Space | null }>()
defineEmits<{ 'update:show': [value: boolean] }>()
</script>
