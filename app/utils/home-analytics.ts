import { buildRatingCategories, ratingKeys, ratingLookup } from '~/utils/ratings'
import type { EnrichedImportData, EnrichedMovie, Movie, Watch } from '~/types/import'

const GENRE_COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea',
  '#db2777', '#0d9488', '#ea580c', '#4f46e5', '#65a30d',
  '#0891b2', '#c026d3', '#0284c7', '#059669', '#d97706',
  '#7c3aed', '#4d7c0f', '#0f766e', '#e11d48', '#0369a1'
]

export interface DirectorMovieSummary {
  title: string
  year: number
  userRating: number
}

export interface DirectorGridCard {
  director: string
  photo: string | null
  description: string
  descriptionTitle?: string
  movies: DirectorMovieSummary[]
  _sortValue: number
}

export interface GenreCountDatum {
  genre: string
  count: number
}

export interface DirectorCountDatum {
  director: string
  count: number
}

export interface DirectorPointsDatum {
  director: string
  points: number
}

export interface DirectorAvgRatingDatum {
  director: string
  avgRating: number
}

export interface RatingCountDatum {
  rating: string
  count: number
}

export interface YearWatchedDatum {
  label: string
  count: number
}

export type PercentByYearDatum = Record<string, string | number>
export type CountByYearDatum = Record<string, string | number>
export type ChartCategories = Record<string, { name: string, color: string }>

interface DirectorAggregate {
  photo: string | null
  points: number
  movies: DirectorMovieSummary[]
  ratingSum: number
  ratingCount: number
  maxRating: number
  movieCount: number
  breakdownParts: string[]
}

export interface HomeAnalytics {
  moviesByRating: EnrichedMovie[]
  moviesByDateRated: EnrichedMovie[]
  directorsByPoints: DirectorGridCard[]
  directorsByHighest: DirectorGridCard[]
  charts: {
    favoritesByGenres: GenreCountDatum[]
    genreShareByYears: PercentByYearDatum[]
    genreShareByWatchedYear: PercentByYearDatum[]
    genreCategories: ChartCategories
    ratingStackedByYears: CountByYearDatum[]
    ratingShareByYears: PercentByYearDatum[]
    ratingCategories: ChartCategories
    watchedAllByRating: RatingCountDatum[]
    allMoviesCountByYearWatched: YearWatchedDatum[]
    directorsCount: DirectorCountDatum[]
    directorsPoints: DirectorPointsDatum[]
    directorsAvgRating: DirectorAvgRatingDatum[]
    directorsAvgRatingMin2: DirectorAvgRatingDatum[]
  } | null
}

interface HomeAnalyticsOptions {
  includeCharts?: boolean
  directorPointsLabel?: string
  directorHighestLabel?: string
}

export function buildHomeAnalytics(data: EnrichedImportData, options: HomeAnalyticsOptions = {}): HomeAnalytics {
  const {
    includeCharts = true,
    directorPointsLabel = 'Points',
    directorHighestLabel = 'Highest rated movie'
  } = options
  const ratedMovies = buildRatedMovies(data.movies, data.watches)
  const moviesByRating = sortMoviesByRating(ratedMovies)
  const moviesByDateRated = buildMoviesByWatchDate(data.movies, data.watches, data.stats.importDate)
  const directorMap = buildDirectorAggregateMap(ratedMovies)

  return {
    moviesByRating,
    moviesByDateRated,
    directorsByPoints: buildDirectorsByPoints(directorMap, directorPointsLabel),
    directorsByHighest: buildDirectorsByHighest(directorMap, directorHighestLabel),
    charts: includeCharts ? buildChartAnalytics(data, directorMap) : null
  }
}

export function formatDirectorPoints(points: number) {
  return (Math.round(points) / 10).toFixed(1)
}

function getWatchSortDate(watch: Watch) {
  return watch.watchedDate ?? watch.loggedDate ?? ''
}

function buildWatchedDatesByMovie(watches: Watch[]) {
  const watchedDatesByMovie = new Map<string, string[]>()

  for (const watch of watches) {
    const watchDate = getWatchSortDate(watch)
    if (!watchDate) {
      continue
    }

    const dates = watchedDatesByMovie.get(watch.movieId) ?? []
    dates.push(watchDate)
    watchedDatesByMovie.set(watch.movieId, dates)
  }

  for (const [movieId, dates] of watchedDatesByMovie.entries()) {
    watchedDatesByMovie.set(movieId, [...dates].sort((a, b) => b.localeCompare(a)))
  }

  return watchedDatesByMovie
}

