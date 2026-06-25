import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import type { EnrichedImportData } from '~/types/import'
import AdmZip from 'adm-zip'

const DEMO_ZIP_PATH = join(process.cwd(), 'public', 'demo.zip')
const CACHE_PATHS = {
  runtimePath: join(process.cwd(), 'data', 'tmdb-cache.runtime.json'),
  snapshotPath: join(process.cwd(), 'public', 'tmdb-cache.json')
}

export default defineEventHandler(async (event): Promise<EnrichedImportData> => {
  const locale = getCookie(event, 'i18n_lang') || 'en-US'
  const body = await readBody<{ minRating?: number | null, tmdbRequired?: boolean }>(event)
  const minRating = typeof body?.minRating === 'number' && Number.isFinite(body.minRating)
    ? body.minRating
    : undefined
  const tmdbRequired = body?.tmdbRequired ?? true
  const zipData = readFileSync(DEMO_ZIP_PATH)
  const zip = new AdmZip(Buffer.from(zipData))
  const entries = zip.getEntries()

  function readZipCSV(filename: string): string {
    const entry = entries.find(e => e.entryName === filename)
    return entry ? entry.getData().toString('utf-8') : ''
  }

  return processCSVData(
    {
      diary: readZipCSV('diary.csv'),
      ratings: readZipCSV('ratings.csv'),
      watched: ''
    },
    CACHE_PATHS,
    locale,
    minRating,
    tmdbRequired,
    'demo'
  )
})
