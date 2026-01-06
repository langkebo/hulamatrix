<template>
  <!-- 登录设置 -->
  <n-flex vertical :size="20" data-tauri-drag-region>
    <!-- 自动登录设置 -->
    <n-flex :size="12" vertical class="item-box">
      <n-flex align="center" justify="space-between">
        <span>{{ t('setting.login.auto_login_startup') }}</span>
        <n-switch size="small" v-model:value="autoLogin" />
      </n-flex>

      <div class="bg-[--line-color] h-1px w-full"></div>

      <n-flex align="center" justify="space-between">
        <span>{{ t('setting.login.launch_startup') }}</span>
        <n-switch size="small" v-model:value="autoStartup" />
      </n-flex>
    </n-flex>

    <!-- 服务器配置 (Phase 10 新增) -->
    <n-flex :size="12" vertical class="item-box">
      <n-flex align="center" justify="space-between">
        <span>服务器配置</span>
        <n-button text type="primary" @click="showServerConfig = !showServerConfig">
          {{ showServerConfig ? '收起' : '展开' }}
        </n-button>
      </n-flex>

      <!-- 服务器列表 -->
      <template v-if="showServerConfig">
        <div class="bg-[--line-color] h-1px w-full"></div>

        <!-- 当前服务器 -->
        <div v-if="currentServer" class="server-item">
          <div class="server-info">
            <span class="server-name">{{ currentServer.displayName || currentServer.name }}</span>
            <span class="server-url">{{ formatServerUrl(currentServer.homeserverUrl) }}</span>
          </div>
          <HealthStatusBadge :health-status="currentHealthStatus" :compact="true" @refresh="refreshCurrentServer" />
        </div>

        <!-- 已保存的服务器列表 -->
        <div v-if="savedServers.length > 0" class="servers-list">
          <div class="section-title">已保存的服务器</div>
          <div
            v-for="server in savedServers"
            :key="server.id"
            class="server-item"
            :class="{ active: server.id === currentServer?.id }">
            <div class="server-info">
              <span class="server-name">{{ server.displayName || server.name }}</span>
              <span class="server-url">{{ formatServerUrl(server.homeserverUrl) }}</span>
            </div>
            <n-button-group size="small">
              <n-button
                :type="server.id === currentServer?.id ? 'primary' : 'default'"
                @click="switchServer(server.id)">
                {{ server.id === currentServer?.id ? '当前' : '切换' }}
              </n-button>
              <n-button @click="deleteServer(server.id)">删除</n-button>
            </n-button-group>
          </div>
        </div>

        <!-- 添加服务器按钮 -->
        <n-button secondary type="primary" block @click="showAddServerDialog = true">
          <template #icon>
            <n-icon><Plus /></n-icon>
          </template>
          添加服务器
        </n-button>
      </template>
    </n-flex>

    <!-- 添加服务器对话框 -->
    <n-modal v-model:show="showAddServerDialog" preset="card" title="添加服务器" :bordered="false">
      <n-form ref="formRef" :model="addServerForm" :rules="rules" label-placement="left" label-width="auto">
        <n-form-item label="服务器名称" path="name">
          <n-input v-model:value="addServerForm.name" placeholder="例如: 公司服务器" @keyup.enter="handleAddServer" />
        </n-form-item>
        <n-form-item label="服务器地址" path="homeserverUrl">
          <n-input
            v-model:value="addServerForm.homeserverUrl"
            placeholder="matrix.example.com 或 https://matrix.example.com"
            @keyup.enter="handleAddServer" />
        </n-form-item>
        <n-form-item label="显示名称">
          <n-input v-model:value="addServerForm.displayName" placeholder="可选的友好名称" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space>
          <n-button @click="showAddServerDialog = false">取消</n-button>
          <n-button type="primary" :loading="isLoading" @click="handleAddServer">添加</n-button>
        </n-space>
      </template>
    </n-modal>
  </n-flex>
</template>

<script setup lang="ts">
import { ref, watch, watchEffect, onMounted, computed, onUnmounted } from 'vue'
import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart'
import { NButton, NIcon, NModal, NForm, NFormItem, NInput, NSpace, NButtonGroup, useMessage } from 'naive-ui'
import { Plus } from '@vicons/tabler'
import { useSettingStore } from '@/stores/setting'
import { useServerConfigStore } from '@/stores/serverConfig'
import { useI18n } from 'vue-i18n'
import HealthStatusBadge from '@/components/server/HealthStatusBadge.vue'
import type { ServerConfig } from '@/types/server'
import { logger } from '@/utils/logger'

