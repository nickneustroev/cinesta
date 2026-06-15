import type { ImportData } from '../../app/types/import'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const CSV_DIR = join(process.cwd(), 'data', 'letterboxd-nikvkino-2026-06-12-10-11-utc')
const CACHE_PATH = join(process.cwd(), 'data', 'tmdb-cache.json')
const TMDB_BASE = 'https://api.themoviedb.org/3'

const GOOD_RATING_THRESHOLD = 3
const RATE_LIMIT = 30
const BATCH_SIZE = 10

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

let tmdbToken = ''
try {
  const env = readFileSync(join(process.cwd(), '.env'), 'utf-8')
  const line = env.split('\n').find(l => l.trim().startsWith('TMDB_TOKEN='))
  if (line) {
    let val = line.slice(line.indexOf('=') + 1).trim()
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
    tmdbToken = val
  }
} catch { }

function parseCSV(text: string): string[][] {
  const lines: string[][] = []
  let current = ''
  let inQuotes = false
  let row: string[] = []
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]
    if (ch === '"') {
      if (inQuotes && next === '"') { current += '"'; i++ }
      else { inQuotes = !inQuotes }
    } else if (ch === ',' && !inQuotes) {
      row.push(current.trim()); current = ''
    } else if ((ch === '\n' || (ch === '\r' && next === '\n')) && !inQuotes) {
      row.push(current.trim())
      if (row.length > 1 || (row.length === 1 && row[0] !== '')) lines.push(row)
      row = []; current = ''
      if (ch === '\r') i++
    } else { current += ch }
  }
  if (row.length > 0 || current) { row.push(current.trim()); lines.push(row) }
  return lines
}

function parseCSVFile(filename: string): Record<string, string>[] | null {
  const filePath = join(CSV_DIR, filename)
  if (!existsSync(filePath)) return null
  const text = readFileSync(filePath, 'utf-8')
  const rows = parseCSV(text)
  if (rows.length < 1) return []
  const headers = rows[0]
  return rows.slice(1).map(row => {
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h] = row[i] !== undefined ? row[i] : '' })
    return obj
  })
}

function toNumber(val: string | null | undefined): number | null {
  if (val === null || val === '' || val === undefined) return null
  const n = Number(val)
  return Number.isNaN(n) ? null : n
}

let lastRequest = 0

async function tmdbFetch(url: string): Promise<any> {
  const now = Date.now()
  const elapsed = now - lastRequest
  if (elapsed < 1) {
    await sleep(1)
  }
  lastRequest = Date.now()

  const res = await fetch(url, {
    headers: { Authorization: tmdbToken.startsWith('Bearer ') ? tmdbToken : `Bearer ${tmdbToken}` },
  })

  if (res.status === 429) {
    await sleep(2000)
    return tmdbFetch(url)
  }

  if (!res.ok) return null
  return res.json()
}

async function searchMovie(title: string, year: number): Promise<any> {
  const data = await tmdbFetch(
    `${TMDB_BASE}/search/movie?query=${encodeURIComponent(title)}&year=${year}&language=en-US`
  )
  if (!data?.results?.length) return null

  const byPop = (a: any, b: any) => (b.popularity ?? 0) - (a.popularity ?? 0)

  const candidates = data.results.filter((r: any) => {
    const rYear = r.release_date ? parseInt(r.release_date.split('-')[0], 10) : null
    return rYear && Math.abs(rYear - year) <= 1
  })

  const exact = candidates
    .filter((r: any) => r.title.toLowerCase() === title.toLowerCase())
    .sort(byPop)
  if (exact.length) return exact[0]

  if (candidates.length) return candidates.sort(byPop)[0]

  return data.results.sort(byPop)[0]
}

async function getMovieDetails(tmdbId: number) {
  const data = await tmdbFetch(
    `${TMDB_BASE}/movie/${tmdbId}?append_to_response=credits&language=en-US`
  )
  if (!data) return null
  const directors = data.credits?.crew?.filter((c: any) => c.job === 'Director') || []
  return {
    genres: data.genres?.map((g: any) => g.name) || [],
    poster: data.poster_path || null,
    directors: directors.map((d: any) => ({ name: d.name, photo: d.profile_path || null })),
  }
}

