<script setup lang="ts">
const { data, status, load, process, processFromFile } = useImportData()

const uploadError = ref<string | null>(null)
const uploadedFile = ref<File | null>(null)
const showUpload = ref(false)

onMounted(async () => {
  await load()
})

function resetUpload() {
  uploadError.value = null
  uploadedFile.value = null
  showUpload.value = true
}

async function onFileSelect(file: File | null | undefined) {
  uploadError.value = null
  if (!file) return

  if (!file.name.toLowerCase().endsWith('.zip')) {
    uploadError.value = 'home.upload_error_format'
    return
  }
  if (file.size > 2 * 1024 * 1024) {
    uploadError.value = 'home.upload_error_size'
    return
  }

  uploadedFile.value = file
  await processFromFile(file)
  showUpload.value = false
}
</script>

<template>
  <UContainer
    class="bg-muted border-x border-accented pb-12"
    :class="!data && status === 'idle' ? 'flex flex-col min-h-[calc(100dvh-var(--ui-header-height,64px))]' : ''"
  >
    <div
      class="flex flex-col items-center gap-6 py-8"
      :class="!data && status === 'idle' ? 'flex-1 justify-center' : ''"
    >
      <UFileUpload
        v-if="showUpload || status === 'idle'"
        accept=".zip"
        :model-value="uploadedFile"
        :label="$t('home.upload_label')"
        :description="$t('home.upload_description')"
        class="w-full max-w-md"
        :ui="{ base: 'min-h-36' }"
        @update:model-value="onFileSelect"
      />

      <p
        v-if="uploadError"
        class="text-sm text-error"
      >
        {{ $t(uploadError) }}
      </p>

      <p
        v-if="showUpload || status === 'idle'"
        class="text-sm text-muted text-center"
      >
        {{ $t('home.upload_or_demo') }}
      </p>

      <div
        v-if="status !== 'loading'"
        class="flex gap-4"
      >
        <UButton
          v-if="data"
          size="xl"
          color="primary"
          @click="resetUpload"
        >
          {{ $t('home.upload_again') }}
        </UButton>
        <UButton
          size="xl"
          color="secondary"
          @click="process(); showUpload = false"
        >
          {{ data ? $t('home.run_again') : $t('home.run') }}
        </UButton>
      </div>
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
        {{ $t('home.loading') }}
      </p>
    </div>

    <template v-if="data">
      <div class="flex flex-col gap-y-8">
        <h3 class="text-2xl font-semibold">
          {{ $t('home.top_movies') }}
        </h3>
        <MoviesGrid
          :data="data.enriched"
          :import-date="data.stats.importDate"
          link="/movies?tab=ratings"
        />

        <MoviesGrid
          :data="data.enriched"
          :import-date="data.stats.importDate"
          :title="$t('home.last_movies_watched')"
          sort-by="dateRated"
          :limit="8"
          link="/movies?tab=last-watched"
        />

        <DirectorsGrid
          :data="data.enriched"
          :limit="8"
          sort-by="points"
          link="/directors?tab=points"
        />
        <DirectorsGrid
          :data="data.enriched"
          :limit="8"
          sort-by="highestMovieRating"
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
