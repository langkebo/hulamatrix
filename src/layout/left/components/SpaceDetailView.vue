<template>
  <div class="space-detail-view">
    <div class="detail-header">
      <div class="header-left">
        <n-button quaternary circle @click="handleClose">
          <template #icon>
            <svg class="size-18px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </template>
        </n-button>
        <h3>{{ space.name }}</h3>
      </div>
      <div class="header-actions">
        <n-button quaternary circle @click="handleEdit">
          <template #icon>
            <svg class="size-18px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </template>
        </n-button>
      </div>
    </div>

    <div class="detail-content">
      <n-tabs type="line" animated>
        <n-tab-pane :name="t('spaces.detail.rooms')">
          <div class="rooms-panel">
            <div class="panel-header">
              <span>{{ t('spaces.detail.room_count', { count: spaceRooms.length }) }}</span>
              <n-button type="primary" size="small" @click="handleAddRoom">
                {{ t('spaces.rooms.add_room') }}
              </n-button>
            </div>

            <n-spin :show="loading">
              <div v-if="spaceRooms.length === 0" class="empty-state">
                <n-empty :description="t('spaces.rooms.empty')" />
              </div>

              <div v-else class="rooms-list">
                <div v-for="room in spaceRooms" :key="room.roomId" class="room-item">
                  <div class="room-avatar">
                    <n-avatar v-if="room.avatar" :src="room.avatar" :size="36" round />
                    <n-avatar v-else :size="36" round>
                      {{ room.name.charAt(0).toUpperCase() }}
                    </n-avatar>
                  </div>
                  <div class="room-info">
                    <div class="room-name">{{ room.name }}</div>
                    <div class="room-meta">{{ t('spaces.member_count', { count: room.memberCount }) }}</div>
                  </div>
                  <div class="room-actions">
                    <n-button quaternary circle size="small" @click="handleEnterRoom(room.roomId)">
                      <template #icon>
                        <svg class="size-16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M13.8 12H3" />
                        </svg>
                      </template>
                    </n-button>
                    <n-popconfirm @positive-click="handleRemoveRoom(room)">
                      <template #trigger>
                        <n-button quaternary circle size="small">
                          <template #icon>
                            <svg class="size-16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </template>
                        </n-button>
                      </template>
                      {{ t('spaces.rooms.remove_confirm') }}
                    </n-popconfirm>
                  </div>
                </div>
              </div>
            </n-spin>
          </div>
        </n-tab-pane>

        <n-tab-pane :name="t('spaces.detail.members')">
          <div class="members-panel">
            <div class="panel-header">
              <span>{{ t('spaces.detail.member_count', { count: spaceMembers.length }) }}</span>
              <n-button type="primary" size="small" @click="handleInviteMember">
                {{ t('spaces.members.invite') }}
              </n-button>
            </div>

            <n-spin :show="loading">
              <div v-if="spaceMembers.length === 0" class="empty-state">
                <n-empty :description="t('spaces.members.empty')" />
              </div>

              <div v-else class="members-list">
                <div v-for="member in spaceMembers" :key="member.userId" class="member-item">
                  <div class="member-avatar">
                    <n-avatar v-if="member.avatarUrl" :src="member.avatarUrl" :size="36" round />
                    <n-avatar v-else :size="36" round>
                      {{ (member.displayName || member.userId).charAt(0).toUpperCase() }}
                    </n-avatar>
                  </div>
                  <div class="member-info">
                    <div class="member-name">{{ member.displayName || member.userId }}</div>
                    <div class="member-role">{{ getRoleLabel(member.role) }}</div>
                  </div>
                  <div class="member-actions">
                    <n-tag v-if="member.role === 'owner'" type="warning" size="small">
                      {{ t('spaces.members.owner') }}
                    </n-tag>
                    <n-tag v-else-if="member.role === 'admin'" type="info" size="small">
                      {{ t('spaces.members.admin') }}
                    </n-tag>
                  </div>
                </div>
              </div>
            </n-spin>
          </div>
        </n-tab-pane>

        <n-tab-pane :name="t('spaces.detail.settings')">
          <div class="settings-panel">
            <n-form label-placement="left" label-width="100">
              <n-form-item :label="t('spaces.settings.name_label')">
                <n-input v-model:value="editData.name" :placeholder="space.name" />
              </n-form-item>

              <n-form-item :label="t('spaces.settings.topic_label')">
                <n-input v-model:value="editData.topic" type="textarea" :placeholder="space.topic || ''" :rows="3" />
              </n-form-item>

              <n-form-item>
                <n-button type="primary" @click="handleSaveSettings">
                  {{ t('common.save') }}
                </n-button>
              </n-form-item>
            </n-form>
          </div>
        </n-tab-pane>
      </n-tabs>
    </div>

    <n-modal
      v-model:show="inviteModalVisible"
      preset="dialog"
      :title="t('spaces.members.invite')"
      :positive-text="t('common.confirm')"
      :negative-text="t('common.cancel')"
      :positive-button-props="{ loading: inviteLoading }"
      :negative-button-props="{ disabled: inviteLoading }"
      style="width: 400px"
      @positive-click="handleConfirmInvite"
      @negative-click="inviteModalVisible = false"
    >
      <n-input
        v-model:value="inviteUserId"
        :placeholder="t('profile_card.labels.account')"
        @keyup.enter="handleConfirmInvite"
      />
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSpacesStore } from '@/stores/spaces'
import { useGlobalStore } from '@/stores/global.ts'
import type { SpaceInfo, SpaceRoomInfo } from '@/types/space'

