<template>
  <div class="room-power-levels">
    <h3>权限等级</h3>
    <n-form :model="powerLevels" label-placement="left">
      <n-form-item label="默认用户权限">
        <n-input-number
          :value="powerLevels.usersDefault"
          :min="0"
          :max="100"
          @update:value="val => val !== null && $emit('updatePowerLevels', { ...powerLevels, usersDefault: val })" />
      </n-form-item>

      <n-form-item label="默认事件权限">
        <n-input-number
          :value="powerLevels.eventsDefault"
          :min="0"
          :max="100"
          @update:value="val => val !== null && $emit('updatePowerLevels', { ...powerLevels, eventsDefault: val })" />
      </n-form-item>

      <n-form-item label="踢出权限">
        <n-input-number
          :value="powerLevels.kick"
          :min="0"
          :max="100"
          @update:value="val => val !== null && $emit('updatePowerLevels', { ...powerLevels, kick: val })" />
      </n-form-item>

      <n-form-item label="封禁权限">
        <n-input-number
          :value="powerLevels.ban"
          :min="0"
          :max="100"
          @update:value="val => val !== null && $emit('updatePowerLevels', { ...powerLevels, ban: val })" />
      </n-form-item>
    </n-form>
  </div>
</template>

<script setup lang="ts">
import { NForm, NFormItem, NInputNumber } from 'naive-ui'

interface PowerLevels {
  usersDefault: number
  eventsDefault: number
  stateDefault: number
  ban: number
  kick: number
  redact: number
  invite: number
  roomName: number
  roomAvatar: number
  roomTopic: number
  powerLevel: number
}

interface Props {
  powerLevels: PowerLevels
}

defineProps<Props>()

defineEmits<{
  updatePowerLevels: [powerLevels: PowerLevels]
}>()
</script>

<style scoped>
.room-power-levels {
  margin-top: 32px;
}

.room-power-levels h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
}
</style>
