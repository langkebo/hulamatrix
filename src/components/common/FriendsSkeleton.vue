<template>
  <div class="friends-skeleton" role="status" :aria-label="$t('friends.list.loading')">
    <div v-for="i in 6" :key="i" class="skeleton-item">
      <!-- 头像骨架 -->
      <div class="skeleton-avatar"></div>
      <!-- 内容骨架 -->
      <div class="skeleton-content">
        <div class="skeleton-line skeleton-name"></div>
        <div class="skeleton-line skeleton-status"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<style scoped lang="scss">
.friends-skeleton {
  padding: var(--spacing-md);
}

.skeleton-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) 0;
}

.skeleton-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(
    90deg,
    var(--skeleton-base, #f0f0f0) 25%,
    var(--skeleton-highlight, #e0e0e0) 50%,
    var(--skeleton-base, #f0f0f0) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
}

.skeleton-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-line {
  height: 14px;
  border-radius: 4px;
  background: linear-gradient(
    90deg,
    var(--skeleton-base, #f0f0f0) 25%,
    var(--skeleton-highlight, #e0e0e0) 50%,
    var(--skeleton-base, #f0f0f0) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
}

.skeleton-name {
  width: 60%;
}

.skeleton-status {
  width: 40%;
}

@keyframes skeleton-loading {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}
</style>
