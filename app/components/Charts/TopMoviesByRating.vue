<script setup lang="ts">
import type { EnrichedMovie } from '~/types/import'
import { getRatingColor } from '~/utils/ratings'

const props = defineProps<{
  data: EnrichedMovie[]
  importDate?: string | null
  limit?: number
  title?: string
  showMore?: number
  link?: string
}>()

const visibleCount = ref(props.limit ?? 8)

const cards = computed(() =>
  props.data
    .slice()
    .sort((a, b) => b.userRating - a.userRating)
    .slice(0, visibleCount.value)
)

const hasMore = computed(() => visibleCount.value < props.data.length)

function showMoreCards() {
  visibleCount.value += props.showMore!
}

const ruMonths = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  const monthIndex = Number.parseInt(m!, 10) - 1
  return `${Number.parseInt(d!)} ${ruMonths[monthIndex] ?? ''} ${y}`
}

</script>

<template>
  <div>
    <h3
      v-if="title"
      class="text-2xl font-semibold mb-4"
    >
      {{ title }}
    </h3>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    <SimpleCard
      v-for="(movie, index) in cards"
      :key="index"
      :photo="movie.poster"
      :name="movie.title"
    >
      <template #title>
        {{ movie.title }} <span class="text-muted">({{ movie.year }})</span>
      </template>
      <div class="flex flex-wrap gap-x-3 gap-y-2">
        <p
          class="inline-flex items-center justify-center w-8 h-8 rounded-full text-base font-semibold"
          :style="{ backgroundColor: getRatingColor(movie.userRating) }"
        >
          {{ movie.userRating }}
        </p>
        <UUser
          v-for="d in movie.directors"
          :key="d.name"
          :name="d.name"
          :avatar="d.photo ? { src: `https://image.tmdb.org/t/p/w45${d.photo}` } : undefined"
          :ui="{
            root: 'bg-elevated rounded-full pe-3',
            name: 'font-thin'
          }"
        />
      </div>
      <div class="flex flex-wrap gap-2 mt-3">
        <UBadge
          v-for="genre in movie.genres"
          :key="genre"
          size="md"
          color="primary"
          variant="subtle"
        >
          {{ genre }}
        </UBadge>
      </div>
      <p
        v-if="movie.dateRated"
        class="mt-3 text-sm text-muted"
      >
        {{ movie.dateRated === props.importDate ? 'Посмотрено: до' : 'Посмотрено:' }} {{ formatDate(movie.dateRated) }}
      </p>
    </SimpleCard>
    </div>
    <div
      v-if="showMore && hasMore"
      class="flex justify-center mt-4"
    >
      <UButton
        size="lg"
        color="primary"
        @click="showMoreCards"
      >
        Показать еще {{ showMore }}
      </UButton>
    </div>
    <div
      v-if="link"
      class="flex justify-center mt-8"
    >
      <UButton
        :to="link"
        size="xl"
      >
        Смотреть всех
      </UButton>
    </div>
  </div>
</template>
