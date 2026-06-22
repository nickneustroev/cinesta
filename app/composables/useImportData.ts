import type { EnrichedImportData } from '~/types/import'
import { get, set, del } from 'idb-keyval'

const STORAGE_KEY = 'letterboxd-import'

interface FetchErrorLike {
  data?: {
    message?: string
  }
  message?: string
}

function getErrorMessage(error: unknown, fallback: string) {
  const fetchError = error as FetchErrorLike
  return fetchError.data?.message || fetchError.message || fallback
}

export function useImportData() {
  const status = ref<'idle' | 'loading' | 'done' | 'error'>('idle')
  const data = shallowRef<EnrichedImportData | null>(null)
  const error = ref<string | null>(null)

  async function load(): Promise<boolean> {
    try {
      const cached = await get<EnrichedImportData>(STORAGE_KEY)
      if (cached) {
        data.value = cached
        status.value = 'done'
        return true
      }
    } catch (cacheError) {
      void cacheError
    }
    return false
  }

  async function process(minRating = 3, tmdbRequired = true) {
    status.value = 'loading'
    error.value = null

    try {
      const result = await $fetch<EnrichedImportData>('/api/process', {
        method: 'POST',
        body: { minRating, tmdbRequired }
      })
      data.value = result
      status.value = 'done'

      try {
        await set(STORAGE_KEY, result)
      } catch (cacheError) {
        void cacheError
      }
    } catch (e: unknown) {
      status.value = 'idle'
      error.value = getErrorMessage(e, 'Import failed')
    }
  }

  async function processFromFile(file: File, minRating = 3) {
    status.value = 'loading'
    error.value = null

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('minRating', String(minRating))
      const result = await $fetch<EnrichedImportData>('/api/upload', {
        method: 'POST',
        body: formData
      })
      data.value = result
      status.value = 'done'

      try {
        await set(STORAGE_KEY, result)
      } catch (cacheError) {
        void cacheError
      }
    } catch (e: unknown) {
      status.value = 'idle'
      error.value = getErrorMessage(e, 'Import failed')
    }
  }

  async function clear() {
    data.value = null
    status.value = 'idle'
    error.value = null
    try {
      await del(STORAGE_KEY)
    } catch (cacheError) {
      void cacheError
    }
  }

  return { data, status, error, load, process, processFromFile, clear }
}
