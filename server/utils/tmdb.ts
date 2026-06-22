import { createError } from 'h3'
import { csvToObjects, toNumber } from './csv'
import { dirname } from 'node:path'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { ProxyAgent, fetch as undiciFetch } from 'undici'
import type { RequestInit as UndiciRequestInit, Response as UndiciResponse } from 'undici'
import type { ImportData } from '~/types/import'

const TMDB_BASE = 'https://api.themoviedb.org/3'
const RATE_LIMIT = 30
const BATCH_SIZE = 10
const ALT_FALLBACK_LIMIT = 10
const DISCOVERY_FALLBACK_LIMIT = 15

let lastRequest = 0

type TmdbMediaType = 'movie' | 'tv'

interface TmdbMovieSearchResult {
  id: number
  title: string
  original_title?: string
  release_date?: string
  popularity?: number
  vote_count?: number
  poster_path?: string | null
  overview?: string
}

interface TmdbTvSearchResult {
  id: number
  name: string
  original_name?: string
  first_air_date?: string
  popularity?: number
  vote_count?: number
  poster_path?: string | null
  overview?: string
}

interface TmdbSearchCandidate {
  id: number
  mediaType: TmdbMediaType
  title: string
  original_title?: string
  release_date?: string
  popularity?: number
  vote_count?: number
  poster_path?: string | null
  overview?: string
}

interface TmdbSearchResponse<T> {
  results?: T[]
}

interface TmdbAlternativeTitle {
  title?: string
}

interface TmdbAlternativeTitlesResponse {
  titles?: TmdbAlternativeTitle[]
}

interface TmdbTranslationData {
  title?: string | null
  name?: string | null
}

interface TmdbTranslation {
  data?: TmdbTranslationData | null
}

