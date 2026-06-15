<script setup lang="ts">
import { tv } from '@nuxt/ui/utils/tv'
import type { EnrichedMovie } from '~/types/import'
import theme from '#build/ui/page-card'

const appConfig = useAppConfig()
const pageCardUi = computed(() =>
  tv({ extend: tv(theme), ...appConfig.ui?.pageCard || {} })({
    orientation: 'vertical',
    reverse: false,
    variant: 'outline',
    to: false,
    title: false,
    highlight: false,
    spotlight: false
  })
)

defineOptions({
  tags: ['cards', 'page']
})

const BOOST = 1

const props = defineProps<{
  data: EnrichedMovie[]
  showTitle?: boolean
}>()

interface DirectorCard {
  director: string
  photo: string | null
  count: number
  points: number
  movies: { title: string, year: number, userRating: number }[]
}

const TMDB_IMG_BASE = 'https://image.tmdb.org/t/p/w185'

const cards = computed(() => {
  if (!props.data.length) return []

  const map = new Map<string, { photo: string | null, count: number, points: number, movies: { title: string, year: number, userRating: number }[] }>()

  for (const movie of props.data) {
    for (const d of movie.directors) {
      const entry = map.get(d.name) ?? { photo: d.photo, count: 0, points: 0, movies: [] }
      if (!entry.photo) entry.photo = d.photo
      entry.count++
      entry.points += (movie.userRating * BOOST) ** 2
      entry.movies.push({ title: movie.title, year: movie.year, userRating: movie.userRating })
      map.set(d.name, entry)
    }
  }

  return Array.from(map.entries())
    .map(([director, entry]) => ({
      director,
      photo: entry.photo,
      count: entry.count,
      points: entry.points,
      movies: entry.movies.sort((a, b) => b.userRating - a.userRating || b.year - a.year)
    }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 20)
})
</script>

<template>
  <div class="mx-auto pt-12">
    <h3 class="mb-6 text-2xl font-semibold">
      Top-20 Directors by Points
    </h3>
    <UPageGrid :ui="{ base: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4' }">
      <UPageCard
        v-for="(card, index) in cards"
        :key="index"
      >
        <template #body>
          <div class="flex items-center gap-3">
            <img
              v-if="card.photo"
              :src="`${TMDB_IMG_BASE}${card.photo}`"
              :alt="card.director"
              class="h-14 w-10 rounded object-cover"
            />
            <div class="min-w-0">
              <div :class="pageCardUi.title()">
                {{ card.director }}
              </div>
              <div :class="pageCardUi.description()">
                Points: {{ card.points }}
              </div>
            </div>
          </div>
          <ul class="mt-2 list-inside list-disc">
            <li
              v-for="(movie, mi) in card.movies"
              :key="mi"
            >
              {{ movie.title }} <span class="text-muted">({{ movie.year }}) · {{ movie.userRating }}</span>
            </li>
          </ul>
        </template>
      </UPageCard>
    </UPageGrid>
  </div>
</template>
