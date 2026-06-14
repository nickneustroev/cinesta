import type { ImportData } from '../../app/types/import'
import ratings from '../data/ratings.json'
import watched from '../data/watched.json'
import diary from '../data/diary.json'

export default defineEventHandler(async (): Promise<ImportData> => {
  const r = ratings as ImportData['ratings']
  const w = watched as ImportData['watched']
  const d = diary as ImportData['diary']

  const allTitles = new Set<string>()
  for (const entry of r) allTitles.add(entry.title)
  for (const entry of w) allTitles.add(entry.title)
  for (const entry of d) allTitles.add(entry.title)

  let avgRating: number | null = null
  const sum = r.reduce((acc, entry) => acc + entry.rating, 0)
  if (r.length > 0) avgRating = Math.round((sum / r.length) * 100) / 100

  return {
    ratings: r,
    watched: w,
    diary: d,
    stats: {
      totalRatings: r.length,
      totalWatched: w.length,
      totalDiary: d.length,
      uniqueTitles: allTitles.size,
      avgRating
    }
  }
})
