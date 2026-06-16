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
}>()

const visibleCount = ref(props.limit ?? 8)

const years = computed(() => {
  const set = new Set(props.data.map(m => m.year))
  return ['All', ...[...set].sort((a, b) => b - a)]
})

const selectedYear = ref<string>('All')

const watchedYears = computed(() => {
  const set = new Set(
    props.data
      .map(m => m.dateRated?.slice(0, 4))
      .filter((y): y is string => !!y)
  )
  return ['All', ...[...set].sort((a, b) => Number(b) - Number(a))]
})

const selectedWatchedYear = ref<string>('All')

const earliestWatchedYear = computed(() => {
  const years = watchedYears.value.filter(y => y !== 'All')
  return years[years.length - 1] ?? null
})

const genres = computed(() => {
  const set = new Set(props.data.flatMap(m => m.genres))
  return ['All', ...[...set].sort()]
})

const selectedGenre = ref<string>('All')

const sortedList = computed(() => {
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
  list.sort((a, b) => b.userRating - a.userRating)
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
          Year Released
        </p>
        <USelectMenu
          v-model="selectedYear"
          :items="years"
          class="w-32"
        />
      </div>
      <div>
        <p class="text-sm text-muted mb-1">
          Year Watched
        </p>
        <USelectMenu
          v-model="selectedWatchedYear"
          :items="watchedYears"
          class="w-32"
        />
      </div>
      <div>
        <p class="text-sm text-muted mb-1">
          Genre
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
        :key="index"
        :movie="movie"
        :import-date="importDate"
      />
    </div>
    <div
      v-if="showMore && hasMore"
      class="flex justify-center mt-4"
    >
      <UButton
        size="lg"
        color="primary"
        @click="showMoreCards"
      >
        Показать еще {{ showMore }}
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
        Смотреть всех
      </UButton>
    </div>
  </div>
</template>
