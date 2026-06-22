<script lang="ts" setup>
import type { WatchedEntry } from '~/types/import'
import type { YearWatchedDatum } from '~/utils/home-analytics'

defineOptions({
  tags: ['barcharts', 'vertical']
})

const props = withDefaults(defineProps<{
  data?: WatchedEntry[]
  items?: YearWatchedDatum[]
  releaseItems?: YearWatchedDatum[]
  showTitle?: boolean
}>(), {
  data: () => []
})

type YearMode = 'watched' | 'released'

interface YearEntry {
  label: string
  count: number
}

const { t } = useI18n()
const selectedMode = shallowRef<YearMode>('watched')
const selectedMinYear = shallowRef<string | null>(null)

const yearModeOptions = computed(() => {
  const options = [
    { label: t('charts.count_by_year_watched_option'), value: 'watched' as const }
  ]

  if (props.releaseItems !== undefined) {
    options.push({ label: t('charts.count_by_year_released_option'), value: 'released' as const })
  }

  return options
})

const chartTitle = computed(() => t('charts.all_movies_count_by_year_watched'))

const watchedChartData = computed(() => {
  if (props.items) return props.items
  if (!props.data.length) return []

  const map = new Map<string, number>()

  for (const entry of props.data) {
    const key = entry.date.slice(0, 4)
    map.set(key, (map.get(key) ?? 0) + 1)
  }

  const sorted = [...map.entries()].sort(([a], [b]) => a.localeCompare(b))

  const result: YearEntry[] = []

  for (const [label, count] of sorted) {
    result.push({ label, count })
  }

  return result
})

const rawChartData = computed(() => {
  if (selectedMode.value === 'released') {
    return props.releaseItems ?? []
  }

  return watchedChartData.value
})

const minYearOptions = computed(() => {
  return rawChartData.value
    .map(entry => entry.label)
    .filter((label, index, labels) => labels.indexOf(label) === index)
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
    selectedMinYear.value = options[0]!.value
  }
}, { immediate: true })

const chartData = computed(() => {
  if (!selectedMinYear.value) {
    return rawChartData.value
  }

  return rawChartData.value.filter(entry => entry.label >= selectedMinYear.value!)
})

const chartCategories = computed(() => ({
  count: {
    name: t('charts.movies_count'),
    color: '#22c55e'
  }
}))

const xFormatter = (i: number): string => chartData.value[i]?.label ?? ''
const yFormatter = (tick: number) => tick.toString()

const chartOptions = {
  xAxis: 'label' as keyof YearEntry,
  groupPadding: 0,
  barPadding: 0.2
}
</script>

<template>
  <ChartsChartWrapper
    :title="chartTitle"
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
      :height="300"
      :categories="chartCategories"
      :y-axis="['count']"
      :x-num-ticks="chartData.length"
      :radius="4"
      :y-grid-line="true"
      :x-formatter="xFormatter"
      :y-formatter="yFormatter"
      :legend-position="LegendPosition.TopRight"
      v-bind="chartOptions"
    />
  </ChartsChartWrapper>
</template>
