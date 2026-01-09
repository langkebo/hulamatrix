<template>
  <div class="spaces-list flex-col-x-center gap-10px">
    <!-- Spaces -->
    <div
      v-for="space in spaces"
      :key="space.roomId"
      :class="['space-item flex-col-center', { active: selectedSpaceId === space.roomId }, 'p-[6px_8px]']"
      :title="space.name"
      @click="handleSpaceClick(space)">
      <!-- Space avatar/icon -->
      <n-avatar :size="showMode === ShowModeEnum.ICON ? 32 : 24" round :src="spaceAvatar(space)" color="#00BFA5">
        <template #fallback>
          <svg class="size-full">
            <use href="#space"></use>
          </svg>
        </template>
      </n-avatar>

      <!-- Space name in text mode -->
      <p v-if="showMode === ShowModeEnum.TEXT" class="text-(10px center) mt-2px truncate max-w-40px">
        {{ spaceName(space) }}
      </p>
    </div>

    <CreateSpaceModal />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { ShowModeEnum } from '@/enums'
import { useSpacesStore } from '@/stores/spaces'
import { useSettingStore } from '@/stores/setting'
import { useMitt } from '@/hooks/useMitt'
import { MittEnum } from '@/enums'
import { logger } from '@/utils/logger'
import type { SpaceInfo } from '@/matrix/services/room/spaces'
import CreateSpaceModal from '@/components/spaces/CreateSpaceModal.vue'

const emit = defineEmits<(e: 'space-selected', space: SpaceInfo) => void>()

const spacesStore = useSpacesStore()
const showMode = computed(() => useSettingStore().showMode)

// Get spaces to display in sidebar (top-level only)
const spaces = computed(() => spacesStore.sidebarSpaces)
const selectedSpaceId = computed(() => spacesStore.selectedSpaceId)

// Get space avatar URL
const spaceAvatar = (space: SpaceInfo): string | undefined => {
  return space.avatar
}

// Get space display name (truncated)
const spaceName = (space: SpaceInfo): string => {
  const name = space.name || '未命名空间'
  return name.length > 4 ? name.substring(0, 4) + '...' : name
}

// Handle space click
const handleSpaceClick = (space: SpaceInfo) => {
  logger.info('[SpacesList] Space clicked', { spaceId: space.roomId, name: space.name })

  // Select the space
  spacesStore.selectSpace(space.roomId)

  // Emit event for parent component
  emit('space-selected', space)

  // Notify other components to switch to space view
  useMitt.emit(MittEnum.SPACE_SELECTED, { spaceId: space.roomId })
}

// Initialize on mount
onMounted(async () => {
  try {
    // Initialize spaces store if not already initialized
    if (!spacesStore.initialized) {
      await spacesStore.initialize()
    }
  } catch (error) {
    logger.error('[SpacesList] Failed to initialize spaces store:', error)
  }
})
</script>

<style lang="scss" scoped>
.spaces-list {
  color: var(--left-icon-color);
}

.space-item {
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 6px;

  &:hover {
    background-color: var(--left-icon-hover-bg);
  }

  &.active {
    color: var(--left-active-icon-color);
    background-color: var(--left-active-bg);
  }
}
</style>
