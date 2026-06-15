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

const props = defineProps<{
  data: EnrichedMovie[]
  showTitle?: boolean
}>()

interface DirectorCard {
  director: string
  count: number
  avgRating: number
  movies: { title: string, year: number, userRating: number }[]
}

const cards = computed(() => {
  if (!props.data.length) return []

  const map = new Map<string, { count: number, totalRating: number, movies: { title: string, year: number, userRating: number }[] }>()

  for (const movie of props.data) {
    if (!movie.director) continue
    const entry = map.get(movie.director) ?? { count: 0, totalRating: 0, movies: [] }
    entry.count++
    entry.totalRating += movie.userRating
    entry.movies.push({ title: movie.title, year: movie.year, userRating: movie.userRating })
    map.set(movie.director, entry)
  }

  return Array.from(map.entries())
    .map(([director, entry]) => ({
      director,
      count: entry.count,
      avgRating: entry.totalRating / entry.count,
      movies: entry.movies.sort((a, b) => b.userRating - a.userRating || b.year - a.year)
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)
})
</script>

<template>
  <div class="mx-auto pt-12">
    <h3 class="mb-6 text-2xl font-semibold">
      Top-15 Directors (from favorite)
    </h3>
    <UPageGrid :ui="{ base: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4' }">
      <UPageCard
        v-for="(card, index) in cards"
        :key="index"
      >
        <template #body>
          <div :class="pageCardUi.title()">
            {{ card.director }}
          </div>
          <div :class="pageCardUi.description()">
            Movies: {{ card.count }} · Avg: {{ card.avgRating.toFixed(2) }}
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
