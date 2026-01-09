<template>
  <n-flex align="center" :size="6">
    <svg class="size-14px" xmlns="https://www.w3.org/2000/svg" fill="none" viewBox="0 0 48 48">
      <path
        :data-follow-stroke="isValid ? 'currentColor' : 'var(--hula-gray-300)'"
        :data-follow-fill="isValid ? 'currentColor' : 'var(--hula-gray-300)'"
        stroke-linejoin="round"
        stroke-width="4"
        :stroke="isValid ? 'currentColor' : 'var(--hula-gray-300)'"
        :fill="isValid ? 'currentColor' : 'var(--hula-gray-300)'"
        d="M24 44a19.937 19.937 0 0 0 14.142-5.858A19.937 19.937 0 0 0 44 24a19.938 19.938 0 0 0-5.858-14.142A19.937 19.937 0 0 0 24 4 19.938 19.938 0 0 0 9.858 9.858 19.938 19.938 0 0 0 4 24a19.937 19.937 0 0 0 5.858 14.142A19.938 19.938 0 0 0 24 44Z" />
      <path
        :data-follow-stroke="isValid ? 'currentColor' : 'var(--hula-gray-300)'"
        stroke-linejoin="round"
        stroke-linecap="round"
        stroke-width="4"
        :stroke="isValid ? 'currentColor' : 'var(--hula-gray-300)'"
        d="m16 24 6 6 12-12" />
    </svg>
    <p :class="['text-12px', { 'text-brand': isValid, 'text-gray-400': !isValid }]">
      {{ message }}
    </p>
  </n-flex>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  value: string
  message?: string
  validator?: (value: string) => boolean
}>()

const isValid = computed(() => (props.validator ? props.validator(props.value) : true))
</script>
