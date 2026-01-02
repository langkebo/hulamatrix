<template>
  <div class="space-list">
    <slot />
  </div>
</template>

<script setup lang="ts">
/**
 * Space information (compatible with other Space types in the project)
 */
interface Space {
  id: string
  roomId?: string
  room_id?: string
  name: string
  topic?: string
  avatar?: string
  isPublic?: boolean
  isArchived?: boolean
  isActive?: boolean
  memberCount?: number
  roomCount?: number
  lastActivity?: number
  [key: string]: unknown
}

defineProps<{ spaces?: Space[]; loading?: boolean }>()
defineEmits<{
  join: [space: Space]
  leave: [space: Space]
  manage: [space: Space]
  refresh: []
}>()
</script>
