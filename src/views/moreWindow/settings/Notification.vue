<template>
  <n-flex vertical :size="40">
    <!-- 消息通知设置 -->
    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">{{ t('setting.notice.sound') }}</span>

      <n-flex class="item p-12px" :size="12" vertical>
        <!-- 消息提示音 -->
        <n-flex align="center" justify="space-between">
          <n-flex vertical :size="8">
            <span>{{ t('setting.notice.message_sound') }}</span>
            <span class="text-(12px #909090)">{{ t('setting.notice.message_sound_descript') }}</span>
          </n-flex>

          <n-switch size="small" v-model:value="messageSound" />
        </n-flex>
      </n-flex>
    </n-flex>

    <!-- 群消息设置 -->
    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <n-flex align="center" justify="space-between" class="pl-10px pr-10px">
        <span>{{ t('setting.notice.group_setting') }}</span>
        <n-input
          v-model:value="searchKeyword"
          size="small"
          :placeholder="t('setting.notice.input.search_group_placholder')"
          clearable
          style="width: 200px">
          <template #prefix>
            <svg class="size-14px"><use href="#search"></use></svg>
          </template>
        </n-input>
      </n-flex>

      <n-flex class="item" :size="0" vertical>
        <div v-if="filteredGroupSessions.length === 0" class="text-(12px #909090) text-center py-20px">
          {{ searchKeyword ? '未找到匹配的群聊' : '暂无群聊' }}
        </div>

        <!-- 批量操作栏 -->
        <n-flex v-if="filteredGroupSessions.length > 0" align="center" justify="space-between" class="p-12px h-28px">
          <n-flex align="center" :size="12">
            <n-checkbox
              v-model:checked="selectAll"
              :indeterminate="selectedSessions.length > 0 && selectedSessions.length < filteredGroupSessions.length"
              @update:checked="handleSelectAll">
              {{ t('setting.notice.select_all') }} ({{ selectedSessions.length }}/{{ filteredGroupSessions.length }})
            </n-checkbox>
          </n-flex>

          <n-flex v-if="selectedSessions.length > 0" align="center" :size="8">
            <span class="text-(12px #909090)">{{ t('setting.notice.batch_set') }}:</span>
            <n-button
              size="small"
              type="primary"
              secondary
              :disabled="isProcessing"
              data-test="batch-allow"
              @click="batchSetNotification('allow')">
              {{ t('setting.notice.group_notic_type.allow') }}
            </n-button>
            <n-button
              size="small"
              secondary
              :disabled="isProcessing"
              data-test="batch-mute"
              @click="batchSetNotification('mute')">
              {{ t('setting.notice.group_notic_type.silent') }}
            </n-button>
            <n-button
              size="small"
              type="error"
              secondary
              :disabled="isProcessing"
              data-test="batch-shield"
              @click="batchSetNotification('shield')">
              {{ t('setting.notice.group_notic_type.block') }}
            </n-button>
          </n-flex>
        </n-flex>

        <!-- 进度条显示 -->
        <n-flex v-if="isProcessing" vertical :size="12" class="p-12px">
          <n-flex align="center" justify="space-between">
            <span class="text-(12px #909090)">正在处理：{{ processedCount }}/{{ totalCount }}</span>
            <span class="text-(12px #909090)">{{ progress }}%</span>
          </n-flex>
          <n-progress
            id="batch-progress"
            type="line"
            :color="'#13987f'"
            :rail-color="'rgba(19, 152, 127, 0.19)'"
            :percentage="progress"
            :show-indicator="false" />
        </n-flex>

        <span v-if="filteredGroupSessions.length > 0" class="w-full h-1px bg-[--line-color] block"></span>

        <n-scrollbar
          style="max-height: 420px; padding: 0 12px; box-sizing: border-box"
          :style="{ pointerEvents: isDropdownShow ? 'none' : 'auto' }">
          <n-virtual-list v-if="filteredGroupSessions.length > 60" :items="filteredGroupSessions" :item-size="58">
            <template #default="{ item: session, index }">
              <n-flex align="center" justify="space-between" class="py-14px" data-test="group-item">
                <n-flex align="center" :size="12">
                  <n-checkbox
                    :checked="selectedSessions.includes(session.roomId)"
                    @update:checked="(checked: boolean) => handleSessionSelect(session.roomId, checked)" />
                  <img
                    :src="AvatarUtils.getAvatarUrl(session.avatar) || '/imgs/avatar.png'"
                    :alt="session.name"
                    class="w-32px h-32px rounded-6px object-cover" />
                  <n-flex vertical :size="2">
                    <span class="text-14px">{{ session.name }}</span>
                  </n-flex>
                </n-flex>

                <n-dropdown
                  :options="getNotificationOptions(session)"
                  @select="(key: NotificationChangeKey) => handleNotificationChange(session, key)"
                  trigger="click"
                  :scrollable="false"
                  @update:show="(show: boolean) => (isDropdownShow = show)">
                  <n-button size="small" :color="'#13987f'" text class="text-(12px [--text-color])">
                    {{ getNotificationStatusText(session) }}
                  </n-button>
                </n-dropdown>
              </n-flex>

              <span
                v-if="Number(index) < filteredGroupSessions.length - 1"
                class="w-full h-1px bg-[--line-color] block"></span>
            </template>
          </n-virtual-list>
          <template v-else v-for="(session, index) in filteredGroupSessions" :key="session.roomId">
            <n-flex align="center" justify="space-between" class="py-14px" data-test="group-item">
              <n-flex align="center" :size="12">
                <n-checkbox
                  :checked="selectedSessions.includes(session.roomId)"
                  @update:checked="(checked: boolean) => handleSessionSelect(session.roomId, checked)" />
                <img
                  :src="AvatarUtils.getAvatarUrl(session.avatar) || '/imgs/avatar.png'"
                  :alt="session.name"
                  class="w-32px h-32px rounded-6px object-cover" />
                <n-flex vertical :size="2">
                  <span class="text-14px">{{ session.name }}</span>
                </n-flex>
              </n-flex>

              <n-dropdown
                :options="getNotificationOptions(session)"
                @select="(key: NotificationChangeKey) => handleNotificationChange(session, key)"
                trigger="click"
                :scrollable="false"
                @update:show="(show: boolean) => (isDropdownShow = show)">
                <n-button size="small" :color="'#13987f'" text class="text-(12px [--text-color])">
                  {{ getNotificationStatusText(session) }}
                </n-button>
              </n-dropdown>
            </n-flex>

            <span
              v-if="Number(index) < filteredGroupSessions.length - 1"
              class="w-full h-1px bg-[--line-color] block"></span>
          </template>
        </n-scrollbar>
      </n-flex>
    </n-flex>

    <!-- 提及&关键字 -->
    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">{{ t('setting.notice.keywords') }}</span>
      <n-flex class="item p-12px" :size="12" vertical>
        <n-flex align="center" :size="12">
          <n-input v-model:value="newKeyword" placeholder="关键字" size="small" style="max-width: 280px" />
          <n-button size="small" type="primary" secondary @click="addKeyword">添加</n-button>
          <n-button size="small" @click="bulkImport">批量导入</n-button>
          <n-button size="small" @click="triggerFileImport">从文件导入</n-button>
          <n-button size="small" @click="exportKeywords">导出关键字</n-button>
          <n-button size="small" type="error" ghost @click="clearAll">清空</n-button>
          <n-flex :size="8" align="center">
            <span>仅高亮</span>
            <n-switch v-model:value="highlightOnly" size="small" />
            <span>响铃</span>
            <n-switch v-model:value="soundOn" size="small" />
          </n-flex>
          <n-select
            v-model:value="selectedPreset"
            :options="presetGroups.map((p) => ({ label: p.label, value: p.value }))"
            size="small"
            style="width: 160px"
            placeholder="选择预设" />
          <n-button size="small" @click="applyPreset">应用预设</n-button>
          <n-button size="small" @click="exportPresetJson">导出预设JSON</n-button>
          <n-button size="small" @click="triggerPresetImport">导入预设JSON</n-button>
          <n-button size="small" type="primary" tertiary data-test="preset-editor-open" @click="openPresetEditor">
            预设编辑
          </n-button>
        </n-flex>
        <n-flex :size="8" :wrap="false">
          <n-tag v-for="k in pagedKeywords" :key="k" closable @close="removeKeyword(k)" type="success" size="small">
            {{ k }}
          </n-tag>
          <n-pagination v-model:page="page" :page-count="pageCount" size="small" style="margin-left: auto" />
          <n-input-number v-model:value="page" :min="1" :max="pageCount" size="small" style="width: 90px" />
          <n-select v-model:value="pageSize" :options="pageSizeOptions" size="small" style="width: 90px" />
          <input ref="fileInput" type="file" accept=".txt,.csv" style="display: none" @change="onFileSelected" />
          <input
            ref="presetFileInput"
            type="file"
            accept="application/json"
            style="display: none"
            @change="onPresetSelected" />
        </n-flex>
      </n-flex>
    </n-flex>

    <!-- 静默时段 -->
    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">静默时段</span>
      <n-flex class="item p-12px" :size="12" vertical>
        <n-flex align="center" :size="12" justify="space-between">
          <n-flex align="center" :size="10">
            <span>启用静默</span>
            <n-switch v-model:value="quietEnabled" size="small" />
          </n-flex>
          <n-flex align="center" :size="10">
            <span>开始</span>
            <n-time-picker v-model:value="quietStartMs" size="small" style="width: 120px" format="HH:mm" />
            <span>结束</span>
            <n-time-picker v-model:value="quietEndMs" size="small" style="width: 120px" format="HH:mm" />
            <n-button size="small" @click="setPresetNight">夜间</n-button>
            <n-button size="small" @click="setPresetWork">工作时段</n-button>
          </n-flex>
        </n-flex>
      </n-flex>
    </n-flex>
    <n-modal v-model:show="showPresetEditor" preset="card" title="关键字预设编辑" :style="{ width: '720px' }">
      <n-flex vertical :size="12">
        <n-flex align="center" justify="space-between">
          <span>分组列表</span>
          <n-button size="small" @click="addPresetGroup">新增分组</n-button>
        </n-flex>
        <div
          v-for="(g, idx) in presetEditing"
          :key="g.value"
          class="p-8px border-(solid 1px #e5e7eb) rounded-8px"
          draggable="true"
          @dragstart="onPresetDragStart(idx, $event)"
          @dragover="onPresetDragOver(idx, $event)"
          @drop="onPresetDrop(idx, $event)">
          <n-flex :size="8" align="center">
            <n-checkbox v-model:checked="selectedPresetIndicesMap[idx]" />
            <span>名称</span>
            <n-input v-model:value="g.label" size="small" style="width: 180px" />
            <span>标识</span>
            <n-input v-model:value="g.value" size="small" style="width: 180px" />
            <n-button size="small" @click="movePresetUp(idx)">上移</n-button>
            <n-button size="small" @click="movePresetDown(idx)">下移</n-button>
            <n-button size="small" type="error" ghost @click="removePresetGroup(idx)">删除</n-button>
          </n-flex>
          <n-flex vertical :size="6">
            <span>关键字（逗号或空格分隔）</span>
            <n-input v-model:value="g.items" type="textarea" :rows="2" />
          </n-flex>
        </div>
        <n-flex align="center" :size="10" justify="end">
          <n-button size="small" @click="applySelectedPresets">应用选中分组</n-button>
          <n-button size="small" @click="applyAllPresets">应用所有分组</n-button>
          <n-button size="small" @click="showPresetEditor = false">取消</n-button>
          <n-button size="small" type="primary" @click="savePresetEditor">保存</n-button>
        </n-flex>
      </n-flex>
    </n-modal>
  </n-flex>
