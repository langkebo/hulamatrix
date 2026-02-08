<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    :stroke="color"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <rect v-if="type === 'space'" x="3" y="3" width="18" height="18" rx="2" />
    <path v-if="type === 'space'" d="M9 3v18" />
    <path v-if="type === 'space'" d="M3 9h6" />
    <path v-if="type === 'space'" d="M3 15h6" />
    <path v-if="type === 'room'" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
</template>

<script setup lang="ts">
defineProps({
  size: {
    type: [Number, String],
    default: 22
  },
  color: {
    type: String,
    default: 'currentColor'
  },
  type: {
    type: String as () => 'space' | 'room',
    default: 'space'
  }
})
</script>
