<script lang="ts" setup>
withDefaults(
  defineProps<{
    title: string
    showTitle?: boolean
  }>(),
  {
    showTitle: false
  }
)
</script>

<template>
  <div
    class="mx-auto max-w-3xl space-y-2 rounded-lg pt-12"
    :class="showTitle ? 'p-6' : ''"
  >
    <div class="flex items-center justify-between">
      <h3 class="text-2xl font-semibold">
        {{ title }}
      </h3>
    </div>
    <slot />
  </div>
</template>