interface TmdbTranslationsResponse {
  translations?: TmdbTranslation[]
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

interface TmdbTvCreator {
  name: string
  profile_path?: string | null
}

interface TmdbTvDetailsResponse {
  name?: string | null
  genres?: TmdbGenre[]
  poster_path?: string | null
  created_by?: TmdbTvCreator[]
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

type MatchStatus = 'exact' | 'probable' | 'ambiguous' | 'not_found'

interface MatchResult {
  candidate: TmdbSearchCandidate | null
  status: MatchStatus
  score: number
}

interface AlternativeTitleMatch {
  exact: boolean
  score: number
}

type CachedMovie = Omit<ImportData['enriched'][number], 'dateRated' | 'userRating'> & {
  matchStatus?: MatchStatus
  matchScore?: number
  matchVersion?: number
}

interface CachePaths {
  runtimePath: string
  snapshotPath: string
}

const IS_DEV = import.meta.dev
const TMDB_TIMEOUT_MS = 5000
const MATCH_VERSION = 6
const proxyAgents = new Map<string, ProxyAgent>()

interface TmdbRequestOptions {
  proxyUrl?: string
  timeoutMs?: number
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function normalizeTmdbToken(token: string) {
  return token.startsWith('Bearer ') ? token : `Bearer ${token}`
}

function getProxyAgent(proxyUrl: string) {
  const existingAgent = proxyAgents.get(proxyUrl)
  if (existingAgent) {
    return existingAgent
  }

  const agent = new ProxyAgent(proxyUrl)
  proxyAgents.set(proxyUrl, agent)
  return agent
}

function createTmdbFetchOptions(token: string, options: TmdbRequestOptions = {}): UndiciRequestInit {
  const { proxyUrl, timeoutMs } = options
  const requestOptions: UndiciRequestInit = {
    headers: { Authorization: normalizeTmdbToken(token) }
  }

  if (timeoutMs) {
    requestOptions.signal = AbortSignal.timeout(timeoutMs)
  }

  if (proxyUrl) {
    requestOptions.dispatcher = getProxyAgent(proxyUrl)
  }

  return requestOptions
}

async function probeTmdbProxy(proxyUrl: string, token: string): Promise<boolean> {
  console.log('[tmdb] proxy задан')
  console.log('[tmdb] проверка доступности proxy')

  try {
    const response = await undiciFetch(`${TMDB_BASE}/configuration`, createTmdbFetchOptions(token, {
      proxyUrl,
      timeoutMs: TMDB_TIMEOUT_MS
    }))

    if (!response.ok) {
      console.log(`[tmdb] proxy доступен, но тестовый запрос к TMDB вернул статус ${response.status}`)
      return false
    }

    console.log('[tmdb] proxy доступен и будет использоваться для запросов к TMDB')
    return true
  } catch (error) {
    console.log('[tmdb] proxy недоступен, запросы к TMDB пойдут без него:', error)
    return false
  }
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

async function tmdbFetch<T>(url: string, token: string, proxyUrl?: string): Promise<T | null> {
  const now = Date.now()
  const elapsed = now - lastRequest
  if (elapsed < 1) {
    await sleep(1)
  }
  lastRequest = Date.now()

  let res: UndiciResponse
  try {
    res = await undiciFetch(url, createTmdbFetchOptions(token, { proxyUrl }))
  } catch (e) {
    console.log('[tmdb] ошибка сети:', e)
    return null
  }

  if (res.status === 429) {
    console.log('[tmdb] rate limit, повтор через 2с')
    await sleep(2000)
    return tmdbFetch(url, token, proxyUrl)
  }

  if (!res.ok) {
    console.log('[tmdb] ошибка запроса', res.status, res.statusText)
    return null
  }
  return await res.json() as T
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’'`]/g, '\'')
    .replace(/&/g, ' and ')
    .replace(/[:\-–—/,!.?()[\]]/g, ' ')
    .replace(/\bii\b/g, '2')
    .replace(/\biii\b/g, '3')
    .replace(/\biv\b/g, '4')
    .replace(/\b(the|a|an)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getReleaseYear(releaseDate?: string): number | null {
  if (!releaseDate) {
    return null
  }

  const year = parseInt(releaseDate.split('-')[0] ?? '', 10)
  return Number.isFinite(year) ? year : null
}

function toTokenSet(title: string): Set<string> {
  return new Set(title.split(' ').filter(Boolean))
}

function overlapRatio(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) {
    return 0
  }

  let intersection = 0
  for (const token of a) {
    if (b.has(token)) {
      intersection++
    }
  }

  return intersection / Math.max(a.size, b.size)
}

function scoreCandidate(inputTitle: string, inputYear: number, candidate: TmdbSearchCandidate): number {
  let score = 0

  const inputNorm = normalizeTitle(inputTitle)
  const titleNorm = normalizeTitle(candidate.title)
  const originalNorm = normalizeTitle(candidate.original_title ?? '')
  const resultYear = getReleaseYear(candidate.release_date)

  if (titleNorm === inputNorm) {
    score += 100
  } else if (originalNorm && originalNorm === inputNorm) {
    score += 100
  } else if (titleNorm.startsWith(inputNorm) || inputNorm.startsWith(titleNorm)) {
    score += 70
  } else {
    const inputTokens = toTokenSet(inputNorm)
    const titleTokens = toTokenSet(titleNorm)
    const originalTokens = toTokenSet(originalNorm)
    const bestOverlap = Math.max(
      overlapRatio(inputTokens, titleTokens),
      overlapRatio(inputTokens, originalTokens)
    )

    if (bestOverlap >= 0.8) {
      score += 40
    } else if (bestOverlap <= 0.3) {
      score -= 80
    }
  }

  if (resultYear === inputYear) {
    score += 40
  } else if (resultYear !== null) {
    const yearDiff = Math.abs(resultYear - inputYear)
    if (yearDiff === 1) {
      score += 20
    } else if (yearDiff === 2) {
      score += 5
    } else {
      score -= 40
    }
  } else if (score < 100) {
    score -= 60
  }

  const popularityBonus = Math.min(10, Math.log10((candidate.popularity ?? 0) + 1) * 3)
  score += popularityBonus

  const hasNumberMismatch = /\b\d+\b/.test(inputNorm) !== /\b\d+\b/.test(titleNorm)
  if (hasNumberMismatch) {
    score -= 20
  }

  return score
}

function scoreMetadataQuality(candidate: TmdbSearchCandidate): number {
  let score = 0

  if (candidate.vote_count && candidate.vote_count >= 100) {
    score += 20
  } else if (candidate.vote_count && candidate.vote_count >= 20) {
    score += 12
  } else if (candidate.vote_count && candidate.vote_count >= 5) {
    score += 6
  } else if (candidate.vote_count && candidate.vote_count >= 1) {
    score += 2
  } else {
    score -= 6
  }

  if (candidate.popularity && candidate.popularity >= 10) {
    score += 12
  } else if (candidate.popularity && candidate.popularity >= 3) {
    score += 8
  } else if (candidate.popularity && candidate.popularity >= 1) {
    score += 4
  } else if ((candidate.popularity ?? 0) < 0.2) {
    score -= 4
  }

  if (candidate.poster_path) {
    score += 4
  }

  if (candidate.overview?.trim()) {
    score += 6
  } else {
    score -= 4
  }

  return score
}

function scoreAlternativeTitles(inputTitle: string, inputYear: number, candidate: TmdbSearchCandidate, alternativeTitles: string[]): AlternativeTitleMatch {
  let bestScore = Number.NEGATIVE_INFINITY
  let exact = false

  for (const alternativeTitle of alternativeTitles) {
    if (!alternativeTitle.trim()) {
      continue
    }

    const alternativeCandidate: TmdbSearchCandidate = {
      ...candidate,
      title: alternativeTitle,
      original_title: alternativeTitle
    }
    const score = scoreCandidate(inputTitle, inputYear, alternativeCandidate)
    if (score > bestScore) {
      bestScore = score
      exact = normalizeTitle(alternativeTitle) === normalizeTitle(inputTitle)
    }
  }

  return {
    exact,
    score: Number.isFinite(bestScore) ? bestScore : Number.NEGATIVE_INFINITY
  }
}

function resolveMatchStatus(score: number): MatchStatus {
  if (score >= 130) {
    return 'exact'
  }
  if (score >= 100) {
    return 'probable'
  }
  if (score >= 75) {
    return 'ambiguous'
  }
  return 'not_found'
}

function getAmbiguityThreshold(score: number): number {
  if (score >= 130) {
    return 5
  }

  if (score >= 100) {
    return 8
  }

  return 15
}

function rankCandidates(inputTitle: string, inputYear: number, results: TmdbSearchCandidate[]) {
  return results
    .map(candidate => ({
      candidate,
      score: scoreCandidate(inputTitle, inputYear, candidate) + scoreMetadataQuality(candidate)
    }))
    .sort((a, b) => b.score - a.score)
}

function pickBestCandidate(inputTitle: string, inputYear: number, results: TmdbSearchCandidate[]): MatchResult {
  if (results.length === 0) {
    return { candidate: null, status: 'not_found', score: 0 }
  }

  const ranked = rankCandidates(inputTitle, inputYear, results)

  const best = ranked[0]!
  const second = ranked[1]

  let status = resolveMatchStatus(best.score)
  if (second && best.score - second.score < getAmbiguityThreshold(best.score) && status !== 'not_found') {
    status = 'ambiguous'
  }

  if (status === 'ambiguous' || status === 'not_found') {
    return { candidate: null, status, score: best.score }
  }

  return { candidate: best.candidate, status, score: best.score }
}

function toMovieCandidate(candidate: TmdbMovieSearchResult): TmdbSearchCandidate {
  return {
    id: candidate.id,
    mediaType: 'movie',
    title: candidate.title,
    original_title: candidate.original_title,
    release_date: candidate.release_date,
    popularity: candidate.popularity,
    vote_count: candidate.vote_count,
    poster_path: candidate.poster_path,
    overview: candidate.overview
  }
}

function toTvCandidate(candidate: TmdbTvSearchResult): TmdbSearchCandidate {
  return {
    id: candidate.id,
    mediaType: 'tv',
    title: candidate.name,
    original_title: candidate.original_name,
    release_date: candidate.first_air_date,
    popularity: candidate.popularity,
    vote_count: candidate.vote_count,
    poster_path: candidate.poster_path,
    overview: candidate.overview
  }
}

async function getAlternativeTitles(candidate: TmdbSearchCandidate, token: string, proxyUrl?: string): Promise<string[]> {
  const data = await tmdbFetch<TmdbAlternativeTitlesResponse>(
    `${TMDB_BASE}/${candidate.mediaType}/${candidate.id}/alternative_titles`,
    token,
    proxyUrl
  )

  return data?.titles
    ?.map(title => title.title?.trim() ?? '')
    .filter(Boolean) ?? []
}

async function getTranslatedTitles(candidate: TmdbSearchCandidate, token: string, proxyUrl?: string): Promise<string[]> {
  const data = await tmdbFetch<TmdbTranslationsResponse>(
    `${TMDB_BASE}/${candidate.mediaType}/${candidate.id}/translations`,
    token,
    proxyUrl
  )

  return data?.translations
    ?.map(translation => translation.data?.title?.trim() || translation.data?.name?.trim() || '')
    .filter(Boolean) ?? []
}

function getSearchRankBonus(index: number): number {
  if (index === 0) {
    return 15
  }

  if (index === 1) {
    return 10
  }

  if (index === 2) {
    return 5
  }

  return 0
}

function getCandidateDiscoveryScore(candidate: TmdbSearchCandidate): number {
  return (candidate.vote_count ?? 0) + ((candidate.popularity ?? 0) * 10)
}

function selectFallbackCandidates(candidates: TmdbSearchCandidate[]): TmdbSearchCandidate[] {
  const topByApiOrder = candidates.slice(0, ALT_FALLBACK_LIMIT)
  const topByDiscovery = [...candidates]
    .sort((a, b) => getCandidateDiscoveryScore(b) - getCandidateDiscoveryScore(a))
    .slice(0, DISCOVERY_FALLBACK_LIMIT)

  return [...new Map(
    [...topByApiOrder, ...topByDiscovery].map(candidate => [candidate.id, candidate])
  ).values()]
}

async function searchMovie(title: string, year: number, _uri: string, token: string, locale: string, proxyUrl?: string): Promise<MatchResult> {
  const yearScoped = await tmdbFetch<TmdbSearchResponse<TmdbMovieSearchResult>>(
    `${TMDB_BASE}/search/movie?query=${encodeURIComponent(title)}&year=${year}&language=${locale}`,
    token,
    proxyUrl
  )

  const titleOnly = await tmdbFetch<TmdbSearchResponse<TmdbMovieSearchResult>>(
    `${TMDB_BASE}/search/movie?query=${encodeURIComponent(title)}&language=${locale}`,
    token,
    proxyUrl
  )
  const yearScopedResults: TmdbSearchCandidate[] = (yearScoped?.results ?? []).map(toMovieCandidate)
  const titleOnlyResults: TmdbSearchCandidate[] = (titleOnly?.results ?? []).map(toMovieCandidate)
  const firstMatch = pickBestCandidate(title, year, yearScopedResults)
  const secondMatch = pickBestCandidate(title, year, titleOnlyResults)

  const mergedCandidates: TmdbSearchCandidate[] = [
    ...yearScopedResults,
    ...titleOnlyResults
  ]
  const dedupedCandidates: TmdbSearchCandidate[] = [...new Map(mergedCandidates.map(candidate => [candidate.id, candidate] as const)).values()]
  const rawFallbackCandidates: TmdbSearchCandidate[] = selectFallbackCandidates(dedupedCandidates)

  if (rawFallbackCandidates.length === 0) {
    return secondMatch.status === 'exact' ? secondMatch : firstMatch
  }

  const rescoredCandidates = await Promise.all(
    rawFallbackCandidates.map(async (candidate, index) => {
      const alternativeTitles = await getAlternativeTitles(candidate, token, proxyUrl)
      const translatedTitles = await getTranslatedTitles(candidate, token, proxyUrl)
      const metadataScore = scoreMetadataQuality(candidate)
      const baseScore = scoreCandidate(title, year, candidate) + metadataScore
      const alternativeMatch = scoreAlternativeTitles(title, year, candidate, [
        ...alternativeTitles,
        ...translatedTitles
      ])
      return {
        candidate,
        alternativeExact: alternativeMatch.exact,
        score: Math.max(baseScore, alternativeMatch.score + metadataScore) + getSearchRankBonus(index)
      }
    })
  )

  const rescoredBest = rescoredCandidates.sort((a, b) => b.score - a.score)
  const best = rescoredBest[0]
  const second = rescoredBest[1]

  if (!best) {
    return secondMatch.status === 'exact' ? secondMatch : firstMatch
  }

  let status = resolveMatchStatus(best.score)
  if (best.alternativeExact && (status === 'exact' || status === 'probable')) {
    return { candidate: best.candidate, status, score: best.score }
  }

  if (second && best.score - second.score < getAmbiguityThreshold(best.score) && status !== 'not_found') {
    status = 'ambiguous'
  }

  if (status === 'exact' || status === 'probable') {
    return { candidate: best.candidate, status, score: best.score }
  }

  return secondMatch.status === 'exact' ? secondMatch : { candidate: null, status, score: best.score }
}

async function searchTv(title: string, year: number, token: string, locale: string, proxyUrl?: string): Promise<MatchResult> {
  const yearScoped = await tmdbFetch<TmdbSearchResponse<TmdbTvSearchResult>>(
    `${TMDB_BASE}/search/tv?query=${encodeURIComponent(title)}&first_air_date_year=${year}&language=${locale}`,
    token,
    proxyUrl
  )
  const titleOnly = await tmdbFetch<TmdbSearchResponse<TmdbTvSearchResult>>(
    `${TMDB_BASE}/search/tv?query=${encodeURIComponent(title)}&language=${locale}`,
    token,
    proxyUrl
  )
  const yearScopedResults: TmdbSearchCandidate[] = (yearScoped?.results ?? []).map(toTvCandidate)
  const titleOnlyResults: TmdbSearchCandidate[] = (titleOnly?.results ?? []).map(toTvCandidate)
  const firstMatch = pickBestCandidate(title, year, yearScopedResults)
  const secondMatch = pickBestCandidate(title, year, titleOnlyResults)

  const mergedCandidates: TmdbSearchCandidate[] = [
    ...yearScopedResults,
    ...titleOnlyResults
  ]
  const dedupedCandidates: TmdbSearchCandidate[] = [...new Map(mergedCandidates.map(candidate => [candidate.id, candidate] as const)).values()]
  const rawFallbackCandidates: TmdbSearchCandidate[] = selectFallbackCandidates(dedupedCandidates)

  if (rawFallbackCandidates.length === 0) {
    return secondMatch.status === 'exact' ? secondMatch : firstMatch
  }

  const rescoredCandidates = await Promise.all(
    rawFallbackCandidates.map(async (candidate, index) => {
      const alternativeTitles = await getAlternativeTitles(candidate, token, proxyUrl)
      const translatedTitles = await getTranslatedTitles(candidate, token, proxyUrl)
      const metadataScore = scoreMetadataQuality(candidate)
      const baseScore = scoreCandidate(title, year, candidate) + metadataScore
      const alternativeMatch = scoreAlternativeTitles(title, year, candidate, [
        ...alternativeTitles,
        ...translatedTitles
      ])
      return {
        candidate,
        alternativeExact: alternativeMatch.exact,
        score: Math.max(baseScore, alternativeMatch.score + metadataScore) + getSearchRankBonus(index)
      }
    })
  )

  const rescoredBest = rescoredCandidates.sort((a, b) => b.score - a.score)
  const best = rescoredBest[0]
  const second = rescoredBest[1]

  if (!best) {
    return secondMatch.status === 'exact' ? secondMatch : firstMatch
  }

  let status = resolveMatchStatus(best.score)
  if (best.alternativeExact && (status === 'exact' || status === 'probable')) {
    return { candidate: best.candidate, status, score: best.score }
  }

  if (second && best.score - second.score < getAmbiguityThreshold(best.score) && status !== 'not_found') {
    status = 'ambiguous'
  }

  if (status === 'exact' || status === 'probable') {
    return { candidate: best.candidate, status, score: best.score }
  }

  return secondMatch.status === 'exact' ? secondMatch : { candidate: null, status, score: best.score }
}

async function searchTmdb(title: string, year: number, uri: string, token: string, locale: string, proxyUrl?: string): Promise<MatchResult> {
  const movieMatch = await searchMovie(title, year, uri, token, locale, proxyUrl)
  const tvMatch = await searchTv(title, year, token, locale, proxyUrl)

  if (!tvMatch.candidate) {
    return movieMatch
  }

  if (!movieMatch.candidate) {
    return tvMatch
  }

  const movieBias = 5
  return tvMatch.score > movieMatch.score + movieBias ? tvMatch : movieMatch
}

async function getTitleDetails(candidate: TmdbSearchCandidate, token: string, locale: string, proxyUrl?: string): Promise<MovieDetails | null> {
  if (candidate.mediaType === 'movie') {
    const data = await tmdbFetch<TmdbMovieDetailsResponse>(
      `${TMDB_BASE}/movie/${candidate.id}?append_to_response=credits&language=${locale}`,
      token,
      proxyUrl
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

  const data = await tmdbFetch<TmdbTvDetailsResponse>(
    `${TMDB_BASE}/tv/${candidate.id}?language=${locale}`,
    token,
    proxyUrl
  )
  if (!data) return null
  return {
    title: data.name || null,
    genres: data.genres?.map(g => g.name) || [],
    poster: data.poster_path || null,
    directors: (data.created_by ?? []).map(d => ({ name: d.name, photo: d.profile_path || null }))
  }
}

export async function debugMatchMovie(
  movie: Pick<ImportData['ratings'][number], 'title' | 'year' | 'uri'>,
  locale = 'en-US'
): Promise<CachedMovie> {
  const { tmdbToken, tmdbProxy } = useRuntimeConfig()

  if (!tmdbToken) {
    throw createError({ statusCode: 503, statusMessage: 'TMDB unavailable', message: 'Не удается загрузить данные из базы TMDB' })
  }

  const proxyUrl = tmdbProxy.trim() || undefined
  let shouldUseProxy = false

  if (proxyUrl) {
    shouldUseProxy = await probeTmdbProxy(proxyUrl, tmdbToken)
  }

  let tmdbAvailable = false
  try {
    const testRes = await undiciFetch(`${TMDB_BASE}/configuration`, createTmdbFetchOptions(tmdbToken, {
      proxyUrl: shouldUseProxy ? proxyUrl : undefined,
      timeoutMs: TMDB_TIMEOUT_MS
    }))
    tmdbAvailable = testRes.ok
  } catch {
    tmdbAvailable = false
  }

  if (!tmdbAvailable) {
    throw createError({ statusCode: 503, statusMessage: 'TMDB unavailable', message: 'Не удается загрузить данные из базы TMDB' })
  }

  const searchResult = await searchTmdb(
    movie.title,
    movie.year,
    movie.uri,
    tmdbToken,
    locale,
    shouldUseProxy ? proxyUrl : undefined
  )

  if (!searchResult.candidate || (searchResult.status !== 'exact' && searchResult.status !== 'probable')) {
    return {
      uri: movie.uri,
      title: movie.title,
      year: movie.year,
      tmdbId: searchResult.candidate?.id ?? null,
      genres: [],
      poster: null,
      directors: [],
      _matched: false,
      matchStatus: searchResult.status,
      matchScore: searchResult.score,
      matchVersion: MATCH_VERSION
    }
  }

  const detail = await getTitleDetails(
    searchResult.candidate,
    tmdbToken,
    locale,
    shouldUseProxy ? proxyUrl : undefined
  )

  if (!detail) {
    return {
      uri: movie.uri,
      title: movie.title,
      year: movie.year,
      tmdbId: searchResult.candidate.id,
      genres: [],
      poster: null,
      directors: [],
      _matched: false,
      matchStatus: searchResult.status,
      matchScore: searchResult.score,
      matchVersion: MATCH_VERSION
    }
  }

  return {
    uri: movie.uri,
    title: detail.title ?? movie.title,
    year: movie.year,
    tmdbId: searchResult.candidate.id,
    genres: detail.genres,
    poster: detail.poster,
    directors: detail.directors,
    _matched: true,
    matchStatus: searchResult.status,
    matchScore: searchResult.score,
    matchVersion: MATCH_VERSION
  }
}

function cacheKey(uri: string, locale: string): string {
  return `${uri}:${locale}`
}

function isResolvedCacheEntry(entry?: CachedMovie): boolean {
  return entry?.matchVersion === MATCH_VERSION
    && entry.matchStatus !== undefined
    && entry.matchStatus !== 'ambiguous'
}

export async function processCSVData(
  csvFiles: { diary: string, ratings: string, watched: string },
  cachePaths: CachePaths,
  locale = 'en-US',
  minRating = 3,
  tmdbRequired = true
): Promise<ImportData> {
  const { tmdbToken, tmdbProxy } = useRuntimeConfig()
  console.log('[process] подготовка данных началась')

  const proxyUrl = tmdbProxy.trim() || undefined
  let shouldUseProxy = false

  if (proxyUrl && tmdbToken) {
    shouldUseProxy = await probeTmdbProxy(proxyUrl, tmdbToken)
  } else if (proxyUrl) {
    console.log('[tmdb] proxy задан, но проверка пропущена: tmdb token не задан')
  } else {
    console.log('[tmdb] proxy не задан')
  }

  // Проверка подключения к TMDB
  let tmdbAvailable = false
  if (tmdbToken) {
    try {
      const testRes = await undiciFetch(`${TMDB_BASE}/configuration`, createTmdbFetchOptions(tmdbToken, {
        proxyUrl: shouldUseProxy ? proxyUrl : undefined,
        timeoutMs: TMDB_TIMEOUT_MS
      }))
      if (testRes.ok) {
        tmdbAvailable = true
        console.log(`[tmdb] подключение обнаружено и успешно${shouldUseProxy ? ' через proxy' : ''}`)
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
    if (isResolvedCacheEntry(cache[cacheKey(movie.uri, locale)])) {
      cachedCount++
    } else {
      fetchCount++
    }
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

    const toFetch = toEnrich.filter(m => !isResolvedCacheEntry(cache[cacheKey(m.uri, locale)]))
    const batchDelay = Math.ceil((BATCH_SIZE * 2) / RATE_LIMIT * 1000)

    for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
      const start = Date.now()
      const batch = toFetch.slice(i, i + BATCH_SIZE)

      const searches = await Promise.all(
        batch.map(m => searchTmdb(m.title, m.year, m.uri, tmdbToken, locale, shouldUseProxy ? proxyUrl : undefined))
      )

      const details = await Promise.all(
        searches.map((search) => {
          if (!search.candidate || (search.status !== 'exact' && search.status !== 'probable')) {
            return null
          }

          return getTitleDetails(search.candidate, tmdbToken, locale, shouldUseProxy ? proxyUrl : undefined)
        })
      )

      for (let j = 0; j < batch.length; j++) {
        const movie = batch[j]!
        const searchResult = searches[j]!
        const detail = details[j]!
        const key = cacheKey(movie.uri, locale)

        if (!searchResult.candidate || !detail) {
          cache[key] = {
            uri: movie.uri, title: movie.title, year: movie.year,
            tmdbId: searchResult.candidate?.id ?? null,
            genres: [],
            poster: null,
            directors: [],
            _matched: false,
            matchStatus: searchResult.status,
            matchScore: searchResult.score,
            matchVersion: MATCH_VERSION
          }
          notFound++
          continue
        }

        cache[key] = {
          uri: movie.uri, title: detail.title ?? movie.title, year: movie.year,
          tmdbId: searchResult.candidate.id,
          genres: detail.genres,
          poster: detail.poster,
          directors: detail.directors,
          _matched: true,
          matchStatus: searchResult.status,
          matchScore: searchResult.score,
          matchVersion: MATCH_VERSION
        }

        if (searchResult.status === 'exact') {
          exactMatch++
        } else {
          fuzzyMatch++
        }
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