</template>

<script setup lang="ts">
import { computed, h, ref, watch, onMounted } from 'vue'
import { NotificationTypeEnum, RoomTypeEnum } from '@/enums'
import type { SessionItem } from '@/services/types'
import { useChatStore } from '@/stores/chat'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { muteRoom, unmuteRoom, getNotificationPolicy } from '@/integrations/matrix/pusher'

import { msg } from '@/utils/SafeUI'
import { assign } from 'es-toolkit/compat'
import { useI18n } from 'vue-i18n'
import { logger } from '@/utils/logger'
import { NTimePicker, NSelect, NInputNumber, NVirtualList } from 'naive-ui'
import { useRoute } from 'vue-router'
import { useNotificationSettings } from '@/composables'

type NotificationChangeKey = 'allow' | 'mute' | 'shield'

const { t } = useI18n()
const chatStore = useChatStore()
const route = useRoute()

// 使用 composable 管理通知设置
const {
  messageSound,
  quietEnabled,
  quietStartMs,
  quietEndMs,
  keywords,
  newKeyword,
  highlightOnly,
  soundOn,
  addKeyword,
  removeKeyword,
  setPresetNight,
  setPresetWork,
  loadSettings
} = useNotificationSettings()

// 搜索关键词
const searchKeyword = ref('')

