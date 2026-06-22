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

const chartData = computed((): DataProps[] => {
  if (props.items) return props.items
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

const chartCategories = computed(() => ({
  count: {
    name: t('charts.movies_count'),
    color: '#6366f1'
  }
}))

const xFormatter = (i: number): string => chartData.value[i]?.genre ?? ''
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
