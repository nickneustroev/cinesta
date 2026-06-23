<script lang="ts" setup>
import type { EnrichedMovie } from '~/types/import'

defineOptions({
  tags: ['barcharts', 'withvaluelabel']
})

type DataProps = {
  genre?: string
  count?: number
}

const props = withDefaults(defineProps<{
  data?: EnrichedMovie[]
  items?: DataProps[]
  showTitle?: boolean
}>(), {
  data: () => []
})

const { t } = useI18n()
const selectedMinRating = shallowRef(3)

const minRatingOptions = [
  { label: '0.5', value: 0.5 },
  { label: '1', value: 1 },
  { label: '1.5', value: 1.5 },
  { label: '2', value: 2 },
  { label: '2.5', value: 2.5 },
  { label: '3', value: 3 },
  { label: '3.5', value: 3.5 },
  { label: '4', value: 4 },
  { label: '4.5', value: 4.5 },
  { label: '5', value: 5 }
] as const

const filteredMovies = computed(() => {
  return props.data.filter(movie => movie.userRating >= selectedMinRating.value)
})

const chartData = computed((): DataProps[] => {
  if (props.data.length) {
    const map = new Map<string, number>()

    for (const movie of filteredMovies.value) {
      for (const genre of movie.genres) {
        map.set(genre, (map.get(genre) ?? 0) + 1)
      }
    }

    return Array.from(map.entries())
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)
  }

  if (props.items) return props.items

  return []
})

const chartCategories = computed(() => ({
  count: {
    name: t('charts.movies_count'),
    color: '#6366f1'
  }
}))

const MAX_GENRE_LABEL_LENGTH = 9

function formatGenreLabel(genre: string) {
  const chars = Array.from(genre)

  if (chars.length <= MAX_GENRE_LABEL_LENGTH) {
    return genre
  }

  return `${chars.slice(0, MAX_GENRE_LABEL_LENGTH - 1).join('')}.`
}

const xFormatter = (i: number): string => {
  const genre = chartData.value[i]?.genre

  return genre ? formatGenreLabel(genre) : ''
}
const yFormatter = (tick: number) => tick.toString()

const chartOptions = {
  xAxis: 'genre' as keyof DataProps,
  groupPadding: 0,
  barPadding: 0.2
}
</script>

<template>
  <ChartsChartWrapper
    :title="$t('charts.top_15_genres')"
    :show-title="showTitle"
  >
    <template #header-right>
      <div
        v-if="props.data.length"
        class="flex items-center gap-2"
      >
        <span class="text-sm text-muted whitespace-nowrap">
          {{ $t('charts.min_rating') }}
        </span>
        <USelect
          :items="minRatingOptions"
          value-key="value"
          class="w-full sm:w-24"
          :model-value="selectedMinRating"
          @update:model-value="selectedMinRating = $event"
        />
      </div>
    </template>

    <BarChart
      :data="chartData"
      :categories="chartCategories"
      :height="300"
      :y-axis="['count']"
      :x-num-ticks="chartData.length"
      :radius="4"
      :y-grid-line="true"
      :x-formatter="xFormatter"
      :y-formatter="yFormatter"
      :x-axis-config="{ tickTextFontSize: '14px' }"
      :legend-position="LegendPosition.TopRight"
      v-bind="chartOptions"
    />
  </ChartsChartWrapper>
</template>
