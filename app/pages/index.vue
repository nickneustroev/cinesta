<script setup lang="ts">
const { data, status, load, process } = useImportData()

onMounted(async () => {
  await load()
})
</script>

<template>
  <UContainer class="bg-muted border-x border-accented pb-12">
    <div
      v-if="status !== 'loading'"
      class="flex justify-center py-12"
    >
      <UButton
        size="xl"
        color="primary"
        @click="process"
      >
        {{ data ? 'Запустить заново' : 'Запуск' }}
      </UButton>
    </div>

    <div
      v-if="status === 'loading'"
      class="flex flex-col items-center justify-center gap-4 py-20"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="size-8 animate-spin text-muted"
      />
      <p class="text-sm text-muted">
        Идёт подготовка данных...
      </p>
    </div>

    <template v-if="data">
      <div class="flex flex-col gap-y-8">
        <h3 class="text-2xl font-semibold">
          Top-8 Movies by Rating
        </h3>
        <ChartsMoviesGrid :data="data.enriched" :import-date="data.stats.importDate" link="/movies?tab=ratings" />

        <ChartsMoviesGrid
          :data="data.enriched"
          :import-date="data.stats.importDate"
          title="Last Movies Watched (from favorite)"
          sort-by="dateRated"
          :limit="8"
        />

        <ChartsTopDirectorsByPointsCards
          :data="data.enriched"
          :limit="8"
          link="/directors?tab=points"
        />
        <ChartsTopDirectorsByHighestRatingCards
          :data="data.enriched"
          :limit="8"
          link="/directors?tab=highest"
        />
        <ChartsFavoritesByGenres :data="data.enriched" />
        <ChartsGenreShareByYears :data="data.enriched" />
        <ChartsGenreShareByWatchedYear :data="data.enriched" />
        <ChartsRatingStackedByYears :data="data.ratings" />
        <ChartsRatingShareByYears :data="data.ratings" />
        <ChartsWatchedAllByRating :data="data.ratings" />
        <ChartsAllMoviesCountByMonthWatched :data="data.watched" />
      </div>
    </template>
  </UContainer>
</template>
