import { join } from 'node:path'
import type { ImportData } from '~/types/import'
import AdmZip from 'adm-zip'

const CACHE_PATH = join(process.cwd(), 'data', 'tmdb-cache.json')
const MAX_SIZE = 2 * 1024 * 1024

const REQUIRED_FILES = ['diary.csv', 'ratings.csv', 'watched.csv']

export default defineEventHandler(async (event): Promise<ImportData> => {
  const locale = getCookie(event, 'i18n_lang') || 'en-US'
  const formData = await readMultipartFormData(event)
  if (!formData || formData.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No file uploaded' })
  }

  const minRatingField = formData.find(f => f.name === 'minRating')
  const minRating = minRatingField ? parseInt(minRatingField.data.toString('utf-8'), 10) || 3 : 3

  const fileField = formData.find(f => f.name === 'file')
  if (!fileField || !fileField.filename) {
    throw createError({ statusCode: 400, statusMessage: 'Missing file field' })
  }

  if (fileField.data.length > MAX_SIZE) {
    throw createError({ statusCode: 400, statusMessage: `File exceeds 2MB limit (${(fileField.data.length / 1024 / 1024).toFixed(1)}MB)` })
  }

  const filename = fileField.filename.toLowerCase()
  if (!filename.endsWith('.zip')) {
    throw createError({ statusCode: 400, statusMessage: 'Only .zip files are accepted' })
  }

  let zip: AdmZip
  try {
    zip = new AdmZip(Buffer.from(fileField.data))
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid zip file' })
  }

  const zipEntries = zip.getEntries()
  const csvFiles: Record<string, string> = {}

  for (const required of REQUIRED_FILES) {
    const entry = zipEntries.find((e) => {
      const name = e.entryName.replace(/\\/g, '/')
      return name === required || name.endsWith('/' + required)
    })
    if (!entry) {
      throw createError({ statusCode: 400, statusMessage: `Missing required file: ${required}` })
    }
    csvFiles[required] = entry.getData().toString('utf-8')
  }

  return processCSVData(
    {
      diary: csvFiles['diary.csv']!,
      ratings: csvFiles['ratings.csv']!,
      watched: csvFiles['watched.csv']!
    },
    CACHE_PATH,
    locale,
    minRating
  )
})
