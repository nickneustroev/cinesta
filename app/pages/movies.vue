<script setup lang="ts">
const { data, status, load } = useImportData()

onMounted(async () => {
  await load()
})

const tabItems = [
  { label: 'By Ratings', value: 'ratings' },
  { label: 'Last Watched (favorite)', value: 'last-watched' }
]

const route = useRoute()
const router = useRouter()
const activeTab = ref((route.query.tab as string) || 'ratings')

watch(activeTab, (tab) => {
  router.replace({ query: { ...route.query, tab } })
})
</script>

<template>
  <UContainer class="bg-muted border-x border-muted pb-12">
    <div
      v-if="status === 'loading'"
      class="flex flex-col items-center justify-center gap-4 py-20"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="size-8 animate-spin text-muted"
      />
      <p class="text-sm text-muted">
        Идёт подготовка данных...
      </p>
    </div>

    <template v-if="data">
      <UTabs
        v-model="activeTab"
        :items="tabItems"
        size="xl"
        variant="link"
        class="pt-6"
      />

      <div class="flex flex-col gap-y-8 pt-8">
        <ChartsMoviesGrid
          v-if="activeTab === 'ratings'"
          :data="data.enriched"
          :import-date="data.stats.importDate"
          :limit="100"
          :show-more="100"
          title="Top Movies by Rating"
          show-year-filter
        />
        <ChartsMoviesGrid
          v-if="activeTab === 'last-watched'"
          :data="data.enriched"
          :import-date="data.stats.importDate"
          :limit="100"
          :show-more="100"
          sort-by="dateRated"
          title="Last Watched (favorite)"
        />
      </div>
    </template>
  </UContainer>
</template>
