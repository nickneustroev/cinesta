<script lang="ts" setup>
import { ratingKeys, ratingLookup, groupRatingsByYear, buildRatingCategories } from '~/utils/ratings'
import type { RatingEntry } from '~/types/import'
import type { CountByYearDatum } from '~/utils/home-analytics'

defineOptions({
  tags: ['barcharts', 'stacked']
})

const props = withDefaults(defineProps<{
  data?: RatingEntry[]
  items?: CountByYearDatum[]
  watchedItems?: CountByYearDatum[]
  showTitle?: boolean
}>(), {
  data: () => []
})

type YearMode = 'released' | 'watched'

interface YearData {
  [key: string]: string | number
  year: string
}

const { t } = useI18n()
const selectedMode = shallowRef<YearMode>('released')
const selectedMinYear = shallowRef<string | null>(null)

const yearModeOptions = computed(() => {
  const options = [
    { label: t('charts.count_by_year_released_option'), value: 'released' as const }
  ]

  if (props.watchedItems !== undefined) {
    options.push({ label: t('charts.count_by_year_watched_option'), value: 'watched' as const })
  }

  return options
})

const releasedChartData = computed(() => {
  if (props.items) return props.items
  if (!props.data.length) return []

  const { map, sortedYears } = groupRatingsByYear(props.data)

  return sortedYears.map((year) => {
    const ratingMap = map.get(year)!
    const item: YearData = { year: String(year) }
    for (let i = 0; i < ratingKeys.length; i++) {
      item[ratingKeys[i]!] = ratingMap.get(ratingLookup[i]!) ?? 0
    }
    return item
  })
})

const rawChartData = computed(() => {
  if (selectedMode.value === 'watched') {
    return props.watchedItems ?? []
  }

  return releasedChartData.value
})

const minYearOptions = computed(() => {
  return rawChartData.value
    .map(entry => entry.year as string)
    .filter((year, index, years) => years.indexOf(year) === index)
    .sort((left, right) => left.localeCompare(right))
    .map(year => ({
      label: year,
      value: year
    }))
})

watch(minYearOptions, (options) => {
  if (!options.length) {
    selectedMinYear.value = null
    return
  }

  const hasSelectedYear = selectedMinYear.value !== null
    && options.some(option => option.value === selectedMinYear.value)

  if (!hasSelectedYear) {
    selectedMinYear.value = options.find(option => option.value === '1990')?.value ?? options[0]!.value
  }
}, { immediate: true })

const chartData = computed(() => {
  if (!selectedMinYear.value) {
    return rawChartData.value
  }

  return rawChartData.value.filter(entry => (entry.year as string) >= selectedMinYear.value!)
})

const chartCategories = computed(() => buildRatingCategories())

const xFormatter = (i: number): string => (chartData.value[i]?.year as string ?? '').slice(2)
const yFormatter = (tick: number) => tick.toString()
</script>

<template>
  <ChartsChartWrapper
    :title="$t('charts.rating_stacked_by_year_released')"
    :show-title="showTitle"
  >
    <template #header-right>
      <div class="flex flex-col gap-3 sm:flex-row">
        <USelect
          v-if="yearModeOptions.length > 1"
          :items="yearModeOptions"
          value-key="value"
          class="w-full sm:w-48"
          :model-value="selectedMode"
          @update:model-value="selectedMode = $event"
        />
        <div
          v-if="minYearOptions.length"
          class="flex items-center gap-2"
        >
          <span class="text-sm text-muted whitespace-nowrap">
            {{ $t('charts.starting_from') }}
          </span>
          <USelect
            :items="minYearOptions"
            value-key="value"
            class="w-full sm:w-24"
            :model-value="selectedMinYear"
            @update:model-value="selectedMinYear = $event"
          />
        </div>
      </div>
    </template>

    <BarChart
      :data="chartData"
      :stacked="true"
      :height="300"
      :categories="chartCategories"
      :y-axis="ratingKeys"
      :group-padding="0"
      :bar-padding="0.2"
      :x-num-ticks="chartData.length"
      :radius="4"
      :x-formatter="xFormatter"
      :y-formatter="yFormatter"
      :legend-position="LegendPosition.TopRight"
      :hide-legend="false"
      :y-grid-line="true"
    />
  </ChartsChartWrapper>
</template>