const props = defineProps<{
  space: SpaceInfo
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'update', updates: { name?: string; topic?: string }): void
}>()

const { t } = useI18n()
const spacesStore = useSpacesStore()
const globalStore = useGlobalStore()

const loading = computed(() => spacesStore.loading)
const spaceRooms = computed(() => spacesStore.spaceRooms)
const spaceMembers = computed(() => spacesStore.spaceMembers)

const editData = ref({
  name: '',
  topic: ''
})

const inviteModalVisible = ref(false)
const inviteUserId = ref('')
const inviteLoading = ref(false)

onMounted(() => {
  spacesStore.fetchSpaceRooms(props.space.roomId)
  spacesStore.fetchSpaceMembers(props.space.roomId)
  editData.value = {
    name: props.space.name,
    topic: props.space.topic || ''
  }
})

watch(
  () => props.space,
  (newSpace) => {
    spacesStore.fetchSpaceRooms(newSpace.roomId)
    spacesStore.fetchSpaceMembers(newSpace.roomId)
    editData.value = {
      name: newSpace.name,
      topic: newSpace.topic || ''
    }
  }
)

function handleClose(): void {
  emit('close')
}

function handleEdit(): void {}

function handleAddRoom(): void {
  window.$message.info(t('feature.coming_soon'))
}

function handleEnterRoom(roomId: string): void {
  globalStore.updateCurrentSessionRoomId(roomId)
}

async function handleRemoveRoom(room: SpaceRoomInfo): Promise<void> {
  const success = await spacesStore.removeRoomFromSpace(props.space.roomId, room.roomId)
  if (success) {
    window.$message.success(t('common.success'))
  }
}

function handleInviteMember(): void {
  inviteModalVisible.value = true
}

async function handleConfirmInvite(): Promise<void> {
  if (!inviteUserId.value.trim()) {
    window.$message.warning(t('profile_card.labels.account'))
    return
  }

  inviteLoading.value = true
  try {
    const success = await spacesStore.inviteUser(props.space.roomId, inviteUserId.value)
    if (success) {
      window.$message.success(t('common.success'))
      inviteModalVisible.value = false
      inviteUserId.value = ''
      await spacesStore.fetchSpaceMembers(props.space.roomId)
    }
  } finally {
    inviteLoading.value = false
  }
}

async function handleSaveSettings(): Promise<void> {
  const updates: { name?: string; topic?: string } = {}
  if (editData.value.name && editData.value.name !== props.space.name) {
    updates.name = editData.value.name
  }
  if (editData.value.topic !== props.space.topic) {
    updates.topic = editData.value.topic
  }

  if (Object.keys(updates).length > 0) {
    await spacesStore.updateSpaceInfo(props.space.roomId, updates)
    emit('update', updates)
    window.$message.success(t('common.success'))
  }
}

function getRoleLabel(role: string): string {
  const roleMap: Record<string, string> = {
    owner: t('spaces.members.owner'),
    admin: t('spaces.members.admin'),
    member: t('spaces.members.member')
  }
  return roleMap[role] || role
}
</script>

<style lang="scss" scoped>
.space-detail-view {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--left-bg-color);
  z-index: 100;
  display: flex;
  flex-direction: column;
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line-color);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;

  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--left-text-color);
  }
}

.detail-content {
  flex: 1;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  font-size: 14px;
  color: var(--left-text-secondary-color);
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
}

.rooms-list,
.members-list {
  display: flex;
  flex-direction: column;
  padding: 0 8px;
}

.room-item,
.member-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background: var(--left-hover-color);
  }
}

.room-avatar,
.member-avatar {
  flex-shrink: 0;
  margin-right: 12px;
}

.room-info,
.member-info {
  flex: 1;
  min-width: 0;
}

.room-name,
.member-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--left-text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.room-meta,
.member-role {
  font-size: 12px;
  color: var(--left-text-secondary-color);
  margin-top: 2px;
}

.room-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;

  .room-item:hover & {
    opacity: 1;
  }
}

.settings-panel {
  padding: 16px;
}
</style>
