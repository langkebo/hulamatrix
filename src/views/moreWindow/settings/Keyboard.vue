<template>
  <n-flex vertical :size="40">
    <!-- 一致性检查面板 -->
    <n-card size="small" title="快捷键同步状态" class="mx-10px bg-[--bg-setting-item]">
      <template #header-extra>
        <n-button size="small" type="primary" secondary @click="checkAllConsistency" :loading="checking">
          重新同步
        </n-button>
      </template>
      <n-collapse>
        <n-collapse-item title="查看后端一致性详情" name="1">
          <n-table size="small" :single-line="false">
            <thead>
              <tr>
                <th>设置项</th>
                <th>本地值</th>
                <th>后端值</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in consistencyReport" :key="item.key">
                <td>{{ item.label }}</td>
                <td>{{ item.local }}</td>
                <td>{{ item.remote }}</td>
                <td>
                  <n-tag :type="item.consistent ? 'success' : 'warning'" size="small">
                    {{ item.consistent ? '已同步' : '不一致' }}
                  </n-tag>
                </td>
              </tr>
            </tbody>
          </n-table>
        </n-collapse-item>
      </n-collapse>
    </n-card>

    <!-- 全局快捷键 -->
    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">全局快捷键</span>

      <n-flex class="item" :size="12" vertical>
        <n-flex align="center" justify="space-between">
          <n-flex vertical :size="4">
            <span>启用全局快捷键</span>
            <span class="text-(12px #909090)">关闭后全局快捷键将不可用</span>
          </n-flex>
          <n-switch size="small" v-model:value="globalEnabled" />
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-flex align="center" justify="space-between">
          <span>截图</span>
          <n-button size="small" @click="handleShortcutEdit('screenshot')">
            {{ getShortcutText('screenshot') }}
          </n-button>
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-flex align="center" justify="space-between">
          <span>主面板切换</span>
          <n-button size="small" @click="handleShortcutEdit('togglePanel')">
            {{ getShortcutText('togglePanel') }}
          </n-button>
        </n-flex>
      </n-flex>
    </n-flex>

    <!-- 消息操作 -->
    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">消息操作</span>

      <n-flex class="item" :size="12" vertical>
        <n-flex align="center" justify="space-between">
          <span>发送消息</span>
          <n-select
            class="w-140px"
            size="small"
            v-model:value="sendKey"
            :options="sendKeyOptions"
            @update:value="handleSendKeyChange" />
        </n-flex>
      </n-flex>
    </n-flex>

    <!-- 导航快捷键 -->
    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">导航快捷键</span>

      <n-flex class="item" :size="12" vertical>
        <n-flex align="center" justify="space-between">
          <span>下一个房间</span>
          <span class="text-(12px #909090)">Ctrl + Tab</span>
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-flex align="center" justify="space-between">
          <span>上一个房间</span>
          <span class="text-(12px #909090)">Ctrl + Shift + Tab</span>
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-flex align="center" justify="space-between">
          <span>搜索</span>
          <span class="text-(12px #909090)">Ctrl + F</span>
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-flex align="center" justify="space-between">
          <span>撰写消息</span>
          <span class="text-(12px #909090)">Ctrl + N</span>
        </n-flex>
      </n-flex>
    </n-flex>

    <!-- 房间操作 -->
    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">房间操作</span>

      <n-flex class="item" :size="12" vertical>
        <n-flex align="center" justify="space-between">
          <span>房间设置</span>
          <span class="text-(12px #909090)">Ctrl + ,</span>
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-flex align="center" justify="space-between">
          <span>归档房间</span>
          <span class="text-(12px #909090)">Ctrl + Shift + A</span>
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-flex align="center" justify="space-between">
          <span>最小化房间</span>
          <span class="text-(12px #909090)">Esc</span>
        </n-flex>
      </n-flex>
    </n-flex>

    <!-- 消息操作快捷键 -->
    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">消息操作</span>

      <n-flex class="item" :size="12" vertical>
        <n-flex align="center" justify="space-between">
          <span>回复消息</span>
          <span class="text-(12px #909090)">Ctrl + R</span>
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-flex align="center" justify="space-between">
          <span>编辑消息</span>
          <span class="text-(12px #909090)">Ctrl + E</span>
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-flex align="center" justify="space-between">
          <span>转发消息</span>
          <span class="text-(12px #909090)">Ctrl + Shift + F</span>
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-flex align="center" justify="space-between">
          <span>表情反应</span>
          <span class="text-(12px #909090)">Ctrl + Shift + R</span>
        </n-flex>
      </n-flex>
    </n-flex>

    <!-- 应用操作 -->
    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">应用操作</span>

      <n-flex class="item" :size="12" vertical>
        <n-flex align="center" justify="space-between">
          <span>打开设置</span>
          <span class="text-(12px #909090)">Ctrl + ,</span>
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-flex align="center" justify="space-between">
          <span>新建聊天</span>
          <span class="text-(12px #909090)">Ctrl + N</span>
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-flex align="center" justify="space-between">
          <span>退出应用</span>
          <span class="text-(12px #909090)">Ctrl + Q</span>
        </n-flex>
      </n-flex>
    </n-flex>
  </n-flex>

  <!-- 快捷键编辑对话框 -->
  <n-modal v-model:show="showShortcutDialog" preset="card" title="编辑快捷键" :style="{ width: '400px' }">
    <n-flex vertical :size="16">
      <n-text>按下要设置的快捷键组合</n-text>

      <div
        class="shortcut-recorder"
        :class="{ 'is-recording': isRecording }"
        @keydown="handleShortcutKeyDown"
        tabindex="0">
        <span v-if="!currentShortcut">点击此处录制快捷键</span>
        <span v-else>{{ currentShortcut }}</span>
      </div>

      <n-space justify="end">
        <n-button @click="cancelShortcutEdit">取消</n-button>
        <n-button type="primary" @click="saveShortcut">保存</n-button>
      </n-space>
    </n-flex>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { logger } from '@/utils/logger'
