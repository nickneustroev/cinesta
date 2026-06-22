<script lang="ts" setup>
import type { WatchedEntry } from '~/types/import'
import type { YearWatchedDatum } from '~/utils/home-analytics'

defineOptions({
  tags: ['barcharts', 'vertical']
})

const props = withDefaults(defineProps<{
  data?: WatchedEntry[]
  items?: YearWatchedDatum[]
  showTitle?: boolean
}>(), {
  data: () => []
})

interface YearEntry {
  label: string
  count: number
}

const chartData = computed(() => {
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

const chartCategories = computed(() => ({
  count: {
    name: 'Movies Watched',
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
    :title="$t('charts.all_movies_count_by_year_watched')"
    :show-title="showTitle"
  >
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
