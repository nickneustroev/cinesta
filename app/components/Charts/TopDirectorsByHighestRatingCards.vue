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

const props = withDefaults(defineProps<{
  data: EnrichedMovie[]
  showTitle?: boolean
  title?: string
  limit?: number
  link?: string
}>(), {
  limit: 20
})

interface DirectorCard {
  director: string
  photo: string | null
  maxRating: number
  topCount: number
  topMaxYear: number
  movies: { title: string, year: number, userRating: number }[]
}

const TMDB_IMG_BASE = 'https://image.tmdb.org/t/p/w185'

const cards = computed(() => {
  if (!props.data.length) return []

  const map = new Map<string, { photo: string | null, maxRating: number, movies: { title: string, year: number, userRating: number }[] }>()

  for (const movie of props.data) {
    for (const d of movie.directors) {
      const entry = map.get(d.name) ?? { photo: d.photo, maxRating: 0, movies: [] }
      if (!entry.photo) entry.photo = d.photo
      entry.movies.push({ title: movie.title, year: movie.year, userRating: movie.userRating })
      if (movie.userRating > entry.maxRating) {
        entry.maxRating = movie.userRating
      }
      map.set(d.name, entry)
    }
  }

  return Array.from(map.entries())
    .map(([director, entry]) => {
      const topMovies = entry.movies.filter(m => m.userRating === entry.maxRating)
      return {
        director,
        photo: entry.photo,
        maxRating: entry.maxRating,
        topCount: topMovies.length,
        topMaxYear: Math.max(...topMovies.map(m => m.year)),
        movies: topMovies
      }
    })
    .sort((a, b) => b.maxRating - a.maxRating || b.topCount - a.topCount || b.topMaxYear - a.topMaxYear)
    .slice(0, props.limit)
})
</script>

<template>
  <div class="mx-auto">
    <h3 class="mb-6 text-2xl font-semibold">
      {{ props.title ?? `Top-${props.limit} Directors by Highest Movie Rating` }}
    </h3>
    <UPageGrid :ui="{ base: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4' }">
      <UPageCard
        v-for="(card, index) in cards"
        :key="index"
      >
        <template #body>
          <div class="flex items-center gap-3">
            <NuxtImg
              v-if="card.photo"
              :src="`${TMDB_IMG_BASE}${card.photo}`"
              :alt="card.director"
              class="h-14 w-10 rounded object-cover"
            />
            <div
              v-else
              class="h-14 w-10 rounded bg-accented flex items-center justify-center text-[10px] text-muted leading-tight text-center"
            >
              No<br>photo
            </div>
            <div class="min-w-0">
              <div :class="pageCardUi.title()">
                {{ card.director }}
              </div>
              <div :class="pageCardUi.description()">
                Highest: {{ card.maxRating }}
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

    <div
      v-if="props.link"
      class="flex justify-center mt-8"
    >
      <UButton
        :to="props.link"
        size="xl"
      >
        Смотреть всех
      </UButton>
    </div>
  </div>
</template>