function buildRatedMovies(movies: Movie[], watches: Watch[]) {
  const movieMap = new Map(movies.map(movie => [movie.id, movie] as const))
  const latestWatchByMovie = new Map<string, Watch>()
  const watchedDatesByMovie = buildWatchedDatesByMovie(watches)

  for (const watch of watches) {
    if (watch.rating === null) {
      continue
    }

    const existing = latestWatchByMovie.get(watch.movieId)
    if (!existing) {
      latestWatchByMovie.set(watch.movieId, watch)
      continue
    }

    const existingDate = getWatchSortDate(existing)
    const candidateDate = getWatchSortDate(watch)

    if (candidateDate > existingDate || (candidateDate === existingDate && watch.id > existing.id)) {
      latestWatchByMovie.set(watch.movieId, watch)
    }
  }

  return Array.from(latestWatchByMovie.entries())
    .map(([movieId, watch]) => {
      const movie = movieMap.get(movieId)
      if (!movie || watch.rating === null) {
        return null
      }

      return {
        uri: movie.movieUri ?? `${movie.id}:${getWatchSortDate(watch) || 'unknown'}`,
        title: movie.title,
        year: movie.year,
        dateRated: watch.watchedDate ?? watch.loggedDate,
        watchedDates: watchedDatesByMovie.get(movieId) ?? [],
        userRating: watch.rating,
        tmdbId: movie.tmdbId,
        genres: movie.genres,
        poster: movie.poster,
        directors: movie.directors,
        _matched: movie.matched
      } satisfies EnrichedMovie
    })
    .filter((movie): movie is EnrichedMovie => movie !== null)
}

function buildMoviesByWatchDate(movies: Movie[], watches: Watch[], importDate?: string | null) {
  const movieMap = new Map(movies.map(movie => [movie.id, movie] as const))
  const watchedDatesByMovie = buildWatchedDatesByMovie(watches)

  return watches
    .filter((watch): watch is Watch & { rating: number } => watch.rating !== null)
    .map((watch) => {
      const movie = movieMap.get(watch.movieId)
      if (!movie) {
        return null
      }

      const dateRated = watch.watchedDate ?? watch.loggedDate

      return {
        uri: movie.movieUri ?? `${movie.id}:${dateRated ?? 'unknown'}`,
        title: movie.title,
        year: movie.year,
        dateRated,
        watchedDates: watchedDatesByMovie.get(watch.movieId) ?? [],
        userRating: watch.rating,
        tmdbId: movie.tmdbId,
        genres: movie.genres,
        poster: movie.poster,
        directors: movie.directors,
        _matched: movie.matched
      } satisfies EnrichedMovie
    })
    .filter((movie): movie is EnrichedMovie => movie !== null && !!movie.dateRated && movie.dateRated !== importDate)
    .sort((a, b) => {
      if (!a.dateRated) return 1
      if (!b.dateRated) return -1
      return b.dateRated.localeCompare(a.dateRated)
    })
}

function sortMoviesByRating(movies: EnrichedMovie[]) {
  return [...movies].sort((a, b) => {
    const ratingDiff = b.userRating - a.userRating
    if (ratingDiff !== 0) return ratingDiff
    if (!a.dateRated) return 1
    if (!b.dateRated) return -1
    return b.dateRated.localeCompare(a.dateRated)
  })
}

function buildDirectorAggregateMap(movies: EnrichedMovie[]) {
  const map = new Map<string, DirectorAggregate>()

  for (const movie of movies) {
    const contribution = movie.userRating ** 4
    for (const director of movie.directors) {
      const entry = map.get(director.name) ?? {
        photo: director.photo,
        points: 0,
        movies: [],
        ratingSum: 0,
        ratingCount: 0,
        maxRating: 0,
        movieCount: 0,
        breakdownParts: []
      }

      if (!entry.photo) entry.photo = director.photo
      entry.points += contribution
      entry.movies.push({ title: movie.title, year: movie.year, userRating: movie.userRating })
      entry.ratingSum += movie.userRating
      entry.ratingCount += 1
      entry.movieCount += 1
      entry.maxRating = Math.max(entry.maxRating, movie.userRating)
      entry.breakdownParts.push(`${movie.title} (${movie.userRating}⁴ = ${Math.round(contribution)})`)

      map.set(director.name, entry)
    }
  }

  return map
}

function buildDirectorsByPoints(map: Map<string, DirectorAggregate>, label: string) {
  return Array.from(map.entries())
    .map(([director, entry]) => {
      const displayPoints = formatDirectorPoints(entry.points)

      return {
        director,
        photo: entry.photo,
        description: `${label}: ${displayPoints}`,
        descriptionTitle: `${entry.breakdownParts.join(' + ')} = ${Math.round(entry.points)} -> /10 -> ${displayPoints}`,
        movies: [...entry.movies].sort((a, b) => b.userRating - a.userRating || b.year - a.year),
        _sortValue: entry.points
      } satisfies DirectorGridCard
    })
    .sort((a, b) => b._sortValue - a._sortValue)
}

