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

interface WatchedEntry {
  date: string
  title: string
  year: number
  uri: string
}

const now = new Date()
const currentYear = now.getFullYear()
const currentMonth = now.getMonth()

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const { data: watchedRaw } = await useFetch<WatchedEntry[]>('/data/watched.json')

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
  <div
    class="mx-auto max-w-3xl space-y-6 rounded-lg"
    :class="showTitle ? 'p-6' : ''"
  >
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-semibold">
        Watched This Year
      </h3>
    </div>
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
  </div>
</template>
