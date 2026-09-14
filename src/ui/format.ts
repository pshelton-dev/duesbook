export { formatCents, parseDollarsToCents, todayIso } from '../shared/money'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-09-09" → "Sep 9"; with `year`, "Sep 9, 2026". */
export function fmtDate(iso: string, year = false): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${MONTHS[m - 1]} ${d}${year ? `, ${y}` : ''}`
}

/** "2026-09-14" → "Today, Sep 14" when it is today. */
export function fmtDateRelative(iso: string): string {
  return iso === todayIsoLocal() ? `Today, ${fmtDate(iso)}` : fmtDate(iso, true)
}

function todayIsoLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Whole dollars for the balance tiles: "$1,914". */
export function formatDollars(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  return `${sign}$${Math.floor(Math.abs(cents) / 100).toLocaleString('en-US')}`
}
