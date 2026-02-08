<template>
  <div class="spaces-panel">
    <div class="spaces-header">
      <h3>{{ t('spaces.title') }}</h3>
      <n-button quaternary circle size="small" @click="handleCreateSpace">
        <template #icon>
          <SpaceIcon :size="18" />
        </template>
      </n-button>
    </div>

    <div class="spaces-content">
      <n-spin :show="loading">
        <div v-if="sortedSpaces.length === 0" class="spaces-empty">
          <n-empty :description="t('spaces.empty')">
            <template #extra>
              <n-button type="primary" @click="handleCreateSpace">
                {{ t('spaces.create_first') }}
              </n-button>
            </template>
          </n-empty>
        </div>

        <div v-else class="spaces-list">
          <div
            v-for="space in sortedSpaces"
            :key="space.roomId"
            :class="['space-item', { active: currentSpace?.roomId === space.roomId }]"
            @click="handleSelectSpace(space)"
          >
            <div class="space-avatar">
              <n-avatar
                v-if="space.avatar"
                :src="space.avatar"
                :size="40"
                round
              />
              <n-avatar v-else :size="40" round>
                {{ space.name.charAt(0).toUpperCase() }}
              </n-avatar>
            </div>
            <div class="space-info">
              <div class="space-name">{{ space.name }}</div>
              <div class="space-meta">
                <span>{{ t('spaces.member_count', { count: space.memberCount }) }}</span>
              </div>
            </div>
            <div class="space-actions">
              <n-dropdown
                :options="getSpaceMenuOptions(space)"
                @select="(key: string) => handleSpaceMenuAction(key, space)"
              >
                <n-button quaternary circle size="small">
                  <template #icon>
                    <svg class="size-16px" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="6" r="2" />
                      <circle cx="12" cy="12" r="2" />
                      <circle cx="12" cy="18" r="2" />
                    </svg>
                  </template>
                </n-button>
              </n-dropdown>
            </div>
          </div>
        </div>
      </n-spin>
    </div>

    <SpaceCreateModal
      v-model:show="createModalVisible"
      @success="handleCreateSuccess"
    />

    <SpaceDetailView
      v-if="currentSpace"
      :space="currentSpace"
      @close="handleCloseDetail"
      @update="handleUpdateSpace"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSpacesStore } from '@/stores/spaces'
import type { SpaceInfo } from '@/types/space'
import SpaceIcon from '@/components/common/SpaceIcon.vue'
import SpaceCreateModal from './SpaceCreateModal.vue'
import SpaceDetailView from './SpaceDetailView.vue'

const { t } = useI18n()
const spacesStore = useSpacesStore()

const createModalVisible = ref(false)

const loading = computed(() => spacesStore.loading)
const sortedSpaces = computed(() => spacesStore.sortedSpaces)
const currentSpace = computed(() => spacesStore.currentSpace)

onMounted(() => {
  spacesStore.fetchSpaces()
})

function handleSelectSpace(space: SpaceInfo): void {
  spacesStore.setCurrentSpace(space)
}

function handleCloseDetail(): void {
  spacesStore.setCurrentSpace(null)
}

function handleCreateSpace(): void {
  createModalVisible.value = true
}

function handleCreateSuccess(spaceId: string): void {
  const space = spacesStore.spaces.find((s) => s.roomId === spaceId)
  if (space) {
    spacesStore.setCurrentSpace(space)
  }
  createModalVisible.value = false
}

function handleUpdateSpace(updates: { name?: string; topic?: string }): void {
  if (currentSpace.value) {
    spacesStore.updateSpaceInfo(currentSpace.value.roomId, updates)
  }
}

function getSpaceMenuOptions(_space: SpaceInfo): Array<{ label: string; key: string } | { type: string; key: string }> {
  return [
    {
      label: t('spaces.menu.view_details'),
      key: 'view_details'
    },
    {
      label: t('spaces.menu.add_rooms'),
      key: 'add_rooms'
    },
    {
      type: 'divider',
      key: 'd1'
    },
    {
      label: t('spaces.menu.leave_space'),
      key: 'leave_space'
    }
  ]
}

function handleSpaceMenuAction(key: string, space: SpaceInfo): void {
  switch (key) {
    case 'view_details':
      spacesStore.setCurrentSpace(space)
      break
    case 'add_rooms':
      spacesStore.setCurrentSpace(space)
      break
    case 'leave_space':
      handleLeaveSpace(space)
      break
  }
}

async function handleLeaveSpace(space: SpaceInfo): Promise<void> {
  window.$dialog.warning({
    title: t('spaces.leave_confirm_title'),
    content: t('spaces.leave_confirm_content', { name: space.name }),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      await spacesStore.leaveSpace(space.roomId)
      window.$message.success(t('spaces.leave_success'))
    }
  })
}
</script>

<style lang="scss" scoped>
.spaces-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--left-bg-color);
}

.spaces-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--line-color);

  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--left-text-color);
  }
}

.spaces-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.spaces-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
}

.spaces-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.space-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background: var(--left-hover-color);
  }

  &.active {
    background: var(--left-active-color);
  }
}

.space-avatar {
  flex-shrink: 0;
  margin-right: 12px;
}

.space-info {
  flex: 1;
  min-width: 0;
}

.space-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--left-text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.space-meta {
  font-size: 12px;
  color: var(--left-text-secondary-color);
  margin-top: 2px;
}

.space-actions {
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.2s;

  .space-item:hover & {
    opacity: 1;
  }
}
</style>
