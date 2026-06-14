<script lang="ts" setup>
import { ratingKeys, ratingLookup, groupRatingsByYear, buildRatingCategories } from '~/utils/ratings'
import type { RatingEntry } from '~/types/import'

defineOptions({
  tags: ['barcharts', 'stacked']
})

const props = defineProps<{
  data: RatingEntry[]
  showTitle?: boolean
}>()

interface YearData {
  [key: string]: string | number
  year: string
}

const chartData = computed(() => {
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

const chartCategories = computed(() => buildRatingCategories())

const xFormatter = (i: number): string => (chartData.value[i]?.year as string ?? '').slice(2)
const yFormatter = (tick: number) => tick.toString()
</script>

<template>
  <ChartsChartWrapper
    title="Rating Stacked By Years"
    :show-title="showTitle"
  >
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
