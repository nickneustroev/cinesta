<script setup lang="ts">
import type { EnrichedMovie } from '~/types/import'

const props = defineProps<{
  data: EnrichedMovie[]
  importDate?: string | null
  limit?: number
  title?: string
  showMore?: number
  link?: string
  sortBy?: 'rating' | 'dateRated'
  showYearFilter?: boolean
  preSorted?: boolean
}>()

const route = useRoute()
const router = useRouter()

const visibleCount = ref(props.limit ?? 8)

const years = computed(() => {
  const set = new Set(props.data.map(m => m.year))
  return ['All', ...[...set].sort((a, b) => b - a)]
})

const selectedYear = ref<string>((route.query.year as string) || 'All')

const watchedYears = computed(() => {
  const set = new Set(
    props.data
      .map(m => m.dateRated?.slice(0, 4))
      .filter((y): y is string => !!y)
  )
  const sorted = [...set].sort((a, b) => Number(b) - Number(a))
  return ['All', ...sorted]
})

const selectedWatchedYear = ref<string>((route.query.watchedYear as string) || 'All')

const earliestWatchedYear = computed(() => {
  const years = watchedYears.value.filter(y => y !== 'All')
  return years[years.length - 1] ?? null
})

const genres = computed(() => {
  const set = new Set(props.data.flatMap(m => m.genres))
  return ['All', ...[...set].sort()]
})

const selectedGenre = ref<string>((route.query.genre as string) || 'All')

const sortedList = computed(() => {
  if (props.preSorted) {
    return props.data
  }
  const list = [...props.data]
  if (props.sortBy === 'dateRated') {
    const filtered = list.filter(m => m.dateRated && m.dateRated !== props.importDate)
    filtered.sort((a, b) => {
      if (!a.dateRated) return 1
      if (!b.dateRated) return -1
      return b.dateRated.localeCompare(a.dateRated)
    })
    return filtered
  }
  list.sort((a, b) => {
    const ratingDiff = b.userRating - a.userRating
    if (ratingDiff !== 0) return ratingDiff
    if (!a.dateRated) return 1
    if (!b.dateRated) return -1
    return b.dateRated.localeCompare(a.dateRated)
  })
  return list
})

const filteredList = computed(() => {
  let list = sortedList.value
  if (selectedYear.value !== 'All') {
    list = list.filter(m => m.year === Number(selectedYear.value))
  }
  if (selectedWatchedYear.value !== 'All') {
    list = list.filter(m => m.dateRated?.startsWith(selectedWatchedYear.value))
  }
  if (selectedWatchedYear.value === earliestWatchedYear.value && selectedWatchedYear.value !== 'All') {
    list = list.filter(m => m.dateRated !== props.importDate)
  }
  if (selectedGenre.value !== 'All') {
    list = list.filter(m => m.genres.includes(selectedGenre.value))
  }
  return list
})

const cards = computed(() => filteredList.value.slice(0, visibleCount.value))

const hasMore = computed(() => visibleCount.value < filteredList.value.length)

function showMoreCards() {
  visibleCount.value += props.showMore!
}

watch([selectedYear, selectedWatchedYear, selectedGenre], () => {
  visibleCount.value = props.limit ?? 8
  router.replace({ query: { ...route.query, year: selectedYear.value === 'All' ? undefined : selectedYear.value, watchedYear: selectedWatchedYear.value === 'All' ? undefined : selectedWatchedYear.value, genre: selectedGenre.value === 'All' ? undefined : selectedGenre.value } })
})
</script>

<template>
  <div>
    <h3
      v-if="title"
      class="text-2xl font-semibold mb-4"
    >
      {{ title }}
    </h3>
    <div
      v-if="showYearFilter"
      class="flex gap-4 mb-4"
    >
      <div>
        <p class="text-sm text-muted mb-1">
          {{ $t('movies_grid.year_released') }}
        </p>
        <USelectMenu
          v-model="selectedYear"
          :items="years"
          class="w-32"
        />
      </div>
      <div>
        <p class="text-sm text-muted mb-1">
          {{ $t('movies_grid.year_watched') }}
        </p>
        <USelectMenu
          v-model="selectedWatchedYear"
          :items="watchedYears"
          class="w-32"
        />
      </div>
      <div>
        <p class="text-sm text-muted mb-1">
          {{ $t('movies_grid.genre') }}
        </p>
        <USelectMenu
          v-model="selectedGenre"
          :items="genres"
          class="w-40"
        />
      </div>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <MovieCard
        v-for="(movie, index) in cards"
        :key="`${movie.uri}:${movie.dateRated ?? 'unknown'}:${index}`"
        :movie="movie"
        :import-date="importDate"
      />
    </div>
    <div
      v-if="showMore && hasMore"
      class="flex justify-center mt-6"
    >
      <UButton
        size="lg"
        color="primary"
        @click="showMoreCards"
      >
        {{ $t('movies_grid.show_more', { count: showMore }) }}
      </UButton>
    </div>
    <div
      v-if="link"
      class="flex justify-center mt-8"
    >
      <UButton
        :to="link"
        size="xl"
      >
        {{ $t('movies_grid.view_all') }}
      </UButton>
    </div>
  </div>
</template>
