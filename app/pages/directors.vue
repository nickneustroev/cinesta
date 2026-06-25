<script setup lang="ts">
const { data, status, load } = useImportData()
const analytics = useHomeAnalytics(data, { includeCharts: false })
const { t } = useI18n()
const initialLoading = ref(true)

onMounted(async () => {
  await load()
  initialLoading.value = false
})

const tabItems = computed(() => [
  { label: t('pages.directors.tabs.points'), value: 'points' },
  { label: t('pages.directors.tabs.highest'), value: 'highest' }
])
const tabsOrientation = useTabsOrientation()

const route = useRoute()
const router = useRouter()
const activeTab = ref((route.query.tab as string) || 'points')

watch(activeTab, (tab) => {
  router.replace({ query: { ...route.query, tab } })
})
</script>

<template>
  <UContainer
    class="bg-muted border-x border-muted pb-12"
    :class="!data ? 'flex flex-col min-h-[calc(100dvh-var(--ui-header-height,64px))]' : ''"
  >
    <div
      v-if="initialLoading || status === 'loading'"
      class="flex flex-col items-center justify-center gap-4 py-20 flex-1"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="size-8 animate-spin text-muted"
      />
      <p
        v-if="status === 'loading'"
        class="text-sm text-muted"
      >
        {{ $t('pages.directors.loading') }}
      </p>
    </div>

    <template v-if="data && !initialLoading">
      <UTabs
        v-model="activeTab"
        :items="tabItems"
        :orientation="tabsOrientation"
        size="xl"
        variant="link"
        class="pt-6"
      />

      <div class="flex flex-col gap-y-8 pt-8">
        <DirectorsGrid
          v-if="activeTab === 'points'"
          :cards-data="analytics?.directorsByPoints"
          :title="$t('pages.directors.title.points')"
          :subtitle="$t('directors_grid.points_explanation')"
          :limit="100"
          :show-more="100"
        />
        <DirectorsGrid
          v-if="activeTab === 'highest'"
          :cards-data="analytics?.directorsByHighest"
          :title="$t('pages.directors.title.highest')"
          :limit="100"
          :show-more="100"
        />
      </div>
    </template>
  </UContainer>
</template>
