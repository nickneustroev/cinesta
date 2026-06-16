<script setup lang="ts">
defineProps<{
  director: string
  photo: string | null
  description: string
  descriptionTitle?: string
  movies: { title: string, year: number, userRating: number }[]
}>()
</script>

<template>
  <SimpleCard
    :photo="photo"
    :name="director"
    :description="description"
    :description-title="descriptionTitle"
  >
    <ul class="list-inside list-disc">
      <li
        v-for="(movie, mi) in movies"
        :key="mi"
      >
        {{ movie.title }} <span class="text-muted">({{ movie.year }}) · {{ movie.userRating }}</span>
      </li>
    </ul>
  </SimpleCard>
</template>
