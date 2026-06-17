export function parseCSV(text: string): string[][] {
  const lines: string[][] = []
  let current = ''
  let inQuotes = false
  let row: string[] = []
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]
    if (ch === '"') {
      if (inQuotes && next === '"') { current += '"'; i++ } else { inQuotes = !inQuotes }
    } else if (ch === ',' && !inQuotes) {
      row.push(current.trim()); current = ''
    } else if ((ch === '\n' || (ch === '\r' && next === '\n')) && !inQuotes) {
      row.push(current.trim())
      if (row.length > 1 || (row.length === 1 && row[0] !== '')) lines.push(row)
      row = []; current = ''
      if (ch === '\r') i++
    } else { current += ch }
  }
  if (row.length > 0 || current) { row.push(current.trim()); lines.push(row) }
  return lines
}

export function csvToObjects(text: string): Record<string, string>[] {
  const rows = parseCSV(text)
  if (rows.length < 1) return []
  const headers = rows[0]!
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h] = row[i] !== undefined ? row[i] : '' })
    return obj
  })
}

export function toNumber(val: string | null | undefined): number | null {
  if (val === null || val === '' || val === undefined) return null
  const n = Number(val)
  return Number.isNaN(n) ? null : n
}
