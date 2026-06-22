export interface MovieDirector {
  name: string
  photo: string | null
}

export interface MovieBase {
  id: string
  movieUri: string | null
  title: string
  year: number
}

export interface WatchSources {
  diary: boolean
  watched: boolean
  rating: boolean
}

export interface Watch {
  id: string
  movieId: string
  movieUri: string | null
  diaryUri: string | null
  watchedDate: string | null
  loggedDate: string | null
  rating: number | null
  rewatch: boolean | null
  tags: string[]
  sources: WatchSources
}

export interface ImportStats {
  totalRatings: number
  totalWatched: number
  totalDiary: number
  totalMovies: number
  totalWatches: number
  uniqueTitles: number
  avgRating: number | null
  importDate: string | null
}

export interface ImportData {
  movies: MovieBase[]
  watches: Watch[]
  stats: ImportStats
}

export interface Movie extends MovieBase {
  tmdbId: number | null
  genres: string[]
  poster: string | null
  directors: MovieDirector[]
  matched: boolean
}

export interface RatingEntry {
  date: string
  title: string
  year: number
  uri: string
  rating: number
}

export interface WatchedEntry {
  date: string
  title: string
  year: number
  uri: string
}

export interface DiaryEntry {
  date: string
  title: string
  year: number
  uri: string
  rating: number | null
  rewatch: boolean | null
  tags: string[]
  watchedDate: string
}

export interface EnrichedMovie {
  uri: string
  title: string
  year: number
  dateRated: string | null
  watchedDates?: string[]
  userRating: number
  tmdbId: number | null
  genres: string[]
  poster: string | null
  directors: MovieDirector[]
  _matched: boolean
}

export interface EnrichedImportData {
  movies: Movie[]
  watches: Watch[]
  stats: ImportStats
}