// 选中的会话列表
const selectedSessions = ref<string[]>([])

// 批量操作进度状态
const isProcessing = ref(false)
const progress = ref(0)
const processedCount = ref(0)
const totalCount = ref(0)
const processingResults = ref<{ roomId: string; name: string; success: boolean; error?: string }[]>([])

// 下拉菜单显示状态
const isDropdownShow = ref(false)

// 获取所有群聊会话（包含官方频道）
const groupSessions = computed(() => {
  return chatStore.sessionList.filter((session: SessionItem) => session.type === RoomTypeEnum.GROUP)
})

// 过滤后的群聊列表（搜索功能）
const filteredGroupSessions = computed(() => {
  if (!searchKeyword.value) {
    return groupSessions.value
  }
  return groupSessions.value.filter((session: SessionItem) =>
    session.name.toLowerCase().includes(searchKeyword.value.toLowerCase())
  )
})

// 全选状态
const selectAll = computed({
  get: () =>
    selectedSessions.value.length === filteredGroupSessions.value.length && filteredGroupSessions.value.length > 0,
  set: (value: boolean) => {
    if (value) {
      selectedSessions.value = filteredGroupSessions.value.map((session: SessionItem) => session.roomId)
    } else {
      selectedSessions.value = []
    }
  }
})

