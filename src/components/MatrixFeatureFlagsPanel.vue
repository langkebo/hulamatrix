<template>
  <div class="matrix-flags-panel">
    <h3>Matrix Feature Flags</h3>
    <ul>
      <li v-for="(v, k) in flags" :key="k">{{ k }}: {{ v }}</li>
    </ul>
    <button @click="copySummary">复制摘要</button>
  </div>
</template>
<script setup lang="ts">
import { flags, flagSummary } from '@/utils/envFlags'
function copySummary() {
  navigator.clipboard.writeText(flagSummary())
}
</script>
<style scoped>
.matrix-flags-panel {
  padding: 12px;
}
.matrix-flags-panel ul {
  list-style: none;
  padding: 0;
  margin: 8px 0;
}
.matrix-flags-panel li {
  font-family: monospace;
}
</style>
