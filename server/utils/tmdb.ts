import { createError } from 'h3'
import { csvToObjects, toNumber } from './csv'
import { dirname } from 'node:path'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { ImportData } from '~/types/import'

const TMDB_BASE = 'https://api.themoviedb.org/3'
const RATE_LIMIT = 30
const BATCH_SIZE = 10

let lastRequest = 0

interface TmdbMovieSearchResult {
  id: number
  title: string
  release_date?: string
  popularity?: number
}

interface TmdbSearchResponse {
  results?: TmdbMovieSearchResult[]
}

interface TmdbGenre {
  name: string
}

interface TmdbCrewMember {
  job?: string
  name: string
  profile_path?: string | null
}

interface TmdbMovieDetailsResponse {
  title?: string | null
  genres?: TmdbGenre[]
  poster_path?: string | null
  credits?: {
    crew?: TmdbCrewMember[]
  }
}

interface MovieDetails {
  title: string | null
  genres: string[]
  poster: string | null
  directors: {
    name: string
    photo: string | null
  }[]
}

type CachedMovie = Omit<ImportData['enriched'][number], 'dateRated' | 'userRating'>

interface CachePaths {
  runtimePath: string
  snapshotPath: string
}

const IS_DEV = import.meta.dev

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function readCacheFile(path: string): Record<string, CachedMovie> | null {
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as Record<string, CachedMovie>
  } catch {
    return null
  }
}

export function loadOrCreateCache(paths: CachePaths): Record<string, CachedMovie> {
  if (IS_DEV) {
    return readCacheFile(paths.runtimePath) ?? readCacheFile(paths.snapshotPath) ?? {}
  }

  return readCacheFile(paths.snapshotPath) ?? {}
}

export function saveCache(paths: CachePaths, cache: Record<string, CachedMovie>) {
  if (!IS_DEV) {
    return
  }

  try {
    mkdirSync(dirname(paths.runtimePath), { recursive: true })
    writeFileSync(paths.runtimePath, JSON.stringify(cache, null, 2), 'utf-8')
  } catch (cacheError) {
    void cacheError
  }
}

