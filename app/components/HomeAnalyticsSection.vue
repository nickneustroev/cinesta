<script setup lang="ts">
import type { ImportData } from '~/types/import'
import { buildHomeChartAnalytics } from '~/utils/home-analytics'

interface Props {
  data: ImportData
}

const props = defineProps<Props>()

const chartBatch = ref(1)
const analyticsBatchTwoTrigger = useTemplateRef<HTMLElement>('analyticsBatchTwoTrigger')
const analyticsBatchThreeTrigger = useTemplateRef<HTMLElement>('analyticsBatchThreeTrigger')
let analyticsBatchTwoObserver: IntersectionObserver | null = null
let analyticsBatchThreeObserver: IntersectionObserver | null = null

const chartAnalytics = computed(() => buildHomeChartAnalytics(props.data))

onUnmounted(() => {
  analyticsBatchTwoObserver?.disconnect()
  analyticsBatchThreeObserver?.disconnect()
})

watch(analyticsBatchTwoTrigger, (triggerEl, _prev, onCleanup) => {
  if (chartBatch.value !== 1 || !triggerEl) return

  analyticsBatchTwoObserver?.disconnect()
  analyticsBatchTwoObserver = new IntersectionObserver((entries) => {
    if (!entries.some(entry => entry.isIntersecting)) return

    chartBatch.value = 2
    analyticsBatchTwoObserver?.disconnect()
    analyticsBatchTwoObserver = null
  }, {
    rootMargin: '250px 0px'
  })

  analyticsBatchTwoObserver.observe(triggerEl)
  onCleanup(() => {
    analyticsBatchTwoObserver?.disconnect()
    analyticsBatchTwoObserver = null
  })
}, { flush: 'post' })

watch(analyticsBatchThreeTrigger, (triggerEl, _prev, onCleanup) => {
  if (chartBatch.value !== 2 || !triggerEl) return

  analyticsBatchThreeObserver?.disconnect()
  analyticsBatchThreeObserver = new IntersectionObserver((entries) => {
    if (!entries.some(entry => entry.isIntersecting)) return

    chartBatch.value = 3
    analyticsBatchThreeObserver?.disconnect()
    analyticsBatchThreeObserver = null
  }, {
    rootMargin: '250px 0px'
  })

  analyticsBatchThreeObserver.observe(triggerEl)
  onCleanup(() => {
    analyticsBatchThreeObserver?.disconnect()
    analyticsBatchThreeObserver = null
  })
}, { flush: 'post' })
</script>

<template>
  <section class="flex flex-col gap-y-8">
    <h3 class="text-2xl font-semibold">
      Analytics
    </h3>

    <LazyChartsFavoritesByGenres :items="chartAnalytics.favoritesByGenres" />
    <LazyChartsGenreShareByYears
      :items="chartAnalytics.genreShareByYears"
      :categories-data="chartAnalytics.genreCategories"
    />

    <div
      v-if="chartBatch === 1"
      ref="analyticsBatchTwoTrigger"
      class="rounded-2xl border border-dashed border-accented bg-default/50 px-6 py-8 text-center text-sm text-muted"
    >
      Scroll to load more analytics
    </div>

    <template v-if="chartBatch >= 2">
      <LazyChartsGenreShareByWatchedYear
        :items="chartAnalytics.genreShareByWatchedYear"
        :categories-data="chartAnalytics.genreCategories"
      />
      <LazyChartsRatingStackedByYears :items="chartAnalytics.ratingStackedByYears" />

      <div
        v-if="chartBatch === 2"
        ref="analyticsBatchThreeTrigger"
        class="rounded-2xl border border-dashed border-accented bg-default/50 px-6 py-8 text-center text-sm text-muted"
      >
        Scroll to load the remaining analytics
      </div>
    </template>

    <template v-if="chartBatch >= 3">
      <LazyChartsRatingShareByYears :items="chartAnalytics.ratingShareByYears" />
      <LazyChartsWatchedAllByRating :items="chartAnalytics.watchedAllByRating" />
      <LazyChartsAllMoviesCountByMonthWatched :items="chartAnalytics.allMoviesCountByMonthWatched" />
    </template>
  </section>
</template>