function buildDirectorsByHighest(map: Map<string, DirectorAggregate>, label: string) {
  return Array.from(map.entries())
    .map(([director, entry]) => ({
      director,
      photo: entry.photo,
      description: `${label}: ${entry.maxRating}`,
      movies: entry.movies.filter(movie => movie.userRating === entry.maxRating),
      _sortValue: entry.maxRating
    } satisfies DirectorGridCard))
    .sort((a, b) => {
      const diff = b.movies[0]!.userRating - a.movies[0]!.userRating
      if (diff !== 0) return diff
      return b.movies.length - a.movies.length
    })
}

function buildGenreAnalytics(movies: EnrichedMovie[]) {
  const allGenres = collectAllGenres(movies)
  const genreCategories: ChartCategories = {}

  allGenres.forEach((genre, index) => {
    genreCategories[genre] = {
      name: genre,
      color: GENRE_COLORS[index % GENRE_COLORS.length]!
    }
  })

  return {
    allGenres,
    genreCategories,
    favoritesByGenres: buildFavoritesByGenres(movies),
    genreShareByYears: buildGenreShareByYears(movies, allGenres),
    genreShareByWatchedYear: buildGenreShareByWatchedYear(movies, allGenres)
  }
}

function buildChartAnalytics(data: EnrichedImportData, directorMap: Map<string, DirectorAggregate>) {
  const ratedMovies = buildRatedMovies(data.movies, data.watches)
  const { genreCategories, favoritesByGenres, genreShareByYears, genreShareByWatchedYear } = buildGenreAnalytics(ratedMovies)

  return {
    favoritesByGenres,
    genreShareByYears,
    genreShareByWatchedYear,
    genreCategories,
    ratingStackedByYears: buildRatingStackedByYears(ratedMovies),
    ratingShareByYears: buildRatingShareByYears(ratedMovies),
    ratingCategories: buildRatingCategories(),
    watchedAllByRating: buildWatchedAllByRating(ratedMovies),
    allMoviesCountByYearWatched: buildAllMoviesCountByYearWatched(data.watches),
    directorsCount: buildDirectorsCountChart(directorMap),
    directorsPoints: buildDirectorsPointsChart(directorMap),
    directorsAvgRating: buildDirectorsAvgRatingChart(directorMap),
    directorsAvgRatingMin2: buildDirectorsAvgRatingChart(directorMap, 2)
  }
}

function collectAllGenres(movies: EnrichedMovie[]) {
  const set = new Set<string>()

  for (const movie of movies) {
    for (const genre of movie.genres) {
      set.add(genre)
    }
  }

  return Array.from(set).sort()
}

function buildFavoritesByGenres(movies: EnrichedMovie[]) {
  const map = new Map<string, number>()

  for (const movie of movies) {
    for (const genre of movie.genres) {
      map.set(genre, (map.get(genre) ?? 0) + 1)
    }
  }

  return Array.from(map.entries())
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)
}

function buildGenreShareByYears(movies: EnrichedMovie[], genres: string[]) {
  const yearMap = new Map<number, Map<string, number>>()

  for (const movie of movies) {
    if (movie.year < 1990) continue
    const bucket = yearMap.get(movie.year) ?? new Map<string, number>()

    for (const genre of movie.genres) {
      bucket.set(genre, (bucket.get(genre) ?? 0) + 1)
    }

    yearMap.set(movie.year, bucket)
  }

  return buildPercentRows(yearMap, genres)
}

function buildGenreShareByWatchedYear(movies: EnrichedMovie[], genres: string[]) {
  const withYear = movies
    .map(movie => ({
      movie,
      watchedYear: movie.dateRated ? Number.parseInt(movie.dateRated.slice(0, 4), 10) : null,
      dateRated: movie.dateRated
    }))
    .filter((entry): entry is { movie: EnrichedMovie, watchedYear: number, dateRated: string } =>
      entry.watchedYear !== null && !Number.isNaN(entry.watchedYear) && entry.watchedYear >= 1990 && entry.dateRated !== null
    )

  if (!withYear.length) return []

  const earliestDate = withYear.reduce((min, entry) => entry.dateRated < min ? entry.dateRated : min, withYear[0]!.dateRated)
  const yearMap = new Map<number, Map<string, number>>()

  for (const entry of withYear) {
    if (entry.dateRated === earliestDate) continue
    const bucket = yearMap.get(entry.watchedYear) ?? new Map<string, number>()

    for (const genre of entry.movie.genres) {
      bucket.set(genre, (bucket.get(genre) ?? 0) + 1)
    }

    yearMap.set(entry.watchedYear, bucket)
  }

  return buildPercentRows(yearMap, genres)
}

