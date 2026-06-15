<script setup lang="ts">
const { data, status, load } = useImportData()

onMounted(async () => {
  await load()
})
</script>

<template>
  <UContainer>
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
      <ChartsTop20DirectorsByPoints
        :data="data.enriched"
        title="Top-100 Directors by Points"
        :limit="100"
      />
    </template>
  </UContainer>
</template>
