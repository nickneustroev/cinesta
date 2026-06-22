import type { Ref } from 'vue'
import type { EnrichedImportData } from '~/types/import'
import { buildHomeAnalytics } from '~/utils/home-analytics'

interface UseHomeAnalyticsOptions {
  includeCharts?: boolean
}

export function useHomeAnalytics(data: Ref<EnrichedImportData | null>, options: UseHomeAnalyticsOptions = {}) {
  const { t } = useI18n()

  return computed(() => data.value
    ? buildHomeAnalytics(data.value, {
        includeCharts: options.includeCharts,
        directorPointsLabel: t('directors_grid.points_label'),
        directorHighestLabel: t('directors_grid.highest_label')
      })
    : null
  )
}
