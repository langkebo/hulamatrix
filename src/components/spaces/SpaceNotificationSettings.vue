<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { NSwitch, NRadioGroup, NRadio, NSpin, NCard, NSpace, NTag, NInput, NButton } from 'naive-ui'
import { useSpacesStore } from '@/stores/spaces'
import type { SpaceNotificationSettings } from '@/types/space'

interface Props {
  spaceId: string
}

const props = defineProps<Props>()

const spacesStore = useSpacesStore()

const settings = ref<SpaceNotificationSettings | null>(null)
const loading = ref(false)
const saving = ref(false)
const newKeyword = ref('')
const ignoreUserInput = ref('')

const notificationLevel = computed({
  get: () => settings.value?.level || 'all',
  set: (value) => {
    if (settings.value) {
      settings.value.level = value
    }
  }
})

async function loadSettings() {
  loading.value = true
  try {
    settings.value = await spacesStore.fetchNotificationSettings(props.spaceId)
  } finally {
    loading.value = false
  }
}

async function saveSettings() {
  if (!settings.value) return

  saving.value = true
  try {
    const success = await spacesStore.updateNotificationSettings(props.spaceId, settings.value)
    if (success) {
      window.$message?.success('通知设置已保存')
    }
  } finally {
    saving.value = false
  }
}

async function toggleMuted(muted: boolean) {
  const success = await spacesStore.setSpaceMuted(props.spaceId, muted)
  if (success) {
    window.$message?.success(muted ? '已静音' : '已取消静音')
    await loadSettings()
  }
}

async function changeNotificationLevel(level: 'all' | 'mentions' | 'none') {
  const success = await spacesStore.setNotificationLevel(props.spaceId, level)
  if (success) {
    window.$message?.success('通知级别已更新')
    await loadSettings()
  }
}

function addKeyword() {
  if (!settings.value || !newKeyword.value.trim()) return

  if (!settings.value.keywords.includes(newKeyword.value.trim())) {
    settings.value.keywords.push(newKeyword.value.trim())
    newKeyword.value = ''
  }
}

function removeKeyword(keyword: string) {
  if (!settings.value) return
  settings.value.keywords = settings.value.keywords.filter((k) => k !== keyword)
}

function addIgnoreUser(userId: string) {
  if (!settings.value || !userId.trim()) return

  if (!settings.value.ignoreUsers.includes(userId.trim())) {
    settings.value.ignoreUsers.push(userId.trim())
  }
}

function removeIgnoreUser(userId: string) {
  if (!settings.value) return
  settings.value.ignoreUsers = settings.value.ignoreUsers.filter((u) => u !== userId)
}

onMounted(() => {
  loadSettings()
})
</script>

<template>
  <div class="notification-settings">
    <NSpin :show="loading">
      <div v-if="settings" class="settings-content">
        <NCard title="通知设置" class="mb-4">
          <NSpace vertical>
            <div class="flex items-center justify-between">
              <span>启用通知</span>
              <NSwitch v-model:value="settings.enabled" @update:value="toggleMuted(!$event)" />
            </div>

            <div v-if="settings.enabled">
              <label class="block text-sm text-gray-500 mb-2">通知级别</label>
              <NRadioGroup v-model:value="notificationLevel" @update:value="changeNotificationLevel">
                <NSpace vertical>
                  <NRadio value="all">
                    <div>
                      <div class="font-medium">全部消息</div>
                      <div class="text-xs text-gray-500">接收所有消息通知</div>
                    </div>
                  </NRadio>
                  <NRadio value="mentions">
                    <div>
                      <div class="font-medium">仅提及</div>
                      <div class="text-xs text-gray-500">仅在有人提及时接收通知</div>
                    </div>
                  </NRadio>
                  <NRadio value="none">
                    <div>
                      <div class="font-medium">无通知</div>
                      <div class="text-xs text-gray-500">不接收任何通知</div>
                    </div>
                  </NRadio>
                </NSpace>
              </NRadioGroup>
            </div>

            <div class="flex items-center justify-between">
              <span>声音通知</span>
              <NSwitch v-model:value="settings.soundEnabled" />
            </div>
          </NSpace>
        </NCard>

        <NCard title="关键词通知" class="mb-4">
          <NSpace vertical>
            <div class="flex gap-2">
              <NInput v-model:value="newKeyword" placeholder="添加关键词..." @keyup.enter="addKeyword" />
              <NButton type="primary" @click="addKeyword">添加</NButton>
            </div>
            <div v-if="settings.keywords.length > 0" class="keywords-list">
              <NTag
                v-for="keyword in settings.keywords"
                :key="keyword"
                closable
                @close="removeKeyword(keyword)"
                class="mr-2 mb-2"
              >
                {{ keyword }}
              </NTag>
            </div>
            <div v-else class="text-sm text-gray-400">暂无关键词</div>
          </NSpace>
        </NCard>

        <NCard title="忽略用户" class="mb-4">
          <NSpace vertical>
            <div class="flex gap-2">
              <NInput v-model:value="ignoreUserInput" placeholder="添加用户 ID..." />
              <NButton type="primary" @click="addIgnoreUser(ignoreUserInput)">添加</NButton>
            </div>
            <div v-if="settings.ignoreUsers.length > 0" class="ignore-users-list">
              <NTag
                v-for="userId in settings.ignoreUsers"
                :key="userId"
                closable
                @close="removeIgnoreUser(userId)"
                class="mr-2 mb-2"
              >
                {{ userId }}
              </NTag>
            </div>
            <div v-else class="text-sm text-gray-400">暂无忽略用户</div>
          </NSpace>
        </NCard>

        <div class="save-section">
          <NButton type="primary" block :loading="saving" @click="saveSettings">保存设置</NButton>
        </div>
      </div>
      <div v-else class="text-center text-gray-500">加载中...</div>
    </NSpin>
  </div>
</template>

<style scoped>
.notification-settings {
  height: 100%;
  overflow-y: auto;
  padding: 16px;
}

.settings-content {
  max-width: 600px;
  margin: 0 auto;
}

.keywords-list,
.ignore-users-list {
  display: flex;
  flex-wrap: wrap;
}

.save-section {
  margin-top: 24px;
}
</style>
