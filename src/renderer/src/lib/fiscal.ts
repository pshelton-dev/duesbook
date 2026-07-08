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
