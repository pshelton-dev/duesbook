/** "$1,234.50" | "1234.5" | "-20" → integer cents, or null if unparseable. */
export function parseDollarsToCents(input: string): number | null {
  const t = input.replace(/[$,\s]/g, '')
  if (t === '' || t === '-' || !/^-?\d+(\.\d{1,2})?$/.test(t)) return null
  return Math.round(parseFloat(t) * 100)
}

export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const dollars = Math.floor(abs / 100)
  return `${sign}$${dollars.toLocaleString('en-US')}.${String(abs % 100).padStart(2, '0')}`
}

export function todayIso(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}
