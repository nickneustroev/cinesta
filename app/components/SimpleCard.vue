<script setup lang="ts">
const TMDB_IMG_BASE = 'https://image.tmdb.org/t/p/w185'

defineProps<{
  photo: string | null
  name: string
  description?: string
  descriptionTitle?: string
}>()
</script>

<template>
  <UCard :ui="{ header: 'flex items-center gap-3' }">
    <template #header>
      <img
        v-if="photo"
        :src="`${TMDB_IMG_BASE}${photo}`"
        :alt="name"
        class="h-14 w-10 rounded object-cover shrink-0"
      />
      <div
        v-else
        class="h-14 w-10 rounded bg-accented flex items-center justify-center text-[10px] text-muted leading-tight text-center shrink-0"
      >
        No<br>photo
      </div>
      <div class="min-w-0">
        <div class="text-xl text-default font-semibold">
          <slot name="title">
            {{ name }}
          </slot>
        </div>
        <div
          class="mt-1 text-muted text-base"
          :title="descriptionTitle"
        >
          {{ description }}
        </div>
      </div>
    </template>

    <slot />
  </UCard>
</template>
