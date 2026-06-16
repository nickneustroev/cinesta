<script setup lang="ts">
import type { EnrichedMovie } from '~/types/import'

defineOptions({
  tags: ['cards', 'page']
})

const { t } = useI18n()

const props = withDefaults(defineProps<{
  data: EnrichedMovie[]
  title?: string
  limit?: number
  link?: string
  sortBy?: 'points' | 'highestMovieRating'
  showMore?: number
}>(), {
  limit: 20,
  sortBy: 'points'
})

interface DirectorCard {
  director: string
  photo: string | null
  description: string
  descriptionTitle?: string
  movies: { title: string, year: number, userRating: number }[]
  _sortValue: number
}

const visibleCount = ref(props.limit)

const sortedList = computed(() => {
  if (!props.data.length) return []
  return props.sortBy === 'points' ? computeByPoints() : computeByHighest()
})

const cards = computed(() => sortedList.value.slice(0, visibleCount.value))

const hasMore = computed(() => visibleCount.value < sortedList.value.length)

function showMoreCards() {
  visibleCount.value += props.showMore!
}

watch(() => props.sortBy, () => {
  visibleCount.value = props.limit
})

function computeByPoints(): DirectorCard[] {
  const map = new Map<string, { photo: string | null, points: number, breakdownParts: string[], movies: { title: string, year: number, userRating: number }[] }>()

  for (const movie of props.data) {
    for (const d of movie.directors) {
      const entry = map.get(d.name) ?? { photo: d.photo, points: 0, breakdownParts: [] as string[], movies: [] }
      if (!entry.photo) entry.photo = d.photo
      const contribution = movie.userRating ** 4
      entry.points += contribution
      entry.breakdownParts.push(`${movie.title} (${movie.userRating}⁴ = ${Math.round(contribution)})`)
      entry.movies.push({ title: movie.title, year: movie.year, userRating: movie.userRating })
      map.set(d.name, entry)
    }
  }

  return Array.from(map.entries())
    .map(([director, entry]) => {
      const displayPoints = Math.round(entry.points / 10)
      return {
        director,
        photo: entry.photo,
        description: `${t('directors_grid.points_label')}: ${displayPoints}`,
        descriptionTitle: entry.breakdownParts.join(' + ') + ` = ${Math.round(entry.points)} → /10 → ${displayPoints}`,
        movies: entry.movies.sort((a, b) => b.userRating - a.userRating || b.year - a.year),
        _sortValue: entry.points
      }
    })
    .sort((a, b) => b._sortValue - a._sortValue)
}

function computeByHighest(): DirectorCard[] {
  const map = new Map<string, { photo: string | null, maxRating: number, topCount: number, topMaxYear: number, movies: { title: string, year: number, userRating: number }[] }>()

  for (const movie of props.data) {
    for (const d of movie.directors) {
      const entry = map.get(d.name) ?? { photo: d.photo, maxRating: 0, topCount: 0, topMaxYear: 0, movies: [] }
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
        description: `Highest: ${entry.maxRating}`,
        movies: topMovies,
        _sortValue: 0
      }
    })
    .sort((a, b) => {
      const diff = b.movies[0]!.userRating - a.movies[0]!.userRating
      if (diff !== 0) return diff
      return b.movies.length - a.movies.length
    })
}
</script>

<template>
  <div class="mx-auto">
    <h3 class="mb-6 text-2xl font-semibold">
      {{ title ?? (sortBy === 'points' ? t('directors_grid.title.points') : t('directors_grid.title.highest')) }}
    </h3>
    <UPageGrid :ui="{ base: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4' }">
      <DirectorCard
        v-for="(card, index) in cards"
        :key="index"
        v-bind="card"
      />
    </UPageGrid>

    <div
      v-if="showMore && hasMore"
      class="flex justify-center mt-4"
    >
      <UButton
        size="lg"
        color="primary"
        @click="showMoreCards"
      >
        {{ $t('directors_grid.show_more', { count: showMore }) }}
      </UButton>
    </div>
    <div
      v-if="props.link"
      class="flex justify-center mt-8"
    >
      <UButton
        :to="props.link"
        size="xl"
      >
        {{ $t('directors_grid.view_all') }}
      </UButton>
    </div>
  </div>
</template>
