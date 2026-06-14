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

export interface ImportData {
  ratings: RatingEntry[]
  watched: WatchedEntry[]
  diary: DiaryEntry[]
  stats: {
    totalRatings: number
    totalWatched: number
    totalDiary: number
    uniqueTitles: number
    avgRating: number | null
  }
}
