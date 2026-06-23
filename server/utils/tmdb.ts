import { createError } from 'h3'
import { csvToObjects, toNumber } from './csv'
import { dirname } from 'node:path'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { ProxyAgent, fetch as undiciFetch } from 'undici'
import type { RequestInit as UndiciRequestInit, Response as UndiciResponse } from 'undici'
import type {
  EnrichedImportData,
  ImportData,
  Movie,
  RatingEntry,
  Watch
} from '~/types/import'

const TMDB_BASE = 'https://api.themoviedb.org/3'
const RATE_LIMIT = 30
const BATCH_SIZE = 10
const ALT_FALLBACK_LIMIT = 8
const DISCOVERY_FALLBACK_LIMIT = 12
const HIGH_CONFIDENCE_SCORE = 150
const DIRECT_MATCH_SCORE = 130
const NARROW_FALLBACK_SCORE = 120
const NARROW_FALLBACK_LIMIT = 3
const TRANSLATION_FALLBACK_LIMIT = 5

let lastRequest = 0

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

interface TmdbSearchCandidate {
  id: number
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

interface RescoredCandidate {
  candidate: TmdbSearchCandidate
  alternativeExact: boolean
  score: number
}

type CachedMovie = Omit<Movie, 'id' | 'movieUri' | 'matched'> & {
  matchStatus?: MatchStatus
  matchScore?: number
  matchVersion?: number
}

interface CachePaths {
  runtimePath: string
  snapshotPath: string
}

interface ParsedRatingEntry {
  date: string
  title: string
  year: number
  movieUri: string | null
  rating: number
}

interface ParsedDiaryEntry {
  date: string
  title: string
  year: number
  diaryUri: string | null
  rating: number | null
  rewatch: boolean | null
  tags: string[]
  watchedDate: string | null
}

interface ParsedImportData {
  ratings: ParsedRatingEntry[]
  diary: ParsedDiaryEntry[]
}

const IS_DEV = import.meta.dev
const TMDB_TIMEOUT_MS = 5000
const MATCH_VERSION = 7
const proxyAgents = new Map<string, ProxyAgent>()
const alternativeTitlesCache = new Map<number, string[]>()
const translatedTitlesCache = new Map<number, string[]>()

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

function roundMatchScore(value: number | undefined): number | undefined {
  if (value === undefined) {
    return undefined
  }

  return Math.round(value * 100) / 100
}

export function saveCache(paths: CachePaths, cache: Record<string, CachedMovie>) {
  if (!IS_DEV) {
    return
  }

  try {
    const normalizedCache = Object.fromEntries(
      Object.entries(cache).map(([key, movie]) => [
        key,
        {
          ...movie,
          matchScore: roundMatchScore(movie.matchScore)
        }
      ])
    )

    mkdirSync(dirname(paths.runtimePath), { recursive: true })
    writeFileSync(paths.runtimePath, JSON.stringify(normalizedCache, null, 2), 'utf-8')
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

function shouldReturnEarly(match: MatchResult): boolean {
  return (match.status === 'exact' || match.status === 'probable')
    && match.score >= HIGH_CONFIDENCE_SCORE
}

function shouldAcceptDirectMatch(match: MatchResult): boolean {
  return (match.status === 'exact' || match.status === 'probable')
    && match.score >= DIRECT_MATCH_SCORE
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
    title: candidate.title,
    original_title: candidate.original_title,
    release_date: candidate.release_date,
    popularity: candidate.popularity,
    vote_count: candidate.vote_count,
    poster_path: candidate.poster_path,
    overview: candidate.overview
  }
}

async function getAlternativeTitles(candidate: TmdbSearchCandidate, token: string, proxyUrl?: string): Promise<string[]> {
  const cached = alternativeTitlesCache.get(candidate.id)
  if (cached) {
    return cached
  }

  const data = await tmdbFetch<TmdbAlternativeTitlesResponse>(
    `${TMDB_BASE}/movie/${candidate.id}/alternative_titles`,
    token,
    proxyUrl
  )

  const titles = data?.titles
    ?.map(title => title.title?.trim() ?? '')
    .filter(Boolean) ?? []
  alternativeTitlesCache.set(candidate.id, titles)
  return titles
}

async function getTranslatedTitles(candidate: TmdbSearchCandidate, token: string, proxyUrl?: string): Promise<string[]> {
  const cached = translatedTitlesCache.get(candidate.id)
  if (cached) {
    return cached
  }

  const data = await tmdbFetch<TmdbTranslationsResponse>(
    `${TMDB_BASE}/movie/${candidate.id}/translations`,
    token,
    proxyUrl
  )

  const titles = data?.translations
    ?.map(translation => translation.data?.title?.trim() || translation.data?.name?.trim() || '')
    .filter(Boolean) ?? []
  translatedTitlesCache.set(candidate.id, titles)
  return titles
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

function selectFallbackCandidates(candidates: TmdbSearchCandidate[], limit?: number): TmdbSearchCandidate[] {
  const topByApiOrder = candidates.slice(0, ALT_FALLBACK_LIMIT)
  const topByDiscovery = [...candidates]
    .sort((a, b) => getCandidateDiscoveryScore(b) - getCandidateDiscoveryScore(a))
    .slice(0, DISCOVERY_FALLBACK_LIMIT)

  const selected = [...new Map(
    [...topByApiOrder, ...topByDiscovery].map(candidate => [candidate.id, candidate])
  ).values()]

  return limit ? selected.slice(0, limit) : selected
}

function getDirectMatchResult(firstMatch: MatchResult, secondMatch: MatchResult): MatchResult | null {
  const directMatches = [firstMatch, secondMatch].filter(shouldAcceptDirectMatch)
  if (directMatches.length === 0) {
    return null
  }

  return directMatches.sort((a, b) => b.score - a.score)[0] ?? null
}

function getFallbackBaseResult(firstMatch: MatchResult, secondMatch: MatchResult): MatchResult {
  if (secondMatch.status === 'exact') {
    return secondMatch
  }

  return firstMatch
}

function resolveRescoredCandidates(rescoredCandidates: RescoredCandidate[], fallbackMatch: MatchResult): MatchResult {
  const rescoredBest = rescoredCandidates.sort((a, b) => b.score - a.score)
  const best = rescoredBest[0]
  const second = rescoredBest[1]

  if (!best) {
    return fallbackMatch
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

  return { candidate: null, status, score: best.score }
}

async function rescoreFallbackCandidates(
  title: string,
  year: number,
  candidates: TmdbSearchCandidate[],
  token: string,
  proxyUrl: string | undefined,
  includeTranslations: boolean
): Promise<RescoredCandidate[]> {
  return await Promise.all(
    candidates.map(async (candidate, index) => {
      const alternativeTitles = await getAlternativeTitles(candidate, token, proxyUrl)
      const translatedTitles = includeTranslations
        ? await getTranslatedTitles(candidate, token, proxyUrl)
        : []
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
  if (shouldReturnEarly(firstMatch)) {
    return firstMatch
  }

  const secondMatch = pickBestCandidate(title, year, titleOnlyResults)
  if (shouldReturnEarly(secondMatch)) {
    return secondMatch
  }

  const directMatch = getDirectMatchResult(firstMatch, secondMatch)
  if (directMatch) {
    return directMatch
  }

  const mergedCandidates: TmdbSearchCandidate[] = [
    ...yearScopedResults,
    ...titleOnlyResults
  ]
  const dedupedCandidates: TmdbSearchCandidate[] = [...new Map(mergedCandidates.map(candidate => [candidate.id, candidate] as const)).values()]
  const fallbackLimit = Math.max(firstMatch.score, secondMatch.score) >= NARROW_FALLBACK_SCORE
    ? NARROW_FALLBACK_LIMIT
    : undefined
  const rawFallbackCandidates: TmdbSearchCandidate[] = selectFallbackCandidates(dedupedCandidates, fallbackLimit)
  const fallbackBaseResult = getFallbackBaseResult(firstMatch, secondMatch)

  if (rawFallbackCandidates.length === 0) {
    return fallbackBaseResult
  }

  const alternativeTitleCandidates = await rescoreFallbackCandidates(
    title,
    year,
    rawFallbackCandidates,
    token,
    proxyUrl,
    false
  )
  const alternativeTitleMatch = resolveRescoredCandidates(alternativeTitleCandidates, fallbackBaseResult)
  if (alternativeTitleMatch.status === 'exact' || alternativeTitleMatch.status === 'probable') {
    return alternativeTitleMatch
  }

  const translationCandidates = alternativeTitleCandidates
    .sort((a, b) => b.score - a.score)
    .slice(0, TRANSLATION_FALLBACK_LIMIT)
    .map(entry => entry.candidate)

  if (translationCandidates.length === 0) {
    return alternativeTitleMatch.candidate ? alternativeTitleMatch : fallbackBaseResult
  }

  const translatedCandidates = await rescoreFallbackCandidates(
    title,
    year,
    translationCandidates,
    token,
    proxyUrl,
    true
  )
  const translatedMatch = resolveRescoredCandidates(translatedCandidates, fallbackBaseResult)
  if (translatedMatch.status === 'exact' || translatedMatch.status === 'probable') {
    return translatedMatch
  }

  return alternativeTitleMatch.candidate ? alternativeTitleMatch : translatedMatch.candidate ? translatedMatch : fallbackBaseResult
}

async function getTitleDetails(candidate: TmdbSearchCandidate, token: string, locale: string, proxyUrl?: string): Promise<MovieDetails | null> {
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

export async function debugMatchMovie(
  movie: Pick<RatingEntry, 'title' | 'year' | 'uri'>,
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

  const searchResult = await searchMovie(
    movie.title,
    movie.year,
    movie.uri,
    tmdbToken,
    locale,
    shouldUseProxy ? proxyUrl : undefined
  )

  if (!searchResult.candidate || (searchResult.status !== 'exact' && searchResult.status !== 'probable')) {
    return {
      title: movie.title,
      year: movie.year,
      tmdbId: searchResult.candidate?.id ?? null,
      genres: [],
      poster: null,
      directors: [],
      matched: false,
      movieUri: movie.uri,
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
      title: movie.title,
      year: movie.year,
      tmdbId: searchResult.candidate.id,
      genres: [],
      poster: null,
      directors: [],
      matched: false,
      movieUri: movie.uri,
      matchStatus: searchResult.status,
      matchScore: searchResult.score,
      matchVersion: MATCH_VERSION
    }
  }

  return {
    title: detail.title ?? movie.title,
    year: movie.year,
    tmdbId: searchResult.candidate.id,
    genres: detail.genres,
    poster: detail.poster,
    directors: detail.directors,
    matched: true,
    movieUri: movie.uri,
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

function toNullableString(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function normalizeTitleKey(title: string): string {
  return normalizeTitle(title)
}

function getFallbackMovieId(title: string, year: number) {
  return `tmp:${normalizeTitleKey(title)}:${year}`
}

function getMovieIdForRawEntry(entry: { title: string, year: number, movieUri?: string | null }) {
  return entry.movieUri ? `lb:movie:${entry.movieUri}` : getFallbackMovieId(entry.title, entry.year)
}

function parseRawImportData(csvFiles: { diary: string, ratings: string, watched: string }): ParsedImportData {
  const rawDiary = csvToObjects(csvFiles.diary)
  const rawRatings = csvToObjects(csvFiles.ratings)

  return {
    diary: rawDiary.map((entry): ParsedDiaryEntry => ({
      date: entry.Date || '',
      title: entry.Name || '',
      year: toNumber(entry.Year) ?? 0,
      diaryUri: toNullableString(entry['Letterboxd URI']),
      rating: toNumber(entry.Rating),
      rewatch: entry.Rewatch ? entry.Rewatch === 'Yes' : null,
      tags: entry.Tags ? entry.Tags.split(',').map(tag => tag.trim()).filter(Boolean) : [],
      watchedDate: toNullableString(entry['Watched Date'])
    })),
    ratings: rawRatings.map((entry): ParsedRatingEntry => ({
      date: entry.Date || '',
      title: entry.Name || '',
      year: toNumber(entry.Year) ?? 0,
      movieUri: toNullableString(entry['Letterboxd URI']),
      rating: toNumber(entry.Rating) ?? 0
    }))
  }
}

function findExistingWatchForRating(
  watches: Watch[],
  movieId: string,
  loggedDate: string
) {
  const byLoggedDate = watches.find(watch => watch.movieId === movieId && watch.loggedDate === loggedDate)
  if (byLoggedDate) {
    return byLoggedDate
  }

  const candidates = watches.filter(watch => watch.movieId === movieId && !watch.loggedDate)
  return candidates.length === 1 ? candidates[0]! : null
}

function buildNormalizedImportData(raw: ParsedImportData): ImportData {
  const moviesById = new Map<string, ImportData['movies'][number]>()
  const moviesByFallbackKey = new Map<string, ImportData['movies'][number]>()
  const watches: Watch[] = []

  const ensureMovie = (entry: { title: string, year: number, movieUri?: string | null }) => {
    const id = getMovieIdForRawEntry(entry)
    const fallbackKey = getFallbackMovieId(entry.title, entry.year)
    const existing = moviesById.get(id)

    if (existing) {
      if (!existing.movieUri && entry.movieUri) {
        existing.movieUri = entry.movieUri
      }
      return existing
    }

    const fallbackMatch = moviesByFallbackKey.get(fallbackKey)
    if (fallbackMatch) {
      if (!fallbackMatch.movieUri && entry.movieUri) {
        fallbackMatch.movieUri = entry.movieUri
      }
      if (!moviesById.has(id)) {
        moviesById.set(id, fallbackMatch)
      }
      return fallbackMatch
    }

    const movie: ImportData['movies'][number] = {
      id,
      movieUri: entry.movieUri ?? null,
      title: entry.title,
      year: entry.year
    }
    moviesById.set(id, movie)
    moviesByFallbackKey.set(fallbackKey, movie)
    return movie
  }

  for (const entry of raw.ratings) {
    ensureMovie(entry)
  }

  for (const entry of raw.diary) {
    ensureMovie({ title: entry.title, year: entry.year })
  }

  raw.diary.forEach((entry, index) => {
    const movie = ensureMovie({ title: entry.title, year: entry.year })
    watches.push({
      id: `watch:${movie.id}:${(entry.watchedDate ?? entry.date) || 'unknown'}:${index}`,
      movieId: movie.id,
      movieUri: movie.movieUri,
      diaryUri: entry.diaryUri,
      watchedDate: entry.watchedDate,
      loggedDate: toNullableString(entry.date),
      rating: entry.rating,
      rewatch: entry.rewatch,
      tags: entry.tags,
      sources: {
        diary: true,
        watched: false,
        rating: entry.rating !== null
      }
    })
  })

  raw.ratings.forEach((entry) => {
    const movie = ensureMovie(entry)
    const existing = findExistingWatchForRating(watches, movie.id, entry.date)

    if (!existing) {
      return
    }

    if (existing.rating === null) {
      existing.rating = entry.rating
    }

    if (!existing.loggedDate) {
      existing.loggedDate = entry.date
    }

    if (!existing.movieUri && movie.movieUri) {
      existing.movieUri = movie.movieUri
    }

    existing.sources.rating = true
  })

  for (const watch of watches) {
    if (!watch.movieUri) {
      watch.movieUri = moviesById.get(watch.movieId)?.movieUri ?? null
    }
  }

  const allTitles = new Set<string>()
  for (const entry of raw.ratings) if (entry.title) allTitles.add(entry.title)
  for (const entry of raw.diary) if (entry.title) allTitles.add(entry.title)

  const sum = raw.ratings.reduce((acc, entry) => acc + entry.rating, 0)
  const avgRating = raw.ratings.length > 0 ? Math.round((sum / raw.ratings.length) * 100) / 100 : null
  const allDates = [
    ...raw.ratings.map(entry => entry.date),
    ...raw.diary.map(entry => entry.date)
  ].filter(Boolean).sort()
  const importDate = allDates.length > 0 ? allDates[0]! : null

  return {
    movies: Array.from(new Set(moviesById.values())),
    watches,
    stats: {
      totalRatings: raw.ratings.length,
      totalWatched: raw.diary.filter(entry => !!entry.watchedDate).length,
      totalDiary: raw.diary.length,
      totalMovies: moviesById.size,
      totalWatches: watches.length,
      uniqueTitles: allTitles.size,
      avgRating,
      importDate
    }
  }
}

function buildEnrichedImportData(
  data: ImportData,
  movies: Movie[]
): EnrichedImportData {
  return {
    movies,
    watches: data.watches,
    stats: data.stats
  }
}

export async function processCSVData(
  csvFiles: { diary: string, ratings: string, watched: string },
  cachePaths: CachePaths,
  locale = 'en-US',
  minRating = 3,
  tmdbRequired = true
): Promise<EnrichedImportData> {
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

  const raw = parseRawImportData(csvFiles)
  const baseData = buildNormalizedImportData(raw)

  console.log(`[process] csv прочитаны в json: diary ${raw.diary.length}, ratings ${raw.ratings.length}`)

  console.log(`[process] требуется обогащение данных: для ratings с оценкой ≥ ${minRating}`)

  const cache = loadOrCreateCache(cachePaths)

  const enrichableMovieIds = new Set(
    raw.ratings
      .filter(entry => entry.rating >= minRating)
      .map(entry => getMovieIdForRawEntry(entry))
  )
  const toEnrich = baseData.movies.filter(movie => enrichableMovieIds.has(movie.id) && movie.movieUri)

  let cachedCount = 0
  let fetchCount = 0
  for (const movie of toEnrich) {
    if (movie.movieUri && isResolvedCacheEntry(cache[cacheKey(movie.movieUri, locale)])) {
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

    const toFetch = toEnrich.filter(movie => movie.movieUri && !isResolvedCacheEntry(cache[cacheKey(movie.movieUri, locale)]))
    const batchDelay = Math.ceil((BATCH_SIZE * 2) / RATE_LIMIT * 1000)

    for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
      const start = Date.now()
      const batch = toFetch.slice(i, i + BATCH_SIZE)

      const searches = await Promise.all(
        batch.map(movie => searchMovie(movie.title, movie.year, movie.movieUri!, tmdbToken, locale, shouldUseProxy ? proxyUrl : undefined))
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
        const key = cacheKey(movie.movieUri!, locale)

        if (!searchResult.candidate || !detail) {
          cache[key] = {
            title: movie.title,
            year: movie.year,
            tmdbId: searchResult.candidate?.id ?? null,
            genres: [],
            poster: null,
            directors: [],
            matched: false,
            movieUri: movie.movieUri,
            matchStatus: searchResult.status,
            matchScore: searchResult.score,
            matchVersion: MATCH_VERSION
          }
          notFound++
          continue
        }

        cache[key] = {
          title: detail.title ?? movie.title,
          year: movie.year,
          tmdbId: searchResult.candidate.id,
          genres: detail.genres,
          poster: detail.poster,
          directors: detail.directors,
          matched: true,
          movieUri: movie.movieUri,
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

  const enrichedMovies: Movie[] = baseData.movies.map((movie) => {
    const cached = movie.movieUri ? cache[cacheKey(movie.movieUri, locale)] : undefined

    return {
      id: movie.id,
      movieUri: movie.movieUri,
      title: cached?.title ?? movie.title,
      year: movie.year,
      tmdbId: cached?.tmdbId ?? null,
      genres: cached?.genres ?? [],
      poster: cached?.poster ?? null,
      directors: cached?.directors ?? [],
      matched: cached?.matched ?? false
    }
  })

  saveCache(cachePaths, cache)

  console.log('[process] данные готовы, передаем на фронтенд')
  return buildEnrichedImportData(baseData, enrichedMovies)
}
