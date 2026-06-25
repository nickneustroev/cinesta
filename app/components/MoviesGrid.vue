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
const { t } = useI18n()

const visibleCount = ref(props.limit ?? 8)
const allLabel = computed(() => t('movies_grid.all'))
const filtersEnabled = computed(() => props.showYearFilter === true)

function getMovieWatchedDates(movie: EnrichedMovie) {
  return movie.watchedDates?.length ? movie.watchedDates : (movie.dateRated ? [movie.dateRated] : [])
}

function movieHasWatchedYear(movie: EnrichedMovie, year: string) {
  return getMovieWatchedDates(movie).some(date => date.startsWith(year))
}

const years = computed(() => {
  const set = new Set(props.data.map(m => m.year))
  return [allLabel.value, ...[...set].sort((a, b) => b - a).map(year => String(year))]
})

const selectedYear = ref<string>(
  filtersEnabled.value && typeof route.query.year === 'string' && route.query.year !== 'All'
    ? route.query.year
    : allLabel.value
)

const watchedYears = computed(() => {
  const set = new Set(
    props.data
      .flatMap(movie => getMovieWatchedDates(movie).map(date => date.slice(0, 4)))
      .filter((y): y is string => !!y)
  )
  const sorted = [...set].sort((a, b) => Number(b) - Number(a))
  return [allLabel.value, ...sorted]
})

const selectedWatchedYear = ref<string>(
  filtersEnabled.value && typeof route.query.watchedYear === 'string' && route.query.watchedYear !== 'All'
    ? route.query.watchedYear
    : allLabel.value
)

const earliestWatchedYear = computed(() => {
  const years = watchedYears.value.filter(year => year !== allLabel.value)
  return years[years.length - 1] ?? null
})

const genres = computed(() => {
  const set = new Set(props.data.flatMap(m => m.genres))
  return [allLabel.value, ...[...set].sort()]
})

const selectedGenre = ref<string>(
  filtersEnabled.value && typeof route.query.genre === 'string' && route.query.genre !== 'All'
    ? route.query.genre
    : allLabel.value
)

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
  if (!filtersEnabled.value) {
    return list
  }
  if (selectedYear.value !== allLabel.value) {
    list = list.filter(m => m.year === Number(selectedYear.value))
  }
  if (selectedWatchedYear.value !== allLabel.value) {
    list = list.filter(m => movieHasWatchedYear(m, selectedWatchedYear.value))
  }
  if (selectedWatchedYear.value === earliestWatchedYear.value && selectedWatchedYear.value !== allLabel.value) {
    list = list.filter(m => m.dateRated !== props.importDate)
  }
  if (selectedGenre.value !== allLabel.value) {
    list = list.filter(m => m.genres.includes(selectedGenre.value))
  }
  return list
})

const cards = computed(() => filteredList.value.slice(0, visibleCount.value))

const hasMore = computed(() => visibleCount.value < filteredList.value.length)

function showMoreCards() {
  visibleCount.value += props.showMore!
}

watch(allLabel, (nextLabel, prevLabel) => {
  if (selectedYear.value === prevLabel) selectedYear.value = nextLabel
  if (selectedWatchedYear.value === prevLabel) selectedWatchedYear.value = nextLabel
  if (selectedGenre.value === prevLabel) selectedGenre.value = nextLabel
})

watch([selectedYear, selectedWatchedYear, selectedGenre], () => {
  visibleCount.value = props.limit ?? 8
  if (!filtersEnabled.value) {
    return
  }
  router.replace({
    query: {
      ...route.query,
      year: selectedYear.value === allLabel.value ? undefined : selectedYear.value,
      watchedYear: selectedWatchedYear.value === allLabel.value ? undefined : selectedWatchedYear.value,
      genre: selectedGenre.value === allLabel.value ? undefined : selectedGenre.value
    }
  })
})
</script>

<template>
  <div>
    <h3
      v-if="title"
      class="text-2xl font-semibold mb-6"
    >
      {{ title }}
    </h3>
    <div
      v-if="showYearFilter"
      class="mb-4 flex flex-wrap gap-4"
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
