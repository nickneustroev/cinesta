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
let countdownTimer: ReturnType<typeof setInterval> | null = null

const estimateSummary = computed(() => {
  if (!estimate.value) return null
  return t('home.estimate_ready', {
    count: estimate.value.count,
    duration: formatEstimateDuration(estimate.value.seconds)
  })
})

const loadingEstimateSummary = computed(() => {
  if (!estimate.value || remainingSeconds.value <= 1) return null
  return t('home.loading_estimate', {
    count: estimate.value.count,
    duration: formatEstimateDuration(remainingSeconds.value)
  })
})

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

function formatEstimateDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const restSeconds = seconds % 60

  if (minutes <= 0) {
    return `${restSeconds} ${t('home.duration_seconds_short')}`
  }

  if (restSeconds <= 0) {
    return `${minutes} ${t('home.duration_minutes_short')}`
  }

  return `${minutes} ${t('home.duration_minutes_short')} ${restSeconds} ${t('home.duration_seconds_short')}`
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

function resetEstimate() {
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
  resetEstimate()
  await process(undefined, false)
  if (status.value === 'done') {
    showSuccess()
  } else {
    showUpload.value = true
    toast.add({ title: error.value || t('home.import_error'), color: 'error', icon: 'i-lucide-x-circle' })
  }
}

async function onFileSelect(file: File | null | undefined) {
  uploadError.value = null
  resetEstimate()

  if (!file) {
    uploadedFile.value = null
    return
  }

  if (!file.name.toLowerCase().endsWith('.zip')) {
    uploadedFile.value = null
    uploadError.value = 'home.upload_error_format'
    return
  }
  if (file.size > 2 * 1024 * 1024) {
    uploadedFile.value = null
    uploadError.value = 'home.upload_error_size'
    return
  }

  uploadedFile.value = file
  estimate.value = await estimateProcessingTime(file)
}

async function startImport() {
  if (!uploadedFile.value) return

  if (estimate.value) startCountdown(estimate.value.seconds)

  await processFromFile(uploadedFile.value)
  if (status.value === 'done') {
    showUpload.value = false
    showSuccess()
  } else {
    showUpload.value = true
    toast.add({ title: error.value || t('home.import_error'), color: 'error', icon: 'i-lucide-x-circle' })
  }
}
</script>

<template>
  <UContainer
    class="bg-muted border-x border-accented pb-12"
    :class="!data ? 'flex min-h-[calc(100dvh-var(--ui-header-height,64px))] flex-col' : ''"
  >
    <div
      v-if="initialLoading"
      class="flex flex-col items-center justify-center gap-4 py-20"
      :class="!data ? 'flex-1' : ''"
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
      <p
        v-if="(showUpload || status === 'idle') && status !== 'loading'"
        class="max-w-md text-center text-sm text-muted"
      >
        {{ $t('home.letterboxd_export_hint_before') }}
        <a
          href="https://letterboxd.com/settings/data/"
          target="_blank"
          rel="noopener noreferrer"
          class="text-primary underline underline-offset-2"
        >
          {{ $t('home.letterboxd_settings_link') }}
        </a>
        {{ $t('home.letterboxd_export_hint_after') }}
      </p>

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
        v-if="(showUpload || status === 'idle') && status !== 'loading' && estimateSummary && uploadedFile && !uploadError"
        class="max-w-md text-center text-sm text-muted"
      >
        {{ estimateSummary }}
      </p>

      <UButton
        v-if="(showUpload || status === 'idle') && status !== 'loading' && uploadedFile && !uploadError"
        size="lg"
        color="primary"
        @click="startImport"
      >
        {{ $t('home.start_import') }}
      </UButton>

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
        class="flex flex-col items-center gap-4 sm:flex-row"
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

    <div
      v-if="status === 'loading'"
      class="flex flex-1 items-center justify-center py-8"
    >
      <UCard
        class="w-full max-w-md mx-auto"
        :ui="{ body: 'flex flex-col items-center justify-center gap-4 py-20' }"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="size-8 animate-spin text-muted"
        />
        <p class="text-sm text-muted text-center">
          {{ loadingEstimateSummary || (estimate ? $t('home.loading_finishing') : $t('home.loading')) }}
        </p>
      </UCard>
    </div>

    <template v-if="data">
      <div class="flex flex-col gap-y-8">
        <MoviesGrid
          :data="analytics?.moviesByRating || []"
          :import-date="data.stats.importDate"
          :title="$t('home.top_movies')"
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
          :subtitle="$t('directors_grid.points_explanation')"
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
          <ChartsFavoritesByGenres :data="analytics?.moviesByRating || []" />
          <ChartsGenreShareByYears
            :data="analytics?.moviesByRating || []"
          />
        </template>
      </div>
    </template>
  </UContainer>
</template>
