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
      // IndexedDB unavailable (private browsing etc.), proceed without cache
    }
    return false
  }

  async function process() {
    status.value = 'loading'
    error.value = null

    try {
      const result = await $fetch<ImportData>('/api/process', { method: 'POST' })
      data.value = result
      status.value = 'done'

      try {
        await set(STORAGE_KEY, result)
      } catch {
        // Cache write failed — data still available in memory
      }
    } catch (e) {
      status.value = 'error'
      error.value = e instanceof Error ? e.message : 'Import failed'
    }
  }

  async function clear() {
    data.value = null
    status.value = 'idle'
    error.value = null
    try {
      await del(STORAGE_KEY)
    } catch {
      // ignore
    }
  }

  return { data, status, error, load, process, clear }
}
