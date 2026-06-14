<script lang="ts" setup>
defineOptions({
  tags: ['barcharts', 'vertical']
})

withDefaults(
  defineProps<{
    showTitle?: boolean
  }>(),
  {
    showTitle: false
  }
)

import type { WatchedEntry } from '~/utils/watched'

const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const { data: watchedRaw } = await useFetch<WatchedEntry[]>('/api/data/watched')

interface YearMonthEntry {
  label: string
  count: number
}

const earliestDate = computed(() => {
  if (!watchedRaw.value?.length) return ''
  let min = watchedRaw.value[0].date
  for (const entry of watchedRaw.value) {
    if (entry.date < min) min = entry.date
  }
  return min
})

const chartData = computed(() => {
  if (!watchedRaw.value) return []
  const skipDate = earliestDate.value

  const map = new Map<string, number>()

  for (const entry of watchedRaw.value) {
    if (entry.date === skipDate) continue
    const key = entry.date.slice(0, 7)
    map.set(key, (map.get(key) ?? 0) + 1)
  }

  const sorted = [...map.entries()].sort(([a], [b]) => a.localeCompare(b))

  const result: YearMonthEntry[] = []

  for (const [key, count] of sorted) {
    const [year, monthNum] = key.split('-')
    const monthName = shortMonths[Number.parseInt(monthNum, 10) - 1]
    result.push({ label: `${year} ${monthName}`, count })
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
</script>

<template>
  <ChartsChartWrapper title="Watched All Years" :show-title="showTitle">
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
    />
  </ChartsChartWrapper>
</template>
