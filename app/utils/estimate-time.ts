import JSZip from 'jszip'

const MOVIES_PER_SECOND = 13
const MIN_TIME_SECONDS = 10

export async function estimateProcessingTime(file: File, minRating = 3): Promise<{ count: number, seconds: number } | null> {
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
      if (!Number.isNaN(rating) && rating >= minRating) count++
    }

    const seconds = Math.max(MIN_TIME_SECONDS, Math.round(count / MOVIES_PER_SECOND))
    return { count, seconds }
  } catch {
    return null
  }
}
