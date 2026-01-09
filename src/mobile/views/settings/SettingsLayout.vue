<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar :is-official="false" :room-name="title" @back="handleBack" />
    </template>

    <template #container>
      <div class="mobile-settings-layout">
        <div v-if="loading" class="mobile-settings-layout__loading">
          <n-spin size="medium" />
        </div>
        <div v-else class="mobile-settings-layout__content">
          <slot />
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { NSpin } from 'naive-ui'
import AutoFixHeightPage from '#/components/chat/AutoFixHeightPage.vue'
import HeaderBar from '#/components/chat/HeaderBar.vue'

interface Props {
  title?: string
  loading?: boolean
}

withDefaults(defineProps<Props>(), {
  title: 'Settings',
  loading: false
})

const router = useRouter()

const handleBack = () => {
  router.back()
}
</script>

<style lang="scss" scoped>
.mobile-settings-layout {
  height: 100%;
  overflow: auto;
  background: var(--hula-gray-50);

  &__loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }

  &__content {
    padding: 16px;
  }
}
</style>
