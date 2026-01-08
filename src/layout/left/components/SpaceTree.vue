<template>
  <div class="space-tree">
    <!-- Empty state -->
    <div v-if="!currentSpace" class="empty-state">
      <p class="text-(12px [--chat-text-color])">请选择一个空间</p>
    </div>

    <!-- Space tree content -->
    <div v-else class="space-content">
      <!-- Space header -->
      <div class="space-header" @click="handleSpaceClick(currentSpace)">
        <div class="flex items-center gap-8px">
          <!-- Expand/collapse icon -->
          <svg class="size-12px transition-transform" :class="{ 'rotate-90deg': isExpanded(currentSpace.roomId) }">
            <use href="#arrow-right"></use>
          </svg>

          <!-- Space avatar -->
          <n-avatar :size="32" round :src="currentSpace.avatar" color="#00BFA5">
            <template #fallback>
              <svg class="size-full">
                <use href="#space"></use>
              </svg>
            </template>
          </n-avatar>

          <!-- Space name -->
          <span class="text-(14px [--text-color]) font-medium">{{ currentSpace.name || '未命名空间' }}</span>
        </div>

        <!-- Member count -->
        <span class="text-(12px [--chat-text-color])">{{ currentSpace.memberCount || 0 }} 成员</span>
      </div>

      <!-- Children (when expanded) -->
      <div v-if="isExpanded(currentSpace.roomId)" class="children-list">
        <!-- Sub-spaces -->
        <div
          v-for="child in childSpaces"
          :key="child.roomId"
          class="child-item flex items-center gap-8px p-[6px_8px] rounded-4px cursor-pointer hover:bg-[--hover-bg]"
          :class="{ active: selectedRoomId === child.roomId }"
          @click="handleChildClick(child, 'space')">
          <svg class="size-16px text-[--icon-color]">
            <use href="#space"></use>
          </svg>
          <span class="text-(13px [--text-color]) flex-1">{{ child.name || '未命名空间' }}</span>
          <span class="text-(11px [--chat-text-color])">{{ child.memberCount || 0 }}</span>
        </div>

        <!-- Rooms -->
        <div
          v-for="room in childRooms"
          :key="room.roomId"
          class="child-item flex items-center gap-8px p-[6px_8px] rounded-4px cursor-pointer hover:bg-[--hover-bg]"
          :class="{ active: selectedRoomId === room.roomId }"
          @click="handleChildClick(room, 'room')">
          <svg class="size-16px text-[--icon-color]">
            <use href="#message"></use>
          </svg>
          <span class="text-(13px [--text-color]) flex-1">{{ room.name || '未命名房间' }}</span>
          <span class="text-(11px [--chat-text-color])">{{ room.memberCount || 0 }}</span>
        </div>

        <!-- No children -->
        <div v-if="childSpaces.length === 0 && childRooms.length === 0" class="empty-children">
          <p class="text-(12px [--chat-text-color])">暂无子空间或房间</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useSpacesStore } from '@/stores/spaces'
import { useMitt } from '@/hooks/useMitt'
import { MittEnum } from '@/enums'
import { logger } from '@/utils/logger'
import type { SpaceInfo, SpaceChild } from '@/services/matrixSpacesService'

const emit = defineEmits<{
  (e: 'room-selected', roomId: string): void
  (e: 'space-selected', spaceId: string): void
}>()

const spacesStore = useSpacesStore()

// Currently selected space
const currentSpace = computed((): SpaceInfo | null => spacesStore.selectedSpace)

// Get children of current space
const children = computed((): SpaceChild[] => {
  if (!currentSpace.value) return []
  return currentSpace.value.children || []
})

// Filter child spaces and rooms
const childSpaces = computed((): SpaceChild[] => {
  return children.value.filter((child) => child.type === 'space')
})

const childRooms = computed((): SpaceChild[] => {
  return children.value.filter((child) => child.type === 'room')
})

const selectedRoomId = computed(() => spacesStore.selectedRoomId)

// Check if space is expanded
const isExpanded = (spaceId: string): boolean => {
  return spacesStore.isSpaceExpanded(spaceId)
}

// Handle space header click
const handleSpaceClick = (space: SpaceInfo) => {
  logger.info('[SpaceTree] Space header clicked', { spaceId: space.roomId })
  spacesStore.toggleSpaceExpand(space.roomId)
}

// Handle child item click
const handleChildClick = (child: SpaceChild, type: 'space' | 'room') => {
  logger.info('[SpaceTree] Child clicked', { childId: child.roomId, type })

  if (type === 'space') {
    // Select the sub-space
    spacesStore.selectSpace(child.roomId)
    emit('space-selected', child.roomId)
  } else {
    // Select the room
    spacesStore.selectRoom(child.roomId)
    emit('room-selected', child.roomId)

    // Notify chat component to open the room
    useMitt.emit(MittEnum.OPEN_ROOM, { roomId: child.roomId })
  }
}
</script>

<style lang="scss" scoped>
.space-tree {
  height: 100%;
  overflow-y: auto;
  padding: 8px;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background-color: var(--scrollbar-thumb);
    border-radius: 2px;
  }
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
}

.space-content {
  .space-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px;
    border-radius: 6px;
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
      background-color: var(--hover-bg);
    }
  }

  .children-list {
    margin-left: 20px;
    margin-top: 4px;

    .child-item {
      transition: background-color 0.2s;

      &.active {
        background-color: var(--left-active-bg);
      }
    }
  }

  .empty-children {
    padding: 20px;
    text-align: center;
  }
}
</style>
