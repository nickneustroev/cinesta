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

  const ratingMap = new Map<string, number[]>()
  for (const movie of props.data) {
    if (!movie.director) continue
    const ratings = ratingMap.get(movie.director) ?? []
    ratings.push(movie.userRating)
    ratingMap.set(movie.director, ratings)
  }

  return Array.from(ratingMap.entries())
    .map(([director, ratings]) => ({
      director,
      avgRating: ratings.reduce((s, r) => s + r, 0) / ratings.length
    }))
    .sort((a, b) => b.avgRating - a.avgRating)
    .slice(0, 30)
    .reverse()
})

const xAxisConfig = {
  tickTextFontSize: '12px'
} as const

const yAxisConfig = {} as const

const chartCategories = computed(() => ({
  avgRating: {
    name: 'Avg Rating',
    color: '#6366f1'
  }
}))

const xFormatter = (tick: number) => tick.toFixed(2)
const yFormatter = (_tick: string, i?: number) => {
  const idx = i ?? 0
  return chartData.value[idx]?.director ?? String(_tick)
}
</script>

<template>
  <ChartsChartWrapper
    title="Top-15 directors by avg rating w/out min (from favorite)"
    :show-title="showTitle"
  >
    <BarChart
      :data="chartData"
      orientation="horizontal"
      :height="500"
      :categories="chartCategories"
      :y-axis="['avgRating']"
      :y-num-ticks="chartData.length"
      :radius="4"
      :x-grid-line="true"
      :x-formatter="xFormatter"
      :x-axis-config="xAxisConfig"
      :y-formatter="yFormatter"
      :y-axis-config="yAxisConfig"
      :legend-position="LegendPosition.TopRight"
    />
  </ChartsChartWrapper>
</template>