const applySessionUpdate = (session: SessionItem, data: Partial<SessionItem>) => {
  chatStore.updateSession(session.roomId, data)
  assign(session, data)
}

// 获取通知状态文本
const getNotificationStatusText = (session: SessionItem) => {
  if (session.shield) {
    return t('setting.notice.group_notic_type.block')
  }

  switch (session.muteNotification) {
    case NotificationTypeEnum.RECEPTION:
      return t('setting.notice.group_notic_type.allow')
    case NotificationTypeEnum.NOT_DISTURB:
      return t('setting.notice.group_notic_type.silent')
    default:
      return t('setting.notice.group_notic_type.allow')
  }
}

// 获取下拉菜单选项
const getNotificationOptions = (session: SessionItem) => {
  return [
    {
      label: t('setting.notice.group_notic_type.allow'),
      key: 'allow',
      icon:
        !session.shield && session.muteNotification === NotificationTypeEnum.RECEPTION
          ? () => h('svg', { class: 'size-14px text-brand' }, [h('use', { href: '#check-small' })])
          : undefined
    },
    {
      label: t('setting.notice.group_notic_type.silent'),
      key: 'mute',
      icon:
        !session.shield && session.muteNotification === NotificationTypeEnum.NOT_DISTURB
          ? () => h('svg', { class: 'size-14px text-brand' }, [h('use', { href: '#check-small' })])
          : undefined
    },
    {
      label: t('setting.notice.group_notic_type.block'),
      key: 'shield',
      icon: session.shield
        ? () => h('svg', { class: 'size-14px text-brand' }, [h('use', { href: '#check-small' })])
        : undefined
    }
  ]
}

// 处理全选
const handleSelectAll = (checked: boolean) => {
  selectAll.value = checked
}

// 处理单个会话选择
const handleSessionSelect = (roomId: string, checked: boolean) => {
  if (checked) {
    if (!selectedSessions.value.includes(roomId)) {
      selectedSessions.value.push(roomId)
    }
  } else {
    const index = selectedSessions.value.indexOf(roomId)
    if (index > -1) {
      selectedSessions.value.splice(index, 1)
    }
  }
}