async function tmdbFetch<T>(url: string, token: string): Promise<T | null> {
  const now = Date.now()
  const elapsed = now - lastRequest
  if (elapsed < 1) {
    await sleep(1)
  }
  lastRequest = Date.now()

  let res: Response
  try {
    res = await fetch(url, {
      headers: { Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` }
    })
  } catch (e) {
    console.log('[tmdb] ошибка сети:', e)
    return null
  }

  if (res.status === 429) {
    console.log('[tmdb] rate limit, повтор через 2с')
    await sleep(2000)
    return tmdbFetch(url, token)
  }

  if (!res.ok) {
    console.log('[tmdb] ошибка запроса', res.status, res.statusText)
    return null
  }
  return await res.json() as T
}

async function searchMovie(title: string, year: number, token: string, locale: string): Promise<TmdbMovieSearchResult | null> {
  const data = await tmdbFetch<TmdbSearchResponse>(
    `${TMDB_BASE}/search/movie?query=${encodeURIComponent(title)}&year=${year}&language=${locale}`,
    token
  )
  if (!data?.results?.length) return null

  const byPop = (a: TmdbMovieSearchResult, b: TmdbMovieSearchResult) => (b.popularity ?? 0) - (a.popularity ?? 0)

  const candidates = data.results.filter((r) => {
    const rYear = r.release_date ? parseInt(r.release_date.split('-')[0] ?? '', 10) : null
    return rYear && Math.abs(rYear - year) <= 1
  })

  const exact = candidates
    .filter(r => r.title.toLowerCase() === title.toLowerCase())
    .sort(byPop)
  if (exact.length) return exact[0] ?? null

  if (candidates.length) return candidates.sort(byPop)[0] ?? null

  return data.results.sort(byPop)[0] ?? null
}

async function getMovieDetails(tmdbId: number, token: string, locale: string): Promise<MovieDetails | null> {
  const data = await tmdbFetch<TmdbMovieDetailsResponse>(
    `${TMDB_BASE}/movie/${tmdbId}?append_to_response=credits&language=${locale}`,
    token
  )
  if (!data) return null
  const directors = data.credits?.crew?.filter(c => c.job === 'Director') || []
  return {
    title: data.title || null,
    genres: data.genres?.map(g => g.name) || [],
    poster: data.poster_path || null,
    directors: directors.map(d => ({ name: d.name, photo: d.profile_path || null }))
  }
}

function cacheKey(uri: string, locale: string): string {
  return `${uri}:${locale}`
}

export async function processCSVData(
  csvFiles: { diary: string, ratings: string, watched: string },
  cachePaths: CachePaths,
  locale = 'en-US',
  minRating = 3,
  tmdbRequired = true
): Promise<ImportData> {
  const { tmdbToken } = useRuntimeConfig()
  console.log('[process] подготовка данных началась')

  // Проверка подключения к TMDB
  let tmdbAvailable = false
  if (tmdbToken) {
    try {
      const testRes = await fetch(`${TMDB_BASE}/configuration`, {
        headers: { Authorization: tmdbToken.startsWith('Bearer ') ? tmdbToken : `Bearer ${tmdbToken}` },
        signal: AbortSignal.timeout(5000)
      })
      if (testRes.ok) {
        tmdbAvailable = true
        console.log('[tmdb] подключение обнаружено и успешно')
      } else {
        console.log('[tmdb] подключение обнаружено, но tmdb api не отвечает (статус: ' + testRes.status + ')')
      }
    } catch (e) {
      console.log('[tmdb] подключение обнаружено, но tmdb api не отвечает:', e)
    }
  } else {
    console.log('[tmdb] подключение не обнаружено')
  }

  if (tmdbRequired && !tmdbAvailable) {
    throw createError({ statusCode: 503, statusMessage: 'TMDB unavailable', message: 'Не удается загрузить данные из базы TMDB' })
  }

  const rawDiary = csvToObjects(csvFiles.diary)
  const rawRatings = csvToObjects(csvFiles.ratings)
  const rawWatched = csvToObjects(csvFiles.watched)

  const diary: ImportData['diary'] = rawDiary.map(e => ({
    date: e.Date || '',
    title: e.Name || '',
    year: toNumber(e.Year) ?? 0,
    uri: e['Letterboxd URI'] || '',
    rating: toNumber(e.Rating),
    rewatch: e.Rewatch ? e.Rewatch === 'Yes' : null,
    tags: e.Tags ? e.Tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    watchedDate: e['Watched Date'] || ''
  }))

  const ratings: ImportData['ratings'] = rawRatings.map(e => ({
    date: e.Date || '',
    title: e.Name || '',
    year: toNumber(e.Year) ?? 0,
    uri: e['Letterboxd URI'] || '',
    rating: toNumber(e.Rating) ?? 0
  }))

  const watched: ImportData['watched'] = rawWatched.map(e => ({
    date: e.Date || '',
    title: e.Name || '',
    year: toNumber(e.Year) ?? 0,
    uri: e['Letterboxd URI'] || ''
  }))

  console.log(`[process] csv прочитаны в json: diary ${diary.length}, ratings ${ratings.length}, watched ${watched.length}`)

  const allTitles = new Set<string>()
  for (const entry of ratings) if (entry.title) allTitles.add(entry.title)
  for (const entry of watched) if (entry.title) allTitles.add(entry.title)
  for (const entry of diary) if (entry.title) allTitles.add(entry.title)

  let avgRating: number | null = null
  const sum = ratings.reduce((acc, entry) => acc + entry.rating, 0)
  if (ratings.length > 0) avgRating = Math.round((sum / ratings.length) * 100) / 100

  console.log(`[process] требуется обогащение данных: для ratings с оценкой ≥ ${minRating}`)

  const cache = loadOrCreateCache(cachePaths)

  const toEnrich = ratings.filter(m => m.rating !== null && m.rating >= minRating)

  let cachedCount = 0
  let fetchCount = 0
  for (const movie of toEnrich) {
    if (Object.prototype.hasOwnProperty.call(cache[cacheKey(movie.uri, locale)] ?? {}, '_matched')) cachedCount++
    else fetchCount++
  }

  let exactMatch = 0
  let fuzzyMatch = 0
  let notFound = 0

  if (fetchCount === 0) {
    console.log(`[process] обогащение данных: ${cachedCount} из кэша`)
  } else if (!tmdbAvailable) {
    console.log(`[process] обогащение данных: ${cachedCount} из кэша, ${fetchCount} пропущено (tmdb недоступен)`)
  } else {
    console.log(`[process] обогащение данных: ${cachedCount} из кэша, ${fetchCount} через TMDB`)

    const toFetch = toEnrich.filter(m => !Object.prototype.hasOwnProperty.call(cache[cacheKey(m.uri, locale)] ?? {}, '_matched'))
    const batchDelay = Math.ceil((BATCH_SIZE * 2) / RATE_LIMIT * 1000)

    for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
      const start = Date.now()
      const batch = toFetch.slice(i, i + BATCH_SIZE)

      const searches = await Promise.all(
        batch.map(m => searchMovie(m.title, m.year, tmdbToken, locale))
      )

      const details = await Promise.all(
        searches.map(s => s ? getMovieDetails(s.id, tmdbToken, locale) : null)
      )

      for (let j = 0; j < batch.length; j++) {
        const movie = batch[j]!
        const searchResult = searches[j]!
        const detail = details[j]!
        const key = cacheKey(movie.uri, locale)

        if (!searchResult || !detail) {
          cache[key] = {
            uri: movie.uri, title: movie.title, year: movie.year,
            tmdbId: searchResult?.id ?? null, genres: [], poster: null, directors: [], _matched: false
          }
          notFound++
          continue
        }

        const isExact = searchResult.release_date
          ? parseInt(searchResult.release_date.split('-')[0] ?? '', 10) === movie.year
          && (detail.title ?? searchResult.title).toLowerCase() === movie.title.toLowerCase()
          : false

        cache[key] = {
          uri: movie.uri, title: detail.title ?? movie.title, year: movie.year,
          tmdbId: searchResult.id,
          genres: detail.genres,
          poster: detail.poster,
          directors: detail.directors,
          _matched: true
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
    const cached = cache[cacheKey(movie.uri, locale)]
    if (cached) {
      enriched.push({ ...cached, dateRated: movie.date, userRating: movie.rating })
    }
  }

  saveCache(cachePaths, cache)

  const allDates = [...ratings.map(r => r.date), ...watched.map(w => w.date), ...diary.map(d => d.date)].filter(Boolean).sort() as string[]
  const sorted = allDates.length > 0 ? allDates : []
  const importDate = sorted.length > 0 ? sorted[0]! : null

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
      avgRating,
      importDate
    },
    enriched
  }
}
