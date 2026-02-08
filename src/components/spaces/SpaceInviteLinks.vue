<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NButton, NInput, NSpin, NEmpty, NCard, NSpace, NTag, NPopconfirm } from 'naive-ui'
import { useSpacesStore } from '@/stores/spaces'

interface Props {
  spaceId: string
}

const props = defineProps<Props>()

const spacesStore = useSpacesStore()

const inviteLinks = ref<any[]>([])
const newLinkExpiry = ref<string>('86400')
const loading = ref(false)

async function loadInviteLinks() {
  loading.value = true
  try {
    inviteLinks.value = await spacesStore.getInviteLinks(props.spaceId)
  } finally {
    loading.value = false
  }
}

async function createNewLink() {
  const link = await spacesStore.createInviteLink(props.spaceId, Number.parseInt(newLinkExpiry.value, 10))
  if (link) {
    window.$message?.success('邀请链接创建成功')
    await loadInviteLinks()
  }
}

async function revokeLink(inviteCode: string) {
  const success = await spacesStore.revokeInviteLink(props.spaceId, inviteCode)
  if (success) {
    window.$message?.success('邀请链接已撤销')
    await loadInviteLinks()
  }
}

function copyLink(link: string) {
  navigator.clipboard.writeText(link)
  window.$message?.success('链接已复制到剪贴板')
}

function formatExpiry(expiresAt: number): string {
  const now = Date.now()
  const diff = expiresAt - now

  if (diff <= 0) return '已过期'

  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days} 天后过期`
  if (hours > 0) return `${hours} 小时后过期`
  return '即将过期'
}

onMounted(() => {
  loadInviteLinks()
})
</script>

<template>
  <div class="invite-links-manager">
    <div class="create-link-section mb-4">
      <NCard title="创建新邀请链接">
        <NSpace vertical>
          <div>
            <label class="block text-sm text-gray-500 mb-2">有效期（秒）</label>
            <NInput v-model:value="newLinkExpiry" type="text" placeholder="86400" />
            <div class="text-xs text-gray-400 mt-1">默认 86400 秒（24小时）</div>
          </div>
          <NButton type="primary" block @click="createNewLink">创建邀请链接</NButton>
        </NSpace>
      </NCard>
    </div>

    <div class="existing-links-section">
      <NSpin :show="loading">
        <div v-if="inviteLinks.length > 0" class="links-list">
          <NCard v-for="link in inviteLinks" :key="link.invite_code" class="link-card mb-3">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-2">
                  <NTag :type="link.active ? 'success' : 'default'">
                    {{ link.active ? '活跃' : '已禁用' }}
                  </NTag>
                  <span class="text-xs text-gray-400">
                    {{ formatExpiry(link.expires_at) }}
                  </span>
                </div>
                <div class="code-display mb-2">
                  <code class="text-sm bg-gray-100 px-2 py-1 rounded">
                    {{ link.invite_code }}
                  </code>
                </div>
                <div v-if="link.url" class="url-display">
                  <code class="text-xs text-gray-500 break-all">
                    {{ link.url }}
                  </code>
                </div>
              </div>
              <div class="flex gap-2 ml-4">
                <NButton size="small" @click="copyLink(link.url || link.invite_code)">
                  复制
                </NButton>
                <NPopconfirm @positive-click="revokeLink(link.invite_code)">
                  <template #trigger>
                    <NButton size="small" type="error">撤销</NButton>
                  </template>
                  确定要撤销此邀请链接吗？
                </NPopconfirm>
              </div>
            </div>
          </NCard>
        </div>
        <NEmpty v-else description="暂无邀请链接" />
      </NSpin>
    </div>
  </div>
</template>

<style scoped>
.invite-links-manager {
  height: 100%;
  overflow-y: auto;
  padding: 16px;
}

.create-link-section {
  background: var(--bg-color);
}

.link-card {
  transition: box-shadow 0.2s;
}

.link-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.code-display {
  font-family: 'Courier New', monospace;
}

.url-display {
  font-family: 'Courier New', monospace;
}
</style>
