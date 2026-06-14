<script lang="ts" setup>
import { ratingKeys, ratingLookup, groupRatingsByYear, buildRatingCategories } from '~/utils/ratings'
import type { RatingEntry } from '~/utils/ratings'

defineOptions({
  tags: ['areacharts', 'stacked']
})

withDefaults(
  defineProps<{
    showTitle?: boolean
  }>(),
  {
    showTitle: false
  }
)

const { data: ratingsRaw } = await useFetch<RatingEntry[]>('/api/data/ratings')

interface YearData {
  [key: string]: string | number
  year: string
}

const chartData = computed(() => {
  if (!ratingsRaw.value) return []

  const { map, sortedYears } = groupRatingsByYear(ratingsRaw.value)

  return sortedYears.map((year) => {
    const ratingMap = map.get(year)!
    let total = 0
    for (const r of ratingLookup) total += ratingMap.get(r) ?? 0
    if (!total) return { year: String(year), ...Object.fromEntries(ratingKeys.map(k => [k, 0])) } as YearData

    const pcts = ratingLookup.map(r => (ratingMap.get(r) ?? 0) / total * 100)
    const rounded = pcts.map(v => Math.round(v))
    const diff = 100 - rounded.reduce((s, v) => s + v, 0)
    if (diff !== 0) {
      const remainders = pcts.map((v, i) => ({ i, r: v - Math.floor(v) }))
      remainders.sort((a, b) => b.r - a.r)
      for (let j = 0; j < Math.abs(diff); j++) {
        rounded[remainders[j % remainders.length].i] += Math.sign(diff)
      }
    }

    const item: YearData = { year: String(year) }
    for (let i = 0; i < ratingKeys.length; i++) {
      item[ratingKeys[i]] = rounded[i]
    }
    return item
  })
})

const chartCategories = computed(() => buildRatingCategories())

const xFormatter = (i: number): string => (chartData.value[i]?.year as string ?? '').slice(2)
const yFormatter = (value: number): string => `${value}%`
</script>

<template>
  <ChartsChartWrapper
    title="Rating Share By Years"
    :show-title="showTitle"
  >
    <AreaChart
      :data="chartData"
      :stacked="true"
      :height="300"
      :categories="chartCategories"
      :x-num-ticks="chartData.length"
      :x-formatter="xFormatter"
      :y-formatter="yFormatter"
      :curve-type="CurveType.MonotoneX"
      :legend-position="LegendPosition.TopRight"
      :hide-legend="false"
      :y-grid-line="true"
      :x-grid-line="false"
    />
  </ChartsChartWrapper>
</template>
