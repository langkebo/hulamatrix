<!--
  Button Component Examples
  Demonstrates all button variants and use cases
-->
<template>
  <div class="button-examples">
    <section class="example-section">
      <h2>Primary Buttons</h2>
      <div class="button-group">
        <PrimaryButton>Default</PrimaryButton>
        <PrimaryButton size="sm">Small</PrimaryButton>
        <PrimaryButton size="lg">Large</PrimaryButton>
        <PrimaryButton :loading="true">Loading</PrimaryButton>
        <PrimaryButton disabled>Disabled</PrimaryButton>
      </div>
    </section>

    <section class="example-section">
      <h2>Secondary Buttons</h2>
      <div class="button-group">
        <SecondaryButton>Default</SecondaryButton>
        <SecondaryButton size="sm">Small</SecondaryButton>
        <SecondaryButton size="lg">Large</SecondaryButton>
        <SecondaryButton disabled>Disabled</SecondaryButton>
      </div>
    </section>

    <section class="example-section">
      <h2>Icon Buttons</h2>
      <div class="button-group">
        <IconButton icon="heroicons:pencil" :tooltip="'Edit'" />
        <IconButton icon="heroicons:trash" :tooltip="'Delete'" variant="danger" />
        <IconButton icon="heroicons:eye" :tooltip="'View'" />
        <IconButton icon="heroicons:arrow-path" :tooltip="'Refresh'" :spin="true" />
      </div>
    </section>

    <section class="example-section">
      <h2>Block Buttons</h2>
      <div class="button-group block">
        <PrimaryButton block>Full Width Button</PrimaryButton>
        <SecondaryButton block>Full Width Secondary</SecondaryButton>
      </div>
    </section>

    <section class="example-section">
      <h2>Button States</h2>
      <div class="button-group">
        <PrimaryButton @click="handleClick">Click Counter: {{ count }}</PrimaryButton>
        <PrimaryButton :loading="isLoading" @click="handleAsyncClick">Async Action</PrimaryButton>
        <PrimaryButton :disabled="count >= 5" @click="increment">Increment (Max: 5)</PrimaryButton>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import PrimaryButton from '@/components/shared/buttons/PrimaryButton.vue'
import SecondaryButton from '@/components/shared/buttons/SecondaryButton.vue'
import IconButton from '@/components/shared/buttons/IconButton.vue'

const count = ref(0)
const isLoading = ref(false)

const handleClick = () => {
  count.value++
}

const increment = () => {
  if (count.value < 5) {
    count.value++
  }
}

const handleAsyncClick = async () => {
  isLoading.value = true
  // Simulate async operation
  await new Promise((resolve) => setTimeout(resolve, 2000))
  isLoading.value = false
}
</script>

<style scoped lang="scss">
@import '@/styles/scss/global/variables.scss';

.button-examples {
  padding: var(--spacing-xl);
  max-width: 800px;
  margin: 0 auto;
}

.example-section {
  margin-bottom: var(--spacing-3xl);

  h2 {
    margin-bottom: var(--spacing-md);
    font-size: 1.25rem;
    color: var(--hula-text-primary);
  }
}

.button-group {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-md);
  align-items: center;

  &.block {
    flex-direction: column;
  }
}
</style>
