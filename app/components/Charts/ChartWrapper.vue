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
  <UCard
    :ui="{
      root: 'w-full mx-auto'

    }"
  >
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-2xl font-semibold">
          {{ title }}
        </h3>
      </div>
    </template>

    <slot />
  </UCard>
</template>
