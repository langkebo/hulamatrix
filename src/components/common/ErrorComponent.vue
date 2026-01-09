<template>
  <div class="error-component">
    <div class="error-icon">⚠️</div>
    <div class="error-text">组件加载失败</div>
    <button @click="$emit('retry')" class="retry-btn">重试</button>
  </div>
</template>

<script setup lang="ts">
defineEmits(['retry'])
</script>

<style scoped>
.error-component {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  color: var(--hula-brand-primary);
  background-color: var(--hula-brand-primary);
  border: 1px solid var(--hula-brand-primary);
  border-radius: 4px;
}

.error-icon {
  font-size: 24px;
  margin-bottom: 8px;
}

.error-text {
  font-size: 14px;
  margin-bottom: 12px;
}

.retry-btn {
  padding: 4px 12px;
  background-color: var(--hula-brand-primary);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.retry-btn:hover {
  background-color: var(--hula-brand-primary);
}
</style>
