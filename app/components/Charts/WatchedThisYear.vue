<script lang="ts" setup>
import { monthNames } from '~/utils/watched'
import type { WatchedEntry } from '~/utils/watched'

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

const now = new Date()
const currentYear = now.getFullYear()
const currentMonth = now.getMonth()

const { data: watchedRaw } = await useFetch<WatchedEntry[]>('/api/data/watched')

const chartData = computed(() => {
  if (!watchedRaw.value) return []

  const counts = new Array(12).fill(0)
  const yearPrefix = String(currentYear)

  for (const entry of watchedRaw.value) {
    if (entry.date.startsWith(yearPrefix)) {
      const monthIndex = Number.parseInt(entry.date.slice(5, 7), 10) - 1
      counts[monthIndex]++
    }
  }

  return counts.slice(0, currentMonth + 1).map((count, i) => ({
    month: monthNames[i],
    count
  }))
})

const chartCategories = computed(() => ({
  count: {
    name: 'Movies Watched',
    color: '#22c55e'
  }
}))

const xFormatter = (i: number): string => chartData.value[i]?.month ?? ''
const yFormatter = (tick: number) => tick.toString()
</script>

<template>
  <ChartsChartWrapper
    title="Watched This Year"
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
    />
  </ChartsChartWrapper>
</template>