export default defineEventHandler(async (): Promise<ImportData> => {
  console.log('[process] ----------------------------------------')
  console.log('[process] подготовка данных началась')

  const rawDiary = parseCSVFile('diary.csv')
  const rawRatings = parseCSVFile('ratings.csv')
  const rawWatched = parseCSVFile('watched.csv')

  const diary: ImportData['diary'] = (rawDiary || []).map(e => ({
    date: e.Date || null,
    title: e.Name || null,
    year: toNumber(e.Year) ?? 0,
    uri: e['Letterboxd URI'] || null,
    rating: toNumber(e.Rating),
    rewatch: e.Rewatch ? e.Rewatch === 'Yes' : null,
    tags: e.Tags ? e.Tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    watchedDate: e['Watched Date'] || null
  }))

  const ratings: ImportData['ratings'] = (rawRatings || []).map(e => ({
    date: e.Date || null,
    title: e.Name || null,
    year: toNumber(e.Year) ?? 0,
    uri: e['Letterboxd URI'] || null,
    rating: toNumber(e.Rating) ?? 0
  }))

  const watched: ImportData['watched'] = (rawWatched || []).map(e => ({
    date: e.Date || null,
    title: e.Name || null,
    year: toNumber(e.Year) ?? 0,
    uri: e['Letterboxd URI'] || null
  }))

  console.log(`[process] csv прочитаны в json: diary ${diary.length}, ratings ${ratings.length}, watched ${watched.length}`)

  const allTitles = new Set<string>()
  for (const entry of ratings) if (entry.title) allTitles.add(entry.title)
  for (const entry of watched) if (entry.title) allTitles.add(entry.title)
  for (const entry of diary) if (entry.title) allTitles.add(entry.title)

  let avgRating: number | null = null
  const sum = ratings.reduce((acc, entry) => acc + entry.rating, 0)
  if (ratings.length > 0) avgRating = Math.round((sum / ratings.length) * 100) / 100

  console.log(`[process] требуется обогащение данных: для ratings с оценкой ≥ ${GOOD_RATING_THRESHOLD}`)

  if (tmdbToken) {
    console.log('[process] доступы к TMDB обнаружены')
  } else {
    console.log('[process] TMDB токен не найден, обогащение пропущено')
  }

  let cache: Record<string, any> = {}
  try { cache = JSON.parse(readFileSync(CACHE_PATH, 'utf-8')) } catch { }

  const toEnrich = ratings.filter(m => m.rating !== null && m.rating >= GOOD_RATING_THRESHOLD)

  let cachedCount = 0
  let fetchCount = 0
  for (const movie of toEnrich) {
    if (cache[movie.uri] && cache[movie.uri]._matched !== undefined) cachedCount++
    else fetchCount++
  }

  let exactMatch = 0
  let fuzzyMatch = 0
  let notFound = 0

  if (fetchCount === 0) {
    console.log(`[process] обогащение данных: ${cachedCount} из кэша`)
  } else {
    console.log(`[process] обогащение данных: ${cachedCount} из кэша, ${fetchCount} через TMDB`)

    const toFetch = toEnrich.filter(m => !(cache[m.uri] && cache[m.uri]._matched !== undefined))
    const batchDelay = Math.ceil((BATCH_SIZE * 2) / RATE_LIMIT * 1000)

    for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
      const start = Date.now()
      const batch = toFetch.slice(i, i + BATCH_SIZE)

      const searches = await Promise.all(
        batch.map(m => searchMovie(m.title, m.year))
      )

      const details = await Promise.all(
        searches.map(s => s ? getMovieDetails(s.id) : null)
      )

      for (let j = 0; j < batch.length; j++) {
        const movie = batch[j]
        const searchResult = searches[j]
        const detail = details[j]

        if (!searchResult || !detail) {
          cache[movie.uri] = {
            uri: movie.uri, title: movie.title, year: movie.year,
            tmdbId: searchResult?.id ?? null, genres: [], poster: null, directors: [], _matched: false,
          }
          notFound++
          continue
        }

        const isExact = searchResult.release_date
          ? parseInt(searchResult.release_date.split('-')[0], 10) === movie.year
            && searchResult.title.toLowerCase() === movie.title.toLowerCase()
          : false

        cache[movie.uri] = {
          uri: movie.uri, title: movie.title, year: movie.year,
          tmdbId: searchResult.id,
          genres: detail.genres,
          poster: detail.poster,
          directors: detail.directors,
          _matched: true,
        }

        if (isExact) exactMatch++
        else fuzzyMatch++
      }

      if (i + BATCH_SIZE < toFetch.length) {
        const elapsed = Date.now() - start
        await sleep(Math.max(0, batchDelay - elapsed))
      }
    }

    console.log(`[process] обогащение завершено: ${exactMatch} точных, ${fuzzyMatch} неточно, ${notFound} не найдено`)
  }

  const enriched: ImportData['enriched'] = []
  for (const movie of toEnrich) {
    const cached = cache[movie.uri]
    if (cached) {
      enriched.push({ ...cached, dateRated: movie.date, userRating: movie.rating })
    }
  }

  try { writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf-8') } catch { }

  console.log('[process] данные готовы, передаем на фронтенд')

  return {
    ratings,
    watched,
    diary,
    stats: {
      totalRatings: ratings.length,
      totalWatched: watched.length,
      totalDiary: diary.length,
      uniqueTitles: allTitles.size,
      avgRating
    },
    enriched
  }
})
