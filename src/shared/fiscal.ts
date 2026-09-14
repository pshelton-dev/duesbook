export interface FiscalPeriod {
  label: string
  startDate: string
  endDate: string
}

/**
 * The fiscal year containing `today` for an org whose FY starts in
 * `startMonth` (1–12). A July-start FY on 2026-07-08 → 2026-07-01 to
 * 2027-06-30, labeled "2026–2027"; a January-start FY is labeled "2026".
 */
export function currentFiscalPeriod(startMonth: number, today = new Date()): FiscalPeriod {
  const y = today.getFullYear()
  const startYear = today.getMonth() + 1 >= startMonth ? y : y - 1
  const mm = String(startMonth).padStart(2, '0')
  const startDate = `${startYear}-${mm}-01`
  const endExclusive = new Date(startYear + 1, startMonth - 1, 1)
  const endInclusive = new Date(endExclusive.getTime() - 24 * 60 * 60 * 1000)
  const em = String(endInclusive.getMonth() + 1).padStart(2, '0')
  const ed = String(endInclusive.getDate()).padStart(2, '0')
  const endDate = `${endInclusive.getFullYear()}-${em}-${ed}`
  const label = startMonth === 1 ? `${startYear}` : `${startYear}–${startYear + 1}`
  return { label, startDate, endDate }
}

/** The fiscal year `offset` years before the current one (0 = current). */
export function fiscalPeriodShifted(
  startMonth: number,
  offset: number,
  today = new Date()
): FiscalPeriod {
  const current = currentFiscalPeriod(startMonth, today)
  const startYear = Number(current.startDate.slice(0, 4)) - offset
  const shift = (iso: string, years: number): string =>
    `${Number(iso.slice(0, 4)) + years}${iso.slice(4)}`
  const label =
    startMonth === 1 ? `${startYear}` : `${startYear}–${startYear + 1}`
  return {
    label,
    startDate: shift(current.startDate, -offset),
    endDate: shift(current.endDate, -offset)
  }
}

/** The calendar month containing today, as a dues period: "Jul 2026". */
export function currentMonthPeriod(today = new Date()): FiscalPeriod {
  const y = today.getFullYear()
  const m = today.getMonth() + 1
  const lastDay = new Date(y, m, 0).getDate()
  const mm = String(m).padStart(2, '0')
  const short = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return {
    label: `${short[m - 1]} ${y}`,
    startDate: `${y}-${mm}-01`,
    endDate: `${y}-${mm}-${String(lastDay).padStart(2, '0')}`
  }
}

/** First and last day of the calendar month `offset` months ago (0 = this month). */
export function monthRange(offset: number, today = new Date()): { from: string; to: string } {
  const first = new Date(today.getFullYear(), today.getMonth() - offset, 1)
  const last = new Date(today.getFullYear(), today.getMonth() - offset + 1, 0)
  const iso = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { from: iso(first), to: iso(last) }
}

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]