const { t } = useI18n()
const message = useMessage()

const settingStore = useSettingStore()
const serverConfigStore = useServerConfigStore()

// 登录设置
const login = computed(() => settingStore.login)
const autoLogin = ref(login.value.autoLogin)
const autoStartup = ref(login.value.autoStartup)

// 服务器配置
const showServerConfig = ref(false)
const showAddServerDialog = ref(false)
const isLoading = ref(false)
let refreshTimer: number | null = null

const addServerForm = ref({
  name: '',
  homeserverUrl: '',
  displayName: ''
})

const rules = {
  name: { required: true, message: '请输入服务器名称', trigger: 'blur' },
  homeserverUrl: { required: true, message: '请输入服务器地址', trigger: 'blur' }
}

const currentServer = computed(() => serverConfigStore.currentServer)
const savedServers = computed(() => serverConfigStore.savedServers)
const currentHealthStatus = computed(() => serverConfigStore.currentHealthStatus || null)

watchEffect(() => {
  settingStore.toggleLogin(autoLogin.value, autoStartup.value)
})

// 监听开机启动状态变化
watch(autoStartup, async (val: boolean) => {
  await (val ? enable() : disable())
})

// 切换服务器
const switchServer = async (serverId: string) => {
  try {
    await serverConfigStore.selectServer(serverId)
    message.success('服务器切换成功')
  } catch (error) {
    logger.error('[LoginSetting] Failed to switch server:', error)
    message.error('服务器切换失败')
  }
}

// 删除服务器
const deleteServer = (serverId: string) => {
  try {
    serverConfigStore.deleteServer(serverId)
    message.success('服务器已删除')
  } catch (error) {
    logger.error('[LoginSetting] Failed to delete server:', error)
    message.error(error instanceof Error ? error.message : '删除失败')
  }
}

// 刷新当前服务器状态
const refreshCurrentServer = () => {
  if (currentServer.value) {
    serverConfigStore.checkHealth(currentServer.value.id)
  }
}

// 添加服务器
const handleAddServer = async () => {
  try {
    isLoading.value = true
    await serverConfigStore.addServer(addServerForm.value)
    message.success('服务器添加成功')
    showAddServerDialog.value = false
    addServerForm.value = { name: '', homeserverUrl: '', displayName: '' }
  } catch (error) {
    logger.error('[LoginSetting] Failed to add server:', error)
    message.error(error instanceof Error ? error.message : '添加服务器失败')
  } finally {
    isLoading.value = false
  }
}

// 格式化服务器 URL
const formatServerUrl = (url: string) => {
  try {
    const urlObj = new URL(url)
    return urlObj.host
  } catch {
    return url
  }
}

// 定时刷新健康状态
const startHealthCheck = () => {
  refreshTimer = window.setInterval(() => {
    if (currentServer.value) {
      serverConfigStore.checkHealth(currentServer.value.id)
    }
  }, 60000) // 每分钟检查一次
}

const stopHealthCheck = () => {
  if (refreshTimer !== null) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

onMounted(async () => {
  // 检查是否开启了开机启动
  autoStartup.value = await isEnabled()

  // 初始化服务器配置
  await serverConfigStore.initialize()
  startHealthCheck()
})

onUnmounted(() => {
  stopHealthCheck()
})
</script>

<style scoped lang="scss">
.item-box {
  @apply text-[--text-color] bg-[--bg-setting-item] rounded-8px border-(solid 1px [--line-color]) custom-shadow;
  font-size: clamp(12px, 2vw, 14px);
  padding: var(--pad-container-x);
}

.server-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 6px;
  background: var(--n-color);
  border: 1px solid var(--n-border-color);
  margin-bottom: 8px;
  gap: 12px;

  &:hover {
    background: var(--n-hover-color);
  }

  &.active {
    border-color: var(--n-primary-color);
    background: rgba(var(--n-primary-color), 0.05);
  }
}

.server-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.server-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--n-text-color-1);
}

.server-url {
  font-size: 11px;
  color: var(--n-text-color-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.servers-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  font-size: 12px;
  color: var(--n-text-color-3);
  padding: 4px 0;
}
</style>
