<script lang="ts" setup>
import type { EnrichedMovie } from '~/types/import'

defineOptions({
  tags: ['barcharts', 'vertical']
})

const props = defineProps<{
  data: EnrichedMovie[]
  showTitle?: boolean
}>()

const BOOST = 1

const chartData = computed(() => {
  if (!props.data.length) return []

  const pointsMap = new Map<string, number>()
  for (const movie of props.data) {
    for (const d of movie.directors) {
      const current = pointsMap.get(d.name) ?? 0
      pointsMap.set(d.name, current + (movie.userRating * BOOST) ** 4)
    }
  }

  return Array.from(pointsMap.entries())
    .map(([director, points]) => ({
      director,
      points
    }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 30)
    .reverse()
})

const xAxisConfig = {
  tickTextFontSize: '12px'
} as const

const yAxisConfig = {} as const

const chartCategories = computed(() => ({
  points: {
    name: 'Points',
    color: '#6366f1'
  }
}))

const xFormatter = (tick: number) => String(tick)
const yFormatter = (_tick: string, i?: number) => {
  const idx = i ?? 0
  return chartData.value[idx]?.director ?? String(_tick)
}
</script>

<template>
  <ChartsChartWrapper
    title="Top-30 directors by points (from favorite)"
    :show-title="showTitle"
  >
    <BarChart
      :data="chartData"
      orientation="horizontal"
      :height="600"
      :categories="chartCategories"
      :y-axis="['points']"
      :y-num-ticks="chartData.length"
      :radius="4"
      :x-grid-line="true"
      :x-num-ticks="10"
      :x-formatter="xFormatter"
      :x-axis-config="xAxisConfig"
      :y-formatter="yFormatter"
      :y-axis-config="yAxisConfig"
      :legend-position="LegendPosition.TopRight"
    />
  </ChartsChartWrapper>
</template>
