<template>
  <div class="p-12px">
    <n-button type="primary" @click="onShare">分享位置</n-button>
  </div>
</template>

<script setup lang="ts">
import { shareLocation } from '@/integrations/matrix/location'
import { useGlobalStore } from '@/stores/global'

const onShare = async () => {
  const roomId = useGlobalStore().currentSessionRoomId
  if (!roomId) return
  const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject)
  )
  await shareLocation(roomId, pos.coords)
}
</script>

<style scoped></style>