import {
  NFlex,
  NSwitch,
  NButton,
  NSelect,
  NModal,
  NText,
  NSpace,
  useMessage,
  NCard,
  NCollapse,
  NCollapseItem,
  NTable,
  NTag
} from 'naive-ui'
import { matrixClientService } from '@/integrations/matrix/client'
import { useSettingStore } from '@/stores/setting'

const message = useMessage()
const settingStore = useSettingStore()

// 一致性检查
const checking = ref(false)
const consistencyReport = ref<
  Array<{ key: string; label: string; local: string; remote: string; consistent: boolean }>
>([])

const checkAllConsistency = async () => {
  // 检查 Matrix 是否启用
  if (import.meta.env.VITE_MATRIX_ENABLED !== 'on') {
    logger.warn('[Keyboard] Matrix 功能未启用，跳过一致性检查')
    consistencyReport.value = []
    return
  }

  // 检查客户端是否已初始化
  if (!matrixClientService.isClientInitialized()) {
    logger.warn('[Keyboard] Matrix 客户端未初始化，跳过一致性检查')
    consistencyReport.value = []
    return
  }

  checking.value = true
  try {
    const report = []

    // Global Enabled
    const remoteGlobal = await matrixClientService.getAccountSetting('shortcuts.globalEnabled')
    report.push({
      key: 'globalEnabled',
      label: '全局快捷键',
      local: settingStore.shortcuts.globalEnabled ? '启用' : '禁用',
      remote: remoteGlobal === undefined ? '未设置' : remoteGlobal ? '启用' : '禁用',
      consistent: remoteGlobal === undefined ? false : Boolean(remoteGlobal) === settingStore.shortcuts.globalEnabled
    })

    // Screenshot
    const remoteScreenshot = await matrixClientService.getAccountSetting('shortcuts.screenshot')
    report.push({
      key: 'screenshot',
      label: '截图快捷键',
      local: settingStore.shortcuts.screenshot,
      remote: String(remoteScreenshot || '未设置'),
      consistent: String(remoteScreenshot || '') === String(settingStore.shortcuts.screenshot)
    })

    // Open Main Panel
    const remoteOpen = await matrixClientService.getAccountSetting('shortcuts.openMainPanel')
    report.push({
      key: 'openMainPanel',
      label: '主面板切换',
      local: settingStore.shortcuts.openMainPanel,
      remote: String(remoteOpen || '未设置'),
      consistent: String(remoteOpen || '') === String(settingStore.shortcuts.openMainPanel)
    })

    // Send Key
    // 注意：sendKey 实际上存储在 chat.sendKey，但这里在快捷键页面展示
    // 假设后端没有单独存储 sendKey 或者存储在 chat.sendKey，这里我们只检查 shortcuts 下的
    // 为了完整性，我们加上 chat.sendKey 的检查 (注意 setting.ts 中没有 setSendMessageShortcut 的后端同步，我需要去确认)
    // 检查 setting.ts: setSendMessageShortcut 确实没有后端同步。
    // 暂时只检查 shortcuts 下的内容。

    consistencyReport.value = report
  } catch (error) {
    logger.error('[Keyboard] 一致性检查失败:', error)
    consistencyReport.value = []
  } finally {
    checking.value = false
  }
}