function buildPercentRows(yearMap: Map<number, Map<string, number>>, keys: string[]) {
  const sortedYears = Array.from(yearMap.keys()).sort((a, b) => a - b)

  return sortedYears
    .map((year) => {
      const bucket = yearMap.get(year)!
      let total = 0

      for (const value of bucket.values()) {
        total += value
      }

      if (!total) return null

      const percents = keys.map(key => (bucket.get(key) ?? 0) / total * 100)
      const rounded = distributeRoundedPercentages(percents)
      const item: PercentByYearDatum = { year: String(year) }

      for (let index = 0; index < keys.length; index++) {
        item[keys[index]!] = rounded[index]!
      }

      return item
    })
    .filter((item): item is PercentByYearDatum => item !== null)
}

function buildRatingStackedByYears(movies: EnrichedMovie[]) {
  const buckets = buildRatingYearBuckets(movies)

  return buckets.sortedYears.map((year) => {
    const ratingMap = buckets.map.get(year)!
    const item: CountByYearDatum = { year: String(year) }

    for (let index = 0; index < ratingKeys.length; index++) {
      item[ratingKeys[index]!] = ratingMap.get(ratingLookup[index]!) ?? 0
    }

    return item
  })
}

function buildRatingShareByYears(movies: EnrichedMovie[]) {
  const buckets = buildRatingYearBuckets(movies)

  return buckets.sortedYears.map((year) => {
    const ratingMap = buckets.map.get(year)!
    let total = 0

    for (const rating of ratingLookup) {
      total += ratingMap.get(rating) ?? 0
    }

    const item: PercentByYearDatum = { year: String(year) }
    if (!total) {
      for (const key of ratingKeys) {
        item[key] = 0
      }
      return item
    }

    const percents = ratingLookup.map(rating => (ratingMap.get(rating) ?? 0) / total * 100)
    const rounded = distributeRoundedPercentages(percents)

    for (let index = 0; index < ratingKeys.length; index++) {
      item[ratingKeys[index]!] = rounded[index]!
    }

    return item
  })
}

function buildRatingYearBuckets(movies: EnrichedMovie[]) {
  const map = new Map<number, Map<number, number>>()

  for (const movie of movies) {
    if (movie.year < 1990) continue
    const bucket = map.get(movie.year) ?? new Map<number, number>()
    bucket.set(movie.userRating, (bucket.get(movie.userRating) ?? 0) + 1)
    map.set(movie.year, bucket)
  }

  return {
    map,
    sortedYears: Array.from(map.keys()).sort((a, b) => a - b)
  }
}

function buildWatchedAllByRating(movies: EnrichedMovie[]) {
  const map = new Map<number, number>()

  for (const movie of movies) {
    map.set(movie.userRating, (map.get(movie.userRating) ?? 0) + 1)
  }

  const result: RatingCountDatum[] = []

  for (let rating = 0.5; rating <= 5; rating += 0.5) {
    result.push({ rating: rating.toString(), count: map.get(rating) ?? 0 })
  }

  return result
}

function buildAllMoviesCountByYearWatched(watches: Watch[]) {
  const watched = watches.filter((watch): watch is Watch & { watchedDate: string } => !!watch.watchedDate)
  if (!watched.length) return []

  const map = new Map<string, number>()

  for (const entry of watched) {
    const key = entry.watchedDate.slice(0, 4)
    map.set(key, (map.get(key) ?? 0) + 1)
  }

  return Array.from(map.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, count]) => ({ label, count }))
}

function buildDirectorsCountChart(map: Map<string, DirectorAggregate>) {
  return Array.from(map.entries())
    .map(([director, entry]) => ({
      director,
      count: entry.movieCount
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30)
    .reverse()
}

function buildDirectorsPointsChart(map: Map<string, DirectorAggregate>) {
  return Array.from(map.entries())
    .map(([director, entry]) => ({
      director,
      points: entry.points
    }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 30)
    .reverse()
}

function buildDirectorsAvgRatingChart(map: Map<string, DirectorAggregate>, minMovies = 1) {
  return Array.from(map.entries())
    .filter(([, entry]) => entry.ratingCount >= minMovies)
    .map(([director, entry]) => ({
      director,
      avgRating: entry.ratingSum / entry.ratingCount
    }))
    .sort((a, b) => b.avgRating - a.avgRating)
    .slice(0, 30)
    .reverse()
}

function distributeRoundedPercentages(values: number[]) {
  const rounded = values.map(value => Math.round(value))
  const diff = 100 - rounded.reduce((sum, value) => sum + value, 0)

  if (diff === 0 || values.length === 0) return rounded

  const remainders = values
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((left, right) => right.remainder - left.remainder)

  for (let index = 0; index < Math.abs(diff); index++) {
    rounded[remainders[index % remainders.length]!.index]! += Math.sign(diff)
  }

  return rounded
}
