<!-- Event Permissions - Event-specific permission settings -->
<template>
  <div class="event-permissions">
    <n-spin :show="loading">
      <div class="event-list">
        <!-- Common Events -->
        <div class="event-section">
          <div class="section-title">常用事件</div>

          <div
            v-for="event in commonEvents"
            :key="event.type"
            class="event-item"
          >
            <div class="event-header">
              <div class="event-info">
                <n-icon size="20" class="event-icon">
                  <component :is="event.icon" />
                </n-icon>
                <div class="event-text">
                  <div class="event-name">{{ event.name }}</div>
                  <div class="event-type">{{ event.type }}</div>
                </div>
              </div>
              <div class="event-value">
                {{ getEventLevel(event.type) }}
              </div>
            </div>
            <n-slider
              :value="getEventLevel(event.type)"
              :min="0"
              :max="100"
              :step="10"
              :marks="{ 0: '0', 50: '50', 100: '100' }"
              @update:value="(v) => emit('update', event.type, v)"
            />
          </div>
        </div>

        <!-- Custom Event -->
        <div class="custom-section">
          <div class="section-title">自定义事件</div>

          <n-form-item label="事件类型">
            <n-input
              v-model:value="customEventType"
              placeholder="例如: m.room.custom"
              @keyup.enter="handleAddCustomEvent"
            />
          </n-form-item>

          <n-form-item label="权限等级">
            <n-slider
              v-model:value="customEventLevel"
              :min="0"
              :max="100"
              :step="10"
            />
          </n-form-item>

          <n-button
            type="primary"
            block
            :disabled="!customEventType.trim()"
            @click="handleAddCustomEvent"
          >
            添加自定义事件
          </n-button>
        </div>

        <!-- Custom Events List -->
        <div v-if="customEventsList.length > 0" class="custom-events-list">
          <div class="section-title">已添加的自定义事件</div>

          <div
            v-for="event in customEventsList"
            :key="event.type"
            class="custom-event-item"
          >
            <div class="custom-event-info">
              <div class="custom-event-type">{{ event.type }}</div>
              <div class="custom-event-level">权限: {{ event.level }}</div>
            </div>
            <n-button
              text
              type="error"
              size="small"
              @click="handleRemoveCustomEvent(event.type)"
            >
              <template #icon>
                <n-icon><X /></n-icon>
              </template>
            </n-button>
          </div>
        </div>

        <!-- Event Guide -->
        <n-collapse class="event-guide">
          <n-collapse-item title="事件类型说明" name="guide">
            <div class="guide-content">
              <div class="guide-item">
                <div class="guide-name">m.room.name</div>
                <div class="guide-desc">修改房间名称</div>
              </div>
              <div class="guide-item">
                <div class="guide-name">m.room.topic</div>
                <div class="guide-desc">修改房间主题</div>
              </div>
              <div class="guide-item">
                <div class="guide-name">m.room.avatar</div>
                <div class="guide-desc">修改房间头像</div>
              </div>
              <div class="guide-item">
                <div class="guide-name">m.room.power_levels</div>
                <div class="guide-desc">修改权限等级</div>
              </div>
              <div class="guide-item">
                <div class="guide-name">m.room.history_visibility</div>
                <div class="guide-desc">修改历史可见性</div>
              </div>
            </div>
          </n-collapse-item>
        </n-collapse>
      </div>
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { NSpin, NSlider, NIcon, NFormItem, NInput, NButton, NCollapse, NCollapseItem, useMessage } from 'naive-ui'
import { Message, Tag, Photo, Shield, Lock, X } from '@vicons/tabler'

interface PowerLevels {
  events_default?: number
  events?: Record<string, number>
}

interface Props {
  powerLevels: PowerLevels
  loading: boolean
}

type Emits = (e: 'update', eventType: string, value: number) => void

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const message = useMessage()

const customEventType = ref('')
const customEventLevel = ref(0)

const commonEvents = [
  { type: 'm.room.name', name: '房间名称', icon: Tag },
  { type: 'm.room.topic', name: '房间主题', icon: Message },
  { type: 'm.room.avatar', name: '房间头像', icon: Photo },
  { type: 'm.room.power_levels', name: '权限等级', icon: Shield },
  { type: 'm.room.history_visibility', name: '历史可见性', icon: Lock }
]

// Get events that are not in common events
const customEventsList = computed(() => {
  const commonTypes = new Set(commonEvents.map((e) => e.type))
  return Object.entries(props.powerLevels.events || {})
    .filter(([type]) => !commonTypes.has(type))
    .map(([type, level]) => ({ type, level: level as number }))
})

const getEventLevel = (eventType: string): number => {
  return props.powerLevels.events?.[eventType] ?? props.powerLevels.events_default ?? 0
}

const handleAddCustomEvent = () => {
  const type = customEventType.value.trim()
  if (!type) {
    message.warning('请输入事件类型')
    return
  }

  if (!type.startsWith('m.')) {
    message.warning('事件类型应以 m. 开头')
    return
  }

  emit('update', type, customEventLevel.value)
  message.success('自定义事件已添加')
  customEventType.value = ''
  customEventLevel.value = 0
}

const handleRemoveCustomEvent = (eventType: string) => {
  // Set to default to remove custom override
  emit('update', eventType, props.powerLevels.events_default ?? 0)
  message.info('自定义事件已移除')
}
</script>

<style scoped lang="scss">
.event-permissions {
  padding: 16px;
}

.event-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.event-section,
.custom-section,
.custom-events-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color-2);
  margin-bottom: 4px;
}

.event-item {
  background: var(--card-color);
  border-radius: 12px;
  padding: 16px;
}

.event-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.event-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.event-icon {
  color: var(--primary-color);
}

.event-text {
  flex: 1;
}

.event-name {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-color-1);
  margin-bottom: 2px;
}

.event-type {
  font-size: 12px;
  color: var(--text-color-3);
  font-family: 'Monaco', 'Consolas', monospace;
}

.event-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--primary-color);
  min-width: 32px;
  text-align: right;
}

.custom-event-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: var(--card-color);
  border-radius: 8px;
}

.custom-event-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.custom-event-type {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color-1);
  font-family: 'Monaco', 'Consolas', monospace;
}

.custom-event-level {
  font-size: 12px;
  color: var(--text-color-3);
}

.event-guide {
  margin-top: 8px;
}

.guide-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.guide-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.guide-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-color-1);
  font-family: 'Monaco', 'Consolas', monospace;
}

.guide-desc {
  font-size: 12px;
  color: var(--text-color-3);
}
</style>
