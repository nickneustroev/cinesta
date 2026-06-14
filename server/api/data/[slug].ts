import diary from '../../data/diary.json'
import movies from '../../data/movies.json'
import profile from '../../data/profile.json'
import ratings from '../../data/ratings.json'
import watched from '../../data/watched.json'
import watchlist from '../../data/watchlist.json'

const datasets: Record<string, unknown> = { diary, movies, profile, ratings, watched, watchlist }

export default defineEventHandler((event) => {
  const slug = getRouterParam(event, 'slug')

  if (!slug || !(slug in datasets)) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  return datasets[slug]
})
