<script lang="ts" setup>
import type { EnrichedMovie } from '~/types/import'

defineOptions({
  tags: ['barcharts', 'vertical']
})

const props = defineProps<{
  data: EnrichedMovie[]
  showTitle?: boolean
}>()

const chartData = computed(() => {
  if (!props.data.length) return []

  const map = new Map<string, number>()

  for (const movie of props.data) {
    for (const genre of movie.genres) {
      map.set(genre, (map.get(genre) ?? 0) + 1)
    }
  }

  return Array.from(map.entries())
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)
})

const xAxisConfig = {
  tickTextFontSize: '12px',
} as const

const chartCategories = computed(() => ({
  count: {
    name: 'Movies',
    color: '#6366f1'
  }
}))

const xFormatter = (i: number): string => chartData.value[i]?.genre ?? ''
const yFormatter = (tick: number) => tick.toString()
</script>

<template>
  <ChartsChartWrapper title="Favorites By Top-15 Genres" :show-title="showTitle">
    <BarChart
      :data="chartData"
      :height="300"
      :categories="chartCategories"
      :y-axis="['count']"
      :x-num-ticks="chartData.length"
      :radius="4"
      :y-grid-line="true"
      :x-formatter="xFormatter"
      :x-axis-config="xAxisConfig"
      :y-formatter="yFormatter"
      :legend-position="LegendPosition.TopRight"
    />
  </ChartsChartWrapper>
</template>
