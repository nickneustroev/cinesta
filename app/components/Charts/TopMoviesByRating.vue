<script setup lang="ts">
import type { EnrichedMovie } from '~/types/import'

const props = defineProps<{
  data: EnrichedMovie[]
  importDate?: string | null
}>()

const ruMonths = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  const monthIndex = Number.parseInt(m!, 10) - 1
  return `${Number.parseInt(d!)} ${ruMonths[monthIndex] ?? ''} ${y}`
}

const cards = computed(() =>
  props.data
    .slice()
    .sort((a, b) => b.userRating - a.userRating)
    .slice(0, 8)
)
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    <SimpleCard
      v-for="(movie, index) in cards"
      :key="index"
      :photo="movie.poster"
      :name="movie.title"
      :description="`Rating: ${movie.userRating}`"
    >
      <div class="flex gap-4">
        <UUser
          v-for="d in movie.directors"
          :key="d.name"
          :name="d.name"
          :avatar="d.photo ? { src: `https://image.tmdb.org/t/p/w45${d.photo}` } : undefined"
        />
      </div>
      <div class="flex flex-wrap gap-2 mt-3">
        <UBadge
          v-for="genre in movie.genres"
          :key="genre"
          size="md"
          color="primary"
          variant="subtle"
        >
          {{ genre }}
        </UBadge>
      </div>
      <p
        v-if="movie.dateRated"
        class="mt-3 text-sm text-muted"
      >
        {{ movie.dateRated === props.importDate ? 'Посмотрено: до' : 'Посмотрено:' }} {{ formatDate(movie.dateRated) }}
      </p>
    </SimpleCard>
  </div>
</template>
