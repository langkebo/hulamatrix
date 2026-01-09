<!-- Default Permissions - Default permission level settings -->
<template>
  <div class="default-permissions">
    <n-spin :show="loading">
      <div class="permission-list">
        <!-- Users Default -->
        <div class="permission-item">
          <div class="item-header">
            <div class="item-info">
              <n-icon size="20" class="item-icon">
                <Users />
              </n-icon>
              <div class="item-text">
                <div class="item-title">默认用户权限</div>
                <div class="item-desc">新成员的基础权限等级</div>
              </div>
            </div>
            <div class="item-value">{{ powerLevels.users_default || 0 }}</div>
          </div>
          <n-slider
            :value="powerLevels.users_default || 0"
            :min="0"
            :max="100"
            :step="10"
            :marks="{ 0: '0', 50: '50', 100: '100' }"
            @update:value="(v) => emit('update', 'users_default', v)" />
        </div>

        <!-- Events Default -->
        <div class="permission-item">
          <div class="item-header">
            <div class="item-info">
              <n-icon size="20" class="item-icon">
                <CalendarEvent />
              </n-icon>
              <div class="item-text">
                <div class="item-title">默认事件权限</div>
                <div class="item-desc">发送消息的最低权限等级</div>
              </div>
            </div>
            <div class="item-value">{{ powerLevels.events_default || 0 }}</div>
          </div>
          <n-slider
            :value="powerLevels.events_default || 0"
            :min="0"
            :max="100"
            :step="10"
            :marks="{ 0: '0', 50: '50', 100: '100' }"
            @update:value="(v) => emit('update', 'events_default', v)" />
        </div>

        <!-- State Default -->
        <div class="permission-item">
          <div class="item-header">
            <div class="item-info">
              <n-icon size="20" class="item-icon">
                <Database />
              </n-icon>
              <div class="item-text">
                <div class="item-title">状态事件权限</div>
                <div class="item-desc">修改房间设置的最低权限</div>
              </div>
            </div>
            <div class="item-value">{{ powerLevels.state_default || 50 }}</div>
          </div>
          <n-slider
            :value="powerLevels.state_default || 50"
            :min="0"
            :max="100"
            :step="10"
            :marks="{ 0: '0', 50: '50', 100: '100' }"
            @update:value="(v) => emit('update', 'state_default', v)" />
        </div>

        <!-- Special Permissions -->
        <div class="permission-section">
          <div class="section-title">特殊权限</div>

          <div class="permission-item">
            <div class="item-header">
              <div class="item-info">
                <n-icon size="20" class="item-icon danger">
                  <UserMinus />
                </n-icon>
                <div class="item-text">
                  <div class="item-title">移除成员</div>
                  <div class="item-desc">踢出成员的权限等级</div>
                </div>
              </div>
              <div class="item-value">{{ powerLevels.kick || 50 }}</div>
            </div>
            <n-slider
              :value="powerLevels.kick || 50"
              :min="0"
              :max="100"
              :step="10"
              :marks="{ 0: '0', 50: '50', 100: '100' }"
              @update:value="(v) => emit('update', 'kick', v)" />
          </div>

          <div class="permission-item">
            <div class="item-header">
              <div class="item-info">
                <n-icon size="20" class="item-icon danger">
                  <Ban />
                </n-icon>
                <div class="item-text">
                  <div class="item-title">封禁用户</div>
                  <div class="item-desc">封禁成员的权限等级</div>
                </div>
              </div>
              <div class="item-value">{{ powerLevels.ban || 50 }}</div>
            </div>
            <n-slider
              :value="powerLevels.ban || 50"
              :min="0"
              :max="100"
              :step="10"
              :marks="{ 0: '0', 50: '50', 100: '100' }"
              @update:value="(v) => emit('update', 'ban', v)" />
          </div>

          <div class="permission-item">
            <div class="item-header">
              <div class="item-info">
                <n-icon size="20" class="item-icon warning">
                  <Trash />
                </n-icon>
                <div class="item-text">
                  <div class="item-title">删除消息</div>
                  <div class="item-desc">删除消息的权限等级</div>
                </div>
              </div>
              <div class="item-value">{{ powerLevels.redact || 50 }}</div>
            </div>
            <n-slider
              :value="powerLevels.redact || 50"
              :min="0"
              :max="100"
              :step="10"
              :marks="{ 0: '0', 50: '50', 100: '100' }"
              @update:value="(v) => emit('update', 'redact', v)" />
          </div>

          <div class="permission-item">
            <div class="item-header">
              <div class="item-info">
                <n-icon size="20" class="item-icon success">
                  <Mail />
                </n-icon>
                <div class="item-text">
                  <div class="item-title">邀请成员</div>
                  <div class="item-desc">邀请新成员的权限等级</div>
                </div>
              </div>
              <div class="item-value">{{ powerLevels.invite || 50 }}</div>
            </div>
            <n-slider
              :value="powerLevels.invite || 50"
              :min="0"
              :max="100"
              :step="10"
              :marks="{ 0: '0', 50: '50', 100: '100' }"
              @update:value="(v) => emit('update', 'invite', v)" />
          </div>
        </div>

        <!-- Permission Guide -->
        <n-collapse class="permission-guide">
          <n-collapse-item title="权限等级说明" name="guide">
            <div class="guide-content">
              <div class="guide-item">
                <span class="guide-level">0</span>
                <span class="guide-desc">普通成员 - 只能发送消息</span>
              </div>
              <div class="guide-item">
                <span class="guide-level">10-49</span>
                <span class="guide-desc">受信任成员 - 额外权限</span>
              </div>
              <div class="guide-item">
                <span class="guide-level">50</span>
                <span class="guide-desc">版主 - 可移除/封禁成员</span>
              </div>
              <div class="guide-item">
                <span class="guide-level">51-99</span>
                <span class="guide-desc">高级版主 - 可管理设置</span>
              </div>
              <div class="guide-item">
                <span class="guide-level">100</span>
                <span class="guide-desc">管理员 - 完全控制权</span>
              </div>
            </div>
          </n-collapse-item>
        </n-collapse>
      </div>
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import { NSpin, NSlider, NIcon, NCollapse, NCollapseItem } from 'naive-ui'
import { Users, CalendarEvent, Database, UserMinus, Ban, Trash, Mail } from '@vicons/tabler'

interface PowerLevels {
  users_default?: number
  events_default?: number
  state_default?: number
  ban?: number
  kick?: number
  redact?: number
  invite?: number
}

interface Props {
  powerLevels: PowerLevels
  loading: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<(e: 'update', key: string, value: number) => void>()
</script>

<style scoped lang="scss">
.default-permissions {
  padding: 16px;
}

.permission-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.permission-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color-2);
  margin-bottom: 8px;
}

.permission-item {
  background: var(--card-color);
  border-radius: 12px;
  padding: 16px;
}

.item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.item-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.item-icon {
  color: var(--primary-color);

  &.danger {
    color: #d03050;
  }

  &.warning {
    color: #f0a020;
  }

  &.success {
    color: #18a058;
  }
}

.item-text {
  flex: 1;
}

.item-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-color-1);
  margin-bottom: 2px;
}

.item-desc {
  font-size: 12px;
  color: var(--text-color-3);
}

.item-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--primary-color);
  min-width: 40px;
  text-align: right;
}

.permission-guide {
  margin-top: 8px;
}

.guide-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.guide-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.guide-level {
  min-width: 48px;
  padding: 4px 8px;
  background: var(--primary-color);
  color: white;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  text-align: center;
}

.guide-desc {
  font-size: 13px;
  color: var(--text-color-2);
}
</style>