// 批量设置通知
const batchSetNotification = async (type: NotificationChangeKey) => {
  if (selectedSessions.value.length === 0) {
    msg.warning(t('setting.notice.message_select_group_first'))
    return
  }

  // 初始化进度状态
  isProcessing.value = true
  progress.value = 0
  processedCount.value = 0
  totalCount.value = selectedSessions.value.length
  processingResults.value = []

  try {
    for (let i = 0; i < selectedSessions.value.length; i++) {
      const roomId = selectedSessions.value[i]
      const session = groupSessions.value.find((s: SessionItem) => s.roomId === roomId)

      if (!session) {
        processingResults.value.push({
          roomId: roomId ?? '',
          name: t('setting.notice.unknow_group'),
          success: false,
          error: t('setting.notice.group_chat_not_found')
        })
      } else {
        try {
          await handleNotificationChange(session, type, { silent: true })
          processingResults.value.push({
            roomId: roomId ?? '',
            name: session.name,
            success: true
          })
        } catch (error: unknown) {
          processingResults.value.push({
            roomId: roomId ?? '',
            name: session.name,
            success: false,
            error: error instanceof Error ? error.message : t('setting.notice.setup_fail')
          })
        }
      }

      // 更新进度
      processedCount.value = i + 1
      progress.value = Math.round(((i + 1) / selectedSessions.value.length) * 100)
    }

    // 显示结果统计
    const successCount = processingResults.value.filter((r) => r.success).length
    const failCount = processingResults.value.length - successCount

    const typeText =
      {
        allow: t('setting.notice.group_notic_type.allow'),
        mute: t('setting.notice.group_notic_type.silent'),
        shield: t('setting.notice.group_notic_type.block')
      }[type] || t('setting.notice.unknow')

    if (failCount === 0) {
      msg.success(t('setting.notice.message_group_batch_setup_success', { count: successCount, type: typeText }))
    } else {
      msg.warning(
        t('setting.notice.message_group_batch_update_result', { success_count: successCount, fail_count: failCount })
      )
    }

    // 清空选择
    selectedSessions.value = []
  } catch (error) {
    logger.error('批量设置失败:', error instanceof Error ? error : new Error(String(error)))
    msg.error(t('setting.notice.setup_fail'))
  } finally {
    // 延迟隐藏进度条，让用户看到完成状态
    setTimeout(() => {
      isProcessing.value = false
    }, 1500)
  }
}

// 处理通知设置变更
const handleNotificationChange = async (
  session: SessionItem,
  key: NotificationChangeKey,
  options?: { silent?: boolean }
) => {
  const silent = options?.silent ?? false

  try {
    switch (key) {
      case 'allow':
        // 如果当前是屏蔽状态，需要先取消屏蔽
        if (session.shield) {
          await unmuteRoom(session.roomId)
          applySessionUpdate(session, { shield: false })
        }

        await unmuteRoom(session.roomId)

        applySessionUpdate(session, {
          muteNotification: NotificationTypeEnum.RECEPTION
        })

        if (!silent) {
          msg.success(t('setting.notice.message_reminder_allowed'))
        }
        break

      case 'mute':
        // 如果当前是屏蔽状态，需要先取消屏蔽
        if (session.shield) {
          await unmuteRoom(session.roomId)
          applySessionUpdate(session, { shield: false })
        }

        await muteRoom(session.roomId)

        applySessionUpdate(session, {
          muteNotification: NotificationTypeEnum.NOT_DISTURB
        })

        // 设置免打扰时更新全局未读数
        chatStore.updateTotalUnreadCount()
        if (!silent) {
          msg.success(t('setting.notice.message_reminder_silent'))
        }
        break

      case 'shield':
        await muteRoom(session.roomId)

        applySessionUpdate(session, {
          shield: true
        })

        if (!silent) {
          msg.success(t('setting.notice.group_notic_type.block'))
        }
        break
    }
  } catch (error) {
    logger.error('设置群消息通知失败:', error instanceof Error ? error : new Error(String(error)))
    if (!silent) {
      msg.error('设置失败，请重试')
      return
    }
    throw error
  }
}

// 监听搜索关键词变化，清空选择
watch(searchKeyword, () => {
  selectedSessions.value = []
})

