/**
 * Minimal RFC-4180 CSV parser: quoted fields, escaped quotes (""), commas and
 * newlines inside quotes, CRLF or LF line endings. Returns rows of cells;
 * skips fully-empty lines.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  let i = 0

  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i += 2
        } else {
          inQuotes = false
          i++
        }
      } else {
        cell += ch
        i++
      }
    } else if (ch === '"') {
      inQuotes = true
      i++
    } else if (ch === ',') {
      row.push(cell)
      cell = ''
      i++
    } else if (ch === '\n' || ch === '\r') {
      row.push(cell)
      cell = ''
      if (row.some((c) => c.trim() !== '')) rows.push(row)
      row = []
      if (ch === '\r' && text[i + 1] === '\n') i++
      i++
    } else {
      cell += ch
      i++
    }
  }
  row.push(cell)
  if (row.some((c) => c.trim() !== '')) rows.push(row)
  return rows
}

/**
 * Loose date normalizer for CSV imports: returns YYYY-MM-DD or null.
 * US month/day/year is handled explicitly: Hermes (the phone's JS engine)
 * does not parse "3/1/2024" the way desktop V8 did.
 */
export function normalizeDate(value: string): string | null {
  const t = value.trim()
  if (!t) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const mdy = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (mdy) {
    const [, m, d, y] = mdy
    const mm = Number(m)
    const dd = Number(d)
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) return `${y}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
    return null
  }
  const parsed = new Date(t)
  if (isNaN(parsed.getTime())) return null
  const m = String(parsed.getMonth() + 1).padStart(2, '0')
  const d = String(parsed.getDate()).padStart(2, '0')
  return `${parsed.getFullYear()}-${m}-${d}`
}
