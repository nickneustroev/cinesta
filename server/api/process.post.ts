import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import type { ImportData } from '~/types/import'
import AdmZip from 'adm-zip'

const CACHE_PATH = join(process.cwd(), 'data', 'tmdb-cache.json')
const DEMO_ZIP_PATH = join(process.cwd(), 'public', 'demo.zip')

export default defineEventHandler(async (event): Promise<ImportData> => {
  const locale = getCookie(event, 'i18n_lang') || 'en-US'
  const body = await readBody<{ minRating?: number, tmdbRequired?: boolean }>(event)
  const minRating = body?.minRating || 3
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
      watched: readZipCSV('watched.csv')
    },
    CACHE_PATH,
    locale,
    minRating,
    tmdbRequired
  )
})
