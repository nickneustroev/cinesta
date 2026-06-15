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
  movies: string[]
}

const cards = computed(() => {
  if (!props.data.length) return []

  const map = new Map<string, { count: number, totalRating: number, movies: string[] }>()

  for (const movie of props.data) {
    if (!movie.director) continue
    const entry = map.get(movie.director) ?? { count: 0, totalRating: 0, movies: [] }
    entry.count++
    entry.totalRating += movie.userRating
    entry.movies.push(movie.title)
    map.set(movie.director, entry)
  }

  return Array.from(map.entries())
    .map(([director, entry]) => ({
      director,
      count: entry.count,
      avgRating: entry.totalRating / entry.count,
      movies: entry.movies
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
    <UPageGrid>
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
              {{ movie }}
            </li>
          </ul>
        </template>
      </UPageCard>
    </UPageGrid>
  </div>
</template>
