<script lang="ts" setup>
import type { EnrichedMovie } from '~/types/import'

defineOptions({
  tags: ['areacharts', 'stacked']
})

const props = defineProps<{
  data: EnrichedMovie[]
  showTitle?: boolean
}>()

const GENRE_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#eab308', '#a855f7',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
  '#06b6d4', '#d946ef', '#0ea5e9', '#10b981', '#f59e0b',
  '#8b5cf6', '#65a30d', '#0d9488', '#e11d48', '#0284c7',
]

const allGenres = computed(() => {
  if (!props.data.length) return []
  const set = new Set<string>()
  for (const movie of props.data) {
    for (const genre of movie.genres) {
      set.add(genre)
    }
  }
  return Array.from(set).sort()
})

const chartData = computed(() => {
  if (!props.data.length) return []

  const genres = allGenres.value
  const genreSet = new Set(genres)

  const yearMap = new Map<number, Map<string, number>>()
  for (const movie of props.data) {
    if (movie.year < 1990) continue
    if (!yearMap.has(movie.year)) yearMap.set(movie.year, new Map())
    const gm = yearMap.get(movie.year)!
    for (const genre of movie.genres) {
      if (genreSet.has(genre)) {
        gm.set(genre, (gm.get(genre) ?? 0) + 1)
      }
    }
  }

  const sortedYears = Array.from(yearMap.keys()).sort((a, b) => a - b)

  return sortedYears.map((year) => {
    const gm = yearMap.get(year)!
    let total = 0
    for (const c of gm.values()) total += c
    if (!total) return null

    const pcts = genres.map(g => ((gm.get(g) ?? 0) / total) * 100)
    const rounded = pcts.map(v => Math.round(v))
    const diff = 100 - rounded.reduce((s, v) => s + v, 0)
    if (diff !== 0) {
      const remainders = pcts.map((v, i) => ({ i, r: v - Math.floor(v) }))
      remainders.sort((a, b) => b.r - a.r)
      for (let j = 0; j < Math.abs(diff); j++) {
        rounded[remainders[j % remainders.length].i] += Math.sign(diff)
      }
    }

    const item: Record<string, string | number> = { year: String(year) }
    for (let i = 0; i < genres.length; i++) {
      item[genres[i]] = rounded[i]
    }
    return item
  }).filter(Boolean) as Record<string, string | number>[]
})

const chartCategories = computed(() => {
  const cats: Record<string, { name: string; color: string }> = {}
  allGenres.value.forEach((g, i) => {
    cats[g] = { name: g, color: GENRE_COLORS[i % GENRE_COLORS.length] }
  })
  return cats
})

const xFormatter = (i: number): string => (chartData.value[i]?.year as string ?? '').slice(2)
const yFormatter = (value: number): string => `${value}%`
</script>

<template>
  <ChartsChartWrapper
    title="Genre Share By Years"
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
