import type { ImportData } from '~/types/import'
import { get, set, del } from 'idb-keyval'

const STORAGE_KEY = 'letterboxd-import'

export function useImportData() {
  const status = ref<'idle' | 'loading' | 'done' | 'error'>('idle')
  const data = shallowRef<ImportData | null>(null)
  const error = ref<string | null>(null)

  async function load(): Promise<boolean> {
    try {
      const cached = await get<ImportData>(STORAGE_KEY)
      if (cached) {
        data.value = cached
        status.value = 'done'
        return true
      }
    } catch {
    }
    return false
  }

  async function process(minRating = 3, tmdbRequired = true) {
    status.value = 'loading'
    error.value = null

    try {
      const result = await $fetch<ImportData>('/api/process', {
        method: 'POST',
        body: { minRating, tmdbRequired }
      })
      data.value = result
      status.value = 'done'

      try {
        await set(STORAGE_KEY, result)
      } catch {
      }
    } catch (e: any) {
      status.value = 'idle'
      error.value = e?.data?.message || e?.message || 'Import failed'
    }
  }

  async function processFromFile(file: File, minRating = 3) {
    status.value = 'loading'
    error.value = null

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('minRating', String(minRating))
      const result = await $fetch<ImportData>('/api/upload', {
        method: 'POST',
        body: formData
      })
      data.value = result
      status.value = 'done'

      try {
        await set(STORAGE_KEY, result)
      } catch {
      }
    } catch (e: any) {
      status.value = 'idle'
      error.value = e?.data?.message || e?.message || 'Import failed'
    }
  }

  async function clear() {
    data.value = null
    status.value = 'idle'
    error.value = null
    try {
      await del(STORAGE_KEY)
    } catch {
    }
  }

  return { data, status, error, load, process, processFromFile, clear }
}