onMounted(() => {
  checkAllConsistency()
})

// 全局快捷键
const globalEnabled = computed({
  get: () => settingStore.shortcuts.globalEnabled,
  set: (val: boolean) => {
    settingStore.setGlobalShortcutEnabled(val)
    setTimeout(checkAllConsistency, 1000)
  }
})

// 快捷键映射
// 直接使用 store 中的 shortcuts
const shortcuts = computed<Record<string, string>>(() => ({
  screenshot: settingStore.shortcuts.screenshot,
  togglePanel: settingStore.shortcuts.openMainPanel
}))

// 发送消息快捷键
const sendKey = computed({
  get: () => settingStore.chat.sendKey,
  set: (val: string) => {
    settingStore.setSendMessageShortcut(val)
  }
})
const sendKeyOptions = [
  { label: '按 Enter 键发送', value: 'enter' },
  { label: '按 Ctrl + Enter 发送', value: 'ctrl+enter' },
  { label: '按 Cmd + Enter 发送', value: 'cmd+enter' }
]

// 快捷键编辑
const showShortcutDialog = ref(false)
const isRecording = ref(false)
const currentShortcut = ref('')
const editingShortcut = ref('')

const handleSendKeyChange = (value: string) => {
  sendKey.value = value
  message.success(`发送消息快捷键已更新`)
}

const getShortcutText = (key: string) => {
  return shortcuts.value[key] || '未设置'
}

const handleShortcutEdit = (key: string) => {
  editingShortcut.value = key
  currentShortcut.value = shortcuts.value[key] || ''
  showShortcutDialog.value = true
  isRecording.value = true
}

const handleShortcutKeyDown = (e: KeyboardEvent) => {
  e.preventDefault()
  const keys: string[] = []

  if (e.metaKey) keys.push('Cmd')
  if (e.ctrlKey) keys.push('Ctrl')
  if (e.altKey) keys.push('Alt')
  if (e.shiftKey) keys.push('Shift')

  if (e.key && !['Meta', 'Control', 'Alt', 'Shift'].includes(e.key)) {
    keys.push(e.key.toUpperCase())
  }

  currentShortcut.value = keys.join('+')
}

const cancelShortcutEdit = () => {
  showShortcutDialog.value = false
  currentShortcut.value = ''
  editingShortcut.value = ''
  isRecording.value = false
}

const saveShortcut = () => {
  if (currentShortcut.value) {
    if (editingShortcut.value === 'screenshot') {
      settingStore.setScreenshotShortcut(currentShortcut.value)
    } else if (editingShortcut.value === 'togglePanel') {
      settingStore.setOpenMainPanelShortcut(currentShortcut.value)
    }
    message.success('快捷键已保存')
    setTimeout(checkAllConsistency, 1000)
  }
  showShortcutDialog.value = false
  currentShortcut.value = ''
  editingShortcut.value = ''
  isRecording.value = false
}
</script>

<style scoped lang="scss">
.item {
  @apply bg-[--bg-setting-item] rounded-12px size-full box-border border-(solid 1px [--line-color]) custom-shadow;
  padding: var(--pad-container-x);
  font-size: clamp(12px, 2vw, 14px);
}

.shortcut-recorder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 80px;
  padding: 16px;
  border: 2px dashed var(--line-color);
  border-radius: 8px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--border-active-color);
  }

  &.is-recording {
    border-color: #13987f;
    background: rgba(19, 152, 127, 0.05);
  }

  &:focus {
    outline: none;
    border-color: #13987f;
  }
}
</style>
