import { join } from 'node:path'
import type { EnrichedImportData } from '~/types/import'
import { withUploadImportLock } from '../utils/import-lock'
import AdmZip from 'adm-zip'

const MAX_SIZE = 2 * 1024 * 1024
const CACHE_PATHS = {
  runtimePath: join(process.cwd(), 'data', 'tmdb-cache.runtime.json'),
  snapshotPath: join(process.cwd(), 'public', 'tmdb-cache.json')
}

const REQUIRED_FILES = ['diary.csv', 'ratings.csv']

function createUploadError(message: string) {
  return createError({
    statusCode: 400,
    statusMessage: 'Bad Request',
    message,
    data: { message }
  })
}

export default defineEventHandler(async (event): Promise<EnrichedImportData> => {
  const locale = getCookie(event, 'i18n_lang') || 'en-US'
  return withUploadImportLock(locale, async () => {
    const formData = await readMultipartFormData(event)
    if (!formData || formData.length === 0) {
      throw createUploadError('No file uploaded')
    }

    const minRatingField = formData.find(f => f.name === 'minRating')
    const parsedMinRating = minRatingField ? Number(minRatingField.data.toString('utf-8').trim()) : Number.NaN
    const minRating = Number.isFinite(parsedMinRating) ? parsedMinRating : undefined

    const fileField = formData.find(f => f.name === 'file')
    if (!fileField || !fileField.filename) {
      throw createUploadError('Missing file field')
    }

    if (fileField.data.length > MAX_SIZE) {
      throw createUploadError(`File exceeds 2MB limit (${(fileField.data.length / 1024 / 1024).toFixed(1)}MB)`)
    }

    const filename = fileField.filename.toLowerCase()
    if (!filename.endsWith('.zip')) {
      throw createUploadError('Only .zip files are accepted')
    }

    let zip: AdmZip
    try {
      zip = new AdmZip(Buffer.from(fileField.data))
    } catch {
      throw createUploadError('Invalid zip file')
    }

    const zipEntries = zip.getEntries()
    const csvFiles: Record<string, string> = {}

    for (const required of REQUIRED_FILES) {
      const entry = zipEntries.find((e) => {
        const name = e.entryName.replace(/\\/g, '/')
        return name === required || name.endsWith('/' + required)
      })
      if (!entry) {
        throw createUploadError(`Missing required file: ${required}`)
      }
      csvFiles[required] = entry.getData().toString('utf-8')
    }

    return processCSVData(
      {
        diary: csvFiles['diary.csv']!,
        ratings: csvFiles['ratings.csv']!,
        watched: ''
      },
      CACHE_PATHS,
      locale,
      minRating
    )
  })
})
