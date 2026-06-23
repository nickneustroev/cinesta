<script setup lang="ts">
const { data, status, error, load, process, processFromFile } = useImportData()
const analytics = useHomeAnalytics(data, { includeCharts: true })
const chartAnalytics = computed(() => analytics.value?.charts)
const toast = useToast()
const { t } = useI18n()

const uploadError = ref<string | null>(null)
const uploadedFile = ref<File | null>(null)
const showUpload = ref(false)
const estimate = ref<{ count: number, seconds: number } | null>(null)
const remainingSeconds = ref(0)
const initialLoading = ref(true)
const DEFAULT_MIN_RATING = 3
let countdownTimer: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  await load()
  initialLoading.value = false
})

onUnmounted(() => {
  if (countdownTimer) clearInterval(countdownTimer)
})

function showSuccess() {
  toast.add({
    title: t('home.import_success'),
    color: 'success',
    icon: 'i-lucide-check-circle'
  })
}

watch(status, (val) => {
  if (val !== 'loading' && countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
})

function startCountdown(seconds: number) {
  remainingSeconds.value = seconds
  if (countdownTimer) clearInterval(countdownTimer)
  countdownTimer = setInterval(() => {
    if (remainingSeconds.value > 1) remainingSeconds.value--
    else if (countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }
  }, 1000)
}

function resetUpload() {
  uploadError.value = null
  uploadedFile.value = null
  showUpload.value = true
  estimate.value = null
  remainingSeconds.value = 0
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

async function runDemo() {
  showUpload.value = false
  uploadedFile.value = null
  await process(DEFAULT_MIN_RATING, false)
  if (status.value === 'done') {
    showSuccess()
  } else {
    showUpload.value = true
    toast.add({ title: error.value || t('home.import_error'), color: 'error', icon: 'i-lucide-x-circle' })
  }
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
  const est = await estimateProcessingTime(file, DEFAULT_MIN_RATING)
  estimate.value = est
  if (est) startCountdown(est.seconds)
  await processFromFile(file, DEFAULT_MIN_RATING)
  if (status.value === 'done') {
    showUpload.value = false
    showSuccess()
  } else {
    uploadedFile.value = null
    showUpload.value = true
    toast.add({ title: error.value || t('home.import_error'), color: 'error', icon: 'i-lucide-x-circle' })
  }
}
</script>

<template>
  <UContainer
    class="bg-muted border-x border-accented pb-12"
    :class="!data && status === 'idle' ? 'flex flex-col min-h-[calc(100dvh-var(--ui-header-height,64px))]' : ''"
  >
    <div
      v-if="initialLoading"
      class="flex flex-col items-center justify-center gap-4 py-20"
      :class="!data && status === 'idle' ? 'flex-1' : ''"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="size-8 animate-spin text-muted"
      />
    </div>
    <div
      v-if="!initialLoading"
      class="flex flex-col items-center gap-6 py-8"
      :class="!data && status === 'idle' ? 'flex-1 justify-center' : ''"
    >
      <UFileUpload
        v-if="(showUpload || status === 'idle') && status !== 'loading'"
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
        v-if="(showUpload || status === 'idle') && status !== 'loading'"
        class="text-sm text-muted text-center"
      >
        {{ $t('home.upload_or_demo') }}
      </p>

      <div
        v-if="status !== 'loading'"
        class="flex gap-4"
      >
        <UButton
          v-if="data && !showUpload"
          size="xl"
          color="primary"
          @click="resetUpload"
        >
          {{ $t('home.upload_again') }}
        </UButton>
        <UButton
          size="xl"
          color="secondary"
          @click="runDemo"
        >
          {{ data ? $t('home.run_again') : $t('home.run') }}
        </UButton>
      </div>
    </div>

    <UCard
      v-if="status === 'loading'"
      class="w-full max-w-md mx-auto"
      :ui="{ body: 'flex flex-col items-center justify-center gap-4 py-20' }"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="size-8 animate-spin text-muted"
      />
      <p class="text-sm text-muted text-center">
        {{ estimate && remainingSeconds > 1 ? $t('home.loading_estimate', { count: estimate.count, seconds: remainingSeconds }) : estimate ? $t('home.loading_finishing') : $t('home.loading') }}
      </p>
    </UCard>

    <template v-if="data">
      <div class="flex flex-col gap-y-8">
        <h3 class="text-2xl font-semibold">
          {{ $t('home.top_movies') }}
        </h3>
        <MoviesGrid
          :data="analytics?.moviesByRating || []"
          :import-date="data.stats.importDate"
          pre-sorted
          link="/movies?tab=ratings"
        />

        <MoviesGrid
          :data="analytics?.moviesByDateRated || []"
          :import-date="data.stats.importDate"
          :title="$t('home.last_movies_watched')"
          pre-sorted
          :limit="8"
          link="/movies?tab=last-watched"
        />

        <DirectorsGrid
          :cards-data="analytics?.directorsByPoints"
          :title="$t('pages.directors.title.points')"
          :limit="8"
          link="/directors?tab=points"
        />
        <DirectorsGrid
          :cards-data="analytics?.directorsByHighest"
          :title="$t('pages.directors.title.highest')"
          sort-by="highestMovieRating"
          :limit="8"
          link="/directors?tab=highest"
        />
        <template v-if="chartAnalytics">
          <ChartsWatchedAllByRating :items="chartAnalytics.watchedAllByRating" />
          <ChartsAllMoviesCountByMonthWatched
            :items="chartAnalytics.allMoviesCountByYearWatched"
            :release-items="chartAnalytics.allMoviesCountByYearReleased"
          />
          <ChartsRatingStackedByYears
            :items="chartAnalytics.ratingStackedByYears"
            :watched-items="chartAnalytics.ratingStackedByWatchedYears"
          />
          <ChartsRatingShareByYears
            :items="chartAnalytics.ratingShareByYears"
            :watched-items="chartAnalytics.ratingShareByWatchedYears"
          />
          <ChartsFavoritesByGenres :items="chartAnalytics.favoritesByGenres" />
          <ChartsGenreShareByYears
            :items="chartAnalytics.genreShareByYears"
            :categories-data="chartAnalytics.genreCategories"
          />
        </template>
      </div>
    </template>
  </UContainer>
</template>
