import type { BankDateFormat, BankGrid, BankMapping } from './bank-import'
import { parseBankDate } from './bank-import'

/**
 * Best-effort column mapping from header names plus the first data row.
 * Lifted from the desktop import drawer so both apps guess the same way.
 */
export function guessMapping(grid: BankGrid): BankMapping {
  const find = (re: RegExp): number => grid.headers.findIndex((h) => re.test(h))
  const withdrawalCol = find(/withdraw|debit/i)
  const depositCol = find(/deposit|credit/i)
  const amountCol = find(/amount/i)
  const dateCol = Math.max(find(/date/i), 0)
  const split = withdrawalCol >= 0 && depositCol >= 0 && amountCol < 0
  return {
    dateCol,
    dateFormat: guessDateFormat(grid, dateCol),
    descriptionCol: Math.max(find(/desc|payee|name|narrat|detail/i), dateCol === 0 ? 1 : 0),
    convention: split ? 'split' : 'signed',
    amountCol: split ? undefined : Math.max(amountCol, 0),
    withdrawalCol: split ? withdrawalCol : undefined,
    depositCol: split ? depositCol : undefined
  }
}

/** The format that parses the most sample values in `col`; ties go to US month-first. */
export function guessDateFormat(grid: BankGrid, col: number): BankDateFormat {
  const samples = grid.rows.slice(0, 20).map((r) => r[col] ?? '')
  const candidates: BankDateFormat[] = ['iso', 'excel-serial', 'mdy', 'dmy']
  let best: BankDateFormat = 'mdy'
  let bestHits = -1
  for (const f of candidates) {
    const hits = samples.filter((s) => parseBankDate(s, f) !== null).length
    if (hits > bestHits) {
      best = f
      bestHits = hits
    }
  }
  return best
}

export const DATE_FORMAT_LABEL: Record<BankDateFormat, string> = {
  iso: 'Year-month-day (2026-09-14)',
  mdy: 'Month/day/year (09/14/2026)',
  dmy: 'Day/month/year (14/09/2026)',
  'excel-serial': 'Excel date number'
}
