import type { ImportData } from '../../app/types/import'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const CSV_DIR = join(process.cwd(), 'data', 'letterboxd-nikvkino-2026-06-12-10-11-utc')
const CACHE_PATH = join(process.cwd(), 'data', 'tmdb-cache.json')
const TMDB_BASE = 'https://api.themoviedb.org/3'

const ENRICH_LIMIT = 50
const RATE_LIMIT = 30
const MIN_INTERVAL = 1000 / RATE_LIMIT

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

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function tmdbFetch(url: string): Promise<any> {
  const now = Date.now()
  const elapsed = now - lastRequest
  if (elapsed < MIN_INTERVAL) {
    await sleep(MIN_INTERVAL - elapsed)
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

  const exact = data.results.find((r: any) => {
    const rYear = r.release_date ? parseInt(r.release_date.split('-')[0], 10) : null
    return rYear === year && r.title.toLowerCase() === title.toLowerCase()
  })
  if (exact) return exact

  const yearMatch = data.results.find((r: any) => {
    const rYear = r.release_date ? parseInt(r.release_date.split('-')[0], 10) : null
    return rYear && Math.abs(rYear - year) <= 1
  })
  if (yearMatch) return yearMatch

  return data.results[0]
}

async function getMovieDetails(tmdbId: number) {
  const data = await tmdbFetch(
    `${TMDB_BASE}/movie/${tmdbId}?append_to_response=credits&language=en-US`
  )
  if (!data) return null
  return {
    genres: data.genres?.map((g: any) => g.name) || [],
    poster: data.poster_path || null,
    director: data.credits?.crew?.find((c: any) => c.job === 'Director')?.name || null,
  }
}

export default defineEventHandler(async (): Promise<ImportData> => {
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

  const allTitles = new Set<string>()
  for (const entry of ratings) if (entry.title) allTitles.add(entry.title)
  for (const entry of watched) if (entry.title) allTitles.add(entry.title)
  for (const entry of diary) if (entry.title) allTitles.add(entry.title)

  let avgRating: number | null = null
  const sum = ratings.reduce((acc, entry) => acc + entry.rating, 0)
  if (ratings.length > 0) avgRating = Math.round((sum / ratings.length) * 100) / 100

  let cache: Record<string, any> = {}
  try { cache = JSON.parse(readFileSync(CACHE_PATH, 'utf-8')) } catch { }

  const toEnrich = ratings.slice(0, ENRICH_LIMIT)

  for (const movie of toEnrich) {
    if (cache[movie.uri] && cache[movie.uri]._matched !== undefined) continue

    const searchResult = await searchMovie(movie.title, movie.year)
    if (!searchResult) {
      cache[movie.uri] = {
        uri: movie.uri, title: movie.title, year: movie.year,
        tmdbId: null, genres: [], poster: null, director: null, _matched: false,
      }
      continue
    }

    const details = await getMovieDetails(searchResult.id)
    if (!details) {
      cache[movie.uri] = {
        uri: movie.uri, title: movie.title, year: movie.year,
        tmdbId: searchResult.id, genres: [], poster: null, director: null, _matched: false,
      }
      continue
    }

    cache[movie.uri] = {
      uri: movie.uri, title: movie.title, year: movie.year,
      tmdbId: searchResult.id,
      genres: details.genres,
      poster: details.poster,
      director: details.director,
      _matched: true,
    }
  }

  const enriched: ImportData['enriched'] = []
  for (const movie of toEnrich) {
    if (cache[movie.uri]) enriched.push(cache[movie.uri])
  }

  try { writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf-8') } catch { }

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
