import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data', 'letterboxd-nikvkino-2026-06-12-10-11-utc')
const OUT_DIR = join(__dirname, '..', 'server', 'data')

function parseCSV(text) {
  const lines = []
  let current = ''
  let inQuotes = false
  let row = []

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]

    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      row.push(current.trim())
      current = ''
    } else if ((ch === '\n' || (ch === '\r' && next === '\n')) && !inQuotes) {
      row.push(current.trim())
      if (row.length > 1 || (row.length === 1 && row[0] !== '')) {
        lines.push(row)
      }
      row = []
      current = ''
      if (ch === '\r') i++
    } else {
      current += ch
    }
  }

  if (row.length > 0 || current) {
    row.push(current.trim())
    lines.push(row)
  }

  return lines
}

function parseCSVFile(filename) {
  const filePath = join(DATA_DIR, filename)
  if (!existsSync(filePath)) return null
  const text = readFileSync(filePath, 'utf-8')
  const rows = parseCSV(text)
  if (rows.length < 1) return []
  const headers = rows[0]
  return rows.slice(1).map(row => {
    const obj = {}
    headers.forEach((h, i) => {
      obj[h] = row[i] !== undefined ? row[i] : null
    })
    return obj
  })
}

function toNumber(val) {
  if (val === null || val === '' || val === undefined) return null
  const n = Number(val)
  return Number.isNaN(n) ? null : n
}

const diary = parseCSVFile('diary.csv')
const ratings = parseCSVFile('ratings.csv')
const watched = parseCSVFile('watched.csv')
const watchlist = parseCSVFile('watchlist.csv')
const profile = parseCSVFile('profile.csv')

const typedDiary = (diary || []).map(e => ({
  date: e.Date || null,
  title: e.Name || null,
  year: toNumber(e.Year),
  uri: e['Letterboxd URI'] || null,
  rating: toNumber(e.Rating),
  rewatch: e.Rewatch || null,
  tags: e.Tags ? e.Tags.split(',').map(t => t.trim()).filter(Boolean) : [],
  watchedDate: e['Watched Date'] || null
}))

const typedRatings = (ratings || []).map(e => ({
  date: e.Date || null,
  title: e.Name || null,
  year: toNumber(e.Year),
  uri: e['Letterboxd URI'] || null,
  rating: toNumber(e.Rating)
}))

const typedWatched = (watched || []).map(e => ({
  date: e.Date || null,
  title: e.Name || null,
  year: toNumber(e.Year),
  uri: e['Letterboxd URI'] || null
}))

const typedWatchlist = (watchlist || []).map(e => ({
  date: e.Date || null,
  title: e.Name || null,
  year: toNumber(e.Year),
  uri: e['Letterboxd URI'] || null
}))

const typedProfile = (profile && profile.length > 0) ? {
  dateJoined: profile[0]['Date Joined'] || null,
  username: profile[0].Username || null,
  givenName: profile[0]['Given Name'] || null,
  familyName: profile[0]['Family Name'] || null,
  location: profile[0].Location || null,
  website: profile[0].Website || null,
  bio: profile[0].Bio || null,
  pronoun: profile[0].Pronoun || null,
  favoriteFilms: profile[0]['Favorite Films']
    ? profile[0]['Favorite Films'].split(',').map(s => s.trim()).filter(Boolean)
    : []
} : null

const movieMap = new Map()

for (const e of typedDiary) {
  if (e.uri) {
    movieMap.set(e.uri, { ...movieMap.get(e.uri) || {}, ...e, uri: e.uri })
  }
}

for (const e of typedRatings) {
  if (e.uri) {
    const existing = movieMap.get(e.uri) || {}
    movieMap.set(e.uri, { ...existing, ...e, uri: e.uri })
  }
}

for (const e of typedWatched) {
  if (e.uri) {
    const existing = movieMap.get(e.uri) || {}
    movieMap.set(e.uri, { ...existing, ...e, uri: e.uri })
  }
}

const movies = Array.from(movieMap.values())

if (!existsSync(OUT_DIR)) {
  mkdirSync(OUT_DIR, { recursive: true })
}

writeFileSync(join(OUT_DIR, 'diary.json'), JSON.stringify(typedDiary, null, 2), 'utf-8')
writeFileSync(join(OUT_DIR, 'ratings.json'), JSON.stringify(typedRatings, null, 2), 'utf-8')
writeFileSync(join(OUT_DIR, 'watched.json'), JSON.stringify(typedWatched, null, 2), 'utf-8')
writeFileSync(join(OUT_DIR, 'watchlist.json'), JSON.stringify(typedWatchlist, null, 2), 'utf-8')
if (typedProfile) {
  writeFileSync(join(OUT_DIR, 'profile.json'), JSON.stringify(typedProfile, null, 2), 'utf-8')
}
writeFileSync(join(OUT_DIR, 'movies.json'), JSON.stringify(movies, null, 2), 'utf-8')

console.log('Done! Generated files:')
console.log(`  diary.json     — ${typedDiary.length} entries`)
console.log(`  ratings.json   — ${typedRatings.length} entries`)
console.log(`  watched.json   — ${typedWatched.length} entries`)
console.log(`  watchlist.json — ${typedWatchlist.length} entries`)
console.log(`  profile.json   — 1 entry`)
console.log(`  movies.json    — ${movies.length} unique movies (merged)`)
console.log(`  → ${OUT_DIR}`)
