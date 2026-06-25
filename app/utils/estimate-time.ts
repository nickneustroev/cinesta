import JSZip from 'jszip'

const MIN_TIME_SECONDS = 10
const DEFAULT_MOVIES_PER_MINUTE = 300

function getMoviesPerSecond() {
  const { public: { importMoviesPerMinute } } = useRuntimeConfig()
  const parsedValue = Number(String(importMoviesPerMinute ?? '').trim())
  const moviesPerMinute = Number.isFinite(parsedValue) && parsedValue > 0
    ? parsedValue
    : DEFAULT_MOVIES_PER_MINUTE

  return moviesPerMinute / 60
}

export async function estimateProcessingTime(file: File): Promise<{ count: number, seconds: number } | null> {
  try {
    const zip = await JSZip.loadAsync(file)
    const ratingsFile = zip.file('ratings.csv')
    if (!ratingsFile) return null

    const text = await ratingsFile.async('string')
    const lines = text.split('\n').filter(Boolean)
    if (lines.length < 2) return { count: 0, seconds: 0 }

    const headers = lines[0]!.split(',')
    const ratingIdx = headers.findIndex(h => h.trim() === 'Rating')
    if (ratingIdx === -1) return null

    let count = 0
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i]!.split(',')
      const rating = Number(cols[ratingIdx]?.trim())
      if (!Number.isNaN(rating)) count++
    }

    const seconds = Math.max(MIN_TIME_SECONDS, Math.round(count / getMoviesPerSecond()))
    return { count, seconds }
  } catch {
    return null
  }
}
