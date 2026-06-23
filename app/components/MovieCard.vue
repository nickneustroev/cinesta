<script setup lang="ts">
import type { EnrichedMovie } from '~/types/import'
import { getRatingColor } from '~/utils/ratings'

const props = defineProps<{
  movie: EnrichedMovie
  importDate?: string | null
}>()

const { locale } = useI18n()

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  const date = new Date(Number(y!), Number(m!) - 1, Number(d!))
  const month = date.toLocaleDateString(locale.value, { month: 'short' }).replace(/\.$/, '')
  return `${Number(d!)} ${month} ${y!}`
}

const watchedDates = computed(() => {
  if (props.movie.watchedDates?.length) {
    return props.movie.watchedDates
  }

  return props.movie.dateRated ? [props.movie.dateRated] : []
})

const formattedWatchedDates = computed(() => watchedDates.value.map(formatDate))
</script>

<template>
  <SimpleCard
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
        :ui="{
          root: 'bg-elevated rounded-full pe-3',
          name: 'font-thin'
        }"
      >
        <template #avatar>
          <img
            v-if="d.photo"
            :src="`https://image.tmdb.org/t/p/w45${d.photo}`"
            :alt="d.name"
            class="size-8 shrink-0 rounded-full object-cover"
          >
          <span
            v-else
            aria-hidden="true"
            class="size-8 shrink-0 rounded-full bg-accented"
          />
        </template>
      </UUser>
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
    <div
      v-if="formattedWatchedDates.length"
      class="mt-3 flex flex-wrap items-center gap-2"
    >
      <UIcon
        name="i-lucide-eye"
        class="size-4 text-muted shrink-0"
      />
      <UBadge
        v-for="watchedDate in formattedWatchedDates"
        :key="watchedDate"
        size="md"
        color="secondary"
        variant="subtle"
      >
        {{ watchedDate }}
      </UBadge>
    </div>
  </SimpleCard>
</template>