// 关键词分页（桌面端特有功能）
const page = ref(1)
const pageSize = ref(10)
const pageSizeOptions = [
  { label: '10', value: 10 },
  { label: '20', value: 20 },
  { label: '50', value: 50 }
]
const pagedKeywords = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return keywords.value.slice(start, start + pageSize.value)
})
const pageCount = computed(() => Math.max(1, Math.ceil(keywords.value.length / pageSize.value)))

const bulkImport = async () => {
  const text = window.prompt('批量导入关键字（逗号或换行分隔）', '') || ''
  const items = Array.from(
    new Set(
      text
        .split(/[\s,，]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    )
  )
  if (items.length === 0) return

  // 批量添加：逐个调用 addKeyword（使用 composable 的方法）
  for (const item of items) {
    newKeyword.value = item
    await addKeyword()
  }
  page.value = 1
  msg.success('已批量导入关键字')
}

const clearAll = async () => {
  // 清空所有关键字
  for (const keyword of [...keywords.value]) {
    await removeKeyword(keyword)
  }
  page.value = 1
  msg.success('已清空关键字')
}

const presetGroups = ref<Array<{ label: string; value: string; items: string[] }>>([
  { label: '系统', value: 'sys', items: ['error', 'warning', 'alert', 'update'] },
  { label: '工作常用', value: 'work', items: ['会议', '审批', '日报', '汇报'] },
  { label: '社交', value: 'social', items: ['@我', '私聊', '群公告'] }
])
const selectedPreset = ref<string | null>(null)
const applyPreset = async () => {
  const found = presetGroups.value.find((p) => p.value === selectedPreset.value)
  if (!found) return

  // 应用预设：批量添加
  for (const item of found.items) {
    if (!keywords.value.includes(item)) {
      newKeyword.value = item
      await addKeyword()
    }
  }
  msg.success('已应用预设关键字组')
}

const fileInput = ref<HTMLInputElement | null>(null)
const triggerFileImport = () => {
  fileInput.value?.click()
}
const onFileSelected = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const text = await file.text().catch(() => '')
  const items = Array.from(
    new Set(
      text
        .split(/[\n,，]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    )
  )
  if (items.length === 0) {
    msg.warning('文件中未发现关键字')
    return
  }

  // 批量添加
  for (const item of items) {
    newKeyword.value = item
    await addKeyword()
  }
  page.value = 1
  msg.success('已从文件导入关键字')

  if (fileInput.value) fileInput.value.value = ''
}

const exportKeywords = () => {
  const content = keywords.value.join('\n')
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'keywords.txt'
  a.click()
  URL.revokeObjectURL(url)
}

const presetFileInput = ref<HTMLInputElement | null>(null)
const triggerPresetImport = () => {
  presetFileInput.value?.click()
}
const onPresetSelected = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    const js = JSON.parse(text)
    if (Array.isArray(js?.groups)) {
      const merged = [...presetGroups.value]

      interface PresetGroupItem {
        label: string
        value?: string
        items: string[]
      }

      js.groups.forEach((g: PresetGroupItem) => {
        if (g && typeof g.label === 'string' && Array.isArray(g.items)) {
          merged.push({ label: g.label, value: g.value || g.label, items: g.items })
        }
      })
      presetGroups.value = merged
      localStorage.setItem('NOTIFY_PRESET_GROUPS', JSON.stringify({ groups: presetGroups.value }))
      msg.success('预设已导入')
    } else {
      msg.error('预设JSON格式错误')
    }
  } catch {
    msg.error('导入预设失败')
  } finally {
    if (presetFileInput.value) presetFileInput.value.value = ''
  }
}
const exportPresetJson = () => {
  const blob = new Blob([JSON.stringify({ groups: presetGroups.value }, null, 2)], {
    type: 'application/json;charset=utf-8'
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'keyword-presets.json'
  a.click()
  URL.revokeObjectURL(url)
}

const showPresetEditor = ref(false)
const presetEditing = ref<Array<{ label: string; value: string; items: string }>>([])
const draggingPresetIndex = ref<number | null>(null)
const selectedPresetIndicesMap = ref<Record<number, boolean>>({})
const openPresetEditor = () => {
  presetEditing.value = presetGroups.value.map((g) => ({ label: g.label, value: g.value, items: g.items.join(',') }))
  showPresetEditor.value = true
  selectedPresetIndicesMap.value = {}
}
const addPresetGroup = () => {
  presetEditing.value.push({ label: '新建分组', value: `group_${Date.now()}`, items: '' })
}
const removePresetGroup = (idx: number) => {
  presetEditing.value.splice(idx, 1)
}
const savePresetEditor = () => {
  const next = presetEditing.value.map((g) => ({
    label: g.label.trim() || g.value,
    value: g.value.trim() || g.label,
    items: Array.from(
      new Set(
        g.items
          .split(/[\s,，]+/)
          .map((s) => s.trim())
          .filter(Boolean)
      )
    )
  }))
  presetGroups.value = next
  localStorage.setItem('NOTIFY_PRESET_GROUPS', JSON.stringify({ groups: presetGroups.value }))
  showPresetEditor.value = false
  msg.success('预设已保存')
}
const movePresetUp = (idx: number) => {
  if (idx <= 0) return
  const removed = presetEditing.value.splice(idx, 1)
  const item = removed[0]
  if (item) {
    presetEditing.value.splice(idx - 1, 0, item)
  }
}
const movePresetDown = (idx: number) => {
  if (idx >= presetEditing.value.length - 1) return
  const removed = presetEditing.value.splice(idx, 1)
  const item = removed[0]
  if (item) {
    presetEditing.value.splice(idx + 1, 0, item)
  }
}
const applySelectedPresets = async () => {
  const items = presetEditing.value
    .map((g, idx) => ({ g, idx }))
    .filter((x) => !!x.g.items.trim() && !!selectedPresetIndicesMap.value[x.idx])
    .flatMap((x) => x.g.items.split(/[\s,，]+/))
    .map((s) => s.trim())
    .filter(Boolean)

  // 批量添加
  for (const item of items) {
    if (!keywords.value.includes(item)) {
      newKeyword.value = item
      await addKeyword()
    }
  }
  msg.success('已应用选中分组关键字')
}

const applyAllPresets = async () => {
  const items = presetEditing.value
    .flatMap((g) => g.items.split(/[\s,，]+/))
    .map((s) => s.trim())
    .filter(Boolean)

  // 批量添加
  for (const item of items) {
    if (!keywords.value.includes(item)) {
      newKeyword.value = item
      await addKeyword()
    }
  }
  msg.success('已应用所有分组关键字')
}

const onPresetDragStart = (idx: number, e: DragEvent) => {
  draggingPresetIndex.value = idx
  e.dataTransfer?.setData('text/plain', String(idx))
}
const onPresetDragOver = (_idx: number, e: DragEvent) => {
  e.preventDefault()
}
const onPresetDrop = (idx: number, e: DragEvent) => {
  e.preventDefault()
  const from = draggingPresetIndex.value
  draggingPresetIndex.value = null
  if (from == null || from === idx) return
  const removed = presetEditing.value.splice(from, 1)
  const item = removed[0]
  if (item) {
    presetEditing.value.splice(idx, 0, item)
  }
}

// 加载设置并初始化测试数据
onMounted(async () => {
  // 加载通知设置（使用 composable）
  await loadSettings()

  // 测试数据支持
  if (route.query.test === '1' && (!chatStore.sessionList || chatStore.sessionList.length === 0)) {
    const demo = Array.from({ length: 8 }).map((_, i) => ({
      roomId: `!demo${i}:server`,
      name: `演示群聊-${i + 1}`,
      type: RoomTypeEnum.GROUP,
      avatar: '',
      shield: false,
      muteNotification: NotificationTypeEnum.RECEPTION
    })) as never
    chatStore.sessionList = demo
  }
})
</script>

<style scoped lang="scss">
.item {
  @apply bg-[--bg-setting-item] rounded-12px size-full box-border border-(solid 1px [--line-color]);
  box-shadow: var(--shadow-main);
}

.n-scrollbar > .n-scrollbar-rail.n-scrollbar-rail--vertical > .n-scrollbar-rail__scrollbar,
.n-scrollbar + .n-scrollbar-rail.n-scrollbar-rail--vertical > .n-scrollbar-rail__scrollbar {
  left: -2px;
}
</style>
